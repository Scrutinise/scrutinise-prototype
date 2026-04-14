'use client'

import Link from 'next/link'

interface NotificationItem {
  id: string
  title: string | null
  message: string
  linkUrl: string | null
  relatedIdeaId: string | null
  isRead: boolean
  createdAt: Date
}

function normaliseStages(text: string): string {
  return text.replace(/\b(STAGE_[1-5]|Create|Draft|Develop|Campaign|Legislate)\b/g, (m) => {
    const stageMap: Record<string, string> = {
      STAGE_1: 'Stage 1', STAGE_2: 'Stage 2', STAGE_3: 'Stage 3',
      STAGE_4: 'Stage 4', STAGE_5: 'Stage 5',
    }
    return stageMap[m] ?? m
  })
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
        const whatNextUrl = n.relatedIdeaId
          ? `/ideas/${n.relatedIdeaId}?whatnext=true`
          : null

        const content = (
          <div
            className={`rounded-lg border p-3 text-sm transition-colors hover:bg-muted/40 ${
              n.isRead ? 'border-border opacity-60' : 'border-primary/30 bg-primary/5'
            }`}
          >
            {n.title && (
              <p className="font-medium leading-snug">{normaliseStages(n.title)}</p>
            )}
            <p className={`leading-snug ${n.title ? 'mt-0.5 text-muted-foreground text-xs' : ''}`}>
              {normaliseStages(n.message)}
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {new Date(n.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
              {whatNextUrl && (
                <Link
                  href={whatNextUrl}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={(e) => e.stopPropagation()}
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
