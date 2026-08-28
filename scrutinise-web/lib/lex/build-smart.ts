// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-F §2 — THE SMART PASS.
//
// Charlie's design, and the one pass in the build that asks a question nothing else asks:
// having drafted, researched and revised, IS THIS ANY GOOD, and is there something a
// competent outsider would have found that we did not?
//
// ⚠ THE PREMISE, FROM THE FIRST REAL BUILD. Charlie's verdict on it was "weaker than a
// single ChatGPT query". That verdict was fair on what he was SHOWN and unfair on what was
// built — but the part that is simply true is this: a user who can get a better answer by
// typing their question into their own chat window has no reason to use this. §25 says so
// in as many words, and this pass is the direct defence against it.
//
// FIVE STEPS, and the ordering is the design:
//
//   1. WHAT GOES OUT IS THE WHOLE OF PAGE ONE (§2a). The problem in the user's words,
//      their first-hand knowledge, their goal and their ruled-outs — VERBATIM AND
//      UNSUMMARISED. Not a ten-word mashup: the mashup is what the corpus query was, and
//      it is what this sprint exists to stop.
//
//   2. THE OTHER MODELS ARE ASKED FOR A RUMELT-SHAPED ANSWER (§2b, as answer sources).
//      Diagnosis, guiding policy, coherent actions — the same shape as ours, so the two
//      are directly comparable rather than needing a translation step that would smuggle
//      in a judgement.
//
//   3. EVERY ENTITY THEY NAME BECOMES A CORPUS QUERY (§2b, as query generators). ⚠ THIS
//      IS THE HALF THAT MATTERS MOST. A user writes "nobody is accountable"; the field
//      says Carltona, Osmotherly, Accounting Officer, Senior Responsible Owner. No amount
//      of extracting terms from the user's own prose produces those words, because they
//      are not in it. **The models supply the vocabulary; the corpus supplies the
//      authority.** What the corpus confirms is CITED; what it cannot confirm is KEPT AND
//      LABELLED UNVERIFIED — never asserted, never dropped.
//
//   4. THE COVERAGE CHECK (§2c). Every substantive point in a model's answer is either
//      already in our kernel or becomes an issue saying what we missed.
//
//   5. THE CRITIQUE, WITH A REWRITE MANDATE (§2d). Is this a good kernel by Rumelt's
//      standards — and where it is not, FIX IT and record what changed, in the same shape
//      as the revision pass's "where the evidence changed my mind".
//
// ⚠ IS THIS LEX OR SEARCH? Lex. §25.8: Lex owns the questions and their timing, Search
// owns retrieval quality, the intent is the contract. The one part that touches Search is
// step 3's recycled queries, and they go through `runSearch` like every other caller —
// with no new intent and no change to routing. What Search needs to know is only that the
// build now issues a burst of short entity queries after the research pass, which is
// recorded in docs/LEX_25F_REPORT.md for them.
//
// ⚠ THE NEVER-CLAIM RULE IS NOT RELAXED ANYWHERE HERE. A term another model produced is
// not evidence that the term exists. It is a HYPOTHESIS ABOUT WHAT TO LOOK FOR, and it is
// only ever recorded as a finding once a retrieved document carries it.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import type { SearchResult } from './page1-config'
import { runSearch } from './search-gateway'
import { callJson, llmOk, llmFailed, type LlmUsage } from './build-llm'
import { generateDeepeningFindings } from './deepening-client'
import { providerFor, type Provider } from './model-registry'
import { hasKeyFor, hasStructuredClientFor } from './model-call'
import { M_GENERAL, M_DIAGNOSIS, M_GUIDING_POLICY, M_COHERENT_ACTIONS } from './method'
import { supersedeOlderProposals } from './evidence-layer'
import type { ElicitationContext } from './elicitation'
import { testimonyBlock, TESTIMONY_INSTRUCTION } from './testimony'
import { queryDefects } from './build-query'

const TIMEOUT_MS = parseInt(process.env.LEX_BUILD_TIMEOUT_MS ?? '90000', 10)

/** The pass key every row this pass writes carries. */
export const SMART_PASS_KEY = 'SMART'

/** The gap row that holds the unverified vocabulary. Its own key, so it renders apart. */
export const SMART_VOCABULARY_PASS_KEY = 'pass:SMART_VOCABULARY'

// ── §2e — model selection ────────────────────────────────────────────────────
//
// ⚠ THE ADVERSARIAL PASS RAN ON `gemini-2.5-flash` — the cheapest model we have, on the
// pass where reasoning strength matters most, producing 407 output tokens for six issues.
// §2e's instruction is to choose per pass on the job it is doing. That is done in
// build-config.ts for the passes; what is decided HERE is the panel of OUTSIDE models,
// which is a different question: the point of the panel is DIVERGENCE, so it is picked for
// vendor spread rather than for strength.
//
// ⚠ A MODEL WITH NO KEY ON THIS DEPLOYMENT IS SKIPPED AND SAID SO. A panel that silently
// shrank from three to one would make "the other models did not find anything we missed"
// a claim about our configuration wearing the clothes of a claim about the proposal.

// ⚠ TWO VENDORS, NOT THREE, AND `grok-4.6` IS DELIBERATELY ABSENT.
//
// It was in the first version of this list, and `hasKeyFor('xai')` is TRUE on this
// deployment — `GROK_API_KEY` is set. But `callModelJson` returns `unroutable` for every
// xAI model, because the structured-output client has never been written. So the panel
// would have carried a third model that fails on every single build, printing "grok-4.6
// did not answer" on every screen for ever. A warning that always fires is a warning
// nobody reads, and it would make a real panel failure indistinguishable from the standing
// one. `canCallStructured` is the guard; this list is what it guards.
//
// ▶ THE MOMENT AN xAI STRUCTURED CLIENT EXISTS, adding `grok-4.6` here is the whole change.
// A third vendor is worth having: the four-model comparison that produced §7's perspectives
// found substantially different material from each.
const DEFAULT_PANEL = ['gemini-2.5-pro', 'claude-sonnet-5']

