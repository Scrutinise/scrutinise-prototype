# CC Brief — Sprint L6, Bucket A: Lex rebuild to v6.0 + Stage 1 field model

*Issued: 23 May 2026* *Author: CCh (architecture/spec)* *Authoritative prompt:* `/docs/lex_system_prompt_v6.0.md` *(v5.1 and v5.2 archived)*

***

## Why this sprint exists

Lex's deployed behaviour, the old prompt documents, and the V2H platform-controlled field model had diverged. Symptoms reported by Charlie: sidebar not tracking the chat, fields not appearing, "2 of 7 completed but only one showing," Lex looping, the legislation/organisation binary resurfacing at the wrong time, stage transitions not reflected in the panel, and Lex asking a consequences question while calling it a "diagnosis."

Root cause: the old prompts told Lex to sequence the conversation itself, while the deployed code (V2H) has the FRONTEND own the sequence via `currentFieldIndex`. The two control models fought each other. We are rebuilding the prompt to match the V2H model and changing the Stage 1 field set. The new prompt `/docs/lex_system_prompt_v6.0.md` is the SOLE authoritative prompt document — no companion or diff doc.

## Operating mode for this brief — AUDIT THEN BUILD

Most tasks below are "check the current state; if it is absent, unfinished, or broken, build/fix it to the spec given." Where a task says **REPORT**, report only and do not change. Where it says **BUILD IF MISSING**, implement to spec.

Discipline (unchanged):

-   No git calls mid-sprint. Generate one `commit-all.sh` at the end, run it once, delete it.
-   Every change tested on Vercel preview before any promotion to production.
-   Comments explain WHY a non-obvious choice was made, not what the code does.

If any spec below is ambiguous when you reach it, stop and ask CCh rather than guessing — especially anything that writes a Prisma migration (one-way door).

***

## The Stage 1 field model (single source of truth)

This is the target. Stage 1 is the **Create** stage. Field order:

| \# | Sidebar label         | Key                        | Type     | Status                                        |
|----|-----------------------|----------------------------|----------|-----------------------------------------------|
| 1  | Title                 | `title`                    | scalar   | existing                                      |
| 2  | The idea              | `summaryDescription`       | scalar   | existing, relabelled                          |
| 3  | What's causing it     | `summaryDiagnosis`         | scalar   | existing, relabelled, **provisional**         |
| 4  | Background            | `backgroundResearch`       | scalar   | **NEW**                                       |
| 5  | Reference legislation | `IdeaLegislation` relation | relation | uses existing join table                      |
| 6  | Initial thoughts      | `initialThoughts`          | Json     | **NEW, structured**                           |
| 7  | Government area       | `govtArea`                 | scalar   | existing; Lex proposes at end, user validates |

`ideaType` is REMOVED from the Stage 1 sequence (column kept; used in Stage 2). Field 3 is intentionally provisional — overwritten by the considered Diagnosis built in the Strategic Kernel. Do not treat its Stage 1 value as final.

***

## TASK 1 — Archive confirmation (REPORT)

Charlie has already moved the old prompts to `/docs/archive/` and saved `/docs/lex_system_prompt_v6.0.md`. Confirm no code path still imports, reads, or references `lex_system_prompt_v5_1` or `lex_system_prompt_v5_2` (string references, file reads, or comments pointing to them). Report any found; if found, repoint them to v6.0.

## TASK 2 — Extract the deployed prompt, then replace it with v6.0 (BUILD)

**2a (REPORT first):** In `app/api/ai/[ideaId]/route.ts`, report verbatim the current system-prompt string(s) sent to Gemini — including the dynamic single-field instruction built from `currentFieldKey` / `currentFieldLabel` / `currentFieldSection`, the FIELD ACCEPTANCE section, and any APPROVED BEHAVIOUR RULES injection. We need to see what Lex is really told today.

**2b (BUILD):** Rewrite `buildSystemPrompt` (or equivalent) so the assembled prompt reflects `/docs/lex_system_prompt_v6.0.md`. Key behavioural requirements the string MUST encode:

