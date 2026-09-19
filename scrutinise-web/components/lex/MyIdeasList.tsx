'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 25-J §2 — MY IDEAS: the list a user recognises their own work in.
//
// This replaces `RecentIdeasPanel`, whose own header said it should be deleted "the moment
// a real 'my ideas' surface exists". §2 is that surface. Three things changed, and each was
// a real defect in the stopgap:
//
//   1. ⚠ IT WAS BEHIND A `<details>`. A list of your own work is not a disclosure; it is
//      the reason you came to the page. It is open, and it is on the page.
//   2. ⚠ IT SHOWED NO TITLE AT ALL. The stopgap carried `title` on its type and deliberately
//      never displayed it, because 11 of 11 ideas were called "Untitled idea" and a title
//      list would have rendered eleven identical rows. That was the right call for a
//      stopgap and the wrong shape for a hub: §2 asks for "title, stage, when it was last
//      worked on", and ⚠ "NOT ELEVEN ROWS CALLED 'Untitled idea' — where a title has not
//      been generated, identify it by the user's own opening words."  So a real title is
//      shown when there is one, and the user's own words stand in when there is not —
//      LABELLED as their words, never dressed up as a title we generated.
//   3. It showed neither stage nor a build's progress in the five-stage vocabulary.
//
// ⚠ A SEPARATE PURE COMPONENT, for 25-E's reason: `BuildIdeaClient` pulls in `PublicNav`,
// which calls `useUser()` and throws outside a `<ClerkProvider>`, so anything written
// inside it is markup no check can ever render. This takes its props and returns markup.
// ─────────────────────────────────────────────────────────────────────────────

/** The five-stage vocabulary. docs/CLAUDE.md §4: use exactly, never substitute. */
const STAGE_LABEL: Record<string, string> = {
  STAGE_1: 'Create',
  STAGE_2: 'Draft',
  STAGE_3: 'Develop',
  STAGE_4: 'Campaign',
  STAGE_5: 'Legislate',
}

export interface MyIdea {
  ideaId: string
  /** The stored title. "Untitled idea" until the user accepts one Lex proposed. */
  title: string
  /** The user's own opening words, truncated. Used when there is no real title. */
  excerpt: string
  stage: string
  elicitationStatus: 'IN_PROGRESS' | 'AWAITING_CONFIRMATION' | 'CONFIRMED'
  buildStatus: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED' | null
  passesComplete: number | null
  updatedAt: string
  /** 26-C §7b — the owner's own archive (`Idea.ownerArchivedAt`), never the admin's. */
  archived: boolean
}

/**
 * ⚠ THE PLACEHOLDER TITLE IS A KNOWN STRING, MATCHED EXACTLY.
 *
 * Every idea starts as "Untitled idea" (`BuildIdeaClient` posts it). Testing for a real
 * title by length, or by "does it look generated", would misfire the day someone genuinely
 * names an idea "Untitled" — and would do it silently.
 */
export const PLACEHOLDER_TITLE = 'Untitled idea'

export function hasRealTitle(title: string): boolean {
  return !!title.trim() && title.trim() !== PLACEHOLDER_TITLE
}

/** What a build is doing, in words, or null when none has been started. */
function buildLine(i: MyIdea): string | null {
  if (!i.buildStatus) return null
  if (i.buildStatus === 'RUNNING' || i.buildStatus === 'QUEUED') {
    return i.passesComplete ? `building — ${i.passesComplete} passes done` : 'building'
  }
  if (i.buildStatus === 'DONE') return 'built'
  if (i.buildStatus === 'FAILED') return 'the build stopped'
  return 'the build was cancelled'
}

/** Where this idea should open. A built idea opens on the proposal (25-G §2). */
export function hrefFor(i: MyIdea): string {
  return i.buildStatus === 'DONE'
    ? `/ideas/create?ideaId=${i.ideaId}`
    : `/ideas/build?ideaId=${i.ideaId}`
}

import { useState } from 'react'
import DeleteIdeaDialog from './DeleteIdeaDialog'

/**
 * 26-C §7b — archive and delete, and they look different.
 *
 * ⚠ ARCHIVE IS ONE CLICK AND REVERSIBLE (the PATCH just flips `ownerArchivedAt`), so it
 * carries no confirmation dialogue. DELETE names the idea and asks once — `DeleteIdeaDialog`,
 * unchanged. Colour is never the only cue (CLAUDE.md §21): archive is an outline glyph,
 * delete is a filled one in a different shape, and both carry a word.
 */
