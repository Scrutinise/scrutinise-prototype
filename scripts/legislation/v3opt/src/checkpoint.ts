import * as fs from 'fs'
import * as path from 'path'

export interface WorkerStats {
  created: number
  sectionsCreated: number
  r2Writes: number
  tnaKeyWrites: number
  originalKeyWrites: number
  zeroSection: number
  normalized: number
  r2Failed: number
}

export interface WorkerCheckpoint {
  workerId: number
  completed: string[]
  skipped: string[]
  errors: Record<string, string>
  stats: WorkerStats
}

function emptyStats(): WorkerStats {
  return { created: 0, sectionsCreated: 0, r2Writes: 0, tnaKeyWrites: 0, originalKeyWrites: 0, zeroSection: 0, normalized: 0, r2Failed: 0 }
}

function checkpointPath(dir: string, workerId: number): string {
  return path.join(dir, `checkpoint-worker-${workerId}.json`)
}

export function loadWorkerCheckpoint(dir: string, workerId: number): WorkerCheckpoint {
  try {
    const raw = fs.readFileSync(checkpointPath(dir, workerId), 'utf8')
    return JSON.parse(raw) as WorkerCheckpoint
  } catch {
    return { workerId, completed: [], skipped: [], errors: {}, stats: emptyStats() }
  }
}

export function saveWorkerCheckpoint(dir: string, workerId: number, cp: WorkerCheckpoint): void {
  fs.writeFileSync(checkpointPath(dir, workerId), JSON.stringify(cp, null, 2), 'utf8')
}

export function aggregateStats(checkpoints: WorkerCheckpoint[]): WorkerStats {
  return checkpoints.reduce<WorkerStats>((acc, cp) => ({
    created:          acc.created          + cp.stats.created,
    sectionsCreated:  acc.sectionsCreated  + cp.stats.sectionsCreated,
    r2Writes:         acc.r2Writes         + cp.stats.r2Writes,
    tnaKeyWrites:     acc.tnaKeyWrites     + cp.stats.tnaKeyWrites,
    originalKeyWrites:acc.originalKeyWrites+ cp.stats.originalKeyWrites,
    zeroSection:      acc.zeroSection      + cp.stats.zeroSection,
    normalized:       acc.normalized       + cp.stats.normalized,
    r2Failed:         acc.r2Failed         + cp.stats.r2Failed,
  }), emptyStats())
}
