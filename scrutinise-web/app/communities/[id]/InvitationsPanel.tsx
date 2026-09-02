'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  INVITE_STATUS_HINT,
  INVITE_STATUS_LABEL,
  type InviteStatus,
} from '@/lib/invite-status'

/**
 * CENTRAL 25-A §2 — the invitations an owner has sent, and what became of them.
 *
 * ⚠ THE POINT OF THE PANEL. Before this, a Community or branch owner could send
 * invitations and never see them again; only the platform's own admin had a
 * list. Charlie was running an invitation process blind, and 25-A §1 is what
 * that hides: five people invited through a door that could not let them in,
 * with nothing anywhere on the site saying so.
 *
 * ⚠ COLOUR IS NEVER THE ONLY CUE (docs/CLAUDE.md §21). Every status is spelled
 * out in words in the badge, and the row that needs action carries a sentence
 * saying what to do. The tint is the third cue, not the first.
 */

type Direct = {
  inviteId: string
  email: string
  name: string | null
  invitedAt: string
  invitedByName: string | null
  openedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  joinedAt: string | null
  status: InviteStatus
  live: boolean
  cannotSignUp: boolean
  inviteCode: string
}

type Arrival = {
  userId: string
  name: string | null
  email: string
  arrivedAt: string
  role: string | null
  inviteCode: string | null
}

type LinkInvite = {
  inviteId: string
  inviteCode: string
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  usedCount: number
  maxUses: number
  live: boolean
}

type Removed = {
  userId: string
  name: string | null
  username: string
  role: string
  joinedAt: string
  removedAt: string
  removedByName: string | null
  reason: string | null
}

type People = {
  direct: Direct[]
  arrivals: Arrival[]
  links: LinkInvite[]
  unattributedArrivals: number
  removed: Removed[]
}

const STATUS_TINT: Record<InviteStatus, string> = {
  JOINED: 'bg-emerald-100 text-emerald-900',
  SIGNED_UP_NOT_JOINED: 'bg-amber-100 text-amber-900',
  INVITED: 'bg-zinc-100 text-zinc-700',
  OPENED: 'bg-zinc-100 text-zinc-700',
  EXPIRED: 'bg-zinc-200 text-zinc-700',
  REVOKED: 'bg-red-100 text-red-900',
}

