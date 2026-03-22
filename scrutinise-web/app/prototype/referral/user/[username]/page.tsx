'use client'

import { use } from 'react'
import Link from 'next/link'
import { MOCK_USERS, MOCK_IDEAS, Stage } from '@/lib/mockData'
import React from 'react'

const stageBadgeStyle: Record<Stage, React.CSSProperties> = {
  Create:     { backgroundColor: 'var(--stage-create)',     color: 'white' },
  Draft:      { backgroundColor: 'var(--stage-draft)',      color: 'white' },
  Develop:    { backgroundColor: 'var(--stage-develop)',    color: 'white' },
  Campaign:   { backgroundColor: 'var(--stage-campaign)',   color: 'white' },
  Legislate: { backgroundColor: 'var(--stage-parliament)', color: 'white' },
}

type Props = { params: Promise<{ username: string }> }

export default function ReferralUserPage({ params }: Props) {
  const { username } = use(params)

  // Match by name slug
  const user = MOCK_USERS.find(u =>
    u.name.toLowerCase().replace(/\s+/g, '-') === username
  ) ?? MOCK_USERS[1]

  const userIdeas = MOCK_IDEAS.filter(i => i.ownerId === user.id)

  const initials = user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const roleBadge: Record<string, string> = {
    citizen: 'Citizen',
    mp: 'MP',
    expert: 'Expert',
    moderator: 'Moderator',
    admin: 'Admin',
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* User header */}
        <div className="flex items-center gap-5 mb-8">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-primary-foreground flex-shrink-0">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{user.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground bg-card border border-border px-2 py-0.5 rounded-full">
                {roleBadge[user.role] ?? user.role}
              </span>
              {user.verified && (
                <span className="text-xs text-green-400 bg-green-900/40 px-2 py-0.5 rounded-full">✓ Verified</span>
              )}
              {user.constituency && (
                <span className="text-xs text-muted-foreground">{user.constituency}</span>
              )}
            </div>
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">Credibility Score: </span>
              <span className="text-sm font-semibold text-foreground">{user.credibility.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Their ideas */}
        {userIdeas.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Their ideas</h2>
            <div className="space-y-3">
              {userIdeas.map(idea => {
                const total = idea.voteCount.for + idea.voteCount.against + idea.voteCount.undecided
                return (
                  <Link
                    key={idea.id}
                    href={`/prototype/idea/${idea.id}`}
                    className="block p-4 bg-card border border-border rounded-lg hover:bg-accent transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={stageBadgeStyle[idea.stage]}
                          >
                            {idea.stage}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-foreground">{idea.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{idea.summary}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-foreground">{total.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">votes</div>
                        <div className="text-xs text-muted-foreground mt-1">Passion: {idea.passionScore}</div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* What is Scrutinise? */}
        <div className="mb-8 p-5 bg-card border border-border rounded-lg">
          <h2 className="text-sm font-semibold text-foreground mb-3">What is Scrutinise?</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Scrutinise is a not-for-profit platform where citizens, experts, and MPs develop policy ideas into Parliament-ready legislation.
            Every idea goes through five stages — <span className="text-foreground">Create, Draft, Develop, Campaign, Legislate</span> — with Lex AI guidance
            and community scrutiny at each step.
          </p>
        </div>

        {/* Login/signup prompt */}
        <div className="p-5 bg-blue-950/30 border border-blue-800 rounded-lg text-center">
          <p className="text-sm font-semibold text-foreground mb-2">Join Scrutinise to vote, comment, and shape legislation</p>
          <p className="text-xs text-muted-foreground mb-4">Free to join. Your vote shapes real policy.</p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/sign-up"
              className="px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-semibold transition-colors"
            >
              Sign up free →
            </Link>
            <Link
              href="/sign-in"
              className="px-4 py-2.5 border border-border bg-background text-foreground hover:bg-accent rounded-md text-sm font-medium transition-colors"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
