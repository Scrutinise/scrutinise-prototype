'use client'

import { useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import type { CanonicalState, SearchResult, SearchResultType } from '@/lib/lex/page1-config'

// The Initial Background body is markdown (stub now, Lex-generated later). Render
// it with react-markdown, styled via this map — Tailwind v4 has no typography
// plugin, so no `prose` class. `node` is stripped so it never hits the DOM.
const MD_COMPONENTS: Components = {
  h1: ({ node, ...p }) => <h2 className="text-sm font-semibold text-zinc-800 mt-3 mb-1" {...p} />,
  h2: ({ node, ...p }) => <h2 className="text-sm font-semibold text-zinc-800 mt-3 mb-1" {...p} />,
  h3: ({ node, ...p }) => <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mt-3 mb-1" {...p} />,
  p: ({ node, ...p }) => <p className="text-sm text-zinc-700 leading-relaxed mb-2" {...p} />,
  ul: ({ node, ...p }) => <ul className="list-disc pl-5 space-y-1 mb-2" {...p} />,
  ol: ({ node, ...p }) => <ol className="list-decimal pl-5 space-y-1 mb-2" {...p} />,
  li: ({ node, ...p }) => <li className="text-sm text-zinc-700 leading-relaxed" {...p} />,
  strong: ({ node, ...p }) => <strong className="font-semibold text-zinc-900" {...p} />,
  em: ({ node, ...p }) => <em className="italic" {...p} />,
  a: ({ node, ...p }) => <a className="text-blue-600 underline hover:text-blue-700" target="_blank" rel="noopener noreferrer" {...p} />,
  hr: ({ node, ...p }) => <hr className="my-2 border-zinc-100" {...p} />,
  code: ({ node, ...p }) => <code className="text-xs bg-zinc-100 rounded px-1 py-0.5" {...p} />,
}

const TYPE_LABELS: Record<SearchResultType, string> = {
  PRIMARY_LEGISLATION: 'Primary legislation',
  STATUTORY_INSTRUMENT: 'Statutory instruments',
  EU_LEGISLATION: 'Retained EU law',
  DEBATE: 'Debates',
  COMMITTEE: 'Committee reports',
  CASE_LAW: 'Case law',
  BILL: 'Bills',
  TREATY: 'Treaties',
  GUIDANCE: 'Guidance & regulators',
}
const TYPE_ORDER: SearchResultType[] = [
  'PRIMARY_LEGISLATION', 'STATUTORY_INSTRUMENT', 'EU_LEGISLATION',
  'DEBATE', 'COMMITTEE', 'CASE_LAW', 'BILL', 'TREATY', 'GUIDANCE',
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
            <div className="px-3 py-3 border-t border-zinc-100">
              <ReactMarkdown components={MD_COMPONENTS}>{initialBackground.body}</ReactMarkdown>
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
