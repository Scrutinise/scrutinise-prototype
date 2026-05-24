/**
 * ICO Codes of Practice — Operational Corpus Ingest
 * Sprint V.3-C  (v2 — multi-chapter crawl)
 *
 * Sources (ico.org.uk — STATUTORY_GUIDANCE):
 *   1. Data Sharing Code of Practice    (~22 chapters)
 *   2. Children's Code                  (~20 chapters)
 *   3. Direct Marketing Guidance        (~8 chapters)
 *   4. Data Protection & Journalism Code (~15 chapters)
 *   5. FOI guidance hub                 (single hub page — logged as-is)
 *
 * Multi-chapter documents: the root page lists chapter links. Each chapter
 * URL starts with the `chapterBase` prefix and has exactly one more path segment.
 * The script discovers all chapters, fetches each, concatenates the text, and
 * stores one OperationalDocument + one OperationalSection ('main') per source.
 *
 * robots.txt: /for-organisations/ is not disallowed for *.
 * Rate-limit: 1 req / 2s minimum.
 * Checkpoint: scripts/operational/ico-checkpoint.json
 *
 * Run:
 *   cd scrutinise-web && npx tsx ../scripts/operational/ico-ingest.ts
 *   cd scrutinise-web && npx tsx ../scripts/operational/ico-ingest.ts --slug=ico-data-sharing-code
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
const ICO_BASE = 'https://ico.org.uk'

const LOG_FILE = path.join(__dirname, 'ico-log.csv')
const CHECKPOINT_FILE = path.join(__dirname, 'ico-checkpoint.json')

// ─────────────────────────────────────────────────────────────────────────────
// Source definitions
// ─────────────────────────────────────────────────────────────────────────────

interface SourceDef {
  slug: string
  title: string
  description: string
  sourceType: DocumentSourceType
  /** Root URL — used as landing page and publicationUrl in DB */
  rootUrl: string
  /**
   * chapterBase: path prefix for chapter sub-pages.
   * Chapter links are those whose href starts with this path and has exactly
   * one additional non-empty path segment (so we don't recurse into grandchildren).
   * null = single-page source (no chapter discovery).
   */
  chapterBase: string | null
  r2Prefix: string
}

const SOURCES: SourceDef[] = [
  {
    slug: 'ico-data-sharing-code',
    title: 'ICO Data Sharing Code of Practice',
    description: 'Statutory code of practice (2021) under the Data Protection Act 2018 providing guidance on sharing personal data lawfully and responsibly.',
    sourceType: DocumentSourceType.STATUTORY_GUIDANCE,
    rootUrl: `${ICO_BASE}/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/data-sharing-a-code-of-practice/`,
    chapterBase: '/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/data-sharing-a-code-of-practice/',
    r2Prefix: 'operational/ico/ico-data-sharing-code',
  },
  {
    slug: 'ico-childrens-code',
    title: "ICO Children's Code (Age Appropriate Design Code)",
    description: "Statutory code of practice under the Data Protection Act 2018 setting standards for online services likely to be accessed by children.",
    sourceType: DocumentSourceType.STATUTORY_GUIDANCE,
    rootUrl: `${ICO_BASE}/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/`,
    chapterBase: '/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/',
    r2Prefix: 'operational/ico/ico-childrens-code',
  },
  {
    slug: 'ico-direct-marketing-code',
    title: 'ICO Direct Marketing Guidance',
    description: 'ICO guidance under the Data Protection Act 2018 and PECR on data protection compliance for direct marketing activities.',
    sourceType: DocumentSourceType.STATUTORY_GUIDANCE,
    rootUrl: `${ICO_BASE}/for-organisations/direct-marketing-and-privacy-and-electronic-communications/direct-marketing-guidance/`,
    chapterBase: '/for-organisations/direct-marketing-and-privacy-and-electronic-communications/direct-marketing-guidance/',
    r2Prefix: 'operational/ico/ico-direct-marketing-code',
  },
  {
    slug: 'ico-journalism-code',
    title: 'ICO Data Protection and Journalism Code of Practice',
    description: 'Statutory code of practice under the Data Protection Act 2018 on data protection compliance in journalism.',
    sourceType: DocumentSourceType.STATUTORY_GUIDANCE,
    rootUrl: `${ICO_BASE}/for-organisations/uk-gdpr-guidance-and-resources/data-protection-and-journalism-code-of-practice/journalism-code/`,
    chapterBase: '/for-organisations/uk-gdpr-guidance-and-resources/data-protection-and-journalism-code-of-practice/journalism-code/',
    r2Prefix: 'operational/ico/ico-journalism-code',
  },
  {
    slug: 'ico-foi-code',
    title: 'ICO Freedom of Information Guidance',
    description: 'ICO guidance hub for public authorities on Freedom of Information Act 2000 obligations, exemptions, and publication schemes.',
    sourceType: DocumentSourceType.STATUTORY_GUIDANCE,
    rootUrl: `${ICO_BASE}/for-organisations/foi/`,
    chapterBase: '/for-organisations/foi/',
    r2Prefix: 'operational/ico/ico-foi-code',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint
// ─────────────────────────────────────────────────────────────────────────────

interface CheckpointData {
  completedSlugs: string[]
  blockedSlugs: string[]
}

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'))
  return { completedSlugs: [], blockedSlugs: [] }
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
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
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
      if (status === 403) {
        console.warn(`  ⚠ 403 Forbidden — ICO blocking this URL`)
        return { body: Buffer.alloc(0), status }
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
  console.log('Checking robots.txt on ico.org.uk...')
  const { body, status } = await fetchWithBackoff(`${ICO_BASE}/robots.txt`)
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
      if (d && '/for-organisations/'.startsWith(d)) {
        throw new Error(`robots.txt disallows "${d}" for ICO`)
      }
    }
  }
  console.log('  robots.txt OK — /for-organisations/ not disallowed')
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

/**
 * Extract main article/body content from an ICO page.
 * ICO uses Drupal — body is in <main> or article-like divs.
 */
function extractMainContent(html: string): string {
  // ICO Drupal: look for <main> first, then <article>
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (main) return main[1]
  const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (article) return article[1]
  // Fallback
  const contentDiv = html.match(/<div[^>]+id="content"[^>]*>([\s\S]*?)<\/div>/i)
  if (contentDiv) return contentDiv[1]
  return html
}

/**
 * Discover chapter URLs from a root page.
 * Returns absolute URLs for immediate sub-pages of chapterBase (one extra segment).
 */
function discoverChapterUrls(html: string, chapterBase: string): string[] {
  // Match all hrefs that start with chapterBase and add exactly one path segment
  const seen = new Set<string>()
  const results: string[] = []
  // The chapter base ends with '/', so a chapter looks like: chapterBase + {segment} + '/'
  // We want hrefs that are: chapterBase + [^/]+ + /?
  const escaped = chapterBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`href="(${escaped}[^/"#?][^"#?]*\/?)(?:[#?][^"]*)?"`,'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const href = m[1]
    // Strip query/fragment
    const clean = href.split('?')[0].split('#')[0]
    // Ensure it's a direct child (only one extra segment after the base)
    const remainder = clean.slice(chapterBase.length)
    const segments = remainder.split('/').filter(Boolean)
    if (segments.length === 1 && !seen.has(clean)) {
      seen.add(clean)
      results.push(`${ICO_BASE}${clean.endsWith('/') ? clean : clean + '/'}`)
    }
  }
  return results
}

