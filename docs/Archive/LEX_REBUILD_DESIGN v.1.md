# Lex Rebuild — Design Document

**Status:** Draft for build. This is the authoritative spec for the Lex conversation layer.
Every future CC brief on Lex references this document. It is the Lex equivalent of `INGEST_PLAYBOOK.md`.

---

## 1. Why we are rebuilding

The old conversation layer had **no single source of truth for state**. "Where are we in the process"
lived in three places at once — the frontend, the database, and Lex's parsed output — and every bug we
chased was two of those three disagreeing (card reverting after accept, sidebar miscounting, stage
advancing early, Lex looping). We fixed collisions one at a time instead of removing the possibility of
collision, so each fix surfaced the next bug.

Three root causes, three fixes:

| Root cause | Fix |
|---|---|
| State lived in 3 places that could disagree | **One server-authoritative canonical state.** Frontend renders it and nothing else. |
| The LLM was inside the mechanical control loop (sequencing depended on Gemini emitting correct JSON in prose) | **Lex out of the loop.** Structured output with two separate channels; platform owns sequence. |
| Code sediment from 3 successive control regimes | **Clean state layer**, built from this contract, replacing the old one. |

---

## 2. Core principles (non-negotiable)

1. **Canonical state is server-authoritative.** There is exactly one source of truth: a state object the
   server computes and returns. The frontend never holds its own idea of progress — only a transient
   "pending" spinner while a request is in flight.
2. **Lex is never in the control loop.** Lex returns content; the platform decides sequence, completion,
   and when to search. A malformed Lex output is rejected and retried — it can never half-advance the state.
3. **Triggers are deterministic.** Platform code decides when to run a legislation search, not Lex.
4. **Panels are pure renderers.** Each panel displays a slice of canonical state. If the state is right,
   the panels are right — always. No panel computes its own progress.

---

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

**Rule that fixes the lingering card:** the confirmation surface is rendered if and only if
`field.status === AWAITING_CONFIRMATION`. On accept, the server flips the status to `ACCEPTED`, returns
the new canonical state, and the surface disappears because the state no longer says to show it. The next
question is the new `currentField`. No timers, no optimistic divergence, no orphaned UI.

The *surface* differs by field type (see §5 and §13): for the narrative boxes (The idea / You + The Idea /
About you) the **box itself** is the accept surface — a Lex proposal pre-fills the box marked "proposed",
and **Save** confirms it; for Title and Keywords (a row, no box) an **inline confirm** on the row is the
surface. The render rule is identical in both cases — it is a pure function of `status`.

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

`completedCount` and `total` are **derived on the client** from the fields array (count of `ACCEPTED`/`SKIPPED`
vs total) — never stored, never able to drift. The sidebar reads this and nothing else.

### 3.4 Write-ownership table

The whole point of the rebuild. Who is allowed to write each piece of state:

| State piece | Written by | NEVER written by |
|---|---|---|
| `currentField` / field sequence | Server (platform) | Lex, frontend |
| field `value` | Server, on user **accept** | Lex directly; frontend (pending-only) |
| field `proposal` | Lex, via schema-validated output | frontend |
| `stage` advance | Server, when all page fields are `ACCEPTED`/`SKIPPED` | Lex, frontend |
| `userProfile` | Server, from Lex-extracted + user-confirmed values | Lex freehand |
| `legislationRefs` / `initialBackground` | Server, from search results (stubbed for now) | Lex freehand |

---

## 4. Lex output contract

Lex returns **two separate channels** using Gemini's structured-output / function-calling mode (the model
is constrained to emit a fixed JSON shape, so we never parse data out of prose again):

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
1. Validate `proposal.value` against the target field's schema.
2. If valid → set that field to `AWAITING_CONFIRMATION` with the proposal attached.
3. If invalid/malformed → discard the proposal, keep `chatText`, retry once. **State never half-advances.**
4. `chatText` is always shown, regardless of proposal validity.

This is the single change that ends the prompt-sprint / UX-sprint interference: editing the prompt changes
only `chatText` quality, never the mechanics.

