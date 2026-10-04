# LEX 26-H — the stages, and who has looked at it: report

*4 October 2026. BRIEF_26H (written 26 Sep) had only been half run: the dashboard/ideas ordering work logged on 27 Sep belonged to an earlier version of the same brief. Nothing of §1–§7 below existed — no stage banner, no seven-stage vocabulary, and "First Scrutiny" was still sitting on two documents. This is that work.*

**State: built and committed locally; NOT pushed, NOT deployed, so nothing has been read back off the running site.** `check:lex-26h` **53 checks run, 53 passed, 4 controls fired, 0 dead**; `tsc` 0; `check:documents`, `check:export`, `check:client-boundary`, `check:lex-25d`, `check:lex-25m`, `check:lex-26q` unchanged and green; `check:lex-25w/25x/25p`, `check:20bd` red exactly as before this change (same counts).

## ⚠ What I could not do: `SEVEN_STAGES.md` does not exist

The brief names it as "the reference, which carries the wording", and says the FAQ is to publish **its long version** (what, why, how and what-you-get for each stage) including the **committee-effect paragraph at stage 4** and the **"71 of 1,169 impact assessments carry a real post-implementation review" paragraph for stage 7**. I searched the repository, `docs/`, Downloads, Documents and Desktop: **no such file**, and none of that wording is anywhere else in the repo. I did not write it from the brief's one-line descriptions — it is Charlie's argument and his figures. **So the FAQ carries the seven stages with their one-liners, In Force marked not yet available, the caveat verbatim, and what "First Scrutiny" is — but not the long version.** Send the file and the FAQ entry is a data change (the stage copy is already one module, `lib/documents/stage-banner.ts`).

## What was built

| § | Done |
|---|---|
| **1 / 2a** | **"First Scrutiny" is now a review status only.** Stage 2 is **The First Draft** everywhere it is named by the new code. The old per-document notes on the Written Evidence and the One-Page Summary (`FIRST_SCRUTINY_NOTE`, `isFirstScrutiny`) are **removed** — and with them a real defect: they were switched off when `Idea.stage` reached 3, i.e. the flag disappeared on **28 of 119 ideas** on the strength of a stage change, which is exactly the "inferred review" §5b forbids. |
| **2 / 2b** | One module, `lib/documents/stage-banner.ts` (no imports — client-safe): the seven stages exactly as the brief names them, Stage 6 "Submission". |
| **3** | **In Force** is listed on every banner and in the FAQ, **marked "(not yet available)"** in the same words in both, and nothing is built for it. |
| **4 / 4b** | **The banner opens every generated document, internal ones included**, before anything else, in the brief's order: the stage in bold → review status → the seven stages one per line with this one marked *in words* ("— this document") → the caveat verbatim. Applied at the **two places a document kind is mapped to a builder** (`export.ts` `buildFor` — Initial Background, Initial Questions, Written Evidence, One-Page Summary; `proposal-export.ts` `buildFor` — Proposal, Summary, Meeting Pack, Evidence Pack), so no builder can leave it out. **Stage of a document is derived from what it is**, not from `Idea.stage`: briefing and questions = **1**; anything built from the kernel = **2**; **3** when a Deepening pass has actually run (`DeepeningPass.status = RUN`). |
| **5** | Review status has named counterparts: **First Scrutiny**, **Privately reviewed — N reviewers, date**, **Publicly reviewed — N reviewers, date**, and `reviewStatus()` turns a record of either into that text. A review with no reviewers or no date is not a review. Every banner also says what the other two statuses are and that the platform does not yet record them. |
| **6** | FAQ: new entry "The seven stages of a proposal — and what 'First Scrutiny' means" (stage list, caveat, the review-status explanation, In Force). **Long version not published — see above.** |

## §5a — can the platform tell whether a review happened? **No. So every document is First Scrutiny.**

