# BRIEF — INGEST CENSUS C1: real denominators, an email that cannot lie, and the authorised backfills

**Stream:** CC-Ingest · **Written:** 23 Aug 2026 (consolidated) · **Author:** CCh for Charlie
**Inputs CC must read first:** `docs/CORPUS_COVERAGE_AUDIT_22_AUG.md`, `docs/CORPUS_COMPLETENESS.md`, `ADDENDUM_V36_SEED_ORDER.md`, `scripts/ingest/shared/progress-reporter.ts`, `scripts/ingest/v36/worklist.jsonl`, `docs/CORPUS_REGISTER_V31.csv` (the scaffold this sprint fills), `docs/DAILY_EMAIL_V31_REBUILT.md` (the target email, fully populated).

**Charlie's decisions of 23 Aug, which this brief executes:**
1. Pre-2001 case law: **authorised** — walk to size it, then fetch without coming back for approval (Part E).
2. `et-decisions` landing pages: **delete and re-fetch now** (Part F).
3. The daily email keeps its headline, gains every missing section, and must show for **every collection** the total the publisher lists and the % we hold (Parts B and C).

**Spend ceiling for the sprint: US$250 of embedding.** Use the Gemini **batch** endpoint (`$0.075 / 1M tokens`, not the standard `$0.15`). If projected spend on any Part exceeds its estimate by more than 2×, stop and report before continuing. Charlie approves Vercel/Railway/Neon configuration changes directly — report, don't change.

---

## 0. Why this sprint exists

The daily email prints `[100% complete]` for 62 of 77 collections. For 46 of them the "target" (`corpus_targets.est_sections`) was **set by copying the compiled count** once the queue drained and stamped `est_is_confirmed=true` (`v19-rebaseline-*.ts`, `v20-rebaseline-drains.ts`, `v19-align-p1.ts`, `v19-fix-si-residue.ts`). A denominator equal to its own numerator is not a target: the printed figure is `compiled / compiled`, which is 100% for any corpus including an empty one.

The one tier with a real, publisher-walked denominator — legislation — is at **44.1% of published instruments** (**77.4%** once instruments the publisher marks as having no text are excluded). `primary-acts-pre-2000` is at **21.4%** of published Acts (38.1% of Acts that have text) while the email printed 100%.

Charlie has been reporting "corpus complete" on the strength of that email. This sprint makes the measurement real, makes the email incapable of the lie, and then — because the decisions are made — runs the backfills.

Standing principle, now written down: **a check that cannot fail is not a check; a denominator set from the numerator is not a denominator.**

---

## 1. Definitions (used exactly as defined, in code, docs and email)

| term | meaning |
|---|---|
| **unit** | the thing the publisher counts and we can match one-for-one: an Act or SI (instrument), a sitting-day file, a judgment, a decision, a report, a petition. Never a section and never a chunk. Sections are ours; units are the publisher's. |
| **held_units** | units for which at least one `status='compiled'` section exists in `corpus_sections`, matched on the publisher's id — **both** regnal and calendar ids for legislation (the Vagrancy Act 1824 is `ukpga/Geo4/5/83`, and a lookup on `ukpga/1824/83` returns zero rows and manufactures a false gap). |
| **published_units** | units the publisher's own index lists, obtained by walking that index — an entry walk, not a `totalResults` header unless the header is proven to agree with an entry walk on ≥3 samples. V36 found the header absent on every `uksi` year feed. |
| **coverage** | `held_units / published_units`, as a percentage of **units**, printed with both numbers beside it, always. |
| **MEASURED** | `published_units` came from a publisher walk stored on disk with a date. The only state that may print a percentage as fact. |
| **CLAIMED** | a target exists that differs from held, but its provenance is unproven. Prints `held / target` with "provenance unproven". |
| **DECLARED** | no publisher index exists (e.g. "White Papers"); we wrote a scope list in `docs/CORPUS_SCOPE.md` and count against it. Prints `held / declared` labelled DECLARED — never a bare %. |
| **UNMEASURED** | none of the above. Prints the held count and the word UNMEASURED. No percentage, no tick. |
| **HOLLOW** | a held unit whose text is not the unit (landing page, dot-leader, stylesheet, truncated PDF). Counted in `held_units`, reported separately as `hollow_units` so coverage can be shown net. |
| **searchable corpus** | sections `runSearch()` can return today: compiled `corpus_sections`, excluding retired collections and excluding the legacy `LegislationSection` table. This — 18,243,806 today, not 19.19M — is the headline number. |

