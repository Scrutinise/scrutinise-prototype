'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Bell } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// VoteInterceptModal
// Shown at Stage 2/3 when a user clicks anything vote-related.
// Offers to notify them when voting opens (VOTE_OPEN alert).
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  ideaId: string
  onClose: () => void
}

type State = 'idle' | 'loading' | 'subscribed' | 'already' | 'error'

export default function VoteInterceptModal({ ideaId, onClose }: Props) {
  const [state, setState] = useState<State>('idle')

  async function handleYes() {
    setState('loading')
    try {
      const res = await fetch(`/api/ideas/${ideaId}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertType: 'VOTE_OPEN' }),
      })
      if (res.status === 409 || res.ok) {
        // 200 = newly subscribed, any ok = good; 409 = already exists (shouldn't happen with upsert)
        setState('subscribed')
      } else {
        const data = await res.json().catch(() => ({}))
        // If the user was already subscribed the upsert silently returns ok
        if (res.status === 401) {
          setState('error')
        } else {
          setState('subscribed')
        }
        void data
      }
    } catch {
      setState('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="space-y-3">
            <p className="text-sm font-medium leading-snug">
              Voting is not yet open on this idea while it is still being developed.
            </p>

            {state === 'idle' && (
              <>
                <p className="text-sm text-muted-foreground">
                  Would you like to be notified when voting opens?
                </p>
                <div className="flex gap-3">
                  <Button size="sm" onClick={handleYes}>
                    Yes, notify me
                  </Button>
                  <Button variant="outline" size="sm" onClick={onClose}>
                    No thanks
                  </Button>
                </div>
              </>
            )}

            {state === 'loading' && (
              <p className="text-sm text-muted-foreground">Saving…</p>
            )}

            {state === 'subscribed' && (
              <>
                <p className="text-sm text-green-700">
                  We&apos;ll let you know when voting opens.
                </p>
                <Button size="sm" variant="outline" onClick={onClose}>
                  Close
                </Button>
              </>
            )}

            {state === 'already' && (
              <>
                <p className="text-sm text-muted-foreground">
                  You&apos;re already on the notification list.
                </p>
                <Button size="sm" variant="outline" onClick={onClose}>
                  Close
                </Button>
              </>
            )}

            {state === 'error' && (
              <>
                <p className="text-sm text-destructive">
                  Something went wrong. Please sign in and try again.
                </p>
                <Button size="sm" variant="outline" onClick={onClose}>
                  Close
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
