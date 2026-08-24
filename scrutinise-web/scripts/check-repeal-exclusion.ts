/**
 * check-repeal-exclusion.ts — C3 Lane B2/B4. THE EXCLUSION, AND IT IS WATCHED FAILING FIRST.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS DEFENDS
 *
 * A row whose entire stored text is a publisher dot leader — `Article 31 . . . .` — can be
 * returned to a user as the answer to a question about the law. 249,256 such rows have been
 * ANNOTATED in every search result since Surface 1 shipped, and returned anyway. Annotation
 * without exclusion is the same defect as retiring a target without deleting its rows.
 *
 * ⚠ AND THE OPPOSITE MISTAKE IS WORSE. Suppressing every row with a repeal record would remove
 * the repeal history a user is entitled to, and suppressing partially repealed sections would
 * drop LIVE LAW out of the corpus. So the rule is narrow — the row's own text says nothing — and
 * these cases assert the narrowness, not just the suppression.
 *
 * ⚠ CASE 0 IS THE ONE THAT MATTERS. `--pre-fix` runs the same fixtures through the behaviour that
 * shipped before this sprint (annotate, suppress nothing). It MUST report the hollow rows as
 * returned. A check that has never been seen failing is not a check.
 *
 * Usage:
 *   npx tsx scripts/check-repeal-exclusion.ts
 *   npx tsx scripts/check-repeal-exclusion.ts --pre-fix     ← watch it fail
 */
import {
  isHollowRepeal, HOLLOW_EVIDENCE, PARTIAL_EVIDENCE,
  repealLabel, repealPromptNote, REPEAL_PROMPT_INSTRUCTION,
  type RepealStatus,
} from '../lib/lex/repeal-wording'

const PRE_FIX = process.argv.includes('--pre-fix')

/** The gateway's rule, in the two forms. `keep` is what search-gateway.ts now applies. */
const keep = PRE_FIX ? (_: RepealStatus | undefined) => true : (r: RepealStatus | undefined) => !isHollowRepeal(r)

const st = (state: RepealStatus['state'], evidence: string | null, repealedBy: string | null = null): RepealStatus =>
  ({ state, evidence, repealedBy, repealedByTitle: repealedBy, repealedByTitle_unused: undefined } as unknown as RepealStatus)

interface Case { name: string; repeal: RepealStatus | undefined; shouldBeReturned: boolean; why: string }
const CASES: Case[] = [
  {
    name: 'whole-body dot leader, repealer unknown',
    repeal: st('repealed-unknown', HOLLOW_EVIDENCE),
    shouldBeReturned: false,
    why: 'its entire text is `Article 31 . . . .` — it can answer nothing, and it displaces a row that could',
  },
  {
    name: 'whole-body dot leader, repealer known',
    repeal: st('repealed-known', HOLLOW_EVIDENCE, 'ukpga/2002/29'),
    shouldBeReturned: false,
    why: 'knowing what repealed it does not give the row any text',
  },
  {
    name: 'PARTIALLY repealed — live law with holes',
    repeal: st('partially-repealed', PARTIAL_EVIDENCE),
    shouldBeReturned: true,
    why: '⚠ THE ONE THAT MUST NOT BE SUPPRESSED. This is current law; removing it drops live law out of '
       + 'the corpus, which is precisely the error C2 Lane 2 caught in its own first detector',
  },
  {
    name: 'repealed, and we hold its real text',
    repeal: st('repealed-known', 'tna-effects-feed', 'ukpga/2002/29'),
    shouldBeReturned: true,
    why: '⚠ ALSO MUST NOT BE SUPPRESSED. A repealed provision whose text we hold is exactly what a user '
       + 'asking about repeal history needs — that is what Surface 1 is for. The evidence, not the '
       + 'state, is what makes a row hollow',
  },
  {
    name: 'ordinary live provision',
    repeal: st('no-record', null),
    shouldBeReturned: true,
    why: 'no repeal record at all',
  },
  {
    name: 'repeal lookup FAILED — status undefined',
    repeal: undefined,
    shouldBeReturned: true,
    why: '⚠ a failed lookup must never be read as "hollow". Dropping rows because we could not check '
       + 'them would turn a database blip into missing law',
  },
]

let pass = 0, fail = 0
console.log(PRE_FIX
  ? '=== RUNNING AGAINST PRE-SPRINT BEHAVIOUR (annotate, suppress nothing) — the failures are the point ===\n'
  : '=== C3 B2/B4 — whole-body dot leaders are excluded, and nothing else is ===\n')
for (const c of CASES) {
  const returned = keep(c.repeal)
  const ok = returned === c.shouldBeReturned
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`)
  console.log(`      returned: ${returned}   expected: ${c.shouldBeReturned}`)
  console.log(`      ${c.why}`)
}

// ── the wording has to exist for the new state, or the prompt says nothing about it
const partial = st('partially-repealed', PARTIAL_EVIDENCE)
const labelOk = /PARTIALLY REPEALED/.test(repealLabel(partial))
const noteOk = (repealPromptNote(partial) ?? '').includes('PARTIALLY REPEALED')
const instrOk = REPEAL_PROMPT_INSTRUCTION.includes('PARTIALLY REPEALED')
for (const [name, ok] of [
  ['the panel label names the partial state', labelOk],
  ['the prompt note names the partial state', noteOk],
  ['⚠ the prompt INSTRUCTION explains the partial state — without it Lex reads a bare note it was never told how to use', instrOk],
] as Array<[string, boolean]>) {
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}

// ── and the never-claim rule travels with it
const claimsInForce = /\bin force\b/i.test(repealLabel(partial))
claimsInForce ? fail++ : pass++
console.log(`${claimsInForce ? 'FAIL' : 'PASS'}  the partial label never says "in force"`)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
