/**
 * College of Policing — Authorised Professional Practice (APP) Ingest
 * Sprint V.3-C
 *
 * Source: college.police.uk/app
 * Type: ADMINISTRATIVE_GUIDANCE
 * Publisher: College of Policing
 *
 * Strategy:
 *   1. Check robots.txt for college.police.uk
 *   2. Fetch the APP index page to discover all topic areas
 *   3. For each topic area: fetch chapters and sub-pages
 *   4. Each chapter → OperationalSection under one OperationalDocument
 *
 * NOTE: college.police.uk has been observed to block some automated requests.
 *       If robots.txt is unavailable (connection refused) or returns Disallow,
 *       this script will abort before making content requests.
 *
 * Rate-limiting: 1 req / 2s (same as gov.uk policy)
 * Checkpoint: scripts/operational/cop-checkpoint.json
 *
 * Run:
 *   cd scrutinise-web && npx tsx ../scripts/operational/college-of-policing-ingest.ts
 *   or: npx tsx ../scripts/operational/college-of-policing-ingest.ts --topic=detention-and-custody
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
const COP_BASE = 'https://www.college.police.uk'
const APP_INDEX_URL = `${COP_BASE}/app`

const LOG_FILE = path.join(__dirname, 'cop-log.csv')
const CHECKPOINT_FILE = path.join(__dirname, 'cop-checkpoint.json')

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint
// ─────────────────────────────────────────────────────────────────────────────

interface CheckpointData {
  robotsChecked: boolean
  robotsBlocked: boolean
  documentId: string | null
  discoveredTopics: Array<{ slug: string; title: string; url: string }>
  completedTopics: string[]   // topic slugs fully ingested
  completedPages: Record<string, string[]>  // topic slug → page slugs
}

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'))
  return {
    robotsChecked: false,
    robotsBlocked: false,
    documentId: null,
    discoveredTopics: [],
    completedTopics: [],
    completedPages: {},
  }
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

async function fetchWithBackoff(url: string, maxRetries = 3): Promise<{ body: Buffer; status: number }> {
  let backoff = BACKOFF_INITIAL_MS
  let attempt = 0
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
      attempt++
      logRequest(url, 0, Date.now() - start, String(err?.message))
      if (attempt >= maxRetries) {
        console.error(`  ✗ Failed after ${maxRetries} attempts: ${err?.message}`)
        return { body: Buffer.alloc(0), status: 0 }
      }
      const wait = Math.min(backoff, BACKOFF_MAX_MS)
      console.warn(`  ⚠ Error (attempt ${attempt}): ${err?.message} — backoff ${wait / 1000}s`)
      await sleep(wait); backoff = Math.min(backoff * 2, BACKOFF_MAX_MS)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// robots.txt
// ─────────────────────────────────────────────────────────────────────────────

async function checkRobotsTxt(cp: CheckpointData): Promise<boolean> {
  if (cp.robotsChecked) {
    if (cp.robotsBlocked) {
      console.log('  [CHECKPOINT] robots.txt previously blocked — aborting')
      return false
    }
    console.log('  [CHECKPOINT] robots.txt previously OK')
    return true
  }

  console.log('Checking robots.txt on college.police.uk...')
  const robotsUrl = `${COP_BASE}/robots.txt`

  let robotsHtml: string
  try {
    const { body, status } = await fetchWithBackoff(robotsUrl, 2)
    if (status === 0) {
      // Connection refused / timeout — site may be blocking
      console.warn('  ⚠ Cannot connect to college.police.uk robots.txt (connection refused or timeout)')
      console.warn('  This may indicate the site is blocking automated access.')
      console.warn('  ABORT: Will not proceed without successful robots.txt check.')
      cp.robotsChecked = true
      cp.robotsBlocked = true
      saveCheckpoint(cp)
      return false
    }
    if (status !== 200) {
      console.warn(`  robots.txt returned ${status} — treating as permissive, proceeding cautiously`)
      cp.robotsChecked = true
      cp.robotsBlocked = false
      saveCheckpoint(cp)
      return true
    }
    robotsHtml = body.toString('utf-8')
  } catch (err: any) {
    console.warn(`  Cannot reach college.police.uk: ${err?.message}`)
    cp.robotsChecked = true
    cp.robotsBlocked = true
    saveCheckpoint(cp)
    return false
  }

  // Parse robots.txt
  const lines = robotsHtml.split('\n').map(l => l.trim().toLowerCase())
  let inBlock = false
  for (const line of lines) {
    if (line.startsWith('user-agent:')) {
      const a = line.replace('user-agent:', '').trim()
      inBlock = a === '*' || a.includes('scrutinise')
    }
    if (inBlock && line.startsWith('disallow:')) {
      const d = line.replace('disallow:', '').trim()
      if (d === '/' || (d && '/app'.startsWith(d))) {
        console.error(`  ✗ robots.txt disallows "${d}" for college.police.uk — ABORT`)
        cp.robotsChecked = true
        cp.robotsBlocked = true
        saveCheckpoint(cp)
        return false
      }
    }
  }

  console.log('  robots.txt OK — /app not disallowed')
  cp.robotsChecked = true
  cp.robotsBlocked = false
  saveCheckpoint(cp)
  return true
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
 * Extract main content from a College of Policing APP page.
 * COP uses a custom CMS; body content is typically in .app-body, .app-content,
 * or <article>/<main>.
 */
