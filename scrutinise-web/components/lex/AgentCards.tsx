'use client'

// 26-P §2a/§3b/§4c — WHAT THE TOOL RESULTS PUT ON THE SCREEN.
//
// Lex's reply is text plus tool calls, and the interface is driven by what the tools returned — not by
// fields parsed out of a reply. Three things come back that need a place to live:
//
//   • a CONFIRMATION — an asks-first action that has NOT happened. The button is the approval. ⚠ It is a
//     real button posting a signed token to `/lex-agent/confirm`; nothing typed in the chat reaches it.
//   • an UNDO — a button that reverses what a change just did (§4c: every change is undoable).
//   • a CANDIDATE CARD — a guiding policy Lex drafted, numbered and tested, never prose.
//
// ⚠ CLAUDE.md §28 — this client component imports TYPES ONLY from `lib/lex/agent`. Its value imports
// would be followed into the browser bundle, and `agent/tools.ts` imports prisma.
//
// ⚠ COLOUR IS NEVER THE ONLY CUE (§21): the primary action is a filled button and the secondary an
// outlined one — a lightness difference, which colour blindness preserves — and the state words are
// printed, not coloured.

import type { PendingConfirmation, UndoOffer, UiEffect } from '@/lib/lex/agent/types'

export interface AgentCardsState {
  pending: PendingConfirmation[]
  undo: UndoOffer[]
  ui: UiEffect[]
}

/** The token's expiry, read off its (unsigned-readable) payload. Verification is the server's; this only hides a dead card. */
export function tokenExpiry(token: string): number | null {
  try {
    const body = token.split('.')[0]
    const json = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.exp === 'number' ? json.exp : null
  } catch { return null }
}

export const isLive = (token: string, now = Date.now()) => {
  const exp = tokenExpiry(token)
  return exp === null || exp > now
}

function priceLine(p: PendingConfirmation): string | null {
  if (p.pence == null) return null
  // ⚠ The figure is the brief's, not a measured one, and the card says so rather than presenting it as exact.
  return `${p.priceIsFloor ? 'At least ' : 'About '}${p.pence}p — an estimate, not a measured price.`
}

export default function AgentCards({
  state, busy, onConfirm, onDismissPending, onUndo,
}: {
  state: AgentCardsState
  busy: boolean
  onConfirm: (token: string) => void
  onDismissPending: (token: string) => void
  onUndo: (token: string) => void
}) {
  const pending = state.pending.filter((p) => isLive(p.token))
  const undo = state.undo.filter((u) => isLive(u.token))
  const candidates = state.ui.filter((u): u is Extract<UiEffect, { type: 'candidate_card' }> => u.type === 'candidate_card')
  if (!pending.length && !undo.length && !candidates.length) return null

  return (
    <div className="space-y-2 ml-9" data-testid="agent-cards">
      {candidates.map((c) => (
        <div key={`cand-${c.number}`} className="rounded-2xl border-2 border-zinc-300 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Candidate {c.number} · drafted by Lex · not chosen
          </p>
          <p className="mt-1 text-sm text-zinc-900 whitespace-pre-wrap">{c.approach}</p>
          {c.compoundWarning ? (
            <p className="mt-2 text-xs text-zinc-700">
              <span className="font-semibold">⚠ Flagged for review</span> (a mechanical check, not a verdict): {c.compoundWarning}
            </p>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">Passed the mechanical check for being more than one action.</p>
          )}
          <p className="mt-1 text-[11px] text-zinc-500">It is in your list of candidates. You decide what happens to it.</p>
        </div>
      ))}

      {pending.map((p) => (
        <div key={p.token.slice(0, 32)} className="rounded-2xl border-2 border-zinc-900 bg-zinc-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">Waiting for you — nothing has been done yet</p>
          <p className="mt-1 text-sm text-zinc-900">{p.summary}</p>
          {priceLine(p) && <p className="mt-1 text-xs text-zinc-600">{priceLine(p)}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button" disabled={busy} onClick={() => onConfirm(p.token)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
            >
              ✓ Confirm
            </button>
            <button
              type="button" disabled={busy} onClick={() => onDismissPending(p.token)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border-2 border-zinc-300 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
            >
              Not now
            </button>
          </div>
        </div>
      ))}

      {undo.map((u) => (
        <div key={u.token.slice(0, 32)} className="flex items-center gap-2">
          <button
            type="button" disabled={busy} onClick={() => onUndo(u.token)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
          >
            ↶ {u.label}
          </button>
        </div>
      ))}
    </div>
  )
}
