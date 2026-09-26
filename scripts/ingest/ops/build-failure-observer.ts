// ─────────────────────────────────────────────────────────────────────────────
// build-failure-observer.ts — S25 Phase 3's fourth immediate-email rule: build failure.
//
// Polls `build-worker`'s latest deployment status via Railway's GraphQL API (`rail()`,
// `ops/audit-sleep.ts` — Project-Access-Token, per root CLAUDE.md's Railway Operations
// section). Same shape as `serve-observer.ts`: a pure `evaluateBuildFailure()` (constructed
// inputs, testable without a real broken build) plus a thin I/O `checkBuildFailure()` that
// `ops.ts` calls on the 15-min tick.
//
// One email per incident, one when resolved, a reminder after REALERT_HOURS if still open —
// same cadence rule as serve-observer.ts's down/crash-loop, deliberately not reinvented here.
//
//   tsx scripts/ingest/ops/build-failure-observer.ts --dry
// ─────────────────────────────────────────────────────────────────────────────
import { rail } from './audit-sleep'
import { r2Get, r2Put } from '../shared/r2-client'
import { SERVICES } from './sleep-state'

const RESEND_API = 'https://api.resend.com/emails'
const EMAIL_TO = process.env.SERVE_OBSERVER_TO ?? 'cl@scrutinise.org'
const EMAIL_FROM = 'Scrutinise Ops <ingest@messages.scrutinise.org>'
const STATE_KEY = '_search/build-failure-observer-state.json'
const BUILD_SERVICE_ID = process.env.RAILWAY_BUILD_WORKER_SERVICE_ID ?? SERVICES['build-worker']
const REALERT_HOURS = parseInt(process.env.BUILD_FAILURE_REALERT_HOURS ?? '6', 10)

const FAILED_STATUSES = new Set(['FAILED', 'CRASHED'])

export interface DeploymentObservation { ok: boolean; error?: string; deploymentId?: string; status?: string; commitHash?: string | null }
export interface BuildFailureState { openDeploymentId: string | null; lastAlertAt: string | null }
export interface BuildFailureEvent { subject: string; body: string }

const FRESH_STATE: BuildFailureState = { openDeploymentId: null, lastAlertAt: null }

/** PURE. Same event shape/cadence as serve-observer.ts's `raise()`/`shouldAlert()`. */
export function evaluateBuildFailure(
  obs: DeploymentObservation, state: BuildFailureState, nowMs: number,
): { events: BuildFailureEvent[]; nextState: BuildFailureState } {
  const next: BuildFailureState = { ...state }
  const events: BuildFailureEvent[] = []

  if (!obs.ok) {
    // The QUERY failed, not the build. Never alert on this — same "unknown, not crash"
    // discipline as serve-observer.ts's classifyRestart.
    return { events, nextState: next }
  }

  const isFailed = obs.status ? FAILED_STATUSES.has(obs.status) : false

  if (isFailed) {
    const isSameOpenIncident = next.openDeploymentId === obs.deploymentId
    const shouldAlert = !isSameOpenIncident ||
      !next.lastAlertAt || nowMs - Date.parse(next.lastAlertAt) >= REALERT_HOURS * 3600_000
    if (shouldAlert) {
      next.openDeploymentId = obs.deploymentId ?? null
      next.lastAlertAt = new Date(nowMs).toISOString()
      events.push({
        subject: `🔴 build-worker deploy ${obs.status} (${(obs.commitHash ?? '?').slice(0, 12)})`,
        body: `build-worker's latest deployment (${obs.deploymentId}, commit ${obs.commitHash ?? '?'}) is ${obs.status}.\n\n` +
          `${isSameOpenIncident ? `Still open ${REALERT_HOURS}+ hours after the first email — this is the reminder, not a new incident.\n\n` : ''}` +
          `Per docs/CLAUDE.md §20, a build failure means production is serving whatever the LAST successful build was — ` +
          `check Railway's build logs for this deployment before assuming the running site has today's changes.`,
      })
    }
  } else if (next.openDeploymentId) {
    // Was open, now the latest deployment is not FAILED/CRASHED — resolved.
    next.openDeploymentId = null
    next.lastAlertAt = null
    events.push({
      subject: `✅ build-worker deploy recovered`,
      body: `build-worker's latest deployment (${obs.deploymentId}, commit ${obs.commitHash ?? '?'}) is ${obs.status ?? 'no longer failed'}. The prior build failure is resolved.`,
    })
  }

  return { events, nextState: next }
}

// ── I/O ──────────────────────────────────────────────────────────────────────

async function fetchLatestDeployment(): Promise<DeploymentObservation> {
  try {
    const r = await rail<{ service: { deployments: { edges: Array<{ node: { id: string; status: string; meta: { commitHash?: string } | null } }> } } }>(`
      query D($serviceId: String!) {
        service(id: $serviceId) { deployments(first: 1) { edges { node { id status meta } } } }
      }
    `, { serviceId: BUILD_SERVICE_ID })
    const node = r.service.deployments.edges[0]?.node
    if (!node) return { ok: false, error: 'no deployments found' }
    return { ok: true, deploymentId: node.id, status: node.status, commitHash: (node.meta as { commitHash?: string } | null)?.commitHash ?? null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

async function sendEmail(subject: string, body: string): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) { console.warn(`[build-failure-observer] RESEND_API_KEY unset — would have sent: ${subject}`); return }
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to: [EMAIL_TO], subject, text: body }),
  })
  if (!res.ok) console.error(`[build-failure-observer] Resend failed: ${res.status} ${await res.text()}`)
  else console.log(`[build-failure-observer] emailed ${EMAIL_TO}: ${subject}`)
}

async function loadState(): Promise<BuildFailureState> {
  try {
    const raw = await r2Get(STATE_KEY)
    if (!raw) return { ...FRESH_STATE }
    return { ...FRESH_STATE, ...JSON.parse(raw) }
  } catch { return { ...FRESH_STATE } }
}

/** The entry point ops.ts calls on the 15-min tick, alongside checkServeHealth. */
export async function checkBuildFailure(opts: { dry?: boolean } = {}): Promise<BuildFailureEvent[]> {
  const [obs, state] = await Promise.all([fetchLatestDeployment(), loadState()])
  const { events, nextState } = evaluateBuildFailure(obs, state, Date.now())
  for (const ev of events) {
    if (opts.dry) console.log(`[build-failure-observer] (dry) ${ev.subject}\n${ev.body}\n`)
    else await sendEmail(ev.subject, ev.body)
  }
  if (!opts.dry) await r2Put(STATE_KEY, JSON.stringify(nextState, null, 1), 'application/json')
  return events
}

if (require.main === module) {
  const dry = process.argv.includes('--dry')
  checkBuildFailure({ dry }).then((events) => {
    console.log(`[build-failure-observer] ${events.length} event(s)`)
  }).catch((e) => { console.error('[build-failure-observer] FATAL', e); process.exit(1) })
}
