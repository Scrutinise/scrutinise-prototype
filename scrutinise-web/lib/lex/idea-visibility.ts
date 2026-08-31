// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-O §4 — WHICH IDEAS THE PRODUCT MAY SHOW. ONE PREDICATE, IMPORTED.
//
// §4b: an archived idea is *"hidden from every list, every count and every search"*, and §4d
// asks for the negative to be asserted: **an archived idea appears in ZERO lists.**
//
// ⚠⚠ THAT IS A PROPERTY OF NINE CALL SITES, WHICH IS WHY THIS FILE EXISTS RATHER THAN NINE
// COPIES OF `archivedAt: null`. §4d's own sentence is the argument: *"A hide that one read path
// forgets is worse than no hide at all."* A user told their idea is hidden, who then finds it on
// the public list, has been misled about something we controlled — and the ninth call site is
// always the one nobody remembered.
//
// ⚠ SO A CHECK ASSERTS THE SPREAD, NOT THE SPELLING. `check:lex-25o` counts the places that
// read `prisma.idea.findMany` / `.count` and requires each to go through this constant — a
// hand-written `archivedAt: null` passes a grep and is exactly what drifts.
//
// ⚠ AND `deletedAt` STAYS BESIDE IT RATHER THAN BEING FOLDED IN. They mean different things
// (the owner's act vs an admin's), they are answered to different people, and a single
// `visible: boolean` would lose which one happened — see the note on `Idea.archivedAt`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The `where` fragment every list, count and search of ideas must spread.
 *
 * ⚠ IT IS `Prisma.IdeaWhereInput`-SHAPED BY CONSTRUCTION rather than by annotation: typing it
 * would pull the generated client into a module the document stack's import ban (`check:20bd`)
 * keeps clean of heavy imports, and the shape is two nulls.
 */
export const LIVE_IDEA = { deletedAt: null, archivedAt: null } as const

/**
 * The same thing for a NESTED relation filter — `idea: { ... }` on a child table.
 *
 * ⚠ A SEPARATE EXPORT, because spreading `LIVE_IDEA` into a relation filter reads correctly and
 * is easy to forget entirely; naming the nested case is what makes its absence visible in a
 * diff. Same two nulls, and they cannot drift because the second reads the first.
 */
export const LIVE_IDEA_RELATION = { idea: LIVE_IDEA } as const

/**
 * ⚠ THE ONE PLACE ARCHIVED IDEAS ARE STILL VISIBLE, AND IT IS DELIBERATE: the admin surface.
 * §4b keeps the rows, which is worth nothing if nobody can find them to put one back. Every
 * other reader uses `LIVE_IDEA`.
 */
export const INCLUDING_ARCHIVED = { deletedAt: null } as const
