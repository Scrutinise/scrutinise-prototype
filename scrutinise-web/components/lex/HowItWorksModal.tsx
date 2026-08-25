'use client'

// ─────────────────────────────────────────────────────────────────────────────
// "How this works" — the guided tour + FAQ modal for the create view (Sprint 1.3
// Task 2). Restores the real tour the returning-user intro used to reference.
//
//   - Tour view: explains the three panels (verbatim copy) and the stages.
//   - FAQ view : the existing FAQ content (lib/faq-content.ts), incl. the
//                Strategic Kernel / Guiding Policy explanation already written.
//
// Pure presentational — opens/closes via props; no canonical state involved.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import { FAQ_MARKDOWN } from '@/lib/faq-content'

// Verbatim tour copy (Sprint 1.4 brief). The per-panel detail lives in the boxes
// below, so the intro no longer repeats it.
const TOUR_INTRO =
  'When editing your idea you will see three panels which all work together. You can:'

const TOUR_CLOSING =
  "To develop your idea we'll work through four stages — The Basic Idea, Diagnosis, Guiding policy, and " +
  'Coherent actions. Along the way we’ll do research, build up evidence and steadily build a strong ' +
  'case for your preferred actions to present to Parliament. Take it at your own pace.'

// react-markdown styling map (Tailwind v4 has no typography plugin → no `prose`).
const MD: Components = {
  h1: ({ node, ...p }) => <h2 className="text-base font-semibold text-zinc-900 mt-5 mb-2" {...p} />,
  h2: ({ node, ...p }) => <h2 className="text-sm font-semibold text-zinc-900 mt-5 mb-1.5" {...p} />,
  h3: ({ node, ...p }) => <h3 className="text-[13px] font-semibold text-zinc-800 mt-4 mb-1" {...p} />,
  p: ({ node, ...p }) => <p className="text-sm text-zinc-700 leading-relaxed mb-2.5" {...p} />,
  ul: ({ node, ...p }) => <ul className="list-disc pl-5 space-y-1 mb-2.5" {...p} />,
  ol: ({ node, ...p }) => <ol className="list-decimal pl-5 space-y-1 mb-2.5" {...p} />,
  li: ({ node, ...p }) => <li className="text-sm text-zinc-700 leading-relaxed" {...p} />,
  strong: ({ node, ...p }) => <strong className="font-semibold text-zinc-900" {...p} />,
  em: ({ node, ...p }) => <em className="italic" {...p} />,
  a: ({ node, ...p }) => <a className="text-blue-600 underline hover:text-blue-700" target="_blank" rel="noopener noreferrer" {...p} />,
  hr: ({ node, ...p }) => <hr className="my-4 border-zinc-100" {...p} />,
  code: ({ node, ...p }) => <code className="text-xs bg-zinc-100 rounded px-1 py-0.5" {...p} />,
}

const PANELS: { name: string; side: string; blurb: string }[] = [
  { name: 'Chat', side: 'left', blurb: "Talk to me, Lex — I'll help you shape each part of your proposal." },
  { name: 'Your proposal', side: 'middle', blurb: 'The proposal as you build it; answer my questions in the chat, or type straight into the boxes — each saves as you go.' },
  { name: 'Legislation', side: 'right', blurb: "Once we have enough to search on, I'll pull the most relevant law, debates and committee work and put it here." },
]

// ⚠ 25-G §3.2 — THE SAME TOUR, ADAPTED FOR THE OTHER DOOR.
//
// `docs/LEX_25F_CUTOVER.md` §9c names this modal as the single biggest thing `/ideas/build`
// was missing — "losing the tour because it lived on the old route would be a silent
// regression, and the tour was itself a fix from §19-D". But the copy above describes THREE
// PANELS, and the build door has none of them: it is four questions, a build, then a
// proposal. Showing a first-time user a tour of a screen they are not on is worse than
// showing them nothing, because it teaches them the product is confused.
//
// So the CHROME and the FAQ are shared — one modal, one place to edit the FAQ — and only
// the tour's own steps differ. A variant, not a second component.
const BUILD_STEPS: { name: string; side: string; blurb: string }[] = [
  {
    name: 'Four questions',
    side: 'first',
    blurb: 'What the problem is, what you want to happen, what you know at first hand, and anything you want me to read. In your own words — there is no form.',
  },
  {
    name: 'I read the record back',
    side: 'then',
    blurb: 'I show you what I understood before I do anything with it. If I have it wrong, say so and I will try again — nothing is built on a reading you have not seen.',
  },
  {
    name: 'The build',
    side: 'then',
    blurb: 'Ten passes over about ten minutes: I search the corpus, draft a diagnosis and an approach, research what the draft raises, revise it against what I find, and read the whole thing back as a hostile committee clerk.',
  },
  {
    name: 'Your proposal',
    side: 'last',
    blurb: 'Everything I drafted, as proposals you accept, edit or throw out — with the decisions I had to make laid out so you can take them yourself. Nothing is yours until you say it is.',
  },
]

const BUILD_CLOSING =
  'You can leave at any point and come back — everything is saved as you go. The build runs on our ' +
  'servers, so you can close the tab while it works. And nothing it writes is agreed until you agree ' +
  'to it: every field is a proposal with your name nowhere near it yet.'

export default function HowItWorksModal({
  onClose,
  variant = 'create',
}: {
  onClose: () => void
  /** 25-G §3.2 — which door's tour to show. The FAQ is the same either way. */
  variant?: 'create' | 'build'
}) {
  const steps = variant === 'build' ? BUILD_STEPS : PANELS
  const intro = variant === 'build'
    ? 'This door is four questions and a build. Here is the whole of it:'
    : TOUR_INTRO
  const closing = variant === 'build' ? BUILD_CLOSING : TOUR_CLOSING
  const [view, setView] = useState<'tour' | 'faqs'>('tour')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How this works"
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-200">
          <h2 className="text-sm font-semibold text-zinc-900 flex-1">
            {view === 'tour' ? 'How this works' : 'Frequently asked questions'}
          </h2>
          {view === 'faqs' && (
            <button
              onClick={() => setView('tour')}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
            >
              ← Back to the tour
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-zinc-400 hover:text-zinc-700 text-lg leading-none px-1"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {view === 'tour' ? (
            <div>
              <p className="text-base font-semibold text-zinc-900 mb-1">Welcome to Scrutinise.</p>
              <p className="text-sm text-zinc-700 leading-relaxed mb-4">{intro}</p>

              <div className="space-y-2.5 mb-4">
                {steps.map((p, i) => (
                  <div key={p.name} className="flex gap-3 rounded-xl border border-zinc-200 p-3">
                    <div className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-900">
                        {p.name} <span className="text-zinc-400 font-normal">({p.side})</span>
                      </div>
                      <p className="text-xs text-zinc-600 leading-relaxed mt-0.5">{p.blurb}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-sm text-zinc-700 leading-relaxed">{closing}</p>
            </div>
          ) : (
            <ReactMarkdown components={MD}>{FAQ_MARKDOWN}</ReactMarkdown>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-zinc-200 bg-zinc-50">
          {view === 'tour' ? (
            <>
              <button
                onClick={() => setView('faqs')}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Read the FAQs →
              </button>
              <button
                onClick={onClose}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:opacity-90"
              >
                Got it — let’s start
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="ml-auto text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:opacity-90"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
