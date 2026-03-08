'use client'

import Link from 'next/link'
import { MOCK_IDEAS, MOCK_NOTIFICATIONS, Stage } from '@/lib/mockData'
import { useUser } from '@/context/UserContext'
import AIFuelGauge from '@/components/AIFuelGauge'

const stageBadgeColors: Record<Stage, string> = {
  Create: 'bg-gray-700 text-gray-300',
  Draft: 'bg-blue-900 text-blue-300',
  Develop: 'bg-amber-900 text-amber-300',
  Campaign: 'bg-purple-900 text-purple-300',
  Parliament: 'bg-green-900 text-green-300',
}

export default function DashboardPage() {
  const { currentUser } = useUser()
  const myIdeas = MOCK_IDEAS.filter(i => i.ownerId === currentUser.id)

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-1">Welcome back, {currentUser.name.split(' ')[0]}</h1>
        <p className="text-gray-500 text-sm">Here's what's happening with your ideas.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Credibility</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{currentUser.credibility.toLocaleString()}</span>
            <span className="text-gray-500 text-sm">pts</span>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">AI Fuel</div>
          <AIFuelGauge remaining={currentUser.aiFuelRemaining} total={currentUser.aiFuelTotal} />
        </div>
      </div>

      {/* Notifications */}
      <div className="mb-10">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Notifications</h2>
        <div className="space-y-2">
          {MOCK_NOTIFICATIONS.map(notif => (
            <div
              key={notif.id}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                !notif.read
                  ? 'bg-blue-950/30 border-blue-800'
                  : 'bg-gray-900 border-gray-700'
              }`}
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!notif.read ? 'bg-blue-400' : 'bg-gray-600'}`} />
              <div className="flex-1">
                <p className="text-sm text-gray-200">{notif.message}</p>
                <p className="text-xs text-gray-500 mt-1">{notif.createdAt}</p>
              </div>
              {'amendmentId' in notif && (
                <Link
                  href={`/prototype/amendment/${notif.amendmentId}`}
                  className="text-xs text-revolutBlue hover:underline flex-shrink-0 mt-0.5"
                >
                  Review &#8594;
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* My Ideas */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Your Ideas</h2>
        {myIdeas.length === 0 ? (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 text-center">
            <p className="text-gray-500 text-sm mb-4">You haven't created any ideas yet.</p>
            <Link
              href="/prototype/create/stage1"
              className="inline-block px-5 py-2.5 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Create your first idea &#8594;
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {myIdeas.map(idea => {
              const total = idea.voteCount.for + idea.voteCount.against + idea.voteCount.undecided
              return (
                <Link
                  key={idea.id}
                  href={`/prototype/idea/${idea.id}`}
                  className="flex items-center justify-between p-4 bg-gray-900 border border-gray-700 rounded-xl hover:border-gray-500 hover:bg-gray-800 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageBadgeColors[idea.stage]}`}>
                        {idea.stage}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-white truncate">{idea.title}</p>
                  </div>
                  <div className="text-xs text-gray-500 ml-4 flex-shrink-0">{total.toLocaleString()} votes</div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
