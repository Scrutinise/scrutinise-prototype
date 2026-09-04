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
import { HEADINGS_ABOVE_DIVIDER } from '@/lib/lex/question-headings'
import YourMaterial from './YourMaterial'
import ClaimReview from './ClaimReview'
import OutputsPanel from './OutputsPanel'
import AgendaPanel from './AgendaPanel'
import BetaSearchNotice, { betaNoticeSeen, markBetaNoticeSeen } from './BetaSearchNotice'
import { positionsCaveat, tallyPositions } from '@/lib/lex/positions-caveat'

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

/**
 * 25-N §4 — what the header says when a SPECIAL item is open.
 *
 * ⚠ EVERY SPECIAL KEY NEEDS AN ENTRY. A user two clicks into a library needs to know what
 * they are looking at — that is the orientation fault 25-K existed to fix, and it reappears
 * one level down every time a special item is added without a title. 25-M added `__outputs`
 * to a two-branch ternary; this sprint adds five more, which is where a ternary stops being
 * a reasonable place for the answer.
 */
const SPECIAL_TITLES: Record<string, string> = {
  __outputs: 'Outputs',
  __decisions: 'Decisions',
  // ⚠ 25-Z §3 — renamed. See AgendaPanel's heading; both read from a decision, not a copy.
  __changed_mind: 'Notable Research',
  __inputs_retrieved: 'Everything we retrieved, by document type',
  __inputs_background: 'The basic idea — initial background',
  __unfiled: 'Not filed under a question',
}

/**
 * One row of the contents list.
 *
 * ⚠ EXTRACTED IN 25-N BECAUSE THE LIST IS NOW FOUR LISTS. §4's order splits the headings
 * across the divider and sinks the never-asked ones to the bottom, so the same row markup is
 * rendered in three places; three copies is two that will drift.
 */