The string `100% complete` is **forbidden** in the renderer unless state is MEASURED **and** `published_units ≤ held_units ≤ published_units × 1.02`. Held above 102% prints `⚠ denominator suspect (N% of published)`, never a tick.

---

## 2. Part A — Audit (read-only on the database; nothing written to Neon in Part A)

**A1. Provenance of every target.** For every `corpus_targets` row print: `corpus_key, est_sections, est_is_confirmed, compiled, est==compiled?, script that last set est (grep the repo), date set`. Output `docs/census/A1_target_provenance.md`. Expected: 46 rows where `est == compiled`. For the four the email ticks with a *different* number (`impact-assessments 18,759`, `erskine-may 2,038`, `scottish-courts 13,070`, `ico 26,576`) state where each number came from — URL and date if from a publisher page; otherwise they are CLAIMED.

**A2. Register from live data.** Regenerate `docs/CORPUS_REGISTER_V31.csv` from the live database using the scaffold's columns. Every collection in `corpus_targets` appears (live, retired, blocked, not-started) plus the legacy table as its own row. `held_sections` must sum to the compiled total (today **18,272,435**) with the retired rows shown separately and the legacy row outside the sum. Print the reconciliation at the bottom of the file. Do not overwrite the scaffold's `denominator_source_to_walk` leads without reason — they are CCh's best reading, marked "CC to verify"; correct where wrong and say so.

**A3. Unit sanity — find the hollow units.** Per collection: count of sections with `< 15` words, `15–20,000`, `> 20,000`, plus median words/section. Flag every collection where `< 15` exceeds 5% of rows or `> 20,000` exceeds 1%. Known cases the scan must rediscover on its own (if it does not, the scan is wrong): `building-regs` (21 rows, ~446 words each — Approved Documents are tens of thousands of words: PDF text not captured), `written-answers` (143 rows, ~306,000 words each — whole files stored as one section), `et-decisions` (131,654 landing-page rows, median 18 words), legislation dot-leaders (~178,826 one-word sections).

**A4. Duplication.** Report, with row counts, every pair that can return the same text twice: retired `lda-lordswrittenquestions` / `lda-commonswrittenquestions` / `written-statements` vs their pwdata successors; `historic-hansard` vs `pwdata-debates` and `pwdata-lords` (state the overlapping date window, count matching sitting days); `lda-commonsdivisions` vs `commons-divisions-votes`; `lda-lordsdivisions` vs `lords-divisions-votes`; `uk-treaties` vs `uk-treaties-fcdo`. Prove each with one concrete duplicated item returned by `runSearch()` — the returned `corpus_key` on screen, not an absence of errors.

**A5. The legislation work list — why it is not held.** For `scripts/ingest/v36/worklist.jsonl` (41,913 instruments: 5 Acts 2000+, 5,783 Acts pre-2000, 27,413 SIs, 7,082 retained-EU, 1,630 devolved/other — **confirm the split from the file; these five must sum to 41,913**) answer: (a) which seed source each instrument was absent from (bulk download? legacy `LegislationItem`? year-range cut-off?) — bucket and count; (b) are they present in the TNA bulk download on disk, and if so why were they skipped; (c) fetch **500** of them to `/tmp` only (no DB writes), in the mix the worklist has, with production fetcher settings, and report: instruments/minute, failure classes, mean sections and words per instrument by type. This sizes Part D. Record the predicted rate in `CHANGE_LOG` before the run.

