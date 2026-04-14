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
import WhatNextPanel from '@/components/WhatNextPanel'

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
  mechanismIncentives: string | null
  mechanismRules: string | null
  mechanismTransparency: string | null
  mechanismMarketDesign: string | null
  mechanismInstitutionalRestructuring: string | null
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
  isOwner: boolean
  isCollaborator: boolean
  currentUserId: string | null
  currentUserReferralCode: string | null
  currentUserCanEndorse: boolean
  ideaReviewCount: number
  avgQualityRating: number
  stage4GateData: Stage4Gate | null
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
// Stage stepper
// ─────────────────────────────────────────────────────────────────────────────

function StageStepper({ currentStage }: { currentStage: string }) {
  const currentIndex = STAGES.findIndex(s => s.key === currentStage)

  return (
    <nav aria-label="Idea progress" className="flex items-center gap-0">
      {STAGES.map((stage, i) => {
        const isPast = i < currentIndex
        const isCurrent = i === currentIndex
        const isFuture = i > currentIndex

        return (
          <div key={stage.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                  isPast ? 'bg-foreground text-background' : '',
                  isCurrent ? 'bg-foreground text-background ring-2 ring-foreground ring-offset-2' : '',
                  isFuture ? 'border-2 border-muted-foreground/30 text-muted-foreground/50' : '',
                ].join(' ')}
              >
                {isPast ? <CheckCircle2 className="size-4" /> : i + 1}
              </div>
              <span
                className={[
                  'mt-1 text-[10px] font-medium sm:text-xs',
                  isCurrent ? 'text-foreground' : 'text-muted-foreground',
                ].join(' ')}
              >
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={[
                  'mx-1 mb-4 h-[2px] w-8 sm:w-12',
                  i < currentIndex ? 'bg-foreground' : 'bg-muted-foreground/20',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}

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
    { label: 'Challenge / diagnosis completed', met: !!idea.diagnosis?.trim() },
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

function IdeaTab({
  idea,
  canEdit,
}: {
  idea: Idea
  canEdit: boolean
}) {
  const [subTab, setSubTab] = useState<IdeaSubTab>('overview')
  const [localDiagnosis, setLocalDiagnosis] = useState<DiagnosisRecord | null>(idea.diagnoses[0] ?? null)
  const [localRootCauses, setLocalRootCauses] = useState<RootCauseRecord[]>(idea.rootCauses)
  const [localGuidingPolicy, setLocalGuidingPolicy] = useState<GuidingPolicyRecord | null>(idea.guidingPolicies[0] ?? null)
  const [localEvidence, setLocalEvidence] = useState<EvidenceRecord[]>(idea.evidence)
  const [expandedRootCause, setExpandedRootCause] = useState<string | null>(null)
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null)
  const [expandedAction, setExpandedAction] = useState<string | null>(null)

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

  function updateDiagnosisField(field: keyof DiagnosisRecord, value: string) {
    setLocalDiagnosis(prev => prev
      ? { ...prev, [field]: value }
      : { id: '', diagnosisTitle: null, text: null, obstacleDefined: null, whoAffected: null, howAffected: null, whyPersisted: null, impactDescription: null, impactCost: null, createdAt: '', updatedAt: '', [field]: value }
    )
  }

  function updateGuidingPolicyField(field: keyof GuidingPolicyRecord, value: string) {
    setLocalGuidingPolicy(prev => prev
      ? { ...prev, [field]: value }
      : { id: '', guidingPolicyTitle: null, text: null, coreTheory: null, mechanismIncentives: null, mechanismRules: null, mechanismTransparency: null, mechanismMarketDesign: null, mechanismInstitutionalRestructuring: null, tradeOffs: null, competitiveIdeaAnalysis: null, createdAt: '', [field]: value }
    )
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
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Summary</p>
            {idea.summaryDescription ? (
              <p className="text-sm leading-relaxed text-zinc-800">{idea.summaryDescription}</p>
            ) : (
              <p className="text-sm italic text-zinc-400">Not yet completed</p>
            )}
            {(idea.summaryDiagnosis || idea.summaryGuidingPolicy || idea.summaryCoherentActions) && (
              <div className="mt-5 space-y-4">
                {idea.summaryDiagnosis && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Challenge (summary)</p>
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

      {/* Sub-tab: Diagnosis */}
      {subTab === 'diagnosis' && (
        <div>
          <FieldDisplay label="What's the Challenge?" value={localDiagnosis?.text} placeholder="Not yet completed — describe the challenge in 3–5 sentences" canEdit={canEdit} fieldKey="diagnosis.text" ideaId={idea.id} onSaved={v => updateDiagnosisField('text', v)} />
          <FieldDisplay label="The Obstacle" value={localDiagnosis?.obstacleDefined} placeholder="Not yet completed — define the specific obstacle preventing resolution" canEdit={canEdit} fieldKey="diagnosis.obstacleDefined" ideaId={idea.id} onSaved={v => updateDiagnosisField('obstacleDefined', v)} />
          <FieldDisplay label="Who Is Affected?" value={localDiagnosis?.whoAffected} placeholder="Not yet completed — name the groups, communities or institutions affected" canEdit={canEdit} fieldKey="diagnosis.whoAffected" ideaId={idea.id} onSaved={v => updateDiagnosisField('whoAffected', v)} />
          <FieldDisplay label="How Are They Affected?" value={localDiagnosis?.howAffected} placeholder="Not yet completed — describe the practical impact on those affected" canEdit={canEdit} fieldKey="diagnosis.howAffected" ideaId={idea.id} onSaved={v => updateDiagnosisField('howAffected', v)} />
          <FieldDisplay label="Why Has This Persisted?" value={localDiagnosis?.whyPersisted} placeholder="Not yet completed — explain why existing arrangements have failed" canEdit={canEdit} fieldKey="diagnosis.whyPersisted" ideaId={idea.id} onSaved={v => updateDiagnosisField('whyPersisted', v)} />
          <FieldDisplay label="Impact" value={localDiagnosis?.impactDescription} placeholder="Not yet completed — summarise the harm or cost caused" canEdit={canEdit} fieldKey="diagnosis.impactDescription" ideaId={idea.id} onSaved={v => updateDiagnosisField('impactDescription', v)} />
          <FieldDisplay label="Impact Cost" value={localDiagnosis?.impactCost} placeholder="Not yet completed — quantify the cost if known, or note 'To be researched'" canEdit={canEdit} fieldKey="diagnosis.impactCost" ideaId={idea.id} onSaved={v => updateDiagnosisField('impactCost', v)} />

          {/* Root Cause records */}
          {localRootCauses.length > 0 && (
            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">Root Causes</p>
              <div className="space-y-3">
                {localRootCauses.map(rc => (
                  <div key={rc.id} className="rounded-lg border overflow-hidden">
                    <button
                      onClick={() => setExpandedRootCause(expandedRootCause === rc.id ? null : rc.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
                    >
                      <span className="text-sm font-medium">{rc.rootCauseTitle ?? rc.text?.slice(0, 80) ?? 'Root Cause'}</span>
                      <svg className={`w-4 h-4 text-zinc-400 transition-transform ${expandedRootCause === rc.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedRootCause === rc.id && (
                      <div className="px-4 pb-4 border-t bg-zinc-50/50">
                        <FieldDisplay label="Root Cause" value={rc.text} placeholder="Not yet completed" canEdit={canEdit} fieldKey="rootCause.text" ideaId={idea.id} onSaved={v => setLocalRootCauses(prev => prev.map(r => r.id === rc.id ? { ...r, text: v } : r))} />
                        <FieldDisplay label="The Mechanism" value={rc.rootCauseMechanism} placeholder="Not yet completed — describe the mechanism that causes this" canEdit={canEdit} fieldKey="rootCause.rootCauseMechanism" ideaId={idea.id} onSaved={v => setLocalRootCauses(prev => prev.map(r => r.id === rc.id ? { ...r, rootCauseMechanism: v } : r))} />
                        <FieldDisplay label="Why It Hasn't Been Solved" value={rc.whyNotSolved} placeholder="Not yet completed" canEdit={canEdit} fieldKey="rootCause.whyNotSolved" ideaId={idea.id} onSaved={v => setLocalRootCauses(prev => prev.map(r => r.id === rc.id ? { ...r, whyNotSolved: v } : r))} />
                        <FieldDisplay label="Incentive Drivers" value={rc.incentiveDrivers} placeholder="Not yet completed" canEdit={canEdit} fieldKey="rootCause.incentiveDrivers" ideaId={idea.id} onSaved={v => setLocalRootCauses(prev => prev.map(r => r.id === rc.id ? { ...r, incentiveDrivers: v } : r))} />
                        <FieldDisplay label="Structural Drivers" value={rc.structureDrivers} placeholder="Not yet completed" canEdit={canEdit} fieldKey="rootCause.structureDrivers" ideaId={idea.id} onSaved={v => setLocalRootCauses(prev => prev.map(r => r.id === rc.id ? { ...r, structureDrivers: v } : r))} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {localRootCauses.length === 0 && (
            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">Root Causes</p>
              <p className="text-sm text-zinc-400 italic">Not yet completed — root cause analysis comes in Stage 2</p>
            </div>
          )}
        </div>
      )}

      {/* Sub-tab: Policy */}
      {subTab === 'policy' && (
        <div>
          <FieldDisplay label="How Will We Solve It?" value={localGuidingPolicy?.text} placeholder="Not yet completed — describe the strategic direction in 3–5 sentences" canEdit={canEdit} fieldKey="guidingPolicy.text" ideaId={idea.id} onSaved={v => updateGuidingPolicyField('text', v)} />
          <FieldDisplay label="Core Theory" value={localGuidingPolicy?.coreTheory} placeholder="Not yet completed — the causal theory linking the intervention to the outcome" canEdit={canEdit} fieldKey="guidingPolicy.coreTheory" ideaId={idea.id} onSaved={v => updateGuidingPolicyField('coreTheory', v)} />
          <FieldDisplay label="Mechanism: Incentives" value={localGuidingPolicy?.mechanismIncentives} placeholder="Not yet completed" canEdit={canEdit} fieldKey="guidingPolicy.mechanismIncentives" ideaId={idea.id} onSaved={v => updateGuidingPolicyField('mechanismIncentives', v)} />
          <FieldDisplay label="Mechanism: Rules" value={localGuidingPolicy?.mechanismRules} placeholder="Not yet completed" canEdit={canEdit} fieldKey="guidingPolicy.mechanismRules" ideaId={idea.id} onSaved={v => updateGuidingPolicyField('mechanismRules', v)} />
          <FieldDisplay label="Mechanism: Transparency" value={localGuidingPolicy?.mechanismTransparency} placeholder="Not yet completed" canEdit={canEdit} fieldKey="guidingPolicy.mechanismTransparency" ideaId={idea.id} onSaved={v => updateGuidingPolicyField('mechanismTransparency', v)} />
          <FieldDisplay label="Mechanism: Market Design" value={localGuidingPolicy?.mechanismMarketDesign} placeholder="Not yet completed" canEdit={canEdit} fieldKey="guidingPolicy.mechanismMarketDesign" ideaId={idea.id} onSaved={v => updateGuidingPolicyField('mechanismMarketDesign', v)} />
          <FieldDisplay label="Mechanism: Institutional Restructuring" value={localGuidingPolicy?.mechanismInstitutionalRestructuring} placeholder="Not yet completed" canEdit={canEdit} fieldKey="guidingPolicy.mechanismInstitutionalRestructuring" ideaId={idea.id} onSaved={v => updateGuidingPolicyField('mechanismInstitutionalRestructuring', v)} />
          <FieldDisplay label="Trade-offs" value={localGuidingPolicy?.tradeOffs} placeholder="Not yet completed — what must be sacrificed or accepted to make this work?" canEdit={canEdit} fieldKey="guidingPolicy.tradeOffs" ideaId={idea.id} onSaved={v => updateGuidingPolicyField('tradeOffs', v)} />
          <FieldDisplay label="What Else Has Been Tried?" value={localGuidingPolicy?.competitiveIdeaAnalysis} placeholder="Not yet completed — analysis of competing or prior approaches" canEdit={canEdit} fieldKey="guidingPolicy.competitiveIdeaAnalysis" ideaId={idea.id} onSaved={v => updateGuidingPolicyField('competitiveIdeaAnalysis', v)} />

          {/* Evidence records */}
          {localEvidence.length > 0 && (
            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">Evidence</p>
              <div className="space-y-3">
                {localEvidence.map(ev => (
                  <div key={ev.id} className="rounded-lg border overflow-hidden">
                    <button
                      onClick={() => setExpandedEvidence(expandedEvidence === ev.id ? null : ev.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
                    >
                      <div>
                        <span className="text-sm font-medium">{ev.title}</span>
                        {ev.successFailure && (
                          <span className={`ml-2 text-xs rounded-full px-2 py-0.5 ${ev.successFailure === 'SUCCESS' ? 'bg-green-100 text-green-700' : ev.successFailure === 'FAILURE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {ev.successFailure}
                          </span>
                        )}
                      </div>
                      <svg className={`w-4 h-4 text-zinc-400 transition-transform shrink-0 ${expandedEvidence === ev.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedEvidence === ev.id && (
                      <div className="px-4 pb-4 border-t bg-zinc-50/50 space-y-3">
                        <p className="text-sm text-zinc-700 mt-3">{ev.description}</p>
                        {ev.comparablePolicy && <div><p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">Comparable Policy</p><p className="text-sm">{ev.comparablePolicy}</p></div>}
                        {ev.whatWorked && <div><p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">What Worked</p><p className="text-sm">{ev.whatWorked}</p></div>}
                        {ev.whatFailed && <div><p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">What Failed</p><p className="text-sm">{ev.whatFailed}</p></div>}
                        {ev.sourceUrl && <div><p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">Source</p><a href={ev.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline hover:text-blue-800 break-all">{ev.sourceUrl}</a></div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-tab: Coherent Actions */}
      {subTab === 'actions' && (
        <div>
          {idea.coherentActions.length === 0 && (
            <p className="text-sm text-zinc-400 italic">Not yet completed — coherent actions are built in Stage 2</p>
          )}
          <div className="space-y-3">
            {idea.coherentActions.map((action) => (
              <div key={action.id} className="rounded-lg border overflow-hidden">
                <button
                  onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">{action.title}</span>
                    {action.actionType && (
                      <span className="shrink-0 text-xs rounded-full px-2 py-0.5 bg-blue-100 text-blue-700">
                        {action.actionType}
                      </span>
                    )}
                  </div>
                  <svg className={`w-4 h-4 text-zinc-400 transition-transform shrink-0 ml-2 ${expandedAction === action.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedAction === action.id && (
                  <div className="px-4 pb-4 border-t bg-zinc-50/50">
                    {action.detailedDescription && <div className="mt-3 mb-3"><p className="text-sm text-zinc-700 leading-relaxed">{action.detailedDescription}</p></div>}
                    {action.practicalExecution && <div className="mb-3"><p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">Practical Execution</p><p className="text-sm">{action.practicalExecution}</p></div>}
                    {action.implementationPlan && <div className="mb-3"><p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">Implementation Plan</p><p className="text-sm">{action.implementationPlan}</p></div>}
                    {action.keyRisks && <div className="mb-3"><p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">Key Risks</p><p className="text-sm">{action.keyRisks}</p></div>}
                    {action.costBenefitAnalysis && <div className="mb-3"><p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">Cost–Benefit Analysis</p><p className="text-sm">{action.costBenefitAnalysis}</p></div>}
                  </div>
                )}
              </div>
            ))}
          </div>
          {canEdit && (
            <div className="mt-4">
              <Link href={`/ideas/${idea.id}?tab=lex`} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 border border-dashed rounded-lg px-4 py-2 hover:border-zinc-400 transition-colors">
                + Add Action via Lex
              </Link>
            </div>
          )}
        </div>
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
            The Challenge
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

  const groupTypes = ['MY_TEAM', 'COMMUNICATIONS', 'POLICY_DEVELOPMENT']

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

      {/* Groups */}
      {loaded && groupTypes.map(groupType => {
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

type Tab = 'idea' | 'contributions' | 'research' | 'amendments' | 'team' | 'campaign' | 'privacy-log'

function isValidTab(t: string | null): t is Tab {
  return ['idea', 'overview', 'contributions', 'research', 'amendments', 'team', 'campaign', 'privacy-log'].includes(t ?? '')
}

export default function IdeaDetailClient({
  idea: initialIdea,
  isOwner,
  isCollaborator,
  currentUserId,
  currentUserReferralCode,
  currentUserCanEndorse,
  ideaReviewCount,
  avgQualityRating,
  stage4GateData,
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
    { key: 'contributions', label: `Contributions${commentCount > 0 ? ` (${commentCount})` : ''}` },
    { key: 'amendments', label: 'Amendments' },
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
        {/* Stage stepper */}
        <div className="mb-8 overflow-x-auto pb-1">
          <StageStepper currentStage={idea.stage} />
        </div>

        {/* IdeaOrigin banner */}
        <IdeaOriginBanner idea={idea} />

        {/* Header */}
        <div className="mb-6">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
              {stageLabel}
            </span>
          </div>

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
            {isOwner && ['STAGE_1', 'STAGE_2'].includes(idea.stage) && (
              <Button asChild size="sm">
                <Link href={`/ideas/create?ideaId=${idea.id}`}>Edit</Link>
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
          </div>

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
              <IdeaTab idea={idea} canEdit={isOwner || isCollaborator} />
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
          {activeTab === 'amendments' && (
            <AmendmentsTab
              ideaId={idea.id}
              stage={idea.stage}
              isOwner={isOwner}
              currentUserId={currentUserId}
            />
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
