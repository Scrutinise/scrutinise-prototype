import { Pool } from 'pg'
import { r2Get, r2Put, PROGRESS_KEY, csvKey } from './r2-client'
import { WorkerCheckpoint, readCheckpoint } from './checkpoint'

const RESEND_API = 'https://api.resend.com/emails'
const TO = 'cl@scrutinise.org'

// ── Corpus manifest ───────────────────────────────────────────────────────────
// sourceKey values use the DB corpus column values where available (verified
// against ingest_queue.corpus from 2 Jun 2026 diagnostic).
// Discrepancies from brief noted inline.

export interface CorpusEntry {
  label: string
  sourceKey: string        // matches DB corpus value (or aspirational for not-yet-seeded)
  dbCorpora: string[]      // ingest_queue.corpus / corpus_sections.corpus values
  estSections: number
  priority: number
  complete?: boolean
  blocked?: boolean
}

export const CORPUS_MANIFEST: CorpusEntry[] = [
  // LEGACY — already in Neon, complete
  { label: 'HMRC Manuals (Neon legacy)',      sourceKey: '__neon_legacy__',        dbCorpora: [],                                        estSections: 914_274,   priority: 0, complete: true },

  // PRIORITY 1 — UK Statute
  // Census 3 Jun 2026: 540 docs compiled × avg 168 secs/doc = 90,860; allow for unseeded high-chapter acts
  { label: 'Primary Acts 2000+',              sourceKey: 'primary-acts-2000plus',  dbCorpora: ['primary-acts-2000plus'],                  estSections: 100_000,   priority: 1 },
  // Census 3 Jun 2026: 737 docs compiled × avg 85 secs/doc = 62,664; 1963–1999 comprehensive
  { label: 'Primary Acts pre-2000',           sourceKey: 'primary-acts-pre-2000',  dbCorpora: ['primary-acts-pre-2000'],                  estSections: 70_000,    priority: 1 },
  // Census 3 Jun 2026: 5,866 docs × avg 10 secs = 59,951 compiled; gap: 2015–2026 under-seeded (~60k missing)
  { label: 'Statutory Instruments 2010+',     sourceKey: 'si-2010plus',            dbCorpora: ['si-2010plus'],                            estSections: 120_000,   priority: 1 },
  // Census 3 Jun 2026: 30,898 docs × avg 5.6 secs = 174,507 compiled; 1948–2009 comprehensive
  { label: 'Statutory Instruments pre-2010',  sourceKey: 'si-pre-2010',            dbCorpora: ['si-pre-2010'],                            estSections: 180_000,   priority: 1 },

  // PRIORITY 2 — Major open sources
  // Census 3 Jun 2026: compiled 92,681; Neon shows 116k total for SSI/NISR/WSI/NIA/ANAW
  { label: 'Regional (Scot/Wales/NI)',        sourceKey: 'regional',               dbCorpora: ['regional'],                               estSections: 160_000,   priority: 2 },
  // Census 3 Jun 2026: Neon EUR+EUDN+EUDR = 133,312; new pipeline at 14,390 (partial)
  { label: 'Retained EU Law',                 sourceKey: 'retained-eu',            dbCorpora: ['retained-eu'],                            estSections: 140_000,   priority: 2 },
  // V4 3 Jun 2026: feed reports 7,489 pages but pages 1,500+ are empty.
  // Binary-search in getTotalJudgments() confirmed ~1,499 usable pages × 50 = ~74,950.
  // We have 74,730 compiled — effectively complete for currently available content.
  { label: 'TNA Find Case Law',               sourceKey: 'tna-caselaw',            dbCorpora: ['tna-caselaw'],                            estSections: 75_000,    priority: 2 },
  { label: 'BAILII (full corpus)',            sourceKey: 'bailii',                 dbCorpora: ['bailii-tribunals','bailii-eat','bailii-privy-ni'], estSections: 2_000_000, priority: 2, blocked: true },
  // TWFY pwdata — free bulk XML from theyworkforyou.com/pwdata/scrapedxml/ (verified 4 Jun 2026)
  // Supersedes parliament-api.ts (403 from Railway) and TWFY API (1k quota).
  // 19,999 files (1919–present); new files added daily. One queue row per file.
  { label: 'Hansard Commons (TWFY)',          sourceKey: 'twfy-pwdata',             dbCorpora: ['pwdata-debates'],                         estSections: 2_000_000, priority: 2 },
  // 5,663 files (1999–present)
  { label: 'Hansard Lords (TWFY)',            sourceKey: 'twfy-pwdata',             dbCorpora: ['pwdata-lords'],                           estSections: 500_000,   priority: 2 },
  { label: 'Committee Reports',              sourceKey: 'committee-reports',       dbCorpora: ['committees-a','committees-b'],             estSections: 100_000,   priority: 2 },
  // TWFY pwdata wrans/ — 6,857 files (2001–present); supersedes blocked written-answers corpus
  { label: 'Written Answers (TWFY)',          sourceKey: 'twfy-pwdata',             dbCorpora: ['pwdata-wrans'],                           estSections: 537_593,   priority: 2 },
  // Census 3 Jun 2026: Parliament API confirmed 17,487
  { label: 'Written Ministerial Statements', sourceKey: 'written-statements',      dbCorpora: ['written-statements'],                     estSections: 17_487,    priority: 2 },
  // TWFY pwdata westminhall/ — 3,932 files (2000–present)
  { label: 'Westminster Hall (TWFY)',         sourceKey: 'twfy-pwdata',             dbCorpora: ['pwdata-westminster'],                     estSections: 100_000,   priority: 3 },
  { label: 'Bill Pages',                     sourceKey: 'bill-pages',              dbCorpora: [],                                         estSections: 50_000,    priority: 2 },
  { label: 'Explanatory Notes',              sourceKey: 'explanatory-notes',       dbCorpora: [],                                         estSections: 50_000,    priority: 2 },
  { label: 'Impact Assessments',             sourceKey: 'impact-assessments',      dbCorpora: [],                                         estSections: 30_000,    priority: 2 },
  { label: 'House of Commons Library',       sourceKey: 'hoc-library',             dbCorpora: [],                                         estSections: 30_000,    priority: 2 },
  // V5/V6: handbook.fca.org.uk is a pure JS SPA — no server-side content. Cannot scrape without
  // Playwright. Source client exists, queue rows exist, 0 sections compiled → shows ⚠️ failing.
  // FCA Publications (fca.org.uk/publications, Drupal/PDF) is the viable alternative — V8 build.
  { label: 'FCA Handbook',                   sourceKey: 'fca-regulators',          dbCorpora: ['fca-regulators'],                         estSections: 150_000,   priority: 2 },
  // V7: placeholder entry so it shows "not started" in email — actual scraper build is V8 work.
  { label: 'FCA Publications',                sourceKey: 'fca-publications',        dbCorpora: ['fca-publications'],                       estSections: 20_000,    priority: 3 },
  // V6 3 Jun 2026: lda.data.parliament.uk — no auth, JSON, 500 records/page. Confirmed working.
  // Actual totals from V6 diagnostic: 69,852 / 103,137 / 618,599 records respectively.
  { label: 'Commons Oral Questions (LDA)',    sourceKey: 'lda-parliament',          dbCorpora: ['lda-commonsoralquestions'],               estSections: 70_000,    priority: 2 },
  { label: 'Lords Written Questions (LDA)',   sourceKey: 'lda-parliament',          dbCorpora: ['lda-lordswrittenquestions'],              estSections: 103_000,   priority: 2 },
  { label: 'Commons Written Questions (LDA)', sourceKey: 'lda-parliament',          dbCorpora: ['lda-commonswrittenquestions'],            estSections: 619_000,   priority: 2 },
  // Brief used 'hmrc-web'; DB corpus = 'hmrc-codes-guidance'
  { label: 'HMRC + Guidance',                sourceKey: 'hmrc-codes-guidance',     dbCorpora: ['hmrc-codes-guidance'],                    estSections: 640_000,   priority: 2 },
  // Census 3 Jun 2026: compiled 791; appears complete for available content
  { label: 'HMRC TIINs',                     sourceKey: 'hmrc-tiins',              dbCorpora: ['hmrc-tiins'],                             estSections: 800,       priority: 2 },
  { label: 'Law Commission Reports (E&W)',   sourceKey: 'law-commission',          dbCorpora: [],                                         estSections: 20_000,    priority: 2 },
  // Census 3 Jun 2026: compiled 350; appears complete
  { label: 'Scottish Law Commission',        sourceKey: 'scotlawcom',              dbCorpora: ['scotlawcom'],                             estSections: 350,       priority: 2 },

  // PRIORITY 3 — Secondary sources
  // V5 3 Jun 2026: HUDOC /app/query/results returns 404 — API endpoint changed.
  // No working alternative endpoint found. Blocked until new API is identified.
  { label: 'ECHR / HUDOC',                   sourceKey: 'echr-hudoc',              dbCorpora: ['echr-hudoc'],                             estSections: 30_050,    priority: 3, blocked: true },
  // V6 3 Jun 2026: search.html?format=json returns HTML (SPA redesign) — REST API 404.
  // Fixed via CELLAR SPARQL (publications.europa.eu/webapi/rdf/sparql) — no auth required.
  // Returns all ~232,988 series-3 secondary legislation CELEX IDs. fetchDocumentText confirmed working.
  { label: 'EUR-Lex (retained origins)',      sourceKey: 'eur-lex',                dbCorpora: ['eur-lex'],                                estSections: 232_000,   priority: 3 },
  // V6 3 Jun 2026: lda.data.parliament.uk — voting records. Actual totals: 5,553 / 2,089 records.
  { label: 'Commons Divisions (LDA)',         sourceKey: 'lda-parliament',          dbCorpora: ['lda-commonsdivisions'],                  estSections: 5_553,     priority: 3 },
  { label: 'Lords Divisions (LDA)',           sourceKey: 'lda-parliament',          dbCorpora: ['lda-lordsdivisions'],                    estSections: 2_089,     priority: 3 },
  // Brief used 'gov-uk'; DB corpus = 'uk-treaties'
  { label: 'UK Treaties (FCDO)',              sourceKey: 'uk-treaties',            dbCorpora: ['uk-treaties'],                            estSections: 10_000,    priority: 3 },
  { label: 'White / Green Papers',            sourceKey: 'command-papers',         dbCorpora: [],                                         estSections: 20_000,    priority: 3 },
  { label: 'Sentencing Council',              sourceKey: 'sentencing-council',     dbCorpora: ['sentencing-council'],                     estSections: 2_000,     priority: 3 },
  { label: 'College of Policing APP',         sourceKey: 'college-of-policing',    dbCorpora: ['college-of-policing'],                    estSections: 8_000,     priority: 3 },
  { label: 'PACE Codes A–H',                 sourceKey: 'pace-codes',             dbCorpora: [],                                         estSections: 800,       priority: 3 },
  { label: 'Civil Service / Min. Codes',      sourceKey: 'civil-service-codes',    dbCorpora: [],                                         estSections: 500,       priority: 3 },
  { label: 'Treasury Green/Magenta Book',     sourceKey: 'treasury-books',         dbCorpora: [],                                         estSections: 500,       priority: 3 },
  { label: 'Erskine May + Standing Orders',   sourceKey: 'erskine-may',            dbCorpora: [],                                         estSections: 3_000,     priority: 3 },
  { label: 'Public Consultations',            sourceKey: 'consultations',          dbCorpora: [],                                         estSections: 50_000,    priority: 3 },
  { label: 'NAO Reports',                     sourceKey: 'nao-reports',            dbCorpora: ['nao-reports'],                            estSections: 10_000,    priority: 3 },
  // Census 3 Jun 2026: compiled 497; was underestimated
  { label: 'OTS Reports',                     sourceKey: 'ots-reports',            dbCorpora: ['ots-reports'],                            estSections: 500,       priority: 3 },
  { label: 'NI Law Commission (historic)',    sourceKey: 'nilawcom',               dbCorpora: ['nilawcom'],                               estSections: 50,        priority: 3 },
  { label: 'SSRN UK Legal Scholarship',       sourceKey: 'ssrn',                   dbCorpora: [],                                         estSections: 50_000,    priority: 3, blocked: true },
  { label: 'Post-Legislative Memoranda',      sourceKey: 'post-leg-memoranda',     dbCorpora: [],                                         estSections: 5_000,     priority: 3 },

  // PRIORITY 4 — Lower priority
  { label: 'Local / Private Acts',            sourceKey: 'local-private-acts',     dbCorpora: [],                                         estSections: 10_000,    priority: 4 },
  { label: 'NHS Guidance',                    sourceKey: 'nhs-guidance',           dbCorpora: [],                                         estSections: 20_000,    priority: 4 },
  // V2 Part 3: PPG 63 chapters + NPPF (HTML text). Building Regs 21 docs (description text; PDFs future work).
  { label: 'Planning Policy (NPPF/PPG)',       sourceKey: 'planning-policy',        dbCorpora: ['planning-policy'],                        estSections: 64,        priority: 4 },
  { label: 'Building Regulations',            sourceKey: 'building-regs',          dbCorpora: ['building-regs'],                          estSections: 21,        priority: 4 },
  { label: 'CMA Guidelines',                  sourceKey: 'cma-guidelines',         dbCorpora: [],                                         estSections: 8_000,     priority: 4 },
  { label: 'Ofcom/Ofwat/Ofgem/Ofsted',        sourceKey: 'regulator-rulebooks',    dbCorpora: [],                                         estSections: 40_000,    priority: 4 },
  // Census 3 Jun 2026: compiled 462; free-tier content appears fully ingested
  { label: 'OECD (free tier)',                sourceKey: 'oecd',                   dbCorpora: ['oecd'],                                   estSections: 500,       priority: 4 },
  { label: 'ONS Statistical Datasets',        sourceKey: 'ons-statistics',         dbCorpora: [],                                         estSections: 5_000,     priority: 4 },
]

