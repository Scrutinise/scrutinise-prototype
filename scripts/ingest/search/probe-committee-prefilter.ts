/**
 * probe-committee-prefilter.ts — does the broad-fetch-then-client-filter pattern drop real
 * committee matches, INDEPENDENTLY of the ingest gap?
 *
 * This is the question the brief asks to rule in or out explicitly, and it is separable from
 * "are committee conclusions ingested at all" (GOLD_TEST_09). Even with the thin content that
 * exists today, a broad fetch truncated to `limit` before the client-side type filter can
 * discard committee rows that BM25 did retrieve. If it does, that is a second, independent
 * defect and fixing it is worth doing now rather than after any ingest.
 *
 * IT REPRODUCES THE REAL LIVE DEPTH, which the earlier probe did not. The live chain is:
 *     ftsStream(limit=L)  →  runFtsSearch(L)  →  callFts(max(L*3, 30))
 *                         →  rankedSearch(limit=max(L*3,30), k=max(limit*5,100))
 *                         →  SLICE TO max(L*3,30)  →  HTTP  →  client-side type filter
 * so for a stream limit of 20 the client filter sees 60 candidates, not 20. Measuring at 20
 * would overstate the loss; this measures at 60, the number the app actually uses.
 *
 * Arms:
 *   POST-filter (today)  rankedSearch(tier='parliamentary', limit=60) → keep corpus^committees
 *   PRE-filter  (fixed)  rankedSearch(tier='parliamentary', corpora=[committees…], limit=60)
 *
 * Read-only.  Usage: tsx search/probe-committee-prefilter.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch } from './fts-core'
import { draftFor } from './gold-draft-streams'

const COMMITTEE_CORPORA = ['committees-reports', 'committees-evidence']
const STREAM_LIMIT = 20
const LIVE_DEPTH = Math.max(STREAM_LIMIT * 3, 30)   // what callFts actually requests
const isCommittee = (id: string) => id.startsWith('committees')

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)
  console.log(`[prefilter] stream limit ${STREAM_LIMIT} → live retrieval depth ${LIVE_DEPTH}\n`)

  let postTotal = 0, preTotal = 0, recovered = 0
  for (const q of draftFor('committees')) {
    const broad = await rankedSearch(tbl, q.query, { limit: LIVE_DEPTH, tier: 'parliamentary' })
    const post = broad.filter((h) => isCommittee(h.id))

    const pre = await rankedSearch(tbl, q.query, { limit: LIVE_DEPTH, tier: 'parliamentary', corpora: COMMITTEE_CORPORA })

    // Rows the prefilter finds that the post-filter never saw — the actual, measured loss.
    const postIds = new Set(post.map((h) => h.id))
    const missed = pre.filter((h) => !postIds.has(h.id))

    postTotal += post.length; preTotal += pre.length; recovered += missed.length
    console.log(`  ${q.id}: post-filter ${String(post.length).padStart(2)}   prefilter ${String(pre.length).padStart(2)}   dropped-by-truncation ${missed.length}`)
    console.log(`        "${q.query.slice(0, 66)}…"`)
    for (const h of missed.slice(0, 2)) console.log(`        recovered → ${h.id}  ${(h.sectionTitle ?? '').slice(0, 74)}`)

    // Everything the prefilter returns must be in-scope, or the fix has its own bug.
    const leak = pre.filter((h) => !isCommittee(h.id))
    if (leak.length) console.log(`        ⚠ SCOPE LEAK: ${leak.length} non-committee rows, e.g. ${leak[0].id}`)
  }

  console.log(`\n[prefilter] committee rows reaching the client filter: post=${postTotal}  pre=${preTotal}  recovered=${recovered}`)
}

main().catch((e) => { console.error('[prefilter] FATAL', e instanceof Error ? e.stack ?? e.message : e); process.exit(1) })
