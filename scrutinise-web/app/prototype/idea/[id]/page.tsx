'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { MOCK_IDEAS, MOCK_USERS, Stage } from '@/lib/mockData'
import { useUser } from '@/context/UserContext'
import VoteWidget from '@/components/VoteWidget'
import DiffView from '@/components/DiffView'
import CommentRatingForm from '@/components/CommentRatingForm'

const stageBadgeColors: Record<Stage, string> = {
  Create: 'bg-gray-700 text-gray-300',
  Draft: 'bg-blue-900 text-blue-300',
  Develop: 'bg-amber-900 text-amber-300',
  Campaign: 'bg-purple-900 text-purple-300',
  Parliament: 'bg-green-900 text-green-300',
}

const amendmentStatusColors: Record<string, string> = {
  pending: 'bg-amber-900 text-amber-300',
  accepted: 'bg-green-900 text-green-300',
  rejected: 'bg-red-900 text-red-300',
  consulting: 'bg-blue-900 text-blue-300',
}

const stanceBadgeColors: Record<string, string> = {
  supportive: 'bg-green-900 text-green-300',
  critical: 'bg-red-900 text-red-300',
  neutral: 'bg-gray-700 text-gray-300',
  question: 'bg-blue-900 text-blue-300',
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
  Academic: 'bg-purple-900 text-purple-300',
  Government: 'bg-blue-900 text-blue-300',
  News: 'bg-gray-700 text-gray-300',
  'Case Study': 'bg-amber-900 text-amber-300',
  Legislation: 'bg-green-900 text-green-300',
  Other: 'bg-gray-700 text-gray-300',
}

const TABS = ['Overview', 'Amendments', 'Comments', 'Research', 'Wording', 'History']

type Props = { params: Promise<{ id: string }> }

