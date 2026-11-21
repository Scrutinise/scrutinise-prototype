// cba-table1.ts — BRIEF_INGEST_CBA_1_EXECUTE §8: TABLE 1 OF THE 2013 OPTIMISM-BIAS GUIDANCE AS ITS OWN REFERENCE TABLE.
// Writing the 31 optimism-bias sections did not close this: Table 1 is flattened text inside them. This is the transcription,
// with its page number, and the only artefact a costing can safely read an uplift from.
//
// Both bounds of both columns. Outsourcing is measured on OPERATING expenditure (the table's own footnote "*"), so it is
// stored as opex, never capex; its works-duration cells are "N/A" in the source and are stored as an [n] STATE, not as zero.
// Values are stored AS PRINTED (per cent: 24, not 0.24).
//
// Verification before any write: (1) every row's six cells are found, in order, on PDF page 2's text layer;
// (2) every value equals Lex's OPTIMISM_BIAS_TABLE_1 (costing-params.ts, page-image re-read 4 Nov) ÷ 100.
//   npx tsx --tsconfig ../tsconfig.json cba-table1.ts            verify only
//   npx tsx --tsconfig ../tsconfig.json cba-table1.ts --apply    verify, write, read back
import { getStatsPrisma } from './lib/db'
import { ingestRows, upsertSeriesBatch, startRefreshLog, finishRefreshLog, type SeriesKey } from './lib/upsert'
import { computeSeriesKey } from './lib/series-key'
import { fetchCached } from './cba-probe'
import { OPTIMISM_BIAS_TABLE_1 } from '../../scrutinise-web/lib/lex/costing-params'
// pdf-parse lives in the ingest package only; this script reads one PDF and is never part of a build.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('../ingest/node_modules/pdf-parse/lib/pdf-parse.js')

export const T1_DATASET = 'gb-optimism-bias-table-1'
const PDF_URL = 'https://assets.publishing.service.gov.uk/media/5a74dae740f0b65f61322c72/Optimism_bias.pdf'
const PAGE = 2
const RELEASE = new Date('2013-04-21T00:00:00Z') // gov.uk first_published_at, "Green Book supplementary guidance: optimism bias"
const PERIOD = { periodType: 'ANNUAL' as const, periodStart: new Date('2013-01-01T00:00:00Z'), periodLabel: 'Table 1 (2013 guidance; Mott MacDonald 2002 evidence base)' }
const NA_TEXT = '[n] = N/A in the source: Table 1 gives no works-duration figure for outsourcing'

// Transcribed from PDF page 2. Columns as printed: Works Duration Upper | Lower, Capital Expenditure Upper | Lower.
type Row = { key: keyof typeof OPTIMISM_BIAS_TABLE_1.value; label: string; pdfLabel: RegExp; works: [number, number] | null; money: [number, number]; opex?: true }
const TABLE_1: Row[] = [
  { key: 'standard-buildings', label: 'Standard buildings', pdfLabel: /^Standard\s+Buildings/, works: [4, 1], money: [24, 2] },
  { key: 'non-standard-buildings', label: 'Non-standard buildings', pdfLabel: /^Non-standard\s+Buildings/, works: [39, 2], money: [51, 4] },
  { key: 'standard-civil', label: 'Standard civil engineering', pdfLabel: /^Standard Civil Engineering/, works: [20, 1], money: [44, 3] },
  { key: 'non-standard-civil', label: 'Non-standard civil engineering', pdfLabel: /^Engineering/, works: [25, 3], money: [66, 6] }, // label wraps: "Non-standard Civil" / "Engineering"
  { key: 'equipment-and-development', label: 'Equipment/development', pdfLabel: /^Equipment\/Development/, works: [54, 10], money: [200, 10] },
  { key: 'outsourcing', label: 'Outsourcing', pdfLabel: /^Outsourcing/, works: null, money: [41, 0], opex: true },
]

async function pageLines(buf: Buffer, page: number): Promise<string[]> {
  const lines: string[] = []
  let n = 0
  await pdfParse(buf, {
    pagerender: async (p: any) => {
      n++
      if (n !== page) return ''
      const tc = await p.getTextContent()
      const rows: Record<number, Array<[number, string]>> = {}
      for (const it of tc.items) (rows[Math.round(it.transform[5])] ||= []).push([it.transform[4], it.str])
      for (const y of Object.keys(rows).map(Number).sort((a, b) => b - a))
        lines.push(rows[y].sort((a, b) => a[0] - b[0]).map((x) => x[1]).join(' ').replace(/\s+/g, ' ').trim())
      return ''
    },
  })
  return lines
}

