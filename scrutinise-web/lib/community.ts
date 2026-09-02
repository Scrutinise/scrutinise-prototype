import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { sendCommunityInviteEmail } from '@/lib/email'

/**
 * Default bulletin-board category set, in display order (Stage 1.1, agreed
 * 6 Aug 2026 after the Stage 1 user test). "Announcements" was removed.
 *
 * Seeded onto `Community.bulletinCategories` at creation so a per-Community
 * set exists from day one; there is deliberately NO admin category-management
 * UI at this stage — defaults only.
 */
export const DEFAULT_BULLETIN_CATEGORIES = [
  'Canvassing',
  'Building Members',
  'Public Debates',
  'Training',
  'Running Councils',
  'Questions',
] as const

/**
 * One-line prompts shown under the category picker. "Training" carries its
 * description because it IS the Stage 2c training-marketplace workaround
 * (docs/SCRUTINISE_CENTRAL_SPEC.md §6) — the wording is what makes people use
 * it for that without being told.
 */
export const BULLETIN_CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Canvassing: 'Doorstep and street campaigning — plans, patches, what worked.',
  'Building Members': 'Recruiting and keeping members.',
  'Public Debates': 'Hustings, panels and public argument.',
  Training: 'Offer or request interview/media training here.',
  'Running Councils': 'Running a council group, motions and local administration.',
  Questions: 'Anything else — ask the Community.',
}

/** Post reach, set by the composer's "Post to" selector. */
export const BULLETIN_SCOPES = ['BRANCH', 'COMMUNITY'] as const
export type BulletinScope = (typeof BULLETIN_SCOPES)[number]

/** Category set for a Community, falling back to the defaults if unseeded. */
export function categoriesFor(community: { bulletinCategories: string[] }): string[] {
  return community.bulletinCategories.length > 0
    ? community.bulletinCategories
    : [...DEFAULT_BULLETIN_CATEGORIES]
}

export type CommunityRole = 'OWNER' | 'ADMIN' | 'MEMBER'
const ADMIN_ROLES: CommunityRole[] = ['OWNER', 'ADMIN']

/** Membership row for (userId, communityId), or null if not a member. */
export async function getCommunityMembership(userId: string, communityId: string) {
  return prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
  })
}

/**
 * Loads the membership and returns a 403/404 NextResponse if the caller isn't
 * at least the given role — 404 (not 403) when the caller isn't a member at
 * all, so membership itself isn't leaked to non-members.
 */
export async function requireCommunityRole(
  userId: string,
  communityId: string,
  roles: CommunityRole[] = ADMIN_ROLES,
): Promise<{ error: NextResponse; membership: null } | { error: null; membership: NonNullable<Awaited<ReturnType<typeof getCommunityMembership>>> }> {
  const membership = await getCommunityMembership(userId, communityId)
  if (!membership) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }), membership: null }
  }
  if (!roles.includes(membership.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), membership: null }
  }
  return { error: null, membership }
}

/** Ancestor chain for a node, nearest parent first (excludes the node itself). */
export async function getAncestorIds(communityId: string): Promise<string[]> {
  const ids: string[] = []
  let cursor = await prisma.community.findUnique({
    where: { id: communityId },
    select: { parentCommunityId: true },
  })
  // Depth is small at Central scale, and the guard stops a cycle from hanging
  // the request if a parent pointer is ever corrupted.
  let guard = 0
  while (cursor?.parentCommunityId && guard++ < 50) {
    const parentId: string = cursor.parentCommunityId
    ids.push(parentId)
    cursor = await prisma.community.findUnique({
      where: { id: parentId },
      select: { parentCommunityId: true },
    })
  }
  return ids
}

/** Root of the Community tree this node belongs to (itself, if top-level). */
export async function getRootCommunityId(communityId: string): Promise<string> {
  const ancestors = await getAncestorIds(communityId)
  return ancestors.length > 0 ? ancestors[ancestors.length - 1] : communityId
}

/** Every node id in the Community tree containing `communityId`, root included. */
export async function getCommunityTreeIds(communityId: string): Promise<string[]> {
  return getSubtreeIds(await getRootCommunityId(communityId))
}

/**
 * The `where` a board at `communityId` renders: its own posts, plus every
 * Community-wide post from anywhere in the same tree (Stage 1.1 display rule —
 * without this a whole-Community post would only ever be seen at the node it
 * was written on, and the "Post to" option would be pointless).
 */
export async function getBoardScopeFilter(communityId: string): Promise<Prisma.BulletinPostWhereInput> {
  const treeIds = await getCommunityTreeIds(communityId)
  return {
    // ⚠ DELETED POSTS ARE INVISIBLE, AND THIS IS THE CHOKEPOINT (27 Aug 2026).
    // The thread list, the detail route, the reply and vote routes and the
    // unread count all build on this filter, so the exclusion lives here rather
    // than being remembered at five call sites.
    deletedAt: null,
    OR: [
      { communityId },
      { communityId: { in: treeIds }, scope: 'COMMUNITY' },
    ],
  }
}

/**
 * Resolves a post id against a board, honouring the Community-wide rule: a
 * post is reachable from board X if it lives on X, or if it is a
 * Community-wide post from anywhere in X's tree. Used by the detail, vote and
 * reply routes so that a Community-wide thread is not merely *displayed* on a
 * branch board but actually votable and repliable from it.
 */
