/**
 * audit-three-layer.ts — INGEST_LEX_FIVE §6.1. For EVERY collection, three numbers side by side:
 *
 *     corpus_sections (Neon)   corpus_fts (Lance)   corpus_vec / corpus_chunks (Lance)
 *
 * It passes only if all three agree within a stated tolerance, and it NAMES every collection where they
 * do not, with the reason, instead of returning pass/fail. The ledger (`c2/purge-ledger.ts`) is read as
 * well: a purge that stopped after the database is reported as such, not inferred.
 *
 * WHAT "AGREE" MEANS, STATED — because a guard that cannot fail is not a guard:
 *   · FTS is one row per COMPILED section, so `fts_rows` should equal `compiled`. Tolerance: the larger of
 *     5 rows and 0.5% — an index lags ingest, and the lag is REPORTED as a number, not hidden.
 *   · The vector layer is one row per CHUNK, so its count is not comparable to sections. What is asserted is
 *     PRESENCE: compiled > 0 ⇒ chunks > 0 and vec > 0; compiled = 0 ⇒ both 0; and `chunks == vec`
 *     (they are written together). A ratio of chunks per compiled section is printed for each collection.
 *
 * Verdicts (one per collection, first match):
 *   ORPHANED-IN-INDEX     the database holds 0 compiled rows and an index layer still returns some. A user can
 *                         get a card with nothing behind it. (The C2/C3 purge's missing layer three.)
 *   PURGE-INCOMPLETE      the ledger says a layer is pending for this collection.
 *   NOT-IN-FTS / FTS-SHORT / FTS-EXCESS / NOT-IN-VECTOR / VEC-ORPHAN / CHUNKS-VEC-DISAGREE
 *   OK
 *
 * Scan completeness is asserted the same way `corpus-reachability.ts` does: a short scan is a silently
 * wrong table, so rows scanned must equal `countRows()` or the audit refuses to report.
 *
 * Usage (from scripts/ingest):  npx tsx search/audit-three-layer.ts
 * Writes docs/census/three-layer.json (with a completion marker written LAST).
 */
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from './lance'
import { VEC_TABLE, CHUNKS_TABLE } from './vector-common'
import { pendingLayers } from '../c2/purge-ledger'

const OUT = path.join(__dirname, '../../../docs/census/three-layer.json')

async function scanByCorpus(table: string): Promise<Map<string, number>> {
  const db = await connectLance()
  const t = await db.openTable(table)
  const expected = await t.countRows()
  const out = new Map<string, number>()
  let rows = 0
  const t0 = Date.now()
  for await (const batch of t.query().select(['corpus']) as any) {
    const c = batch.getChild('corpus')
    for (let i = 0; i < batch.numRows; i++) { const k = String(c.get(i) ?? ''); out.set(k, (out.get(k) ?? 0) + 1) }
    rows += batch.numRows
  }
  const total = [...out.values()].reduce((a, b) => a + b, 0)
  console.log(`[three-layer] ${table}: scanned ${rows.toLocaleString()} of ${expected.toLocaleString()} rows in ${((Date.now() - t0) / 1000).toFixed(0)}s, ${out.size} corpora`)
  if (rows !== expected || total !== expected) throw new Error(`${table} scan is short (countRows ${expected}, scanned ${rows}, aggregated ${total}) — refusing to report a partial matrix`)
  return out
}

