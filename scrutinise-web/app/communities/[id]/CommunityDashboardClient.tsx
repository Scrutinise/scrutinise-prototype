'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { CommunityTreeNode } from '@/lib/community'
import TeamsTree from './TeamsTree'
import BulletinBoard from './BulletinBoard'
import InvitePanel from './InvitePanel'
import RequestsPanel from './RequestsPanel'
import MembersPanel from './MembersPanel'
import SwitchOrAddChooser from './SwitchOrAddChooser'
import FindYourBranch from './FindYourBranch'
import ClaimsPanel from './ClaimsPanel'
import LogActivity from './LogActivity'
import Leaderboards from './Leaderboards'
import TrainingExchange from './TrainingExchange'
import QuestionLibrary, { type QuestionRow, type TagSet } from './questions/QuestionLibrary'

export type CentralTab = 'questions' | 'board' | 'training' | 'leaderboard' | 'teams'

/**
 * Central's sub-tabs.
 *
 * BOARD IS HIDDEN FOR THE PILOT (Charlie, 11 Aug 2026). The bulletin board code
 * is untouched and still renders when `tab=board` is reached directly — it is
 * simply not linked here. Putting it back is deleting the `hidden` flag on one
 * entry in this array, which is the one-line reversal that was asked for.
 *
 * TEAMS IS A TAB AS OF STAGE 2d. "Teams & branches" and the "Managing {node}"
 * rail used to sit above every tab, which made the two areas people actually
 * use — Questions and Training — read as an admin console with some content
 * underneath. They are the same job (managing people and structure), so they
 * are one tab, still admin-gated where they always were.
 */
const TABS: { key: CentralTab; label: string; hidden?: boolean }[] = [
  { key: 'questions', label: 'Questions' },
  { key: 'board', label: 'Board', hidden: true },
  { key: 'training', label: 'Training' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'teams', label: 'Teams' },
]

interface Props {
  community: {
    id: string
    name: string
    description: string | null
    parent: { id: string; name: string } | null
    managerId: string | null
  }
  root: { id: string; name: string }
  myRole: 'OWNER' | 'ADMIN' | 'MEMBER' | null
  canManage: boolean
  /** Manage rights over the ROOT — the Community-admin powers. */
  isCommunityAdmin: boolean
  tree: CommunityTreeNode
  otherBranches: { id: string; name: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' }[]
  showSwitchChooser: boolean
  openPanel: 'requests' | 'members' | 'claims' | null
  isCommunityMember: boolean
  hasPendingRequest: boolean
  myPoints: number
  tab: CentralTab
  questionTags: TagSet
  initialQuestions: QuestionRow[]
  /** The uploader's own name, shown on the bulk-upload screen because every
   *  row imports as authored by them. */
  myName: string
  /** Stage 2e — how many things on this node are waiting for a manager.
   *  Zero for anyone who cannot act on them. */
  pendingForManager: number
}

const ROLE_BADGE: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  MEMBER: 'bg-zinc-100 text-zinc-600',
}