// ── DB pool (Railway) ─────────────────────────────────────────────────────────

let _pool: Pool | null = null
function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL not set')
    _pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
    })
  }
  return _pool
}

// ── Scheduler lock — prevents duplicate email sends when two instances overlap ─
// Uses a random per-startup ID (not process.pid) because Railway containers all start as PID 1.

const SCHEDULER_INSTANCE_ID = Math.random().toString(36).slice(2)

export async function acquireSchedulerLock(): Promise<boolean> {
  const pool = getPool()
  try {
    await pool.query(`
      INSERT INTO scheduler_lock (id, locked_at, process_id)
      VALUES (1, NOW(), $1)
      ON CONFLICT (id) DO UPDATE
        SET locked_at = NOW(), process_id = $1
        WHERE scheduler_lock.locked_at < NOW() - INTERVAL '50 minutes'
    `, [SCHEDULER_INSTANCE_ID])
    const res = await pool.query<{ process_id: string }>(
      'SELECT process_id FROM scheduler_lock WHERE id = 1'
    )
    return res.rows[0]?.process_id === SCHEDULER_INSTANCE_ID
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('does not exist') || msg.includes('relation "scheduler_lock"')) {
      console.warn('[scheduler] scheduler_lock table not yet created — running without lock')
      return true
    }
    console.warn('[scheduler] lock acquisition failed:', msg)
    return false
  }
}

