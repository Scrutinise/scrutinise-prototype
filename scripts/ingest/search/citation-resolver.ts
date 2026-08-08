/**
 * citation-resolver.ts — Search S1b archetype-A known-item resolver (query-time).
 *
 * Diagnosis (FTS_ARCHETYPE_A_DIAG.md): citation lookups ("Section 21 Housing Act
 * 1988") fail because BM25 over the section body can't pin the EXACT section — the
 * act citation isn't on the row, and even with it (the body backfill) "section 21"
 * can't be distinguished from "paragraph 21"/"section 98" without phrase/position
 * matching (positions are parked → v2). For an explicit citation we don't need
 * BM25 at all: parse the citation, resolve the act title → gid, and fetch the
 * exact section by id. This is deterministic and needs no reindex.
 *
 * The act-title→gid map comes from `corpus_acts.title` (135,531 titled rows),
 * keyed by `gid` — the same gid embedded in every corpus_sections id. Built once
 * (loadActIndex) and reused per query.
 *
 * Was legacy `LegislationItem` until 7 Aug 2026; repointed under V26 §6 because
 * that table is slated for DROP and this index is loaded at fts-serve BOOT, so a
 * dropped table would take the whole citation resolver down with it. Verified
 * zero-gap: same 135,531 gid→title pairs, 0 missing, 0 differing.
 */
import { Pool } from 'pg'

export type ActIndex = {
  /** normalised act title → gid (e.g. "housing act 1988" → "ukpga/1988/50") */
  byTitle: Map<string, string>
}

function normTitle(s: string): string {
  return s.toLowerCase().replace(/^the\s+/, '').replace(/[.,;:'’()]/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function loadActIndex(pool: Pool): Promise<ActIndex> {
  // ORDER BY gid is not cosmetic: "first writer wins" below means an unordered scan
  // lets the PLAN decide which gid a colliding title resolves to, so the same citation
  // could resolve differently across boots. 173 normalised titles carry more than one
  // gid (468 rows) — mostly devolved/EU twins of the same instrument and identically
  // titled 19th-century Acts — so the collision set is real, not theoretical. Pinning
  // the order makes the choice reproducible; it does not claim the choice is right.
  const { rows } = await pool.query<{ gid: string; title: string }>(
    `SELECT gid, title FROM corpus_acts WHERE gid IS NOT NULL AND title IS NOT NULL ORDER BY gid`)
  const byTitle = new Map<string, string>()
  for (const r of rows) {
    const k = normTitle(r.title)
    // first writer wins; principal acts are listed once, so collisions are rare.
    if (!byTitle.has(k)) byTitle.set(k, r.gid)
  }
  return { byTitle }
}

export type ParsedCitation = {
  actPhrase: string
  refToken: 'section' | 'regulation' | 'article' | 'schedule' | null
  refNum: string | null
}

const REF_RX = /\b(?:(sections?|s)|(regulations?|regs?|r)|(articles?|art)|(schedules?|sch))\.?\s*(\d+[a-z]?)\b/i
// act / SI title: letters-only words (no digits) up to "Act|Regulations|… YYYY".
// The letters-only run can't span a leading "Section 21", so the phrase starts at
// the real title ("Housing Act 1988"), not the citation prefix.
const ACT_RX = /\b((?:the\s+)?[a-z][a-z'’\-]*(?:\s+[a-z'’\-]+){0,7}\s+(?:act|regulations|regulation|order|rules|measure|scheme)\s+\d{4})\b/i

// leading connectives the act regex may greedily absorb ("…section 1 of the Theft
// Act 1968" → "of the Theft Act 1968"); stripped before title resolution.
const LEAD_RX = /^(?:(?:of|under|in|to|by|the|a|an)\s+)+/i

export function parseCitation(query: string): ParsedCitation | null {
  const act = query.match(ACT_RX)
  if (!act) return null
  const actPhrase = act[1].replace(LEAD_RX, '').trim()
  // Parse the section/reg ref on the query with the act SPAN removed, so the act's
  // trailing year ("Regulations 1998") is never misread as a ref number.
  const remainder = query.slice(0, act.index ?? 0) + ' ' + query.slice((act.index ?? 0) + act[0].length)
  const ref = remainder.match(REF_RX)
  let refToken: ParsedCitation['refToken'] = null
  if (ref) refToken = ref[1] ? 'section' : ref[2] ? 'regulation' : ref[3] ? 'article' : 'schedule'
  return { actPhrase, refToken, refNum: ref ? ref[5] : null }
}

export type ResolvedCitation = { gid: string; refToken: ParsedCitation['refToken']; refNum: string | null }

export function resolveCitation(p: ParsedCitation, idx: ActIndex): ResolvedCitation | null {
  const gid = idx.byTitle.get(normTitle(p.actPhrase))
  if (!gid) return null
  return { gid, refToken: p.refToken, refNum: p.refNum }
}

/** SQL LIKE pattern(s) for the exact section, most-specific first. The corpus id
 *  is `{corpus}:{gid}:{ref}` where ref is e.g. `section-21`, `regulation-4`. When
 *  the query gives a ref we target it; otherwise we surface the act's leaves. */
export function idPatternsFor(r: ResolvedCitation): { exact: string | null; actLevel: string } {
  const gid = r.gid.replace(/'/g, "''")
  const exact = r.refToken && r.refNum ? `%${gid}:${r.refToken}-${r.refNum}` : null
  return { exact, actLevel: `%${gid}:%` }
}
