'use client'

// 26-H §3 — one sort preference, shared between the Dashboard and the Ideas list, so
// "the order chosen on the ideas page" is the same order the Dashboard shows (§3b).
// Kept in localStorage rather than a DB column — both surfaces are client components
// already, and this needs no schema change to satisfy "one arrangement, two places".

import { useCallback, useEffect, useState } from 'react'

export type IdeaSortMode = 'recent' | 'name' | 'created'

export const IDEA_SORT_STORAGE_KEY = 'scrutinise:ideaSort'

export const IDEA_SORT_LABEL: Record<IdeaSortMode, string> = {
  recent: 'Most recent',
  name: 'Name',
  created: 'Date created',
}

function isIdeaSortMode(v: string | null): v is IdeaSortMode {
  return v === 'recent' || v === 'name' || v === 'created'
}

function readIdeaSortMode(): IdeaSortMode {
  if (typeof window === 'undefined') return 'recent'
  try {
    return isIdeaSortMode(window.localStorage.getItem(IDEA_SORT_STORAGE_KEY))
      ? (window.localStorage.getItem(IDEA_SORT_STORAGE_KEY) as IdeaSortMode)
      : 'recent'
  } catch {
    return 'recent'
  }
}

function writeIdeaSortMode(mode: IdeaSortMode) {
  try {
    window.localStorage.setItem(IDEA_SORT_STORAGE_KEY, mode)
  } catch {
    // Private browsing / storage disabled — the choice just doesn't persist.
  }
}

/** Reads on mount (SSR has no localStorage) and picks up a change made on the other
 *  surface via the `storage` event, so switching tabs between Dashboard and Ideas
 *  shows the same choice without a reload. */
export function useIdeaSortMode(): [IdeaSortMode, (mode: IdeaSortMode) => void] {
  const [mode, setModeState] = useState<IdeaSortMode>('recent')

  useEffect(() => { setModeState(readIdeaSortMode()) }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === IDEA_SORT_STORAGE_KEY && isIdeaSortMode(e.newValue)) setModeState(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setMode = useCallback((m: IdeaSortMode) => {
    setModeState(m)
    writeIdeaSortMode(m)
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
