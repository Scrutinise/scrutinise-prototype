'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-X (decisions 308, 318) — THE TWO PAGES OVER THE ONE ACTION LIST, at the top of the Coherent Actions section.
//
//   Organising · Drafting
//
// It replaces 26-S2's four-step bar (1 Sort and prune · 2 Who, how and against · 3 Costs · 4 Order): Organising keeps step 1's tools and
// only those (§4a); Drafting is the same list, each row with its progress strip, and opening a row opens the record with its Drafts at the
// top (§5a). ONE list under both — the workspace below stays mounted across the switch, so its find box, filters and scroll survive the flip.
//
// ⚠ THE PAGE IS IN THE URL (`view=organising|drafting`, and `#38` for an open action), written with replaceState, so a reload, a shared
//   link or the checklist's link lands on the same page. `/ideas/[id]/drafting#38` redirects here.
// ⚠ NOTHING IS SIGNALLED BY COLOUR ALONE (CLAUDE.md §21): the current page is a filled marker, bold, a 2px border and "you are here".
// ⚠ NOT STORED ON THE IDEA (26-S2's `Idea.actionsStep` stays as it was, untouched and unread): which page to open is the link's to say.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState, type ReactNode } from 'react'
import type { ActionsPage } from '@/lib/lex/stages'
import { PAGE_UI, LIFECYCLE_UI } from '@/lib/lex/screen-labels'

const PAGES: ActionsPage[] = ['organising', 'drafting']

export default function ActionsPages({ initialPage, children }: { ideaId: string; initialPage: ActionsPage; children: (page: ActionsPage, setPage: (p: ActionsPage, actionNumber?: number | null) => void) => ReactNode }) {
  const [page, setPageState] = useState<ActionsPage>(initialPage)
  const setPage = useCallback((p: ActionsPage, actionNumber?: number | null) => {
    setPageState(p)
    try {
      const u = new URL(window.location.href)
      u.searchParams.set('view', p)
      u.hash = p === 'drafting' && actionNumber != null ? `#${actionNumber}` : ''
      window.history.replaceState(window.history.state, '', u.toString())
    } catch { /* a URL the browser will not write: the page still changes, only the address bar does not follow */ }
  }, [])

  return (
    <div className="space-y-2" data-actions-pages>
      <nav aria-label="Organising and Drafting — two pages over the same actions" data-page-bar>
        <ol className="flex flex-wrap gap-1.5">
          {PAGES.map((p) => {
            const here = p === page
            return (
              <li key={p}>
                <button type="button" onClick={() => setPage(p)} aria-current={here ? 'page' : undefined} data-page={p}
                  className={`text-xs rounded-lg px-2.5 py-1.5 text-left ${here ? 'border-2 border-zinc-900 bg-white font-bold text-zinc-900' : 'border border-zinc-300 bg-zinc-50 font-normal text-zinc-700 hover:bg-white'}`}>
                  <span aria-hidden>{here ? '●' : '○'}</span> {PAGE_UI[p]}
                  {here && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">{LIFECYCLE_UI.youAreHere}</span>}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      {children(page, setPage)}
    </div>
  )
}