export async function findBoardPost(
  postId: string,
  boardCommunityId: string,
  opts: { rootOnly?: boolean } = {},
) {
  const scope = await getBoardScopeFilter(boardCommunityId)
  return prisma.bulletinPost.findFirst({
    where: {
      AND: [{ id: postId }, scope, ...(opts.rootOnly ? [{ parentId: null }] : [])],
    },
    select: { id: true, communityId: true, title: true, authorId: true, scope: true },
  })
}

/**
 * True if the caller may administer `communityId`: OWNER/ADMIN on the node
 * itself, or on any ancestor of it. Hierarchy admin is what makes the Teams &
 * branches tree usable — the per-node add-branch / rename / assign-manager
 * buttons are otherwise dead on every node the caller didn't personally
 * create. This widens MANAGEMENT only; board and member visibility still
 * require a membership row on the node in question.
 */
export async function canManageCommunity(userId: string, communityId: string): Promise<boolean> {
  const scopeIds = [communityId, ...(await getAncestorIds(communityId))]
  const admin = await prisma.communityMember.findFirst({
    where: { userId, communityId: { in: scopeIds }, role: { in: ADMIN_ROLES } },
    select: { id: true },
  })
  return admin !== null
}

/**
 * May the caller READ this node's board?
 *
 * ⚠ Stage 2 deliberately REVERSES the Stage 1.1 join-first gate. Manage rights
 * now carry board read and moderation over descendant nodes, because the admin
 * cascade Charlie settled on 6 Aug includes subtree board moderation, and you
 * cannot moderate what you cannot see.
 *
 * WRITING is unchanged and still requires membership: an ancestor admin may
 * read a branch and remove a post from it, but does not post, reply or mark
 * there as though they belonged to it.
 */
export async function canReadBoard(userId: string, communityId: string): Promise<boolean> {
  if (await getCommunityMembership(userId, communityId)) return true
  return canManageCommunity(userId, communityId)
}

/** Guard for board reads. 404 for someone with no standing, so a Community's
 *  shape is not leaked. */
export async function requireBoardRead(userId: string, communityId: string): Promise<NextResponse | null> {
  return (await canReadBoard(userId, communityId))
    ? null
    : NextResponse.json({ error: 'Not found' }, { status: 404 })
}

/** Hierarchy-aware guard for the admin routes. Mirrors requireCommunityRole's
 *  404-not-403 rule for a caller with no standing anywhere in the tree. */
export async function requireCommunityAdmin(
  userId: string,
  communityId: string,
): Promise<NextResponse | null> {
  if (await canManageCommunity(userId, communityId)) return null
  const membership = await getCommunityMembership(userId, communityId)
  return membership
    ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    : NextResponse.json({ error: 'Not found' }, { status: 404 })
}

/** Unread bulletin-post count for a member: posts/replies since their lastReadAt. */
export async function countUnreadBulletin(communityId: string, lastReadAt: Date): Promise<number> {
  const scope = await getBoardScopeFilter(communityId)
  return prisma.bulletinPost.count({
    where: { ...scope, createdAt: { gt: lastReadAt } },
  })
}

/**
 * Cast (or change, or withdraw) a vote on a bulletin post or reply, keeping the
 * cached `score` in step. Voting the same value twice withdraws it.
 *
 * Lives here rather than inline in the route so it can be exercised directly by
 * scripts/check-central-stage1.ts — the route is unreachable from a script
 * (Clerk session), and a test that re-implements the transaction would prove
 * nothing about what actually runs.
 */
export async function applyBulletinVote(
  postId: string,
  userId: string,
  value: 1 | -1,
): Promise<{ score: number; myVote: number; previousVote: number }> {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.bulletinVote.findUnique({
      where: { postId_userId: { postId, userId } },
    })
    const previousVote = existing?.value ?? 0

    if (existing && existing.value === value) {
      await tx.bulletinVote.delete({ where: { id: existing.id } })
      await tx.bulletinPost.update({ where: { id: postId }, data: { score: { decrement: value } } })
      return { myVote: 0, previousVote }
    }

    if (existing) {
      await tx.bulletinVote.update({ where: { id: existing.id }, data: { value } })
      await tx.bulletinPost.update({
        where: { id: postId },
        data: { score: { increment: value - existing.value } },
      })
      return { myVote: value, previousVote }
    }

    await tx.bulletinVote.create({ data: { postId, userId, value } })
    await tx.bulletinPost.update({ where: { id: postId }, data: { score: { increment: value } } })
    return { myVote: value, previousVote }
  })

  const updated = await prisma.bulletinPost.findUniqueOrThrow({
    where: { id: postId },
    select: { score: true },
  })

  return { score: updated.score, myVote: result.myVote, previousVote: result.previousVote }
}

/**
 * Characters that survive `String.trim()`, look like nothing on screen, and
 * break a real email validator. Pasting an address out of Word, a web page, a
 * PDF or a mail client puts them in.
 *
 * ⚠ JS `\s` does NOT include these, which is the whole of the 26 Aug 2026 bug:
 *   U+00AD soft hyphen · U+200B zero-width space · U+200C ZWNJ · U+200D ZWJ ·
 *   U+200E LRM · U+200F RLM · U+2060 word joiner · U+FEFF BOM.
 *   (`\s` DOES cover U+00A0 NBFP and U+FEFF, so `.trim()` already removed
 *   those from the ends — they were never the culprit.)
 */
const INVISIBLE_CHARS = /[­​-‏⁠-⁤﻿]/g

/**
 * The one way an address is cleaned, used by every path that touches one.
 *
 * Invisibles are stripped ANYWHERE in the string, because one in the middle of
 * the local part is just as fatal as one on the end. Outer whitespace goes
 * (`.trim()` covers NBSP). Case is folded, which matches how the address is
 * compared when the invite is redeemed (`api/communities/join` lowercases both
 * sides) and how the lookup matches an existing account.
 *
 * Internal whitespace is deliberately LEFT IN so that "john smith@x.com" fails
 * validation and is reported, rather than being silently guessed into
 * "johnsmith@x.com".
 */
