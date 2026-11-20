# INGEST CBA-1 EXECUTE: report (COMPLETE)

**Brief:** `docs/BRIEF_INGEST_CBA_1_EXECUTE.md` (decisions 326–331). **Session:** cc-ingest, desktop, `C:\Code\scrutinise-prototype`.
**Part 1 (18 Nov, read-only):** found §2 and §4 already written on 14 Nov by an unpushed session; verified them; stopped at Charlie's 1/2/3.
**Part 2 (20 Nov, about 16:50–17:35 UTC):** **decision 350 = option 3 / (b)** (Charlie, 20 Nov 07:55, via CCh GO-350b): finish on the desktop,
treating the 468 rows of 14 Nov as verified and not re-keying them. Everything below was done on 20 Nov unless it says otherwise.

## §1 — 324 or 327 for the old Green Book rows: **324 was used; 327 is pending a CC-Search change**

- **Mechanism used: 324** — the two February-edition rows are out of the keyword and vector indexes, and their database rows are kept
  (`status='unavailable'`, `availability_status='superseded'`, with the reason).
- **Why:** search has no default filter on `availability_status` — scope is tier / corpora / excludeCorpora / ids only
  (`scripts/ingest/search/fts-core.ts` `scopePredicate`, and `vector-core.ts`), and `corpus_vec` does not carry the column. Keeping the
  rows indexed under 327 would serve withdrawn Treasury guidance in default results as though it were current.
- **What 327 waits on (CC-Search):** a default `availability_status` filter in both serves, and the column added to `corpus_vec`.
- **Read back 20 Nov:** a retired row, scoped into ten live queries on each serve, came back from neither (0/10). On 18 Nov all five retired
  rows read 0 in `corpus_fts`, `corpus_vec`, `corpus_chunks` and both live serves (`docs/ingest_traces/d324_readback_cba1x-2026-11-18.json`).

## The three-layer check, per collection

**Tolerance:** FTS exactly one row per section; vector ≥1 vector row and ≥1 chunk per section (chunks may exceed sections).
Counted by explicit id list. The quoted-column form is counted beside it as a control, and it matched 0, as it should.

| Collection | `corpus_sections` (compiled) | `corpus_fts` | `corpus_vec` | `corpus_chunks` | Live serves (10 engine keys) | Verdict |
|---|---|---|---|---|---|---|
| `green-book` (`…/the-green-book-2026-paragraphs`) | 404 | 404, 0 missing, 0 duplicated | 408, 0 missing | 408, 0 missing | 3/3 keys found by both serves | **agree** |
| `gb-discounting` | 33 | 33 | 33 | 33 | 4/4 | **agree** |
| `gb-optimism-bias` | 31 | 31 | 36 | 36 | 3/3 | **agree** |
| `govuk-core-docs` (whole corpus, `audit-three-layer.ts`) | 3,327 | 3,327 | 5,179 | 5,179 | — | **OK** |

- Trace: `docs/ingest_traces/cba1x_three_layer-2026-11-20.json`; whole-corpus census rewritten to `docs/census/three-layer.json`.
- Live serves: `fts-serve` and `vector-serve` each returned the scoped section for every key Lex's engine prints (`gb-discounting:2.1`,
  `3.8`, `3.9`, `3.10`, `green-book:6.58`, `8.58`, `6.77`, `gb-optimism-bias:3.11`, `3.12`, `3.6`).
- ⚠ **Not mine, but seen in the same census** (15 collections disagree): `departmental-accounts` NOT-IN-FTS (551, known since 20 Oct);
  7 ORPHANED-IN-INDEX (as named 20 Oct); `et-decisions` PURGE-INCOMPLETE; and **six `pwdata-*` FTS-SHORT** — `pwdata-wrans` 23,071 short,
  `pwdata-lords` 6,654, `pwdata-westminster` 3,623, `pwdata-lordswrans` 2,410, `pwdata-lordswms` 200, `pwdata-wms` 199. The 20 Oct report did
  not name the pwdata shortfalls, so they may be new since. Nothing done about any of them here.

## §6 — the citation manifest: `docs/manifests/cba-citation-manifest.json`

- **464 keys.** `green-book` 403 (390 paragraphs, 12 numbered tables, Table A.1). `gb-discounting` 32. `gb-optimism-bias` 29.
- **Not keyed (4):** two front-matter rows, the optimism-bias appendix and its worked example. These are not citable paragraphs; they are
  listed in the file under `notKeyed`.
