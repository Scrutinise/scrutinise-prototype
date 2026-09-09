// grain.ts — WHAT UNIT IS BEING RETRIEVED. SEARCH S19 §2/§3.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
// WHY THIS FILE EXISTS AT ALL
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Three sprints found the same defect from three directions and none of them could name the unit:
//
//   S16 autopsy   12 of 32 failures are a long document scored as a whole when the answer is a
//                 paragraph.
//   ARGUMENT 1A   48.8% of what dense retrieval returns on an argument probe is under 30 words;
//                 92.6% of parliamentary sections are a single chunk.
//   S18 §1        impact assessments, scoped to their own collection, BM25 only: section-level
//                 0 of 9, DOCUMENT-level 4 of 9, document-level in top 200 8 of 9.
//
// The corpus is stored at ONE grain (`corpus_sections`) and indexed at TWO (`corpus_fts` is one
// row per section; `corpus_vec` is one row per ~3,200-character chunk, collapsed back to sections
// before anything sees it). A DOCUMENT is not a unit anything retrieves or stores — it exists only
// as a key you can compute. This module is that computation, and it is here rather than in a
// harness because CLAUDE.md §25.3 is explicit: a check that re-implements the rule asserts that two
// pieces of code agree, which they do until one is fixed.
//
// ⚠ RUNTIME-DEPENDENCY-FREE ON PURPOSE, exactly like stream-scopes.ts — no imports at all, so
// `scripts/ingest/**` (outside the Next.js path alias) can take the same object rather than a copy.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
// ⚠⚠ THE TRAP THIS FILE IS MOSTLY ABOUT: `parentDocId` IS NOT ALWAYS THE DOCUMENT
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Two rules are available and each is wrong somewhere. Measured against `corpus_sections` on
// 2026-09-09, over every collection holding a validated answer key:
//
//   · `parentDocId`, the ingest-side parent. Right for committees, debates, NI and Scottish
//     Hansard. ⚠ WRONG for `impact-assessments`, where it names the INSTRUMENT the assessment is
//     about (`uksi/2020/971`) — 17,770 rows over 1,049 instruments, so two different assessments of
//     one instrument collapse into one "document". S18 §B found this and took the id instead.
//     ⚠ ABSENT entirely for `consultations`, `primary-acts-*`, `regional`, `si-2010plus` and
//     `tna-caselaw` — 0 non-null rows in each.
//   · the id's second colon segment. Right for impact assessments (`impact-assessments:2020-57:12`
//     → `2020-57`), for Acts (`primary-acts-2000plus:ukpga/2008/4:section-1` → `ukpga/2008/4`) and
//     for judgments. ⚠ CATASTROPHIC for committees: every id is
//     `committees-reports:publication:{report}:{section}`, so segment 2 is the literal word
//     `publication` and ALL 344,773 sections of ALL 51,000 reports collapse into one document.
//     Measured: distinct id-prefix(2) = 1 for `committees-reports`, 2 for `committees-evidence`.
//
// So the rule is: prefer `parentDocId`, with `impact-assessments` named as the one exception, and
// fall back to segment 2 where there is no parent. It is stated as data below rather than as an
// `if`, so the next collection that needs an exception is added to a list a reader can see.
//
// ⚠⚠ AND THE MOST IMPORTANT PROPERTY OF THE RESULT IS THAT FOR MANY COLLECTIONS IT CHANGES
// NOTHING. `documentsCollapse` is true where one document holds exactly one section — measured, not
// assumed — and there the document grain and the section grain are THE SAME UNIT. A grain
// experiment cannot move those collections at all, and a table that did not say so would report a
// null result as a finding. That property is also this module's own control: recall at the two
// grains MUST be identical there, and `check:s19-grain` fails if it is not.

/** The three grains the corpus can be scored at. Ordered coarse-last. */
export type Grain = 'chunk' | 'section' | 'document'

export const GRAINS: Grain[] = ['chunk', 'section', 'document']

/**
 * Collections where `parentDocId` is populated but does NOT name the document the user would think
 * of. One entry today, and it is here rather than inline because the failure it prevents is silent:
 * the wrong key still produces a number, just a number about the wrong unit.
 */
export const PARENT_IS_NOT_THE_DOCUMENT: Record<string, string> = {
  // `parentDocId` is the INSTRUMENT the assessment appraises (`uksi/2020/971`), not the assessment.
  // 18,759 sections carry 1,049 distinct parents but 1,172 distinct assessments — so two
  // assessments of one instrument would be scored as one document. S18 §B, reproduced 2026-09-09.
  'impact-assessments': 'parentDocId names the instrument appraised, not the assessment',
}

