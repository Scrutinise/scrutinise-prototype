'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { MOCK_USERS, MOCK_IDEAS, Stage } from '@/lib/mockData'

const stageBadgeStyle: Record<Stage, React.CSSProperties> = {
  Create:     { backgroundColor: 'var(--stage-create)',     color: 'white' },
  Draft:      { backgroundColor: 'var(--stage-draft)',      color: 'white' },
  Develop:    { backgroundColor: 'var(--stage-develop)',    color: 'white' },
  Campaign:   { backgroundColor: 'var(--stage-campaign)',   color: 'white' },
  Legislate: { backgroundColor: 'var(--stage-parliament)', color: 'white' },
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
        <Link href="/prototype/browse" className="text-xs text-primary hover:underline transition-colors">
          &#8592; Back to ideas
        </Link>
      </div>

      {/* Profile header */}
      <div className="bg-card border border-border rounded-lg p-8 mb-8">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-3xl font-bold flex-shrink-0">
            {user.name.split(' ').map(n => n[0]).join('')}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
              {user.role === 'mp' && (
                <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 rounded-full text-xs font-medium">
                  ✓ MP
                </span>
              )}
              {user.verified && user.role === 'expert' && (
                <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                  ✓ Expert
                </span>
              )}
            </div>

            <div className="text-sm text-muted-foreground mb-4">
              @{username}
              {user.constituency && (
                <span className="ml-3 text-muted-foreground">• {user.constituency}</span>
              )}
            </div>

            {/* Bio placeholder */}
            <p className="text-sm text-foreground leading-relaxed mb-6">
              {user.role === 'mp'
                ? 'Member of Parliament working to improve policy through evidence-based legislation and community engagement.'
                : user.role === 'expert'
                ? 'Policy expert specializing in evidence-based research and legislative drafting.'
                : 'Engaged citizen contributing to better policy through scrutiny and collaboration.'}
            </p>

            {/* Follow button */}
            <button
              onClick={() => setIsFollowing(!isFollowing)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                isFollowing
                  ? 'border border-border bg-background text-foreground hover:bg-accent'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>
        </div>
      </div>

      {/* Credibility Score */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Credibility Score
          </h2>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-bold text-foreground">{user.credibility.toLocaleString()}</span>
            <span className="text-muted-foreground text-sm">pts</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${Math.min((user.credibility / 2000) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Phase 1: Raw score display</p>
        </div>

        {/* Points breakdown */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
            Points Breakdown
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">Strategist</span>
              <span className="text-foreground font-mono">{points.strategist}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">Thinker</span>
              <span className="text-foreground font-mono">{points.thinker}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">Rallymaster</span>
              <span className="text-foreground font-mono">{points.rallymaster}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">Teambuilder</span>
              <span className="text-foreground font-mono">{points.teambuilder}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expert Badges */}
      {expertBadges.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Expert Areas
          </h2>
          <div className="flex flex-wrap gap-2">
            {expertBadges.map(badge => (
              <span
                key={badge}
                className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-medium"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Their Ideas */}
      <div className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Ideas ({userIdeas.length})
        </h2>
        {userIdeas.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-muted-foreground text-sm">This user hasn't created any ideas yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userIdeas.map(idea => {
              const total = idea.voteCount.for + idea.voteCount.against + idea.voteCount.undecided
              return (
                <Link
                  key={idea.id}
                  href={`/prototype/idea/${idea.id}`}
                  className="block bg-card border border-border rounded-lg p-5 hover:border-border/60 hover:bg-accent/50 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={stageBadgeStyle[idea.stage]}
                    >
                      {idea.stage}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">P{idea.passionScore}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-2 leading-snug group-hover:text-primary transition-colors line-clamp-2">
                    {idea.title}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="bg-muted px-2 py-0.5 rounded-full">{idea.area}</span>
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
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Recent Contributions
        </h2>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="space-y-4">
            {/* Mock comment contribution */}
            <div className="pb-4 border-b border-border last:border-0 last:pb-0">
              <div className="flex items-start gap-3 mb-2">
                <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 rounded-full text-xs font-medium">
                  Comment
                </span>
                <span className="text-xs text-muted-foreground">on "Mandatory Energy Efficiency Ratings"</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed line-clamp-2">
                "This is badly needed. My landlord has been putting off upgrades for years..."
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>3 positive ratings</span>
                <span>•</span>
                <span>2025-11-20</span>
              </div>
            </div>

            {/* Mock amendment contribution */}
            {user.role === 'expert' && (
              <div className="pb-4 border-b border-border last:border-0 last:pb-0">
                <div className="flex items-start gap-3 mb-2">
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-full text-xs font-medium">
                    Amendment
                  </span>
                  <span className="text-xs text-muted-foreground">on "Mandatory Energy Efficiency Ratings"</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed line-clamp-2">
                  Proposed exemption for listed buildings and conservation areas
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="text-amber-500">Pending review</span>
                  <span>•</span>
                  <span>2025-12-01</span>
                </div>
              </div>
            )}

            {/* Fallback for users with no contributions */}
            {userIdeas.length === 0 && user.role === 'citizen' && (
              <p className="text-muted-foreground text-sm text-center py-4">
                No recent contributions yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
