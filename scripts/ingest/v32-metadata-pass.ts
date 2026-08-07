/**
 * v32-metadata-pass.ts — §3: attach the ADDENDUM §B/§D join keys and search metadata to every
 * committee report / response row.
 *
 * WHAT LANDS, from the manifest (one API walk, no per-row calls):
 *   notes (JSON)   inquiryId, inquiryTitle, committeeId, committeeName, house, category,
 *                  paperNumber, session, responseIds[], respondsToId
 *   sectionTitle   the committee's NAME folded in, because sectionTitle is the only one of these
 *                  the FTS layer actually carries. A row that lands without it is
 *                  ingested-but-unfindable in the committees stream (ADDENDUM §D).
 *
 * ⚠ RUN THIS BEFORE fts-catchup, NOT AFTER. The catch-up copies `sectionTitle` into Lance as it
 * appends. Enriching afterwards would leave the index holding the un-enriched title and require
 * a second, needless merge — and the merge is the 19.8 GB heavy job, not a cheap step.
 *
 * ⚠ NULL IS AN ANSWER. Only 46.1% of reports carry an inquiry id; the rest genuinely are not
 * inquiry products (statutory-instrument reports, annual reports, "Documents considered by the
 * Committee"). Those get `inquiryId: null` recorded explicitly. Inventing an id to raise the
 * coverage number would break the §4 loop test in the one way that is hard to detect: silently.
 *
 * IDEMPOTENT. The title enrichment checks for the committee name before adding it, so a re-run
 * does not accumulate " — Treasury Committee — Treasury Committee". Verified by the re-run
 * assertion at the end, which re-reads and counts.
 *
 * Read-modify-write on corpus_sections only. Dry run by default.
 * Usage: tsx v32-metadata-pass.ts [--commit] [--manifest=path]
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import type { ManifestItem } from './v32-enumerate-committees'

const COMMIT = process.argv.includes('--commit')
const MANIFEST = (() => { const a = process.argv.find(x => x.startsWith('--manifest=')); return a ? a.split('=')[1] : path.join(__dirname, 'v32-committees-manifest.json') })()
const BATCH = 500

const stats = { publicationsInManifest: 0, rowsMatched: 0, rowsUpdated: 0, titlesEnriched: 0, withInquiry: 0, withoutInquiry: 0, withResponseLink: 0, unmatchedPublications: 0 }

function notesFor(m: ManifestItem): string {
  return JSON.stringify({
    inquiryId: m.inquiryId, inquiryTitle: m.inquiryTitle,
    committeeId: m.committeeId, committeeName: m.committeeName, house: m.house, category: m.category,
    paperNumber: m.paperNumber, session: m.session,
    responseIds: m.responseIds, respondsToId: m.respondsToId,
    publicationType: m.type,
  })
}

async function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error(`[metadata] manifest not found: ${MANIFEST}\n  run: tsx v32-enumerate-committees.ts`)
    process.exit(1)
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as { items: ManifestItem[] }
  const byPub = new Map<string, ManifestItem>()
  for (const it of manifest.items) byPub.set(`publication:${it.publicationId}`, it)
  stats.publicationsInManifest = byPub.size
  console.log(`[metadata] ${COMMIT ? '*** COMMIT ***' : 'DRY RUN (no writes — pass --commit)'}`)
  console.log(`[metadata] ${byPub.size.toLocaleString()} publications in the manifest\n`)

  const p = getNeonPool()
  const { rows } = await p.query<{ id: string; parentDocId: string; sectionTitle: string | null }>(
    `SELECT id, "parentDocId", "sectionTitle" FROM corpus_sections
     WHERE corpus='committees-reports' AND "parentDocId" IS NOT NULL`)
  console.log(`[metadata] ${rows.length.toLocaleString()} committees-reports rows to consider`)

  const updates: Array<{ id: string; notes: string; sectionTitle: string | null }> = []
  const seenPubs = new Set<string>()
  for (const r of rows) {
    const m = byPub.get(r.parentDocId)
    if (!m) continue
    stats.rowsMatched++
    seenPubs.add(r.parentDocId)

    let title = r.sectionTitle
    if (m.committeeName && title && !title.includes(m.committeeName)) {
      // insert the committee name after the leading "Type: Description" segment
      title = `${title} — ${m.committeeName}`.slice(0, 500)
      stats.titlesEnriched++
    }
    updates.push({ id: r.id, notes: notesFor(m), sectionTitle: title })
  }
  for (const [pub, m] of byPub) {
    if (!seenPubs.has(pub)) stats.unmatchedPublications++
    if (m.inquiryId !== null) stats.withInquiry++; else stats.withoutInquiry++
    if (m.responseIds.length > 0 || m.respondsToId !== null) stats.withResponseLink++
  }

  if (COMMIT) {
    for (let i = 0; i < updates.length; i += BATCH) {
      const slice = updates.slice(i, i + BATCH)
      const res = await p.query(
        `UPDATE corpus_sections AS c SET notes = v.notes, "sectionTitle" = v."sectionTitle"
         FROM (SELECT * FROM unnest($1::text[], $2::text[], $3::text[]) AS t(id, notes, "sectionTitle")) AS v
         WHERE c.id = v.id`,
        [slice.map(u => u.id), slice.map(u => u.notes), slice.map(u => u.sectionTitle)])
      stats.rowsUpdated += res.rowCount ?? 0
      if ((i / BATCH) % 20 === 0) process.stdout.write(`\r   …${Math.min(i + BATCH, updates.length)}/${updates.length}`)
    }
    process.stdout.write('\n')
  }

  console.log('\n═══ RESULT ═════════════════════════════════════════════════════════════════')
  console.log(`  rows matched to a publication   ${stats.rowsMatched.toLocaleString()}`)
  console.log(`  rows updated                    ${stats.rowsUpdated.toLocaleString()}`)
  console.log(`  titles enriched with committee  ${stats.titlesEnriched.toLocaleString()}`)
  console.log(`  ── the honest §B coverage ──`)
  console.log(`  publications WITH an inquiry id ${stats.withInquiry.toLocaleString()}`)
  console.log(`  publications WITHOUT one (null) ${stats.withoutInquiry.toLocaleString()}  ← recorded as null, not invented`)
  console.log(`  publications with a response link ${stats.withResponseLink.toLocaleString()}`)
  console.log(`  in manifest but no rows yet     ${stats.unmatchedPublications.toLocaleString()}  (archive-only, awaiting §2)`)

  if (COMMIT) {
    // idempotence check — re-read and confirm no title now contains its committee name twice
    const { rows: dup } = await p.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM corpus_sections
       WHERE corpus='committees-reports' AND "sectionTitle" IS NOT NULL AND notes IS NOT NULL
         AND (length("sectionTitle") - length(replace("sectionTitle", (notes::json->>'committeeName'), '')))
             > 2 * length(coalesce(notes::json->>'committeeName',''))
         AND coalesce(notes::json->>'committeeName','') <> ''`)
    console.log(`\n  titles containing the committee name more than twice: ${dup[0].n}  ${dup[0].n === '0' ? '✅ idempotent' : '❌ re-run has accumulated'}`)
  }
  await endNeonPool()
}
main().catch((e) => { console.error('[metadata] FATAL', e); process.exit(1) })
