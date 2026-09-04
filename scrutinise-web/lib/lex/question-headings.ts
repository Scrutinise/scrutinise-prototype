// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-D §3 / §25.5 — THE PANEL IS ORGANISED BY QUESTION, NOT BY DOCUMENT TYPE.
//
// "Primary legislation / statutory instruments / committee reports" is OUR FILING SYSTEM.
// It is how the corpus is shelved, and it is a useful thing to be able to fall back on —
// which is why the full list is still underneath, collapsed. But it is not what the user
// came for. They came with a question, and the panel should answer questions.
//
// ⚠⚠ RULE 1, AND IT MATTERS MORE THAN THE REORDERING: **A HEADING WITH NOTHING UNDER IT
// RENDERS AS A STATED GAP, NOT AS ABSENT.**
//
//     "We looked for how the courts have read this, and found nothing"   is a FINDING.
//     (heading not rendered at all)                                       is SILENCE.
//
// From the outside those are indistinguishable from a question that was never asked, and
// the difference between them is the difference between honest and merely quiet. This is
// the same rule as §18's "a degradation must announce itself", and the same rule as the
// Deepening's known-unknowns: an absence we established is worth more to a user than an
// absence we let them assume.
//
// ⚠ SO A HEADING KNOWS WHY IT MIGHT BE EMPTY, and there are four different reasons which
// must never share a sentence:
//
//   `asked-found-nothing`  we asked and the corpus returned nothing  → a finding
//   `not-asked`            the question did not fire on this draft   → say which and why
//   `no-producer`          nothing in this build can answer it yet   → OUR limitation
//   `nothing-added`        the user has added no material of their own → not a gap at all
//
// The third is the one that would otherwise be dishonest. "Who has taken a position" has
// no producer today — it waits on the people graph reaching `holds-position` (§25.8 item
// 6) — and rendering it as "nothing found" would blame the record for a gap in our tooling.
//
// ⚠ WHY THIS FILE IS SEPARATE FROM `interrogation-library.ts`, which is the obvious home.
// Two reasons, and both are structural rather than stylistic:
//
//   1. The library's own check (`check:build-25b`) forbids a question ID from appearing
//      anywhere outside that file. The panel, the snapshot and the Evidence Pack all need
//      to name a HEADING; none of them may name a QUESTION. Headings therefore have to be
//      their own vocabulary, and questions declare which one they answer.
//   2. The document stack reads this too, and it is held to an import ban
//      (`check:20bd`) precisely so a renderer cannot reach into mid-flight Lex modules.
//      This file imports nothing. That is deliberate and should stay true.
// ─────────────────────────────────────────────────────────────────────────────

export type HeadingKey =
  | 'LAW_NOW'
  | 'REFERS_TO_THIS'
  | 'COURTS'
  | 'TRIED_BEFORE'
  | 'ELSEWHERE'
  | 'ARGUED'
  | 'POSITIONS'
  | 'NUMBERS'
  | 'DEVOLVED'
  | 'AGAINST'
  | 'HOW_HARD'
  | 'KEY_SOURCES'
  | 'COST_DURATION'
  | 'YOUR_MATERIAL'

export interface QuestionHeading {
  key: HeadingKey
  /** The heading, as the user reads it. §25.5's words. */
  heading: string
  /**
   * What this heading is FOR, in one line — shown when it is empty, so a stated gap says
   * what was looked for rather than only that nothing was found.
   */
  lookingFor: string
}

/**
 * ⚠ THE ORDER IS THE DESIGN, so it is data — the same reasoning as `AGENDA_SECTIONS`.
 *
 * It runs from what is settled toward what is contested: the law as it stands, then how it
 * has been read, then what has been tried, then what others built, then the argument, the
 * people, the numbers, the extent — and it ENDS on the strongest case against, because a
 * user who reads to the bottom of this panel should finish on the thing that will be put
 * to them. "Your material" is last of all: it is theirs, and it is where they look when
 * they are looking for their own.
 */
