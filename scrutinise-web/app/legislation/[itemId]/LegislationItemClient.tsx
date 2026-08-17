'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import PublicNav from '@/components/PublicNav'
import { RepealBadge } from '@/components/RepealBadge'
import type { RepealStatus } from '@/lib/lex/repeal-status'

interface Amendment {
  id: string
  sourceInstrument: string
  effectDate: string | null
  amendmentType: string
  instruction: string
  applied: boolean
}

interface Section {
  id: string
  sectionNumber: string
  sectionTitle: string | null
  compiledText: string | null
  confidence: string | null
  confidenceReason: string | null
  compiledAt: string | null
  compiledBy: string | null
  compilationStatus: string
  needsReview: boolean
  unappliedAmendments: Array<{ sourceInstrument: string; reason: string }> | null
  commencementNote: string | null
  amendments: Amendment[]
}

interface LegislationItem {
  id: string
  title: string
  year: number
  number: number
  legislationType: string
  jurisdiction: string
  legislationGovUkId: string
  sectionCount: number
  compiledSectionCount: number
  sections: Section[]
}

function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null
  const styles: Record<string, string> = {
    HIGH: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
    MEDIUM: 'bg-amber-900/40 text-amber-300 border-amber-700/40',
    LOW: 'bg-red-900/40 text-red-300 border-red-700/40',
  }
  return (
    <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${styles[confidence] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
      {confidence}
    </span>
  )
}

