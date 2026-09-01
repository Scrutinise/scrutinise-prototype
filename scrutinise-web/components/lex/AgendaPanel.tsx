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
import CollapsedSection from './CollapsedSection'

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
  /** 25-Q §7a/§7b — the challenge's own name, and the model that raised it. Null on rows
   *  written before 25-Q; both render as absent rather than as a guess. */
  title: string | null; sourceModel: string | null
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

/**
 * ══ 25-N §1c — EVERY HEADING TOGGLES BOTH WAYS, ALWAYS ══════════════════════════
 *
 * ⚠ THESE WERE THE TWO THE BRIEF NAMES BY NAME. "Decisions" and "Where the research changed
 * my mind" had no toggle at all — the heading was an `<h4>` and the body was always there —
 * so a user who had read the six contradictions had to scroll past them for the rest of the
 * session. §1c: *"Every heading toggles both ways, always."*
 *
 * ⚠ IT OPENS WHEN THE WORKLIST JUMPS TO IT. `WorkList` links to `#agenda-decisions`; a jump
 * that lands on a collapsed section is a link that appears to do nothing, which is the same
 * complaint one level down. `openOnHash` watches the fragment.
 */
function Section({ id, title, count, hint, children }: {
  // ⚠ 25-K §3 — THE ID IS WHAT MAKES THE WORKLIST A JUMP RATHER THAN A LABEL.
  // `WorkList` names these anchors; a row that says "read the two contradictions" and does
  // not take you to them is a second thing to work out, which is the fault this sprint is
  // fixing. Named here rather than in the worklist so the two cannot drift.
  id?: string; title: string; count: number; hint?: string; children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (!id) return
    const openIfMine = () => {
      if (window.location.hash === `#${id}`) setOpen(true)
    }
    openIfMine()
    window.addEventListener('hashchange', openIfMine)
    return () => window.removeEventListener('hashchange', openIfMine)
  }, [id])

  return (
    <section id={id} className="scroll-mt-4 border-t border-zinc-100 px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-baseline gap-2 text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-zinc-50"
      >
        <h4 className="text-sm font-semibold text-zinc-900">{title}</h4>
        <span className="text-xs text-zinc-400 flex-1">{count}</span>
        {/* Two different characters plus a word — never one glyph recoloured (§21). */}
        <span className="text-[11px] text-zinc-400 whitespace-nowrap">{open ? 'hide −' : 'show +'}</span>
      </button>
      {hint && <p className="text-xs text-zinc-500 mt-0.5">{hint}</p>}
      {open && <div className="mt-2 space-y-3">{children}</div>}
    </section>
  )
}

/**
 * ══ 25-N §3b — WHICH HALF OF THE AGENDA THIS INSTANCE IS ═══════════════════════
 *
 * §3b moves two of these sections to the right-hand panel: *"Where the research changed my
 * mind"* and *"Decisions"*. Both are things Lex DID and wants judged — raw material for the
 * user to work through — and §3's logic puts raw material on the right. What stays in the
 * middle is the report and the work still owed on it.
 *
 * ⚠⚠ IT IS ONE COMPONENT RENDERED TWICE, NOT TWO COMPONENTS. The decision handler, the fetch,
 * the fork grouping and the "I didn't record why I chose this" honesty note are the same code
 * in both places. Splitting the file would have produced two `decide` functions writing the
 * same table, and the second one would have been the one that stopped being updated.
 *
 * ⚠ AND EACH VIEW RENDERS NOTHING WHEN ITS OWN SECTIONS ARE EMPTY, rather than an empty
 * shell. `judgements` on an idea with no decisions and no contradictions is not a heading
 * with nothing under it — it is a panel that has nothing to say yet, which is different from
 * the stated-gap rule the RESEARCH headings live under (those are claims about the world;
 * this is a claim about our own output).
 */
export type AgendaView =
  /** The middle column: challenges, reading, gaps, what you know that we don't. */
  | 'work'
  /** The right-hand panel: decisions, and where the research changed Lex's mind. */
  | 'judgements'

