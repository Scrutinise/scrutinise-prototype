# SCOPE — cost–benefit analysis (CBA): where it stands across Search, Ingest, Lex and Graphs

**Written 2026-11-19 00:16 UTC, read-only.** No file edited but this one. A scratch read-only DB probe (`scrutinise-web/scripts/_scope_cba.ts`)
was run against Neon and deleted. Production commit read from `https://www.scrutinise.org/api/health` at 00:16 UTC: **`239658bb`**.
Labels: **[M]** measured this session · **[R]** read from a doc or code, not re-measured · **[I]** inferred.

## In plain English

The project has a working cost–benefit calculator, and it is live. Lex's 26-Y sprint built it. An idea's owner can add cost lines and
benefit lines to each action. The engine discounts them at HM Treasury's October 2026 rates and works out net present value and the
benefit–cost ratio. Optimism bias is shown as a range beside the headline figure, never folded into it. The engine can also write a
versioned Cost–benefit report in Word or PDF. **But nobody has used it yet.** Production has 1 cost line, 0 benefit lines and 0 reports.
Separately, Search built a "cost and benefit" evidence block that pulls figures from published impact assessments. It has never been
connected to any screen. Ingest has loaded the numbered Green Book paragraphs and the GMCA unit costs. Its follow-on work stopped on
18 November and is waiting on a decision from Charlie. Graphs has no CBA work. The main things still missing are: valuing benefits from
real sources, distributional weighting, the impact-assessment template and figures, and several reference tables.

## The pieces

| Piece | Owner | File(s) | In production? | State |
|---|---|---|---|---|
| CBA engine: Annex A 4 dp discounting, PV/NPV/BCR, 5 sensitivity rows, optimism-bias band, a trace for every figure | Lex (26-Y) | `scrutinise-web/lib/lex/cba/engine-pure.ts`, `engine.ts` | **Yes** [M]: `8bba6782` is an ancestor of `239658bb` | Built. `check:lex-26y` 129/129 [R: CHANGE_LOG:130]. **No idea has run it**: 0 `CbaReport` rows [M] |
| Benefit lines (valued / not valued; source REF, BENCHMARK, CITATION or OWNER) | Lex | `lib/lex/cba/benefit-lines*.ts`, `components/lex/ActionCbaLines.tsx`, `app/api/ideas/[id]/benefit-lines/route.ts` | Yes (same commit) | **0 rows** [M] |
| Per-cost-line appraisal (payer, on-cost, OB type, citation key) | Lex | `lib/lex/cba/cost-line-appraisal.ts`, `line-appraisal.ts`, `app/api/ideas/[id]/cost-lines/route.ts` | Yes | **1 `CostLine` in the whole DB** [M]. The Search S18 note "0 of 119 actions carry a cost range" [R: handoff:830–832] still holds in substance |
| Cost–benefit report (versioned, Word/PDF to R2, stale flag) | Lex | `lib/documents/build-cba-report.ts`, `lib/lex/cba/report.ts`, `app/api/ideas/[id]/cba/route.ts`, `cba/download/route.ts` | Yes | 0 versions [M] |
| Appraisal settings (period 1–60, start year, price year) | Lex | `lib/lex/cba/settings.ts`, `period.ts`, `components/lex/AppraisalSettings.tsx` (mounted in `IdeaDetailClient.tsx:33`) | Yes | 0 ideas have set any of them [M] |
| Deepening section 5 "Costs and benefits" | Lex | `components/lex/DeepeningCostsBenefits.tsx` (mounted in `CreateIdeaClient.tsx:47`) | Yes | Locked/open behaviour [R: LEX_26Y_REPORT §6] |
| Costing companion, re-templated to the engine | Lex | `lib/lex/cba/costing-companion.ts` | Yes | 0.48p per run, measured n=3 [R: LEX_26Y_REPORT:170] |
| Lex's 8 CBA tools and the `invented-figure` honesty rule | Lex | `lib/lex/agent/tools.ts:21–27`, `honesty.ts`, `system-prompt.ts` | Yes | [R: LEX_26Y_REPORT §7] |
| Citation manifest (key → section id → text hash) | Lex (interim) / Ingest (file) | `lib/lex/cba/citation-manifest*.ts` | Interim: yes | 463 keys, derived from held paragraph rows [R: LEX_26Y_REPORT:97]. Ingest's file (§6) **not built** [R: INGEST_CBA_1_EXECUTE_REPORT:67] |
| Costing parameters: STPR schedule 3.00/2.50/2.25%, `discountFactor`, Table 1 both bounds, health uprate 2% | Lex (325, 343) | `lib/lex/costing-params.ts:35–132` | Yes | 3.00% from `65f3b6c0` (7 Nov) [R: CHANGE_LOG:318]. `check:costing-params` 11/11 [R] |
| Schema: `BenefitLine`, `CbaReport`, `CostLine.appraisal`/`citationKey`, `Idea.appraisal*` | Lex | `prisma/schema.prisma:3278, 3313, 3347, 911–913`; `prisma/lex_26y_cba.sql` | Yes: applied to Neon, committed `0f95312d` [R] | Not in `entity_list_v5.md` (CCh-only) [R: LEX_26Y_REPORT:292] |
| COST AND BENEFIT evidence block (PREDICTED / CHECKED / COMPARABLE rows from impact assessments, three-state figures) | **Search** (S18) | `lib/lex/costing.ts` (`retrieveCosting`, `costingBlock`) | Code is in the deploy, but **unreachable**: no file in `app/`, `lib/` or `components/` imports it [M: grep]; only `scripts/check-s18-costing.ts` does | Waiting on S18 decision **D-4, "where does the block render?"** [R: SEARCH_S18_REPORT:451, :496] |
| Cost route (`proposeCosts` / `writeCosts`, FINANCIAL_ONLY caveat) | Lex (B23) | `lib/lex/cost-route.ts` | **Unreachable**: imported only by `scripts/b23-cost-route.ts` [M: grep] | Still reads `CostBenchmark` (`:127`) |
| `LEX_ROUTER_APPRAISAL` (router told where impact assessments live) | Search | `lib/env-flags.ts:163, 192`; `query-expansion.ts` | **Off in production** [M: /api/health] | Held off until S18 D-1 re-keys the gold set [R: handoff:821–828, 863] |
| Numbered Green Book paragraphs (Pilot A) | Ingest (CBA-1) | rows in `govuk-core-docs`; `scripts/ingest/cba/numbered-paras.ts`, `pilot-text.ts`, `write-pilot-a.ts` | **Yes**: 404 Green Book + 33 discounting + 31 optimism-bias rows [M] | Written 14 Nov by an unpushed session **whose code is not in the repo** [R: EXECUTE_REPORT:22–32]. Verified 468/468 |
| GMCA unit costs | Ingest | `CostBenchmark` rows; `scrutinise-web/scripts/costing/m4-gmca.ts` | Yes: 30 rows [M] | CC BY 4.0. The §4 attribution string in `LICENCE_REGISTER.md` is **not written** [R: EXECUTE_REPORT:65] |
| CBA-1 EXECUTE §3/§5/§6/§8 (CS Stats, PESA, deflator-date tables; NAO note; manifest; Table 1 table) | Ingest | — | No | **Stopped at Charlie's option 1/2/3** [R: EXECUTE_REPORT:87–93; handoff:874] |
| Graph-side CBA | Graphs | — | — | None found. The last Graphs commit (`42619704`, name lookup) is unrelated and **not live** [M: not an ancestor of prod] |

