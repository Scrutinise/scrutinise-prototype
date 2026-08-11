'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { TagSet } from '../../questions/QuestionLibrary'
import PackOutput, { type PackEntryView } from './PackOutput'

export default function PackBuilder({
  communityId,
  communityName,
  branchName,
  tags,
}: {
  communityId: string
  communityName: string
  branchName: string | null
  tags: TagSet
}) {
  const [side, setSide] = useState<'external' | 'internal'>('external')
  const [context, setContext] = useState('')
  const [topic, setTopic] = useState('')
  const [sort, setSort] = useState('top-month')
  const [size, setSize] = useState<10 | 25 | 50>(10)
  const [includeFavourites, setIncludeFavourites] = useState(true)
  const [withSources, setWithSources] = useState(true)
  const [withLocalExamples, setWithLocalExamples] = useState(false)
  const [pinned, setPinned] = useState<string[]>([])
  const [removed, setRemoved] = useState<string[]>([])
  const [entries, setEntries] = useState<PackEntryView[]>([])
  const [available, setAvailable] = useState(0)
  const [disclaimer, setDisclaimer] = useState('')
  const [loading, setLoading] = useState(true)
  const [showOutput, setShowOutput] = useState(false)

  const build = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/communities/${communityId}/packs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: { side, context: context || undefined, topic: topic || undefined, sort },
        size,
        pinnedQuestionIds: pinned,
        removedQuestionIds: removed,
        includeFavourites,
      }),
    })
    if (res.ok) {
      const d = await res.json()
      setEntries(d.entries)
      setAvailable(d.available)
      setDisclaimer(d.disclaimer)
    }
    setLoading(false)
  }, [communityId, side, context, topic, sort, size, pinned, removed, includeFavourites])

  useEffect(() => {
    build()
  }, [build])

  if (showOutput) {
    return (
      <PackOutput
        entries={entries}
        disclaimer={disclaimer}
        communityName={communityName}
        branchName={branchName}
        contextLabel={context || (side === 'external' ? 'Out in the world' : 'Behind the scenes')}
        withSources={withSources}
        withLocalExamples={withLocalExamples}
        onBack={() => setShowOutput(false)}
      />
    )
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        <Link href={`/communities/${communityId}?tab=questions`} className="hover:underline">
          ← Question library
        </Link>
      </p>
      <h1 className="text-xl font-semibold tracking-[-0.02em]">Build a pack</h1>
      <p className="mt-1 text-[13px] text-muted-foreground pretty">
        Turn the library into something you can carry to a doorstep or a training room.
      </p>

      <div className="mt-5 grid items-start gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))' }}>
        {/* Filters */}
        <div className="central-card p-4">
          <h2 className="mb-3 text-[13px] font-semibold">Filters</h2>
          <div className="space-y-2 text-[13px]">
            <label className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Side</span>
              <select
                value={side}
                onChange={(e) => { setSide(e.target.value as typeof side); setContext('') }}
                className="h-8 rounded-lg border bg-background px-2 text-xs"
              >
                <option value="external">Out in the world</option>
                <option value="internal">Behind the scenes</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Context</span>
              <select
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="h-8 rounded-lg border bg-background px-2 text-xs"
              >
                <option value="">All</option>
                {(side === 'external' ? tags.contextExternal : tags.contextInternal).map((t) => (
                  <option key={t.label} value={t.label}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Topic</span>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-8 rounded-lg border bg-background px-2 text-xs"
              >
                <option value="">All</option>
                {tags.topics.map((t) => (
                  <option key={t.label} value={t.label}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Ranked by</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-8 rounded-lg border bg-background px-2 text-xs"
              >
                <option value="top-month">Top this month</option>
                <option value="top-all">Top all time</option>
                <option value="newest">Newest</option>
              </select>
            </label>
          </div>
        </div>

        {/* Size */}
        <div className="central-card p-4">
          <h2 className="mb-3 text-[13px] font-semibold">Pack size</h2>
          <div className="flex gap-2">
            {([10, 25, 50] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSize(n)}
                className={`h-9 flex-1 rounded-lg border text-[13px] font-medium transition-colors ${
                  size === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white'
                }`}
              >
                Top {n}
              </button>
            ))}
          </div>
          {/* Reconcile the request with reality rather than silently giving
              them fewer than they asked for. */}
          <p className="tabular mt-2 text-xs text-muted-foreground pretty">
            The library holds {available} question{available === 1 ? '' : 's'} matching these filters, so
            this pack is {Math.min(available, size)} of a possible {size}.
          </p>
        </div>

        {/* Contents */}
        <div className="central-card p-4">
          <h2 className="mb-3 text-[13px] font-semibold">Include with each question</h2>
          <label className="flex items-center gap-2 py-1 text-[13px]">
            <input type="checkbox" checked readOnly /> Top answer
          </label>
          <label className="flex items-center gap-2 py-1 text-[13px]">
            <input type="checkbox" checked={withSources} onChange={(e) => setWithSources(e.target.checked)} />
            Sources
          </label>
          <label className="flex items-center gap-2 py-1 text-[13px]">
            <input
              type="checkbox"
              checked={withLocalExamples}
              onChange={(e) => setWithLocalExamples(e.target.checked)}
            />
            Local examples
          </label>
          <div className="mt-2 border-t border-border pt-2">
            <label className="flex items-center gap-2 py-1 text-[13px]">
              <input
                type="checkbox"
                checked={includeFavourites}
                onChange={(e) => setIncludeFavourites(e.target.checked)}
              />
              Favourite answers
            </label>
            {/* ADDITIVE, not substitutive — the community's top answer is never
                silently replaced by a private pick. */}
            <p className="mt-1 text-xs text-muted-foreground pretty">
              Where you’ve favourited an answer, the pack carries yours <strong>as well as</strong> the
              top-voted one, so you can see both. Private to you — nobody else sees which you picked.
            </p>
          </div>
        </div>

        {/* Preview */}
        <div className="central-card p-4 md:col-span-2" style={{ gridColumn: 'span 2' }}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="tabular text-[13px] font-semibold">
              Live preview — {entries.length} question{entries.length === 1 ? '' : 's'}
            </h2>
            <span className="tabular text-xs text-muted-foreground">{pinned.length} pinned</span>
          </div>

          {loading ? (
            <p className="text-xs text-muted-foreground">Building…</p>
          ) : entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing matches these filters yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {entries.map((e, i) => (
                <div
                  key={e.questionId}
                  className={`flex items-start gap-3 py-2.5 ${e.pinned ? 'bg-[var(--central-teal-fill-faint)]' : ''}`}
                >
                  <span className="tabular w-[22px] shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug pretty">{e.text}</p>
                    <p className="tabular mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{e.voteCount} votes</span>
                      {e.answer?.flag && (
                        <span className="text-amber-700">
                          {e.answer.flag.level === 'USE_WITH_CARE' ? 'Use with care' : 'Flagged'}
                        </span>
                      )}
                      {!e.answer && <span>No answer yet</span>}
                    </p>
                    {e.favouriteAnswer && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-primary px-2 py-0.5 text-[11px] font-medium text-primary">
                        ★ Your favourite answer also included
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setPinned((p) => (p.includes(e.questionId) ? p.filter((x) => x !== e.questionId) : [...p, e.questionId]))
                      }
                      className={`rounded-md px-2 py-1 text-[11px] ${
                        e.pinned ? 'central-teal-text font-semibold' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {e.pinned ? 'Pinned' : 'Pin'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemoved((r) => [...r, e.questionId])}
                      className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Pinned questions stay put when the ranking moves.</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setPinned([]); setRemoved([]) }}
              >
                Reset
              </Button>
              <Button size="sm" className="rounded-lg" disabled={entries.length === 0} onClick={() => setShowOutput(true)}>
                Export pack
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
