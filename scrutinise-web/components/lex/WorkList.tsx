'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-K §3 — "WHAT TO DO NEXT". The single most important change in the sprint.
//
// ⚠⚠ THE LEFT COLUMN STOPS BEING A TRANSCRIPT AND BECOMES A WORKLIST. §3: *"The user
// should never have to work out what to do; the list tells them, in order."* Until now the
// user was handed a filled-in kernel, a long list of findings and a chat box, and left to
// infer their own agenda from it — which is the other half of "I'm confused about where I
// am now".
//
// ⚠ IT ASSEMBLES, IT DOES NOT GENERATE. Every item is already a row, and the assembling is
// already done by `lib/lex/agenda.ts` (25-C §3) — which is a pure read with no model call,
// which is why this can be fetched on mount and refreshed after a decision. This component
// adds NO new source of truth; it is the same agenda, in the place the work happens,
// compressed to one line per task.
//
// ⚠ AND IT IS NOT A SECOND AGENDA PANEL. `AgendaPanel` shows each item in full, with its
// evidence, for reading and deciding. This is the LIST: what, how many, and a jump. The two
// are the table of contents and the chapter — the ordering is the same in both, because it
// comes from the same `AGENDA_SECTIONS` constant.
//
// ⚠ ORDER IS THE DESIGN, and it is the agenda's order, not this file's: contradictions
// first (§3b — "I first concluded X; the evidence says Y" is the most valuable sentence a
// build produces), then decisions, then challenges, then reading, then gaps.
//
// ⚠ NOTHING IS SIGNALLED BY COLOUR ALONE (docs/CLAUDE.md §21). Every row carries its count
// as a number and its kind as a word; done rows carry "done" in text, not a green tick.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LexStageKey } from '@/lib/lex/stages'

interface AgendaShape {
  buildVersion: number | null
  contradictions: Array<{ id: string; status: string }>
  decisions: Array<{ forkKey: string; resolved: boolean; changedByResearch: boolean }>
  challenges: Array<{ id: string; status: string }>
  reading: Array<{ id: string; title: string }>
  gaps: Array<{ question: string; task: 'research' | 'only-you' | 'limitation' }>
}

interface PassShape {
  passKey: string
  label: string
  status: 'NOT_RUN' | 'RUNNING' | 'RUN' | 'FAILED'
}

export interface Task {
  /** Stable key, so a list that reorders does not lose React's place. */
  key: string
  /** The instruction, in the imperative. "Read the two contradictions", not "Contradictions". */
  text: string
  /** How many of this thing are waiting. Shown as a number — a count is a fact. */
  count: number
  /** Done tasks stay on the list, marked, because a list that empties itself hides what
   *  was decided. §3's shape: the worklist is a record as well as an instruction. */
  done: boolean
  /** Where the item lives on this page, so the row is a jump and not a label. */
  anchor?: string
}

/**
 * The worklist, as a pure function of the agenda — so `check:lex-25k` can assert the
 * ORDER and the wording without rendering anything or touching a database.
 *
 * ⚠ EXPORTED FOR THE CHECK, and the check is the reason it is separate from the JSX. A
 * rule about ordering that lives inside a component's return statement can only be tested
 * by scraping markup, and the first thing to rot is the ordering.
 */
