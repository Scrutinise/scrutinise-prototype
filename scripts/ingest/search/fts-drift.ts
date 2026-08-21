/**
 * fts-drift.ts — DOES THE INDEX STILL AGREE WITH THE DATABASE? SEARCH S11 §4.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠ THE CHECK THAT MATTERS IS THE ONE THAT FAILS WHEN SOMEBODY FORGETS.
 *
 * S11 §4 built `fts-refresh.ts` so that a backfill CAN say "these rows changed, refresh them".
 * That is necessary and it is not sufficient: **a refresh script nobody runs is not a fix.** The
 * failure being guarded against is not a broken tool, it is a forgotten step — and a forgotten
 * step is invisible by construction, because `fts-catchup` reports success on it (the ids are all
 * present; only their contents are stale).
 *
 * So this is the detector. It compares, per collection, a small set of aggregates that any content
 * rewrite would move, and it reports DRIFT rather than an absence of errors.
 *
 * ── WHY AGGREGATES AND NOT A ROW-BY-ROW DIFF ────────────────────────────────────────────────────
 *
 * A row-by-row comparison of 18.2 M rows means either 18.2 M point lookups — and `corpus_fts` has
 * **no scalar index on `id`**, so each one is a full scan (S11 learned this the expensive way: a
 * batched `delete WHERE id IN (…)` managed 3,697 rows in 15 minutes) — or holding both sides in
 * memory, which is a heavy job in its own right.
 *
 * Aggregates cost ONE projected scan and one SQL query, and they catch the thing that actually
 * happens. The case that motivated this — 74,896 case-law titles recovered into the database and
 * **0 of them in the index** — moves `titled` from 0 to 74,896 and `dateMin` by decades. It is not
 * a subtle signal.
 *
 * ⚠ AND ITS LIMITS ARE STATED RATHER THAN LEFT TO BE ASSUMED. Aggregates cannot see a rewrite that
 * preserves them: a body edited with the same word count, or a title changed to another
 * same-length non-null title, passes. This detects the SHAPE of a stale collection, not every
 * possible staleness. That is worth having and it is not a proof of freshness, and a report that
 * said "no drift" while meaning "no drift in four aggregates" would be the same silent-success
 * failure this file exists to prevent — so the summary line names what it compared.
 *
 * ── WHAT IT COSTS ───────────────────────────────────────────────────────────────────────────────
 * One projected Lance scan (~20–40 s over 18.2 M rows; R2 egress is free) and one grouped query
 * against Neon. No model calls, no writes, nothing provisioned. Cheap enough to run at the end of
 * every ingest sprint, which is where the checklist entry (INGEST_PLAYBOOK §20) puts it.
 *
 * Usage:
 *   npx tsx search/fts-drift.ts                 report every collection; exit 1 on drift
 *   npx tsx search/fts-drift.ts --corpus=a,b     just these
 *   npx tsx search/fts-drift.ts --self-test      ⚠ prove the check can FAIL before trusting a pass
 *   npx tsx search/fts-drift.ts --json out.json
 */
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'
import { tierFor } from './corpus-map'

