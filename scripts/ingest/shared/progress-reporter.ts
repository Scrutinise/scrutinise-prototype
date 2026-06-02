import { Pool } from 'pg'
import { r2Get, r2Put, PROGRESS_KEY, csvKey } from './r2-client'
import { WorkerCheckpoint, readCheckpoint } from './checkpoint'

const RESEND_API = 'https://api.resend.com/emails'
const TO = 'cl@scrutinise.org'

// ── Corpus planning targets — from Legislation_Corpus_Breakdown_v2.xlsx ──────
// Update as estimates sharpen. taxLegislation excluded — subset of SIs.

const CORPUS_TARGETS = {
  primaryActs:           180_000,
  statutoryInstruments:  600_000,
  retainedEuLaw:          80_000,
  scottishWelshNI:       160_000,
  localPrivateActs:       10_000,
  hmrcManuals:           500_000,
  fcaHandbook:           150_000,
  sentencingCouncil:       2_000,
  collegeOfPolicing:       8_000,
  pace:                      800,
  civilServiceCodes:         500,
  treasuryGreenBook:         500,
  erskineMay:              3_000,
  nhsGuidance:            20_000,
  planningPolicy:          5_000,
  buildingRegs:            3_000,
  cmaGuidelines:           8_000,
  regulatorRulebooks:     40_000,
  hansardCommons:      2_000_000,
  hansardLords:          500_000,
  billPages:              50_000,
  committeeReports:      100_000,
  explanatoryNotes:       50_000,
  impactAssessments:      30_000,
  caselaw_tna:           374_250,
  caselaw_bailii:      2_000_000,
  echr:                   30_000,
  treaties:               10_000,
  eurLex:                 80_000,
  lawCommission:          20_000,
  consultations:          50_000,
  naoReports:             10_000,
}

const TOTAL_ESTIMATED = Object.values(CORPUS_TARGETS).reduce((a, b) => a + b, 0)

// Per-corpus section targets — maps corpus_sections.corpus → expected section count
const SECTION_TARGETS: Record<string, number> = {
  'primary-acts-pre-2000':  80_000,
  'primary-acts-2000plus': 100_000,
  'si-pre-2010':           300_000,
  'si-2010plus':           300_000,
  'regional':              160_000,
  'retained-eu':            80_000,
  'fca-regulators':        190_000,   // fcaHandbook + regulatorRulebooks
  'hmrc-codes-guidance':   640_000,   // hmrc + explanatoryNotes + impactAssessments + nao + consultations
  'tna-caselaw':           374_250,
  'hansard-commons-a':     600_000,
  'hansard-commons-b':   1_400_000,
  'hansard-lords-a':       150_000,
  'hansard-lords-b':       350_000,
  'committees-a':           50_000,
  'committees-b':           50_000,
  'bailii-tribunals':      700_000,
  'bailii-eat':            100_000,
  'bailii-privy-ni':        50_000,
  'echr-hudoc':             30_000,
  'eur-lex':                80_000,
  'uk-treaties':            10_000,
  'oecd':                   10_000,
}

const CORPUS_DISPLAY: Record<string, string> = {
  'primary-acts-pre-2000': 'Primary Acts pre-2000',
  'primary-acts-2000plus': 'Primary Acts 2000+',
  'si-pre-2010':           'Statutory Instruments pre-2010',
  'si-2010plus':           'Statutory Instruments 2010+',
  'regional':              'Regional (Scot/Wales/NI)',
  'retained-eu':           'Retained EU Law',
  'fca-regulators':        'FCA Handbook + Regulators',
  'hmrc-codes-guidance':   'HMRC + Guidance',
  'tna-caselaw':           'TNA Find Case Law',
  'hansard-commons-a':     'Hansard Commons A (pre-1981)',
  'hansard-commons-b':     'Hansard Commons B (1981+)',
  'hansard-lords-a':       'Hansard Lords A (pre-1981)',
  'hansard-lords-b':       'Hansard Lords B (1981+)',
  'committees-a':          'Committee Reports A',
  'committees-b':          'Committee Reports B',
  'bailii-tribunals':      'BAILII Tribunals',
  'bailii-eat':            'BAILII EAT',
  'bailii-privy-ni':       'BAILII Privy/NI',
  'echr-hudoc':            'ECHR HUDOC',
  'eur-lex':               'EUR-Lex',
  'uk-treaties':           'UK Treaties',
  'oecd':                  'OECD',
}

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

// ── IngestProgressSnapshot write ─────────────────────────────────────────────