async function main() {
  const apply = process.argv.includes('--apply')
  let fail = 0, ran = 0, ctrls = 0, dead = 0
  const ok = (n: string, c: boolean, s: string) => { ran++; if (!c) fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n} — ${s}`) }
  const ctrl = (n: string, c: boolean, s: string) => { ctrls++; if (!c) dead++; console.log(`${c ? 'CTRL fired' : 'CTRL DEAD '}  ${n} — ${s}`) }

  const lines = await pageLines(await fetchCached(PDF_URL, 'optimism-bias-2013.pdf'), PAGE)
  ok(`PDF page ${PAGE} carries the table title and the four column headings`, lines.some((l) => /^Table 1: Recommended Adjustment Ranges/.test(l))
    && lines.some((l) => /Works Duration/.test(l) || (/Works/.test(l) && /Capital/.test(l))) && lines.some((l) => /^Upper Lower Upper Lower$/.test(l)), lines.slice(0, 8).join(' ¦ '))
  const cellsOf = (r: Row) => [...(r.works ? r.works.map(String) : ['N/A', 'N/A']), ...r.money.map((v) => (r.opex ? `${v}*` : String(v)))]
  for (const r of TABLE_1) {
    const line = lines.find((l) => r.pdfLabel.test(l)) ?? ''
    const nums = line.replace(r.pdfLabel, '').trim().split(' ')
    ok(`${r.label}: the six printed cells are on page ${PAGE} in order`, JSON.stringify(nums.slice(-4)) === JSON.stringify(cellsOf(r)), `page: "${line}" vs transcribed ${cellsOf(r).join(' ')}`)
    const lex = OPTIMISM_BIAS_TABLE_1.value[r.key]
    const money = r.opex ? lex.opex : lex.capex
    const same = !!money && money.upper * 100 === r.money[0] && Math.round(money.lower * 100) === r.money[1]
      && (r.works ? !!lex.works && Math.round(lex.works.upper * 100) === r.works[0] && Math.round(lex.works.lower * 100) === r.works[1] : lex.works === null)
      && (r.opex ? !lex.capex : !lex.opex)
    ok(`${r.label}: equals Lex's OPTIMISM_BIAS_TABLE_1 (÷100), opex/capex the same way round`, same, JSON.stringify(lex))
  }
  ok('the footnote says outsourcing is measured on operating expenditure', lines.some((l) => /optimism bias for outsourcing project ?s is measured for operating expenditure/.test(l)), lines.find((l) => /outsourcing/.test(l)) ?? 'absent')
  const wrong: Row = { ...TABLE_1[4], money: [20, 10] }
  ctrl('the page check refuses a mistranscribed cell (200 → 20)', JSON.stringify((lines.find((l) => wrong.pdfLabel.test(l)) ?? '').replace(wrong.pdfLabel, '').trim().split(' ').slice(-4)) !== JSON.stringify(cellsOf(wrong)), 'equipment capex upper 20')

  if (apply && fail === 0 && dead === 0) {
    const prisma = getStatsPrisma()
    const d = {
      id: T1_DATASET, source: 'HMT' as const, title: 'Green Book supplementary guidance: optimism bias (2013) — Table 1, Recommended Adjustment Ranges',
      description: 'Both bounds of Works Duration and Capital Expenditure, per cent, by project type. Outsourcing is OPERATING expenditure (footnote *) and has no works-duration figure ([n]). Indicative starting values (gb-optimism-bias:3.6); never adjusts a headline NPV (decision 342).',
      cofogRelevant: false, licence: 'Open Government Licence v3.0', licenceUrl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
      refreshCadence: 'STATIC' as const, sourceUrl: 'https://www.gov.uk/government/publications/green-book-supplementary-guidance-optimism-bias',
      sourceEditionOrVersion: `Optimism_bias.pdf (21 April 2013), Table 1, PDF page ${PAGE} (printed page 2 of 15)`,
    }
    await prisma.statDataset.upsert({ where: { id: d.id }, create: { ...d, licenceVerifiedAt: new Date() }, update: { ...d, licenceVerifiedAt: new Date() } })
    const log = await startRefreshLog(T1_DATASET)
    const s = (r: Row, col: string, bound: 'upper' | 'lower'): SeriesKey => ({
      datasetId: T1_DATASET, sourceSeriesId: `table-1:p${PAGE}:${r.key}:${col}:${bound}`, geography: 'GB', measure: `optimism_bias_${col}_${bound}`, unit: 'PERCENT',
      cofogFunctionCode: null, forecastVintage: null, seriesLabel: `Optimism bias Table 1 (PDF p.${PAGE}) — ${r.label} — ${col === 'works_duration' ? 'Works Duration' : col === 'opex' ? 'Operating Expenditure (outsourcing, footnote *)' : 'Capital Expenditure'} — ${bound}`,
    })
    const basis = 'not monetary: per cent uplift as printed (24 = 24%); indicative starting value, gb-optimism-bias:3.6'
    const values = [] as Parameters<typeof ingestRows>[0]
    const na: SeriesKey[] = []
    for (const r of TABLE_1) {
      const money = r.opex ? 'opex' : 'capex'
      values.push({ series: s(r, money, 'upper'), obs: { ...PERIOD, value: r.money[0], status: 'outturn', releaseDate: RELEASE, priceBasis: basis } })
      values.push({ series: s(r, money, 'lower'), obs: { ...PERIOD, value: r.money[1], status: 'outturn', releaseDate: RELEASE, priceBasis: basis } })
      if (r.works) {
        values.push({ series: s(r, 'works_duration', 'upper'), obs: { ...PERIOD, value: r.works[0], status: 'outturn', releaseDate: RELEASE, priceBasis: basis } })
        values.push({ series: s(r, 'works_duration', 'lower'), obs: { ...PERIOD, value: r.works[1], status: 'outturn', releaseDate: RELEASE, priceBasis: basis } })
      } else na.push(s(r, 'works_duration', 'upper'), s(r, 'works_duration', 'lower'))
    }
    const res = await ingestRows(values)
    const ids = await upsertSeriesBatch(na)
    for (const k of na) {
      const seriesId = ids.get(computeSeriesKey(k))!
      await prisma.statSuppressedCell.upsert({
        where: { seriesId_periodType_periodStart: { seriesId, periodType: PERIOD.periodType, periodStart: PERIOD.periodStart } },
        create: { seriesId, ...PERIOD, marker: 'n', markerText: NA_TEXT, releaseDate: RELEASE, priceBasis: basis },
        update: { marker: 'n', markerText: NA_TEXT, releaseDate: RELEASE, priceBasis: basis },
      })
    }
    await finishRefreshLog(log, T1_DATASET, 'SUCCESS', { seriesUpserted: res.series + ids.size, observationsUpserted: res.observations + na.length })
    const back = await prisma.$queryRawUnsafe<any[]>(
      `SELECT s.measure, s."seriesLabel" l, o.value::float8 v, o."releaseDate" rd FROM stat_observation o JOIN stat_series s ON s.id = o."seriesId"
        WHERE s."datasetId" = $1 ORDER BY s."sourceSeriesId"`, T1_DATASET)
    const sup = await prisma.$queryRawUnsafe<any[]>(
      `SELECT s."seriesLabel" l, c.marker FROM stat_suppressed_cell c JOIN stat_series s ON s.id = c."seriesId" WHERE s."datasetId" = $1`, T1_DATASET)
    const expect = new Map(values.map((v) => [v.series.seriesLabel, v.obs.value]))
    const agree = back.length === values.length && back.every((b) => expect.get(b.l) === b.v) && sup.length === 2 && sup.every((x) => x.marker === 'n')
    ok('READ BACK: every stored cell equals the transcription; the two N/A cells are [n] states', agree, `${back.length} values (expected ${values.length}), ${sup.length} [n] cells; opex rows ${back.filter((b) => /opex/.test(b.measure)).length}, capex rows ${back.filter((b) => /capex/.test(b.measure)).length}`)
    await prisma.$disconnect()
  } else if (apply) console.log('NOT WRITTEN — verification failed')
  console.log(`\n${ran} ran, ${ran - fail} passed, ${fail} failed; ${ctrls} controls, ${dead} dead`)
  if (fail || dead) process.exitCode = 1
}
main().catch((e) => { console.error(e); process.exit(1) })
