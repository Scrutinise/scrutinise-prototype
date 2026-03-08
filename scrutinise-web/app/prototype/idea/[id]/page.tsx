'use client'

import { use } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { MOCK_IDEAS, Stage } from '@/lib/mockData'
import VoteWidget from '@/components/VoteWidget'

const stageBadgeColors: Record<Stage, string> = {
  Create: 'bg-gray-700 text-gray-300',
  Draft: 'bg-blue-900 text-blue-300',
  Develop: 'bg-amber-900 text-amber-300',
  Campaign: 'bg-purple-900 text-purple-300',
  Parliament: 'bg-green-900 text-green-300',
}

const amendmentStatusColors: Record<string, string> = {
  pending: 'bg-amber-900 text-amber-300',
  accepted: 'bg-green-900 text-green-300',
  rejected: 'bg-red-900 text-red-300',
  consulting: 'bg-blue-900 text-blue-300',
}

const TABS = ['Overview', 'Research', 'Amendments', 'History']

type Props = { params: Promise<{ id: string }> }

export default function IdeaDetailPage({ params }: Props) {
  const { id } = use(params)
  const idea = MOCK_IDEAS.find(i => i.id === id) ?? MOCK_IDEAS[0]
  const [activeTab, setActiveTab] = useState(0)

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-2">
        <Link href="/prototype/browse" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          &#8592; Browse Ideas
        </Link>
      </div>

      <div className="flex items-start gap-3 mb-2 mt-4">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${stageBadgeColors[idea.stage]}`}>
          {idea.stage}
        </span>
        <span className="text-xs text-gray-500 px-2.5 py-1 bg-gray-800 rounded-full">{idea.area}</span>
      </div>

      <h1 className="text-2xl font-bold text-white mb-2 leading-snug">{idea.title}</h1>
      <div className="text-xs text-gray-500 mb-6">
        Created {idea.createdAt} &middot; Credibility score: <span className="text-gray-300">{idea.credibilityScore}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800 mb-8">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === i
                ? 'border-revolutBlue text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 0 && (
        <div className="space-y-6">
          <p className="text-gray-300 leading-relaxed">{idea.summary}</p>

          <VoteWidget currentVotes={idea.voteCount} />

          {idea.coherentActions.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Coherent Actions</h2>
              <div className="space-y-3">
                {idea.coherentActions.map(ca => {
                  const total = ca.voteFor + ca.voteAgainst || 1
                  const forPct = Math.round((ca.voteFor / total) * 100)
                  return (
                    <div key={ca.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                      <p className="text-sm text-gray-200 leading-relaxed mb-3">{ca.text}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 w-8">For</span>
                        <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div className="bg-green-500 h-full rounded-full" style={{ width: `${forPct}%` }} />
                        </div>
                        <span className="text-gray-400">{ca.voteFor} / {ca.voteAgainst}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Research tab */}
      {activeTab === 1 && (
        <div className="space-y-3">
          {['Evidence', 'International Comparisons', 'Cost Estimates'].map(card => (
            <div key={card} className="bg-gray-900 border border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-2">{card}</h3>
              <p className="text-xs text-gray-500 italic">No content yet.</p>
              <div className="mt-3">
                <button
                  className="text-xs text-gray-600 border border-gray-700 px-3 py-1.5 rounded-lg cursor-not-allowed"
                  title="Available at Stage 3+"
                  disabled
                >
                  Add Research (available at Stage 3+)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Amendments tab */}
      {activeTab === 2 && (
        <div>
          {idea.amendments.length === 0 ? (
            <p className="text-gray-500 text-sm">No amendments proposed yet.</p>
          ) : (
            <div className="space-y-3 mb-4">
              {idea.amendments.map(amend => (
                <div key={amend.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{amend.proposedBy}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${amendmentStatusColors[amend.status]}`}>
                      {amend.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{amend.createdAt}</p>
                  <p className="text-xs text-gray-400 line-clamp-2">{amend.proposedWording}</p>
                  <Link
                    href={`/prototype/amendment/${amend.id}`}
                    className="mt-3 inline-block text-xs text-revolutBlue hover:underline"
                  >
                    Review amendment &#8594;
                  </Link>
                </div>
              ))}
            </div>
          )}
          <button className="px-4 py-2 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 rounded-xl text-sm font-medium transition-colors">
            Propose Amendment
          </button>
        </div>
      )}

      {/* History tab */}
      {activeTab === 3 && (
        <div className="space-y-0">
          {[
            { label: 'Idea created', date: idea.createdAt },
            { label: 'Moved to Develop stage', date: '2025-11-20' },
            { label: 'Amendment proposed by Dr James Okafor', date: '2025-12-01' },
          ].map((event, i) => (
            <div key={i} className="flex gap-4 pb-6">
              <div className="flex flex-col items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-revolutBlue flex-shrink-0 mt-1" />
                {i < 2 && <div className="w-px flex-1 bg-gray-700 mt-1" />}
              </div>
              <div>
                <p className="text-sm text-white">{event.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{event.date}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
