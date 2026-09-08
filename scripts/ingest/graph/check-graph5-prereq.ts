/**
 * check-graph5-prereq.ts — BRIEF_GRAPH_5 §0. THE GATE, RE-MEASURED.
 *
 * ⚠⚠ WHY THIS RUNS BEFORE ANY EXTRACTOR IS WRITTEN.
 *
 * Until 20 August the stored body of a TNA judgment was the CSS stylesheet the generator emits in
 * `<meta><presentation><html:style>`, with the judgment underneath. A citation extractor run over
 * that would read formatting code, find few or no references, and report success. **The output of
 * that failure is a large, confident, EMPTY graph** — no error, no exception, just a coverage
 * finding that is really a bug. So the brief gates the sprint on re-confirming the repair against
 * live tables rather than against `INGEST_CASELAW_TEXT_REPORT.md`.
 *
 * ⚠ THE DETECTOR IS IMPORTED, NEVER RESTATED. `shared/style-detect.ts` and
 * `shared/akn-text.ts::checkJudgmentBody` are the instruments the August repair was measured with,
 * and `check-style-detect.ts` is their own watched-failing test. A re-implemented `isStylesheet()`
 * here would be a second copy of a predicate that has to agree with the first, which is the exact
 * shape of the regnal-year trap (four code paths, four half-fixes).
 *
 * ⚠ THREE SURFACES, REPORTED APART AND NEVER SUMMED. They were repaired by different work and
 * two of them can be clean while the third is not:
 *   A  corpus_sections (Neon)  — provenance + titles.               The August sprint fixed this.
 *   B  the stored BODY in R2   — what an extractor would read.      The August sprint fixed this.
 *   C  corpus_chunks (Lance)   — what the EMBEDDER read, chunk 0.   Left as Decision 1, ~$31,
 *                                                                   and NOT done in that sprint.
 * §0's claim is "77% to 0% across all 74,894 documents". That figure was measured on C. B is what
 * gates this sprint; C is reported because the brief asserts it.
 *
 * WRITES NOTHING. Exit 1 if the gate fails.
 *
 *   npx tsx graph/check-graph5-prereq.ts [--sweep=400] [--chunks=300]
 *   npx tsx graph/check-graph5-prereq.ts --self-test    # watch every assertion fail
 */
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'
import { checkJudgmentBody } from '../shared/akn-text'
import { styleChars, firstStyleOffset } from '../shared/style-detect'
import { connectLance } from '../search/lance'
import { CHUNKS_TABLE, chunkId } from '../search/vector-common'

const CORPUS = 'tna-caselaw'
const ROUTE = 'text-route:akn:judgment-minus-meta'
const arg = (n: string, d: number) =>
  parseInt(process.argv.find(a => a.startsWith(`--${n}=`))?.split('=')[1] ?? String(d), 10)
const SWEEP = arg('sweep', 400)
const CHUNK_SAMPLE = arg('chunks', 300)
const SELF_TEST = process.argv.includes('--self-test')

/** The head of a real TNA stylesheet body, verbatim from the August report's BEFORE column.
 *  Used ONLY by --self-test, to watch each assertion reject the state it exists to reject. */
const REAL_STYLESHEET_BODY =
  `UKSC 2019 41 [2019] UKSC 41 0.26.19 c08dfb9d3c7e45d2e018e52086a41ff4249f7ed00b927a18959e248d6d36f235 ` +
  `7.4.0 #judgment { font-family: 'Times New Roman'; font-size: 12pt; } #judgment .Normal { font-size: 12pt; } ` +
  `#judgment .Heading1 { font-family: 'Calibri Light'; font-size: 16pt; } #judgment .PageNumber { } ` +
  `#judgment .CoverDesc { text-align: center; font-weight: bold; } #judgment .FootnoteText { font-size: 10pt; } ` +
  `On appeals from: [2019] EWHC 2381 (QB) and [2019] CSIH 49 JUDGMENT `.repeat(3)

type Finding = { id: string; ok: boolean; what: string; measured: string }
const findings: Finding[] = []
const record = (id: string, ok: boolean, what: string, measured: string) => {
  findings.push({ id, ok, what, measured })
  console.log(`  ${ok ? '  ok' : 'FAIL'}  ${id.padEnd(28)} ${measured}`)
}
const pct = (a: number, b: number) => (b ? (100 * a) / b : 0)
const fpct = (a: number, b: number) => `${pct(a, b).toFixed(2)}%`

