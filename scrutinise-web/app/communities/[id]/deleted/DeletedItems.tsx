'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type Item = {
  kind: 'question' | 'answer' | 'post' | 'branch'
  id: string
  preview: string
  deletedAt: string
  deletionReason: string | null
  deletedWithParent: boolean
  author: { id: string; name: string | null; username: string }
  deletedBy: { id: string; name: string | null; username: string } | null
  communityName: string
  parentId: string | null
}

const KIND_LABEL: Record<Item['kind'], string> = {
  question: 'Question',
  answer: 'Answer',
  post: 'Post',
  branch: 'Branch',
}

const who = (u: { name: string | null; username: string } | null) =>
  u ? (u.name ?? u.username) : 'someone whose account has gone'

export default function DeletedItems({
  communityId,
  initial,
}: {
  communityId: string
  initial: Item[]
}) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function restore(item: Item) {
    setBusyId(item.id)
    setError(null)
    setDone(null)
    try {
      // A branch restores through its own route: it is a different object with
      // its own rules (parent must be live, manage rights on the branch).
      const res =
        item.kind === 'branch'
          ? await fetch(`/api/communities/${item.id}/branch`, { method: 'POST' })
          : await fetch(`/api/communities/${communityId}/deleted`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ kind: item.kind, id: item.id }),
            })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : `That did not work (HTTP ${res.status}).`)
        return
      }
      if (item.kind === 'branch') {
        const r = data.result as { questionsRestored: number; postsRestored: number; pointsRestored: number }
        const back = r.questionsRestored + r.postsRestored
        // ⚠ Says what did NOT come back. Omitting it would let the reader assume
        // the branch is exactly as it was, and then wonder where everyone went.
        setDone(
          `${item.preview} is back${back ? `, with ${back} item${back === 1 ? '' : 's'}` : ''}` +
            `${r.pointsRestored ? ` and ${r.pointsRestored} points` : ''}. ` +
            `Its members were not restored — they will need to rejoin.`,
        )
      } else {
        const r = data.result as { restored: { answers: number; replies: number }; pointsRestored: number }
        const alsoBack = r.restored.answers + r.restored.replies
        setDone(
          `Restored${alsoBack ? `, with ${alsoBack} item${alsoBack === 1 ? '' : 's'} that went down with it` : ''}` +
            `${r.pointsRestored ? ` — ${r.pointsRestored} points returned` : ''}.`,
        )
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusyId(null)
    }
  }

  if (items.length === 0) {
    return (
      <p className="central-card mt-5 p-6 text-center text-[13px] text-muted-foreground">
        Nothing has been deleted here.
      </p>
    )
  }

  return (
    <div className="mt-5">
      {error && <p className="mb-2 text-[13px] text-red-600">{error}</p>}
      {done && <p className="mb-2 text-[13px] central-teal-text">{done}</p>}

      <div className="central-card divide-y divide-border">
        {items.map((item) => (
          <div key={`${item.kind}-${item.id}`} className="p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                {KIND_LABEL[item.kind]}
              </span>
              {/* ⚠ A cascaded row is LABELLED and cannot be restored alone.
                  Hiding these would make the counts lie; offering to restore one
                  on its own would put an answer back under a deleted question. */}
              {item.deletedWithParent && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  went with its {item.kind === 'answer' ? 'question' : 'thread'}
                </span>
              )}
              <span className="text-[12px] text-muted-foreground">{item.communityName}</span>
            </div>

            <p className="mt-1.5 text-[14px] leading-snug pretty">{item.preview}</p>

            <p className="mt-1 text-[12px] text-muted-foreground">
              {item.kind === 'branch' ? 'branch of ' + (item.communityName || 'this Community') : `by ${who(item.author)}`} · removed by {who(item.deletedBy)}
              {' · '}
              <span className="tabular">
                {new Date(item.deletedAt).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </span>
            </p>
            {item.deletionReason && (
              <p className="mt-1 text-[12.5px] italic text-muted-foreground pretty">
                “{item.deletionReason}”
              </p>
            )}

            <div className="mt-2">
              {item.deletedWithParent ? (
                <p className="text-[12px] text-muted-foreground">
                  Restore the {item.kind === 'answer' ? 'question' : 'thread'} above and this comes
                  back with it.
                </p>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={busyId === item.id}
                  onClick={() => restore(item)}
                >
                  {busyId === item.id ? 'Restoring…' : 'Restore'}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
