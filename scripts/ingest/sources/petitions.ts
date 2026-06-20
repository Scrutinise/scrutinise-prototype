/**
 * petitions.ts — UK Government & Parliament e-petitions (V29 §3.3).
 *
 * The public-sentiment→policy thread: petitions crossing 10k get a government
 * response, 100k are considered for debate. Open Parliament Licence v3.0, via
 * petition.parliament.uk JSON (live + archived-by-parliament):
 *
 *   live     GET /petitions.json?page=N&state=all      (last page ~561)
 *   archived GET /archived/petitions.json?page=N        (last page ~2082)
 *     → { links:{ last }, data:[{ id, attributes:{ action, background,
 *         additional_details, state, signature_count, created_at,
 *         government_response:{ summary, details, responded_on } | null,
 *         debate:{ debated_on, transcript_url, overview } | null,
 *         departments[] } }] }
 *
 * The list page carries the full petition + response + debate, so a page row
 * writes one section per petition (≈25/page) with no per-petition detail call.
 * Sections key on the stable petition id.
 */
const BASE = 'https://petition.parliament.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'

export type PetitionKind = 'open' | 'archived'

async function getJson(url: string, attempts = 3): Promise<any | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
      if (res.status === 404) return null
      if (res.ok) return await res.json()
    } catch { /* transient */ }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, 1200 * (i + 1)))
  }
  return null
}

function listUrl(kind: PetitionKind, page: number): string {
  return kind === 'open'
    ? `${BASE}/petitions.json?page=${page}&state=all`
    : `${BASE}/archived/petitions.json?page=${page}`
}

// Number of list pages for a kind (parsed from links.last).
export async function petitionPageCount(kind: PetitionKind): Promise<number> {
  const d = await getJson(listUrl(kind, 1))
  const last = d?.links?.last as string | undefined
  const m = last ? /[?&]page=(\d+)/.exec(last) : null
  return m ? Number(m[1]) : 1
}

export interface Petition {
  id: number
  action: string
  state: string | null
  signatureCount: number
  createdAt: string | null
  parliament: string | null
  text: string
}

function compileBody(a: any): string {
  const parts: string[] = []
  if (a.action) parts.push(a.action)
  const meta = [
    a.state && `State: ${a.state}`,
    a.signature_count != null && `Signatures: ${a.signature_count}`,
    a.opened_at && `Opened: ${String(a.opened_at).slice(0, 10)}`,
    Array.isArray(a.departments) && a.departments.length && `Departments: ${a.departments.map((d: any) => d.name).filter(Boolean).join(', ')}`,
  ].filter(Boolean).join(' · ')
  if (meta) parts.push(meta)
  if (a.background) parts.push(a.background)
  if (a.additional_details) parts.push(a.additional_details)
  if (a.government_response) {
    const gr = a.government_response
    parts.push(`Government response${gr.responded_on ? ` (${String(gr.responded_on).slice(0, 10)})` : ''}:`)
    if (gr.summary) parts.push(gr.summary)
    if (gr.details) parts.push(gr.details)
  }
  if (a.debate) {
    const db = a.debate
    parts.push(`Debate${db.debated_on ? ` (${String(db.debated_on).slice(0, 10)})` : ''}:`)
    if (db.overview) parts.push(db.overview)
    if (db.transcript_url) parts.push(`Transcript: ${db.transcript_url}`)
  }
  return parts.join('\n')
}

// Fetch one list page → its petitions (full text). Returns null on fetch failure,
// [] for a page past the end.
export async function fetchPetitionPage(kind: PetitionKind, page: number): Promise<Petition[] | null> {
  const d = await getJson(listUrl(kind, page))
  if (!d || !Array.isArray(d.data)) return null
  return d.data.map((row: any): Petition => ({
    id: row.id,
    action: (row.attributes?.action ?? '').trim(),
    state: row.attributes?.state ?? null,
    signatureCount: row.attributes?.signature_count ?? 0,
    createdAt: row.attributes?.created_at ? String(row.attributes.created_at).slice(0, 10) : null,
    parliament: row.parliament?.period ?? null,
    text: compileBody(row.attributes ?? {}),
  }))
}
