'use client'

import { useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import DocumentExports from '@/components/documents/DocumentExports'
import QuestionPanel from './QuestionPanel'
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
  // Same rule as EXPLANATORY_NOTE above — the heading states the FUNCTION, because that is what
  // a reader with no legal training can act on. "Impact assessments" is a term of art; "what it
  // was expected to cost" is the thing they came for. The term of art still appears on every
  // card ("Impact Assessment — {instrument} — Costs and benefits").
  IMPACT_ASSESSMENT: 'What it was expected to cost',
  DEBATE: 'Debates',
  // Not "Votes". A division IS a vote, but "Votes" beside "Debates" reads as a tally, and what
  // is actually here is the named list of who voted which way — which is the useful thing.
  DIVISION: 'How they voted',
  CONSULTATION: 'Who was asked',
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
// IMPACT_ASSESSMENT sits with EXPLANATORY_NOTE, after the three law types, for the same reason:
// both annotate a specific instrument and a reader researching it wants them beside it. DIVISION
// follows DEBATE (what Parliament did, after what it said) and CONSULTATION follows COMMITTEE —
// the pre-legislative record, before the regulators.
const TYPE_ORDER: SearchResultType[] = [
  'PRIMARY_LEGISLATION', 'STATUTORY_INSTRUMENT', 'EU_LEGISLATION', 'EXPLANATORY_NOTE',
  'IMPACT_ASSESSMENT', 'DEBATE', 'DIVISION', 'COMMITTEE', 'CONSULTATION',
  'CASE_LAW', 'BILL', 'TREATY', 'GUIDANCE',
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
  onAskLex,
  onRetrySearch,
  onGiveFeedback,
  deepeningPass,
  focusFieldRef,
  refreshKey,
  onReportChanged,
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
  onAskLex: () => void
  onRetrySearch: () => void
  /** §20.5 — opens the feedback consent flow, pre-set to the briefing. */
  onGiveFeedback: () => void
  /** §22 — while a Deepening pass is open, ITS retrieval leads this panel, through the
   *  same grouped renderer as everything else. Null when no pass is open. */
  deepeningPass?: { label: string; results: SearchResult[] } | null
  /** 25-D §3 rule 3 — the field the user is currently reading. Orders and marks the
   *  by-question panel; it never filters it. */
  focusFieldRef?: string | null
  /** Bumped by the parent when something upstream may have changed the evidence. */
  refreshKey?: number
  /** 25-N §3a — called when something crosses into or out of the report, so the middle
   *  column can re-read its own copy of what is in it. */
  onReportChanged?: () => void
}) {
  const [open, setOpen] = useState(true)
  // 25-D §3 rule 4 — the type-grouped list is still here, and it FOLDS. The headings name
  // what matters; they do not hide the rest.
  const [showFullList, setShowFullList] = useState(false)

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

  // ══ 25-N §4 — THE TWO "INPUTS" ITEMS, BUILT HERE AND RENDERED BY THE LIBRARY ═══
  //
  // ⚠⚠ THIS IS THE FIX FOR *"clicking a contents item shows neighbouring sections too"*, and
  // the cause was never in the contents list. `QuestionPanel` renders exactly one item — and
  // then this component carried on rendering the retrieved-by-type fold, the stage search,
  // the exports and the page-one source cards UNDERNEATH it, unconditionally. The library sat
  // on top of a scroll, so "one item at a time" was true of one component and false of the
  // screen.
  //
  // ⚠ THEY ARE BUILT HERE BECAUSE THE DATA IS HERE. All of this comes from canonical state,
  // which `QuestionPanel` deliberately does not read (it fetches its own, and a second copy
  // of the search results would be a second answer). So the nodes are built where the data
  // lives and passed to the one component that decides what is on screen.
  const retrievedNode = (
    <div className="space-y-4">
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

      {/* The page-one source cards, grouped the way the corpus is shelved. */}
      {grouped.map((g) => (
        <div key={g.type}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-1.5">
            {TYPE_LABELS[g.type]}
          </div>
          <div className="space-y-1.5">{g.items.map((r) => <RefCard key={r.id} r={r} />)}</div>
        </div>
      ))}

      {(!stageSearch && research.length === 0 && grouped.length === 0) && (
        <p className="text-xs text-zinc-500">
          Nothing has been retrieved for this idea yet. This is where the raw returns go — every
          document a search brought back, shelved the way the corpus is shelved.
        </p>
      )}
    </div>
  )

  const backgroundNode = initialBackground && initialBackground.status !== 'failed' ? (
    <div className="space-y-3">
      {initialBackground.summary && <p className="text-xs text-zinc-500">{initialBackground.summary}</p>}
      {initialBackground.body && <ReactMarkdown components={MD_COMPONENTS}>{initialBackground.body}</ReactMarkdown>}
      {/* §19-D Task 9h — a quiet way to ask again, deliberately not a button. */}
      <button onClick={onRetrySearch} disabled={busy}
        className="text-[11px] text-zinc-400 hover:text-zinc-700 disabled:opacity-40">
        Run this search again
      </button>
      {/* §8.2 — the same briefing as a document. Self-contained and additive. */}
      {initialBackground.status === 'ready' && <DocumentExports ideaId={ideaId} variant="panel" />}
    </div>
  ) : null

  // ⚠ THE NOTICES ARE STATUS, NOT SECTIONS, so they render on the contents home and nowhere
  // else. A "this section's search hasn't run" card underneath an open committee report is
  // the same category error as the retrieved list being there.
  const noticesNode = (
    <>
      {!hasAnything && (
        <p className="text-sm text-zinc-400">
          Once you’ve confirmed keywords, Lex pulls an initial background briefing from the corpus and
          it appears here. Each new section then runs its own focused search.
        </p>
      )}

      {/* §22 — the open Deepening pass's own retrieval. While a pass is open, the pass IS
          what the user is working on. */}
      {deepeningPass && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide flex-1 text-violet-700">
              {deepeningPass.label} — what this pass found
            </span>
            <span className="text-[11px] text-zinc-400">{deepeningPass.results.length} references</span>
          </div>
          {deepeningPass.results.length === 0 ? (
            <p className="text-xs text-zinc-500">
              This pass hasn’t retrieved anything yet. Run it and its sources appear here.
            </p>
          ) : (
            TYPE_ORDER.map((t) => ({ type: t, items: deepeningPass.results.filter((r) => r.type === t) }))
              .filter((g) => g.items.length > 0)
              .map((g) => (
                <div key={g.type}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">{TYPE_LABELS[g.type]}</div>
                  <div className="space-y-1.5">{g.items.map((r) => <RefCard key={r.id} r={r} />)}</div>
                </div>
              ))
          )}
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

      {/* §19-D Task 4 — this stage has no search on record. State it; never fall back to the
          previous stage's material and let it read as current. */}
      {stageSearchMissing && (
        <div className={`rounded-xl border ${stageAccent.border} ${stageAccent.bg} p-3`}>
          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${stageAccent.text}`}>
            {stageLabel} — what’s out there
          </div>
          <p className="text-sm text-zinc-600">
            This section’s own search hasn’t run yet, so there’s nothing here for it. The earlier
            research is still in Inputs — it just isn’t this section’s.
          </p>
          <button onClick={onRetrySearch} disabled={busy}
            className="mt-2 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-50">
            Run this section’s search
          </button>
        </div>
      )}

      {/* ══ 25-N §2 — THE "YOU'VE FINISHED THIS SECTION" CARD IS GONE ═══════════════
          §2: *"Remove 'You've finished this section' from the right-hand panel. ⚠ It is a
          relic of forced staging. The user must be free to jump around."*

          ⚠⚠ THE SENTENCE WAS NOT THE PROBLEM; THE PLACE WAS. A card in THE RESEARCH saying
          "this part's complete, move on to Guiding Policy" is the research panel giving
          navigation orders. Moving between sections still works, from the two places that are
          about moving: the section headings in DRAFT STRATEGY, and the stage bar.

          ⚠ WHAT STAYS IS THE PART THAT WAS NEVER ABOUT STAGING: asking Lex about what is in
          front of you, and saying it is wrong. Both are about THIS panel's contents. */}
      {showCta && (
        <div className="rounded-xl border border-zinc-200 p-3">
          <div className="flex flex-wrap gap-2">
            <button onClick={onAskLex} disabled={busy}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
              Ask Lex about this
            </button>
            {/* §20.5 — opens the consent flow; nothing is stored or sent until the user has
                seen the wording and said yes. */}
            <button onClick={onGiveFeedback} disabled={busy}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
              Give feedback
            </button>
          </div>
        </div>
      )}
    </>
  )

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
      {/* ⚠ 25-N §2 — THE "BACKGROUND" HEADING IS GONE. It sat directly under the panel's own
          title and named a THIRD thing the column was supposed to be, after "Resources" below
          it. The panel is THE RESEARCH; nothing inside it needs to re-announce that.

          ⚠ 25-N §4 — AND NOTHING IS RENDERED BESIDE `QuestionPanel` ANY MORE. Everything this
          panel used to draw underneath the library is now handed IN, so exactly one component
          decides what is on screen and "clicking an item shows that item only" is a property
          of the code rather than an aspiration. */}
      <QuestionPanel
        ideaId={ideaId}
        focusFieldRef={focusFieldRef ?? null}
        refreshKey={refreshKey}
        onChanged={onReportChanged}
        notices={noticesNode}
        inputs={{ retrieved: retrievedNode, background: backgroundNode }}
      />
    </div>
  )
}
