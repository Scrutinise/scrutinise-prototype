'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface Individual {
  userId: string
  name: string | null
  username: string
  points: number
}
interface Branch {
  communityId: string
  name: string
  points: number
  memberCount: number
  averagePoints: number
}

const WINDOWS = [
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'all', label: 'All time' },
] as const

/** Signed, always — a negative score is shown as a negative score. */
function Score({ points }: { points: number }) {
  return (
    <span
      className={`tabular-nums text-sm font-semibold ${
        points < 0 ? 'text-red-600' : points > 0 ? 'text-emerald-700' : 'text-muted-foreground'
      }`}
    >
      {points > 0 ? '+' : ''}
      {points}
    </span>
  )
}

/**
 * Per-Community leaderboards, replacing the Stage 1 stub.
 *
 * The window is a VIEWER control, not an admin setting — anyone can switch it,
 * and it costs nothing because the event ledger makes a window a filter rather
 * than a stored aggregate. No cross-Community or global boards exist.
 */
export default function Leaderboards({
  communityId,
  rootName,
}: {
  communityId: string
  rootName: string
}) {
  const [tab, setTab] = useState<'individuals' | 'branches'>('individuals')
  const [window, setWindow] = useState<'month' | 'quarter' | 'all'>('all')
  const [sort, setSort] = useState<'total' | 'average'>('total')
  const [individuals, setIndividuals] = useState<Individual[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [myPoints, setMyPoints] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/communities/${communityId}/leaderboard?window=${window}&sort=${sort}`)
    if (res.ok) {
      const data = await res.json()
      setIndividuals(data.individuals)
      setBranches(data.branches)
      setMyPoints(data.myPoints)
    }
    setLoading(false)
  }, [communityId, window, sort])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-md border border-border p-0.5">
          {(['individuals', 'branches'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-2 py-1 text-xs font-medium capitalize transition-colors ${
                tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          You: <Score points={myPoints} />
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={window}
          onChange={(e) => setWindow(e.target.value as typeof window)}
          aria-label="Leaderboard period"
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          {WINDOWS.map((w) => (
            <option key={w.key} value={w.key}>{w.label}</option>
          ))}
        </select>
        {tab === 'branches' && (
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Rank branches by"
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="total">By total</option>
            <option value="average">By per-member average</option>
          </select>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : tab === 'individuals' ? (
        individuals.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nobody has earned points in {rootName} in this period yet.
          </p>
        ) : (
          <ol className="space-y-1">
            {individuals.map((i, idx) => (
              <li key={i.userId} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  <span className="mr-2 text-xs tabular-nums text-muted-foreground">{idx + 1}</span>
                  {i.name ?? i.username}
                </span>
                <Score points={i.points} />
              </li>
            ))}
          </ol>
        )
      ) : branches.length === 0 ? (
        <p className="text-xs text-muted-foreground">This Community has no branches yet.</p>
      ) : (
        <ol className="space-y-1">
          {branches.map((b, idx) => (
            <li key={b.communityId} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="mr-2 text-xs tabular-nums text-muted-foreground">{idx + 1}</span>
                <Link href={`/communities/${b.communityId}`} className="hover:underline">
                  {b.name}
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">
                  {b.memberCount} member{b.memberCount !== 1 ? 's' : ''}
                </span>
              </span>
              <span className="shrink-0">
                <Score points={sort === 'average' ? b.averagePoints : b.points} />
                <span className="ml-1 text-xs text-muted-foreground">
                  {sort === 'average' ? 'avg' : 'total'}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
        Central points are separate from your Scrutinise credibility score and are never added to it.
      </p>
    </div>
  )
}
