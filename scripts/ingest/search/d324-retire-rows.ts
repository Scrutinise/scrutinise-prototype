/**
 * d324-retire-rows.ts — Decision 324 (Charlie, 4 Nov 2026): take five govuk-core-docs rows out of
 * the keyword index (corpus_fts) and the vector index (corpus_vec + corpus_chunks). The rows are
 * NOT deleted from corpus_sections and their R2 text is NOT touched — each is given a state and a
 * reason, and three different cases get three different states:
 *
 *   old Green Book path (2)   superseded       — the Feb 2026 edition, replaced by the-green-book--2.
 *                                                Valid guidance until 28 Oct. ⚠ NOT a duplicate of the
 *                                                October rows: a different, renumbered edition that still
 *                                                carries the 3.5% / 1.5% rates. Kept so a costing that cited
 *                                                it can be shown what it said.
 *   Bank of China paper (2)   withdrawn        — gov.uk withdrew it (content API: gone). Publisher action.
 *   old Aqua Book marker (1)  ingest-artefact  — a row a redirect made, holding no text. Ours.
 *
 * The house convention (process-row.ts 'superseded', v36-retract-placeholders.ts 'revoked'):
 * status='unavailable' takes a row out of every index builder (build-fts-index, fts-catchup,
 * fts-refresh, build-corpus-chunks, vec-replace all select status='compiled'), so a later rebuild
 * cannot quietly put it back; availability_status is the state; availability_note is the reason.
 *
 * ⚠⚠ THE DELETE REPORTING SUCCESS IS NOT EVIDENCE. A double-quoted column in a Lance predicate
 * matches nothing, raises nothing and returns normally (project-lance-predicate-quoting). So every
 * predicate here is COUNTED before it is acted on, the quoted form is counted beside it as a visible
 * control, a live control id must survive, and `readback` is run before and after — on the Lance
 * tables AND on the two running serves, which hold a boot snapshot until restarted.
 *
 *   npx tsx search/d324-retire-rows.ts readback --label=before
 *   npx tsx search/d324-retire-rows.ts apply            # dry run: prints the plan
 *   npx tsx search/d324-retire-rows.ts apply --apply
 *   (restart both serves with v33-restart-serve.ts)
 *   npx tsx search/d324-retire-rows.ts readback --label=after
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from './lance'
import { VEC_TABLE, CHUNKS_TABLE } from './vector-common'
import { r2Put, r2List } from '../shared/r2-client'

const CMD = process.argv[2] ?? 'readback'
const APPLY = process.argv.includes('--apply')
const LABEL = (process.argv.find((a) => a.startsWith('--label=')) ?? '--label=adhoc').split('=')[1]
const FTS_URL = 'https://fts-serve-production.up.railway.app'
const VEC_URL = 'https://vector-serve-production.up.railway.app'
const EXPECT_HOST = 'ep-old-dust-aboxi69a'
const TRACE_DIR = path.join(__dirname, '../../../docs/ingest_traces')

const GB_OLD = 'govuk-core-docs:government/publications/the-green-book-appraisal-and-evaluation-in-central-government'
const BOC = 'govuk-core-docs:government/publications/white-paper-of-bank-of-china-on-cross-border-e-commerce-service'
const AQUA_OLD = 'govuk-core-docs:government/publications/the-aqua-book-guidance-on-producing-quality-analysis-for-government'
const GB_NEW_DOC = 'government/publications/the-green-book--2'

const GB_NOTE =
  `superseded_by=govuk-core-docs:${GB_NEW_DOC} (https://www.gov.uk/${GB_NEW_DOC}). ` +
  'The February 2026 edition, replaced by the October 2026 edition; valid guidance until 28 Oct 2026, not withdrawn. ' +
  'NOT a duplicate of the October rows: a different, renumbered edition that still carries the 3.5% discount rate and 1.5% health rate. ' +
  'Text kept so a costing that cited this edition can be shown what it said. Out of the search indexes by decision 324 (4 Nov 2026).'
const BOC_NOTE =
  'gov.uk withdrew the publication (content API returns gone). Publisher action. ' +
  'Text kept; out of the search indexes by decision 324 (4 Nov 2026).'
const AQUA_NOTE =
  'A row created by a gov.uk redirect, holding no document text. The Aqua Book itself is live and held: ' +
  'govuk-core-docs:guidance/the-aqua-book (79 sections). Neither withdrawn nor superseded: ours, not the publisher\'s. ' +
  'Out of the search indexes by decision 324 (4 Nov 2026).'

const ROWS: { id: string; state: string; note: string; query: string }[] = [
  { id: `${GB_OLD}:1`, state: 'superseded', note: GB_NOTE, query: 'Green Book appraisal evaluation central government' },
  { id: `${GB_OLD}:2`, state: 'superseded', note: GB_NOTE, query: 'Green Book appraisal evaluation central government' },
  { id: `${BOC}:1`, state: 'withdrawn', note: BOC_NOTE, query: 'Bank of China cross-border e-commerce' },
  { id: `${BOC}:2`, state: 'withdrawn', note: BOC_NOTE, query: 'Bank of China cross-border e-commerce' },
  { id: `${AQUA_OLD}:1`, state: 'ingest-artefact', note: AQUA_NOTE, query: 'Aqua Book quality analysis government' },
]
const IDS = ROWS.map((r) => r.id)
/** A live row that must be present before AND after — proves the predicate form can match. */
const CONTROL = `govuk-core-docs:${GB_NEW_DOC}:1`

