/**
 * consultations.ts — §C of BRIEF_INGEST_POLITICAL_SOURCES.
 *
 * "The 'who said what before the law passed' record — organisations stating
 * positions in their own words, on the record, dated." The highest-value single
 * input to the position graph, because it yields `responded-to-consultation`
 * and `holds-position` edges for bodies that never appear before a select
 * committee.
 *
 * ── ROUTE (bulk → HTML → API) ────────────────────────────────────────────────
 * There is no bulk dump. GOV.UK publishes a search index and a content API, not
 * a corpus download — checked before building an API client rather than after.
 * So this is the API route, and it is the API route by elimination.
 *
 *     enumerate  https://www.gov.uk/api/search.json?filter_content_store_document_type=…
 *     content    https://www.gov.uk/api/content{path}
 *
 * The enumerator is the one already proven in `govuk-content.ts` (deep paging
 * verified past start=84,000 — no 10k cap), so this reuses that shape.
 *
 * ── MEASURED UNIVERSE (10 Aug 2026) ──────────────────────────────────────────
 *     open_consultation      86
 *     closed_consultation  1,059
 *     consultation_outcome 6,302
 *     TOTAL                7,447
 * ⚠ `content_store_document_type=consultation` returns 0 — it is not a real
 * type on GOV.UK. Filtering on it is a silent empty ingest.
 *
 * ── THE THREE THINGS THE BRIEF ASKS FOR BEYOND THE TEXT ──────────────────────
 *
 * 1. THE RESPONDING ORGANISATION'S NAME AS GIVEN, VERBATIM, plus any normalised
 *    form — "entity resolution across registers is the largest hidden cost in
 *    the graph build and the original spelling is evidence". So `rawName` is
 *    never overwritten by `normalisedName`; both are stored, and normalisation
 *    is deliberately conservative (case, punctuation, legal suffixes) rather
 *    than clever, because an aggressive normaliser silently merges two real
 *    bodies and there is no way back once the raw string is gone.
 *
 * 2. INDIVIDUAL vs SUMMARISED. `responseKind` is required, not optional.
 *    "A summarised response is the department's characterisation of what
 *    someone said, not what they said, and the two must not be presented as
 *    equivalent." The `consultation_outcome` schema separates
 *    `final_outcome_attachments` (the government response) from `attachments`
 *    (the consultation document and anything published alongside), which is
 *    what makes the distinction recoverable at all.
 *
 * 3. DATES ON EVERYTHING, "so a position can be attributed to a moment rather
 *    than to a body in general" — `opening_date`, `closing_date` and
 *    `first_public_at` all come off the content payload.
 *
 * ⚠ Committee consultations are already covered by `committees-evidence` and
 * are NOT duplicated here (brief, §C sources).
 *
 * Licence: OGL v3.0 (gov.uk/help/terms-conditions).
 */

const SEARCH = 'https://www.gov.uk/api/search.json'
const CONTENT = 'https://www.gov.uk/api/content'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'

/** The three real types. `consultation` is deliberately absent — it returns 0. */
export const CONSULTATION_TYPES = ['open_consultation', 'closed_consultation', 'consultation_outcome'] as const
export type ConsultationType = typeof CONSULTATION_TYPES[number]

export interface ConsultationListEntry {
  link: string
  title: string
  type: ConsultationType
  date: string | null
}

/** How a position reached us. The distinction is the point — see header §2. */
export type ResponseKind =
  | 'consultation-document'   // what was asked
  | 'government-response'     // what the department did with the answers
  | 'individual-response'     // a named respondent, in their own words
  | 'summarised-responses'    // the department's characterisation of others
  | 'supporting-document'

export interface ConsultationAttachment {
  title: string
  url: string
  contentType: string | null
  kind: ResponseKind
  /** Verbatim organisation string as it appears, before any tidying. Null when
   *  the attachment does not name one — never guessed from the filename. */
  rawOrganisationName: string | null
  normalisedOrganisationName: string | null
}

