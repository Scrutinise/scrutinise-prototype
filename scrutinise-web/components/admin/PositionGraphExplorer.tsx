'use client'

import { useCallback, useState } from 'react'

// GRAPH 3A §6 — the admin surface over the position graph.
//
// Purpose, from the brief: *"Charlie can eyeball the graph against his own political knowledge
// before the formal validation set exists — the cheapest possible reality check."* So the design
// priority is not polish, it is that **every number on the page can be argued with**: the wording
// beside the score, the signal breakdown, the individual dated citations, and the config that
// produced all of it are on the same screen.
//
// ⚠ It shows the identity tier on every actor. Design §3: a mention-only actor must never be
// presented as an identified one, and the wording comes from `graph_identity_tier` in SQL rather
// than from this file, so a screen cannot invent its own.

interface Ground {
  targetType: string
  targetId: string
  targetLabel: string | null
  date: string
  signalType: string
  derivation: string | null
  direction: number
  weight: number
  sourceUrl: string | null
  evidenceIds: string[]
}

interface ActorPosition {
  actorId: string
  name: string
  kind: string
  identityTier: string
  identityStatement: string
  identityCaveat: string | null
  parlMemberId: number | null
  stanceScore: number
  confidence: number
  confidenceWording: string
  stanceWording: string
  signalCounts: Record<string, { n: number; weight: number }>
  claim: string
  claimCaveat: string | null
  byTarget: Array<{
    targetType: string; targetId: string; targetLabel: string | null; date: string
    stanceScore: number; confidence: number; stanceWording: string; claim: string
  }>
  divided: boolean
  signalCount: number
  grounds: Ground[]
}

interface Ranking {
  key: string
  tiedAtTop: number
  ofMatched: number
  shown: number
  shownOrderIsNameOrderOnly: boolean
  note: string | null
}

interface Candidate { type: string; id: string; label: string; date: string | null }

interface PositionsResponse {
  mode: string
  actors: ActorPosition[]
  ranking: Ranking
  targetsWithNoSignals: Array<{ type: string; id: string }>
  actorsMatched: number
  asOf: string
  configVersion: string | null
  elapsedMs: number
  unparseableTargets: number
  config: {
    version: string
    weights: Record<string, number>
    halfLifeYears: Record<string, number | null>
    cohesionThreshold: number
    attentionConfidenceCeiling: number
  }
}

const box = 'rounded-md border border-zinc-200 bg-white'

