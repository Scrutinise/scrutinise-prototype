/**
 * audit-4a-t2-hole.ts — GRAPH 4A §2 (T2): how big is the OI-15 hole?
 *
 * Re-runs the `cites` extractor with the filter fixed, **over the 2,431 skipped
 * documents only**, and reports the delta. Prediction logged in `CHANGE_LOG.md`
 * (2026-08-26 12:41 UTC) before this ran: 1,000–2,000 new edges, ~1.2%.
 *
 * ⚠⚠ **WRITES NOTHING.** §1–§3 of the brief are measurement and produce no new
 * graph. It calls `insertEdges` never; the rows are counted in memory and thrown
 * away. Whether `legislation_edges` is re-extracted at all is a decision for
 * Charlie and depends on §6's answer, not on this number.
 *
 * ⚠ **IT IMPORTS `extractDoc` AND `legEntries` FROM THE REAL EXTRACTOR.** A
 * re-implementation would measure the re-implementation — 25-H lost an hour to
 * exactly that ("a control that is a copy tests the copy"). The only thing this
 * file decides is WHICH entries to feed it.
 *
 * ⚠ The brief's warning, tested explicitly: *an old Act can cite a modern one.*
 * legislation.gov.uk serves REVISED text, so a Victorian Act amended in 2012
 * carries the 2012 reference inserted by that amendment. `oldCitesModern` below
 * is that number; if it is 0 the "harmless" intuition was right.
 *
 *   npx tsx graph/audit-4a-t2-hole.ts [--json out.json]
 */
import fs from 'fs'
import { ZipReader } from './zip-reader'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { ENTRY_RX, gidFromEntry } from './audit-25h-citations'
import { extractDoc } from './extract-cites-edges'
import { dedupeEdges } from './graph-common'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
/** The filter as it shipped — used here to SELECT the complement, not to filter. */
const SHIPPED_RX = /\/([a-z]+)-(\d{4})-(\d+)-\w+-data\.xml$/

const CONTROLS: Array<[string, string]> = [
  ['ukpga/2010/15', 'Equality Act 2010'],
  ['ukpga/1998/42', 'Human Rights Act 1998'],
  ['ukpga/2010/25', 'CRAG 2010'],
  ['ukpga/2022/18', 'Down Syndrome Act 2022'],
]

