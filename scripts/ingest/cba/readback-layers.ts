/**
 * readback-layers.ts — BRIEF_INGEST_CBA_1_EXECUTE §2: the THREE-LAYER CHECK, NAMED PER COLLECTION, for the Pilot A documents
 * (the 468 rows of 14 Nov), plus the live serves. A number in the database has not reached a user until the index carries it AND
 * the index has been read back.
 *
 * Layers per document (parentDocId): corpus_sections (status=compiled) · corpus_fts (id) · corpus_vec + corpus_chunks (sectionId),
 * counted by explicit id list — never by a quoted-column predicate, which matches nothing and returns success
 * (project-lance-predicate-quoting); the quoted form is counted beside it as a visible control.
 * Live serves: for every key Lex's engine prints, a scoped query must return that section from fts-serve AND vector-serve; a
 * retired decision-324 row, scoped the same way, must NOT come back (the control that the serve can say no).
 *
 *   npx tsx cba/readback-layers.ts       → docs/ingest_traces/cba1x_three_layer-<date>.json
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from '../search/lance'
import { VEC_TABLE, CHUNKS_TABLE } from '../search/vector-common'
import { r2Get } from '../shared/r2-client'

const ROOT = path.join(__dirname, '../../..')
const FTS_URL = 'https://fts-serve-production.up.railway.app'
const VEC_URL = 'https://vector-serve-production.up.railway.app'
const RETIRED = 'govuk-core-docs:government/publications/the-green-book-appraisal-and-evaluation-in-central-government:1' // decision 324
const TOLERANCE = 'FTS: exactly one row per section. Vector: every section has ≥1 vector row and ≥1 chunk; chunks may exceed sections (long sections split).'

const esc = (s: string) => s.replace(/'/g, "''")
const inList = (col: string, ids: string[]) => `${col} IN (${ids.map((i) => `'${esc(i)}'`).join(',')})`
async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90_000) })
  const t = await r.text()
  try { return { status: r.status, json: JSON.parse(t) } } catch { return { status: r.status, json: { raw: t.slice(0, 200) } } }
}
const hitIds = (j: any): string[] => (Array.isArray(j) ? j : j?.results ?? j?.hits ?? []).map((h: any) => h.id ?? h.sectionId).filter(Boolean)

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/manifests/cba-citation-manifest.json'), 'utf8'))
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 })
  if (!new URL(process.env.NEON_DATABASE_URL!).host.includes('ep-old-dust-aboxi69a')) throw new Error('NEON_DATABASE_URL is not production')
  const conn = await connectLance()
  const fts = await conn.openTable(FTS_TABLE), vec = await conn.openTable(VEC_TABLE), chunks = await conn.openTable(CHUNKS_TABLE)
  let fail = 0, ran = 0, ctrls = 0, dead = 0
  const ok = (n: string, c: boolean, s: string) => { ran++; if (!c) fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n} — ${s}`) }
  const ctrl = (n: string, c: boolean, s: string) => { ctrls++; if (!c) dead++; console.log(`${c ? 'CTRL fired' : 'CTRL DEAD '}  ${n} — ${s}`) }
  const out: any = { at: new Date().toISOString(), tolerance: TOLERANCE, collections: [] }

  for (const d of manifest.documents as Array<{ prefix: string; parentDocId: string }>) {
    const ids: string[] = (await pool.query(`SELECT id FROM corpus_sections WHERE corpus='govuk-core-docs' AND "parentDocId"=$1 AND status='compiled' ORDER BY id`, [d.parentDocId])).rows.map((r) => r.id)
    const count = async (t: any, col: string) => {
      let total = 0; const per = new Map<string, number>()
      for (let i = 0; i < ids.length; i += 100) {
        const part = ids.slice(i, i + 100)
        const rows: any[] = await t.query().where(inList(col, part)).select([col]).toArray()
        for (const r of rows) per.set(r[col], (per.get(r[col]) ?? 0) + 1)
        total += rows.length
      }
      return { total, missing: ids.filter((x) => !per.has(x)).length, dupes: [...per.values()].filter((n) => n > 1).length }
    }
    const f = await count(fts, 'id'), v = await count(vec, 'sectionId'), c = await count(chunks, 'sectionId')
    const quoted = await fts.countRows(`"id" IN ('${esc(ids[0])}')`)
    const row = { collection: d.prefix, parentDocId: d.parentDocId, corpus_sections: ids.length, corpus_fts: f, corpus_vec: v, corpus_chunks: c, quotedFormControl: quoted }
    out.collections.push(row)
    ok(`${d.prefix}: corpus_fts carries every section exactly once`, f.missing === 0 && f.dupes === 0 && f.total === ids.length, `sections ${ids.length}, fts ${f.total}, missing ${f.missing}, duplicated ${f.dupes}`)
    ok(`${d.prefix}: corpus_vec and corpus_chunks carry every section`, v.missing === 0 && c.missing === 0, `vec ${v.total} (missing ${v.missing}), chunks ${c.total} (missing ${c.missing})`)
    ctrl(`${d.prefix}: the quoted-column predicate form matches nothing (why ids are listed unquoted)`, quoted === 0, `"id" IN (first id) → ${quoted}`)
  }

  // Live serves: each engine-printed key must be retrievable by a scoped query on both serves.
  const ENGINE = ['gb-discounting:2.1', 'gb-discounting:3.8', 'gb-discounting:3.9', 'gb-discounting:3.10', 'green-book:6.58', 'green-book:8.58', 'green-book:6.77', 'gb-optimism-bias:3.11', 'gb-optimism-bias:3.12', 'gb-optimism-bias:3.6']
  const byKey = new Map((manifest.keys as Array<{ key: string; id: string }>).map((k) => [k.key, k.id]))
  out.serves = []
  for (const key of ENGINE) {
    const id = byKey.get(key)!
    const r2Key = (await pool.query(`SELECT "r2Key" FROM corpus_sections WHERE id=$1`, [id])).rows[0].r2Key
    const words = ((await r2Get(r2Key)) ?? '').replace(/[^A-Za-z ]+/g, ' ').split(/\s+/).filter((w) => w.length > 4).slice(0, 8).join(' ')
    const fr = await post(`${FTS_URL}/fts-search`, { query: words, ids: [id, RETIRED], limit: 10 })
    const vr = await post(`${VEC_URL}/vector-search`, { query: words, sectionIds: [id, RETIRED], limit: 10, noCache: true })
    const fi = hitIds(fr.json), vi = hitIds(vr.json)
    out.serves.push({ key, id, query: words, fts: { status: fr.status, hit: fi.includes(id), retired: fi.includes(RETIRED) }, vec: { status: vr.status, hit: vi.includes(id), retired: vi.includes(RETIRED) } })
    ok(`${key}: live fts-serve AND vector-serve return ${id.split(':').pop()} for a scoped query`, fi.includes(id) && vi.includes(id), `fts ${fr.status} ${fi.length} hits, vector ${vr.status} ${vi.length} hits; query "${words.slice(0, 50)}"`)
  }
  const retiredSeen = out.serves.filter((s: any) => s.fts.retired || s.vec.retired).length
  ctrl('the retired decision-324 row, scoped into every one of those queries, came back from neither serve', retiredSeen === 0, `${retiredSeen} of ${ENGINE.length} queries returned it`)

  const file = path.join(ROOT, `docs/ingest_traces/cba1x_three_layer-${out.at.slice(0, 10)}.json`)
  fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n')
  console.log(`\nWROTE ${path.relative(ROOT, file)}\n${ran} ran, ${ran - fail} passed, ${fail} failed; ${ctrls} controls, ${dead} dead`)
  if (fail || dead) process.exitCode = 1
  await pool.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
