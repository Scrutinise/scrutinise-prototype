import { r2Get, r2Put, checkpointKey } from './r2-client'

export interface WorkerCheckpoint {
  workerId: number
  phase: 1 | 2
  corpus: string
  lastProcessedId: string
  totalInCorpus: number
  completed: number
  failed: number
  skipped: number
  lastUpdated: string
  phase1Complete: boolean
  errors: Array<{ id: string; error: string; ts: string }>
}

function empty(workerId: number): WorkerCheckpoint {
  return {
    workerId,
    phase: 1,
    corpus: '',
    lastProcessedId: '',
    totalInCorpus: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    lastUpdated: new Date().toISOString(),
    phase1Complete: false,
    errors: [],
  }
}

export async function readCheckpoint(workerId: number): Promise<WorkerCheckpoint> {
  const raw = await r2Get(checkpointKey(workerId))
  if (!raw) return empty(workerId)
  try {
    return JSON.parse(raw) as WorkerCheckpoint
  } catch {
    console.warn(`[worker-${workerId}] checkpoint parse failed — starting fresh`)
    return empty(workerId)
  }
}

export async function writeCheckpoint(cp: WorkerCheckpoint): Promise<void> {
  cp.lastUpdated = new Date().toISOString()
  await r2Put(checkpointKey(cp.workerId), JSON.stringify(cp, null, 2))
}

export function recordError(cp: WorkerCheckpoint, id: string, error: string): void {
  cp.errors.push({ id, error, ts: new Date().toISOString() })
  // Keep only last 50 errors
  if (cp.errors.length > 50) cp.errors = cp.errors.slice(-50)
  cp.failed++
}

export function recordSkip(cp: WorkerCheckpoint): void {
  cp.skipped++
}

export function recordSuccess(cp: WorkerCheckpoint, id: string): void {
  cp.completed++
  cp.lastProcessedId = id
}