export function tasksFrom(agenda: AgendaShape | null, passes: PassShape[], scope: LexStageKey): Task[] {
  if (!agenda) return []
  const out: Task[] = []

  if (scope === 'strategy') {
    const openContra = agenda.contradictions.filter((c) => c.status !== 'ACCEPTED' && c.status !== 'REJECTED')
    if (agenda.contradictions.length) {
      out.push({
        key: 'contradictions',
        // ⚠ FIRST, ALWAYS. See the header — this is 25-C §3b's ordering and it is not a
        // styling choice.
        text: openContra.length
          ? 'Read where the evidence went against the first draft'
          : 'You have been through where the evidence went against the first draft',
        count: openContra.length || agenda.contradictions.length,
        done: openContra.length === 0,
        anchor: 'agenda-contradictions',
      })
    }
    const openDecisions = agenda.decisions.filter((d) => !d.resolved)
    if (agenda.decisions.length) {
      out.push({
        key: 'decisions',
        text: openDecisions.length ? 'Make the decisions Lex could not make for you' : 'Every decision is made',
        count: openDecisions.length || agenda.decisions.length,
        done: openDecisions.length === 0,
        anchor: 'agenda-decisions',
      })
    }
    if (agenda.reading.length) {
      out.push({
        key: 'reading',
        text: 'Read the sources that most bear on this',
        count: agenda.reading.length,
        done: false,
        anchor: 'agenda-reading',
      })
    }
    // ⚠ ONLY THE GAPS THAT ARE THE USER'S TO CLOSE. A gap tagged `research` is our job and
    // a gap tagged `limitation` is nobody's; putting either on the user's list would be
    // telling them to do our work, or work that cannot be done. `agenda.ts` tags them at
    // creation precisely so nothing downstream has to guess.
    const mine = agenda.gaps.filter((g) => g.task === 'only-you')
    if (mine.length) {
      out.push({
        key: 'gaps',
        text: 'Answer the questions only you can answer',
        count: mine.length,
        done: false,
        anchor: 'agenda-gaps',
      })
    }
    return out
  }

  // ── Stage 3 — the same shape, over the deepening's own work (§4) ───────────
  const notRun = passes.filter((p) => p.status === 'NOT_RUN')
  const failed = passes.filter((p) => p.status === 'FAILED')
  const openIssues = agenda.challenges.filter((c) => c.status === 'OPEN')

  if (openIssues.length || agenda.challenges.length) {
    out.push({
      key: 'issues',
      text: openIssues.length ? 'Work through the issues the passes raised' : 'Every issue raised has been dealt with',
      count: openIssues.length || agenda.challenges.length,
      done: openIssues.length === 0,
      // ⚠ THE PANEL, NOT AN ISSUE. Issues live inside a pass the user has to open, so an
      // anchor per issue would be a link into a collapsed element — a jump that appears to
      // do nothing. The panel is where the work is; the pass rows say which one holds what.
      anchor: 'deepening-passes',
    })
  }
  if (notRun.length) {
    out.push({
      key: 'passes',
      text: 'Run the passes that have not been run yet',
      count: notRun.length,
      done: false,
      anchor: 'deepening-passes',
    })
  }
  if (failed.length) {
    out.push({
      key: 'failed',
      // A failed pass is not the same as an unrun one, and a list that merged them would
      // tell the user to "run" something that already tried and stopped.
      text: 'A pass stopped before it finished — run it again or read why',
      count: failed.length,
      done: false,
      anchor: 'deepening-passes',
    })
  }
  const research = agenda.gaps.filter((g) => g.task === 'research')
  if (research.length) {
    out.push({
      key: 'research-gaps',
      text: 'Add material, or ask for more research, on what the passes could not reach',
      count: research.length,
      done: false,
      anchor: 'deepening-passes',
    })
  }
  return out
}

