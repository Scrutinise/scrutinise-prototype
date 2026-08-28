// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-K §1 — THREE STAGES, NAMED FOR WHAT THE USER DOES THERE.
//
// ⚠⚠ THIS FILE REPLACES `lib/lex/surfaces.ts`, AND THE REASON IS THE WHOLE SPRINT.
// The old file named the two screens "the build" and "the proposal" — which is how they
// were MADE, not what a person does on them. Charlie, walking his own product:
//
//     "I'm confused about where I am now, and I know it back to front."
//
// An implementation word on a user's screen is a word they have to translate before they
// can act. So the vocabulary is:
//
//   1 · The Idea        say what you want to change; add information and files; re-run
//   2 · The Strategy    work through what Lex drafted: read what matters, make the decisions
//   3 · The Deepening   go deeper — more research, more evidence, harder questions
//
// ⚠ THE NAMES AND THE PURPOSE LINES ARE DATA, NOT JSX. Two surfaces render this bar and a
// third will; the day they disagree about what stage 2 is called is the day the bar stops
// being an orientation device and becomes another thing to work out. `check:lex-25k`
// asserts every user-facing stage name comes from here.
//
// ⚠ MOVEMENT IS FREE IN BOTH DIRECTIONS (§1). Nothing here computes "locked". A stage is
// unavailable in exactly one case — there is no idea yet, so there is nothing on the other
// two to look at — and that case carries a REASON in words rather than an inert control.
//
// ⚠⚠ THIS FILE HOLDS NO PRISMA AND MUST NOT. It is imported by `CreateIdeaClient`, which
// is a CLIENT component, and the first version of it exported the counting query from here
// too — which pulled `lib/prisma` → `@prisma/adapter-pg` → `pg` → `require('tls')` into the
// BROWSER bundle and failed `next build` outright. ⚠ `tsc --noEmit` was clean the whole
// time: a package-boundary fault is invisible to the type checker and shows up only when
// the bundler tries to resolve `tls` for the browser. The counting lives next door in
// `stage-context.ts`, which nothing on the client imports.
//
// ⚠ WHAT THIS FILE IS NOT: a router. `stage-context.ts` computes the COUNTS that make each
// stage specific ("23 fields, 10 decisions waiting" rather than "the strategy"), because a
// number is the difference between a label and an invitation. The component that renders
// the result is `components/lex/StageBar.tsx`.
// ─────────────────────────────────────────────────────────────────────────────

export type LexStageKey = 'idea' | 'strategy' | 'deepening'

export interface LexStage {
  /** 1, 2 or 3 — shown to the user, because "stage two of three" is orientation. */
  n: 1 | 2 | 3
  key: LexStageKey
  /** The name the user reads. Never "the build", never "the proposal". */
  name: string
  /** What the user DOES here, in one line. §1's table. */
  purpose: string
}

/**
 * §1's table, verbatim, in order.
 *
 * ⚠ THESE ARE NOT THE FIVE PLATFORM STAGES. `docs/CLAUDE.md` §4 fixes
 * Create/Draft/Develop/Campaign/Legislate as the vocabulary the whole product shares, and
 * `Idea.stage` still carries `STAGE_1`. These three are the stages of *making a proposal
 * with Lex*, which all happen inside platform Stage 1. Renaming either to match the other
 * would break one of them; they are different things that both happen to be called stages.
 */
export const LEX_STAGES: readonly LexStage[] = [
  {
    n: 1,
    key: 'idea',
    name: 'The Idea',
    purpose: 'Say what you want to change. Add information and files, then re-run.',
  },
  {
    n: 2,
    key: 'strategy',
    name: 'The Strategy',
    purpose: 'Work through what Lex drafted: read what matters, make the decisions.',
  },
  {
    n: 3,
    key: 'deepening',
    name: 'The Deepening',
    purpose: 'Go deeper — more research, more evidence, harder questions.',
  },
] as const

export function stageByKey(key: LexStageKey): LexStage {
  const s = LEX_STAGES.find((x) => x.key === key)
  // A closed union with a table that covers it; the throw is for the day someone widens
  // one without the other, which is exactly when a silent fallback would be worst.
  if (!s) throw new Error(`unknown stage "${key}"`)
  return s
}

/**
 * Where each stage lives.
 *
 * ⚠ STAGE 1 CARRIES `stage=idea`, AND IT IS LOAD-BEARING. `app/ideas/build/page.tsx`
 * redirects a returning user with a finished build to stage 2 — right for someone
 * arriving from a link, and a TRAP for someone who has just pressed "1 · The Idea",
 * because they would be bounced straight back. §1 says movement is free in both
 * directions, so the link says which way the user meant to go. (`build=1` is the older
 * spelling of the same escape and still works; see that page.)
 */
export function stageHref(key: LexStageKey, ideaId: string | null): string {
  if (!ideaId) return '/ideas/build'
  switch (key) {
    case 'idea': return `/ideas/build?ideaId=${ideaId}&stage=idea`
    case 'strategy': return `/ideas/create?ideaId=${ideaId}`
    case 'deepening': return `/ideas/create?ideaId=${ideaId}&stage=deepening`
  }
}
