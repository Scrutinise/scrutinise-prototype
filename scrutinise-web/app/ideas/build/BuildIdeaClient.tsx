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

import RerunChecklist from '@/components/lex/RerunChecklist'
import { useCallback, useEffect, useRef, useState } from 'react'
import PublicNav from '@/components/PublicNav'
import BuildProgress from '@/components/lex/BuildProgress'
import BuildFindings from '@/components/lex/BuildFindings'
import type { BuildHighlights } from '@/lib/lex/build-highlights'
import {
  IntakeCard, ReplyCard, UnderstandingFailedCard, ConfirmationCard, StartBuildCard, NothingToShowCard,
  Spinner, type StepView,
} from '@/components/lex/ElicitationCards'
// TEMPORARY (24 Aug 2026) — the stopgap previous-ideas list. Re-exported so `page.tsx`
// keeps importing its prop type from the component it renders.
import MyIdeasList, { type MyIdea, hasRealTitle } from '@/components/lex/MyIdeasList'
import RerunDialogue from '@/components/lex/RerunDialogue'
import RerunBanner from '@/components/lex/RerunBanner'
import YourMaterial from '@/components/lex/YourMaterial'
import HowItWorksModal from '@/components/lex/HowItWorksModal'
import FeedbackDialog from '@/components/lex/FeedbackDialog'
import type { StageContext } from '@/lib/lex/stage-context'
import { WAIT_MESSAGE } from '@/lib/lex/search-wait'
import AskLexPanel from '@/components/lex/AskLexPanel'

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
  /** 25-L §1 — what the user said was wrong with the run before this one. */
  userCritique: string | null
  uncertainties: Array<{ fieldKey: string; sentence: string }>
  queryUsed: string | null
  spend: { tokensIn: number; tokensOut: number; pence: number | null; line: string }
  /** 25-B §8 — the same spend, broken down by pass. */
  spendByPass: Array<{ key: string; label: string; tokensIn: number; tokensOut: number; pence: number | null }>
  /** 25-B §1 — the pass the SERVER wants run next, or null when there is none. */
  nextPass: string | null
  resumable: boolean
  /** 25-O §1b — thirds the stopped build gave back. Null while running, and on a DONE build. */
  releasedThirds: number | null
  /** 25-N §1a — present only on a terminal build that did not run every pass. */
  incomplete: {
    ranPasses: number
    totalPasses: number
    unrun: string[]
    resumeFrom: string | null
    noSummary: boolean
    resumeCount: number
    previousStopReason: string | null
    autoResumeCount: number
    autoResumeLimit: number
    /** 25-P §5 — passes added after this build ran; run free on resume, and said so. */
    passesAddedSince: string[]
  } | null
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
  /** 25-M §4 — the pilot allowance, shown BEFORE a build starts. */
  allowance: {
    remainingThirds: number
    remainingBuilds: number
    canStartFull: boolean
    canStartReuse: boolean
    line: string
  }
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
  { initialIdeaId, openedIdea = null, recent = [], deleted = [], hiddenEmpty = 0, stageCtx = null,
    isFirstIdea = false, displayName = null, blankState = null, materialCount = 0 }: {
    initialIdeaId?: string
    /** 26-C addendum §21 — which idea this is, when one was opened explicitly (from the
     *  library) rather than started fresh. Replaces 25-E's "resumed" banner (retired by
     *  §11's auto-resume removal) with an identity confirmation instead of a status note. */
    openedIdea?: { title: string; excerpt: string } | null
    /** 25-J §2 — the user's own ideas, listed on the hub. See `MyIdea`. */
    recent?: MyIdea[]
    /** 26-C addendum §20 — soft-deleted ideas, reachable and restorable. */
    deleted?: MyIdea[]
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
  /** 25-N §1a — why the last "carry on from where it stopped" was refused. Beside the
   *  build it is about, never in the page banner. */
  const [resumeError, setResumeError] = useState<string | null>(null)
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
  const [correction, setCorrection] = useState('')
  /** 26-C §6a — the front screen's own layout: 3/4 create, 1/4 library, draggable. */
  const [leftPct, setLeftPct] = useState(75)
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
  // ⚠ 25-H §3's `editingStep` (which pill is open) stood here and is retired with the
  // rail itself — see the note beside `confirm` below.

  /**
   * ⚠⚠ 25-K §2 — THE COMPOSER'S "+", AND ITS COUNT.
   *
   * The upload existed and was unfindable: a panel that appeared on ONE of the four
   * questions, plus a bare file input further down the page. Charlie looked for it in the
   * obvious place — beside the box he was typing in — and concluded it was not built.
   * It now opens from the composer, on every question, and stays available after the
   * elicitation is confirmed.
   */
  /**
   * 25-L §1 — the re-run dialogue is open.
   *
   * ⚠ THE BUTTON NO LONGER FIRES A BUILD. Pressing it opens the question; the build starts
   * from inside the dialogue, with whatever the user wrote attached. A re-run that starts on
   * the click spends four minutes reproducing the draft they were unhappy with, because
   * nothing has changed between the two runs.
   */
  const [rerunOpen, setRerunOpen] = useState(false)
  /**
   * ⚠ 25-Q §3c — SOMETHING TO ADD, THAT IS NOT AN EDIT TO AN ANSWER.
   *
   * §3c: *"There is nowhere to add further text before re-running — only the existing answers
   * can be edited."* Those are different acts: editing question 2 rewrites the record of what
   * the user told me AND (by 25-G's reuse rule) costs a full search; adding a note leaves the
   * record intact and rides along with the next run.
   *
   * ⚠ IT IS THE `userCritique` FIELD THE RE-RUN DIALOGUE ALREADY WRITES — one store, two doors.
   * A second column for "further information" would be a second thing every reader downstream
   * had to learn about, and the one that got read would be whichever the author remembered.
   */
  const [furtherInfo, setFurtherInfo] = useState('')
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
    // 26-C addendum §14a — the second box is gone; everything goes in `text` and Lex sorts
    // it. `AnswerInput.background` still exists server-side (harmless, unsent from here).
    const data = await post('/elicitation', {
      action: 'answer', step, text, ...extra,
    })
    if (data?.state) {
      applyMutation(data)
      setText('')
    }
  }, [elicit?.currentStep, post, text, applyMutation])

  // ⚠⚠ 25-H §3's `saveEdit`/`openStep`/the pill rail stood here and are RETIRED by
  // 26-C §2a. There is no longer a discrete "goal" or "profile" answer to reopen and no
  // rail to click between — one intake, then at most two replies. `editing: true` on
  // `/elicitation`'s `answer` action still works server-side (elicitation.ts keeps the
  // guard), so a future editing surface can still use it; this screen just does not offer
  // one yet. See the note at the top of the phase-switch block and `check-lex-25h.ts`'s
  // §3 assertion, updated rather than left red.

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
  // ⚠ 25-Q §3c — `critique` here already carries the top-of-page note (see `onGo`), so this
  // clears the box: a note that stayed in the field after being sent would be sent twice.
  const startBuild = useCallback((mode: 'FULL' | 'REUSE' = 'FULL', critique = '') => {
    setFurtherInfo('')
    if (!ideaId) return
    setError(null)
    setRerunOpen(false)

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
        // ⚠ 25-L §1 — SENT ONLY WHEN THERE IS SOMETHING TO SEND. An empty string would
        // write a critique row saying nothing, and every later reader would have to
        // distinguish "they wrote nothing" from "they were never asked".
        ...(critique.trim() ? { critique: critique.trim() } : {}),
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

  /**
   * ══ 25-N §1a — PICK A STOPPED BUILD UP FROM ITS LAST COMPLETED PASS ═════════════
   *
   * ⚠ ITS OWN ERROR STATE, NOT THE PAGE'S. A refusal here is about ONE build and belongs
   * beside it — the page banner is for things that stopped the user getting anywhere, and
   * putting "that build ran every pass" up there would read as the page being broken.
   */
  const resumeBuildNow = useCallback(async () => {
    const latestId = build?.latest?.id
    if (!ideaId || !latestId) return
    setBusy(true); setResumeError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume', buildId: latestId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setResumeError(typeof data?.error === 'string' ? data.error
          : 'That build could not be picked up again.')
      }
    } catch {
      setResumeError('That build could not be picked up again.')
    } finally {
      setBusy(false)
      void refresh()
    }
  }, [ideaId, build?.latest?.id, refresh])

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
      // 26-B §2 — the goal step is optional free text; nothing blocks it.
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

      {/*
        ══ 26-C ADDENDUM §15a — "HOW THIS WORKS" RETURNS TO THE BLUE PILL, TOP RIGHT,
        BESIDE EXIT. Supersedes §6d's placement (Exit in the library column, "How this
        works" under the left heading) — Charlie's walkthrough asked for both back on
        one line at the top, on every screen this component renders, not only once a
        build exists. §15b's headings (below) are what now sits under the left column's
        own heading line, not this control.
      */}
      <div className="border-b border-zinc-100 px-4 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-end gap-3">
          <button
            onClick={() => {
              if (text.trim() || correction.trim()) setExitPrompt(true)
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

      {/* ══ 25-L §1 — THE RE-RUN DIALOGUE ════════════════════════════
          ⚠ ONLY ONCE A BUILD EXISTS. §1: "once an idea has been built at least once". There
          is nothing to criticise about a run that has not happened, and asking would be a
          form standing between the user and their first build. */}
      {rerunOpen && ideaId && latest && (
        <RerunDialogue
          ideaId={ideaId}
          reuse={build?.reuse ?? null}
          reuseBlockedReason={build?.reuseBlockedReason ?? null}
          estimateLine={build?.estimate?.line ?? null}
          allowanceLine={build?.allowance?.line ?? null}
          canStartFull={build?.allowance?.canStartFull ?? true}
          busy={busy}
          onCancel={() => setRerunOpen(false)}
          // ⚠ 25-Q §3c — WHAT THEY TYPED AT THE TOP TRAVELS WITH THE RUN, whether they came
          // through this dialogue or pressed the plain button. Typing a note and then losing it
          // by taking the other route is the shape of bug a user reads as "it ignored me".
          onGo={(mode, critique) => startBuild(mode, [furtherInfo.trim(), critique.trim()].filter(Boolean).join('\n\n'))}
          // Adding a document can change whether the research may be reused, so the panel
          // re-reads rather than printing an answer chosen when it opened.
          onMaterialChanged={() => void refresh()}
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

      {/* ══ 25-N §1e — THE RUN'S STATE, ACROSS THE TOP ═══════════════════════════
          ⚠ IT IS NOT A SECOND PROGRESS PANEL. `BuildProgress` below is the detail — which
          pass, what it cost, what each produced — and it is a long way down a long page. This
          is the one line you get without scrolling, and it is the only thing that announces
          the FINISH: the panel changes a badge, which nobody sees unless they are watching. */}
      {ideaId && <RerunBanner ideaId={ideaId} surface="build" />}

      {/* ⚠⚠ 26-C §2g — THE STAGE 1-2-3 HEADER IS REMOVED FROM THIS SCREEN.
          §2g: "it belongs on the next page." `StageBar`/`stageCtx` stayed threaded through
          as props (harmless, unused here) rather than ripped out of `page.tsx` — CLAUDE.md
          §11 asks for Charlie's explicit word before a prop that feeds another surface is
          deleted outright, and this screen simply stops rendering it. */}
      <div className={`flex-1 w-full mx-auto px-4 py-6 ${elicit?.hasBuild ? 'max-w-3xl' : 'max-w-6xl'}`}>
        {/*
          ══ 26-C §6a/§6d — THE FRONT SCREEN: THREE-QUARTERS CREATE, ONE-QUARTER LIBRARY ══
          Only while there is no build yet — once one exists this reverts to the single,
          narrower column the build/progress/findings UI already used (§6 is scoped to
          "the front screen", and a running or finished build is a different screen).
        */}
        <div className={elicit?.hasBuild ? '' : 'lg:flex lg:items-start'}>
          <div
            className={elicit?.hasBuild ? 'w-full' : 'min-w-0 lg:pr-6'}
            style={!elicit?.hasBuild ? { flexBasis: `${leftPct}%` } : undefined}
          >
            {/* §6c/addendum §15b — "Create a new idea", the same heading level, size and
                weight "My ideas" (MyIdeasList's own `<h2>`) is styled to match. "How this
                works" no longer lives here — addendum §15a puts it back beside Exit, top
                right, on every screen. */}
            {!elicit?.hasBuild && (
              <div className="mb-5">
                <h1 className="text-lg font-semibold text-zinc-900">Create a new idea</h1>
                {displayName && (
                  <p className="text-sm text-zinc-600 mt-1">Good {timeOfDay()} {displayName}.</p>
                )}
              </div>
            )}

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
            {/* ⚠⚠ 26-C ADDENDUM §11/§21 — REPLACES 25-E §2's "PICKING UP WHERE YOU LEFT
                OFF" BANNER, WHICH HAD NOTHING TO DO ONCE AUTO-RESUME WAS RETIRED (§11):
                every idea shown here now got here by an EXPLICIT click, so "picking up"
                is simply what opening an idea means and does not need announcing.
                What still needs saying is WHICH idea this is (§21) — a click that lands
                you on an idea with no title and no visible text yet is a click that looks
                like it failed, which is the library's whole "cannot be identified, cannot
                be opened" complaint. */}
            {openedIdea && (
              <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                <p className="text-sm text-zinc-700">
                  <span className="font-semibold text-zinc-900">Continuing: </span>
                  {hasRealTitle(openedIdea.title)
                    ? openedIdea.title
                    : openedIdea.excerpt
                      ? <>In your words: {openedIdea.excerpt}</>
                      : 'a new, empty idea — nothing written yet.'}
                </p>
                <a href="/ideas/build" className="text-xs text-zinc-500 underline">
                  Start a new idea instead
                </a>
              </div>
            )}

            {/* ⚠⚠ 26-C §2g — NO GREETING BUBBLE, NO STAGE HEADER, NO STEP RAIL HERE.
                The three belonged to a screen with a chat opener and four sequential
                steps to navigate between. §2 replaces both with one screen: the heading
                and "How this works" now live in the two-column header below, `StageBar`
                is removed from this page entirely ("it belongs on the next page"), and
                there is no rail because there is nothing sequential left to click between
                — one intake, then at most two replies (§3a), then the confirmation.
                ⚠ WHAT THIS LOSES, reported per §2f: the per-answer pill (25-H §3) that
                let a user reopen and edit any earlier answer directly no longer has a
                control here — there is no longer a discrete "goal" or "profile" answer to
                reopen, and the problem/background boxes are not yet re-editable once sent.
                Flagged for Charlie rather than silently dropped. */}
            {/* ══════════ 25-Q §3b/§3c — CHANGE SOMETHING AND RUN IT AGAIN, AT THE TOP ══════════
                §3b: *"The re-run block sits at the foot of a long page. Move re-run, add-a-file and
                add-further-information to the top, where a user arriving to change something will
                look."*

                ⚠⚠ THIS IS A MOVE, NOT A COPY. The same three controls, once, higher up — two of
                them rendered in two places would be two places to press and one of them would
                eventually stop working. Everything below this point is the RESULT of the last run;
                everything in here is an input to the next one, which is the division a returning
                user is actually making.

                ⚠ AND IT IS THE WHOLE REASON A RETURNING USER OPENS THIS PAGE. A first-time user
                reads down; somebody coming back has already read it and wants to change something.
                The page was built for the first of those two and, after the first build, every
                visit is the second. */}
            {ideaId && elicit.phase === 'CONFIRMED' && (
              <div className="mb-5 space-y-3">
                {/* ══ 25-Q §3c — SOMEWHERE TO ADD SOMETHING NEW ═══════════════════════════
                    §3c: *"There is nowhere to add further text before re-running — only the
                    existing answers can be edited."*

                    ⚠⚠ AND EDITING AN ANSWER IS NOT THE SAME ACT. Changing what you said in
                    question 2 rewrites the record of what you told me; adding a note for the next
                    run leaves that record intact and says something further. The first also costs
                    a full search (25-G's reuse rule refuses to reuse research the elicitation has
                    moved past), so a user with an afterthought was being charged for a rewrite of
                    history they did not want.

                    ⚠ IT IS THE SAME FIELD THE RE-RUN DIALOGUE ALREADY CARRIES, so what is typed
                    here arrives as `userCritique` on the next run and is printed back above the
                    findings as "What you asked this run to fix". One store, two doors. */}
                <div className="rounded-xl border border-zinc-200 p-3">
                  <label htmlFor="q-further" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Anything else you want me to take into account this time?
                  </label>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    This is added to the next run. It does not change the answers you have already
                    given — edit those with the buttons above if that is what you meant.
                  </p>
                  <textarea
                    id="q-further"
                    value={furtherInfo}
                    onChange={(e) => setFurtherInfo(e.target.value)}
                    rows={3}
                    placeholder="Something you have thought of since, a document you have read, a line of argument you want tested…"
                    className="mt-1.5 w-full text-sm p-2 rounded-lg border border-zinc-200 resize-y focus:outline-none focus:border-blue-400"
                  />
                  {furtherInfo.trim() && (
                    <p className="mt-1 text-[11px] text-emerald-700">
                      {/* ⚠ A CHARACTER AND A WORD, never colour alone. */}
                      ✓ Saved for the next run — it will be shown back to you beside the findings.
                    </p>
                  )}
                </div>
              {elicit.phase === 'CONFIRMED' && ideaId && (
                <div className="mb-4 rounded-xl border border-zinc-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                    Add a file or link
                  </p>
                  <YourMaterial ideaId={ideaId} onChanged={() => void refresh()} onCount={setAttached} />
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
                  {/* 26-B §5b/§6 — what to do next, then the checklist drawn from the idea's own
                      state, THEN the control. Informs, never blocks (§6b). */}
                  {!running && <RerunChecklist ideaId={ideaId} refreshKey={latest?.id ?? null} />}

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
                      {/* ⚠⚠ 25-L §1 — ONE BUTTON, AND IT OPENS THE QUESTION. Two buttons here
                          made the user choose a PRICE before they had been asked the only
                          question that changes the result. The choice of mode has not gone
                          away; it has moved inside the dialogue, where it sits beside what
                          each one will do and after they have said what was wrong. */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setRerunOpen(true)}
                          disabled={busy}
                          className="text-sm font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
                        >
                          Re-run this idea…
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-2">
                        Redrafting skips the two search passes and costs roughly a third of a full build.
                        Searching again reads the corpus from nothing — use it when what you have told me
                        has really changed.
                        {build.estimate?.line ? ` A full run: ${build.estimate.line}` : ''}
                      </p>
                      {/* 25-N §1d — the balance is on the PAGE, not only inside the dialogue.
                          Deciding whether to open the re-run is already a decision about
                          spending one, and the answer was a click away. */}
                      {build.allowance?.line && (
                        <p className="text-[11px] font-medium text-zinc-700 mt-1">{build.allowance.line}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-zinc-700 mt-1.5">
                        {build.reuseBlockedReason ?? 'This will search the corpus again from scratch.'}
                      </p>
                      <button
                        onClick={() => setRerunOpen(true)}
                        disabled={busy}
                        className="mt-2.5 text-sm font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
                      >
                        Re-run this idea…
                      </button>
                      {build.estimate?.line && (
                        <p className="text-[11px] text-zinc-500 mt-2">{build.estimate.line}</p>
                      )}
                      {build.allowance?.line && (
                        <p className="text-[11px] font-medium text-zinc-700 mt-1">{build.allowance.line}</p>
                      )}
                    </>
                  )}
                </div>
              )}
              </div>
            )}

            {/* ══ 25-Q §3a — SOMEWHERE TO ASK, ON THE STAGE THAT HAD NOWHERE ═══════════
                §3a: *"There is no Lex chat box on Stage 1 · The Idea. Charlie could not ask Lex
                to re-run because there was nothing to ask."*

                ⚠ BELOW THE CONTROLS IT IS ABOUT. The questions a user asks here — how do I
                re-run, how do I change an answer — are answered by controls a few centimetres
                above, so the chat sits under them rather than over them: somebody who finds the
                control does not need the chat, and somebody who does not will scroll one line.

                ⚠ IT ANSWERS AND CHANGES NOTHING. See `AskLexPanel` — the elicitation owns this
                page's state machine and two conductors would disagree about which question is
                live.

                ⚠⚠ 26-C §2h — SUPPRESSED UNTIL THE FIRST BUILD HAS RUN. "Ask Lex" answering
                questions about a re-run that cannot exist yet is a control with nothing to
                do; it appears from the first build onward, alongside the re-run block above
                that it was written to sit under. */}
            {ideaId && elicit.hasBuild && <div className="mb-5"><AskLexPanel ideaId={ideaId} /></div>}

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
            {/* ══ 26-C §2 — THE INTAKE, ONCE, THEN AT MOST TWO REPLIES (§3a) ══════════
                `step.answer` (the 'problem' field, per `answerOf`) tells the two apart:
                empty means nothing has been sent yet — the two-box intake; set means the
                user is answering one of Lex's own follow-up questions — a single reply
                box, with the question itself already the last bubble in the transcript
                above. */}
            {elicit.phase === 'QUESTION' && step && !step.answer && (
              <IntakeCard
                problem={text} onProblem={setText}
                busy={busy}
                onSend={() => void answer()}
                attachCount={attached}
                attachOpen={attachOpen}
                // ⚠⚠ 26-C ADDENDUM §14g — THE "+" IS ON THIS SCREEN NOW, BEFORE THE FIRST
                // SEND. 25-I §1 refused to mint an idea just from ARRIVING at the page; a
                // deliberate click on "+" is the same kind of act as pressing Send, not the
                // silent auto-creation 25-I removed — so it may create the row too.
                onToggleAttach={() => {
                  void (async () => {
                    if (!attachOpen && !ideaIdRef.current) {
                      const id = await ensureIdea()
                      if (!id) return
                    }
                    setAttachOpen((v) => !v)
                  })()
                }}
                attachPanel={ideaId && (
                  <YourMaterial
                    ideaId={ideaId}
                    onChanged={() => void refresh()}
                    onCount={setAttached}
                  />
                )}
              />
            )}

            {elicit.phase === 'QUESTION' && step && !!step.answer && (
              <ReplyCard
                question={
                  [...elicit.messages].reverse().find((m) => m.role === 'lex' && m.field === 'elicitation:problem')
                    ?.content ?? step.question
                }
                text={text} onText={setText}
                busy={busy}
                onSend={() => void answer()}
                onSkip={() => void answer({ skip: true })}
                attachCount={attached}
                attachOpen={attachOpen}
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
                // 25-N §1d — the same sentence the re-run dialogue shows, from the same read.
                allowanceLine={build?.allowance?.line ?? null}
                sampleSize={build?.estimate?.sampleSize ?? 0}
                hasMean={build?.estimate?.meanSeconds != null}
                offerEmail={!!build?.estimate?.offerEmail}
                // ⚠ 25-T §1h — the checkbox is only offered where the promise is true.
                driver={build?.driver}
                emailWhenDone={emailWhenDone}
                onEmailWhenDone={setEmailWhenDone}
                busy={busy}
                // ⚠ 25-Q §3c — THE FIRST-BUILD PATH CARRIES THE NOTE TOO. Two ways to start a
                // run and only one of them reading the box is exactly how a user concludes it was
                // ignored — and they would be right.
                onStart={() => startBuild('FULL', furtherInfo.trim())}
                onRetryState={() => void refresh()}
              />
            )}

            {/* 25-H §4 — "available later". Once the elicitation is done the control stays,
                so a document found halfway through is not a reason to start again. A
                document added here is read on the spot and its findings join the next
                build. */}

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
                // 25-N §1a — only on a build that has stopped. A running build is waited
                // for, not resumed, and offering both would be two controls for one state.
                onResume={!running ? resumeBuildNow : undefined}
                resumeError={resumeError}
                busy={busy}
              />
            )}

            {/* ⚠ 25-F §1 — THE FINDINGS, ON THE SCREEN. This is the whole of §1: the build
                produced 70 cited findings on its first real run and rendered none of them,
                so the user judged the product on a progress list and a keyword soup.
                Below the progress panel deliberately — the passes say what happened, this
                says what came of it. */}
            {/* ⚠ 25-L §1 — WHAT THIS RUN WAS ASKED TO FIX, SHOWN BACK.
                A user who wrote three paragraphs of criticism and then watched a progress
                bar has no way to tell whether any of it was carried. Printing it beside the
                run that received it is the only evidence they get, and it costs nothing.
                Above the findings deliberately: it is the frame for reading them. */}
            {latest?.userCritique && (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  What you asked this run to fix
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                  {latest.userCritique}
                </p>
              </div>
            )}

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
                  // ⚠⚠ 25-O §2 — IT POINTED AT `/ideas/[id]`, WHICH IS THE TEAM VIEW. A button
                  // labelled "as others would" that shows what your own collaborators see is a
                  // dead end in the middle of the core flow, and a pilot tester will find it.
                  // It now reaches a holding page that says honestly what it is. §2: hold, do
                  // not build — 25-N §6's design stands and lands in a later sprint.
                  <a
                    href={`/ideas/${ideaId}/public`}
                    className="text-sm font-medium px-4 py-2.5 rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                  >
                    See it as others would
                  </a>
                )}
              </div>
            )}

          </>
        )}
          </div>

          {/* ══ 26-C §6b — THE DIVIDER IS DRAGGABLE, like the ones in the workspace ══
              A small local drag handle rather than `PanelDivider` — that component is
              typed to the 3-panel workspace's own `PanelKey` set (`lib/lex/panel-layout`),
              and widening it to cover this screen's two columns would mix an unrelated
              layout's keys into it for one caller. Same mechanism (pointer capture,
              keyboard steps, a visible grip), copied rather than shared for that reason. */}
          {!elicit?.hasBuild && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize the new-idea column and the library column"
              tabIndex={0}
              onPointerDown={(e) => {
                const startX = e.clientX
                const row = e.currentTarget.parentElement?.getBoundingClientRect().width || 1
                const onMove = (ev: PointerEvent) => {
                  const pct = ((ev.clientX - startX) / row) * 100
                  setLeftPct((p) => Math.min(85, Math.max(50, p + pct)))
                }
                const onUp = () => {
                  window.removeEventListener('pointermove', onMove)
                  window.removeEventListener('pointerup', onUp)
                }
                window.addEventListener('pointermove', onMove)
                window.addEventListener('pointerup', onUp)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') { e.preventDefault(); setLeftPct((p) => Math.max(50, p - 2)) }
                if (e.key === 'ArrowRight') { e.preventDefault(); setLeftPct((p) => Math.min(85, p + 2)) }
              }}
              title="Drag to resize — or use the arrow keys"
              className="group hidden lg:flex w-2 shrink-0 cursor-col-resize items-center justify-center bg-zinc-100 hover:bg-blue-100 focus:bg-blue-200 focus:outline-none touch-none rounded-full"
            >
              <span aria-hidden className="flex flex-col gap-[3px] rounded-full bg-zinc-300 px-[1px] py-1.5 group-hover:bg-blue-500 group-focus:bg-blue-600">
                <span className="block w-[3px] h-[3px] rounded-full bg-white" />
                <span className="block w-[3px] h-[3px] rounded-full bg-white" />
                <span className="block w-[3px] h-[3px] rounded-full bg-white" />
              </span>
            </div>
          )}

          {/* §6c — the library. Charlie offered "My Previous Ideas" and "Idea History"
              and invited better; kept as "My ideas" for now, matching the heading the
              rest of the product already uses, pending his choice. Addendum §15a moved
              Exit back to the top-right bar beside "How this works" — it no longer has
              its own row here. */}
          {!elicit?.hasBuild && (
            <div className="min-w-0 lg:pl-6" style={{ flexBasis: `${100 - leftPct}%` }}>
              <MyIdeasList ideas={recent} deletedIdeas={deleted} hiddenEmpty={hiddenEmpty} />
            </div>
          )}
        </div>

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