export default function WorkList({
  ideaId, scope, refreshNonce = 0, onOutstanding,
}: {
  ideaId: string
  scope: LexStageKey
  /** Bumped by the parent when something on the page has changed the agenda. */
  refreshNonce?: number
  /**
   * 25-L §6 — how many tasks are still waiting, reported upward for the mobile badge.
   *
   * ⚠ FROM HERE, THE ONE PLACE THAT KNOWS. The badge and the list must never be able to
   * disagree, and they would the first time somebody changed a rule about which gaps count
   * as the user's in only one of two places.
   */
  onOutstanding?: (n: number) => void
}) {
  const [agenda, setAgenda] = useState<AgendaShape | null>(null)
  const [passes, setPasses] = useState<PassShape[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const reads: Promise<unknown>[] = [
      fetch(`/api/ideas/${ideaId}/agenda`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => setAgenda(j as AgendaShape | null))
        .catch(() => setAgenda(null)),
    ]
    // ⚠ THE SECOND READ IS STAGE 3 ONLY. The pass list is what makes "run the ones that
    // have not run" a real instruction rather than a guess, and it is the same endpoint the
    // panel beneath already polls — so the two cannot disagree. Fetching it at stage 2
    // would be a request for a number nothing on that screen shows.
    if (scope === 'deepening') {
      reads.push(
        fetch(`/api/ideas/${ideaId}/deepening`)
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => setPasses(((j as { passes?: PassShape[] } | null)?.passes ?? []) as PassShape[]))
          .catch(() => setPasses([])),
      )
    }
    await Promise.all(reads)
    setLoading(false)
  }, [ideaId, scope])

  useEffect(() => { void load() }, [load, refreshNonce])

  // ⚠ REPORTED IN AN EFFECT, NOT DURING RENDER. Calling a parent's setState while rendering
  // is a React warning and, on a parent that re-renders this child, a loop. The ref keeps
  // the callback out of the dependency array so an inline arrow from the parent cannot
  // re-fire it every render.
  const outstandingRef = useRef(onOutstanding)
  outstandingRef.current = onOutstanding

  const tasks = tasksFrom(agenda, passes, scope)
  const outstanding = tasks.filter((t) => !t.done).length

  useEffect(() => { outstandingRef.current?.(outstanding) }, [outstanding])

  // ⚠ NOT RENDERED BEFORE A BUILD HAS PRODUCED ANYTHING. An empty "what to do next" on a
  // screen where there genuinely is nothing to do would be the same broken promise as an
  // empty panel taking a third of the screen — and worse, because it is an instruction.
  if (loading) {
    return <p className="px-3 py-2 text-xs text-zinc-400">Reading what is waiting for you…</p>
  }
  if (!agenda?.buildVersion) return null

  return (
    <section aria-label="What to do next" className="border-b border-zinc-200 bg-zinc-50/60">
      <div className="px-3 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          What to do next
        </h2>

        {tasks.length === 0 ? (
          // ⚠ AN HONEST EMPTY STATE, in the house style: what it means, not just "none".
          <p className="mt-1.5 text-sm text-zinc-600">
            Nothing is waiting on you here. That is not the same as nothing left to do — going
            deeper is Stage 3, and re-running with more information is Stage 1.
          </p>
        ) : (
          <>
            <ol className="mt-1.5 space-y-1">
              {tasks.map((t, i) => {
                const row = (
                  <>
                    <span
                      aria-hidden
                      className={`mt-0.5 shrink-0 text-[11px] leading-5 ${t.done ? 'text-zinc-400' : 'text-zinc-500'}`}
                    >
                      {/* Filled when there is work in it, hollow when it is done. Two
                          different characters — never one character recoloured (§21). */}
                      {t.done ? '○' : '●'}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`text-sm ${t.done ? 'text-zinc-400' : 'text-zinc-800'}`}>
                        {t.text}
                      </span>{' '}
                      <span className="text-xs text-zinc-500 whitespace-nowrap">
                        ({t.count}{t.done ? ', done' : ''})
                      </span>
                    </span>
                  </>
                )
                return (
                  <li key={t.key}>
                    {t.anchor ? (
                      <a
                        href={`#${t.anchor}`}
                        className="flex gap-2 rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-white"
                      >
                        {row}
                        <span aria-hidden className="text-zinc-300 text-xs leading-5">↓</span>
                      </a>
                    ) : (
                      <div className="flex gap-2 px-1.5 py-1 -mx-1.5">{row}</div>
                    )}
                    {i === 0 && !t.done && (
                      // §3: "the list tells them, in order." Saying which one is first is
                      // what turns a list into an instruction.
                      <p className="pl-6 text-[11px] text-zinc-500">Start here.</p>
                    )}
                  </li>
                )
              })}
            </ol>
            <p className="mt-1.5 text-[11px] text-zinc-500">
              {outstanding === 0
                ? 'Everything on this list has been dealt with.'
                : `${outstanding} of ${tasks.length} still waiting on you.`}
            </p>
          </>
        )}
      </div>
    </section>
  )
}
