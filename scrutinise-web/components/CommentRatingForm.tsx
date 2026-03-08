'use client'

import { useState } from 'react'

interface CommentRatingFormProps {
  commentId: string
  onClose: () => void
}

const POSITIVE_FLAGS = [
  { key: 'constructive', label: 'Constructive' },
  { key: 'insightful', label: 'Insightful' },
  { key: 'relevant', label: 'Relevant' },
  { key: 'fresh_perspective', label: 'Fresh perspective' },
  { key: 'balanced', label: 'Balanced' },
  { key: 'helpful_facts', label: 'Helpful facts' },
  { key: 'direct_experience', label: 'Direct experience' },
  { key: 'good_question', label: 'Good question' },
]

const NEGATIVE_FLAGS = [
  { key: 'ad_hominem', label: 'Ad hominem' },
  { key: 'straw_man', label: 'Straw man' },
  { key: 'red_herring', label: 'Red herring' },
  { key: 'false_dilemma', label: 'False dilemma' },
  { key: 'slippery_slope', label: 'Slippery slope' },
  { key: 'moving_goalposts', label: 'Moving goalposts' },
  { key: 'motte_bailey', label: 'Motte-bailey' },
  { key: 'tu_quoque', label: 'Tu quoque' },
  { key: 'cherry_picking', label: 'Cherry picking' },
  { key: 'not_relevant', label: 'Not relevant' },
]

export default function CommentRatingForm({ commentId, onClose }: CommentRatingFormProps) {
  const [positiveFlags, setPositiveFlags] = useState<string[]>([])
  const [negativeFlags, setNegativeFlags] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const toggleFlag = (key: string, type: 'positive' | 'negative') => {
    if (type === 'positive') {
      setPositiveFlags(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key])
    } else {
      setNegativeFlags(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key])
    }
  }

  if (submitted) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mt-2">
        <p className="text-green-400 text-sm font-medium">✓ Rating submitted</p>
        <button onClick={onClose} className="text-xs text-gray-500 mt-1 hover:text-gray-300">Close</button>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mt-2 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">Rate this comment</h4>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xs">✕ Close</button>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Positive qualities</p>
        <div className="flex flex-wrap gap-2">
          {POSITIVE_FLAGS.map(flag => (
            <button
              key={flag.key}
              onClick={() => toggleFlag(flag.key, 'positive')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                positiveFlags.includes(flag.key)
                  ? 'bg-green-800 border-green-600 text-green-200'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {flag.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Logical issues</p>
        <div className="flex flex-wrap gap-2">
          {NEGATIVE_FLAGS.map(flag => (
            <button
              key={flag.key}
              onClick={() => toggleFlag(flag.key, 'negative')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                negativeFlags.includes(flag.key)
                  ? 'bg-red-900 border-red-700 text-red-200'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {flag.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Note (optional)</p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="What specifically prompted this rating?"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-revolutBlue resize-none"
          rows={2}
        />
      </div>

      <button
        onClick={() => setSubmitted(true)}
        disabled={positiveFlags.length === 0 && negativeFlags.length === 0}
        className="w-full py-2 bg-revolutBlue hover:bg-blue-600 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
      >
        Submit Rating
      </button>
    </div>
  )
}
