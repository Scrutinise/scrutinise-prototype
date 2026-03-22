'use client'

import Link from 'next/link'
import { MOCK_IDEAS, MOCK_NOTIFICATIONS, Stage } from '@/lib/mockData'
import { useUser } from '@/context/UserContext'
import AIFuelGauge from '@/components/AIFuelGauge'

import React from 'react'

const stageBadgeStyle: Record<Stage, React.CSSProperties> = {
  Create:     { backgroundColor: 'var(--stage-create)',     color: 'white' },
  Draft:      { backgroundColor: 'var(--stage-draft)',      color: 'white' },
  Develop:    { backgroundColor: 'var(--stage-develop)',    color: 'white' },
  Campaign:   { backgroundColor: 'var(--stage-campaign)',   color: 'white' },
  Legislate: { backgroundColor: 'var(--stage-parliament)', color: 'white' },
}

export default function DashboardPage() {
  const { currentUser } = useUser()
  const myIdeas = MOCK_IDEAS.filter(i => i.ownerId === currentUser.id)

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground mb-1">Welcome back, {currentUser.name.split(' ')[0]}</h1>
          <p className="text-muted-foreground text-sm">Here's what's happening with your ideas.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/prototype/notifications" className="text-xs text-muted-foreground hover:text-foreground transition-colors border border-border bg-background rounded-md px-3 py-1.5">
            Notifications
          </Link>
          <Link href="/prototype/groups" className="text-xs text-muted-foreground hover:text-foreground transition-colors border border-border bg-background rounded-md px-3 py-1.5">
            Groups
          </Link>
          <Link href="/prototype/settings" className="text-xs text-muted-foreground hover:text-foreground transition-colors border border-border bg-background rounded-md px-3 py-1.5">
            Settings
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Credibility</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{currentUser.credibility.toLocaleString()}</span>
            <span className="text-muted-foreground text-sm">pts</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">AI Fuel</div>
          <AIFuelGauge remaining={currentUser.aiFuelRemaining} total={currentUser.aiFuelTotal} />
        </div>
      </div>

      {/* Notifications */}
      <div className="mb-10">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Notifications</h2>
        <div className="space-y-2">
          {MOCK_NOTIFICATIONS.map(notif => (
            <div
              key={notif.id}
              className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                !notif.read
                  ? 'bg-blue-950/30 border-blue-800'
                  : 'bg-card border-border'
              }`}
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!notif.read ? 'bg-blue-400' : 'bg-muted-foreground'}`} />
              <div className="flex-1">
                <p className="text-sm text-foreground">{notif.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{notif.createdAt}</p>
              </div>
              {'amendmentId' in notif && (
                <Link
                  href={`/prototype/amendment/${notif.amendmentId}`}
                  className="text-xs text-primary hover:underline flex-shrink-0 mt-0.5"
                >
                  Review &#8594;
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* My Ideas */}
      <div>
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Your Ideas</h2>
        {myIdeas.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <p className="text-muted-foreground text-sm mb-4">You haven't created any ideas yet.</p>
            <Link
              href="/prototype/create/stage1"
              className="inline-block px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors"
            >
              Create your first idea &#8594;
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {myIdeas.map(idea => {
              const total = idea.voteCount.for + idea.voteCount.against + idea.voteCount.undecided
              return (
                <Link
                  key={idea.id}
                  href={`/prototype/idea/${idea.id}`}
                  className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-border hover:bg-accent transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={stageBadgeStyle[idea.stage]}
                      >
                        {idea.stage}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{idea.title}</p>
                  </div>
                  <div className="text-xs text-muted-foreground ml-4 flex-shrink-0">{total.toLocaleString()} votes</div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
