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
import type { CanonicalState, CanonicalField } from '@/lib/lex/page1-config'

interface Props {
  openingMessage?: string
  initialIdeaId?: string
  initialMessages?: unknown[]
  isFirstIdea?: boolean
}

const DEFAULT_OPENING = "I'm Lex, your researcher and guide. What's the challenge you want to fix?"

type Tab = 'chat' | 'fields' | 'background'

export default function CreateIdeaClient({ openingMessage, initialIdeaId, initialMessages }: Props) {
  const opening = openingMessage ?? DEFAULT_OPENING

  const [ideaId, setIdeaId] = useState<string | null>(initialIdeaId ?? null)
  const [state, setState] = useState<CanonicalState | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const seeded = (initialMessages as ChatMessage[] | undefined)?.filter(
      (m) => m && (m.role === 'user' || m.role === 'lex'),
    )
    return seeded && seeded.length ? seeded : [{ role: 'lex', content: opening }]
  })
  const [busy, setBusy] = useState(false)
  const [booting, setBooting] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('chat')
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
      setMessages((prev) => [...prev, { role: 'user', content: text }])
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(`/api/ideas/${ideaId}/lex`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        })
        if (!res.ok) throw new Error('lex failed')
        const data = await res.json()
        setMessages((prev) => [...prev, { role: 'lex', content: data.chatText }])
        if (data.state) applyState(data.state)
      } catch {
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
      const wasKeywordsAccept = action === 'accept' && fieldKey === 'keywords'
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
        if (data.state) {
          applyState(data.state)
          // Mirror Lex's persisted one-line pointer into the live transcript.
          if (wasKeywordsAccept && data.state.initialBackground?.status === 'ready') {
            setMessages((prev) => [
              ...prev,
              {
                role: 'lex',
                content:
                  "I've pulled an initial background briefing together — it's in the legislation panel on the right.",
              },
            ])
          }
        }
      } catch {
        setError('That didn’t save — please try again.')
      } finally {
        setBusy(false)
      }
    },
    [ideaId, applyState],
  )

  const awaitingField: CanonicalField | null =
    state?.currentField?.status === 'AWAITING_CONFIRMATION'
      ? state.pages[0]?.fields.find((f) => f.key === state.currentField!.key) ?? null
      : null

  return (
    <div className="flex flex-col h-screen bg-white">
      <PublicNav />

      {error && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-4 py-1.5 text-center">
          {error}
        </div>
      )}

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
                awaitingField={awaitingField}
                busy={busy}
                onSend={sendMessage}
                onAccept={(value) => awaitingField && transition(awaitingField.key, 'accept', value)}
                onDecline={() => awaitingField && transition(awaitingField.key, 'skip')}
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
