// ─────────────────────────────────────────────────────────────────────────────
// Sprint 20-D §2 — VERSIONING AND PUBLICATION.
//
// Built BEFORE the document, not after: a document that cannot be pinned to a
// version cannot be reviewed (§24.4), and retrofitting versioning is the
// expensive order.
//
// Three rules, and each one is asserted by `check:20bd` rather than trusted:
//
//   1. APPEND-ONLY. There is no update path here. A change makes the next
//      version; the unique (ideaId, versionNumber) makes a second write of the
//      same number fail loudly rather than overwrite.
//   2. AN UNCHANGED PROPOSAL DOES NOT MINT A VERSION. The content hash is
//      compared against the LATEST version only — reverting an edit legitimately
//      reproduces an older hash and must still be recordable.
//   3. A SHARED LINK RESOLVES TO THE VERSION THAT WAS SHARED. `Idea
//      .publishedProposalVersionId` is the pin, and the resolver reads it and
//      never "the latest". That one line is the whole promise: the recipient's
//      link does not shift under them while the owner keeps editing.
//
// ⚠ §20.7 — COMMUNITY GRANTS A READ ON A PUBLISHED VERSION AND NOTHING MORE.
// Community membership must never confer access to the working proposal. That
// holds structurally, because the working proposal is reached only through
// `authorizeIdea`, which consults the owner and IdeaCollaborator and has no idea
// communities exist. The assertion is here anyway (`sharesCommunityWithOwner` is
// the only function in the codebase that reads CommunityMember for an idea) so
// that a future edit which breaks it breaks a named check.
// ─────────────────────────────────────────────────────────────────────────────

import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import {
  buildProposalSnapshot,
  snapshotHash,
  stableStringify,
  SnapshotUnavailableError,
  type ProposalSnapshot,
} from './proposal-snapshot'

export type ProposalVisibility = 'PRIVATE' | 'LINK' | 'COMMUNITY' | 'PUBLIC'

export interface VersionRecord {
  id: string
  versionNumber: number
  contentHash: string
  createdAt: string
  createdBy: string
  changeNote: string | null
  /** True when this is the version a share link currently resolves to. */
  published: boolean
}

export interface MintResult {
  version: VersionRecord
  /** FALSE when the proposal was unchanged and the existing version was reused. */
  created: boolean
  snapshot: ProposalSnapshot
}

/** A share token that is not guessable and not an id anyone can enumerate. */
function mintShareToken(): string {
  return randomBytes(24).toString('base64url')
}

function toRecord(
  row: { id: string; versionNumber: number; contentHash: string; createdAt: Date; createdBy: string; changeNote: string | null },
  publishedId: string | null,
): VersionRecord {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    contentHash: row.contentHash,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    changeNote: row.changeNote,
    published: publishedId === row.id,
  }
}

export async function listVersions(ideaId: string): Promise<VersionRecord[]> {
  const [rows, idea] = await Promise.all([
    prisma.proposalVersion.findMany({
      where: { ideaId },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, contentHash: true, createdAt: true, createdBy: true, changeNote: true },
    }),
    prisma.idea.findUnique({ where: { id: ideaId }, select: { publishedProposalVersionId: true } }),
  ])
  return rows.map((r) => toRecord(r, idea?.publishedProposalVersionId ?? null))
}

/**
 * ⚠ WHAT CHANGED, COMPUTED — NOT ASSERTED, AND NOT WRITTEN BY A MODEL.
 *
 * §2 wants `changeNote` so that §24's "12 of 14 findings resolved since" can be
 * COMPUTED. So this counts. Every number here is a difference between two stored
 * snapshots; there is no model call and there must never be one, or the change
 * note becomes another claim needing a source.
 *
 * Returns null when nothing countable moved — a null note is honest, whereas
 * "minor changes" would be a sentence nobody checked.
 */
