/**
 * v32-enumerate-committees.ts — one API walk that serves BOTH §2 (the archive backfill) and
 * §3 (the metadata pass), written to a manifest so neither has to re-walk.
 *
 * Collects, for every Report / Special Report / Government Response publication:
 *   - whether the API serves a downloadable document, or only an archive URL (→ §2 targets)
 *   - the stable INQUIRY ID (`businesses[].id`) — the ADDENDUM §B join key
 *   - committee name / house / category — §D metadata and the §C span
 *   - the report ↔ government-response link, both directions
 *   - hcNumber / hlPaper and the session, which is how a report is cited in the wild
 *
 * ⚠ WALK BY TYPE, NOT BY YEAR ALONE. An unfiltered year walk 500s server-side partway through
 * the busy years (2018 died at skip=3700 of 4,191) and returns a TRUNCATED YEAR RATHER THAN AN
 * ERROR — the first pass of the V32 audit understated the gap exactly this way. The type filter
 * keeps the busiest (year, type) slice under ~750 items and the walk completes. A page that
 * fails is recorded in `partial[]` rather than silently shrinking a count.
 *
 * Read-only against everything. Usage:
 *   tsx v32-enumerate-committees.ts [--out=path] [--from=2005] [--to=2026]
 */
import fs from 'fs'
import path from 'path'
import { listCommitteesApiPage, CommitteesApiListItem } from './sources/committees-api'

const OUT = (() => { const a = process.argv.find(x => x.startsWith('--out=')); return a ? a.split('=')[1] : path.join(__dirname, 'v32-committees-manifest.json') })()
const FROM = (() => { const a = process.argv.find(x => x.startsWith('--from=')); return a ? parseInt(a.split('=')[1], 10) : 2005 })()
const TO = (() => { const a = process.argv.find(x => x.startsWith('--to=')); return a ? parseInt(a.split('=')[1], 10) : 2026 })()

const TYPES = ['Report', 'Special Report', 'Government Response']

export interface ManifestItem {
  publicationId: number
  type: string
  description: string
  date: string | null
  /** true when the API serves the bytes; false when only an archive URL exists (§2 target). */
  downloadable: boolean
  archiveUrl: string | null
  archiveUrlHtml: string | null
  inquiryId: number | null
  inquiryTitle: string | null
  committeeId: number | null
  committeeName: string | null
  house: string | null
  category: string | null
  paperNumber: string | null
  session: string | null
  /** publication ids of government responses TO this report. */
  responseIds: number[]
  /** set on a response: the report it answers. */
  respondsToId: number | null
}

async function fetchTypeIds(): Promise<Map<string, number>> {
  const res = await fetch('https://committees-api.parliament.uk/api/PublicationType', {
    headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (legal corpus research)' },
  })
  const list = (await res.json()) as Array<{ id: number; name: string }>
  return new Map(list.map(t => [t.name, t.id]))
}

function toManifest(it: CommitteesApiListItem & any): ManifestItem {
  const biz = (it.businesses ?? []).find((b: any) => b?.type?.isInquiry) ?? (it.businesses ?? [])[0] ?? null
  return {
    publicationId: it.id,
    type: it.type?.name ?? '?',
    description: it.description ?? '',
    date: (it.publicationStartDate ?? '').slice(0, 10) || null,
    downloadable: (it.documents ?? []).length > 0,
    archiveUrl: it.additionalContentUrl || null,
    archiveUrlHtml: it.additionalContentUrl2 || null,
    // Recorded as null when genuinely absent. 54% of reports are not inquiry products
    // (statutory-instrument reports, annual reports, "Documents considered by the Committee"),
    // and inventing an id for them would be worse than an honest null — ADDENDUM §B.
    inquiryId: biz?.id ?? null,
    inquiryTitle: biz?.title ?? null,
    committeeId: it.committee?.id ?? null,
    committeeName: it.committee?.name ?? null,
    house: it.committee?.house ?? null,
    category: it.committee?.category?.name ?? null,
    paperNumber: it.hcNumber?.number ?? it.hlPaper?.number ?? null,
    session: it.hcNumber?.sessionDescription ?? it.hlPaper?.sessionDescription ?? null,
    responseIds: (it.governmentResponses?.publication ?? []).map((p: any) => p.id).filter(Boolean),
    respondsToId: it.responseToPublicationId ?? null,
  }
}

/**
 * --repair: re-walk ONLY the (type, year) slices the manifest recorded as partial, and merge
 * them in. The API rate-limits sustained walks, so a slice failing is routine — what must not be
 * routine is leaving the manifest a silent undercount. Cheaper and safer than re-walking 11,500
 * items to recover 85.
 */
