/**
 * ACAS Code of Practice — Operational Corpus Ingest
 * Sprint V.3-C
 *
 * Sources (acas.org.uk — STATUTORY_GUIDANCE):
 *   1. Code of Practice on Disciplinary and Grievance Procedures
 *      (acas.org.uk/acas-code-of-practice-on-disciplinary-and-grievance-procedures/html)
 *   Additional advisory guides (ADMINISTRATIVE_GUIDANCE):
 *   2. Discipline and grievances at work (the guide)
 *   3. Making workplace mediation work
 *
 * robots.txt check: /acas-code-of-practice-on-disciplinary-and-grievance-procedures allowed.
 * Rate-limiting: 1 req / 2s
 * Checkpoint: scripts/operational/acas-checkpoint.json
 *
 * Run:
 *   cd scrutinise-web && npx tsx ../scripts/operational/acas-ingest.ts
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
const ACAS_BASE = 'https://www.acas.org.uk'

const LOG_FILE = path.join(__dirname, 'acas-log.csv')
const CHECKPOINT_FILE = path.join(__dirname, 'acas-checkpoint.json')

// ─────────────────────────────────────────────────────────────────────────────
// Source definitions
// ─────────────────────────────────────────────────────────────────────────────

interface SourceDef {
  slug: string
  title: string
  description: string
  sourceType: DocumentSourceType
  /** Root URL — landing/hub page, used as publicationUrl in DB */
  rootUrl: string
  /**
   * chapterBase: path prefix for auto-discovering sub-page chapters.
   * Discovery finds hrefs that begin with this path and add one extra segment.
   * null = single-page or use explicitChapterUrls.
   */
  chapterBase: string | null
  /**
   * explicitChapterUrls: hardcoded ordered list of chapter URLs.
   * Used when sub-pages are top-level paths (not nested under rootUrl).
   * Takes precedence over chapterBase.
   */
  explicitChapterUrls?: string[]
  r2Prefix: string
}

const SOURCES: SourceDef[] = [
  {
    slug: 'acas-code-disciplinary-grievance',
    title: 'ACAS Code of Practice: Disciplinary and Grievance Procedures',
    description: 'Statutory Code of Practice (2015) under the Trade Union and Labour Relations (Consolidation) Act 1992. Sets the minimum expected standard for disciplinary and grievance procedures.',
    sourceType: DocumentSourceType.STATUTORY_GUIDANCE,
    rootUrl: `${ACAS_BASE}/acas-code-of-practice-on-disciplinary-and-grievance-procedures/html`,
    chapterBase: null,
    r2Prefix: 'operational/acas/acas-code-disciplinary-grievance',
  },
  {
    slug: 'acas-guide-discipline-grievances',
    title: 'ACAS Guide: Discipline and Grievances at Work',
    description: 'ACAS guidance on handling discipline and grievances at work, covering disciplinary procedure, grievance procedure, investigations, and appeals.',
    sourceType: DocumentSourceType.ADMINISTRATIVE_GUIDANCE,
    rootUrl: `${ACAS_BASE}/discipline-and-grievance`,
    chapterBase: null,
    // Sub-pages are top-level paths (not nested under /discipline-and-grievance/)
    explicitChapterUrls: [
      `${ACAS_BASE}/disciplinary-procedure-step-by-step`,
      `${ACAS_BASE}/grievance-procedure-step-by-step`,
      `${ACAS_BASE}/investigations-for-discipline-and-grievance-step-by-step`,
      `${ACAS_BASE}/suspension-during-an-investigation`,
      `${ACAS_BASE}/appealing-a-disciplinary-or-grievance-outcome`,
    ],
    r2Prefix: 'operational/acas/acas-guide-discipline-grievances',
  },
  {
    slug: 'acas-dismissal',
    title: 'ACAS Guide: Dismissal',
    description: 'ACAS guidance on dismissal procedures, including types of dismissal, fair process, unfair dismissal, constructive dismissal, and notice.',
    sourceType: DocumentSourceType.ADMINISTRATIVE_GUIDANCE,
    rootUrl: `${ACAS_BASE}/dismissals`,
    chapterBase: '/dismissals/',
    r2Prefix: 'operational/acas/acas-dismissal',
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
  console.log('Checking robots.txt on acas.org.uk...')
  const { body, status } = await fetchWithBackoff(`${ACAS_BASE}/robots.txt`)
  if (status !== 200) { console.warn('  Cannot fetch — proceeding cautiously'); return }
  const lines = body.toString('utf-8').split('\n').map(l => l.trim().toLowerCase())
  let inBlock = false
  const paths = ['/acas-code-of-practice-on-disciplinary-and-grievance-procedures']
  for (const line of lines) {
    if (line.startsWith('user-agent:')) {
      const a = line.replace('user-agent:', '').trim()
      inBlock = a === '*' || a.includes('scrutinise')
    }
    if (inBlock && line.startsWith('disallow:')) {
      const d = line.replace('disallow:', '').trim()
      for (const p of paths) {
        if (d && p.startsWith(d)) {
          throw new Error(`robots.txt disallows "${d}" — cannot proceed for ACAS`)
        }
      }
    }
  }
  console.log('  robots.txt OK — ACAS Code of Practice path not disallowed')
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
 * Extract main body content from an ACAS page.
 * ACAS uses Drupal — content is in <article> (class article__wrapper/article__content)
 * or <main>. Note: do NOT use field-body patterns; ACAS's .body-wrapper contains the
 * email subscription widget (false positive, only 18 words).
 */
function extractMainContent(html: string): string {
  const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (article) return article[1]
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (main) return main[1]
  return html
}

function wordCount(text: string): number { return text.split(/\s+/).filter(Boolean).length }

/**
 * Discover chapter sub-pages from a root page.
 * Returns absolute URLs for immediate sub-pages of chapterBase (one extra segment).
 */
function discoverChapterUrls(html: string, chapterBase: string): string[] {
  const seen = new Set<string>()
  const results: string[] = []
  const escaped = chapterBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`href="(${escaped}[^/"#?][^"#?]*/?)(?:[#?][^"]*)?"`,'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const href = m[1]
    const clean = href.split('?')[0].split('#')[0]
    const remainder = clean.slice(chapterBase.length)
    const segments = remainder.split('/').filter(Boolean)
    if (segments.length === 1 && !seen.has(clean)) {
      seen.add(clean)
      results.push(`${ACAS_BASE}${clean.endsWith('/') ? clean : clean + '/'}`)
    }
  }
  return results
}

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
    src.sourceType, src.slug, 'ACAS', src.title, src.description,
    src.rootUrl, src.r2Prefix, 'UK',
    OperationalIngestStatus.IN_PROGRESS, OperationalIngestStatus.IN_PROGRESS,
  ])
  return res.rows[0].id
}

