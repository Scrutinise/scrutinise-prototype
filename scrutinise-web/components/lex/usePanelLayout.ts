'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-L §4 — the panel layout, loaded, dragged, and saved.
//
// ⚠ THE SAVE IS DEBOUNCED AND THE DRAG IS NOT. Dragging a divider fires dozens of pointer
// events a second; a PUT per event would be a request storm against a column nobody is
// reading. The width moves at pointer speed, and the write happens when the pointer stops.
//
// ⚠⚠ AND `touched` IS THE WHOLE RECONCILIATION WITH 25-H §5. That sprint made the panels
// follow CONTENT — they open by themselves when there is something in them — with `null`
// meaning "nobody has said". A stored layout is somebody saying. So until the user has
// stored one, the content rule stands; from the moment they do, their choice wins and stops
// being recomputed. Losing that distinction would either freeze the first render's answer
// for ever (a user who arrived before the build finished keeps an empty panel closed) or
// silently override a layout they set (which reads as the setting not having saved).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_LAYOUT, MIN_WIDTH, PANEL_KEYS, normaliseLayout,
  type PanelKey, type PanelLayout,
} from '@/lib/lex/panel-layout'

export function usePanelLayout() {
  const [layout, setLayout] = useState<PanelLayout>(DEFAULT_LAYOUT)
  /** TRUE once the user has stored a layout of their own. See the header. */
  const [touched, setTouched] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    void fetch('/api/user/panel-layout')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { layout?: PanelLayout; stored?: boolean } | null) => {
        if (!alive || !j?.layout) return
        setLayout(normaliseLayout(j.layout))
        setTouched(!!j.stored)
      })
      // ⚠ A FAILED LOAD IS THE DEFAULT LAYOUT, SILENTLY. The user is here to work on their
      // proposal; a banner about a panel-width preference would be noise about nothing.
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [])

  const persist = useCallback((next: PanelLayout) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void fetch('/api/user/panel-layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: next }),
      }).catch(() => {})
    }, 400)
  }, [])

  const commit = useCallback((next: PanelLayout) => {
    const safe = normaliseLayout(next)
    setLayout(safe)
    setTouched(true)
    persist(safe)
  }, [persist])

  const toggle = useCallback((key: PanelKey) => {
    setLayout((cur) => {
      const next = normaliseLayout({ ...cur, open: { ...cur.open, [key]: !cur.open[key] } })
      setTouched(true)
      persist(next)
      return next
    })
  }, [persist])

  /**
   * Move the divider between `a` and `b` by `delta` (a fraction of the row).
   *
   * ⚠ IT MOVES TWO COLUMNS, NOT ONE. Widening the left panel has to narrow its neighbour;
   * taking the width out of the row as a whole would leave the third column jumping as a
   * side effect of a drag nobody aimed at it.
   *
   * ⚠ AND IT CLAMPS BEFORE IT COMMITS. `normaliseLayout` would re-normalise a below-minimum
   * width back up, which during a drag reads as the divider fighting the pointer.
   */
  const drag = useCallback((a: PanelKey, b: PanelKey, delta: number) => {
    setLayout((cur) => {
      const wa = cur.width[a] + delta
      const wb = cur.width[b] - delta
      if (wa < MIN_WIDTH || wb < MIN_WIDTH) return cur
      const next = { ...cur, width: { ...cur.width, [a]: wa, [b]: wb } }
      setTouched(true)
      persist(next)
      return next
    })
  }, [persist])

  const reset = useCallback(() => {
    setLayout(DEFAULT_LAYOUT)
    setTouched(false)
    // ⚠ THE RESET IS WRITTEN, not just applied. A reset that only cleared local state would
    // come back on the next page load, which is the one moment a user reaches for it.
    persist(DEFAULT_LAYOUT)
  }, [persist])

  /** The open panels, left to right — what a divider needs to know who its neighbours are. */
  const openKeys = PANEL_KEYS.filter((k) => layout.open[k])

  return { layout, touched, loaded, openKeys, toggle, drag, reset, commit }
}
