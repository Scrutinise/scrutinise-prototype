'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { MOCK_GROUPS } from '@/lib/mockData'

type Props = { params: Promise<{ id: string }> }

export default function GroupDetailPage({ params }: Props) {
  const { id } = use(params)
  const group = MOCK_GROUPS.find(g => g.id === id) ?? MOCK_GROUPS[0]
  const isOwner = group.myRole === 'Owner'

  const [copied, setCopied] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [groupName, setGroupName] = useState(group.name)
  const [groupDescription, setGroupDescription] = useState(group.description)

  const inviteLink = `https://scrutinise.co.uk/join/${group.id}-demo`

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const typeBadgeColors: Record<string, string> = {
    Collaborators: 'bg-blue-900 text-blue-300',
    Supporters: 'bg-purple-900 text-purple-300',
    Public: 'bg-green-900 text-green-300',
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-6">
        <Link href="/prototype/groups" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Groups
        </Link>
        <div className="flex items-start justify-between gap-3 mt-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{group.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadgeColors[group.type] ?? 'bg-muted text-muted-foreground'}`}>
                {group.type}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{group.memberCount} members</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{group.description}</p>
      </div>

      {/* Invite link */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Invite link</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs text-muted-foreground bg-background border border-border rounded-md px-3 py-2 truncate">
            {inviteLink}
          </code>
          <button
            onClick={copyInviteLink}
            className={`px-3 py-2 rounded-md text-xs font-medium border transition-colors flex-shrink-0 ${
              copied
                ? 'bg-green-900 border-green-700 text-green-300'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Member list */}
      <div className="mb-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Members</h2>
        <div className="space-y-2">
          {group.members.map(member => (
            <div key={member.id} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
              <div>
                <p className="text-sm font-medium text-foreground">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.role} · Joined {member.joinedAt}</p>
              </div>
              {isOwner && member.id !== 'u1' && (
                <button className="text-xs text-destructive hover:text-destructive/80 border border-destructive/40 hover:border-destructive/60 px-2.5 py-1 rounded-md transition-colors">
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add members */}
      <div className="mb-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Add members</h2>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="name@example.com"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
          <button className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-semibold transition-colors">
            Invite
          </button>
        </div>
      </div>

      {/* Settings accordion (owner only) */}
      {isOwner && (
        <div className="border-t border-border pt-6">
          <button
            onClick={() => setSettingsOpen(v => !v)}
            className="flex items-center justify-between w-full text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Group settings</span>
            <span>{settingsOpen ? '↑' : '↓'}</span>
          </button>

          {settingsOpen && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Group name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Description</label>
                <textarea
                  value={groupDescription}
                  onChange={e => setGroupDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
                />
              </div>
              <button className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-semibold transition-colors">
                Save changes
              </button>
              <div className="pt-4 border-t border-border">
                <button className="px-4 py-2.5 border border-destructive/50 text-destructive hover:border-destructive hover:text-destructive rounded-md text-sm font-medium transition-colors">
                  Delete group
                </button>
                <p className="text-xs text-muted-foreground mt-2">Permanently deletes this group and removes all members. Cannot be undone.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
