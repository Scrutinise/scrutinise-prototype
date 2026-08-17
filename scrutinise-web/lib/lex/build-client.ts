// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-A §3/§4 — the build's four model calls, one per named pass.
//
// Every call goes through `callJson` (build-llm.ts), so every one of them checks
// `finishReason` before parsing, names its failure distinctly, and returns its token
// usage even when it fails. Nothing here writes to the database; the engine (build.ts)
// owns persistence, and this file owns what is asked and what shape comes back.
//
// TWO RULES THAT SHOW UP IN EVERY PROMPT BELOW, because they are the two things most
// likely to be lost as the prompts are edited:
//
//   1. THREE KINDS OF STATEMENT, KEPT APART (method.ts M_ANSWER). Corpus-grounded and
//      cited · reasoned openly and LABELLED as reasoning · never fabricated. §3's
//      domain-transfer answer is the second kind and must say so — it is the highest-
//      yield question we have precisely because no corpus can answer it, and dressing
//      it as retrieval would be the exact failure the never-claim rule exists to stop.
//
//   2. THE USER'S OWN KNOWLEDGE IS TESTIMONY, NOT A SOURCE. It arrives labelled (see
//      build-config.frameQuery) and every prompt is told it may be relied on, may be
//      quoted back to the user as theirs, and may never be cited as though it were a
//      retrieved document.
//
// AND ONE THAT IS SPECIFIC TO THIS SPRINT: PASS 2 IS DELIBERATELY ROUGH, AND LEX IS
// TOLD SO (§4). It exists to expose what the proposal IMPLIES so 25-B's research pass
// knows what to look for. Quality comes from revision, not from this pass — a model
// told to produce a finished draft in one shot produces a confident one, and confidence
// is the thing this stage least needs.
// ─────────────────────────────────────────────────────────────────────────────

import type { SearchResult } from './page1-config'
import { callJson, type LlmResult } from './build-llm'
import { M_GENERAL, M_ANSWER, M_DIAGNOSIS, M_GUIDING_POLICY, M_COHERENT_ACTIONS } from './method'
import {
  modelForPass, DOMAIN_TRANSFER_QUESTION, INSTRUMENTS, INSTRUMENT_DIMENSIONS,
  ALTERNATIVES_PER_FORK, type BuildPassKey,
} from './build-config'

const MAX_TOKENS = (key: BuildPassKey) =>
  parseInt(process.env[`LEX_BUILD_MAX_TOKENS_${key}`] ?? process.env.LEX_BUILD_MAX_TOKENS ?? '8000', 10)
const TIMEOUT_MS = parseInt(process.env.LEX_BUILD_TIMEOUT_MS ?? '90000', 10)

// ── Shared shapes ────────────────────────────────────────────────────────────

/** §4.1 — a decision point, with the alternatives Lex set aside and the case for each. */
export interface RawFork {
  forkKey: string
  fieldKey: string
  chosen: string
  alternatives: Array<{ alternative: string; caseForAlternative: string }>
}

/** §4.2 — what Lex is unsure about, per field, in a sentence. What the user reads first. */
export interface RawUncertainty {
  fieldKey: string
  sentence: string
}

const FORK_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      forkKey: { type: 'string' },
      fieldKey: { type: 'string' },
      chosen: { type: 'string' },
      alternatives: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            alternative: { type: 'string' },
            caseForAlternative: { type: 'string' },
          },
          required: ['alternative', 'caseForAlternative'],
        },
      },
    },
    required: ['forkKey', 'fieldKey', 'chosen', 'alternatives'],
  },
}

const UNCERTAINTY_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: { fieldKey: { type: 'string' }, sentence: { type: 'string' } },
    required: ['fieldKey', 'sentence'],
  },
}

