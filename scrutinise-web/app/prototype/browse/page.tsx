'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MOCK_IDEAS, Stage } from '@/lib/mockData'

const stageBadgeStyle: Record<Stage, React.CSSProperties> = {
  Create:     { backgroundColor: 'var(--stage-create)',     color: 'white' },
  Draft:      { backgroundColor: 'var(--stage-draft)',      color: 'white' },
  Develop:    { backgroundColor: 'var(--stage-develop)',    color: 'white' },
  Campaign:   { backgroundColor: 'var(--stage-campaign)',   color: 'white' },
  Legislate: { backgroundColor: 'var(--stage-parliament)', color: 'white' },
}

const areas = ['All', ...Array.from(new Set(MOCK_IDEAS.map(i => i.area)))]
const stages: ('All' | Stage)[] = ['All', 'Create', 'Draft', 'Develop', 'Campaign', 'Legislate']

export default function BrowsePage() {
  const [search, setSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState('All')
  const [stageFilter, setStageFilter] = useState<'All' | Stage>('All')
  const [sortBy, setSortBy] = useState<'votes' | 'date' | 'credibility'>('votes')

  const filtered = MOCK_IDEAS
    .filter(idea => {
      const matchSearch = idea.title.toLowerCase().includes(search.toLowerCase()) ||
        idea.summary.toLowerCase().includes(search.toLowerCase())
      const matchArea = areaFilter === 'All' || idea.area === areaFilter
      const matchStage = stageFilter === 'All' || idea.stage === stageFilter
      return matchSearch && matchArea && matchStage
    })
    .sort((a, b) => {
      if (sortBy === 'votes') return (b.voteCount.for + b.voteCount.against) - (a.voteCount.for + a.voteCount.against)
      if (sortBy === 'credibility') return b.credibilityScore - a.credibilityScore
      return b.createdAt.localeCompare(a.createdAt)
    })

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Browse Ideas</h1>
        <p className="mt-1 text-sm text-muted-foreground">{MOCK_IDEAS.length} ideas in the prototype</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search ideas..."
          autoFocus
          className="flex-1 min-w-48 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
        <select
          value={areaFilter}
          onChange={e => setAreaFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
        >
          {areas.map(a => <option key={a} value={a}>{a === 'All' ? 'All Areas' : a}</option>)}
        </select>
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value as 'All' | Stage)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
        >
          {stages.map(s => <option key={s} value={s}>{s === 'All' ? 'All Stages' : s}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'votes' | 'date' | 'credibility')}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
        >
          <option value="votes">Most Votes</option>
          <option value="date">Newest</option>
          <option value="credibility">Credibility</option>
        </select>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(idea => {
          const total = idea.voteCount.for + idea.voteCount.against + idea.voteCount.undecided
          return (
            <Link
              key={idea.id}
              href={`/prototype/idea/${idea.id}`}
              className="block rounded-lg border border-border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span
                  className="text-xs px-2 py-0.5 rounded-md font-medium"
                  style={stageBadgeStyle[idea.stage]}
                >
                  {idea.stage}
                </span>
                <span className="text-xs text-muted-foreground font-mono">&#10025; {idea.credibilityScore}</span>
              </div>
              <h2 className="text-sm font-semibold mb-2 leading-snug group-hover:text-primary transition-colors line-clamp-2">
                {idea.title}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-3">{idea.summary}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="bg-secondary px-2 py-0.5 rounded-md">{idea.area}</span>
                <span>{total.toLocaleString()} votes</span>
              </div>
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p>No ideas match your filters.</p>
        </div>
      )}
    </main>
  )
}
