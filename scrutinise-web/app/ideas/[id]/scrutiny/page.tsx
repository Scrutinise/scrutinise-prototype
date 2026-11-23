// LEX 26-AC part (a) (BRIEF_26AC §3) — THE OWNER'S PRIVATE SCRUTINY PAGE: the idea's scrutiny editions; create one, prepare the draft
// (sections, blind round, author's notes, the source-linking exercise), see the checklist, publish, and "Preview as a reviewer".
// The team (editors and viewers) see the list read-only; every write is the owner's (the route refuses anyone else, in words).

import type { Metadata, Viewport } from 'next'
import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ideaAccessOf } from '@/lib/lex/authz'
import { listEditions, loadEdition, viewOf, checklistOf } from '@/lib/lex/scrutiny-edition'
import { filedSources } from '@/lib/lex/scrutiny-linking'
import { editionView, SECTION_KEY } from '@/lib/lex/scrutiny-edition-pure'
import { LEX_VIEWPORT } from '@/lib/lex/viewport'
import { SCRUTINY_UI } from '@/lib/lex/screen-labels'
import ScrutinyOwner, { type OwnerDraft } from '@/components/lex/scrutiny/ScrutinyOwner'

export const dynamic = 'force-dynamic'
export const viewport: Viewport = LEX_VIEWPORT
export const metadata: Metadata = { title: 'Private Scrutiny · Scrutinise', robots: { index: false, follow: false } }

type Props = { params: Promise<{ id: string }> }

export default async function ScrutinyOwnerPage({ params }: Props) {
  const { id } = await params
  const { user } = await getAuthenticatedUser()
  if (!user) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/ideas/${id}/scrutiny`)}`)
  const idea = await prisma.idea.findUnique({ where: { id }, select: { id: true, title: true, creatorId: true, deletedAt: true, collaborators: { select: { userId: true, role: true } } } })
  const access = idea && !idea.deletedAt ? ideaAccessOf(user.id, idea.creatorId, idea.collaborators) : null
  if (!idea || !access) return <main className="mx-auto max-w-xl px-4 py-16"><p role="alert">{SCRUTINY_UI.notFound}</p></main>

  const editions = await listEditions(id)
  const open = editions.find((e) => e.status === 'DRAFT')
  let draft: OwnerDraft | null = null
  if (open) {
    const e = (await loadEdition(open.id))!
    // the structure the owner chooses from: every section, as if nothing were left out
    const all = editionView(e.snapshot, { number: e.number, status: e.status, publishedAt: null, blind: e.blind, include: { hidden: [] } }, e.notes, e.links)
    const view = viewOf(e)
    draft = {
      id: e.id, number: e.number, versionNumber: e.versionNumber, blind: e.blind, hidden: e.include.hidden ?? [],
      sections: [
        { key: SECTION_KEY.summary, label: SCRUTINY_UI.ideaInOnePage },
        ...all.headings.map((h) => ({ key: h.key, label: `${h.name} (${h.actions.length} ${h.actions.length === 1 ? 'action' : 'actions'})` })),
        { key: SECTION_KEY.setAside, label: SCRUTINY_UI.optionsSetAside },
        { key: SECTION_KEY.sources, label: SCRUTINY_UI.sources },
      ],
      targets: [
        ...all.headings.filter((h) => h.id).map((h) => ({ kind: 'HEADING' as const, id: h.id!, label: `Heading: ${h.name}` })),
        ...all.headings.flatMap((h) => h.actions).map((a) => ({ kind: 'ACTION' as const, id: a.id, label: `#${a.number} ${(a.title?.trim() || a.statement).slice(0, 70)}` })),
      ],
      notes: e.notes,
      links: e.links,
      checklist: checklistOf(e),
      sources: (await filedSources(id)).map((s) => ({ number: s.number, title: s.title })),
      sectionCount: view.headings.length,
    }
  }
  return (
    <main className="min-h-screen bg-white">
      <ScrutinyOwner ideaId={id} title={idea.title ?? 'Untitled idea'} owner={access === 'owner'} editions={editions} draft={draft} />
    </main>
  )
}
