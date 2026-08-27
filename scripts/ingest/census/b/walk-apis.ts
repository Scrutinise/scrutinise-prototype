/**
 * walk-apis.ts — PART B, WALKER 3. Every publisher that answers with a countable total.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ONE TABLE, ONE ROW PER COLLECTION, AND EVERY ROW SAYS WHERE ITS DENOMINATOR CAME FROM.
 *
 * Each entry names (a) the publisher endpoint that returns the size of the universe and (b) how a
 * row in `corpus_sections` reduces to one of the publisher's units. Neither side is allowed to be
 * derived from the other — that is the defect the whole sprint exists to end.
 *
 * ⚠ A `totalResults` header is only trusted where the publisher computes it server-side over the
 * WHOLE result set (the Parliament APIs and the gov.uk search API both do, and both return it with
 * `Take=1`/`count=0`, so it cannot be a page count). Where the only total available is a page
 * count, the walker follows the last-page link and counts entries — `countByPaging()` below.
 * legislation.gov.uk's header is NOT trusted anywhere; see walk-legislation.ts for why.
 *
 * ⚠ AN ENDPOINT THAT DOES NOT ANSWER PRODUCES `UNMEASURED`, NEVER A ZERO AND NEVER A GUESS. A
 * denominator invented from a failed request is worse than none: it prints as fact.
 *
 * Usage:
 *   tsx census/b/walk-apis.ts
 *   tsx census/b/walk-apis.ts --only=petitions,bills-api
 *   tsx census/b/walk-apis.ts --self-test
 */
import { pool } from '../../c2/db'
import { politeFetch, writeCensus, heldUnits, hollowUnits, selfTestHeld,
         DEFAULT_UNIT_EXPR, type CensusRow } from './harness'

const SELF_TEST = process.argv.includes('--self-test')
const ONLY = ((process.argv.find(a => a.startsWith('--only=')) ?? '').split('=')[1] ?? '')
  .split(',').filter(Boolean)

/** Pull the first plausible total out of a JSON body. The Parliament APIs disagree about the key
 *  name and one of them returns a bare integer. */
function readTotal(body: string): number | null {
  // ⚠ Five key names across five publishers, and `resultcount` (HUDOC) was missing from the first
  // version — which made a live endpoint that answers correctly read as UNMEASURED. An unrecognised
  // key looks exactly like a dead endpoint from here, so the list is exhaustive by measurement, not
  // by guesswork: every name below was read off a real response.
  const m = body.match(/"totalResults"\s*:\s*(\d+)/i) ?? body.match(/"totalCount"\s*:\s*(\d+)/i)
    ?? body.match(/"resultcount"\s*:\s*(\d+)/i)
    ?? body.match(/"total"\s*:\s*(\d+)/i) ?? body.match(/^\s*(\d+)\s*$/)
  return m ? Number(m[1]) : null
}

async function totalFrom(url: string): Promise<{ n: number; how: string } | null> {
  const r = await politeFetch(url, { floorMs: 400 })
  if (!r.text) return null
  const n = readTotal(r.text)
  return n === null ? null : { n, how: `server-side total from ${url}` }
}

/** Follow the publisher's own `links.last` and count what is on it. Used where no total exists. */
async function countByPaging(first: string, perPage: number, itemsKey = 'data'): Promise<{ n: number; how: string } | null> {
  const r = await politeFetch(first, { floorMs: 400 })
  if (!r.text) return null
  let j: any
  try { j = JSON.parse(r.text) } catch { return null }
  const lastUrl: string | undefined = j?.links?.last
  const count = (b: any) => Array.isArray(b?.[itemsKey]) ? b[itemsKey].length : 0
  if (!lastUrl) return { n: count(j), how: `single page of ${first}` }
  const lastPage = Number(new URL(lastUrl).searchParams.get('page') ?? '1')
  if (lastPage === 1) return { n: count(j), how: `single page of ${first}` }
  const rl = await politeFetch(lastUrl, { floorMs: 400 })
  if (!rl.text) return null
  let jl: any
  try { jl = JSON.parse(rl.text) } catch { return null }
  const n = (lastPage - 1) * perPage + count(jl)
  return { n, how: `page walk of ${first} — ${lastPage} pages of ${perPage}, last page holds ${count(jl)}` }
}

