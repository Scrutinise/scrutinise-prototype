import Link from 'next/link'

export interface CommunityCardData {
  id: string
  name: string
  description: string | null
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  memberCount: number
  branchCount: number
  isBranch: boolean
  unreadCount: number
}

const ROLE_BADGE: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  MEMBER: 'bg-zinc-100 text-zinc-600',
}

function truncate(str: string | null, len: number): string {
  if (!str) return ''
  return str.length <= len ? str : str.slice(0, len).trimEnd() + '…'
}

export default function CommunityCard({ community }: { community: CommunityCardData }) {
  return (
    <Link
      href={`/communities/${community.id}`}
      className="block rounded-xl border bg-background p-5 hover:border-zinc-300 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-base font-semibold text-zinc-900 leading-snug flex-1 min-w-0">
          {community.name}
        </p>
        <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[community.role]}`}>
          {community.role}
        </span>
      </div>

      {community.description && (
        <p className="text-sm text-zinc-600 leading-relaxed mb-3">
          {truncate(community.description, 140)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
        {community.isBranch && (
          <span className="bg-zinc-100 text-zinc-600 rounded-full px-2 py-0.5">Branch</span>
        )}
        <span>{community.memberCount} member{community.memberCount !== 1 ? 's' : ''}</span>
        {community.branchCount > 0 && (
          <span>{community.branchCount} branch{community.branchCount !== 1 ? 'es' : ''}</span>
        )}
        {community.unreadCount > 0 && (
          <span className="text-primary font-medium">{community.unreadCount} unread</span>
        )}
      </div>
    </Link>
  )
}
