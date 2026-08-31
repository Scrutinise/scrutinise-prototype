'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-N §3a — WHAT THE USER HAS PUT IN THE REPORT, IN THE REPORT.
//
// ⚠⚠ §3 IS THE STRUCTURAL CHANGE AND THIS IS ITS VISIBLE HALF: *"raw material on the right ·
// the draft report in the middle · notes and chat on the left"*, and *"the middle column
// holds only what is going in the report. Nothing arrives there until the user puts it
// there."*
//
// Until now "Add to report" (25-L's "Make priority") set a flag that changed NOTHING on
// screen. Its only effect was inside a generated .docx, which is to say: the user pressed a
// button, the button went dark, and the consequence was invisible until they exported a file
// and read it. That is a control with no feedback, and it is why the middle column and the
// right column read as two lists of similar-looking things rather than as a report and the
// material it was built from.
//
// ⚠ THE HEADING TRAVELS WITH THE FIRST ITEM. §3a: *"When the first item from a section is
// added, that section's heading appears in the middle column with it."* So the middle column
// grows the shape of the report as the user builds it, rather than presenting an empty
// skeleton of thirteen headings waiting to be filled.
//
// ⚠ IT READS THE SAME ENDPOINT THE RIGHT PANEL READS, and the same `priority` flag the
// document generator reads. Three surfaces, one fact. A second store of "what is in the
// report" is a second answer to the only question this column exists to answer.
//
// ⚠ AND REMOVING IS HERE TOO. A user looking at their report is the one most likely to
// decide something does not belong in it, and making them go and find the card in the other
// column to take it out is the asymmetry §3a's "balancing Remove from report" is about.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import type { QuestionPanel as PanelData, PanelEntry } from '@/lib/lex/question-panel'
import CollapsedSection from './CollapsedSection'

export default function ReportAdditions({
  ideaId, refreshKey, onChanged,
}: {
  ideaId: string
  /** Bumped by the parent when something may have changed what is in the report. */
  refreshKey?: number
  /** Called after a removal, so the right-hand panel can re-read its own copy. */
  onChanged?: () => void
}) {
  const [data, setData] = useState<PanelData | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/panel`)
      if (!res.ok) return
      setData(await res.json())
    } catch { /* a section that cannot load renders nothing rather than a broken shell */ }
  }, [ideaId])

  useEffect(() => { void load() }, [load, refreshKey])

  const removeFromReport = useCallback(async (entry: PanelEntry) => {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/sources`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // ⚠ BACK TO `INCLUDED`, NEVER TO "NO DECISION" — 25-L §3d's rule. The user HAS
          // considered it; forgetting that would make the evidence annex treat it as a
          // source nobody looked at.
          sourceKey: entry.id,
          status: 'INCLUDED',
          reason: null,
          source: { title: entry.title, citation: entry.citation, url: entry.url, type: null },
        }),
      })
      if (!res.ok) { setError('That could not be taken out of the report.'); return }
      await load()
      onChanged?.()
    } finally { setBusy(false) }
  }, [ideaId, load, onChanged])

  if (!data) return null

  // ⚠ THE HEADING ORDER IS THE SERVER'S, not this file's. `data.headings` arrives in
  // `HEADING_ORDER`, which the right-hand panel and the long report both read — so the
  // sections appear here in the same order they appear there and in the document.
  const sections = data.headings
    .map((h) => ({ key: h.key, heading: h.heading, entries: h.entries.filter((e) => e.priority && !e.excluded) }))
    .filter((h) => h.entries.length > 0)

  const total = sections.reduce((n, h) => n + h.entries.length, 0)

  return (
    // ══ ADDENDUM §A2 — CLOSED BY DEFAULT ═══════════════════════════════════════
    //
    // ⚠ THE COUNT AND THE HINT ARE ON THE CLOSED HEADER, which is what makes opening it a
    // decision rather than a search. A user with nothing in their report can read that fact
    // without opening anything; a user with six items can see there are six.
    <CollapsedSection
      title="What you have put in the report"
      count={total}
      hint={total === 0
        ? 'Nothing yet — open an item in THE RESEARCH and press “Add to report”.'
        : 'Printed in the report itself; everything you left in THE RESEARCH goes into the evidence annex.'}
    >
      {total === 0 && (
        // ⚠ THE EMPTY STATE IS AN INSTRUCTION, NOT AN APOLOGY. Nothing is here because nothing
        // arrives on its own, and that is the design — so the sentence says how to put something
        // here rather than that something is missing.
        <p className="px-4 py-3 text-xs text-zinc-500">
          Nothing crosses from THE RESEARCH on its own — open an item there and press
          “Add to report”, and it appears here under its own heading.
        </p>
      )}

      {error && <p className="px-4 py-2 text-xs text-amber-800">{error}</p>}

      {sections.map((h) => (
        <section key={h.key} className="border-t border-zinc-100 px-4 py-3">
          {/* §3a — the section's heading, which arrived with its first item. */}
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{h.heading}</h4>
          <ul className="mt-2 space-y-2">
            {h.entries.map((e) => (
              <li key={e.id} className="rounded-lg border border-zinc-200 p-2.5">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    {e.url ? (
                      <a href={e.url} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium text-zinc-800 hover:underline break-words">{e.title}</a>
                    ) : (
                      <span className="text-sm font-medium text-zinc-800 break-words">{e.title}</span>
                    )}
                    {e.citation && <div className="text-[11px] text-zinc-500 mt-0.5">{e.citation}</div>}
                    {e.why && <p className="text-xs text-zinc-600 mt-1">{e.why}</p>}
                  </div>
                  <button
                    onClick={() => void removeFromReport(e)}
                    disabled={busy}
                    title="Take this out of the report. It stays in THE RESEARCH — nothing is deleted."
                    className="text-[11px] rounded border-2 border-zinc-300 bg-white px-1.5 py-0.5 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 shrink-0 whitespace-nowrap"
                  >
                    Remove from report
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </CollapsedSection>
  )
}
