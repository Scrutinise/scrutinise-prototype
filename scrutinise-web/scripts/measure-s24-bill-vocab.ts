/**
 * measure-s24-bill-vocab.ts — S24 step 2 (S23 §2's own step 3). Does
 * `ROUTER_PROMPT_BILL_VOCAB` fix routing on the 10 bill questions, and what does it cost the
 * gold set that already works?
 *
 * ⚠ THE 10 QUESTIONS ARE RECONSTRUCTED, NOT QUOTED — S23's own measurement script was a
 * throwaway (per CLAUDE.md §22, scratch scripts get deleted the same turn) and only the RESULT
 * table survives in docs/SEARCH_S23_REPORT.md §2, not the literal question text sent to the
 * router. Each question below is written to match that table's own description of what was
 * asked as closely as the surviving record allows — named here so a future reader can tell a
 * paraphrase from a verbatim replay.
 *
 * Two arms, same discipline as measure-s18-appraisal.ts:
 *   1. THE TEN — does `legislation` get named, off vs on? (Routing only, per S23 §2's own
 *      finding that once `legislation` is selected the answer ranks ≤15, almost always 1st —
 *      so fixing selection is the whole fix.)
 *   2. THE REGRESSION GATE — the accepted gold set (GOLD_CORPUS + GOLD_V2, 65 questions), same
 *      "lost any stream" diff measure-s18-appraisal.ts already established.
 *
 * Usage (from scrutinise-web):
 *   npx tsx --env-file=.env scripts/measure-s24-bill-vocab.ts
 *   …                                                --repeat 3   --control
 */
import fs from 'node:fs'
import path from 'node:path'
import { routeQueryDetailed } from '../lib/lex/query-expansion'
import { runSearch } from '../lib/lex/search-gateway'
import { capabilityLine } from '../lib/env-flags'
import { GOLD_CORPUS } from './gold/s10-gold-set'
import { GOLD_V2 } from './gold/gold-v2-set'

export {}

const argv = process.argv.slice(2)
const arg = (n: string) => {
  const i = argv.indexOf(`--${n}`)
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1]
  const eq = argv.find((x) => x.startsWith(`--${n}=`))
  return eq ? eq.split('=').slice(1).join('=') : null
}
const REPEAT = parseInt(arg('repeat') ?? '3', 10)
const CONTROL = argv.includes('--control')
const OUT = path.join(__dirname, '../../docs/census/s24-bill-vocab.json')
const OUT_CONTROL = path.join(__dirname, '../../docs/census/s24-bill-vocab-control.json')

// ── the ten, reconstructed from docs/SEARCH_S23_REPORT.md §2's own table ───────────────────────
interface BillQ { n: number; bill: string; question: string; amendment: boolean }
const BILL_QUESTIONS: BillQ[] = [
  { n: 1, bill: 'Illegal Migration Bill', question: 'What detention amendments were tabled to the Illegal Migration Bill?', amendment: true },
  { n: 2, bill: 'Nationality and Borders Bill', question: 'What amendments were tabled to the Nationality and Borders Bill at Report stage?', amendment: true },
  { n: 3, bill: 'Safety of Rwanda Bill', question: 'What amendments did the Commons give reasons for on the Safety of Rwanda Bill?', amendment: true },
  { n: 4, bill: 'Pension Schemes Bill', question: 'What do the Commons amendments to the Pension Schemes Bill text say?', amendment: false },
  { n: 5, bill: 'Mental Health Bill', question: "What do the Mental Health Bill's Explanatory Notes say?", amendment: false },
  { n: 6, bill: 'Institute for Apprenticeships Bill', question: "What does the Institute for Apprenticeships Bill's Delegated Powers Memorandum say?", amendment: false },
  { n: 7, bill: 'Border Security, Asylum and Immigration Bill', question: 'What written evidence was submitted on the Border Security, Asylum and Immigration Bill?', amendment: false },
  { n: 8, bill: 'Border Security, Asylum and Immigration Bill', question: "What does the Border Security, Asylum and Immigration Bill's Human Rights Memorandum say?", amendment: false },
  { n: 9, bill: 'Pension Schemes Bill', question: "What does the Pension Schemes Bill's impact assessment say?", amendment: false },
  { n: 10, bill: 'Mental Health Bill', question: 'What does the Keeling schedule showing amendments to the Mental Health Act 1983 say?', amendment: false },
]

