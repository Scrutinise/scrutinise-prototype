# LEX 26-S2 — REPORT (in progress)

*From the Lex CC session, 17 October 2026. Batched, as BRIEF_26S2 §0 asks. Sections are added as the sprint goes. This version: **§10 (the import fix) is built and pushed; §2 (the field-mapping report) is below and the sprint STOPS here for Charlie's sign-off.** §3–§9 and §11 have not been started.*

---

## A. §10 — the import fix (decision 174) — done, DO FIRST as the brief says

### What happened on Charlie's real run, from the database (pass `8aeb95f9`, idea 452c5ade, source 213, 17 Oct 01:25–01:42 UTC)

| part | what it was | tokens in / out | seconds | pence | rows |
|---|---|---|---|---|---|
| 1 | Executive summary… | 7,576 / 8,641 | 53 | 8.02 | 32 |
| 2 | Clause 7 — Public value duty… | 7,397 / 9,159 | 55 | 8.40 | 39 |
| 3 | 6.2 Required response… | 7,786 / 6,259 | 40 | 6.17 | 20 |
| 4 | 10.1 Core Q&A rules (1,773 words) — **cut off at max_tokens=14,000, twice** | 8,224 / 14,000 | ~77 each | **12.36 + 12.36 = 24.7, for nothing** | 0 |
| 5 | not reached | | | | |