export function smartPanelModels(): { models: string[]; skipped: Array<{ model: string; why: string }> } {
  const raw = process.env.LEX_BUILD_SMART_MODELS?.trim()
  const wanted = raw ? raw.split(',').map((m) => m.trim()).filter(Boolean) : DEFAULT_PANEL
  const models: string[] = []
  const skipped: Array<{ model: string; why: string }> = []
  for (const m of wanted) {
    const provider = providerFor(m)
    if (!provider) { skipped.push({ model: m, why: 'names no known provider' }); continue }
    if (!hasKeyFor(provider)) { skipped.push({ model: m, why: `no ${provider} key on this deployment` }); continue }
    // ⚠ A KEY IS NOT A CLIENT. See the note above the list.
    if (!hasStructuredClientFor(provider)) {
      skipped.push({ model: m, why: `this codebase has no structured-output client for ${provider}` })
      continue
    }
    models.push(m)
  }
  return { models, skipped }
}

/** The model that does the critique and the rewrite. Never the cheapest one (§2e). */
export function smartCritiqueModel(): string {
  return process.env.LEX_BUILD_MODEL_SMART?.trim() || 'gemini-2.5-pro'
}

// ── §2a — what goes out ──────────────────────────────────────────────────────

/**
 * The whole of page one, verbatim.
 *
 * ⚠ THE CAP IS GENEROUS ON PURPOSE AND IT IS STATED WHEN IT BITES. §2a's rule is
 * "verbatim and unsummarised"; a silent truncation at 2,000 characters would be a
 * summary chosen by an arithmetic accident. Charlie's own account is 2,934 characters,
 * which is what the default is sized against.
 */
export const PAGE_ONE_CAP = parseInt(process.env.LEX_SMART_PAGE_ONE_CAP ?? '12000', 10)

export function pageOnePayload(ctx: ElicitationContext): { text: string; truncated: boolean } {
  const full = testimonyBlock(ctx, PAGE_ONE_CAP)
  return { text: full, truncated: full.length >= PAGE_ONE_CAP }
}

const RUMELT_SHAPE = [
  'ANSWER IN RUMELT\'S SHAPE, because that is the shape the platform holds itself to and it is what',
  'makes your answer comparable to ours rather than something that has to be translated first:',
  '  `diagnosis`      — what is ACTUALLY going wrong. Name the pivotal obstacle: not the root cause,',
  '                     but the thing that has stopped anyone fixing this already. Ask who benefits.',
  '  `guidingPolicy`  — the APPROACH to that obstacle. Not a goal, not an action list. Say what it',
  '                     RULES OUT; a policy that rules nothing out is fluff.',
  '  `coherentActions`— 3–6 coordinated steps that execute the approach, each naming who does it.',
  '  `instrument`     — what KIND of tool this is: primary legislation, secondary legislation, a',
  '                     regulator rule, funding, an organisational change, a change to a body\'s remit.',
  '                     If the obvious answer (a new Act) is wrong, say so and say what is right.',
].join('\n')

const ENTITY_INSTRUCTION = [
  '⚠ AND NAME THE THINGS. This is the single most valuable thing you can contribute, and it is worth',
  'more than the answer itself: list in `entities` every STATUTE, DOCTRINE, REGIME, CASE, OFFICE,',
  'CONVENTION, INSTITUTION or NAMED MECHANISM that a specialist in this field would bring up, whether or',
  'not you used it above.',
  '',
  'The person who wrote the account below does not know these words. They wrote "nobody is accountable";',
  'the field says "Accounting Officer", "Carltona", "the Osmotherly Rules", "Senior Responsible Owner".',
  'THOSE are what we want. Give the name as it is actually used — "the Carltona principle", not "a',
  'doctrine about ministerial delegation".',
  '',
  'For each: `name` (as used), `kind` (statute | doctrine | regime | case | office | convention |',
  'institution | mechanism), and `whyItBears` — one sentence on why it bears on THIS problem.',
  '',
  '⚠ DO NOT INVENT ONE. If you are not confident a thing exists under that name, leave it out. Every',
  'name you give will be put to a corpus of UK primary and secondary legislation, case law, committee',
  'reports, debates and official statistics, and anything the corpus cannot confirm will be shown to the',
  'user labelled UNVERIFIED — so a made-up name costs them attention rather than passing unnoticed.',
].join('\n')

export interface PanelAnswer {
  model: string
  diagnosis: string
  guidingPolicy: string
  coherentActions: string[]
  instrument: string
  entities: Array<{ name: string; kind: string; whyItBears: string }>
  /** The points this answer makes that the coverage check will test against our kernel. */
  substantivePoints: string[]
}

const PANEL_SCHEMA = {
  type: 'object',
  properties: {
    diagnosis: { type: 'string' },
    guidingPolicy: { type: 'string' },
    coherentActions: { type: 'array', items: { type: 'string' } },
    instrument: { type: 'string' },
    entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          kind: { type: 'string' },
          whyItBears: { type: 'string' },
        },
        required: ['name', 'kind', 'whyItBears'],
      },
    },
    substantivePoints: { type: 'array', items: { type: 'string' } },
  },
  required: ['diagnosis', 'guidingPolicy', 'coherentActions', 'instrument', 'entities', 'substantivePoints'],
}

/**
 * Ask ONE outside model for a Rumelt-shaped answer to the user's own account.
 *
 * ⚠ IT IS GIVEN THE USER'S WORDS AND NOTHING OF OURS. That is the whole point: an
 * independent answer is only independent if it has not been anchored on our diagnosis. The
 * comparison happens afterwards, in the coverage check, where both are on the table.
 */
export async function askPanelModel(input: {
  model: string
  pageOne: string
  onUsage: (u: LlmUsage) => void
}): Promise<PanelAnswer | null> {
  const system = [
    'You are a policy adviser with a specialist\'s knowledge of UK government, law and administration.',
    'Someone has described a problem they want fixed, in their own words. Read it and answer.',
    '',
    RUMELT_SHAPE,
    '',
    ENTITY_INSTRUCTION,
    '',
    '`substantivePoints` — 5 to 10 sentences, each a POINT you are making that someone could agree or',
    'disagree with. Not headings and not a summary of your answer: the claims that would be lost if your',
    'answer were reduced to its shape. These are compared against what another analysis of the same',
    'problem produced, so a vague one wastes the comparison.',
    '',
    '⚠ NO PREAMBLE AND NO FLATTERY. Do not tell them it is a good idea, do not congratulate them, and do',
    'not hedge every sentence. If the honest answer is that this is the wrong problem, or that the thing',
    'they want already exists, say that first.',
  ].join('\n')

  const result = await callJson<Omit<PanelAnswer, 'model'>>({
    model: input.model,
    system,
    user: [
      TESTIMONY_INSTRUCTION,
      '',
      '═══ WHAT THEY WROTE, VERBATIM ═══',
      input.pageOne,
    ].join('\n'),
    schema: PANEL_SCHEMA,
    maxOutputTokens: parseInt(process.env.LEX_SMART_PANEL_TOKENS ?? '6000', 10),
    timeoutMs: TIMEOUT_MS,
    temperature: 0.4,
    label: `smart-panel:${input.model}`,
  })
  input.onUsage(result.usage)

  if (llmFailed(result)) {
    // ⚠ NAMED, NOT SWALLOWED. A panel of three that answered twice must not read like a
    // panel of two — the coverage check's conclusions are weaker by exactly one model.
    console.warn('[25f:smart] a panel model did not answer', {
      model: input.model, reason: result.reason, detail: result.detail?.slice(0, 300),
    })
    return null
  }
  return normalisePanelAnswer(input.model, result.value)
}

