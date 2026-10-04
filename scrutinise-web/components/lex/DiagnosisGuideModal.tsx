'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-P addendum §6d — "HOW TO FIND THE RIGHT CAUSE."
//
// A button at the top of the Diagnosis section, in the same colour, font and popup style as "How this works"
// (HowItWorksModal) and "How to write a Guiding Policy" (GuidingPolicyGuideModal).
//
// ⚠ THE FIVE CHECKS ARE RENDERED FROM THE REGISTRY (`DIAGNOSIS_CHECKLIST`, lib/lex/section-checklists.ts) — the SAME
// five sentences the worklist's tick boxes and the FAQ print, so the three cannot say different things. Lex is given the
// same techniques (`M_RCA` in lib/lex/method.ts, §6a) and the same boundary: root-cause analysis finds and tests
// candidate causes; choosing the pivotal obstacle is a separate judgement, the user's, in Rumelt's terms. Nothing here
// claims a proved single root cause.
//
// ⚠ The techniques are the ones common to published root-cause-analysis guidance (the five whys, the symptom-or-cause
// test, cause categories, contributing versus root, systems before blame), written in this product's own words. The two
// RCA guides filed on the first idea built here were read for them.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { DIAGNOSIS_CHECKLIST } from '@/lib/lex/section-checklists'

function DiagnosisGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How to find the right cause"
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-200">
          <h2 className="text-sm font-semibold text-zinc-900 flex-1">How to find the right cause</h2>
          <button onClick={onClose} aria-label="Close" className="text-zinc-400 hover:text-zinc-700 text-lg leading-none px-1">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Why this matters</p>
            <p className="text-sm text-zinc-700 leading-relaxed mt-1">
              Everything after this stage is built on the cause you settle on. A policy that deals with the
              wrong cause fixes nothing, however well it is written. These five checks are the ways to find
              candidate causes and test them honestly. They appear as a checklist under &ldquo;What to do next&rdquo;
              while you are working on your causes: tick each when you are satisfied, or leave it. None is required,
              and Lex can apply any of them to your causes if you ask.
            </p>
          </div>

          {/* The five — from the registry, so the worklist, this guide and the FAQ say the same thing. */}
          <div className="rounded-xl border-2 border-zinc-900 bg-zinc-50/70 p-3 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">The five checks</p>
            {DIAGNOSIS_CHECKLIST.checks.map((k, i) => (
              <div key={k.key}>
                <p className="text-sm text-zinc-900 leading-relaxed">
                  <span className="font-semibold">{i + 1}. {k.title}</span> — {k.question}
                </p>
                <p className="text-sm text-zinc-700 leading-relaxed mt-1">{k.guide}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-sm font-semibold text-zinc-900">Evidence, not opinion</p>
            <p className="text-sm text-zinc-700 leading-relaxed mt-1">
              A cause is more convincing the more precisely it is stated and the more evidence stands behind it.
              Say what you would expect to see if it were the cause, and what would show you it was not.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-zinc-900">What this does not do</p>
            <p className="text-sm text-zinc-700 leading-relaxed mt-1">
              These methods help you find and test candidate causes. They cannot prove a single root cause, and
              Lex will not claim that they have. Choosing the one obstacle that matters most &mdash; the pivotal
              obstacle &mdash; is a separate judgement, and it is yours.
            </p>
          </div>

          <p className="text-[11px] text-zinc-400 pt-1 border-t border-zinc-100">
            Adapted from standard root-cause-analysis practice, and used alongside Richard Rumelt&rsquo;s{' '}
            <span className="italic">Good Strategy Bad Strategy</span>, in this product&rsquo;s own words.
          </p>
        </div>

        <div className="flex items-center justify-end px-5 py-3 border-t border-zinc-200 bg-zinc-50">
          <button onClick={onClose} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:opacity-90">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/** The button and its modal together, so the Diagnosis section needs no state of its own. */
export default function DiagnosisGuideButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full px-3 py-1.5 shadow-sm transition-colors shrink-0 mb-2"
      >
        <span aria-hidden className="w-3.5 h-3.5 rounded-full border border-white/80 flex items-center justify-center text-[9px] font-bold">?</span>
        How to find the right cause
      </button>
      {open && <DiagnosisGuideModal onClose={() => setOpen(false)} />}
    </>
  )
}
