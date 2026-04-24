import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '../../scrutinise-web/lib/prisma'
import { LegislationTier, LegislationType, CompilationStatus, CompilationConfidence } from '@prisma/client'
import { r2Put, r2Exists, r2Get, xmlKey, compiledKey } from './r2-client'

// ─────────────────────────────────────────────────────────────────────────────
// Feed URLs
// ─────────────────────────────────────────────────────────────────────────────

const TIER_1_FEED = 'https://www.legislation.gov.uk/ukpga/2010-2025/data.feed?results-count=100'
const FULL_FEED   = 'https://www.legislation.gov.uk/ukpga/data.feed'
const SI_FEED     = 'https://www.legislation.gov.uk/uksi/data.feed'
const EU_FEED     = 'https://www.legislation.gov.uk/euretained/data.feed'

// Checkpoint file for --full mode (resume after interruption)
const CHECKPOINT_FILE = path.join(__dirname, 'ingest-checkpoint.json')
// Pause sentinel — create this file to pause the loop; delete to resume
const PAUSE_FILE = path.join(__dirname, 'PAUSE')

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint helpers
// ─────────────────────────────────────────────────────────────────────────────

function loadCheckpoint(): Set<string> {
  try {
    const raw = fs.readFileSync(CHECKPOINT_FILE, 'utf8')
    const data = JSON.parse(raw) as { completed: string[] }
    return new Set(data.completed)
  } catch {
    return new Set()
  }
}

function saveCheckpoint(completed: Set<string>): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ completed: [...completed] }, null, 2))
}

// ─────────────────────────────────────────────────────────────────────────────
// Pause helper — blocks until PAUSE file is removed
// ─────────────────────────────────────────────────────────────────────────────

async function waitIfPaused(): Promise<void> {
  while (fs.existsSync(PAUSE_FILE)) {
    console.log('  ⏸ PAUSE file detected — waiting 30s...')
    await new Promise(r => setTimeout(r, 30000))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Feed parsing helpers
// ─────────────────────────────────────────────────────────────────────────────

interface ActRef {
  title: string
  year: number
  number: number
  id: string
  clmlUrl: string
  feedUrl: string
}

async function fetchFeedPage(url: string): Promise<{ acts: ActRef[], nextUrl: string | null }> {
  const res = await fetch(url)
  const xml = await res.text()

  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
  const acts = entries.flatMap(([, entry]) => {
    const title   = entry.match(/<title[^>]*>(.*?)<\/title>/)?.[1] ?? ''
    const docType = entry.match(/<ukm:DocumentMainType\s+Value="([^"]+)"/)?.[1] ?? ''
    const year    = parseInt(entry.match(/<ukm:Year\s+Value="(\d+)"/)?.[1] ?? '0')
    const number  = parseInt(entry.match(/<ukm:Number\s+Value="(\d+)"/)?.[1] ?? '0')
    const clmlUrl = entry.match(/<link[^>]*type="application\/xml"[^>]*href="([^"]+)"/)?.[1] ?? ''
    if (!year || !number || !clmlUrl) return []
    return [{ title, year, number, id: docType, clmlUrl, feedUrl: url }]
  })

  // Follow 'next' rel link for pagination — decode HTML entities (&amp; → &)
  let nextUrl = xml.match(/<link[^>]*rel="next"[^>]*href="([^"]+)"/)?.[1] ?? null
  if (nextUrl) nextUrl = nextUrl.replace(/&amp;/g, '&')

  return { acts, nextUrl }
}

async function fetchAllActsFromFeed(startUrl: string): Promise<ActRef[]> {
  const all: ActRef[] = []
  let url: string | null = startUrl
  let pageNum = 1
  while (url) {
    console.log(`  Fetching feed page ${pageNum}: ${url}`)
    const { acts, nextUrl } = await fetchFeedPage(url)
    all.push(...acts)
    if (nextUrl && nextUrl === url) {
      console.warn('  ⚠ next URL same as current — breaking to prevent infinite loop')
      break
    }
    url = nextUrl
    if (url) await new Promise(r => setTimeout(r, 500)) // 500ms between feed pages
    pageNum++
  }
  return all
}

