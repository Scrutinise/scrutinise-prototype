'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useUser, SignInButton } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import FieldProposalCard from '@/components/FieldProposalCard'
import LexThinking from '@/components/LexThinking'
import PublicNav from '@/components/PublicNav'
import SiteFooter from '@/components/SiteFooter'
import { SIDEBAR_SECTIONS } from '@/lib/field-labels'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PendingProposal {
  fieldKey: string
  fieldLabel: string
  proposedValue: string
  status: 'pending' | 'saved' | 'discussed'
  savedValue?: string
}

interface ChatMessage {
  role: 'user' | 'lex'
  content: string
  timestamp: string
  proposals?: PendingProposal[]
  isConnectionError?: boolean
  isStreaming?: boolean
}

interface FieldCompletion {
  // Stage 1
  title: boolean
  summaryDiagnosis: boolean
  rootCause: boolean
  summaryGuidingPolicy: boolean
  summaryCoherentActions: boolean
  whoAffected: boolean
  proposedWording: boolean
  // Stage 2 — Diagnosis section
  diagnosisText: boolean
  diagnosisObstacleDefined: boolean
  diagnosisWhoAffected: boolean
  diagnosisHowAffected: boolean
  diagnosisWhyPersisted: boolean
  diagnosisImpactDescription: boolean
  diagnosisImpactCost: boolean
  // Stage 2 — Guiding Policy section
  guidingPolicyText: boolean
  guidingPolicyCoreTheory: boolean
  guidingPolicyMechanism: boolean
  guidingPolicyTradeOffs: boolean
  guidingPolicyCompetitiveIdeaAnalysis: boolean
}