const FORK_INSTRUCTION = [
  'RECORD YOUR FORKS. Wherever you had to CHOOSE — which cause is pivotal, which approach, which',
  `instrument — emit a \`forks\` entry naming what you chose and EXACTLY ${ALTERNATIVES_PER_FORK} alternatives you set`,
  'aside, each with the genuine case FOR it. Two strong alternatives beat three with filler, so do not',
  'pad; if you can only make one honest case, give one. The case for an alternative must be the case a',
  'competent advocate would make, not a straw man — these become the user\'s decisions later, and an',
  'alternative you have already argued against is not a decision you have offered them.',
  '`forkKey` is a stable slug for the decision point (e.g. "diagnosis:rootCause"). `fieldKey` is the',
  'field it bears on.',
].join('\n')

const UNCERTAINTY_INSTRUCTION = [
  'SAY WHAT YOU ARE UNSURE ABOUT, per field, in ONE sentence each, in `uncertainties`. This is what',
  'the user reads first, so it must be specific: "I have assumed the charge applies at the till rather',
  'than at the point of supply, and nothing I found settles it" is useful; "this may need more research"',
  'is not. If you are genuinely confident about a field, leave it out rather than manufacturing a doubt.',
].join('\n')

const ROUGHNESS = [
  'THIS IS A FIRST DRAFT AND IT IS MEANT TO BE ROUGH. Its job is to make the shape of the proposal',
  'visible so the user can argue with it and so a later research pass knows what to check. Do not',
  'polish. Do not hedge everything into mush either — commit to a reading, and record what you set',
  'aside. A vivid wrong answer the user can correct is worth more here than a cautious one they cannot.',
].join('\n')

const GROUNDING = [
  'THREE KINDS OF STATEMENT, AND THEY MUST BE KEPT APART:',
  '  · CORPUS-GROUNDED — only what a SOURCE below actually says. Cite it by its `id=` value.',
  '  · REASONED — your own knowledge and judgement. Allowed and expected. Say so in the text',
  '    ("reasoning here rather than citing…").',
  '  · NEVER — a fabricated citation, statistic, date or case name, or any claim about a document',
  '    not listed below. This is the only hard line.',
  'THE USER\'S OWN KNOWLEDGE, where it is given to you, is TESTIMONY. Rely on it, quote it back to',
  'them as theirs — and never present it as a retrieved source or attach a citation to it.',
].join('\n')

function sourcesBlock(results: SearchResult[]): string {
  if (!results.length) return '(the corpus search returned nothing — say so where it matters, and do not invent sources)'
  return results
    .map((r) => `[id=${r.id}] ${r.type} · ${r.title}\n    citation: ${r.citation}\n    date: ${r.date}\n    extract: ${r.snippet}`)
    .join('\n')
}

// ── Pass 1 — ORIENT (§3) ─────────────────────────────────────────────────────

export interface OrientOutput {
  /** What the corpus actually holds that bears on this. Grounded; cites source ids. */
  terrain: string
  /** §3 — the domain-transfer answer. REASONING, and it says so in its own text. */
  domainTransfer: string
  /** Feeds the `legalLandscape` structured field. */
  currentLaw: string
  whereItFails: string
  /** Source ids the terrain actually leans on, so the panel can show what was used. */
  citedSourceIds: string[]
}

