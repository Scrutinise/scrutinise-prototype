# BRIEF 26-S2 — LEX: the Coherent Actions screen in steps; Who, how and against; the import fix; one source list

**From CCh-Lex, 17 October 2026.** Replaces §4, the rest of §5, and §7 of BRIEF_26S. Decisions 166–176 (register at §1). Built on 26-Q (the workspace), 26-S1 (the import pass, policy review, heading purpose) and Charlie's browser pass of 16–17 October.

---

## §0 Run mode

- Continuous: diagnose → CHANGE_LOG → proceed. Batch the report (`docs/LEX_26S2_REPORT.md`). Stop only for spend, scope, or the one sign-off in §2.
- CLAUDE.md §25–§30 apply. Cold reads. Anything that writes gets one full run, including the write, on a scratch idea before it is reported done. Charlie's screen is the last check. `check:prompt-examples` before done.
- **Order:** §10 (the import fix) first — it blocks Charlie's first real import. Then §2 (the field-mapping report, stop for sign-off). Then §3–§9 and §11. Report size before building §3–§9; if it is two sprints, split at the end of §4 and say so.
- **The design rule this sprint introduces, for CLAUDE.md:** *The screen shows only the tools for the step the user is on. Everything else waits, reachable but out of the way.* Why: 26-Q put fourteen tools and six facets on one screen; Charlie's words on 17 Oct were "the dashboard of a fighter jet". A user sorting fifty actions cannot also be asked who implements each, what it costs and what comes before what.

---

## §1 Decisions recorded in this brief

| # | Decision | Where |
|---|---|---|
| 166 | The Coherent Actions screen works in four steps — **Sort and prune → Who, how and against → Costs → Order** — each with its own intro, tools and advisory checklist; free movement between steps; Who before Costs (you cannot cost an action until you know who does it and how) | §3–§7 |
| 167 | "Link" (the policy-link facet) retired from the screen; the column stays | §4 |
| 168 | Standing rule, CLAUDE.md §30: every bounded input shows its limit and the count left and stops at the limit; nothing fails silently; a refusal reads "Not saved: ‹reason›" with OK. *Never make the customer wrong.* | §4, §12 |
| 169 | Provenance off the verdict line, into the record's sources | §4 (if not already done from the 17 Oct paste) |
| 170 | Untested rows read "? Not tested" and offer "Test against the policy" | §4 |
| 171 | "Notebook · N notes" beside "Sources" | §9 |
| 172 | A clean action (file research, import, feedback) opens as a focused dialog: everything else dimmed, the file control obvious, one Save | §9 |
| 173 | One source list: "Your material" folds into "Sources"; each card has Open and Set aside; "Remove" goes; the undated/no-figures caveat shown once per card, in short form | §9 |
| 174 | The import pass re-chunks itself on truncation, keeps the parts that succeeded, retries one part, and never tells the user to "raise the budget" | §10 |
| 175 | `removeCause` archives instead of deleting; a cause number is never reused (the rule actions and sources already have) | §11 |
| 176 | Engineering spend (measurement runs, check scripts) is tagged by purpose at the call site so the ledger separates product spend from engineering spend | §11 |
| — | "Friction" is renamed **"Against"** (what will oppose it — strikes, gaming, legal challenge, delay). Charlie's word; the step is "Who, how and against" | §5 |

---

## §2 First: the field-mapping report (report only, then stop)

Before any data moves, report for `LexCoherentAction` on every live idea: what the body text, `Who`, `Target`, `Impl`, `Enforce`, `Friction`, the policy-link facet, `Sequence` and `before-ids` hold today — non-empty row counts per field; which writer filled each (the build, "Classify with Lex", a user, the import pass); and the proposed mapping onto the fields in §5. Say which existing values would be lost or changed by the mapping (expected: none — the mapping renames and reveals, it does not rewrite). **Stop for Charlie's sign-off.** Why: his actions are his words; a wrong move is the kind of loss rule 5 exists to prevent.

---

## §3 The steps (166)

**3a. The step bar.** At the top of the Coherent Actions section, four steps in words with the current one marked by position and weight (never colour alone): *1 Sort and prune · 2 Who, how and against · 3 Costs · 4 Order*. Clicking any step moves to it. The current step is stored per idea (`Idea.actionsStep` or equivalent; default 1), so returning to the idea lands where the user left it.

