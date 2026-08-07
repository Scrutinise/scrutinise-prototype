/**
 * v32-backfill-archive.ts — §2: fetch the archive-only committee report bodies via the Wayback
 * Machine and land them as per-finding sections, using the SAME splitter as §1.
 *
 * These publications are listed by `committees-api` with an EMPTY `documents[]`, so the existing
 * worker wrote a `no-provisions` marker for each and moved on. That marker is honest but it is
 * not the end of the story: every one of them carries an `additionalContentUrl` to
 * `publications.parliament.uk`, which is Cloudflare-challenged, and the Wayback Machine mirrors
 * it. See sources/committees-archive.ts for the route and the evidence behind choosing it.
 *
 * ── WHAT IT DOES PER PUBLICATION ─────────────────────────────────────────────
 *   archiveUrl → Wayback snapshot → bytes → pdfToText/rawToText → splitReportBody → R2 → Neon
 * `parentDocId` is `publication:{id}`, unchanged from the marker row, so the sections attach to
 * the EXISTING record rather than forking a second one (ADDENDUM §B). Section refs are prefixed
 * `arc-` so an archive-sourced body is always distinguishable from an API-sourced one — and if
 * the API later serves the document, a normal reprocess supersedes these by the same
 * `deleteStaleSections` rule.
 *
 * ── A MISS IS RECORDED, NOT SWALLOWED ────────────────────────────────────────
 * Wayback has not archived everything. A publication we cannot retrieve keeps its row and is
 * marked `availability_status='archive-miss'` with the URL that failed, so the residual gap is a
 * COUNTED known-unknown (honest-denominator doctrine) rather than a silent absence. A backfill
 * that quietly drops what it could not fetch would report a smaller gap than the real one — the
 * same failure mode as the truncated API walk.
 *
 * ── SAFETY ───────────────────────────────────────────────────────────────────
 * Dry run by default. R2 before Neon. Losslessness enforced by the splitter. Resumable: a
 * publication that already has `arc-` sections is skipped, so a killed run just re-runs.
 *
 * Usage:
 *   tsx v32-enumerate-committees.ts                       # produces the manifest first
 *   tsx v32-backfill-archive.ts --pilot 20                # dry run
 *   tsx v32-backfill-archive.ts --pilot 20 --commit
 *   tsx v32-backfill-archive.ts --commit                  # the full 7,651
 * Then, as ONE operation: fts-hygiene → fts-catchup → heavy-job fts-index → restart fts-serve.
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Put, compiledKey } from './shared/r2-client'
import { bulkUpsertSections, upsertSection, deleteStaleSections, sectionId, countWords, SectionMeta } from './shared/db-metadata'
import { splitReportBody } from './shared/report-sections'
import { fetchArchivedDocument, looksLikePdf, isArchivableHost, transientStreak } from './sources/committees-archive'
import { pdfToText, rawToText } from './shared/compile'
import type { ManifestItem } from './v32-enumerate-committees'

const COMMIT = process.argv.includes('--commit')
const PILOT = (() => { const i = process.argv.indexOf('--pilot'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 0 })()
const MANIFEST = (() => { const a = process.argv.find(x => x.startsWith('--manifest=')); return a ? a.split('=')[1] : path.join(__dirname, 'v32-committees-manifest.json') })()
/** --only=16614,16615 — run specific publication ids ahead of the queue. The backfill otherwise
 *  walks the manifest in publication order (oldest first), so a named case like Carillion sits
 *  ~12 hours in; §4 needs it now to prove the route end-to-end on the canonical document. */
