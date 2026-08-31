// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-O §5 — THE COMMENTARY THAT OPENS THE CAUSES SECTION.
//
// ⚠⚠ THE SYMPTOM, IN CHARLIE'S WORDS: *the user is asked to choose between causes at a granular
// level with no account of the terrain* — what the evidence says, where it conflicts, how
// complex the problem is, and how the pieces might fit into one coherent strategy.
//
// ⚠⚠ AND IT IS THE ONLY PASS THAT READS THE CAUSES AS A **SET**. Every other pass reasons about
// one cause at a time, which is precisely why the output is a list: a list is what you get when
// nothing ever looks at the whole. That is the change — not another finding, but the first
// sentence about the shape of the problem.
//
// ⚠ IT DESCRIBES; IT DOES NOT DECIDE. §5 is explicit, and so is §0: the guiding-policy choice
// mechanics land in 25-P and this must not pre-empt them. So the schema has no "recommended"
// field, no ranking and no ordering — `howPiecesFit` is about how causes RELATE, and the prompt
// forbids naming a winner. A commentary that quietly chose would make 25-P's design a
// retrofit around something already shipped.
//
// ⚠⚠ CONTRARY EVIDENCE IS A STRUCTURED FIELD, NOT A SENTENCE IN THE PROSE, and that is what
// makes §5's "assert the value, not the schema" possible. Charlie's own standard is the test:
// *"this quote suggests civil servants may not be inefficient — but he gives no hard numbers,
// there are plenty of numbers saying the opposite, and I have tracked down the figures he
// referred to and they no longer hold."* Three separate claims — the assertion, what stands
// against it, and why that matters — and prose would let a model deliver one and imply three.
//
// ⚠ AND "NO CONFLICT" IS AN ANSWER, WITH A REASON. §5 asks for an assertion that the commentary
// names at least one point of conflict. Taken literally that is a requirement to FIND one, which
// on a genuinely uncontested problem is a requirement to invent one — the schema-permits ≠
// prompt-requires failure (CLAUDE.md §24) with the sign flipped. So `conflicts` may be empty
// only when `noConflictFound` explains what was looked at and why nothing contradicted it, and
// the check accepts exactly those two shapes.
// ─────────────────────────────────────────────────────────────────────────────

// ⚠ `llmFailed`, NOT `!result.ok`. This project's tsconfig sets `strict: false`, so TypeScript
// does not narrow a discriminated union by the truthiness of its literal discriminant — see the
// note in `build-llm.ts`. A user-defined predicate narrows in every mode.
import { callJson, llmFailed, type LlmUsage } from './build-llm'

/** How many causes are really binding. A closed set: three words a user can act on. */
export type CauseComplexity = 'SINGLE_CAUSE' | 'SEVERAL_BIND' | 'UNCLEAR'

export interface CauseConflict {
  /** The claim that is contested, in the words of whoever made it. */
  claim: string
  /** What stands against it. §5's standard: the numbers, the date, the contrary source. */
  against: string
  /** Why the disagreement matters to the choice the user is about to make. */
  whyItMatters: string
}

export interface CausesCommentary {
  /** What the evidence says about why this problem happens. */
  terrain: string
  complexity: CauseComplexity
  /** Why that verdict, in a sentence the user can disagree with. */
  complexityWhy: string
  /** How the causes relate — which sit under others, which are independent. NOT a choice. */
  howPiecesFit: string
  /** Where the sources disagree. May be empty ONLY with `noConflictFound`. */
  conflicts: CauseConflict[]
  /** ⚠ Present only when `conflicts` is empty: what was looked at, and why nothing conflicted. */
  noConflictFound?: string
}

const SCHEMA = {
  type: 'object',
  properties: {
    terrain: { type: 'string' },
    complexity: { type: 'string', enum: ['SINGLE_CAUSE', 'SEVERAL_BIND', 'UNCLEAR'] },
    complexityWhy: { type: 'string' },
    howPiecesFit: { type: 'string' },
    conflicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          against: { type: 'string' },
          whyItMatters: { type: 'string' },
        },
        required: ['claim', 'against', 'whyItMatters'],
      },
    },
    noConflictFound: { type: 'string' },
  },
  required: ['terrain', 'complexity', 'complexityWhy', 'howPiecesFit', 'conflicts'],
}

/**
 * ⚠⚠ THE INSTRUCTION IS PROSE, NOT SCHEMA, AND CLAUDE.md §24 IS WHY THIS COMMENT EXISTS.
 *
 * `required: ['conflicts']` guarantees the KEY is present and nothing else — `[]` satisfies it
 * for ever, and an empty array here is the whole feature failing silently while every structural
 * check passes. Three times this repo has shipped a required field with no prose behind it
 * (`citedIds`, `citedMarkers`, `drivenBy`) and paid five sprints for the third. So the standard
 * is stated at length, with an example, and the empty case is given an explicit, harder path.
 */
