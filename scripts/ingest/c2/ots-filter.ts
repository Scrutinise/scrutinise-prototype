/**
 * ots-filter.ts — LANE A. `ots-reports` is a FILTER, not a purge.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A USER WOULD HAVE SEEN
 * Ask about tax simplification and get back a gov.uk page for signing in to manage a student loan
 * balance, an algorithmic-transparency record for a pension calculator, or the Welsh investment
 * zones technical document — each presented as an Office of Tax Simplification report.
 *
 * WHY — AND THIS IS NOT WHAT THE BRIEF SAYS IT IS. The brief describes `ots-reports` as "roughly
 * 14% contaminated: at least 69 of 497 rows are news stories and speeches, and the other ~428 are
 * real OTS reports". Read the seeder and that framing does not survive:
 *
 *     sources/gov-scraper.ts:176
 *     yield* searchGovUk('office of tax simplification report', 'ots-reports', 500)
 *
 * It is a FREE-TEXT RELEVANCE SEARCH with no publisher filter, capped at 500. Measured 24 Aug 2026:
 * that query reports **total: 347,938**. We took the first 500 of 347,938 gov.uk pages ranked by
 * relevance to a phrase. Results 481–485 are *Spring Budget 2017: documents*, *Summer Budget 2015*
 * and *Notices made under The Customs (Import Duty) (EU Exit) Regulations 2018*. There is no
 * category of contamination to remove — relevance decays continuously, so the only question is
 * where the cut falls, and a cut has to come from outside the query.
 *
 * ⚠ `document_type` CANNOT MAKE THAT CUT, and the brief anticipated this ("if the type field does
 * not cleanly separate them, read ten bodies before writing the rule"). Measured: the genuine OTS
 * output is `policy_paper` and `corporate_report` — and so is *Spring Budget 2017: documents*. The
 * types overlap completely.
 *
 * ── THE INSTRUMENT THAT DOES WORK: WHO PUBLISHED IT ─────────────────────────────────────────────
 * gov.uk records the publishing organisation on every document.
 * `filter_organisations=office-of-tax-simplification` returns **222** documents — the whole OTS
 * output, from a field the publisher maintains rather than one we inferred. That is the universe
 * this collection was always meant to be.
 *
 * ⚠ The collection page `source-audit.ts` has been checking since V1 —
 * `/government/collections/office-of-tax-simplification-reports` — **404s on the content API.**
 * The audit reads the HTML URL and asserts `minSize: 5000`, which a gov.uk 404 page satisfies. A
 * size floor is not an existence check.
 *
 * ── HOW A ROW IS CLASSIFIED ─────────────────────────────────────────────────────────────────────
 *   KEEP    the content API lists `office-of-tax-simplification` among the document's
 *           organisations (or among `links.organisations` / `links.primary_publishing_organisation`)
 *   DELETE  it does not
 *   HOLD    the content API 404s, errors, or the URL is not a gov.uk content path — NOT deleted.
 *           An unreadable row is an unknown, and deleting unknowns is how 428 genuine documents
 *           would go with the rest.
 *
 * Ten bodies are read and printed before any rule is applied — `--read-ten`, run first and its
 * output quoted in the report, because "the URL test was wrong one time in seven".
 *
 * ⚠ WRITES INCREMENTALLY. The classification is appended to a JSONL as each row is decided, so a
 * crash on request 496 does not lose the other 495 (`l2-measure.ts` lost a whole run to a single
 * writeFileSync at the end).
 *
 * Usage:
 *   tsx c2/ots-filter.ts --read-ten            # read ten bodies, apply no rule
 *   tsx c2/ots-filter.ts --classify            # fetch + classify all 497, write JSONL, no deletes
 *   tsx c2/ots-filter.ts --report              # summarise the JSONL
 *   tsx c2/ots-filter.ts --apply               # DRY RUN of the delete, all three layers
 *   tsx c2/ots-filter.ts --apply --execute     # perform it
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from './db'

const MODE = process.argv.find((a) => ['--read-ten', '--classify', '--report', '--apply'].includes(a)) ?? '--report'
const UA = 'ScrutiniseBot/1.0 (+https://www.scrutinise.org)'
const OTS_ORG = 'office-of-tax-simplification'
const CONC = 4
const argVal = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] || null

/**
 * ⚠ ONE OUTPUT PATH PER RUN. The first version of this file wrote every classification to
 * `C3_ots_classification.jsonl` and truncated it on each run, so re-classifying destroyed the
 * evidence the previous verdict rested on — the "never share an output path between two runs" rule,
 * broken by the script that exists to make a 421-row delete safe.
 *
 * Each `--classify` now writes `C3_ots_classification.<stamp>.jsonl`; `--report` and `--apply` read
 * the NEWEST unless `--jsonl=` names one. The 24 Aug 01:45 run keeps its own filename.
 */
