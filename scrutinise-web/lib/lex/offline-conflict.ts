// ─────────────────────────────────────────────────────────────────────────────
// LEX Z2 (decision 363) — A CHANGE MADE OFFLINE NEVER OVERWRITES ONE MADE ELSEWHERE IN THE MEANTIME. PURE; CLIENT-SAFE.
//
// A queued edit carries `expect`: the value each field had when the edit was made (the base). The route compares it with what the
// server holds now. Equal → the edit applies as normal. Different (another device, or Lex, changed it) → the route refuses with 409 and
// both versions, and the page shows the conflict and lets the owner choose. Neither side is ever overwritten silently.
// ─────────────────────────────────────────────────────────────────────────────

/** The fields an offline edit to an action may carry a base for, and their names in words. */
export const EXPECTABLE = { practicalStep: 'the action statement', commentary: 'the action details' } as const
export type ExpectField = keyof typeof EXPECTABLE
export type Expect = Partial<Record<ExpectField, string | null>>

export interface Conflict { field: ExpectField; words: string; server: string; mine: string }

const norm = (s: string | null | undefined) => (s ?? '').trim()

/** The fields whose server value is no longer the base the edit was made on. An edit that lands on the server's value already (the same
 *  change made twice) is not a conflict. */
export function conflictsOf(expect: Expect | undefined, current: Partial<Record<ExpectField, string | null>>, patch: Partial<Record<ExpectField, string | null>>): Conflict[] {
  if (!expect) return []
  const out: Conflict[] = []
  for (const f of Object.keys(expect) as ExpectField[]) {
    if (!(f in EXPECTABLE)) continue
    const server = norm(current[f]), base = norm(expect[f]), mine = norm(patch[f])
    if (server !== base && server !== mine) out.push({ field: f, words: EXPECTABLE[f], server, mine })
  }
  return out
}

/** The refusal's words. */
export function conflictWords(c: Conflict[]): string {
  return `Not saved: ${c.map((x) => x.words).join(' and ')} changed on the server while you were offline (on another device, or by Lex). Nothing has been overwritten. Choose which to keep.`
}
