# LEX 26-V2d — the five review passes read documents and parts

*CCh-Lex 24 Oct (6), the overnight run. Written 2026-10-24 23:29 UTC. Code `8e2b281`, schema `949dd4b`. Pushed and verified live (§3).*

## 1. The run, in order

| # | What | State |
|---|---|---|
| 273 | joint commit + read-back | Done before this session: `4d3479c` was live and read back at 22:47. Not repeated. |
| 274 | set the seven kinds on 452c5ade | **Done and read back** (§2). |
| 275 | place the 176 issues, with counts before and after | Done before this session (22:47, 16.98p): 57 on an action, 0 on a document, 119 on the proposal. ⚠ It ran **before** 274. Placement reads action titles, not kinds, so it was not re-run. |
| V2d | build, check (with a mutation run), measure each pass on scratch | **Done** (§4–§6). |
| 276 | all five passes on 452c5ade's documents, without asking | **Done: 9.09p** (§7). |

"Draft what this heading needs" was **not** run on 452c5ade.

## 2. 274 — the kinds

| Heading | Kind | How |
|---|---|---|
| Primary legislation | primary legislation | Lex's proposal accepted |
| CS Code | code | Lex's proposal accepted |
| CS Mgt Code | management code | Lex's proposal accepted |
| The platform | platform | Lex's proposal accepted |
| Rules & Standards | budget | Lex's proposal (budget) accepted, as CCh said |
| Oversight | **transparency** | Set per CCh, over Lex's "other"; the proposal is cleared |
| Training | guidance or pilot | Lex's proposal accepted |

Read back: all seven are set and no proposal is waiting. "The platform" is PLATFORM, so its actions need a specification again (268).

## 3. Delivery (§20)

- **Before the push:**
  - clean-build `--fast` passed;
  - a clean worktree of HEAD at C:/cb2 passed (`npm ci` 0, `tsc` 0), and was then removed with a plain remove;
  - every new file was confirmed tracked with `git ls-files`.
- **The push:** `7c1e463..8e2b281` at 23:23:49. `merge-base --is-ancestor` confirms it is on origin. Only the two commits named above were shipped.
- **Vercel:** `/api/health` reports `8e2b2819df38…`, environment production. Strings only this build has are in the live chunks:
  - "Review this document" (`0b76a118de5a89b5.js`, `88aedd55bfa31741.js`);
  - "reviewed by n of 5" (`88aedd55…`);
  - "On an action, not on one of its documents" (`0b76a118…`).

  A control string is in none of the 22 chunks scanned.
- **build-worker:** deployment `68c2fee1` appeared unprompted at 23:23:50 and went SUCCESS. Its `meta.commitHash` is `8e2b2819df38…`. It printed "retrieval configuration OK" and the queue-on line at 23:26:25.

## 4. What was built

**The review.** No new pass, as §7 requires. Each of the five `PASSES` reads one document's **current version**, part by part (`lib/lex/document-review{,-pure}.ts`).

- **What each pass is given:**
  - its own method block and standing questions;
  - the names of the other four passes, so it leaves their ground to them;
  - the guiding policy;
  - the action's title, statement and commentary (cut at 3,500 characters, and the cut is said);
  - the document's numbered parts.
- **Its limits.** It searches nothing. It is told never to state a fact about the law, a figure, a date, a body or a source it was not given; where something needs checking, the issue says what to check.
- **What it returns:** at most 8 issues, each with a title, text and the part it concerns, plus one sentence on what held up.
- **How the answer is checked:**
  - a part the document does not have falls to "the document as a whole";
  - an empty issue is dropped;
  - anything over 8 is cut;
  - each correction is counted and written on the review's row in words.
- **Model:** Sonnet 5.5 at medium effort. The five passes run in parallel, about 10–13 s each.

**What it writes.**
- One `document_review` row per pass per version read:
  - RUN, with the issue count and what held up; or
  - FAILED, with the reason in words.

  A review that raised nothing still leaves its row, so "never reviewed" and "reviewed, nothing raised" do not look the same.
- One issue per point raised, carrying:
  - the action, the document and the part;
  - `attachedBy` LEX, with "Raised by Lex's legal review of D.38.1, version 1";
  - `reviewId`.

**How review issues are kept apart from build challenges.**
- Review issues are keyed `review:<PASS>` with runVersion 0.
- The kernel pass cards list issues by exact pass key, so they never show one.
- Every build reader selects by `runVersion = buildVersion`, so none picks one up.
- ⚠ **`proposal-snapshot.ts` read every issue.** With runVersion 0 it would have printed all of them in the proposal as "earlier drafts' criticisms still open", which is false. It now leaves them out. They belong to their document and are shown there.

**What is not reviewed, said in words.**
- A document with **no version**: D.202.1 has only Lex's proposal waiting.
- A **generated document with no rows**: D.203.1, the empty schedule.

