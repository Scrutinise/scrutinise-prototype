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
  stale: boolean
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
const SHOWN = ['PROPOSAL_SUMMARY', 'PROPOSAL'] as const

const BLURB: Record<string, string> = {
  PROPOSAL_SUMMARY: 'About two pages — the problem, the obstacle, the approach, the cost and the ask. '
    + 'It points at the full version for anything deeper.',
  PROPOSAL: 'Everything: the kernel, and every section the resources panel holds — the prognosis, '
    + 'what else refers to this law, what was tried before, the case against, your own account, '
    + 'the gaps, and the sources.',
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

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/document`)
      if (!res.ok) return
      const body = await res.json()
      setRows(body.documents ?? [])
    } catch { /* a panel that cannot load says nothing rather than showing a broken shell */ }
  }, [ideaId])

  useEffect(() => { void load() }, [load])

  const generate = useCallback(async (kind: string, force: boolean) => {
    setBusy(kind); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', kind, force }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(typeof body?.error === 'string' ? body.error : 'That could not be generated.')
        return
      }
      await load()
    } finally { setBusy(null) }
  }, [ideaId, load])

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
              : d.stale
                ? `Last generated ${when(d.generatedAt)} — the proposal has changed since, so this file `
                  + 'is out of date. Generate it again before you send it.'
                : `Generated ${when(d.generatedAt)}, and it still matches the proposal as it stands.`}
            {d.fromVersionNumber != null && ` From version ${d.fromVersionNumber}.`}
          </p>

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
                {busy === d.kind
                  ? 'Generating…'
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
