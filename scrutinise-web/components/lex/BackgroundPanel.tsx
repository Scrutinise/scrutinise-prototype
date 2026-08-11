'use client'

import { useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import DocumentExports from '@/components/documents/DocumentExports'
import { repairRefUrl } from '@/lib/lex/legislation-url'
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
  // Deliberately NOT "Explanatory notes". The heading has to do its work for a reader with no
  // legal training, and to that reader "explanatory notes" is an unplaced term of art — it does
  // not say whether they are about to read the law or something about the law. The function,
  // stated plainly, does: what the law was FOR is self-evidently not the law itself. The term of
  // art still appears, one line below, on every card ("Explanatory Notes — Building Safety Act
  // 2022"), so nothing is lost for a reader who does know it.
  EXPLANATORY_NOTE: 'What the law was for',
  DEBATE: 'Debates',
  COMMITTEE: 'Committee reports',
  CASE_LAW: 'Case law',
  BILL: 'Bills',
  TREATY: 'Treaties',
  GUIDANCE: 'Guidance & regulators',
}
// ⚠ A type missing from this array is INVISIBLE — line 112 renders `TYPE_ORDER.map(...)`, not
// the results. It is a plain array, so tsc cannot catch an omission the way it catches one in
// TYPE_LABELS above. `check:corpus-types` asserts the two agree.
// EXPLANATORY_NOTE sits directly after the three law types because it annotates them: a reader
// researching an Act wants the note explaining it next to the Act, not at the bottom with the
// regulators.
const TYPE_ORDER: SearchResultType[] = [
  'PRIMARY_LEGISLATION', 'STATUTORY_INSTRUMENT', 'EU_LEGISLATION', 'EXPLANATORY_NOTE',
  'DEBATE', 'COMMITTEE', 'CASE_LAW', 'BILL', 'TREATY', 'GUIDANCE',
]

// Panel 3 — Legislation. Pure renderer of initialBackground + legislationRefs[] (+ the
// page-transition CTA once the briefing is ready).
// One reference card — the same shape wherever references appear.
//
// §19-D Task 5: the url is repaired at render. New searches already store the
// working form, but every reference stored before the fix holds a legislation.gov.uk
// address that 404s, and those live in `stageSearches`/`legislationRefs` on ideas
// people are mid-way through. Repairing here means no data migration.
function RefCard({ r }: { r: SearchResult }) {
  const href = repairRefUrl(r.type, r.id, r.url)
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="block rounded-lg border border-zinc-200 p-2.5 hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
      <div className="text-sm font-medium text-zinc-800">{r.title}</div>
      <div className="text-[11px] text-zinc-500 mt-0.5">{r.citation}</div>
      <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{r.snippet}</p>
    </a>
  )
}

// A foldable section — used for prior-stage content so it stays available without
// dominating the current stage (§19-C Task 2/3: the road-traffic background was still
// filling the panel during Guiding Policy).
function Fold({
  title, subtitle, defaultOpen = false, accent, children,
}: {
  title: string; subtitle?: string; defaultOpen?: boolean; accent?: string; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-zinc-200 overflow-hidden">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 text-left">
        <span className={`text-xs font-semibold uppercase tracking-wide flex-1 ${accent ?? 'text-zinc-700'}`}>{title}</span>
        {subtitle && <span className="text-[11px] text-zinc-400">{subtitle}</span>}
        <span className="text-[11px] text-zinc-400 w-3 text-center">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-3 py-3 border-t border-zinc-100 space-y-3">{children}</div>}
    </div>
  )
}

