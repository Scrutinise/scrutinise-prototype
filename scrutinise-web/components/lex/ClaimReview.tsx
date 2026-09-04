'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-L §5 (as amended) — JUDGE IT YOURSELF FIRST.
//
// ⚠⚠ THE ASSESSMENT IS NOT IN THIS COMPONENT'S STATE UNTIL THE USER HAS ANSWERED, because
// it is not in the response until then. The server splits the two halves (`claim-review.ts`)
// and the GET returns only the question — so there is nothing here to hide, reveal early, or
// leak through a devtools panel. A "don't render this yet" flag would have been the version
// that quietly stopped being an experiment.
//
// ⚠ THE FACTS ARE ON SCREEN FROM THE START. §5: "Facts are never gated. The votes and
// contributions are public record and visible to everyone." The user cannot judge a record
// they have not been shown, and gating it would turn the question into a guess.
//
// ⚠ BETA MEANS INCOMPLETE, NOT UNRELIABLE, and the copy has to carry that distinction on a
// scrutiny platform. Coverage is stated and computed; every individual line is a real thing
// a real person did, with a link to it.
//
// ⚠ AND THE VERDICTS ARE NOT COLOUR-CODED. Charlie is colour blind (docs/CLAUDE.md §21):
// the chosen one carries a filled disc, a 2px border and a dark background, any one of which
// survives greyscale.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'

interface Ground {
  what: string
  date: string
  signalType: string
  sourceUrl: string | null
  direction: 'for' | 'against' | 'took part'
}
interface ClaimQuestion {
  actorId: string
  actorName: string
  identityStatement: string
  identityCaveat: string | null
  targetKey: string
  questionText: string
  matchBasis: string | null
  grounds: Ground[]
  coverage: string
  coverageNotes: string[]
  ranking: { note: string | null; ofMatched: number; shown: number; key: string }
}
interface Assessment {
  stance: string
  claim: string
  claimCaveat: string | null
  confidenceWording: string
  configVersion: string | null
  rankKey: string
}

const VERDICTS: Array<{ key: string; label: string }> = [
  { key: 'supports', label: 'Supports' },
  { key: 'opposes', label: 'Opposes' },
  { key: 'unclear', label: 'Unclear' },
  // ⚠ "NOT ENOUGH HERE" IS NOT "UNCLEAR". One says the record is mixed; the other says we
  // have not shown them enough to say. Merging them would lose the single most useful
  // signal this experiment can produce — that our coverage, not the member, is the problem.
  { key: 'not-enough', label: 'Not enough here' },
]

/**
 * ══ SURFACE 3 §1 — WHAT WE COULD NOT SEE, SAID IN ORDINARY WORDS ═══════════════════════════════
 *
 * ⚠⚠ EVERY SENTENCE ARRIVES FROM THE SERVER, GENERATED FROM LIVE STATE. There is no copy in this
 * component — not one date, not one count — because a caveat written into a component is a caveat
 * that is correct on the day it is typed and unfalsifiable afterwards. `position-coverage.ts` is
 * the only place these sentences exist, and `check-surface-3.ts` fails the build if a figure about
 * the graph appears in a string there.
 *
 * ⚠ IT RENDERS ON THE EMPTY PATH TOO. A gap that says nothing reads as "nobody has a position".
 *
 * ⚠ NO COLOUR CARRIES ANY STATE HERE (docs/CLAUDE.md §21): it is a bordered block with a heading,
 * which survives greyscale.
 */
function CoverageStatement({ notes }: { notes: string[] }) {
  if (!notes.length) return null
  return (
    <div className="border-t-2 border-zinc-200 pt-2 space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
        What this does not cover
      </p>
      {notes.map((n, i) => (
        <p key={i} className="text-[11px] leading-relaxed text-zinc-600">{n}</p>
      ))}
    </div>
  )
}

