/**
 * PACE Codes of Practice (A–I) — Operational Corpus Ingest
 * Sprint V.3-C
 *
 * Police and Criminal Evidence Act 1984 Codes A through I.
 * Sourced from: gov.uk/guidance/police-and-criminal-evidence-act-1984-pace-codes-of-practice
 *
 * Pre-check: queries Railway DB to verify PACE codes are not already in the
 * legislation corpus (LegislationItem table). If found, notes the duplication.
 *
 * Each code is scraped from its HTML accessible version on gov.uk.
 * sourceType: STATUTORY_GUIDANCE
 * publisherName: Home Office
 * R2 prefix: operational/home-office/pace-code-{X}/
 *
 * Run:
 *   cd scrutinise-web && npx tsx ../scripts/operational/pace-codes-ingest.ts
 *   or: npx tsx ../scripts/operational/pace-codes-ingest.ts --code=a
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { DocumentSourceType, OperationalIngestStatus } from '@prisma/client'
import { r2Put } from '../legislation/r2-client'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require(path.join(__dirname, '../../scrutinise-web/node_modules/pg'))
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
})

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const USER_AGENT = 'Scrutinise/1.0 (civic tech; +https://scrutinise.org/about)'
const MIN_DELAY_MS = 2000
const BACKOFF_INITIAL_MS = 30000
const BACKOFF_MAX_MS = 600000
const FETCH_TIMEOUT_MS = 30000
const GOV_UK_BASE = 'https://www.gov.uk'

const LOG_FILE = path.join(__dirname, 'pace-codes-log.csv')
const CHECKPOINT_FILE = path.join(__dirname, 'pace-codes-checkpoint.json')

// ─────────────────────────────────────────────────────────────────────────────
// PACE Code definitions
// Publication URLs per the gov.uk guidance index page.
// Each has an HTML accessible version at a known sub-path pattern.
// ─────────────────────────────────────────────────────────────────────────────

interface PaceCodeDef {
  code: string            // "A", "B", etc.
  slug: string            // our slug
  title: string
  publicationUrl: string  // gov.uk landing page
  // HTML accessible URL discovered dynamically from landing page
}

const PACE_CODES: PaceCodeDef[] = [
  {
    code: 'A',
    slug: 'pace-code-a',
    title: 'PACE Code A: Stop and Search',
    publicationUrl: `${GOV_UK_BASE}/government/publications/pace-code-a-december-2023`,
  },
  {
    code: 'B',
    slug: 'pace-code-b',
    title: 'PACE Code B: Searching Premises and Seizure',
    publicationUrl: `${GOV_UK_BASE}/government/publications/pace-code-b-2023`,
  },
  {
    code: 'C',
    slug: 'pace-code-c',
    title: 'PACE Code C: Detention, Treatment and Questioning of Persons',
    publicationUrl: `${GOV_UK_BASE}/government/publications/pace-code-c-2023`,
  },
  {
    code: 'D',
    slug: 'pace-code-d',
    title: 'PACE Code D: Identification of Persons',
    publicationUrl: `${GOV_UK_BASE}/government/publications/pace-code-d-2023`,
  },
  {
    code: 'EF',
    slug: 'pace-code-ef',
    title: 'PACE Codes E and F: Audio Recording and Visual Recording of Interviews',
    publicationUrl: `${GOV_UK_BASE}/government/publications/pace-codes-e-and-f-2018`,
  },
  {
    code: 'G',
    slug: 'pace-code-g',
    title: 'PACE Code G: Arrest',
    publicationUrl: `${GOV_UK_BASE}/government/publications/pace-code-g-2012`,
  },
  {
    code: 'H',
    slug: 'pace-code-h',
    title: 'PACE Code H: Detention, Treatment and Questioning of Persons under Section 41 of the Terrorism Act 2000',
    publicationUrl: `${GOV_UK_BASE}/government/publications/pace-code-h-2023`,
  },
  {
    code: 'I',
    slug: 'pace-code-i',
    title: 'PACE Code I: Video Identification Procedure',
    publicationUrl: `${GOV_UK_BASE}/government/publications/pace-code-i-2023`,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint
// ─────────────────────────────────────────────────────────────────────────────

interface CheckpointData { completedSlugs: string[] }

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'))
  return { completedSlugs: [] }
}
function saveCheckpoint(cp: CheckpointData): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2))
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────────────────────────────────────────

function initLog(): void {
  if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, 'timestamp,method,url,statusCode,durationMs,notes\n')
}
function logRequest(url: string, statusCode: number, durationMs: number, notes = ''): void {
  const ts = new Date().toISOString()
  fs.appendFileSync(LOG_FILE, `${ts},GET,${url},${statusCode},${durationMs},"${notes.replace(/"/g, "'")}"\n`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate-limiting + HTTP
// ─────────────────────────────────────────────────────────────────────────────

let lastRequestAt = 0
async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < MIN_DELAY_MS) await sleep(MIN_DELAY_MS - elapsed)
  lastRequestAt = Date.now()
}
function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }

function httpGetRaw(url: string): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const lib = parsed.protocol === 'https:' ? https : http
    const req = (lib as typeof https).get(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,*/*' },
      timeout: FETCH_TIMEOUT_MS,
    }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location
        res.destroy()
        return resolve(httpGetRaw(loc.startsWith('http') ? loc : `${parsed.protocol}//${parsed.host}${loc}`))
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
  })
}

