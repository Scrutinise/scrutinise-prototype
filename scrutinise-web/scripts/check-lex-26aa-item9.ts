// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26aa9 — LEX 26-AA item 9 (CCh's GO of 20 Nov 17:50; from cc-ingest's CBA-1 EXECUTE message of 17:36). Counts what RAN.
//
//   a · GMCA attribution (CC BY 4.0): read from the row's own notes, exactly; carried by the engine into the result, section 5's summary,
//       the report and the costing; on the benefit picker's rows (the route), and never the notes themselves.
//   b · the citation key grammar takes annex tables (green-book:table-A.1): typed, normalised, keyed from its held row; paragraph and
//       numbered-table keys unchanged.
//   c · the stats reader: a value with its release date and price basis; a suppressed cell as its marker and the publisher's words, never
//       0; decision 340's fallback named; the deflator series matched to its dated release year by year; the engine's Gaps say what is
//       held and what is not applied, never "not available"; Lex's query_stats shows a suppressed cell instead of dropping it.
//   d · the manifest at runtime: Ingest's file is bundled under scrutinise-web, byte-identical to docs/manifests/ while both exist; every
//       one of its keys agrees with its held row; a re-pointed or unheld key is left out, named (planted controls).
//
// READS ONLY: 452c5ade is read (the engine and one GET), never written. Nothing is spent.
//   npm run check:lex-26aa9
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { attributionOf, attributionWords } from '../lib/lex/cba/attribution'
import { normaliseKey, checkCitation, keyOfRow, manifestFromFile, manifestFromFileAndRows, MANIFEST_DOCS, type Manifest } from '../lib/lex/cba/citation-manifest-pure'
import { loadManifestWithReport, heldRowsManifest } from '../lib/lex/cba/citation-manifest'
import { runCba } from '../lib/lex/cba/engine'
import { cbaSummary } from '../lib/lex/cba/summary-pure'
import { buildCbaReport } from '../lib/documents/build-cba-report'
import { costingCompanionBody } from '../lib/lex/cba/costing-companion'
import { readCell, cssSalaryFloor, deflatorRelease, CSS_DATASET } from '../lib/stats/cba-cells'
import { cellWords, cellValue, css7Key } from '../lib/stats/cell-pure'
import { runQueryStats, formatStatsForPrompt } from '../lib/lex/tools/query-stats'
import { CBA_UI } from '../lib/lex/screen-labels'

