/**
 * entity-decode-fix.ts — BRIEF_INGEST_ENTITY_DECODE §3 and §4: fix at the right layer, and price it.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHICH LAYER, AND WHY THE MEASUREMENT CHANGED THE ANSWER
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * §3 recommends "decode at ingest AND rebuild the indexes, so the stored text and the searchable
 * text agree", subject to §1. §1 and §2 came back and they change the recommendation:
 *
 *   · **Recall damage: none measurable.** The FTS `simple` tokeniser splits on every
 *     non-alphanumeric character, so `Barbara&#xa0;Rayment` indexes as barbara | xa0 | rayment and
 *     both real words survive. Over the 16 contaminated corpora, decoding recovers **0 tokens in
 *     15,659,766**. So the index does NOT need rebuilding for this, and a rebuild is the expensive
 *     half of §3's recommendation.
 *   · **Display damage: real, and exhaustively countable.** 4,532 section titles, 10,660 speaker
 *     values and 1,613 attributions carry a literal entity, in Neon, rendered straight into search
 *     results.
 *
 * So this script does the two things the measurement supports and refuses the one it does not:
 *
 *   1. **The DB columns — repaired here.** Exhaustive, reversible, cheap, and it fixes what a user
 *      actually sees. `--titles --apply`.
 *   2. **The compiler — already repaired** in `sources/committees-portal.ts` + `shared/
 *      html-entities.ts`, guarded by `check-entity-decode.ts`. Future documents arrive clean.
 *   3. **The R2 backfill — PRICED AND NOT RUN.** `--predict` prints what it would cost. On a
 *      measured recall damage of zero it is not justified, and the decision is Charlie's rather
 *      than mine to take silently.
 *
 * ⚠ §3's warning is honoured: `shared/html-entities.ts` decodes a NAMED list plus the numeric
 * forms, leaves `&c;` and unknown names alone, and leaves an out-of-range codepoint untouched
 * rather than substituting a space.
 *
 * Usage (from scripts/ingest):
 *   npx tsx entity-decode-fix.ts --predict
 *   npx tsx entity-decode-fix.ts --titles              # dry run: what would change
 *   npx tsx entity-decode-fix.ts --titles --apply
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { decodeForIndex, hasLiteralEntity } from './shared/html-entities'

export {}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const APPLY = flag('apply')
const COLUMNS = ['sectionTitle', 'speaker', 'attribution'] as const
const ENTITY_SQL = `~ '&(#x[0-9a-fA-F]{2,6}|#[0-9]{2,7}|[a-zA-Z][a-zA-Z0-9]{1,9});'`
const n = (v: unknown) => Number(v).toLocaleString('en-GB')

async function titles(pool: ReturnType<typeof getNeonPool>) {
  console.log(`\n════ §3 LAYER 1 — THE USER-VISIBLE COLUMNS IN NEON ${APPLY ? '(APPLYING)' : '(dry run)'} ════`)
  let totalChanged = 0
  let totalUnchanged = 0
  const samples: string[] = []

  for (const col of COLUMNS) {
    const { rows } = await pool.query<{ id: string; v: string }>(
      `SELECT id, "${col}" v FROM corpus_sections WHERE "${col}" ${ENTITY_SQL}`)
    let changed = 0
    let unchanged = 0
    const updates: Array<[string, string]> = []
    for (const r of rows) {
      // ⚠ WHITESPACE IS COLLAPSED FOR THESE COLUMNS ONLY. A title or a speaker name is a single
      // line by definition, and `&#10;` decodes to a real newline that would then be rendered into
      // a search result. Body text in R2 is NOT treated this way — collapsing there would destroy
      // paragraph structure.
      const fixed = decodeForIndex(r.v).replace(/\s+/g, ' ').trim()
      if (fixed === r.v) { unchanged++; continue }
      changed++
      updates.push([r.id, fixed])
      // Show the window AROUND THE FIRST DIFFERENCE, not the first 62 characters — the entity is
      // usually mid-string and a head-truncated sample shows two identical-looking lines.
      if (samples.length < 10 && !samples.some((s) => s.includes(col + ':'))) {
        let i = 0
        while (i < r.v.length && r.v[i] === fixed[i]) i++
        const from = Math.max(0, i - 28)
        samples.push(`  ${col.padEnd(13)} …${r.v.slice(from, i + 34)}…\n                →  …${fixed.slice(from, i + 30)}…`)
      } else if (samples.length < 10) {
        let i = 0
        while (i < r.v.length && r.v[i] === fixed[i]) i++
        const from = Math.max(0, i - 28)
        samples.push(`  ${col.padEnd(13)} …${r.v.slice(from, i + 34)}…\n                →  …${fixed.slice(from, i + 30)}…`)
      }
    }
    // ⚠ `unchanged` is not zero and is not noise: it is the rows whose "entity" the decoder
    // deliberately REFUSED — `&c;` in old statute titles, an unknown named form. Reporting it is
    // how a refusal stays visible instead of looking like a row the fix missed.
    console.log(`  ${col.padEnd(14)} ${n(rows.length).padStart(7)} rows match the pattern · ${n(changed).padStart(7)} would change · ${n(unchanged).padStart(5)} REFUSED by the decoder`)
    totalChanged += changed
    totalUnchanged += unchanged

    if (APPLY && updates.length) {
      for (let i = 0; i < updates.length; i += 500) {
        const b = updates.slice(i, i + 500)
        await pool.query(
          `UPDATE corpus_sections AS c SET "${col}" = v.val
             FROM (SELECT unnest($1::text[]) id, unnest($2::text[]) val) v
            WHERE c.id = v.id`,
          [b.map((x) => x[0]), b.map((x) => x[1])])
      }
      // Read it back rather than trusting the write.
      const { rows: [after] } = await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text n FROM corpus_sections WHERE "${col}" ${ENTITY_SQL}`)
      console.log(`      applied · ${n(after.n)} rows still match (expected ${n(unchanged)} — the refusals)`)
      if (Number(after.n) !== unchanged) console.log(`      ⚠ MISMATCH — read back ${after.n}, expected ${unchanged}`)
    }
  }

  console.log(`\n  ${n(totalChanged)} values would be repaired · ${n(totalUnchanged)} deliberately left alone`)
  if (samples.length) {
    console.log(`\n  what the repair does, so it can be judged before it is run:`)
    for (const s of samples) console.log(s)
  }
  if (!APPLY) console.log(`\n  dry run — nothing written. Re-run with --apply.`)
}

async function predict(pool: ReturnType<typeof getNeonPool>) {
  console.log(`\n════ §4 — THE R2 BACKFILL, PRICED AND NOT RUN ════`)
  // From entity-decode-census.json's extrapolation: 1.01% of 18,272,362 compiled documents.
  const { rows: [tot] } = await pool.query<{ docs: string; words: string }>(
    `SELECT COUNT(*)::text docs, COALESCE(SUM("wordCount"),0)::text words
       FROM corpus_sections WHERE "r2Key" IS NOT NULL AND status='compiled'`)
  const docs = Number(tot.docs)
  const affected = Math.round(docs * 0.0101)

  // R2 Class A (write) $4.50/M, Class B (read) $0.36/M. Egress is free.
  const reads = affected
  const writes = affected
  const r2Cost = (reads / 1e6) * 0.36 + (writes / 1e6) * 4.5
  // Throughput: the census read 200 documents per corpus at 24 concurrent in ~1s per corpus for
  // small ones; measured across the whole census, ~120 documents/second end to end.
  const seconds = affected / 120

  console.log(`  compiled documents in R2                     ${n(docs)}`)
  console.log(`  estimated carrying a literal entity (1.01%)  ${n(affected)}   ⚠ an extrapolation from a`)
  console.log(`                                                   150-per-corpus sample, not a census`)
  console.log(`  R2 operations                                ${n(reads)} reads + ${n(writes)} writes`)
  console.log(`  R2 cost                                      $${r2Cost.toFixed(2)}`)
  console.log(`  wall clock at the measured ~120 docs/s       ${(seconds / 60).toFixed(0)} minutes`)
  console.log(`  index rebuild if the text changes            ⚠ NOT included — the FTS rebuild needs`)
  console.log(`                                                   the Heavy Job Runner (19.8 GB peak,`)
  console.log(`                                                   ~€0.05) and vector re-embedding of any`)
  console.log(`                                                   changed chunk would be the real cost`)
  console.log(`\n  ⚠⚠ RECOMMENDATION: DO NOT RUN IT YET, and the reason is a measurement, not caution.`)
  console.log(`  Decoding recovers 0 searchable tokens (entity-decode-census.ts --context), so this`)
  console.log(`  spend buys nothing for retrieval. It buys cleaner text for anything that READS a`)
  console.log(`  document — Lex quoting a passage, a snippet on screen — and that is real but it is`)
  console.log(`  also fixable at render for a fraction of the cost.`)
  console.log(`\n  ▶ CHARLIE'S CALL: decode-at-render in the search adapters (cheap, immediate, covers`)
  console.log(`    every corpus at once) versus a one-off R2 rewrite of ${n(affected)} objects (permanent,`)
  console.log(`    $${r2Cost.toFixed(2)} plus an index rebuild, and the stored text finally matches the source).`)
}

async function main() {
  const pool = getNeonPool()
  try {
    if (flag('predict') || !flag('titles')) await predict(pool)
    if (flag('titles')) await titles(pool)
  } finally { await endNeonPool() }
}
if (require.main === module) main().catch((e) => { console.error('[entity-decode-fix] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
