'use client'

import Link from 'next/link'

interface NotificationItem {
  id: string
  title: string | null
  message: string
  linkUrl: string | null
  relatedIdeaId: string | null
  ideaTitle: string | null
  isRead: boolean
  createdAt: Date | string
}

function normaliseStages(text: string): string {
  return text
    .replace(/\b(STAGE_1|Create)\b/g, 'Stage 1')
    .replace(/\b(STAGE_2|Draft)\b/g, 'Stage 2')
    .replace(/\b(STAGE_3|Develop)\b/g, 'Stage 3')
    .replace(/\b(STAGE_4|Campaign)\b/g, 'Stage 4')
    .replace(/\b(STAGE_5|Legislate)\b/g, 'Stage 5')
}

export default function NotificationList({ notifications }: { notifications: NotificationItem[] }) {
  if (notifications.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4 text-center">
        <p className="text-sm text-muted-foreground">No notifications yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {notifications.map((n) => {
        const content = (
          <div
            className={`rounded-lg border p-3 text-sm transition-colors hover:bg-muted/40 ${
              n.isRead ? 'border-border opacity-60' : 'border-primary/30 bg-primary/5'
            }`}
          >
            {n.title && <p className="font-medium leading-snug">{normaliseStages(n.title)}</p>}
            {n.ideaTitle && (
              <p className="mt-0.5 text-xs text-muted-foreground font-medium">{n.ideaTitle}</p>
            )}
            {n.message && n.message !== n.title && (
              <p className="mt-0.5 text-xs text-muted-foreground">{normaliseStages(n.message)}</p>
            )}
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </p>
              {n.relatedIdeaId && (
                <Link
                  href={`/ideas/${n.relatedIdeaId}?whatnext=true`}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={e => e.stopPropagation()}
                >
                  What Next?
                </Link>
              )}
            </div>
          </div>
        )

        return n.linkUrl ? (
          <Link key={n.id} href={n.linkUrl}>
            {content}
          </Link>
        ) : (
          <div key={n.id}>{content}</div>
        )
      })}
    </div>
  )
}