export default function ClaimReview({ ideaId }: { ideaId: string }) {
  const [claim, setClaim] = useState<ClaimQuestion | null>(null)
  const [invitation, setInvitation] = useState('')
  const [note, setNote] = useState<string | null>(null)
  // ⚠ SURFACE 3 §1. Held separately from `claim` because it must render on BOTH paths — the empty
  // one especially. See the route's own note: a reader shown nothing has more to be misled about.
  const [coverageNotes, setCoverageNotes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [verdict, setVerdict] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [judgementId, setJudgementId] = useState<string | null>(null)
  const [answered, setAnswered] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch(`/api/graph/claim?ideaId=${encodeURIComponent(ideaId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        setClaim(j?.claim ?? null)
        setInvitation(j?.invitation ?? '')
        setNote(j?.note ?? null)
        setCoverageNotes(j?.coverageNotes ?? j?.claim?.coverageNotes ?? [])
      })
      .catch(() => setNote('We could not reach the record just now.'))
      .finally(() => setLoading(false))
  }, [ideaId])

  const submit = useCallback(async () => {
    if (!claim || !verdict) return
    setBusy(true)
    try {
      const res = await fetch('/api/graph/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideaId,
          actorId: claim.actorId,
          actorName: claim.actorName,
          targetKey: claim.targetKey,
          questionText: claim.questionText,
          userVerdict: verdict,
          userReason: reason.trim() || null,
          groundsShown: claim.grounds.length,
        }),
      })
      if (!res.ok) return
      const j = await res.json()
      setJudgementId(j.judgementId)
      setAssessment(j.assessment)
    } finally { setBusy(false) }
  }, [claim, verdict, reason, ideaId])

  const answer = useCallback(async (agreed: boolean) => {
    if (!judgementId) return
    setBusy(true)
    try {
      await fetch('/api/graph/claim', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: judgementId, agreed }),
      })
      setAnswered(agreed)
    } finally { setBusy(false) }
  }, [judgementId])

  if (loading) return <p className="text-xs text-zinc-400">Reading the record…</p>

  return (
    <div className="rounded-xl border-2 border-zinc-300 p-3 space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="rounded border-2 border-zinc-900 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Beta
        </span>
        <span className="text-[11px] text-zinc-500 flex-1">
          Incomplete, not unreliable — every line below is a real thing, with its source.
        </span>
      </div>

      {invitation && <p className="text-sm leading-relaxed text-zinc-700">{invitation}</p>}

      {!claim ? (
        <>
          <p className="text-xs text-zinc-600">{note}</p>
          <CoverageStatement notes={coverageNotes} />
        </>
      ) : (
        <>
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              {claim.questionText.replace('this member', claim.actorName)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {claim.identityStatement}
              {claim.identityCaveat ? ` — ${claim.identityCaveat}` : ''}
            </p>
            {/* ⚠ SURFACE 3 §2 — WHY THIS QUESTION AND NOT ANOTHER. The target is matched from the
                user's own words against division and motion titles, and a match that is not
                disclosed is a match a reader assumes was chosen by understanding. It is composed
                on the server from the phrase that actually matched. */}
            {claim.matchBasis && (
              <p className="text-[11px] text-zinc-600 mt-1 border-l-2 border-zinc-300 pl-2">
                {claim.matchBasis}
              </p>
            )}
          </div>

          {/* ⚠ THE RECORD, UNGATED. This is what they are being asked to judge. */}
          <ul className="space-y-1.5">
            {claim.grounds.map((g, i) => (
              <li key={i} className="text-xs border-l-2 border-zinc-200 pl-2">
                <span className="font-medium text-zinc-800">{g.direction}</span>{' '}
                <span className="text-zinc-700">{g.what}</span>
                <span className="block text-[11px] text-zinc-500">
                  {g.date} · {g.signalType}
                  {g.sourceUrl && (
                    <>
                      {' · '}
                      <a href={g.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                        source
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-zinc-500">{claim.coverage}</p>

          {/* ══ ⚠⚠ SURFACE 4 — WHY THIS PERSON, AND NOT ONE OF THE OTHERS ═══════════════════
              The graph computes this and SURFACE 3 dropped it. One name out of 254, chosen by
              an order that cannot separate them, presented without saying so, reads as "this is
              the person who matters". It is not; it is the first name alphabetically among a
              dozen tied at the same score. */}
          {claim.ranking?.ofMatched > 1 && (
            <p className="text-[11px] leading-relaxed text-zinc-600 border-l-2 border-zinc-300 pl-2">
              We are showing <strong>one of {claim.ranking.ofMatched.toLocaleString()}</strong> people
              with a record on this.{' '}
              {claim.ranking.note
                ? claim.ranking.note
                : `Ordered by ${claim.ranking.key}.`}
            </p>
          )}
          <CoverageStatement notes={coverageNotes.length ? coverageNotes : claim.coverageNotes} />

          {/* ══ THE USER JUDGES FIRST ═══════════════════════════════════════════ */}
          {!assessment && (
            <div className="space-y-2 border-t border-zinc-200 pt-2.5">
              <p className="text-xs font-semibold text-zinc-800">
                Reading only that, what do you think? We’ll show you ours after.
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

          {/* ══ AND ONLY THEN, OURS ═════════════════════════════════════════════ */}
          {assessment && (
            <div className="space-y-2 border-t border-zinc-200 pt-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                What we found
              </p>
              <p className="text-sm text-zinc-800">{assessment.claim}</p>
              <p className="text-[11px] text-zinc-500">
                {assessment.confidenceWording}
                {assessment.claimCaveat ? ` — ${assessment.claimCaveat}` : ''}
                {assessment.configVersion ? ` · method ${assessment.configVersion}` : ''}
              </p>
              {answered === null ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-zinc-700">Does that look right?</span>
                  <button onClick={() => void answer(true)} disabled={busy}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border-2 border-zinc-900 bg-zinc-900 text-white disabled:opacity-40">
                    Yes
                  </button>
                  <button onClick={() => void answer(false)} disabled={busy}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border-2 border-zinc-300 bg-white text-zinc-800 disabled:opacity-40">
                    No
                  </button>
                </div>
              ) : (
                // ⚠ A DISAGREEMENT DOES NOT CHANGE THE RECORD, AND THE USER IS TOLD SO.
                // §5: this is corroboration, not verification. Implying their answer had
                // corrected the graph would be a claim we cannot honour and would make the
                // next disagreement feel wasted when they saw nothing had changed.
                <p className="text-xs text-zinc-600">
                  {answered
                    ? 'Recorded — thank you. That is one agreement, which is not proof; we are counting them.'
                    : 'Recorded, and flagged for review. Your judgement does not overwrite the sourced record — '
                      + 'it tells us where to look.'}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
