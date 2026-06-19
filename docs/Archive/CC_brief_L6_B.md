# CC Brief — Sprint L6-B: One unified page sequence + panel fixes

*Issued: 23 May 2026* *Author: CCh* *Follows L6-A (committed, on production). Supersedes the unbuilt L6-A2 list —* *its items are folded in here as Part 3.*

***

## The core problem L6-A revealed in testing

Live testing showed the platform is running TWO field models at once:

-   A NEW idea loads the OLD Strategic Kernel field map (DIAGNOSIS / GUIDING POLICY / COHERENT ACTIONS, \~27 fields) — see screenshots 3–6. The new `STAGE_1_FIELDS` 7-field model never drives a new idea.
-   A RESUMED pre-L6-A idea loads the new 7-field model in the sidebar but the panel is frozen — it renders the list but does not hydrate completion state or track live updates (screenshot 1).

So L6-A's "single source of truth" (Task 3) was incomplete: it unified the sidebar and sequence arrays WITHIN Stage 1, but a THIRD source — the Kernel page definitions, selected by the idea's stage — is still in play, and new ideas route into it. CCh predicted this exact failure in the L6-A brief ("if the count still mismatches, a third field list exists").

## The corrected architecture (Charlie's decision)

There are NOT two systems. There is ONE continuous page sequence, numbered consistently, that every idea flows through:

| Page | Name                | Fields                                          | Count   |
|------|---------------------|-------------------------------------------------|---------|
| 1    | Initial Information | the 7 v6.0 fields (Title … Government area)     | fixed   |
| 2    | Diagnosis           | Kernel diagnosis fields                         | fixed   |
| 3    | Guiding Policy      | Kernel guiding-policy fields                    | fixed   |
| 4+   | Coherent Actions    | one page PER coherent action, multiple per idea | dynamic |

Rules:

-   A new idea ALWAYS starts at Page 1 (Initial Information).
-   Pages are numbered continuously 1 → 2 → 3 → 4 … with no break between the old "Stage 1" and the Kernel. The Initial Information page is page 1 OF the Kernel system, not a separate system.
-   Progress is PER-PAGE: the "X of N" counter refers only to the current page's fields. Page 1 shows "X of 7"; on entering page 2 it resets to "0 of N" where N is page 2's field count; and so on.
-   Coherent Actions (page 4+) is DYNAMIC: when an idea first reaches the Coherent Actions stage, ONE empty CA page exists by default; the user adds more. Each CA is its own page.

***

## BUILD ORDER (so Charlie can promote incrementally)

-   **Part 1** fixes the two-systems bug so a new idea correctly runs Page 1. This alone fixes screenshots 3–6. Promotable on its own.
-   **Part 2** unifies the page transitions and panel behaviour (hydration, back-navigation, intro harmonisation, the Page 1→2 explanatory message).
-   **Part 3** is the deferred L6-A2 cleanup (legislation default, ideaType, verification) plus the Clerk preview fix and the dynamic CA pages.

Do Part 1 first and report before Part 2 if the routing is more tangled than expected. Same discipline: no mid-sprint git, one `commit-all.sh` at the end, test on preview before promote.

***

# PART 1 — Make a new idea start at Page 1 (the two-systems fix)

## Task 1.1 — Trace the field-set routing (REPORT FIRST)

Find and report how the panel/sequence decides which field set to load. We know `STAGE_1_FIELDS` exists in `lib/field-labels.ts`, but new ideas load the Kernel map. Report:

-   Where the Kernel page definitions live (the \~27-field Diagnosis/Guiding Policy/Coherent Actions structure).
-   How an idea's `stage` (or equivalent phase/state field) selects which page/ field set renders.
-   What `stage` value a NEWLY created idea gets, and where that default is set (the create action / API / Prisma default).

*Why report first:* CCh needs to confirm whether this is a one-line default fix or a deeper structural merge before you change routing.

## Task 1.2 — New ideas default to Page 1 / Initial Information (BUILD)

