/**
 * v22-seed-writtenevidence-windows.ts — V22 §1.1: date-windowed WrittenEvidence
 * listing rows, replacing the V20 offset walk.
 *
 * ⚠️ RUN ONLY AFTER THE V22 PUSH (windowed list: form needs the new
 * processCommitteesApiList — playbook §8: seed-after-push).
 *
 * Why: the API 500s server-side on deep global offsets (~31s timeout;
 * skip=100000 on 12 Jun, skip=50000 on 13 Jun — load-dependent). Within a
 * date window Skip stays shallow and answers in ~2s. Monthly windows are
 * ≤ ~2k items (peak year 2025 = 16,393); one row walks one window.
 *
 * Coverage: pre2013 catch-all (2012 holds 108, 2008 none) + monthly
 * 2013-01..current month. Full-range re-walk is deliberate: item inserts are
 * ON CONFLICT DO NOTHING, and it self-heals any gaps left by the three
 * aborted V20 offset walks.
 */
import { endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'

async function main() {
  const rows = [{
    id: 'committees-evidence:list:writtenevidence:win:pre2013',
    corpus: 'committees-evidence',
    docId: 'list:writtenevidence:win:pre2013',
    sourceType: 'committees-api',
    priority: 1, // listing before items — windows feed the item backlog
  }]
  const now = new Date()
  const endY = now.getUTCFullYear(); const endM = now.getUTCMonth() + 1
  for (let y = 2013; y <= endY; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === endY && m > endM) break
      const win = `${y}-${String(m).padStart(2, '0')}`
      rows.push({
        id: `committees-evidence:list:writtenevidence:win:${win}`,
        corpus: 'committees-evidence',
        docId: `list:writtenevidence:win:${win}`,
        sourceType: 'committees-api',
        priority: 1,
      })
    }
  }
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`[seed] ${affected} of ${rows.length} window rows (pre2013 + 2013-01..${endY}-${String(endM).padStart(2, '0')})`)
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