**3b. What a step controls.**
- The **intro paragraph** under the bar (verbatim texts in §4–§7).
- The **toolbar**: only that step's controls. Controls that belong to other steps are not rendered (not greyed — absent). "Import actions from a document", "Check for gaps" and Lex's offers follow the step they belong to (§4).
- The **list row**: only that step's tags. In step 1 a row shows title, summary, heading, verdict (shape + word), causes count, avenue. It does not show "not yet specific", Impl/Enforce/Against, cost, sequence.
- The **opened record**: the current step's sections first and open; the other steps' sections below, collapsed under one line each ("Who, how and against — not yet answered · from step 2"), so nothing is hidden, only out of the way.
- The **checklist**: a short advisory list for the step (§3c), shown in the worklist and at the foot of the list. Advisory means: it says what is unfinished and never blocks moving on.

**3c. Checklists** (the CA checklist from 26-P addendum 2 §5, now split by step). Each line in words with the count: "4 actions have no heading", "All actions have at least one cause".
- Step 1: every live action has a heading; at least one cause; an avenue; no row untested against the policy; no unresolved duplicate (find-duplicates has run since the last change); every ✗ Conflicts row has been ruled out, edited, or kept with a note.
- Step 2: every live action has Who and Against answered; the count of "specific enough".
- Step 3: every live action has a cost range or a stated "no cost, because".
- Step 4: every live action has a sequence slot.

**3d. Lex is step-aware.** The idea snapshot carries the current step. "Classify with Lex" proposes only the current step's facets (step 1: headings, causes, avenue; step 2: the §5 fields; step 3: cost ranges; step 4: sequence and before). Lex's controls source lists the step bar and each step's controls; Lex names a control from another step only with "that is in step N". Snapshot stays rows-only (26-S §4c); records fetched on demand.

---

## §4 Step 1 — Sort and prune

**Intro, verbatim:**
> **Sort and prune.** Get the list into shape before adding detail. Give every action a heading — the instrument it belongs to — link it to the causes it attacks, and say which avenue it uses: legislative, organisational or financial. Merge duplicates, rule out what does not fit the policy (with a reason — nothing is deleted), and check for gaps. Who does what, what it costs and what comes first are the next steps.

**Tools:** titles and "Title these for me"; drag; Group by heading / cause / avenue / policy test; headings (create, rename, assign — including **"+ New heading…"** on the bulk bar's Assign dropdown); Edit (an **"Edit title"** control at the end of the title; the body editable in the record); causes (tick by hand, or Classify); avenue; the policy verdict with its reason; "? Not tested" rows with **"Test against the policy"** (170; the same test as the import's, price measured, "n=" on the card); rule out / later phase / restore; merge, compare, find duplicates; Check for gaps; Import actions from a document.

**Retired from the screen (167):** the "Link — which binding link it protects" facet. Column kept; nothing written to it; the digest (26-T) may read it.

**Layout (from the 17 Oct paste — do here if not already done):** open/close control top-right of the opened record; heading dropdown below it; 2px border and light grey fill so the opened record reads as one box; provenance off the verdict line into the record's sources (169), reworded "From: your comment during consolidation (Grok draft)".

**Limits (168):** rule-out reason 600, classification link 200, title and heading name — each shows "n of 600" as the user types and stops at the limit; a refusal anywhere on this screen renders **"Not saved: ‹reason›"** with OK. Add the rule to CLAUDE.md §30.

---

## §5 Step 2 — Who, how and against

**Intro, verbatim:**
> **Who, how and against.** An action is only real when someone named will do it, with a reason to, and when you know what will push back. For each action: who implements it and whether their present incentive pulls with it or against it; what in the proposal changes that; how it is enforced and by whom; and what will oppose it — strikes, gaming, legal challenge, delay. Lex can propose answers; you decide.

**Fields** (named slots on every action; each reads **"Not yet answered"** until it is; every one editable by hand; nothing a user wrote is overwritten by a proposal — proposals sit beside, accept or edit):

