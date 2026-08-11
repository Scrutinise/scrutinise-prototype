/**
 * division-votes.ts — per-member division voting records.
 *
 * V28 §3 built this and it was never seeded. V34 (§A of
 * BRIEF_INGEST_POLITICAL_SOURCES) re-probed both APIs before touching it and
 * found two faults and one windfall. All three are recorded here rather than in
 * a commit message, because each one is a trap the next reader would otherwise
 * re-enter.
 *
 * ── FAULT 1: the Commons list endpoint is HARD-CAPPED AT 25 ──────────────────
 * `queryParameters.take` is silently clamped to 25 no matter what is asked for
 * (measured: take=26/40/50/100/200 all return exactly 25; Lords honours every
 * value). V28's enumerator asked for 100 and then did:
 *
 *     if (page.length < take) break
 *
 * so it would have taken page 1, seen 25 < 100, and STOPPED — enumerating 25 of
 * 2,361 Commons divisions and reporting success. The enumeration below breaks on
 * an EMPTY page, never on a short one, and cross-checks the final count against
 * searchTotalResults so a silent cap can never again look like a finished walk.
 *
 * ── FAULT 2: `NoVoteRecorded` was being thrown away ──────────────────────────
 * The Commons detail payload carries a THIRD member array beside Ayes and Noes:
 * `NoVoteRecorded` — members who sat that day and did not vote. V28 mapped only
 * Ayes/Noes/tellers, so absence was indistinguishable from not being a member.
 * The brief makes that distinction a requirement. It is present on every
 * division sampled across the whole range (division 2 of 2016-03-09 → 210 on the
 * newest), so it is not a recent addition.
 *
 * ⚠ LORDS HAS NO EQUIVALENT FIELD. A Lords division names only the peers who
 * voted (159 of ~800 eligible on the sampled division). So Lords absence is a
 * KNOWN UNKNOWN, recorded as `absenceKnown: false`, never as "nobody was
 * absent". Deriving it needs the Members API eligible-peer roll at that date,
 * which is a separate job and deliberately not faked here.
 *
 * ── WINDFALL: party and constituency ARE recorded, AT THE DATE ───────────────
 * The brief states party affiliation is not in the division lists. That is not
 * true of the current Commons Votes API: every member record carries `Party`,
 * `PartyAbbreviation` and `MemberFrom`, and they are the values AS AT THE
 * DIVISION, not as at today. Verified against a member who changed party twice
 * (member 172, Labour → Independent 2023-04-23 → Labour 2024-05-28): the
 * recorded party on divisions either side of each switch matches the Members
 * API `partyHistory` exactly. The Members API is therefore a CROSS-CHECK for
 * party, not a dependency — which removes ~2.3M member-history lookups from the
 * critical path.
 *
 * ── ENDPOINTS ────────────────────────────────────────────────────────────────
 *   Commons (commonsvotes-api.parliament.uk) — 2,361 divisions, 2016-03-09 →
 *     list   GET /data/divisions.json/search?queryParameters.take=25&…skip=M
 *            ⚠ `divisions.json` is a ROUTE segment, not a format suffix.
 *     total  GET /data/divisions.json/searchTotalResults?queryParameters.take=1
 *     detail GET /data/division/{id}.json
 *            → { …, Ayes[], Noes[], AyeTellers[], NoTellers[], NoVoteRecorded[] }
 *            member = { MemberId, Name, Party, PartyAbbreviation, MemberFrom }
 *     ⚠ ids are SPARSE (1, 3, 1500, 2412 all 404) — walk the list, never 1..N.
 *
 *   Lords (lordsvotes-api.parliament.uk) — 3,284 divisions, 1999-11-24 →
 *     list   GET /data/Divisions/search?take=N&skip=M   (take is honoured)
 *     total  GET /data/Divisions/searchTotalResults
 *     detail GET /data/Divisions/{id}
 *            → { …, contents[], notContents[], contentTellers[],
 *                notContentTellers[], amendmentMotionNotes }
 *
 * Licence: Open Parliament Licence v3.0 (both).
 */

