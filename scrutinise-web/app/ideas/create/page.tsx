'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useUser, SignInButton } from '@clerk/nextjs'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'lex'
  content: string
  timestamp: string
}

interface FieldCompletion {
  diagnosis: boolean
  rootCause: boolean
  guidingPolicy: boolean
  coherentActions: boolean
  whoAffected: boolean
  research: boolean
  proposedWording: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const OPENING_MESSAGE = "I'm Lex, your researcher and guide. What's the challenge you want to fix?"

const SIDEBAR_FIELDS: { key: keyof FieldCompletion; label: string }[] = [
  { key: 'diagnosis',       label: "What's the Challenge?" },
  { key: 'rootCause',       label: "What's Causing It?" },
  { key: 'guidingPolicy',   label: "How Will We Solve It?" },
  { key: 'coherentActions', label: "A Practical Step" },
  { key: 'whoAffected',     label: "Who's Affected?" },
  { key: 'research',        label: "Evidence Base" },
  { key: 'proposedWording', label: "Proposed Wording" },
]

const EMPTY_FIELDS: FieldCompletion = {
  diagnosis: false, rootCause: false, guidingPolicy: false,
  coherentActions: false, whoAffected: false, research: false, proposedWording: false,
}

function calcProgress(userMsgCount: number, fields: FieldCompletion): number {
  const { diagnosis, rootCause, guidingPolicy, coherentActions, whoAffected } = fields
  const allCore = diagnosis && rootCause && guidingPolicy && coherentActions && whoAffected
  if (allCore)          return 90
  if (coherentActions)  return 75
  if (guidingPolicy)    return 60
  if (diagnosis)        return 45
  if (userMsgCount >= 2) return 30
  if (userMsgCount >= 1) return 20
  return 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function CreateIdeaPage() {
  const { isSignedIn } = useUser()

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'lex', content: OPENING_MESSAGE, timestamp: new Date().toISOString() },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [ideaId, setIdeaId] = useState<string | null>(null)
  const [fields, setFields] = useState<FieldCompletion>(EMPTY_FIELDS)
  const [userMsgCount, setUserMsgCount] = useState(0)
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [supportsVoice, setSupportsVoice] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [showMicHint, setShowMicHint] = useState(false)
  const [distanceFromBottom, setDistanceFromBottom] = useState(0)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      const t = setTimeout(() => setShowMicHint(false), 6000)
      return () => clearTimeout(t)
    }
  }, [])

  // ── Auto-focus input ───────────────────────────────────────────────────────
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ── Scroll to bottom after new messages ───────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, isLoading])

  // ── Track scroll position for up-arrow ────────────────────────────────────
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

  // ── Auto-save (30s debounced PATCH) ───────────────────────────────────────
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
    autoSaveTimer.current = setTimeout(autoSave, 30_000)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [messages, ideaId, autoSave])

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
    if (!text || isLoading) return

    setInputValue('')
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto'

    const newCount = userMsgCount + 1
    setUserMsgCount(newCount)

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() }
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
          body: JSON.stringify({ message: text }),
        })
      } else {
        // Unauthenticated — public endpoint, history passed in body
        res = await fetch('/api/ai/public', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: messages.map(m => ({ role: m.role, content: m.content })),
          }),
        })
      }

      if (!res.ok) throw new Error('Lex unavailable')

      const data = await res.json()

      // Merge field completion into state
      if (data.completedFields) {
        setFields(prev => ({ ...prev, ...data.completedFields }))
      }

      if (data.triggerSavePrompt && !isSignedIn) {
        setShowSavePrompt(true)
      }

      setMessages(prev => [...prev, {
        role: 'lex',
        content: data.response,
        timestamp: new Date().toISOString(),
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'lex',
        content: "I seem to have lost my connection for a moment. Please try again.",
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setIsLoading(false)
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

    // Dismiss mic hint on first use
    if (showMicHint) {
      setShowMicHint(false)
      localStorage.setItem('hasSeenMicHint', 'true')
    }
  }

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }

  const completedCount = Object.values(fields).filter(Boolean).length

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
        {!isSignedIn && (
          <SignInButton mode="modal">
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </button>
          </SignInButton>
        )}
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
                {progress}%
              </span>
            </div>
          </div>

          {/* Scrollable chat + input */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-6 pb-6"
          >
            {/* Messages */}
            <div className="max-w-2xl mx-auto">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`mb-6 ${msg.role === 'user' ? 'flex justify-end' : ''}`}
                >
                  {msg.role === 'lex' ? (
                    <div className="flex gap-3">
                      {/* Lex avatar */}
                      <div className="shrink-0 w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center mt-0.5">
                        <span className="text-white text-xs font-semibold">L</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-500 mb-1">Lex</p>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>
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

              {/* Save prompt (triggered by Lex after Strategic Kernel) */}
              {showSavePrompt && !isSignedIn && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 mb-6">
                  <p className="text-sm font-medium text-zinc-900 mb-1">
                    Save your idea
                  </p>
                  <p className="text-sm text-zinc-600 mb-3">
                    I&apos;ve put together a first shape for your idea. Create a free account to save it and come back to it.
                  </p>
                  <SignInButton mode="modal">
                    <button className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors">
                      Save my idea →
                    </button>
                  </SignInButton>
                </div>
              )}

              {/* Input area — follows messages, not pinned to viewport */}
              <div className="pt-2 pb-2">
                {/* Mic hint tooltip */}
                {showMicHint && supportsVoice && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2 pl-1">
                    <span>🎤</span>
                    <span>You can speak your answer — tap the mic</span>
                  </div>
                )}

                <div className="flex items-end gap-2 border border-border rounded-xl bg-background p-3 focus-within:ring-2 focus-within:ring-zinc-900/20 transition-shadow">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your answer…"
                    rows={1}
                    disabled={isLoading}
                    className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed"
                    style={{ overflow: 'hidden', maxHeight: '200px' }}
                  />

                  {/* Mic button — conditionally rendered */}
                  {supportsVoice && (
                    <button
                      type="button"
                      onClick={startDictation}
                      title={isListening ? 'Stop listening' : 'Speak your answer'}
                      className={`shrink-0 p-1.5 rounded-lg transition-colors ${
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
                    disabled={isLoading || !inputValue.trim()}
                    className="shrink-0 p-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
