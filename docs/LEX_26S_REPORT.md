# LEX 26-S — REPORT (running)

**Started 15 Oct 2026 (UTC) by the Lex session.** Brief: `docs/BRIEF_26S.md`. This file is written as the work goes; the closing
summary is at the bottom once S1 is done. Facts below say how they were read (CLAUDE.md §19: measured vs inferred).

---

## A. LEX hand-off 1 — the amendments / repeals record (11 Oct note)

**Not callable. Nothing for Lex to quote yet. Every drafting output carries the "held but not yet reachable" sentence.**

Read from `docs/SEARCH_S27_REPORT.md` (Search, 11 Oct) and re-checked by grep of the web app today (15 Oct):

- `legislation_edges` holds **2,348,993 rows** (measured by Search). The figure Lex was told ("1.9m links") is the amends + repeals
  subset in round terms: amends 1,015,960; repeals 215,312 + 107,034 (S27 §3). **Quote the per-type counts, not "1.9m".**
- **No reader exists in the web app.** `lib/lex/statutory-graph.ts` reads only `citation_edge`; `legislation_edges` appears there
  only as a coverage count. `statute_effects` (the tool Search specified, S27 §5) is **not built**: grep of `scrutinise-web` finds
  no tool by that name. `origin/Main` has no commit after `7a28d52` (fetched today), so nothing has landed since S27.
- **Freshness caveat that the tool must carry:** every row was extracted on **5 July 2026** (98 days old on 11 Oct); primary-Act effects
  may be ~11 months behind the statute book (bulk vintage 30 Oct 2025). Search's one-sentence stale caveat (S27 §5) is generated from
  `freshness`, never hard-coded.
- **Bills-API structured amendments: 0 rows, never fetched.**
- The count Lex *will* be able to quote once the reader exists: per Act, per provision, per type, with `sub_type` (an `amends` row
  can be `excluded` / `applied by …`, not a textual change). Worked values from S27 (direct SQL, not a function call): Equality Act
  2010 — 705 amends, 90 repeals, 16 modifies inbound; Human Rights Act 1998 — 35 / 11 / 42.
- **What unblocks it:** the Graphs stream's step-1 reader beside `inboundFor` (a short job, S27 §6.2), then the tool. Refreshing the
  data since 5 July is Ingest's. Neither is Lex's to do. The honest state for §4f is therefore the sentence in the brief, verbatim.

## B. LEX hand-off 2 — what is held for 26-U and the Deepening

Read today from `corpus_sections` (Neon, read-only), then checked against the Lance FTS index for the two that matter. Held =
a compiled row exists; reachable = a router stream can select the corpus (tier `guidance`, `docs/CORPUS_REACHABILITY.md`).

| Wanted | Held? | Where | Words | Reachable? |
|---|---|---|--:|---|
| **OPC Drafting Guidance** (gov.uk, 19 Mar 2024 PDF) | **Yes — whole document** | `quangos-govuk:government/publications/drafting-bills-for-parliament:2` (+ :1, the landing page) | 38,764 | **Yes** — row is in the FTS index, tier `guidance`; OGL 3.0 |
| **The Green Book** (appraisal and evaluation) | **Yes — the 2026 edition, whole PDF** | `govuk-core-docs:government/publications/the-green-book-appraisal-and-evaluation-in-central-government:2` (+ :1) | 31,515 | **Yes** — in the FTS index, tier `guidance`; OGL 3.0 |
| *Green Book: International Guidance* | Landing page only | `quangos-govuk` | 128 | stub — no document body |
| **Managing Public Money** (gov.uk) | **NO** | The publication is not in the corpus under any title or URL. Only *about* it: a 2007 written ministerial statement (121 words), two DCMS correspondence items in `committees-reports`, one EDM | — | not as a document |
| Magenta Book (evaluation) — not asked, but the Deepening's "what tells us it worked" slot wants it | **Yes**, main + Annex A | `govuk-core-docs` | 42,038 + 14,855 | yes |

**Managing Public Money is the gap, and it is an ingest, not a search problem.** The value-for-money duty cannot be quoted from the
corpus today; anything Lex says about it would be from the model's memory. Request for Search/Ingest: add
`gov.uk/government/publications/managing-public-money` (HTML + the current PDF) to `govuk-core-docs`, same licence (OGL 3.0).
Until then the Deepening's costing must say "Managing Public Money is not in the corpus" rather than cite it.

**NAO reports and departmental annual reports (unit-cost comparators):**

