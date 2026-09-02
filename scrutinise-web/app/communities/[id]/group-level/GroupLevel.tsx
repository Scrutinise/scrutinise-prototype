'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
// ⚠⚠ `@/lib/group-view-types`, NOT `@/lib/group-view`. This import used to name
// the latter, which imports `lib/prisma.ts` — and a VALUE import pulls the whole
// module graph into the browser bundle, so the Postgres driver came with it and
// every Vercel build died on dns/fs/net/tls. The query was already on the server
// and the props were already plain; the EDGE was this line.
// `npm run check:client-boundary` fails if it ever comes back.
import {
  GROUP_SORTS,
  GROUP_SORT_LABEL,
  sortGroupMembers,
  type GroupLevelView,
  type GroupSort,
} from '@/lib/group-view-types'
import { TIER_DESCRIPTION, TIER_LABEL, type MembershipTier } from '@/lib/membership-tier'

/**
 * CENTRAL 25-C §1h/§1i — EVERYONE AT GROUP LEVEL, AND THE BRANCHES WITH NOBODY
 * RUNNING THEM.
 *
 * ⚠⚠ THIS IS THE PART CHARLIE'S MODEL DEPENDS ON. He has chosen monitoring over
 * gates: a group member who manages no branch breaks no rule, so no gate can
 * catch it, and the only thing that can is a list somebody actually opens. That
 * sets the bar — the anomaly has to be visible WITHOUT HUNTING, which is why it
 * is the default sort, a count at the top, and a marked row, rather than
 * something a reader works out by scanning a column for blanks.
 *
 * ⚠ THE SORT IS `sortGroupMembers` FROM lib/group-view-types.ts, IMPORTED. The
 * check imports the same function from the same module and asserts on the same
 * ordering; a copy here would pass a check that still held the old rule
 * (docs/CLAUDE.md §26.5).
 *
 * ⚠ NO STATE IS CARRIED BY COLOUR. Charlie is colour blind: the anomaly is
 * marked by a WORD ("manages no branch") and a filled badge, never by hue.
 */
