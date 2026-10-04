// ─────────────────────────────────────────────────────────────────────────────
// 26-O §3 (Charlie, decision 116) — ONE ANSWER TO "WHAT IS THE GUIDING POLICY", ON THE IDEA PAGE.
//
// The page gave three: the Policy tab read the CHOSEN PolicyOption row, the Overview read the SUMMARY column
// (`summaryGuidingPolicy`, under the label "Approach (summary)"), and the legacy tab and the Stage-2 gate read
// `Idea.guidingPolicy`, which the Lex path NEVER writes. Now there is one: the settled STATEMENT.
//
//   1. the CHOSEN row's approach (what the Policy tab shows) — the settlement itself;
//   2. else `Idea.chosenApproach` — the column the settle handler mirrors it into;
//   3. else, ONLY for an idea that was not built by Lex, the legacy `Idea.guidingPolicy` — kept for the 29
//      legacy showcase ideas that depend on it (26-J §1c). A Lex-built idea never reaches step 3: its legacy
//      column is empty by construction, and falling back to it would resurrect a second source.
//
// Imports nothing: shared by the page (a client component — CLAUDE.md §28), the stage gate and the check, so
// there is ONE definition (CLAUDE.md §26.5).
// ─────────────────────────────────────────────────────────────────────────────

export interface PolicyAnswerInput {
  chosenApproach?: string | null
  guidingPolicy?: string | null
}

export function guidingPolicyStatement(
  idea: PolicyAnswerInput,
  opts: { chosenRowApproach?: string | null; lexBuilt?: boolean } = {},
): string | null {
  const row = opts.chosenRowApproach?.trim()
  if (row) return row
  const col = idea.chosenApproach?.trim()
  if (col) return col
  if (opts.lexBuilt) return null
  return idea.guidingPolicy?.trim() || null
}

/** The Stage 2→3 gate's question. A Lex-built idea is satisfied by its statement; a legacy one by its legacy column. */
export const hasGuidingPolicy = (idea: PolicyAnswerInput): boolean => !!guidingPolicyStatement(idea)
