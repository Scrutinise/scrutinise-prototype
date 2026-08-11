'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CommunityTreeNode } from '@/lib/community'

/**
 * "Find your branch" — what a Community-level invitee sees after the rules
 * screen: the top-level branches with a Request button each, and the option to
 * found their own.
 *
 * NOT a one-shot wizard. It stays on the Community page for anyone who is not
 * yet in a branch, and the tree offers the same actions, so someone who skips
 * past it can come back without hunting for a link.
 */
export default function FindYourBranch({
  root,
  branches,
}: {
  root: { id: string; name: string }
  branches: CommunityTreeNode[]
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  async function request(branch: CommunityTreeNode) {
    setBusyId(branch.id)
    setError(null)
    try {
      const res = await fetch(`/api/communities/${branch.id}/join-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not send that request.')
        return
      }
      setSent((prev) => new Set(prev).add(branch.id))
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusyId(null)
    }
  }

  async function createBranch(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setBusyId('new')
    setError(null)
    try {
      const res = await fetch(`/api/communities/${root.id}/children`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not create that branch.')
        return
      }
      router.push(`/communities/${data.community.id}`)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mb-6 central-card bg-muted/30 p-4">
      <h2 className="text-sm font-semibold">Find your branch</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        You’re a member of {root.name}. Branches are where the local work happens — ask to join one,
        or start the one your area is missing.
      </p>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 space-y-1.5">
        {branches.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            There are no branches yet — yours would be the first.
          </p>
        ) : (
          branches.map((b) => {
            const isMember = b.viewerRole !== null
            const pending = b.viewerHasPendingRequest || sent.has(b.id)
            return (
              <div
                key={b.id}
                className="central-inset flex items-center justify-between gap-2 bg-background px-2 py-1.5"
              >
                <span className="min-w-0 truncate text-sm">
                  {b.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {b.memberCount} member{b.memberCount !== 1 ? 's' : ''}
                  </span>
                </span>
                {isMember ? (
                  <span className="shrink-0 text-xs text-emerald-700">You’re in this one</span>
                ) : pending ? (
                  <span className="shrink-0 text-xs text-muted-foreground">Request pending</span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 px-2 text-xs"
                    disabled={busyId === b.id}
                    onClick={() => request(b)}
                  >
                    {busyId === b.id ? 'Sending…' : 'Request to join'}
                  </Button>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        {creating ? (
          <form onSubmit={createBranch} className="flex flex-wrap items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Branch name — e.g. your town"
              className="h-8 w-56 text-sm"
              maxLength={100}
              autoFocus
            />
            <Button size="sm" type="submit" disabled={busyId === 'new'}>
              {busyId === 'new' ? 'Creating…' : 'Create branch'}
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            Create your own branch
          </Button>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground">
          You’ll be its owner, and can invite people to it straight away.
        </p>
      </div>
    </div>
  )
}
