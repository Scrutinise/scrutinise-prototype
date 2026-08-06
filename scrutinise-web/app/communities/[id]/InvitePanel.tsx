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
export default function InvitePanel({ communityId }: { communityId: string }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Found[]>([])
  const [emailFallback, setEmailFallback] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ label: string; link: string; notified: boolean } | null>(null)

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
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not create the invite')
        return
      }
      setIssued({
        label,
        link: `${window.location.origin}/community-invite/${data.invite.inviteCode}`,
        notified: Boolean(data.notified),
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

      {emailFallback && (
        <div className="rounded border border-dashed border-border p-2">
          <p className="text-xs text-muted-foreground">
            No account for <span className="font-medium text-foreground">{emailFallback}</span> yet.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-1.5 h-7 px-2 text-xs"
            disabled={busyId === emailFallback}
            onClick={() => createInvite({ email: emailFallback }, emailFallback, emailFallback)}
          >
            {busyId === emailFallback ? 'Creating…' : 'Invite this address anyway'}
          </Button>
        </div>
      )}

      {searched && !searching && results.length === 0 && !emailFallback && (
        <p className="text-xs text-muted-foreground">
          No one found. Enter a full email address to invite someone who has not joined Scrutinise yet.
        </p>
      )}

      {issued && (
        <div className="rounded border border-border bg-muted/40 p-2">
          <p className="text-xs">
            Invite created for <span className="font-medium">{issued.label}</span>
            {issued.notified ? ' — it is waiting in their Feed.' : '.'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Send them this link:</p>
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
