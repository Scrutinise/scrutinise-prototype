/**
 * probe-3c2-speech2.ts — GRAPH 3C-2, part 2. The scoped questions §1's probe timed out on.
 *
 * Part 1 established that `pwdata-debates` (6,391,345 rows, 5,693,886 with a speaker) and
 * `pwdata-lords` (754,546 / 707,013) carry speaker-attributed Hansard, and that the graph holds no
 * speech-derived signal — so speech is non-circular today.
 *
 * ⚠⚠ ONE THING TO SETTLE BEFORE ANYTHING ELSE, BECAUSE THE NAME LOOKS LIKE THE THING CHARLIE
 * FORBADE. `pwdata` is TheyWorkForYou's bulk data. The brief says: *"Never a vote-derived source.
 * TheyWorkForYou position summaries and equivalents are computed from the same divisions the graph
 * uses; they would be circular while appearing independent."* That prohibition is about their
 * COMPUTED SUMMARIES ("voted consistently for…"), which are a function of division data. These rows
 * are the verbatim Hansard transcript that TWFY republishes — the member's own words, spoken in the
 * chamber, with no computation over any vote anywhere. §4 below reads one and shows it.
 *
 * Usage (from scripts/graph):  npx tsx probe-3c2-speech2.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
import { r2Get } from '../ingest/shared/r2-client'

export {}

/** Strip the honorifics Hansard and MNIS spell differently, for an EXACT compare after. */
const NORM = `lower(regexp_replace(regexp_replace($X$, '\\s*(MP|QC|KC)\\s*$', '', 'gi'), '^(the )?(rt\\.? hon\\.?|right honourable|sir|dame|lord|baroness|earl|viscount|mr\\.?|mrs\\.?|ms\\.?|miss|dr\\.?|prof\\.?)\\s+', '', 'gi'))`