// ─────────────────────────────────────────────────────────────────────────────
// CLML helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractClmlMetadata(xml: string): { jurisdiction: string; subjectArea: string | null; policyArea: string | null } {
  const coverage    = xml.match(/<dc:coverage[^>]*>(.*?)<\/dc:coverage>/)?.[1] ?? ''
  let jurisdiction  = 'UK'
  if (/scotland/i.test(coverage))        jurisdiction = 'Scotland'
  else if (/wales/i.test(coverage))      jurisdiction = 'Wales'
  else if (/northern ireland/i.test(coverage)) jurisdiction = 'NI'
  else if (/england/i.test(coverage))    jurisdiction = 'England'

  const subjectArea = xml.match(/<ukm:Subject\s+Value="([^"]+)"/)?.[1] ?? null
  const policyArea  = xml.match(/<dc:subject[^>]*>(.*?)<\/dc:subject>/)?.[1] ?? null

  return { jurisdiction, subjectArea, policyArea }
}

function fetchSectionsFromXml(xml: string): Array<{
  sectionNumber: string
  sectionTitle: string
  originalText: string
  rawXml: string
}> {
  const sections: Array<{ sectionNumber: string; sectionTitle: string; originalText: string; rawXml: string }> = []
  const p1groups = [...xml.matchAll(/<P1group>([\s\S]*?)<\/P1group>/g)]
  for (const [fullMatch, group] of p1groups) {
    const num   = group.match(/<Pnumber[^>]*>(.*?)<\/Pnumber>/)?.[1]?.trim() ?? ''
    const title = group.match(/<Title[^>]*>(.*?)<\/Title>/)?.[1]?.replace(/<[^>]+>/g, '') ?? ''
    const text  = group.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (num) sections.push({ sectionNumber: num, sectionTitle: title, originalText: text, rawXml: fullMatch })
  }
  return sections
}

// ─────────────────────────────────────────────────────────────────────────────
// Adaptive throttle — adjusts delay based on TNA response codes
// ─────────────────────────────────────────────────────────────────────────────

class AdaptiveThrottle {
  private delay = 200
  private readonly MIN = 100
  private readonly MAX = 5000
  private readonly WINDOW = 10
  private history: boolean[] = [] // true = ok, false = rate-limited

  async wait(): Promise<void> {
    await new Promise(r => setTimeout(r, this.delay))
  }

  success(): void {
    this.history.push(true)
    if (this.history.length > this.WINDOW) this.history.shift()
    if (this.history.length === this.WINDOW && this.history.every(v => v)) {
      const before = this.delay
      this.delay = Math.max(this.MIN, Math.floor(this.delay * 0.9))
      if (this.delay < before) console.log(`  ✓ Running at ${this.delay}ms/request`)
    }
  }