export interface Consultation {
  path: string
  title: string
  type: ConsultationType
  /** Body HTML from the content API — the consultation's own description. */
  bodyHtml: string
  openingDate: string | null
  closingDate: string | null
  firstPublishedAt: string | null
  /** Department(s) running it, by gov.uk slug. */
  organisations: string[]
  attachments: ConsultationAttachment[]
  /** Present on outcomes: the department's summary of what it decided. */
  finalOutcomeDetail: string | null
}

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

// ── Enumeration ──────────────────────────────────────────────────────────────
export async function countType(type: ConsultationType): Promise<number> {
  const d = await getJson(`${SEARCH}?filter_content_store_document_type=${type}&count=0`)
  return Number(d?.total ?? 0)
}

export async function* listConsultations(type: ConsultationType, pageSize = 200): AsyncGenerator<ConsultationListEntry[]> {
  for (let start = 0; ; start += pageSize) {
    // `order=public_timestamp` keeps deep paging deterministic — ordering by a
    // non-sortable field 422s, which is how the govuk-content seeder first
    // failed (see sources/govuk-content.ts).
    const d = await getJson(`${SEARCH}?filter_content_store_document_type=${type}` +
      `&count=${pageSize}&start=${start}&order=public_timestamp&fields=link,title,public_timestamp`)
    const results: any[] = d?.results ?? []
    if (!results.length) return
    yield results.map(r => ({
      link: r.link,
      title: r.title ?? '',
      type,
      date: r.public_timestamp ? String(r.public_timestamp).slice(0, 10) : null,
    }))
    if (results.length < pageSize) return
    await new Promise(r => setTimeout(r, 300))
  }
}

// ── Organisation names ───────────────────────────────────────────────────────

/**
 * Conservative normalisation. Case, punctuation, whitespace and the common
 * legal suffixes — nothing that could merge two genuinely different bodies.
 *
 * Deliberately NOT done here: acronym expansion, fuzzy matching, stripping
 * "The", or mapping to any register. Those belong in the graph build where a
 * merge can be reviewed and reversed. The raw string always survives beside
 * this, so an over-eager rule here is recoverable — but only because we kept it.
 */
