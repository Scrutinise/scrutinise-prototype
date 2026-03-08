'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STAGES = ['Create', 'Draft', 'Develop', 'Campaign', 'Parliament']

export default function Stage1Page() {
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      {/* Stage indicator */}
      <div className="flex items-center gap-0 mb-10">
        {STAGES.map((stage, i) => (
          <div key={stage} className="flex items-center">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              i === 0
                ? 'bg-gray-700 text-white'
                : 'text-gray-600'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-white' : 'bg-gray-700'}`} />
              {stage}
            </div>
            {i < STAGES.length - 1 && (
              <div className="w-6 h-px bg-gray-700" />
            )}
          </div>
        ))}
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">What's your idea?</h1>
      <p className="text-gray-400 mb-8 text-sm">Your idea is private until you choose to share it.</p>

      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">Idea title</label>
            <span className="text-xs text-gray-600">{title.length}/100</span>
          </div>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value.slice(0, 100))}
            placeholder="e.g. Mandatory energy efficiency ratings before property sale"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">Summary</label>
            <span className="text-xs text-gray-600">{summary.length}/500</span>
          </div>
          <textarea
            value={summary}
            onChange={e => setSummary(e.target.value.slice(0, 500))}
            placeholder="Briefly describe your idea and the problem it solves..."
            rows={5}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="px-5 py-2.5 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 rounded-xl text-sm font-medium transition-colors"
          >
            {saved ? 'Saved ✓' : 'Save Draft'}
          </button>
          <button
            onClick={() => router.push('/prototype/create/stage2')}
            disabled={!title.trim() || !summary.trim()}
            className="flex-1 py-2.5 bg-revolutBlue hover:bg-blue-600 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Continue to develop with Lex &#8594;
          </button>
        </div>
      </div>
    </main>
  )
}
