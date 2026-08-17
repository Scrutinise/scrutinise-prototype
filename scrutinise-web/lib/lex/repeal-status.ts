// ─────────────────────────────────────────────────────────────────────────────
// repeal-status.ts — SURFACE 1. Tell the user when a law is no longer in force.
//
// ⚠ THE DEFECT THIS CLOSES IS A CORRECTNESS DEFECT, NOT A MISSING FEATURE. Lex could
// cite a provision as current law when it has been repealed — real citation, working
// link, nothing to say otherwise. A missing feature disappoints; a confident citation of
// a dead provision misleads, in the one place the platform's whole claim rests.
//
// THE DATA ALREADY EXISTS. `section_repeals` holds 178,826 repealed sections from the V36
// census (2026-08-13), 25,138 of them naming the repealing instrument, and every one joins
// `corpus_sections.id` exactly. This stream builds no new data — see BRIEF_SURFACE_1 §0.
//
// ════════════════════════════════════════════════════════════════════════════════════
// THREE STATES, AND THE THIRD IS THE ONE THAT WILL BE GOT WRONG
// ════════════════════════════════════════════════════════════════════════════════════
//   repealed-known    repealed, and we know by what
//   repealed-unknown  repealed, and we do not know by what
//   no-record         ⚠ NOT "in force"
//
// ⚠⚠ "NO REPEAL RECORDED" IS NOT "IN FORCE", and the difference is the whole point of the
// job. We hold repeal records where the source published them; absence of a record is
// absence of a record. Saying "in force" would replace one confident wrong claim with
// another — and it would be OUR claim rather than the source's. `check:repeal-status`
// greps this file and every caller for the phrase, and fails on it.
//
// ⚠ AND THERE IS NO REPEAL DATE. The brief asks for "the date and the instrument". The
// census recorded no repeal date — `section_repeals.detected_at` is when WE DETECTED it,
// which is a fact about us, not about the law. Rendering that as the repeal date would be
// a fabrication of exactly the kind this job exists to prevent, so no date is shown and
// the absence is stated. Reported in docs/SURFACE_1_REPEAL_REPORT.md.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { decodeMaybe } from '@/lib/html-entities'


// ── THE WORDING LIVES IN repeal-wording.ts AND IS RE-EXPORTED HERE ───────────
//
// Every existing importer of this module is unchanged. The split exists because
// `RepealBadge` is a client component and this file imports prisma — see the header of
// repeal-wording.ts for the build failure that forced it.
export {
  NO_RECORD,
  repealLabel,
  repealExplanation,
  repealPromptNote,
  REPEAL_PROMPT_INSTRUCTION,
  REPEAL_UNAVAILABLE_INSTRUCTION,
} from './repeal-wording'
export type { RepealState, RepealStatus } from './repeal-wording'

import { NO_RECORD, type RepealStatus } from './repeal-wording'

/**
 * Look up repeal status for a batch of section ids.
 *
 * Batched by design: one query per search, not one per result. A per-result query would put
 * twenty round trips inside a request that already has a retrieval call in it.
 *
 * ⚠ NEVER THROWS. A repeal lookup that fails must not take down the search it was annotating —
 * but it must not silently claim "no record" either, because that is the reading that would let a
 * repealed provision through unlabelled. On failure it returns an EMPTY MAP and logs, and callers
 * distinguish "not in the map" (unknown, from a failure) from an explicit `no-record`.
 */
export async function lookupRepeals(sectionIds: string[]): Promise<{ statuses: Map<string, RepealStatus>; ok: boolean }> {
  const out = new Map<string, RepealStatus>()
  const ids = [...new Set(sectionIds.filter(Boolean))]
  if (!ids.length) return { statuses: out, ok: true }
  try {
    const rows = await prisma.$queryRaw<Array<{
      section_id: string; repealed_by: string | null; evidence: string | null; title: string | null
    }>>`
      SELECT r.section_id, r.repealed_by, r.evidence, a.title
      FROM section_repeals r
      LEFT JOIN corpus_acts a ON a.gid = r.repealed_by
      WHERE r.section_id = ANY(${ids})`
    for (const row of rows) {
      out.set(row.section_id, {
        state: row.repealed_by ? 'repealed-known' : 'repealed-unknown',
        repealedBy: row.repealed_by,
        // `title` is a `corpus_acts` title, 57 of which carry a literal entity — and this one is
        // read out to the user as "repealed by X", so it is decoded. `repealed_by` is the GID and
        // is NOT decoded: it is a key, and it is also the fallback when there is no title.
        repealedByTitle: decodeMaybe(row.title) ?? row.repealed_by,
        evidence: row.evidence,
      })
    }
  } catch (err) {
    // ⚠ ok:false is the whole point. A failed lookup must NOT be reported as "nothing is repealed":
    // that is the reading which lets a repealed provision through unlabelled, which is the defect
    // this file exists to close.
    console.warn('[repeal-status] lookup FAILED; results will carry NO status rather than a false one', {
      ids: ids.length, error: err instanceof Error ? err.message : String(err),
    })
    return { statuses: new Map(), ok: false }
  }
  return { statuses: out, ok: true }
}