const COMMONS = 'https://commonsvotes-api.parliament.uk'
const LORDS = 'https://lordsvotes-api.parliament.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'

// Measured 10 Aug 2026, not assumed. Commons clamps server-side; asking for
// more than this is how the V28 enumerator convinced itself it had finished.
export const LIST_PAGE_CAP: Record<House, number> = { commons: 25, lords: 100 }

export type House = 'commons' | 'lords'

/** aye/no are cast votes. `absent` means the member WAS eligible and did not
 *  vote — only ever set where the source states it (Commons NoVoteRecorded).
 *  A member who is simply not listed is not represented at all: that is "not a
 *  member at this date", which is a different fact and must not be inferred. */
export type VoteState = 'aye' | 'no' | 'absent'

export interface DivisionMember {
  memberId: number
  name: string
  /** Party AS AT THE DIVISION DATE (verified — see header). */
  party: string | null
  partyAbbreviation: string | null
  /** MemberFrom: constituency for MPs, "Life peer" etc. for Lords. At the date. */
  constituency: string | null
  vote: VoteState
  teller: boolean
}

export interface DivisionListEntry { divisionId: number; date: string | null; title: string }

/** Where a division sits in the legislative process. Neither votes API states
 *  this, so it is PARSED and every field carries how confident that parse is. */
export interface DivisionContext {
  /** Parent Bill/instrument as named by the source, verbatim. */
  billTitle: string | null
  /** e.g. "Report Stage", "Second Reading", "Third Reading". */
  stage: string | null
  /** e.g. "Amendment 19", "New Clause 17". */
  amendment: string | null
  /** How billTitle/stage/amendment were obtained — never presented as if the
   *  API had supplied them. */
  provenance: 'commons-title-parse' | 'lords-motion-notes' | 'none'
}

export interface DivisionDetail {
  house: House
  divisionId: number
  number: number | null
  date: string | null            // ISO YYYY-MM-DD
  title: string
  /** The DIVISION RESULT as stated by the House. ⚠ THE TWO HOUSES DIFFER AND
   *  THE DIFFERENCE IS REAL, not a data fault:
   *
   *  - Commons: tellers are NOT counted in the lobby totals and appear only in
   *    `AyeTellers`/`NoTellers`. So `members.filter(aye).length` is normally
   *    `ayeCount + 2`.
   *  - Lords: tellers ARE counted, and appear in `contents`/`notContents` AND
   *    AGAIN in `contentTellers`/`notContentTellers`. So the counts already
   *    include them, and the raw arrays contain duplicates.
   *
   *  Both figures are kept: the official count is the one to quote, the member
   *  list is the one to count over. `members` is deduplicated (see below), so
   *  after dedupe the Lords member list matches the official count exactly. */
  ayeCount: number
  noCount: number
  /** Members who sat and did not vote. Empty AND `absenceKnown: false` for
   *  Lords — the source does not supply it. */
  absentCount: number
  /** false ⇒ absence is a KNOWN UNKNOWN for this division, not a measured zero. */
  absenceKnown: boolean
  context: DivisionContext
  members: DivisionMember[]
  /** Lords only: the prose motion note naming mover, amendment and clause. */
  motionNotes: string | null
}

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(45_000),
    })
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

export interface EnumerationResult {
  entries: DivisionListEntry[]
  /** searchTotalResults at the time of the walk. */
  expected: number | null
  /** entries.length === expected. A false here is a reconciliation failure and
   *  must stop the seed, not be logged and stepped over. */
  complete: boolean
  pages: number
}

/**
 * Enumerate every division for a house.
 *
 * Breaks on an EMPTY page — never on a short one. A short page means the server
 * clamped `take`, which is exactly what the Commons endpoint does; treating it
 * as end-of-list is the V28 bug this function exists to not repeat. The result
 * is reconciled against searchTotalResults so an incomplete walk is a reported
 * fact rather than a silently smaller number.
 */
