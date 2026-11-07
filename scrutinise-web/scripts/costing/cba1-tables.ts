// ─────────────────────────────────────────────────────────────────────────────
// BRIEF_INGEST_CBA_1 §5.3 pilot, §2 rows 1 and 3. DRY RUN — reads Neon, writes nothing.
//
//  A. GDP deflators: the latest HMT release (October 2026 Budget) parsed by m3-deflators.ts's own
//     rule, compared with what DeflatorSeries holds (loaded 4 Jul 2026 from the June 2026 QNA).
//  B. Civil Service Statistics 2026: what the statistical tables actually contain — sheet by sheet —
//     and a read-back of the median-salary-by-grade and headcount-by-department tables.
//
//   npx tsx scripts/costing/cba1-tables.ts
// Output: ../docs/ingest_traces/cba1_pilot_tables.json
// ─────────────────────────────────────────────────────────────────────────────
import { join } from 'path'
import { writeFileSync } from 'fs'
import * as XLSX from 'xlsx'
import { neonPrisma, download, CACHE_DIR } from './util'

const DEFLATOR_URL = 'https://assets.publishing.service.gov.uk/media/6ae32ab0a5c2f99e3a7b82e3/GDP_Deflators_Budget_October_2026_update.xlsx'
const CSS_URL = 'https://assets.publishing.service.gov.uk/media/6ad7476437f279373fa3c9c9/Statistical_tables_-_Civil_Service_Statistics_2026_V2.ods'

async function main() {
  const out: any = {}
  const prisma = neonPrisma()

  // ── A ──
  const wb = XLSX.read(await download(DEFLATOR_URL, join(CACHE_DIR, 'gdp-deflators-oct-2026-budget.xlsx')), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true })
  const head = rows.slice(0, 8).map(r => (r ?? []).filter(x => x != null && x !== '').join(' | ')).filter(Boolean)
  const fresh: { year: number; index: number }[] = []
  for (const r of rows) {
    const m = typeof r?.[1] === 'string' && (r[1] as string).trim().match(/^(\d{4})-\d{2}$/)
    if (m && typeof r?.[2] === 'number' && isFinite(r[2] as number)) fresh.push({ year: +m[1], index: r[2] as number })
  }
  const held = await prisma.deflatorSeries.findMany({ orderBy: { year: 'asc' } })
  const base = 2019
  const fb = fresh.find(f => f.year === base)!.index, hb = held.find(h => h.year === base)!.index
  const diffs = held.map(h => { const f = fresh.find(x => x.year === h.year); return f ? { year: h.year, heldRel: h.index / hb, freshRel: f.index / fb, pct: 100 * ((f.index / fb) / (h.index / hb) - 1) } : { year: h.year, missing: true } as any })
  const worst = diffs.filter(d => !d.missing).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 6)
  out.deflators = { source: DEFLATOR_URL, sheetHead: head, freshRows: fresh.length, freshYears: [fresh[0]?.year, fresh.at(-1)?.year], freshLatest: fresh.at(-1), heldRows: held.length, heldYears: [held[0]?.year, held.at(-1)?.year], heldLatest: held.at(-1), heldUpdatedAt: held.at(-1)?.updatedAt, rebasedTo: base, worstRevisions: worst, recent: diffs.filter(d => d.year >= 2018) }
  console.log('\n== A. GDP deflators (dry run)')
  console.log('  sheet head:', head.slice(0, 4))
  console.log(`  fresh: ${fresh.length} outturn rows ${fresh[0]?.year}–${fresh.at(-1)?.year}, latest ${JSON.stringify(fresh.at(-1))}`)
  console.log(`  held:  ${held.length} rows ${held[0]?.year}–${held.at(-1)?.year}, latest ${JSON.stringify({ year: held.at(-1)?.year, index: held.at(-1)?.index })}, loaded ${held.at(-1)?.updatedAt.toISOString()}`)
  console.log(`  largest revisions (rebased ${base}=1):`, worst.map(w => `${w.year} ${w.pct.toFixed(2)}%`).join(', '))
  console.log('  recent:', diffs.filter(d => d.year >= 2020).map(d => d.missing ? `${d.year} missing` : `${d.year} ${d.pct.toFixed(2)}%`).join(', '))

  // ── B ──
  const css = XLSX.read(await download(CSS_URL, join(CACHE_DIR, 'civil-service-statistics-2026-v2.ods')), { type: 'buffer' })
  const sheets = css.SheetNames.map(n => {
    const r = XLSX.utils.sheet_to_json<unknown[]>(css.Sheets[n], { header: 1, raw: true, blankrows: false })
    const title = r.slice(0, 5).map(x => (x ?? []).filter(Boolean).join(' ')).find(t => t && !/^back to contents$/i.test(t.trim())) ?? ''
    return { name: n, rows: r.length, title: String(title).slice(0, 200) }
  })
  out.css = { source: CSS_URL, sheets }
  console.log(`\n== B. Civil Service Statistics 2026 V2: ${sheets.length} sheets`)
  for (const s of sheets) console.log(`  ${s.name} (${s.rows} rows): ${s.title}`)
  const pick = (re: RegExp) => sheets.filter(s => re.test(s.title))
  const want = [...pick(/median.*(salary|pay).*(responsibility|grade)|(responsibility|grade).*median/i).slice(0, 2), ...pick(/department.*(responsibility|grade)|(responsibility|grade).*department/i).slice(0, 2)]
  out.css.readback = {}
  for (const s of want) {
    const r = XLSX.utils.sheet_to_json<unknown[]>(css.Sheets[s.name], { header: 1, raw: true, blankrows: false })
    const lines = r.slice(0, 18).map(x => (x ?? []).map(v => v == null ? '' : String(v)).join(' | ').slice(0, 260))
    out.css.readback[s.name] = { title: s.title, rows: r.length, first: lines }
    console.log(`\n  -- ${s.name}: ${s.title}`)
    for (const l of lines) console.log('     ' + l)
  }
  writeFileSync(join(__dirname, '../../../docs/ingest_traces/cba1_pilot_tables.json'), JSON.stringify(out, null, 2))
  console.log('\nWROTE docs/ingest_traces/cba1_pilot_tables.json')
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
