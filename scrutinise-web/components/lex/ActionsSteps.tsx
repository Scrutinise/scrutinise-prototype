'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-S2 §3a (decision 166) — THE STEP BAR AND EACH STEP'S INTRO, at the top of the Coherent Actions section.
//
//   1 Sort and prune · 2 Who, how and against · 3 Costs · 4 Order
//
// ⚠ THE DESIGN RULE: *the screen shows only the tools for the step the user is on; everything else waits, reachable but out of the way.*
// ⚠ NOTHING IS SIGNALLED BY COLOUR ALONE (CLAUDE.md §21; Charlie is colour blind): the current step is marked by POSITION (a filled
//   marker, then the others), WEIGHT (bold, a 2px border) and a word ("you are here") — never a hue.
// The step is stored per idea (Idea.actionsStep), so returning lands where the user left it. Free movement: a step is never locked.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type ReactNode } from 'react'
import { STEPS, STEP_NUMBERS, type ActionsStep } from '@/lib/lex/action-steps'
import { explainFailure } from '@/lib/api-rejection'
import { OP_WORDS } from '@/lib/lex/action-structure-schema'

export default function ActionsSteps({ ideaId, initialStep, children }: { ideaId: string; initialStep: ActionsStep; children: (step: ActionsStep) => ReactNode }) {
  const [step, setStep] = useState<ActionsStep>(initialStep)
  const [error, setError] = useState<string | null>(null)

  const go = async (n: ActionsStep) => {
    if (n === step) return
    const before = step
    setStep(n); setError(null) // optimistic: the screen moves at once
    try {
      const res = await fetch(`/api/ideas/${ideaId}/action-structure`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'setStep', step: n }) })
      const j = (await res.json().catch(() => ({}))) as { error?: unknown }
      if (!res.ok || j.error) setError(`Not saved: ${explainFailure(j, res.status, OP_WORDS.setStep)} You are in step ${n} for now, but the idea will reopen at step ${before}.`)
    } catch (e) {
      setError(`Not saved: ${OP_WORDS.setStep} could not reach the server (${e instanceof Error ? e.message : 'network error'}). You are in step ${n} for now, but the idea will reopen at step ${before}.`)
    }
  }

  return (
    <div className="space-y-2">
      <nav aria-label="The four steps of the Coherent Actions" data-step-bar>
        <ol className="flex flex-wrap gap-1.5">
          {STEP_NUMBERS.map((n) => {
            const here = n === step
            return (
              <li key={n}>
                <button type="button" onClick={() => void go(n)} aria-current={here ? 'step' : undefined} data-step={n}
                  className={`text-xs rounded-lg px-2.5 py-1.5 text-left ${here ? 'border-2 border-zinc-900 bg-white font-bold text-zinc-900' : 'border border-zinc-300 bg-zinc-50 font-normal text-zinc-700 hover:bg-white'}`}>
                  <span aria-hidden>{here ? '●' : '○'}</span> {n} {STEPS[n].label}
                  {here && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">you are here</span>}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      {error && (
        <p className="text-xs font-semibold text-zinc-900 bg-white border-2 border-zinc-900 rounded px-2 py-1.5" role="alert">⚠ {error}{' '}
          <button type="button" onClick={() => setError(null)} className="ml-1 px-2 py-0.5 rounded border border-zinc-900 bg-zinc-100 font-semibold">OK</button>
        </p>
      )}
      {/* the step's intro — VERBATIM from BRIEF_26S2 §4–§7, asserted by check:lex-26s2 */}
      <p className="text-sm text-zinc-800 leading-relaxed rounded-lg border border-zinc-300 bg-zinc-50 p-3" data-step-intro={step}>
        <strong>{STEPS[step].lead}</strong> {STEPS[step].body}
      </p>
      {children(step)}
    </div>
  )
}
