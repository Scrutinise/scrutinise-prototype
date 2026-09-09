# Append to LEX_REBUILD_DESIGN.md — §14 and §15

*(These follow §13. They reference existing sections §3, §6, §7, §8, §13, which are already in the master doc.)*

***

## 14. Search integration — the gateway

**The mental model:** the search workstream owns **retrieval** (corpus → ranked results). Lex owns the **query** (enrichment, intent) and the **synthesis** (briefing, conversation). They meet at **one module**, so keeping the two workstreams connected means keeping one module and one shared vocabulary in sync — not two whole codebases.

### 14.1 The gateway module

A single module (`lib/lex/search-gateway.ts`) is the **only** place in the platform that touches search. Every search caller — the Page 1 briefing, Page 2 cause-seeding, later amendable-section lookups — goes through it. It owns, in order:

1.  **Build the query** from accepted context (keywords, the field in play).
2.  **Stage-3 expansion** *(capability flag)* — enrich lay terms into terms-of-art before retrieval. *Platform- side, per* `SEARCH_STRATEGY.md` *§3a/§10.1.*
3.  **Web orientation** *(capability flag)* — a Gemini-grounded pass for current-state context, under the grounding rule (web steers and orients; corpus is what gets cited as law). *Per* `SEARCH_STRATEGY.md` *§3b.*
4.  **Call the retrieval service** with the query + intent.
5.  **Map results** to the canonical `SearchResult[]` (§8.3) and **group by display type**.

Because everything funnels here, when search adds vectors, a reranker, or graph layers, **only the gateway changes** — panels, conductor, and briefing synthesis are insulated.

### 14.2 Query intent (this side's half of the contract)

Every gateway call carries an **intent**, so retrieval can route per-stream (`SEARCH_STRATEGY.md` §7 specialised streams). The intent vocabulary is **owned here** and aligned to their stream taxonomy. Initial set:

-   `BACKGROUND_BRIEFING` — Page 1 keywords-accept; the broad landscape search. Gets stage-3 expansion first.
-   `CAUSE_SEEDING` — Page 2; past debates/committee reports where the problem was examined.
-   *(reserved, later)* `AMENDABLE_SECTION`, `POLICY_ALTERNATIVES`, `COMPARATIVE_LAW`.

Add an intent here when a new Lex moment needs retrieval; tell the search side so they can add/route the stream.

### 14.3 Capability flags

Each search capability is adopted behind a flag, switched on when the search side ships it **and** the gold set rewards it: `expansion`, `webOrientation`, `vector`, `reranker`, `graph`. The platform consumes search progress incrementally — never waiting for the whole vision, never blocked by it. The stub already proved the wiring and FTS is live; "connecting to search progress" is flipping these flags / pointing the gateway at each capability.

### 14.4 Ownership (so the two docs don't drift)

-   `SearchResult` shape + the **type taxonomy** → owned by `SEARCH_STRATEGY.md` §10; the gateway consumes the canonical display type from their `corpus-type-map` and does **no** per-source special-casing.
-   The **intent vocabulary** (§14.2) → owned here; the search side references it.
-   One authoritative definition per concept, cross-referenced — never duplicated.

***

## 15. CC Brief — Sprint 2: Diagnosis (Page 2) + the search gateway + the Page 1→2 transition

**Goal:** build Page 2 (Diagnosis) per §7, introduce the search gateway (§14), and give the user a way past Page 1.

**Why:** Diagnosis is the analytical heart of the kernel (Rumelt). It also adds the **second** search caller (cause-seeding) — and two callers is the natural moment to extract one shared gateway rather than scatter search calls. Page 1 currently dead-ends; this adds the transition.

**Prerequisite:** Sprint 1.3 validated on the preview. Do not start until Charlie confirms the save-before- advance fix and the tour work in the browser. This sprint reuses the Page 1 machinery (field machine §3.2, conductor §13, panels §5) — same patterns, new page.

**Un-promoted preview. Usual git discipline; do not promote. Record new rules in** `LEX_PLAYBOOK.md`**.**

### Task 1 — The search gateway (§14)

Extract `lib/lex/search-gateway.ts` as the single point of contact with search. Route the **existing** background-briefing call through it (no behaviour change). Add the **intent** parameter and define the initial vocabulary (`BACKGROUND_BRIEFING`, `CAUSE_SEEDING`, §14.2). Wire **capability flags** (§14.3) with `expansion` and `webOrientation` **OFF** (search hasn't shipped them yet). Map results to canonical `SearchResult[]`; consume the display type from `corpus-type-map` if available, else keep the current grouping **inside the gateway** so only the gateway changes when the taxonomy lands. `// Single seam — when search grows, only this file changes.`

### Task 2 — Diagnosis fields (§7.1)

Build the Page 2 fields, reusing the field machine: `challenge`; `whoAffectedImpactCost` (merged; slots `affectedGroups[]`, `impact`, `cost`, `evidence` — **carry forward** Page 1 Box 1's rough impact/cost to seed this, do not re-ask); `causes` (loop — Task 3); `rootCause` (select one cause from the loop); `legalLandscape` (current law + where it fails); `pivotalObstacle` (distinct from root cause — what blocks a *solution*); → Lex-generated `summaryDiagnosis` that names **both** the root cause and the pivotal obstacle.

### Task 3 — The causes loop (§7.2)

Implement `DiagnosisCause` child records (schema in §7.2: `cause`, `whyPersisted`, `evidence`, `isRootCause`, `source`), the same child-entity pattern as Coherent Actions. Lex **pre-seeds candidate causes** from the corpus via the gateway with intent `CAUSE_SEEDING` ("this has been examined before — here are causes others identified; what do you make of them, and what would you add?"); the user selects/edits/adds; then names one as `rootCause`. UI: add/edit/remove cause records in the Fields panel.

### Task 4 — The Page 1 → Diagnosis transition

The Initial Background briefing gets a **CTA row**: **"Continue to Diagnosis"** (advances `stage` and moves the flow into Page 2) and **"Ask Lex about this"** (focuses the chat). The Continue button appears once Orientation is complete and the briefing is ready. *(A "Give feedback" button belongs here too but its flow is Sprint 2.5 — leave a disabled/"coming soon" placeholder, or omit until 2.5.)*

### Task 5 — Conductor extension (§13)

Extend the conductor to sequence the Diagnosis fields, drive the causes loop, and generate `summaryDiagnosis` when the page's fields are terminal — under the **same save-before-advance rule** as Page 1 (a field waits for Save/accept before the flow moves on).

### Task 6 — Panels

Fields panel renders the Diagnosis fields + the causes loop. Legislation panel: cause-seeding results may surface here (or keep the background briefing visible) — keep it a pure renderer of canonical state.

### Acceptance criteria

-   All search calls go through the gateway; the background briefing behaves exactly as before; the flags exist and default off.
-   Clicking "Continue to Diagnosis" from the briefing moves the flow into Page 2.
-   Diagnosis walks its fields with the save-before-advance behaviour; each box waits for Save.
-   The causes loop pre-seeds candidates from the corpus, accepts user causes, and lets the user mark one as the root cause.
-   `summaryDiagnosis` names the root cause **and** the pivotal obstacle (distinct).
-   Page 1 Box 1's impact/cost is carried into `whoAffectedImpactCost` rather than re-asked.
-   No stalls; frontend holds no progress state beyond an in-flight spinner.

**Git discipline:** no git during the sprint; one `commit-all.sh` at the end; Charlie validates on the preview; CC runs it once and deletes it; commit to `Main`. Do **not** promote.
