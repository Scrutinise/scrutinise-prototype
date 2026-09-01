// ─────────────────────────────────────────────────────────────────────────────
// 25-P §2c — BACKFILL WHAT CAN BE RECOVERED, AND REPORT WHAT CANNOT.
//
// §2c: *"Backfill what can be recovered, and report how many rows could not be dated and why —
// an undated row must be visibly undated, not silently assumed current."*
//
// ⚠⚠ THE REPORT IS THE DELIVERABLE, NOT THE BACKFILL. The number that matters to a reader of the
// proposal is how much of its evidence has no date at all, and why. A backfill that quietly dated
// 60% and said nothing about the other 40% would leave exactly the impression §2 exists to
// remove.
//
// Two recovery routes, in order of how much they can be trusted:
//   1. THE CORPUS ROW — `corpus_sections.itemDate` for the row the finding cites. Authoritative.
//   2. THE URL — a date in the path. ⚠ A filename, not a record; used only where 1 fails, and
//      recorded as `URL` so a reader can tell a recovered date from a real one.
//
// ⚠ DRY RUN BY DEFAULT. `--write` performs the update; without it nothing is written and the
// same report is printed. A backfill over every row of a live table is not a thing to trigger by
// running a script with no arguments.
//
// Usage: npm run backfill:evidence-dates [-- --write] [--idea <idPrefix>]
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import {
  readCorpusDate, dateFromUrl, BASIS_MEANING,
  type EvidenceDateBasis,
} from '../lib/lex/evidence-date'

const WRITE = process.argv.includes('--write')
const ideaArg = process.argv[process.argv.indexOf('--idea') + 1]
const IDEA = process.argv.includes('--idea') ? ideaArg : null

type Row = { id: string; sourceId: string | null; url: string | null; sourceDateBasis: string | null }

async function main() {
  console.log(`\n── 25-P §2c — evidence dates ${WRITE ? '(WRITING)' : '(dry run)'} ──\n`)

  const where = {
    sourceDate: null,
    ...(IDEA ? { idea: { id: { startsWith: IDEA } } } : {}),
  }
  const rows: Row[] = await prisma.evidenceItem.findMany({
    where,
    select: { id: true, sourceId: true, url: true, sourceDateBasis: true },
  })
  // One `where` shape, always present — a conditional argument object is not a narrower query,
  // it is two queries typed as one.
  const scopeWhere = IDEA ? { idea: { id: { startsWith: IDEA } } } : {}
  const total = await prisma.evidenceItem.count({ where: scopeWhere })
  console.log(`${total} evidence rows, ${rows.length} of them with no date.\n`)
  if (!rows.length) { console.log('Nothing to do.'); return }

  // ── 1. THE CORPUS ROW ──────────────────────────────────────────────────────
  //
  // ⚠ ONE BATCHED READ, NOT ONE PER ROW. 25-O measured a panel doing 127ms of duplicate fetches
  // and this table is far larger than that panel's.
  const ids = [...new Set(rows.map((r) => r.sourceId).filter((x): x is string => !!x))]
  const corpus = new Map<string, string | null>()
  const CHUNK = 2000
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK)
    const found = await prisma.$queryRaw<Array<{ id: string; itemDate: string | null }>>`
      SELECT s.id, s."itemDate"::text AS "itemDate"
      FROM corpus_sections s
      WHERE s.id = ANY(${slice}::text[])
    `
    for (const f of found) corpus.set(f.id, f.itemDate)
  }
  console.log(`Looked up ${ids.length} distinct source rows; ${corpus.size} are in the corpus.\n`)

  // ── 2. DECIDE EACH ROW ─────────────────────────────────────────────────────
  const decided = new Map<string, { date: Date | null; basis: EvidenceDateBasis }>()
  for (const r of rows) {
    if (r.sourceId && corpus.has(r.sourceId)) {
      const { date, basis } = readCorpusDate(corpus.get(r.sourceId))
      if (date) { decided.set(r.id, { date, basis: 'CORPUS_ROW' }); continue }
      // The corpus row is there and undated — try the URL before recording that as final.
      const fromUrl = dateFromUrl(r.url)
      decided.set(r.id, fromUrl ? { date: fromUrl, basis: 'URL' } : { date: null, basis })
      continue
    }
    // No corpus row at all. ⚠ THE URL IS THE ONLY ROUTE LEFT, and this is the route that would
    // have dated the 2014 Lords claim: its date was in `…/lords/2014/jan/16/…` and nowhere else.
    const fromUrl = dateFromUrl(r.url)
    decided.set(r.id, fromUrl ? { date: fromUrl, basis: 'URL' } : { date: null, basis: 'NO_SOURCE_ROW' })
  }

  const tally = new Map<EvidenceDateBasis, number>()
  for (const d of decided.values()) tally.set(d.basis, (tally.get(d.basis) ?? 0) + 1)
  const dated = [...decided.values()].filter((d) => d.date).length

  console.log(`── what could be recovered ──`)
  console.log(`  dated:   ${dated} of ${rows.length}`)
  console.log(`  undated: ${rows.length - dated}\n`)
  console.log(`── and why, per row ──`)
  for (const [basis, n] of [...tally.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(6)}  ${basis.padEnd(20)} ${BASIS_MEANING[basis]}`)
  }

  // ⚠ A SAMPLE OF WHAT COULD NOT BE DATED, NAMED. A count with no examples is a number nobody
  // can act on; five rows with their urls is a number somebody can go and look at.
  const stuck = rows.filter((r) => !decided.get(r.id)?.date).slice(0, 5)
  if (stuck.length) {
    console.log(`\n── five that could not be dated ──`)
    for (const r of stuck) {
      console.log(`  ${r.id.slice(0, 8)}  ${decided.get(r.id)?.basis.padEnd(20)} ${r.url ?? '(no url)'}`)
    }
  }

  if (!WRITE) {
    console.log(`\nDry run. Nothing written. Re-run with --write to apply.\n`)
    return
  }

  // ── 3. WRITE ───────────────────────────────────────────────────────────────
  //
  // ⚠ GROUPED BY (date, basis) SO THIS IS A HANDFUL OF UPDATEMANY CALLS, not one per row.
  const groups = new Map<string, { date: Date | null; basis: EvidenceDateBasis; ids: string[] }>()
  for (const [id, d] of decided) {
    const key = `${d.date?.toISOString() ?? 'null'}|${d.basis}`
    if (!groups.has(key)) groups.set(key, { date: d.date, basis: d.basis, ids: [] })
    groups.get(key)!.ids.push(id)
  }
  let written = 0
  for (const g of groups.values()) {
    const res = await prisma.evidenceItem.updateMany({
      where: { id: { in: g.ids } },
      data: { sourceDate: g.date, sourceDateBasis: g.basis },
    })
    written += res.count
  }

  // ⚠⚠ RE-READ, AND REPORT THE RE-READ. "Written" is a claim about a call; this is a claim about
  // the table. Three rows once reported as deleted were still there five days later.
  const stillNull = await prisma.evidenceItem.count({
    where: { sourceDateBasis: null, ...scopeWhere },
  })
  const nowDated = await prisma.evidenceItem.count({
    where: { sourceDate: { not: null }, ...scopeWhere },
  })
  console.log(`\nwrote ${written} rows.`)
  console.log(`re-read: ${nowDated} of ${total} rows now carry a date; ${stillNull} still have no basis recorded.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