export function normaliseEmail(raw: string): string {
  return raw.replace(INVISIBLE_CHARS, '').trim().toLowerCase()
}

/**
 * The one rule for whether an address is usable. ⚠ THERE MUST NEVER BE TWO.
 *
 * Until 26 Aug 2026 there were: the invite panel's lookup used a loose
 * `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, and the create route used Zod's `.email()`.
 * A pasted address carrying a zero-width space passed the first and failed the
 * second, so the panel offered to invite an address the endpoint then refused —
 * and the two paths disagreeing is what made it look like a server fault.
 */
export function isValidEmail(candidate: string): boolean {
  return z.string().email().safeParse(candidate).success
}

/** Renders a string as visible characters plus U+XXXX escapes, for diagnosing
 *  exactly this class of fault from a log line rather than from a hypothesis. */
export function describeChars(s: string): string {
  return Array.from(s)
    .map((c) => {
      const cp = c.codePointAt(0)!
      return cp >= 0x20 && cp <= 0x7e ? c : `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`
    })
    .join(' ')
}

// ─────────────────────────────────────────────────────────────────────────────
// The question-library tag set a Community starts with.
//
// ⚠ SEEDED AT CREATION AS OF 26 Aug 2026, AND IT WAS NOT BEFORE. Every tag in
// every Community came from a migration — `central_stage2b.sql` seeded the
// contexts and six topics, 2d promoted five more, 2e added the departments —
// and each of those ran once, against the nodes that existed at the time. A
// Community created afterwards got `bulletinCategories` and NOTHING ELSE.
//
// For a new BRANCH that was survivable, because the library reads its ROOT's
// tags. For a new top-level COMMUNITY it was not: an empty chip row, an empty
// topic dropdown, and every row of a bulk upload failing with *"… is not a
// context in this Community. Use one of:"* followed by an empty list.
//
// Found because a branch created at 13:40 on 26 Aug turned `check:central` red.
//
// The starter set is deliberately the same set every existing Community now
// has — two Communities behaving differently for no reason is worse than either
// choice of set.
// ─────────────────────────────────────────────────────────────────────────────

const STARTER_CONTEXTS_EXTERNAL = ['Doorstep', 'Media interview', 'Hustings', 'University AMA', 'Council chamber']
const STARTER_CONTEXTS_INTERNAL = ['How-to', 'Party process', 'Tools & tech']

/**
 * ⚠ THE TOPIC TAXONOMY (Charlie, 26 Aug 2026). A CONTROLLED LIST, NO FREE TEXT.
 *
 * What a topic is FOR: browsing a slice you cannot name precisely. Finding a
 * specific word is search's job, and the two were being confused — which is how
 * the list drifted into 24 ministerial department names. Those are gone: wrong
 * axis (a department is who answers, not what it is about) and they get renamed
 * at every reshuffle, so the tag set would rot on a timetable set by somebody
 * else.
 *
 * ⚠ THERE IS NO "OTHER". A catch-all absorbs exactly the questions that would
 * have told you which topic is missing. The topic field is OPTIONAL instead,
 * and the admin Untagged view lists what has no topic — that list IS the
 * evidence for adding one.
 *
 * ⚠ FOUR OF THESE HAVE COMMAS IN THEIR NAMES. That is safe only because a comma
 * stopped being a separator on 26 Aug — see `splitList` in lib/question-import.ts.
 */
const SUBJECT_TOPICS = [
  'Immigration & asylum',
  'Crime, justice & policing',
  'Health & care',
  'Education',
  'Housing',
  'Transport & roads',
  'Energy & net zero',
  'Environment, farming & rural',
  'Economy & tax',
  'Welfare & pensions',
  'Business & jobs',
  'Culture, media & sport',
  'Science, technology & digital',
  'Defence & foreign affairs',
  'Constitution, devolution & elections',
  'Law & rights',
  'Social & moral issues',
  'Local finance',
  'Local services',
]

/** The three that are about doing the job, not about a subject. */
const INTERNAL_TOPICS = ['Party conduct', 'Media skills', 'Organising']

/**
 * `promoted` now carries the SUBJECT/INTERNAL split rather than a curation
 * judgement: the chip row has been contexts-only since Stage 2d, so the flag's
 * only remaining job is ordering the "All topics" dropdown, and grouping the
 * nineteen subjects above the three internal ones is what that ordering is
 * actually for.
 */
export const SUBJECT_TOPIC_LABELS: readonly string[] = SUBJECT_TOPICS
export const INTERNAL_TOPIC_LABELS: readonly string[] = INTERNAL_TOPICS

export type StarterTag = { kind: string; label: string; promoted: boolean; sortOrder: number }

export const DEFAULT_QUESTION_TAGS: StarterTag[] = [
  ...STARTER_CONTEXTS_EXTERNAL.map((label, i) => ({ kind: 'CONTEXT_EXTERNAL', label, promoted: true, sortOrder: i + 1 })),
  ...STARTER_CONTEXTS_INTERNAL.map((label, i) => ({ kind: 'CONTEXT_INTERNAL', label, promoted: true, sortOrder: i + 1 })),
  ...SUBJECT_TOPICS.map((label, i) => ({ kind: 'TOPIC', label, promoted: true, sortOrder: i + 1 })),
  ...INTERNAL_TOPICS.map((label, i) => ({ kind: 'TOPIC', label, promoted: false, sortOrder: i + 1 })),
]

