// 26-X decision 318 — THE DEEP LINK TO THE DRAFTING PAGE: `/ideas/[id]/drafting#38` lands on Drafting with #38 open.
// The workspace lives at /ideas/create (one route serves the whole Development screen), so this redirects there with `view=drafting`.
// ⚠ The `#38` is not sent to the server; the browser carries a URL's fragment across a redirect whose Location has none (RFC 7231 §7.1.2),
//   and the workspace reads it on arrival (ActionsWorkspace). Auth, ownership and the "nothing built yet" rule are the target page's.
import { redirect } from 'next/navigation'

export default async function DraftingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/ideas/create?ideaId=${encodeURIComponent(id)}&view=drafting`)
}