// ── Per-corpus compiled section counts (Railway corpus_sections) ──────────────

export async function queryCorpusCounts(): Promise<Record<string, { compiled: number; failed: number }>> {
  const res = await getPool().query<{ corpus: string; status: string; count: number }>(`
    SELECT corpus, status, COUNT(*)::int AS count
    FROM corpus_sections
    WHERE status IN ('compiled', 'failed')
    GROUP BY corpus, status
    ORDER BY corpus
  `)
  const out: Record<string, { compiled: number; failed: number }> = {}
  for (const row of res.rows) {
    if (!out[row.corpus]) out[row.corpus] = { compiled: 0, failed: 0 }
    if (row.status === 'compiled') out[row.corpus].compiled = row.count
    else if (row.status === 'failed') out[row.corpus].failed = row.count
  }
  return out
}

// Returns set of all corpus values that have any row in ingest_queue.
export async function queryQueueCorpora(): Promise<Set<string>> {
  const res = await getPool().query<{ corpus: string }>('SELECT DISTINCT corpus FROM ingest_queue')
  return new Set(res.rows.map(r => r.corpus))
}

// ── Neon LegislationSection count (legacy pipeline) ──────────────────────────

const NEON_FALLBACK = 914_274  // confirmed count from 2 Jun 2026 transfer