function wordCount(text: string): number { return text.split(/\s+/).filter(Boolean).length }

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

async function upsertDocument(client: any, src: SourceDef): Promise<string> {
  const res = await client.query(`
    INSERT INTO "OperationalDocument"
      (id,"sourceType","sourceSlug","publisherName",title,description,
       "sourceUrl","r2Prefix",jurisdiction,"ingestStatus","pageCount","createdAt","updatedAt")
    VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,0,NOW(),NOW())
    ON CONFLICT ("sourceType","sourceSlug") DO UPDATE
      SET title=EXCLUDED.title,"ingestStatus"=$10,"updatedAt"=NOW()
    RETURNING id
  `, [
    src.sourceType, src.slug, "Information Commissioner's Office (ICO)",
    src.title, src.description, src.rootUrl, src.r2Prefix, 'UK',
    OperationalIngestStatus.IN_PROGRESS, OperationalIngestStatus.IN_PROGRESS,
  ])
  return res.rows[0].id
}

async function upsertSection(client: any, params: {
  documentId: string; sourceType: DocumentSourceType
  pageTitle: string; sourceUrl: string; htmlKey: string; textKey: string
  extractedText: string; wordCount: number
}): Promise<void> {
  await client.query(`
    INSERT INTO "OperationalSection"
      (id,"operationalDocumentId","sourceType","pageSlug","chapterSlug","pageTitle","sourceUrl",
       "htmlKey","textKey","extractedText","wordCount","extractedBy","orderIndex",
       "ingestStatus","fetchedAt","createdAt","updatedAt")
    VALUES (gen_random_uuid(),$1,$2,'main',NULL,$3,$4,$5,$6,$7,$8,'html-direct',0,$9,NOW(),NOW(),NOW())
    ON CONFLICT ("operationalDocumentId","pageSlug") DO UPDATE
      SET "extractedText"=EXCLUDED."extractedText","wordCount"=EXCLUDED."wordCount",
          "textKey"=EXCLUDED."textKey","htmlKey"=EXCLUDED."htmlKey",
          "ingestStatus"=EXCLUDED."ingestStatus","fetchedAt"=NOW(),"updatedAt"=NOW()
  `, [
    params.documentId, params.sourceType, params.pageTitle, params.sourceUrl,
    params.htmlKey, params.textKey, params.extractedText, params.wordCount,
    OperationalIngestStatus.COMPLETE,
  ])
}

async function markComplete(client: any, documentId: string, pageCount: number): Promise<void> {
  await client.query(`
    UPDATE "OperationalDocument"
    SET "ingestStatus"=$1,"pageCount"=$2,"lastFetchedAt"=NOW(),"updatedAt"=NOW() WHERE id=$3
  `, [OperationalIngestStatus.COMPLETE, pageCount, documentId])
}

