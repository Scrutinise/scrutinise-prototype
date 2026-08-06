'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { CommunityTreeNode } from '@/lib/community'
import TeamsTree from './TeamsTree'
import BulletinBoard from './BulletinBoard'
import InvitePanel from './InvitePanel'

interface Props {
  community: {
    id: string
    name: string
    description: string | null
    parent: { id: string; name: string } | null
    managerId: string | null
  }
  /** The top-level Community this board belongs to (itself, if top-level). */
  root: { id: string; name: string }
  myRole: 'OWNER' | 'ADMIN' | 'MEMBER'
  /** OWNER/ADMIN here or anywhere above here in the tree. */
  canManage: boolean
  tree: CommunityTreeNode
}

const ROLE_BADGE: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  MEMBER: 'bg-zinc-100 text-zinc-600',
}

export default function CommunityDashboardClient({ community, root, myRole, canManage, tree }: Props) {
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const isBranch = community.parent !== null

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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {community.parent && (
        <p className="mb-2 text-xs text-muted-foreground">
          <Link href={`/communities/${community.parent.id}`} className="hover:underline">
            ← {community.parent.name}
          </Link>
        </p>
      )}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{community.name}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[myRole]}`}>{myRole}</span>
            {isBranch && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">Branch</span>
            )}
          </div>
          {community.description && (
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{community.description}</p>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold">Bulletin board</h2>
          <BulletinBoard
            communityId={community.id}
            boardName={community.name}
            isBranch={isBranch}
            communityName={root.name}
          />
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="mb-4 text-base font-semibold">Teams &amp; branches</h2>
            <div className="rounded-lg border border-border p-4">
              <TeamsTree
                communityId={community.id}
                tree={tree}
                canManage={canManage}
                rootIsBranch={isBranch}
              />
            </div>
          </div>

          {canManage && (
            <div>
              <h2 className="mb-4 text-base font-semibold">Invite people</h2>
              <div className="space-y-3 rounded-lg border border-border p-4">
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
                      className="mt-2 w-full rounded border bg-muted/40 px-2 py-1 text-xs"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-4 text-base font-semibold">Points &amp; leaderboards</h2>
            <div className="rounded-lg border border-border p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Coming soon — points and leaderboards for this Community.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
