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
import type { CausesApi, PolicyApi, ActionsApi } from '@/components/lex/FieldsPanel'
import { acceptSurfaceOf, fieldDef, type CanonicalState, type CanonicalField } from '@/lib/lex/page1-config'

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

export default function CreateIdeaClient({ openingBubbles, initialIdeaId, initialMessages, isFirstIdea }: Props) {
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
  // Sprint 1.4: on a user's very first idea, open the walkthrough unprompted.
  const [showHelp, setShowHelp] = useState(Boolean(isFirstIdea))
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
      const stage = state?.stage
      if (HELP_INTENT.test(text.trim())) {
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: text, stage },
          { role: 'lex', content: "Of course — here's a quick walkthrough. I've opened it for you.", stage },
        ])
        setShowHelp(true)
        return
      }
      setMessages((prev) => [...prev, { role: 'user', content: text, stage }])
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
        setMessages((prev) => [...prev, { role: 'lex', content: data.chatText, stage: data.state?.stage ?? stage }])
        if (data.state) applyState(data.state)
      } catch (err) {
        console.error('[lex] turn failed after retry:', err)
        setMessages((prev) => [
          ...prev,
          { role: 'lex', content: 'I lost the connection there — could you say that again?', stage },
        ])
      } finally {
        setBusy(false)
      }
    },
    [ideaId, applyState, state?.stage],
  )

  const appendLex = useCallback((msgs: unknown, stage?: string) => {
    if (Array.isArray(msgs) && msgs.length) {
      setMessages((prev) => [...prev, ...msgs.map((c: string) => ({ role: 'lex' as const, content: c, stage }))])
    }
  }, [])

  // POST to a server endpoint that returns { state, messages } and apply both.
  const post = useCallback(
    async (path: string, body: unknown) => {
      if (!ideaId) return
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(`/api/ideas/${ideaId}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error(`${path} failed`)
        const data = await res.json()
        appendLex(data.messages, data.state?.stage)
        if (data.state) applyState(data.state)
      } catch {
        setError('That didn’t save — please try again.')
      } finally {
        setBusy(false)
      }
    },
    [ideaId, applyState, appendLex],
  )

  const transition = useCallback(
    (fieldKey: string, action: 'submitBox' | 'accept' | 'skip' | 'reopen', value?: string | string[] | Record<string, string>) =>
      post('/fields', { fieldKey, action, value }),
    [post],
  )

  // Page 2 causes-loop + root-cause handlers (→ /causes).
  const causesApi: CausesApi = {
    add: (input) => post('/causes', { action: 'add', ...input }),
    update: (causeId, patch) => post('/causes', { action: 'update', causeId, ...patch }),
    remove: (causeId) => post('/causes', { action: 'remove', causeId }),
    classify: (causeId, classification) => post('/causes', { action: 'classify', causeId, classification }),
    confirm: () => post('/causes', { action: 'confirm' }),
    skip: () => post('/causes', { action: 'skip' }),
    setRoot: (causeId) => post('/causes', { action: 'setRoot', causeId }),
    skipRoot: () => post('/causes', { action: 'skipRoot' }),
  }

  // Page 3 policy-options + chosen-approach handlers (→ /policy-options).
  const policyApi: PolicyApi = {
    add: (input) => post('/policy-options', { action: 'add', ...input }),
    update: (optionId, patch) => post('/policy-options', { action: 'update', optionId, ...patch }),
    remove: (optionId) => post('/policy-options', { action: 'remove', optionId }),
    ruleOut: (optionId, reason) => post('/policy-options', { action: 'ruleOut', optionId, reason }),
    confirm: () => post('/policy-options', { action: 'confirm' }),
    skip: () => post('/policy-options', { action: 'skip' }),
    choose: (optionId) => post('/policy-options', { action: 'choose', optionId }),
    skipChoose: () => post('/policy-options', { action: 'skipChoose' }),
  }

  // Page 4 actions loop + costing handlers (→ /actions).
  const actionsApi: ActionsApi = {
    add: (input) => post('/actions', { action: 'add', ...input }),
    update: (actionId, patch) => post('/actions', { action: 'update', actionId, ...patch }),
    remove: (actionId) => post('/actions', { action: 'remove', actionId }),
    confirm: () => post('/actions', { action: 'confirm' }),
    skip: () => post('/actions', { action: 'skip' }),
  }

  // "Continue to …" — advance the Lex page (→ /page).
  const advancePage = useCallback(() => post('/page', { action: 'advance' }), [post])

  // "Ask Lex about this" — bring the chat forward and focus it.
  const [focusNonce, setFocusNonce] = useState(0)
  const askLex = useCallback(() => { setTab('chat'); setFocusNonce((n) => n + 1) }, [])

  // The accept CARD lives in chat for Lex-PROPOSED scalars (title/keywords/challenge/
  // pivotalObstacle/summaryDiagnosis). Box-authored fields (narrative/structured/loop/
  // reference) are their own accept surface in the Fields panel (§5/§13 + §7).
  const cf = state?.currentField
  const awaitingField: CanonicalField | null =
    cf?.status === 'AWAITING_CONFIRMATION'
      ? state!.pages.flatMap((p) => p.fields).find((f) => f.key === cf.key) ?? null
      : null
  const awaitingDef = awaitingField ? fieldDef(awaitingField.key) : null
  const chatAwaitingField = awaitingField && awaitingDef && acceptSurfaceOf(awaitingDef) === 'chat' ? awaitingField : null

  return (
    <div className="flex flex-col h-screen bg-white">
      <PublicNav />

      {error && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-4 py-1.5 text-center">
          {error}
        </div>
      )}

      {/* Persistent help affordance — a prominent pill, centred above the chat column
          (the left column of the lg 3-col grid) so it's unmissable (Sprint 1.4). */}
      <div className="border-b border-zinc-100 px-4 py-2 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1fr]">
        <div className="flex justify-center">
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full px-5 py-2 shadow-sm transition-colors"
          >
            <span aria-hidden className="w-4 h-4 rounded-full border border-white/80 flex items-center justify-center text-[10px] font-bold">?</span>
            How this works
          </button>
        </div>
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
                focusNonce={focusNonce}
                currentStage={state.stage}
                stageLabels={Object.fromEntries(state.pages.map((p) => [p.key, p.label]))}
                onSend={sendMessage}
                onAccept={(value) => chatAwaitingField && transition(chatAwaitingField.key, 'accept', value)}
                onDecline={() => chatAwaitingField && transition(chatAwaitingField.key, 'skip')}
              />
            </div>

            {/* Panel 2 — Fields */}
            <div className={`h-full min-h-0 border-r border-zinc-200 ${tab === 'fields' ? 'block' : 'hidden'} lg:block`}>
              <FieldsPanel
                pages={state.pages}
                causes={state.diagnosisCauses}
                policyOptions={state.policyOptions}
                actions={state.actions}
                benchmarks={state.benchmarks}
                busy={busy}
                currentFieldKey={state.currentField?.key ?? null}
                onSubmitBox={(key, value) => transition(key, 'submitBox', value)}
                onAcceptStructured={(key, value) => transition(key, 'accept', value)}
                onSkip={(key) => transition(key, 'skip')}
                onReopen={(key) => transition(key, 'reopen')}
                causesApi={causesApi}
                policyApi={policyApi}
                actionsApi={actionsApi}
              />
            </div>

            {/* Panel 3 — Legislation / Background */}
            <div className={`h-full min-h-0 ${tab === 'background' ? 'block' : 'hidden'} lg:block`}>
              <BackgroundPanel
                initialBackground={state.initialBackground}
                legislationRefs={state.legislationRefs}
                nextPage={state.nextPage}
                busy={busy}
                onContinue={advancePage}
                onAskLex={askLex}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
