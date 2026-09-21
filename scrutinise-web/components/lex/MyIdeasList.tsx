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
  /** 26-C addendum §20 — `Idea.deletedAt` is set. Arrives as its own list (`deletedIdeas`
   *  prop), never mixed into `ideas`, so this is really "which list is this row from",
   *  kept on the row because `IdeaRow` renders deleted rows differently (no link, Restore
   *  instead of Delete/Unarchive). */
  deleted: boolean
  /** 26-D §1/§2 — `Idea.ownerOrderIndex`. Null means never explicitly dragged; such rows
   *  sort after every explicitly-ordered one, by `updatedAt`, exactly as before §2 shipped. */
  orderIndex: number | null
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

/**
 * ⚠⚠ 26-C ADDENDUM 3 §23c — A CARD ALWAYS OPENS THE IDEA OVERVIEW NOW, never the
 * workspace or the conversation directly. §23's five-page model gives every idea one
 * summary page; from there, "Edit" (on the overview) is what decides between the
 * three-panel workspace and the New idea screen (§23d), on whether a build exists —
 * see the Edit link in `IdeaDetailClient.tsx`. Superseded: the old rule here
 * (`buildStatus === 'DONE'` → `/ideas/create`, else → `/ideas/build`) IS that same
 * decision, just made one page too early, which is what let an unbuilt idea's card
 * reach the three-panel workspace at all before §4 existed to catch it.
 */
export function hrefFor(i: MyIdea): string {
  return `/ideas/${i.ideaId}`
}

import { useCallback, useRef, useState } from 'react'
import DeleteIdeaDialog from './DeleteIdeaDialog'

/**
 * 26-C addendum §18b — ARCHIVE (THE ACTION) IS REMOVED. Grouping (§19) replaces it as
 * the way to hide ideas — a group can be shown or hidden, which is what archiving used
 * to be for. §18a's condition is kept: anything ALREADY archived stays reachable via the
 * "N archived" toggle and can still be brought back with Unarchive — nothing already
 * hidden becomes unreachable by removing the button that would have hidden something new.
 */
