// ─────────────────────────────────────────────────────────────────────────────
// WARM ON INTENT — wake the search services while the user is still typing.
//
// `fts-serve` and `vector-serve` sleep on inactivity. A wake costs ~13 s (measured), and
// the cheapest place to spend it is BEFORE the user has finished writing their problem
// rather than after they press Send.
//
// ⚠⚠ ON INTENT, NOT ON EVERY PAGE. This is called from exactly two places — opening the
// ideas hub, and beginning the first question — because those are the two moments that
// predict a search. Wiring it into a layout would fire it on every navigation in the app,
// which would keep both services permanently awake and quietly undo the saving this whole
// change exists to make. A warm-up that never lets the service sleep is a cost, not an
// optimisation.
//
// ⚠ `/health` IS THE RIGHT PROBE HERE even though it answers before the index is ready.
// The point is to START the wake, not to wait for it: the container being scheduled is the
// slow part, and the index load then overlaps with the user typing. A real query would be
// more thorough and would cost a real query.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'
// Bounded well under any wake: this must never hold a serverless function open waiting.
export const maxDuration = 15

const TARGETS: Array<{ name: string; url: string | undefined }> = [
  { name: 'fts-serve', url: process.env.FTS_SEARCH_URL },
  { name: 'vector-serve', url: process.env.VECTOR_SEARCH_URL },
]

export async function POST() {
  // Signed-in only. An unauthenticated warm endpoint is a free way for anyone to keep two
  // paid services awake, which is the exact cost this change is removing.
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

  const started = Date.now()
  const results = await Promise.all(TARGETS.map(async (t) => {
    if (!t.url) return { service: t.name, poked: false, reason: 'url not configured' }
    try {
      // ⚠ FIRE AND FORGET, WITH A SHORT LEASH. We are not waiting for the wake — we are
      // starting it. A long wait here would move the delay from the search to the page
      // load, which is the same delay in a worse place.
      const res = await fetch(`${t.url.replace(/\/$/, '')}/health`, {
        signal: AbortSignal.timeout(3_000),
        cache: 'no-store',
      })
      return { service: t.name, poked: true, alreadyAwake: res.ok }
    } catch {
      // ⚠ A TIMEOUT HERE IS THE EXPECTED CASE, NOT AN ERROR. A sleeping service will not
      // answer within three seconds; the request still reaches Railway's router and starts
      // the wake, which is the whole job. Reporting it as a failure would make the normal
      // path look broken in the logs.
      return { service: t.name, poked: true, alreadyAwake: false }
    }
  }))

  return NextResponse.json({ ok: true, ms: Date.now() - started, results })
}
