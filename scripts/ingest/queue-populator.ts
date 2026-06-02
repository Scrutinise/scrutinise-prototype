/**
 * queue-populator.ts — pre-flight script that enumerates all known document IDs
 * from every corpus source and inserts pending rows into ingest_queue.
 *
 * Run ONCE before workers start:
 *   NODE_PATH=scrutinise-web/node_modules \
 *   scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json \
 *   scripts/ingest/queue-populator.ts
 *
 * Safe to re-run (ON CONFLICT DO NOTHING).  Prints a count summary when done.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { bulkUpsertQueueRows, getQueueCounts, disconnectQueue } from './shared/queue-client'
import { listActIds, WORKER_CORPORA } from './sources/tna-legislation'
import { getTotalJudgments } from './sources/tna-caselaw'
import { HANSARD_PARTITIONS } from './sources/parliament-api'
import { WORKER_DB_SUBSETS } from './sources/bailii-scraper'
import { FCA_KNOWN_SOURCEBOOKS } from './sources/fca-handbook'
import { countUkCases } from './sources/echr-hudoc'
import { AdaptiveThrottle } from './shared/adaptive-throttle'

type QueueRowInput = { id: string; corpus: string; docId: string; sourceType: string; priority: number }

// ── Priority mapping ──────────────────────────────────────────────────────────
// Per corpus plan: 1=highest, 5=lowest

const CORPUS_PRIORITY: Record<string, number> = {
  // Priority 1 — highest value, core legislation + fresh case law
  'primary-acts-2000plus':  1,
  'si-2010plus':            1,
  'tna-caselaw':            1,
  // Priority 2 — important but less urgent
  'primary-acts-pre-2000':  2,
  'si-pre-2010':            2,
  'regional':               2,
  'retained-eu':            2,
  'hansard-commons-a':      2,
  'hansard-commons-b':      2,
  'hansard-lords-a':        2,
  'hansard-lords-b':        2,
  'committees-a':           2,
  'committees-b':           2,
  // Priority 3 — judicial + regulatory
  'bailii-tribunals':       3,
  'bailii-eat':             3,
  'bailii-privy-ni':        3,
  'fca-regulators':         3,
  'echr-hudoc':             3,
  // Priority 4 — international + advisory
  'hmrc-codes-guidance':    4,
  'eur-lex':                4,
  'oecd':                   4,
  // Priority 5 — treaties, misc
  'uk-treaties':            5,
}

function priority(corpus: string): number {
  return CORPUS_PRIORITY[corpus] ?? 5
}

// ── Source type helpers ───────────────────────────────────────────────────────

function sourceType(corpus: string): string {
  if (corpus.startsWith('primary-acts') || corpus.startsWith('si-') ||
      corpus === 'regional' || corpus === 'retained-eu') return 'tna-legislation'
  if (corpus === 'tna-caselaw') return 'tna-caselaw'
  if (corpus.startsWith('bailii')) return 'bailii'
  if (corpus.startsWith('hansard') || corpus.startsWith('committees')) return 'hansard'
  if (corpus === 'fca-regulators') return 'fca'
  if (corpus === 'echr-hudoc') return 'echr'
  if (corpus === 'eur-lex') return 'eurlex'
  if (corpus === 'hmrc-codes-guidance') return 'hmrc'
  if (corpus === 'uk-treaties') return 'treaties'
  if (corpus === 'oecd') return 'oecd'
  return 'other'
}

// ── Populators per source ─────────────────────────────────────────────────────

async function populateTnaLegislation(): Promise<number> {
  let total = 0
  for (const [workerIdStr, config] of Object.entries(WORKER_CORPORA)) {
    const workerId = parseInt(workerIdStr, 10)
    const corpus = workerIdToCorpus(workerId)
    console.log(`[populator] tna-legislation ${corpus}: enumerating ${config.types.join('+')} ${config.yearMin}–${config.yearMax}…`)

    const rows: Array<{ id: string; corpus: string; docId: string; sourceType: string; priority: number }> = []

    for (const type of config.types) {
      const actIds = await listActIds(type, config.yearMin, config.yearMax)
      console.log(`[populator]   ${type}: ${actIds.length} acts`)
      for (const actId of actIds) {
        rows.push({
          id: `${corpus}:${actId}`,
          corpus,
          docId: actId,
          sourceType: 'tna-legislation',
          priority: priority(corpus),
        })
      }
    }

    const inserted = await bulkUpsertQueueRows(rows)
    console.log(`[populator] ${corpus}: ${rows.length} acts → ${inserted} new rows inserted`)
    total += rows.length
  }
  return total
}

function workerIdToCorpus(workerId: number): string {
  const map: Record<number, string> = {
    1: 'primary-acts-pre-2000',
    2: 'primary-acts-2000plus',
    3: 'si-pre-2010',
    4: 'si-2010plus',
    5: 'regional',
    6: 'retained-eu',
  }
  return map[workerId] ?? `worker-${workerId}`
}

async function populateTnaCaselaw(): Promise<number> {
  console.log('[populator] tna-caselaw: getting total judgment count…')
  const total = await getTotalJudgments()
  console.log(`[populator] tna-caselaw: ~${total} judgments expected (from Atom feed page count)`)

  // For caselaw we enumerate the Atom feed page by page
  // Rather than fetching all pages now (slow), we insert placeholder rows
  // by page number. Workers will claim each page and fetch its 50 entries.
  // This is a pragmatic trade-off: we get a pre-flight row count without
  // fetching 374k individual judgment URIs upfront.
  const { AdaptiveThrottle: _t } = await import('./shared/adaptive-throttle')
  const throttle = new (_t)({ floor: 200 })

  // Fetch just enough to get lastPage number
  let lastPage = Math.ceil(total / 50)
  if (lastPage === 0) lastPage = 1

  // Insert one queue row per Atom feed page (each represents ~50 judgments).
  // docId encodes the page number so workers know which page to fetch.
  const rows = []
  for (let page = 1; page <= lastPage; page++) {
    rows.push({
      id: `tna-caselaw:page:${page}`,
      corpus: 'tna-caselaw',
      docId: `page:${page}`,
      sourceType: 'tna-caselaw',
      priority: priority('tna-caselaw'),
    })
  }

  const inserted = await bulkUpsertQueueRows(rows)
  console.log(`[populator] tna-caselaw: ${rows.length} pages → ${inserted} new rows inserted`)
  return rows.length
}

async function populateHansard(): Promise<number> {
  const rows: Array<{ id: string; corpus: string; docId: string; sourceType: string; priority: number }> = []

  // Insert date-range partition rows — workers will paginate the API
  // using the stored startDate/endDate as parameters.
  for (const [workerIdStr, partition] of Object.entries(HANSARD_PARTITIONS)) {
    const workerId = parseInt(workerIdStr, 10)
    const corpus = workerIdToHansardCorpus(workerId)
    if (!corpus) continue

    // Split date range into monthly chunks to allow parallel processing
    const start = new Date(partition.startDate)
    const end = new Date(partition.endDate)

    let current = new Date(start)
    while (current <= end) {
      const monthStart = current.toISOString().slice(0, 10)
      const next = new Date(current)
      next.setMonth(next.getMonth() + 1)
      const monthEnd = new Date(Math.min(next.getTime() - 1, end.getTime()))
        .toISOString().slice(0, 10)

      const docId = `${partition.house.toLowerCase()}:${monthStart}:${monthEnd}`
      rows.push({
        id: `${corpus}:${docId}`,
        corpus,
        docId,
        sourceType: 'hansard',
        priority: priority(corpus),
      })

      current = next
    }
  }

  const inserted = await bulkUpsertQueueRows(rows)
  console.log(`[populator] hansard: ${rows.length} monthly chunks → ${inserted} new rows inserted`)
  return rows.length
}

function workerIdToHansardCorpus(workerId: number): string | null {
  const map: Record<number, string> = {
    1: 'hansard-commons-a',
    2: 'hansard-commons-b',
    3: 'hansard-lords-a',
    4: 'hansard-lords-b',
  }
  return map[workerId] ?? null
}

async function populateBailii(): Promise<number> {
  const { listCases } = await import('./sources/bailii-scraper')
  let total = 0

  for (const [workerIdStr, dbs] of Object.entries(WORKER_DB_SUBSETS)) {
    const workerId = parseInt(workerIdStr, 10)
    const corpus = workerIdToBailiiCorpus(workerId)

    for (const db of dbs) {
      console.log(`[populator] bailii ${db.court}: enumerating listing pages…`)
      const rows: Array<{ id: string; corpus: string; docId: string; sourceType: string; priority: number }> = []

      for await (const c of listCases(db.path)) {
        rows.push({
          id: `${corpus}:${db.court}:${c.caseRef}`,
          corpus,
          docId: `${db.court}:${c.caseRef}`,
          sourceType: 'bailii',
          priority: priority(corpus),
        })
      }

      const inserted = await bulkUpsertQueueRows(rows)
      console.log(`[populator] bailii ${db.court}: ${rows.length} cases → ${inserted} new rows inserted`)
      total += rows.length
    }
  }
  return total
}

function workerIdToBailiiCorpus(workerId: number): string {
  const map: Record<number, string> = {
    5: 'bailii-tribunals',
    6: 'bailii-eat',
    7: 'bailii-privy-ni',
  }
  return map[workerId] ?? 'bailii-tribunals'
}

// ── C1 — Committee Reports ────────────────────────────────────────────────────

async function populateCommittees(): Promise<number> {
  const rows = [
    { id: 'committees:__index', corpus: 'committees-a', docId: '__index', sourceType: 'hansard', priority: 2 },
  ]
  const inserted = await bulkUpsertQueueRows(rows)
  console.log(`[populator] committees: 1 discovery row → ${inserted} new row inserted`)
  return inserted
}

// ── C2 — FCA Handbook per-sourcebook rows ─────────────────────────────────────

async function populateFcaSourcebooks(): Promise<number> {
  const rows = FCA_KNOWN_SOURCEBOOKS.map(code => ({
    id: `fca-regulators:sourcebook:${code}`,
    corpus: 'fca-regulators',
    docId: `sourcebook:${code}`,
    sourceType: 'fca',
    priority: 2,
  }))
  const inserted = await bulkUpsertQueueRows(rows)
  console.log(`[populator] fca-regulators: ${rows.length} sourcebook rows → ${inserted} new rows inserted`)
  return inserted
}

// ── C4 — ECHR HUDOC paginated rows ───────────────────────────────────────────

async function populateEchrPages(): Promise<number> {
  let totalCases = 0
  try {
    totalCases = await countUkCases()
    console.log(`[populator] echr-hudoc: total UK cases from API = ${totalCases}`)
  } catch (err) {
    console.warn('[populator] echr-hudoc: could not query total — using 30,000 default:', err)
    totalCases = 30_000
  }

  const pageSize = 50
  const totalPages = Math.max(Math.ceil(totalCases / pageSize), 600)
  const rows = []
  for (let start = 0; start < totalPages * pageSize; start += pageSize) {
    rows.push({
      id: `echr-hudoc:page:${start}`,
      corpus: 'echr-hudoc',
      docId: `page:${start}`,
      sourceType: 'echr',
      priority: 3,
    })
  }

  const inserted = await bulkUpsertQueueRows(rows)
  console.log(`[populator] echr-hudoc: ${rows.length} page rows → ${inserted} new rows inserted`)
  return inserted
}

// ── C5 — EUR-Lex paginated rows ───────────────────────────────────────────────

async function populateEurLexPages(totalPages = 50): Promise<number> {
  const rows = []
  for (let page = 1; page <= totalPages; page++) {
    rows.push({
      id: `eur-lex:page:${page}`,
      corpus: 'eur-lex',
      docId: `page:${page}`,
      sourceType: 'eurlex',
      priority: 3,
    })
  }
  const inserted = await bulkUpsertQueueRows(rows)
  console.log(`[populator] eur-lex: ${rows.length} page rows → ${inserted} new rows inserted`)
  return inserted
}

// ── Shared helper — generate monthly chunk rows ───────────────────────────────

function monthlyChunks(
  corpus: string, sourceType: string, prefix: string,
  startDate: string, endDate: string, prio: number,
): QueueRowInput[] {
  const rows: QueueRowInput[] = []
  const end = new Date(endDate)
  let current = new Date(startDate)
  while (current <= end) {
    const monthStart = current.toISOString().slice(0, 10)
    const next = new Date(current)
    next.setMonth(next.getMonth() + 1)
    const monthEnd = new Date(Math.min(next.getTime() - 1, end.getTime())).toISOString().slice(0, 10)
    const docId = `${prefix}:${monthStart}:${monthEnd}`
    rows.push({ id: `${corpus}:${docId}`, corpus, docId, sourceType, priority: prio })
    current = next
  }
  return rows
}

// ── F1 — Parliamentary Written Answers ────────────────────────────────────────

async function populateWrittenAnswers(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const rows = monthlyChunks('written-answers', 'hansard', 'answers', '2000-01-01', today, 2)
  const inserted = await bulkUpsertQueueRows(rows)
  console.log(`[populator] written-answers: ${rows.length} monthly chunks → ${inserted} new rows inserted`)
  return rows.length
}

// ── F1 — Parliamentary Written Ministerial Statements ─────────────────────────

async function populateWrittenStatements(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const rows = monthlyChunks('written-statements', 'hansard', 'statements', '1997-05-01', today, 2)
  const inserted = await bulkUpsertQueueRows(rows)
  console.log(`[populator] written-statements: ${rows.length} monthly chunks → ${inserted} new rows inserted`)
  return rows.length
}

// ── F2/F3/F4/F5 — Single-row placeholder sources ──────────────────────────────

async function populateNewSingleRowSources(): Promise<void> {
  const rows: QueueRowInput[] = [
    { id: 'hmrc-tiins:__index',  corpus: 'hmrc-tiins',  docId: '__index', sourceType: 'gov-uk',    priority: 2 },
    { id: 'ots-reports:__index', corpus: 'ots-reports', docId: '__index', sourceType: 'gov-uk',    priority: 3 },
    { id: 'scotlawcom:__index',  corpus: 'scotlawcom',  docId: '__index', sourceType: 'scotlawcom',priority: 2 },
    { id: 'nilawcom:__index',    corpus: 'nilawcom',    docId: '__index', sourceType: 'nilawcom',  priority: 3 },
  ]
  await bulkUpsertQueueRows(rows)
  console.log(`[populator] new single-row sources: ${rows.length} rows inserted`)
}

// ── C6 — UK Treaties refresh row ─────────────────────────────────────────────

async function populateUkTreatiesRefresh(): Promise<number> {
  // The original __index row is done but produced 0 sections. Add a fresh
  // discovery row to retry the full enumeration (r2Exists skips already compiled).
  const rows = [
    { id: 'uk-treaties:v2:__index', corpus: 'uk-treaties', docId: '__index', sourceType: 'treaties', priority: 3 },
  ]
  const inserted = await bulkUpsertQueueRows(rows)
  console.log(`[populator] uk-treaties: retry row → ${inserted} new row inserted`)
  return inserted
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('[populator] starting queue population')

  const countsBefore = await getQueueCounts()
  console.log('[populator] current queue state:', countsBefore)

  // Run each source populator
  const legCount       = await populateTnaLegislation()
  const caselawCount   = await populateTnaCaselaw()
  const hansardCount   = await populateHansard()
  const bailiiCount    = await populateBailii()

  // New parallel-friendly populators (C1–C6)
  const committeeCount = await populateCommittees()
  const fcaCount       = await populateFcaSourcebooks()
  const echrCount      = await populateEchrPages()
  const eurLexCount    = await populateEurLexPages()
  const treatyCount    = await populateUkTreatiesRefresh()

  // F1 — Written Answers + Statements (monthly chunks)
  const answersCount    = await populateWrittenAnswers()
  const statementsCount = await populateWrittenStatements()

  // F2–F5 — New single-row sources (TIINs, OTS, Scottish/NI law commission)
  await populateNewSingleRowSources()

  // Single-row placeholder sources (hmrc active, oecd already done)
  const miscRows = [
    { id: 'hmrc-codes-guidance:__index', corpus: 'hmrc-codes-guidance', docId: '__index', sourceType: 'hmrc', priority: priority('hmrc-codes-guidance') },
    { id: 'oecd:__index',                corpus: 'oecd',                 docId: '__index', sourceType: 'oecd', priority: priority('oecd') },
  ]
  await bulkUpsertQueueRows(miscRows)

  const countsAfter = await getQueueCounts()
  console.log('\n[populator] DONE')
  console.log(`  TNA legislation: ~${legCount} acts`)
  console.log(`  TNA caselaw:     ~${caselawCount} feed pages`)
  console.log(`  Hansard:         ~${hansardCount} monthly chunks`)
  console.log(`  BAILII:          ~${bailiiCount} cases`)
  console.log(`  Committees:      ~${committeeCount} discovery rows`)
  console.log(`  FCA sourcebooks: ~${fcaCount} rows`)
  console.log(`  ECHR pages:      ~${echrCount} rows`)
  console.log(`  EUR-Lex pages:   ~${eurLexCount} rows`)
  console.log(`  UK Treaties:     ~${treatyCount} retry row`)
  console.log(`  Written Answers: ~${answersCount} monthly chunks`)
  console.log(`  Written Statements: ~${statementsCount} monthly chunks`)
  console.log(`  New single-row (TIINs, OTS, Scot/NI law commissions): 4 rows`)
  console.log('Queue state after:', countsAfter)

  await disconnectQueue()
}

main().catch(err => {
  console.error('[populator] fatal:', err)
  process.exit(1)
})
