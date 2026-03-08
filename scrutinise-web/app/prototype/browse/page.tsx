'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MOCK_IDEAS, Stage } from '@/lib/mockData'

const stageBadgeColors: Record<Stage, string> = {
  Create: 'bg-gray-700 text-gray-300',
  Draft: 'bg-blue-900 text-blue-300',
  Develop: 'bg-amber-900 text-amber-300',
  Campaign: 'bg-purple-900 text-purple-300',
  Parliament: 'bg-green-900 text-green-300',
}

const areas = ['All', ...Array.from(new Set(MOCK_IDEAS.map(i => i.area)))]
const stages: ('All' | Stage)[] = ['All', 'Create', 'Draft', 'Develop', 'Campaign', 'Parliament']

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
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">Browse Ideas</h1>
        <p className="text-gray-400 text-sm">{MOCK_IDEAS.length} ideas in the prototype</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search ideas..."
          className="flex-1 min-w-48 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-revolutBlue"
        />
        <select
          value={areaFilter}
          onChange={e => setAreaFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
        >
          {areas.map(a => <option key={a} value={a}>{a === 'All' ? 'All Areas' : a}</option>)}
        </select>
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value as 'All' | Stage)}
          className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
        >
          {stages.map(s => <option key={s} value={s}>{s === 'All' ? 'All Stages' : s}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'votes' | 'date' | 'credibility')}
          className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
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
              className="block bg-gray-900 border border-gray-700 rounded-xl p-5 hover:border-gray-500 hover:bg-gray-800 transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageBadgeColors[idea.stage]}`}>
                  {idea.stage}
                </span>
                <span className="text-xs text-gray-500 font-mono">&#10025; {idea.credibilityScore}</span>
              </div>
              <h2 className="text-sm font-semibold text-white mb-2 leading-snug group-hover:text-blue-300 transition-colors line-clamp-2">
                {idea.title}
              </h2>
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-3 mb-3">{idea.summary}</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="bg-gray-800 px-2 py-0.5 rounded-full">{idea.area}</span>
                <span>{total.toLocaleString()} votes</span>
              </div>
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 text-gray-600">
          <p>No ideas match your filters.</p>
        </div>
      )}
    </main>
  )
}
