'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MOCK_TRAINING, Stage } from '@/lib/mockData'

type StageFilter = Stage | 'All'
type DifficultyFilter = 'All' | 'Beginner' | 'Intermediate' | 'Advanced'
type TypeFilter = 'All' | 'VIDEO' | 'ARTICLE'

const stageBadgeColors: Partial<Record<Stage | string, string>> = {
  All: 'bg-gray-700 text-gray-300',
  Create: 'bg-gray-700 text-gray-300',
  Draft: 'bg-blue-900 text-blue-300',
  Develop: 'bg-amber-900 text-amber-300',
  Campaign: 'bg-purple-900 text-purple-300',
  Parliament: 'bg-green-900 text-green-300',
}

const difficultyColors: Record<string, string> = {
  Beginner: 'bg-green-900 text-green-300',
  Intermediate: 'bg-amber-900 text-amber-300',
  Advanced: 'bg-red-900 text-red-300',
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

  const stages: StageFilter[] = ['All', 'Create', 'Draft', 'Develop', 'Campaign', 'Parliament']
  const difficulties: DifficultyFilter[] = ['All', 'Beginner', 'Intermediate', 'Advanced']
  const types: TypeFilter[] = ['All', 'VIDEO', 'ARTICLE']

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            ← Home
          </Link>
          <h1 className="text-3xl font-bold text-white mt-4">Training</h1>
          <p className="text-gray-400 text-base mt-2">
            Resources to help you develop ideas, draft legislation, and navigate the parliamentary process.
          </p>
        </div>

        {/* Filter bar */}
        <div className="space-y-3 mb-8">
          {/* Stage filter */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-gray-600 mr-1">Stage:</span>
            {stages.map(s => (
              <button
                key={s}
                onClick={() => setStageFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  stageFilter === s
                    ? 'bg-revolutBlue border-revolutBlue text-white'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-4">
            {/* Difficulty */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-gray-600">Difficulty:</span>
              {difficulties.map(d => (
                <button
                  key={d}
                  onClick={() => setDifficultyFilter(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    difficultyFilter === d
                      ? 'bg-revolutBlue border-revolutBlue text-white'
                      : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Type */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-gray-600">Type:</span>
              {types.map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    typeFilter === t
                      ? 'bg-revolutBlue border-revolutBlue text-white'
                      : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {t === 'VIDEO' ? 'Video' : t === 'ARTICLE' ? 'Article' : t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results count */}
        <p className="text-xs text-gray-600 mb-4">{filtered.length} resource{filtered.length !== 1 ? 's' : ''}</p>

        {/* Resource cards */}
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No resources match your filters.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(resource => (
              <div key={resource.id} className="bg-gray-900 border border-gray-700 rounded-xl p-5 hover:border-gray-500 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${resource.resourceType === 'VIDEO' ? 'bg-blue-900 text-blue-300' : 'bg-gray-700 text-gray-300'}`}>
                        {resource.resourceType === 'VIDEO' ? '▶ Video' : '📄 Article'}
                      </span>
                      {resource.stageTag !== 'All' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageBadgeColors[resource.stageTag] ?? 'bg-gray-700 text-gray-300'}`}>
                          {resource.stageTag}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyColors[resource.difficultyTag]}`}>
                        {resource.difficultyTag}
                      </span>
                    </div>
                    <h2 className="text-base font-semibold text-white mb-1">{resource.title}</h2>
                    <p className="text-xs text-gray-500">{resource.author} · {resource.duration} · {resource.topicTag}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {resource.resourceType === 'VIDEO' ? (
                      <button
                        onClick={() => setExpandedVideo(expandedVideo === resource.id ? null : resource.id)}
                        className="px-4 py-2 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors"
                      >
                        {expandedVideo === resource.id ? '✕ Close' : '▶ Watch'}
                      </button>
                    ) : (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 rounded-xl text-sm font-medium transition-colors inline-block"
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
