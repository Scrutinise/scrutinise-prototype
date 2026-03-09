'use client'

import Link from 'next/link'
import { MOCK_IDEAS, MOCK_NOTIFICATIONS, MOCK_GROUPS, Stage } from '@/lib/mockData'
import { useUser } from '@/context/UserContext'

const stageBadgeColors: Record<Stage, string> = {
  Create: 'bg-gray-700 text-gray-300',
  Draft: 'bg-blue-900 text-blue-300',
  Develop: 'bg-amber-900 text-amber-300',
  Campaign: 'bg-purple-900 text-purple-300',
  Parliament: 'bg-green-900 text-green-300',
}

const notificationTypeIcon: Record<string, string> = {
  amendment: '✏️',
  vote: '🗳️',
  stage: '🚀',
  moderation: '🚩',
}

export default function PrototypeDashboardPage() {
  const { currentUser } = useUser()

  const myIdeas = MOCK_IDEAS.filter(idea => idea.ownerId === currentUser.id)
  const recentNotifications = [...MOCK_NOTIFICATIONS]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3)
  const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.read).length

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">

      {/* Welcome greeting */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">
          Welcome back, {currentUser.name.split(' ')[0]}
        </h1>
        <p className="text-gray-400 text-sm">Here's what's happening with your ideas.</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <Link
          href="/prototype/create/stage1"
          className="flex items-center justify-center gap-2 px-4 py-3 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          New Idea &#8594;
        </Link>
        <Link
          href="/prototype/browse"
          className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-semibold transition-colors border border-gray-700"
        >
          Browse Ideas &#8594;
        </Link>
        <Link
          href="/prototype/notifications"
          className="relative flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-semibold transition-colors border border-gray-700"
        >
          Notifications
          {unreadCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold leading-none">
              {unreadCount}
            </span>
          )}
        </Link>
        <Link
          href="/prototype/settings"
          className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-semibold transition-colors border border-gray-700"
        >
          Settings &#8594;
        </Link>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column: My Ideas + Following/Watching */}
        <div className="lg:col-span-2 space-y-6">

          {/* My Ideas */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">My Ideas</h2>
              <Link
                href="/prototype/create/stage1"
                className="text-xs text-revolutBlue hover:underline"
              >
                + New Idea
              </Link>
            </div>

            {myIdeas.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm mb-4">
                  You haven't created any ideas yet.{' '}
                  <Link href="/prototype/create/stage1" className="text-revolutBlue hover:underline">
                    Start with New Idea &#8594;
                  </Link>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myIdeas.map(idea => {
                  const total = idea.voteCount.for + idea.voteCount.against + idea.voteCount.undecided
                  return (
                    <div
                      key={idea.id}
                      className="flex items-start justify-between p-4 bg-gray-800 border border-gray-700 rounded-xl hover:border-gray-500 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageBadgeColors[idea.stage]}`}
                          >
                            {idea.stage}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-white truncate mb-1">{idea.title}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{idea.voteCount.for} FOR / {idea.voteCount.against} AGAINST / {idea.voteCount.undecided} UNDECIDED</span>
                          <span>Passion: {idea.passionScore.toFixed(1)}</span>
                        </div>
                      </div>
                      <Link
                        href={`/prototype/idea/${idea.id}`}
                        className="ml-4 flex-shrink-0 text-xs text-revolutBlue hover:underline"
                      >
                        View &#8594;
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Following/Watching */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Following / Watching
            </h2>
            <div className="text-center py-6 text-gray-600 text-sm">
              Ideas you're watching will appear here.
            </div>
            <div className="text-center">
              <Link
                href="/prototype/browse"
                className="text-xs text-revolutBlue hover:underline"
              >
                Browse Ideas &#8594;
              </Link>
            </div>
          </div>

        </div>

        {/* Right column: Notifications + Groups */}
        <div className="space-y-6">

          {/* Recent Notifications */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Notifications
              </h2>
              {unreadCount > 0 && (
                <span className="text-xs px-2 py-0.5 bg-red-900 text-red-300 rounded-full font-medium">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="space-y-3">
              {recentNotifications.map(notif => (
                <div
                  key={notif.id}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs transition-colors ${
                    !notif.read
                      ? 'bg-blue-950/30 border-blue-800/50'
                      : 'bg-gray-800 border-gray-700'
                  }`}
                >
                  <span className="text-sm flex-shrink-0 mt-0.5">
                    {notificationTypeIcon[notif.type] ?? '🔔'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-200 leading-snug line-clamp-1">{notif.message}</p>
                    <p className="text-gray-600 mt-0.5">{notif.createdAt}</p>
                  </div>
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1" />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 text-center">
              <Link
                href="/prototype/notifications"
                className="text-xs text-revolutBlue hover:underline"
              >
                View all &#8594;
              </Link>
            </div>
          </div>

          {/* Groups */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Groups</h2>
              <Link
                href="/prototype/groups"
                className="text-xs text-revolutBlue hover:underline"
              >
                Manage Groups &#8594;
              </Link>
            </div>

            <div className="space-y-3">
              {MOCK_GROUPS.map(group => (
                <div
                  key={group.id}
                  className="flex items-start justify-between p-3 bg-gray-800 border border-gray-700 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-white truncate">{group.name}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded text-[10px]">
                        {group.type}
                      </span>
                      <span>{group.memberCount} members</span>
                    </div>
                  </div>
                  <Link
                    href={`/prototype/groups/${group.id}`}
                    className="ml-3 flex-shrink-0 text-xs text-revolutBlue hover:underline"
                  >
                    View &#8594;
                  </Link>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </main>
  )
}
