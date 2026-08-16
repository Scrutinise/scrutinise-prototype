// ─────────────────────────────────────────────────────────────────────────────
// THE DEEPENING (§22 Pilot A) — the acceptance criteria, asserted rather than intended.
//
// BRIEF_DEEPENING_RESTART.md §4 asks for several of these BY NAME as script checks,
// and one of them says so explicitly: "editing a field still goes through the normal
// save path (checked by a script, not by intention)". That is the whole reason this
// file exists — the separate-evidence-layer invariant is the kind that survives a code
// review and dies six weeks later to one convenient `prisma.idea.update`.
//
// Asserted here (no model, no browser, no database):
//   1. THE SEPARATE EVIDENCE LAYER — no Deepening module or route writes a canonical
//      field. One exception, named and narrow: the references store.
//   2. A finding cannot be persisted without a source from THIS run's retrieval.
//   3. CONTRADICTS survives — nothing filters it out of a list.
//   4. The known-unknowns block renders unconditionally, empty included.
//   5. Known unknowns are COMPUTED from the run, never a hardcoded gap.
//   6. Re-run: increments runVersion, supersedes older PROPOSED items, and provably
//      does not touch ACCEPTED ones.
//   7. Dismissal requires a reason at the API, not only in the form.
//   8. NO AGGREGATE SCORE ANYWHERE (§24 supersedes §22.3 — no thermometer, no stars).
//   9. A fifth pass is CONFIGURATION: no pass key is named outside the config file.
//  10. The issue templates fire on evidence, and can also NOT fire.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { PASSES, PASS_KEYS, passDef, isPassKey, type IssueContext } from '../lib/lex/deepening-config'
import { readKnownUnknowns } from '../lib/lex/deepening'
import { SIFT_CANDIDATE_TARGET } from '../lib/lex/deepening-sift'

