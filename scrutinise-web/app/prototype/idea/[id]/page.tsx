'use client'

import { use, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MOCK_IDEAS, MOCK_USERS, Stage } from '@/lib/mockData'
import { useUser } from '@/context/UserContext'
import DiffView from '@/components/DiffView'
import CommentRatingForm from '@/components/CommentRatingForm'
import { Button } from '@/components/ui/button'

const stageBadgeStyle: Record<Stage, React.CSSProperties> = {
  Create:     { backgroundColor: 'var(--stage-create)',     color: 'white' },
  Draft:      { backgroundColor: 'var(--stage-draft)',      color: 'white' },
  Develop:    { backgroundColor: 'var(--stage-develop)',    color: 'white' },
  Campaign:   { backgroundColor: 'var(--stage-campaign)',   color: 'white' },
  Legislate: { backgroundColor: 'var(--stage-parliament)', color: 'white' },
}

const amendmentStatusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  consulting: 'bg-blue-100 text-blue-800',
}

const stanceBadgeColors: Record<string, string> = {
  supportive: 'bg-green-100 text-green-800',
  critical: 'bg-red-100 text-red-800',
  neutral: 'bg-secondary text-secondary-foreground',
  question: 'bg-blue-100 text-blue-800',
}

const historyTypeIcons: Record<string, string> = {
  created: '✦',
  stage_change: '→',
  endorsement: '★',
  amendment: '✎',
  vote: '✓',
  default: '·',
}

const sourceTypeBadge: Record<string, string> = {
  Academic: 'bg-purple-100 text-purple-800',
  Government: 'bg-blue-100 text-blue-800',
  News: 'bg-secondary text-secondary-foreground',
  'Case Study': 'bg-amber-100 text-amber-800',
  Legislation: 'bg-green-100 text-green-800',
  Other: 'bg-secondary text-secondary-foreground',
}

const TABS = ['Overview', 'Amendments', 'Comments', 'Research', 'Wording', 'History']

const STAGE_ORDER: Stage[] = ['Create', 'Draft', 'Develop', 'Campaign', 'Legislate']

type Props = { params: Promise<{ id: string }> }

