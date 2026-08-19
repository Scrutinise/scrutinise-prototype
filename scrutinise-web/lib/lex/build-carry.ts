// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-B §1 — THE PASS LOG, AND WHAT SURVIVES BETWEEN REQUESTS.
//
// 25-A ran every pass inside one function call, so each pass simply handed the next one
// an in-memory `RunAccumulator`. 25-B runs ONE PASS PER REQUEST (§1), and an in-memory
// accumulator does not survive a request boundary. Something has to carry the
// orientation into the diagnosis, the diagnosis into the approach, and the whole draft
// into the research pass — and that something has to be STORED, because the next pass
// runs in a different process.
//
// ⚠ THE CARRY IS THE PASS LOG, NOT A SECOND STATE. This is the decision this file
// exists to record. The alternatives were a new column (a migration, for state that is
// already conceptually "what this pass produced") or re-deriving each pass's output from
// the canonical fields it wrote (subtly lossy: `acc.diagnosis` is the model's own prose,
// not a concatenation of the fields, and reconstructing it would silently change what
// pass 3 is researching). Storing each pass's carry ON THE PASS RECORD keeps the
// codebase's own rule — "the status shown is the status stored" — true of the inputs as
// well as the outputs, and it needs no migration.
//
// ⚠ AND THE SPEND IS PER PASS, FOR THE SAME REASON (§8). A build-level token total
// cannot answer "which pass cost that", which is exactly the question Charlie is being
// asked to judge. The usages live on the pass that spent them; the build total is their
// sum, so the two can never disagree.
// ─────────────────────────────────────────────────────────────────────────────

import { BUILD_PASSES, type BuildPassKey } from './build-config'
import type { LlmUsage } from './build-llm'

export type PassStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'NOT_REACHED' | 'SKIPPED'

/**
 * What one pass hands to the passes after it.
 *
 * Deliberately flat strings rather than structured objects: every consumer is a PROMPT,
 * and a prompt takes prose. Anything a later pass needs as data (findings, forks,
 * proposals) is already a row in the database and is read from there.
 */
export interface PassCarry {
  /** ORIENT — the terrain plus the domain-transfer answer. */
  orientation?: string
  /** DIAGNOSIS — challenge, summary, root cause, pivotal obstacle. */
  diagnosis?: string
  /** APPROACH — chosen approach, leverage, what it rules out. */
  approach?: string
  /** APPROACH — the instrument, as one line. Pass 3's EXISTING_POWER question reads it. */
  instrument?: string
  /** ORIENT — TRUE when a corpus search did not complete. Never conflated with silence. */
  searchFailed?: boolean
  /** RESEARCH — the findings, as prose, for the revision and the adversarial read. */
  research?: string
  /** REVISE — what changed and what contradicted pass 2, for the adversarial read. */
  revision?: string
}

export interface PassRecord {
  key: BuildPassKey
  label: string
  detail: string
  status: PassStatus
  startedAt: string | null
  completedAt: string | null
  /** A one-line account of what this pass produced, for the progress display. */
  output: string | null
  failureReason: string | null
  /**
   * §8 — "Progress must show what is happening, not a spinner: the current pass, the
   * question being asked, and findings appearing as they land."
   *
   * Written DURING the pass, not after it, which is the whole point: a ten-minute wait
   * with no evidence of work is indistinguishable from a hang.
   */
  activity?: string | null
  /** What this pass hands forward. See the header. */
  carry?: PassCarry
  /** §8 — every model call this pass made. The build total is the sum of these. */
  usages?: LlmUsage[]
}

export function freshPassLog(): PassRecord[] {
  return BUILD_PASSES.map((p) => ({
    key: p.key, label: p.label, detail: p.detail,
    status: 'PENDING' as PassStatus,
    startedAt: null, completedAt: null, output: null, failureReason: null,
    activity: null, carry: {}, usages: [],
  }))
}

export function readPassLog(raw: unknown): PassRecord[] {
  if (!Array.isArray(raw) || !raw.length) return freshPassLog()
  // Reconcile against the configured passes, so adding a pass in a later sprint does
  // not make an old row unreadable — and so a pass that is configured but missing from
  // a stored log shows as PENDING rather than vanishing.
  //
  // ⚠ THIS IS WHAT MAKES A 25-A BUILD READABLE BY 25-B. A row written when there were
  // four passes gains three PENDING ones here rather than failing to parse, and an
  // unfinished 25-A build can therefore be RESUMED into its research pass rather than
  // being stranded by the upgrade.
  const stored = raw as PassRecord[]
  return BUILD_PASSES.map((p) => {
    const found = stored.find((s) => s?.key === p.key)
    return found
      ? {
          ...found,
          label: p.label,
          detail: p.detail,
          carry: found.carry ?? {},
          usages: Array.isArray(found.usages) ? found.usages : [],
          activity: found.activity ?? null,
        }
      : {
          key: p.key, label: p.label, detail: p.detail, status: 'PENDING' as PassStatus,
          startedAt: null, completedAt: null, output: null, failureReason: null,
          activity: null, carry: {}, usages: [],
        }
  })
}

/**
 * Everything the passes before `key` handed forward, merged in pass order.
 *
 * Later passes win on a key they both set — REVISE's `diagnosis` supersedes DIAGNOSIS's,
 * which is exactly what pass 5 should be reading.
 */
export function carryInto(log: PassRecord[], key: BuildPassKey): PassCarry {
  const upto = log.findIndex((p) => p.key === key)
  const out: PassCarry = {}
  for (const p of log.slice(0, upto < 0 ? log.length : upto)) {
    if (p.status !== 'DONE') continue
    for (const [k, v] of Object.entries(p.carry ?? {})) {
      if (v === undefined || v === null || v === '') continue
      ;(out as Record<string, unknown>)[k] = v
    }
  }
  return out
}

/** Every model call the build has made so far, across all its requests. */
export function allUsages(log: PassRecord[]): LlmUsage[] {
  return log.flatMap((p) => p.usages ?? [])
}

/**
 * §1 — WHICH PASS RUNS NEXT, and it is a question about the STORED log rather than
 * about what the caller believes.
 *
 * Returns null when there is nothing left to run, which is how the engine knows to
 * finish the build rather than asking the client to trigger a pass that does not exist.
 *
 * ⚠ A FAILED PASS STOPS THE BUILD; a SKIPPED one does not. A pass that could not run at
 * all (its question had no retrieval, say) is not the same event as a pass that ran and
 * broke, and collapsing them would let a build limp past a real failure.
 */
export function nextPassKey(log: PassRecord[]): BuildPassKey | null {
  for (const p of log) {
    if (p.status === 'FAILED') return null
    if (p.status === 'PENDING' || p.status === 'RUNNING') return p.key
  }
  return null
}

/**
 * §1 — "an orphaned build must be resumable from its last completed pass."
 *
 * A build is resumable when it has work left and at least one pass already finished:
 * resuming a build that has done nothing is just starting it, and calling that a resume
 * would tell the user work was preserved when none was.
 */
export function isResumable(log: PassRecord[]): boolean {
  return nextPassKey(log) !== null && log.some((p) => p.status === 'DONE')
}

export function passesComplete(log: PassRecord[]): number {
  return log.filter((p) => p.status === 'DONE').length
}
