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

export default function MyIdeasList(
  { ideas, hiddenEmpty }: { ideas: MyIdea[]; hiddenEmpty: number },
) {
  if (ideas.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm font-semibold text-zinc-700">
        My ideas ({ideas.length})
      </h2>
      <ul className="rounded-xl border border-zinc-200 divide-y divide-zinc-200 bg-white">
        {ideas.map((i) => {
          const titled = hasRealTitle(i.title)
          const build = buildLine(i)
          return (
            <li key={i.ideaId}>
              <a
                href={hrefFor(i)}
                className="block px-4 py-3 hover:bg-zinc-50 transition-colors"
              >
                {/* ⚠ THE TITLE, OR THE USER'S OWN WORDS — AND THE DIFFERENCE IS VISIBLE.
                    An excerpt rendered in the title's styling would be us presenting their
                    half-finished sentence as a name we chose for them. */}
                {titled ? (
                  <p className="text-sm font-medium text-zinc-900 leading-snug">{i.title}</p>
                ) : (
                  <p className="text-sm text-zinc-800 leading-snug">
                    <span className="text-zinc-400">In your words: </span>
                    {i.excerpt}
                  </p>
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
              </a>
            </li>
          )
        })}
      </ul>
      {hiddenEmpty > 0 && (
        // ⚠ THE OMISSION IS STATED, still. 25-I swept 27 accidental drafts, but a shell can
        // still appear — a user who opens the page and leaves without answering creates
        // nothing now, yet older rows remain. Filtering them is right; filtering them
        // silently would make this list lie about what the account holds.
        <p className="mt-2 text-[11px] text-zinc-500">
          {hiddenEmpty} empty {hiddenEmpty === 1 ? 'idea is' : 'ideas are'} hidden — nothing was
          written in {hiddenEmpty === 1 ? 'it' : 'them'}.
        </p>
      )}
    </section>
  )
}
