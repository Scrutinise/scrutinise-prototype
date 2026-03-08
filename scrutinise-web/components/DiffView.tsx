'use client'

import { useState } from 'react'

interface DiffViewProps {
  current: string
  proposed: string
}

function wordDiff(current: string, proposed: string) {
  const currentWords = current.split(/(\s+)/)
  const proposedWords = proposed.split(/(\s+)/)
  const currentSet = new Set(currentWords.filter(w => w.trim()))
  const proposedSet = new Set(proposedWords.filter(w => w.trim()))

  const currentResult = currentWords.map(word => ({
    word,
    type: (word.trim() && !proposedSet.has(word) ? 'removed' : 'same') as 'removed' | 'same',
  }))

  const proposedResult = proposedWords.map(word => ({
    word,
    type: (word.trim() && !currentSet.has(word) ? 'added' : 'same') as 'added' | 'same',
  }))

  return { currentResult, proposedResult }
}

const actionMessages: Record<string, string> = {
  Accept: 'Amendment accepted — voters will be notified.',
  'Consult First': 'Consultation requested — the proposer will be contacted.',
  'Request Revision': 'Revision requested — the proposer has been notified.',
  Reject: 'Amendment rejected.',
}

export default function DiffView({ current, proposed }: DiffViewProps) {
  const [confirmed, setConfirmed] = useState<string | null>(null)
  const { currentResult, proposedResult } = wordDiff(current, proposed)

  if (confirmed) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-8 text-center">
        <div className="text-green-400 text-2xl mb-3">&#10003;</div>
        <p className="text-white font-medium">{actionMessages[confirmed]}</p>
        <button
          onClick={() => setConfirmed(null)}
          className="mt-4 text-xs text-gray-500 underline hover:text-gray-300"
        >
          Undo
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Current Wording</div>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm leading-relaxed text-gray-200">
            {currentResult.map((item, i) =>
              item.type === 'removed' ? (
                <span key={i} className="bg-red-900/60 text-red-300 line-through">{item.word}</span>
              ) : (
                <span key={i}>{item.word}</span>
              )
            )}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Proposed Wording</div>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm leading-relaxed text-gray-200">
            {proposedResult.map((item, i) =>
              item.type === 'added' ? (
                <span key={i} className="bg-green-900/60 text-green-300 font-medium">{item.word}</span>
              ) : (
                <span key={i}>{item.word}</span>
              )
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={() => setConfirmed('Accept')} className="flex-1 py-2.5 rounded-lg bg-green-700 hover:bg-green-600 text-white text-sm font-medium transition-colors">
          Accept
        </button>
        <button onClick={() => setConfirmed('Consult First')} className="flex-1 py-2.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium transition-colors">
          Consult First
        </button>
        <button onClick={() => setConfirmed('Request Revision')} className="flex-1 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium transition-colors">
          Request Revision
        </button>
        <button onClick={() => setConfirmed('Reject')} className="flex-1 py-2.5 rounded-lg bg-red-800 hover:bg-red-700 text-white text-sm font-medium transition-colors">
          Reject
        </button>
      </div>
    </div>
  )
}
