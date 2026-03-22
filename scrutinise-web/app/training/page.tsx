'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MOCK_TRAINING, Stage } from '@/lib/mockData'
import PublicNav from '@/components/PublicNav'

type StageFilter = Stage | 'All'
type DifficultyFilter = 'All' | 'Beginner' | 'Intermediate' | 'Advanced'
type TypeFilter = 'All' | 'VIDEO' | 'ARTICLE'

const stageBadgeColors: Partial<Record<Stage | string, string>> = {
  All: 'bg-muted text-muted-foreground',
  Create: 'bg-muted text-muted-foreground',
  Draft: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Develop: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Campaign: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Legislate: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
}

const difficultyColors: Record<string, string> = {
  Beginner: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Intermediate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Advanced: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

export default function TrainingPage() {
  const [stageFilter, setStageFilter] = useState<StageFilter>('All')
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('All')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All')
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null)

  const filtered = MOCK_TRAINING.filter(r => {
    const stageMatch = stageFilter === 'All' || r.stageTag === stageFilter || r.stageTag === 'All'
    const diffMatch = difficultyFilter === 'All' || r.difficultyTag === difficultyFilter
    const typeMatch = typeFilter === 'All' || r.resourceType === typeFilter
    return stageMatch && diffMatch && typeMatch
  })

  const stages: StageFilter[] = ['All', 'Create', 'Draft', 'Develop', 'Campaign', 'Legislate']
  const difficulties: DifficultyFilter[] = ['All', 'Beginner', 'Intermediate', 'Advanced']
  const types: TypeFilter[] = ['All', 'VIDEO', 'ARTICLE']

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-xl font-semibold tracking-tight mt-4">Training</h1>
          <p className="text-muted-foreground text-base mt-2">
            Resources to help you develop ideas, draft legislation, and navigate the parliamentary process.
          </p>
        </div>

        {/* Filter bar */}
        <div className="space-y-3 mb-8">
          {/* Stage filter */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground mr-1">Stage:</span>
            {stages.map(s => (
              <button
                key={s}
                onClick={() => setStageFilter(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  stageFilter === s
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border text-foreground hover:bg-accent'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-4">
            {/* Difficulty */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Difficulty:</span>
              {difficulties.map(d => (
                <button
                  key={d}
                  onClick={() => setDifficultyFilter(d)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    difficultyFilter === d
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border text-foreground hover:bg-accent'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Type */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Type:</span>
              {types.map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    typeFilter === t
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border text-foreground hover:bg-accent'
                  }`}
                >
                  {t === 'VIDEO' ? 'Video' : t === 'ARTICLE' ? 'Article' : t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results count */}
        <p className="text-xs text-muted-foreground mb-4">{filtered.length} resource{filtered.length !== 1 ? 's' : ''}</p>

        {/* Resource cards */}
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No resources match your filters.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(resource => (
              <div key={resource.id} className="bg-card border border-border rounded-lg p-5 hover:border-foreground/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${resource.resourceType === 'VIDEO' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-muted text-muted-foreground'}`}>
                        {resource.resourceType === 'VIDEO' ? '▶ Video' : '📄 Article'}
                      </span>
                      {resource.stageTag !== 'All' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageBadgeColors[resource.stageTag] ?? 'bg-muted text-muted-foreground'}`}>
                          {resource.stageTag}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyColors[resource.difficultyTag]}`}>
                        {resource.difficultyTag}
                      </span>
                    </div>
                    <h2 className="text-base font-semibold text-foreground mb-1">{resource.title}</h2>
                    <p className="text-xs text-muted-foreground">{resource.author} · {resource.duration} · {resource.topicTag}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {resource.resourceType === 'VIDEO' ? (
                      <button
                        onClick={() => setExpandedVideo(expandedVideo === resource.id ? null : resource.id)}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-semibold transition-colors"
                      >
                        {expandedVideo === resource.id ? '✕ Close' : '▶ Watch'}
                      </button>
                    ) : (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 border border-border text-foreground hover:bg-accent rounded-md text-sm font-medium transition-colors inline-block"
                      >
                        Read →
                      </a>
                    )}
                  </div>
                </div>

                {/* Video embed */}
                {resource.resourceType === 'VIDEO' && expandedVideo === resource.id && (
                  <div className="mt-4">
                    <iframe
                      src={resource.url}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full aspect-video rounded-lg"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