function extractMainContent(html: string): string {
  const appBody = html.match(/<div[^>]+class="[^"]*app-(?:body|content|page)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|<div[^>]+class)/i)
  if (appBody) return appBody[1]
  const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (article) return article[1]
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (main) return main[1]
  return html
}

/**
 * Extract APP topic/chapter links from the APP index page.
 * Returns links under /app/{topic}/ paths.
 */
function extractAppTopicLinks(html: string): Array<{ slug: string; title: string; url: string }> {
  const results: Array<{ slug: string; title: string; url: string }> = []
  const seen = new Set<string>()
  // APP index links: /app/{topic} or /app/{topic}/{chapter}
  const pattern = /href="(\/app\/([a-z0-9-]+)\/?)"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]
    const slug = m[2]
    const rawTitle = stripHtml(m[3]).trim()
    if (!seen.has(slug) && rawTitle.length > 3 && slug !== 'app') {
      seen.add(slug)
      results.push({ slug, title: rawTitle, url: `${COP_BASE}${href}` })
    }
  }
  return results
}

/**
 * Extract all chapter links from an APP topic page.
 * These are sub-pages of /app/{topic}/...
 */
function extractChapterLinks(html: string, topicSlug: string): Array<{ slug: string; title: string; url: string }> {
  const results: Array<{ slug: string; title: string; url: string }> = []
  const seen = new Set<string>()
  const pattern = new RegExp(`href="(/app/${topicSlug}/([a-z0-9-]+)/?)"[^>]*>([\\s\\S]*?)<\\/a>`, 'gi')
  let m: RegExpExecArray | null
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]
    const chSlug = m[2]
    const rawTitle = stripHtml(m[3]).trim()
    if (!seen.has(chSlug) && rawTitle.length > 3) {
      seen.add(chSlug)
      results.push({ slug: chSlug, title: rawTitle, url: `${COP_BASE}${href}` })
    }
  }
  return results
}

