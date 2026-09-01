'use client'

import { useCallback, useRef, useState } from 'react'
import NotesPanel from './NotesPanel'

/**
 * ══ 25-Q §3a — A LEX CHAT ON THE IDEA STAGE, AND THE NOTES BESIDE IT ══════════════════
 *
 * §3a: *"There is no Lex chat box on Stage 1 · The Idea. Charlie could not ask Lex to re-run
 * because there was nothing to ask. Add the same Lex/Notes pair used on Stage 2."*
 *
 * ⚠⚠ IT ANSWERS; IT DOES NOT CONDUCT. This page's four questions are asked by the ELICITATION,
 * which owns the state machine here — it decides what has been answered and when the reading is
 * confirmed. A chat that could propose a field or advance a stage would be a second conductor on
 * one page, and the two would disagree about which question is live. So every turn goes to
 * `/lex` with `mode: 'ASK'`: the route discards any proposal and never advances.
 *
 * ⚠ WHICH IS WHY THIS IS NOT LITERALLY "the same Lex/Notes pair used on Stage 2", and the
 * difference is worth stating rather than hiding. Stage 2's chat can fill boxes because Stage 2's
 * boxes are what the conversation is for. Here the conversation is ABOUT the page — how to
 * re-run, how to change an answer, what a build costs — which is exactly what Charlie wanted and
 * §6's operating facts now let Lex answer.
 *
 * ⚠ AND THE NOTES ARE THE SAME COMPONENT, not a copy. `NotesPanel` is private-to-the-user
 * everywhere it appears; two implementations would eventually differ on who can see them, which
 * is the one property of a note that must never be uncertain.
 */
interface Msg { role: 'user' | 'lex'; content: string }

const OPENER = 'Ask me anything about this — how to change an answer, how to re-run, what a build '
  + 'costs, where your notes go. I will not change anything here; the page does that.'

export default function AskLexPanel({ ideaId }: { ideaId: string }) {
  const [tab, setTab] = useState<'lex' | 'notes'>('lex')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setBusy(true)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/lex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // ⚠ THE MODE IS THE POINT. Without it this turn would be a step in the Stage-2 flow,
        // conducted against a page that is not running it.
        body: JSON.stringify({ message: text, mode: 'ASK' }),
      })
      const data = (await res.json().catch(() => ({}))) as { chatText?: string; error?: string }
      setMessages((prev) => [...prev, {
        role: 'lex',
        content: data.chatText ?? data.error ?? 'I could not answer that just now.',
      }])
    } catch {
      setMessages((prev) => [...prev, { role: 'lex', content: 'I lost the connection there — ask me again?' }])
    } finally {
      setBusy(false)
      requestAnimationFrame(() => {
        const el = scrollRef.current
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      })
    }
  }, [ideaId, input, busy])

  return (
    <div className="rounded-xl border border-zinc-200">
      {/* ⚠ THE SAME TWO-TAB VOCABULARY AS THE WORKING AREA, so a user who learns it on one stage
          has learned it on both. A filled tab against a white one is a lightness difference, not
          a hue one — Charlie is colour blind and `aria-selected` is not a second cue. */}
      <div className="flex border-b border-zinc-200">
        {(['lex', 'notes'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-selected={tab === t}
            className={`px-3 py-1.5 text-xs font-semibold ${
              tab === t ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 hover:text-zinc-800'
            } ${t === 'lex' ? 'rounded-tl-xl' : ''}`}
          >
            {t === 'lex' ? 'Ask Lex' : 'Notes'}
          </button>
        ))}
      </div>

      {tab === 'notes' ? (
        <div className="p-1"><NotesPanel ideaId={ideaId} /></div>
      ) : (
        <div className="p-3">
          <div ref={scrollRef} className="max-h-64 overflow-y-auto space-y-2 mb-2">
            {messages.length === 0 && (
              <p className="text-xs text-zinc-500 leading-relaxed">{OPENER}</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'lex' ? 'bg-zinc-100 text-zinc-900' : 'bg-blue-600 text-white'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && <p className="text-xs text-zinc-400">Thinking…</p>}
          </div>
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() }
              }}
              rows={2}
              placeholder="How do I re-run this? How do I change my second answer?"
              className="flex-1 text-sm p-2 rounded-lg border border-zinc-200 resize-y focus:outline-none focus:border-blue-400"
            />
            <button
              type="button"
              disabled={busy || !input.trim()}
              onClick={() => void send()}
              className="text-xs font-semibold px-3 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40 self-end py-2"
            >
              Ask
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