---

## 5. Panel render contracts

Three panels, each a pure renderer of a slice of canonical state.

| Panel | Renders | Source slice |
|---|---|---|
| **1 — Chat** | Message history + Lex's `chatText` + an **inline confirm** for a Title/Keywords proposal that is `AWAITING_CONFIRMATION` | messages + `currentField` |
| **2 — Fields** | All boxes/rows, statuses, values, "X of Y" per page; green tick on `ACCEPTED`. A narrative box that is `AWAITING_CONFIRMATION` renders Lex's **proposed text inside the box** (marked "proposed"); **Save** confirms — the box is the accept surface | `pages[]` |
| **3 — Legislation** | "Initial Background" briefing (top) + grouped source cards | `initialBackground` + `legislationRefs[]` |

Panel 2 becomes trivial: it loops over `pages[].fields[]` and renders status. Because the server owns
status, the sidebar cannot miscount.

---

## 6. Page 1 — Orientation

**Purpose:** gather context about the user and their problem so Lex can calibrate (adjust tone and depth)
and be the best possible guide. **No Kernel analysis happens here.**

### 6.1 The model: 3 input boxes → 3 generated outputs

The user sees **three free-text boxes** in the sidebar, not a long form. Each box has a **side hint list**
(see §6.4) showing what kind of information helps. The user writes as much or as little as they like; Lex
reads each box, spots gaps against the hint list, and gently prompts — **at most two nudges per box, then it
moves on** (not pushy). Behind each box Lex quietly extracts a few structured **slots** (labelled sub-values)
for calibration and reuse; these are not separate boxes the user fills.

**The three input boxes:**

| Box | Stored on | What it gathers | Slots Lex extracts behind it |
|---|---|---|---|
| **1 — The idea** | idea | Everything the user can tell us about what they want to change: the problem, how they frame it, who's affected, rough impact and cost — **only what the user can provide** (the rigorous, evidence-backed version is Page 2; whatever is volunteered here **carries forward to seed** Page 2's `whoAffectedImpactCost`, so Lex never re-asks). | `problemNarrative`, `currentFraming` |
| **2 — You + The Idea** | idea | The user's relationship to *this* idea: why it matters to them, what work they've already done or written, and what success looks like. *(uploads attach here)* | `motivation`, `priorWork`, `ideaGoal` *(change a law / a rule / pressure an institution / unsure)*, `uploads` |
| **3 — About you** | **user (profile)** | Who they are in general: experience in this area and in politics, career, resources/team, and what they want from Scrutinise. | `experienceLevel` *(the branch — novice / some / expert)*, `career`, `resources`, `legislativeKnowledge`, `politicalLevel`, `whatTheyWant` |

**Why this order:** Boxes 1 and 2 are about *this idea* and are fresh each time. Box 3 is about the *person*
and is **reused across every idea they ever create** — asked in full the first time, then shown on later ideas
as a skippable check-back ("here's what I know about you — anything to add?"). It sits **last on purpose**: on a
return visit Box 3 collapses out of the active flow, leaving the per-idea boxes as a stable 1 and 2 with **no
renumbering**. The branch (`experienceLevel`) is stored in Box 3 but Lex establishes it **early in the
conversation** — one light opening question — because it forks how deep Lex's prompting goes thereafter.

`politicalOrientation` (Left/Right × Global/Local coordinates + party) is an **optional** part of Box 3,
asked softly on a return visit, stored as `{x, y}` + `party` so a future drag-the-icon widget can populate it.
Not built now.

### 6.2 The three generated outputs

These are produced by Lex/the platform, not boxes the user fills:

| Output | Produced by | Notes |
|---|---|---|
| `title` | Lex proposes from Box 1 | User accepts/edits. |
| `keywords` | Lex proposes from all three boxes | User confirms/edits. Drives the search. Government department is **inferred** and included as one keyword among several — not asked as a question. |
| **Initial Background** (legislative first fetch + Lex summary) | Platform search + Lex | Fires when `keywords` is accepted (§8.4). Lands in panel 3. |

