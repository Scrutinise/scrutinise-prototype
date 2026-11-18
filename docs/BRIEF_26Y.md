# BRIEF 26-Y — LEX: cost–benefit analysis, written to the data

**From CCh-Lex, 13 November 2026.** Decision 314 (costs on the action, analysis on the idea; not a gate). Decisions 334–341 (§1). Written to the limits CCh-Ingest and CC-Ingest reported in `INGEST_CBA_1_REPORT.md`, `BRIEF_INGEST_CBA_1_EXECUTE.md` and their 4 Nov messages, and to 325 (the discount schedule). Charlie's standing rule: *every figure cited or absent*. Nothing here invents a number.

**What this is for, in one sentence:** a reviewer opening the idea can see what it costs, to whom, over what period, what it is claimed to deliver and how that was valued, every number traceable to a line, a table row or a held paragraph, and every gap named.

---

## §0 Run mode

- As BRIEF_26S §0: continuous; CHANGE_LOG; report `docs/LEX_26Y_REPORT.md`; stop only for spend or scope; cold reads; scratch run; `check:prompt-examples`; one session per tree; WIP on `wip/26y` before any idle; Charlie's screen is the last check.
- **Size first; two parts expected.** **Y1** = §2 benefit lines, §3 the costing companion re-templated, §4 the analysis engine and the Cost–benefit report, §6 Deepening section 5. **Y2** = §5 the Impact Assessment output, Lex tools, the sensitivity extras. Report the split.
- **Read-only dependencies on Ingest, checked before building:** the citation manifest (EXECUTE §6); the statistics store tables (329: Civil Service Statistics, PESA, deflator releases); the optimism-bias Table 1 reference table (EXECUTE §8); the GMCA, Home Office and PSSRU unit-cost rows with licence per row. Where one is missing, the feature shows "not available: <what> is not yet held" and the report says so; nothing is stubbed with a guessed figure.
- Nothing deletes; versions kept; proposals beside; worded refusals; limits with counters; shape + word; schema with or after code; §20 read-back; prices measured.

---

## §1 Decisions

