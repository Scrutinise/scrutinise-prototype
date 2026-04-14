'use client'

import { useState } from 'react'

interface WhatNextPanelProps {
  idea: {
    stage: string
    diagnosis: { diagnosisTitle?: string | null; diagnosisDescription?: string | null } | null
    guidingPolicy: { guidingPolicyTitle?: string | null } | null
    coherentActions: { id: string }[]
  }
  isOpen: boolean
  onClose: () => void
}

const STAGE_SEGMENTS = [
  { label: 'Build your idea', stages: ['STAGE_1', 'STAGE_2'] },
  { label: 'Public scrutiny', stages: ['STAGE_3'] },
  { label: 'Build support', stages: ['STAGE_4'] },
  { label: 'Parliament', stages: ['STAGE_5'] },
]

function getCompletionPercent(idea: WhatNextPanelProps['idea']): number {
  if (['STAGE_1', 'STAGE_2'].includes(idea.stage)) {
    const checks = [
      !!idea.diagnosis?.diagnosisTitle,
      !!idea.diagnosis?.diagnosisDescription,
      !!idea.guidingPolicy?.guidingPolicyTitle,
      idea.coherentActions.length > 0,
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }
  return 50
}

function getStatusMessage(idea: WhatNextPanelProps['idea']): string {
  const { stage, diagnosis, guidingPolicy, coherentActions } = idea

  if (stage === 'STAGE_3') {
    return "Your idea is now public. We encourage you to send a link to prominent experts and invite them to contribute feedback and possible improvements before you start campaigning."
  }

  if (stage === 'STAGE_4') {
    return "You are in the campaigning phase. The objective now is to build as much support and Parliamentary endorsements as possible to allow your idea to be picked up in the Parliamentary process."
  }

  if (stage === 'STAGE_5') {
    return "Your idea has reached Parliament. Focus on supporting your Parliamentary sponsors and responding to committee questions."
  }

  const diagnosisComplete = !!(diagnosis?.diagnosisTitle && diagnosis?.diagnosisDescription)
  const guidingPolicyComplete = !!(guidingPolicy?.guidingPolicyTitle)
  const hasActions = coherentActions.length > 0

  if (!diagnosisComplete) {
    return "The next step is to complete your Diagnosis. Click Edit to describe the challenge you want to address and work with Lex to identify its root causes."
  }

  if (diagnosisComplete && !guidingPolicyComplete) {
    return "You have completed your Diagnosis. The next step is your Guiding Policy — the broad approach that will address the root causes you've identified. Click Edit to continue."
  }

  if (diagnosisComplete && guidingPolicyComplete && !hasActions) {
    return "Your Diagnosis and Guiding Policy are in place. The next step is to define your Coherent Actions — the specific changes you want to make. Click Edit to continue."
  }

  return "You have filled out the basics of the idea. You can now decide whether to do more work on research and refinement before making your idea public — or click 'Take Public' when you're ready."
}

export default function WhatNextPanel({ idea, isOpen, onClose }: WhatNextPanelProps) {
  const [journeyOpen, setJourneyOpen] = useState(false)
  const [tipsOpen, setTipsOpen] = useState(false)

  if (!isOpen) return null

  const completionPct = getCompletionPercent(idea)
  const currentSegmentIndex = STAGE_SEGMENTS.findIndex(s => s.stages.includes(idea.stage))

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">What Next?</h3>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Close
        </button>
      </div>

      {/* Section 1 — Progress bar */}
      <div className="mb-5">
        <div className="flex gap-1 mb-2">
          {STAGE_SEGMENTS.map((seg, i) => {
            const isCurrent = i === currentSegmentIndex
            const isPast = i < currentSegmentIndex
            return (
              <div key={seg.label} className={`flex flex-col ${isCurrent ? 'flex-[2]' : 'flex-1'}`}>
                <div className={`h-1.5 rounded-full mb-1 overflow-hidden ${isPast ? 'bg-zinc-900' : isCurrent ? 'bg-zinc-200' : 'bg-zinc-100'}`}>
                  {isCurrent && (
                    <div
                      className="h-full bg-zinc-900 rounded-full transition-all duration-700"
                      style={{ width: `${completionPct}%` }}
                    />
                  )}
                </div>
                <p className={`text-[10px] leading-tight ${isCurrent ? 'text-zinc-700 font-medium' : 'text-zinc-400'}`}>
                  {seg.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 3 — Where you are now (always visible) */}
      <div className="mb-4">
        <p className="text-sm text-zinc-700">{getStatusMessage(idea)}</p>
      </div>

      {/* Section 2 — Journey overview (collapsible) */}
      <div className="mb-3 border-t border-gray-200 pt-3">
        <button
          className="flex items-center justify-between w-full text-xs font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          onClick={() => setJourneyOpen(o => !o)}
        >
          <span>What does this journey involve?</span>
          <svg className={`w-3.5 h-3.5 transition-transform ${journeyOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {journeyOpen && (
          <div className="mt-2 text-xs text-zinc-600 space-y-2">
            <p>You are currently building your idea to the point where it is robust enough for public scrutiny. This requires three main elements:</p>
            <p><strong>1. The Diagnosis</strong> — getting complete clarity on the challenge and its causes. Until this is clear, it is hard to form an effective policy. The key to solving any challenge or problem is figuring out what&apos;s causing it. This is critically important because if we identify the wrong causes we&apos;ll end up with the wrong solution.</p>
            <p><strong>2. The Guiding Policy</strong> — stating in broad terms what approach will overcome the challenge. You need a guiding policy because you need a set of principles and goals to judge your specific actions against. Without these, you won&apos;t know whether your actions will actually solve the problem.</p>
            <p><strong>3. Coherent Actions</strong> — the specific changes you want to make, such as legislation changes or organisational reforms. These should be made as robust as possible with research, evidence, and honest analysis of costs and opposition.</p>
          </div>
        )}
      </div>

      {/* Section 4 — Ways to improve (collapsible, Stage 2+) */}
      {['STAGE_2', 'STAGE_3', 'STAGE_4', 'STAGE_5'].includes(idea.stage) && (
        <div className="border-t border-gray-200 pt-3">
          <button
            className="flex items-center justify-between w-full text-xs font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
            onClick={() => setTipsOpen(o => !o)}
          >
            <span>Ways to improve your idea</span>
            <svg className={`w-3.5 h-3.5 transition-transform ${tipsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {tipsOpen && (
            <div className="mt-2 text-xs text-zinc-600 space-y-2">
              {idea.stage === 'STAGE_2' && (
                <p>You can now invite collaborators to help you. Click the <strong>Team</strong> tab and invite friends, colleagues, or subject experts. Each of them will have access to Lex to help build your evidence base. You can restrict their roles — Editor can contribute text, Viewer can read only.</p>
              )}
              {idea.stage === 'STAGE_3' && (
                <p>Your idea is now open for public scrutiny. Share the link with people who can give you constructive feedback. You need at least 12 reviews with an average quality rating of 2.5 or above to advance to Campaign stage.</p>
              )}
              {['STAGE_4', 'STAGE_5'].includes(idea.stage) && (
                <p>Your idea is in Campaign mode. Build support by reaching out to MPs and Peers for endorsements. Use the Campaign in a Box tools to create briefing documents and press materials.</p>
              )}
              <p className="mt-2">Once your idea moves to Stage 3, you will be able to access various templates designed to help you promote your idea for support in different contexts such as social media or to Parliamentarians, and trackable links to enable you to build a marketing team over multiple levels to campaign and build support for your idea.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
