'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Circle, AlertCircle, Copy } from 'lucide-react'
import VoteWidget from '@/components/VoteWidget'
import QualityRating from '@/components/QualityRating'
import VoteInterceptModal from '@/components/VoteInterceptModal'
import ContributionsTab from './ContributionsTab'
import ResearchTab, { type ResearchItem } from './ResearchTab'
import AmendmentsTab from './AmendmentsTab'
import CampaignTab from './CampaignTab'
import DocumentExports from '@/components/documents/DocumentExports'
import CollapsedSection from '@/components/lex/CollapsedSection'
import WhatNextPanel from '@/components/WhatNextPanel'
import StatsTab from './StatsTab'
import DeleteIdeaDialog from '@/components/lex/DeleteIdeaDialog'
// 26-J §1 — the Overview reads the SAME live state the editor does. `type` imports are
// erased at build time (docs/CLAUDE.md §28) — CanonicalState itself is assembled only in
// lib/lex/state.ts (server-only); this component just types the already-fetched object.
import type { CanonicalState, CanonicalField, CanonicalPage } from '@/lib/lex/page1-config'
import { SLOT_LABELS } from '@/lib/lex/page2-config'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DiagnosisRecord {
  id: string
  diagnosisTitle: string | null
  text: string | null
  obstacleDefined: string | null
  whoAffected: string | null
  howAffected: string | null
  whyPersisted: string | null
  impactDescription: string | null
  impactCost: string | null
  createdAt: string
  updatedAt: string
}

interface RootCauseRecord {
  id: string
  rootCauseTitle: string | null
  text: string | null
  rootCauseMechanism: string | null
  whyNotSolved: string | null
  incentiveDrivers: string | null
  structureDrivers: string | null
  createdAt: string
}

interface GuidingPolicyRecord {
  id: string
  guidingPolicyTitle: string | null
  text: string | null
  coreTheory: string | null
  mechanismTypes: string[] | null
  tradeOffs: string | null
  competitiveIdeaAnalysis: string | null
  createdAt: string
}

interface EvidenceRecord {
  id: string
  title: string
  description: string
  comparablePolicy: string | null
  successFailure: string | null
  whatWorked: string | null
  whatFailed: string | null
  resultCauses: string | null
  sourceUrl: string | null
  sourceType: string
  createdAt: string
}

interface CoherentAction {
  id: string
  title: string
  summarySnippet: string | null
  detailedDescription: string | null
  actionType: string | null
  practicalExecution: string | null
  implementationPlan: string | null
  keyRisks: string | null
  costBenefitAnalysis: string | null
  orderIndex: number
  createdAt: string
  updatedAt: string
}

interface Collaborator {
  id: string
  userId: string
  role: string
  user: { id: string; name: string; username: string }
}

interface Idea {
  id: string
  title: string
  summaryDescription: string
  summaryDiagnosis: string | null
  summaryGuidingPolicy: string | null
  summaryCoherentActions: string | null
  backgroundResearch: string | null
  stage: string
  visibility: string
  govtArea: string
  ideaType: string
  diagnosis: string | null
  guidingPolicy: string | null
  rootCause: string | null
  whoAffected: string | null
  ideaOrigin: string
  bannerColour: string | null
  bannerText: string | null
  commentCount: number
  referralLinkActive: boolean
  createdAt: string
  creator: {
    id: string
    name: string
    username: string
    referralCode: string
    credibilityScore: { totalScore: string | null; phase: string } | null
  }
  coherentActions: CoherentAction[]
  research: ResearchItem[]
  collaborators: Collaborator[]
  diagnoses: DiagnosisRecord[]
  rootCauses: RootCauseRecord[]
  guidingPolicies: GuidingPolicyRecord[]
  evidence: EvidenceRecord[]
}

interface Stage4Gate {
  mpCount: number
  peerCount: number
  draftsmanCount: number
  wordingComplete: boolean
}