**Feature flags.** No flag gates 26-Y. None of its routes, `lib/lex/cba/*` or its components read `env-flags` or `process.env.LEX_*`
[M: grep], so it is live for every user. The only CBA-adjacent flag is `LEX_ROUTER_APPRAISAL` = false [M].
**Live read-back.** The 26-Y commit is in production's ancestry [M]. I did not read a 26-Y string off the running site: every
`/api/ideas/x/*` path, including a made-up one, returns 307 to sign-in when signed out [M], so that probe cannot tell the routes apart.
"Deployed and serving" is therefore [I], from the ancestry and a green health check.

## Held sources and how they are used

| Source | Held [M unless noted] | Used by CBA today? |
|---|---|---|
| Green Book, Oct 2026 | 404 numbered-paragraph rows, plus the older 89 heading sections of `the-green-book--2` (both present), plus 2 superseded Feb rows (`status` unavailable, decision 324) | Yes. The citation manifest and the report's citations; Table 1 caveat quoted verbatim [R] |
| GB discounting / optimism-bias guidance | 33 / 31 paragraph rows | Yes. Annex A factors (in code); Table 1 (in code, not a DB table) |
| Managing Public Money | 138 sections, Annex-addressable [R: INGEST_CBA_1_REPORT:59–67] | **No.** No CBA code cites it [I: no reference in `lib/lex/cba`] |
| Impact assessments with £ figures | `impact-assessments`: 18,756 compiled + 3 unavailable | Search only: through the unwired `costing.ts` and through ordinary retrieval. Summary-sheet extraction **not built**. `pdfToText` flattens the table, so 9 of 18 S18 answer keys are a cover sheet or a stripped table [R: costing.ts:24–27; INGEST_CBA_1_REPORT:78] |
| Departmental accounts | `departmental-accounts`: 551 compiled | **No.** Not referenced anywhere in `scrutinise-web/lib` [M: grep]. Whether it is in the search indexes was NOT CHECKED |
| NAO reports | `nao-reports`: 2,570 compiled + **1,413 unavailable** (cause not checked) | No. Licence `nao-nc` (non-commercial); the §5 licence note is not written; cost extraction not built [R] |
| PSSRU (9 rows) | `CostBenchmark`; all 9 carry `licence=all-rights-reserved-presumed` in `notes` [M] | ⚠ **Still selectable and shown.** `state.ts:320` loads every benchmark on Page 4. The benefit-lines route (`:55`) lists every row with low/high. Neither filters on licence [M: code read]. Ingest flagged this as Lex's to fix on 4 Nov [R: CHANGE_LOG:390] |
| GMCA | 30 rows | Selectable as a benefit or cost source (benefit-lines `:55`; `benefit-lines.ts:32`) |
| Deflators | `DeflatorSeries` 71 rows, 1955–2025 | Yes: the price-year default and uprating. No release-date or source column [R] |
| Other `CostBenchmark` rows | Home Office crime 19 / fraud 3, TAG 10, BPE 5, ASHE 3, DESNZ 2, QALY 1, WELLBY 1 (83 rows in all) [M] | Selectable as sources |