/**
 * ⚠⚠ THE SCHEMA IS A REQUEST, NOT A GUARANTEE — AND THE FIRST LIVE RUN PROVED IT BY
 * TAKING THE PASS DOWN.
 *
 * `PANEL_SCHEMA` declares `coherentActions` as an array of strings, and one of the two
 * panel models returned it as something else. The pass threw
 * `(a.coherentActions ?? []).join is not a function`, and because a thrown pass is a FAILED
 * pass, `SMART`, `KERNEL_CHECK`, `LOGIC_CHECK` and `ADVERSARIAL` were all lost — four of ten
 * passes, on one field of one model's reply.
 *
 * ⚠ `?? []` IS NOT A GUARD AND IT IS WORTH SAYING WHY, because it LOOKS like one. It
 * defends against `null` and `undefined` and against nothing else: a string, a number or an
 * object all pass straight through it into `.join`, `.map` or `for…of`. Every structured
 * call in this codebase that reads an array off a model reply has the same shape.
 *
 * So the reply is normalised ONCE, at the boundary where it arrives, rather than defended
 * against at each of the six places that read it. A string where a list was asked for
 * becomes a one-item list — the content is not lost — and anything else becomes empty and
 * is logged, because silently inventing a list is how a pass reports material nobody wrote.
 */
export function normalisePanelAnswer(model: string, raw: Omit<PanelAnswer, 'model'>): PanelAnswer {
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v))

  const list = (v: unknown, field: string): string[] => {
    if (Array.isArray(v)) return v.map(str).filter(Boolean)
    if (typeof v === 'string' && v.trim()) {
      console.warn('[25f:smart] a panel model returned a STRING where the schema asked for a list', {
        model, field, length: v.length,
      })
      // Split on the shapes a model uses when it ignores an array schema, and keep the
      // whole thing as one item when none of them is present.
      const parts = v.split(/\n\s*(?:[-*•]|\d+[.)])\s+|\n{2,}/).map((s) => s.trim()).filter(Boolean)
      return parts.length > 1 ? parts : [v.trim()]
    }
    if (v != null) {
      console.warn('[25f:smart] a panel model returned an unusable shape where the schema asked for a list', {
        model, field, type: typeof v,
      })
    }
    return []
  }

  const entities = Array.isArray(raw?.entities)
    ? raw.entities
        .filter((e) => e && typeof e === 'object')
        .map((e) => ({
          name: str((e as { name?: unknown }).name),
          kind: str((e as { kind?: unknown }).kind) || 'unstated',
          whyItBears: str((e as { whyItBears?: unknown }).whyItBears),
        }))
        .filter((e) => e.name)
    : []
  if (!Array.isArray(raw?.entities) && raw?.entities != null) {
    console.warn('[25f:smart] a panel model returned entities in an unusable shape', {
      model, type: typeof raw.entities,
    })
  }

  return {
    model,
    diagnosis: str(raw?.diagnosis),
    guidingPolicy: str(raw?.guidingPolicy),
    instrument: str(raw?.instrument),
    coherentActions: list(raw?.coherentActions, 'coherentActions'),
    substantivePoints: list(raw?.substantivePoints, 'substantivePoints'),
    entities,
  }
}

// ── §2b — the entities become corpus queries ─────────────────────────────────

export interface VocabularyResult {
  /** Terms the corpus confirmed, with the finding and citation that confirmed them. */
  confirmed: Array<{ name: string; kind: string; whyItBears: string; namedBy: string[] }>
  /** Terms nothing retrieved could confirm. Kept, labelled, never asserted. */
  unverified: Array<{ name: string; kind: string; whyItBears: string; namedBy: string[] }>
  /** Every result the entity queries returned, deduplicated. */
  results: SearchResult[]
  /** How many entities were dropped by the cap — never silent (CLAUDE.md §17). */
  droppedByCap: number
  searchesIssued: number
  searchesBroke: number
}

/**
 * ⚠ 18, AND THE NUMBER IS MEASURED RATHER THAN CHOSEN.
 *
 * It was 12. On the first real run of this pass the two panel models named **20** distinct
 * terms of art between them, so a cap of 12 dropped 8 untested — and the eight included
 * *Managing Public Money*, *Ministerial Responsibility* and *National Audit Office*, which
 * are not filler. The cap exists to stop this pass running away with the build's time
 * budget, not to throw away the thing the pass is for.
 *
 * ⚠ It is still a cap and it still reports what it drops. Raising it further should be
 * done against a measured pass duration, not on the same reasoning twice.
 */
const ENTITY_CAP = parseInt(process.env.LEX_SMART_ENTITY_CAP ?? '18', 10)
const ENTITY_LIMIT = parseInt(process.env.LEX_SMART_ENTITY_LIMIT ?? '6', 10)

/** Does anything retrieved actually mention this term? A deterministic test, not a model call. */
function corpusMentions(name: string, results: SearchResult[]): boolean {
  const needle = name.toLowerCase().replace(/\s+/g, ' ').trim()
  if (needle.length < 4) return false
  return results.some((r) => {
    const hay = `${r.title ?? ''} ${r.citation ?? ''} ${r.snippet ?? ''}`.toLowerCase()
    return hay.includes(needle)
  })
}

