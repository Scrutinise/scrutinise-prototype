import { prisma } from '@/lib/prisma'
import {
  CommunityRuleError,
  canManageCommunity,
  getCommunityMembership,
  getRootCommunityId,
  getSubtreeIds,
} from '@/lib/community'
import { awardClaimPoints, getConfig, resolveTariff } from '@/lib/central-points'

// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL Stage 2d — the training exchange.
//
// One member offers to teach something; another asks to be taught it; a third
// proposes on either. When BOTH sides have accepted, and only then, each sees
// the contact channels the OTHER ticked — and nothing else.
//
// THE ONE RULE THIS FILE EXISTS TO ENFORCE: `contactFor()` below is the ONLY
// place in the codebase that reads a member's email or phone for the purpose of
// showing it to another member. Every other surface — member lists, search,
// exports, packs, admin panels, the branch's completed-sessions list — renders
// names and usernames. check:central asserts that by walking a real accepted
// match from four different viewpoints, including a Community admin's, and by
// grepping the training surfaces for `.email` and `.phone`.
//
// docs/SCRUTINISE_CENTRAL_SPEC.md §7.
// ─────────────────────────────────────────────────────────────────────────────

export const LISTING_KINDS = ['OFFER', 'REQUEST'] as const
export type ListingKind = (typeof LISTING_KINDS)[number]

export const LISTING_STATUSES = ['OPEN', 'MATCHED', 'CLOSED'] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]

export const MATCH_STATUSES = ['PROPOSED', 'ACCEPTED', 'DECLINED'] as const
export type MatchStatus = (typeof MATCH_STATUSES)[number]

/** The line shown beside every "close" control. It is the honest one. */
export const CLOSE_WARNING =
  'Closing stops the details being shown from now on. It cannot unsend what has already been seen.'

/**
 * Whether members may share a phone number at all.
 *
 * ⚠ CHARLIE'S DECISION. The brief asked for an optional phone field and also
 * said email-only is a valid v1 if we would rather not hold phone numbers.
 * This ships ON, per the brief's primary instruction, and switching to
 * email-only is one row:
 *
 *   UPDATE "PointsConfig" SET "numericValue" = 0 WHERE "key" = 'TRAINING_PHONE_SHARING';
 *
 * With it off, the tick-box disappears from every form AND a phone number stops
 * being revealed on matches that already ticked it — the switch is read at
 * display time, not at consent time, so turning it off is retroactive.
 */
export async function phoneSharingEnabled(): Promise<boolean> {
  return (await getConfig('TRAINING_PHONE_SHARING')) >= 1
}

// ── access ───────────────────────────────────────────────────────────────────

/**
 * Membership of the Community is the entry ticket to its training exchange,
 * exactly as it is to its question library. Returns the ROOT id, which is what
 * every listing is scoped to.
 */
export async function requireTrainingAccess(userId: string, communityId: string): Promise<string> {
  const rootId = await getRootCommunityId(communityId)
  if (!(await getCommunityMembership(userId, rootId))) {
    throw new CommunityRuleError('Not found', 404)
  }
  return rootId
}

// ── contact sharing — the whole privacy surface, in one function ─────────────

export type ContactChannels = {
  email: string | null
  phone: string | null
}

export type SharePreview = {
  /** What the viewer's own ticks would reveal about them. */
  yours: { email: boolean; phone: boolean }
  /** Who it would go to. Named, never "the other member". */
  toName: string
  /** What the other side has already agreed to show the viewer. */
  theirs: { email: boolean; phone: boolean }
}

type MatchForContact = {
  id: string
  status: string
  responderId: string
  shareEmail: boolean
  sharePhone: boolean
  responderAcceptedAt: Date | null
  authorAcceptedAt: Date | null
  closedAt: Date | null
  listing: { authorId: string; shareEmail: boolean; sharePhone: boolean }
}

/** Both sides accepted, and nobody has closed it since. */
export function isLiveMatch(m: MatchForContact): boolean {
  return (
    m.status === 'ACCEPTED' &&
    m.responderAcceptedAt !== null &&
    m.authorAcceptedAt !== null &&
    m.closedAt === null
  )
}

