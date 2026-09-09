# Lex Rebuild — Design Document

**Status:** the authoritative spec for the Lex conversation layer. Every CC brief on Lex cites it by section number. The Lex equivalent of `INGEST_PLAYBOOK.md`.

**Consolidated 17 August 2026.** §§1–13 are the original document; §§14–26 were issued as addenda and are folded in here in order. The addendum files remain valid but this file supersedes them — **file this as** `docs/LEX_REBUILD_DESIGN.md` **and delete or archive the separate addenda**, so there is one place to read and one place to edit.

⚠ **Naming.** The repository has carried this as `LEX_REBUILD_DESIGN v.1.md`. That space-and-dot name is why §25 and §26 could not be found by a session told to read `LEX_REBUILD_DESIGN.md`. **Use the plain name.**

| §      | What it covers                                                                        | State                            |
|--------|---------------------------------------------------------------------------------------|----------------------------------|
| 1–5    | Why the rebuild, the principles, the state model, the Lex output contract, the panels | built                            |
| 6–8    | Page 1, Page 2, the legislation panel                                                 | built (Page 1 superseded by §25) |
| 9–13   | Migration, FAQ copy, sequencing, Sprint 1 and 1.1 briefs                              | done                             |
|  14–15 | The search gateway; Sprint 2                                                          | built                            |
| 16–19  | Method layer, causal tree, Pages 3–4, costing; Sprint 3                               | built                            |
| 20–21  | Output & publication; Sprint 2.5                                                      | 20-A built; 20-B/C/D designed    |
| 22–23  | Review & Deepening; reading legislation                                               | 22 Pilot A built; 23 designed    |
| 24     | Credibility — reviews, not scores. **Supersedes §22.3**                               | designed                         |
| 25     | **The inverted flow.** Supersedes §6's interaction model                              | 25-A built                       |
| 26     | **Advancement** — proposal to change                                                  | designed                         |

***

## 1. Why we are rebuilding

The old conversation layer had **no single source of truth for state**. "Where are we in the process" lived in three places at once — the frontend, the database, and Lex's parsed output — and every bug we chased was two of those three disagreeing (card reverting after accept, sidebar miscounting, stage advancing early, Lex looping). We fixed collisions one at a time instead of removing the possibility of collision, so each fix surfaced the next bug.

Three root causes, three fixes:

| Root cause                                                                                                    | Fix                                                                                            |
|---------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| State lived in 3 places that could disagree                                                                   | **One server-authoritative canonical state.** Frontend renders it and nothing else.            |
| The LLM was inside the mechanical control loop (sequencing depended on Gemini emitting correct JSON in prose) | **Lex out of the loop.** Structured output with two separate channels; platform owns sequence. |
| Code sediment from 3 successive control regimes                                                               | **Clean state layer**, built from this contract, replacing the old one.                        |

***

## 2. Core principles (non-negotiable)

1.  **Canonical state is server-authoritative.** There is exactly one source of truth: a state object the server computes and returns. The frontend never holds its own idea of progress — only a transient "pending" spinner while a request is in flight.
2.  **Lex is never in the control loop.** Lex returns content; the platform decides sequence, completion, and when to search. A malformed Lex output is rejected and retried — it can never half-advance the state.
3.  **Triggers are deterministic.** Platform code decides when to run a legislation search, not Lex.
4.  **Panels are pure renderers.** Each panel displays a slice of canonical state. If the state is right, the panels are right — always. No panel computes its own progress.

***

## 3. The state model

### 3.1 The hierarchy

```
Idea
 └── Pages         (ORIENTATION → DIAGNOSIS → GUIDING_POLICY → COHERENT_ACTIONS)
      └── Fields   (each has a status and a value)
           └── (some fields are LOOPS of child records, e.g. causes, actions)
```

### 3.2 Field status — the per-field state machine

A single field moves through these states. This is the machine that kills the "lingering card" bug.

```
EMPTY
  │  (Lex proposes a value)
  ▼
AWAITING_CONFIRMATION   ← the confirmation card renders ONLY in this state
  │  user accepts        │  user edits + accepts        │  user declines
  ▼                      ▼                              ▼
ACCEPTED                 ACCEPTED                       SKIPPED
  │  (user reopens to change it)
  ▼
AWAITING_CONFIRMATION
```

**Rule that fixes the lingering card:** the confirmation surface is rendered if and only if `field.status === AWAITING_CONFIRMATION`. On accept, the server flips the status to `ACCEPTED`, returns the new canonical state, and the surface disappears because the state no longer says to show it. The next question is the new `currentField`. No timers, no optimistic divergence, no orphaned UI.

The *surface* differs by field type (see §5 and §13): for the narrative boxes (The idea / You + The Idea / About you) the **box itself** is the accept surface — a Lex proposal pre-fills the box marked "proposed", and **Save** confirms it; for Title and Keywords (a row, no box) an **inline confirm** on the row is the surface. The render rule is identical in both cases — it is a pure function of `status`.

### 3.3 The canonical state object

One endpoint returns the whole truth:

```
GET /api/ideas/{id}/state  →

{
  "ideaId": "…",
  "stage": "ORIENTATION",                 // current page
  "currentField": { "key": "problemNarrative", "status": "AWAITING_CONFIRMATION" },
  "pages": [
    {
      "key": "ORIENTATION",
      "label": "Getting started",
      "status": "active",                 // locked | active | complete
      "fields": [
        {
          "key": "problemNarrative",
          "label": "The idea",
          "type": "narrative",            // narrative | text | structured | loop | inferred
          "status": "AWAITING_CONFIRMATION",
          "value": null,                  // current accepted value, or null
          "proposal": {                   // present only while AWAITING_CONFIRMATION
            "value": "…Lex's proposed text…",
            "rationale": "…why Lex proposed this (optional, shown on card)…"
          }
        }
        // … more fields …
      ]
    }
    // … more pages …
  ],
  "userProfile": { … },                   // see §6.1 — reused across the user's ideas
  "legislationRefs": [ … ],               // see §8 — drives panel 3
  "initialBackground": {                  // see §8.2
    "documentId": "…",
    "status": "pending|ready",
    "summary": "…short preview text…"
  }
}
```

`completedCount` and `total` are **derived on the client** from the fields array (count of `ACCEPTED`/`SKIPPED` vs total) — never stored, never able to drift. The sidebar reads this and nothing else.

### 3.4 Write-ownership table

The whole point of the rebuild. Who is allowed to write each piece of state:

| State piece                             | Written by                                            | NEVER written by                      |
|-----------------------------------------|-------------------------------------------------------|---------------------------------------|
| `currentField` / field sequence         | Server (platform)                                     | Lex, frontend                         |
| field `value`                           | Server, on user **accept**                            | Lex directly; frontend (pending-only) |
| field `proposal`                        | Lex, via schema-validated output                      | frontend                              |
| `stage` advance                         | Server, when all page fields are `ACCEPTED`/`SKIPPED` | Lex, frontend                         |
| `userProfile`                           | Server, from Lex-extracted + user-confirmed values    | Lex freehand                          |
| `legislationRefs` / `initialBackground` | Server, from search results (stubbed for now)         | Lex freehand                          |

***

## 4. Lex output contract

Lex returns **two separate channels** using Gemini's structured-output / function-calling mode (the model is constrained to emit a fixed JSON shape, so we never parse data out of prose again):

```
{
  "chatText": "…the conversational message shown in the chat panel…",
  "proposal": {                  // null if Lex is only talking (e.g. an orientation message)
    "fieldKey": "problemNarrative",
    "value": …,                  // typed to the target field's schema
    "rationale": "…optional, shown on the accept card…"
  },
  "extracted": {                 // optional — slots Lex inferred (e.g. experienceLevel) for the server to store
    "experienceLevel": "novice"
  }
}
```

**Server-side handling:**

1.  Validate `proposal.value` against the target field's schema.
2.  If valid → set that field to `AWAITING_CONFIRMATION` with the proposal attached.
3.  If invalid/malformed → discard the proposal, keep `chatText`, retry once. **State never half-advances.**
4.  `chatText` is always shown, regardless of proposal validity.

This is the single change that ends the prompt-sprint / UX-sprint interference: editing the prompt changes only `chatText` quality, never the mechanics.

***

## 5. Panel render contracts

Three panels, each a pure renderer of a slice of canonical state.

| Panel               | Renders                                                                                                                                                                                                                                              | Source slice                              |
|---------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------|
| **1 — Chat**        | Message history + Lex's `chatText` + an **inline confirm** for a Title/Keywords proposal that is `AWAITING_CONFIRMATION`                                                                                                                             | messages + `currentField`                 |
| **2 — Fields**      | All boxes/rows, statuses, values, "X of Y" per page; green tick on `ACCEPTED`. A narrative box that is `AWAITING_CONFIRMATION` renders Lex's **proposed text inside the box** (marked "proposed"); **Save** confirms — the box is the accept surface | `pages[]`                                 |
| **3 — Legislation** | "Initial Background" briefing (top) + grouped source cards                                                                                                                                                                                           | `initialBackground` + `legislationRefs[]` |

Panel 2 becomes trivial: it loops over `pages[].fields[]` and renders status. Because the server owns status, the sidebar cannot miscount.

***

## 6. Page 1 — Orientation

**Purpose:** gather context about the user and their problem so Lex can calibrate (adjust tone and depth) and be the best possible guide. **No Kernel analysis happens here.**

### 6.1 The model: 3 input boxes → 3 generated outputs

The user sees **three free-text boxes** in the sidebar, not a long form. Each box has a **side hint list** (see §6.4) showing what kind of information helps. The user writes as much or as little as they like; Lex reads each box, spots gaps against the hint list, and gently prompts — **at most two nudges per box, then it moves on** (not pushy). Behind each box Lex quietly extracts a few structured **slots** (labelled sub-values) for calibration and reuse; these are not separate boxes the user fills.

**The three input boxes:**

| Box                    | Stored on          | What it gathers                                                                                                                                                                                                                                                                                                                                | Slots Lex extracts behind it                                                                                                               |
|------------------------|--------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| **1 — The idea**       | idea               | Everything the user can tell us about what they want to change: the problem, how they frame it, who's affected, rough impact and cost — **only what the user can provide** (the rigorous, evidence-backed version is Page 2; whatever is volunteered here **carries forward to seed** Page 2's `whoAffectedImpactCost`, so Lex never re-asks). | `problemNarrative`, `currentFraming`                                                                                                       |
| **2 — You + The Idea** | idea               | The user's relationship to *this* idea: why it matters to them, what work they've already done or written, and what success looks like. *(uploads attach here)*                                                                                                                                                                                | `motivation`, `priorWork`, `ideaGoal` *(change a law / a rule / pressure an institution / unsure)*, `uploads`                              |
| **3 — About you**      | **user (profile)** | Who they are in general: experience in this area and in politics, career, resources/team, and what they want from Scrutinise.                                                                                                                                                                                                                  | `experienceLevel` *(the branch — novice / some / expert)*, `career`, `resources`, `legislativeKnowledge`, `politicalLevel`, `whatTheyWant` |

**Why this order:** Boxes 1 and 2 are about *this idea* and are fresh each time. Box 3 is about the *person* and is **reused across every idea they ever create** — asked in full the first time, then shown on later ideas as a skippable check-back ("here's what I know about you — anything to add?"). It sits **last on purpose**: on a return visit Box 3 collapses out of the active flow, leaving the per-idea boxes as a stable 1 and 2 with **no renumbering**. The branch (`experienceLevel`) is stored in Box 3 but Lex establishes it **early in the conversation** — one light opening question — because it forks how deep Lex's prompting goes thereafter.

`politicalOrientation` (Left/Right × Global/Local coordinates + party) is an **optional** part of Box 3, asked softly on a return visit, stored as `{x, y}` + `party` so a future drag-the-icon widget can populate it. Not built now.

### 6.2 The three generated outputs

These are produced by Lex/the platform, not boxes the user fills:

| Output                                                         | Produced by                       | Notes                                                                                                                                              |
|----------------------------------------------------------------|-----------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `title`                                                        | Lex proposes from Box 1           | User accepts/edits.                                                                                                                                |
| `keywords`                                                     | Lex proposes from all three boxes | User confirms/edits. Drives the search. Government department is **inferred** and included as one keyword among several — not asked as a question. |
| **Initial Background** (legislative first fetch + Lex summary) | Platform search + Lex             | Fires when `keywords` is accepted (§8.4). Lands in panel 3.                                                                                        |

### 6.3 Flow

**First-time user:** Lex opens with one light question that establishes experience level (the branch — stored in Box 3), then works Box 1 ("What do you want to change?"), nudging obvious gaps once or twice; then Box 2 ("why does this matter to you, and what would success look like?"); then completes Box 3 ("a bit about you and what you want from this"). Lex then proposes `title` + `keywords`; on confirm, the search fires and the Initial Background appears.

**Returning user:** Box 3 collapses to a skippable check-back (profile already on file). Boxes 1 and 2 are fresh, in stable positions. Title / keywords / search as above.

### 6.4 Side hint lists (shown beside each box)

Plain prompts so the user knows what helps, without it being a form. Lex uses the same lists as its gap checklist.

-   **The idea:** what you want to change · the problem as you see it · who's affected · rough scale or impact · any costs you know of.
-   **You + The Idea:** why it matters to you · anything you've already done, written, or researched (you can upload it) · what success would look like.
-   **About you:** who you are · your experience in this area · your experience in politics generally · your career · whether you have a team or resources · what you're hoping Scrutinise can do for you.

***

## 7. Page 2 — Diagnosis

**Purpose:** name the pivotal obstacle. Per Rumelt, a good diagnosis simplifies a messy reality, identifies what is critical, and explains why the problem has resisted solution. We capture **two distinct things** that were being conflated:

-   **Root cause** — the main driver of the *problem* (why it happens).
-   **Pivotal obstacle** — the main thing blocking a *solution* (why it persists). May or may not be one of the causes; could be enforcement difficulty, vested interest, cost, or political will. **This is the thing the Guiding Policy must defeat**, and it is the anchor for Page 3.

### 7.1 Fields

| \# | Field key               | Type                    | Notes                                                                                                                                                                                                                                                                                         |
|----|-------------------------|-------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | `challenge`             | text                    | One-sentence problem statement.                                                                                                                                                                                                                                                               |
| 2  | `whoAffectedImpactCost` | structured              | Merged. Slots: `affectedGroups[]` (kept separately visible — it is the MP/constituency hook), `impact`, `cost`, `evidence`. Evidence nudge here.                                                                                                                                              |
| 3  | `causes`                | **loop / child entity** | Each `DiagnosisCause` record: `cause`, `whyPersisted`, `evidence`. Lex seeds candidates from the corpus ("this has been examined before — here are five causes others identified; what do you make of them, and what would you add?"). User selects/edits/adds.                               |
| 4  | `rootCause`             | reference               | The user names the main driver of the problem from the loop.                                                                                                                                                                                                                                  |
| 5  | `legalLandscape`        | structured              | What law currently governs this and where it fails. Placed **before** `pivotalObstacle` because knowing the existing law usually reveals the real obstacle (e.g. "it's already illegal, so the obstacle is enforcement, not law"). *Flagged: if you'd rather it sit elsewhere, easy to move.* |
| 6  | `pivotalObstacle`       | text                    | The critical thing blocking a solution. Distinct from `rootCause`. Rumelt's named obstacle.                                                                                                                                                                                                   |
| 7  | → `summaryDiagnosis`    | Lex-generated           | Names **both** the root cause and the pivotal obstacle; becomes the anchor Page 3 links back to.                                                                                                                                                                                              |

### 7.2 `DiagnosisCause` child table

Mirror of the existing Coherent Actions pattern (each action is already its own row). New table; each row:

```
DiagnosisCause {
  id
  ideaId        (FK → Idea)
  cause         text
  whyPersisted  text
  evidence      text     // becomes the summary line of a richer Evidence record later — clean upgrade path
  isRootCause   boolean  // exactly one true per idea
  source        enum     // USER | LEX_CORPUS   (so we can show "identified in past debates")
}
```

***

## 8. Legislation panel & Initial Background

### 8.1 Panel structure

1.  **Initial Background** (top) — a prose briefing written by Lex: what law governs the area, key points and people from past debates, relevant select committees, threads worth pulling. The "shockingly impressive" artifact. The chat carries only a one-line pointer; the report lives in the panel.
2.  **Grouped source cards** (below) — the corpus items, capped \~20, **2–3 per category**: primary legislation (Acts), secondary legislation (Statutory Instruments), debates (Hansard), committee reports, case law (later). Each card links out to legislation.gov.uk or the corpus item.

### 8.2 Initial Background as a document

The briefing is a **generated document record on the idea** (Word + PDF), so it:

-   renders and is downloadable in the legislation panel, AND
-   appears in the idea's **Documents/Exports tab** (which lives outside these three panels).

`Document { id, ideaId, kind: "INITIAL_BACKGROUND", docxUrl, pdfUrl, status }`.

### 8.3 Search dependency and the FTS contract (important)

FTS (full-text search: keyword matching across stored corpus text) is being built in the parallel workstream. The load phase is complete (16.5M rows); the index build is being shipped with `withPosition: false` for v1 — meaning **BM25 term ranking** (matches and ranks on the presence of the query terms) **without exact-phrase ranking**. That is fine for this use case: the first fetch is keyword/term retrieval, and Lex grounds its briefing on the returned sections regardless. Phrase positions can be rebuilt later if needed; **no change to the contract below** — `score` is simply a BM25 score.

To keep the two workstreams decoupled, the platform and FTS agree one **interface** (the fixed shape of data passing between them). Query in / results out:

```
Query:   { keywords: string[], limit: number }

Result:  SearchResult {
  id          // corpus item id
  type        // PRIMARY_LEGISLATION | STATUTORY_INSTRUMENT | DEBATE | COMMITTEE | CASE_LAW
  title
  citation    // e.g. "Road Traffic Act 1988, s.36"
  snippet     // matched text excerpt
  score       // BM25 relevance score
  url         // legislation.gov.uk or corpus link
  date
}
```

Therefore:

-   Build panel 3 as a **pure renderer** of `legislationRefs[]` + `initialBackground`.
-   Feed it **stub data shaped exactly as** `SearchResult[]` so swapping stub → real FTS is a one-line source change.
-   The server groups results by `type`, takes 2–3 per type, caps \~20.
-   Wire the real FTS query endpoint the moment it lands — only the data source changes; the renderer does not.

### 8.4 Search trigger

**Deterministic, platform-owned.** When the user accepts `keywords` at the end of Page 1, the server fires the search (stubbed now), populates `legislationRefs` + `initialBackground`, and Lex posts the one-line pointer. Lex never decides whether to search.

***

## 9. Migration of old data

Three test users, no meaningful data. **No deprecated-fields UI.** A one-off script copies any content from removed fields into the new `ideaContext` free narrative, tagged `[migrated: <oldFieldName>]`. Done.

***

## 10. FAQ copy — "What is a Guiding Policy?"

*(Public-facing. Insert verbatim into the FAQ.)*

**The Guiding Policy is the bridge between understanding a problem and acting on it.** Most proposals jump straight from "here's the problem" to "here's my list of things to do," with no stated logic connecting the two — which is why they fall apart under questioning. The Guiding Policy is that logic: the overall approach you've chosen to overcome the specific obstacle your diagnosis identified. It's a direction, not yet a set of actions. Done well, it makes your actions feel obvious; without it, they look arbitrary.

**Why "what it rules out" matters.** A good approach is as much about what you are *not* doing as what you are. An approach compatible with every possible action isn't a strategy — it's a wish. Naming the alternatives you're deliberately setting aside, and why each conflicts with your approach, is what proves your proposal is focused.

**Why you list alternatives.** Every serious problem has a standard toolkit of responses — a ban, a tax, an information requirement, a subsidy, a voluntary code. A strong proposal shows it considered them, makes the genuine case for each, and explains why the chosen approach beats them for *this* problem. This is exactly what a parliamentary committee will ask — doing it first is what makes a proposal scrutiny-proof.

**Conditions for success — "what has to be true?"** Every policy rests on assumptions about how the real world will respond. Naming them is what separates a serious proposal from a hopeful one, because each assumption is something that can be tested, defended, or designed around. Ask: what are you betting on for this to work, and what would have to be true?

***

## 11. Build sequencing

Design the whole flow once (this document); build incrementally.

-   **Sprint 1 (this brief):** state layer + Page 1 + all three panels rendering canonical state (panel 3 on stub data). Prove the mechanics end-to-end on the simplest page.
-   **Sprint 2:** Page 2 (Diagnosis), including the `DiagnosisCause` loop and corpus-seeding (seeding stubbed until search lands).
-   **Sprint 3:** wire real FTS into the search trigger and panel 3.
-   **Later:** Page 3 (Guiding Policy — its own design pass), Page 4 (Coherent Actions migration), the political orientation widget.

***

## 12. CC Brief — Sprint 1: state layer + Page 1 + panels

**Goal:** replace the old conversation state layer with the server-authoritative canonical-state model in §3, deliver Page 1 (§6), and render all three panels (§5) from canonical state with panel 3 on stub data.

**Why (the reasoning behind this sprint):** the old layer permitted three sources of state to disagree, which is the root cause of every UX bug to date. This sprint removes that possibility. We build Page 1 + panels first (not the whole flow) to prove the mechanics on the simplest page before layering Pages 2–4 in as data.

**Tasks:**

1.  **Canonical state endpoint.** Implement `GET /api/ideas/{id}/state` returning the object in §3.3. This is the single source of truth. *Endpoint/field naming may be refined by CC provided the §2 principles and §3.4 ownership table hold exactly.*
2.  **Field state machine (§3.2).** Implement the five field statuses and transitions server-side. The confirmation card must render iff `status === AWAITING_CONFIRMATION`. `// The card is a pure function of server state — never a timer or local flag (was the root cause of the 20s revert bug).`
3.  **Lex structured output (§4).** Switch Lex to Gemini structured-output mode returning `{chatText, proposal, extracted}`. Validate `proposal.value` server-side against the field schema; on failure, keep `chatText`, discard the proposal, retry once. `// Lex must never be able to half-advance state — this is what takes the LLM out of the control loop.`
4.  **Deterministic sequence + stage advance (§3.4).** Server sets `currentField` and advances `stage` only when all of a page's fields are ACCEPTED/SKIPPED. Lex and the frontend never write sequence or stage.
5.  **Page 1 fields (§6).** Create profile fields on the user and idea-context fields on the idea. Implement the first-time vs returning-user question hierarchy (§6.3). `governmentArea` is inferred + confirmed, not asked.
6.  **Three panels as pure renderers (§5).** Rebuild panels to render only from canonical state. Panel 2 derives "X of Y" from the fields array — never a stored counter. Panel 3 renders `initialBackground` + grouped `legislationRefs[]` from **stub data** (provide a realistic sample for one idea).
7.  **Stub the search trigger (§8.4).** On `keywords` accept, populate `legislationRefs` + `initialBackground` from stub data and post Lex's one-line pointer. `// Real FTS wires in Sprint 3 — only the data source changes.`
8.  **Migration script (§9).** One-off: copy removed-field content into `ideaContext` tagged `[migrated: …]`.

**Acceptance criteria:**

-   The accept card appears when a field is awaiting confirmation and disappears immediately on accept — no revert, no timer, no lingering question.
-   Panel 2 lists every Page 1 field with correct status and an accurate "X of Y"; green tick on accept.
-   Panel 3 shows a stub Initial Background briefing + grouped source cards.
-   A returning user is not re-asked profile questions; they get the profile check-back instead.
-   Editing the Lex prompt changes only `chatText`; it cannot break sequencing or the panels.
-   Frontend holds no independent progress state beyond an in-flight spinner.

**Git discipline:** no git calls during the sprint. Generate one `commit-all.sh` at the end; Charlie approves on the Vercel preview; CC executes once and deletes the script. Commit to `Main`.

***

## 13. CC Brief — Sprint 1.1: wire Lex to the field machine (orchestration fix)

**Goal:** connect Lex's conversation to the field machine. Sprint 1 built both but never wired them together, so the flow stalls.

