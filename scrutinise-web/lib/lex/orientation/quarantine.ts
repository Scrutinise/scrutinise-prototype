// ─────────────────────────────────────────────────────────────────────────────
// §6d.3 / §6d.4 — QUARANTINE. The hard rule of this whole layer.
//
//   X output is NEVER a fact source. It is presented as what is CIRCULATING,
//   attributed and dated — not as "public opinion" (X sampling is skewed) and
//   never as evidence for a legal or empirical claim. Any factual assertion
//   found inside an X argument must be corroborated by corpus (Tier A) or web
//   (Tier B) before Lex may state it.
//
// This file exists because a rule that lives only in a prompt is a rule that
// will eventually be broken silently. Here it is mechanical:
//
//   · renderTierC() is the ONLY way Tier C text reaches a briefing, and it
//     cannot emit a line without the marker, the attribution and the date.
//   · assertQuarantine() then re-reads the FINISHED text and proves it — every
//     occurrence of every Tier C string must sit on a marked line, and no Tier C
//     string may appear in the summary at all.
//   · The renderer runs that check on its own output and DROPS the Tier C block
//     if it fails. Fail-closed: a briefing with no circulating-arguments section
//     is a small loss; a briefing stating a tweet as fact is the failure this
//     layer must never produce.
//
// The check is deliberately a text sweep rather than a structural assertion:
// structure can be refactored into a bug, and the thing we actually care about
// is what the user reads.
// ─────────────────────────────────────────────────────────────────────────────

import type { OrientationResult, Tier } from './types'
import { allItems } from './types'

/** The visible marker. Every Tier C line carries it verbatim. Deliberately plain
 *  markdown: the docx/PDF exporter (`lib/documents/markdown.ts`) supports
 *  headings, bullets, bold, italic and links — and NOT blockquotes, so a `>`
 *  rail would survive on screen and turn into a stray "> " in the exported file.
 *  Bold inline text renders in all three places. */
export const TIER_C_MARK = '[Tier C — circulating on X · not a fact source]'
export const TIER_B_MARK = '[Tier B — web background]'

export const TIER_C_EXPLAINER =
  '_Tier C is what is being said on X: attributed and dated, shown so you can see the argument being made. ' +
  'It is not evidence, and it is not a measure of public opinion — X is a skewed sample. ' +
  'Nothing here should be repeated as fact unless the corpus or a Tier B source also supports it._'

export function tierMark(tier: Tier): string {
  return tier === 'C' ? TIER_C_MARK : tier === 'B' ? TIER_B_MARK : ''
}

export interface QuarantineViolation {
  kind: 'unmarked-line' | 'in-summary'
  text: string
  line?: string
}

/**
 * Prove the quarantine on finished text. Pass/fail, not a judgement call.
 *
 * Returns every violation found rather than the first, so a failure report says
 * how bad it is.
 */
export function assertQuarantine(
  body: string, summary: string, orientation: OrientationResult,
): { ok: boolean; violations: QuarantineViolation[] } {
  const violations: QuarantineViolation[] = []
  const tierC = allItems(orientation).filter((i) => i.tier === 'C')

  // Short strings produce meaningless substring hits ("the ban"), so only
  // distinctive spans are swept. Anything shorter is not identifiable as having
  // come from X in the first place.
  const distinctive = tierC.map((i) => i.text).filter((t) => t.length >= 25)

  const lines = body.split('\n')
  for (const text of distinctive) {
    for (const line of lines) {
      if (!line.includes(text)) continue
      if (!line.includes(TIER_C_MARK)) {
        violations.push({ kind: 'unmarked-line', text, line })
      }
    }
    if (summary.includes(text)) {
      violations.push({ kind: 'in-summary', text })
    }
  }

  return { ok: violations.length === 0, violations }
}