const ARGS = process.argv.slice(2)
const SELF_TEST = ARGS.includes('--self-test')
const arg = (k: string) => ARGS.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=')
const ONLY = (arg('corpus') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const JSON_OUT = arg('json')

/** Rows may legitimately differ by a little: a section compiled since the last index write is a
 *  KNOWN gap that `fts-catchup` closes, not drift. Anything above this is reported. */
const ROW_TOLERANCE_PCT = 2

interface Agg { rows: number; titled: number; words: number; dateMin: string | null; dateMax: string | null }
const empty = (): Agg => ({ rows: 0, titled: 0, words: 0, dateMin: null, dateMax: null })

function fold(a: Agg, title: string | null, words: number | null, date: string | null) {
  a.rows++
  if (title !== null && title !== '') a.titled++
  a.words += words ?? 0
  if (date) {
    if (a.dateMin === null || date < a.dateMin) a.dateMin = date
    if (a.dateMax === null || date > a.dateMax) a.dateMax = date
  }
}

;(async () => {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false },
    max: 2, statement_timeout: 900_000,
  })
  const db = await connectLance()
  const tbl = await db.openTable(FTS_TABLE)

  console.log('═'.repeat(104))
  console.log('FTS DRIFT — does the built index still agree with `corpus_sections`?')
  console.log('═'.repeat(104))
  console.log('  compares, per collection: row count · rows with a title · total wordCount · itemDate range')
  console.log('  ⚠ it CANNOT see a rewrite that preserves all four (same-length title, same word count).')
  console.log('  ⚠ in the LEGISLATION tier the title is DERIVED by buildCitation, so the index holds more')
  console.log('    titles than the database BY DESIGN — only a shortfall is reported there.\n')

  // ── the index side: one projected scan ────────────────────────────────────────────────────
  const idx = new Map<string, Agg>()
  const expected = await tbl.countRows()
  let scanned = 0
  const t0 = Date.now()
  for await (const batch of tbl.query().select(['corpus', 'sectionTitle', 'wordCount', 'itemDate']) as any) {
    const c = batch.getChild('corpus'), t = batch.getChild('sectionTitle')
    const w = batch.getChild('wordCount'), d = batch.getChild('itemDate')
    for (let i = 0; i < batch.numRows; i++) {
      const corpus = String(c.get(i) ?? '')
      let a = idx.get(corpus)
      if (!a) { a = empty(); idx.set(corpus, a) }
      const title = t.get(i)
      const date = d.get(i)
      fold(a, title == null ? null : String(title), w.get(i) == null ? null : Number(w.get(i)), date == null ? null : String(date))
    }
    scanned += batch.numRows
  }
  // A short scan is a silently wrong answer, not a fast one — the same guard corpus-reachability
  // carries, and for the same reason: a partial scan under-counts every aggregate at once and so
  // reports drift everywhere, or (worse) reports agreement on a collection it never reached.
  if (scanned !== expected) {
    throw new Error(`${FTS_TABLE} scan is short: countRows()=${expected}, scanned=${scanned}. Refusing to report drift on a partial read.`)
  }
  console.log(`  index: scanned ${scanned.toLocaleString()} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${idx.size} collections`)

  // ── the database side: one grouped query ──────────────────────────────────────────────────
  const { rows: dbRows } = await pool.query<{
    corpus: string; rows: string; titled: string; words: string; dmin: string | null; dmax: string | null
  }>(`SELECT corpus,
             COUNT(*)::text                                              rows,
             COUNT("sectionTitle") FILTER (WHERE "sectionTitle" <> '')::text titled,
             COALESCE(SUM("wordCount"), 0)::text                          words,
             MIN("itemDate")::text                                        dmin,
             MAX("itemDate")::text                                        dmax
        FROM corpus_sections WHERE status = 'compiled' GROUP BY corpus`)
  const dbm = new Map(dbRows.map((r) => [r.corpus, {
    rows: +r.rows, titled: +r.titled, words: +r.words, dateMin: r.dmin, dateMax: r.dmax,
  } as Agg]))
  console.log(`  database: ${dbm.size} collections\n`)

  // ⚠ SELF-TEST: perturb ONE collection's index-side aggregates and require the check to fire.
  // A drift detector that reports "no drift" on a healthy corpus is indistinguishable from one
  // that cannot report drift at all — the guard-that-cannot-fail family (docs/CLAUDE.md §19 and
  // the check-that-passed-because-everything-was-below-the-limit). Run this before believing a
  // clean pass.
  let planted: string | null = null
  if (SELF_TEST) {
    planted = [...idx.keys()].find((k) => (idx.get(k)!.titled > 0)) ?? [...idx.keys()][0]
    const a = idx.get(planted)!
    a.titled = 0
    a.dateMin = '1000-01-01'
    console.log(`  ⚠ SELF-TEST: planted a fake stale state on \`${planted}\` (titled → 0, dateMin → 1000-01-01).`)
    console.log('    The run MUST report drift on it and exit 1. If it does not, the check is broken.\n')
  }

  const collections = ONLY.length ? ONLY : [...new Set([...idx.keys(), ...dbm.keys()])].sort()
  const drift: Array<{ corpus: string; reasons: string[] }> = []

  for (const corpus of collections) {
    const a = idx.get(corpus), b = dbm.get(corpus)
    if (!b) continue                       // in the index, not in the database — fts-hygiene's job
    if (!a) { drift.push({ corpus, reasons: ['NOT IN THE INDEX AT ALL'] }); continue }

    const reasons: string[] = []
    const rowGap = b.rows === 0 ? 0 : Math.abs(a.rows - b.rows) / b.rows * 100
    if (rowGap > ROW_TOLERANCE_PCT) reasons.push(`rows ${a.rows.toLocaleString()} vs ${b.rows.toLocaleString()} (${rowGap.toFixed(1)}%)`)
    // Titles are compared as a RATE, because the row counts legitimately differ a little. A
    // collection titled in the database and untitled in the index is the exact case that went
    // unnoticed for a day, so it gets the tightest comparison here.
    //
    // ⚠⚠ EXCEPT IN THE LEGISLATION TIER, WHERE THE INDEX TITLE IS DERIVED AND NOT COPIED — and
    // the first run of this check reported exactly that as drift. `buildFtsRecord` runs
    // legislation rows through `buildCitation`, which SYNTHESISES a `sectionTitle` ("Data
    // Protection Act 2018, s. 45") for rows that have none in `corpus_sections`. So the index
    // legitimately holds MORE titles than the database: `si-pre-2010` measured 27.8% against
    // 18.4%, `retained-eu` 25.1% against 19.2%. Both are the citation rewrite working.
    //
    // Comparing a derived field against its source and calling the difference "drift" is how a
    // detector trains its reader to ignore it — the failure mode that matters most for a check
    // meant to be run every sprint. The rate comparison is therefore skipped for this tier and
    // the skip is PRINTED, so "no drift" cannot quietly mean "I did not look".
    const derivedTitle = tierFor(corpus) === 'legislation'
    const rateI = a.rows ? a.titled / a.rows : 0
    const rateD = b.rows ? b.titled / b.rows : 0
    if (!derivedTitle && Math.abs(rateI - rateD) > 0.05) {
      reasons.push(`titled ${(rateI * 100).toFixed(1)}% in the index vs ${(rateD * 100).toFixed(1)}% in the database`)
    } else if (derivedTitle && rateI + 0.05 < rateD) {
      // One direction still counts: the index having FEWER titles than the database cannot be
      // explained by a rewrite that only ever adds them.
      reasons.push(`titled ${(rateI * 100).toFixed(1)}% in the index vs ${(rateD * 100).toFixed(1)}% in the database ` +
        `(⚠ legislation tier — the citation rewrite can only ADD titles, so fewer is real drift)`)
    }
    const wordGap = b.words === 0 ? 0 : Math.abs(a.words - b.words) / b.words * 100
    if (wordGap > 10) reasons.push(`total words ${a.words.toLocaleString()} vs ${b.words.toLocaleString()} (${wordGap.toFixed(1)}%)`)
    if (a.dateMin !== b.dateMin || a.dateMax !== b.dateMax) {
      reasons.push(`itemDate ${a.dateMin}..${a.dateMax} vs ${b.dateMin}..${b.dateMax}`)
    }
    if (reasons.length) drift.push({ corpus, reasons })
  }

  if (!drift.length) {
    console.log(`  ✅ no drift across ${collections.length} collections, on row count · title rate · word total · date range.`)
  } else {
    console.log(`  ⚠⚠ ${drift.length} of ${collections.length} collection(s) DRIFTED:\n`)
    for (const d of drift) {
      console.log(`    ${d.corpus}`)
      for (const r of d.reasons) console.log(`        ${r}`)
    }
    console.log('\n  ▶ FIX: npx tsx search/fts-refresh.ts --corpus=<name> --from=db')
    console.log('    then the `fts-index` heavy job, then redeploy `fts-serve`. All three, or a user sees none of it.')
  }

  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ generatedAt: new Date().toISOString(), scanned, drift }, null, 2))

  if (SELF_TEST) {
    const fired = drift.some((d) => d.corpus === planted)
    console.log(`\n  SELF-TEST: planted drift on \`${planted}\` — check ${fired ? 'FIRED ✅' : 'DID NOT FIRE ❌❌'}`)
    await pool.end()
    process.exit(fired ? 0 : 1)
  }

  await pool.end()
  process.exit(drift.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
