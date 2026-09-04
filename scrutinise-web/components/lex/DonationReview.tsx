'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 3 §4 — THE PUBLISHED RECORD FIRST, YOUR JUDGEMENT SECOND, OUR READING
// LAST.
//
// ⚠⚠ OUR READING IS NOT IN THIS COMPONENT'S STATE UNTIL THE USER HAS ANSWERED,
// because it is not in the response until then. The server splits the halves
// (`donation-alignment.ts` + the route) and the GET returns only the published
// facts — so there is nothing here to hide, reveal early, or leak through a
// devtools panel. Copied deliberately from 25-L's ClaimReview rather than
// reinvented: §4 says that design is right and must not be weakened.
//
// ⚠ THE FACT IS THE HEADLINE AND THE INFERENCE NEVER IS. §4: *"'Donated £50,000
// to X in 2019, and to no other party' is a fact with a citation. The inference
// sits beneath it, labelled, and is never the headline."* The statement is set
// in the largest type on the card; our reading arrives later, in smaller type,
// under a label that says whose reading it is.
//
// ⚠ NO COLOUR CARRIES ANY STATE (docs/CLAUDE.md §21 — Charlie is colour blind).
// The chosen verdict carries a filled disc, a 2px border and a dark background;
// each of the three survives greyscale on its own.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'

interface Fact {
  ecRef: string
  recipient: string
  valuePence: number | null
  acceptedDate: string
  sourceUrl: string | null
}
interface Alignment {
  donorEntityId: string
  donorName: string
  statement: string
  parties: string[]
  facts: Fact[]
  firstDonation: string
  lastDonation: string
  yearsSpanned: number
}
interface Assessment {
  tier: string
  confidence: string
  inference: string
  configVersion: string
}

// ⚠ FOUR VERDICTS, AND THE THIRD IS THE ONE THE DESIGN TURNS ON. "No direction either way" is a
// positive finding about a donor who gave to several parties, not a way of saying "unsure" —
// that is what the fourth is for. Merging them would lose the distinction the whole tier system
// exists to draw.
const VERDICTS: Array<{ key: string; label: string }> = [
  { key: 'sympathetic', label: 'Sympathetic to them' },
  { key: 'not-sympathetic', label: 'Not sympathetic' },
  { key: 'no-direction', label: 'No direction either way' },
  { key: 'not-enough', label: 'Not enough here' },
]

const ANSWERS: Array<{ key: string; label: string }> = [
  { key: 'right', label: 'Right' },
  { key: 'wrong', label: 'Wrong' },
  { key: 'not-sure', label: 'Not sure' },
]