export const QUESTION_HEADINGS: QuestionHeading[] = [
  {
    key: 'LAW_NOW',
    heading: 'What the law says now',
    lookingFor: 'the Acts, instruments and existing powers that govern this today',
  },
  {
    // ══ 25-J §4 — STATUTORY CONSEQUENCES GETS ITS OWN HEADING ══════════════════
    //
    // ⚠ NOT FOLDED INTO `LAW_NOW`, and the distinction is the whole value of the pass.
    // "What the law says now" answers what governs this today. This answers what would
    // BREAK if you changed it — a different question, with a different shape of answer
    // (groups with dispositions rather than findings with citations) and a different
    // failure mode when empty. A user who has read the current law still has no idea what
    // depends on it, and burying the second under the first hides exactly the thing
    // nobody else surfaces to a non-lawyer.
    //
    // ⚠ IMMEDIATELY AFTER `LAW_NOW`. The order here IS the panel order
    // (`HEADING_ORDER`), and the two questions are read together: what this law says, then
    // what else leans on it.
    key: 'REFERS_TO_THIS',
    heading: 'What else refers to this law',
    lookingFor:
      'other provisions in the statute book that point at the enactment this proposal would '
      + 'change, grouped by what each kind of reference does and what it would need',
  },
  {
    key: 'COURTS',
    heading: 'How the courts have read it',
    lookingFor: 'judgments construing the provisions this proposal turns on',
  },
  {
    key: 'TRIED_BEFORE',
    heading: 'What was tried before — and what happened',
    lookingFor: 'comparable measures actually tried, what they were predicted to do, and what a review found',
  },
  {
    key: 'ELSEWHERE',
    heading: 'Where this mechanism works elsewhere',
    lookingFor: 'the same problem solved in another sector, industry or country',
  },
  {
    key: 'ARGUED',
    heading: 'Who has argued about this',
    lookingFor: 'committees, inquiries and debates that have already examined this problem',
  },
  {
    // ⚠ 25-L §3b GIVES THIS HEADING ITS WORDING, AND §5 CONSTRAINS WHAT MAY SIT UNDER IT.
    // The brief calls it "key people and groups likely to support or oppose". What we hold
    // is a RECORD — how members voted, what they declared — not a prediction, and §5 is
    // explicit that "every individual claim must still be true and sourced". So the heading
    // is the user's question and `lookingFor` is the honest answer to "from what?": a
    // reader must not come away thinking we have forecast anybody's future vote.
    key: 'POSITIONS',
    heading: 'Key people and groups likely to support or oppose',
    lookingFor:
      'how members have actually voted, what they have declared and which committees they sit '
      + 'on — the record, not a forecast',
  },
  {
    key: 'NUMBERS',
    heading: 'The numbers',
    lookingFor: 'whether the problem is measured anywhere, by whom, and at what scale',
  },
  {
    key: 'DEVOLVED',
    heading: 'What’s devolved',
    lookingFor: 'whether this is reserved or devolved, and what follows for the vehicle',
  },
  {
    // ══ 25-L §3c — THE SMART PASS'S OUTPUT GETS A HOME ══════════════════
    //
    // ⚠⚠ IT WAS FILED UNDER `AGAINST`, WHICH IS WHY CHARLIE COULD NOT FIND IT. "How hard
    // will this be to pass", the barriers, the likelihood, what is most likely to go wrong
    // and what the critique would cut — the best material the platform produces — were
    // written by `recordPrognosis` with `headingKey: 'AGAINST'`, so they sat among the
    // objections under "The strongest case against". They are not objections. They are a
    // prognosis, which is a different question with a different use: an objection is
    // something to answer, a prognosis is something to plan around.
    //
    // ⚠ AND IT IS REASONING, NOT RETRIEVAL. Every row under this heading carries no
    // citation, deliberately — a judgement about how hard a Bill will be to pass is not a
    // document, and attaching a citation to it would be the never-claim breach the rest of
    // the build refuses. The panel says so on the rows themselves.
    key: 'HOW_HARD',
    heading: 'How hard will this be to achieve?',
    lookingFor:
      'what stands in the way of this actually happening — the barriers, how likely it is to '
      + 'succeed, and what is most likely to go wrong',
  },
  {
    // ══ 25-N §4 — COST AND DURATION, WHICH WAS MISSING ENTIRELY ════════════════
    //
    // ⚠⚠ THE PLATFORM HAS ALWAYS COSTED THINGS AND NEVER FILED THE ANSWER ANYWHERE THE USER
    // LOOKS. `CostLine` rows hang off the actions in the middle column and the proposal
    // document prints "Cost against the cost of the problem" — but the research panel, which
    // is where a user goes to ask "what would this cost and how long would it take", had no
    // heading for it at all. §4: *"Cost and duration is missing entirely. It belongs in this
    // contents list."*
    //
    // ⚠ IT SITS DIRECTLY AFTER `HOW_HARD` BECAUSE THEY ARE THE SAME QUESTION SPLIT IN TWO —
    // what stands in the way, and what it would take. §4's own order puts HOW_HARD third,
    // above the divider, with the money beside it.
    //
    // ⚠ AND ITS CAVEAT IS PART OF THE HEADING, NOT A FOOTNOTE. §4 is explicit that this is a
    // *"purely financial view excluding human costs and benefits"*, and a costing that does
    // not say so is a costing that will be quoted as though it were the whole answer.
    key: 'COST_DURATION',
    heading: 'Cost and duration',
    lookingFor:
      'what implementing this would cost, over what period, what it would save or return, and '
      + 'the assumptions each figure rests on — a purely financial view, which leaves out the '
      + 'human costs and benefits entirely',
  },
  {
    // 25-L §3b — "Key sources". The critique is the only step that has read everything at
    // once, so its ordering of what to read first is the one worth showing; the
    // deterministic ranker in `build-highlights.ts` handles the rest.
    key: 'KEY_SOURCES',
    heading: 'Key sources',
    lookingFor: 'the two or three things worth reading before anything else, and why each one',
  },
  {
    key: 'YOUR_MATERIAL',
    heading: 'Your material',
    lookingFor: 'the documents and links you brought to this',
  },
]

