/**
 * setup-coverage-table.ts — GRAPH 4A §7. One additive table, `graph_coverage_fact`.
 *
 * ⚠⚠ **THIS TABLE EXISTS BECAUSE OF THE 17.5 GB FIGURE.** A caveat written into
 * a string constant goes stale silently and then gets quoted back for months as
 * if it were a measurement — that constant survived being retired twice and was
 * resurrected by 25-H from a July header comment. §7's rule is that the coverage
 * block must be **generated from live coverage state, never a hardcoded string**.
 *
 * Most of the coverage block IS a live query (see `coverage.ts`). But two facts
 * cannot be: the unresolved act-name span count and the OI-15 residual are
 * properties of an EXTRACTION RUN over a 1.4 GB zip, not of any row in the
 * database. 25-H printed 93,772 to a console and the number then existed only in
 * a log file and a markdown document.
 *
 * So they are stored **with the date they were measured and the script that
 * measured them**, and `coverage.ts` reports a fact older than its freshness
 * window as STALE, by name, in the block itself. ⚠ **A stale fact announces its
 * age rather than quietly becoming a lie** — which is the whole difference
 * between this and a constant.
 *
 *   npx tsx graph/setup-coverage-table.ts            — create
 *   npx tsx graph/setup-coverage-table.ts --status   — show what is recorded
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export const COVERAGE_TABLE = 'graph_coverage_fact'

const DDL = `
CREATE TABLE IF NOT EXISTS ${COVERAGE_TABLE} (
  key          text PRIMARY KEY,
  -- numeric, not bigint: some facts are percentages. A bigint column rejected
  -- 29.9 outright, which is the good failure — the bad one is a silent floor to 29.
  n            numeric,
  note         text NOT NULL,    -- what it means, in words, WITHOUT the number in it
  measured_at  timestamptz NOT NULL DEFAULT now(),
  measured_by  text NOT NULL     -- the script that wrote it, so it can be re-run
);
ALTER TABLE ${COVERAGE_TABLE} ALTER COLUMN n TYPE numeric;
`

export async function recordFact(key: string, n: number | null, note: string, measuredBy: string): Promise<void> {
  const pool = getNeonPool()
  await pool.query(
    `INSERT INTO ${COVERAGE_TABLE} (key, n, note, measured_at, measured_by)
     VALUES ($1, $2, $3, now(), $4)
     ON CONFLICT (key) DO UPDATE SET n = EXCLUDED.n, note = EXCLUDED.note,
       measured_at = EXCLUDED.measured_at, measured_by = EXCLUDED.measured_by`,
    [key, n, note, measuredBy])
}

async function main() {
  const pool = getNeonPool()
  if (!process.argv.includes('--status')) {
    await pool.query(DDL)
    console.log(`[setup-coverage] ${COVERAGE_TABLE} ensured`)
  }
  const { rows } = await pool.query(
    `SELECT key, n, note, measured_at, measured_by FROM ${COVERAGE_TABLE} ORDER BY key`)
  if (rows.length === 0) console.log('[setup-coverage] no facts recorded yet')
  for (const r of rows) {
    console.log(`  ${String(r.key).padEnd(28)} ${String(r.n ?? '—').padStart(10)}  ${new Date(r.measured_at).toISOString().slice(0, 16)}  by ${r.measured_by}`)
    console.log(`      ${r.note}`)
  }
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[setup-coverage] FATAL', e); process.exit(1) })
}
