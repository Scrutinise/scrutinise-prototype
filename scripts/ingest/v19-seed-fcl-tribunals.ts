/**
 * v19-seed-fcl-tribunals.ts — V19 §4: extend Find Case Law coverage to the
 * tribunal courts FCL now publishes, into the existing tna-caselaw corpus
 * (R2 caselaw keys are citation-based, so re-encountered judgments dedup free).
 *
 * Per-court feeds are required: the global atom feed only carries tribunals'
 * newest entries (corpus held eat 787 / ukut 2,686 / ukftt 4,325 / ukpc 700 /
 * ipt 8 on 11 Jun 2026 vs per-court universes of ~44k).
 *
 * rel="last" is phantom on per-court feeds too (eat says 80, page 80 is empty)
 * — binary-search the true last non-empty page, the V4 pattern.
 *
 * Also retires bailii-eat / bailii-tribunals / bailii-privy-ni (superseded by
 * these feeds + the et-decisions gov.uk corpus). NI courts stay parked — FCL
 * excludes them.
 *
 * Politeness: FCL took the 99.6% run happily — existing tna-caselaw rate
 * (200ms / 4 loops) unchanged.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'

const UA = 'Scrutinise-Ingest/1.0 (Open Justice; contact: cl@scrutinise.org)'
const ATOM = 'https://caselaw.nationalarchives.gov.uk/atom.xml'
const COURTS = ['eat', 'ukut/tcc', 'ukut/iac', 'ukut/lc', 'ukut/aac', 'ukftt/tc', 'ukftt/grc', 'ukpc', 'ukiptrib']

async function pageInfo(court: string, page: number): Promise<{ entries: number; relLast: number }> {
  const res = await fetch(`${ATOM}?court=${encodeURIComponent(court)}&page=${page}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) return { entries: 0, relLast: 0 }
  const xml = await res.text()
  const entries = (xml.match(/<entry>/g) ?? []).length
  const lastM = /page=(\d+)" rel="last"/.exec(xml)
  await new Promise(r => setTimeout(r, 300))
  return { entries, relLast: lastM ? parseInt(lastM[1], 10) : 0 }
}

// True last non-empty page: claimed rel=last is an upper bound only.
async function trueLastPage(court: string): Promise<number> {
  const first = await pageInfo(court, 1)
  if (first.entries === 0) return 0
  let lo = 1                      // known non-empty
  let hi = Math.max(first.relLast, 1)
  if (hi === 1) return 1
  if ((await pageInfo(court, hi)).entries > 0) return hi
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if ((await pageInfo(court, mid)).entries > 0) lo = mid
    else hi = mid
  }
  return lo
}

async function main() {
  const pool = getNeonPool()

  const rows: Array<{ id: string; corpus: string; docId: string; sourceType: string; priority: number }> = []
  let totalPages = 0
  for (const court of COURTS) {
    const last = await trueLastPage(court)
    totalPages += last
    console.log(`${court}: true last page ${last} (~${last * 50} judgments)`)
    for (let p = 1; p <= last; p++) {
      const docId = `court:${court}:page:${p}`
      rows.push({ id: `tna-caselaw:${docId}`, corpus: 'tna-caselaw', docId, sourceType: 'tna-caselaw', priority: 2 })
    }
  }

  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`\nseeded ${affected} page rows (${totalPages} pages enumerated)`)

  // tna-caselaw denominator: current sections + upper-bound new docs; re-baseline ✓ at drain.
  const cur = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM corpus_sections WHERE corpus='tna-caselaw'`)
  const existing = parseInt(cur.rows[0].n, 10)
  const already = await pool.query<{ n: string }>(`
    SELECT count(*)::text n FROM corpus_sections WHERE corpus='tna-caselaw'
      AND id ~ 'EAT|UKUT|UKFTT|UKPC|UKIPTrib'`)
  const est = existing - parseInt(already.rows[0].n, 10) + totalPages * 50
  await pool.query(`
    UPDATE corpus_targets SET est_sections = $1, est_is_confirmed = false,
      display_label = 'Find Case Law – TNA (incl. tribunals V19)'
    WHERE corpus_key = 'tna-caselaw'`, [est])
  console.log(`tna-caselaw est_sections -> ~${est} (existing ${existing}, re-baseline ✓ at drain)`)

  for (const [key, reason] of [
    ['bailii-eat', 'retired V19 — EAT now ingested via FCL court feed (tna-caselaw)'],
    ['bailii-tribunals', 'retired V19 — UT/FtT via FCL court feeds (tna-caselaw); ET via et-decisions (gov.uk)'],
    ['bailii-privy-ni', 'retired V19 — Privy Council via FCL (ukpc); NI courts stay parked (FCL excludes them; BAILII contact in progress)'],
  ]) {
    await pool.query(`UPDATE corpus_targets SET retired = true, blocked_reason = $2 WHERE corpus_key = $1`, [key, reason])
  }
  console.log('bailii-eat / bailii-tribunals / bailii-privy-ni retired')

  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