/**
 * Give a Community its question-library tag set. Idempotent — safe to call on a
 * node that already has one, which is what makes it usable as a backfill.
 *
 * ⚠ THE TAG SET LIVES ON THE ROOT ONLY (Charlie, 26 Aug 2026); a branch inherits
 * it. Per-node copies drift apart and break filtering across branches — rename a
 * topic on one branch and the same question stops matching the same filter
 * depending on where you happen to be standing.
 *
 * ⚠ The per-node copies were ALREADY dead weight. Every read resolves the root
 * id first — `getTags`, the side-tag query in `listQuestions`, `planImport` — so
 * a branch's rows had never once been read by anything. The brief scopes this
 * rule to topics; it is applied to contexts too, because seeding rows nothing
 * reads is a bug in either direction and two rules here would be worse than one.
 */
export async function seedQuestionTags(communityId: string): Promise<number> {
  if ((await getRootCommunityId(communityId)) !== communityId) return 0

  const already = new Set(
    (
      await prisma.questionTag.findMany({
        where: { communityId },
        select: { kind: true, label: true },
      })
    ).map((t) => `${t.kind}\u0000${t.label}`),
  )
  const missing = DEFAULT_QUESTION_TAGS.filter((t) => !already.has(`${t.kind}\u0000${t.label}`))
  if (!missing.length) return 0
  const { count } = await prisma.questionTag.createMany({
    data: missing.map((t) => ({ communityId, ...t })),
    skipDuplicates: true,
  })
  return count
}

export type InviteCandidate = { id: string; name: string | null; username: string; isMember: boolean }

/**
 * Person lookup for the Community invite panel: an EXACT email match
 * (case-insensitive) OR a name/username substring.
 *
 * Email is never matched as a substring — that would let anyone enumerate
 * accounts by typing a common domain fragment — and is never returned.
 * `canInviteEmail` carries the address back when the query is a well-formed
 * address that matches nobody, so the caller can offer a real invite instead of
 * an empty list (the 6 Aug 2026 test's silent failure).
 */
export async function lookupInviteCandidates(
  communityId: string,
  term: string,
): Promise<{ users: InviteCandidate[]; canInviteEmail: string | null }> {
  // ⚠ The SAME cleaning the create path applies, so a string that gets offered
  // here can never be refused there. A pasted address carrying a zero-width
  // character used to fail the exact-email match too — silently offering to
  // invite somebody who already had an account.
  const cleaned = normaliseEmail(term)
  const searchTerm = term.trim()

  const users = await prisma.user.findMany({
    where: {
      isHistoricalAccount: false,
      status: 'ACTIVE',
      OR: [
        { email: { equals: cleaned, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { username: { contains: searchTerm, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, username: true },
    take: 8,
  })

  const existing = await prisma.communityMember.findMany({
    where: { communityId, userId: { in: users.map((u) => u.id) } },
    select: { userId: true },
  })
  const memberIds = new Set(existing.map((m) => m.userId))

  return {
    users: users.map((u) => ({ ...u, isMember: memberIds.has(u.id) })),
    // The CLEANED address, never the raw one: whatever the panel is handed here
    // is what it posts back, so handing it the raw string is how an invisible
    // character reached the create validator in the first place.
    canInviteEmail: isValidEmail(cleaned) && users.length === 0 ? cleaned : null,
  }
}

export type IssuedInvite = {
  invite: { id: string; inviteCode: string; email: string | null; maxUses: number; expiresAt: Date | null }
  targetName: string | null
  notified: boolean
  emailed: { sent: boolean; reason?: string } | null
}

/**
 * Issue an invite. Three shapes, all landing on the same CommunityInvite row:
 *
 *   {}          — an open code to share by hand
 *   { userId }  — an existing account: pinned to their address, announced in
 *                 their Feed
 *   { email }   — an address with no account yet, **which is the normal case**.
 *                 Most people invited to a branch have never heard of us.
 *
 * ⚠ THIS LIVES HERE, NOT IN THE ROUTE, AND THAT IS THE POINT (26 Aug 2026).
 * It sat inline in `POST /api/communities/[id]/invites`, which needs a Clerk
 * session, so no check could reach it — and when the panel reported a failure
 * on 26 Aug there was no way to run the real code and see what it did. The
 * comment on `applyBulletinVote` says the same thing for the same reason: a
 * test that re-implements the work proves nothing about what actually runs.
 *
 * Rule violations throw `CommunityRuleError` so the route maps them to a status
 * with a plain-string message. The route must never invent an error shape of its
 * own — see the note on the panel's error handling.
 */
export async function createCommunityInvite(params: {
  communityId: string
  createdByUserId: string
  createdByName: string | null
  userId?: string
  email?: string
  maxUses?: number
  expiresInDays?: number
}): Promise<IssuedInvite> {
  const { communityId, createdByUserId, createdByName, userId } = params
  let targetName: string | null = null

  // ── the address, cleaned once, validated once ───────────────────────────────
  //
  // ⚠ BYTES BEFORE HYPOTHESES (docs/CLAUDE.md §13). When an address arrives
  // carrying something invisible, or fails validation, the exact string is
  // logged character by character — length and U+XXXX for anything outside
  // printable ASCII. On 26 Aug 2026 this fault cost a round trip precisely
  // because nothing anywhere recorded what the server had actually received.
  // It logs only on the anomalous path, so an ordinary invite writes nothing.
  let email: string | undefined
  if (params.email !== undefined) {
    const raw = params.email
    const cleaned = normaliseEmail(raw)
    const valid = isValidEmail(cleaned)

    if (raw !== cleaned || !valid) {
      console.warn(
        '[invites] address needed cleaning or failed validation',
        JSON.stringify({
          rawLength: raw.length,
          cleanedLength: cleaned.length,
          rawChars: describeChars(raw),
          cleanedChars: describeChars(cleaned),
          valid,
        }),
      )
    }

    if (!valid) {
      throw new CommunityRuleError(
        cleaned
          ? `“${cleaned}” does not look like an email address`
          : 'Enter an email address to invite',
        422,
      )
    }
    email = cleaned
  }

  if (userId) {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, username: true },
    })
    if (!target) throw new CommunityRuleError('That account no longer exists', 404)

    const alreadyMember = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    })
    if (alreadyMember) throw new CommunityRuleError('That person is already a member', 409)

    // Resolved server-side so the panel never has to see, or send back,
    // somebody else's address.
    email = target.email
    targetName = target.name ?? target.username
  }

  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { name: true, parentCommunityId: true },
  })
  if (!community) throw new CommunityRuleError('Not found', 404)

  const rootId = await getRootCommunityId(communityId)
  const rootName =
    rootId === communityId
      ? community.name
      : (await prisma.community.findUniqueOrThrow({ where: { id: rootId }, select: { name: true } })).name

  const invite = await prisma.communityInvite.create({
    data: {
      communityId,
      inviteCode: randomBytes(16).toString('hex'),
      email,
      // An invite pinned to one person is single-use by definition.
      maxUses: userId ? 1 : (params.maxUses ?? 1),
      expiresAt: params.expiresInDays
        ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
        : undefined,
      createdByUserId,
    },
    select: { id: true, inviteCode: true, email: true, maxUses: true, expiresAt: true },
  })

  // An invited existing user also gets it in their Feed.
  if (userId) {
    await prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: 'Community invitation',
        message: `${createdByName ?? 'Someone'} invited you to join ${community.name}`,
        linkUrl: `/community-invite/${invite.inviteCode}`,
      },
    })
  }

  // Email whenever the invite is tied to an address, registered or not. The
  // result is REPORTED, never assumed: the invite row is already valid, so a
  // mail failure must not lose it, and claiming "emailed" when nothing left the
  // building is the exact failure this work exists to remove.
  // `sendCommunityInviteEmail` returns {sent, reason} and never throws, so the
  // row can never be orphaned by a mail problem.
  let emailed: { sent: boolean; reason?: string } | null = null
  if (email) {
    emailed = await sendCommunityInviteEmail({
      toEmail: email,
      invitedByName: createdByName ?? 'Someone',
      communityName: community.name,
      isBranch: community.parentCommunityId !== null,
      rootName,
      inviteCode: invite.inviteCode,
    })
  }

  return { invite, targetName, notified: Boolean(userId), emailed }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1.2 — membership, join requests and roles.