export async function queryNeonCount(): Promise<number> {
  const url = process.env.NEON_DATABASE_URL
  if (!url) {
    console.log('[reporter] NEON_DATABASE_URL not set — using confirmed baseline')
    return NEON_FALLBACK
  }
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
  })
  try {
    const res = await pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM "LegislationSection"')
    return res.rows[0]?.count ?? NEON_FALLBACK
  } catch (err) {
    console.warn('[reporter] Neon query failed — using baseline:', err)
    return NEON_FALLBACK
  } finally {
    await pool.end()
  }
}

// ── Per-worker snapshot write ─────────────────────────────────────────────────
// Called by worker-queue.ts every CHECKPOINT_EVERY rows.
// workerId = integer WORKER_ID; sourceKey = current corpus; sectionsCompiled = cumulative session count.

export async function writeWorkerSnapshot(
  workerId: number,
  sourceKey: string,
  sectionsCompiled: number,
): Promise<void> {
  const pool = getPool()
  await pool.query(`
    INSERT INTO ingest_progress_snapshots
      ("capturedAt", "workerId", "workerLabel", "sourceKey", "sectionsCompiled", "sectionsEstimated", phase)
    VALUES (NOW(), $1, $2, $3, $4, 0, 'worker')
  `, [workerId, `Worker ${workerId}`, sourceKey, sectionsCompiled])
}

// ── IngestProgressSnapshot write ─────────────────────────────────────────────