- **Shape:** `{ key, id, hash, sha256, label }`.
  - `hash` is Lex's own definition (`citation-manifest.ts` `textHashOf`): sha256 of the R2 text, UTF-8, first 16 hex.
  - `manifestFromFile` reads the file as it stands.
  - Example: `green-book:6.58` → `…the-green-book-2026-paragraphs:186`. The ids are not re-keyed.
- **Built from Ingest's own record, not from `sectionTitle`.** The paragraph refs come from the reviewed split
  (`cba1x_existing_map.json`), and the text from R2. Lex 26-Y's interim manifest derives its keys from `sectionTitle`, so the two are
  independent derivations.
- **Agreement with 26-Y's interim manifest** (Lex's own `keyOfRow`, `compareManifests`):
  - 464 file keys against 463 Lex keys.
  - **0 unexpected differences in key or id.**
  - **One named difference:** `green-book:table-A.1` is in the file only, because Lex's key grammar is `table-\d+`. That is Lex's call;
    see Q4.
  - Controls fired: a re-pointed id and a changed hash are each named, and Lex's rule gives `green-book:6.58` for row :186 on its own.
- ⚠ **What the agreement does and does not prove.** Keys and ids were compared independently. Hashes were not: the Lex side borrowed
  this file's hash by id, so hash agreement here rests on the two definitions being the same code. `check:lex-26y` part 4 computes
  Lex's hashes itself, and is where a hash comparison belongs.
- Script: `scripts/ingest/cba/build-manifest.ts` (5 ran, 5 passed, 2 controls, 0 dead). Trace: `docs/ingest_traces/cba1x_manifest_compare.json`.
- **MPM is not in the manifest.** `managing-public-money:A4.6` was the brief's example, but MPM is held as one document, not by paragraph.

## §3 (329) — the three statistics tables, in the statistics DB (not `corpus_sections`)

**Schema first, as the brief requires.** Migration `scripts/stats/prisma/migrations/20261120160000_cba_release_basis_suppression`.

- **Target checked:** whichdb ran first and the host was the stats endpoint `ep-gentle-waterfall`, not the corpus one.
- **Changes, all additive:**
  - `stat_observation."releaseDate"` (date) and `"priceBasis"` (text), per row;
  - a new table `stat_suppressed_cell`, with a CHECK that `marker` is `c` or `n`;
  - two new `stat_source` values, `CABINET_OFFICE` and `HMT`.
- ⚠ **Suppression has its own table rather than a nullable `value`.** Every existing reader of `value`
  (`scrutinise-web/lib/stats/stats-query.ts`) does `Number(r.value)`, which turns NULL into **0** — the exact failure the brief forbids.
  A cell is held in one table or the other, never both, and the check asserts it.
- `migrate diff` after applying: empty.

| Dataset | What | Rows | Release date (per row) | Price basis (per row) |
|---|---|---|---|---|
| `pesa-ch5-function` (held since Aug) | PESA 2025 Ch. 5, tables 5.1 and 5.2 | 437 obs, 189 series; **re-run through its own handler: 0 values changed** | 2025-07-17 (gov.uk first published; the 18 Dec "December Update" added other files, not this one) | cash (nominal) £ million, outturn ("£ million" heading; no real-terms label in the workbook) |
| `css-2026` (new) | Civil Service Statistics 2026, tables 7, 20, 21, 25 | **2,812 values + 408 suppressed** (263 `[c]`, 145 `[n]`), 3,220 series | 2026-07-29. The file read is V2 of 28 Oct, but its only revisions are 7 cells of table E12 | £ cash gross **median salary only** as at 31 Mar 2026 (no employer NI, pension or paybill); headcount; FTE; male–female difference (fraction) |
| `hmt-gdp-deflators` (new) | GDP deflators: **June 2026 QNA** and **October 2026 Budget**, each its own `forecastVintage` | 586 obs, 8 series | 2026-06-30 / 2026-10-29 | index 2025-26 = 100 (FY), 2025 = 100 (CY); % change |
| `gb-optimism-bias-table-1` (new, §8) | see §8 | 22 + 2 `[n]` | 2013-04-21 | per cent uplift as printed |

- **Suppression is stored as a state, with each table's own definition.** `[c]` means fewer than 30 staff in table 7, fewer than 10 in
  table 25, and 1–4 in tables 20 and 21. The definition travels with the cell. 0 salaries are stored as £0. The 142 zero headcounts are
  zeroes the publisher printed.
- **No derived figures.**
  - Deflator forecast years publish only the % change; the index shows "-", per the sheet's footnote 1. The index is stored for outturn
    years only.
  - No total employment cost is computed from Civil Service Statistics.