// The rules Charlie fixed on 6 Aug 2026, in one place:
//   · a branch invite makes you a member of that branch AND of the root
//   · branches are invite-only; a Community member may REQUEST to join one
//   · anyone with manage rights on a node decides its requests
//   · multi-branch membership is allowed; leaving is always self-serve
//   · any Community member may found a TOP-LEVEL branch; sub-branches under an
//     existing branch stay manage-gated
// See docs/SCRUTINISE_CENTRAL_SPEC.md §3.2.
// ─────────────────────────────────────────────────────────────────────────────

export const JOIN_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'DECLINED'] as const
export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUSES)[number]

/** Thrown for a rule violation the caller should see as a 4xx, not a 500. */
export class CommunityRuleError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = 'CommunityRuleError'
  }
}

/**
 * Join a node, and the Community root with it.
 *
 * Belonging to a branch means belonging to the Community it sits in — otherwise
 * a branch invitee would never see the Community-wide board or the rest of the
 * tree. Root membership is added at MEMBER and never overwritten: being OWNER of
 * a branch does not make you an owner of the whole Community.
 *
 * Idempotent — re-joining a node you already belong to leaves your role alone.
 */
export async function joinCommunityAndRoot(
  userId: string,
  communityId: string,
  role: CommunityRole = 'MEMBER',
  /**
   * CENTRAL 25-A §7h — who brought them in, written onto the membership itself.
   * Omitted for somebody who asked to join of their own accord, and that is a
   * real difference rather than a missing value.
   */
  provenance?: { invitedByUserId?: string | null; invitedViaInviteId?: string | null },
): Promise<{ joinedNode: boolean; joinedRoot: boolean; rootId: string }> {
  const rootId = await getRootCommunityId(communityId)
  const broughtIn = {
    invitedByUserId: provenance?.invitedByUserId ?? null,
    invitedViaInviteId: provenance?.invitedViaInviteId ?? null,
  }

  return prisma.$transaction(async (tx) => {
    const existingNode = await tx.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    })
    if (!existingNode) {
      await tx.communityMember.create({ data: { communityId, userId, role, ...broughtIn } })
    }

    let joinedRoot = false
    if (rootId !== communityId) {
      const existingRoot = await tx.communityMember.findUnique({
        where: { communityId_userId: { communityId: rootId, userId } },
      })
      if (!existingRoot) {
        // ⚠ 25-A §7h — the same provenance on the root membership. A branch
        // chair who brings somebody into their branch has brought them into
        // the Community too (Stage 1.2's branch-implies-root rule), and the
        // accountability follows the fact.
        await tx.communityMember.create({
          data: { communityId: rootId, userId, role: 'MEMBER', ...broughtIn },
        })
        joinedRoot = true
      }
    }

    return { joinedNode: !existingNode, joinedRoot, rootId }
  })
}

