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
import RecentIdeasPanel, { type RecentIdea } from '@/components/lex/RecentIdeasPanel'
export type { RecentIdea }

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
  { initialIdeaId, resumed = false, recent = [], hiddenEmpty = 0 }: {
    initialIdeaId?: string
    resumed?: boolean
    /** TEMPORARY — the stopgap previous-ideas list. See `RecentIdea`. */
    recent?: RecentIdea[]
    hiddenEmpty?: number
  },
) {
  const [ideaId, setIdeaId] = useState<string | null>(initialIdeaId ?? null)
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
        let id = ideaId
        if (!id) {
          const created = await getJson('/api/ideas', cid, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Untitled idea' }),
          })
          id = created.id as string
          setIdeaId(id)
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
  const post = useCallback(async (path: string, body: unknown): Promise<Record<string, unknown> | null> => {
    if (!ideaId) return null
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}${path}`, {
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
  }, [ideaId])

  const answer = useCallback(async (extra: Record<string, unknown> = {}) => {
    const step = elicit?.currentStep
    if (!step) return
    const data = await post('/elicitation', {
      action: 'answer', step, text, goalKind: goalKind || undefined,
      ruledOut: ruledOut || undefined, readingUrl: readingUrl || undefined, ...extra,
    })
    if (data?.state) {
      applyMutation(data)
      setText(''); setGoalKind(''); setRuledOut(''); setReadingUrl('')
    }
  }, [elicit?.currentStep, post, text, goalKind, ruledOut, readingUrl, applyMutation])

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
  const startBuild = useCallback(() => {
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
      // §C4 — sent only when the offer was actually shown. Posting `false` on a build too
      // short to have offered would silently clear a preference the user set elsewhere.
      body: JSON.stringify(build?.estimate?.offerEmail ? { notifyEmail: emailWhenDone } : {}),
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

      {error && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-4 py-2 text-center">
          {error}
        </div>
      )}

      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-6">
        {/* TEMPORARY (24 Aug 2026) — the stopgap previous-ideas list. Rendered OUTSIDE
            the `booting` branch deliberately: it arrives from the server with the page, so
            it must still be there when the session fails to start — which is exactly the
            state in which you most want a way back to earlier work. */}
        <RecentIdeasPanel recent={recent} hiddenEmpty={hiddenEmpty} />

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

            {/* The step rail — four questions, then a confirmation. Shows how short this is. */}
            <ol className="flex flex-wrap gap-2 mb-6 text-[11px] font-medium">
              {elicit.steps.map((s) => (
                <li
                  key={s.key}
                  className={`px-2.5 py-1 rounded-full border ${
                    s.done
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : s.key === elicit.currentStep
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-zinc-200 text-zinc-400'
                  }`}
                >
                  {s.label}
                </li>
              ))}
            </ol>

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
                sampleSize={build?.estimate?.sampleSize ?? 0}
                hasMean={build?.estimate?.meanSeconds != null}
                offerEmail={!!build?.estimate?.offerEmail}
                emailWhenDone={emailWhenDone}
                onEmailWhenDone={setEmailWhenDone}
                busy={busy}
                onStart={startBuild}
                onRetryState={() => void refresh()}
              />
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
                {/* A re-run is the normal case after a correction, not an error path. */}
                {build?.canStart && (
                  <button
                    onClick={startBuild}
                    disabled={busy}
                    className="text-sm font-medium px-4 py-2.5 rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                  >
                    Run it again
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
