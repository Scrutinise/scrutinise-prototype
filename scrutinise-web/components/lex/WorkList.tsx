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
//
// ══ 25-N §3e — FOUR PARTS, EACH A CHECKBOX LIST, HIDDEN UNTIL CLICKED ═══════════════
//
// §3e: **Things to read · Decisions to make · Put it out for scrutiny · Promote it**, in that
// order. What was here was five one-line SUMMARIES — "Read the sources that most bear on this
// (7)" — which tell a user how much is waiting and nothing about what it is. §3e turns each
// into the list itself, so the row you tick is the thing you did.
//
// ⚠⚠ AND THE LAST TWO PARTS ARE NOT DERIVED FROM ANYTHING. "Put it out for scrutiny" and
// "Promote it" are things the user does elsewhere, and this list records that they have. They
// were absent entirely: the worklist ended at the research, so a user who had finished the
// research was told "nothing is waiting on you" while three quarters of the actual job — get
// it read, get it argued with, get it supported — had not been named once.
//
// ⚠⚠ EVERY ITEM IS A REAL CONTROL, ON EVERY SCREEN SIZE. §3e: *"The items must be clickable.
// On mobile they currently are not."* The old rows were `<a href="#anchor">` — an in-page jump
// to an element that, on a phone, is inside a TAB THAT IS NOT ON SCREEN, so the link resolved
// to nothing and the row did nothing. A tick box works on a phone because it acts on the row
// itself, and where an item really is elsewhere it is a link to a route, not to a fragment.
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

