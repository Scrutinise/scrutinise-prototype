'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Claim {
  id: string
  activityType: string
  occurredAt: string
  evidenceUrl: string | null
  note: string | null
  user: { id: string; name: string | null; username: string }
}

const LABELS: Record<string, string> = {
  CANVASSING_SESSION: 'Canvassing session',
  RAN_EVENT: 'Organised & ran an event',
  GAVE_TRAINING: 'Gave a training session',
  COMPLETED_TRAINING: 'Completed training as a trainee',
}

/**
 * Pending offline-activity claims on this node, beside the join requests.
 * Manage rights, and they cascade — an ancestor admin approves a branch's
 * claims without joining it.
 *
 * Every decision, approve or decline, lands in the Community activity log,
 * which is visible to all members. That visibility is the anti-abuse mechanism
 * at this stage; nothing here is private.
 */
export default function ClaimsPanel({
  communityId,
  defaultOpen = false,
}: {
  communityId: string
  defaultOpen?: boolean
}) {
  const router = useRouter()
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/communities/${communityId}/claims`)
    if (res.ok) setClaims((await res.json()).claims)
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    load()
  }, [load])

  async function decide(id: string, decision: 'APPROVED' | 'DECLINED', who: string) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/communities/${communityId}/claims/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'That did not work.')
        return
      }
      setClaims((prev) => prev.filter((c) => c.id !== id))
      setDone(
        decision === 'APPROVED'
          ? `Approved — ${who} earned ${data.awarded} points. It is in the activity log.`
          : `Declined — no points awarded, and it is in the activity log.`,
      )
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <details open={defaultOpen || claims.length > 0} className="central-card p-4">
      <summary className="cursor-pointer text-sm font-medium">
        Activity to approve
        {claims.length > 0 && (
          <span className="tabular ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            {claims.length}
          </span>
        )}
      </summary>

      <div className="mt-3 space-y-2">
        {error && <p className="text-xs text-red-600">{error}</p>}
        {done && <p className="text-xs text-muted-foreground">{done}</p>}

        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : claims.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing waiting to be approved.</p>
        ) : (
          claims.map((c) => {
            const who = c.user.name ?? c.user.username
            return (
              <div key={c.id} className="central-inset p-2">
                <p className="text-sm font-medium">{LABELS[c.activityType] ?? c.activityType}</p>
                <p className="text-xs text-muted-foreground">
                  {who} · {new Date(c.occurredAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                {c.note && <p className="mt-1 text-xs italic text-muted-foreground">“{c.note}”</p>}
                {c.evidenceUrl && (
                  <a
                    href={c.evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-xs underline underline-offset-2"
                  >
                    Evidence
                  </a>
                )}
                <div className="mt-2 flex gap-1.5">
                  <Button size="sm" className="h-7 px-2 text-xs" disabled={busyId === c.id} onClick={() => decide(c.id, 'APPROVED', who)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busyId === c.id} onClick={() => decide(c.id, 'DECLINED', who)}>
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
