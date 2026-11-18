# LEX 26-Y — cost–benefit analysis, written to the data: REPORT

**cc-lex-26y, desktop (DESKTOP-4C8LGVJ), 18 November 2026.** Brief: `docs/BRIEF_26Y.md` (decisions 334–341). Charlie, 11:02 UTC: "please
continue until the whole brief is done, any questions for CCh put in the inbox". Inbox traffic: `C:\Code\inbox\to-cch\2026-11-18T1058Z…`,
`…T1102Z…`, `…T1106Z…` and the closing report.

---

## §0 What I found before building, and the split

### 26-Y's schema was already on production; its code was nowhere

Measured read-only on Neon `ep-old-dust-aboxi69a`, 18 Nov ~10:50 UTC:

- `BenefitLine` existed, with 0 rows.
- `CostLine.citationKey` existed.
- `Idea.appraisalYears`, `appraisalStartYear` and `cbaPriceYear` existed.
- None of it was in `schema.prisma`, this tree, `Main` or any remote branch.
- From `pg_class` xmin age, these were created well after 28 Oct.
- Inference, not checked: an earlier 26-Y session on the laptop applied its SQL and never pushed. The laptop's push hung at Git Credential
  Manager on 12 Nov.
- Production was safe: every column was nullable with no default, and no values were set.

I **built to the columns as they stood** and changed none of them.

- `prisma/lex_26y_cba.sql` part 1 records them with `IF NOT EXISTS`.
- Part 2 adds `CostLine.appraisal jsonb` and the `CbaReport` table.
- It was applied after `whichdb` at 11:08 UTC and read back.
- Schema and SQL were committed and pushed **together, first** (`0f95312d`), before any code read them.

⚠ **If the laptop's 26-Y code surfaces**, it was written against the same part-1 columns. Merge it, do not duplicate it.

### Ingest's dependencies (§0 says check them before building)

| Dependency | State on 18 Nov | What 26-Y does without it |
|---|---|---|
| Green Book, discounting, optimism-bias paragraphs | **Held**: 468 rows written 14 Nov 02:16 UTC (cc-ingest verified 468/468 against its review) | The manifest is derived from them (below) |
| GMCA unit costs | **Held**: 30 `CostBenchmark` rows | A benefit may cite them |
| Citation manifest (EXECUTE §6) | **Not shipped** | Derived from the held rows (decision call 1) |
| Optimism-bias Table 1 reference table (EXECUTE §8) | **Not shipped as a table** | `OPTIMISM_BIAS_CAPEX_UPPER`, transcribed from the page image on 4 Nov (call 2) |
| Civil Service Statistics, PESA (329) | **Not held** | A staffing line is as entered, "excludes employer costs"; listed in Gaps |
| Deflator release date and price basis (329) | **Not held** (`DeflatorSeries` = year and index, 1955–2025) | The index is used as held; listed in Gaps |
| IA template (EXECUTE §7) | **Not held** | The IA draft is listed as "not available: IA template not held" |

### The split (reported to CCh, 11:06 UTC)

- **Y1:** §2, §3, §4 and §6.
- **Y2:** §5 (listed as not available), §7's tools, the prompt rule and the honesty rule.
- Both were built in this session.

---

## ⚠ CCh's GO of 18 Nov 12:05: decisions 342 and 343, applied before the commit

These two decisions were given to the laptop session on 14 Nov and had not reached this one. **They replace 339.**

- **342: optimism bias NEVER adjusts the headline.**
  - Built as I first did it, a capital line took Table 1's upper bound inside its total, so the headline NPV, the companion's totals and
    every sensitivity row were uplifted. **That is gone.**
  - The engine now recomputes the analysis with every banded line at Table 1's lower bound and then at its upper bound, and shows the
    result beside the headline: "With optimism bias at HM Treasury's indicative starting values, the NPV would be between £X and £Y" (the
    present value of costs where nothing is valued).
  - Capital lines are banded by project type, lower to upper.
  - Running-cost lines are banded by the outsourcing row (0–41%), labelled "the nearest analogue in the guidance, not a rule".
  - The owner's lowered rate replaces the upper end of that line's band and never the headline.
  - A capital line with no type is in no band, and Gaps says so.
  - The band is on the report's summary, in the companion, on Deepening section 5, in `read_cba_summary` and in Lex's prompt.
- **343: Table 1 holds both bounds.**
  - `OPTIMISM_BIAS_CAPEX_UPPER` becomes **`OPTIMISM_BIAS_TABLE_1`**, each type with `{ capex | opex: { lower, upper }, works }`, mirrored
    in the seed JSON first (`optimism_bias_table_1`).
  - Outsourcing is held as **opex**, per Table 1's own footnote, with N/A works figures.
  - `check:lex-26y` compares all six rows and four columns with the PDF's read-back text.