Make a newly created idea start at Page 1 (Initial Information), driven by `STAGE_1_FIELDS`. If the new idea's `stage` currently defaults to a Kernel/ Strategic value, change the default so it starts at the Create/Initial Information stage. Confirm the panel and `currentFieldIndex` both read `STAGE_1_FIELDS` for a Page 1 idea.

*Expected result:* a new idea shows Title / The idea / What's causing it / Background / Reference legislation / Initial thoughts / Government area, "0 of 7", exactly as screenshot 1's sidebar — NOT the Diagnosis/Guiding Policy map of screenshots 3–6.

## Task 1.3 — One ordered page registry (BUILD)

Replace the two separate models with a single ordered page registry: an exported structure listing pages in order, each page carrying its name, its fields, and whether it is fixed or dynamic. Page 1 = Initial Information (the 7 fields); pages 2, 3 = Diagnosis, Guiding Policy (existing Kernel fields, moved into the registry, not redefined elsewhere); page 4+ = Coherent Actions (dynamic, see Part 3). Both the sidebar and the sequence machine read ONLY this registry.

*Why:* the two-systems bug exists because there are parallel definitions. One registry is the structural fix; everything else is downstream of it. Comment it: `// Single ordered page registry — sidebar AND currentFieldIndex read only this. // Two parallel field models (Stage 1 vs Kernel) caused new ideas to load the // wrong sequence (L6-A live test, screenshots 3-6).`

## Task 1.4 — Per-page progress counter (BUILD)

The "X of N" indicator counts ONLY the current page's fields. On page entry it reads "0 of N" (N = that page's field count) and increments as fields complete. Crossing to the next page resets the count to that page's N. Do not show a global field total (it would lurch when dynamic CA pages are added).

***

# PART 2 — Page transitions, panel behaviour, intro

## Task 2.1 — Panel hydration on resume (BUILD) — fixes screenshot 1

A resumed idea renders the field list but the panel is frozen: it shows stale completion state ("1 of 7") and does not track the chat. Fix the panel so that on load it hydrates BOTH the field list AND each field's completion state from the idea, and subscribes to live updates so subsequent accepts update the panel.

*Why:* the panel currently renders from initial props only and doesn't re-read after load. Resumed ideas therefore freeze. Confirm: resume an idea, accept a field, panel updates without a manual reload.

## Task 2.2 — Harmonise the opening message (BUILD) — fixes screenshot 2

Two intro blocks currently fire for a new idea: a generic one with the "How does this work?" / "I know what I'm doing" buttons, AND the v6.0 opening. Find the generic/hardcoded intro and the v6.0 prompt opening; collapse to ONE variable opening:

-   **First-ever idea (new user):** intro text = "Before we start, would you like a quick guide to how this works, or do you want to dive straight in?" — with the two buttons (guide / dive straight in).
-   **Subsequent ideas:** intro text = "I assume you know what you're doing, but just in case, the button below takes you on a short guided tour." — then proceeds to ask: "What's the problem or challenge you want to address?"

Lex introduces itself by name once only. Report where the duplicate intro came from so we know the two paths are fully merged, not just hidden.

## Task 2.3 — Page 1 → Page 2 transition message (BUILD)

When the idea completes Page 1 and moves to Page 2 (Diagnosis), Lex delivers an explicit transition message before the first Diagnosis question: "We're going to drill down more into the causes, because to write effective legislation it's essential to identify the original and most significant causes, not necessarily the most obvious ones."

