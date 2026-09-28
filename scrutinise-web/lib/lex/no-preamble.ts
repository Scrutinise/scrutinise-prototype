// ─────────────────────────────────────────────────────────────────────────────
// 26-I §8 — THE FLATTERY GOES.
//
// "Prompt rule, every Lex turn, everywhere: no evaluative preamble about the user's
// question or their thinking. Not 'That's a very astute observation', not 'That's an
// excellent way to think about it'. Answer, or challenge."
//
// ⚠ ONE INSTRUCTION, IMPORTED, NOT COPIED (docs/CLAUDE.md §24.1's own rule, applied here):
// every prompt-building site that speaks as Lex imports `NO_EVALUATIVE_PREAMBLE` rather
// than re-typing it, so the wording — and any future correction to it — has one home.
//
// There is no single chokepoint every Lex reply passes through (confirmed: `lex-client.ts`
// alone has five independent call sites, plus `general-chat.ts` and the three Deepening
// passes) — see docs/CHANGE_LOG.md's 26-I entry for the full list and which of them this
// pass reaches. `hasEvaluativePreamble` below is the detector `scripts/check-lex-no-preamble.ts`
// (§8a) runs against real stored output, per docs/CLAUDE.md §25: asserting the instruction
// is IN a prompt proves nothing about what came back.
// ─────────────────────────────────────────────────────────────────────────────

export const NO_EVALUATIVE_PREAMBLE = [
  'NEVER open with evaluative preamble about the user\'s question or their thinking — not',
  '"That\'s a very astute observation", not "That\'s an excellent way to think about it", not',
  '"Great question". A barrister\'s opinion opens with the answer. Answer, or challenge —',
  'never compliment the user before scrutinising them.',
].join('\n')

/**
 * The phrase list `check:lex-no-preamble` tests real output against (§8a: "report which
 * phrases the check catches"). Deliberately narrow and literal rather than a broad
 * sentiment classifier — a false positive here would flag a genuinely earned "that's
 * right" mid-answer, which is not what §8 is about.
 */
export const EVALUATIVE_OPENER_PATTERNS: RegExp[] = [
  /^\s*that'?s\s+(a\s+)?(very\s+|really\s+)?(astute|excellent|great|fascinating|insightful|thoughtful|interesting|good)\b/i,
  /^\s*(what\s+a\s+|that\s+is\s+)?(great|excellent|astute|fascinating|insightful)\s+(question|point|observation|way\s+to\s+think)\b/i,
  /^\s*great\s+question\b/i,
  /^\s*(i\s+)?love\s+(this|that)\s+(question|idea|approach)\b/i,
  /^\s*what\s+a\s+(good|great|smart)\s+way\s+to\s+(think|frame|put)\b/i,
]

export interface PreambleCheck {
  matched: boolean
  phrase?: string
}

/** Tests the OPENING of a reply — §8's rule is about preamble, not a phrase used honestly
 *  mid-answer ("that's the right instinct, but here's why it fails" is scrutiny, not flattery). */
export function hasEvaluativePreamble(text: string): PreambleCheck {
  const opening = (text || '').trim().slice(0, 200)
  for (const re of EVALUATIVE_OPENER_PATTERNS) {
    const m = opening.match(re)
    if (m) return { matched: true, phrase: m[0].trim() }
  }
  return { matched: false }
}

/**
 * ══ 26-L §5 — STRUCTURAL, NOT PROMPT-ONLY ══════════════════════════════════════════════
 *
 * §5: two real examples survived AFTER the no-preamble prompt rule shipped in 26-I — *"That's
 * excellent feedback, Charlie"* and *"That's a very pertinent question, Charlie."* ⚠⚠ Until
 * this, `hasEvaluativePreamble` was called ONLY by `scripts/check-lex-no-preamble.ts` — an
 * offline audit against stored output, never in the path a reply travels before a user sees it.
 * A detector nobody calls before display is a detector that can only ever report a failure
 * after the fact, which is exactly the shape this brief is about.
 *
 * ⚠ STRIP, NOT REGENERATE. The brief allows either; stripping is deterministic, free, and does
 * not risk a second model call producing a different failure (§18's family: a degradation must
 * announce itself, not hide behind a retry that might not fix anything). Removing the matched
 * opening clause and its trailing punctuation/space leaves the substantive answer intact — the
 * preamble was never the content, by definition of what "preamble" means here.
 */
export function enforceNoPreamble(text: string): string {
  const t = (text || '')
  const check = hasEvaluativePreamble(t)
  if (!check.matched || !check.phrase) return t
  const trimmed = t.trim()
  // Cut the matched phrase off the front, then any immediately-following punctuation/space
  // ("That's a great question. " / "That's a great question — ") so the sentence that follows
  // reads as an opening line, not a fragment.
  const rest = trimmed.slice(check.phrase.length).replace(/^[\s,.:;—–-]+/, '')
  const stripped = rest || trimmed
  console.warn('[no-preamble] evaluative opener stripped before display', { phrase: check.phrase })
  // Capitalise the new first letter so the remainder still reads as a sentence.
  return stripped.length > 1 ? stripped[0].toUpperCase() + stripped.slice(1) : stripped.toUpperCase()
}
