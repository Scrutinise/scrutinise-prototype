'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-A — the minimum-elicitation path, end to end.
//
// Four questions → a confirmation → a build with named passes → the existing kernel
// panel. This component holds NO idea of where the user is: the server returns the
// current step and the build's stored status, and this renders whatever it is told,
// exactly as CreateIdeaClient does with canonical state (§3.4).
//
// ⚠ IT ADDS A PATH, IT DOES NOT REMOVE ONE (§0). `/ideas/create` is untouched. When the
// build finishes, this hands off to that page with the same idea id, so the kernel is
// presented "in the panel as it stands today" (§5) rather than in a second viewer built
// for the occasion — and the whole conversation is already above it, because the
// elicitation wrote into the same transcript.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import PublicNav from '@/components/PublicNav'
import BuildProgress from '@/components/lex/BuildProgress'
import BuildFindings from '@/components/lex/BuildFindings'
import type { BuildHighlights } from '@/lib/lex/build-highlights'
import {
  QuestionCard, UnderstandingFailedCard, ConfirmationCard, StartBuildCard, NothingToShowCard,
  Spinner, type StepView,
} from '@/components/lex/ElicitationCards'
// TEMPORARY (24 Aug 2026) — the stopgap previous-ideas list. Re-exported so `page.tsx`
// keeps importing its prop type from the component it renders.
import MyIdeasList, { type MyIdea } from '@/components/lex/MyIdeasList'
import StageBar from '@/components/lex/StageBar'
import YourMaterial from '@/components/lex/YourMaterial'
import HowItWorksModal from '@/components/lex/HowItWorksModal'
import FeedbackDialog from '@/components/lex/FeedbackDialog'
import type { StageContext } from '@/lib/lex/stage-context'
import { WAIT_MESSAGE } from '@/lib/lex/search-wait'

// ══ 25-G §3 — WHAT THE NEW DOOR LOST, RESTORED ═══════════════════════════════
//
// `docs/LEX_25F_CUTOVER.md` §9c inventoried eight things present at `/ideas/create` and
// absent here, and 25-G §3 adopts the recommendation that they are built BEFORE the flag
// is flipped — "shipping a validation door without the control that lets a user say it
// isn't working is the wrong way round."
//
// ⚠ THE ORDER IS THE BRIEF'S AND IT IS NOT ALPHABETICAL. Feedback capture is first for
// exactly that reason: the whole point of the flip is to find out whether this door works
// on real users, and it would have shipped without the one control that lets them say it
// does not.

/**
 * A5 — "say the word". A conservative match for a user asking how the platform works, so
 * the tour opens instead of the answer being filed as their description of a problem.
 *
 * ⚠ COPIED FROM `CreateIdeaClient`, DELIBERATELY, AND THE DUPLICATION IS THE POINT: it is
 * a UI affordance of one screen, not shared logic, and the two doors ask different
 * questions. Extracting it would couple the elicitation's answer box to the create page's
 * chat box, and the next person to widen one would silently widen the other.
 *
 * ⚠ AND IT IS NARROW ON PURPOSE. A false positive here is worse than on the create page:
 * it would swallow an ANSWER — the user's own words about their problem — and show them a
 * tour instead. So it matches only a whole message that is plainly the question.
 */
const HELP_INTENT =
  /^(?:\s*(?:yes|sure|ok(?:ay)?|please|go on|yes please)[ ,.!]*)*(?:can|could)?\s*(?:you\s+)?(?:please\s+)?(?:show me (?:how (?:this|it) works|around|the ropes)|how (?:do|does) (?:this|it|i) (?:work|use this)|how (?:this|it) works|explain how (?:this|it) works|give me (?:a|the) tour|guided tour|walk me through (?:this|it))[ ?.!]*$/i

/**
 * A1 — the user has just criticised something Lex produced, so the offer to pass it back
 * appears where the criticism was made. Same source as the create page (§20.5).
 */
const CRITIQUE_INTENT =
  /\b(?:that(?:'s| is)|this(?:'s| is)|it(?:'s| is))\s+(?:not\s+right|wrong|incorrect|inaccurate|nonsense|rubbish|way off|miles off|misleading|too (?:low|high|vague|generic))\b|\b(?:you(?:'ve| have)?\s+(?:got|gotten)\s+(?:that|this|it)\s+wrong|you(?:'re| are)\s+wrong|that(?:'s| is)\s+made\s+up|you\s+made\s+that\s+up)\b|\bdoesn(?:'|\u2019)?t\s+(?:make\s+sense|reflect|match)\b|\bi\s+don(?:'|\u2019)?t\s+(?:agree|think\s+that(?:'s| is)\s+right)\b/i
export type { MyIdea }

// The server's shapes, restated for the client. Kept structural rather than imported
// wholesale so this file cannot accidentally pull server-only code into the bundle.
interface Msg { role: string; content: string; stage?: string; field?: string }
export type ElicitationPhase = 'QUESTION' | 'UNDERSTANDING_FAILED' | 'AWAITING_CONFIRMATION' | 'CONFIRMED'
export interface ElicitationState {
  ideaId: string
  status: 'IN_PROGRESS' | 'AWAITING_CONFIRMATION' | 'CONFIRMED'
  /** 25-E §1 — the ONE value this component switches on. The server decides it. */
  phase: ElicitationPhase
  steps: StepView[]
  currentStep: string | null
  understanding: string | null
  problemGate: { fired: boolean; presses: number; spent: boolean }
  reading: { url: string | null; fileName: string | null; note: string | null; status: string }
  goalKinds: ReadonlyArray<{ key: string; label: string }>
  corrections: number
  messages: Msg[]
  hasBuild: boolean
  /** 25-H §3 — an answer has moved since the reading was agreed. */
  staleUnderstanding: boolean
}
export interface PassRecord {
  key: string; label: string; detail: string
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'NOT_REACHED' | 'SKIPPED'
  startedAt: string | null; completedAt: string | null
  output: string | null; failureReason: string | null
  /** 25-B §8 — what this pass is doing RIGHT NOW, written while it runs. */
  activity?: string | null
}
export interface BuildView {
  id: string; version: number
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED'
  framing: string
  passes: PassRecord[]; passesComplete: number; passesTotal: number
  currentPass: string | null
  startedAt: string | null; completedAt: string | null; elapsedSeconds: number | null
  failureReason: string | null; cancelRequested: boolean
  summaryMessage: string | null
  uncertainties: Array<{ fieldKey: string; sentence: string }>
  queryUsed: string | null
  spend: { tokensIn: number; tokensOut: number; pence: number | null; line: string }
  /** 25-B §8 — the same spend, broken down by pass. */
  spendByPass: Array<{ key: string; label: string; tokensIn: number; tokensOut: number; pence: number | null }>
  /** 25-B §1 — the pass the SERVER wants run next, or null when there is none. */
  nextPass: string | null
  resumable: boolean
  /** AMENDMENT_25B §B — no worker picked this up, so the page is driving it instead. */
  workerLate: boolean
  forks: Array<{
    id: string; forkKey: string; fieldKey: string; chosen: string
    alternative: string; caseForAlternative: string; alternativeIndex: number; resolved: boolean
  }>
  /**
   * 25-F §1 — what the build actually produced, ranked for the screen.
   *
   * ⚠ THE TYPE IS IMPORTED, THE MODULE IS NOT. `import type` is erased at compile, so
   * this carries no server code into the bundle — and restating a nine-field nested shape
   * by hand is how the client and the server come to disagree about what a finding is.
   */
  highlights: BuildHighlights | null
  /** 25-F §2e — which model actually answered, per pass. */
  modelsByPass: Array<{ key: string; models: string[] }>
  /** 25-F §4 — the queries this build issued, and how each was built. */
  queries: Array<{ by: string; terms: string[]; purpose: string; provenance: 'written' | 'extracted' }>
}
export interface BuildState {
  ideaId: string; canStart: boolean; blockedReason: string | null
  latest: BuildView | null
  history: Array<{ id: string; version: number; status: string; framing: string; completedAt: string | null }>
  ceiling: { budgetMs: number; binding: string; costPence: number }
  /** AMENDMENT_25B §B — 'worker' (the build survives this page closing) or 'client'
   *  (the fallback, which needs the page to stay open). The server decides and says. */
  driver: 'worker' | 'client'
  /** AMENDMENT_25B §C4 — measured from the last 20 successful builds, or an admission
   *  that there are not yet enough to have a figure. */
  estimate: {
    meanSeconds: number | null
    sampleSize: number
    minutes: number | null
    line: string
    offerEmail: boolean
  }
  /** §C4 — the user's remembered "email me when it's done" choice. */
  emailDefault: boolean
  /** 25-F §7 — the idea's name, once the build has given it one. Null = still untitled. */
  ideaTitle: string | null
  /** 25-G §1a — what a re-run would reuse, or null when there is nothing to reuse. */
  reuse: { findings: number; cited: number; sources: number; fromVersion: number } | null
  /** 25-G §1a — WHY reuse is unavailable, in words. Null when it is available. */
  reuseBlockedReason: string | null
}

/**
 * AMENDMENT_25B §A.3 — fetch JSON, and FAIL WITH THE ACTUAL REASON.
 *
 * ⚠ THE `.json()` CALL IS WHERE THE REAL CAUSE USED TO DISAPPEAR. A route that is not
 * deployed returns Next's HTML 404 page; calling `.json()` on it throws
 * "Unexpected token '<'", which is a JSON parse error standing where "that endpoint does
 * not exist" should be. That is precisely what happened to `/api/ideas/[id]/build` — the
 * file had never been committed — and the parse error was swallowed into a generic
 * message for two days.
 *
 * So the STATUS is checked before the body is parsed, and a non-JSON body is reported as
 * a missing or broken endpoint rather than as bad JSON.
 */
async function getJson(url: string, cid: string, init?: RequestInit): Promise<Record<string, unknown>> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch (err) {
    throw new Error(`the network request to ${url} failed`)
  }

  if (!res.ok) {
    // 404 is the one worth naming exactly: it means the endpoint is not there at all,
    // which is a deployment fact, not a user problem.
    if (res.status === 404) throw new Error(`${url} is not available on this deployment (404)`)
    if (res.status === 401 || res.status === 403) throw new Error(`you are not signed in for ${url} (${res.status})`)
    throw new Error(`${url} returned ${res.status}`)
  }

  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('application/json')) {
    console.error(`[build-boot ${cid}] ${url} returned ${type || 'no content-type'}, not JSON`)
    throw new Error(`${url} did not return JSON (got ${type || 'no content-type'})`)
  }

  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    throw new Error(`${url} returned a body I could not read as JSON`)
  }
}


