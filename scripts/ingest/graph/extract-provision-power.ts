/**
 * extract-provision-power.ts — GRAPH 9 §2: `provision_power`, one row per provision an enabling row names.
 *
 * For every (target_act_id, target_provision_ref) in `citation_edge`'s enabling rows, read the provision from the bulk
 * CLML and record what the two provision-side instruments say (provision-power.ts): the publisher's ConfersPower flag
 * and the text. The reader joins it to the enabling rows: a row whose enacting words name this as the power exercised,
 * on a provision that is `none`, is shown UNRESOLVED, never as made under it.
 *
 * ⚠ Every named provision gets a row, including ones the file cannot supply (`not-held`), so a MISSING row means
 * "never computed" (a target added since this ran) and the reader can say so, rather than meaning "held nothing".
 *
 *   npx tsx graph/extract-provision-power.ts --dry-run   — compute and count, no writes
 *   npx tsx graph/extract-provision-power.ts             — create the table if absent, replace its rows
 */
import fs from 'fs'
import path from 'path'
import { ZipReader, ZipEntryMeta } from './zip-reader'
import { ENTRY_RX, gidFromEntry } from './audit-25h-citations'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { provisionsOf, provisionPowerState, PROVISION_POWER_STATES, POWER_BASES, type Provision } from './provision-power'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
const OUT = path.join(__dirname, 'extract-provision-power.json')
export const PROVISION_POWER_TABLE = 'provision_power'

// NOTE: no backticks in this string - it is inside a template literal.
export const DDL = `
CREATE TABLE IF NOT EXISTS ${PROVISION_POWER_TABLE} (
  gid             text NOT NULL,     -- target_act_id, as citation_edge holds it
  provision_ref   text NOT NULL,     -- target_provision_ref, as citation_edge holds it
  state           text NOT NULL,     -- power | none | unknown (provision-power.ts provisionPowerState)
  basis           text NOT NULL,     -- which instruments said what
  words           text,              -- the power phrase the text rule read, where it read one
  publisher_flag  boolean,           -- ConfersPower="true" on the P1 or its P1group; NULL when the provision is not held
  document_marked boolean,           -- the publisher marked this document at all; NULL when not held
  extracted_from  text NOT NULL,
  extracted_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (gid, provision_ref),
  CONSTRAINT provision_power_state_ck CHECK (state IN (${PROVISION_POWER_STATES.map((s) => `'${s}'`).join(', ')})),
  CONSTRAINT provision_power_basis_ck CHECK (basis IN (${POWER_BASES.map((s) => `'${s}'`).join(', ')}))
);
`

async function main() {
  const dry = process.argv.includes('--dry-run')
  const pool = getNeonPool()
  const { rows } = await pool.query<{ g: string; p: string }>(
    `SELECT DISTINCT target_act_id g, target_provision_ref p FROM citation_edge
      WHERE detection = 'enabling' AND target_provision_ref IS NOT NULL AND target_act_id IS NOT NULL`)
  const wanted = new Map<string, Set<string>>()
  for (const r of rows) { const s = wanted.get(r.g) ?? new Set(); s.add(r.p); wanted.set(r.g, s) }
  console.log(`[provision-power] ${rows.length.toLocaleString()} named provisions in ${wanted.size.toLocaleString()} documents${dry ? ' (DRY RUN)' : ''}`)

  const zip = new ZipReader(ZIP_PATH)
  const provenance = `best-collection-xml.zip@${fs.statSync(ZIP_PATH).mtime.toISOString().slice(0, 10)}`
  const out: Array<{ g: string; p: string; state: string; basis: string; words: string | null; flag: boolean | null; marked: boolean | null }> = []
  const found = new Set<string>()
  for (const e of zip.entries) {
    const m = e.name.match(ENTRY_RX)
    if (!m) continue
    const gid = gidFromEntry(m)
    const want = wanted.get(gid)
    if (!want || found.has(gid)) continue
    found.add(gid)
    const xml = zip.readText(e as ZipEntryMeta)
    const { provisions, documentMarked } = provisionsOf(xml)
    const byRef = new Map<string, Provision>(provisions.map((p) => [p.ref.toLowerCase(), p]))
    for (const ref of want) {
      const p = byRef.get(ref.toLowerCase()) ?? null
      const st = provisionPowerState(p ? { flagged: p.flagged, text: p.text, documentMarked } : null)
      out.push({ g: gid, p: ref, state: st.state, basis: st.basis, words: st.words, flag: p ? p.flagged : null, marked: p ? documentMarked : null })
    }
  }
  zip.close()
  for (const [g, refs] of wanted) {
    if (found.has(g)) continue
    for (const p of refs) out.push({ g, p, state: 'unknown', basis: 'not-held', words: null, flag: null, marked: null })
  }

  const tally: Record<string, number> = {}
  for (const r of out) tally[`${r.state}:${r.basis}`] = (tally[`${r.state}:${r.basis}`] ?? 0) + 1
  let written = 0
  if (!dry) {
    await pool.query(DDL)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`DELETE FROM ${PROVISION_POWER_TABLE}`)
      for (let i = 0; i < out.length; i += 1000) {
        const b = out.slice(i, i + 1000)
        const res = await client.query(
          `INSERT INTO ${PROVISION_POWER_TABLE} (gid, provision_ref, state, basis, words, publisher_flag, document_marked, extracted_from)
           SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::boolean[], $7::boolean[], $8::text[])`,
          [b.map((r) => r.g), b.map((r) => r.p), b.map((r) => r.state), b.map((r) => r.basis), b.map((r) => r.words),
            b.map((r) => r.flag), b.map((r) => r.marked), b.map(() => provenance)])
        written += res.rowCount ?? 0
      }
      await client.query('COMMIT')
    } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }
  }
  const result = {
    measured_at: new Date().toISOString(), dry_run: dry, extracted_from: provenance,
    named_provisions: rows.length, documents: wanted.size, documents_in_file: found.size, rows: out.length, written,
    by_state_basis: Object.fromEntries(Object.entries(tally).sort((a, b) => b[1] - a[1])),
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
  await endNeonPool()
}
if (require.main === module) main().catch((e) => { console.error('[provision-power] FATAL', e); process.exit(1) })