function HeadingRow({
  h, onOpen,
}: {
  h: PanelData['headings'][number]
  onOpen: (key: string) => void
}) {
  const n = h.entries.length
  return (
    <li>
      <button
        onClick={() => onOpen(h.key)}
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
}

function EntryCard({
  e, onExclude, onInclude, onPrioritise, onMove, sections, currentHeading, busy, onOpenedSearchItem,
}: {
  e: PanelEntry
  onExclude: (entry: PanelEntry, reason: string) => void
  onInclude: (entry: PanelEntry) => void
  /** 25-L §3d — promote to the proposal document, or demote back to the annex. */
  onPrioritise: (entry: PanelEntry, on: boolean) => void
  /**
   * 25-N §4 — re-file this finding under a different heading.
   *
   * ⚠ ABSENT ON THE USER'S OWN DOCUMENTS, and that is not an oversight. The rows under "Your
   * material" are `IdeaUserMaterial`, not `EvidenceItem` — they have no `headingKey` to write,
   * and they belong under "Your material" by definition rather than by classification. A
   * control that looked identical and silently 404'd would be worse than none.
   */
  onMove?: (entry: PanelEntry, headingKey: string) => void
  /** Every live section, for the move menu. */
  sections: Array<{ key: string; heading: string }>
  /** The heading this card is currently filed under, so the menu can leave it out. */
  currentHeading: string | null
  /** ⚠ 25-Z §5c — fired the first time a search-derived entry is opened. See BetaSearchNotice. */
  onOpenedSearchItem?: () => void
  busy: boolean
}) {
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [moving, setMoving] = useState(false)
  // ⚠ 25-Z §1 — open the passage. Closed by default: a heading with fifty entries must stay
  // scannable, and the whole complaint is that there was no way to open one at all.
  const [open, setOpen] = useState(false)

  return (
    <div className={`rounded-lg border p-2.5 ${
      e.excluded ? 'border-zinc-200 bg-zinc-50' :
      e.bearsOnFocus ? 'border-blue-300 bg-blue-50/40' : 'border-zinc-200'
    }`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {/* ══ ⚠⚠ 25-Z §1 — THE TITLE OPENS THE PASSAGE. IT USED TO OPEN NOTHING. ══════════
              Charlie tapped entries under three headings and nothing happened. Two reasons,
              both here:
                · the title was an <a> ONLY when the row had a URL, and a plain <div>
                  otherwise — 10 of 21 rows under "Who has argued about this" have no URL, and
                  17 of 17 under "How hard will this be to achieve". Those were inert on any
                  device, which is why this is not an iPad problem;
                · and even where the link worked it left the platform, which is not what
                  "I want to read the debate" asks for.
              ⚠ THE TAP TARGET IS NOW THE WHOLE TITLE ROW, not a few words of text — a
              full-width button, which is what a thumb needs. The link to the original moves
              into the opened passage, where it reads as "and here is the original" rather
              than competing with it. */}
          <button
            type="button"
            onClick={() => {
              // ⚠ 25-Z §5c — the disclosure fires on the FIRST open of a SEARCH-DERIVED item,
              // which is this moment. Not on the user's own document: `yourSource` rows are
              // theirs, and telling somebody their own file may be off-topic is not what the
              // sentence is for. Reported upward; the panel decides whether it has been shown.
              if (!open && !e.yourSource) onOpenedSearchItem?.()
              setOpen((v) => !v)
            }}
            aria-expanded={open}
            className={`w-full text-left text-sm font-medium ${
              e.excluded ? 'text-zinc-400 line-through' : 'text-zinc-800 hover:text-zinc-950'
            }`}
          >
            {/* ⚠ A CHARACTER, NOT A COLOUR (docs/CLAUDE.md §21 — Charlie is colour blind).
                Two different glyphs, and the state also changes the block below. */}
            <span aria-hidden className="text-zinc-400 mr-1">{open ? '▾' : '▸'}</span>
            {e.title}
          </button>
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
                ★ In the report
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
            {/* ══ 25-N §3a — "ADD TO REPORT", AND A BALANCING "REMOVE FROM REPORT" ═══
                ⚠⚠ "MAKE PRIORITY" NAMED THE FLAG, NOT THE ACT. §3 gives the three columns one
                logic — raw material on the right, the draft report in the middle — and under
                that logic this button is the ONLY way anything crosses from one to the other.
                "Priority" describes a property of a source; "Add to report" describes what
                pressing it does, which is the thing a user needs to know before pressing it.

                ⚠ AND THE ON-STATE NOW SAYS WHAT PRESSING IT AGAIN WOULD DO. The old control
                read "★ Priority" when it was on — a label for the state, so the only way to
                learn it was also the way OUT was to press it and see. §3a asks for the
                balancing control explicitly, and this is it: same button, opposite verb.

                ⚠ THE STATE IS STILL NOT A COLOUR (docs/CLAUDE.md §21 — Charlie is colour
                blind). Filled star versus hollow, dark fill versus white, and two different
                verbs. Any one of the three survives greyscale. */}
            <button
              onClick={() => onPrioritise(e, !e.priority)}
              disabled={busy}
              aria-pressed={e.priority}
              title={e.priority
                ? 'This is in your report. Press to take it back out — it stays here in the research.'
                : 'Put this into DRAFT STRATEGY, the report itself. Its section heading goes with it.'}
              className={`text-[11px] rounded border-2 px-1.5 py-0.5 disabled:opacity-40 whitespace-nowrap ${
                e.priority
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              <span aria-hidden>{e.priority ? '★' : '☆'}</span>{' '}
              {e.priority ? 'Remove from report' : 'Add to report'}
            </button>
            {/* ══ 25-N §4 — KEEP IT, MOVE IT ═══════════════════════════════════
                Charlie's example: a Braverman incident filed under one heading that belongs
                under "Who has argued about this" or "How hard will this be to achieve".
                Until now the only thing a user could do with a misfiled finding was set it
                aside, which removes the material rather than re-shelving it. */}
            {onMove && (
              <button onClick={() => setMoving((v) => !v)} disabled={busy}
                aria-expanded={moving}
                title="File this under a different section. Nothing else about it changes."
                className="text-[11px] text-zinc-400 hover:text-zinc-700 disabled:opacity-40">
                Move…
              </button>
            )}
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

      {/* ══ 25-P §2d — WHEN IT IS FROM, AND WHAT THAT MAKES IT ══════════════════════
          §2c: an undated row must be VISIBLY undated, never silently assumed current.

          ⚠⚠ THE SIGNAL IS THE WORD, NOT THE COLOUR. Charlie is colour blind and this
          repository's rule is that hue is never the only cue: the marker is a character
          (⚠ or ·) AND a sentence that says what to do about it. Removing the colour here
          would lose nothing.

          ⚠ A CURRENT SOURCE WITH FIGURES BEHIND IT SAYS SO PLAINLY AND QUIETLY. Marking
          every card marks none of them. */}
      <p className={`text-xs mt-1.5 ${
        e.staleness === 'CURRENT' && e.standing === 'EVIDENCE'
          ? 'text-zinc-400'
          : 'text-zinc-700 font-medium'
      }`}>
        <span aria-hidden="true">
          {e.staleness === 'CURRENT' && e.standing === 'EVIDENCE' ? '· ' : '⚠ '}
        </span>
        {e.standingLabel}
      </p>

      {/* ══ ⚠⚠ 25-Z §1c — THE PASSAGE, ITS SOURCE, ITS DATE AND A ROUTE TO THE ORIGINAL ═══
          The platform's promise is that every finding traces to its source. Until now the
          card showed a title, a badge and one sentence of why — and the passage the finding
          was drawn from, which is already in the row, never left the server. */}
      {open && (
        <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5">
          {e.body?.trim() ? (
            <p className="text-xs text-zinc-800 whitespace-pre-wrap leading-relaxed">{e.body.trim()}</p>
          ) : (
            // ⚠ AN HONEST NOTHING. A row with no stored passage says so, rather than opening
            // to an empty box the user reads as a failure of the control they just pressed.
            <p className="text-xs text-zinc-500 italic">
              No passage was stored for this one — only the reference above.
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
            {e.citation && <span className="font-medium text-zinc-700">{e.citation}</span>}
            {/* ⚠ The date is the one the evidence layer stored, with its own basis already
                reflected in the standing line above; an undated row shows nothing here rather
                than today's date. */}
            {e.sourceDate && <span>{e.sourceDate}</span>}
            {e.url ? (
              <a href={e.url} target="_blank" rel="noopener noreferrer"
                className="font-medium text-zinc-700 underline hover:text-zinc-950">
                Open the original ↗
              </a>
            ) : (
              // ⚠ SAYS WHY THERE IS NO LINK. "No link" on its own reads as a broken card.
              <span className="italic">No link was recorded for this source.</span>
            )}
          </div>
        </div>
      )}

      {e.excluded && (
        <p className="text-xs mt-1.5 text-zinc-500">
          <span className="font-medium">Set aside:</span>{' '}
          {e.exclusionReason || 'no reason recorded'}
        </p>
      )}

      {moving && onMove && !e.excluded && (
        <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50/70 p-2 space-y-1.5">
          <p className="text-[11px] text-zinc-600">
            File this under a different section. It keeps everything else — whether it is in your
            report, whether you set it aside, and the reason recorded for it.
          </p>
          <div className="flex flex-wrap gap-1">
            {sections
              .filter((sec) => sec.key !== currentHeading)
              .map((sec) => (
                <button
                  key={sec.key}
                  disabled={busy}
                  onClick={() => { onMove(e, sec.key); setMoving(false) }}
                  className="text-[11px] rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-zinc-700 hover:border-blue-400 hover:text-blue-700 disabled:opacity-40"
                >
                  {sec.heading}
                </button>
              ))}
          </div>
          <button onClick={() => setMoving(false)}
            className="text-[11px] text-zinc-500 hover:text-zinc-800">Cancel</button>
        </div>
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
  ideaId, focusFieldRef, refreshKey, inputs, notices, onChanged,
}: {
  ideaId: string
  /** What the user is reading — §3 rule 3. Orders and marks; never filters. */
  focusFieldRef?: string | null
  /** Bumped by the parent when something upstream may have changed the evidence. */
  refreshKey?: number
  /**
   * ══ 25-N §4 — THE "INPUTS" GROUP, HANDED IN RATHER THAN RE-RENDERED ═════════
   *
   * §4 makes Inputs a new group holding *"Everything we retrieved, by document type"* and
   * *"The basic idea — initial background"*. Both of those already exist, in
   * `BackgroundPanel`, built from canonical state this component does not have and must not
   * fetch a second copy of.
   *
   * ⚠⚠ AND MOVING THEM IN HERE IS WHAT FIXES *"clicking a contents item shows neighbouring
   * sections too"*. That was never a bug in the contents list: `QuestionPanel` renders one
   * item correctly, and then `BackgroundPanel` carried on rendering the retrieved-by-type
   * fold, the stage search, the exports and the page-one source cards UNDERNEATH it. The
   * library sat on top of a scroll. Passing them in as nodes means one component decides
   * what is on screen, so "one item only" can actually be true.
   */
  inputs?: { retrieved?: React.ReactNode; background?: React.ReactNode }
  /**
   * 25-N §4 — status notices, rendered on the contents home and NOWHERE ELSE.
   *
   * ⚠ THEY ARE STATUS, NOT SECTIONS. "This section's search hasn't run", "the corpus search
   * didn't complete", the open Deepening pass's own retrieval — a user needs those while
   * looking at the list of what exists, and NOT underneath an open committee report, which is
   * the same category error as the retrieved list being there.
   */
  notices?: React.ReactNode
  /** Called after anything that changes what is in the report, so the middle column re-reads. */
  onChanged?: () => void
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
  /** ⚠ 25-Z §5c — the one-time evidence-base disclosure. See `BetaSearchNotice`. */
  const [showBetaNotice, setShowBetaNotice] = useState(false)

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
      onChanged?.()
    } finally { setBusy(false) }
  }, [ideaId, load, onChanged])

  /** 25-N §4 — re-file a finding under a different heading. See the route's PATCH note. */
  const move = useCallback(async (entry: PanelEntry, headingKey: string) => {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/panel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: entry.id, headingKey }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(typeof body?.error === 'string' ? body.error : 'That could not be moved.')
        return
      }
      // ⚠ THE RESPONSE IS THE WHOLE PANEL, so the card lands under its new heading without a
      // second round trip — and without this component computing where it went, which would
      // be a second implementation of the filing rule.
      setData(await res.json())
    } finally { setBusy(false) }
  }, [ideaId])

  if (!data) return null

  const openHeading = openKey ? data.headings.find((h) => h.key === openKey) ?? null : null
  const prioritised = data.headings.flatMap((h) => h.entries).filter((e) => e.priority).length

  // ══ 25-N §4 — THE THREE GROUPS THE HEADINGS FALL INTO ═══════════════════════
  //
  // ⚠ `notAsked` IS DECIDED BY THE EMPTY REASON, NOT BY THE COUNT. §4 sinks *anything "not
  // asked of this draft"* to the bottom — and "we asked and found nothing" is a FINDING that
  // belongs in the body of the list, while "this was never asked" is housekeeping. Sorting
  // both to the bottom because both are empty would bury a real result with a non-result,
  // which is the distinction `question-headings.ts` exists to keep.
  const isNotAsked = (h: PanelData['headings'][number]) =>
    h.entries.length === 0 && h.gap?.reason === 'not-asked'
  const above = data.headings.filter(
    (h) => (HEADINGS_ABOVE_DIVIDER as string[]).includes(h.key) && !isNotAsked(h),
  )
  const rest = data.headings.filter(
    (h) => !(HEADINGS_ABOVE_DIVIDER as string[]).includes(h.key) && !isNotAsked(h),
  )
  const notAsked = data.headings.filter(isNotAsked)

  const cardProps = {
    busy,
    // ⚠ 25-Z §5c — one handler, shared by every card, so the notice cannot fire from one list
    // and not another. `showBetaNotice` decides; the card only reports the event.
    onOpenedSearchItem: () => {
      if (!betaNoticeSeen()) setShowBetaNotice(true)
    },
    onExclude: (entry: PanelEntry, reason: string) => void decide(entry, 'EXCLUDED', reason),
    onInclude: (entry: PanelEntry) => void decide(entry, 'INCLUDED'),
    // 25-L §3d — demoting goes back to INCLUDED, never to "no decision". The user HAS
    // decided; forgetting that would make the annex treat it as a source nobody looked at.
    onPrioritise: (entry: PanelEntry, on: boolean) => void decide(entry, on ? 'PRIORITY' : 'INCLUDED'),
    // §4 — every live section is a destination. `data.headings` is already in HEADING_ORDER.
    sections: data.headings.map((h) => ({ key: h.key, heading: h.heading })),
  }

  return (
    <div className="space-y-3">
      {/* ══ ⚠⚠ 25-Z §5c — SHOWN ONCE, WHEN IT IS RELEVANT ══════════════════════════════════
          The disclosure left THE RESEARCH's header, where it rendered on every paint and had
          become furniture. It appears the first time this user opens a search-derived entry —
          the moment the sentence is actually about — and never again on this browser. */}
      {showBetaNotice && (
        <BetaSearchNotice onClose={() => { markBetaNoticeSeen(); setShowBetaNotice(false) }} />
      )}
      {/* ══ 25-L §3a — THE HEADER, AND THE WAY HOME ══════════════════════
          ⚠ THE HOME CONTROL IS A BUTTON WITH A WORD ON IT, not a bare ‹ chevron. A user who
          has gone two items deep into a library needs to know what pressing it returns them
          TO; "Contents" says so and an arrow does not. */}
      <div className="flex items-baseline gap-2">
        {openKey ? (
          <button
            onClick={() => setOpenKey(null)}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 border-2 border-blue-200 rounded-full px-2 py-0.5"
          >
            <span aria-hidden>←</span> Contents
          </button>
        ) : (
          // ⚠ 25-N §2 — THE "RESOURCES" HEADING IS DELETED. The column is titled THE RESEARCH
          // one line above this; a second heading naming the same panel something else was
          // one of the three words a user had to reconcile before they could navigate.
          <div className="flex-1" />
        )}
        {openHeading && (
          <div className="text-xs font-semibold text-zinc-800 flex-1 truncate">{openHeading.heading}</div>
        )}
        {/* ⚠ THE SPECIAL ITEMS NAME THEMSELVES TOO. Without this the header says "Resources"
            over the outputs, and a user two clicks in cannot tell what they are looking at —
            which is the orientation fault 25-K existed to fix, reappearing one level down. */}
        {!openHeading && openKey && (
          <div className="text-xs font-semibold text-zinc-800 flex-1 truncate">
            {SPECIAL_TITLES[openKey] ?? 'Not filed under a question'}
          </div>
        )}
        <span className="text-[11px] text-zinc-400">{data.totalEntries} in all</span>
      </div>

      {error && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">{error}</p>
      )}

      {/* ══ 25-N §4 — THE CONTENTS, IN THE ORDER CHARLIE GAVE ═══════════════════
          **Decisions · Outputs · How hard will this be to achieve? · divider · Inputs ·
          everything else · anything "not asked of this draft" at the bottom.**

          ⚠ EVERY ITEM IS STILL LISTED, INCLUDING THE EMPTY ONES, and an empty one says WHICH
          KIND of empty it is rather than showing a zero. A "0" beside "How the courts have
          read it" is a false statement about the world whenever the real answer is "we did not
          ask" or "we cannot answer this yet". That rule is 25-D's and it survives the reorder.

          ⚠⚠ AND THE BOTTOM GROUP IS NOT A STYLING CHOICE. §4 puts *anything "not asked of this
          draft"* last, which means the ordering now depends on a heading's EMPTY REASON as
          well as its key — `not-asked` sinks. A user scanning this list should meet what we
          have, then what we looked for and did not find, then what was never asked.

          ⚠ THE HEADING HALF OF THE ORDER IS THE SERVER'S (`HEADING_ORDER`), not this file's.
          What is decided here is only where the SPECIAL items — which are not headings — sit
          among them, and where the divider falls. */}
      {!openKey && (
        <>
          {/* §4 — status first: what did not run, what failed, what pass is open. */}
          {notices}

          {/* §2 — Charlie's wording, verbatim, and it replaces both deleted headings. */}
          <p className="text-[11px] text-zinc-500">Everything Lex found or worked out:</p>

          {/* ── ABOVE THE DIVIDER: what you have to act on ──────────────────── */}
          <ul className="space-y-1">
            {/* ⚠⚠ 25-N §3b/§4 — DECISIONS COMES FIRST, AND IT MOVED HERE FROM THE MIDDLE
                COLUMN. §3's logic: the middle holds the report, the right holds the raw
                material and the judgements to be made about it. §4 puts it at the top of this
                list because it is the only item that is waiting on the user. */}
            <li>
              <button
                onClick={() => setOpenKey('__decisions')}
                className="w-full flex items-baseline gap-2 rounded-lg border-2 border-zinc-800 bg-white px-3 py-2 text-left hover:bg-zinc-50"
              >
                <span className="text-sm font-semibold text-zinc-900 flex-1">Decisions</span>
                <span className="text-[11px] text-zinc-500">choices waiting on you</span>
                <span aria-hidden className="text-zinc-300 text-xs">›</span>
              </button>
            </li>
            {/* §3b — the other half of what moved out of the middle column. It sits beside
                Decisions because it is the same kind of thing: something Lex did, for the
                user to judge. */}
            <li>
              <button
                onClick={() => setOpenKey('__changed_mind')}
                className="w-full flex items-baseline gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-left hover:border-zinc-400 hover:bg-zinc-50"
              >
                <span className="text-sm flex-1 text-zinc-800">Notable Research</span>
                <span aria-hidden className="text-zinc-300 text-xs">›</span>
              </button>
            </li>
            {/* ══ 25-M §1 — OUTPUTS, SET APART ═══════════════════════════════
                §1: "a user finishes a build and there is nothing to take away without leaving
                the page they are working on." It is a different KIND of item from the
                questions below: those are about the world, this is the thing you take away. */}
            <li>
              <button
                onClick={() => setOpenKey('__outputs')}
                className="w-full flex items-baseline gap-2 rounded-lg border-2 border-zinc-300 bg-white px-3 py-2 text-left hover:border-zinc-500 hover:bg-zinc-50"
              >
                <span className="text-sm font-semibold text-zinc-900 flex-1">Outputs</span>
                <span className="text-[11px] text-zinc-500">what you can take away</span>
                <span aria-hidden className="text-zinc-300 text-xs">›</span>
              </button>
            </li>
            {above.map((h) => <HeadingRow key={h.key} h={h} onOpen={setOpenKey} />)}
          </ul>

          {/* §4's divider — above it, what you act on; below it, what it was built from. */}
          <hr className="border-zinc-200" />

          {/* ══ 25-N §4 — INPUTS, A NEW GROUP ══════════════════════════════════
              §4: a group holding "Everything we retrieved, by document type" and "The basic
              idea — initial background". Both were loose at the bottom of the panel, below the
              contents list rather than in it — which is how they ended up on screen underneath
              whatever item the user had opened. */}
          {(inputs?.retrieved || inputs?.background) && (
            <ul className="space-y-1">
              <li className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 pt-1">
                Inputs
              </li>
              {inputs?.retrieved && (
                <li>
                  <button
                    onClick={() => setOpenKey('__inputs_retrieved')}
                    className="w-full flex items-baseline gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-left hover:border-zinc-400 hover:bg-zinc-50"
                  >
                    <span className="text-sm flex-1 text-zinc-800">Everything we retrieved, by document type</span>
                    <span aria-hidden className="text-zinc-300 text-xs">›</span>
                  </button>
                </li>
              )}
              {inputs?.background && (
                <li>
                  <button
                    onClick={() => setOpenKey('__inputs_background')}
                    className="w-full flex items-baseline gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-left hover:border-zinc-400 hover:bg-zinc-50"
                  >
                    <span className="text-sm flex-1 text-zinc-800">The basic idea — initial background</span>
                    <span aria-hidden className="text-zinc-300 text-xs">›</span>
                  </button>
                </li>
              )}
            </ul>
          )}

          {/* ── EVERYTHING ELSE ────────────────────────────────────────────── */}
          <ul className="space-y-1">
            {rest.map((h) => <HeadingRow key={h.key} h={h} onOpen={setOpenKey} />)}
          </ul>

          {/* ── AND ANYTHING NOT ASKED OF THIS DRAFT, AT THE BOTTOM ─────────── */}
          {(notAsked.length > 0 || data.unfiled.length > 0) && (
            <ul className="space-y-1">
              <li className="text-[11px] text-zinc-400 pt-1">Not asked of this draft</li>
              {notAsked.map((h) => <HeadingRow key={h.key} h={h} onOpen={setOpenKey} />)}
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
          )}

          {/* §3a — the count of what has crossed into the middle column, said in the
              vocabulary of the act rather than of the flag. */}
          <p className="text-[11px] text-zinc-500">
            {prioritised
              ? `${prioritised} ${prioritised === 1 ? 'item is' : 'items are'} in your report — they appear in DRAFT STRATEGY under their own headings. Everything else stays here, and goes into the evidence annex.`
              : 'Nothing has been added to your report yet. Open an item and use \u201cAdd to report\u201d on anything that belongs in it \u2014 nothing crosses into the middle column on its own.'}
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
            <EntryCard
              key={e.id}
              e={e}
              {...cardProps}
              currentHeading={openHeading.key}
              // ⚠ NO MOVE CONTROL ON THE USER'S OWN DOCUMENTS. Those rows are
              // `IdeaUserMaterial`, not `EvidenceItem` — there is no `headingKey` to write,
              // and they belong under "Your material" by definition. A control that looked
              // the same and silently 404'd would be worse than none.
              onMove={openHeading.key === 'YOUR_MATERIAL' ? undefined : move}
            />
          ))}

          {/* ══ 25-L §5 — THE PEOPLE GRAPH, IN BETA, JUDGED BLIND FIRST ═══════
              ⚠ IT SITS UNDER `POSITIONS`, which until now was the one heading with no
              producer at all — "we hold the voting record and Lex cannot read it". It can
              now, and the first thing it does with it is ask the user whether it is right
              before telling them what it thinks. */}
          {/* ══ ⚠⚠ 25-Z §2c — THE CHALLENGES, UNDER THE QUESTION THEY ANSWER ═══════════════
              They were in the middle panel, in a box, below the kernel — which Charlie says
              made them look more important than the kernel itself. "How hard will this be to
              achieve?" is the question a challenge is an answer to, so this is where they go.
              ⚠ Nothing is deleted and nothing is duplicated: the `work` view no longer
              renders them. */}
          {openHeading.key === 'HOW_HARD' && (
            <AgendaPanel ideaId={ideaId} view="challenges" />
          )}

          {/* ══ ⚠⚠ 26-A §3 (DECISION 70) — WHAT IS BEHIND THIS SECTION, AND WHOSE IT IS ═══════
              The heading promises an assessment of who is for and against. On 3 September the
              single item under it had been extracted from a document Charlie uploaded himself,
              by no Lex pass at all — so the section handed the proposer back their own sentence
              under a heading claiming research.
              ⚠ Computed from the rows on every render, never written down: the note next door
              (`NO_PRODUCER_NOTE.POSITIONS`) is the cautionary tale, a sentence that was true
              when typed and outlived its own truth. */}
          {openHeading.key === 'POSITIONS' && (
            <p className="text-xs text-zinc-700 border-l-2 border-zinc-400 pl-2 py-0.5 leading-snug">
              {positionsCaveat(tallyPositions(openHeading.entries))}
            </p>
          )}

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

      {openKey === '__outputs' && <OutputsPanel ideaId={ideaId} />}

      {/* ══ 25-N §3b — THE TWO THAT MOVED OUT OF THE MIDDLE COLUMN ═════════════
          ⚠ ONE COMPONENT, ONE `view`. `AgendaPanel` renders its own sections; passing the
          view rather than lifting the markup means the decision handler, the fork grouping
          and the "I didn't record why I chose this" honesty note stay in one place. */}
      {openKey === '__decisions' && <AgendaPanel ideaId={ideaId} view="judgements" />}
      {openKey === '__changed_mind' && <AgendaPanel ideaId={ideaId} view="judgements" />}

      {/* §4 — the Inputs group's two items, handed in by the panel that owns their data. */}
      {openKey === '__inputs_retrieved' && inputs?.retrieved}
      {openKey === '__inputs_background' && inputs?.background}

      {openKey === '__unfiled' && (
        <div className="space-y-2">
          <p className="text-[11px] text-zinc-500">
            These were found before we started filing findings by question, so we don’t know which
            one they answer. They are here rather than hidden.
          </p>
          {/* ⚠ THE MOVE CONTROL MATTERS MOST HERE. These are the rows we could not file at
              all; giving the user somewhere to put them is the difference between "not filed
              under a question" being a permanent shelf and being a queue. */}
          {data.unfiled.map((e) => (
            <EntryCard key={e.id} e={e} {...cardProps} currentHeading={null} onMove={move} />
          ))}
        </div>
      )}

    </div>
  )
}