/**
 * Put every named entity to the corpus.
 *
 * ⚠ ONE SEARCH PER ENTITY, CAPPED, AND THE CAP IS REPORTED. Each entity is its own query
 * because that is what makes the test meaningful: a query carrying twelve terms of art at
 * once retrieves documents about the average of them and confirms none of them
 * individually.
 */
export async function testVocabulary(input: {
  answers: PanelAnswer[]
  ideaContext: string
  onActivity: (line: string) => Promise<void>
}): Promise<VocabularyResult> {
  // Merge the panel's entities: the same term named by two models is one query, and WHO
  // named it is kept because a term two independent models reach for is a stronger signal
  // than one that only appeared once.
  const merged = new Map<string, { name: string; kind: string; whyItBears: string; namedBy: string[] }>()
  for (const a of input.answers) {
    for (const e of a.entities ?? []) {
      const name = String(e?.name ?? '').trim()
      if (!name || name.length < 3) continue
      const key = name.toLowerCase()
      const existing = merged.get(key)
      if (existing) {
        if (!existing.namedBy.includes(a.model)) existing.namedBy.push(a.model)
        continue
      }
      merged.set(key, {
        name,
        kind: String(e.kind ?? '').trim() || 'unstated',
        whyItBears: String(e.whyItBears ?? '').trim(),
        namedBy: [a.model],
      })
    }
  }

  // Order by how many models named it, then by name, so the cap keeps the strongest signals.
  const ordered = [...merged.values()].sort(
    (a, b) => b.namedBy.length - a.namedBy.length || a.name.localeCompare(b.name),
  )
  const tested = ordered.slice(0, ENTITY_CAP)
  const droppedByCap = ordered.length - tested.length
  if (droppedByCap > 0) {
    // ⚠ NEVER A SILENT CAP. §17: a bounded sweep that does not say what it dropped reads
    // as "we covered everything".
    console.warn('[25f:smart] entity cap dropped terms without testing them', {
      cap: ENTITY_CAP, named: ordered.length, dropped: droppedByCap,
      names: ordered.slice(ENTITY_CAP).map((e) => e.name),
    })
  }

  const seen = new Set<string>()
  const results: SearchResult[] = []
  let searchesIssued = 0
  let searchesBroke = 0

  for (const e of tested) {
    await input.onActivity(`Putting "${e.name}" to the corpus`)
    // The entity is the query. The `kind` word is added because it disambiguates a name
    // that is also an ordinary word ("Carltona" needs no help; "candour" does).
    const terms = [e.name, e.kind !== 'unstated' ? e.kind : ''].filter(Boolean)
    const defects = queryDefects(terms)
    if (defects.some((d) => d.kind === 'empty')) continue
    try {
      const out = await runSearch({
        keywords: terms,
        intent: 'LEGAL_LANDSCAPE',
        ideaContext: input.ideaContext.slice(0, 1200),
        limit: ENTITY_LIMIT,
      })
      searchesIssued++
      if (out.failed) { searchesBroke++; continue }
      for (const r of out.results) {
        if (seen.has(r.id)) continue
        seen.add(r.id)
        results.push(r)
      }
    } catch (err) {
      searchesBroke++
      console.warn('[25f:smart] an entity search threw', {
        entity: e.name, error: err instanceof Error ? err.message : err,
      })
    }
  }

  // ⚠ A TERM IS CONFIRMED BY A RETRIEVED DOCUMENT MENTIONING IT, AND BY NOTHING ELSE.
  // Not by a model saying it is real, and not by a search "returning results" — a search
  // for "Osmotherly" that returns six documents about civil-service pay has confirmed
  // nothing, and treating a non-empty result set as confirmation is the fail-open shape
  // this codebase keeps removing.
  const confirmed = tested.filter((e) => corpusMentions(e.name, results))
  const unverified = tested.filter((e) => !corpusMentions(e.name, results))

  console.log('[25f:smart] vocabulary tested', {
    named: ordered.length, tested: tested.length, droppedByCap,
    confirmed: confirmed.length, unverified: unverified.length,
    searchesIssued, searchesBroke, results: results.length,
  })

  return { confirmed, unverified, results, droppedByCap, searchesIssued, searchesBroke }
}

// ── §2c — the coverage check ─────────────────────────────────────────────────

export interface CoverageResult {
  /** One issue per substantive point our kernel does not address. */
  missed: Array<{ point: string; namedBy: string; whyItMatters: string }>
  /** Points our kernel does address — counted, so "we covered it" is a measured claim. */
  coveredCount: number
}

const COVERAGE_SCHEMA = {
  type: 'object',
  properties: {
    covered: { type: 'array', items: { type: 'string' } },
    missed: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          point: { type: 'string' },
          namedBy: { type: 'string' },
          whyItMatters: { type: 'string' },
        },
        required: ['point', 'namedBy', 'whyItMatters'],
      },
    },
  },
  required: ['covered', 'missed'],
}

/**
 * §2c — every substantive point in a model's answer is either present in our kernel, or it
 * becomes an issue saying what we missed.
 *
 * ⚠ THIS IS THE DIRECT DEFENCE AGAINST THE ONE OUTCOME §25 SAYS WOULD MEAN WE HAD FAILED —
 * a user getting a better answer by typing the question into their own chat window. If
 * that is going to happen, it should happen here, in front of us, and become a to-do.
 */
