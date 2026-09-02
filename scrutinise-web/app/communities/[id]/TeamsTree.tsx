'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CommunityTreeNode } from '@/lib/community'
import { tierMayFoundBranch, type MembershipTier } from '@/lib/membership-tier'

interface Props {
  communityId: string
  tree: CommunityTreeNode
  /** True when the board being viewed is itself a branch, not the Community root. */
  rootIsBranch: boolean
  /** True when the viewer is a member of the Community root — i.e. may request branches. */
  isCommunityMember: boolean
  /**
   * CENTRAL 25-C §1g — the viewer's tier on the ROOT membership.
   * ⚠ The predicate is `tierMayFoundBranch`, imported, not `myTier === 'GROUP'`
   * restated here: the API decides with the same function, and a control that
   * decides with a copy of the rule is a control that stops matching the API the
   * first time the rule changes.
   */
  myTier: MembershipTier | null
}

/**
 * One node of the Teams & branches tree.
 *
 * Stage 1.1 gave it real nesting and labelled admin buttons. Stage 1.2 adds the
 * membership affordances: every branch you are not in offers "Request to join",
 * every branch you are in (and do not own) offers "Leave", and a node you
 * manage shows how many people are waiting on it.
 */
function TreeNode({
  node,
  isRoot,
  rootIsBranch,
  currentCommunityId,
  isCommunityMember,
  myTier,
  onChanged,
}: {
  node: CommunityTreeNode
  isRoot: boolean
  rootIsBranch: boolean
  currentCommunityId: string
  isCommunityMember: boolean
  myTier: MembershipTier | null
  onChanged: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(node.name)
  const [addingBranch, setAddingBranch] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [requestMessage, setRequestMessage] = useState('')
  const [branchName, setBranchName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const isCurrent = node.id === currentCommunityId
  const canManage = node.viewerCanManage
  const isMember = node.viewerRole !== null
  // The root is joined by invitation, never by request; only branches below it
  // take join requests.
  const isBranchNode = !isRoot || rootIsBranch

  async function send(url: string, method: 'PATCH' | 'POST', payload?: unknown): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'That did not work — please try again.')
        return false
      }
      return true
    } catch {
      setError('Network error — please try again.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleRename() {
    if (!name.trim() || name === node.name) { setRenaming(false); return }
    if (await send(`/api/communities/${node.id}`, 'PATCH', { name: name.trim() })) {
      setRenaming(false)
      onChanged()
    }
  }

  async function handleAddBranch(e: React.FormEvent) {
    e.preventDefault()
    if (!branchName.trim()) return
    if (await send(`/api/communities/${node.id}/children`, 'POST', { name: branchName.trim() })) {
      setBranchName('')
      setAddingBranch(false)
      onChanged()
    }
  }

  async function handleAssignManager(userId: string) {
    if (await send(`/api/communities/${node.id}/manager`, 'PATCH', { userId: userId || null })) {
      setAssigning(false)
      onChanged()
    }
  }

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    if (await send(`/api/communities/${node.id}/join-requests`, 'POST', { message: requestMessage.trim() || undefined })) {
      setRequesting(false)
      setRequestMessage('')
      setNotice('Request sent — an admin of this branch will decide.')
      onChanged()
    }
  }

  async function handleLeave() {
    if (await send(`/api/communities/${node.id}/leave`, 'POST')) {
      setNotice(`You have left ${node.name}.`)
      onChanged()
    }
  }

  return (
    <li className="relative">
      <div className={`rounded-md px-2 py-1.5 ${isCurrent ? 'bg-muted/60' : ''}`}>
        <div className="flex flex-wrap items-center gap-2">
          {node.children.length > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
              aria-expanded={expanded}
            >
              {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          ) : (
            <span className="inline-block size-4" aria-hidden />
          )}

          {renaming ? (
            <>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-7 w-44 text-sm"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              />
              <Button size="sm" onClick={handleRename} disabled={busy}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setName(node.name); setRenaming(false) }}>
                Cancel
              </Button>
            </>
          ) : isCurrent ? (
            <span className="text-sm font-semibold">{node.name}</span>
          ) : (
            // Every node in the tree is reachable by anyone who can see this
            // tree — they are all in one Community. A branch you are not in
            // opens on its own page with the front door, not its board.
            <Link href={`/communities/${node.id}`} className="text-sm font-medium hover:underline">
              {node.name}
            </Link>
          )}

          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
            {isRoot ? (rootIsBranch ? 'This branch' : 'Community') : `Branch · level ${node.depth}`}
          </span>
          {node.viewerRole && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
              {node.viewerRole === 'MEMBER' ? 'Member' : node.viewerRole}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {node.memberCount} member{node.memberCount !== 1 ? 's' : ''}
          </span>
          {node.managerName ? (
            <span className="text-xs text-muted-foreground">· managed by {node.managerName}</span>
          ) : (
            <span className="text-xs text-muted-foreground">· no branch manager</span>
          )}
          {canManage && node.pendingRequestCount > 0 && (
            <Link
              href={`/communities/${node.id}?panel=requests`}
              className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-200"
            >
              {node.pendingRequestCount} waiting
            </Link>
          )}
        </div>

        {/* Membership affordances — request, or leave. */}
        {isBranchNode && !renaming && (
          <div className="ml-6 mt-1.5 flex flex-wrap items-center gap-1.5">
            {!isMember && isCommunityMember && (
              node.viewerHasPendingRequest ? (
                <span className="text-xs text-muted-foreground">Request pending</span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => setRequesting((v) => !v)}
                >
                  Request to join
                </Button>
              )
            )}
            {isMember && node.viewerRole !== 'OWNER' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-muted-foreground"
                disabled={busy}
                onClick={handleLeave}
              >
                Leave
              </Button>
            )}
          </div>
        )}

        {requesting && (
          <form onSubmit={handleRequest} className="ml-6 mt-2 flex flex-wrap items-center gap-2">
            <Input
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Say why (optional)"
              className="h-7 w-56 text-sm"
              maxLength={500}
              autoFocus
            />
            <Button size="sm" type="submit" disabled={busy}>Send request</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setRequesting(false)}>Cancel</Button>
          </form>
        )}

        {canManage && !renaming && (
          <div className="ml-6 mt-1.5 flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setAddingBranch((v) => !v)}>
              Add branch
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setRenaming(true)}>
              Rename
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setAssigning((v) => !v)}>
              Assign manager
            </Button>
          </div>
        )}

        {/* A plain member may found a TOP-LEVEL branch — the growth mechanic.
            ⚠⚠ CENTRAL 25-C §1g — AND ONLY A *GROUP* MEMBER MAY. This was a DEAD
            CONTROL the moment the tier landed: a branch member holds a root
            membership row (Stage 1.2 creates one), so `isCommunityMember` was
            true for them, the button appeared, and `canCreateBranchUnder` then
            refused the POST. An offer the API declines is worse than no offer —
            it reads as the product being broken rather than as a rule. */}
        {isRoot && !rootIsBranch && !canManage && isCommunityMember && tierMayFoundBranch(myTier) && !addingBranch && (
          <div className="ml-6 mt-1.5">
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setAddingBranch(true)}>
              Create your own branch
            </Button>
          </div>
        )}

        {error && <p className="ml-6 mt-1 text-xs text-red-600">{error}</p>}
        {notice && <p className="ml-6 mt-1 text-xs text-muted-foreground">{notice}</p>}

        {addingBranch && (
          <form onSubmit={handleAddBranch} className="ml-6 mt-2 flex items-center gap-2">
            <Input
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder={`New branch under ${node.name}`}
              className="h-7 w-52 text-sm"
              autoFocus
            />
            <Button size="sm" type="submit" disabled={busy}>Add</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setAddingBranch(false)}>Cancel</Button>
          </form>
        )}

        {assigning && (
          <div className="ml-6 mt-2">
            {node.members.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No one has joined this branch yet — a branch manager must be a member of it first.
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <label htmlFor={`manager-${node.id}`} className="text-xs text-muted-foreground">
                  Branch manager
                </label>
                <select
                  id={`manager-${node.id}`}
                  className="h-7 rounded border bg-background px-1 text-xs"
                  defaultValue={node.managerId ?? ''}
                  disabled={busy}
                  onChange={(e) => handleAssignManager(e.target.value)}
                >
                  <option value="">No branch manager</option>
                  {node.members.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.name ?? m.username}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {expanded && node.children.length > 0 && (
        <ul className="ml-3 mt-1 space-y-1 border-l-2 border-border pl-4">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              isRoot={false}
              rootIsBranch={rootIsBranch}
              currentCommunityId={currentCommunityId}
              isCommunityMember={isCommunityMember}
              myTier={myTier}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function TeamsTree({ communityId, tree, rootIsBranch, isCommunityMember, myTier }: Props) {
  const router = useRouter()
  return (
    <ul className="space-y-1">
      <TreeNode
        node={tree}
        isRoot
        rootIsBranch={rootIsBranch}
        currentCommunityId={communityId}
        isCommunityMember={isCommunityMember}
        myTier={myTier}
        onChanged={() => router.refresh()}
      />
    </ul>
  )
}
