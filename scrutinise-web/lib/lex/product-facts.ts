// ─────────────────────────────────────────────────────────────────────────────
// 25-Q §6 — THE OPERATING FACTS, IN ONE PLACE, FOR BOTH READERS.
//
// Charlie asked Lex on mobile how to see the middle panel and got a description of what the
// panel CONTAINS rather than how to reach it. Lex knew the vocabulary — 25-K and 25-N spent two
// sprints making the names agree — and knew nothing about operating the thing.
//
// ⚠⚠ §6's REAL INSTRUCTION IS THE LAST CLAUSE: *"Sourced from one place that is also what 'How
// this works' renders, so the two cannot drift apart."* A second copy of "the middle panel is
// called DRAFT STRATEGY" inside a prompt is a copy that will be right today and wrong after the
// next rename — and the rename is not hypothetical: it has already happened twice (25-K §1, 25-N
// §2), and the tour was named both times as the last place a retired word could survive.
//
// So: this file is the source, `HowItWorksModal` renders it, and `productFactsBlock()` puts the
// same sentences in the prompt. One edit changes both.
//
// ⚠ IT IS PROSE ABOUT OPERATING THE PRODUCT, NOT ABOUT THE USER'S IDEA. Nothing here is a claim
// about a proposal, a source or a figure, so it does not belong in the facts block that governs
// what Lex may assert about the record — a block whose whole discipline is "only what was
// retrieved". Keeping them apart keeps that discipline intact.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductFact {
  /** What a user would ask. Used as the heading in the tour and the cue in the prompt. */
  question: string
  /** The answer, in the product's own vocabulary. */
  answer: string
}

/**
 * ⚠ WRITTEN AS ANSWERS TO QUESTIONS SOMEBODY ACTUALLY ASKS. A list of features produces
 * exactly the failure Charlie hit — a description of what a panel contains, offered to
 * somebody who asked how to get to it.
 */
export const PRODUCT_FACTS: ProductFact[] = [
  {
    question: 'How do I see the middle panel?',
    answer:
      'On a wide screen all three panels are side by side: WORKING AREA on the left, DRAFT STRATEGY '
      + 'in the middle, THE RESEARCH on the right. If one is hidden, press its name in the strip at '
      + 'the top to bring it back, and drag the divider between two panels to change how much room '
      + 'each gets. On a phone or a narrow window they become three tabs across the top with the '
      + 'same three names — press DRAFT STRATEGY to see the middle one.',
  },
  {
    question: 'What are the three panels for?',
    answer:
      'THE RESEARCH on the right is raw material — everything I found or worked out. DRAFT STRATEGY '
      + 'in the middle is the report itself, and nothing arrives there until you put it there. '
      + 'WORKING AREA on the left is yours: the worklist of what to read and what to decide, with '
      + 'the chat under it.',
  },
  {
    question: 'What are the stages?',
    answer:
      'Three. THE IDEA is four questions in your own words, and I read back what I understood before '
      + 'anything is built. THE STRATEGY is the draft I build from that — the problem, its causes, '
      + 'the guiding policy and the actions — which you argue with and change. THE DEEPENING is the '
      + 'harder research that follows, once the strategy is settled enough to be worth testing. You '
      + 'can move backwards and forwards between them freely.',
  },
  {
    question: 'What does a build cost, and what is my allowance?',
    answer:
      'A full build searches the record from scratch and costs three of your credits. A re-run that '
      + 'reuses the research already gathered costs one. The pilot allowance is twelve, so that is '
      + 'four full builds, or three full builds and three re-runs, or twelve re-runs. The line beside '
      + 'the button always says what you have left. Nothing you have written is ever lost when the '
      + 'allowance runs out.',
  },
  {
    question: 'Where do my notes go, and who can see them?',
    answer:
      'Notes are the second tab in the WORKING AREA, beside the chat. They are private to you — not '
      + 'to the idea. Nobody else on the idea can see them, they never reach a collaborator, and '
      + 'nothing in them goes into the report unless you put it there yourself.',
  },
  {
    question: 'What does "Add to report" do?',
    answer:
      'It marks something in THE RESEARCH as one of the sources the proposal itself rests on. It '
      + 'appears in DRAFT STRATEGY under "What you have put in the report", and it goes into the '
      + 'generated document rather than only the evidence annex. It is reversible — "Remove from '
      + 'report" is on the same card.',
  },
  {
    question: 'Can you change the draft for me?',
    answer:
      'Yes, for the text. Ask me to rewrite a box or one of the numbered candidate approaches and I '
      + 'will show you the rewrite with a button that puts it in. Nothing changes until you press it, '
      + 'and what was there before is kept.',
  },
  {
    question: 'How do I re-run the build?',
    answer:
      'On THE IDEA stage, at the top of the page: there is a re-run control, a box for anything else '
      + 'you want me to take into account, and somewhere to add a file or a link. If a run is already '
      + 'going, a strip across the top says so and how far through it is.',
  },
]

/**
 * The prompt form. ⚠ VERBATIM FROM THE SAME ARRAY — a paraphrase here would be the second copy
 * this file exists to prevent, written by the person who was trying to prevent it.
 */
export function productFactsBlock(): string {
  return [
    'HOW THIS PRODUCT WORKS — the operating facts.',
    'Use these when the user asks how to DO something or where something IS. Answer with the',
    'steps, not with a description of what the thing contains: "how do I see the middle panel"',
    'is a question about navigation and is answered by saying which control to press.',
    'These are the only operating claims you may make. If a question about the product is not',
    'covered here, say you are not sure rather than describing what you would expect.',
    '',
    ...PRODUCT_FACTS.map((f) => `Q: ${f.question}\nA: ${f.answer}`),
  ].join('\n')
}