const ONLY = (() => { const a = process.argv.find(x => x.startsWith('--only=')); return a ? new Set(a.split('=')[1].split(',').map(x => parseInt(x.trim(), 10))) : null })()
// Wayback is a donated service. The throttle in committees-archive.ts is the real limiter;
// this just bounds how many fetches are in flight against it.
const CONCURRENCY = parseInt(process.env.BACKFILL_CONCURRENCY ?? '4', 10)
/**
 * Stop cleanly after this many documents so the caller can start a FRESH PROCESS.
 *
 * ⚠ NOT a politeness limit — a process-hygiene one, and the distinction is the whole finding.
 * Measured 7 Aug 2026: Wayback NEVER returns 429 or 503 for this workload. After roughly 30–50
 * requests a process starts getting `TypeError: fetch failed` — socket-level drops — and never
 * recovers, whatever the pacing. A FRESH process fetching the same URLs immediately scores 10/10
 * at ~1.5s each with NO pacing at all. So the degradation is Node's keep-alive pool going stale,
 * not the archive rate-limiting us, and the cure is a new process rather than a longer wait.
 * Slowing down was the wrong response: the first run read the drops as rate limiting, backed off
 * to a 120s ceiling, and managed 40 documents in 20 minutes.
 *
 * The script is resumable and idempotent, so recycling costs only process start-up.
 */
const MAX_DOCS = (() => { const i = process.argv.indexOf('--max'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : Infinity })()
/**
 * Exit as soon as the socket pool is provably dead, rather than at a guessed document count.
 * A run of consecutive TRANSIENT failures is the signature (a clean 404 resets it, so an
 * unarchived stretch does not trip it). This is the reliable recycle trigger: `--max 40` alone
 * still degraded mid-batch, because 40 documents is 40-80 requests and degradation starts around
 * 30-50 — after which the batch just sat at the 30s ceiling doing nothing.
 */
const TRANSIENT_BAIL = parseInt(process.env.BACKFILL_TRANSIENT_BAIL ?? '5', 10)
/** Re-attempt publications whose miss was a socket drop rather than a genuine absence. */
const RETRY_MISSES = process.argv.includes('--retry-misses')

const stats = {
  considered: 0, alreadyDone: 0, fetched: 0, archiveMiss: 0, unparseable: 0, lossy: 0, notArchivableHost: 0,
  sectionsWritten: 0, rowsUpserted: 0, markersRetired: 0, missesRecorded: 0, retryableMisses: 0, bailedOnSockets: false,
}

async function mapPool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (true) { const i = next++; if (i >= items.length) return; await fn(items[i]) }
  }))
}

/** The committee's name goes into the title so the row is findable in the committees stream
 *  (ADDENDUM §D); the rest of the join metadata is the §3 pass's job. */
function titleFor(item: ManifestItem, heading: string | null, para: number | null): string {
  const bits = [
    `${item.type}: ${item.description}`.trim(),
    item.committeeName,
    heading,
    para !== null ? `¶${para}` : null,
  ].filter(Boolean)
  return bits.join(' — ').slice(0, 500)
}

/**
 * A miss is recorded, never dropped — but WHETHER IT IS SETTLED matters as much as the reason.
 * `settled` misses (no snapshot, no archive URL, an unparseable document) will not change on a
 * retry; unsettled ones are socket drops and say nothing about whether a snapshot exists. The
 * note is prefixed accordingly so the resume filter can skip the former and re-attempt the latter.
 *
 * Getting this wrong stalled the run: the resume filter originally skipped only publications that
 * already had `arc-` sections, so every already-missed publication was re-processed on every
 * batch. The driver span at ~5s per batch, re-recording the same early misses, and never advanced
 * past 166 of 7,636 while looking entirely healthy.
 */
const SETTLED = 'settled'
const RETRYABLE = 'retryable'

async function recordMiss(item: ManifestItem, reason: string, url: string | null, settled = true): Promise<void> {
  stats.missesRecorded++
  if (!settled) stats.retryableMisses++
  if (!COMMIT) return
  await upsertSection({
    id: sectionId('committees-reports', `publication:${item.publicationId}`, '1'),
    corpus: 'committees-reports',
    sourceUrl: `https://committees.parliament.uk/publications/${item.publicationId}/`,
    status: 'unavailable',
    availabilityStatus: 'archive-miss',
    availabilityNote: `[${settled ? SETTLED : RETRYABLE}] ${reason}${url ? ` — ${url}` : ''}`,
    sectionTitle: `${item.type}: ${item.description}`.slice(0, 500),
    itemDate: item.date ?? undefined,
    parentDocId: `publication:${item.publicationId}`,
  })
}

