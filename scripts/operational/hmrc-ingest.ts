/**
 * HMRC Internal Manuals — Operational Corpus Ingest
 * Sprint V.3-A Phase B
 *
 * Fetches three HMRC manuals from gov.uk, stores HTML + extracted text in R2,
 * and writes index rows to Railway (OperationalDocument / OperationalSection).
 *
 * Rate-limiting: 1 req / 2s, exponential backoff on 429/503 (30s → 60s → ... → 10 min).
 * Politeness: robots.txt respected at startup; descriptive User-Agent set.
 * Audit log: every request written to scripts/operational/hmrc-pilot-log.csv.
 * Checkpoint: scripts/operational/hmrc-checkpoint.json — resume after interruption.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { DocumentSourceType, OperationalIngestStatus } from '@prisma/client'
import { r2Put } from '../legislation/r2-client'

// ─────────────────────────────────────────────────────────────────────────────
// Prisma — use pg directly (PrismaPg driver adapter needs SSL config that
// lib/prisma.ts doesn't pass for local script use)
// ─────────────────────────────────────────────────────────────────────────────

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
const MIN_DELAY_MS = 2000          // 1 req / 2s
const BACKOFF_INITIAL_MS = 30000   // 30s first backoff
const BACKOFF_MAX_MS = 600000      // 10 min max backoff
const FETCH_TIMEOUT_MS = 30000     // 30s per request
const LOG_FILE = path.join(__dirname, 'hmrc-pilot-log.csv')
const CHECKPOINT_FILE = path.join(__dirname, 'hmrc-checkpoint.json')
const GOV_UK_BASE = 'https://www.gov.uk'

// ─────────────────────────────────────────────────────────────────────────────
// Manual definitions
// ─────────────────────────────────────────────────────────────────────────────

interface ManualDef {
  slug: string
  title: string
  description: string
  govUkSlug: string   // the slug used in gov.uk URL: /hmrc-internal-manuals/{govUkSlug}
  r2Prefix: string
}

const MANUALS: ManualDef[] = [
  {
    slug: 'employment-income-manual',
    title: 'Employment Income Manual',
    description: 'HMRC guidance on employment income, benefits in kind, and PAYE.',
    govUkSlug: 'employment-income-manual',
    r2Prefix: 'operational/hmrc/employment-income-manual',
  },
  {
    slug: 'capital-gains-manual',
    title: 'Capital Gains Manual',
    description: 'HMRC guidance on capital gains tax, including reliefs and exemptions.',
    govUkSlug: 'capital-gains-manual',
    r2Prefix: 'operational/hmrc/capital-gains-manual',
  },
  {
    slug: 'compliance-handbook',
    title: 'Compliance Handbook',
    description: 'HMRC internal guidance on compliance, enquiries, and enforcement.',
    govUkSlug: 'compliance-handbook',
    r2Prefix: 'operational/hmrc/compliance-handbook',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint
// ─────────────────────────────────────────────────────────────────────────────

interface CheckpointData {
  completedManuals: string[]           // slugs fully ingested
  completedPages: Record<string, string[]>  // slug → [pageSlug, ...]
}

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'))
  }
  return { completedManuals: [], completedPages: {} }
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
// Rate-limiting state
// ─────────────────────────────────────────────────────────────────────────────

let lastRequestAt = 0

async function throttle(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestAt
  if (elapsed < MIN_DELAY_MS) {
    await sleep(MIN_DELAY_MS - elapsed)
  }
  lastRequestAt = Date.now()
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP fetch with backoff
// ─────────────────────────────────────────────────────────────────────────────

async function fetchWithBackoff(url: string): Promise<{ html: string; status: number }> {
  let backoff = BACKOFF_INITIAL_MS

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await throttle()
    const start = Date.now()
    try {
      const { status, body } = await httpGet(url)
      const duration = Date.now() - start
      logRequest(url, status, duration)

      if (status === 200) return { html: body, status }

      if (status === 429 || status === 503) {
        const wait = Math.min(backoff, BACKOFF_MAX_MS)
        console.warn(`  ⚠ ${status} on ${url} — backing off ${wait / 1000}s`)
        logRequest(url, status, duration, `backoff ${wait}ms`)
        await sleep(wait)
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS)
        continue
      }

      if (status === 404) {
        logRequest(url, status, duration, '404 — page absent')
        return { html: '', status }
      }

      logRequest(url, status, duration, `unexpected status`)
      return { html: '', status }

    } catch (err: any) {
      const duration = Date.now() - start
      const msg = String(err?.message ?? err)
      logRequest(url, 0, duration, `error: ${msg}`)
      const wait = Math.min(backoff, BACKOFF_MAX_MS)
      console.warn(`  ⚠ Fetch error ${url}: ${msg} — backing off ${wait / 1000}s`)
      await sleep(wait)
      backoff = Math.min(backoff * 2, BACKOFF_MAX_MS)
    }
  }
}

function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' },
      timeout: FETCH_TIMEOUT_MS,
    }
    https.get(url, options, res => {
      // Handle redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirect = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${GOV_UK_BASE}${res.headers.location}`
        res.destroy()
        return resolve(httpGet(redirect))
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') }))
      res.on('error', reject)
    }).on('error', reject).on('timeout', () => reject(new Error('Request timeout')))
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// robots.txt check
// ─────────────────────────────────────────────────────────────────────────────

async function checkRobotsTxt(): Promise<void> {
  console.log('Checking robots.txt on gov.uk...')
  const { html, status } = await fetchWithBackoff(`${GOV_UK_BASE}/robots.txt`)
  if (status !== 200) {
    console.warn('  Could not fetch robots.txt — proceeding cautiously')
    return
  }
  // Check if /hmrc-internal-manuals/ is disallowed for our user-agent or *
  const lines = html.split('\n').map(l => l.trim().toLowerCase())
  let inRelevantBlock = false
  for (const line of lines) {
    if (line.startsWith('user-agent:')) {
      const agent = line.replace('user-agent:', '').trim()
      inRelevantBlock = agent === '*' || agent.includes('scrutinise')
    }
    if (inRelevantBlock && line.startsWith('disallow:')) {
      const disallowed = line.replace('disallow:', '').trim()
      if (disallowed && '/hmrc-internal-manuals/'.startsWith(disallowed)) {
        throw new Error(`robots.txt disallows ${disallowed} — cannot proceed`)
      }
    }
  }
  console.log('  robots.txt check passed — /hmrc-internal-manuals/ not disallowed')
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML parsing helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Extract the page title from <title> or <h1> */
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  const raw = h1Match?.[1] ?? titleMatch?.[1] ?? ''
  return raw.replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

