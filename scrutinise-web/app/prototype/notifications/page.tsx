'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MOCK_NOTIFICATIONS, Notification } from '@/lib/mockData'

const typeIcons: Record<string, string> = {
  vote: '🗳️',
  amendment: '✏️',
  stage: '🔔',
  moderation: '⚙️',
}

const typeLabels: Record<string, string> = {
  vote: 'Votes',
  amendment: 'Amendments',
  stage: 'Stage',
  moderation: 'System',
}

const FILTER_TABS = ['All', 'Votes', 'Amendments', 'Stage', 'System']

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS)
  const [activeFilter, setActiveFilter] = useState('All')

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const filteredNotifications = notifications.filter(n => {
    if (activeFilter === 'All') return true
    if (activeFilter === 'Votes') return n.type === 'vote'
    if (activeFilter === 'Amendments') return n.type === 'amendment'
    if (activeFilter === 'Stage') return n.type === 'stage'
    if (activeFilter === 'System') return n.type === 'moderation'
    return true
  })

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-6">
        <Link href="/prototype/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Dashboard
        </Link>
        <div className="flex items-center justify-between mt-4">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-3 text-sm font-semibold text-primary">({unreadCount} unread)</span>
            )}
          </h1>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-md px-3 py-1.5"
            >
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {FILTER_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeFilter === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">No notifications in this category.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredNotifications.map(notif => (
            <Link
              key={notif.id}
              href={notif.type === 'amendment' ? `/prototype/idea/${notif.ideaId}?tab=amendments` : `/prototype/idea/${notif.ideaId}`}
              onClick={() => markRead(notif.id)}
              className={`flex items-start gap-3 p-4 rounded-lg border transition-all block ${
                !notif.read
                  ? 'bg-primary/5 border-primary/30 hover:bg-primary/10'
                  : 'bg-card border-border hover:border-border/80 hover:bg-accent'
              }`}
            >
              <span className="text-lg flex-shrink-0">{typeIcons[notif.type] ?? '🔔'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-relaxed">{notif.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{notif.createdAt}</p>
              </div>
              {!notif.read && (
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
