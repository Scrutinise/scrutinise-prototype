/**
 * measure-s7-framing.ts — BRIEF_SEARCH_S7 §3. The query-framing experiment, transferred from Lex.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠⚠ THE TWO FRAMINGS, DEFINED BEFORE ANYTHING RAN — §3 FLAGS THIS AND THE LEX STREAM IS RIGHT
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * IN THE LEX BUILD the contrast is: *the user's problem as they would type it into a chat window*
 * versus *the problem plus their goal, what they have ruled out, what they already know, and their
 * profile.*
 *
 * ON THE GOLD SET THERE IS NO USER AND NO PROFILE. So the contrast becomes:
 *
 *   A  BARE       the question as asked, nothing added
 *   B  ENRICHED   the question plus whatever context the CALLER holds — here, the archetype's own
 *                 framing and the streams it declares
 *
 * ⚠⚠ THAT IS A REAL AND USEFUL COMPARISON, AND IT IS NOT THE SAME COMPARISON. This file measures
 * "does caller-held context help retrieval". It does NOT measure "does a user profile help", it
 * cannot, and no result here licenses a claim about user profiles. §3: "Do not let the two be
 * conflated in the write-up." The report says which one ran, in those words.
 *
 * ⚠ WHY IT MATTERS BEYOND THE DEEPENING: if the plainer framing wins, that changes how EVERY
 * retrieval call in the platform should be constructed, not just this one.
 *
 * ⚠ RUN ORDER ALTERNATES per query — a cache-warming artefact has already misled one measurement
 * in this project.
 *
 * Usage (from scripts/ingest):
 *   tsx search/measure-s7-framing.ts --self-test
 *   tsx search/measure-s7-framing.ts --out=GOLD_TEST_11_framing.md
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch } from './fts-core'
import { GOLD } from './gold-queries'

export {}

const arg = (n: string) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : null }
const flag = (n: string) => process.argv.includes(`--${n}`)
const OUT = arg('out') ?? 'GOLD_TEST_11_framing.md'
const K = 20

/**
 * ⚠ THE ENRICHMENT IS THE CALLER'S CONTEXT, NOT THE ANSWER.
 *
 * The single most dangerous thing this experiment could do is leak the answer key into the query
 * and then report that enrichment helps. So the enriched form may use ONLY what a caller would
 * genuinely hold before searching: the archetype's description of the KIND of question, and the
 * streams it declares. It may never use `expect`, the answer ids, or anything derived from them.
 *
 * Exported so the leak test can run against it without a database.
 */