/**
 * The DOCUMENT a section belongs to, as a key that is unique across the whole corpus.
 *
 * `parentDocId` is only unique WITHIN a collection (`publication:34458`, `debates2024-11-29d`,
 * `12761`), so the collection is always prefixed. Two collections both using bare integers is not
 * hypothetical — `niassembly-hansard` and `scottish-parliament-or` both do.
 *
 * @param id           the `corpus_sections.id`, e.g. `pwdata-debates:debates2024-11-29d:3`
 * @param parentDocId  `corpus_sections.parentDocId`, or null/undefined where ingest stored none
 */
export function documentKeyOf(id: string, parentDocId?: string | null): string {
  const corpus = id.split(':')[0]
  if (parentDocId && !(corpus in PARENT_IS_NOT_THE_DOCUMENT)) return `${corpus}:${parentDocId}`
  const seg2 = id.split(':')[1]
  // A one-segment id has no document to speak of; it is its own document rather than a null we
  // would then have to special-case at every call site.
  return seg2 === undefined ? id : `${corpus}:${seg2}`
}

/**
 * Collapse a ranked list of SECTIONS to a ranked list of DOCUMENTS, first occurrence wins.
 *
 * ⚠ THIS IS A DISPLAY-SIDE COLLAPSE, NOT A DOCUMENT-GRAIN RETRIEVAL, and conflating the two is
 * the easiest mistake in this area. Collapsing re-uses the section ranking and only removes
 * duplicates; a document whose sections all rank badly stays badly ranked. Scoring the document as
 * a unit (`aggregateToDocuments`) can promote a document whose thirty sections each rank at 60 —
 * which no collapse will ever do. Both are reported in S19 §2 and they are different numbers.
 */
export function collapseToDocuments<T extends { id: string; parentDocId?: string | null }>(
  ranked: T[],
): Array<{ documentKey: string; first: T; rank: number }> {
  const seen = new Map<string, { documentKey: string; first: T; rank: number }>()
  for (const r of ranked) {
    const k = documentKeyOf(r.id, r.parentDocId)
    if (!seen.has(k)) seen.set(k, { documentKey: k, first: r, rank: seen.size + 1 })
  }
  return [...seen.values()]
}

/** How a document's score is derived from its sections' scores. */
export type DocumentAggregation = 'max' | 'sum' | 'sum-top3'

/**
 * Score DOCUMENTS from a deep ranked list of sections, and rank them.
 *
 * The three aggregations are not interchangeable and the difference is the whole question:
 *   · `max`      — a document is as good as its best section. Identical ORDER to `collapseToDocuments`
 *                  whenever the section list is sorted by score, so it is the control: if `max` and
 *                  the collapse disagree, the input was not sorted and every number is suspect.
 *   · `sum`      — a document is the sum of its retrieved sections. ⚠ BIASED TOWARD LONG DOCUMENTS
 *                  by construction: a 318-speech sitting day has 318 chances to contribute and a
 *                  one-section consultation has one. Reported, never adopted without saying so.
 *   · `sum-top3` — the middle: rewards a document with several good sections without letting a
 *                  long document win on volume alone.
 *
 * ⚠ A DOCUMENT'S SCORE HERE IS COMPUTED OVER THE RETRIEVED PREFIX ONLY. Sections of the same
 * document below the retrieval depth contribute nothing, so the deeper the input list the more the
 * `sum` variants can move. The depth is therefore part of the result and the caller must report it.
 */
export function aggregateToDocuments<T extends { id: string; score: number; parentDocId?: string | null }>(
  ranked: T[],
  how: DocumentAggregation,
): Array<{ documentKey: string; score: number; members: T[]; best: T }> {
  const groups = new Map<string, T[]>()
  for (const r of ranked) {
    const k = documentKeyOf(r.id, r.parentDocId)
    const g = groups.get(k)
    if (g) g.push(r); else groups.set(k, [r])
  }
  const out = [...groups.entries()].map(([documentKey, members]) => {
    const desc = [...members].sort((a, b) => b.score - a.score)
    const score =
      how === 'max' ? desc[0].score
        : how === 'sum' ? desc.reduce((a, b) => a + b.score, 0)
          : desc.slice(0, 3).reduce((a, b) => a + b.score, 0)
    return { documentKey, score, members, best: desc[0] }
  })
  // ⚠ Ties are broken by the best member's position in the INPUT list, not by id: an alphabetical
  // tiebreak is how five names came back alphabetical in SURFACE 4 and were read as a ranking.
  const firstIndex = new Map<string, number>()
  ranked.forEach((r, i) => { const k = documentKeyOf(r.id, r.parentDocId); if (!firstIndex.has(k)) firstIndex.set(k, i) })
  return out.sort((a, b) => (b.score - a.score) || ((firstIndex.get(a.documentKey) ?? 0) - (firstIndex.get(b.documentKey) ?? 0)))
}