**Known open issues, checked against the code today**
- **STPR 3.5% vs 3.00%: RESOLVED.** `costing-params.ts:36` reads 0.03, with the full schedule at `:49–75` (325, 7 Nov). The 4 Nov
  warning [CHANGE_LOG:397] is history. ⚠ The note at `:41` still says "v1 presents undiscounted figures … NPV discounting is a v2
  refinement". That is stale since 26-Y; it is a comment, not a figure.
- **PSSRU licence: OPEN** (above).
- **`CostBenchmark` has no licence column: OPEN** (`schema.prisma:3420–3443`). The statement sits in `notes` (D-4 of CBA-1).
- **CBA-1 EXECUTE stop: OPEN**, waiting on Charlie's option 1/2/3.
- **Search-side default filter on `availability_status`: OPEN.** Decision 327 waits on it [R: EXECUTE_REPORT:11–17].

## What a finished module still needs

| Gap | Owner |
|---|---|
| **Real use.** One idea with costed and valued lines, run end to end, plus Charlie's §9 read of the report [R: LEX_26Y_REPORT:275–285] | Charlie + Lex |
| Benefit valuation sources beyond the 83 benchmarks: QALY/WELLBY uprating paths, DfT/HO value tables wired as benefit libraries, Green Book health guidance (not held [R: CHANGE_LOG:320]) | Ingest (sources), Lex (wiring) |
| Distributional analysis and weighting (Green Book Annex A3). Out of 26-Y scope [R: BRIEF_26Y §10]; the GB distributional supplementary guidance is NOT CHECKED as held [R: INGEST_CBA_1_REPORT:58] | Lex; Ingest for the guidance |
| Sensitivity beyond five fixed rows (switching values, Monte Carlo); NPV/BCR presentation is built | Lex |
| IA template (not held) → the IA draft shows "not available" [R: LEX_26Y_REPORT §5]; Better Regulation Framework (not held) | Ingest, then Lex |
| IA summary-sheet £ extraction (gated since 7 Sep); bill-stage IAs (2 of 5 precedents held) [R: INGEST_CBA_1_REPORT:78, 95–98] | Ingest |
| Civil Service Statistics, PESA beyond ch.5, deflator release dates → staffing on-costs are "as entered" [R: LEX_26Y_REPORT:41–42] | Ingest (CBA-1 §3) |
| Ingest's citation manifest file, and a Table 1 reference table with its page number | Ingest (§6, §8) |
| Where Search's evidence block renders (D-4), and re-keying the S18 gold set (D-1) | Search + Charlie |
| Licence work: PSSRU display rule, a `CostBenchmark` licence column, the NAO `nao-nc` ruling, GMCA attribution | Lex (display), Ingest (schema/register), Charlie (NAO) |
| Outturn comparison (PIRs: 71 of 1,169 IAs are reviews [R: handoff:806]), the promotion module | Lex / Search |
| Making Managing Public Money and departmental accounts usable by CBA at all (neither is read by CBA code) | Lex / Search |
| Graph links between an idea's actions and IA/accounts sources | Graphs (nothing started) |
