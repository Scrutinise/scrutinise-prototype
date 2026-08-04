// ONE-OFF BACKFILL (2026-08-05) — re-label Phase B series from alpha-3 codes to country names,
// and RE-KEY them so the ingest handlers still land on the same rows.
//
// WHY. `geographyLabel()` used to fall through to the alpha-3 code, so every comparative series
// was labelled "GBR — Health expenditure (% of GDP)". That is what made the UK's own rows look
// mislabelled and prompted a proposal to rewrite the stored geography from `GB` to `UK` — the
// wrong fix, since `GB` IS the ISO-3166-1 alpha-2 code for the United Kingdom and is what makes
// UK figures line up with their comparators (STATS_SCHEMA.md § Geography). The DISPLAY was the
// problem, so the display was fixed: labels now read "United Kingdom — …".
//
// WHY IT NEEDS A SCRIPT AND NOT JUST A RE-RUN. `seriesLabel` is part of `seriesKey`. A handler
// re-run after the label change would compute a NEW key for every comparative series and mint a
// duplicate row beside the old one — precisely the failure `seriesKey` exists to prevent (it is
// how 27 stale tax-gap series came to double-count 540 observations on 1 Aug). So the rename and
// the re-key have to happen together, in place, BEFORE the next ingest. This is the documented
// cost of putting `seriesLabel` in the identity, and this script is what paying it looks like.
//
// Idempotent: a second run finds nothing to do. Safe to re-run.
// Usage: npx tsx --tsconfig ../tsconfig.json backfill-geography-labels.ts [--dry-run]
import { getStatsPrisma } from './lib/db'
import { geographyLabel } from './lib/iso'
import { computeSeriesKey } from './lib/series-key'

/** The datasets whose seriesLabel is built with geographyLabel(). */
const AFFECTED = ['wb-wdi-comparative', 'oecd-cofog-expenditure', 'imf-gfs-cofog']

const SEP = ' — '

async function main() {
  const dry = process.argv.includes('--dry-run')
  const prisma = getStatsPrisma()

  const series = await prisma.statSeries.findMany({
    where: { datasetId: { in: AFFECTED } },
    select: {
      id: true, seriesKey: true, seriesLabel: true, datasetId: true, measure: true,
      geography: true, cofogFunctionCode: true, forecastVintage: true,
    },
  })
  console.log(`${series.length} series in ${AFFECTED.length} comparative datasets`)

  const planned: Array<{ id: string; from: string; to: string; oldKey: string; newKey: string }> = []
  let alreadyRight = 0
  let unrecognised = 0

  for (const s of series) {
    const want = geographyLabel(s.geography)
    const idx = s.seriesLabel.indexOf(SEP)
    if (idx === -1) { unrecognised++; continue }
    const prefix = s.seriesLabel.slice(0, idx)
    if (prefix === want) { alreadyRight++; continue }
    const newLabel = want + s.seriesLabel.slice(idx)
    const newKey = computeSeriesKey({ ...s, seriesLabel: newLabel })
    planned.push({ id: s.id, from: s.seriesLabel, to: newLabel, oldKey: s.seriesKey, newKey })
  }

  console.log(`  already correct: ${alreadyRight}`)
  console.log(`  no "${SEP.trim()}" separator (left alone): ${unrecognised}`)
  console.log(`  to rewrite: ${planned.length}`)
  for (const p of planned.slice(0, 5)) console.log(`    "${p.from}"\n      -> "${p.to}"`)
  if (planned.length > 5) console.log(`    … and ${planned.length - 5} more`)

  // A new key colliding with an existing one would mean two series becoming one. Refuse rather
  // than let an UPDATE fail halfway through with an opaque constraint violation.
  const existing = new Set(series.map((s) => s.seriesKey))
  const rewriting = new Set(planned.map((p) => p.oldKey))
  const collisions = planned.filter((p) => existing.has(p.newKey) && !rewriting.has(p.newKey))
  const dupeNew = planned.length !== new Set(planned.map((p) => p.newKey)).size
  if (collisions.length || dupeNew) {
    throw new Error(`REFUSING: ${collisions.length} new key(s) collide with existing series${dupeNew ? ', and the new keys are not unique among themselves' : ''}`)
  }

  if (dry) { console.log('--dry-run: no writes made.'); await prisma.$disconnect(); return }
  if (planned.length === 0) { console.log('Nothing to do.'); await prisma.$disconnect(); return }

  for (const p of planned) {
    await prisma.statSeries.update({
      where: { id: p.id },
      data: { seriesLabel: p.to, seriesKey: p.newKey },
    })
  }
  console.log(`Rewrote ${planned.length} series labels + keys.`)
  console.log('Now re-run the affected handlers; they must report the SAME series counts as before.')
  await prisma.$disconnect()
}

main().catch((e) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
