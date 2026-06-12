/**
 * seed-tax-tribunals-queue.ts — V20 probe 2: historic + current tax tribunal
 * decisions from financeandtax.decisions.tribunals.gov.uk.
 *
 * ⚠️ RUN ONLY AFTER THE V20 PUSH (sourceType 'tax-tribunals' unknown to the
 * pre-V20 deployed code — playbook §8: seed-after-push).
 *
 * The id space is dense (1..max, gaps classify as markers). Max id found by
 * binary search at seed time so the seed stays current; was 13,037 on
 * 12 Jun 2026 (TC 09248, decided 11 Jun 2024).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { fetchTaxTribunalDecision } from './sources/tax-tribunals'

const CORPUS = 'tax-tribunals'

async function findMaxId(): Promise<number> {
  // exponential then binary search on "does this id resolve at all"
  const exists = async (id: number) => {
    const d = await fetchTaxTribunalDecision(id)
    return d !== null && !d.empty
  }
  let lo = 13000 // known-populated floor (12 Jun 2026)
  if (!(await exists(lo))) lo = 1
  let hi = lo * 2
  while (await exists(hi)) { lo = hi; hi *= 2; if (hi > 1_000_000) throw new Error('max-id search runaway') }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (await exists(mid)) lo = mid; else hi = mid
  }
  return lo
}

async function main() {
  const canaryArg = process.argv.indexOf('--canary')
  const canary = canaryArg >= 0 ? Number(process.argv[canaryArg + 1] ?? 25) : 0

  const pool = getNeonPool()
  const maxId = canary ? canary : await findMaxId()
  console.log(`[seed] tax-tribunals ids 1..${maxId}${canary ? ' (CANARY)' : ''}`)

  const rows = Array.from({ length: maxId }, (_, i) => ({
    id: `${CORPUS}:${i + 1}`,
    corpus: CORPUS,
    docId: String(i + 1),
    sourceType: 'tax-tribunals',
    priority: 2,
  }))
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`[seed] ${affected} new queue rows`)

  if (!canary) {
    await pool.query(`
      INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, blocked, blocked_reason)
      VALUES ($1, 'Tax Tribunals (VAT&D/SpC/FTT-TC)', $2, false, false, NULL)
      ON CONFLICT (corpus_key) DO UPDATE SET est_sections = EXCLUDED.est_sections, blocked = false, blocked_reason = NULL
    `, [CORPUS, maxId])
    console.log(`[targets] ${CORPUS} est=${maxId}`)
  }
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
