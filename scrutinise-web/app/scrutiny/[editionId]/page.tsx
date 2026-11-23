// LEX 26-AC part (a) (BRIEF_26AC §2) — THE READER'S PAGE OF A SCRUTINY EDITION. Every value comes from the edition's frozen rows
// (lib/lex/scrutiny-edition-pure.ts editionView); nothing is read from the live idea, so the page does not move while the owner works.
// The owner's "Preview as a reviewer" is this page; the banner says so. Not indexed.

import type { Metadata, Viewport } from 'next'
import { redirect } from 'next/navigation'
import EditionReader from '@/components/lex/scrutiny/EditionReader'
import { readerAccess } from '@/lib/lex/scrutiny-access'
import { viewOf } from '@/lib/lex/scrutiny-edition'
import { LEX_VIEWPORT } from '@/lib/lex/viewport'
import { SCRUTINY_UI } from '@/lib/lex/screen-labels'

export const dynamic = 'force-dynamic'
export const viewport: Viewport = LEX_VIEWPORT
export const metadata: Metadata = { title: 'Scrutiny edition · Scrutinise', robots: { index: false, follow: false } }

type Props = { params: Promise<{ editionId: string }> }

export default async function ScrutinyEditionPage({ params }: Props) {
  const { editionId } = await params
  const r = await readerAccess(editionId)
  if (!r.ok) {
    if (!(r as { signedIn: boolean }).signedIn) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/scrutiny/${editionId}`)}`)
    return <main className="mx-auto max-w-xl px-4 py-16 text-[17px]"><p role="alert">{SCRUTINY_UI.notFound}</p></main>
  }
  const view = viewOf(r.edition)
  // part (a): everyone who can open this page is the owner or the team, so it is always a preview of what reviewers will see
  const banner = r.edition.status === 'DRAFT' ? 'draft' : 'preview'
  return (
    <main className="min-h-screen bg-white">
      {r.access === 'owner' ? <p className="mx-auto max-w-[44rem] px-4 pt-4 text-sm sm:px-6"><a href={`/ideas/${r.edition.ideaId}/scrutiny`} className="underline">‹ {SCRUTINY_UI.page}</a></p> : null}
      <EditionReader view={view} banner={banner} />
    </main>
  )
}
