/**
 * bills-parliament.ts — UK Parliament Bills via bills-api.parliament.uk (V25 §4).
 *
 * Mission-critical "intention" material: what was proposed and how it changed —
 * bill texts/versions, amendment papers, explanatory notes, delegated-powers and
 * other memoranda. JSON API, no Cloudflare, clean.
 *
 * Licence: parliamentary material — Open Parliament Licence v3.0 (same family as
 * Hansard/committees; licence='opl-3.0', see shared/licence-map.ts).
 *
 * Endpoints:
 *   GET /api/v1/Bills?skip&take                         → bill list (+ totalResults)
 *   GET /api/v1/Bills/{billId}/Publications             → publications[] (files + links)
 *   GET /api/v1/Publications/{pubId}/Documents/{docId}/Download → the file bytes
 *
 * Granularity: one section per publication PDF (a bill text, an amendment paper,
 * an EN, a memorandum). docId of a queue row = billId; the worker enumerates that
 * bill's publication PDFs.
 */

const BASE = 'https://bills-api.parliament.uk/api/v1'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; OPL UK Parliament Bills)'

export interface BillRef { billId: number; shortTitle: string }
export interface BillPdf { url: string; title: string; publicationType: string; pubId: number; docId: number | null }

async function getJson(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

// One page of the bill list. Returns { bills, total } or null on fetch failure.
export async function listBillsPage(skip: number, take = 100): Promise<{ bills: BillRef[]; total: number } | null> {
  const j = await getJson(`/Bills?skip=${skip}&take=${take}`)
  if (!j) return null
  const bills: BillRef[] = (j.items ?? []).map((b: any) => ({ billId: b.billId, shortTitle: b.shortTitle ?? '' }))
  return { bills, total: j.totalResults ?? bills.length }
}

// Enumerate every bill (paged). Used by the seeder.
export async function listAllBills(): Promise<BillRef[] | null> {
  const first = await listBillsPage(0, 100)
  if (!first) return null
  const all = [...first.bills]
  for (let skip = 100; skip < first.total; skip += 100) {
    const pg = await listBillsPage(skip, 100)
    if (!pg) return null
    all.push(...pg.bills)
  }
  return all
}

// The PDF publications for one bill. files[] download via the API; links[] are
// direct (often data.parliament.uk deposited papers). Non-PDF entries skipped.
// Returns null on fetch failure (worker retries — not a false empty).
export async function listBillPdfs(billId: number): Promise<BillPdf[] | null> {
  const j = await getJson(`/Bills/${billId}/Publications`)
  if (!j) return null
  // Only the API-hosted files[] Download route. The legacy links[] (external
  // parliament.uk / data.parliament.uk URLs) are unreliable — many are HTML
  // index pages mislabelled application/pdf, dead URLs, or scanned image PDFs
  // with no extractable text (verified across sampled bills 986/2071). Older
  // bills with only links[] yield 0 sections here; their enacted text is already
  // held via legislation.gov.uk.
  const out: BillPdf[] = []
  for (const pub of (j.publications ?? [])) {
    const ptype = pub.publicationType?.name ?? ''
    for (const f of (pub.files ?? [])) {
      if (f.contentType !== 'application/pdf') continue
      out.push({
        url: `${BASE}/Publications/${pub.id}/Documents/${f.id}/Download`,
        title: pub.title ?? f.filename ?? ptype, publicationType: ptype, pubId: pub.id, docId: f.id,
      })
    }
  }
  return out
}

export async function fetchBillPdf(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/pdf' } })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch { return null }
}
