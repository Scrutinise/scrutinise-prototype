'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const ACTIVITIES = [
  { key: 'CANVASSING_SESSION', label: 'Canvassing session', points: 24 },
  { key: 'RAN_EVENT', label: 'Organised & ran an event', points: 60 },
  { key: 'GAVE_TRAINING', label: 'Gave a training session', points: 40 },
  { key: 'COMPLETED_TRAINING', label: 'Completed training as a trainee', points: 20 },
] as const

/**
 * Log offline activity for approval. Self-claims only — the API takes the
 * claimant from the session, never from this form.
 *
 * The point values shown are the current tariff's starter values, labelled as
 * indicative: the award is priced when a manager approves, so a retune between
 * logging and approval pays the new rate.
 */
export default function LogActivity({ communityId, communityName }: { communityId: string; communityName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [activityType, setActivityType] = useState<string>(ACTIVITIES[0].key)
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/communities/${communityId}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityType,
          occurredAt: new Date(`${occurredAt}T12:00:00`).toISOString(),
          evidenceUrl: evidenceUrl.trim() || undefined,
          note: note.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not log that.')
        return
      }
      setSent(true)
      setOpen(false)
      setNote('')
      setEvidenceUrl('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium">Log offline activity</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Canvassing, events and training you did for {communityName}. An admin approves it, and every
        decision appears in the activity log.
      </p>

      {sent && !open && (
        <p className="mt-2 text-xs text-emerald-700">
          Logged — it is waiting for an admin. You will hear back in your Feed.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {open ? (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            aria-label="Activity"
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            {ACTIVITIES.map((a) => (
              <option key={a.key} value={a.key}>{a.label} · ~{a.points} pts</option>
            ))}
          </select>
          <div>
            <label htmlFor="occurred" className="mb-1 block text-xs text-muted-foreground">When</label>
            <Input
              id="occurred"
              type="date"
              value={occurredAt}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="h-9"
              required
            />
          </div>
          <Input
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="Link to evidence (optional)"
            className="h-9"
            type="url"
          />
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything the approver should know (optional)"
            rows={2}
          />
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send for approval'}
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="outline" className="mt-3" onClick={() => { setOpen(true); setSent(false) }}>
          Log an activity
        </Button>
      )}
    </div>
  )
}