async function processItem(item: ManifestItem): Promise<void> {
  stats.considered++
  const parentDocId = `publication:${item.publicationId}`
  const url = item.archiveUrl || item.archiveUrlHtml
  if (!url) { await recordMiss(item, 'no archive URL on the listing item', null); return }
  if (!isArchivableHost(url)) {
    // Recorded, not attempted. The Wayback Machine has no snapshots for the parliament asset
    // store (measured: empty CDX index on every probe), so trying costs two requests against a
    // service that rate-limits, and can never succeed.
    stats.notArchivableHost++
    await recordMiss(item, 'host is not held by the Wayback Machine (parliament asset store)', url)
    return
  }

  const outcome = await fetchArchivedDocument(url)
  if (!outcome.got) {
    stats.archiveMiss++
    await recordMiss(item,
      outcome.settled ? 'no snapshot in the Wayback Machine' : 'transient fetch failure (socket drop) — retryable',
      url, outcome.settled)
    return
  }
  const got = outcome.got
  stats.fetched++

  let text: string | null = null
  if (got.kind === 'pdf' || looksLikePdf(got.buffer)) {
    if (!looksLikePdf(got.buffer)) {
      // Wayback answers 200 with an HTML "not archived" page for some misses. Running that
      // through a PDF parser would either throw or, worse, yield a page of banner text.
      stats.unparseable++; await recordMiss(item, 'archive returned non-PDF bytes for a PDF URL', url); return
    }
    text = await pdfToText(got.buffer, `${item.publicationId}.pdf`)
  } else {
    text = rawToText(got.buffer.toString('utf8'))
  }
  if (!text || text.length < 500) { stats.unparseable++; await recordMiss(item, 'no extractable text from the archived document', url); return }

  let sections
  try { sections = splitReportBody(text) } catch (e) {
    stats.lossy++; await recordMiss(item, `lossy split: ${(e as Error).message}`, url); return
  }
  if (sections.length === 0) { stats.unparseable++; await recordMiss(item, 'document split into zero sections', url); return }

  const metas: SectionMeta[] = sections.map((s) => {
    const ref = `arc-${String(s.ordinal).padStart(4, '0')}`
    return {
      id: sectionId('committees-reports', parentDocId, ref),
      corpus: 'committees-reports',
      sourceUrl: url,
      r2Key: compiledKey('committees-reports', parentDocId, ref),
      wordCount: countWords(s.text),
      status: 'compiled',
      format: got.kind === 'pdf' ? 'pdf' : 'html',
      sectionTitle: titleFor(item, s.heading, s.startPara),
      itemDate: item.date ?? undefined,
      parentDocId,
      notes: JSON.stringify({ via: 'wayback', snapshot: got.timestamp, original: url }),
    }
  })

  stats.sectionsWritten += metas.length
  if (!COMMIT) return

  for (let i = 0; i < metas.length; i += 8) {
    await Promise.all(metas.slice(i, i + 8).map((m, j) => r2Put(m.r2Key!, sections[i + j].text)))
  }
  const upserted = await bulkUpsertSections(metas)
  stats.rowsUpserted += upserted
  // retires the `no-provisions` marker this publication has been carrying
  const retired = await deleteStaleSections('committees-reports', parentDocId, metas.map(m => m.id))
  stats.markersRetired += retired
}

