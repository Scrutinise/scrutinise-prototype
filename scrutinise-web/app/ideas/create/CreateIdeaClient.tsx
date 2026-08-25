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
import SurfaceSwitch from '@/components/lex/SurfaceSwitch'
import type { SurfaceContext } from '@/lib/lex/surfaces'
import FeedbackDialog from '@/components/lex/FeedbackDialog'
import DeepeningPanel from '@/components/lex/DeepeningPanel'
import AgendaPanel from '@/components/lex/AgendaPanel'
import type { FeedbackSurfaceKey } from '@/lib/lex/feedback-types'
import type { CausesApi, PolicyApi, ActionsApi, CostLinesApi } from '@/components/lex/FieldsPanel'
import { accentFor } from '@/lib/lex/stage-accents'
import { acceptSurfaceOf, fieldDef, CHILD_ENTITY_FIELDS, type CanonicalState, type CanonicalField, type SearchResult } from '@/lib/lex/page1-config'

// "Say the word" — a conservative match for a user asking to be shown how the
// platform works, so the intro's offer opens the tour rather than a Lex round-trip.
const HELP_INTENT =
  /^(?:\s*(?:yes|sure|ok(?:ay)?|please|go on|yes please)[ ,.!]*)*(?:can|could)?\s*(?:you\s+)?(?:please\s+)?(?:show me (?:how (?:this|it) works|around|the ropes)|how (?:do|does) (?:this|it|i) (?:work|use this)|how (?:this|it) works|explain how (?:this|it) works|give me (?:a|the) tour|guided tour|walk me through (?:this|it))[ ?.!]*$/i

interface Props {
  openingBubbles?: string[]
  initialIdeaId?: string
  initialMessages?: unknown[]
  isFirstIdea?: boolean
  /** 25-G §2 — the route back to the build, when there is a build to go back to. */
  surface?: SurfaceContext | null
}

