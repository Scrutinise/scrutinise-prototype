/**
 * division-votes.ts — per-member division voting records (V28 §3).
 *
 * Commons Votes + Lords Votes APIs (Open Parliament Licence v3.0). We hold the
 * division *results* already (lda-commonsdivisions / lda-lordsdivisions) but NOT
 * the per-member breakdown — who voted aye/no. This source supplies exactly
 * that: one normalized DivisionDetail per division carrying every member's vote
 * (id + name + party + constituency), which the processor renders as one
 * searchable section per division.
 *
 *   Commons (commonsvotes-api.parliament.uk):
 *     list   GET /data/divisions.json/search?queryParameters.take=N&queryParameters.skip=M
 *            → [{ DivisionId, Date, Title, ... }]  (newest first; format is a
 *              ROUTE segment — `divisions.json`, not `.api` which errors)
 *     total  GET /data/divisions.json/searchTotalResults?queryParameters.take=1
 *     detail GET /data/division/{id}.json
 *            → { DivisionId, Date, Number, Title, AyeCount, NoCount,
 *                AyeTellers[], NoTellers[], Ayes[], Noes[] }
 *            member = { MemberId, Name, Party, PartyAbbreviation, MemberFrom }
 *
 *   Lords (lordsvotes-api.parliament.uk):
 *     list   GET /data/Divisions/search?take=N&skip=M  → [{ divisionId, date, title, ... }]
 *     total  GET /data/Divisions/searchTotalResults
 *     detail GET /data/Divisions/{id}
 *            → { divisionId, date, number, title, contents[], notContents[],
 *                contentTellers[], notContentTellers[] }
 *            member = { memberId, name, party, partyAbbreviation, memberFrom }
 */

const COMMONS = 'https://commonsvotes-api.parliament.uk'
const LORDS = 'https://lordsvotes-api.parliament.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'

export type House = 'commons' | 'lords'

export interface DivisionMember {
  memberId: number
  name: string
  party: string | null
  constituency: string | null   // MemberFrom / memberFrom
  vote: 'aye' | 'no'
  teller: boolean
}

export interface DivisionListEntry { divisionId: number; date: string | null; title: string }

export interface DivisionDetail {
  house: House
  divisionId: number
  number: number | null
  date: string | null            // ISO YYYY-MM-DD
  title: string
  ayeCount: number
  noCount: number
  members: DivisionMember[]
}

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': UA } })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

// ── Totals ──────────────────────────────────────────────────────────────────
export async function divisionTotal(house: House): Promise<number | null> {
  const url = house === 'commons'
    ? `${COMMONS}/data/divisions.json/searchTotalResults?queryParameters.take=1`
    : `${LORDS}/data/Divisions/searchTotalResults`
  const v = await getJson(url)
  return typeof v === 'number' ? v : (v == null ? null : Number(v))
}

// ── Listing (one page) ────────────────────────────────────────────────────────
export async function listDivisionsPage(house: House, skip: number, take: number): Promise<DivisionListEntry[] | null> {
  const url = house === 'commons'
    ? `${COMMONS}/data/divisions.json/search?queryParameters.take=${take}&queryParameters.skip=${skip}`
    : `${LORDS}/data/Divisions/search?take=${take}&skip=${skip}`
  const arr = await getJson(url)
  if (!Array.isArray(arr)) return null
  return arr.map((d: any) => house === 'commons'
    ? { divisionId: d.DivisionId, date: d.Date ? String(d.Date).slice(0, 10) : null, title: (d.Title ?? '').trim() }
    : { divisionId: d.divisionId, date: d.date ? String(d.date).slice(0, 10) : null, title: (d.title ?? '').trim() })
}

// Enumerate every division id for a house (newest-first pages until exhausted).
export async function enumerateDivisions(
  house: House, take = 100, delayMs = 300,
  onProgress?: (collected: number) => void,
): Promise<DivisionListEntry[]> {
  const out: DivisionListEntry[] = []
  for (let skip = 0; ; skip += take) {
    let page = await listDivisionsPage(house, skip, take)
    if (page === null) { // one polite retry
      await new Promise(r => setTimeout(r, 3000))
      page = await listDivisionsPage(house, skip, take)
    }
    if (page === null) throw new Error(`${house}: division list failed at skip=${skip}`)
    if (page.length === 0) break
    out.push(...page)
    onProgress?.(out.length)
    if (page.length < take) break
    await new Promise(r => setTimeout(r, delayMs))
  }
  return out
}