export function describeChange(prev: ProposalSnapshot | null, next: ProposalSnapshot): string | null {
  if (!prev) return 'First version.'

  const parts: string[] = []

  const countAccepted = (s: ProposalSnapshot) => s.fields.filter((f) => f.status === 'ACCEPTED').length
  const df = countAccepted(next) - countAccepted(prev)
  if (df !== 0) parts.push(`${df > 0 ? '+' : ''}${df} kernel field${Math.abs(df) === 1 ? '' : 's'} settled`)

  // ⚠ `stableStringify`, NOT `JSON.stringify`. `prev` is almost always a snapshot
  // read back out of a `jsonb` column, and Postgres stores object keys sorted by
  // length then bytewise — so a structured field's keys come back in a different
  // order than they went in. The first live run reported TWO fields edited when
  // one had been touched, because `{affectedGroups, impact, cost}` returned as
  // `{cost, impact, affectedGroups}`. A change note that invents an edit is the
  // same failure class as a figure with no basis: a true-looking sentence nobody
  // can check.
  const changedFields = next.fields.filter((f) => {
    const before = prev.fields.find((p) => p.key === f.key)
    return before && stableStringify(before.value) !== stableStringify(f.value)
  })
  if (changedFields.length) {
    parts.push(`${changedFields.length} field${changedFields.length === 1 ? '' : 's'} edited (${changedFields.map((f) => f.label).join(', ')})`)
  }

  const de = next.evidence.length - prev.evidence.length
  if (de !== 0) parts.push(`${de > 0 ? '+' : ''}${de} accepted finding${Math.abs(de) === 1 ? '' : 's'}`)

  // The §24.4 sentence, in the form §24 wants to read it.
  const openBefore = prev.issues.filter((i) => i.status === 'OPEN').length
  const openNow = next.issues.filter((i) => i.status === 'OPEN').length
  const totalNow = next.issues.length
  if (openBefore !== openNow && totalNow > 0) {
    parts.push(`${totalNow - openNow} of ${totalNow} issues resolved (was ${totalNow - openBefore})`)
  }

  const da = next.actions.length - prev.actions.length
  if (da !== 0) parts.push(`${da > 0 ? '+' : ''}${da} action${Math.abs(da) === 1 ? '' : 's'}`)

  const dForks = prev.forks.open.length - next.forks.open.length
  if (dForks > 0) parts.push(`${dForks} fork${dForks === 1 ? '' : 's'} resolved`)

  const dUnknown = next.knownUnknowns.length - prev.knownUnknowns.length
  if (dUnknown !== 0) parts.push(`${dUnknown > 0 ? '+' : ''}${dUnknown} known unknown${Math.abs(dUnknown) === 1 ? '' : 's'}`)

  return parts.length ? parts.join('; ') : null
}

/**
 * Mint the next version from live state, or reuse the latest when nothing changed.
 *
 * `userNote`, where given, is the user's own words and is kept ALONGSIDE the
 * computed one rather than replacing it — the computed half is checkable and the
 * user's half is why.
 */
export async function mintVersion(
  ideaId: string,
  userId: string,
  opts: { userNote?: string | null; force?: boolean } = {},
): Promise<MintResult> {
  const snapshot = await buildProposalSnapshot(ideaId)
  const hash = snapshotHash(snapshot)

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { publishedProposalVersionId: true },
  })

  const latest = await prisma.proposalVersion.findFirst({
    where: { ideaId },
    orderBy: { versionNumber: 'desc' },
    select: { id: true, versionNumber: true, contentHash: true, createdAt: true, createdBy: true, changeNote: true, snapshot: true },
  })

  if (latest && latest.contentHash === hash && !opts.force) {
    // ⚠ Nothing changed. Returning the existing version rather than a new one is
    // the acceptance criterion; `created: false` is what the caller reports, so a
    // user pressing Publish twice is told "unchanged", not shown a phantom v4.
    return { version: toRecord(latest, idea?.publishedProposalVersionId ?? null), created: false, snapshot }
  }

  const computed = describeChange(
    latest ? (latest.snapshot as unknown as ProposalSnapshot) : null,
    snapshot,
  )
  const note = [opts.userNote?.trim() || null, computed]
    .filter(Boolean)
    .join(' — ') || null

  const nextNumber = (latest?.versionNumber ?? 0) + 1
  const created = await prisma.proposalVersion.create({
    data: {
      ideaId,
      versionNumber: nextNumber,
      contentHash: hash,
      snapshot: snapshot as unknown as object,
      createdBy: userId,
      changeNote: note,
    },
    select: { id: true, versionNumber: true, contentHash: true, createdAt: true, createdBy: true, changeNote: true },
  })

  return { version: toRecord(created, idea?.publishedProposalVersionId ?? null), created: true, snapshot }
}

