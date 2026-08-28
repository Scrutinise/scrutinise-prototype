'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-C §3 — THE REVIEW AGENDA, on a completed build.
//
// The user's work is DECIDING, READING and ANSWERING. Until now they were handed a filled-in
// kernel and a long list of findings and left to work out which was which.
//
// ⚠⚠ CONTRADICTIONS COME FIRST AND THAT IS NOT A STYLING CHOICE. §3b: the sentence "I first
// concluded X; the evidence says Y" is the single most valuable thing a build produces, and it was
// buried mid-list. The section order comes from `AGENDA_SECTIONS` in lib/lex/agenda.ts so that it
// is asserted by a check rather than being whatever order this file happens to render in.
//
// ⚠ THE FRAMING PARAGRAPH IS AT THE BOTTOM, DELIBERATELY. §19-E's placement lesson, restated by
// §3: after the work, never before it. The same words before the agenda read as a disclaimer
// telling the user not to trust any of it; after it, they read as an invitation to argue.
//
// THREE THINGS THIS PANEL WILL NOT DO:
//   • It will not reproduce the library (§3d). Two or three sources, each with the one sentence
//     saying why THIS one. Everything else stays in the Deepening panel where it already is.
//   • It will not hide a decision once it is made, or the alternative that was set aside. A
//     proposal that shows what it considered is stronger than one that looks inevitable.
//   • It will not score anything. Counts are facts; a total is a judgment laundered as a number.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'

interface Contradiction {
  id: string; fieldKey: string | null
  firstConcluded: string; evidenceSays: string; whyChanged: string; status: string
}
interface Decision {
  forkKey: string; fieldKey: string; chosen: string
  recommendationReason: string | null
  alternatives: Array<{ id: string; index: number; alternative: string; caseFor: string }>
  resolved: boolean; resolvedChoice: string | null; changedByResearch: boolean
}
interface Challenge {
  id: string; text: string; status: string; dismissReason: string | null; passKey: string
}
interface Reading {
  id: string; title: string; citation: string | null; url: string | null
  why: string; assembled: boolean
}
interface Gap { question: string; why: string; task: 'research' | 'only-you' | 'limitation' }

export interface Agenda {
  ideaId: string
  buildVersion: number | null
  contradictions: Contradiction[]
  decisions: Decision[]
  challenges: Challenge[]
  reading: Reading[]
  gaps: Gap[]
  contribution: { ownKnowledge: string | null; usedIn: string[]; wouldStrengthen: string[] }
  framing: string
}

const GAP_LABEL: Record<Gap['task'], string> = {
  research: 'A research task',
  'only-you': 'Only you can answer this',
  limitation: 'A limit in what we can reach',
}
const GAP_CLASS: Record<Gap['task'], string> = {
  research: 'bg-sky-50 text-sky-700 border-sky-200',
  'only-you': 'bg-amber-50 text-amber-800 border-amber-200',
  // ⚠ Grey, not red. A limit in our tooling is not the user's problem to solve and must not be
  // styled as an alarm they should act on.
  limitation: 'bg-zinc-50 text-zinc-600 border-zinc-200',
}

