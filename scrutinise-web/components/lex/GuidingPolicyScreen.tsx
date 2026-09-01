'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-P §1 — THE GUIDING POLICY SCREEN.
//
// ⚠⚠ THE WALKTHROUGH FINDING: *"How do I choose? Do I have to choose one only? What if I want
// parts of others built in?"* — asked of a list of eighteen with no control on it anywhere.
//
// ⚠⚠ AND THE MEASUREMENT THAT SHAPES THE TOP OF THIS SCREEN: those eighteen are SIX BUILDS ×
// THREE, appended — `createPolicyOptions` never deletes and `revisePass` never touches policy
// rows. So the first useful thing to say is not "here are your options"; it is "several of these
// are the same thing in different words, and several are not policies at all."
//
// ⚠ EVERY NUMBER ON THIS SCREEN IS THE STABLE ONE (§1.1), never the position in the list. A
// rejected 7 leaves a visible gap. The user types "merge 4 and 8" and must be able to trust that
// 4 is the 4 they are looking at.
//
// ⚠⚠ NO COLOUR CARRIES MEANING (docs/CLAUDE.md §21 — Charlie is colour blind). §1.6 says it
// outright: **position and text only — no colour-coded grid, no red/amber/green.** The two
// ratings are words in two labelled columns; the verdicts are words; the kinds are words.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import type { MergeAnswer, Rating, Relationship } from '@/lib/lex/guiding-policy'
import { historyLine, clusterLine, GROUP_HEADINGS } from '@/lib/lex/policy-history'

interface Policy {
  id: string
  number: number | null
  approach: string
  caseFor: string | null
  caseAgainst: string | null
  status: string
  ruleOutReason: string | null
  kind: string
  kindReason: string | null
  sorted: boolean
  moveStatus: string | null
  parkedWithId: string | null
  movedToActionId: string | null
  mergedFrom: number[]
  superseded: boolean
  importance: Rating | null
  addressability: Rating | null
  chainLink: string | null
  phase: string | null
  phaseReason: string | null
  impliedCause: { cause?: string; why?: string; status?: string } | null
  causeNumbers: number[]
}

interface State {
  rounds: number
  maxRounds: number
  offerUnresolved: boolean
  unresolved: boolean
  unresolvedWhy: string | null
  settled: string | null
  causes: Array<{ id: string; number: number; cause: string; isRoot: boolean }>
  policies: Policy[]
  pairings: Array<{ a: number; b: number; relationship: Relationship; why: string }>
}

/** §1.2 — the three outcomes, as a user reads them. */
const KIND_LABEL: Record<string, string> = {
  GUIDING_POLICY: 'A guiding policy',
  COHERENT_ACTION: 'Really a coherent action',
  GOAL_RESTATEMENT: 'Really the goal restated',
}

/** §1.5 — the three relationships, and what each one means you should DO. */
const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  ALTERNATIVES: 'Alternatives — one of these wins',
  CHAIN: 'Different links of one chain — worth merging',
  DISPERSIVE: 'Unrelated branches — sequence, do not combine',
}

/** ⚠ §1.6 — the basis, spelled out. `NOT_FOUND` is the one a reviewer attacks first. */
const BASIS_LABEL: Record<string, string> = {
  RETRIEVED: 'from the research',
  REASONED: 'Lex’s reasoning',
  NOT_FOUND: '⚠ nothing found — not estimated',
}

function RatingCell({ label, r }: { label: string; r: Rating | null }) {
  if (!r) return <div className="text-[11px] text-zinc-400">{label}: not rated yet</div>
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-xs text-zinc-800">{r.verdict}</div>
      <div className="text-[11px] text-zinc-600">{r.why}</div>
      {/* ⚠ THE BASIS IS ON THE SCREEN, not in a tooltip. §1.6: label which is reasoning and
          which is retrieved — this is the rating most likely to be wrong. */}
      <div className={`text-[10px] mt-0.5 ${r.basis === 'NOT_FOUND' ? 'font-semibold text-amber-800' : 'text-zinc-500'}`}>
        {BASIS_LABEL[r.basis] ?? r.basis}
      </div>
    </div>
  )
}