/** Strip HTML tags and collapse whitespace — returns plain text */
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
 * Extract the main content div from a gov.uk HMRC manual page.
 * gov.uk uses <div class="govuk-govspeak"> for manual body content.
 * Falls back to <main> if not found.
 */
function extractMainContent(html: string): string {
  const govspeakMatch = html.match(/<div[^>]+class="[^"]*govuk-govspeak[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|<div)/i)
  if (govspeakMatch) return govspeakMatch[1]
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (mainMatch) return mainMatch[1]
  return html
}

/** Extract page links from the manual contents/index page */
function extractManualPageLinks(html: string, manualGovUkSlug: string): Array<{ slug: string; url: string }> {
  const links: Array<{ slug: string; url: string }> = []
  const seen = new Set<string>()
  // gov.uk manual index pages list pages as: /hmrc-internal-manuals/{manual}/{pageId}
  const pattern = new RegExp(`href="(/hmrc-internal-manuals/${manualGovUkSlug}/([a-z0-9-]+))"`, 'gi')
  let match
  while ((match = pattern.exec(html)) !== null) {
    const [, href, pageSlug] = match
    if (!seen.has(pageSlug) && pageSlug !== 'contents') {
      seen.add(pageSlug)
      links.push({ slug: pageSlug, url: `${GOV_UK_BASE}${href}` })
    }
  }
  return links
}

/** Infer chapter slug from page slug (e.g. "eim01000" → "eim01") */
function inferChapterSlug(pageSlug: string): string {
  // HMRC slugs: 3-letter prefix + 5 digits. Chapter = first 5 chars.
  const m = pageSlug.match(/^([a-z]{2,4}\d{2})/)
  return m ? m[1] : pageSlug.slice(0, 5)
}