export async function saveProgressSnapshot(
  corpusCounts: Record<string, { compiled: number; failed: number }>,
  capturedAt: Date,
): Promise<void> {
  const pool = getPool()
  for (const [corpus, counts] of Object.entries(corpusCounts)) {
    const label = CORPUS_DISPLAY[corpus] ?? corpus
    const estimated = SECTION_TARGETS[corpus] ?? 0
    await pool.query(`
      INSERT INTO ingest_progress_snapshots
        ("capturedAt", "workerLabel", "sourceKey", "sectionsCompiled", "sectionsEstimated", phase)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [capturedAt, label, corpus, counts.compiled, estimated, 'queue'])
  }
}

// ── Checkpoint aggregate (kept for ETA calculation) ───────────────────────────

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

  for (let id = 1; id <= 10; id++) {
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
  const filled = Math.round((pct / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function pctStr(compiled: number, estimated: number): string {
  if (estimated === 0) return '  n/a'
  return ((compiled / estimated) * 100).toFixed(1).padStart(5) + '%'
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

  // ── Totals ────────────────────────────────────────────────────────────────
  const newPipelineTotal = Object.values(corpusCounts).reduce((s, c) => s + c.compiled, 0)
  const overallCompiled  = neonCount + newPipelineTotal
  const overallPct       = (overallCompiled / TOTAL_ESTIMATED) * 100
  const overallBar       = progressBar(overallPct)

  // ── Per-corpus rows (sorted by compiled desc) ─────────────────────────────
  const corpusOrder = [
    'primary-acts-2000plus', 'primary-acts-pre-2000',
    'si-2010plus', 'si-pre-2010', 'regional', 'retained-eu',
    'tna-caselaw', 'hmrc-codes-guidance', 'fca-regulators',
    'hansard-commons-a', 'hansard-commons-b', 'hansard-lords-a', 'hansard-lords-b',
    'committees-a', 'committees-b',
    'echr-hudoc', 'eur-lex', 'uk-treaties', 'oecd',
    'bailii-tribunals', 'bailii-eat', 'bailii-privy-ni',
  ]

  const corpusLines: string[] = []
  for (const corpus of corpusOrder) {
    const counts = corpusCounts[corpus]
    if (!counts) continue
    const label   = (CORPUS_DISPLAY[corpus] ?? corpus).padEnd(34)
    const target  = SECTION_TARGETS[corpus] ?? 0
    const compiled = counts.compiled
    const pct     = pctStr(compiled, target)
    const bar     = progressBar(target > 0 ? (compiled / target) * 100 : 0, 10)
    const failStr = counts.failed > 0 ? `  (${counts.failed.toLocaleString()} failed)` : ''
    corpusLines.push(`  ${label} ${compiled.toLocaleString().padStart(9)} / ${(target || 0).toLocaleString().padStart(9)}  ${bar} ${pct}${failStr}`)
  }

  // Other corpora not in the known order
  for (const [corpus, counts] of Object.entries(corpusCounts)) {
    if (corpusOrder.includes(corpus)) continue
    const label = (CORPUS_DISPLAY[corpus] ?? corpus).padEnd(34)
    corpusLines.push(`  ${label} ${counts.compiled.toLocaleString().padStart(9)}`)
  }

  const eta = estimateCompletion(agg)

  const parts: string[] = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'SCRUTINISE CORPUS INGEST — OVERALL COVERAGE',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `  ${bst} BST`,
    '',
    `  ${overallBar}  ${overallPct.toFixed(1)}%`,
    `  ${overallCompiled.toLocaleString()} / ${TOTAL_ESTIMATED.toLocaleString()} est. sections`,
    `  ETA: ${eta}`,
    '',
    `  LEGACY (Neon — legislation.gov.uk):  ${neonCount.toLocaleString().padStart(9)}  ✅`,
    `  NEW PIPELINE (10 workers):           ${newPipelineTotal.toLocaleString().padStart(9)}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'PER-CORPUS BREAKDOWN',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ...corpusLines,
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

function estimateCompletion(agg: ProgressAggregate): string {
  if (agg.totalCompleted === 0 || agg.totalEstimated === 0) return 'Insufficient data'
  const remaining = agg.totalEstimated - agg.totalCompleted
  const rate = agg.workers.reduce((sum, w) => sum + w.completed, 0)
  if (rate === 0) return 'No rate data'
  const hoursNeeded = remaining / (rate / 24)
  const eta = new Date(Date.now() + hoursNeeded * 3_600_000)
  return eta.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
