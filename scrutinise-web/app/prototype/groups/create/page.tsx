'use client'

import { useState } from 'react'
import Link from 'next/link'

type GroupType = 'Collaborators' | 'Supporters' | 'Public'

export default function CreateGroupPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [groupType, setGroupType] = useState<GroupType>('Public')
  const [emailInput, setEmailInput] = useState('')
  const [memberEmails, setMemberEmails] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)

  const addEmail = () => {
    const trimmed = emailInput.trim()
    if (trimmed && !memberEmails.includes(trimmed)) {
      setMemberEmails(prev => [...prev, trimmed])
      setEmailInput('')
    }
  }

  const removeEmail = (email: string) => {
    setMemberEmails(prev => prev.filter(e => e !== email))
  }

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addEmail()
    }
  }

  if (submitted) {
    return (
      <main className="max-w-xl mx-auto px-6 py-10">
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-green-500 text-lg font-semibold mb-2">Group created</p>
          <p className="text-muted-foreground text-sm mb-6">"{name}" has been created. Members will be invited via email.</p>
          <Link
            href="/prototype/groups"
            className="inline-block px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-semibold transition-colors"
          >
            View my groups →
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/prototype/groups" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Groups
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-foreground mt-4">Create a Group</h1>
        <p className="text-sm text-muted-foreground mt-1">Groups are for sharing ideas and coordinating with collaborators or supporters.</p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Group name <span className="text-muted-foreground/60">*</span></label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Housing Policy Network"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Description <span className="text-muted-foreground/40">(optional)</span></label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What is this group for?"
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Group type</label>
          <div className="space-y-2">
            {(['Collaborators', 'Supporters', 'Public'] as GroupType[]).map(type => (
              <label key={type} className="flex items-start gap-3 cursor-pointer p-3 bg-card border border-border rounded-lg hover:bg-accent transition-colors">
                <input
                  type="radio"
                  checked={groupType === type}
                  onChange={() => setGroupType(type)}
                  className="accent-primary mt-0.5"
                />
                <div>
                  <p className="text-sm text-foreground font-medium">{type}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {type === 'Collaborators' && 'Private group for co-authoring ideas. Members can edit and contribute.'}
                    {type === 'Supporters' && 'Semi-private group for supporters. Members can vote and comment.'}
                    {type === 'Public' && 'Open group. Anyone can join and participate.'}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Invite members by email</label>
          {memberEmails.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {memberEmails.map(email => (
                <span key={email} className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border rounded-md text-xs text-foreground">
                  {email}
                  <button
                    onClick={() => removeEmail(email)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={handleEmailKeyDown}
              placeholder="name@example.com — press Enter to add"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
            <button
              onClick={addEmail}
              className="px-4 py-2 border border-border bg-background text-foreground hover:bg-accent rounded-md text-sm transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        <button
          onClick={() => { if (name.trim()) setSubmitted(true) }}
          disabled={!name.trim()}
          className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground rounded-md text-sm font-semibold transition-colors"
        >
          Create Group
        </button>
      </div>
    </main>
  )
}
