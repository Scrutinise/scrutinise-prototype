// SPRINT 25-N §3e — THE WORKLIST'S FOUR PARTS, AND WHAT THIS USER HAS TICKED OFF.
//
// GET   → the four parts, assembled, with every item's ticked state for this user.
// PATCH → tick or untick one item.
//
// ⚠⚠ IT ASSEMBLES; IT DOES NOT GENERATE. Every item here is already a row — the agenda's
// reading list and decisions, the panel's findings, the idea's own stage. That is the same
// contract 25-K's worklist kept and the same reason it can be fetched on every load: a pure
// read, no model call.
//
// ⚠ THE TICKS ARE PER USER, the items are per idea, and the two must not be conflated. Two
// collaborators reading the same evidence have read different halves of it; a tick stored on
// the idea would tell the second one they had already read what the first one read.
//
// ⚠ AND PART 3 AND PART 4 ARE NOT MEASUREMENTS. "Put it out for scrutiny" and "Promote it" are
// things the user DOES, elsewhere; what this route knows is whether they have said they have
// done them. They are ticks against an action, not a derived state, and the difference matters:
// deriving "invited a team" from the collaborator table would silently untick itself the day
// somebody left.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorizeIdea } from '@/lib/lex/authz'
import { buildAgenda } from '@/lib/lex/agenda'
import { buildQuestionPanel } from '@/lib/lex/question-panel'

type Params = { params: Promise<{ id: string }> }

export interface WorklistItem {
  /** Stable identity — see the schema note. `read:<id>`, `decision:<forkKey>`, … */
  key: string
  text: string
  /** Where this item lives on the page, so a row is a jump and not a label. */
  anchor: string | null
  /** An outward action rather than something to read — rendered as a link, not a tick. */
  href: string | null
  ticked: boolean
}

export interface WorklistPart {
  key: 'read' | 'decide' | 'scrutiny' | 'promote'
  title: string
  /** One line under the title, in Charlie's words where §3e gives them. */
  blurb: string | null
  items: WorklistItem[]
}

/**
 * §3e's four parts, in §3e's order.
 *
 * ⚠ THE ORDER IS THE DESIGN AND IT IS DATA, the same reasoning as `AGENDA_SECTIONS` and
 * `QUESTION_HEADINGS`. It runs from what you do alone, to what you decide, to what you open
 * up, to what you campaign on — and a check can assert it without rendering anything.
 */
export const WORKLIST_PARTS: Array<{ key: WorklistPart['key']; title: string; blurb: string | null }> = [
  { key: 'read', title: 'Things to read', blurb: 'Everything from the research and the strategy. Tick each one as you read it.' },
  {
    key: 'decide',
    title: 'Decisions to make',
    blurb: 'The choices Lex could not make for you — starting with approving the drafts it has written.',
  },
  {
    key: 'scrutiny',
    title: 'Put it out for scrutiny',
    // §3e, verbatim.
    blurb: 'Find friends and experts willing to read this and ask hard questions to help you make '
      + 'your proposal more credible and authoritative.',
  },
  {
    key: 'promote',
    title: 'Promote it',
    // §3e, verbatim.
    blurb: 'Build support for your idea from the public and parliamentarians.',
  },
]

