// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-F §9 — THE ONE URL EVERY "start a new idea" CONTROL POINTS AT.
//
// It reads the switch (`lib/lex/new-idea-door.ts`) and redirects. That is all it does, and
// it is the reason the cutover is a database write rather than a deploy: seven creation
// entries across four files — two of them client components that cannot read the database
// at all — now share one destination, and the door behind it is configuration.
//
// ⚠ IT DOES NOT AUTHENTICATE OR ONBOARD. Both doors already do their own `auth()` check and
// their own age/experience redirects, and duplicating them here would put a third copy of a
// gate in the codebase — one that would drift, and that would run BEFORE the destination
// page's own version of the same check. The redirect preserves the user's intent; the
// destination decides whether they may act on it.
//
// ⚠ `redirect()` THROWS. It is the documented Next.js control flow, not an error path;
// nothing after it runs, and it must not be wrapped in a try/catch.
// ─────────────────────────────────────────────────────────────────────────────

import { redirect } from 'next/navigation'
import { doorPath, newIdeaDoor } from '@/lib/lex/new-idea-door'

// The door is a live switch, so this page must never be cached — a statically rendered
// redirect would keep sending people to the old door after the flip, which is exactly the
// failure §9a's "no deploy" requirement exists to prevent.
export const dynamic = 'force-dynamic'

export default async function NewIdeaPage() {
  redirect(doorPath(await newIdeaDoor()))
}
