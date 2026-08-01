'use client'

import { useEffect, useRef, useState } from 'react'
import AcceptCard from './AcceptCard'
import type { CanonicalField, CanonicalState } from '@/lib/lex/page1-config'
import { accentFor } from '@/lib/lex/stage-accents'

export interface ChatMessage {
  role: 'user' | 'lex'
  content: string
  timestamp?: string
  /** A2: the Lex stage (page key) this message belongs to, for stage-collapse. */
  stage?: string
}

// One chat bubble.
function Bubble({ m }: { m: ChatMessage }) {
  return (
    <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      {m.role === 'lex' && (
        <div className="w-7 h-7 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mr-2 mt-1">L</div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
        m.role === 'lex' ? 'bg-zinc-100 text-zinc-900' : 'bg-blue-600 text-white'
      }`}>
        {m.content}
      </div>
    </div>
  )
}

// Panel 1 — Chat. Renders message history + Lex's chatText + the accept card
// when a field is AWAITING_CONFIRMATION. Pure renderer of (messages, awaitingField).
// A2: prior-stage messages collapse under a divider ("The Basic Idea — 14 messages +").
// §19-B Task 3 — the slim stage divider marking where a transition happened.
function StageDivider({ label, stage }: { label: string; stage: string }) {
  const accent = accentFor(stage)
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={`h-px flex-1 ${accent.rule}`} />
      <span className={`text-[10px] font-semibold uppercase tracking-widest ${accent.text}`}>{label}</span>
      <span className={`h-px flex-1 ${accent.rule}`} />
    </div>
  )
}

// §19-B Task 2 — the inline transition affordance, in the chat where the user's
// attention is. Same surface and pattern as the AcceptCard; calls the SAME advance
// path as the panel CTA and typed assent.
function ContinueCard({
  nextPage, busy, onContinue,
}: {
  nextPage: NonNullable<CanonicalState['nextPage']>
  busy: boolean
  onContinue: () => void
}) {
  const accent = accentFor(nextPage.key)
  return (
    <div className={`rounded-2xl border ${accent.border} ${accent.bg} p-3 ml-9`}>
      <p className="text-xs text-zinc-600 mb-2">This section is done — the next one builds straight on it.</p>
      <button
        onClick={onContinue}
        disabled={busy}
        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
      >
        Continue to {nextPage.label}
      </button>
    </div>
  )
}

export default function ChatPanel({
  messages,
  awaitingField,
  busy,
  focusNonce,
  currentStage,
  stageLabels,
  nextPage,
  onSend,
  onAccept,
  onDecline,
  onContinue,
}: {
  messages: ChatMessage[]
  awaitingField: CanonicalField | null
  busy: boolean
  /** Bumped by the parent ("Ask Lex about this") to pull focus into the input. */
  focusNonce?: number
  /** The active Lex stage (page key) — its messages stay expanded; earlier ones collapse. */
  currentStage?: string
  /** Stage key → display label, for the collapse dividers. */
  stageLabels?: Record<string, string>
  /** Set when the active page is complete and a further page is reachable — drives
   *  the inline Continue action (§19-B Task 2). */
  nextPage?: CanonicalState['nextPage']
  onSend: (text: string) => void
  onAccept: (value: string | string[]) => void
  onDecline: () => void
  onContinue: () => void
}) {
  const [input, setInput] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, busy, awaitingField])

  useEffect(() => { inputRef.current?.focus() }, [focusNonce])

  function send() {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    onSend(text)
  }

  // Group consecutive messages into stage runs (untagged inherits the previous stage).
  const groups: { stage: string; items: ChatMessage[] }[] = []
  let lastStage = currentStage ?? 'ORIENTATION'
  for (const m of messages) {
    const stage = m.stage ?? lastStage
    lastStage = stage
    const g = groups[groups.length - 1]
    if (g && g.stage === stage) g.items.push(m)
    else groups.push({ stage, items: [m] })
  }
  const labelOf = (k: string) => stageLabels?.[k] ?? k

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {groups.map((g, gi) => {
          // A prior-stage group collapses under a divider unless the user expands it.
          const isCurrent = g.stage === currentStage || gi === groups.length - 1
          const isOpen = isCurrent || expanded.has(gi)
          // §19-B Task 3: mark where the stage changed — the transition point itself.
          const startsNewStage = gi > 0 && groups[gi - 1].stage !== g.stage
          return (
            <div key={gi} className="space-y-3">
              {isCurrent && startsNewStage && <StageDivider label={labelOf(g.stage)} stage={g.stage} />}
              {!isCurrent && (
                <button
                  onClick={() => setExpanded((s) => { const n = new Set(s); n.has(gi) ? n.delete(gi) : n.add(gi); return n })}
                  className="w-full flex items-center gap-2 text-[11px] font-medium text-zinc-400 hover:text-zinc-600 border-t border-zinc-100 pt-2"
                >
                  <span className="uppercase tracking-wide">{labelOf(g.stage)}</span>
                  <span className="flex-1 text-left text-zinc-300">— {g.items.length} message{g.items.length === 1 ? '' : 's'}</span>
                  <span>{isOpen ? '−' : '+'}</span>
                </button>
              )}
              {isOpen && g.items.map((m, i) => <Bubble key={i} m={m} />)}
            </div>
          )
        })}

        {busy && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mr-2 mt-1">L</div>
            <div className="bg-zinc-100 rounded-2xl px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* The accept card renders IFF a field is awaiting confirmation. */}
        {awaitingField && awaitingField.status === 'AWAITING_CONFIRMATION' && (
          <AcceptCard field={awaitingField} busy={busy} onAccept={onAccept} onDecline={onDecline} />
        )}

        {/* The transition affordance renders IFF the page is complete and a next page
            is reachable — the chat never dead-ends with nothing to do (§19-B Task 2). */}
        {!awaitingField && nextPage && (
          <ContinueCard nextPage={nextPage} busy={busy} onContinue={onContinue} />
        )}
      </div>

      <div className="border-t border-zinc-200 px-4 py-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            placeholder="Type your reply…"
            rows={1}
            className="flex-1 resize-none bg-white border border-zinc-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-sm font-medium"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