async function assemble(ideaId: string, userId: string): Promise<{ parts: WorklistPart[] }> {
  const [agenda, panel, ticks] = await Promise.all([
    buildAgenda(ideaId),
    buildQuestionPanel(ideaId),
    prisma.ideaWorklistTick.findMany({ where: { ideaId, userId }, select: { itemKey: true } }),
  ])
  const ticked = new Set(ticks.map((t) => t.itemKey))
  const on = (key: string) => ticked.has(key)

  // ── 1. Things to read ────────────────────────────────────────────────────
  //
  // ⚠ §3e SAYS "EVERYTHING FROM THE RESEARCH AND THE STRATEGY", which is both halves: the
  // agenda's short reading list (what Lex says matters most) AND the findings the user has put
  // in their report (what THEY said matters). The two are de-duplicated by id — the same
  // source appearing twice under one heading is a list nobody finishes.
  const readItems = new Map<string, WorklistItem>()

  // ══════════ 25-R ADDENDUM A2 — THE FIRST THING A BUILD SAYS FOR ITSELF ══════════
  //
  // A1 keeps the kernel sections collapsed and tidy after a build, so **the worklist is the
  // entry point, not an open panel**. This is that entry point, and it is first on purpose:
  // it is what tells a user that a ten-minute build produced something, and where to start.
  //
  // ⚠ CHARLIE'S OWN WORDING, VERBATIM (A2). It is a question rather than an instruction because
  // the answer is the user's: "are you happy with" is the thing they are being asked to decide,
  // and "Approve Lex's drafts" — which is what the decisions list says — is what they do after
  // they have read it.
  //
  // ⚠⚠ ONLY ONCE A BUILD HAS FINISHED. Before that there is no diagnosis to read, and an item
  // asking somebody to read something that does not exist is the "control that does nothing"
  // this repository keeps finding. `agenda.buildVersion` is null until a build has produced one.
  if (agenda.buildVersion != null) {
    readItems.set('__diagnosis', {
      key: 'read:diagnosis',
      text: 'Read the diagnosis I’ve prepared — are you happy with both the description of the '
        + 'problem and the accuracy of the causes?',
      anchor: 'agenda-reading',
      href: null,
      ticked: on('read:diagnosis'),
    })
  }

  for (const r of agenda.reading) {
    readItems.set(r.id, {
      key: `read:${r.id}`,
      text: r.title,
      anchor: 'agenda-reading',
      href: r.url ?? null,
      ticked: on(`read:${r.id}`),
    })
  }
  for (const h of panel.headings) {
    for (const e of h.entries) {
      // ⚠ ONLY WHAT THE USER PUT IN THE REPORT. Every finding on the idea would be a list of
      // several hundred, which is not a worklist — it is the library, with tick boxes.
      if (!e.priority || e.excluded || readItems.has(e.id)) continue
      readItems.set(e.id, {
        key: `read:${e.id}`,
        text: e.title,
        anchor: null,
        href: e.url ?? null,
        ticked: on(`read:${e.id}`),
      })
    }
  }

  // ── 2. Decisions to make ─────────────────────────────────────────────────
  //
  // ⚠ THE FIRST ONE IS APPROVING THE DRAFTS, and §3e names it explicitly. It is not a fork —
  // it is the thing a user has to do before any of the forks mean anything, and it had never
  // appeared on any list as a task.
  const decideItems: WorklistItem[] = [{
    key: 'decision:approve-drafts',
    text: 'Approve Lex’s drafts — the diagnosis first, then the rest',
    anchor: null,
    href: null,
    ticked: on('decision:approve-drafts'),
  }]
  for (const d of agenda.decisions) {
    decideItems.push({
      key: `decision:${d.forkKey}`,
      text: d.chosen,
      anchor: 'agenda-decisions',
      href: null,
      // ⚠ A RESOLVED FORK IS TICKED WHETHER OR NOT ANYBODY PRESSED THE BOX. The decision IS
      // the tick; asking the user to record it twice is asking them to do our bookkeeping.
      ticked: d.resolved || on(`decision:${d.forkKey}`),
    })
  }

  return {
    parts: WORKLIST_PARTS.map((p) => ({
      ...p,
      items:
        p.key === 'read' ? [...readItems.values()]
        : p.key === 'decide' ? decideItems
        : p.key === 'scrutiny' ? [
            {
              key: 'scrutiny:private-team',
              text: 'Invite your own private team',
              anchor: null,
              href: `/ideas/${ideaId}?tab=collaborators`,
              ticked: on('scrutiny:private-team'),
            },
            {
              key: 'scrutiny:public',
              text: 'Make it public and invite wider scrutiny',
              anchor: null,
              href: `/ideas/${ideaId}/publish`,
              ticked: on('scrutiny:public'),
            },
          ]
        : [
            {
              key: 'promote:share',
              text: 'Share it with the public',
              anchor: null,
              href: `/ideas/${ideaId}`,
              ticked: on('promote:share'),
            },
            {
              key: 'promote:parliamentarians',
              text: 'Take it to parliamentarians',
              anchor: null,
              href: `/ideas/${ideaId}`,
              ticked: on('promote:parliamentarians'),
            },
          ],
    })),
  }
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  return NextResponse.json(await assemble(id, authz.user.id))
}

const TickSchema = z.object({
  itemKey: z.string().min(1).max(200),
  ticked: z.boolean(),
})

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  let body: unknown = {}
  try { body = await req.json() } catch { /* falls to the 422 */ }
  const parsed = TickSchema.safeParse(body ?? {})
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  const { itemKey, ticked } = parsed.data
  if (ticked) {
    // ⚠ UPSERT, NOT CREATE. Ticking is a toggle a user will double-press, and the unique index
    // is what makes the second press a no-op rather than a 500.
    await prisma.ideaWorklistTick.upsert({
      where: { ideaId_userId_itemKey: { ideaId: id, userId: authz.user.id, itemKey } },
      create: { ideaId: id, userId: authz.user.id, itemKey },
      update: {},
    })
  } else {
    await prisma.ideaWorklistTick.deleteMany({ where: { ideaId: id, userId: authz.user.id, itemKey } })
  }

  return NextResponse.json(await assemble(id, authz.user.id))
}