function wordCount(text: string): number { return text.split(/\s+/).filter(Boolean).length }
function slugify(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

async function upsertDocument(client: any): Promise<string> {
  const res = await client.query(`
    INSERT INTO "OperationalDocument"
      (id,"sourceType","sourceSlug","publisherName",title,description,
       "sourceUrl","r2Prefix",jurisdiction,"ingestStatus","pageCount","createdAt","updatedAt")
    VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,0,NOW(),NOW())
    ON CONFLICT ("sourceType","sourceSlug") DO UPDATE
      SET "ingestStatus"=$10,"updatedAt"=NOW()
    RETURNING id
  `, [
    DocumentSourceType.ADMINISTRATIVE_GUIDANCE,
    'college-of-policing-app',
    'College of Policing',
    'College of Policing: Authorised Professional Practice (APP)',
    'Authorised Professional Practice (APP) — the official and most authoritative source of professional practice for the police service in England and Wales.',
    APP_INDEX_URL,
    'operational/college-of-policing/app',
    'UK',
    OperationalIngestStatus.IN_PROGRESS,
    OperationalIngestStatus.IN_PROGRESS,
  ])
  return res.rows[0].id
}

async function upsertSection(client: any, params: {
  documentId: string; pageSlug: string; chapterSlug: string | null
  pageTitle: string; sourceUrl: string
  htmlKey: string; textKey: string; extractedText: string
  wordCount: number; orderIndex: number
}): Promise<void> {
  await client.query(`
    INSERT INTO "OperationalSection"
      (id,"operationalDocumentId","sourceType","pageSlug","chapterSlug","pageTitle","sourceUrl",
       "htmlKey","textKey","extractedText","wordCount","extractedBy","orderIndex",
       "ingestStatus","fetchedAt","createdAt","updatedAt")
    VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'html-direct',$11,$12,NOW(),NOW(),NOW())
    ON CONFLICT ("operationalDocumentId","pageSlug") DO UPDATE
      SET "pageTitle"=EXCLUDED."pageTitle","extractedText"=EXCLUDED."extractedText",
          "wordCount"=EXCLUDED."wordCount","htmlKey"=EXCLUDED."htmlKey","textKey"=EXCLUDED."textKey",
          "ingestStatus"=EXCLUDED."ingestStatus","fetchedAt"=NOW(),"updatedAt"=NOW()
  `, [
    params.documentId, DocumentSourceType.ADMINISTRATIVE_GUIDANCE,
    params.pageSlug, params.chapterSlug, params.pageTitle, params.sourceUrl,
    params.htmlKey, params.textKey, params.extractedText, params.wordCount,
    params.orderIndex, OperationalIngestStatus.COMPLETE,
  ])
}

async function updateDocumentCount(client: any, documentId: string, count: number): Promise<void> {
  await client.query(`
    UPDATE "OperationalDocument"
    SET "ingestStatus"=$1,"pageCount"=$2,"lastFetchedAt"=NOW(),"updatedAt"=NOW() WHERE id=$3
  `, [OperationalIngestStatus.COMPLETE, count, documentId])
}

// ─────────────────────────────────────────────────────────────────────────────
// Ingest one topic
// ─────────────────────────────────────────────────────────────────────────────

async function ingestTopic(
  topic: { slug: string; title: string; url: string },
  documentId: string,
  orderBase: number,
  cp: CheckpointData,
): Promise<number> {
  if (cp.completedTopics.includes(topic.slug)) {
    const count = (cp.completedPages[topic.slug] ?? []).length
    console.log(`  [SKIP] ${topic.slug} — ${count} pages already ingested`)
    return count
  }

  console.log(`\n  ── Topic: ${topic.title} (${topic.slug})`)

  if (!cp.completedPages[topic.slug]) cp.completedPages[topic.slug] = []

  // Fetch topic index page
  const { body: topicBody, status: topicStatus } = await fetchWithBackoff(topic.url)
  if (topicStatus !== 200) {
    console.log(`     ✗ Topic index ${topicStatus} — skip`)
    return 0
  }
  const topicHtml = topicBody.toString('utf-8')

  // Extract chapter links
  const chapters = extractChapterLinks(topicHtml, topic.slug)
  console.log(`     Found ${chapters.length} chapter(s)`)

  // Also ingest the topic overview page itself as a section
  const allPages: Array<{ slug: string; title: string; url: string }> = [
    { slug: topic.slug, title: topic.title, url: topic.url },
    ...chapters,
  ]

  let ingestedCount = 0

  for (let i = 0; i < allPages.length; i++) {
    const page = allPages[i]
    const pageKey = `${topic.slug}:${page.slug}`

    if (cp.completedPages[topic.slug].includes(page.slug)) {
      continue
    }

    let html: string
    if (page.url === topic.url) {
      // Already fetched the topic page
      html = topicHtml
    } else {
      process.stdout.write(`     [${i}/${allPages.length}] ${page.slug} ... `)
      const { body: pb, status: ps } = await fetchWithBackoff(page.url)
      if (ps !== 200) { console.log(`✗ (${ps})`); continue }
      html = pb.toString('utf-8')
    }

    const mainContent = extractMainContent(html)
    const plainText = stripHtml(mainContent)
    const pageTitle = extractTitle(html) || page.title
    const wc = wordCount(plainText)

    const pageSlug = `${topic.slug}/${page.slug}`
    const r2Base = `operational/college-of-policing/app/${topic.slug}/${page.slug}`
    const htmlKey = `${r2Base}.html`
    const textKey = `${r2Base}.text`

    await r2Put(htmlKey, html, 'text/html')
    await r2Put(textKey, plainText, 'text/plain')

    const dbClient = await pool.connect()
    try {
      await upsertSection(dbClient, {
        documentId,
        pageSlug,
        chapterSlug: topic.slug,
        pageTitle,
        sourceUrl: page.url,
        htmlKey,
        textKey,
        extractedText: plainText.slice(0, 1000),
        wordCount: wc,
        orderIndex: orderBase + i,
      })
    } finally {
      dbClient.release()
    }

    cp.completedPages[topic.slug].push(page.slug)
    ingestedCount++
    if (page.url !== topic.url) console.log(`✓ (${wc}w)`)

    // Save checkpoint every 20 pages
    if (ingestedCount % 20 === 0) saveCheckpoint(cp)
  }

  cp.completedTopics.push(topic.slug)
  saveCheckpoint(cp)
  console.log(`     ✓ Topic complete — ${ingestedCount} pages ingested`)
  return ingestedCount
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== College of Policing APP — Operational Corpus Ingest ===')
  console.log(`Index: ${APP_INDEX_URL}`)
  console.log('')

  initLog()
  const cp = loadCheckpoint()

  // robots.txt is mandatory — abort if blocked
  const allowed = await checkRobotsTxt(cp)
  if (!allowed) {
    console.error('\n✗ ABORTED: robots.txt check failed or site is blocking automated access.')
    console.error('  Manual options:')
    console.error('  1. Contact College of Policing for data export / API access')
    console.error('  2. Check if college.police.uk has a bulk download or API endpoint')
    console.error('  3. Check robots.txt manually at https://www.college.police.uk/robots.txt')
    await pool.end()
    process.exit(0)
  }

  console.log(`Checkpoint: ${cp.completedTopics.length} topics complete`)

  // Upsert the single OperationalDocument for all APP content
  let documentId = cp.documentId
  if (!documentId) {
    const dbClient = await pool.connect()
    try {
      documentId = await upsertDocument(dbClient)
      console.log(`DB: OperationalDocument ${documentId}`)
      cp.documentId = documentId
      saveCheckpoint(cp)
    } finally {
      dbClient.release()
    }
  }

  // Discover topics from APP index
  let topics = cp.discoveredTopics
  if (topics.length === 0) {
    console.log('\nFetching APP index to discover topics...')
    const { body, status } = await fetchWithBackoff(APP_INDEX_URL)
    if (status !== 200) {
      console.error(`✗ APP index returned ${status}`)
      await pool.end()
      process.exit(1)
    }
    const indexHtml = body.toString('utf-8')
    topics = extractAppTopicLinks(indexHtml)
    console.log(`Discovered ${topics.length} topics:`)
    for (const t of topics) console.log(`  ${t.slug}: ${t.title}`)
    cp.discoveredTopics = topics
    saveCheckpoint(cp)
  } else {
    console.log(`Using ${topics.length} topics from checkpoint`)
  }

  // Optional filter to single topic
  const topicArg = process.argv.find(a => a.startsWith('--topic='))
  const targetTopic = topicArg ? topicArg.replace('--topic=', '') : null
  const toIngest = targetTopic ? topics.filter(t => t.slug === targetTopic) : topics

  if (targetTopic && toIngest.length === 0) {
    console.error(`No topic "${targetTopic}"`)
    await pool.end()
    process.exit(1)
  }

  let totalIngested = 0
  let orderBase = 0
  for (const topic of toIngest) {
    const count = await ingestTopic(topic, documentId!, orderBase, cp)
    totalIngested += count
    orderBase += count
  }

  // Update document total page count
  const totalPages = Object.values(cp.completedPages).reduce((s, p) => s + p.length, 0)
  const dbClient = await pool.connect()
  try {
    await updateDocumentCount(dbClient, documentId!, totalPages)
  } finally {
    dbClient.release()
  }

  console.log(`\n=== College of Policing APP ingest complete ===`)
  console.log(`Total pages: ${totalPages}, topics: ${cp.completedTopics.length}`)
  await pool.end()
}

main().catch(err => {
  console.error('\n✗ Fatal:', err.message ?? err)
  process.exit(1)
})