/**
 * Leave a node. Always self-serve.
 *
 * An OWNER cannot leave — that would orphan the node with no one able to
 * administer it; ownership has to move first (not built this sprint).
 * Leaving the ROOT means leaving the Community, so every branch membership in
 * that tree goes with it — the alternative would leave branch rows behind that
 * violate the branch-implies-root invariant above.
 */
export async function leaveCommunity(userId: string, communityId: string): Promise<{ leftIds: string[] }> {
  const membership = await getCommunityMembership(userId, communityId)
  if (!membership) throw new CommunityRuleError('You are not a member of this Community', 404)
  if (membership.role === 'OWNER') {
    throw new CommunityRuleError(
      'An owner cannot leave — hand ownership to someone else first.',
      409,
    )
  }

  const rootId = await getRootCommunityId(communityId)
  const targets =
    rootId === communityId
      ? await getCommunityTreeIds(communityId) // leaving the Community leaves all of it
      : [communityId]

  const owned = await prisma.communityMember.findFirst({
    where: { userId, communityId: { in: targets }, role: 'OWNER' },
    select: { communityId: true },
  })
  if (owned) {
    throw new CommunityRuleError(
      'You own a branch inside this Community — hand that branch over before leaving.',
      409,
    )
  }

  const { count } = await prisma.communityMember.deleteMany({
    where: { userId, communityId: { in: targets } },
  })
  return { leftIds: count > 0 ? targets : [] }
}

/**
 * Ask to join a branch. Open to members of the Community (i.e. of the root) who
 * are not already in this node — branches are invite-only, so a request is the
 * front door for everyone else.
 *
 * The duplicate-pending guard is the partial unique index in
 * prisma/central_stage1_2.sql; this check is the friendly message in front of
 * it, not the guarantee. Re-requesting after a DECLINE is allowed on purpose —
 * no permanent block this sprint.
 */
export async function createJoinRequest(userId: string, communityId: string, message?: string) {
  const node = await prisma.community.findUnique({
    where: { id: communityId },
    select: { id: true, name: true, parentCommunityId: true },
  })
  if (!node) throw new CommunityRuleError('Community not found', 404)
  if (!node.parentCommunityId) {
    throw new CommunityRuleError('The Community itself is joined by invitation, not by request.', 400)
  }

  const rootId = await getRootCommunityId(communityId)
  if (!(await getCommunityMembership(userId, rootId))) {
    throw new CommunityRuleError('Join the Community first — branches are for its members.', 403)
  }
  if (await getCommunityMembership(userId, communityId)) {
    throw new CommunityRuleError('You are already a member of this branch', 409)
  }

  const pending = await prisma.communityJoinRequest.findFirst({
    where: { communityId, userId, status: 'PENDING' },
  })
  if (pending) throw new CommunityRuleError('You already have a request waiting on this branch', 409)

  const request = await prisma.communityJoinRequest.create({
    data: { communityId, userId, message: message?.trim() || null },
    include: { user: { select: { id: true, name: true, username: true } } },
  })

  // Tell the people who can actually act on it — the node's own OWNER/ADMINs and
  // every ancestor admin, which is the same set canManageCommunity() authorises.
  const managerIds = await getNodeManagerIds(communityId)
  const requesterName = request.user.name ?? request.user.username
  if (managerIds.length > 0) {
    await prisma.notification.createMany({
      data: managerIds.map((managerId) => ({
        userId: managerId,
        type: 'SYSTEM' as const,
        title: 'Request to join',
        message: `${requesterName} asked to join ${node.name}`,
        linkUrl: `/communities/${communityId}?panel=requests`,
      })),
    })
  }

  return request
}

/** Everyone authorised to manage a node: its OWNER/ADMINs plus ancestor admins. */
export async function getNodeManagerIds(communityId: string): Promise<string[]> {
  const scopeIds = [communityId, ...(await getAncestorIds(communityId))]
  const rows = await prisma.communityMember.findMany({
    where: { communityId: { in: scopeIds }, role: { in: ADMIN_ROLES } },
    select: { userId: true },
  })
  return [...new Set(rows.map((r) => r.userId))]
}

/**
 * Approve or decline a pending request. Approval creates the membership (and
 * the root membership with it) and tells the requester; a decline tells them
 * too, rather than leaving them wondering.
 */