interface Props {
  idea: Idea
  /** 26-C addendum 3 §23d — whether a terminal build exists (DONE/FAILED/CANCELLED),
   *  the same criterion /ideas/build and /ideas/create's own gates use. */
  hasBuild: boolean
  isOwner: boolean
  isCollaborator: boolean
  currentUserId: string | null
  currentUserReferralCode: string | null
  currentUserCanEndorse: boolean
  ideaReviewCount: number
  avgQualityRating: number
  stage4GateData: Stage4Gate | null
  /** 26-J §1 — the live kernel state (`lib/lex/state.ts`'s `computeCanonicalState`), the
   *  same object the editor's FieldsPanel renders. Null only if the read failed. */
  canonicalState: CanonicalState | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage config
// ─────────────────────────────────────────────────────────────────────────────

const STAGES = [
  { key: 'STAGE_1', label: 'Create' },
  { key: 'STAGE_2', label: 'Draft' },
  { key: 'STAGE_3', label: 'Develop' },
  { key: 'STAGE_4', label: 'Campaign' },
  { key: 'STAGE_5', label: 'Legislate' },
] as const

const STAGE_BADGE: Record<string, string> = {
  STAGE_1: 'bg-slate-100 text-slate-700',
  STAGE_2: 'bg-blue-100 text-blue-700',
  STAGE_3: 'bg-amber-100 text-amber-700',
  STAGE_4: 'bg-green-100 text-green-700',
  STAGE_5: 'bg-purple-100 text-purple-700',
  ARCHIVED: 'bg-neutral-100 text-neutral-600',
  WITHDRAWN: 'bg-red-100 text-red-600',
}

// ─────────────────────────────────────────────────────────────────────────────
// ⚠⚠ 26-C ADDENDUM 3 §24a — THE FIVE-TILE STAGE STEPPER STOOD HERE AND IS REMOVED.
// "It does not belong on this page." `STAGES` (above) is kept — the single-stage badge
// in the header and the metadata column both still read from it.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// IdeaOrigin banner
// ─────────────────────────────────────────────────────────────────────────────

const ORIGIN_DEFAULTS: Record<string, { colour: string; text: string }> = {
  HISTORICAL_EXAMPLE: {
    colour: '#F97316',
    text: 'This idea has been created by the Scrutinise team as a historical case study. It represents real legislation that reached the statute book through civil society advocacy. It is presented here to show how that process might have looked on Scrutinise.',
  },
  EDITORIAL_SEED: {
    colour: '#3B82F6',
    text: 'This idea was created by the Scrutinise team as an example of a live policy debate. It is open for development — contributions, research, and amendments are welcome.',
  },
}

function IdeaOriginBanner({ idea }: { idea: Idea }) {
  if (idea.ideaOrigin === 'USER') return null
  const defaults = ORIGIN_DEFAULTS[idea.ideaOrigin]
  if (!defaults) return null
  const colour = idea.bannerColour ?? defaults.colour
  const text = idea.bannerText ?? defaults.text

  return (
    <div
      style={{
        backgroundColor: colour + '26', // 15% opacity
        borderLeft: `3px solid ${colour}`,
        color: colour,
      }}
      className="mb-6 flex items-start gap-3 px-4 py-3"
      role="note"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="mt-0.5 size-5 shrink-0"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
          clipRule="evenodd"
        />
      </svg>
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2→3 gate checklist
// ─────────────────────────────────────────────────────────────────────────────

function Stage2GateCard({ idea, onTakePublic }: { idea: Idea; onTakePublic: () => void }) {
  const checks = [
    { label: 'Problem / diagnosis completed', met: !!idea.diagnosis?.trim() },
    { label: 'Guiding policy completed', met: !!idea.guidingPolicy?.trim() },
    { label: 'At least 1 Coherent Action added', met: idea.coherentActions.length >= 1 || !!idea.summaryCoherentActions?.trim() },
    {
      label: `Research: ${idea.research.length}/3 items added`,
      met: idea.research.length >= 3,
    },
  ]

  const allMet = checks.every(c => c.met)

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Requirements to Take Public</CardTitle>
          {allMet && (
            <Button size="sm" onClick={onTakePublic}>
              Take Public →
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Left: requirements list */}
          <div className="flex-1">
            <ul className="space-y-2">
              {checks.map(check => (
                <li key={check.label} className="flex items-center gap-2 text-sm">
                  {check.met ? (
                    <CheckCircle2 className="size-4 shrink-0 text-green-600" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-muted-foreground/40" />
                  )}
                  <span className={check.met ? 'text-foreground' : 'text-muted-foreground'}>
                    {check.label}
                  </span>
                </li>
              ))}
            </ul>
            {!allMet && (
              <p className="mt-3 text-xs text-muted-foreground">
                Complete all requirements above to unlock Take Public.
              </p>
            )}
          </div>
          {/* Right: status info chips */}
          <div className="flex flex-col gap-2 sm:min-w-[210px] sm:border-l sm:pl-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600">
              🗳 Voting opens at Campaign stage
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600">
              📦 Campaign in a Box available on idea completion
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Take Public modal
// ─────────────────────────────────────────────────────────────────────────────

function TakePublicModal({
  ideaId,
  onClose,
  onSuccess,
}: {
  ideaId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStage: 'STAGE_3' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      onSuccess()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <div>
            <h2 className="font-semibold">Take this idea public?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This will advance your idea to the <strong>Develop</strong> stage and make it
              visible to anyone with the link. Anyone will be able to read the full idea and
              leave Contributions.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              This action <strong>cannot be undone</strong> — once public, the idea cannot
              be made private again.
            </p>
            {error && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-3">
              <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirm} disabled={loading}>
                {loading ? 'Taking public…' : 'Yes, take public'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 3→4 gate checklist
// ─────────────────────────────────────────────────────────────────────────────

function Stage3GateCard({
  reviewCount,
  avgQualityRating,
}: {
  reviewCount: number
  avgQualityRating: number
}) {
  const checks = [
    {
      label: `Reviews: ${reviewCount} / 12 unique visitors`,
      met: reviewCount >= 12,
    },
    {
      label: `Quality rating: ${avgQualityRating.toFixed(1)} / 2.5 required`,
      met: avgQualityRating >= 2.5,
    },
  ]

  const allMet = checks.every(c => c.met)

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm">Requirements to Begin Campaign</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <ul className="space-y-2">
          {checks.map(check => (
            <li key={check.label} className="flex items-center gap-2 text-sm">
              {check.met ? (
                <CheckCircle2 className="size-4 shrink-0 text-green-600" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground/40" />
              )}
              <span className={check.met ? 'text-foreground' : 'text-muted-foreground'}>
                {check.label}
              </span>
            </li>
          ))}
        </ul>
        {allMet && (
          <p className="mt-3 text-xs text-green-700">
            All requirements met — you can begin your campaign.
          </p>
        )}
        {!allMet && (
          <p className="mt-3 text-xs text-muted-foreground">
            Share your referral link to bring in more reviewers.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Begin Campaign modal
// ─────────────────────────────────────────────────────────────────────────────

function BeginCampaignModal({
  ideaId,
  onClose,
  onSuccess,
}: {
  ideaId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStage: 'STAGE_4' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      onSuccess()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <div>
            <h2 className="font-semibold">Begin your campaign?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This will advance your idea to the <strong>Campaign</strong> stage and list it
              publicly on the platform. Voting will open and anyone will be able to vote for or
              against your idea.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              This action <strong>cannot be undone</strong>.
            </p>
            {error && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-3">
              <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirm} disabled={loading}>
                {loading ? 'Beginning campaign…' : 'Yes, begin campaign'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 4→5 gate checklist
// ─────────────────────────────────────────────────────────────────────────────

function Stage4GateCard({ gate }: { gate: Stage4Gate }) {
  const checks = [
    {
      label: `MP endorsements: ${gate.mpCount} / 3 required`,
      met: gate.mpCount >= 3,
    },
    {
      label: `Peer endorsements: ${gate.peerCount} / 3 required`,
      met: gate.peerCount >= 3,
    },
    {
      label: 'Parliamentary Draftsman endorsement',
      met: gate.draftsmanCount >= 1,
    },
    {
      label: 'All proposed wording fields completed',
      met: gate.wordingComplete,
    },
  ]

  const allMet = checks.every(c => c.met)

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm">Requirements to Submit to Parliament</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <ul className="space-y-2">
          {checks.map(check => (
            <li key={check.label} className="flex items-center gap-2 text-sm">
              {check.met ? (
                <CheckCircle2 className="size-4 shrink-0 text-green-600" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground/40" />
              )}
              <span className={check.met ? 'text-foreground' : 'text-muted-foreground'}>
                {check.label}
              </span>
            </li>
          ))}
        </ul>
        {allMet && (
          <p className="mt-3 text-xs text-green-700">
            All requirements met — you can submit this idea to Parliament.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Submit to Parliament modal
// ─────────────────────────────────────────────────────────────────────────────

function SubmitToParliamentModal({
  ideaId,
  onClose,
  onSuccess,
}: {
  ideaId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStage: 'STAGE_5' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      onSuccess()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <div>
            <h2 className="font-semibold">Submit to Parliament?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This will advance your idea to the <strong>Legislate</strong> stage and formally
              submit it for Parliamentary consideration. All endorsers and followers will be
              notified.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              This action <strong>cannot be undone</strong>.
            </p>
            {error && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-3">
              <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirm} disabled={loading}>
                {loading ? 'Submitting…' : 'Yes, submit to Parliament'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Endorsement panel — Stage 4+ — shown above Overview content
// ─────────────────────────────────────────────────────────────────────────────

interface EndorsementRecord {
  id: string
  endorserRole: string
  displayTitle: string | null
  publicStatement: string | null
  endorsedAt: string
  user: { id: string; name: string; username: string }
}

interface DraftsmanRecord {
  id: string
  draftsmanName: string | null
  organisation: string | null
  publicStatement: string
  draftsmanCredentials: string
  certifiedAt: string
  draftsman: { id: string; name: string; username: string } | null
}

function EndorsementPanel({
  ideaId,
  stage,
  canEndorse,
  currentUserId,
  isOwner,
}: {
  ideaId: string
  stage: string
  canEndorse: boolean
  currentUserId: string | null
  isOwner: boolean
}) {
  const [endorsements, setEndorsements] = useState<EndorsementRecord[]>([])
  const [draftsman, setDraftsman] = useState<DraftsmanRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [endorsing, setEndorsing] = useState(false)
  const [endorseError, setEndorseError] = useState<string | null>(null)
  const [hasEndorsed, setHasEndorsed] = useState(false)
  const [markedBelowStandard, setMarkedBelowStandard] = useState(false)
  // Draftsman form state
  const [showDraftsmanForm, setShowDraftsmanForm] = useState(false)
  const [draftsmanForm, setDraftsmanForm] = useState({ draftsmanName: '', organisation: '', qualifications: '', statement: '' })
  const [draftsmanSubmitting, setDraftsmanSubmitting] = useState(false)
  const [draftsmanError, setDraftsmanError] = useState<string | null>(null)

  const allowedStages = ['STAGE_4', 'STAGE_5']
  const isAllowed = allowedStages.includes(stage)

  useEffect(() => {
    if (!isAllowed || loaded) return
    fetch(`/api/ideas/${ideaId}/endorsements`)
      .then(r => r.json())
      .then(data => {
        setEndorsements(data.endorsements ?? [])
        setDraftsman(data.draftsmanEndorsements ?? [])
        if (currentUserId) {
          setHasEndorsed((data.endorsements ?? []).some((e: EndorsementRecord) => e.user.id === currentUserId))
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [ideaId, loaded, currentUserId, isAllowed])

  if (!isAllowed) return null

  async function handleEndorse() {
    setEndorsing(true)
    setEndorseError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/endorsements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        setEndorseError(data.error ?? 'Something went wrong')
        return
      }
      setEndorsements(prev => [...prev, data])
      setHasEndorsed(true)
    } catch {
      setEndorseError('Network error')
    } finally {
      setEndorsing(false)
    }
  }

  async function handleBelowStandard() {
    setEndorsing(true)
    setEndorseError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/endorsements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'BELOW_STANDARD' }),
      })
      if (res.ok) {
        setMarkedBelowStandard(true)
      } else {
        const data = await res.json()
        setEndorseError(data.error ?? 'Something went wrong')
      }
    } catch {
      setEndorseError('Network error')
    } finally {
      setEndorsing(false)
    }
  }

  async function handleDraftsmanSubmit(e: React.FormEvent) {
    e.preventDefault()
    setDraftsmanSubmitting(true)
    setDraftsmanError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/endorsements/draftsman`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftsmanForm),
      })
      const data = await res.json()
      if (!res.ok) {
        setDraftsmanError(data.error ?? 'Something went wrong')
        return
      }
      setDraftsman(prev => [...prev, data])
      setShowDraftsmanForm(false)
    } catch {
      setDraftsmanError('Network error')
    } finally {
      setDraftsmanSubmitting(false)
    }
  }

  const mpEndorsements = endorsements.filter(e => e.endorserRole === 'MP')
  const peerEndorsements = endorsements.filter(e => e.endorserRole === 'PEER')

  return (
    <div className="mb-6 space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Endorsements</h3>
        {canEndorse && currentUserId && !hasEndorsed && !markedBelowStandard && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleEndorse} disabled={endorsing}>
              Endorse
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50"
              onClick={handleBelowStandard}
              disabled={endorsing}
            >
              Below Standard
            </Button>
          </div>
        )}
        {hasEndorsed && (
          <span className="text-xs text-green-700 font-medium">You have endorsed this idea</span>
        )}
        {markedBelowStandard && (
          <span className="text-xs text-muted-foreground">Marked below standard</span>
        )}
      </div>

      {endorseError && (
        <p className="text-xs text-destructive">{endorseError}</p>
      )}

      {endorsements.length === 0 && draftsman.length === 0 && loaded && (
        <p className="text-xs text-muted-foreground">No endorsements yet.</p>
      )}

      {mpEndorsements.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            MPs ({mpEndorsements.length})
          </p>
          <div className="space-y-2">
            {mpEndorsements.map(e => (
              <div key={e.id} className="rounded-md border bg-muted/20 p-3">
                <p className="text-sm font-medium">
                  {e.displayTitle ? `${e.displayTitle} ` : ''}{e.user.name}
                </p>
                {e.publicStatement && (
                  <p className="mt-1 text-xs text-muted-foreground">&ldquo;{e.publicStatement}&rdquo;</p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(e.endorsedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {peerEndorsements.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Peers ({peerEndorsements.length})
          </p>
          <div className="space-y-2">
            {peerEndorsements.map(e => (
              <div key={e.id} className="rounded-md border bg-muted/20 p-3">
                <p className="text-sm font-medium">
                  {e.displayTitle ? `${e.displayTitle} ` : ''}{e.user.name}
                </p>
                {e.publicStatement && (
                  <p className="mt-1 text-xs text-muted-foreground">&ldquo;{e.publicStatement}&rdquo;</p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(e.endorsedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {draftsman.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Parliamentary Draftsman
          </p>
          <div className="space-y-2">
            {draftsman.map(d => (
              <div key={d.id} className="rounded-md border bg-muted/20 p-3">
                <p className="text-sm font-medium">{d.draftsmanName ?? d.draftsman?.name ?? 'Draftsman'}</p>
                {d.organisation && (
                  <p className="text-xs text-muted-foreground">{d.organisation}</p>
                )}
                <p className="text-xs text-muted-foreground">{d.draftsmanCredentials}</p>
                <p className="mt-1 text-xs text-muted-foreground">&ldquo;{d.publicStatement}&rdquo;</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(d.certifiedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Draftsman form — owner only, Stage 4+, hidden once submitted */}
      {isOwner && draftsman.length === 0 && ['STAGE_4', 'STAGE_5'].includes(stage) && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Parliamentary Draftsman
          </p>
          {!showDraftsmanForm ? (
            <button
              onClick={() => setShowDraftsmanForm(true)}
              className="w-full rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
            >
              + Add Parliamentary Draftsman endorsement
            </button>
          ) : (
            <form onSubmit={handleDraftsmanSubmit} className="space-y-3 rounded-md border p-3">
              <p className="text-xs font-medium">Parliamentary Draftsman details</p>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Draftsman name *</label>
                <input
                  required
                  value={draftsmanForm.draftsmanName}
                  onChange={e => setDraftsmanForm(f => ({ ...f, draftsmanName: e.target.value }))}
                  placeholder="Full name"
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Organisation *</label>
                <input
                  required
                  value={draftsmanForm.organisation}
                  onChange={e => setDraftsmanForm(f => ({ ...f, organisation: e.target.value }))}
                  placeholder="Firm, chambers, or body"
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Qualifications *</label>
                <input
                  required
                  value={draftsmanForm.qualifications}
                  onChange={e => setDraftsmanForm(f => ({ ...f, qualifications: e.target.value }))}
                  placeholder="Professional qualifications and credentials"
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Public statement *</label>
                <textarea
                  required
                  rows={3}
                  value={draftsmanForm.statement}
                  onChange={e => setDraftsmanForm(f => ({ ...f, statement: e.target.value }))}
                  placeholder="The draftsman's endorsement statement"
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              {draftsmanError && (
                <p className="text-xs text-destructive">{draftsmanError}</p>
              )}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={draftsmanSubmitting}>
                  {draftsmanSubmitting ? 'Submitting…' : 'Submit'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowDraftsmanForm(false); setDraftsmanError(null) }}
                  disabled={draftsmanSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab components
// ─────────────────────────────────────────────────────────────────────────────

// ── Inline field display with optional edit ───────────────────────────────────

function FieldDisplay({
  label,
  value,
  placeholder,
  canEdit,
  fieldKey,
  ideaId,
  onSaved,
  multiline = true,
}: {
  label: string
  value: string | null | undefined
  placeholder: string
  canEdit: boolean
  fieldKey: string
  ideaId: string
  onSaved?: (newValue: string) => void
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/field-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldKey, value: editValue }),
      })
      if (res.ok) {
        setEditing(false)
        onSaved?.(editValue)
      }
    } finally {
      setSaving(false)
    }
  }

  const displayValue = value ?? null

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
        {canEdit && !editing && (
          <button
            onClick={() => { setEditValue(displayValue ?? ''); setEditing(true) }}
            className="text-zinc-300 hover:text-zinc-500 transition-colors"
            title={`Edit ${label}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
      </div>
      {editing ? (
        <div>
          {multiline ? (
            <textarea
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              rows={4}
              autoFocus
              className="w-full text-sm border border-zinc-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
            />
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              autoFocus
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
            />
          )}
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : displayValue ? (
        <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">{displayValue}</p>
      ) : (
        <p className="text-sm text-zinc-400 italic">{placeholder}</p>
      )}
    </div>
  )
}

// ── Idea tab with 4 sub-tabs ──────────────────────────────────────────────────

type IdeaSubTab = 'overview' | 'diagnosis' | 'policy' | 'actions'

/** 26-J §1 — "N of M approved", the SAME arithmetic FieldsPanel.tsx uses on the editor
 *  (status ACCEPTED or SKIPPED counts as done). Computed here, not stored, for the same
 *  reason the editor never stores it: it can never go stale against the rows. */
function pageProgress(page: CanonicalPage | undefined): { done: number; total: number } {
  if (!page) return { done: 0, total: 0 }
  const done = page.fields.filter((f) => f.status === 'ACCEPTED' || f.status === 'SKIPPED').length
  return { done, total: page.fields.length }
}

/** A field whose content lives in a child table, not in the field's own `value` — the
 *  same `CHILD_ENTITY_FIELDS` set page1-config.ts defines, restated read-only here since
 *  each needs a different array off `canonicalState`. */
function CanonicalFieldBlock({ field, canonicalState }: { field: CanonicalField; canonicalState: CanonicalState }) {
  if (field.key === 'causes') {
    if (!canonicalState.diagnosisCauses.length) {
      return <p className="text-sm text-zinc-400 italic">Not yet completed</p>
    }
    return (
      <ul className="space-y-1.5">
        {canonicalState.diagnosisCauses.map((c) => (
          <li key={c.id} className="text-sm text-zinc-800">
            {c.isRootCause && <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Root —</span>}
            {c.cause}
          </li>
        ))}
      </ul>
    )
  }
  if (field.key === 'rootCause') {
    const root = canonicalState.diagnosisCauses.find((c) => c.isRootCause)
    return root
      ? <p className="text-sm text-zinc-800">{root.cause}</p>
      : <p className="text-sm text-zinc-400 italic">Not yet completed</p>
  }
  if (field.key === 'policyOptions') {
    const live = canonicalState.policyOptions.filter((o) => o.status !== 'RULED_OUT')
    if (!live.length) return <p className="text-sm text-zinc-400 italic">Not yet completed</p>
    return (
      <ul className="space-y-1.5">
        {live.map((o) => (
          <li key={o.id} className="text-sm text-zinc-800">
            {o.approach}
            {o.status === 'CHOSEN' && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Chosen</span>}
          </li>
        ))}
      </ul>
    )
  }
  if (field.key === 'chosenApproach') {
    const chosen = canonicalState.policyOptions.find((o) => o.status === 'CHOSEN')
    return chosen
      ? <p className="text-sm text-zinc-800">{chosen.approach}</p>
      : <p className="text-sm text-zinc-400 italic">Not yet completed</p>
  }
  if (field.key === 'actions') {
    if (!canonicalState.actions.length) return <p className="text-sm text-zinc-400 italic">Not yet completed</p>
    return (
      <ul className="space-y-1.5">
        {canonicalState.actions.map((a) => (
          <li key={a.id} className="text-sm text-zinc-800">{a.practicalStep}</li>
        ))}
      </ul>
    )
  }

  // Ordinary fields: text/narrative/inferred render the value as prose; structured
  // fields render one line per named slot (page2/page3's own SLOT_LABELS).
  if (field.status === 'EMPTY' || field.value == null || field.value === '') {
    return <p className="text-sm text-zinc-400 italic">Not yet completed</p>
  }
  if (field.type === 'structured' && typeof field.value === 'object') {
    const entries = Object.entries(field.value as Record<string, unknown>).filter(([, v]) => v != null && v !== '')
    if (!entries.length) return <p className="text-sm text-zinc-400 italic">Not yet completed</p>
    return (
      <dl className="space-y-1">
        {entries.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">{SLOT_LABELS[k] ?? k}</dt>
            <dd className="text-sm text-zinc-800">{String(v)}</dd>
          </div>
        ))}
      </dl>
    )
  }
  if (Array.isArray(field.value)) {
    return (
      <ul className="list-disc pl-5 space-y-1">
        {field.value.map((v, i) => <li key={i} className="text-sm text-zinc-800">{typeof v === 'string' ? v : JSON.stringify(v)}</li>)}
      </ul>
    )
  }
  return <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">{String(field.value)}</p>
}

/**
 * ⚠ 26-J §1c — SOME IDEAS' ONLY REAL CONTENT IS IN THE ABANDONED TABLES.
 *
 * A production check (`scripts/_check-legacy-kernel-tables.ts`) found 29 ideas — mostly
 * the editorial/showcase kernels seeded by `scripts/seed/seed-historical-kernels.ts` and
 * `seed-editorial-ideas.ts` — that have rich `Diagnosis`/`GuidingPolicy`/`RootCause`/
 * `CoherentAction` rows and LITERALLY NOTHING in the live schema: no `challenge`, no
 * `pivotalObstacle`, zero `DiagnosisCause`/`PolicyOption`/`LexCoherentAction` rows. They
 * never went through the live Lex build pipeline at all. Rebuilding these tabs against
 * `canonicalState` alone would make 29 real, populated ideas look empty — a new
 * regression this sprint would have caused instead of fixed.
 *
 * So: render the live schema when it has anything approved; fall back to the legacy
 * relation ONLY when the live page is entirely empty. Never both, never merged —
 * whichever one actually has the idea's content.
 */
function LegacyFallbackNotice() {
  return (
    <p className="mb-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
      ⚠ Showing the original draft — this idea has not been through the current kernel builder.
    </p>
  )
}

/** One page's fields, read-only, with its progress line. Editing lives in the actual
 *  editor (Lex tab) — this is the landing page, not a second write path onto the same
 *  rows the editor already owns. */
function CanonicalPageBlock({
  page, canonicalState, canEdit, ideaId, legacyFallback,
}: {
  page: CanonicalPage | undefined
  canonicalState: CanonicalState | null
  canEdit: boolean
  ideaId: string
  /** 26-J §1c — rendered instead of "Not yet completed" when the live page is empty AND
   *  this idea has legacy-table content (see the block comment above). */
  legacyFallback?: React.ReactNode
}) {
  const { done, total } = pageProgress(page)
  if (!page || !canonicalState || done === 0) {
    if (legacyFallback) {
      return <div><LegacyFallbackNotice />{legacyFallback}</div>
    }
    return <p className="text-sm text-zinc-400 italic">Not yet completed</p>
  }
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
          {done} of {total} approved
        </p>
        {canEdit && (
          <Link href={`/ideas/${ideaId}?tab=lex`} className="text-xs text-zinc-500 hover:text-zinc-900 underline underline-offset-2">
            Open in Lex to edit
          </Link>
        )}
      </div>
      <div className="space-y-5">
        {page.fields.map((f) => (
          <div key={f.key}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">{f.label}</p>
            <CanonicalFieldBlock field={f} canonicalState={canonicalState} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** The old Diagnosis/Policy/Coherent-Actions rendering, kept ONLY as the fallback above —
 *  read-only (no inline editing: these rows predate the field machine and editing them
 *  here would be a second write path CLAUDE.md's own "one implementation" rule warns
 *  against). Compact by design; this is a fallback, not the primary surface. */
function LegacyDiagnosisFallback({ idea }: { idea: Idea }) {
  const d = idea.diagnoses[0]
  const rows: Array<[string, string | null | undefined]> = [
    ['What’s the Problem?', d?.text],
    ['The Obstacle', d?.obstacleDefined],
    ['Who Is Affected?', d?.whoAffected],
    ['How Are They Affected?', d?.howAffected],
    ['Why Has This Persisted?', d?.whyPersisted],
    ['Impact', d?.impactDescription],
    ['Impact Cost', d?.impactCost],
  ]
  return (
    <div className="space-y-4">
      {rows.map(([label, value]) => value && (
        <div key={label}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
          <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">{value}</p>
        </div>
      ))}
      {idea.rootCauses.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Root Causes</p>
          <ul className="space-y-1.5">
            {idea.rootCauses.map((rc) => (
              <li key={rc.id} className="text-sm text-zinc-800">{rc.rootCauseTitle ?? rc.text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function LegacyPolicyFallback({ idea }: { idea: Idea }) {
  const g = idea.guidingPolicies[0]
  const rows: Array<[string, string | null | undefined]> = [
    ['How Will We Solve It?', g?.text],
    ['Core Theory', g?.coreTheory],
    ['Trade-offs', g?.tradeOffs],
    ['What Else Has Been Tried?', g?.competitiveIdeaAnalysis],
  ]
  return (
    <div className="space-y-4">
      {rows.map(([label, value]) => value && (
        <div key={label}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
          <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">{value}</p>
        </div>
      ))}
      {idea.evidence.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Evidence</p>
          <ul className="space-y-1.5">
            {idea.evidence.map((ev) => <li key={ev.id} className="text-sm text-zinc-800">{ev.title}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * 26-J §3 — INBOUND: anything the user added. §3a: "depends on §2c — if the split is
 * already a table boundary, build the tab on it and stop." `IdeaUserMaterial` IS that
 * boundary (confirmed: 25-Y's own fix already reads uploads from it; `Document` is the
 * system's own output, never a user's). No new provenance field was needed.
 */
interface InboundItem {
  id: string
  kind: 'FILE' | 'LINK'
  status: 'PENDING' | 'READY' | 'FAILED'
  label: string
  filename: string | null
  url: string | null
  findingCount: number
  createdAt: string
}

function InboundDocuments({ ideaId, canEdit }: { ideaId: string; canEdit: boolean }) {
  const [items, setItems] = useState<InboundItem[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/ideas/${ideaId}/material`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setItems(data.material ?? [])
        }
      } catch { if (!cancelled) setItems([]) }
    })()
    return () => { cancelled = true }
  }, [ideaId])

  const remove = async (id: string) => {
    setItems((prev) => (prev ?? []).filter((m) => m.id !== id))
    try {
      const res = await fetch(`/api/ideas/${ideaId}/material?materialId=${id}`, { method: 'DELETE' })
      if (res.ok) { const data = await res.json(); setItems(data.material ?? []) }
    } catch { /* optimistic removal stands */ }
  }

  if (items === null) return <p className="px-4 py-3 text-sm text-zinc-400">Loading…</p>
  if (items.length === 0) return <p className="px-4 py-3 text-sm text-zinc-400 italic">Nothing added yet.</p>

  return (
    <ul className="divide-y divide-zinc-100">
      {items.map((m) => (
        <li key={m.id} className="px-4 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-800 truncate">{m.label}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {m.kind === 'FILE' ? `File — ${m.filename ?? 'uploaded'}` : 'Link'}
              {m.status === 'READY' && ` · ${m.findingCount} finding${m.findingCount === 1 ? '' : 's'}`}
              {m.status === 'PENDING' && ' · not yet read'}
              {m.status === 'FAILED' && ' · could not be read'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {m.url && (
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 hover:text-zinc-900 underline">
                Open
              </a>
            )}
            {canEdit && (
              <button onClick={() => void remove(m.id)} className="text-xs text-zinc-400 hover:text-red-600 underline">
                Not relevant — remove
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

function LegacyActionsFallback({ idea }: { idea: Idea }) {
  if (!idea.coherentActions.length) return <p className="text-sm text-zinc-400 italic">Not yet completed</p>
  return (
    <ul className="space-y-1.5">
      {idea.coherentActions.map((a) => (
        <li key={a.id} className="text-sm text-zinc-800">{a.title}</li>
      ))}
    </ul>
  )
}

function IdeaTab({
  idea,
  canEdit,
  canonicalState,
}: {
  idea: Idea
  canEdit: boolean
  canonicalState: CanonicalState | null
}) {
  const [subTab, setSubTab] = useState<IdeaSubTab>('overview')
  const pageByKey = (key: string) => canonicalState?.pages.find((p) => p.key === key)

  const subTabs: { key: IdeaSubTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'diagnosis', label: 'Diagnosis' },
    { key: 'policy', label: 'Policy' },
    { key: 'actions', label: 'Coherent Actions' },
  ]

  const STAGE_LABELS_MAP: Record<string, string> = {
    STAGE_1: 'Create', STAGE_2: 'Draft', STAGE_3: 'Develop', STAGE_4: 'Campaign', STAGE_5: 'Legislate',
  }
  const IDEA_TYPE_LABELS: Record<string, string> = {
    LEGISLATION: 'Legislation',
    ORGANISATION: 'Organisational Change',
  }

  return (
    <div>
      {/* Sub-tab nav — pill style */}
      <div className="mb-6 border-b border-zinc-200/60 bg-zinc-50/50 px-4 py-[10px]">
        <div className="flex flex-wrap gap-[6px]">
          {subTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={[
                'whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors',
                subTab === t.key
                  ? 'border-zinc-900 bg-white font-medium text-zinc-900'
                  : 'border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tab: Overview — two-column layout */}
      {subTab === 'overview' && (
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Left column: summary content (2/3) */}
          <div className="min-w-0 flex-1">
            {/* 26-J §1d — the cold read: this reads the same "N of M approved" the editor
                shows, off the same canonicalState, so the two can never disagree again. */}
            {canonicalState && (
              <div className="mb-5 flex flex-wrap gap-x-4 gap-y-1">
                {canonicalState.pages.filter((p) => p.fields.length > 0).map((p) => {
                  const { done, total } = pageProgress(p)
                  return (
                    <span key={p.key} className="text-[11px] text-zinc-500">
                      <span className="font-medium text-zinc-700">{p.label}</span>: {done} of {total} approved
                    </span>
                  )
                })}
              </div>
            )}
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Summary</p>
            {idea.summaryDescription ? (
              <p className="text-sm leading-relaxed text-zinc-800">{idea.summaryDescription}</p>
            ) : (
              <p className="text-sm italic text-zinc-400">Not yet completed</p>
            )}
            {/* Task 7: backgroundResearch — added in L6-A, rendered here per L6-C brief */}
            {idea.backgroundResearch && (
              <div className="mt-5">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Background Research</p>
                <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{idea.backgroundResearch}</p>
              </div>
            )}
            {(idea.summaryDiagnosis || idea.summaryGuidingPolicy || idea.summaryCoherentActions) && (
              <div className="mt-5 space-y-4">
                {idea.summaryDiagnosis && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Problem (summary)</p>
                    <p className="text-sm text-zinc-700">{idea.summaryDiagnosis}</p>
                  </div>
                )}
                {idea.summaryGuidingPolicy && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Approach (summary)</p>
                    <p className="text-sm text-zinc-700">{idea.summaryGuidingPolicy}</p>
                  </div>
                )}
                {idea.summaryCoherentActions && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">First step (summary)</p>
                    <p className="text-sm text-zinc-700">{idea.summaryCoherentActions}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Right column: metadata (1/3) */}
          <div className="shrink-0 space-y-4 md:basis-1/3 md:border-l md:pl-5">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Stage</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STAGE_BADGE[idea.stage] ?? 'bg-muted text-muted-foreground'}`}>
                {STAGE_LABELS_MAP[idea.stage] ?? idea.stage}
              </span>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Idea Type</p>
              <p className="text-sm">{IDEA_TYPE_LABELS[idea.ideaType] ?? idea.ideaType}</p>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Government Area</p>
              <p className="text-sm">{idea.govtArea || <span className="italic text-zinc-400">Not set</span>}</p>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Created</p>
              <p className="text-sm">{new Date(idea.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Owner</p>
              <Link href={`/user/${idea.creator.username}`} className="text-sm text-zinc-800 underline-offset-2 hover:underline">
                {idea.creator.name}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ══ 26-J §1 — DIAGNOSIS/POLICY/COHERENT ACTIONS, REBUILT AGAINST THE LIVE SCHEMA ══
          These used to read Diagnosis/GuidingPolicy/RootCause/Evidence/CoherentAction —
          tables the current build pipeline stopped writing to when the kernel was
          rebuilt (26-H's diagnosis). They now read `canonicalState`, assembled by
          `computeCanonicalState` — the SAME function the editor's own FieldsPanel calls —
          so this page and the editor cannot read two different truths again. */}
      {subTab === 'diagnosis' && (
        <CanonicalPageBlock
          page={pageByKey('DIAGNOSIS')}
          canonicalState={canonicalState}
          canEdit={canEdit}
          ideaId={idea.id}
          legacyFallback={idea.diagnoses[0] || idea.rootCauses.length ? <LegacyDiagnosisFallback idea={idea} /> : undefined}
        />
      )}

      {subTab === 'policy' && (
        <CanonicalPageBlock
          page={pageByKey('GUIDING_POLICY')}
          canonicalState={canonicalState}
          canEdit={canEdit}
          ideaId={idea.id}
          legacyFallback={idea.guidingPolicies[0] || idea.evidence.length ? <LegacyPolicyFallback idea={idea} /> : undefined}
        />
      )}

      {subTab === 'actions' && (
        <CanonicalPageBlock
          page={pageByKey('COHERENT_ACTIONS')}
          canonicalState={canonicalState}
          canEdit={canEdit}
          ideaId={idea.id}
          legacyFallback={idea.coherentActions.length ? <LegacyActionsFallback idea={idea} /> : undefined}
        />
      )}
    </div>
  )
}

// ── Legacy overview tab (kept for use in Stage 3+ endorsement context) ────────

function OverviewTab({ idea }: { idea: Idea }) {
  return (
    <div className="space-y-6">
      {idea.diagnosis && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            The Problem
          </h3>
          <p className="text-sm leading-relaxed sm:text-base">{idea.diagnosis}</p>
        </section>
      )}

      {idea.rootCause && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Root Cause
          </h3>
          <p className="text-sm leading-relaxed sm:text-base">{idea.rootCause}</p>
        </section>
      )}

      {idea.whoAffected && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Who Is Affected
          </h3>
          <p className="text-sm leading-relaxed sm:text-base">{idea.whoAffected}</p>
        </section>
      )}

      {idea.guidingPolicy && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Guiding Policy
          </h3>
          <p className="text-sm leading-relaxed sm:text-base">{idea.guidingPolicy}</p>
        </section>
      )}

      {idea.coherentActions.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Coherent Actions
          </h3>
          <ol className="space-y-3">
            {idea.coherentActions.map((action, i) => (
              <li key={action.id} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{action.title}</p>
                  {action.summarySnippet && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{action.summarySnippet}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {idea.coherentActions.length === 0 && !idea.diagnosis && !idea.guidingPolicy && (
        <p className="text-sm text-muted-foreground">
          This idea is still being developed. Check back later.
        </p>
      )}
    </div>
  )
}

interface GroupMemberRecord {
  id: string
  role: string
  user: { id: string; name: string; username: string }
}

interface GroupRecord {
  id: string
  groupType: string
  name: string
  description: string | null
  memberCount: number
  members: GroupMemberRecord[]
}

const GROUP_TYPE_LABELS: Record<string, string> = {
  MY_TEAM: 'My Team',
  COMMUNICATIONS: 'Communications',
  POLICY_DEVELOPMENT: 'Policy Development',
}

const GROUP_TYPE_DESC: Record<string, string> = {
  MY_TEAM: 'Full edit rights on the idea.',
  COMMUNICATIONS: 'Can broadcast to followers.',
  POLICY_DEVELOPMENT: 'Can contribute and flag stage transitions.',
}

// ── Invite search result type ─────────────────────────────────────────────────
interface UserSearchResult {
  id: string
  name: string
  firstName: string | null
  lastName: string | null
  username: string
}

function TeamTab({
  idea,
  isOwner,
  ownerReferralCode,
}: {
  idea: Idea
  isOwner: boolean
  ownerReferralCode: string | null
}) {
  const [referralLinkCopied, setReferralLinkCopied] = useState(false)
  const [groups, setGroups] = useState<GroupRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [creating, setCreating] = useState<string | null>(null) // groupType being created
  const [groupName, setGroupName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  // Invite flows state
  const [inviteMode, setInviteMode] = useState<'none' | 'search' | 'email'>('none')
  // Flow A — search existing users
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null)
  const [inviteSearchError, setInviteSearchError] = useState<string | null>(null)
  const [inviteSearchSuccess, setInviteSearchSuccess] = useState<string | null>(null)
  // Flow B — invite by email
  const [emailForm, setEmailForm] = useState({ firstName: '', lastName: '', email: '' })
  const [emailSubmitting, setEmailSubmitting] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState(false)

  // Transfer ownership state
  const [transferToUserId, setTransferToUserId] = useState('')
  const [showTransferConfirm, setShowTransferConfirm] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferPending, setTransferPending] = useState(false)
  const [transferPendingName, setTransferPendingName] = useState('')

  async function handleInitiateTransfer() {
    if (!transferToUserId) return
    setTransferring(true)
    setTransferError(null)
    try {
      const res = await fetch(`/api/ideas/${idea.id}/transfer/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOwnerUserId: transferToUserId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTransferError(data.error ?? 'Something went wrong')
        return
      }
      const selectedCollab = idea.collaborators.find(c => c.user.id === transferToUserId)
      setTransferPendingName(selectedCollab?.user.name ?? '')
      setTransferPending(true)
      setShowTransferConfirm(false)
    } catch {
      setTransferError('Network error — please try again')
    } finally {
      setTransferring(false)
    }
  }

  async function handleCancelTransfer() {
    try {
      await fetch(`/api/ideas/${idea.id}/transfer/cancel`, { method: 'POST' })
      setTransferPending(false)
      setTransferPendingName('')
      setTransferToUserId('')
    } catch {
      // non-critical
    }
  }

  useEffect(() => {
    fetch(`/api/ideas/${idea.id}/groups`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => { setGroups(data.groups ?? []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [idea.id])

  async function handleCreateGroup(groupType: string) {
    if (!groupName.trim()) return
    setCreateError(null)
    try {
      const res = await fetch(`/api/ideas/${idea.id}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupType, name: groupName }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? 'Failed'); return }
      setGroups(prev => [...prev, data])
      setCreating(null)
      setGroupName('')
    } catch {
      setCreateError('Network error')
    }
  }

  async function handleRemoveMember(groupId: string, userId: string) {
    await fetch(`/api/ideas/${idea.id}/groups/${groupId}/members/${userId}`, { method: 'DELETE' })
    setGroups(prev => prev.map(g =>
      g.id === groupId
        ? { ...g, members: g.members.filter(m => m.user.id !== userId), memberCount: g.memberCount - 1 }
        : g,
    ))
  }

  // Flow A — debounced search
  useEffect(() => {
    if (inviteMode !== 'search') return
    if (searchQuery.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        setSearchResults(data.users ?? [])
      } catch {
        // non-critical
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery, inviteMode])

  async function handleInviteExistingUser(targetUserId: string, targetName: string) {
    setInvitingUserId(targetUserId)
    setInviteSearchError(null)
    try {
      const res = await fetch(`/api/ideas/${idea.id}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUserId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInviteSearchError(data.error ?? 'Something went wrong')
        return
      }
      setInviteSearchSuccess(`${targetName} has been added to your team.`)
      setSearchQuery('')
      setSearchResults([])
      setInviteMode('none')
    } catch {
      setInviteSearchError('Network error — please try again')
    } finally {
      setInvitingUserId(null)
    }
  }

  async function handleEmailInviteSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailSubmitting(true)
    setEmailError(null)
    try {
      const res = await fetch(`/api/ideas/${idea.id}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailForm),
      })
      const data = await res.json()
      if (!res.ok) {
        setEmailError(typeof data.error === 'string' ? data.error : 'Something went wrong')
        return
      }
      setEmailSuccess(true)
      setEmailForm({ firstName: '', lastName: '', email: '' })
    } catch {
      setEmailError('Network error — please try again')
    } finally {
      setEmailSubmitting(false)
    }
  }

  // §19-D Task 9b — "Communications" and "Policy Development" are removed from the Team
  // page. Charlie's read: they sound like PERMISSIONS you grant someone after inviting
  // them, not roles you pick from before you have. §22.4 specifies the role model that
  // replaces them — Owner / Editor / Reviewer / Contributor — and this page should be
  // aligned with it when the team feature is next properly touched.
  //
  // The two group types are NOT deleted from the schema, `GROUP_TYPE_LABELS`, or the
  // /groups route: existing groups of either type keep working and keep rendering
  // (`groups.filter` below is by type, and any group not in this list simply isn't
  // OFFERED). Per the root CLAUDE.md §11 rule, nothing is removed from the data model
  // without Charlie's explicit instruction; this brief asked to remove them from the
  // page, which is what this does.
  const groupTypes = ['MY_TEAM']

  return (
    <div className="space-y-6">
      {/* Core collaborators */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Core Team
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {idea.creator.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">{idea.creator.name}</p>
              <p className="text-xs text-muted-foreground">Owner</p>
            </div>
            {isOwner && ownerReferralCode && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">View-only link</span>
                <button
                  onClick={() => {
                    const link = `https://www.scrutinise.org/ideas/${idea.id}?ref=${ownerReferralCode}`
                    navigator.clipboard.writeText(link)
                    setReferralLinkCopied(true)
                    setTimeout(() => setReferralLinkCopied(false), 2000)
                  }}
                  className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
                >
                  {referralLinkCopied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            )}
          </div>
          {idea.collaborators.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {c.user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">{c.user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{c.role.toLowerCase()}</p>
              </div>
            </div>
          ))}
          {idea.collaborators.length === 0 && (
            <p className="text-sm text-muted-foreground">No collaborators yet.</p>
          )}
        </div>

        {/* Invite controls — owner only */}
        {isOwner && (
          <div className="mt-4 space-y-3">
            {inviteSearchSuccess && (
              <p className="text-xs text-green-700 font-medium">{inviteSearchSuccess}</p>
            )}

            {inviteMode === 'none' && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => { setInviteMode('search'); setInviteSearchSuccess(null) }}>
                  Add existing user
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setInviteMode('email'); setInviteSearchSuccess(null) }}>
                  Invite by email
                </Button>
              </div>
            )}

            {/* Flow A: search existing users */}
            {inviteMode === 'search' && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-medium">Search for a user</p>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Name or username (min 2 chars)"
                  autoFocus
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {searching && <p className="text-xs text-muted-foreground">Searching…</p>}
                {searchResults.length > 0 && (
                  <ul className="divide-y divide-border rounded-md border">
                    {searchResults.map(u => (
                      <li key={u.id} className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {(u.name || u.firstName || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">@{u.username}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          disabled={invitingUserId === u.id}
                          onClick={() => handleInviteExistingUser(u.id, u.name)}
                        >
                          {invitingUserId === u.id ? 'Adding…' : 'Invite'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground">No users found.</p>
                )}
                {inviteSearchError && <p className="text-xs text-destructive">{inviteSearchError}</p>}
                <Button size="sm" variant="outline" onClick={() => { setInviteMode('none'); setSearchQuery(''); setSearchResults([]) }}>
                  Cancel
                </Button>
              </div>
            )}

            {/* Flow B: invite by email */}
            {inviteMode === 'email' && !emailSuccess && (
              <form onSubmit={handleEmailInviteSubmit} className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-medium">Invite someone new</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">First name *</label>
                    <input
                      required
                      value={emailForm.firstName}
                      onChange={e => setEmailForm(f => ({ ...f, firstName: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Last name *</label>
                    <input
                      required
                      value={emailForm.lastName}
                      onChange={e => setEmailForm(f => ({ ...f, lastName: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Email address *</label>
                  <input
                    required
                    type="email"
                    value={emailForm.email}
                    onChange={e => setEmailForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={emailSubmitting}>
                    {emailSubmitting ? 'Sending…' : 'Send invite'}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setInviteMode('none'); setEmailError(null) }}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {inviteMode === 'email' && emailSuccess && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                Invitation sent.{' '}
                <button
                  onClick={() => { setEmailSuccess(false); setInviteMode('none') }}
                  className="underline underline-offset-2 hover:text-green-700"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Groups. §19-D Task 9b — the OFFERED types are `groupTypes`; any group that
          already exists of a retired type still renders, so removing the option from
          the page never hides a team somebody has already built. */}
      {loaded && [...groupTypes, ...groups.map(g => g.groupType).filter(t => !groupTypes.includes(t))].map(groupType => {
        const existing = groups.find(g => g.groupType === groupType)

        return (
          <div key={groupType}>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {GROUP_TYPE_LABELS[groupType]}
                </h3>
                <p className="text-[11px] text-muted-foreground">{GROUP_TYPE_DESC[groupType]}</p>
              </div>
              {isOwner && !existing && creating !== groupType && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setCreating(groupType); setGroupName(GROUP_TYPE_LABELS[groupType] ?? '') }}
                >
                  Create
                </Button>
              )}
            </div>

            {creating === groupType && (
              <div className="rounded-lg border p-3 space-y-2 mb-2">
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="Group name"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {createError && <p className="text-xs text-destructive">{createError}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleCreateGroup(groupType)} disabled={!groupName.trim()}>
                    Create
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setCreating(null); setCreateError(null) }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {existing ? (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">{existing.name}</p>
                {existing.members.length === 0 && (
                  <p className="text-xs text-muted-foreground">No members yet.</p>
                )}
                {existing.members.map(m => (
                  <div key={m.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {m.user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm">{m.user.name}</span>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => handleRemoveMember(existing.id, m.user.id)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              !isOwner && (
                <p className="text-xs text-muted-foreground">No {GROUP_TYPE_LABELS[groupType]} group created yet.</p>
              )
            )}
          </div>
        )
      })}

      {/* Transfer Ownership — owner only, requires at least 1 collaborator */}
      {isOwner && idea.collaborators.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Transfer Ownership
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Transfer ownership to a collaborator. The new owner will receive full control of this idea. You will become a collaborator.
          </p>

          {transferPending ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Transfer pending — waiting for <strong>{transferPendingName}</strong> to accept.{' '}
              <button
                onClick={handleCancelTransfer}
                className="underline underline-offset-2 hover:text-amber-700"
              >
                Cancel transfer
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={transferToUserId}
                  onChange={e => setTransferToUserId(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a collaborator…</option>
                  {idea.collaborators.map(c => (
                    <option key={c.userId} value={c.user.id}>
                      {c.user.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!transferToUserId}
                  onClick={() => setShowTransferConfirm(true)}
                >
                  Initiate Transfer
                </Button>
              </div>
              {transferError && (
                <p className="mt-2 text-xs text-destructive">{transferError}</p>
              )}
            </>
          )}

          {/* Confirm modal */}
          {showTransferConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
                <h2 className="font-semibold">Transfer ownership?</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Transfer ownership of <strong>{idea.title}</strong> to{' '}
                  <strong>{idea.collaborators.find(c => c.user.id === transferToUserId)?.user.name}</strong>?
                  They will receive an email to accept. Once accepted, this cannot be undone.
                </p>
                {transferError && (
                  <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{transferError}</p>
                )}
                <div className="mt-4 flex gap-3">
                  <Button variant="outline" size="sm" onClick={() => setShowTransferConfirm(false)} disabled={transferring}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleInitiateTransfer} disabled={transferring}>
                    {transferring ? 'Sending…' : 'Confirm'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// Development History — owner-only, shows Stage 2 internal contributions
// grouped by contributor
// ─────────────────────────────────────────────────────────────────────────────

interface InternalContribution {
  id: string
  commentNumber: number | null
  content: string
  stance: string
  contributionType: string | null
  createdAt: string
  author: { id: string; name: string; username: string }
}

function DevelopmentHistory({ ideaId }: { ideaId: string }) {
  const [items, setItems] = useState<InternalContribution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/ideas/${ideaId}/contributions`)
      .then(r => r.json())
      .then(data => {
        const internals = (data.contributions ?? []).filter(
          (c: InternalContribution & { isInternal: boolean }) => c.isInternal,
        )
        setItems(internals)
      })
      .catch(() => {/* non-critical */})
      .finally(() => setLoading(false))
  }, [ideaId])

  if (loading || items.length === 0) return null

  // Group by contributor
  const byAuthor = items.reduce<Record<string, { author: InternalContribution['author']; contributions: InternalContribution[] }>>(
    (acc, item) => {
      const key = item.author.id
      if (!acc[key]) acc[key] = { author: item.author, contributions: [] }
      acc[key].contributions.push(item)
      return acc
    },
    {},
  )

  const STANCE_STYLES: Record<string, string> = {
    SUPPORTIVE: 'bg-green-100 text-green-800',
    CRITICAL: 'bg-red-100 text-red-700',
    NEUTRAL: 'bg-muted text-muted-foreground',
    QUESTION: 'bg-blue-100 text-blue-700',
  }
  const STANCE_LABELS: Record<string, string> = {
    SUPPORTIVE: 'Supportive',
    CRITICAL: 'Critical',
    NEUTRAL: 'Neutral',
    QUESTION: 'Question',
  }

  return (
    <div className="mt-10 border-t pt-8">
      <h2 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Development History
      </h2>
      <p className="mb-5 text-xs text-muted-foreground">
        Internal contributions made during the Draft stage by your collaborators.
      </p>
      <div className="space-y-6">
        {Object.values(byAuthor).map(({ author, contributions }) => (
          <div key={author.id}>
            <p className="mb-2 text-sm font-medium">
              {author.name}{' '}
              <span className="text-xs font-normal text-muted-foreground">
                — {contributions.length} contribution{contributions.length !== 1 ? 's' : ''}
              </span>
            </p>
            <div className="space-y-2 border-l-2 border-muted pl-4">
              {contributions.map(c => (
                <div key={c.id} className="rounded-md border bg-muted/30 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {c.commentNumber != null && (
                      <span className="font-mono text-xs text-muted-foreground">#{c.commentNumber}</span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STANCE_STYLES[c.stance] ?? 'bg-muted text-muted-foreground'}`}>
                      {STANCE_LABELS[c.stance] ?? c.stance}
                    </span>
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                      Internal
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{c.content}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Privacy Log tab — owner-only
// ─────────────────────────────────────────────────────────────────────────────

interface PrivacyLogEntry {
  id: string
  accessorName: string
  accessReason: string | null
  createdAt: string
}

function PrivacyLogTab({ ideaId }: { ideaId: string }) {
  const [entries, setEntries] = useState<PrivacyLogEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/ideas/${ideaId}/privacy-log`)
      .then(r => r.json())
      .then(data => {
        setEntries(Array.isArray(data) ? data : [])
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [ideaId])

  if (!loaded) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="text-sm text-green-800">No Scrutinise team members have accessed this idea.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        This log records every time a Scrutinise team member has accessed your idea, as required by our{' '}
        <a href="/privacy" className="underline hover:text-foreground">privacy policy</a>.
      </p>
      {entries.map(entry => (
        <div
          key={entry.id}
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <p className="text-sm text-amber-900">
            <span className="font-medium">{entry.accessorName}</span> accessed this idea on{' '}
            <span className="font-medium">
              {new Date(entry.createdAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            {entry.accessReason && (
              <>. Reason: <span className="font-medium">{entry.accessReason}</span></>
            )}
            .
          </p>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main client component
// ─────────────────────────────────────────────────────────────────────────────

// 26-C addendum 3 §24c — 'stats' sits between 'research' and 'contributions', matching
// the tab bar's own visual order (the array below, not this type's declaration order).
type Tab = 'idea' | 'research' | 'stats' | 'contributions' | 'amendments' | 'team' | 'campaign' | 'privacy-log' | 'exports'

function isValidTab(t: string | null): t is Tab {
  return ['idea', 'overview', 'research', 'stats', 'contributions', 'amendments', 'team', 'campaign', 'privacy-log', 'exports'].includes(t ?? '')
}

export default function IdeaDetailClient({
  idea: initialIdea,
  hasBuild,
  isOwner,
  isCollaborator,
  currentUserId,
  currentUserReferralCode,
  currentUserCanEndorse,
  ideaReviewCount,
  avgQualityRating,
  stage4GateData,
  canonicalState,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [idea, setIdea] = useState(initialIdea)
  const tabParam = searchParams.get('tab')
  // Support legacy 'overview' param → map to 'idea'
  const resolvedTabParam = tabParam === 'overview' ? 'idea' : tabParam
  const [activeTab, setActiveTab] = useState<Tab>(isValidTab(resolvedTabParam) ? resolvedTabParam : 'idea')
  const [showTakePublicModal, setShowTakePublicModal] = useState(false)
  const [showBeginCampaignModal, setShowBeginCampaignModal] = useState(false)
  const [showVoteInterceptModal, setShowVoteInterceptModal] = useState(false)
  const [showSubmitToParliamentModal, setShowSubmitToParliamentModal] = useState(false)
  const [referralLinkCopied, setReferralLinkCopied] = useState(false)
  const [commentCount, setCommentCount] = useState(initialIdea.commentCount)
  const [userIdeaRating, setUserIdeaRating] = useState<number | null>(null)
  const [whatNextOpen, setWhatNextOpen] = useState(searchParams.get('whatnext') === 'true')
  const [deleteOpen, setDeleteOpen] = useState(false)   // §19-E Task 6

  const stageLabel = STAGES.find(s => s.key === idea.stage)?.label ?? idea.stage
  const badgeClass = STAGE_BADGE[idea.stage] ?? 'bg-muted text-muted-foreground'

  const stage2GateMet =
    idea.stage === 'STAGE_2' &&
    isOwner &&
    !!idea.diagnosis?.trim() &&
    !!idea.guidingPolicy?.trim() &&
    (idea.coherentActions.length >= 1 || !!idea.summaryCoherentActions?.trim()) &&
    idea.research.length >= 3

  const stage3GateMet =
    idea.stage === 'STAGE_3' && isOwner && ideaReviewCount >= 12 && avgQualityRating >= 2.5

  const stage4GateMet =
    idea.stage === 'STAGE_4' &&
    isOwner &&
    stage4GateData != null &&
    stage4GateData.mpCount >= 3 &&
    stage4GateData.peerCount >= 3 &&
    stage4GateData.draftsmanCount >= 1 &&
    stage4GateData.wordingComplete

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://scrutinise.co.uk'
  const referralLink = `${appUrl}/ideas/${idea.id}?ref=${currentUserReferralCode ?? idea.creator.referralCode}`

  function handleTakePublicSuccess() {
    setShowTakePublicModal(false)
    router.refresh()
    setIdea(prev => ({ ...prev, stage: 'STAGE_3', visibility: 'LINK_ONLY', referralLinkActive: true }))
  }

  function handleBeginCampaignSuccess() {
    setShowBeginCampaignModal(false)
    router.refresh()
    setIdea(prev => ({ ...prev, stage: 'STAGE_4', visibility: 'PLATFORM_LISTED' }))
  }

  function handleSubmitToParliamentSuccess() {
    setShowSubmitToParliamentModal(false)
    router.refresh()
    setIdea(prev => ({ ...prev, stage: 'STAGE_5' }))
  }

  function copyReferralLink() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setReferralLinkCopied(true)
      setTimeout(() => setReferralLinkCopied(false), 2000)
    })
  }

  async function handleIdeaRate(value: number) {
    const res = await fetch(`/api/ideas/${idea.id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qualityRating: value }),
    })
    if (res.ok) {
      setUserIdeaRating(value)
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'idea', label: 'Idea' },
    { key: 'research', label: `Research${idea.research.length > 0 ? ` (${idea.research.length})` : ''}` },
    // 26-C addendum 3 §24c — between Research and Contributions, as specified.
    // Owner-only, matching the removed strip's own rule ("⚠ OWNER-VISIBLE ONLY FOR NOW").
    ...(isOwner ? [{ key: 'stats' as Tab, label: 'Stats' }] : []),
    { key: 'contributions', label: `Contributions${commentCount > 0 ? ` (${commentCount})` : ''}` },
    { key: 'amendments', label: 'Amendments' },
    // §8.2 — generated documents live outside the three Lex panels.
    { key: 'exports', label: 'Documents' },
    { key: 'team', label: 'Team' },
    ...(['STAGE_4', 'STAGE_5'].includes(idea.stage) ? [{ key: 'campaign' as Tab, label: 'Campaign' }] : []),
    ...(isOwner ? [{ key: 'privacy-log' as Tab, label: 'Privacy Log' }] : []),
  ]

  return (
    <>
      {showTakePublicModal && (
        <TakePublicModal
          ideaId={idea.id}
          onClose={() => setShowTakePublicModal(false)}
          onSuccess={handleTakePublicSuccess}
        />
      )}

      {showBeginCampaignModal && (
        <BeginCampaignModal
          ideaId={idea.id}
          onClose={() => setShowBeginCampaignModal(false)}
          onSuccess={handleBeginCampaignSuccess}
        />
      )}

      {showVoteInterceptModal && (
        <VoteInterceptModal
          ideaId={idea.id}
          onClose={() => setShowVoteInterceptModal(false)}
        />
      )}

      {showSubmitToParliamentModal && (
        <SubmitToParliamentModal
          ideaId={idea.id}
          onClose={() => setShowSubmitToParliamentModal(false)}
          onSuccess={handleSubmitToParliamentSuccess}
        />
      )}

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {/* ⚠⚠ 26-C ADDENDUM 3 §24a — THE STAGE STEPPER IS REMOVED FROM THIS PAGE.
            "It does not belong on this page." The single-stage badge in the header
            (`stageLabel`/`badgeClass`, a few lines down) and in the right-hand metadata
            column still say which stage the idea is at — this removes the five-tile
            bar, not the fact of which stage it's in. */}

        {/* IdeaOrigin banner */}
        <IdeaOriginBanner idea={idea} />

        {/* Header */}
        <div className="mb-6">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
              {stageLabel}
            </span>
          </div>

          {/* ⚠⚠ 26-C ADDENDUM 3 §24b/§24c — THE GREY STATISTICS BOX STOOD HERE AND IS
              REMOVED FROM THE HEADER. Its contents (the progress label and the evidence
              facts §24.1/§24.2 originally put here) move to their own "Stats" tab,
              between Research and Contributions — see `activeTab === 'stats'` below. */}

          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {idea.title || 'Untitled idea'}
          </h1>

          {idea.summaryDescription && (
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              {idea.summaryDescription}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              by{' '}
              <Link
                href={`/user/${idea.creator.username}`}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {idea.creator.name}
              </Link>
            </span>
            <span>
              {new Date(idea.createdAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            {idea.creator.credibilityScore?.totalScore && (
              <span>
                Credibility:{' '}
                <strong>{Number(idea.creator.credibilityScore.totalScore).toFixed(0)}</strong>
              </span>
            )}
          </div>

          {/* Edit + What Next? + Campaign in a Box — below author/date line */}
          <div className="mt-3 flex items-center gap-2">
            {/* ⚠⚠ 26-C ADDENDUM 3 §23d — AN UNBUILT IDEA MUST NEVER OPEN AN EMPTY
                WORKSPACE. This unconditional `/ideas/create?ideaId=…` link was the
                mechanism §23e asked to be found: it always pointed at the three-panel
                workspace, and only got redirected back to the simple screen by the §4
                gate ONE HOP LATER — which, before the page split, landed on the still-
                "mixed" /ideas/build, reading as "Edit returns to the wrong page" rather
                than "Edit resumed the conversation." Deciding the destination HERE,
                rather than relying on the gate to catch it downstream, removes that hop
                entirely: the link is right the first time. */}
            {isOwner && ['STAGE_1', 'STAGE_2'].includes(idea.stage) && (
              <Button asChild size="sm">
                <Link href={hasBuild ? `/ideas/create?ideaId=${idea.id}` : `/ideas/build?ideaId=${idea.id}`}>
                  Edit
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWhatNextOpen(o => !o)}
            >
              What Next?
            </Button>
            {isOwner && ['STAGE_4', 'STAGE_5'].includes(idea.stage) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('campaign')}
              >
                Campaign in a Box
              </Button>
            )}
            {/* §19-E Task 6 — owner-only, and deliberately last in the row and quiet:
                it is a destructive action sitting next to ordinary ones, so it should
                be findable rather than prominent. Hidden from Stage 4 onwards, where
                the idea carries other people's votes and contributions and the right
                act is a withdrawal — the API refuses it there too, so the absence of
                the button is a courtesy and not the enforcement. */}
            {isOwner && !['STAGE_4', 'STAGE_5'].includes(idea.stage) && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground hover:text-red-600"
                onClick={() => setDeleteOpen(true)}
              >
                Delete idea
              </Button>
            )}
          </div>

          {deleteOpen && (
            <DeleteIdeaDialog
              ideaId={idea.id}
              title={idea.title}
              onCancel={() => setDeleteOpen(false)}
              // Straight to the dashboard, and a hard navigation rather than a router
              // push: the list this idea has just left is server-rendered, and a soft
              // push would show it still sitting there.
              onDeleted={() => { window.location.href = '/dashboard' }}
            />
          )}

          <WhatNextPanel
            idea={{
              stage: idea.stage,
              diagnosis: idea.diagnoses[0] ?? null,
              guidingPolicy: idea.guidingPolicies[0] ?? null,
              coherentActions: idea.coherentActions,
            }}
            isOpen={whatNextOpen}
            onClose={() => setWhatNextOpen(false)}
          />
        </div>

        {/* Idea quality rating — Stage 3+, authenticated users only */}
        {['STAGE_3', 'STAGE_4', 'STAGE_5'].includes(idea.stage) && currentUserId && (
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Rate the quality of this argument:</span>
            <QualityRating
              rating={userIdeaRating}
              avgRating={avgQualityRating > 0 ? avgQualityRating : null}
              onRate={handleIdeaRate}
              labelMin="Poorly argued"
              labelMax="Well argued"
              promptText="This rating is for the quality of the argument — use the vote if you want to support or oppose the idea or its consequences"
            />
          </div>
        )}

        {/* Referral link — show to owner after Stage 3 */}
        {idea.referralLinkActive && isOwner && (
          <div className="mb-6 rounded-lg border bg-muted/40 p-4">
            <p className="mb-2 text-sm font-medium">Share this idea</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-hidden text-ellipsis rounded bg-background px-2 py-1 text-xs">
                {referralLink}
              </code>
              <Button variant="outline" size="sm" onClick={copyReferralLink}>
                <Copy className="mr-1 size-3" />
                {referralLinkCopied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
        )}

        {/* Action button row — stage-appropriate action (Stage 3+) */}
        {isOwner && ['STAGE_3', 'STAGE_4'].includes(idea.stage) && (
          <div className="mb-6">
            {idea.stage === 'STAGE_3' && (
              <>
                <Button
                  onClick={() => setShowBeginCampaignModal(true)}
                  disabled={!stage3GateMet}
                  variant={stage3GateMet ? 'default' : 'outline'}
                >
                  Begin Campaign
                </Button>
                {!stage3GateMet && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Meet all requirements above to unlock.
                  </p>
                )}
              </>
            )}

            {idea.stage === 'STAGE_4' && (
              <>
                <Button
                  onClick={() => setShowSubmitToParliamentModal(true)}
                  disabled={!stage4GateMet}
                  variant={stage4GateMet ? 'default' : 'outline'}
                >
                  Submit to Parliament
                </Button>
                {!stage4GateMet && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Meet all requirements above to unlock.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b">
          <div className="-mb-px flex gap-0 overflow-x-auto">
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

        {/* Vote widget — Stage 4/5 only */}
        {(idea.stage === 'STAGE_4' || idea.stage === 'STAGE_5') && (
          <div className="mt-6">
            <VoteWidget ideaId={idea.id} currentUserId={currentUserId} />
          </div>
        )}

        <div className="py-6">
          {activeTab === 'idea' && (
            <>
              {['STAGE_4', 'STAGE_5'].includes(idea.stage) && (
                <div className="mb-6">
                  <EndorsementPanel
                    ideaId={idea.id}
                    stage={idea.stage}
                    canEndorse={currentUserCanEndorse}
                    currentUserId={currentUserId}
                    isOwner={isOwner}
                  />
                </div>
              )}
              <IdeaTab idea={idea} canEdit={isOwner || isCollaborator} canonicalState={canonicalState} />
            </>
          )}
          {activeTab === 'contributions' && (
            <ContributionsTab
              ideaId={idea.id}
              stage={idea.stage}
              isOwner={isOwner}
              currentUserId={currentUserId}
              onCommentAdded={() => setCommentCount(c => c + 1)}
            />
          )}
          {activeTab === 'research' && (
            <ResearchTab
              ideaId={idea.id}
              stage={idea.stage}
              isOwner={isOwner}
              isCollaborator={isCollaborator}
              currentUserId={currentUserId}
              initialResearch={idea.research}
              onResearchAdded={item =>
                setIdea(prev => ({ ...prev, research: [...prev.research, item] }))
              }
            />
          )}
          {/* 26-C addendum 3 §24c — the progress label and evidence facts, moved here
              from the header's now-removed grey box. */}
          {activeTab === 'stats' && <StatsTab ideaId={idea.id} isOwner={isOwner} />}
          {activeTab === 'amendments' && (
            <AmendmentsTab
              ideaId={idea.id}
              stage={idea.stage}
              isOwner={isOwner}
              currentUserId={currentUserId}
            />
          )}
          {activeTab === 'exports' && (
            <div className="max-w-2xl space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Documents</h2>
                <p className="text-sm text-zinc-600 mt-1">
                  Everything added to this idea, and everything generated from it.
                </p>
              </div>

              {/* 26-J §3 — INBOUND: anything the user added. */}
              <CollapsedSection title="Inbound" hint="What you've added — links and files." defaultOpen>
                <InboundDocuments ideaId={idea.id} canEdit={isOwner || isCollaborator} />
              </CollapsedSection>

              {/* 26-J §3 — OUTBOUND: anything the system produced. */}
              <CollapsedSection title="Outbound" hint="Generated from what is stored on this idea." defaultOpen>
                <div className="p-4 space-y-4">
                  <p className="text-xs text-zinc-500 -mt-1">
                    Each one says what it was made from and when — re-run a search and the file is
                    marked out of date rather than quietly served.
                  </p>
                  {/* 17 Sep 2026 — THE PAIR, from one build: here is what we found, here is what we
                      need from you. Both are frozen records of that build; the live view is the
                      research panel and the worklist in the working area. */}
                  <DocumentExports ideaId={idea.id} variant="page" kind="INITIAL_BACKGROUND" />
                  <DocumentExports ideaId={idea.id} variant="page" kind="INITIAL_QUESTIONS" />
                  {/* ⚠ BRIEF_26G §4d — the two documents that LEAVE the building, alongside the
                      others, named. Same frozen-at-a-build record as the pair above. */}
                  <DocumentExports ideaId={idea.id} variant="page" kind="COMMITTEE_EVIDENCE" />
                  <DocumentExports ideaId={idea.id} variant="page" kind="ONE_PAGE_SUMMARY" />
                  {/* Sprint 20-B/D — the proposal itself, and who can read it. Owner
                      only, because publishing is the owner's act (§20.3). */}
                  {isOwner && (
                    <div className="border-t border-zinc-200 pt-4">
                      <h3 className="text-sm font-semibold text-zinc-900">The proposal document</h3>
                      <p className="text-sm text-zinc-600 mt-1">
                        The Proposal and the Summary, and the version a recipient’s link is pinned to.
                      </p>
                      <a
                        href={`/ideas/${idea.id}/publish`}
                        className="inline-block mt-2 text-xs px-3 py-1.5 rounded border border-zinc-300 hover:bg-zinc-50"
                      >
                        Open publishing
                      </a>
                    </div>
                  )}
                </div>
              </CollapsedSection>
            </div>
          )}
          {activeTab === 'team' && <TeamTab idea={idea} isOwner={isOwner} ownerReferralCode={currentUserReferralCode} />}
          {activeTab === 'campaign' && ['STAGE_4', 'STAGE_5'].includes(idea.stage) && (
            <CampaignTab ideaId={idea.id} isOwner={isOwner} />
          )}
          {activeTab === 'privacy-log' && isOwner && (
            <PrivacyLogTab ideaId={idea.id} />
          )}
        </div>

        {/* Gate cards — below tab content, owner only */}
        {idea.stage === 'STAGE_2' && isOwner && (
          <div className="mt-6">
            <Stage2GateCard idea={idea} onTakePublic={() => setShowTakePublicModal(true)} />
          </div>
        )}
        {idea.stage === 'STAGE_3' && isOwner && (
          <div className="mt-6">
            <Stage3GateCard reviewCount={ideaReviewCount} avgQualityRating={avgQualityRating} />
          </div>
        )}
        {idea.stage === 'STAGE_4' && isOwner && stage4GateData && (
          <div className="mt-6">
            <Stage4GateCard gate={stage4GateData} />
          </div>
        )}

        {/* Development History — owner only, Stage 3+ (internal contributions archived from Stage 2) */}
        {isOwner && ['STAGE_3', 'STAGE_4', 'STAGE_5'].includes(idea.stage) && (
          <DevelopmentHistory ideaId={idea.id} />
        )}
      </main>
    </>
  )
}
