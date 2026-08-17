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

export type RepealState = 'repealed-known' | 'repealed-unknown' | 'no-record'

export interface RepealStatus {
  state: RepealState
  /** The repealing instrument's id, e.g. `ukpga/2002/29`. Null unless state is repealed-known. */
  repealedBy: string | null
  /** Its title where the corpus holds one; falls back to the id. */
  repealedByTitle: string | null
  /** How the repeal was detected, carried so the claim can be checked rather than trusted. */
  evidence: string | null
}

export const NO_RECORD: RepealStatus = { state: 'no-record', repealedBy: null, repealedByTitle: null, evidence: null }

/**
 * ONE PLACE FOR THE WORDING. Every surface — panel, prompt, chat, briefing — renders from
 * here, so the screen and what Lex reads cannot disagree. If they disagree, the user sees a
 * panel saying "repealed" beside an answer describing it as current, which the brief rightly
 * calls worse than not showing it at all.
 */
export function repealLabel(s: RepealStatus): string {
  switch (s.state) {
    case 'repealed-known':
      return `REPEALED — by ${s.repealedByTitle ?? s.repealedBy}`
    case 'repealed-unknown':
      return 'REPEALED — we do not know which instrument repealed it'
    case 'no-record':
      return 'No repeal recorded'
  }
}

/** The longer form, for a tooltip or a caption, where there is room to be honest at length. */
export function repealExplanation(s: RepealStatus): string {
  switch (s.state) {
    case 'repealed-known':
      return `The source marks this provision as repealed. Our record names ${s.repealedByTitle ?? s.repealedBy} `
        + 'as the instrument that repealed it. We do not hold the date it took effect.'
    case 'repealed-unknown':
      return 'The source marks this provision as repealed. Our record does not name the instrument that did it.'
    case 'no-record':
      // ⚠ This wording is load-bearing. It must not become "in force".
      return 'We hold no repeal record for this provision. That is not the same as confirming it is current — '
        + 'we hold repeal records only where the source published them.'
  }
}

/**
 * The line that goes into what LEX READS.
 *
 * ⚠ IF THE STATUS IS IN THE PANEL AND NOT IN THE PROMPT, LEX WILL DESCRIBE THE PROVISION AS
 * CURRENT WHILE THE PANEL SAYS OTHERWISE — worse than not showing it at all, because the two
 * disagree on screen. Returns null for `no-record` deliberately: a bullet on every one of
 * twenty results saying "no repeal recorded" would crowd out the two that are repealed, and
 * the prompt instruction below tells Lex what silence means.
 */
export function repealPromptNote(s: RepealStatus): string | null {
  switch (s.state) {
    case 'repealed-known':
      return `⚠ REPEALED (repealed by ${s.repealedBy}) — do NOT describe this as current law`
    case 'repealed-unknown':
      return '⚠ REPEALED (repealing instrument unknown) — do NOT describe this as current law'
    case 'no-record':
      return null
  }
}

/**
 * The instruction that has to accompany the notes, or a model will read their absence as
 * confirmation. Injected once per prompt by whoever builds the legislation block.
 */
export const REPEAL_PROMPT_INSTRUCTION =
  'Some provisions below are marked REPEALED. Never describe a provision marked REPEALED as current law; '
  + 'say plainly that it has been repealed, and name the repealing instrument if one is given. '
  + 'An UNMARKED provision means only that we hold no repeal record for it — it does NOT mean we have '
  + 'confirmed it is in force. Never tell a user a provision is "in force" or "still current" on the '
  + 'strength of an absent repeal record; say what the record shows and what it does not.'

/**
 * The instruction for the path where we could NOT check at all.
 *
 * ⚠ The legacy fallback in the Lex chat route returns a LegislationSection id, not a
 * `corpus_sections.id`, so there is no key to join `section_repeals` on. When that path is used the
 * honest instruction is not the one above — the one above says "unmarked means no record", which
 * would be false here, because nothing was looked up at all. Silence must not imply currency in
 * either direction.
 */
export const REPEAL_UNAVAILABLE_INSTRUCTION =
  'Repeal status could NOT be checked for the provisions below — the retrieval path used here has no '
  + 'key to look them up. Do not state or imply that any of them is in force, current, or repealed. '
  + 'If the user asks whether a provision is still law, say that you cannot confirm its current status '
  + 'and point them at legislation.gov.uk for the authoritative position.'

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
