// ─────────────────────────────────────────────────────────────────────────────
// TEMPORARY (Charlie, 24 Aug 2026) — A WAY TO SEE IDEAS MADE ON /ideas/build.
//
// Nothing in the product lists ideas created on this path, so a finished build is
// reachable only by pasting its id into a URL. This is a stopgap: no paging, no search,
// no delete, owner-only, and it reads rows that already exist rather than storing
// anything new. It should be deleted the moment a real "my ideas" surface exists.
//
// ⚠ IT IS A SEPARATE PURE COMPONENT ON PURPOSE, AND THAT IS 25-E's LESSON APPLIED.
// `BuildIdeaClient` cannot be rendered in a harness — it pulls in `PublicNav`, which calls
// `useUser()` and throws outside a `<ClerkProvider>`. A panel written inside it would be
// a panel no check could ever render, and "written down" is not "reachable": that exact
// gap is what left `IdeaBuild` empty for eight sprints. This file takes its props
// explicitly and returns markup, so `verify:lex-recent-ideas` can look at the output.
// ─────────────────────────────────────────────────────────────────────────────

/** One row of the stopgap list. */
export interface RecentIdea {
  ideaId: string
  title: string
  /**
   * The user's own words, truncated.
   * ⚠ LOAD-BEARING. Every idea on this path is called "Untitled idea" until the user
   * accepts the title Lex proposed — 11 of 11 in production right now — so a list keyed
   * on titles would render eleven identical rows and be worthless. `title` is carried on
   * the type but deliberately not displayed.
   */
  excerpt: string
  elicitationStatus: 'IN_PROGRESS' | 'AWAITING_CONFIRMATION' | 'CONFIRMED'
  buildStatus: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED' | null
  passesComplete: number | null
  updatedAt: string
}

export default function RecentIdeasPanel(
  { recent, hiddenEmpty }: { recent: RecentIdea[]; hiddenEmpty: number },
) {
  // Nothing to list — render nothing at all. A disclosure control that opens onto an
  // empty box is a worse answer than no control.
  if (recent.length === 0) return null

  return (
    <details className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50/60">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-900">
        Your previous ideas ({recent.length})
      </summary>
      <ul className="border-t border-zinc-200 divide-y divide-zinc-200">
        {recent.map((r) => (
          <li key={r.ideaId} className="px-3 py-3">
            <p className="text-sm text-zinc-800 leading-snug">{r.excerpt}</p>
            <p className="mt-1 text-[11px] text-zinc-500">
              {/* Fixed locale, not the viewer's: this is a diagnostic surface and a
                  timestamp that renders differently per machine is one you cannot quote
                  back to anyone. */}
              {new Date(r.updatedAt).toLocaleString('en-GB', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                timeZone: 'UTC',
              })} UTC
              {' · '}
              {/* ⚠ THE TWO STATES ARE REPORTED SEPARATELY BECAUSE THEY ARE SEPARATE FACTS.
                  An elicitation can be CONFIRMED with no build at all — that is precisely
                  the state that stopped this product for eight sprints, and collapsing the
                  pair into one "status" would hide it again. */}
              elicitation {r.elicitationStatus.toLowerCase().replace(/_/g, ' ')}
              {' · '}
              {r.buildStatus
                ? `build ${r.buildStatus.toLowerCase()}${r.passesComplete ? ` (${r.passesComplete}/7)` : ''}`
                : 'no build started'}
            </p>
            <p className="mt-2 flex flex-wrap gap-3 text-xs">
              {/* Offered only when there is something to open. A link to a kernel that was
                  never drafted is a dead end wearing a button. */}
              {r.buildStatus === 'DONE' && (
                <a href={`/ideas/create?ideaId=${r.ideaId}`} className="text-blue-700 underline font-medium">
                  Open the kernel
                </a>
              )}
              <a href={`/ideas/build?ideaId=${r.ideaId}`} className="text-zinc-600 underline">
                Open here
              </a>
              <span className="text-zinc-400 font-mono">{r.ideaId.slice(0, 8)}</span>
            </p>
          </li>
        ))}
      </ul>
      {hiddenEmpty > 0 && (
        // ⚠ THE OMISSION IS STATED. 10 of the 11 elicitation rows in production are blank
        // shells left by the pre-25-E bug that minted a new idea on every visit. Filtering
        // them out is right; filtering them out silently would make this list lie about
        // what the database holds.
        <p className="border-t border-zinc-200 px-3 py-2 text-[11px] text-zinc-500">
          {hiddenEmpty} empty {hiddenEmpty === 1 ? 'idea' : 'ideas'} hidden — shells with nothing
          written in them, left behind by the pre-25-E bug that minted a new idea on every visit.
        </p>
      )}
    </details>
  )
}
