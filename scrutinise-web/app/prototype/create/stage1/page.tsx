'use client'

import { useState } from 'react'
import Link from 'next/link'

const STAGES = ['Create', 'Draft', 'Develop', 'Campaign', 'Parliament']

const GOVT_AREAS = [
  'Housing',
  'Health',
  'Transport',
  'Education',
  'Economy',
  'Environment',
  'Justice',
  'Defence',
  'Foreign Policy',
  'Other',
]

type IdeaType = 'LEGISLATION' | 'ORGANISATION' | null

export default function Stage1Page() {
  const [title, setTitle] = useState('')
  const [ideaType, setIdeaType] = useState<IdeaType>(null)
  const [govtArea, setGovtArea] = useState('')
  const [summaryDescription, setSummaryDescription] = useState('')
  const [summaryDiagnosis, setSummaryDiagnosis] = useState('')
  const [summaryGuidingPolicy, setSummaryGuidingPolicy] = useState('')
  const [summaryCoherentActions, setSummaryCoherentActions] = useState('')
  const [connectedIdeas, setConnectedIdeas] = useState('')
  const [saved, setSaved] = useState(false)

  const isReadyForStage2 = title.trim().length > 0 && summaryDescription.trim().length > 0

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      {/* Stage progress indicator */}
      <div className="flex items-center gap-0 mb-10">
        {STAGES.map((stage, i) => (
          <div key={stage} className="flex items-center">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i === 0
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  i === 0 ? 'bg-primary-foreground' : 'bg-muted-foreground'
                }`}
              />
              {stage}
            </div>
            {i < STAGES.length - 1 && (
              <div className="w-6 h-px bg-border" />
            )}
          </div>
        ))}
      </div>

      <h1 className="text-3xl font-bold text-foreground mb-2">Create your idea</h1>
      <p className="text-muted-foreground mb-8 text-sm">
        Your idea is private until you choose to share it. Fill in as much as you can — you can return and edit at any time.
      </p>

      <div className="space-y-7">

        {/* 1. Title */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-foreground">
              Title <span className="text-muted-foreground font-normal">(required)</span>
            </label>
            <span className="text-xs text-muted-foreground">{title.length} / 200</span>
          </div>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value.slice(0, 200))}
            placeholder="e.g. Mandatory energy efficiency ratings before property sale"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>

        {/* 2. Idea Type */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-3">
            Idea Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIdeaType('LEGISLATION')}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-5 rounded-md border-2 text-sm font-semibold transition-colors ${
                ideaType === 'LEGISLATION'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:border-border/60'
              }`}
            >
              <span className="text-lg">📜</span>
              <span>Change a Law</span>
              <span className={`text-xs font-normal mt-0.5 ${ideaType === 'LEGISLATION' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                LEGISLATION
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIdeaType('ORGANISATION')}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-5 rounded-md border-2 text-sm font-semibold transition-colors ${
                ideaType === 'ORGANISATION'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:border-border/60'
              }`}
            >
              <span className="text-lg">⚙️</span>
              <span>Change How Something Works</span>
              <span className={`text-xs font-normal mt-0.5 ${ideaType === 'ORGANISATION' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                ORGANISATION
              </span>
            </button>
          </div>
        </div>

        {/* 3. Government Area */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Government Area
          </label>
          <select
            value={govtArea}
            onChange={e => setGovtArea(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 appearance-none cursor-pointer"
          >
            <option value="" className="text-muted-foreground">Select a government area...</option>
            {GOVT_AREAS.map(area => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Summary Description */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-foreground">
              Summary Description <span className="text-muted-foreground font-normal">(required)</span>
            </label>
            <span className="text-xs text-muted-foreground">{summaryDescription.length} / 280</span>
          </div>
          <textarea
            value={summaryDescription}
            onChange={e => setSummaryDescription(e.target.value.slice(0, 280))}
            placeholder="Describe your idea in one or two sentences. What would change and for whom?"
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          />
        </div>

        {/* 5. Summary Diagnosis */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Summary Diagnosis
          </label>
          <textarea
            value={summaryDiagnosis}
            onChange={e => setSummaryDiagnosis(e.target.value)}
            placeholder="In one sentence: what is broken or unfair about the current situation?"
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          />
        </div>

        {/* 6. Summary Guiding Policy */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Summary Guiding Policy
          </label>
          <textarea
            value={summaryGuidingPolicy}
            onChange={e => setSummaryGuidingPolicy(e.target.value)}
            placeholder="In one sentence: what is your overall approach to solving this?"
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          />
        </div>

        {/* 7. Summary Coherent Actions */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Summary Coherent Actions
          </label>
          <textarea
            value={summaryCoherentActions}
            onChange={e => setSummaryCoherentActions(e.target.value)}
            placeholder="In one sentence: what are the key steps needed to implement this?"
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          />
        </div>

        {/* 8. Connected Ideas */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Link to a related idea{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={connectedIdeas}
            onChange={e => setConnectedIdeas(e.target.value)}
            placeholder="Search by idea title or paste an idea URL"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 border border-border bg-background text-foreground hover:bg-accent rounded-md text-sm font-medium transition-colors"
          >
            {saved ? 'Saved ✓' : 'Save Draft'}
          </button>
          <Link
            href="/prototype/create/stage2"
            aria-disabled={!isReadyForStage2}
            onClick={e => { if (!isReadyForStage2) e.preventDefault() }}
            className={`flex-1 py-2.5 rounded-md text-sm font-semibold transition-colors text-center ${
              isReadyForStage2
                ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                : 'bg-muted text-muted-foreground cursor-not-allowed pointer-events-none'
            }`}
          >
            Ready for Stage 2 &#8594;
          </Link>
        </div>

        {/* AI guidance notice */}
        <p className="text-xs text-muted-foreground text-center pt-1">
          AI guidance is available in Stage 2 with Lex
        </p>

      </div>
    </main>
  )
}