/** Count words in plain text */
function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers (pg directly — avoids Driver Adapter SSL issue in script context)
// ─────────────────────────────────────────────────────────────────────────────

async function upsertOperationalDocument(client: any, manual: ManualDef): Promise<string> {
  const res = await client.query(`
    INSERT INTO "OperationalDocument"
      (id, "sourceType", "sourceSlug", "publisherName", title, description, "sourceUrl", "r2Prefix", jurisdiction, "ingestStatus", "pageCount", "createdAt", "updatedAt")
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
    manual.slug,
    'HMRC',
    manual.title,
    manual.description,
    `${GOV_UK_BASE}/hmrc-internal-manuals/${manual.govUkSlug}`,
    manual.r2Prefix,
    'UK',
    OperationalIngestStatus.IN_PROGRESS,
    OperationalIngestStatus.IN_PROGRESS,
  ])
  return res.rows[0].id
}

async function upsertOperationalSection(client: any, params: {
  documentId: string
  pageSlug: string
  chapterSlug: string
  pageTitle: string
  sourceUrl: string
  htmlKey: string
  textKey: string
  extractedText: string
  wordCount: number
  orderIndex: number
}): Promise<void> {
  await client.query(`
    INSERT INTO "OperationalSection"
      (id, "operationalDocumentId", "sourceType", "pageSlug", "chapterSlug", "pageTitle", "sourceUrl",
       "htmlKey", "textKey", "extractedText", "wordCount", "extractedBy", "orderIndex",
       "ingestStatus", "fetchedAt", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), NOW())
    ON CONFLICT ("operationalDocumentId", "pageSlug") DO UPDATE
      SET "pageTitle" = EXCLUDED."pageTitle",
          "htmlKey" = EXCLUDED."htmlKey",
          "textKey" = EXCLUDED."textKey",
          "extractedText" = EXCLUDED."extractedText",
          "wordCount" = EXCLUDED."wordCount",
          "orderIndex" = EXCLUDED."orderIndex",
          "ingestStatus" = EXCLUDED."ingestStatus",
          "fetchedAt" = NOW(),
          "updatedAt" = NOW()
  `, [
    params.documentId,
    DocumentSourceType.ADMINISTRATIVE_GUIDANCE,
    params.pageSlug,
    params.chapterSlug,
    params.pageTitle,
    params.sourceUrl,
    params.htmlKey,
    params.textKey,
    params.extractedText,
    params.wordCount,
    'html-direct',
    params.orderIndex,
    OperationalIngestStatus.COMPLETE,
  ])
}

async function markDocumentComplete(client: any, documentId: string, pageCount: number): Promise<void> {
  await client.query(`
    UPDATE "OperationalDocument"
    SET "ingestStatus" = $1, "pageCount" = $2, "lastFetchedAt" = NOW(), "updatedAt" = NOW()
    WHERE id = $3
  `, [OperationalIngestStatus.COMPLETE, pageCount, documentId])
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ingest logic per manual
// ─────────────────────────────────────────────────────────────────────────────

async function ingestManual(manual: ManualDef, cp: CheckpointData): Promise<void> {
  if (cp.completedManuals.includes(manual.slug)) {
    console.log(`  [SKIP] ${manual.title} — already complete in checkpoint`)
    return
  }

  console.log(`\n── ${manual.title} ──────────────────────────────────────`)
  const client = await pool.connect()
  let documentId: string

  try {
    documentId = await upsertOperationalDocument(client, manual)
    console.log(`  DB row: OperationalDocument ${documentId}`)
  } finally {
    client.release()
  }

  // Fetch the manual index page to discover all page links
  const indexUrl = `${GOV_UK_BASE}/hmrc-internal-manuals/${manual.govUkSlug}`
  console.log(`  Fetching index: ${indexUrl}`)
  const { html: indexHtml, status: indexStatus } = await fetchWithBackoff(indexUrl)

  if (indexStatus !== 200 || !indexHtml) {
    console.error(`  ✗ Could not fetch index (status ${indexStatus}) — skipping manual`)
    return
  }

  const pageLinks = extractManualPageLinks(indexHtml, manual.govUkSlug)
  console.log(`  Found ${pageLinks.length} page links in index`)

  if (pageLinks.length === 0) {
    console.warn('  ⚠ No page links found — check HTML structure of index page')
    return
  }

  if (!cp.completedPages[manual.slug]) cp.completedPages[manual.slug] = []
  let ingested = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < pageLinks.length; i++) {
    const { slug: pageSlug, url: pageUrl } = pageLinks[i]

    if (cp.completedPages[manual.slug].includes(pageSlug)) {
      skipped++
      continue
    }

    process.stdout.write(`  [${i + 1}/${pageLinks.length}] ${pageSlug} ... `)
    const { html: pageHtml, status: pageStatus } = await fetchWithBackoff(pageUrl)

    if (pageStatus !== 200 || !pageHtml) {
      console.log(`✗ (${pageStatus})`)
      failed++
      continue
    }

    const chapterSlug = inferChapterSlug(pageSlug)
    const mainContent = extractMainContent(pageHtml)
    const plainText = stripHtml(mainContent)
    const title = extractTitle(pageHtml)
    const wc = wordCount(plainText)

    // FTS excerpt — first 1000 chars for Railway; full text goes to R2
    const extractedText = plainText.slice(0, 1000)

    const htmlKey = `${manual.r2Prefix}/${chapterSlug}/${pageSlug}.html`
    const textKey = `${manual.r2Prefix}/${chapterSlug}/${pageSlug}.text`

    // Write to R2
    await r2Put(htmlKey, pageHtml, 'text/html')
    await r2Put(textKey, plainText, 'text/plain')

    // Write to Railway
    const dbClient = await pool.connect()
    try {
      await upsertOperationalSection(dbClient, {
        documentId,
        pageSlug,
        chapterSlug,
        pageTitle: title,
        sourceUrl: pageUrl,
        htmlKey,
        textKey,
        extractedText,
        wordCount: wc,
        orderIndex: i,
      })
    } finally {
      dbClient.release()
    }

    cp.completedPages[manual.slug].push(pageSlug)
    ingested++
    console.log(`✓ (${wc} words)`)

    // Save checkpoint every 50 pages
    if (ingested % 50 === 0) saveCheckpoint(cp)
  }

  // Mark document complete
  const finalClient = await pool.connect()
  try {
    await markDocumentComplete(finalClient, documentId, ingested)
  } finally {
    finalClient.release()
  }

  cp.completedManuals.push(manual.slug)
  saveCheckpoint(cp)

  console.log(`  ✓ ${manual.title} complete — ${ingested} ingested, ${skipped} skipped, ${failed} failed`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== HMRC Internal Manuals — Operational Corpus Ingest ===')
  console.log(`User-Agent: ${USER_AGENT}`)
  console.log(`Rate limit: 1 req / ${MIN_DELAY_MS / 1000}s`)
  console.log(`Log file:   ${LOG_FILE}`)
  console.log(`Checkpoint: ${CHECKPOINT_FILE}`)
  console.log('')

  initLog()
  await checkRobotsTxt()

  const cp = loadCheckpoint()
  console.log(`Checkpoint: ${cp.completedManuals.length} manuals already complete`)

  // Parse optional --manual flag to run a single manual
  const manualArg = process.argv.find(a => a.startsWith('--manual='))
  const targetSlug = manualArg ? manualArg.replace('--manual=', '') : null
  const toIngest = targetSlug
    ? MANUALS.filter(m => m.slug === targetSlug)
    : MANUALS

  if (toIngest.length === 0) {
    console.error(`No manual found with slug "${targetSlug}"`)
    process.exit(1)
  }

  for (const manual of toIngest) {
    await ingestManual(manual, cp)
  }

  console.log('\n=== Ingest complete ===')
  console.log(`Completed manuals: ${cp.completedManuals.join(', ')}`)

  await pool.end()
}

main().catch(err => {
  console.error('\n✗ Fatal error:', err.message ?? err)
  process.exit(1)
})
