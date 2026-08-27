import { prisma } from '@/lib/prisma'
import { CommunityRuleError, canManageCommunity, getCommunityMembership, getRootCommunityId, getSubtreeIds } from '@/lib/community'
import { assertCanMark, recordPointsEvent, resolveTariff } from '@/lib/central-points'
// One implementation of "what picture goes with this link", shared with the
// pack output — which is a client component and cannot import this file.
import { linkThumbnail } from '@/lib/video'

export { linkThumbnail, youTubeId } from '@/lib/video'

// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL Stage 2g — Resources.
//
// The same machinery as answers wherever the behaviour is the same, on purpose:
// the vote is up/down, one per member, no self-voting, wired to the ledger at
// the same tariffs, and AI-authored material mints nothing. A member who has
// learned how the question library works has learned this.
//
// ⚠ WHAT IS DIFFERENT: a resource carries a FILE or a LINK, and both are ways to
// put somebody else's copyrighted material in front of a Community. Hence the
// recorded rights assertion, the Report action, and the type gate below.
// ─────────────────────────────────────────────────────────────────────────────

export const RESOURCE_TYPES = [
  { key: 'MEME', label: 'Meme & graphic' },
  { key: 'FLYER', label: 'Flyer & print' },
  { key: 'SOCIAL', label: 'Social post' },
  { key: 'VIDEO', label: 'Video' },
  { key: 'TRAINING', label: 'Training material' },
  { key: 'EVENT_PACK', label: 'Event pack' },
  { key: 'WEBSITE', label: 'Website & tech' },
  { key: 'MERCH', label: 'Merchandise' },
  { key: 'TEMPLATE', label: 'Document template' },
] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]['key']
export const RESOURCE_TYPE_KEYS = RESOURCE_TYPES.map((t) => t.key) as unknown as readonly ResourceType[]

/**
 * ⚠ AN ALLOW-LIST, NOT A DENY-LIST. "No executables or archives" implemented as
 * a block-list is a game of whack-a-mole: .exe, .scr, .bat, .zip, .7z, .iso,
 * .jar, .msi, .dmg, .apk, and whatever next year invents. Images and PDFs only,
 * checked against the sniffed magic bytes as well as the declared type, because
 * a client can claim any MIME it likes.
 */
export const ALLOWED_UPLOAD_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf',
] as const

export const MAX_RESOURCE_BYTES = 10 * 1024 * 1024

