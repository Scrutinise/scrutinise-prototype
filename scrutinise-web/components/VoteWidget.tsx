'use client'

import { useState } from 'react'

interface VoteWidgetProps {
  currentVotes: { for: number; against: number; undecided: number }
}

const strengthLabels: Record<number, string> = {
  0:   'No strong view',
  0.5: 'Very slight view',
  1:   'Slight view',
  1.5: 'Mild view',
  2:   'Moderate view',
  2.5: 'Moderately strong',
  3:   'Quite strongly',
  3.5: 'Strong view',
  4:   'Strongly',
  4.5: 'Very strongly',
  5:   'Extremely strongly',
}

function VoteBars({ votes, strength }: { votes: { for: number; against: number; undecided: number }; strength: number }) {
  const total = votes.for + votes.against + votes.undecided || 1
  const forPct = Math.round((votes.for / total) * 100)
  const againstPct = Math.round((votes.against / total) * 100)
  const pScoreFor = Math.round((votes.for * strength) / total * 100)
  const pScoreAgainst = Math.round((votes.against * strength) / total * 100)

  return (
    <div className="space-y-2 pt-3 border-t border-gray-700">
      <div className="flex items-center gap-2 text-xs">
        <span className="w-14 text-right text-gray-400">For</span>
        <div className="flex-1 bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div className="bg-green-500 h-full rounded-full transition-all duration-500" style={{ width: `${forPct}%` }} />
        </div>
        <span className="text-gray-300 w-8 text-right">{votes.for}</span>
        <span className="text-green-400 font-mono text-[10px] w-8">P{pScoreFor}</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="w-14 text-right text-gray-400">Against</span>
        <div className="flex-1 bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div className="bg-red-500 h-full rounded-full transition-all duration-500" style={{ width: `${againstPct}%` }} />
        </div>
        <span className="text-gray-300 w-8 text-right">{votes.against}</span>
        <span className="text-red-400 font-mono text-[10px] w-8">P{pScoreAgainst}</span>
      </div>
    </div>
  )
}

export default function VoteWidget({ currentVotes }: VoteWidgetProps) {
  const [selected, setSelected] = useState<'for' | 'against' | 'undecided' | null>(null)
  const [strength, setStrength] = useState(3.0)
  const [confirmed, setConfirmed] = useState(false)
  const [votes, setVotes] = useState(currentVotes)

  const handleVote = () => {
    if (!selected) return
    setVotes(prev => ({ ...prev, [selected]: prev[selected] + 1 }))
    setConfirmed(true)
  }

  if (confirmed) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
        <div className="text-center">
          <div className="text-green-400 font-semibold mb-1">Vote recorded &#10003;</div>
          <div className="text-sm text-gray-400">
            Voted <strong className="text-white capitalize">{selected}</strong> — strength {strength.toFixed(1)}/5 ({strengthLabels[strength]})
          </div>
        </div>
        <VoteBars votes={votes} strength={strength} />
      </div>
    )
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-4">
      <div className="flex gap-2">
        {(['for', 'against', 'undecided'] as const).map(option => (
          <button
            key={option}
            onClick={() => setSelected(option)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-all border-2 ${
              selected === option
                ? option === 'for'
                  ? 'bg-green-700 border-green-500 text-white'
                  : option === 'against'
                  ? 'bg-red-800 border-red-600 text-white'
                  : 'bg-gray-600 border-gray-400 text-white'
                : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            {option === 'for' ? 'For' : option === 'against' ? 'Against' : 'Undecided'}
          </button>
        ))}
      </div>

      {selected && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Strength: {strength.toFixed(1)}/5</span>
            <span className="text-white font-medium">{strengthLabels[strength]}</span>
          </div>
          <input
            type="range"
            min={0}
            max={5}
            step={0.5}
            value={strength}
            onChange={e => setStrength(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <button
            onClick={handleVote}
            className="w-full py-2.5 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors mt-1"
          >
            Submit Vote
          </button>
        </div>
      )}

      <VoteBars votes={votes} strength={strength} />
    </div>
  )
}
