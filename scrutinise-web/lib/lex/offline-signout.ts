// ─────────────────────────────────────────────────────────────────────────────
// LEX Z2 — 361 AMENDED (Charlie, 21 Nov 01:54): KEEP THE OWNER'S WORK IN PROGRESS. Client only.
//
//   lexSignOut(doSignOut)   the site's sign-out goes through this. With nothing unsent: the cached reads are cleared, then doSignOut().
//                           With anything unsent, IT ASKS FIRST — "3 edits not yet sent: Send now / Keep for when you sign back in" —
//                           and whichever is chosen, NOTHING IS DISCARDED: "Send now" sends the edits (what cannot go stays kept);
//                           "Keep" keeps them on this device, tied to this user. Lex messages are always kept (they spend, and are sent
//                           only by their own tap with the estimate, 362). Then the cached reads are cleared, and doSignOut().
//
// The question is shown by whichever page is open: Lex's page answers it (OfflineStrip listens for ASK_EVENT). A page that shows no
// question (any page outside Lex today) gets the safe answer, KEEP: nothing is sent and nothing is lost.
// ─────────────────────────────────────────────────────────────────────────────

import { clearLexOffline } from './offline'
import { unsentLexWork, flushAllEdits } from './offline-queue'

export const ASK_EVENT = 'lex-signout-ask'
export type SignOutChoice = 'send' | 'keep'
export interface SignOutAsk { edits: number; lex: number; answer?: Promise<SignOutChoice> }

export { unsentLexWork }

export async function lexSignOut(doSignOut: () => unknown): Promise<SignOutChoice | 'nothing-unsent'> {
  const unsent = unsentLexWork()
  let choice: SignOutChoice | 'nothing-unsent' = 'nothing-unsent'
  if (unsent.edits || unsent.lex) {
    const ask: SignOutAsk = { ...unsent }
    try { window.dispatchEvent(new CustomEvent<SignOutAsk>(ASK_EVENT, { detail: ask })) } catch { /* no window */ }
    choice = ask.answer ? await ask.answer.catch(() => 'keep' as const) : 'keep'
    if (choice === 'send' && unsent.edits) await flushAllEdits().catch(() => undefined)
  }
  await clearLexOffline()
  await doSignOut()
  return choice
}