async function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error(`[backfill] manifest not found: ${MANIFEST}\n  run: tsx v32-enumerate-committees.ts`)
    process.exit(1)
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as { items: ManifestItem[]; partial: unknown[] }
  if ((manifest.partial ?? []).length > 0) {
    console.warn(`[backfill] ⚠ the manifest records ${manifest.partial.length} PARTIAL year-slices — the target list is a FLOOR, not the full set.`)
  }

  let targets = manifest.items.filter(i => !i.downloadable && (i.archiveUrl || i.archiveUrlHtml))
  if (ONLY) targets = targets.filter(i => ONLY.has(i.publicationId))
  console.log(`[backfill] ${COMMIT ? '*** COMMIT ***' : 'DRY RUN (no writes — pass --commit)'}`)
  console.log(`[backfill] ${targets.length.toLocaleString()} archive-only publications in the manifest`)

  // resumable: skip publications that already have arc- sections
  const p = getNeonPool()
  // Skip what is DONE *and* what is SETTLED-missed. Skipping only the former is what stalled the
  // first long run — see recordMiss above. `--retry-misses` re-attempts the retryable ones.
  const { rows: done } = await p.query<{ parentDocId: string }>(
    `SELECT DISTINCT "parentDocId" FROM corpus_sections
     WHERE corpus='committees-reports'
       AND ( (status='compiled' AND id LIKE '%:arc-%')
          OR (availability_status='archive-miss'
              AND ($1::bool OR availability_note NOT LIKE '[retryable]%')) )`,
    [!RETRY_MISSES ? true : false])
  const doneSet = new Set(done.map(r => r.parentDocId))
  const before = targets.length
  targets = targets.filter(i => !doneSet.has(`publication:${i.publicationId}`))
  stats.alreadyDone = before - targets.length
  if (stats.alreadyDone) console.log(`[backfill] ${stats.alreadyDone.toLocaleString()} already backfilled — skipping`)

  // A pilot takes an EVENLY SPACED sample, never the first N. The manifest is in publication
  // order, so the first N are all the oldest items — and the oldest are disproportionately
  // `www.parliament.uk/globalassets` URLs, which Wayback never crawled. A first-12 pilot measured
  // 41.7% archive reach; the corpus is 84% `publications.parliament.uk`, which is well archived.
  // A pilot that samples the head measures the head, and reports it as the whole.
  if (PILOT && PILOT < targets.length) {
    const step = targets.length / PILOT
    targets = Array.from({ length: PILOT }, (_, i) => targets[Math.floor(i * step)])
  }
  console.log(`[backfill] processing ${targets.length.toLocaleString()}\n`)

  const t0 = Date.now()
  let n = 0
  let stopped = false
  await mapPool(targets, CONCURRENCY, async (item) => {
    if (stopped) return
    await processItem(item)
    if (stats.considered >= MAX_DOCS) stopped = true
    if (transientStreak() >= TRANSIENT_BAIL) {
      stopped = true
      stats.bailedOnSockets = true
    }
    if (++n % 25 === 0) {
      const el = (Date.now() - t0) / 1000
      process.stdout.write(`\r   …${n}/${targets.length}  ${(n / Math.max(el, 1)).toFixed(2)}/s  fetched=${stats.fetched} miss=${stats.archiveMiss}`)
    }
  })
  process.stdout.write('\n')

  console.log('\n═══ RESULT ═════════════════════════════════════════════════════════════════')
  console.log(`  publications considered     ${stats.considered}`)
  console.log(`  fetched from the archive    ${stats.fetched}`)
  console.log(`  host never crawled (skipped) ${stats.notArchivableHost}`)
  console.log(`  NOT archived (recorded)     ${stats.archiveMiss}  (${stats.retryableMisses} retryable, rest settled)`)
  console.log(`  unparseable (recorded)      ${stats.unparseable}`)
  console.log(`  lossy split (recorded)      ${stats.lossy}`)
  console.log(`  sections produced           ${stats.sectionsWritten}`)
  if (COMMIT) {
    console.log(`  corpus_sections upserted    ${stats.rowsUpserted}`)
    console.log(`  markers retired             ${stats.markersRetired}`)
    console.log(`  archive-miss rows written   ${stats.missesRecorded}`)
  }
  const attempted = stats.considered - stats.notArchivableHost
  const reach = attempted > 0 ? ((stats.fetched / attempted) * 100).toFixed(1) : '—'
  console.log(`\n  archive reach: ${reach}% of attempted publications retrieved`)
  console.log(`  elapsed ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`)
  if (stats.bailedOnSockets) {
    console.log(`  ⚠ BAILED: ${TRANSIENT_BAIL} consecutive transient failures — this process's sockets are dead.`)
    console.log(`     Not a rate limit (Wayback returns no 429/503 here). A fresh process recovers immediately.`)
  } else if (stopped) {
    console.log(`  --max ${MAX_DOCS} reached — exiting cleanly. Re-run to continue (resumable).`)
  }
  await endNeonPool()
}
main().catch((e) => { console.error('[backfill] FATAL', e); process.exit(1) })
