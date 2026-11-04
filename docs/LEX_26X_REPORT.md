# LEX 26-X — REPORT

## X1 — built 4 Nov 2026 (CCh-Lex 4 Nov (2): go on X1 with the three recommendations)

**The lifecycle bar (§2, 316).** `StageBar` shows the seven stages — Creation · Development · Private Scrutiny · Public Scrutiny ·
Promotion · Submission · In Force — each with one state line from the data (`lib/lex/stage-context.ts`): Creation "Lex’s first pass ·
N runs"; Development "Organising N actions · N drafted · N accepted"; Private / Public Scrutiny and Promotion "not yet open";
Submission "not submitted" (nothing records a submission yet — 2b's recording is not built); In Force "not yet available". The current
one: ● + "You are here" + a dark fill + a 2px border.

**§2c — strings changed: 17 on screen and in documents**, plus Lex's prompt. SEVEN_STAGES: 2 renamed (Creation, Development), 1 removed
(The Deepening, now inside Development), 1 added (Promotion, not yet available), Development's line rewritten; the workspace screens
(`LEX_STAGES`): 2 names, 2 purpose lines; the bar's "Stage N of 3" line removed (§3c); the review-status note (Stage 4/5 → 3/4); FAQ: 3
(the Stage-2 heading, "Stages 1, 2 and 3", a new paragraph on the checklist and Submission); "How this works" (1), the re-run banner (1),
the create page's intro (1). Decision 135 amended in `stageFromProgress`: a built idea is Stage 2 whether deepened or not. **Historic
documents:** their rendered files are stored in R2 and served until regenerated, so they keep the banner they were printed with — by
construction, not read back (check:lex-26x reports it NOT RUN). The "Stage 2/3/4" words for `Idea.stage` (the platform's
Create…Legislate ladder) are a different scheme and were not touched.

**The Development checklist and the lock (§3, 317).** Seven lines under the bar, each with its state in words and a shape (●/◐/○/🔒),
each a link: `section=problem|causes|policy` opens that kernel section, `view=organising|drafting` opens the Coherent Actions section on
that page, the Deepening's line opens the Deepening. The lock: `DeepeningGate` on the Deepening screen shows only the count and the
actions still to go (each a link to `/ideas/[id]/drafting#N`) and mounts nothing else; the pass route refuses with 423 in words, before
anything is claimed. **"Live" for the lock = live and not in Later phase** — a parked action is set aside for a later phase; the count
says how many are parked, so nothing is hidden. The owner's override ("Deepen now", a reason up to 600 characters with its counter) is
**appended** to `Idea.deepenOverride` (never replacing one), shown on the Deepening page, and printed in the stage banner of every
document generated while it is in force — "Deepened with N actions undrafted — reason: …". Once Drafting reads 0 to go the line is no
longer printed.

**Schema — one column, applied first, committed with the code that reads it.** `Idea.deepenOverride jsonb` (`prisma/lex_26x_deepen_override.sql`,
applied to Neon `ep-old-dust-aboxi69a` after `whichdb`). ⚠ **"Needs no draft" needs NO column, and I did not add one:** it already
exists as the "needs a document" override, mode `nothing`, with its reason, author and time (`LexCoherentAction.record.documentNeeds`,
`setNeeds`) — the tree's "Needs no document" writes it. A second store would be two answers to one question. The Drafting record's
"Needs no draft, because…" (300 characters, counter) writes the same op. **For CCh:** `entity_list_v5.md` is CCh-only and does not yet
list `Idea.deepenOverride`.

**Organising (§4, 308).** Step 1's tools, and only those: List · Board · Coverage grid · Conditions, grouping, headings (rename, kind,
hide, retire), Classify with Lex, Find duplicates, Re-sort, Consolidate, Test against the policy, Suggest headings, Import, the find box,
the bulk bar, Rule out, Later phase, Print all. Every row carries the progress strip. No drafting control ("Draft all legislative
actions" moved to Drafting). The step tabs and per-step toolbars are gone and `ActionsSteps.tsx` is deleted; `Idea.actionsStep` is kept,
untouched and no longer read — `proposeFacets` now defaults to step 1 rather than the stored step (an idea last left on step 2 would
otherwise have had Organising's "Classify with Lex" refused).

**Drafting and the flip (§5a–b, 318).** The same list by heading, counts at the top ("57 actions: 0 accepted · 0 need no draft · 57 to
go" on 452c5ade), filters with counts (all · to brief · to draft · to review · to accept · needs no draft · accepted), a strip on every
row. Opening a row opens the record with "← Back to Organising" at its top and the Drafts section open above the statement. From
Organising a title (or "Open") flips to Drafting with that action open; Back returns to the same scroll position, and the find box,
filters and grouping survive because the one workspace stays mounted. The page is in the URL (`view=`, `#N`); `/ideas/[id]/drafting#N`
and `/ideas/[id]/organising` redirect into it.

**The progress strip (§5f, 310) — moved into X1** (both pages show it). Derived from the documents tree in `lib/lex/action-progress-pure.ts`,
never stored: Defined (statement + heading + the heading's kind — CCh item 3) → Briefed → Drafted → Reviewed (all five passes on the
current version) → Accepted (at the current version; ◐ when accepted earlier and changed since). Companions (collision report,
explanatory note, schedule) are never the draft; a costing is the draft only of a financial action. ⚠ **Briefed, until X2:** the only
Brief that exists is a draft clause's drafting instruction, so other kinds read ○ there — said in the field guide's entry.

**CCh item 1:** "Who, how and against" stays a section of the record (with Costs and Order). **What left with the step tabs and has no
home until X3:** step 2's bulk "Classify with Lex" for the seven answers (per-action "Ask Lex" stays), the "By who" incentive map, and
step 4's "The order, derived" view and order classification (each record's Order section still sets it). The data is untouched.

**Lex.** The four-step rule in the prompt and the snapshot is replaced by the two pages, the strip and the lock; the seven stages and the
checklist are in the prompt from the label table; the controls list drops the four step labels and adds Organising, Drafting, Open,
← Back to Organising, Needs no draft because…, Deepen now. **Labels:** every new word is in `screen-labels.ts`, and the field guide has
an entry for each (seven new tables, typed so a label without an entry does not compile).

**Checks.** `check:lex-26x` (new) — see the closing line in CHANGE_LOG for the counts. Moved assertions, each with the reversal written
above it: 25k (2), 26h (9), 26p (1), 26s2 (part C and the step-2/3/4 renders), 26s2-structure (2, one of which read its words from a
comment), 26v1b (the record order and the closed-sections rule). ⚠ Pre-existing, not 26-X: 26s2's "the form's words … no cost,
because…" was red at HEAD since 26-W-b (fixed: it reads `RECORD_UI.noCostOpen` now); 26s2's "no ledger row since 29 Sep belongs to a
deleted idea and lacks a purpose" is a data finding, red before this sprint's code ran, reported and not touched. Also moved after the
addendum: 26s (the import label prints through `ORGANISING_TOOLBAR_UI`), 26s-browser (a record opens on Drafting — the check now clicks the
title and flips, as a user does; the heading box opens on press; Hide all is Organising's and absent on Drafting; the Drafts section
opens), verify-lex-26q-ui (the counted title button, Accept / Not this).

### Addendum 1 (321–323) — built into X1 (CCh-Lex 4 Nov (3))

**321 — the Organising toolbar is three labelled rows.** View (List · Board · Coverage grid · Conditions · Group · Hide all / Show all ·
the find box · Show) · Add (**Add action** and **Add heading**, both filled; the heading name box opens on press · Suggest headings ·
Import actions from a document, moved up from above the list) · Lex and checks (Title them with Lex · Accept all N proposed titles ·
Classify with Lex · Find duplicates · Re-sort · Test against the policy · Ask four models · Ask Lex to propose kinds · Check for gaps,
moved down from its own box · Print all). Import and Check for gaps are the real components, passed in as the toolbar's slots
(`inline`); Check for gaps' findings open as a full-width panel under the row only once there is something to show. Every label is in
`screen-labels.ts` (`ORGANISING_TOOLBAR_UI`, `ADD_ACTION_UI`; four words that were written in their components moved there too), and
the field guide says which row each control is on.

**322 — "Add action".** A focused dialog (§32): Title (required, counter) · Statement (optional, 1,000, counter) · Heading (the idea's
headings, default Unsorted) · the kind shown from the heading, not chosen. Route op `addAction` → `addActionAtHeading` → field-machine's
**`addAction`, the one writer** (the import, the gap check and Lex's `add_action` already called it). Source USER; the number is the
trigger's; it lands **first under its heading** (`place: 'topOfHeading'`: the rows at and after that position move down one, in one
transaction, so the rest of the list keeps its order); the page flips to Drafting with it open. Lex's `add_action` gained `title` and
`heading` (an existing heading's name — a name the idea does not have is refused, listing the real ones; it never creates one) and
places the same way. ⚠ **Two things decided, not in the brief:** (a) the title limit is the existing `LIMITS.actionTitle` = **110**,
not the addendum's 120 — one limit for every title box; say if it should be 120 everywhere. (b) "Defined ◐" for a new action needed
the strip's rule widened: ◐ is now *begun but not all three* (a statement, a title or a heading) — before, a statement alone read ○.
The record's empty Brief ("write the Brief, or ask Lex to prefill it") is X2's: the Brief does not exist yet.

**323 — no unexplained count.** "Title these for me (4)" → **"4 actions have no title · Title them with Lex — about 1.7p"** (the price
is the mean of the four `actions.titles` runs in the ledger, n=4; it asks only about untitled rows with no proposal waiting). Pressing
it applies a new **Untitled** filter, so the N are on screen. A waiting proposal shows on its row under the statement: "Lex proposes:
*…* — Accept · Not this". **"Accept all N proposed titles"** appears only while proposals wait. **A title the owner wrote is never
replaced:** `acceptTitleProposals` now skips a row that has a title (its stale proposal is cleared and counted, `keptYours`) — before,
accept-all overwrote it. "Test against the policy (N untested)" also applies its filter (Unreviewed).

**Found while running the checks, fixed:** an action opened on Drafting under a **hidden heading** was not drawn at all — so a deep
link, a flip, or a new "Add action" row under a hidden heading opened nothing (26v1b's two #202 failures: "Primary legislation" is
hidden on 452c5ade). An opened action is now drawn under a hidden heading; the rest stay hidden and counted ("Hidden — 2 more actions
not shown"). Asserted in check:lex-26x part D with a control.

**Checks for the addendum** (check:lex-26x parts F and F2): F on a scratch copy through the real route — refusals in words, USER,
title, heading, trigger number, first under its heading, everyone else's order kept, "Defined ◐"; Lex's `add_action` stores the same
(parity) and refuses an unknown heading; an owner's title survives accept-all, with a mutation control. F2 in Chromium on the 26-S
harness — the three rows in order with their controls, Check for gaps not on the Add row (control), the filled primaries, the heading
box on press, the counted title button and its filter, the proposal on its row, the stale one not offered, "Accept all" present only
while one waits (control), the Add action form, and the new row first under its heading and open on Drafting.

**Not done in X1:** the flip's scroll restore (§8 item 3) is asserted statically, not measured in a browser; the real-browser walk is
§9's (Charlie's screen).

## §0 Sizing and the split (4 Nov 2026, before any build)

Read: BRIEF_26X; `lib/lex/stages.ts`, `components/lex/StageBar.tsx`, `lib/documents/stage-banner.ts`,
`lib/lex/action-steps.ts`, `components/lex/ActionsSteps.tsx`, the `ActionDocument` / `ActionDocumentVersion` /
`DocumentReview` / `LexCoherentAction` models, `lib/lex/document-view.ts`. Nothing built.

### What already exists (so the parts are smaller or different than the brief assumes)

- **A seven-stage list already exists** — `SEVEN_STAGES` in `stage-banner.ts` (26-H), printed on documents: First Pass ·
  First Draft · Deepening · Private Scrutiny · Public Scrutiny · Submission · In Force. 316 renames it to Creation ·
  Development · Private Scrutiny · Public Scrutiny · **Promotion (new)** · Submission · In Force. The workspace bar
  (`LEX_STAGES`, 3 stages, "Stage N of 3") is a separate list; X1 makes the bar read the seven, so there is one list.
- **The 26-U instruction is not a separate store.** It is `ActionDocumentVersion.payload` on `DRAFT_CLAUSE` documents
  (`document-view.ts` `instructionOf`), and the law rows point at its versions via `source_detail "<action> v<n>"`.
- **Review state is derivable:** `DocumentReview(documentId, v, passKey)` gives "all five passes read the current version".
  Accepted is `ActionDocument.status/acceptedV`. So the strip's Drafted / Reviewed / Accepted need no new storage.

### Proposed split

**X1** — §2 lifecycle bar (seven stages, state lines; banner + FAQ text renamed, count reported; historic documents
untouched) · §3 Development checklist, lock, override · §4 Organising page (step tabs and per-step toolbars removed,
data untouched) · §5a–b Drafting page + the flip (`/ideas/[id]/drafting#38`, back to the same scroll and filters) ·
**§5f the progress strip moved into X1**, because §4b and §5a both render it.
- Schema in X1 (with the code that reads it, pushed as a pair): the **override** (reason, by, at — on `Idea`) and
  **"needs no draft, because…"** (reason ≤300, by, at — on `LexCoherentAction`), since the lock and the Drafting
  filters count it.
- Until X2, *Briefed* derives from "a DRAFT_CLAUSE instruction version exists, or needs no draft"; X2 switches it to the
  Brief. Said on the strip's guide entry, not hidden.

**X2** — §5c record order and "Draft it" between Brief and Draft · §5d the Brief (common + per-kind fields, Lex prefill
as a proposal, versions, "Brief changed since this draft") · the 26-U migration (count + text equal before/after) ·
§5e #207 split as a proposal, plus the `instrumentLike` sweep of 452c5ade · companions (313).

**X3** — §6 the Deepening page (collision, digest over drafts with re-measured price, passes, coherence, cost roll-up,
"Who delivers and who resists") · §6b policy test over drafts · §7 renames (300, the remaining "Document(s)" labels, the
guide), count reported.

### Three things for CCh to decide before X1 (my recommendation first)

1. **The step-2 slots would have no editor between X1 and X3.** §4c removes the step tabs in X1; §6a gives
   who/how/against its new home in X3. Costs and Order stay as record sections (308), but the seven step-2 slots are
   edited only from step 2's opened-record sections today. **Recommend: keep "Who, how and against" as a record section
   until X3 moves it**, then remove it from the band (§5c's last line) in X3 rather than X2.
2. **Where the Brief is stored.** §5d says `ActionDocument.brief`. A column cannot hold "every save is a version", and a
   Brief exists *before* any draft, when the action may have no `ActionDocument` row. **Recommend: Brief versions as
   `ActionDocumentVersion` rows with a new role `BRIEF`** (append-only, like VERSION/PROPOSAL; Lex's prefill a PROPOSAL
   beside it), on the action's instrument document, created at first Brief save with a new status `BRIEFED` (CHECK
   widened). The 26-U payloads then migrate as BRIEF v1..vn with text compared. Same "no second store", versions native.
3. **"Defined" needs a *kind*.** Statement and heading are on the action; "kind" I read as the heading's kind (§4a's
   "headings … kind"). Confirm, or name the field.

### Not checked yet (said, not skipped)

- How many 452c5ade actions hold more than one instrument (313 "one per action") — measured at the start of X2.
- The FAQ's stage text location and the banner-string count — measured in X1 and reported there.