/**
 * The contact details `viewerId` may see on this match, and nothing more.
 *
 * Returns `null` — not an empty object — for anyone who is not one of the two
 * participants, so a caller cannot accidentally render a truthy husk. A
 * Community admin viewing the same listing is "anyone".
 *
 * Four conditions, all of which must hold:
 *   1. the viewer is the listing's author or the match's responder;
 *   2. both sides have accepted;
 *   3. nobody has closed the match;
 *   4. the OTHER side ticked that channel.
 * Plus the phone switch, read here rather than at consent time.
 */
export async function contactFor(
  matchId: string,
  viewerId: string,
): Promise<{ name: string; channels: ContactChannels } | null> {
  const match = await prisma.trainingMatch.findUnique({
    where: { id: matchId },
    include: { listing: { select: { authorId: true, shareEmail: true, sharePhone: true } } },
  })
  if (!match) return null

  const isAuthor = match.listing.authorId === viewerId
  const isResponder = match.responderId === viewerId
  if (!isAuthor && !isResponder) return null
  if (!isLiveMatch(match)) return null

  // The OTHER side's ticks and the other side's id.
  const otherId = isAuthor ? match.responderId : match.listing.authorId
  const theirTicks = isAuthor
    ? { email: match.shareEmail, phone: match.sharePhone }
    : { email: match.listing.shareEmail, phone: match.listing.sharePhone }

  const phoneOn = await phoneSharingEnabled()
  const other = await prisma.user.findUnique({
    where: { id: otherId },
    select: { name: true, username: true, email: true, phone: true },
  })
  if (!other) return null

  return {
    name: other.name ?? other.username,
    channels: {
      email: theirTicks.email ? other.email : null,
      phone: theirTicks.phone && phoneOn ? other.phone : null,
    },
  }
}

/**
 * "Before accepting, each person is shown exactly what of theirs will be
 * shared, and with whom."
 *
 * Computed from the same ticks `contactFor` reads, so the promise on the
 * confirmation screen and the disclosure that follows cannot drift apart.
 */
export async function sharePreviewForAuthor(matchId: string): Promise<SharePreview | null> {
  const match = await prisma.trainingMatch.findUnique({
    where: { id: matchId },
    include: {
      listing: { select: { shareEmail: true, sharePhone: true } },
      responder: { select: { name: true, username: true } },
    },
  })
  if (!match) return null
  const phoneOn = await phoneSharingEnabled()
  return {
    yours: { email: match.listing.shareEmail, phone: match.listing.sharePhone && phoneOn },
    toName: match.responder.name ?? match.responder.username,
    theirs: { email: match.shareEmail, phone: match.sharePhone && phoneOn },
  }
}

/** The mirror image, for the responder, before they send a proposal. */
export async function sharePreviewForResponder(
  listingId: string,
  ticks: { shareEmail: boolean; sharePhone: boolean },
): Promise<SharePreview | null> {
  const listing = await prisma.trainingListing.findUnique({
    where: { id: listingId },
    include: { author: { select: { name: true, username: true } } },
  })
  if (!listing) return null
  const phoneOn = await phoneSharingEnabled()
  return {
    yours: { email: ticks.shareEmail, phone: ticks.sharePhone && phoneOn },
    toName: listing.author.name ?? listing.author.username,
    theirs: { email: listing.shareEmail, phone: listing.sharePhone && phoneOn },
  }
}

// ── listings ─────────────────────────────────────────────────────────────────

export async function createListing(params: {
  userId: string
  communityId: string
  kind: string
  topic: string
  description: string
  availability?: string
  shareEmail: boolean
  sharePhone: boolean
}) {
  const rootId = await requireTrainingAccess(params.userId, params.communityId)
  if (!(LISTING_KINDS as readonly string[]).includes(params.kind)) {
    throw new CommunityRuleError('A listing is either an offer or a request', 422)
  }
  if (!params.topic.trim()) throw new CommunityRuleError('Give the listing a topic', 422)
  if (!params.description.trim()) throw new CommunityRuleError('Say what you are offering or asking for', 422)

  const sharePhone = params.sharePhone && (await phoneSharingEnabled())
  if (sharePhone) await assertHasPhone(params.userId)
  if (!params.shareEmail && !sharePhone) {
    throw new CommunityRuleError(
      'Tick at least one way for a match to reach you — nobody can arrange a session otherwise',
      422,
    )
  }

  return prisma.trainingListing.create({
    data: {
      communityId: rootId,
      authorId: params.userId,
      kind: params.kind,
      topic: params.topic.trim().slice(0, 120),
      description: params.description.trim(),
      availability: (params.availability ?? '').trim(),
      shareEmail: params.shareEmail,
      sharePhone,
    },
  })
}

