/**
 * v36-legacy-freshness.ts — V36 §1.4: "Does the legacy text match the source?"
 *
 * The brief's reasoning: if `LegislationSection` holds usable text for the missing
 * instruments, migrating it is far cheaper than re-fetching — but only if it is
 * current. So this compares, per sampled instrument:
 *
 *   legacy   — LegislationSection rows for that instrument (count, chars)
 *   source   — what enumerateSections returns from legislation.gov.uk TODAY
 *
 * A count that matches is weak evidence; a count that differs is strong evidence,
 * and the direction matters. Legacy > source means the source has since revoked or
 * de-digitised provisions. Source > legacy means the legacy copy is a stale snapshot
 * and migrating it would import a smaller, older corpus at full price.
 *
 * Read-only. Writes nothing to R2 or the database.
 *
 * Usage: tsx v36-legacy-freshness.ts [--n 20] [--seed 7]
 */
process.env.TNA_THROTTLE_FLOOR_MS = process.env.TNA_THROTTLE_FLOOR_MS ?? '1000'
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { Pool } from 'pg'

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}
const N = Number(arg('n') ?? 20)
const SEED = Number(arg('seed') ?? 7)
const OUT = path.join(__dirname, 'v36', `legacy-freshness-n${N}.json`)

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 1,
    statement_timeout: 900_000, query_timeout: 900_000,
  })

  await pool.query(`SELECT setseed($1)`, [Math.min(0.999999, SEED / 100)])
  const { rows: sample } = await pool.query(`
    SELECT ca.gid, ca.title, ca.year, ca.item_section_count, ca.legislation_item_id
    FROM corpus_acts ca
    WHERE ca.in_corpus = false AND ca.in_legislation_item = true
      AND COALESCE(ca.item_section_count, 0) > 0
    ORDER BY random() LIMIT $1`, [N])

  const results: Record<string, unknown>[] = []
  const { enumerateSections } = await import('./sources/tna-legislation')

  for (const row of sample) {
    const { rows: legacy } = await pool.query(
      `SELECT count(*)::int AS n, COALESCE(sum(length("originalText")),0)::bigint AS chars
       FROM "LegislationSection" WHERE "legislationItemId" = $1`, [row.legislation_item_id])

    let sourceSections = 0, sourceChars = 0, note = ''
    try {
      const secs = await enumerateSections(row.gid as string)
      const usable = secs.filter(s => s.format !== 'unavailable' && s.format !== 'effects')
      sourceSections = usable.length
      sourceChars = usable.reduce((a, s) => a + (s.xml?.length ?? s.rawHtml?.length ?? s.pdfBuffer?.length ?? 0), 0)
      const un = secs.find(s => s.format === 'unavailable')
      if (un) note = `${un.errorMsg}${un.classifiedAs ? ` / ${un.classifiedAs}` : ''}`
    } catch (e) { note = `THREW ${e}` }

    const legacyN = Number(legacy[0].n), legacyChars = Number(legacy[0].chars)
    const verdict = sourceSections === 0 ? 'SOURCE HAS NOTHING — legacy is the only copy'
      : sourceSections > legacyN ? 'source RICHER than legacy (legacy is a stale snapshot)'
      : sourceSections === legacyN ? 'equal section count'
      : 'legacy richer than source'
    results.push({
      gid: row.gid, title: String(row.title ?? '').slice(0, 60), year: row.year,
      legacy_sections: legacyN, legacy_chars: legacyChars,
      source_sections: sourceSections, source_xml_chars: sourceChars,
      verdict, note,
    })
    console.log(`${String(row.gid).padEnd(18)} legacy=${String(legacyN).padStart(4)}  source=${String(sourceSections).padStart(4)}  ${verdict}${note ? `  [${note}]` : ''}`)
  }
  await pool.end()

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({ seed: SEED, n: sample.length, results }, null, 1))

  const tally = results.reduce<Record<string, number>>((a, r) => { a[r.verdict as string] = (a[r.verdict as string] ?? 0) + 1; return a }, {})
  console.log('\n[freshness] verdicts over', results.length, 'sampled instruments:')
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`)
  console.log(`[freshness] written to ${OUT}`)
}

main().catch(e => { console.error(e); process.exitCode = 1 })
