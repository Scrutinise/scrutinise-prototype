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
import StageBar from '@/components/lex/StageBar'
import PanelDivider from '@/components/lex/PanelDivider'
import { usePanelLayout } from '@/components/lex/usePanelLayout'
import { PANEL_ROLES } from '@/lib/lex/panel-layout'
import WorkList from '@/components/lex/WorkList'
// ⚠ THE VOCABULARY ONLY — `stages.ts` holds no prisma, on purpose. `StageContext` is a
// TYPE import, erased at compile, so the server-only counting module never reaches the
// browser bundle. See `lib/lex/stages.ts`.
import { stageByKey, type LexStageKey } from '@/lib/lex/stages'
import type { StageContext } from '@/lib/lex/stage-context'
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
  /** 25-K §1 — the three stages, which one this is, and what is on the other two. */
  stageCtx?: StageContext | null
  /**
   * 25-K §4 — WHICH STAGE THIS SCREEN IS SERVING.
   *
   * ⚠ ONE ROUTE, TWO STAGES, AND THAT IS DELIBERATE. Stage 2 and Stage 3 read the same
   * canonical state, the same chat and the same legislation panel; only the middle column
   * differs. A second route would have duplicated the boot, the transcript and the panel
   * wiring so that one column could change, and the two copies would drift.
   */
  stage?: LexStageKey
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

/**
 * 25-H §5 — a collapsed panel, as a slim labelled edge.
 *
 * ⚠ PRESENT, NOT ABSENT. §5: "collapse to slim, labelled edges — present, not absent, so
 * the user knows what is coming." A panel that vanishes teaches the user it does not
 * exist; one that is a labelled strip teaches them it is waiting. The hint says WHAT it is
 * waiting for, so "empty" and "not yet" are not the same thing on screen.
 *
 * ⚠ DESKTOP ONLY. On mobile the three panels are already a tab bar — there is nothing to
 * collapse, and rendering an edge beside the tabs would be a second navigation for the
 * same thing.
 */
function PanelEdge({ label, hint, onOpen }: { label: string; hint: string; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      title={`Open ${label}`}
      className="hidden lg:flex h-full w-full border-l border-zinc-200 bg-zinc-50/70 hover:bg-zinc-100 transition-colors items-start justify-center pt-4"
    >
      <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] tracking-wide text-zinc-500 whitespace-nowrap">
        <span className="font-semibold text-zinc-700">{label}</span>
        <span className="mx-2 text-zinc-300">·</span>
        {hint}
      </span>
    </button>
  )
}

