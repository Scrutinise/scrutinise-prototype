import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface IdeaCardData {
  id: string
  title: string
  summaryDescription: string | null
  stage: string
  govtArea: string
  createdAt: string
  voteCount: number
  commentCount: number
  creator: {
    displayName: string | null
    username: string
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  STAGE_1: 'Create',
  STAGE_2: 'Draft',
  STAGE_3: 'Develop',
  STAGE_4: 'Campaign',
  STAGE_5: 'Legislate',
}

const STAGE_BADGE: Record<string, string> = {
  STAGE_3: 'bg-yellow-100 text-yellow-800',
  STAGE_4: 'bg-blue-100 text-blue-800',
  STAGE_5: 'bg-green-100 text-green-800',
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 365) return `${Math.floor(days / 365)} year${Math.floor(days / 365) !== 1 ? 's' : ''} ago`
  if (days > 30) return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''} ago`
  if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  if (mins > 0) return `${mins} minute${mins !== 1 ? 's' : ''} ago`
  return 'just now'
}

function truncate(str: string | null, len: number): string {
  if (!str) return ''
  return str.length <= len ? str : str.slice(0, len).trimEnd() + '…'
}

// ─────────────────────────────────────────────────────────────────────────────
// IdeaCard
// ─────────────────────────────────────────────────────────────────────────────

export default function IdeaCard({ idea }: { idea: IdeaCardData }) {
  const stageBadge = STAGE_BADGE[idea.stage] ?? 'bg-zinc-100 text-zinc-700'
  const stageLabel = STAGE_LABELS[idea.stage] ?? idea.stage
  const creatorName = idea.creator.displayName ?? idea.creator.username

  return (
    <div className="rounded-xl border bg-background p-5 hover:border-zinc-300 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link
          href={`/ideas/${idea.id}`}
          className="text-base font-semibold text-zinc-900 hover:underline leading-snug flex-1 min-w-0"
        >
          {idea.title || 'Untitled idea'}
        </Link>
        <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stageBadge}`}>
          {stageLabel}
        </span>
      </div>

      {idea.summaryDescription && (
        <p className="text-sm text-zinc-600 leading-relaxed mb-3">
          {truncate(idea.summaryDescription, 140)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
        {idea.govtArea && (
          <span className="bg-zinc-100 text-zinc-600 rounded-full px-2 py-0.5">
            {idea.govtArea}
          </span>
        )}
        <span>
          by{' '}
          <Link
            href={`/user/${idea.creator.username}`}
            className="text-zinc-600 hover:underline"
          >
            {creatorName}
          </Link>
        </span>
        <span>{relativeTime(idea.createdAt)}</span>
        {idea.voteCount > 0 && (
          <span>{idea.voteCount} vote{idea.voteCount !== 1 ? 's' : ''}</span>
        )}
        {idea.commentCount > 0 && (
          <span>{idea.commentCount} contribution{idea.commentCount !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  )
}