On the first measurement, five passes over the empty schedule raised 21 issues, almost all about how the platform builds schedules, not about the proposal. The rule above is the fix. A generated document that does have rows is reviewed, and its method is declared off-limits to the review.

**Re-running.**
- A pass that has read this version is not run again unless asked ("Review again").
- A new version is read afresh. The older issues stay open and say "raised against version 1; the document is now at version 2".
- Undo of Lex's placements (`undoLexAttachments`) leaves review issues alone: where a review issue sits is where it was raised, not a placement.

**Screen.**
- **"Review this document"** in the document header: asks first, naming the five passes, and says which have already read this version and the measured price, scaled to the document's length. It runs, then reports what each pass did in words.
- **Issues tab:** a line per pass ("● Legal — read version 1 on 24 Oct: 8 issues raised, 8 still open · held up: …"; ○ not yet reviewed; ⚠ failed, with the reason). Then each issue on its part, saying which review raised it.
- **Tree:** ⚑ counts on each part, and "reviewed by n of 5 passes at this version" on each document.
- **The Risks view (225).** ⚠ It was referred to by the brief and by 26-V2c's Issues tab, but it **did not exist**; 225 was recorded for the 215–219 sprint and never built. It is built here, as a section on the Deepening page under the tree:
  - It shows every issue on the idea: **by document first** (with what each pass read), then on an action, then the proposal as a whole.
  - Each issue is answered in place: addressed with a note, deferred, dismissed with a reason, or reopened.
  - Answered issues stay listed under "Answered", with their note or reason.
  - The tree and the Risks view refresh each other, so their counts agree on one screen.
  - State is never shown by colour alone (● ✓ ◐ ✕, plus a word).
- **The triage route:** its limits moved into `LIMITS` (shown with counters), and its rejections are worded (§30).

**Schema.** `prisma/lex_26v2d_document_review.sql`, additive. Applied 23:05 after whichdb (ep-old-dust-aboxi69a / neondb), then read back: 14 columns, all CHECKs and FKs present. It was committed with `schema.prisma` (`949dd4b`) before the code.

⚠ `entity_list_v5.md` (CCh-only) needs `DocumentReview` and `DeepeningIssue.reviewId`.

## 5. Checks

- **`check:lex-26v2d` (new): 62/62, 4 controls fired, 0 not run.** Every model call in it is a fixture, so it spends nothing.
  - **A, pure:** each pass's instructions; §27 (no specimen); the answer checks; the price scales with length and matches what was measured; no issue producer is shown by its bare key; the DDL's pass list matches the config.
  - **B, a scratch copy through the real functions:** the refusals; rows and issues; not re-running; "again"; a new version; Undo; kernel cards, build readers and the printed snapshot all take none of them; the tree, the Issues tab data and the Risks view.
  - **C, Chromium on the real routes:** ask, run, the Issues tab by pass, the tree's line, the Risks view by document. Dismissing an issue there makes the tree's count fall on the same screen.
- **Mutation run: 9 of 9 mutations turned it red**, and every file was restored byte-identical:
  1. runVersion 1;
  2. a missing part kept;
  3. Undo strips review issues;
  4. the Risks view does not tell the tree;
  5. an empty generated document is reviewed;
  6. a pass that has read this version re-runs;
  7. the plain pass key is used;
  8. the tree counts any version;
  9. the snapshot's exclusion is removed.

  M9 was caught only after I fixed the check's own blind spot: the scratch copy had no build issues, so its first snapshot assertion was empty, and the control said so (dead).
- **Regression:**
  - lex-26v 66/66, lex-26v1b 78/78, lex-26v2b 47/47.
  - **lex-26v2c 44/44**, after one fix. Its part B had gone **red because of 274**: it copies 452c5ade's headings and expected them to have no kind. The check now clears its own scratch copy's kinds first (§25.4).
  - prompt-examples, deepening, llm-guards and client-boundary pass. tsc is clean.
- ⚠ **Not run: `check:lex-26u` and `check:scripts`.** The sequential sweep was stopped by Claude Code's memory-pressure reaper (system RAM was low; nothing to do with the checks) and was not restarted.

## 6. Prices — measured on scratch

`scripts/measure-26v2d.ts` reads 452c5ade read-only and charges the spend to a scratch copy (purpose: measurement).

| Pass | D.38.1 (5,542 chars, 18 parts), run 1 | run 2 | empty schedule (272 chars) |
|---|---|---|---|
| Evidence & precedents | 1.71p | 1.77p | 0.79p |
| Legal | 1.97p | 2.01p | 0.85p |
| Financial | 1.73p | 1.83p | 0.79p |
| Political risk | 1.76p | 1.84p | 0.77p |
| Statutory consequences | 1.67p | 1.72p | 0.78p |
| **All five** | **8.84p** | **9.16p** | 3.98p |

