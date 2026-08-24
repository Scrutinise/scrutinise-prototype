/**
 * CENTRAL Stage 2e — who wrote this answer.
 *
 * ⚠ THE DEFECT THIS EXISTS TO CLOSE. Until 24 Aug 2026 the answer card rendered
 * no author at all: a branch name and an age, and nothing else. Twenty-seven of
 * the thirty-one answers in the pilot library were written by Claude, and
 * nothing on any screen said so. A reader had no way to tell a member's hard-won
 * doorstep line from a model's.
 *
 * This is the ONE component that answers "who wrote this", and every surface
 * that shows an answer uses it — the library list, the question detail, and the
 * pack. `npm run check:central` greps all three for it, so a new surface that
 * forgets is a failing check rather than a quiet regression.
 *
 * The label is deliberately plain. Not a warning colour, not a disclaimer: an
 * AI-written answer is allowed to be good, and members vote on it like any
 * other. It simply must not pass as somebody's own work.
 */

/** Shared by every surface — a server type and a client type would drift. */
export type AnswerAuthorship = {
  authorType: string
  aiModel: string | null
  author?: { name: string | null; username: string } | null
}

export function isAiAnswer(a: { authorType: string }): boolean {
  return a.authorType === 'AI'
}

/** The bare label, for places with no room for a byline (a pack card). */
export function AiLabel({ aiModel, className = '' }: { aiModel: string | null; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-[oklch(0.86_0.03_265)] bg-[oklch(0.97_0.02_265)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-[oklch(0.42_0.09_265)] ${className}`}
    >
      Written by {aiModel ?? 'AI'}
    </span>
  )
}

/**
 * The full byline: a name for a member, the label for AI.
 *
 * `suffix` carries whatever the surface already showed next to it — the branch
 * name and the age — so the two do not end up on separate lines saying half a
 * sentence each.
 */
export function AnswerByline({
  answer,
  suffix,
  className = '',
}: {
  answer: AnswerAuthorship
  suffix?: string
  className?: string
}) {
  if (isAiAnswer(answer)) {
    return (
      <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
        <AiLabel aiModel={answer.aiModel} />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </span>
    )
  }
  const name = answer.author?.name ?? answer.author?.username ?? 'A member'
  return (
    <span className={`text-xs text-muted-foreground ${className}`}>
      {name}
      {suffix ? ` · ${suffix}` : ''}
    </span>
  )
}