`IdeaReview` is the only review-shaped table (12 rows). It is **not** private or public scrutiny as the seven-stage model defines them: it is a 1–5 quality rating (`app/api/ideas/[id]/reviews`), open to any signed-in user once an idea reaches platform Stage 3, and the endorsements route also writes a `VIEWED` row. Nothing records that **allies** reviewed (Stage 4) — nothing separates a private reviewer from a public one — and nothing records that **opponents** did (Stage 5). I did not count ratings as reviews (§5b). The counterparts are therefore **defined and tested but unreachable today**: `ReviewRecord` is passed as "nothing recorded", and the day a review system exists (§24 of the original design) the change is to populate that record. **`entity_list_v5.md` is unaffected — no new storage.**

## §2c — where the product's existing stage schemes sit against the seven (REPORTED; the workspace header is NOT changed)

There are **three** schemes in the product now, not two.

| Seven stages (Charlie, 25 Sep) | Workspace bar (`lib/lex/stages.ts`) | Five platform stages (`Idea.stage`; CLAUDE.md §3) |
|---|---|---|
| 1 · The First Pass | **1 · The Idea** — say what you want to change, add information, re-run | 1 · Create (private) |
| 2 · The First Draft | **2 · The Strategy** — work through what Lex drafted, make the decisions | 2 · Draft (invitation-only) |
| 3 · The Deepening | **3 · The Deepening** — more research, evidence, harder questions | *(inside Draft — no platform stage)* |
| 4 · Private Scrutiny | — | 2 · Draft: the invited collaborators |
| 5 · Public Scrutiny | — | 3 · Develop (link-only public) |
| 6 · Submission | — | 5 · Legislate (to Parliament) |
| 7 · In Force | — | — |
| — | — | 4 · Campaign (voting, endorsements) — **no counterpart** |

**Reading it:** the workspace bar and the seven stages are *nearly the same scheme* for 1–3 (two of the three names already match; "The Idea"/"The Strategy" against "The First Pass"/"The First Draft" are the only differences). They describe **work**. The five platform stages describe **who can see the idea**, and Campaign has no seven-stage counterpart, which is why they cannot be merged by renaming. **The conflict worth deciding is the bar:** a workspace that says "2 · The Strategy" over a document that says "Stage 2 document: The First Draft" is two names for one thing on one screen. **My recommendation (yours to decide):** rename the bar's first two to The First Pass / The First Draft, keep The Deepening, and keep the five-stage names for visibility only. Until then the FAQ states the difference in one sentence ("the five stages say who can see your idea; the seven say where the work has got to"). **I changed nothing in the workspace header.**

## What was NOT done or not verified

* **No string has been read back off the running page** (§7's last criterion): not pushed. The banner is verified on the **rendered .docx** (the stage sentence is the first text in the body, the review status, "(not yet available)" and the caveat are in the file) and on the **model for all eight kinds** of Charlie's idea 452c5ade (cold read; the check wrote nothing). The PDF is checked only to render; its text was not read back.
* **Charlie's idea reads as a "Stage 3 document"** because a Deepening pass has run on it. That is my derivation of "a deepened proposal"; a single completed pass is enough. If Stage 3 should mean more than that, it is one line in `documentStage`.
* **Documents already generated and stored keep their old text** until regenerated: the banner is applied at generation, and the stale-detection fingerprint is taken from the builder's own content, so a stored document does not show as out of date merely for lacking one. A generated-then-frozen document's banner is true as of when it was made.
* **The online proposal view and any in-app preview that does not go through these two `buildFor`s** carry no banner. I did not find one that builds a model another way, but I did not sweep every route for it.
* **FAQ long version, committee-effect and 71-of-1,169 paragraphs**: not published (file missing).
* Not pushed, so §20's four delivery checks are not run.

## Files

`lib/documents/stage-banner.ts` (new) · `lib/documents/export.ts`, `proposal-export.ts` (banner applied; `export.buildFor` now exported for the check) · `build-one-page-summary.ts`, `build-committee-evidence.ts`, `lex-26g-document-names.ts` (the old First Scrutiny note and stage-based test removed) · `lib/faq-content.ts` · `scripts/check-lex-26h.ts` (+ `package.json` `check:lex-26h`).
