'use client'

// ─────────────────────────────────────────────────────────────────────────────
// LexGeneralChat — the general corpus chat window (/admin/lex-general).
//
// Deliberately NOT the idea chat. There is no accept card, no stage divider, no
// panel to save anything into, because there is no idea. What replaces all of that
// is the retrieval block: every answer carries the sources it was given and a
// diagnostics line saying what the gateway did to get them.
//
// The retrieval block is attached to ITS OWN turn rather than living in a single
// side panel that the latest query overwrites. That is what makes the page usable
// as a test surface: you ask the same question two ways and scroll between the two
// answers with both rankings still on screen.
//
// The transcript is component state. Nothing is persisted anywhere — reloading the
// tab is how you clear it.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import type { SearchResult, SearchResultType } from '@/lib/lex/page1-config'
import type { GeneralChatResult } from '@/lib/lex/general-chat'

const TYPE_LABEL: Record<SearchResultType, string> = {
  PRIMARY_LEGISLATION: 'Act',
  STATUTORY_INSTRUMENT: 'SI',
  EU_LEGISLATION: 'EU law',
  DEBATE: 'Debate',
  COMMITTEE: 'Committee',
  CASE_LAW: 'Case law',
  GUIDANCE: 'Guidance',
  BILL: 'Bill',
  TREATY: 'Treaty',
  // A badge, not a heading — it sits inline beside a title that already reads "Explanatory Notes
  // — {Act}", so here the term of art is the clearest thing it can say. The plain-English gloss
  // ("What the law was for") belongs on the panel heading, which has no card title under it.
  EXPLANATORY_NOTE: 'Explanatory note',
}

interface Turn {
  role: 'user' | 'lex'
  content: string
  /** Present on a Lex turn: what the gateway returned for the question above it. */
  retrieval?: GeneralChatResult
}

function TypeBadge({ type }: { type: SearchResultType }) {
  return (
    <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700">
      {TYPE_LABEL[type] ?? type}
    </span>
  )
}

function SourceRow({ n, r, cited, seen }: { n: number; r: SearchResult; cited: boolean; seen: boolean }) {
  return (
    <li
      className={`rounded-lg border p-2.5 ${
        cited ? 'border-blue-300 bg-blue-50/60' : seen ? 'border-zinc-200 bg-white' : 'border-zinc-100 bg-zinc-50/60'
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-[11px] text-zinc-400">[{n}]</span>
        <TypeBadge type={r.type} />
        {r.url ? (
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            {r.title || r.id}
          </a>
        ) : (
          <span className="text-sm font-medium text-zinc-900">{r.title || r.id}</span>
        )}
        {cited && <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">cited</span>}
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-zinc-500">
        {r.citation && r.citation !== r.title && <span>{r.citation}</span>}
        {r.date && <span>{r.date}</span>}
        <span>score {r.score.toFixed(3)}</span>
        <span className="font-mono text-zinc-400">{r.id}</span>
      </div>
      {r.snippet && <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">{r.snippet.slice(0, 400)}</p>}
    </li>
  )
}

/** The line that answers "what did retrieval actually do" — the reason this page exists. */
function Diagnostics({ d }: { d: GeneralChatResult['diagnostics'] }) {
  const on = (Object.entries(d.flags) as [string, boolean][]).filter(([, v]) => v).map(([k]) => k)
  return (
    <div className="space-y-1 rounded-lg bg-zinc-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-600">
      <div>
        <span className="text-zinc-400">streams </span>
        {d.routedStreams?.length ? (
          <span className="font-semibold text-zinc-900">{d.routedStreams.join(', ')}</span>
        ) : (
          // Not cosmetic. No streams means the router did not run or failed open, and
          // the query went out as one unfiltered call — the state that hid a dark
          // router for weeks. It should read as unusual, because it is.
          <span className="font-semibold text-amber-700">none — untiered single call (router off or failed open)</span>
        )}
      </div>
      <div>
        <span className="text-zinc-400">flags </span>
        {on.length ? on.join(' ') : 'all off'}
      </div>
      {d.expansionAdded.length > 0 && (
        <div>
          <span className="text-zinc-400">expansion added </span>
          {d.expansionAdded.join(' ')}
        </div>
      )}
      {/* Per-stream coverage of the answer context. "committees was routed" and "committees
          reached the model" are different claims, and only the second decides whether Lex can
          say anything about committees — which is exactly what it got wrong on 9 Aug, when the
          routed list was a concatenation and the 16-document context was all legislation. A
          stream at 0 is that bug, so it is coloured, not buried. */}
      {d.contextStreams && d.contextStreams.length > 0 && (
        <div>
          <span className="text-zinc-400">in Lex&rsquo;s context </span>
          {d.contextStreams.map((s, i) => (
            <span key={s.stream}>
              {i > 0 && ' '}
              <span className={s.inContext === 0 && s.retrieved > 0 ? 'font-semibold text-amber-700' : ''}>
                {s.stream}&nbsp;{s.inContext}/{s.retrieved}
              </span>
            </span>
          ))}
        </div>
      )}
      <div>
        <span className="text-zinc-400">retrieved </span>
        {d.retrieved} ({d.grouped} after grouping, {d.contextCount} shown to Lex)
        <span className="text-zinc-400"> · search </span>
        {d.searchMs} ms
        {d.answerMs !== undefined && (
          <>
            <span className="text-zinc-400"> · answer </span>
            {d.answerMs} ms
          </>
        )}
        {d.promptTokens !== undefined && (
          <>
            {/* The recurring cost of the context budget, per query, from the API's own
                usageMetadata rather than an estimate. */}
            <span className="text-zinc-400"> · tokens in/out </span>
            {d.promptTokens}/{d.outputTokens ?? '?'}
          </>
        )}
      </div>
      <div className="break-all">
        <span className="text-zinc-400">query </span>
        {d.query.join(' ')}
      </div>
      {d.droppedCitations.length > 0 && (
        <div className="text-red-700">
          cited source numbers it was never shown: {d.droppedCitations.join(', ')}
        </div>
      )}
    </div>
  )
}

function RetrievalBlock({ result }: { result: GeneralChatResult }) {
  const [openSources, setOpenSources] = useState(false)
  const [openDiag, setOpenDiag] = useState(false)
  const cited = new Set(result.cited)

  return (
    <div className="ml-9 mt-2 space-y-2">
      <div className="flex flex-wrap gap-3 text-[11px]">
        <button onClick={() => setOpenSources((v) => !v)} className="font-medium text-zinc-500 hover:text-zinc-900">
          {openSources ? '−' : '+'} {result.results.length} source{result.results.length === 1 ? '' : 's'} retrieved
          {result.cited.length > 0 && ` · ${result.cited.length} cited`}
        </button>
        <button onClick={() => setOpenDiag((v) => !v)} className="font-medium text-zinc-500 hover:text-zinc-900">
          {openDiag ? '−' : '+'} retrieval detail
        </button>
      </div>

      {openDiag && <Diagnostics d={result.diagnostics} />}

      {openSources && (
        <ul className="space-y-1.5">
          {result.results.map((r, i) => (
            <li key={r.id + i} className="list-none">
              {/* Everything below this line was retrieved and ranked, but never put in
                  front of Lex — so it cannot be what the answer is based on, and the
                  list would overstate the reading if it did not say so. */}
              {i === result.diagnostics.contextCount && result.diagnostics.contextCount > 0 && (
                <div className="flex items-center gap-2 py-2">
                  <span className="h-px flex-1 bg-zinc-200" />
                  <span className="text-[10px] uppercase tracking-widest text-zinc-400">
                    retrieved but not shown to Lex
                  </span>
                  <span className="h-px flex-1 bg-zinc-200" />
                </div>
              )}
              <SourceRow n={i + 1} r={r} cited={cited.has(r.id)} seen={i < result.diagnostics.contextCount} />
            </li>
          ))}
          {result.results.length === 0 && (
            <li className="rounded-lg border border-zinc-200 bg-white p-2.5 text-xs text-zinc-500">
              The search ran and returned nothing. That is a gap in what the corpus holds — not an
              answer about the law.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

function Bubble({ turn }: { turn: Turn }) {
  const failed = turn.retrieval?.diagnostics.searchFailed
  return (
    <div className="space-y-1">
      <div className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        {turn.role === 'lex' && (
          <div className="mr-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            L
          </div>
        )}
        <div
          className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            turn.role === 'lex'
              ? failed
                ? 'bg-red-50 text-red-900'
                : 'bg-zinc-100 text-zinc-900'
              : 'bg-blue-600 text-white'
          }`}
        >
          {turn.content}
        </div>
      </div>
      {turn.retrieval && <RetrievalBlock result={turn.retrieval} />}
    </div>
  )
}