- **The footnote, quoted verbatim, not as CCh paraphrased it.** CCh gave "These are indicative starting values. The upper bound is not
  the highest possible value and the lower bound is not the lowest." The guidance's own words, on the Table 1 page, under paragraph 3.6,
  are:

  > "Note that these values are indicative starting values for calculating optimism bias levels in current projects. The upper bound (U)
  > does not represent the highest possible values for optimism bias that can result and the lower bound (L) does not represent the lowest
  > possible values that can be achieved for optimism bias."

  Every band quotes that sentence with `gb-optimism-bias:3.6`. The check asserts it is in the read-back, word for word.
- **What changed in the figures:** on the six-line fixture, PV costs went from £869,490.11 to **£840,690.11**, the old figure being
  inflated by the 24% capital uplift. NPV went from −£52,807.28 to **−£24,007.28**. The band is −£348,290.23 to −£26,407.28, hand-computed
  to the penny.
- **Price year default (CCh, recommendation accepted):** the latest year the deflator series holds, shown as "Price year 2025-26 (latest
  deflator release held)". It moves forward by itself with a new release, and falls back to the current financial year only if no series
  is held.
- **Manifest, key → id → hash (accepted, with cc-ingest's addition):**
  - Each key resolves to its section id and a sha256 of the held text (from R2).
  - Every Cost–benefit report version stores that triple for each citation it prints (`result.citationsResolved`).
  - `compareManifests` names any key whose id or text differs from Ingest's manifest file once it lands.

## Engineering calls I made inside the approved decisions (CCh accepted all, 12:05)

1. **337, the manifest is DERIVED from the held paragraph rows.**
   - Each row's `sectionTitle` ends in its paragraph number ("… › 6.58"), so a key (`green-book:6.58`, `gb-discounting:3.8`,
     `gb-optimism-bias:3.11`, `green-book:table-1`) is valid exactly when the platform holds that paragraph. 463 keys today.
   - ⚠ This also answers cc-ingest's concern (inbox 11:08). Its stored ids are a running sequence (`…:186` for 6.58), which a re-cut could
     re-point. **The manifest keys on the paragraph number in the row, not on the id**, so a re-cut moves the key with the paragraph.
   - When Ingest ships a manifest file, `manifestFromFile` reads it, and a check should assert the two agree.
2. **Table 1 is held in code**: now `OPTIMISM_BIAS_TABLE_1`, both bounds (343, above). It is checked row by row against the PDF read-back.
3. **The discount factors are Annex A's, as published to 4 dp** (`round4(discountFactor(n))`, which `check:costing-params` proves equal to
   Annex A for every year). That is the only way "a hand-computed NPV to the penny against the 325 factor table" can hold, and it is what an
   HMT reviewer reproduces. The report says so.
4. **Year 0 of the schedule is the price year** (PV base year = price year).
   - Appraisal year t's discount year is (start − price) + t.
   - A start year before the price year is refused (Green Book 6.58, "not applied retrospectively").
   - A period whose last year, plus the delay test's one year, passes 125 is refused (GB discounting 3.10).
5. **Ranges stay ranges.** NPV low = PV benefits low − PV costs high, and BCR likewise. A single figure is a floor, listed in Gaps.
6. **The narrative states no figure.** A sentence carrying £, %, a ratio or "million" is cut, as is a [Ref: n] or key not on the lines, and
   the cut is said. So a model's arithmetic never sits beside the engine's.
7. **Lex may not value a benefit as "the owner's estimate".** That source is the owner's to give (2b, "only from a held unit-cost row or a
   held source it names").
8. **"Dictated" is checked, not trusted.** A benefit Lex writes is ACCEPTED only when the owner's own message this turn contains its words
   (`saidByUser`). Otherwise it is a PROPOSAL.

## Questions

None open. The price-year question was answered by CCh at 12:05 and is applied above.

---

## §2 Benefit lines (334) — Y1

- **Table:** `BenefitLine`.
  - status: ACCEPTED · PROPOSED · SET_ASIDE · REMOVED.
  - valuation: VALUED · NOT_VALUED.
  - source: REF · BENCHMARK · CITATION · OWNER.
- **Writers** (`lib/lex/cba/benefit-lines.ts`, one path for the form and Lex):
  - A figure with no source is **kept and stored NOT_VALUED**, with the reason said. It never enters a total.
  - A [Ref: n] must be in the idea's registry.
  - A unit-cost row must be held.
  - A citation must be a manifest key, or it is refused with the nearest held keys.
  - Remove = REMOVED, kept and restorable.
  - Every save is a FieldRevision (`fieldKey "benefitLine"`).
