/**
 * verify-s13-passage.ts — SEARCH S13 §3. DID THE PASSAGE FIX REACH THE RUNNING SERVICES, AND DOES
 * WHAT A USER SEES NOW CONTAIN THE WORDS THAT CAUSED THE RESULT TO BE RETRIEVED?
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * TWO THINGS, AND THEY ARE DIFFERENT THINGS
 *
 *   A. DELIVERY — is the new code running? Read off the SERVICES, never the repository.
 *      ⚠ A redeploy is not a rebuild. S12 committed and pushed a snippet fix on 2026-08-21 23:17;
 *      `vector-serve` booted 2026-08-23 00:24 — twenty-five hours later — and on 2026-08-24 still
 *      reproduced the pre-fix numbers exactly (limit=1 → 0/1 empty, limit=3 → 1/3, limit=10 → 5/10).
 *      A process coming back proves nothing about what it came back into.
 *
 *   B. BEHAVIOUR — the §3 number: of the results a caller is shown, what proportion contain a
 *      content term from the query that retrieved them?
 *
 * ── EVERY PROBE CARRIES ITS CONTROL ─────────────────────────────────────────────────────────────
 * ⚠⚠ "The new field is absent" is ALSO what a probe that cannot see the service returns. So each
 * delivery probe asserts a field that exists on BOTH builds (`score`, `snippet`) alongside the field
 * that exists only on the new one (`snippetMatched`). If the control field is missing the probe
 * reports ITSELF broken rather than reporting the deployment stale. The 25-E delivery record was
 * redone for exactly this reason, and a production route probe that Clerk-307d on its control as
 * well as its target is the counter-example in `docs/CLAUDE.md`.
 *
 * ── THE §3 METRIC, WITH ITS DENOMINATOR STATED ──────────────────────────────────────────────────
 * "Contains the words that caused the result to be retrieved" is measured as: at least one CONTENT
 * term of the query (stopwords removed — see the note in `term-coverage.ts`, and the check that
 * caught their absence) appears as a word prefix in what is DISPLAYED, i.e. title + citation +
 * snippet. ⚠ Measured over the WHOLE displayed set for each question, with n printed; it is not a
 * top-N sample. ⚠ Stopwords are removed because with them in, "the" scores every document in the
 * corpus and the metric returns ~100% for a system that located nothing.
 *
 * Usage (from scrutinise-web):
 *   FTS_SEARCH_URL=… LEX_QUERY_ROUTER=true LEX_VECTOR_STREAMS=legislation \
 *     npx tsx --env-file=.env scripts/verify-s13-passage.ts [--json out.json]
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { runSearch } from '../lib/lex/search-gateway'
import { SCOREABLE_V2 } from './gold/gold-v2-set'
import { contentTerms, coverageOf } from '../lib/lex/term-coverage'
import { capabilityLine } from '../lib/env-flags'

export {}

const JSON_OUT = (() => { const i = process.argv.indexOf('--json'); return i >= 0 ? process.argv[i + 1] : null })()
const FTS = process.env.FTS_SEARCH_URL?.replace(/\/$/, '')
const VEC = process.env.VECTOR_SEARCH_URL?.replace(/\/$/, '')

let pass = 0, fail = 0
const ok = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`) }
}

async function post(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

interface Delivery { service: string; reachable: boolean; controlOk: boolean; newFields: boolean; note: string }

async function checkDelivery(): Promise<Delivery[]> {
  const out: Delivery[] = []
  console.log('\n── A. DELIVERY — read off the running services, not the repository ─────────────────')

  // ── fts-serve ──────────────────────────────────────────────────────────────────────────────
  if (!FTS) { console.log('  ⚠ FTS_SEARCH_URL not set — cannot probe fts-serve.') }
  else {
    try {
      const j = await post(`${FTS}/fts-search`, { query: 'assisted dying terminally ill choice', limit: 5, tier: 'parliamentary' })
      const r = j.results?.[0]
      // CONTROL: fields present on BOTH builds. If these are missing the probe is reading nothing
      // and the verdict below would be meaningless.
      const controlOk = !!r && typeof r.score === 'number' && typeof r.snippet === 'string'
      const newFields = !!r && r.snippetMatched !== undefined
      ok('fts-serve probe is sound (control fields `score` + `snippet` present)', controlOk,
        controlOk ? `${j.results.length} result(s)` : 'probe read nothing — the verdict below means nothing')
      ok('fts-serve is running S13 §3 code (`snippetMatched` on the wire)', newFields,
        newFields ? `snippetMatched=${r.snippetMatched}, snippetLocation=${JSON.stringify(r.snippetLocation)}` : 'field ABSENT — the deployed build predates this sprint. REDEPLOY (rebuild from Main); a restart re-runs the same build.')
      out.push({ service: 'fts-serve', reachable: true, controlOk, newFields,
        note: newFields ? 'S13 §3 present' : 'pre-S13 build' })
    } catch (e) {
      ok('fts-serve reachable', false, (e as Error).message)
      out.push({ service: 'fts-serve', reachable: false, controlOk: false, newFields: false, note: (e as Error).message })
    }
  }

  // ── vector-serve ───────────────────────────────────────────────────────────────────────────
  if (!VEC) { console.log('  ⚠ VECTOR_SEARCH_URL not set — cannot probe vector-serve.') }
  else {
    try {
      const j = await post(`${VEC}/vector-search`, {
        query: "whether an employer is vicariously liable for an employee's assault on a customer",
        limit: 10, tier: 'caselaw', noCache: true,
      })
      const r = j.results?.[0]
      const controlOk = !!r && typeof r.score === 'number' && 'snippet' in r
      const newFields = !!r && r.snippetMatched !== undefined
      // ⚠ THE INDEPENDENT PROBE, AND IT IS THE ONE THAT IS FALSE ON THE OLD BUILD BY ARITHMETIC.
      // The pre-fix row budget was `sectionIds.length * 4`; caselaw sections run to MAX_CHUNKS (8)
      // chunks each, so ten requested sections got 40 rows and the last five got none — measured
      // 5 of 10 empty on 2026-08-24. The fixed budget is `× MAX_CHUNKS` = 80 rows, i.e. 0 empty.
      // This does not depend on any new FIELD being present, so it catches a half-deployed build.
      const empty = (j.results ?? []).filter((x: any) => !x.snippet || !String(x.snippet).trim()).length
      ok('vector-serve probe is sound (control fields present)', controlOk,
        controlOk ? `${j.results.length} result(s)` : 'probe read nothing')
      ok('vector-serve: the S12 snippet row-budget fix is DEPLOYED (0 of 10 empty snippets)', empty === 0,
        `${empty} of ${j.results?.length ?? 0} empty — the pre-fix build gives exactly 5 of 10`)
      ok('vector-serve is running S13 §3 code (`snippetMatched` on the wire)', newFields,
        newFields ? `snippetMatched=${r.snippetMatched}, chunkId=${r.chunkId}` : 'field ABSENT — pre-S13 build')
      out.push({ service: 'vector-serve', reachable: true, controlOk, newFields,
        note: `${empty}/10 empty snippets; ${newFields ? 'S13 §3 present' : 'pre-S13 build'}` })
    } catch (e) {
      ok('vector-serve reachable', false, (e as Error).message)
      out.push({ service: 'vector-serve', reachable: false, controlOk: false, newFields: false, note: (e as Error).message })
    }
  }
  return out
}

async function main() {
  console.log('═'.repeat(112))
  console.log('SEARCH S13 §3 — VERIFY THE MATCHED-PASSAGE FIX, THROUGH THE PLATFORM')
  console.log('═'.repeat(112))
  console.log(`  config: ${capabilityLine()}`)
  console.log(`  FTS_SEARCH_URL      ${FTS ?? '⚠ NOT SET'}`)
  console.log(`  VECTOR_SEARCH_URL   ${VEC ?? '(unset)'}`)

  const delivery = await checkDelivery()

  // ── B. the §3 number ────────────────────────────────────────────────────────────────────────
  console.log('\n── B. BEHAVIOUR — do displayed results contain the words that retrieved them? ──────')
  const debates = SCOREABLE_V2.filter((q) => q.collection === 'debates')
  console.log(`  n = ${debates.length} debates questions (the whole validated debates set, not a sample)\n`)

  // ⚠⚠ THE METRIC IS SPLIT THREE WAYS BECAUSE THE FIRST VERSION COULD BARELY FAIL.
  // It scored title + citation + snippet together and returned **80% on the OLD build** — the one
  // that displays the first 300 characters of the document. The 80% was the TITLE: a Hansard debate
  // is titled "Terminally Ill Adults (End of Life) Bill" or "Prepayment Meters: Self-Disconnection",
  // so a question about assisted dying or prepayment meters matches the heading of nearly every
  // result whatever the snippet says. A metric satisfied by the heading measures the corpus's
  // naming, not the platform's ability to show the passage that answers the question, and it would
  // have moved from 80% to ~85% across a change that alters every snippet on the platform.
  // SNIPPET-ONLY is the §3 number. The other two are printed so the difference is visible.
  interface Row { id: string; query: string; shown: number; inSnippet: number; inTitle: number; inEither: number; meanCov: number; matchedFlag: number; unknownFlag: number }
  const rows: Row[] = []
  const snippetOnly = (r: { snippet: string }) => ({ title: '', citation: '', snippet: r.snippet }) as any
  const titleOnly = (r: { title: string; citation: string }) => ({ title: r.title, citation: r.citation, snippet: '' }) as any
  for (const q of debates) {
    const terms = contentTerms(q.query)
    let res
    try { res = await runSearch({ keywords: q.query.split(/\s+/), intent: 'AD_HOC_RESEARCH', limit: 20 }) }
    catch (e) { console.log(`  ${q.id.padEnd(6)} ERROR ${(e as Error).message}`); continue }
    // ⚠ `grouped` IS WHAT A USER IS SHOWN — the panel-ready set, ≤3 per type, ~20 cap. `results` is
    // the interleaved sum across streams (150+ rows at limit 20) and no surface renders it whole.
    // Measuring the metric over `results` would answer a question nobody asked.
    const shown = res.grouped
    const inSnippet = shown.filter((r) => coverageOf(snippetOnly(r), terms) > 0).length
    const inTitle = shown.filter((r) => coverageOf(titleOnly(r), terms) > 0).length
    const inEither = shown.filter((r) => coverageOf(r, terms) > 0).length
    const matchedFlag = shown.filter((r) => r.snippetMatched === true).length
    const unknownFlag = shown.filter((r) => r.snippetMatched === undefined).length
    // ⚠ MEAN COVERAGE, BESIDE THE BINARY. "Contains at least one term" is the brief's question and
    // is a low bar — one word of a nine-word question clears it. The mean FRACTION of the query's
    // content terms present in the displayed text says how much of the question the shown text
    // actually addresses, and is where a passage fix should move if it is doing anything.
    const meanCov = shown.length
      ? shown.reduce((n, r) => n + coverageOf(snippetOnly(r), terms), 0) / shown.length : 0
    rows.push({ id: q.id, query: q.query, shown: shown.length, inSnippet, inTitle, inEither, meanCov, matchedFlag, unknownFlag })
    console.log(`  ${q.id.padEnd(6)} shown=${String(shown.length).padStart(2)}  IN SNIPPET ${String(inSnippet).padStart(2)}/${String(shown.length).padEnd(2)}` +
      `${shown.length ? ` ${String(Math.round((inSnippet / shown.length) * 100)).padStart(3)}%` : '    —'}` +
      `   (title-only ${String(inTitle).padStart(2)}, either ${String(inEither).padStart(2)})` +
      `  meanCov ${(meanCov * 100).toFixed(0).padStart(3)}%   snippetMatched: ${matchedFlag} true, ${unknownFlag} not-reported`)
  }

  const totShown = rows.reduce((n, r) => n + r.shown, 0)
  const totWith = rows.reduce((n, r) => n + r.inSnippet, 0)
  const totTitle = rows.reduce((n, r) => n + r.inTitle, 0)
  const totEither = rows.reduce((n, r) => n + r.inEither, 0)
  const totUnknown = rows.reduce((n, r) => n + r.unknownFlag, 0)
  console.log('\n' + '─'.repeat(112))
  console.log(`  §3 NUMBER (snippet only): ${totWith} of ${totShown} displayed results (${totShown ? Math.round((totWith / totShown) * 100) : 0}%)`)
  console.log(`      contain a content term from the query that retrieved them, IN THE TEXT SHOWN.`)
  console.log(`      across ${rows.length} debates questions, whole displayed set each, no sampling.`)
  console.log(`  for comparison — title/citation only: ${totTitle}/${totShown} (${totShown ? Math.round((totTitle / totShown) * 100) : 0}%) · either: ${totEither}/${totShown} (${totShown ? Math.round((totEither / totShown) * 100) : 0}%)`)
  const meanCovAll = totShown
    ? rows.reduce((n, r) => n + r.meanCov * r.shown, 0) / totShown : 0
  console.log(`  MEAN COVERAGE of the query's content terms inside the displayed snippet: ${(meanCovAll * 100).toFixed(1)}%  (weighted by results shown)`)
  console.log(`  ⚠ the title figure is why the snippet figure is the one that means anything: a debate titled`)
  console.log(`    "Prepayment Meters: Self-Disconnection" matches a prepayment-meter query on its heading alone.`)
  if (totUnknown === totShown && totShown > 0) {
    console.log(`  ⚠⚠ snippetMatched was NOT REPORTED on any of the ${totShown} results — the services predate S13 §3.`)
    console.log(`     The percentage above therefore describes the OLD head-of-document snippet. It is the BEFORE number.`)
  } else if (totUnknown) {
    console.log(`  ⚠ ${totUnknown} of ${totShown} results carried no \`snippetMatched\` — a mixed fleet: one service is redeployed and one is not.`)
  }

  console.log(`\n  ${pass} delivery assertion(s) passed, ${fail} failed`)
  if (JSON_OUT) {
    fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true })
    fs.writeFileSync(JSON_OUT, JSON.stringify({
      takenAt: new Date().toISOString(), delivery, rows,
      total: {
        shown: totShown,
        inSnippet: totWith, pctInSnippet: totShown ? totWith / totShown : 0,
        inTitle: totTitle, inEither: totEither, unknownFlag: totUnknown,
        meanCoverage: totShown ? rows.reduce((n, r) => n + r.meanCov * r.shown, 0) / totShown : 0,
      },
    }, null, 2))
    console.log(`  wrote ${JSON_OUT}`)
  }
  await prisma.$disconnect()
  process.exit(fail ? 1 : 0)
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
