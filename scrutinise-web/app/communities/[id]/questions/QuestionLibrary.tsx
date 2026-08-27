'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import BulkUpload from './BulkUpload'
import { AiLabel } from '@/components/central/AnswerByline'

export interface QuestionRow {
  id: string
  text: string
  scope: string
  contextTags: string[]
  topicTags: string[]
  voteCount: number
  answerCount: number
  myVote: boolean
  branchName: string | null
  answerPreview: string | null
  /** Stage 2e — whether the previewed answer was written by AI. */
  answerPreviewIsAI: boolean
  hasSources: boolean
  hasLocalExample: boolean
}

export interface TagSet {
  contextExternal: { label: string; promoted: boolean }[]
  contextInternal: { label: string; promoted: boolean }[]
  topics: { label: string; promoted: boolean }[]
}

/**
 * The question vote — "I've been asked this too".
 *
 * Up only. There is no downvote because the vote records FREQUENCY, not
 * quality, and self-voting is allowed because the asker demonstrably was asked.
 * The tooltip says so in as many words; on touch it is unreachable, which is
 * why the control shows an explicit ▲ and a count rather than a bare icon.
 */
function QuestionVote({
  count,
  voted,
  onVote,
}: {
  count: number
  voted: boolean
  onVote: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <div className={`relative shrink-0 ${hover ? 'z-20' : ''}`}>
      <button
        type="button"
        onClick={onVote}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-pressed={voted}
        aria-label={voted ? 'You have been asked this. Click to undo.' : 'Click if you have been asked this too'}
        className={`flex w-12 min-h-12 flex-col items-center justify-center gap-0.5 rounded-[10px] border transition-colors ${
          voted
            ? 'border-primary bg-primary/[0.07] text-primary'
            : 'border-border bg-white text-muted-foreground hover:border-[var(--central-border-hover)]'
        }`}
      >
        <span className="text-[11px] leading-none">▲</span>
        <span className="tabular text-sm font-semibold leading-none">{count}</span>
      </button>
      {hover && (
        <span className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-30 w-[178px] -translate-x-1/2 rounded-lg bg-foreground px-2 py-1.5 text-[11px] leading-snug text-white shadow-lg">
          {voted
            ? 'You’ve told us you’ve been asked this. Click to undo.'
            : 'Click if you’ve been asked this question too'}
        </span>
      )}
    </div>
  )
}