Whole document: 7,746 words, 59,903 characters. Three parts read = 4,841 words, 91 rows, **22.6p** (the pass's `spentPence` is 47.3p because of the two wasted calls). The pass was then discarded by Charlie ("Discard this import and start again" was the only control).

**Why.** Output size follows the number of provisions, not words. Part 4 had a word count (1,773) just like parts 1–3 (1,573–1,637) but is "seventeen Q&A rules and a table": roughly 60 rows × ~230 tokens — over the ceiling. The old rule could not see that.

### What was built

1. **Density-aware cutting** (`planChunks`, `provisionsIn`). A part closes at ~25 estimated provisions *or* ~2,600 words. The estimate reads the document's own structure: list items, numbered clauses, table rows and bold lead-ins count one each; in text that came out of a Word file (no markers) a paragraph counts one if it reads as a statement (12–70 words ending in punctuation), one per ~70 words if longer, none if it is a heading or a table cell; a table with no blank lines is cut at its rows. **Calibrated on the only data there is:** the estimate gave 35 / 42 / 17 for the three parts that were read against 32 / 39 / 20 rows returned, and 60 for the part that was cut off. (Paragraph count and words-per-provision did not track at all: 93 / 80 / 156.) *Three parts is a thin sample — the estimate is a guide; the automatic split is the guarantee.* The brief's cap of ~20 became **25** because 25 × ~230 tokens ≈ 6k output tokens, ~45 s — the size of a part that read comfortably. Charlie's document now plans as **14 parts** (was 5).
2. **Automatic re-chunking on truncation.** A part that comes back truncated is split in two at the paragraph (or line) boundary nearest the middle by provisions, and each half is read — recursively down to a floor of 250 words. Not a try, not an error: the screen says *"Part 4 was too dense to read in one go — splitting it and trying again."* Halves are named 4a / 4b (and 4aa…). Only a floor-size piece that still truncates reaches the user: *"Part 4b could not be read even in small pieces (… words). Nothing has been written. Paste that section on its own, or discard this import."* — once.
3. **Keep what succeeded.** A part that fails (any reason) is tried twice, then **waits** — the pass stays in "being read", every part already read is kept, nothing further is spent, and the panel shows *"n of m parts read"* with **Retry part N** and Discard. `retryPart` puts only that part back. The same holds for the headings step and the policy-test step: a failure there used to end the pass (`FAILED`, 14 parts lost); it now says it did not complete, keeps the table, and "Try again" re-asks. A thrown fault also keeps the pass.
4. **Budget.** Output ceiling 14,000 → **20,000** per part. ⚠ **Sonnet 5.5's own maximum output is not readable from this repository** (no registry entry) and I did not probe it (spend); 20,000 is the most a non-streamed call is run at here, ~110 s against a 200 s timeout. The splitting, not the ceiling, is what makes a dense part finish.
5. **No developer words on the screen.** "raise the budget", `max_tokens`, "truncated:", HTTP statuses: all go to the log (`console.warn`), none reaches a `chunk.error`, `failure` or view (asserted by the check against the whole JSON view).
6. **Measured.** Each part now records its pence, output tokens and seconds. The estimate behind "Reading it costs about …p" now rests on n=4 real runs including Charlie's (his three parts added: 4,841 words, 22.56p, the two wasted calls excluded); for his whole document it now says about **70p** (it said 101p). The confirm card says *"Reading the document cost Xp across N parts — measured on this document (n=1 run)"*. **First end-to-end real measurement on the dense fixture (live):** 2 parts, 30 rows, **15.3p**, 107 s including headings and the policy test.

### Checks — `check:lex-26s2` (new; 37 assertions, 4 controls, 0 dead, 0 not run with `--live`)
(1) 30 provisions in ~800 words imports with **no user action** — stand-in model that truncates above 9 rules a call: the pass split itself, read every part once, 30 of 30 rows, every part measured; and the **real model** on the same fixture: READY, 2 parts, 30 rows. (2) A part that can never be read: the pass waits (not failed), the message appears once and contains no developer word anywhere in the view, the other parts and their rows are intact, "n of m parts read", advancing again makes no model call. (3) "Retry part N" calls the model for that one part only and the pass then reaches READY with all 30 rows. (4) A non-truncation failure is tried twice then waits, with plain words.
**The check found two real defects in my first version:** a compare-and-set that silently dropped the split (the part truncated 60 times in a row — `chunkCount` was written outside the lock), and the near-duplicate merge (`mergeDuplicates`) collapsing a *template-shaped* fixture to 6 rows — a property of the existing merge heuristic (jaccard ≥ 0.75 across parts) that real documents rarely trigger but a list of near-identical rules can; **not changed here, flagged.**
Also updated by name: `check-lex-26s` (a large size now needs the density cap lifted too; "no pass has ever been run" → "none CONFIRMED", since Charlie ran one; a data-dependent control now says NOT RUN instead of firing dead when every note bears on the policy).

### Not done / for Charlie
Charlie's real document has **not** been re-run (it costs ~70p and the table is his to review): the button is in place, the document is filed as [Ref: 213].

---

## B. §2 — the FIELD-MAPPING REPORT (report only — STOP for sign-off)

Read-only; `scripts/report-26s2-field-mapping.ts` writes nothing. **22 ideas have Coherent Actions (17 live, 5 soft-deleted); 86 LIVE actions on live ideas** (101 including the deleted ones). Counts below are the 86.

### B1. What every field holds today

| field (as the brief names it) | column | non-empty | % | notes |
|---|---|---|---|---|
| body | `practicalStep` | 86 | 100% | |
| title | `title` | 21 | 24% | (580 challenge titles are a different table) |
| **Who** | **`whoImplements`** (text) | **64** | 74% | e.g. "Cabinet Office, Civil Service Commission"; **all 64 on rows created by Lex** (build / consolidation / import). On 452c5ade: **9 of 26** (#20–#28); #1–#19 have none. |
| Target | `targetOrganisation` (text) | 4 | 5% | legislative |
| draft text | `wording` | 0 | 0% | |
| mechanism | `mechanismType` | 60 | 70% | rules 31, institutional 21, transparency 15, incentives 3, financial 1, market-design 1 (29 null) |
| **"Impl"** | **`implementationCost` (JSON)** | **0** | 0% | ⚠ **a COST field** — `{low, high, unit, basis, benchmarkId?, userOverride?}`, "falls on Government" |
| **"Enforce"** | **`enforcementCost` (JSON)** | **0** | 0% | ⚠ a COST field — "ongoing cost to police/administer" |
| **"Friction"** | **`regulatoryFriction` (JSON)** | **0** | 0% | ⚠ a COST field — "ongoing compliance burden — the economy" |
| benefits | `benefits` (JSON) | 0 | 0% | |
| cost lines | `CostLine` rows | 1 action | | (idea 6dc530ce, the plastic-bag scratch idea) |
| Link | `link` (text) | 22 | 26% | **all on 452c5ade** |
| Sequence | `sequence` | 26 | 30% | **all on 452c5ade** (NOW/NEXT/LATER) |
| before-ids | `beforeIds` | 7 | 8% | all on 452c5ade |
| avenue | `avenue` | 26 | 30% | all on 452c5ade |
| causes | `targetCauseIds` | 24 | 28% | 452c5ade |
| heading | `headingId` | 2 | 2% | |
| pending Lex proposal | `facetProposal` | 0 | 0% | nothing unaccepted anywhere |
| policy test | `policyTestVerdict` | 15 | 17% | the other 71 read "? Not tested" (on 452c5ade: 11 of its 26) |

Thirteen of the seventeen live ideas have exactly 4 actions (build test ideas) with **Who** filled and nothing else; three more have 3, 3 and 2. **Only 452c5ade carries the facets.** On the 60 actions of ideas where "Classify with Lex" never ran, **0** have any facet.

### B2. Who wrote each field — what the database can and cannot say

- **Per-field provenance is not recorded anywhere.** There is no "written by" on a facet; `source` is who *created the row* (USER 7 / LEX 79). I can say:
  - **Who:** filled only on LEX-created rows (64/64) — written by the build, the consolidation or an import, never typed into a blank row by a user as far as the data shows.
  - **Link / Sequence / before / avenue / causes** (all on 452c5ade): "Classify with Lex" ran **3 times on 2 ideas** (ledger pass `actions.facets`); Lex's chat tools touched actions only via `add_action` (4 calls). The facets exist *only* on ideas where Classify ran, and a user's hand edits (the Link box, the avenue/sequence menus, the cause ticks, "Comes before") go through the same route without a log. **So: Classify wrote the proposals; a hand edit cannot be told from an accepted proposal.** Two of Charlie's own rows (#1, #2, created by USER on 28 Sep) carry link/sequence/avenue/causes, so he or an accept put them there.
  - **Impl / Enforce / Friction:** no writer has ever written them on a live action (0 rows).
- Nothing a user wrote is at risk from anything below: no value would be moved or rewritten.

### B3. ⚠ A mismatch in the brief — **Impl / Enforce / Friction are not Who / How / Against**

BRIEF_26S2 §5 says Who maps from "`Impl` / `Who`", How from "`Enforce`", Against from "`Friction`, renamed". In the schema those three are the **cost** columns of Step 3 (low / high / basis, on Government, on the regulator, on the economy), and the existing cost UI labels them Impl / Enforce / Friction. They hold **no text about who or how, and no rows at all**. Mapping onto them would (a) store opposition-and-enforcement prose in a cost JSON the Costs step and the cost summary read, and (b) rename "Friction" — a *compliance-burden cost* — to "Against" — *who will oppose it* — which are different things.

### B4. Proposed mapping (for sign-off)

| slot | proposal | values lost or changed |
|---|---|---|
| **Who** | **keep `whoImplements`**; relabel "Who"; same text | **none** (64 rows unchanged) |
| Incentive now (With / Against / Indifferent + why) | **new** | none (new, "Not yet answered") |
| What changes it (+ link to an action) | **new** | none |
| Skill | **new** | none |
| How (enforced by whom, with what consequence) | **new** — *not* `enforcementCost` | none |
| Against (what will oppose it, and the counter) | **new** — *not* `regulatoryFriction` | none |
| What tells us it worked | **new** | none |
| Impl / Enforce / Friction (cost JSONs) | **untouched; they stay Step 3's cost slots**, label "Friction" → "Compliance burden" if you want the word freed | none (0 rows) |
| Link | retired from the screen (decision 167); column and its 22 values kept, nothing written | none |
| Sequence, before-ids | move behind Step 4; no change | none |
| mechanismType, Target, wording | unchanged; used by consolidation/legislative actions | none |

**Storage proposed:** one additive nullable JSON column on `LexCoherentAction` — `record` — holding the six new slots, each `{ text, by: 'USER'|'LEX', proposal?, source? }`, so that **what a user wrote is separate from what Lex proposed** (the proposal sits beside; accepting copies; nothing is overwritten) and per-field provenance exists from now on. (Alternative: seven nullable text columns; JSON is easier to extend and keeps `entity_list` to one new field. Your call.) Additive migration, applied after `whichdb`, committed with the schema (CLAUDE.md §16/§12).

### B5. One displayed state **does** change — please confirm

"Specific enough" today (`specificEnough`) is *draft text present OR `whoImplements` present*: **64 of 86 rows read "specific enough"**. The brief's new definition (Who **and** Against answered — organisational/financial; draft text — legislative) means **those 64 would read "not yet specific — Against unanswered"** until the Against slot is answered. No data changes; the tag, the coverage-grid note and the step-2 checklist change. That is the intended effect of the new definition, but it is a visible flip on every action Charlie has seen as "specific enough".

### B6. Open points the report found while reading the code (not decided here)

1. The `Friction` word in the cost UI (above).
2. `removeCause` hard-deletes (11a) — not yet touched.
3. The import's near-duplicate merge (A, last paragraph).
4. Display-time provenance rewording works for the 17 stored strings; the 17 `policyTestFrom` strings on 452c5ade still hold the old wording in the database (no write needed, the screen rewords).

---

**The sprint is stopped here, as BRIEF_26S2 §2 requires.** Awaiting Charlie's sign-off on B3–B5 (the mapping, the JSON column, and the "specific enough" flip) before any step-bar, record or §5 work.

---

## C. CCh's decisions 177–180 (17 Oct) and the SIZE of what is left

### C1. Done in this push
- **180** — `mergeDuplicates` merges only on overlapping *quoted document text* (equal, or one inside the other). The fixture caught my first attempt (a fuzzy stem overlap ≥ 0.85 merged 2 of 10 same-shaped rules on shared words), so the fuzzy path was removed, not tuned. Ten same-shaped Q&A rules → ten rows. **Charlie can re-run the import once the deploy is read back.**
- **178** — `add_research_note{dictated:true}`: the owner's dictated note is the owner's (USER, IN_RECORD); refused unless the comment is word for word in what the user wrote. [Ref: 214] on 452c5ade re-marked LEX/UNREVIEWED → USER/IN_RECORD, read back.
- **177 / 179** — signed off as in the handoff; **no code yet**: both live inside the step screens (the record column, the step-2 tag, the step-3 labels).

### C2. Size of §3–§9 and §11 (reported before building, as asked)
**Two sprints, as the brief anticipated. Split at the end of §4, as the brief says — with one addition: the record column and its migration (177b) go in sprint 2's first commit, not sprint 1's, because nothing reads it until step 2 exists.**

| | what | size | spend |
|---|---|---|---|
| §3 | step bar, `Idea.actionsStep` (**schema + migration, one commit**), per-step toolbar / row tags / opened-record sections, four checklists, step-aware Lex (snapshot carries the step; Classify proposes by step; controls source lists steps). Touches `ActionsWorkspace.tsx` (841 lines), `GuidingPolicyScreen.tsx` (2,002), `guiding-policy-state.ts` (1,134), `agent/tools.ts` + `controls.ts`, `proposal-snapshot.ts` | **large** — the bulk of sprint 1 | none |
| §4 | step 1 intro + tools; "Test against the policy" for untested rows (a model call per row — price measured, "n=" on the card); retire the Link facet from the screen; limits (mostly done 17 Oct) ; CLAUDE.md §30 addition | medium | ~pence on a scratch idea |
| §5 | `record` JSON column (**schema + migration**), seven slots, "specific enough" redefinition (grid, checklist, tag), Classify-step-2 pass (chunked like the import, measured), per-action Ask Lex, Proposal / Meeting Pack print Who / How / Against | **large** | a measurement run, ≈ tens of pence |
| §6 | step-3 cost form (low / high / basis / year / one-off / "no cost, because"); labels per 179 | medium | none |
| §7 | Sequence / before-ids / sequence view moved behind step 4 | small | none |
| §8 | "n archived" on headings, collapse/expand with counts, list filter | small–medium | none |
| §9 | fold "Your material" into Sources (readers of `IdeaUserMaterial`: `QuestionPanel`, `ResearchTab`, `IdeaDetailClient`, `chat-material`, `elicitation*`, `page-one`, `question-panel`, `source-registry`, `user-material` — 9 files to route through the registry), short caveat, three focused dialogs | **large** | none |
| §11 | 11a `removeCause` → archive (field-machine, build, gap-check, action-structure also delete — listed, not fixed, per the brief); 11b ambient `purpose` + dashboard split + `check:spend-attribution`; 11c snapshot token count; 11d **held** until Charlie's second-account test | medium | none |

**Sprint 1:** §3, §4, §7, §8 (they are the step screens) + 11a. **Sprint 2:** §5 (+177 record, +179 labels, the Classify pass), §6, §9, 11b, 11c. §12's `check:lex-26s2` grows with each. Stopping here for the split to be confirmed is NOT required by the brief; the next push begins §3.

---

## D. Sprint 1, push A — the four steps (BRIEF_26S2 §3, §4, §7)

Built and checked as described in the CHANGE_LOG entry of that push. What the report adds:

**Decisions taken inside the brief's latitude (say if any is wrong):**
1. **Step storage** is a column (`Idea.actionsStep`), not browser storage — the brief says the idea reopens where the user left it, which has to survive a device change. Applied before any code read it.
2. **"No unresolved duplicate" (checklist, step 1)** has no stored fact behind it. It reads "Find duplicates has been run since the last change" — remembered in THIS browser against a signature of the list's content. A different browser reads "not run", which is true to that browser.
3. **"Kept with a note"** needed somewhere to live: `LexCoherentAction.conflictNote` (≤ 600). "Edited" (the brief's third way to resolve a conflict) cannot be detected; the checklist says "ruled out, re-tested after an edit, or kept with a note", and a re-test replaces the verdict when 170 lands.
4. **Steps 2 and 3 have no toolbar** in this push — their questions are the opened record's (Who today; the cost ranges). Step 2 says its other questions are the next update; the seven slots are sprint 2 by the split.
5. **The coverage grid is step 1's, the sequence view step 4's**; "Group by" offers step 1 heading / cause / avenue / policy test and step 4 heading / sequence. "By link" is gone with the facet.
6. **Bulk bar, drag, Later phase, ruled-out blocks, "Add an action" are step 1's.** "These are my actions" / "Skip" (the field's own confirm) stay visible in every step.
7. **Classify with Lex dropped the "binding links" read** (decision 167 retired the facet) — one fewer thing the model is asked, so a cheaper call; not re-measured (a model run on a scratch idea was not made in this push).

**Not done, said plainly:** the step checklist is at the foot of each list but **not yet in the worklist ("What to do next")**; that block is a different, registry-driven tick-box mechanism and adding a computed checklist to it is its own small piece. The Lex snapshot's actions block now carries the step, so a step change changes the cached prefix (pence). Nothing here has been seen in a browser by me or by Charlie — the render is checked (static markup, 78 assertions incl. a mutation run); the clicks are not.

---

## E. Sprint 1, push B — the policy test, the filter, archived causes (BRIEF_26S2 §4/170, §8, 11a)

**What was measured.** "Test against the policy" on a scratch copy of 452c5ade with four verdicts blanked: **14 actions untested, one call, 3.88p, 37 s** (9 fit, 5 do not fit, 0 conflict). That is the first measurement of this call (n=1), so the button says so. At that rate Charlie's 11 untested rows cost about 3p and the other ~60 untested build-era rows on other ideas about 15p. Not run on any real idea.

**Decisions inside the brief's latitude (say if any is wrong):**
1. **"Unreviewed" is not defined in BRIEF_26S §5d or here.** I read it as: a proposal of Lex's is waiting for the user (a title, or this step's classification), or the action has never been tested against the policy. The filter's tooltip states the reading.
2. **"n archived" counts ARCHIVED actions only** (a merge or rebuild did it), not RULED OUT ones (the user did that) — the brief's example is "after a rebuild archives one".
3. **A removed cause has no Restore.** Archive is for the number's sake; a restore was not asked for.
4. **`lib/prisma.ts` now filters archived causes from every direct read of `DiagnosisCause`.** I chose a client extension over touching ~30 readers because the next reader written would otherwise forget. Cost: it is a global behaviour of the shared client for one model, and a nested read (`select: { diagnosisCauses }`) is NOT covered — the three in `build.ts` / `build-research.ts` carry the filter themselves. `findUnique` is unaffected (an id names one row).
5. **No Lex chat tool for "Test against the policy"** — only the screen. The control is in Lex's list so she can point to it.

**⚠ For a decision (the brief: "list it; do not fix without a decision"):** the revise pass (`build.ts:2566`) still hard-deletes the Lex-sourced causes it rewrites, which frees their numbers — the one remaining path that can make "cause 3" mean a different cause. The other kernel hard-deletes are listed in the CHANGE_LOG entry (policy option, cost line, heading, evidence rows, private notes).

**Verification honesty.** Static renders and database round-trips are checked (99 assertions, mutation-tested); the real model ran once for part F. **Nothing was clicked in a browser by me.** Delivery for push A was read back from the running site (`/api/health` = `a95b185`; the string "you are here" is in the live JavaScript chunk `cdd6c0fd954e1761.js`); **push B (`8cfe3f3`, 15:45 UTC): `/api/health` showed `8cfe3f3` at 15:48 UTC, and three strings only push B adds — "Test against the policy", "a cause number is never used twice", "Filter the list" — are in the live JavaScript chunk `44e32e57595186ec.js`.** Both were also built clean-room (a worktree of the committed HEAD, `npm ci`, `tsc` exit 0) before pushing; `next build` was not run there. Neither push was seen in a browser.


---

## F. CCh 18 Oct — items A and B (pushed `0f47601`, read back from the live bundle)

**A — the import's "Part 1 could not be read" was the Anthropic account out of credit.** The Vercel log is not readable from this machine (the CLI token is invalid), so the failure was reproduced: the same system prompt, schema and part-1 text, sent to the same model, answered in 0.2–0.4 s with **HTTP 400 `invalid_request_error` — "Your credit balance is too low to access the Anthropic API."** That is also why nothing was spent. A single provider failure now retries itself once (429 / 5xx / 529 / a dropped connection / an empty or unparseable answer); a billing refusal, a timeout and a truncation are not retried inside the call. The sentence is "Lex could not read part 1 (the model did not answer). Nothing has been written. Press “Retry part 1”, or discard this import." — and "(the model provider says the account is out of credit)" when that is the reason. (Charlie evidently topped up and confirmed an import afterwards: 452c5ade now holds 175 live actions.)
**B — the opened record**, top to bottom: [title · Edit title · Close]; the full statement; [policy test | heading menu, right-aligned] on one line, the test not full width; avenue and causes; **Commentary** (decision 185); then Sources, the originals, Later phase / Rule out. The header snippet, the repeated title and the avenue/causes/tested line are gone from the opened view; the closed row keeps a two-line snippet. **Asserted in a real browser** (`check:lex-26s-browser`). ⚠ **The commentary "not rendering" was not reproduced:** the database holds commentary on seven live actions, the state returns them, and the real card rendered through the real workspace shows the box (with a control).

## G. Sprint 2, push 1 — what was built and what it cost

| | |
|---|---|
| Step 2 (177) | seven slots, proposals beside answers, "Replace mine with this", per-field writer + date, "specific enough" redefined; **flip on the live data: 78 live actions, 68 → 0** |
| "Classify with Lex" (step 2) | 6 actions a call, 12 a request, the screen continues; **MEASURED 18 actions · 3 calls · 19.34p · 207 s → 1.07p an action (n=1)**; asks first above 20p (a 175-action idea ≈ £1.87) |
| §6 step 3 | price year, one-off / per year, "no cost, because …" (schema `cc85e7c`) |
| 184 / worklist | filter help text; each step's open checklist lines on the worklist |
| Lex tools | `get_action`, `set_action_slot`, `propose_action_slots`, `test_actions_against_policy` |
| 11b | `LlmSpend.purpose`; Admin product / engineering split; **engineering since 29 Sep: £0.85 labelled (266 rows) + ≈ £4.99 on 42 deleted scratch ideas** |
| 11c | snapshot on 452c5ade, same data: **15,471 → 15,488 tokens (+17)** |
| 183 | **sized, not built: ~12–14 h** (CHANGE_LOG has the six paths and the recommended order) |
| Not yet | §9 research panel; 11d (held for the second-account test); Lex proposing a cost basis from the Green Book (no cost-proposal pass exists to attach it to) |

Questions for CCh: (1) 183 — go, and in which order? (2) The 513 orphan rows (£4.99) are engineering in fact but cannot be labelled `measurement` vs `check` — leave them unlabelled, or label them all `check`? (3) Who in the record: I left a Who written before 18 Oct as "writer not recorded" rather than guessing LEX from `source`.



## H. Sprint 2, push 2 — the research panel (§9)

**One list (173).** "Your material" is folded into Sources: each document is one numbered card with Open, Add to report and Set aside (a reason is required and kept; Put back undoes it). "Remove" is gone from a document — it archived the document and deleted the findings read from it, which is not what the word said. **The caveat** is one short line per own-document card; the long form is the Evidence Pack's. **Dialogs (172):** "+ Add research" and "Import actions from a document" are focused dialogs (`FocusDialog`: page dimmed, nothing behind it scrolls, Escape and ✕, one Save in a fixed foot; "I may share this" never defaulted; on Save the new card is highlighted with its number). The feedback form was already a dialog.
**What else reads `IdeaUserMaterial` (asked for):** 27 direct reads in 17 files that disagreed on what to count — the Build page counted ARCHIVED rows. `source-registry.ts` now owns "the documents on this idea" (`listDocuments` / `countDocuments`); nine readers ask it (Build page, stage context, chat-attach cap ×2, `file_text` cap, provenance lookup, Lex's snapshot, the material route's cap, the panel); the rest need the text or processing state and reach the document by `materialId` (the import ×2, `read_source` / `restore_source` / `materials()` in Lex's tools, `elicitation`, `page-one`, `update-pass`, `user-material`, the material route's CRUD ×3, `chat-material`'s duplicate finds ×2, the registry's own sync). A guard in `check:lex-26s2` fails if anything but the registry module counts the table again.
**Checked in a real browser** (`check:lex-26s2-browser`, 33 assertions): the document once; the caveat once and short; Set aside disabled until a reason; the dialog dimmed, unscrollable, one Save in the foot; the new card numbered and highlighted. It found and I fixed a real bug: the Sources list did not re-read after adding research from the contents home. It is a stand-in server, so the real thing still needs Charlie's eyes.
**Standing rule written (docs/CLAUDE.md §32):** a task with a beginning and a save is a focused dialog.



## I. 18 Oct (4) - decisions 186-194: what is done, the 190 sizing, and what I am missing

**Done and pushed with this entry.** 192 (the revise pass): causes and a previous build's actions are ARCHIVED, not deleted (`build.ts`); the cause number is never reused and cost lines/commentary/record slots no longer cascade away with a superseded action. 193: the 513 orphan ledger rows (42 deleted ideas, 498.6p) are labelled `check` with a new `LlmSpend.purposeInferred = true` (schema + migration committed together, applied after `whichdb`); the Admin split says how many check calls are inferred. 194: nothing changed. `check:lex-26s2` part O asserts all of it.

**Not done: 188 (conditions facet) and 189 (the avenue rule).** Both say "as in the 18 Oct (3) paste". That paste is not in this session, in the repo, or in CLAUDE.md/handoff; Charlie's ten conditions and the rule's wording exist only there. I have not guessed them. Please re-send the paste.

**190 sized - on Charlie's idea 452c5ade, today (cold read).** 175 live actions, 20 headings (one hidden), 72,762 characters of action text (avg 416, max 4,032) = about 18k input tokens for the whole set; 7 carry commentary.
| heading now | live |
|---|---|
| Gaming and Challenges | 31 |
| Legislation (hidden) | 24 |
| Performance Management | 21 |
| Benchmarks and Measurement | 18 |
| Statutory Accountability & Delivery Code | 18 |
| Transparency & Oversight | 17 |
| Independent Performance Adjudication | 13 |
| Civil Service Code | 9 |
| Training & Implementation | 7 |
| Honest Error & Safe Harbour | 6 |
| Digital Responsibility & Challenge Register | 5 |
| Material Constraint Notice(s) | 3 + 2 |
| Accountability & Delivery Code | 1 |
| the six one-condition headings Charlie lists as retired | 0 each |
"Legislation" (24, hidden) is in neither Charlie's seven nor his retired list - I will not touch it until told whether it maps to "Primary legislation".

**Re-sort into headings (one call, no loop).** All 175 actions in one request (about 18k tokens in), 175 x {id, heading, reason} out (about 6k). Estimate 4-8p; I will MEASURE it on a scratch copy before putting a price on the card (the Classify price was a guess of the same kind until measured: 1.07p/action). One confirm. Mechanics: create the seven headings (or reuse by name), move each action, ARCHIVE the retired headings (needs `ActionHeading.archivedAt`, a new column - a heading delete is one of the five paths in 183), keep the reason on the action (`record`-style, with who/when) so it is reversible per action.

**Consolidate this heading (per heading, a loop).** For each of the seven: the model is given that heading's actions and returns (a) mechanisms, each with its component action ids, and (b) true duplicate pairs. Components fold into the mechanism's commentary as QUOTED, CITED components ("[#31] ..."); a fold sets the component to ARCHIVED with `foldedInto`, a pointer, so Restore puts it back and unfolds the quote; duplicates merge through the existing merge (originals kept). One confirm per heading. Target 175 -> 40-70 live. Output is heavier than the sort (quotes), so I expect 2-4p per heading of 25 actions, again measured before it is priced. The risk to name: a model quoting a component slightly wrong. The fold therefore copies the component's text from the row, never from the model's output - the model chooses ids, the code writes the quote.

**Size: one sprint, about 2 working days:** migration (`ActionHeading.archivedAt`, `LexCoherentAction.foldedInto`) and the heading archive paths (1/2 day, the heading is also one of 183's five); the sort pass, route, UI, price card (1/2 day); the consolidate pass, fold/restore, per-heading confirm UI (1 day); checks, scratch measurement, docs. 188/189 add to that once I have the paste.

**Questions for CCh.** (1) The paste for 188/189. (2) "Legislation" (24, hidden): maps to Primary legislation? (3) The 14 retired headings include "Transparency & Oversight" while the new seven include "Transparency and oversight" - the same heading, different spelling; the sort treats the old one as retired and the new one as new, so its actions are re-sorted rather than kept. Confirm that is wanted.


## J. 18 Oct (5) - 188 conditions, 189 avenue rule, 190 Re-sort and Consolidate, UI A and B: built, measured on scratch, nothing pressed on Charlie's idea

**What was found first.** Charlie had already built his seven headings under short names (Legislation, CS Code, CS Mgt Code, The platform, Rules & Standards, Oversight, Training; 174 live actions, most hidden). So the plan RENAMES each in place (same id, same actions, same hidden flag) to CCh's final names instead of archiving and re-creating them; "Legislation" becomes "Primary legislation" (Q2), "Oversight" becomes "Transparency and oversight" (Q3). The old themes CCh listed as retired are already gone from the idea; the Re-sort still archives (never deletes) any heading that is not one of the seven once it is empty.

**188 - the conditions facet.** `Idea.conditions` (ordered, owner's words, retired not deleted, Lex's additions as proposals), `LexCoherentAction.conditionIds` + `supportOnly`. Charlie's ten are seeded verbatim by `scripts/seed-26s2-conditions-headings.ts` (dry run by default). Step 1 has: a "Conditions the proposal must meet" panel (edit, move, retire, add, Lex's proposals), a "Conditions" view (conditions x actions, an empty row reads NO ACTION in words), a chooser on each opened record ("Conditions it delivers: 1 and 6 / support / none"), the two checklist lines ("Every condition has at least one action", "Every action delivers at least one condition or is marked support", with counts; also on the worklist), and "Classify with Lex" proposes conditions per action (accept per action or "Accept all"). Two Lex tools: conditions_coverage, propose_condition. **The note: no notebook note holding the ten exists on 452c5ade** (its three notes are the two "Coherent Actions" briefs and "New implementation headings"), so the list cites "Charlie's ten conditions, as given to Lex by CCh on 18 Oct 2026" instead. I did not write into Charlie's private notebook; if he files the note, the citation can point at it.

**189 - the avenue rule** is one constant (`AVENUE_RULE`, the brief's string character for character), printed in Classify's prompt, the FAQ (new entry "What are a coherent action's avenue and conditions?") and Lex's instructions; checked against the brief's own text.

**190 - measured on a scratch copy of 452c5ade (n=1, gemini-2.5-pro, real spend labelled "measurement", copy deleted):**
| pass | actions | calls | price | time | result |
|---|---|---|---|---|---|
| Re-sort into headings | 174 | 5 (batches of 40) | 26.33p = 0.151p an action | 242 s | 160 moved, 14 already right, 0 unplaced |
| Consolidate (seven headings) | 174 | 7 (one per heading) | 28.33p = 0.163p an action | 268 s | 174 -> 66 live |
Together about 55p (0.31p an action). **66 live is inside the 40-70 target.** Per heading: Primary legislation 22->7, Civil Service Code 15->6, Civil Service Management Code 18->7, The accountability platform 47->25, Budgets and standards 13->6, Transparency and oversight 23->10, Training, guidance and the pilot 36->5. The model's answer is held to a validator (no action in two groups, a lead is never a component, a number not on the heading is refused); what it refused is shown ("Not applied: ..."), not hidden. A quality probe (`scripts/probe-lex-consolidate.ts`, 4.5p) on one heading folded 24 -> 6; the folds it made were individual Q&A rules into the mechanism "turn the avoidance taxonomy into diagnostic questions and mandatory countermeasures" - components, each quoted whole. **Charlie should still read a heading's folds before trusting the lot: that is why each heading has its own confirm and its own Undo.**

**How it works, and how it comes back.** Re-sort: one card (the seven, what each renames, the headings archived once empty, the price "from a measured run"), one "Go on"; the screen applies the batches as they complete; every action keeps the heading it was on (`headingWasId`) and Lex's reason (`headingReason`, shown on its record); "Undo the re-sort" puts every action back and brings back the archived headings they return to; archived headings sit under "Retired headings" with "Bring back". Consolidate: "Consolidate this heading" on a heading's own header, one card per heading with its own price, one "Go on". A component is folded into the mechanism's commentary as a QUOTE the code copies from the component's own row (cited "[#31]"; the model supplies only the numbers and a one-line reason, so it cannot put its own words in the quote), the component is kept (archived, `foldedIntoId`), the causes and conditions it carried move to the mechanism and are taken back on Unfold. A true duplicate goes through the existing merge (both originals kept). "Undo this consolidation" and the set-aside list's "Unfold" restore. **Nothing in either pass deletes; 84 assertions with a fake model check that the action-row count is unchanged and that Undo/Unfold return byte for byte.**

**UI A, B.** "Hide all headings" / "Show all headings" is one button beside Group (one write for every heading). The find box above the list matches title, statement and commentary (every word, "#12" too), filters as you type, reads "n of m actions match", clears with one press (or Escape). Both asserted in a real Chromium.

**Two consequences to decide, not hidden.** (1) The Proposal and Meeting Pack do not print an action's commentary, so a folded component's detail lives in the mechanism's commentary and is NOT in those documents; they carry the 66 mechanisms' statements. (2) A folded component's cost lines stay on the component and do not count while it is folded.

**Charlie's side:** nothing has been pressed on 452c5ade. After the push: the seed script writes his ten conditions and the seven-heading plan (configuration only); then step 1 shows "Re-sort into headings" and the conditions panel.
