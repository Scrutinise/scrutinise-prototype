'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { MOCK_IDEAS } from '@/lib/mockData'

type SourceType = 'Academic' | 'Government' | 'News' | 'Case Study' | 'Legislation' | 'Other'

type Props = { params: Promise<{ ideaId: string }> }

export default function AddResearchPage({ params }: Props) {
  const { ideaId } = use(params)
  const idea = MOCK_IDEAS.find(i => i.id === ideaId) ?? MOCK_IDEAS[0]

  const [title, setTitle] = useState('')
  const [snippet, setSnippet] = useState('')
  const [relevance, setRelevance] = useState('')
  const [summary, setSummary] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceType, setSourceType] = useState<SourceType>('Academic')
  const [forPolicy, setForPolicy] = useState<boolean | null>(null)
  const [forAction, setForAction] = useState<boolean | null>(null)
  const [qualityScore, setQualityScore] = useState<number>(0)
  const [submitted, setSubmitted] = useState(false)

  const isValid = title.trim() && snippet.trim() && relevance.trim() && sourceUrl.trim()

  if (submitted) {
    return (
      <main className="max-w-xl mx-auto px-6 py-10">
        <div className="bg-gray-900 border border-green-800 rounded-xl p-8 text-center">
          <p className="text-green-400 text-lg font-semibold mb-2">Research added</p>
          <p className="text-gray-400 text-sm mb-6">Your research has been attached to this idea and is now visible in the Research tab.</p>
          <Link
            href={`/prototype/idea/${idea.id}`}
            className="inline-block px-5 py-2.5 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Return to idea →
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href={`/prototype/idea/${idea.id}`} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          ← Back to idea
        </Link>
        <h1 className="text-2xl font-bold text-white mt-4">Add Research</h1>
        <p className="text-sm text-gray-400 mt-1">
          Adding research to: <span className="text-white font-medium">{idea.title}</span>
        </p>
      </div>

      <div className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Title <span className="text-gray-600 normal-case">(required)</span></label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Dutch EPC Standards: Market Impact 2021-2023"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
          />
        </div>

        {/* Snippet */}
        <div>
          <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Key finding <span className="text-gray-600 normal-case">(required — 1-3 sentences)</span></label>
          <textarea
            value={snippet}
            onChange={e => setSnippet(e.target.value)}
            placeholder="The single most relevant finding or conclusion from this source."
            rows={3}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors resize-none"
          />
        </div>

        {/* Relevance */}
        <div>
          <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Relevance explanation <span className="text-gray-600 normal-case">(required)</span></label>
          <textarea
            value={relevance}
            onChange={e => setRelevance(e.target.value)}
            placeholder="Why is this source relevant to this specific idea?"
            rows={2}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors resize-none"
          />
        </div>

        {/* Summary */}
        <div>
          <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Summary <span className="text-gray-700 normal-case">(optional)</span></label>
          <textarea
            value={summary}
            onChange={e => setSummary(e.target.value)}
            placeholder="Brief overview of the source content."
            rows={2}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors resize-none"
          />
        </div>

        {/* Source URL */}
        <div>
          <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Source URL <span className="text-gray-600 normal-case">(required)</span></label>
          <input
            type="url"
            value={sourceUrl}
            onChange={e => setSourceUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
          />
        </div>

        {/* Source type */}
        <div>
          <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Source type</label>
          <select
            value={sourceType}
            onChange={e => setSourceType(e.target.value as SourceType)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-revolutBlue transition-colors"
          >
            {(['Academic', 'Government', 'News', 'Case Study', 'Legislation', 'Other'] as SourceType[]).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* For policy toggle */}
        <div>
          <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Supports this policy?</label>
          <div className="flex gap-3">
            {[true, false].map(val => (
              <button
                key={String(val)}
                onClick={() => setForPolicy(val)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  forPolicy === val
                    ? val ? 'bg-green-800 border-green-600 text-green-200' : 'bg-red-900 border-red-700 text-red-200'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {val ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>

        {/* For action toggle */}
        <div>
          <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Supports proposed action?</label>
          <div className="flex gap-3">
            {[true, false].map(val => (
              <button
                key={String(val)}
                onClick={() => setForAction(val)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  forAction === val
                    ? val ? 'bg-green-800 border-green-600 text-green-200' : 'bg-red-900 border-red-700 text-red-200'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {val ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>

        {/* Quality score */}
        <div>
          <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Quality self-assessment (1–5)</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => setQualityScore(star)}
                className={`text-xl transition-colors ${qualityScore >= star ? 'text-amber-400' : 'text-gray-700 hover:text-gray-500'}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        {/* File upload */}
        <div>
          <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Attach PDF <span className="text-gray-700 normal-case">(optional, max 10MB)</span></label>
          <input
            type="file"
            accept=".pdf"
            className="text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-600 file:text-xs file:text-gray-300 file:bg-gray-800 hover:file:bg-gray-700 file:cursor-pointer"
          />
        </div>

        <button
          onClick={() => { if (isValid) setSubmitted(true) }}
          disabled={!isValid}
          className="w-full py-3 bg-revolutBlue hover:bg-blue-600 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          Add Research
        </button>
      </div>
    </main>
  )
}