| # | Decision |
|---|---|
| 334 | **Benefit lines on the action**, beside cost lines: what is gained, by whom, how measured, valued or "not valued", with the valuation's source. A benefit with no source is stored as "not valued" and never enters a total |
| 335 | **Appraisal period** is set by the owner on the idea (default 10 years, the Green Book's usual for policy; 1–60 allowed), with a stated start year. X3a's costs-by-year table shows the first five years of it |
| 336 | **The Cost–benefit report is an Output Report** (like the Background Report): generated on demand from the lines and the tables, versioned, marked "stale: N lines changed since" when the inputs move. Not a draft on an action |
| 337 | **Citations only through the manifest.** A Green Book, MPM, discounting or optimism-bias citation that is not a key in Ingest's citation manifest is refused at write time, with the nearest valid keys offered. No paragraph number is ever typed free-hand |
| 338 | **Discounting per 325**: the forward schedule, per-year lookup, nothing beyond year 125; health benefits uprated 2% a year and discounted at the headline rate; no separate health rate |
| 339 | **Optimism bias**: non-capital lines take no uplift, and the report prints why (the guidance has no category for a statutory duty or an administrative process); a capital line takes the upper-bound uplift for its type from Table 1 (Ingest's reference table), named per line; the owner may lower it with a reason |
| 340 | **Staffing lines are a floor.** Civil Service Statistics give gross median salary in cash at 31 March 2026, no employer on-costs, small cells suppressed. A staffing line shows the salary floor, uprated to the price year by the deflators, and an **on-cost uplift only when the owner sets one or Lex proposes one with a cited source**; otherwise the line reads "excludes employer costs". A suppressed cell is shown as suppressed, and the fallback (the grade across all departments) is named |
| 341 | **Every report has a Gaps section** before its totals: what was not valued, which lines have no duration, which assumptions are the owner's, which sources are floors, which inputs Ingest does not yet hold. A report with an empty Gaps section is refused by the check as improbable |

---

## §2 Benefit lines (334)

**2a.** On the action record, under Costs, a **Benefits** table with the same shape as cost lines: *what is gained* · *who gains* (Exchequer · a department · citizens · business · other, named) · *how it would be measured* · *valued at* (amount, price year, per year or one-off, duration) or **not valued** · *source* (`[Ref: n]`, a unit-cost row, or "owner's estimate — reason"). Limits with counters; worded refusals; every save a FieldRevision.

**2b.** Lex's tools: `add_benefit_line`, `set_benefit_line`, parity with the form; a benefit Lex writes is a proposal unless dictated. Lex may propose a valuation **only** from a held unit-cost row or a held source it names; otherwise it writes "not valued" and says what would value it.

**2c.** The Actions Pack prints Benefits after Costs for each action.

---

## §3 The costing companion, re-templated (26-V2b kind "Costing")

The companion of a draft is the action's costing in Green Book shape, generated mostly without a model:
1. **Cost lines** by category (staff · systems · external · transition · other), one-off / recurring, who pays, duration, price year, source. Staffing lines per 340.
2. **Benefit lines** per §2.
3. **Assumptions**, each with its source or "owner's".
4. **Totals in the price year**, then **present value** at the 338 schedule over the idea's appraisal period, shown per year.
5. **Optimism bias** per 339, printed per line.
6. **Gaps** (341).
7. **Caveat**: "Prepared from the action's lines and HM Treasury guidance as held on <date>; not an Impact Assessment; every figure traces to a line or a held source."

Lex's narrative (two paragraphs: what the costs are and why; what the benefits are and how valued) is the only model call; measured on scratch. Citations through the manifest (337).

---

## §4 The analysis engine and the Cost–benefit report (336)

**4a. Engine** (`lib/lex/cba/*`, pure, no model): reads every live action's cost and benefit lines, the idea's appraisal period and price year, Ingest's deflator table, the 325 schedule, Table 1; produces:
- costs and benefits by **heading × year** (nominal in price year; present value);
- by **payer** and by **beneficiary**;
- **NPV** and, where benefits are valued, **BCR**; where none are valued, "benefits not valued — no BCR", never a zero;
- **sensitivity**: costs +20%, valued benefits −50%, delivery delayed one year, discount schedule ±0.5 points — each as a row, not a paragraph;
- the **Gaps** list (341) and an **Assumptions** list with sources;
- a **trace** per figure: which lines, which table rows, which schedule year.

**4b. The report** (Output Report kind "Cost–benefit analysis"): the stage banner; a one-page summary (NPV, BCR or "not valued", period, price year, what is not valued); the tables above; Gaps and Assumptions; the trace as an annexe; the caveat. Word/PDF through the existing route; `[Ref: n]` and manifest keys on every citation. Regenerated on demand; "stale" when lines change.

**4c. Checks on the arithmetic**, not the prose: a fixture of 6 lines over 12 years reproduces a hand-computed NPV to the penny against the 325 factor table; deflator conversion round-trips; a line past year 125 is refused; a benefit with no source never enters a total (mutation: let it in → red); a suppressed salary cell never becomes zero (mutation → red); an unmanifested citation is refused (mutation → red).

---

## §5 The Impact Assessment output (Y2)

An Output Report kind "Impact Assessment (draft)" that mirrors the government IA summary-sheet fields (total NPV, business NPV, EANDCB where business is affected, one-in-two-out note, price base year, PV base year, appraisal period, key assumptions, risks, monitoring plan) from the same engine, so a departmental reader sees a familiar shape. Built only when Ingest holds the IA template (EXECUTE §7 says not yet); until then the kind is listed as "not available: IA template not held".

---

## §6 Where it shows

- **Deepening section 5** becomes **"Costs and benefits"**: the X3a roll-up table (first five years), NPV/BCR summary or "not valued", the Gaps count, and **Generate the Cost–benefit report** (free except the narrative; price shown). Open regardless of the lock? **No** — it reads accepted drafts' costings; it shows the lock's count until the Deepening opens, with the roll-up of whatever lines exist visible read-only.
- The idea's **Settings** (Overview): appraisal period, start year, price year (default: current financial year; deflator base shown).
- The **Output Reports** tab lists the Cost–benefit report and the IA draft with their versions and stale flags.

---

## §7 Lex

- Tools: `read_cba_summary`, `explain_cba_figure(trace id)` (free), `generate_cba_report` (asks first, narrative price), benefit-line tools (§2b), `set_appraisal_period` (asks first).
- Prompt rule: Lex never states a cost or benefit figure that is not on a line or in the report; asked "what does this cost?", it reads the report and quotes the trace, or says "not costed yet — add cost lines on #N, or ask me to propose them from the Brief".
- Honesty check: a number in a Lex reply about costs must match a line, a table row or a report figure (the trace), or be labelled "my estimate" with a reason.

---

## §8 Verification — `check:lex-26y`

1. Benefit lines: CRUD, parity, FieldRevision, "not valued" rule.
2. Costing companion on a scratch action with staffing, systems and a capital line: the floor label, the uplift only when set, Table 1 uplift named, the Gaps section non-empty.
3. Engine arithmetic (§4c) to the penny; sensitivity rows; trace coverage (every printed figure has a trace).
4. Manifest refusal (337); a key that exists passes.
5. Report generation, stale flag after a line change, Word/PDF text match.
6. Deepening section 5 states (locked / open; valued / not valued).
7. Lex: a cost question answered from the trace; an invented figure caught by the honesty check (fixture).
8. Regression: 26-X suites, 26-W, 26-V2b/d, prompt-examples, costing-params.

## §9 Only Charlie can confirm

The Benefits table on #38; the costing companion on #38 read cold; the Cost–benefit report's one-page summary on 452c5ade; whether "not valued" reads honestly rather than evasively; the appraisal period and price year defaults.

## §10 Not in this sprint

Distributional analysis; outturn comparison (post-implementation reviews); the promotion module; Ingest's IA summary-sheet extraction.
