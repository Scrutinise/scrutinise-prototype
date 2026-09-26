'use client'

import { useEffect, useState } from 'react'

// S25 §4 — the cost digest email's "raw counters, not hidden" link. Deliberately plain: a
// fetch and a <pre>, not a dashboard — the email already carries the summarised numbers,
// this exists so nothing behind them is hidden, not to be a second polished surface.
export default function CostDigestRaw() {
  const [data, setData] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/cost-digest')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.json().catch(() => ({})))?.error ?? r.statusText}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  if (error) return <p className="text-sm text-red-700">Failed to load: {error}</p>
  if (!data) return <p className="text-sm text-zinc-500">Loading…</p>

  return (
    <pre className="overflow-x-auto rounded bg-zinc-900 p-4 text-xs text-zinc-100">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}
