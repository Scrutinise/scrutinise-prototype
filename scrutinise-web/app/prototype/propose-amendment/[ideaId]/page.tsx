'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { MOCK_IDEAS } from '@/lib/mockData'

type Props = { params: Promise<{ ideaId: string }> }

export default function ProposeAmendmentPage({ params }: Props) {
  const { ideaId } = use(params)
  const idea = MOCK_IDEAS.find(i => i.id === ideaId) ?? MOCK_IDEAS[0]

  const sectionOptions = [
    'Guiding Policy',
    'Diagnosis',
    ...idea.coherentActions.map(ca => ca.title),
  ]

  const getSectionText = (section: string) => {
    if (section === 'Guiding Policy') return idea.guidingPolicy
    if (section === 'Diagnosis') return idea.diagnosis
    const ca = idea.coherentActions.find(c => c.title === section)
    return ca?.description ?? ''
  }

  const [selectedSection, setSelectedSection] = useState(sectionOptions[0])
  const [currentText, setCurrentText] = useState(getSectionText(sectionOptions[0]))
  const [proposedText, setProposedText] = useState('')
  const [rationale, setRationale] = useState('')
  const [researchUrls, setResearchUrls] = useState<string[]>([''])
  const [relevantLegislation, setRelevantLegislation] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setCurrentText(getSectionText(selectedSection))
    setProposedText('')
  }, [selectedSection])

  const addUrlRow = () => setResearchUrls(prev => [...prev, ''])
  const updateUrl = (i: number, val: string) => {
    setResearchUrls(prev => prev.map((u, idx) => idx === i ? val : u))
  }
  const removeUrl = (i: number) => {
    setResearchUrls(prev => prev.filter((_, idx) => idx !== i))
  }

  const wordCountDiff = proposedText.trim().split(/\s+/).filter(Boolean).length - currentText.trim().split(/\s+/).filter(Boolean).length

  if (submitted) {
    return (
      <main className="max-w-xl mx-auto px-6 py-10">
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-green-400 text-lg font-semibold mb-2">Amendment submitted for review</p>
          <p className="text-muted-foreground text-sm mb-6">
            The idea owner will be notified and can accept, reject, or circulate your amendment for consultation.
          </p>
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
        <h1 className="text-xl font-semibold tracking-tight text-foreground mt-4">Propose Amendment</h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Proposing amendment to: <span className="text-foreground font-medium">{idea.title}</span>
        </p>
      </div>

      <div className="space-y-6">
        {/* Section selector */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Section to amend</label>
          <select
            value={selectedSection}
            onChange={e => setSelectedSection(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            {sectionOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Current text (read-only) */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Current text</label>
          <textarea
            value={currentText}
            readOnly
            rows={4}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground resize-none cursor-default"
          />
        </div>

        {/* Proposed text */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Proposed text</label>
            {proposedText && (
              <span className={`text-xs ${wordCountDiff > 0 ? 'text-amber-400' : wordCountDiff < 0 ? 'text-blue-400' : 'text-muted-foreground'}`}>
                {wordCountDiff > 0 ? `+${wordCountDiff}` : wordCountDiff} words
              </span>
            )}
          </div>
          <textarea
            value={proposedText}
            onChange={e => setProposedText(e.target.value)}
            placeholder="Enter your proposed replacement text..."
            rows={4}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          />
        </div>

        {/* Rationale */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Rationale <span className="text-muted-foreground normal-case">(required)</span></label>
          <textarea
            value={rationale}
            onChange={e => setRationale(e.target.value)}
            placeholder="Why does this change improve the idea? Be specific."
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          />
        </div>

        {/* Research URLs */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Supporting research URLs <span className="text-muted-foreground normal-case">(optional)</span></label>
          <div className="space-y-2">
            {researchUrls.map((url, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={e => updateUrl(i, e.target.value)}
                  placeholder="https://..."
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
                {researchUrls.length > 1 && (
                  <button
                    onClick={() => removeUrl(i)}
                    className="text-muted-foreground hover:text-red-400 px-2 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addUrlRow}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            + Add another URL
          </button>
        </div>

        {/* Relevant legislation */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Relevant legislation <span className="text-muted-foreground normal-case">(optional)</span></label>
          <input
            type="text"
            value={relevantLegislation}
            onChange={e => setRelevantLegislation(e.target.value)}
            placeholder="e.g. Housing Act 1988, section 21"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>

        <button
          onClick={() => { if (proposedText.trim() && rationale.trim()) setSubmitted(true) }}
          disabled={!proposedText.trim() || !rationale.trim()}
          className="w-full py-3 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 rounded-md text-sm font-semibold transition-colors"
        >
          Submit Amendment
        </button>
      </div>
    </main>
  )
}
