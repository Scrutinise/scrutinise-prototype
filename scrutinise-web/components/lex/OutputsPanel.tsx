'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-M §1 — THE OUTPUTS, WHERE THE WORK IS.
//
// ⚠⚠ THE PROBLEM THIS SOLVES IS ONE SENTENCE OF CHARLIE'S: *"It's a bit disjointed having to
// go to the dashboard to find it."* A user finishes a build and there is nothing to take
// away without leaving the page they are working on — so the documents, which exist and are
// good, are reached by a route that interrupts the work to get to them.
//
// ⚠⚠ ONE GENERATOR, TWO DOORS. This calls `/api/ideas/[id]/document`, which is the same
// endpoint the Documents tab calls, with the same `readProposalExportStatus` behind it. There
// is no second generator and there must never be: two copies of a renderer drift, and the
// two doors would then disagree about what the proposal says — which is worse than the
// friction this removes.
//
// ⚠ IT SHOWS WHEN EACH WAS LAST GENERATED, AND WHETHER IT IS STALE. The fingerprint has
// existed since Sprint 2.5 and the tab already used it; the point of surfacing it here is
// that "generated" and "generated from what the proposal says NOW" are different facts, and a
// user about to send a document to an MP needs the second one.
//
// ⚠ AND AN UNAVAILABLE OUTPUT SAYS WHY. `unavailableReason` is a sentence from the assembler
// — "there is nothing to export yet" — not an absent button. A greyed control with no
// explanation is the defect 25-K §2 spent a sprint removing from the re-run.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'

interface ExportStatus {
  kind: string
  label: string
  available: boolean
  unavailableReason: string | null
  generated: boolean
  generatedAt: string | null
  /** 25-N §5d — `null` means "not checked yet on this load". Never rendered as current. */
  stale: boolean | null
  fromVersionNumber: number | null
  docxUrl: string | null
  pdfUrl: string | null
  lastError: string | null
}

/**
 * §2's two documents, in the order a reader meets them: the two-pager first, because it is
 * the first thirty seconds of somebody's attention and the full write-up is what it points
 * at.
 *
 * ⚠ THE EVIDENCE PACK IS NOT LISTED, and that is deliberate rather than an omission. It is a
 * third kind the API knows about (`PROPOSAL_KINDS`), it is scaffolded rather than built, and
 * offering a button that produces a stub would be worse than not offering it. It appears here
 * the day it produces a document.
 */
const SHOWN = ['PROPOSAL_SUMMARY', 'PROPOSAL', 'MEETING_PACK'] as const

/**
 * ══ 25-N §5e — WHAT THE MEETING PACK MAY CONTAIN, AND WHAT THE USER CHOOSES ═════
 *
 * §5e: *"printable, with the user choosing what to show and hide before printing."*
 *
 * ⚠ THE KEYS AND THE ORDER ARE THE BUILDER'S (`MEETING_PACK_SECTIONS`), restated here as
 * labels only. A second list of sections in the UI would be a second answer to "what is in this
 * document", and the one the user believes is whichever they are looking at.
 *
 * ⚠ AND EVERYTHING IS ON BY DEFAULT. Not choosing is not the same as choosing to omit, and a
 * pack that quietly dropped a section by default would be a pack whose reader cannot tell what
 * they were not shown.
 */
const PACK_SECTIONS: Array<{ key: string; label: string }> = [
  { key: 'decisions', label: 'What is being decided' },
  { key: 'questions', label: 'What nobody has answered' },
  { key: 'challenges', label: 'What a hostile reader would ask' },
  { key: 'background', label: 'The proposal so far' },
  { key: 'evidence', label: 'The evidence behind it' },
]