- **Cross-check:** the June 2026 FY index equals main-DB `DeflatorSeries` on **71/71 years**, max difference 0. That proves which release
  `DeflatorSeries` holds. The October release differs from it by up to 0.674%; that is the control.
- `refreshPesaCh5` now writes the release date and basis, with constants beside its URL (`PESA_CH5_RELEASE_DATE`, `PESA_CH5_PRICE_BASIS`),
  and the shared upsert overwrites both on every re-load. Without that, a future PESA refresh would change the values and keep the old date.
- **Checks:**
  - `scripts/stats/check-cba-stats.ts`: 10 ran, 10 passed, 6 controls, 0 dead. Before PESA's re-run it went red (437/437 missing), so it
    can fail. One weak control was found and fixed: the invalid-marker insert hit a unique key, so it would have fired without the CHECK.
    It now uses a free period and requires the CHECK's own name in the error.
  - Loader read-backs: both AGREE.
  - Trace: `docs/ingest_traces/cba1x_stats_check-2026-11-20.txt`.
- **Not done:** Lex does not read any of this yet. `stats-query.ts` does not select the new columns or the suppressed table; that is Lex's,
  and is routed in the message below.

## §8 — Table 1 of the 2013 optimism-bias guidance, as its own reference table

- **Where:** `gb-optimism-bias-table-1` in the stats DB.
  - Both bounds of Works Duration and Capital Expenditure for five project types.
  - **Outsourcing is stored as `opex`** (41 / 0, per the table's footnote "*"), never as capex. Its two works-duration cells are `[n]`
    states ("N/A in the source"), not zero.
  - **Page recorded:** `Optimism_bias.pdf` (21 Apr 2013), Table 1, **PDF page 2** (printed page 2 of 15), on the dataset and on every
    series label.
- **Verified before writing** (`scripts/stats/cba-table1.ts`, 15 ran, 15 passed, 1 control, 0 dead):
  - every row's printed cells were found in order on page 2's text layer;
  - the footnote is there;
  - every value equals Lex's `OPTIMISM_BIAS_TABLE_1` ÷ 100, with opex and capex the same way round;
  - a mistranscribed cell (200 → 20) is refused.
  - Read back after writing: 22 values and 2 `[n]` cells, equal to the transcription.
- ⚠ **Text layer, not page image.** This machine has no PDF renderer, so I did not re-read the page image. Lex's values agree, and their
  column headings were re-read from the page image on 4 Nov.

## §4 (331) and §5 (330) — `docs/LICENCE_REGISTER.md`

Four rows were added, as the register's own rule allows (CC may add source rows). No existing row was edited.

- **GMCA UCD v3.0, CC BY 4.0, with the required attribution string.**
  - The workbook (re-read today) gives the CC BY 4.0 notice and "Updated autumn 2025". It carries **no © line and no requested form**,
    so the string follows CC BY 4.0 §3(a)(1).
  - The string is the one already on all 30 `m4-*` rows.
  - ⚠⚠ **The obligation is recorded as NOT YET SATISFIED.** Every `CostBenchmark` reader selects `source` but not `notes` or
    `sourceUrl`, so no screen or document shows the licence notice or the link. That is Lex's to render.
- **The NAO CBA reading (330), as Lex framed it:**
  - quotable with attribution for the not-for-profit platform;
  - `nao-nc` on every row (re-read: **3,983/3,983**);
  - a commercial arm must relicense.
  - **Charlie's to confirm.**
- **The CBA statistics tables:** OGL v3.0.
- **PSSRU:** `all-rights-reserved-presumed`, recording what the 9 rows already carry.
- ⚠ **Found and fixed:** `scrutinise-web/scripts/costing/m4-gmca.ts` in the repo still wrote "© GMCA 2026" and `year: 2026`. The laptop's
  version, never pushed, had written the correct text. A re-run of the repo's copy would have overwritten correct attribution with
  wrong. It is now aligned with production verbatim, and a dry run shows 30 entries.

## Also done (CCh routing): the scripts typecheck's three errors

- **Cause:** `scrutinise-web/scripts/verify-statutory-graph-parity.ts` does a dynamic `await import()` of
  `scripts/ingest/graph/{inbound,coverage}`. tsc follows that, which brought 10 ingest files plus `shared/neon-pool` (pg) and
  `shared/r2-client` (aws-sdk, smithy) into the web scripts program.
- **Why it only failed in some places:** those packages resolve only where `scripts/ingest/node_modules` is installed. So the check passed
  in the main checkout and failed in every worktree without it. It was reproduced in `C:\lex26aa`: exactly the three TS2307s.
- **Fix:** the script is now excluded by name, with its reason, in `scrutinise-web/scripts/tsconfig.json`, as that file's own rule asks.
  After the fix, `tsc -p scripts/tsconfig.json` exits 0, and `--listFiles` shows **0** `scripts/ingest/` files in the program. The result
  no longer depends on which `node_modules` exist.

## §7 — still not held, and not in this sprint

- Impact Assessment template and Better Regulation Framework guidance (Lex: next, not now).
- Distributional analysis supplementary guidance — still **NOT CHECKED**.
- FSMA 2000 Explanatory Notes — 0 held. Probably a holding gap, not an absence.
- IA summary-sheet extraction — gated since 7 Sep.
- Bill-stage IAs for 3 of the 5 precedents (gov.uk / bills.parliament.uk, not `ukia`).
- NAO / PAC cost figures — extraction not built.
- PESA beyond chapter 5.
- Civil Service Statistics tables other than 7, 20, 21 and 25.
- Deflator releases other than June and October 2026 (e.g. September 2026 QNA).
- Money GDP (in the same deflator files) — not loaded.

## §9 — answered (18 Nov)

`costing-params.ts` holds the per-year schedule (`STPR_SCHEDULE`, `stprRateForYear`, `discountFactor`; decision 325), not just the 3% headline.

## Predictions, scored (CHANGE_LOG 2026-11-20 17:15 UTC)

P1 migration clean, diff empty — **hit**. P2 CSS 2,812 / 408 (263 c, 145 n) / 3,220 — **hit exactly**. P3 deflators 586 / 8, June = DeflatorSeries
on 71 years — **hit**. P4 PESA 437 / 189, 0 changed, 437/437 dated — **hit**. P5 corpus layers unchanged, `govuk-core-docs` OK — **hit**.
P6 Table 1 22 + 2 / 24 series — **hit**.

## Questions (numbered, with a recommendation and the consequence of each answer)

1. **327, the default filter (CC-Search).** Recommend: CC-Search adds a default `availability_status` filter to both serves and the column
   to `corpus_vec`; then the February Green Book rows are re-indexed as `superseded`. If not done, they stay unreachable by any query,
   including a deliberate one.
2. **Decision 330, the NAO reading (Charlie).** Recommend: confirm it as recorded. If confirmed, nothing changes until a commercial arm
   exists, and the register says what to do then. If not, the 3,983 rows need a narrower quoting rule before Lex quotes them.
3. **GMCA attribution on screen (Lex, routed).** Recommend: Lex renders the register's string wherever a GMCA figure is shown or printed.
   Until then CC BY's condition is unmet for every displayed GMCA figure.
4. **`green-book:table-A.1` (Lex, routed).** Recommend: Lex widens its key grammar to `table-[A-Z]\.\d+` so Annex A's table is citable.
   If not, it stays uncitable and is the one standing difference between the two manifests.
5. **Lex reading the stats tables (Lex, routed).** `stats-query.ts` needs `releaseDate` and `priceBasis` in its selects, and a read of
   `stat_suppressed_cell` wherever a missing cell could be shown. Until then 26-Y's "Civil Service Statistics: not available" gap is closed
   in the data and not yet on the screen.
6. **PSSRU terms (Charlie).** Recommend: write to PSSRU for reuse terms. Until there is an answer, the 9 rows stay cite-and-link only.

## Code and files from this sprint

- **Stats DB:**
  - `scripts/stats/prisma/schema.prisma` and its migration;
  - `scripts/stats/lib/upsert.ts`;
  - `scripts/stats/ingest-handlers.ts` (PESA release and basis). The three new datasets are `refreshCadence: STATIC` and have no
    scheduler handler, so `refresh-scheduler.ts` never treats them as due; a new release is loaded by editing `cba-tables.ts` and re-running it;
  - new scripts: `cba-probe.ts`, `cba-tables.ts`, `cba-table1.ts`, `check-cba-stats.ts`.
- **Corpus side:** `scripts/ingest/cba/build-manifest.ts`, `scripts/ingest/cba/readback-layers.ts`, `docs/manifests/cba-citation-manifest.json`.
- **Licence and attribution:** `docs/LICENCE_REGISTER.md`, `scrutinise-web/scripts/costing/m4-gmca.ts`.
- **Typecheck fix:** `scrutinise-web/scripts/tsconfig.json`.
- **Traces:** `docs/ingest_traces/cba1x_stats_check-2026-11-20.txt`, `cba1x_three_layer-2026-11-20.json`, `cba1x_manifest_compare.json`,
  and `docs/census/three-layer.json`.
