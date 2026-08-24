'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AnswerByline } from '@/components/central/AnswerByline'

interface Answer {
  id: string
  /** MEMBER | AI — Stage 2e. Rendered by AnswerByline on every surface. */
  authorType: string
  aiModel: string | null
  body: string
  sources: string[]
  localExample: string | null
  hidden: boolean
  createdAt: string
  author: { id: string; name: string | null; username: string }
  branchName: string | null
  score: number
  myVote: 'UP' | 'DOWN' | null
  myFavourite: boolean
  flag: { level: string; reason: string } | null
}

interface Props {
  communityId: string
  question: {
    id: string
    text: string
    scope: string
    contextTags: string[]
    topicTags: string[]
    voteCount: number
    answerCount: number
    myVote: boolean
    branch: { id: string; name: string } | null
  }
  answers: Answer[]
  canPromote: boolean
  canManage: boolean
  viewerId: string
}

function age(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days < 1) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  return `${Math.floor(days / 30)} months ago`
}

/** Quality vote. Up or down, mutually exclusive — switching moves the count by
 *  two because the previous vote is withdrawn, not stacked. */
function AnswerVote({
  score,
  myVote,
  onVote,
  disabled,
}: {
  score: number
  myVote: 'UP' | 'DOWN' | null
  onVote: (d: 'UP' | 'DOWN') => void
  disabled: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <div
      className="relative shrink-0"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex w-11 flex-col overflow-hidden rounded-lg border border-border">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onVote('UP')}
          aria-label="Vote up"
          aria-pressed={myVote === 'UP'}
          className={`h-9 text-xs transition-colors disabled:opacity-40 ${
            myVote === 'UP' ? 'bg-primary/[0.08] text-primary' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          ▲
        </button>
        <span className="tabular border-y border-border py-1 text-center text-sm font-semibold">
          {score}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onVote('DOWN')}
          aria-label="Vote down"
          aria-pressed={myVote === 'DOWN'}
          className={`h-9 text-xs transition-colors disabled:opacity-40 ${
            myVote === 'DOWN' ? 'bg-destructive/[0.07] text-destructive' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          ▼
        </button>
      </div>
      {hover && !disabled && (
        <span className="pointer-events-none absolute left-[calc(100%+8px)] top-2 z-30 w-[170px] rounded-lg bg-foreground px-2 py-1.5 text-[11px] text-white shadow-lg">
          Click arrows to vote up or down
        </span>
      )}
      {hover && disabled && (
        <span className="pointer-events-none absolute left-[calc(100%+8px)] top-2 z-30 w-[170px] rounded-lg bg-foreground px-2 py-1.5 text-[11px] text-white shadow-lg">
          You can’t vote on your own answer
        </span>
      )}
    </div>
  )
}

/** Private to the reader. Deliberately a LABELLED star, not a bare icon: the
 *  tooltip is unreachable on touch, so the control has to say what it is. */
function FavouriteToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={`central-chip inline-flex items-center gap-1.5 border px-3 text-xs transition-colors ${
        on
          ? 'border-primary bg-primary/[0.07] font-semibold text-primary'
          : 'border-border bg-white text-muted-foreground hover:border-[var(--central-border-hover)]'
      }`}
    >
      <span>{on ? '★' : '☆'}</span>
      {on ? 'Favourited' : 'Favourite'}
    </button>
  )
}

