/**
 * check-build-failure-observer.ts — S25 Phase 3. Constructed inputs, not a real broken
 * build, per this repo's own stated principle for `serve-observer.ts`'s checks.
 *
 * Usage: tsx scripts/ingest/ops/check-build-failure-observer.ts
 */
import { evaluateBuildFailure, type BuildFailureState, type DeploymentObservation } from './build-failure-observer'

export {}

let passed = 0, failed = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

const FRESH: BuildFailureState = { openDeploymentId: null, lastAlertAt: null }
const NOW = Date.parse('2026-09-25T12:00:00Z')

function main() {
  console.log('healthy build')
  {
    const ok: DeploymentObservation = { ok: true, deploymentId: 'd1', status: 'SUCCESS', commitHash: 'abc123' }
    const { events } = evaluateBuildFailure(ok, FRESH, NOW)
    check('no alert on a successful deployment', events.length === 0)
  }

  console.log('\nquery failure — must NOT be reported as a build failure')
  {
    const down: DeploymentObservation = { ok: false, error: 'network error' }
    const { events } = evaluateBuildFailure(down, FRESH, NOW)
    check('a failed QUERY never alerts (unknown, not a build failure)', events.length === 0)
  }

  console.log('\na new build failure')
  {
    const failed: DeploymentObservation = { ok: true, deploymentId: 'd2', status: 'FAILED', commitHash: 'def456' }
    const { events, nextState } = evaluateBuildFailure(failed, FRESH, NOW)
    check('fires exactly one alert', events.length === 1)
    check('names the commit', events[0].subject.includes('def456'))
    check('state opens the incident', nextState.openDeploymentId === 'd2')
  }

  console.log('\nthe SAME failure again soon after — deduped')
  {
    const failed: DeploymentObservation = { ok: true, deploymentId: 'd2', status: 'FAILED', commitHash: 'def456' }
    const open: BuildFailureState = { openDeploymentId: 'd2', lastAlertAt: new Date(NOW - 3600_000).toISOString() }
    const { events } = evaluateBuildFailure(failed, open, NOW)
    check('does not re-alert within the window', events.length === 0)
  }

  console.log('\nthe SAME failure, still open after 6+ hours — one reminder')
  {
    const failed: DeploymentObservation = { ok: true, deploymentId: 'd2', status: 'FAILED', commitHash: 'def456' }
    const open: BuildFailureState = { openDeploymentId: 'd2', lastAlertAt: new Date(NOW - 7 * 3600_000).toISOString() }
    const { events } = evaluateBuildFailure(failed, open, NOW)
    check('fires exactly one reminder', events.length === 1)
    check('body says this is a reminder, not a new incident', events[0].body.includes('reminder'))
  }

  console.log('\nrecovery')
  {
    const recovered: DeploymentObservation = { ok: true, deploymentId: 'd3', status: 'SUCCESS', commitHash: 'ghi789' }
    const open: BuildFailureState = { openDeploymentId: 'd2', lastAlertAt: new Date(NOW - 3600_000).toISOString() }
    const { events, nextState } = evaluateBuildFailure(recovered, open, NOW)
    check('fires exactly one resolved email', events.length === 1 && events[0].subject.includes('recovered'))
    check('state clears the open incident', nextState.openDeploymentId === null)
  }

  console.log('\na DIFFERENT deployment also failing — a fresh incident, alerts immediately')
  {
    const failedAgain: DeploymentObservation = { ok: true, deploymentId: 'd4', status: 'FAILED', commitHash: 'jkl012' }
    const openOther: BuildFailureState = { openDeploymentId: 'd2', lastAlertAt: new Date(NOW - 3600_000).toISOString() }
    const { events } = evaluateBuildFailure(failedAgain, openOther, NOW)
    check('a new failing deployment id is a fresh incident, not deduped by the old one', events.length === 1)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) process.exit(1)
}

main()
