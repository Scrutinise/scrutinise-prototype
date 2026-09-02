'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Found {
  id: string
  name: string | null
  username: string
  isMember: boolean
}

/**
 * Invite people to this Community. Admin only.
 *
 * The 6 Aug user test found that searching by a known user's email address
 * returned nothing while their first name worked, and that an address with no
 * account behind it simply failed. Both are handled here: the lookup matches an
 * exact address or a name substring, and an unmatched address is offered as an
 * invite in its own right, because most invites go to people who are not on the
 * platform yet.
 */
export default function InvitePanel({
  communityId,
  isBranch,
  nodeName,
}: {
  communityId: string
  /** CENTRAL 25-A §7f — a branch invitation and a Community-wide one are for different people. */
  isBranch: boolean
  nodeName: string
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Found[]>([])
  const [emailFallback, setEmailFallback] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{
    label: string
    link: string
    notified: boolean
    emailed: { sent: boolean; reason?: string } | null
  } | null>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults([])
      setEmailFallback(null)
      setSearched(false)
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      setError(null)
      try {
        const res = await fetch(`/api/communities/${communityId}/invites/lookup?q=${encodeURIComponent(term)}`)
        const data = await res.json()
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Lookup failed')
          return
        }
        setResults(data.users ?? [])
        setEmailFallback(data.canInviteEmail ?? null)
        setSearched(true)
      } catch {
        setError('Network error — please try again.')
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, communityId])

  async function createInvite(payload: { userId?: string; email?: string }, label: string, key: string) {
    setBusyId(key)
    setError(null)
    try {
      const res = await fetch(`/api/communities/${communityId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, expiresInDays: 30 }),
      })

      // ⚠ READ THE BODY AS TEXT FIRST. This used to be `await res.json()`, which
      // threw on any non-JSON response and collapsed every failure into
      // "Network error", and on a JSON body without a string `error` fell back
      // to a bare "Could not create the invite" that named nothing. On 26 Aug
      // 2026 that left a real failure undiagnosable: the panel had thrown away
      // the only evidence of what the server actually said.
      const raw = await res.text()
      let data: Record<string, unknown> = {}
      try {
        data = raw ? JSON.parse(raw) : {}
      } catch {
        data = {}
      }

      if (!res.ok) {
        const serverSaid = typeof data.error === 'string' ? data.error : ''
        setError(
          serverSaid
            ? serverSaid
            : `The server refused this (HTTP ${res.status})${
                raw ? ` — ${raw.slice(0, 200)}` : ' with an empty response'
              }`,
        )
        return
      }
      const invite = data.invite as { inviteCode?: string } | undefined
      if (!invite?.inviteCode) {
        setError(`The invite came back without a code (HTTP ${res.status}) — nothing was sent.`)
        return
      }
      setIssued({
        label,
        link: `${window.location.origin}/community-invite/${invite.inviteCode}`,
        notified: Boolean(data.notified),
        emailed: (data.emailed as { sent: boolean; reason?: string } | null) ?? null,
      })
      setQ('')
      setResults([])
      setEmailFallback(null)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-3">
      {/* ⚠ CENTRAL 25-A §7f — WHO THIS INVITATION IS FOR, said before it is sent.
          The scope is already enforced (a branch's people can only invite into
          their own branch and the branches under it), but nothing on screen said
          what a Community-wide invitation is FOR — and Charlie's rule is that it
          is for branch chairs, with everybody else invited from their branch. */}
      <p className="rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
        {isBranch ? (
          <>
            Whoever you invite here joins <strong>{nodeName}</strong>, and the Community it sits in
            with it. This is the way to bring in the people of your own branch.
          </>
        ) : (
          <>
            This invites somebody to <strong>{nodeName}</strong> as a whole, which is meant for
            branch chairs. Everybody else should be invited from their own branch, by the person
            who runs it — that way the branch has a record of who brought them in.
          </>
        )}
      </p>
      <div>
        <label htmlFor="invite-lookup" className="mb-1 block text-xs font-medium text-muted-foreground">
          Find someone by name or email address
        </label>
        <Input
          id="invite-lookup"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Charlie, or charlie@example.com"
          className="h-9"
        />
      </div>

      {searching && <p className="text-xs text-muted-foreground">Searching…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5">
              <span className="min-w-0 truncate text-sm">
                {r.name ?? r.username}
                <span className="ml-1 text-xs text-muted-foreground">@{r.username}</span>
              </span>
              {r.isMember ? (
                <span className="shrink-0 text-xs text-muted-foreground">Already a member</span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 px-2 text-xs"
                  disabled={busyId === r.id}
                  onClick={() => createInvite({ userId: r.id }, r.name ?? r.username, r.id)}
                >
                  {busyId === r.id ? 'Inviting…' : 'Invite'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ⚠ AN ADDRESS WITH NO ACCOUNT IS THE NORMAL CASE, NOT AN EXCEPTION.
          Most people invited to a branch have never heard of Scrutinise, so a
          branch chair's address matching nobody is the expected outcome of this
          search. This used to read "No account for X yet." above a button
          labelled "Invite this address anyway" — a dead end and a word that
          framed the ordinary path as a concession. One line, one primary
          action, no red. */}
      {emailFallback && (
        <div className="rounded border border-border bg-muted/40 p-2">
          <p className="text-xs text-muted-foreground">
            No account yet — they&rsquo;ll get an invitation by email.
          </p>
          <p className="mt-0.5 truncate text-xs font-medium">{emailFallback}</p>
          <Button
            size="sm"
            className="mt-1.5 h-7 px-2 text-xs"
            disabled={busyId === emailFallback}
            onClick={() => createInvite({ email: emailFallback }, emailFallback, emailFallback)}
          >
            {busyId === emailFallback ? 'Sending…' : 'Send invitation'}
          </Button>
        </div>
      )}

      {/* Only when the term is not a usable address — otherwise the block above
          has already offered the invitation, and this would read as a refusal
          of something that just worked. */}
      {searched && !searching && results.length === 0 && !emailFallback && (
        <p className="text-xs text-muted-foreground">
          Nobody by that name. Type their full email address to invite someone who has not joined
          Scrutinise yet.
        </p>
      )}

      {issued && (
        <div className="rounded border border-border bg-muted/40 p-2">
          <p className="text-xs">
            Invite created for <span className="font-medium">{issued.label}</span>
            {issued.notified ? ' — it is waiting in their Feed.' : '.'}
          </p>
          {/* What actually happened to the email, never an assumption — a mail
              failure must not read as a delivered invitation. */}
          {issued.emailed?.sent && (
            <p className="mt-1 text-xs text-emerald-700">Emailed to them as well.</p>
          )}
          {issued.emailed && !issued.emailed.sent && (
            <p className="mt-1 text-xs text-amber-700">
              The email did not go out — {issued.emailed.reason}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {issued.emailed?.sent ? 'The link, in case you want to send it yourself:' : 'Send them this link:'}
          </p>
          <input
            readOnly
            value={issued.link}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1 w-full rounded border bg-background px-2 py-1 text-xs"
          />
        </div>
      )}
    </div>
  )
}
