/**
 * Civil Service Core Documents — Operational Corpus Ingest
 * Sprint V.3-C
 *
 * Sources (gov.uk — ADMINISTRATIVE_GUIDANCE):
 *   1. Civil Service Code (HTML)
 *   2. Civil Service Management Code (PDF — URL discovered from publication page)
 *   3. Ministerial Code (HTML)
 *   4. Cabinet Manual (PDF)
 *
 * Behaviour:
 *   - robots.txt checked at startup for gov.uk
 *   - Rate-limiting: 1 req / 2s, exponential backoff on 429 / 503
 *   - Checkpoint/resume: scripts/operational/civil-service-checkpoint.json
 *   - Audit log: scripts/operational/civil-service-log.csv
 *   - Each document → 1 OperationalDocument + 1 OperationalSection
 *   - R2 prefix: operational/cabinet-office/{slug}/
 *
 * Run:
 *   cd scrutinise-web && npx tsx ../scripts/operational/civil-service-ingest.ts
 *   or: npx tsx ../scripts/operational/civil-service-ingest.ts --doc=civil-service-code
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { DocumentSourceType, OperationalIngestStatus } from '@prisma/client'
import { r2Put } from '../legislation/r2-client'

// ─────────────────────────────────────────────────────────────────────────────
// pg pool (same pattern as hmrc-ingest.ts)
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require(path.join(__dirname, '../../scrutinise-web/node_modules/pg'))
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
})

// pdf-parse v2 — CJS entry (class-based API, not the old function API)
const PDF_PARSE_CJS = path.join(__dirname, '../../scrutinise-web/node_modules/pdf-parse/dist/pdf-parse/cjs/index.cjs')

// mammoth — docx → plain text (handles .docx / OOXML only, not .doc OLE)
const MAMMOTH_PATH = path.join(__dirname, '../../scrutinise-web/node_modules/mammoth')

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const USER_AGENT = 'Scrutinise/1.0 (civic tech; +https://scrutinise.org/about)'
const MIN_DELAY_MS = 2000
const BACKOFF_INITIAL_MS = 30000
const BACKOFF_MAX_MS = 600000
const FETCH_TIMEOUT_MS = 30000
const GOV_UK_BASE = 'https://www.gov.uk'
const ASSETS_BASE = 'https://assets.publishing.service.gov.uk'

const LOG_FILE = path.join(__dirname, 'civil-service-log.csv')
const CHECKPOINT_FILE = path.join(__dirname, 'civil-service-checkpoint.json')

// ─────────────────────────────────────────────────────────────────────────────
// Source definitions
// ─────────────────────────────────────────────────────────────────────────────

interface SourceDef {
  slug: string
  title: string
  description: string
  publisherName: string
  publicationUrl: string           // gov.uk landing page
  knownHtmlUrl?: string            // direct HTML content URL (if known)
  knownPdfUrl?: string             // direct PDF URL (if known)
  knownDocxUrl?: string            // direct .docx URL (used when no PDF/HTML available)
  preferHtml: boolean              // prefer HTML over PDF when both found
  r2Prefix: string
}

const SOURCES: SourceDef[] = [
  {
    slug: 'civil-service-code',
    title: 'The Civil Service Code',
    description: 'Core values and standards of behaviour expected of all civil servants: integrity, honesty, objectivity, and impartiality.',
    publisherName: 'Civil Service / Cabinet Office',
    publicationUrl: `${GOV_UK_BASE}/government/publications/civil-service-code`,
    knownHtmlUrl: `${GOV_UK_BASE}/government/publications/civil-service-code/the-civil-service-code`,
    preferHtml: true,
    r2Prefix: 'operational/cabinet-office/civil-service-code',
  },
  {
    slug: 'civil-service-management-code',
    title: 'Civil Service Management Code',
    description: "Statutory rules and regulations governing civil servants' rights and responsibilities, terms and conditions of employment.",
    publisherName: 'Cabinet Office',
    publicationUrl: `${GOV_UK_BASE}/government/publications/civil-servants-terms-and-conditions`,
    // Only available as .docx — no PDF or HTML content page exists on gov.uk
    // .doc (Statement of Changes) skipped: OLE format not supported by mammoth
    knownDocxUrl: 'https://assets.publishing.service.gov.uk/media/5a75a37ee5274a545822d0ee/CSMC_November_2016.docx',
    preferHtml: false,
    r2Prefix: 'operational/civil-service/csmc',
  },
  {
    slug: 'ministerial-code',
    title: 'Ministerial Code',
    description: 'Standards of conduct expected of ministers and how they discharge their duties, including collective Cabinet responsibility.',
    publisherName: 'Cabinet Office',
    publicationUrl: `${GOV_UK_BASE}/government/publications/ministerial-code`,
    knownHtmlUrl: `${GOV_UK_BASE}/government/publications/ministerial-code/ministerial-code`,
    preferHtml: true,
    r2Prefix: 'operational/cabinet-office/ministerial-code',
  },
  {
    slug: 'cabinet-manual',
    title: 'The Cabinet Manual',
    description: 'Description of the laws, conventions and rules that affect the operation and procedures of government, including formation of government.',
    publisherName: 'Cabinet Office',
    publicationUrl: `${GOV_UK_BASE}/government/publications/cabinet-manual`,
    preferHtml: false,  // PDF only — discover PDF URL from landing page
    r2Prefix: 'operational/cabinet-office/cabinet-manual',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint
// ─────────────────────────────────────────────────────────────────────────────

interface CheckpointData {
  completedSlugs: string[]
}

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'))
  }
  return { completedSlugs: [] }
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
  const line = `${ts},GET,${url},${statusCode},${durationMs},"${notes.replace(/"/g, "'")}"\n`
  fs.appendFileSync(LOG_FILE, line)
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

function httpGetRaw(url: string): Promise<{ status: number; body: Buffer; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const lib = parsedUrl.protocol === 'https:' ? https : http
    const options = {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml,application/pdf' },
      timeout: FETCH_TIMEOUT_MS,
    }
    const req = (lib as typeof https).get(url, options, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const location = res.headers.location
        const redirect = location.startsWith('http') ? location : `${parsedUrl.protocol}//${parsedUrl.host}${location}`
        res.destroy()
        return resolve(httpGetRaw(redirect))
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        body: Buffer.concat(chunks),
        headers: res.headers as Record<string, string | string[] | undefined>,
      }))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')) })
  })
}

async function fetchText(url: string): Promise<{ html: string; status: number }> {
  let backoff = BACKOFF_INITIAL_MS
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await throttle()
    const start = Date.now()
    try {
      const { status, body } = await httpGetRaw(url)
      const duration = Date.now() - start
      logRequest(url, status, duration)

      if (status === 200) return { html: body.toString('utf-8'), status }
      if (status === 429 || status === 503) {
        const wait = Math.min(backoff, BACKOFF_MAX_MS)
        console.warn(`  ⚠ ${status} — backing off ${wait / 1000}s`)
        logRequest(url, status, duration, `backoff ${wait}ms`)
        await sleep(wait)
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS)
        continue
      }
      logRequest(url, status, duration, `non-200 status`)
      return { html: '', status }
    } catch (err: any) {
      const duration = Date.now() - start
      const msg = String(err?.message ?? err)
      logRequest(url, 0, duration, `error: ${msg}`)
      const wait = Math.min(backoff, BACKOFF_MAX_MS)
      console.warn(`  ⚠ Fetch error: ${msg} — backing off ${wait / 1000}s`)
      await sleep(wait)
      backoff = Math.min(backoff * 2, BACKOFF_MAX_MS)
    }
  }
}

async function fetchBinary(url: string): Promise<{ buffer: Buffer; status: number }> {
  let backoff = BACKOFF_INITIAL_MS
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await throttle()
    const start = Date.now()
    try {
      const { status, body } = await httpGetRaw(url)
      const duration = Date.now() - start
      logRequest(url, status, duration)
      if (status === 200) return { buffer: body, status }
      if (status === 429 || status === 503) {
        const wait = Math.min(backoff, BACKOFF_MAX_MS)
        console.warn(`  ⚠ ${status} — backing off ${wait / 1000}s`)
        await sleep(wait)
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS)
        continue
      }
      return { buffer: Buffer.alloc(0), status }
    } catch (err: any) {
      const duration = Date.now() - start
      const msg = String(err?.message ?? err)
      logRequest(url, 0, duration, `error: ${msg}`)
      const wait = Math.min(backoff, BACKOFF_MAX_MS)
      console.warn(`  ⚠ Fetch error: ${msg} — backing off ${wait / 1000}s`)
      await sleep(wait)
      backoff = Math.min(backoff * 2, BACKOFF_MAX_MS)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// robots.txt check
// ─────────────────────────────────────────────────────────────────────────────

async function checkRobotsTxt(domain: string, paths: string[]): Promise<void> {
  console.log(`Checking robots.txt on ${domain}...`)
  const { html, status } = await fetchText(`${domain}/robots.txt`)
  if (status !== 200) {
    console.warn('  Could not fetch robots.txt — proceeding cautiously')
    return
  }
  const lines = html.split('\n').map(l => l.trim().toLowerCase())
  let inRelevantBlock = false
  for (const line of lines) {
    if (line.startsWith('user-agent:')) {
      const agent = line.replace('user-agent:', '').trim()
      inRelevantBlock = agent === '*' || agent.includes('scrutinise')
    }
    if (inRelevantBlock && line.startsWith('disallow:')) {
      const disallowed = line.replace('disallow:', '').trim()
      for (const p of paths) {
        if (disallowed && p.startsWith(disallowed)) {
          throw new Error(`robots.txt disallows ${disallowed} — cannot proceed`)
        }
      }
    }
  }
  console.log(`  robots.txt OK — /government/publications/ not disallowed`)
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractTitle(html: string): string {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const raw = h1Match?.[1] ?? titleMatch?.[1] ?? ''
  return stripHtml(raw).trim()
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Extract main body content from a gov.uk publication HTML page.
 * Gov.uk uses .govuk-govspeak or .gem-c-govspeak for main document body.
 */
