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
import { PRODUCT_FACTS } from '@/lib/lex/product-facts'

// Verbatim tour copy (Sprint 1.4 brief). The per-panel detail lives in the boxes
// below, so the intro no longer repeats it.
// ⚠ 25-N §2 — "You can:" IS DELETED. It introduced a list of things the user could do and
// what followed it was three panels being described, so the sentence promised a grammar the
// next paragraph did not keep.
const TOUR_INTRO =
  'When editing your idea you will see three panels which all work together.'

/**
 * ══ 25-N §2 — THE PURPOSE OF THE TOOL, IN CHARLIE'S WORDS, VERBATIM ═════════════
 *
 * §2 places it exactly: immediately below "Welcome to Scrutinise", above "When editing your
 * idea…". It is the first thing a new user reads about what this is FOR, and it is the one
 * sentence that tells them the product is not going to hand them an answer.
 *
 * ⚠ IT IS SHOWN ON BOTH DOORS. The build door's tour describes four questions rather than
 * three panels, but the purpose of the tool does not change with the door you came in by.
 */
export const PURPOSE_STATEMENT =
  'The purpose of this tool is not to solve everything for you, but to give you the insight to '
  + 'lead an informed debate. Through debate and scrutiny we build better legislation.'

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

// ⚠ 25-K §1 — THE TOUR TEACHES THE VOCABULARY, so it was the last place the retired
// words could survive and still do damage: a user who is TOLD the middle column is called
// "Your proposal" then goes looking for that label and does not find it.
//
// ⚠ 25-N §2/§3 — THE NAMES AND THE LOGIC ARE THE ONES ON SCREEN. Three panels called one
// thing in the tour and another on the page is the exact failure this list was written to
// prevent, one sprint later. §3's logic is stated as the blurb, because it is the thing that
// makes the three columns learnable in one reading: raw material on the right, the draft
// report in the middle, your own working area on the left.
const PANELS: { name: string; side: string; blurb: string }[] = [
  { name: 'WORKING AREA', side: 'left', blurb: "Your worklist — what to read and what to decide — with the chat under it. Two tabs: Lex, to talk to me about any of it, and Notes, which are private to you and never shared." },
  { name: 'DRAFT STRATEGY', side: 'middle', blurb: 'The report itself. Nothing arrives here until you put it there — use “Add to report” on anything in THE RESEARCH. Type straight into any box, or ask me to write it.' },
  { name: 'THE RESEARCH', side: 'right', blurb: "Everything I found or worked out: the background, the issues, the numbers and the debates. Raw material — pick from it, and what you pick goes into the middle." },
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
    name: 'I go away and work',
    side: 'then',
    blurb: 'Ten passes over about ten minutes: I search the corpus, draft a diagnosis and an approach, research what the draft raises, revise it against what I find, and read the whole thing back as a hostile committee clerk.',
  },
  {
    name: 'The Strategy',
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
              {/* §2 — verbatim, and in this position: under the welcome, above the panels. */}
              <p className="text-sm text-zinc-800 leading-relaxed mb-3 border-l-2 border-blue-500 pl-3">
                {PURPOSE_STATEMENT}
              </p>
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

              {/* ══ 25-N §11 — THE MOBILE SECTION ═════════════════════════════
                  §11 asks for "a section to 'How this works' for mobile". The tour above
                  describes three panels side by side, which is a description of a screen a
                  phone user has never seen — so on a phone the whole tour was, quietly, about
                  somebody else's layout. */}
              {variant === 'create' && (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 mb-4">
                  <p className="text-sm font-medium text-zinc-900">On a phone</p>
                  <ul className="mt-1.5 space-y-1 text-xs text-zinc-700 leading-relaxed">
                    <li>
                      The three panels become three <span className="font-medium">modes</span>, one at a
                      time. The bar at the <span className="font-medium">foot of the page</span> switches
                      between them — it is at the bottom so it is in reach of your thumb.
                    </li>
                    <li>
                      The DRAFT STRATEGY tab carries a <span className="font-medium">number</span> when
                      something is waiting on you.
                    </li>
                    <li>
                      The three stages are at the <span className="font-medium">top</span> of the page.
                      Pull down to reach them.
                    </li>
                  </ul>
                </div>
              )}

              {/* ══ 25-Q §6 — THE OPERATING FACTS, RENDERED FROM THE SAME ARRAY LEX IS GIVEN ══
                  §6: *"Sourced from one place that is also what 'How this works' renders, so the
                  two cannot drift apart."*

                  ⚠⚠ THIS IS THE HALF THAT MAKES THAT TRUE. Putting the facts in the prompt alone
                  would have satisfied the feature and not the instruction: the drift §6 is worried
                  about is between what Lex says and what the tour says, and it only cannot happen
                  if both read the same array. `PRODUCT_FACTS` is that array; `productFactsBlock()`
                  is the prompt's view of it. */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                  Getting around
                </p>
                <dl className="space-y-2.5">
                  {PRODUCT_FACTS.map((f) => (
                    <div key={f.question}>
                      <dt className="text-xs font-semibold text-zinc-800">{f.question}</dt>
                      <dd className="text-xs text-zinc-600 leading-relaxed mt-0.5">{f.answer}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2.5 text-[11px] text-zinc-500">
                  You can ask me any of these in the chat and get the same answer — it comes from
                  this same list.
                </p>
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
