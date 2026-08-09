/**
 * v33-committees-api-backlog.ts — V33 §5: the committees-API publications the V32 manifest lists
 * as `downloadable` but which have NO rows at all in `corpus_sections`.
 *
 * V32 §2 closed the archive-only path completely (7,636 publications: 5,390 fetched, 2,246
 * settled misses, 0 retryable). What it could not close was the other side of the manifest: 82
 * publications the API itself says have a served `documents[]`, which never produced a row. Those
 * are an API-path backlog, not a corpus gap — the documents are there to be had.
 *
 * WHAT THIS DOES, per publication, mirroring `workers/process-row.ts:processCommitteesApi` so the
 * rows are indistinguishable from the ones the worker writes:
 *   detail fetch → `documents[]` → serve each as Html or Pdf → text → R2 → `corpus_sections`.
 * A publication whose documents cannot be turned into text gets an `unavailable` marker row with
 * the reason, exactly as the worker's `marker()` does — so it is a RECORDED known-unknown rather
 * than a silent absence. That is the brief's acceptance: ingested, or reclassified with a reason.
 *
 * ⚠ REPORT KINDS ARE SPLIT PER FINDING, the other kinds are not. Landing a 68,000-word report as
 * one row is the exact defect V32 §1 existed to fix (BM25 length normalisation buries it; the
 * chunker embeds 24% of it). `shared/report-sections.ts` is reused, invariant and all, so these
 * 82 arrive in the shape the rest of the corpus is already in rather than needing a second pass.
 *
 * Usage:
 *   tsx v33-committees-api-backlog.ts              # identify only — no fetching, no writes
 *   tsx v33-committees-api-backlog.ts --fetch      # fetch + report, still no writes
 *   tsx v33-committees-api-backlog.ts --commit
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import fs from 'fs'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Get, r2Put, compiledKey } from './shared/r2-client'
import { bulkUpsertSections, upsertSection, sectionId, countWords, SectionMeta } from './shared/db-metadata'
import { rawToText, pdfToText } from './shared/compile'
import { splitReportBody } from './shared/report-sections'
import { getCommitteesApiItem, fetchCommitteesApiDocument } from './sources/committees-api'

export {}

const COMMIT = process.argv.includes('--commit')
const FETCH = COMMIT || process.argv.includes('--fetch')
const MANIFEST = path.join(__dirname, 'v32-committees-manifest.json')
const CORPUS = 'committees-reports'
/** Same kinds `v32-rechunk-reports.ts` splits. Correspondence is already the right size. */
const SPLIT_KINDS = /^(Report|Special Report|Government Response)\b/i

type ManifestItem = { publicationId: number; type: string; description: string; date: string | null; downloadable: boolean }

const n = (v: number) => Number(v).toLocaleString('en-GB')

const stats = {
  manifestDownloadable: 0, withRows: 0, backlog: 0,
  fetched: 0, detailFailed: 0, noDocuments: 0, noText: 0,
  docsLanded: 0, sectionsPlanned: 0, split: 0, whole: 0, markers: 0,
  r2Written: 0, rowsUpserted: 0,
  reconcileRows: 0, reconcileR2Ok: 0, reconcileR2Bad: 0, reconcileMissing: 0,
}
const outcomes: Array<{ id: number; type: string; outcome: string; detail: string; sections: number }> = []
const writtenIds: string[] = []

