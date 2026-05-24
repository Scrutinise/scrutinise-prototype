/**
 * HM Treasury Appraisal Guidance — Operational Corpus Ingest
 * Sprint V.3-C
 *
 * Sources (gov.uk — ADMINISTRATIVE_GUIDANCE):
 *   1. The Green Book (HTML if available, else PDF)
 *   2. The Magenta Book (HTML if available, else PDF)
 *   3. The Aqua Book (PDF)
 *   4. The Orange Book (PDF)
 *   5. Managing Public Money (PDF)
 *
 * Behaviour:
 *   - robots.txt checked at startup for gov.uk
 *   - Rate-limiting: 1 req / 2s, exponential backoff on 429 / 503
 *   - Checkpoint/resume: scripts/operational/treasury-checkpoint.json
 *   - Audit log: scripts/operational/treasury-log.csv
 *   - Each document → 1 OperationalDocument + 1 OperationalSection
 *   - R2 prefix: operational/hm-treasury/{slug}/
 *
 * Run:
 *   cd scrutinise-web && npx tsx ../scripts/operational/treasury-guidance-ingest.ts
 *   or: npx tsx ../scripts/operational/treasury-guidance-ingest.ts --doc=green-book
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

// pdf-parse v2 — CJS entry
const PDF_PARSE_CJS = path.join(__dirname, '../../scrutinise-web/node_modules/pdf-parse/dist/pdf-parse/cjs/index.cjs')

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const USER_AGENT = 'Scrutinise/1.0 (civic tech; +https://scrutinise.org/about)'
const MIN_DELAY_MS = 2000
const BACKOFF_INITIAL_MS = 30000
const BACKOFF_MAX_MS = 600000
const FETCH_TIMEOUT_MS = 30000
const GOV_UK_BASE = 'https://www.gov.uk'

const LOG_FILE = path.join(__dirname, 'treasury-log.csv')
const CHECKPOINT_FILE = path.join(__dirname, 'treasury-checkpoint.json')

// ─────────────────────────────────────────────────────────────────────────────
// Source definitions
// ─────────────────────────────────────────────────────────────────────────────

interface SourceDef {
  slug: string
  title: string
  description: string
  publicationUrl: string    // gov.uk publication landing page
  knownHtmlUrl?: string     // direct HTML content URL (discovered in advance where possible)
  knownPdfUrl?: string      // direct PDF URL
  preferHtml: boolean
  r2Prefix: string
}

const SOURCES: SourceDef[] = [
  {
    slug: 'green-book',
    title: 'The Green Book: appraisal and evaluation in central government',
    description: 'HM Treasury guidance on appraisal and evaluation of public spending proposals. Sets out the framework for assessing the case for policy interventions.',
    publicationUrl: `${GOV_UK_BASE}/government/publications/the-green-book-appraisal-and-evaluation-in-central-government`,
    preferHtml: true,   // HTML version exists (discovered via WebFetch); URL found dynamically
    r2Prefix: 'operational/hm-treasury/green-book',
  },
  {
    slug: 'magenta-book',
    title: 'The Magenta Book: Central Government guidance on evaluation',
    description: 'HM Treasury guidance on evaluation of public policies. Provides analytical methods and frameworks for assessing policy effectiveness.',
    publicationUrl: `${GOV_UK_BASE}/government/publications/the-magenta-book`,
    preferHtml: true,
    r2Prefix: 'operational/hm-treasury/magenta-book',
  },
  {
    slug: 'aqua-book',
    title: 'The Aqua Book: guidance on producing quality analysis for government',
    description: 'HM Treasury / Government Analysis Function guidance on quality assurance of analytical models used by government. 2025 edition.',
    // Note: the publication page was removed; the 2025 edition lives at /guidance/the-aqua-book
    publicationUrl: `${GOV_UK_BASE}/guidance/the-aqua-book`,
    knownHtmlUrl: `${GOV_UK_BASE}/guidance/the-aqua-book`,
    preferHtml: true,
    r2Prefix: 'operational/hm-treasury/aqua-book',
  },
  {
    slug: 'orange-book',
    title: 'The Orange Book: management of risk — principles and concepts',
    description: 'Cabinet Office / HM Treasury guidance on the management of risk in central government.',
    publicationUrl: `${GOV_UK_BASE}/government/publications/orange-book`,
    preferHtml: true,
    r2Prefix: 'operational/hm-treasury/orange-book',
  },
  {
    slug: 'managing-public-money',
    title: 'Managing Public Money',
    description: 'HM Treasury framework setting out the duties and responsibilities of public sector organisations in handling public funds.',
    publicationUrl: `${GOV_UK_BASE}/government/publications/managing-public-money`,
    preferHtml: false,   // PDF only
    r2Prefix: 'operational/hm-treasury/managing-public-money',
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
      headers: { 'User-Agent': USER_AGENT, 'Accept': '*/*' },
      timeout: FETCH_TIMEOUT_MS,
    }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location
        const redirect = loc.startsWith('http') ? loc : `${parsed.protocol}//${parsed.host}${loc}`
        res.destroy()
        return resolve(httpGetRaw(redirect))
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
      console.warn(`  ⚠ Error: ${err?.message} — backoff ${wait / 1000}s`)
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

