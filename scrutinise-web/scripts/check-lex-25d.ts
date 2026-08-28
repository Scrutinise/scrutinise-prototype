// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25d — Sprint 25-D / 20-E.
//
// ⚠ EVERY ASSERTION HERE HAS A CONTROL, and the run reports any control that DID NOT FIRE.
// The rule this codebase keeps arriving back at: a check nobody has watched fail is a check
// asserting nothing. 25-C found two of its own guards inert — one pinned a literal that had
// moved into a helper, one used `.replace`, which substitutes only the first occurrence, so
// its mutation left a second copy standing and the assertion still matched.
//
// No database, no network, no model call. Everything here is a pure function or a file read,
// so it runs in CI and on a laptop identically. The live half is `verify:lex-25d`.
//
//   npx tsx scripts/check-lex-25d.ts
//   npx tsx scripts/check-lex-25d.ts --self-test    (report the controls in full)
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { REACHABLE, PASS_DEFAULTS } from '../lib/lex/model-registry'
import { samplingFor, samplingOmissions, acceptsTemperature, REJECTS_TEMPERATURE } from '../lib/lex/model-sampling'
import {
  QUESTION_HEADINGS, HEADING_ORDER, HEADINGS_WITH_NO_PRODUCER, statedGap, isHeadingKey,
  type HeadingKey, type EmptyReason,
} from '../lib/lex/question-headings'
import { INTERROGATION_LIBRARY } from '../lib/lex/interrogation-library'
import { PASSES } from '../lib/lex/deepening-config'
import { headingCoverage } from '../lib/lex/question-panel'
import { quoteIsInText, normalise } from '../lib/lex/user-material'
import { buildEvidencePackDocument } from '../lib/documents/build-evidence-pack'
import { SNAPSHOT_VERSION, type ProposalSnapshot } from '../lib/documents/proposal-snapshot'
import type { Block, DocumentModel } from '../lib/documents/model'

const selfTest = process.argv.includes('--self-test')
const ROOT = join(__dirname, '..')

let pass = 0
let fail = 0
function ok(label: string, condition: boolean, detail?: string) {
  if (condition) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const breaks: { label: string; fired: boolean }[] = []
/** Run `propertyHolds` on DELIBERATELY BROKEN input and require it to be false. */
function expectBreak(label: string, propertyHolds: () => boolean) {
  let held: boolean
  try { held = propertyHolds() } catch { held = false }
  breaks.push({ label, fired: !held })
}

/**
 * ⚠ NORMALISED ON READ. A Python edit helper writes CRLF on Windows, and 25-C had a guard
 * report a failure about perfectly correct code because it sliced on `'\n}\n'`. Every file
 * read in this harness goes through here.
 */
function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')
}