**Why:** the state foundation works — direct entry into a box writes field state, ticks appear, "X of Y" counts, panels render from canonical state. Three faults remain, all in the orchestration layer (the logic that decides "whose turn is it and what happens next"), which was never built. This is a fix on the **un-promoted preview**: do **NOT** promote to production or run the §9 migration until the flow completes end-to-end (acceptance criteria below).

**Confirmed interaction model — the contract for this sprint** (revises §3.2/§5; both updated):

-   A narrative box (The idea / You + The Idea / About you) has **two input paths, both writing through the server to** `IdeaFieldState`**:**
    -   **Form:** user types in the box + **Save** → field `ACCEPTED`. Lex gives a one-line acknowledgement and the flow moves to the next box.
    -   **Chat:** user answers in chat → Lex tidies the answer into that box's content and sets the field `AWAITING_CONFIRMATION` with the tidied text as the `proposal` → the **box renders the proposed text** (marked "proposed") → user edits and/or **Save**s to accept.
-   The **box is the single accept surface** for narrative fields. No separate accept-card in chat for them.
-   Lex converses to help and nudges gaps **at most twice per box**, then moves on.
-   **Title** and **Keywords** (a row, no box): Lex proposes once the three boxes are terminal → **inline confirm** on the row. On **Keywords** accept: fire the stub search, populate Background, advance stage to Diagnosis.

### Task 1 — Diagnose Fault 1 before changing code (bytes-before-hypotheses)

Lex currently emits no `proposal`, so chat answers never reach the boxes. **Log Lex's raw structured-output response on a chat turn** and check whether a `proposal` is present:

-   **No** `proposal` **in the output** → prompt problem: the system prompt isn't telling Lex (a) which field is current and (b) to produce a proposal for it. Fix in Task 2.
-   `proposal` **present but field doesn't update** → wiring problem: the lex route isn't persisting it (not calling `setProposal`). Fix in Task 2.

Report which it is, then proceed — don't stop for a round-trip; fix whichever it is.

### Task 2 — Make chat answers populate the current box

The lex route must pass Lex the **current field** (key, label, hints) and instruct Lex to: respond conversationally **and**, when the user's message holds enough to fill the current box, return a `proposal` whose `value` is a tidied version of the user's words for that field. On a valid proposal the server sets the field `AWAITING_CONFIRMATION`; the box renders the proposed text. (Per §4 — a malformed proposal is discarded and `chatText` is still shown; Lex can never half-advance state.)

### Task 3 — The orchestration step ("what next" after every field write)

Add **one server function**, called after any field transition (form Save, chat-accept, skip), that decides the next action and reflects it in the canonical state. It owns sequence (per §3.4 — server, not Lex, not frontend):

-   Current box just became terminal (`ACCEPTED`/`SKIPPED`) and another box remains → set `currentField` to the next box; Lex posts a one-line acknowledgement + the next box's question.
-   All three boxes terminal and `title` empty → Lex proposes **Title** (inline confirm).
-   `title` terminal and `keywords` empty → Lex proposes **Keywords** (inline confirm).
-   `keywords` just accepted → fire the existing `fireSearchTrigger` (stub), populate `legislationRefs` + Initial Background, post Lex's one-line pointer, advance `stage` to `DIAGNOSIS`.

This is the conductor that was missing. Every write must produce a next step — no path may leave the flow idle.

### Task 4 — Lex acknowledgement on direct form Save

When a box is saved directly (no chat), Task 3 still triggers a **brief** Lex acknowledgement + the next question, so the chat stays alive. Keep it to one sentence.

### Task 5 — Intro copy (first idea vs returning)

A user's **first** idea opens with the full introduction, then — as a **separate bubble immediately after** — the first question. Verbatim:

>   I'm here to help you develop and build support for a credible proposal for your idea, ready for Parliamentary colleagues. There are three panels here: this is the chat, where you can use me to help you develop your proposal; next to it is the proposal itself as you build it; and last is the legislative panel, where we'll place relevant legislation for review once we have enough information to source data that's helpful. You can answer the questions here in the chat, or type directly into the form in the second panel if you don't need my help.

Separate bubble:

>   What's the problem or challenge you want to address?

Returning users keep the existing short returning-user intro. **Fix the name:** it currently renders "Charles" — use the user's actual first name.

### Acceptance criteria

-   Answering **in chat** fills the matching box as proposed text, which the user can edit and Save.
-   Saving a box **directly** produces a one-line Lex acknowledgement and the next box's question.
-   After all three boxes, Lex proposes a **Title**, then **Keywords**, each confirmable inline.
-   Confirming **Keywords** fills the Background panel (stub) and unlocks **Diagnosis**.
-   A user's **first** idea shows the full intro + a separate first-question bubble; the user's name is correct.
-   **No stalls:** every field write produces a next step.

**Git discipline:** no git during the sprint; one `commit-all.sh` at the end; Charlie validates on the preview; CC runs it once and deletes it; commit to `Main`. Do **NOT** promote to production or run the §9 migration until all acceptance criteria pass.

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

*(Follows §15. References §3 (state), §7 (Diagnosis), §13 (conductor), §14 (gateway). §16–§18 are design; §19 is the CC brief that builds all three.)*

***

## 16. Page 2 refinements, the causal tree, and the method layer

### 16.1 Field order — unchanged; content sharpened

The §7 field order stands: challenge → whoAffectedImpactCost → causes → rootCause → legalLandscape → pivotalObstacle → summaryDiagnosis. Three within-step changes:

1.  **Material vs contributory (the Rumelt spine).** Each `DiagnosisCause` gains `classification: MATERIAL | CONTRIBUTORY | UNASSESSED`. Material = remove it and the problem largely goes away; contributory = worsens it but isn't decisive. Lex must press for this call on every cause — "is this *the* thing, or *a* thing?" — and not accept vagueness. The `rootCause` question becomes: "of the **material** causes, which is the main driver?"
2.  **"Who's affected" reframed.** Hints and Lex prompting change from "who's affected" (answer: everyone) to the two discriminating questions: **who is most acutely affected** (specific groups), and the impact/cost.
3.  **Cui bono moves to the obstacle step.** "Who benefits from things staying as they are?" is asked inside the `pivotalObstacle` conversation (stored as a `beneficiariesOfStatusQuo` slot in its structured value) — it is frequently the route to the obstacle, so it belongs there, not in the affected-groups step.

### 16.2 The causal tree (mind-map)

Real causes can sit more than two steps away (e.g. equalities-claims liability → tribunal payouts → exhausted budget → bin collections cut). So causes become a **tree**, not a flat list:

-   **Schema:** `DiagnosisCause` gains `parentCauseId` (nullable, self-referencing foreign key — a column that points at another row in the same table, which is how a tree is stored in a database). Root-level causes have `parentCauseId = null`; a sub-cause points at its parent. Soft depth cap **4** (Lex nudges consolidation beyond that — diagnosis should get *clear*, not *exhaustive*).
-   **UX:** the causes field gets a **List \| Map toggle**. Map view renders the tree as a **Mermaid** diagram (Mermaid is a text-to-diagram language: the app generates a few lines of diagram code from the cause records and a client library draws it). Nodes are clickable to edit/classify; each node has "add cause beneath this". Material causes render visually distinct (e.g. bold/coloured) so "picking out the credible ones" is literal.
-   **Brainstorm capture:** the user can free-list ideas in the simple form; Lex structures them into the tree ("X because Y because Z" chains create linked records) and proposes corpus-seeded candidates as before.
-   **Selection semantics:** `classification` and `isRootCause` apply at any node — the root cause may be a leaf three levels down (as in the bins example).

### 16.3 The method layer — Rumelt in the room

A new module `lib/lex/method.ts` holds **per-stage methodology blocks** (below) that the platform injects into Lex's system prompt for the active stage. This is the "potted Rumelt": the *ideas* of Good Strategy Bad Strategy distilled in our own words (ideas are not copyright-protected; the book's text is, so no excerpts — and nothing enters the corpus). Gemini already knows Rumelt from its training; these blocks *direct* that knowledge and fix the standard we hold the user to. Maintained here in the design doc as the single source; CC mirrors verbatim into `method.ts`.

**M-GENERAL (all stages):** You are guiding the user through a strategy kernel: diagnosis (what is really going on), guiding policy (the chosen approach to the pivotal obstacle), coherent actions (coordinated steps that execute the approach). Good strategy is scarce because it requires choice: naming one decisive obstacle, choosing one approach, declining others, and concentrating effort. Bad strategy has recognisable smells — fluff (abstract restatement dressed as insight), failure to face the problem, mistaking goals for strategy ("spend more, try harder"), and impracticable objectives (a wish-list with no leverage). Watch for these in the user's input and in your own drafts; name them kindly and push for the sharper version. Never let a list substitute for a choice.

**M-DIAGNOSIS (Page 2):** A diagnosis is a simplification that names what is pivotal — not an inventory of everything wrong. Press every cause to a classification: material (remove it and the problem largely goes) or contributory (worsens it, not decisive). Insist the root cause and the pivotal obstacle are distinct findings: the root cause explains why the problem *happens*; the pivotal obstacle explains why it *persists unsolved* — often enforcement failure, a coordination gap, a cost nobody will bear, or a party who benefits from the status quo (always ask who benefits). A diagnosis is complete only when a reader could say in one sentence what must be defeated for anything else to matter.

**M-GUIDING-POLICY (Page 3):** The guiding policy is an approach, not a goal and not an action list. It is designed, not picked: generate candidate approaches per material cause, argue each genuinely for and against, then choose — the rejected candidates, with reasons, are what the policy rules out, and a policy that rules nothing out is fluff. The chosen approach must have leverage: it concentrates effort on the pivotal obstacle and exploits some asymmetry (anticipation of behaviour, a pivot point, concentration). Anticipate responses — avoidance, gaming, enforcement burden, legal challenge, political attack vectors — and state conditions for success as testable bets ("for this to work, X must be true"). Never present a menu without driving to a choice.

**M-COHERENT-ACTIONS (Page 4):** Actions must be coordinated, not merely listed: each consistent with the policy and with each other, resources concentrated rather than smeared across everything. Check concentration (does the set focus effort where the leverage is?) and sequencing (what must happen first — chain-link steps where one failure breaks the chain). Every action names who implements it and what it costs to implement, to enforce, and in friction imposed on the economy; benefits are weighed against the Page 2 problem cost. Estimates are ranges with stated sources and assumptions the user can challenge — never unexplained point figures.

*(Why prompt-injection and not fine-tuning: fine-tuning — training a model's internal weights on documents — would require licensing the book's text, costs real money per model version, and teaches phrasing more than judgment. The distillation-plus-trained-knowledge route is cheaper, legally clean, editable in minutes, and survives model upgrades. If we later want more depth, we add our own-authored method notes to the corpus and retrieve them per stage — same RAG pattern as legislation.)*

***

## 17. Page 3 — Guiding Policy (evaluation-driven)

The section is a designed choice, not a questionnaire. Flow: orient → evaluate options → choose & rule out → crystallise. Fields:

| \# | Field                    | Type                    | Notes                                                                                                                                                                                                                                                                                                                                                                                        |
|----|--------------------------|-------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| —  | *(orientation)*          | conductor message       | Lex restates the pivotal obstacle + material causes and sets the frame: "good strategy means choosing one approach and deliberately not others — let's work out which cause to tackle and how."                                                                                                                                                                                              |
| 1  | `policyOptions`          | **loop / child entity** | One `PolicyOption` per candidate approach. Lex seeds candidates **per material cause** (toolkit: incentives, rules, transparency, market design, institutional restructuring), argues each **for and against** genuinely; the user reacts, adds, edits. This is where feasibility (held over from Page 2) is evaluated — including whether a cause's own sub-causes must be addressed first. |
| 2  | `chosenApproach`         | reference               | The user commits: this cause, this approach. Remaining options are marked `RULED_OUT` with a reason (the residue of choosing).                                                                                                                                                                                                                                                               |
| 3  | `whatItRulesOut`         | Lex-drafted, editable   | Composed from the RULED_OUT options + reasons; the user confirms/edits. Never asked cold.                                                                                                                                                                                                                                                                                                    |
| 4  | `leverage`               | text                    | Why this approach hits the pivotal obstacle specifically — the asymmetry it exploits.                                                                                                                                                                                                                                                                                                        |
| 5  | `anticipatedResponses`   | structured              | Avoidance, gaming, enforcement burden, legal challenge, **political attack vectors**. Lex proposes; user reacts.                                                                                                                                                                                                                                                                             |
| 6  | `conditionsForSuccess`   | structured              | Testable bets: "for this to work, X must be true." Lex proposes from the evaluation; user confirms/adds.                                                                                                                                                                                                                                                                                     |
| —  | → `summaryGuidingPolicy` | Lex-generated           | The approach, its leverage, what it rules out and why, anticipated responses, conditions.                                                                                                                                                                                                                                                                                                    |

