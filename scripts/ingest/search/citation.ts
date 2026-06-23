/**
 * citation.ts — Search S1b archetype-A retrieval fix (shared, pure).
 *
 * DIAGNOSIS (docs/FTS_ARCHETYPE_A_DIAG.md): a legislation section's indexed text
 * carries only its operative body + its section heading. The PARENT ACT's
 * title/citation ("Housing Act 1988") appears NOWHERE on the row — it lives only
 * in legacy `LegislationItem.title`, keyed by the gid embedded in every
 * corpus_sections id (`…:ukpga/1988/50:section-21`). So a citation query's
 * discriminating tokens (act name + year) are absent from the very rows the user
 * wants, but present in thousands of parliamentary rows that mention the act in
 * passing → the section is either out-ranked (A2/A3/A4) or absent from BM25
 * retrieval entirely (A1/A5).
 *
 * FIX: synthesise a citation header from {act title} + {section ref parsed from
 * the id} and (a) PREPEND it to the indexed `body` (lands the row in BM25
 * retrieval with a high score for the exact citation), and (b) fold it into
 * `sectionTitle` (gives the query-time title-boost the act name to match).
 *
 * Both the canonical indexer (build-fts-index.ts) and the in-place backfill
 * (backfill-citations.ts) call buildCitation() so the two paths are identical.
 */

/** corpus_sections id → gid (`ukpga/1988/50`) for the LegislationItem title
 *  lookup. id = `{corpus}:{gid}:{sectionRef}` (gid itself has no colon). Returns
 *  null when there is no gid (malformed / non-legislation id). */
export function gidFromId(id: string): string | null {
  const parts = id.split(':')
  if (parts.length < 2) return null
  const gid = parts[1]
  return gid && gid.includes('/') ? gid : null
}

/** id → the section-ref phrase: `section-21`→'section 21',
 *  `schedule-2-paragraph-12`→'schedule 2 paragraph 12'. '' for whole-act
 *  (`full`) or absent refs. Trailing punctuation in the ref (a stray '.') is
 *  trimmed. */
export function sectionPhraseFromId(id: string): string {
  const parts = id.split(':')
  if (parts.length < 3) return ''
  const ref = parts.slice(2).join(':').trim()
  if (!ref || ref === 'full') return ''
  return ref.replace(/[.\s]+$/g, '').replace(/-/g, ' ').trim()
}

export type Citation = {
  /** prepend to the FTS-indexed body so the act citation is BM25-searchable */
  bodyHeader: string
  /** replaces sectionTitle so the query-time title-boost matches the act name */
  sectionTitle: string
}

/**
 * Build the citation header + enriched section title for one legislation row.
 * `title` is LegislationItem.title for the row's gid (e.g. "Housing Act 1988").
 * `existingTitle` is the row's current sectionTitle (the section heading, often
 * NULL). Returns null when there is no act title to add (gid unmapped) — caller
 * leaves the row unchanged.
 */
export function buildCitation(id: string, title: string | null, existingTitle: string | null): Citation | null {
  if (!title || !title.trim()) return null
  const act = title.trim()
  const phrase = sectionPhraseFromId(id)
  const heading = (existingTitle ?? '').trim()
  // body header: act name + year + section ref + heading, all up front and dense.
  const bodyHeader = [act, phrase, heading].filter(Boolean).join(' ')
  // enriched title: "Housing Act 1988 — section 21: Recovery of possession…"
  const sectionTitle = phrase
    ? (heading ? `${act} — ${phrase}: ${heading}` : `${act} — ${phrase}`)
    : (heading ? `${act} — ${heading}` : act)
  return { bodyHeader, sectionTitle }
}

/** Idempotency guard: a body already carrying its citation header starts with
 *  the act title. The backfill prepends `bodyHeader + '\n\n'`; re-running must not
 *  double-prepend. We detect by checking the body already begins with the header. */
export function applyCitationToBody(bodyHeader: string, body: string): string {
  if (body.startsWith(bodyHeader)) return body
  return `${bodyHeader}\n\n${body}`
}
