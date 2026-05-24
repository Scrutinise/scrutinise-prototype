/**
 * Government Functional Standards (GovS 001–015) — Operational Corpus Ingest
 * Sprint V.3-C
 *
 * Sources: gov.uk/government/collections/functional-standards
 *   Fetches the collection page to discover all GovS publication pages,
 *   then downloads each standard's PDF and extracts text.
 *
 * Each GovS standard → 1 OperationalDocument + 1 OperationalSection
 * R2 prefix: operational/cabinet-office/govs-{NNN}/
 * sourceType: ADMINISTRATIVE_GUIDANCE
 *
 * Run:
 *   cd scrutinise-web && npx tsx ../scripts/operational/govs-ingest.ts
 *   or: npx tsx ../scripts/operational/govs-ingest.ts --govs=002
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

const LOG_FILE = path.join(__dirname, 'govs-log.csv')
const CHECKPOINT_FILE = path.join(__dirname, 'govs-checkpoint.json')

const COLLECTION_URL = `${GOV_UK_BASE}/government/collections/functional-standards`
const PUBLISHER = 'Cabinet Office'

// Known correct content URLs that override automatic discovery (publication landing page picks wrong link)
const HTML_OVERRIDES: Record<string, string> = {
  'govs-008': `${GOV_UK_BASE}/government/publications/commercial-operating-standards-for-government/government-functional-standard-govs-008-commercial-html`,
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint
// ─────────────────────────────────────────────────────────────────────────────

interface CheckpointData {
  completedSlugs: string[]
  discoveredStandards: Array<{ slug: string; title: string; publicationUrl: string }>
}

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'))
  }
  return { completedSlugs: [], discoveredStandards: [] }
}

function saveCheckpoint(cp: CheckpointData): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2))
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────────────────────────────────────────

function initLog(): void {
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, 'timestamp,method,url,statusCode,durationMs,notes\n')
  }
}

function logRequest(url: string, statusCode: number, durationMs: number, notes = ''): void {
  const ts = new Date().toISOString()
  fs.appendFileSync(LOG_FILE, `${ts},GET,${url},${statusCode},${durationMs},"${notes.replace(/"/g, "'")}"\n`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate-limiting
// ─────────────────────────────────────────────────────────────────────────────

let lastRequestAt = 0

async function throttle(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestAt
  if (elapsed < MIN_DELAY_MS) await sleep(MIN_DELAY_MS - elapsed)
  lastRequestAt = Date.now()
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────────────────────

function httpGetRaw(url: string): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const lib = parsedUrl.protocol === 'https:' ? https : http
    const options = {
      headers: { 'User-Agent': USER_AGENT, 'Accept': '*/*' },
      timeout: FETCH_TIMEOUT_MS,
    }
    const req = (lib as typeof https).get(url, options, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location
        const redirect = loc.startsWith('http') ? loc : `${parsedUrl.protocol}//${parsedUrl.host}${loc}`
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
        await sleep(wait)
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS)
        continue
      }
      return { body: Buffer.alloc(0), status }
    } catch (err: any) {
      logRequest(url, 0, Date.now() - start, String(err?.message ?? err))
      const wait = Math.min(backoff, BACKOFF_MAX_MS)
      console.warn(`  ⚠ Error: ${err?.message} — backoff ${wait / 1000}s`)
      await sleep(wait)
      backoff = Math.min(backoff * 2, BACKOFF_MAX_MS)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// robots.txt
// ─────────────────────────────────────────────────────────────────────────────

async function checkRobotsTxt(): Promise<void> {
  console.log('Checking robots.txt on gov.uk...')
  const { body, status } = await fetchWithBackoff(`${GOV_UK_BASE}/robots.txt`)
  if (status !== 200) { console.warn('  Cannot fetch robots.txt — proceeding cautiously'); return }
  const lines = body.toString('utf-8').split('\n').map(l => l.trim().toLowerCase())
  let inBlock = false
  for (const line of lines) {
    if (line.startsWith('user-agent:')) {
      const agent = line.replace('user-agent:', '').trim()
      inBlock = agent === '*' || agent.includes('scrutinise')
    }
    if (inBlock && line.startsWith('disallow:')) {
      const d = line.replace('disallow:', '').trim()
      if (d && '/government/collections/functional-standards'.startsWith(d)) {
        throw new Error(`robots.txt disallows ${d}`)
      }
    }
  }
  console.log('  robots.txt OK')
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML helpers
// ─────────────────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
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

/**
 * Extract GovS publication page links from the collection page.
 * Returns an array of { title, publicationUrl } objects.
 */
function extractCollectionLinks(html: string): Array<{ title: string; publicationUrl: string }> {
  const results: Array<{ title: string; publicationUrl: string }> = []
  const seen = new Set<string>()

  // Gov.uk collection pages list publications as linked list items
  // Pattern: href="/government/publications/..." with surrounding text
  const linkPattern = /href="(\/government\/publications\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1]
    const rawTitle = stripHtml(m[2]).trim()
    const fullUrl = `${GOV_UK_BASE}${href}`
    // Filter to GovS-related publications (title contains GovS or Government Functional Standard)
    const lc = rawTitle.toLowerCase()
    if (
      !seen.has(href) &&
      (lc.includes('govs') || lc.includes('government functional standard') || lc.includes('functional standard')) &&
      rawTitle.length > 5
    ) {
      seen.add(href)
      results.push({ title: rawTitle, publicationUrl: fullUrl })
    }
  }
  return results
}

/**
 * Extract the first PDF URL from a publication landing page.
 */
function extractFirstPdfUrl(html: string): string | null {
  const m = html.match(/href="(https:\/\/assets\.publishing\.service\.gov\.uk\/[^"]+\.pdf)"/i)
  return m ? m[1] : null
}

