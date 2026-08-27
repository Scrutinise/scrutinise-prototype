import { prisma } from '@/lib/prisma'
import { CommunityRuleError, canManageCommunity, getRootCommunityId } from '@/lib/community'
// The four modes, and the one function that decides them. Shared with the client
// controls, which cannot import this file — see lib/approval-rule.ts.
import {
  APPROVAL_MODES, APPROVAL_MODE_LABELS, canApproveWith,
  type ApprovalMode, type ApproverCaps,
} from '@/lib/approval-rule'

export { APPROVAL_MODES, APPROVAL_MODE_LABELS }
export type { ApprovalMode, ApproverCaps } from '@/lib/approval-rule'

// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL items 12 + 13 — what "approved" means, and who may say it.
//
// ⚠ GENERIC PLATFORM MACHINERY. Nothing party-specific is hard-coded anywhere in
// this file. Reform UK's name and colour are a seeded ROW in CommunitySettings,
// so a second Community sets its own without a deploy.
//
// ⚠ THE NAME OF WHOEVER MARKED IT IS ALWAYS SHOWN. Under mode SELF the stamp is
// the poster's own claim about their own material; rendering an unverified
// self-tick as a bare organisational endorsement would put the organisation's
// name on something it has never seen. So the display is
// "{Organisation} approved — marked by {name}", in every mode, without exception.
//
// ⚠ HIDING THE FEATURE NEVER DELETES DATA. `approvalFeatureEnabled: false`
// removes the name, the frame and the superscript from display; the
// approvedBy/approvedAt columns are untouched, so re-enabling restores exactly
// what was there.
// ─────────────────────────────────────────────────────────────────────────────

export type CommunityBranding = {
  communityId: string
  organisationName: string | null
  organisationColour: string | null
  approvalFeatureEnabled: boolean
  approvalMode: ApprovalMode
  namedApproverIds: string[]
}

/** The defaults a Community that has never opened its settings behaves as. */
const DEFAULTS = {
  organisationName: null,
  organisationColour: null,
  approvalFeatureEnabled: true,
  approvalMode: 'SELF' as ApprovalMode,
}

export async function getCommunityBranding(communityId: string): Promise<CommunityBranding> {
  const rootId = await getRootCommunityId(communityId)
  const [settings, named] = await Promise.all([
    prisma.communitySettings.findUnique({ where: { communityId: rootId } }),
    prisma.communityApprover.findMany({ where: { communityId: rootId }, select: { userId: true } }),
  ])
  return {
    communityId: rootId,
    organisationName: settings?.organisationName ?? DEFAULTS.organisationName,
    organisationColour: settings?.organisationColour ?? DEFAULTS.organisationColour,
    approvalFeatureEnabled: settings?.approvalFeatureEnabled ?? DEFAULTS.approvalFeatureEnabled,
    approvalMode: (settings?.approvalMode as ApprovalMode) ?? DEFAULTS.approvalMode,
    namedApproverIds: named.map((n) => n.userId),
  }
}

/**
 * May this user put the organisation's name on this item?
 *
 * `authorId` matters only in SELF mode, where the answer is "yes, on your own".
 * Every mode also requires the feature to be on — an approval control that
 * appears while the display is hidden would let people mark things that nothing
 * ever shows.
 */
export async function canApprove(params: {
  userId: string
  communityId: string
  authorId: string
}): Promise<boolean> {
  const branding = await getCommunityBranding(params.communityId)
  return canApproveWith({
    mode: branding.approvalMode,
    featureEnabled: branding.approvalFeatureEnabled,
    caps: await resolveApproverCaps(params.userId, params.communityId, branding),
    authorId: params.authorId,
  })
}

/**
 * Turn a user and a node into the four booleans the rule needs. Two queries at
 * most, and only when the mode actually depends on them.
 */
export async function resolveApproverCaps(
  userId: string,
  communityId: string,
  branding?: CommunityBranding,
): Promise<ApproverCaps> {
  const b = branding ?? (await getCommunityBranding(communityId))
  const needsBranch = b.approvalMode === 'BRANCH_ADMIN'
  const needsCommunity = b.approvalMode === 'COMMUNITY_ADMIN'
  return {
    viewerId: userId,
    canManageBranch: needsBranch ? await canManageCommunity(userId, communityId) : false,
    canManageCommunity: needsCommunity ? await canManageCommunity(userId, b.communityId) : false,
    isNamed: b.namedApproverIds.includes(userId),
  }
}

/** The refusal, in words, so a route never has to invent one. */
export async function assertMayApprove(params: {
  userId: string
  communityId: string
  authorId: string
}): Promise<void> {
  if (await canApprove(params)) return
  const branding = await getCommunityBranding(params.communityId)
  if (!branding.approvalFeatureEnabled) {
    throw new CommunityRuleError('Approval is switched off for this Community', 409)
  }
  throw new CommunityRuleError(
    `Approval here is set to: ${APPROVAL_MODE_LABELS[branding.approvalMode].toLowerCase()}`,
    403,
  )
}

export type ApprovalStamp = {
  /** Whether to render anything at all. False when the feature is hidden. */
  visible: boolean
  approved: boolean
  organisationName: string | null
  organisationColour: string | null
  /** Always populated when approved — see the note at the top of this file. */
  markedByName: string | null
  approvedAt: Date | null
}