async function main() {
  try { fs.unlinkSync(OUT) } catch { /* none */ }   // a stale marker must not survive a run that dies
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 600_000, query_timeout: 600_000 })
  console.log('HOST', new URL(process.env.NEON_DATABASE_URL!).host)
  const { rows: sec } = await pool.query<{ corpus: string; sections: string; compiled: string }>(
    `select corpus, count(*)::text sections, count(*) filter (where status='compiled')::text compiled from corpus_sections group by 1`)
  await pool.end()
  const neon = new Map(sec.map((r) => [r.corpus, { sections: +r.sections, compiled: +r.compiled }]))

  const fts = await scanByCorpus(FTS_TABLE)
  const chunks = await scanByCorpus(CHUNKS_TABLE)
  const vec = await scanByCorpus(VEC_TABLE)
  const pending = pendingLayers()

  const names = new Set<string>([...neon.keys(), ...fts.keys(), ...chunks.keys(), ...vec.keys()])
  const rows = [...names].sort().map((c) => {
    const n = neon.get(c) ?? { sections: 0, compiled: 0 }
    const f = fts.get(c) ?? 0, ch = chunks.get(c) ?? 0, v = vec.get(c) ?? 0
    const tol = Math.max(5, Math.ceil(0.005 * n.compiled))
    const pend = pending.filter((p) => p.collection === c)
    let verdict = 'OK', why = ''
    if (n.compiled === 0 && (f > 0 || ch > 0 || v > 0)) { verdict = 'ORPHANED-IN-INDEX'; why = `database holds ${n.sections} rows (${n.compiled} compiled); index returns fts ${f}, chunks ${ch}, vec ${v}` }
    else if (pend.length) { verdict = 'PURGE-INCOMPLETE'; why = `ledger: ${pend.map((p) => p.layer).join(', ')} pending (run ${pend[0].runId})` }
    else if (n.compiled > 0 && f === 0) { verdict = 'NOT-IN-FTS'; why = `${n.compiled} compiled rows, 0 in corpus_fts` }
    else if (f < n.compiled - tol) { verdict = 'FTS-SHORT'; why = `fts ${f} < compiled ${n.compiled} by ${n.compiled - f} (tolerance ${tol})` }
    else if (f > n.compiled + tol) { verdict = 'FTS-EXCESS'; why = `fts ${f} > compiled ${n.compiled} by ${f - n.compiled} (tolerance ${tol})` }
    else if (n.compiled > 0 && (ch === 0 || v === 0)) { verdict = 'NOT-IN-VECTOR'; why = `${n.compiled} compiled rows, chunks ${ch}, vec ${v}` }
    else if (n.compiled === 0 && (ch > 0 || v > 0)) { verdict = 'VEC-ORPHAN'; why = `chunks ${ch}, vec ${v} with nothing compiled` }
    else if (ch !== v) { verdict = 'CHUNKS-VEC-DISAGREE'; why = `chunks ${ch} vs vec ${v}` }
    return { collection: c, sections: n.sections, compiled: n.compiled, fts: f, chunks: ch, vec: v, chunksPerSection: n.compiled ? +(ch / n.compiled).toFixed(2) : null, tolerance: tol, verdict, why }
  })

  const bad = rows.filter((r) => r.verdict !== 'OK')
  const byVerdict = new Map<string, number>()
  for (const r of rows) byVerdict.set(r.verdict, (byVerdict.get(r.verdict) ?? 0) + 1)
  console.log(`\n${rows.length} collections; verdicts:`, [...byVerdict.entries()])
  console.log(bad.length === 0 ? 'ALL THREE LAYERS AGREE' : `❌ ${bad.length} collection(s) where the layers do not agree:`)
  for (const r of bad) console.log(`  ${r.verdict.padEnd(20)} ${r.collection.padEnd(30)} ${r.why}`)
  const tot = (k: 'sections' | 'compiled' | 'fts' | 'chunks' | 'vec') => rows.reduce((a, r) => a + r[k], 0)
  console.log(`\nTOTALS  sections ${tot('sections').toLocaleString()}  compiled ${tot('compiled').toLocaleString()}  fts ${tot('fts').toLocaleString()}  chunks ${tot('chunks').toLocaleString()}  vec ${tot('vec').toLocaleString()}`)

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  // completion marker LAST: its presence means the scans finished and the file is whole
  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), complete: true, scans: { fts: FTS_TABLE, chunks: CHUNKS_TABLE, vec: VEC_TABLE }, pass: bad.length === 0, failing: bad.map((r) => r.collection), rows }, null, 1))
  console.log('wrote', OUT)
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