/**
 * ══ 25-S §1.2/§1.3 — THE CARD'S OWN HISTORY, AND THE WAY BACK ══════════════════════
 *
 * Charlie: he cannot tell whether the sort ran, because a sorted list looks exactly like an
 * unsorted one. This is the line that tells him, and the control that lets him disagree.
 *
 * ⚠ THE LINE IS COMPUTED IN `lib/lex/policy-history.ts`, not here. The cold read runs the same
 * function over real rows; a copy in the component would be a second vocabulary that agrees
 * until one of them is edited.
 *
 * ⚠ NO LINE WHERE THERE IS NO HISTORY (§1.2). `historyLine` returns null and this renders
 * nothing — which is what lets a reader tell the cards Lex touched from the ones it did not.
 *
 * ⚠ AND THE UNDO ONLY APPEARS WHERE THERE IS SOMETHING TO UNDO. A cluster is a computed
 * relationship rather than a move, so it has no undo and does not pretend to.
 */
function CardHistory({
  p, pairings, busy, onUndo,
}: {
  p: Policy
  pairings: Array<{ a: number; b: number; relationship: string; why: string }>
  busy: boolean
  onUndo?: () => void
}) {
  const line = historyLine({
    number: p.number, kind: p.kind, kindReason: p.kindReason, status: p.status,
    ruleOutReason: p.ruleOutReason, sorted: p.sorted, moveStatus: p.moveStatus,
    mergedFrom: p.mergedFrom, causeNumbers: p.causeNumbers,
    phase: p.phase, phaseReason: p.phaseReason,
    implementsNumber: null,
  })
  const cluster = p.number != null ? clusterLine(p.number, pairings, p.causeNumbers) : null
  if (!line && !cluster && !onUndo) return null

  return (
    <div className="mt-2 pt-1.5 border-t border-zinc-100">
      {line && <p className="text-[11px] text-zinc-600">{line}</p>}
      {cluster && <p className="text-[11px] text-zinc-500">{cluster}</p>}
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          disabled={busy}
          className="mt-1 text-[11px] font-medium text-zinc-600 underline hover:text-zinc-900 disabled:opacity-40"
        >
          Put this back as a guiding policy
        </button>
      )}
    </div>
  )
}

