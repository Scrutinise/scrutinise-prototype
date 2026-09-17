// ─────────────────────────────────────────────────────────────────────────────
// PILOT FEEDBACK (Angus Barry, 16 Sep 2026) — THE BRIEFING HAS A NAME, AND A CAVEAT.
//
// He told us the background briefing was the most valuable thing in the product and he
// could not find it: on the Documents tab it was the small print under a card headed
// "Downloads". So the document has a name of its own, and the name is ONE constant used by
// the card on the Documents tab, the card under the panel, and the title inside the file —
// so the thing a user downloads is called what the tab called it.
//
// ⚠ NO SERVER IMPORTS IN THIS FILE. `DocumentExports.tsx` is a client component and reads
// the name from here; the builder (which reads Prisma) imports it too. Keep it that way.
//
// ⚠ THE CAVEAT IS CHARLIE'S COPY, VERBATIM (second wording, 17 Sep 2026). Do not paraphrase
// it in place; change the brief, then change this. The first wording promised the list would
// refine "as you work through the questions and decisions" — it does not: the list is refreshed
// ONLY by a build (ORIENT writes `legislationRefs` and the Document row), so the sentence now
// says what actually happens: add what you know, re-run, and the next pass searches on it.
// It is the first thing in the document, before the beta disclosure and before the briefing.
//
// ⚠ It is honest for a first build and becomes wrong for a tenth — "a first pass" on a list
// that has been rebuilt nine times. How to handle that is Charlie's choice and is written up
// in docs/handoff_summary.md (LEX thread, this entry); nothing here decides it. Until he
// does, the sentence stands as written and the provenance line beside it ("Generated … from
// … corpus search of …") is the reader's dating.
// ─────────────────────────────────────────────────────────────────────────────

/** The document's own name — on the tab, on the card, and as the file's title. */
export const INITIAL_BACKGROUND_NAME = 'Initial Background Briefing'

/** What it is, in one line, under the name — so the card is recognisable before the buttons. */
export const INITIAL_BACKGROUND_BLURB =
  'The first list of legislation, debates, reports and cases that may bear on this idea, with the '
  + 'sources it was drawn from. A Word document and a PDF.'

/** The first sentence is set in bold; the split is at the first full stop. */
export const FIRST_PASS_CAVEAT =
  'A first pass, and a limited one. This is an early list of legislation that may be relevant, based on '
  + 'what you have told us so far. The more you tell us, the better it gets — add what you know, then re-run, '
  + 'and the next pass searches on everything you have given us since.'

/**
 * The briefing is FROZEN (item 1, 17 Sep 2026): a snapshot of one build's first pass, never
 * re-searched by regeneration. The live view is the research panel. Printed under the caveat.
 * `{build}` is replaced by the build stamp at render time.
 */
export const BRIEFING_STATIC_LABEL =
  'This is a record of what Lex found in the first pass of {build}, frozen at that point. '
  + 'Regenerating this document re-renders the same material; it does not search again. The live '
  + 'view of the research is the research panel on the idea, and a re-run replaces this with the '
  + 'next build’s first pass.'

/** The companion document — everything the same build needs from the user. */
export const INITIAL_QUESTIONS_NAME = 'Initial Questions'

export const INITIAL_QUESTIONS_BLURB =
  'Everything the first pass needs from you — decisions waiting, choices between causes and '
  + 'approaches, what the record could not answer, what only you know, and challenges to answer. '
  + 'Each says what would settle it. A Word document and a PDF.'

/** First block of the Initial Questions document; first sentence bold. */
export const INITIAL_QUESTIONS_OPENING =
  'Here is what we need from you. The briefing beside this is what Lex found; this is what the '
  + 'same pass could not settle without you — grouped, with what would settle each one. Work '
  + 'through it in the panel, and re-run when you have added what you know.'
