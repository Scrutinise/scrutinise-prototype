/**
 * seed-committees-publications.ts — LOCAL RUN ONLY (Charlie's machine).
 *
 * WHY local + curl: committees.parliament.uk blocks Node.js Undici via Cloudflare TLS
 * fingerprinting, even with correct browser headers. curl's TLS fingerprint passes.
 * This seeder uses execFileSync(curl) for listing pages, then workers fetch documents
 * from publications.parliament.uk (also via curl — see fetchPublicationHtml in
 * committees-portal.ts).
 *
 * Queue row format:
 *   id         = "committees-document:{pubId}:{docId}"
 *   corpus     = "committees-reports" | "committees-evidence"
 *   docId      = full publications.parliament.uk HTML URL
 *   sourceType = "committees-document"
 *   priority   = 3
 *
 * Run (Charlie's machine only):
 *   NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
 *     --tsconfig scripts/tsconfig.json \
 *     scripts/ingest/seed-committees-publications.ts
 *
 * Safe to re-run — ON CONFLICT DO NOTHING + page checkpoint.
 * After completion, retire old committees-portal rows (SQL printed at end).
 */
import { spawnSync } from 'child_process'
import { Pool } from 'pg'
import path from 'path'
import fs from 'fs'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}

import { parsePublicationCards, CommitteePublicationType } from './sources/committees-portal'
import { bulkUpsertQueueRows } from './shared/queue-client'

const CHECKPOINT_FILE = path.join(__dirname, 'seed-committees-checkpoint.json')
const PAGE_DELAY_MS   = 1500   // 1.5s between listing page fetches — matches proven bash test pace
const FLUSH_EVERY     = 200    // batch insert every 200 rows

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// WHY cookie jar: Cloudflare tracks session continuity via parliament.uk session cookies.
// Without a persistent cookie jar, each request looks like a fresh bot and CF challenges
// after the first page. With -c/-b curl maintains the session cookie across all requests
// and CF sees a continuous browser-like session. No CF_CLEARANCE or manual steps needed.
const COOKIE_JAR = path.join(__dirname, 'seed-committees-cookies.txt')

function curlFetch(url: string): string {
  const r = spawnSync('curl', [
    '-s', '--max-time', '20',
    '-c', COOKIE_JAR, '-b', COOKIE_JAR,
    '-A', BROWSER_UA,
    '-H', 'Accept: text/html,application/xhtml+xml',
    '-H', 'Accept-Language: en-GB,en;q=0.9',
    url,
  ], { encoding: 'utf8', timeout: 25_000, maxBuffer: 5 * 1024 * 1024 })
  if (r.error) throw r.error
  if (r.status !== 0) throw new Error(`curl exited ${r.status} for ${url}`)
  if (r.stdout.length < 200) throw new Error(`curl response too short (${r.stdout.length}b) for ${url}`)
  if (r.stdout.includes('Just a moment') || r.stdout.includes('Enable JavaScript and cookies')) {
    throw new Error(`CF challenge page returned for ${url} — try again after a short wait`)
  }
  return r.stdout
}

interface TypeCheckpoint { lastPage: number; inserted: number }
interface SeedCheckpoint {
  'reports-responses': TypeCheckpoint
  'other-publications': TypeCheckpoint
}

function loadCheckpoint(): SeedCheckpoint {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8')) }
  catch { return { 'reports-responses': { lastPage: 0, inserted: 0 }, 'other-publications': { lastPage: 0, inserted: 0 } } }
}
function saveCheckpoint(cp: SeedCheckpoint) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2))
}

const TYPE_TO_CORPUS: Record<CommitteePublicationType, string> = {
  'reports-responses': 'committees-reports',
  'other-publications': 'committees-evidence',
}

// Confirmed page counts from V15 live probe (9 Jun 2026).
const MAX_PAGES: Record<CommitteePublicationType, number> = {
  'reports-responses': 498,
  'other-publications': 2040,
}

const BASE_URL = 'https://committees.parliament.uk'

