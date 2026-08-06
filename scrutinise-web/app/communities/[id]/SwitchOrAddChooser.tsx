'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Branch {
  id: string
  name: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
}

/**
 * Shown once on arrival at a branch you have just joined, when you already
 * belong to other branches: switch, or add.
 *
 * Multi-branch membership is allowed, so the default is ADD — nothing is ticked
 * and doing nothing keeps every branch. Leaving is opt-in, one branch at a
 * time, and is available from each branch's own page afterwards anyway; this
 * panel only makes the choice visible at the moment it is most likely wanted.
 *
 * A branch you OWN cannot be ticked: leaving would orphan it, and ownership has
 * to be handed over first.
 */
export default function SwitchOrAddChooser({
  branchName,
  otherBranches,
}: {
  branchName: string
  otherBranches: Branch[]
}) {
  const router = useRouter()
  const [leaving, setLeaving] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (dismissed || otherBranches.length === 0) return null

  function toggle(id: string) {
    setLeaving((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function confirm() {
    setBusy(true)
    setError(null)
    const failed: string[] = []
    for (const id of leaving) {
      const res = await fetch(`/api/communities/${id}/leave`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        failed.push(
          `${otherBranches.find((b) => b.id === id)?.name ?? id}: ${
            typeof data.error === 'string' ? data.error : 'could not leave'
          }`,
        )
      }
    }
    setBusy(false)
    if (failed.length > 0) {
      setError(failed.join(' · '))
      return
    }
    setDismissed(true)
    router.refresh()
  }

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">You’ve joined {branchName}</p>
      <p className="mt-1 text-xs text-amber-800">
        You’re also in {otherBranches.length === 1 ? 'another branch' : 'other branches'}. You can stay
        in all of them — or tick any you want to leave.
      </p>

      <div className="mt-3 space-y-1.5">
        {otherBranches.map((b) => (
          <label
            key={b.id}
            className={`flex items-center gap-2 text-sm ${b.role === 'OWNER' ? 'opacity-60' : ''}`}
          >
            <input
              type="checkbox"
              checked={leaving.has(b.id)}
              disabled={b.role === 'OWNER' || busy}
              onChange={() => toggle(b.id)}
            />
            <span>
              Also leave <span className="font-medium">{b.name}</span>
              {b.role === 'OWNER' && (
                <span className="ml-1 text-xs text-amber-700">— you own this one, so you can’t leave it</span>
              )}
            </span>
          </label>
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}

      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={busy} onClick={confirm}>
          {busy ? 'Saving…' : leaving.size === 0 ? 'Keep them all' : `Leave ${leaving.size} and continue`}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDismissed(true)}>
          Decide later
        </Button>
      </div>
    </div>
  )
}