export default function IdeaDetailPage({ params }: Props) {
  const { id } = use(params)
  const idea = MOCK_IDEAS.find(i => i.id === id) ?? MOCK_IDEAS[0]
  const { currentUser } = useUser()
  const isOwner = currentUser.id === idea.ownerId
  const owner = MOCK_USERS.find(u => u.id === idea.ownerId)

  const [activeTab, setActiveTab] = useState(0)
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

  // Stage gate checklist items for owner panel
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
    <main className="max-w-3xl mx-auto px-6 py-10">
      {/* Back link */}
      <div className="mb-4">
        <Link href="/prototype/browse" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          ← Browse Ideas
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3 mb-2 mt-4">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${stageBadgeColors[idea.stage]}`}>
          {idea.stage}
        </span>
        <span className="text-xs text-gray-500 px-2.5 py-1 bg-gray-800 rounded-full">{idea.area}</span>
        <span className="text-xs text-gray-500 px-2.5 py-1 bg-gray-800 rounded-full">{idea.country}</span>
      </div>

      <h1 className="text-2xl font-bold text-white mb-2 leading-snug">{idea.title}</h1>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mb-4">
        <span>
          Owner:{' '}
          <Link href={`/prototype/profile/${owner?.name.replace(/\s+/g, '-').toLowerCase()}`} className="text-gray-300 hover:text-white transition-colors">
            {owner?.name}
          </Link>
        </span>
        <span>Created {idea.createdAt}</span>
        <span>Credibility Score: <span className="text-gray-300">{idea.credibilityScore}</span></span>
      </div>

      {/* Vote summary row */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-900 border border-gray-700 rounded-xl mb-4">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-lg font-bold text-green-400">{idea.voteCount.for.toLocaleString()}</div>
            <div className="text-xs text-gray-500">FOR</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-400">{idea.voteCount.against.toLocaleString()}</div>
            <div className="text-xs text-gray-500">AGAINST</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-400">{idea.voteCount.undecided.toLocaleString()}</div>
            <div className="text-xs text-gray-500">UNDECIDED</div>
          </div>
        </div>
        <div className="flex-1 border-l border-gray-700 pl-4">
          <div className="text-xs text-gray-500 mb-0.5">Passion score</div>
          <div className="text-xl font-bold text-white">{idea.passionScore} <span className="text-sm text-gray-500">/ 5</span></div>
        </div>
        {!isOwner && (
          <button
            onClick={() => setWatching(w => !w)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              watching
                ? 'bg-blue-900 border-blue-700 text-blue-300'
                : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'
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
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Stage requirements</h2>
              {gateComplete ? (
                <span className="text-xs text-green-400 font-medium">All requirements met</span>
              ) : (
                <span className="text-xs text-amber-400 font-medium">{stageGateItems.filter(i => !i.done).length} remaining</span>
              )}
            </div>
            <div className="space-y-2">
              {stageGateItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`text-xs flex-shrink-0 ${item.done ? 'text-green-400' : 'text-gray-600'}`}>
                    {item.done ? '✓' : '○'}
                  </span>
                  <span className={`text-xs ${item.done ? 'text-gray-300' : 'text-gray-600'}`}>{item.label}</span>
                </div>
              ))}
            </div>
            {gateComplete && (
              <button className="mt-4 w-full py-2 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors">
                Progress to next stage →
              </button>
            )}
          </div>

          {/* Vote analytics */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Vote analytics</h2>
            <div className="space-y-3">
              {/* FOR bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>FOR</span>
                  <span>{Math.round((idea.voteCount.for / (totalVotes || 1)) * 100)}% · {idea.voteCount.for.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div className="bg-green-500 h-full rounded-full" style={{ width: `${(idea.voteCount.for / (totalVotes || 1)) * 100}%` }} />
                </div>
              </div>
              {/* AGAINST bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>AGAINST</span>
                  <span>{Math.round((idea.voteCount.against / (totalVotes || 1)) * 100)}% · {idea.voteCount.against.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div className="bg-red-500 h-full rounded-full" style={{ width: `${(idea.voteCount.against / (totalVotes || 1)) * 100}%` }} />
                </div>
              </div>
              {/* UNDECIDED bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>UNDECIDED</span>
                  <span>{Math.round((idea.voteCount.undecided / (totalVotes || 1)) * 100)}% · {idea.voteCount.undecided.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div className="bg-gray-500 h-full rounded-full" style={{ width: `${(idea.voteCount.undecided / (totalVotes || 1)) * 100}%` }} />
                </div>
              </div>
            </div>

            {/* Quality flags */}
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Voter quality flags</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Doesn't go far enough</span>
                  <span className="text-amber-400">{idea.qualityFlags.doesntGoFarEnough} voters</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Goes too far</span>
                  <span className="text-amber-400">{idea.qualityFlags.goesTooFar} voters</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Poorly worded</span>
                  <span className="text-amber-400">{idea.qualityFlags.poorlyWorded} voters</span>
                </div>
              </div>
            </div>

            <button className="mt-4 w-full py-2 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 rounded-xl text-sm font-medium transition-colors">
              Broadcast to Voters
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-800 mb-8 overflow-x-auto">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === i
                ? 'border-revolutBlue text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── TAB 0: Overview ── */}
      {activeTab === 0 && (
        <div className="space-y-8">
          <p className="text-gray-300 leading-relaxed">{idea.summary}</p>

          {/* Vote widget for non-owners */}
          {!isOwner && <VoteWidget currentVotes={idea.voteCount} />}

          {/* Diagnosis */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Diagnosis</h2>
            <p className="text-gray-300 leading-relaxed text-sm">{idea.diagnosis}</p>
          </div>

          {/* Root cause */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Root Cause</h2>
            <p className="text-gray-300 leading-relaxed text-sm">{idea.rootCause}</p>
          </div>

          {/* Guiding policy */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Guiding Policy</h2>
            <p className="text-gray-300 leading-relaxed text-sm">{idea.guidingPolicy}</p>
          </div>

          {/* Coherent actions */}
          {idea.coherentActions.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Coherent Actions</h2>
              <div className="space-y-3">
                {idea.coherentActions.map((ca, idx) => {
                  const isExpanded = expandedActions.has(ca.id)
                  return (
                    <div key={ca.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-xs text-gray-600 font-mono mt-0.5 flex-shrink-0">{idx + 1}.</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white mb-1">{ca.title}</p>
                          <p className="text-sm text-gray-300 leading-relaxed">{ca.description}</p>
                          {isExpanded && (
                            <div className="mt-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
                              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Proposed wording</p>
                              <p className="text-xs text-gray-300 leading-relaxed font-mono">{ca.proposedWording}</p>
                            </div>
                          )}
                          <button
                            onClick={() => setExpandedActions(prev => {
                              const next = new Set(prev)
                              isExpanded ? next.delete(ca.id) : next.add(ca.id)
                              return next
                            })}
                            className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
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

          {/* Target legislation */}
          {idea.targetLegislation && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Target Legislation</h2>
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{idea.targetLegislation.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{idea.targetLegislation.relevantClauses}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    idea.targetLegislation.changeType === 'AMEND' ? 'bg-amber-900 text-amber-300' :
                    idea.targetLegislation.changeType === 'REPEAL' ? 'bg-red-900 text-red-300' :
                    'bg-green-900 text-green-300'
                  }`}>
                    {idea.targetLegislation.changeType}
                  </span>
                </div>
                <a
                  href={idea.targetLegislation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs text-revolutBlue hover:underline"
                >
                  View on legislation.gov.uk →
                </a>
              </div>
            </div>
          )}

          {/* Endorsements */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Parliamentary Endorsements
              <span className="ml-2 text-gray-600 normal-case font-normal">
                ({idea.endorsements.length} of 3 required for Parliament stage)
              </span>
            </h2>
            {idea.endorsements.length === 0 ? (
              <p className="text-gray-600 text-sm">No endorsements yet.</p>
            ) : (
              <div className="space-y-3">
                {idea.endorsements.map(end => (
                  <div key={end.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{end.name}</p>
                        <p className="text-xs text-gray-500">{end.role} · {end.constituency}</p>
                      </div>
                      <span className="text-xs text-green-400 flex-shrink-0">★ Endorsed</span>
                    </div>
                    {end.publicStatement && (
                      <p className="text-xs text-gray-400 leading-relaxed italic">"{end.publicStatement}"</p>
                    )}
                    <p className="text-xs text-gray-600 mt-2">{end.endorsedAt}</p>
                  </div>
                ))}
              </div>
            )}
            {/* Draftsman certificate placeholder */}
            <div className="mt-4 p-4 bg-gray-900 border border-dashed border-gray-700 rounded-xl">
              <p className="text-xs text-gray-600">Parliamentary Draftsman Certificate — not yet obtained</p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 1: Amendments ── */}
      {activeTab === 1 && (
        <div>
          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 mb-4">
            {['All', 'Pending', 'Accepted', 'Rejected', 'Consulting'].map(f => (
              <button
                key={f}
                onClick={() => setAmendmentFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  amendmentFilter === f
                    ? 'bg-revolutBlue border-revolutBlue text-white'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {f}
              </button>
            ))}
            <div className="flex-1" />
            <Link
              href={`/prototype/propose-amendment/${idea.id}`}
              className="px-4 py-1.5 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Propose Amendment
            </Link>
          </div>

          {filteredAmendments.length === 0 ? (
            <p className="text-gray-500 text-sm">No amendments in this category.</p>
          ) : (
            <div className="space-y-3">
              {filteredAmendments.map(amend => {
                const isExpanded = expandedAmendments.has(amend.id)
                return (
                  <div key={amend.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <Link
                          href={`/prototype/profile/${amend.proposedBy.replace(/\s+/g, '-').toLowerCase()}`}
                          className="text-sm font-medium text-white hover:text-gray-300"
                        >
                          {amend.proposedBy}
                        </Link>
                        <p className="text-xs text-gray-500 mt-0.5">{amend.createdAt}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${amendmentStatusColors[amend.status]}`}>
                        {amend.status}
                      </span>
                    </div>

                    {amend.rationale && (
                      <p className="text-xs text-gray-400 mb-3 leading-relaxed">{amend.rationale}</p>
                    )}

                    <button
                      onClick={() => setExpandedAmendments(prev => {
                        const next = new Set(prev)
                        isExpanded ? next.delete(amend.id) : next.add(amend.id)
                        return next
                      })}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors mb-2"
                    >
                      {isExpanded ? '↑ Hide diff' : '↓ Show diff'}
                    </button>

                    {isExpanded && (
                      <div className="mt-2">
                        <DiffView current={amend.currentWording} proposed={amend.proposedWording} />
                      </div>
                    )}

                    {isOwner && amend.status === 'pending' && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-800">
                        <button className="px-3 py-1.5 bg-green-800 hover:bg-green-700 text-green-200 rounded-lg text-xs font-medium transition-colors">
                          Accept
                        </button>
                        <button className="px-3 py-1.5 bg-amber-900 hover:bg-amber-800 text-amber-300 rounded-lg text-xs font-medium transition-colors">
                          Circulate for Consultation
                        </button>
                        <button className="px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-300 rounded-lg text-xs font-medium transition-colors">
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
          {/* Sort and stance filter */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex gap-1">
              {['All', 'Supportive', 'Critical', 'Neutral', 'Question'].map(s => (
                <button
                  key={s}
                  onClick={() => setStanceFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    stanceFilter === s
                      ? 'bg-revolutBlue border-revolutBlue text-white'
                      : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
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
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-revolutBlue"
            >
              <option value="recent">Most recent</option>
              <option value="helpful">Most helpful</option>
              <option value="critical">Most critical</option>
              <option value="supportive">Most supportive</option>
            </select>
            <button className="px-4 py-1.5 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-xs font-semibold transition-colors">
              Add Comment
            </button>
          </div>

          {filteredComments.length === 0 ? (
            <p className="text-gray-500 text-sm">No comments in this category.</p>
          ) : (
            <div className="space-y-3">
              {filteredComments.map(comment => (
                <div key={comment.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/prototype/profile/${comment.author.replace(/\s+/g, '-').toLowerCase()}`}
                        className="text-sm font-medium text-white hover:text-gray-300"
                      >
                        {comment.author}
                      </Link>
                      {comment.stance && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stanceBadgeColors[comment.stance] ?? 'bg-gray-700 text-gray-300'}`}>
                          {comment.stance.charAt(0).toUpperCase() + comment.stance.slice(1)}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-600 flex-shrink-0">{comment.createdAt}</span>
                  </div>

                  <p className="text-sm text-gray-300 leading-relaxed">{comment.text}</p>

                  {/* Positive flags display */}
                  {comment.positiveFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {comment.positiveFlags.map(f => (
                        <span key={f} className="text-xs px-2 py-0.5 bg-green-900/40 text-green-400 rounded-md">{f.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  )}
                  {comment.negativeFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {comment.negativeFlags.map(f => (
                        <span key={f} className="text-xs px-2 py-0.5 bg-red-900/40 text-red-400 rounded-md">{f.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={() => setRatingOpenFor(ratingOpenFor === comment.id ? null : comment.id)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Rate
                    </button>
                    <button className="text-xs text-gray-600 hover:text-red-400 transition-colors">Report</button>
                    {comment.reported && (
                      <span className="text-xs text-red-600">⚑ Reported</span>
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
          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 mb-4">
            {['All', 'For', 'Against', 'Academic', 'Government', 'News'].map(f => (
              <button
                key={f}
                onClick={() => setResearchFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  researchFilter === f
                    ? 'bg-revolutBlue border-revolutBlue text-white'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {f}
              </button>
            ))}
            <div className="flex-1" />
            <Link
              href={`/prototype/add-research/${idea.id}`}
              className="px-4 py-1.5 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Add Research
            </Link>
          </div>

          {filteredResearch.length === 0 ? (
            <p className="text-gray-500 text-sm">No research in this category.</p>
          ) : (
            <div className="space-y-3">
              {filteredResearch.map(res => (
                <div key={res.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-white">{res.title}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sourceTypeBadge[res.sourceType] ?? 'bg-gray-700 text-gray-300'}`}>
                        {res.sourceType}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${res.forPolicy ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                        {res.forPolicy ? 'Supports' : 'Against'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed mb-2">"{res.snippet}"</p>
                  <p className="text-xs text-gray-500 leading-relaxed mb-3">{res.relevanceExplanation}</p>
                  <a
                    href={res.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-revolutBlue hover:underline"
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
              <h2 className="text-sm font-semibold text-white">Proposed Wording</h2>
              <p className="text-xs text-gray-500 mt-0.5">Version {idea.version}</p>
            </div>
            {idea.wordingLocked ? (
              <span className="text-xs px-2.5 py-1 bg-amber-900 text-amber-300 rounded-full font-medium">
                🔒 Locked — changes require amendment process
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 bg-gray-800 text-gray-400 rounded-full">
                Unlocked
              </span>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
            <p className="text-sm text-gray-200 leading-relaxed">{idea.proposedWording}</p>
          </div>

          {!idea.wordingLocked && isOwner && (
            <button className="px-4 py-2 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 rounded-xl text-sm font-medium transition-colors">
              Edit wording
            </button>
          )}

          {idea.wordingLocked && (
            <div className="p-4 bg-amber-900/20 border border-amber-800 rounded-xl">
              <p className="text-xs text-amber-400">
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
            <p className="text-gray-500 text-sm">No history events yet.</p>
          ) : (
            idea.history.map((event, i) => (
              <div key={event.id} className="flex gap-4 pb-6">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-gray-400">
                      {historyTypeIcons[event.type] ?? historyTypeIcons.default}
                    </span>
                  </div>
                  {i < idea.history.length - 1 && <div className="w-px flex-1 bg-gray-800 mt-1" />}
                </div>
                <div className="pb-2">
                  <p className="text-sm text-white">{event.description}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{event.date}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </main>
  )
}