/** Year of a gid, calendar form only; null for regnal. */
function calYear(gid: string): number | null {
  const m = gid.match(/^[a-z]+\/(\d{4})\//)
  return m ? parseInt(m[1], 10) : null
}

async function main() {
  const pool = getNeonPool()

  // The baseline: what the shipped table holds today, per control Act. Taken
  // BEFORE anything is extracted so the delta is against a read number.
  console.log('[4a-T2] baseline from legislation_edges…')
  const baseline = new Map<string, number>()
  for (const [gid] of CONTROLS) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int n FROM legislation_edges
       WHERE edge_type='cites' AND split_part(to_id, ':', 2) = $1`, [gid])
    baseline.set(gid, rows[0].n)
  }
  const { rows: tot } = await pool.query(
    `SELECT COUNT(*)::int n FROM legislation_edges WHERE edge_type='cites'`)
  const shippedTotal = tot[0].n
  console.log(`  cites rows in the table: ${shippedTotal.toLocaleString()}`)

  // The complement: entries the widened regex matches and the shipped one did not.
  console.log(`[4a-T2] opening ${ZIP_PATH}…`)
  const zip = new ZipReader(ZIP_PATH)
  const skipped = zip.entries
    .map(e => ({ e, m: e.name.match(ENTRY_RX) }))
    .filter((x): x is { e: typeof zip.entries[0]; m: RegExpMatchArray } => x.m != null && !SHIPPED_RX.test(x.e.name))
  console.log(`[4a-T2] ${skipped.length.toLocaleString()} documents the shipped filter skipped — extracting all of them`)

  let rows = 0, docs = 0, docErrors = 0, oldCitesModern = 0
  const perControl = new Map<string, number>(CONTROLS.map(([g]) => [g, 0]))
  const byType = new Map<string, number>()
  const targetActs = new Map<string, number>()
  const oldModernSample: string[] = []
  const t0 = Date.now()

  for (const { e, m } of skipped) {
    const gid = gidFromEntry(m)
    docs++
    let edges
    try {
      edges = dedupeEdges(extractDoc(gid, zip.readText(e)))
    } catch (err) {
      docErrors++
      console.error(`  DOC ERROR ${gid}: ${(err as Error).message}`)
      continue
    }
    rows += edges.length
    byType.set(m[1], (byType.get(m[1]) ?? 0) + edges.length)
    for (const edge of edges) {
      const toGid = edge.toId.split(':')[1]
      targetActs.set(toGid, (targetActs.get(toGid) ?? 0) + 1)
      if (perControl.has(toGid)) perControl.set(toGid, perControl.get(toGid)! + 1)
      // the brief's trap: a pre-1963 source citing a post-2000 target
      const ty = calYear(toGid)
      if (ty !== null && ty >= 2000) {
        oldCitesModern++
        if (oldModernSample.length < 10) oldModernSample.push(`${gid} → ${toGid}`)
      }
    }
    if (docs % 400 === 0) console.log(`  ${docs}/${skipped.length} docs, rows=${rows}, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  }
  zip.close()

  const pct = 100 * rows / shippedTotal
  console.log(`\n══ T2 RESULT ══`)
  console.log(`  documents re-read      : ${docs.toLocaleString()} (${docErrors} errors)`)
  console.log(`  cites edges recovered  : ${rows.toLocaleString()}`)
  console.log(`  as a share of the shipped ${shippedTotal.toLocaleString()}: ${pct.toFixed(2)}%`)
  console.log(`  → threshold is 3%: ${pct < 3 ? 'UNDER — proceed, record the residual as a declared limitation' : 'OVER — fix before anything consumes the graph'}`)
  console.log(`  distinct target instruments: ${targetActs.size.toLocaleString()}`)

  console.log(`\n  by source doctype:`)
  for (const [t, n] of [...byType.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${t.padEnd(8)} ${String(n).padStart(7)}`)

  console.log(`\n  ⚠ pre-1963 source → post-2000 target: ${oldCitesModern.toLocaleString()} edges`)
  console.log(`     (legislation.gov.uk serves REVISED text — a Victorian Act amended in 2012`)
  console.log(`      carries the 2012 reference. ${oldCitesModern === 0 ? 'ZERO: the "harmless" intuition was RIGHT.' : 'Non-zero: the intuition was WRONG.'})`)
  for (const s of oldModernSample) console.log(`       ${s}`)

  console.log(`\n  the four control Acts — delta from the skipped documents:`)
  for (const [gid, name] of CONTROLS) {
    const b = baseline.get(gid)!
    const d = perControl.get(gid)!
    console.log(`    ${name.padEnd(24)} ${String(b).padStart(6)} → ${String(b + d).padStart(6)}   (+${d}${b > 0 ? `, +${(100 * d / b).toFixed(1)}%` : ''})`)
  }

  console.log(`\n  the ten instruments the hole costs most:`)
  for (const [g, n] of [...targetActs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`    ${g.padEnd(28)} +${n}`)

  const out = {
    at: new Date().toISOString(), skippedDocs: skipped.length, docs, docErrors,
    recoveredEdges: rows, shippedTotal, pctOfShipped: pct, underThreePercent: pct < 3,
    oldCitesModern, oldModernSample, distinctTargets: targetActs.size,
    byType: Object.fromEntries(byType),
    controls: CONTROLS.map(([gid, name]) => ({ gid, name, before: baseline.get(gid), delta: perControl.get(gid), after: baseline.get(gid)! + perControl.get(gid)! })),
    topTargets: [...targetActs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40),
  }
  const jsonIx = process.argv.indexOf('--json')
  if (jsonIx >= 0 && process.argv[jsonIx + 1]) {
    fs.writeFileSync(process.argv[jsonIx + 1], JSON.stringify(out, null, 1))
    console.log(`\n[4a-T2] → ${process.argv[jsonIx + 1]}`)
  }
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[4a-T2] FATAL', e); process.exit(1) })
}
