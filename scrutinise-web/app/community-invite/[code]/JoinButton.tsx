'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * ⚠ CENTRAL 25-A §3b — NOBODY JOINS ON CLICK ANY MORE, and this button must not
 * say they did.
 *
 * An invitation addressed to one person still admits them: the person who
 * invited them made that decision already. A SHARED LINK does not — anyone who
 * is passed it can arrive — so the route answers 202 with `pending: true`, and
 * what this shows is that they are waiting to be let in.
 */
export default function JoinButton({ code, isLink }: { code: string; isLink: boolean }) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'pending'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleJoin() {
    setStatus('loading')
    setMessage(null)
    try {
      const res = await fetch('/api/communities/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setMessage(data.error ?? 'Something went wrong — please try again.')
        return
      }

      // A shared link puts them in the queue. Say so, and do not send them to a
      // page they cannot see yet.
      if (data.pending) {
        setStatus('pending')
        setMessage(
          data.alreadyPending
            ? `You have already asked to join ${data.community?.name ?? 'this Community'} — somebody there has to let you in, and you will be told when they do.`
            : `Thank you — you have asked to join ${data.community?.name ?? 'this Community'}. Somebody there has to let you in, and you will be told when they do.`,
        )
        return
      }

      // A branch invite arrives with `joined=1`, which raises the switch-or-add
      // chooser if they already belong to other branches. A Community-level
      // invite lands on the root, where "Find your branch" is waiting.
      router.push(
        data.isBranch && !data.alreadyMember
          ? `/communities/${data.community.id}?joined=1`
          : `/communities/${data.community.id}`,
      )
    } catch {
      setStatus('error')
      setMessage('Network error — please try again.')
    }
  }

  if (status === 'pending') {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3">
        <p className="text-sm font-semibold text-emerald-900">You are on the list</p>
        <p className="mt-1 text-sm text-emerald-800">{message}</p>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={handleJoin}
        disabled={status === 'loading'}
        className="block w-full text-center px-4 py-2.5 bg-zinc-900 text-white text-sm font-semibold rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
      >
        {status === 'loading'
          ? 'Sending…'
          : isLink
            ? 'Ask to join this Community'
            : 'Join this Community'}
      </button>
      {message && <p className="text-sm text-red-600 mt-3">{message}</p>}
    </div>
  )
}
