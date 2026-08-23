/**
 * embed-census.ts — HOW MUCH OF EACH COLLECTION IS ACTUALLY EMBEDDED, per collection, no sampling.
 *
 * WHY IT EXISTS. `CORPUS_COMPLETENESS.md` answers "does the collection hold what its publisher
 * publishes?" and `CORPUS_REACHABILITY.md` answers "can a query select it?". Neither says how much
 * of what we hold has a VECTOR — and a section with no vector is invisible to the meaning-based
 * half of retrieval no matter how complete the collection is. That is the third column, and it has
 * never been taken per collection.
 *
 * ⚠ SECTIONS, NOT CHUNKS. A section is embedded iff its chunk 0 exists: `chunkId` is
 * `${sectionId}#${k}` with k starting at 0 (build-corpus-chunks.ts), so counting rows whose
 * chunkId ends `#0` counts DISTINCT SECTIONS exactly, in one streaming pass, with no 18M-entry Set.
 * Chunk totals are reported beside them because the two answer different questions.
 *
 * ⚠ THE SCAN MUST BE WHOLE OR IT IS NOTHING (the S12 §6 rule). A short scan under-counts every
 * collection at once, which reads as "everything shrank"; this asserts scanned == countRows() and
 * refuses to report a partial read.
 *
 * `corpus_vec` is the embedded set — the vectors that exist. `corpus_chunks` is the manifest of
 * what was CUT for embedding. They should agree; where they do not, the delta is a collection that
 * was chunked and never embedded, which is exactly the state this is looking for.
 *
 * Usage:  npx tsx search/embed-census.ts [--out docs/embed_census.json]
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { connectLance } from './lance'
import { CHUNKS_TABLE, VEC_TABLE } from './vector-common'

const ARGS = process.argv.slice(2)
const OUT = (() => {
  const i = ARGS.indexOf('--out')
  return i >= 0 && ARGS[i + 1] ? ARGS[i + 1] : path.join(__dirname, '../../../docs/embed_census.json')
})()

const n = (v: number) => Number(v).toLocaleString('en-GB')

interface Tally { chunks: number; sections: number }

/** One streaming pass over two columns. Returns per-corpus chunk and section counts. */
async function tally(table: string): Promise<{ per: Record<string, Tally>; total: Tally }> {
  const db = await connectLance()
  const t = await db.openTable(table)
  const expected = await t.countRows()
  const per: Record<string, Tally> = {}
  const total: Tally = { chunks: 0, sections: 0 }
  let scanned = 0
  let lastLog = Date.now()
  for await (const b of t.query().select(['chunkId', 'corpus']) as any) {
    const cid = b.getChild('chunkId')
    const cor = b.getChild('corpus')
    for (let i = 0; i < b.numRows; i++) {
      const corpus = String(cor.get(i) ?? '')
      const row = (per[corpus] ??= { chunks: 0, sections: 0 })
      row.chunks++
      total.chunks++
      const id = String(cid.get(i) ?? '')
      if (id.endsWith('#0')) { row.sections++; total.sections++ }
    }
    scanned += b.numRows
    if (Date.now() - lastLog > 30_000) {
      console.log(`  … ${table} ${n(scanned)} / ${n(expected)} (${((100 * scanned) / expected).toFixed(1)}%)`)
      lastLog = Date.now()
    }
  }
  if (scanned !== expected) {
    throw new Error(`${table}: countRows()=${expected} but scanned ${scanned}. Refusing to report on a partial read.`)
  }
  console.log(`  ${table}: scanned ${n(scanned)} rows (100%), ${Object.keys(per).length} collections, ` +
    `${n(total.sections)} distinct sections`)
  return { per, total }
}

async function main() {
  console.log(`[embed-census] scanning ${VEC_TABLE} …`)
  const vec = await tally(VEC_TABLE)
  console.log(`[embed-census] scanning ${CHUNKS_TABLE} …`)
  const chunks = await tally(CHUNKS_TABLE)

  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 1,
    statement_timeout: 900_000, query_timeout: 900_000,
  })
  const { rows: held } = await pool.query(`
    SELECT corpus,
           count(*)::int AS rows,
           count(*) FILTER (WHERE status='compiled')::int AS compiled,
           count(*) FILTER (WHERE status='unavailable')::int AS unavailable,
           coalesce(sum("wordCount") FILTER (WHERE status='compiled'),0)::bigint AS words
      FROM corpus_sections GROUP BY 1`)
  const { rows: targets } = await pool.query(`
    SELECT corpus_key, display_label, est_sections, est_is_confirmed, retired, blocked
      FROM corpus_targets`)
  await pool.end()

  const keys = new Set<string>([
    ...held.map(h => h.corpus as string),
    ...Object.keys(vec.per), ...Object.keys(chunks.per),
    ...targets.filter(t => !t.retired).map(t => t.corpus_key as string),
  ])

  const out = [...keys].map(k => {
    const h = held.find(x => x.corpus === k)
    const t = targets.find(x => x.corpus_key === k)
    const compiled = h?.compiled ?? 0
    const embedded = vec.per[k]?.sections ?? 0
    return {
      corpus: k,
      label: t?.display_label ?? null,
      rows: h?.rows ?? 0,
      compiled,
      unavailable: h?.unavailable ?? 0,
      words: Number(h?.words ?? 0),
      chunked_sections: chunks.per[k]?.sections ?? 0,
      chunks: chunks.per[k]?.chunks ?? 0,
      embedded_sections: embedded,
      vectors: vec.per[k]?.chunks ?? 0,
      embedded_pct: compiled ? Number(((100 * embedded) / compiled).toFixed(1)) : null,
      est_sections: t?.est_sections ?? null,
      est_confirmed: t?.est_is_confirmed ?? false,
      in_targets: !!t,
      retired: !!t?.retired,
    }
  }).sort((a, b) => b.compiled - a.compiled)

  fs.writeFileSync(OUT, JSON.stringify({
    generated: new Date().toISOString(),
    tables: { vec: VEC_TABLE, chunks: CHUNKS_TABLE },
    totals: {
      compiled: out.reduce((s, r) => s + r.compiled, 0),
      embedded_sections: vec.total.sections,
      vectors: vec.total.chunks,
      chunked_sections: chunks.total.sections,
      chunks: chunks.total.chunks,
    },
    collections: out,
  }, null, 1))

  console.log(`\ncorpus                        compiled    embedded    %      vectors`)
  for (const r of out) {
    console.log(`${r.corpus.padEnd(28)} ${n(r.compiled).padStart(9)} ${n(r.embedded_sections).padStart(11)} ` +
      `${(r.embedded_pct ?? 0).toFixed(1).padStart(6)} ${n(r.vectors).padStart(12)}`)
  }
  console.log(`\n[embed-census] → ${OUT}`)
}

main().catch(e => { console.error(e); process.exitCode = 1 })