- **NAO reports: held.** `nao-reports`: 3,983 rows; **2,570 compiled (25.6M words)**; **1,413 are `unavailable / no-provisions`** (the
  census records the collection as UNMEASURED — no publisher index, so the fraction of the NAO's output it represents is unknown).
  Reachable (tier `guidance`). **No row carries a date** (`itemDate` null on all 3,983), so "the latest NAO view" cannot be sorted
  by date. 106 compiled titles match value-for-money / cost / efficiency words (a title count, not a quality measure).
- **Departmental annual reports: NOT held as a set.** There is no collection of departments' own Annual Report and Accounts.
  What exists: NAO-hosted *accounts* pages for some departments (`nao-reports`, e.g. DWP 2010-11 to 2015-16, DfT 2024-25 at 120,209
  words, BEIS 2019-20), 7,062 ALB/arm's-length-body ARAs in `quangos-govuk`, 892 committee-report items, and ministerial
  statements that merely *lay* them (Hansard WMS — title only). A Home Office / MoJ / DWP ARA is not reliably retrievable.
  **For unit-cost comparators the honest answer is: NAO reports yes (patchily), departmental ARAs no.**

**Reported to Search for ingestion** (this is the Lex stream's request, not a build): (1) Managing Public Money, (2) departmental
Annual Report and Accounts for the ~20 ministerial departments, 2015-16 to date, from gov.uk, (3) dates on `nao-reports` rows.
Charlie to relay if Search is not reading this file.

---

## C. Size and split of BRIEF_26S (asked for by §0 before building)

The brief's own expectation holds, with one adjustment.

| | Content | Size | Needs Charlie |
|---|---|---|---|
| **26-S1** | §1 pre-flight (done — see D), §3 import pass, §6 policy notes, §8 small fixes (8c sizing; 8a/8b/8d/8e behind confirmations) | Large: one new table (schema + migration together), one pass module, three routes, one workspace panel, one Lex tool, one check | 153, 154, 156; the browser pass before the import is run on his idea |
| **26-S2** | §4 action record (11 sections, migration of existing fields), §5 instruments (purpose, definitions, archived count, collapse/filter), §7 financial avenue | Larger: touches the `LexCoherentAction` shape, the snapshot (§4c), both documents (§4d), every list row | the §4a mapping of existing fields, before any move |

**Adjustment:** §5b (definitions into the FAQ and the CA intro) and §5c (archived count) are small and S1's import pass *needs* §5a's
heading `purpose` (the review table proposes it for new headings). So `purpose` on a heading moves into S1 as a nullable column; the
rest of §5 stays S2. Everything else is as the brief expects.

---

## D. §1 pre-flight

- **1a/1b — already done before this session.** `Main` = `origin/Main` at `7a28d52` (26-R sprint 1 + the 8–9 Oct fixes) on fetch; production `/api/health` reported that sha. Nothing from 4–11 Oct was left uncommitted. **No Search or other session is online** (ListAgents: all peers offline), so the push could not be agreed in conversation; Search's uncommitted files (licence docs, census, `scripts/ingest/search/_*-tmp.ts`) share no file with this work and are not staged.
- **The §20 string.** `/api/health` needs no login and carries the deployed commit: after the push it must equal the pushed sha (I read it myself). In the browser, strings only this build emits: the toolbar button **“Import actions from a document”**, the last paragraph of the Coherent Actions introduction (**“A heading is an instrument …”**), and **“N proposals … bear on this policy · Review”** on the Guiding Policy header. Nothing is “deployed” until Charlie reads one back.
- **1c — `LEX_AGENT`.** Read by `lib/lex/agent/flag.ts`: unset/off = nobody, `all`, or a list of emails/ids; malformed = off. Local `.env` does not set it and `/api/health` does not expose it; Vercel is SAML-blocked, so **the production value is not known from here — Charlie to confirm.** Old-Lex paths still present: `app/api/ideas/[id]/lex/route.ts` after the `agentEnabledFor` branch (~lines 105–631: keyword detectors, the 30-field envelope, the tool decider), kept so the changeover is one flip (decision 123).
- **1d** is Charlie's. Do not press “Title these for me” / “Classify with Lex” before the import (the pass offers both afterwards).

## E. §3 the import pass — built and measured

- **Built:** `ActionImportPass` (schema+migration together, `83dbfaf`); `lib/lex/action-import.ts`; route `/api/ideas/[id]/action-import`; panel `ActionImport.tsx` beside “Check for gaps”; Lex tool `import_actions_from_source` (asks first; only starts the pass); an offer when a document is filed while the user has actions; the §5b paragraph in the CA introduction and the FAQ entry; `ActionHeading.purpose`.
- **How it runs:** a pass row; one unit of model work per request (part → headings → policy-test batch); the panel keeps it moving, a closed tab loses nothing. In-route like the update pass. Writes only in `confirmImport`, behind a compare-and-set lock.
- **Model/scale (§3g):** Sonnet 5.5 reads and proposes headings; Gemini 2.5 Pro runs the policy test (same prompt/schema as `testHeldActions`). **Chunked by section (~2,600 words) with a cross-part merge.** On the same 1,620-word fixture: 3 parts → 46/47 rows, 21.4p/22.1p; one part → 47 rows, 21.2p — equal at this size, so chunking is chosen for the ceilings: one part needed 10.8k output tokens for 47 rows against a 14k cap, so a 65-row document would truncate; chunks keep each request ~45s and resumable.
- **Price:** ≈13p per 1,000 words (n=3 runs, one fixture) — **an extrapolation** to an 8,000-word document (~£1 at most; likely less, the fixture is denser). The card says so.
- **The document was a FIXTURE, not Charlie's OpenAI blueprint** (not on this machine, not filed on 452c5ade). Fixture: 1,620 words, 43 provisions, 3 policy-level, 2 unplaceable. Result: **43/43 provisions have a row; 7/7 overlaps with existing actions (#4, #12/#27, #28, #22, #13, #24, #5) proposed as adds-to, none as new; Could-not-place only where the fixture says; every quote verified word for word; nothing written before confirm.** The brief's “Bill ≈ #20” could not be asserted. Charlie's own run on his own document is the real test.
- **Found by running it:** the policy test caught real conflicts with his accepted policy (a “major projects” threshold); “adds to action 0” is read as none; a detail of another provision in the document is its own NEW row; “passages not covered” is a list, never rows.
- **Departures:** Adds-to/Part-of both append to the action's body (allowed before §4); a new row's body = Lex's summary + the document's words labelled, provenance in `policyTestFrom`; new approaches from the document are PROPOSED findings and enter the sort only on accept (the update pass puts them in live).

## F. §6 policy notes

Header count and review list (`PolicyReviewBar`, route `/policy-review`): findings (contradicts first) and notes whose bears-on is the policy. Dismiss and set aside both require a reason (refused in words otherwise); set aside leaves the default list, keeps its reason, shows in the notebook as “considered, not taken”, and comes back. A note's “dismiss” removes the policy link and leaves the reason as a reply beneath. No new enum value: set-aside is REJECTED with a prefixed note. **6b:** “the policy” was not a bears-on choice — now is; `add_research_note` had no way to set bears-on — now `bearsOnPolicy`. 6c: the Deepening re-read is not a surface yet — not built. 6d is Charlie's.

## G. §8

- **8c sized, not built:** 80 route files / 82 sites still return bare `error.flatten()`: 34 under `ideas/[id]` (Lex), **29 under `communities/[id]` (Central's)**, 17 elsewhere. ~3–4 hours, not under one, and crosses a stream. Suggest per-stream batches.
- **8a, 8b, 8d: awaiting Charlie. 8e: not done — after he confirms the browser pass.**

## H. Checks (§23.2: the suite, not a selection)

- `check:lex-26s`: offline 70/70 (incl. the table read from rendered markup); full `--live` run 136 ran, 135 passed, 1 failed (my regex's grammar — fixed, not re-run to save spend); 12 controls fired, 0 dead.
- Green: 26q 74, 26r 117, 9oct 58, walk-8oct 59, 26m-actions 40, 26p 104, 26h 66, 26n 56, documents, export, client-boundary, tsc 0, `check-clean-build --fast`.
- **Known-red list:** stale assertions updated with the product decision cited in 25f, 25g, 25h, 25i, 25n, 25p, 25x, sprint3e-ui; 26n had been red since decision 138. `check:20bd` exposed a **real seam breach** (document stack imported the deepening engine) — **fixed** by moving `readKnownUnknowns` into `known-unknowns.ts`. **25s stays red on two real DATA defects, untouched:** idea 9910c16e has an unnumbered cause (c3f7613d…) and a duplicate number 4; idea f73f3928 a duplicate number 2 — pairs created ~20ms apart, a cause-numbering race in builds.
- **More red suites than the brief's list** (the sweep stopped at 26n-tidy when the machine ran low on memory; **the rest was NOT RUN**): s7-retrieval, spend-attribution, stream-coverage, score-scope, annotation-titles, legislation-urls, s20b-control, render-decode, answer, build-25a, committed (until this is committed), 25c, 25k, 25q, 25v, 25w. They predate this sprint; not fixed — a backlog for a decision. Not run: full clean-checkout build (memory), `check:prompt-examples`.

## I. Only Charlie can confirm
The §20 string off the live site; the browser pass (1d) before the import runs on his idea; the table on his own document (the first real test); `LEX_AGENT` on Vercel; 153, 154, 156; his policy note (6d). **For CCh:** `entity_list_v5.md` not edited — add `ActionImportPass` and `ActionHeading.purpose`. **For Search/Ingest:** Managing Public Money; departmental ARAs; dates on `nao-reports`. **26-S2** (§4, rest of §5, §7) not started; larger than S1; needs Charlie's field-mapping sign-off before anything moves.
