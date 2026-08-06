'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function JoinButton({ code }: { code: string }) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
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

  return (
    <div>
      <button
        onClick={handleJoin}
        disabled={status === 'loading'}
        className="block w-full text-center px-4 py-2.5 bg-zinc-900 text-white text-sm font-semibold rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
      >
        {status === 'loading' ? 'Joining…' : 'Join this Community'}
      </button>
      {message && <p className="text-sm text-red-600 mt-3">{message}</p>}
    </div>
  )
}
