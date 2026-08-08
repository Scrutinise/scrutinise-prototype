/**
 * instrumentation.ts — Next.js server bootstrap hook. Runs once per server instance, before the
 * first request is handled.
 *
 * Its whole job today is to answer "is capability X actually live?" by LOOKING rather than by
 * inferring. On 2026-08-08 the query router and query expansion were both off in production —
 * their Vercel values were `TRUE` and every read site compared with `=== 'true'` — and the only
 * way that was discovered was by counting requests arriving at the Railway search services from
 * the outside. Nothing in the app ever said what it believed was switched on.
 *
 * So: one line, at boot, with the RESOLVED state of every capability flag after parsing, plus the
 * non-boolean config that decides whether an "on" flag can do anything at all. Secrets are
 * reported as set/unset, never printed.
 *
 * Note this fires per serverless instance, so on Vercel it appears on each cold start rather than
 * once globally. That is what you want — it pins the configuration to the instance that served
 * the request you are looking at.
 */
export async function register() {
  // Only the Node runtime: the edge runtime has a different (and much smaller) env surface, and
  // logging a half-populated snapshot there would be actively misleading.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { capabilityLine } = await import('@/lib/env-flags')
  console.log(capabilityLine())
}
