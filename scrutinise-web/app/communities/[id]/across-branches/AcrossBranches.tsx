'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface Branch {
  communityId: string
  name: string
  memberCount: number
  questionCount: number
  answerCount: number
  votingMemberCount: number
  topVoted: { id: string; text: string; votes: number } | null
  rising: { id: string; text: string; recentVotes: number } | null
  quiet: boolean
}

export default function AcrossBranches({
  communityId,
  communityName,
  period,
  branches,
  totals,
}: {
  communityId: string
  communityName: string
  period: string
  branches: Branch[]
  totals: { branchesActive: number; questionsLive: number; answersPosted: number; membersVoting: number }
}) {
  const router = useRouter()
  const [composing, setComposing] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ recipients: number; emailed: number; emailFailures: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function broadcast(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/communities/${communityId}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(typeof d.error === 'string' ? d.error : 'Could not send that.')
      return
    }
    setResult(d)
    setComposing(false)
    setSubject('')
    setMessage('')
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        <Link href={`/communities/${communityId}`} className="hover:underline">← {communityName}</Link>
      </p>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em]">Across branches</h1>
          <p className="mt-1 max-w-[520px] text-[13px] text-muted-foreground pretty">
            What each branch is valuing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            defaultValue={period}
            onChange={(e) => router.push(`/communities/${communityId}/across-branches?period=${e.target.value}`)}
            aria-label="Period"
            className="h-9 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="quarter">This quarter</option>
          </select>
          <Button className="h-9 rounded-lg" onClick={() => setComposing((v) => !v)}>
            Message all branch managers
          </Button>
        </div>
      </div>

      {result && (
        <div className="central-card mb-4 p-3">
          <p className="tabular text-[13px]">
            Sent to {result.recipients} branch manager{result.recipients === 1 ? '' : 's'} —{' '}
            {result.recipients} notified, {result.emailed} emailed.
          </p>
          {/* Reported, never assumed: a mail failure must not read as delivery. */}
          {result.emailFailures.length > 0 && (
            <p className="mt-1 text-xs text-amber-700 pretty">
              Email did not reach: {result.emailFailures.join(' · ')}. They still have the notification.
            </p>
          )}
        </div>
      )}
      {error && <p className="mb-4 text-xs text-red-600">{error}</p>}

      {composing && (
        <form onSubmit={broadcast} className="central-card mb-5 p-4">
          <h2 className="mb-2 text-[13px] font-semibold">Message all branch managers</h2>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="mb-2 h-9 rounded-lg"
            maxLength={150}
            required
          />
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What do they need to know?"
            rows={4}
            required
          />
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" type="submit" className="rounded-lg" disabled={busy || !subject.trim() || !message.trim()}>
              {busy ? 'Sending…' : 'Send'}
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setComposing(false)}>Cancel</Button>
            <span className="text-xs text-muted-foreground">Goes to their Feed and their email.</span>
          </div>
        </form>
      )}

      {/* Participation figures. */}
      <div className="mb-5 grid grid-cols-2 gap-4 border-y border-border py-4 sm:grid-cols-4">
        {[
          ['Branches active', totals.branchesActive],
          ['Questions live', totals.questionsLive],
          ['Answers posted', totals.answersPosted],
          ['Members voting', totals.membersVoting],
        ].map(([label, value]) => (
          <div key={label as string}>
            <p className="tabular text-2xl font-semibold">{value as number}</p>
            <p className="text-xs text-muted-foreground">{label as string}</p>
          </div>
        ))}
      </div>

      {branches.length === 0 ? (
        <div className="central-card p-8 text-center">
          <p className="text-[13px] text-muted-foreground">This Community has no branches yet.</p>
        </div>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {branches.map((b) => (
            <div key={b.communityId} className="central-card p-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/communities/${b.communityId}`} className="text-sm font-semibold hover:underline">
                  {b.name}
                </Link>
                {/* Neutral, deliberately — not red, not an alarm. */}
                {b.quiet && (
                  <span className="shrink-0 rounded-full bg-[var(--central-chip-fill)] px-2 py-0.5 text-[11px] text-muted-foreground">
                    Quiet {period === 'week' ? 'week' : period === 'month' ? 'month' : 'quarter'}
                  </span>
                )}
              </div>
              <p className="tabular mt-1 text-xs text-muted-foreground">
                {b.memberCount} members · {b.questionCount} questions · {b.answerCount} answers ·{' '}
                {b.votingMemberCount} voting
              </p>

              {b.topVoted && (
                <div className="mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                    Top voted
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug pretty">{b.topVoted.text}</p>
                  <p className="tabular text-[11px] text-muted-foreground">{b.topVoted.votes} votes</p>
                </div>
              )}

              {b.rising && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="central-teal-text text-[10px] font-semibold uppercase tracking-[0.07em]">Rising</p>
                  <p className="mt-0.5 text-[13px] leading-snug pretty">{b.rising.text}</p>
                  <p className="tabular text-[11px] text-muted-foreground">
                    {b.rising.recentVotes} votes in the last week
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* This constraint survives into the implementation, not just the design. */}
      <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground pretty">
        Counts are participation only. No per-member activity is shown here, favourites are never
        counted anywhere, and nothing on this page is visible outside the admin group.
      </p>
    </div>
  )
}