export default function AgendaPanel({ ideaId, view = 'work' }: { ideaId: string; view?: AgendaView }) {
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

  const judgements = view === 'judgements'
  // ⚠ AN INSTANCE WITH NOTHING OF ITS OWN RENDERS NOTHING. See the `AgendaView` note.
  const hasWork = a.challenges.length > 0 || a.reading.length > 0 || a.gaps.length > 0
    || !!a.contribution.ownKnowledge || a.contribution.wouldStrengthen.length > 0
  const hasJudgements = a.decisions.length > 0 || a.contradictions.length > 0
  if (judgements ? !hasJudgements : !hasWork) return null

  // ══ ADDENDUM §A2 — THE MIDDLE COLUMN'S COPY IS CLOSED BY DEFAULT ═══════════
  //
  // ⚠ ONLY THE `work` VIEW. The `judgements` view is rendered INSIDE the research panel's
  // contents list, which is already one-item-at-a-time — wrapping it would put a collapse
  // inside a collapse and give the user two controls for one act.
  const body = (
    <>
      {!judgements && (
        // ⚠ 25-N §3d's WORDING SURVIVES, MOVED INSIDE. It is the sentence that says what this
        // panel is FOR, which a user needs on opening it rather than on the closed header.
        <p className="px-4 pt-3 text-xs text-zinc-500">
          This panel lists the decisions and actions you need to take to build the draft strategy
          I’ve prepared for you into your formal proposal.
        </p>
      )}
      {judgements && (
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">Decisions and changes of mind</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            From build {a.buildVersion}. The choices I made for you, and the places the research
            moved me. Take each one or change it — both are recorded.
          </p>
        </div>
      )}

      {error && <p className="px-4 pb-2 text-xs text-amber-700">{error}</p>}

      {/* ── §3b — CONTRADICTIONS LEAD ─────────────────────────────────────── */}
      {judgements && a.contradictions.length > 0 && (
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
      {judgements && a.decisions.length > 0 && (
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
      {!judgements && a.challenges.length > 0 && (
        <Section
          id="agenda-challenges"
          title="Challenges"
          count={a.challenges.filter((c) => c.status === 'OPEN').length}
          hint="What a hostile committee clerk would ask that this cannot yet answer."
        >
          {a.challenges.map((c) => (
            <div key={c.id} className={`rounded-lg border p-2.5 ${c.status === 'OPEN' ? 'border-zinc-200' : 'border-zinc-100 bg-zinc-50/60'}`}>
              {/* ══ 25-Q §7a — A TITLE, WHERE THE PROVENANCE USED TO BE ══════════════════
                  Charlie: the challenges are the most valuable part of the run, and the
                  attribution is in the wrong place. Every coverage challenge opened with
                  *"ANOTHER MODEL MADE THIS POINT AND OUR PROPOSAL DOES NOT ADDRESS IT — "*, so
                  the same eleven capitalised words headed all of them and none had a name.

                  ⚠ A ROW WITH NO TITLE RENDERS WITHOUT ONE. Titles arrive from the pass that
                  wrote the challenge; deriving one here from the text would be this panel
                  guessing what a point is about, which is the rule 25-D §3 exists to hold. */}
              {c.title && (
                <p className="text-sm font-semibold text-zinc-900 mb-0.5">{c.title}</p>
              )}
              <p className="text-sm text-zinc-800">{c.text}</p>
              {/* ══ §7b — THE SOURCE, AT THE FOOT ═══════════════════════════════════════
                  ⚠ IT IS NOT DROPPED, IT IS MOVED. Which model raised a point is real
                  provenance and a reader is entitled to it; it is simply not the headline.
                  Marked with a character and a word, never by colour alone. */}
              {c.sourceModel && (
                <p className="text-[11px] text-zinc-500 mt-1.5">
                  <span aria-hidden>· </span>Raised by {c.sourceModel}, reading your account on its own.
                </p>
              )}
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
      {!judgements && a.reading.length > 0 && (
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
      {!judgements && a.gaps.length > 0 && (
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
      {!judgements && (a.contribution.ownKnowledge || a.contribution.wouldStrengthen.length > 0) && (
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

      {/* ⚠ AFTER THE WORK, NEVER BEFORE IT. See the header. Shown on the work view only:
          it is Lex's framing of the DRAFT, and under the right-hand panel's decisions it
          would read as a disclaimer about the decisions themselves. */}
      {!judgements && (
        <p className="px-4 py-3 border-t border-zinc-100 text-sm text-zinc-700 bg-zinc-50/60">
          {a.framing}
        </p>
      )}
    </>
  )

  // ⚠ THE RESEARCH PANEL'S COPY IS NOT WRAPPED — see the note on `body`.
  if (judgements) {
    return <div className="border border-zinc-200 rounded-2xl overflow-hidden mt-4">{body}</div>
  }

  // §A2 — closed by default in DRAFT STRATEGY, with the count that says why to open it.
  //
  // ══ 25-P §4b — THE HEADER COUNTS WHAT THE USER CAN ACT ON ═══════════════════════════
  //
  // §4b: *"'What to do next · 136' is accurate — 2 decisions plus 135 open challenges — but
  // reads as a wall on a collapsed header. Show the actionable count on the header and the
  // total inside."*
  //
  // ⚠⚠ THE NUMBER WAS RIGHT AND THE HEADING WAS WRONG. "What to do next" promises a list of
  // things to do; 135 open challenges are not 135 things to do, they are the body of work the
  // proposal has to answer over its life. Putting them behind the same word turns a two-item
  // to-do list into a wall, and a wall is a thing a user closes.
  //
  // ⚠ ACTIONABLE = A DECISION ONLY YOU CAN MAKE, OR A GAP ONLY YOU CAN FILL. Both are blocked
  // on the user personally. An open challenge is work; it is counted, named and reachable —
  // one line lower, inside, where its size is information rather than a barrier.
  const decisions = a.decisions.filter((d) => !d.resolved).length
  const onlyYou = a.gaps.filter((g) => g.task === 'only-you').length
  const challenges = a.challenges.filter((c) => c.status === 'OPEN').length
  const actionable = decisions + onlyYou
  const total = actionable + challenges

  const part = (n: number, one: string, many: string) =>
    n ? `${n} ${n === 1 ? one : many}` : ''
  const insideLine = [part(decisions, 'decision', 'decisions'),
    part(onlyYou, 'gap only you can fill', 'gaps only you can fill'),
    part(challenges, 'open challenge', 'open challenges')].filter(Boolean).join(', ')

  return (
    <CollapsedSection
      title="What to do next"
      count={actionable}
      hint={actionable === 0
        ? challenges
          // ⚠ NOT "nothing is waiting on you". 135 open challenges with no decision outstanding
          // is a real and useful state, and saying "nothing" about it would be false.
          ? `Nothing is blocked on you. ${challenges} open challenge${challenges === 1 ? '' : 's'} inside.`
          : 'Nothing is waiting on you here.'
        : `${actionable} waiting on you. ${total} in all — ${insideLine}.`}
    >
      {/* ⚠ THE TOTAL, INSIDE, WHERE §4b PUT IT. The header says what to do; this says how much
          there is. A reader who opens the section is asking the second question. */}
      <p className="px-4 pt-3 -mb-1 text-[11px] text-zinc-500">{total} in all — {insideLine}.</p>
      {body}
    </CollapsedSection>
  )
}
