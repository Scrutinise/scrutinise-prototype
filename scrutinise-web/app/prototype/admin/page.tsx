'use client'

import { useState } from 'react'
import { MOCK_MODERATION_QUEUE } from '@/lib/mockData'

const TABS = ['Moderation Queue', 'Parliamentary Verification', 'Draftsman Verification', 'Feature Requests']

const actionColors: Record<string, string> = {
  Keep: 'bg-gray-700 hover:bg-gray-600',
  Hide: 'bg-amber-800 hover:bg-amber-700',
  Remove: 'bg-red-800 hover:bg-red-700',
  'Warn User': 'bg-orange-800 hover:bg-orange-700',
  Escalate: 'bg-purple-800 hover:bg-purple-700',
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [actioned, setActioned] = useState<Record<string, string>>({})

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">Admin</div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Moderation Dashboard</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-8 overflow-x-auto">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === i
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
            {i === 0 && MOCK_MODERATION_QUEUE.length > 0 && (
              <span className="ml-2 bg-red-700 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {MOCK_MODERATION_QUEUE.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 0 && (
        <div className="space-y-4">
          {MOCK_MODERATION_QUEUE.map(item => (
            <div key={item.id} className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Summary row */}
              <button
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                className="w-full text-left p-4 hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full font-medium capitalize">
                        {item.contentType}
                      </span>
                      <span className="text-xs text-muted-foreground">Reported by {item.reportedBy}</span>
                      <span className="text-xs text-muted-foreground">{item.createdAt}</span>
                    </div>
                    <p className="text-sm text-foreground truncate">&ldquo;{item.content}&rdquo;</p>
                    <p className="text-xs text-muted-foreground mt-1">On: {item.ideaTitle}</p>
                  </div>
                  <span className="text-muted-foreground text-lg flex-shrink-0">
                    {expanded === item.id ? '&#8963;' : '&#8964;'}
                  </span>
                </div>
              </button>

              {/* Expanded detail */}
              {expanded === item.id && (
                <div className="border-t border-border p-4 bg-background">
                  <div className="mb-4">
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Full comment</div>
                    <p className="text-sm text-foreground bg-card rounded-lg px-4 py-3 border border-border">
                      &ldquo;{item.content}&rdquo;
                    </p>
                  </div>
                  <div className="mb-4">
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Reporter&rsquo;s reason</div>
                    <p className="text-sm text-muted-foreground">{item.reason}</p>
                  </div>

                  {actioned[item.id] ? (
                    <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                      <span>&#10003;</span>
                      Action taken: <strong>{actioned[item.id]}</strong>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(actionColors).map(action => (
                        <button
                          key={action}
                          onClick={() => setActioned(prev => ({ ...prev, [item.id]: action }))}
                          className={`px-4 py-2 rounded-md text-white text-sm font-medium transition-colors ${actionColors[action]}`}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 1 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-sm font-medium text-foreground mb-2">No items awaiting verification</p>
          <p className="text-sm max-w-md mx-auto">MPs and Lords who register will appear here for verification against Parliamentary records.</p>
        </div>
      )}

      {activeTab === 2 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-sm font-medium text-foreground mb-2">No items awaiting verification</p>
          <p className="text-sm max-w-md mx-auto">Legal draftsmen applying for verified status will appear here.</p>
        </div>
      )}

      {activeTab === 3 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-sm">Feature request queue coming soon.</p>
        </div>
      )}
    </main>
  )
}