function ProvenanceBanner({
  section,
  legislationGovUkId,
  onSuggestCorrection,
}: {
  section: Section
  legislationGovUkId: string
  onSuggestCorrection: () => void
}) {
  const [amendmentsOpen, setAmendmentsOpen] = useState(false)
  const originUrl = `https://www.legislation.gov.uk/${legislationGovUkId}/section/${section.sectionNumber}`

  return (
    <div className="mt-3 rounded border border-gray-700/50 bg-gray-900/60 p-3 text-xs text-gray-400 space-y-1">
      <div className="flex flex-wrap items-center gap-3">
        <span>⚠️ AI-compiled — not a legal authority</span>
        <a
          href={originUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-400 hover:underline"
        >
          🔗 View original on legislation.gov.uk →
        </a>
        {section.amendments.length > 0 && (
          <button
            onClick={() => setAmendmentsOpen(!amendmentsOpen)}
            className="text-gray-400 hover:text-gray-300"
          >
            🗒 {section.amendments.length} amendment{section.amendments.length !== 1 ? 's' : ''} applied. View history →
          </button>
        )}
        <span className="flex items-center gap-1">
          ✅ Confidence: <ConfidenceBadge confidence={section.confidence} />
        </span>
        <button
          onClick={onSuggestCorrection}
          className="text-teal-400 hover:underline"
        >
          💡 Suggest a correction
        </button>
      </div>

      {section.commencementNote && (
        <p className="text-amber-400">⚠️ {section.commencementNote}</p>
      )}

      {section.confidenceReason && section.confidence !== 'HIGH' && (
        <p className="text-amber-300">Note: {section.confidenceReason}</p>
      )}

      {amendmentsOpen && section.amendments.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-gray-700/50 pt-2">
          <p className="font-medium text-gray-300">Amendment history</p>
          {section.amendments.map(a => (
            <div key={a.id} className="text-gray-500">
              <span className="text-gray-400">{a.sourceInstrument}</span>
              {a.effectDate && <span> ({new Date(a.effectDate).getFullYear()})</span>}
              {' — '}{a.amendmentType}{a.applied ? ' ✓' : ' (not applied)'}
            </div>
          ))}
          {section.unappliedAmendments && section.unappliedAmendments.length > 0 && (
            <div className="mt-1">
              <p className="text-red-400">Unapplied amendments:</p>
              {section.unappliedAmendments.map((u, i) => (
                <p key={i} className="text-red-300/70">{u.sourceInstrument}: {u.reason}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function LegislationItemClient({ item, repealBySection = {} }: {
  item: LegislationItem
  /** SURFACE 1 — keyed on the bare section number. A section absent from this map carries NO
   *  status: the (gid, section_ref) join could not place it, and silence is the honest result. */
  repealBySection?: Record<string, RepealStatus>
}) {
  const { isSignedIn } = useUser()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [correctionSectionId, setCorrectionSectionId] = useState<string | null>(null)

  function toggleSection(id: string) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSuggestCorrection(sectionId: string) {
    if (!isSignedIn) {
      window.location.href = `/sign-in?redirect_url=/legislation/${item.id}`
      return
    }
    setCorrectionSectionId(correctionSectionId === sectionId ? null : sectionId)
  }

  const originUrl = `https://www.legislation.gov.uk/${item.legislationGovUkId}`

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <PublicNav />

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {/* Breadcrumb */}
        <p className="mb-4 text-sm text-gray-500">
          <Link href="/legislation" className="hover:text-gray-300">Legislation</Link>
          {' › '}
          <span>{item.title} {item.year}</span>
        </p>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{item.title} {item.year}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span>{item.legislationType}</span>
            <span>{item.jurisdiction}</span>
            <span>{item.compiledSectionCount} of {item.sectionCount} sections compiled</span>
            <a
              href={originUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-400 hover:underline"
            >
              View on legislation.gov.uk →
            </a>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-amber-800/40 bg-amber-950/30 p-3 text-xs text-amber-300">
          <strong>Research only.</strong> AI-compiled text is not a legal authority.
          Always verify against the{' '}
          <a href={originUrl} target="_blank" rel="noopener noreferrer" className="underline">
            official text on legislation.gov.uk
          </a>.
        </div>

        {item.sections.length === 0 && (
          <div className="py-16 text-center text-gray-400">
            <p>No sections compiled yet.</p>
            <p className="mt-2 text-xs text-gray-600">Run the compilation script to process this Act.</p>
          </div>
        )}

        {/* Sections */}
        <div className="space-y-2">
          {item.sections.map(section => (
            <div key={section.id} className="rounded-lg border border-gray-800 bg-gray-900">
              <button
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-500 w-8">s.{section.sectionNumber}</span>
                  <span className="text-sm font-medium text-gray-200">
                    {section.sectionTitle || `Section ${section.sectionNumber}`}
                  </span>
                  {/* SURFACE 1 — beside the citation, where a reader decides whether to rely on it */}
                  <RepealBadge repeal={repealBySection[section.sectionNumber]} compact />
                  {section.needsReview && (
                    <span className="rounded bg-amber-900/40 border border-amber-700/40 px-1.5 py-0.5 text-xs text-amber-400">
                      Needs review
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <ConfidenceBadge confidence={section.confidence} />
                  <span className="text-xs text-gray-600">{expandedSections.has(section.id) ? '▲' : '▼'}</span>
                </div>
              </button>

              {expandedSections.has(section.id) && (
                <div className="border-t border-gray-800 px-4 pb-4 pt-3">
                  {section.compiledText ? (
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300 font-sans">
                      {section.compiledText}
                    </pre>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No compiled text available.</p>
                  )}

                  <ProvenanceBanner
                    section={section}
                    legislationGovUkId={item.legislationGovUkId}
                    onSuggestCorrection={() => handleSuggestCorrection(section.id)}
                  />

                  {correctionSectionId === section.id && (
                    <CorrectionForm
                      sectionId={section.id}
                      sectionLabel={`s.${section.sectionNumber} ${section.sectionTitle ?? ''}`}
                      onClose={() => setCorrectionSectionId(null)}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CorrectionForm({
  sectionId,
  sectionLabel,
  onClose,
}: {
  sectionId: string
  sectionLabel: string
  onClose: () => void
}) {
  const [description, setDescription] = useState('')
  const [proposedText, setProposedText] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setSubmitting(true)
    try {
      await fetch('/api/legislation/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, description, proposedText, sourceUrl }),
      })
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="mt-4 rounded border border-emerald-700/40 bg-emerald-900/20 p-4 text-sm text-emerald-300">
        Thank you — your correction has been submitted for review.{' '}
        <button onClick={onClose} className="underline">Close</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded border border-gray-700 bg-gray-900/60 p-4">
      <p className="text-xs font-medium text-gray-400">Suggest a correction — {sectionLabel}</p>
      <div>
        <label className="mb-1 block text-xs text-gray-500">Description of the error *</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          required
          className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-teal-600 focus:outline-none"
          placeholder="Describe what is wrong with the compiled text…"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500">Proposed correct text (optional)</label>
        <textarea
          value={proposedText}
          onChange={e => setProposedText(e.target.value)}
          rows={3}
          className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-teal-600 focus:outline-none"
          placeholder="Paste the correct text here…"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500">Source URL (optional)</label>
        <input
          type="url"
          value={sourceUrl}
          onChange={e => setSourceUrl(e.target.value)}
          className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-teal-600 focus:outline-none"
          placeholder="https://www.legislation.gov.uk/…"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !description.trim()}
          className="rounded bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-600 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit correction'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-gray-700 px-4 py-2 text-xs text-gray-400 hover:border-gray-600"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
