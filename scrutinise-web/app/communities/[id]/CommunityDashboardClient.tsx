'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { CommunityTreeNode } from '@/lib/community'
import TeamsTree from './TeamsTree'
import BulletinBoard from './BulletinBoard'

interface Member {
  userId: string
  name: string | null
  username: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
}

interface Props {
  community: {
    id: string
    name: string
    description: string | null
    parent: { id: string; name: string } | null
    managerId: string | null
  }
  myRole: 'OWNER' | 'ADMIN' | 'MEMBER'
  members: Member[]
  tree: CommunityTreeNode
}

const ROLE_BADGE: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  MEMBER: 'bg-zinc-100 text-zinc-600',
}

export default function CommunityDashboardClient({ community, myRole, members, tree }: Props) {
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN'
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

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
        <p className="text-xs text-muted-foreground mb-2">
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
          </div>
          {community.description && (
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">{community.description}</p>
          )}
        </div>
        {canManage && (
          <div className="flex flex-col items-end gap-2">
            <Button size="sm" variant="outline" onClick={handleGenerateInvite} disabled={generating}>
              {generating ? 'Generating…' : 'Generate invite link'}
            </Button>
            {inviteLink && (
              <input
                readOnly
                value={inviteLink}
                onFocus={(e) => e.currentTarget.select()}
                className="text-xs border rounded px-2 py-1 w-64 bg-muted/40"
              />
            )}
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold">Bulletin board</h2>
          <BulletinBoard communityId={community.id} />
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="mb-4 text-base font-semibold">Teams &amp; branches</h2>
            <div className="rounded-lg border border-border p-4">
              <TeamsTree communityId={community.id} tree={tree} members={members} canManage={canManage} />
            </div>
          </div>

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
