/**
 * v33-resection-legislation.ts — replace each legislation-tier row that holds a WHOLE DOCUMENT
 * with its natural sub-units (V33 §1), re-using the body already in R2. No refetch.
 *
 *   before   eur-lex:32007B0143:1                    1 row, 4,250,493 chars, 0.5% embedded
 *   after    eur-lex:32007B0143:1-0001 … -NNNN       N rows, ≤6,000 chars each, 100% embedded
 *
 * ── SCOPE, AND THE 385 ROWS DELIBERATELY LEFT OUT ────────────────────────────
 * In scope: `eur-lex`, `explanatory-notes`, `explanatory-memoranda` — the three corpora
 * `LEGISLATION_TRUNCATION_AND_FLAG.md` §1.2 names, 7,764 truncated rows carrying 108.4M of the
 * tier's 111.4M candidate words (97.3%). **Every one of them has a bare `:1` ref** (measured,
 * v33-probe-refs.ts) — the ref is a placeholder, not a provision reference, so suffixing it
 * costs nothing.
 *
 * OUT of scope, and this is a decision rather than an oversight: the 385 truncated rows in the
 * UK CLML corpora (`primary-acts-*`, `si-*`, `regional`, `retained-eu`), 2.99M words.
 *   - 266 of them carry a REAL provision reference (`section-21`, `schedule-1-paragraph-1`).
 *     `gateway-legacy.ts:sectionNumberFromRef` parses that ref into the panel's "s.21" and into
 *     the legislation.gov.uk deep link. `section-21-0001` matches neither pattern, so the panel
 *     would print "s.section-21-0001" and the link would point at a provision that does not
 *     exist. A citation that 404s is worse than a section that embeds 90% of itself.
 *   - 119 are `:full` / `:full-doc-html` whole-document rows that DO match the pathology, but
 *     `refFromId` recognises whole-document rows by that exact literal; a suffix defeats it and
 *     produces the same broken link. Fixing it is a two-line change in `gateway-legacy.ts` —
 *     under `scrutinise-web/`, which this sprint's commit scope excludes.
 * Both are recorded as a follow-on rather than silently dropped. `--include-uk` exists so the
 * follow-on does not need a new script, and it is off by default.
 *
 * ── SAFETY, in the order it matters ──────────────────────────────────────────
 * 1. DRY RUN BY DEFAULT. Nothing is written without `--commit`. `--pilot N` bounds it.
 *    `--predict N` samples N documents per corpus and extrapolates, writing nothing at all.
 * 2. THE CANDIDATE TEST IS THE REAL CHUNKER, not a word-count threshold. A row is re-sectioned
 *    only if the real exported `chunkBody` actually truncates it. The word-count floor (1,500)
 *    is only a cheap pre-filter, and it is 1.65x below the smallest genuinely truncated section
 *    measured in LEGISLATION_TRUNCATION_AND_FLAG.md §1.1.
 * 3. ALREADY-SPLIT ROWS ARE EXCLUDED UNCONDITIONALLY, flag or no flag: a section this script
 *    writes would otherwise be a candidate for re-splitting on the next run. The `-NNNN` suffix
 *    is the marker, and it was verified free in these three corpora before being adopted (the
 *    UK CLML corpora have 734 ids that already end that way — one more reason they are out).
 * 4. R2 FIRST, THEN NEON. A row must never point at a key that does not exist.
 * 5. THE BLOB IS RETIRED ONLY AFTER ITS REPLACEMENTS ARE STORED, and the delete also takes any
 *    stale `-NNNN` row for the same document that the current split did not produce — so a
 *    re-run cannot leave an orphan behind.
 * 6. RECONCILE ATTEMPTED vs STORED, always (feedback-built-inert-hides-write-bugs: the first
 *    live run of the stats layer found six real bugs in a tsc-clean build, three of them
 *    reporting SUCCESS). This reads its own writes back from Neon and R2 and fails loudly.
 * 7. The splitter refuses to emit a lossy partition (`assertLossless`), so a document either
 *    round-trips completely or is skipped and counted — never half-written.
 *
 * ⚠ THE INDEX IS NOT OPTIONAL AND NOT DONE HERE. Retiring the blob rows leaves them ORPHANED in
 * `corpus_fts` and the new rows un-indexed. Run, without stopping between:
 *     search/fts-hygiene.ts audit → export → delete-orphans --apply
 *     search/fts-catchup.ts
 *     ../ops/heavy-job/run.ts run fts-index      (18–20 GB peak — never Railway, CLAUDE.md §17)
 *     restart fts-serve                          (openTable() is called once at boot)
 * The vector side is V33 §2 and follows the same shape.
 *
 * Usage:
 *   tsx v33-resection-legislation.ts --predict 150        # sample + extrapolate, no writes
 *   tsx v33-resection-legislation.ts --pilot 20           # dry run over 20 documents
 *   tsx v33-resection-legislation.ts --pilot 20 --commit  # write those 20
 *   tsx v33-resection-legislation.ts --commit             # the full pass
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Get, r2Put, compiledKey } from './shared/r2-client'
import { bulkUpsertSections, countWords, SectionMeta } from './shared/db-metadata'
import { splitLegislationBody } from './shared/legislation-sections'
import { chunkBody, MAX_CHUNKS } from './search/chunk'

export {}

const COMMIT = process.argv.includes('--commit')
const INCLUDE_UK = process.argv.includes('--include-uk')
const argN = (flag: string) => { const i = process.argv.indexOf(flag); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 0 }
const PILOT = argN('--pilot')
const PREDICT = argN('--predict')
const CONCURRENCY = parseInt(process.env.RESECTION_CONCURRENCY ?? '8', 10)
const R2_CONCURRENCY = parseInt(process.env.RESECTION_R2_CONCURRENCY ?? '12', 10)

/** The three corpora that hold whole documents in one row — see the header. */
const IN_SCOPE = ['eur-lex', 'explanatory-notes', 'explanatory-memoranda']
const UK_CLML = ['primary-acts-pre-2000', 'primary-acts-2000plus', 'si-pre-2010', 'si-2010plus', 'regional', 'retained-eu']

