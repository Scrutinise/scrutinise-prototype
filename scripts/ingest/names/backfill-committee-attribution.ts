/**
 * backfill-committee-attribution.ts — BRIEF_INGEST_NAMES §2.2, the half that needs NO FETCH.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THE §2.1 AUDIT FOUND, AND WHY THIS SCRIPT EXISTS SEPARATELY FROM THE API SWEEP
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * `committees-reports` already holds the author. 303,354 of its 344,773 rows carry a JSON blob in
 * `corpus_sections.notes`, written by the V32 committees-api ingest, and that blob contains
 * `committeeName`, `committeeId`, `house`, `category` and `publicationType`. Nothing needs to be
 * fetched: the fact is in our own database, one column away from the column search reads.
 *
 * ⚠⚠ AND THE COMMITTEE IS NOT THE AUTHOR OF EVERY PUBLICATION UNDER IT. `publicationType` has
 * three values in our rows:
 *
 *     Report              276,783 rows — the committee's own text.        ATTRIBUTED.
 *     Special Report       18,269 rows — the committee's own text.        ATTRIBUTED.
 *     Government Response   8,302 rows — THE GOVERNMENT'S text, published
 *                                        under the committee's inquiry.   NOT ATTRIBUTED.
 *
 * §2.2 names getting this backwards as "the most damaging error available here", and a
 * Government Response is exactly the trap: the committee's id sits on the row, the inquiry title
 * sits on the row, and the text is a department answering back. The API carries
 * `respondingDepartment`, but it was populated on **1 of 100** sampled publications, so there is
 * no reliable name to put in its place — and a wrong name is worse than a blank. Those rows stay
 * NULL and are counted as a deliberate exclusion, not a miss.
 *
 * WHERE IT IS WRITTEN. `corpus_sections.attribution`, the column `lib/lex/attribution.ts` reads
 * for an ORGANISATION (as opposed to `speaker`, which it reads for a PERSON). A committee is a
 * body, not a person, so `attribution` is the correct column under that contract.
 *
 * ⚠ THE ROLE PHRASE IS NOT OURS TO WRITE. `attributionFor()` maps corpus → role wording and
 * lives in a search-owned file this sprint does not edit. Until CC-Search adds a branch, a
 * committee report renders as "— Transport Committee, the body that published it", which is true
 * but flat. The exact one-line change is reported, not made.
 *
 *   --measure    (default) count what would change, write nothing
 *   --apply      write the attribution column
 *   --self-test  watch every check fail before trusting it to pass
 */
import { namesPool as getNeonPool, endNamesPool as endNeonPool } from './names-pool'
import { attributePublication } from '../shared/committee-attribution'

const CORPUS = 'committees-reports'

/**
 * The decision of who a publication is by lives in ONE place — `shared/committee-attribution.ts`,
 * shared with the live ingest writer in `workers/process-row.ts` — so a row backfilled today and
 * a row ingested tomorrow cannot be attributed differently. This wrapper only unpacks the stored
 * JSON blob.
 */
export function authorFor(notesJson: string | null): { name: string | null; note: string | null } {
  if (!notesJson) return { name: null, note: 'no-notes-blob' }
  let parsed: { committeeName?: string; publicationType?: string }
  try { parsed = JSON.parse(notesJson) } catch { return { name: null, note: 'notes-not-json' } }
  const a = attributePublication(parsed.publicationType, parsed.committeeName)
  return { name: a.attribution, note: a.miss }
}

async function run(apply: boolean): Promise<void> {
  const pool = getNeonPool()
  const total = (await pool.query(`SELECT COUNT(*)::int n FROM corpus_sections WHERE corpus=$1`, [CORPUS])).rows[0].n

  const tally: Record<string, number> = {}
  const bump = (k: string, n = 1) => { tally[k] = (tally[k] ?? 0) + n }
  let written = 0
  const BATCH = 5000
  let after = ''

  for (;;) {
    const rows = (await pool.query(
      `SELECT id, notes FROM corpus_sections
        WHERE corpus = $1 AND id > $2 AND attribution IS NULL
        ORDER BY id LIMIT $3`, [CORPUS, after, BATCH])).rows
    if (rows.length === 0) break
    after = rows[rows.length - 1].id

    const hits: Array<{ id: string; name: string }> = []
    for (const r of rows) {
      const a = authorFor(r.notes)
      if (a.name) { hits.push({ id: r.id, name: a.name }); bump('attributed') }
      else bump(`not-attributed:${a.note}`)
    }
    if (apply && hits.length) {
      await pool.query(
        `UPDATE corpus_sections AS c SET attribution = v.name
           FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS name) AS v
          WHERE c.id = v.id AND c.corpus = $3`,
        [hits.map(h => h.id), hits.map(h => h.name), CORPUS])
      written += hits.length
    }
    process.stdout.write(`  scanned ${Object.values(tally).reduce((a, b) => a + b, 0)}\r`)
  }

  const scanned = Object.values(tally).reduce((a, b) => a + b, 0)
  console.log(`\n\n${CORPUS}: ${total} rows, ${scanned} scanned (attribution still NULL)`)
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(46)} ${String(v).padStart(7)}  ${(100 * v / total).toFixed(2)}% of corpus`)
  }
  if (apply) console.log(`\nWROTE attribution on ${written} rows.`)

  const state = (await pool.query(
    `SELECT COUNT(*)::int n, COUNT(attribution)::int attr FROM corpus_sections WHERE corpus=$1`, [CORPUS])).rows[0]
  console.log(`\nCORPUS STATE: ${state.attr}/${state.n} attributed (${(100 * state.attr / state.n).toFixed(2)}% of ${CORPUS} rows)`)
  if (apply) {
    const top = (await pool.query(
      `SELECT attribution, COUNT(*)::int n FROM corpus_sections WHERE corpus=$1 AND attribution IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10`, [CORPUS])).rows
    console.table(top)
  }
  await endNeonPool()
}

// ── §3: every check watched failing first ────────────────────────────────────────────────────
function selfTest(): void {
  const J = (o: unknown) => JSON.stringify(o)
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: '⚠⚠ a GOVERNMENT RESPONSE is NOT attributed to the committee',
      run: () => authorFor(J({ committeeName: 'Public Accounts Committee', publicationType: 'Government Response' })).name === null },
    { name: 'a Report IS attributed to its committee',
      run: () => authorFor(J({ committeeName: 'Transport Committee', publicationType: 'Report' })).name === 'Transport Committee' },
    { name: 'a Special Report IS attributed',
      run: () => authorFor(J({ committeeName: 'Defence Committee', publicationType: 'Special Report' })).name === 'Defence Committee' },
    { name: 'an UNKNOWN publication type is refused, not assumed committee-authored',
      run: () => authorFor(J({ committeeName: 'X Committee', publicationType: 'Correspondence' })).name === null },
    { name: 'a missing publicationType is refused',
      run: () => authorFor(J({ committeeName: 'X Committee' })).name === null },
    { name: 'a blank committeeName is a miss, not an empty attribution',
      run: () => authorFor(J({ committeeName: '   ', publicationType: 'Report' })).name === null },
    { name: 'notes that are not JSON are refused rather than thrown on',
      run: () => authorFor('parliament 2019-2024').name === null },
    { name: 'a null notes blob is a miss',
      run: () => authorFor(null).name === null },
    { name: 'HTML entities in the committee name are decoded',
      run: () => authorFor(J({ committeeName: 'Business &amp; Trade Committee', publicationType: 'Report' })).name
        === 'Business & Trade Committee' },
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
  await run(process.argv.includes('--apply'))
})().catch(e => { console.error(e); process.exit(1) })