**A6. Storage — is 20 GB a wall or a number we typed?** Report (i) Neon's actual plan and whether any storage quota applies — under Neon's 2026 usage-based pricing storage is metered at **$0.35/GB-month with no fixed cap**, so the "20 GB" the alarm fires against is probably a threshold in our own code; find where it is set and say so; (ii) Neon bytes per compiled section for `tna-caselaw` (~7.4 KB), `pwdata-debates` (~0.4 KB) and legislation (~0.6–0.7 KB), and what is stored in Neon for case law that is not stored for Hansard. Part E depends on (ii).

**A7. Legacy overlap.** Join the 127,790 legacy `LegislationSection` instrument ids against (a) `corpus_sections` and (b) the worklist. Report three numbers: already present (duplicate, no action) · on the worklist (Part D picks it up) · in **neither** (a genuine independent gap — this is the number that decides whether the 914,274-section legacy table still matters).

**Stop after Part A and report.** Charlie reads the A-report before B runs. Plain English: what a user would have seen → cause → fix → cost.

---

## 3. Part B — The census walkers (this is what turns UNMEASURED into a number)

One walker per source system, each writing `docs/census/<corpus_key>.json`:
```json
{ "corpus_key": "...", "state": "MEASURED|DECLARED", "unit": "...", "method": "entry walk of <url pattern>",
  "walked_at": "ISO", "published_units": N, "held_units": N, "hollow_units": N,
  "absent_ids": ["..."], "notes": "..." }
```
and one DB table `corpus_census` with the same fields plus `walk_artifact_path` and `walked_at`. DDL: `whichdb` first; migration by `prisma db execute --file` against the direct Neon URL; never `db push`; `NODE_OPTIONS=--no-network-family-autoselection`. **The email reads from `corpus_census`, never from `corpus_targets.est_sections`.**

Walk order (the first three groups are most of the corpus by volume and have machine-readable indexes):

1. **legislation.gov.uk** — already walked 12 Aug; re-run so `walked_at` is current; split `uksi` by year so `si-pre-2010` and `si-2010plus` each get their own row; add `apni`, `ukcm`, `ukci`, `ukla` types and state `published_units` for each (held = 0 today); print the devolved types (asp, ssi, anaw/asc, wsi, nia, nisr — confirm list) individually rather than as `regional`.
2. **ParlParse / TheyWorkForYou pwdata** (7 collections) — unit = sitting-day file, latest revision letter per day, from the `scrapedxml/<stream>/` directory indexes. Report missing days as a list.
3. **Parliament APIs** — committees (publications, evidence), bills, EDMs, petitions, divisions (votes APIs), members' interests, oral questions (LDA — confirm the service still answers; it is scheduled for retirement). Unit per the register.
4. **Historic Hansard** — sittings index on `api.parliament.uk/historic-hansard`; unit = House + date.
5. **Courts** — Find Case Law Atom feed per court per year; GOV.UK ET, tax-tribunal, CMA listings (listing total verified against an entry walk on 3 pages); HUDOC API `respondent=GBR`; Judiciary NI; SCTS.
6. **Devolved legislatures** — Holyrood Official Report, Senedd Cofnod, NI Assembly Official Report; unit = meeting/sitting.
7. **GOV.UK** — HMRC manuals (manual index + contents tree per manual), TIINs, consultations, quango content per declared organisation (the organisation list goes in `CORPUS_SCOPE.md`).
8. **Everything else** — regulators, law commissions, NAO, Sentencing Council, CPS, College of Policing, FCA Handbook, NPPF/PPG, Approved Documents, treaties, OECD. Where no index exists, write the scope and mark DECLARED.

