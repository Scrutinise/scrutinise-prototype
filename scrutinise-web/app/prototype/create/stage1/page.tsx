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
                  ? 'bg-revolutBlue text-white'
                  : 'text-gray-600'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  i === 0 ? 'bg-white' : 'bg-gray-700'
                }`}
              />
              {stage}
            </div>
            {i < STAGES.length - 1 && (
              <div className="w-6 h-px bg-gray-700" />
            )}
          </div>
        ))}
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">Create your idea</h1>
      <p className="text-gray-400 mb-8 text-sm">
        Your idea is private until you choose to share it. Fill in as much as you can — you can return and edit at any time.
      </p>

      <div className="space-y-7">

        {/* 1. Title */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">
              Title <span className="text-gray-600 font-normal">(required)</span>
            </label>
            <span className="text-xs text-gray-600">{title.length} / 200</span>
          </div>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value.slice(0, 200))}
            placeholder="e.g. Mandatory energy efficiency ratings before property sale"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
          />
        </div>

        {/* 2. Idea Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Idea Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIdeaType('LEGISLATION')}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                ideaType === 'LEGISLATION'
                  ? 'bg-revolutBlue text-white border-revolutBlue'
                  : 'bg-gray-900 text-gray-300 border-gray-700 hover:border-gray-500'
              }`}
            >
              <span className="text-lg">📜</span>
              <span>Change a Law</span>
              <span className={`text-xs font-normal mt-0.5 ${ideaType === 'LEGISLATION' ? 'text-blue-200' : 'text-gray-500'}`}>
                LEGISLATION
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIdeaType('ORGANISATION')}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                ideaType === 'ORGANISATION'
                  ? 'bg-revolutBlue text-white border-revolutBlue'
                  : 'bg-gray-900 text-gray-300 border-gray-700 hover:border-gray-500'
              }`}
            >
              <span className="text-lg">⚙️</span>
              <span>Change How Something Works</span>
              <span className={`text-xs font-normal mt-0.5 ${ideaType === 'ORGANISATION' ? 'text-blue-200' : 'text-gray-500'}`}>
                ORGANISATION
              </span>
            </button>
          </div>
        </div>

        {/* 3. Government Area */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Government Area
          </label>
          <select
            value={govtArea}
            onChange={e => setGovtArea(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-revolutBlue transition-colors appearance-none cursor-pointer text-white"
          >
            <option value="" className="text-gray-600">Select a government area...</option>
            {GOVT_AREAS.map(area => (
              <option key={area} value={area} className="text-white bg-gray-900">
                {area}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Summary Description */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">
              Summary Description <span className="text-gray-600 font-normal">(required)</span>
            </label>
            <span className="text-xs text-gray-600">{summaryDescription.length} / 280</span>
          </div>
          <textarea
            value={summaryDescription}
            onChange={e => setSummaryDescription(e.target.value.slice(0, 280))}
            placeholder="Describe your idea in one or two sentences. What would change and for whom?"
            rows={3}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors resize-none"
          />
        </div>

        {/* 5. Summary Diagnosis */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Summary Diagnosis
          </label>
          <textarea
            value={summaryDiagnosis}
            onChange={e => setSummaryDiagnosis(e.target.value)}
            placeholder="In one sentence: what is broken or unfair about the current situation?"
            rows={2}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors resize-none"
          />
        </div>

        {/* 6. Summary Guiding Policy */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Summary Guiding Policy
          </label>
          <textarea
            value={summaryGuidingPolicy}
            onChange={e => setSummaryGuidingPolicy(e.target.value)}
            placeholder="In one sentence: what is your overall approach to solving this?"
            rows={2}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors resize-none"
          />
        </div>

        {/* 7. Summary Coherent Actions */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Summary Coherent Actions
          </label>
          <textarea
            value={summaryCoherentActions}
            onChange={e => setSummaryCoherentActions(e.target.value)}
            placeholder="In one sentence: what are the key steps needed to implement this?"
            rows={2}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors resize-none"
          />
        </div>

        {/* 8. Connected Ideas */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Link to a related idea{' '}
            <span className="text-gray-600 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={connectedIdeas}
            onChange={e => setConnectedIdeas(e.target.value)}
            placeholder="Search by idea title or paste an idea URL"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 rounded-xl text-sm font-medium transition-colors"
          >
            {saved ? 'Saved ✓' : 'Save Draft'}
          </button>
          <Link
            href="/prototype/create/stage2"
            aria-disabled={!isReadyForStage2}
            onClick={e => { if (!isReadyForStage2) e.preventDefault() }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors text-center ${
              isReadyForStage2
                ? 'bg-revolutBlue hover:bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed pointer-events-none'
            }`}
          >
            Ready for Stage 2 &#8594;
          </Link>
        </div>

        {/* AI guidance notice */}
        <p className="text-xs text-gray-600 text-center pt-1">
          AI guidance is available in Stage 2 with Lex
        </p>

      </div>
    </main>
  )
}
