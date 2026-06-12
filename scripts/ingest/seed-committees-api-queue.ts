/**
 * seed-committees-api-queue.ts — V20 probe 1: seed committee publications +
 * evidence via the Committees API (committees-api.parliament.uk).
 *
 * ⚠️ RUN ONLY AFTER THE V20 PUSH — rows carry sourceType 'committees-api',
 * which the pre-V20 deployed code markSkips (playbook §8: seed-after-push).
 *
 * Canary first (Railway egress to the API host is unverified — the old portal
 * CF-blocks datacentre IPs):
 *   tsx seed-committees-api-queue.ts --canary 25
 * Verify sections appear, then full run:
 *   tsx seed-committees-api-queue.ts
 *
 * Universe measured 12 Jun 2026: Publications 50,846 · OralEvidence 15,803 ·
 * WrittenEvidence 126,589 = 193,238 items. Checkpointed per endpoint+page.
 */
import * as fs from 'fs'
import * as path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { listCommitteesApiPage, CommitteesApiKind } from './sources/committees-api'

const CHECKPOINT = path.join(__dirname, 'seed-committees-api-checkpoint.json')
const TAKE = 100

const KINDS: Array<{ kind: CommitteesApiKind; key: string; corpus: string }> = [
  { kind: 'Publications', key: 'publication', corpus: 'committees-reports' },
  { kind: 'OralEvidence', key: 'oralevidence', corpus: 'committees-evidence' },
  { kind: 'WrittenEvidence', key: 'writtenevidence', corpus: 'committees-evidence' },
]

async function main() {
  const canaryArg = process.argv.indexOf('--canary')
  const canary = canaryArg >= 0 ? Number(process.argv[canaryArg + 1] ?? 25) : 0

  const pool = getNeonPool()
  const ckpt: Record<string, number> = !canary && fs.existsSync(CHECKPOINT)
    ? JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) : {}

  let grandTotal = 0
  const universe: Record<string, number> = {}

  for (const { kind, key, corpus } of KINDS) {
    let skip = ckpt[kind] ?? 0
    let total = Infinity
    let seeded = 0
    while (skip < total) {
      // The API rate-limits sustained listing walks — retry after cooling
      // instead of aborting (V20: runs stalled on single transient failures).
      let page = await listCommitteesApiPage(kind, skip, canary ? Math.min(canary, TAKE) : TAKE)
      for (let attempt = 1; !page && attempt <= 3; attempt++) {
        console.warn(`[seed] ${kind} skip=${skip}: fetch failed — cooling 60s (retry ${attempt}/3)`)
        await new Promise(r => setTimeout(r, 60_000))
        page = await listCommitteesApiPage(kind, skip, canary ? Math.min(canary, TAKE) : TAKE)
      }
      if (!page) {
        console.warn(`[seed] ${kind} skip=${skip}: still failing — stopping (checkpoint saved, rerun to resume)`)
        break
      }
      total = page.totalResults
      universe[kind] = total
      const rows = page.items.map(it => ({
        id: `${corpus}:${key}:${it.id}`,
        corpus,
        docId: `${key}:${it.id}`,
        sourceType: 'committees-api',
        priority: 2,
      }))
      const { affected } = await bulkInsertQueueRows(rows)
      seeded += affected
      skip += page.items.length
      if (!canary) {
        ckpt[kind] = skip
        fs.writeFileSync(CHECKPOINT, JSON.stringify(ckpt))
      }
      if (skip % 2000 < TAKE) console.log(`[seed] ${kind}: ${skip}/${total} (+${seeded} new rows)`)
      if (canary) break
      if (page.items.length === 0) break
    }
    console.log(`[seed] ${kind} done: ${seeded} new rows (universe ${universe[kind] ?? '?'})`)
    grandTotal += seeded
  }

  if (!canary) {
    // Re-baseline corpus_targets with the measured universes (item-level;
    // est_is_confirmed stays false until the queue drains — playbook §1c).
    // Only update when the universe is FULLY known for the target — a stalled
    // run must not clobber the est with a partial sum (V20 bug: an aborted
    // WrittenEvidence walk wrote evidence est=15,809 instead of 142,397).
    const reports = universe['Publications'] ?? 0
    if (reports > 0) await pool.query(
      `UPDATE corpus_targets SET est_sections=$1, est_is_confirmed=false, blocked=false, blocked_reason=NULL WHERE corpus_key='committees-reports'`, [reports])
    if (universe['OralEvidence'] && universe['WrittenEvidence']) {
      const evidence = universe['OralEvidence'] + universe['WrittenEvidence']
      await pool.query(
        `UPDATE corpus_targets SET est_sections=$1, est_is_confirmed=false, blocked=false, blocked_reason=NULL WHERE corpus_key='committees-evidence'`, [evidence])
      console.log(`[targets] committees-evidence est=${evidence}`)
    }
    if (reports > 0) console.log(`[targets] committees-reports est=${reports}`)
  }

  console.log(`[seed] total new rows: ${grandTotal}${canary ? ' (CANARY)' : ''}`)
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
