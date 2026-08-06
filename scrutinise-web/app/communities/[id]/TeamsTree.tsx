'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CommunityTreeNode } from '@/lib/community'

interface Props {
  communityId: string
  tree: CommunityTreeNode
  canManage: boolean
  /** True when the board being viewed is itself a branch, not the Community root. */
  rootIsBranch: boolean
}

/**
 * One node of the Teams & branches tree.
 *
 * The 6 Aug user test called the Stage 1 tree "very basic, unclear": every node
 * sat at nearly the same indent and the admin actions were three tiny grey
 * words. This version gives each level a real indent with a connector rail, a
 * level label, and explicit labelled buttons — structure and affordance, not
 * styling. Existing components throughout; no new design system.
 */
function TreeNode({
  node,
  isRoot,
  rootIsBranch,
  currentCommunityId,
  canManage,
  onChanged,
}: {
  node: CommunityTreeNode
  isRoot: boolean
  rootIsBranch: boolean
  currentCommunityId: string
  canManage: boolean
  onChanged: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(node.name)
  const [addingBranch, setAddingBranch] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [branchName, setBranchName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCurrent = node.id === currentCommunityId

  async function send(url: string, method: 'PATCH' | 'POST', payload: unknown): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  return (
    <li className="relative">
      <div
        className={`rounded-md px-2 py-1.5 ${isCurrent ? 'bg-muted/60' : ''}`}
      >
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
            <Link href={`/communities/${node.id}`} className="text-sm font-medium hover:underline">
              {node.name}
            </Link>
          )}

          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
            {isRoot ? (rootIsBranch ? 'This branch' : 'Community') : `Branch · level ${node.depth}`}
          </span>
          <span className="text-xs text-muted-foreground">
            {node.memberCount} member{node.memberCount !== 1 ? 's' : ''}
          </span>
          {node.managerName ? (
            <span className="text-xs text-muted-foreground">· managed by {node.managerName}</span>
          ) : (
            <span className="text-xs text-muted-foreground">· no manager</span>
          )}
        </div>

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

        {error && <p className="ml-6 mt-1 text-xs text-red-600">{error}</p>}

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
                No one has joined this branch yet — a manager must be a member of it first.
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <label htmlFor={`manager-${node.id}`} className="text-xs text-muted-foreground">
                  Manager
                </label>
                <select
                  id={`manager-${node.id}`}
                  className="h-7 rounded border bg-background px-1 text-xs"
                  defaultValue={node.managerId ?? ''}
                  disabled={busy}
                  onChange={(e) => handleAssignManager(e.target.value)}
                >
                  <option value="">No manager</option>
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
              canManage={canManage}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function TeamsTree({ communityId, tree, canManage, rootIsBranch }: Props) {
  const router = useRouter()
  return (
    <ul className="space-y-1">
      <TreeNode
        node={tree}
        isRoot
        rootIsBranch={rootIsBranch}
        currentCommunityId={communityId}
        canManage={canManage}
        onChanged={() => router.refresh()}
      />
    </ul>
  )
}