export default function PositionGraphExplorer() {
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [picked, setPicked] = useState<Candidate[]>([])
  const [manual, setManual] = useState('')
  const [result, setResult] = useState<PositionsResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [actorKind, setActorKind] = useState<'' | 'person' | 'organisation'>('')

  const search = useCallback(async () => {
    if (query.trim().length < 3) return
    setBusy(true); setErr(null)
    try {
      const r = await fetch(`/api/admin/positions?find=${encodeURIComponent(query.trim())}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'search failed')
      setCandidates(j.targets ?? [])
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }, [query])

  const run = useCallback(async () => {
    const fromPicked = picked.map((p) => `${p.type}:${p.id}`)
    const fromManual = manual.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
    const targets = [...new Set([...fromPicked, ...fromManual])]
    if (!targets.length) { setErr('Pick at least one target, or type one as type:id'); return }
    setBusy(true); setErr(null); setResult(null)
    try {
      const qs = new URLSearchParams({ targets: targets.join(','), limit: '40' })
      if (actorKind) qs.set('actorKind', actorKind)
      const r = await fetch(`/api/admin/positions?${qs}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.detail ?? j.error ?? 'lookup failed')
      setResult(j)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }, [picked, manual, actorKind])

  return (
    <div className="space-y-6">
      {/* ── pick targets ─────────────────────────────────────────────────────────── */}
      <section className={`${box} p-4 space-y-3`}>
        <h2 className="text-sm font-semibold">1 · Choose what to ask about</h2>
        <p className="text-xs text-zinc-500">
          The graph holds positions toward <strong>concrete things</strong> — a division, an early
          day motion, an inquiry, an organisation — never toward a topic. Search divisions and EDMs
          by title, or type an id directly as <code>division:commons:2071</code>.
        </p>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') search() }}
            placeholder="e.g. Terminally Ill Adults, hunting, sewage"
            className="flex-1 rounded border border-zinc-300 px-3 py-1.5 text-sm"
          />
          <button onClick={search} disabled={busy}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-40">
            Find targets
          </button>
        </div>

        {candidates.length > 0 && (
          <div className="max-h-64 overflow-y-auto rounded border border-zinc-100">
            {candidates.map((c) => {
              const on = picked.some((p) => p.type === c.type && p.id === c.id)
              return (
                <button
                  key={`${c.type}:${c.id}`}
                  onClick={() => setPicked((prev) => on
                    ? prev.filter((p) => !(p.type === c.type && p.id === c.id))
                    : [...prev, c])}
                  className={`flex w-full items-start gap-2 border-b border-zinc-100 px-3 py-1.5 text-left text-xs hover:bg-zinc-50 ${on ? 'bg-emerald-50' : ''}`}
                >
                  <span className="w-4 shrink-0">{on ? '✓' : ''}</span>
                  <span className="w-20 shrink-0 text-zinc-400">{c.type}</span>
                  <span className="w-24 shrink-0 tabular-nums text-zinc-400">{c.date ?? ''}</span>
                  <span className="flex-1">{c.label}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="or paste ids: division:commons:2071 edm:57712"
            className="flex-1 rounded border border-zinc-300 px-3 py-1.5 text-xs font-mono"
          />
          <select value={actorKind} onChange={(e) => setActorKind(e.target.value as '' | 'person' | 'organisation')}
            className="rounded border border-zinc-300 px-2 py-1.5 text-xs">
            <option value="">people and organisations</option>
            <option value="person">people only</option>
            <option value="organisation">organisations only</option>
          </select>
          <button onClick={run} disabled={busy}
            className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white disabled:opacity-40">
            {busy ? 'Working…' : `Show positions (${picked.length + (manual.trim() ? 1 : 0)} target${picked.length === 1 ? '' : 's'})`}
          </button>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
      </section>

      {/* ── results ──────────────────────────────────────────────────────────────── */}
      {result && (
        <section className="space-y-3">
          <div className={`${box} px-4 py-3 text-xs text-zinc-600`}>
            <strong>{result.actorsMatched.toLocaleString()}</strong> actors have at least one
            recorded signal on these targets
            {result.actorsMatched > result.actors.length && <> — showing {result.actors.length}</>}.
            {' '}Decayed to <span className="font-mono">{result.asOf}</span>, config{' '}
            <span className="font-mono">{result.config.version}</span>, {result.elapsedMs} ms.

            {/* GRAPH 3B §1 — the order, and whether it is an order at all.
                The page previously said "showing the top 40" over a list that was in alphabetical
                order, because 135 of 555 actors carried an identical score and the sort had
                nothing left to separate them. Saying "top 40" of a tied set is the same failure
                class as a metric that cannot fail: it looks like a result and is not one. So the
                key is printed verbatim, and when it has run out the page says so. */}
            <div className="mt-2 border-t border-zinc-100 pt-2">
              <span className="text-zinc-400">Ordered by </span>
              <span className="font-mono text-zinc-700">{result.ranking.key}</span>
            </div>
            {result.ranking.note && (
              <div className={`mt-1 rounded px-2 py-1 ${
                result.ranking.shownOrderIsNameOrderOnly
                  ? 'bg-amber-50 text-amber-900' : 'text-zinc-500'}`}>
                {result.ranking.shownOrderIsNameOrderOnly && <strong>⚠ </strong>}
                {result.ranking.note}
              </div>
            )}

            {result.targetsWithNoSignals.length > 0 && (
              <div className="mt-1 text-amber-700">
                ⚠ No signal at all for: {result.targetsWithNoSignals.map((t) => `${t.type}:${t.id}`).join(', ')}
                {' '}— that is an absence of record, <em>not</em> an absence of view.
              </div>
            )}
            {result.actorsMatched === 0 && (
              <div className="mt-1 text-amber-700">
                Nothing recorded. The graph says nothing about these targets — it does not say the
                actors are neutral.
              </div>
            )}
          </div>

          {result.actors.map((a) => (
            <div key={a.actorId} className={`${box} p-4`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold">{a.name}</span>
                  <span className="ml-2 text-[11px] uppercase tracking-wide text-zinc-400">{a.kind}</span>
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-[11px] ${
                      a.identityTier.startsWith('Stable') ? 'bg-emerald-100 text-emerald-800'
                        : a.identityTier.startsWith('Name') ? 'bg-amber-100 text-amber-800'
                          : 'bg-zinc-100 text-zinc-600'}`}
                    title={a.identityCaveat ?? undefined}
                  >
                    {a.identityStatement}
                  </span>
                </div>
                <div className="text-right text-sm">
                  <span className={a.stanceScore > 0 ? 'text-emerald-700' : a.stanceScore < 0 ? 'text-red-700' : 'text-zinc-500'}>
                    {a.stanceWording}
                  </span>
                  <span className="ml-2 tabular-nums text-zinc-500">{a.stanceScore.toFixed(2)}</span>
                  <span className="ml-3 text-zinc-500">{a.confidenceWording}</span>
                  <span className="ml-2 tabular-nums text-zinc-400">{a.confidence.toFixed(3)}</span>
                </div>
              </div>

              {/* GRAPH 3B §1 — the never-claim rule at the display layer.
                  "supported 1.00" beside a name, on a page about assisted dying, is read as
                  "supports assisted dying". What the graph knows is "voted aye on Amendment 12 on
                  20 June 2025", which is a different and narrower statement. The stance word never
                  appears here without the thing it is a stance toward. */}
              <p className="mt-1.5 text-xs text-zinc-800">{a.claim}</p>
              {a.claimCaveat && (
                <p className="mt-1 text-[11px] italic text-amber-800">{a.claimCaveat}</p>
              )}

              <div className="mt-1 text-[11px] text-zinc-500">
                {Object.entries(a.signalCounts)
                  .map(([t, c]) => `${c.n} × ${t.replace(/_/g, ' ')} (weight ${c.weight.toFixed(2)})`)
                  .join(' · ')}
                {a.parlMemberId != null && <> · MNIS {a.parlMemberId}</>}
                {a.divided && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
                    signals point both ways across these targets
                  </span>
                )}
              </div>

              {/* GRAPH 3B §4.2 — Charlie's decision: do not combine divisions on one Bill.
                  Voting for a Bill and against an amendment to it cancel out once summed, and 448
                  of 453 members read as "divided" on the assisted dying Bill for that purely
                  structural reason. The breakdown is therefore always shown, separately labelled,
                  and never added up. */}
              {a.byTarget.length > 1 && (
                <ul className="mt-2 space-y-0.5 border-l-2 border-zinc-100 pl-3 text-[11px] text-zinc-600">
                  {a.byTarget.map((t) => (
                    <li key={`${t.targetType}:${t.targetId}`}>
                      <span className="tabular-nums text-zinc-400">{t.date}</span>{' '}
                      <span className={t.stanceScore > 0 ? 'text-emerald-700' : t.stanceScore < 0 ? 'text-red-700' : 'text-zinc-500'}>
                        {t.stanceWording}
                      </span>{' '}
                      {t.targetLabel ?? `${t.targetType}:${t.targetId}`}
                      <span className="ml-1 tabular-nums text-zinc-400">
                        ({t.stanceScore.toFixed(2)}, conf {t.confidence.toFixed(3)})
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <button
                onClick={() => setOpen(open === a.actorId ? null : a.actorId)}
                className="mt-2 text-xs text-blue-700 underline"
              >
                {open === a.actorId ? 'Hide the evidence' : `Show the evidence (${a.grounds.length})`}
              </button>

              {open === a.actorId && (
                <table className="mt-2 w-full text-[11px]">
                  <thead className="text-left text-zinc-400">
                    <tr>
                      <th className="py-1 pr-2 font-normal">date</th>
                      <th className="py-1 pr-2 font-normal">what</th>
                      <th className="py-1 pr-2 font-normal">how it was classified</th>
                      <th className="py-1 pr-2 font-normal">side</th>
                      <th className="py-1 pr-2 font-normal">weight</th>
                      <th className="py-1 font-normal">source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.grounds.map((g, i) => (
                      <tr key={i} className="border-t border-zinc-100 align-top">
                        <td className="py-1 pr-2 tabular-nums whitespace-nowrap">{g.date}</td>
                        <td className="py-1 pr-2">
                          <span className="text-zinc-400">{g.targetType}</span>{' '}
                          {g.targetLabel ?? g.targetId}
                        </td>
                        <td className="py-1 pr-2 font-mono text-zinc-500">
                          {g.derivation ?? g.signalType.replace(/_/g, ' ')}
                        </td>
                        <td className="py-1 pr-2">
                          {g.direction > 0 ? 'for' : g.direction < 0 ? 'against' : '— (attention only)'}
                        </td>
                        <td className="py-1 pr-2 tabular-nums">{g.weight.toFixed(2)}</td>
                        <td className="py-1">
                          {g.sourceUrl
                            ? <a href={g.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">source</a>
                            : <span className="text-zinc-400">—</span>}
                          <span className="ml-2 font-mono text-zinc-400">{g.evidenceIds[0]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}

          {/* The working, on the same screen as the numbers it produced. */}
          <details className={`${box} p-4 text-xs text-zinc-600`}>
            <summary className="cursor-pointer font-semibold">The config these numbers came from</summary>
            <p className="mt-2">
              Every weight and half-life below is <strong>provisional until the validation set
              measures it</strong> (design §8). Nothing here has been scored against a
              hand-labelled answer key yet, which is why this page is admin-only.
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-zinc-50 p-2">
{JSON.stringify(result.config, null, 2)}
            </pre>
          </details>
        </section>
      )}
    </div>
  )
}