export async function coverageCheck(input: {
  kernel: string
  answers: PanelAnswer[]
  onUsage: (u: LlmUsage) => void
}): Promise<CoverageResult | null> {
  const points = input.answers.flatMap((a) =>
    (a.substantivePoints ?? []).map((p) => ({ point: String(p ?? '').trim(), model: a.model })).filter((p) => p.point),
  )
  if (!points.length) return { missed: [], coveredCount: 0 }

  const system = [
    M_GENERAL,
    '',
    'TWO ANALYSES OF THE SAME PROBLEM ARE IN FRONT OF YOU. One is OURS — a full kernel, drafted,',
    'researched against a corpus and revised. The other is a list of POINTS other models made when',
    'given only the proposer\'s own account.',
    '',
    'YOUR ONE JOB: for each of their points, does OUR kernel address it — not "mention the topic", but',
    'ADDRESS THE POINT, so that a reader of our kernel would come away knowing it?',
    '',
    '  `covered` — the points our kernel addresses. Copy each verbatim.',
    '  `missed`  — the points it does not. For each: the `point` verbatim, `namedBy` (the model, copied',
    '              exactly as labelled), and `whyItMatters` — one sentence on what the proposal is',
    '              missing by not having it, addressed to the proposer.',
    '',
    '⚠ BE HARD ABOUT THIS AND ERR TOWARDS `missed`. A point our kernel gestures at in a subordinate',
    'clause is NOT covered. The cost of a false "covered" is that the user finds it themselves in a',
    'chat window and concludes we did not look; the cost of a false "missed" is one extra item on a',
    'list they can dismiss in a second. Those costs are not close.',
    '',
    '⚠ AND DO NOT MARK A POINT MISSED BECAUSE IT IS WRONG. Your job is coverage, not adjudication. A',
    'point our kernel considered and rejected IS covered — say so — but only if the kernel actually',
    'shows the rejection.',
  ].join('\n')

  const result = await callJson<{ covered: string[]; missed: CoverageResult['missed'] }>({
    model: smartCritiqueModel(),
    system,
    user: [
      '═══ OUR KERNEL ═══',
      input.kernel || '(nothing drafted)',
      '',
      '═══ THEIR POINTS ═══',
      ...points.map((p, i) => `[${i + 1}] (${p.model}) ${p.point}`),
    ].join('\n'),
    schema: COVERAGE_SCHEMA,
    maxOutputTokens: parseInt(process.env.LEX_SMART_COVERAGE_TOKENS ?? '6000', 10),
    timeoutMs: TIMEOUT_MS,
    temperature: 0.2,
    label: 'smart-coverage',
  })
  input.onUsage(result.usage)

  if (llmFailed(result)) {
    console.warn('[25f:smart] the coverage check did not complete', {
      reason: result.reason, detail: result.detail?.slice(0, 300),
    })
    return null
  }
  return {
    missed: (result.value.missed ?? []).filter((m) => m?.point?.trim()),
    coveredCount: (result.value.covered ?? []).length,
  }
}

// ── §2d — the critique, with a rewrite mandate ───────────────────────────────

export interface SmartCritique {
  /** ⚠ A VERDICT, not a comment. Does this pass Rumelt's tests? */
  verdict: 'GOOD' | 'WEAK' | 'NOT_A_KERNEL'
  verdictReason: string
  /** Where the kernel fails a Rumelt test — each becomes an issue. */
  failures: Array<{ test: string; whatFails: string; theTextThatFails: string }>
  /** The rewrite. Empty string on a field means "leave it as it is". */
  rewrite: {
    summaryDiagnosis: string
    pivotalObstacle: string
    summaryGuidingPolicy: string
    whatItRulesOut: string
    summaryCoherentActions: string
  }
  /** What the rewrite changed and why — the revision pass's shape (§2d). */
  changed: Array<{ fieldKey: string; wasSaying: string; nowSays: string; whyChanged: string }>
  /** Forks whose chosen road the critique thinks is the wrong one. */
  forkDoubts: Array<{ forkKey: string; doubt: string }>
  /** ⚠ Rubbish, named. §1/§2d: "Is there rubbish to delete?" */
  toDelete: Array<{ what: string; why: string }>
  /** The references and case studies that should lead. Everything else is a footnote. */
  leadWith: Array<{ title: string; whyItLeads: string }>
  // ── §2d's four questions, answered in the output ──
  howHardToPass: string
  barriers: string[]
  likelihoodOfSuccess: string
  mostLikelyToGoWrong: string
}

const CRITIQUE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['GOOD', 'WEAK', 'NOT_A_KERNEL'] },
    verdictReason: { type: 'string' },
    failures: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          test: { type: 'string' },
          whatFails: { type: 'string' },
          theTextThatFails: { type: 'string' },
        },
        required: ['test', 'whatFails', 'theTextThatFails'],
      },
    },
    rewrite: {
      type: 'object',
      properties: {
        summaryDiagnosis: { type: 'string' },
        pivotalObstacle: { type: 'string' },
        summaryGuidingPolicy: { type: 'string' },
        whatItRulesOut: { type: 'string' },
        summaryCoherentActions: { type: 'string' },
      },
      required: ['summaryDiagnosis', 'pivotalObstacle', 'summaryGuidingPolicy',
        'whatItRulesOut', 'summaryCoherentActions'],
    },
    changed: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fieldKey: { type: 'string' },
          wasSaying: { type: 'string' },
          nowSays: { type: 'string' },
          whyChanged: { type: 'string' },
        },
        required: ['fieldKey', 'wasSaying', 'nowSays', 'whyChanged'],
      },
    },
    forkDoubts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { forkKey: { type: 'string' }, doubt: { type: 'string' } },
        required: ['forkKey', 'doubt'],
      },
    },
    toDelete: {
      type: 'array',
      items: {
        type: 'object',
        properties: { what: { type: 'string' }, why: { type: 'string' } },
        required: ['what', 'why'],
      },
    },
    leadWith: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, whyItLeads: { type: 'string' } },
        required: ['title', 'whyItLeads'],
      },
    },
    howHardToPass: { type: 'string' },
    barriers: { type: 'array', items: { type: 'string' } },
    likelihoodOfSuccess: { type: 'string' },
    mostLikelyToGoWrong: { type: 'string' },
  },
  required: ['verdict', 'verdictReason', 'failures', 'rewrite', 'changed', 'forkDoubts',
    'toDelete', 'leadWith', 'howHardToPass', 'barriers', 'likelihoodOfSuccess', 'mostLikelyToGoWrong'],
}