const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const newJsonlPath = () => path.join(OUT, `C3_ots_classification.${STAMP}.jsonl`)
function latestJsonl(): string | null {
  const named = argVal('jsonl')
  if (named) return path.isAbsolute(named) ? named : path.join(OUT, named)
  const cands = fs.readdirSync(OUT)
    .filter((f) => /^C3_ots_classification\..*\.jsonl$/.test(f) || f === 'C3_ots_classification.jsonl')
    .map((f) => ({ f, m: fs.statSync(path.join(OUT, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m)
  return cands.length ? path.join(OUT, cands[0].f) : null
}
const n = (x: number) => x.toLocaleString('en-GB')

interface Row { id: string; sourceUrl: string | null; wordCount: number | null; r2Key: string | null }
interface Verdict {
  id: string; url: string | null; basePath: string | null
  status: number | null; title: string | null; documentType: string | null
  orgs: string[]; verdict: 'KEEP' | 'DELETE' | 'HOLD'; reason: string
}

function basePathOf(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname !== 'www.gov.uk' && u.hostname !== 'gov.uk') return null
    return u.pathname
  } catch { return null }
}

async function classifyOne(r: Row): Promise<Verdict> {
  const bp = basePathOf(r.sourceUrl)
  if (!bp) {
    return { id: r.id, url: r.sourceUrl, basePath: null, status: null, title: null, documentType: null,
      orgs: [], verdict: 'HOLD', reason: 'sourceUrl is not a gov.uk content path — cannot be classified, so it is not deleted' }
  }
  let res: Response
  try {
    res = await fetch(`https://www.gov.uk/api/content${bp}`, { headers: { 'User-Agent': UA } })
  } catch (e: any) {
    return { id: r.id, url: r.sourceUrl, basePath: bp, status: null, title: null, documentType: null,
      orgs: [], verdict: 'HOLD', reason: `content API unreachable (${e.message}) — unknown, not deleted` }
  }
  if (!res.ok) {
    return { id: r.id, url: r.sourceUrl, basePath: bp, status: res.status, title: null, documentType: null,
      orgs: [], verdict: 'HOLD', reason: `content API HTTP ${res.status} — unknown, not deleted` }
  }
  const d = await res.json() as any
  const links = d.links ?? {}
  const orgSets = [links.organisations, links.primary_publishing_organisation, links.original_primary_publishing_organisation, links.worldwide_organisations]
  const orgs = [...new Set(orgSets.flat().filter(Boolean).map((o: any) => String(o.base_path ?? '').replace('/government/organisations/', '')))].filter(Boolean) as string[]
  const isOts = orgs.includes(OTS_ORG)
  return {
    id: r.id, url: r.sourceUrl, basePath: bp, status: res.status,
    title: d.title ?? null, documentType: d.document_type ?? null, orgs,
    verdict: isOts ? 'KEEP' : 'DELETE',
    reason: isOts
      ? `published by ${OTS_ORG}`
      : `published by ${orgs.length ? orgs.join(', ') : '(no organisation recorded)'} — not the OTS`,
  }
}

async function readTen() {
  const p = pool()
  const { r2Get } = await import('../shared/r2-client')
  const rows: Row[] = (await p.query(
    `SELECT id, "sourceUrl", "wordCount", "r2Key" FROM corpus_sections
      WHERE corpus='ots-reports' AND "r2Key" IS NOT NULL ORDER BY md5(id) LIMIT 10`)).rows
  console.log('=== TEN BODIES, READ BEFORE ANY RULE WAS WRITTEN ===')
  console.log('(deterministic sample: ORDER BY md5(id) LIMIT 10 — reproducible, not cherry-picked)\n')
  for (const r of rows) {
    const v = await classifyOne(r)
    let body = ''
    try { body = (await r2Get(r.r2Key!)) ?? '' } catch (e: any) { body = `(r2 read failed: ${e.message})` }
    console.log(`── ${r.id}`)
    console.log(`   url          ${r.sourceUrl}`)
    console.log(`   title        ${v.title}`)
    console.log(`   document_type ${v.documentType}`)
    console.log(`   organisations ${v.orgs.join(', ') || '(none)'}`)
    console.log(`   words        ${r.wordCount}`)
    console.log(`   opening 260  ${body.replace(/\s+/g, ' ').slice(0, 260)}`)
    console.log(`   → ${v.verdict}: ${v.reason}\n`)
  }
  await p.end()
}

async function classify() {
  const p = pool()
  const rows: Row[] = (await p.query(
    `SELECT id, "sourceUrl", "wordCount", "r2Key" FROM corpus_sections WHERE corpus='ots-reports' ORDER BY id`)).rows
  const jsonl = newJsonlPath()
  console.log(`classifying ${n(rows.length)} rows against the gov.uk content API (concurrency ${CONC})`)
  console.log(`  → ${path.relative(process.cwd(), jsonl)}   (this run's own file; no earlier run is overwritten)`)
  const stream = fs.createWriteStream(jsonl, { flags: 'a' })
  let done = 0
  const queue = [...rows]
  const workers = Array.from({ length: CONC }, async () => {
    for (;;) {
      const r = queue.shift()
      if (!r) return
      const v = await classifyOne(r)
      stream.write(JSON.stringify(v) + '\n')        // written as decided, not at the end
      done++
      if (done % 25 === 0) process.stdout.write(`\r  ${done}/${rows.length}…   `)
    }
  })
  await Promise.all(workers)
  stream.end()
  process.stdout.write('\n')
  await p.end()
  await report(jsonl)
}

async function report(explicit?: string) {
  const JSONL = explicit ?? latestJsonl()
  if (!JSONL || !fs.existsSync(JSONL)) { console.error('no classification file in docs/census — run --classify first'); process.exit(1) }
  console.log(`reading ${path.relative(process.cwd(), JSONL)}  (modified ${fs.statSync(JSONL).mtime.toISOString()})`)
  const vs: Verdict[] = fs.readFileSync(JSONL, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const by = (v: string) => vs.filter((x) => x.verdict === v)
  console.log(`\n=== ots-reports, ${n(vs.length)} rows classified by PUBLISHER, not by document_type ===`)
  console.log(`  KEEP   ${n(by('KEEP').length)}   published by ${OTS_ORG}`)
  console.log(`  DELETE ${n(by('DELETE').length)}   published by somebody else`)
  console.log(`  HOLD   ${n(by('HOLD').length)}   unreadable — not deleted`)

  const types = new Map<string, { keep: number; del: number }>()
  for (const v of vs) {
    if (v.verdict === 'HOLD') continue
    const t = v.documentType ?? '(none)'
    const e = types.get(t) ?? { keep: 0, del: 0 }
    if (v.verdict === 'KEEP') e.keep++; else e.del++
    types.set(t, e)
  }
  console.log('\n── why document_type could not have been the rule (types carrying BOTH verdicts)')
  const both = [...types].filter(([, e]) => e.keep > 0 && e.del > 0).sort((a, b) => (b[1].keep + b[1].del) - (a[1].keep + a[1].del))
  if (both.length === 0) console.log('   none — document_type would in fact have separated them cleanly.')
  for (const [t, e] of both) console.log(`   ${t.padEnd(26)} KEEP ${String(e.keep).padStart(4)}   DELETE ${String(e.del).padStart(4)}`)

  const orgCount = new Map<string, number>()
  for (const v of by('DELETE')) for (const o of (v.orgs.length ? v.orgs : ['(no organisation recorded)'])) orgCount.set(o, (orgCount.get(o) ?? 0) + 1)
  console.log('\n── who actually published the rows being removed (top 12)')
  for (const [o, c] of [...orgCount].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`   ${String(c).padStart(4)}  ${o}`)

  console.log('\n── 10 of the rows being removed')
  for (const v of by('DELETE').slice(0, 10)) console.log(`   [${v.documentType}] ${v.title}\n        ${v.url}`)
  if (by('HOLD').length) {
    console.log('\n── every row HELD (unreadable, kept)')
    for (const v of by('HOLD')) console.log(`   ${v.reason}\n        ${v.url}`)
  }
  console.log(`\n${JSONL}`)
}

/**
 * apply() — THE DELETE, ACROSS ALL THREE LAYERS, IN ONE COMMAND.
 *
 * ⚠⚠ THE PREVIOUS VERSION ENDED BY PRINTING "INDEX LAYER NOT DONE HERE". That sentence is the
 * defect this sprint exists to remove, one layer along: rows gone from Postgres and still in
 * corpus_fts are still returned to users, now with nothing behind them. A step printed as
 * "not done here" is not a step. It now does the index layer, off the manifest this run wrote.
 *
 * ── THE GUARDS, IN ORDER ───────────────────────────────────────────────────────────────────────
 *   1. the classification must cover the collection EXACTLY as it stands now (stale list → abort)
 *   2. every full row is written to a manifest on disk BEFORE anything is destroyed — reinstatable
 *   3. the Lance predicate is COUNTED first, and a predicate matching zero rows ABORTS rather than
 *      deleting nothing and reporting success (the quoted-identifier trap, found 24 Aug)
 *   4. before/after counts on every layer, and a mismatch sets a non-zero exit
 *
 * ⚠ --dry-run is the default. --execute performs it.
 */
async function apply() {
  const EXECUTE = process.argv.includes('--execute')
  const JSONL = latestJsonl()
  if (!JSONL || !fs.existsSync(JSONL)) { console.error('no classification file in docs/census — run --classify first'); process.exit(1) }
  const ageH = (Date.now() - fs.statSync(JSONL).mtimeMs) / 3_600_000
  console.log(`classification: ${path.relative(process.cwd(), JSONL)}  (${ageH.toFixed(1)}h old)`)
  const vs: Verdict[] = fs.readFileSync(JSONL, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const del = vs.filter((v) => v.verdict === 'DELETE').map((v) => v.id)
  const held = vs.filter((v) => v.verdict === 'HOLD').length
  const p = pool()
  const live = (await p.query(`SELECT count(*)::int n FROM corpus_sections WHERE corpus='ots-reports'`)).rows[0].n
  if (live !== vs.length) {
    console.log(`⛔ ABORT — the collection holds ${n(live)} rows and the classification covers ${n(vs.length)}.`)
    console.log('   Re-classify; a stale verdict list must not drive a delete.')
    await p.end(); process.exit(1)
  }
  if (del.length === 0) {
    console.log('⛔ ABORT — the classification names 0 rows to delete. Nothing to do, and a delete of nothing')
    console.log('   that reported success is exactly what this sprint spent a session unpicking.')
    await p.end(); process.exit(1)
  }
  console.log(`\n${EXECUTE ? '⚠ EXECUTE' : 'DRY RUN'} — ${n(del.length)} DELETE · ${n(live - del.length - held)} KEEP · ${n(held)} HOLD (unreadable, never deleted)`)

  // ── layer 0: the manifest, written BEFORE anything is destroyed
  const backupDir = path.join(__dirname, 'purge-manifests')
  fs.mkdirSync(backupDir, { recursive: true })
  const backup = path.join(backupDir, `ots-reports.${STAMP}.json`)
  const idsFile = path.join(backupDir, `ots-reports.${STAMP}.ids.txt`)
  const rows = (await p.query(`SELECT * FROM corpus_sections WHERE id = ANY($1)`, [del])).rows
  fs.writeFileSync(backup, JSON.stringify({ generated: new Date().toISOString(), classification: path.basename(JSONL), count: rows.length, rows }))
  fs.writeFileSync(idsFile, del.join('\n'))
  console.log(`  manifest (full rows, reinstatable): ${path.relative(process.cwd(), backup)}`)
  console.log(`  ids:                                ${path.relative(process.cwd(), idsFile)}`)
  if (rows.length !== del.length) {
    console.log(`⛔ ABORT — asked for ${n(del.length)} rows, read back ${n(rows.length)}. The manifest would be incomplete.`)
    await p.end(); process.exit(1)
  }

  // ── layer 1: Neon
  let after = live
  if (EXECUTE) {
    const r = await p.query(`DELETE FROM corpus_sections WHERE id = ANY($1)`, [del])
    after = (await p.query(`SELECT count(*)::int n FROM corpus_sections WHERE corpus='ots-reports'`)).rows[0].n
    const ok = after === live - del.length
    console.log(`  corpus_sections: deleted ${n(r.rowCount ?? 0)}; ${n(live)} → ${n(after)}  ${ok ? '✓' : '⚠ MISMATCH'}`)
    if (!ok) process.exitCode = 1
  } else {
    console.log(`  corpus_sections: would delete ${n(del.length)}; ${n(live)} → ${n(live - del.length)}`)
  }
  await p.end()

  // ── layers 2 and 3: the SERVING index, off the manifest this run just wrote
  await purgeIndex(del, EXECUTE)

  console.log('\n⚠ NOTHING ABOVE HAS REACHED A USER YET. `fts-serve` and `vector-serve` open their Lance')
  console.log('  tables once at boot. Redeploy both (staggered) before believing any probe.')
  console.log('⚠ This moves BM25 document frequencies. Any recall baseline taken before it is void across it.')
}

/**
 * The index layer. Keyed off the id list this run wrote — never off a fresh query, or the two
 * layers can drift the moment the database changes between them.
 *
 * ⚠ THE COLUMN NAME IS NOT QUOTED, AND THAT IS LOAD-BEARING. LanceDB's DataFusion parser accepts
 * `"id" = 'x'`, matches NOTHING, raises nothing, and is ~70× faster because it prunes every
 * fragment. A delete written that way removes 0 rows and reports success. Count first; abort on a
 * zero match. (Found 24 Aug 2026 in `l2-purge-index.ts`, one dry run before it would have shipped.)
 */
async function purgeIndex(ids: string[], execute: boolean) {
  const { connectLance, FTS_TABLE } = await import('../search/lance')
  const { VEC_TABLE, CHUNKS_TABLE } = await import('../search/vector-common')
  const esc = (x: string) => x.replace(/'/g, "''")
  const inList = (col: string, batch: string[]) => `${col} IN (${batch.map((i) => `'${esc(i)}'`).join(',')})`
  const batches: string[][] = []
  for (let i = 0; i < ids.length; i += 2000) batches.push(ids.slice(i, i + 2000))

  const db = await connectLance()
  for (const [table, key] of [[FTS_TABLE, 'id'], [CHUNKS_TABLE, 'sectionId'], [VEC_TABLE, 'sectionId']] as [string, string][]) {
    const tbl = await db.openTable(table)
    const before = await tbl.countRows()
    const corpusHere = await tbl.countRows(`corpus = 'ots-reports'`)
    let present = 0
    for (const b of batches) present += await tbl.countRows(inList(key, b))
    console.log(`\n── ${table}: ${n(before)} rows; ots-reports holds ${n(corpusHere)}; ${n(present)} of the ${n(ids.length)} ids are here`)
    if (present === 0) {
      console.log(`   ⛔ ABORT — the predicate matched 0 of ${n(ids.length)} ids while the collection holds ${n(corpusHere)}`)
      console.log('      rows here. A delete on this predicate removes nothing and reports success.')
      process.exit(1)
    }
    if (!execute) { console.log(`   DRY RUN — would remove ${n(present)} rows.`); continue }
    for (const b of batches) await tbl.delete(inList(key, b))
    const after = await tbl.countRows()
    const removed = before - after
    const survivors = await tbl.countRows(`corpus = 'ots-reports'`)
    console.log(`   removed ${n(removed)}, expected ${n(present)}  ${removed === present ? '✓' : '⚠ MISMATCH'}`)
    console.log(`   ots-reports survivors here: ${n(survivors)}, expected ${n(corpusHere - present)}  ${survivors === corpusHere - present ? '✓' : '⚠ MISMATCH'}`)
    if (removed !== present || survivors !== corpusHere - present) process.exitCode = 1
  }
}

async function main() {
  if (MODE === '--read-ten') return readTen()
  if (MODE === '--classify') return classify()
  if (MODE === '--apply') return apply()
  return report()
}
main().catch((e) => { console.error('FAIL', e); process.exit(1) })
