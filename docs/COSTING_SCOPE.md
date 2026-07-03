# COSTING_SCOPE.md — Phase 1 scoping for the Scrutinise costing engine

*Deliverable of §18.3 Phase 1. Purpose: survey how UK government already prices costs and benefits, validate the* `CostBenchmark` *schema against reality, register the sources, and define Phase 2. Companion to* `LEX_REBUILD_DESIGN` *§18. Dated 03-07-2026.*

***

## 1. Headline finding — the field is mature; our job is extraction, not invention

UK government has spent 20+ years standardising exactly what we need. There is an official manual for valuing costs and benefits (HM Treasury's **Green Book** — a new, leaner edition published **February 2026**, focused purely on appraisal), a family of supplementary guides (wellbeing, health, departmental), an official metric for the burden regulation places on business (**EANDCB**), an independent scrutiny body that grades government's own cost estimates (**RPC**), and quality-assured unit-cost databases with 1,000+ ready-made values. Scrutinise does not need to invent a valuation methodology — it needs to **adopt the government's own**, which has a huge side-benefit: proposals costed the way HM Treasury costs things are speaking Parliament's language.

## 2. Verified anchor values (the first benchmark rows)

| Benchmark                                                                                                                       | Value                                                                                                                                                                                                                             | Price year                                                                | Source (Tier 1)                                 |
|---------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------|-------------------------------------------------|
| **QALY** (quality-adjusted life year — one year of full health)                                                                 | **£70,000**                                                                                                                                                                                                                       | 2020/21 (Green Book 2022 clarification; DHSC guidance carries it forward) | Green Book / DHSC supplementary health guidance |
| **WELLBY** (wellbeing-adjusted life year — a 1-point change in life satisfaction on a 0–10 scale, for one person, for one year) | **£13,000** (low £10k, high £16k)                                                                                                                                                                                                 | 2019                                                                      | HMT Wellbeing Guidance for Appraisal (Jul 2021) |
| **VPF** (value of a prevented fatality)                                                                                         | \~**£1.8m** (2016) → uprated annually by GDP per head; current figure published in the **DfT TAG Data Book** (Phase 2 pins the live number)                                                                                       | rolling                                                                   | DfT TAG                                         |
| **Discount rate (STPR** — Social Time Preference Rate, how future costs/benefits are converted to today's values\*\*)\*\*       | **3.5%** real, first 30 years (under formal review 2026 — watch)                                                                                                                                                                  | —                                                                         | Green Book                                      |
| **EANDCB** (equivalent annual net direct cost to business — the government's single metric for regulatory burden)               | metric, not a value; **±£5m/yr** is the threshold triggering independent RPC scrutiny                                                                                                                                             | —                                                                         | Better Regulation Framework                     |
| **Admin burden (Standard Cost Model)**                                                                                          | formula: time × wage × frequency × population affected; wages from **ONS ASHE** (Annual Survey of Hours and Earnings)                                                                                                             | rolling                                                                   | SCM / ONS                                       |
| **Unit costs, social outcomes**                                                                                                 | **GMCA Unit Cost Database** — 1,100+ quality-assured entries (crime, education, employment, fire, housing, health, social services, energy); latest edition **Nov 2025**; adopted as Green Book supplementary guidance since 2014 | per entry                                                                 | GMCA Research Team                              |
| **Unit costs, health & social care**                                                                                            | **PSSRU "Unit Costs of Health and Social Care"** — annual, per-service costs (GP appointment, hospital bed-day, social worker hour…)                                                                                              | annual                                                                    | PSSRU (Kent)                                    |
| **Costs of crime**                                                                                                              | Home Office "Economic and social costs of crime" — per-offence unit costs (e.g. cost of a burglary, a homicide)                                                                                                                   | 2015/16 base (updates exist)                                              | Home Office                                     |

Two implications baked into the engine design: **(a) every value has a price year** and must be uprated to a common year before aggregation (via the GDP deflator — the standard index for converting a £ figure from one year's prices to another's); **(b) several values are officially contested** (the VPF's evidence base has published academic critiques), which is not a problem for us — it is precisely why the §18.3 principle is *ranges, sources shown, user-overridable*.

## 3. Schema validation — deltas to `CostBenchmark`

The §18.3 schema survives contact with reality with five additions:

```
CostBenchmark {
  id, domain, metric, unit, low, high, source, sourceUrl, year, method, notes   // as designed, plus:
  priceYear     Int      // the prices the value is expressed in (distinct from publication year)
  category      enum     // HEALTH | LIFE_SAFETY | WELLBEING | TIME | CRIME | ADMIN_BURDEN |
                         // EMPLOYMENT_ECONOMY | HOUSING | EDUCATION | ENVIRONMENT | SERVICE_UNIT_COST
  region        String   // "UK" | "England" | … (many unit costs are England-only)
  uprateMethod  enum     // GDP_DEFLATOR | GDP_PER_HEAD | NONE  (VPF uprates by GDP/head, most by deflator)
  confidence    enum     // OFFICIAL_CURRENT | OFFICIAL_DATED | ACADEMIC | SECTOR
}
```

`IdeaAssumption` (user overrides + evidence) is validated unchanged. **New small table:** `DeflatorSeries { year, index }` — the GDP deflator series as data, so uprating is a lookup, not a hardcode.

## 4. Methodology rules the estimator inherits (Green Book discipline)

1.  **Ranges, never points.** Government IAs present low/central/high; so do we (already designed).
2.  **Common price base.** Uprate everything to the current year before totalling (§3 deltas enable this).
3.  **Optimism bias** — the Green Book *mandates* uplifting cost estimates because humans systematically underestimate; the engine applies a stated uplift to implementation costs (standard uplift %, shown, and overridable like everything else).
4.  **The three-lens view.** GMCA's fiscal / economic / social trichotomy maps cleanly onto ours: fiscal ≈ implementation + enforcement (cost to the state), economic ≈ regulatory friction (cost to the economy), social ≈ the benefits side (QALYs, WELLBYs, outcome unit costs). Our categories are the government's, renamed for lay users.
5.  **Regulatory friction = EANDCB.** Our third category is literally the government's own metric — the engine should compute and label it as an indicative EANDCB, and flag when it crosses **±£5m/yr** ("this proposal would trigger independent RPC scrutiny — here's what that means"). That flag alone is a credibility feature no lay user would know to include.
6.  **Discounting**: v1 presents one-off + annual figures undiscounted with the STPR noted; multi-year NPV (net present value) discounting is a v2 refinement, especially with the 3.5% rate under formal review.

## 5. Source register (tiered)

-   **Tier 1 — official, current, extract in Phase 2a:** Green Book 2026 + supplementary guidance (wellbeing, health/DHSC, environment); MHCLG Appraisal Guide; DfT TAG Data Book; GMCA Unit Cost Database (Nov 2025); PSSRU annual unit costs; Home Office costs of crime; ONS ASHE wages; RPC guidance (EANDCB, SaMBA — the small-and-micro-business assessment).
-   **Tier 2 — the corpus:** published **Impact Assessments** (legislation.gov.uk associates IAs with instruments — audit needed, see §6), RPC opinions, Post-Implementation Reviews, select-committee cost evidence. These are gold for *precedent* costing: "when government did something similar, it cost X."
-   **Tier 3 — academic/sector:** used only when Tiers 1–2 are silent; flagged `ACADEMIC`/`SECTOR` confidence.
-   **Licensing:** Tier-1 government material is OGL (Open Government Licence). GMCA's database is publicly distributed and government-endorsed but is **not** Crown copyright — Phase 2 confirms its licence terms before ingesting values wholesale (fallback: cite-and-link per entry, which we do anyway).

## 6. The corpus angle

Two Phase 2 audits: **(a) IA coverage** — does the corpus already hold the impact assessments published alongside SIs/Acts? If not, they're a bounded, high-value ingest (bulk-download-first per the playbook). **(b) Cost-bearing debates/committee material** is already in — the extraction pipeline (§7c) mines it. Long-term, past IAs are the single best source of *realistic* implementation/enforcement figures because they are what departments actually predicted for comparable interventions — and PIRs tell us whether they were right.

## 7. Phase 2 plan (gated on this document's sign-off)

a. **Hand-seed \~50 Tier-1 benchmark rows** (the §2 anchors + the most reusable GMCA/PSSRU/Home Office entries). 1–2 sessions; replaces CC's placeholder rows; instantly makes the estimator real. b. **Corpus IA audit** → ingest decision (own mini-brief if needed). c. **LLM-assisted extraction pipeline:** Gemini reads IAs/RPC opinions from the corpus → proposes candidate `CostBenchmark` rows with quotes + citations → human sign-off before insert (never auto-insert). d. **Deflator series** loaded as data; uprating verified against a known worked example. e. **Validation run:** cost the 5p bag charge and "Revoke MiFID II" end-to-end; compare against the real IAs' figures. If we land in the same order of magnitude with honest ranges, the engine is credible; if not, the deltas tell us what's missing. (This is the engine's gold-query equivalent.)

## 8. Risks, stated plainly

False precision is the reputational risk — mitigated structurally (ranges, visible sources, overrides, "this is an indicative estimate, not an Impact Assessment" labelling). Contested values (VPF) are presented with their official status *and* their contest noted. Category-boundary blur (is a familiarisation cost implementation or friction?) is resolved by convention notes on each benchmark, mirroring IA practice. And the Green Book's 2026 slimming plus the live discount-rate review mean sources move — every benchmark row carries its edition/year so staleness is visible, not silent.

## 9. What CC needs now (one-line schema brief)

Apply the §3 deltas (`priceYear`, `category`, `region`, `uprateMethod`, `confidence` on `CostBenchmark`; new `DeflatorSeries`) as additive idempotent SQL in Sprint 3's Task 5, and have the estimator uprate to the current price year before aggregating. Everything else in §18 stands.