interface Source {
  key: string                       // census key (usually the corpus key)
  corpusKeys: string[]              // what holds it, [] if we hold nothing
  unit: string
  unitExpr?: string                 // SQL reducing a section row to a publisher unit
  hollow?: { predicate?: string; floorWords?: number }
  published: () => Promise<{ n: number; how: string } | null>
  note?: string
  /**
   * ⚠ `proxy` means: this endpoint counts a DIFFERENT universe from the one we hold. Its number is
   * recorded in `notes` for the next person and is NEVER used as a denominator — the row is
   * UNMEASURED however good the number looks.
   *
   * This flag exists because the first run of this walker printed `quangos-govuk 126,306.5%`,
   * `consultations 647.7%` and `hmrc-tiins 791 / 0`. Those are not coverage figures; they are three
   * different broken denominators wearing a percentage. A wrong denominator is worse than no
   * denominator, because it prints as fact — which is the exact defect this sprint exists to end,
   * arrived at from the opposite direction.
   */
  proxy?: boolean
}

const P_API = 'https://commonsvotes-api.parliament.uk'
const L_API = 'https://lordsvotes-api.parliament.uk'
const GOVUK = 'https://www.gov.uk/api/search.json'

const SOURCES: Source[] = [
  {
    key: 'bills-api', corpusKeys: ['bills-api'], unit: 'Bill',
    published: () => totalFrom('https://bills-api.parliament.uk/api/v1/Bills?Take=1'),
    note: 'Unit is a Bill, not a publication: we hold documents attached to bills, and one bill can carry many.',
  },
  {
    key: 'commons-divisions-votes', corpusKeys: ['commons-divisions-votes'], unit: 'division',
    published: () => totalFrom(`${P_API}/data/divisions.json/searchTotalResults?queryParameters.startDate=1900-01-01`),
  },
  {
    key: 'lords-divisions-votes', corpusKeys: ['lords-divisions-votes'], unit: 'division',
    published: () => totalFrom(`${L_API}/data/Divisions/searchTotalResults`),
  },
  {
    key: 'members-interests', corpusKeys: ['members-interests'], unit: 'registered interest',
    published: () => totalFrom('https://interests-api.parliament.uk/api/v1/Interests?Take=1'),
  },
  {
    key: 'committees-reports', corpusKeys: ['committees-reports'], unit: 'committee publication',
    published: () => totalFrom('https://committees-api.parliament.uk/api/Publications?Take=1'),
    note: 'The publisher counts every publication type; we hold reports and their sections.',
  },
  {
    key: 'committees-evidence', corpusKeys: ['committees-evidence'], unit: 'evidence submission',
    published: async () => {
      const oral = await totalFrom('https://committees-api.parliament.uk/api/OralEvidence?Take=1')
      const written = await totalFrom('https://committees-api.parliament.uk/api/WrittenEvidence?Take=1')
      if (!oral && !written) return null
      return { n: (oral?.n ?? 0) + (written?.n ?? 0),
        how: `oral ${oral?.n ?? '—'} + written ${written?.n ?? '—'} from committees-api.parliament.uk` }
    },
  },
  {
    key: 'petitions', corpusKeys: ['petitions'], unit: 'petition',
    published: async () => {
      const open = await countByPaging('https://petition.parliament.uk/petitions.json?page=1', 50)
      const arch = await countByPaging('https://petition.parliament.uk/archived/petitions.json?page=1', 50)
      if (!open && !arch) return null
      return { n: (open?.n ?? 0) + (arch?.n ?? 0),
        how: `open (${open?.how ?? '—'}) + archived (${arch?.how ?? '—'})` }
    },
  },
  {
    key: 'echr-hudoc', corpusKeys: ['echr-hudoc'], unit: 'judgment or decision against the UK',
    published: () => totalFrom('https://hudoc.echr.coe.int/app/query/results?query=contentsitename%3DECHR%20AND%20(NOT%20(doctype%3DPR%20OR%20doctype%3DHFCOMOLD%20OR%20doctype%3DHECOMOLD))%20AND%20respondent%3D%22GBR%22&select=itemid&sort=&start=0&length=1'),
    note: 'respondent=GBR, the same filter the ingest uses.',
  },
  {
    key: 'hmrc-manuals', corpusKeys: ['hmrc-manuals'], unit: 'manual page',
    published: () => totalFrom(`${GOVUK}?count=0&filter_content_store_document_type=hmrc_manual_section`),
    note: 'Unit is a manual PAGE (hmrc_manual_section), not a manual — gov.uk publishes 253 manuals.',
  },
  {
    key: 'hmrc-tiins', corpusKeys: ['hmrc-tiins'], unit: 'tax information and impact note',
    proxy: true,
    published: () => totalFrom(`${GOVUK}?count=0&filter_organisations=hm-revenue-customs&filter_content_store_document_type=tax_information_and_impact_note`),
    note: '⚠ gov.uk publishes NO `tax_information_and_impact_note` document type — measured 27 Aug, ' +
          'both the doctype and format filters return 0 against 791 held. TIINs are published as ' +
          'attachments to other documents, so there is no page-level universe to count. UNMEASURED ' +
          'until somebody finds the real index; a 0 denominator would have printed as ∞% complete.',
  },
  {
    key: 'consultations', corpusKeys: ['consultations'], unit: 'consultation',
    // ⚠ THREE document types, not two. The first version filtered open+closed only and returned
    // 1,150 against 7,448 held — 647.7%, which reads as a corpus bigger than the internet rather
    // than as a filter missing `consultation_outcome` (6,311 of the 7,461).
    published: () => totalFrom(`${GOVUK}?count=0&filter_content_store_document_type[]=open_consultation&filter_content_store_document_type[]=closed_consultation&filter_content_store_document_type[]=consultation_outcome`),
    note: 'All three gov.uk consultation states: open, closed, and outcome.',
  },
  {
    key: 'et-decisions', corpusKeys: ['et-decisions'], unit: 'employment tribunal decision',
    published: () => totalFrom(`${GOVUK}?count=0&filter_content_store_document_type=employment_tribunal_decision`),
    note: 'The 131,650 landing-page rows were deleted from Neon on 27 Aug; this counts the decisions ' +
          'that remain. ⚠ Its corpus_targets row was retired AND blocked by that same purge even though ' +
          'the collection still holds 161,753 real judgments — see the sprint report.',
  },
  {
    key: 'cma-cases', corpusKeys: ['cma-cases'], unit: 'CMA case',
    published: () => totalFrom(`${GOVUK}?count=0&filter_format=cma_case`),
  },
  {
    key: 'tax-tribunals', corpusKeys: ['tax-tribunals'], unit: 'tax tribunal decision',
    proxy: true,
    published: () => totalFrom(`${GOVUK}?count=0&filter_format=tax_tribunal_decision`),
    note: '⚠ gov.uk lists 1,434 tax tribunal decisions; we hold 12,027 from ' +
          'financeandtax.decisions.tribunals.gov.uk, the tribunal\'s OWN archive. Two different ' +
          'universes — gov.uk carries only the recent ones — so the gov.uk figure is recorded here ' +
          'and used for nothing. The tribunal archive has no countable index.',
  },
  {
    key: 'impact-assessments', corpusKeys: ['impact-assessments'], unit: 'impact assessment',
    published: () => totalFrom(`${GOVUK}?count=0&filter_content_store_document_type=impact_assessment`),
    note: '⚠ We hold impact assessments from legislation.gov.uk (ukia/…), gov.uk publishes its own; ' +
          'the two universes are not identical, so this is a CROSS-PUBLISHER denominator and the row is CLAIMED.',
  },
  {
    key: 'ots-reports', corpusKeys: ['ots-reports'], unit: 'OTS document',
    published: () => totalFrom(`${GOVUK}?count=0&filter_organisations=office-of-tax-simplification`),
    hollow: { predicate: `"format" IS NULL` },
    note: 'The publisher\'s own organisation field — the external denominator OI-25 called for. ' +
          '⚠ Every held row is a LANDING PAGE (OI-24): held is counted, hollow is counted, and coverage is reported net.',
  },
  {
    key: 'quangos-govuk', corpusKeys: ['quangos-govuk'], unit: 'gov.uk document',
    proxy: true,
    published: () => totalFrom(`${GOVUK}?count=0&filter_organisations=advisory-committee-on-releases-to-the-environment`),
    note: '⚠ ONE organisation of the many this collection draws from — 62 documents against 78,310 ' +
          'held. The real denominator is the sum over the organisation list in docs/CORPUS_SCOPE.md ' +
          'and does not exist yet. The first run of this walker printed 126,306.5% from this number; ' +
          'it is now recorded and used for nothing.',
  },
]

