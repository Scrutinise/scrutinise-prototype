'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import CommunityCard, { type CommunityCardData } from '@/components/CommunityCard'

export default function CommunitiesClient({ communities }: { communities: CommunityCardData[] }) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not create Community')
        return
      }
      router.push(`/communities/${data.community.id}`)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!joinCode.trim()) return
    router.push(`/community-invite/${encodeURIComponent(joinCode.trim())}`)
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">My Communities</h1>
        <div className="flex items-center gap-2">
          <form onSubmit={handleJoin} className="flex items-center gap-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Have an invite code?"
              className="w-48"
            />
            <Button type="submit" variant="outline" size="sm">Join</Button>
          </form>
          <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? 'Cancel' : 'Create Community'}
          </Button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-8 rounded-lg border border-border p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create'}
          </Button>
        </form>
      )}

      {communities.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            You&apos;re not in any Communities yet — create one or join with an invite code.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {communities.map((c) => (
            <CommunityCard key={c.id} community={c} />
          ))}
        </div>
      )}
    </main>
  )
}
