'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-P ADDENDUM (CCh follow-up) — A SECTION'S CHECKLIST, IN THE WORKLIST ("What to do next").
//
// Renders whichever checklists the registry says are showing (lib/lex/section-checklists.ts): today, Diagnosis's five
// checks while the causes are not yet confirmed. Each check is a tick box the user may press or ignore, with an
// "Ask Lex" action that has Lex apply the test to the CURRENT rows and report — observations and proposals as text.
// NOTHING IS CHANGED by it, and the block says so beside the reply.
//
// ⚠ NO NAGGING. This block only informs. It never disables anything, never opens a dialog, and the confirm control it
// relates to is not in this file. The user decides.
// ⚠ NOTHING IS SIGNALLED BY COLOUR ALONE (docs/CLAUDE.md §21): a count in words, a tick box, and a word for every state.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useSectionChecklists } from './useSectionChecklists'

type Asked = { status: 'asking' } | { status: 'done'; reply: string } | { status: 'failed'; reason: string }

export default function SectionChecklistBlock({ ideaId, refreshNonce = 0 }: { ideaId: string; refreshNonce?: number }) {
  const { state, error, tick } = useSectionChecklists(ideaId, refreshNonce)
  const [asked, setAsked] = useState<Record<string, Asked>>({})

  async function askLex(checkKey: string) {
    setAsked((a) => ({ ...a, [checkKey]: { status: 'asking' } }))
    try {
      const r = await fetch(`/api/ideas/${ideaId}/checklists/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checkKey }),
      })
      const j = (await r.json().catch(() => ({}))) as { chatText?: string; error?: string }
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
      setAsked((a) => ({ ...a, [checkKey]: { status: 'done', reply: j.chatText?.trim() || 'Lex had nothing to report on this check.' } }))
    } catch (e) {
      setAsked((a) => ({ ...a, [checkKey]: { status: 'failed', reason: e instanceof Error ? e.message : 'unknown error' } }))
    }
  }

  if (error) return <p className="mt-2 text-[11px] font-semibold text-amber-800">⚠ The checks could not be loaded ({error}).</p>
  if (!state || state.checklists.length === 0) return null

  return (
    <>
      {state.checklists.map((c) => (
        <section key={c.section} aria-label={c.heading} className="mt-2 rounded-lg border border-zinc-200 bg-white">
          <div className="px-2.5 py-2 border-b border-zinc-100">
            <div className="flex items-baseline gap-2">
              <h3 className="text-sm font-medium text-zinc-800 flex-1">{c.heading}</h3>
              {/* A count in words — never a coloured dot. Absent when every check is done. */}
              <span className="text-[11px] text-zinc-500 whitespace-nowrap">{c.notYetDone ?? 'all checks done'}</span>
            </div>
            <p className="text-[11px] text-zinc-600 leading-snug mt-0.5">{c.blurb}</p>
          </div>
          <ul className="px-2.5 py-2 space-y-2.5">
            {c.checks.map((k) => {
              const a = asked[k.key]
              return (
                <li key={k.key}>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox" checked={k.ticked} onChange={(e) => void tick(k.key, e.target.checked)}
                      aria-label={`Mark “${k.title}” as done`}
                      className="mt-0.5 shrink-0 w-4 h-4 rounded border-zinc-400 accent-zinc-900"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${k.ticked ? 'text-zinc-400' : 'text-zinc-800'}`}>
                        <span className="font-medium">{k.title}</span> — {k.question}
                      </p>
                      <button
                        type="button"
                        disabled={!state.askLexAvailable || a?.status === 'asking'}
                        onClick={() => void askLex(k.key)}
                        title={state.askLexAvailable
                          ? 'Lex applies this test to your current causes and tells you what it finds. It changes nothing.'
                          : 'Asking Lex to apply a check is not switched on for your account yet. You can still tick the check yourself.'}
                        className="mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {a?.status === 'asking' ? 'Lex is looking…' : 'Ask Lex'}
                      </button>
                      {!state.askLexAvailable && <span className="ml-2 text-[11px] text-zinc-500">not switched on for your account yet</span>}
                    </div>
                  </div>
                  {a?.status === 'done' && (
                    <div className="mt-1.5 ml-6 rounded-lg border border-zinc-200 bg-zinc-50/70 p-2">
                      <p className="text-[11px] font-semibold text-zinc-600">Lex’s observations — nothing has been changed.</p>
                      <p className="text-xs text-zinc-800 leading-relaxed mt-1 whitespace-pre-wrap">{a.reply}</p>
                    </div>
                  )}
                  {a?.status === 'failed' && (
                    <p className="mt-1.5 ml-6 text-[11px] font-semibold text-amber-800">⚠ Lex could not apply this check: {a.reason}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}
