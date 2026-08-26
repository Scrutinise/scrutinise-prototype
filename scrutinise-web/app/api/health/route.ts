import { NextResponse } from 'next/server';

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
    },
    { status: 200 },
  );
}