const ORIENT_SCHEMA = {
  type: 'object',
  properties: {
    terrain: { type: 'string' },
    domainTransfer: { type: 'string' },
    currentLaw: { type: 'string' },
    whereItFails: { type: 'string' },
    citedSourceIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['terrain', 'domainTransfer', 'currentLaw', 'whereItFails', 'citedSourceIds'],
}

export async function runOrientPass(input: {
  promptBlock: string
  results: SearchResult[]
}): Promise<LlmResult<OrientOutput>> {
  const system = [
    M_GENERAL, '', M_ANSWER, '', GROUNDING, '', ROUGHNESS,
    '',
    'YOU ARE ORIENTING. Four outputs:',
    '  `terrain`        — what the record actually holds that bears on this, in 3–6 sentences. Name the',
    '                     one or two documents that matter MOST and why they matter to THIS problem;',
    '                     do not list. If the search returned nothing useful, say that plainly.',
    `  \`domainTransfer\` — answer this question: "${DOMAIN_TRANSFER_QUESTION}"`,
    '                     ⚠ THIS IS REASONING, NOT RETRIEVAL, AND YOUR ANSWER MUST SAY SO IN ITS OWN',
    '                     FIRST CLAUSE. No corpus can answer it, which is exactly why it is worth asking.',
    '                     Name two or three concrete analogues from other sectors or countries and what',
    '                     they actually built. Vagueness here wastes the highest-yield question we have.',
    '  `currentLaw`     — what law or rule governs this today, as best you can tell.',
    '  `whereItFails`   — where it falls short. If the honest answer is that you cannot tell from what',
    '                     you have, say that instead of guessing.',
    '  `citedSourceIds` — the `id=` values your `terrain` actually leans on. Copy them exactly. An id',
    '                     not in the SOURCES list will be dropped, so do not invent one.',
  ].join('\n')

  return callJson<OrientOutput>({
    model: modelForPass('ORIENT'),
    system,
    user: `${input.promptBlock}\n\nSOURCES — the only material you may cite:\n${sourcesBlock(input.results)}`,
    schema: ORIENT_SCHEMA,
    maxOutputTokens: MAX_TOKENS('ORIENT'),
    timeoutMs: TIMEOUT_MS,
    temperature: 0.5,
    label: 'build-orient',
  })
}

// ── Pass 2a — DIAGNOSIS (§4) ─────────────────────────────────────────────────

export interface DiagnosisOutput {
  title: string
  keywords: string[]
  challenge: string
  whoAffectedImpactCost: { affectedGroups: string; impact: string; cost: string; evidence: string }
  causes: Array<{ cause: string; whyPersisted: string; classification: 'MATERIAL' | 'CONTRIBUTORY' }>
  rootCause: string
  pivotalObstacle: string
  summaryDiagnosis: string
  forks: RawFork[]
  uncertainties: RawUncertainty[]
}

const DIAGNOSIS_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' } },
    challenge: { type: 'string' },
    whoAffectedImpactCost: {
      type: 'object',
      properties: {
        affectedGroups: { type: 'string' }, impact: { type: 'string' },
        cost: { type: 'string' }, evidence: { type: 'string' },
      },
      required: ['affectedGroups', 'impact', 'cost', 'evidence'],
    },
    causes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          cause: { type: 'string' }, whyPersisted: { type: 'string' },
          classification: { type: 'string', enum: ['MATERIAL', 'CONTRIBUTORY'] },
        },
        required: ['cause', 'whyPersisted', 'classification'],
      },
    },
    rootCause: { type: 'string' },
    pivotalObstacle: { type: 'string' },
    summaryDiagnosis: { type: 'string' },
    forks: FORK_SCHEMA,
    uncertainties: UNCERTAINTY_SCHEMA,
  },
  required: ['title', 'keywords', 'challenge', 'whoAffectedImpactCost', 'causes', 'rootCause',
    'pivotalObstacle', 'summaryDiagnosis', 'forks', 'uncertainties'],
}

