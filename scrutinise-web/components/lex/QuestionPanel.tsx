'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 25-D §3 / §25.5 — THE PANEL, BY QUESTION.
//
// ⚠ THE EMPTY HEADINGS ARE THE POINT, so they are rendered first-class rather than skipped.
// A heading with nothing under it shows the stated gap `question-panel.ts` computed, styled
// so it reads as a finding and not as an error — "we looked for judgments construing this
// and found none" is something the user can act on, and something they can tell us is the
// wrong thing to have looked for.
//
// ⚠ AND AN EXCLUDED SOURCE STAYS ON SCREEN, struck through, with its reason. §20.2.1:
// excluded, not deleted. A source that vanished when the user set it aside would leave them
// unable to see — or reverse — what they had done, and would make the panel disagree with
// the Evidence Pack about what was considered.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import type { QuestionPanel as PanelData, PanelEntry } from '@/lib/lex/question-panel'
import YourMaterial from './YourMaterial'

/**
 * ⚠ The four reasons a heading can be empty carry four different tones, and the mapping is
 * deliberate. `no-producer` is OUR failure and is amber, because the user should see that we
 * owe them something. `nothing-added` is an invitation and is neutral. The two search
 * outcomes are grey findings — true statements about a search, not warnings.
 */
const GAP_STYLE: Record<string, string> = {
  'no-producer': 'border-amber-200 bg-amber-50/60 text-amber-900',
  'not-asked': 'border-zinc-200 bg-zinc-50 text-zinc-600',
  'asked-found-nothing': 'border-zinc-200 bg-zinc-50 text-zinc-600',
  'nothing-added': 'border-zinc-200 bg-white text-zinc-500',
}

