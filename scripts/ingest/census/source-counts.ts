// Non-legislation source counts — uses actual source client code where possible
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getTotalJudgments } from '../sources/tna-caselaw'
import { countGbrDocs } from '../sources/echr-hudoc'
import { countHansardDebates } from '../sources/parliament-api'
import { FCA_KNOWN_SOURCEBOOKS } from '../sources/fca-handbook'

const WQS_BASE = 'https://questions-statements-api.parliament.uk'

async function getWrittenAnswersTotal(): Promise<number> {
  // Chunked: count per year 2000–2025 to avoid timeout
  let total = 0
  for (let year = 2000; year <= 2025; year++) {
    try {
      const from = `${year}-01-01`
      const to = `${year}-12-31`
      const res = await fetch(
        `${WQS_BASE}/api/writtenquestions/questions?answeredWhenFrom=${from}&answeredWhenTo=${to}&take=1`,
        { signal: AbortSignal.timeout(20_000) }
      )
      if (!res.ok) continue
      const data = await res.json() as { totalResults?: number }
      total += data?.totalResults ?? 0
    } catch { /* skip year */ }
  }
  return total
}

async function getWrittenStatementsTotal(): Promise<number> {
  try {
    const res = await fetch(
      `${WQS_BASE}/api/writtenstatements/statements?madeWhenFrom=1997-05-01&take=1`,
      { signal: AbortSignal.timeout(20_000) }
    )
    if (!res.ok) return 0
    const data = await res.json() as { totalResults?: number }
    return data?.totalResults ?? 0
  } catch { return 0 }
}

async function run() {
  console.log('Querying sources in parallel...\n')

  const [caselaw, echr, commons, lords, writtenStatements, writtenAnswers] = await Promise.allSettled([
    getTotalJudgments(),
    countGbrDocs().then(n => n ?? 0),
    countHansardDebates('Commons', '2000-01-01', new Date().toISOString().slice(0, 10)),
    countHansardDebates('Lords', '2000-01-01', new Date().toISOString().slice(0, 10)),
    getWrittenStatementsTotal(),
    getWrittenAnswersTotal(),
  ])

  const val = (r: PromiseSettledResult<number>) =>
    r.status === 'fulfilled' ? r.value : `error: ${r.reason}`

  const results = [
    { source: 'TNA Find Case Law',     total: val(caselaw),           est_sections: val(caselaw),           note: '1 section per judgment' },
    { source: 'ECHR HUDOC (UK)',        total: val(echr),              est_sections: val(echr),              note: '1 section per judgment' },
    { source: 'Hansard Commons (2000+)',total: val(commons),           est_sections: typeof val(commons) === 'number' ? (val(commons) as number) * 5 : val(commons), note: '~5 sections/debate est.' },
    { source: 'Hansard Lords (2000+)',  total: val(lords),             est_sections: typeof val(lords) === 'number' ? (val(lords) as number) * 5 : val(lords),   note: '~5 sections/debate est.' },
    { source: 'Written Statements',     total: val(writtenStatements), est_sections: val(writtenStatements), note: '1 section per statement' },
    { source: 'Written Answers',        total: val(writtenAnswers),    est_sections: val(writtenAnswers),    note: '1 section per answer' },
    { source: 'FCA Handbook',           total: `${FCA_KNOWN_SOURCEBOOKS.length} sourcebooks`, est_sections: '~150,000 est.', note: 'Full scrape needed for exact count' },
  ]

  for (const r of results) {
    console.log(`${r.source}: total=${r.total}`)
  }

  console.log('\n=== SOURCE COUNTS SUMMARY ===')
  console.table(results)
}

run().catch(e => { console.error(e); process.exit(1) })