export default function BackgroundPanel({
  ideaId,
  initialBackground,
  legislationRefs,
  stageSearch,
  research,
  stage,
  stageLabel,
  stageAccent,
  nextPage,
  busy,
  onContinue,
  onAskLex,
  onRetrySearch,
  onGiveFeedback,
}: {
  ideaId: string
  initialBackground: CanonicalState['initialBackground']
  legislationRefs: SearchResult[]
  /** §19-C Task 2 — the ACTIVE stage's search, grouped into the five sections. */
  stageSearch: CanonicalState['stageSearch']
  /** §19-C Task 1c — searches the user asked for in chat. */
  research: CanonicalState['research']
  /** §19-D Task 4 — the state machine's page. "Is the briefing current?" is a fact
   *  about WHICH STAGE the user is on, not about whether a search record happens to
   *  exist; deriving it from the record is what sent Guiding Policy back to the
   *  Orientation briefing whenever the stage search hadn't stored. */
  stage: string
  stageLabel: string
  stageAccent: { text: string; border: string; bg: string }
  nextPage: CanonicalState['nextPage']
  busy: boolean
  onContinue: () => void
  onAskLex: () => void
  onRetrySearch: () => void
  /** §20.5 — opens the feedback consent flow, pre-set to the briefing. */
  onGiveFeedback: () => void
}) {
  const [open, setOpen] = useState(true)

  const grouped = TYPE_ORDER.map((t) => ({
    type: t,
    items: legislationRefs.filter((r) => r.type === t),
  })).filter((g) => g.items.length > 0)

  const hasAnything = !!initialBackground || legislationRefs.length > 0 || !!stageSearch || research.length > 0
  // The Continue CTA appears once the current page is complete. It no longer waits on
  // the briefing being "ready" — a failed corpus search must not trap the user (§19-C 1a).
  const showCta = !!nextPage
  const searchFailed = initialBackground?.status === 'failed' || (stageSearch && !stageSearch.ok)
  // §19-D Task 4 — the briefing is current on ORIENTATION and nowhere else. Past that
  // it folds, whether or not this stage's own search has managed to store anything.
  const briefingIsCurrent = stage === 'ORIENTATION'
  // A later stage with no stored search at all: say so and offer to run it. Never
  // silently hand back the Orientation briefing in its place.
  const stageSearchMissing = !briefingIsCurrent && !stageSearch

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Background</div>

      {!hasAnything && (
        <p className="text-sm text-zinc-400">
          Once you’ve confirmed keywords, Lex pulls an initial background briefing from the corpus and it appears here.
          Each new section then runs its own focused search.
        </p>
      )}

      {/* Page-transition CTA (design §14 / Sprint 2 Task 4). */}
      {showCta && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
          <p className="text-sm text-zinc-700 mb-2">
            This part’s complete. When you’re ready, move on to <span className="font-medium">{nextPage!.label}</span>.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={onContinue} disabled={busy}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              Continue to {nextPage!.label}
            </button>
            <button onClick={onAskLex} disabled={busy}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
              Ask Lex about this
            </button>
            {/* §20.5 — live from Sprint 2.5. Opens the consent flow; nothing is
                stored or sent until the user has seen the wording and said yes. */}
            <button onClick={onGiveFeedback} disabled={busy}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
              Give feedback
            </button>
          </div>
        </div>
      )}

      {/* §19-C Task 1a — an honest failure state. No substituted content, ever. */}
      {searchFailed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-sm text-zinc-700">
            The corpus search didn’t complete, so there’s nothing here yet. Nothing has been guessed or
            filled in — it just didn’t run.
          </p>
          <button onClick={onRetrySearch} disabled={busy}
            className="mt-2 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-50">
            Retry the search
          </button>
        </div>
      )}

      {/* §19-D Task 4 — this stage has no search on record. State it; do not fall back
          to the previous stage's material and let it read as current. */}
      {stageSearchMissing && (
        <div className={`rounded-xl border ${stageAccent.border} ${stageAccent.bg} p-3`}>
          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${stageAccent.text}`}>
            {stageLabel} — what’s out there
          </div>
          <p className="text-sm text-zinc-600">
            This section’s own search hasn’t run yet, so there’s nothing here for it. The earlier
            research is still below — it just isn’t this section’s.
          </p>
          <button onClick={onRetrySearch} disabled={busy}
            className="mt-2 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-50">
            Run this section’s search
          </button>
        </div>
      )}

      {/* §19-C Task 2 — the ACTIVE stage's landscape, in its five sections. */}
      {stageSearch && stageSearch.ok && (
        <div className={`rounded-xl border ${stageAccent.border} ${stageAccent.bg} p-3 space-y-3`}>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold uppercase tracking-wide flex-1 ${stageAccent.text}`}>
              {stageLabel} — what’s out there
            </span>
            <span className="text-[11px] text-zinc-400">{stageSearch.resultCount} references</span>
          </div>
          {stageSearch.groups.length === 0 ? (
            <p className="text-xs text-zinc-500">
              The search ran and found nothing usable for this. That’s a gap in the corpus, not a
              statement about the law.
            </p>
          ) : (
            stageSearch.groups.map((g) => (
              <div key={g.key}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">{g.label}</div>
                <div className="space-y-1.5">{g.results.map((r) => <RefCard key={r.id} r={r} />)}</div>
              </div>
            ))
          )}
          <button onClick={onRetrySearch} disabled={busy}
            className="text-[11px] text-zinc-400 hover:text-zinc-700 disabled:opacity-40">Run this search again</button>
        </div>
      )}

      {/* §19-C Task 1c — searches the user asked for, kept separate from the platform's. */}
      {research.length > 0 && (
        <Fold title="Your research" subtitle={`${research.length}`} defaultOpen>
          {research.slice().reverse().map((r, i) => (
            <div key={`${r.ranAt}-${i}`}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">“{r.query}”</div>
              {r.ok && r.results.length > 0
                ? <div className="space-y-1.5">{r.results.map((x) => <RefCard key={x.id} r={x} />)}</div>
                : <p className="text-xs text-zinc-500">{r.ok ? 'Nothing found for this.' : 'That search didn’t complete.'}</p>}
            </div>
          ))}
        </Fold>
      )}

      {/* The Basic Idea's briefing. Current while on Page 1; folded away afterwards so a
          later stage never shows it as though it were this stage's research. */}
      {initialBackground && initialBackground.status !== 'failed' && (
        briefingIsCurrent ? (
          <div className="rounded-xl border border-zinc-200 overflow-hidden">
            <button onClick={() => setOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-zinc-50 hover:bg-zinc-100 text-left">
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
            {/* §19-D Task 9h — a quiet way to ask again, deliberately not a button.
                The only retry control used to live inside the stage-search block, so
                on Page 1 (where the briefing IS the research) there was no way to
                re-run it unless it had already failed. */}
            <div className="px-3 pb-2">
              <button onClick={onRetrySearch} disabled={busy}
                className="text-[11px] text-zinc-400 hover:text-zinc-700 disabled:opacity-40">
                Run this search again
              </button>
            </div>
          </div>
        ) : (
          <Fold title="The Basic Idea — initial background" subtitle="from earlier">
            {initialBackground.summary && <p className="text-xs text-zinc-500">{initialBackground.summary}</p>}
            {initialBackground.body && <ReactMarkdown components={MD_COMPONENTS}>{initialBackground.body}</ReactMarkdown>}
            {grouped.map((g) => (
              <div key={g.type}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-1.5">{TYPE_LABELS[g.type]}</div>
                <div className="space-y-1.5">{g.items.map((r) => <RefCard key={r.id} r={r} />)}</div>
              </div>
            ))}
          </Fold>
        )
      )}

      {/* §8.2 — the same briefing as a document. Self-contained and additive: it
          fetches its own status and renders nothing from canonical state. */}
      {initialBackground && initialBackground.status === 'ready' && (
        <DocumentExports ideaId={ideaId} variant="panel" />
      )}

      {/* Page-1 source cards, while the briefing is the current research. */}
      {briefingIsCurrent && grouped.map((g) => (
        <div key={g.type}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-1.5">
            {TYPE_LABELS[g.type]}
          </div>
          <div className="space-y-1.5">{g.items.map((r) => <RefCard key={r.id} r={r} />)}</div>
        </div>
      ))}
    </div>
  )
}
