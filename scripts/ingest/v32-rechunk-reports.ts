/**
 * v32-rechunk-reports.ts — replace each single-blob committee report row with per-finding
 * sections (base brief §3), re-using the body already in R2. No refetch: the 2020+ bodies are
 * ALREADY INGESTED IN FULL (see docs/V32_COMMITTEES_AUDIT.md) — what they are not is findable.
 *
 * WHAT CHANGES, per document:
 *   before   committees-reports:publication:7497:78688          1 row,  455,137 chars
 *   after    committees-reports:publication:7497:78688-0001     N rows, ≤6,000 chars each
 *            …:78688-0002 …
 * `parentDocId` is unchanged, so the ADDENDUM §B rule holds: the sections attach to the existing
 * report record rather than forking a second one beside it. `deleteStaleSections` then removes
 * the superseded blob row — the same mechanism `processCommitteesApi` already uses on re-parse.
 *
 * ── TWO FOOTGUNS THIS SCRIPT HAD, AND HOW THEY ARE HANDLED ───────────────────
 *
 * 1. UNIT OF WORK IS THE PUBLICATION, NOT THE DOCUMENT. `deleteStaleSections` is scoped by
 *    `parentDocId`, and 14 publications hold more than one document (13 with two, 1 with three
 *    — measured, not assumed). Splitting them one document at a time would have passed keepIds
 *    for document A and thereby DELETED document B's rows. Silent data loss. So a publication is
 *    processed as a whole and keepIds spans every document under it.
 *    Also measured, and why this grouping is sufficient: no publication in scope mixes report
 *    kinds with other kinds, and none has non-compiled marker rows that the delete would take.
 *
 * 2. ALREADY-SPLIT ROWS ARE EXCLUDED UNCONDITIONALLY. A section this script writes still has a
 *    `sectionTitle` beginning "Report: …", so a second run would happily re-split its own output.
 *    The `-NNNN` suffix is the marker and the exclusion is NOT tied to `--resume` — an operator
 *    forgetting the flag must not be able to corrupt the corpus.
 *
 * ── SAFETY, in the order it matters ──────────────────────────────────────────
 * 3. DRY RUN BY DEFAULT. Nothing is written without `--commit`. `--pilot N` bounds it.
 * 4. RECONCILE ATTEMPTED vs STORED, always. `feedback-built-inert-hides-write-bugs`: the first
 *    live run of the stats layer found six real bugs in a tsc-clean build, three of which were
 *    reporting SUCCESS. So this reads its own writes back from Neon and R2 and fails loudly on a
 *    mismatch rather than printing a row count it never verified.
 * 5. The splitter refuses to emit a lossy partition (`assertLossless`), so a document either
 *    round-trips completely or is skipped and counted — never half-written.
 * 6. R2 first, then Neon. A section row must never point at a key that does not exist.
 *
 * ⚠ THE INDEX IS NOT OPTIONAL AND NOT DONE HERE. Retiring the blob rows leaves them ORPHANED in
 * `corpus_fts` (fts-catchup only ever appends; removal is fts-hygiene's job) and the new rows
 * un-indexed. Run, without stopping between:
 *     search/fts-hygiene.ts audit → export → delete-orphans --apply
 *     search/fts-catchup.ts
 *     ../ops/heavy-job/run.ts run fts-index          (19.8 GB peak — never Railway, §17)
 *     restart fts-serve                              (openTable() is called once at boot)
 *
 * Usage:
 *   tsx v32-rechunk-reports.ts --pilot 25              # dry run, 25 publications
 *   tsx v32-rechunk-reports.ts --pilot 25 --commit     # write those 25
 *   tsx v32-rechunk-reports.ts --commit                # the full pass
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Get, r2Put, compiledKey } from './shared/r2-client'
import { bulkUpsertSections, deleteStaleSections, sectionId, countWords, SectionMeta } from './shared/db-metadata'
import { splitReportBody } from './shared/report-sections'

const COMMIT = process.argv.includes('--commit')
const PILOT = (() => { const i = process.argv.indexOf('--pilot'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 0 })()
const CONCURRENCY = parseInt(process.env.RECHUNK_CONCURRENCY ?? '8', 10)

/** Only the document kinds that carry a committee's own conclusions or the government's reply.
 *  Correspondence (17,813 rows, 1,109-word median) is already the right size and is left alone. */
const KIND_CLAUSE = `("sectionTitle" ILIKE 'Report:%' OR "sectionTitle" ILIKE 'Special Report:%' OR "sectionTitle" ILIKE 'Government Response:%')`
/** Footgun 2: never re-split our own output, flag or no flag. */
const NOT_ALREADY_SPLIT = `id !~ '-[0-9]{4}$'`

// itemDate is selected as ::text. node-pg otherwise hands back a JS Date, and String(date)
// yields "Fri May 08" — which Postgres then rejects on the way back in (22007). Caught on the
// first commit run; the R2-before-Neon ordering meant nothing was half-written.
type Doc = { id: string; sectionTitle: string; r2Key: string; itemDate: string | null; sourceUrl: string | null; format: string | null; parentDocId: string }