export default function QuestionLibrary({
  communityId,
  tags,
  initialQuestions,
  canBulkUpload,
  uploaderName,
}: {
  communityId: string
  tags: TagSet
  initialQuestions: QuestionRow[]
  /** Community admins only — a bulk vector should stay reviewable. */
  canBulkUpload: boolean
  uploaderName: string
}) {
  const [uploading, setUploading] = useState(false)
  const [questions, setQuestions] = useState<QuestionRow[]>(initialQuestions)
  const [loading, setLoading] = useState(false)
  // The two-way toggle: the external/internal split. Not a nav item — chips
  // filter WITHIN the selected side, so the chip row stays short.
  const [side, setSide] = useState<'external' | 'internal'>('external')
  const [context, setContext] = useState('')
  const [topic, setTopic] = useState('')
  const [sort, setSort] = useState('top-month')
  const [search, setSearch] = useState('')
  const [activeSearch, setActiveSearch] = useState('')

  const sideTags = side === 'external' ? tags.contextExternal : tags.contextInternal

  // Stage 2d: THE CHIP ROW IS CONTEXTS ONLY. Contexts pair one-to-one with the
  // Out-in-the-world / Behind-the-scenes toggle directly above them, so a topic
  // chip sitting in the same row read as a third context and filtered on a
  // different axis without saying so. Topics live in the dropdown, where
  // `promoted` now orders them: promoted first, so promotion still means
  // something visible.
  const orderedTopics = [...tags.topics].sort(
    (a, b) => Number(b.promoted) - Number(a.promoted) || a.label.localeCompare(b.label),
  )

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ side, sort })
    if (context) params.set('context', context)
    if (topic) params.set('topic', topic)
    if (activeSearch) params.set('search', activeSearch)
    const res = await fetch(`/api/communities/${communityId}/questions?${params}`)
    if (res.ok) setQuestions((await res.json()).questions)
    setLoading(false)
  }, [communityId, side, context, topic, sort, activeSearch])

  useEffect(() => {
    load()
  }, [load])

  async function vote(id: string) {
    const res = await fetch(`/api/communities/${communityId}/questions/${id}/vote`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, voteCount: data.count, myVote: data.voted } : q)),
      )
    }
  }

  const countLine = context
    ? `${questions.length} question${questions.length === 1 ? '' : 's'} in ${context.toLowerCase()}`
    : `${questions.length} question${questions.length === 1 ? '' : 's'}`

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[640px]">
          <h2 className="text-xl font-semibold tracking-[-0.02em]">Question library</h2>
          {/* Item 15 — the standing description for this tab, verbatim. */}
          <p className="mt-1 text-[13px] text-muted-foreground pretty">
            This section is for sharing best practice answers to common questions. Add questions
            you’ve faced or suggest answers. Vote for questions if you’ve been asked this too. Vote
            for answers you have tested and delivered a positive response.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap gap-2">
            {canBulkUpload && (
              <Button
                variant="outline"
                className="h-10 rounded-lg"
                onClick={() => setUploading((v) => !v)}
              >
                Bulk upload
              </Button>
            )}
            <Button asChild variant="outline" className="h-10 rounded-lg">
              <Link href={`/communities/${communityId}/questions/new`}>Add a question</Link>
            </Button>
            <Button asChild className="h-10 rounded-lg">
              <Link href={`/communities/${communityId}/packs/new`}>Build a pack</Link>
            </Button>
          </div>
          {canBulkUpload && (
            <a
              href="/central-question-upload-template.xlsx"
              download
              className="text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Download template
            </a>
          )}
        </div>
      </div>

      {uploading && (
        <BulkUpload
          communityId={communityId}
          uploaderName={uploaderName}
          onDone={load}
          onClose={() => setUploading(false)}
        />
      )}

      {/* Filters */}
      <div className="mb-4 border-b border-border pb-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setActiveSearch(search.trim())}
            placeholder="Search questions…"
            className="h-[38px] flex-1 basis-[220px] rounded-lg"
          />
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            aria-label="Topic"
            className="h-[38px] rounded-lg border bg-background px-2 text-sm"
          >
            <option value="">All topics</option>
            {/* Two axes, grouped so they read as two (26 Aug 2026): nineteen
                subjects and three about doing the job. `promoted` carries the
                split — the chip row has been contexts-only since Stage 2d, so
                that flag's only remaining job is this ordering. */}
            <optgroup label="Subject">
              {orderedTopics.filter((t) => t.promoted).map((t) => (
                <option key={t.label} value={t.label}>{t.label}</option>
              ))}
            </optgroup>
            <optgroup label="Doing the job">
              {orderedTopics.filter((t) => !t.promoted).map((t) => (
                <option key={t.label} value={t.label}>{t.label}</option>
              ))}
            </optgroup>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort"
            className="h-[38px] rounded-lg border bg-background px-2 text-sm"
          >
            <option value="top-month">Top this month</option>
            <option value="top-all">Top all time</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        {/* The external/internal split. */}
        <div className="mb-3 inline-flex rounded-lg border border-border p-0.5">
          {([
            ['external', 'Out in the world'],
            ['internal', 'Behind the scenes'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => { setSide(key); setContext('') }}
              aria-pressed={side === key}
              className={`rounded-[7px] px-3 py-1.5 text-[13px] transition-colors ${
                side === key
                  ? 'bg-[oklch(0.955_0.004_250)] font-semibold text-foreground ring-1 ring-inset ring-border'
                  : 'font-medium text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setContext('')}

            className={`central-chip border px-3 text-[13px] transition-colors ${
              context === ''
                ? 'border-primary bg-primary font-semibold text-primary-foreground'
                : 'border-border bg-white text-[oklch(0.3_0.01_250)] hover:border-[var(--central-border-hover)]'
            }`}
          >
            All
          </button>
          {sideTags.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setContext(t.label)}
              className={`central-chip border px-3 text-[13px] transition-colors ${
                context === t.label
                  ? 'border-primary bg-primary font-semibold text-primary-foreground'
                  : 'border-border bg-white text-[oklch(0.3_0.01_250)] hover:border-[var(--central-border-hover)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stage 2e — the vote affordance. Charlie worked out that clicking again
          removes the vote, but a hint costs nothing and the control is a bare
          triangle and a number. */}
      <p className="mb-3 text-[13px] text-muted-foreground">
        <span className="tabular">{loading ? '…' : countLine}</span>
        <span className="ml-2 text-[12px]">
          ▲ You get one vote per question — click it again to take it back.
        </span>
        {activeSearch && (
          <>
            {' '}for “{activeSearch}”{' '}
            <button
              type="button"
              onClick={() => { setSearch(''); setActiveSearch('') }}
              className="underline underline-offset-2 hover:text-foreground"
            >
              clear
            </button>
          </>
        )}
      </p>

      {questions.length === 0 ? (
        <EmptyLibrary communityId={communityId} filtered={Boolean(context || topic || activeSearch)} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {questions.map((q) => (
            <div key={q.id} className="central-card central-card-hover flex items-start gap-3.5 p-3.5 transition-all">
              <QuestionVote count={q.voteCount} voted={q.myVote} onVote={() => vote(q.id)} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Link
                  href={`/communities/${communityId}/questions/${q.id}`}
                  className="text-[15px] font-semibold leading-[1.4] tracking-[-0.01em] pretty hover:underline"
                >
                  {q.text}
                </Link>
                {q.answerPreview && (
                  <div className="border-l-2 border-border pl-2.5">
                    {/* The list is the one place most people ever look, so the
                        label goes ABOVE the text, not after it. */}
                    {q.answerPreviewIsAI && <AiLabel aiModel={null} className="mb-1" />}
                    <p className="text-[13px] leading-[1.55] text-[oklch(0.42_0.01_250)] pretty">
                      {q.answerPreview}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {[...q.contextTags, ...q.topicTags].map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-[oklch(0.92_0.004_250)] bg-[var(--central-chip-fill)] px-2 py-0.5 font-medium"
                    >
                      {t}
                    </span>
                  ))}
                  {q.scope === 'BRANCH' && q.branchName && (
                    <span className="rounded-full border border-[oklch(0.92_0.004_250)] bg-white px-2 py-0.5 font-medium text-muted-foreground">
                      {q.branchName} only
                    </span>
                  )}
                  <span className="tabular text-muted-foreground">
                    {q.answerCount} answer{q.answerCount === 1 ? '' : 's'}
                  </span>
                  {q.hasSources && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <span className="inline-block size-[5px] rounded-full bg-primary" />
                      Has sources
                    </span>
                  )}
                  {q.hasLocalExample && (
                    <span className="central-teal-text flex items-center gap-1">
                      <span className="central-teal-dot inline-block size-[5px] rounded-full" />
                      Local example
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * The empty state frames the library as filling up from the doorstep rather
 * than needing an admin to seed it. This copy is the product's intent and is
 * kept close to the handoff wording.
 */
function EmptyLibrary({ communityId, filtered }: { communityId: string; filtered: boolean }) {
  if (filtered) {
    return (
      <div className="central-card p-11 text-center">
        <p className="text-[13px] text-muted-foreground">No questions match these filters yet.</p>
      </div>
    )
  }
  return (
    <div className="central-card px-6 py-11 text-center">
      <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-[10px] bg-[var(--central-teal-fill-strong)] text-lg font-semibold central-teal-text">
        ?
      </div>
      <h3 className="text-[17px] font-semibold">No questions here yet</h3>
      <p className="mx-auto mt-2 max-w-[430px] text-[13px] leading-relaxed text-muted-foreground pretty">
        This library fills up from the doorstep. The next time someone puts a hard question to you,
        write it down here the way they asked it — someone else in the Community has probably been
        asked the same thing.
      </p>
      <Button asChild className="mt-4 h-10 rounded-lg">
        <Link href={`/communities/${communityId}/questions/new`}>Add the first question</Link>
      </Button>
      <p className="mt-3 text-[12px] text-muted-foreground">
        Or start from 10 questions most Communities meet in their first month.
      </p>
    </div>
  )
}
