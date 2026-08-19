/**
 * backfill-caselaw-titles.ts — BRIEF_INGEST_NAMES §1.2 and §1.4.
 *
 * Populates `corpus_sections."sectionTitle"` for `tna-caselaw`, whose 74,896 rows carry a blank
 * title today: the only stored identifier is the neutral citation, so nobody — user or machine —
 * can tell what a case is about without opening it.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * THE ROUTE, AND WHY IT IS A FETCH RATHER THAN A PARSE (§1.1 audit, 100 rows)
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * The name is a STRUCTURED FIELD WE ALREADY HOLD — `<FRBRname value="…"/>` in the Akoma Ntoso
 * XML stored at `r2RawKey`, present in 100 of 100 sampled judgments. §1.2 prefers a source field
 * over parsed text and here the source field exists, so `parsed:v1` is implemented (in
 * `caselaw-name.ts`) and expected to fire on approximately nothing.
 *
 * PROVENANCE (required, not optional): the route is written to `corpus_sections.notes` as
 * `title-route:source` / `title-route:parsed:v1`. That column is free on this corpus (0 of
 * 74,896 rows use it) and is per-corpus by existing convention — `petitions` stores a Parliament
 * label, `tax-tribunals` a category, `committees-reports` a JSON blob. It is also indexed, so
 * "how many titles came from which route" is a cheap count rather than a table scan. The
 * alternative — a dedicated column — is Decision D-2 in the report; it was not taken unilaterally
 * because the database is at 99.2% of its ops ALERT line and `schema.prisma` is shared by three
 * threads mid-sprint.
 *
 * A MISS STAYS A MISS. Where no name can be established the field stays NULL and the row is
 * counted. `isCitationShaped()` rejects any candidate that is only court/year/number tokens, so
 * "EWHC 2021 123" can never be written as if it were a case name.
 *
 *   --measure    read the source, write nothing, report projected coverage   (default)
 *   --apply      write sectionTitle + notes
 *   --limit=N    cap rows processed (pilot)
 *   --self-test  watch every check fail before trusting it to pass
 *   --verify     §1.4 — hand-read sample: 30 random recovered titles beside their judgment text
 */
import { namesPool as getNeonPool, endNamesPool as endNeonPool } from './names-pool'
import { r2Get, r2GetRange } from '../shared/r2-client'
import { nameFromAkn, nameFromCompiledText, isCitationShaped, judgmentDateFromAkn, firstWords, type RecoveredName } from '../shared/caselaw-name'

const CORPUS = 'tna-caselaw'
/** `FRBRname` sits at byte 492–600 in all 40 offsets sampled. 32 KB is ~50× headroom. */
const META_BYTES = 32_768
const CONCURRENCY = parseInt(process.env.NAMES_CONCURRENCY ?? '24', 10)
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1]

interface Outcome {
  id: string
  title: string | null
  route: string | null
  field: string | null
  /** Why nothing was written — always one of a fixed set, never a free-text guess. */
  miss: 'no-r2-key' | 'r2-object-missing' | 'no-name-field' | 'citation-shaped' | null
  judgmentDate: string | null
}

/**
 * ⚠ THE RANGE READ CAN LIE BY OMISSION, so it is checked rather than trusted. If the window did
 * not contain `<FRBRname`, the object is re-read IN FULL before concluding the field is absent.
 * Without that, a judgment with an unusually long `<meta>` block would be recorded as "source
 * carries no name" — an absence manufactured by our own optimisation.
 */
async function readMeta(rawKey: string): Promise<{ xml: string | null; usedFullRead: boolean }> {
  const head = await r2GetRange(rawKey, META_BYTES)
  if (head && head.includes('<FRBRname')) return { xml: head, usedFullRead: false }
  const full = await r2Get(rawKey)
  return { xml: full, usedFullRead: true }
}