/** 25-N §3e — one part of the four, as the route assembles it. */
interface Part {
  key: 'read' | 'decide' | 'scrutiny' | 'promote'
  title: string
  blurb: string | null
  items: Array<{ key: string; text: string; anchor: string | null; href: string | null; ticked: boolean }>
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
  const [parts, setParts] = useState<Part[]>([])
  const [loading, setLoading] = useState(true)
  /**
   * 25-N §3e — which part is open. `null` is the home state.
   *
   * ⚠ ALL FOUR CLOSED BY DEFAULT, and that is §3e's *"hidden until clicked"*. Four expanded
   * lists in a pane that also holds the chat is the scroll 25-L §3a removed from the research
   * panel, rebuilt in the working area.
   */
  const [openPart, setOpenPart] = useState<Part['key'] | null>(null)
  const [busy, setBusy] = useState(false)

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
    // 25-N §3e — the four parts. Stage 2 only: the Deepening's worklist is its own passes
    // and issues, and "put it out for scrutiny" is not a thing you do to a pass.
    if (scope === 'strategy') {
      reads.push(
        fetch(`/api/ideas/${ideaId}/worklist`)
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => setParts(((j as { parts?: Part[] } | null)?.parts ?? []) as Part[]))
          .catch(() => setParts([])),
      )
    }
    await Promise.all(reads)
    setLoading(false)
  }, [ideaId, scope])

  /** §3e — tick or untick one item. Optimistic, then reconciled with the server's answer. */
  const tick = useCallback(async (itemKey: string, ticked: boolean) => {
    setParts((cur) => cur.map((p) => ({
      ...p,
      items: p.items.map((i) => (i.key === itemKey ? { ...i, ticked } : i)),
    })))
    setBusy(true)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/worklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKey, ticked }),
      })
      // ⚠ THE SERVER'S ANSWER WINS. A resolved fork is ticked whether or not anybody pressed
      // the box (see the route), so the optimistic state is a guess and the reconciliation is
      // where "I decided this an hour ago" shows up.
      if (res.ok) setParts(((await res.json()).parts ?? []) as Part[])
    } finally { setBusy(false) }
  }, [ideaId])

  useEffect(() => { void load() }, [load, refreshNonce])

  // ⚠ REPORTED IN AN EFFECT, NOT DURING RENDER. Calling a parent's setState while rendering
  // is a React warning and, on a parent that re-renders this child, a loop. The ref keeps
  // the callback out of the dependency array so an inline arrow from the parent cannot
  // re-fire it every render.
  const outstandingRef = useRef(onOutstanding)
  outstandingRef.current = onOutstanding

  const tasks = tasksFrom(agenda, passes, scope)
  // ⚠ 25-N §3e — THE BADGE COUNTS WHAT IS ON SCREEN. At Stage 2 the list IS the four parts,
  // so counting `tasks` there would put a number on the mobile tab that no visible row
  // explains — the "one place that knows" rule (25-L §6) is about the two agreeing, and after
  // §3e the thing they have to agree about changed.
  const outstanding = scope === 'strategy' && parts.length
    ? parts.reduce((n, p) => n + p.items.filter((i) => !i.ticked).length, 0)
    : tasks.filter((t) => !t.done).length

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
        {/* ══ 25-N §3d — THE PANEL TEXT, VERBATIM ═══════════════════════════════
            §3d gives this its exact wording. It is the sentence that says what this column is
            FOR, which is the question a user asks of a list of instructions before they follow
            any of them. */}
        {/* ⚠ 25-Z §3 — Charlie's wording, verbatim. */}
        <p className="mt-1 text-[11px] text-zinc-600 leading-snug">
          Here are your decisions and actions:
        </p>

        {/* ══ 25-N §3e — THE FOUR PARTS, HIDDEN UNTIL CLICKED ═══════════════════
            ⚠ SHOWN AT STAGE 2 ONLY. At Stage 3 the work IS the passes and the issues they
            raise, and "put it out for scrutiny" is not something you do to a pass — so the
            Deepening keeps the summary list below, which is written against exactly that. */}
        {scope === 'strategy' && parts.length > 0 && (
          <ul className="mt-2 space-y-1">
            {parts.map((part) => {
              const open = openPart === part.key
              const done = part.items.filter((i) => i.ticked).length
              return (
                <li key={part.key} className="rounded-lg border border-zinc-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setOpenPart(open ? null : part.key)}
                    aria-expanded={open}
                    className="w-full flex items-baseline gap-2 px-2.5 py-2 text-left rounded-lg hover:bg-zinc-50"
                  >
                    <span className="text-sm font-medium text-zinc-800 flex-1">{part.title}</span>
                    {/* ⚠ A COUNT AND A WORD, never a coloured dot (docs/CLAUDE.md §21). */}
                    <span className="text-[11px] text-zinc-500 whitespace-nowrap">
                      {part.items.length === 0
                        ? 'nothing here yet'
                        : `${done} of ${part.items.length} done`}
                    </span>
                    <span className="text-[11px] text-zinc-400 whitespace-nowrap">
                      {open ? 'hide −' : 'show +'}
                    </span>
                  </button>

                  {open && (
                    <div className="px-2.5 pb-2.5 border-t border-zinc-100 pt-2">
                      {part.blurb && (
                        <p className="text-[11px] text-zinc-600 leading-snug mb-2">{part.blurb}</p>
                      )}
                      {part.items.length === 0 ? (
                        <p className="text-[11px] text-zinc-500">
                          Nothing is on this list yet. That is not the same as nothing to do here —
                          it is what has not been produced yet.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {part.items.map((item) => (
                            <li key={item.key} className="flex items-start gap-2">
                              {/* ⚠⚠ §3e — A REAL CHECKBOX, AND IT WORKS ON A PHONE. The old
                                  rows were in-page `#anchor` links, and on mobile the anchor
                                  is inside a TAB THAT IS NOT ON SCREEN — so the row did
                                  nothing at all. A tick acts on the row itself. */}
                              <input
                                type="checkbox"
                                checked={item.ticked}
                                disabled={busy}
                                onChange={(e) => void tick(item.key, e.target.checked)}
                                aria-label={`Mark “${item.text}” as done`}
                                className="mt-0.5 shrink-0 w-4 h-4 rounded border-zinc-400 accent-zinc-900"
                              />
                              <span className="flex-1 min-w-0">
                                {/* ⚠ A LINK TO A ROUTE, NEVER TO A FRAGMENT. See the header:
                                    a fragment link is the thing that silently does nothing on
                                    a phone. Where an item genuinely lives elsewhere it is a
                                    real navigation; where it lives on this page it is text. */}
                                {item.href ? (
                                  <a
                                    href={item.href}
                                    target={item.href.startsWith('http') ? '_blank' : undefined}
                                    rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                                    className={`text-sm hover:underline ${item.ticked ? 'text-zinc-400' : 'text-blue-700'}`}
                                  >
                                    {item.text}
                                  </a>
                                ) : (
                                  <span className={`text-sm ${item.ticked ? 'text-zinc-400' : 'text-zinc-800'}`}>
                                    {item.text}
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {/* ══ THE DEEPENING'S OWN WORKLIST ══════════════════════════════════════
            25-K §3's summary rows, unchanged, and they are the right shape for Stage 3: the
            work there is running passes and clearing the issues they raise, which is a set of
            counts rather than a set of things to tick off one by one. */}
        {scope !== 'strategy' && (
          tasks.length === 0 ? (
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
          )
        )}
      </div>
    </section>
  )
}
