// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-F §9 — THE CUTOVER SWITCH. PREPARED, NOT THROWN.
//
// `/ideas/build` will replace `/ideas/create` as the entry point for a NEW idea, after
// Charlie has validated the rebuild. This file is the switch that makes that a decision
// rather than a deployment.
//
// ⚠⚠ THE FLAG IS A DATABASE ROW AND NOT AN ENVIRONMENT VARIABLE, AND THAT IS THE WHOLE OF
// §9a. "Flipping it must not need a deploy, and flipping it back must be equally cheap."
// A Vercel environment variable does not satisfy that: changing one has no effect until
// the project is redeployed, so an env flag would make the revert path — the thing you
// reach for when the new door is failing a real user — a build-and-wait. `PlatformConfig`
// is read per request, so the flip and the revert are the same single write and take
// effect on the next page load.
//
// ⚠ AND EVERY CREATION ENTRY POINTS AT ONE URL. `/ideas/new` is a server route that reads
// this and redirects. That matters for a reason that is not obvious: half the creation
// entries are CLIENT components (`PublicNav`, `Navbar`, `DashboardClient`) which cannot
// read the database, so a flag threaded as a prop would have to be plumbed through three
// layouts — and a link somebody forgot to plumb would be a creation entry silently stuck
// on the old door with nothing to notice it by.
//
// ⚠ §9b — ONLY THE CREATION ENTRY MOVES. `/ideas/create` is BOTH the creation entry and
// the editing surface for an existing idea. Every link carrying `?ideaId=` is the second
// kind and is deliberately untouched:
//
//     app/ideas/[id]/IdeaDetailClient.tsx   "Edit"                 — a returning user
//     components/lex/RecentIdeasPanel.tsx   the previous-ideas list — a returning user
//     app/ideas/build/BuildIdeaClient.tsx   "Open …"                — the build's own handoff
//     lib/email.ts                          the build-complete email — already in inboxes
//
// `check:lex-25f` asserts that list has not changed. Nothing a returning user touches moves.
//
// ⚠ §9d — THE OLD ELICITATION IS NOT DELETED. It stays behind this flag until the new door
// has served real ideas without incident. Removing it is a later, separate commit, and
// this file is what makes that a choice rather than a necessity.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

export type NewIdeaDoor = 'create' | 'build'

/** The `PlatformConfig` key. One row, one write to flip, one write to revert. */
export const NEW_IDEA_DOOR_KEY = 'newIdeaDoor'

/** The single URL every creation entry on the platform points at. */
export const NEW_IDEA_PATH = '/ideas/new'

/**
 * ⚠ THE DEFAULT IS `create`, AND IT WILL STAY THAT WAY UNTIL CHARLIE SAYS OTHERWISE.
 *
 * 25-F prepares the cutover; it does not perform it. With no row present, every creation
 * entry lands exactly where it lands today, so this sprint changes the behaviour of the
 * platform's front door by nothing at all. That is deliberate and it is asserted by
 * `check:lex-25f` — a "prepared" cutover that had quietly happened would be the worst of
 * both, because nobody would be watching for it.
 */
export const DEFAULT_DOOR: NewIdeaDoor = 'create'

export function isNewIdeaDoor(v: unknown): v is NewIdeaDoor {
  return v === 'create' || v === 'build'
}

export function doorPath(door: NewIdeaDoor): string {
  return door === 'build' ? '/ideas/build' : '/ideas/create'
}

/**
 * Which door a NEW idea gets, right now.
 *
 * Precedence, and each step is deliberate:
 *   1. The `PlatformConfig` row — the live switch, flippable with no deploy.
 *   2. `LEX_NEW_IDEA_DOOR` — an env override, for a preview deployment or a local run
 *      where nobody wants to write to the shared database to try the other door.
 *   3. `create` — today's behaviour.
 *
 * ⚠ A ROW WITH A VALUE THIS DOES NOT RECOGNISE FALLS BACK AND SAYS SO. An unrecognised
 * value meaning "create" silently is the `LEX_QUERY_ROUTER=TRUE` failure (lib/env-flags.ts)
 * — a flag that was set, believed to be on, and off for months with no signal. The one
 * difference that matters here is that the fallback is the SAFE direction: an unreadable
 * value leaves users on the door that has been serving them.
 */
export async function newIdeaDoor(): Promise<NewIdeaDoor> {
  try {
    const row = await prisma.platformConfig.findUnique({
      where: { key: NEW_IDEA_DOOR_KEY }, select: { value: true },
    })
    if (row) {
      const v = typeof row.value === 'string' ? row.value : String(row.value ?? '')
      if (isNewIdeaDoor(v)) return v
      console.error(
        `[new-idea-door] PlatformConfig["${NEW_IDEA_DOOR_KEY}"] is ${JSON.stringify(row.value)}, `
        + `which is neither "create" nor "build" — falling back to "${DEFAULT_DOOR}". `
        + 'Nobody is being sent to a door that does not exist, but the flag is NOT doing what it looks like it is doing.',
      )
      return DEFAULT_DOOR
    }
  } catch (err) {
    // ⚠ A DATABASE HICCUP MUST NOT TAKE THE FRONT DOOR DOWN. Falling back leaves the user
    // on the door that has been working; failing closed would mean nobody can start an
    // idea at all because a config read timed out.
    console.error('[new-idea-door] could not read the config row — falling back to the default door', {
      error: err instanceof Error ? err.message : err,
    })
  }

  const env = process.env.LEX_NEW_IDEA_DOOR?.trim().toLowerCase()
  if (env) {
    if (isNewIdeaDoor(env)) return env
    console.warn(`[new-idea-door] LEX_NEW_IDEA_DOOR=${JSON.stringify(env)} is not a door — ignoring it`)
  }
  return DEFAULT_DOOR
}

/** The resolved door and where it sends people — for an admin screen or a boot log. */
export async function newIdeaDoorState(): Promise<{ door: NewIdeaDoor; path: string; isDefault: boolean }> {
  const door = await newIdeaDoor()
  return { door, path: doorPath(door), isDefault: door === DEFAULT_DOOR }
}
