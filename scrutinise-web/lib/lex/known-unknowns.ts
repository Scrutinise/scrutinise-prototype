// ─────────────────────────────────────────────────────────────────────────────
// 25-C §2.4 — COLLAPSING THE KNOWN-UNKNOWNS LIST WITHOUT LOSING ANYTHING.
//
// The list repeats itself. Four passes each declare the same unanswered must-answer question, the
// precedent job declares the same unmet question once per instrument, and a user reading the panel
// sees the same sentence three or four times with a different Act named in it.
//
// ⚠⚠ THE BRIEF FORBIDS THE OBVIOUS FIX, AND IS RIGHT TO. "Collapse structurally on statement type
// plus subject, NEVER by string similarity." String similarity would merge two gaps that happen to
// be worded alike and are about different instruments — and the failure is invisible, because what
// disappears is exactly the thing nobody is looking at. A Levenshtein threshold that eats one
// instrument out of five leaves a list that still looks complete.
//
// So the type and the subject are TAGGED AT CREATION by whichever producer knows them, and the
// collapse is a group-by over those tags. Nothing here reads the prose.
//
// ⚠ AND THE COLLAPSE IS ASSERTED LOSSLESS. `collapseKnownUnknowns` guarantees that every subject
// named in the input appears in the output; `check:lex-25c` plants a fixture whose subjects would
// be dropped by a naive dedupe and fails if any goes missing. A collapse nobody can audit is a
// deletion with better manners.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A declared gap. Always carries WHAT was looked for, not just that something is missing.
 *
 * `kind` and `subjects` are 25-C additions and are OPTIONAL on purpose: rows stored before this
 * existed have neither, and must keep rendering rather than being swallowed by a collapse that
 * cannot classify them. An untagged row is its own group.
 */
export interface KnownUnknown {
  question: string
  /** Why it could not be answered — always specific enough to act on. */
  why: string
  /**
   * The STATEMENT TYPE, set by the producer. Two entries collapse only when this matches AND the
   * question matches — never on how the sentences read.
   */
  kind?: KnownUnknownKind
  /**
   * What the statement is ABOUT: instrument gids, intent names, corpora. These are what must
   * survive a collapse, and the losslessness guarantee is stated in terms of them.
   */
  subjects?: string[]
}

export type KnownUnknownKind =
  /** A pass's must-answer question that the gather did not report answering. */
  | 'unanswered'
  /** A retrieval that failed to run. Subject: the intent. */
  | 'search-failed'
  /** A gap the pass named itself, beyond the must-answer list. */
  | 'named-gap'
  /** A structured job could not run or found nothing. Subject: the instruments. */
  | 'job-unmet'

/**
 * Group by (kind, question) and union the subjects.
 *
 * ⚠ THE ORDER OF FIRST APPEARANCE IS KEPT. Sorting would move a gap the user has already read past
 * up or down the list between two polls of the same page, which reads as new information.
 */
export function collapseKnownUnknowns(items: KnownUnknown[]): KnownUnknown[] {
  const groups = new Map<string, KnownUnknown & { subjects: string[] }>()
  const order: string[] = []

  for (const item of items) {
    if (!item?.question?.trim()) continue
    // ⚠ An UNTAGGED row keys on its own identity, so a legacy row can never be merged into a
    // group it was not classified into. Being conservative here costs a duplicate line; being
    // permissive costs a gap the user never sees.
    const key = item.kind
      ? `${item.kind}::${item.question.trim()}`
      : `untagged::${item.question.trim()}::${item.why}`

    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, { ...item, subjects: [...(item.subjects ?? [])] })
      order.push(key)
      continue
    }
    for (const s of item.subjects ?? []) {
      if (!existing.subjects.includes(s)) existing.subjects.push(s)
    }
    // ⚠ The LONGER reason wins rather than the first. Two producers of the same gap often differ
    // in how much they say about it, and keeping the fuller one is the only choice that cannot
    // lose information the user was already being given.
    if (item.why && item.why.length > (existing.why ?? '').length) existing.why = item.why
  }

  return order.map((k) => {
    const g = groups.get(k)!
    if (!g.subjects.length) {
      const { subjects, ...rest } = g
      return rest
    }
    // The subjects are appended to the reason, so the collapse is VISIBLE: the user can see that
    // one line stands for five instruments rather than wondering where the other four went.
    const named = g.subjects.join(', ')
    const why = g.why.includes(named) ? g.why : `${g.why} (${g.subjects.length}: ${named})`
    return { ...g, why }
  })
}

/**
 * ⚠ THE LOSSLESSNESS ASSERTION, as a function so it can be run in a check AND in anger.
 *
 * Returns the subjects present in the input and missing from the output. Empty means the collapse
 * lost nothing. This is deliberately computed from the OUTPUT'S RENDERED TEXT rather than from its
 * `subjects` array: what matters is that the user can see the instrument named, not that we kept a
 * field they never read.
 */
export function subjectsLost(input: KnownUnknown[], output: KnownUnknown[]): string[] {
  const all = new Set<string>()
  for (const i of input) for (const s of i.subjects ?? []) all.add(s)
  const rendered = output.map((o) => `${o.question} ${o.why}`).join('\n')
  return [...all].filter((s) => !rendered.includes(s))
}
