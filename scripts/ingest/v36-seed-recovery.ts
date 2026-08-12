/**
 * v36-seed-recovery.ts — V36 §2: seed the recovery work list into `ingest_queue`.
 *
 * This is deliberately NOT new machinery. The work list is instruments the source
 * publishes and the corpus does not hold; the route that fetches an instrument from
 * legislation.gov.uk already exists (`sourceType: 'tna-legislation'`, docId = the
 * canonical id), already writes R2 + corpus_sections, and already runs on the
 * Railway Ingest workers under the TNA politeness budget. So the sprint's job is to
 * produce a correct list and hand it to that route.
 *
 * WHICH ID GETS FETCHED. The feed's canonical `docId` — regnal for pre-1963 Acts.
 * Not the calendar id: `ukpga/1924/3` is an HTTP 300 because two Acts are chapter 3
 * of 1924 under different sessions (playbook, V19). The calendar id is carried in
 * the work list for joining, never for fetching.
 *
 * Default is a DRY RUN that prints the prediction and writes nothing. Seeding needs
 * --run, because the prediction has to be in CHANGE_LOG before the work starts and
 * scored after it (playbook: predict-measure-commit).
 *
 * Usage:
 *   tsx v36-seed-recovery.ts                 # prediction only
 *   tsx v36-seed-recovery.ts --run [--limit 2000] [--types ukpga] [--priority 3]
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkUpsertQueueRows } from './shared/queue-client'

const WORK_PATH = path.join(__dirname, 'v36', 'worklist.jsonl')

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}
const RUN = process.argv.includes('--run')
const LIMIT = arg('limit') ? Number(arg('limit')) : null
const TYPES = arg('types')?.split(',').filter(Boolean) ?? null
const PRIORITY = Number(arg('priority') ?? 3)

/**
 * ADDENDUM_V36_SEED_ORDER §1: seed in DESCENDING citation-reference order.
 *
 * The reason is not speed. A run of 41,913 instruments will be interrupted — a
 * laptop closing, a throttle, a failure — and **the order determines what we have
 * when that happens**. In citation order an interruption at 10% leaves the corpus
 * holding the instruments the rest of the corpus most often refers to. In any other
 * order it leaves an arbitrary tenth.
 *
 * ⚠ THE FILE'S SORT ORDER IS NOT THE CLAIM ORDER. `claimRow` is
 * `ORDER BY priority ASC, id ASC` — so sorting the work list and seeding it at a
 * flat priority would have produced exactly the arbitrary tenth this is meant to
 * avoid, while looking correct in the log. Citation rank is therefore encoded INTO
 * `priority`: bands of BAND_SIZE instruments, band 1 the most-referenced.
 *
 * ⚠ Uncited instruments are seeded LAST, NOT NEVER (addendum §1). The value of
 * fetching a Georgian local Act is not its text, which does not exist; it is that a
 * silent absence becomes a classified known unknown.
 */
const CITATION_GAPS = path.join(__dirname, '../../docs/corpus_citation_gaps.json')
const BAND_SIZE = 50

function loadCitationRefs(): Map<string, number> {
  const m = new Map<string, number>()
  if (!fs.existsSync(CITATION_GAPS)) {
    console.warn(`[seed] ⚠ no citation report at ${CITATION_GAPS} — CANNOT seed in citation order`)
    return m
  }
  const d = JSON.parse(fs.readFileSync(CITATION_GAPS, 'utf8'))
  for (const g of d.instruments as { gid: string; ours: number; external: number }[]) {
    m.set(g.gid, g.ours + g.external)
  }
  return m
}

interface WorkRow { docId: string; calendarId: string | null; type: string; year: number; corpus: string; reason: string }

/**
 * RECOVERY RATES, STRATIFIED — and the stratification is not fastidiousness, it is
 * the correction to a wrong prediction this file carried until the pilots ran.
 *
 * The first version of this used a single `unseen` rate of 1.0, taken from an n=25
 * sample in which 25 of 25 instruments fetched. That sample was drawn from gap
 * instruments **that have legacy text**, which is a population selected for having
 * text. Run against the actual `unseen` work list, the yield is **0 of 12**: 5,546
 * of the 5,808 ukpga items are 1800–1849 local and personal Acts, which
 * legislation.gov.uk lists and holds no provisions for. A uniform draw over this
 * list measures that one stratum and reports it as the whole.
 *
 * Every rate below carries its denominator. A stratum with no measurement is not
 * given a number — `null` propagates into the output as "unmeasured", because a
 * plausible fill-in is exactly how the 77,000-section figure came to be attached to
 * 17,261 instruments.
 */
interface Stratum { key: string; rate: number | null; n: number; note: string }

/** THE BOUNDARY THAT ORGANISES ALL OF THIS: 1987. legislation.gov.uk holds full
 *  text for instruments from 1987 onwards and metadata only before it. Measured, not
 *  read off a docs page — three pilots either side of it, 0/14 in 1980–1986 and
 *  12/12 in 1987+, which is as clean as a boundary gets. */
