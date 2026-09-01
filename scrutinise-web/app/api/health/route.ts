import { NextResponse } from 'next/server';
import { capabilitySnapshot } from '@/lib/env-flags';
import { buildDriver } from '@/lib/lex/build-config';

/**
 * ⚠ THIS ENDPOINT ANSWERS "WHAT IS PRODUCTION ACTUALLY RUNNING?" — see docs/CLAUDE.md §20.
 *
 * §20's check 4 ("the running site serves your change") is the only delivery check that
 * proves anything, and it was unanswerable for any sprint whose changes all sit behind
 * Clerk: there is no unauthenticated string to read back. Three separate incidents closed
 * on local evidence alone — production served three-day-old code for a week, an ignored
 * `build/` rule dropped a whole route directory, and an uncommitted `build-cost.ts` failed
 * the deploy for ten hours — and each was invisible because every LOCAL check was green.
 *
 * §20: *"a green local build says the files on this machine are consistent with each other.
 * It says nothing about what a clean checkout would do."* So the running site now says
 * which commit it was built from, and check 4 becomes one request:
 *
 *     curl -s https://www.scrutinise.org/api/health   → { commit: "7e522fd…" }
 *
 * Compare it to `git rev-parse HEAD`. Equal means delivered. Different means production is
 * serving something else, which is precisely the fault that kept going unnoticed.
 *
 * ⚠ `force-dynamic`. Statically rendered, this would be baked at build time and then cached
 * at the edge — which still reports the right SHA, but a cached response from the PREVIOUS
 * deployment would report the previous one and look exactly like a failed deploy. Rendering
 * per request removes the ambiguity.
 *
 * ⚠ The SHA is public information — it is a commit id in a repository, not a secret — and
 * nothing else about the environment is exposed here.
 *
 * ⚠ `mail` is here for the same reason the SHA is (added 26 Aug 2026). §19 records that the
 * Vercel token is SAML-blocked, so environment variables cannot be read from a session at
 * all — and "is email configured in production?" then becomes a question nobody can answer
 * without Charlie opening a dashboard. It blocked the invite work twice. §19's own advice is
 * to *"prefer a counter to a config read — a behavioural measurement taken from a reachable
 * surface beats an unreachable config file every time"*, and this is that surface.
 *
 * It is a BOOLEAN — whether a key is present, never the key, never a length, never a prefix.
 * "This deployment can send email" is not a secret; it is already visible to any admin who
 * issues one invite and reads what the panel says happened.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠⚠ `capabilities` — SEARCH S17 §3, added 2026-08-28. THE SAME ARGUMENT, FOR THE FLAGS.
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * This closes a blindness with a three-incident history and no other cure:
 *
 *   · A capitalised `TRUE` in Vercel disabled `LEX_QUERY_ROUTER` and `LEX_QUERY_EXPANSION`
 *     SILENTLY, for an unknown period. The router's measured gold-set gains had never reached
 *     a user, and it was found by counting requests arriving at a downstream service from
 *     outside. `lib/env-flags.ts` exists because of it.
 *   · `docs/RAILWAY_ROLE.md` recorded "`VECTOR_SEARCH_URL` is unset in Vercel" — an inference
 *     from a local `.env`, wearing a measurement's grammar, and WRONG. It made a live scoring
 *     defect look latent for a day (docs/CLAUDE.md §19).
 *   · Every sprint report since June carries a sentence saying the live flag state cannot be
 *     read from a development machine. §19's own advice is to prefer a behavioural reading on
 *     a reachable surface over an unreadable config file. This is that surface.
 *
 * ⚠ READ THROUGH THE CODE'S OWN PATH, NOT FROM `process.env`. `capabilitySnapshot()` calls the
 * same `flagEnabled()` every read site calls, so this reports what is IN FORCE rather than what
 * was SET — which is the entire distinction that makes the endpoint worth building. A `TRUE`
 * would appear here as `false`, exactly as the app sees it, and that is the bug being caught.
 *
 * ⚠ NAMES AND BOOLEANS ONLY. No key, no length, no prefix, no model id, no URL, no stream list
 * — nothing that reveals account configuration. A capability NAME is the same class of public
 * fact as the commit SHA that already sits beside it.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      // Vercel injects this at build time. Absent locally, which is honest: a local dev
      // server is not a deployment and should not claim to be one.
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
      env: process.env.VERCEL_ENV ?? 'local',
      mail: Boolean(process.env.RESEND_API_KEY),
      // Every boolean capability flag, resolved exactly as the app resolves it.
      capabilities: capabilitySnapshot(),
      // ⚠ The three things that decide whether an ON flag can DO anything. Presence booleans in
      // the same class as `mail`: a router that is on with no GEMINI_API_KEY, or dense streams
      // named with no VECTOR_SEARCH_URL, both degrade silently, so the flags alone would still
      // mislead. §18's rule — a degradation must announce itself — applied to configuration.
      retrieval: {
        vectorSearchUrl: Boolean(process.env.VECTOR_SEARCH_URL?.trim()),
        ftsSearchUrl: Boolean(process.env.FTS_SEARCH_URL?.trim()),
        geminiKey: Boolean(process.env.GEMINI_API_KEY?.trim()),
      },
      // ══════════════════════════════════════════════════════════════════════════════════════
      // ⚠⚠ 25-T §1c — WHICH DRIVER IS IN FORCE. Added because the flip is Charlie's to make and
      // NOBODY COULD OTHERWISE CONFIRM IT LANDED.
      // ══════════════════════════════════════════════════════════════════════════════════════
      // §1c has Charlie set `LEX_BUILD_DRIVER=worker` in Vercel, which no session can do or read
      // back — the token authenticates and is refused by the account's SAML scope. Without this
      // line the only evidence the flip worked would be "a build completed", which is the exact
      // shape this file was built to abolish: an inference wearing a measurement's grammar.
      //
      // ⚠ AND THE TWO FAILURE MODES ARE SILENT IN OPPOSITE DIRECTIONS. Set wrongly — `Worker`,
      // `WORKER`, a trailing space — the app reads `client` and keeps driving builds from the
      // tab, with nothing to show for the change. Set correctly but with the Railway worker
      // down, every build sits at QUEUED and nothing runs it. One request now separates those.
      //
      // ⚠ READ THROUGH `buildDriver()`, not `process.env`, for the same reason `capabilities`
      // is: this reports what is IN FORCE, so a capitalisation that the app rejects appears here
      // as `client` — which is the bug being caught, not hidden.
      //
      // A mode name is the same class of public fact as the commit SHA beside it.
      build: { driver: buildDriver() },
    },
    { status: 200 },
  );
}