const esc = (s: string) => s.replace(/'/g, "''")
const inList = (col: string, ids: string[]) => `${col} IN (${ids.map((i) => `'${esc(i)}'`).join(',')})`
const quotedInList = (col: string, ids: string[]) => `"${col}" IN (${ids.map((i) => `'${esc(i)}'`).join(',')})`
const log = (m: string) => console.log(`[d324] ${m}`)

function pool(): Pool {
  return new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 })
}

async function lanceCounts() {
  const conn = await connectLance()
  const out: Record<string, unknown> = {}
  for (const [name, col] of [[FTS_TABLE, 'id'], [VEC_TABLE, 'sectionId'], [CHUNKS_TABLE, 'sectionId']] as const) {
    const t = await conn.openTable(name)
    const per: Record<string, number> = {}
    for (const id of IDS) per[id] = await t.countRows(inList(col, [id]))
    const control = await t.countRows(inList(col, [CONTROL]))
    const quotedControl = await t.countRows(quotedInList(col, [CONTROL]))
    const total = await t.countRows()
    out[name] = { column: col, total, perId: per, targetRows: Object.values(per).reduce((a, b) => a + b, 0), control, quotedFormControl: quotedControl }
    log(`${name}.${col}: total=${total.toLocaleString()} target=${JSON.stringify(per)} control=${control} quoted-form(control)=${quotedControl}`)
  }
  return out
}

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90_000) })
  const text = await r.text()
  try { return { status: r.status, json: JSON.parse(text) } } catch { return { status: r.status, json: { raw: text.slice(0, 300) } } }
}
const hitIds = (j: any): string[] => {
  const arr = Array.isArray(j) ? j : j?.results ?? j?.hits ?? []
  return arr.map((h: any) => h.id ?? h.sectionId).filter(Boolean)
}

async function serveCounts() {
  const out: Record<string, unknown> = {}
  const stats = async (u: string) => { try { return await (await fetch(`${u}/stats`, { signal: AbortSignal.timeout(15000) })).json() } catch { return null } }
  out.ftsStartedAt = (await stats(FTS_URL))?.started_at ?? null
  out.vecStartedAt = (await stats(VEC_URL))?.started_at ?? null
  log(`serves started_at: fts ${out.ftsStartedAt}  vector ${out.vecStartedAt}`)
  const queries = [...new Set(ROWS.map((r) => r.query))]
  const scope = [...IDS, CONTROL]
  const fts: any[] = [], vec: any[] = []
  for (const q of queries) {
    const f = await post(`${FTS_URL}/fts-search`, { query: q, ids: scope, limit: 20 })
    const fi = hitIds(f.json)
    fts.push({ query: q, status: f.status, targets: fi.filter((i) => IDS.includes(i)), control: fi.includes(CONTROL), all: fi })
    log(`fts-serve    "${q}" → ${f.status} targets=${JSON.stringify(fi.filter((i) => IDS.includes(i)))} control=${fi.includes(CONTROL)}`)
    const v = await post(`${VEC_URL}/vector-search`, { query: q, sectionIds: scope, limit: 20, noCache: true })
    const vi = hitIds(v.json)
    vec.push({ query: q, status: v.status, targets: vi.filter((i) => IDS.includes(i)), control: vi.includes(CONTROL), all: vi })
    log(`vector-serve "${q}" → ${v.status} targets=${JSON.stringify(vi.filter((i) => IDS.includes(i)))} control=${vi.includes(CONTROL)}`)
    if (f.status !== 200 || v.status !== 200) log(`  ⚠ non-200: fts ${JSON.stringify(f.json).slice(0, 200)} | vec ${JSON.stringify(v.json).slice(0, 200)}`)
  }
  out.fts = fts; out.vec = vec
  return out
}

async function dbRows(p: Pool) {
  const r = await p.query(`SELECT id, status, availability_status, availability_note, "r2Key", "wordCount" FROM corpus_sections WHERE id = ANY($1) ORDER BY id`, [IDS])
  for (const x of r.rows) log(`db ${x.id.replace('govuk-core-docs:government/publications/', '…')}: status=${x.status} state=${x.availability_status} r2Key=${x.r2Key ? 'yes' : 'none'} words=${x.wordCount ?? '-'} note=${(x.availability_note ?? '').slice(0, 70)}`)
  return r.rows
}

