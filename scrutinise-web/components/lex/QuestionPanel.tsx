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
//
// ══ 25-L §3 — IT IS A LIBRARY NOW, NOT A SCROLL ══════════════════════════
//
// ⚠⚠ §3a: "Without this the panel is a scroll, and a scroll is where things go to be
// missed." Thirteen headings stacked vertically, each independently collapsible, is a
// filing cabinet with every drawer half open. The panel now opens on a CONTENTS list —
// every item with its count, or the KIND of empty it is — and choosing one shows that one,
// with a home button back.
//
// ⚠ THE CONTENTS ARE DRIVEN FROM THE PASSES (§3b). `question-panel.ts` computes which
// headings have a producer from the question and pass configs, so a new pass appears here
// without anyone editing this file. What is hardcoded is the VOCABULARY of headings, which
// is a shared language the document stack reads too — not the list of what exists.
//
// ⚠ AND AN EMPTY ITEM STAYS ON THE CONTENTS LIST, SAYING WHICH KIND OF EMPTY IT IS. An
// item that disappeared when it had nothing in it would teach the user it does not exist,
// and "not asked of your draft" and "asked and found nothing" are different facts.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import type { QuestionPanel as PanelData, PanelEntry } from '@/lib/lex/question-panel'
import YourMaterial from './YourMaterial'
import ClaimReview from './ClaimReview'

/**
 * §3b — what an EMPTY item says on the contents list, in three or four words.
 *
 * ⚠ FOUR DIFFERENT ANSWERS, NEVER "0". A zero beside "How the courts have read it" tells
 * the user the courts have said nothing, which may be a false statement about the world made
 * to cover a gap in our tooling. The contents list is the first thing they read, so it is
 * the first place the distinction has to survive.
 */
