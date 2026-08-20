// ─────────────────────────────────────────────────────────────────────────────
// attribution.ts — WHO SAID IT. BRIEF_SEARCH_S8 §2.
//
// S5 named this as a gap in the gateway contract: "a committee transcript currently reaches Lex
// with no 'who was speaking' — the most useful fact about that document." This module is the one
// place that answer is constructed, for both retrieval adapters and therefore for every caller.
//
// ════════════════════════════════════════════════════════════════════════════════════════════
// ⚠⚠ THE RULE THAT SHAPES EVERYTHING BELOW: NEVER PARSE ATTRIBUTION OUT OF A TITLE.
// ════════════════════════════════════════════════════════════════════════════════════════════
// §2 is explicit: "a title is display text, and a regex over display text is an inference
// travelling as a fact." Several collections put who-said-it in their title and nowhere else —
//
//     committees-reports  "Report: 4th Report … — EU Sub Committee E — HOUSE OF LORDS"
//     committees-evidence "The Internet: to regulate or not to regulate? inquiry — IRN0025"
//     scottish-courts     "Court of Session: 2010csih44 the scottish ministers v…"
//
// — and every one of those is a string a display rule composed, not a fact the ingest recorded.
// A regex over the first would work until a report title happened to contain an em dash; over
// the third it would name the court correctly and silently name a party as a court the day the
// prefix convention changed. So those collections ship `attribution: null`, which the contract
// defines to mean NOT HELD STRUCTURALLY — never *anonymous*.
//
// ════════════════════════════════════════════════════════════════════════════════════════════
// WHAT THE AUDIT FOUND (docs/S8_ATTRIBUTION_AUDIT.txt, 19 Aug 2026, ≥200 rows per id offset)
// ════════════════════════════════════════════════════════════════════════════════════════════
// Two structured columns exist on `corpus_sections`. Across all 54 non-legislation collections
// served through the evidence channel, 14 carry one of them and 40 carry neither:
//
//   speaker      12 collections — the whole pwdata family (90–100%), historic-hansard (87%),
//                Holyrood (92.5–100%), the Senedd (87.5%), early-day-motions (100%, the SPONSOR)
//                and tax-tribunals (100%, the JUDGE). pwdata-debates runs 4.0% in 1919 to 99.5%
//                from 2010 — an era gradient, not a flat rate.
//   attribution   2 collections — consultations and impact-assessments, both 100%, both packing
//                "{organisation} — {stage}" into one column.
//
// ⚠⚠ AND THE COLLECTION §2 EXISTS FOR WAS THE ONE THAT HAD NOTHING — UNTIL IT DIDN'T.
//
// The audit found `committees-evidence` at 0 of 800 rows across four id offsets, on both columns,
// and `committees-reports` at 0 of 600: the witness's name was inside the R2 document body and in
// no metadata we held. That was recorded here as a finding for the ingest thread.
//
// ⚠⚠ CC-INGEST CLOSED IT THE SAME NIGHT. As of 19 Aug 2026 committee evidence is **96.87%**
// attributed and committee reports **85.58%**, from data already inside requests we were paying
// for. **This paragraph was false for a day**, and so was the absence note built on it, which had
// begun telling the model to disclaim names it was being shown — the never-claim rule running
// backwards.
//
// ⚠ THE LESSON IS NOT "KEEP THE PERCENTAGES UP TO DATE." It is that a coverage figure written into
// code is a claim that decays the moment another thread does its job, and decays SILENTLY because
// nothing re-reads it. `attributionAbsenceNote(held, total)` counts the rows in front of it
// instead. The numbers above are kept because they are dated and describe a measurement that was
// taken; they are history, not the basis of any live behaviour.
//
// ⚠ ALSO ZERO, AND WORTH NAMING BECAUSE THEY LOOK LIKE THEY SHOULD NOT BE: all six case-law
// collections except tax-tribunals, all seventeen guidance collections, niassembly-hansard, the
// govuk `written-answers`/`written-statements` pair (the pwdata equivalents ARE populated), the
// three `lda-*` collections, and petitions.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Who a document is attributable to.
 *
 * `role` is assigned from the COLUMN the value came from and the COLLECTION it belongs to —
 * both structural facts — and never from the document's own words.
 */
export interface Attribution {
  /** A person for `speaker`; an organisation for `attribution`. */
  name: string
  /** What they were to this document, in words a prompt and a user can both read. */
  role: string
  /** Which stored column produced it. Carried so a reader can tell a named speaker from a
   *  publishing body without re-deriving it from `role`'s wording. */
  source: 'speaker' | 'publisher'
}

