// 26-X decision 318 — the Organising page's own address, the twin of /ideas/[id]/drafting. Redirects into the workspace with `view=organising`.
import { redirect } from 'next/navigation'

export default async function OrganisingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/ideas/create?ideaId=${encodeURIComponent(id)}&view=organising`)
}