export async function runDiagnosisPass(input: {
  promptBlock: string
  orientation: string
  results: SearchResult[]
}): Promise<LlmResult<DiagnosisOutput>> {
  const system = [
    M_GENERAL, '', M_DIAGNOSIS, '', GROUNDING, '', ROUGHNESS, '', FORK_INSTRUCTION, '', UNCERTAINTY_INSTRUCTION,
    '',
    'DRAFT THE DIAGNOSIS. Fields:',
    '  `title`      — a short working title for the idea, under 80 characters, in the user\'s register.',
    '  `keywords`   — 4–8 search terms for this idea. Terms of art where they exist.',
    '  `challenge`  — THE PROBLEM in one sentence: what is wrong, for whom, why it matters. NO remedy.',
    '  `whoAffectedImpactCost` — who is MOST ACUTELY affected (specific groups, not "everyone"), the',
    '                 impact on them, the cost, and what evidence there is. Say "not established" where',
    '                 you do not know; a made-up figure here poisons the whole cost case later.',
    '  `causes`     — 3–6 causes, each with WHY IT HAS PERSISTED, each classified MATERIAL (remove it',
    '                 and the problem largely goes) or CONTRIBUTORY. A cause is a causal claim, not a',
    '                 topic and not a document title.',
    '  `rootCause`  — which cause is the main driver. Copy its text verbatim from `causes`.',
    '  `pivotalObstacle` — why a solution has NOT stuck. DISTINCT from the root cause: often',
    '                 enforcement failure, a coordination gap, a cost nobody will bear, or a party who',
    '                 benefits from the status quo. Ask who benefits.',
    '  `summaryDiagnosis` — the diagnosis in a short paragraph, naming both.',
  ].join('\n')

  return callJson<DiagnosisOutput>({
    model: modelForPass('DIAGNOSIS'),
    system,
    user: [
      input.promptBlock,
      `\nWHAT PASS 1 FOUND (your own orientation — reuse it, do not re-derive it):\n${input.orientation}`,
      `\nSOURCES — the only material you may cite:\n${sourcesBlock(input.results)}`,
    ].join('\n'),
    schema: DIAGNOSIS_SCHEMA,
    maxOutputTokens: MAX_TOKENS('DIAGNOSIS'),
    timeoutMs: TIMEOUT_MS,
    temperature: 0.5,
    label: 'build-diagnosis',
  })
}

// ── Pass 2b — APPROACH (§4, including the instrument question) ───────────────

export interface ApproachOutput {
  policyOptions: Array<{ approach: string; mechanismTypes: string[]; caseFor: string; caseAgainst: string }>
  chosenApproach: string
  /** §4 — the instrument Lex has ASSUMED, named rather than left implicit. */
  instrument: {
    chosen: string
    scope: string
    devolution: string
    alternatives: Array<{ alternative: string; caseForAlternative: string }>
  }
  leverage: string
  whatItRulesOut: string
  summaryGuidingPolicy: string
  forks: RawFork[]
  uncertainties: RawUncertainty[]
}

const APPROACH_SCHEMA = {
  type: 'object',
  properties: {
    policyOptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          approach: { type: 'string' },
          mechanismTypes: { type: 'array', items: { type: 'string' } },
          caseFor: { type: 'string' },
          caseAgainst: { type: 'string' },
        },
        required: ['approach', 'mechanismTypes', 'caseFor', 'caseAgainst'],
      },
    },
    chosenApproach: { type: 'string' },
    instrument: {
      type: 'object',
      properties: {
        chosen: { type: 'string' },
        scope: { type: 'string' },
        devolution: { type: 'string' },
        alternatives: {
          type: 'array',
          items: {
            type: 'object',
            properties: { alternative: { type: 'string' }, caseForAlternative: { type: 'string' } },
            required: ['alternative', 'caseForAlternative'],
          },
        },
      },
      required: ['chosen', 'scope', 'devolution', 'alternatives'],
    },
    leverage: { type: 'string' },
    whatItRulesOut: { type: 'string' },
    summaryGuidingPolicy: { type: 'string' },
    forks: FORK_SCHEMA,
    uncertainties: UNCERTAINTY_SCHEMA,
  },
  required: ['policyOptions', 'chosenApproach', 'instrument', 'leverage', 'whatItRulesOut',
    'summaryGuidingPolicy', 'forks', 'uncertainties'],
}