export async function decideJoinRequest(
  requestId: string,
  deciderId: string,
  decision: 'APPROVED' | 'DECLINED',
) {
  const request = await prisma.communityJoinRequest.findUnique({
    where: { id: requestId },
    include: { community: { select: { id: true, name: true } } },
  })
  if (!request) throw new CommunityRuleError('Request not found', 404)
  if (request.status !== 'PENDING') {
    throw new CommunityRuleError(`This request was already ${request.status.toLowerCase()}`, 409)
  }
  if (!(await canManageCommunity(deciderId, request.communityId))) {
    throw new CommunityRuleError('You cannot decide requests for this branch', 403)
  }
  // ⚠ CENTRAL 25-A §3b — somebody who arrived through a LINK is admitted only
  // by a person the owner has given the invitation right to. A request somebody
  // made of their own accord is unchanged and stays with manage rights, so this
  // narrows nothing that was not created by a link.
  if (request.inviteId) {
    const { canInvite } = await import('./community-permissions')
    if (!(await canInvite(deciderId, request.communityId))) {
      throw new CommunityRuleError(
        'Only people the owner has given the right to invite can let in someone who arrived through a link.',
        403,
      )
    }
  }

  if (decision === 'APPROVED') {
    // ⚠ 25-A §7h — somebody who came through a link was brought in by whoever
    // issued that link, not by whoever happened to approve them. Somebody who
    // asked of their own accord was brought in by nobody, and that stays null.
    const invitedVia = request.inviteId
      ? await prisma.communityInvite.findUnique({
          where: { id: request.inviteId },
          select: { id: true, createdByUserId: true },
        })
      : null
    const { rootId } = await joinCommunityAndRoot(request.userId, request.communityId, 'MEMBER', {
      invitedByUserId: invitedVia?.createdByUserId ?? null,
      invitedViaInviteId: invitedVia?.id ?? null,
    })

    // The link arrival's referral and its use are recorded HERE, at the moment
    // they are actually let in — not when they clicked. A request that is
    // declined consumes nothing.
    if (request.inviteId) {
      const invite = invitedVia
      if (invite) {
        const { recordReferral } = await import('./central-points')
        await recordReferral({
          communityId: rootId,
          inviterUserId: invite.createdByUserId,
          inviteeUserId: request.userId,
          inviteId: invite.id,
        })
        await prisma.communityInvite.update({
          where: { id: invite.id },
          data: { usedCount: { increment: 1 } },
        })
      }
    }
  }

  const updated = await prisma.communityJoinRequest.update({
    where: { id: requestId },
    data: { status: decision, decidedAt: new Date(), decidedByUserId: deciderId },
  })

  await prisma.notification.create({
    data: {
      userId: request.userId,
      type: 'SYSTEM',
      title: decision === 'APPROVED' ? 'Request approved' : 'Request declined',
      message:
        decision === 'APPROVED'
          ? `You are now a member of ${request.community.name}`
          : `Your request to join ${request.community.name} was declined. You can ask again.`,
      // `joined=1` is what raises the switch-or-add chooser on arrival — see
      // the note on the branch page. On a decline it points at the branch so
      // they can re-request from there.
      linkUrl:
        decision === 'APPROVED'
          ? `/communities/${request.communityId}?joined=1`
          : `/communities/${request.communityId}`,
    },
  })

  return updated
}