// ─────────────────────────────────────────────────────────────────────────────
// Ingest one source (multi-chapter aware)
// ─────────────────────────────────────────────────────────────────────────────

async function ingestSource(src: SourceDef, cp: CheckpointData): Promise<void> {
  if (cp.completedSlugs.includes(src.slug)) {
    console.log(`  [SKIP] ${src.slug} — already complete`)
    return
  }
  if (cp.blockedSlugs.includes(src.slug)) {
    console.log(`  [SKIP] ${src.slug} — blocked (403)`)
    return
  }

  console.log(`\n── ${src.title}`)
  console.log(`  Root: ${src.rootUrl}`)

  const dbClient = await pool.connect()
  let documentId: string
  try {
    documentId = await upsertDocument(dbClient, src)
  } finally {
    dbClient.release()
  }

  // Fetch root page
  const { body: rootBody, status: rootStatus } = await fetchWithBackoff(src.rootUrl)
  if (rootStatus === 403) {
    console.warn(`  ✗ 403 — blocked at root page`)
    cp.blockedSlugs.push(src.slug); saveCheckpoint(cp); return
  }
  if (rootStatus !== 200 || rootBody.length === 0) {
    console.error(`  ✗ Root page returned ${rootStatus} — skipping`)
    return
  }
  const rootHtml = rootBody.toString('utf-8')
  const docTitle = extractTitle(rootHtml) || src.title

  // Discover chapters
  let chapterUrls: string[] = []
  if (src.chapterBase) {
    chapterUrls = discoverChapterUrls(rootHtml, src.chapterBase)
    console.log(`  Chapters discovered: ${chapterUrls.length}`)
    chapterUrls.forEach((u, i) => console.log(`    ${i + 1}. ${u}`))
  }

  // Collect all text
  const allTextParts: string[] = []
  const rootText = stripHtml(extractMainContent(rootHtml))
  allTextParts.push(`## ${docTitle}\n\n${rootText}`)

  let pagesIngested = 1

  for (const chapterUrl of chapterUrls) {
    console.log(`  Fetching: ${chapterUrl}`)
    const { body: chBody, status: chStatus } = await fetchWithBackoff(chapterUrl)
    if (chStatus !== 200 || chBody.length === 0) {
      console.warn(`    ⚠ Status ${chStatus} — skipping chapter`)
      continue
    }
    const chHtml = chBody.toString('utf-8')
    const chTitle = extractTitle(chHtml)
    const chText = stripHtml(extractMainContent(chHtml))
    const chWc = wordCount(chText)
    allTextParts.push(`## ${chTitle}\n\n${chText}`)
    console.log(`    ✓ ${chTitle} (${chWc} words)`)
    pagesIngested++
  }

  const combinedText = allTextParts.join('\n\n---\n\n')
  const totalWc = wordCount(combinedText)
  console.log(`  Total: ${pagesIngested} pages, ${totalWc} words`)

  // Upload to R2
  const htmlKey = `${src.r2Prefix}/main.html`
  const textKey = `${src.r2Prefix}/main.text`
  // Store root HTML as representative; store concatenated text as .text
  await r2Put(htmlKey, rootHtml, 'text/html')
  await r2Put(textKey, combinedText, 'text/plain')

  const sc = await pool.connect()
  try {
    await upsertSection(sc, {
      documentId, sourceType: src.sourceType,
      pageTitle: docTitle, sourceUrl: src.rootUrl,
      htmlKey, textKey, extractedText: combinedText.slice(0, 1000), wordCount: totalWc,
    })
    await markComplete(sc, documentId, pagesIngested)
  } finally {
    sc.release()
  }

  cp.completedSlugs.push(src.slug)
  saveCheckpoint(cp)
  console.log(`  ✓ ${src.slug}: ${totalWc} words across ${pagesIngested} pages`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== ICO Codes of Practice — Operational Corpus Ingest (v2 multi-chapter) ===')
  console.log('')

  initLog()
  await checkRobotsTxt()

  const cp = loadCheckpoint()
  console.log(`Checkpoint: ${cp.completedSlugs.length} complete, ${cp.blockedSlugs.length} blocked`)

  // Optional: filter to a specific slug
  const slugArg = process.argv.find(a => a.startsWith('--slug='))
  const targetSlug = slugArg ? slugArg.replace('--slug=', '') : null

  const toIngest = targetSlug ? SOURCES.filter(s => s.slug === targetSlug) : SOURCES
  if (targetSlug && toIngest.length === 0) {
    console.error(`Unknown slug: ${targetSlug}`)
    process.exit(1)
  }

  for (const src of toIngest) {
    await ingestSource(src, cp)
  }

  console.log('\n=== ICO ingest complete ===')
  console.log(`Completed: ${cp.completedSlugs.join(', ')}`)
  if (cp.blockedSlugs.length > 0) {
    console.log(`\n⚠ Blocked (HTTP 403): ${cp.blockedSlugs.join(', ')}`)
  }
  await pool.end()
}

main().catch(err => {
  console.error('\n✗ Fatal:', err.message ?? err)
  process.exit(1)
})
