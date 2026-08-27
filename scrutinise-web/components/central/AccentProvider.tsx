'use client'

import { useEffect } from 'react'
import { accentByKey, accentVariables } from '@/lib/accent'

const CACHE_KEY = 'scrutinise.accent'

/**
 * CENTRAL Stage 2h item 7 — applies the viewer's chosen accent to the document.
 *
 * ⚠ CLIENT-SIDE, AND THAT IS THE DESIGN RATHER THAN A SHORTCUT. The obvious
 * implementation reads the accent in the root layout and emits a `<style>` — but
 * the root layout is shared by every page including the static marketing ones,
 * and a database read there opts the ENTIRE app into dynamic rendering to
 * deliver a cosmetic preference. That is a real cost paid by every visitor,
 * signed-out ones included, for a setting only signed-in members have.
 *
 * ⚠ THE localStorage CACHE IS WHAT STOPS THE FLASH. Without it every navigation
 * paints the default accent, then repaints the chosen one when the fetch lands.
 * With it, the first paint after the first visit is already right. It is a
 * per-browser convenience and nothing depends on it: a cleared cache, a private
 * window, or a browser refusing site data all just mean one fetch before the
 * colour settles, so every access is wrapped — in some contexts the accessor
 * itself throws rather than returning null.
 */
export default function AccentProvider() {
  useEffect(() => {
    const root = document.documentElement

    function apply(key: string) {
      const vars = accentVariables(accentByKey(key))
      for (const [name, value] of Object.entries(vars)) {
        root.style.setProperty(name, value)
      }
    }

    try {
      const cached = window.localStorage.getItem(CACHE_KEY)
      if (cached) apply(cached)
    } catch {
      // No cache available. One fetch and it settles.
    }

    let live = true
    fetch('/api/user/accent')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d?.key) return
        apply(d.key)
        try {
          window.localStorage.setItem(CACHE_KEY, d.key)
        } catch {
          // Storage refused. The accent is applied for this page either way.
        }
      })
      .catch(() => {
        // Signed out, or offline. The stylesheet default stands.
      })

    return () => {
      live = false
    }
  }, [])

  return null
}

/** Called by the settings screen so the change is visible without a reload. */
export function applyAccentNow(key: string) {
  const vars = accentVariables(accentByKey(key))
  for (const [name, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(name, value)
  }
  try {
    window.localStorage.setItem(CACHE_KEY, key)
  } catch {
    // Nothing depends on the cache.
  }
}