async function repair(): Promise<void> {
  const existing = JSON.parse(fs.readFileSync(OUT, 'utf8')) as { items: ManifestItem[]; partial: Array<{ type: string; year: number; skip: number }>; counts: any }
  if (!existing.partial?.length) { console.log('[enumerate] no partial slices recorded — nothing to repair'); return }
  console.log(`[enumerate] repairing ${existing.partial.length} partial slice(s): ${existing.partial.map(s => `${s.type} ${s.year}`).join(', ')}`)

  const typeIds = await fetchTypeIds()
  const byId = new Map(existing.items.map(i => [i.publicationId, i]))
  const stillPartial: typeof existing.partial = []

  for (const slice of existing.partial) {
    const typeId = typeIds.get(slice.type)
    if (!typeId) { stillPartial.push(slice); continue }
    let skip = 0, total = -1, got = 0, failed = false
    while (true) {
      let page = await listCommitteesApiPage('Publications', skip, 100,
        { start: `${slice.year}-01-01`, end: `${slice.year + 1}-01-01` }, typeId)
      for (let a = 1; !page && a <= 5; a++) {
        console.log(`   ${slice.type} ${slice.year} skip=${skip}: retry ${a}/5 after cooling 45s`)
        await new Promise(r => setTimeout(r, 45_000))
        page = await listCommitteesApiPage('Publications', skip, 100,
          { start: `${slice.year}-01-01`, end: `${slice.year + 1}-01-01` }, typeId)
      }
      if (!page) { stillPartial.push({ ...slice, skip }); failed = true; break }
      if (total < 0) total = page.totalResults
      for (const it of page.items) { byId.set(it.id, toManifest(it)); got++ }
      skip += 100
      if (skip >= total || page.items.length === 0) break
    }
    console.log(`   ${slice.type} ${slice.year}: +${got} of ${total >= 0 ? total : '?'}${failed ? ' — STILL PARTIAL' : ' ✓'}`)
  }

  const items = [...byId.values()]
  const archiveOnly = items.filter(i => !i.downloadable && (i.archiveUrl || i.archiveUrlHtml))
  const withInquiry = items.filter(i => i.inquiryId !== null)
  fs.writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(), from: FROM, to: TO,
    counts: { total: items.length, downloadable: items.filter(i => i.downloadable).length, archiveOnly: archiveOnly.length, noRoute: items.filter(i => !i.downloadable && !i.archiveUrl && !i.archiveUrlHtml).length, withInquiry: withInquiry.length },
    partial: stillPartial, items,
  }, null, 1))
  console.log(`[enumerate] repaired → TOTAL ${items.length}, archive-only ${archiveOnly.length}, still-partial ${stillPartial.length}`)
}

async function main() {
  if (process.argv.includes('--repair')) return repair()
  console.log(`[enumerate] Report / Special Report / Government Response, ${FROM}–${TO}, per type per year`)
  const typeIds = await fetchTypeIds()
  const items: ManifestItem[] = []
  const partial: Array<{ type: string; year: number; skip: number }> = []

  for (const typeName of TYPES) {
    const typeId = typeIds.get(typeName)
    if (!typeId) { console.warn(`[enumerate] no type id for ${typeName} — skipped`); continue }
    let forType = 0
    for (let y = FROM; y <= TO; y++) {
      let skip = 0, total = -1
      while (true) {
        let page = await listCommitteesApiPage('Publications', skip, 100,
          { start: `${y}-01-01`, end: `${y + 1}-01-01` }, typeId)
        if (!page) {
          await new Promise(r => setTimeout(r, 30_000))
          page = await listCommitteesApiPage('Publications', skip, 100,
            { start: `${y}-01-01`, end: `${y + 1}-01-01` }, typeId)
        }
        if (!page) {
          // recorded, not swallowed — a silently short year is the trap this file warns about
          partial.push({ type: typeName, year: y, skip })
          console.warn(`[enumerate] ${typeName} ${y}: FAILED at skip=${skip} — YEAR IS PARTIAL`)
          break
        }
        if (total < 0) total = page.totalResults
        for (const it of page.items) items.push(toManifest(it))
        forType += page.items.length
        skip += 100
        if (skip >= total || page.items.length === 0) break
      }
    }
    console.log(`[enumerate] ${typeName}: ${forType}`)
  }

  const archiveOnly = items.filter(i => !i.downloadable && (i.archiveUrl || i.archiveUrlHtml))
  const noRoute = items.filter(i => !i.downloadable && !i.archiveUrl && !i.archiveUrlHtml)
  const withInquiry = items.filter(i => i.inquiryId !== null)

  console.log('')
  console.log(`[enumerate] TOTAL ${items.length}`)
  console.log(`[enumerate]   downloadable from API      ${items.filter(i => i.downloadable).length}`)
  console.log(`[enumerate]   ARCHIVE-ONLY (§2 targets)  ${archiveOnly.length}`)
  console.log(`[enumerate]   no route at all            ${noRoute.length}`)
  console.log(`[enumerate]   carry an inquiry id (§B)   ${withInquiry.length} (${((withInquiry.length / Math.max(items.length, 1)) * 100).toFixed(1)}%)`)
  console.log(`[enumerate]   PARTIAL year-slices        ${partial.length}${partial.length ? ' ⚠ counts below are a FLOOR' : ''}`)

  fs.writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(), from: FROM, to: TO,
    counts: { total: items.length, downloadable: items.filter(i => i.downloadable).length, archiveOnly: archiveOnly.length, noRoute: noRoute.length, withInquiry: withInquiry.length },
    partial, items,
  }, null, 1))
  console.log(`\n[enumerate] wrote ${OUT}`)
}
main().catch(e => { console.error('[enumerate] FATAL', e); process.exit(1) })