const SYSTEM = [
  '════ YOU ARE WRITING THE OPENING COMMENTARY ON A DIAGNOSIS ════',
  '',
  'A user is about to be asked to choose between several candidate causes of a problem. Before',
  'they choose, they need an account of the TERRAIN: what the evidence actually says, where it',
  'disagrees with itself, how complicated this problem really is, and how the pieces relate.',
  '',
  '⚠ YOU ARE DESCRIBING, NOT DECIDING. Do not recommend a cause. Do not rank them. Do not say',
  'which is "the" root cause or which the user should pick. Someone reading this should finish it',
  'better equipped to choose and not told what to choose. If you find yourself writing "the most',
  'important cause is", delete the sentence and write what makes it hard to say instead.',
  '',
  '⚠⚠ CONTRARY EVIDENCE IS THE PART THAT MATTERS MOST, AND IT IS THE PART MOST OFTEN MISSING.',
  'For every claim the diagnosis leans on, ask: who says otherwise, how old is this, and does it',
  'come with numbers or only with assertion? This is the standard, from a real example:',
  '',
  '    "This quote suggests civil servants may not be inefficient — but he gives no hard numbers,',
  '     there are plenty of numbers saying the opposite, and the figures he referred to no longer',
  '     hold."',
  '',
  'Three separate things: the claim, what stands against it, and why it matters here. Each',
  'conflict you report must carry all three. A conflict with no `against` is an opinion.',
  '',
  '⚠⚠ AN EMPTY `conflicts` LIST IS ALMOST ALWAYS WRONG, AND IF YOU RETURN ONE YOU MUST DEFEND IT.',
  'Real problems with several candidate causes have contested evidence; a diagnosis where nothing',
  'conflicts is either very simple or has not been looked at hard enough. If you genuinely find',
  'no conflict, `conflicts` may be empty ONLY if `noConflictFound` says WHAT YOU EXAMINED and why',
  'none of it contradicted anything. "No conflicts found" is not an acceptable value for that',
  'field. ⚠ And do NOT invent a disagreement to fill the list — a manufactured conflict is worse',
  'than an honest absence, because the user will go and look for it.',
  '',
  '⚠ `complexity` IS ONE OF THREE VALUES AND IT IS A REAL JUDGEMENT:',
  '    SINGLE_CAUSE  — one cause does the work; remove it and the problem largely goes.',
  '    SEVERAL_BIND  — several causes each bind independently; fixing one leaves the problem.',
  '    UNCLEAR       — the evidence does not settle it. This is a legitimate answer and is',
  '                    better than a confident guess. Say what would settle it.',
  '',
  '⚠ `howPiecesFit` DESCRIBES RELATIONSHIPS, NOT A PLAN. Which causes sit beneath others, which',
  'are independent, which are symptoms of a third. If two candidates are really the same cause',
  'in different words, say so — that is the most useful thing this commentary can do.',
  '',
  '⚠ WRITE FOR SOMEBODY INTELLIGENT WHO IS NOT A SPECIALIST. No jargon, no hedging clouds. If',
  'the evidence is thin, say it is thin.',
].join('\n')

/** How long the commentary may take. Well inside the pass budget — it does no retrieval. */
const TIMEOUT_MS = parseInt(process.env.LEX_COMMENTARY_TIMEOUT_MS ?? '90000', 10)

/**
 * Write the commentary, or return null.
 *
 * ⚠ NULL, NOT A PLACEHOLDER. A commentary that could not be written must leave the section
 * with an honest empty state, never with a paragraph of hedging that reads as our considered
 * view of a problem we did not manage to look at.
 */
export async function runCausesCommentary(input: {
  /** The causes, the problem and whatever research the build has gathered. */
  material: string
  model: string
  onUsage: (u: LlmUsage) => void
}): Promise<CausesCommentary | null> {
  const out = await callJson<CausesCommentary>({
    model: input.model,
    system: SYSTEM,
    user: input.material,
    schema: SCHEMA,
    maxOutputTokens: parseInt(process.env.LEX_COMMENTARY_TOKENS ?? '4000', 10),
    timeoutMs: TIMEOUT_MS,
    // ⚠ LOW, BUT NOT ZERO. This is a judgement about a body of evidence, not an extraction;
    // 0 makes the prose mechanical without making the judgement better.
    temperature: 0.3,
    label: 'causes-commentary',
  })
  // ⚠ THE USAGE IS RECORDED EVEN WHEN THE CALL FAILED. A pass that burned tokens and then
  // returned nothing still cost money, and a spend record that only exists on success
  // under-reports precisely when it matters (the same rule `settleBuild` keeps).
  input.onUsage(out.usage)

  if (llmFailed(out)) {
    console.error('[25o:commentary] the causes commentary did not complete', {
      model: input.model, reason: out.reason, detail: out.detail?.slice(0, 300),
    })
    return null
  }

  const c = out.value
  // ⚠⚠ THE VALUE IS CHECKED HERE, AT THE BOUNDARY, NOT ONLY IN A TEST. `callJson` proves the
  // SHAPE; this proves there is something in it. A commentary of empty strings satisfies every
  // structural guarantee we have and is worse than none, because the section would render a
  // heading over nothing and look broken rather than absent.
  if (!c.terrain?.trim() || !c.howPiecesFit?.trim() || !c.complexityWhy?.trim()) return null
  const conflicts = (c.conflicts ?? []).filter(
    (x) => x?.claim?.trim() && x?.against?.trim() && x?.whyItMatters?.trim(),
  )
  // ⚠ AND THE EMPTY CASE MUST BE DEFENDED. No conflicts and no explanation is the model
  // skipping the hardest field, which is exactly what §24's three prior instances did.
  if (!conflicts.length && !c.noConflictFound?.trim()) return null

  return { ...c, conflicts }
}

/**
 * §5's own acceptance test, as a function, so the check and the renderer agree.
 *
 * ⚠ EXPORTED AND IMPORTED RATHER THAN RESTATED. 25-N §4 has the worked example of what happens
 * when a predicate is re-implemented in a second place: a copied `admits()` blind to
 * `extraCorpora` published UNREACHABLE=4 when it was 0.
 */
export function commentaryIsSubstantive(c: CausesCommentary | null): boolean {
  if (!c) return false
  if (!c.terrain?.trim() || !c.howPiecesFit?.trim() || !c.complexityWhy?.trim()) return false
  return c.conflicts.length > 0 || !!c.noConflictFound?.trim()
}