/** 1.65x below the smallest genuinely truncated legislation section ever measured (2,470 words).
 *  A pre-filter only — the real test is `truncatedByChunker`. */
const MIN_WORDS = parseInt(process.env.RESECTION_MIN_WORDS ?? '1500', 10)

type Doc = {
  id: string; corpus: string; r2Key: string; wordCount: number
  sectionTitle: string | null; sourceUrl: string | null; format: string | null
  itemDate: string | null; parentDocId: string | null; licence: string | null
  attribution: string | null; availability_status: string | null; availability_note: string | null
}

const stats = {
  considered: 0, notTruncated: 0, noBody: 0, skippedLossy: 0, unparseableId: 0,
  docsSplit: 0, sectionsPlanned: 0, wordsIn: 0, wordsOut: 0,
  r2Written: 0, rowsUpserted: 0, blobsRetired: 0, staleRetired: 0,
  reconcileRows: 0, reconcileR2Ok: 0, reconcileR2Bad: 0, reconcileBlobSurvivors: 0,
  reconcileWordsOut: 0, reconcileOrphans: 0,
}
const perCorpus = new Map<string, { docs: number; sections: number; words: number }>()
/** The ids actually split — the ONLY ids reconciliation may look for. Reconciling against the
 *  whole candidate set instead reported 20 "un-retired blobs" on the first pilot, which were the
 *  20 documents the chunker already covered and the pass therefore correctly left alone. */
const splitIds: string[] = []
/** Every section id this run wrote. Reconciliation looks these up by primary key in chunks: a
 *  `LIKE ANY(<8,850 patterns>)` over a 17.9M-row table is a sequential scan per pattern. */
const writtenIds: string[] = []

const n = (v: number) => Number(v).toLocaleString('en-GB')

async function mapPool<T>(items: T[], k: number, fn: (x: T, i: number) => Promise<void>): Promise<void> {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(k, items.length) }, async () => {
    for (;;) { const i = next++; if (i >= items.length) return; await fn(items[i], i) }
  }))
}