/**
 * Extract the first HTML content sub-page URL from a publication landing page.
 * E.g., /government/publications/{slug}/{content-slug}
 */
function extractFirstHtmlContentUrl(html: string, publicationPath: string): string | null {
  const escaped = publicationPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = html.match(new RegExp(`href="(${escaped}/[^"#?]+)"`, 'i'))
  return m ? `${GOV_UK_BASE}${m[1]}` : null
}

/**
 * Derive a GovS slug from the title.
 * E.g., "GovS 002: Project Delivery" → "govs-002"
 * Falls back to slugifying the publication URL path.
 */
function deriveGovsSlug(title: string, publicationUrl: string): string {
  const govsMatch = title.match(/govs[\s-]*(\d{3})/i)
  if (govsMatch) return `govs-${govsMatch[1]}`
  // Fallback: last segment of publication URL
  const parts = new URL(publicationUrl).pathname.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? 'govs-unknown'
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

async function upsertDocument(client: any, slug: string, title: string, publicationUrl: string, r2Prefix: string): Promise<string> {
  const res = await client.query(`
    INSERT INTO "OperationalDocument"
      (id, "sourceType", "sourceSlug", "publisherName", title, description,
       "sourceUrl", "r2Prefix", jurisdiction, "ingestStatus", "pageCount", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 0, NOW(), NOW())
    ON CONFLICT ("sourceType", "sourceSlug") DO UPDATE
      SET title = EXCLUDED.title, "ingestStatus" = $10, "updatedAt" = NOW()
    RETURNING id
  `, [
    DocumentSourceType.ADMINISTRATIVE_GUIDANCE,
    slug, PUBLISHER, title,
    `UK Government Functional Standard: ${title}`,
    publicationUrl, r2Prefix, 'UK',
    OperationalIngestStatus.IN_PROGRESS,
    OperationalIngestStatus.IN_PROGRESS,
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
      (id, "operationalDocumentId", "sourceType", "pageSlug", "chapterSlug", "pageTitle", "sourceUrl",
       "htmlKey", "textKey", "extractedText", "wordCount", "extractedBy", "orderIndex",
       "ingestStatus", "fetchedAt", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), $1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, 0,
       $11, NOW(), NOW(), NOW())
    ON CONFLICT ("operationalDocumentId", "pageSlug") DO UPDATE
      SET "extractedText" = EXCLUDED."extractedText", "wordCount" = EXCLUDED."wordCount",
          "textKey" = EXCLUDED."textKey", "htmlKey" = EXCLUDED."htmlKey",
          "ingestStatus" = EXCLUDED."ingestStatus", "fetchedAt" = NOW(), "updatedAt" = NOW()
  `, [
    params.documentId, DocumentSourceType.ADMINISTRATIVE_GUIDANCE,
    params.pageSlug, params.pageTitle, params.sourceUrl,
    params.htmlKey, params.textKey, params.extractedText,
    params.wordCount, params.extractedBy, OperationalIngestStatus.COMPLETE,
  ])
}

async function markComplete(client: any, documentId: string): Promise<void> {
  await client.query(`
    UPDATE "OperationalDocument"
    SET "ingestStatus" = $1, "pageCount" = 1, "lastFetchedAt" = NOW(), "updatedAt" = NOW()
    WHERE id = $2
  `, [OperationalIngestStatus.COMPLETE, documentId])
}

// ─────────────────────────────────────────────────────────────────────────────
// GovS 002 — external site (projectdelivery.gov.uk)
// ─────────────────────────────────────────────────────────────────────────────

const GOVS_002_PAGE = 'https://projectdelivery.gov.uk/library-product/government-functional-standard-govs-002-project-delivery/'
const GOVS_002_ROBOTS = 'https://projectdelivery.gov.uk/robots.txt'

async function ingestGovs002External(slug: string, title: string, cp: CheckpointData): Promise<void> {
  console.log(`  Checking robots.txt on projectdelivery.gov.uk...`)
  const { body: rbBody, status: rbStatus } = await fetchWithBackoff(GOVS_002_ROBOTS)
  if (rbStatus !== 200) {
    console.warn(`  ⚠ robots.txt fetch failed (${rbStatus}) — aborting govs-002`)
    return
  }
  const rbText = rbBody.toString('utf-8')
  // Confirm no disallow for /library-product/ or /download/
  const disallowLines = rbText.split('\n').filter(l => l.trim().toLowerCase().startsWith('disallow:'))
  for (const line of disallowLines) {
    const d = line.replace(/disallow:/i, '').trim()
    if (d && ('/library-product/'.startsWith(d) || '/download/'.startsWith(d))) {
      console.error(`  ✗ robots.txt disallows ${d} — aborting govs-002`)
      return
    }
  }
  console.log(`  robots.txt OK (projectdelivery.gov.uk)`)

  const r2Prefix = `operational/cabinet-office/${slug}`

  // Upsert document
  const dbClient = await pool.connect()
  let documentId: string
  try {
    documentId = await upsertDocument(dbClient, slug, title, GOVS_002_PAGE, r2Prefix)
  } finally {
    dbClient.release()
  }

  // Fetch product page to discover download link
  console.log(`  Fetching product page: ${GOVS_002_PAGE}`)
  const { body: pageBody, status: pageStatus } = await fetchWithBackoff(GOVS_002_PAGE)
  if (pageStatus !== 200) {
    console.log(`  ✗ Product page returned ${pageStatus} — skipping`)
    return
  }
  const pageHtml = pageBody.toString('utf-8')

  // Find WordPress download link: /download/{ID}/
  const dlMatch = pageHtml.match(/href="(https:\/\/projectdelivery\.gov\.uk\/download\/\d+\/[^"]*)"/i)
  if (!dlMatch) {
    console.log(`  ✗ No download link found on product page — skipping`)
    return
  }
  // Use the URL without the tmstv timestamp parameter to keep it stable
  const rawDownloadUrl = dlMatch[1]
  const dlUrl = rawDownloadUrl.replace(/[?&]tmstv=[^&"]*/, '')
  console.log(`  PDF download: ${dlUrl}`)

  const { body: pdfBody, status: pdfStatus } = await fetchWithBackoff(dlUrl)
  if (pdfStatus !== 200 || pdfBody.length < 1000) {
    console.log(`  ✗ PDF download failed (${pdfStatus}, ${pdfBody.length} bytes)`)
    return
  }

  const pdfKey = `${r2Prefix}/main.pdf`
  await r2Put(pdfKey, pdfBody, 'application/pdf')
  console.log(`  Uploaded PDF to R2: ${pdfKey} (${pdfBody.length} bytes)`)

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require(PDF_PARSE_CJS)
  const pdfParser = new PDFParse({ data: new Uint8Array(pdfBody) })
  const pdfResult = await pdfParser.getText({ pageJoiner: '\n\n' })
  const plainText = (pdfResult.text ?? '').replace(/\s{3,}/g, '\n\n').trim()

  const wc = wordCount(plainText)
  const textKey = `${r2Prefix}/main.text`
  await r2Put(textKey, plainText, 'text/plain')

  const sectionClient = await pool.connect()
  try {
    await upsertSection(sectionClient, {
      documentId, pageSlug: 'main', pageTitle: title, sourceUrl: dlUrl,
      htmlKey: null, textKey, extractedText: plainText.slice(0, 1000), wordCount: wc, extractedBy: 'pdf-text',
    })
    await markComplete(sectionClient, documentId)
  } finally {
    sectionClient.release()
  }

  cp.completedSlugs.push(slug)
  saveCheckpoint(cp)
  console.log(`  ✓ govs-002: ${wc} words (pdf-text, projectdelivery.gov.uk)`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Ingest one GovS standard
// ─────────────────────────────────────────────────────────────────────────────

async function ingestStandard(
  slug: string,
  title: string,
  publicationUrl: string,
  cp: CheckpointData,
): Promise<void> {
  if (cp.completedSlugs.includes(slug)) {
    console.log(`  [SKIP] ${slug} — already complete`)
    return
  }

  // Special case: GovS 002 is hosted on an external site
  if (slug === 'govs-002') {
    return ingestGovs002External(slug, title, cp)
  }

  const r2Prefix = `operational/cabinet-office/${slug}`
  console.log(`\n  ── ${title}`)
  console.log(`     Publication: ${publicationUrl}`)

  // Upsert document
  const dbClient = await pool.connect()
  let documentId: string
  try {
    documentId = await upsertDocument(dbClient, slug, title, publicationUrl, r2Prefix)
  } finally {
    dbClient.release()
  }

  // Fetch publication landing page to discover content URL
  const { body: landingBody, status: landingStatus } = await fetchWithBackoff(publicationUrl)
  if (landingStatus !== 200) {
    console.log(`     ✗ Landing page ${landingStatus} — skipping`)
    return
  }
  const landingHtml = landingBody.toString('utf-8')
  const pubPath = new URL(publicationUrl).pathname

  // Check override table first; then auto-discover
  const overrideHtmlUrl = HTML_OVERRIDES[slug] ?? null
  const htmlUrl = overrideHtmlUrl ?? extractFirstHtmlContentUrl(landingHtml, pubPath)
  if (overrideHtmlUrl) console.log(`     [override] Using known HTML URL for ${slug}`)
  const pdfUrl = extractFirstPdfUrl(landingHtml)

  let plainText: string
  let pageTitle: string
  let htmlKey: string | null = null
  let extractedBy: string
  let contentUrl: string

  if (htmlUrl) {
    console.log(`     HTML: ${htmlUrl}`)
    const { body: htmlBody, status: htmlStatus } = await fetchWithBackoff(htmlUrl)
    if (htmlStatus !== 200) {
      console.log(`     ✗ HTML fetch ${htmlStatus}`)
      return
    }
    const htmlContent = htmlBody.toString('utf-8')
    htmlKey = `${r2Prefix}/main.html`
    await r2Put(htmlKey, htmlContent, 'text/html')

    // Extract text from main content area
    const mainContent = extractMainContent(htmlContent)
    plainText = stripHtml(mainContent)
    pageTitle = extractTitle(htmlContent) || title
    extractedBy = 'html-direct'
    contentUrl = htmlUrl
  } else if (pdfUrl) {
    console.log(`     PDF: ${pdfUrl}`)
    const { body: pdfBody, status: pdfStatus } = await fetchWithBackoff(pdfUrl)
    if (pdfStatus !== 200 || pdfBody.length === 0) {
      console.log(`     ✗ PDF fetch ${pdfStatus}`)
      return
    }
    const pdfKey = `${r2Prefix}/main.pdf`
    await r2Put(pdfKey, pdfBody, 'application/pdf')

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require(PDF_PARSE_CJS)
    const pdfParser = new PDFParse({ data: new Uint8Array(pdfBody) })
    const pdfResult = await pdfParser.getText({ pageJoiner: '\n\n' })
    plainText = (pdfResult.text ?? '').replace(/\s{3,}/g, '\n\n').trim()
    pageTitle = title
    extractedBy = 'pdf-text'
    contentUrl = pdfUrl
  } else {
    console.log(`     ✗ No content URL found on landing page`)
    return
  }

  const wc = wordCount(plainText)
  const textKey = `${r2Prefix}/main.text`
  await r2Put(textKey, plainText, 'text/plain')

  const sectionClient = await pool.connect()
  try {
    await upsertSection(sectionClient, {
      documentId, pageSlug: 'main', pageTitle, sourceUrl: contentUrl,
      htmlKey, textKey, extractedText: plainText.slice(0, 1000), wordCount: wc, extractedBy,
    })
    await markComplete(sectionClient, documentId)
  } finally {
    sectionClient.release()
  }

  cp.completedSlugs.push(slug)
  saveCheckpoint(cp)
  console.log(`     ✓ ${wc} words (${extractedBy})`)
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

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== Government Functional Standards — Ingest ===')
  console.log(`Collection: ${COLLECTION_URL}`)
  console.log('')

  initLog()
  await checkRobotsTxt()

  const cp = loadCheckpoint()
  console.log(`Checkpoint: ${cp.completedSlugs.length} standards complete`)

  // Optional: filter to a specific GovS number, e.g. --govs=002
  const govsArg = process.argv.find(a => a.startsWith('--govs='))
  const targetGovs = govsArg ? govsArg.replace('--govs=', '').padStart(3, '0') : null

  let standards = cp.discoveredStandards

  if (standards.length === 0) {
    console.log('\nFetching collection page to discover standards...')
    const { body, status } = await fetchWithBackoff(COLLECTION_URL)
    if (status !== 200) {
      console.error(`✗ Collection page returned ${status}`)
      process.exit(1)
    }
    const collectionHtml = body.toString('utf-8')
    standards = extractCollectionLinks(collectionHtml).map(({ title, publicationUrl }) => ({
      slug: deriveGovsSlug(title, publicationUrl),
      title,
      publicationUrl,
    }))
    console.log(`Discovered ${standards.length} standards from collection page:`)
    for (const s of standards) {
      console.log(`  ${s.slug}: ${s.title}`)
    }
    cp.discoveredStandards = standards
    saveCheckpoint(cp)
  } else {
    console.log(`Using ${standards.length} standards from checkpoint`)
  }

  const toIngest = targetGovs
    ? standards.filter(s => s.slug.includes(targetGovs))
    : standards

  console.log(`\nIngesting ${toIngest.length} standard(s)...\n`)

  for (const s of toIngest) {
    await ingestStandard(s.slug, s.title, s.publicationUrl, cp)
  }

  console.log('\n=== GovS ingest complete ===')
  console.log(`Completed: ${cp.completedSlugs.join(', ')}`)
  await pool.end()
}

main().catch(err => {
  console.error('\n✗ Fatal:', err.message ?? err)
  process.exit(1)
})
