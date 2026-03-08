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
        <div className="bg-gray-900 border border-green-800 rounded-xl p-8 text-center">
          <p className="text-green-400 text-lg font-semibold mb-2">Group created</p>
          <p className="text-gray-400 text-sm mb-6">"{name}" has been created. Members will be invited via email.</p>
          <Link
            href="/prototype/groups"
            className="inline-block px-5 py-2.5 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors"
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
        <Link href="/prototype/groups" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          ← Groups
        </Link>
        <h1 className="text-2xl font-bold text-white mt-4">Create a Group</h1>
        <p className="text-sm text-gray-500 mt-1">Groups are for sharing ideas and coordinating with collaborators or supporters.</p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Group name <span className="text-gray-600">*</span></label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Housing Policy Network"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Description <span className="text-gray-700">(optional)</span></label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What is this group for?"
            rows={3}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-2">Group type</label>
          <div className="space-y-2">
            {(['Collaborators', 'Supporters', 'Public'] as GroupType[]).map(type => (
              <label key={type} className="flex items-start gap-3 cursor-pointer p-3 bg-gray-900 border border-gray-700 rounded-xl hover:border-gray-500 transition-colors">
                <input
                  type="radio"
                  checked={groupType === type}
                  onChange={() => setGroupType(type)}
                  className="accent-revolutBlue mt-0.5"
                />
                <div>
                  <p className="text-sm text-white font-medium">{type}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
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
          <label className="block text-xs text-gray-500 mb-1">Invite members by email</label>
          {memberEmails.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {memberEmails.map(email => (
                <span key={email} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 border border-gray-600 rounded-lg text-xs text-gray-300">
                  {email}
                  <button
                    onClick={() => removeEmail(email)}
                    className="text-gray-600 hover:text-red-400 transition-colors"
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
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
            />
            <button
              onClick={addEmail}
              className="px-4 py-2 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 rounded-xl text-sm transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        <button
          onClick={() => { if (name.trim()) setSubmitted(true) }}
          disabled={!name.trim()}
          className="w-full py-3 bg-revolutBlue hover:bg-blue-600 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          Create Group
        </button>
      </div>
    </main>
  )
}