export function enrich(q: { query: string; stream?: string; kind?: string }): string {
  const bits = [q.query]
  // The STREAM is genuinely caller-held: the router or the caller decides where to look before it
  // looks. `kind` (specific vs principle) is the caller's own read of the question's shape.
  if (q.stream) bits.push(q.stream.replace(/[+/]/g, ' '))
  if (q.kind) bits.push(q.kind)
  return bits.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * ⚠ THE LEAK TEST. Does the enriched query contain anything from the answer key?
 *
 * The gold set's expected sources carry regexes, not ids, so the leak test checks whether the
 * enrichment happens to satisfy one of the ANSWER PATTERNS. If it does, that query is excluded:
 * measuring a leak and calling it a framing effect is the single most likely way for this
 * experiment to produce a flattering and worthless number.
 */
export function leaksAnswer(bare: string, enriched: string, patterns: RegExp[]): boolean {
  // ⚠⚠ DIFFERENTIAL, AND THE FIRST VERSION WAS NOT — it tested the enriched string alone and
  // excluded 13 of 31 scoreable queries. Every one of those "leaks" was in the ORIGINAL QUESTION:
  // "What laws govern e-scooters?" trips /e-scooter/i, and "Has the Dangerous Dogs Act 1991 been
  // changed?" trips /dangerous dogs act 1991/i. A question naming its own subject is not a leak,
  // it is a question. Throwing those away would have shrunk n by 42% and biased what remained
  // towards queries whose answer key happens not to use the subject's name.
  //
  // The real question is whether the ENRICHMENT ADDS a match the bare query did not already have.
  return patterns.some((re) => re.test(enriched) && !re.test(bare))
}

/** recall@k against the gold set's own pattern matching — one expected source is found when any of
 *  its patterns matches any returned id. */
const recallAt = (hits: Array<{ id: string }>, expected: Array<{ patterns: RegExp[] }>, k: number) => {
  if (!expected.length) return null
  const ids = hits.slice(0, k).map((h) => h.id)
  const found = expected.filter((e) => e.patterns.some((re) => ids.some((id) => re.test(id))))
  return found.length / expected.length
}

async function main() {
  if (flag('self-test')) return selftest()

  const db = await connectLance()
  const tbl = await db.openTable(FTS_TABLE)

  const rows: Array<{ id: string; bare: number | null; rich: number | null; leaked: boolean }> = []
  let leakCount = 0

  for (let i = 0; i < GOLD.length; i++) {
    const g = GOLD[i] as unknown as {
      id: string; query: string; stream?: string; kind?: string; scoreable?: boolean
      expected?: Array<{ patterns: RegExp[] }>
    }
    // ⚠ Only the queries the gold set itself counts. `scoreable:false` covers the principle
    // streams (rubric uncalibrated) and the queries whose answer key is still TODO.
    if (g.scoreable === false) { rows.push({ id: g.id, bare: null, rich: null, leaked: false }); continue }
    const expected = g.expected ?? []
    const enriched = enrich(g)
    const leaked = leaksAnswer(g.query, enriched, expected.flatMap((e) => e.patterns))
    if (leaked) leakCount++

    // ⚠ ALTERNATE THE ORDER. Cache warming has misled a measurement here before.
    const richFirst = i % 2 === 1
    let bare: number | null
    let rich: number | null
    if (richFirst) {
      rich = recallAt(await rankedSearch(tbl, enriched, K), expected, K)
      bare = recallAt(await rankedSearch(tbl, g.query, K), expected, K)
    } else {
      bare = recallAt(await rankedSearch(tbl, g.query, K), expected, K)
      rich = recallAt(await rankedSearch(tbl, enriched, K), expected, K)
    }
    rows.push({ id: g.id, bare, rich, leaked })
  }

  const scored = rows.filter((r) => r.bare !== null && r.rich !== null && !r.leaked)
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const bareMean = mean(scored.map((r) => r.bare as number))
  const richMean = mean(scored.map((r) => r.rich as number))
  const better = scored.filter((r) => (r.rich as number) > (r.bare as number)).length
  const worse = scored.filter((r) => (r.rich as number) < (r.bare as number)).length
  // ⚠⚠ HEADROOM. A query that scores 0 in BOTH arms cannot show a difference either way, so the
  // count of queries with ANY recall is the real sample size of this experiment. Reporting
  // "+0.0pp" without it would be a false negative dressed as a finding.
  const withHeadroom = scored.filter((r) => (r.bare as number) > 0 || (r.rich as number) > 0).length

  const md = [
    '# GOLD TEST 11 — QUERY FRAMING: BARE vs CALLER-ENRICHED',
    '',
    `*Generated ${new Date().toISOString()}. Offline against \`corpus_fts\`. recall@${K}.*`,
    '',
    '## ⚠⚠ WHICH COMPARISON THIS IS',
    '',
    'This measures **bare query** versus **query plus whatever context the CALLER holds**.',
    '',
    '**It is NOT the Lex-build comparison.** That one contrasts the user\'s problem as typed against',
    'the problem plus their goal, their rejected options, what they already know, and their profile.',
    '**There is no user and no profile on the gold set**, so that comparison cannot be run here and',
    'no result below licenses a claim about user profiles.',
    '',
    '## Result',
    '',
    '| | recall@20 |',
    '|---|---:|',
    `| bare query | **${(100 * bareMean).toFixed(1)}%** |`,
    `| caller-enriched | **${(100 * richMean).toFixed(1)}%** |`,
    `| difference | **${richMean >= bareMean ? '+' : ''}${(100 * (richMean - bareMean)).toFixed(1)}pp** |`,
    '',
    `Queries scored: **${scored.length}** of ${rows.length}.`,
    '',
    `## ⚠⚠ THIS MEASUREMENT IS UNDERPOWERED AND CANNOT ANSWER THE QUESTION`,
    '',
    `**${scored.length - withHeadroom} of the ${scored.length} scored queries returned NOTHING in either arm.**`,
    `Only **${withHeadroom}** had any recall at all, so only ${withHeadroom} could have shown a difference in`,
    'either direction. A "+0.0pp" headline from that is a floor effect, not evidence that framing',
    'does not matter.',
    '',
    '**Why the floor is so low:** this harness calls `rankedSearch` straight against `corpus_fts` —',
    'bare BM25, no tier scoping, no per-stream fusion, no query expansion, no citation resolver. The',
    'platform BM25 gold headline is around 62%. This is therefore a much weaker system than the one',
    'anybody actually runs, and its absolute numbers are a FLOOR rather than the platform recall.',
    '',
    '▶ **What would fix it:** run both arms through `runSearch()` — the real gateway, with routing',
    'and fusion — from the web side. It cannot be done from `scripts/ingest`, which sets',
    '`rootDir: "."` and cannot import anything under `scrutinise-web/`. That is a harness-location',
    'problem, not a measurement problem, and it is the next thing to do here.',
    `Enrichment helped **${better}**, hurt **${worse}**, made no difference to **${scored.length - better - worse}**.`,
    '',
    `⚠ **${leakCount} queries were EXCLUDED because the enriched form contained part of the answer key.**`,
    'Including them would have measured the leak rather than the framing — the single most likely way',
    'for this experiment to produce a flattering and worthless number.',
    '',
    '⚠ Run order **alternates per query**, because a cache-warming artefact has misled a measurement',
    'in this project before.',
    '',
    '## Per query',
    '',
    '| id | bare | enriched | |',
    '|---|---:|---:|---|',
    ...rows.map((r) => `| ${r.id} | ${r.bare === null ? '—' : (100 * r.bare).toFixed(0) + '%'} | `
      + `${r.rich === null ? '—' : (100 * r.rich).toFixed(0) + '%'} | `
      + `${r.leaked ? '⚠ excluded — answer leak' : (r.rich ?? 0) > (r.bare ?? 0) ? 'enriched better' : (r.rich ?? 0) < (r.bare ?? 0) ? 'bare better' : ''} |`),
  ].join('\n')

  const outPath = path.join(__dirname, '../../../docs', OUT)
  fs.writeFileSync(outPath, md, 'utf8')
  console.log(`\n════ S7 §3 — QUERY FRAMING ════`)
  console.log(`  bare            ${(100 * bareMean).toFixed(1)}%`)
  console.log(`  caller-enriched ${(100 * richMean).toFixed(1)}%`)
  console.log(`  difference      ${richMean >= bareMean ? '+' : ''}${(100 * (richMean - bareMean)).toFixed(1)}pp  (n=${scored.length})`)
  console.log(`  helped ${better} · hurt ${worse} · no change ${scored.length - better - worse}`)
  console.log(`  ⚠⚠ HEADROOM: only ${withHeadroom} of ${scored.length} queries scored ANYTHING in either arm —`)
  console.log(`     the other ${scored.length - withHeadroom} cannot show a difference, so this is a FLOOR EFFECT,`)
  console.log(`     not evidence that framing does not matter. See the report.`)
  console.log(`  ⚠ ${leakCount} excluded for answer leak`)
  console.log(`  written: docs/${OUT}`)
}

function selftest() {
  const cases: Array<[string, boolean]> = [
    ['enrichment uses the declared stream', enrich({ query: 'a', stream: 'legislation' }) === 'a legislation'],
    ['a compound stream is split, not passed as punctuation',
      enrich({ query: 'a', stream: 'legislation + guidance' }) === 'a legislation guidance'],
    ['enrichment uses the caller read of the question kind', enrich({ query: 'a', kind: 'specific' }).endsWith('specific')],
    ['a bare query enriches to itself when there is nothing to add', enrich({ query: 'a' }) === 'a'],
    ['⚠⚠ a leak ADDED BY the enrichment is caught',
      leaksAnswer('sewage', 'sewage Water Industry Act 1991', [/water industry act 1991/i])],
    ['⚠⚠ a pattern already matched by the BARE query is NOT a leak — the question may name its subject',
      !leaksAnswer('What laws govern e-scooters?', 'What laws govern e-scooters? legislation specific', [/e-scooter/i])],
    ['a clean enrichment is not flagged',
      !leaksAnswer('sewage discharge', 'sewage discharge legislation', [/water industry act 1991/i])],
    ['⚠ the enrichment is caller-held context only — never the expect field',
      !/expect/.test(enrich.toString())],
  ]
  let bad = 0
  for (const [n, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1) })
