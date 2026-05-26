/**
 * College of Policing APP — Ingest from browser crawl
 * Sprint V.3-C-2c
 *
 * Source: scripts/operational/cop-app-crawl.json
 *   Raw crawl: 2,194 entries (includes fragment-URL and exact duplicates)
 *   After dedup on canonical URL: 680 unique pages, ~1,010,070 words
 *
 * Why local JSON rather than HTTP:
 *   The CoP APP is protected by a WAF (HTTP 403 on all IPs for /app/* paths).
 *   A browser crawl was used to collect the content; this script ingests it.
 *
 * Design:
 *   - 1 OperationalDocument  (updates existing FAILED record: college-of-policing-app)
 *   - 680 OperationalSections (one per unique canonical page)
 *   - R2 key: operational/college-of-policing/app/{pageSlug}/main.text
 *   - No HTTP fetching — reads cop-app-crawl.json only
 *   - Concurrency: 20 parallel R2+DB workers
 *   - Checkpoint/resume: scripts/operational/cop-app-checkpoint.json
 *
 * Run:
 *   cd scrutinise-web && npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/operational/cop-app-ingest.ts
 *   Resume:  same command — checkpoint skips completed slugs automatically
 */

import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { DocumentSourceType, OperationalIngestStatus } from '@prisma/client'
import { r2Put } from '../legislation/r2-client'

// ─────────────────────────────────────────────────────────────────────────────
// pg pool
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require(path.join(__dirname, '../../scrutinise-web/node_modules/pg'))
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,  // higher than default — supports 20 concurrent workers queuing for connections
})

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CRAWL_FILE = path.join(__dirname, 'cop-app-crawl.json')
const CHECKPOINT_FILE = path.join(__dirname, 'cop-app-checkpoint.json')
const LOG_FILE = path.join(__dirname, 'cop-app-log.csv')

const DOCUMENT_SLUG   = 'college-of-policing-app'
const DOCUMENT_TITLE  = 'College of Policing — Authorised Professional Practice (APP)'
const PUBLISHER_NAME  = 'College of Policing'
const SOURCE_URL      = 'https://www.college.police.uk/app'
const R2_PREFIX       = 'operational/college-of-policing/app'
const CONCURRENCY     = 20

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CrawlEntry {
  url: string
  title: string
  text: string
  wordCount: number
}

interface NormalisedPage {
  canonicalUrl: string    // fragment-stripped, trailing-slash-stripped
  pageSlug: string        // URL path after /app/, slashes → --
  title: string           // trimmed
  text: string
  wordCount: number
}

interface CheckpointData {
  completedSlugs: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Slug derivation
// ─────────────────────────────────────────────────────────────────────────────

function derivePage(entry: CrawlEntry): NormalisedPage {
  const u = new URL(entry.url)
  const canonicalUrl = (u.origin + u.pathname).replace(/\/$/, '')
  // Path segment after /app/  e.g. "armed-policing/firearms-licensing"
  const appRelative = u.pathname.replace(/^\/app\/?/, '').replace(/\/$/, '')
  // Replace inner slashes with -- to produce a flat, unique slug
  const pageSlug = appRelative.replace(/\//g, '--') || 'root'

  return {
    canonicalUrl,
    pageSlug,
    title: (entry.title ?? '').trim().replace(/\s{2,}/g, ' '),
    text: entry.text ?? '',
    wordCount: entry.wordCount ?? 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deduplication
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dedup on canonical URL. Fragment URLs (e.g. /page#section-id) collapse to the
 * same page as /page. When multiple entries share a canonical URL, keep the one
 * with the most text (the full-page crawl rather than a section-anchor crawl).
 */
function deduplicateEntries(raw: CrawlEntry[]): NormalisedPage[] {
  const byCanon = new Map<string, NormalisedPage>()
  for (const entry of raw) {
    const page = derivePage(entry)
    const existing = byCanon.get(page.canonicalUrl)
    if (!existing || page.text.length > existing.text.length) {
      byCanon.set(page.canonicalUrl, page)
    }
  }
  // Return sorted by slug for consistent processing order and checkpoint stability
  return [...byCanon.values()].sort((a, b) => a.pageSlug.localeCompare(b.pageSlug))
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint
// ─────────────────────────────────────────────────────────────────────────────

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'))
  }
  return { completedSlugs: [] }
}

function saveCheckpoint(cp: CheckpointData): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ completedSlugs: cp.completedSlugs }, null, 2))
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────────────────────────────────────────

function initLog(): void {
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, 'timestamp,pageSlug,wordCount,r2Key,status\n')
  }
}

