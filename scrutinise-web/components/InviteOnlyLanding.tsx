'use client'

import { useState } from 'react'

type InvalidReason = 'expired' | 'used' | 'revoked' | 'not_found'

const HEADLINES: Record<InvalidReason, string> = {
  expired: 'This invite has expired',
  used: 'This invite has already been used',
  revoked: 'This invite is no longer valid',
  not_found: 'Invite not recognised',
}

export function InviteOnlyLanding({ reason }: { reason?: InvalidReason }) {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('sent')
        setForm({ name: '', email: '', message: '' })
      } else {
        setError(data.error ?? 'Something went wrong')
        setStatus('error')
      }
    } catch {
      setError('Network error — please try again')
      setStatus('error')
    }
  }

  const headline = reason ? HEADLINES[reason] : 'Scrutinise is invite only'

  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <h1 className="text-3xl font-semibold mb-6">{headline}</h1>
      <p className="text-lg mb-4">
        We are building a community dedicated to bringing high standards of quality to policy
        development and scrutiny of legislation.
      </p>
      <p className="text-lg mb-12">
        If you think you could add value to our community please send us a message telling us what
        you can bring and what you think makes good quality legislation.
      </p>

      {status === 'sent' ? (
        <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
          Thank you. Your message has been sent.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Your name</label>
            <input
              required
              type="text"
              placeholder="Your name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Your email</label>
            <input
              required
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Your message</label>
            <textarea
              required
              placeholder="Tell us about yourself and what you think makes good quality legislation"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={8}
              maxLength={5000}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {form.message.length}/5000
            </p>
          </div>
          <button
            type="submit"
            disabled={status === 'sending'}
            className="px-6 py-2.5 bg-foreground text-background rounded-md text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {status === 'sending' ? 'Sending…' : 'Send message'}
          </button>
          {status === 'error' && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </form>
      )}
    </div>
  )
}