export default function BuildIdeaClient(
  { initialIdeaId, resumed = false, recent = [], hiddenEmpty = 0, stageCtx = null,
    isFirstIdea = false, displayName = null, blankState = null, materialCount = 0 }: {
    initialIdeaId?: string
    resumed?: boolean
    /** 25-J §2 — the user's own ideas, listed on the hub. See `MyIdea`. */
    recent?: MyIdea[]
    hiddenEmpty?: number
    /** 25-K §1 — the three stages, which one this is, and what is on the other two. */
    stageCtx?: StageContext | null
    /** A3 — this user's very first idea: the tour opens unprompted, as it does at the old door. */
    isFirstIdea?: boolean
    /** A3 — how they want to be addressed. Falls back to nothing rather than to "there". */
    displayName?: string | null
    /**
     * 25-I §1 — the first question, with no idea behind it. `ideaId: ''`.
     * Present only when there is nothing to resume; see `blankElicitationState`.
     */
    blankState?: ElicitationState | null
    /**
     * 25-K §2 — how many documents and links are already on this idea, so the composer's
     * "+" can carry a count from the first paint.
     *
     * ⚠ SEEDED FROM THE SERVER, THEN OWNED BY THE PANEL. `YourMaterial` only mounts when
     * the "+" is open, so a count read only from it would be 0 until the user opened a
     * panel to find out whether it was worth opening.
     */
    materialCount?: number
  },
) {
  const [ideaId, setIdeaId] = useState<string | null>(initialIdeaId ?? null)
  /**
   * ⚠ 25-I §1 — THE ID, READABLE SYNCHRONOUSLY.
   *
   * `ensureIdea` creates the idea inside an event handler and the very next line needs the
   * id to POST the answer. `setIdeaId` does not update the closed-over `ideaId` until the
   * next render, so a state read there would be `null` and the first answer would be
   * dropped — the exact failure this section exists to remove, wearing different clothes.
   */
  const ideaIdRef = useRef<string | null>(initialIdeaId ?? null)
  const [elicit, setElicit] = useState<ElicitationState | null>(null)
  const [build, setBuild] = useState<BuildState | null>(null)
  const [booting, setBooting] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** TRUE when the elicitation moved and the build half could not be re-read with it. */
  const [buildStale, setBuildStale] = useState(false)
  const bootedRef = useRef(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 25-B §1 — the pass this client currently has in flight, so polls do not stack POSTs. */
  const drivingRef = useRef<string | null>(null)
  /**
   * AMENDMENT_25B §C — the last build status this SESSION actually observed.
   *
   * ⚠ IT STARTS NULL ON PURPOSE. The notification must fire on a TRANSITION we watched,
   * never on what we found. Opening the page on a build that finished yesterday would
   * otherwise raise "your build is ready" for something the user read last night.
   */
  const lastStatusRef = useRef<string | null>(null)

  // Local form state for the current step.
  const [text, setText] = useState('')
  const [goalKind, setGoalKind] = useState('')
  const [ruledOut, setRuledOut] = useState('')
  const [readingUrl, setReadingUrl] = useState('')
  const [correction, setCorrection] = useState('')
  /** AMENDMENT_25B §C4 — the checkbox, seeded from the user's remembered default. */
  const [emailWhenDone, setEmailWhenDone] = useState(false)
  const emailSeededRef = useRef(false)

  // ── 25-G §3 — the restored affordances ───────────────────────────────────
  // A3: on a user's very first idea the walkthrough opens unprompted, exactly as it does
  // at the old door (`CreateIdeaClient`: `useState(Boolean(isFirstIdea))`).
  const [showHelp, setShowHelp] = useState(Boolean(isFirstIdea))
  // A1: the consent flow. Nothing is stored or sent until an explicit yes.
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackOffer, setFeedbackOffer] = useState(false)
  // A6: Exit, and the prompt that stops a half-typed answer being thrown away.
  const [exitPrompt, setExitPrompt] = useState(false)
  /**
   * ⚠ 25-H §3 — WHICH PILL IS OPEN.
   *
   * The step rail was five inert `<li>`s. Charlie: *"None of these pill buttons work. They
   * should show up the initial data I wrote in so I can edit that before I do a rebuild."*
   *
   * The data was already on the wire — `steps[].answer` has carried each answer since 25-A
   * — so nothing needed fetching. What was missing was somewhere to put it and a way back
   * to the server with it.
   */
  const [editingStep, setEditingStep] = useState<string | null>(null)

  /**
   * ⚠⚠ 25-K §2 — THE COMPOSER'S "+", AND ITS COUNT.
   *
   * The upload existed and was unfindable: a panel that appeared on ONE of the four
   * questions, plus a bare file input further down the page. Charlie looked for it in the
   * obvious place — beside the box he was typing in — and concluded it was not built.
   * It now opens from the composer, on every question, and stays available after the
   * elicitation is confirmed.
   */
  const [attachOpen, setAttachOpen] = useState(false)
  const [attached, setAttached] = useState(materialCount)

  /**
   * ⚠ WARM THE SEARCH SERVICES ON INTENT — the ideas hub is one of exactly two callers.
   *
   * `fts-serve` and `vector-serve` sleep on inactivity to cut the standing cost, and a wake
   * costs ~13 s. Firing it here means the wake overlaps with the user reading the first
   * question and typing their answer, so by the time they press Send the services are up
   * and nobody waits for anything.
   *
   * ⚠ ONCE PER MOUNT, NOT ON EVERY RENDER, and NOT in a layout. Warming on every page in
   * the app would keep both services permanently awake and undo the entire saving.
   */
  const warmedRef = useRef(false)
  /**
   * ⚠ WHETHER A SERVICE WAS ACTUALLY ASLEEP WHEN WE ARRIVED — measured, not guessed.
   *
   * The warm probe reports `alreadyAwake` per service. That is real information about the
   * system at this moment, and it is what lets the screen say "waking" honestly instead of
   * inferring it from a slow response later (which would label every slow query a wake and
   * make the message worthless on the day it mattered).
   */
  const [waking, setWaking] = useState(false)
  useEffect(() => {
    if (warmedRef.current) return
    warmedRef.current = true
    void fetch('/api/search/warm', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { results?: Array<{ alreadyAwake?: boolean }> } | null) => {
        // Asleep on arrival → the wake is happening NOW, while they read the question.
        if (j?.results?.some((x) => x.alreadyAwake === false)) {
          setWaking(true)
          // ⚠ CLEARED ON A TIMER, NOT ON A SECOND PROBE. Polling would cost another request
          // per second for a message; the measured wake is ~13 s and the copy promises
          // "about half a minute", so clearing at 30 s is the promise keeping itself.
          setTimeout(() => setWaking(false), 30_000)
        }
      })
      // Silent: this is a courtesy to a later request, and surfacing an error here would
      // report a problem the user does not have.
      .catch(() => {})
  }, [])

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    ;(async () => {
      // AMENDMENT_25B §A.3 — a correlation id, so a user's screenshot and the server log
      // can be joined. Generated per boot attempt, printed in the message, and attached
      // to every console line below.
      const cid = Math.random().toString(36).slice(2, 8).toUpperCase()
      try {
        const id = ideaId
        // ══ 25-I §1 — NOTHING IS CREATED BY ARRIVING ═══════════════════════════
        //
        // ⚠⚠ THIS BLOCK USED TO POST `/api/ideas` AND MINT A DRAFT ON EVERY VISIT that had
        // nothing to resume. It was not doing it to record intent — it was doing it because
        // the screen had no way to draw the first question without a row. Charlie's idea
        // list filled with drafts he never started, and the place he goes to find his real
        // work stopped being trustworthy.
        //
        // The server now hands us the first question with no row behind it
        // (`blankElicitationState`), so we render and wait. The idea is created by
        // `ensureIdea` on the first answer — when a person actually starts one.
        if (!id) {
          if (blankState) setElicit(blankState)
          return
        }
        // ⚠⚠ 25-E §2 — PUT THE ID IN THE URL. THE SINGLE MOST IMPORTANT LINE IN THIS FILE.
        //
        // Without it, this page minted a new idea on EVERY visit and kept the id in React
        // state only — so a refresh started a blank elicitation on a fresh idea and orphaned
        // everything the user had written. They had not lost their answers (those were in the
        // database all along); they had lost the way back to them, which to the person sitting
        // there is the same thing and is why Charlie stopped.
        //
        // `replaceState`, not `pushState`: the id is not a navigation the user made, and it
        // must not put a step in their Back history.
        if (typeof window !== 'undefined' && id) {
          const url = new URL(window.location.href)
          if (url.searchParams.get('ideaId') !== id) {
            url.searchParams.set('ideaId', id)
            window.history.replaceState(null, '', url.toString())
          }
        }
        const [e, b] = await Promise.all([
          getJson(`/api/ideas/${id}/elicitation`, cid),
          getJson(`/api/ideas/${id}/build`, cid),
        ])
        setElicit(e as unknown as ElicitationState)
        setBuild(b as unknown as BuildState)
      } catch (err) {
        // ⚠ AMENDMENT_25B §A.3 — THE MESSAGE CARRIES A REASON.
        //
        // "Could not start a session. Please refresh." is what this said for two days
        // while `/api/ideas/[id]/build` was missing from production entirely, and it told
        // the user nothing and us less: a 404 on a route that was never deployed, a 500
        // from a missing table and a dropped connection all produced the same eleven
        // words. The reason now travels with it, and the underlying error is logged
        // against the same id.
        const reason = err instanceof Error ? err.message : String(err)
        console.error(`[build-boot ${cid}] session could not be started:`, err)
        setError(`Could not start a session — ${reason} (ref ${cid}). Please refresh; if it keeps happening, send us that reference.`)
      } finally {
        setBooting(false)
      }
    })()
  }, [ideaId])

  const refresh = useCallback(async () => {
    if (!ideaId) return
    const [e, b] = await Promise.all([
      fetch(`/api/ideas/${ideaId}/elicitation`).then((r) => r.json()).catch(() => null),
      fetch(`/api/ideas/${ideaId}/build`).then((r) => r.json()).catch(() => null),
    ])
    if (e) setElicit(e)
    if (b) setBuild(b)
  }, [ideaId])

  /**
   * 25-E §1 — APPLY BOTH HALVES OF A MUTATION'S ANSWER.
   *
   * ⚠⚠ THE DEFECT THIS REPLACES STOPPED THE ENTIRE PRODUCT. `confirm()` used to write
   * `setElicit(...)` and nothing else, leaving `build` as the object fetched at boot — the
   * one that said `canStart: false` and *"Confirm what I've understood first"*. So confirming
   * removed the confirmation buttons and revealed a permanently greyed-out "Build it" beside
   * a note demanding the user confirm. There was no way forward and no way back.
   *
   * ⚠ AND THE PROOF IS IN THE DATABASE: eleven elicitation rows, one CONFIRMED — and
   * `IdeaBuild` is EMPTY. Not one build has ever been started, by anyone, on this platform.
   * A user reached the end of the flow, agreed to the reading, and could not get past it.
   *
   * The route now returns both halves from the one request that changed either. `build` is
   * only overwritten when the server actually sent it: a null means "unreadable", and keeping
   * a stale object is better than blanking a panel — but it must never be treated as fresh,
   * so `buildStale` below says so on screen.
   */
  const applyMutation = useCallback((data: Record<string, unknown> | null) => {
    if (!data) return
    if (data.state) setElicit(data.state as ElicitationState)
    if (data.build) { setBuild(data.build as BuildState); setBuildStale(false) }
    else if (data.state) setBuildStale(true)
  }, [])

  // Poll ONLY while a build is actually running. The status shown is the status the
  // server stored — nothing here infers "probably finished by now".
  useEffect(() => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }
    const s = build?.latest?.status
    if (s !== 'RUNNING' && s !== 'QUEUED') return
    pollRef.current = setTimeout(() => { void refresh() }, 3000)
    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [build, refresh])

  /**
   * ⚠ 25-G §2 — ONCE A BUILD EXISTS, SAY SO IN THE URL.
   *
   * §2 lands a returning user on the PROPOSAL, which the build page does by redirecting
   * when the idea already has a finished build and the URL does not say `build=1`. That
   * rule is right for someone arriving from a link and wrong for someone standing here
   * watching their own build finish — a refresh would throw them off the screen they are
   * reading.
   *
   * So the moment this page is showing a build, it writes the flag into its own URL.
   * `replaceState`, not `pushState`: it is not a navigation the user made, and it must not
   * put a step in their Back history. Same reasoning, and the same mechanism, as 25-E's
   * `ideaId` line.
   */
  useEffect(() => {
    if (!build?.latest || typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (url.searchParams.get('build') === '1') return
    url.searchParams.set('build', '1')
    window.history.replaceState(null, '', url.toString())
  }, [build?.latest])

  /**
   * §C4 — seed the checkbox from the remembered default, ONCE.
   *
   * ⚠ Only once: re-seeding on every poll would fight the user, snapping the box back to
   * their old default the moment they unticked it.
   */
  useEffect(() => {
    if (emailSeededRef.current || !build) return
    emailSeededRef.current = true
    setEmailWhenDone(build.emailDefault)
  }, [build])

  /**
   * AMENDMENT_25B §C — TELL THE USER WHEN IT IS DONE.
   *
   * Two of the three the amendment asks for:
   *
   *  1. IN-PAGE, and it is free: the row is the source of truth and the page already
   *     polls it, so a build that finishes while the user is looking elsewhere on the
   *     page updates itself. Nothing to build — but it is only true because the WORKER
   *     runs the build (§B). Under the old design the page had to stay open to make
   *     progress at all, so "it updates itself" would have been a promise about a page
   *     that was doing the work.
   *
   *  2. BROWSER NOTIFICATION, on a permission granted once, so a ten-minute job can be
   *     left in a background tab.
   *
   * ⚠ THE PERMISSION IS NOT REQUESTED ON PAGE LOAD. A prompt that appears before the user
   * has asked for anything is the pattern everyone has learned to dismiss, and a
   * dismissal is permanent — `Notification.permission` becomes "denied" and cannot be
   * asked again. It is requested when they START a build, which is the first moment the
   * offer means anything.
   *
   * ⚠ AND A FAILED BUILD NOTIFIES TOO. Only telling people about success is how someone
   * waits ten minutes for something that stopped after two.
   */
  useEffect(() => {
    const status = build?.latest?.status
    if (!status) return

    const previous = lastStatusRef.current
    lastStatusRef.current = status

    // Only a transition we watched, from running to finished.
    const wasRunning = previous === 'RUNNING' || previous === 'QUEUED'
    const hasFinished = status === 'DONE' || status === 'FAILED' || status === 'CANCELLED'
    if (!wasRunning || !hasFinished) return

    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    const body =
      status === 'DONE'
        ? 'Your idea has been drafted, researched and revised. Open the tab to read it.'
        : status === 'CANCELLED'
          ? 'You stopped the build. Everything it drafted before that has been kept.'
          : build?.latest?.failureReason?.slice(0, 160) ?? 'The build stopped early. What it drafted has been kept.'

    try {
      const n = new Notification(
        status === 'DONE' ? 'Your Scrutinise build is ready' : 'Your Scrutinise build stopped',
        { body, tag: `build-${build?.latest?.id ?? 'x'}`, icon: '/favicon.ico' },
      )
      n.onclick = () => { window.focus(); n.close() }
    } catch {
      // Notification construction can throw on some mobile browsers even with permission
      // granted. The in-page update has already happened, so there is nothing to recover.
    }
  }, [build])

  /**
   * 25-B §1 — DRIVE THE BUILD, ONE PASS PER REQUEST.
   *
   * The build no longer fits in a single request (seven passes, minutes of model time,
   * a 300-second platform ceiling that cannot be raised). So the poll response carries
   * `nextPass` and this triggers it — no new infrastructure, and each pass gets its own
   * full budget.
   *
   * ⚠ `drivingRef` IS THE WHOLE CORRECTNESS ARGUMENT ON THIS SIDE. Polls arrive every
   * three seconds and a pass takes far longer than that, so without it every poll during
   * a running pass would fire another POST. The server refuses a second claim on the same
   * pass, so nothing would be double-run — but the requests would pile up against the
   * platform's concurrency limit for no purpose. The server-side claim is the guard; this
   * is the good manners.
   */
  useEffect(() => {
    const latest = build?.latest
    if (!latest) return
    if (latest.status !== 'RUNNING' && latest.status !== 'QUEUED') return
    if (!latest.nextPass || latest.cancelRequested) return
    if (drivingRef.current) return

    drivingRef.current = latest.nextPass
    void fetch(`/api/ideas/${ideaId}/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // The pass is echoed back as a CHECK, not an instruction — the server runs its own
      // answer if this one is stale. See the route.
      body: JSON.stringify({ pass: latest.nextPass }),
    })
      .catch(() => {
        // A pass request that never lands is not an error the user can act on: the row is
        // unchanged, the next poll sees the same `nextPass`, and it is tried again. A
        // banner here would cry wolf on an ordinary retry.
      })
      .finally(() => {
        drivingRef.current = null
        void refresh()
      })
  }, [build, ideaId, refresh])

  // ── Actions ────────────────────────────────────────────────────────────────
  /**
   * ⚠⚠ 25-I §1 — THE IDEA IS CREATED HERE, ON THE FIRST ANSWER, AND NOWHERE ELSE.
   *
   * §1: *"an idea is created when a person **starts** one, not when a page loads."* Every
   * action on this screen goes through `post`, and `post` goes through here — so there is
   * exactly one place an idea can come into existence, and it is downstream of a user
   * doing something deliberate.
   *
   * ⚠ THE URL IS WRITTEN THE MOMENT THE ID EXISTS, exactly as 25-E's boot did it. That line
   * is what stops a refresh orphaning the answer they just gave; moving creation later must
   * not lose it. `replaceState`, not `pushState` — the id is not a navigation they made.
   *
   * ⚠ THE REF, NOT THE STATE. `setIdeaId` does not update the closed-over `ideaId` until the
   * next render, and the caller needs the id on the very next line.
   */
  const ensureIdea = useCallback(async (): Promise<string | null> => {
    if (ideaIdRef.current) return ideaIdRef.current
    const res = await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled idea' }),
    })
    if (!res.ok) return null
    const created = await res.json().catch(() => null)
    const id = created?.id as string | undefined
    if (!id) return null
    ideaIdRef.current = id
    setIdeaId(id)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (url.searchParams.get('ideaId') !== id) {
        url.searchParams.set('ideaId', id)
        window.history.replaceState(null, '', url.toString())
      }
    }
    return id
  }, [])

  const post = useCallback(async (path: string, body: unknown): Promise<Record<string, unknown> | null> => {
    const id = await ensureIdea()
    if (!id) { setError('Could not start an idea — please try again.'); return null }
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${id}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'That didn’t work — try again.')
        return null
      }
      return data
    } catch {
      setError('That didn’t work — try again.')
      return null
    } finally {
      setBusy(false)
    }
  }, [ensureIdea])

  const answer = useCallback(async (extra: Record<string, unknown> = {}) => {
    const step = elicit?.currentStep
    if (!step) return

    // ⚠ A5 — "SAY THE WORD", AND IT MUST NOT COST THEM THEIR ANSWER. A user typing "how
    // does this work" into the problem box is asking a question, not describing a problem;
    // filing it would put it in front of every drafting pass as their account. The tour
    // opens and the box is LEFT AS IT IS, so if the match was wrong they have lost nothing
    // and can press Send again.
    if (HELP_INTENT.test(text.trim())) {
      setShowHelp(true)
      return
    }
    // A1 — did they just criticise something Lex produced? The offer renders once the turn
    // finishes. Display only; nothing is captured either way.
    setFeedbackOffer(CRITIQUE_INTENT.test(text))
    const data = await post('/elicitation', {
      action: 'answer', step, text, goalKind: goalKind || undefined,
      ruledOut: ruledOut || undefined, readingUrl: readingUrl || undefined, ...extra,
    })
    if (data?.state) {
      applyMutation(data)
      setText(''); setGoalKind(''); setRuledOut(''); setReadingUrl('')
    }
  }, [elicit?.currentStep, post, text, goalKind, ruledOut, readingUrl, applyMutation])

  /**
   * 25-H §3 — send an edited answer. Same route, same step handling; `editing: true` is
   * the only difference, and all it unlocks is re-answering a CONFIRMED elicitation.
   */
  const saveEdit = useCallback(async (stepKey: string) => {
    const data = await post('/elicitation', {
      action: 'answer', step: stepKey, editing: true,
      text, goalKind: goalKind || undefined,
      ruledOut: ruledOut || undefined, readingUrl: readingUrl || undefined,
    })
    if (data?.state) {
      applyMutation(data)
      setEditingStep(null)
      setText(''); setGoalKind(''); setRuledOut(''); setReadingUrl('')
    }
  }, [post, text, goalKind, ruledOut, readingUrl, applyMutation])

  /** Open a pill, seeded with what the user actually wrote. */
  const openStep = useCallback((stepKey: string) => {
    const s = elicit?.steps.find((x) => x.key === stepKey)
    // ⚠ SEEDED FROM THE ANSWER, NOT BLANK. A pill that opens an empty box is a pill that
    // loses the answer it was supposed to show — which is the complaint, one step along.
    setText(s?.answer ?? '')
    setGoalKind('')
    setRuledOut('')
    setReadingUrl('')
    setEditingStep(stepKey)
  }, [elicit?.steps])

  const confirm = useCallback(async () => {
    applyMutation(await post('/elicitation', { action: 'confirm' }))
  }, [post, applyMutation])

  const sendCorrection = useCallback(async () => {
    const data = await post('/elicitation', { action: 'correct', text: correction })
    if (data?.state) { applyMutation(data); setCorrection('') }
  }, [post, correction, applyMutation])

  /** 25-E §1 — the paragraph failed to write. Try again. Not a correction. */
  const retryUnderstanding = useCallback(async () => {
    applyMutation(await post('/elicitation', { action: 'retry' }))
  }, [post, applyMutation])

  /**
   * Start the build. The POST is deliberately NOT awaited for the UI: it runs the whole
   * build server-side and can take minutes, and the progress display is driven by
   * polling the stored row. Awaiting it here would mean a blank screen until it finished,
   * which is the "user who cannot see what a five-minute job is doing assumes it has
   * hung" failure §2 names.
   */
  const startBuild = useCallback((mode: 'FULL' | 'REUSE' = 'FULL') => {
    if (!ideaId) return
    setError(null)

    // AMENDMENT_25B §C — ask now, because now is when it means something. Only when the
    // browser has not already decided: re-requesting a denied permission does nothing,
    // and re-requesting a granted one is a prompt for no reason.
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => {
        // Safari on older versions rejects rather than resolving 'denied'. Nothing to do:
        // the build runs either way and the page still updates itself.
      })
    }
    // Optimistic RUNNING so the panel does not sit inert. The authoritative status still
    // comes from the server on the next poll.
    setBuild((b) => b && ({ ...b, canStart: false }))
    void fetch(`/api/ideas/${ideaId}/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        // §C4 — sent only when the offer was actually shown. Posting `false` on a build too
        // short to have offered would silently clear a preference the user set elsewhere.
        ...(build?.estimate?.offerEmail ? { notifyEmail: emailWhenDone } : {}),
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(typeof data?.error === 'string' ? data.error : 'The build could not be started.')
        }
      })
      .catch(() => setError('The build could not be started.'))
      .finally(() => { void refresh() })
    // Begin polling immediately rather than waiting for the POST to answer.
    setTimeout(() => { void refresh() }, 1200)
  }, [ideaId, refresh, build?.estimate?.offerEmail, emailWhenDone])

  const cancelBuild = useCallback(async () => {
    await post('/build/cancel', {})
    await refresh()
  }, [post, refresh])

  // ── Render ─────────────────────────────────────────────────────────────────
  //
  // 25-E §1 — ONE SWITCH ON ONE SERVER-DECIDED VALUE. The previous version chose between
  // three blocks with three independent conditions, and there is a reachable state in which
  // all three are false — which is a page with no controls on it. `phase` is a closed union
  // and the render below covers every member, so that state cannot be reached again.
  //
  // ⚠ `?? 'QUESTION'` IS FOR ONE CASE ONLY: a client that has been served before the server
  // that sends `phase`. It is not a fallback for an unexpected value — an unknown phase falls
  // to the explicit default at the bottom, which SAYS it does not know rather than showing
  // nothing.
  const step = elicit?.steps.find((s) => s.key === elicit.currentStep) ?? null

  /**
   * 25-E §4b — WHY SEND IS DISABLED, IN WORDS, BESIDE THE BUTTON.
   *
   * ⚠ A disabled control that does not say what would enable it is the same defect as §1a in
   * miniature, and it cost Charlie the same kind of time: he could not press Send on question
   * two and nothing on the page told him a category had to be chosen first. Returning the
   * REASON rather than a boolean means the button and the explanation cannot disagree —
   * there is one expression, and the sentence is derived from it.
   */
  const blockedSend: string | null = !step ? null
    : step.key === 'problem' && !text.trim() ? 'Write something first — anything at all.'
      : step.key === 'goal' && !goalKind ? 'Pick one of the four above to carry on.'
        : null

  /**
   * ⚠⚠ 25-E §1 — THE BACKSTOP, AND IT IS THE POINT OF THE WHOLE SECTION.
   *
   * `phase` is a closed union and every member has a block below, so this should always be
   * true. It is computed anyway, because the defect that stopped this product for eight
   * sprints was precisely a combination of conditions nobody had checked was exhaustive —
   * and the symptom was a page with nothing on it, which is indistinguishable from a crash.
   *
   * If this is ever false the user gets a sentence and a way out instead of a blank panel,
   * and `check:lex-25e` asserts it holds for every reachable state.
   */
  const rendersAControl =
    (elicit?.phase === 'QUESTION' && !!step)
    || elicit?.phase === 'UNDERSTANDING_FAILED'
    || elicit?.phase === 'AWAITING_CONFIRMATION'
    || elicit?.phase === 'CONFIRMED'
  const latest = build?.latest ?? null
  const running = latest?.status === 'RUNNING' || latest?.status === 'QUEUED'
  const finished = latest?.status === 'DONE'
  const stopped = latest?.status === 'FAILED' || latest?.status === 'CANCELLED'

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <PublicNav />

      {/* ══ 25-G §3 — THE PERSISTENT AFFORDANCES, ON EVERY SCREEN OF THIS SURFACE ══
          Exit to the left, "How this works" to the right — the same arrangement and the
          same prominence as the old door (§19-C Task 7 put Exit beside the help pill so
          leaving is always in reach). Above the error banner because they must be usable
          when something has gone wrong, which is when a user most wants both. */}
      <div className="border-b border-zinc-100 px-4 py-2">
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-3">
          <button
            onClick={() => {
              // A6 — a half-typed answer is work. Ask before throwing it away.
              if (text.trim() || correction.trim() || ruledOut.trim()) setExitPrompt(true)
              else window.location.href = '/dashboard'
            }}
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

      {/* A2/A4 — the tour and the FAQ, in the build door's own words. */}
      {showHelp && <HowItWorksModal variant="build" onClose={() => setShowHelp(false)} />}

      {/* A1 — feedback capture. Stores and sends nothing until an explicit yes. */}
      {feedbackOpen && ideaId && (
        <FeedbackDialog
          ideaId={ideaId}
          stage="BUILD"
          initialSurface="OTHER"
          onClose={() => setFeedbackOpen(false)}
        />
      )}

      {/* A6 — the unsaved-answer prompt. */}
      {exitPrompt && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
            <h2 className="text-base font-semibold text-zinc-900">Leave without sending that?</h2>
            <p className="text-sm text-zinc-600 mt-1.5">
              You’ve typed something you haven’t sent yet. Leave now and it’s gone — everything you
              have already sent is saved.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={() => { window.location.href = '/dashboard' }}
                className="text-sm font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:opacity-90"
              >
                Leave anyway
              </button>
              <button
                onClick={() => setExitPrompt(false)}
                className="text-sm font-medium px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-4 py-2 text-center">
          {error}
        </div>
      )}

      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-6">
        {/* ══ 25-K §1 — THE PERSISTENT STAGE INDICATOR ══════════════════
            Above the phase switch, so it is present during the elicitation, during the
            build and after it. It replaces 25-G's build/proposal switch — those were
            implementation words; see `lib/lex/stages.ts`. */}
        <div className="mb-4">
          <StageBar context={stageCtx} />
        </div>

        {/* ⚠⚠ A WAKE IS NOT A SLOW SEARCH AND NOT A FAILURE, AND THIS SAYS WHICH.
            The two search services sleep on inactivity to cut the standing cost; the first
            request after a quiet period waits ~13 s (measured) for a container and an index.
            Thirteen unexplained seconds read as "this is broken"; the same thirteen with a
            sentence read as "this is starting up".

            ⚠ IT IS SHOWN ONLY WHEN A SERVICE REALLY WAS ASLEEP — the warm probe reports it
            per service. Inferring a wake from a slow response would label every heavy query
            a wake, and the message would then mean nothing on the day it was true. */}
        {waking && (
          <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-2">
            <p className="text-sm text-sky-900">{WAIT_MESSAGE.waking}</p>
            <p className="mt-0.5 text-[11px] text-sky-700">
              Nothing is wrong — it sleeps when nobody is using it, which is what keeps it cheap
              to run. Carry on writing; it will be ready before you are.
            </p>
          </div>
        )}

        {booting || !elicit ? (
          <div className="py-24 text-center text-sm text-zinc-400">{error ?? 'Starting your session…'}</div>
        ) : (
          <>
            {/* ⚠ 25-E §2 — THE RESUMPTION IS ANNOUNCED. "Never silently discard" cuts both
                ways: silently RESTORING is nearly as disorienting, because the user cannot
                tell whether what they are looking at is theirs or a fresh start. Charlie's
                refresh gave him a blank form and he concluded — correctly, from what he could
                see — that four questions of writing were gone. */}
            {resumed && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2">
                <p className="text-sm text-emerald-900">
                  Picking up where you left off — everything you told me is still here.
                </p>
                <a href="/ideas/build?fresh=1" className="text-xs text-emerald-800 underline">
                  Start a different idea instead
                </a>
              </div>
            )}

            {/* ⚠ A3 — THE GREETING AND THE FIRST-IDEA INTRO.
                The old door opens with "Good morning Charlie. What's the problem you want
                to fix?" and, on a first idea, a paragraph explaining what the platform is.
                This door opened with a bare question and no name — `elicitation-config`'s
                `OPENING_ASK` and nothing else.

                ⚠ RENDERED, NOT WRITTEN TO THE TRANSCRIPT. The create page seeds these as
                chat bubbles because its transcript IS the conversation. Here the transcript
                is the elicitation's own record of question-and-answer, and injecting a
                greeting into it would put a message in the stored history that Lex never
                said in a turn — and it would be re-sent to every drafting pass as context.
                It belongs on the screen, not in the record. */}
            {!elicit.messages.length && elicit.phase === 'QUESTION' && (
              <div className="mb-5">
                {displayName && (
                  <p className="text-sm text-zinc-800">
                    Good {timeOfDay()} {displayName}.
                  </p>
                )}
                {isFirstIdea && (
                  <p className="text-sm text-zinc-600 leading-relaxed mt-1.5">
                    I’m here to help you turn an idea into a proposal a Member of Parliament could
                    actually read. It’s four questions, then I go away and build a first version —
                    the law as it stands, what’s been tried, where it’s weakest — and bring it back
                    for you to argue with. Nothing I write is yours until you say it is. If you’d
                    like the longer version, press{' '}
                    <button onClick={() => setShowHelp(true)} className="underline text-blue-700 hover:text-blue-900">
                      How this works
                    </button>{' '}
                    above.
                  </p>
                )}
              </div>
            )}

            {/* The step rail — four questions, then a confirmation. Shows how short this is. */}
            {/* ⚠ 25-H §3 — THE RAIL IS NOW THE EDIT CONTROL, NOT A PROGRESS INDICATOR.
                Each pill reopens its own answer, populated. A pill the user has not
                reached yet stays inert — offering to edit an answer that does not exist
                would be a control that does nothing, which is the complaint restated. */}
            <ol className="flex flex-wrap gap-2 mb-4 text-[11px] font-medium">
              {elicit.steps.map((s) => {
                const openable = s.done || s.key === elicit.currentStep
                const open = editingStep === s.key
                return (
                  <li key={s.key}>
                    <button
                      onClick={() => (open ? setEditingStep(null) : openStep(s.key))}
                      disabled={!openable || busy}
                      title={openable ? `Open “${s.label}” and edit what you wrote` : 'You haven’t reached this yet'}
                      className={`px-2.5 py-1 rounded-full border transition-colors ${
                        open
                          ? 'bg-zinc-900 border-zinc-900 text-white'
                          : s.done
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 cursor-pointer'
                            : s.key === elicit.currentStep
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'bg-white border-zinc-200 text-zinc-400 cursor-default'
                      }`}
                    >
                      {s.label}
                      {s.done && <span aria-hidden className="ml-1.5 opacity-60">✎</span>}
                    </button>
                  </li>
                )
              })}
            </ol>

            {/* ⚠ 25-H §3 — AND WHAT THE EDIT WILL COST, SAID WITH THE EDIT.
                25-G's reuse rule refuses to reuse the research once the elicitation has
                moved, so changing an answer means the next build searches again. "Your
                reading is out of date" and "this now costs a full build" are the same
                event; a user should not have to join them up. */}
            {elicit.staleUnderstanding && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2">
                {/* ⚠⚠ 25-I — THE COST HALF OF THIS SENTENCE WAS ASSERTED, NOT CHECKED, AND
                    IT WAS WRONG ON THE LIVE SITE.

                    25-H coupled two facts here on the reasoning that they are one event.
                    They are not: they have DIFFERENT CONDITIONS. `staleUnderstanding` is
                    `updatedAt > confirmedAt` — an answer moved after the reading was agreed.
                    `reuseSourceFor` refuses on `updatedAt > previousBuild.startedAt` — an
                    answer moved after the last build read it. Charlie edited an answer after
                    confirming but BEFORE the build ran, so the reading really is stale AND
                    reuse is still perfectly available. The banner told him a re-run would
                    cost three times what it will.

                    So the price is now read from the build state, which is the thing that
                    decides it, rather than inferred from a neighbouring flag. */}
                <p className="text-sm text-amber-900">
                  You’ve changed an answer since I read it back to you, so the reading you agreed to
                  is now out of date.
                  {build?.reuse
                    ? ' The research I already gathered still stands, so a re-run can reuse it.'
                    : ' The next build will search the corpus again rather than reusing what it found.'}
                </p>
                <button
                  onClick={() => void confirm()}
                  disabled={busy}
                  className="mt-1.5 text-xs font-semibold text-amber-900 underline hover:no-underline disabled:opacity-40"
                >
                  Read it back to me again
                </button>
              </div>
            )}

            {/* The open pill's answer, editable. */}
            {editingStep && (() => {
              const s = elicit.steps.find((x) => x.key === editingStep)
              if (!s) return null
              return (
                <div className="mb-5 rounded-xl border border-zinc-300 bg-white p-3">
                  <p className="text-sm font-semibold text-zinc-900">{s.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{s.cardPrompt ?? s.question}</p>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={Math.min(18, Math.max(4, Math.ceil((text.length || 1) / 80)))}
                    className="mt-2 w-full rounded-lg border border-zinc-300 p-2 text-sm leading-relaxed"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      onClick={() => void saveEdit(s.key)}
                      disabled={busy || !text.trim()}
                      className="text-sm font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
                    >
                      Save this answer
                    </button>
                    <button
                      onClick={() => { setEditingStep(null); setText('') }}
                      disabled={busy}
                      className="text-sm font-medium px-4 py-2 rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* The transcript. Lex's questions and the user's answers, in the same store
                the create page reads — so none of this is lost at the handover. */}
            <div className="space-y-3 mb-6">
              {elicit.messages
                .filter((m) => m.stage === 'ELICITATION' || m.stage === 'BUILD')
                .map((m, i) => (
                  <div
                    key={i}
                    className={`text-sm leading-relaxed whitespace-pre-wrap rounded-2xl px-4 py-3 ${
                      m.role === 'lex'
                        ? 'bg-zinc-50 border border-zinc-200 text-zinc-800'
                        : 'bg-blue-600 text-white ml-8'
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
            </div>

            {/* ══ THE PHASE SWITCH ══════════════════════════════════════════════
                One value, from a closed union, every member handled — and each card is a
                pure component so `verify:lex-25e-ui` can RENDER it and assert a usable
                control comes out. That is the only kind of check that could have caught the
                defect this sprint fixed. */}
            {/* ⚠⚠ 25-H §4 — THE DOCUMENT CONTROL, ON THE STEP THAT ASKS FOR DOCUMENTS.
                This screen asked "is there anything you'd like me to read?" and offered a
                TEXT BOX. It captured a filename onto the elicitation row and no bytes ever
                left the browser — so a user could attach a Word document, be thanked for
                it, and have nothing read. That is the worst kind of failure: they believe
                we have it.

                `YourMaterial` is the 25-D §4 pipeline that stores, extracts, produces
                findings and reports a failed read. It existed the whole time and was
                rendered only by the OLD door's third panel. */}
            {/* ⚠⚠ 25-K §2 — IT IS NO LONGER A BLOCK ABOVE THE CARD ON ONE QUESTION.
                25-H put `YourMaterial` here, on the `reading` step only, which is why
                Charlie could not find it from question one and why it disappeared again
                once he had moved past it. It is now the composer's "+", on every question
                and after the elicitation — same component, same pipeline, findable place. */}
            {elicit.phase === 'QUESTION' && step && (
              <QuestionCard
                step={step}
                goalKinds={elicit.goalKinds}
                text={text} onText={setText}
                goalKind={goalKind} onGoalKind={setGoalKind}
                ruledOut={ruledOut} onRuledOut={setRuledOut}
                readingUrl={readingUrl} onReadingUrl={setReadingUrl}
                blockedSend={blockedSend}
                busy={busy}
                onSend={() => void answer()}
                onSkip={() => void answer({ skip: true })}
                attachCount={attached}
                attachOpen={attachOpen}
                // ⚠ THE "+" IS OFFERED ONLY ONCE THERE IS AN IDEA TO ATTACH TO. Before the
                // first answer there is no row (25-I §1: nothing is created by arriving), so
                // a "+" here would have to mint one to accept a file — which is the defect
                // 25-I removed, wearing a paperclip.
                onToggleAttach={ideaId ? () => setAttachOpen((v) => !v) : undefined}
                attachPanel={ideaId && (
                  <YourMaterial
                    ideaId={ideaId}
                    onChanged={() => void refresh()}
                    onCount={setAttached}
                  />
                )}
              />
            )}

            {/* ══ 25-J §2 — MY IDEAS, BENEATH THE FIRST QUESTION ══════════════════
                §2: the first question is "dominant on the page. Not a button that leads to
                a form; the form itself" — with the user's ideas listed beneath it.

                ⚠ ONLY BEFORE AN IDEA EXISTS, which is what makes the transition a
                transition. Once the first answer is given, `ideaId` is set and this list
                gives way to the working view. A hub list that persisted alongside the
                three-column view would be a permanent invitation to abandon what you are
                doing.

                ⚠ AND ONLY ON THE FIRST STEP. A user part-way through the four questions is
                working, not choosing — they arrived here with an idea resumed and their
                own list underneath it would be noise. */}
            {!ideaId && elicit.phase === 'QUESTION' && (
              <MyIdeasList ideas={recent} hiddenEmpty={hiddenEmpty} />
            )}

            {elicit.phase === 'UNDERSTANDING_FAILED' && (
              <UnderstandingFailedCard busy={busy} onRetry={() => void retryUnderstanding()} />
            )}

            {elicit.phase === 'AWAITING_CONFIRMATION' && (
              <ConfirmationCard
                correction={correction}
                onCorrection={setCorrection}
                busy={busy}
                onConfirm={() => void confirm()}
                onCorrect={() => void sendCorrection()}
              />
            )}

            {elicit.phase === 'CONFIRMED' && !latest && (
              <StartBuildCard
                canStart={!!build?.canStart}
                blockedReason={build?.blockedReason ?? null}
                buildStale={buildStale}
                estimateLine={build?.estimate?.line ?? null}
                sampleSize={build?.estimate?.sampleSize ?? 0}
                hasMean={build?.estimate?.meanSeconds != null}
                offerEmail={!!build?.estimate?.offerEmail}
                emailWhenDone={emailWhenDone}
                onEmailWhenDone={setEmailWhenDone}
                busy={busy}
                onStart={() => startBuild('FULL')}
                onRetryState={() => void refresh()}
              />
            )}

            {/* 25-H §4 — "available later". Once the elicitation is done the control stays,
                so a document found halfway through is not a reason to start again. A
                document added here is read on the spot and its findings join the next
                build. */}
            {elicit.phase === 'CONFIRMED' && ideaId && (
              <div className="mb-4 rounded-xl border border-zinc-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                  Add a file or link
                </p>
                <YourMaterial ideaId={ideaId} onChanged={() => void refresh()} onCount={setAttached} />
              </div>
            )}

            {/* ⚠ A1 — THE OFFER, WHERE THE CRITICISM WAS MADE. Transient: it clears on the
                next message either way, and the permanent route is below. */}
            {feedbackOffer && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-amber-900">
                  That didn’t land right — do you want to tell us what I got wrong?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setFeedbackOffer(false); setFeedbackOpen(true) }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-900 text-white hover:opacity-90"
                  >
                    Tell us
                  </button>
                  <button
                    onClick={() => setFeedbackOffer(false)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg text-amber-800 hover:bg-amber-100"
                  >
                    Not now
                  </button>
                </div>
              </div>
            )}

            {/* ⚠ THE DEAD-END BACKSTOP. See `rendersAControl`. A user must never be looking
                at a page with no way forward — that is what "it crashed" looked like. */}
            {!rendersAControl && <NothingToShowCard busy={busy} onReload={() => void refresh()} />}

            {latest && (
              <BuildProgress
                build={latest}
                ceiling={build!.ceiling}
                estimate={build!.estimate}
                onCancel={running ? cancelBuild : undefined}
                busy={busy}
              />
            )}

            {/* ⚠ 25-F §1 — THE FINDINGS, ON THE SCREEN. This is the whole of §1: the build
                produced 70 cited findings on its first real run and rendered none of them,
                so the user judged the product on a progress list and a keyword soup.
                Below the progress panel deliberately — the passes say what happened, this
                says what came of it. */}
            {latest?.highlights && <BuildFindings highlights={latest.highlights} />}

            {/* AMENDMENT_25B §B/§C — say whether they can walk away, because the two
                drivers give opposite answers and the user cannot tell by looking.
                Under the worker this is the whole point of the change; under the
                fallback, leaving would stall the build, and saying nothing would be
                the more expensive silence. */}
            {running && build && (
              <p className="mt-3 text-xs text-zinc-500">
                {latest?.workerLate
                  ? '⚠ Our build server hasn’t picked this up, so it’s running from this page instead — please keep the tab open. It will still finish.'
                  : build.driver === 'worker'
                  ? typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
                    ? 'This runs on our servers — you can close this tab and we’ll notify you when it’s done.'
                    : 'This runs on our servers, so you can close this tab and come back to it. Allow notifications and we’ll tell you when it’s finished.'
                  : '⚠ Keep this tab open — this build is being run from this page, so closing it will stop it between passes.'}
              </p>
            )}

            {(finished || stopped) && ideaId && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {/* ⚠ 25-F §7 — THE BUILD LINKS TO THE IDEA IT MADE, BY NAME.
                    Charlie logged out and could not find the idea his five-minute build had
                    produced. Two things were wrong and both are fixed here: the row was
                    still called "Untitled idea" (see `nameTheIdea` — the title was drafted
                    as a proposal and `Idea.title` is only written on acceptance), and this
                    page offered one unlabelled button to an editing surface. */}
                <a
                  href={`/ideas/create?ideaId=${ideaId}`}
                  className="text-sm font-semibold px-5 py-2.5 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  {finished
                    ? build?.ideaTitle ? `Open “${build.ideaTitle}”` : 'Open the draft'
                    : 'Open what was drafted'}
                </a>
                {finished && (
                  <a
                    href={`/ideas/${ideaId}`}
                    className="text-sm font-medium px-4 py-2.5 rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                  >
                    See it as others would
                  </a>
                )}
              </div>
            )}

            {/* ══ 25-K §2 — THE RE-RUN, PRESENT, NOT CONDITIONAL ════════════════
                ⚠⚠ THIS IS THE ITEM THE BRIEF SAYS MOST NEEDS FIXING, AND THE OLD VERSION WAS
                INVISIBLE FOUR TIMES OVER. It rendered only when `(finished || stopped)` AND
                `build.canStart`, at the very bottom of the page, under the findings — so a
                user with a running build, a user who had scrolled, and a user whose
                `canStart` was false for any reason all saw NOTHING. Charlie asked Lex to
                re-run in conversation and was told *"I can't rerun the whole project from
                here, as the platform manages those stages"*: true, unhelpful, a dead end.

                So the block is now on the page whenever a build exists, in every state,
                and it SAYS which state it is in. A running build shows a disabled control
                with the reason attached (25-E §4b's rule), never an absent one.

                ⚠ AND IT SAYS WHAT IT WILL DO AND WHAT IT COSTS, both prices, with the
                expensive one the one you have to ask for. Two thirds of a build's input
                tokens are the orientation and the research and neither depends on the
                draft — measured at 48% of the input tokens on the two passes reuse skips
                (25-J). A cheap default that quietly reused a stale search would be worse
                than the cost it saves. */}
            {latest && ideaId && (
              <div className="mt-4 rounded-xl border-2 border-zinc-300 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Re-run</p>

                {running ? (
                  <p className="text-sm text-zinc-700 mt-1.5">
                    It is running now — you can re-run it again once this one finishes. Anything you
                    add above will be waiting for it.
                  </p>
                ) : !build?.canStart ? (
                  // ⚠ THE REASON, NOT A MISSING BUTTON. A control that is simply absent
                  // reads as broken; one that says why it does not apply does not.
                  <p className="text-sm text-zinc-700 mt-1.5">
                    {build?.blockedReason ?? 'A re-run is not available on this idea just now.'}
                  </p>
                ) : build.reuse ? (
                  <>
                    <p className="text-sm text-zinc-700 mt-1.5">
                      Re-running from the research already gathered — {build.reuse.findings} finding
                      {build.reuse.findings === 1 ? '' : 's'}, {build.reuse.cited} cited source
                      {build.reuse.cited === 1 ? '' : 's'}. Add new information above if you want me to
                      search again.
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => startBuild('REUSE')}
                        disabled={busy}
                        className="text-sm font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
                      >
                        Redraft from what I found
                      </button>
                      <button
                        onClick={() => startBuild('FULL')}
                        disabled={busy}
                        className="text-sm font-medium px-4 py-2 rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                      >
                        Search again from scratch
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-2">
                      Redrafting skips the two search passes and costs roughly a third of a full build.
                      Searching again reads the corpus from nothing — use it when what you have told me
                      has really changed.
                      {build.estimate?.line ? ` A full run: ${build.estimate.line}` : ''}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-zinc-700 mt-1.5">
                      {build.reuseBlockedReason ?? 'This will search the corpus again from scratch.'}
                    </p>
                    <button
                      onClick={() => startBuild('FULL')}
                      disabled={busy}
                      className="mt-2.5 text-sm font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
                    >
                      Run it again
                    </button>
                    {build.estimate?.line && (
                      <p className="text-[11px] text-zinc-500 mt-2">{build.estimate.line}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* ⚠ A1 — AND A PERMANENT ROUTE, not only the offer.
            The offer fires on a phrase; this is always there. The whole purpose of the
            flip is to find out whether this door works on real users, and a control that
            only appears when we correctly guess they are unhappy is not that. */}
        {ideaId && !booting && (
          <p className="mt-8 text-center text-xs text-zinc-400">
            <button onClick={() => setFeedbackOpen(true)} className="underline hover:text-zinc-700">
              Something wrong with this? Tell us
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

/** A3 — the same three-way split the create page uses, so the two doors greet alike. */
function timeOfDay(): string {
  const h = new Date().getUTCHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 18) return 'afternoon'
  return 'evening'
}
