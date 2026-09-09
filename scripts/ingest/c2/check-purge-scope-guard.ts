/**
 * check-purge-scope-guard.ts — l2-purge's scope guard, and it exists to be WATCHED FAILING first.
 *
 * ════════════════════════════════════════════════════════════════════════════════════
 * THE BUG IT ANSWERS
 * ════════════════════════════════════════════════════════════════════════════════════
 * On 27 Aug 2026 at 02:20 UTC `l2-purge --execute` deleted the 131,650 `et-decisions` landing
 * pages — exactly what it was meant to delete — and then ran
 *
 *     UPDATE corpus_targets SET retired = true, blocked = true WHERE corpus_key = t.corpus
 *
 * keyed off `t.corpus` rather than off `t.where`. `et-decisions-landing`'s predicate is
 * `corpus='et-decisions' AND format='html'`; the collection also holds 161,749 judgment PDFs the
 * purge deliberately KEPT. So a partial purge retired and blocked a live collection of 161,753 rows.
 *
 * The rule now: A TARGET WHOSE PREDICATE IS NARROWER THAN ITS COLLECTION MUST NOT RETIRE IT.
 *
 * ════════════════════════════════════════════════════════════════════════════════════
 * WHY THE COUNTS ARE READ LIVE
 * ════════════════════════════════════════════════════════════════════════════════════
 * Cases 2+ read `corpus_sections` at run time. A fixture would test the arithmetic; the live read
 * tests the guard against the rows that actually exist, which is where the wrong assumption lived
 * ("`corpus='et-decisions' AND format='html'` obviously covers et-decisions" — it covered 45% of it).
 *
 * The historical case 1 is the only hard-coded one, because those counts no longer exist to read:
 * they are the pre-purge counts, 131,650 of 293,403, taken from the target's own `expect` and from
 * the 161,753 rows that survived.
 *
 * Usage:
 *   tsx c2/check-purge-scope-guard.ts              # the guard — expect every case to PASS
 *   tsx c2/check-purge-scope-guard.ts --break-it   # run the OLD unguarded rule, to watch it fail
 */
import { pool } from './db'
import { retireVerdict, TARGETS } from './l2-purge'

const BREAK = process.argv.includes('--break-it')

/** The rule as it stood before 27 Aug: retire the corpus_key, no questions asked. Kept here so the
 *  guard can be seen REJECTING it, rather than only seen agreeing with itself. */
const oldRule = (_matched: number, _whole: number) => ({ retire: true, why: 'keyed off t.corpus — always retires' })
const verdict = BREAK ? oldRule : retireVerdict

const n = (x: number) => x.toLocaleString()

interface Case { name: string; matched: number; whole: number; retire: boolean; why: string }

async function main() {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows
  const cases: Case[] = []

  // ── 1. THE HISTORICAL CASE. The state at 02:20 UTC on 27 Aug, which the old rule got wrong.
  cases.push({
    name: 'et-decisions-landing AS IT STOOD PRE-PURGE (hard-coded: the only counts not readable now)',
    matched: 131_650, whole: 293_403, retire: false,
    why: '131,650 html landing pages inside a collection of 293,403 — the 161,753 judgment PDFs survive',
  })

  // ── 2. EVERY LIVE TARGET, counted against the database as it is right now.
  for (const t of TARGETS) {
    const matched = (await q(`SELECT count(*)::int n FROM corpus_sections WHERE ${t.where}`))[0].n
    const whole = (await q(`SELECT count(*)::int n FROM corpus_sections WHERE corpus = $1`, [t.corpus]))[0].n
    cases.push({
      name: `LIVE ${t.key} (${t.corpus})`,
      matched, whole,
      retire: matched === whole,
      why: matched === whole
        ? 'predicate and collection agree — a wholesale purge, in scope to retire'
        : 'predicate covers only part of the collection — out of scope to retire',
    })
  }

  // ── 3. A LIVE COLLECTION THAT IS NOT EMPTY, TESTED BOTH WAYS. Without this the guard could be
  //      passing only because every purged collection now sits at 0 of 0, which proves nothing.
  //      `et-decisions` is the collection the bug hit, and it still holds 161,753 rows.
  const etWhole = (await q(`SELECT count(*)::int n FROM corpus_sections WHERE corpus = 'et-decisions'`))[0].n
  const etPdf = (await q(`SELECT count(*)::int n FROM corpus_sections WHERE corpus = 'et-decisions' AND format = 'pdf'`))[0].n
  cases.push({
    name: `LIVE CONTROL (must PASS) — whole predicate on a populated collection: corpus='et-decisions'`,
    matched: etWhole, whole: etWhole, retire: true,
    why: `${n(etWhole)} of ${n(etWhole)} — a guard that refused this would block every genuine wholesale purge`,
  })
  cases.push({
    name: `LIVE CONTROL (must FIRE) — a NEAR-MISS on the same collection: corpus='et-decisions' AND format='pdf'`,
    matched: etPdf, whole: etWhole, retire: false,
    why: `${n(etPdf)} of ${n(etWhole)} — short by ${n(etWhole - etPdf)} rows, and ${n(etWhole - etPdf)} surviving rows is still a live collection`,
  })

  // ── 4. THE OTHER DIRECTION. A predicate matching MORE than its collection does not own the rows
  //      it hit, so it must not retire the target either — it would leave another corpus purged and
  //      still marked live. Not a mistake that has happened; it is the untested half of the rule.
  const reach = (await q(
    `SELECT count(*)::int n FROM corpus_sections WHERE corpus IN ('et-decisions', 'si-pre-2010')`))[0].n
  cases.push({
    name: `LIVE CONTROL (must FIRE) — a predicate reaching beyond its corpus: corpus IN ('et-decisions','si-pre-2010')`,
    matched: reach, whole: etWhole, retire: false,
    why: `${n(reach)} matched against a collection of ${n(etWhole)} — the predicate is not this target's to retire`,
  })

  console.log(BREAK
    ? '=== RUNNING AGAINST THE OLD PRE-27-AUG RULE — these failures are the point ===\n'
    : '=== l2-purge scope guard ===\n')

  let pass = 0, fail = 0
  for (const [i, c] of cases.entries()) {
    const got = verdict(c.matched, c.whole)
    const ok = got.retire === c.retire
    ok ? pass++ : fail++
    console.log(`${ok ? ' ok ' : 'FAIL'}  ${i + 1}. ${c.name}`)
    console.log(`        matched ${n(c.matched)} of ${n(c.whole)} → retire=${got.retire}, expected ${c.retire}`)
    console.log(`        ${c.why}`)
    if (!ok) console.log(`        ⚠ the rule said: ${got.why}`)
    console.log('')
  }

  console.log('─'.repeat(72))
  console.log(`${pass} passed, ${fail} failed`)
  if (BREAK) {
    console.log(fail > 0
      ? `✓ EXPECTED: the old rule fails ${fail} of ${cases.length} cases, including case 1 — the retirement it actually performed.`
      : '⚠ the old rule passed everything, which means these cases do not discriminate. Do not trust the guard.')
  }
  await p.end()
  // --break-it is expected to fail; a plain run is not.
  process.exit(BREAK ? (fail > 0 ? 0 : 1) : (fail > 0 ? 1 : 0))
}

main().catch(e => { console.error('FAIL', e.message); process.exit(1) })