function CardControls({
  idea, onArchived, onDeleted,
}: {
  idea: MyIdea
  onArchived: (ideaId: string, archived: boolean) => void
  onDeleted: (ideaId: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function toggleArchive(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    setBusy(true)
    try {
      const res = await fetch(`/api/ideas/${idea.ideaId}/owner-archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !idea.archived }),
      })
      if (res.ok) onArchived(idea.ideaId, !idea.archived)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={toggleArchive}
        disabled={busy}
        title={idea.archived ? 'Unarchive — bring this back onto the list' : 'Archive — hide this without deleting it'}
        className="text-xs font-medium px-2 py-1 rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 inline-flex items-center gap-1"
      >
        {/* A hollow box for "put away", filled once archived — shape and weight, not colour. */}
        <span aria-hidden>{idea.archived ? '▣' : '▢'}</span>
        {idea.archived ? 'Unarchive' : 'Archive'}
      </button>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(true) }}
        title="Delete — removes it, and asks first"
        className="text-xs font-medium px-2 py-1 rounded-full border-2 border-red-200 text-red-700 hover:bg-red-50 inline-flex items-center gap-1"
      >
        <span aria-hidden>✕</span>
        Delete
      </button>
      {confirmDelete && (
        <DeleteIdeaDialog
          ideaId={idea.ideaId}
          title={idea.title}
          onCancel={() => setConfirmDelete(false)}
          onDeleted={() => { setConfirmDelete(false); onDeleted(idea.ideaId) }}
        />
      )}
    </div>
  )
}

function IdeaRow({ i, onArchived, onDeleted }: {
  i: MyIdea
  onArchived: (ideaId: string, archived: boolean) => void
  onDeleted: (ideaId: string) => void
}) {
  const titled = hasRealTitle(i.title)
  const build = buildLine(i)
  return (
    <li>
      <a href={hrefFor(i)} className="flex items-start gap-2 px-4 py-3 hover:bg-zinc-50 transition-colors">
        <div className="min-w-0 flex-1">
          {/* ⚠ THE TITLE, OR THE USER'S OWN WORDS — AND THE DIFFERENCE IS VISIBLE.
              An excerpt rendered in the title's styling would be us presenting their
              half-finished sentence as a name we chose for them. */}
          {titled ? (
            <p className="text-sm font-medium text-zinc-900 leading-snug truncate">{i.title}</p>
          ) : i.excerpt ? (
            <p className="text-sm text-zinc-800 leading-snug">
              <span className="text-zinc-400">In your words: </span>
              {i.excerpt}
            </p>
          ) : (
            <p className="text-sm text-zinc-400 leading-snug italic">Untitled idea — nothing written yet</p>
          )}
          <p className="mt-1 text-[11px] text-zinc-500">
            {STAGE_LABEL[i.stage] ?? i.stage}
            {build ? ` · ${build}` : ''}
            {' · last worked on '}
            {/* Fixed locale, not the viewer's — a timestamp that renders differently
                per machine is one you cannot quote back to anyone. */}
            {new Date(i.updatedAt).toLocaleString('en-GB', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              timeZone: 'UTC',
            })} UTC
          </p>
        </div>
        <CardControls idea={i} onArchived={onArchived} onDeleted={onDeleted} />
      </a>
    </li>
  )
}

export default function MyIdeasList(
  { ideas, hiddenEmpty }: { ideas: MyIdea[]; hiddenEmpty: number },
) {
  const [rows, setRows] = useState(ideas)
  const [showArchived, setShowArchived] = useState(false)

  if (rows.length === 0) return null

  const active = rows.filter((r) => !r.archived)
  const archived = rows.filter((r) => r.archived)

  const onArchived = (ideaId: string, archivedNow: boolean) =>
    setRows((rs) => rs.map((r) => (r.ideaId === ideaId ? { ...r, archived: archivedNow } : r)))
  const onDeleted = (ideaId: string) => setRows((rs) => rs.filter((r) => r.ideaId !== ideaId))

  const shown = showArchived ? archived : active

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-700">
          My ideas ({active.length})
        </h2>
        {archived.length > 0 && (
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-800 underline"
          >
            {showArchived ? 'Back to active ideas' : `${archived.length} archived`}
          </button>
        )}
      </div>
      {/* §7a — every idea is listed; a long list scrolls within its column rather than
          being paged or truncated. */}
      <ul className="rounded-xl border border-zinc-200 divide-y divide-zinc-200 bg-white max-h-[70vh] overflow-y-auto">
        {shown.map((i) => <IdeaRow key={i.ideaId} i={i} onArchived={onArchived} onDeleted={onDeleted} />)}
      </ul>
      {hiddenEmpty > 0 && (
        <p className="mt-2 text-[11px] text-zinc-500">
          {hiddenEmpty} empty {hiddenEmpty === 1 ? 'idea is' : 'ideas are'} hidden — nothing was
          written in {hiddenEmpty === 1 ? 'it' : 'them'}.
        </p>
      )}
    </section>
  )
}
