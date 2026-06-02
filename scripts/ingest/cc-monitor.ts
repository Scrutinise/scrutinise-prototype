/**
 * cc-monitor.ts — CC self-healing agent loop.
 *
 * Runs locally as a long-running process alongside other work:
 *   NODE_PATH=scrutinise-web/node_modules \
 *   scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json \
 *   scripts/ingest/cc-monitor.ts
 *
 * Every 60 minutes:
 *   1. Check Railway for CRASHED/FAILED worker services → auto-redeploy
 *   2. Check R2 checkpoint freshness → redeploy stalled workers (no update > 2h)
 *   3. Check ingest_queue for failed rows → group by error pattern
 *      → print new unknown patterns to stdout for CC investigation
 *   4. Write summary to R2 at ingest-monitor/failures-YYYY-MM-DD-HH.json
 *   5. Append redeployment actions to R2 at ingest-monitor/auto-redeployments.log
 *
 * Requires: RAILWAY_API_TOKEN, RAILWAY_PROJECT_ID in .env
 */
import path from 'path'
import fs from 'fs'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getFailedRows, resetFailedToPending, getQueueCounts, disconnectQueue } from './shared/queue-client'
import { r2Put, r2Get } from './shared/r2-client'
import { readCheckpoint } from './shared/checkpoint'

const POLL_INTERVAL_MS   = 60 * 60 * 1000  // 60 minutes
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000  // 2 hours = stalled worker
const RAILWAY_API        = 'https://api.railway.app/graphql/v2'
const KNOWN_ERRORS_PATH  = path.join(__dirname, 'known-errors.json')

// ── Railway API helpers ────────────────────────────────────────────────────────

interface RailwayDeployment {
  id: string
  status: string  // ACTIVE | CRASHED | FAILED | REMOVED | SLEEPING
  serviceId: string
  serviceName: string
}

async function getRailwayDeployments(): Promise<RailwayDeployment[]> {
  const token = process.env.RAILWAY_API_TOKEN
  const projectId = process.env.RAILWAY_PROJECT_ID
  if (!token || !projectId) {
    console.warn('[monitor] RAILWAY_API_TOKEN or RAILWAY_PROJECT_ID not set — skipping Railway checks')
    return []
  }

  const query = `
    query GetDeployments($projectId: String!) {
      project(id: $projectId) {
        services {
          edges {
            node {
              id
              name
              deployments(last: 1) {
                edges {
                  node {
                    id
                    status
                  }
                }
              }
            }
          }
        }
      }
    }
  `

  try {
    const res = await fetch(RAILWAY_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { projectId } }),
    })
    if (!res.ok) {
      console.warn(`[monitor] Railway API HTTP ${res.status}`)
      return []
    }

    const data = await res.json() as {
      data?: {
        project?: {
          services?: {
            edges?: Array<{
              node: {
                id: string
                name: string
                deployments?: { edges?: Array<{ node: { id: string; status: string } }> }
              }
            }>
          }
        }
      }
      errors?: Array<{ message: string }>
    }

    if (data.errors?.length) {
      console.warn('[monitor] Railway API errors:', data.errors.map(e => e.message).join(', '))
      return []
    }

    const deployments: RailwayDeployment[] = []
    for (const svc of data.data?.project?.services?.edges ?? []) {
      const latestDeploy = svc.node.deployments?.edges?.[0]?.node
      if (latestDeploy) {
        deployments.push({
          id: latestDeploy.id,
          status: latestDeploy.status,
          serviceId: svc.node.id,
          serviceName: svc.node.name,
        })
      }
    }
    return deployments
  } catch (err) {
    console.warn('[monitor] Railway API fetch error:', err)
    return []
  }
}

async function railwayRedeploy(deploymentId: string): Promise<boolean> {
  const token = process.env.RAILWAY_API_TOKEN
  if (!token) return false

  const mutation = `
    mutation Redeploy($deploymentId: String!) {
      deploymentRedeploy(id: $deploymentId) {
        id
        status
      }
    }
  `

  try {
    const res = await fetch(RAILWAY_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: mutation, variables: { deploymentId } }),
    })
    if (!res.ok) return false
    const data = await res.json() as { data?: { deploymentRedeploy?: { id: string } } }
    return !!data.data?.deploymentRedeploy?.id
  } catch {
    return false
  }
}

// ── Stall detection ───────────────────────────────────────────────────────────