`PolicyOption` **table:** `{ id, ideaId, approach, mechanismTypes[], targetCauseIds[], caseFor, caseAgainst, status: CANDIDATE | CHOSEN | RULED_OUT, ruleOutReason, source: USER | LEX }`. Link-to-diagnosis is structural (`targetCauseIds`), no longer a question. Mechanism types live per-option, not as a page field.

***

## 18. Page 4 — Coherent Actions + the costing shell

### 18.1 Fields

**Actions loop** (`CoherentAction` records, one per action): `practicalStep`, `mechanismType`, `whoImplements`, `targetOrganisation` *(legislative actions)*, `wording` *(legislative actions — capture intent now; precise section-level drafting graduates when the AMENDABLE_SECTION search intent matures)*, `benefits` *(financial / social / ongoing — ranges + basis)*, `costs` *(§18.2 structure)*.

**After the loop:**

-   `coherenceCheck` — Lex-run commentary: mutual consistency, **concentration** (focused or smeared?), and **sequencing** (what must precede what; chain-link dependencies). No new user labour.
-   `costSummary` — aggregated totals (§18.3) set against the **Page 2 problem cost**: "the problem costs \~X/yr; this plan costs \~Y one-off + Z/yr." The proposal's cost-benefit spine.
-   → `summaryCoherentActions` (Lex-generated).

### 18.2 Cost structure (per action)

Three categories, replacing the generic net-cost fields:

| Category             | Meaning                                                | Falls on          |
|----------------------|--------------------------------------------------------|-------------------|
| `implementationCost` | One-off cost to set up (systems, guidance, transition) | Government        |
| `enforcementCost`    | Ongoing cost to police and administer                  | Regulator / state |
| `regulatoryFriction` | Ongoing compliance burden imposed on those regulated   | The economy       |

Each stored as `{ low, high, unit, basis, benchmarkId?, userOverride? }` — a **range with a stated basis**, optionally tied to a benchmark record (§18.3), optionally overridden by the user with their own evidence.

### 18.3 The costing engine — pilot architecture

**Principle: every number is transparent, sourced, and challengeable.** Nothing outputs an unexplained figure.