async function readback() {
  const p = pool()
  const host = new URL(process.env.NEON_DATABASE_URL!).host
  log(`db host ${host}`)
  const out = { label: LABEL, at: new Date().toISOString(), host, control: CONTROL, db: await dbRows(p), lance: await lanceCounts(), serves: await serveCounts() }
  await p.end()
  fs.writeFileSync(path.join(TRACE_DIR, `d324_readback_${LABEL}.json`), JSON.stringify(out, null, 2))
  log(`WROTE docs/ingest_traces/d324_readback_${LABEL}.json`)
}

async function apply() {
  const host = new URL(process.env.NEON_DATABASE_URL!).host
  if (!host.startsWith(EXPECT_HOST)) throw new Error(`db host ${host} is not ${EXPECT_HOST} — stop`)
  const p = pool()
  const before = await dbRows(p)
  if (before.length !== 5) throw new Error(`expected 5 corpus_sections rows, found ${before.length}`)
  const conn = await connectLance()
  const tables = [[FTS_TABLE, 'id'], [VEC_TABLE, 'sectionId'], [CHUNKS_TABLE, 'sectionId']] as const
  const plan: Record<string, number> = {}
  for (const [name, col] of tables) {
    const t = await conn.openTable(name)
    plan[name] = await t.countRows(inList(col, IDS))
    if ((await t.countRows(inList(col, [CONTROL]))) === 0) throw new Error(`control ${CONTROL} not found in ${name} — predicate form is suspect; stop`)
  }
  log(`plan: rows to remove ${JSON.stringify(plan)}; db rows to re-state: 5`)
  for (const r of ROWS) log(`  ${r.id.replace('govuk-core-docs:government/publications/', '…')} → status=unavailable, state=${r.state}`)
  if (!APPLY) { log('DRY RUN — re-run with --apply'); await p.end(); return }

  // 1. Safety export: the full index rows (FTS body; chunks body; vec without the vector) + the DB rows.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const prefix = `_search/hygiene-backup/d324-${stamp}/`
  const plain = (r: Record<string, unknown>, drop: string[] = []) => Object.fromEntries(Object.entries(r).filter(([k]) => !drop.includes(k)).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]))
  const keys: string[] = []
  for (const [name, col] of tables) {
    const t = await conn.openTable(name)
    const fields = (await t.schema()).fields.map((f) => f.name)
    const rows = (await t.query().where(inList(col, IDS)).select(fields).toArray()) as Record<string, unknown>[]
    const body = rows.map((r) => JSON.stringify(plain(r, name === VEC_TABLE ? ['vector'] : []))).join('\n')
    if (rows.length !== plan[name]) throw new Error(`${name}: exported ${rows.length} rows, counted ${plan[name]}`)
    const key = `${prefix}${name}.jsonl`
    await r2Put(key, body, 'application/x-ndjson'); keys.push(key)
  }
  const dbKey = `${prefix}corpus_sections.before.json`
  await r2Put(dbKey, JSON.stringify(before, null, 2), 'application/json'); keys.push(dbKey)
  const present = new Set(await r2List(prefix))
  const missing = keys.filter((k) => !present.has(k))
  if (missing.length) throw new Error(`safety export not in R2: ${missing.join(', ')}`)
  log(`safety export verified in R2: ${keys.length}/${keys.length} objects under ${prefix}`)

  // 2. The state, in one transaction. Each UPDATE must touch exactly one row.
  const c = await p.connect()
  try {
    await c.query('BEGIN')
    for (const r of ROWS) {
      const u = await c.query(`UPDATE corpus_sections SET status='unavailable', availability_status=$2, availability_note=$3 WHERE id=$1 AND corpus='govuk-core-docs'`, [r.id, r.state, r.note])
      if (u.rowCount !== 1) throw new Error(`UPDATE ${r.id} touched ${u.rowCount} rows`)
    }
    await c.query('COMMIT')
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
  log('db: 5 rows re-stated (committed)')

  // 3. Index deletes — counted before, counted after, totals reconciled, control must survive.
  for (const [name, col] of tables) {
    const t = await conn.openTable(name)
    const total0 = await t.countRows()
    const n = await t.countRows(inList(col, IDS))
    if (n === 0) { log(`${name}: 0 rows match — nothing to delete`); continue }
    await t.delete(inList(col, IDS))
    const left = await t.countRows(inList(col, IDS))
    const total1 = await t.countRows()
    const ctl = await t.countRows(inList(col, [CONTROL]))
    log(`${name}: matched ${n} → left ${left}; total ${total0.toLocaleString()} → ${total1.toLocaleString()} (Δ ${total0 - total1}); control ${ctl}`)
    if (left !== 0 || total0 - total1 !== n || ctl === 0) { process.exitCode = 1; log(`!! ${name} did not reconcile`) }
  }
  await dbRows(p)
  await p.end()
}

;(CMD === 'apply' ? apply() : readback()).catch((e) => { console.error('[d324] FATAL', e instanceof Error ? e.stack ?? e.message : e); process.exit(1) })
