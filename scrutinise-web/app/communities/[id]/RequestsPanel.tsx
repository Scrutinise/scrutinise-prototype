'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface JoinRequest {
  id: string
  message: string | null
  createdAt: string
  user: { id: string; name: string | null; username: string }
}

/**
 * Pending requests to join this node. Shown to anyone with manage rights —
 * including an ancestor admin who is not a member here, which is the whole
 * point: a branch's requests must be decidable by the Community's owner
 * without joining every branch.
 */
export default function RequestsPanel({
  communityId,
  communityName,
  defaultOpen = false,
}: {
  communityId: string
  communityName: string
  defaultOpen?: boolean
}) {
  const router = useRouter()
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/communities/${communityId}/join-requests`)
    if (res.ok) {
      const data = await res.json()
      setRequests(data.requests)
    }
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    load()
  }, [load])

  async function decide(id: string, decision: 'APPROVED' | 'DECLINED', who: string) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/communities/${communityId}/join-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'That did not work.')
        return
      }
      setRequests((prev) => prev.filter((r) => r.id !== id))
      setDone(
        decision === 'APPROVED'
          ? `${who} is now a member of ${communityName}.`
          : `${who}'s request was declined — they have been told, and can ask again.`,
      )
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <details open={defaultOpen || requests.length > 0} className="rounded-lg border border-border p-4">
      <summary className="cursor-pointer text-sm font-medium">
        Requests to join
        {requests.length > 0 && (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            {requests.length}
          </span>
        )}
      </summary>

      <div className="mt-3 space-y-2">
        {error && <p className="text-xs text-red-600">{error}</p>}
        {done && <p className="text-xs text-muted-foreground">{done}</p>}

        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-xs text-muted-foreground">No one is waiting to join right now.</p>
        ) : (
          requests.map((r) => {
            const who = r.user.name ?? r.user.username
            return (
              <div key={r.id} className="rounded border border-border p-2">
                <p className="text-sm font-medium">{who}</p>
                <p className="text-xs text-muted-foreground">@{r.user.username}</p>
                {r.message && <p className="mt-1 text-xs italic text-muted-foreground">“{r.message}”</p>}
                <div className="mt-2 flex gap-1.5">
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={busyId === r.id}
                    onClick={() => decide(r.id, 'APPROVED', who)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={busyId === r.id}
                    onClick={() => decide(r.id, 'DECLINED', who)}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </details>
  )
}