-   The one-field gate (§2.1): Lex proposes/updates ONLY `currentFieldKey`.
-   The acceptance protocol (§2.3): on an `Accepted:` user message, emit `fieldUpdates` for the current key in the SAME response, then stop. Never defer to a later turn.
-   Hybrid enrichment (§2.2): Lex is expansive WITHIN a field where the field calls for it (fields 3 and 6), but never breaks the gate.
-   Field 6 is exempt from the 3-sentence prose cap (§11); all other Stage 1 fields keep it.
-   Legislation candidates are keyword-matched, verify-only, surfaced to the user ONLY at field 5 (§7).
-   Diagnosis = causes, never consequences (§6, §11).
-   Inject `legislationCandidates` (up to 4 FTS sections, or "none") into the runtime context block (§3) — see Task 6 for the wiring.

Keep the prompt assembled from the v6.0 document's structure so the doc and the code stay 1:1. Comment the function with: why the gate exists (platform owns sequence; prevents the looping/stalling that v5.x caused).

## TASK 3 — One source of truth for the Stage 1 sequence (AUDIT THEN BUILD)

**Check:** where does the Stage 1 field list and order come from today?

-   What array/config drives `currentFieldIndex` in `CreateIdeaClient.tsx`?
-   What does the sidebar (desktop AND mobile) read to decide which fields to show and the "X of N" count?
-   Are these the SAME source or two separate lists?

**Build:** if they are separate, define the Stage 1 field list ONCE as a single exported constant (key, label, section, type) and have both the `currentFieldIndex` sequence and the sidebar (display + count) read from it.

*Why:* "2 of 7, only one showing" is the signature of a sequence array and a sidebar list defined separately and drifting apart. One constant eliminates the class of bug. Comment the constant: "Single source of truth for Stage 1 field sequence — sidebar count and currentFieldIndex must both derive from this, or they drift (the V2H 'X of N' bug)."

The constant must reflect the 7-row table above, with `ideaType` absent.

## TASK 4 — Prisma migration for the two new scalar fields (BUILD)

Add to the `Idea` model:

-   `backgroundResearch String?`
-   `initialThoughts Json?`

`initialThoughts` is `Json`, not `String`, because it stores a structured object (options + chosen ids — see Task 7). Generate and run the migration.

*Why Json:* a scalar string would force fragile parse/stringify of the options menu and the user's choice; `Json` keeps it structured and queryable.

## TASK 5 — Remove `ideaType` from Stage 1 (BUILD)

Remove `ideaType` from the Stage 1 field constant (Task 3) and from the Stage 1 sidebar, sequence, and prompt. DO NOT drop the column — it is used in Stage 2 at Coherent Actions. Ensure nothing in the Stage 1 flow raises the Legislation/Regulation/Policy/Structural binary. If a Stage 1 code path still asks for or displays `ideaType`, remove it.

*Why:* the binary is meaningless at idea-capture and was surfacing at the wrong time. It belongs at the action level, where the chosen route resolves it.

## TASK 6 — Wire FTS legislation search into the route (AUDIT THEN BUILD)

V.4-FTS-1 (Postgres keyword search) exists on Main. It runs a corpus search and returns up to 4 candidate sections.

**Check:** confirm the FTS function/endpoint — its name, location, input (query/keywords), and the shape of the up-to-4 candidate sections it returns. Report this to CCh.

**Build:** call FTS before each substantive Lex response in `app/api/ai/[ideaId]/route.ts`, and inject the result into the prompt's runtime context block as `legislationCandidates` (the up-to-4 sections, or the literal "none"). The prompt (v6.0 §7) handles treatment: verify-only, surface only at field 5. Ensure the thinking indicator shows "Searching the legislation…" while this runs (check whether the frontend already supports a thinking-indicator string; if so, set it; if not, BUILD IF MISSING).

*Status:* FTS is deployed to Vercel as of this sprint. `legislationCandidates` will return real candidates in preview, so test field 5's candidate-flagging path directly — do not defer it.

*Why verify-only:* Phase-1 matching is keyword-only and can surface a wordy-but-wrong Act. Semantic matching is Phase 2 and not live. Lex must not let a candidate drive its reasoning, and must flag every suggestion as worth verifying.

## TASK 7 — `initialThoughts` structured value + frontend handling (BUILD)

Stored/proposed value shape:

```json
{
  "options": [
    {"id": 1, "routeType": "legislation",   "summary": "…with honest difficulty note…"},
    {"id": 2, "routeType": "enforcement",    "summary": "…"},
    {"id": 3, "routeType": "organisational", "summary": "…"}
  ],
  "chosen": []
}
```

`routeType` ∈ `legislation` \| `enforcement` \| `organisational` \| `funding`.

**Build:**

-   The proposal card for field 6 renders `options` as a SELECTABLE list (user picks one or more). On acceptance, set `chosen` to the selected id(s) before the value is written to `initialThoughts`.
-   Field 6 is the expansive field: the card must accommodate a longer Lex response (the route survey with per-option difficulty commentary) without truncation. Check the card component handles variable-length option summaries; if it clips, fix it.
-   The chosen `routeType` is the bridge to Stage 2: it should inform the Stage 2 `ideaType` and the Guiding Policy should trace back to the chosen option. Persist `chosen` so Stage 2 can read it.

*Why store both options and chosen:* the Kernel's Guiding Policy must trace back to what the user picked, so we keep the full menu plus the choice, not just the choice.

## TASK 8 — `govtArea` as Lex-originated, user-validated final field (AUDIT THEN BUILD)

After field 6 is accepted, the platform presents `govtArea` as the final Stage 1 field. Unlike the others, Lex PROPOSES it without eliciting it, phrased for confirmation ("This looks like it sits with [Department]. Does that match?").

**Check:** does the frontend accept a Lex-originated proposal at this field with no preceding user question? **Build if not:** allow the proposal card to render for `govtArea` immediately when the field becomes active, driven by Lex's proposal rather than waiting for user input.

## TASK 9 — Reference legislation L-panel (AUDIT THEN BUILD)

Field 5 is backed by the existing `IdeaLegislation` join table (NOT a scalar). Accepted candidate links are written to `IdeaLegislation`.

**Check and BUILD IF MISSING/UNFINISHED — all four:**

1.  **Persistence:** once `IdeaLegislation` links exist, the L-panel must be always visible/accessible and survive navigation between fields and between Stage 1 and Stage 2. If it only appears transiently, fix it to persist.
2.  **Slide in/out controls:** the buttons to slide the L-panel in and out must work on desktop AND mobile. If unwired or broken, wire/fix them. Report which component owns them.
3.  **Per-section Lex commentary (CHAT-ONLY for this sprint):** Lex's note on "what specific wording may be noteworthy for change" is delivered in its conversational text alongside the field 5 proposal, NOT stored on the relation. Do NOT add a schema field for this in this sprint. The panel renders the links only; the commentary lives in the chat thread.
4.  **Field 5 proposal flow:** Lex's proposal for field 5 is a LIST of candidate section links; accepting writes rows to `IdeaLegislation`. Ensure the proposal card supports a multi-item accept/reject list, not a single scalar accept. Build if missing.

*Why chat-only for now:* a per-section commentary store (`lexNote` on `IdeaLegislation`) is a deferred enhancement, not needed to make Lex usable. Keeping commentary in chat avoids a migration this sprint. Revisit if users want the notes pinned to the panel.

## TASK 10 — Strategic Kernel fields visible in the sidebar (AUDIT THEN BUILD)

The Strategic Kernel (Stage 2) was designed so the answers panel builds up visibly as each field completes, using the same single-field model as Stage 1 (Diagnosis / Guiding Policy / Coherent Actions; \~27 user fields + 3 Lex summaries).

**Check:** confirm the Kernel field titles and values render in the sidebar as designed, and that the Stage 2 sequence still uses the platform-controlled `currentFieldIndex` gate. **Build/fix if the divergence broke it.** Report state to CCh either way.

## TASK 11 — Acceptance protocol end-to-end regression (BUILD/VERIFY)

For EACH of the seven Stage 1 fields, confirm that on an `Accepted:` message: the route returns `fieldUpdates` for the current key in the SAME SSE stream, the DB write fires, the sidebar tick updates, and `currentFieldIndex` advances. Pay special attention to the two non-standard fields:

-   Field 5 (relation): acceptance writes `IdeaLegislation` rows, sidebar reflects the linked count, panel updates.
-   Field 6 (structured Json): acceptance writes the full object with `chosen` set.