/** The raw structured columns, exactly as `corpus_sections` holds them. */
export interface AttributionSource {
  /** `corpus_sections.speaker`. */
  speaker?: string | null
  /** `corpus_sections.attribution`. */
  attribution?: string | null
}

/**
 * ⚠⚠ WHAT THE `speaker` COLUMN MEANS, PER COLLECTION — and it is NOT always a speaker.
 *
 * Every phrase below was read off the ingest writer in `scripts/ingest/workers/process-row.ts`,
 * not inferred from the column's name. Three of them would have been wrong if they had been:
 *
 *   early-day-motions   `speaker: mo.primarySponsor`   — the member who TABLED the motion.
 *                                                        Nobody spoke; an EDM is a signature sheet.
 *   tax-tribunals       `speaker: decision.chairmen`   — the JUDGE who decided the case.
 *                                                        Describing a judge as "speaking in a
 *                                                        debate" would be a category error in
 *                                                        front of a user reading a tax decision.
 *   pwdata-wrans/-wms   `speaker: it.answeringMember ?? it.answeringBody`
 *                                                      — the minister ANSWERING, which is not
 *                                                        the member who asked.
 *
 * ⚠ AN UNNAMED COLLECTION GETS THE GENERIC PHRASE, deliberately. A prefix rule over corpus names
 * would one day describe a Senedd contribution as a Commons one — the exact hazard
 * `deepening-retrieval.ts::jurisdictionOf` exists to avoid on the jurisdiction axis.
 *
 * Coverage measured 19 Aug 2026 (docs/S8_ATTRIBUTION_AUDIT.txt), ≥200 rows per id offset.
 */
const SPEAKER_ROLE: Record<string, string> = {
  // Westminster — one section per speech (INGEST V18 granularity).
  'pwdata-debates': 'speaking in the House of Commons, on the record',          // 4.0%→99.5% by era
  'pwdata-lords': 'speaking in the House of Lords, on the record',              // 90.0%
  'pwdata-westminster': 'speaking in Westminster Hall, on the record',          // 98.5%
  'historic-hansard': 'speaking in Parliament, on the record',                  // 87.0%
  // ⚠ The ANSWERING minister, not the member who asked the question.
  'pwdata-wrans': 'the minister or body that answered this written question',   // 100%
  'pwdata-wms': 'the minister who made this written statement',                 // 100%
  'pwdata-lordswrans': 'the minister or body that answered this written question in the Lords', // 100%
  'pwdata-lordswms': 'the minister who made this written statement in the Lords',               // 100%
  // Devolved.
  'scottish-parliament-or': 'speaking in the Scottish Parliament, on the record', // 92.5–100%
  'senedd-cofnod': 'speaking in the Senedd, on the record',                       // 87.5%
  // ⚠ NOT a speaker at all.
  'early-day-motions': 'the member who tabled this motion (its primary sponsor)', // 100%
  'tax-tribunals': 'the judge who decided this case',                            // 100%
}

/**
 * ⚠ THE STORED PACKING, WHICH IS AN INGEST FORMAT AND NOT DISPLAY TEXT.
 *
 * `consultations` and `impact-assessments` both store `"{organisation} — {stage}"` (and
 * `consultations` sometimes stores the organisation alone, sometimes as a slug). Splitting on
 * that separator is reading a two-field value out of one column — the same thing
 * `political-title.ts` already does with `department.split('—')[0]` — and it is NOT the banned
 * move, which is inferring a fact from a sentence written for a reader.
 *
 * The distinction is worth stating plainly because the two look alike: this separator was put
 * there by the writer to be split on; a title's em dash was put there to be read.
 */
function splitPacked(raw: string): { org: string; stage: string | null } {
  const parts = raw.split(/\s+—\s+|\s+--\s+/)
  const org = (parts[0] ?? '').trim()
  const stage = parts.length > 1 ? parts.slice(1).join(' — ').trim() : null
  return { org, stage: stage || null }
}

const LOWER = new Set(['of', 'for', 'and', 'the', 'to', 'in', 'on', 'a', 'an'])