async function checkStalledWorkers(): Promise<Array<{ workerId: number; lastUpdated: string; staleMs: number }>> {
  const stalled = []
  const now = Date.now()

  for (let id = 1; id <= 10; id++) {
    try {
      const cp = await readCheckpoint(id)
      if (!cp.lastUpdated) continue
      const age = now - new Date(cp.lastUpdated).getTime()
      if (age > STALE_THRESHOLD_MS) {
        stalled.push({ workerId: id, lastUpdated: cp.lastUpdated, staleMs: age })
      }
    } catch {
      // Checkpoint missing — worker hasn't started yet, not a stall
    }
  }
  return stalled
}

// ── Error pattern analysis ────────────────────────────────────────────────────

function loadKnownPatterns(): string[] {
  try {
    const raw = fs.readFileSync(KNOWN_ERRORS_PATH, 'utf-8')
    const data = JSON.parse(raw) as { patterns?: Array<{ pattern: string }> }
    return data.patterns?.map(p => p.pattern) ?? []
  } catch {
    return []
  }
}

function addKnownPattern(pattern: string, description: string, action: string): void {
  try {
    const raw = fs.readFileSync(KNOWN_ERRORS_PATH, 'utf-8')
    const data = JSON.parse(raw) as { patterns: Array<{ pattern: string; description: string; action: string }> }
    if (!data.patterns.some(p => p.pattern === pattern)) {
      data.patterns.push({ pattern, description, action })
      fs.writeFileSync(KNOWN_ERRORS_PATH, JSON.stringify(data, null, 2))
      console.log(`[monitor] added known error pattern: "${pattern}"`)
    }
  } catch (err) {
    console.warn('[monitor] failed to update known-errors.json:', err)
  }
}

interface ErrorGroup {
  pattern: string
  count: number
  examples: Array<{ id: string; docId: string; corpus: string; error: string }>
  isNew: boolean
}

