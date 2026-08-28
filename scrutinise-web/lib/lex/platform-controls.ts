// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-K §2 — WHERE A USER ASKS FOR SOMETHING THE PLATFORM DOES, LEX SAYS WHERE THE
// CONTROL IS.
//
// ⚠⚠ THE SENTENCE THIS EXISTS TO REPLACE, VERBATIM, FROM THE LIVE PRODUCT:
//
//     "I can't rerun the whole project from here, as the platform manages those stages."
//
// True, unhelpful, and a dead end. The re-run control was on a screen the user had left,
// at the bottom of it, behind two conditions — and Lex, correctly told that it does not
// drive the mechanics, answered with the half of the truth that helps nobody.
//
// ⚠ THE RULE IS NOT "SAY YES". Lex genuinely cannot re-run a build, advance a stage or
// search the corpus on its own; claiming otherwise would be the never-claim failure, which
// is worse. The rule is that a refusal must carry DIRECTIONS: what the control is called,
// which stage it is on, and what pressing it does. A user who is told "I can't" and nothing
// else concludes the platform cannot, and stops.
//
// ⚠ IT IS A LIST OF CONTROLS THAT EXIST, and it must stay one. Every entry below is a
// control on a screen today; `check:lex-25k` asserts each named stage comes from
// `LEX_STAGES` so a renamed stage cannot leave Lex directing users to a place with a
// different name on the door. Adding a line here for a control that does not exist would
// turn this file from a map into a fabrication.
// ─────────────────────────────────────────────────────────────────────────────

import { LEX_STAGES } from './stages'

const s1 = LEX_STAGES[0]
const s2 = LEX_STAGES[1]
const s3 = LEX_STAGES[2]

/**
 * The block injected into the idea-chat system prompt.
 *
 * ⚠ Built from `LEX_STAGES`, not typed out. The names on the screen and the names in
 * Lex's directions have to be the same words, and the only way to guarantee that is for
 * them to be the same string.
 */
export const PLATFORM_CONTROLS = `WHERE THE CONTROLS ARE (the user's work has three stages, and each has its own screen)
- Stage ${s1.n}, ${s1.name}: ${s1.purpose} The re-run control is on that screen, under "Re-run", and it offers two: "Redraft from what I found", which reuses the research already gathered, and "Search again from scratch", which reads the corpus again. Files and links are added there too, with the "+" beside the box you type in.
- Stage ${s2.n}, ${s2.name}: ${s2.purpose} The list of what to do next is the top of the left-hand column; the draft is the middle column; the findings, filed under the questions they answer, are on the right.
- Stage ${s3.n}, ${s3.name}: ${s3.purpose} Each pass is run from its own row on that screen.
- Moving between the three is free in both directions, from the stage indicator at the top of every screen. Nothing is locked.

ASKED TO DO SOMETHING THE PLATFORM CONTROLS: say where the control is, in one sentence, and what pressing it will do — never a bare "I can't". You do not run builds, re-runs, deepening passes or stage moves yourself, and you must not claim to; but "I can't do that from here" on its own is a dead end, and the user is then stuck holding a request the product can actually satisfy. Name the stage, name the control as it is labelled on screen, and say what it does. If you genuinely do not know where a control is, say that instead of guessing at a label.`

/**
 * The one-line version, for prompts with no room for the block.
 *
 * ⚠ It carries the RULE, not the map. A short prompt that included half the control list
 * would send users to the two controls that fitted and leave the rest looking impossible.
 */
export const PLATFORM_CONTROLS_SHORT =
  'If the user asks you to do something the platform controls (re-run a build, run a deepening '
  + 'pass, move stage), do not stop at "I can’t" — say which stage the control is on and what it '
  + 'is called, or say plainly that you do not know where it is.'