/** A phone tick with no phone number on file would promise a channel that
 *  cannot deliver — the exact "no surprises" failure the brief warns about. */
async function assertHasPhone(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } })
  if (!u?.phone?.trim()) {
    throw new CommunityRuleError(
      'Add a phone number in your settings before offering to share one',
      422,
    )
  }
}

export async function closeListing(listingId: string, userId: string) {
  const listing = await prisma.trainingListing.findUnique({ where: { id: listingId } })
  if (!listing) throw new CommunityRuleError('Listing not found', 404)
  // The author closes their own; a Community admin can close any, because an
  // abandoned listing is a support burden, not a private possession.
  if (listing.authorId !== userId && !(await canManageCommunity(userId, listing.communityId))) {
    throw new CommunityRuleError('Only the author or a Community admin can close a listing', 403)
  }
  return prisma.trainingListing.update({ where: { id: listingId }, data: { status: 'CLOSED' } })
}

export type ListingRow = {
  id: string
  kind: string
  topic: string
  description: string
  availability: string
  status: string
  createdAt: Date
  author: { id: string; name: string | null; username: string }
  mine: boolean
  /** Proposal counts — never who proposed, unless the viewer is the author. */
  proposalCount: number
  myProposalStatus: string | null
}

/**
 * The exchange, as one viewer sees it. NO CONTACT DETAILS ARE SELECTED HERE
 * AT ALL — not filtered out later, never read. The only route to an address is
 * `contactFor`.
 */