export default function CreateIdeaClient({ openingBubbles, initialIdeaId, initialMessages, isFirstIdea, stageCtx = null, stage: lexStage = 'strategy' }: Props) {
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
  /**
   * ⚠ 25-H §5 — PROGRESSIVE DISCLOSURE, AND `null` IS NOT `false`.
   *
   * Charlie: *"perhaps it's cleaner to minimise the RH panel when in this first stage, even
   * collapse the middle and right hand panels at first, but there should be an easy and
   * clear UI to get them back."*
   *
   * `null` means "nobody has said" — the panel follows CONTENT, opening by itself once
   * there is something in it. A boolean would freeze the first render's answer: a user who
   * arrived before the build finished would keep an empty-looking panel closed for ever,
   * and one who arrived after would never see the uncluttered first stage. The moment the
   * user touches a toggle their answer wins and stops being recomputed.
   */
  const [panelOpen, setPanelOpen] = useState<{
    // 25-L §4 — the LEFT panel is hideable too now. §4: "all three panels hideable,
    // individually, with a persistent way to bring each back." It was the one column with no
    // way to get it out of the way, which on a laptop is the one you most want gone while
    // reading a long finding.
    chat: boolean | null
    fields: boolean | null
    background: boolean | null
  }>({ chat: null, fields: null, background: null })
  const bootedRef = useRef(false)
  /** 25-K §3 — bumped whenever a mutation may have changed what is waiting on the user. */
  const [worklistNonce, setWorklistNonce] = useState(0)
  /**
   * 25-L §4 — which panels are open and how wide, per USER.
   *
   * ⚠ `touched` IS THE RECONCILIATION WITH 25-H §5. That sprint made the panels follow
   * CONTENT — they open by themselves once there is something in them — with `null` meaning
   * "nobody has said". A stored layout IS somebody saying, so the content rule applies until
   * the user has stored one and their choice wins from then on.
   */
  const panels = usePanelLayout()
  /**
   * 25-L §6 — how many things are waiting on the user, for the mobile badge.
   *
   * ⚠ REPORTED BY THE WORKLIST, NOT COUNTED AGAIN HERE. The left column already fetches
   * the agenda and applies the rules about which gaps are the user's to close; a second
   * count computed from the same endpoint by different code is two numbers on one screen
   * that will eventually disagree, and the badge is the one the user will believe.
   */
  const [waitingCount, setWaitingCount] = useState(0)

  /**
   * ⚠ THE SECOND (AND LAST) WARM-ON-INTENT CALLER. See `/api/search/warm`.
   *
   * The proposal surface searches — the legislation panel and every field-level
   * interrogation go through the same two services — so arriving here predicts a search
   * just as the hub does. Two callers, both chosen because they precede a search; nothing
   * in a layout, because warming on every navigation would keep both services awake and
   * remove the saving.
   */
  const warmedRef = useRef(false)
  useEffect(() => {
    if (warmedRef.current) return
    warmedRef.current = true
    void fetch('/api/search/warm', { method: 'POST' }).catch(() => {})
  }, [])

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

  /**
   * 25-K §3 — the worklist re-reads when the page has changed something it counts.
   *
   * ⚠ A NONCE, NOT A POLL. The agenda is a pure read and cheap, but polling it every few
   * seconds would spend a request per user per tick to notice a change only this page can
   * make. Every mutation lands here, so this is the one place that knows.
   */
  const applyState = useCallback((s: CanonicalState) => {
    setState(s)
    setWorklistNonce((n) => n + 1)
  }, [])

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
  // ⚠ 25-H §5 — WHAT COUNTS AS "SOMETHING IN IT", measured rather than guessed.
  //
  // The proposal panel has content once any field has left EMPTY; the legislation panel
  // once anything has been retrieved. Both are facts already on the canonical state, so
  // neither panel needs to be told when to open — it follows the work.
  const fieldsHaveContent = !!state?.pages.some((pg) => pg.fields.some((f) => f.status !== 'EMPTY'))
  const backgroundHasContent =
    !!state?.initialBackground || (state?.legislationRefs?.length ?? 0) > 0
  // ⚠ THREE SOURCES, IN PRECEDENCE ORDER, AND THE ORDER IS THE DESIGN:
  //   1. this session's explicit toggle (`panelOpen`)  — what they just pressed
  //   2. their stored layout (`panels.touched`)        — what they decided before
  //   3. the content rule (25-H §5)                    — what nobody has said anything about
  // Reading them the other way round would let a stored preference override a click the
  // user made two seconds ago, which is the version that feels broken.
  const showChat = panelOpen.chat ?? (panels.touched ? panels.layout.open.left : true)
  const showFields = panelOpen.fields ?? (panels.touched ? panels.layout.open.middle : fieldsHaveContent)
  const showBackground = panelOpen.background ?? (panels.touched ? panels.layout.open.right : backgroundHasContent)

  // ⚠ THE TEMPLATE IS BUILT FROM WHAT IS ACTUALLY SHOWN, not from the stored layout alone —
  // otherwise a panel closed by this session's toggle would still be given a column.
  const shown = { left: showChat, middle: showFields, right: showBackground }
  const openCols = (['left', 'middle', 'right'] as const).filter((k) => shown[k])
  const totalW = openCols.reduce((n, k) => n + panels.layout.width[k], 0) || 1
  const colTemplate = (['left', 'middle', 'right'] as const)
    .map((k) => (shown[k] ? `${((panels.layout.width[k] / totalW) * 100).toFixed(3)}fr` : '2.5rem'))
    .join(' 0.375rem ')

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

      {/* ══ 25-K §1 — THE PERSISTENT STAGE INDICATOR ══════════════════════════
          On every screen of this surface (all three panels, all four pages, both stages
          it serves), because "which stage am I in and what is it for" is a question a
          user asks continuously, not once. It replaces 25-G's build/proposal switch —
          those were implementation words; see `lib/lex/stages.ts`. */}
      {stageCtx && (
        <div className="border-b border-zinc-100 px-4 pt-2 pb-1.5">
          <div className="max-w-3xl mx-auto">
            <StageBar context={stageCtx} />
          </div>
        </div>
      )}

      {/* Persistent help affordance — a prominent pill, centred above the chat column
          (the left column of the lg 3-col grid) so it's unmissable (Sprint 1.4).
          §19-C Task 7: Exit sits to its left, so leaving is always in reach. */}

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
          {/* ⚠⚠ 25-L §4 — THE RESET, AND IT HAS TO BE FINDABLE WITHOUT ALREADY KNOWING IT
              EXISTS. A user reaches for this at exactly the moment the screen is wrong, and
              a control hidden inside the panel they have just collapsed is a control they
              cannot get to. So it lives in the persistent bar, beside Exit.

              ⚠ IT IS SHOWN ONLY ONCE THERE IS SOMETHING TO RESET. An always-present "Reset
              layout" on a screen nobody has touched is an invitation to wonder what is
              broken. */}
          {(panels.touched || panelOpen.chat !== null || panelOpen.fields !== null || panelOpen.background !== null) && (
            <button
              onClick={() => {
                panels.reset()
                setPanelOpen({ chat: null, fields: null, background: null })
              }}
              className="hidden lg:block text-xs font-medium text-zinc-500 hover:text-zinc-900 border border-zinc-300 rounded-full px-3 py-2 hover:bg-zinc-50 transition-colors"
              title="Put the three panels back to their default widths, all open"
            >
              Reset panels
            </button>
          )}
        </div>
      </div>

      {/* ══ 25-L §6 — THE MOBILE TAB BAR, AT THE BOTTOM ═══════════════════
          ⚠⚠ THREE COLUMNS CANNOT BE THREE COLUMNS ON A PHONE; THEY BECOME THREE MODES.
          The bar was at the TOP, which on a phone is the one part of the screen a thumb
          cannot reach while holding it — so switching mode meant a two-handed reach on
          every switch. §6: "thumb-reachable and universally understood. Not swipe-only: a
          gesture with no visible control is a feature most users never find."

          ⚠⚠ AND THE DRAFT TAB CARRIES A COUNT. §6: "On a phone the user cannot see the task
          list while doing anything else, so the task list has to come to them." The number
          is the outstanding items from the SAME worklist the left column renders — not a
          second count computed a second way, which is how two numbers on one screen come to
          disagree.

          ⚠ THE COUNT IS A NUMBER AND A WORD, NEVER A COLOURED DOT. Charlie is colour blind
          (docs/CLAUDE.md §21); a red dot meaning "something needs you" is the exact signal
          he cannot read. */}
      <nav
        aria-label="Panels"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex border-t border-zinc-200 bg-white text-xs font-medium pb-[env(safe-area-inset-bottom)]"
      >
        {(['chat', 'fields', 'background'] as Tab[]).map((t) => {
          const label = t === 'fields'
            ? (lexStage === 'deepening' ? 'The passes' : PANEL_ROLES.middle.name)
            : t === 'background' ? PANEL_ROLES.right.name : PANEL_ROLES.left.name
          const badge = t === 'fields' ? waitingCount : 0
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-current={tab === t ? 'page' : undefined}
              className={`flex-1 py-3 flex items-center justify-center gap-1.5 ${
                tab === t
                  ? 'font-semibold text-blue-700 border-t-2 border-blue-600 -mt-px'
                  : 'text-zinc-500'
              }`}
            >
              {label}
              {badge > 0 && (
                <span
                  className="rounded-full border border-zinc-900 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-white"
                  aria-label={`${badge} waiting on you`}
                >
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

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


      {/* ⚠ THE COLUMN AREA IS PADDED ON MOBILE so the fixed bar does not sit on top of the
          last line of whatever the user is reading. `lg:pb-0` because there is no bar on a
          desktop and the padding would be a strip of nothing at the bottom of the page. */}
      <div className="flex-1 min-h-0 pb-14 lg:pb-0">
        {booting || !state ? (
          <div className="h-full flex items-center justify-center text-sm text-zinc-400">
            {error ?? 'Starting your session…'}
          </div>
        ) : (
          // ══ 25-L §4 — THE COLUMNS ARE THE USER'S, NOT FOUR HARDCODED ARRANGEMENTS ══
          //
          // ⚠ A CSS VARIABLE, NOT AN INLINE `gridTemplateColumns`. An inline style beats
          // every class including the `lg:` breakpoint, so setting the template directly
          // would apply the three-column layout on a phone as well — where the three panels
          // are three TABS and only one is on screen. The variable is set inline and READ
          // only inside `lg:`, so mobile keeps its single column.
          <div
            className="h-full grid grid-cols-1 lg:[grid-template-columns:var(--lex-cols)]"
            style={{ ['--lex-cols' as string]: colTemplate }}
          >
            {/* ══ 25-K §3 — PANEL 1 IS A WORKLIST WITH A CHAT UNDER IT ═══════════
                §3, and it is the single most important change in the sprint: *"the left
                column stops being a transcript and becomes a worklist."* The order is the
                brief's and it is not negotiable —
                  1. what to do next, as a plain list, in order;
                  2. what this stage is, in one line;
                  3. the chat, BENEATH the list, for asking about any of it.
                The chat was the whole column and it answered "what can I ask?" while
                leaving "what should I do?" for the user to work out. */}
            {!showChat && (
              <PanelEdge
                label={PANEL_ROLES.left.name}
                hint="what to do next, and the chat"
                onOpen={() => setPanelOpen((p) => ({ ...p, chat: true }))}
              />
            )}
            <div className={`h-full min-h-0 border-r border-zinc-200 flex-col ${tab === 'chat' ? 'flex' : 'hidden'} ${showChat ? 'lg:flex' : 'lg:hidden'}`}>
              {/* ⚠ 25-L §4 — THE ROLE IS STATED, NOT INFERRED. §4's table exists because a
                  user who cannot say what a column is FOR cannot decide whether to widen it,
                  and until now all three were guessed at from their contents. */}
              <div className="flex items-baseline gap-2 shrink-0 border-b border-zinc-100 px-3 py-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                  {PANEL_ROLES.left.name}
                </span>
                <span className="text-[11px] text-zinc-400 flex-1 truncate">{PANEL_ROLES.left.role}</span>
                <button
                  onClick={() => setPanelOpen((p) => ({ ...p, chat: false }))}
                  className="hidden lg:block text-[11px] text-zinc-400 hover:text-zinc-700"
                  title={`Collapse ${PANEL_ROLES.left.name}`}
                >
                  collapse ‹
                </button>
              </div>
              {ideaId && (
                <div className="shrink-0 max-h-[42%] overflow-y-auto">
                  <WorkList
                    ideaId={ideaId}
                    scope={lexStage}
                    refreshNonce={worklistNonce}
                    onOutstanding={setWaitingCount}
                  />
                </div>
              )}

              {/* §3.2 — WHAT THIS STAGE IS, ONE LINE, ALWAYS VISIBLE, and drawn from the
                  same constant the indicator above uses so the two cannot say different
                  things about the same stage. */}
              <p className="shrink-0 border-b border-zinc-100 px-3 py-1.5 text-[11px] text-zinc-500">
                <span className="font-semibold text-zinc-700">{stageByKey(lexStage).name}.</span>{' '}
                {stageByKey(lexStage).purpose}
              </p>

              <div className="flex-1 min-h-0">
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
            </div>

            {/* ⚠ A DIVIDER ONLY BETWEEN TWO OPEN PANELS. Between an open panel and a
                collapsed EDGE there is nothing to resize, and a handle that does nothing is
                worse than no handle. */}
            {showChat && showFields && <PanelDivider a="left" b="middle" onDrag={panels.drag} />}

            {/* Panel 2 — the middle column. 25-H §5: a slim labelled EDGE when there is
                nothing in it yet, so the user knows what is coming rather than meeting it
                cold.

                ⚠ 25-K §1 — THE LABEL IS NOT "YOUR PROPOSAL" ANY MORE. "The proposal" was
                one of the two implementation words a user had to translate before they
                could navigate; the panel holds the draft, so it says so. */}
            {!showFields && (
              <PanelEdge
                label={lexStage === 'deepening' ? 'The passes' : 'The draft'}
                hint={fieldsHaveContent ? 'open' : 'fills in as we go'}
                onOpen={() => setPanelOpen((p) => ({ ...p, fields: true }))}
              />
            )}
            <div className={`h-full min-h-0 border-r border-zinc-200 ${tab === 'fields' ? 'block' : 'hidden'} ${showFields ? 'lg:block' : 'lg:hidden'}`}>
              <div className="flex items-baseline gap-2 border-b border-zinc-100 px-3 py-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                  {lexStage === 'deepening' ? 'The passes' : PANEL_ROLES.middle.name}
                </span>
                <span className="text-[11px] text-zinc-400 flex-1 truncate">{PANEL_ROLES.middle.role}</span>
                <button
                  onClick={() => setPanelOpen((p) => ({ ...p, fields: false }))}
                  className="hidden lg:block text-[11px] text-zinc-400 hover:text-zinc-700"
                  title={lexStage === 'deepening' ? 'Collapse the passes' : 'Collapse the draft'}
                >
                  collapse ›
                </button>
              </div>

              {/* ══ 25-K §4 — STAGE 3 IS A STAGE, NOT A SECTION AT THE BOTTOM ═══════
                  §4: the Deepening was "currently reachable only by scrolling past
                  everything else". At Stage 3 the middle column IS the deepening — its
                  passes, their findings and the issues to work through — with the same
                  worklist shape as Stage 2 in the column beside it. */}
              {lexStage === 'deepening' ? (
                <div className="h-full min-h-0 overflow-y-auto px-3 pb-6">
                  <DeepeningPanel
                    ideaId={state.ideaId}
                    unlocked={kernelComplete}
                    onOpenPass={setOpenDeepeningPass}
                    onDiscussIssue={discussIssue}
                  />
                </div>
              ) : (
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
                    {/* 25-C §3 — THE AGENDA COMES FIRST. The user is handed what to DO
                        rather than a library to search. It renders nothing until a build
                        has completed, and it is what the worklist's rows jump to.

                        ⚠⚠ 25-K §4 — THE DEEPENING NO LONGER LIVES UNDER IT. It was
                        reachable "only by scrolling past everything else", which is a
                        stage of work filed as a footnote to another one. It is Stage 3
                        now, with its own screen and its own worklist; what stays here is
                        a route to it, so nobody has to discover that it exists. */}
                    <AgendaPanel ideaId={state.ideaId} />
                    <a
                      href={`/ideas/create?ideaId=${state.ideaId}&stage=deepening`}
                      className="block rounded-lg border-2 border-zinc-200 bg-white px-3 py-2.5 hover:border-zinc-400 hover:bg-zinc-50"
                    >
                      <span className="text-sm font-semibold text-zinc-900">
                        {stageByKey('deepening').n} · {stageByKey('deepening').name} →
                      </span>
                      <span className="block text-xs text-zinc-600 mt-0.5">
                        {stageByKey('deepening').purpose}
                      </span>
                    </a>
                  </>
                }
              />
              )}
            </div>

            {showFields && showBackground && <PanelDivider a="middle" b="right" onDrag={panels.drag} />}

            {/* Panel 3 — Legislation / Background. Collapsed until something is in it:
                at stage one it is empty by definition, and an empty panel taking a third
                of the screen is what made the first stage feel like a cockpit. */}
            {!showBackground && (
              <PanelEdge
                label={PANEL_ROLES.right.name}
                hint={backgroundHasContent ? 'open' : 'once we have enough to search on'}
                onOpen={() => setPanelOpen((p) => ({ ...p, background: true }))}
              />
            )}
            <div className={`h-full min-h-0 ${tab === 'background' ? 'block' : 'hidden'} ${showBackground ? 'lg:block' : 'lg:hidden'}`}>
              <div className="flex items-baseline gap-2 border-b border-zinc-100 px-3 py-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                  {PANEL_ROLES.right.name}
                </span>
                <span className="text-[11px] text-zinc-400 flex-1 truncate">{PANEL_ROLES.right.role}</span>
                <button
                  onClick={() => setPanelOpen((p) => ({ ...p, background: false }))}
                  className="hidden lg:block text-[11px] text-zinc-400 hover:text-zinc-700"
                  title="Collapse the resources panel"
                >
                  collapse ›
                </button>
              </div>
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
