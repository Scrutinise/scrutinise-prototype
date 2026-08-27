'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type Preview = {
  branchId: string
  branchName: string
  blockingChildren: string[]
  isRoot: boolean
  memberCount: number
  questionCount: number
  postCount: number
  pointsAtRisk: number
}

/**
 * CENTRAL item 11 — the delete-branch control and its confirmation.
 *
 * ⚠ THE DIALOG READS THE SERVER'S COUNTS, IT DOES NOT COUNT FOR ITSELF. A
 * confirmation that says "3 members and 12 items" while the delete touches
 * something else is worse than no confirmation, because people trust it.
 *
 * ⚠ AND IT SAYS THE ASYMMETRY OUT LOUD. Restoring brings back the branch and its
 * content but NOT its memberships — people rejoin. That is the one thing about
 * this feature nobody would guess, so it is in the dialog rather than in a help
 * page nobody opens.
 */
export default function DeleteBranch({
  communityId,
  branchName,
  rootId,
}: {
  communityId: string
  branchName: string
  rootId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let live = true
    fetch(`/api/communities/${communityId}/branch`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d?.preview) setPreview(d.preview) })
      .catch(() => {})
    return () => { live = false }
  }, [open, communityId])

  async function confirm() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/communities/${communityId}/branch`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : `That did not work (HTTP ${res.status}).`)
      setBusy(false)
      return
    }
    router.push(`/communities/${rootId}?tab=teams`)
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="text-xs text-muted-foreground hover:text-red-700"
        onClick={() => setOpen(true)}
      >
        Close this branch
      </Button>
    )
  }

  const blocked = (preview?.blockingChildren.length ?? 0) > 0 || preview?.isRoot

  return (
    <div className="central-card space-y-3 border-red-200 p-4">
      <h3 className="text-[15px] font-semibold">Close {branchName}?</h3>

      {!preview ? (
        <p className="text-[13px] text-muted-foreground">Checking what this would affect…</p>
      ) : preview.isRoot ? (
        <p className="text-[13px] text-red-700 pretty">
          This is the Community itself, not a branch. It cannot be closed.
        </p>
      ) : preview.blockingChildren.length > 0 ? (
        <p className="text-[13px] text-red-700 pretty">
          {branchName} has {preview.blockingChildren.length} branch
          {preview.blockingChildren.length === 1 ? '' : 'es'} inside it —{' '}
          <strong>{preview.blockingChildren.join(', ')}</strong>. Close those first. Branches come
          down from the bottom up, so that nobody removes more than they meant to in one press.
        </p>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-[13px] leading-relaxed">
            <p className="font-medium">What this does:</p>
            <ul className="mt-1 space-y-0.5">
              <li>
                <span className="tabular font-semibold">{preview.memberCount}</span> member
                {preview.memberCount === 1 ? '' : 's'} leave this branch —{' '}
                <strong>they stay in the Community</strong> and can join another branch.
              </li>
              <li>
                <span className="tabular font-semibold">{preview.questionCount}</span> branch question
                {preview.questionCount === 1 ? '' : 's'} and{' '}
                <span className="tabular font-semibold">{preview.postCount}</span> branch post
                {preview.postCount === 1 ? '' : 's'} are removed with it.
              </li>
              <li>
                <span className="tabular font-semibold">{preview.pointsAtRisk}</span> point
                {preview.pointsAtRisk === 1 ? '' : 's'} earned on that content come back off their
                authors&rsquo; totals.
              </li>
              <li>Anything posted to the whole Community stays — it was never the branch&rsquo;s.</li>
            </ul>
          </div>

          {/* ⚠ The asymmetry, stated where the decision is made. */}
          <p className="rounded-lg border border-[oklch(0.9_0.03_85)] bg-[oklch(0.985_0.02_85)] p-3 text-[12.5px] leading-relaxed">
            You can put this back. Restoring returns the branch, its content and those points —{' '}
            <strong>but not the memberships</strong>. People rejoin.
          </p>

          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is it closing? (shown to its members)"
            maxLength={1000}
            className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-[13px]"
          />
        </>
      )}

      {error && <p className="text-[13px] text-red-600">{error}</p>}

      <div className="flex gap-2">
        {!blocked && preview && (
          <Button
            size="sm"
            variant="outline"
            className="border-red-200 text-red-700 hover:bg-red-50"
            disabled={busy}
            onClick={confirm}
          >
            {busy ? 'Closing…' : `Close ${branchName}`}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setError(null) }}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