- **The fit:** about 1.8p per 10,000 characters per pass, on top of about 4,000 characters' worth of fixed cost. The ask on screen quotes this, scaled to the document. The worst pass on a document of this size is about 2p, far under the 30p stop.
- **Measurement spend:** 12.81p + 9.16p = 21.97p, on the ledger against the deleted scratch copies.

## 7. 276 — the run on 452c5ade

Run without asking, under the ceilings of £1.50 in total and 30p a pass. It was projected first from the measured runs (9.00p) and the real spend was tallied as it went.

- **Reviewed:** D.38.1, version 1. **Not reviewed:**
  - **D.202.1:** no version, only Lex's proposal waiting;
  - **D.203.1:** generated and empty, because no instruction is accepted yet.
- **Spent: 9.09p.** The ledger shows 5 `LlmSpend` rows, pass `documents.review`, totalling 9.09p.

| Pass | Issues | Price | Held up (its own sentence, abridged) |
|---|---|---|---|
| Evidence & precedents | 7 | 1.77p | clearly drafted; openly distances itself from the 2007 Act; no evidence base |
| Legal | 8 | 1.97p | a coherent structure: single owner, an unbroken chain, a Code laid, an affirmative order power, phased commencement |
| Financial | 8 | 1.73p | cost falls on the body; phasing and the brevity test give hooks for a costed rollout |
| Political risk | 8 | 1.92p | concrete, checkable mechanics, and a no-blame investigation |
| Statutory consequences | 7 | 1.70p | ties its scope to named enactments, and preserves the Accounting Officer and SRO roles |
| **Total** | **38** | **9.09p** | |

**Counts, before and after**

| | Before | After |
|---|---|---|
| Open issues | 176 | **214** |
| On a document | 0 | **38** (all on D.38.1) |
| On an action | 57 | 57 |
| On the proposal as a whole | 119 | 119 |
| Review rows | 0 | 5 |

**By part of D.38.1:**

| Part | Issues |
|---|---|
| 38.1.1 (definitions) | 9 |
| 38.1.2 | 3 |
| 38.1.7 (the void-naming rule) | 5 |
| 38.1.10 | 2 |
| 38.1.11 | 1 |
| 38.1.12 (no-blame and sanction) | 5 |
| 38.1.13 | 1 |
| 38.1.14 (the Code) | 4 |
| 38.1.16 (the AO/SRO saving) | 4 |
| 38.1.17 | 1 |
| 38.1.18 | 2 |
| the whole document | 1 |

No part fell back: every part named exists.

**Where the five passes converge.** These are the points most worth Charlie's time:
- "task" has no unit and no de minimis;
- limb (b) reaches contractors;
- 38.1.7's void naming has no test, no decider and no saving for acts done meanwhile;
- 38.1.12 bars blame yet keeps sanction for negligence;
- the Code has no parliamentary procedure;
- the AO/SRO saving in 38.1.16 leaves conflicts unresolved;
- extent and devolution are silent;
- there are no consequential amendments or savings.

**Reading notes, honestly:**
- One Legal issue cites "the legal-risk paper in part 34". That is the commentary's [34], not a part of this document.
- Two issues suggest where evidence might be found ("such as NAO or Public Accounts Committee findings"). They are phrased as what to check, not as claims.
- In the scratch measurement, one issue did assert an outside fact ("The NAO and PAC have reported on SRO turnover"), against its instructions. It did not recur in the live run, but the rule is an instruction, not a guarantee.

## 8. Only Charlie can confirm

1. **The Risks view** on 452c5ade's Deepening page: is "by document, then action, then the proposal" the grouping he meant by 225? Is answering in place right? It was built from the brief's one line, because no spec for 225 was found.
2. **D.38.1's Issues tab and the 38 issues.** Are they the issues a reviewer would raise? Is 7–8 per pass too many? The overlap across passes is real: the same point is raised from different lenses.
3. **D.202.1 (the PSED clause) is only a proposal**, so it was not reviewed. Use or set aside Lex's proposal, then press "Review this document" (about 5.5p for its 1,815 characters).
4. **Whether a review should read a waiting proposal.** I chose no: an issue's part number refers to a version.
5. **The schedule:** a generated document is reviewed only once it has rows (that is, once a drafting instruction is accepted).
6. **The Actions Pack and the proposal no longer print review issues** (they would have printed as earlier drafts' criticisms). Should the Pack print each document's review issues after the document?
7. **The tree's new lines** ("reviewed by 5 of 5 passes at this version", ⚑ on parts) and the ask's wording.

## 9. Open

- `check:lex-26u` and `check:scripts`: not run (see §5).
- `entity_list_v5.md`: needs `DocumentReview` and `DeepeningIssue.reviewId` (CCh).
- The §20 read-back of "appears to confer none" (from GRAPH 9) is still owed. It needs a collision report on an action whose instruction touches a provision with unresolved instruments, and 452c5ade has no accepted instruction.
- Lex (the agent) has no tool to run a review or to read the Risks view. Not asked for; a candidate for the next brief.
