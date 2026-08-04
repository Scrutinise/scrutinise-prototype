// SERIES-KEY PARITY + UNIQUENESS CHECK.  `npm run check:series-key`
//
// Recomputes every series' key two ways — in Postgres (the expression the backfill migration
// uses) and in TypeScript (lib/series-key.ts, which the ingest path uses) — and asserts they
// agree, that every stored key matches, and that no two series collide. Exits non-zero on any
// of the three.
//
// Written as a PRE-migration check on 2026-08-04 and kept because it is the standing guard on
// the thing that matters: an encoding mismatch between the two implementations found here
// costs nothing, whereas found later it means the ingest path silently forks a duplicate
// series on every run and the search thread has indexed keys that don't resolve. Run it after
// any change to lib/series-key.ts, to the migration expression, or to a source's seriesLabel.
import { getStatsPrisma } from './lib/db'
import { computeSeriesKey } from './lib/series-key'

async function main() {
  const p = getStatsPrisma()
  const rows = await p.$queryRaw<{
    id: string; sqlKey: string; storedKey: string; datasetId: string; measure: string; geography: string
    cofogFunctionCode: string | null; forecastVintage: string | null; seriesLabel: string
  }[]>`
    SELECT id, "seriesKey" AS "storedKey",
      encode(sha256(convert_to(
        "datasetId"                            || E'\x1f' ||
        measure                                || E'\x1f' ||
        geography                              || E'\x1f' ||
        coalesce("cofogFunctionCode", E'\x1e') || E'\x1f' ||
        coalesce("forecastVintage",  E'\x1e')  || E'\x1f' ||
        "seriesLabel"
      , 'UTF8')), 'hex') AS "sqlKey",
      "datasetId", measure, geography, "cofogFunctionCode", "forecastVintage", "seriesLabel"
    FROM stat_series
  `
  let mismatch = 0
  let stale = 0
  const seen = new Map<string, number>()
  for (const r of rows) {
    const ts = computeSeriesKey(r)
    if (ts !== r.sqlKey) {
      if (mismatch < 5) console.log(`SQL/TS MISMATCH ${r.id}\n  sql=${r.sqlKey}\n  ts =${ts}\n  label="${r.seriesLabel}"`)
      mismatch++
    }
    // The stored key must equal what the identity fields say it should be. A drift here means
    // a series' identity was edited in place without re-keying — the one way a "stable" key
    // can quietly stop being stable.
    if (r.storedKey !== ts) {
      if (stale < 5) console.log(`STORED KEY STALE ${r.id}\n  stored=${r.storedKey}\n  should=${ts}\n  label="${r.seriesLabel}"`)
      stale++
    }
    seen.set(r.sqlKey, (seen.get(r.sqlKey) ?? 0) + 1)
  }
  const dupes = [...seen.entries()].filter(([, n]) => n > 1)
  console.log(`rows=${rows.length}  sql/ts mismatches=${mismatch}  stored-key drift=${stale}  distinct keys=${seen.size}  colliding keys=${dupes.length}`)
  // Non-ASCII sanity: labels here carry em-dashes and £ signs, which is exactly where a
  // convert_to/UTF-8 mismatch would show up if there were one.
  const nonAscii = rows.filter((r) => /[^\x00-\x7f]/.test(r.seriesLabel))
  console.log(`labels containing non-ASCII: ${nonAscii.length} (e.g. "${nonAscii[0]?.seriesLabel ?? '—'}")`)
  await p.$disconnect()
  if (mismatch > 0 || stale > 0 || dupes.length > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
