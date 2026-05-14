'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { ChevronDown, ChevronRight } from 'lucide-react'
import PublicNav from '@/components/PublicNav'
import { MOCK_TRAINING, Stage } from '@/lib/mockData'
import { FAQ_MARKDOWN } from '@/lib/faq-content'

// ─── FAQ Parsing ─────────────────────────────────────────────────────────────

interface FaqQuestion { question: string; answer: string }
interface FaqSection { title: string; body: string; questions: FaqQuestion[] }

function parseFaq(md: string): FaqSection[] {
  const parts = md.split(/^## /m).slice(1)
  return parts.map(part => {
    const nlIdx = part.indexOf('\n')
    const title = part.slice(0, nlIdx).trim()
    const rest = part.slice(nlIdx + 1)
    const qParts = rest.split(/^### /m)
    if (qParts.length === 1) {
      return { title, body: cleanText(qParts[0]), questions: [] }
    }
    const body = cleanText(qParts[0])
    const questions = qParts.slice(1).map(q => {
      const qNl = q.indexOf('\n')
      return {
        question: q.slice(0, qNl).trim(),
        answer: cleanText(q.slice(qNl + 1)),
      }
    })
    return { title, body, questions }
  })
}

function cleanText(text: string): string {
  return text.replace(/\n\*\*\*\n?/g, '').trim()
}

function renderMdText(text: string) {
  const paras = text.split(/\n\n+/).filter(p => p.trim())
  return paras.map((para, i) => {
    const lines = para.split('\n').filter(l => l.trim())
    if (lines.length > 0 && lines.every(l => /^-\s+/.test(l.trim()))) {
      return (
        <ul key={i} className="list-disc list-inside space-y-1 pl-1">
          {lines.map((l, j) => (
            <li key={j} className="text-sm text-muted-foreground">
              <span dangerouslySetInnerHTML={{ __html: l.replace(/^-\s+/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </li>
          ))}
        </ul>
      )
    }
    if (lines.some(l => /^\d+\./.test(l.trim()))) {
      return (
        <ol key={i} className="list-decimal list-inside space-y-1 pl-1">
          {lines.map((l, j) => (
            <li key={j} className="text-sm text-muted-foreground">
              <span dangerouslySetInnerHTML={{ __html: l.replace(/^\d+\.\s+/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </li>
          ))}
        </ol>
      )
    }
    return (
      <p
        key={i}
        className="text-sm leading-relaxed text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: para.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
      />
    )
  })
}

const FAQ_SECTIONS = parseFaq(FAQ_MARKDOWN)

// ─── Training tab helpers ─────────────────────────────────────────────────────

type StageFilter = Stage | 'All'
type DifficultyFilter = 'All' | 'Beginner' | 'Intermediate' | 'Advanced'
type TypeFilter = 'All' | 'VIDEO' | 'ARTICLE'

const stageBadgeColors: Partial<Record<Stage | string, string>> = {
  All: 'bg-muted text-muted-foreground',
  Create: 'bg-muted text-muted-foreground',
  Draft: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Develop: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Campaign: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Legislate: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
}

const difficultyColors: Record<string, string> = {
  Beginner: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Intermediate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Advanced: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

// ─── Main component ───────────────────────────────────────────────────────────

const VALID_TABS = ['training', 'faqs', 'feedback'] as const
type Tab = typeof VALID_TABS[number]

export default function SupportPage() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab | null
  const [activeTab, setActiveTab] = useState<Tab>(
    VALID_TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'training'
  )

  const tabs: { key: Tab; label: string }[] = [
    { key: 'training', label: 'Training' },
    { key: 'faqs', label: 'FAQs' },
    { key: 'feedback', label: 'Feedback' },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold tracking-tight mt-4">Support</h1>
          <p className="text-muted-foreground text-base mt-2">
            Training resources, FAQs, and a way to reach us directly.
          </p>
        </div>

        {/* Tab bar */}
        <div className="border-b border-border mb-8">
          <div className="flex gap-0">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  activeTab === tab.key
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'training' && <TrainingTab />}
        {activeTab === 'faqs' && <FaqsTab />}
        {activeTab === 'feedback' && <FeedbackTab />}
      </div>
    </div>
  )
}

// ─── Training tab ─────────────────────────────────────────────────────────────

function TrainingTab() {
  const [stageFilter, setStageFilter] = useState<StageFilter>('All')
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('All')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All')
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null)

  const filtered = MOCK_TRAINING.filter(r => {
    const stageMatch = stageFilter === 'All' || r.stageTag === stageFilter || r.stageTag === 'All'
    const diffMatch = difficultyFilter === 'All' || r.difficultyTag === difficultyFilter
    const typeMatch = typeFilter === 'All' || r.resourceType === typeFilter
    return stageMatch && diffMatch && typeMatch
  })

  const stages: StageFilter[] = ['All', 'Create', 'Draft', 'Develop', 'Campaign', 'Legislate']
  const difficulties: DifficultyFilter[] = ['All', 'Beginner', 'Intermediate', 'Advanced']
  const types: TypeFilter[] = ['All', 'VIDEO', 'ARTICLE']

  return (
    <>
      <div className="space-y-3 mb-8">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground mr-1">Stage:</span>
          {stages.map(s => (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                stageFilter === s
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-border text-foreground hover:bg-accent'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Difficulty:</span>
            {difficulties.map(d => (
              <button
                key={d}
                onClick={() => setDifficultyFilter(d)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  difficultyFilter === d
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border text-foreground hover:bg-accent'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Type:</span>
            {types.map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  typeFilter === t
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border text-foreground hover:bg-accent'
                }`}
              >
                {t === 'VIDEO' ? 'Video' : t === 'ARTICLE' ? 'Article' : t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        {filtered.length} resource{filtered.length !== 1 ? 's' : ''}
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No resources match your filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(resource => (
            <div
              key={resource.id}
              className="bg-card border border-border rounded-lg p-5 hover:border-foreground/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${resource.resourceType === 'VIDEO' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-muted text-muted-foreground'}`}>
                      {resource.resourceType === 'VIDEO' ? '▶ Video' : '📄 Article'}
                    </span>
                    {resource.stageTag !== 'All' && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageBadgeColors[resource.stageTag] ?? 'bg-muted text-muted-foreground'}`}>
                        {resource.stageTag}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyColors[resource.difficultyTag]}`}>
                      {resource.difficultyTag}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-foreground mb-1">{resource.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {resource.author} · {resource.duration} · {resource.topicTag}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {resource.resourceType === 'VIDEO' ? (
                    <button
                      onClick={() => setExpandedVideo(expandedVideo === resource.id ? null : resource.id)}
                      className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-semibold transition-colors"
                    >
                      {expandedVideo === resource.id ? '✕ Close' : '▶ Watch'}
                    </button>
                  ) : (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 border border-border text-foreground hover:bg-accent rounded-md text-sm font-medium transition-colors inline-block"
                    >
                      Read →
                    </a>
                  )}
                </div>
              </div>
              {resource.resourceType === 'VIDEO' && expandedVideo === resource.id && (
                <div className="mt-4">
                  <iframe
                    src={resource.url}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full aspect-video rounded-lg"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ─── FAQs tab ─────────────────────────────────────────────────────────────────

function FaqsTab() {
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]))
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set())

  function toggleSection(idx: number) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function toggleQuestion(key: string) {
    setOpenQuestions(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {FAQ_SECTIONS.map((section, si) => {
        const isOpen = openSections.has(si)
        return (
          <div key={si} className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection(si)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-accent/50 transition-colors"
            >
              <span className="font-semibold text-sm text-foreground">{section.title}</span>
              {isOpen
                ? <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                : <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              }
            </button>

            {isOpen && (
              <div className="px-5 pb-5 border-t border-border">
                {section.body && (
                  <div className="pt-4 space-y-3">
                    {renderMdText(section.body)}
                  </div>
                )}
                {section.questions.length > 0 && (
                  <div className="pt-3 space-y-1">
                    {section.questions.map((q, qi) => {
                      const qKey = `${si}-${qi}`
                      const qOpen = openQuestions.has(qKey)
                      return (
                        <div key={qi} className="border-t border-border/60 first:border-t-0">
                          <button
                            onClick={() => toggleQuestion(qKey)}
                            className="w-full flex items-center justify-between py-3 text-left group"
                          >
                            <span className="text-sm font-medium text-foreground group-hover:text-foreground/80 pr-4">
                              {q.question}
                            </span>
                            {qOpen
                              ? <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                              : <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                            }
                          </button>
                          {qOpen && (
                            <div className="pb-3 space-y-2">
                              {renderMdText(q.answer)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Feedback tab ─────────────────────────────────────────────────────────────

const FEEDBACK_TYPES = [
  { value: 'feature', label: 'Feature suggestion' },
  { value: 'bug', label: 'Bug or problem' },
  { value: 'general', label: 'General comment' },
  { value: 'support', label: 'I need help with my account' },
]

function FeedbackTab() {
  const { isLoaded, isSignedIn, user } = useUser()
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? ''

  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [feedbackType, setFeedbackType] = useState('')
  const [anonEmail, setAnonEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const email = isSignedIn ? userEmail : anonEmail

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          message,
          feedbackType: feedbackType || undefined,
          email,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Please try again.')
      } else {
        setIsSuccess(true)
      }
    } catch {
      setError('Could not send feedback. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="max-w-lg py-8">
        <p className="text-base font-medium text-foreground">Thanks — we've received your feedback. We read every one.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <p className="text-sm text-muted-foreground mb-6">
        Tell us what's working, what isn't, or what you'd like to see. We read every submission.
      </p>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
          {isLoaded && isSignedIn ? (
            <input
              type="email"
              value={userEmail}
              readOnly
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted text-muted-foreground cursor-not-allowed"
            />
          ) : (
            <input
              type="email"
              required
              value={anonEmail}
              onChange={e => setAnonEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          )}
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Type <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <select
            value={feedbackType}
            onChange={e => setFeedbackType(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Select a type…</option>
            {FEEDBACK_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Subject</label>
          <input
            type="text"
            required
            maxLength={200}
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Brief description…"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Message</label>
          <textarea
            required
            maxLength={5000}
            rows={6}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Tell us more…"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Sending…' : 'Send feedback'}
        </button>
      </form>
    </div>
  )
}