/**
 * Annotate anything with an `id`. Ids absent from the map become `no-record` — which is only
 * correct when the lookup SUCCEEDED, so the caller passes `lookupOk`.
 *
 * ⚠ When the lookup failed, `repeal` is left UNDEFINED rather than set to no-record. Undefined
 * renders nothing; no-record renders a claim. A failed lookup must not manufacture reassurance.
 */
export function annotate<T extends { id: string }>(
  items: T[], statuses: Map<string, RepealStatus>, lookupOk: boolean,
): Array<T & { repeal?: RepealStatus }> {
  return items.map((it) => {
    const hit = statuses.get(it.id)
    if (hit) return { ...it, repeal: hit }
    return lookupOk ? { ...it, repeal: NO_RECORD } : { ...it }
  })
}

/**
 * The OTHER key space, for the legislation detail page.
 *
 * ⚠ `/legislation/[itemId]` reads `LegislationItem.sections` — the LEGACY table, whose ids are its
 * own and are not `corpus_sections.id`. So there is no id to join on, and this is the surface with
 * the highest real exposure: it lists sections directly, in full, with no search step to rank a
 * repealed one out of the way. `section_repeals` does carry `gid` and `section_ref`, so the join is
 * (gid, section_ref) — a real key, not a guess.
 *
 * ⚠ AND A MISS STAYS A MISS. `section_ref` takes forms this mapping cannot reconstruct from a bare
 * section number — `schedule-15-paragraph-10`, `article-4`, `regulation-12`. An unmatched section
 * therefore gets NO status rather than `no-record`, so the page says nothing about it instead of
 * saying something reassuring and unfounded. The match rate is reported rather than assumed:
 * `scripts/probe-surface-1-detail-page.ts`.
 */
export async function repealsForItem(
  gid: string, sectionNumbers: string[],
): Promise<Map<string, RepealStatus>> {
  const out = new Map<string, RepealStatus>()
  if (!gid || !sectionNumbers.length) return out
  // The forms a plain section number can take in `section_ref`, most likely first.
  const refs = sectionNumbers.flatMap((n) => [`section-${n}`, `article-${n}`, `regulation-${n}`, `rule-${n}`, n])
  try {
    const rows = await prisma.$queryRaw<Array<{
      section_ref: string; repealed_by: string | null; evidence: string | null; title: string | null
    }>>`
      SELECT r.section_ref, r.repealed_by, r.evidence, a.title
      FROM section_repeals r
      LEFT JOIN corpus_acts a ON a.gid = r.repealed_by
      WHERE r.gid = ${gid} AND r.section_ref = ANY(${refs})`
    for (const row of rows) {
      // Map back to the bare section number the page keys on.
      const bare = row.section_ref.replace(/^(section|article|regulation|rule)-/, '')
      out.set(bare, {
        state: row.repealed_by ? 'repealed-known' : 'repealed-unknown',
        repealedBy: row.repealed_by,
        repealedByTitle: decodeMaybe(row.title) ?? row.repealed_by,
        evidence: row.evidence,
      })
    }
  } catch (err) {
    console.warn('[repeal-status] item lookup failed; sections will carry NO status', {
      gid, error: err instanceof Error ? err.message : String(err),
    })
    return new Map()
  }
  return out
}

/** One call for a caller that has ids and wants the annotation done. */
export async function annotateWithRepeals<T extends { id: string }>(
  items: T[],
): Promise<Array<T & { repeal?: RepealStatus }>> {
  const { statuses, ok } = await lookupRepeals(items.map((i) => i.id))
  return annotate(items, statuses, ok)
}
