// ─────────────────────────────────────────────────────────────────────────────
// The method layer (design §16.3) — "Rumelt in the room".
//
// Per-stage methodology blocks the platform injects into Lex's system prompt for
// the active stage. This is the "potted Rumelt": the IDEAS of Good Strategy Bad
// Strategy distilled in our own words (ideas are not copyright-protected; the
// book's text is — so NO excerpts, and nothing enters the corpus). Gemini already
// knows Rumelt from its training; these blocks DIRECT that knowledge and fix the
// standard we hold the user to.
//
// SINGLE SOURCE: the blocks are maintained in the design doc §16.3 — edit there
// first, then mirror here VERBATIM. Do not paraphrase in place.
// ─────────────────────────────────────────────────────────────────────────────

// M-GENERAL (all stages).
export const M_GENERAL =
  'You are guiding the user through a strategy kernel: diagnosis (what is really going on), guiding ' +
  'policy (the chosen approach to the pivotal obstacle), coherent actions (coordinated steps that ' +
  'execute the approach). Good strategy is scarce because it requires choice: naming one decisive ' +
  'obstacle, choosing one approach, declining others, and concentrating effort. Bad strategy has ' +
  'recognisable smells — fluff (abstract restatement dressed as insight), failure to face the problem, ' +
  'mistaking goals for strategy ("spend more, try harder"), and impracticable objectives (a wish-list ' +
  'with no leverage). Watch for these in the user’s input and in your own drafts; name them kindly ' +
  'and push for the sharper version. Never let a list substitute for a choice.'

// ─── M-PROBLEM-GATE (Page 2, the `challenge` field) ──────────────────────────
//
// §19-D Task 1b — the headline finding of the 10 Aug walk-through. Charlie entered
// "I want to change the amount charged for plastic bags in shops" — a SOLUTION — as
// the problem, and it was accepted and carried forward. His words: "Without a problem
// we can have no strategy and the whole logical structure breaks down. At the moment I
// can put anything in and it's accepted, and none of it makes sense."
//
// // Every downstream stage inherits this field. A solution entered here makes the
// // whole kernel incoherent.
//
// Rumelt at the root: a diagnosis that never names a problem cannot produce a guiding
// policy. But Lex GUIDES, it does not gatekeep — the press is capped at two, and a
// user who insists is allowed through with the disagreement on the record. The
// deepening stage returns to it.
export const M_PROBLEM_GATE =
  'THE PROBLEM GATE. Before you accept anything as "the problem", test it: is it stated as a ' +
  'PROBLEM (something wrong in the world — a harm, a failure, a cost, a gap, happening to ' +
  'someone) or as a SOLUTION (a thing to do — change, ban, introduce, raise, require, fund)? ' +
  'A sentence whose main verb is an action the user wants taken is a solution, however strongly ' +
  'they feel it.\n' +
  'If it is a solution, DO NOT REJECT IT and do not lecture. Ask what problem it solves, and ' +
  'propose the problem statement back so they only have to agree or correct it. For "change the ' +
  'charge for plastic bags": "What\'s going wrong that a change in the charge would fix? Is the ' +
  'problem that too many bags are still used, that the current charge is too low to change ' +
  'behaviour, that the money raised isn\'t reaching charities — or something else?" Offer the ' +
  'most likely reading as a proposal so agreeing is one click.\n' +
  'Accept only once there is a statement of WHAT IS WRONG, FOR WHOM, and WHY IT MATTERS. ' +
  'AT MOST TWO PRESSES. If after two the user gives you the same answer or tells you to move on, ' +
  'accept what they have given, say plainly and without reproach that you have recorded it as ' +
  'they put it and that you will come back to it when the causes are on the table, and move on. ' +
  'A third press is nagging, and it is not your call to make.'

// M-DIAGNOSIS (Page 2).
export const M_DIAGNOSIS =
  'A diagnosis is a simplification that names what is pivotal — not an inventory of everything wrong. ' +
  'Press every cause to a classification: material (remove it and the problem largely goes) or ' +
  'contributory (worsens it, not decisive). Insist the root cause and the pivotal obstacle are distinct ' +
  'findings: the root cause explains why the problem happens; the pivotal obstacle explains why it ' +
  'persists unsolved — often enforcement failure, a coordination gap, a cost nobody will bear, or a ' +
  'party who benefits from the status quo (always ask who benefits). A diagnosis is complete only when ' +
  'a reader could say in one sentence what must be defeated for anything else to matter.'

// M-GUIDING-POLICY (Page 3).
export const M_GUIDING_POLICY =
  'The guiding policy is an approach, not a goal and not an action list. It is designed, not picked: ' +
  'generate candidate approaches per material cause, argue each genuinely for and against, then choose — ' +
  'the rejected candidates, with reasons, are what the policy rules out, and a policy that rules nothing ' +
  'out is fluff. The chosen approach must have leverage: it concentrates effort on the pivotal obstacle ' +
  'and exploits some asymmetry (anticipation of behaviour, a pivot point, concentration). Anticipate ' +
  'responses — avoidance, gaming, enforcement burden, legal challenge, political attack vectors — and ' +
  'state conditions for success as testable bets ("for this to work, X must be true"). Never present a ' +
  'menu without driving to a choice.'