function extractFirstHtmlContentUrl(html: string, publicationPath: string): string | null {
  const escaped = publicationPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = html.match(new RegExp(`href="(${escaped}/[^"#?]+)"`, 'i'))
  return m ? `${GOV_UK_BASE}${m[1]}` : null
}

function extractFirstPdfUrl(html: string): string | null {
  const m = html.match(/href="(https:\/\/assets\.publishing\.service\.gov\.uk\/[^"]+\.pdf)"/i)
  return m ? m[1] : null
}

function wordCount(text: string): number { return text.split(/\s+/).filter(Boolean).length }

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

async function upsertDocument(client: any, src: SourceDef): Promise<string> {
  const res = await client.query(`
    INSERT INTO "OperationalDocument"
      (id, "sourceType", "sourceSlug", "publisherName", title, description,
       "sourceUrl", "r2Prefix", jurisdiction, "ingestStatus", "pageCount", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,0,NOW(),NOW())
    ON CONFLICT ("sourceType","sourceSlug") DO UPDATE
      SET title=EXCLUDED.title,"ingestStatus"=$10,"updatedAt"=NOW()
    RETURNING id
  `, [
    DocumentSourceType.ADMINISTRATIVE_GUIDANCE, src.slug, 'HM Treasury',
    src.title, src.description, src.publicationUrl, src.r2Prefix, 'UK',
    OperationalIngestStatus.IN_PROGRESS, OperationalIngestStatus.IN_PROGRESS,
  ])
  return res.rows[0].id
}

async function upsertSection(client: any, params: {
  documentId: string; pageSlug: string; pageTitle: string
  sourceUrl: string; htmlKey: string | null; textKey: string
  extractedText: string; wordCount: number; extractedBy: string
}): Promise<void> {
  await client.query(`
    INSERT INTO "OperationalSection"
      (id,"operationalDocumentId","sourceType","pageSlug","chapterSlug","pageTitle","sourceUrl",
       "htmlKey","textKey","extractedText","wordCount","extractedBy","orderIndex",
       "ingestStatus","fetchedAt","createdAt","updatedAt")
    VALUES (gen_random_uuid(),$1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,0,$11,NOW(),NOW(),NOW())
    ON CONFLICT ("operationalDocumentId","pageSlug") DO UPDATE
      SET "extractedText"=EXCLUDED."extractedText","wordCount"=EXCLUDED."wordCount",
          "textKey"=EXCLUDED."textKey","htmlKey"=EXCLUDED."htmlKey",
          "ingestStatus"=EXCLUDED."ingestStatus","fetchedAt"=NOW(),"updatedAt"=NOW()
  `, [
    params.documentId, DocumentSourceType.ADMINISTRATIVE_GUIDANCE, params.pageSlug,
    params.pageTitle, params.sourceUrl, params.htmlKey, params.textKey,
    params.extractedText, params.wordCount, params.extractedBy, OperationalIngestStatus.COMPLETE,
  ])
}

async function markComplete(client: any, documentId: string): Promise<void> {
  await client.query(`
    UPDATE "OperationalDocument"
    SET "ingestStatus"=$1,"pageCount"=1,"lastFetchedAt"=NOW(),"updatedAt"=NOW()
    WHERE id=$2
  `, [OperationalIngestStatus.COMPLETE, documentId])
}

// ─────────────────────────────────────────────────────────────────────────────
// Ingest one source
// ─────────────────────────────────────────────────────────────────────────────