/** Does the REAL chunker fail to cover this body? The one true candidate test. */
export function truncatedByChunker(body: string): boolean {
  const text = (body ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return false
  const chunks = chunkBody(text)
  if (chunks.length < MAX_CHUNKS) return false
  // Chunks are contiguous-with-overlap, so the covered span ends exactly where the last chunk
  // ends. If the text does not end there, the tail was never embedded.
  return !text.endsWith(chunks[chunks.length - 1])
}

/** `eur-lex:32001L0108:1` → { docId: '32001L0108', ref: '1' }. The docId may itself contain
 *  colons (`explanatory-notes:en:ukpga/2004/35:1`), so split on the FIRST and LAST only. */
function decomposeId(id: string): { docId: string; ref: string } | null {
  const first = id.indexOf(':')
  const last = id.lastIndexOf(':')
  if (first < 0 || last <= first) return null
  return { docId: id.slice(first + 1, last), ref: id.slice(last + 1) }
}

/**
 * The section title. This is the field the FTS layer title-boosts on, so a section landing
 * without one is ingested-but-unfindable — the V32 ADDENDUM §D failure.
 *
 * ⚠ `eur-lex` rows carry NO sectionTitle at all today (0 of 90,260), which is why
 * `gateway-legacy.ts:displayTitle` has to fall back to "CELEX {id}" to avoid telling a user that
 * "the law here is eur-lex". The new rows are given a real one.
 */
function titleFor(doc: Doc, docId: string, heading: string | null, startPara: number | null, ordinal: number): string {
  const base = doc.sectionTitle?.trim() || (doc.corpus === 'eur-lex' ? `CELEX ${docId}` : docId)
  const bits = [base, heading, startPara !== null && !heading ? `¶${startPara}` : null]
    .filter(Boolean) as string[]
  const joined = bits.join(' — ')
  // Reserve room for the ordinal so the slice cannot cut the part that makes the title unique —
  // the V32 §3 defect, where `${title} — ${name}`.slice(0,500) cut away the NAME it was adding.
  const suffix = ` (${ordinal})`
  return `${joined.slice(0, 500 - suffix.length)}${suffix}`
}

async function processDoc(doc: Doc): Promise<void> {
  stats.considered++
  const parts = decomposeId(doc.id)
  if (!parts) { stats.unparseableId++; console.warn(`  ! unparseable id: ${doc.id}`); return }

  const body = await r2Get(doc.r2Key)
  if (!body) { stats.noBody++; console.warn(`  ! no R2 body: ${doc.id}`); return }

  // 2. the candidate test is the real chunker
  if (!truncatedByChunker(body)) { stats.notTruncated++; return }

  let sections
  try { sections = splitLegislationBody(body) } catch (e) {
    stats.skippedLossy++
    console.warn(`  ! LOSSY, skipped: ${doc.id} — ${(e as Error).message}`)
    return
  }
  if (sections.length <= 1) { stats.notTruncated++; return }

  stats.docsSplit++
  splitIds.push(doc.id)
  stats.wordsIn += doc.wordCount ?? 0

  const metas: SectionMeta[] = []
  const texts: string[] = []
  for (const s of sections) {
    const ref = `${parts.ref}-${String(s.ordinal).padStart(4, '0')}`
    const words = countWords(s.text)
    stats.wordsOut += words
    metas.push({
      id: `${doc.corpus}:${parts.docId}:${ref}`,
      corpus: doc.corpus,
      sourceUrl: doc.sourceUrl ?? undefined,
      r2Key: compiledKey(doc.corpus, parts.docId, ref),
      wordCount: words,
      status: 'compiled',
      format: (doc.format ?? undefined) as SectionMeta['format'],
      sectionTitle: titleFor(doc, parts.docId, s.heading, s.startPara, s.ordinal),
      itemDate: doc.itemDate ? doc.itemDate.slice(0, 10) : undefined,
      // Preserved exactly as the blob row had it — NULL for eur-lex (the corpus has never used
      // it; the docId inside the id is the link to the parent document), the gid for the
      // explanatory corpora. Attaching to the existing parent, not forking a second one.
      parentDocId: doc.parentDocId ?? undefined,
      licence: doc.licence ?? undefined,
      attribution: doc.attribution ?? undefined,
      availabilityStatus: (doc.availability_status ?? undefined) as SectionMeta['availabilityStatus'],
      availabilityNote: doc.availability_note ?? undefined,
      // r2RawKey is deliberately NOT carried: it points at the whole document's raw asset, it is
      // written-never-read (CORPUS_SECTIONS_STORAGE_AUDIT §5), and V33 §3 is dropping the column.
    })
    texts.push(s.text)
  }

  stats.sectionsPlanned += metas.length
  const pc = perCorpus.get(doc.corpus) ?? { docs: 0, sections: 0, words: 0 }
  pc.docs++; pc.sections += metas.length; pc.words += doc.wordCount ?? 0
  perCorpus.set(doc.corpus, pc)

  if (!COMMIT) return

  // 4. R2 FIRST — a row must never point at a key that is not there.
  for (let i = 0; i < metas.length; i += R2_CONCURRENCY) {
    await Promise.all(metas.slice(i, i + R2_CONCURRENCY).map((m, j) => r2Put(m.r2Key!, texts[i + j])))
  }
  stats.r2Written += metas.length

  // NOT `stats.x += await f()` — that compiles to read-await-write, so with CONCURRENCY workers
  // in flight the increments interleave and are lost. The V32 rechunk's first pilot reported 441
  // upserts for 519 rows because of exactly that.
  const upserted = await bulkUpsertSections(metas)
  stats.rowsUpserted += upserted
  for (const m of metas) writtenIds.push(m.id)

  // 5. retire the blob AND any stale `-NNNN` row this split did not produce.
  const pool = getNeonPool()
  const blob = await pool.query(`DELETE FROM corpus_sections WHERE id = $1`, [doc.id])
  stats.blobsRetired += blob.rowCount ?? 0
  const stale = await pool.query(
    `DELETE FROM corpus_sections
      WHERE corpus = $1 AND id LIKE $2 AND id <> ALL($3::text[])`,
    [doc.corpus, `${doc.id}-%`, metas.map((m) => m.id)])
  stats.staleRetired += stale.rowCount ?? 0
}

/** 6. Reconciliation — read back what we believe we wrote, from BOTH stores. */
async function reconcile(): Promise<void> {
  if (!COMMIT || splitIds.length === 0) return
  console.log('\n── reconciling attempted vs stored ──────────────────────────────────────────')
  const p = getNeonPool()

  // (a) every id this run wrote is present, with the word count it was written with.
  const stored: Array<{ id: string; r2Key: string; wordCount: number }> = []
  for (let i = 0; i < writtenIds.length; i += 5000) {
    const { rows } = await p.query<{ id: string; r2Key: string; wordCount: number }>(
      `SELECT id, "r2Key", "wordCount" FROM corpus_sections WHERE id = ANY($1::text[])`,
      [writtenIds.slice(i, i + 5000)])
    stored.push(...rows)
  }
  stats.reconcileRows = stored.length
  stats.reconcileWordsOut = stored.reduce((a, r) => a + (r.wordCount ?? 0), 0)

  // (b) a sample of those rows really has a body behind its r2Key.
  const sample = stored.length > 400
    ? Array.from({ length: 400 }, (_, i) => stored[Math.floor((i * stored.length) / 400)])
    : stored
  await mapPool(sample, 16, async (r) => {
    const got = await r2Get(r.r2Key)
    if (got && got.length > 0) stats.reconcileR2Ok++
    else { stats.reconcileR2Bad++; console.error(`  ✗ row points at missing/empty R2 key: ${r.id} → ${r.r2Key}`) }
  })

  // (c) no blob row survived a successful split.
  for (let i = 0; i < splitIds.length; i += 5000) {
    const { rows: surv } = await p.query<{ id: string }>(
      `SELECT id FROM corpus_sections WHERE id = ANY($1::text[])`, [splitIds.slice(i, i + 5000)])
    stats.reconcileBlobSurvivors += surv.length
    for (const s of surv.slice(0, 5)) console.error(`  ✗ un-retired blob row survived: ${s.id}`)
  }

  // (d) an ORPHAN check the id lookups above cannot do: for a sample of split documents, count
  // every `-NNNN` row actually under that document and compare with what was written for it. A
  // range scan on the primary key ('-' is 0x2D, '.' is 0x2E, so `> id||'-'` and `< id||'.'`
  // brackets exactly the suffixed ids).
  const written = new Set(writtenIds)
  const probe = splitIds.length > 200
    ? Array.from({ length: 200 }, (_, i) => splitIds[Math.floor((i * splitIds.length) / 200)])
    : splitIds
  let orphans = 0
  for (const blobId of probe) {
    const { rows } = await p.query<{ id: string }>(
      `SELECT id FROM corpus_sections WHERE id > $1 AND id < $2`, [`${blobId}-`, `${blobId}.`])
    for (const r of rows) if (!written.has(r.id)) { orphans++; if (orphans <= 5) console.error(`  ✗ orphan row under a split document: ${r.id}`) }
  }
  stats.reconcileOrphans = orphans
  console.log(`  orphan probe: ${probe.length} split documents scanned, ${orphans} rows found that this run did not write`)
}

async function selectDocs(corpora: string[], limit: number): Promise<Doc[]> {
  const p = getNeonPool()
  const { rows } = await p.query<Doc>(
    `SELECT id, corpus, "r2Key", "wordCount", "sectionTitle", "sourceUrl", format,
            "itemDate"::text AS "itemDate", "parentDocId", licence, attribution,
            availability_status, availability_note
       FROM corpus_sections
      WHERE corpus = ANY($1) AND status='compiled' AND "r2Key" IS NOT NULL
        AND "wordCount" > $2
        AND id !~ '-[0-9]{4}$'
      ORDER BY corpus, id ${limit ? `LIMIT ${limit}` : ''}`, [corpora, MIN_WORDS])
  return rows
}

/** Sample-and-extrapolate. Written to be run BEFORE the pass so the prediction can be scored. */
async function predict(sampleSize: number, corpora: string[]): Promise<void> {
  const p = getNeonPool()
  console.log(`[predict] sampling ${sampleSize} documents per corpus (writes nothing)\n`)
  let grandSections = 0, grandDocs = 0
  for (const corpus of corpora) {
    const { rows: tot } = await p.query<{ docs: string; words: string }>(
      `SELECT count(*)::bigint AS docs, coalesce(sum("wordCount"),0)::bigint AS words
         FROM corpus_sections
        WHERE corpus=$1 AND status='compiled' AND "r2Key" IS NOT NULL
          AND "wordCount" > $2 AND id !~ '-[0-9]{4}$'`, [corpus, MIN_WORDS])
    const popDocs = Number(tot[0].docs), popWords = Number(tot[0].words)

    const { rows: sample } = await p.query<{ id: string; r2Key: string; wordCount: number }>(
      `SELECT id, "r2Key", "wordCount" FROM corpus_sections
        WHERE corpus=$1 AND status='compiled' AND "r2Key" IS NOT NULL
          AND "wordCount" > $2 AND id !~ '-[0-9]{4}$'
        ORDER BY md5(id) LIMIT $3`, [corpus, MIN_WORDS, sampleSize])

    // Two populations inside one candidate set, and they must not be averaged together: a
    // document the real chunker already covers stays as ONE row, so only the truncated ones
    // produce sections. Extrapolate the split RATE and the sections-per-word of the split
    // documents separately.
    let sTrunc = 0, sIntact = 0, sNoBody = 0
    let tWords = 0, tSections = 0, tChars = 0
    await mapPool(sample, 16, async (r) => {
      const body = await r2Get(r.r2Key)
      if (!body) { sNoBody++; return }
      if (!truncatedByChunker(body)) { sIntact++; return }
      try {
        const secs = splitLegislationBody(body)
        sTrunc++; tWords += r.wordCount ?? 0; tSections += secs.length
        tChars += secs.reduce((a, s) => a + s.text.length, 0)
      } catch { /* lossy — counted in the real pass */ }
    })
    const splitRate = sample.length ? sTrunc / sample.length : 0
    // words are concentrated in the long documents, which are exactly the truncated ones, so
    // the word share of the truncated sample is the right multiplier for the population words.
    const sampleWords = sample.reduce((a, r) => a + (r.wordCount ?? 0), 0)
    const truncWordShare = sampleWords ? tWords / sampleWords : 0
    const perWord = tWords ? tSections / tWords : 0
    const predDocs = Math.round(popDocs * splitRate)
    const predSections = Math.round(popWords * truncWordShare * perWord)
    grandSections += predSections; grandDocs += predDocs
    console.log(`  ${corpus.padEnd(22)} population ${n(popDocs).padStart(6)} candidate rows / ${n(popWords).padStart(11)} words`)
    console.log(`  ${''.padEnd(22)} sample ${sample.length}: ${sTrunc} truncated, ${sIntact} already covered, ${sNoBody} no body`)
    console.log(`  ${''.padEnd(22)} truncated docs hold ${(100 * truncWordShare).toFixed(1)}% of the words, at ${(1 / (perWord || 1)).toFixed(0)} words/section (avg ${tSections ? Math.round(tChars / tSections) : 0} chars)`)
    console.log(`  ${''.padEnd(22)} ⇒ PREDICT ${n(predDocs)} documents re-sectioned into ${n(predSections)} sections`)
  }
  console.log(`\n  PREDICTED: ${n(grandDocs)} documents re-sectioned → ${n(grandSections)} new rows,`)
  console.log(`             ${n(grandDocs)} blob rows retired, net Neon row change ${grandSections - grandDocs >= 0 ? '+' : ''}${n(grandSections - grandDocs)}`)
}

async function main() {
  const corpora = INCLUDE_UK ? [...IN_SCOPE, ...UK_CLML] : IN_SCOPE
  console.log(`[resection] corpora: ${corpora.join(', ')}`)
  if (PREDICT) { await predict(PREDICT, corpora); await endNeonPool(); return }

  console.log(`[resection] ${COMMIT ? '*** COMMIT ***' : 'DRY RUN (no writes — pass --commit)'}` +
    (PILOT ? `  pilot=${PILOT} documents` : '  FULL PASS'))

  const docs = await selectDocs(corpora, PILOT)
  console.log(`[resection] ${n(docs.length)} candidate rows (>${n(MIN_WORDS)} words, not already split)\n`)

  const t0 = Date.now()
  let done = 0
  await mapPool(docs, CONCURRENCY, async (d) => {
    await processDoc(d)
    if (++done % 250 === 0) {
      const rate = done / ((Date.now() - t0) / 1000)
      console.log(`   … ${n(done)}/${n(docs.length)} docs  ${n(stats.sectionsPlanned)} sections  ${rate.toFixed(1)}/s  eta ${Math.round((docs.length - done) / rate / 60)}m`)
    }
  })

  await reconcile()

  console.log('\n═══ RESULT ═════════════════════════════════════════════════════════════════')
  console.log(`  candidate rows considered   ${n(stats.considered)}`)
  console.log(`  not truncated (left alone)  ${n(stats.notTruncated)}`)
  console.log(`  no R2 body                  ${n(stats.noBody)}`)
  console.log(`  unparseable id              ${n(stats.unparseableId)}`)
  console.log(`  skipped — LOSSY split       ${n(stats.skippedLossy)}`)
  console.log(`  documents re-sectioned      ${n(stats.docsSplit)}`)
  console.log(`  sections planned            ${n(stats.sectionsPlanned)}   (×${(stats.sectionsPlanned / Math.max(stats.docsSplit, 1)).toFixed(1)} per document)`)
  console.log(`  words in / out              ${n(stats.wordsIn)} / ${n(stats.wordsOut)}  (${stats.wordsIn ? ((100 * stats.wordsOut) / stats.wordsIn).toFixed(2) : '0'}% — unwrap mends hyphenation, so a small loss is expected and a GAIN is not)`)
  console.log('\n  by corpus:')
  for (const [c, v] of [...perCorpus.entries()].sort()) {
    console.log(`    ${c.padEnd(22)} docs=${n(v.docs).padStart(6)}  sections=${n(v.sections).padStart(8)}  (×${(v.sections / Math.max(v.docs, 1)).toFixed(1)})`)
  }
  if (COMMIT) {
    console.log(`\n  R2 objects written          ${n(stats.r2Written)}`)
    console.log(`  corpus_sections upserted    ${n(stats.rowsUpserted)}`)
    console.log(`  blob rows retired           ${n(stats.blobsRetired)}`)
    console.log(`  stale -NNNN rows retired    ${n(stats.staleRetired)}`)
    console.log(`  ── reconciliation ──`)
    console.log(`  rows stored under these ids ${n(stats.reconcileRows)}   (planned ${n(stats.sectionsPlanned)})`)
    console.log(`  words stored                ${n(stats.reconcileWordsOut)}   (planned ${n(stats.wordsOut)})`)
    console.log(`  R2 bodies verified present  ${n(stats.reconcileR2Ok)} of ${n(stats.reconcileR2Ok + stats.reconcileR2Bad)} sampled`)
    console.log(`  R2 bodies MISSING           ${n(stats.reconcileR2Bad)}`)
    console.log(`  un-retired blob rows        ${n(stats.reconcileBlobSurvivors)}`)
    console.log(`  orphan rows under a split   ${n(stats.reconcileOrphans)}`)
    const ok = stats.reconcileR2Bad === 0 && stats.reconcileBlobSurvivors === 0 &&
      stats.reconcileRows === stats.sectionsPlanned && stats.reconcileWordsOut === stats.wordsOut &&
      stats.reconcileOrphans === 0 && stats.skippedLossy === 0
    console.log(`\n  ${ok ? '✅ attempted and stored agree' : '❌ MISMATCH — attempted and stored disagree; do NOT proceed to the index'}`)
    if (!ok) process.exitCode = 1
    else {
      console.log('\n  NEXT, as one operation (see the header):')
      console.log('    tsx search/fts-hygiene.ts audit && … export && … delete-orphans --apply')
      console.log('    tsx search/fts-catchup.ts')
      console.log('    tsx ../ops/heavy-job/run.ts run fts-index   # 18–20 GB peak, never Railway')
      console.log('    restart fts-serve')
    }
  }
  console.log(`\n  elapsed ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  await endNeonPool()
}
main().catch((e) => { console.error('[resection] FATAL', e); process.exit(1) })
