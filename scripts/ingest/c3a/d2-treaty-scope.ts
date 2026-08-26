/**
 * d2-treaty-scope.ts — ADDENDUM C3 §3 (decision D-2). MEASURE both options. Change nothing.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE STATE
 * `uk-treaties` (3,264 sections) and `tax-treaties-dta` (324) sit in the `parliamentary` tier, are
 * named in `NON_DEBATE_PARLIAMENTARY` so the debates stream excludes them, and are not in
 * `COMMITTEE_CORPORA` so the committees stream never selects them. **No stream can reach them at
 * any setting.** Meanwhile `uk-treaties-fcdo` (23,372 sections) answers treaty questions purely
 * because it happens to be display-typed DEBATE.
 *
 * THE TWO OPTIONS
 *   A. admit the two collections to the DEBATES stream (drop them from `excludeCorpora`)
 *      — costs nothing per query: the same retrieval call, a shorter exclusion list
 *   B. build a SIXTH stream for treaties
 *      — costs one extra retrieval call on every query routed to it, against `vector-serve`'s
 *        concurrency cap of 4
 *
 * ⚠⚠ THIS SCRIPT DOES NOT EDIT `stream-scopes.ts` OR ANY OTHER SEARCH FILE. The addendum is
 * explicit: "This is a search-stream change. Provide the measurement and the recommendation; do
 * not edit their files." The scopes are therefore RECONSTRUCTED here as literals and passed to the
 * live FTS service as query parameters — the same thing the router does, from outside.
 *
 * ── WHAT IS MEASURED ───────────────────────────────────────────────────────────────────────────
 *  1. THE COST OF OPTION A, on the eleven debates questions Charlie validated in Gold v2. Each is
 *     run through the debates scope AS IT SHIPS and through the same scope with the two treaty
 *     collections admitted. Reported: recall@20 against the validated keys, before and after, and
 *     how many of the twenty slots the treaty rows take.
 *     ⚠ This is the before-and-after S11 established as the rule for a scope change, and the
 *       blocker of record ("the validated set has ZERO debates questions") is gone.
 *  2. THE BENEFIT, on the two collections' own content: 20 probe phrases drawn from their own
 *     section titles, asked through each scope. Today that number is 0/20 by construction.
 *  3. THE COST OF OPTION B, in wall-clock: five concurrent retrieval calls against six, repeated,
 *     against the live service — the concurrency cap of 4 is the reason a sixth stream is not free.
 *
 * Usage: tsx c3a/d2-treaty-scope.ts
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from '../c2/db'
/**
 * ⚠ REQUIRED AT RUNTIME, NOT IMPORTED. `scrutinise-web/scripts/gold/gold-v2-set.ts` sits outside
 * this project's `rootDir`, so a static import makes `tsc -p scripts/ingest` fail. The alternative
 * — copying the eleven questions into this file — is worse: a control that is a copy tests the
 * copy, and Charlie validated ONE list. This reads that list, at the cost of an `any`.
 */
const { GOLD_V2 } = require('../../../scrutinise-web/scripts/gold/gold-v2-set') as { GOLD_V2: any[] }

const FTS = (process.env.FTS_SEARCH_URL ?? 'https://fts-serve-production.up.railway.app').replace(/\/$/, '')
const n = (x: number) => x.toLocaleString('en-GB')

/** Reconstructed from scrutinise-web/lib/lex/stream-scopes.ts — READ, never imported and never edited. */
const COMMITTEE_CORPORA = ['committees-reports', 'committees-evidence']
const NON_DEBATE_PARLIAMENTARY = [...COMMITTEE_CORPORA, 'bills-api', 'uk-treaties', 'tax-treaties-dta', 'members-interests', 'erskine-may']
/** Option A: the same list with the two treaty collections removed. */
const NON_DEBATE_WITH_TREATIES = NON_DEBATE_PARLIAMENTARY.filter((c) => c !== 'uk-treaties' && c !== 'tax-treaties-dta')
const TREATY_CORPORA = ['uk-treaties', 'tax-treaties-dta']

/**
 * ⚠ RETRIES ON A 5xx, AND SAYS SO. The first run of this script died on an `FTS 502` two thirds of
 * the way through and lost every measurement taken before it — the "write incrementally, not at the
 * end" rule, arriving as a network error rather than a crash. A 502 from a Railway service under a
 * burst is not a finding about the scope; an unretried one destroys the run that was.
 */
async function search(body: any, attempt = 0): Promise<any[]> {
  try {
    const r = await fetch(`${FTS}/fts-search`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (r.status >= 500 && attempt < 4) {
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)))
      return search(body, attempt + 1)
    }
    if (!r.ok) throw new Error(`FTS ${r.status}`)
    return ((await r.json()) as any).results ?? []
  } catch (e: any) {
    if (attempt < 4) {
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)))
      return search(body, attempt + 1)
    }
    throw e
  }
}

const debatesScope = (excl: string[]) => ({ limit: 20, tier: 'parliamentary', types: ['DEBATE', 'DIVISION'], excludeCorpora: excl })