/** Which of these may print a percentage as fact, and which are honestly CLAIMED. A denominator
 *  that measures a DIFFERENT universe from the one we hold is not a measurement of us. */
const CLAIMED_KEYS = new Set(['impact-assessments'])

async function main() {
  if (SELF_TEST) { await selfTestHeld('apis'); return }
  const p = pool()
  const rows: CensusRow[] = []

  for (const s of SOURCES) {
    if (ONLY.length && !ONLY.includes(s.key)) continue
    const unitExpr = s.unitExpr ?? DEFAULT_UNIT_EXPR
    const held = await heldUnits(p, s.corpusKeys, unitExpr)
    const hollow = s.hollow ? await hollowUnits(p, s.corpusKeys, { unitExpr, ...s.hollow }) : 0
    const pub = await s.published()

    // A proxy denominator, or an endpoint that did not answer, produces the same row: UNMEASURED,
    // held printed, no percentage. The attempted number goes in `notes` so the next person starts
    // from what was already tried rather than re-running the same failed filter.
    if (!pub || s.proxy) {
      rows.push({ corpus_key: s.key, state: 'UNMEASURED', unit: s.unit,
        method: pub ? `proxy index, deliberately not used as a denominator: ${pub.how}`
                    : 'publisher index did not answer at walk time',
        published_units: null, held_units: held, hollow_units: hollow,
        absent_ids: [], absent_total: 0, walked_at: null, walk_artifact_path: null,
        notes: [s.note,
          pub ? `The proxy returned ${pub.n.toLocaleString()} against ${held.toLocaleString()} held.` : null,
          'No denominator recorded. An endpoint that fails, or one that counts a different universe, does not become a number.',
        ].filter(Boolean).join(' ') })
      continue
    }

    const state = CLAIMED_KEYS.has(s.key) ? 'CLAIMED' : 'MEASURED'
    const exact = pub.n === held
    rows.push({
      corpus_key: s.key,
      state,
      unit: s.unit,
      method: pub.how,
      walked_at: new Date(),
      published_units: pub.n,
      held_units: held,
      hollow_units: Math.min(hollow, held),
      absent_ids: [],
      absent_total: Math.max(0, pub.n - held),
      walk_artifact_path: state === 'MEASURED' ? `docs/census/${s.key}.json` : null,
      notes: [
        exact && state === 'MEASURED'
          ? `EXACT: the denominator is the publisher's own server-side count (${pub.how}) and the numerator is a DISTINCT count over corpus_sections; they agree because the collection is complete, not because one was copied from the other.`
          : null,
        s.note,
        held > pub.n ? `⚠ held EXCEEDS published (${held.toLocaleString()} > ${pub.n.toLocaleString()}) — the denominator is suspect, or the two sides count different things. No tick may be printed.` : null,
        hollow ? `hollow_units is a CANDIDATE detector (A3): it flags units whose text is a landing page, and it over-flags.` : null,
      ].filter(Boolean).join(' ') || null,
    })
  }

  await writeCensus(p, rows, 'apis')
  await p.end()
}

main().catch(e => { console.error('FAIL', e.message, e.stack); process.exit(1) })