async function ingestSource(src: SourceDef, cp: CheckpointData): Promise<void> {
  if (cp.completedSlugs.includes(src.slug)) {
    console.log(`  [SKIP] ${src.slug} — already complete`)
    return
  }

  console.log(`\n── ${src.title} ──────────────────────────────────────`)
  console.log(`  URL: ${src.publicationUrl}`)

  const dbClient = await pool.connect()
  let documentId: string
  try {
    documentId = await upsertDocument(dbClient, src)
    console.log(`  DB: OperationalDocument ${documentId}`)
  } finally {
    dbClient.release()
  }

  // Determine content
  let contentUrl: string
  let isPdf: boolean
  let htmlKey: string | null = null

  if (src.knownHtmlUrl) {
    contentUrl = src.knownHtmlUrl; isPdf = false
  } else if (src.knownPdfUrl) {
    contentUrl = src.knownPdfUrl; isPdf = true
  } else {
    // Discover from landing page
    const { body: lb, status: ls } = await fetchWithBackoff(src.publicationUrl)
    if (ls !== 200) { console.error(`  ✗ Landing ${ls} — skip`); return }
    const lhtml = lb.toString('utf-8')
    const pubPath = new URL(src.publicationUrl).pathname
    const htmlUrl = extractFirstHtmlContentUrl(lhtml, pubPath)
    const pdfUrl = extractFirstPdfUrl(lhtml)
    console.log(`  Discovered: html=${htmlUrl ?? 'none'} pdf=${pdfUrl ?? 'none'}`)

    if (src.preferHtml && htmlUrl) {
      contentUrl = htmlUrl; isPdf = false
    } else if (pdfUrl) {
      contentUrl = pdfUrl; isPdf = true
    } else {
      console.error('  ✗ No content URL found — skip')
      return
    }
  }

  let plainText: string
  let pageTitle: string
  let extractedBy: string

  if (!isPdf) {
    console.log(`  Fetching HTML: ${contentUrl}`)
    const { body, status } = await fetchWithBackoff(contentUrl)
    if (status !== 200) { console.error(`  ✗ HTML ${status} — skip`); return }
    const html = body.toString('utf-8')
    htmlKey = `${src.r2Prefix}/main.html`
    await r2Put(htmlKey, html, 'text/html')
    plainText = stripHtml(extractMainContent(html))
    pageTitle = extractTitle(html) || src.title
    extractedBy = 'html-direct'
  } else {
    console.log(`  Downloading PDF: ${contentUrl}`)
    const { body, status } = await fetchWithBackoff(contentUrl)
    if (status !== 200 || body.length === 0) { console.error(`  ✗ PDF ${status} — skip`); return }
    console.log(`  PDF: ${(body.length / 1024).toFixed(0)} KB`)
    const pdfKey = `${src.r2Prefix}/main.pdf`
    await r2Put(pdfKey, body, 'application/pdf')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require(PDF_PARSE_CJS)
    const pdfParser = new PDFParse({ data: new Uint8Array(body) })
    const pdfResult = await pdfParser.getText({ pageJoiner: '\n\n' })
    plainText = (pdfResult.text ?? '').replace(/\s{3,}/g, '\n\n').trim()
    pageTitle = src.title
    extractedBy = 'pdf-text'
  }

  const wc = wordCount(plainText)
  const textKey = `${src.r2Prefix}/main.text`
  await r2Put(textKey, plainText, 'text/plain')
  console.log(`  Words: ${wc}, extractedBy: ${extractedBy}`)

  const sc = await pool.connect()
  try {
    await upsertSection(sc, {
      documentId, pageSlug: 'main', pageTitle, sourceUrl: contentUrl,
      htmlKey, textKey, extractedText: plainText.slice(0, 1000), wordCount: wc, extractedBy,
    })
    await markComplete(sc, documentId)
  } finally {
    sc.release()
  }

  cp.completedSlugs.push(src.slug)
  saveCheckpoint(cp)
  console.log(`  ✓ ${src.slug} complete`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== HM Treasury Appraisal Guidance — Operational Corpus Ingest ===')
  console.log(`Sources: ${SOURCES.map(s => s.slug).join(', ')}`)
  console.log('')

  initLog()
  await checkRobotsTxt()

  const cp = loadCheckpoint()
  console.log(`Checkpoint: ${cp.completedSlugs.length} docs complete`)

  const docArg = process.argv.find(a => a.startsWith('--doc='))
  const targetSlug = docArg ? docArg.replace('--doc=', '') : null
  const toIngest = targetSlug ? SOURCES.filter(s => s.slug === targetSlug) : SOURCES

  if (targetSlug && toIngest.length === 0) {
    console.error(`No source "${targetSlug}"`)
    process.exit(1)
  }

  for (const src of toIngest) {
    await ingestSource(src, cp)
  }

  console.log('\n=== Treasury guidance ingest complete ===')
  await pool.end()
}

main().catch(err => {
  console.error('\n✗ Fatal:', err.message ?? err)
  process.exit(1)
})
