// ─────────────────────────────────────────────────────────────────────────────────────────
// 25-Y §1c — WHICH EVIDENCE BELONGS TO A BUILD, AND WHICH BELONGS TO THE IDEA.
//
// ⚠⚠ THE DEFECT THIS EXISTS TO CLOSE. A finding extracted from a document the USER uploaded is
// written once, with `runVersion: 1`, because that is the version it happened to be read at.
// Several passes then read evidence with `runVersion = <this build>`. So from build 2 onward
// those passes could not see the user's own documents at all. Measured on 3 September:
// **38 findings from four documents on `452c5ade`, all stranded at v1 against a v9 build.**
//
// ⚠⚠ AND THE FIX IS A READ RULE, NOT A RE-STAMP, WHICH IS THE SAFER OF THE TWO. §1c asks which.
//
//   · RE-STAMPING (`UPDATE … SET runVersion = current`) is a WRITE that must run on every
//     build, for every material, for ever. It can fail, be skipped, or half-apply; it races a
//     user uploading a document mid-build; and it DESTROYS the record of when the document was
//     actually read. It is also the exact move 25-X refused for challenges — `runVersion` there
//     records the draft a criticism was raised against, and rewriting it destroys the thing
//     being displayed. The same argument applies here.
//   · EXEMPTING is a predicate. No write, nothing to half-apply, idempotent by construction,
//     and it states the truth: **a user's document belongs to the IDEA, not to a run.** It does
//     not become stale because Lex ran again.
//
// The one risk exempting carries is scatter — a read site that forgets the rule. That is why
// this is ONE exported predicate that every version-scoped evidence read imports, rather than a
// condition restated at each call (docs/CLAUDE.md §25 rule 3: import the function, never
// re-implement it — a re-implementation asserts that two copies agree, which they do until one
// is fixed). `check:lex-25y` asserts that no read site restates it.
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Source types whose findings are NOT scoped to the build that recorded them.
 *
 * ⚠ ONLY THE USER'S OWN MATERIAL. Everything Lex retrieved belongs to the run that retrieved
 * it: a corpus finding from build 3 is a statement about what build 3 searched for, and
 * carrying it forward silently would make an old search look like a current one. The user's
 * document is the opposite — they gave it to the idea, once, and never to a version.
 */
export const VERSIONLESS_SOURCE_TYPES = ['USER_DOCUMENT'] as const

/**
 * The `where` scope for "the evidence this build may read": everything it recorded itself,
 * plus everything the user contributed at any time.
 *
 * ⚠ Returns the scope only — the caller adds its own `status` filter, because the passes
 * differ on whether they exclude REJECTED and that is their decision, not this module's.
 */
export function evidenceForBuild(ideaId: string, runVersion: number) {
  return {
    ideaId,
    OR: [
      { runVersion },
      { sourceType: { in: [...VERSIONLESS_SOURCE_TYPES] } },
    ],
  }
}