function EntryCard({
  e, onExclude, onInclude, busy,
}: {
  e: PanelEntry
  onExclude: (entry: PanelEntry, reason: string) => void
  onInclude: (entry: PanelEntry) => void
  busy: boolean
}) {
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')

  return (
    <div className={`rounded-lg border p-2.5 ${
      e.excluded ? 'border-zinc-200 bg-zinc-50' :
      e.bearsOnFocus ? 'border-blue-300 bg-blue-50/40' : 'border-zinc-200'
    }`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {e.url ? (
            <a href={e.url} target="_blank" rel="noopener noreferrer"
              className={`text-sm font-medium hover:underline ${e.excluded ? 'text-zinc-400 line-through' : 'text-zinc-800'}`}>
              {e.title}
            </a>
          ) : (
            <div className={`text-sm font-medium ${e.excluded ? 'text-zinc-400 line-through' : 'text-zinc-800'}`}>{e.title}</div>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span className="text-[10px] uppercase tracking-wide text-zinc-400">{e.label}</span>
            {/* §4 — visibly marked as the user's own source, never as something we found. */}
            {e.yourSource && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Yours</span>
            )}
            {e.bearsOnFocus && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">On this section</span>
            )}
            {e.citation && <span className="text-[11px] text-zinc-500 truncate">{e.citation}</span>}
          </div>
        </div>
        {!e.excluded ? (
          <button onClick={() => setAsking((v) => !v)} disabled={busy}
            className="text-[11px] text-zinc-400 hover:text-zinc-700 disabled:opacity-40 shrink-0">
            Set aside
          </button>
        ) : (
          <button onClick={() => onInclude(e)} disabled={busy}
            className="text-[11px] text-zinc-500 hover:text-zinc-800 disabled:opacity-40 shrink-0">
            Put back
          </button>
        )}
      </div>

      {/* §3 rule 2 — one sentence of why this matters. NEVER invented: where the sift wrote
          none, that is what it says. */}
      {e.why ? (
        <p className={`text-xs mt-1.5 ${e.excluded ? 'text-zinc-400' : 'text-zinc-600'}`}>{e.why}</p>
      ) : (
        <p className="text-xs mt-1.5 text-zinc-400 italic">
          No reason was recorded for this one — it was found before we started writing them down.
        </p>
      )}

      {e.excluded && (
        <p className="text-xs mt-1.5 text-zinc-500">
          <span className="font-medium">Set aside:</span>{' '}
          {e.exclusionReason || 'no reason recorded'}
        </p>
      )}

      {asking && !e.excluded && (
        <div className="mt-2 space-y-1.5">
          {/* ⚠ THE REASON IS REQUIRED, and the button says so rather than the server saying
              it afterwards. An exclusion nobody can account for is what the Evidence Pack
              cannot print. */}
          <input
            value={reason}
            onChange={(ev) => setReason(ev.target.value)}
            placeholder="Why are you setting this aside?"
            className="w-full text-xs rounded border border-zinc-300 px-2 py-1.5"
          />
          <div className="flex gap-2">
            <button
              disabled={busy || !reason.trim()}
              onClick={() => { onExclude(e, reason.trim()); setAsking(false); setReason('') }}
              className="text-[11px] px-2 py-1 rounded bg-zinc-900 text-white disabled:opacity-40">
              Set aside
            </button>
            <button onClick={() => { setAsking(false); setReason('') }}
              className="text-[11px] px-2 py-1 rounded border border-zinc-300 text-zinc-600">
              Cancel
            </button>
          </div>
          <p className="text-[11px] text-zinc-400">
            It stays in your evidence pack, marked as considered and set aside. Nothing is deleted.
          </p>
        </div>
      )}
    </div>
  )
}

export default function QuestionPanel({
  ideaId, focusFieldRef, refreshKey,
}: {
  ideaId: string
  /** What the user is reading — §3 rule 3. Orders and marks; never filters. */
  focusFieldRef?: string | null
  /** Bumped by the parent when something upstream may have changed the evidence. */
  refreshKey?: number
}) {
  const [data, setData] = useState<PanelData | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    try {
      const qs = focusFieldRef ? `?field=${encodeURIComponent(focusFieldRef)}` : ''
      const res = await fetch(`/api/ideas/${ideaId}/panel${qs}`)
      if (!res.ok) return
      setData(await res.json())
    } catch { /* a panel that cannot load renders nothing rather than a broken shell */ }
  }, [ideaId, focusFieldRef])

  useEffect(() => { void load() }, [load, refreshKey])

  const decide = useCallback(async (entry: PanelEntry, status: 'INCLUDED' | 'EXCLUDED', reason?: string) => {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/sources`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceKey: entry.id,
          status,
          reason: reason ?? null,
          // ⚠ The source's own details travel WITH the decision, so the row can stand alone
          // once this source drops out of retrieval. See `sources.ts`.
          source: { title: entry.title, citation: entry.citation, url: entry.url, type: null },
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(typeof body?.error === 'string' ? body.error : 'That could not be saved.')
        return
      }
      await load()
    } finally { setBusy(false) }
  }, [ideaId, load])

  if (!data) return null

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-700 flex-1">
          What we found, by question
        </div>
        <span className="text-[11px] text-zinc-400">{data.totalEntries} in all</span>
      </div>

      {error && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">{error}</p>
      )}

      {data.headings.map((h) => {
        const isOpen = open[h.key] ?? (h.entries.length > 0 && h.entries.length <= 6)
        return (
          <div key={h.key} className="rounded-xl border border-zinc-200 overflow-hidden">
            <button
              onClick={() => setOpen((o) => ({ ...o, [h.key]: !isOpen }))}
              className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 text-left">
              <span className="text-xs font-semibold text-zinc-800 flex-1">{h.heading}</span>
              <span className="text-[11px] text-zinc-400">
                {h.entries.length ? h.entries.length : '—'}
              </span>
              <span className="text-[11px] text-zinc-400 w-3 text-center">{isOpen ? '−' : '+'}</span>
            </button>

            {/* ⚠ A STATED GAP IS ALWAYS SHOWN, open or closed. Folding it away would make an
                established absence indistinguishable from a heading nobody looked at, which
                is the exact failure this section exists to fix. */}
            {h.gap && (
              <div className={`px-3 py-2 text-xs border-t ${GAP_STYLE[h.gap.reason] ?? 'border-zinc-200 bg-zinc-50 text-zinc-600'}`}>
                {h.gap.text}
                {h.gap.reason === 'asked-found-nothing' && h.questionsRun.length > 0 && (
                  <span className="block mt-1 text-[11px] opacity-80">
                    Asked: {h.questionsRun.join(' · ')}
                  </span>
                )}
              </div>
            )}

            {isOpen && h.entries.length > 0 && (
              <div className="px-3 py-2.5 border-t border-zinc-100 space-y-2">
                {h.entries.map((e) => (
                  <EntryCard key={e.id} e={e} busy={busy}
                    onExclude={(entry, reason) => void decide(entry, 'EXCLUDED', reason)}
                    onInclude={(entry) => void decide(entry, 'INCLUDED')} />
                ))}
              </div>
            )}

            {/* §25.6 — adding a document or a link lives inside its own heading. */}
            {h.key === 'YOUR_MATERIAL' && (
              <div className="px-3 py-2.5 border-t border-zinc-100">
                <YourMaterial ideaId={ideaId} onChanged={() => void load()} />
              </div>
            )}
          </div>
        )
      })}

      {/* ⚠ NAMED, NOT DROPPED. §3: "a source with no heading is a gap in the library, not a
          source to drop." These are rows whose producer declared no heading — almost all of
          them written before 25-D. */}
      {data.unfiled.length > 0 && (
        <div className="rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-3 py-2 bg-zinc-50 text-xs font-semibold text-zinc-700">
            Not filed under a question ({data.unfiled.length})
          </div>
          <div className="px-3 py-2 border-t border-zinc-100">
            <p className="text-[11px] text-zinc-500 mb-2">
              These were found before we started filing findings by question, so we don’t know which
              one they answer. They are here rather than hidden.
            </p>
            <div className="space-y-2">
              {data.unfiled.map((e) => (
                <EntryCard key={e.id} e={e} busy={busy}
                  onExclude={(entry, reason) => void decide(entry, 'EXCLUDED', reason)}
                  onInclude={(entry) => void decide(entry, 'INCLUDED')} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