interface Props {
  openingMessage?: string
  initialIdeaId?: string
  initialMessages?: unknown[]
  initialStage?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_OPENING_MESSAGE = "I'm Lex, your researcher and guide. What's the challenge you want to fix?"

const SIDEBAR_FIELDS: { key: keyof FieldCompletion; label: string }[] = [
  { key: 'title',                  label: 'Title' },
  { key: 'summaryDiagnosis',       label: "What's the Challenge?" },
  { key: 'rootCause',              label: "What's Causing It?" },
  { key: 'summaryGuidingPolicy',   label: 'How Will We Solve It?' },
  { key: 'summaryCoherentActions', label: 'A Practical Step' },
  { key: 'whoAffected',            label: "Who's Affected?" },
  { key: 'proposedWording',        label: 'Proposed Wording' },
]

const EMPTY_FIELDS: FieldCompletion = {
  // Stage 1
  title: false, summaryDiagnosis: false, rootCause: false,
  summaryGuidingPolicy: false, summaryCoherentActions: false,
  whoAffected: false, proposedWording: false,
  // Stage 2 — Diagnosis
  diagnosisText: false, diagnosisObstacleDefined: false,
  diagnosisWhoAffected: false, diagnosisHowAffected: false,
  diagnosisWhyPersisted: false, diagnosisImpactDescription: false, diagnosisImpactCost: false,
  // Stage 2 — Guiding Policy
  guidingPolicyText: false, guidingPolicyCoreTheory: false,
  guidingPolicyMechanism: false, guidingPolicyTradeOffs: false,
  guidingPolicyCompetitiveIdeaAnalysis: false,
}

// ── Stage 2 sidebar ───────────────────────────────────────────────────────────

type SidebarSection = 'diagnosis' | 'guidingPolicy' | 'coherentActions'

const DIAGNOSIS_FIELDS: { key: keyof FieldCompletion; label: string }[] = [
  { key: 'diagnosisText',              label: "What's the Challenge?" },
  { key: 'diagnosisObstacleDefined',   label: 'The Obstacle' },
  { key: 'diagnosisWhoAffected',       label: "Who's Affected?" },
  { key: 'diagnosisHowAffected',       label: 'How Are They Affected?' },
  { key: 'diagnosisWhyPersisted',      label: "Why Has This Persisted?" },
  { key: 'diagnosisImpactDescription', label: 'Impact' },
  { key: 'diagnosisImpactCost',        label: 'Impact Cost' },
]

const GUIDING_POLICY_FIELDS: { key: keyof FieldCompletion; label: string }[] = [
  { key: 'guidingPolicyText',                    label: 'How Will We Solve It?' },
  { key: 'guidingPolicyCoreTheory',              label: 'Core Theory' },
  { key: 'guidingPolicyMechanism',               label: 'The Mechanism' },
  { key: 'guidingPolicyTradeOffs',               label: 'Trade-offs' },
  { key: 'guidingPolicyCompetitiveIdeaAnalysis', label: 'What Else Has Been Tried?' },
]

function CheckIcon() {
  return (
    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function Stage2Sidebar({
  fields,
  coherentActionsCount,
  isLoading,
  sidebarExpanded,
  openFields,
  onToggleField,
  fieldValues,
}: {
  fields: FieldCompletion
  coherentActionsCount: number
  isLoading: boolean
  sidebarExpanded: boolean
  openFields: Set<string>
  onToggleField: (key: string) => void
  fieldValues: Record<string, string>
}) {
  const [showDiagnosis, setShowDiagnosis] = useState(false)
  const [showGuidingPolicy, setShowGuidingPolicy] = useState(false)

  const diagnosisFieldsDone = DIAGNOSIS_FIELDS.filter(f => fields[f.key]).length
  const diagnosisTotal = DIAGNOSIS_FIELDS.length
  const diagnosisComplete = diagnosisFieldsDone === diagnosisTotal

  const guidingPolicyFieldsDone = GUIDING_POLICY_FIELDS.filter(f => fields[f.key]).length
  const guidingPolicyTotal = GUIDING_POLICY_FIELDS.length
  const guidingPolicyComplete = guidingPolicyFieldsDone === guidingPolicyTotal

  // Determine active section
  let activeSection: SidebarSection = 'diagnosis'
  if (diagnosisComplete && !guidingPolicyComplete) activeSection = 'guidingPolicy'
  if (diagnosisComplete && guidingPolicyComplete) activeSection = 'coherentActions'

  function renderFieldRow(key: keyof FieldCompletion, label: string) {
    const done = fields[key]
    const active = isLoading && !done
    const keyStr = String(key)
    const isOpen = openFields.has(keyStr)
    const value = fieldValues[keyStr]

    return (
      <div key={keyStr} className="mb-1">
        <div
          className={`flex items-center gap-2 py-1 ${value ? 'cursor-pointer group' : ''}`}
          onClick={() => value && onToggleField(keyStr)}
        >
          <span className={`shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors ${
            done ? 'bg-green-500' : active ? 'bg-amber-400' : 'bg-zinc-200'
          }`}>
            {done && <CheckIcon />}
          </span>
          <span className={`text-xs transition-colors flex-1 ${done ? 'text-zinc-900 font-medium' : 'text-zinc-500'}`}>
            {label}
          </span>
          {value && (
            <span className="text-xs text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
              {isOpen ? '▲' : '▼'}
            </span>
          )}
        </div>
        {value && isOpen && (
          <div className="mt-1 ml-5 text-xs text-foreground bg-muted/40 rounded p-2 leading-relaxed field-accept-animation">
            {value.length > 200 && !sidebarExpanded
              ? value.substring(0, 200) + '…'
              : value
            }
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Section headings from SIDEBAR_SECTIONS */}
      {SIDEBAR_SECTIONS.map(section => {
        if (section.key === 'diagnosis') {
          if (diagnosisComplete) {
            return (
              <div key="diagnosis">
                <button
                  onClick={() => setShowDiagnosis(v => !v)}
                  className="flex w-full items-center gap-2 py-1.5 text-left"
                >
                  <span className="shrink-0 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckIcon />
                  </span>
                  <span className="text-sm font-medium text-zinc-900 flex-1">
                    {section.label.split(' — ')[0]} ({diagnosisFieldsDone}/{diagnosisTotal})
                  </span>
                  <span className="text-[10px] text-zinc-400">{showDiagnosis ? 'hide' : 'show'}</span>
                </button>
                {showDiagnosis && (
                  <div className="pl-6">
                    {DIAGNOSIS_FIELDS.map(({ key, label }) => renderFieldRow(key, label))}
                  </div>
                )}
              </div>
            )
          }
          if (activeSection === 'diagnosis') {
            return (
              <div key="diagnosis">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">{section.label.split(' — ')[0]}</p>
                {DIAGNOSIS_FIELDS.map(({ key, label }) => renderFieldRow(key, label))}
              </div>
            )
          }
          return (
            <p key="diagnosis" className="text-xs text-zinc-400 py-1">{section.label.split(' — ')[0]}</p>
          )
        }

        if (section.key === 'guidingPolicy') {
          if (!diagnosisComplete && activeSection !== 'guidingPolicy') {
            return (
              <p key="guidingPolicy" className="text-xs text-zinc-400 py-1">{section.label.split(' — ')[0]}</p>
            )
          }
          if (guidingPolicyComplete) {
            return (
              <div key="guidingPolicy">
                <button
                  onClick={() => setShowGuidingPolicy(v => !v)}
                  className="flex w-full items-center gap-2 py-1.5 text-left"
                >
                  <span className="shrink-0 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckIcon />
                  </span>
                  <span className="text-sm font-medium text-zinc-900 flex-1">
                    {section.label.split(' — ')[0]} ({guidingPolicyFieldsDone}/{guidingPolicyTotal})
                  </span>
                  <span className="text-[10px] text-zinc-400">{showGuidingPolicy ? 'hide' : 'show'}</span>
                </button>
                {showGuidingPolicy && (
                  <div className="pl-6">
                    {GUIDING_POLICY_FIELDS.map(({ key, label }) => renderFieldRow(key, label))}
                  </div>
                )}
              </div>
            )
          }
          if (activeSection === 'guidingPolicy') {
            return (
              <div key="guidingPolicy">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">{section.label.split(' — ')[0]}</p>
                {GUIDING_POLICY_FIELDS.map(({ key, label }) => renderFieldRow(key, label))}
              </div>
            )
          }
          return (
            <p key="guidingPolicy" className="text-xs text-zinc-400 py-1">{section.label.split(' — ')[0]}</p>
          )
        }

        if (section.key === 'coherentActions') {
          if (!diagnosisComplete) return null
          if (activeSection === 'coherentActions') {
            return (
              <div key="coherentActions">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">{section.label.split(' — ')[0]}</p>
                <p className="text-xs text-zinc-500">
                  {coherentActionsCount > 0
                    ? `${coherentActionsCount} action${coherentActionsCount === 1 ? '' : 's'} added`
                    : 'No actions yet'}
                </p>
              </div>
            )
          }
          return (
            <p key="coherentActions" className="text-xs text-zinc-400 py-1">{section.label.split(' — ')[0]}</p>
          )
        }

        return null
      })}
    </div>
  )
}

// Progress map per UX notes Section 4 / lex_system_prompt_v5 Section 18
function calcProgress(userMsgCount: number, fields: FieldCompletion, stage: string, coherentActionsCount: number): number {
  if (stage === 'STAGE_2') {
    const diagnosisComplete = fields.diagnosisText && fields.diagnosisWhoAffected &&
      fields.diagnosisHowAffected && fields.diagnosisWhyPersisted &&
      fields.diagnosisImpactDescription && fields.diagnosisImpactCost && fields.diagnosisObstacleDefined
    const guidingPolicyComplete = fields.guidingPolicyText && fields.guidingPolicyCoreTheory &&
      fields.guidingPolicyMechanism && fields.guidingPolicyTradeOffs && fields.guidingPolicyCompetitiveIdeaAnalysis
    if (diagnosisComplete && guidingPolicyComplete && coherentActionsCount > 0) return 95
    if (coherentActionsCount > 0) return 85
    if (guidingPolicyComplete) return 70
    if (diagnosisComplete) return 40
    if (fields.diagnosisText) return 25
    return 15
  }
  const { summaryDiagnosis, rootCause, summaryGuidingPolicy, summaryCoherentActions, whoAffected } = fields
  const allCore = summaryDiagnosis && rootCause && summaryGuidingPolicy && summaryCoherentActions && whoAffected
  if (allCore)                    return 90
  if (summaryCoherentActions)     return 75
  if (summaryGuidingPolicy)       return 60
  if (summaryDiagnosis)           return 45
  if (userMsgCount >= 2)          return 30
  if (userMsgCount >= 1)          return 20
  return 0
}

const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx'

// ─────────────────────────────────────────────────────────────────────────────
// MobileSidebarContent — shown in full-screen overlay on mobile
// ─────────────────────────────────────────────────────────────────────────────

function MobileSidebarContent({
  fields,
  fieldValues,
  onEditField,
  onChatField,
}: {
  fields: FieldCompletion
  fieldValues: Record<string, string>
  onEditField: (fieldKey: string, fieldLabel: string, value: string) => void
  onChatField: (fieldLabel: string) => void
}) {
  const allSidebarFields = [
    ...DIAGNOSIS_FIELDS,
    ...GUIDING_POLICY_FIELDS,
  ]

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {allSidebarFields.map(({ key, label }) => {
        const done = fields[key]
        const value = fieldValues[String(key)]
        return (
          <div key={String(key)} className={`rounded-lg p-3 border ${done ? 'border-teal-200 bg-teal-50/50' : 'border-zinc-100'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${done ? 'bg-teal-500' : 'bg-zinc-200'}`} />
              <span className={`text-xs font-medium ${done ? 'text-zinc-800' : 'text-zinc-400'}`}>{label}</span>
            </div>
            {value && (
              <p className="text-xs text-zinc-600 leading-relaxed line-clamp-2 mb-2">{value}</p>
            )}
            {done && value && (
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => onEditField(String(key), label, value)}
                  className="text-[11px] px-2 py-1 rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  ✏ Edit
                </button>
                <button
                  onClick={() => onChatField(label)}
                  className="text-[11px] px-2 py-1 rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  💬 Chat
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function CreateIdeaClient({ openingMessage, initialIdeaId, initialMessages, initialStage }: Props) {
  const { isSignedIn } = useUser()
  const router = useRouter()
  const resolvedOpening = openingMessage ?? DEFAULT_OPENING_MESSAGE

  const resolvedInitialMessages = (initialMessages as ChatMessage[] | undefined)?.length
    ? (initialMessages as ChatMessage[])
    : [{ role: 'lex' as const, content: resolvedOpening, timestamp: new Date().toISOString() }]

  const [messages, setMessages] = useState<ChatMessage[]>(resolvedInitialMessages)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [ideaId, setIdeaId] = useState<string | null>(initialIdeaId ?? null)
  const [currentStage, setCurrentStage] = useState<string>(initialStage ?? 'STAGE_1')
  const [coherentActionsCount, setCoherentActionsCount] = useState(0)
  const [saveExitMsg, setSaveExitMsg] = useState<string | null>(null)
  const [fields, setFields] = useState<FieldCompletion>(EMPTY_FIELDS)
  const [userMsgCount, setUserMsgCount] = useState(0)
  const [retryCount, setRetryCount] = useState(0)
  const [retryMessage, setRetryMessage] = useState<string | null>(null)
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [supportsVoice, setSupportsVoice] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [showMicHint, setShowMicHint] = useState(false)
  const [distanceFromBottom, setDistanceFromBottom] = useState(0)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  // Commit 3 — mobile panel
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  // Commit 4 — desktop sidebar expand + field value display
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [openFields, setOpenFields] = useState<Set<string>>(new Set())
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  // Commit 6 — current fieldProposal card
  const [currentProposal, setCurrentProposal] = useState<{
    fieldKey: string
    fieldLabel: string
    proposedValue: string
  } | null>(null)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const micHintInteracted = useRef(false)
  const lastSentMessageRef = useRef<string>('')
  // Commit 3 — outer touch refs for mobile panel swipe
  const outerTouchStartX = useRef<number>(0)
  const outerTouchStartY = useRef<number>(0)

  const progress = calcProgress(userMsgCount, fields, currentStage, coherentActionsCount)

  // ── Voice detection ────────────────────────────────────────────────────────
  useEffect(() => {
    const hasVoice = !!(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    )
    setSupportsVoice(hasVoice)

    if (hasVoice && localStorage.getItem('hasSeenMicHint') !== 'true') {
      setShowMicHint(true)
      const t = setTimeout(() => {
        setShowMicHint(false)
        localStorage.setItem('hasSeenMicHint', 'true')
      }, 6000)
      return () => clearTimeout(t)
    }
  }, [])

  // ── Auto-focus input ───────────────────────────────────────────────────────
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ── Refocus input after FieldProposalCard acceptance ──────────────────────
  useEffect(() => {
    const handler = () => inputRef.current?.focus()
    window.addEventListener('lex-field-accepted', handler)
    return () => window.removeEventListener('lex-field-accepted', handler)
  }, [])

  // ── Scroll to bottom after new messages ───────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, isLoading])

  // ── Track scroll position for scroll-up arrow ─────────────────────────────
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight
      setDistanceFromBottom(dist)
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // ── Auto-save (3s debounced PATCH — spec: "3 seconds of inactivity") ───────
  const autoSave = useCallback(async () => {
    if (!ideaId || !isSignedIn) return
    try {
      await fetch(`/api/ideas/${ideaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiChatHistory: messages }),
      })
    } catch {
      // silent — auto-save is best-effort
    }
  }, [ideaId, isSignedIn, messages])

  useEffect(() => {
    if (!ideaId) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(autoSave, 3_000)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [messages, ideaId, autoSave])

  // ── Dismiss mic hint on first user interaction ─────────────────────────────
  const dismissMicHint = useCallback(() => {
    if (micHintInteracted.current) return
    micHintInteracted.current = true
    setShowMicHint(false)
    localStorage.setItem('hasSeenMicHint', 'true')
  }, [])

  // ── Ensure idea record exists (auth only) ─────────────────────────────────
  const ensureIdea = async (): Promise<string | null> => {
    if (ideaId) return ideaId
    if (!isSignedIn) return null
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled idea' }),
      })
      if (!res.ok) return null
      const data = await res.json()
      setIdeaId(data.id)
      return data.id
    } catch {
      return null
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────
  // systemMessageOverride: when set, sends a silent system signal to Lex without
  // displaying it in the chat UI (used for "Accepted: [label]" in field protocol)
  const handleSend = async (isRetry = false, systemMessageOverride?: string) => {
    const isSystemMessage = !!systemMessageOverride
    const text = systemMessageOverride ?? inputValue.trim()
    if (!isRetry && !isSystemMessage && !text && !attachedFile) return
    if (isLoading && !isRetry) return

    const messageText = isRetry
      ? lastSentMessageRef.current
      : isSystemMessage
      ? systemMessageOverride!
      : (() => {
          dismissMicHint()
          let mt = text
          if (attachedFile) {
            const fileNote = `[User attached: ${attachedFile.name}]`
            mt = text ? `${fileNote}\n\n${text}` : fileNote
          }
          return mt
        })()

    if (!isRetry && !isSystemMessage) {
      setInputValue('')
      setAttachedFile(null)
      if (inputRef.current) inputRef.current.style.height = 'auto'
      setUserMsgCount(prev => prev + 1)
      const userMsg: ChatMessage = {
        role: 'user',
        content: text || `[Attached: ${attachedFile!.name}]`,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, userMsg])
      lastSentMessageRef.current = messageText
    } else if (!isRetry && isSystemMessage) {
      // System messages don't appear in chat or update lastSentMessageRef
    }

    setIsLoading(true)

    try {
      // Add a streaming placeholder message immediately
      setMessages(prev => [...prev, {
        role: 'lex',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true,
      }])

      let res: Response

      if (isSignedIn) {
        const id = await ensureIdea()
        if (!id) throw new Error('Could not create idea record')
        res = await fetch(`/api/ai/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText }),
        })
      } else {
        res = await fetch('/api/ai/public', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: messageText,
            history: messages
              .filter(m => !m.isConnectionError && !m.isStreaming)
              .map(m => ({ role: m.role, content: m.content })),
          }),
        })
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const err = new Error('Lex unavailable') as Error & { errorType?: string }
        err.errorType = errorData.errorType ?? 'api_error'
        throw err
      }

      // Check if streaming response
      const contentType = res.headers.get('Content-Type') ?? ''
      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let doneData: Record<string, unknown> | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const event = JSON.parse(line.slice(6)) as { type: string; text?: string; errorType?: string; [key: string]: unknown }

              if (event.type === 'token' && event.text) {
                setMessages(prev => {
                  const updated = [...prev]
                  const lastIdx = updated.length - 1
                  if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
                    updated[lastIdx] = { ...updated[lastIdx], content: updated[lastIdx].content + event.text }
                  }
                  return updated
                })
              } else if (event.type === 'error') {
                throw Object.assign(new Error('Lex unavailable'), { errorType: event.errorType ?? 'both_failed' })
              } else if (event.type === 'done') {
                doneData = event
              }
            } catch (parseErr) {
              if ((parseErr as { errorType?: string }).errorType) throw parseErr
            }
          }
        }

        // Finalise streaming message
        if (doneData) {
          const proposals: PendingProposal[] | undefined = (doneData.pendingProposals as Array<Omit<PendingProposal, 'status'>> | undefined)?.length
            ? (doneData.pendingProposals as Array<Omit<PendingProposal, 'status'>>).map(p => ({ ...p, status: 'pending' as const }))
            : undefined

          setMessages(prev => {
            const updated = [...prev]
            const lastIdx = updated.length - 1
            if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: (doneData!.response as string | undefined) ?? updated[lastIdx].content,
                isStreaming: false,
                proposals,
              }
            }
            return updated
          })

          if (doneData.completedFields) setFields(prev => ({ ...prev, ...(doneData!.completedFields as Partial<FieldCompletion>) }))
          if (doneData.currentStage) setCurrentStage(doneData.currentStage as string)
          if (typeof doneData.coherentActionsCount === 'number') setCoherentActionsCount(doneData.coherentActionsCount as number)
          if (doneData.triggerSavePrompt && !isSignedIn) setShowSavePrompt(true)
          // Commit 6 — handle fieldProposal for new Lex field protocol
          if (doneData.fieldProposal) {
            const fp = doneData.fieldProposal as { fieldKey: string; fieldLabel: string; proposedValue: string }
            if (fp.fieldKey && fp.fieldLabel && fp.proposedValue) {
              setCurrentProposal(fp)
            }
          }
          // Commit 4 — auto-open newly completed fields in sidebar
          if (doneData.completedFields) {
            const cf = doneData.completedFields as Partial<FieldCompletion>
            const newlyDone = Object.entries(cf).filter(([, v]) => v).map(([k]) => k)
            if (newlyDone.length > 0) {
              setOpenFields(prev => {
                const next = new Set(prev)
                newlyDone.forEach(k => next.add(k))
                return next
              })
            }
          }
        } else {
          // Mark streaming as done even if no doneData
          setMessages(prev => {
            const updated = [...prev]
            const lastIdx = updated.length - 1
            if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
              updated[lastIdx] = { ...updated[lastIdx], isStreaming: false }
            }
            return updated
          })
        }
      } else {
        // Non-streaming fallback (public API)
        const data = await res.json()

        if (data.completedFields) setFields(prev => ({ ...prev, ...data.completedFields }))
        if (data.currentStage) setCurrentStage(data.currentStage)
        if (typeof data.coherentActionsCount === 'number') setCoherentActionsCount(data.coherentActionsCount)
        if (data.triggerSavePrompt && !isSignedIn) setShowSavePrompt(true)

        const proposals: PendingProposal[] | undefined = data.pendingProposals?.length
          ? data.pendingProposals.map((p: Omit<PendingProposal, 'status'>) => ({ ...p, status: 'pending' as const }))
          : undefined

        setMessages(prev => {
          const updated = [...prev]
          const lastIdx = updated.length - 1
          if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
            updated[lastIdx] = {
              role: 'lex',
              content: data.response ?? data.reply ?? '',
              timestamp: new Date().toISOString(),
              isStreaming: false,
              proposals,
            }
          }
          return updated
        })
      }

      // Successful response — reset retry state
      setRetryCount(0)
      setRetryMessage(null)
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    } catch (error: unknown) {
      const errorType = (error as { errorType?: string })?.errorType ?? 'api_error'

      // Remove streaming placeholder on error
      setMessages(prev => prev.filter(m => !m.isStreaming))

      if (retryCount === 0) {
        // First failure: silent auto-retry after 1 second
        setRetryCount(1)
        setIsLoading(false)
        setTimeout(() => handleSend(true), 1000)
        return
      }

      if (retryCount === 1 && (errorType === 'timeout' || errorType === 'rate_limit')) {
        // Second failure with recoverable error: show message + auto-retry after 5 seconds
        setRetryCount(2)
        const providerLabel = errorType === 'timeout' ? 'Gemini' : 'Lex'
        setRetryMessage(`${providerLabel} is taking a while to think — we'll keep trying, thank you for your patience.`)
        setIsLoading(false)
        setTimeout(() => handleSend(true), 5000)
        return
      }

      // Final failure or unrecoverable error
      setRetryCount(0)
      setRetryMessage(null)
      setMessages(prev => [...prev, {
        role: 'lex',
        content: errorType === 'both_failed'
          ? 'Lex is temporarily unavailable — please try again in a moment.'
          : 'Lex is taking a while — please try again.',
        timestamp: new Date().toISOString(),
        isConnectionError: true,
      }])
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }


  // ── Manual retry after connection error ───────────────────────────────────
  const handleRetry = () => {
    if (!lastSentMessageRef.current || isLoading) return
    setMessages(prev => prev.filter(m => !m.isConnectionError))
    setRetryCount(0)
    handleSend(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    // Auto-expand
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
    // Dismiss mic hint on first keystroke
    dismissMicHint()
  }

  // ── File attachment ────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setAttachedFile(file)
    // Reset so re-selecting the same file fires onChange
    e.target.value = ''
    dismissMicHint()
  }

  // ── Voice dictation ───────────────────────────────────────────────────────
  const startDictation = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    dismissMicHint()

    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-GB'

    recognition.onstart = () => setIsListening(true)
    recognition.onresult = (event: { results: SpeechRecognitionResultList }) => {
      const transcript = Array.from(event.results).map(r => r[0].transcript).join('')
      setInputValue(transcript)
      if (inputRef.current) {
        inputRef.current.style.height = 'auto'
        inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
      }
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = (event: { error: string }) => {
      setIsListening(false)
      if (event.error === 'not-allowed') setSupportsVoice(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }

  const completedCount = Object.values(fields).filter(Boolean).length

  // Check if any proposals across all messages are still pending
  const hasPendingProposals = messages.some(
    m => m.proposals?.some(p => p.status === 'pending')
  )

  const canSend = (inputValue.trim().length > 0 || attachedFile !== null) && !isLoading && !hasPendingProposals

  // ── Proposal handlers ─────────────────────────────────────────────────────

  const handleProposalAccept = useCallback(async (msgIndex: number, proposalIndex: number, value: string) => {
    const proposal = messages[msgIndex]?.proposals?.[proposalIndex]
    if (!proposal) return

    // Normalise field key for sidebar value display (e.g. 'diagnosis.text' → 'diagnosisText')
    const normKey = proposal.fieldKey.replace(/\.([a-z])/g, (_: string, c: string) => c.toUpperCase())
    setFieldValues(prev => ({ ...prev, [normKey]: value, [proposal.fieldKey]: value }))
    setOpenFields(prev => { const next = new Set(prev); next.add(normKey); return next })

    if (!ideaId || !isSignedIn) {
      // Unauthenticated — just mark as saved locally
      setMessages(prev => prev.map((msg, mi) => {
        if (mi !== msgIndex) return msg
        const proposals = msg.proposals?.map((p, pi) =>
          pi === proposalIndex ? { ...p, status: 'saved' as const, savedValue: value } : p
        )
        return { ...msg, proposals }
      }))
      return
    }

    try {
      const res = await fetch(`/api/ideas/${ideaId}/field-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldKey: proposal.fieldKey, value }),
      })
      if (!res.ok) throw new Error('Field approval failed')
      const data = await res.json()

      // Update proposal status
      setMessages(prev => prev.map((msg, mi) => {
        if (mi !== msgIndex) return msg
        const proposals = msg.proposals?.map((p, pi) =>
          pi === proposalIndex ? { ...p, status: 'saved' as const, savedValue: value } : p
        )
        return { ...msg, proposals }
      }))

      // Update sidebar completion
      if (data.completedFields) {
        setFields(prev => ({ ...prev, ...data.completedFields }))
      }
      if (data.currentStage) setCurrentStage(data.currentStage)
      if (typeof data.coherentActionsCount === 'number') setCoherentActionsCount(data.coherentActionsCount)
    } catch {
      // Silent — card stays in pending state
    }
  }, [ideaId, isSignedIn, messages])

  const handleProposalEdit = useCallback((msgIndex: number, proposalIndex: number, proposedValue: string) => {
    // Mark proposal as discussed (hides card), copy proposed text to chat input
    setMessages(prev => prev.map((msg, mi) => {
      if (mi !== msgIndex) return msg
      const proposals = msg.proposals?.map((p, pi) =>
        pi === proposalIndex ? { ...p, status: 'discussed' as const } : p
      )
      return { ...msg, proposals }
    }))
    setInputValue(proposedValue)
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.style.height = 'auto'
        inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
      }
    }, 0)
  }, [])

  const handleProposalDiscuss = useCallback((msgIndex: number, proposalIndex: number) => {
    setMessages(prev => prev.map((msg, mi) => {
      if (mi !== msgIndex) return msg
      const proposals = msg.proposals?.map((p, pi) =>
        pi === proposalIndex ? { ...p, status: 'discussed' as const } : p
      )
      return { ...msg, proposals }
    }))
  }, [])

  const handleAcceptAll = useCallback(async (msgIndex: number) => {
    const msg = messages[msgIndex]
    if (!msg?.proposals) return
    for (let pi = 0; pi < msg.proposals.length; pi++) {
      const p = msg.proposals[pi]
      if (p.status === 'pending') {
        await handleProposalAccept(msgIndex, pi, p.proposedValue)
      }
    }
  }, [messages, handleProposalAccept])

  // ── Commit 6: Accept from currentProposal (new Lex field protocol) ────────
  const handleCurrentProposalAccept = useCallback(async (value: string) => {
    if (!currentProposal) return
    const { fieldKey, fieldLabel } = currentProposal
    // Normalise key for sidebar display
    const normKey = fieldKey.replace(/\.([a-z])/g, (_: string, c: string) => c.toUpperCase())
    // Optimistic sidebar update
    setFieldValues(prev => ({ ...prev, [normKey]: value, [fieldKey]: value }))
    setOpenFields(prev => { const next = new Set(prev); next.add(normKey); return next })
    setCurrentProposal(null)
    // Send silent system message so Lex knows to populate the field and move on
    await handleSend(false, `Accepted: ${fieldLabel}`)
  }, [currentProposal, handleSend])

  const handleCurrentProposalEdit = useCallback((proposedValue: string) => {
    setCurrentProposal(null)
    setInputValue(proposedValue)
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.style.height = 'auto'
        inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
      }
    }, 0)
  }, [])

  const handleCurrentProposalDiscuss = useCallback(() => {
    setCurrentProposal(null)
  }, [])

  // ── Commit 3: Mobile panel swipe handlers ─────────────────────────────────
  const PANEL_SWIPE_THRESHOLD = 80
  const PANEL_SWIPE_RATIO = 2.0

  const handleOuterTouchStart = useCallback((e: React.TouchEvent) => {
    outerTouchStartX.current = e.touches[0].clientX
    outerTouchStartY.current = e.touches[0].clientY
  }, [])

  const handleOuterTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - outerTouchStartX.current
    const dy = e.changedTouches[0].clientY - outerTouchStartY.current
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (absDx > PANEL_SWIPE_THRESHOLD && absDx > absDy * PANEL_SWIPE_RATIO) {
      if (dx > 0 && !mobilePanelOpen) setMobilePanelOpen(true)
      if (dx < 0 && mobilePanelOpen) setMobilePanelOpen(false)
    }
  }, [mobilePanelOpen])

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">

      {/* ── Top nav ──────────────────────────────────────────────────────── */}
      <PublicNav />

      {/* ── Lex toolbar — Save & Exit / View your idea ───────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-6 py-2 border-b border-border bg-background/95 text-xs">
        <span className="text-muted-foreground font-medium">Developing with Lex</span>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-3">
            {!isSignedIn && (
              <SignInButton mode="modal">
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  Sign in
                </button>
              </SignInButton>
            )}
            {ideaId && (
              <Link
                href={`/ideas/${ideaId}`}
                className="px-3 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                Back to idea
              </Link>
            )}
            {isSignedIn && (
              <>
                <Link
                  href="/dashboard"
                  className="px-3 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  My Dashboard
                </Link>
                <button
                  onClick={() => {
                    if (ideaId) {
                      router.push('/dashboard')
                    } else {
                      setSaveExitMsg('Your conversation will be saved once you complete the first stage.')
                      setTimeout(() => setSaveExitMsg(null), 4000)
                    }
                  }}
                  className="px-3 py-1 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium"
                >
                  Save & Exit
                </button>
              </>
            )}
          </div>
          {saveExitMsg && (
            <p className="text-muted-foreground max-w-xs text-right">{saveExitMsg}</p>
          )}
        </div>
      </div>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div
        className="flex flex-1 overflow-hidden relative"
        onTouchStart={handleOuterTouchStart}
        onTouchEnd={handleOuterTouchEnd}
      >

        {/* ── Mobile panel edge indicator (shown when panel is closed) ──── */}
        {!mobilePanelOpen && (
          <button
            className="lg:hidden fixed right-0 top-1/2 -translate-y-1/2 w-3 h-16 bg-teal-500 rounded-l-full z-30 opacity-60 hover:opacity-90 transition-opacity"
            onClick={() => setMobilePanelOpen(true)}
            aria-label="Open field panel"
          />
        )}

        {/* ── Mobile panel overlay (full-screen, lg:hidden) ─────────────── */}
        <div
          className={`
            fixed inset-0 z-40 bg-background transition-transform duration-300 ease-in-out
            lg:hidden flex flex-col
            ${mobilePanelOpen ? 'translate-x-0' : 'translate-x-full'}
          `}
        >
          <div className="flex items-center justify-between p-4 border-b shrink-0">
            <h2 className="font-semibold text-sm">Your Idea</h2>
            <button
              onClick={() => setMobilePanelOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Back to chat"
            >
              ← Back to chat
            </button>
          </div>
          <MobileSidebarContent
            fields={fields}
            fieldValues={fieldValues}
            onEditField={(fieldKey, fieldLabel, value) => {
              setInputValue(`I want to revisit ${fieldLabel}: ${value}`)
              setMobilePanelOpen(false)
              setTimeout(() => {
                if (inputRef.current) {
                  inputRef.current.focus()
                  inputRef.current.style.height = 'auto'
                  inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
                }
              }, 100)
            }}
            onChatField={(fieldLabel) => {
              setMobilePanelOpen(false)
              handleSend(false, `I'd like to revisit ${fieldLabel}`)
            }}
          />
        </div>

        {/* ── Chat panel (75%) ──────────────────────────────────────────── */}
        <div className={`flex flex-col flex-1 min-w-0 relative ${mobilePanelOpen ? 'invisible lg:visible' : ''}`}>

          {/* Progress bar */}
          <div className="shrink-0 px-6 pt-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-zinc-900 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
                {progress > 0 ? `${progress}%` : ''}
              </span>
            </div>
          </div>

          {/* Scrollable chat + input — input follows messages, not pinned to viewport */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-6 pb-6"
          >
            <div className="max-w-2xl mx-auto">

              {/* Messages */}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`mb-6 ${msg.role === 'user' ? 'flex justify-end' : ''}`}
                >
                  {msg.role === 'lex' ? (
                    <div className="flex gap-3 w-full">
                      {/* Lex avatar */}
                      <div className="shrink-0 w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center mt-0.5">
                        <span className="text-white text-xs font-semibold">L</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-500 mb-1">Lex</p>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>
                        {msg.isConnectionError && (
                          <button
                            onClick={handleRetry}
                            disabled={isLoading}
                            className="mt-2 px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isLoading ? 'Retrying…' : 'Try again'}
                          </button>
                        )}
                        {/* Field proposal cards */}
                        {msg.proposals && msg.proposals.length > 0 && (
                          <div className="mt-3">
                            {/* Accept all button — shown when 2+ proposals are pending */}
                            {msg.proposals.filter(p => p.status === 'pending').length >= 2 && (
                              <button
                                onClick={() => handleAcceptAll(i)}
                                className="mb-2 px-4 py-2 text-sm font-medium bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors border border-zinc-200"
                              >
                                Accept all suggestions
                              </button>
                            )}
                            {msg.proposals.map((proposal, pi) => (
                              <FieldProposalCard
                                key={`${i}-${pi}`}
                                fieldKey={proposal.fieldKey}
                                fieldLabel={proposal.fieldLabel}
                                proposedValue={proposal.proposedValue}
                                onAccept={val => handleProposalAccept(i, pi, val)}
                                onEdit={val => handleProposalEdit(i, pi, val)}
                                onDiscuss={() => handleProposalDiscuss(i, pi)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-md">
                      <div className="bg-zinc-100 rounded-2xl rounded-tr-sm px-4 py-3">
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator — shown while waiting for first token */}
              {isLoading && messages[messages.length - 1]?.isStreaming && messages[messages.length - 1]?.content === '' && (
                <div className="flex gap-3 mb-6">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">L</span>
                  </div>
                  <LexThinking visible={true} />
                </div>
              )}

              {/* Save prompt — surfaces when Lex signals triggerSavePrompt */}
              {showSavePrompt && !isSignedIn && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 mb-6">
                  <p className="text-sm font-medium text-zinc-900 mb-1">
                    Save your idea
                  </p>
                  <p className="text-sm text-zinc-600 mb-3">
                    I&apos;ve put together a first shape for your idea — want to save this so you can come back to it?
                  </p>
                  <SignInButton mode="modal">
                    <button className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors">
                      Save my idea →
                    </button>
                  </SignInButton>
                </div>
              )}

              {/* ── Commit 6: Current fieldProposal card — above input ───────── */}
              {currentProposal && (
                <FieldProposalCard
                  fieldKey={currentProposal.fieldKey}
                  fieldLabel={currentProposal.fieldLabel}
                  proposedValue={currentProposal.proposedValue}
                  onAccept={handleCurrentProposalAccept}
                  onEdit={handleCurrentProposalEdit}
                  onDiscuss={handleCurrentProposalDiscuss}
                />
              )}

              {/* ── Input area — immediately below last message ──────────── */}
              <div className="pt-2 pb-2">

                {/* Retry in-progress message */}
                {retryMessage && (
                  <p className="mb-2 text-xs text-zinc-500 pl-1">{retryMessage}</p>
                )}

                {/* One-time mic hint tooltip */}
                {showMicHint && supportsVoice && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2 pl-1">
                    <span>🎤</span>
                    <span>You can speak your answer — tap the mic</span>
                  </div>
                )}

                {/* Attached file chip */}
                {attachedFile && (
                  <div className="flex items-center gap-2 mb-2 pl-1">
                    <span className="flex items-center gap-1.5 text-xs bg-zinc-100 text-zinc-700 rounded-md px-2.5 py-1.5 border border-zinc-200">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      {attachedFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachedFile(null)}
                      className="text-zinc-400 hover:text-zinc-600 transition-colors"
                      aria-label="Remove attachment"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Pending proposals hint */}
                {hasPendingProposals && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                    Review Lex&apos;s suggestions above to continue.
                  </p>
                )}

                {/* Input box */}
                <div className={`flex items-end gap-1 border rounded-xl bg-background p-3 transition-shadow ${
                  hasPendingProposals
                    ? 'border-zinc-200 opacity-60'
                    : 'border-border focus-within:ring-2 focus-within:ring-zinc-900/20'
                }`}>
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={hasPendingProposals ? 'Review suggestions above first…' : 'Type your answer…'}
                    rows={1}
                    disabled={isLoading || hasPendingProposals}
                    className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed"
                    style={{ overflow: 'hidden', maxHeight: '200px' }}
                  />

                  {/* File attachment button — hidden input triggered by visible button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    onChange={handleFileChange}
                    className="hidden"
                    aria-label="Attach a document"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach a PDF or document for background context"
                    className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>

                  {/* Mic button — conditionally rendered, min 44px touch target */}
                  {supportsVoice && (
                    <button
                      type="button"
                      onClick={startDictation}
                      title={isListening ? 'Stop listening' : 'Speak your answer'}
                      className={`shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors ${
                        isListening
                          ? 'text-red-500 bg-red-50 animate-pulse'
                          : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 17.93V21H9v2h6v-2h-2v-2.07A8 8 0 0 0 20 11h-2a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93z"/>
                      </svg>
                    </button>
                  )}

                  {/* Send button */}
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={!canSend}
                    className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Send (Enter)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                <p className="text-xs text-zinc-400 mt-1.5 pl-1">
                  Enter to send · Shift+Enter for new line
                  {supportsVoice && (
                    <span> · Voice transcription uses your browser&apos;s built-in speech recognition</span>
                  )}
                </p>
              </div>

            </div>
          </div>

          {/* Scroll-to-bottom arrow */}
          {distanceFromBottom > 100 && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-24 right-6 w-8 h-8 rounded-full bg-white border border-zinc-200 shadow-sm flex items-center justify-center hover:bg-zinc-50 transition-colors z-10"
              title="Scroll to bottom"
            >
              <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* ── Sidebar — desktop only (lg+) ──────────────────────────────── */}
        <aside className={`hidden lg:flex flex-col shrink-0 border-l border-border bg-zinc-50/50 overflow-y-auto transition-all duration-300 ${sidebarExpanded ? 'w-1/2' : 'w-72'}`}>
          {/* Sidebar header with expand toggle */}
          <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Your idea
            </p>
            <button
              onClick={() => setSidebarExpanded(e => !e)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarExpanded ? '⊟ Collapse' : '⊞ Expand'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 gap-1">
            {currentStage === 'STAGE_1' ? (
              <>
                {SIDEBAR_FIELDS.map(({ key, label }) => {
                  const done = fields[key]
                  const active = isLoading && !done
                  const keyStr = String(key)
                  const isOpen = openFields.has(keyStr)
                  const value = fieldValues[keyStr]
                  return (
                    <div key={keyStr} className="mb-1">
                      <div
                        className={`flex items-center gap-2.5 py-1.5 ${value ? 'cursor-pointer group' : ''}`}
                        onClick={() => value && setOpenFields(prev => {
                          const next = new Set(prev)
                          next.has(keyStr) ? next.delete(keyStr) : next.add(keyStr)
                          return next
                        })}
                      >
                        <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                          done ? 'bg-green-500' : active ? 'bg-amber-400' : 'bg-zinc-200'
                        }`}>
                          {done && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className={`text-sm transition-colors flex-1 ${done ? 'text-zinc-900 font-medium' : 'text-zinc-500'}`}>
                          {label}
                        </span>
                        {value && (
                          <span className="text-xs text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isOpen ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                      {value && isOpen && (
                        <div className="ml-6 mt-1 text-xs text-foreground bg-muted/40 rounded p-2 leading-relaxed field-accept-animation">
                          {value.length > 200 && !sidebarExpanded ? value.substring(0, 200) + '…' : value}
                        </div>
                      )}
                    </div>
                  )
                })}
                {completedCount > 0 && (
                  <p className="text-xs text-zinc-400 mt-4">
                    {completedCount} of 7 fields complete
                  </p>
                )}
              </>
            ) : (
              <Stage2Sidebar
                fields={fields}
                coherentActionsCount={coherentActionsCount}
                isLoading={isLoading}
                sidebarExpanded={sidebarExpanded}
                openFields={openFields}
                onToggleField={(key) => setOpenFields(prev => {
                  const next = new Set(prev)
                  next.has(key) ? next.delete(key) : next.add(key)
                  return next
                })}
                fieldValues={fieldValues}
              />
            )}
          </div>
        </aside>
      </div>

      {/* ── Bottom nav ───────────────────────────────────────────────────── */}
      <SiteFooter />
    </div>
  )
}