const DIGITISATION_YEAR = 1987

const STRATA: Stratum[] = [
  // ⚠ RESTATED after the dot-leader retraction. This first read 12/12 at a mean of
  // 16.9 sections. Both figures were carried by uksi/1999/303, which contributed 137
  // of the 203 sections and every one of them was a repealed provision's dot leaders.
  // With those retracted the instrument holds nothing, so it is not a recovery, and
  // the mean it was inflating goes with it. Re-derived from corpus_sections rather
  // than from the counter that could not know what it had counted.
  { key: 'unseen:1987+', rate: 11 / 12, n: 12,
    note: '11/12, mean 5.8 REAL sections — never enumerated, available. THE recoverable population' },
  { key: 'unseen:pre-1987', rate: 0.0, n: 26,
    note: '0/26 (0/14 uksi 1980-86 · 0/12 uksi pre-1980) — CLML fetched, declares 0 provisions' },
  { key: 'unseen:ukpga:pre-1850', rate: 0.0, n: 12,
    note: '0/12 — Georgian local & personal Acts; same shape, listed separately as it is 95% of the ukpga list' },
  { key: 'classb:ukpga', rate: 2 / 12, n: 12,
    note: '2/12 — and both retracted their stale marker, as designed' },
  { key: 'classb:*', rate: 0.275, n: 40,
    note: '11/40 across uksi 5/6 · ssi 2/3 · eudn 1/4 · nisr 1/6 · eur 2/21' },
]

function rateFor(reason: string, type: string, year: number): Stratum {
  if (reason === 'classb') return type === 'ukpga' ? STRATA[3] : STRATA[4]
  if (type === 'ukpga' && year < 1850) return STRATA[2]
  return year >= DIGITISATION_YEAR ? STRATA[0] : STRATA[1]
}

/**
 * Sections per instrument that yields text — REAL sections, counted out of
 * corpus_sections after the dot-leader retraction, across all 51 instruments the
 * V36 pilots touched: 71 real sections over 13 instruments with text = 5.5 overall;
 * 64 over 11 for uksi 1987+ = 5.8; 7 over 2 for ukpga class (b) = 3.5.
 *
 * ⚠ The high end is 29.5 and comes from the mixed-type class (b) pilot, which was
 * measured BEFORE the retraction existed and has not been re-read. It is kept as the
 * top of the range and labelled, not quietly dropped and not quietly trusted.
 */
const SECTIONS_PER_RECOVERED_LOW = 3.5
const SECTIONS_PER_RECOVERED_MID = 5.8
const SECTIONS_PER_RECOVERED_HIGH = 29.5