function extractMainContent(html: string): string {
  // Try govspeak content div (main body of gov.uk guidance pages)
  const govspeakMatch = html.match(/<div[^>]+class="[^"]*govspeak[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|$)/i)
  if (govspeakMatch) return govspeakMatch[1]
  // Try article or main
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (articleMatch) return articleMatch[1]
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (mainMatch) return mainMatch[1]
  return html
}

/**
 * Discover content URLs from a gov.uk publication landing page.
 * Returns HTML sub-page URLs and PDF asset URLs found on the page.
 */
function discoverContentUrls(html: string, publicationPath: string): { htmlUrls: string[]; pdfUrls: string[] } {
  const htmlUrls: string[] = []
  const pdfUrls: string[] = []
  const seen = new Set<string>()

  // HTML sub-pages: /government/publications/{slug}/{content-slug}
  // Match links that are sub-paths of the publication (not the same as the landing page)
  const pubPathEscaped = publicationPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const htmlPattern = new RegExp(`href="(${pubPathEscaped}/[^"#?]+)"`, 'gi')
  let m: RegExpExecArray | null
  while ((m = htmlPattern.exec(html)) !== null) {
    const fullUrl = `${GOV_UK_BASE}${m[1]}`
    if (!seen.has(fullUrl)) {
      seen.add(fullUrl)
      htmlUrls.push(fullUrl)
    }
  }

  // PDF assets on assets.publishing.service.gov.uk
  const pdfPattern = /href="(https:\/\/assets\.publishing\.service\.gov\.uk\/[^"]+\.pdf)"/gi
  while ((m = pdfPattern.exec(html)) !== null) {
    const url = m[1]
    if (!seen.has(url)) {
      seen.add(url)
      pdfUrls.push(url)
    }
  }

  return { htmlUrls, pdfUrls }
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF extraction
// ─────────────────────────────────────────────────────────────────────────────