The panel must NOT jump to Diagnosis until Page 1 is complete. While on Page 1, the panel stays on the Initial Information page. (Screenshots 3–6 showed the panel jumping to Diagnosis/Guiding Policy mid-Page-1 — that stops once Part 1's single registry is in place, but verify it explicitly here.)

## Task 2.4 — No echo of what was just written to the panel (BUILD)

Lex currently repeats the field value it just proposed/saved back into the chat ("I've recorded this as: …"). Remove this echo — once a value is in the panel it is visibly there. Lex should acknowledge briefly and move on, not restate the saved text. (Prompt-level change in `route.ts`; reflect in v6.0 §10/§11.)

## Task 2.5 — Back-navigation to a previous field (BUILD)

The panel must let the user click back to a previously completed field. When they do, Lex follows them back to that field, discusses/edits it, and when done asks: "Are there any other questions you want to revisit before we return to where we left off?" — then returns to the field they left.

*Why:* currently the flow is one-directional; users can't revise an earlier answer without losing their place. This requires the sequence machine to support a temporary "revisit" index distinct from the furthest-reached index.

***

# PART 3 — Deferred L6-A2 cleanup + Clerk + dynamic CA pages

## Task 3.1 — Legislation checkbox default to opt-in (BUILD)

In `FieldProposalCard.tsx`, the `ideaLegislation` checkbox list pre-selects all candidates. Change the default to NONE selected; the user ticks what to keep. *Why:* FTS is keyword-only and may surface a wrong Act; pre-selecting all means clicking through accepts false matches (v6.0 §7). The tick is the verification. Comment: `// Opt-in not opt-out: FTS candidates are keyword-matched and may be wrong (v6.0 §7); the user's tick is the verification step.`

## Task 3.2 — Clerk sign-in blank on preview (AUDIT THEN FIX)

The preview URL's `/sign-in` page renders blank; normal pages work. Likely Clerk: the preview's `*.vercel.app` domain isn't an allowed origin, or preview uses production Clerk keys that reject the preview origin. Report Clerk's current domain/key config for preview, then fix so sign-in renders on preview. *Why:* the preview gate is useless if sign-in can't be tested there — that is why L6-A went to production unverified. Restore preview testing.

## Task 3.3 — ideaType absent from Page 1 (VERIFY THEN FIX)

Confirm `ideaType` (Legislation/Regulation/Policy/Structural binary) appears nowhere in Page 1 — not in the registry, sidebar, prompt body, or CreateIdeaClient. Column stays (used at Coherent Actions). Remove any reference.

## Task 3.4 — Accept-loop regression, all Page 1 fields (VERIFY THEN FIX)

For each of the 7 Page 1 fields, confirm `Accepted:` returns `fieldUpdates` for the current key in the same stream, the DB write fires, the panel tick advances, and the index moves. Watch field 5 (legislation relation) and field 6 (initialThoughts Json) hardest — the deferred-save bug lives in the non-scalar fields.

## Task 3.5 — Existing-idea safety (VERIFY)

Confirm a pre-L6-A idea loads cleanly under the unified registry with null `backgroundResearch` / `initialThoughts` treated as incomplete, not errored. (Screenshot 1 shows it loads, but verify the unified registry doesn't regress this.)

## Task 3.6 — summaryDiagnosis overwrite (REPORT)

Report whether any Page 2 (Diagnosis) code reads `summaryDiagnosis` expecting the old meaning, given Page 1 writes a provisional value the Diagnosis page overwrites. Report to CCh before rewiring.

## Task 3.7 — Dynamic Coherent Actions pages (BUILD)

When an idea reaches Coherent Actions, ONE empty CA page exists by default; the user can add more, each its own page in the registry. The per-page counter and sidebar must handle the page count growing mid-idea without the progress indicator lurching (per-page progress, Task 1.4, already handles this — verify).

***

## Report back to CCh

-   Task 1.1: where the Kernel map lives, how stage selects the field set, the new-idea default stage. (Root-cause confirmation.)
-   Task 2.2: where the duplicate intro came from.
-   Task 3.2: Clerk preview config and the fix applied.
-   Task 3.4: which fields passed/lagged the accept loop.
-   Task 3.6: any Page 2 dependency on the provisional diagnosis.
-   Anything found already correct.

## Predicted outcomes (interpretable results)

-   After Part 1: a new idea shows the 7-field Initial Information page, "0 of 7", and does NOT jump to Diagnosis. If it still loads the Kernel map → the registry isn't the sole source; a fourth reference exists.
-   After Task 2.1: resume an idea, accept a field, panel updates without reload. If it still freezes → the panel subscribes to nothing; it needs a live data source, not just initial props.
-   After Task 3.1: legislation candidates appear with NONE ticked.
