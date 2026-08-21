/**
 * fts-record.ts — THE ONE DEFINITION OF A `corpus_fts` ROW.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS (SEARCH S11 §4).
 *
 * Three tools write rows into `corpus_fts`, and until now each carried its own copy of the mapping
 * from a `corpus_sections` row to an index record:
 *
 *   build-fts-index.ts        the full rebuild
 *   fts-catchup.ts            appends ids the index lacks
 *   caselaw-text/refresh-fts-caselaw.ts   replaces rows whose CONTENT changed
 *
 * ⚠ THEY HAD ALREADY DRIFTED, AND THE DRIFT WAS INVISIBLE BECAUSE IT WAS HARMLESS WHERE IT SAT.
 * `build-fts-index` and `fts-catchup` both run legislation rows through `buildCitation`, which
 * replaces `sectionTitle` with a citation ("Data Protection Act 2018, s. 45") and prefixes the
 * body with a citation header. `refresh-fts-caselaw` does not — and its header says it "uses
 * exactly the record shape `fts-catchup` writes so the two cannot drift". That claim was true of
 * the fields and false of the derivation. It cost nothing there, because `tna-caselaw` is in the
 * `caselaw` tier and the citation branch only fires for `legislation`. Point the same code at a
 * legislation collection — which S11's re-tier does, and which any future backfill will — and it
 * silently strips every citation title it touches, leaving rows that look fine and no longer match
 * the query a user types.
 *
 * That is the whole reason the refresh path is being generalised rather than copied a fourth time:
 * **a record shape restated in four places is a record shape that will differ in one of them, and
 * the difference will be discovered by a user.**
 *
 * ── THE ONE RULE ────────────────────────────────────────────────────────────────────────────────
 * `tier` and `jurisdiction` are DERIVED, never stored — `corpus_sections` has no column for either
 * (corpus-map.ts). They are computed here, at write time, from `corpus`. That is precisely why a
 * tier-map edit does nothing until rows are rewritten, and why re-tiering is a WRITE rather than a
 * config change (stream-scopes.ts documents the consequence from the reading side).
 */
import { tierFor, jurisdictionFor, type Tier } from './corpus-map'
import { buildCitation, applyCitationToBody, gidFromId } from './citation'

/** The columns `corpus_sections` supplies. Named here so a caller's SELECT cannot quietly omit one. */
export interface SectionRow {
  id: string
  corpus: string
  sectionTitle: string | null
  itemDate: string | null
  speaker: string | null
  parentDocId: string | null
  availability_status: string | null
  wordCount: number | null
  r2Key?: string | null
}

/** Exactly the Lance schema in build-fts-index.ts. */
export interface FtsRecord {
  id: string
  corpus: string
  tier: Tier
  jurisdiction: string
  sectionTitle: string | null
  body: string
  itemDate: string | null
  speaker: string | null
  parentDocId: string | null
  availability_status: string | null
  wordCount: number | null
}

/** The SELECT every writer must issue. Shared so "the same columns" is enforced rather than
 *  remembered. `$1` is left to the caller — the three writers select by different predicates. */
export const SECTION_COLUMNS =
  `id, corpus, "sectionTitle", "itemDate"::text AS "itemDate", speaker, ` +
  `"parentDocId", availability_status, "wordCount", "r2Key"`

/**
 * One `corpus_sections` row + its body → one index record.
 *
 * @param actTitles gid → Act title, for the citation rewrite. Pass `null` ONLY when no row in the
 *   batch can be in the `legislation` tier; passing null for a legislation row would produce a
 *   record that differs from what a full rebuild writes, which is the drift this module exists to
 *   prevent — so it throws rather than degrading quietly.
 */
export function buildFtsRecord(r: SectionRow, rawBody: string, actTitles: Map<string, string> | null): FtsRecord {
  const tier = tierFor(r.corpus)
  let sectionTitle = r.sectionTitle
  let body = rawBody
  if (tier === 'legislation') {
    if (actTitles === null) {
      throw new Error(
        `buildFtsRecord: ${r.id} is in the legislation tier but no act-title index was supplied. ` +
        'A full rebuild would give this row a citation title; writing it without one would make ' +
        'the index disagree with itself. Load the act index (loadActIndex) and pass it.')
    }
    const gid = gidFromId(r.id)
    const cit = buildCitation(r.id, gid ? actTitles.get(gid) ?? null : null, r.sectionTitle)
    if (cit) {
      sectionTitle = cit.sectionTitle
      body = applyCitationToBody(cit.bodyHeader, body)
    }
  }
  return {
    id: r.id,
    corpus: r.corpus,
    tier,
    jurisdiction: jurisdictionFor(r.corpus),
    sectionTitle,
    body,
    itemDate: r.itemDate,
    speaker: r.speaker,
    parentDocId: r.parentDocId,
    availability_status: r.availability_status,
    wordCount: r.wordCount,
  }
}

/**
 * The re-tier case: an index row whose BODY is already correct and whose DERIVED columns are not.
 *
 * ⚠ WHY THIS IS A SEPARATE FUNCTION AND NOT `buildFtsRecord` WITH THE BODY READ FROM R2. Two
 * reasons, and the second is the one that matters:
 *
 *   1. Cost. Re-tiering ~48,900 rows through R2 is ~48,900 object reads for a change to one
 *      13-byte string column. The body is already in the index and is already right.
 *   2. ⚠ SAFETY. Re-reading from R2 would re-derive the body, so a re-tier would silently pick up
 *      every OTHER change since the row was written — a different compile, a different citation
 *      header — and ship it inside a change advertised as "moved to another tier". The two
 *      operations must stay separable, so that a re-tier can be reasoned about as a re-tier.
 *
 * So this carries `body` and `sectionTitle` through UNTOUCHED and recomputes only what is derived
 * from `corpus`. If the body is also wrong, that is a content refresh and it is the other function.
 */
export function retierRecord(row: FtsRecord): FtsRecord {
  return { ...row, tier: tierFor(row.corpus), jurisdiction: jurisdictionFor(row.corpus) }
}

/** gid → Act title, the input `buildCitation` needs. The query is shared for the same reason the
 *  record shape is: `build-fts-index` and `fts-catchup` each carried their own copy of it, and a
 *  writer that loaded a narrower set would produce citation titles for fewer rows than a rebuild.
 *  Typed loosely on purpose — `pg`'s Pool is not importable from every caller's tsconfig. */
export async function loadActTitles(pool: { query: (sql: string) => Promise<{ rows: Array<{ gid: string; title: string }> }> }): Promise<Map<string, string>> {
  const { rows } = await pool.query(
    `SELECT "legislationGovUkId" AS gid, title FROM "LegislationItem" ` +
    `WHERE "legislationGovUkId" IS NOT NULL AND title IS NOT NULL`)
  const m = new Map<string, string>()
  for (const r of rows) m.set(r.gid, r.title)
  return m
}

/** Every column the index carries — the projection a read-modify-write must request. A `select()`
 *  that forgets one would write NULL over it, so the list is data rather than a literal at a call
 *  site. */
export const FTS_COLUMNS: Array<keyof FtsRecord> = [
  'id', 'corpus', 'tier', 'jurisdiction', 'sectionTitle', 'body',
  'itemDate', 'speaker', 'parentDocId', 'availability_status', 'wordCount',
]