async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require(PDF_PARSE_CJS)
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  const result = await parser.getText({ pageJoiner: '\n\n' })
  return (result.text ?? '').replace(/\s{3,}/g, '\n\n').trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCX extraction (mammoth — OOXML only; not .doc OLE format)
// ─────────────────────────────────────────────────────────────────────────────

async function extractDocxText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require(MAMMOTH_PATH)
  const result = await mammoth.extractRawText({ buffer })
  if (result.messages && result.messages.length > 0) {
    const warnings = result.messages.filter((m: any) => m.type === 'warning')
    if (warnings.length > 0) {
      console.warn(`  mammoth warnings: ${warnings.length} (first: ${warnings[0].message})`)
    }
  }
  return (result.value ?? '').replace(/\s{3,}/g, '\n\n').trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

async function upsertDocument(client: any, src: SourceDef): Promise<string> {
  const res = await client.query(`
    INSERT INTO "OperationalDocument"
      (id, "sourceType", "sourceSlug", "publisherName", title, description,
       "sourceUrl", "r2Prefix", jurisdiction, "ingestStatus", "pageCount", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 0, NOW(), NOW())
    ON CONFLICT ("sourceType", "sourceSlug") DO UPDATE
      SET title = EXCLUDED.title,
          description = EXCLUDED.description,
          "r2Prefix" = EXCLUDED."r2Prefix",
          "ingestStatus" = $10,
          "updatedAt" = NOW()
    RETURNING id
  `, [
    DocumentSourceType.ADMINISTRATIVE_GUIDANCE,
    src.slug,
    src.publisherName,
    src.title,
    src.description,
    src.publicationUrl,
    src.r2Prefix,
    'UK',
    OperationalIngestStatus.IN_PROGRESS,
    OperationalIngestStatus.IN_PROGRESS,
  ])
  return res.rows[0].id
}