function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${className}`}>
      {children}
    </span>
  )
}

function Section({ id, title, count, hint, children }: {
  // ⚠ 25-K §3 — THE ID IS WHAT MAKES THE WORKLIST A JUMP RATHER THAN A LABEL.
  // `WorkList` names these anchors; a row that says "read the two contradictions" and does
  // not take you to them is a second thing to work out, which is the fault this sprint is
  // fixing. Named here rather than in the worklist so the two cannot drift.
  id?: string; title: string; count: number; hint?: string; children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-4 border-t border-zinc-100 px-4 py-3">
      <div className="flex items-baseline gap-2">
        <h4 className="text-sm font-semibold text-zinc-900">{title}</h4>
        <span className="text-xs text-zinc-400">{count}</span>
      </div>
      {hint && <p className="text-xs text-zinc-500 mt-0.5">{hint}</p>}
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  )
}

export default function AgendaPanel({ ideaId }: { ideaId: string }) {
  const [agenda, setAgenda] = useState<Agenda | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/agenda`)
      if (!res.ok) return
      setAgenda(await res.json() as Agenda)
    } catch { /* a failed load is not an error state; the panel simply does not appear */ }
  }, [ideaId])

  useEffect(() => { void load() }, [load])

  const decide = async (forkKey: string, choice: string) => {
    setBusy(forkKey); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/agenda`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forkKey, choice }),
      })
      if (!res.ok) { setError('That decision could not be recorded.'); return }
      setAgenda(await res.json() as Agenda)
    } catch {
      setError('That decision could not be recorded.')
    } finally { setBusy(null) }
  }

  // The agenda is a thing you get AFTER a build. Before one, there is nothing to review and an
  // empty panel saying so would be furniture.
  if (!agenda || agenda.buildVersion == null) return null

  const a = agenda

  return (
    <div className="border border-zinc-200 rounded-2xl overflow-hidden mt-4">
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-900">What to do next</h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          From build {a.buildVersion}. Deciding, reading and answering — in the order that most
          changes the proposal.
        </p>
      </div>

      {error && <p className="px-4 pb-2 text-xs text-amber-700">{error}</p>}

      {/* ── §3b — CONTRADICTIONS LEAD ─────────────────────────────────────── */}
      {a.contradictions.length > 0 && (
        <Section
          id="agenda-contradictions"
          title="Where the research changed my mind"
          count={a.contradictions.length}
          hint="I drafted this before I had looked anything up. These are the places the evidence moved me."
        >
          {a.contradictions.map((c) => (
            <div key={c.id} className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
              {c.fieldKey && <Chip className="bg-violet-50 text-violet-700 border-violet-200">{c.fieldKey}</Chip>}
              <p className="text-xs text-zinc-500 mt-1.5">I first concluded</p>
              <p className="text-sm text-zinc-700 line-through decoration-zinc-300">{c.firstConcluded}</p>
              <p className="text-xs text-zinc-500 mt-2">The evidence says</p>
              <p className="text-sm text-zinc-900 font-medium">{c.evidenceSays}</p>
              {c.whyChanged && (
                <>
                  <p className="text-xs text-zinc-500 mt-2">Why I changed my mind</p>
                  <p className="text-sm text-zinc-700">{c.whyChanged}</p>
                </>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* ── §3a — DECISIONS ───────────────────────────────────────────────── */}
      {a.decisions.length > 0 && (
        <Section
          id="agenda-decisions"
          title="Decisions"
          count={a.decisions.length}
          hint="Each of these is a real choice I made for you. Take it or change it — both are recorded."
        >
          {a.decisions.map((d) => (
            <div
              key={d.forkKey}
              className={`rounded-lg border p-3 ${d.changedByResearch ? 'border-amber-300 bg-amber-50/50' : 'border-zinc-200'}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Chip className="bg-zinc-50 text-zinc-600 border-zinc-200">{d.fieldKey}</Chip>
                {d.changedByResearch && (
                  <Chip className="bg-amber-100 text-amber-800 border-amber-300">Reopened by the research</Chip>
                )}
                {d.resolved && <Chip className="bg-emerald-50 text-emerald-700 border-emerald-200">Decided</Chip>}
              </div>

              <p className="text-xs text-zinc-500 mt-2">My recommendation</p>
              <p className="text-sm font-medium text-zinc-900">{d.chosen}</p>
              {/* ⚠ Absence is RENDERED, not hidden. A build made before 25-C has no recorded
                  reasoning, and saying so is better than a confident-looking blank. */}
              {d.recommendationReason
                ? <p className="text-sm text-zinc-700 mt-1">{d.recommendationReason}</p>
                : <p className="text-xs text-zinc-400 italic mt-1">I didn’t record why I chose this — that’s a gap in the build, not a reason to trust it more.</p>}

              {d.alternatives.map((alt) => (
                <div key={alt.id} className="mt-2 pl-3 border-l-2 border-zinc-200">
                  <p className="text-xs text-zinc-500">Instead of</p>
                  <p className="text-sm text-zinc-800">{alt.alternative}</p>
                  <p className="text-sm text-zinc-600 italic mt-0.5">{alt.caseFor}</p>
                  {!d.resolved && (
                    <button
                      onClick={() => void decide(d.forkKey, `alternative:${alt.index}`)}
                      disabled={busy === d.forkKey}
                      className="mt-1.5 text-xs font-medium px-3 py-1 rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                    >
                      Take this instead
                    </button>
                  )}
                </div>
              ))}

              {!d.resolved ? (
                <button
                  onClick={() => void decide(d.forkKey, 'chosen')}
                  disabled={busy === d.forkKey}
                  className="mt-3 text-xs font-medium px-3 py-1.5 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
                >
                  Keep my recommendation
                </button>
              ) : (
                <p className="text-xs text-emerald-700 mt-2">
                  You chose: {d.resolvedChoice === 'chosen'
                    ? d.chosen
                    : d.alternatives.find((x) => `alternative:${x.index}` === d.resolvedChoice)?.alternative ?? d.resolvedChoice}
                </p>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* ── §3c — CHALLENGES ──────────────────────────────────────────────── */}
      {a.challenges.length > 0 && (
        <Section
          id="agenda-challenges"
          title="Challenges"
          count={a.challenges.filter((c) => c.status === 'OPEN').length}
          hint="What a hostile committee clerk would ask that this cannot yet answer."
        >
          {a.challenges.map((c) => (
            <div key={c.id} className={`rounded-lg border p-2.5 ${c.status === 'OPEN' ? 'border-zinc-200' : 'border-zinc-100 bg-zinc-50/60'}`}>
              <p className="text-sm text-zinc-800">{c.text}</p>
              {c.status !== 'OPEN' && (
                <p className="text-xs text-zinc-500 mt-1">
                  {c.status === 'DISMISSED' ? 'Dismissed' : c.status === 'ADDRESSED' ? 'Addressed' : 'Deferred'}
                  {c.dismissReason ? ` — ${c.dismissReason}` : ''}
                </p>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* ── §3d — READING ─────────────────────────────────────────────────── */}
      {a.reading.length > 0 && (
        <Section
          id="agenda-reading"
          title="Read these"
          count={a.reading.length}
          hint="Not everything — these. Reading the primary material is where your judgment enters and mine can’t substitute."
        >
          {a.reading.map((r) => (
            <div key={r.id} className="rounded-lg border border-zinc-200 p-2.5">
              <div className="flex items-start gap-2">
                {r.assembled && <Chip className="bg-indigo-50 text-indigo-700 border-indigo-200">Assembled record</Chip>}
              </div>
              {r.url
                ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-700 hover:underline">{r.title}</a>
                : <p className="text-sm font-medium text-zinc-900">{r.title}</p>}
              <p className="text-xs text-zinc-600 mt-1">{r.why}</p>
            </div>
          ))}
        </Section>
      )}

      {/* ── §3e — GAPS ────────────────────────────────────────────────────── */}
      {a.gaps.length > 0 && (
        <Section
          id="agenda-gaps"
          title="What nobody has answered"
          count={a.gaps.length}
          hint="Named, so a gap is a strength rather than a silence."
        >
          {a.gaps.map((g, i) => (
            <div key={`${g.question}-${i}`} className="rounded-lg border border-zinc-200 p-2.5">
              <Chip className={GAP_CLASS[g.task]}>{GAP_LABEL[g.task]}</Chip>
              <p className="text-sm text-zinc-800 mt-1.5">{g.question}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{g.why}</p>
            </div>
          ))}
        </Section>
      )}

      {/* ── §3f — YOUR CONTRIBUTION ───────────────────────────────────────── */}
      {(a.contribution.ownKnowledge || a.contribution.wouldStrengthen.length > 0) && (
        <Section title="What you know that we don’t" count={a.contribution.wouldStrengthen.length}>
          {a.contribution.ownKnowledge && (
            <div className="rounded-lg border border-zinc-200 p-2.5">
              <p className="text-xs text-zinc-500">You told me</p>
              <p className="text-sm text-zinc-800 mt-0.5">{a.contribution.ownKnowledge}</p>
            </div>
          )}
          {a.contribution.wouldStrengthen.length > 0 && (
            <div className="rounded-lg border border-zinc-200 p-2.5">
              <p className="text-xs text-zinc-500">More of it would help most here</p>
              <ul className="mt-1 space-y-1">
                {a.contribution.wouldStrengthen.map((q, i) => (
                  <li key={i} className="text-sm text-zinc-700">— {q}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* ⚠ AFTER THE WORK, NEVER BEFORE IT. See the header. */}
      <p className="px-4 py-3 border-t border-zinc-100 text-sm text-zinc-700 bg-zinc-50/60">
        {a.framing}
      </p>
    </div>
  )
}