/**
 * `department-for-education` → `Department for Education`.
 *
 * ⚠ A SEPARATOR TRANSFORM, NOT A LOOKUP. It changes punctuation and case and nothing else, so
 * it cannot invent or correct an organisation — `ministry-of-housing-communities-and-local-
 * government-2018-2021` comes back with its year range intact rather than tidied away, because
 * removing it would be editing the stored fact. Values that are already prose (about half of
 * `consultations`) contain no hyphen-joined lowercase run and pass through untouched.
 */
export function deslug(raw: string): string {
  const s = raw.trim()
  if (!/^[a-z0-9]+(-[a-z0-9]+)+$/.test(s)) return s
  return s
    .split('-')
    .map((w, i) => (i > 0 && LOWER.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

/**
 * Build the attribution for one retrieved row, or null.
 *
 * ⚠⚠ THIS IS THE ONLY FUNCTION IN THE CODEBASE THAT RETURNS AN `Attribution`, and the only
 * place `attribution: null` is assigned for a search result. `scripts/check-s8-attribution.ts`
 * greps for both facts. A second construction site is how one adapter would come to attribute a
 * row that the other left blank — the same class of drift `political-title.ts` exists to prevent
 * on the title axis.
 *
 * ⚠ It takes COLUMNS, never a title. There is deliberately no `title` parameter: the banned
 * inference is not reachable from here even by accident.
 */
export function attributionFor(corpus: string, src: AttributionSource): Attribution | null {
  const speaker = src.speaker?.trim()
  if (speaker) {
    return {
      name: speaker,
      // ⚠ The generic phrase is deliberately vague — "named on this record" claims only that the
      // ingest recorded them against it, which is the one thing true of every collection. A
      // confident-sounding default ("speaking in Parliament") would have been wrong for a tax
      // judge and an EDM sponsor, both of which the audit found carrying this column.
      role: SPEAKER_ROLE[corpus] ?? 'named on this record',
      source: 'speaker',
    }
  }

  const packed = src.attribution?.trim()
  if (packed) {
    const { org, stage } = splitPacked(packed)
    if (!org) return null
    const name = deslug(org)
    // The stage ("Final", "Consultation") is a real fact about the document and is kept, because
    // a final impact assessment and a consultation-stage one are different documents.
    const base = corpus === 'impact-assessments'
      ? 'the department that published this assessment'
      : corpus === 'consultations'
        ? 'the body that ran this consultation'
        : 'the body that published it'
    return { name, role: stage ? `${base} (${stage} stage)` : base, source: 'publisher' }
  }

  // NOT HELD STRUCTURALLY. Not "anonymous", and never to be filled from the title.
  return null
}

/** One line for a prompt or a panel: `— Lindsay Hoyle, speaking in Parliament, on the record`. */
export function attributionLine(a: Attribution | null | undefined): string | null {
  if (!a) return null
  return `— ${a.name}, ${a.role}`
}

/**
 * ⚠ The sentence that stops a null being read as anonymity, carried into the prompt beside the
 * evidence block. Without it a model looking at ten committee transcripts with no attribution
 * has every reason to describe them as anonymous submissions, which they are not.
 *
 * ⚠⚠ 25-C §1a — IT IS NOW MEASURED, BECAUSE THE ASSERTED VERSION WENT STALE AND INVERTED THE RULE
 * IT EXISTS TO ENFORCE.
 *
 * The old constant closed by asserting, as a standing fact, that committee witness names were not
 * stored as a field. CC-Ingest recovered them overnight on 19 Aug 2026 and **96.87% of committee
 * evidence rows now carry attribution** — so the sentence was telling the model to disclaim names
 * it was being handed. A never-claim rule running backwards is still a false statement, and a worse
 * one than the gap it replaced, because it makes Lex sound careful while being wrong.
 *
 * The lesson is not "update the sentence". A hardcoded fact about coverage is a claim that decays
 * silently the moment the ingest thread does its job — it nearly did this to the Deepening's known
 * unknowns too (see deepening.ts invariant 2). So the note now COUNTS THE ROWS IN FRONT OF IT and
 * says what is true of those, which cannot go stale because it is recomputed per call.
 */
export function attributionAbsenceNote(held: number, total: number): string {
  const missing = Math.max(0, total - held)
  return `${held} of the ${total} item${total === 1 ? '' : 's'} below carry a "—" line naming who `
    + `said it; ${missing} do not. Where a line is MISSING, who said it is not held in our metadata `
    + 'FOR THAT ROW. That is not the same as the source being anonymous, and you must never say or '
    + 'imply that it is — a committee transcript names its witness inside the document even where '
    + 'our index has not captured it.'
}
