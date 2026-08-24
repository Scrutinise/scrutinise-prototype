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
  status: string
  awarded: number
  user: { id: string; name: string | null; username: string }
}

const LABELS: Record<string, string> = {
  CANVASSING_SESSION: 'Canvassing session',
  RAN_EVENT: 'Organised & ran an event',
  GAVE_TRAINING: 'Gave a training session',
  COMPLETED_TRAINING: 'Completed training as a trainee',
}

/**
 * CENTRAL Stage 2e — activity awarded on this node, and the reverse control.
 *
 * ⚠ THIS PANEL USED TO BE AN APPROVAL QUEUE AND IS NOT ONE ANY MORE. Charlie
 * removed pre-approval on 24 Aug 2026: a claim pays the moment it is logged.
 * A member who did the work and watched their score stay at zero read that as
 * the feature being broken, not as a queue — which is exactly what happened in
 * the pilot walk.
 *
 * What is left for a manager is to REVERSE an award that should not have been
 * made, with a reason the claimant is told. Every award and every reversal is
 * in the Community activity log, visible to all members: with no gate in front
 * of the points, that visibility IS the anti-abuse mechanism.
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
  const [reversing, setReversing] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/communities/${communityId}/claims?status=AWARDED`)
    if (res.ok) setClaims((await res.json()).claims)
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    load()
  }, [load])

  async function reverse(id: string, who: string) {
    const reason = (reasons[id] ?? '').trim()
    if (!reason) {
      setError('Say why you are reversing this — the claimant is told the reason.')
      return
    }
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/communities/${communityId}/claims/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'That did not work.')
        return
      }
      setClaims((prev) => prev.filter((c) => c.id !== id))
      setReversing(null)
      setDone(`Reversed — ${data.reversed} points taken back from ${who}. Both events stay in the activity log.`)
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <details open={defaultOpen} className="central-card p-4">
      <summary className="cursor-pointer text-sm font-medium">
        Activity awarded
        {claims.length > 0 && (
          <span className="tabular ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
            {claims.length}
          </span>
        )}
      </summary>

      <div className="mt-3 space-y-2">
        <p className="text-xs text-muted-foreground pretty">
          Activity pays as soon as it is logged — there is no approval step. If one of these should
          not have been awarded, reverse it and say why.
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {done && <p className="text-xs text-muted-foreground">{done}</p>}

        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : claims.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity logged on this node yet.</p>
        ) : (
          claims.map((c) => {
            const who = c.user.name ?? c.user.username
            return (
              <div key={c.id} className="central-inset p-2">
                <p className="text-sm font-medium">
                  {LABELS[c.activityType] ?? c.activityType}
                  <span className="tabular ml-2 text-xs font-semibold central-teal-text">+{c.awarded}</span>
                </p>
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
                {reversing === c.id ? (
                  <div className="mt-2 space-y-1.5">
                    <input
                      value={reasons[c.id] ?? ''}
                      onChange={(e) => setReasons((r) => ({ ...r, [c.id]: e.target.value }))}
                      placeholder="Why is this being reversed? (required)"
                      maxLength={1000}
                      className="w-full rounded-lg border bg-background px-2 py-1 text-xs"
                    />
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={busyId === c.id}
                        onClick={() => reverse(c.id, who)}
                      >
                        {busyId === c.id ? 'Reversing…' : `Reverse ${c.awarded} points`}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => setReversing(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setReversing(c.id); setError(null) }}
                    className="mt-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Reverse this
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </details>
  )
}