export async function enumerateDivisions(
  house: House,
  delayMs = 300,
  onProgress?: (collected: number, pages: number) => void,
): Promise<EnumerationResult> {
  const take = LIST_PAGE_CAP[house]
  const expected = await divisionTotal(house)
  const seen = new Set<number>()
  const entries: DivisionListEntry[] = []
  let pages = 0

  for (let skip = 0; ; skip += take) {
    let page = await listDivisionsPage(house, skip, take)
    if (page === null) { // one polite retry
      await new Promise(r => setTimeout(r, 3000))
      page = await listDivisionsPage(house, skip, take)
    }
    if (page === null) throw new Error(`${house}: division list failed at skip=${skip} after retry`)
    pages++
    if (page.length === 0) break
    for (const e of page) if (!seen.has(e.divisionId)) { seen.add(e.divisionId); entries.push(e) }
    onProgress?.(entries.length, pages)
    // Guard against a server that ignores skip and serves page 1 forever.
    if (pages > 2 && entries.length < pages) throw new Error(`${house}: paging not advancing (${entries.length} unique over ${pages} pages)`)
    if (expected != null && entries.length >= expected) break
    await new Promise(r => setTimeout(r, delayMs))
  }

  return { entries, expected, complete: expected != null && entries.length === expected, pages }
}

// ── Context parsing (the Bill a division was carried inside) ──────────────────
//
// Charlie's requirement, quoted: "record what the provision was carried inside.
// A clause of interest may sit in a Bill about something else entirely, and the
// title of the parent Bill can be actively misleading about what was voted on."
// So all three of billTitle / stage / amendment are stored separately and the
// division title is kept verbatim as well — never collapsed into one string.

const STAGES = [
  'Second Reading', 'Third Reading', 'Report Stage', 'Committee of the whole House',
  'Committee Stage', 'Programme Motion', 'Money Resolution', 'Ways and Means',
  'Legislative Grand Committee', 'Consideration of Lords Amendments', 'Lords Amendments',
  'Reasoned Amendment to Second Reading', 'Ten Minute Rule Motion', 'Closure',
]

/** Commons titles are structured: "<Bill>: <Stage>: <Amendment>" or
 *  "<Bill> <Stage>: <Amendment>". 10 of the newest 25 name a Bill; the rest are
 *  SIs, motions and procedural questions, which correctly parse to nulls. */
export function parseCommonsContext(title: string): DivisionContext {
  const t = (title ?? '').trim()
  if (!t) return { billTitle: null, stage: null, amendment: null, provenance: 'none' }

  const amendment = t.match(/\b((?:New Clause|New Schedule|Amendment|Motion)\s+(?:No\.?\s*)?\d+[A-Za-z]?)/i)?.[1]?.trim() ?? null
  const stage = STAGES.find(s => new RegExp(`\\b${s.replace(/ /g, '\\s+')}\\b`, 'i').test(t)) ?? null

  let billTitle: string | null = null
  const billMatch = t.match(/^(.*?\bBill\b(?:\s*\[HL\])?)/i)
  if (billMatch) billTitle = billMatch[1].replace(/[:\-–—\s]+$/, '').trim()

  return {
    billTitle,
    stage,
    amendment,
    provenance: (billTitle || stage || amendment) ? 'commons-title-parse' : 'none',
  }
}

/** Lords carry `amendmentMotionNotes` — prose HTML naming the mover, the
 *  amendment number and the clause. Every one of 50 sampled divisions had it.
 *  Richer than the Commons title but unstructured, so parsed conservatively. */
export function parseLordsContext(title: string, motionNotes: string | null): DivisionContext {
  const t = (title ?? '').trim()
  const notes = stripHtml(motionNotes ?? '')
  const billTitle = /\bBill\b/i.test(t) ? t.replace(/[:\-–—\s]+$/, '').trim() : null
  const amendment = notes.match(/\b((?:amendment|manuscript amendment)\s+\d+[A-Za-z]?)/i)?.[1]?.trim() ?? null
  const stage = STAGES.find(s => new RegExp(`\\b${s.replace(/ /g, '\\s+')}\\b`, 'i').test(`${t} ${notes}`)) ?? null
  return {
    billTitle, stage, amendment,
    provenance: (billTitle || stage || amendment) ? 'lords-motion-notes' : 'none',
  }
}

