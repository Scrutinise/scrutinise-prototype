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

/**
 * A bill's IDENTITY and its STATUS — everything a reader needs to tell a live Bill from a dead
 * one. Added 2026-08-10 (BRIEF_SEARCH_S2C3 §1).
 *
 * ⚠ WHY THIS DID NOT EXIST BEFORE, since the fields were always on the wire. `listBillsPage`
 * already read `shortTitle` and threw everything else away, and `processBills` in
 * workers/process-row.ts wrote `sectionTitle: "Bill {billId} — publication {seq}"` — a numeric
 * internal id and an ordinal. So all 6,574 rows carried no bill NAME, and `itemDate` was left
 * null on every one of them. The publication `title` and `publicationType` that `listBillPdfs`
 * returns were discarded at the enqueue step too. Nothing was wrong with the corpus; the
 * identifying metadata simply never left this file.
 *
 * `isAct` matters as much as the stage: a Bill that received Royal Assent IS now law, and a user
 * researching a subject must not be shown proposed law when enacted law exists.
 */
export interface BillStatus {
  billId: number
  shortTitle: string
  /** `currentStage.description`, e.g. "2nd reading", "Committee stage", "Royal Assent". */
  stage: string | null
  house: string | null
  /** ISO date of the API's `lastUpdate` — the only date any of this carries. */
  lastUpdate: string | null
  isAct: boolean
  withdrawn: string | null
  defeated: boolean
}

function toBillStatus(b: any): BillStatus {
  return {
    billId: b.billId,
    shortTitle: b.shortTitle ?? '',
    stage: b.currentStage?.description ?? null,
    house: b.currentStage?.house ?? b.currentHouse ?? null,
    // The API returns a .NET timestamp ("2025-09-16T17:08:18.2184786"); keep the date only.
    lastUpdate: typeof b.lastUpdate === 'string' ? b.lastUpdate.slice(0, 10) : null,
    isAct: !!b.isAct,
    withdrawn: typeof b.billWithdrawn === 'string' ? b.billWithdrawn.slice(0, 10) : null,
    defeated: !!b.isDefeated,
  }
}

/**
 * Every bill with its status, paged. Returns null on ANY page failure rather than a short list —
 * a partial sweep silently mislabels the bills it missed, and "no metadata" is a visible state
 * while "wrong metadata" is not.
 */
export async function listAllBillStatuses(
  onProgress?: (fetched: number, total: number) => void,
  delayMs = 500,
): Promise<BillStatus[] | null> {
  const first = await getJson(`/Bills?skip=0&take=100`)
  if (!first) return null
  const total: number = first.totalResults ?? 0
  const all: BillStatus[] = (first.items ?? []).map(toBillStatus)
  onProgress?.(all.length, total)
  for (let skip = 100; skip < total; skip += 100) {
    // seed-rate-limits.ts records intervalMs 500 for bills-api; honour it here too.
    await new Promise((r) => setTimeout(r, delayMs))
    const j = await getJson(`/Bills?skip=${skip}&take=100`)
    if (!j) return null
    all.push(...(j.items ?? []).map(toBillStatus))
    onProgress?.(all.length, total)
  }
  return all
}

/**
 * How a Bill is NAMED to a user. The one rule that outranks brevity: **a Bill must never be
 * mistakable for an Act** (BRIEF_SEARCH_S2C3 §1, the same requirement as Holyrood vs Westminster).
 *
 * `shortTitle` already ends in "Bill", so the word is present without prefixing it. What the
 * title adds is the STATUS, because that is the decision-relevant fact: a Bill that fell in 2019
 * and a Bill in committee this week tell a reformer opposite things about what to do next.
 *
 * ⚠ A bill that received Royal Assent says so FIRST, ahead of any stage, because at that point
 * the proposal is law and the user should be reading the Act.
 */
export function billDisplayTitle(s: BillStatus): string {
  const name = s.shortTitle?.trim() || `Bill ${s.billId}`
  const year = s.lastUpdate ? s.lastUpdate.slice(0, 4) : null

  // ⚠ THE WORD "Bill" MUST APPEAR, AND `shortTitle` CANNOT BE RELIED ON TO CARRY IT. Found by
  // measuring rather than by reasoning (S2C3 §1): of 15 distinct bills surfacing on real queries,
  // only 2 had "Bill" in the title — because 13 had received Royal Assent, at which point the
  // API's shortTitle becomes the ACT's name ("Leasehold Reform (Ground Rent) Act 2022"). So the
  // card read as an Act, in a BILL-typed row, pointing at a bill publication PDF. That is the
  // brief's own requirement failing in the direction nobody was watching: not "a Bill mistaken
  // for an Act" but "a BILL DOCUMENT mistaken for the Act it became".
  //
  // The row is a bill PAPER — a version of the proposed text as it moved through Parliament — and
  // never the enacted text, whatever its subject went on to become. So the marker is added
  // whenever the name does not already carry it, and `check:corpus-types` asserts the word is
  // present for every status shape.
  const marker = /\bBills?\b/i.test(name) ? '' : 'Bill papers, '

  let status: string
  if (s.isAct) status = 'became an Act'
  else if (s.withdrawn) status = `withdrawn ${s.withdrawn}`
  else if (s.defeated) status = 'defeated'
  // ⚠ "last updated", NOT "no progress since". `lastUpdate` is when the API's RECORD changed, not
  // when the bill last moved; the two usually coincide but nothing guarantees it, and a reformer
  // deciding whether to join an existing effort must not be told a Bill is stalled on the
  // strength of a field that does not say so. The year still does the work the brief wanted —
  // "2nd reading (last updated 2021)" and "Committee stage (last updated 2026)" are plainly
  // different pieces of information — without asserting anything the data has not measured.
  else if (s.stage) status = year ? `${s.stage} (last updated ${year})` : s.stage
  else status = 'stage unknown'
  return `${name} — ${marker}${status}`
}

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
