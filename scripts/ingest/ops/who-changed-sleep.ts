// ─────────────────────────────────────────────────────────────────────────────
// who-changed-sleep.ts — S25 Phase 1: when was Serverless (sleeping) toggled on
// fts-serve/vector-serve, and does the sleep/wake cadence line up with the 15-minute
// observer tick (ops.ts's runQuarterHour, :00:30/:15:30/:30:30/:45:30)?
//
// `auditLogs` needs a `workspaceId` a Project-Access-Token cannot obtain (same class of
// gap as `me`/team being Not Authorized — CLAUDE.md's "project token is scoped to its
// project"). `environmentHistory(environmentId)` IS reachable with this token and carries
// `slept`/`resumed`/`deployed` events per Deployment plus `EnvironmentPatch` entries for
// settings changes — this is the one that answers the brief's question.
//
// ⚠ `EnvironmentPatch.payload`/`activityPayload` are empty objects through this API — no
// field-level diff ("sleepApplication: true → false") is exposed. What IS exposed: the
// patch's timestamp, that its `surface` is `"dashboard"` (a human, not an API/CLI actor),
// and that its `changes` name exactly the two services this brief is about. That is
// circumstantial, stated as such — not a full audit trail.
//
// ⚠ The `actor.principal` is a Railway-internal UUID, not a name or email. This project's
// token cannot resolve it further (same "Not Authorized" class as `me`/team reads).
//
//   tsx scripts/ingest/ops/who-changed-sleep.ts
// ─────────────────────────────────────────────────────────────────────────────

import { rail } from './audit-sleep'
import { ENV_ID, SERVICES } from './sleep-state'

interface HistoryNode {
  id: string; createdAt: string; action: string; object: string
  outcome: string; severity: string
  actor: { onBehalfOf: string | null; principal: string | null; surface: string | null } | null
  changes: unknown; serviceIds: string[]
}

async function fetchHistory(first = 100): Promise<HistoryNode[]> {
  const r = await rail<{ environmentHistory: { edges: Array<{ node: HistoryNode }> } }>(`
    query H($environmentId: String!, $first: Int!) {
      environmentHistory(environmentId: $environmentId, first: $first) {
        edges { node {
          id createdAt action object outcome severity
          actor { onBehalfOf principal surface }
          changes serviceIds
        } }
      }
    }
  `, { environmentId: ENV_ID, first })
  return r.environmentHistory.edges.map((e) => e.node)
}

async function main() {
  const targetIds = new Set<string>([SERVICES['fts-serve'], SERVICES['vector-serve']])
  const idToName = new Map<string, string>(Object.entries(SERVICES).map(([k, v]) => [v, k]))
  const all = await fetchHistory(100)

  console.log(`environmentHistory: ${all.length} entries fetched (most recent first)\n`)

  // ── 1. The settings change ──
  const patches = all.filter((n) => n.object === 'EnvironmentPatch' &&
    (n.serviceIds ?? []).some((id) => targetIds.has(id)))
  console.log(`── EnvironmentPatch entries touching fts-serve/vector-serve: ${patches.length} ──`)
  for (const p of patches) {
    console.log(`  ${p.createdAt}  surface=${p.actor?.surface ?? '?'}  principal=${p.actor?.principal ?? '?'}`)
    console.log(`    services: ${(p.serviceIds ?? []).map((id) => idToName.get(id) ?? id).join(', ')}`)
  }
  if (!patches.length) console.log('  (none in the last 100 entries — widen `first` or the window has aged out)')

  // ── 2. Current state ──
  console.log('\n── current sleepApplication ──')
  for (const name of ['fts-serve', 'vector-serve'] as const) {
    const d = await rail<{ serviceInstance: { sleepApplication: boolean | null } }>(`
      query I($serviceId: String!, $environmentId: String!) {
        serviceInstance(serviceId: $serviceId, environmentId: $environmentId) { sleepApplication }
      }
    `, { serviceId: SERVICES[name], environmentId: ENV_ID })
    console.log(`  ${name}: ${d.serviceInstance.sleepApplication}`)
  }

  // ── 3. Sleep/wake cadence vs. the 15-min tick marks ──
  const cycle = all.filter((n) => n.object === 'Deployment' && ['slept', 'resumed'].includes(n.action) &&
    (n.serviceIds ?? []).some((id) => targetIds.has(id)))
  console.log(`\n── slept/resumed events: ${cycle.length} ──`)
  console.log('  (compare minute:second against observer ticks :00:30 / :15:30 / :30:30 / :45:30)')
  for (const n of cycle) {
    const svc = (n.serviceIds ?? []).map((id) => idToName.get(id) ?? id).join(',')
    console.log(`  ${n.createdAt}  ${n.action.padEnd(8)} ${svc}`)
  }
}

main().catch((e) => { console.error(`FAILED: ${e.message}`); process.exitCode = 1 })