-   `CostBenchmark` **table (the contract — built now, populated by research):** `{ id, domain, metric, unit, low, high, source, sourceUrl, year, method, notes }`. Examples of what will live here: HM Treasury **Green Book** appraisal values (the government's own manual for valuing costs and benefits), **QALY** values (quality-adjusted life year — how the NHS prices a year of healthy life, \~£20–30k range historically), value of a prevented fatality, value of time, standard admin- burden costs, unit-cost databases for social outcomes.
-   `IdeaAssumption` **table:** `{ id, ideaId, benchmarkId, userValue, userEvidence }` — the user's overrides, with their evidence, kept alongside the defaults. This is the **transparent project space**: the briefing/ report shows which numbers are defaults, which are overridden, and every source link.
-   **Estimator flow:** Lex helps the user pick benchmarks per action, produces indicative **ranges** flagged as estimates, aggregates per §18.1, and always shows its working.
-   **Research programme (runs in parallel, outside CC's build):** **Phase 1 — scoping (CCh task, next deliverable):** survey the field — Green Book + supplementary guidance, NICE/QALY practice, departmental appraisal values, the Regulatory Policy Committee and published impact assessments (many already in the corpus), unit-cost databases — and deliver `COSTING_SCOPE.md`: the benchmark schema validated against reality, the source list, and how corpus + web research feed it. **Phase 2 — build the benchmark set:** systematic extraction into `CostBenchmark` rows (corpus first — past impact assessments are gold — then web), each row sourced. Gated on Phase 1. The sprint below builds the **shell** (tables, per-action capture, aggregation, override UX) with a small hand-seeded benchmark set so the flow is testable before Phase 2 lands.

***

## 19. CC Brief — Sprint 3: the full kernel (Pages 2 refinements + 3 + 4)

**Goal:** complete the kernel end-to-end so Charlie can evaluate the whole process: §16 (Page 2 refinements, causal tree, method layer), §17 (Guiding Policy), §18 (Coherent Actions + costing shell).

**Why one sprint:** the field machine is proven multi-page; Pages 3–4 are mostly config + child entities + prompts on existing patterns. Execute **§16 → §17 → §18 sequentially** (each section's acceptance verified by smoke before the next begins), one `commit-all.sh` at the end. Un-promoted preview. Usual git discipline. Record new rules in `LEX_PLAYBOOK.md`.

### Task 1 — Method layer (§16.3)

`lib/lex/method.ts` with the four blocks **verbatim from §16.3**; conductor/lex-route injects M-GENERAL + the active stage's block into the system prompt. `// Blocks are maintained in the design doc §16.3 — edit there first, mirror here.`

### Task 2 — Page 2 refinements (§16.1)

`classification` enum on `DiagnosisCause` (+ UI chip on each cause; Lex presses for the call); `rootCause` selects among MATERIAL causes; reframed who's-affected hints; `beneficiariesOfStatusQuo` slot in `pivotalObstacle`'s structured value + Lex asks cui bono there.

### Task 3 — Causal tree (§16.2)

`parentCauseId` self-FK on `DiagnosisCause` (additive, idempotent SQL to Neon — not db push); List \| Map toggle in the causes field; Map = Mermaid render of the tree (client lib; check for an existing diagram dependency before adding one), nodes clickable, "add cause beneath this", material nodes visually distinct; Lex can propose chains ("X because Y because Z") creating linked records; soft depth cap 4 with a consolidation nudge.

### Task 4 — Page 3 (§17)

`page3-config.ts`; `PolicyOption` table + CRUD + route; Lex option-seeding per material cause (gateway intent `POLICY_ALTERNATIVES` — add to §14.2 vocabulary; flag-gated like the others, corpus-seeded where useful); choose/rule-out semantics; `whatItRulesOut` Lex-drafted from RULED_OUT records; crystallise fields; `summaryGuidingPolicy`. Conductor extension under save-before-advance. Orientation message per §17.

### Task 5 — Page 4 (§18)

`page4-config.ts`; `CoherentAction` records with the §18.2 cost structure; `CostBenchmark` + `IdeaAssumption` tables (additive SQL); hand-seed \~10 plausible benchmark rows (clearly marked `method: "placeholder — Phase 2 research pending"`) so the flow is testable; estimator capture + aggregation + `costSummary` vs Page 2 problem cost; coherence check incl. concentration + sequencing; `summaryCoherentActions`; page transition CTAs (Diagnosis→Guiding Policy→Coherent Actions, same pattern as §15 Task 4).

### Acceptance criteria

-   End-to-end on the preview: Orientation → Diagnosis → Guiding Policy → Coherent Actions with save-before- advance throughout and no dead-ends (skip paths included).
-   Causes: classifiable, tree-buildable to depth 4, Map view renders and edits; root cause selectable at any depth among material causes.
-   Page 3: options seeded per material cause with genuine for/against; choosing marks the rest RULED_OUT with reasons; `whatItRulesOut` composes from them; summary states approach, leverage, ruled-out, anticipated responses (incl. political attack vectors), conditions.
-   Page 4: costs captured as ranges with basis; benchmark picker + user override with evidence works; totals aggregate and compare against the Page 2 problem cost; coherence check names concentration + sequencing.
-   Method blocks demonstrably in the prompt per stage (visible in [lex-diag] logging).
-   Editing prompts/method text cannot break mechanics (per §4).

**Git discipline:** no git mid-sprint; one `commit-all.sh` at the end; Charlie validates on the preview; CC runs it once and deletes it; commit to `Main`. Do **not** promote.

*(§20 is design, for Charlie's review. §21 is a CC brief that can run immediately — it touches nothing the Lex walk-through will exercise.)*

***

## 20. Proposal Output & Publication

### 20.0 Why this is the module that ties it together

Every page so far produces **inputs**. §20 is the only place they become a **thing an MP receives**. Without it a completed proposal has nowhere to go: the kernel is captured, costed and sourced, and then sits in a database. This module is also where Scrutinise's promise gets tested in public — a proposal that survives scrutiny because it was scrutinised first.

Design consequence that runs through everything below: **the document is a rendering of canonical state, not a new authored artefact.** Nothing here re-asks the user for content they have already given, and nothing is written into the output that the state doesn't hold. The §19-C never-claim invariant applies with more force here than anywhere, because this is the artefact that leaves the building.

### 20.1 The five outputs (one source, five renderings)

| Output                                         | For                                   | Contains                                                                                                    |
|------------------------------------------------|---------------------------------------|-------------------------------------------------------------------------------------------------------------|
| **The Proposal** (PDF + docx)                  | An MP, adviser, or committee clerk    | The kernel as an argument: diagnosis → guiding policy → costed actions, with sources. The primary artefact. |
| **The Summary** (1–2 pages)                    | The first thirty seconds of attention | Problem, pivotal obstacle, the approach, what it rules out, headline cost vs problem cost, the ask.         |
| **The Evidence Pack**                          | Anyone checking the work              | Every source cited, grouped; the cost basis and assumptions; the ruled-out alternatives with reasons.       |
| **The Online View**                            | Sharing, discussion, scrutiny         | The same content as a web page, with the corpus links live and (if public) open to comment.                 |
| **The Legislative Annex** *(where applicable)* | Drafting and target identification    | §20.4 — target Act, provisions to amend/insert/repeal, linked case law, drafting intent.                    |

The PDF is deliberately **short and points at the online view** for depth — a committee clerk reads two pages and follows a link; they do not read forty.

### 20.2 The curation pass (Charlie's requirement: the user owns what goes out)

Before anything is published or exported, the user walks a **curation step** — a distinct page in the same three-panel shell, not a modal:

1.  **Sources.** Every corpus item Lex surfaced across all four stages, listed with where it was used. The user includes, excludes, or annotates each. *Lex proposed them; the user owns them.* Excluded items stay in the record (excluded, not deleted) so the evidence pack can show what was considered.
2.  **Costs.** Each figure with its basis, marked **default** (benchmark) or **overridden** (user evidence). The user confirms or adjusts. Any figure the user hasn't looked at is flagged as un-reviewed rather than silently blessed.
3.  **Claims check.** Lex lists every factual assertion in the draft alongside what backs it — a corpus item, a statistics observation, a benchmark, or **nothing**. Unsupported claims are surfaced for the user to evidence, soften, or cut. *This is the evidence-base check, and it is the single most valuable page in the module: it is pre-emptive scrutiny of the user's own document.*
4.  **Confidence and gaps.** Lex states plainly what the proposal does not yet establish — the honest limitations section, written for the user rather than hidden from them. A proposal that names its own gaps is stronger in committee than one that pretends to have none.

### 20.3 Visibility model

Four states, user-chosen, changeable:

-   **Private** — the user only (default).
-   **Link-shared** — anyone with the link; no listing, no indexing. For sending to a specific MP or adviser.
-   **Community** — visible within Scrutinise Central communities the user belongs to *(the boundary in §20.7)*.
-   **Public** — listed, indexed, open to comment and scrutiny.

Publishing is **explicit, reversible, and versioned**: a published proposal keeps the version that was shared, so a recipient's link doesn't shift under them while the user keeps editing. Each version records what changed.

### 20.4 The legislative annex (the "what kind of law" submodule)

Where an action is legislative, capture the drafting intent — **not** the drafting itself (that graduates when the `AMENDABLE_SECTION` search intent matures):

-   **Instrument type:** new primary legislation · amendment to an existing Act · statutory instrument · repeal/revocation · non-legislative (guidance, rules, code).
-   **Target:** the Act/SI and, where identified, the section(s) — sourced from the corpus with citation, never typed from memory.
-   **Operation:** amend / insert / substitute / repeal, with the intent stated in plain English ("remove the 20% rate for care-home renovations by amending Schedule 8").
-   **Linked case law:** how the target provision has been interpreted — corpus-sourced.
-   **Consequentials:** what else the change touches, flagged as a question for the user where the corpus can suggest candidates.

Rendered as an annex to the proposal, and the natural consumer of the amendable-section search when it lands.

### 20.5 Feedback to Scrutinise (Sprint 2.5, spec)

When a user comments on or critiques Lex's output — briefing, seeded causes, options, cost figures — Lex offers to pass it back:

1.  Lex **strips anything personal** and summarises the technical substance.
2.  Shows the user exactly what would be sent: *"Send this to Scrutinise as feedback? You can edit it first."* → **Yes / Edit / No**.
3.  Stored as a `FeedbackItem` **and** emailed to `cl@scrutinise.org` (Resend). DB so it is queryable and minable; email so Charlie sees it.

`FeedbackItem { id, userId, ideaId, stage, surface (BRIEFING|CAUSES|OPTIONS|COSTS|OTHER), originalText, summarisedText, userEdited, consentGiven, createdAt }`.

**Why it matters more now than when specified:** search returns real results, so critique is signal about retrieval quality — an early source of observed queries and quality judgments for the search gold set, ahead of real traffic.

### 20.6 Build sequencing

-   **20-A (Sprint 2.5, now — §21):** feedback capture + docx/PDF export of the Initial Background. Both additive, neither touches the state machine.
-   **20-B:** the proposal document itself — full render of canonical state to docx/PDF, plus the Summary.
-   **20-C:** the curation pass (§20.2), including the claims check.
-   **20-D:** visibility, versioning, and the online view (§20.3).
-   **20-E:** the legislative annex (§20.4), deepening as amendable-section search matures.

20-B and 20-C are the substance; they are specified enough to build once the walk-through settles.

### 20.7 Boundary with Scrutinise Central

Central's social objects (communities, membership, events, points) stay **structurally separate** from the Idea pipeline. Community visibility (§20.3) is a **read grant on a published version**, never shared ownership of the working proposal. Community activity must never confer access to someone's in-progress work.

***

## 21. CC Brief — Sprint 2.5: feedback capture + document export

**Goal:** ship §20.5 (feedback) and the first export path. **Both are additive and touch neither the field machine, the conductor, nor the panels' state handling** — deliberately chosen so this can run while Charlie's walk-through findings are outstanding.

**Un-promoted preview. Usual git discipline; one** `commit-all.sh`**; do not promote. Record in** `LEX_PLAYBOOK.md`**.**

### Task 1 — Feedback capture (§20.5)

-   `FeedbackItem` table (fields as §20.5), additive idempotent SQL to Neon — **not** `prisma db push`.
-   Enable the existing disabled "Give feedback" placeholder on the Background panel CTA row, and make the same action reachable from the chat.
-   Flow: user's critique → Lex produces (a) a personal-content-stripped summary and (b) shows it back with **Yes / Edit / No**. Nothing is stored or sent without an explicit Yes. `// Consent is explicit and the user sees the exact text — this is their words leaving their control.`
-   On Yes: persist the `FeedbackItem` **and** send via Resend to `cl@scrutinise.org` (subject carrying stage + surface). A mail failure must not lose the record — persist first, then send, and log a send failure.
-   Lex confirms honestly what happened (per §19-C 1b — no claiming a send that failed).

### Task 2 — Document export (§8.2, currently stubbed)

-   Generate **docx and PDF** of the Initial Background briefing from the stored `Document` record; populate `docxUrl`/`pdfUrl`; store in R2 alongside existing assets.
-   Download available from the legislation panel **and** listed in the idea's Documents/Exports tab.
-   Regenerate on demand (the briefing changes when a search is re-run) — don't serve a stale file silently; show what it was generated from and when.
-   Content is a **rendering of stored state only**: the briefing prose plus its grouped source references with citations and links. Nothing generated fresh at export time.
-   `// This is the first step toward §20-B, the full proposal document — build the render path so it generalises rather than special-casing the briefing.`

### Acceptance criteria

-   Critiquing Lex's output offers feedback; the summary is shown before sending; No sends nothing; Yes both stores and emails; a mail failure still leaves the stored record and is logged.
-   No personal content in the summarised text (check with a deliberately personal test input).
-   The Initial Background downloads as a readable docx and PDF, with sources and citations intact.
-   Re-running the search then re-exporting produces an updated file, and the UI shows the generation timestamp.
-   Nothing in the field machine, conductor, or canonical-state contract is modified by this sprint.

*(Design, for Charlie's review. §22 is a new stage; §23 is a new Lex capability that §22's legal review depends on. Both build on §20 — publication — and neither touches the kernel's state machine.)*

***

## 22. Review & Deepening (Stage 5)

### 22.0 What this stage is for

Pages 1–4 produce a **skeleton**: a defensible structure with thin flesh. It is coherent, but it is one person's reasoning with whatever evidence they had to hand. §22 is the stage that turns it into something that survives contact with a select committee, a hostile press office, and a department's own analysts.

**The principle throughout: Lex does the heavy lifting; the user does the judging.** Lex finds, tests, compares and challenges. The user queries, disagrees, goes elsewhere for their own research, and brings what they find back. A pass is not "Lex wrote a section" — it is a worked argument between the two.

**And it is entirely voluntary.** A user with a small idea and an afternoon should not face nine mandatory gates. Every pass is independent and can be taken to any depth. What the platform provides is not compulsion but **visibility**: an honest picture of how deep the work has gone, so the user chooses where to spend effort and a reader can see how seriously to take it.

### 22.1 The nine passes

Each has the identical shape (§22.2), so they are one mechanism, nine configurations.

| \# | Pass                         | What Lex's first pass produces                                                                                                                                                                                                                             |
|----|------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | **Logical review**           | Does the argument hold? Diagnosis → obstacle → approach → actions tested for gaps, non-sequiturs, circularity, and claims that don't follow from what precedes them.                                                                                       |
| 2  | **Evidence deep dive**       | Finds evidence *and* tests it: studies, data, **case studies**, **international comparisons** — what worked elsewhere, what failed, and how comparable it actually is. Flags where the evidence base is thin or contested.                                 |
| 3  | **Legal deep dive**          | Every relevant Act, SI, regulator rule and case; how the provisions interlock; how courts have read them; which provisions are the **leverage points** (§23); what the change should actually amend, insert or repeal; ranked by relevance and confidence. |
| 4  | **Financial deep dive**      | The costing engine taken seriously: benchmark selection, assumptions challenged, sensitivity, the EANDCB position, comparison against what similar interventions actually cost (Impact Assessments and Post-Implementation Reviews as precedent).          |
| 5  | **Implementation deep dive** | How this is actually executed: by whom, when, in what sequence; the structures, processes, teams and coordination required; what capability has to exist that doesn't; where delivery typically breaks.                                                    |
| 6  | **Political risk**           | The human obstruction map: who loses, who blocks, who must be persuaded; the attack lines this proposal invites and the strongest form of each; which arguments have killed similar proposals; what the defensible answer is.                              |
| 7  | **Sector risk**              | Why change is hard *in this sector specifically*: structural features, entrenched interests, past reform attempts and **why they failed**. Corpus-rich — committee post-mortems and PIRs are exactly this.                                                 |
| 8  | **Sources & admin**          | Every source checked: does it exist, say what's claimed, remain current, and is it the best available? Broken links, superseded law, stale statistics, missing citations.                                                                                  |
| 9  | **Claims check**             | Every factual assertion listed against what backs it — corpus item, statistic, benchmark, or **nothing**. Unsupported claims surfaced to evidence, soften, or cut. *(Absorbs §20.2's claims check; it belongs here.)*                                      |

### 22.2 The shape of a pass (one mechanism, nine configurations)

1.  **Training panel** — before starting: *what this review looks for, why it matters, what good looks like.* Short, concrete, teaching. The same pattern that made Guiding Policy comprehensible. Dismissible; always retrievable.
2.  **Lex's first pass** — runs on request over the accepted state plus corpus, statistics and (flag-gated) web. Produces **findings** (research, case studies, comparisons, precedent) and **issues**.
3.  **The issues list** — the heart of it. A to-do of specific, addressable items: *"No evidence offered for the claim that renovation rates respond to VAT"*, *"The Treasury will argue this is a precedent for other sectors — no answer given"*. Each item can be **addressed** (opens a working thread with Lex, resolves to content), **assigned** to a team member, **deferred**, or **dismissed with a reason**. Dismissed items stay visible in the evidence pack — a reader can see what was considered and set aside, which is a strength.
4.  **The dialogue** — the user challenges Lex's findings; Lex challenges the user's answers. The user brings outside research in ("I found this study — does it hold up?") and Lex tests it against the corpus rather than accepting it. **Lex must be as willing to say "that doesn't support your point" as to agree.**
5.  **Resolution** — findings the user accepts become part of the proposal, attributed to their source.

### 22.3 Depth: the thermometer and the star rating

**Depth must measure work and evidence, never Lex's opinion of quality.** An LLM-judged "quality score" is gameable, unfalsifiable, and would make the public rating dishonest. Every component below is *countable*.

**Per-pass thermometer** — five levels, each with an objective test:

| Level | Name         | Test                                                                                             |
|-------|--------------|--------------------------------------------------------------------------------------------------|
| 0     | Untouched    | Pass never run                                                                                   |
| 1     | AI pass      | Lex's first pass complete; findings and issues generated                                         |
| 2     | Reviewed     | Every issue triaged — addressed, assigned, deferred or dismissed with a reason                   |
| 3     | Evidenced    | Issues addressed with sources attached; claims in this section supported                         |
| 4     | Challenged   | The user has contested Lex's findings, or brought external research that Lex has tested          |
| 5     | Corroborated | An independent party — team member, contributor, or invited expert — has reviewed and signed off |

**Public star rating** = an aggregate of the nine thermometers, displayed with its composition visible (hovering shows which passes are deep and which are untouched). A reader sees *"legal and financial deep; implementation untouched"* rather than an opaque 3.5. **The honest signal is the composition, not the number** — and a proposal that names its shallow areas is stronger than one that hides them.

Rule: a proposal can be published at any depth. The rating is information, never a gate.

### 22.4 The idea team (Charlie's model, made concrete)

Four roles. The team is **private and idea-scoped** — appointed through the idea module, with no relationship to Scrutinise Central communities.

| Role            | Can                                                                                  |
|-----------------|--------------------------------------------------------------------------------------|
| **Owner**       | Everything: edit, publish, delete, manage the team, accept/decline contributions     |
| **Editor**      | Edit all content and run reviews. Cannot publish, delete, or manage the team         |
| **Reviewer**    | Assigned to specific passes: edit those sections, comment anywhere, run their passes |
| **Contributor** | Anyone logged in who has the shared URL. **Suggests only** — cannot edit             |

**Contributions are a distinct object**, not edits: `Contribution { ideaId, userId, section, text, status: PROPOSED | ACCEPTED | DECLINED, response }`. The owner triages; an accepted contribution becomes content **with attribution to its author**. Declining is normal and requires no justification — the owner is never obliged to take anything on board.

The shared URL can be posted in a Central community, which is how community and idea meet **without** community membership conferring any edit right. §20.7's boundary holds: community activity never grants access to someone's working proposal.

*Open for Charlie: should Editors be able to run reviews that change the depth rating, or should rating- affecting actions be Owner-confirmed? My recommendation: Editors run freely; only sign-off (level 5) requires a distinct identity, since that's the level that claims independence.*

### 22.5 Where §22 sits

Kernel (Pages 1–4) → **Review & Deepening (§22, optional, any order, any depth)** → Curation & Publication (§20). Deepening can be re-entered after publication; a new version records what changed and the rating moves with it.

***

## 23. Reading legislation with Lex ("the KC beside you")

### 23.0 The problem this exists to solve

Law is opaque, and the opacity is load-bearing: it keeps interpretation in the hands of a professional class and exhausts everyone else — including most MPs. Scrutinise's answer is **not** to summarise the law away. A summary substitutes Lex's understanding for the user's, which reproduces the priesthood with a new priest.

**The design rule: Lex never stands between the user and the text. It stands beside them.** The user reads the actual words of the actual Act. Lex supplies what an experienced lawyer supplies — where to look, *how* to look, what the words are doing, and where the pressure points are. The measure of success is that the user finishes able to read the next Act better, not merely informed about this one.

### 23.1 The reading view

Two panes. **Left: the original text, unaltered, from the corpus.** Right: Lex's apparatus, keyed to what the user has selected. Nothing in the right pane replaces anything in the left.

Apparatus, on demand rather than all at once:

-   **Structural map** — what this Act does, in Parts; which sections are operative and which are machinery (commencement, extent, consequential amendments); where the real content sits.
-   **Controlling definitions** — the defined terms that govern the provision on screen, pulled from wherever they live, with the distinction that changes everything: **"means" is exhaustive, "includes" is not.**
-   **Duty or power** — "must" creates an obligation; "may" confers a discretion. In a proposal this is often the entire argument: a regulator that *may* act and doesn't is a different problem from one that *must*.
-   **Currency** — is this in force, amended, or repealed; what changed and when; what the version on screen is.
-   **Interpretation** — how courts have read this provision (corpus case law), and where it is contested.
-   **Cross-references resolved** — the referred-to section shown inline rather than sending the user hunting.

### 23.2 Leverage points in the text (Rumelt applied to statute)

The distinctive feature, and the direct answer to *"where are the leverage points?"* Lex marks the places in a provision where **a small textual change produces a large effect** — the drafting equivalent of a pivot point:

-   **A definition** — change what a word covers and every provision using it moves.
-   **A threshold or number** — a rate, a limit, a period, a floor. Often the smallest possible amendment.
-   **A duty/power switch** — "may" → "must" converts a discretion into an obligation.
-   **A delegated power** — where a Minister can already act by regulation, no primary legislation is needed.
-   **An exemption or exclusion** — often easier to narrow or widen than to change the main rule.
-   **An enforcement provision** — a right without a remedy changes little; where enforcement sits is where behaviour changes.
-   **A commencement or sunset provision** — timing as a lever.

For each, Lex states what changing it would do **and what else it would touch** — the consequentials. This feeds §22's legal deep dive and §20.4's legislative annex directly.

### 23.3 Teaching the moves ("how to look")

Alongside the apparatus, Lex surfaces the *technique* being used, briefly, in context: check the defining provisions before the operative ones; read the section in its Part, not alone; schedules are part of the Act; explanatory notes help but are not the law; punctuation and structure carry meaning. The user should notice themselves acquiring the moves.

**This content is drafted for expert review** — see `FAQ_READING_LEGISLATION.md`, written to be handed to practising KCs to correct and improve. Once reviewed, it becomes both the FAQ section and the source for Lex's in-context prompts, so the guidance the user gets is guidance a KC has signed off.

### 23.4 Grounding

Everything in the right pane is corpus-sourced or a stated general principle. Lex does not characterise a provision's meaning beyond what the text, the definitions, and the retrieved case law support — and where the law is genuinely contested, it says so rather than picking a side. §19-C's never-claim invariant applies without exception.

*(Design, for Charlie's review. Prompted by his 11 Aug critique of the depth thermometer, which was correct: the 1–5 levels conflated progress, effort and credibility, and a self-awardable scale measuring "work done" was being asked to carry a meaning — "trust this" — that it cannot honestly carry. §22.3 is superseded by §24.1–24.2 below. §22's passes, issues list, and team roles are unchanged.)*

***

## 24. Credibility: the Scrutinise Review

### 24.0 The principle: separate what got conflated

Three different questions were being answered by one scale:

| Question                        | Nature         | Honest form                                               |
|---------------------------------|----------------|-----------------------------------------------------------|
| **How far along is this?**      | Workflow       | A stage label                                             |
| **How much is verifiable?**     | Countable fact | Numbers, machine-derived                                  |
| **Should a stranger trust it?** | Judgment       | **Attributed human assessments, weighable by the reader** |

The design rule that follows: **numbers for what can be counted; named humans for what must be judged; never a number that launders a judgment.** A single star rating is exactly such a laundering — Charlie's brother-in-law point in one line: a "full review" is worth what its reviewer is worth, and no scale can carry that. Only attribution can.

And the direct answer to "if we are really after quality, what is the best way of achieving it?" — quality does not come from a score. It comes from a **loop**: hard findings → fixes → verified re-review. Everything below is machinery for running that loop and making its results visible. The metric is the residue of the loop, never a substitute for it.

### 24.1 Progress (replaces thermometer-as-progress)

A plain stage label on the idea, matching how the work actually proceeds:

**Skeleton** (kernel pages complete) → **Deepened** (deepening passes run and worked) → **Team-reviewed** (worked with a private team/group) → **Published** (§20.3 visibility). Formal review sits **parallel** to this track, exactly as Charlie said — it can happen at any stage and is not a stage itself.

Internally, the §22 passes keep a **workflow state** for the owner's dashboard (untouched / AI pass run / issues open / issues resolved) — useful for managing the work, never displayed as a public quality score.

### 24.2 Evidence facts (replaces thermometer-as-depth)

Public, countable, machine-derived — displayed as facts with no aggregation into a score:

-   **Claims backed:** *"87% of factual claims carry a source"* — the §22 claims check already computes this.
-   **Issues:** raised / resolved / open — from the issues list.
-   **Known unknowns declared:** count, with the list one click away.
-   **Sources:** count, by type (legislation / debates / committee / statistics / case law).
-   **Last deepening run:** date.

These are hard to fake and require no judgment. A reader can weigh them; the platform never sums them.

### 24.3 The review instrument (Charlie's "lay out the structure")

A review is a **structured assessment, not a comment.** Its structure mirrors the kernel and the deepening passes, so reviews are comparable and partial reviews are legitimate:

**Sections** (each: verdict `SOUND | MINOR ISSUES | MAJOR ISSUES | NOT ASSESSED` + written reasoning):

1.  Problem clarity — is a real problem stated, and is it the right one?
2.  Diagnosis — are the causes evidenced? Is the pivotal obstacle the true blocker?
3.  Guiding policy — genuine leverage? Are the ruled-out alternatives honestly argued?
4.  Coherent actions — implementable, coherent, owned?
5.  Evidence quality — **spot-check the citations: does the source say what's claimed?** (The evidence layer makes every citation clickable, so this is genuinely checkable — a property paper proposals don't have.)
6.  Costings — realistic? Right benchmarks? Sensitivity honest?
7.  Risks — political and sector risks adequately anticipated?
8.  Overall assessment — free text.

**Findings.** The heart of it: specific, addressable defects — *"the £14m figure cites a source that gives £1.4m"*, *"no answer to the precedent-for-other-sectors attack"*. **Each finding lands on the owner's §22 issues list**, tagged to the review. The review plugs into the machinery that already exists; nothing new to learn on the owner's side.

**Declaration.** Reviewer name; credentials (self-declared, displayed as self-declared — the same honest pattern as the legislation-guide form; verification badges are a later layer); conflicts of interest; scope (which sections reviewed); whether the review was invited by the owner or unsolicited; time spent (optional).

**Lex serves the reviewer too.** On opening a review, Lex assembles the reviewer's pack: the claims-to-source map for spot-checking, the cost basis, the known unknowns, and — for re-reviews — the diff. Scrutiny is the product; the reviewer is a first-class user of it.

**Who can review: anyone logged in** with access to the idea (shared URL or public). No gatekeeping of who may speak — gatekeeping of **weight**, via attribution, declared credentials, and track record (§24.5). The brother-in-law can review; his review displays "no credentials declared · first review", and the reader weighs it accordingly. A KC's carries its weight the same honest way.

### 24.4 Version pinning and the staleness loop (Charlie's "review is out of date" problem)

**A review attaches to a version, never to "the idea."** §20.3 already versions published proposals; a review records the version (content hash) it assessed. Then staleness stops being a defect and becomes the engine:

1.  Review of **v3** raises 14 findings → they land as issues.
2.  Owner resolves 12 in **v4–v6**; each resolution links back to its finding.
3.  Display, automatically: *"Reviewed by Jane Smith KC at v3 — 14 findings; 12 resolved since; 2 contested. [What changed since this review]"* — the review is never silently outdated; it is visibly **answered**.
4.  The reviewer is invited to a **delta re-review**: Lex shows only what changed and how each finding was addressed. Minutes, not hours. Outcome appended: *"Re-reviewed at v6 — 12/14 resolved, 2 contested."*
5.  Reviews and re-reviews are **append-only** — never edited retroactively. The full exchange is the audit trail, and *"survived a harsh review and fixed everything it found"* becomes the strongest credibility statement a proposal can display.

### 24.5 Judging the reviewer (Charlie's voting idea, with two refinements)

Yes — the review is itself open to public assessment, and the responsibility is the point. Two refinements to make the incentive land on *harshness with substance* rather than popularity:

1.  **Readers rate rigour, not agreement.** The control is *"rigorous / not rigorous"* (or "useful for judging this proposal"), explicitly not "do you agree with the verdict" — otherwise harsh reviews of popular ideas get buried, which is the opposite of the incentive we want. *(Later refinement, noted: weight ratings by rater diversity, Community-Notes-style, so a partisan pile-on counts less than agreement across camps.)*
2.  **The strongest reputation signal is objective and automatic: findings that led to changes.** "12 of 14 findings accepted and fixed" proves the review was substantive in a way no vote can. Reviewer reputation is therefore built from: findings-accepted rate, re-reviews completed, reader rigour ratings, and declared credentials — displayed on a reviewer's track-record page. The way to build a reputation on Scrutinise is to find real holes. **Harshness is rewarded precisely when it is right.**

### 24.6 Endorsement ≠ review (split them)

Charlie's instinct — "less like a stage, more like a formal endorsement, like an MP endorsement" — points at two objects that must not be one:

-   **A review** says *"I examined this."* Structured, version-pinned, findings, may be harsh, may conclude against. Epistemic capital.
-   **An endorsement** says *"I support this."* Identity + statement, no structure. Political capital.

Splitting them keeps reviews **safe to be negative** — a KC can do a bruising review without it reading as opposition, and an MP can endorse without pretending to have audited the costings. Displayed separately.

### 24.7 What the public sees (replaces the star rating)

A **credibility panel** on the published proposal — all facts, all attributed, nothing summed:

>   **Stage:** Deepened · **Claims backed:** 87% · **Issues:** 14 raised, 12 resolved, 2 contested · **Known unknowns:** 4 declared **Reviews:** Jane Smith KC *(self-declared; invited)* — v3, 14 findings, re-reviewed v6 · rigour 91% · [read the exchange] **Endorsements:** …

The composition *is* the signal. No single number exists to be gamed, and every judgment on the page has a name attached to it.

### 24.8 Data model (sketch)

`Review { id, ideaId, versionHash, reviewerUserId, invited, scopeSections[], sections[{key, verdict, reasoning}], declaration{credentials, conflicts, timeSpent?}, createdAt }` — append-only. `ReviewFinding { id, reviewId, section, text, issueId (→ §22 issue), status: OPEN | RESOLVED | CONTESTED }` `ReviewRating { reviewId, raterUserId, rigorous: boolean }` (one per rater) `Endorsement { id, ideaId, endorserUserId, statement, createdAt }` Reviewer track record is derived, never stored as a score.

### 24.9 Sequencing

Nothing here changes the current build order. **Dependencies:** versioning (§20-D) must exist before reviews can pin to versions; the issues list (§22 mechanism) must exist for findings to land on. So: 3-D fixes → §22 mechanism + Legal/Financial/Political passes (issues list included) → §20-B/C/D → **§24 build**. The §22 brief will now specify the per-pass *workflow* state and the *evidence facts*, and omit the 1–5 thermometer and star rating entirely.

*(Design, for Charlie's review. Supersedes the interaction model of §6 and reshapes §22's passes. The state machine (§3), the field contract (§4), the panels (§5), the gateway (§14) and the credibility model (§24) are all unchanged — this changes who fills the boxes, not how boxes work.)*

***

## 25. The inverted flow — the user decides, Lex writes

### 25.0 The reframe

**Old model:** the user writes; Lex assists. **New model:** the user *decides*; Lex writes.

The user supplies what only they have — the problem in their own words, their context, their tacit knowledge, and their judgment at every fork. Lex does everything else, and hands back not a finished proposal but **a proposal plus a review agenda**: the things to read, the choices to make, the weaknesses to answer.

**The failure this design must avoid is not a bad draft — it is a good draft the user rubber-stamps.** A proposal its author cannot defend in a committee room is worthless, however well written. Every mechanism below that looks like friction is there for that reason.

### 25.1 Page 1 — what we ask before Lex can write anything

Four conversational exchanges plus a reusable profile. Nothing analytical; nothing Lex could infer.

| \# | What we ask                                                                                                                                                                     | Why Lex cannot proceed without it                                                                                                                                                           |
|----|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | **The problem — in your own words.** What's wrong, who it hurts, why it matters.                                                                                                | The seed, and the authenticity. Everything downstream is built on it and it must be theirs. Subject to the §19-D problem gate: a solution offered here is challenged, twice, then accepted. |
| 2  | **What you want to happen.** A change in the law · a change in how a rule is applied · pressure on an institution · not sure yet. And: anything you've **already ruled out**.   | Sets the solution space. Drafting a policy the user has already rejected burns a whole build.                                                                                               |
| 3  | **What you know that we won't find.** Your own experience of this, what you've seen, what the record won't show.                                                                | The care-home owner knows things no corpus holds. This is the single input that makes the proposal *theirs* rather than a competent synthesis, and it is marked as theirs in the record.    |
| 4  | **Anything to read?** Documents, links, prior work. *(Optional; also available at any point later — §25.6.)*                                                                    | Cheap, high-yield, and it front-loads material Lex would otherwise never see.                                                                                                               |
| —  | **About you** *(profile — asked once, reused across ideas)*: your connection to this, your experience here and in politics generally, resources, what you want from Scrutinise. | Calibration and credibility. Skipped entirely on a returning user.                                                                                                                          |

Then Lex **states its understanding back in a paragraph and asks for confirmation before spending the build.** *"Here's what I think you're getting at, and what I'm about to go and do."* One correction here saves ten minutes of wasted work and a draft the user then has to argue with.

### 25.2 The build run — Lex writes the whole kernel, iteratively

Charlie's call, and it is the right one: **you cannot write the causes properly until you have seen what the actions imply.** A linear pass produces a diagnosis written in ignorance of the policy that follows from it. So the build is iterative, it runs to completion before the user sees it, and it is a *job* — minutes, a progress display, incremental persistence — not a chat turn.

**Six passes:**

1.  **Orient.** Corpus + web + the domain-transfer question (§25.4). What is this problem, who else has it, what governs it now. No drafting yet.
2.  **Draft the kernel.** Diagnosis → guiding policy → coherent actions, straight through. Deliberately rough: this pass exists to reveal what the proposal *implies*, not to be good.
3.  **Research what the draft revealed.** Only now do we know which mechanism is in play, which provisions are targets, which sector's precedents matter. This is where the interrogation library does most of its work, and it is why the research cannot all happen up front.
4.  **Revise against the findings.** Rewrite the causes in the light of what the actions exposed. Check the chain: do these actions defeat this obstacle, which follows from these causes? Run the coherence check. **Where the revision contradicts pass 2, that contradiction is kept** — it is a finding about the idea, and it goes to the user.
5.  **Adversarial read.** A hostile committee clerk reads the whole thing cold, with the findings attached: where is it weakest, what can it not answer. Produces the issues list.
6.  **Assemble the review agenda** (§25.3).

**Every fork is recorded, not resolved.** Wherever pass 2 or 4 had to choose — which cause is pivotal, which approach, which instrument — Lex records the alternatives it set aside **with the case for each**, and the agenda presents them as live decisions rather than as settled text. *A draft that hides its own choices is the rubber-stamp failure in written form.*

**Operational requirements:** incremental persistence, so a timeout loses the tail and not the run; honest status, so a failed pass says so; a stated cost and time ceiling per build; and the standing never-claim rule — every finding carries its source, and "we looked and found nothing" is a result.

### 25.3 The review agenda — the user's actual work

Not a document to read. A worked agenda, ordered by what most changes the proposal:

1.  **Decisions** — the recorded forks. Two or three real options each, the case for each, and Lex's recommendation *with its reasoning shown*. The user chooses. Choosing is thinking; approving is not.
2.  **Challenges** — the adversarial issues. Each addressable, assignable, deferrable, or dismissable with a reason. *(The Deepening's existing mechanism, unchanged.)*
3.  **Reading** — the two or three sources that actually matter, each with one specific sentence on *why this one* and what to look for. Never a list. Lex is firm about it: reading the primary material is where the user's judgment enters and Lex's cannot substitute.
4.  **Gaps** — what Lex could not establish, stated plainly. Each is either a research task, a question only the user can answer, or an honest limitation of the proposal.
5.  **Your unique contribution** — where the user's own knowledge (Page 1, \#3) has been used, and where Lex thinks more of it would strengthen the case.

**Re-running.** After the user works the agenda, Lex re-builds from passes 3–5 with the decisions applied. Each round is a version (§20-D). Convergence is the norm: round two should be materially shorter than round one, and if it is not, something is wrong.

### 25.4 The interrogation library

The questions Lex puts on the user's behalf. **Two kinds, and the distinction is load-bearing:**

**Corpus questions** — our edge is *having the corpus*:

| Question                                                               | Intent                           |
|------------------------------------------------------------------------|----------------------------------|
| What does the law actually say, at section level?                      | `LEGAL_LANDSCAPE`                |
| How have the courts read these provisions?                             | `CASE_INTERPRETATION` *(new)*    |
| How did we get here — amendment history, previous attempts, failures?  | `LINEAGE` *(new)*                |
| What was it for / predicted / what happened? (EN · IA · PIR)           | `PRECEDENT`                      |
| Does the evidence support **or contradict** this asserted cause?       | `CAUSAL_EVIDENCE`                |
| Who has argued about this, and what did they say?                      | `CAUSE_SEEDING`                  |
| Who has voted on comparable measures?                                  | `POSITION` *(new; people-graph)* |
| Is there an existing delegated power that removes the need for a Bill? | `EXISTING_POWER` *(new)*         |
| Is this reserved or devolved?                                          | `DEVOLUTION_SCOPE`               |
| What are the numbers?                                                  | `query_stats` tool               |

**Domain-transfer questions** — our edge is *knowing to ask*, and these are answered by reasoning plus web, then **validated against the corpus**:

-   **Who else has this problem, outside this sector, and what have they built?** *(The highest-yield generic question we have. All four models missed the private-sector accountability literature until asked; the question, not the answer, was the missing thing.)*
-   What is the strongest published case against this?
-   How would this be gamed, and how have comparable instruments been evaded?
-   What is the cheapest route to the same effect?

**A domain-transfer answer is never presented as corpus-grounded.** It is labelled as reasoning, and where it names a mechanism, the follow-up corpus question is *"has UK legislation ever used this shape?"*

### 25.5 The right-hand panel — organised by question, not by document type

"Primary legislation / debates / committee reports" is our filing system. The user needs the answer to a question. Panel headings become the library:

-   **What the law says now**
-   **How the courts have read it**
-   **What was tried before — and what happened**
-   **Where this mechanism works elsewhere** *(including outside the sector)*
-   **Who has argued about this**
-   **Who has taken a position** *(votes, interests, committee membership)*
-   **The numbers**
-   **What's devolved**
-   **The strongest case against**
-   **Your material** *(§25.6)*

Rules: a heading with nothing under it **renders as a stated gap**, not as absent — "we looked and found nothing" is information. Every entry carries one sentence of why it matters. The panel follows what the user is reviewing: reading the diagnosis shows the diagnosis's evidence. The full source list sits underneath, collapsed.

### 25.6 Documents and links — an evidence source, not context

**Store the extracted text, never the binary.** \~30KB per document; ten thousand users at fifty documents each is about 15GB and pennies a month. Storage is not the constraint — token cost and liability are. No video; images only where OCR yields text; a per-idea cap.

**Both files and URLs.** A link is fetched, extracted, stored as text with the link retained. Desktop-folder access is not available to a browser; not pursued.

**Never injected wholesale into a prompt.** On ingest, Lex runs the pass shape from §22: it reads the document and produces **findings** with provenance. The document becomes a per-idea evidence source, retrieved when relevant — so a fifty-page report costs nothing per turn and still surfaces its one useful paragraph at the right moment.

Liability: the user asserts they may share it; text is deleted with the idea (GDPR erasure); documents are private to the idea and its team.

### 25.7 Answer quality — six instructions for the method layer

Derived by reading the four models' answers against each other. These are what separated the best answer from the competent ones, and each is specifiable:

1.  **Build a causal chain, not an inventory** — and name the symptom of each broken link.
2.  **Find the counterintuitive result** and put it at the centre if it holds.
3.  **Cite the finding, not the citation** — the specific result, its author, and what it implies.
4.  **Reframe the instrument** if the user's chosen one is wrong, and say what the right one is.
5.  **End with a test the user can apply** — a single question that operationalises the analysis.
6.  **Propose the next action**, concretely.

### 25.8 The Lex / Search boundary

**Lex owns the questions and their timing. Search owns retrieval quality. The intent is the contract.**

-   The **interrogation library lives in Lex** — it is a product artefact, not infrastructure. Lex decides which question to ask, when, and how to present the answer.
-   **Search owns everything behind an intent** — routing, streams, fusion, ranking, and the gold set that proves it.
-   **New intents are proposed by Lex and implemented by Search**, who route and gold-test them. Nothing is adopted until the gold set rewards it.

**What we now need from Search, in order:**

1.  **Throughput.** A build fires 10–20 searches where a stage fired 1–2. `vector-serve`'s concurrency cap of 4 makes one user's build a self-inflicted denial of service. **S4 §3's batching stops being an optimisation and becomes a prerequisite.**
2.  **The Lex chat route's scope** (S4 §1). It is legislation-only, the router already names the right streams and the caller discards them, and no committee document, debate or judgment reaches a user on that route ever. Needs the second context channel S4 describes — authorised, then built.
3.  `LEX_TIER_FUSION` **on**, after confirming `LEX_QUERY_ROUTER` is on. +21.7pp recall, no query regressed, latency inside cache noise.
4.  **Four new intents** routed and gold-tested: `CASE_INTERPRETATION`, `LINEAGE`, `EXISTING_POWER`, `POSITION`.
5.  **The absent-instrument recall problem** — 17,261 instruments missing from the corpus. An ingest job that gates everything above.
6.  `POSITION` **depends on the people-graph** reaching `holds-position`, which the graph thread notes is what everything user-facing waits on.

### 25.9 Open decisions for Charlie

1.  **Build ceiling.** What is an acceptable wall-clock and token spend for one build? My recommendation: target 5–10 minutes, hard stop at 15, with the spend shown.
2.  **Rejecting the draft.** If the user disagrees with the whole diagnosis, do we re-run the build with their correction, or drop into field-by-field editing? Recommendation: re-run — it is the cheaper of the two and it is what the iteration is for.
3.  **Alternatives per fork.** Two, or three? Recommendation: two strong ones beats three where the third is filler; three only where the field genuinely has three live schools.
4.  **Direct editing.** The user can still edit any field directly at any time. Confirm — it is the escape hatch that keeps the whole thing honest.
5.  **Document liability.** Confirm the storage model in §25.6, and whether a size or count cap is wanted at launch.

### 25.10 Build sequencing

-   **25-A** — Page 1's four exchanges, the confirmation step, and the build harness (job, progress, incremental persistence, cost ceiling). Passes 1–2 only: a rough kernel, presented.
-   **25-B** — passes 3–5: the interrogation library, the revision loop, the adversarial read.
-   **25-C** — the review agenda UI, the forks-as-decisions mechanism, the re-run.
-   **25-D** — the RH panel reorganised by question; documents and links.

25-A is where the risk is: if a rough kernel drafted from four answers is not worth reviewing, nothing downstream saves it. Build it first and judge it before committing to the rest.

*(Design, for Charlie's review. The gap he named: we have built idea → proposal, and publication and scrutiny around it, but nothing for* **proposal → change***. §26 is that module. It sits after §20 (output and publication) and §24 (credibility), and it reuses §22's issues machinery and the position graph.)*

***

## 26. Advancement — from proposal to change

### 26.0 The insight this module rests on

**Getting a proposal adopted is itself a strategy problem, so it gets a kernel of its own.**

-   **Diagnosis:** why hasn't this already happened? Who benefits from the status quo, who would have to move, and what is the actual obstacle to adoption — as distinct from the obstacle to solving the problem, which Page 2 already answered.
-   **Guiding policy:** which route to change, and what that rules out.
-   **Coherent actions:** who to approach, with what ask, in what order.

That is not a metaphor for convenience. The two kernels are genuinely different and frequently point in different directions: the best *policy* may have the worst *route*, and a user who has proved the first without testing the second has done half the work. **§26 is where the proposal stops being an argument and becomes a campaign.**

⚠ **The failure mode this replaces:** "send this two-pager to your MP." Every lobbyist option Charlie was shown used an MP as a dead hand to raise a profile. That is not the ceiling — it is a failure of specificity, and §26.3 is the corrective.

### 26.1 The routes to change — legislation is one of five

Users arrive assuming "change the law." Often something cheaper works, and §25's instrument question should already have flagged it. The routes, roughly in ascending order of cost and difficulty:

| Route                     | What it means                          | Typical vehicle                                             |
|---------------------------|----------------------------------------|-------------------------------------------------------------|
| **Administrative**        | A body changes how it already operates | Internal policy, guidance, a published framework            |
| **Regulatory**            | A regulator changes its rules          | Handbook amendment, consultation, supervisory statement     |
| **Secondary legislation** | A Minister uses an existing power      | SI made under an existing Act — *no new Bill needed*        |
| **Primary legislation**   | New or amended Act                     | Government Bill, PMB, or an amendment to a Bill in progress |
| **Political / cultural**  | The terms of the debate change first   | Media, public opinion, party policy, manifesto commitment   |

⚠ **The single most valuable question in this whole module is asked before any of them:** *is there an existing power that already permits this?* If a Minister can act by regulation, the entire legislative route is unnecessary — and that is a corpus question (`EXISTING_POWER`, §25.4) that no general model can answer reliably.

### 26.2 Sequencing beats listing — the recruitment ladder

The menu matters less than the order. Approaching power before you have credibility is the commonest way a good proposal dies, because the first "no" is expensive and often final.

Four kinds of asset, each unlocking different asks:

1.  **Credibility** — subject experts who will say this is sound. Cheapest to get, and everything else is easier once you have it. A KC's review of the legal analysis (§24) *is* this asset.
2.  **Standing** — people whose name carries weight beyond the subject. Converts a proposal into something an office cannot ignore.
3.  **Reach** — media, public support, votes on the platform. Evidence that someone cares.
4.  **Power** — MPs, peers, ministers, party policy staff, regulators. The people who can actually move the thing.

**Readiness gates.** §26 should refuse — politely, with reasons — to generate an approach to power before the proposal can survive it. *"You can approach an MP with this today, but the costings have no basis and the strongest counter-argument is unanswered. Both are two hours' work. Fix them first; you get one first impression."* This is the §22 issues list pointed at a different question.

### 26.3 The MP question, in depth

### What an MP can actually do

| Instrument                                | What it achieves                                                                                               | Cost to the MP           | When it fits                                                                |
|-------------------------------------------|----------------------------------------------------------------------------------------------------------------|--------------------------|-----------------------------------------------------------------------------|
| **Written question**                      | Forces a departmental answer **onto the record** — creating a citable government position you can hold them to | Minutes                  | Always. The cheapest first ask there is, and it produces a durable artefact |
| **Letter to the minister**                | A written ministerial reply, also citable                                                                      | Low                      | Early; establishes the department's stated position                         |
| **Oral question / PMQ**                   | A minister must respond publicly                                                                               | Low, but a scarce slot   | When the profile matters more than the detail                               |
| **Westminster Hall / adjournment debate** | 30–90 minutes with a **compulsory ministerial response**                                                       | Moderate; ballot         | When you want the government's reasoning on the record at length            |
| **Select committee**                      | Put your question to a witness; press for an inquiry; shape terms of reference                                 | Low if they are a member | Where the committee owns the brief — check who does                         |
| **Ten Minute Rule Bill**                  | A text, a short debate, a marker                                                                               | Moderate                 | To establish a position and test support                                    |
| **Private Member's Bill**                 | A real chance of law, if high in the ballot                                                                    | High                     | Rarely available; wasted unless the drafting is ready                       |
| **Amendment to a Bill in progress**       | **The highest-probability route to actual statutory change**                                                   | Moderate                 | Only when a suitable Bill is live — see below                               |
| **Recruiting colleagues**                 | Converts one voice into a bloc                                                                                 | High, and personal       | Charlie's instinct, and the real bottleneck                                 |

### Amendments — the reality, and it is not what people assume

Charlie asked the right questions. What I can state with confidence:

-   **An amendment must be within the scope of the Bill.** You cannot attach an unrelated clause to a convenient vehicle. Scope is set by the Bill's content and its long title, and the Public Bill Office advises on admissibility. *Finding a Bill whose scope already covers your subject is therefore the binding constraint, not drafting the clause.*
-   **Stages differ.** Commons committee and report; Lords committee and report; then ping-pong.
-   **Non-government amendments rarely pass on a division in the Commons**, because the government has a majority. They pass more often in the Lords, which is why the Lords route matters disproportionately.
-   **And the crucial, counterintuitive point: most successful backbench amendments never pass.** They succeed by extracting a **ministerial commitment at the dispatch box** — a promise to review, to issue guidance, to bring forward the government's own version — and are then withdrawn. A "probing amendment" is tabled with no expectation of a vote, precisely to force that statement.

⚠ **That reframes the entire ask.** "Get my amendment passed" is usually the wrong objective. "Get a minister to say something specific on the record, which we can then hold them to" is achievable, and it is how most incremental change actually happens.

⚠ **What I do not know reliably and we should not fabricate:** how many sponsoring names materially change an amendment's prospects; the informal choreography of getting a government to adopt one; practical lead times for tabling; and which offices to approach and when. **This needs a practitioner — a former clerk, a parliamentary agent, or an MP's staffer.** The same treatment as the reading- legislation guide: draft it, publish it as a draft, and invite correction.

⚠ **And here the corpus can do something nobody else can.** We hold amendment texts, division records, committee stages and Hansard. *"Which non-government amendments to Bills of this kind succeeded in the last ten years, and what did they have in common?"* is a measurable question. That would replace folklore with evidence, and it is exactly the kind of finding that would make a user say nobody else could have shown them this.

### Which MP — and what we can actually know

Not guesswork. Most of the signals are data we hold or are building:

| Signal                             | Source                                       | What it tells you                                          |
|------------------------------------|----------------------------------------------|------------------------------------------------------------|
| Constituency interest              | Page 2's affected groups + constituency data | Whether the problem lands in their patch                   |
| Voting record on related divisions | **Position graph** (2.53M vote rows)         | Whether they have taken a position, and which              |
| Committee membership               | Committee corpus                             | Whether they can put your question to a witness            |
| Use of these instruments before    | Hansard, PMB and amendment records           | Whether they actually *use* the tools, or only speak       |
| Declared interests                 | Members' interests register                  | Expertise — or a conflict                                  |
| Frontbench or backbench            | MNIS                                         | **Frontbenchers cannot rebel**; backbenchers have latitude |
| APPG membership                    | APPG register                                | An existing coalition to join rather than build            |

⚠ **And one signal we do not have and should simply ask for: who does the user already know?** A warm introduction beats a perfectly-targeted cold approach every time. It is one question, and it belongs in §26's opening rather than in Page 1.

**What Lex should produce is a shortlist with reasons, not a ranking** — three or four names, each with what makes them plausible and what the risk is, and the user chooses. The same fork discipline as §25: recommendations with reasoning shown, decisions left to the user.

### 26.4 Beyond MPs

The same treatment for the other actors, each with its own asks and its own timing:

-   **Peers** — less party-bound, more amendment success, and the route where non-government changes actually land. Subject expertise is concentrated there.
-   **Subject experts** — endorsement, review (§24), and co-authorship of the technical case.
-   **Prestige figures** — standing, not detail. One name can change who returns a call.
-   **Media** — a specialist correspondent who owns the beat is worth more than general coverage.
-   **Regulators** — where the route is regulatory, the regulator is the target, not Parliament.
-   **Civil servants** — cannot be lobbied directly in the ordinary sense, but consultations are an open door and are frequently under-used.
-   **Party policy staff** — the route to a manifesto commitment; long lead times, tied to the cycle.
-   **The public** — votes and support on the platform (§20.3), which is the evidence an MP's office actually responds to.

### 26.5 The idea management console

A new surface on the idea, once it is published. Six panels:

1.  **Readiness** — what state the proposal is in, what is missing before it can be advanced, and which of those are quick. Derived from §22 issues and §24 evidence facts; not a new judgment.
2.  **Route** — the chosen route (§26.1) and the alternatives, recorded as a fork with its reasoning, revisitable when circumstances change.
3.  **Targets** — the people and organisations, each with why them, what we know about them, the ask, and a status. The shortlist from §26.3 lands here.
4.  **Asks** — what is being asked of each target, in what order, and what each unlocks. This is where sequencing becomes visible.
5.  **Windows** — the legislative and political calendar: live Bills whose scope fits, consultations open now with closing dates, committee inquiries taking evidence, fiscal events. **Time-bound and corpus-derived — a closing consultation is a deadline nobody else will tell them about.**
6.  **Activity** — what was sent, to whom, when, and what came back. The record that makes the campaign reviewable and lets a team share it.

### 26.6 What the corpus contributes here that nothing else can

Worth listing separately, because it is the argument for building this at all:

-   **Is there a live Bill whose scope this fits, and what stage is it at?** Converts "raise the profile" into "table this at report stage before 12 November."
-   **Is there an open consultation?** With its closing date.
-   **Which committee owns this brief, and is it taking evidence?**
-   **Who has voted which way on comparable measures?** (Position graph.)
-   **Which comparable amendments succeeded, and how?** (§26.3 — the measurable question.)
-   **What has the department already said on the record?** Written answers and ministerial statements are the government's stated position, and the most useful thing to hold them to.

### 26.7 Open questions for discussion

1.  **Is Advancement a second kernel, or a set of tools?** I have designed it as a kernel because the sequencing logic needs somewhere to live and Rumelt applies as cleanly here as to the policy itself — but it doubles the process, and some users will want the tools without the analysis.
2.  **How much does Lex recommend versus lay out?** Targeting an MP has political consequences the platform should be careful about owning. My instinct: shortlist with reasons, never a ranking, and never an approach drafted and sent without the user's hand on it.
3.  **Non-partisanship.** Scrutinise is non-partisan; advising *which MP to lobby* using voting records sits close to a line. Worth deciding the principle now rather than after the first complaint. My suggestion: the platform surfaces public-record facts and the user draws conclusions — it does not characterise anyone as sympathetic or hostile.
4.  **Where does this sit relative to Central?** Recruiting supporters overlaps with the community module, and the §20.7 boundary needs restating for campaigns.
5.  **The practitioner input** (§26.3) — who, and on what terms.

### 26.8 Build sequencing

-   **26-A** — the routes (§26.1) and the existing-power question, as a Guiding Policy fork. *Cheapest, highest value, and it can be built inside §25's flow rather than as a new surface.*
-   **26-B** — the windows panel: live Bills, open consultations, committee inquiries. Pure corpus, genuinely differentiating, no new judgment required.
-   **26-C** — targets and asks, with the position graph behind the shortlist. Gated on the graph reaching `holds-position`.
-   **26-D** — the console proper, readiness and activity.
-   **26-E** — the practitioner-reviewed guide to parliamentary instruments, on the reading-legislation model: published as a draft, corrected by people who have done it.