const ROOT = join(__dirname, '..')
let ran = 0, pass = 0, fail = 0, controls = 0, dead = 0
const ok = (name: string, cond: boolean, detail?: unknown) => {
  ran++
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 300)}`}`) }
}
const control = (name: string, cond: boolean, detail?: unknown) => { controls++; if (!cond) dead++; ok(`control: ${name}`, cond, detail) }
const section = (s: string) => console.log(`\n${s}`)
const setUser = (u: unknown) => { (globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = u }

const GMCA_FORM = 'Unit Cost Database v3.0, Greater Manchester Combined Authority (updated autumn 2025), https://www.greatermanchester-ca.gov.uk/what-we-do/research/research-cost-benefit-analysis/ — licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)'

async function partA(ideaId: string) {
  section('a · GMCA attribution')
  const rows = await prisma.costBenchmark.findMany({ where: { id: { startsWith: 'm4-' } }, select: { id: true, notes: true } })
  const words = rows.map((r) => attributionWords(attributionOf(r.notes)))
  ok(`all ${rows.length} GMCA rows yield GMCA's attribution, in exactly the form it asks for`, rows.length === 30 && words.every((w) => w === GMCA_FORM), words.find((w) => w !== GMCA_FORM))
  const others = await prisma.costBenchmark.findMany({ where: { NOT: { id: { startsWith: 'm4-' } } }, select: { id: true, notes: true } })
  const otherReq = others.filter((r) => attributionOf(r.notes).required)
  control(`a row with no licence demand carries none (${others.length} non-GMCA rows; required: ${otherReq.length})`, otherReq.length === 0, otherReq.map((r) => r.id).join(', '))
  control('notes that demand attribution in an unreadable form are not shown bare: a worded "see the source"', attributionWords(attributionOf('licence=cc-by-4.0; attribution required, but the form is missing')) === 'Attribution required by the source’s licence: see the source.')

  // the engine, the summary, the report and the costing — on the real idea, read only, with one GMCA-sourced line planted IN MEMORY
  const run = await runCba(ideaId)
  if (!run || !run.result.ok) { ok('the engine runs on 452c5ade', false, run?.result); return }
  const input = { ...run.inputs.input, costs: [...run.inputs.input.costs, { ...(run.inputs.input.costs[0] ?? {}), id: 'zz-gmca', label: 'ZZ planted GMCA line', costType: 'OTHER', low: 100, high: 200, priceYear: 2025, recurrence: 'ONE_OFF' as const, durationMonths: null, basis: 'planted', citationKey: null, benchmarkId: rows[0].id, attribution: words[0], appraisal: (run.inputs.input.costs[0]?.appraisal ?? { payer: null, onCost: null, ob: null }) } as never] }
  const { computeCba } = await import('../lib/lex/cba/engine-pure')
  const r = computeCba(input)
  if (!r.ok) { ok('the engine runs with the planted line', false, (r as { error: string }).error); return }
  ok('the engine carries the attribution of a line whose figure came from a GMCA row', r.attributions.includes(GMCA_FORM), r.attributions.join(' | '))
  control('…and without that line, the real idea (no GMCA line today) carries none', run.result.ok && (run.result as { attributions: string[] }).attributions.length === 0, (run.result as { attributions: string[] }).attributions.join(' | '))
  ok('section 5\'s summary carries it', cbaSummary(r).attributions.includes(GMCA_FORM))
  const report = buildCbaReport(r, null, { ideaTitle: 'x', version: 1, heldOn: '2026-11-21', generatedAt: new Date(), narrativeNote: null })
  const reportText = JSON.stringify(report.model)
  ok(`the report prints it under "${CBA_UI.attribution.toUpperCase()}"`, reportText.includes(CBA_UI.attribution.toUpperCase()) && reportText.includes('licensed under CC BY 4.0'))
  const companion = costingCompanionBody(r, null, '2026-11-21', null)
  ok(`the costing prints it under "## ${CBA_UI.attribution}"`, companion.includes(`## ${CBA_UI.attribution}\n- ${GMCA_FORM}`))
  control('a costing with no licensed figure has no attribution section', !costingCompanionBody(run.result as never, null, '2026-11-21', null).includes(`## ${CBA_UI.attribution}`))

  // the benefit picker's route: each row carries its attribution, and the notes themselves do not travel
  const idea = await prisma.idea.findUniqueOrThrow({ where: { id: ideaId }, select: { creatorId: true } })
  const action = await prisma.lexCoherentAction.findFirst({ where: { ideaId, status: 'LIVE' }, select: { id: true } })
  if (!action) { ok('452c5ade has a live action', false); return }
  setUser(await prisma.user.findUniqueOrThrow({ where: { id: idea.creatorId } }))
  try {
    const { GET } = await import('../app/api/ideas/[id]/benefit-lines/route')
    const res = await GET(new Request(`http://x/?actionId=${action.id}`), { params: Promise.resolve({ id: ideaId }) })
    const body = await res.json() as { benchmarks: Array<{ id: string; attribution: string | null; notes?: unknown }> }
    const m4 = body.benchmarks.filter((b) => b.id.startsWith('m4-'))
    ok(`the benefit picker's rows (GET /benefit-lines): every GMCA row carries the attribution (${m4.length})`, res.status === 200 && m4.length === 30 && m4.every((b) => b.attribution === GMCA_FORM))
    ok('…and no row carries its notes', body.benchmarks.every((b) => !('notes' in b)))
    control('…a non-GMCA row carries no attribution', body.benchmarks.filter((b) => !b.id.startsWith('m4-')).every((b) => b.attribution == null))
  } finally { setUser(undefined) }
  const src = (p: string) => readFileSync(join(ROOT, p), 'utf8')
  ok('the screens draw it: section 5 (data-cba-attributions), the benefit picker and its saved line, the cost-range picker (data-bench-attribution)',
    /data-cba-attributions/.test(src('components/lex/DeepeningCostsBenefits.tsx')) && (src('components/lex/ActionCbaLines.tsx').match(/data-bench-attribution/g) ?? []).length === 2 && /data-bench-attribution/.test(src('components/lex/FieldsPanel.tsx')))
}

async function partB() {
  section('b · the citation key grammar takes annex tables')
  ok('"green book table A.1", "Green Book: Table A.1" and "green-book:table-a.1" all normalise to green-book:table-A.1', ['green book table A.1', 'Green Book: Table A.1', 'green-book:table-a.1'].every((s) => normaliseKey(s) === 'green-book:table-A.1'), ['green book table A.1', 'Green Book: Table A.1', 'green-book:table-a.1'].map(normaliseKey).join(', '))
  control('paragraph and numbered-table keys are unchanged: "Green Book 6.58" → green-book:6.58; "green book table 1" → green-book:table-1', normaliseKey('Green Book 6.58') === 'green-book:6.58' && normaliseKey('green book table 1') === 'green-book:table-1')
  const doc = MANIFEST_DOCS[0]
  const k = keyOfRow({ id: 'x', parentDocId: doc.docId, sectionTitle: 'The Green Book › Annex A › Table: Table A.1 Discount factors', sourceUrl: null })
  ok('a held row titled "… › Table: Table A.1 …" is keyed green-book:table-A.1, labelled "Table A.1"', k?.key === 'green-book:table-A.1' && /Table A\.1$/.test(k.label), JSON.stringify(k))
  const { manifest } = await loadManifestWithReport({ fresh: true })
  const c = checkCitation('green book table A.1', manifest)
  ok('it is CITABLE: checkCitation accepts it against the manifest the platform uses', c.ok && c.key === 'green-book:table-A.1', JSON.stringify(c).slice(0, 200))
  const bad = checkCitation('green-book:table-Z.9', manifest)
  control('an annex table that is not held is refused as "not a paragraph the platform holds" (a valid shape, not held)', !bad.ok && /is not a paragraph the platform holds/.test((bad as { error: string }).error), (bad as { error: string }).error)
}

async function partC(ideaId: string) {
  section('c · the stats reader — release, basis, suppression; the engine\'s Gaps')
  const all = await readCell(CSS_DATASET, css7Key('ALL'))
  ok('a value carries its release date (as a date, not shifted a day) and its price basis', all.kind === 'value' && all.value === 37820 && all.releaseDate === '2026-07-29' && /gross median annual salary/.test(all.priceBasis ?? ''), JSON.stringify(all))
  const supKey = "table_25|Attorney General's Departments › Attorney General's Office|Median salary of all civil servants working at Senior Civil Service level"
  const sup = await readCell(CSS_DATASET, supKey)
  ok('a suppressed cell is its marker and the publisher\'s words: "[c] confidential and suppressed …"', sup.kind === 'suppressed' && sup.marker === 'c' && cellWords(sup).startsWith('[c] confidential and suppressed'), cellWords(sup))
  control('…and is never a number (cellValue is null, the words contain no "0" or "£")', cellValue(sup) === null && !/£|\b0\b/.test(cellWords(sup)))
  const floor = await cssSalaryFloor('SCS', "Attorney General's Departments › Attorney General's Office")
  ok('decision 340: a body\'s suppressed salary shows as suppressed AND names its fallback, the grade across all departments (£95,540)', floor.cell.kind === 'suppressed' && floor.fallback?.cell.kind === 'value' && cellWords(floor.fallback.cell) === '£95,540' && /across all departments/.test(floor.fallback.words), JSON.stringify(floor).slice(0, 300))
  const absent = await readCell(CSS_DATASET, 'table_7|No such level|Median salary of all civil servants')
  control('a series that does not exist is "absent", with why — not a zero', absent.kind === 'absent' && /no series/.test(cellWords(absent)))

  const defl = await prisma.deflatorSeries.findMany({ select: { year: true, index: true }, orderBy: { year: 'asc' } })
  const rel = await deflatorRelease(defl)
  ok(`the deflator series held (${defl.length} years) IS a dated release, matched year by year: June 2026 (QNA), released 2026-06-30`, rel.held && /June 2026/.test(rel.vintage ?? '') && rel.releaseDate === '2026-06-30' && rel.yearsCompared === defl.length, JSON.stringify(rel))
  const altered = defl.map((d, i) => (i === 10 ? { ...d, index: d.index + 1 } : d))
  const relBad = await deflatorRelease(altered)
  control('one year altered by 1 index point matches no release, and says which', !relBad.held && /1 of \d+ years differ/.test(relBad.why ?? ''), relBad.why)

  const run = await runCba(ideaId)
  if (!run || !run.result.ok) { ok('the engine runs', false); return }
  const held = run.inputs.input.held
  ok('the engine reads what is held from the statistics database: Civil Service Statistics, the deflator\'s release, and Ingest\'s manifest file', held.civilServiceStatistics && held.deflatorReleaseDates && held.manifest === 'file', JSON.stringify(held).slice(0, 300))
  const gaps = (run.result as { gaps: Array<{ text: string }> }).gaps.map((g) => g.text)
  ok('the Gaps no longer say any of the three is "not yet held"', !gaps.some((g) => /Not yet held by the platform/.test(g)), gaps.find((g) => /Not yet held/.test(g)))
  ok('…and no Gap still says a staffing level is "not yet matched" (decision 360 matched it)', !gaps.some((g) => /not yet matched/.test(g)), gaps.find((g) => /not yet matched/.test(g)))
  const assumptions = (run.result as { assumptions: Array<{ text: string }> }).assumptions.map((a) => a.text)
  ok('the Assumptions name the deflator\'s release: "… June 2026 (Quarterly National Accounts), released 30 Jun 2026 (index, 2025-26 = 100)"', assumptions.some((a) => /GDP deflator at market prices, June 2026 \(Quarterly National Accounts\), released 30 Jun 2026 \(index, 2025-26 = 100\)/.test(a)), assumptions.find((a) => /deflator/.test(a)))

  // ── decision 360 (C, part A): staffing lines planted IN MEMORY (452c5ade has none today) against the REAL held Table 7 cells ──
  // Answer key: Table 7, all departments, gross median at 31 March 2026 (CBA-1 EXECUTE read-back): EO £32,140 · HEO/SEO £43,930 · G6/G7 £65,830.
  const { computeCba, STAFF_GRADE_ASSUMED } = await import('../lib/lex/cba/engine-pure')
  const { costingCompanionBody } = await import('../lib/lex/cba/costing-companion')
  const KEY = { EO: 32140, HEO_SEO: 43930, G6_G7: 65830 }
  ok('360: the grade cells the engine reads are Table 7\'s, value for value (EO £32,140, HEO/SEO £43,930, G6/G7 £65,830)', (Object.keys(KEY) as Array<keyof typeof KEY>).every((g) => { const c = held.css?.floors?.[g]; return c?.kind === 'value' && c.value === KEY[g] }), JSON.stringify(held.css?.floors).slice(0, 300))
  ok('360: the mapping is JUNIOR = EO, MID = HEO/SEO, SENIOR = G6/G7; the Senior Civil Service is never assumed', STAFF_GRADE_ASSUMED.JUNIOR === 'EO' && STAFF_GRADE_ASSUMED.MID === 'HEO_SEO' && STAFF_GRADE_ASSUMED.SENIOR === 'G6_G7' && !Object.values(STAFF_GRADE_ASSUMED).includes('SCS' as never))
  const base = run.inputs.input.costs[0]
  const staffLine = (id: string, o: Record<string, unknown>) => ({ ...(base ?? {}), id, actionNumber: 1, label: id, costType: 'STAFF', low: 40000, high: 50000, priceYear: 2025, recurrence: 'PER_YEAR' as const, durationMonths: 12, basis: null, citationKey: null, benchmarkId: null, appraisal: { payer: null, onCost: null, ob: null }, staffLevel: null, fteCount: null, ...o }) as never
  const planted = [
    staffLine('ZZ mid one post', { staffLevel: 'MID', fteCount: 1 }),            // 40,000–50,000 against 43,930: the low end is below
    staffLine('ZZ junior two posts', { staffLevel: 'JUNIOR', fteCount: 2, low: 70000, high: 70000 }), // 70,000 against 2 × 32,140 = 64,280: above
    staffLine('ZZ senior no fte', { staffLevel: 'SENIOR' }),                       // not compared: no FTE count
    staffLine('ZZ no level', {}),                                                  // not checked: no level
    staffLine('ZZ senior half year', { staffLevel: 'SENIOR', fteCount: 1, recurrence: 'ONE_OFF', durationMonths: 6, low: 30000, high: 30000 }), // 30,000 against 65,830 × ½ = 32,915: below
  ]
  const P25 = { ...run.inputs.input.period, priceYear: 2025 }
  const r360 = computeCba({ ...run.inputs.input, period: P25, costs: [...run.inputs.input.costs, ...planted] })
  if (!r360.ok) { ok('360: the engine runs with planted staffing lines', false); return }
  const stepOf = (id: string) => r360.lines.find((l) => l.id === id)?.steps.find((s) => /^salary floor:/.test(s)) ?? ''
  const gapOf = (k: string) => r360.gaps.find((g) => g.kind === k)
  ok('360: a MID line shows HEO/SEO, "the grade assumed from “mid”", £43,930 (released 29 Jul 2026), before employer costs — and its low end is BELOW it', /Higher or Senior Executive Officer \(HEO\/SEO\), the grade assumed from “mid”, gross median £43,930 a year \(Civil Service Statistics 2026, Table 7, all departments, at 31 March 2026, released 29 Jul 2026\), before employer costs; × 1 full-time equivalent = £43,930 a year: the line’s low end is BELOW it/.test(stepOf('ZZ mid one post')), stepOf('ZZ mid one post'))
  ok('360: a JUNIOR line × 2 FTE is set against 2 × £32,140 = £64,280 and is at or above it', /Executive Officer \(EO\), the grade assumed from “junior”, gross median £32,140.*× 2 full-time equivalents = £64,280 a year: the line’s figure is at or above it/.test(stepOf('ZZ junior two posts')), stepOf('ZZ junior two posts'))
  ok('360: a one-off SENIOR line of 6 months is set against half a year of G6/G7 (£32,915) and is BELOW it', /Grade 6 or 7 \(G6\/G7\).*£65,830.*= £32,915 over 6 months: the line’s figure is BELOW it/.test(stepOf('ZZ senior half year')), stepOf('ZZ senior half year'))
  ok('360: Gaps name the lines below the floor — the MID and the half-year SENIOR — and not the JUNIOR one', !!gapOf('below-salary-floor') && /ZZ mid one post/.test(gapOf('below-salary-floor')!.text) && /ZZ senior half year/.test(gapOf('below-salary-floor')!.text) && !/ZZ junior two posts/.test(gapOf('below-salary-floor')!.text), gapOf('below-salary-floor')?.text)
  ok('360: Gaps say which lines are NOT checked, and why: no FTE count; no staff level', /ZZ senior no fte” \(no full-time-equivalent count is set\)/.test(gapOf('staff-unchecked')?.text ?? '') && /ZZ no level” \(no staff level \(junior, mid or senior\) is set\)/.test(gapOf('staff-unchecked')?.text ?? ''), gapOf('staff-unchecked')?.text)
  const gradeA = r360.assumptions.find((a) => /^Grade assumed from junior\/mid\/senior/.test(a.text))
  ok('360: the assumption is stated: "Grade assumed from junior/mid/senior: junior = EO; mid = HEO/SEO; senior = G6/G7. The Senior Civil Service is not assumed", sourced to Table 7 and decision 360', !!gradeA && /junior = Executive Officer \(EO\); mid = Higher or Senior Executive Officer \(HEO\/SEO\); senior = Grade 6 or 7 \(G6\/G7\)\. The Senior Civil Service is not assumed/.test(gradeA.text) && /Table 7.*released 29 Jul 2026.*decision 360/.test(gradeA.source) && !gradeA.owners, JSON.stringify(gradeA))
  const companion = costingCompanionBody(r360 as never, null, '2026-11-21', null)
  ok('360: the costing companion prints the assumption and each line\'s floor', /Grade assumed from junior\/mid\/senior/.test(companion) && /ZZ mid one post[^\n]*salary floor: Higher or Senior Executive Officer/.test(companion), companion.slice(0, 200))
  const bare = computeCba({ ...run.inputs.input, period: P25, held: { ...held, css: held.css ? { ...held.css, floors: {} } : null }, costs: [...run.inputs.input.costs, ...planted] })
  ok('360: the floor is shown, never substituted: every line\'s figure is the same with and without it', bare.ok && planted.every((p) => { const id = (p as { id: string }).id; const a = r360.lines.find((l) => l.id === id)!, b = bare.lines.find((l) => l.id === id)!; return a.nominal.low === b.nominal.low && a.nominal.high === b.nominal.high && a.pv.low === b.pv.low }))
  // uprated to the price year by the deflators (340): price year 2024 → £43,930 × index[2024] / index[2025]
  const i24 = run.inputs.input.deflator.find((d) => d.year === 2024)?.index, i25 = run.inputs.input.deflator.find((d) => d.year === 2025)?.index
  if (i24 && i25) {
    const r24 = computeCba({ ...run.inputs.input, period: { ...P25, priceYear: 2024 }, costs: [planted[0]] })
    const want = `£${Math.round(43930 * i24 / i25).toLocaleString('en-GB')} in 2024-25 prices`
    const s24 = r24.ok ? r24.lines[0].steps.find((s) => /^salary floor:/.test(s)) ?? '' : ''
    ok(`360: in a 2024-25 price year the floor is uprated by the deflator: ${want}`, s24.includes(want), s24)
  } else ok('360: the floor uprated by the deflator', false, 'the deflator holds no 2024 or 2025 index')
  control('…a staffing line whose grade cell is suppressed is not compared: its Gap carries the publisher\'s marker, and it is never "below"', (() => { const r = computeCba({ ...run.inputs.input, period: P25, held: { ...held, css: { ...held.css!, floors: { ...held.css!.floors, HEO_SEO: sup } } }, costs: [planted[0]] }); if (!r.ok) return false; const t = r.gaps.find((g) => g.kind === 'staff-unchecked')?.text ?? ''; return /ZZ mid one post” \(the Higher or Senior Executive Officer \(HEO\/SEO\) figure is \[c\] confidential/.test(t) && !r.gaps.some((g) => g.kind === 'below-salary-floor') })())
  control('…and with the statistics not held, the line gets the "not yet held" gap and no floor at all', (() => { const r2 = computeCba({ ...run.inputs.input, period: P25, held: { ...held, civilServiceStatistics: false }, costs: [planted[0]] }); if (!r2.ok) return false; return r2.gaps.some((g) => /Not yet held by the platform: Civil Service Statistics/.test(g.text)) && !r2.lines[0].steps.some((s) => /^salary floor:/.test(s)) && !r2.gaps.some((g) => g.kind === 'staff-unchecked' || g.kind === 'below-salary-floor') })())

  // Lex's query_stats grounding: a suppressed cell is printed as itself, never left out (rendered from a REAL suppressed cell)
  const { getSuppressedCells } = await import('../lib/stats/cba-cells')
  const cells = sup.kind === 'suppressed' ? await getSuppressedCells(sup.seriesId) : []
  const q = await runQueryStats({ series: 'Median salary of all civil servants working at Senior Civil Service level' } as never)
  const one = q.series?.[0]
  const text = one ? formatStatsForPrompt({ ...q, series: [{ ...one, observations: [], suppressed: cells }] }) : ''
  ok('query_stats returns `suppressed` with every series, and its grounding prints a suppressed cell as "[c] SUPPRESSED by the publisher — … This is not a zero"', (q.series ?? []).every((s) => Array.isArray(s.suppressed)) && cells.length === 1 && /\[c\] SUPPRESSED by the publisher — \[c\] = confidential.*This is not a zero/.test(text), text.slice(-300))
}

async function partD() {
  section('d · the manifest at runtime')
  const a = readFileSync(join(ROOT, 'lib/lex/cba/cba-citation-manifest.json')), b = readFileSync(join(ROOT, '..', 'docs/manifests/cba-citation-manifest.json'))
  ok('the bundled file (lib/lex/cba/cba-citation-manifest.json) is byte-identical to docs/manifests/ while both exist', a.equals(b), `${a.length} vs ${b.length} bytes`)
  const { manifest, leftOut } = await loadManifestWithReport({ fresh: true })
  ok('the platform cites through Ingest\'s file: from "file", all 464 keys, none left out', manifest.from === 'file' && manifest.entries.size === 464 && leftOut.length === 0, `${manifest.from} ${manifest.entries.size} left out ${leftOut.map((l) => l.key).join(', ')}`)
  ok('…each kept key carries the row\'s r2Key (so its text can be re-hashed) and the file\'s hash', [...manifest.entries.values()].every((e) => !!e.r2Key && !!e.textHash))
  const rows = await heldRowsManifest()
  const file = manifestFromFile(JSON.parse(a.toString('utf8')))!
  const planted: Manifest = { ...file, entries: new Map([...file.entries, ['green-book:6.58', { ...file.entries.get('green-book:6.58')!, sectionId: 'govuk-core-docs:somewhere-else:1' }], ['green-book:99.99', { key: 'green-book:99.99', label: 'x', heading: '', sectionId: 'x', sourceUrl: null }]]) }
  const r = manifestFromFileAndRows(planted, rows, null)
  control('a re-pointed key (6.58 naming another row) and an unheld key (99.99) are left out, each with why', !r.manifest.entries.has('green-book:6.58') && !r.manifest.entries.has('green-book:99.99') && r.leftOut.length === 2, JSON.stringify(r.leftOut))
}

async function main() {
  const idea = await prisma.idea.findFirst({ where: { id: { startsWith: '452c5ade' } }, select: { id: true } })
  if (!idea) throw new Error('452c5ade not found')
  await partA(idea.id)
  await partB()
  await partC(idea.id)
  await partD()
  console.log(`\n${ran} ran · ${pass} passed · ${fail} failed · ${controls} controls (${dead} dead)`)
  process.exit(fail || dead ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