export async function saveProgressSnapshot(
  corpusCounts: Record<string, { compiled: number; failed: number }>,
  capturedAt: Date,
): Promise<void> {
  const pool = getPool()
  for (const [corpus, counts] of Object.entries(corpusCounts)) {
    const entry = CORPUS_MANIFEST.find(e => e.dbCorpora.includes(corpus))
    const label = entry?.label ?? corpus
    const estimated = entry?.estSections ?? 0
    await pool.query(`
      INSERT INTO ingest_progress_snapshots
        ("capturedAt", "workerLabel", "sourceKey", "sectionsCompiled", "sectionsEstimated", phase)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [capturedAt, label, corpus, counts.compiled, estimated, 'queue'])
  }
}

// ── Time-series ETA from snapshots ───────────────────────────────────────────

async function queryEtaFromSnapshots(totalEstimated: number, currentCompiled: number): Promise<string> {
  try {
    const res = await getPool().query<{ capturedAt: Date; total: number }>(`
      SELECT "capturedAt", SUM("sectionsCompiled")::int AS total
      FROM ingest_progress_snapshots
      GROUP BY "capturedAt"
      ORDER BY "capturedAt" DESC
      LIMIT 6
    `)
    const points = res.rows.reverse()  // oldest first
    if (points.length < 2) return 'Insufficient data'

    const newest = points[points.length - 1]
    const oldest = points[0]
    const deltaCompiled = Number(newest.total) - Number(oldest.total)
    const deltaMs = new Date(newest.capturedAt).getTime() - new Date(oldest.capturedAt).getTime()

    if (deltaMs <= 0 || deltaCompiled <= 0) return 'No rate data'

    const sectionsPerHour = deltaCompiled / (deltaMs / 3_600_000)
    const remaining = totalEstimated - currentCompiled
    if (remaining <= 0) return 'Complete'

    const hoursNeeded = remaining / sectionsPerHour
    const eta = new Date(Date.now() + hoursNeeded * 3_600_000)
    const rate = Math.round(sectionsPerHour).toLocaleString()
    const dateStr = eta.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    return `${dateStr}  (${rate} secs/hr)`
  } catch {
    return 'ETA unavailable'
  }
}

// ── Checkpoint aggregate (kept for legacy R2 writes) ─────────────────────────

export interface WorkerSummary {
  workerId: number
  corpus: string
  phase: 1 | 2
  completed: number
  total: number
  pct: string
  failed: number
  phase1Complete: boolean
  lastUpdated: string
}

export interface ProgressAggregate {
  timestamp: string
  workers: WorkerSummary[]
  totalCompleted: number
  totalEstimated: number
  totalPct: string
}

const CHECKPOINT_LABELS: Record<number, string> = {
  1: 'Primary Acts pre-2000',
  2: 'Primary Acts 2000+',
  3: 'SIs pre-2010',
  4: 'SIs 2010+',
  5: 'Regional (Scot/Wales/NI)',
  6: 'Retained EU Law',
  7: 'FCA + Regulators',
  8: 'HMRC + Guidance',
  9: 'TNA Case Law',
  10: 'International',
}

export async function buildAggregate(): Promise<ProgressAggregate> {
  const workers: WorkerSummary[] = []
  let totalCompleted = 0
  let totalEstimated = 0

  for (let id = 1; id <= 20; id++) {
    const cp = await readCheckpoint(id)
    const pct = cp.totalInCorpus > 0
      ? ((cp.completed / cp.totalInCorpus) * 100).toFixed(1) + '%'
      : '—'
    workers.push({
      workerId: id,
      corpus: CHECKPOINT_LABELS[id] ?? `Worker ${id}`,
      phase: cp.phase,
      completed: cp.completed,
      total: cp.totalInCorpus,
      pct,
      failed: cp.failed,
      phase1Complete: cp.phase1Complete,
      lastUpdated: cp.lastUpdated,
    })
    totalCompleted += cp.completed
    totalEstimated += cp.totalInCorpus
  }

  const totalPct = totalEstimated > 0
    ? ((totalCompleted / totalEstimated) * 100).toFixed(1) + '%'
    : '—'

  return { timestamp: new Date().toISOString(), workers, totalCompleted, totalEstimated, totalPct }
}

// ── R2 writes ─────────────────────────────────────────────────────────────────

export async function writeProgressToR2(agg: ProgressAggregate): Promise<void> {
  await r2Put(PROGRESS_KEY, JSON.stringify(agg, null, 2))
}

export async function appendCsvRow(agg: ProgressAggregate): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  const key = csvKey(today)
  const existing = await r2Get(key)
  const header = 'timestamp,worker_id,corpus,completed,total,pct_complete,failed\n'
  const rows = agg.workers.map(w =>
    `"${agg.timestamp}",${w.workerId},"${w.corpus}",${w.completed},${w.total},"${w.pct}",${w.failed}`
  ).join('\n') + '\n'
  const content = existing ? existing + rows : header + rows
  await r2Put(key, content, 'text/csv')
}

// ── Format helpers ────────────────────────────────────────────────────────────

function progressBar(pct: number, width = 20): string {
  const clampedPct = Math.min(100, Math.max(0, pct))
  const filled = Math.min(width, Math.max(0, Math.round((clampedPct / 100) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function pctStr(compiled: number, estimated: number): string {
  if (estimated === 0) return '  n/a'
  return ((compiled / estimated) * 100).toFixed(1).padStart(5) + '%'
}

// ── Theoretical throughput ceilings per source ───────────────────────────────
// (3_600_000 ms/hr ÷ intervalMs) × avgSectionsPerRequest — before sharing the
// token bucket across workers on the same source.
const THEORETICAL_SECTIONS_PER_HOUR: Record<string, number> = {
  'tna-legislation': Math.floor((3_600_000 / 200) * 5),   // 90,000/hr
  'tna-caselaw':     Math.floor((3_600_000 / 200) * 3),   // 54,000/hr
  'hansard':         Math.floor((3_600_000 / 500) * 20),  // 144,000/hr
  'fca':             Math.floor((3_600_000 / 300) * 10),  // 120,000/hr
  'hmrc':            Math.floor((3_600_000 / 300) * 8),   //  96,000/hr
  'echr':            Math.floor((3_600_000 / 500) * 50),  // 360,000/hr
  'eurlex':          Math.floor((3_600_000 / 500) * 10),  //  72,000/hr
  'lda-parliament':  Math.floor((3_600_000 / 200) * 500), // 9,000,000/hr ceiling (500 items/req)
  'default':         1_000,
}

// ── Worker throughput from snapshots ─────────────────────────────────────────
// Groups by workerId (non-null rows written by workers every CHECKPOINT_EVERY items).
// Scheduler-written rows (workerId IS NULL) are excluded — those are per-corpus aggregates.

interface WorkerThroughputRow {
  workerId: number
  sourceKey: string
  ratePerHour: number
  stalled: boolean
  idle: boolean
  efficiencyPct: number    // actual / fair-share-theoretical × 100
  efficiencyFlag: '' | '⚡low' | '🔴critical'
}

async function queryWorkerThroughput(): Promise<WorkerThroughputRow[]> {
  const pool = getPool()
  const res = await pool.query<{
    workerId: number
    sourceKey: string
    compiled_t1: number | null
    at_t1: Date | null
    compiled_t2: number | null
    at_t2: Date | null
    compiled_t3: number | null
  }>(`
    WITH ranked AS (
      SELECT "workerId", "sourceKey", "capturedAt", "sectionsCompiled",
             ROW_NUMBER() OVER (PARTITION BY "workerId" ORDER BY "capturedAt" DESC) AS rn
      FROM ingest_progress_snapshots
      WHERE "workerId" IS NOT NULL
    )
    SELECT
      "workerId",
      MAX(CASE WHEN rn = 1 THEN "sourceKey" END) AS "sourceKey",
      MAX(CASE WHEN rn = 1 THEN "sectionsCompiled" END) AS compiled_t1,
      MAX(CASE WHEN rn = 1 THEN "capturedAt" END) AS at_t1,
      MAX(CASE WHEN rn = 2 THEN "sectionsCompiled" END) AS compiled_t2,
      MAX(CASE WHEN rn = 2 THEN "capturedAt" END) AS at_t2,
      MAX(CASE WHEN rn = 3 THEN "sectionsCompiled" END) AS compiled_t3
    FROM ranked
    WHERE rn <= 3
    GROUP BY "workerId"
    ORDER BY "workerId"
  `)

  const rawRows = res.rows.map(row => {
    const c1 = Number(row.compiled_t1 ?? 0)
    const c2 = row.compiled_t2 != null ? Number(row.compiled_t2) : null
    const c3 = row.compiled_t3 != null ? Number(row.compiled_t3) : null
    const t1 = row.at_t1 ? new Date(row.at_t1).getTime() : 0
    const t2 = row.at_t2 ? new Date(row.at_t2).getTime() : 0
    const deltaMs = t1 > 0 && t2 > 0 ? t1 - t2 : 0
    const deltaCompiled = c2 != null ? c1 - c2 : 0
    const ratePerHour = deltaMs > 0 ? Math.max(0, Math.round(deltaCompiled / (deltaMs / 3_600_000))) : 0
    const prevDelta = c3 != null && c2 != null ? c2 - c3 : undefined
    const stalled = ratePerHour === 0 && prevDelta !== undefined && prevDelta === 0
    const idle = ratePerHour === 0 && !stalled
    const sk = row.sourceKey ?? ''
    const sourceType = sk.startsWith('si-') || sk.startsWith('primary-acts') || sk === 'regional' || sk === 'retained-eu'
      ? 'tna-legislation'
      : sk === 'tna-caselaw' ? 'tna-caselaw'
      : sk.startsWith('hansard') || sk.startsWith('committees') || sk.startsWith('written')
        ? 'hansard'
      : sk === 'fca-regulators' ? 'fca'
      : sk.startsWith('hmrc') ? 'hmrc'
      : sk === 'echr-hudoc' ? 'echr'
      : sk === 'eur-lex' ? 'eurlex'
      : sk.startsWith('lda-') ? 'lda-parliament'
      : 'default'
    return { workerId: Number(row.workerId), sourceKey: sk, sourceType, ratePerHour, stalled, idle }
  })

  const workersPerSource: Record<string, number> = {}
  for (const r of rawRows) workersPerSource[r.sourceType] = (workersPerSource[r.sourceType] ?? 0) + 1

  return rawRows.map(r => {
    const theoretical = THEORETICAL_SECTIONS_PER_HOUR[r.sourceType] ?? THEORETICAL_SECTIONS_PER_HOUR.default
    const fairShare = theoretical / Math.max(1, workersPerSource[r.sourceType] ?? 1)
    const efficiencyPct = fairShare > 0 ? Math.round((r.ratePerHour / fairShare) * 100) : 0
    const efficiencyFlag: WorkerThroughputRow['efficiencyFlag'] =
      r.ratePerHour > 0 && efficiencyPct < 20 ? '🔴critical'
      : r.ratePerHour > 0 && efficiencyPct < 40 ? '⚡low'
      : ''
    return { ...r, efficiencyPct, efficiencyFlag }
  }).sort((a, b) => a.workerId - b.workerId)
}

// ── Unified progress email ────────────────────────────────────────────────────

export interface UnrecognisedFormatRow { sourceUrl: string | null; xmlPreview: string | null }
export interface FormatCount { format: string | null; count: number }

export async function sendProgressEmail(
  agg: ProgressAggregate,
  corpusCounts: Record<string, { compiled: number; failed: number }>,
  neonCount: number,
  unrecognised: UnrecognisedFormatRow[] = [],
  formatBreakdown: FormatCount[] = [],
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) { console.warn('[reporter] RESEND_API_KEY not set — skipping email'); return }

  const bst = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(agg.timestamp))

  // Query which corpora have any queue rows (to distinguish not-started from seeded)
  let queueCorpora = new Set<string>()
  try { queueCorpora = await queryQueueCorpora() } catch { /* non-fatal */ }

  // ── Totals ────────────────────────────────────────────────────────────────
  // Sum compiled sections across all DB corpora
  const newPipelineCompiled = Object.values(corpusCounts).reduce((s, c) => s + c.compiled, 0)
  const overallCompiled = neonCount + newPipelineCompiled

  // Estimated: sum of all non-blocked entries (excl. Neon legacy)
  const totalEstimated = CORPUS_MANIFEST
    .filter(e => !e.complete && !e.blocked)
    .reduce((s, e) => s + e.estSections, 0)

  const overallPct = (overallCompiled / (neonCount + totalEstimated)) * 100
  const overallBar = progressBar(overallPct)

  const eta = await queryEtaFromSnapshots(totalEstimated, newPipelineCompiled)

  // ── Per-entry rows grouped by priority ───────────────────────────────────
  const manifestLines: string[] = []
  let currentPriority = -1

  for (const entry of CORPUS_MANIFEST) {
    if (entry.priority !== currentPriority) {
      currentPriority = entry.priority
      const tierLabel = entry.priority === 0 ? 'LEGACY'
        : entry.priority === 1 ? 'PRIORITY 1 — UK Statute'
        : entry.priority === 2 ? 'PRIORITY 2 — Major open sources'
        : entry.priority === 3 ? 'PRIORITY 3 — Secondary sources'
        : 'PRIORITY 4 — Lower priority'
      manifestLines.push('', `── ${tierLabel} ──`)
    }

    const label = entry.label.padEnd(36)

    if (entry.complete) {
      // Neon legacy — use neonCount
      manifestLines.push(`  ${label} ${neonCount.toLocaleString().padStart(9)}  ✅`)
      continue
    }

    if (entry.blocked) {
      manifestLines.push(`  ${label} ${(0).toString().padStart(9)} / ${entry.estSections.toLocaleString().padStart(9)}  ⛔ blocked`)
      continue
    }

    // Sum compiled across this entry's DB corpora
    const compiled = entry.dbCorpora.reduce((s, c) => s + (corpusCounts[c]?.compiled ?? 0), 0)
    const failed   = entry.dbCorpora.reduce((s, c) => s + (corpusCounts[c]?.failed ?? 0), 0)
    const est      = entry.estSections
    const isSeeded = entry.dbCorpora.some(c => queueCorpora.has(c))

    if (compiled === 0 && !isSeeded && entry.dbCorpora.length > 0) {
      manifestLines.push(`  ${label} ${(0).toString().padStart(9)} / ${est.toLocaleString().padStart(9)}  · not started`)
      continue
    }

    if (compiled === 0 && entry.dbCorpora.length === 0) {
      manifestLines.push(`  ${label} ${(0).toString().padStart(9)} / ${est.toLocaleString().padStart(9)}  · not started`)
      continue
    }

    // Seeded but producing 0 sections — source client is broken or API is down
    if (compiled === 0 && isSeeded) {
      manifestLines.push(`  ${label} ${(0).toString().padStart(9)} / ${est.toLocaleString().padStart(9)}  ⚠️  failing (0 sections despite queue rows)`)
      continue
    }

    const pct = pctStr(compiled, est)
    const bar = progressBar(est > 0 ? (compiled / est) * 100 : 0, 10)
    const failStr = failed > 0 ? `  (${failed.toLocaleString()} failed)` : ''
    manifestLines.push(`  ${label} ${compiled.toLocaleString().padStart(9)} / ${est.toLocaleString().padStart(9)}  ${bar} ${pct}${failStr}`)
  }

  const parts: string[] = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'SCRUTINISE CORPUS INGEST — OVERALL COVERAGE',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `  ${bst} BST`,
    '',
    `  ${overallBar}  ${overallPct.toFixed(1)}%`,
    `  ${overallCompiled.toLocaleString()} / ${(neonCount + totalEstimated).toLocaleString()} est. sections`,
    `  ETA: ${eta}`,
    '',
    `  LEGACY (Neon — legislation.gov.uk):  ${neonCount.toLocaleString().padStart(9)}  ✅`,
    `  NEW PIPELINE (20 workers):           ${newPipelineCompiled.toLocaleString().padStart(9)}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'CORPUS MANIFEST',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ...manifestLines,
  ]

  if (formatBreakdown.length > 0) {
    parts.push('', 'FORMAT BREAKDOWN (cumulative)')
    for (const row of formatBreakdown) {
      parts.push(`  ${(row.format ?? '(no format)').padEnd(16)}${row.count.toLocaleString().padStart(12)}`)
    }
  }

  if (unrecognised.length > 0) {
    parts.push('', `UNRECOGNISED FORMATS (last run): ${unrecognised.length} act(s)`)
    for (const row of unrecognised.slice(0, 10)) {
      parts.push(`  ${row.sourceUrl ?? '(no url)'}`)
      if (row.xmlPreview) parts.push(`    ${row.xmlPreview.replace(/\n/g, ' ')}`)
    }
  }

  // ── Worker throughput ───────────────────────────────────────────────────────
  try {
    const workerRows = await queryWorkerThroughput()
    if (workerRows.length > 0) {
      const totalRate = workerRows.reduce((s, w) => s + w.ratePerHour, 0)
      const maxRate = Math.max(...workerRows.map(w => w.ratePerHour), 1)
      parts.push('', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      parts.push('WORKER THROUGHPUT (by worker ID, last 1h)')
      parts.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      for (const w of workerRows) {
        const workerStr = `Worker ${String(w.workerId).padStart(2)}`
        const sourceStr = (w.sourceKey || '[idle]').slice(0, 26).padEnd(26)
        const rateStr = w.ratePerHour.toLocaleString().padStart(7) + ' /hr'
        const bar = progressBar((w.ratePerHour / maxRate) * 100, 6)
        const effStr = w.ratePerHour > 0 ? `  ${w.efficiencyPct}% eff${w.efficiencyFlag ? ' ' + w.efficiencyFlag : ''}` : ''
        const statusFlag = w.stalled ? '  ⚠️  stalled' : w.idle ? '  ℹ️  idle' : ''
        parts.push(`  ${workerStr}  ${sourceStr}  ${rateStr}  ${bar}${effStr}${statusFlag}`)
      }
      parts.push('')
      parts.push(`  Total: ${totalRate.toLocaleString()} /hr across ${workerRows.length} workers reporting`)
      const stalledIds = workerRows.filter(w => w.stalled).map(w => `Worker ${w.workerId}`)
      if (stalledIds.length > 0) parts.push(`  Stalled: ${stalledIds.join(', ')}`)
      const critical = workerRows.filter(w => w.efficiencyFlag === '🔴critical').map(w => `Worker ${w.workerId}`)
      if (critical.length > 0) parts.push(`  Critical efficiency: ${critical.join(', ')}`)
    }
  } catch (err) {
    parts.push('', `[Worker throughput unavailable: ${err}]`)
  }

  const body = parts.join('\n')

  const subjectBar = progressBar(overallPct, 10)
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Scrutinise Ingest <ingest@messages.scrutinise.org>',
      to: [TO],
      subject: `Corpus: ${overallPct.toFixed(1)}% [${subjectBar}] ${overallCompiled.toLocaleString()} secs — ${bst}`,
      text: body,
    }),
  })

  if (!res.ok) {
    console.error(`[reporter] Resend failed: ${res.status} ${await res.text()}`)
  } else {
    console.log(`[reporter] Email sent to ${TO} — ${overallPct.toFixed(1)}% overall`)
  }
}
