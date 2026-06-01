import { r2Get, r2Put, r2List, PROGRESS_KEY, csvKey } from './r2-client'
import { WorkerCheckpoint, readCheckpoint } from './checkpoint'
import { UnrecognisedFormatRow, FormatCount } from './db-metadata'

const RESEND_API = 'https://api.resend.com/emails'
const TO = 'cl@scrutinise.org'

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

const CORPUS_LABELS: Record<number, string> = {
  1:  'Primary Acts pre-2000',
  2:  'Primary Acts 2000+   ',
  3:  'SIs pre-2010         ',
  4:  'SIs 2010+            ',
  5:  'Regional (Scot/Wales/NI)',
  6:  'Retained EU Law      ',
  7:  'FCA + Regulators     ',
  8:  'HMRC + Codes + Guidance',
  9:  'TNA Case Law         ',
  10: 'International        ',
}

export async function buildAggregate(): Promise<ProgressAggregate> {
  const workers: WorkerSummary[] = []
  let totalCompleted = 0
  let totalEstimated = 0

  for (let id = 1; id <= 10; id++) {
    const cp = await readCheckpoint(id)
    const pct = cp.totalInCorpus > 0
      ? ((cp.completed / cp.totalInCorpus) * 100).toFixed(1) + '%'
      : '0.0%'
    workers.push({
      workerId: id,
      corpus: CORPUS_LABELS[id] ?? `Worker ${id}`,
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
    : '0.0%'

  return {
    timestamp: new Date().toISOString(),
    workers,
    totalCompleted,
    totalEstimated,
    totalPct,
  }
}

export async function writeProgressToR2(agg: ProgressAggregate): Promise<void> {
  await r2Put(PROGRESS_KEY, JSON.stringify(agg, null, 2))
}

export async function appendCsvRow(agg: ProgressAggregate): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  const key = csvKey(today)

  const existing = await r2Get(key)
  const header = 'timestamp,worker_id,corpus,completed,total,pct_complete,failed\n'
  const rows = agg.workers.map(w =>
    `"${agg.timestamp}",${w.workerId},"${w.corpus.trim()}",${w.completed},${w.total},"${w.pct}",${w.failed}`
  ).join('\n') + '\n'

  const content = existing ? existing + rows : header + rows
  await r2Put(key, content, 'text/csv')
}

export async function sendProgressEmail(
  agg: ProgressAggregate,
  unrecognised: UnrecognisedFormatRow[] = [],
  formatBreakdown: FormatCount[] = [],
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) { console.warn('[reporter] RESEND_API_KEY not set — skipping email'); return }

  const bst = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(agg.timestamp))

  const lines = agg.workers.map(w => {
    const status = w.phase1Complete ? '✓' : '⋯'
    const padded = w.corpus.padEnd(24)
    return `  Worker ${w.workerId.toString().padStart(2)}  ${padded}: ${String(w.completed).padStart(7)} / ${String(w.total).padStart(9)} (${w.pct.padStart(6)})  ${status}`
  })

  const bodyParts = [
    'Scrutinise Corpus Ingest — Progress Report',
    `[${bst} BST]`,
    '',
    'PHASE 1 LEGISLATION',
    ...lines,
    '',
    `TOTAL: ${agg.totalCompleted.toLocaleString()} / ${agg.totalEstimated.toLocaleString()} sections compiled (${agg.totalPct})`,
    `Estimated completion: ${estimateCompletion(agg)}`,
    '',
    `Errors: see daily CSV in R2 at ingest-csv/progress-${new Date().toISOString().slice(0, 10)}.csv`,
  ]

  if (formatBreakdown.length > 0) {
    bodyParts.push('')
    bodyParts.push('FORMAT BREAKDOWN (cumulative)')
    for (const row of formatBreakdown) {
      const label = (row.format ?? '(no format)').padEnd(16)
      const count = row.count.toLocaleString().padStart(12)
      bodyParts.push(`  ${label}${count}`)
    }
  }

  if (unrecognised.length > 0) {
    bodyParts.push('')
    bodyParts.push(`UNRECOGNISED FORMATS (last 4hrs): ${unrecognised.length} act(s)`)
    for (const row of unrecognised) {
      bodyParts.push(`  ${row.sourceUrl ?? '(no url)'}`)
      if (row.xmlPreview) {
        bodyParts.push(`    ${row.xmlPreview.replace(/\n/g, ' ')}`)
      }
    }
  }

  const body = bodyParts.join('\n')

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Scrutinise Ingest <ingest@messages.scrutinise.org>',
      to: [TO],
      subject: `Corpus Ingest: ${agg.totalPct} complete — ${bst}`,
      text: body,
    }),
  })

  if (!res.ok) {
    console.error(`[reporter] Resend failed: ${res.status} ${await res.text()}`)
  } else {
    console.log(`[reporter] Email sent to ${TO}`)
  }
}

function estimateCompletion(agg: ProgressAggregate): string {
  if (agg.totalCompleted === 0 || agg.totalEstimated === 0) return 'Insufficient data'
  const remaining = agg.totalEstimated - agg.totalCompleted
  const rate = agg.workers.reduce((sum, w) => sum + w.completed, 0)
  if (rate === 0) return 'No rate data'
  const hoursNeeded = (remaining / (rate / 24))
  const eta = new Date(Date.now() + hoursNeeded * 3600_000)
  return eta.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