async function resolveOne(row: { id: string; r2Key: string | null; r2RawKey: string | null }): Promise<Outcome> {
  const base: Outcome = { id: row.id, title: null, route: null, field: null, miss: null, judgmentDate: null }
  if (!row.r2RawKey && !row.r2Key) return { ...base, miss: 'no-r2-key' }

  let name: RecoveredName | null = null
  let judgmentDate: string | null = null

  if (row.r2RawKey) {
    const { xml } = await readMeta(row.r2RawKey)
    if (!xml) return { ...base, miss: 'r2-object-missing' }
    name = nameFromAkn(xml)
    judgmentDate = judgmentDateFromAkn(xml)
  }
  // Fallback, an INFERENCE, only where the source field is absent.
  if (!name && row.r2Key) {
    const compiled = await r2Get(row.r2Key)
    if (compiled) name = nameFromCompiledText(compiled)
  }
  if (!name) return { ...base, miss: 'no-name-field', judgmentDate }
  if (isCitationShaped(name.title)) return { ...base, miss: 'citation-shaped', judgmentDate }
  return { id: row.id, title: name.title, route: name.route, field: name.field, miss: null, judgmentDate }
}

async function mapLimit<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) {
      const k = i++
      if (k >= items.length) return
      out[k] = await fn(items[k])
    }
  }))
  return out
}