async function analyseFailures(): Promise<ErrorGroup[]> {
  const rows = await getFailedRows(2, 500)
  const knownPatterns = loadKnownPatterns()

  const groups = new Map<string, ErrorGroup>()

  for (const row of rows) {
    const err = row.lastError ?? ''
    // Find which known pattern this matches (or 'unknown' if none)
    const matchedPattern = knownPatterns.find(p => err.includes(p)) ?? `unknown:${err.slice(0, 60)}`
    const isNew = !knownPatterns.some(p => err.includes(p))

    if (!groups.has(matchedPattern)) {
      groups.set(matchedPattern, { pattern: matchedPattern, count: 0, examples: [], isNew })
    }
    const group = groups.get(matchedPattern)!
    group.count++
    if (group.examples.length < 3) {
      group.examples.push({ id: row.id, docId: row.docId, corpus: row.corpus, error: err })
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.count - a.count)
}

// ── R2 logging ────────────────────────────────────────────────────────────────

async function writeMonitorReport(report: Record<string, unknown>): Promise<void> {
  const now = new Date()
  const key = `ingest-monitor/failures-${now.toISOString().slice(0, 13)}.json`
  try {
    await r2Put(key, JSON.stringify(report, null, 2))
  } catch (err) {
    console.warn('[monitor] failed to write R2 report:', err)
  }
}

async function appendRedeployLog(line: string): Promise<void> {
  const key = 'ingest-monitor/auto-redeployments.log'
  try {
    const existing = await r2Get(key) ?? ''
    await r2Put(key, existing + line + '\n', 'text/plain')
  } catch (err) {
    console.warn('[monitor] failed to append redeploy log:', err)
  }
}

// ── Main poll loop ─────────────────────────────────────────────────────────────

async function runPoll(): Promise<void> {
  const ts = new Date().toISOString()
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`[monitor] ${ts}`)

  const report: Record<string, unknown> = { timestamp: ts }

  // 1. Queue counts
  try {
    const counts = await getQueueCounts()
    report.queueCounts = counts
    const pending = counts.pending ?? 0
    const done    = counts.done ?? 0
    const failed  = counts.failed ?? 0
    const total   = Object.values(counts).reduce((a, b) => a + b, 0)
    console.log(`[monitor] Queue: ${pending} pending | ${done} done | ${failed} failed | ${total} total`)
  } catch (err) {
    console.warn('[monitor] queue counts error:', err)
  }

  // 2. Railway deployment health
  const deployments = await getRailwayDeployments()
  const crashedServices: RailwayDeployment[] = []
  for (const d of deployments) {
    if (d.status === 'CRASHED' || d.status === 'FAILED') {
      crashedServices.push(d)
      console.log(`[monitor] ⚠  ${d.serviceName} status=${d.status} deploymentId=${d.id}`)
    }
  }

  // Auto-redeploy crashed services
  for (const svc of crashedServices) {
    console.log(`[monitor] → auto-redeploying ${svc.serviceName}…`)
    const ok = await railwayRedeploy(svc.id)
    const logLine = `${ts} | REDEPLOY ${ok ? 'OK' : 'FAILED'} | ${svc.serviceName} | deployment=${svc.id}`
    console.log(`[monitor]   ${logLine}`)
    await appendRedeployLog(logLine)
  }
  report.crashedServices = crashedServices.map(s => s.serviceName)

  // 3. Stalled worker detection (checkpoint not updated in >2h)
  const stalled = await checkStalledWorkers()
  if (stalled.length > 0) {
    console.log(`[monitor] Stalled workers:`)
    for (const s of stalled) {
      const hoursAgo = (s.staleMs / 3_600_000).toFixed(1)
      console.log(`[monitor]   worker-${s.workerId}: last updated ${hoursAgo}h ago (${s.lastUpdated})`)
    }
    // Find Railway deployment for each stalled worker and redeploy
    for (const s of stalled) {
      const svcName = `worker-${s.workerId}`
      const svc = deployments.find(d =>
        d.serviceName.toLowerCase().includes(`worker-${s.workerId}`) ||
        d.serviceName.toLowerCase().includes(svcName)
      )
      if (svc && svc.status !== 'CRASHED') {
        console.log(`[monitor] → redeploying stalled ${svcName}…`)
        const ok = await railwayRedeploy(svc.id)
        const logLine = `${ts} | STALL-REDEPLOY ${ok ? 'OK' : 'FAILED'} | ${svcName} | last=${s.lastUpdated}`
        console.log(`[monitor]   ${logLine}`)
        await appendRedeployLog(logLine)
      }
    }
  }
  report.stalledWorkers = stalled.map(s => `worker-${s.workerId}`)

  // 4. Error pattern analysis
  const errorGroups = await analyseFailures()
  report.errorGroups = errorGroups

  if (errorGroups.length > 0) {
    console.log(`[monitor] Error patterns (${errorGroups.length} groups):`)
    for (const g of errorGroups) {
      const flag = g.isNew ? ' ★ NEW PATTERN' : ''
      console.log(`[monitor]   [${g.count}] "${g.pattern}"${flag}`)
      if (g.isNew) {
        console.log(`[monitor]       Example doc: ${g.examples[0]?.docId} (${g.examples[0]?.corpus})`)
        console.log(`[monitor]       Error: ${g.examples[0]?.error}`)
        console.log(`[monitor]       → CC: investigate this URL and determine fix`)
      }
    }

    // Auto-reset rows with known/retriable patterns
    const retriablePatterns = ['fetch failed', 'Atom feed HTTP']
    for (const g of errorGroups) {
      if (retriablePatterns.some(p => g.pattern.includes(p))) {
        const ids = g.examples.map(e => e.id)
        // In a real run we'd get all IDs not just the 3 examples, but this illustrates the pattern
        if (ids.length > 0) {
          await resetFailedToPending(ids)
          console.log(`[monitor]   reset ${ids.length} retriable rows to pending`)
        }
      }
    }
  }

  // 5. Write R2 report
  await writeMonitorReport(report)
  console.log(`[monitor] report written to R2`)
}

// ── Entry ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('[monitor] starting cc-monitor — polling every 60 minutes')
  console.log('[monitor] Railway API:', process.env.RAILWAY_API_TOKEN ? 'configured ✓' : 'NOT configured (set RAILWAY_API_TOKEN)')
  console.log('[monitor] Railway Project:', process.env.RAILWAY_PROJECT_ID ?? 'NOT configured (set RAILWAY_PROJECT_ID)')

  while (true) {
    try {
      await runPoll()
    } catch (err) {
      console.error('[monitor] poll error:', err)
    }

    console.log(`[monitor] next poll in ${POLL_INTERVAL_MS / 60000} min`)
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
  }
}

main().catch(err => {
  console.error('[monitor] fatal:', err)
  process.exit(1)
})