export async function listListings(
  communityId: string,
  viewerId: string,
  opts: { kind?: ListingKind; status?: ListingStatus; mineOnly?: boolean } = {},
): Promise<ListingRow[]> {
  const rootId = await getRootCommunityId(communityId)
  const listings = await prisma.trainingListing.findMany({
    where: {
      communityId: rootId,
      ...(opts.kind ? { kind: opts.kind } : {}),
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.mineOnly ? { authorId: viewerId } : {}),
    },
    include: {
      author: { select: { id: true, name: true, username: true } },
      matches: { select: { responderId: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return listings.map((l) => ({
    id: l.id,
    kind: l.kind,
    topic: l.topic,
    description: l.description,
    availability: l.availability,
    status: l.status,
    createdAt: l.createdAt,
    author: l.author,
    mine: l.authorId === viewerId,
    proposalCount: l.matches.filter((m) => m.status !== 'DECLINED').length,
    myProposalStatus: l.matches.find((m) => m.responderId === viewerId)?.status ?? null,
  }))
}

// ── matches ──────────────────────────────────────────────────────────────────

export async function proposeMatch(params: {
  listingId: string
  userId: string
  message?: string
  shareEmail: boolean
  sharePhone: boolean
}) {
  const listing = await prisma.trainingListing.findUnique({ where: { id: params.listingId } })
  if (!listing) throw new CommunityRuleError('Listing not found', 404)
  await requireTrainingAccess(params.userId, listing.communityId)

  if (listing.authorId === params.userId) {
    throw new CommunityRuleError('This is your own listing', 409)
  }
  if (listing.status !== 'OPEN') {
    throw new CommunityRuleError('That listing is no longer open', 409)
  }

  const sharePhone = params.sharePhone && (await phoneSharingEnabled())
  if (sharePhone) await assertHasPhone(params.userId)
  if (!params.shareEmail && !sharePhone) {
    throw new CommunityRuleError(
      'Tick at least one way for them to reach you — nobody can arrange a session otherwise',
      422,
    )
  }

  // Creating the proposal IS the responder's acceptance: they have just been
  // shown exactly what of theirs it will share and with whom.
  const now = new Date()
  const match = await prisma.trainingMatch.upsert({
    where: { listingId_responderId: { listingId: params.listingId, responderId: params.userId } },
    create: {
      listingId: params.listingId,
      responderId: params.userId,
      message: params.message?.trim() || null,
      shareEmail: params.shareEmail,
      sharePhone,
      responderAcceptedAt: now,
    },
    update: {
      status: 'PROPOSED',
      message: params.message?.trim() || null,
      shareEmail: params.shareEmail,
      sharePhone,
      responderAcceptedAt: now,
      authorAcceptedAt: null,
      acceptedAt: null,
      closedAt: null,
      closedByUserId: null,
    },
  })

  // ⚠ STAGE 2e: NAME THE PERSON AND THE LISTING. “Someone wants your training”
  // told the author neither who nor which, which in a feed of several items is
  // no more use than a bell.
  const responder = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { name: true, username: true },
  })
  const who = responder?.name ?? responder?.username ?? 'A member'
  await prisma.notification.create({
    data: {
      userId: listing.authorId,
      type: 'SYSTEM',
      title: `${who} has proposed on your ${listing.kind === 'OFFER' ? 'offer' : 'request'} of ${listing.topic}`,
      message: 'Accept to swap the contact details you have each agreed to share.',
      linkUrl: `/communities/${listing.communityId}?tab=training&listing=${listing.id}`,
    },
  })
  return match
}

/**
 * The listing's author accepts one proposal. That is the second of the two
 * acceptances, so this is the moment contact details become visible — to the
 * two participants and to nobody else.
 */
export async function acceptMatch(matchId: string, userId: string, authorMessage?: string) {
  const match = await prisma.trainingMatch.findUnique({
    where: { id: matchId },
    include: { listing: true },
  })
  if (!match) throw new CommunityRuleError('Proposal not found', 404)
  if (match.listing.authorId !== userId) {
    throw new CommunityRuleError('Only the listing’s author can accept a proposal', 403)
  }
  if (match.status === 'DECLINED') throw new CommunityRuleError('That proposal was declined', 409)
  if (match.status === 'ACCEPTED') return match

  const now = new Date()
  const updated = await prisma.trainingMatch.update({
    where: { id: matchId },
    data: {
      status: 'ACCEPTED',
      authorAcceptedAt: now,
      acceptedAt: now,
      authorMessage: authorMessage?.trim() || null,
    },
  })
  // Accepting one proposal takes the listing off the open board. The others
  // stay PROPOSED rather than being auto-declined — a silent mass-decline is a
  // decision the author did not make.
  await prisma.trainingListing.update({
    where: { id: match.listingId },
    data: { status: 'MATCHED' },
  })

  await prisma.notification.create({
    data: {
      userId: match.responderId,
      type: 'SYSTEM',
      title: `Your proposal on ${match.listing.topic} was accepted`,
      message:
        authorMessage?.trim() ||
        'You can now see the contact details you were each given.',
      linkUrl: `/communities/${match.listing.communityId}?tab=training&listing=${match.listingId}`,
    },
  })
  return updated
}

export async function declineMatch(matchId: string, userId: string, authorMessage?: string) {
  const match = await prisma.trainingMatch.findUnique({
    where: { id: matchId },
    include: { listing: true },
  })
  if (!match) throw new CommunityRuleError('Proposal not found', 404)
  if (match.listing.authorId !== userId) {
    throw new CommunityRuleError('Only the listing’s author can decline a proposal', 403)
  }
  if (match.status === 'ACCEPTED') {
    throw new CommunityRuleError('That proposal was already accepted — close the match instead', 409)
  }
  const updated = await prisma.trainingMatch.update({
    where: { id: matchId },
    data: { status: 'DECLINED', authorMessage: authorMessage?.trim() || null },
  })

  // ⚠ A DECLINE IS TOLD, AND MAY CARRY A REASON. Leaving someone to work out
  // from a status chip that they were turned down is the wrong shape for a
  // branch of a dozen people who see each other on Saturday.
  await prisma.notification.create({
    data: {
      userId: match.responderId,
      type: 'SYSTEM',
      title: `Your proposal on ${match.listing.topic} was declined`,
      message: authorMessage?.trim() || 'No reason was given.',
      linkUrl: `/communities/${match.listing.communityId}?tab=training`,
    },
  })
  return updated
}

/**
 * Either side closes. Future display stops; the record that it happened does
 * not, which is why closure is its own columns rather than a status.
 *
 * The UI says, in as many words, that this cannot unsend what has already been
 * seen — see CLOSE_WARNING.
 */
export async function closeMatch(matchId: string, userId: string) {
  const match = await prisma.trainingMatch.findUnique({
    where: { id: matchId },
    include: { listing: { select: { authorId: true, id: true } } },
  })
  if (!match) throw new CommunityRuleError('Match not found', 404)
  if (match.listing.authorId !== userId && match.responderId !== userId) {
    throw new CommunityRuleError('Only the two people in a match can close it', 403)
  }
  if (match.closedAt) return match
  return prisma.trainingMatch.update({
    where: { id: matchId },
    data: { closedAt: new Date(), closedByUserId: userId },
  })
}

export type MatchRow = {
  id: string
  listingId: string
  listingTopic: string
  listingKind: string
  status: string
  message: string | null
  createdAt: Date
  acceptedAt: Date | null
  closedAt: Date | null
  /** The viewer's side of the match. */
  role: 'author' | 'responder'
  otherParty: { id: string; name: string | null; username: string }
  /** How many live proposals sit on the underlying listing. Stage 2e: BOTH
   *  panels expose the proposal link, because “Your matches” showing a
   *  “waiting on you” chip with no control reads as a dead panel. */
  listingProposalCount: number
  /** The author's line when they accepted or declined. */
  authorMessage: string | null
  /** Non-null ONLY on a live match the viewer is in — see contactFor. */
  contact: ContactChannels | null
  /** What the viewer is showing the other side, so it is never a mystery. */
  sharingFromMe: { email: boolean; phone: boolean }
  sessionLogged: boolean
}

/** Every match the viewer is a party to, from either side. */
export async function listMyMatches(communityId: string, viewerId: string): Promise<MatchRow[]> {
  const rootId = await getRootCommunityId(communityId)
  const matches = await prisma.trainingMatch.findMany({
    where: {
      listing: { communityId: rootId },
      OR: [{ responderId: viewerId }, { listing: { authorId: viewerId } }],
    },
    include: {
      listing: {
        select: {
          id: true, topic: true, kind: true, authorId: true, shareEmail: true, sharePhone: true,
          author: { select: { id: true, name: true, username: true } },
          matches: { select: { status: true } },
        },
      },
      responder: { select: { id: true, name: true, username: true } },
      sessions: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  const phoneOn = await phoneSharingEnabled()
  const rows: MatchRow[] = []
  for (const m of matches) {
    const isAuthor = m.listing.authorId === viewerId
    // One call per row rather than an inlined copy of the rule: there is
    // exactly one implementation of "may this viewer see these details".
    const contact = await contactFor(m.id, viewerId)
    rows.push({
      id: m.id,
      listingId: m.listingId,
      listingTopic: m.listing.topic,
      listingKind: m.listing.kind,
      status: m.status,
      message: m.message,
      authorMessage: m.authorMessage,
      listingProposalCount: m.listing.matches.filter((x) => x.status !== 'DECLINED').length,
      createdAt: m.createdAt,
      acceptedAt: m.acceptedAt,
      closedAt: m.closedAt,
      role: isAuthor ? 'author' : 'responder',
      otherParty: isAuthor ? m.responder : m.listing.author,
      contact: contact?.channels ?? null,
      sharingFromMe: isAuthor
        ? { email: m.listing.shareEmail, phone: m.listing.sharePhone && phoneOn }
        : { email: m.shareEmail, phone: m.sharePhone && phoneOn },
      sessionLogged: m.sessions.length > 0,
    })
  }
  return rows
}

/** The proposals sitting on one of the viewer's own listings. */
export async function listProposalsOn(listingId: string, viewerId: string) {
  const listing = await prisma.trainingListing.findUnique({ where: { id: listingId } })
  if (!listing) throw new CommunityRuleError('Listing not found', 404)
  if (listing.authorId !== viewerId) {
    throw new CommunityRuleError('Only the listing’s author can see its proposals', 403)
  }
  const matches = await prisma.trainingMatch.findMany({
    where: { listingId },
    include: { responder: { select: { id: true, name: true, username: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const phoneOn = await phoneSharingEnabled()
  return matches.map((m) => ({
    id: m.id,
    status: m.status,
    message: m.message,
    createdAt: m.createdAt,
    responder: m.responder,
    authorMessage: m.authorMessage,
    // What they have agreed to show, NOT the values. The values arrive only
    // through contactFor, after this author accepts.
    willShare: { email: m.shareEmail, phone: m.sharePhone && phoneOn },
    closedAt: m.closedAt,
  }))
}

// ── closing the loop: one action, two records ────────────────────────────────

export type LogSessionResult = {
  session: { id: string; occurredAt: Date; topic: string }
  trainer: { userId: string; claimId: string; reused: boolean; points: number }
  trainee: { userId: string; claimId: string; reused: boolean; points: number }
}

/**
 * "Log this session" on a matched listing.
 *
 * ONE action, BOTH records: the TrainingSession (the training history) and the
 * two ActivityClaims (the points) come from the same event, so they cannot
 * disagree about whether a session happened.
 *
 * Who is the trainer is decided by the LISTING, not by who pressed the button:
 * on an OFFER the author teaches, on a REQUEST the responder teaches. Passing
 * it in would let either party award themselves the larger tariff.
 *
 * Idempotent on `matchId` (a UNIQUE index), so a double press does not raise
 * four claims.
 */
export async function logSessionForMatch(params: {
  matchId: string
  userId: string
  occurredAt: Date
  branchCommunityId: string
  notes?: string
}): Promise<LogSessionResult> {
  const { matchId, userId, occurredAt, branchCommunityId } = params

  const match = await prisma.trainingMatch.findUnique({
    where: { id: matchId },
    include: { listing: true },
  })
  if (!match) throw new CommunityRuleError('Match not found', 404)
  if (match.listing.authorId !== userId && match.responderId !== userId) {
    throw new CommunityRuleError('Only the two people in a match can log its session', 403)
  }
  if (match.status !== 'ACCEPTED') {
    throw new CommunityRuleError('Log a session once the match has been accepted', 409)
  }
  if (occurredAt.getTime() > Date.now() + 60_000) {
    throw new CommunityRuleError('You cannot log a session that has not happened yet', 422)
  }

  const existing = await prisma.trainingSession.findUnique({ where: { matchId } })
  if (existing) throw new CommunityRuleError('This session has already been logged', 409)

  const trainerId = match.listing.kind === 'OFFER' ? match.listing.authorId : match.responderId
  const traineeId = trainerId === match.listing.authorId ? match.responderId : match.listing.authorId

  // Claims are raised against the BRANCH — that is where the branch admin who
  // approves them can see them. Each participant's claim goes to a branch they
  // are actually in; falling back to the branch the logger is standing on would
  // raise a claim in a branch the other person cannot be approved in.
  const trainerBranch = await claimBranchFor(trainerId, branchCommunityId)
  const traineeBranch = await claimBranchFor(traineeId, branchCommunityId)

  const trainerClaim = await raiseClaim(trainerId, trainerBranch, 'GAVE_TRAINING', occurredAt, match.listing.topic)
  const traineeClaim = await raiseClaim(traineeId, traineeBranch, 'COMPLETED_TRAINING', occurredAt, match.listing.topic)

  const session = await prisma.trainingSession.create({
    data: {
      communityId: match.listing.communityId,
      matchId,
      listingId: match.listingId,
      trainerId,
      traineeId,
      topic: match.listing.topic,
      occurredAt,
      notes: params.notes?.trim() || null,
      loggedByUserId: userId,
      trainerClaimId: trainerClaim.claimId,
      traineeClaimId: traineeClaim.claimId,
    },
  })

  for (const other of [trainerId, traineeId].filter((id) => id !== userId)) {
    await prisma.notification.create({
      data: {
        userId: other,
        type: 'SYSTEM',
        title: 'Training session logged',
        message: `${match.listing.topic} — your activity claim is with your branch admin.`,
        linkUrl: `/communities/${branchCommunityId}?tab=training`,
      },
    })
  }

  return {
    session: { id: session.id, occurredAt: session.occurredAt, topic: session.topic },
    trainer: { userId: trainerId, ...trainerClaim },
    trainee: { userId: traineeId, ...traineeClaim },
  }
}

/**
 * A branch the claimant is actually a member of. Prefers the node the logger is
 * standing on when they are in it, then their first branch in this Community.
 */
async function claimBranchFor(userId: string, standingOn: string): Promise<string> {
  if (await getCommunityMembership(userId, standingOn)) return standingOn
  const rootId = await getRootCommunityId(standingOn)
  const nodeIds = await getSubtreeIds(rootId)
  const branch = await prisma.communityMember.findFirst({
    where: {
      userId,
      communityId: { in: nodeIds },
      community: { parentCommunityId: { not: null } },
    },
    orderBy: { joinedAt: 'asc' },
    select: { communityId: true },
  })
  if (branch) return branch.communityId
  if (await getCommunityMembership(userId, rootId)) return rootId
  throw new CommunityRuleError('One of you is no longer in this Community', 409)
}

/**
 * Raise one participant's claim.
 *
 * ⚠ NOT `createActivityClaim`. That function is the SELF-claim path and takes
 * the caller's own id by construction; here one member's press raises the other
 * member's claim, which is the whole point of "one action, both records". The
 * membership rule and the one-per-day rule still apply — and a same-day
 * duplicate is REUSED rather than refused, because refusing would abort a
 * legitimate second session and leave the first participant claimed and the
 * second not. A reused claim pays NOTHING further: it has already paid.
 */
async function raiseClaim(
  userId: string,
  communityId: string,
  activityType: 'GAVE_TRAINING' | 'COMPLETED_TRAINING',
  occurredAt: Date,
  topic: string,
): Promise<{ claimId: string; reused: boolean; points: number }> {
  const tariffKey = activityType === 'GAVE_TRAINING' ? 'CLAIM_GAVE_TRAINING' : 'CLAIM_COMPLETED_TRAINING'
  const points = (await resolveTariff(tariffKey)).points

  const dayStart = new Date(occurredAt)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  // Mirrors the ActivityClaim_one_per_day index predicate: a DECLINED or
  // REVERSED claim frees the day again.
  const duplicate = await prisma.activityClaim.findFirst({
    where: {
      userId,
      activityType,
      status: { notIn: ['DECLINED', 'REVERSED'] },
      occurredAt: { gte: dayStart, lt: dayEnd },
    },
  })
  if (duplicate) return { claimId: duplicate.id, reused: true, points }

  const claim = await prisma.activityClaim.create({
    data: {
      userId,
      communityId,
      activityType,
      occurredAt,
      note: `Training exchange — ${topic}`.slice(0, 1000),
      status: 'AWARDED',
    },
  })
  // ⚠ STAGE 2e: PAY IT HERE. Under the old model this row sat PENDING until a
  // manager approved it; with pre-approval gone, a claim created without an
  // award is a claim that never pays and nothing says so.
  await awardClaimPoints({
    id: claim.id,
    userId,
    communityId,
    activityType,
  })
  return { claimId: claim.id, reused: false, points }
}

/**
 * The branch's completed sessions. Names and topics only — a session record is
 * a training history, not a contact directory, so no address is read here even
 * for the two participants.
 */
export async function listCompletedSessions(communityId: string, limit = 50) {
  const rootId = await getRootCommunityId(communityId)
  const sessions = await prisma.trainingSession.findMany({
    where: { communityId: rootId },
    include: {
      trainer: { select: { id: true, name: true, username: true } },
      trainee: { select: { id: true, name: true, username: true } },
    },
    orderBy: { occurredAt: 'desc' },
    take: limit,
  })
  return sessions.map((s) => ({
    id: s.id,
    topic: s.topic,
    occurredAt: s.occurredAt,
    trainer: s.trainer,
    trainee: s.trainee,
  }))
}