Rules for every walker: it must be able to fail — run it once against a deliberately wrong held set (a corpus key with a typo) and show it reports 0% rather than 100%; store the walk on disk with a date; never mutate `corpus_sections`; never merge two identities on similarity alone; one retry class in the shared helper, not per walker.

Predictions to record in `CHANGE_LOG` before running (CCh's priors; the point is to be wrong in a measurable direction):
- pwdata streams: >98% of sitting-day files held; gaps concentrated in the last 14 days (the 503 failure class).
- historic-hansard: >97% of sittings held; overlap window with pwdata-debates exists and is not de-duplicated in retrieval.
- Find Case Law: ≥95% of judgments held.
- et-decisions: published ≈ held, but `hollow_units` ≈ 131,654 (44.9%), so net coverage ≈ 55%.
- hmrc-manuals: held is well under half of published pages.
- lgsco: published is in the tens of thousands, not ~100.
- building-regs: 100% of units held, 100% hollow.

Report each walk as a numbered row in `docs/OPEN_ITEMS.md` as it lands, so the email gains an M row the next morning.

---

## 4. Part C — Rebuild the daily email

Replace the per-corpus branch in `progress-reporter.ts`. The target format, fully populated with today's numbers for every collection, is `docs/DAILY_EMAIL_V31_REBUILT.md` Part A. Renderer rules are its Part B. In summary:

- C1. Reads `corpus_census`, never `corpus_targets.est_sections`.
- C2. Seven states: MEASURED / CLAIMED / DECLARED / UNMEASURED / NOT STARTED / BLOCKED / RETIRED. A percentage prints only for MEASURED and DECLARED (labelled). UNMEASURED prints the held count and the word — no number.
- C3. `100% complete` exists only behind the MEASURED-and-clamped test in §1.
- C4. The headline is the **searchable** corpus; legacy and retired are printed beneath it and never added in.
- C5. Every line with a percentage prints numerator and denominator beside it; sections and units never share a column.
- C6. **Delete the three retired collections** (`lda-lordswrittenquestions` 20,500, `lda-commonswrittenquestions` 8,000, `written-statements` 129) from `corpus_sections` **and** from the vector index. Retiring the target did not remove the rows; that is why they are still returned. Prove removal by re-running the A4 query and showing zero hits.
- C7. Add `is_dot_leader` boolean to legislation sections (~178,826). Do not delete them — a repealed provision is a real fact about the law — but exclude them from usable-text counts and suppress them as retrieval answers.
- C8. Fix the `senedd-cofnod` heading inheritance in the **shared parser**, not per caller (61.1% of 191,730 speeches carry a wrong inherited heading). The Welsh-language question is a product decision for Charlie; flag it, don't solve it.
- C9. The sprint string `CENSUS C1` appears in the footer.

Verification: run the renderer against a fixture where `est == compiled` for every collection and confirm it prints UNMEASURED everywhere and `100%` nowhere — **watch it fail first**, paste the failing output, then the passing one. Then confirm the **production** email the next morning carries `CENSUS C1` in its footer. A local render is not the deployed email.

---

## 5. Part D — Seed the Core A work list (AUTHORISED 23 Aug)

Seed `scripts/ingest/v36/worklist.jsonl` in the order `ADDENDUM_V36_SEED_ORDER.md` defines, as **five commit-scoped runs** so a failure in one cannot stall the others: Acts 2000+ (5) · Acts pre-2000 (5,783) · SIs (27,413) · retained EU (7,082) · devolved/other (1,630). Match on **either** regnal or calendar id, as `v36-reconcile.ts` already does.

Run fetch/compile on **Hetzner, never Railway**. R2 writes before Neon. Predict before running (from A5): instruments/hour, sections, words, embedding tokens, Neon delta. CCh's estimate for the whole list: ~0.45–0.6M sections, ~60–90M words, ~80–120M tokens → **$6–9 on batch**. If A5 moves that by more than 2×, stop and report. The S12 case-law embed job is not to be touched: resume with `--embed`, never `--reset`.

After the run, re-run the legislation walk and report the new `held / published` for every Core A row. Predicted: Acts pre-2000 from 38.1% → ≥95% of Acts-with-text; SIs from 72.9% → ≥98%; retained EU from 84.7% → ≥98%.

---

## 6. Part E — Pre-2001 case law (AUTHORISED 23 Aug: walk, then fetch, no further gate)

`tna-caselaw` starts at 2001; `et-decisions` at 2017. All four `bailii-*` targets were retired as "superseded by `tna-caselaw`", which is false. This is the largest known gap.

**E1. Size it before fetching — because without a denominator you cannot know when you are done.** Walk BAILII's court and tribunal indexes and report **judgment counts per court per decade, pre-2001 only**. The Corpus Plan's 2,000,000-section estimate is unverified and the unit is ambiguous: `tna-caselaw` averages 9,088 words per "section", i.e. a section there is a whole judgment, so 2M *judgments* is implausible and 2M *chunks* is a different quantity. CCh's prior: **150,000–250,000 judgments**, ~0.7–1.5 billion words, **$66–146 on batch**, 4–6 GB on R2, 1.5–3 GB on Neon (A6 (ii) refines this). Record the prediction in `CHANGE_LOG`.

**E2. Licence register.** For each BAILII database, add a row in the same form as the existing OECD (CC-BY) and IMF (`commercialUseExcluded=true`) entries. **Licence-hostile databases are excluded from the fetch and listed in the report** — the same rule already applied to SSRN. This is not a new approval gate; it is the standing rule.

**E3. Fetch.** Un-retire the targets (or create `bailii-pre-2001` with per-court sub-keys — prefer per-court, because coverage must be reportable per court). Hetzner, not Railway. R2 before Neon. Respect BAILII's rate limits — a ban costs more than a week. Strip stylesheet at compile time (the `tna-caselaw` lesson: 12.7% of embedded case-law text is markup). Embed on batch. Report `held / published` per court per decade when done.

---

## 7. Part F — `et-decisions` and `tna-caselaw` quality (AUTHORISED 23 Aug)

**F1. Delete** the 131,654 `et-decisions` rows A3 identifies as landing pages (median 18 words) from `corpus_sections` and the vector index. Prove with a before/after count and one `runSearch()` query that previously returned a landing page.

**F2. Re-fetch** the real decisions behind them. Before the run: fetch 200 to `/tmp`, report decisions/minute and the share that resolve to a real document vs a dead link. Predict the total in `CHANGE_LOG`. Then run on Hetzner.

**F3. Re-embed** `tna-caselaw` chunk 0 with stylesheet stripped (~$31 on batch — confirm). Verify by sampling 50 judgments and showing chunk 0 is <5% markup.

---

## 8. Reporting back

Plain English, in this order, for every finding: what a user would have seen → cause → fix → what it costs. Per-collection table from A2/B. Then three lists: solved / not solved / next. Decisions for Charlie as numbered questions with a recommendation and the consequence of each option. Numbers always say what they are a fraction of. Do not summarise this brief back; report against it.

---

## 9. Standing rules

- Audit before build; no DB writes in Part A; `whichdb` before any DDL; `NODE_OPTIONS=--no-network-family-autoselection` for DB commands.
- No git during the sprint; one commit script at the end, `commit-ingest-census-c1.sh`, scoped by explicit path, executed once, deleted. Verify with `git ls-files` and `git check-ignore -v <path>` that every new file is tracked — three outages came from files that compiled locally and never deployed.
- A push is not a deploy; a green preview is not production; read `CENSUS C1` off the live email.
- A flag flip is not a flag in effect — verify with a positive signal (a counter moving, a log line).
- `TaskStop` does not kill processes; verify by process tree.
- Fix a failure class in the shared helper, not per caller.
- Predictions in `CHANGE_LOG` before every run (predict–measure–compare).
- Open items into `docs/OPEN_ITEMS.md`.