/**
 * ══ 25-N §4 — "THE STRONGEST CASE AGAINST" IS DELETED, AND ITS ROWS ARE NOT ═════
 *
 * §4: *"Delete 'The strongest case against'. Neither example under it was a case against; the
 * good material belongs in Challenges or Who has argued about this."*
 *
 * ⚠⚠ THE HEADING GOES; THE KEY STAYS IN THE TYPE. `EvidenceItem.headingKey` holds the string
 * `'AGAINST'` on every row the adversarial pass has ever written, and `heading-map.ts`'s
 * first rule is that the stored tag always wins. Removing the key from the union would make
 * `isHeadingKey('AGAINST')` false, `resolveHeading` return null, and every one of those rows
 * would silently become "not filed under a question" — the material §4 is trying to keep,
 * deleted by the change meant to relocate it.
 *
 * ⚠ SO IT IS A REDIRECT, NOT A DELETION. `AGAINST` resolves to `ARGUED` — §4's own second
 * destination, and the one that is a panel heading (Challenges is a different mechanism
 * entirely: `agenda.challenges`, rendered in the middle column, which §0 says must not be
 * disturbed). Reading applies the redirect, so nothing needs migrating for the panel to be
 * right; `prisma/lex_25n_backfill_against.sql` repoints the stored rows as well, so the two
 * cannot drift once it is run.
 *
 * ⚠ AND `RETIRED_HEADINGS` IS EXPORTED so a check can assert the pair of properties that
 * matter: a retired key never appears in `HEADING_ORDER`, and every retired key has a
 * destination in `HEADING_REDIRECTS`. A key retired without a destination is a silent hole.
 */
export const HEADING_REDIRECTS: Partial<Record<string, HeadingKey>> = {
  AGAINST: 'ARGUED',
}

export const RETIRED_HEADINGS: string[] = Object.keys(HEADING_REDIRECTS)

/**
 * ⚠ 25-N §4 — THE ORDER IS CHARLIE'S, AND IT IS NOT THE ORDER OF `QUESTION_HEADINGS`.
 *
 * §4 states it exactly: **Decisions · Outputs · How hard will this be to achieve? · divider ·
 * Inputs · everything else · anything "not asked of this draft" at the bottom.** Decisions,
 * Outputs and the two Inputs items are not question headings — they are special items the
 * panel adds — so what this array holds is the heading half: `HOW_HARD` first, above the
 * divider, then everything else in the settled-to-contested order 25-D established.
 *
 * ⚠ COST_DURATION RIDES WITH HOW_HARD rather than sinking into "everything else". They are
 * the two halves of "can this actually be done", and §4 puts that question above the fold.
 */