export default function QuestionDetail({
  communityId,
  question,
  answers: initialAnswers,
  canPromote,
  canManage,
  viewerId,
}: Props) {
  const router = useRouter()
  const [answers, setAnswers] = useState(initialAnswers)
  const [qVoted, setQVoted] = useState(question.myVote)
  const [qCount, setQCount] = useState(question.voteCount)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    initialAnswers[0] ? { [initialAnswers[0].id]: true } : {},
  )
  const [error, setError] = useState<string | null>(null)

  const [body, setBody] = useState('')
  const [sources, setSources] = useState<string[]>([])
  const [localExample, setLocalExample] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)

  const [suggestFor, setSuggestFor] = useState<string | null>(null)
  const [suggestBody, setSuggestBody] = useState('')
  const [flagFor, setFlagFor] = useState<string | null>(null)
  const [flagLevel, setFlagLevel] = useState<'DO_NOT_USE' | 'USE_WITH_CARE'>('USE_WITH_CARE')
  const [flagReason, setFlagReason] = useState('')

  async function voteQuestion() {
    const res = await fetch(`/api/communities/${communityId}/questions/${question.id}/vote`, { method: 'POST' })
    if (res.ok) {
      const d = await res.json()
      setQVoted(d.voted)
      setQCount(d.count)
    }
  }

  async function voteAnswer(answerId: string, direction: 'UP' | 'DOWN') {
    setError(null)
    const res = await fetch(`/api/communities/${communityId}/answers/${answerId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(typeof d.error === 'string' ? d.error : 'That vote did not register.')
      return
    }
    setAnswers((prev) =>
      [...prev.map((a) => (a.id === answerId ? { ...a, score: d.score, myVote: d.myVote } : a))].sort(
        (x, y) => y.score - x.score,
      ),
    )
  }

  async function toggleFavourite(answerId: string) {
    const res = await fetch(`/api/communities/${communityId}/answers/${answerId}/favourite`, { method: 'POST' })
    if (res.ok) {
      const d = await res.json()
      setAnswers((prev) => prev.map((a) => (a.id === answerId ? { ...a, myFavourite: d.favourited } : a)))
    }
  }

  async function postAnswer(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setPosting(true)
    setError(null)
    const res = await fetch(`/api/communities/${communityId}/questions/${question.id}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: body.trim(),
        sources: sources.filter((s) => s.trim()),
        localExample: localExample?.trim() || undefined,
      }),
    })
    const d = await res.json().catch(() => ({}))
    setPosting(false)
    if (!res.ok) {
      setError(typeof d.error === 'string' ? d.error : 'Could not post that answer.')
      return
    }
    setAnswers(d.answers)
    setBody('')
    setSources([])
    setLocalExample(null)
    router.refresh()
  }

  async function submitSuggestion(answerId: string) {
    const res = await fetch(`/api/communities/${communityId}/answers/${answerId}/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestedBody: suggestBody.trim() }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(typeof d.error === 'string' ? d.error : 'Could not send that suggestion.')
      return
    }
    setSuggestFor(null)
    setSuggestBody('')
    setError(null)
  }

  async function submitFlag(answerId: string) {
    const res = await fetch(`/api/communities/${communityId}/answers/${answerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'flag', level: flagLevel, reason: flagReason.trim() }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(typeof d.error === 'string' ? d.error : 'Could not set that flag.')
      return
    }
    setAnswers((prev) =>
      prev.map((a) => (a.id === answerId ? { ...a, flag: { level: flagLevel, reason: flagReason.trim() } } : a)),
    )
    setFlagFor(null)
    setFlagReason('')
  }

  async function clearFlag(answerId: string) {
    const res = await fetch(`/api/communities/${communityId}/answers/${answerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unflag' }),
    })
    if (res.ok) setAnswers((prev) => prev.map((a) => (a.id === answerId ? { ...a, flag: null } : a)))
  }

  async function hideAnswer(answerId: string) {
    const res = await fetch(`/api/communities/${communityId}/answers/${answerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'hide', hidden: true }),
    })
    if (res.ok) setAnswers((prev) => prev.filter((a) => a.id !== answerId))
  }

  async function promote() {
    const res = await fetch(`/api/communities/${communityId}/questions/${question.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'COMMUNITY' }),
    })
    if (res.ok) router.refresh()
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        <Link href={`/communities/${communityId}?tab=questions`} className="hover:underline">
          ← Question library
        </Link>
      </p>

      <div className="mb-5 border-b border-border pb-5">
        <div className="flex items-start gap-3.5">
          <button
            type="button"
            onClick={voteQuestion}
            aria-pressed={qVoted}
            className={`flex min-w-[52px] flex-col items-center gap-0.5 rounded-[10px] border px-2 py-2 transition-colors ${
              qVoted ? 'border-primary bg-primary/[0.07] text-primary' : 'border-border bg-white text-muted-foreground'
            }`}
          >
            <span className="text-[11px] leading-none">▲</span>
            <span className="tabular text-base font-semibold leading-none">{qCount}</span>
            <span className="text-[9px] uppercase tracking-wider">votes</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold leading-[1.3] tracking-[-0.025em] pretty">{question.text}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              {[...question.contextTags, ...question.topicTags].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-[oklch(0.92_0.004_250)] bg-[var(--central-chip-fill)] px-2 py-0.5 font-medium"
                >
                  {t}
                </span>
              ))}
              <span className="tabular text-muted-foreground">
                {answers.length} answer{answers.length === 1 ? '' : 's'} ·{' '}
                {question.scope === 'COMMUNITY'
                  ? 'whole Community'
                  : `${question.branch?.name ?? 'branch'} only`}
              </span>
            </div>
            {canPromote && (
              <div className="mt-3 central-inset p-3">
                <p className="text-xs text-muted-foreground pretty">
                  This question is only visible inside {question.branch?.name ?? 'this branch'}. Other
                  branches are probably being asked it too.
                </p>
                <Button size="sm" variant="outline" className="mt-2 rounded-lg" onClick={promote}>
                  Share with the whole Community
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>}

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold">Answers</h2>
        <span className="text-xs text-muted-foreground">Ranked by weighted votes</span>
      </div>

      {answers.length === 0 ? (
        <div className="central-card p-8 text-center">
          <p className="text-[13px] text-muted-foreground">
            No answers yet. If you have handled this one, yours will be the first.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {answers.map((a, idx) => {
            const isOpen = expanded[a.id] ?? false
            const mine = a.author.id === viewerId
            return (
              <div key={a.id} className="central-card p-4">
                <div className="flex items-start gap-3.5">
                  <AnswerVote
                    score={a.score}
                    myVote={a.myVote}
                    onVote={(d) => voteAnswer(a.id, d)}
                    disabled={mine}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {idx === 0 && (
                        <span className="central-live rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em]">
                          Top answer
                        </span>
                      )}
                      {a.flag && (
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] ${
                            a.flag.level === 'DO_NOT_USE'
                              ? 'border-destructive/40 bg-destructive/[0.07] text-destructive'
                              : 'border-amber-300 bg-amber-50 text-amber-800'
                          }`}
                        >
                          {a.flag.level === 'DO_NOT_USE' ? 'Do not use' : 'Use with care'}
                        </span>
                      )}
                      {/* Stage 2e — WHO WROTE IT. This line used to be a branch
                          name and an age with no author at all, which is how 27
                          Claude-written answers came to look like members' work. */}
                      <AnswerByline
                        answer={a}
                        suffix={`${a.branchName ? `${a.branchName} · ` : ''}${age(a.createdAt)}`}
                      />
                    </div>

                    {a.flag && (
                      <p className="mb-2 text-xs italic text-muted-foreground pretty">{a.flag.reason}</p>
                    )}

                    {isOpen || idx === 0 ? (
                      <>
                        <p className="whitespace-pre-wrap text-base leading-[1.6] pretty">{a.body}</p>

                        {a.sources.length > 0 && (
                          <div className="mt-3 border-t border-border pt-3">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                              Sources
                            </p>
                            <ul className="space-y-0.5">
                              {a.sources.map((s) => (
                                <li key={s}>
                                  <a
                                    href={s}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[13px] text-primary underline underline-offset-2"
                                  >
                                    {s}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {a.localExample && (
                          <div className="central-live-block mt-3 p-3">
                            <p className="central-teal-text-deep mb-1 text-[11px] font-semibold uppercase tracking-[0.07em]">
                              Local example
                            </p>
                            <p className="text-[13px] leading-relaxed pretty">{a.localExample}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-[13px] font-medium text-muted-foreground pretty">
                        {a.body.slice(0, 140)}{a.body.length > 140 ? '…' : ''}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <FavouriteToggle on={a.myFavourite} onToggle={() => toggleFavourite(a.id)} />
                      <span className="text-[11px] text-muted-foreground">Private to you</span>
                      {!isOpen && idx !== 0 && (
                        <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs"
                          onClick={() => setExpanded((p) => ({ ...p, [a.id]: true }))}>
                          Show answer
                        </Button>
                      )}
                      <span className="ml-auto flex gap-2">
                        {!mine && (
                          <button
                            type="button"
                            onClick={() => { setSuggestFor(a.id); setSuggestBody(a.body) }}
                            className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                          >
                            Suggest an edit
                          </button>
                        )}
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => { setFlagFor(a.id); setFlagReason(a.flag?.reason ?? '') }}
                              className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                            >
                              {a.flag ? 'Change flag' : 'Flag'}
                            </button>
                            {a.flag && (
                              <button
                                type="button"
                                onClick={() => clearFlag(a.id)}
                                className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                              >
                                Clear flag
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => hideAnswer(a.id)}
                              className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-red-600"
                            >
                              Hide
                            </button>
                          </>
                        )}
                      </span>
                    </div>

                    {suggestFor === a.id && (
                      <div className="central-inset mt-3 p-3">
                        <p className="mb-1.5 text-xs font-medium">Suggest a rewording</p>
                        <p className="mb-2 text-[11px] text-muted-foreground">
                          This goes to the person who wrote it. They decide — no admin is involved.
                        </p>
                        <Textarea value={suggestBody} onChange={(e) => setSuggestBody(e.target.value)} rows={4} />
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" className="rounded-lg" onClick={() => submitSuggestion(a.id)}>Send</Button>
                          <Button size="sm" variant="ghost" onClick={() => setSuggestFor(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}

                    {flagFor === a.id && (
                      <div className="central-inset mt-3 p-3">
                        <p className="mb-2 text-xs font-medium">Flag this answer</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={flagLevel}
                            onChange={(e) => setFlagLevel(e.target.value as typeof flagLevel)}
                            className="h-8 rounded-lg border bg-background px-2 text-xs"
                          >
                            <option value="USE_WITH_CARE">Use with care — still packable</option>
                            <option value="DO_NOT_USE">Do not use — excluded from packs</option>
                          </select>
                        </div>
                        <Input
                          value={flagReason}
                          onChange={(e) => setFlagReason(e.target.value)}
                          placeholder="Why? This is shown with the answer and travels into packs."
                          className="mt-2 h-9 rounded-lg text-xs"
                        />
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            className="rounded-lg"
                            disabled={flagReason.trim().length < 3}
                            onClick={() => submitFlag(a.id)}
                          >
                            Save flag
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setFlagFor(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add an answer */}
      <form onSubmit={postAnswer} className="central-card mt-4 bg-[var(--central-recessed)] p-4">
        <label htmlFor="answer-body" className="mb-1.5 block text-[13px] font-medium">
          Add your answer
        </label>
        <Textarea
          id="answer-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="What do you actually say?"
          className="bg-white text-sm leading-[1.55]"
        />

        {sources.map((s, i) => (
          <Input
            key={i}
            value={s}
            onChange={(e) => setSources((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
            placeholder="https://…"
            className="mt-2 h-9 rounded-lg bg-white text-xs"
            type="url"
          />
        ))}
        {localExample !== null && (
          <Textarea
            value={localExample}
            onChange={(e) => setLocalExample(e.target.value)}
            rows={2}
            placeholder="What happened on your patch?"
            className="mt-2 bg-white text-xs"
          />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-lg border-dashed text-xs"
            onClick={() => setSources((prev) => [...prev, ''])}
          >
            + Add a source
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="central-teal-text-deep h-8 rounded-lg border-dashed border-[var(--central-teal-border)] text-xs"
            onClick={() => setLocalExample((v) => (v === null ? '' : v))}
          >
            + Add a local example
          </Button>
          <Button type="submit" size="sm" className="ml-auto rounded-lg" disabled={posting || !body.trim()}>
            {posting ? 'Posting…' : 'Post answer'}
          </Button>
        </div>
      </form>
    </div>
  )
}