async function mapPool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i]) }
  }))
  return out
}

;(async () => {
  console.log(`\nGRAPH 5 §0 — THE PREREQUISITE, RE-MEASURED AGAINST LIVE STATE`)
  console.log(`  ${new Date().toISOString()}${SELF_TEST ? '   ⚠ SELF-TEST: every assertion should FAIL' : ''}\n`)

  // ── A — corpus_sections: provenance and titles ────────────────────────────
  console.log(`A. corpus_sections (Neon) — what the repair wrote`)
  const p = namesPool()
  const c = (await p.query(
    `SELECT COUNT(*)::int AS rows,
            COUNT(*) FILTER (WHERE notes LIKE '%' || $2 || '%')::int AS recompiled,
            COUNT(NULLIF(btrim(COALESCE("sectionTitle",'')),''))::int AS titled
       FROM corpus_sections WHERE corpus=$1`, [CORPUS, ROUTE])).rows[0]
  const rows = SELF_TEST ? c.rows : c.rows
  const recompiled = SELF_TEST ? 0 : c.recompiled
  const titled = SELF_TEST ? 0 : c.titled

  record('A1.documents', rows > 0, 'the collection is populated', `${rows.toLocaleString()} ${CORPUS} rows`)
  record('A2.recompiled', pct(recompiled, rows) >= 99.9, 'every row carries the new extractor\'s provenance',
    `${recompiled.toLocaleString()} carry ${ROUTE} — ${fpct(recompiled, rows)}`)
  record('A3.titled', pct(titled, rows) >= 99.9, 'titles recovered (§0 claims 99.98%)',
    `${titled.toLocaleString()} carry a sectionTitle — ${fpct(titled, rows)}`)

  // ── B — the stored BODY, read back out of R2. THIS IS THE GATE. ───────────
  console.log(`\nB. the stored BODY in R2 — what a citation extractor would actually read  [THE GATE]`)
  const sample = (await p.query(
    `SELECT id, "r2Key" FROM corpus_sections
      WHERE corpus=$1 AND "r2Key" IS NOT NULL
      ORDER BY md5(id || 'graph5') LIMIT $2`, [CORPUS, SWEEP])).rows

  let read = 0, opensWithStyle = 0, anyStyle = 0, bodyOk = 0, styleCharTotal = 0, charTotal = 0
  const shares: number[] = []
  const offenders: string[] = []
  await mapPool(sample, 24, async (r: { id: string; r2Key: string }) => {
    const raw = await r2Get(r.r2Key)
    if (raw == null) return
    // ⚠ --self-test substitutes the real BEFORE-state body. The assertions below are
    //   unchanged; only the bytes they read are. A control that edits the assertion
    //   tests the edit.
    const t = SELF_TEST ? REAL_STYLESHEET_BODY : raw
    read++
    const sc = styleChars(t)
    const off = firstStyleOffset(t)
    charTotal += t.length; styleCharTotal += sc
    shares.push(t.length ? sc / t.length : 0)
    if (sc > 0) anyStyle++
    if (off >= 0 && off < 400) { opensWithStyle++; if (offenders.length < 5) offenders.push(`${r.id} @${off}`) }
    if (checkJudgmentBody(t).ok) bodyOk++
  })
  shares.sort((a, b) => a - b)
  const median = shares.length ? shares[Math.floor(shares.length / 2)] : 0

  record('B0.readable', read > 0 && read >= sample.length * 0.98, 'the bodies could be read at all',
    `${read} of ${sample.length} bodies fetched from R2`)
  record('B1.opens-with-stylesheet', opensWithStyle === 0, '⚠⚠ no body opens with a CSS run — the §0 failure',
    `${opensWithStyle} of ${read} open with a stylesheet${offenders.length ? `  e.g. ${offenders.join(', ')}` : ''}`)
  record('B2.any-stylesheet', pct(anyStyle, read) <= 1, 'no body contains a CSS run anywhere',
    `${anyStyle} of ${read} contain any CSS run — ${fpct(anyStyle, read)}`)
  record('B3.style-share', styleCharTotal === 0, 'stylesheet characters as a share of stored text',
    `${styleCharTotal.toLocaleString()} of ${charTotal.toLocaleString()} chars — ${fpct(styleCharTotal, charTotal)} (median doc ${(100 * median).toFixed(2)}%)`)
  record('B4.is-judgment', pct(bodyOk, read) >= 99, 'checkJudgmentBody accepts the body as judgment text',
    `${bodyOk} of ${read} — ${fpct(bodyOk, read)}`)

  // ── C — corpus_chunks chunk 0, the surface §0's "77% → 0%" figure was measured on ──
  console.log(`\nC. corpus_chunks (Lance) chunk 0 — the surface the 77% figure was measured on`)
  let chunkVerdict: 'clean' | 'dirty' | 'not-checked' = 'not-checked'
  let chunkNote = ''
  try {
    const ids = (await p.query(
      `SELECT id FROM corpus_sections WHERE corpus=$1 AND "r2Key" IS NOT NULL
        ORDER BY md5(id || 'graph5chunk') LIMIT $2`, [CORPUS, CHUNK_SAMPLE])).rows.map((r: { id: string }) => r.id)
    const db = await connectLance()
    const tbl = await db.openTable(CHUNKS_TABLE)
    let found = 0, dirtyHalf = 0, dirtyAny = 0
    for (let i = 0; i < ids.length; i += 50) {
      // ⚠ SINGLE quotes. A double-quoted literal is read as a COLUMN NAME by DataFusion and
      //   matches nothing, silently — see the LanceDB predicate-quoting note.
      const list = ids.slice(i, i + 50).map(id => `'${chunkId(id, 0).replace(/'/g, "''")}'`).join(',')
      const got = await tbl.query().where(`chunkId IN (${list})`).select(['chunkId', 'body']).limit(100).toArray()
      for (const row of got) {
        const body: string = SELF_TEST ? REAL_STYLESHEET_BODY : (row.body ?? '')
        found++
        const sc = styleChars(body)
        if (sc > 0) dirtyAny++
        if (body.length && sc / body.length > 0.5) dirtyHalf++
      }
    }
    if (found === 0) {
      chunkNote = `0 chunk-0 rows returned for ${ids.length} sampled sections — NOT CHECKED, not clean`
    } else {
      chunkVerdict = dirtyHalf === 0 && dirtyAny === 0 ? 'clean' : 'dirty'
      chunkNote = `${found} chunk-0 bodies read · more than half stylesheet: ${dirtyHalf} (${fpct(dirtyHalf, found)}) · any CSS: ${dirtyAny} (${fpct(dirtyAny, found)})`
    }
  } catch (e) {
    chunkNote = `NOT CHECKED — ${(e as Error).message.slice(0, 160)}`
  }
  // ⚠ Reported, never gating. C is the embedder's copy; a citation extractor does not read it.
  console.log(`  ${chunkVerdict === 'clean' ? '  ok' : chunkVerdict === 'dirty' ? 'WARN' : ' n/c'}  C1.chunk0                    ${chunkNote}`)

  // ── the verdict ───────────────────────────────────────────────────────────
  const failed = findings.filter(f => !f.ok)
  console.log(`\n  ${findings.length - failed.length} passed, ${failed.length} failed, of ${findings.length} run`)
  console.log(`  chunk-0 (C1): ${chunkVerdict.toUpperCase()} — ${chunkNote}`)
  if (SELF_TEST) {
    const gateAsserts = findings.filter(f => f.id.startsWith('B') && f.id !== 'B0.readable')
    const allFired = gateAsserts.every(f => !f.ok)
    console.log(`\n  SELF-TEST: ${allFired ? 'every gate assertion rejected the real BEFORE-state body ✓'
      : '⚠⚠ AN ASSERTION PASSED ON A STYLESHEET — the gate cannot fail and is worthless'}`)
    await endNamesPool()
    process.exit(allFired ? 0 : 1)
  }
  console.log(failed.length === 0
    ? `\n  ▶ GATE OPEN. The stored bodies are judgment text; extraction may proceed.\n`
    : `\n  ⚠⚠ GATE CLOSED. Do NOT build the extractor — it would read formatting code and report an empty graph.\n`)
  await endNamesPool()
  process.exit(failed.length === 0 ? 0 : 1)
})().catch(async e => { console.error(e); await endNamesPool(); process.exit(1) })
