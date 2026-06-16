/**
 * v25-ingest-college-local.ts — V25 §3 College APP: LOCAL one-shot ingest.
 *
 * WHY local: webarchive.nationalarchives.gov.uk blocks/challenges Railway egress
 * IPs — the worker got 257/332 "archive fetch failed" while the identical fetch
 * returns 200 from a residential IP (burst-tested). The corpus is small (332
 * pages) and static (2022 snapshot), so we ingest it locally — fetch + extract +
 * R2 put + corpus_sections upsert + mark the queue row done — exactly as
 * processCollegePolicing would, just from a reachable IP. Idempotent: re-runs
 * skip rows already compiled in R2.
 *
 * Run: NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
 *   --tsconfig scripts/tsconfig.json scripts/ingest/v25-ingest-college-local.ts
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { markDone } from './shared/queue-client'
import { r2Put, r2Exists, compiledKey } from './shared/r2-client'
import { upsertSection, sectionId, countWords } from './shared/db-metadata'
import { fetchArchivedAppPage, snapshotIsoDate } from './sources/college-policing-archive'

const CORPUS = 'college-of-policing'
const CONC = 3

async function main() {
  const pool = getNeonPool()
  const rows = (await pool.query<{ id: string; docId: string }>(
    `SELECT id, "docId" FROM ingest_queue WHERE corpus=$1 AND status IN ('pending','failed','claimed') ORDER BY id`,
    [CORPUS])).rows
  console.log(`[college-local] ${rows.length} rows to process`)

  let ok = 0, marker = 0, fail = 0, skip = 0, cursor = 0
  async function worker() {
    while (cursor < rows.length) {
      const row = rows[cursor++]
      const bar = row.docId.indexOf('|')
      const ts = row.docId.slice(0, bar)
      const url = row.docId.slice(bar + 1)
      const slug = url.replace(/^https?:\/\/www\.app\.college\.police\.uk\//, '').replace(/\/$/, '') || 'app-content'
      const itemDate = snapshotIsoDate(ts)
      const cKey = compiledKey(CORPUS, slug, '1')

      if (await r2Exists(cKey)) {
        await upsertSectionDone(row.id); skip++; continue
      }
      const res = await fetchArchivedAppPage(ts, url)
      if (!res) { fail++; if (fail <= 5) console.log(`  FAIL ${slug}`); continue }

      if (res.text.length < 100) {
        await upsertSection({
          id: sectionId(CORPUS, slug, '1'), corpus: CORPUS, sourceUrl: url,
          status: 'unavailable', availabilityStatus: 'no-provisions',
          availabilityNote: 'archived APP page had no extractable content', itemDate, parentDocId: slug,
        })
        await markDone(row.id, undefined, true); marker++; continue
      }
      await r2Put(cKey, res.text)
      await upsertSection({
        id: sectionId(CORPUS, slug, '1'), corpus: CORPUS, sourceUrl: url, r2Key: cKey,
        wordCount: countWords(res.text), status: 'compiled', format: 'html',
        sectionTitle: res.title || slug, itemDate, parentDocId: slug,
      })
      await markDone(row.id, 'html', true); ok++
      if (ok % 50 === 0) console.log(`  …${ok} compiled`)
    }
  }
  async function upsertSectionDone(id: string) { await markDone(id, 'html', true) }

  await Promise.all(Array.from({ length: CONC }, () => worker()))
  console.log(`[college-local] done: ${ok} compiled, ${marker} markers, ${skip} already-in-R2, ${fail} fetch-failed`)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