const stats = {
  publications: 0, docsConsidered: 0, docsSplit: 0, skippedLossy: 0, skippedNoBody: 0,
  sectionsPlanned: 0, r2Written: 0, rowsUpserted: 0, blobsRetired: 0,
  reconcileRows: 0, reconcileR2Ok: 0, reconcileR2Bad: 0, reconcileBlobSurvivors: 0,
}

async function mapPool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (true) { const i = next++; if (i >= items.length) return; await fn(items[i]) }
  }))
}

/** `78688` — the source documentId, kept as the section-ref prefix so ids stay traceable. */
function docRefOf(id: string): string | null {
  const m = /:(\d+)$/.exec(id)
  return m ? m[1] : null
}

/** One publication = one unit of work. See footgun 1. */
async function processPublication(parentDocId: string, docs: Doc[]): Promise<void> {
  stats.publications++
  const metas: SectionMeta[] = []
  const texts: string[] = []

  for (const doc of docs) {
    stats.docsConsidered++
    const docRef = docRefOf(doc.id)
    if (!docRef) { stats.skippedNoBody++; console.warn(`  ! unparseable id: ${doc.id}`); continue }

    const body = await r2Get(doc.r2Key)
    if (!body) { stats.skippedNoBody++; console.warn(`  ! no R2 body: ${doc.id}`); continue }

    let sections
    try { sections = splitReportBody(body) } catch (e) {
      stats.skippedLossy++
      console.warn(`  ! LOSSY, skipped: ${doc.id} — ${(e as Error).message}`)
      continue
    }
    if (sections.length === 0) { stats.skippedNoBody++; continue }
    stats.docsSplit++

    for (const s of sections) {
      const ref = `${docRef}-${String(s.ordinal).padStart(4, '0')}`
      // The heading and finding number go INTO the title: sectionTitle is what the FTS layer
      // carries and title-boosts on, so a section landing without them is ingested-but-unfindable
      // (ADDENDUM §D).
      const bits = [doc.sectionTitle, s.heading, s.startPara !== null ? `¶${s.startPara}` : null].filter(Boolean)
      metas.push({
        id: sectionId('committees-reports', parentDocId, ref),
        corpus: 'committees-reports',
        sourceUrl: doc.sourceUrl ?? undefined,
        r2Key: compiledKey('committees-reports', parentDocId, ref),
        wordCount: countWords(s.text),
        status: 'compiled',
        format: (doc.format ?? 'pdf') as SectionMeta['format'],
        sectionTitle: bits.join(' — ').slice(0, 500),
        itemDate: doc.itemDate ? doc.itemDate.slice(0, 10) : undefined,
        parentDocId,
      })
      texts.push(s.text)
    }
  }

  stats.sectionsPlanned += metas.length
  if (!COMMIT || metas.length === 0) return

  // ⚠ If ANY document under this publication failed, do not delete: keepIds would be missing
  // that document's sections and deleteStaleSections would take its blob row with nothing to
  // replace it. Partial success on a publication must not destroy the part that worked.
  const allDocsSucceeded = metas.length > 0 && docs.every(d => metas.some(m => m.id.includes(`:${docRefOf(d.id)}-`)))

  // 6. R2 FIRST — a row must never point at a key that is not there.
  for (let i = 0; i < metas.length; i += 8) {
    await Promise.all(metas.slice(i, i + 8).map((m, j) => r2Put(m.r2Key!, texts[i + j])))
  }
  stats.r2Written += metas.length

  // NOT `stats.x += await f()`. That compiles to read-await-write, so with CONCURRENCY
  // workers in flight the increments interleave and are lost — the first pilot reported 441
  // upserts and 21 retirements for 519 rows and 25 blobs. The DB-side reconciliation was
  // right and the counters were lying, which is the worst way round.
  const upserted = await bulkUpsertSections(metas)
  stats.rowsUpserted += upserted

  if (allDocsSucceeded) {
    // keepIds spans EVERY document under this publication — footgun 1.
    const retired = await deleteStaleSections('committees-reports', parentDocId, metas.map(m => m.id))
    stats.blobsRetired += retired
  } else {
    console.warn(`  ! ${parentDocId}: not every document split — sections written, blob rows LEFT IN PLACE`)
  }
}