export default function IdeaDetailPage({ params }: Props) {
  const { id } = use(params)
  const idea = MOCK_IDEAS.find(i => i.id === id) ?? MOCK_IDEAS[0]
  const { currentUser } = useUser()
  const isOwner = currentUser.id === idea.ownerId
  const owner = MOCK_USERS.find(u => u.id === idea.ownerId)
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const initialTab = tabParam === 'amendments' ? 1 : 0

  const [activeTab, setActiveTab] = useState(initialTab)
  const [amendmentFilter, setAmendmentFilter] = useState<string>('All')
  const [expandedAmendments, setExpandedAmendments] = useState<Set<string>>(new Set())
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set())
  const [ratingOpenFor, setRatingOpenFor] = useState<string | null>(null)
  const [researchFilter, setResearchFilter] = useState<string>('All')
  const [commentSort, setCommentSort] = useState<string>('recent')
  const [stanceFilter, setStanceFilter] = useState<string>('All')
  const [watching, setWatching] = useState(false)

  const totalVotes = idea.voteCount.for + idea.voteCount.against + idea.voteCount.undecided

  const filteredAmendments = idea.amendments.filter(a =>
    amendmentFilter === 'All' || a.status === amendmentFilter.toLowerCase()
  )

  const filteredResearch = idea.research.filter(r => {
    if (researchFilter === 'All') return true
    if (researchFilter === 'For') return r.forPolicy
    if (researchFilter === 'Against') return !r.forPolicy
    return r.sourceType === researchFilter
  })

  const filteredComments = idea.comments.filter(c => {
    if (stanceFilter === 'All') return true
    return c.stance === stanceFilter.toLowerCase()
  })

  const stageGateItems = [
    { label: 'Diagnosis completed', done: !!idea.diagnosis },
    { label: 'Root cause identified', done: !!idea.rootCause },
    { label: 'Guiding policy written', done: !!idea.guidingPolicy },
    { label: 'At least 1 coherent action', done: idea.coherentActions.length > 0 },
    { label: 'Proposed wording drafted', done: !!idea.proposedWording },
    { label: 'Research attached', done: idea.research.length > 0 },
    { label: '100+ votes received', done: totalVotes >= 100 },
    { label: '1+ parliamentary endorsement', done: idea.endorsements.length >= 1 },
  ]
  const gateComplete = stageGateItems.every(i => i.done)

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Back link */}
      <div className="mb-4">
        <Link href="/prototype/browse" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Browse Ideas
        </Link>
      </div>

      {/* Five-stage progress stepper */}
      <div className="flex items-center gap-0 mb-6 overflow-x-auto">
        {STAGE_ORDER.map((stage, i) => {
          const currentIndex = STAGE_ORDER.indexOf(idea.stage)
          const isPast = i < currentIndex
          const isCurrent = i === currentIndex
          return (
            <div key={stage} className="flex items-center">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                isCurrent
                  ? 'bg-primary text-primary-foreground'
                  : isPast
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  isCurrent ? 'bg-primary-foreground' : isPast ? 'bg-primary' : 'bg-muted-foreground'
                }`} />
                {stage}
              </div>
              {i < STAGE_ORDER.length - 1 && (
                <div className={`w-5 h-px flex-shrink-0 ${i < currentIndex ? 'bg-primary/40' : 'bg-border'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Header */}
      <div className="flex items-start gap-2 mb-2 mt-4 flex-wrap">
        <span
          className="text-xs px-2.5 py-1 rounded-md font-medium flex-shrink-0"
          style={stageBadgeStyle[idea.stage]}
        >
          {idea.stage}
        </span>
        <span className="text-xs text-muted-foreground px-2.5 py-1 bg-secondary rounded-md">{idea.area}</span>
        <span className="text-xs text-muted-foreground px-2.5 py-1 bg-secondary rounded-md">{idea.country}</span>
      </div>

      <h1 className="text-xl font-semibold tracking-tight mb-2 leading-snug sm:text-2xl">{idea.title}</h1>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-4">
        <span>
          Owner:{' '}
          <Link href={`/prototype/profile/${owner?.name.replace(/\s+/g, '-').toLowerCase()}`} className="text-foreground hover:text-primary transition-colors">
            {owner?.name}
          </Link>
        </span>
        <span>Created {idea.createdAt}</span>
        <span>Credibility Score: <span className="text-foreground">{idea.credibilityScore}</span></span>
      </div>

      {/* Vote summary row */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-lg border border-border bg-card mb-4">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{idea.voteCount.for.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">FOR</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">{idea.voteCount.against.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">AGAINST</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-muted-foreground">{idea.voteCount.undecided.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">UNDECIDED</div>
          </div>
        </div>
        <div className="flex-1 border-l border-border pl-4">
          <div className="text-xs text-muted-foreground mb-0.5">Passion score</div>
          <div className="text-xl font-bold">{idea.passionScore} <span className="text-sm text-muted-foreground">/ 5</span></div>
        </div>
        {!isOwner && (
          <button
            onClick={() => setWatching(w => !w)}
            className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
              watching
                ? 'bg-primary/10 border-primary text-primary'
                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
            }`}
          >
            {watching ? '★ Watching' : '☆ Watch this idea'}
          </button>
        )}
      </div>

      {/* Owner panel */}
      {isOwner && (
        <div className="mb-6 space-y-4">
          {/* Stage gate checklist */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Stage requirements</h2>
              {gateComplete ? (
                <span className="text-xs text-green-600 font-medium">All requirements met</span>
              ) : (
                <span className="text-xs text-amber-600 font-medium">{stageGateItems.filter(i => !i.done).length} remaining</span>
              )}
            </div>
            <div className="space-y-2">
              {stageGateItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`text-xs flex-shrink-0 ${item.done ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {item.done ? '✓' : '○'}
                  </span>
                  <span className={`text-xs ${item.done ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</span>
                </div>
              ))}
            </div>
            {gateComplete && (
              <Button className="mt-4 w-full">
                Progress to next stage →
              </Button>
            )}
          </div>

          {/* Vote analytics */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-semibold mb-4">Vote analytics</h2>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>FOR</span>
                  <span>{Math.round((idea.voteCount.for / (totalVotes || 1)) * 100)}% · {idea.voteCount.for.toLocaleString()}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-green-500 h-full rounded-full" style={{ width: `${(idea.voteCount.for / (totalVotes || 1)) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>AGAINST</span>
                  <span>{Math.round((idea.voteCount.against / (totalVotes || 1)) * 100)}% · {idea.voteCount.against.toLocaleString()}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-red-500 h-full rounded-full" style={{ width: `${(idea.voteCount.against / (totalVotes || 1)) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>UNDECIDED</span>
                  <span>{Math.round((idea.voteCount.undecided / (totalVotes || 1)) * 100)}% · {idea.voteCount.undecided.toLocaleString()}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-muted-foreground h-full rounded-full" style={{ width: `${(idea.voteCount.undecided / (totalVotes || 1)) * 100}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Voter quality flags</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Doesn't go far enough</span>
                  <span className="text-amber-600">{idea.qualityFlags.doesntGoFarEnough} voters</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Goes too far</span>
                  <span className="text-amber-600">{idea.qualityFlags.goesTooFar} voters</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Poorly worded</span>
                  <span className="text-amber-600">{idea.qualityFlags.poorlyWorded} voters</span>
                </div>
              </div>
            </div>

            <Button variant="outline" className="mt-4 w-full">
              Broadcast to Voters
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border mb-8 overflow-x-auto">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === i
                ? 'border-primary text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── TAB 0: Overview ── */}
      {activeTab === 0 && (
        <div className="space-y-8">
          <p className="text-foreground leading-relaxed">{idea.summary}</p>

          {!isOwner && (
            <div className="rounded-xl border p-4 text-sm text-muted-foreground">
              Voting opens at Stage 4 (Campaign).
            </div>
          )}

          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Diagnosis</h2>
            <p className="text-foreground leading-relaxed text-sm">{idea.diagnosis}</p>
          </div>

          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Root Cause</h2>
            <p className="text-foreground leading-relaxed text-sm">{idea.rootCause}</p>
          </div>

          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Guiding Policy</h2>
            <p className="text-foreground leading-relaxed text-sm">{idea.guidingPolicy}</p>
          </div>

          {idea.coherentActions.length > 0 && (
            <div>
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Coherent Actions</h2>
              <div className="space-y-3">
                {idea.coherentActions.map((ca, idx) => {
                  const isExpanded = expandedActions.has(ca.id)
                  return (
                    <div key={ca.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-xs text-muted-foreground font-mono mt-0.5 flex-shrink-0">{idx + 1}.</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold mb-1">{ca.title}</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{ca.description}</p>
                          {isExpanded && (
                            <div className="mt-3 p-3 bg-secondary rounded-md border border-border">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Proposed wording</p>
                              <p className="text-xs text-foreground leading-relaxed font-mono">{ca.proposedWording}</p>
                            </div>
                          )}
                          <button
                            onClick={() => setExpandedActions(prev => {
                              const next = new Set(prev)
                              isExpanded ? next.delete(ca.id) : next.add(ca.id)
                              return next
                            })}
                            className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {isExpanded ? '↑ Hide wording' : '↓ Show proposed wording'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {idea.targetLegislation && (
            <div>
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Target Legislation</h2>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{idea.targetLegislation.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{idea.targetLegislation.relevantClauses}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium flex-shrink-0 ${
                    idea.targetLegislation.changeType === 'AMEND' ? 'bg-amber-100 text-amber-800' :
                    idea.targetLegislation.changeType === 'REPEAL' ? 'bg-red-100 text-red-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {idea.targetLegislation.changeType}
                  </span>
                </div>
                <a
                  href={idea.targetLegislation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs text-primary hover:underline"
                >
                  View on legislation.gov.uk →
                </a>
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Parliamentary Endorsements
              <span className="ml-2 normal-case font-normal">
                ({idea.endorsements.length} of 3 required for Legislate stage)
              </span>
            </h2>
            {idea.endorsements.length === 0 ? (
              <p className="text-muted-foreground text-sm">No endorsements yet.</p>
            ) : (
              <div className="space-y-3">
                {idea.endorsements.map(end => (
                  <div key={end.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-semibold">{end.name}</p>
                        <p className="text-xs text-muted-foreground">{end.role} · {end.constituency}</p>
                      </div>
                      <span className="text-xs text-green-600 flex-shrink-0">★ Endorsed</span>
                    </div>
                    {end.publicStatement && (
                      <p className="text-xs text-muted-foreground leading-relaxed italic">"{end.publicStatement}"</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">{end.endorsedAt}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 p-4 rounded-lg border border-dashed border-border">
              <p className="text-xs text-muted-foreground">Parliamentary Draftsman Certificate — not yet obtained</p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 1: Amendments ── */}
      {activeTab === 1 && (
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            {['All', 'Pending', 'Accepted', 'Rejected', 'Consulting'].map(f => (
              <button
                key={f}
                onClick={() => setAmendmentFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  amendmentFilter === f
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
            <div className="flex-1" />
            <Link
              href={`/prototype/propose-amendment/${idea.id}`}
              className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs font-semibold transition-colors"
            >
              Propose Amendment
            </Link>
          </div>

          {filteredAmendments.length === 0 ? (
            <p className="text-muted-foreground text-sm">No amendments in this category.</p>
          ) : (
            <div className="space-y-3">
              {filteredAmendments.map(amend => {
                const isExpanded = expandedAmendments.has(amend.id)
                return (
                  <div key={amend.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <Link
                          href={`/prototype/profile/${amend.proposedBy.replace(/\s+/g, '-').toLowerCase()}`}
                          className="text-sm font-medium hover:text-primary transition-colors"
                        >
                          {amend.proposedBy}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">{amend.createdAt}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium flex-shrink-0 ${amendmentStatusColors[amend.status]}`}>
                        {amend.status}
                      </span>
                    </div>

                    {amend.rationale && (
                      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{amend.rationale}</p>
                    )}

                    <button
                      onClick={() => setExpandedAmendments(prev => {
                        const next = new Set(prev)
                        isExpanded ? next.delete(amend.id) : next.add(amend.id)
                        return next
                      })}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
                    >
                      {isExpanded ? '↑ Hide diff' : '↓ Show diff'}
                    </button>

                    {isExpanded && (
                      <div className="mt-2">
                        <DiffView current={amend.currentWording} proposed={amend.proposedWording} />
                      </div>
                    )}

                    {isOwner && amend.status === 'pending' && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                        <button className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 rounded-md text-xs font-medium transition-colors">
                          Accept
                        </button>
                        <button className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-md text-xs font-medium transition-colors">
                          Circulate for Consultation
                        </button>
                        <button className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-md text-xs font-medium transition-colors">
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Comments ── */}
      {activeTab === 2 && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex flex-wrap gap-1">
              {['All', 'Supportive', 'Critical', 'Neutral', 'Question'].map(s => (
                <button
                  key={s}
                  onClick={() => setStanceFilter(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    stanceFilter === s
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <select
              value={commentSort}
              onChange={e => setCommentSort(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none"
            >
              <option value="recent">Most recent</option>
              <option value="helpful">Most helpful</option>
              <option value="critical">Most critical</option>
              <option value="supportive">Most supportive</option>
            </select>
            <button className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs font-semibold transition-colors">
              Add Comment
            </button>
          </div>

          {filteredComments.length === 0 ? (
            <p className="text-muted-foreground text-sm">No comments in this category.</p>
          ) : (
            <div className="space-y-3">
              {filteredComments.map(comment => (
                <div key={comment.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/prototype/profile/${comment.author.replace(/\s+/g, '-').toLowerCase()}`}
                        className="text-sm font-medium hover:text-primary transition-colors"
                      >
                        {comment.author}
                      </Link>
                      {comment.stance && (
                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${stanceBadgeColors[comment.stance] ?? 'bg-secondary text-secondary-foreground'}`}>
                          {comment.stance.charAt(0).toUpperCase() + comment.stance.slice(1)}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{comment.createdAt}</span>
                  </div>

                  <p className="text-sm text-foreground leading-relaxed">{comment.text}</p>

                  {comment.positiveFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {comment.positiveFlags.map(f => (
                        <span key={f} className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-md">{f.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  )}
                  {comment.negativeFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {comment.negativeFlags.map(f => (
                        <span key={f} className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded-md">{f.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={() => setRatingOpenFor(ratingOpenFor === comment.id ? null : comment.id)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Rate
                    </button>
                    <button className="text-xs text-muted-foreground hover:text-destructive transition-colors">Report</button>
                    {comment.reported && (
                      <span className="text-xs text-destructive">⚑ Reported</span>
                    )}
                  </div>

                  {ratingOpenFor === comment.id && (
                    <CommentRatingForm
                      commentId={comment.id}
                      onClose={() => setRatingOpenFor(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Research ── */}
      {activeTab === 3 && (
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            {['All', 'For', 'Against', 'Academic', 'Government', 'News'].map(f => (
              <button
                key={f}
                onClick={() => setResearchFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  researchFilter === f
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
            <div className="flex-1" />
            <Link
              href={`/prototype/add-research/${idea.id}`}
              className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs font-semibold transition-colors"
            >
              Add Research
            </Link>
          </div>

          {filteredResearch.length === 0 ? (
            <p className="text-muted-foreground text-sm">No research in this category.</p>
          ) : (
            <div className="space-y-3">
              {filteredResearch.map(res => (
                <div key={res.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold">{res.title}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${sourceTypeBadge[res.sourceType] ?? 'bg-secondary text-secondary-foreground'}`}>
                        {res.sourceType}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${res.forPolicy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {res.forPolicy ? 'Supports' : 'Against'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed mb-2">"{res.snippet}"</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">{res.relevanceExplanation}</p>
                  <a
                    href={res.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    View source →
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: Wording ── */}
      {activeTab === 4 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Proposed Wording</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Version {idea.version}</p>
            </div>
            {idea.wordingLocked ? (
              <span className="text-xs px-2.5 py-1 bg-amber-100 text-amber-800 rounded-md font-medium">
                🔒 Locked — changes require amendment process
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 bg-secondary text-secondary-foreground rounded-md">
                Unlocked
              </span>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm text-foreground leading-relaxed">{idea.proposedWording}</p>
          </div>

          {!idea.wordingLocked && isOwner && (
            <Button variant="outline">
              Edit wording
            </Button>
          )}

          {idea.wordingLocked && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800">
                This wording has received votes and is now locked for direct editing.
                To propose a change, use the Amendments tab.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: History ── */}
      {activeTab === 5 && (
        <div className="space-y-0">
          {idea.history.length === 0 ? (
            <p className="text-muted-foreground text-sm">No history events yet.</p>
          ) : (
            idea.history.map((event, i) => (
              <div key={event.id} className="flex gap-4 pb-6">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {historyTypeIcons[event.type] ?? historyTypeIcons.default}
                    </span>
                  </div>
                  {i < idea.history.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                </div>
                <div className="pb-2">
                  <p className="text-sm text-foreground">{event.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{event.date}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </main>
  )
}