async function rollStreams(question: string): Promise<string[] | null> {
  const decision = await routeQueryDetailed(question.trim().split(/\s+/).filter(Boolean), '')
  return decision?.route ? Object.keys(decision.route) : null
}

async function arm(question: string, on: boolean): Promise<{ rolls: Array<string[] | null>; legRate: number }> {
  process.env.LEX_ROUTER_BILL_VOCAB = on && !CONTROL ? 'true' : 'false'
  const rolls: Array<string[] | null> = []
  for (let r = 0; r < REPEAT; r++) rolls.push(await rollStreams(question))
  const legRate = rolls.filter((s) => s?.includes('legislation')).length / REPEAT
  return { rolls, legRate }
}

const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n))

async function main() {
  // ⚠ `routeQueryDetailed` refuses to run at all with LEX_QUERY_ROUTER off (reports
  // route_outcome=disabled, never calls the model) — this measurement is worthless without it,
  // and this machine's .env does not set it. Forced on here to match production's own value
  // (confirmed live via /api/health throughout this session).
  process.env.LEX_QUERY_ROUTER = 'true'
  process.env.LEX_ROUTER_BILL_VOCAB = 'false'
  const CONFIG = `${capabilityLine()} | GEMINI_API_KEY=${process.env.GEMINI_API_KEY ? 'set' : 'UNSET'}`
  if (!process.env.GEMINI_API_KEY) {
    console.error('⛔ GEMINI_API_KEY is not set. This harness measures the ROUTER, which is an LLM call.')
    process.exit(2)
  }

  console.log(CONTROL
    ? '── S24 · CONTROL: BOTH ARMS OFF. Whatever this reports is the NOISE FLOOR. ──'
    : '── S24 · BILL-PUBLICATION VOCABULARY, MEASURED ──')
  console.log(`  config  : ${CONFIG}`)
  console.log(`  rolls   : ${REPEAT} per question per arm\n`)

  // ── Arm 1: the ten ──────────────────────────────────────────────────────────────────────────
  console.log('── THE TEN — does `legislation` get named? ──')
  interface BillRow extends BillQ { offRate: number; onRate: number; offStreams: string[]; onStreams: string[] }
  const billRows: BillRow[] = []
  for (let i = 0; i < BILL_QUESTIONS.length; i++) {
    const q = BILL_QUESTIONS[i]
    const onFirst = i % 2 === 1
    const a = onFirst ? await arm(q.question, true) : await arm(q.question, false)
    const b = onFirst ? await arm(q.question, false) : await arm(q.question, true)
    const off = onFirst ? b : a
    const on = onFirst ? a : b
    const first = (rolls: Array<string[] | null>) => rolls.find((s) => s !== null) ?? []
    const row: BillRow = { ...q, offRate: off.legRate, onRate: on.legRate, offStreams: first(off.rolls), onStreams: first(on.rolls) }
    billRows.push(row)
    const mark = q.amendment ? '✦' : ' '
    console.log(`${mark} #${row.n} ${pad(row.bill, 42)} legislation ${Math.round(off.legRate * REPEAT)}/${REPEAT} → ${Math.round(on.legRate * REPEAT)}/${REPEAT}`
      + `  [${row.onStreams.join(',')}]`)
  }
  const billHitOn = billRows.filter((r) => r.onRate >= 0.5).length
  const billHitOff = billRows.filter((r) => r.offRate >= 0.5).length
  console.log(`\n  legislation named on a majority of rolls, OFF → ON: ${billHitOff}/10 → ${billHitOn}/10`)

  // ── Arm 1b: full product, ON only, for the questions the router now reaches ────────────────
  console.log('\n── FULL PRODUCT, flag ON — does a result actually come back? (§ "through the product") ──')
  process.env.LEX_ROUTER_BILL_VOCAB = CONTROL ? 'false' : 'true'
  interface ProductRow { n: number; bill: string; found: boolean; top: string | null }
  const productRows: ProductRow[] = []
  for (const q of BILL_QUESTIONS) {
    const search = await runSearch({ keywords: q.question.split(/\s+/), intent: 'AD_HOC_RESEARCH' })
    const bills = search.results.filter((r) => r.id.startsWith('bills-api:'))
    const top = search.results[0]
    productRows.push({ n: q.n, bill: q.bill, found: !search.failed && search.results.length > 0, top: top ? `${top.id} (rank1)` : null })
    console.log(`  #${q.n} ${pad(q.bill, 42)} failed=${search.failed} results=${search.results.length} billsApiHits=${bills.length} top=${top?.id ?? '(none)'}`)
  }

  // ── Arm 2: the regression gate ──────────────────────────────────────────────────────────────
  console.log('\n── THE REGRESSION GATE — the accepted gold set (65 questions) ──')
  const acceptedA = GOLD_CORPUS.filter((q) => q.verdict === 'ACCEPT').map((q) => ({ code: q.code, collection: q.collection as string, question: q.question }))
  const acceptedB = GOLD_V2.filter((q) => q.verdict === 'ACCEPT').map((q) => ({ code: q.id, collection: q.collection ?? 'n/a', question: q.query }))
  const accepted = [...acceptedA, ...acceptedB]
  console.log(`  questions: ${accepted.length} (${acceptedA.length} GOLD_CORPUS + ${acceptedB.length} GOLD_V2)\n`)

  interface RegRow { code: string; collection: string; question: string; offStreams: string[]; onStreams: string[]; gained: string[]; lost: string[] }
  const regRows: RegRow[] = []
  for (let i = 0; i < accepted.length; i++) {
    const q = accepted[i]
    const onFirst = i % 2 === 1
    const a = onFirst ? await arm(q.question, true) : await arm(q.question, false)
    const b = onFirst ? await arm(q.question, false) : await arm(q.question, true)
    const off = onFirst ? b : a
    const on = onFirst ? a : b
    const first = (rolls: Array<string[] | null>) => rolls.find((s) => s !== null) ?? []
    const offStreams = first(off.rolls)
    const onStreams = first(on.rolls)
    const gained = onStreams.filter((s) => !offStreams.includes(s))
    const lost = offStreams.filter((s) => !onStreams.includes(s))
    regRows.push({ code: q.code, collection: q.collection, question: q.question, offStreams, onStreams, gained, lost })
    if (lost.length || gained.length) {
      console.log(`  ${pad(q.code, 6)} ${pad(q.collection, 16)}${lost.length ? `   ⚠ -[${lost.join(',')}]` : ''}${gained.length ? `   +[${gained.join(',')}]` : ''}`)
    }
  }
  const lostAny = regRows.filter((r) => r.lost.length > 0)
  const gainedLeg = regRows.filter((r) => r.gained.includes('legislation'))
  console.log(`\n  ⚠ lost ANY stream: ${lostAny.length} / ${accepted.length}`)
  console.log(`  gained legislation (over-firing): ${gainedLeg.length} / ${accepted.length}`)
  for (const r of lostAny) console.log(`      ${pad(r.code, 6)} ${pad(r.collection, 16)} lost [${r.lost.join(',')}] — ${pad(r.question, 60)}`)

  const target = CONTROL ? OUT_CONTROL : OUT
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify({
    takenAt: new Date().toISOString(), config: CONFIG, repeat: REPEAT, control: CONTROL,
    billQuestions: billRows, fullProduct: productRows, regression: regRows,
    summary: {
      billHitOff, billHitOn,
      regressionN: accepted.length, lostAnyStream: lostAny.length, gainedLegislation: gainedLeg.length,
    },
  }, null, 2))
  console.log(`\n  → ${path.relative(process.cwd(), target)}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
