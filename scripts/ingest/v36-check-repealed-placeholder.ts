export {}  // module scope — without it main() lands in the global scope shared by every script here
/**
 * v36-check-repealed-placeholder.ts — the dot-leader guard, with its false-positive
 * cases weighted as heavily as its true ones.
 *
 * The risk this check exists to police is NOT "does it catch dots". It is "does it
 * throw away real law". A guard that suppresses a section is one bad regex away from
 * deleting a provision from the corpus and reporting success, so every case below
 * that MUST NOT match is drawn from text the pilots actually wrote to R2.
 *
 * Usage: tsx v36-check-repealed-placeholder.ts
 */
const CASES: { text: string; expect: boolean; why: string }[] = [
  // MUST match — the source's own repealed-provision rendering.
  { text: '1 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .', expect: true,
    why: 'uksi/1999/303 regulation 1, verbatim from the source CLML' },
  { text: '10 . . . . . . . .', expect: true, why: 'same, shorter run' },
  { text: '. . . .', expect: true, why: 'no number, dots only' },
  { text: '3 (1) . . . . . . (2) . . . . . .', expect: true, why: 'sub-paragraph numbering plus dots' },
  { text: '1 …', expect: true, why: 'ellipsis character rather than spaced full stops' },
  // THE DISCRIMINATING CASE. Legislation is full of lettered section numbers — 5A,
  // 10A, 13E — and a repealed one renders as "5A . . . .". A rule that rejects on
  // ANY letter misses every one of these and silently indexes them as text, which is
  // what the first draft of this guard did. Only the two-or-more-letters rule gets
  // it right, and this is the case that says so.
  { text: '5A . . . . . . . . . . . .', expect: true, why: 'lettered section number, repealed' },
  { text: '13E . . . .', expect: true, why: 'same, two-digit with letter suffix' },

  // MUST NOT match — real text the pilots wrote, plus the awkward edges.
  { text: '1 This Order may be cited as the Social Security Benefits Up-rating Order 1989.', expect: false,
    why: 'uksi/1989/43 s.1 — real law, and it contains dots' },
  { text: '1 These Regulations may be cited as the Bread and Flour Regulations 1998 and shall come into force on 19th February 1998.', expect: false,
    why: 'uksi/1998/141 s.1 — real law' },
  { text: '2 In this Order— “ the Act ” means the Building Societies Act 1986;', expect: false,
    why: 'uksi/1987/426 s.2 — curly quotes and an em-dash' },
  { text: '', expect: false, why: 'empty is a DIFFERENT state and must not be mislabelled repealed' },
  { text: '1 2 3 4 5', expect: false, why: 'digits with no dot leader — not this class' },
  { text: '5A . . . as amended . . .', expect: false, why: 'dots AROUND real words — the dangerous near-miss' },
  // EXPECTATION CORRECTED, not the rule. This was first written as expect=false on
  // the reasoning that a stray letter should block the match. Run against the
  // implementation it failed, and the implementation was right: a lone "a" among dot
  // leaders is sub-paragraph (a) with its text removed, which is precisely a
  // repealed placeholder. The rule stays; the case was wrong.
  { text: '1 . . . . . . a . . . . . .', expect: true,
    why: 'a lone letter among dots is sub-paragraph (a) with its text repealed' },
]

async function main() {
  const { isRepealedPlaceholder } = await import('./shared/compile')
  let pass = 0, fail = 0
  for (const c of CASES) {
    const got = isRepealedPlaceholder(c.text)
    const ok = got === c.expect
    ok ? pass++ : fail++
    const shown = c.text.length > 46 ? `${c.text.slice(0, 43)}…` : c.text
    console.log(`${ok ? 'PASS' : 'FAIL'}  expect=${String(c.expect).padEnd(5)} got=${String(got).padEnd(5)} "${shown}"  — ${c.why}`)
  }
  console.log(`\n[check] ${pass}/${pass + fail} passed  (${CASES.filter(c => !c.expect).length} of them are must-NOT-match cases)`)
  if (fail > 0) process.exitCode = 1
}

main().catch(e => { console.error(e); process.exitCode = 1 })
