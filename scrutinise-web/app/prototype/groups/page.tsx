'use client'

import Link from 'next/link'
import { MOCK_GROUPS } from '@/lib/mockData'

const typeBadgeColors: Record<string, string> = {
  Collaborators: 'bg-blue-900 text-blue-300',
  Supporters: 'bg-purple-900 text-purple-300',
  Public: 'bg-green-900 text-green-300',
}

export default function GroupsPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-6">
        <Link href="/prototype/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Dashboard
        </Link>
        <div className="flex items-center justify-between mt-4">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">My Groups</h1>
          <Link
            href="/prototype/groups/create"
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-semibold transition-colors"
          >
            Create Group
          </Link>
        </div>
      </div>

      {MOCK_GROUPS.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground text-sm mb-4">You're not a member of any groups yet.</p>
          <Link
            href="/prototype/groups/create"
            className="inline-block px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium transition-colors"
          >
            Create your first group →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {MOCK_GROUPS.map(group => (
            <div key={group.id} className="bg-card border border-border rounded-lg p-5 hover:border-border/80 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h2 className="text-base font-semibold text-foreground">{group.name}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadgeColors[group.type] ?? 'bg-muted text-muted-foreground'}`}>
                      {group.type}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      group.myRole === 'Owner' ? 'bg-amber-900 text-amber-300' : 'bg-muted text-muted-foreground'
                    }`}>
                      {group.myRole}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">{group.description}</p>
                  <p className="text-xs text-muted-foreground">{group.memberCount} members</p>
                </div>
                <Link
                  href={`/prototype/groups/${group.id}`}
                  className="px-4 py-2 border border-border bg-background text-foreground hover:bg-accent rounded-md text-sm font-medium transition-colors flex-shrink-0"
                >
                  {group.myRole === 'Owner' ? 'Manage →' : 'View →'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
