'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface Author { id: string; name: string | null; username: string }
interface Thread {
  id: string
  title: string | null
  category: string | null
  body: string
  score: number
  scope: string
  createdAt: string
  author: Author
  community: { id: string; name: string }
  myVote: number
  isCommunityWide: boolean
  fromOtherBranch: boolean
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

/**
 * Vote control. The Stage 1 version was two bare ▲/▼ glyphs in muted grey and
 * the 6 Aug user test could not find them at all, so this one is a bordered,
 * labelled control with the count always visible and the caller's own vote
 * filled in.
 */
function VoteControl({
  score,
  myVote,
  onVote,
  size = 'default',
}: {
  score: number
  myVote: number
  onVote: (value: 1 | -1) => void
  size?: 'default' | 'sm'
}) {
  const icon = size === 'sm' ? 'size-3.5' : 'size-4'
  const pad = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1'
  return (
    <div
      className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-background"
      role="group"
      aria-label="Vote"
    >
      <button
        type="button"
        onClick={() => onVote(1)}
        aria-label={myVote === 1 ? 'Remove upvote' : 'Upvote'}
        aria-pressed={myVote === 1}
        title="Upvote"
        className={`rounded-l-full ${pad} transition-colors ${
          myVote === 1 ? 'text-emerald-600' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        <ChevronUp className={icon} strokeWidth={myVote === 1 ? 3 : 2} />
      </button>
      <span
        className={`min-w-[1.25rem] text-center text-xs font-semibold tabular ${
          myVote === 1 ? 'text-emerald-600' : myVote === -1 ? 'text-red-600' : 'text-foreground'
        }`}
        title={`${score} net vote${score === 1 || score === -1 ? '' : 's'}`}
      >
        {score}
      </span>
      <button
        type="button"
        onClick={() => onVote(-1)}
        aria-label={myVote === -1 ? 'Remove downvote' : 'Downvote'}
        aria-pressed={myVote === -1}
        title="Downvote"
        className={`rounded-r-full ${pad} transition-colors ${
          myVote === -1 ? 'text-red-600' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        <ChevronDown className={icon} strokeWidth={myVote === -1 ? 3 : 2} />
      </button>
    </div>
  )
}

function CommunityWideTag({ from }: { from?: string | null }) {
  return (
    <span
      className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
      title={from ? `Posted to the whole Community from ${from}` : 'Posted to the whole Community'}
    >
      Community-wide
    </span>
  )
}

export default function BulletinBoard({
  communityId,
  boardName,
  isBranch,
  communityName,
  canModerate = false,
  canPost = true,
}: {
  communityId: string
  boardName: string
  isBranch: boolean
  /** Name of the top-level Community this board sits in. */
  communityName: string
  /** Stage 2 admin cascade — may remove posts here without being a member. */
  canModerate?: boolean
  /** Managers reading a descendant board may moderate it, but not post to it. */
  canPost?: boolean
}) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [categoryDescriptions, setCategoryDescriptions] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [q, setQ] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [title, setTitle] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [scope, setScope] = useState<'BRANCH' | 'COMMUNITY'>('BRANCH')
  const [body, setBody] = useState('')
  const [expanded, setExpanded] = useState<Record<string, ThreadDetail | undefined>>({})
  const [markError, setMarkError] = useState<string | null>(null)

  const loadThreads = useCallback(
    async (searchTerm?: string) => {
      const term = searchTerm ?? activeQuery
      setLoading(true)
      const params = new URLSearchParams()
      if (category) params.set('category', category)
      if (term) params.set('q', term)
      const res = await fetch(`/api/communities/${communityId}/bulletin?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setThreads(data.threads)
        setCategories(data.categories)
        setCategoryDescriptions(data.categoryDescriptions ?? {})
        setNewCategory((c) => (c && data.categories.includes(c) ? c : data.categories[0] ?? ''))
      }
      setLoading(false)
    },
    [communityId, category, activeQuery],
  )

  useEffect(() => {
    loadThreads()
    // Mark board as read on view.
    fetch(`/api/communities/${communityId}/read`, { method: 'POST' })
  }, [communityId, loadThreads])

  function runSearch(e: React.FormEvent) {
    e.preventDefault()
    setActiveQuery(q.trim())
  }

  function clearSearch() {
    setQ('')
    setActiveQuery('')
  }

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    const res = await fetch(`/api/communities/${communityId}/bulletin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), category: newCategory, body: body.trim(), scope }),
    })
    if (res.ok) {
      setTitle('')
      setBody('')
      setScope('BRANCH')
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
    setMarkError(null)
    const res = await fetch(`/api/communities/${communityId}/bulletin/${threadId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    if (res.ok) {
      const data = await res.json()
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, score: data.score, myVote: data.myVote } : t)),
      )
      setExpanded((prev) =>
        prev[threadId] ? { ...prev, [threadId]: { ...prev[threadId]!, score: data.score, myVote: data.myVote } } : prev,
      )
    } else {
      // Guardrail refusals (own post, daily budget) come back as 4xx with a
      // message worth showing — silently swallowing them would look like a bug.
      const data = await res.json().catch(() => ({}))
      setMarkError(typeof data.error === 'string' ? data.error : 'That mark did not register.')
    }
  }

  async function handleRemovePost(threadId: string) {
    setMarkError(null)
    const res = await fetch(`/api/communities/${communityId}/bulletin/${threadId}`, { method: 'DELETE' })
    if (res.ok) {
      setThreads((prev) => prev.filter((t) => t.id !== threadId))
      setExpanded((prev) => ({ ...prev, [threadId]: undefined }))
    } else {
      const data = await res.json().catch(() => ({}))
      setMarkError(typeof data.error === 'string' ? data.error : 'Could not remove that post.')
    }
  }

  async function handleVoteReply(threadId: string, replyId: string, value: 1 | -1) {
    setMarkError(null)
    const res = await fetch(`/api/communities/${communityId}/bulletin/${replyId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMarkError(typeof data.error === 'string' ? data.error : 'That mark did not register.')
    }
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
      {/* Search — full width at the top of the board. The Stage 1 version was a
          narrow box wedged between the category filter and the New-thread
          button, and the 6 Aug user test never found it. */}
      <form onSubmit={runSearch} className="mb-3">
        <label htmlFor="bulletin-search" className="mb-1 block text-xs font-medium text-muted-foreground">
          Search this Community
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="bulletin-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search posts in ${boardName}…`}
              className="h-10 pl-9"
            />
          </div>
          <Button type="submit" variant="outline">Search</Button>
        </div>
      </form>

      {activeQuery && (
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {threads.length} result{threads.length !== 1 ? 's' : ''} for
            {' '}<span className="font-medium text-foreground">“{activeQuery}”</span>
            {' '}— this Community only
          </span>
          <button type="button" onClick={clearSearch} className="underline underline-offset-2 hover:text-foreground">
            Clear
          </button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {canPost && (
          <Button size="sm" onClick={() => setShowCompose((v) => !v)}>
            {showCompose ? 'Cancel' : 'New thread'}
          </Button>
        )}
      </div>

      {markError && (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          {markError}
        </p>
      )}

      {showCompose && (
        <form onSubmit={handleCreateThread} className="mb-4 space-y-3 central-card p-4">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={200} required />

          <div>
            <label htmlFor="compose-category" className="mb-1 block text-xs font-medium text-muted-foreground">
              Category
            </label>
            <select
              id="compose-category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {categoryDescriptions[newCategory] && (
              <p className="mt-1 text-xs text-muted-foreground">{categoryDescriptions[newCategory]}</p>
            )}
          </div>

          {/* Post scope. Default is the board being viewed. */}
          <fieldset>
            <legend className="mb-1 block text-xs font-medium text-muted-foreground">Post to</legend>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scope"
                  value="BRANCH"
                  checked={scope === 'BRANCH'}
                  onChange={() => setScope('BRANCH')}
                />
                <span>{isBranch ? `This branch (${boardName})` : `${boardName} only`}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scope"
                  value="COMMUNITY"
                  checked={scope === 'COMMUNITY'}
                  onChange={() => setScope('COMMUNITY')}
                />
                <span>The whole Community ({communityName})</span>
              </label>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {scope === 'COMMUNITY'
                ? `Everyone in ${communityName} sees this on their own board, tagged “Community-wide”.`
                : `Only people looking at the ${boardName} board see this.`}
            </p>
          </fieldset>

          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What's on your mind?" rows={4} required />
          <Button type="submit" size="sm">Post</Button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : threads.length === 0 ? (
        <div className="central-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {activeQuery ? 'No posts match that search.' : 'No threads yet — start the conversation.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => {
            const detail = expanded[t.id]
            return (
              <div key={t.id} className="central-card p-3">
                <div className="flex items-start gap-3">
                  <VoteControl
                    score={detail?.score ?? t.score}
                    myVote={detail?.myVote ?? t.myVote}
                    onVote={(v) => handleVoteThread(t.id, v)}
                  />
                  <button className="min-w-0 flex-1 text-left" onClick={() => toggleExpand(t.id)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      {t.category && (
                        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                          {t.category}
                        </span>
                      )}
                      {t.isCommunityWide && (
                        <CommunityWideTag from={t.fromOtherBranch ? t.community.name : null} />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.author.name ?? t.author.username} · {relativeTime(t.createdAt)}
                      {t.fromOtherBranch && ` · from ${t.community.name}`}
                      {typeof t._count?.replies === 'number' && ` · ${t._count.replies} repl${t._count.replies === 1 ? 'y' : 'ies'}`}
                    </p>
                  </button>
                  {canModerate && (
                    <button
                      type="button"
                      onClick={() => handleRemovePost(t.id)}
                      className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-red-600"
                      title="Remove this post"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {detail && (
                  <div className="ml-8 mt-3 space-y-3">
                    <p className="whitespace-pre-wrap text-sm">{detail.body}</p>
                    <div className="space-y-3 border-t border-border pt-3">
                      {detail.replies.map((r) => (
                        <div key={r.id} className="flex items-start gap-3">
                          <VoteControl
                            size="sm"
                            score={r.score}
                            myVote={r.myVote}
                            onVote={(v) => handleVoteReply(t.id, r.id, v)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="whitespace-pre-wrap text-sm">{r.body}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
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