const ABOVE_THE_DIVIDER: HeadingKey[] = ['HOW_HARD', 'COST_DURATION']

export const HEADING_ORDER: HeadingKey[] = [
  ...ABOVE_THE_DIVIDER,
  ...QUESTION_HEADINGS.map((h) => h.key).filter((k) => !ABOVE_THE_DIVIDER.includes(k)),
]

/** Which headings sit above §4's divider — the panel draws the rule after these. */
export const HEADINGS_ABOVE_DIVIDER: HeadingKey[] = ABOVE_THE_DIVIDER

const BY_KEY = new Map(QUESTION_HEADINGS.map((h) => [h.key, h]))

export function headingFor(key: string | null | undefined): QuestionHeading | undefined {
  if (!key) return undefined
  // 25-N §4 — a retired key resolves to its destination, so a stored `AGAINST` row reads as
  // "Who has argued about this" rather than as an unknown heading.
  const live = HEADING_REDIRECTS[key] ?? key
  return BY_KEY.get(live as HeadingKey)
}

/**
 * 25-N §4 — the live heading a stored key means. Identity for a live key, the destination for
 * a retired one, null for something we have never heard of.
 *
 * ⚠ EVERY READER GOES THROUGH THIS. `resolveHeading`, the panel builder and the document
 * stack each used to compare against the raw string; a redirect applied in two of three places
 * is a redirect that puts the same finding under two headings.
 */
export function liveHeading(key: string | null | undefined): HeadingKey | null {
  if (!key) return null
  const live = HEADING_REDIRECTS[key] ?? key
  return BY_KEY.has(live as HeadingKey) ? (live as HeadingKey) : null
}

/**
 * ⚠ TAKES `unknown` ON PURPOSE. Its most important caller validates a heading key that came
 * back from a MODEL, and a guard typed to `string` would have to be given a cast to be
 * called there — which is the cast doing the guarding's job badly. Accepting `unknown` means
 * the only way past this function is to actually be a heading key.
 */
export function isHeadingKey(key: unknown): key is HeadingKey {
  if (typeof key !== 'string') return false
  // ⚠ 25-N §4 — A RETIRED KEY IS STILL A VALID STORED KEY. Rejecting `AGAINST` here would
  // make `resolveHeading` return null for every row the adversarial pass has ever written.
  return BY_KEY.has(key as HeadingKey) || key in HEADING_REDIRECTS
}

/**
 * Why a heading is empty. Four states, never one sentence — see the file header.
 */
export type EmptyReason =
  | 'asked-found-nothing'
  | 'not-asked'
  | 'no-producer'
  /**
   * ⚠ A FOURTH REASON, AND IT IS THE ONLY ONE THAT IS NOT A GAP. "Your material" is empty
   * because the user has not added anything — there is nothing missing and nobody failed.
   * Folding it into `not-asked` would tell them their own documents "weren't asked of the
   * draft", which is meaningless, and would put an apology where an invitation belongs.
   */
  | 'nothing-added'

/**
 * ⚠ HEADINGS NOTHING IN THIS BUILD CAN ANSWER, NAMED HERE RATHER THAN LEFT TO BE INFERRED
 * FROM AN EMPTY LIST.
 *
 * `POSITIONS` is the whole list today. The position graph holds 2.3M signals about how
 * members have voted and what they have declared, and NOTHING IN LEX READS IT — §25.8 item
 * 6: "POSITION depends on the people-graph reaching `holds-position`, which the graph
 * thread notes is what everything user-facing waits on." Reporting that as "we looked and
 * found nothing" would be a false statement about the record, and a flattering one about
 * us. It is our gap and it says so.
 *
 * ⚠ AN ENTRY HERE IS A PROMISE TO REMOVE IT. When a producer starts writing findings under
 * a heading, its key comes out of this list in the same commit — the check asserts that a
 * heading cannot both be declared unbuildable AND carry findings, because that combination
 * would tell the user their evidence does not exist while showing it to them.
 */
