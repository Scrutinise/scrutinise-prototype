// ─────────────────────────────────────────────────────────────────────────────
// Sprint 20-E §5b — THE ONLINE VIEW. §20.1's third output, and what a recipient opens.
//
// 20-D built this page as a COVER SHEET and said so plainly: it resolved the link, proved
// which version it was pinned to, stated the gaps and handed over the files. That was the
// right call at the time — "half an Online View would be worse than none, because a
// recipient who reads a partial web rendering and never opens the PDF has read a partial
// proposal without being told so."
//
// This is the whole thing. The same content as the documents, as a web page, with the
// corpus links live.
//
// ⚠⚠ PINNED TO THE PUBLISHED VERSION, and that is the load-bearing property. Every value on
// this page comes from `outcome.proposal.snapshot` — the STORED snapshot of the version the
// link resolves to — and not one of them is read from live idea state. So a recipient's
// link does not shift under them while the author keeps editing: the author can publish v4
// this afternoon and this page still renders v3 until the pin moves. `resolveSharedProposal`
// reads `publishedProposalVersion`, never "the latest", and `check:20bd` plants a v2 after
// publishing v1 and asserts it still returns v1.
//
// ⚠ VISIBILITY IS THE RESOLVER'S JOB, NOT THIS PAGE'S. PRIVATE, COMMUNITY-without-membership
// and a bad token all come back as refusals with a reason word, and the page renders the
// refusal. There is no read of idea state here that could bypass it.
//
// ⚠ AND THE HONEST SECTIONS SURVIVE. What this does not establish, what was set aside, and
// what was still open all render HERE, not only inside the PDF — a recipient who never opens
// a file has still been told. That is the same rule the Summary is held to.
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import { resolveSharedProposal } from '@/lib/documents/proposal-version'
import { headlineCost } from '@/lib/documents/build-proposal'
import { QUESTION_HEADINGS } from '@/lib/lex/question-headings'
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">{title}</h2>
      {children}
    </section>
  )
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

  // ⚠ Defensive on every shape-2 member. A version published before 25-D is still a version
  // somebody holds a link to, and it must open — with the newer sections ABSENT and said to
  // be absent, never rendered as empty (which would read as "the author had nothing").
  const preShapeTwo = (s.snapshotVersion ?? 1) < 2
  const excluded = s.excludedSources ?? []
  const outstanding = s.outstanding ?? null

  // Findings grouped by the question they answer (§25.5), with the corpus links live.
  const byHeading = QUESTION_HEADINGS
    .map((h) => ({ ...h, items: (s.evidence ?? []).filter((e) => e.headingKey === h.key) }))
    .filter((h) => h.items.length > 0)
  const unfiled = (s.evidence ?? []).filter(
    (e) => !e.headingKey || !QUESTION_HEADINGS.some((h) => h.key === e.headingKey),
  )

  const causes = s.causes ?? []
  const actions = s.actions ?? []
  const ruledOut = (s.options ?? []).filter((o) => o.status === 'RULED_OUT')

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

        {/* ── the kernel ─────────────────────────────────────────────────── */}
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

        {causes.length > 0 && (
          <Section title="Why the problem persists">
            <ul className="space-y-3">
              {causes.map((c) => (
                <li key={c.id} className="text-sm text-zinc-700">
                  <span className="font-medium">{c.cause}</span>
                  {c.isRootCause && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">Root cause</span>}
                  {/* ⚠ The user's own knowledge is ATTRIBUTED, never blended into Lex's prose. */}
                  {c.source === 'USER' && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Author’s own</span>}
                  {c.whyPersisted && <span className="block text-zinc-600 mt-0.5">{c.whyPersisted}</span>}
                  {!c.supported && (
                    <span className="block text-[11px] text-amber-700 mt-0.5">
                      Nothing in the record backs this.
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {actions.length > 0 && (
          <Section title="What it would do">
            <ul className="space-y-3">
              {actions.map((a) => (
                <li key={a.id} className="text-sm text-zinc-700">
                  <span className="font-medium">{a.practicalStep}</span>
                  {a.whoImplements && <span className="block text-zinc-600 mt-0.5">Implemented by {a.whoImplements}.</span>}
                  {!a.supported && (
                    <span className="block text-[11px] text-amber-700 mt-0.5">
                      Nothing in the record backs this.
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {ruledOut.length > 0 && (
          <Section title="What it rules out, and why">
            <ul className="space-y-3">
              {ruledOut.map((o) => (
                <li key={o.id} className="text-sm text-zinc-700">
                  <span className="font-medium">{o.approach}</span>
                  <span className="block text-zinc-600 mt-0.5">
                    {o.ruleOutReason?.trim() || <span className="text-amber-700">No reason was recorded.</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── the evidence, by question, WITH THE CORPUS LINKS LIVE ────────── */}
        {(byHeading.length > 0 || unfiled.length > 0) && (
          <Section title="The evidence, by the question it answers">
            <div className="space-y-5">
              {byHeading.map((h) => (
                <div key={h.key}>
                  <h3 className="text-sm font-semibold text-zinc-800">{h.heading}</h3>
                  <ul className="mt-1 space-y-2">
                    {h.items.map((e) => (
                      <li key={e.id} className="text-sm">
                        {e.url ? (
                          <a href={e.url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-700 hover:underline">{e.citation || e.title}</a>
                        ) : (
                          <span className="text-zinc-800">{e.citation || e.title}</span>
                        )}
                        {e.siftReason && <span className="block text-xs text-zinc-600 mt-0.5">{e.siftReason}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {unfiled.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-800">Not filed under a question</h3>
                  <p className="text-[11px] text-zinc-500">
                    Found before findings were filed by question, so which one they answer was never recorded.
                  </p>
                  <ul className="mt-1 space-y-2">
                    {unfiled.map((e) => (
                      <li key={e.id} className="text-sm">
                        {e.url ? (
                          <a href={e.url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-700 hover:underline">{e.citation || e.title}</a>
                        ) : (
                          <span className="text-zinc-800">{e.citation || e.title}</span>
                        )}
                        {e.siftReason && <span className="block text-xs text-zinc-600 mt-0.5">{e.siftReason}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ⚠⚠ THE SECTION THAT MAKES THIS WORTH SENDING TO A SCEPTIC. What was looked at and
            NOT used, with the reason — before they ask. */}
        {excluded.length > 0 && (
          <Section title="Considered and set aside">
            <ul className="space-y-2">
              {excluded.map((e) => (
                <li key={e.sourceKey} className="text-sm text-zinc-700">
                  {e.url ? (
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                      {e.title || e.citation || e.sourceKey}
                    </a>
                  ) : (
                    <span className="font-medium">{e.title || e.citation || e.sourceKey}</span>
                  )}
                  <span className="block text-xs text-zinc-600 mt-0.5">
                    Set aside: {e.reason?.trim() || <span className="text-amber-700">no reason recorded</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ⚠ The gaps travel with the link, not only inside the PDF. A recipient
            who never opens the file has still been told what is unestablished. */}
        <Section title="What this does not establish">
          <div className="border border-zinc-200 rounded p-4 bg-zinc-50/50">
            <p className="text-sm text-zinc-700">
              {unevidenced !== null && s.coverage
                ? `${unevidenced} of ${s.coverage.fieldsTotal} settled kernel fields carry no source in the record. `
                : ''}
              {openQuestions} question{openQuestions === 1 ? '' : 's'} or issue{openQuestions === 1 ? '' : 's'} remain open.
            </p>
            {outstanding ? (
              <>
                {/* §2b — PINNED, and said to be pinned. The agenda moves; this does not. */}
                <p className="text-xs text-zinc-600 mt-2">
                  As at version {p.versionNumber}: {outstanding.counts.openIssues} of {outstanding.counts.totalIssues} issues
                  open, {outstanding.counts.unresolvedForks} decision{outstanding.counts.unresolvedForks === 1 ? '' : 's'} not
                  settled, {outstanding.counts.declaredGaps} declared gap{outstanding.counts.declaredGaps === 1 ? '' : 's'}.
                  {' '}This is what {p.ownerName} knew was unfinished when they published it; they may have resolved some since.
                </p>
                {outstanding.declaredGaps?.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {outstanding.declaredGaps.slice(0, 8).map((g, i) => (
                      <li key={i} className="text-xs text-zinc-600">• {g.question}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : preShapeTwo ? (
              <p className="text-xs text-zinc-500 mt-2">
                This version was published before outstanding items were pinned into a version, so what was
                open at the time was never captured.
              </p>
            ) : null}
          </div>
        </Section>

        <Section title={`The documents (version ${p.versionNumber})`}>
          <div className="flex flex-wrap gap-2">
            <a className="text-xs px-3 py-1.5 rounded border border-zinc-300 hover:bg-zinc-50" href={dl('PROPOSAL_SUMMARY', 'pdf')}>Summary (PDF)</a>
            <a className="text-xs px-3 py-1.5 rounded border border-zinc-300 hover:bg-zinc-50" href={dl('PROPOSAL', 'pdf')}>Full proposal (PDF)</a>
            <a className="text-xs px-3 py-1.5 rounded border border-zinc-300 hover:bg-zinc-50" href={dl('PROPOSAL', 'docx')}>Full proposal (.docx)</a>
            <a className="text-xs px-3 py-1.5 rounded border border-zinc-300 hover:bg-zinc-50" href={dl('EVIDENCE_PACK', 'pdf')}>Evidence Pack (PDF)</a>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            These files are rendered from version {p.versionNumber} and cannot change. If {p.ownerName} keeps
            editing, this link keeps showing you version {p.versionNumber} until they publish again.
          </p>
        </Section>
      </main>
    </>
  )
}