async function fetchWithBackoff(url: string): Promise<{ body: Buffer; status: number }> {
  let backoff = BACKOFF_INITIAL_MS
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await throttle()
    const start = Date.now()
    try {
      const { status, body } = await httpGetRaw(url)
      logRequest(url, status, Date.now() - start)
      if (status === 200) return { body, status }
      if (status === 429 || status === 503) {
        const wait = Math.min(backoff, BACKOFF_MAX_MS)
        console.warn(`  ⚠ ${status} — backoff ${wait / 1000}s`)
        await sleep(wait); backoff = Math.min(backoff * 2, BACKOFF_MAX_MS); continue
      }
      return { body: Buffer.alloc(0), status }
    } catch (err: any) {
      logRequest(url, 0, Date.now() - start, String(err?.message))
      const wait = Math.min(backoff, BACKOFF_MAX_MS)
      await sleep(wait); backoff = Math.min(backoff * 2, BACKOFF_MAX_MS)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// robots.txt
// ─────────────────────────────────────────────────────────────────────────────

async function checkRobotsTxt(): Promise<void> {
  console.log('Checking robots.txt on gov.uk...')
  const { body, status } = await fetchWithBackoff(`${GOV_UK_BASE}/robots.txt`)
  if (status !== 200) { console.warn('  Cannot fetch — proceeding cautiously'); return }
  const lines = body.toString('utf-8').split('\n').map(l => l.trim().toLowerCase())
  let inBlock = false
  for (const line of lines) {
    if (line.startsWith('user-agent:')) {
      const a = line.replace('user-agent:', '').trim()
      inBlock = a === '*' || a.includes('scrutinise')
    }
    if (inBlock && line.startsWith('disallow:')) {
      const d = line.replace('disallow:', '').trim()
      if (d && '/government/publications/'.startsWith(d)) throw new Error(`robots.txt disallows ${d}`)
    }
  }
  console.log('  robots.txt OK')
}

// ─────────────────────────────────────────────────────────────────────────────
// Legislation corpus pre-check
// ─────────────────────────────────────────────────────────────────────────────

async function checkLegislationCorpus(): Promise<void> {
  console.log('\nChecking if PACE codes already exist in legislation corpus...')
  const client = await pool.connect()
  try {
    // PACE codes are not standard UKPGA/UKSI so unlikely to be in LegislationItem,
    // but we check just in case they were ingested via the legislation scraper
    const res = await client.query(`
      SELECT "legislationGovUkId", title
      FROM "LegislationItem"
      WHERE lower(title) LIKE '%police and criminal evidence%'
         OR lower(title) LIKE '%pace code%'
      LIMIT 10
    `)
    if (res.rows.length > 0) {
      console.log(`  Found ${res.rows.length} related legislation item(s):`)
      for (const row of res.rows) {
        console.log(`    ${row.legislationGovUkId}: ${row.title}`)
      }
      console.log('  NOTE: These are the parent Act / related SIs, not the PACE Codes themselves.')
      console.log('  PACE Codes are statutory codes under s.67 PACE 1984 — not statutes or SIs.')
      console.log('  Proceeding with gov.uk HTML scrape.')
    } else {
      console.log('  No PACE Code entries in legislation corpus — proceeding with scrape')
    }
  } finally {
    client.release()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML helpers
// ─────────────────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ').trim()
}

function extractTitle(html: string): string {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return stripHtml(h1?.[1] ?? title?.[1] ?? '').trim()
}

function extractMainContent(html: string): string {
  const gs = html.match(/<div[^>]+class="[^"]*govspeak[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|$)/i)
  if (gs) return gs[1]
  const art = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (art) return art[1]
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (main) return main[1]
  return html
}

/** Find the HTML accessible version URL from a PACE publication landing page */
function extractHtmlAccessibleUrl(html: string, publicationPath: string): string | null {
  // Gov.uk PACE pages link to accessible HTML version as sub-page of publication
  const escaped = publicationPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`href="(${escaped}/[^"#?]+)"`, 'gi')
  const matches: string[] = []
  let m: RegExpExecArray | null
  while ((m = pattern.exec(html)) !== null) {
    matches.push(`${GOV_UK_BASE}${m[1]}`)
  }
  // Prefer URL containing "accessible" or "html" in the slug
  const accessible = matches.find(u => u.includes('accessible') || u.includes('-html'))
  return accessible ?? matches[0] ?? null
}

function wordCount(text: string): number { return text.split(/\s+/).filter(Boolean).length }

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

async function upsertDocument(client: any, def: PaceCodeDef): Promise<string> {
  const r2Prefix = `operational/home-office/${def.slug}`
  const res = await client.query(`
    INSERT INTO "OperationalDocument"
      (id,"sourceType","sourceSlug","publisherName",title,description,
       "sourceUrl","r2Prefix",jurisdiction,"ingestStatus","pageCount","createdAt","updatedAt")
    VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,0,NOW(),NOW())
    ON CONFLICT ("sourceType","sourceSlug") DO UPDATE
      SET title=EXCLUDED.title,"ingestStatus"=$10,"updatedAt"=NOW()
    RETURNING id
  `, [
    DocumentSourceType.STATUTORY_GUIDANCE, def.slug, 'Home Office',
    def.title,
    `Statutory code of practice under the Police and Criminal Evidence Act 1984 (PACE Code ${def.code})`,
    def.publicationUrl, r2Prefix, 'UK',
    OperationalIngestStatus.IN_PROGRESS, OperationalIngestStatus.IN_PROGRESS,
  ])
  return res.rows[0].id
}

async function upsertSection(client: any, params: {
  documentId: string; pageSlug: string; pageTitle: string
  sourceUrl: string; htmlKey: string; textKey: string
  extractedText: string; wordCount: number
}): Promise<void> {
  await client.query(`
    INSERT INTO "OperationalSection"
      (id,"operationalDocumentId","sourceType","pageSlug","chapterSlug","pageTitle","sourceUrl",
       "htmlKey","textKey","extractedText","wordCount","extractedBy","orderIndex",
       "ingestStatus","fetchedAt","createdAt","updatedAt")
    VALUES (gen_random_uuid(),$1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,'html-direct',0,$10,NOW(),NOW(),NOW())
    ON CONFLICT ("operationalDocumentId","pageSlug") DO UPDATE
      SET "extractedText"=EXCLUDED."extractedText","wordCount"=EXCLUDED."wordCount",
          "textKey"=EXCLUDED."textKey","htmlKey"=EXCLUDED."htmlKey",
          "ingestStatus"=EXCLUDED."ingestStatus","fetchedAt"=NOW(),"updatedAt"=NOW()
  `, [
    params.documentId, DocumentSourceType.STATUTORY_GUIDANCE, params.pageSlug,
    params.pageTitle, params.sourceUrl, params.htmlKey, params.textKey,
    params.extractedText, params.wordCount, OperationalIngestStatus.COMPLETE,
  ])
}

async function markComplete(client: any, documentId: string): Promise<void> {
  await client.query(`
    UPDATE "OperationalDocument"
    SET "ingestStatus"=$1,"pageCount"=1,"lastFetchedAt"=NOW(),"updatedAt"=NOW() WHERE id=$2
  `, [OperationalIngestStatus.COMPLETE, documentId])
}

// ─────────────────────────────────────────────────────────────────────────────
// Ingest one PACE code
// ─────────────────────────────────────────────────────────────────────────────

async function ingestCode(def: PaceCodeDef, cp: CheckpointData): Promise<void> {
  if (cp.completedSlugs.includes(def.slug)) {
    console.log(`  [SKIP] ${def.slug}`)
    return
  }

  console.log(`\n── PACE Code ${def.code}: ${def.title}`)
  console.log(`  Publication: ${def.publicationUrl}`)

  const r2Prefix = `operational/home-office/${def.slug}`

  const dbClient = await pool.connect()
  let documentId: string
  try {
    documentId = await upsertDocument(dbClient, def)
    console.log(`  DB: ${documentId}`)
  } finally {
    dbClient.release()
  }

  // Fetch landing page to discover HTML accessible URL
  const { body: lb, status: ls } = await fetchWithBackoff(def.publicationUrl)
  if (ls !== 200) { console.error(`  ✗ Landing ${ls} — skip`); return }
  const landingHtml = lb.toString('utf-8')

  const pubPath = new URL(def.publicationUrl).pathname
  const htmlUrl = extractHtmlAccessibleUrl(landingHtml, pubPath)
  if (!htmlUrl) {
    console.error(`  ✗ No HTML accessible URL found on landing page — skip`)
    return
  }
  console.log(`  HTML: ${htmlUrl}`)

  const { body: hb, status: hs } = await fetchWithBackoff(htmlUrl)
  if (hs !== 200) { console.error(`  ✗ HTML fetch ${hs} — skip`); return }

  const html = hb.toString('utf-8')
  const mainContent = extractMainContent(html)
  const plainText = stripHtml(mainContent)
  const pageTitle = extractTitle(html) || def.title
  const wc = wordCount(plainText)

  const htmlKey = `${r2Prefix}/main.html`
  const textKey = `${r2Prefix}/main.text`
  await r2Put(htmlKey, html, 'text/html')
  await r2Put(textKey, plainText, 'text/plain')

  const sc = await pool.connect()
  try {
    await upsertSection(sc, {
      documentId, pageSlug: 'main', pageTitle, sourceUrl: htmlUrl,
      htmlKey, textKey, extractedText: plainText.slice(0, 1000), wordCount: wc,
    })
    await markComplete(sc, documentId)
  } finally {
    sc.release()
  }

  cp.completedSlugs.push(def.slug)
  saveCheckpoint(cp)
  console.log(`  ✓ ${wc} words`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== PACE Codes of Practice (A–I) — Operational Corpus Ingest ===')
  console.log('')

  initLog()
  await checkRobotsTxt()
  await checkLegislationCorpus()

  const cp = loadCheckpoint()
  console.log(`\nCheckpoint: ${cp.completedSlugs.length} codes complete`)

  const codeArg = process.argv.find(a => a.startsWith('--code='))
  const targetCode = codeArg ? codeArg.replace('--code=', '').toUpperCase() : null
  const toIngest = targetCode
    ? PACE_CODES.filter(c => c.code.toUpperCase() === targetCode)
    : PACE_CODES

  if (targetCode && toIngest.length === 0) {
    console.error(`No code "${targetCode}"`)
    process.exit(1)
  }

  console.log(`\nIngesting ${toIngest.length} code(s)...\n`)
  for (const def of toIngest) {
    await ingestCode(def, cp)
  }

  console.log('\n=== PACE Codes ingest complete ===')
  console.log(`Done: ${cp.completedSlugs.join(', ')}`)
  await pool.end()
}

main().catch(err => {
  console.error('\n✗ Fatal:', err.message ?? err)
  process.exit(1)
})