function money(pence: number | null): string {
  if (pence === null) return 'undisclosed'
  return `£${(pence / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
}

export default function DonationReview({ ideaId, donor }: { ideaId?: string; donor?: string }) {
  const [alignment, setAlignment] = useState<Alignment | null>(null)
  const [invitation, setInvitation] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [verdict, setVerdict] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [judgementId, setJudgementId] = useState<string | null>(null)
  const [answered, setAnswered] = useState<string | null>(null)
  const [closingNote, setClosingNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch(`/api/graph/donations${donor ? `?donor=${encodeURIComponent(donor)}` : ''}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        setAlignment(j?.alignment ?? null)
        setInvitation(j?.invitation ?? '')
        setNote(j?.note ?? null)
      })
      .catch(() => setNote('We could not reach the register just now.'))
      .finally(() => setLoading(false))
  }, [donor])

  const submit = useCallback(async () => {
    if (!alignment || !verdict) return
    setBusy(true)
    try {
      const res = await fetch('/api/graph/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideaId: ideaId ?? null,
          donorEntityId: alignment.donorEntityId,
          userVerdict: verdict,
          userReason: reason.trim() || null,
        }),
      })
      if (!res.ok) return
      const j = await res.json()
      setJudgementId(j.judgementId)
      setAssessment(j.assessment)
    } finally { setBusy(false) }
  }, [alignment, verdict, reason, ideaId])

  const answer = useCallback(async (agreed: string) => {
    if (!judgementId) return
    setBusy(true)
    try {
      const res = await fetch('/api/graph/donations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: judgementId, agreed }),
      })
      const j = res.ok ? await res.json() : null
      setAnswered(agreed)
      setClosingNote(j?.note ?? null)
    } finally { setBusy(false) }
  }, [judgementId])

  if (loading) return <p className="text-xs text-zinc-400">Reading the register…</p>

  return (
    <div className="rounded-xl border-2 border-zinc-300 p-3 space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="rounded border-2 border-zinc-900 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Beta
        </span>
        <span className="text-[11px] text-zinc-500 flex-1">
          Every line below is published by the Electoral Commission, with its reference.
        </span>
      </div>

      {invitation && <p className="text-sm leading-relaxed text-zinc-700">{invitation}</p>}

      {!alignment ? (
        <p className="text-xs text-zinc-600">{note}</p>
      ) : (
        <>
          {/* ══ THE FACT, AND IT IS THE HEADLINE ══════════════════════════════ */}
          <div>
            <p className="text-sm font-semibold text-zinc-900">{alignment.donorName}</p>
            <p className="text-sm text-zinc-800 mt-0.5">{alignment.statement}</p>
          </div>

          <ul className="space-y-1.5">
            {alignment.facts.slice(0, 12).map((f) => (
              <li key={f.ecRef} className="text-xs border-l-2 border-zinc-200 pl-2">
                <span className="font-medium text-zinc-800">{money(f.valuePence)}</span>{' '}
                <span className="text-zinc-700">to {f.recipient}</span>
                <span className="block text-[11px] text-zinc-500">
                  {f.acceptedDate} · EC ref {f.ecRef}
                  {f.sourceUrl && (
                    <>
                      {' · '}
                      <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="text-blue-700 hover:underline">source</a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {alignment.facts.length > 12 && (
            <p className="text-[11px] text-zinc-500">
              {alignment.facts.length - 12} further recorded donations not listed here.
            </p>
          )}

          {/* ══ THEIR JUDGEMENT, BEFORE OURS ══════════════════════════════════ */}
          {!assessment && (
            <div className="space-y-2 border-t border-zinc-200 pt-2.5">
              <p className="text-xs font-semibold text-zinc-800">
                Reading only that, what does it tell you about where this donor stands?
                We’ll show you ours after.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {VERDICTS.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => setVerdict(v.key)}
                    aria-pressed={verdict === v.key}
                    className={`text-xs px-2.5 py-1.5 rounded-full border-2 ${
                      verdict === v.key
                        ? 'border-zinc-900 bg-zinc-900 text-white font-semibold'
                        : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <span aria-hidden>{verdict === v.key ? '● ' : '○ '}</span>{v.label}
                  </button>
                ))}
              </div>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why? (optional)"
                className="w-full text-xs rounded border border-zinc-300 px-2 py-1.5"
              />
              <button
                onClick={() => void submit()}
                disabled={busy || !verdict}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-900 text-white disabled:opacity-40"
              >
                Show me what you found
              </button>
            </div>
          )}

          {/* ══ AND ONLY THEN, OURS — LABELLED, AND NEVER THE HEADLINE ════════ */}
          {assessment && (
            <div className="space-y-2 border-t border-zinc-200 pt-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Our reading — an inference, not a record
              </p>
              <p className="text-xs leading-relaxed text-zinc-800">{assessment.inference}</p>
              <p className="text-[11px] text-zinc-500">
                Pattern: {assessment.tier.replace(/-/g, ' ')} · confidence {assessment.confidence}
                {' · method '}{assessment.configVersion}
              </p>
              {/* ⚠⚠ THE LINE THAT MUST NEVER BE DROPPED. A party-level alignment can never support
                  a claim about a specific proposal, and the screen says so rather than relying on
                  a reader to infer it from the wording above. */}
              <p className="text-[11px] leading-relaxed text-zinc-600 border-l-2 border-zinc-300 pl-2">
                This is about a party, never about a proposal. Trade unions donate to Labour and
                campaign against particular Labour policies; companies frequently give for access
                rather than agreement. Nothing here says how this donor would view any specific
                measure, and we will not use it to say so.
              </p>
              {answered === null ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-zinc-700">Does that look right?</span>
                  {ANSWERS.map((a) => (
                    <button key={a.key} onClick={() => void answer(a.key)} disabled={busy}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full border-2 border-zinc-300 bg-white text-zinc-800 disabled:opacity-40 hover:bg-zinc-50">
                      {a.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-600">{closingNote ?? 'Recorded — thank you.'}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