const ROOT = path.join(__dirname, '..')
let fail = 0
const ok = (label: string, cond: boolean, detail = '') => {
  if (cond) console.log(`  ok   ${label}`)
  else { fail++; console.log(` FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
}
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
/** Comments stripped, so a rule is never satisfied by prose describing it. */
const code = (rel: string) => read(rel).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

const ENGINE = 'lib/lex/deepening.ts'
const CLIENT = 'lib/lex/deepening-client.ts'
const CONFIG = 'lib/lex/deepening-config.ts'
const SETTLE = 'lib/lex/deepening-settle.ts'
const PANEL = 'components/lex/DeepeningPanel.tsx'
const ROUTES = [
  'app/api/ideas/[id]/deepening/route.ts',
  'app/api/ideas/[id]/deepening/[passKey]/run/route.ts',
  'app/api/ideas/[id]/deepening/evidence/[evidenceId]/route.ts',
  'app/api/ideas/[id]/deepening/issues/[issueId]/route.ts',
]
const ALL_MODULES = [ENGINE, CLIENT, CONFIG, SETTLE, ...ROUTES]

console.log('THE DEEPENING (§22 Pilot A) — acceptance criteria\n')

// ── 1. the separate evidence layer ───────────────────────────────────────────
console.log('§2.1.1 — Deepening REFERENCES canonical fields; it never writes them')

/**
 * The canonical-field write paths. `prisma.idea.update` is the blunt one; the field
 * machine is the deliberate one. Neither may appear in a Deepening module.
 *
 * The ONE allowed `prisma.idea.update` is the references store, and it is allowed by
 * LINE, not by switching the rule off for the file — a blanket exemption would let the
 * next `prisma.idea.update` in the same file through unnoticed.
 */
const FIELD_WRITE = /prisma\.idea\.update|prisma\.idea\.updateMany|submitBox\(|acceptField\(|skipField\(|reopenField\(/g
for (const f of ALL_MODULES) {
  const src = code(f)
  const hits = [...src.matchAll(FIELD_WRITE)].map((m) => m[0])
  if (f === ENGINE) {
    // Exactly one, and it must be the references write.
    const refWrite = /await prisma\.idea\.update\(\{\s*where: \{ id: ideaId \},\s*data: \{ stageSearches:/m.test(src)
    ok(`${f}: exactly one Idea write, and it is the references store`,
      hits.length === 1 && hits[0] === 'prisma.idea.update' && refWrite,
      hits.join(', '))
  } else {
    ok(`${f}: no canonical-field write`, hits.length === 0, hits.join(', '))
  }
}
ok('the evidence layer references a field by a TEXT fieldRef, not a foreign key to its value',
  /fieldRef\s+String\?/.test(read('prisma/schema.prisma')) && !/fieldRef\s+String\?\s*@relation/.test(read('prisma/schema.prisma')))

// ── 2. a finding must carry a source from this run ───────────────────────────
console.log('\n§4 — findings carry sources')
const engine = code(ENGINE)
ok('the engine drops any finding whose sourceId is not in what was retrieved',
  /const src = f\.sourceId \? byId\.get\(f\.sourceId\) : undefined/.test(engine) && /if \(!src\) continue/.test(engine))
ok('the persisted row takes its citation and url FROM the retrieved result, not from the model',
  /citation: src\.citation/.test(engine) && /url: src\.url/.test(engine))
ok('the model is told the sourceId must come from the supplied list',
  /sourceId.*SOURCES list|copied exactly from the SOURCES/i.test(read(CLIENT)))

// ── 3. CONTRADICTS is never filtered out ─────────────────────────────────────
console.log('\n§2.3 — a CONTRADICTS finding is as valuable as a SUPPORTS one')
const panel = code(PANEL)
const CONTRADICTS_FILTERED =
  /filter\([^)]*!==\s*'CONTRADICTS'|filter\([^)]*kind\s*!==\s*'CONTRADICTS'|CONTRADICTS[^)\n]*\?\s*null/
ok('nothing in the panel filters CONTRADICTS out of the findings list', !CONTRADICTS_FILTERED.test(panel))
ok('nothing in the engine filters CONTRADICTS out before persisting', !CONTRADICTS_FILTERED.test(engine))
ok('CONTRADICTS is a first-class kind in the schema',
  /CONTRADICTS/.test(read('prisma/schema.prisma')) && /CONTRADICTS/.test(read('prisma/lex_deepening.sql')))
ok('the panel gives CONTRADICTS its own label, so it cannot read as a generic finding',
  /CONTRADICTS:\s*'Contradicts the diagnosis'/.test(read(PANEL)))

// ── 4. the known-unknowns block always renders ───────────────────────────────
console.log('\n§2.1.2 — known unknowns are an invariant, not a section')
// The block must not be inside a `length > 0 &&` guard: an absent block reads as
// "not checked", which is the opposite of what an empty one means.
const kuBlock = read(PANEL).match(/Known unknowns[\s\S]{0,1600}/)
ok('the panel has a known-unknowns block', !!kuBlock)
ok('...rendered unconditionally, with an explicit empty state',
  !!kuBlock && /Nothing this pass looked for was unfindable/.test(kuBlock[0]))
ok('...and it is NOT wrapped in a non-empty guard',
  !!kuBlock && !/knownUnknowns\.length\s*>\s*0\s*&&/.test(kuBlock[0]))
ok('the column defaults to an empty array, so a run always has one',
  /knownUnknowns.*JSONB\s+NOT NULL DEFAULT '\[\]'::jsonb/.test(read('prisma/lex_deepening.sql')))

// ── 5. known unknowns are computed, never hardcoded ──────────────────────────
console.log('\n§3 — the gap is READ FROM THE RUN, not baked in')
// The brief told me to declare the Impact Assessment corpus unreachable on every
// EVIDENCE_PRECEDENT run. The search thread made it reachable the same afternoon. A
// hardcoded gap is a lie with a delay on it.
// `code()`, not `read()`: the note explaining WHY this rule exists names the very string
// it forbids, and a check that its own rationale trips is a check that gets deleted.
ok('no hardcoded "impact assessment corpus is unavailable" gap anywhere',
  !ALL_MODULES.some((f) => /impact[- ]assessment[s]? (corpus )?(is )?(not |un)(available|reachable|searchable|indexed)/i.test(code(f))))
ok('known unknowns are derived from the pass\'s mustAnswer questions minus what was answered',
  /def\.mustAnswer[\s\S]{0,120}filter\(\(q\) => !answered\.has\(q\)\)/.test(engine))
ok('a failed retrieval becomes a known unknown in its own right',
  /for \(const intent of failedIntents\)[\s\S]{0,200}knownUnknowns\.push/.test(engine))
ok('a search that FAILED and a search that found nothing are distinguished',
  /res\.failed/.test(engine) && /failedIntents/.test(engine))

// ── 6. re-run semantics ──────────────────────────────────────────────────────
console.log('\n§2.2 — a re-run supersedes PROPOSED and never touches ACCEPTED')
const supersede = engine.match(/evidenceItem\.updateMany\(\{[\s\S]{0,400}?\}\)/)
ok('supersede targets only PROPOSED items', !!supersede && /status: 'PROPOSED'/.test(supersede[0]))
ok('...only from EARLIER runs', !!supersede && /runVersion: \{ lt: runVersion \}/.test(supersede[0]))
ok('...and says so in the note it leaves', !!supersede && /Superseded by run/.test(supersede[0]))
// The whole point of the two conditions above: an ACCEPTED item can never match, so a
// re-run provably cannot touch one. Asserted as an absence too, because that is the
// promise the brief makes to the user.
ok('...so an ACCEPTED item is unreachable by the supersede', !!supersede && !/'ACCEPTED'/.test(supersede[0]))
ok('claiming a pass increments runVersion', /runVersion: next/.test(engine) && /const next = existing\.runVersion \+ 1/.test(engine))
ok('a second concurrent claim cannot succeed (conditional update, count checked)',
  /deepeningPass\.updateMany\(\{[\s\S]{0,300}?status: 'RUNNING'/.test(engine) && /claimed\.count === 0/.test(engine))
ok('settle is guarded on runVersion, so a slow run cannot overwrite a newer one',
  /where: \{ ideaId, passKey, runVersion \}/.test(engine))
ok('an abandoned RUNNING row is settled by WRITING it, not by displaying something else',
  /status: 'FAILED'/.test(code(SETTLE)) && /updateMany/.test(code(SETTLE)))

// ── 7. dismissal needs a reason at the API ───────────────────────────────────
console.log('\n§2.5 — dismiss requires a reason; dismissed issues stay visible')
ok('the engine refuses a dismissal with no reason',
  /action === 'dismiss' && !input\.reason\?\.trim\(\)/.test(engine) && /DismissalNeedsAReason/.test(engine))
ok('the route turns that into a 422 rather than a 500',
  /DismissalNeedsAReason/.test(code(ROUTES[3])) && /422/.test(code(ROUTES[3])))
ok('a dismissed issue is still rendered, with its reason',
  /i\.status === 'DISMISSED' &&[\s\S]{0,200}dismissReason/.test(read(PANEL)))
ok('no issue is ever deleted', !/prisma\.deepeningIssue\.delete/.test(engine))

// ── 8. no aggregate score anywhere ───────────────────────────────────────────
console.log('\n§24 — counts only; no score, no stars, no thermometer')
// §24 supersedes §22.3 outright: the 1–5 thermometer and the public star rating are gone,
// and the reason is that a self-awardable scale measuring "work done" was being asked to
// carry "trust this", which it cannot. Nothing here may quietly reinstate one.
const SCORE_WORDS = /\b(star|rating|thermometer|depthLevel|qualityScore|overallScore|aggregateScore|totalScore|completeness)\b/i
for (const f of [PANEL, ENGINE, CONFIG]) {
  const src = code(f)
  const hit = src.match(SCORE_WORDS)
  ok(`${f}: no score/star/thermometer vocabulary`, !hit, hit?.[0])
}
ok('the facts type carries counts and a date, and nothing that sums them',
  /issuesRaised: number/.test(read(ENGINE)) && !/score/i.test(read(ENGINE).match(/interface EvidenceFacts[\s\S]{0,600}?\}/)?.[0] ?? ''))

// ── §24.1 progress label + §24.2 facts ON THE IDEA, not only in the create flow ──
// ⚠ BOTH OF THESE WERE MISSED IN THE FIRST BUILD and found by re-reading §24 against
// what shipped, not by any check — which is why they are asserted now. The facts were
// rendering only inside the Deepening section of the create flow (visible to someone
// already deepening the idea, i.e. the person who least needs telling), and the progress
// label did not exist at all.
console.log('\n§24.1/§24.2 — the progress label and the facts live on the idea')
const STRIP = 'components/lex/EvidenceFactsStrip.tsx'
const DETAIL = 'app/ideas/[id]/IdeaDetailClient.tsx'
const strip = code(STRIP)
ok('there is a progress label deriving Skeleton → Deepened',
  /deepeningProgressLabel/.test(strip) && /'Skeleton'/.test(strip) && /'Deepened'/.test(strip))
ok('...and Deepened requires a RUN pass whose issues are TRIAGED, not merely a run',
  /status === 'RUN'/.test(strip) && /i\.status !== 'OPEN'/.test(strip))
ok('the idea header renders the strip', /<EvidenceFactsStrip/.test(code(DETAIL)))
ok('...owner-gated, because §24.7 needs versioning and reviews before it faces a stranger',
  /isOwner=\{isOwner\}/.test(code(DETAIL)) && /if \(!isOwner\)/.test(strip))
ok('the strip carries no score vocabulary either', !SCORE_WORDS.test(strip),
  strip.match(SCORE_WORDS)?.[0])
// The unreachable rungs must not be displayed as if they were reachable.
ok('Team-reviewed / Published are NOT offered as labels yet (§22.4 and §20.3 unbuilt)',
  !/'Team-reviewed'|'Published'/.test(strip))

// ── 9. a fifth pass is configuration ─────────────────────────────────────────
console.log('\n§4 — adding a fifth pass is configuration, not construction')
const NON_CONFIG = [ENGINE, CLIENT, SETTLE, PANEL, ...ROUTES]
for (const key of PASS_KEYS) {
  const named = NON_CONFIG.filter((f) => new RegExp(`['"\`]${key}['"\`]`).test(code(f)))
  ok(`${key} is not hardcoded outside the config`, named.length === 0, named.join(', '))
}
ok('the engine iterates PASSES rather than switching on a key',
  /PASSES\.map|for \(const .* of PASSES\)/.test(engine) && !/switch \(passKey\)/.test(engine))
ok('the route validates the key through the config, not a literal list', /isPassKey\(passKey\)/.test(code(ROUTES[1])))

// ── 10. the passes themselves, and their templates ───────────────────────────
console.log('\n§2.3/§2.6 — the four passes')
ok('there are exactly four Pilot A passes', PASSES.length === 4, `${PASSES.length}`)
for (const p of PASSES) {
  const issues: string[] = []
  if (!p.training.trim()) issues.push('no training copy')
  if (!p.method.trim()) issues.push('no method block')
  if (!p.intents.length) issues.push('no intents')
  if (!p.mustAnswer.length) issues.push('no must-answer questions')
  ok(`${p.key} is fully configured`, issues.length === 0, issues.join('; '))
}
ok('MECHANISM_ANALOGUE is NOT a Pilot A intent (explicitly out of scope)',
  !PASSES.some((p) => (p.intents as string[]).includes('MECHANISM_ANALOGUE')))
ok('the three new gateway intents are declared',
  ['PRECEDENT', 'CAUSAL_EVIDENCE', 'DEVOLUTION_SCOPE'].every((i) => new RegExp(`'${i}'`).test(read('lib/lex/search-gateway.ts'))))
ok('isPassKey accepts the configured keys and rejects others',
  PASS_KEYS.every((k) => isPassKey(k)) && !isPassKey('MECHANISM_ANALOGUE') && !!passDef(PASS_KEYS[0]))

// Templates must be able to FIRE and to NOT FIRE. A `when` that is always true is
// boilerplate attached to every idea; one that is always false is dead code.
console.log('\n§2.3 — issue templates fire on evidence, and can also stay silent')
// ⚠ TWO probe contexts were not enough, and the check said so on its first run:
// `precedent-outcome-unknown` and `no-contradicting-evidence-sought` were false on BOTH,
// which proves nothing about the template and everything about the probes. The property
// actually worth asserting is "there exists a run this fires on, and a run it stays
// silent on" — so the probes are now a matrix, and each template must be true somewhere
// and false somewhere in it.
const PROBES: Array<{ name: string; ctx: IssueContext }> = [
  {
    name: 'empty run',
    ctx: {
      countsByKind: {}, findingCount: 0, typesReturned: {}, knownUnknownCount: 0,
      hasCostLines: false, hasChosenApproach: false, jurisdictionMentioned: false,
    },
  },
  {
    name: 'full run',
    ctx: {
      countsByKind: { SUPPORTS: 2, CONTRADICTS: 1, PRECEDENT: 2 },
      findingCount: 5,
      typesReturned: {
        PRIMARY_LEGISLATION: 3, STATUTORY_INSTRUMENT: 2, CASE_LAW: 1,
        DEBATE: 2, GUIDANCE: 2, IMPACT_ASSESSMENT: 1,
      },
      knownUnknownCount: 0, hasCostLines: true, hasChosenApproach: true, jurisdictionMentioned: true,
    },
  },
  {
    name: 'precedents found, but no outcome material',
    ctx: {
      countsByKind: { PRECEDENT: 3, SUPPORTS: 1 },
      findingCount: 4,
      typesReturned: { PRIMARY_LEGISLATION: 2, STATUTORY_INSTRUMENT: 1, IMPACT_ASSESSMENT: 2, CASE_LAW: 1, DEBATE: 1 },
      knownUnknownCount: 1, hasCostLines: true, hasChosenApproach: true, jurisdictionMentioned: true,
    },
  },
  {
    name: 'everything agrees — nothing contradicts',
    ctx: {
      countsByKind: { SUPPORTS: 4 },
      findingCount: 4,
      typesReturned: { PRIMARY_LEGISLATION: 2, STATUTORY_INSTRUMENT: 1, GUIDANCE: 2, CASE_LAW: 1, DEBATE: 2, IMPACT_ASSESSMENT: 1 },
      knownUnknownCount: 0, hasCostLines: true, hasChosenApproach: true, jurisdictionMentioned: true,
    },
  },
]
for (const p of PASSES) {
  for (const t of p.issueTemplates) {
    const results = PROBES.map((probe) => ({ probe: probe.name, fired: t.when(probe.ctx) }))
    const fires = results.filter((r) => r.fired).map((r) => r.probe)
    const silent = results.filter((r) => !r.fired).map((r) => r.probe)
    ok(`${p.key}/${t.id} fires on at least one run shape`, fires.length > 0,
      `silent on all: ${silent.join(' | ')}`)
    ok(`${p.key}/${t.id} stays silent on at least one run shape`, silent.length > 0,
      `fires on all: ${fires.join(' | ')}`)
    ok(`${p.key}/${t.id} names something addressable`, t.text.length > 60 && !/^consider /i.test(t.text))
  }
}

// ── §19-E Task 3 — the sift ──────────────────────────────────────────────────
console.log('\n§19-E Task 3 — sift, don\'t rank-and-dump')
const SIFT = 'lib/lex/deepening-sift.ts'
const sift = code(SIFT)
ok('the pass reads the UNGROUPED results, not the panel-grouped ~20',
  /retrieved\.push\(\.\.\.res\.results\)/.test(engine) && !/retrieved\.push\(\.\.\.res\.grouped\)/.test(engine),
  'groupForPanel caps at 3 per display type — a presentation rule, not a candidate set')
ok('the candidate target is ~100, not the old 14',
  /SIFT_CANDIDATE_TARGET/.test(engine) && SIFT_CANDIDATE_TARGET >= 60, `${SIFT_CANDIDATE_TARGET}`)
ok('a kept candidate must carry a reason, and one without is DISCARDED',
  /reason\.length < 12/.test(sift) && /keep discarded/.test(read(SIFT)))
ok('a keep for an id not in the candidate list is dropped',
  /const src = byId\.get\(k\.id\.trim\(\)\)/.test(sift) && /if \(!src \|\| judgements\.has\(src\.id\)\) continue/.test(sift))
ok('the precedent test is separate from relevance', /isPrecedent/.test(sift) && /PRECEDENT TEST/.test(read(SIFT)))
ok('...and the engine ENFORCES it, downgrading rather than trusting the gather',
  /kind === 'PRECEDENT' && judged && !judged\.isPrecedent/.test(engine) && /kind = 'FINDING'/.test(engine))
ok('...without deleting the finding — only the word "precedent" is withdrawn',
  !/if \(judged && !judged\.isPrecedent\) continue/.test(engine))
ok('a sift that cannot run returns the ranked set MARKED, never an empty pass',
  /skipped: true/.test(sift) && /const passthrough =/.test(sift))
ok('finishReason is checked BEFORE parsing (CLAUDE.md §18.1)',
  sift.indexOf('geminiFinishProblem') < sift.indexOf('JSON.parse'))
ok('a truncated sift is a passthrough, not a partial keep-list',
  /if \(cut\) \{[\s\S]{0,220}return passthrough/.test(sift))

console.log('\n§19-E Task 3 — the discard count is REPORTED, not hidden')
ok('the counts are persisted on the pass row',
  /candidatesReviewed/.test(engine) && /candidatesKept/.test(engine) && /siftSkipped/.test(engine))
ok('...in the same guarded write as the status', /candidatesReviewed: sift\.reviewed/.test(engine))
ok('the schema carries all three columns',
  ['candidatesReviewed', 'candidatesKept', 'siftSkipped'].every((c) => new RegExp(c).test(read('prisma/schema.prisma'))))
ok('...and the SQL delta is idempotent (ADD COLUMN IF NOT EXISTS)',
  (read('prisma/lex_deepening_sift.sql').match(/ADD COLUMN IF NOT EXISTS/g) ?? []).length >= 5)
ok('the panel renders the sift line', /p\.sift &&/.test(code(PANEL)) && /p\.sift\.line/.test(code(PANEL)))
ok('...and marks a SKIPPED sift differently from a real one, so they are not confused',
  /p\.sift\.skipped/.test(code(PANEL)) && /did not run on this pass/.test(read(SIFT)))
ok('the panel shows the sift\'s reason on each finding', /f\.siftReason/.test(code(PANEL)))
// The three silences. "The search broke", "the corpus is silent", and "we reviewed 104
// and none bore on this" are different findings about the world.
ok('"reviewed N and none bore on this" is distinguished from "nothing was retrieved"',
  /none of them bore on this proposal's problem/.test(read(ENGINE)) &&
  /returned no material on this idea/.test(read(ENGINE)))
ok('...and the panel says which of the two happened', /none of them bore on your proposal/.test(read(PANEL)))

// ── §19-E Task 4 — the issues come from a different vantage point ────────────
console.log('\n§19-E Task 4 — self-critique from a different angle')
const ADV = 'lib/lex/deepening-adversarial.ts'
const adv = code(ADV)
ok('there is a SEPARATE call for the issues', /export async function generateAdversarialIssues/.test(adv))
ok('...with an adversarial brief', /COMMITTEE CLERK/.test(read(ADV)) && /where is this proposal weakest/i.test(read(ADV)))
ok('...that is given the findings to read critically', /findings: RawFinding\[\]/.test(adv))
ok('the engine uses it in place of the gather\'s own issues',
  /const issueTexts = adversarial \?\? gathered\.issues/.test(engine))
ok('...and says so when it fell back, rather than degrading silently',
  /adversarial issues call failed/.test(read(ENGINE)) && /adversarialIssues/.test(engine))
ok('the DETERMINISTIC templates still run — they fired correctly and a model is the wrong instrument',
  /raiseTemplateIssues\(ideaId, def, runVersion/.test(engine))
ok('finishReason is checked BEFORE parsing here too',
  adv.indexOf('geminiFinishProblem') < adv.indexOf('JSON.parse'))
ok('a one-clause "issue" is rejected rather than shown', /s\.length >= 40/.test(adv))
ok('the panel names whose reading the issues are',
  /hostile committee clerk/.test(read(PANEL)))
ok('the adversarial reading never invents a citation',
  /NEVER invent a citation/.test(read(ADV)))

// ── readKnownUnknowns tolerates the shapes a JSONB column can actually hold ──
console.log('\nstored-shape tolerance')
ok('null → []', readKnownUnknowns(null).length === 0)
ok('a non-array object → []', readKnownUnknowns({ question: 'x' }).length === 0)
ok('entries without a question are dropped', readKnownUnknowns([{ why: 'no question' }]).length === 0)
ok('a well-formed entry survives with its why',
  readKnownUnknowns([{ question: 'q', why: 'w' }])[0]?.why === 'w')

console.log(fail === 0 ? '\nAll checks pass.' : `\n${fail} check(s) FAILED.`)
process.exit(fail === 0 ? 0 : 1)
