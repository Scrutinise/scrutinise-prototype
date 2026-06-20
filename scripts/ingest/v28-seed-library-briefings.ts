/**
 * v28-seed-library-briefings.ts — V28 §5. Commons & Lords Library research
 * briefings. BUILT TO THE GATE — the content endpoints are behind a Cloudflare
 * managed-challenge (see sources/library-briefings.ts header). Seeds nothing
 * until a cf_clearance + research-briefing post-type slug are captured.
 *
 *   --probe   (default) report reachability + readiness per house.
 *   --measure once a capture is wired (slug + COMMONS_LIB_CF_CLEARANCE etc.):
 *             page the CPT and report the universe size. Seeds nothing.
 *   --seed    gated: only runs when isReady() for the house; bulk-inserts
 *             content rows (sourceType 'library-briefings', corpora
 *             commons-library-briefings / lords-library-briefings).
 */
import { endNeonPool } from './shared/neon-pool'
import { BRIEFING_CONFIG, isReady, probe, listBriefingsPage, type LibraryHouse } from './sources/library-briefings'

async function main() {
  const mode = process.argv.find(a => ['--probe', '--measure', '--seed'].includes(a)) ?? '--probe'

  // V29 §9: 'post' (POSTnotes) wired into the same seam — separate CF host + capture.
  const corpusFor = (h: LibraryHouse) => h === 'post' ? 'postnotes' : `${h}-library-briefings`
  for (const house of ['commons', 'lords', 'post'] as LibraryHouse[]) {
    if (mode === '--probe') { console.log(await probe(house)); continue }

    if (!isReady(house)) {
      console.log(`${house}: NOT READY — capture cf_clearance + post-type slug first (see sources/library-briefings.ts).`)
      continue
    }
    // capture wired → enumerate
    let page = 1, total = 0, totalPages = 1
    do {
      const res = await listBriefingsPage(house, page, 100)
      if (!res) { console.log(`${house}: page ${page} fetch failed`); break }
      totalPages = res.totalPages || 1
      total += res.entries.length
      process.stdout.write(`  ${house} page ${page}/${totalPages} (+${res.entries.length})\r`)
      if (mode === '--seed') {
        const { bulkInsertQueueRows } = await import('./shared/queue-client')
        const corpus = corpusFor(house)
        await bulkInsertQueueRows(res.entries.map(e => ({
          id: `${corpus}:${e.id}`, corpus, docId: `${house}:${e.id}`,
          sourceType: 'library-briefings', priority: 3,
        })))
      }
      page++
      await new Promise(r => setTimeout(r, 300))
    } while (page <= totalPages)
    console.log(`\n${house}: ${total} briefings ${mode === '--seed' ? 'seeded' : 'enumerated'}`)
  }
  void BRIEFING_CONFIG
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
