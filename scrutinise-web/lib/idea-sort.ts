'use client'

// 26-H §3 — one sort preference, shared between the Dashboard and the Ideas list, so
// "the order chosen on the ideas page" is the same order the Dashboard shows (§3b).
//
// ⚠⚠ 26-J §4 — MOVED OFF localStorage, ONTO THE USER RECORD. A browser store persists per
// DEVICE — Charlie's iPad never knew what his desktop chose. `User.ideaSortMode` is now the
// source of truth (same pattern `User.lexPanelLayout` already uses, for the same reason).
// localStorage is kept ONLY as an instant-paint cache — read synchronously so the sort
// doesn't flash back to 'recent' for a frame while the fetch resolves, then reconciled
// with whatever the server actually says once it answers.

import { useCallback, useEffect, useState } from 'react'

export type IdeaSortMode = 'recent' | 'name' | 'created'

const IDEA_SORT_CACHE_KEY = 'scrutinise:ideaSort'

export const IDEA_SORT_LABEL: Record<IdeaSortMode, string> = {
  recent: 'Most recent',
  name: 'Name',
  created: 'Date created',
}

function isIdeaSortMode(v: unknown): v is IdeaSortMode {
  return v === 'recent' || v === 'name' || v === 'created'
}

/** The local cache only — never the source of truth. Used for first paint alone. */
function readCache(): IdeaSortMode {
  if (typeof window === 'undefined') return 'recent'
  try {
    const v = window.localStorage.getItem(IDEA_SORT_CACHE_KEY)
    return isIdeaSortMode(v) ? v : 'recent'
  } catch {
    return 'recent'
  }
}

function writeCache(mode: IdeaSortMode) {
  try {
    window.localStorage.setItem(IDEA_SORT_CACHE_KEY, mode)
  } catch {
    // Private browsing / storage disabled — the cache just doesn't persist; the server
    // record still does, which is the half that actually has to.
  }
}

/**
 * Paints instantly from the local cache, then fetches `User.ideaSortMode` — the durable,
 * per-user, cross-device record — and reconciles. `setMode` writes through to both: the
 * cache for the next instant paint, and the server for every other device.
 */
export function useIdeaSortMode(): [IdeaSortMode, (mode: IdeaSortMode) => void] {
  const [mode, setModeState] = useState<IdeaSortMode>('recent')

  useEffect(() => { setModeState(readCache()) }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/user/idea-sort')
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (isIdeaSortMode(data.mode)) {
          setModeState(data.mode)
          writeCache(data.mode)
        }
      } catch {
        // No network / signed out — the cached value (or 'recent') stands for this load.
      }
    })()
    return () => { cancelled = true }
  }, [])

  const setMode = useCallback((m: IdeaSortMode) => {
    setModeState(m)
    writeCache(m)
    void fetch('/api/user/idea-sort', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: m }),
    }).catch(() => {
      // The choice still applies to this session via the cache; it just didn't follow the
      // user to another device this time. No retry loop for a write nobody is watching.
    })
  }, [])

  return [mode, setMode]
}

interface SortableIdea {
  title: string | null
  createdAt: string
}

/** 'recent' is a no-op — the Ideas page keeps its manual drag order (falling back to
 *  updatedAt) for 'recent', rather than being forced onto a strict re-sort every render. */
export function sortIdeasByMode<T extends SortableIdea>(ideas: T[], mode: IdeaSortMode): T[] {
  if (mode === 'name') {
    return [...ideas].sort((a, b) => (a.title || 'Untitled idea').localeCompare(b.title || 'Untitled idea'))
  }
  if (mode === 'created') {
    return [...ideas].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }
  return ideas
}
