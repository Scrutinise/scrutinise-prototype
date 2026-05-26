# CC Brief — Sprint L6-C: Fix legislation field, panel race, and sidebar

*Issued: 26 May 2026* *Author: CCh* *Follows L6-B (on production).*

***

## Context and priority

Lex is the centrepiece of the app. Until it works reliably, nothing else matters. Live testing on production has surfaced seven issues, grouped below into three root causes. Fix in this order: FTS + field 5 unblock first (issues 2 & 3, highest impact), then the panel race condition (issues 1 & 4), then the remaining items.

Same discipline: no mid-sprint git, one `commit-all.sh`, test on preview, then promote.

***

## Root cause A — FTS not firing / Lex stuck on Reference legislation

### Task 1 — Diagnose why FTS returned zero candidates (REPORT FIRST)

At field 5 (Reference legislation), the prompt received `legislationCandidates: "none"` even though the idea is about electoral fraud, which should match multiple sections in the 914,000-section corpus (Representation of the People Acts, Electoral Administration Act, etc.). Lex then used training-data knowledge instead of retrieved text.

Report:

1.  Is the FTS call in `route.ts` actually firing at field 5? Add a temporary `console.log` (remove before commit) to confirm the call is reached and the query string.
2.  What query is being constructed? The idea title is "Tackling Election Fraud" — the query should produce something like "election fraud" or "electoral offences." Report the exact query string.
3.  Is the Neon migration complete and the FTS function pointed at Neon? If the migration is in progress, the connection string may still point at Railway. Report which DB the FTS call is hitting.
4.  What does the FTS function return for "election fraud" / "electoral offences" when called directly? Run a test query against the live corpus.

*Why report first:* the fix is different depending on whether this is a Neon connection issue, a bad query, or the FTS call not being reached at all. Don't fix blind.

### Task 2 — Unblock field 5 when candidates are empty (BUILD)

Currently when `legislationCandidates` is `"none"`, Lex either stalls or emits an empty proposal card with a greyed-out Accept — and the gate never advances. This must be fixed regardless of Task 1's outcome (even with FTS working, there will be ideas with genuinely no matching legislation).

**The correct behaviour when candidates are empty:**

-   Lex says (in natural language): "I couldn't find directly applicable legislation in the corpus — this may be a policy area without a clear statutory framework, or the terms may need refining. You can skip this field for now and return to it later, or tell me if you know of a specific Act and I'll look it up."
-   The proposal card offers **Skip** as the primary action, not Accept of empty candidates. Skipping marks the field as intentionally deferred, not complete.
-   Lex STILL emits `fieldUpdates` (with an empty/deferred value) so the gate advances. The gate MUST NOT stall waiting for a non-empty legislation proposal. *Why:* the current stall means the user is completely blocked if FTS returns nothing — they can't proceed. The field is `IdeaLegislation` rows; zero rows is a valid state meaning "none linked yet."
-   If the user types a specific Act name, Lex runs a new targeted FTS query for that Act, returns results in the next turn, and renders a new proposal card. This is the recovery path when FTS fails.

### Task 3 — FTS trigger at field 5 (BUILD, after Task 1 report)

Once Task 1 identifies the failure, build the fix. The expected behaviour per v6.0 §7.1: when `currentFieldKey === 'ideaLegislation'`, the route ALWAYS runs the FTS search (this is trigger 1 — "user asks what law applies to this idea"). The query should be derived from the idea's title + `summaryDescription` + `summaryDiagnosis` — not just the title alone, which may be too short to match.

Comment the query construction: `// Field 5 always triggers FTS. Query derived from title + description + provisional diagnosis for maximum recall at keyword-match stage (v6.0 §7.1 trigger 1).`

Also wire the §7 query normalisation into the prompt: before searching, Lex expands abbreviations (Electoral Administration Act → "electoral administration", etc.), runs the corrected query, and tries a broader synonym on zero results.

***

## Root cause B — Panel race condition (optimistic update overwritten)

### Task 4 — Fix the 20-second revert on accept (BUILD)