Fix any field where the chat accepts but the panel lags — that is the deferred- `fieldUpdates` bug, most likely on fields 5 or 6.

## TASK 12 — Existing-idea safety after the field-set change (AUDIT THEN BUILD)

Tasks 4 and 5 change the Stage 1 field set. Ideas already in the DB have the old shape: no `backgroundResearch`, no `initialThoughts`, and possibly an `ideaType` that was set during Stage 1. The platform must open these cleanly after deploy.

**Check and build:**

-   Both new fields are nullable (Task 4), so they read as empty/not-yet-done. The sidebar must treat null as an INCOMPLETE field, not error. Confirm the "X of N" count and field rendering handle null without crashing on a pre-existing idea.
-   Opening a pre-existing idea must not crash on the now-absent Stage 1 `ideaType` step (Task 5). Confirm the sequence skips it cleanly.
-   `initialThoughts` is `Json?` — code reading it must handle null and must not assume the `{options, chosen}` shape is present. Guard the reads.

**Test:** open at least one idea created BEFORE this sprint on the preview deploy. It must load, show the new fields as incomplete, and let the user fill them. *Why:* a field-set change with no backfill rule is the classic cause of "old records crash after deploy." Nullable + null-tolerant rendering is the fix; no data migration is needed because the new fields are genuinely empty for old ideas.

## TASK 13 — `summaryDiagnosis` provisional/considered overwrite (REPORT)

Field 3 ("What's causing it") writes a PROVISIONAL value to `summaryDiagnosis` in Stage 1, which is later OVERWRITTEN by the considered Diagnosis built in the Strategic Kernel (Stage 2).

**Report:** does any Stage 2 / Kernel code read `summaryDiagnosis` expecting the old meaning, such that the Stage 1 relabel or the overwrite would mislead it? Confirm the overwrite is intentional and that nothing depends on the provisional value persisting. If a conflict exists, report it to CCh before changing anything — do not silently rewire. *Why:* reusing one key for a provisional and then a considered value is deliberate, but only safe if no other code treats the Stage 1 value as final.

***

## Suggested sequence for CC

1.  Task 1 (archive confirm) + Task 2a (report deployed prompt) + Task 13 (`summaryDiagnosis` overwrite check).
2.  Task 3 (single source of truth) — foundational; fixes the count bug.
3.  Tasks 4, 5 (schema add + ideaType removal) + Task 12 (existing-idea safety — pairs with the field-set change).
4.  Task 6 (FTS wiring) + Task 9 (L-panel; commentary is chat-only, no migration).
5.  Tasks 7, 8 (the two special fields).
6.  Task 2b (rewrite the prompt string to v6.0) — after the field model is in place, so the prompt matches reality.
7.  Task 10 (Kernel sidebar check).
8.  Task 11 (end-to-end acceptance regression) — last, as the gate over everything. Run it against BOTH a fresh idea and a pre-existing one (Task 12).
9.  One `commit-all.sh`, run once, delete. Test on Vercel preview before promote.

## What to report back to CCh after the sprint

-   Task 2a verbatim deployed prompt.
-   Task 3: were sequence and sidebar separate sources? (root-cause confirmation)
-   Task 6: FTS function signature and candidate shape.
-   Task 9: prior state of the L-panel (persistence, controls) and what you built.
-   Task 10: did the Kernel sidebar survive the divergence?
-   Task 12: did a pre-existing idea load cleanly with the new field set?
-   Task 13: any Stage 2 code depending on the provisional `summaryDiagnosis`?
-   Any item you found already done (so we know what was and wasn't broken).

## Predicted test outcomes (so the results are interpretable)

-   After Task 3, a fresh idea should show "0 of 7" with Title first. If the count still mismatches → a third field list exists that this task missed; report it.
-   After Task 11, accepting each field should advance the panel in lockstep. If a field accepts in chat but the panel lags → `fieldUpdates` still deferred for that field type (expect fields 5 or 6).
-   Field 5 should return real FTS candidates in preview (FTS is live). If it returns "none" for an idea with obvious legislative relevance → the FTS wiring (Task 6) is not firing; check the call and the candidate injection.
