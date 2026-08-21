/**
 * index-state.ts — WHICH INDEX WAS THIS NUMBER TAKEN AGAINST? SEARCH S12 §3.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS, in one incident. S10 published per-collection recall figures on 20 August. The
 * case-law re-compile rewrote 74,896 bodies hours later, and a delete-and-re-add moves BM25
 * document frequencies **table-wide** — S11 re-measured and **0 of 5 sampled rankings reproduced**.
 * S10's numbers were not stale, they were **void**: there was no way to tell which index they
 * described, because nothing was recorded alongside them.
 *
 * A baseline that does not name its index cannot be compared to anything later. That is the whole
 * requirement, and LanceDB already provides the answer for free.
 *
 * ── THE SMALLEST DURABLE THING THAT WORKS ───────────────────────────────────────────────────────
 * Every Lance table carries a monotonic `version()` — an integer that advances on every commit
 * (append, delete, index build). It uniquely identifies the dataset state, costs one metadata read,
 * and needs no hashing, no bookkeeping and no new storage. `corpus_fts` was at **7308** when this
 * was written.
 *
 * ⚠ Row counts are recorded beside the version and are NOT a substitute for it: a delete-and-re-add
 * of the same number of rows leaves the count identical and the ranking completely different, which
 * is exactly what happened in August. The version moves; the count does not.
 *
 * ⚠ AND IT IS A LOCAL FACT, NOT A SERVED ONE. This reports the version of the dataset in R2. The
 * services (`fts-serve`, `vector-serve`) call `openTable()` once at boot and hold whatever version
 * they opened, so a measurement taken THROUGH a service may describe an older version than this
 * function returns. Where that matters, say which of the two you measured.
 */
import { connectLance, FTS_TABLE } from './lance'
import { CHUNKS_TABLE, VEC_TABLE } from './vector-common'

export interface TableState { table: string; version: number | string; rows: number }
export interface IndexState { takenAt: string; tables: TableState[] }

/** One metadata read per table. Safe to call before and after any measurement. */
export async function indexState(tables: string[] = [FTS_TABLE, VEC_TABLE, CHUNKS_TABLE]): Promise<IndexState> {
  const db = await connectLance()
  const out: TableState[] = []
  for (const t of tables) {
    try {
      const tbl = await db.openTable(t)
      const version = typeof (tbl as any).version === 'function' ? await (tbl as any).version() : '(unavailable)'
      out.push({ table: t, version, rows: await tbl.countRows() })
    } catch (e) {
      // A table that cannot be opened is recorded as such rather than omitted: a missing row in
      // this stamp would read as "we did not check", which is the ambiguity it exists to remove.
      out.push({ table: t, version: `(unreadable: ${(e as Error).message})`, rows: -1 })
    }
  }
  return { takenAt: new Date().toISOString(), tables: out }
}

/** One line per table, for printing at the head of any measurement. */
export function formatIndexState(s: IndexState): string[] {
  return [
    `  index state @ ${s.takenAt}`,
    ...s.tables.map((t) => `    ${t.table.padEnd(16)} version ${String(t.version).padStart(6)}   ${t.rows < 0 ? '(unreadable)' : t.rows.toLocaleString('en-GB') + ' rows'}`),
  ]
}

if (require.main === module) {
  indexState().then((s) => { formatIndexState(s).forEach((l) => console.log(l)) })
}