async function main() {
  console.log(`FTS: ${FTS}`)
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows

  for (const c of [...TREATY_CORPORA, 'uk-treaties-fcdo']) {
    const k = (await q(`SELECT count(*)::int n FROM corpus_sections WHERE corpus=$1 AND status='compiled'`, [c]))[0].n
    console.log(`  ${c.padEnd(20)} ${String(k).padStart(7)} compiled`)
  }

  // ── 1. the cost of option A, on Charlie's validated debates questions
  const debates = GOLD_V2.filter((g) => g.collection === 'debates' && g.scoring === 'recall')
  console.log(`\n══ OPTION A — the ${debates.length} validated Gold v2 debates questions, before and after ══`)
  console.log('   recall@20 = the share of a question\'s validated keys that appear in the top 20.\n')
  const rows: any[] = []
  let beforeHit = 0, afterHit = 0, keyTotal = 0, displaced = 0, treatySlots = 0
  for (const g of debates) {
    const before = await search({ query: g.query, ...debatesScope(NON_DEBATE_PARLIAMENTARY) })
    const after = await search({ query: g.query, ...debatesScope(NON_DEBATE_WITH_TREATIES) })
    const has = (rs: any[], k: string) => rs.some((r: any) => r.id === k)
    const b = g.keys.filter((k) => has(before, k)).length
    const a = g.keys.filter((k) => has(after, k)).length
    const t = after.filter((r: any) => TREATY_CORPORA.includes(r.corpus)).length
    const lost = before.filter((r: any) => !after.some((x: any) => x.id === r.id)).length
    beforeHit += b; afterHit += a; keyTotal += g.keys.length; treatySlots += t; displaced += lost
    rows.push({ id: g.id, query: g.query, keys: g.keys.length, before: b, after: a, treatyRowsInTop20: t, displaced: lost, rowsBefore: before.length, rowsAfter: after.length })
    const flag = a < b ? '  ⚠ LOST A KEY' : (t > 0 ? '  (treaty rows present)' : '')
    // ⚠ THE ROW COUNTS ARE PRINTED BECAUSE "0 DISPLACED" OFF AN EMPTY RESULT SET IS NOT A RESULT.
    console.log(`   ${g.id.padEnd(4)} rows ${before.length}→${after.length}  keys ${g.keys.length}  before ${b}/${g.keys.length}  after ${a}/${g.keys.length}  treaty rows in top-20: ${t}, displaced: ${lost}${flag}`)
    console.log(`        "${g.query.slice(0, 96)}"`)
  }
  console.log(`\n   TOTAL recall@20   before ${beforeHit}/${keyTotal} (${(beforeHit / keyTotal * 100).toFixed(1)}%)   after ${afterHit}/${keyTotal} (${(afterHit / keyTotal * 100).toFixed(1)}%)`)

  // ── ⚠⚠ THE CONTROL THAT DECIDES WHETHER THE RECALL NUMBERS ABOVE MEAN ANYTHING.
  //    Gold v2's keys were validated against the FULL hybrid pipeline — BM25 fused with a vector
  //    leg, through the gateway. This harness talks to `fts-serve` alone, because that is where the
  //    stream SCOPE is applied, and this machine's .env carries no LEX_VECTOR_STREAMS. If the keys
  //    cannot be retrieved here even when the query IS their own section title, then a 0-vs-0
  //    before/after is the instrument reporting its own absence, NOT evidence that nothing changed.
  const keyIds = debates.flatMap((g) => g.keys)
  const keyTitles = await q(
    `SELECT id, "sectionTitle" t, corpus FROM corpus_sections WHERE id = ANY($1)`, [keyIds])
  let keyFound = 0, keyProbed = 0
  for (const kt of keyTitles) {
    const phrase = String(kt.t ?? '').slice(0, 90)
    if (phrase.length < 12) continue
    keyProbed++
    const rs = await search({ query: phrase, ...debatesScope(NON_DEBATE_PARLIAMENTARY) })
    if (rs.some((r: any) => r.id === kt.id)) keyFound++
  }
  console.log(`   CONTROL — the same keys, queried by their OWN section title through the same scope:`)
  console.log(`             ${keyFound}/${keyProbed} retrievable (${keyTitles.length} of ${keyIds.length} keys carry a usable title)`)
  if (keyFound === 0) {
    console.log('   ⚠⚠ THE RECALL INSTRUMENT IS DEAD IN THIS HARNESS — a key is not retrievable here even')
    console.log('      when the query is the document\'s own title. The 0-vs-0 above says NOTHING about')
    console.log('      option A. What DOES stand is the displacement measurement: whether treaty rows take')
    console.log('      slots in the top 20 of a real debates question. That is measured on the same rows.')
  }
  console.log(`   treaty rows entering the top 20 across all ${debates.length} questions: ${treatySlots}`)
  console.log(`   debate rows displaced from the top 20:                        ${displaced}`)
  const emptied = rows.filter((r: any) => r.rowsBefore === 0).length
  console.log(`   ⚠ CONTROL: ${rows.length - emptied} of ${rows.length} questions returned a FULL result set through this scope`)
  console.log(`     (${rows.map((r: any) => r.rowsBefore).join('/')}), so "0 displaced" is measured against rows that exist.`)
  if (afterHit === beforeHit && treatySlots === 0) {
    console.log('   ⚠ A ZERO-CHANGE RESULT IS ONLY MEANINGFUL IF THE PROBE CAN SEE A CHANGE AT ALL —')
    console.log('     the reachability probe below is the control for exactly that.')
  }

  // ── 2. the benefit: can the collections be reached at all, under each option
  console.log('\n══ THE BENEFIT — 20 probe phrases taken from the collections\' own section titles ══')
  const benefit: any[] = []
  for (const corpus of TREATY_CORPORA) {
    const titles = await q(
      `SELECT "sectionTitle" t FROM corpus_sections
        WHERE corpus=$1 AND status='compiled' AND "sectionTitle" IS NOT NULL AND length("sectionTitle") > 25
        ORDER BY md5(id) LIMIT 12`, [corpus])
    let own = 0, todayHits = 0, optionAHits = 0, sixthHits = 0
    for (const row of titles) {
      const phrase = String(row.t).slice(0, 90)
      const from = (rs: any[]) => rs.filter((r: any) => r.corpus === corpus).length
      // control first: the text IS indexed and findable when the scope allows it
      if (from(await search({ query: phrase, limit: 20, corpora: [corpus] })) > 0) own++
      if (from(await search({ query: phrase, ...debatesScope(NON_DEBATE_PARLIAMENTARY) })) > 0) todayHits++
      if (from(await search({ query: phrase, ...debatesScope(NON_DEBATE_WITH_TREATIES) })) > 0) optionAHits++
      // what a dedicated sixth stream would see: its own corpora, its own slots
      if (from(await search({ query: phrase, limit: 20, corpora: TREATY_CORPORA })) > 0) sixthHits++
    }
    console.log(`   ${corpus}`)
    console.log(`     CONTROL, scoped to itself      ${own}/${titles.length}   ← proves the probe and the index are sound`)
    console.log(`     debates stream AS IT SHIPS     ${todayHits}/${titles.length}   ← 0 expected: excludeCorpora names it`)
    console.log(`     OPTION A (admitted to debates) ${optionAHits}/${titles.length}`)
    console.log(`     OPTION B (its own stream)      ${sixthHits}/${titles.length}`)
    benefit.push({ corpus, probes: titles.length, control: own, today: todayHits, optionA: optionAHits, optionB: sixthHits })
  }

  // ── 3. the cost of option B, in wall-clock against the live service
  console.log('\n══ OPTION B — what a sixth concurrent retrieval call costs, measured ══')
  const probe = 'treaty ratification parliamentary scrutiny'
  const timeFan = async (k: number) => {
    const t0 = Date.now()
    await Promise.all(Array.from({ length: k }, (_, i) => search({ query: `${probe} ${i}`, limit: 20 })))
    return Date.now() - t0
  }
  const trials = 3
  const five: number[] = [], six: number[] = []
  for (let i = 0; i < trials; i++) { five.push(await timeFan(5)); six.push(await timeFan(6)) }
  const mean = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) / a.length)
  console.log(`   5 concurrent calls: ${five.join(' / ')} ms   mean ${mean(five)} ms`)
  console.log(`   6 concurrent calls: ${six.join(' / ')} ms   mean ${mean(six)} ms`)
  console.log(`   difference: ${mean(six) - mean(five)} ms (${((mean(six) / mean(five) - 1) * 100).toFixed(1)}%)`)
  console.log('   ⚠ THIS IS THE FTS SERVICE, NOT `vector-serve`. The concurrency cap of 4 that makes a')
  console.log('     sixth stream expensive is vector-serve\'s; measuring it needs VECTOR_SEARCH_URL and a')
  console.log('     vector leg, and this machine\'s .env has no LEX_VECTOR_STREAMS. Reported as a partial')
  console.log('     measurement rather than presented as the whole cost.')

  const outPath = path.join(OUT, 'C3A_d2_treaty_scope.json')
  fs.writeFileSync(outPath, JSON.stringify({
    generated: new Date().toISOString(), fts: FTS,
    optionA: { perQuestion: rows, recallBefore: beforeHit, recallAfter: afterHit, keyTotal, treatySlots, displaced },
    benefit, optionBLatency: { five, six, meanFive: mean(five), meanSix: mean(six) },
  }, null, 2))
  console.log(`\nwritten: docs/census/C3A_d2_treaty_scope.json`)
  console.log('⚠ NO SEARCH FILE WAS EDITED. This is the measurement §3 asked for; the decision is Charlie\'s.')
  await p.end()
}
main().catch((e) => { console.error('FAIL', e.message ?? e); process.exit(1) })
