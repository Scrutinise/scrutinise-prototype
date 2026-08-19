/**
 * committee-attribution.ts — WHO A COMMITTEE DOCUMENT IS BY. BRIEF_INGEST_NAMES §2.
 *
 * ONE construction site, used by BOTH the live ingest writer (`workers/process-row.ts`) and the
 * backfill sweep (`names/sweep-evidence-attribution.ts`). Two sites is how the rows ingested
 * tomorrow come to be attributed differently from the rows backfilled today — the same reasoning
 * that keeps `lib/lex/attribution.ts` a single function on the read side.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * THE DISTINCTION THAT MATTERS MOST, AND THE ONE THE BRIEF CALLS THE MOST DAMAGING TO GET WRONG
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *   "a water company says the rules work"  ≠  "the committee found the rules work"
 *
 * So the author is decided by WHAT THE DOCUMENT IS, never by what is convenient:
 *
 *   written / oral evidence   → the WITNESS or the submitting ORGANISATION
 *   committee Report          → the COMMITTEE
 *   Government Response       → NEITHER. It is the Government's text, published under the
 *                               committee's inquiry, and the API's `respondingDepartment` was
 *                               populated on 1 of 100 sampled publications. A blank is correct;
 *                               the committee's name here would be a lie with a source.
 *
 * ⚠ THE COLUMN CARRIES THE KIND. `lib/lex/attribution.ts` reads `speaker` as a PERSON and
 * `attribution` as a BODY, so which column a name lands in is itself a claim about what it is.
 *
 * ⚠ ORAL EVIDENCE IS A SESSION-LEVEL FACT. We hold one row per whole transcript, so who said a
 * given sentence is not recoverable; what the source knows is who appeared. The panel goes to
 * `attribution` as a list, never to `speaker`, because four witnesses in a person field read as
 * one human being with semicolons in their name.
 */
import { decodeHtmlEntities } from './html-entities'

export interface CommitteeWitness {
  submitterType?: string
  name?: string | null
  organisations?: Array<{ name?: string | null; role?: string | null }> | null
}

export interface CommitteeEvidenceItem {
  anonymous?: boolean
  witnesses?: CommitteeWitness[] | null
}

export interface Attributed {
  /** A PERSON, or null. */
  speaker: string | null
  /** A BODY (or a list of them), or null. */
  attribution: string | null
  /** A fixed reason when nothing is stored — never free text, so misses can be counted. */
  miss: string | null
}

const clean = (s: string) => decodeHtmlEntities(s).replace(/\s+/g, ' ').trim()

/**
 * One witness → the name to show, and whether that name is a person or a body.
 *
 * ⚠ THE NAME LIVES IN A DIFFERENT PLACE DEPENDING ON `submitterType`. For an Organisation
 * submission `.name` is NULL and the name is in `organisations[0].name`; reading only `.name`
 * silently drops every organisation. That is not a rare shape — on the OralEvidence listing, 82
 * of 100 items carried `.organisations` and only 47 carried a witness `.name`.
 */
export function witnessName(w: CommitteeWitness): { name: string; kind: 'person' | 'body' } | null {
  const person = clean(w.name ?? '')
  if (w.submitterType === 'Individual' && person) return { name: person, kind: 'person' }
  const org = clean(w.organisations?.[0]?.name ?? '')
  if (org) return { name: org, kind: 'body' }
  // An Individual with neither a name nor an organisation is a real shape. It is a MISS, not an
  // unnamed person to be labelled "Individual".
  if (person) return { name: person, kind: 'person' }
  return null
}

/** Order-preserving dedupe — a four-person panel from two organisations must not read as four. */
export function dedupeJoin(names: string[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const n of names) {
    const k = n.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(n)
  }
  return out.join('; ')
}

function witnesses(item: CommitteeEvidenceItem) {
  return (item.witnesses ?? []).map(witnessName).filter(Boolean) as Array<{ name: string; kind: 'person' | 'body' }>
}

/** WRITTEN evidence — one submitter, so one name and one column. */
export function attributeWritten(item: CommitteeEvidenceItem): Attributed {
  if (item.anonymous === true) return { speaker: null, attribution: null, miss: 'anonymous-submission' }
  const ws = witnesses(item)
  if (ws.length === 0) return { speaker: null, attribution: null, miss: 'no-witness-record' }
  if (ws.length === 1 && ws[0].kind === 'person') return { speaker: ws[0].name, attribution: null, miss: null }
  if (ws.length === 1) return { speaker: null, attribution: ws[0].name, miss: null }
  // Joint submissions exist. A list is a body-level fact, never a person.
  return { speaker: null, attribution: dedupeJoin(ws.map(w => w.name)), miss: null }
}

/** ORAL evidence — a panel. Always body-level; never a speaker. See the header. */
export function attributeOral(item: CommitteeEvidenceItem): Attributed {
  if (item.anonymous === true) return { speaker: null, attribution: null, miss: 'anonymous-session' }
  const ws = witnesses(item)
  if (ws.length === 0) return { speaker: null, attribution: null, miss: 'no-witness-record' }
  return { speaker: null, attribution: dedupeJoin(ws.map(w => w.name)), miss: null }
}

/** Publication types whose text the COMMITTEE wrote. Everything else is left alone. */
const COMMITTEE_AUTHORED = new Set(['Report', 'Special Report'])

/**
 * A committee PUBLICATION → its author, or a reason there is none.
 *
 * ⚠ An unknown publication type is REFUSED rather than assumed committee-authored. "We have not
 * seen this type before" is not evidence that the committee wrote it.
 */
export function attributePublication(
  publicationType: string | null | undefined,
  committeeName: string | null | undefined,
): Attributed {
  if (!publicationType) return { speaker: null, attribution: null, miss: 'no-publication-type' }
  if (!COMMITTEE_AUTHORED.has(publicationType)) {
    return {
      speaker: null, attribution: null,
      miss: publicationType === 'Government Response'
        ? 'government-response'
        : `type-not-committee-authored:${publicationType}`,
    }
  }
  const name = clean(committeeName ?? '')
  if (!name) return { speaker: null, attribution: null, miss: 'no-committee-name' }
  return { speaker: null, attribution: name, miss: null }
}