export default function LexGeneralChat() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [turns, busy])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function send() {
    const question = input.trim()
    if (question.length < 3 || busy) return
    setInput('')
    setError(null)
    if (inputRef.current) inputRef.current.style.height = 'auto'

    // The history sent to the server is the PROSE only — the retrieval blocks are a
    // view of what happened, not conversation, and re-sending them would re-feed
    // old excerpts as though they had been retrieved for the new question.
    const history = turns.map((t) => ({ role: t.role, content: t.content }))
    setTurns((prev) => [...prev, { role: 'user', content: question }])
    setBusy(true)
    try {
      const res = await fetch('/api/admin/lex-general', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(typeof body?.error === 'string' ? body.error : `Request failed (${res.status})`)
        return
      }
      const data = (await res.json()) as GeneralChatResult
      const content =
        data.answer ??
        (data.diagnostics.searchFailed
          ? `The corpus search didn't complete, so I have nothing to answer from.${
              data.diagnostics.searchFailureReason ? `\n\n${data.diagnostics.searchFailureReason}` : ''
            }`
          : `The search ran${
              data.diagnostics.retrieved ? ` and returned ${data.diagnostics.retrieved} results` : ' and returned nothing'
            }, but the answer step failed, so the sources below are unsummarised.${
              data.diagnostics.answerFailureReason ? `\n\n${data.diagnostics.answerFailureReason}` : ''
            }`)
      setTurns((prev) => [...prev, { role: 'lex', content, retrieval: data }])
    } catch {
      setError('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col rounded-xl border border-zinc-200 bg-white">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {turns.length === 0 && (
          <div className="mx-auto max-w-xl space-y-3 py-10 text-center">
            <p className="text-sm text-zinc-600">
              Ask the corpus anything. No idea, no stage, no on-topic test — the question you type is
              the query that reaches the index, untiered, through the same gateway every other caller
              uses.
            </p>
            <p className="text-xs text-zinc-400">
              Every answer shows what it retrieved and what routing did to get it. Nothing here is
              saved, and nothing touches idea data.
            </p>
          </div>
        )}

        {turns.map((t, i) => (
          <Bubble key={i} turn={t} />
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="mr-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              L
            </div>
            <div className="rounded-2xl bg-zinc-100 px-4 py-3">
              <div className="flex h-4 items-center gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}

      <div className="border-t border-zinc-200 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder="Ask the corpus anything…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => void send()}
            disabled={busy || input.trim().length < 3}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  )
}