export function stripHtml(html: string): string {
  return (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘')
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Detail (one division, full member breakdown) ──────────────────────────────
function commonsMembers(arr: any[] | undefined, vote: VoteState, teller: boolean): DivisionMember[] {
  return (arr ?? []).map((m: any) => ({
    memberId: m.MemberId,
    name: (m.Name ?? '').trim(),
    party: m.Party ?? null,
    partyAbbreviation: m.PartyAbbreviation ?? null,
    constituency: m.MemberFrom ?? null,
    vote,
    teller,
  }))
}
function lordsMembers(arr: any[] | undefined, vote: VoteState, teller: boolean): DivisionMember[] {
  return (arr ?? []).map((m: any) => ({
    memberId: m.memberId,
    name: (m.name ?? '').trim(),
    party: m.party ?? null,
    partyAbbreviation: m.partyAbbreviation ?? null,
    constituency: m.memberFrom ?? null,
    vote,
    teller,
  }))
}

/**
 * Collapse the per-array member lists into ONE ROW PER MEMBER.
 *
 * ⚠ THE LORDS LISTS ITS TELLERS TWICE — once in `contents`/`notContents` and
 * again in `contentTellers`/`notContentTellers`. Measured on division 3698:
 * 4 members appear in two arrays each (contents 64 + contentTellers 2 +
 * notContents 95 + notContentTellers 2 = 163 rows for 159 actual peers). The
 * Commons does not do this — the same check on division 2411 found 0.
 *
 * Concatenating the arrays therefore produced a duplicate `member_id` within a
 * single division, which is:
 *   - a primary-key collision on `division_votes` — Postgres rejects the whole
 *     roll-call with "ON CONFLICT DO UPDATE command cannot affect row a second
 *     time", so ONE Lords division would have failed EVERY Lords division;
 *   - a double-count in the compiled text, listing tellers twice and inflating
 *     the rendered aye/no totals above the official ones.
 *
 * Later entries merge into earlier ones rather than replacing them: the vote
 * comes from the main array (which is authoritative on how they voted) and the
 * teller arrays only set the flag.
 */
function dedupeMembers(members: DivisionMember[]): DivisionMember[] {
  const byId = new Map<number, DivisionMember>()
  for (const m of members) {
    const existing = byId.get(m.memberId)
    if (!existing) { byId.set(m.memberId, { ...m }); continue }
    // Seen already: keep the recorded vote, raise the teller flag if either says so.
    existing.teller = existing.teller || m.teller
  }
  return [...byId.values()]
}

export async function fetchDivisionDetail(house: House, id: number): Promise<DivisionDetail | null> {
  if (house === 'commons') {
    const d = await getJson(`${COMMONS}/data/division/${id}.json`)
    if (!d || d.DivisionId == null) return null
    const rawMembers = [
      ...commonsMembers(d.Ayes, 'aye', false),
      ...commonsMembers(d.AyeTellers, 'aye', true),
      ...commonsMembers(d.Noes, 'no', false),
      ...commonsMembers(d.NoTellers, 'no', true),
      // FAULT 2 fixed: the third array. Members who sat and did not vote.
      ...commonsMembers(d.NoVoteRecorded, 'absent', false),
    ]
    const members = dedupeMembers(rawMembers)
    const title = (d.Title ?? '').trim()
    return {
      house, divisionId: d.DivisionId, number: d.Number ?? null,
      date: d.Date ? String(d.Date).slice(0, 10) : null,
      title,
      ayeCount: d.AyeCount ?? 0,
      noCount: d.NoCount ?? 0,
      absentCount: Array.isArray(d.NoVoteRecorded) ? d.NoVoteRecorded.length : 0,
      // Present on every division sampled back to 2016-03-09. If the array is
      // missing entirely we do NOT claim zero absences.
      absenceKnown: Array.isArray(d.NoVoteRecorded),
      context: parseCommonsContext(title),
      members,
      motionNotes: null,
    }
  } else {
    const d = await getJson(`${LORDS}/data/Divisions/${id}`)
    if (!d || d.divisionId == null) return null
    const members = dedupeMembers([
      ...lordsMembers(d.contents, 'aye', false),
      ...lordsMembers(d.contentTellers, 'aye', true),
      ...lordsMembers(d.notContents, 'no', false),
      ...lordsMembers(d.notContentTellers, 'no', true),
    ])
    const title = (d.title ?? '').trim()
    const motionNotes = d.amendmentMotionNotes ?? null
    return {
      house, divisionId: d.divisionId, number: d.number ?? null,
      date: d.date ? String(d.date).slice(0, 10) : null,
      title,
      ayeCount: d.authoritativeContentCount ?? d.memberContentCount ?? 0,
      noCount: d.authoritativeNotContentCount ?? d.memberNotContentCount ?? 0,
      absentCount: 0,
      // ⚠ The Lords API does not publish who was absent. This is the whole
      // reason the flag exists: a 0 here means "not known", not "none".
      absenceKnown: false,
      context: parseLordsContext(title, motionNotes),
      members,
      motionNotes,
    }
  }
}

/**
 * Render one division to a searchable plain-text section.
 *
 * The searchable unit is the division, not the member: a query for a member
 * name or a motion should land the whole roll-call. Three things the V28
 * version did not carry are now in the text, because a fact that is stored but
 * not rendered is not retrievable:
 *
 *   - the parent Bill, the stage and the amendment, as separate labelled lines
 *   - the members who did not vote (Commons)
 *   - an explicit line saying Lords absence is not published, so the absence of
 *     an absentee list reads as a known gap rather than as a full house
 */
export function compileDivisionText(d: DivisionDetail): string {
  const houseLabel = d.house === 'commons' ? 'House of Commons' : 'House of Lords'
  const ayeLabel = d.house === 'commons' ? 'AYES' : 'CONTENTS'
  const noLabel = d.house === 'commons' ? 'NOES' : 'NOT CONTENTS'
  const ayes = d.members.filter(m => m.vote === 'aye')
  const noes = d.members.filter(m => m.vote === 'no')
  const absent = d.members.filter(m => m.vote === 'absent')
  const line = (m: DivisionMember) =>
    `${m.name}${m.party ? ` (${m.party}${m.constituency ? `, ${m.constituency}` : ''})` : ''}${m.teller ? ' [Teller]' : ''}`

  const parts: string[] = []
  parts.push(d.title || `${houseLabel} Division ${d.number ?? d.divisionId}`)
  parts.push(`${houseLabel} — Division ${d.number ?? ''}${d.date ? ` — ${d.date}` : ''}`.trim())

  // What the provision was carried inside — surfaced together, per the brief.
  if (d.context.billTitle) parts.push(`Bill: ${d.context.billTitle}`)
  if (d.context.stage) parts.push(`Stage: ${d.context.stage}`)
  if (d.context.amendment) parts.push(`Question: ${d.context.amendment}`)
  parts.push(`Division title: ${d.title}`)

  parts.push(`Result: ${ayeLabel} ${d.ayeCount}, ${noLabel} ${d.noCount}`)
  if (d.motionNotes) parts.push(`Motion: ${stripHtml(d.motionNotes)}`)
  parts.push('')
  parts.push(`${ayeLabel} (${ayes.length}):`)
  parts.push(ayes.map(line).join('\n') || '(none)')
  parts.push('')
  parts.push(`${noLabel} (${noes.length}):`)
  parts.push(noes.map(line).join('\n') || '(none)')

  parts.push('')
  if (d.absenceKnown) {
    parts.push(`NO VOTE RECORDED (${absent.length}):`)
    parts.push(absent.map(line).join('\n') || '(none)')
  } else {
    parts.push('NO VOTE RECORDED: not published for this House. The Lords Votes API')
    parts.push('lists only members who voted, so this division records no absentee')
    parts.push('list. Absence here is unknown, not zero.')
  }
  return parts.join('\n')
}
