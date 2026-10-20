/**
 * purge-ledger.ts — INGEST_LEX_FIVE §6.2. A machine-readable record of how far each purge got.
 *
 * `l2-purge.ts` used to end a run with the sentence "NEXT (index layer, not done here)" — the same
 * defect the purge exists to fix, one layer along. It is now also written down where a check can
 * read it: opening a run records the DATABASE layer done and the FTS and VECTOR layers PENDING, and a
 * layer is closed only by `markLayerDone`, which the index purge calls AFTER reading the count back.
 *
 * ⚠ THE OOM EXITS WITH CODE 0 SOMETIMES AND 127 OTHERS. LanceDB's Rust allocator aborts without
 * reliably setting a failure status, so a wrapper sees green and continues. That is why completion is
 * a RECORD WRITTEN AFTER A READ-BACK and not an exit code: a process that dies mid-delete never reaches
 * the line that writes `done`, and an absence of output cannot forge one. The ledger is append-only
 * JSONL; the latest entry per (run, collection, layer) wins.
 *
 * The three-layer audit (`search/audit-three-layer.ts`) reads this to NAME a collection whose purge
 * stopped early, instead of inferring it from counts alone.
 */
import fs from 'fs'
import path from 'path'

export type PurgeLayer = 'database' | 'fts' | 'vector'
export interface LedgerEntry {
  runId: string
  ts: string
  tool: string
  collection: string
  layer: PurgeLayer
  status: 'done' | 'pending'
  /** Rows the layer held for this collection before / after, as COUNTED, when done. */
  before?: number
  after?: number
  /** True when only some of the collection's rows were targeted (et-decisions landing pages). */
  partial?: boolean
  note?: string
}

export const LEDGER_PATH = path.join(__dirname, '../../../docs/census/purge-ledger.jsonl')

export function append(e: Omit<LedgerEntry, 'ts'>): void {
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true })
  fs.appendFileSync(LEDGER_PATH, JSON.stringify({ ...e, ts: new Date().toISOString() }) + '\n')
}

/** Database layer done; the two index layers explicitly pending. Call once per collection when the DELETE has committed. */
export function openRun(runId: string, tool: string, collection: string, before: number, after: number, partial = false): void {
  append({ runId, tool, collection, layer: 'database', status: 'done', before, after, partial })
  append({ runId, tool, collection, layer: 'fts', status: 'pending', partial, note: 'index layer not run by the database purge' })
  append({ runId, tool, collection, layer: 'vector', status: 'pending', partial, note: 'index layer not run by the database purge' })
}

/** Close an index layer. ONLY after the count has been read back from the table. */
export function markLayerDone(runId: string, tool: string, collection: string, layer: Exclude<PurgeLayer, 'database'>, before: number, after: number, partial = false): void {
  append({ runId, tool, collection, layer, status: 'done', before, after, partial })
}

export function readLedger(): LedgerEntry[] {
  if (!fs.existsSync(LEDGER_PATH)) return []
  return fs.readFileSync(LEDGER_PATH, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as LedgerEntry)
}

/** Latest status per (run, collection, layer); returns the layers still pending. */
export function pendingLayers(): Array<{ runId: string; collection: string; layer: PurgeLayer; partial: boolean }> {
  const latest = new Map<string, LedgerEntry>()
  for (const e of readLedger()) latest.set(`${e.runId}|${e.collection}|${e.layer}`, e)
  return [...latest.values()].filter((e) => e.status === 'pending').map((e) => ({ runId: e.runId, collection: e.collection, layer: e.layer, partial: !!e.partial }))
}