/**
 * ⚠⚠ 26-A §3 — `POSITIONS` HAS COME OUT OF THIS LIST, AND THE RULE ABOVE IS WHY.
 *
 * *"An entry here is a promise to remove it. When a producer starts writing findings under a
 * heading, its key comes out of this list in the same commit."* Positions are now filed under
 * it (SURFACE 3 §2 — a route and a script, `positions:file`), so the promise falls due.
 *
 * ⚠ The Surface-3 session found this and correctly did not touch it: the file is Lex-owned and
 * their note said the sentence *"stays literally true (no pass does)"* while being misleading.
 * That is the sharpest possible description of the defect — a caveat can be true word by word
 * and still tell the reader the opposite of the truth. Its replacement is computed from the
 * rows (`positions-caveat.ts`) rather than written down, so it cannot outlive its own truth
 * the same way.
 */
export const HEADINGS_WITH_NO_PRODUCER: HeadingKey[] = ['COST_DURATION']

export const NO_PRODUCER_NOTE: Record<string, string> = {
  // ══ 25-N §4 — THE COSTING HEADING EXISTS BEFORE THE COSTING PASS DOES ═══════════
  //
  // ⚠ AND THAT IS THE POINT, NOT A SHORTCUT. §4 says cost and duration *"is missing entirely"*
  // — the user had nowhere to look and no statement that we could not answer. A heading that
  // says "we cannot do this yet, and here is what is on the row instead" is strictly better
  // than silence: it tells them the question is a real one and that we know we owe them an
  // answer. §4's caveat is in the sentence because a costing quoted without it is a costing
  // that will be read as the whole picture.
  COST_DURATION:
    'No pass costs this yet — nothing in the build works out what implementing your proposal '
    + 'would cost, over what period, or what it would return. What figures exist are the cost '
    + 'lines you and Lex have put on individual actions, in DRAFT STRATEGY, and each carries its '
    + 'own assumptions. Read them as a purely financial view: they leave out the human costs and '
    + 'benefits entirely, and where the kernel is still unsettled the figures rest on a draft.',
  // ⚠⚠ 26-A §3 — THE `POSITIONS` NOTE IS DELETED, NOT REWRITTEN AGAIN.
  //
  // It has now been wrong twice in two different ways: 25-L rewrote it when half of it stopped
  // being true, and by 3 September the rewrite was misleading too — it said no pass writes
  // findings here, which stayed literally true (a route and a script do) while positions were
  // appearing under the heading.
  //
  // A third rewrite would be a third sentence waiting to go stale. What replaces it is
  // `positionsCaveat`, computed from the rows on every render, which says how many items are
  // there and how many came from the proposer's own documents. A caveat that counts cannot
  // drift from what it describes.
}

/**
 * The sentence a heading shows when it has nothing under it.
 *
 * ⚠ IT NAMES WHAT WAS LOOKED FOR, not just that nothing was found. "Nothing found" leaves
 * the user unable to judge whether the search was any good; "we looked for judgments
 * construing the provisions this turns on, and found none" is something they can act on —
 * they can tell us we looked for the wrong thing.
 */
export function statedGap(key: HeadingKey, reason: EmptyReason, detail?: string): string {
  const h = BY_KEY.get(key)
  const looked = h?.lookingFor ?? 'this'
  switch (reason) {
    case 'no-producer':
      return NO_PRODUCER_NOTE[key] ?? `Nothing in this build can answer this yet — a limit in our tooling, not an absence of evidence.`
    case 'not-asked':
      return detail
        ? `This wasn’t asked of your draft — ${detail}. So there is nothing here, and that is not the same as nothing existing.`
        : `This wasn’t asked of your draft, so there is nothing here — which is not the same as nothing existing.`
    case 'asked-found-nothing':
      return `We looked for ${looked}, and found nothing. That is a gap in what we could retrieve, not a statement about what exists.`
    case 'nothing-added':
      return 'Nothing added yet. A document or a link you add here is read once into findings, '
        + 'filed under the question it answers, and marked as yours — the file itself is never stored.'
  }
}