| Field | Asks | Maps from |
|---|---|---|
| **Who** | Who implements it (body or role); inside or outside government | `Impl` / `Who` — per §2's report |
| **Incentive now** | With / Against / Indifferent (word + shape), and why | new |
| **What changes it** | What in the proposal changes that incentive — usually another action (e.g. #28 for most organisational actions on 452c5ade); a link to that action where it is one | new |
| **Skill** | Why they would have the skill to do it | new |
| **How** | How it is enforced, by whom, with what consequence | `Enforce` |
| **Against** | What will oppose it — strikes, gaming, legal challenge, delay — and the counter to each | `Friction`, renamed |
| **What tells us it worked** | The measure | new (the Magenta Book is in the corpus for Lex to draw on) |

**"Specific enough"** is computed here and shown here only: Who and Against answered (organisational, financial), or draft text present (legislative). The coverage grid and the step-2 checklist use this definition. The tag reads "specific enough" / "not yet specific — Who and Against unanswered" (names the missing slots).

**Lex:** "Classify with Lex" in step 2 proposes all seven for every action without answers (one pass, chunked as the import is, price measured on scratch and shown "n="); per-action "Ask Lex" proposes for one. Proposals carry a one-line reason and a source where Lex used one ([Ref: n]).

**Documents:** the Proposal and the Meeting Pack print Who / How / Against under each action when answered, and "not yet stated" when not.

---

## §6 Step 3 — Costs

**Intro, verbatim:**
> **Costs.** A range is enough here: low and high, what it is based on, and the price year. The full costing — in the shape of the Treasury's Green Book, which is how departments appraise a proposal — happens in the Deepening, where each clause can be costed rather than each aspiration.

**Tools:** the existing "+ add a cost" becomes the step's form: low, high, basis (one line), price year, one-off or per year; "no cost, because" as an explicit alternative; the cost summary field reads from these. The Green Book is in the corpus (whole document, tier guidance) — Lex may cite it when proposing a basis. Nothing else here; the Deepening's costing engine (`lib/lex/costing.ts`, zero callers) is not wired in this sprint.

---

## §7 Step 4 — Order

**Intro, verbatim:**
> **Order.** Which actions must come first, and which depend on others. This is sequence, not a project plan: a plan with dates belongs in a project tool once the proposal is adopted.

**Tools:** Sequence (start with / later / last), Comes before (the existing before-ids), the sequence view ("Start with"). Moved behind the step; no new function. The step-4 checklist: every live action has a sequence slot.

---

## §8 Headings and scale (26-S §5c–d, unchanged)

Heading shows "· n archived" after a rebuild archives one of its actions; headings collapse and expand with counts; a list filter — **Unreviewed / Conflicts / Not yet specific** (the last only in step 2+).

---

## §9 The research panel (171–173)

**9a. One list (173).** The panel shows each uploaded document twice today: as a Sources card (number, read status, the evidence caveat, Add to report / Set aside) and again under "Your material" (Open / Remove). The registry points at the material; the screen should show one thing. Fold "Your material" into Sources: each card gains **Open**; "Remove" goes (it archives today — "Set aside" says what it does and keeps the reason); "+ Add research" sits once, above the list. Report what else reads `IdeaUserMaterial` directly (the Build page, the question cards, Lex's "see my documents") and make them read through the registry.

**9b. The caveat, once and short.** The five-line "Undated. No retrievable source record… assertion rather than evidence" repeats on every one of Charlie's own documents. Keep the meaning, cut the length, show it once per card:
> "Your own document: undated, no figures — read as your testimony, not as evidence."
The long form stays in the Evidence Pack where it matters.

**9c. "Notebook · N notes" (171)** beside "Sources", linking to the notebook view.

**9d. The Add research dialog (172).** "+ Add research" opens a focused dialog: the rest of the panel dimmed; the file control reads "Choose a file" as a button, not a link; the fields in order (file or address or text → the quote, optional → comment, optional → "I may share this", never defaulted); one **Save** at the foot; on save the dialog closes and the new source card is highlighted with its number. The same pattern for "Import actions from a document" (the review table is already a panel; make it a dialog) and for the feedback form. Why: Charlie filed his document and thought the next section down ("Decisions") was part of the form; the save was missed.

---

## §10 The import pass — the fix (174) — DO FIRST

**What happened on Charlie's real run (17 Oct):** five parts; part 4 ("10.1 Core Q&A rules to include") failed twice — the model's output hit `max_tokens=14000` — and the screen showed, twice, "could not be read after 2 tries — truncated… raise the budget or shorten the input… Discard this import and start again". The only control was Discard. A retry would hit the same wall, so the import cannot complete. Cause: parts are cut by word count (~2,600 words); row count depends on density, and §10 of the document is seventeen Q&A rules and a thirteen-row table — thirty-odd provisions in a short span.

**Fix:**
1. **Density-aware chunking.** Cut parts by an estimate of provisions — list items, table rows, numbered clauses, bold lead-ins — with a cap of ~20 per part, and a word ceiling as the backstop. Why: output size follows rows, not words.
2. **Automatic re-chunking on truncation.** A truncated part is split in two at a paragraph boundary and each half retried, recursively, down to a floor (~250 words). The user sees "Part 4 was too dense to read in one go — splitting it and trying again", not an error. Only a floor-size piece that still truncates reaches the user, with: "Part 4b could not be read even in small pieces. Nothing has been written. Paste that section on its own, or discard this import."
3. **Keep what succeeded.** A failed part never discards the pass. Controls: **Retry part N** (after the automatic split, if it still fails) and Discard. The confirm card shows "4 of 5 parts read" until all are.
4. **Budget.** Raise the per-part output budget to the model's practical ceiling (report Sonnet 5.5's) — a larger budget spends only what is used. Keep the chunk small enough that a part finishes in ~45 s and is resumable.
5. **Never say "raise the budget" to a user.** Developer words go to the log, not the screen. One message per failure, never the same message twice.
6. **Measure Charlie's run.** The four parts that succeeded are the first real measurement: tokens and pence per part, and the whole once it completes. The confirm card's "estimate" becomes "measured (n=1)".
7. **Check:** a fixture with a dense section (30 provisions in 800 words) imports with no user action; a part forced to truncate at the floor shows the final message once and leaves the other parts intact; the review table on Charlie's document (file it from the registry row that exists) produces one row per provision and the overlaps as "adds to".

---

## §11 Data rules and spend (175, 176, and 26-S §4c)

**11a (175).** `removeCause` hard-deletes a cause row and frees its number. Change it to archive (as actions, sources and headings do), keep the number, show "n archived" where causes are listed. Any other hard-delete path on kernel data: list it in the report; do not fix without a decision.

**11b (176).** The 266 unattributed ledger rows since 29 Sep were almost all measurement and check runs (reachability 94; Search's reranker and router burst 120; build drafts 29; model review 12; check scripts). They are real money with no owner in the ledger. Scripts and measurement runs set an ambient `purpose` — `measurement` or `check` — at the call site (the 29 Sep ambient-context mechanism, one more field), the dashboard shows product spend and engineering spend separately, and `check:spend-attribution` treats a `purpose` row as attributed. Report the engineering spend since 29 Sep in pounds.

**11c.** The Lex snapshot stays rows-only; `get_action(n)` for a record (26-S §4c). Report the snapshot's token count on 452c5ade before and after.

**11d (158).** Remove the old Lex code path (`app/api/ideas/[id]/lex/route.ts` after the `agentEnabledFor` branch) once Charlie confirms the second-account test; retire its tests by name.

---

## §12 Verification — `check:lex-26s2`

Cold reads; controls that stay false; scratch idea for every write.
1. The step bar renders; the stored step round-trips; in step 1 a row shows no step-2/3/4 tags; in step 2 the seven slots render "Not yet answered" and an edit persists; "specific enough" follows §5's definition exactly (three fixtures: Who+Against answered; draft text only; neither).
2. A user-written Who is not overwritten by a Classify proposal; the proposal sits beside it.
3. Counters: typing to 600 stops; a 601-character body sent directly is refused with "Not saved: …" rendered.
4. "? Not tested" renders on a build-era row; "Test against the policy" writes a verdict and reason, read back.
5. The import fixture of §10.7, all three cases.
6. One source list: a document filed once appears once; Open opens it; Set aside archives with a reason and restores.
7. The Add research dialog: the save lands; the new card carries its number; a filed document with no note is a valid source.
8. Archiving a cause keeps its number; the next cause takes one past the highest ever.
9. A script run with `purpose=measurement` produces ledger rows the attribution check counts as attributed.
10. Regression: `tsc` 0; 26s, 26q, 26r, 9oct, walk-8oct, 26m-actions, 26p, 26h, 26n, 25s, documents, export, client-boundary green; `check:prompt-examples` green; known-red list fixed or retired with the reason.

---

## §13 What only Charlie can confirm

- The import on his own document, end to end, after §10: the table before confirm, the list after.
- The step bar and the four intros on his screen; whether "Against" reads right.
- The §2 sign-off.
- The second-account test of the new Lex (the cost line in the panel), then 11d.
- The Add research dialog on a fresh file.

---

## §14 Not in this sprint

26-T: the four-model digest per heading; the Actions Pack (numbered paragraphs); the incentive map (synthesis + "group by implementer" view with direction); Background Report, Introductory Summary, "Considered, not taken". 26-U: drafting instructions and illustrative clauses to the OPC guidance (held, searchable); first-order collisions; near-provisions flagged (144); consequential amendments when Graphs exposes the record. Deepening: Green Book costing; the cost annexe; the opening re-read. Later: saved selections ("packages"); Word-comment import; export of the Order step to a project tool.
