/**
 * s3-refformat-check.ts — is the "shortfall" real, or is my section-ref matcher wrong?
 *
 * `s3-shortfall-triage.ts` reported 3,856 of 3,857 orphaned legacy sections as REAL
 * TEXT, which would block the DROP outright. Before that is believed, the matcher has
 * to be checked: it compares `LegislationSection.sectionNumber` against a number pulled
 * off the tail of the corpus id with `/([0-9]+[A-Za-z]*)$/`.
 *
 * That regex cannot match several real conventions:
 *   legacy "45.42" vs corpus `rule-45-42`      → extracts "42"
 *   legacy "T6"    vs corpus `regulation-t6`   → extracts "6"
 *   legacy "36.5"  vs corpus `rule-36-5`       → extracts "5"
 *
 * so a format difference would present as a total loss of text. This prints the two id
 * vocabularies side by side for the worst instruments, which settles it by inspection
 * rather than by a second guess.
 *
 * Read-only.
 *
 * Usage: tsx s3-refformat-check.ts [--gid uksi/2016/990]
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const GID = (() => { const i = process.argv.indexOf('--gid'); return i >= 0 ? process.argv[i + 1] : null })()
const DEFAULTS = ['uksi/2016/990', 'uksi/2023/572', 'uksi/1995/300', 'ukpga/2015/21']

async function main() {
  const pool = getNeonPool()
  const gids = GID ? [GID] : DEFAULTS

  // ⚠ ONE scan, not one per instrument. `split_part(id, ':', 2) = $1` is a functional
  // predicate with no index, so a per-gid loop full-scans 18.3M rows each time and times
  // out. Pull all the wanted instruments in a single pass and group in memory.
  const { rows: corpusAll } = await pool.query(
    `SELECT split_part(id, ':', 2) AS gid, id, "sectionTitle"
       FROM corpus_sections WHERE split_part(id, ':', 2) = ANY($1::text[])`, [gids])
  const { rows: legacyAll } = await pool.query(
    `SELECT li."legislationGovUkId" AS gid, ls."sectionNumber", ls."sectionTitle"
       FROM "LegislationSection" ls JOIN "LegislationItem" li ON li.id = ls."legislationItemId"
      WHERE li."legislationGovUkId" = ANY($1::text[])`, [gids])

  for (const gid of gids) {
    const legacy = legacyAll.filter((r: any) => r.gid === gid)
    const corpus = corpusAll.filter((r: any) => r.gid === gid)

    console.log(`\n═══ ${gid} — legacy ${legacy.length} · corpus ${corpus.length} ═══`)
    console.log(`  legacy sectionNumbers : ${legacy.slice(0, 18).map((r: any) => r.sectionNumber).join(', ')}`)
    console.log(`  corpus id tails       : ${corpus.slice(0, 18).map((r: any) => String(r.id).split(':').pop()).join(', ')}`)

    // Title overlap is format-independent — if the same provisions are held under
    // different refs, the titles still line up.
    const norm = (s: any) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const corpusTitles = new Set(corpus.map((r: any) => norm(r.sectionTitle)).filter((s: string) => s.length > 6))
    const legacyTitles = legacy.map((r: any) => norm(r.sectionTitle)).filter((s: string) => s.length > 6)
    const matched = legacyTitles.filter((t: string) => corpusTitles.has(t)).length
    console.log(`  legacy titles usable ${legacyTitles.length} · matched in corpus by TITLE: ${matched}` +
      (legacyTitles.length ? ` (${((matched / legacyTitles.length) * 100).toFixed(0)}%)` : ''))
  }
  await endNeonPool()
}

main().catch((e) => { console.error(e); process.exit(1) })