const BLURB: Record<string, string> = {
  PROPOSAL_SUMMARY: 'About two pages — the problem, the obstacle, the approach, the cost and the ask. '
    + 'It points at the full version for anything deeper.',
  PROPOSAL: 'Everything: the kernel, and every section the resources panel holds — the prognosis, '
    + 'what else refers to this law, what was tried before, your own account, the gaps, and the '
    + 'sources. Sections are named on every page, so a reader leafing through it always knows '
    + 'where they are.',
  // §5e — a different reader, so a different document. See `build-meeting-pack.ts`.
  MEETING_PACK: 'For someone who will help but has not joined your team. It leads on what is '
    + 'still open — the decisions, the unanswered questions, the challenges — because that is what '
    + 'an hour in a room can actually change. Choose what to include before you print it.',
}

function when(iso: string | null): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`
}

export default function OutputsPanel({ ideaId }: { ideaId: string }) {
  const [rows, setRows] = useState<ExportStatus[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** §5e — which sections of the meeting pack to print. All of them until the user says not. */
  const [packSections, setPackSections] = useState<string[]>(PACK_SECTIONS.map((s) => s.key))

  /**
   * ══ 25-N §5d — TWO READS, AND THE FIRST ONE PAINTS ═══════════════════════════
   *
   * ⚠⚠ THE ~5 SECONDS WAS A PAGE LOAD, NOT GENERATION, AND THE CAUSE IS ONE LINE:
   * `readProposalExportStatus` called `buildProposalSnapshot` on every GET — the whole
   * twelve-table assembler — purely to hash it so a generated file could be reported as stale.
   * Nothing else on this panel needed it. So the user waited for the answer to "is this file
   * current?" before being shown the file's NAME.
   *
   * ⚠ THE STALENESS CHECK IS NOT DROPPED. "Generated" and "generated from what the proposal
   * says now" are different facts and the second is the one that matters to somebody about to
   * send this to an MP. It is just no longer in front of the first paint: `?quick=1` returns
   * everything the document rows know, staleness comes back `null`, and the panel says
   * "checking…" until the full read answers.
   *
   * ⚠ AND `null` IS RENDERED AS A QUESTION, NEVER AS "CURRENT" (CLAUDE.md §19 — a fact measured
   * and a fact assumed must not look identical on the page).
   */
  const load = useCallback(async () => {
    try {
      const quick = await fetch(`/api/ideas/${ideaId}/document?quick=1`)
      if (quick.ok) setRows((await quick.json()).documents ?? [])
    } catch { /* a panel that cannot load says nothing rather than showing a broken shell */ }
    try {
      const full = await fetch(`/api/ideas/${ideaId}/document`)
      if (full.ok) setRows((await full.json()).documents ?? [])
    } catch { /* the quick answer stands, with staleness still reported as unchecked */ }
  }, [ideaId])

  useEffect(() => { void load() }, [load])

  const generate = useCallback(async (kind: string, force: boolean) => {
    setBusy(kind); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          kind,
          force,
          // §5e — sent only for the pack. Every other kind has no sections to choose, and a
          // parameter travelling with a request that ignores it is how a reader comes to
          // believe it does something.
          ...(kind === 'MEETING_PACK' ? { sections: packSections } : {}),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(typeof body?.error === 'string' ? body.error : 'That could not be generated.')
        return
      }
      await load()
    } finally { setBusy(null) }
  }, [ideaId, load, packSections])

  if (!rows) return <p className="text-xs text-zinc-400">Reading what you can take away…</p>

  const shown = SHOWN
    .map((k) => rows.find((r) => r.kind === k))
    .filter((r): r is ExportStatus => !!r)

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-zinc-500">
        What you can take away. Generating and downloading both happen here — the Documents tab on
        the idea holds the same records.
      </p>

      {error && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">{error}</p>
      )}

      {shown.map((d) => (
        <div key={d.kind} className="rounded-xl border border-zinc-200 p-3">
          <p className="text-sm font-semibold text-zinc-900">{d.label}</p>
          <p className="text-xs text-zinc-600 mt-1">{BLURB[d.kind] ?? ''}</p>

          {/* ⚠ THE STALENESS FINGERPRINT, IN WORDS. "Generated" and "generated from what the
              proposal says now" are different facts, and the second is the one that matters
              to somebody about to send this to an MP. ⚠ Not a coloured dot: Charlie is
              colour blind (docs/CLAUDE.md §21), so the state is a sentence. */}
          <p className="text-[11px] text-zinc-500 mt-2">
            {!d.generated
              ? 'Not generated yet.'
              : d.stale === null
                // §5d — the third state. Not "current": we have not asked yet.
                ? `Generated ${when(d.generatedAt)}. Checking whether it still matches the proposal…`
                : d.stale
                  ? `Last generated ${when(d.generatedAt)} — the proposal has changed since, so this file `
                    + 'is out of date. Generate it again before you send it.'
                  : `Generated ${when(d.generatedAt)}, and it still matches the proposal as it stands.`}
            {d.fromVersionNumber != null && ` From version ${d.fromVersionNumber}.`}
          </p>

          {/* ══ 25-N §5e — WHAT TO SHOW, CHOSEN BEFORE PRINTING ═══════════════════
              ⚠ IT SITS ABOVE THE BUTTON, not in a dialogue behind it. The choice changes what
              the file contains, so a user who discovers it after generating has generated the
              wrong file — and would have no reason to look for a control they never saw. */}
          {d.kind === 'MEETING_PACK' && d.available && (
            <fieldset className="mt-2.5 rounded-lg border border-zinc-200 p-2">
              <legend className="text-[11px] font-medium text-zinc-600 px-1">Include</legend>
              <div className="space-y-1">
                {PACK_SECTIONS.map((sec) => (
                  <label key={sec.key} className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={packSections.includes(sec.key)}
                      onChange={(e) => setPackSections((cur) => (
                        e.target.checked
                          ? [...cur, sec.key]
                          // ⚠ THE LAST ONE CANNOT BE UNTICKED. A pack with no sections is a
                          // cover sheet, and the builder would print the "left out" note over
                          // an empty document.
                          : cur.length > 1 ? cur.filter((k) => k !== sec.key) : cur
                      ))}
                      className="w-3.5 h-3.5 rounded border-zinc-400 accent-zinc-900"
                    />
                    {sec.label}
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1.5">
                Anything you leave out is named on the front of the pack, so the reader knows to ask
                for it.
              </p>
            </fieldset>
          )}

          {!d.available ? (
            // ⚠ THE REASON, NOT A MISSING BUTTON.
            <p className="text-xs text-zinc-600 mt-2">
              {d.unavailableReason ?? 'There is nothing to put in this yet.'}
            </p>
          ) : (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                onClick={() => void generate(d.kind, d.generated)}
                disabled={busy === d.kind}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-900 text-white disabled:opacity-40"
              >
                {/* §5d — *"If generation is happening, say 'Building reports'."* It IS
                    happening here — this button renders two documents in two formats — and
                    "Generating…" left a user watching a disabled control with no idea what
                    was being made. */}
                {busy === d.kind
                  ? 'Building reports…'
                  : d.generated ? 'Generate again' : 'Generate'}
              </button>
              {d.generated && d.docxUrl && (
                <a href={d.docxUrl} className="text-xs font-medium px-3 py-1.5 rounded-full border-2 border-zinc-300 text-zinc-700 hover:bg-zinc-50">
                  Word
                </a>
              )}
              {d.generated && d.pdfUrl && (
                <a href={d.pdfUrl} className="text-xs font-medium px-3 py-1.5 rounded-full border-2 border-zinc-300 text-zinc-700 hover:bg-zinc-50">
                  PDF
                </a>
              )}
            </div>
          )}

          {d.lastError && (
            <p className="text-[11px] text-amber-800 mt-2">
              The last attempt failed: {d.lastError}
            </p>
          )}
        </div>
      ))}

      <p className="text-[11px] text-zinc-400">
        Both are built from the same record as the screen you are looking at, so what you download is
        what you have been reading.
      </p>
    </div>
  )
}