async function run(apply: boolean): Promise<void> {
  const pool = getNeonPool()
  const limit = arg('limit') ? parseInt(arg('limit')!, 10) : null

  // Only rows that still need one — idempotent, and a re-run after a partial sweep is cheap.
  const rows = (await pool.query(
    `SELECT id, "r2Key", "r2RawKey" FROM corpus_sections
      WHERE corpus = $1 AND (NULLIF(btrim(COALESCE("sectionTitle",'')),'') IS NULL)
      ORDER BY id ${limit ? `LIMIT ${limit}` : ''}`, [CORPUS])).rows
  const total = (await pool.query(`SELECT COUNT(*)::int n FROM corpus_sections WHERE corpus=$1`, [CORPUS])).rows[0].n

  console.log(`${CORPUS}: ${total} rows in corpus, ${rows.length} still untitled${limit ? ` (capped at ${limit})` : ''}`)
  console.log(`mode: ${apply ? 'APPLY' : 'MEASURE (nothing written)'}, concurrency ${CONCURRENCY}\n`)

  const t0 = Date.now()
  const tally: Record<string, number> = {}
  let done = 0, written = 0
  const BATCH = 2000

  for (let start = 0; start < rows.length; start += BATCH) {
    const slice = rows.slice(start, start + BATCH)
    const outcomes = await mapLimit(slice, CONCURRENCY, resolveOne)

    for (const o of outcomes) {
      const k = o.title ? `recovered:${o.route}` : `miss:${o.miss}`
      tally[k] = (tally[k] ?? 0) + 1
    }

    if (apply) {
      const hits = outcomes.filter(o => o.title)
      if (hits.length) {
        // One statement per batch: unnest arrays, not 2,000 round trips.
        await pool.query(
          `UPDATE corpus_sections AS c
              SET "sectionTitle" = v.title, notes = v.route
             FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS title, unnest($3::text[]) AS route) AS v
            WHERE c.id = v.id AND c.corpus = $4`,
          [hits.map(h => h.id), hits.map(h => h.title), hits.map(h => `title-route:${h.route}`), CORPUS])
        written += hits.length
      }
    }
    done += slice.length
    const rate = done / ((Date.now() - t0) / 1000)
    process.stdout.write(`  ${done}/${rows.length}  ${rate.toFixed(0)} rows/s  eta ${(((rows.length - done) / rate) / 60).toFixed(1)} min\r`)
  }

  console.log(`\n\nOUTCOMES (n=${rows.length})`)
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(28)} ${String(v).padStart(7)}  ${(100 * v / rows.length).toFixed(2)}% of processed`)
  }
  if (apply) console.log(`\nWROTE sectionTitle on ${written} rows.`)

  const after = (await pool.query(
    `SELECT COUNT(*)::int n, COUNT(NULLIF(btrim(COALESCE("sectionTitle",'')),''))::int titled
       FROM corpus_sections WHERE corpus=$1`, [CORPUS])).rows[0]
  console.log(`\nCORPUS STATE: ${after.titled}/${after.n} titled (${(100 * after.titled / after.n).toFixed(2)}% of ${CORPUS} rows)`)
  if (apply) {
    const byRoute = (await pool.query(
      `SELECT notes, COUNT(*)::int n FROM corpus_sections WHERE corpus=$1 AND notes LIKE 'title-route:%' GROUP BY 1 ORDER BY 2 DESC`, [CORPUS])).rows
    console.table(byRoute)
  }
  await endNeonPool()
}

/** §1.4 — the hand-read sample. A parser's own success count is not evidence the names are right. */
async function verify(): Promise<void> {
  const pool = getNeonPool()
  const n = arg('n') ? parseInt(arg('n')!, 10) : 30
  const WORDS = arg('words') ? parseInt(arg('words')!, 10) : 75
  const rows = (await pool.query(
    `SELECT id, "sectionTitle", "r2Key", notes FROM corpus_sections
      WHERE corpus=$1 AND "sectionTitle" IS NOT NULL
      ORDER BY md5(id || 'verify-salt') LIMIT $2`, [CORPUS, n])).rows
  console.log(`§1.4 HAND-READ SAMPLE — ${rows.length} recovered titles beside their judgment text.`)
  console.log(`Read each: does the stored title name the parties this judgment is between?\n`)
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const compiled = r.r2Key ? await r2Get(r.r2Key) : null
    console.log(`${'─'.repeat(100)}`)
    console.log(`[${String(i + 1).padStart(2)}] id     ${r.id}`)
    console.log(`     TITLE  ${r.sectionTitle}`)
    console.log(`     route  ${r.notes}`)
    console.log(`     TEXT   ${compiled ? firstWords(compiled, WORDS) : '⚠ no compiled text'}`)
  }
  await endNeonPool()
}

// ── §3: every check watched failing first ────────────────────────────────────────────────────
function selfTest(): void {
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'FRBRname absent → null, never a citation placeholder',
      run: () => nameFromAkn('<akomaNtoso><FRBRWork/></akomaNtoso>') === null },
    { name: 'an EMPTY FRBRname value is a miss, not an empty title',
      run: () => nameFromAkn('<FRBRname value="  "/>') === null },
    { name: 'a citation-shaped candidate is rejected ("EWHC 2021 123")',
      run: () => isCitationShaped('EWHC 2021 123') && isCitationShaped('[2021] EWHC 123 (Ch)') },
    { name: 'a real case name is NOT rejected',
      run: () => !isCitationShaped('Mensah v Jones') && !isCitationShaped('R (on the application of Miller) v The Prime Minister') },
    { name: 'a name with no " v " but a party word survives ("In the matter of an application by …")',
      run: () => !isCitationShaped('In the matter of an application by Brigid McCaughey') },
    { name: 'HTML entities in the source name are decoded, not stored raw',
      run: () => nameFromAkn('<FRBRname value="Tosi Limited v 99 Hippos Limited &amp; Anor"/>')?.title
        === 'Tosi Limited v 99 Hippos Limited & Anor' },
    { name: 'the parsed fallback is labelled parsed:v1, never source',
      run: () => nameFromCompiledText(
        '#judgment .a { font-size: 1pt; } Between : ACME LIMITED Claimant - and - JOHN SMITH Defendant')?.route === 'parsed:v1' },
    { name: 'the parsed fallback returns null on text it cannot read',
      run: () => nameFromCompiledText('#judgment .a { font-size: 1pt; } this judgment has no party line at all') === null },
  ]
  let pass = 0
  for (const c of cases) {
    const ok = c.run()
    console.log(`  ${ok ? '✓ FIRED' : '✗ DID NOT FIRE'}  ${c.name}`)
    if (ok) pass++
  }
  console.log(`\nself-test: ${pass}/${cases.length}`)
  if (pass !== cases.length) process.exit(1)
}

;(async () => {
  if (process.argv.includes('--self-test')) return selfTest()
  if (process.argv.includes('--verify')) return verify()
  await run(process.argv.includes('--apply'))
})().catch(e => { console.error(e); process.exit(1) })
