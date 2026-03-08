'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { MOCK_USERS, MOCK_IDEAS, Stage } from '@/lib/mockData'

const stageBadgeColors: Record<Stage, string> = {
  Create: 'bg-gray-700 text-gray-300',
  Draft: 'bg-blue-900 text-blue-300',
  Develop: 'bg-amber-900 text-amber-300',
  Campaign: 'bg-purple-900 text-purple-300',
  Parliament: 'bg-green-900 text-green-300',
}

type Props = { params: Promise<{ username: string }> }

export default function UserProfilePage({ params }: Props) {
  const { username } = use(params)
  const [isFollowing, setIsFollowing] = useState(false)

  // Find user by converting name to username format (lowercase, replace spaces with -)
  const user = MOCK_USERS.find(u =>
    u.name.toLowerCase().replace(/\s+/g, '-') === username.toLowerCase()
  ) ?? MOCK_USERS[0]

  // Get user's ideas
  const userIdeas = MOCK_IDEAS.filter(idea => idea.ownerId === user.id)

  // Mock points breakdown (Strategist, Thinker, Rallymaster, Teambuilder)
  const points = {
    strategist: Math.floor(user.credibility * 0.4),
    thinker: Math.floor(user.credibility * 0.3),
    rallymaster: Math.floor(user.credibility * 0.2),
    teambuilder: Math.floor(user.credibility * 0.1),
  }

  // Mock expert badges (top 3 subject areas)
  const expertBadges = user.role === 'expert' || user.role === 'mp'
    ? ['Housing & Energy', 'Digital Policy', 'Employment Law']
    : []

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      {/* Back link */}
      <div className="mb-6">
        <Link href="/prototype/browse" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          &#8592; Back to ideas
        </Link>
      </div>

      {/* Profile header */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 mb-8">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-full bg-revolutBlue flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
            {user.name.split(' ').map(n => n[0]).join('')}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white">{user.name}</h1>
              {user.role === 'mp' && (
                <span className="px-2 py-1 bg-green-900 text-green-300 rounded-full text-xs font-medium">
                  ✓ MP
                </span>
              )}
              {user.verified && user.role === 'expert' && (
                <span className="px-2 py-1 bg-blue-900 text-blue-300 rounded-full text-xs font-medium">
                  ✓ Expert
                </span>
              )}
            </div>

            <div className="text-sm text-gray-400 mb-4">
              @{username}
              {user.constituency && (
                <span className="ml-3 text-gray-500">• {user.constituency}</span>
              )}
            </div>

            {/* Bio placeholder */}
            <p className="text-sm text-gray-300 leading-relaxed mb-6">
              {user.role === 'mp'
                ? 'Member of Parliament working to improve policy through evidence-based legislation and community engagement.'
                : user.role === 'expert'
                ? 'Policy expert specializing in evidence-based research and legislative drafting.'
                : 'Engaged citizen contributing to better policy through scrutiny and collaboration.'}
            </p>

            {/* Follow button */}
            <button
              onClick={() => setIsFollowing(!isFollowing)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors ${
                isFollowing
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-revolutBlue text-white hover:bg-blue-600'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>
        </div>
      </div>

      {/* Credibility Score */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Credibility Score
          </h2>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-bold text-white">{user.credibility.toLocaleString()}</span>
            <span className="text-gray-500 text-sm">pts</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-revolutBlue h-full rounded-full transition-all"
              style={{ width: `${Math.min((user.credibility / 2000) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">Phase 1: Raw score display</p>
        </div>

        {/* Points breakdown */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Points Breakdown
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Strategist</span>
              <span className="text-white font-mono">{points.strategist}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Thinker</span>
              <span className="text-white font-mono">{points.thinker}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Rallymaster</span>
              <span className="text-white font-mono">{points.rallymaster}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Teambuilder</span>
              <span className="text-white font-mono">{points.teambuilder}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expert Badges */}
      {expertBadges.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Expert Areas
          </h2>
          <div className="flex flex-wrap gap-2">
            {expertBadges.map(badge => (
              <span
                key={badge}
                className="px-3 py-1.5 bg-blue-900 text-blue-300 rounded-full text-xs font-medium"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Their Ideas */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Ideas ({userIdeas.length})
        </h2>
        {userIdeas.length === 0 ? (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm">This user hasn't created any ideas yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userIdeas.map(idea => {
              const total = idea.voteCount.for + idea.voteCount.against + idea.voteCount.undecided
              return (
                <Link
                  key={idea.id}
                  href={`/prototype/idea/${idea.id}`}
                  className="block bg-gray-900 border border-gray-700 rounded-xl p-5 hover:border-gray-500 hover:bg-gray-800 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageBadgeColors[idea.stage]}`}>
                      {idea.stage}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">P{idea.passionScore}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-2 leading-snug group-hover:text-blue-300 transition-colors line-clamp-2">
                    {idea.title}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="bg-gray-800 px-2 py-0.5 rounded-full">{idea.area}</span>
                    <span>{total.toLocaleString()} votes</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Their Contributions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Recent Contributions
        </h2>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <div className="space-y-4">
            {/* Mock comment contribution */}
            <div className="pb-4 border-b border-gray-800 last:border-0 last:pb-0">
              <div className="flex items-start gap-3 mb-2">
                <span className="px-2 py-0.5 bg-green-900 text-green-300 rounded-full text-xs font-medium">
                  Comment
                </span>
                <span className="text-xs text-gray-500">on "Mandatory Energy Efficiency Ratings"</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed line-clamp-2">
                "This is badly needed. My landlord has been putting off upgrades for years..."
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span>3 positive ratings</span>
                <span>•</span>
                <span>2025-11-20</span>
              </div>
            </div>

            {/* Mock amendment contribution */}
            {user.role === 'expert' && (
              <div className="pb-4 border-b border-gray-800 last:border-0 last:pb-0">
                <div className="flex items-start gap-3 mb-2">
                  <span className="px-2 py-0.5 bg-amber-900 text-amber-300 rounded-full text-xs font-medium">
                    Amendment
                  </span>
                  <span className="text-xs text-gray-500">on "Mandatory Energy Efficiency Ratings"</span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed line-clamp-2">
                  Proposed exemption for listed buildings and conservation areas
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span className="text-amber-400">Pending review</span>
                  <span>•</span>
                  <span>2025-12-01</span>
                </div>
              </div>
            )}

            {/* Fallback for users with no contributions */}
            {userIdeas.length === 0 && user.role === 'citizen' && (
              <p className="text-gray-500 text-sm text-center py-4">
                No recent contributions yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