async function upsertSection(client: any, params: {
  documentId: string
  pageSlug: string
  pageTitle: string
  sourceUrl: string
  htmlKey: string | null
  textKey: string
  extractedText: string
  wordCount: number
  extractedBy: string
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
      SET "pageTitle" = EXCLUDED."pageTitle",
          "htmlKey" = EXCLUDED."htmlKey",
          "textKey" = EXCLUDED."textKey",
          "extractedText" = EXCLUDED."extractedText",
          "wordCount" = EXCLUDED."wordCount",
          "ingestStatus" = EXCLUDED."ingestStatus",
          "fetchedAt" = NOW(),
          "updatedAt" = NOW()
  `, [
    params.documentId,
    DocumentSourceType.ADMINISTRATIVE_GUIDANCE,
    params.pageSlug,
    params.pageTitle,
    params.sourceUrl,
    params.htmlKey,
    params.textKey,
    params.extractedText,
    params.wordCount,
    params.extractedBy,
    OperationalIngestStatus.COMPLETE,
  ])
}

async function markComplete(client: any, documentId: string, pageCount: number): Promise<void> {
  await client.query(`
    UPDATE "OperationalDocument"
    SET "ingestStatus" = $1, "pageCount" = $2, "lastFetchedAt" = NOW(), "updatedAt" = NOW()
    WHERE id = $3
  `, [OperationalIngestStatus.COMPLETE, pageCount, documentId])
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
  console.log(`  Publication URL: ${src.publicationUrl}`)

  // Upsert document record
  const dbClient = await pool.connect()
  let documentId: string
  try {
    documentId = await upsertDocument(dbClient, src)
    console.log(`  DB row: OperationalDocument ${documentId}`)
  } finally {
    dbClient.release()
  }

  // Determine content URL and type
  // knownDocxUrl bypasses all URL discovery — use it directly as the source URL
  let contentUrl: string
  let isPdf: boolean

  if (src.knownDocxUrl) {
    contentUrl = src.knownDocxUrl
    isPdf = false
    console.log(`  Content: DOCX at ${contentUrl}`)
  } else if (src.knownHtmlUrl) {
    contentUrl = src.knownHtmlUrl
    isPdf = false
    console.log(`  Content: HTML at ${contentUrl}`)
  } else if (src.knownPdfUrl) {
    contentUrl = src.knownPdfUrl
    isPdf = true
    console.log(`  Content: PDF at ${contentUrl}`)
  } else {
    // Discover from publication landing page
    console.log(`  Discovering content URL from landing page...`)
    const { html: landingHtml, status: landingStatus } = await fetchText(src.publicationUrl)
    if (landingStatus !== 200 || !landingHtml) {
      console.error(`  ✗ Landing page returned ${landingStatus} — skipping`)
      return
    }
    const pubPath = new URL(src.publicationUrl).pathname
    const { htmlUrls, pdfUrls } = discoverContentUrls(landingHtml, pubPath)
    console.log(`  Discovered: ${htmlUrls.length} HTML URL(s), ${pdfUrls.length} PDF URL(s)`)

    if (src.preferHtml && htmlUrls.length > 0) {
      contentUrl = htmlUrls[0]
      isPdf = false
      console.log(`  Using HTML: ${contentUrl}`)
    } else if (pdfUrls.length > 0) {
      contentUrl = pdfUrls[0]
      isPdf = true
      console.log(`  Using PDF: ${contentUrl}`)
    } else {
      console.error(`  ✗ No content URL discovered from landing page — skipping`)
      console.log(`  HTML found: ${JSON.stringify(htmlUrls)}`)
      console.log(`  PDF found: ${JSON.stringify(pdfUrls)}`)
      return
    }
  }

  // Fetch and process content
  let plainText: string
  let pageTitle: string
  let htmlKey: string | null = null
  let extractedBy: string

  if (src.knownDocxUrl) {
    // DOCX-only path (e.g. CSMC — only available as .docx on assets.publishing.service.gov.uk)
    console.log(`  Downloading DOCX: ${src.knownDocxUrl}`)
    const { buffer, status } = await fetchBinary(src.knownDocxUrl)
    if (status !== 200 || buffer.length === 0) {
      console.error(`  ✗ DOCX download failed (status ${status}) — skipping`)
      return
    }
    console.log(`  DOCX downloaded: ${(buffer.length / 1024).toFixed(0)} KB`)

    // Store raw DOCX in R2
    const docxKey = `${src.r2Prefix}/main.docx`
    await r2Put(docxKey, buffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    console.log(`  R2: ${docxKey}`)

    console.log(`  Extracting DOCX text via mammoth...`)
    plainText = await extractDocxText(buffer)
    pageTitle = src.title
    extractedBy = 'docx-mammoth'
  } else if (isPdf) {
    console.log(`  Downloading PDF...`)
    const { buffer, status } = await fetchBinary(contentUrl)
    if (status !== 200 || buffer.length === 0) {
      console.error(`  ✗ PDF download failed (status ${status}) — skipping`)
      return
    }
    console.log(`  PDF downloaded: ${(buffer.length / 1024).toFixed(0)} KB`)

    // Store raw PDF in R2
    const pdfKey = `${src.r2Prefix}/main.pdf`
    await r2Put(pdfKey, buffer, 'application/pdf')
    console.log(`  R2: ${pdfKey}`)

    console.log(`  Extracting PDF text...`)
    plainText = await extractPdfText(buffer)
    pageTitle = src.title
    extractedBy = 'pdf-text'
  } else {
    console.log(`  Fetching HTML...`)
    const { html, status } = await fetchText(contentUrl)
    if (status !== 200 || !html) {
      console.error(`  ✗ HTML fetch failed (status ${status}) — skipping`)
      return
    }

    // Store raw HTML in R2
    htmlKey = `${src.r2Prefix}/main.html`
    await r2Put(htmlKey, html, 'text/html')

    const mainContent = extractMainContent(html)
    plainText = stripHtml(mainContent)
    pageTitle = extractTitle(html) || src.title
    extractedBy = 'html-direct'
  }

  const wc = wordCount(plainText)
  const extractedText = plainText.slice(0, 1000)
  console.log(`  Extracted: ${wc} words`)

  // Store plain text in R2
  const textKey = `${src.r2Prefix}/main.text`
  await r2Put(textKey, plainText, 'text/plain')
  console.log(`  R2: ${textKey}`)

  // Upsert section
  const sectionClient = await pool.connect()
  try {
    await upsertSection(sectionClient, {
      documentId,
      pageSlug: 'main',
      pageTitle,
      sourceUrl: contentUrl,
      htmlKey,
      textKey,
      extractedText,
      wordCount: wc,
      extractedBy,
    })
    await markComplete(sectionClient, documentId, 1)
  } finally {
    sectionClient.release()
  }

  cp.completedSlugs.push(src.slug)
  saveCheckpoint(cp)
  console.log(`  ✓ Complete (${wc} words, extractedBy: ${extractedBy})`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== Civil Service Core — Operational Corpus Ingest ===')
  console.log(`User-Agent: ${USER_AGENT}`)
  console.log(`Rate limit: 1 req / ${MIN_DELAY_MS / 1000}s`)
  console.log(`Log: ${LOG_FILE}`)
  console.log(`Checkpoint: ${CHECKPOINT_FILE}`)
  console.log('')

  initLog()
  await checkRobotsTxt(GOV_UK_BASE, ['/government/publications/'])

  const cp = loadCheckpoint()
  console.log(`Checkpoint: ${cp.completedSlugs.length} docs already complete`)

  const docArg = process.argv.find(a => a.startsWith('--doc='))
  const targetSlug = docArg ? docArg.replace('--doc=', '') : null
  const toIngest = targetSlug
    ? SOURCES.filter(s => s.slug === targetSlug)
    : SOURCES

  if (targetSlug && toIngest.length === 0) {
    console.error(`No source found with slug "${targetSlug}"`)
    process.exit(1)
  }

  for (const src of toIngest) {
    await ingestSource(src, cp)
  }

  console.log('\n=== Civil Service ingest complete ===')
  console.log(`Completed: ${cp.completedSlugs.join(', ')}`)
  await pool.end()
}

main().catch(err => {
  console.error('\n✗ Fatal:', err.message ?? err)
  process.exit(1)
})
