// ─────────────────────────────────────────────────────────────────────────────
// §19-D Task 2 — the never-claim invariant, enforced where it kept breaking.
//
// §19-C established the rule: Lex must not say that something exists, was written,
// was found or is waiting in a panel unless the state says so. The 10 Aug walk-
// through found three live violations, and all three were in code the rule had
// already been written for:
//
//   2a  a "Proposed by Lex" badge rendered off field STATUS, so an empty seed
//       claimed a proposal that did not exist;
//   2b  a fallback message that promised seeding ("I'll seed a few candidates per
//       material cause") — and fallbacks fire exactly when seeding failed;
//   2c  a field advertised as Lex-proposed that was seeded with five empty slots.
//
// This is a SOURCE invariant, in the shape of check-llm-guards.ts, for the same
// reason: a behavioural test catches the call site it exercises, and this class
// recurs at the NEXT one somebody writes. The unit assertions below cover the
// runtime half — the render decision itself.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

const ROOT = path.join(__dirname, '..')
let failures = 0
function ok(name: string, cond: boolean, detail = '') {
  if (!cond) failures++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`)
}
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

console.log('§19-D Task 2 — no affordance may claim a proposal the state does not hold\n')

// ── 2a. the panel's "proposed by Lex" badges ────────────────────────────────
console.log('the panel badge')
const panel = read('components/lex/FieldsPanel.tsx')

// Every badge must be guarded by something derived from the PROPOSAL, never by the
// status alone. Extract each badge's guard by looking at the ternary it sits in.
const badgeLines = panel.split('\n').filter((l) => /proposed by Lex/.test(l))
ok(`found the badge render sites (${badgeLines.length})`, badgeLines.length >= 3)
const statusOnly = badgeLines.filter((l) => {
  const guard = l.split('right=')[1]?.split('?')[0] ?? l
  // A guard naming a status constant and nothing proposal-derived is the 2a bug.
  return /AWAITING_CONFIRMATION/.test(guard) && !/proposal|proposed|hasProposal|hasProposedContent/i.test(guard)
})
ok('no badge renders off field status alone', statusOnly.length === 0, statusOnly.map((l) => l.trim().slice(0, 90)).join(' | '))
ok('the structured field gates its badge on actual slot content',
  /hasProposedContent\s*=/.test(panel) && /some\(\(v\) => typeof v === 'string' && v\.trim\(\)\)/.test(panel))

// ── 2b. fallback copy must not promise work that may not have happened ───────
console.log('\nfallback copy')
const PROMISE = /I['’]ll (?:seed|pull|put|add|draft|prepare|find)\b|I have (?:seeded|pulled)\b|I['’]ve (?:seeded|pulled together|put)\b/i
// Field `question` strings are the deterministic fallback — they are spoken WHEN
// something failed, so they can never describe work as done or promised.
for (const f of ['lib/lex/page1-config.ts', 'lib/lex/page2-config.ts', 'lib/lex/page3-config.ts', 'lib/lex/page4-config.ts']) {
  const src = read(f)
  const offenders = src.split('\n').filter((l) => /^\s*(?:question:|'|")/.test(l) && PROMISE.test(l))
  ok(`${f} — no fallback question promises seeding`, offenders.length === 0,
    offenders.map((l) => l.trim().slice(0, 80)).join(' | '))
}

// ── 2c. structured seeding must not fake a proposal ─────────────────────────
console.log('\nthe conductor')
const orch = read('lib/lex/orchestrator.ts')
ok('seedStructured only sets a proposal when a slot carries content',
  /const hasContent = Object\.values\(seed\)\.some/.test(orch) && /if \(hasContent\) await setProposal/.test(orch))
ok('anticipatedResponses is generated, not blanked (2c)',
  /seedAnticipatedResponses/.test(orch) && /generateAnticipatedResponses/.test(orch))
ok('a failed anticipated-responses draft is reported, not shown as empty boxes',
  /if \(!drafted\) return honestFailureMessage/.test(orch))
ok('the policy-options fallback reports the real count, not the promise',
  /fresh\.policyOptions\.length\s*$/m.test(orch) || /return fresh\.policyOptions\.length/.test(orch))
ok('the cause-seeding "A factor examined in" fallback is gone (Task 8)',
  !/A factor examined in/.test(orch.replace(/\/\/.*$/gm, '')))

// ── the runtime half: the render decision itself ────────────────────────────
console.log('\nrender decision (unit)')
type Field = { status: string; proposal: { value: unknown } | null }
// Mirrors FieldsPanel.StructuredField's guard exactly. If that guard changes shape,
// the source assertion above fails and this is re-derived alongside it.
const badgeShows = (f: Field) =>
  f.status === 'AWAITING_CONFIRMATION' &&
  !!f.proposal &&
  Object.values((f.proposal.value ?? {}) as Record<string, unknown>).some((v) => typeof v === 'string' && v.trim())

ok('empty seed → NO badge (the legal-landscape case)',
  !badgeShows({ status: 'AWAITING_CONFIRMATION', proposal: { value: { currentLaw: '', whereItFails: '' } } }))
ok('no proposal at all → NO badge', !badgeShows({ status: 'AWAITING_CONFIRMATION', proposal: null }))
ok('whitespace-only seed → NO badge',
  !badgeShows({ status: 'AWAITING_CONFIRMATION', proposal: { value: { currentLaw: '   ' } } }))
ok('a real proposal → badge',
  badgeShows({ status: 'AWAITING_CONFIRMATION', proposal: { value: { currentLaw: 'The Environment Act 2021, s.56.', whereItFails: '' } } }))
ok('an accepted field → no badge',
  !badgeShows({ status: 'ACCEPTED', proposal: { value: { currentLaw: 'x' } } }))

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed')
process.exit(failures ? 1 : 0)