/** Pending requests on a node, for its Requests panel. */
export async function listJoinRequests(communityId: string, status: JoinRequestStatus = 'PENDING') {
  return prisma.communityJoinRequest.findMany({
    where: { communityId, status },
    include: {
      user: { select: { id: true, name: true, username: true } },
      // 25-A §3b — whether they arrived through a link, and which one. The
      // person deciding needs to know they were introduced rather than that
      // they walked up.
      invite: { select: { inviteCode: true, createdByUserId: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Promote MEMBER→ADMIN or demote ADMIN→MEMBER on a node.
 * OWNER is fixed here: it is not a rung on this ladder, and letting a co-admin
 * demote the owner would make the node takeable.
 */
export async function setMemberRole(
  communityId: string,
  targetUserId: string,
  role: 'ADMIN' | 'MEMBER',
) {
  const membership = await getCommunityMembership(targetUserId, communityId)
  if (!membership) throw new CommunityRuleError('That person is not a member of this node', 404)
  if (membership.role === 'OWNER') {
    throw new CommunityRuleError('The owner’s role cannot be changed here', 409)
  }
  return prisma.communityMember.update({
    where: { communityId_userId: { communityId, userId: targetUserId } },
    data: { role },
  })
}

/**
 * Remove someone from a node. The OWNER cannot be removed.
 *
 * ⚠ CENTRAL 25-A §3c — THIS ARCHIVES, IT DOES NOT DELETE. The membership row
 * moves to `CommunityMembershipArchive` with the role they held, when they
 * joined, who removed them and why. Before 25-A the row was simply deleted and
 * there was no trace that the person had ever been a member.
 *
 * ⚠ AND IT TOUCHES NONE OF THEIR CONTRIBUTIONS, deliberately: bulletin posts,
 * questions, answers, resources and ideas stay exactly where they are,
 * attributed to them. Removing somebody takes away their access, not their
 * words.
 */
export async function removeMember(
  communityId: string,
  targetUserId: string,
  removedByUserId?: string,
  reason?: string,
): Promise<{ archiveId: string }> {
  const membership = await getCommunityMembership(targetUserId, communityId)
  if (!membership) throw new CommunityRuleError('That person is not a member of this node', 404)
  if (membership.role === 'OWNER') {
    throw new CommunityRuleError('The owner cannot be removed', 409)
  }

  // Clear the manager pointer if it named them, so the node doesn't keep
  // advertising a branch manager who is no longer in it.
  const [, , archived] = await prisma.$transaction([
    prisma.community.updateMany({
      where: { id: communityId, managerId: targetUserId },
      data: { managerId: null },
    }),
    prisma.communityMember.delete({
      where: { communityId_userId: { communityId, userId: targetUserId } },
    }),
    prisma.communityMembershipArchive.create({
      data: {
        communityId,
        userId: targetUserId,
        role: membership.role,
        joinedAt: membership.joinedAt,
        removedByUserId: removedByUserId ?? null,
        reason: reason?.trim() || null,
        // ⚠ 25-A §7h — WHO BROUGHT THEM IN TRAVELS WITH THE ARCHIVE. Charlie is
        // relying on branch chairs being accountable for the people they
        // brought in, so a removal must not be able to erase the link — in
        // either direction, the removed person's or the inviter's.
        invitedByUserId: membership.invitedByUserId,
        invitedViaInviteId: membership.invitedViaInviteId,
      },
      select: { id: true },
    }),
  ])

  return { archiveId: archived.id }
}

/**
 * Who may create a branch under `parentId`.
 *
 * TOP-LEVEL branches (children of the Community root) are open to any member of
 * that Community — the deliberate growth mechanic: an invitee whose town has no
 * branch founds it. SUB-branches under an existing branch stay manage-gated,
 * because that is a structural decision belonging to that branch's admins.
 */
export async function canCreateBranchUnder(userId: string, parentId: string): Promise<boolean> {
  if (await canManageCommunity(userId, parentId)) return true
  const parent = await prisma.community.findUnique({
    where: { id: parentId },
    select: { parentCommunityId: true },
  })
  if (!parent || parent.parentCommunityId !== null) return false
  return (await getCommunityMembership(userId, parentId)) !== null
}

export type CommunityTreeMember = { userId: string; name: string | null; username: string; role: CommunityRole }

export type CommunityTreeNode = {
  id: string
  name: string
  depth: number
  managerId: string | null
  managerName: string | null
  memberCount: number
  /** Members of THIS node — the assign-manager options for it. */
  members: CommunityTreeMember[]
  /** Viewer context, present when getCommunityTree is given a viewerId. */
  viewerRole: CommunityRole | null
  viewerCanManage: boolean
  viewerHasPendingRequest: boolean
  /** Pending requests waiting on this node — only filled in for managers. */
  pendingRequestCount: number
  children: CommunityTreeNode[]
}

/**
 * Full branch subtree rooted at communityId, for the "Teams & branches" region.
 *
 * Rewritten at Stage 1.2 to load level-by-level and merge the viewer's own
 * context in bulk, rather than recursing with several queries per node: the
 * tree now has to answer "am I in this one, can I manage it, have I already
 * asked" for every node it draws, and doing that per node would be a query
 * storm on a structure that is meant to grow.
 */
export async function getCommunityTree(communityId: string, viewerId?: string): Promise<CommunityTreeNode> {
  const nodes = await prisma.community.findMany({
    where: { id: { in: await getSubtreeIds(communityId) }, deletedAt: null },
    include: {
      manager: { select: { name: true } },
      members: {
        include: { user: { select: { name: true, username: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  const nodeIds = nodes.map((n) => n.id)

  // Viewer context, three queries for the whole tree rather than three per node.
  const viewerMemberships = viewerId
    ? await prisma.communityMember.findMany({
        where: { userId: viewerId, communityId: { in: nodeIds } },
        select: { communityId: true, role: true },
      })
    : []
  const viewerRoleByNode = new Map(viewerMemberships.map((m) => [m.communityId, m.role as CommunityRole]))

  const viewerPending = viewerId
    ? await prisma.communityJoinRequest.findMany({
        where: { userId: viewerId, communityId: { in: nodeIds }, status: 'PENDING' },
        select: { communityId: true },
      })
    : []
  const pendingSet = new Set(viewerPending.map((r) => r.communityId))

  const pendingCounts = await prisma.communityJoinRequest.groupBy({
    by: ['communityId'],
    where: { communityId: { in: nodeIds }, status: 'PENDING' },
    _count: { _all: true },
  })
  const pendingCountByNode = new Map(pendingCounts.map((p) => [p.communityId, p._count._all]))

  // Manage rights cascade down, so an admin anywhere at or above the subtree
  // root manages everything in it — resolved once, then inherited.
  const rootCanManage = viewerId ? await canManageCommunity(viewerId, communityId) : false

  const byParent = new Map<string | null, typeof nodes>()
  for (const n of nodes) {
    const key = n.parentCommunityId
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(n)
  }

  function build(node: (typeof nodes)[number], depth: number, inheritedManage: boolean): CommunityTreeNode {
    const viewerRole = viewerRoleByNode.get(node.id) ?? null
    const canManage = inheritedManage || viewerRole === 'OWNER' || viewerRole === 'ADMIN'
    return {
      id: node.id,
      name: node.name,
      depth,
      managerId: node.managerId,
      managerName: node.manager?.name ?? null,
      memberCount: node.members.length,
      members: node.members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        username: m.user.username,
        role: m.role as CommunityRole,
      })),
      viewerRole,
      viewerCanManage: canManage,
      viewerHasPendingRequest: pendingSet.has(node.id),
      pendingRequestCount: canManage ? (pendingCountByNode.get(node.id) ?? 0) : 0,
      children: (byParent.get(node.id) ?? []).map((c) => build(c, depth + 1, canManage)),
    }
  }

  const rootNode = nodes.find((n) => n.id === communityId)
  if (!rootNode) throw new CommunityRuleError('Community not found', 404)
  return build(rootNode, 0, rootCanManage)
}

/** Every node id at or below `communityId` (the subtree, not the whole tree). */
export async function getSubtreeIds(communityId: string): Promise<string[]> {
  const ids = [communityId]
  let frontier = [communityId]
  let guard = 0
  while (frontier.length > 0 && guard++ < 50) {
    // ⚠ LIVE CHILDREN ONLY (item 11, 27 Aug 2026). This walk feeds the Teams
    // tree, the question visibility filter and the board scope filter, so a
    // deleted branch that stayed in it would keep its content reachable from
    // every one of them — the branch would be "deleted" and still be a place.
    //
    // The ROOT is never excluded here: it cannot be deleted, and dropping the
    // starting node would silently return an empty subtree.
    const children = await prisma.community.findMany({
      where: { parentCommunityId: { in: frontier }, deletedAt: null },
      select: { id: true },
    })
    frontier = children.map((c) => c.id)
    ids.push(...frontier)
  }
  return ids
}
