'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Member {
  userId: string
  name: string | null
  username: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
}

const ROLE_BADGE: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  MEMBER: 'bg-zinc-100 text-zinc-600',
}

/**
 * Members of this node, with role management. Shown to anyone with manage
 * rights — a member list is a management surface, not the node's content, so it
 * follows manage rights rather than membership (the board does not).
 *
 * OWNER is fixed here: not demotable, not removable. A co-admin who could
 * demote the owner could take the node.
 */
export default function MembersPanel({
  communityId,
  defaultOpen = false,
}: {
  communityId: string
  defaultOpen?: boolean
}) {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/communities/${communityId}/members`)
    if (res.ok) setMembers((await res.json()).members)
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    load()
  }, [load])

  async function act(userId: string, run: () => Promise<Response>) {
    setBusyId(userId)
    setError(null)
    try {
      const res = await run()
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'That did not work.')
        return
      }
      await load()
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusyId(null)
      setConfirmRemove(null)
    }
  }

  const setRole = (userId: string, role: 'ADMIN' | 'MEMBER') =>
    act(userId, () =>
      fetch(`/api/communities/${communityId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      }),
    )

  const remove = (userId: string) =>
    act(userId, () => fetch(`/api/communities/${communityId}/members/${userId}`, { method: 'DELETE' }))

  return (
    <details open={defaultOpen} className="central-card p-4">
      <summary className="cursor-pointer text-sm font-medium">
        Members
        {!loading && <span className="tabular ml-2 text-xs text-muted-foreground">{members.length}</span>}
      </summary>

      <div className="mt-3 space-y-1.5">
        {error && <p className="text-xs text-red-600">{error}</p>}
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-xs text-muted-foreground">No one has joined this branch yet.</p>
        ) : (
          members.map((m) => (
            <div key={m.userId} className="central-inset px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm">
                  {m.name ?? m.username}
                  <span className="ml-1 text-xs text-muted-foreground">@{m.username}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[m.role]}`}>
                  {m.role}
                </span>
              </div>

              {m.role !== 'OWNER' && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {m.role === 'MEMBER' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                      disabled={busyId === m.userId}
                      onClick={() => setRole(m.userId, 'ADMIN')}
                    >
                      Make admin
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                      disabled={busyId === m.userId}
                      onClick={() => setRole(m.userId, 'MEMBER')}
                    >
                      Remove admin
                    </Button>
                  )}
                  {confirmRemove === m.userId ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs text-red-600"
                        disabled={busyId === m.userId}
                        onClick={() => remove(m.userId)}
                      >
                        Confirm removal
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() => setConfirmRemove(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-muted-foreground"
                      onClick={() => setConfirmRemove(m.userId)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <p className="pt-1 text-xs text-muted-foreground">
          The owner’s role is fixed here — ownership has to be handed over, not demoted.
        </p>
      </div>
    </details>
  )
}