export default function CommunityDashboardClient({
  community,
  root,
  myRole,
  canManage,
  isCommunityAdmin,
  tree,
  otherBranches,
  showSwitchChooser,
  openPanel,
  isCommunityMember,
  hasPendingRequest,
  myPoints,
  tab,
  questionTags,
  initialQuestions,
  myName,
  pendingForManager,
}: Props) {
  const router = useRouter()
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [requestState, setRequestState] = useState<'idle' | 'busy' | 'sent'>(
    hasPendingRequest ? 'sent' : 'idle',
  )
  const [requestMessage, setRequestMessage] = useState('')
  const [requestError, setRequestError] = useState<string | null>(null)
  const isBranch = community.parent !== null
  const isMember = myRole !== null

  const topLevelBranches = tree.children
  const inAnyBranch = otherBranches.length > 0
  const showFindYourBranch = !isBranch && isMember && !inAnyBranch

  async function handleRequestToJoin() {
    setRequestState('busy')
    setRequestError(null)
    const res = await fetch(`/api/communities/${community.id}/join-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: requestMessage.trim() || undefined }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setRequestError(typeof data.error === 'string' ? data.error : 'Could not send that request.')
      setRequestState('idle')
      return
    }
    setRequestState('sent')
    router.refresh()
  }

  async function handleGenerateInvite() {
    setGenerating(true)
    const res = await fetch(`/api/communities/${community.id}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxUses: 50, expiresInDays: 30 }),
    })
    if (res.ok) {
      const data = await res.json()
      setInviteLink(`${window.location.origin}/community-invite/${data.invite.inviteCode}`)
    }
    setGenerating(false)
  }

  async function handleLeave() {
    setLeaveError(null)
    const res = await fetch(`/api/communities/${community.id}/leave`, { method: 'POST' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setLeaveError(typeof data.error === 'string' ? data.error : 'Could not leave.')
      return
    }
    router.push(isBranch ? `/communities/${root.id}` : '/communities')
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* ── the header: breadcrumb, name, role badge, points. Nothing else. ── */}
      {community.parent && (
        <p className="mb-2 text-xs text-muted-foreground">
          <Link href={`/communities/${community.parent.id}`} className="hover:underline">
            ← {community.parent.name}
          </Link>
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{community.name}</h1>
            {myRole ? (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[myRole]}`}>{myRole}</span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Managing from above
              </span>
            )}
            {isBranch && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">Branch</span>
            )}
          </div>
          {community.description && (
            <p className="mt-1 max-w-xl text-sm text-muted-foreground pretty">{community.description}</p>
          )}
        </div>
        {isMember && (
          <span className="text-xs text-muted-foreground">
            Your points:{' '}
            <span className="tabular font-semibold text-foreground">
              {myPoints > 0 ? '+' : ''}{myPoints}
            </span>
          </span>
        )}
      </div>

      {/* Shown once, straight after joining. Not an admin rail — a prompt that
          answers "what now?", so it stays above the tabs. */}
      {showSwitchChooser && (
        <SwitchOrAddChooser branchName={community.name} otherBranches={otherBranches} />
      )}

      {/* Sub-tabs — the "in the community" areas, plus Teams. */}
      <div className="mb-5 flex flex-wrap gap-1 border-b border-border pb-2">
        {TABS.filter((t) => !t.hidden).map((t) => (
          <Link
            key={t.key}
            href={`/communities/${community.id}?tab=${t.key}`}
            aria-current={tab === t.key ? 'page' : undefined}
            className={`rounded-[7px] px-3 py-1.5 text-[13px] transition-colors ${
              tab === t.key
                ? 'bg-[oklch(0.955_0.004_250)] font-semibold text-foreground ring-1 ring-inset ring-border'
                : 'font-medium text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {/* Stage 2e — a badge on Teams, so something waiting on a manager is
                visible from wherever they happen to be standing. It counts what
                can actually be acted on: with pre-approval gone, that is join
                requests plus anything the old model left pending. */}
            {t.key === 'teams' && pendingForManager > 0 && (
              <span className="tabular ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                {pendingForManager}
              </span>
            )}
          </Link>
        ))}
      </div>

      {!isMember && !canManage ? (
        <div className="central-card border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {community.name} is invite-only — its content is private to its members.
          </p>
          {isCommunityMember && requestState === 'sent' && (
            <p className="mt-4 text-sm text-muted-foreground">
              Your request is with its admins — you’ll hear back in your Feed.
            </p>
          )}
          {isCommunityMember && requestState !== 'sent' && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <input
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Say why (optional)"
                maxLength={500}
                className="w-full max-w-sm rounded-lg border bg-background px-2 py-1.5 text-sm"
              />
              <Button size="sm" disabled={requestState === 'busy'} onClick={handleRequestToJoin}>
                {requestState === 'busy' ? 'Sending…' : 'Request to join'}
              </Button>
              {requestError && <p className="text-xs text-red-600">{requestError}</p>}
            </div>
          )}
        </div>
      ) : tab === 'questions' ? (
        <QuestionLibrary
          communityId={community.id}
          tags={questionTags}
          initialQuestions={initialQuestions}
          canBulkUpload={isCommunityAdmin}
          uploaderName={myName}
        />
      ) : tab === 'board' ? (
        // Reachable only by URL while the tab is hidden. Untouched.
        <BulletinBoard
          communityId={community.id}
          boardName={community.name}
          isBranch={isBranch}
          communityName={root.name}
          canModerate={canManage}
          canPost={isMember}
        />
      ) : tab === 'training' ? (
        <TrainingExchange communityId={community.id} communityName={root.name} />
      ) : tab === 'teams' ? (
        /* ── Teams: structure and the people who manage it, in one place ──── */
        <div className="space-y-4">
          {showFindYourBranch && <FindYourBranch root={root} branches={topLevelBranches} />}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-3">
              <h2 className="text-sm font-semibold">Teams &amp; branches</h2>
              <div className="central-card p-4">
                <TeamsTree
                  communityId={community.id}
                  tree={tree}
                  rootIsBranch={isBranch}
                  isCommunityMember={isCommunityMember}
                />
              </div>
              {isMember && myRole !== 'OWNER' && (
                <div>
                  <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={handleLeave}>
                    Leave {isBranch ? 'this branch' : 'this Community'}
                  </Button>
                  {leaveError && <p className="mt-1 text-xs text-red-600">{leaveError}</p>}
                </div>
              )}
            </div>
            {canManage && (
              <div className="space-y-2.5">
                <h2 className="text-sm font-semibold">
                  Managing {community.name}
                  {pendingForManager > 0 && (
                    <span className="tabular ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      {pendingForManager} waiting
                    </span>
                  )}
                </h2>
                <RequestsPanel
                  communityId={community.id}
                  communityName={community.name}
                  defaultOpen={openPanel === 'requests'}
                />
                <ClaimsPanel communityId={community.id} defaultOpen={openPanel === 'claims'} />
                <MembersPanel communityId={community.id} defaultOpen={openPanel === 'members'} />
                <details className="central-card p-4">
                  <summary className="cursor-pointer text-sm font-medium">Invite people</summary>
                  <div className="mt-3 space-y-3">
                    <InvitePanel communityId={community.id} />
                    <div className="border-t border-border pt-3">
                      <Button size="sm" variant="outline" onClick={handleGenerateInvite} disabled={generating}>
                        {generating ? 'Generating…' : 'Or generate a shareable link'}
                      </Button>
                      {inviteLink && (
                        <input
                          readOnly
                          value={inviteLink}
                          onFocus={(e) => e.currentTarget.select()}
                          className="mt-2 w-full rounded-lg border bg-muted/40 px-2 py-1 text-xs"
                        />
                      )}
                    </div>
                  </div>
                </details>
                {isCommunityAdmin && (
                  <>
                    <Button asChild size="sm" variant="outline" className="w-full rounded-lg">
                      <Link href={`/communities/${community.id}/across-branches`}>Across branches</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="w-full rounded-lg">
                      <Link href={`/communities/${community.id}/topics`}>Topics</Link>
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Points &amp; leaderboards</h2>
              <Link
                href={`/communities/${community.id}/activity`}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Activity log
              </Link>
            </div>
            <Leaderboards communityId={community.id} rootName={root.name} />
          </div>
          <LogActivity communityId={community.id} communityName={community.name} />
        </div>
      )}
    </main>
  )
}