// §20.5 — a conservative match for the user criticising something Lex produced,
// so the offer to pass it back appears where the criticism was made. Deliberately
// narrow: a false positive puts an unwanted card in the chat, and the same action
// is permanently available above the input anyway.
const CRITIQUE_INTENT =
  /\b(?:that(?:'s| is)|this(?:'s| is)|it(?:'s| is))\s+(?:not\s+right|wrong|incorrect|inaccurate|nonsense|rubbish|way off|miles off|misleading|too (?:low|high|vague|generic))\b|\b(?:you(?:'ve| have)?\s+(?:got|gotten)\s+(?:that|this|it)\s+wrong|you(?:'re| are)\s+wrong|that(?:'s| is)\s+made\s+up|you\s+made\s+that\s+up|where\s+did\s+(?:that|you\s+get\s+that)\s+(?:number|figure|come\s+from))\b|\bdoesn(?:'|’)?t\s+(?:make\s+sense|reflect|match)\b|\bi\s+don(?:'|’)?t\s+(?:agree|think\s+that(?:'s| is)\s+right)\b/i

// Which part of Lex's output a critique on this page is most likely about (§20.5).
const SURFACE_BY_STAGE: Record<string, FeedbackSurfaceKey> = {
  ORIENTATION: 'BRIEFING',
  DIAGNOSIS: 'CAUSES',
  GUIDING_POLICY: 'OPTIONS',
  COHERENT_ACTIONS: 'COSTS',
}

const DEFAULT_OPENING = ["I'm Lex, your researcher and guide. What's the problem you want to fix?"]

/** §19-D Task 9a — the exit save takes a few seconds; silence read as "nothing happened". */
function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

type Tab = 'chat' | 'fields' | 'background'

export default function CreateIdeaClient({ openingBubbles, initialIdeaId, initialMessages, isFirstIdea, surface = null }: Props) {
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

  const appendLex = useCallback((msgs: unknown, stage?: string) => {
    if (Array.isArray(msgs) && msgs.length) {
      setMessages((prev) => [...prev, ...msgs.map((c: string) => ({ role: 'lex' as const, content: c, stage }))])
    }
  }, [])

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
      // §20.5 — did the user just criticise something Lex produced? If so, the offer
      // to pass it back renders once the turn finishes. Display only; nothing is
      // captured, and it is cleared on the next message either way.
      setFeedbackOffer(CRITIQUE_INTENT.test(text))
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
        // A chat turn returns EITHER Lex's own reply, or — when the message advanced
        // the stage (§19-B Task 1) — the conductor's bubbles for the new page.
        const replyStage = data.state?.stage ?? stage
        if (data.chatText) {
          setMessages((prev) => [...prev, { role: 'lex', content: data.chatText, stage: replyStage }])
        }
        appendLex(data.messages, replyStage)
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
    [ideaId, applyState, appendLex, state?.stage],
  )

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

  // §19-D Task 3 — move the working context back into a stage already reached. The
  // server owns the move; this is one POST answered with fresh canonical state, so the
  // three panels follow automatically (the component holds no progress state of its own).
  const goToPage = useCallback((page: string) => post('/page', { action: 'goto', page }), [post])

  // §19-C Task 1a — re-run the current stage's search after an honest failure.
  const retrySearch = useCallback(() => post('/search', { action: 'retry' }), [post])

  // §19-C Task 6 — cost lines under an action.
  const costLinesApi: CostLinesApi = {
    add: (actionId, input) => post('/cost-lines', { action: 'add', actionId, ...input }),
    update: (lineId, patch) => post('/cost-lines', { action: 'update', lineId, ...patch }),
    remove: (lineId) => post('/cost-lines', { action: 'remove', lineId }),
    suggest: async (staffLevel, fteCount, durationMonths) => {
      if (!ideaId) return null
      try {
        const res = await fetch(`/api/ideas/${ideaId}/cost-lines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'suggest', staffLevel, fteCount, durationMonths }),
        })
        if (!res.ok) return null
        return (await res.json()).suggestion ?? null
      } catch { return null }
    },
  }

  // "Ask Lex about this" — bring the chat forward and focus it.
  const [focusNonce, setFocusNonce] = useState(0)
  const askLex = useCallback(() => { setTab('chat'); setFocusNonce((n) => n + 1) }, [])

  // §20.5 — feedback capture. All of this is local to this component: the dialog
  // holds its own state and the offer is a transient flag. Nothing here touches
  // canonical state, the field machine or the conductor.
  const [feedbackSurface, setFeedbackSurface] = useState<FeedbackSurfaceKey | null>(null)
  const [feedbackOffer, setFeedbackOffer] = useState(false)
  const surfaceForStage = useCallback(
    (): FeedbackSurfaceKey => SURFACE_BY_STAGE[state?.stage ?? 'ORIENTATION'] ?? 'OTHER',
    [state?.stage],
  )
  const openFeedback = useCallback((surface?: FeedbackSurfaceKey) => {
    setFeedbackOffer(false)
    setFeedbackSurface(surface ?? surfaceForStage())
  }, [surfaceForStage])

  // §19-C Task 7 — Exit. "Unsaved" here means a box the platform is holding for the
  // user's Save (a Lex proposal awaiting confirmation); everything else is already
  // server-side the moment it's saved, so there is nothing to lose by leaving.
  const [exitPrompt, setExitPrompt] = useState(false)
  const [leaving, setLeaving] = useState(false)

  // ── The Deepening (§22) ────────────────────────────────────────────────────
  // Unlocks once the kernel's four stages are complete. Deepening a skeleton that does
  // not exist yet produces findings about nothing — and, worse, issues about nothing,
  // which is a to-do list the user cannot act on.
  const kernelComplete = !!state?.pages.length && state.pages.every((p) => p.status === 'complete')
  const [openDeepeningPass, setOpenDeepeningPass] =
    useState<{ label: string; results: SearchResult[] } | null>(null)
  /**
   * "Work on this with Lex" — the issue goes into the ordinary chat as the user's own
   * message, carrying its own context. Deliberately NOT a separate thread object: a second
   * conversation store beside `aiChatHistory` is a second source of truth about what was
   * said, which is the condition the rebuild removed.
   */
  const discussIssue = useCallback((issueText: string, passLabel: string) => {
    setTab('chat')
    void sendMessage(
      `From the ${passLabel} deepening pass, this issue was raised against my proposal:\n\n` +
      `“${issueText}”\n\n` +
      `Help me work through it. Tell me what would actually answer it, and what you can and cannot find in the corpus to support an answer.`,
    )
    // sendMessage is defined below and is stable for the component's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // §19-D Task 9a, second instance — found on the 12 Aug walk.
  //
  // A CHILD-ENTITY field (causes / rootCause / policyOptions / chosenApproach / actions) sits at
  // AWAITING_CONFIRMATION while its rows are ALREADY PERSISTED in their own tables. It is not an
  // unsaved draft, `POST /fields` refuses to write it (422), and prompting to "save" it therefore
  // produced a dialog that could not succeed — Save & exit failed, and the only way out was
  // Discard. See CHILD_ENTITY_FIELDS for the full note.
  const unsavedField = state?.pages
    .flatMap((p) => p.fields)
    .find((f) => f.status === 'AWAITING_CONFIRMATION' && !CHILD_ENTITY_FIELDS.has(f.key)) ?? null
  const unsavedLabel = unsavedField?.label ?? null
  const leaveNow = useCallback(() => {
    // The navigation itself takes a few seconds (a full page load of the idea view).
    // Say so — the silence is what made "Save & exit" look like it had done nothing.
    setLeaving(true)
    window.location.href = ideaId ? `/ideas/${ideaId}` : '/dashboard'
  }, [ideaId])
  const handleExit = useCallback(() => {
    if (unsavedField) setExitPrompt(true)
    else leaveNow()
  }, [unsavedField, leaveNow])

  // §19-D Task 9a — "SAVE & EXIT" DID NOT EXIT. It closed the dialog and switched to the
  // Fields tab: it neither saved nor left, and Charlie had to press Discard to get out.
  // It now does both, in order — accept the pending proposal, wait for the write, then
  // leave — with the button showing it is working rather than sitting silent for ~5s.
  const saveAndExit = useCallback(async () => {
    if (!ideaId) return
    setLeaving(true)
    try {
      if (unsavedField) {
        const res = await fetch(`/api/ideas/${ideaId}/fields`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldKey: unsavedField.key, action: 'accept' }),
        })
        // A failed save must not be followed by a silent exit — that loses the draft
        // while looking like it saved it. Keep them here and say so.
        if (!res.ok) {
          setLeaving(false)
          setExitPrompt(false)
          setError('That didn’t save, so I’ve kept you here. Try Save again, or Discard to leave anyway.')
          setTab('fields')
          return
        }
      }
      leaveNow()
    } catch {
      setLeaving(false)
      setExitPrompt(false)
      setError('That didn’t save, so I’ve kept you here. Try Save again, or Discard to leave anyway.')
      setTab('fields')
    }
  }, [ideaId, unsavedField, leaveNow])

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
          (the left column of the lg 3-col grid) so it's unmissable (Sprint 1.4).
          §19-C Task 7: Exit sits to its left, so leaving is always in reach. */}
      {/* 25-G §2 — the persistent route to the build. In the header bar because that bar
          is on EVERY screen of this surface (all three panels, all four pages), which is
          the "persistent, in both directions" §2 asks for. */}
      {surface && (
        <div className="border-b border-zinc-100 px-4 pt-2">
          <div className="max-w-3xl mx-auto">
            <SurfaceSwitch context={surface} />
          </div>
        </div>
      )}

      <div className="border-b border-zinc-100 px-4 py-2 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1fr]">
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleExit}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-300 rounded-full px-4 py-2 hover:bg-zinc-50 transition-colors"
          >
            Exit
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full px-5 py-2 shadow-sm transition-colors"
          >
            <span aria-hidden className="w-4 h-4 rounded-full border border-white/80 flex items-center justify-center text-[10px] font-bold">?</span>
            How this works
          </button>
        </div>
      </div>

      {/* §19-C Task 7 — one Exit. If a box holds unsaved edits, ask first. */}
      {exitPrompt && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
            <h2 className="text-base font-semibold text-zinc-900">Save changes before leaving?</h2>
            <p className="text-sm text-zinc-600 mt-1.5">
              {unsavedLabel
                ? `“${unsavedLabel}” is waiting for you to Save. Leave now and that draft is lost.`
                : 'You have edits that haven’t been saved yet.'}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={saveAndExit} disabled={leaving}
                className="text-sm font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-2">
                {leaving && <Spinner />}
                {leaving ? 'Saving…' : 'Save & exit'}
              </button>
              <button onClick={leaveNow} disabled={leaving}
                className="text-sm font-medium px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-60">
                Discard
              </button>
              <button onClick={() => setExitPrompt(false)} disabled={leaving}
                className="text-sm font-medium px-3 py-1.5 rounded-lg text-zinc-500 hover:bg-zinc-50 disabled:opacity-60">
                Stay
              </button>
            </div>
          </div>
        </div>
      )}

      {showHelp && <HowItWorksModal onClose={() => setShowHelp(false)} />}

      {/* §20.5 — the consent flow. Stores and sends nothing until an explicit Yes. */}
      {feedbackSurface && ideaId && (
        <FeedbackDialog
          ideaId={ideaId}
          stage={state?.stage ?? 'ORIENTATION'}
          initialSurface={feedbackSurface}
          onClose={() => setFeedbackSurface(null)}
        />
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
                awaitingField={chatAwaitingField}
                busy={busy}
                focusNonce={focusNonce}
                currentStage={state.stage}
                stageLabels={Object.fromEntries(state.pages.map((p) => [p.key, p.label]))}
                nextPage={state.nextPage}
                feedbackOffer={feedbackOffer}
                onSend={sendMessage}
                onAccept={(value) => chatAwaitingField && transition(chatAwaitingField.key, 'accept', value)}
                onDecline={() => chatAwaitingField && transition(chatAwaitingField.key, 'skip')}
                onContinue={advancePage}
                onGiveFeedback={() => openFeedback()}
                onDismissFeedbackOffer={() => setFeedbackOffer(false)}
              />
            </div>

            {/* Panel 2 — Fields */}
            <div className={`h-full min-h-0 border-r border-zinc-200 ${tab === 'fields' ? 'block' : 'hidden'} lg:block`}>
              <FieldsPanel
                pages={state.pages}
                causes={state.diagnosisCauses}
                policyOptions={state.policyOptions}
                actions={state.actions}
                costLines={state.costLines}
                benchmarks={state.benchmarks}
                busy={busy}
                currentFieldKey={state.currentField?.key ?? null}
                onSubmitBox={(key, value) => transition(key, 'submitBox', value)}
                onAcceptStructured={(key, value) => transition(key, 'accept', value)}
                onAcceptOutput={(key, value) => transition(key, 'accept', value)}
                onSkip={(key) => transition(key, 'skip')}
                onReopen={(key) => transition(key, 'reopen')}
                onGoToPage={goToPage}
                causesApi={causesApi}
                policyApi={policyApi}
                actionsApi={actionsApi}
                costLinesApi={costLinesApi}
                deepening={
                  <>
                    {/* 25-C §3 — THE AGENDA COMES FIRST, above the Deepening's own cards.
                        The whole point is that the user is handed what to DO rather than a
                        library to search; putting it under the four pass cards would make it
                        the sixth thing on the page and undo the ordering §3 exists for.
                        It renders nothing until a build has completed. */}
                    <AgendaPanel ideaId={state.ideaId} />
                    <DeepeningPanel
                      ideaId={state.ideaId}
                      unlocked={kernelComplete}
                      onOpenPass={setOpenDeepeningPass}
                      onDiscussIssue={discussIssue}
                    />
                  </>
                }
              />
            </div>

            {/* Panel 3 — Legislation / Background */}
            <div className={`h-full min-h-0 ${tab === 'background' ? 'block' : 'hidden'} lg:block`}>
              <BackgroundPanel
                ideaId={state.ideaId}
                initialBackground={state.initialBackground}
                legislationRefs={state.legislationRefs}
                stageSearch={state.stageSearch}
                research={state.research}
                stage={state.stage}
                stageLabel={state.pages.find((p) => p.key === state.stage)?.label ?? state.stage}
                stageAccent={accentFor(state.stage)}
                nextPage={state.nextPage}
                busy={busy}
                onContinue={advancePage}
                onAskLex={askLex}
                onRetrySearch={retrySearch}
                onGiveFeedback={() => openFeedback('BRIEFING')}
                deepeningPass={openDeepeningPass}
                // 25-D §3 rule 3 — "the panel follows what the user is reviewing". The field
                // the machine currently has open is what the by-question panel marks and sorts
                // on; it never filters, so a contradiction found against the diagnosis stays
                // visible once the user moves on.
                focusFieldRef={state.currentField?.key ?? null}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
