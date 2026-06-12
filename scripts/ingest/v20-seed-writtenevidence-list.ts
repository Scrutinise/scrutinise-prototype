/**
 * v20-seed-writtenevidence-list.ts — V20: queue-driven WrittenEvidence listing.
 *
 * ⚠️ RUN ONLY AFTER THE list: HOTFIX PUSH (processCommitteesApiList).
 *
 * The API cut the local IP's WrittenEvidence walk at ~2,700 of 126,589 across
 * three runs. Seeds one list:writtenevidence:{skip} row per 100-item page from
 * skip 2700 — Railway claim loops do the listing within the source budget;
 * each list row inserts that page's item rows.
 */
import { endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'

const TOTAL = 126_589
const START = 2_700

async function main() {
  const rows = []
  for (let skip = START; skip < TOTAL; skip += 100) {
    rows.push({
      id: `committees-evidence:list:writtenevidence:${skip}`,
      corpus: 'committees-evidence',
      docId: `list:writtenevidence:${skip}`,
      sourceType: 'committees-api',
      priority: 2,
    })
  }
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`[seed] ${affected} list rows (skip ${START}..${TOTAL})`)
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