function logEntry(pageSlug: string, wordCount: number, r2Key: string, status: string): void {
  const ts = new Date().toISOString()
  fs.appendFileSync(LOG_FILE, `${ts},"${pageSlug}",${wordCount},"${r2Key}","${status}"\n`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Concurrency helper
// ─────────────────────────────────────────────────────────────────────────────

async function processConcurrently<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

async function ensureDocument(): Promise<string> {
  const res = await pool.query(`
    INSERT INTO "OperationalDocument"
      (id, "sourceType", "sourceSlug", "publisherName", title, description,
       "sourceUrl", "r2Prefix", jurisdiction, "ingestStatus", "pageCount", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 0, NOW(), NOW())
    ON CONFLICT ("sourceType", "sourceSlug") DO UPDATE
      SET title         = EXCLUDED.title,
          "r2Prefix"    = EXCLUDED."r2Prefix",
          "ingestStatus" = $10,
          "updatedAt"   = NOW()
    RETURNING id
  `, [
    DocumentSourceType.ADMINISTRATIVE_GUIDANCE,
    DOCUMENT_SLUG,
    PUBLISHER_NAME,
    DOCUMENT_TITLE,
    'Authorised Professional Practice (APP) — the official and most authoritative source of professional practice for policing in England and Wales.',
    SOURCE_URL,
    R2_PREFIX,
    'UK',
    OperationalIngestStatus.IN_PROGRESS,
    OperationalIngestStatus.IN_PROGRESS,
  ])
  return res.rows[0].id
}

async function upsertSection(params: {
  documentId: string
  page: NormalisedPage
  textKey: string
  orderIndex: number
}): Promise<void> {
  const { documentId, page, textKey, orderIndex } = params
  const extractedText = page.text.slice(0, 1000)
  await pool.query(`
    INSERT INTO "OperationalSection"
      (id, "operationalDocumentId", "sourceType", "pageSlug", "chapterSlug", "pageTitle",
       "sourceUrl", "htmlKey", "textKey", "extractedText", "wordCount", "extractedBy",
       "orderIndex", "ingestStatus", "fetchedAt", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), $1, $2, $3, NULL, $4, $5, NULL, $6, $7, $8, $9, $10, $11, NOW(), NOW(), NOW())
    ON CONFLICT ("operationalDocumentId", "pageSlug") DO UPDATE
      SET "pageTitle"     = EXCLUDED."pageTitle",
          "textKey"       = EXCLUDED."textKey",
          "extractedText" = EXCLUDED."extractedText",
          "wordCount"     = EXCLUDED."wordCount",
          "ingestStatus"  = EXCLUDED."ingestStatus",
          "fetchedAt"     = NOW(),
          "updatedAt"     = NOW()
  `, [
    documentId,
    DocumentSourceType.ADMINISTRATIVE_GUIDANCE,
    page.pageSlug,
    page.title || page.pageSlug,
    page.canonicalUrl,
    textKey,
    extractedText,
    page.wordCount,
    'browser-crawl',
    orderIndex,
    OperationalIngestStatus.COMPLETE,
  ])
}

async function markDocumentComplete(documentId: string, pageCount: number): Promise<void> {
  await pool.query(`
    UPDATE "OperationalDocument"
    SET "ingestStatus" = $1, "pageCount" = $2, "lastFetchedAt" = NOW(), "updatedAt" = NOW()
    WHERE id = $3
  `, [OperationalIngestStatus.COMPLETE, pageCount, documentId])
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== College of Policing APP — Ingest from browser crawl ===')
  console.log(`Crawl file: ${CRAWL_FILE}`)
  console.log(`Checkpoint: ${CHECKPOINT_FILE}`)
  console.log(`Concurrency: ${CONCURRENCY}`)
  console.log('')

  // ── Load and deduplicate crawl data ──────────────────────────────────────

  console.log('Loading crawl file...')
  const raw: CrawlEntry[] = JSON.parse(fs.readFileSync(CRAWL_FILE, 'utf-8'))
  console.log(`  Raw entries: ${raw.length}`)

  const pages = deduplicateEntries(raw)
  const totalWords = pages.reduce((s, p) => s + p.wordCount, 0)
  console.log(`  After dedup: ${pages.length} unique pages, ${totalWords.toLocaleString()} words`)
  console.log('')

  // ── Checkpoint ───────────────────────────────────────────────────────────

  const cp = loadCheckpoint()
  const completedSet = new Set(cp.completedSlugs)
  const todo = pages.filter(p => !completedSet.has(p.pageSlug))
  console.log(`Checkpoint: ${completedSet.size} already complete, ${todo.length} to process`)
  console.log('')

  // ── Ensure OperationalDocument ───────────────────────────────────────────

  initLog()
  console.log('Upserting OperationalDocument...')
  const documentId = await ensureDocument()
  console.log(`  Document ID: ${documentId}`)
  console.log('')

  // ── Process pages concurrently ───────────────────────────────────────────

  let done = 0
  let errors = 0
  const startTime = Date.now()

  // Checkpoint saves are serialised through this mutex flag to avoid concurrent file writes
  let checkpointPending = false
  const pendingCompletions: string[] = []

  async function flushCheckpoint(): Promise<void> {
    if (pendingCompletions.length === 0) return
    const batch = pendingCompletions.splice(0)
    cp.completedSlugs.push(...batch)
    saveCheckpoint(cp)
  }

  await processConcurrently(todo, CONCURRENCY, async (page, i) => {
    const orderIndex = completedSet.size + i   // global order across resume runs
    const textKey = `${R2_PREFIX}/${page.pageSlug}/main.text`

    try {
      // R2 upload
      await r2Put(textKey, page.text, 'text/plain')

      // DB upsert
      await upsertSection({ documentId, page, textKey, orderIndex })

      done++
      pendingCompletions.push(page.pageSlug)
      logEntry(page.pageSlug, page.wordCount, textKey, 'ok')

      // Progress every 50 completions
      if (done % 50 === 0) {
        const elapsed = (Date.now() - startTime) / 1000
        const rate = Math.round(done / elapsed * 60)
        console.log(`  ${done}/${todo.length} done (${rate}/min) — ${page.pageSlug}`)
        if (!checkpointPending) {
          checkpointPending = true
          // Flush after a brief yield so we batch completions from concurrent workers
          setTimeout(async () => {
            await flushCheckpoint()
            checkpointPending = false
          }, 100)
        }
      }
    } catch (err: any) {
      errors++
      const msg = String(err?.message ?? err)
      console.error(`  ✗ ${page.pageSlug}: ${msg}`)
      logEntry(page.pageSlug, page.wordCount, textKey, `error: ${msg.slice(0, 80)}`)
    }
  })

  // Final checkpoint flush
  await flushCheckpoint()

  console.log('')
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`Processed: ${done} ok, ${errors} errors — ${elapsed}s`)

  // ── Mark document complete ────────────────────────────────────────────────

  const totalComplete = cp.completedSlugs.length
  if (errors === 0) {
    console.log(`Marking OperationalDocument COMPLETE (pageCount=${totalComplete})...`)
    await markDocumentComplete(documentId, totalComplete)
    console.log('  ✓ Done')
  } else {
    console.warn(`  ⚠ ${errors} errors — document left as IN_PROGRESS; re-run to resume`)
  }

  // ── Final DB counts ───────────────────────────────────────────────────────

  console.log('')
  const countRes = await pool.query(
    'SELECT COUNT(*) FROM "OperationalSection" WHERE "operationalDocumentId" = $1',
    [documentId]
  )
  const sectionCount = parseInt(countRes.rows[0].count, 10)
  const wRes = await pool.query(
    'SELECT SUM("wordCount") FROM "OperationalSection" WHERE "operationalDocumentId" = $1',
    [documentId]
  )
  const wordSum = parseInt(wRes.rows[0].sum ?? '0', 10)

  console.log('=== Final DB counts ===')
  console.log(`  OperationalDocument:  1  (id: ${documentId})`)
  console.log(`  OperationalSections: ${sectionCount}`)
  console.log(`  Total words in DB:   ${wordSum.toLocaleString()}`)

  await pool.end()
}

main().catch(err => {
  console.error('\n✗ Fatal:', err.message ?? err)
  process.exit(1)
})