const EMPTY_LABEL: Record<string, string> = {
  'no-producer': 'we can\u2019t answer this yet',
  'not-asked': 'not asked of your draft',
  'asked-found-nothing': 'looked, found nothing',
  'nothing-added': 'nothing added yet',
}

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
  e, onExclude, onInclude, onPrioritise, busy,
}: {
  e: PanelEntry
  onExclude: (entry: PanelEntry, reason: string) => void
  onInclude: (entry: PanelEntry) => void
  /** 25-L §3d — promote to the proposal document, or demote back to the annex. */
  onPrioritise: (entry: PanelEntry, on: boolean) => void
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
            {/* ⚠ THE TAG IS READABLE ON THE CARD, not only on the button that sets it — a
                state you can only see by looking at a control's appearance is a state you
                cannot scan a list for. */}
            {e.priority && !e.excluded && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-800 text-white">
                ★ In the document
              </span>
            )}
            {e.citation && <span className="text-[11px] text-zinc-500 truncate">{e.citation}</span>}
          </div>
        </div>
        {!e.excluded ? (
          <div className="flex items-center gap-1.5 shrink-0">
            {/* ══ 25-L §3d — PRIORITY, AND IT IS NOT A COLOUR ════════════════
                Charlie is colour blind (docs/CLAUDE.md §21), so the state carries a FILLED
                versus HOLLOW star — two different characters, not one recoloured — plus the
                word, plus a 2px border. Any one of the three survives greyscale.
                ⚠ The tag is not decorative: a priority source is printed in the proposal
                document itself, and everything else goes to the evidence annex. */}
            <button
              onClick={() => onPrioritise(e, !e.priority)}
              disabled={busy}
              aria-pressed={e.priority}
              title={e.priority
                ? 'In the proposal document. Press to move it back to the evidence annex.'
                : 'Put this in the proposal document itself, not only the annex.'}
              className={`text-[11px] rounded border-2 px-1.5 py-0.5 disabled:opacity-40 ${
                e.priority
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              <span aria-hidden>{e.priority ? '★' : '☆'}</span>{' '}
              {e.priority ? 'Priority' : 'Make priority'}
            </button>
            <button onClick={() => setAsking((v) => !v)} disabled={busy}
              className="text-[11px] text-zinc-400 hover:text-zinc-700 disabled:opacity-40">
              Set aside
            </button>
          </div>
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
  /**
   * ⚠⚠ 25-L §3a — WHICH ITEM IS OPEN, OR NULL FOR THE CONTENTS.
   *
   * `null` is the home state and it is the DEFAULT, which is the whole change. Thirteen
   * headings all rendered at once, each with its own collapse, is a scroll — and §3a is
   * right that a scroll is where things go to be missed. One item at a time, chosen from a
   * list that shows what is in each.
   */
  const [openKey, setOpenKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const qs = focusFieldRef ? `?field=${encodeURIComponent(focusFieldRef)}` : ''
      const res = await fetch(`/api/ideas/${ideaId}/panel${qs}`)
      if (!res.ok) return
      setData(await res.json())
    } catch { /* a panel that cannot load renders nothing rather than a broken shell */ }
  }, [ideaId, focusFieldRef])

  useEffect(() => { void load() }, [load, refreshKey])

  const decide = useCallback(async (entry: PanelEntry, status: 'INCLUDED' | 'EXCLUDED' | 'PRIORITY', reason?: string) => {
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

  const openHeading = openKey ? data.headings.find((h) => h.key === openKey) ?? null : null
  const prioritised = data.headings.flatMap((h) => h.entries).filter((e) => e.priority).length

  const cardProps = {
    busy,
    onExclude: (entry: PanelEntry, reason: string) => void decide(entry, 'EXCLUDED', reason),
    onInclude: (entry: PanelEntry) => void decide(entry, 'INCLUDED'),
    // 25-L §3d — demoting goes back to INCLUDED, never to "no decision". The user HAS
    // decided; forgetting that would make the annex treat it as a source nobody looked at.
    onPrioritise: (entry: PanelEntry, on: boolean) => void decide(entry, on ? 'PRIORITY' : 'INCLUDED'),
  }

  return (
    <div className="space-y-3">
      {/* ══ 25-L §3a — THE HEADER, AND THE WAY HOME ══════════════════════
          ⚠ THE HOME CONTROL IS A BUTTON WITH A WORD ON IT, not a bare ‹ chevron. A user who
          has gone two items deep into a library needs to know what pressing it returns them
          TO; "Contents" says so and an arrow does not. */}
      <div className="flex items-baseline gap-2">
        {openHeading ? (
          <button
            onClick={() => setOpenKey(null)}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 border-2 border-blue-200 rounded-full px-2 py-0.5"
          >
            <span aria-hidden>←</span> Contents
          </button>
        ) : (
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-700 flex-1">
            Resources
          </div>
        )}
        {openHeading && (
          <div className="text-xs font-semibold text-zinc-800 flex-1 truncate">{openHeading.heading}</div>
        )}
        <span className="text-[11px] text-zinc-400">{data.totalEntries} in all</span>
      </div>

      {error && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">{error}</p>
      )}

      {/* ══ THE CONTENTS ═══════════════════════════════════════
          ⚠ EVERY ITEM IS LISTED, INCLUDING THE EMPTY ONES, and an empty one says WHICH KIND
          of empty it is rather than showing a zero. A "0" beside "How the courts have read
          it" is a false statement about the world whenever the real answer is "we did not
          ask" or "we cannot answer this yet".

          ⚠ THE ORDER IS `HEADING_ORDER`, computed on the server — settled law first, the
          strongest case against last. It is the design, not the order this file happens to
          render in. */}
      {!openHeading && (
        <>
          <p className="text-[11px] text-zinc-500">
            Everything Lex found or worked out about the world, filed under the question it answers.
            Choose one.
          </p>
          <ul className="space-y-1">
            {data.headings.map((h) => {
              const n = h.entries.length
              return (
                <li key={h.key}>
                  <button
                    onClick={() => setOpenKey(h.key)}
                    className="w-full flex items-baseline gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-left hover:border-zinc-400 hover:bg-zinc-50"
                  >
                    <span className={`text-sm flex-1 ${n ? 'font-medium text-zinc-800' : 'text-zinc-500'}`}>
                      {h.heading}
                    </span>
                    {n > 0 ? (
                      <span className="text-xs font-semibold text-zinc-700">{n}</span>
                    ) : (
                      <span className="text-[11px] text-zinc-400">
                        {h.gap ? EMPTY_LABEL[h.gap.reason] ?? 'nothing here' : 'nothing here'}
                      </span>
                    )}
                    <span aria-hidden className="text-zinc-300 text-xs">›</span>
                  </button>
                </li>
              )
            })}
            {data.unfiled.length > 0 && (
              <li>
                <button
                  onClick={() => setOpenKey('__unfiled')}
                  className="w-full flex items-baseline gap-2 rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-left hover:border-zinc-400 hover:bg-zinc-50"
                >
                  <span className="text-sm flex-1 text-zinc-500">Not filed under a question</span>
                  <span className="text-xs font-semibold text-zinc-700">{data.unfiled.length}</span>
                  <span aria-hidden className="text-zinc-300 text-xs">›</span>
                </button>
              </li>
            )}
          </ul>
          {/* §3d — the tagging is the input to the document, so the count belongs where the
              user can see whether they have done any of it. */}
          <p className="text-[11px] text-zinc-500">
            {prioritised
              ? `${prioritised} source${prioritised === 1 ? '' : 's'} marked as a priority — those go in the proposal document itself; everything else goes in the evidence annex.`
              : 'Nothing is marked as a priority yet. Open an item and star the sources that belong in the proposal document itself.'}
          </p>
        </>
      )}

      {/* ══ ONE ITEM ══════════════════════════════════════════ */}
      {openHeading && (
        <div className="space-y-2">
          {/* ⚠ A STATED GAP IS SHOWN IN FULL HERE, not summarised as it is on the contents
              list. The list answers "is there anything in this"; the item answers "what did
              you look for, and what happened" — which is the sentence the user can tell us
              is the wrong thing to have looked for. */}
          {openHeading.gap && (
            <div className={`rounded-lg border px-3 py-2 text-xs ${GAP_STYLE[openHeading.gap.reason] ?? 'border-zinc-200 bg-zinc-50 text-zinc-600'}`}>
              {openHeading.gap.text}
              {openHeading.gap.reason === 'asked-found-nothing' && openHeading.questionsRun.length > 0 && (
                <span className="block mt-1 text-[11px] opacity-80">
                  Asked: {openHeading.questionsRun.join(' · ')}
                </span>
              )}
            </div>
          )}

          {openHeading.entries.map((e) => (
            <EntryCard key={e.id} e={e} {...cardProps} />
          ))}

          {/* ══ 25-L §5 — THE PEOPLE GRAPH, IN BETA, JUDGED BLIND FIRST ═══════
              ⚠ IT SITS UNDER `POSITIONS`, which until now was the one heading with no
              producer at all — "we hold the voting record and Lex cannot read it". It can
              now, and the first thing it does with it is ask the user whether it is right
              before telling them what it thinks. */}
          {openHeading.key === 'POSITIONS' && (
            <ClaimReview ideaId={ideaId} />
          )}

          {/* §25.6 — adding a document or a link lives inside its own item. */}
          {openHeading.key === 'YOUR_MATERIAL' && (
            <div className="rounded-lg border border-zinc-200 p-2.5">
              <YourMaterial ideaId={ideaId} onChanged={() => void load()} />
            </div>
          )}
        </div>
      )}

      {openKey === '__unfiled' && (
        <div className="space-y-2">
          <p className="text-[11px] text-zinc-500">
            These were found before we started filing findings by question, so we don’t know which
            one they answer. They are here rather than hidden.
          </p>
          {data.unfiled.map((e) => (
            <EntryCard key={e.id} e={e} {...cardProps} />
          ))}
        </div>
      )}

    </div>
  )
}