export default function GuidingPolicyScreen({ ideaId }: { ideaId: string }) {
  const [s, setS] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [instruction, setInstruction] = useState('')
  const [answer, setAnswer] = useState<{ answer: MergeAnswer; createdNumber: number | null } | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/guiding-policy`)
      if (res.ok) setS(await res.json())
    } catch { /* a screen that cannot load says nothing rather than showing a broken shell */ }
  }, [ideaId])
  useEffect(() => { void load() }, [load])

  const post = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/guiding-policy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof j?.error === 'string' ? j.error : 'That did not complete.'); return null }
      setS(j); return j
    } finally { setBusy(false) }
  }, [ideaId])

  const patch = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/guiding-policy`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof j?.error === 'string' ? j.error : 'That did not save.'); return }
      setS(j)
    } finally { setBusy(false) }
  }, [ideaId])

  /** §1.7 — "merge 4 and 8". Two numbers is the whole grammar. */
  const runInstruction = useCallback(async () => {
    const nums = (instruction.match(/\d+/g) ?? []).map(Number)
    if (nums.length < 2) {
      setError('Name two policies by their number — for example “merge 4 and 8”.')
      return
    }
    const j = await post({ action: 'merge', numbers: [nums[0], nums[1]] })
    if (j?.answer) { setAnswer({ answer: j.answer, createdNumber: j.createdNumber ?? null }); setInstruction('') }
  }, [instruction, post])

  if (!s) return null

  const live = s.policies.filter((p) => p.status !== 'RULED_OUT' && !p.superseded)
  const policies = live.filter((p) => p.kind === 'GUIDING_POLICY')
  const actions = live.filter((p) => p.kind === 'COHERENT_ACTION')
  const goals = live.filter((p) => p.kind === 'GOAL_RESTATEMENT')
  const rejected = s.policies.filter((p) => p.status === 'RULED_OUT')
  const later = policies.filter((p) => p.phase === 'LATER')
  const unsorted = live.filter((p) => !p.sorted).length

  return (
    <section className="rounded-2xl border border-zinc-200 mt-3" aria-label="Choosing a guiding policy">
      <div className="px-4 py-3 border-b border-zinc-100">
        <h3 className="text-sm font-semibold text-zinc-900">Choosing a guiding policy</h3>
        {/* ⚠ THE INSTRUCTIONS AT THE TOP, which 25-N §7 asked for and nothing ever built. A user
            who does not know they may combine will not ask. */}
        <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
          A guiding policy is the <span className="font-medium">approach</span> to the obstacle in
          your diagnosis — it rules some things out as well as ruling others in. You are choosing
          one, but you do not have to choose blind: some of these can be{' '}
          <span className="font-medium">merged</span>, some are really{' '}
          <span className="font-medium">actions</span> that belong under another, and some can wait
          for a <span className="font-medium">later phase</span>. You can also stop here and come
          back — nothing is lost.
        </p>
      </div>

      {error && <p className="px-4 py-2 text-xs text-amber-800 bg-amber-50 border-b border-amber-200">{error}</p>}

      {/* ══ §1.2 — SORT, AND SHOW THE SORTING ═══════════════════════════════════ */}
      {unsorted > 0 && (
        <div className="px-4 py-3 border-b border-zinc-100">
          <p className="text-xs text-zinc-700">
            {unsorted} of these {unsorted === 1 ? 'has' : 'have'} not been sorted yet. Lex will say
            which are guiding policies, which are really coherent actions, and which are the goal
            restated — <span className="font-medium">with its reasoning for each</span>.
          </p>
          <button
            onClick={() => void post({ action: 'sort' })}
            disabled={busy}
            className="mt-2 text-sm font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
          >
            {busy ? 'Sorting…' : 'Sort these for me'}
          </button>
        </div>
      )}

      {/* ⚠⚠ §1.2 — "VISIBLE, NOT SILENT." If Lex removes four of twelve without saying so, the
          user believes Lex lost them. This is that sentence, and it names where each has gone. */}
      {(actions.length > 0 || goals.length > 0) && (
        <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/70">
          <p className="text-xs font-semibold text-zinc-900">
            {actions.length + goals.length} of these were not guiding policies. Here is why, and
            here is where each has gone.
          </p>
        </div>
      )}

      {/* ══ THE POLICIES ═══════════════════════════════════════════════════════ */}
      <div className="px-4 py-3 space-y-3">
        {/* ══ 25-S §1.1 — THE HEADING THIS GROUP NEVER HAD ═══════════════════════
            The other two groups have carried a heading and a count since 25-P — "Really
            coherent actions (3)", "Really the goal restated (2)". This one did not, so the
            top of the screen read as *the list* and the rest as appendices to it.

            ⚠ §1.1: **the headings are the sort.** Three named groups with counts tell a user
            that something sorted them; the same items in the same order without them tell
            nobody anything, however good the sorting was. The missing heading was the one
            that mattered most, because it is the one at the top. */}
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {GROUP_HEADINGS.GUIDING_POLICY(policies.length)}
        </h4>
        {policies.map((p) => (
          <article key={p.id} className="rounded-lg border border-zinc-200 p-3">
            <div className="flex items-baseline gap-2">
              {/* §1.1 — THE STABLE NUMBER, prominent, because the user types it. */}
              <span className="text-sm font-bold text-zinc-900 tabular-nums">{p.number}</span>
              <p className="text-sm text-zinc-900 flex-1">{p.approach}</p>
            </div>


            {/* ⚠⚠ §1.8 — THE CHAIN-LINK CONSEQUENCE, FLAGGED AS IMPORTANT. It is the first thing
                cut for length unless it is marked, and a legislature takes the easy half. */}
            {p.chainLink && (
              <p className="mt-2 text-xs text-zinc-900 border-l-2 border-zinc-900 pl-2.5 font-medium">
                ⚠ If only part of this is delivered: {p.chainLink}
              </p>
            )}

            {/* §1.6 — two judgements, side by side, in text. Never a score, never a colour. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
              <RatingCell label="How much it fixes" r={p.importance} />
              <RatingCell label="How likely it is to happen" r={p.addressability} />
            </div>

            {p.causeNumbers.length > 0 && (
              <p className="text-[11px] text-zinc-500 mt-2">
                Attacks cause {p.causeNumbers.join(', ')}.{' '}
                {/* ⚠⚠ MEASURED: `targetCauseIds` was set on ZERO of 18 rows before this sprint.
                    Nothing has ever written the structural link, so this is Lex's judgement and
                    the screen says so rather than implying the chain asserted it. */}
                <span className="text-zinc-400">Lex’s reading of which cause this answers.</span>
              </p>
            )}

            {/* ⚠ 25-S §1.2 — THE CARD'S OWN HISTORY, AT THE FOOT. "Merged from 4 and 8" used
                to be a bare line here; it is one case of the vocabulary now, so a kept policy,
                a merged one and one held for a later phase all say what happened to them in the
                same voice and the same place. */}
            <CardHistory p={p} pairings={s.pairings} busy={busy} />

            {/* ══ §1.4 — THE CAUSE THIS POLICY IMPLIES ═══════════════════════════ */}
            {p.impliedCause?.cause && p.impliedCause.status === 'OFFERED' && (
              <div className="mt-2.5 rounded-lg border-2 border-zinc-300 bg-white p-2.5">
                <p className="text-xs text-zinc-900">
                  Choosing {p.number} implies a cause you haven’t included —{' '}
                  <span className="font-medium">{p.impliedCause.cause}</span>. Would you like to add
                  it to your causes?
                </p>
                {p.impliedCause.why && (
                  <p className="text-[11px] text-zinc-600 mt-1">{p.impliedCause.why}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  <button onClick={() => void patch({ op: 'acceptCause', policyId: p.id })} disabled={busy}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-900 text-white disabled:opacity-40">
                    Add it to my causes
                  </button>
                  <button onClick={() => void patch({ op: 'declineCause', policyId: p.id, reason: reasons[p.id] })} disabled={busy}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40">
                    No — leave my diagnosis as it is
                  </button>
                </div>
                {/* ⚠ THE DECLINE IS RECORDED AGAINST THE POLICY as a weakness, and saying so
                    before they decline is fairer than recording it silently afterwards. */}
                <p className="text-[10px] text-zinc-500 mt-1.5">
                  If you decline, this stays on the record against {p.number} as a gap between the
                  policy and the diagnosis — the hostile read will see it.
                </p>
              </div>
            )}
            {p.impliedCause?.status === 'ACCEPTED' && (
              <p className="text-[11px] text-zinc-700 mt-2">
                ✓ Added to your causes. <span className="text-zinc-500">Your diagnosis has moved —
                the causes section has changed.</span>
              </p>
            )}
            {p.impliedCause?.status === 'DECLINED' && (
              <p className="text-[11px] text-amber-800 mt-2">
                ⚠ Recorded: this policy answers a cause your diagnosis does not claim.
              </p>
            )}

            {p.phase === 'LATER' && (
              <p className="text-[11px] text-zinc-700 mt-2">
                Kept for a later phase{p.phaseReason ? ` — ${p.phaseReason}` : ''}.
              </p>
            )}

            <div className="flex flex-wrap gap-2 mt-2.5">
              <button onClick={() => void patch({ op: 'settle', policyId: p.id })} disabled={busy}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-900 text-white disabled:opacity-40">
                Make this the guiding policy
              </button>
              <button onClick={() => void patch({ op: 'phase', policyId: p.id, phase: 'LATER', reason: reasons[p.id] })} disabled={busy}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40">
                Later phase
              </button>
              <button onClick={() => void patch({ op: 'reject', policyId: p.id, reason: reasons[p.id] })} disabled={busy}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 text-zinc-600 disabled:opacity-40">
                Rule out
              </button>
              <input
                value={reasons[p.id] ?? ''}
                onChange={(e) => setReasons((r) => ({ ...r, [p.id]: e.target.value }))}
                placeholder="Why? (kept with it)"
                className="flex-1 min-w-[10rem] text-[11px] rounded border border-zinc-300 px-2 py-1"
              />
            </div>
          </article>
        ))}
      </div>

      {/* ══ §1.5 — HOW THEY RELATE ═════════════════════════════════════════════ */}
      {s.pairings.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-100">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            How these relate
          </h4>
          <ul className="mt-1.5 space-y-1.5">
            {s.pairings.slice(0, 12).map((x, i) => (
              <li key={i} className="text-xs text-zinc-700">
                <span className="font-semibold tabular-nums">{x.a} &amp; {x.b}</span>{' '}
                — <span className="font-medium">{RELATIONSHIP_LABEL[x.relationship]}.</span>{' '}
                <span className="text-zinc-600">{x.why}</span>
              </li>
            ))}
          </ul>
          {s.pairings.length > 12 && (
            <p className="text-[11px] text-zinc-500 mt-1">
              {s.pairings.length - 12} further pairs not listed.
            </p>
          )}
        </div>
      )}

      {/* ══ §1.7 — THE INSTRUCTION BOX ═════════════════════════════════════════ */}
      <div className="px-4 py-3 border-t border-zinc-100">
        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Tell Lex what to do
        </label>
        <div className="flex gap-2 mt-1.5">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void runInstruction() }}
            placeholder="merge 4 and 8"
            className="flex-1 text-sm rounded-lg border border-zinc-300 px-2.5 py-1.5"
          />
          <button onClick={() => void runInstruction()} disabled={busy}
            className="text-sm font-semibold px-4 py-1.5 rounded-full bg-zinc-900 text-white disabled:opacity-40">
            {busy ? 'Thinking…' : 'Ask'}
          </button>
        </div>
        <p className="text-[11px] text-zinc-500 mt-1">
          Refer to policies by their number. Lex will tell you whether they merge, whether one is
          really an action of the other, whether they should be sequenced, or whether they
          contradict — and why.
        </p>

        {answer && (
          <div className="mt-2.5 rounded-lg border-2 border-zinc-300 bg-zinc-50/70 p-3">
            <p className="text-xs font-semibold text-zinc-900">
              {answer.answer.verdict === 'MERGE' ? 'Merged.'
                : answer.answer.verdict === 'ONE_CONTAINS_THE_OTHER' ? 'Not a merge — one contains the other.'
                : answer.answer.verdict === 'SEQUENCE' ? 'Not a merge — sequence them.'
                : 'Refused — they contradict.'}
            </p>
            <p className="text-xs text-zinc-700 mt-1">{answer.answer.reasoning}</p>
            {answer.createdNumber && (
              <p className="text-xs text-zinc-900 mt-1.5 font-medium">
                The merged policy is number {answer.createdNumber}. Both originals keep their
                numbers and are shown below as superseded.
              </p>
            )}
            {answer.answer.chainLink && (
              <p className="mt-1.5 text-xs text-zinc-900 border-l-2 border-zinc-900 pl-2.5 font-medium">
                ⚠ If only part of this is delivered: {answer.answer.chainLink}
              </p>
            )}
            <button onClick={() => setAnswer(null)} className="text-[11px] text-zinc-500 mt-2 underline">
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* ══ §1.3 — THE ITEMS THAT ARE REALLY ACTIONS ═══════════════════════════ */}
      {actions.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-100">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Really coherent actions ({actions.length})
          </h4>
          <p className="text-[11px] text-zinc-600 mt-0.5">
            These are things you would <span className="font-medium">do</span> to carry a policy
            out. They belong in Coherent Actions — but nothing moves until you say so.
          </p>
          <ul className="mt-2 space-y-2">
            {actions.map((a) => {
              const parent = a.parkedWithId ? s.policies.find((x) => x.id === a.parkedWithId) : null
              return (
                <li key={a.id} className="rounded-lg border border-zinc-200 p-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-zinc-900 tabular-nums">{a.number}</span>
                    <p className="text-sm text-zinc-800 flex-1">{a.approach}</p>
                  </div>
                  {/* ⚠ 25-S §1.2/§1.3 — `kindReason` alone said WHY without saying WHAT HAPPENED.
                      The history line names the move ("Was a candidate guiding policy…") and the
                      undo lets the user overrule it: §1.3 — a judgement the user cannot overturn
                      is an imposition, and 25-P measured that the causal link this sort rests on
                      was set on zero of eighteen rows. */}
                  <CardHistory
                    p={a}
                    pairings={s.pairings}
                    busy={busy}
                    onUndo={() => void patch({ op: 'undoSort', policyId: a.id })}
                  />
                  {/* ⚠⚠ §1.3's SECOND HALF: an action belongs to a POLICY. If that policy is not
                      the one settled, the action follows its fate rather than entering the kernel. */}
                  {parent && (
                    <p className="text-[11px] text-zinc-700 mt-1">
                      Carries out policy {parent.number}.{' '}
                      {parent.status === 'CHOSEN'
                        ? 'That is your guiding policy, so this moves straight into Coherent Actions.'
                        : 'That policy is not settled yet, so this waits with it — if you rule that policy out, this goes with it.'}
                    </p>
                  )}
                  {a.moveStatus === 'ACCEPTED' && (
                    <p className="text-[11px] text-zinc-700 mt-1">
                      {a.movedToActionId
                        ? '✓ Moved into Coherent Actions.'
                        : '✓ Accepted — waiting with the policy it carries out.'}
                    </p>
                  )}
                  {a.moveStatus !== 'ACCEPTED' && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button onClick={() => void patch({ op: 'acceptMove', policyId: a.id })} disabled={busy}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-900 text-white disabled:opacity-40">
                        Move it to Coherent Actions
                      </button>
                      <button onClick={() => void patch({ op: 'declineMove', policyId: a.id })} disabled={busy}
                        className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40">
                        No — keep it as a policy
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* §1.2 — the goal restatements, set aside WITH THE REASON. */}
      {goals.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-100">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Really the goal restated ({goals.length})
          </h4>
          <p className="text-[11px] text-zinc-600 mt-0.5">
            These rule nothing out, so they are goals rather than policies. Set aside, not deleted.
          </p>
          <ul className="mt-2 space-y-1.5">
            {goals.map((g) => (
              <li key={g.id} className="rounded-lg border border-zinc-200 p-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-zinc-900 tabular-nums">{g.number}</span>
                  <p className="text-sm text-zinc-800 flex-1">{g.approach}</p>
                </div>
                {/* ⚠ 25-S §1.3 — SET ASIDE IS A MOVE, SO IT HAS AN UNDO TOO. These were the
                    quietest of the three groups: a bare line of text with no way back. */}
                <CardHistory
                  p={g}
                  pairings={s.pairings}
                  busy={busy}
                  onUndo={() => void patch({ op: 'undoSort', policyId: g.id })}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ══ §1.10 — LATER PHASES ═══════════════════════════════════════════════ */}
      {later.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-100">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Later phases ({later.length})
          </h4>
          <p className="text-[11px] text-zinc-600 mt-0.5">
            Wanted, but not in this proposal. Breaking the challenge into chunks is the discipline,
            not a loss.
          </p>
        </div>
      )}

      {/* ══ §1.10 — REJECTED, SEARCHABLE AND RESTORABLE ════════════════════════ */}
      {rejected.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-100">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Ruled out ({rejected.length})
          </h4>
          <ul className="mt-2 space-y-1.5">
            {rejected.map((r) => (
              <li key={r.id} className="text-xs text-zinc-600 flex items-start gap-2">
                <span className="font-semibold tabular-nums text-zinc-500">{r.number}</span>
                <span className="flex-1">
                  {r.approach}
                  {r.ruleOutReason && <span className="block text-[11px] text-zinc-500">Why: {r.ruleOutReason}</span>}
                </span>
                {/* ⚠ §1.10 — A RESTORE RETURNS THE ORIGINAL NUMBER, because it never left. */}
                <button onClick={() => void patch({ op: 'restore', policyId: r.id })} disabled={busy}
                  className="text-[11px] text-blue-700 hover:text-blue-900 disabled:opacity-40 shrink-0">
                  Restore as {r.number}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ══ §1.9 — TWO ROUNDS, THEN LEX STOPS ASKING ═══════════════════════════ */}
      <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/60">
        {s.settled ? (
          <p className="text-xs text-zinc-800">
            <span className="font-semibold">Settled:</span> {s.settled}
          </p>
        ) : s.unresolved ? (
          <p className="text-xs text-zinc-800">
            <span className="font-semibold">Recorded as unresolved.</span>{' '}
            {s.unresolvedWhy}
          </p>
        ) : s.offerUnresolved ? (
          <>
            {/* ⚠ NEVER A BLOCK. §1.9: a "computer says no" is worse than an unresolved tension.
                After two rounds Lex offers to proceed and records what it turns on. */}
            <p className="text-xs text-zinc-800">
              You have been round this twice. You do not have to settle it now — the proposal can
              carry the choice as <span className="font-medium">unresolved</span>, with what it
              turns on written down.
            </p>
            <div className="flex gap-2 mt-2">
              <input
                value={reasons.__unresolved ?? ''}
                onChange={(e) => setReasons((r) => ({ ...r, __unresolved: e.target.value }))}
                placeholder="What does the choice turn on?"
                className="flex-1 text-xs rounded border border-zinc-300 px-2 py-1"
              />
              <button
                onClick={() => void patch({ op: 'proceedUnresolved', reason: reasons.__unresolved })}
                disabled={busy}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border-2 border-zinc-800 text-zinc-900 disabled:opacity-40 whitespace-nowrap">
                Carry on with it unresolved
              </button>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-zinc-600">
            Round {s.rounds + 1}. You can stop anywhere — merges, moves, ratings and anything you
            have declined all come back exactly as you left them.
          </p>
        )}
      </div>
    </section>
  )
}
