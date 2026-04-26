import * as fs from 'fs'
import * as path from 'path'
// Load env from scrutinise-web/.env — dotenv/config would look in cwd (scripts/), which has no .env
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { prisma } from '../../scrutinise-web/lib/prisma'
import { LegislationTier, LegislationType, CompilationStatus } from '@prisma/client'
import { r2Put, r2Exists, originalXmlKey, tnaXmlKey, effectsKey } from './r2-client'

// ─────────────────────────────────────────────────────────────────────────────
// Prisma retry helper — handles transient Railway connection drops (P1017, P1001)
// ─────────────────────────────────────────────────────────────────────────────

async function withPrismaRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const RETRYABLE_CODES = ['P1017', 'P1001', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT']
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      const code    = String(err?.code ?? '')
      const message = String(err?.message ?? '')
      const isRetryable = RETRYABLE_CODES.includes(code)
        || RETRYABLE_CODES.some(c => message.includes(c))
        || message.includes('connection refused')
        || message.includes('connection closed')
      if (isRetryable && attempt < 4) {
        const delay = attempt * 5000  // 5s, 10s, 15s
        console.warn(`  ⚠ Prisma connection error on ${label} — retrying in ${delay / 1000}s (attempt ${attempt}/4): ${code}`)
        await new Promise(r => setTimeout(r, delay))
      } else {
        throw err
      }
    }
  }
  throw new Error(`withPrismaRetry: exhausted retries for ${label}`)
}

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
    if (url) await new Promise(r => setTimeout(r, 500))
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
  if (/scotland/i.test(coverage))              jurisdiction = 'Scotland'
  else if (/wales/i.test(coverage))            jurisdiction = 'Wales'
  else if (/northern ireland/i.test(coverage)) jurisdiction = 'NI'
  else if (/england/i.test(coverage))          jurisdiction = 'England'

  const subjectArea = xml.match(/<ukm:Subject\s+Value="([^"]+)"/)?.[1] ?? null
  const policyArea  = xml.match(/<dc:subject[^>]*>(.*?)<\/dc:subject>/)?.[1] ?? null

  return { jurisdiction, subjectArea, policyArea }
}

// Returns section list from full-act CLML — numbers, titles, and FTS text only.
// rawXml is NOT included: per-section XML is fetched separately via fetchSectionXml().
function fetchSectionsFromXml(xml: string): Array<{
  sectionNumber: string
  sectionTitle: string
  originalText: string
}> {
  const sections: Array<{ sectionNumber: string; sectionTitle: string; originalText: string }> = []
  // [^>]* matches P1group tags with any attributes (RestrictExtent, RestrictStartDate, etc.)
  const p1groups = [...xml.matchAll(/<P1group[^>]*>([\s\S]*?)<\/P1group>/g)]
  for (const [, group] of p1groups) {
    // Strip XML tags from Pnumber — TNA CLML can contain <Addition>, <CommentaryRef> etc. inside <Pnumber>
    const num   = (group.match(/<Pnumber[^>]*>(.*?)<\/Pnumber>/)?.[1] ?? '').replace(/<[^>]+>/g, '').trim()
    const title = (group.match(/<Title[^>]*>(.*?)<\/Title>/)?.[1] ?? '').replace(/<[^>]+>/g, '').trim()
    const text  = group.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (num) sections.push({ sectionNumber: num, sectionTitle: title, originalText: text })
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
// Per-section XML fetch — returns scoped P1group XML or null
// ─────────────────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 30000  // 30s timeout for all TNA fetch calls

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id))
}