export function normaliseOrganisation(raw: string): string {
  return (raw ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[’']/g, "'")
    .trim()
    .replace(/[.,;:]+$/, '')
    .replace(/\s*\b(limited|ltd|llp|plc|inc|incorporated|cic|c\.i\.c)\b\.?$/i, '')
    .replace(/\s*\((?:the\s+)?[a-z]{2,8}\)$/i, '')   // trailing acronym in brackets
    .trim()
    .toLowerCase()
}

/**
 * Classify an attachment. The `kind` decides whether a downstream reader may
 * quote it as somebody's position or must present it as the department's
 * characterisation, so a wrong guess here is a misattribution — the rules are
 * therefore keyed on explicit wording and everything unmatched falls through to
 * `supporting-document` rather than to a flattering guess.
 */
export function classifyAttachment(title: string, isFinalOutcome: boolean): ResponseKind {
  const t = (title ?? '').toLowerCase()
  if (/summary of (the )?responses|responses? received|analysis of responses|summary of consultation responses/.test(t)) return 'summarised-responses'
  if (isFinalOutcome || /government response|consultation (outcome|response)|response to (the )?consultation/.test(t)) return 'government-response'
  if (/consultation (document|paper)|call for evidence|consultation on/.test(t)) return 'consultation-document'
  if (/^response (from|by) |submission (from|by) /.test(t)) return 'individual-response'
  return 'supporting-document'
}

/** Pull a verbatim organisation out of an attachment title, only where the
 *  title states it in a recognised frame. Returns null rather than guessing —
 *  a filename is not an attribution. */
export function extractOrganisation(title: string): string | null {
  const m = (title ?? '').match(/^(?:response|submission|evidence)\s+(?:from|by)\s+(.+?)(?:\s*[-–—]\s*.*)?$/i)
  return m ? m[1].trim() : null
}

// ── One consultation, in full ────────────────────────────────────────────────
export async function fetchConsultation(path: string, type: ConsultationType): Promise<Consultation | null> {
  const c = await getJson(`${CONTENT}${path}`)
  if (!c || !c.details) return null
  const d = c.details

  const build = (arr: any[], isFinal: boolean): ConsultationAttachment[] =>
    (arr ?? [])
      // ⚠ `final_outcome_attachments` routinely carries placeholder entries with
      // neither a title nor a url. Rendered naively they became blank
      // "[government-response]" lines — a document that does not exist,
      // presented as the government's response. Dropped here, at the parse, so
      // no consumer has to know about them.
      .filter((a: any) => (a?.title ?? '').trim() || (a?.url ?? '').trim())
      .map((a: any) => {
        const title = (a.title ?? '').trim()
        const raw = extractOrganisation(title)
        const url = (a.url ?? '').trim()
        return {
          title,
          // Attachment urls are sometimes site-relative (an HTML annexe rather
          // than an assets.publishing PDF). Absolutised so a stored link works.
          url: url.startsWith('/') ? `https://www.gov.uk${url}` : url,
          contentType: a.content_type ?? null,
          kind: classifyAttachment(title, isFinal),
          rawOrganisationName: raw,
          normalisedOrganisationName: raw ? normaliseOrganisation(raw) : null,
        }
      })

  return {
    path,
    title: c.title ?? '',
    type,
    bodyHtml: d.body ?? '',
    openingDate: d.opening_date ? String(d.opening_date).slice(0, 10) : null,
    closingDate: d.closing_date ? String(d.closing_date).slice(0, 10) : null,
    firstPublishedAt: (d.first_public_at ?? c.first_published_at) ? String(d.first_public_at ?? c.first_published_at).slice(0, 10) : null,
    organisations: (c.links?.organisations ?? []).map((o: any) => o.base_path?.replace('/government/organisations/', '') ?? o.title ?? ''),
    attachments: [
      ...build(d.attachments, false),
      ...build(d.final_outcome_attachments, true),
    ],
    finalOutcomeDetail: d.final_outcome_detail ?? null,
  }
}

export function stripHtml(html: string): string {
  return (html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘')
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Render one consultation to searchable text.
 *
 * The attachment list is rendered WITH its `kind` label, so a reader (human or
 * retrieval) can see that "Summary of responses" is the department's account
 * and not a quotation. Rendering the titles without their kind would put the
 * two on the same footing, which is the specific thing the brief forbids.
 */
export function compileConsultationText(c: Consultation): string {
  const p: string[] = []
  p.push(c.title)
  p.push(`GOV.UK consultation — ${c.type.replace(/_/g, ' ')}`)
  if (c.organisations.length) p.push(`Published by: ${c.organisations.join(', ')}`)
  const dates = [
    c.openingDate ? `opened ${c.openingDate}` : null,
    c.closingDate ? `closed ${c.closingDate}` : null,
    c.firstPublishedAt ? `first published ${c.firstPublishedAt}` : null,
  ].filter(Boolean)
  if (dates.length) p.push(`Dates: ${dates.join('; ')}`)
  p.push('')
  p.push(stripHtml(c.bodyHtml))
  if (c.finalOutcomeDetail) {
    p.push('')
    p.push('GOVERNMENT RESPONSE (the department’s own account of the outcome):')
    p.push(stripHtml(c.finalOutcomeDetail))
  }
  if (c.attachments.length) {
    p.push('')
    p.push('DOCUMENTS:')
    for (const a of c.attachments) {
      p.push(`- [${a.kind}] ${a.title}${a.rawOrganisationName ? ` — respondent as given: "${a.rawOrganisationName}"` : ''}`)
      p.push(`  ${a.url}`)
    }
    const summarised = c.attachments.filter(a => a.kind === 'summarised-responses').length
    const individual = c.attachments.filter(a => a.kind === 'individual-response').length
    if (summarised && !individual) {
      p.push('')
      p.push('⚠ Responses to this consultation are published only in summary. What')
      p.push('appears above is the department’s characterisation of what respondents')
      p.push('said, not what they said.')
    }
  }
  return p.join('\n')
}
