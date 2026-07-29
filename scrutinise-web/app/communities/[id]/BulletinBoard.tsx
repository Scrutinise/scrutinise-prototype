'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const BULLETIN_CATEGORIES = ['General', 'Announcements', 'Training — offers & requests', 'Questions'] as const

interface Author { id: string; name: string | null; username: string }
interface Thread {
  id: string
  title: string | null
  category: string | null
  body: string
  score: number
  createdAt: string
  author: Author
  _count?: { replies: number }
}
interface Reply {
  id: string
  body: string
  score: number
  createdAt: string
  author: Author
  myVote: number
}
interface ThreadDetail extends Thread {
  myVote: number
  replies: Reply[]
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  if (mins > 0) return `${mins} minute${mins !== 1 ? 's' : ''} ago`
  return 'just now'
}

function VoteControl({
  score,
  myVote,
  onVote,
}: {
  score: number
  myVote: number
  onVote: (value: 1 | -1) => void
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0">
      <button
        onClick={() => onVote(1)}
        className={`text-sm leading-none ${myVote === 1 ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'}`}
        aria-label="Upvote"
      >
        ▲
      </button>
      <span className="text-xs font-medium">{score}</span>
      <button
        onClick={() => onVote(-1)}
        className={`text-sm leading-none ${myVote === -1 ? 'text-red-600 font-bold' : 'text-muted-foreground hover:text-foreground'}`}
        aria-label="Downvote"
      >
        ▼
      </button>
    </div>
  )
}

export default function BulletinBoard({ communityId }: { communityId: string }) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [q, setQ] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [title, setTitle] = useState('')
  const [newCategory, setNewCategory] = useState<string>(BULLETIN_CATEGORIES[0])
  const [body, setBody] = useState('')
  const [expanded, setExpanded] = useState<Record<string, ThreadDetail | undefined>>({})

  const loadThreads = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (q) params.set('q', q)
    const res = await fetch(`/api/communities/${communityId}/bulletin?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      setThreads(data.threads)
    }
    setLoading(false)
  }, [communityId, category, q])

  useEffect(() => {
    loadThreads()
    // Mark board as read on view.
    fetch(`/api/communities/${communityId}/read`, { method: 'POST' })
  }, [communityId, loadThreads])

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    const res = await fetch(`/api/communities/${communityId}/bulletin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), category: newCategory, body: body.trim() }),
    })
    if (res.ok) {
      setTitle('')
      setBody('')
      setShowCompose(false)
      loadThreads()
    }
  }

  async function toggleExpand(threadId: string) {
    if (expanded[threadId]) {
      setExpanded((prev) => ({ ...prev, [threadId]: undefined }))
      return
    }
    const res = await fetch(`/api/communities/${communityId}/bulletin/${threadId}`)
    if (res.ok) {
      const data = await res.json()
      setExpanded((prev) => ({ ...prev, [threadId]: data.thread }))
    }
  }

  async function handleVoteThread(threadId: string, value: 1 | -1) {
    const res = await fetch(`/api/communities/${communityId}/bulletin/${threadId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    if (res.ok) {
      const data = await res.json()
      setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, score: data.score } : t)))
      setExpanded((prev) =>
        prev[threadId] ? { ...prev, [threadId]: { ...prev[threadId]!, score: data.score, myVote: data.myVote } } : prev,
      )
    }
  }

  async function handleVoteReply(threadId: string, replyId: string, value: 1 | -1) {
    const res = await fetch(`/api/communities/${communityId}/bulletin/${replyId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    if (res.ok) {
      const data = await res.json()
      setExpanded((prev) => {
        const detail = prev[threadId]
        if (!detail) return prev
        return {
          ...prev,
          [threadId]: {
            ...detail,
            replies: detail.replies.map((r) => (r.id === replyId ? { ...r, score: data.score, myVote: data.myVote } : r)),
          },
        }
      })
    }
  }

  async function handleReply(threadId: string, text: string, clear: () => void) {
    if (!text.trim()) return
    const res = await fetch(`/api/communities/${communityId}/bulletin/${threadId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text.trim() }),
    })
    if (res.ok) {
      clear()
      const refreshed = await fetch(`/api/communities/${communityId}/bulletin/${threadId}`)
      if (refreshed.ok) {
        const data = await refreshed.json()
        setExpanded((prev) => ({ ...prev, [threadId]: data.thread }))
      }
      loadThreads()
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-sm border rounded-md h-9 px-2 bg-background"
          >
            <option value="">All categories</option>
            {BULLETIN_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadThreads()}
            placeholder="Search this Community…"
            className="w-48 h-9"
          />
          <Button size="sm" variant="outline" onClick={loadThreads}>Search</Button>
        </div>
        <Button size="sm" onClick={() => setShowCompose((v) => !v)}>
          {showCompose ? 'Cancel' : 'New thread'}
        </Button>
      </div>

      {showCompose && (
        <form onSubmit={handleCreateThread} className="rounded-lg border border-border p-4 space-y-3 mb-4">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={200} required />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="text-sm border rounded-md h-9 px-2 bg-background w-full"
          >
            {BULLETIN_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What's on your mind?" rows={4} required />
          <Button type="submit" size="sm">Post</Button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : threads.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No threads yet — start the conversation.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => {
            const detail = expanded[t.id]
            return (
              <div key={t.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start gap-3">
                  <VoteControl
                    score={detail?.score ?? t.score}
                    myVote={detail?.myVote ?? 0}
                    onVote={(v) => handleVoteThread(t.id, v)}
                  />
                  <button className="flex-1 min-w-0 text-left" onClick={() => toggleExpand(t.id)}>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      {t.category && (
                        <span className="shrink-0 text-xs bg-zinc-100 text-zinc-600 rounded-full px-2 py-0.5">
                          {t.category}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.author.name ?? t.author.username} · {relativeTime(t.createdAt)}
                      {typeof t._count?.replies === 'number' && ` · ${t._count.replies} repl${t._count.replies === 1 ? 'y' : 'ies'}`}
                    </p>
                  </button>
                </div>

                {detail && (
                  <div className="mt-3 ml-8 space-y-3">
                    <p className="text-sm whitespace-pre-wrap">{detail.body}</p>
                    <div className="border-t border-border pt-3 space-y-3">
                      {detail.replies.map((r) => (
                        <div key={r.id} className="flex items-start gap-3">
                          <VoteControl score={r.score} myVote={r.myVote} onVote={(v) => handleVoteReply(t.id, r.id, v)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm whitespace-pre-wrap">{r.body}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {r.author.name ?? r.author.username} · {relativeTime(r.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                      <ReplyForm onSubmit={(text, clear) => handleReply(t.id, text, clear)} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ReplyForm({ onSubmit }: { onSubmit: (text: string, clear: () => void) => void }) {
  const [text, setText] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(text, () => setText(''))
      }}
      className="flex items-start gap-2"
    >
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply…" rows={2} className="flex-1" />
      <Button type="submit" size="sm">Reply</Button>
    </form>
  )
}