async function seedType(type: CommitteePublicationType, cp: SeedCheckpoint): Promise<number> {
  const corpus = TYPE_TO_CORPUS[type]
  const maxPage = MAX_PAGES[type]
  let { lastPage, inserted } = cp[type]
  const startPage = lastPage + 1

  console.log(`\n[seed] ${type}: pages ${startPage}–${maxPage}  (${inserted} already inserted)`)

  const pending: Parameters<typeof bulkUpsertQueueRows>[0] = []
  let consecutiveEmpty = 0

  async function flush() {
    if (pending.length === 0) return
    const n = await bulkUpsertQueueRows([...pending])
    inserted += n
    pending.length = 0
    cp[type].inserted = inserted
    saveCheckpoint(cp)
  }

  for (let page = startPage; page <= maxPage; page++) {
    const url = `${BASE_URL}/publications/${type}/?page=${page}`
    let html: string
    try {
      html = curlFetch(url)
    } catch (err) {
      // Retry once after a longer wait before skipping — handles transient CF challenges
      console.warn(`[seed] ${type} p${page}: curl failed (${err}) — retrying in 8s`)
      await new Promise(r => setTimeout(r, 8_000))
      try {
        html = curlFetch(url)
      } catch (err2) {
        console.warn(`[seed] ${type} p${page}: retry also failed — skipping`)
        cp[type].lastPage = page
        saveCheckpoint(cp)
        await new Promise(r => setTimeout(r, PAGE_DELAY_MS))
        continue
      }
    }

    const pubs = parsePublicationCards(html, type)

    if (pubs.length === 0) {
      consecutiveEmpty++
      if (consecutiveEmpty >= 2) {
        console.log(`[seed] ${type}: 2 consecutive empty pages at p${page} — done`)
        break
      }
      cp[type].lastPage = page
      saveCheckpoint(cp)
      await new Promise(r => setTimeout(r, PAGE_DELAY_MS))
      continue
    }
    consecutiveEmpty = 0

    for (const pub of pubs) {
      if (!pub.htmlUrl) continue  // skip PDF-only; can be added to specialist_queue later
      pending.push({
        id:         `committees-document:${pub.pubId}:${pub.docId}`,
        corpus,
        docId:      pub.htmlUrl,   // full publications.parliament.uk URL
        sourceType: 'committees-document',
        priority:   3,
      })
    }

    if (pending.length >= FLUSH_EVERY) await flush()

    cp[type].lastPage = page
    saveCheckpoint(cp)

    if (page % 100 === 0 || page === maxPage) {
      console.log(`[seed] ${type}: p${page}/${maxPage} — ${inserted + pending.length} rows so far`)
    }

    await new Promise(r => setTimeout(r, PAGE_DELAY_MS))
  }

  await flush()
  console.log(`[seed] ${type}: complete — ${inserted} rows inserted`)
  return inserted
}

async function main() {
  console.log('[seed-committees] Per-document seeder — curl session cookie bypass')

  // Verify curl is available
  const v = spawnSync('curl', ['--version'], { encoding: 'utf8', timeout: 5000 })
  if (v.error || v.status !== 0) {
    console.error('[seed-committees] ERROR: curl not found in PATH — required for Cloudflare bypass')
    process.exit(1)
  }

  const cp = loadCheckpoint()

  // Register rate limit for committees-document on Neon
  const neon = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 })
  await neon.query(`
    INSERT INTO source_rate_limits ("sourceKey","intervalMs","maxConcurrentWorkers","updatedAt")
    VALUES ('committees-document', 300, 5, NOW())
    ON CONFLICT ("sourceKey") DO UPDATE
      SET "intervalMs" = 300, "maxConcurrentWorkers" = 5, "updatedAt" = NOW()
  `)
  console.log('[seed-committees] Rate limit registered: committees-document 300ms / 5 workers')
  await neon.end()

  const reportsN  = await seedType('reports-responses', cp)
  const evidenceN = await seedType('other-publications', cp)
  const total = reportsN + evidenceN

  console.log(`\n[seed-committees] ══ COMPLETE ══`)
  console.log(`  committees-reports  (HTML docs): ${reportsN.toLocaleString()}`)
  console.log(`  committees-evidence (HTML docs): ${evidenceN.toLocaleString()}`)
  console.log(`  Total inserted: ${total.toLocaleString()}`)
  console.log()
  console.log('Next: retire old page-level rows (run on Neon):')
  console.log("  UPDATE ingest_queue SET status='done',")
  console.log("    \"lastError\"='retired V16 — replaced by committees-document rows'")
  console.log("  WHERE \"sourceType\"='committees-portal'")
  console.log("    AND corpus IN ('committees-reports','committees-evidence');")

  try { fs.unlinkSync(CHECKPOINT_FILE) } catch {}
  try { fs.unlinkSync(COOKIE_JAR) } catch {}
}

main().catch(e => { console.error('[seed-committees] fatal:', e); process.exit(1) })
