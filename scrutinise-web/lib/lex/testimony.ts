// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-F §5 — THE USER'S TESTIMONY, IN EVERY PASS THAT DRAFTS OR JUDGES.
//
// ⚠ THE BRIEF'S PREMISE IS HALF RIGHT, AND THE HALF IT GETS WRONG IS WHERE THE FIX GOES.
//
// §5 says "the user's testimony reaches one field, not the kernel". Measured against the
// code: under framing arm B — the default, and the arm Charlie's build ran —
// `frameQuery()` already puts the problem, the goal, the ruled-outs, the own-knowledge and
// the profile into `promptBlock`, and `promptBlock` is handed to ORIENT, DIAGNOSIS,
// APPROACH, ACTIONS and REVISE. The testimony was in front of five of the seven passes.
//
// TWO THINGS WERE ACTUALLY WRONG, and both are why it only surfaced in `legalLandscape`:
//
//  1. THE ONLY INSTRUCTION ATTACHED TO IT WAS A PROHIBITION. Every prompt said "never
//     present it as a retrieved source or attach a citation to it" and nothing said USE
//     IT. A model told what it may not do with a block of text, and nothing about what it
//     is for, reliably does nothing with it. `legalLandscape` was the exception because
//     the orient prompt asks a question the testimony directly answers.
//  2. IT NEVER REACHED PASSES 3 OR 5 AT ALL. `draftFactsFor()` builds its `text` from the
//     persisted Idea columns and the carry — the user's own sentences are in neither — so
//     the sift, the gather and the hostile clerk have never seen a word of it. The sift is
//     the worst of the three: it decides which of a hundred retrieved documents bear on
//     the proposal, without the first-hand account of what the proposal is about.
//
// ⚠ THE NEVER-CLAIM RULE IS UNCHANGED AND IS RESTATED HERE RATHER THAN RELAXED. Testimony
// is evidence — the strongest evidence in the file about what actually happens — and it is
// NOT a retrieved source. It may be quoted, relied on and attributed to the user by name.
// It may never carry a citation. The two sentences travel together, always, because
// splitting them is how one of them gets lost.
// ─────────────────────────────────────────────────────────────────────────────

import type { ElicitationContext } from './elicitation'

/**
 * The instruction that travels with the testimony wherever it goes.
 *
 * ⚠ POSITIVE FIRST, PROHIBITION SECOND. That order is the fix: the previous version was
 * the prohibition alone, and a model given only a prohibition leaves the material alone.
 */
export const TESTIMONY_INSTRUCTION = [
  'THE USER\'S OWN ACCOUNT IS FIRST-HAND EVIDENCE, AND IT IS THE ONE KIND OF EVIDENCE THE RECORD DOES',
  'NOT CONTAIN. Where it is given to you below, it is there to be USED:',
  '  · A CONCRETE INSTANCE BEATS AN ABSTRACTION WHEREVER IT FITS. "Four years to do what a private',
  '    solicitor did in an afternoon" is a better cause than "processes are inefficient", and a',
  '    diagnosis that can cite what actually happened to someone is a better diagnosis than one that',
  '    restates the problem in more general words.',
  '  · LET IT SHAPE THE DIAGNOSIS, not just decorate it. If their account points at a different cause',
  '    from the one the documents suggest, that is a finding, and it belongs in the draft.',
  '  · ATTRIBUTE IT. Say "the proposer reports…", "on their account…", "they describe…". The reader has',
  '    to be able to tell what came from the record and what came from the person.',
  '  · Do not launder it into the passive voice. "It is said that delays occur" erases the one witness',
  '    you have.',
  '',
  '⚠ AND IT IS NEVER A CITATION. Testimony is not a retrieved source: do not give it an `id`, do not',
  'attach a citation to it, and do not count it among the documents you cite. Rely on it, name whose it',
  'is, and keep it distinct from the record. Both halves of this rule matter — using it without',
  'attribution and refusing to use it at all are both failures.',
].join('\n')

/**
 * The testimony itself, labelled, or '' when the user gave none.
 *
 * ⚠ VERBATIM AND UNSUMMARISED, up to the cap. §2a's rule for the smart pass is the rule
 * everywhere: a ten-word mashup of someone's account is not their account.
 */
export function testimonyBlock(ctx: ElicitationContext, cap = 6000): string {
  const parts: string[] = []
  if (ctx.problem?.trim()) {
    parts.push(`THE PROBLEM, IN THE PROPOSER'S OWN WORDS (verbatim):\n${ctx.problem.trim().slice(0, cap)}`)
  }
  if (ctx.ownKnowledge?.trim()) {
    parts.push(
      'WHAT THE PROPOSER KNOWS AT FIRST HAND (verbatim — this is testimony, not a retrieved source):\n'
      + ctx.ownKnowledge.trim().slice(0, cap),
    )
  }
  if (ctx.goalDetail?.trim()) {
    parts.push(`WHAT THEY WANT TO HAPPEN (${ctx.goalKindLabel}):\n${ctx.goalDetail.trim().slice(0, 2500)}`)
  }
  if (ctx.ruledOut?.trim()) {
    parts.push(`WHAT THEY HAVE ALREADY RULED OUT (do not propose these):\n${ctx.ruledOut.trim().slice(0, 2500)}`)
  }
  if (ctx.aboutYou?.trim()) {
    parts.push(`ABOUT THE PROPOSER: ${ctx.aboutYou.trim().slice(0, 1500)}`)
  }
  return parts.join('\n\n')
}

/** The block plus its instruction — what a prompt appends when it wants both. */
export function testimonyForPrompt(ctx: ElicitationContext, cap = 6000): string {
  const block = testimonyBlock(ctx, cap)
  if (!block) return ''
  return `${TESTIMONY_INSTRUCTION}\n\n${block}`
}

/**
 * The testimony as a plain string for the two consumers that take an `idea` blob rather
 * than a prompt: the sift and the gather (`build-research.ts`).
 *
 * ⚠ IT IS APPENDED TO THE DRAFTED KERNEL, NOT SUBSTITUTED FOR IT. The sift judges a
 * candidate against what the proposal IS; taking away the drafted kernel to make room for
 * the testimony would trade one blind spot for another.
 */
export function testimonyForFacts(ctx: ElicitationContext | null, cap = 3000): string {
  if (!ctx) return ''
  const block = testimonyBlock(ctx, cap)
  if (!block) return ''
  return [
    '',
    '── THE PROPOSER\'S OWN ACCOUNT (first-hand testimony, not a retrieved source; never cite it) ──',
    block,
  ].join('\n')
}

/**
 * Did a piece of drafted text actually draw on the testimony?
 *
 * ⚠ A DELIBERATELY CRUDE TEST, AND ITS LIMITS ARE THE POINT. It looks for distinctive
 * multi-word phrases from the user's account appearing in the draft, plus the attribution
 * verbs the instruction asks for. It CANNOT tell whether a passage was genuinely informed
 * by the testimony — only whether it shows the marks of having been. That is enough for
 * what it is for: `check:lex-25f` asserts the mechanism carries the testimony to each
 * pass, and this reports, per field, whether the output bears any trace of it. A report
 * that says "no field referenced the proposer" is worth having; a claim that the testimony
 * "was used" would not be.
 */
export function bearsTestimonyMarks(text: string): boolean {
  if (!text?.trim()) return false
  return /\b(the proposer|on their account|they describe|they report|they say|in their own words|their account|the user reports|the user describes)\b/i
    .test(text)
}