async function main() {
  if (!fs.existsSync(WORK_PATH)) throw new Error(`no work list at ${WORK_PATH} — run v36-reconcile.ts first`)
  let rows: WorkRow[] = fs.readFileSync(WORK_PATH, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  if (TYPES) rows = rows.filter(r => TYPES.includes(r.type))

  // Citation ordering, before any LIMIT — so a capped run takes the TOP of the
  // citation queue rather than the top of the file.
  const refs = loadCitationRefs()
  const refsFor = (r: WorkRow) => refs.get(r.docId) ?? (r.calendarId ? refs.get(r.calendarId) ?? 0 : 0)
  rows.sort((a, b) => refsFor(b) - refsFor(a) || (a.docId < b.docId ? -1 : a.docId > b.docId ? 1 : 0))
  const cited = rows.filter(r => refsFor(r) > 0).length

  if (LIMIT) rows = rows.slice(0, LIMIT)

  const byReason: Record<string, number> = {}
  const byCorpus: Record<string, number> = {}
  for (const r of rows) {
    byReason[r.reason] = (byReason[r.reason] ?? 0) + 1
    byCorpus[r.corpus] = (byCorpus[r.corpus] ?? 0) + 1
  }

  // Expected yield, per stratum, with the unmeasured part kept SEPARATE rather than
  // folded in at some assumed rate.
  const byStratum = new Map<string, { n: number; s: Stratum }>()
  for (const r of rows) {
    const s = rateFor(r.reason, r.type, r.year)
    const e = byStratum.get(s.key) ?? { n: 0, s }
    e.n++
    byStratum.set(s.key, e)
  }
  let expectedInstruments = 0
  let unmeasuredInstruments = 0
  for (const { n, s } of byStratum.values()) {
    if (s.rate === null) unmeasuredInstruments += n
    else expectedInstruments += n * s.rate
  }

  // Wall clock: the TNA budget is 200ms between requests across 10 concurrent
  // workers, and an instrument costs ~3 requests (data.xml, effects feed, and the
  // fallbacks when the first two are empty). That is the fleet's rate, not one
  // worker's — 10 workers × 5 rows/s each is not achievable, the 200ms is the
  // shared interval, so the honest figure is ~5 instruments/s fleet-wide.
  const REQ_PER_INSTRUMENT = 3
  const FLEET_REQ_PER_SEC = 5
  const wallClockMin = (rows.length * REQ_PER_INSTRUMENT) / FLEET_REQ_PER_SEC / 60

  console.log('\n=== V36 §2 PREDICTION (record this in CHANGE_LOG before the run) ===\n')
  console.log(`work list                 : ${rows.length.toLocaleString()} instruments`)
  console.log(`  seed order              : DESCENDING citation references (addendum §1), encoded into priority`)
  console.log(`                            bands of ${BAND_SIZE}; ${cited.toLocaleString()} carry >=1 reference, ` +
    `${(rows.length - cited).toLocaleString()} uncited and seeded LAST (not never)`)
  console.log(`  first five              : ${rows.slice(0, 5).map(r => `${r.docId}(${refsFor(r)})`).join(' · ')}`)
  console.log(`  by reason               : ${Object.entries(byReason).map(([k, v]) => `${k} ${v.toLocaleString()}`).join(' · ')}`)
  console.log(`  by corpus               : ${Object.entries(byCorpus).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toLocaleString()}`).join(' · ')}`)
  console.log('\nby stratum (every rate carries its denominator):')
  for (const { n, s } of [...byStratum.values()].sort((a, b) => b.n - a.n)) {
    const r = s.rate === null ? 'UNMEASURED' : `${(s.rate * 100).toFixed(1)}% (n=${s.n})`
    console.log(`  ${s.key.padEnd(24)} ${n.toLocaleString().padStart(7)} instruments  ${r.padEnd(16)} ${s.note}`)
  }
  console.log(`\nexpected to yield text    : ${Math.round(expectedInstruments).toLocaleString()} instruments from the measured strata`)
  if (unmeasuredInstruments) {
    console.log(`⚠ UNMEASURED              : ${unmeasuredInstruments.toLocaleString()} instruments have no pilot behind them.`)
    console.log(`                            Pilot those strata before quoting a total, or the total is a guess wearing a number.`)
  }
  console.log(`expected sections written : ~${Math.round(expectedInstruments * SECTIONS_PER_RECOVERED_MID).toLocaleString()} ` +
    `(central estimate at ${SECTIONS_PER_RECOVERED_MID}/instrument, the 1987+ pilot's own mean; ` +
    `range ${Math.round(expectedInstruments * SECTIONS_PER_RECOVERED_LOW).toLocaleString()}–` +
    `${Math.round(expectedInstruments * SECTIONS_PER_RECOVERED_HIGH).toLocaleString()} across strata)`)
  console.log(`every instrument fetched  : gets a classified marker either way — an unseen instrument becomes a KNOWN unknown,`)
  console.log(`                            which is §2's "classify every gap" and is most of the value at these rates`)
  console.log(`expected wall clock       : ${wallClockMin < 90 ? `${wallClockMin.toFixed(0)} min` : `${(wallClockMin / 60).toFixed(1)} h`} at the TNA budget`)
  console.log(`fetch cost                : £0 — legislation.gov.uk is OGL v3.0 and free; the spend is R2 writes and the later embed`)
  console.log(`R2 Class A writes         : ~${Math.round(expectedInstruments * SECTIONS_PER_RECOVERED_LOW * 2).toLocaleString()}–` +
    `${Math.round(expectedInstruments * SECTIONS_PER_RECOVERED_HIGH * 2).toLocaleString()} (raw + compiled per section)`)

  if (!RUN) {
    console.log('\n[seed] DRY RUN — nothing written. Re-run with --run to seed the queue.')
    await endNeonPool()
    return
  }

  const queueRows = rows.map((r, i) => ({
    id: `${r.corpus}:${r.docId}`,
    corpus: r.corpus,
    docId: r.docId,
    sourceType: 'tna-legislation',
    // Citation rank encoded into the claim key. Band 1 is the most-referenced.
    priority: PRIORITY + Math.floor(i / BAND_SIZE),
  }))
  const inserted = await bulkUpsertQueueRows(queueRows)

  // Reconcile the seed itself. bulkUpsertQueueRows is ON CONFLICT DO NOTHING, so
  // `inserted` < `queueRows.length` whenever a row already existed — which is a
  // fact worth printing rather than a discrepancy to explain later.
  const { rows: [check] } = await getNeonPool().query(
    `SELECT count(*)::int AS n, count(*) FILTER (WHERE status='pending')::int AS pending
     FROM ingest_queue WHERE "sourceType" = 'tna-legislation'`)
  console.log(`\n[seed] inserted ${inserted.toLocaleString()} new rows of ${queueRows.length.toLocaleString()} offered`)
  console.log(`[seed] ingest_queue now holds ${check.n.toLocaleString()} tna-legislation rows, ${check.pending.toLocaleString()} pending`)
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exitCode = 1 })