async function upsertSection(client: any, params: {
  documentId: string; sourceType: DocumentSourceType
  pageSlug: string; pageTitle: string; sourceUrl: string
  htmlKey: string; textKey: string; extractedText: string; wordCount: number
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
    params.documentId, params.sourceType, params.pageSlug,
    params.pageTitle, params.sourceUrl, params.htmlKey, params.textKey,
    params.extractedText, params.wordCount, OperationalIngestStatus.COMPLETE,
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
    console.log(`  [SKIP] ${src.slug}`)
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
  if (rootStatus !== 200) {
    console.error(`  ✗ Root page ${rootStatus} — skip`)
    return
  }
  const rootHtml = rootBody.toString('utf-8')
  const docTitle = extractTitle(rootHtml) || src.title
  const rootText = stripHtml(extractMainContent(rootHtml))

  // Determine chapter URLs
  let chapterUrls: string[] = []
  if (src.explicitChapterUrls) {
    chapterUrls = src.explicitChapterUrls
    console.log(`  Chapters: ${chapterUrls.length} (explicit list)`)
  } else if (src.chapterBase) {
    chapterUrls = discoverChapterUrls(rootHtml, src.chapterBase)
    console.log(`  Chapters discovered: ${chapterUrls.length}`)
    chapterUrls.forEach((u, i) => console.log(`    ${i + 1}. ${u}`))
  }

  // Collect all text
  const allTextParts: string[] = [`## ${docTitle}\n\n${rootText}`]
  let pagesIngested = 1

  for (const chapterUrl of chapterUrls) {
    console.log(`  Fetching: ${chapterUrl}`)
    const { body: chBody, status: chStatus } = await fetchWithBackoff(chapterUrl)
    if (chStatus !== 200 || chBody.length === 0) {
      console.warn(`    ⚠ Status ${chStatus} — skipping`)
      continue
    }
    const chHtml = chBody.toString('utf-8')
    const chTitle = extractTitle(chHtml)
    const chText = stripHtml(extractMainContent(chHtml))
    allTextParts.push(`## ${chTitle}\n\n${chText}`)
    console.log(`    ✓ ${chTitle} (${wordCount(chText)} words)`)
    pagesIngested++
  }

  const combinedText = allTextParts.join('\n\n---\n\n')
  const totalWc = wordCount(combinedText)
  console.log(`  Total: ${pagesIngested} pages, ${totalWc} words`)

  const htmlKey = `${src.r2Prefix}/main.html`
  const textKey = `${src.r2Prefix}/main.text`
  await r2Put(htmlKey, rootHtml, 'text/html')
  await r2Put(textKey, combinedText, 'text/plain')

  const sc = await pool.connect()
  try {
    await upsertSection(sc, {
      documentId, sourceType: src.sourceType,
      pageSlug: 'main', pageTitle: docTitle, sourceUrl: src.rootUrl,
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
  console.log('=== ACAS Code of Practice — Operational Corpus Ingest ===')
  console.log('')

  initLog()
  await checkRobotsTxt()

  const cp = loadCheckpoint()
  console.log(`Checkpoint: ${cp.completedSlugs.length} docs complete`)

  for (const src of SOURCES) {
    await ingestSource(src, cp)
  }

  console.log('\n=== ACAS ingest complete ===')
  await pool.end()
}

main().catch(err => {
  console.error('\n✗ Fatal:', err.message ?? err)
  process.exit(1)
})