- **Limits** (`LIMITS`): label 300, name 120, measure 600, reasons 600, key 60, and 40 lines per action. Every refusal is worded and names
  the field and the limit (§30).
- **Screen** (`components/lex/ActionCbaLines.tsx`), in the record's Costs section under the cost lines:
  - Benefits (● valued / ○ not valued, and the words);
  - Lex's proposals with Accept / Set aside;
  - "Removed and set aside" with Restore;
  - Add a benefit, every box a `BoundedInput` with its counter.
- **Lex:** `add_benefit_line` and `set_benefit_line` (proposals unless dictated), and `answer_benefit_line` (the owner's buttons; asks first).
- **Actions Pack:** Benefits after Costs (paragraph `<n>.8b`).
  - The snapshot carries `benefitLines` **only when an action has some**, so no existing document's fingerprint changed and nothing went
    stale.

## §3 The costing companion, re-templated — Y1

`lib/lex/cba/costing-companion.ts`.

- The engine runs over the action's lines alone and sets out:
  1. Cost lines
  2. Benefit lines
  3. Assumptions
  4. Totals in the price year, then PV per year
  5. Optimism bias per line
  6. Gaps
  7. Caveat
- Lex's two-paragraph narrative goes under "What the costs and benefits are".
- It lands as a PROPOSAL on the action's Costing document, through `draftKindDocument`, so "Draft it", `draft_document` and the background
  queue all reach it.
- A check's stub call passes through, so checks spend nothing.
- **Per cost line**, under "For the cost–benefit analysis":
  - who pays;
  - a staffing line's employer on-cost (the owner's is accepted; Lex's is a proposal, and is refused without a source it holds);
  - a capital line's Table 1 project type, and a lower rate (owner only, with a reason);
  - a citation key.
  - Every change is a FieldRevision (`costLineAppraisal`).
- **Price, measured** (`scripts/measure-26y.ts`, scratch copy, 3 cost + 3 benefit lines, claude-sonnet-5-5): **0.49p, 0.50p, 0.46p**
  (n=3, mean 0.48p).
  - It replaces the V2b Costing figures (0.88–1.38p, the old whole-document template) in `KIND_RUNS`.
  - The prompt grows by about 180 characters per line.
  - About 1.5p was spent measuring.

## §4 The engine and the Cost–benefit report (336) — Y1

- **Engine** (`lib/lex/cba/engine-pure.ts`, pure, no model) produces:
  - costs and benefits by year, nominal and PV, and by heading × year, by payer and by beneficiary;
  - NPV and BCR only where benefits are valued, otherwise "benefits not valued — no BCR", never a zero;
  - five sensitivity **rows** (costs +20%, valued benefits −50%, a year's delay with what falls out traced, the schedule ±0.5 points);
  - the **optimism-bias band** beside the headline, never in it (342);
  - Gaps, Assumptions with sources, and a **trace for every figure**: lines, deflator rows, schedule years, Table 1 row, how.
  - Server half: `engine.ts`.
- **The report** (`lib/documents/build-cba-report.ts`, `lib/lex/cba/report.ts`):
  - stage banner, then a one-page summary, then **GAPS, before any table**, then Assumptions;
  - tables by year, heading, payer and beneficiary; sensitivity; optimism bias; the lines;
  - Lex's narrative, the caveat, and **ANNEX — THE TRACE**.
  - Every figure is printed through one function that tags it `[T n]` and throws if the figure has no trace.
  - Word and PDF go to R2 at `_exports/{idea}/cba/v{n}.*`.
  - **Every generation is a new `CbaReport` version**, and older ones are kept.
  - "stale: N lines changed since" compares the version's per-line fingerprint with the lines now.
- **Routes:** `GET/POST /api/ideas/[id]/cba` (summary, roll-up, settings, versions; generate) and `GET /api/ideas/[id]/cba/download?v=&format=`.

## §5 The IA draft — Y2

Listed in Output Reports as "**not available: IA template not held**". `iaTemplateHeld()` reads the corpus, so the line changes the day
Ingest holds the template. Not built, as the brief says.

## §6 Where it shows — Y1

- **Deepening section 5, "Costs and benefits"** (`components/lex/DeepeningCostsBenefits.tsx`). It is mounted by the page beside section 6,
  **outside** the `open &&` block.
  - It always shows the X3a roll-up (years 1–5), NPV, BCR, the present values and the Gaps, read-only.
  - **Locked:** the lock's count in words and no Generate.
  - **Open:** "Generate the Cost–benefit report — about 0.5p" (asked first), "Generate without Lex's narrative (free)", and the versions
    with Word / PDF and their stale flags.
- **Settings** (`components/lex/AppraisalSettings.tsx`) on the idea's Overview: period (1–60), start year and price year, with the
  deflator's range and base shown. The owner edits, others read, and "Use the default" clears a value.
- **Output Reports:** the Cost–benefit report with its versions and stale flags, and the IA draft as not available.
- **Labels:** `CBA_UI` in `screen-labels.ts`, plus a field-guide entry for each (`CBA_G`, typed so a missing entry fails to compile).
  `DEEPENING_UI.costs` is now "5 · Costs and benefits", and `cbaNotYet` is gone.

## §7 Lex — Y2

- **Tools:**
  - `read_cba_summary` and `explain_cba_figure` (free);
  - `generate_cba_report` (asks first, at the measured price, and obeys the lock);
  - `set_appraisal_period` (asks first, owner only);
  - `set_cost_line_appraisal`;
  - the three benefit tools.
- **Prompt rule** (system-prompt.ts, "COSTS AND BENEFITS"):
  - Lex states no cost or benefit figure that is not on a line or in the analysis; it quotes the trace.
  - Where an action has no lines it says "not costed yet — add cost lines on #N, or ask me to propose them from the Brief".
- **Honesty rule** (`honesty.ts`, kind `invented-figure`):
  - A £ figure in a sentence about costs or benefits must be one of: a sum a tool returned this turn (`ToolOutcome.figures`), the record's
    own sums (`recordFigures`: lines and the latest report), the user's own, or a rounding of one of them ("£870k" for £869,490).
  - Otherwise it is flagged, retried once, then cut. "My estimate" with a reason is allowed.

---

## §8 Verification

**`check:lex-26y` — 129 ran, 129 passed, 5 controls fired, 0 dead, 0 not run** (after 342 and 343; it was 116/116 before them).

- On its first run it caught one real defect: the delay row's note printed two untraced sums. That amount is now traced.
- The other first-run reds were the check's own:
  - a Word probe that read a running header;
  - a stub that bypassed the guard it was meant to test;
  - three refusals read from `data`, not `error`.
- **Part 3** (§4c arithmetic):
  - a six-line, 12-year fixture equals a hand computation from Annex A's published factors, **parsed from the committed read-back, not
    retyped**, to the penny: PV costs £869,490.11, PV benefits £816,682.83, NPV −£52,807.28;
  - the deflator round trip;
  - past year 125 refused;
  - a no-source benefit never in a total;
  - a figure-less staffing line never a zero;
  - the sensitivity rows;
  - every printed sum carries a [T n] mark, and every mark is in the annex.
- **Mutations, each reverted and verified restored:**

  | Mutation | Result |
  |---|---|
  | **put the optimism-bias upper bound into the headline** (CCh's required mutation) | **13 red** |
  | let a no-source benefit into a total | 8 red |
  | a figure-less staffing line becomes £0 | 1 red |
  | accept an unmanifested citation | 7 red |

  All four were re-run after 342 and 343; each was reverted and the file verified restored.

- **Parts 1–2, 4–7** run on a scratch copy of 452c5ade, through the real routes and writers, with the narrative's model call stubbed:
  - CRUD, with a FieldRevision for each save (6 for 6);
  - parity with Lex; dictated vs claimed-dictated;
  - the companion's shape, its floor label, and the uplift only once set, Table 1 named;
  - the manifest (463 keys; every key the engine prints is held);
  - report versions and "stale: 1 line changed since";
  - Word/PDF text match;
  - section 5 rendered locked and open, valued and not valued;
  - Lex's summary and trace, an invented figure caught.
- **The moved assertion:** `check:lex-26x3` part C ("not yet available" and section 5 inside DeepeningSections) is moved, with the reason
  written above it (`MOVED BY 26-Y`).

**Regression, one suite at a time:** see the CHANGE_LOG entry for this commit (filled from the run log).

## §9 Only Charlie can confirm

- The Benefits table on #38.
- The costing companion on #38, read cold.
- The Cost–benefit report's one-page summary on 452c5ade.
- Whether "not valued" reads honestly rather than evasively.
- The appraisal period default (10 years) and the price-year default (the latest deflator year, CCh 12:05).
- ⚠ 452c5ade has **no cost lines today**: 0 lines on its 58 live actions, #38 included, read directly at 18 Nov ~11:55 UTC. Its report
  will read "no costed line", with every live action that has neither a line nor a "no cost" answer counted in Gaps, until lines are
  added. That is a true report of an uncosted proposal, not
  a fault.

## Not done, named

- Distributional analysis, outturn comparison, the promotion module, IA summary-sheet extraction (§10, not this sprint).
- The IA draft itself (its template is not held).
- Civil Service Statistics floors (not held), and deflator release dates (not held).
- `entity_list_v5.md` does **not** list `BenefitLine`, `CbaReport`, `CostLine.appraisal`/`citationKey` or the three `Idea` columns. It is
  CCh-only, so I left it; for CCh.