export async function runApproachPass(input: {
  promptBlock: string
  orientation: string
  diagnosis: string
  ruledOut: string
  results: SearchResult[]
}): Promise<LlmResult<ApproachOutput>> {
  const system = [
    M_GENERAL, '', M_GUIDING_POLICY, '', GROUNDING, '', ROUGHNESS, '', FORK_INSTRUCTION, '', UNCERTAINTY_INSTRUCTION,
    '',
    'DRAFT THE APPROACH. Fields:',
    '  `policyOptions` — 3–4 candidate approaches to the PIVOTAL OBSTACLE, each with a genuine case FOR',
    '                    and AGAINST. An approach is a way at the obstacle: not a goal, not an action',
    '                    list. `mechanismTypes` from: incentives · rules · transparency · market-design',
    '                    · institutional.',
    '  `chosenApproach` — the one you would commit to. Copy its `approach` text verbatim.',
    '  `instrument`    — ⚠ THE QUESTION THIS SPRINT ADDS, AND IT IS NOT OPTIONAL. What KIND of tool is',
    `                    this? One of: ${INSTRUMENTS.join(' · ')}. ${INSTRUMENT_DIMENSIONS}`,
    '                    An idea that needs a funding decision and gets drafted as a Bill is wrong in a',
    '                    way no amount of good drafting fixes — so NAME the instrument you have assumed',
    `                    and give ${ALTERNATIVES_PER_FORK} alternative instruments with the case for each.`,
    '                    `scope`: "local" or "national". `devolution`: "reserved", "devolved", or say',
    '                    plainly that you cannot tell.',
    '                    ⚠ PUT THE INSTRUMENT HERE AND NOWHERE ELSE. Do NOT also add a fork about',
    '                    the instrument to `forks` — the platform records this field AS a fork',
    '                    under its own key. Measured on 2026-08-17: every one of six builds emitted',
    '                    a second, differently-named instrument fork alongside it, so the same',
    '                    decision reached the user twice under two names.',
    '  `leverage`      — why this approach hits the pivotal obstacle SPECIFICALLY: the asymmetry or',
    '                    pivot point it exploits.',
    '  `whatItRulesOut` — what choosing this puts off the table, and what is given up by not doing it.',
    '                    Ground it in the options you set aside; a policy that rules nothing out is fluff.',
    '  `summaryGuidingPolicy` — the approach, its leverage, and what it rules out, in a short paragraph.',
  ].join('\n')

  return callJson<ApproachOutput>({
    model: modelForPass('APPROACH'),
    system,
    user: [
      input.promptBlock,
      `\nYOUR ORIENTATION:\n${input.orientation}`,
      `\nYOUR DIAGNOSIS:\n${input.diagnosis}`,
      // ⚠ Repeated here even though it is in the framing block for arm B, because arm A
      // does not carry it — and proposing something the user has already ruled out is the
      // fastest way to lose their confidence in everything else on the page.
      input.ruledOut
        ? `\n⚠ THE USER HAS ALREADY RULED THESE OUT. Do not propose them as the chosen approach:\n${input.ruledOut}`
        : '',
      `\nSOURCES — the only material you may cite:\n${sourcesBlock(input.results)}`,
    ].filter(Boolean).join('\n'),
    schema: APPROACH_SCHEMA,
    maxOutputTokens: MAX_TOKENS('APPROACH'),
    timeoutMs: TIMEOUT_MS,
    temperature: 0.5,
    label: 'build-approach',
  })
}

// ── Pass 2c — ACTIONS (§4) ───────────────────────────────────────────────────

export interface ActionsOutput {
  actions: Array<{ practicalStep: string; whoImplements: string; mechanismType: string }>
  summaryCoherentActions: string
  forks: RawFork[]
  uncertainties: RawUncertainty[]
}

const ACTIONS_SCHEMA = {
  type: 'object',
  properties: {
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          practicalStep: { type: 'string' },
          whoImplements: { type: 'string' },
          mechanismType: { type: 'string' },
        },
        required: ['practicalStep', 'whoImplements', 'mechanismType'],
      },
    },
    summaryCoherentActions: { type: 'string' },
    forks: FORK_SCHEMA,
    uncertainties: UNCERTAINTY_SCHEMA,
  },
  required: ['actions', 'summaryCoherentActions', 'forks', 'uncertainties'],
}