/** The first bytes each allowed format actually begins with. */
const MAGIC: { type: string; bytes: number[]; offset?: number }[] = [
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { type: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { type: 'image/webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
]

/**
 * What this file actually is, from its bytes — or null if it is not something we
 * accept. ⚠ The DECLARED content type is never trusted on its own: renaming
 * `payload.exe` to `poster.png` changes the declaration and not the bytes.
 */
export function sniffUploadType(buffer: Buffer): string | null {
  for (const m of MAGIC) {
    const at = m.offset ?? 0
    if (buffer.length < at + m.bytes.length) continue
    if (m.bytes.every((b, i) => buffer[at + i] === b)) return m.type
  }
  return null
}

/**
 * ⚠ A FLAT SHAPE, NOT A DISCRIMINATED UNION. This project compiles with
 * `strict: false`, under which TS does not narrow `{ok: true} | {ok: false}` on
 * `if (!check.ok)` — the caller then cannot read `.reason` at all. Flat costs a
 * nullable field and works.
 */
export type UploadCheck = { ok: boolean; type: string | null; reason: string | null }

export function checkUpload(buffer: Buffer, declaredType: string, declaredName: string): UploadCheck {
  if (buffer.length === 0) return { ok: false, type: null, reason: 'That file is empty.' }
  if (buffer.length > MAX_RESOURCE_BYTES) {
    return {
      ok: false,
      type: null,
      reason: `That file is ${(buffer.length / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_RESOURCE_BYTES / 1024 / 1024} MB.`,
    }
  }
  const sniffed = sniffUploadType(buffer)
  if (!sniffed) {
    return {
      ok: false,
      type: null,
      reason:
        `“${declaredName}” is not an image or a PDF. Images and PDFs only — ` +
        `videos and websites go in as links, and programs and archives are never accepted.`,
    }
  }
  if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(sniffed)) {
    return { ok: false, type: null, reason: `${sniffed} files are not accepted here.` }
  }
  // ⚠ THE SNIFFED TYPE WINS, ALWAYS. A declared type that disagrees with the
  // bytes is usually a renamed file; storing it under the declaration would hand
  // the browser a Content-Type the object is not.
  return { ok: true, type: sniffed, reason: null }
}

// ── links ───────────────────────────────────────────────────────────────────────

// ── reading ──────────────────────────────────────────────────────────────────

export const LIVE = { deletedAt: null } as const

export type ResourceRow = {
  id: string
  type: string
  title: string
  whyUseful: string
  context: string | null
  topicTags: string[]
  fileKey: string | null
  fileName: string | null
  fileType: string | null
  externalUrl: string | null
  thumbnailUrl: string | null
  author: { id: string; name: string | null; username: string }
  authorType: string
  aiModel: string | null
  score: number
  myVote: 'UP' | 'DOWN' | null
  approvedAt: Date | null
  approvedBy: { id: string; name: string | null; username: string } | null
  flag: { level: string; reason: string } | null
  createdAt: Date
  branchName: string | null
}

export async function listResources(
  communityId: string,
  viewerId: string,
  opts: { type?: string; topic?: string; sort?: 'top' | 'newest' } = {},
): Promise<ResourceRow[]> {
  const rootId = await getRootCommunityId(communityId)
  const visibleBranchIds = await getSubtreeIds(communityId)

  const rows = await prisma.resource.findMany({
    where: {
      communityId: rootId,
      ...LIVE,
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.topic ? { topicTags: { has: opts.topic } } : {}),
      OR: [{ scope: 'COMMUNITY' }, { scope: 'BRANCH', branchId: { in: visibleBranchIds } }],
    },
    include: {
      author: { select: { id: true, name: true, username: true } },
      approvedBy: { select: { id: true, name: true, username: true } },
      branch: { select: { name: true } },
      votes: { select: { direction: true, voteWeight: true, userId: true } },
      flags: { select: { level: true, reason: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  const mapped = rows.map((r) => {
    let score = 0
    let myVote: 'UP' | 'DOWN' | null = null
    for (const v of r.votes) {
      score += v.direction === 'UP' ? v.voteWeight : -v.voteWeight
      if (v.userId === viewerId) myVote = v.direction as 'UP' | 'DOWN'
    }
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      whyUseful: r.whyUseful,
      context: r.context,
      topicTags: r.topicTags,
      fileKey: r.fileKey,
      fileName: r.fileName,
      fileType: r.fileType,
      externalUrl: r.externalUrl,
      thumbnailUrl: r.externalUrl ? linkThumbnail(r.externalUrl) : null,
      author: r.author,
      authorType: r.authorType,
      aiModel: r.aiModel,
      score,
      myVote,
      approvedAt: r.approvedAt,
      approvedBy: r.approvedBy,
      flag: r.flags[0] ? { level: r.flags[0].level, reason: r.flags[0].reason } : null,
      createdAt: r.createdAt,
      branchName: r.branch?.name ?? null,
    }
  })

  return opts.sort === 'newest'
    ? mapped.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    : mapped.sort((a, b) => b.score - a.score || b.createdAt.getTime() - a.createdAt.getTime())
}

// ── writing ──────────────────────────────────────────────────────────────────

export async function createResource(params: {
  communityId: string
  authorId: string
  type: string
  title: string
  whyUseful: string
  context?: string
  topicTags?: string[]
  scope?: 'COMMUNITY' | 'BRANCH'
  file?: { key: string; name: string; type: string; size: number }
  externalUrl?: string
  rightsConfirmed: boolean
}) {
  const rootId = await getRootCommunityId(params.communityId)
  if (!(await getCommunityMembership(params.authorId, rootId))) {
    throw new CommunityRuleError('Not found', 404)
  }
  if (!(RESOURCE_TYPE_KEYS as readonly string[]).includes(params.type)) {
    throw new CommunityRuleError('Choose what kind of resource this is', 422)
  }
  if (!params.title.trim()) throw new CommunityRuleError('Give it a title', 422)
  if (!params.whyUseful.trim()) {
    throw new CommunityRuleError(
      'Say why it is worth using — that note is what makes this tab worth browsing',
      422,
    )
  }
  if (!params.file && !params.externalUrl?.trim()) {
    throw new CommunityRuleError('Attach a file or paste a link', 422)
  }

  // ⚠ THE COPYRIGHT ASSERTION IS A HARD GATE, not a nudge. Without it the
  // platform is hosting other people's material on nobody's word.
  if (!params.rightsConfirmed) {
    throw new CommunityRuleError(
      'Confirm you have the right to share this before uploading it',
      422,
    )
  }

  const standingOn = await prisma.community.findUnique({
    where: { id: params.communityId },
    select: { id: true, parentCommunityId: true },
  })
  const branchId = standingOn?.parentCommunityId ? standingOn.id : null

  return prisma.resource.create({
    data: {
      communityId: rootId,
      branchId,
      authorId: params.authorId,
      type: params.type,
      title: params.title.trim().slice(0, 200),
      whyUseful: params.whyUseful.trim(),
      context: params.context?.trim() || null,
      topicTags: params.topicTags ?? [],
      scope: params.scope === 'BRANCH' && branchId ? 'BRANCH' : 'COMMUNITY',
      fileKey: params.file?.key ?? null,
      fileName: params.file?.name ?? null,
      fileType: params.file?.type ?? null,
      fileSize: params.file?.size ?? null,
      externalUrl: params.externalUrl?.trim() || null,
      rightsConfirmedByUserId: params.authorId,
      rightsConfirmedAt: new Date(),
    },
  })
}

/**
 * Up or down, one per member, no self-voting, wired to the ledger at the same
 * tariffs as an answer — and an AI-authored resource ranks but mints nothing.
 * The rules are the answer's rules; only `sourceType` differs.
 */
export async function applyResourceVote(
  resourceId: string,
  voterUserId: string,
  direction: 'UP' | 'DOWN',
): Promise<{ myVote: 'UP' | 'DOWN' | null; score: number; authorPoints: number; minted: boolean }> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: { id: true, authorId: true, authorType: true, communityId: true, deletedAt: true },
  })
  if (!resource) throw new CommunityRuleError('Resource not found', 404)
  if (resource.deletedAt) throw new CommunityRuleError('That resource has been removed', 404)
  if (resource.authorId === voterUserId) {
    throw new CommunityRuleError('You cannot vote on your own resource', 403)
  }

  const mints = resource.authorType !== 'AI'
  if (mints) await assertCanMark(voterUserId, { authorId: resource.authorId, id: resource.id }, 'post')

  const existing = await prisma.resourceVote.findUnique({
    where: { resourceId_userId: { resourceId, userId: voterUserId } },
  })
  const previous = (existing?.direction as 'UP' | 'DOWN' | undefined) ?? null

  let myVote: 'UP' | 'DOWN' | null = direction
  if (existing && existing.direction === direction) {
    await prisma.resourceVote.delete({ where: { id: existing.id } })
    myVote = null
  } else if (existing) {
    await prisma.resourceVote.update({ where: { id: existing.id }, data: { direction } })
  } else {
    await prisma.resourceVote.create({ data: { resourceId, userId: voterUserId, direction } })
  }

  if (mints) {
    const rootId = await getRootCommunityId(resource.communityId)
    if (previous) {
      const original = await prisma.pointsEvent.findFirst({
        where: {
          sourceType: 'RESOURCE_VOTE', sourceId: resource.id,
          actorUserId: voterUserId, type: 'MARK_RECEIVED',
        },
        orderBy: { createdAt: 'desc' },
      })
      if (original) {
        await recordPointsEvent({
          userId: resource.authorId, communityId: rootId, sourceCommunityId: resource.communityId,
          type: 'MARK_REMOVED', points: -original.points,
          sourceType: 'RESOURCE_VOTE', sourceId: resource.id, actorUserId: voterUserId,
          tariff: { id: original.tariffId, actionKey: original.tariffKey, points: original.tariffPoints },
        })
      }
    }
    if (myVote) {
      const tariff = await resolveTariff(myVote === 'UP' ? 'MARK_CONSTRUCTIVE' : 'MARK_UNCONSTRUCTIVE')
      await recordPointsEvent({
        userId: resource.authorId, communityId: rootId, sourceCommunityId: resource.communityId,
        type: 'MARK_RECEIVED', points: tariff.points,
        sourceType: 'RESOURCE_VOTE', sourceId: resource.id, actorUserId: voterUserId, tariff,
      })
    }
  }

  const votes = await prisma.resourceVote.findMany({
    where: { resourceId }, select: { direction: true, voteWeight: true },
  })
  const score = votes.reduce((s, v) => s + (v.direction === 'UP' ? v.voteWeight : -v.voteWeight), 0)
  const { getUserPoints } = await import('@/lib/central-points')
  return {
    myVote,
    score,
    authorPoints: await getUserPoints(resource.authorId, await getRootCommunityId(resource.communityId)),
    minted: mints,
  }
}

/** Flag a resource. Managers only; the reason is required, as for answers. */
export async function setResourceFlag(params: {
  resourceId: string
  userId: string
  level: 'DO_NOT_USE' | 'USE_WITH_CARE'
  reason: string
}) {
  if (!params.reason.trim()) throw new CommunityRuleError('A flag needs a reason', 422)
  const resource = await prisma.resource.findUnique({
    where: { id: params.resourceId },
    select: { communityId: true },
  })
  if (!resource) throw new CommunityRuleError('Resource not found', 404)
  if (!(await canManageCommunity(params.userId, resource.communityId))) {
    throw new CommunityRuleError('Only branch managers and Community admins can flag resources', 403)
  }
  return prisma.resourceFlag.upsert({
    where: { resourceId: params.resourceId },
    create: {
      resourceId: params.resourceId, level: params.level,
      reason: params.reason.trim(), setByUserId: params.userId,
    },
    update: {
      level: params.level, reason: params.reason.trim(),
      setByUserId: params.userId, setAt: new Date(),
    },
  })
}

/** Report a resource. Any member; it routes to the Community admins. */
export async function reportResource(params: {
  resourceId: string
  userId: string
  reason: string
}) {
  if (!params.reason.trim()) throw new CommunityRuleError('Say what is wrong with it', 422)
  const resource = await prisma.resource.findUnique({
    where: { id: params.resourceId },
    select: { id: true, title: true, communityId: true },
  })
  if (!resource) throw new CommunityRuleError('Resource not found', 404)

  const report = await prisma.resourceReport.create({
    data: {
      resourceId: resource.id,
      reportedByUserId: params.userId,
      reason: params.reason.trim(),
    },
  })

  const admins = await prisma.communityMember.findMany({
    where: { communityId: resource.communityId, role: { in: ['OWNER', 'ADMIN'] } },
    select: { userId: true },
  })
  for (const a of admins) {
    await prisma.notification.create({
      data: {
        userId: a.userId,
        type: 'SYSTEM',
        title: 'A resource has been reported',
        message: `“${resource.title}” — ${params.reason.trim()}`,
        linkUrl: `/communities/${resource.communityId}?tab=resources&resource=${resource.id}`,
      },
    })
  }
  return report
}
