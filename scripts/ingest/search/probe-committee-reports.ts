/**
 * probe-committee-reports.ts — which committee REPORTS are actually ingested?
 *
 * The last step before drafting candidate gold questions, and the one that makes them
 * evidence-led rather than a third guess. composition showed committees-reports is 71.6%
 * correspondence and only 10.4% ("Report:", 2,575 rows) the substantive inquiry reports that
 * carry conclusions. CM1's subject (Carillion) has no report row at all — only two pieces of
 * academic written evidence — which is why every conclusion phrase probed came back absent.
 *
 * So: list the report titles that DO exist, and draft questions against those. Drafting from
 * famous inquiries recalled from memory is what produced CM1–CM4, three of which cannot
 * discriminate and one of which (CM1) scores 100% while returning zero committee documents.
 *
 * Read-only.  Usage: tsx search/probe-committee-reports.ts [--grep=covid]
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'

const arg = (n: string) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : null }
const GREP = arg('grep')

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)
  const rows = await tbl.query()
    .where(`tier = 'parliamentary' AND corpus = 'committees-reports'`)
    .select(['id', 'sectionTitle'])
    .toArray() as any[]

  const reports = rows.filter((r) => /^Report:/i.test((r.sectionTitle ?? '').trim()))
  // One inquiry spans many rows (a report is chunked into sections), so collapse to the
  // distinct inquiry title — the count that matters is inquiries available to ask about,
  // not rows.
  const byTitle = new Map<string, number>()
  for (const r of reports) {
    const t = (r.sectionTitle ?? '').replace(/^Report:\s*/i, '').replace(/\s+/g, ' ').trim()
    byTitle.set(t, (byTitle.get(t) ?? 0) + 1)
  }
  const entries = [...byTitle.entries()]
    .filter(([t]) => !GREP || t.toLowerCase().includes(GREP.toLowerCase()))
    .sort((a, b) => b[1] - a[1])

  console.log(`[reports] ${reports.length} 'Report:' rows over ${byTitle.size} distinct inquiry titles${GREP ? ` (filtered on "${GREP}")` : ''}\n`)
  for (const [t, n] of entries.slice(0, 60)) console.log(`   ${String(n).padStart(4)} rows  ${t.slice(0, 130)}`)
  if (entries.length > 60) console.log(`\n   … and ${entries.length - 60} more`)
}

main().catch((e) => { console.error('[reports] FATAL', e instanceof Error ? e.stack ?? e.message : e); process.exit(1) })
