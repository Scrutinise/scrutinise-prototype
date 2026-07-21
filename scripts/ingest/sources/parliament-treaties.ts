// Parliament Treaty Tracker client — TREATY_INGEST_BRIEF.md STEP 2.
//
// treaties-api.parliament.uk — clean documented JSON REST API (OpenAPI spec at
// /swagger/v1/swagger.json, verified live 8 Jul 2026), same *.parliament.uk
// API family as bills-api/committees-api/erskine-may-api (id.parliament.uk
// URIs, identical response envelope). Covers treaties laid before Parliament
// for scrutiny under the Constitutional Reform and Governance Act 2010 (CRaG) —
// the legislative-scrutiny view: laying dates, parliamentary conclusion,
// sponsoring department, and a BusinessItems timeline (debates, committee
// evidence sessions, objection-period tracking). Small, distinct dataset:
// 328 treaties total (verified 8 Jul 2026), NOT the FCDO's full historical
// treaty-text archive (uk-treaties-fcdo) — kept as its own corpus (STEP 2
// model decision, see v31-seed-parliament-treaties.ts header).
//
// Licence: Open Parliament Licence v3.0 — same verified family as
// bills-api/committees-api/erskine-may/division-votes in licence-map.ts.

const BASE = 'https://treaties-api.parliament.uk'
const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  return { signal: ctl.signal, clear: () => clearTimeout(t) }
}

async function getJson<T>(url: string): Promise<T> {
  const { signal, clear } = withTimeout(30_000)
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal })
    clear()
    if (!res.ok) throw new Error(`parliament-treaties: HTTP ${res.status} for ${url}`)
    return await res.json() as T
  } catch (err) {
    clear()
    throw err
  }
}

export interface ParliamentTreaty {
  id: string
  name: string
  uri: string | null
  commandPaperPrefix: string | null
  commandPaperNumber: number | null
  commonsLayingDate: string | null
  lordsLayingDate: string | null
  webLink: string | null
  treatySeriesCitation: string | null
  leadDepartment: string | null
  layingBodyDepartment: string | null
  parliamentaryConclusion: string | null
  debateScheduled: string | null
  broughtToAttentionDate: string | null
  signedDate: string | null
  laidDate: string | null
  pertinentDate: string | null
}

export interface ParliamentBusinessItem {
  id: string
  steps: string[]
  itemDate: string | null
  houses: string[]
  link: string | null
}

interface RawEnvelope<T> { items: Array<{ value: T }>; totalResults: number }

function normaliseTreaty(raw: any): ParliamentTreaty {
  return {
    id: raw.id,
    name: raw.name ?? `Treaty ${raw.id}`,
    uri: raw.uri ?? null,
    commandPaperPrefix: raw.commandPaperPrefix ?? null,
    commandPaperNumber: raw.commandPaperNumber ?? null,
    commonsLayingDate: raw.commonsLayingDate ?? null,
    lordsLayingDate: raw.lordsLayingDate ?? null,
    webLink: raw.webLink ?? null,
    treatySeriesCitation: raw.treatySeriesMembership?.citation ?? null,
    leadDepartment: raw.leadDepartment?.name ?? null,
    layingBodyDepartment: raw.layingBodyDepartment?.name ?? null,
    parliamentaryConclusion: raw.parliamentaryConclusion ?? null,
    debateScheduled: raw.debateScheduled ?? null,
    broughtToAttentionDate: raw.broughtToAttentionDate ?? null,
    signedDate: raw.signedDate ?? null,
    laidDate: raw.laidDate ?? null,
    pertinentDate: raw.pertinentDate ?? null,
  }
}

// Verified live 8 Jul 2026: Take=1000 returns all 328 in a single page (no
// pagination needed at this universe size); paginate defensively anyway in
// case the register grows past that in future.
export async function listAllTreaties(): Promise<ParliamentTreaty[]> {
  const out: ParliamentTreaty[] = []
  let skip = 0
  const take = 500
  for (;;) {
    const data = await getJson<RawEnvelope<any>>(`${BASE}/api/Treaty?Skip=${skip}&Take=${take}`)
    const batch = data.items.map(i => normaliseTreaty(i.value))
    out.push(...batch)
    if (out.length >= data.totalResults || batch.length === 0) return out
    skip += take
  }
}

export async function fetchTreaty(id: string): Promise<ParliamentTreaty | null> {
  try {
    const data = await getJson<{ value: any }>(`${BASE}/api/Treaty/${encodeURIComponent(id)}`)
    return normaliseTreaty(data.value)
  } catch {
    return null
  }
}

export async function fetchBusinessItems(treatyId: string): Promise<ParliamentBusinessItem[]> {
  const data = await getJson<RawEnvelope<any>>(`${BASE}/api/Treaty/${encodeURIComponent(treatyId)}/BusinessItems`)
  return data.items.map(i => ({
    id: i.value.id,
    steps: Array.isArray(i.value.steps) ? i.value.steps : [],
    itemDate: i.value.itemDate ?? null,
    houses: Array.isArray(i.value.houses) ? i.value.houses.map((h: any) => h.name ?? h.house).filter(Boolean) : [],
    link: i.value.link ?? null,
  }))
}