export async function critiqueKernel(input: {
  kernel: string
  pageOne: string
  findings: string
  forks: Array<{ forkKey: string; chosen: string; alternatives: string[] }>
  panelAnswers: PanelAnswer[]
  vocabulary: VocabularyResult
  onUsage: (u: LlmUsage) => void
}): Promise<SmartCritique | null> {
  const system = [
    M_GENERAL, '', M_DIAGNOSIS, '', M_GUIDING_POLICY, '', M_COHERENT_ACTIONS,
    '',
    '════ YOU ARE READING A FINISHED KERNEL AND DECIDING WHETHER IT IS ANY GOOD ════',
    '',
    '⚠ THIS IS A REWRITE MANDATE, NOT A COMMENT. Where the kernel fails one of Rumelt\'s tests, FIX IT',
    'in `rewrite` and record what you changed in `changed`. A critique that names a failure and leaves',
    'the text as it was has done half the job and the more comfortable half.',
    '',
    '  `verdict`       — GOOD (it passes and would survive a hostile reading), WEAK (it is a kernel and',
    '                    it fails tests), NOT_A_KERNEL (it is a wish, a goal, or a list of actions with',
    '                    no diagnosis under it). Be willing to say NOT_A_KERNEL: it is the finding the',
    '                    proposer most needs and the one you are most tempted to soften.',
    '  `failures`      — each Rumelt test it fails. `test` names the test ("the guiding policy rules',
    '                    nothing out"); `theTextThatFails` QUOTES the sentence that fails it, so the',
    '                    proposer can see it rather than take your word for it.',
    '  `rewrite`       — the fixed text, field by field. ⚠ AN EMPTY STRING MEANS "LEAVE IT AS IT IS" and',
    '                    is the right answer for a field that is already good. Do not rewrite for the',
    '                    sake of rewriting; a change that is only a rephrasing wastes the proposer\'s',
    '                    review and hides the changes that matter.',
    '  `changed`       — one entry per field you actually rewrote: what it was saying, what it now says,',
    '                    and WHY that moved you. This is the sentence the proposer learns most from.',
    '  `forkDoubts`    — decision points below where you think the road taken is the wrong one, with the',
    '                    reason. Copy `forkKey` exactly.',
    '  `toDelete`      — ⚠ WHAT IS RUBBISH. Material in the kernel that is padding, restatement,',
    '                    or an abstraction of something already said better elsewhere. Name it and say',
    '                    why. Everything rendered at equal weight is the same as nothing being ranked.',
    '  `leadWith`      — the two or three references, findings or case studies that should be at the',
    '                    TOP of what the proposer reads, with one line on why each leads. Everything',
    '                    else is a footnote, not a peer.',
    '',
    '════ AND ANSWER THESE FOUR, IN THE PROPOSER\'S OWN TERMS ════',
    '  `howHardToPass`       — how hard will this actually be to pass, as law or as an implemented',
    '                          organisational change? Name the stage it is most likely to die at.',
    '  `barriers`            — the real barriers and challenges. 3–6, each concrete.',
    '  `likelihoodOfSuccess` — your honest read, with the reasoning. A number with no reasoning is worse',
    '                          than a sentence; a sentence with no commitment is worse than either.',
    '  `mostLikelyToGoWrong` — the single thing most likely to go wrong. Not a list.',
    '',
    '⚠ GROUNDING. You may reason openly and you must say when you are — but you may NOT invent a',
    'citation, a statute, a section number or a case name. The findings below are what was actually',
    'retrieved; anything not in them is your reasoning and must read as reasoning.',
    '',
    TESTIMONY_INSTRUCTION,
  ].join('\n')

  const result = await callJson<SmartCritique>({
    model: smartCritiqueModel(),
    system,
    user: [
      '═══ THE PROPOSER\'S OWN ACCOUNT, VERBATIM ═══',
      input.pageOne || '(nothing recorded)',
      '',
      '═══ OUR KERNEL, AS IT STANDS AFTER RESEARCH AND REVISION ═══',
      input.kernel || '(nothing drafted)',
      '',
      '═══ THE DECISIONS WE RECORDED AN ALTERNATIVE FOR ═══',
      ...(input.forks.length
        ? input.forks.map((f) => `- ${f.forkKey}: chose "${f.chosen}"; set aside ${f.alternatives.join(' / ')}`)
        : ['(none)']),
      '',
      '═══ WHAT THE RESEARCH FOUND (the only material you may cite) ═══',
      input.findings || '(nothing)',
      '',
      '═══ HOW OTHER MODELS ANSWERED THE SAME ACCOUNT ═══',
      ...(input.panelAnswers.length
        ? input.panelAnswers.map((a) => [
            `── ${a.model} ──`,
            `diagnosis: ${a.diagnosis}`,
            `guiding policy: ${a.guidingPolicy}`,
            `instrument: ${a.instrument}`,
            `actions: ${(a.coherentActions ?? []).join(' | ')}`,
          ].join('\n'))
        : ['(no outside model answered)']),
      '',
      '═══ TERMS OF ART THE CORPUS CONFIRMED ═══',
      ...(input.vocabulary.confirmed.length
        ? input.vocabulary.confirmed.map((e) => `- ${e.name} (${e.kind}) — ${e.whyItBears}`)
        : ['(none confirmed)']),
      '',
      '═══ TERMS NAMED BUT NOT CONFIRMED BY THE CORPUS — UNVERIFIED, DO NOT ASSERT ═══',
      ...(input.vocabulary.unverified.length
        ? input.vocabulary.unverified.map((e) => `- ${e.name} (${e.kind}) — named by ${e.namedBy.join(', ')}`)
        : ['(none)']),
    ].join('\n'),
    schema: CRITIQUE_SCHEMA,
    maxOutputTokens: parseInt(process.env.LEX_SMART_CRITIQUE_TOKENS ?? '12000', 10),
    timeoutMs: parseInt(process.env.LEX_SMART_CRITIQUE_TIMEOUT_MS ?? '150000', 10),
    temperature: 0.3,
    label: 'smart-critique',
  })
  input.onUsage(result.usage)

  if (llmFailed(result)) {
    console.error('[25f:smart] the critique did not complete', {
      reason: result.reason, detail: result.detail?.slice(0, 400),
    })
    return null
  }
  return result.value
}

// ── Persistence ──────────────────────────────────────────────────────────────

/**
 * The cited findings the entity searches produced.
 *
 * ⚠ ONE GATHER OVER THE UNION, NOT ONE PER ENTITY. Twelve gathers would be twelve model
 * calls inside a pass that has to finish; the union is what a reader wants anyway, because
 * the interesting output is "here is what the record actually says about the words the
 * field uses", not twelve separate paragraphs.
 */
