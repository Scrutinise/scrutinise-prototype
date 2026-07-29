'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CommunityTreeNode } from '@/lib/community'

interface Member {
  userId: string
  name: string | null
  username: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
}

interface Props {
  communityId: string
  tree: CommunityTreeNode
  members: Member[]
  canManage: boolean
}

function TreeNode({
  node,
  isRoot,
  currentCommunityId,
  members,
  canManage,
  onChanged,
}: {
  node: CommunityTreeNode
  isRoot: boolean
  currentCommunityId: string
  members: Member[]
  canManage: boolean
  onChanged: () => void
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(node.name)
  const [addingBranch, setAddingBranch] = useState(false)
  const [branchName, setBranchName] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleRename() {
    if (!name.trim() || name === node.name) { setRenaming(false); return }
    setBusy(true)
    await fetch(`/api/communities/${node.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    setBusy(false)
    setRenaming(false)
    onChanged()
  }

  async function handleAddBranch(e: React.FormEvent) {
    e.preventDefault()
    if (!branchName.trim()) return
    setBusy(true)
    await fetch(`/api/communities/${node.id}/children`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: branchName.trim() }),
    })
    setBusy(false)
    setBranchName('')
    setAddingBranch(false)
    onChanged()
  }

  async function handleAssignManager(userId: string) {
    setBusy(true)
    await fetch(`/api/communities/${node.id}/manager`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userId || null }),
    })
    setBusy(false)
    onChanged()
  }

  return (
    <div className={isRoot ? '' : 'ml-4 border-l border-border pl-3 mt-2'}>
      <div className="flex items-center gap-2 py-1">
        {node.children.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-muted-foreground w-4"
            aria-label="Toggle branch"
          >
            {expanded ? '▾' : '▸'}
          </button>
        )}
        {renaming ? (
          <>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-7 w-40 text-sm" />
            <Button size="sm" variant="outline" onClick={handleRename} disabled={busy}>Save</Button>
          </>
        ) : node.id === currentCommunityId ? (
          <span className="text-sm font-medium">{node.name}</span>
        ) : (
          <Link href={`/communities/${node.id}`} className="text-sm font-medium hover:underline">
            {node.name}
          </Link>
        )}
        {node.managerName && (
          <span className="text-xs text-muted-foreground">managed by {node.managerName}</span>
        )}
        {canManage && !renaming && (
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setRenaming(true)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Rename
            </button>
            <button
              onClick={() => setAddingBranch((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              + Branch
            </button>
            {node.id === currentCommunityId && (
              <select
                className="text-xs border rounded px-1 py-0.5 bg-background"
                defaultValue={node.managerId ?? ''}
                onChange={(e) => handleAssignManager(e.target.value)}
              >
                <option value="">No manager</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.name ?? m.username}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {addingBranch && (
        <form onSubmit={handleAddBranch} className="flex items-center gap-2 ml-6 mt-1 mb-2">
          <Input
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            placeholder="Branch name"
            className="h-7 w-40 text-sm"
            autoFocus
          />
          <Button size="sm" type="submit" disabled={busy}>Add</Button>
        </form>
      )}

      {expanded && node.children.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          isRoot={false}
          currentCommunityId={currentCommunityId}
          members={members}
          canManage={canManage}
          onChanged={onChanged}
        />
      ))}
    </div>
  )
}

export default function TeamsTree({ communityId, tree, members, canManage }: Props) {
  const router = useRouter()
  return (
    <div>
      <TreeNode
        node={tree}
        isRoot
        currentCommunityId={communityId}
        members={members}
        canManage={canManage}
        onChanged={() => router.refresh()}
      />
    </div>
  )
}
