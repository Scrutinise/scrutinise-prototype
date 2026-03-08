'use client'

import { use } from 'react'
import Link from 'next/link'
import { MOCK_IDEAS, MOCK_USERS, Stage } from '@/lib/mockData'
import VoteWidget from '@/components/VoteWidget'

const stageBadgeColors: Record<Stage, string> = {
  Create: 'bg-gray-700 text-gray-300',
  Draft: 'bg-blue-900 text-blue-300',
  Develop: 'bg-amber-900 text-amber-300',
  Campaign: 'bg-purple-900 text-purple-300',
  Parliament: 'bg-green-900 text-green-300',
}

type Props = { params: Promise<{ id: string }> }

export default function ReferralIdeaPage({ params }: Props) {
  const { id } = use(params)
  const idea = MOCK_IDEAS.find(i => i.id === id) ?? MOCK_IDEAS[0]
  const owner = MOCK_USERS.find(u => u.id === idea.ownerId)

  const totalVotes = idea.voteCount.for + idea.voteCount.against + idea.voteCount.undecided

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Shared attribution */}
        <div className="mb-6 p-3 bg-blue-950/40 border border-blue-800 rounded-xl text-sm text-blue-300 text-center">
          Shared by <span className="font-semibold">{owner?.name}</span> via Scrutinise
        </div>

        {/* Idea header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${stageBadgeColors[idea.stage]}`}>
              {idea.stage}
            </span>
            <span className="text-xs text-gray-500 px-2.5 py-1 bg-gray-800 rounded-full">{idea.area}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3 leading-snug">{idea.title}</h1>
          <p className="text-gray-300 leading-relaxed">{idea.summary}</p>
        </div>

        {/* Vote summary */}
        <div className="flex items-center gap-6 p-4 bg-gray-900 border border-gray-700 rounded-xl mb-6">
          <div className="text-center">
            <div className="text-xl font-bold text-green-400">{idea.voteCount.for.toLocaleString()}</div>
            <div className="text-xs text-gray-500">FOR</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-red-400">{idea.voteCount.against.toLocaleString()}</div>
            <div className="text-xs text-gray-500">AGAINST</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-400">{idea.voteCount.undecided.toLocaleString()}</div>
            <div className="text-xs text-gray-500">UNDECIDED</div>
          </div>
          <div className="flex-1 border-l border-gray-700 pl-4">
            <div className="text-xs text-gray-500">Passion score</div>
            <div className="text-xl font-bold text-white">{idea.passionScore} <span className="text-sm text-gray-500">/ 5</span></div>
          </div>
        </div>

        {/* Vote widget */}
        <div className="mb-8">
          <VoteWidget currentVotes={idea.voteCount} />
        </div>

        {/* Diagnosis */}
        {idea.diagnosis && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">The Problem</h2>
            <p className="text-sm text-gray-300 leading-relaxed">{idea.diagnosis}</p>
          </div>
        )}

        {/* Guiding policy */}
        {idea.guidingPolicy && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">The Approach</h2>
            <p className="text-sm text-gray-300 leading-relaxed">{idea.guidingPolicy}</p>
          </div>
        )}

        {/* Coherent actions */}
        {idea.coherentActions.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">What this proposes</h2>
            <div className="space-y-2">
              {idea.coherentActions.map((ca, i) => (
                <div key={ca.id} className="flex items-start gap-3 p-3 bg-gray-900 border border-gray-700 rounded-xl">
                  <span className="text-xs text-gray-600 font-mono mt-0.5">{i + 1}.</span>
                  <div>
                    <p className="text-sm font-medium text-white">{ca.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{ca.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Endorsements */}
        {idea.endorsements.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Parliamentary Endorsements</h2>
            <div className="space-y-3">
              {idea.endorsements.map(end => (
                <div key={end.id} className="p-3 bg-gray-900 border border-gray-700 rounded-xl">
                  <p className="text-sm font-medium text-white">{end.name}</p>
                  <p className="text-xs text-gray-500">{end.role} · {end.constituency}</p>
                  {end.publicStatement && (
                    <p className="text-xs text-gray-400 mt-2 italic">"{end.publicStatement}"</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What is Scrutinise? */}
        <div className="mb-8 p-5 bg-gray-900 border border-gray-700 rounded-xl">
          <h2 className="text-sm font-semibold text-white mb-3">What is Scrutinise?</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Scrutinise is a not-for-profit platform where citizens, experts, and MPs develop policy ideas into Parliament-ready legislation.
            Every idea goes through five stages — <span className="text-white">Create, Draft, Develop, Campaign, Parliament</span> — with Lex AI guidance
            and community scrutiny at each step.
          </p>
        </div>

        {/* Login/signup prompt */}
        <div className="p-5 bg-blue-950/30 border border-blue-800 rounded-xl text-center">
          <p className="text-sm font-semibold text-white mb-2">Join Scrutinise to vote, comment, and shape legislation</p>
          <p className="text-xs text-gray-400 mb-4">
            Free to join. No spam. Your vote is anonymous.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/sign-up"
              className="px-5 py-2.5 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Sign up free →
            </Link>
            <Link
              href="/sign-in"
              className="px-4 py-2.5 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 rounded-xl text-sm font-medium transition-colors"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