/** 4. Reconciliation — read back what we believe we wrote, from both stores. */
async function reconcile(parentDocIds: string[]): Promise<void> {
  if (!COMMIT || parentDocIds.length === 0) return
  console.log('\n── reconciling attempted vs stored ──────────────────────────────────────────')
  const p = getNeonPool()
  const { rows } = await p.query<{ id: string; r2Key: string }>(
    `SELECT id, "r2Key" FROM corpus_sections WHERE corpus='committees-reports' AND "parentDocId" = ANY($1::text[])`,
    [parentDocIds])
  stats.reconcileRows = rows.length

  const sample = rows.slice(0, 300)
  await mapPool(sample, 16, async (r) => {
    const got = await r2Get(r.r2Key)
    if (got && got.length > 0) stats.reconcileR2Ok++
    else { stats.reconcileR2Bad++; console.error(`  ✗ row points at missing/empty R2 key: ${r.id} → ${r.r2Key}`) }
  })

  const survivors = rows.filter(r => !/-\d{4}$/.test(r.id))
  stats.reconcileBlobSurvivors = survivors.length
  for (const s of survivors.slice(0, 5)) console.error(`  ✗ un-retired blob row survived: ${s.id}`)
}

async function main() {
  console.log(`[rechunk] ${COMMIT ? '*** COMMIT ***' : 'DRY RUN (no writes — pass --commit)'}` +
    (PILOT ? `  pilot=${PILOT} publications` : '  FULL PASS'))

  const p = getNeonPool()
  // Select whole publications, so a multi-document publication is never split across runs.
  const { rows } = await p.query<Doc>(
    `SELECT id, "sectionTitle", "r2Key", "itemDate"::text AS "itemDate", "sourceUrl", format, "parentDocId"
     FROM corpus_sections
     WHERE corpus='committees-reports' AND status='compiled' AND "r2Key" IS NOT NULL
       AND "parentDocId" IS NOT NULL AND ${KIND_CLAUSE} AND ${NOT_ALREADY_SPLIT}
       ${PILOT ? `AND "parentDocId" IN (
          SELECT DISTINCT "parentDocId" FROM corpus_sections
          WHERE corpus='committees-reports' AND status='compiled' AND "parentDocId" IS NOT NULL
            AND ${KIND_CLAUSE} AND ${NOT_ALREADY_SPLIT}
          ORDER BY "parentDocId" LIMIT ${PILOT})` : ''}
     ORDER BY "parentDocId", id`)

  const byPub = new Map<string, Doc[]>()
  for (const r of rows) {
    const list = byPub.get(r.parentDocId) ?? []
    list.push(r); byPub.set(r.parentDocId, list)
  }
  const pubs = [...byPub.entries()]
  const multi = pubs.filter(([, d]) => d.length > 1).length
  console.log(`[rechunk] ${pubs.length.toLocaleString()} publications / ${rows.length.toLocaleString()} blob documents (${multi} publications hold more than one document)\n`)

  const t0 = Date.now()
  await mapPool(pubs, CONCURRENCY, ([parentDocId, docs]) => processPublication(parentDocId, docs))

  await reconcile(pubs.map(([id]) => id))

  console.log('\n═══ RESULT ═════════════════════════════════════════════════════════════════')
  console.log(`  publications processed      ${stats.publications}`)
  console.log(`  documents considered        ${stats.docsConsidered}`)
  console.log(`  split successfully          ${stats.docsSplit}`)
  console.log(`  skipped — no R2 body        ${stats.skippedNoBody}`)
  console.log(`  skipped — LOSSY split       ${stats.skippedLossy}`)
  console.log(`  sections planned            ${stats.sectionsPlanned}   (×${(stats.sectionsPlanned / Math.max(stats.docsSplit, 1)).toFixed(1)} per document)`)
  if (COMMIT) {
    console.log(`  R2 objects written          ${stats.r2Written}`)
    console.log(`  corpus_sections upserted    ${stats.rowsUpserted}`)
    console.log(`  blob rows retired           ${stats.blobsRetired}`)
    console.log(`  ── reconciliation ──`)
    console.log(`  rows under these parents    ${stats.reconcileRows}   (planned ${stats.sectionsPlanned})`)
    console.log(`  R2 bodies verified present  ${stats.reconcileR2Ok} of ${stats.reconcileR2Ok + stats.reconcileR2Bad} sampled`)
    console.log(`  R2 bodies MISSING           ${stats.reconcileR2Bad}`)
    console.log(`  un-retired blob rows        ${stats.reconcileBlobSurvivors}`)
    const ok = stats.reconcileR2Bad === 0 && stats.reconcileBlobSurvivors === 0 &&
      stats.reconcileRows === stats.sectionsPlanned && stats.skippedLossy === 0
    console.log(`\n  ${ok ? '✅ attempted and stored agree' : '❌ MISMATCH — attempted and stored disagree; do NOT proceed to the index'}`)
    if (!ok) process.exitCode = 1
    else {
      console.log('\n  NEXT, as one operation (see the header):')
      console.log('    tsx search/fts-hygiene.ts audit && … export && … delete-orphans --apply')
      console.log('    tsx search/fts-catchup.ts')
      console.log('    tsx ../ops/heavy-job/run.ts run fts-index   # 19.8 GB peak, never Railway')
      console.log('    restart fts-serve')
    }
  }
  console.log(`\n  elapsed ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  await endNeonPool()
}
main().catch((e) => { console.error('[rechunk] FATAL', e); process.exit(1) })
