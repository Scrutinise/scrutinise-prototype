'use client'

import { useState } from 'react'
import type { CanonicalState, SearchResult, SearchResultType } from '@/lib/lex/page1-config'

const TYPE_LABELS: Record<SearchResultType, string> = {
  PRIMARY_LEGISLATION: 'Primary legislation',
  STATUTORY_INSTRUMENT: 'Statutory instruments',
  DEBATE: 'Debates',
  COMMITTEE: 'Committee reports',
  CASE_LAW: 'Case law',
}
const TYPE_ORDER: SearchResultType[] = [
  'PRIMARY_LEGISLATION', 'STATUTORY_INSTRUMENT', 'DEBATE', 'COMMITTEE', 'CASE_LAW',
]

// Panel 3 — Legislation. Pure renderer of initialBackground + legislationRefs[].
export default function BackgroundPanel({
  initialBackground,
  legislationRefs,
}: {
  initialBackground: CanonicalState['initialBackground']
  legislationRefs: SearchResult[]
}) {
  const [open, setOpen] = useState(true)

  const grouped = TYPE_ORDER.map((t) => ({
    type: t,
    items: legislationRefs.filter((r) => r.type === t),
  })).filter((g) => g.items.length > 0)

  const hasAnything = !!initialBackground || legislationRefs.length > 0

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Background</div>

      {!hasAnything && (
        <p className="text-sm text-zinc-400">
          Once you’ve confirmed keywords, Lex pulls an initial background briefing from the corpus and it appears here.
        </p>
      )}

      {/* Initial Background briefing */}
      {initialBackground && (
        <div className="rounded-xl border border-zinc-200 overflow-hidden">
          <button
            onClick={() => setOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-zinc-50 hover:bg-zinc-100 text-left"
          >
            <span className="text-sm font-semibold text-zinc-800 flex-1">Initial Background</span>
            {initialBackground.status === 'pending'
              ? <span className="text-[11px] text-amber-600">preparing…</span>
              : <span className="text-[11px] text-zinc-400">{open ? '▲' : '▼'}</span>}
          </button>
          {initialBackground.summary && (
            <p className="px-3 py-2 text-xs text-zinc-500 border-t border-zinc-100">{initialBackground.summary}</p>
          )}
          {open && initialBackground.body && (
            <div className="px-3 py-3 text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap border-t border-zinc-100">
              {initialBackground.body}
            </div>
          )}
        </div>
      )}

      {/* Grouped source cards */}
      {grouped.map((g) => (
        <div key={g.type}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-1.5">
            {TYPE_LABELS[g.type]}
          </div>
          <div className="space-y-1.5">
            {g.items.map((r) => (
              <a
                key={r.id}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-zinc-200 p-2.5 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
              >
                <div className="text-sm font-medium text-zinc-800">{r.title}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{r.citation}</div>
                <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{r.snippet}</p>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
