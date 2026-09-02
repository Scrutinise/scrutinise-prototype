'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Member {
  userId: string
  name: string | null
  username: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  /** CENTRAL 25-A §2c — when they joined. The route has always returned it;
   *  nothing rendered it, so "who is here" could not be read against "who was
   *  invited and when". */
  joinedAt: string | null
  /** CENTRAL 25-A §7h — who brought them in. Null means nobody did. */
  invitedByName: string | null
  /** CENTRAL 25-A §7e — the Community's own title, never a platform role. */
  titleId: string | null
  titleName: string | null
}

type Title = { id: string; name: string; grantsInvite: boolean }

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
  isBranch = false,
  nodeName = 'this branch',
}: {
  communityId: string
  defaultOpen?: boolean
  /** CENTRAL 25-B §5 — ownership moves on BRANCHES only; the root is not vacatable. */
  isBranch?: boolean
  nodeName?: string
}) {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [titles, setTitles] = useState<Title[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  // §5 — the ownership controls. `ownerAction` is the row being acted on, and a
  // reason is required before either call is allowed to fire (decision 51).
  const [ownerAction, setOwnerAction] = useState<{ kind: 'vacate' | 'appoint'; userId: string } | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/communities/${communityId}/members`)
    if (res.ok) {
      const data = await res.json()
      setMembers(data.members)
      setTitles(data.titles ?? [])
    }
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    load()
  }, [load])

  const vacant = !members.some((m) => m.role === 'OWNER')

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

  /** 25-A §7e — a title inside this Community. It changes nothing about them on Scrutinise. */
  const setTitle = (userId: string, titleId: string | null) =>
    act(userId, () =>
      fetch(`/api/communities/${communityId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titleId }),
      }),
    )

  const remove = (userId: string) =>
    act(userId, () => fetch(`/api/communities/${communityId}/members/${userId}`, { method: 'DELETE' }))

  /**
   * §5 — stand the branch manager down, or appoint one.
   *
   * ⚠ A separate route from the role control on purpose: `setMemberRole` still
   * refuses to touch an OWNER, and it should. These are deliberate acts with a
   * recorded reason, not a rung on the role ladder.
   */
  function ownership(userId: string, kind: 'vacate' | 'appoint') {
    const body = kind === 'vacate' ? { action: 'vacate', reason } : { action: 'appoint', userId, reason }
    return act(userId, () =>
      fetch(`/api/communities/${communityId}/ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    ).then(() => {
      setOwnerAction(null)
      setReason('')
    })
  }

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
              {/* 25-A §2c — when they joined. Never blank: a member row whose
                  join date we do not hold says so, because a blank cell and a
                  date we never recorded read identically and are not. */}
              <p className="text-xs text-muted-foreground">
                {m.joinedAt
                  ? `Joined ${new Date(m.joinedAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: '2-digit',
                    })}`
                  : 'Join date not recorded'}
                {' · '}
                {/* ⚠ 25-A §7h — never blank. "Nobody invited them" and "we did not
                    record it" are different facts, and both are said in words. */}
                {m.invitedByName ? `Invited by ${m.invitedByName}` : 'Joined without an invitation'}
              </p>
              {/* ── §7e — the Community's own title ─────────────────────────── */}
              <div className="mt-1 flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground" htmlFor={`title-${m.userId}`}>
                  Title
                </label>
                <select
                  id={`title-${m.userId}`}
                  className="h-6 rounded border bg-background px-1 text-xs"
                  value={m.titleId ?? ''}
                  disabled={busyId === m.userId || titles.length === 0}
                  onChange={(e) => setTitle(m.userId, e.target.value || null)}
                >
                  <option value="">{titles.length === 0 ? 'No titles defined yet' : 'No title'}</option>
                  {titles.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.grantsInvite ? ' — can invite' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* ⚠⚠ CENTRAL 25-B §5 — THE OWNER ROW USED TO RENDER NOTHING AT ALL.
                  Ownership was written once, at creation, and there was no
                  control anywhere that could move it — so a branch manager who
                  left, went quiet or was removed could never be replaced, and
                  the branch could only be deleted and rebuilt. On a branch, the
                  manager can now be stood down; the position then stays vacant
                  until somebody is appointed, which is a state real branches are
                  in and the product has to be able to show. */}
              {m.role === 'OWNER' && isBranch && (
                <div className="mt-1.5">
                  {ownerAction?.kind === 'vacate' && ownerAction.userId === m.userId ? (
                    <div className="space-y-1.5">
                      <label className="block text-xs text-muted-foreground" htmlFor={`why-${m.userId}`}>
                        Why are they standing down? This is recorded.
                      </label>
                      <input
                        id={`why-${m.userId}`}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        maxLength={500}
                        placeholder="e.g. stood down at the branch AGM"
                        className="w-full rounded border bg-background px-2 py-1 text-xs"
                      />
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          disabled={busyId === m.userId || !reason.trim()}
                          onClick={() => ownership(m.userId, 'vacate')}
                        >
                          Stand them down
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            setOwnerAction(null)
                            setReason('')
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-muted-foreground"
                      onClick={() => {
                        setOwnerAction({ kind: 'vacate', userId: m.userId })
                        setReason('')
                      }}
                    >
                      Stand down as branch manager
                    </Button>
                  )}
                </div>
              )}

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
                  {/* §5 — appoint. Works whether the position is vacant or held;
                      an incumbent is stood down in the same transaction. */}
                  {isBranch &&
                    (ownerAction?.kind === 'appoint' && ownerAction.userId === m.userId ? null : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-muted-foreground"
                        onClick={() => {
                          setOwnerAction({ kind: 'appoint', userId: m.userId })
                          setReason('')
                        }}
                      >
                        {vacant ? 'Make branch manager' : 'Make branch manager instead'}
                      </Button>
                    ))}
                </div>
              )}

              {ownerAction?.kind === 'appoint' && ownerAction.userId === m.userId && (
                <div className="mt-1.5 space-y-1.5">
                  <label className="block text-xs text-muted-foreground" htmlFor={`appoint-${m.userId}`}>
                    Why are they being appointed? This is recorded.
                  </label>
                  <input
                    id={`appoint-${m.userId}`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                    placeholder="e.g. elected at the branch AGM"
                    className="w-full rounded border bg-background px-2 py-1 text-xs"
                  />
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                      disabled={busyId === m.userId || !reason.trim()}
                      onClick={() => ownership(m.userId, 'appoint')}
                    >
                      Appoint
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        setOwnerAction(null)
                        setReason('')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        {/* ⚠ §5b — A VACANT BRANCH IS A REAL STATE, NOT AN ERROR. Real branches
            sometimes have no chair, and the product has to be able to say so
            rather than showing a members list that quietly has no manager in it. */}
        {isBranch && vacant && !loading && (
          <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
            <strong>{nodeName} has no branch manager.</strong> The branch and everything in it are
            unaffected, and the Community’s admins can still manage it — but nobody here is
            accountable for it until somebody is appointed.
          </p>
        )}
        <p className="pt-1 text-xs text-muted-foreground">
          The owner’s role is not a rung on this ladder — a branch manager is stood down or
          appointed as its own act, with a reason, and it is recorded.
        </p>
        <p className="text-xs text-muted-foreground">
          A title is this Community’s own word for somebody — &ldquo;Branch Chair&rdquo; and the
          like — and it means nothing anywhere else on Scrutinise. Titles are created in Community
          settings.
        </p>
      </div>
    </details>
  )
}