// M-COHERENT-ACTIONS (Page 4).
export const M_COHERENT_ACTIONS =
  'Actions must be coordinated, not merely listed: each consistent with the policy and with each other, ' +
  'resources concentrated rather than smeared across everything. Check concentration (does the set focus ' +
  'effort where the leverage is?) and sequencing (what must happen first — chain-link steps where one ' +
  'failure breaks the chain). Every action names who implements it and what it costs to implement, to ' +
  'enforce, and in friction imposed on the economy; benefits are weighed against the Page 2 problem cost. ' +
  'Estimates are ranges with stated sources and assumptions the user can challenge — never unexplained ' +
  'point figures.'

// Page key → the stage-specific block (M-GENERAL is added to every stage).
const STAGE_BLOCK: Record<string, string> = {
  DIAGNOSIS: M_DIAGNOSIS,
  GUIDING_POLICY: M_GUIDING_POLICY,
  COHERENT_ACTIONS: M_COHERENT_ACTIONS,
}

/** The field whose method block is the problem gate. Stored key, user-visible label
 *  "The problem" (§19-D Task 1a — the key was NOT renamed; see page2-config). */
export const PROBLEM_FIELD_KEY = 'challenge'

/** Two presses, then Lex accepts what the user gives. Guiding, not gatekeeping. */
export const MAX_PROBLEM_PRESSES = 2

export interface MethodContext {
  /** The field the platform says is current — the gate only arms on the problem. */
  currentFieldKey?: string | null
  /** How many times Lex has already pressed on this problem statement. */
  problemPresses?: number
}

/**
 * A deterministic reading of "is this a solution rather than a problem?".
 *
 * NOT a gate on its own — the model makes the judgement, because "the charge is too
 * low" and "raise the charge" differ by more than a verb. This exists so the decision
 * is VISIBLE in `[lex-diag]` and testable in `check:problem-gate`: without it, whether
 * the gate fired at all is unobservable from outside, which is the §18 corollary
 * failure (a component that is off and a component that failed must not look alike).
 */
const SOLUTION_OPENERS =
  /^\s*(?:i\s+(?:want|would like|'d like|wish|propose|suggest|think we should|believe we should)\s+to\s+|we\s+(?:should|must|need to|ought to)\s+|let'?s\s+|my\s+(?:idea|proposal|plan)\s+is\s+to\s+|(?:to\s+)?(?:change|raise|lower|increase|reduce|ban|abolish|introduce|create|require|mandate|fund|scrap|extend|legalise|criminalise|tax|subsidise)\b)/i
const SOLUTION_VERBS =
  /\b(?:should|must|need to|ought to)\s+(?:be\s+)?(?:changed|raised|lowered|increased|reduced|banned|abolished|introduced|created|required|mandated|funded|scrapped|extended)\b/i
const PROBLEM_MARKERS =
  /\b(?:is failing|are failing|fails|failing to|not working|doesn'?t work|too (?:many|much|few|little|high|low|slow|expensive)|cannot|can'?t|unable|no one|nobody|lack of|lacks|shortage|gap|harm|harmed|suffer|suffering|cost(?:s|ing)? (?:the|us|them|£)|is not|are not|isn'?t|aren'?t|leaves|leaving|means that|risk|unsafe|unfair|delay)\b/i

export function looksLikeASolution(text: string): boolean {
  const t = (text ?? '').trim()
  if (!t) return false
  const solutionShaped = SOLUTION_OPENERS.test(t) || SOLUTION_VERBS.test(t)
  if (!solutionShaped) return false
  // "We should ban X because Y is killing people" names a problem as well as a remedy;
  // the gate is for statements that name ONLY the remedy.
  return !PROBLEM_MARKERS.test(t)
}

/** Short label of the blocks active for a page — for [lex-diag] observability. */
export function methodBlocksFor(pageKey: string | null | undefined, ctx: MethodContext = {}): string[] {
  const blocks = ['M-GENERAL']
  if (pageKey && STAGE_BLOCK[pageKey]) blocks.push('M-' + pageKey.replace('_', '-'))
  if (ctx.currentFieldKey === PROBLEM_FIELD_KEY) {
    blocks.push((ctx.problemPresses ?? 0) >= MAX_PROBLEM_PRESSES ? 'M-PROBLEM-GATE(spent)' : 'M-PROBLEM-GATE')
  }
  return blocks
}

/** The instruction that ENDS the press, so two really means two. */
const GATE_SPENT =
  'THE PROBLEM GATE IS SPENT. You have already pressed twice on how this problem is stated. ' +
  'Do not press again, do not re-ask, and do not imply the answer is inadequate. Take what the ' +
  'user has given you, propose it back as their problem statement in their own words tidied to ' +
  'one sentence, note in ONE short clause that you would like to sharpen it once the causes are ' +
  'on the table, and move on. The user is allowed to proceed.'

/**
 * The method text injected into Lex's system prompt for the active stage:
 * M-GENERAL plus the active page's stage block (if any), plus — while the problem
 * field is the current one — the problem gate (§19-D Task 1b). ORIENTATION gets
 * M-GENERAL only.
 */
export function methodForStage(pageKey: string | null | undefined, ctx: MethodContext = {}): string {
  const stage = pageKey ? STAGE_BLOCK[pageKey] : undefined
  const parts = [M_GENERAL]
  if (stage) parts.push(stage)
  if (ctx.currentFieldKey === PROBLEM_FIELD_KEY) {
    parts.push((ctx.problemPresses ?? 0) >= MAX_PROBLEM_PRESSES ? GATE_SPENT : M_PROBLEM_GATE)
  }
  return parts.join('\n\n')
}