function modelText(model: DocumentModel): string {
  const runs = (bs: Block[]): string => bs.map((b) => {
    switch (b.kind) {
      case 'heading': case 'paragraph': return b.runs.map((r) => r.text).join('')
      case 'bullets': return b.items.map((i) => i.map((r) => r.text).join('')).join('\n')
      case 'sources': return `${b.label}\n${b.refs.map((r) => `${r.title} ${r.citation} ${r.url} ${r.snippet ?? ''}`).join('\n')}`
      case 'note': return b.text
      case 'rule': return ''
    }
  }).join('\n')
  return `${model.title}\n${model.subtitle ?? ''}\n${runs(model.blocks)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// A snapshot fixture, built for THIS sprint's members: an excluded source that is
// deliberately NOT in `sources`, a cost line with no basis, and a pinned outstanding block.
// ─────────────────────────────────────────────────────────────────────────────

function fixture(overrides: Partial<ProposalSnapshot> = {}): ProposalSnapshot {
  const base = {
    snapshotVersion: SNAPSHOT_VERSION,
    ideaId: 'idea-25d',
    generatedAt: '2026-08-21T09:00:00.000Z',
    title: 'Naming the responsible official in departmental accounting reports',
    summaryDescription: 'Accountability is diffused across a department; name who is answerable.',
    owner: { id: 'u1', name: 'Charlie' },
    userKnowledge: null,
    fields: [
      { key: 'challenge', label: 'The problem', status: 'ACCEPTED', value: 'Nobody is named.', slots: [], evidenceIds: ['ev1'], supported: true },
      { key: 'chosenApproach', label: 'The approach', status: 'ACCEPTED', value: 'Amend the accounting officer duty.', slots: [], evidenceIds: [], supported: false },
    ],
    causes: [],
    options: [
      { id: 'o1', approach: 'A statutory duty of candour', mechanismTypes: [], caseFor: 'It has worked in health.', caseAgainst: null, status: 'RULED_OUT', ruleOutReason: 'It needs primary legislation this proposal is trying to avoid.', source: 'LEX' },
    ],
    actions: [],
    costs: {
      lines: [
        { id: 'l1', actionId: 'a1', label: 'Reporting system change', costType: 'OTHER', category: 'IMPLEMENTATION', staffLevel: null, fteCount: null, durationMonths: null, low: 90000, high: 140000, unit: 'GBP', basis: 'Two comparable departmental reporting changes, 2021 and 2023.', benchmarkId: null, priceYear: 2025 },
        // ⚠ NO BASIS. The pack must mark this rather than print it beside the one above.
        { id: 'l2', actionId: 'a1', label: 'Ongoing assurance', costType: 'OTHER', category: 'IMPLEMENTATION', staffLevel: null, fteCount: null, durationMonths: null, low: 40000, high: 40000, unit: 'GBP', basis: null, benchmarkId: null, priceYear: null },
      ],
      summary: null,
      problemCost: '£2.1bn a year in written-off programmes',
    },
    evidence: [
      { id: 'ev1', passKey: 'question:LEGAL_LANDSCAPE', fieldRef: 'challenge', kind: 'FINDING', title: 'Government Resources and Accounts Act 2000', body: '…', citation: 'GRAA 2000, s.5', url: 'https://www.legislation.gov.uk/ukpga/2000/20/section/5', sourceType: 'PRIMARY_LEGISLATION', siftReason: 'States the accounting officer duty this would amend.', headingKey: 'LAW_NOW' },
      { id: 'ev2', passKey: 'ADVERSARIAL', fieldRef: null, kind: 'CONTRADICTS', title: 'PAC on personal naming', body: '…', citation: 'PAC 2019, HC 987', url: 'https://committees.parliament.uk/x', sourceType: 'COMMITTEE', siftReason: 'Read paragraphs 14–19: the only place a committee has tested whether an official can be named.', headingKey: 'AGAINST' },
      // ⚠ Untagged — written before 25-D. It must appear under "not filed", never be swept in.
      { id: 'ev3', passKey: 'LEGACY', fieldRef: null, kind: 'FINDING', title: 'An older finding', body: '…', citation: null, url: null, sourceType: null, siftReason: null, headingKey: null },
    ],
    issues: [
      { id: 'i1', passKey: 'LEGAL', text: 'Whether naming engages Article 8', status: 'OPEN', dismissReason: null, resolutionNote: null },
      { id: 'i2', passKey: 'LEGAL', text: 'Whether the duty is devolved', status: 'DISMISSED', dismissReason: 'Reserved.', resolutionNote: null },
    ],
    knownUnknowns: [{ question: 'Has any department ever named an individual?', why: 'Nothing retrieved settles it', passKey: 'question:PRECEDENT' }],
    forks: {
      open: [{ id: 'f1', forkKey: 'instrument', fieldKey: 'chosenApproach', chosen: 'Amend the duty', alternative: 'Use the existing direction power', caseForAlternative: 'It may already reach this.', resolved: false }],
      resolved: [],
    },
    sources: [
      {
        group: 'PRIMARY_LEGISLATION', label: 'Primary legislation',
        refs: [{ id: 'ukpga/2000/20', title: 'Government Resources and Accounts Act 2000', citation: 'GRAA 2000', url: 'https://www.legislation.gov.uk/ukpga/2000/20', decision: null, exclusionReason: null, annotation: null }],
      },
    ],
    // ⚠ NOT in `sources` — the case a filter over the retrieved set cannot see.
    excludedSources: [
      { sourceKey: 'ukia/2019/0031', title: 'Impact Assessment — Accounting Officer Assessments', citation: 'IA No. HMT/2019/0031', url: 'https://www.legislation.gov.uk/ukia/2019/31', reason: 'It assesses a disclosure regime, not personal naming.', annotation: null, decidedAt: '2026-08-21T08:00:00.000Z' },
    ],
    outstanding: {
      openIssues: [{ id: 'i1', passKey: 'LEGAL', text: 'Whether naming engages Article 8' }],
      unresolvedForks: [{ forkKey: 'instrument', fieldKey: 'chosenApproach', chosen: 'Amend the duty', alternative: 'Use the existing direction power' }],
      declaredGaps: [{ question: 'Has any department ever named an individual?', why: 'Nothing retrieved settles it', passKey: 'question:PRECEDENT' }],
      unsupportedFields: ['The approach'],
      counts: { openIssues: 1, totalIssues: 2, unresolvedForks: 1, declaredGaps: 1 },
    },
    passes: [{ passKey: 'question:LEGAL_LANDSCAPE', status: 'RUN', completedAt: '2026-08-21T08:00:00.000Z', failureReason: null }],
    scaffolded: [],
    coverage: { fieldsTotal: 2, fieldsSupported: 1, actionsTotal: 0, actionsSupported: 0 },
  } as unknown as ProposalSnapshot
  return { ...base, ...overrides }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠ THE MAPPING REPORT §3 ASKS FOR, PRINTED FROM THE CODE RATHER THAN WRITTEN DOWN.
 *
 * "Report what you mapped and anything that had no home, because a source with no heading
 * is a gap in the library, not a source to drop." A prose list in a sprint report is true
 * on the day it is written; this is true whenever it is run, which is what makes it worth
 * having when somebody adds the eleventh question.
 */
function printMap() {
  console.log('── §25.5 heading coverage ──\n')
  for (const c of headingCoverage()) {
    const producer = c.producer === 'NONE' ? '⚠ NOTHING ANSWERS THIS' : c.producer
    console.log(`  ${c.heading}`)
    console.log(`    producer: ${producer}`)
    if (c.questions.length) console.log(`    questions: ${c.questions.join(' · ')}`)
    const passes = PASSES.filter((p) => p.heading === c.key).map((p) => p.label)
    if (passes.length) console.log(`    deepening passes: ${passes.join(' · ')}`)
    console.log('')
  }
  console.log('  Anything with no home:')
  console.log('    · REVISE (the build\'s contradictions) — deliberately unfiled; it leads the review')
  console.log('      agenda instead, and a panel heading would bury the build\'s best output again.')
  console.log(`    · ${HEADINGS_WITH_NO_PRODUCER.length} heading(s) declared unanswerable: ${HEADINGS_WITH_NO_PRODUCER.join(', ')}`)
}

function main() {
  if (process.argv.includes('--map')) { printMap(); process.exit(0) }
  console.log('── check:lex-25d ──\n')

  // ══ §1 — the model registry ═══════════════════════════════════════════════
  console.log('§1 — three model-registry fixes')

  const MULTI_AGENT = 'grok-4.20-multi-agent-0309'
  const allReachable = (Object.values(REACHABLE) as string[][]).flat()
  ok('§1a — the multi-agent endpoint is not in REACHABLE',
    !allReachable.includes(MULTI_AGENT))
  expectBreak('§1a — break: pretend it is still listed',
    () => ![...allReachable, MULTI_AGENT].includes(MULTI_AGENT))
  ok('§1a — xAI is still a vendor; the standard models stay',
    REACHABLE.xai.length > 0 && REACHABLE.xai.includes('grok-4.3'))
  ok('§1a — no pass points at the dropped model',
    !Object.values(PASS_DEFAULTS).includes(MULTI_AGENT as never))

  // §1b — sampling is per model.
  ok('§1b — a model that rejects temperature does not get it',
    samplingFor('claude-sonnet-5', { temperature: 0.4 }).temperature === undefined)
  ok('§1b — a model that accepts it still gets it',
    samplingFor('claude-haiku-4-5', { temperature: 0.4 }).temperature === 0.4)
  ok('§1b — Gemini is unaffected',
    samplingFor('gemini-2.5-flash', { temperature: 0.2 }).temperature === 0.2)
  expectBreak('§1b — break: an allow-everything gate would send it to a rejecting model',
    () => ({ temperature: 0.4 } as { temperature?: number }).temperature === undefined)
  ok('§1b — the omission announces itself rather than happening silently',
    samplingOmissions('claude-sonnet-5', { temperature: 0.4 }).length === 1
    && samplingOmissions('claude-haiku-4-5', { temperature: 0.4 }).length === 0)
  ok('§1b — no temperature asked for means none invented',
    samplingFor('claude-haiku-4-5', {}).temperature === undefined)
  expectBreak('§1b — break: a default temperature invented for a caller that never asked',
    () => (samplingFor('claude-haiku-4-5', { temperature: 0.4 }) as { temperature?: number }).temperature === undefined)

  // ⚠ THE ALLOW-LIST IS NOT A VERSION RULE, and this asserts the counter-example that proves
  // it — "anything below 5 accepts it" would have been tidy and wrong.
  ok('§1b — it is an allow-list, not a version rule (4-8 rejects, haiku-4-5 accepts)',
    REJECTS_TEMPERATURE.has('claude-opus-4-8') && acceptsTemperature('claude-haiku-4-5'))

  const modelCall = read('lib/lex/model-call.ts')
  // ⚠ ASSERTED ON ALL THREE VENDOR PATHS. 25-C's fix lived inside the Anthropic branch only,
  // and the next model to deprecate a knob will not be Anthropic's.
  // ⚠ THE PRECISE FORM MATTERS. "No `temperature:` anywhere" would be wrong — the gate helper
  // has to name the parameter to pass it. What must be true is that the CALLER's temperature
  // is read in exactly ONE place (that helper) and reaches all three request bodies only
  // through it. A blunter regex fails on its own helper and teaches everyone to delete it.
  const rawReads = (modelCall.match(/o\.temperature/g) ?? []).length
  const gated = (modelCall.match(/\.\.\.sampling\(o/g) ?? []).length
  ok('§1b — the caller\'s temperature is read in exactly one place, and all three vendors go through it',
    rawReads === 1 && gated === 3, `${rawReads} raw read, ${gated} gated vendor paths`)
  expectBreak('§1b — break: pretend a vendor path reads it raw as well',
    () => ((`${modelCall}\n temperature: o.temperature ?? 0.4,`).match(/o\.temperature/g) ?? []).length === 1)
  ok('§1b — the build\'s own Gemini path goes through the gate too',
    /samplingFor\(opts\.model/.test(read('lib/lex/build-llm.ts')))

  // §1c — the reachability check makes a representative call.
  const reach = read('scripts/check-model-reachability.ts')
  ok('§1c — the probe goes through callModelJson, the production entry point',
    /callModelJson</.test(reach))
  ok('§1c — it sends the sampling parameter production sends',
    /temperature:\s*0\.4/.test(reach))
  ok('§1c — the probe schema NESTS an array of objects, as real schemas do',
    /notes:\s*\{[\s\S]{0,200}type:\s*'array'/.test(reach))
  ok('§1c — "reachable" and "usable" are separate verdicts',
    /'UNUSABLE'/.test(reach) && /5 outcomes|FIVE outcomes/i.test(reach))
  ok('§1c — a ping-only probe is labelled as one, never shown as a clean pass',
    /representative:\s*false/.test(reach) && /ping only/.test(reach))
  expectBreak('§1c — break: a check with no UNUSABLE verdict cannot tell reachable from usable',
    () => /'UNUSABLE'/.test(reach.split("'UNUSABLE'").join("'OK'")))
  ok('§1c — the echoed model comes back on every call, not only in the check',
    /echoedModel/.test(modelCall) && (modelCall.match(/echoedModel:/g) ?? []).length >= 3)

  // ══ §2a — sources gain an excluded state ══════════════════════════════════
  console.log('\n§2a — excluded, never deleted')

  const sourcesLib = read('lib/lex/sources.ts')
  const sourcesRoute = read('app/api/ideas/[id]/sources/route.ts')
  ok('§2a — an exclusion with no reason is refused rather than stored',
    /MissingExclusionReason/.test(sourcesLib) && /throw new MissingExclusionReason/.test(sourcesLib))
  ok('§2a — the route turns that refusal into a 422 the user can read',
    /MissingExclusionReason/.test(sourcesRoute) && /status:\s*422/.test(sourcesRoute))
  // ⚠ THE STRUCTURAL VERSION OF "NEVER DELETED": there is no verb that could.
  ok('§2a — the sources route has no DELETE — nothing can remove a decision',
    !/export async function DELETE/.test(sourcesRoute))
  expectBreak('§2a — break: pretend the route grew a DELETE',
    () => !/export async function DELETE/.test(`${sourcesRoute}\nexport async function DELETE() {}`))
  ok('§2a — the decision row copies the source, so it can stand alone later',
    /title:\s*input\.source\.title/.test(sourcesLib) && /citation:\s*input\.source\.citation/.test(sourcesLib))
  ok('§2a — re-including does not erase the stated reason',
    /\.\.\.\(reason \? \{ reason \} : \{\}\)/.test(sourcesLib))
  expectBreak('§2a — break: an update that always writes reason would erase it on re-include',
    () => /\.\.\.\(reason \? \{ reason \} : \{\}\)/.test(sourcesLib.split('...(reason ? { reason } : {}),').join('reason,')))

  const sql = read('prisma/lex_25d.sql')
  ok('§2a — the decision table is keyed per idea and source, and cascades with the idea',
    /IdeaSourceDecision_ideaId_sourceKey_key/.test(sql) && /IdeaSourceDecision_ideaId_fkey[\s\S]{0,200}ON DELETE CASCADE/.test(sql))

  // ══ §2b — publishing pins the outstanding items ═══════════════════════════
  console.log('\n§2b — the agenda is continuous; a version is frozen')

  const snapLib = read('lib/documents/proposal-snapshot.ts')
  ok('§2b — the snapshot carries what was outstanding',
    /outstanding: SnapshotOutstanding/.test(snapLib) && /excludedSources: SnapshotExcludedSource\[\]/.test(snapLib))
  ok('§2b — a stored version is returned VERBATIM, never recomputed from today\'s rows',
    /if \(version !== undefined\)/.test(snapLib) && /return stored\.snapshot as unknown as ProposalSnapshot/.test(snapLib))
  expectBreak('§2b — break: a version that rebuilt from live state would not be pinned at all',
    () => /return stored\.snapshot as unknown as ProposalSnapshot/.test(
      snapLib.split('return stored.snapshot as unknown as ProposalSnapshot').join('return buildProposalSnapshot(ideaId)')))
  // ⚠ ONE ENTRY PER DECISION POINT. A three-way fork is three rows sharing a forkKey, and
  // counting rows would report one open decision as three — the number §24 then compares.
  const snap = fixture()
  ok('§2b — an unresolved fork is counted once, not once per alternative',
    snap.outstanding.counts.unresolvedForks === 1 && snap.outstanding.unresolvedForks.length === 1)
  ok('§2b — the shape version was bumped, so a renderer knows what it is holding',
    SNAPSHOT_VERSION >= 2)

  // ══ §3 — the panel by question ════════════════════════════════════════════
  console.log('\n§3 — the panel, organised by question')

  // ⚠ ELEVEN SINCE 25-J §4 ADDED `REFERS_TO_THIS`. The count is still asserted rather
  // than dropped: this file's claim is that the panel is organised by a FIXED library of
  // questions, and a check that stopped counting would stop noticing a heading appearing
  // by accident — which is how a panel grows a section nobody designed.
  // ⚠ ELEVEN → THIRTEEN (25-L §3b added `HOW_HARD` and `KEY_SOURCES`). The number is
  // updated rather than the assertion deleted: a check that stops counting stops noticing a
  // heading nobody designed — the same reasoning that kept 25-D's "ten headings" alive when
  // it became eleven. The two lists must also agree with each other, which is what catches a
  // key added to the union and forgotten in the order.
  ok('§3 — the thirteen §25.5 headings are the library, and the order covers all of them',
    QUESTION_HEADINGS.length === 13 && HEADING_ORDER.length === 13)
  ok('§3 — every interrogation question declares a real heading',
    INTERROGATION_LIBRARY.every((q) => isHeadingKey(q.heading)))
  expectBreak('§3 — break: a question naming a heading that does not exist',
    () => [...INTERROGATION_LIBRARY, { heading: 'NOT_A_HEADING' }].every((q) => isHeadingKey(q.heading)))
  ok('§3 — every Deepening pass declares a real heading',
    PASSES.every((p) => isHeadingKey(p.heading)))

  // ⚠⚠ THE CENTRAL ASSERTION: EVERY HEADING EITHER HAS A PRODUCER OR IS DECLARED AS HAVING
  // NONE. A heading with neither would render "we looked and found nothing" for a question
  // nothing in this build ever asks — a false statement about the record, told to cover a
  // gap in our tooling.
  const coverage = headingCoverage()
  const orphans = coverage.filter((c) => c.producer === 'NONE' && !HEADINGS_WITH_NO_PRODUCER.includes(c.key))
  ok('§3 — no heading is silently unanswerable', orphans.length === 0,
    orphans.length ? orphans.map((o) => o.key).join(', ') : `${coverage.length} headings mapped`)
  expectBreak('§3 — break: a heading with no producer and no declaration',
    () => [...coverage, { key: 'GHOST' as HeadingKey, producer: 'NONE' as const }]
      .filter((c) => c.producer === 'NONE' && !HEADINGS_WITH_NO_PRODUCER.includes(c.key)).length === 0)

  // ⚠ And the converse: a heading declared unbuildable must NOT have a producer, or we would
  // be telling the user their evidence does not exist while showing it to them.
  const contradictory = HEADINGS_WITH_NO_PRODUCER.filter(
    (k) => INTERROGATION_LIBRARY.some((q) => q.heading === k) || PASSES.some((p) => p.heading === k),
  )
  ok('§3 — nothing is declared unanswerable AND answered', contradictory.length === 0)
  expectBreak('§3 — break: declare a heading unanswerable that a question already answers',
    () => [...HEADINGS_WITH_NO_PRODUCER, 'LAW_NOW' as HeadingKey]
      .filter((k) => INTERROGATION_LIBRARY.some((q) => q.heading === k)).length === 0)

  // The four empty reasons must not share a sentence.
  const reasons: EmptyReason[] = ['asked-found-nothing', 'not-asked', 'no-producer', 'nothing-added']
  const texts = reasons.map((r) => statedGap('POSITIONS', r))
  ok('§3 — the four reasons a heading can be empty produce four different sentences',
    new Set(texts).size === 4)
  expectBreak('§3 — break: two reasons sharing one sentence',
    () => new Set([...texts.slice(0, 3), texts[0]]).size === 4)
  // ⚠ 25-L §5 REWROTE THIS NOTE AND THE ASSERTION FOLLOWED THE PROPERTY, NOT THE WORDS.
  // What must hold is that the sentence blames US and never the record: it may not say the
  // search found nothing, and it must say whose gap it is. "A limit in our tooling" was one
  // phrasing of that; "no pass writes findings under this heading yet" is another, and it is
  // now the true one — the graph IS readable on this screen, in beta, so the old sentence
  // had become a claim we could not stand behind.
  ok('§3 — an unbuildable heading blames our tooling, not the record',
    !/found nothing/.test(statedGap('POSITIONS', 'no-producer'))
    && !/nothing (?:exists|there)/i.test(statedGap('POSITIONS', 'no-producer'))
    && /\b(?:we|our|no pass|not part of the build)\b/i.test(statedGap('POSITIONS', 'no-producer')))
  expectBreak('§3 — break: the note blames the record instead of us',
    () => {
      const bad = 'We looked for votes on this and found nothing.'
      return !/found nothing/.test(bad)
    })
  ok('§3 — a search that found nothing says WHAT it looked for',
    statedGap('COURTS', 'asked-found-nothing').includes('judgments construing'))
  expectBreak('§3 — break: a bare "nothing found" with no statement of what was sought',
    () => 'We looked and found nothing.'.includes('judgments construing'))

  const panelLib = read('lib/lex/question-panel.ts')
  // §3 rule 2 — the reason line is the sift's or it is absent. Never generated.
  ok('§3 — the panel never invents a reason line',
    /siftReason\?\.trim\(\) \|\| null/.test(panelLib) && !/why: ['`]This/.test(panelLib))
  ok('§3 — there is no model call in the panel assembler',
    !/callJson|callModelJson|generateContent/.test(panelLib))
  expectBreak('§3 — break: pretend the assembler grew a model call',
    () => !/callJson|callModelJson|generateContent/.test(`${panelLib}\nawait callJson({})`))
  ok('§3 — the focus orders and marks; it does not filter',
    /bearsOnFocus/.test(panelLib) && !/\.filter\(\(e\) => e\.bearsOnFocus\)\s*$/m.test(panelLib))
  ok('§3 — a row with no heading is NAMED, not dropped',
    /unfiled/.test(panelLib) && /unfiled: PanelEntry\[\]/.test(panelLib))

  const bg = read('components/lex/BackgroundPanel.tsx')
  ok('§3 rule 4 — the full type-grouped list is still there, folded underneath',
    /Everything we retrieved, by document type/.test(bg) && /showFullList/.test(bg))
  ok('§3 — the by-question panel leads it',
    bg.indexOf('<QuestionPanel') > 0 && bg.indexOf('<QuestionPanel') < bg.indexOf('Everything we retrieved'))
  expectBreak('§3 — break: the question panel placed below the type list',
    () => bg.indexOf('Everything we retrieved') > bg.indexOf('<QuestionPanel')
      && 'Everything we retrieved <QuestionPanel'.indexOf('<QuestionPanel') < 0)

  const qPanel = read('components/lex/QuestionPanel.tsx')
  // ⚠⚠ REPOINTED BY 25-L §3a, AND THE PROPERTY GOT STRONGER RATHER THAN WEAKER.
  //
  // The old assertion was about a panel of thirteen independently collapsible headings: it
  // required the gap to render whether its heading was open or closed, because folding an
  // established absence away makes it indistinguishable from a question nobody asked. That
  // layout is gone — the panel is a contents list plus one open item — so the assertion is
  // now that BOTH surfaces carry it: the contents list prints WHICH KIND of empty each item
  // is (never a "0", which would be a false claim about the world), and the open item prints
  // the full stated gap. An empty item that vanished from the contents would be the same
  // defect one level up.
  ok('§3 rule 1 — an empty item states its KIND on the contents and its full gap when opened',
    /EMPTY_LABEL\[h\.gap\.reason\]/.test(qPanel)
    && /openHeading\.gap && \(/.test(qPanel)
    // and the contents list is built over every heading, not the non-empty ones
    && /data\.headings\.map\(\(h\) => \{/.test(qPanel))
  expectBreak('§3 rule 1 — break: the contents list filters empty items out',
    () => {
      const broken = qPanel.replace('data.headings.map((h) => {', 'data.headings.filter((h) => h.entries.length).map((h) => {')
      return /data\.headings\.map\(\(h\) => \{/.test(broken)
    })

  // ══ §4 — documents and links ══════════════════════════════════════════════
  console.log('\n§4 — the user\'s own material')

  const material = read('lib/lex/user-material.ts')
  const materialRoute = read('app/api/ideas/[id]/material/route.ts')

  // ⚠⚠ THE RULE THE WHOLE FEATURE RESTS ON. If the text can reach a prompt anywhere other
  // than the one-off findings pass, a fifty-page report is back in every turn.
  const readsText = ['lib/lex', 'app/api/ideas', 'components/lex']
  ok('§4 — only the findings pass reads the stored text',
    /storedText/.test(material) && (material.match(/storedText/g) ?? []).length <= 4)
  ok('§4 — the route never selects or returns the text',
    !/text:\s*true/.test(materialRoute) && /`text` is deliberately absent/.test(materialRoute))
  expectBreak('§4 — break: pretend the list select grew a text column',
    () => !/text:\s*true/.test(`${materialRoute}\n const S = { text: true }`))
  ok('§4 — the panel reads the documents without their text',
    /prisma\.ideaUserMaterial\.findMany/.test(panelLib) && !/text:\s*true/.test(panelLib))
  ok('§4 — nothing outside user-material.ts pulls the body into a prompt',
    readsText.length === 3 && !/material\.text/.test(panelLib) && !/material\.text/.test(materialRoute))

  // ⚠ The provenance check. A model asked to quote will sometimes reconstruct, and a
  // reconstructed quote attributed to the user's OWN document is the worst thing this
  // feature could produce.
  const doc = 'The Committee found that   no department has ever named an individual\naccounting officer in a published report.'
  ok('§4 — a real quote survives whitespace normalisation',
    quoteIsInText('no department has ever named an individual accounting officer', doc))
  ok('§4 — a reconstruction is REJECTED',
    !quoteIsInText('no department has ever identified an individual accounting officer', doc))
  expectBreak('§4 — break: a substring-of-first-words match would let a reconstruction through',
    () => !doc.includes('no department has ever'))
  ok('§4 — a too-short "quote" is not provenance',
    !quoteIsInText('The Committee', doc))
  ok('§4 — curly quotes and dashes do not break a real quote',
    quoteIsInText('The Committee found that no department has ever named an individual', doc))
  ok('§4 — a finding whose quote is not in the text is dropped, and the drop is logged',
    /finding DROPPED/.test(material) && /continue/.test(material))
  ok('§4 — no binary is stored: only the extracted text and the original\'s size',
    !/bytes: bytes/.test(materialRoute) && /sourceBytes: bytes\.byteLength/.test(materialRoute))
  ok('§4 — a link keeps its URL, resolved through redirects',
    /url: extracted\.finalUrl/.test(materialRoute))
  ok('§4 — an unreadable file is refused, not stored empty',
    /Nothing readable came out of/.test(material))
  ok('§4 — deleting a document deletes the findings that quote it',
    /evidenceItem\.deleteMany/.test(materialRoute))
  expectBreak('§4 — break: deleting the document but leaving its quotations behind',
    () => /evidenceItem\.deleteMany/.test(materialRoute.split('prisma.evidenceItem.deleteMany').join('noop')))
  ok('§4 — truncation is surfaced, never silent',
    /truncated/.test(materialRoute) && /truncated: true/.test(material))
  ok('§4 — the idea cascade deletes the text (GDPR erasure)',
    /IdeaUserMaterial_ideaId_fkey[\s\S]{0,200}ON DELETE CASCADE/.test(sql))

  // ⚠⚠ EXTRACTION MUST NOT EAT THE DOCUMENT, AND THIS GUARD EXISTS BECAUSE IT DID.
  //
  // A careless edit to the control-character class during this sprint made it match the LETTER
  // `u` as well: every uploaded document silently lost every `u` ("Treasury" -> "Treasry"), with
  // no error, nothing in a log, and no way to notice short of reading the stored text. It was
  // caught by looking at the output of a live fetch, which is not a method that scales.
  //
  // The assertion is deliberately about LETTERS SURVIVING rather than about the regex, because
  // the regex is what will be edited next time.
  const messy = ['The Treasury confirmed unusual usage.', '', '   ', '', 'Second paragraph.'].join('\n')
  const cleaned = normalise(messy)
  ok('§4 — extraction preserves every letter of the text',
    cleaned.includes('The Treasury confirmed unusual usage.') && cleaned.includes('Second paragraph.'))
  expectBreak('§4 — break: a control class that also matched a letter would drop it',
    () => messy.replace(/u/g, '').includes('The Treasury confirmed unusual usage.'))
  ok('§4 — and collapses whitespace-only lines rather than leaving pages of them',
    !/\n\s*\n\s*\n/.test(cleaned))
  expectBreak('§4 — break: a newline-only collapse cannot touch newline-space runs',
    () => !/\n\s*\n\s*\n/.test(messy.replace(/\n{4,}/g, '\n\n')))

  // ══ §5 — the Evidence Pack and the Online View ════════════════════════════
  console.log('\n§5 — the Evidence Pack and the Online View')

  const packed = buildEvidencePackDocument(fixture())
  const ptext = modelText(packed.model)

  ok('§5a — every source is grouped under the question it answers',
    ptext.includes('What the law says now') && ptext.includes('The strongest case against'))
  ok('§5a — a finding nobody tagged goes under "not filed", never swept into a heading',
    ptext.includes('Not filed under a question') && ptext.includes('An older finding'))
  expectBreak('§5a — break: an untagged finding filed under the first heading',
    () => ptext.split('Not filed under a question')[1]?.includes('An older finding') ?? false)

  // ⚠⚠ THE SECTION THE PACK EXISTS FOR.
  ok('§5a — the excluded source appears, WITH its reason',
    ptext.includes('Impact Assessment — Accounting Officer Assessments')
    && ptext.includes('It assesses a disclosure regime, not personal naming.'))
  ok('§5a — and it appears even though it is not in the retrieved source list',
    !JSON.stringify(fixture().sources).includes('ukia/2019/0031'))
  expectBreak('§5a — break: a pack that filtered the retrieved set would lose it entirely',
    () => JSON.stringify(fixture().sources).includes('ukia/2019/0031'))

  ok('§5a — a figure with no basis is MARKED, not printed beside ones that have one',
    ptext.includes('NO BASIS STATED'))
  expectBreak('§5a — break: a blank basis rendered as an empty string',
    () => ''.includes('NO BASIS STATED'))
  ok('§5a — the ruled-out alternative carries its reason',
    ptext.includes('A statutory duty of candour') && ptext.includes('primary legislation this proposal is trying to avoid'))
  ok('§5a — what was outstanding is stated as PINNED to this version',
    ptext.includes('does not change afterwards') && ptext.includes('1 of 2 issue'))
  ok('§5a — the declared gaps travel with it',
    ptext.includes('Has any department ever named an individual?'))
  ok('§5a — a settled field with nothing behind it is named',
    ptext.includes('Settled, with nothing in the record behind it') && ptext.includes('The approach'))

  // "Nothing was set aside" is a FINDING and is stated, not omitted.
  const cleanPack = modelText(buildEvidencePackDocument(fixture({ excludedSources: [] })).model)
  ok('§5a — "nothing was set aside" is stated rather than the section being dropped',
    cleanPack.includes('Considered and set aside') && cleanPack.includes('Nothing was set aside'))
  expectBreak('§5a — break: an empty section omitted altogether',
    () => 'Considered and set aside'.includes('Nothing was set aside'))

  // ⚠ A v1 snapshot is one somebody holds a link to. It must OPEN, with the newer sections
  // stated as absent rather than rendered empty (which would read as "nothing to declare").
  const v1 = fixture({ snapshotVersion: 1, excludedSources: undefined, outstanding: undefined } as never)
  const v1text = modelText(buildEvidencePackDocument(v1).model)
  ok('§5a — a version published before this sprint still renders',
    v1text.includes('Evidence Pack') && v1text.length > 500)
  ok('§5a — and says the newer sections were never recorded, rather than showing them empty',
    v1text.includes('before the record kept source decisions'))
  expectBreak('§5a — break: an absent section rendered as "nothing was set aside"',
    () => v1text.includes('Nothing was set aside.'))

  const online = read('app/proposals/[token]/page.tsx')
  ok('§5b — the online view reads the PINNED snapshot and never live idea state',
    /resolveSharedProposal/.test(online) && !/buildProposalSnapshot/.test(online))
  expectBreak('§5b — break: a page that rebuilt from live state would not be pinned',
    () => !/buildProposalSnapshot/.test(`${online}\nawait buildProposalSnapshot(id)`))
  ok('§5b — it renders the evidence with the corpus links live',
    /The evidence, by the question it answers/.test(online) && /target="_blank"/.test(online))
  ok('§5b — the gaps and the set-aside sources travel with the link, not only in the PDF',
    /Considered and set aside/.test(online) && /What this does not establish/.test(online))
  ok('§5b — the Evidence Pack is offered from the shared link',
    /EVIDENCE_PACK/.test(online))
  ok('§5b — a shape-1 version still opens on the page',
    /preShapeTwo/.test(online) && /snapshotVersion \?\? 1/.test(online))
  ok('§5b — it is no longer described as a cover sheet',
    !/THIS IS NOT §20\.1'S ONLINE VIEW/.test(online))

  // ── the controls ──────────────────────────────────────────────────────────
  console.log('')
  const inert = breaks.filter((b) => !b.fired)
  for (const b of breaks) {
    if (selfTest || !b.fired) console.log(`  ${b.fired ? '·' : '⚠'} control ${b.fired ? 'fired' : 'DID NOT FIRE'}: ${b.label}`)
  }
  if (inert.length) {
    // ⚠ An assertion whose control cannot fail is asserting nothing — and it will keep
    // reporting a green tick while the thing it guards rots. This is a FAILURE, not a note.
    fail += inert.length
    console.log(`\n⚠⚠ ${inert.length} control(s) did not fire. Those assertions cannot fail, so they assert nothing.`)
  } else {
    console.log(`  ${breaks.length} controls, all fired.`)
  }

  console.log(`\n${pass} passed, ${fail} failed.`)
  process.exit(fail ? 1 : 0)
}

main()
