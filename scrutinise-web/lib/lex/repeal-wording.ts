// ─────────────────────────────────────────────────────────────────────────────
// repeal-wording.ts — SURFACE 1's WORDING, and nothing else.
//
// ⚠⚠ WHY THIS FILE EXISTS, AND IT IS NOT TIDINESS.
//
// `components/RepealBadge.tsx` is a `'use client'` component and must render the SAME words
// the prompt uses — that is Surface 1's whole invariant, and it is right. But the module that
// owned those words also imported `@/lib/prisma`, so Next pulled the Prisma client,
// `@prisma/adapter-pg` and `pg` into the BROWSER bundle and `next build` failed with
// `Can't resolve 'tls'` inside `pg/lib/stream.js`. `tsc` is clean either way — only the
// bundler sees it. Making the prisma import lazy (`await import(...)`) did NOT fix it:
// Turbopack still follows a dynamic import into the client graph.
//
// So the wording lives here, with NO server imports at all, and `repeal-status.ts` re-exports
// every symbol — every existing caller is unchanged. `check:repeal-status` reads this file
// for the same assertions it made before, and its rule that no other file may write the
// phrase without importing it is untouched.
//
// ⚠ NOTHING IN THIS FILE MAY IMPORT PRISMA, A DATABASE CLIENT, OR ANYTHING THAT DOES.
// That is the entire reason it is a separate file.
//
// Split out during Sprint 25-A's final `next build`, 2026-08-17, under the CLAUDE.md §12
// build-breaking carve-out.
// ─────────────────────────────────────────────────────────────────────────────

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