function fmt(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

export default function InvitationsPanel({
  communityId,
  defaultOpen = false,
}: {
  communityId: string
  defaultOpen?: boolean
}) {
  const router = useRouter()
  const [people, setPeople] = useState<People | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/communities/${communityId}/people`)
    if (res.ok) setPeople(await res.json())
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    load()
  }, [load])

  async function act(
    inviteId: string,
    init: RequestInit,
    describe: (data: Record<string, unknown>) => string,
  ) {
    setBusyId(inviteId)
    setError(null)
    setDone(null)
    try {
      const res = await fetch(`/api/communities/${communityId}/invites/${inviteId}`, init)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'That did not work.')
        return
      }
      setDone(describe(data))
      await load()
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusyId(null)
    }
  }

  const resend = (row: Direct) =>
    act(row.inviteId, { method: 'POST' }, (data) => {
      const emailed = data.emailed as { sent: boolean; reason?: string } | undefined
      return emailed?.sent
        ? `The invitation was sent to ${row.email} again.`
        : `Not sent — ${emailed?.reason ?? 'the email could not be sent'}. Copy the link and send it yourself.`
    })

  const revoke = (row: Direct) =>
    act(row.inviteId, { method: 'DELETE' }, () => `${row.email}'s invitation can no longer be used.`)

  const restore = (row: Direct) =>
    act(
      row.inviteId,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      },
      () => `${row.email}'s invitation works again.`,
    )

  async function copyLink(code: string) {
    const url = `${window.location.origin}/community-invite/${code}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError(`Copy failed — the link is ${url}`)
    }
  }

  const pending = people?.direct.filter((d) => d.status !== 'JOINED' && d.status !== 'REVOKED').length ?? 0
  const blocked = people?.direct.filter((d) => d.cannotSignUp && d.status !== 'JOINED' && d.status !== 'REVOKED').length ?? 0

  return (
    <details open={defaultOpen || blocked > 0} className="central-card p-4">
      <summary className="cursor-pointer text-sm font-medium">
        Invitations
        {pending > 0 && (
          <span className="tabular ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            {pending} outstanding
          </span>
        )}
      </summary>

      <div className="mt-3 space-y-4">
        {error && <p className="text-xs text-red-600">{error}</p>}
        {done && <p className="text-xs text-muted-foreground">{done}</p>}

        {loading && !people ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : !people ? (
          <p className="text-xs text-muted-foreground">The invitation list could not be loaded.</p>
        ) : (
          <>
            {/* ── §2a — everyone invited directly ───────────────────────── */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Invited directly
              </h3>
              {people.direct.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nobody has been invited to this team by email yet.
                </p>
              ) : (
                people.direct.map((row) => (
                  <div key={row.inviteId} className="central-inset p-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">{row.name ?? row.email}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TINT[row.status]}`}
                      >
                        {INVITE_STATUS_LABEL[row.status]}
                      </span>
                    </div>
                    {row.name && <p className="text-xs text-muted-foreground">{row.email}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Invited {fmt(row.invitedAt)}
                      {row.invitedByName ? ` by ${row.invitedByName}` : ''}
                      {row.openedAt ? ` · link opened ${fmt(row.openedAt)}` : ''}
                      {row.joinedAt ? ` · joined ${fmt(row.joinedAt)}` : ''}
                      {row.expiresAt && !row.joinedAt ? ` · expires ${fmt(row.expiresAt)}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {INVITE_STATUS_HINT[row.status]}
                    </p>

                    {/* ⚠⚠ 25-A §1 ON THE ROW. Nothing the owner does inside the
                        Community fixes this one — the platform's own sign-up
                        door will refuse them until a Scrutinise invitation is
                        issued to that address. */}
                    {row.cannotSignUp && row.status !== 'JOINED' && row.status !== 'REVOKED' && (
                      <p className="mt-1.5 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                        <strong>They cannot create an account with this invitation.</strong>{' '}
                        It has expired, been withdrawn or been used up, so it no longer authorises
                        an account for {row.email} — the sign-up page will turn them away and the
                        sign-in page will tell them their account cannot be found. Send them a
                        fresh invitation.
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.status !== 'JOINED' && !row.revokedAt && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={busyId === row.inviteId}
                          onClick={() => resend(row)}
                        >
                          Resend
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={busyId === row.inviteId}
                        onClick={() => copyLink(row.inviteCode)}
                      >
                        {copied === row.inviteCode ? 'Copied' : 'Copy link'}
                      </Button>
                      {row.revokedAt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={busyId === row.inviteId}
                          onClick={() => restore(row)}
                        >
                          Restore
                        </Button>
                      ) : (
                        row.status !== 'JOINED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            disabled={busyId === row.inviteId}
                            onClick={() => revoke(row)}
                          >
                            Revoke
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── §2b — arrivals through a shared link ──────────────────── */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Arrived through a shared link
              </h3>
              {people.arrivals.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nobody has joined through a shared link yet.
                </p>
              ) : (
                people.arrivals.map((a) => (
                  <div key={a.userId} className="central-inset p-2">
                    <p className="text-sm font-medium">{a.name ?? a.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Arrived {fmt(a.arrivedAt)} ·{' '}
                      {a.role ? `now a ${a.role.toLowerCase()} here` : 'no longer a member here'}
                    </p>
                  </div>
                ))
              )}
              {people.unattributedArrivals > 0 && (
                <p className="text-xs text-muted-foreground">
                  {people.unattributedArrivals} earlier{' '}
                  {people.unattributedArrivals === 1 ? 'arrival is' : 'arrivals are'} not listed
                  here: they joined before we recorded which invitation was used, so we know they
                  were introduced but not through which link.
                </p>
              )}
            </div>

            {/* ── Shared links themselves ───────────────────────────────── */}
            {people.links.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Shared links
                </h3>
                {people.links.map((l) => (
                  <div key={l.inviteId} className="central-inset p-2">
                    <p className="text-xs text-muted-foreground">
                      Created {fmt(l.createdAt)} · used {l.usedCount} of {l.maxUses} ·{' '}
                      {l.revokedAt
                        ? 'withdrawn'
                        : l.live
                          ? 'anyone holding it can join'
                          : 'no longer usable'}
                    </p>
                    <div className="mt-1.5 flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => copyLink(l.inviteCode)}
                      >
                        {copied === l.inviteCode ? 'Copied' : 'Copy link'}
                      </Button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  A shared link is not tied to one person, so it does not admit anybody by itself:
                  whoever opens it and asks to join appears under &ldquo;Requests to join&rdquo;,
                  and someone with the right to invite lets them in.
                </p>
              </div>
            )}

            {/* ── §3c — people who were removed, kept ────────────────── */}
            {people.removed.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  No longer in this team
                </h3>
                {people.removed.map((r) => (
                  <div key={`${r.userId}-${r.removedAt}`} className="central-inset p-2">
                    <p className="text-sm font-medium">{r.name ?? r.username}</p>
                    <p className="text-xs text-muted-foreground">
                      Was a {r.role.toLowerCase()} from{' '}
                      {new Date(r.joinedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: '2-digit',
                      })}{' '}
                      until {fmt(r.removedAt)}
                      {r.removedByName ? `, removed by ${r.removedByName}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.reason ? `Reason given: “${r.reason}”` : 'No reason was recorded.'}
                    </p>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Removing somebody takes away their access here. Everything they wrote — posts,
                  questions, answers — stays where it is, still under their name.
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              &ldquo;Link opened&rdquo; means the invitation page was loaded. Some email systems
              follow links automatically, so it is evidence the link works rather than proof the
              person read it.
            </p>
          </>
        )}
      </div>
    </details>
  )
}
