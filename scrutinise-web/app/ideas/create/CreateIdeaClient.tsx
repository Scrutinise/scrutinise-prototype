'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Create — Lex rebuild (Sprint 1). Server-authoritative canonical state.
//
// This component holds NO idea of progress. It renders whatever the server's
// canonical state says, plus a transient in-flight spinner and the chat
// transcript. Every mutation goes to the server and is answered with fresh
// canonical state, which replaces what we render. See docs/LEX_REBUILD_DESIGN.md.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react'
import PublicNav from '@/components/PublicNav'
import ChatPanel, { type ChatMessage } from '@/components/lex/ChatPanel'
import FieldsPanel from '@/components/lex/FieldsPanel'
import BackgroundPanel from '@/components/lex/BackgroundPanel'
import HowItWorksModal from '@/components/lex/HowItWorksModal'
import type { CanonicalState, CanonicalField } from '@/lib/lex/page1-config'

// "Say the word" — a conservative match for a user asking to be shown how the
// platform works, so the intro's offer opens the tour rather than a Lex round-trip.
const HELP_INTENT =
  /^(?:\s*(?:yes|sure|ok(?:ay)?|please|go on|yes please)[ ,.!]*)*(?:can|could)?\s*(?:you\s+)?(?:please\s+)?(?:show me (?:how (?:this|it) works|around|the ropes)|how (?:do|does) (?:this|it|i) (?:work|use this)|how (?:this|it) works|explain how (?:this|it) works|give me (?:a|the) tour|guided tour|walk me through (?:this|it))[ ?.!]*$/i

interface Props {
  openingBubbles?: string[]
  initialIdeaId?: string
  initialMessages?: unknown[]
  isFirstIdea?: boolean
}

const DEFAULT_OPENING = ["I'm Lex, your researcher and guide. What's the challenge you want to fix?"]

type Tab = 'chat' | 'fields' | 'background'