### 6.3 Flow

**First-time user:** Lex opens with one light question that establishes experience level (the branch — stored
in Box 3), then works Box 1 ("What do you want to change?"), nudging obvious gaps once or twice; then Box 2
("why does this matter to you, and what would success look like?"); then completes Box 3 ("a bit about you and
what you want from this"). Lex then proposes `title` + `keywords`; on confirm, the search fires and the Initial
Background appears.

**Returning user:** Box 3 collapses to a skippable check-back (profile already on file). Boxes 1 and 2 are
fresh, in stable positions. Title / keywords / search as above.

### 6.4 Side hint lists (shown beside each box)

Plain prompts so the user knows what helps, without it being a form. Lex uses the same lists as its gap
checklist.

- **The idea:** what you want to change · the problem as you see it · who's affected · rough scale or impact ·
  any costs you know of.
- **You + The Idea:** why it matters to you · anything you've already done, written, or researched
  (you can upload it) · what success would look like.
- **About you:** who you are · your experience in this area · your experience in politics generally · your
  career · whether you have a team or resources · what you're hoping Scrutinise can do for you.

---

## 7. Page 2 — Diagnosis

**Purpose:** name the pivotal obstacle. Per Rumelt, a good diagnosis simplifies a messy reality, identifies
what is critical, and explains why the problem has resisted solution. We capture **two distinct things** that
were being conflated:

- **Root cause** — the main driver of the *problem* (why it happens).
- **Pivotal obstacle** — the main thing blocking a *solution* (why it persists). May or may not be one of
  the causes; could be enforcement difficulty, vested interest, cost, or political will. **This is the thing
  the Guiding Policy must defeat**, and it is the anchor for Page 3.

### 7.1 Fields

| # | Field key | Type | Notes |
|---|---|---|---|
| 1 | `challenge` | text | One-sentence problem statement. |
| 2 | `whoAffectedImpactCost` | structured | Merged. Slots: `affectedGroups[]` (kept separately visible — it is the MP/constituency hook), `impact`, `cost`, `evidence`. Evidence nudge here. |
| 3 | `causes` | **loop / child entity** | Each `DiagnosisCause` record: `cause`, `whyPersisted`, `evidence`. Lex seeds candidates from the corpus ("this has been examined before — here are five causes others identified; what do you make of them, and what would you add?"). User selects/edits/adds. |
| 4 | `rootCause` | reference | The user names the main driver of the problem from the loop. |
| 5 | `legalLandscape` | structured | What law currently governs this and where it fails. Placed **before** `pivotalObstacle` because knowing the existing law usually reveals the real obstacle (e.g. "it's already illegal, so the obstacle is enforcement, not law"). *Flagged: if you'd rather it sit elsewhere, easy to move.* |
| 6 | `pivotalObstacle` | text | The critical thing blocking a solution. Distinct from `rootCause`. Rumelt's named obstacle. |
| 7 | → `summaryDiagnosis` | Lex-generated | Names **both** the root cause and the pivotal obstacle; becomes the anchor Page 3 links back to. |

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

---

## 8. Legislation panel & Initial Background

### 8.1 Panel structure

1. **Initial Background** (top) — a prose briefing written by Lex: what law governs the area, key points and
   people from past debates, relevant select committees, threads worth pulling. The "shockingly impressive"
   artifact. The chat carries only a one-line pointer; the report lives in the panel.
2. **Grouped source cards** (below) — the corpus items, capped ~20, **2–3 per category**: primary legislation
   (Acts), secondary legislation (Statutory Instruments), debates (Hansard), committee reports, case law
   (later). Each card links out to legislation.gov.uk or the corpus item.

### 8.2 Initial Background as a document

The briefing is a **generated document record on the idea** (Word + PDF), so it:
- renders and is downloadable in the legislation panel, AND
- appears in the idea's **Documents/Exports tab** (which lives outside these three panels).

`Document { id, ideaId, kind: "INITIAL_BACKGROUND", docxUrl, pdfUrl, status }`.

### 8.3 Search dependency and the FTS contract (important)

FTS (full-text search: keyword matching across stored corpus text) is being built in the parallel workstream.
The load phase is complete (16.5M rows); the index build is being shipped with `withPosition: false` for v1 —
meaning **BM25 term ranking** (matches and ranks on the presence of the query terms) **without exact-phrase
ranking**. That is fine for this use case: the first fetch is keyword/term retrieval, and Lex grounds its
briefing on the returned sections regardless. Phrase positions can be rebuilt later if needed; **no change to
the contract below** — `score` is simply a BM25 score.

To keep the two workstreams decoupled, the platform and FTS agree one **interface** (the fixed shape of data
passing between them). Query in / results out:

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

- Build panel 3 as a **pure renderer** of `legislationRefs[]` + `initialBackground`.
- Feed it **stub data shaped exactly as `SearchResult[]`** so swapping stub → real FTS is a one-line source change.
- The server groups results by `type`, takes 2–3 per type, caps ~20.
- Wire the real FTS query endpoint the moment it lands — only the data source changes; the renderer does not.

### 8.4 Search trigger

**Deterministic, platform-owned.** When the user accepts `keywords` at the end of Page 1, the server fires the
search (stubbed now), populates `legislationRefs` + `initialBackground`, and Lex posts the one-line pointer.
Lex never decides whether to search.

---

## 9. Migration of old data

Three test users, no meaningful data. **No deprecated-fields UI.** A one-off script copies any content from
removed fields into the new `ideaContext` free narrative, tagged `[migrated: <oldFieldName>]`. Done.

---

## 10. FAQ copy — "What is a Guiding Policy?"

*(Public-facing. Insert verbatim into the FAQ.)*

**The Guiding Policy is the bridge between understanding a problem and acting on it.** Most proposals jump
straight from "here's the problem" to "here's my list of things to do," with no stated logic connecting the
two — which is why they fall apart under questioning. The Guiding Policy is that logic: the overall approach
you've chosen to overcome the specific obstacle your diagnosis identified. It's a direction, not yet a set of
actions. Done well, it makes your actions feel obvious; without it, they look arbitrary.

**Why "what it rules out" matters.** A good approach is as much about what you are *not* doing as what you are.
An approach compatible with every possible action isn't a strategy — it's a wish. Naming the alternatives you're
deliberately setting aside, and why each conflicts with your approach, is what proves your proposal is focused.

**Why you list alternatives.** Every serious problem has a standard toolkit of responses — a ban, a tax, an
information requirement, a subsidy, a voluntary code. A strong proposal shows it considered them, makes the
genuine case for each, and explains why the chosen approach beats them for *this* problem. This is exactly what
a parliamentary committee will ask — doing it first is what makes a proposal scrutiny-proof.

**Conditions for success — "what has to be true?"** Every policy rests on assumptions about how the real world
will respond. Naming them is what separates a serious proposal from a hopeful one, because each assumption is
something that can be tested, defended, or designed around. Ask: what are you betting on for this to work, and
what would have to be true?

---

## 11. Build sequencing

Design the whole flow once (this document); build incrementally.

- **Sprint 1 (this brief):** state layer + Page 1 + all three panels rendering canonical state (panel 3 on
  stub data). Prove the mechanics end-to-end on the simplest page.
- **Sprint 2:** Page 2 (Diagnosis), including the `DiagnosisCause` loop and corpus-seeding (seeding stubbed
  until search lands).
- **Sprint 3:** wire real FTS into the search trigger and panel 3.
- **Later:** Page 3 (Guiding Policy — its own design pass), Page 4 (Coherent Actions migration), the political
  orientation widget.

---

## 12. CC Brief — Sprint 1: state layer + Page 1 + panels

**Goal:** replace the old conversation state layer with the server-authoritative canonical-state model in §3,
deliver Page 1 (§6), and render all three panels (§5) from canonical state with panel 3 on stub data.

**Why (the reasoning behind this sprint):** the old layer permitted three sources of state to disagree, which
is the root cause of every UX bug to date. This sprint removes that possibility. We build Page 1 + panels first
(not the whole flow) to prove the mechanics on the simplest page before layering Pages 2–4 in as data.

**Tasks:**

1. **Canonical state endpoint.** Implement `GET /api/ideas/{id}/state` returning the object in §3.3. This is
   the single source of truth. *Endpoint/field naming may be refined by CC provided the §2 principles and §3.4
   ownership table hold exactly.*

2. **Field state machine (§3.2).** Implement the five field statuses and transitions server-side. The
   confirmation card must render iff `status === AWAITING_CONFIRMATION`.
   `// The card is a pure function of server state — never a timer or local flag (was the root cause of the
   20s revert bug).`

3. **Lex structured output (§4).** Switch Lex to Gemini structured-output mode returning `{chatText, proposal,
   extracted}`. Validate `proposal.value` server-side against the field schema; on failure, keep `chatText`,
   discard the proposal, retry once.
   `// Lex must never be able to half-advance state — this is what takes the LLM out of the control loop.`

4. **Deterministic sequence + stage advance (§3.4).** Server sets `currentField` and advances `stage` only when
   all of a page's fields are ACCEPTED/SKIPPED. Lex and the frontend never write sequence or stage.

5. **Page 1 fields (§6).** Create profile fields on the user and idea-context fields on the idea. Implement the
   first-time vs returning-user question hierarchy (§6.3). `governmentArea` is inferred + confirmed, not asked.

6. **Three panels as pure renderers (§5).** Rebuild panels to render only from canonical state. Panel 2 derives
   "X of Y" from the fields array — never a stored counter. Panel 3 renders `initialBackground` + grouped
   `legislationRefs[]` from **stub data** (provide a realistic sample for one idea).

7. **Stub the search trigger (§8.4).** On `keywords` accept, populate `legislationRefs` + `initialBackground`
   from stub data and post Lex's one-line pointer. `// Real FTS wires in Sprint 3 — only the data source changes.`

8. **Migration script (§9).** One-off: copy removed-field content into `ideaContext` tagged `[migrated: …]`.

**Acceptance criteria:**
- The accept card appears when a field is awaiting confirmation and disappears immediately on accept — no
  revert, no timer, no lingering question.
- Panel 2 lists every Page 1 field with correct status and an accurate "X of Y"; green tick on accept.
- Panel 3 shows a stub Initial Background briefing + grouped source cards.
- A returning user is not re-asked profile questions; they get the profile check-back instead.
- Editing the Lex prompt changes only `chatText`; it cannot break sequencing or the panels.
- Frontend holds no independent progress state beyond an in-flight spinner.

**Git discipline:** no git calls during the sprint. Generate one `commit-all.sh` at the end; Charlie approves on
the Vercel preview; CC executes once and deletes the script. Commit to `Main`.

---

## 13. CC Brief — Sprint 1.1: wire Lex to the field machine (orchestration fix)

**Goal:** connect Lex's conversation to the field machine. Sprint 1 built both but never wired them together,
so the flow stalls.

**Why:** the state foundation works — direct entry into a box writes field state, ticks appear, "X of Y"
counts, panels render from canonical state. Three faults remain, all in the orchestration layer (the logic
that decides "whose turn is it and what happens next"), which was never built. This is a fix on the
**un-promoted preview**: do **NOT** promote to production or run the §9 migration until the flow completes
end-to-end (acceptance criteria below).

**Confirmed interaction model — the contract for this sprint** (revises §3.2/§5; both updated):

- A narrative box (The idea / You + The Idea / About you) has **two input paths, both writing through the
  server to `IdeaFieldState`:**
  - **Form:** user types in the box + **Save** → field `ACCEPTED`. Lex gives a one-line acknowledgement and
    the flow moves to the next box.
  - **Chat:** user answers in chat → Lex tidies the answer into that box's content and sets the field
    `AWAITING_CONFIRMATION` with the tidied text as the `proposal` → the **box renders the proposed text**
    (marked "proposed") → user edits and/or **Save**s to accept.
- The **box is the single accept surface** for narrative fields. No separate accept-card in chat for them.
- Lex converses to help and nudges gaps **at most twice per box**, then moves on.
- **Title** and **Keywords** (a row, no box): Lex proposes once the three boxes are terminal → **inline
  confirm** on the row. On **Keywords** accept: fire the stub search, populate Background, advance stage to
  Diagnosis.

### Task 1 — Diagnose Fault 1 before changing code (bytes-before-hypotheses)

Lex currently emits no `proposal`, so chat answers never reach the boxes. **Log Lex's raw structured-output
response on a chat turn** and check whether a `proposal` is present:

- **No `proposal` in the output** → prompt problem: the system prompt isn't telling Lex (a) which field is
  current and (b) to produce a proposal for it. Fix in Task 2.
- **`proposal` present but field doesn't update** → wiring problem: the lex route isn't persisting it (not
  calling `setProposal`). Fix in Task 2.

Report which it is, then proceed — don't stop for a round-trip; fix whichever it is.

### Task 2 — Make chat answers populate the current box

The lex route must pass Lex the **current field** (key, label, hints) and instruct Lex to: respond
conversationally **and**, when the user's message holds enough to fill the current box, return a `proposal`
whose `value` is a tidied version of the user's words for that field. On a valid proposal the server sets the
field `AWAITING_CONFIRMATION`; the box renders the proposed text. (Per §4 — a malformed proposal is discarded
and `chatText` is still shown; Lex can never half-advance state.)

### Task 3 — The orchestration step ("what next" after every field write)

Add **one server function**, called after any field transition (form Save, chat-accept, skip), that decides
the next action and reflects it in the canonical state. It owns sequence (per §3.4 — server, not Lex, not
frontend):

- Current box just became terminal (`ACCEPTED`/`SKIPPED`) and another box remains → set `currentField` to
  the next box; Lex posts a one-line acknowledgement + the next box's question.
- All three boxes terminal and `title` empty → Lex proposes **Title** (inline confirm).
- `title` terminal and `keywords` empty → Lex proposes **Keywords** (inline confirm).
- `keywords` just accepted → fire the existing `fireSearchTrigger` (stub), populate `legislationRefs` +
  Initial Background, post Lex's one-line pointer, advance `stage` to `DIAGNOSIS`.

This is the conductor that was missing. Every write must produce a next step — no path may leave the flow
idle.

### Task 4 — Lex acknowledgement on direct form Save

When a box is saved directly (no chat), Task 3 still triggers a **brief** Lex acknowledgement + the next
question, so the chat stays alive. Keep it to one sentence.

### Task 5 — Intro copy (first idea vs returning)

A user's **first** idea opens with the full introduction, then — as a **separate bubble immediately after** —
the first question. Verbatim:

> I'm here to help you develop and build support for a credible proposal for your idea, ready for
> Parliamentary colleagues. There are three panels here: this is the chat, where you can use me to help you
> develop your proposal; next to it is the proposal itself as you build it; and last is the legislative panel,
> where we'll place relevant legislation for review once we have enough information to source data that's
> helpful. You can answer the questions here in the chat, or type directly into the form in the second panel
> if you don't need my help.

Separate bubble:

> What's the problem or challenge you want to address?

Returning users keep the existing short returning-user intro. **Fix the name:** it currently renders
"Charles" — use the user's actual first name.

### Acceptance criteria

- Answering **in chat** fills the matching box as proposed text, which the user can edit and Save.
- Saving a box **directly** produces a one-line Lex acknowledgement and the next box's question.
- After all three boxes, Lex proposes a **Title**, then **Keywords**, each confirmable inline.
- Confirming **Keywords** fills the Background panel (stub) and unlocks **Diagnosis**.
- A user's **first** idea shows the full intro + a separate first-question bubble; the user's name is correct.
- **No stalls:** every field write produces a next step.

**Git discipline:** no git during the sprint; one `commit-all.sh` at the end; Charlie validates on the
preview; CC runs it once and deletes it; commit to `Main`. Do **NOT** promote to production or run the §9
migration until all acceptance criteria pass.