function CardControls({
  idea, onUnarchived, onDeleted, onRestored,
}: {
  idea: MyIdea
  onUnarchived: (ideaId: string) => void
  onDeleted: (ideaId: string) => void
  onRestored: (ideaId: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function unarchive() {
    setBusy(true)
    try {
      const res = await fetch(`/api/ideas/${idea.ideaId}/owner-archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      })
      if (res.ok) onUnarchived(idea.ideaId)
    } finally {
      setBusy(false)
    }
  }

  // 26-C addendum §20 — a deleted row's only control is Restore. Delete has already
  // happened; offering it again, or Unarchive (a state a deleted idea cannot usefully
  // hold), would be controls that do nothing or mean something confusing.
  if (idea.deleted) {
    async function restore() {
      setBusy(true)
      try {
        const res = await fetch(`/api/ideas/${idea.ideaId}/restore`, { method: 'PATCH' })
        if (res.ok) onRestored(idea.ideaId)
      } finally {
        setBusy(false)
      }
    }
    return (
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
        <button
          type="button"
          onClick={() => void restore()}
          disabled={busy}
          title="Restore — bring this back onto the active list"
          className="text-xs font-medium px-2 py-1 rounded-full border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 inline-flex items-center gap-1"
        >
          <span aria-hidden>↺</span>
          Restore
        </button>
      </div>
    )
  }

  return (
    // §13b — stacks above the text on a narrow column, sits beside it on a wide one.
    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
      {idea.archived && (
        <button
          type="button"
          onClick={() => void unarchive()}
          disabled={busy}
          title="Unarchive — bring this back onto the active list"
          className="text-xs font-medium px-2 py-1 rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 inline-flex items-center gap-1"
        >
          <span aria-hidden>▣</span>
          Unarchive
        </button>
      )}
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
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

/**
 * 26-D §2 — the drag handle. Pointer events, not native HTML5 drag-and-drop: §2b asked
 * how this behaves on a touch screen (Charlie walks the product on an iPad), and native
 * `draggable` fires no events at all on touch without a polyfill — pointer events are
 * the same mechanism `PanelDivider.tsx` already uses for exactly this reason, and behave
 * identically for a mouse and a finger.
 */
function DragHandle({
  disabled, onPointerDownDrag, onNudge,
}: {
  disabled: boolean
  onPointerDownDrag: (e: React.PointerEvent) => void
  /** Keyboard alternative to dragging — a discrete move, one position at a time. */
  onNudge: (dir: -1 | 1) => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={onPointerDownDrag}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') { e.preventDefault(); onNudge(-1) }
        if (e.key === 'ArrowDown') { e.preventDefault(); onNudge(1) }
      }}
      title="Drag to reorder — or use the arrow keys"
      aria-label="Reorder this idea"
      // touch-action: none stops the browser treating a drag on this handle as a page
      // scroll gesture, which is what makes it usable with a thumb, not only a mouse.
      className="shrink-0 cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed touch-none px-1 -mx-1"
      style={{ touchAction: 'none' }}
    >
      <span aria-hidden className="text-base leading-none tracking-tighter">⠿</span>
    </button>
  )
}

function IdeaRow({ i, onUnarchived, onDeleted, onRestored, onPointerDownDrag, onNudge, dragging }: {
  i: MyIdea
  onUnarchived: (ideaId: string) => void
  onDeleted: (ideaId: string) => void
  onRestored: (ideaId: string) => void
  /** Undefined in the archived/deleted views — reordering only applies to the active list. */
  onPointerDownDrag?: (e: React.PointerEvent) => void
  onNudge?: (dir: -1 | 1) => void
  dragging?: boolean
}) {
  const titled = hasRealTitle(i.title)
  const build = buildLine(i)
  const text = (
    <>
      {/* ⚠ THE TITLE, OR THE USER'S OWN WORDS — AND THE DIFFERENCE IS VISIBLE.
          An excerpt rendered in the title's styling would be us presenting their
          half-finished sentence as a name we chose for them. */}
      {titled ? (
        <p className="text-sm font-medium text-zinc-900 leading-snug">{i.title}</p>
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
    </>
  )
  return (
    // ══ 26-C ADDENDUM §17/§21 — CONTROLS ARE A SIBLING OF THE LINK, NEVER A DESCENDANT.
    //
    // ⚠⚠ THE MECHANISM BEHIND BOTH REPORTS, DIAGNOSED TOGETHER AS ASKED (§21a). They were
    // one bug: `DeleteIdeaDialog`'s own "Delete" button lived INSIDE this `<a href>` (via
    // `CardControls`). `stopPropagation()` on an ancestor does not stop an anchor's
    // DEFAULT ACTION — only `preventDefault()` does, and `DeleteIdeaDialog` (built for a
    // page with no enclosing link) never calls it. So the delete API call succeeded —
    // confirmed live: two shells on Charlie's account show `deletedAt` set at 04:45/04:51
    // on 20 Sep — and the SAME click's native default action then navigated the browser
    // to that now-deleted idea's own href anyway. Landing on a deleted idea finds nothing
    // to open and falls back to a blank screen: "the layout springs back to default."
    // §17's "resets" and §21's "doesn't open" are the identical shape — an anchor with an
    // interactive dialog nested inside it — just observed on two different buttons.
    // The fix is structural, not a `preventDefault()` patched onto someone else's dialog:
    // the link and the controls are now SIBLINGS in one flex row, so nothing interactive
    // is ever a descendant of the `<a>` again, in this file or the next one added to it.
    <li
      data-idea-id={i.ideaId}
      className={`px-4 py-3 hover:bg-zinc-50 transition-colors ${dragging ? 'opacity-40' : ''}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        {/* 26-D §2 — the drag handle, first in the row, on every width. Absent in the
            archived/deleted views (`onPointerDownDrag` undefined there) — reordering
            only applies to the active list. */}
        <div className="order-0 flex items-start pt-0.5 sm:pt-1">
          {onPointerDownDrag && onNudge && (
            <DragHandle disabled={false} onPointerDownDrag={onPointerDownDrag} onNudge={onNudge} />
          )}
        </div>
        {/* §13b — the controls first, on their own line, when the column is narrow. */}
        <div className="order-1 sm:order-2 flex justify-end sm:justify-start">
          <CardControls idea={i} onUnarchived={onUnarchived} onDeleted={onDeleted} onRestored={onRestored} />
        </div>
        {/* §13a — the text takes the FULL width of the card, not squeezed beside the
            controls at every width. A deleted idea has nowhere to open (§20: it is not
            on this door's active list until restored), so it is plain text, not a link. */}
        {i.deleted ? (
          <div className="order-2 sm:order-1 min-w-0 flex-1 opacity-70">{text}</div>
        ) : (
          <a href={hrefFor(i)} className="order-2 sm:order-1 min-w-0 flex-1 block">{text}</a>
        )}
      </div>
    </li>
  )
}

type View = 'active' | 'archived' | 'deleted'

export default function MyIdeasList(
  { ideas, deletedIdeas = [], hiddenEmpty }: { ideas: MyIdea[]; deletedIdeas?: MyIdea[]; hiddenEmpty: number },
) {
  const [rows, setRows] = useState(ideas)
  // 26-C addendum §20 — a separate list, never mixed with `rows`: deleted ideas come
  // from their own query (page.tsx) and only ever move OUT of this list (on Restore).
  const [trash, setTrash] = useState(deletedIdeas)
  // §18a — anything archived BEFORE §18b removed the Archive action stays reachable here.
  const [view, setView] = useState<View>('active')
  // 26-D §2 — which row (if any) is being dragged, for the opacity cue on that row.
  const [draggingId, setDraggingId] = useState<string | null>(null)
  // The active order as it stands DURING a drag, kept outside React state so the
  // pointermove handler's reads/writes stay synchronous and a fetch is never called
  // from inside a setState updater (updaters must stay pure — React may invoke one
  // more than once).
  const liveOrderRef = useRef<string[]>([])

  if (rows.length === 0 && trash.length === 0) return null

  const active = rows.filter((r) => !r.archived)
  const archived = rows.filter((r) => r.archived)

  const onUnarchived = (ideaId: string) =>
    setRows((rs) => rs.map((r) => (r.ideaId === ideaId ? { ...r, archived: false } : r)))
  const onDeleted = (ideaId: string) => setRows((rs) => rs.filter((r) => r.ideaId !== ideaId))
  // Restoring moves a row from `trash` back to a real active card, straight away — no
  // reload, and it does not wait for the row to reappear in `active`'s own query.
  const onRestored = (ideaId: string) => {
    setTrash((ts) => {
      const restored = ts.find((r) => r.ideaId === ideaId)
      if (restored) setRows((rs) => [{ ...restored, deleted: false, archived: false }, ...rs])
      return ts.filter((r) => r.ideaId !== ideaId)
    })
  }

  // 26-D §2 — persists the FULL active order in one request (see the route's own
  // comment for why sequential integers beat fractional insertion here), then reflects
  // the same sequence into `orderIndex` locally so a second drag before any refetch
  // still computes from correct data.
  const persistOrder = useCallback((orderedIds: string[]) => {
    setRows((rs) => {
      const at = new Map(orderedIds.map((id, idx) => [id, idx]))
      return rs.map((r) => (at.has(r.ideaId) ? { ...r, orderIndex: at.get(r.ideaId)! } : r))
    })
    void fetch('/api/ideas/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: orderedIds }),
    }).catch(() => {
      // A failed write leaves the order the user just set showing locally; the next full
      // page load re-reads the server's own order, which is the honest recovery — no
      // silent retry loop for a reorder nobody is watching finish.
    })
  }, [])

  // Reorders the ACTIVE subset only; archived rows keep their own relative order and
  // are simply carried along, since they never appear in this same list.
  const reorderActiveTo = useCallback((ideaId: string, targetIdeaId: string) => {
    setRows((rs) => {
      const activeIds = rs.filter((r) => !r.archived).map((r) => r.ideaId)
      const from = activeIds.indexOf(ideaId)
      const to = activeIds.indexOf(targetIdeaId)
      if (from === -1 || to === -1 || from === to) return rs
      const reordered = [...activeIds]
      reordered.splice(from, 1)
      reordered.splice(to, 0, ideaId)
      liveOrderRef.current = reordered
      const byId = new Map(rs.map((r) => [r.ideaId, r]))
      return [...reordered.map((id) => byId.get(id)!), ...rs.filter((r) => r.archived)]
    })
  }, [])

  const onPointerDownDrag = useCallback((ideaId: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    liveOrderRef.current = active.map((r) => r.ideaId)
    setDraggingId(ideaId)

    const onMove = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const rowEl = (el as HTMLElement | null)?.closest('[data-idea-id]') as HTMLElement | null
      const targetId = rowEl?.dataset.ideaId
      if (targetId && targetId !== ideaId) reorderActiveTo(ideaId, targetId)
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      setDraggingId(null)
      persistOrder(liveOrderRef.current)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }, [active, reorderActiveTo, persistOrder])

  // The keyboard alternative — a discrete, one-position move, persisted immediately.
  const onNudge = useCallback((ideaId: string, dir: -1 | 1) => {
    const activeIds = active.map((r) => r.ideaId)
    const from = activeIds.indexOf(ideaId)
    const to = from + dir
    if (from === -1 || to < 0 || to >= activeIds.length) return
    const reordered = [...activeIds]
    const [item] = reordered.splice(from, 1)
    reordered.splice(to, 0, item)
    setRows((rs) => {
      const byId = new Map(rs.map((r) => [r.ideaId, r]))
      return [...reordered.map((id) => byId.get(id)!), ...rs.filter((r) => r.archived)]
    })
    persistOrder(reordered)
  }, [active, persistOrder])

  const shown = view === 'archived' ? archived : view === 'deleted' ? trash : active

  return (
    // §13c — a floor under the divider: below this the column stops shrinking rather
    // than squeezing text and controls into something unreadable.
    <section className="min-w-[220px]">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-x-3 gap-y-1">
        {/* §15b — the same heading level, size and weight as "Create a new idea". */}
        <h2 className="text-lg font-semibold text-zinc-900">
          My ideas ({active.length})
        </h2>
        <div className="flex items-center gap-3">
          {archived.length > 0 && (
            <button
              type="button"
              onClick={() => setView((v) => (v === 'archived' ? 'active' : 'archived'))}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-800 underline"
            >
              {view === 'archived' ? 'Back to active ideas' : `${archived.length} archived`}
            </button>
          )}
          {/* §20 — the reachable "Deleted" view: symmetrical with "N archived" above,
              never a time-boxed toast, so recovery never depends on catching one. */}
          {trash.length > 0 && (
            <button
              type="button"
              onClick={() => setView((v) => (v === 'deleted' ? 'active' : 'deleted'))}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-800 underline"
            >
              {view === 'deleted' ? 'Back to active ideas' : `${trash.length} deleted`}
            </button>
          )}
        </div>
      </div>
      {/* §7a — every idea is listed; a long list scrolls within its column rather than
          being paged or truncated. */}
      <ul className="rounded-xl border border-zinc-200 divide-y divide-zinc-200 bg-white max-h-[70vh] overflow-y-auto">
        {shown.map((i) => (
          <IdeaRow
            key={i.ideaId}
            i={i}
            onUnarchived={onUnarchived}
            onDeleted={onDeleted}
            onRestored={onRestored}
            // 26-D §2 — reordering only applies to the active list; the archived and
            // deleted views render the same row without a handle at all.
            onPointerDownDrag={view === 'active' ? onPointerDownDrag(i.ideaId) : undefined}
            onNudge={view === 'active' ? (dir: -1 | 1) => onNudge(i.ideaId, dir) : undefined}
            dragging={draggingId === i.ideaId}
          />
        ))}
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