export default function CreateIdeaClient({ openingBubbles, initialIdeaId, initialMessages }: Props) {
  const opening = openingBubbles?.length ? openingBubbles : DEFAULT_OPENING

  const [ideaId, setIdeaId] = useState<string | null>(initialIdeaId ?? null)
  const [state, setState] = useState<CanonicalState | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const seeded = (initialMessages as ChatMessage[] | undefined)?.filter(
      (m) => m && (m.role === 'user' || m.role === 'lex'),
    )
    return seeded && seeded.length
      ? seeded
      : opening.map((content) => ({ role: 'lex' as const, content }))
  })
  const [busy, setBusy] = useState(false)
  const [booting, setBooting] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('chat')
  const [showHelp, setShowHelp] = useState(false)
  const bootedRef = useRef(false)

  // ── Boot: ensure an idea exists, then load canonical state ─────────────────
  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    ;(async () => {
      try {
        let id = ideaId
        if (!id) {
          const res = await fetch('/api/ideas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Untitled idea' }),
          })
          if (!res.ok) throw new Error('create idea failed')
          id = (await res.json()).id as string
          setIdeaId(id)
        }
        const sres = await fetch(`/api/ideas/${id}/state`)
        if (!sres.ok) throw new Error('load state failed')
        setState(await sres.json())
      } catch {
        setError('Could not start a session. Please refresh.')
      } finally {
        setBooting(false)
      }
    })()
  }, [ideaId])

  const applyState = useCallback((s: CanonicalState) => setState(s), [])

  // ── Actions ────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (!ideaId) return
      // "Say the word" — open the walkthrough instead of a Lex round-trip when the
      // user is plainly asking how this works (the intro offers exactly this).
      if (HELP_INTENT.test(text.trim())) {
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: text },
          { role: 'lex', content: "Of course — here's a quick walkthrough. I've opened it for you." },
        ])
        setShowHelp(true)
        return
      }
      setMessages((prev) => [...prev, { role: 'user', content: text }])
      setBusy(true)
      setError(null)

      const postOnce = async () => {
        const res = await fetch(`/api/ideas/${ideaId}/lex`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        })
        if (!res.ok) throw new Error(`lex ${res.status}`)
        return res.json()
      }

      try {
        let data
        try {
          data = await postOnce()
        } catch (err1) {
          // The failure self-recovered on resend, so it's likely transient. Retry
          // once before surfacing the fallback. The underlying cause (Gemini
          // status/body or schema validation) is logged server-side.
          console.warn('[lex] turn failed, retrying once:', err1)
          await new Promise((r) => setTimeout(r, 700))
          data = await postOnce()
        }
        setMessages((prev) => [...prev, { role: 'lex', content: data.chatText }])
        if (data.state) applyState(data.state)
      } catch (err) {
        console.error('[lex] turn failed after retry:', err)
        setMessages((prev) => [
          ...prev,
          { role: 'lex', content: 'I lost the connection there — could you say that again?' },
        ])
      } finally {
        setBusy(false)
      }
    },
    [ideaId, applyState],
  )

  const transition = useCallback(
    async (fieldKey: string, action: 'submitBox' | 'accept' | 'skip' | 'reopen', value?: string | string[]) => {
      if (!ideaId) return
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(`/api/ideas/${ideaId}/fields`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldKey, action, value }),
        })
        if (!res.ok) throw new Error('field transition failed')
        const data = await res.json()
        // The server conducts the next step and returns any new Lex bubbles.
        if (Array.isArray(data.messages) && data.messages.length) {
          setMessages((prev) => [
            ...prev,
            ...data.messages.map((c: string) => ({ role: 'lex' as const, content: c })),
          ])
        }
        if (data.state) applyState(data.state)
      } catch {
        setError('That didn’t save — please try again.')
      } finally {
        setBusy(false)
      }
    },
    [ideaId, applyState],
  )

  // The accept card lives in chat ONLY for Title/Keywords (the narrative boxes are
  // their own accept surface — §5/§13).
  const awaitingField: CanonicalField | null =
    state?.currentField?.status === 'AWAITING_CONFIRMATION'
      ? state.pages[0]?.fields.find((f) => f.key === state.currentField!.key) ?? null
      : null
  const chatAwaitingField = awaitingField && awaitingField.type !== 'narrative' ? awaitingField : null

  return (
    <div className="flex flex-col h-screen bg-white">
      <PublicNav />

      {error && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-4 py-1.5 text-center">
          {error}
        </div>
      )}

      {/* Persistent help affordance — the tour always reachable from the create view. */}
      <div className="flex items-center justify-end border-b border-zinc-100 px-4 py-1.5">
        <button
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          <span aria-hidden className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">?</span>
          How this works
        </button>
      </div>

      {showHelp && <HowItWorksModal onClose={() => setShowHelp(false)} />}

      {/* Mobile tab bar */}
      <div className="lg:hidden flex border-b border-zinc-200 text-xs font-medium">
        {(['chat', 'fields', 'background'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 capitalize ${tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-zinc-400'}`}
          >
            {t === 'fields' ? 'Progress' : t === 'background' ? 'Background' : 'Chat'}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {booting || !state ? (
          <div className="h-full flex items-center justify-center text-sm text-zinc-400">
            {error ?? 'Starting your session…'}
          </div>
        ) : (
          <div className="h-full grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1fr]">
            {/* Panel 1 — Chat */}
            <div className={`h-full min-h-0 border-r border-zinc-200 ${tab === 'chat' ? 'block' : 'hidden'} lg:block`}>
              <ChatPanel
                messages={messages}
                awaitingField={chatAwaitingField}
                busy={busy}
                onSend={sendMessage}
                onAccept={(value) => chatAwaitingField && transition(chatAwaitingField.key, 'accept', value)}
                onDecline={() => chatAwaitingField && transition(chatAwaitingField.key, 'skip')}
              />
            </div>

            {/* Panel 2 — Fields */}
            <div className={`h-full min-h-0 border-r border-zinc-200 ${tab === 'fields' ? 'block' : 'hidden'} lg:block`}>
              <FieldsPanel
                pages={state.pages}
                busy={busy}
                onSubmitBox={(key, value) => transition(key, 'submitBox', value)}
                onSkip={(key) => transition(key, 'skip')}
                onReopen={(key) => transition(key, 'reopen')}
              />
            </div>

            {/* Panel 3 — Legislation / Background */}
            <div className={`h-full min-h-0 ${tab === 'background' ? 'block' : 'hidden'} lg:block`}>
              <BackgroundPanel
                initialBackground={state.initialBackground}
                legislationRefs={state.legislationRefs}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