/**
 * What a surface should render for one item.
 *
 * ⚠ ONE FUNCTION, so the library list, the detail view, the pack and the
 * resource card cannot disagree about whether something is approved or about
 * whose claim it is.
 */
export function approvalStampFor(
  item: { approvedAt: Date | null; approvedBy?: { name: string | null; username: string } | null },
  branding: CommunityBranding,
): ApprovalStamp {
  const visible = branding.approvalFeatureEnabled && Boolean(branding.organisationName)
  return {
    visible,
    approved: item.approvedAt !== null,
    organisationName: visible ? branding.organisationName : null,
    organisationColour: visible ? branding.organisationColour : null,
    markedByName: item.approvedBy ? (item.approvedBy.name ?? item.approvedBy.username) : null,
    approvedAt: item.approvedAt,
  }
}

/** Settings are a Community-root concern; a branch admin does not set them. */
export async function updateCommunitySettings(params: {
  communityId: string
  actorUserId: string
  organisationName?: string | null
  organisationColour?: string | null
  approvalFeatureEnabled?: boolean
  approvalMode?: ApprovalMode
  namedApproverIds?: string[]
}) {
  const rootId = await getRootCommunityId(params.communityId)
  if (!(await canManageCommunity(params.actorUserId, rootId))) {
    throw new CommunityRuleError('Only Community admins can change these settings', 403)
  }
  if (params.organisationColour && !/^#[0-9a-fA-F]{6}$/.test(params.organisationColour)) {
    throw new CommunityRuleError('The colour needs to be a six-digit hex value, like #17B9D1', 422)
  }
  if (params.approvalMode && !APPROVAL_MODES.includes(params.approvalMode)) {
    throw new CommunityRuleError('Unknown approval mode', 422)
  }

  const data = {
    ...(params.organisationName !== undefined && { organisationName: params.organisationName?.trim() || null }),
    ...(params.organisationColour !== undefined && { organisationColour: params.organisationColour || null }),
    ...(params.approvalFeatureEnabled !== undefined && { approvalFeatureEnabled: params.approvalFeatureEnabled }),
    ...(params.approvalMode !== undefined && { approvalMode: params.approvalMode }),
  }
  const settings = await prisma.communitySettings.upsert({
    where: { communityId: rootId },
    create: { communityId: rootId, ...DEFAULTS, ...data },
    update: data,
  })

  if (params.namedApproverIds) {
    // Replace the set wholesale — a picker submits the whole list, and diffing
    // it here would silently keep somebody the admin had just unticked.
    await prisma.communityApprover.deleteMany({ where: { communityId: rootId } })
    if (params.namedApproverIds.length) {
      await prisma.communityApprover.createMany({
        data: params.namedApproverIds.map((userId) => ({ communityId: rootId, userId })),
        skipDuplicates: true,
      })
    }
  }

  return settings
}

// ── marking things approved ──────────────────────────────────────────────────

/**
 * Set or clear the approval stamp on one item.
 *
 * ⚠ ONE FUNCTION FOR BOTH KINDS. An answer and a resource carry the same three
 * columns and the same rule, so they share the write path; the only difference
 * is which table is touched. Two copies of this would drift the day one of them
 * gained a check the other did not.
 *
 * ⚠ CLEARING IS ALSO GATED. "Unapprove" removes the organisation's name from
 * something, which is exactly as consequential as putting it there, so it needs
 * the same right — a member cannot quietly strip a branch admin's mark.
 */
export async function setApproval(params: {
  kind: 'answer' | 'resource'
  itemId: string
  userId: string
  approved: boolean
}): Promise<{ approvedAt: Date | null; markedByName: string | null }> {
  // ⚠ An Answer carries no communityId of its own — it reaches its Community
  // through its Question. Reading `answer.communityId` compiles to undefined in
  // JS and would silently resolve the branding of the ROOT of nothing.
  const item =
    params.kind === 'answer'
      ? await prisma.answer
          .findUnique({
            where: { id: params.itemId },
            select: {
              id: true,
              authorId: true,
              deletedAt: true,
              question: { select: { communityId: true } },
            },
          })
          .then((a) => (a ? { ...a, communityId: a.question.communityId } : null))
      : await prisma.resource.findUnique({
          where: { id: params.itemId },
          select: { id: true, authorId: true, communityId: true, deletedAt: true },
        })

  if (!item || item.deletedAt) throw new CommunityRuleError('Not found', 404)

  await assertMayApprove({
    userId: params.userId,
    communityId: item.communityId,
    authorId: item.authorId,
  })

  const data = params.approved
    ? { approvedByUserId: params.userId, approvedAt: new Date() }
    : { approvedByUserId: null, approvedAt: null }

  const updated =
    params.kind === 'answer'
      ? await prisma.answer.update({
          where: { id: params.itemId },
          data,
          select: { approvedAt: true, approvedBy: { select: { name: true, username: true } } },
        })
      : await prisma.resource.update({
          where: { id: params.itemId },
          data,
          select: { approvedAt: true, approvedBy: { select: { name: true, username: true } } },
        })

  return {
    approvedAt: updated.approvedAt,
    markedByName: updated.approvedBy ? (updated.approvedBy.name ?? updated.approvedBy.username) : null,
  }
}