export interface PublicationState {
  visibility: ProposalVisibility
  publishedVersion: VersionRecord | null
  publishedAt: string | null
  /** Absolute path, not a full URL — the host differs between preview and production. */
  sharePath: string | null
  versionCount: number
  /** The live proposal differs from the published version, so recipients see older content. */
  liveDiffersFromPublished: boolean
}

export async function readPublicationState(ideaId: string): Promise<PublicationState> {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: {
      proposalVisibility: true,
      proposalPublishedAt: true,
      proposalShareToken: true,
      publishedProposalVersionId: true,
      publishedProposalVersion: {
        select: { id: true, versionNumber: true, contentHash: true, createdAt: true, createdBy: true, changeNote: true },
      },
    },
  })
  if (!idea) throw new SnapshotUnavailableError('That idea no longer exists.')

  const versionCount = await prisma.proposalVersion.count({ where: { ideaId } })

  let liveDiffers = false
  if (idea.publishedProposalVersion) {
    try {
      liveDiffers = snapshotHash(await buildProposalSnapshot(ideaId)) !== idea.publishedProposalVersion.contentHash
    } catch {
      // We cannot prove the published version matches the live state, so we say it
      // does not — the same "unknown is not the same as current" rule the briefing
      // export uses for its fingerprint.
      liveDiffers = true
    }
  }

  return {
    visibility: idea.proposalVisibility as ProposalVisibility,
    publishedVersion: idea.publishedProposalVersion
      ? toRecord(idea.publishedProposalVersion, idea.publishedProposalVersionId)
      : null,
    publishedAt: idea.proposalPublishedAt ? idea.proposalPublishedAt.toISOString() : null,
    // The path is only offered once there is something behind it AND it is visible.
    sharePath:
      idea.proposalShareToken && idea.proposalVisibility !== 'PRIVATE'
        ? `/proposals/${idea.proposalShareToken}`
        : null,
    versionCount,
    liveDiffersFromPublished: liveDiffers,
  }
}

/**
 * Publish: mint (or reuse) a version, PIN it, and set the visibility.
 *
 * ⚠ Publishing is EXPLICIT — nothing here is triggered by an edit; REVERSIBLE —
 * `unpublishProposal` puts it back without destroying the version; and PINNED —
 * the pin is written here and read nowhere else but the resolver.
 */
export async function publishProposal(
  ideaId: string,
  userId: string,
  visibility: Exclude<ProposalVisibility, 'PRIVATE'>,
  opts: { userNote?: string | null } = {},
): Promise<PublicationState> {
  const { version } = await mintVersion(ideaId, userId, { userNote: opts.userNote })

  const existing = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { proposalShareToken: true },
  })

  await prisma.idea.update({
    where: { id: ideaId },
    data: {
      proposalVisibility: visibility,
      publishedProposalVersionId: version.id,
      proposalPublishedAt: new Date(),
      // ⚠ The token is minted ONCE and kept. Rotating it on every publish would
      // silently break a link already sitting in an MP's inbox, which is the
      // failure this whole feature exists to avoid.
      proposalShareToken: existing?.proposalShareToken ?? mintShareToken(),
    },
  })

  return readPublicationState(ideaId)
}

/**
 * Unpublish. The version and the token both survive: republishing to the same
 * link must be possible, and deleting the version would delete the record of what
 * a recipient was given.
 */
export async function unpublishProposal(ideaId: string): Promise<PublicationState> {
  await prisma.idea.update({
    where: { id: ideaId },
    data: { proposalVisibility: 'PRIVATE' },
  })
  return readPublicationState(ideaId)
}

// ── the share resolver ───────────────────────────────────────────────────────

