'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Invite {
  id: string
  email: string
  invitedBy: string
  createdAt: string
  expiresAt: string
  usedAt: string | null
  revokedAt: string | null
}

function inviteStatus(invite: Invite): 'used' | 'revoked' | 'expired' | 'pending' {
  if (invite.usedAt) return 'used'
  if (invite.revokedAt) return 'revoked'
  if (new Date(invite.expiresAt) < new Date()) return 'expired'
  return 'pending'
}

const STATUS_BADGE: Record<ReturnType<typeof inviteStatus>, string> = {
  pending: 'bg-amber-100 text-amber-800',
  used: 'bg-green-100 text-green-800',
  revoked: 'bg-red-100 text-red-800',
  expired: 'bg-muted text-muted-foreground',
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

export default function AdminInvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loaded, setLoaded] = useState(false)
  const [email, setEmail] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [issueError, setIssueError] = useState<string | null>(null)
  const [issueWarning, setIssueWarning] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  function loadInvites() {
    fetch('/api/invites')
      .then((r) => r.json())
      .then((data) => {
        setInvites(Array.isArray(data.invites) ? data.invites : [])
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }

  useEffect(() => { loadInvites() }, [])

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault()
    setIssuing(true)
    setIssueError(null)
    setIssueWarning(null)
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setIssueError(data.error ?? 'Something went wrong')
        return
      }
      if (data.warning) setIssueWarning(data.warning)
      setEmail('')
      loadInvites()
    } catch {
      setIssueError('Network error')
    } finally {
      setIssuing(false)
    }
  }

  async function handleRevoke(id: string) {
    setActing(id + 'revoke')
    setActionError(null)
    try {
      const res = await fetch(`/api/invites/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setActionError(data.error ?? 'Something went wrong')
        return
      }
      loadInvites()
    } catch {
      setActionError('Network error')
    } finally {
      setActing(null)
    }
  }

  async function handleResend(id: string) {
    setActing(id + 'resend')
    setActionError(null)
    try {
      const res = await fetch(`/api/invites/${id}`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        setActionError(data.error ?? 'Something went wrong')
      }
    } catch {
      setActionError('Network error')
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center gap-4">
          <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
            ← Admin
          </a>
          <h1 className="text-lg font-semibold">Invites</h1>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        {/* Issue invite */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issue invite</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleIssue} className="flex gap-3 flex-wrap items-end">
              <div className="flex-1 min-w-[240px]">
                <label className="block text-sm font-medium mb-1">Email address</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <Button type="submit" disabled={issuing}>
                {issuing ? 'Sending…' : 'Send invite'}
              </Button>
            </form>
            {issueError && (
              <p className="mt-2 text-sm text-destructive">{issueError}</p>
            )}
            {issueWarning && (
              <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                {issueWarning}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Invite list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All invites</CardTitle>
          </CardHeader>
          <CardContent>
            {actionError && (
              <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {actionError}
              </p>
            )}
            {!loaded && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {loaded && invites.length === 0 && (
              <p className="text-sm text-muted-foreground">No invites yet.</p>
            )}
            {loaded && invites.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Issued</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Expires</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invites.map((invite) => {
                      const s = inviteStatus(invite)
                      const isBusy = acting !== null
                      return (
                        <tr key={invite.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium">{invite.email}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[s]}`}>
                              {s}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{fmt(invite.createdAt)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{fmt(invite.expiresAt)}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-2">
                              {s === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isBusy}
                                    onClick={() => handleResend(invite.id)}
                                  >
                                    {acting === invite.id + 'resend' ? '…' : 'Resend'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isBusy}
                                    onClick={() => handleRevoke(invite.id)}
                                    className="text-destructive hover:bg-destructive/10 border-destructive/30"
                                  >
                                    {acting === invite.id + 'revoke' ? '…' : 'Revoke'}
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
