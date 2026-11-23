'use client'
// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Z §6.2 (decision 348) — UNSENT TYPING IS KEPT ON THE DEVICE, keyed by idea + field, and cleared when the save succeeds.
//
// After a reload the box says "You had unsent text here — restore it?" with Restore it / Discard it. ⚠ NEVER SUBMITTED BY ITSELF: restoring
// puts the words back in the box, and the user still presses Send or Save. ⚠ Storage may be missing or may throw: then nothing is kept and
// nothing is offered, and the box works as it always has.
// ⚠ CCh 2145Z point 4 (22 Nov; with 361 amended): KEYED BY USER as well as idea and field. A second account on the same device never sees
//   or overwrites the first one's typing, and nothing is discarded at sign-out. The user is the CONFIRMED one (offline.ts draftUserNow):
//   until Clerk has answered, nothing is offered or kept (except offline, where it is the device's last confirmed user). A draft kept
//   under the old key (no user) is offered once to the confirmed user and moved to their key.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import { DRAFT_RESTORE_UI } from '@/lib/lex/screen-labels'
import { STORE_KEY, safeStore, shouldOfferDraft } from '@/lib/lex/where-am-i'
import { draftUserNow, USER_CONFIRMED_EVENT } from '@/lib/lex/offline'

const local = safeStore(() => (typeof window === 'undefined' ? null : window.localStorage))

/** The confirmed user (or, offline, the device's), following Clerk's answer and the connection. */
function useDraftUser(): string | null {
  const [u, setU] = useState<string | null>(null)
  useEffect(() => {
    const f = () => setU(draftUserNow())
    f()
    for (const e of [USER_CONFIRMED_EVENT, 'online', 'offline']) window.addEventListener(e, f)
    return () => { for (const e of [USER_CONFIRMED_EVENT, 'online', 'offline']) window.removeEventListener(e, f) }
  }, [])
  return u
}

/**
 * `ideaId` + `field` name the box (null ideaId: nothing is kept). `value` is what the box holds now; `baseline` is what it held when it was
 * opened (the saved text), so a box that has only been opened is not a draft. Call `clear()` once the save has succeeded.
 */
export function useDeviceDraft(ideaId: string | null | undefined, field: string, value: string, baseline = '') {
  const user = useDraftUser()
  const key = ideaId && user ? STORE_KEY.draft(user, ideaId, field) : null
  const [offer, setOffer] = useState<string | null>(null)
  const decided = useRef(false)

  // once the user is known: offer what was left unsent, if it differs from what the box holds (a new key starts afresh)
  useEffect(() => {
    setOffer(null); decided.current = false
    if (!key || !ideaId) return
    let saved = local.get(key)
    const legacy = STORE_KEY.legacyDraft(ideaId, field)
    if (saved == null) { const old = local.get(legacy); if (old != null) { local.set(key, old); local.set(legacy, null); saved = old } }
    if (shouldOfferDraft(saved, value) && saved !== baseline) setOffer(saved)
    else decided.current = true
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps -- once per box and user

  // as the user types: keep it (debounced); an empty box, or one back at the saved text, keeps nothing
  useEffect(() => {
    if (!key || offer != null) return // while the offer is open, the old draft is not overwritten by the empty box
    const t = setTimeout(() => {
      if (value.trim() && value !== baseline) local.set(key, value)
      else if (decided.current) local.set(key, null)
    }, 400)
    return () => clearTimeout(t)
  }, [key, value, baseline, offer])

  const clear = useCallback(() => { if (key) local.set(key, null) }, [key])
  const take = useCallback(() => { const o = offer; setOffer(null); decided.current = true; return o }, [offer])
  const discard = useCallback(() => { setOffer(null); decided.current = true; clear() }, [clear])
  return { offer, take, discard, clear }
}

/** The one line that offers a draft back. `onRestore` receives the text; the caller puts it in its box. */
export function DraftOffer({ offer, onRestore, onDiscard, preview }: { offer: string | null; onRestore: () => void; onDiscard: () => void; preview?: (offer: string) => string }) {
  if (!offer) return null
  const shownText = preview ? preview(offer) : offer
  return (
    <div role="status" data-draft-offer className="my-1 flex flex-wrap items-center gap-2 rounded-md border-2 border-zinc-900 bg-white px-2 py-1.5 text-xs text-zinc-900">
      <span aria-hidden>↺</span>
      <span className="font-semibold">{DRAFT_RESTORE_UI.offer}</span>
      <span className="text-zinc-600 truncate max-w-[16rem]" data-draft-preview>“{shownText.length > 80 ? `${shownText.slice(0, 79)}…` : shownText}”</span>
      <button type="button" onClick={onRestore} data-draft-restore className="min-h-[36px] px-3 rounded-full bg-zinc-900 text-white font-semibold">{DRAFT_RESTORE_UI.restore}</button>
      <button type="button" onClick={onDiscard} data-draft-discard className="min-h-[36px] px-3 rounded-full border border-zinc-300 bg-white">{DRAFT_RESTORE_UI.discard}</button>
    </div>
  )
}