// ── Detail (one division, full member breakdown) ──────────────────────────────
function commonsMembers(arr: any[] | undefined, vote: 'aye' | 'no', teller: boolean): DivisionMember[] {
  return (arr ?? []).map((m: any) => ({
    memberId: m.MemberId, name: (m.Name ?? '').trim(),
    party: m.Party ?? null, constituency: m.MemberFrom ?? null, vote, teller,
  }))
}
function lordsMembers(arr: any[] | undefined, vote: 'aye' | 'no', teller: boolean): DivisionMember[] {
  return (arr ?? []).map((m: any) => ({
    memberId: m.memberId, name: (m.name ?? '').trim(),
    party: m.party ?? null, constituency: m.memberFrom ?? null, vote, teller,
  }))
}

export async function fetchDivisionDetail(house: House, id: number): Promise<DivisionDetail | null> {
  if (house === 'commons') {
    const d = await getJson(`${COMMONS}/data/division/${id}.json`)
    if (!d || d.DivisionId == null) return null
    const members = [
      ...commonsMembers(d.Ayes, 'aye', false),
      ...commonsMembers(d.AyeTellers, 'aye', true),
      ...commonsMembers(d.Noes, 'no', false),
      ...commonsMembers(d.NoTellers, 'no', true),
    ]
    return {
      house, divisionId: d.DivisionId, number: d.Number ?? null,
      date: d.Date ? String(d.Date).slice(0, 10) : null,
      title: (d.Title ?? '').trim(), ayeCount: d.AyeCount ?? 0, noCount: d.NoCount ?? 0, members,
    }
  } else {
    const d = await getJson(`${LORDS}/data/Divisions/${id}`)
    if (!d || d.divisionId == null) return null
    const members = [
      ...lordsMembers(d.contents, 'aye', false),
      ...lordsMembers(d.contentTellers, 'aye', true),
      ...lordsMembers(d.notContents, 'no', false),
      ...lordsMembers(d.notContentTellers, 'no', true),
    ]
    return {
      house, divisionId: d.divisionId, number: d.number ?? null,
      date: d.date ? String(d.date).slice(0, 10) : null,
      title: (d.title ?? '').trim(),
      ayeCount: d.authoritativeContentCount ?? d.memberContentCount ?? 0,
      noCount: d.authoritativeNotContentCount ?? d.memberNotContentCount ?? 0,
      members,
    }
  }
}

// Render one division to a searchable plain-text section: motion title + date +
// result, then the full aye/no member lists ("Name (Party, Constituency)").
// Tellers are flagged. This is the searchable unit — a query for a member name
// or a motion lands the whole division with its complete roll-call.
export function compileDivisionText(d: DivisionDetail): string {
  const houseLabel = d.house === 'commons' ? 'House of Commons' : 'House of Lords'
  const ayeLabel = d.house === 'commons' ? 'AYES' : 'CONTENTS'
  const noLabel = d.house === 'commons' ? 'NOES' : 'NOT CONTENTS'
  const ayes = d.members.filter(m => m.vote === 'aye')
  const noes = d.members.filter(m => m.vote === 'no')
  const line = (m: DivisionMember) =>
    `${m.name}${m.party ? ` (${m.party}${m.constituency ? `, ${m.constituency}` : ''})` : ''}${m.teller ? ' [Teller]' : ''}`
  const parts: string[] = []
  parts.push(d.title || `${houseLabel} Division ${d.number ?? d.divisionId}`)
  parts.push(`${houseLabel} — Division ${d.number ?? ''}${d.date ? ` — ${d.date}` : ''}`.trim())
  parts.push(`Result: ${ayeLabel} ${d.ayeCount}, ${noLabel} ${d.noCount}`)
  parts.push('')
  parts.push(`${ayeLabel} (${ayes.length}):`)
  parts.push(ayes.map(line).join('\n') || '(none)')
  parts.push('')
  parts.push(`${noLabel} (${noes.length}):`)
  parts.push(noes.map(line).join('\n') || '(none)')
  return parts.join('\n')
}