export async function runActionsPass(input: {
  promptBlock: string
  diagnosis: string
  approach: string
  instrument: string
}): Promise<LlmResult<ActionsOutput>> {
  const system = [
    M_GENERAL, '', M_COHERENT_ACTIONS, '', GROUNDING, '', ROUGHNESS, '', FORK_INSTRUCTION, '', UNCERTAINTY_INSTRUCTION,
    '',
    'DRAFT THE ACTIONS. Fields:',
    '  `actions` — 3–6 COORDINATED steps that execute the approach through the instrument named below.',
    '              Each names WHO IMPLEMENTS IT — a department, a regulator, a named body. "The',
    '              government" is not an implementer. Each carries a `mechanismType` from: incentives ·',
    '              rules · transparency · market-design · institutional.',
    '              ⚠ THE STEPS MUST FIT THE INSTRUMENT. If the instrument is funding, do not draft',
    '              clauses; if it is a regulator rule, do not draft a Bill. This is the single mistake',
    '              this sprint exists to make visible.',
    '              Do NOT invent costs. Costing is the user\'s work with Lex later, and a fabricated',
    '              range here would be carried into a cost-benefit case as though it had a source.',
    '  `summaryCoherentActions` — the plan in a short paragraph: what happens, in what order, and why',
    '              that order.',
  ].join('\n')

  return callJson<ActionsOutput>({
    model: modelForPass('ACTIONS'),
    system,
    user: [
      input.promptBlock,
      `\nYOUR DIAGNOSIS:\n${input.diagnosis}`,
      `\nYOUR CHOSEN APPROACH:\n${input.approach}`,
      `\nTHE INSTRUMENT YOU ASSUMED: ${input.instrument}`,
    ].join('\n'),
    schema: ACTIONS_SCHEMA,
    maxOutputTokens: MAX_TOKENS('ACTIONS'),
    timeoutMs: TIMEOUT_MS,
    temperature: 0.5,
    label: 'build-actions',
  })
}

// ── §5 — "what I did and what I'm unsure about" ──────────────────────────────

export interface BuildSummary { message: string }

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: { message: { type: 'string' } },
  required: ['message'],
}

export async function writeBuildSummary(input: {
  passesCompleted: string[]
  uncertainties: RawUncertainty[]
  forkCount: number
  sourcesUsed: number
  searchFailed: boolean
}): Promise<LlmResult<BuildSummary>> {
  const system = [
    M_GENERAL,
    '',
    'You have just drafted a first version of someone\'s proposal from four answers. Write the short',
    'message they read FIRST, before they look at any of it. Three or four sentences.',
    '  · What you did, plainly and without listing every field.',
    '  · What you are least sure about — the specific things, not "this needs more research".',
    '  · Where the corpus was silent or the search failed, SAY SO. Silence you did not mention reads',
    '    as absence of a problem.',
    'Do not congratulate them, do not congratulate yourself, and do not tell them it is a good idea.',
    'No headings, no bullets, no sign-off. This message is followed by our own note about their',
    'ownership of the text, so do not write one of your own.',
  ].join('\n')

  return callJson<BuildSummary>({
    model: modelForPass('ACTIONS'),
    system,
    user: [
      `PASSES THAT COMPLETED: ${input.passesCompleted.join(', ') || '(none)'}`,
      `SOURCES THE CORPUS RETURNED: ${input.sourcesUsed}${input.searchFailed ? ' (THE SEARCH FAILED — say so)' : ''}`,
      `DECISIONS YOU RECORDED AN ALTERNATIVE FOR: ${input.forkCount}`,
      '',
      'WHAT YOU SAID YOU WERE UNSURE ABOUT:',
      ...(input.uncertainties.length
        ? input.uncertainties.map((u) => `- ${u.fieldKey}: ${u.sentence}`)
        : ['- (nothing recorded)']),
    ].join('\n'),
    schema: SUMMARY_SCHEMA,
    maxOutputTokens: 1500,
    timeoutMs: TIMEOUT_MS,
    temperature: 0.4,
    label: 'build-summary',
  })
}