async function main() {
  const pool = getNeonPool()
  try {
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
    if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host})`); process.exit(1) }
    console.log(`host ${host}`)

    // ── 1 · what IS a row? one speech, or one debate? ────────────────────────────────────────
    console.log(`\n════ 1 · WHAT IS ONE ROW? ════`)
    const { rows: shape } = await pool.query<Record<string, string | null>>(`
      SELECT id, "sectionTitle", speaker, "itemDate"::text AS d, "wordCount"::text AS wc,
             "sourceUrl", "r2Key", "parentDocId", licence, corpus
        FROM corpus_sections
       WHERE corpus = 'pwdata-debates' AND speaker IS NOT NULL AND speaker <> ''
         AND "sectionTitle" ILIKE '%Terminally Ill Adults%'
       ORDER BY "wordCount" DESC NULLS LAST LIMIT 3`)
    for (const s of shape) {
      console.log(`  id          ${s.id}`)
      console.log(`  title       ${(s.sectionTitle ?? '').slice(0, 92)}`)
      console.log(`  speaker     ${s.speaker}`)
      console.log(`  date        ${s.d}    words ${s.wc}    licence ${s.licence ?? '(null)'}`)
      console.log(`  parentDocId ${s.parentDocId ?? '(null)'}`)
      console.log(`  sourceUrl   ${(s.sourceUrl ?? '(null)').slice(0, 112)}`)
      console.log(`  r2Key       ${s.r2Key ?? '(null)'}`)
      console.log()
    }
    const { rows: [wc] } = await pool.query<{ med: string; p90: string; n: string }>(`
      SELECT PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY "wordCount")::text AS med,
             PERCENTILE_DISC(0.9) WITHIN GROUP (ORDER BY "wordCount")::text AS p90,
             COUNT(*)::text AS n
        FROM corpus_sections WHERE corpus = 'pwdata-debates' AND "wordCount" IS NOT NULL`)
    console.log(`  word count over ${Number(wc.n).toLocaleString()} rows: median ${wc.med}, p90 ${wc.p90}` +
      `  ⇒ ${Number(wc.med) < 400 ? 'one row is ONE SPEECH, not a whole debate' : 'rows look like whole debates'}`)

    // ── 2 · the matters, in debate titles, with speaker counts ───────────────────────────────
    console.log(`\n════ 2 · SPEECHES PER MATTER, IN THE TWO pwdata CORPORA ════`)
    const MATTERS: Array<[string, string]> = [
      ['M1 assisted dying', 'Terminally Ill Adults'],
      ['M2 Rwanda', 'Safety of Rwanda'],
      ['M3 illegal migration', 'Illegal Migration'],
      ['M4 nationality/borders', 'Nationality and Borders'],
      ['M5 EU withdrawal', 'European Union (Withdrawal)'],
      ['M6 smoking ban', 'Tobacco and Vapes'],
      ['M7 public order', 'Public Order Bill'],
      ['M8 minimum service levels', 'Minimum Service Levels'],
      ['M9 environment', 'Environment Bill'],
      ['M10 retained EU law', 'Retained EU Law'],
    ]
    console.log(`  ${'matter'.padEnd(26)} ${'speeches'.padStart(9)} ${'speakers'.padStart(9)}  date range`)
    for (const [label, needle] of MATTERS) {
      const { rows: [r] } = await pool.query<{ n: string; d: string; lo: string | null; hi: string | null }>(`
        SELECT COUNT(*)::text AS n, COUNT(DISTINCT speaker)::text AS d,
               MIN("itemDate")::text AS lo, MAX("itemDate")::text AS hi
          FROM corpus_sections
         WHERE corpus IN ('pwdata-debates','pwdata-lords')
           AND speaker IS NOT NULL AND speaker <> ''
           AND "sectionTitle" ILIKE '%' || $1 || '%'`, [needle])
      console.log(`  ${label.padEnd(26)} ${Number(r.n).toLocaleString().padStart(9)} ${Number(r.d).toLocaleString().padStart(9)}  ${r.lo ?? '—'} → ${r.hi ?? '—'}`)
    }

    // ── 3 · identity: can a SPEAKER resolve to exactly one MNIS person? ─────────────────────
    //
    // Scoped to the speakers who actually appear on these matters, not the whole 5.7M-row corpus
    // (that query timed out, which is a fact about the query and not about the data).
    console.log(`\n════ 3 · IDENTITY — speaker → MNIS, by EXACT normalised name only ════`)
    const { rows: idres } = await pool.query<{ total: string; one: string; many: string; none: string }>(`
      WITH s AS (
        SELECT DISTINCT speaker FROM corpus_sections
         WHERE corpus IN ('pwdata-debates','pwdata-lords')
           AND speaker IS NOT NULL AND speaker <> ''
           AND ("sectionTitle" ILIKE '%Terminally Ill Adults%'
             OR "sectionTitle" ILIKE '%Safety of Rwanda%'
             OR "sectionTitle" ILIKE '%Tobacco and Vapes%')
      ), m AS (
        SELECT s.speaker,
               (SELECT COUNT(*) FROM graph_entity g
                 WHERE g.kind = 'person' AND g.parl_member_id IS NOT NULL
                   AND ${NORM.replace('$X$', 'g.canonical_name')} = ${NORM.replace('$X$', 's.speaker')}) AS c
          FROM s)
      SELECT COUNT(*)::text AS total,
             COUNT(*) FILTER (WHERE c = 1)::text AS one,
             COUNT(*) FILTER (WHERE c > 1)::text AS many,
             COUNT(*) FILTER (WHERE c = 0)::text AS none
        FROM m`)
    const r3 = idres[0]
    console.log(`  distinct speakers on three sampled matters: ${Number(r3.total).toLocaleString()}`)
    console.log(`    resolve to EXACTLY ONE MNIS person : ${Number(r3.one).toLocaleString()}  (${((100 * Number(r3.one)) / Number(r3.total)).toFixed(1)}%)`)
    console.log(`    ambiguous (2+ candidates)          : ${r3.many}   ← must stay unresolved, by rule`)
    console.log(`    no match at all                    : ${Number(r3.none).toLocaleString()}`)
    const { rows: nomatch } = await pool.query<{ speaker: string }>(`
      SELECT DISTINCT speaker FROM corpus_sections
       WHERE corpus IN ('pwdata-debates','pwdata-lords') AND speaker IS NOT NULL AND speaker <> ''
         AND "sectionTitle" ILIKE '%Terminally Ill Adults%'
         AND NOT EXISTS (SELECT 1 FROM graph_entity g WHERE g.kind='person' AND g.parl_member_id IS NOT NULL
                          AND ${NORM.replace('$X$', 'g.canonical_name')} = ${NORM.replace('$X$', 'corpus_sections.speaker')})
       LIMIT 10`)
    if (nomatch.length) {
      console.log(`  a few that do not match, so the miss can be argued with:`)
      for (const n of nomatch) console.log(`     "${n.speaker}"`)
    }

    // ── 4 · READ ONE. The whole route depends on the text being real. ───────────────────────
    console.log(`\n════ 4 · READ AN ACTUAL SPEECH OUT OF R2 ════`)
    const { rows: one } = await pool.query<{ id: string; speaker: string; d: string; key: string; url: string; title: string }>(`
      SELECT id, speaker, "itemDate"::text AS d, "r2Key" AS key, "sourceUrl" AS url, "sectionTitle" AS title
        FROM corpus_sections
       WHERE corpus = 'pwdata-debates' AND "sectionTitle" ILIKE '%Terminally Ill Adults%'
         AND speaker ILIKE '%Leigh%' AND "wordCount" > 60
       ORDER BY "itemDate" LIMIT 2`)
    if (!one.length) console.log('  (no Leigh speech found on that title — trying any speaker)')
    const targets = one.length ? one : (await pool.query<{ id: string; speaker: string; d: string; key: string; url: string; title: string }>(`
      SELECT id, speaker, "itemDate"::text AS d, "r2Key" AS key, "sourceUrl" AS url, "sectionTitle" AS title
        FROM corpus_sections
       WHERE corpus = 'pwdata-debates' AND "sectionTitle" ILIKE '%Terminally Ill Adults%'
         AND "wordCount" BETWEEN 80 AND 400
       ORDER BY "itemDate" LIMIT 2`)).rows
    for (const t of targets) {
      console.log(`  ── ${t.speaker} · ${t.d} · ${t.id}`)
      console.log(`     ${t.url}`)
      if (!t.key) { console.log('     ⛔ no r2Key — text not stored'); continue }
      try {
        const text = ((await r2Get(t.key)) ?? '').replace(/\s+/g, ' ').trim()
        console.log(`     ${text.length.toLocaleString()} chars`)
        console.log(`     "${text.slice(0, 460)}${text.length > 460 ? '…' : ''}"`)
      } catch (e) {
        console.log(`     ⛔ R2 read failed: ${e instanceof Error ? e.message : e}`)
      }
      console.log()
    }
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[probe-3c2-speech2] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