async function main() {
  const p = getNeonPool()
  console.log(`[backlog] ${COMMIT ? '*** COMMIT ***' : FETCH ? 'FETCH ONLY (no writes)' : 'IDENTIFY ONLY (no fetching)'}`)

  // ── identify ────────────────────────────────────────────────────────────────
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as { items: ManifestItem[] }
  const downloadable = manifest.items.filter((i) => i.downloadable)
  stats.manifestDownloadable = downloadable.length

  // A publication is "present" if ANY row exists under its parentDocId — compiled sections, the
  // V32 archive `arc-` rows, or an `unavailable` marker. A marker counts: it is a recorded
  // known-unknown, not an absence, and re-fetching it would re-litigate a settled miss.
  const docIds = downloadable.map((i) => `publication:${i.publicationId}`)
  const present = new Set<string>()
  for (let i = 0; i < docIds.length; i += 5000) {
    const { rows } = await p.query<{ parentDocId: string }>(
      `SELECT DISTINCT "parentDocId" FROM corpus_sections
        WHERE corpus=$1 AND "parentDocId" = ANY($2::text[])`, [CORPUS, docIds.slice(i, i + 5000)])
    for (const r of rows) present.add(r.parentDocId)
  }
  stats.withRows = present.size
  const backlog = downloadable.filter((i) => !present.has(`publication:${i.publicationId}`))
  stats.backlog = backlog.length

  console.log(`\n  manifest downloadable publications  ${n(stats.manifestDownloadable)}`)
  console.log(`  with rows in corpus_sections        ${n(stats.withRows)}`)
  console.log(`  ⇒ BACKLOG (no rows at all)          ${n(stats.backlog)}`)
  const byType = new Map<string, number>()
  for (const b of backlog) byType.set(b.type, (byType.get(b.type) ?? 0) + 1)
  console.log(`  by type: ${[...byType.entries()].sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}=${c}`).join(', ')}`)
  const years = backlog.map((b) => (b.date ?? '').slice(0, 4)).filter(Boolean).sort()
  console.log(`  date range: ${years[0] ?? '—'} … ${years[years.length - 1] ?? '—'}`)

  if (!FETCH) {
    console.log('\n  first 20:')
    for (const b of backlog.slice(0, 20)) console.log(`    ${String(b.publicationId).padStart(7)}  ${String(b.type).padEnd(22)} ${(b.date ?? '').slice(0, 10)}  ${String(b.description).slice(0, 70)}`)
    console.log('\n  IDENTIFY ONLY — pass --fetch to try the API, --commit to write.')
    await endNeonPool(); return
  }

  // ── fetch + land ────────────────────────────────────────────────────────────
  console.log('\n── fetching ─────────────────────────────────────────────────────────────────')
  for (const item of backlog) {
    const docId = `publication:${item.publicationId}`
    const pageUrl = `https://committees.parliament.uk/publications/${item.publicationId}/`

    const detail = await getCommitteesApiItem('Publications', item.publicationId)
    if (!detail) {
      stats.detailFailed++
      outcomes.push({ id: item.publicationId, type: item.type, outcome: 'detail-fetch-failed', detail: 'committees-api detail fetch returned nothing', sections: 0 })
      continue
    }
    stats.fetched++
    const docs = detail.documents ?? []
    const title = [detail.type?.name, detail.description].filter(Boolean).join(': ')
    const itemDate = (detail.publicationStartDate ?? '').slice(0, 10) || undefined

    if (docs.length === 0) {
      stats.noDocuments++
      outcomes.push({ id: item.publicationId, type: item.type, outcome: 'no-documents', detail: 'the manifest recorded documents[] but the detail endpoint now serves none', sections: 0 })
      if (COMMIT) {
        await upsertSection({
          id: sectionId(CORPUS, docId, '1'), corpus: CORPUS, sourceUrl: pageUrl, status: 'unavailable',
          availabilityStatus: 'no-provisions', parentDocId: docId,
          availabilityNote: 'committees-api item has no documents (V33 §5 re-check)',
        })
        stats.markers++
      }
      continue
    }

    const metas: SectionMeta[] = []
    const texts: string[] = []
    for (const doc of docs) {
      const fetched = await fetchCommitteesApiDocument('Publications', item.publicationId, doc.documentId, doc.files ?? [])
      if (!fetched) continue
      const name = fetched.fileName.toLowerCase()
      let text: string | null = null
      let format: SectionMeta['format'] = 'html'
      if (fetched.servedFormat === 'Html' || name.endsWith('.html') || name.endsWith('.htm')) {
        text = rawToText(fetched.buffer.toString('utf8')); format = 'html'
      } else if (fetched.servedFormat === 'Pdf' || name.endsWith('.pdf')) {
        text = await pdfToText(fetched.buffer, fetched.fileName); format = 'pdf'
      }
      if (!text || text.length < 100) continue
      stats.docsLanded++

      const base = String(doc.documentId)
      // Report kinds go in per finding, everything else whole — see the header.
      if (SPLIT_KINDS.test(title)) {
        let secs
        try { secs = splitReportBody(text) } catch (e) {
          outcomes.push({ id: item.publicationId, type: item.type, outcome: 'lossy-split', detail: (e as Error).message, sections: 0 })
          continue
        }
        stats.split++
        for (const s of secs) {
          const ref = `${base}-${String(s.ordinal).padStart(4, '0')}`
          const bits = [title, s.heading, s.startPara !== null ? `¶${s.startPara}` : null].filter(Boolean) as string[]
          metas.push({
            id: sectionId(CORPUS, docId, ref), corpus: CORPUS, sourceUrl: pageUrl,
            r2Key: compiledKey(CORPUS, docId, ref), wordCount: countWords(s.text),
            status: 'compiled', format, sectionTitle: bits.join(' — ').slice(0, 500),
            itemDate, parentDocId: docId,
          })
          texts.push(s.text)
        }
      } else {
        stats.whole++
        metas.push({
          id: sectionId(CORPUS, docId, base), corpus: CORPUS, sourceUrl: pageUrl,
          r2Key: compiledKey(CORPUS, docId, base), wordCount: countWords(text),
          status: 'compiled', format, sectionTitle: title || undefined, itemDate, parentDocId: docId,
        })
        texts.push(text)
      }
    }

    if (metas.length === 0) {
      stats.noText++
      outcomes.push({ id: item.publicationId, type: item.type, outcome: 'no-extractable-text', detail: `${docs.length} document(s) served, none produced text (original format unparseable, no Html/Pdf conversion)`, sections: 0 })
      if (COMMIT) {
        await upsertSection({
          id: sectionId(CORPUS, docId, '1'), corpus: CORPUS, sourceUrl: pageUrl, status: 'unavailable',
          availabilityStatus: 'no-provisions', parentDocId: docId,
          availabilityNote: 'no extractable document text (original format unparseable, no Html/Pdf conversion) — V33 §5',
        })
        stats.markers++
      }
      continue
    }

    stats.sectionsPlanned += metas.length
    outcomes.push({ id: item.publicationId, type: item.type, outcome: 'ingested', detail: `${docs.length} document(s)`, sections: metas.length })

    if (!COMMIT) continue
    // R2 first — a row must never point at a key that is not there.
    for (let i = 0; i < metas.length; i += 8) {
      await Promise.all(metas.slice(i, i + 8).map((m, j) => r2Put(m.r2Key!, texts[i + j])))
    }
    stats.r2Written += metas.length
    stats.rowsUpserted += await bulkUpsertSections(metas)
    for (const m of metas) writtenIds.push(m.id)
  }

  // ── reconcile ───────────────────────────────────────────────────────────────
  if (COMMIT && writtenIds.length) {
    console.log('\n── reconciling attempted vs stored ──────────────────────────────────────────')
    const stored: Array<{ id: string; r2Key: string }> = []
    for (let i = 0; i < writtenIds.length; i += 5000) {
      const { rows } = await p.query<{ id: string; r2Key: string }>(
        `SELECT id, "r2Key" FROM corpus_sections WHERE id = ANY($1::text[])`, [writtenIds.slice(i, i + 5000)])
      stored.push(...rows)
    }
    stats.reconcileRows = stored.length
    stats.reconcileMissing = writtenIds.length - stored.length
    const sample = stored.length > 200 ? stored.filter((_, i) => i % Math.ceil(stored.length / 200) === 0) : stored
    for (const r of sample) {
      const got = await r2Get(r.r2Key)
      if (got && got.length > 0) stats.reconcileR2Ok++
      else { stats.reconcileR2Bad++; console.error(`  ✗ missing R2 body: ${r.id} → ${r.r2Key}`) }
    }
  }

  // ── report ──────────────────────────────────────────────────────────────────
  console.log('\n═══ RESULT ══════════════════════════════════════════════════════════════════')
  console.log(`  backlog publications        ${n(stats.backlog)}`)
  console.log(`  detail fetched              ${n(stats.fetched)}   (failed ${n(stats.detailFailed)})`)
  console.log(`  documents turned into text  ${n(stats.docsLanded)}`)
  console.log(`  split per finding           ${n(stats.split)} documents`)
  console.log(`  landed whole                ${n(stats.whole)} documents`)
  console.log(`  sections planned            ${n(stats.sectionsPlanned)}`)
  console.log(`  reclassified: no documents  ${n(stats.noDocuments)}`)
  console.log(`  reclassified: no text       ${n(stats.noText)}`)
  if (COMMIT) {
    console.log(`\n  R2 objects written          ${n(stats.r2Written)}`)
    console.log(`  corpus_sections upserted    ${n(stats.rowsUpserted)}`)
    console.log(`  marker rows written         ${n(stats.markers)}`)
    console.log(`  ── reconciliation ──`)
    console.log(`  rows stored                 ${n(stats.reconcileRows)} of ${n(writtenIds.length)} written  (missing ${n(stats.reconcileMissing)})`)
    console.log(`  R2 bodies present           ${n(stats.reconcileR2Ok)} of ${n(stats.reconcileR2Ok + stats.reconcileR2Bad)} sampled`)
  }

  const accounted = stats.fetched + stats.detailFailed
  console.log(`\n  every publication accounted for: ${accounted === stats.backlog ? `✅ ${n(accounted)}/${n(stats.backlog)}` : `❌ ${n(accounted)}/${n(stats.backlog)}`}`)

  console.log('\n  outcome per publication:')
  const byOutcome = new Map<string, number>()
  for (const o of outcomes) byOutcome.set(o.outcome, (byOutcome.get(o.outcome) ?? 0) + 1)
  for (const [k, v] of [...byOutcome.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(24)} ${n(v)}`)
  for (const o of outcomes.filter((x) => x.outcome !== 'ingested')) {
    console.log(`    ⚠ ${String(o.id).padStart(7)} ${o.type.padEnd(20)} ${o.outcome} — ${o.detail.slice(0, 80)}`)
  }

  fs.writeFileSync(path.join(__dirname, '../../docs/v33_committees_backlog.json'),
    JSON.stringify({ measuredAt: new Date().toISOString(), stats, outcomes }, null, 2))
  console.log('\n  wrote docs/v33_committees_backlog.json')
  await endNeonPool()
}
main().catch((e) => { console.error('[backlog] FATAL', e); process.exit(1) })