export interface ResolvedProposal {
  ideaId: string
  title: string
  ownerName: string
  visibility: ProposalVisibility
  versionNumber: number
  versionId: string
  publishedAt: string | null
  changeNote: string | null
  snapshot: ProposalSnapshot
}

export type ResolveReason = 'ok' | 'not_found' | 'unpublished' | 'sign_in_required' | 'not_in_community'

/**
 * ⚠ ONE INTERFACE, NOT A DISCRIMINATED UNION. This package compiles with
 * `strict: false`, under which boolean-literal discriminants do not narrow — a
 * `{ ok: true } | { ok: false; reason }` union type-errors at every call site
 * that reads `reason`. Found by compiling it, not by reasoning about it.
 */
export interface ResolveOutcome {
  ok: boolean
  reason: ResolveReason
  /** Null whenever `ok` is false. */
  proposal: ResolvedProposal | null
}

/**
 * ⚠ THE ONE FUNCTION IN THE CODEBASE THAT READS `CommunityMember` FOR AN IDEA.
 *
 * §20.7's boundary is that community membership is a READ GRANT ON A PUBLISHED
 * VERSION and never anything more. Keeping the community read in exactly one
 * place, on exactly one object (a published version, already materialised), is
 * what makes the boundary auditable: any other path to idea state goes through
 * `authorizeIdea`, which does not know communities exist.
 *
 * The grant is "you share a community with the owner" — §20.3's "visible within
 * Scrutinise Central communities the user belongs to".
 */
async function sharesCommunityWithOwner(ownerId: string, readerId: string): Promise<boolean> {
  if (ownerId === readerId) return true
  const shared = await prisma.communityMember.findFirst({
    where: {
      userId: readerId,
      community: { members: { some: { userId: ownerId } } },
    },
    select: { id: true },
  })
  return Boolean(shared)
}

/**
 * Resolve a share token to THE VERSION THAT WAS SHARED.
 *
 * ⚠ It reads `publishedProposalVersion`, never `orderBy versionNumber desc`. If
 * this ever becomes "the latest", the promise in §20.3 is silently broken and
 * every existing recipient's document changes under them with no notice. The
 * check plants a v2 after publishing v1 and asserts this returns v1.
 */
export async function resolveSharedProposal(
  token: string,
  readerUserId: string | null,
): Promise<ResolveOutcome> {
  const idea = await prisma.idea.findUnique({
    where: { proposalShareToken: token },
    select: {
      id: true,
      title: true,
      creatorId: true,
      deletedAt: true,
      proposalVisibility: true,
      proposalPublishedAt: true,
      creator: { select: { preferredName: true, name: true } },
      publishedProposalVersion: {
        select: { id: true, versionNumber: true, snapshot: true, changeNote: true },
      },
    },
  })

  if (!idea || idea.deletedAt) return { ok: false, reason: 'not_found', proposal: null }
  // Unpublished is told apart from missing for the OWNER's benefit only; to any
  // other caller both are refusals with no detail beyond the reason word.
  if (idea.proposalVisibility === 'PRIVATE') return { ok: false, reason: 'unpublished', proposal: null }
  if (!idea.publishedProposalVersion) return { ok: false, reason: 'unpublished', proposal: null }

  if (idea.proposalVisibility === 'COMMUNITY') {
    if (!readerUserId) return { ok: false, reason: 'sign_in_required', proposal: null }
    if (!(await sharesCommunityWithOwner(idea.creatorId, readerUserId))) {
      return { ok: false, reason: 'not_in_community', proposal: null }
    }
  }

  return {
    ok: true,
    reason: 'ok',
    proposal: {
      ideaId: idea.id,
      title: idea.title,
      ownerName: idea.creator.preferredName || idea.creator.name,
      visibility: idea.proposalVisibility as ProposalVisibility,
      versionNumber: idea.publishedProposalVersion.versionNumber,
      versionId: idea.publishedProposalVersion.id,
      publishedAt: idea.proposalPublishedAt ? idea.proposalPublishedAt.toISOString() : null,
      changeNote: idea.publishedProposalVersion.changeNote,
      snapshot: idea.publishedProposalVersion.snapshot as unknown as ProposalSnapshot,
    },
  }
}