  backoff(): void {
    this.history.push(false)
    if (this.history.length > this.WINDOW) this.history.shift()
    this.delay = Math.min(this.MAX, this.delay * 2)
    console.warn(`  ⚠ TNA rate limit detected — throttling to ${this.delay}ms`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TNA compiled text helpers
// ─────────────────────────────────────────────────────────────────────────────

async function fetchTnaCompiledText(
  legislationGovUkId: string,
  sectionNumber: string
): Promise<{ text: string | null; rateLimited: boolean }> {
  const url = `https://www.legislation.gov.uk/${legislationGovUkId}/section/${sectionNumber}/data.xml`
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/xml' } })
    if (res.status === 404) {
      console.warn(`    ⚠ s.${sectionNumber} — 404 (not yet compiled by TNA)`)
      return { text: null, rateLimited: false }
    }
    if (res.status === 429 || res.status === 503) {
      console.warn(`    ⚠ s.${sectionNumber} — HTTP ${res.status}`)
      return { text: null, rateLimited: true }
    }
    if (!res.ok) {
      console.warn(`    ⚠ s.${sectionNumber} — HTTP ${res.status}`)
      return { text: null, rateLimited: false }
    }
    const xml = await res.text()
    let text = xml.replace(/<[^>]+>/g, ' ')
    text = text.replace(/\s+/g, ' ').trim()
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#xD;/g, '')
      .replace(/&#x9;/g, ' ')
    return { text: text || null, rateLimited: false }
  } catch (err) {
    console.warn(`    ⚠ s.${sectionNumber} — fetch error: ${err}`)
    return { text: null, rateLimited: false }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legislation type mapper
// ─────────────────────────────────────────────────────────────────────────────

function getLegislationType(feedUrl: string): LegislationType {
  if (feedUrl.includes('/uksi/')) return LegislationType.UKSI
  if (feedUrl.includes('/euretained/')) return LegislationType.EUR
  return LegislationType.UKPGA
}

function getLegislationTier(feedUrl: string): LegislationTier {
  if (feedUrl.includes('/uksi/') || feedUrl.includes('/euretained/')) return LegislationTier.TIER_3
  return LegislationTier.TIER_1
}

function buildLegislationGovUkId(feedUrl: string, year: number, number: number): string {
  if (feedUrl.includes('/uksi/')) return `uksi/${year}/${number}`
  if (feedUrl.includes('/euretained/')) return `euretained/${year}/${number}`
  return `ukpga/${year}/${number}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Core ingest
// ─────────────────────────────────────────────────────────────────────────────

async function ingestAct(
  act: ActRef,
  completed: Set<string>,
  totalActs: number,
  doneCount: number,
  recompileTna: boolean = false,
  throttle: AdaptiveThrottle = new AdaptiveThrottle()
): Promise<void> {
  const legislationGovUkId = buildLegislationGovUkId(act.feedUrl, act.year, act.number)

  // Checkpoint: skip if already completed
  if (completed.has(legislationGovUkId)) {
    console.log(`  ⏭ Skip (checkpoint): ${legislationGovUkId}`)
    return
  }

  console.log(`\n[${doneCount}/${totalActs}] ${act.title} (${act.year}) — ${legislationGovUkId}`)

  await waitIfPaused()

  const clmlRes = await fetch(act.clmlUrl)
  const clmlXml = await clmlRes.text()

  const { jurisdiction, subjectArea, policyArea } = extractClmlMetadata(clmlXml)
  const legislationType = getLegislationType(act.feedUrl)
  const tier            = getLegislationTier(act.feedUrl)

  const item = await prisma.legislationItem.upsert({
    where: { legislationGovUkId },
    create: {
      legislationType,
      tier,
      title: act.title,
      year: act.year,
      number: act.number,
      jurisdiction,
      subjectArea,
      policyArea,
      legislationGovUkId,
      clmlUrl: act.clmlUrl,
      feedUrl: act.feedUrl,
      compilationStatus: CompilationStatus.PENDING,
    },
    update: {
      clmlUrl: act.clmlUrl,
      feedUrl: act.feedUrl,
      jurisdiction,
      subjectArea,
      policyArea,
    },
  })

  const sections = fetchSectionsFromXml(clmlXml)

  for (const s of sections) {
    const rXmlKey = xmlKey(legislationGovUkId, s.sectionNumber)

    // Write raw XML to R2 (skip if already there)
    if (!(await r2Exists(rXmlKey))) {
      await r2Put(rXmlKey, s.rawXml, 'application/xml')
    }

    // Upsert section with rawXmlKey
    await prisma.legislationSection.upsert({
      where: {
        legislationItemId_sectionNumber: {
          legislationItemId: item.id,
          sectionNumber: s.sectionNumber,
        },
      },
      create: {
        legislationItemId: item.id,
        sectionNumber: s.sectionNumber,
        sectionTitle: s.sectionTitle,
        originalText: s.originalText,
        rawXmlKey: rXmlKey,
        compilationStatus: CompilationStatus.PENDING,
      },
      update: {
        originalText: s.originalText,
        sectionTitle: s.sectionTitle,
        rawXmlKey: rXmlKey,
      },
    })

    // Check if compiled text already in R2 — skip TNA fetch if so (unless --recompile-tna)
    const cKey = compiledKey(legislationGovUkId, s.sectionNumber)
    if (!recompileTna && await r2Exists(cKey)) {
      console.log(`    ⏭ s.${s.sectionNumber} — compiled text already in R2`)
      // Ensure DB has the key recorded
      await prisma.legislationSection.update({
        where: {
          legislationItemId_sectionNumber: {
            legislationItemId: item.id,
            sectionNumber: s.sectionNumber,
          },
        },
        data: {
          compiledTextKey: cKey,
          compilationStatus: CompilationStatus.COMPILED,
          confidence: CompilationConfidence.HIGH,
          compiledBy: 'tna-direct',
        },
      })
      continue
    }

    // Fetch TNA compiled text with adaptive throttle
    await throttle.wait()
    const { text: tnaText, rateLimited } = await fetchTnaCompiledText(legislationGovUkId, s.sectionNumber)
    if (rateLimited) throttle.backoff()
    else throttle.success()

    if (tnaText) {
      await r2Put(cKey, tnaText)
      await prisma.legislationSection.update({
        where: {
          legislationItemId_sectionNumber: {
            legislationItemId: item.id,
            sectionNumber: s.sectionNumber,
          },
        },
        data: {
          compiledTextKey: cKey,
          compilationStatus: CompilationStatus.COMPILED,
          confidence: CompilationConfidence.HIGH,
          compiledBy: 'tna-direct',
        },
      })
      console.log(`    ✓ s.${s.sectionNumber} — TNA compiled text → R2`)
    }
  }

  await prisma.legislationItem.update({
    where: { id: item.id },
    data: { sectionCount: sections.length },
  })

  console.log(`  ✓ ${sections.length} sections loaded — ${act.title}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const recompileTna = args.includes('--recompile-tna')
  const mode = args.find(a => a !== '--recompile-tna') ?? '--tier1'

  // --reset-checkpoint: wipe checkpoint and exit
  if (mode === '--reset-checkpoint') {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE)
      console.log('Checkpoint reset.')
    } else {
      console.log('No checkpoint file found.')
    }
    return
  }

  let feedUrl: string
  let legislationTypeLabel: string

  switch (mode) {
    case '--full':
      feedUrl = FULL_FEED
      legislationTypeLabel = 'UK Public General Acts (full corpus)'
      break
    case '--si':
      feedUrl = SI_FEED
      legislationTypeLabel = 'UK Statutory Instruments'
      break
    case '--eu':
      feedUrl = EU_FEED
      legislationTypeLabel = 'Retained EU Legislation'
      break
    default:
      feedUrl = TIER_1_FEED
      legislationTypeLabel = 'Tier 1 Acts (2010–2025)'
      break
  }

  console.log(`Fetching ${legislationTypeLabel} from feed...`)

  const acts = mode === '--tier1'
    ? (await fetchFeedPage(feedUrl)).acts  // Tier 1: single page, no pagination needed
    : await fetchAllActsFromFeed(feedUrl)

  console.log(`Found ${acts.length} Acts`)

  const completed = mode === '--full' ? loadCheckpoint() : new Set<string>()
  const remaining = acts.filter(a => {
    const id = buildLegislationGovUkId(a.feedUrl, a.year, a.number)
    return !completed.has(id)
  })

  console.log(`${remaining.length} Acts to ingest (${completed.size} already checkpointed)`)

  let doneCount = completed.size
  const throttle = new AdaptiveThrottle()

  for (const act of acts) {
    await ingestAct(act, completed, acts.length, doneCount, recompileTna, throttle)
    doneCount++

    // Update checkpoint after each act (--full mode)
    if (mode === '--full') {
      const id = buildLegislationGovUkId(act.feedUrl, act.year, act.number)
      completed.add(id)
      saveCheckpoint(completed)
    }

    await new Promise(r => setTimeout(r, 500)) // Rate limit between acts
    await waitIfPaused()
  }

  console.log('\nIngestion complete.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