export default function GroupLevel({
  view,
  myUserId,
}: {
  view: GroupLevelView
  myUserId: string
}) {
  const router = useRouter()
  const [sort, setSort] = useState<GroupSort>('anomaly')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tierFor, setTierFor] = useState<{ userId: string; to: MembershipTier } | null>(null)
  const [reason, setReason] = useState('')

  const rows = useMemo(() => sortGroupMembers(view.members, sort), [view.members, sort])

  async function changeTier(userId: string, to: MembershipTier) {
    if (!reason.trim()) {
      setError('Say why — a change with no recorded reason later reads as a bug.')
      return
    }
    setBusy(userId)
    setError(null)
    try {
      const res = await fetch(`/api/communities/${view.rootId}/members/${userId}/tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: to, reason: reason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'That did not work.')
        return
      }
      setTierFor(null)
      setReason('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs text-muted-foreground">
          <Link href={`/communities/${view.rootId}?tab=teams`} className="hover:underline">
            ← {view.rootName}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Group level</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Everyone who holds a membership of {view.rootName} itself — who invited them, when they
          arrived, and which branches they manage.
        </p>
      </div>

      {/* ── §1h — the anomaly, stated as a sentence before any table ───────── */}
      <div className="central-card p-4">
        <p className="text-sm">
          <span className="font-semibold tabular">{view.groupMembersManagingNoBranch}</span>{' '}
          {view.groupMembersManagingNoBranch === 1 ? 'group member manages' : 'group members manage'}{' '}
          no branch.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          A group member was invited at top level, which is what founding a branch is for. Somebody
          here who manages none may simply be new — or may be somebody who should have been invited
          into a branch instead. Nothing stops them; this is the list that shows them.
        </p>
      </div>

      {/* ── §1i — vacant branches, in the same view, as an action item ─────── */}
      <div className="central-card p-4">
        <h2 className="text-sm font-semibold">
          Branches with no manager
          {view.vacantBranches.length > 0 && (
            <span className="tabular ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {view.vacantBranches.length}
            </span>
          )}
        </h2>
        {view.vacantBranches.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Every branch has a manager.
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              A vacant branch is not an orphan — you still manage it, decide its join requests and
              can delete it. It simply has no chair, which real branches sometimes do not.
            </p>
            <ul className="mt-2 space-y-1.5">
              {view.vacantBranches.map((b) => (
                <li
                  key={b.id}
                  className="central-inset flex flex-wrap items-center justify-between gap-2 bg-background px-2 py-1.5"
                >
                  <span className="text-sm">
                    {b.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {b.memberCount} member{b.memberCount !== 1 ? 's' : ''}
                    </span>
                    {b.pendingNomineeName && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {b.pendingNomineeName} nominated — waiting on you
                      </span>
                    )}
                  </span>
                  <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                    <Link href={`/communities/${b.id}?panel=members`}>Appoint a manager</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* ── §1h — the list itself ──────────────────────────────────────────── */}
      <div className="central-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            Members of {view.rootName}
            <span className="tabular ml-2 text-xs font-normal text-muted-foreground">
              {view.members.length}
            </span>
          </h2>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as GroupSort)}
              className="rounded-lg border bg-background px-2 py-1 text-xs"
            >
              {GROUP_SORTS.map((s) => (
                <option key={s} value={s}>
                  {GROUP_SORT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-1.5 pr-3 font-medium">Member</th>
                <th className="py-1.5 pr-3 font-medium">Membership</th>
                <th className="py-1.5 pr-3 font-medium">Invited by</th>
                <th className="py-1.5 pr-3 font-medium">Joined</th>
                <th className="py-1.5 pr-3 font-medium">Manages</th>
                <th className="py-1.5 font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const anomaly = m.tier === 'GROUP' && !m.managesAnyBranch && m.role === 'MEMBER'
                return (
                  <tr key={m.userId} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3">
                      <span className="block font-medium">
                        {m.name}
                        {m.userId === myUserId && (
                          <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground">@{m.username}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          m.tier === 'GROUP'
                            ? 'bg-slate-800 text-white'
                            : 'border border-slate-400 bg-transparent text-slate-700'
                        }`}
                        title={TIER_DESCRIPTION[m.tier]}
                      >
                        {TIER_LABEL[m.tier]}
                      </span>
                      {m.role !== 'MEMBER' && (
                        <span className="ml-1 text-xs text-muted-foreground">{m.role}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {m.invitedByName ?? (
                        <span className="text-muted-foreground">
                          Not recorded — joined before we kept this
                        </span>
                      )}
                      {m.invitedViaNodeName && (
                        <span className="block text-muted-foreground">
                          via an invitation to {m.invitedViaNodeName}
                        </span>
                      )}
                      {m.acceptedOnBehalf && (
                        <span className="block text-muted-foreground">
                          accepted on their behalf — they never clicked
                        </span>
                      )}
                    </td>
                    <td className="tabular py-2 pr-3 text-xs">
                      {m.joinedAt.slice(0, 10)}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {/* ⚠ §1h's anomaly, SAID rather than left as an empty cell. */}
                      {m.managesAnyBranch ? (
                        m.managesBranches.map((b) => (
                          <Link
                            key={b.id}
                            href={`/communities/${b.id}`}
                            className="block hover:underline"
                          >
                            {b.name}
                          </Link>
                        ))
                      ) : anomaly ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
                          manages no branch
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {m.memberOfBranchCount > 0 && (
                        <span className="mt-0.5 block text-muted-foreground">
                          in {m.memberOfBranchCount} branch
                          {m.memberOfBranchCount !== 1 ? 'es' : ''}
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      {m.role === 'OWNER' ? (
                        <span className="text-xs text-muted-foreground">
                          The Community owner’s membership cannot be changed
                        </span>
                      ) : tierFor?.userId === m.userId ? (
                        <div className="space-y-1.5">
                          <Input
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Say why — required"
                            className="h-7 w-52 text-xs"
                            maxLength={500}
                            autoFocus
                          />
                          {tierFor.to === 'BRANCH' && m.managesAnyBranch && (
                            <p className="max-w-[16rem] text-xs text-amber-800">
                              ⚠ This also stands them down from{' '}
                              {m.managesBranches.map((b) => b.name).join(', ')}. Those branches keep
                              their members and become vacant.
                            </p>
                          )}
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={busy === m.userId}
                              onClick={() => changeTier(m.userId, tierFor.to)}
                            >
                              {busy === m.userId ? 'Saving…' : `Make ${TIER_LABEL[tierFor.to]}`}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                setTierFor(null)
                                setReason('')
                                setError(null)
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setError(null)
                            setReason('')
                            setTierFor({
                              userId: m.userId,
                              to: m.tier === 'GROUP' ? 'BRANCH' : 'GROUP',
                            })
                          }}
                        >
                          Make {TIER_LABEL[m.tier === 'GROUP' ? 'BRANCH' : 'GROUP'].toLowerCase()}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
