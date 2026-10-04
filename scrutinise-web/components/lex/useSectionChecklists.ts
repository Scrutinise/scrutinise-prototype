'use client'

// 26-P ADDENDUM (CCh follow-up) — the section checklists, for any component that needs them.
//
// The worklist (which owns the tick boxes) and the Diagnosis panel (which prints "N of 5 checks not yet done" beside
// "Confirm these causes") both read this, and a tick in one must show in the other at once. They share state through a
// window event rather than a prop path: they are in different panes and neither is the other's parent.
//
// `import type` only from the server module — it imports prisma, and a client component's value imports are a bundle
// (docs/CLAUDE.md §28).

import { useCallback, useEffect, useState } from 'react'
import type { ChecklistsState } from '@/lib/lex/checklist-state'

const EVENT = 'lex:checklists-changed'

export function useSectionChecklists(ideaId: string, refreshNonce = 0) {
  const [state, setState] = useState<ChecklistsState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/ideas/${ideaId}/checklists`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setState((await r.json()) as ChecklistsState)
      setError(null)
    } catch (e) {
      // A failure says so; it must not read as "there are no checks" (docs/CLAUDE.md §18).
      setError(e instanceof Error ? e.message : 'unknown error')
    }
  }, [ideaId])

  useEffect(() => { void load() }, [load, refreshNonce])
  useEffect(() => {
    const on = () => { void load() }
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [load])

  const tick = useCallback(async (itemKey: string, ticked: boolean) => {
    const r = await fetch(`/api/ideas/${ideaId}/checklists`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemKey, ticked }),
    })
    if (r.ok) {
      setState((await r.json()) as ChecklistsState)
      window.dispatchEvent(new Event(EVENT))
    }
  }, [ideaId])

  return { state, error, tick, reload: load }
}