export async function citeVocabulary(input: {
  ideaId: string
  buildVersion: number
  vocabulary: VocabularyResult
  kernel: string
  onUsage: (u: LlmUsage) => void
}): Promise<number> {
  if (!input.vocabulary.results.length || !input.vocabulary.confirmed.length) return 0

  // ⚠⚠ THE GATHER READS THE DOCUMENTS THAT MENTION A CONFIRMED TERM, NOT ALL 426 OF THEM.
  //
  // Measured on the first real run: eighteen entity searches returned **426** documents
  // between them. Handing all of them to one gather is ~21,000 tokens of prompt in which
  // the material that actually mentions a term of art is a small minority — the model reads
  // the average of the pile and the terms get lost in it, which is precisely the dilution
  // this whole sprint is about.
  //
  // So each confirmed term contributes its own top few, and a document that mentions none
  // of them contributes nothing. It cost eighteen searches to find these; the point was
  // never the volume.
  const perTerm = parseInt(process.env.LEX_SMART_CITE_PER_TERM ?? '5', 10)
  const picked = new Map<string, SearchResult>()
  for (const e of input.vocabulary.confirmed) {
    const needle = e.name.toLowerCase()
    let taken = 0
    for (const r of input.vocabulary.results) {
      if (taken >= perTerm) break
      if (picked.has(r.id)) continue
      if (!`${r.title ?? ''} ${r.citation ?? ''} ${r.snippet ?? ''}`.toLowerCase().includes(needle)) continue
      picked.set(r.id, r)
      taken++
    }
  }
  const forGather = [...picked.values()]
  if (!forGather.length) {
    // Every confirmed term was confirmed by SOMETHING, so an empty pick here means the
    // matching changed between the two steps. Reported rather than papered over.
    console.warn('[25f:smart] terms were confirmed and no document could be re-matched to them', {
      confirmed: input.vocabulary.confirmed.length, results: input.vocabulary.results.length,
    })
    return 0
  }
  console.log('[25f:smart] citing the vocabulary', {
    confirmed: input.vocabulary.confirmed.length,
    retrieved: input.vocabulary.results.length,
    handedToGather: forGather.length,
    perTerm,
  })

  const method = [
    'Another analysis of this problem named a set of TERMS OF ART — statutes, doctrines, offices,',
    'conventions and named mechanisms that a specialist in this field uses and the proposer does not',
    'know. The documents below were retrieved by searching the corpus for those terms.',
    '',
    'YOUR JOB: say what the record ACTUALLY SHOWS about each term that appears in it.',
    '  · Name the term, then what the retrieved document says about it, then what follows for this',
    '    proposal. That third part is what makes it worth the proposer\'s time.',
    '  · ⚠ A DOCUMENT THAT MERELY MENTIONS THE TERM IS NOT A FINDING ABOUT IT. If the retrieved',
    '    material does not tell you what the term means or does, say nothing about it rather than',
    '    filling the gap from your own knowledge — this pass exists to separate the two.',
    '  · Where a term the proposer has never heard of turns out to be the thing their whole problem',
    '    turns on, say so plainly. That is the highest-value output this pass can produce.',
    '',
    'THE TERMS THE CORPUS CONFIRMED:',
    ...input.vocabulary.confirmed.map((e) => `  · ${e.name} (${e.kind}) — ${e.whyItBears}`),
  ].join('\n')

  const gather = await generateDeepeningFindings(
    {
      method,
      mustAnswer: input.vocabulary.confirmed.slice(0, 8).map((e) => `What does the record show about ${e.name}?`),
      idea: input.kernel,
      costLines: [],
      results: forGather,
    },
    { label: 'smart-vocabulary', stream: 'build', onUsage: input.onUsage },
  )
  if (!gather) {
    console.warn('[25f:smart] the vocabulary gather did not complete — the terms stay unverified')
    return 0
  }

  const byId = new Map(forGather.map((r) => [r.id, r]))
  let written = 0
  await supersedeOlderProposals(input.ideaId, SMART_PASS_KEY, input.buildVersion)
  for (const f of gather.findings) {
    const src = byId.get(f.sourceId)
    // The Deepening's rule, unchanged: a finding whose source is not in what we retrieved
    // is a claim, not a finding.
    if (!src) continue
    await prisma.evidenceItem.create({
      data: {
        ideaId: input.ideaId,
        passKey: SMART_PASS_KEY,
        runVersion: input.buildVersion,
        // 25-D §3 — tagged by the producer. These answer "what the law says now" by the
        // route the proposer could not have taken themselves.
        headingKey: 'LAW_NOW',
        fieldRef: f.fieldRef ?? null,
        kind: f.kind === 'CONTRADICTS' ? 'CONTRADICTS' : 'FINDING',
        title: f.title,
        body: f.body,
        sourceType: src.type,
        sourceId: src.id,
        citation: src.citation,
        url: src.url,
        status: 'PROPOSED',
      },
    })
    written++
  }

  // ⚠⚠ THE CONFIRMED TERMS ARE RECORDED AS A LIST, AND THE FIRST FULL RUN IS WHY.
  //
  // The corpus confirmed **7 of 12** terms — and the screen showed "CONFIRMED by the
  // corpus: (none)", because the only thing it could read was this pass's cited findings
  // and the gather had produced none. Two separate facts were being carried by one row:
  // *which words the record uses* and *what the record says about them*. When the second
  // failed, the first vanished with it — so a build that had successfully found Carltona
  // and the Accounting Officer in the corpus reported finding nothing.
  //
  // ⚠ NO CITATION, because this row is not a claim about a document — it is a summary of
  // which of a list of names the corpus mentions at all. The findings underneath it carry
  // the citations.
  const names = input.vocabulary.confirmed.map((e) => `${e.name} (${e.kind})`).join('\n• ')
  await prisma.evidenceItem.create({
    data: {
      ideaId: input.ideaId,
      passKey: SMART_PASS_KEY,
      runVersion: input.buildVersion,
      headingKey: 'LAW_NOW',
      fieldRef: null,
      kind: 'FINDING',
      title: CONFIRMED_TERMS_TITLE,
      body: `• ${names}\n\nThese are terms of art another model reached for when given your own account, `
        + 'and the corpus does hold documents that mention them. That is what "confirmed" means here — '
        + 'the word is real and the record uses it. What the record SAYS about each is in the findings '
        + 'below, where it carries a citation.',
      sourceType: null, sourceId: null, citation: null, url: null,
      status: 'PROPOSED',
    },
  })

  return written
}

/** The row that carries the confirmed vocabulary. Read by name in build-highlights.ts. */
export const CONFIRMED_TERMS_TITLE = 'Terms of art the record confirms'

