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
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-green-400 text-lg font-semibold mb-2">Research added</p>
          <p className="text-muted-foreground text-sm mb-6">Your research has been attached to this idea and is now visible in the Research tab.</p>
          <Link
            href={`/prototype/idea/${idea.id}`}
            className="inline-block px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-semibold transition-colors"
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
        <Link href={`/prototype/idea/${idea.id}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Back to idea
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-foreground mt-4">Add Research</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Adding research to: <span className="text-foreground font-medium">{idea.title}</span>
        </p>
      </div>

      <div className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Title <span className="text-muted-foreground normal-case">(required)</span></label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Dutch EPC Standards: Market Impact 2021-2023"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>

        {/* Snippet */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Key finding <span className="text-muted-foreground normal-case">(required — 1-3 sentences)</span></label>
          <textarea
            value={snippet}
            onChange={e => setSnippet(e.target.value)}
            placeholder="The single most relevant finding or conclusion from this source."
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          />
        </div>

        {/* Relevance */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Relevance explanation <span className="text-muted-foreground normal-case">(required)</span></label>
          <textarea
            value={relevance}
            onChange={e => setRelevance(e.target.value)}
            placeholder="Why is this source relevant to this specific idea?"
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          />
        </div>

        {/* Summary */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Summary <span className="text-muted-foreground normal-case">(optional)</span></label>
          <textarea
            value={summary}
            onChange={e => setSummary(e.target.value)}
            placeholder="Brief overview of the source content."
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          />
        </div>

        {/* Source URL */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Source URL <span className="text-muted-foreground normal-case">(required)</span></label>
          <input
            type="url"
            value={sourceUrl}
            onChange={e => setSourceUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>

        {/* Source type */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Source type</label>
          <select
            value={sourceType}
            onChange={e => setSourceType(e.target.value as SourceType)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            {(['Academic', 'Government', 'News', 'Case Study', 'Legislation', 'Other'] as SourceType[]).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* For policy toggle */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Supports this policy?</label>
          <div className="flex gap-3">
            {[true, false].map(val => (
              <button
                key={String(val)}
                onClick={() => setForPolicy(val)}
                className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                  forPolicy === val
                    ? val ? 'bg-green-800 border-green-600 text-green-200' : 'bg-red-900 border-red-700 text-red-200'
                    : 'border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {val ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>

        {/* For action toggle */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Supports proposed action?</label>
          <div className="flex gap-3">
            {[true, false].map(val => (
              <button
                key={String(val)}
                onClick={() => setForAction(val)}
                className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                  forAction === val
                    ? val ? 'bg-green-800 border-green-600 text-green-200' : 'bg-red-900 border-red-700 text-red-200'
                    : 'border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {val ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>

        {/* Quality score */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Quality self-assessment (1–5)</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => setQualityScore(star)}
                className={`text-xl transition-colors ${qualityScore >= star ? 'text-amber-400' : 'text-muted-foreground hover:text-foreground'}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        {/* File upload */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Attach PDF <span className="text-muted-foreground normal-case">(optional, max 10MB)</span></label>
          <input
            type="file"
            accept=".pdf"
            className="text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:text-xs file:text-foreground file:bg-background hover:file:bg-accent file:cursor-pointer"
          />
        </div>

        <button
          onClick={() => { if (isValid) setSubmitted(true) }}
          disabled={!isValid}
          className="w-full py-3 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 rounded-md text-sm font-semibold transition-colors"
        >
          Add Research
        </button>
      </div>
    </main>
  )
}
