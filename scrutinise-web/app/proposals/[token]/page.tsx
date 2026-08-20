// ─────────────────────────────────────────────────────────────────────────────
// Sprint 20-D — what a recipient sees when they open a shared link.
//
// ⚠ THIS IS NOT §20.1's ONLINE VIEW, AND IT DOES NOT PRETEND TO BE. The Online
// View is the full content as a web page with the corpus links live and, where
// public, open to comment; it is SCAFFOLDED in the snapshot and deliberately not
// built this sprint. This page is the LINK RESOLVER made visible: it proves and
// shows which version the link is pinned to, states what the proposal does not
// establish, and hands over the two documents.
//
// Half an Online View would be worse than none — a recipient who reads a partial
// web rendering and never opens the PDF has read a partial proposal without being
// told so. So this page is explicitly a cover sheet, and says which version it is.
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import { resolveSharedProposal } from '@/lib/documents/proposal-version'
import { headlineCost } from '@/lib/documents/build-proposal'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ token: string }>
}

// A shared proposal is not indexed unless it is PUBLIC; a link-shared proposal
// appearing in a search result would defeat the point of link sharing.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const outcome = await resolveSharedProposal(token, null)
  if (!outcome.ok || !outcome.proposal || outcome.proposal.visibility !== 'PUBLIC') {
    return { title: 'Scrutinise', robots: { index: false, follow: false } }
  }
  return {
    title: outcome.proposal.title,
    description: outcome.proposal.snapshot?.summaryDescription ?? 'A policy proposal developed on Scrutinise.',
  }
}

async function readerId(): Promise<string | null> {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) return null
  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
  return user?.id ?? null
}

function stamp(iso: string | null): string | null {
  if (!iso) return null
  return `${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

const REFUSAL: Record<string, string> = {
  not_found: 'That link does not point at a proposal.',
  unpublished: 'This proposal is not published. The link may have been withdrawn by its owner.',
  sign_in_required: 'This proposal is shared within a community. Sign in to see whether you can read it.',
  not_in_community: 'This proposal is shared within a community you are not a member of.',
}

export default async function SharedProposalPage({ params }: Props) {
  const { token } = await params
  const outcome = await resolveSharedProposal(token, await readerId())

  if (!outcome.ok || !outcome.proposal) {
    return (
      <>
        <PublicNav />
        <main className="max-w-2xl mx-auto px-4 py-16">
          <h1 className="text-lg font-semibold text-zinc-900 mb-2">This proposal isn’t available</h1>
          <p className="text-sm text-zinc-600">{REFUSAL[outcome.reason] ?? REFUSAL.not_found}</p>
        </main>
      </>
    )
  }

  const p = outcome.proposal
  const s = p.snapshot
  const field = (key: string) => {
    const f = s.fields?.find((x) => x.key === key)
    return typeof f?.value === 'string' && f.value.trim() ? f.value.trim() : null
  }
  const cost = headlineCost(s.actions ?? [])
  const openQuestions = (s.knownUnknowns?.length ?? 0) + (s.issues?.filter((i) => i.status === 'OPEN').length ?? 0)
  const unevidenced = s.coverage ? s.coverage.fieldsTotal - s.coverage.fieldsSupported : null

  const dl = (kind: string, format: string) => `/api/proposals/${token}/download?kind=${kind}&format=${format}`

  return (
    <>
      <PublicNav />
      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">{p.title}</h1>
        <p className="text-xs text-zinc-500 mt-1">
          A policy proposal by {p.ownerName} · version {p.versionNumber}
          {p.publishedAt ? ` · published ${stamp(p.publishedAt)}` : ''}
        </p>
        {p.changeNote && <p className="text-xs text-zinc-500 mt-1">Since the previous version: {p.changeNote}</p>}

        {s.summaryDescription && (
          <p className="text-sm text-zinc-700 mt-5 leading-relaxed">{s.summaryDescription}</p>
        )}

        <section className="mt-8 space-y-5">
          {[
            ['The problem', field('challenge')],
            ['The pivotal obstacle', field('pivotalObstacle')],
            ['The approach', field('chosenApproach')],
          ].map(([label, value]) => (
            <div key={label as string}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</h2>
              <p className="text-sm text-zinc-700 leading-relaxed mt-1">
                {value ?? <span className="text-zinc-400 italic">Not settled in this version.</span>}
              </p>
            </div>
          ))}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cost</h2>
            <p className="text-sm text-zinc-700 mt-1">
              Proposal: {cost ?? <span className="text-zinc-400 italic">not costed in the record</span>}
              {' · '}
              Problem: {s.costs?.problemCost ?? <span className="text-zinc-400 italic">not established</span>}
            </p>
          </div>
        </section>

        {/* ⚠ The gaps travel with the link, not only inside the PDF. A recipient
            who never opens the file has still been told what is unestablished. */}
        <section className="mt-8 border border-zinc-200 rounded p-4 bg-zinc-50/50">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">What this does not establish</h2>
          <p className="text-sm text-zinc-700 mt-1">
            {unevidenced !== null && s.coverage
              ? `${unevidenced} of ${s.coverage.fieldsTotal} settled kernel fields carry no source in the record. `
              : ''}
            {openQuestions} question{openQuestions === 1 ? '' : 's'} or issue{openQuestions === 1 ? '' : 's'} remain open.
            Each is listed in the full proposal, marked where it appears.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
            The documents (version {p.versionNumber})
          </h2>
          <div className="flex flex-wrap gap-2">
            <a className="text-xs px-3 py-1.5 rounded border border-zinc-300 hover:bg-zinc-50" href={dl('PROPOSAL_SUMMARY', 'pdf')}>Summary (PDF)</a>
            <a className="text-xs px-3 py-1.5 rounded border border-zinc-300 hover:bg-zinc-50" href={dl('PROPOSAL', 'pdf')}>Full proposal (PDF)</a>
            <a className="text-xs px-3 py-1.5 rounded border border-zinc-300 hover:bg-zinc-50" href={dl('PROPOSAL', 'docx')}>Full proposal (.docx)</a>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            These files are rendered from version {p.versionNumber} and cannot change. If {p.ownerName} keeps
            editing, this link keeps showing you version {p.versionNumber} until they publish again.
          </p>
        </section>
      </main>
    </>
  )
}
