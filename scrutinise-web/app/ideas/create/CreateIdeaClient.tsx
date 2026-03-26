'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useUser, SignInButton } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import FieldProposalCard from '@/components/FieldProposalCard'

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
}

interface FieldCompletion {
  title: boolean
  summaryDiagnosis: boolean
  rootCause: boolean
  summaryGuidingPolicy: boolean
  summaryCoherentActions: boolean
  whoAffected: boolean
  proposedWording: boolean
}

interface Props {
  openingMessage?: string
  initialIdeaId?: string
  initialMessages?: unknown[]
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
  title: false, summaryDiagnosis: false, rootCause: false,
  summaryGuidingPolicy: false, summaryCoherentActions: false,
  whoAffected: false, proposedWording: false,
}

// Progress map per UX notes Section 4 / lex_system_prompt_v5 Section 18
function calcProgress(userMsgCount: number, fields: FieldCompletion): number {
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
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function CreateIdeaClient({ openingMessage, initialIdeaId, initialMessages }: Props) {
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
  const [saveExitMsg, setSaveExitMsg] = useState<string | null>(null)
  const [fields, setFields] = useState<FieldCompletion>(EMPTY_FIELDS)
  const [userMsgCount, setUserMsgCount] = useState(0)
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [supportsVoice, setSupportsVoice] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [showMicHint, setShowMicHint] = useState(false)
  const [distanceFromBottom, setDistanceFromBottom] = useState(0)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const micHintInteracted = useRef(false)

  const progress = calcProgress(userMsgCount, fields)

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
  const handleSend = async () => {
    const text = inputValue.trim()
    if (!text && !attachedFile) return
    if (isLoading) return

    dismissMicHint()

    // Build message text — prepend file note if attached
    let messageText = text
    if (attachedFile) {
      const fileNote = `[User attached: ${attachedFile.name}]`
      messageText = text ? `${fileNote}\n\n${text}` : fileNote
    }

    setInputValue('')
    setAttachedFile(null)
    if (inputRef.current) inputRef.current.style.height = 'auto'

    const newCount = userMsgCount + 1
    setUserMsgCount(newCount)

    const userMsg: ChatMessage = {
      role: 'user',
      content: text || `[Attached: ${attachedFile!.name}]`,  // display text (no file note prefix)
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
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
        // Unauthenticated — public endpoint, history passed in body
        res = await fetch('/api/ai/public', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: messageText,
            history: messages.map(m => ({ role: m.role, content: m.content })),
          }),
        })
      }

      if (!res.ok) throw new Error('Lex unavailable')

      const data = await res.json()

      // Update sidebar completion indicators from server response
      if (data.completedFields) {
        setFields(prev => ({ ...prev, ...data.completedFields }))
      }

      if (data.triggerSavePrompt && !isSignedIn) {
        setShowSavePrompt(true)
      }

      // Attach pendingProposals (if any) to the Lex message
      const proposals: PendingProposal[] | undefined = data.pendingProposals?.length
        ? data.pendingProposals.map((p: Omit<PendingProposal, 'status'>) => ({ ...p, status: 'pending' as const }))
        : undefined

      setMessages(prev => [...prev, {
        role: 'lex',
        content: data.response,
        timestamp: new Date().toISOString(),
        proposals,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'lex',
        content: "I seem to have lost my connection for a moment. Please try again.",
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setIsLoading(false)
      // Auto-focus input after each Lex response
      setTimeout(() => inputRef.current?.focus(), 0)
    }
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

    const proposal = messages[msgIndex]?.proposals?.[proposalIndex]
    if (!proposal) return

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
    } catch {
      // Silent — card stays in pending state
    }
  }, [ideaId, isSignedIn, messages])

  const handleProposalEdit = useCallback(async (msgIndex: number, proposalIndex: number, editedValue: string) => {
    // Same as accept but with the edited value
    await handleProposalAccept(msgIndex, proposalIndex, editedValue)
  }, [handleProposalAccept])

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

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-background/95 backdrop-blur z-10 shrink-0">
        <Link href="/" className="text-sm font-semibold tracking-tight text-foreground">
          Scrutinise
        </Link>
        <div className="flex items-center gap-3">
          {!isSignedIn && (
            <SignInButton mode="modal">
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Sign in
              </button>
            </SignInButton>
          )}
          {isSignedIn && (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                {ideaId && (
                  <Link
                    href={`/ideas/${ideaId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View your idea →
                  </Link>
                )}
                <button
                  onClick={() => {
                    if (ideaId) {
                      router.push('/dashboard')
                    } else {
                      setSaveExitMsg('Your conversation will be saved once you complete the first stage.')
                      setTimeout(() => setSaveExitMsg(null), 4000)
                    }
                  }}
                  className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  Save & Exit
                </button>
              </div>
              {saveExitMsg && (
                <p className="text-xs text-muted-foreground max-w-xs text-right">{saveExitMsg}</p>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Chat panel (75%) ──────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 relative">

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

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex gap-3 mb-6">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">L</span>
                  </div>
                  <div className="flex items-center gap-1 pt-1.5">
                    {[0, 150, 300].map(delay => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
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

              {/* ── Input area — immediately below last message ──────────── */}
              <div className="pt-2 pb-2">

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
                    onClick={handleSend}
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

        {/* ── Sidebar (25%) ─────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-72 shrink-0 border-l border-border bg-zinc-50/50 p-5 gap-1 overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">
            Your idea
          </p>

          {SIDEBAR_FIELDS.map(({ key, label }) => {
            const done = fields[key]
            const active = isLoading && !done
            return (
              <div key={key} className="flex items-center gap-2.5 py-1.5">
                <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                  done
                    ? 'bg-green-500'
                    : active
                      ? 'bg-amber-400'
                      : 'bg-zinc-200'
                }`}>
                  {done && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className={`text-sm transition-colors ${done ? 'text-zinc-900 font-medium' : 'text-zinc-500'}`}>
                  {label}
                </span>
              </div>
            )
          })}

          {completedCount > 0 && (
            <p className="text-xs text-zinc-400 mt-4">
              {completedCount} of 7 fields complete
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