**What happens:** user accepts a field → panel optimistically shows the new value → a background re-fetch (probably the route's `doneData` re-fetch, or a periodic poll) fires and overwrites the local state with the DB value → panel briefly reverts → 20 seconds later the DB confirms and the panel updates again.

Find where the re-fetch happens after accept. Two acceptable fixes:

-   Suppress the re-fetch for the field that was just accepted (its value is already confirmed locally by `fieldUpdates`), OR
-   Make the re-fetch wait for the `field-approval` write to confirm before polling.

*Why this is the same bug as the duplicate proposal card (issue 4):* the re-fetch triggers a re-render of the proposal card before the field is marked complete. Fixing the re-fetch race should eliminate both the revert AND the duplicate card.

***

## Root cause C — Missing UI and display issues

### Task 5 — Subsequent pages visible in sidebar, greyed and titles-only (BUILD)

The sidebar currently shows only Page 1 fields. Per the unified page model, ALL pages (including Diagnosis/Page 2, Guiding Policy/Page 3, Coherent Actions/ Page 4) should be visible in the sidebar from the start, greyed out with titles only until reached. This gives the user a sense of the full journey.

Build: extend the sidebar to render all pages from `PAGE_REGISTRY`. Pages not yet reached: greyed section header, field labels only (no values), no tick. Current page: active (as now). Completed pages: full green ticks + values.

*The Coherent Actions section at this stage shows "1 Coherent Action" as a placeholder — the actual CA fields only render when the user reaches that page.*

### Task 6 — Click to hide/show field contents in the sidebar (BUILD)

Each completed field in the sidebar should be collapsible: clicking the field (or a chevron) toggles between showing the full saved value and showing just the field label + a truncated preview. Default state: collapsed (label + truncated preview), so the sidebar doesn't become unwieldy as fields fill up.

This also reduces the confusion between the "proposal card" state (in-chat) and the "saved value" state (in the panel) — once a field is accepted and collapsed in the sidebar, it's visually distinct from an in-progress proposal.

### Task 7 — backgroundResearch not showing on the idea overview page (AUDIT THEN FIX)

The `backgroundResearch` field accepted correctly in the chat and showed in the sidebar, but does NOT appear on the idea overview page (`/ideas/[id]`). Two possible causes:

1.  The overview page reads a different field name / column than what `field-approval` writes to (`backgroundResearch` scalar added in L6-A).
2.  The overview page is rendering cached data that predates the field addition.

Check what the overview page renders for background/context and whether it reads `backgroundResearch`. If it reads a legacy field (e.g. `description` or a prior `background` column), map it to `backgroundResearch`. If it's a cache issue, add revalidation. Fix so the accepted value appears on the overview page.

***

## Also carry forward from L6-B (still open)

### Task 8 — checkAndAdvanceStage() timing (BUILD)

`checkAndAdvanceStage()` currently advances `idea.stage` to STAGE_2 after title

-   summaryDescription are accepted. It should advance only when Page 1 (all 7 Initial Information fields) is complete. Fix the trigger condition.

*Why:* anything reading `idea.stage` (analytics, Lex's prompt context, resume routing) currently sees STAGE_2 while the user is on Page 1 field 3+. The sidebar no longer reads `idea.stage` for the panel switch (fixed in L6-B), but the DB value is wrong and will cause confusion in later sprints.

Also audit: what else reads `idea.stage`? Report each consumer and confirm whether they're affected by the premature advance.

### Task 9 — Remove "I'm Lex" from buildSystemPrompt opening (BUILD)

The `buildSystemPrompt` function still instructs Lex to introduce itself on its first response. The server-side message in `create/page.tsx` is now the canonical intro. Remove the self-introduction from `buildSystemPrompt` to prevent the intro appearing twice in some flows.

***

## Predicted outcomes

-   After Task 2: a user can reach field 5 with no FTS results and skip it without stalling. Lex moves to field 6 (Initial thoughts).
-   After Task 3+1 (FTS fix): the "Tackling Election Fraud" idea should return Representation of the People Act sections and Electoral Administration Act sections as candidates. If it still returns nothing after the fix → the Neon migration is not complete or the corpus doesn't index under those terms.
-   After Task 4: accept a field, panel updates immediately, stays updated. No 20-second revert, no duplicate card.
-   After Task 5: the sidebar shows all pages at all times. Unreached pages are greyed. The user can see the full journey from step 1.

## Report back to CCh

-   Task 1: FTS root cause (which of the four sub-questions is the failure point).
-   Task 8: what other code reads `idea.stage`.
-   Task 7: which of the two overview-page causes applies.
-   Pass/fail on Task 4 (race condition) — confirm with before/after test.
