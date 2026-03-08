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
        <Link href="/prototype/groups" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          ← Groups
        </Link>
        <div className="flex items-start justify-between gap-3 mt-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-white">{group.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadgeColors[group.type] ?? 'bg-gray-700 text-gray-300'}`}>
                {group.type}
              </span>
            </div>
            <p className="text-sm text-gray-500">{group.memberCount} members</p>
          </div>
        </div>
        <p className="text-sm text-gray-400 mt-3 leading-relaxed">{group.description}</p>
      </div>

      {/* Invite link */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6">
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Invite link</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs text-gray-400 bg-gray-800 rounded-lg px-3 py-2 truncate">
            {inviteLink}
          </code>
          <button
            onClick={copyInviteLink}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors flex-shrink-0 ${
              copied
                ? 'bg-green-900 border-green-700 text-green-300'
                : 'border-gray-600 text-gray-400 hover:text-white hover:border-gray-400'
            }`}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Member list */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Members</h2>
        <div className="space-y-2">
          {group.members.map(member => (
            <div key={member.id} className="flex items-center justify-between p-3 bg-gray-900 border border-gray-700 rounded-xl">
              <div>
                <p className="text-sm font-medium text-white">{member.name}</p>
                <p className="text-xs text-gray-500">{member.role} · Joined {member.joinedAt}</p>
              </div>
              {isOwner && member.id !== 'u1' && (
                <button className="text-xs text-red-600 hover:text-red-400 border border-red-900 hover:border-red-700 px-2.5 py-1 rounded-lg transition-colors">
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add members */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Add members</h2>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="name@example.com"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
          />
          <button className="px-4 py-2 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors">
            Invite
          </button>
        </div>
      </div>

      {/* Settings accordion (owner only) */}
      {isOwner && (
        <div className="border-t border-gray-800 pt-6">
          <button
            onClick={() => setSettingsOpen(v => !v)}
            className="flex items-center justify-between w-full text-sm font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-300 transition-colors"
          >
            <span>Group settings</span>
            <span>{settingsOpen ? '↑' : '↓'}</span>
          </button>

          {settingsOpen && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Group name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-revolutBlue transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea
                  value={groupDescription}
                  onChange={e => setGroupDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-revolutBlue transition-colors resize-none"
                />
              </div>
              <button className="px-4 py-2 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors">
                Save changes
              </button>
              <div className="pt-4 border-t border-gray-800">
                <button className="px-4 py-2.5 border border-red-800 text-red-400 hover:border-red-600 hover:text-red-300 rounded-xl text-sm font-medium transition-colors">
                  Delete group
                </button>
                <p className="text-xs text-gray-600 mt-2">Permanently deletes this group and removes all members. Cannot be undone.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