/**
 * §2b — "Anything the corpus cannot confirm is kept and labelled unverified — never
 * asserted, never dropped."
 *
 * ⚠ IT IS A STATED GAP, NOT A FINDING, AND THAT IS THE WHOLE POINT. An `EvidenceItem`
 * needs a source; these have none by definition. `DeepeningPass.knownUnknowns` is the
 * existing machinery for "we looked for this and could not reach it", it already renders
 * under its own panel heading, and it is exactly the right shape: a question, and why it
 * is still open.
 */
export async function recordUnverifiedVocabulary(input: {
  ideaId: string
  buildVersion: number
  vocabulary: VocabularyResult
}): Promise<number> {
  const gaps = input.vocabulary.unverified.map((e) => ({
    question: `What is "${e.name}" (${e.kind}), and does it bear on this?`,
    why:
      `Named by ${e.namedBy.join(' and ')} as a term of art for this problem — "${e.whyItBears}" — and `
      + 'the corpus search for it returned nothing that mentions it. ⚠ UNVERIFIED: this is a lead worth '
      + 'following, not a finding, and nothing in the proposal may cite it.',
  }))
  if (input.vocabulary.droppedByCap > 0) {
    gaps.push({
      question: `${input.vocabulary.droppedByCap} further term(s) of art were named and never put to the corpus`,
      why:
        `This pass tests at most ${ENTITY_CAP} terms so it cannot run away with the build's time budget. `
        + 'The rest were dropped untested — a limit in what we did, not a statement about what exists.',
    })
  }
  if (!gaps.length) return 0

  await prisma.deepeningPass.upsert({
    where: { ideaId_passKey: { ideaId: input.ideaId, passKey: SMART_VOCABULARY_PASS_KEY } },
    create: {
      ideaId: input.ideaId,
      passKey: SMART_VOCABULARY_PASS_KEY,
      status: 'RUN',
      runVersion: input.buildVersion,
      startedAt: new Date(),
      completedAt: new Date(),
      knownUnknowns: gaps as never,
      candidatesReviewed: input.vocabulary.results.length,
      candidatesKept: input.vocabulary.confirmed.length,
      siftSkipped: false,
    },
    update: {
      status: 'RUN',
      runVersion: input.buildVersion,
      completedAt: new Date(),
      knownUnknowns: gaps as never,
      candidatesReviewed: input.vocabulary.results.length,
      candidatesKept: input.vocabulary.confirmed.length,
      siftSkipped: false,
    },
  })
  return gaps.length
}

/**
 * §2d's four questions, stored where the user will actually meet them.
 *
 * ⚠ THEY ARE REASONING AND THEY SAY SO. `sourceId`, `citation` and `url` are null — the
 * same decision the revision pass makes for a contradiction, and for the same reason: a
 * judgement about how hard a Bill will be to pass is not a document, and attaching a
 * citation to it would be the never-claim breach the rest of the build refuses.
 */
/**
 * ⚠ NAMED, so the row and the heading it is filed under cannot disagree. The title is the
 * only thing distinguishing the reading list from the prognosis at write time, and a
 * literal repeated in two places is a literal that will be edited in one.
 */
export const READ_FIRST_TITLE = 'What to read first'

export async function recordPrognosis(input: {
  ideaId: string
  buildVersion: number
  critique: SmartCritique
  model: string
}): Promise<number> {
  const { critique, model } = input
  const rows: Array<{ title: string; body: string }> = []

  if (critique.howHardToPass?.trim()) {
    rows.push({ title: 'How hard this will be to pass', body: critique.howHardToPass.trim() })
  }
  if (critique.barriers?.length) {
    rows.push({
      title: 'The barriers this will actually meet',
      body: critique.barriers.map((b, i) => `${i + 1}. ${String(b ?? '').trim()}`).filter(Boolean).join('\n'),
    })
  }
  if (critique.likelihoodOfSuccess?.trim()) {
    rows.push({ title: 'How likely this is to succeed', body: critique.likelihoodOfSuccess.trim() })
  }
  if (critique.mostLikelyToGoWrong?.trim()) {
    rows.push({ title: 'What is most likely to go wrong', body: critique.mostLikelyToGoWrong.trim() })
  }
  // §1 — "The most important references and case studies go at the top." The critique is
  // the only step that has read everything at once, so its ordering is the one worth
  // showing; the deterministic ranker in build-highlights.ts handles the rest.
  if (critique.leadWith?.length) {
    rows.push({
      title: READ_FIRST_TITLE,
      body: critique.leadWith
        .filter((l) => l?.title?.trim())
        .map((l) => `• ${l.title.trim()} — ${l.whyItLeads?.trim() || 'no reason given'}`)
        .join('\n'),
    })
  }
  if (critique.toDelete?.length) {
    // ⚠ NAMED, NOT DELETED. §1 says "delete the rubbish rather than rendering everything at
    // equal weight" — an instruction about the SCREEN. Silently removing a proposer's own
    // drafted material because a model called it padding would be a different and much
    // worse thing, so what the critique wants cut is put in front of them as a
    // recommendation they can act on.
    rows.push({
      title: 'What I would cut',
      body: critique.toDelete
        .filter((d) => d?.what?.trim())
        .map((d) => `• ${d.what.trim()} — ${d.why?.trim() || 'no reason given'}`)
        .join('\n'),
    })
  }

  for (const r of rows) {
    await prisma.evidenceItem.create({
      data: {
        ideaId: input.ideaId,
        passKey: SMART_PASS_KEY,
        runVersion: input.buildVersion,
        // ⚠⚠ 25-L §3c — `HOW_HARD`, NOT `AGAINST`, AND THAT ONE WORD IS WHY CHARLIE COULD
        // NOT FIND THIS. The best material the platform produces was filed under "The
        // strongest case against", among the objections. A prognosis is not an objection:
        // an objection is something to answer, a prognosis is something to plan around,
        // and a user looking for "how hard will this be" had no reason to open a heading
        // about the case against their own idea.
        //
        // ⚠ "What to read first" goes somewhere else again — it is a reading list, not a
        // prognosis, and §3b names it as its own item.
        headingKey: r.title === READ_FIRST_TITLE ? 'KEY_SOURCES' : 'HOW_HARD',
        fieldRef: null,
        kind: 'FINDING',
        title: r.title,
        body: `${r.body}\n\n(This is a judgement, reasoned by ${model} over the whole proposal — not a retrieved source. Nothing here carries a citation because none would be honest.)`,
        sourceType: null, sourceId: null, citation: null, url: null,
        status: 'PROPOSED',
      },
    })
  }
  return rows.length
}