/**
 * Rank (1-based) of the first unit in `ranked` that satisfies `hit`, or -1 for "not in this list".
 * ⚠ -1 means NOT FOUND IN THE DEPTH SEARCHED, which is not the same as absent from the corpus; the
 * depth belongs beside every -1 that gets printed. (SEARCH_S18 published `NOT-IN-200`, not `0`, for
 * exactly this reason.)
 */
export function rankOf<T>(ranked: T[], hit: (t: T) => boolean): number {
  const i = ranked.findIndex(hit)
  return i >= 0 ? i + 1 : -1
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// THE CHUNK GRAIN — WHAT IS AND IS NOT MEASURABLE, STATED HERE SO NOBODY RE-DERIVES IT
// ════════════════════════════════════════════════════════════════════════════════════════════════
// ⚠⚠ NO SERVED SURFACE RETURNS A RANKED LIST OF CHUNKS. `corpus_fts` holds one row per SECTION, so
// the sparse half has no chunk grain at all; `vector-serve` searches `corpus_vec` at chunk grain
// and then collapses — `vectorSearchSections` keeps the best chunk per section and returns
// `chunkId` for the winner (S13 §3). The pre-collapse ranking is discarded inside the service and
// its HTTP contract is `{query, tier?, limit?, corpora?, excludeCorpora?, noCache?}` with no way to
// ask for it.
//
// So "recall at chunk grain" cannot be measured as "is a chunk of the key section in the top 20
// chunks" without changing a service that auto-deploys. It also would not be worth the change:
// because the collapse is best-per-section, a top-20 CHUNK list is a subset of the sections in the
// top-20 SECTION list, so chunk-grain recall is bounded above by section-grain recall on the dense
// arm and can only ever be lower. Measuring it would cost a deploy to confirm an inequality.
//
// ▶ WHAT S19 MEASURES INSTEAD, and it is the question that was actually being asked: the two
// SCORERS are already two grains. BM25 scores a section as one bag of words; the dense leg scores
// ~3,200-character windows and takes the best. So "does the chunk grain find things the section
// grain does not" is answered by running the two arms separately over the same questions, which
// needs no new index and no deploy. `chunkCountOf` below is the other half — a section short
// enough to be a single chunk is one where the two grains cannot differ.
export const CHUNK_GRAIN_NOTE =
  'no served surface returns a ranked chunk list; the dense leg scores chunks and collapses to ' +
  'sections before returning, so chunk-grain recall is measured as the dense arm and is bounded ' +
  'above by its section-grain recall'

/** Chunking constants, restated from `scripts/ingest/search/chunk.ts` as the NUMBERS ONLY.
 *  ⚠ Not imported: that module lives under `scripts/ingest` and importing it into the web app
 *  would be a package-boundary crossing (CLAUDE.md §20 check A). `check:s19-grain` asserts these
 *  three values still match the chunker's defaults by reading its source, so the copy cannot drift
 *  silently — which is the one thing a copy is allowed to do. */
export const CHUNK_WHOLE_CHARS = 4096
export const CHUNK_WINDOW_CHARS = 3200
export const CHUNK_MAX = 8

/**
 * How many chunks a section of this many characters produces, under the live chunker.
 * ⚠ A section at or under `CHUNK_WHOLE_CHARS` is ONE chunk, which is the case that matters:
 * ARGUMENT 1A measured 12,705,570 of 13,724,557 parliamentary sections (92.6%) as a single chunk,
 * so for nine parliamentary sections in ten the chunk grain and the section grain are the same
 * text and no chunk-level change can reach them.
 */
export function chunkCountOf(chars: number): number {
  if (chars <= 0) return 0
  if (chars <= CHUNK_WHOLE_CHARS) return 1
  const stride = CHUNK_WINDOW_CHARS - 480 // OVERLAP_CHARS
  return Math.min(CHUNK_MAX, Math.ceil((chars - CHUNK_WINDOW_CHARS) / stride) + 1)
}
