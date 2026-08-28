/**
 * setup-identity-table.ts — GRAPH 4B §1. The identity bridge's SQL surface.
 *
 * ONE additive table, `legislation_identity`, built FROM `identity.ts` AND FROM
 * NOTHING ELSE. It exists so a SQL join never has to translate an id by hand:
 *
 *   SELECT COALESCE(li.canonical, split_part(e.to_id, ':', 2)) AS canonical
 *   FROM legislation_edges e
 *   LEFT JOIN legislation_identity li ON li.form = split_part(e.to_id, ':', 2)
 *
 * ⚠ LEFT JOIN, always. An id with no bridge row keeps its own value. A bridge
 * that silently drops what it cannot resolve is the original bug — a join that
 * loses rows and reports a coverage result — wearing a different hat.
 *
 * ⚠⚠ `basis` IS NOT DECORATION. Every row says WHY two ids are the same
 * instrument, and the only three answers are the source's own enumeration, a
 * declared prefix family, and leading zeros. There is no 'looks similar'.
 *
 * ⚠⚠ AND A REFUSAL IS A ROW. A form that names more than one instrument —
 * `ukpga/1801/16` is two different Acts, because 41 Geo 3 and 42 Geo 3 are both
 * 1801 and each session numbers its chapters from one — is stored with a NULL
 * canonical and `basis = 'ambiguous-refused'`. The brief's rule is that an
 * unresolvable form "stays unresolved and is COUNTED, not guessed at", and a
 * form merely ABSENT from this table is indistinguishable from one nobody has
 * ever seen. The refusal has to be findable to be countable.
 *
 *   npx tsx graph/setup-identity-table.ts            — create + (re)populate
 *   npx tsx graph/setup-identity-table.ts --status   — counts only, no writes
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { IDENTITY_TABLE, loadIdentityBridge } from './identity'

const DDL = `
CREATE TABLE IF NOT EXISTS ${IDENTITY_TABLE} (
  form       text PRIMARY KEY,   -- an id form observed in the wild
  canonical  text,               -- the id legislation.gov.uk treats as canonical; NULL = refused
  basis      text NOT NULL,      -- WHY these are the same instrument, or why they are not
  built_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legislation_identity_basis_ck
    CHECK (basis IN ('source-enumeration', 'prefix-alias', 'zero-padding', 'ambiguous-refused')),
  -- a refusal has no canonical, and a bridge must have one. Neither shape can
  -- be written as the other by accident.
  CONSTRAINT legislation_identity_refusal_ck
    CHECK ((basis = 'ambiguous-refused') = (canonical IS NULL))
);
ALTER TABLE ${IDENTITY_TABLE} ALTER COLUMN canonical DROP NOT NULL;
ALTER TABLE ${IDENTITY_TABLE} DROP CONSTRAINT IF EXISTS legislation_identity_basis_ck;
ALTER TABLE ${IDENTITY_TABLE} ADD CONSTRAINT legislation_identity_basis_ck
  CHECK (basis IN ('source-enumeration', 'prefix-alias', 'zero-padding', 'ambiguous-refused'));
ALTER TABLE ${IDENTITY_TABLE} DROP CONSTRAINT IF EXISTS legislation_identity_refusal_ck;
ALTER TABLE ${IDENTITY_TABLE} ADD CONSTRAINT legislation_identity_refusal_ck
  CHECK ((basis = 'ambiguous-refused') = (canonical IS NULL));
CREATE INDEX IF NOT EXISTS legislation_identity_canonical ON ${IDENTITY_TABLE} (canonical);
`

export async function buildIdentityTable(): Promise<{ rows: number; ambiguous: number; degraded: boolean }> {
  const pool = getNeonPool()
  await pool.query(DDL)
  const bridge = loadIdentityBridge()
  if (bridge.stats.degraded) {
    // ⚠ Refuse to truncate a good table down to nothing because the source file
    // was not on disk. An empty bridge is indistinguishable from a corpus with
    // no pre-1963 Acts in it, which is the failure this whole module ends.
    throw new Error(`[identity] source enumeration missing at ${bridge.stats.sourcePath} — REFUSING to rebuild the table from an empty bridge`)
  }
  const rows: Array<{ form: string; canonical: string | null; basis: string }> = [...bridge.rows(), ...bridge.refusedRows()]
  await pool.query('BEGIN')
  try {
    await pool.query(`TRUNCATE ${IDENTITY_TABLE}`)
    const BATCH = 2000
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const values: unknown[] = []
      const tuples = batch.map((r, j) => {
        values.push(r.form, r.canonical, r.basis)
        const b = j * 3
        return `($${b + 1},$${b + 2},$${b + 3})`
      })
      await pool.query(
        `INSERT INTO ${IDENTITY_TABLE} (form, canonical, basis) VALUES ${tuples.join(',')}
         ON CONFLICT (form) DO UPDATE SET canonical = EXCLUDED.canonical, basis = EXCLUDED.basis, built_at = now()`,
        values)
    }
    await pool.query('COMMIT')
  } catch (e) { await pool.query('ROLLBACK'); throw e }
  return { rows: rows.length, ambiguous: bridge.stats.ambiguousForms, degraded: false }
}

async function main() {
  const pool = getNeonPool()
  if (!process.argv.includes('--status')) {
    const r = await buildIdentityTable()
    console.log(`[setup-identity] ${IDENTITY_TABLE}: ${(r.rows - r.ambiguous).toLocaleString()} forms bridged · ${r.ambiguous.toLocaleString()} REFUSED as ambiguous and recorded as such`)
  }
  const exists = await pool.query(`SELECT to_regclass('${IDENTITY_TABLE}') AS t`)
  if (!exists.rows[0].t) { console.log('[setup-identity] table does not exist'); await endNeonPool(); return }
  const { rows } = await pool.query(`SELECT basis, COUNT(*)::bigint n FROM ${IDENTITY_TABLE} GROUP BY 1 ORDER BY n DESC`)
  for (const r of rows) console.log(`  ${String(r.basis).padEnd(20)} ${r.n}`)
  const size = await pool.query(`SELECT pg_size_pretty(pg_total_relation_size('${IDENTITY_TABLE}')) sz`)
  console.log(`[setup-identity] table size: ${size.rows[0].sz}`)
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[setup-identity] FATAL', e); process.exit(1) })
}
