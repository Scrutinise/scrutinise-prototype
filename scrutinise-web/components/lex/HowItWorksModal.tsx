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

// Verbatim tour copy (Sprint 1.3 brief).
const TOUR_COPY =
  "Welcome to Scrutinise. Three panels work together. Chat (left): talk to me, Lex — I'll help " +
  'you shape each part of your proposal. Your proposal (middle): the proposal as you build it; ' +
  'answer my questions in the chat, or type straight into the boxes — each saves as you go. ' +
  "Legislation (right): once we have enough to search on, I'll pull the most relevant law, debates " +
  'and committee work and put it here. We work through four stages — diagnosis, guiding policy, and ' +
  'coherent actions. Take it at your own pace.'

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

export default function HowItWorksModal({ onClose }: { onClose: () => void }) {
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
              <p className="text-sm text-zinc-700 leading-relaxed mb-4">{TOUR_COPY}</p>

              <div className="space-y-2.5 mb-2">
                {PANELS.map((p, i) => (
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