async function fetchSectionXml(
  actId: string,
  sectionNumber: string,
  variant: 'enacted' | 'current'
): Promise<{ xml: string | null; status: number }> {
  const url = variant === 'enacted'
    ? `https://www.legislation.gov.uk/${actId}/section/${sectionNumber}/enacted/data.xml`
    : `https://www.legislation.gov.uk/${actId}/section/${sectionNumber}/data.xml`
  try {
    const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/xml', 'User-Agent': 'Scrutinise/1.0 (data@scrutinise.org)' } })
    if (res.status === 200) {
      const xml = await res.text()
      // Scope to the P1group whose <Pnumber> matches our section number
      // Strip XML tags from pnum for matching — TNA CLML may embed <CommentaryRef>, <Addition> etc. in <Pnumber>
      const p1groups = [...xml.matchAll(/<P1group[^>]*>([\s\S]*?)<\/P1group>/g)]
      for (const [fullMatch, group] of p1groups) {
        const pnum = (group.match(/<Pnumber[^>]*>(.*?)<\/Pnumber>/)?.[1] ?? '').replace(/<[^>]+>/g, '').trim()
        if (pnum === sectionNumber) return { xml: fullMatch, status: 200 }
      }
      // 200 but no matching P1group — TNA section endpoint returned full document or wrong section
      console.warn(`    ⚠ s.${sectionNumber} (${variant}) — 200 but no matching P1group`)
      return { xml: null, status: 200 }
    }
    if (res.status === 202) {
      // TNA on-demand generation — document exists but not yet compiled
      return { xml: null, status: 202 }
    }
    if (res.status === 404) {
      return { xml: null, status: 404 }
    }
    if (res.status === 429 || res.status === 503) {
      return { xml: null, status: res.status }
    }
    console.warn(`    ⚠ s.${sectionNumber} (${variant}) — HTTP ${res.status}`)
    return { xml: null, status: res.status }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn(`    ⚠ s.${sectionNumber} (${variant}) — fetch timeout (${FETCH_TIMEOUT_MS / 1000}s)`)
    } else {
      console.warn(`    ⚠ s.${sectionNumber} (${variant}) — fetch error: ${err}`)
    }
    return { xml: null, status: -1 }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Effects feed fetch — returns concatenated entry XML or null
// ─────────────────────────────────────────────────────────────────────────────

async function fetchEffectsFeed(actId: string): Promise<string | null> {
  const baseUrl = `https://www.legislation.gov.uk/changes/affected/${actId}/data.feed`
  const allEntries: string[] = []
  let url: string | null = baseUrl
  let pageCount = 0
  const MAX_PAGES = 200

  while (url && pageCount < MAX_PAGES) {
    try {
      const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/xml', 'User-Agent': 'Scrutinise/1.0 (data@scrutinise.org)' } })
      if (res.status === 404) {
        if (pageCount === 0) return null  // no effects feed for this act
        break
      }
      if (!res.ok) {
        console.warn(`    ⚠ Effects page ${pageCount + 1} — HTTP ${res.status}`)
        break
      }
      const xml = await res.text()
      const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
      allEntries.push(...entries.map(([full]) => full))
      // Follow next page link
      let nextUrl = xml.match(/<link[^>]*rel="next"[^>]*href="([^"]+)"/)?.[1] ?? null
      if (nextUrl) nextUrl = nextUrl.replace(/&amp;/g, '&')
      if (!nextUrl || nextUrl === url) break  // no next page or infinite loop guard
      url = nextUrl
      pageCount++
      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      console.warn(`    ⚠ Effects fetch error: ${err}`)
      break
    }
  }

  if (pageCount >= MAX_PAGES) {
    console.warn(`    ⚠ Effects — page cap (${MAX_PAGES}) reached for ${actId}`)
  }

  if (allEntries.length === 0) return null

  const now = new Date().toISOString()
  return `<EffectsFeed actId="${actId}" pages="${pageCount + 1}" fetchedAt="${now}">\n${allEntries.join('\n')}\n</EffectsFeed>`
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
// Core ingest — three-layer per-section + per-act effects feed
// ─────────────────────────────────────────────────────────────────────────────

async function ingestAct(
  act: ActRef,
  completed: Set<string>,
  totalActs: number,
  doneCount: number,
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

  // Fetch full-act CLML (current version) to extract section list and metadata
  const clmlRes = await fetchWithTimeout(act.clmlUrl)
  if (clmlRes.status === 202) {
    // TNA on-demand generation — full-act CLML not yet available; skip section extraction
    console.warn(`  ⚠ ${act.title} — full-act CLML returned 202, skipping section extraction`)
    // Still upsert the LegislationItem so the act is recorded in DB
  } else if (!clmlRes.ok) {
    console.warn(`  ⚠ ${act.title} — full-act CLML HTTP ${clmlRes.status}, skipping`)
    return
  }
  const clmlXml = clmlRes.status === 202 ? '' : await clmlRes.text()

  const { jurisdiction, subjectArea, policyArea } = extractClmlMetadata(clmlXml)
  const legislationType = getLegislationType(act.feedUrl)
  const tier            = getLegislationTier(act.feedUrl)

  const item = await withPrismaRetry(
    () => prisma.legislationItem.upsert({
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
    }),
    `upsert LegislationItem ${legislationGovUkId}`
  )

  const sections = fetchSectionsFromXml(clmlXml)

  for (const s of sections) {
    const origKey    = originalXmlKey(legislationGovUkId, s.sectionNumber)
    const currentKey = tnaXmlKey(legislationGovUkId, s.sectionNumber)

    // Check R2 cache — idempotent on re-run within same act
    let hasOriginal = await r2Exists(origKey)
    let hasCurrent  = await r2Exists(currentKey)
    let enacted202  = false
    let current202  = false

    // Fetch enacted XML if not already in R2
    if (!hasOriginal) {
      await throttle.wait()
      const { xml, status } = await fetchSectionXml(legislationGovUkId, s.sectionNumber, 'enacted')
      if (status === 429 || status === 503) throttle.backoff()
      else throttle.success()
      if (xml) {
        await r2Put(origKey, xml, 'application/xml')
        hasOriginal = true
        console.log(`    ✓ s.${s.sectionNumber} enacted → R2`)
      } else if (status === 202) {
        enacted202 = true
        console.warn(`    ⚠ s.${s.sectionNumber} enacted — 202 (TNA generating on demand)`)
      } else if (status === 404) {
        console.log(`    - s.${s.sectionNumber} enacted — 404 (not available at section endpoint)`)
      }
    }

    // Fetch current XML if not already in R2
    if (!hasCurrent) {
      await throttle.wait()
      const { xml, status } = await fetchSectionXml(legislationGovUkId, s.sectionNumber, 'current')
      if (status === 429 || status === 503) throttle.backoff()
      else throttle.success()
      if (xml) {
        await r2Put(currentKey, xml, 'application/xml')
        hasCurrent = true
        console.log(`    ✓ s.${s.sectionNumber} current → R2`)
      } else if (status === 202) {
        current202 = true
        console.warn(`    ⚠ s.${s.sectionNumber} current — 202 (TNA generating on demand)`)
      } else if (status === 404) {
        console.log(`    - s.${s.sectionNumber} current — 404`)
      }
    }

    // compilationStatus: FAILED only when BOTH are 202 (temporary TNA generation delay)
    // All other outcomes (including 404) → PENDING (data may be partial but compiler can work with what it has)
    const both202 = enacted202 && current202
    const status  = both202 ? CompilationStatus.FAILED : CompilationStatus.PENDING

    await withPrismaRetry(
      () => prisma.legislationSection.upsert({
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
          originalXmlKey: hasOriginal ? origKey : null,
          tnaXmlKey: hasCurrent ? currentKey : null,
          compilationStatus: status,
          compiledBy: both202 ? 'tna-202' : null,
        },
        update: {
          originalText: s.originalText,
          sectionTitle: s.sectionTitle,
          originalXmlKey: hasOriginal ? origKey : null,
          tnaXmlKey: hasCurrent ? currentKey : null,
          compilationStatus: status,
          compiledBy: both202 ? 'tna-202' : null,
        },
      }),
      `upsert section ${legislationGovUkId}/${s.sectionNumber}`
    )
  }

  // Update section count
  await withPrismaRetry(
    () => prisma.legislationItem.update({
      where: { id: item.id },
      data: { sectionCount: sections.length },
    }),
    `update LegislationItem sectionCount ${legislationGovUkId}`
  )

  // Fetch per-act effects feed (TNA Changes to Legislation)
  console.log(`  Fetching effects feed for ${legislationGovUkId}...`)
  const fxKey     = effectsKey(legislationGovUkId)
  const fxContent = await fetchEffectsFeed(legislationGovUkId)
  if (fxContent) {
    await r2Put(fxKey, fxContent, 'application/xml')
    await withPrismaRetry(
      () => prisma.legislationItem.update({
        where: { id: item.id },
        data: { effectsKey: fxKey, effectsFetchedAt: new Date() },
      }),
      `update LegislationItem effectsKey ${legislationGovUkId}`
    )
    const entryCount = (fxContent.match(/<entry>/g) ?? []).length
    console.log(`  ✓ Effects — ${entryCount} entries → R2`)
  } else {
    console.log(`  - Effects — no feed available`)
  }

  console.log(`  ✓ ${sections.length} sections — ${act.title}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const mode = args[0] ?? '--tier1'

  // --test-acts ukpga/2010/15,ukpga/1968/60,...  — ingest specific acts only (Phase 4 verification)
  if (mode === '--test-acts') {
    const actIds = (args[1] ?? '').split(',').map(s => s.trim()).filter(Boolean)
    if (actIds.length === 0) { console.error('--test-acts requires comma-separated act IDs'); return }
    console.log(`Test-act ingest: ${actIds.join(', ')}`)
    // Warm up DB connection BEFORE heavy CLML fetches so Railway proxy is ready
    await prisma.legislationItem.count()
    console.log('DB connection warm.')
    const throttle = new AdaptiveThrottle()
    for (const actId of actIds) {
      const parts   = actId.split('/')  // e.g. ['ukpga', '2010', '15']
      const year    = parseInt(parts[1] ?? '0')
      const number  = parseInt(parts[2] ?? '0')
      const clmlUrl = `https://www.legislation.gov.uk/${actId}/data.xml`
      const feedUrl = `https://www.legislation.gov.uk/${parts[0]}/data.feed`
      // Get title from feed (lightweight atom entry) to avoid double CLML download
      const feedEntry = await fetchWithTimeout(`https://www.legislation.gov.uk/${actId}/data.feed`)
        .then(r => r.text()).catch(() => '')
      const title = feedEntry.match(/<title[^>]*>(.*?)<\/title>/)?.[1] ?? actId
      const act: ActRef = { title, year, number, id: parts[0] ?? '', clmlUrl, feedUrl }
      try {
        await ingestAct(act, new Set(), 1, 0, throttle)
      } catch (err: any) {
        console.error(`❌ Failed act ${actId}: [${err?.code ?? 'ERR'}] ${err?.message?.slice(0, 200) ?? err}`)
      }
    }
    console.log('\nTest-act ingest complete.')
    return
  }

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

  // Migrate V2L checkpoint files on first run of new ingest
  // (Old checkpoint covered wrong data — current-state XML — not usable for new three-layer ingest)
  const V2L_CHECKPOINT = path.join(__dirname, 'ingest-checkpoint.v2L.json')
  const V2L_BAK        = path.join(__dirname, 'ingest-checkpoint.v2L.json.bak')
  const OLD_BAK        = path.join(__dirname, 'ingest-checkpoint.json.bak')
  if (fs.existsSync(CHECKPOINT_FILE) && !fs.existsSync(V2L_CHECKPOINT)) {
    fs.renameSync(CHECKPOINT_FILE, V2L_CHECKPOINT)
    console.log('Migrated ingest-checkpoint.json → ingest-checkpoint.v2L.json (V2L checkpoint preserved)')
  }
  if (fs.existsSync(OLD_BAK) && !fs.existsSync(V2L_BAK)) {
    fs.renameSync(OLD_BAK, V2L_BAK)
    console.log('Migrated ingest-checkpoint.json.bak → ingest-checkpoint.v2L.json.bak')
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
  let failCount = 0

  for (const act of acts) {
    try {
      await ingestAct(act, completed, acts.length, doneCount, throttle)
    } catch (err: any) {
      const id = buildLegislationGovUkId(act.feedUrl, act.year, act.number)
      console.error(`❌ Failed act ${id}: ${err?.message ?? err}`)
      failCount++
    }
    doneCount++

    // Update checkpoint after each act (--full mode)
    if (mode === '--full') {
      const id = buildLegislationGovUkId(act.feedUrl, act.year, act.number)
      completed.add(id)
      saveCheckpoint(completed)
    }

    await new Promise(r => setTimeout(r, 500))  // rate limit between acts
    await waitIfPaused()
  }

  if (failCount > 0) {
    console.log(`\nIngestion complete. ❌ ${failCount} act(s) failed — check log above.`)
  } else {
    console.log('\nIngestion complete. No failures.')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
