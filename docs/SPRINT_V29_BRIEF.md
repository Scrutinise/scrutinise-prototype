# SPRINT V29 — UK COMPLETION WAVE
**Written:** 20 Jun 2026, by CCh. Repo `Main` (HEAD = V28 close). Read CLAUDE.md, handoff (V28 seeds draining; V26 DROP may have fired by the time this runs — see §0), playbook (§1b politeness budget, §1c ✓-rebaselining, §1d honest denominator, §breakers, licence-at-the-licence-page trap, gtm "ogl" false-positive trap), licence map, QUANGO_UNIVERSE.csv, INDEPENDENT_REVIEWS_UNIVERSE.md, EXEMPT_ORGS_PROBE.md.

**Goal:** take the UK corpus to *maximal category completeness* — every category of UK public legal, parliamentary, and quasi-judicial interpretation material available under a clean licence is acquired or has a verified route. After this sprint, what remains is genuinely optional depth (evidence bundles, pre-2016 Scottish OR, financial corpus, US spec), not category gaps.

## AUTONOMY
Run end-to-end without pausing. Reversible in-scope choices are yours; fix-or-report otherwise. No git until commit-all.sh; no spend beyond the seeds defined here; no destructive ops. New sourceTypes seed POST-PUSH (V24 lesson). **Licence discipline is absolute: verify each new source at its actual licence/copyright page, not a footer grep (avoid the gtm "ogl" false-positive that bit V24/V25). Build only sources with a clear open licence; everything else → a ranked V30 list with the finding recorded.** Probe-with-auto-upgrade throughout: `--pilot`/`--measure`/`--seed`, predict-measure-compare. Neon ~14GB / 20GB — flag if any single corpus would push the total past 17.5GB.

## 0. CONTEXT — DROP / soak
This sprint is pure-additive and orthogonal to the V26 DROP path. If the DROP has fired (legacy `Legislation*` gone), nothing here is affected (we read only `corpus_sections`). If it hasn't, do NOT touch the legacy tables. Confirm current state from handoff at start and note it in the report.

## 0a. PRIORITY ORDER
Quick data-quality win first, then acquisition-clean builds (high value, clear licence), then the probe wave (licence unknown → check then build), then the gated captures:
§1 ICO failed-rows triage → §2 Quango T3 tail → §3 Parliament remainder → §4 CPS guidance → §5 Independent reviews build → §6 Exempt-orgs (Ofgem/Ofcom) → §7 Ombudsmen probe wave → §8 HMRC soft-law audit → §9 POSTnotes + Library briefings (capture-gated) → §10 docs.

## 1. ICO FAILED-ROWS TRIAGE (live data quality — quick)
The 20 Jun email shows **3,226 ico failed rows** (+ 9 scottish-courts). Diagnose: are these genuine dead pages (404 / no extractable text → classify with `availability_status`, surface honestly per §1d, NOT a bug) or a systematic fetch failure (a subcategory route, a CF change, a PDF-host quirk → fix the adapter and let the breaker-cleared rows re-run)? The sample (`action-weve-taken/foi-regulatory-action/2026/05/ministry-of-defence: page fetch failed`) suggests a route or a transient — investigate a dozen failures before concluding. Acceptance: every failed row either reclassified as a known-unknown (with a reason) or recovered by an adapter fix. Same quick check for the 9 scottish-courts failures.

## 2. QUANGO TRANCHE 3 — THE TAIL (acquisition-clean; govuk-content already deployed)
We hold ranks 1–60 by relevant-doc weight (T1 1–20, T2 21–60) = `quangos-govuk` 125,517 docs of the ~162,004 relevant-doc universe — ~77% of volume but only ~60 of ~1,255 orgs. **Seed the entire remaining tail** (all orgs in QUANGO_UNIVERSE.csv not already seeded), same machinery as T1/T2: `govuk-content` rows, OGL, URL-dedup against every existing gov.uk `sourceUrl`, the per-org 5×-estimate guard, `utaac_decision`/`fatality_notice` excluded. Measure first (`--dry-run`): report exact remaining org count + doc total. Diminishing returns per org is expected and fine — the point is closing the org universe to 100%. Acceptance: every relevant-format org in the universe seeded; `quangos-govuk` denominator re-baselined to confirmed at drain.

## 3. PARLIAMENT REMAINDER (all Open Parliament Licence — clean, finite, API-driven)
The Developer Hub (`developer.parliament.uk`) is the authoritative inventory; cross-referenced, these four are uncaptured. All OPL v3.0, all JSON APIs (same robust pattern as V28 division-votes). Build each as its own sourceType, probe→pilot→auto-upgrade:
- **§3.1 Erskine May** — `erskinemay-api.parliament.uk` (parliamentary procedure authority; queryable by part/chapter/paragraph). High value: the procedural rulebook for how legislation moves. One section per paragraph/section.
- **§3.2 Early Day Motions** — via the Oral Questions & Motions API (or the EDM dataset). One section per motion carrying motion text + primary sponsor + signature count + session. Backbench-opinion signal absent from Hansard.
- **§3.3 E-Petitions** — `petition.parliament.uk` (each petition exposes JSON; `/petitions.json` paginated). One section per petition carrying petition text + government response (where given) + signature count + status + any linked debate. The public-sentiment→policy thread.
- **§3.4 Register of Members' Financial Interests** — `interests-api.parliament.uk`. Declared-interests data; model for search (likely one section per member's current register entry, or per interest — decide and note). OPL.
Acceptance: four new corpora seeded (post-push), each licence-mapped OPL3, each piloted end-to-end with a printed sample. Universe sizes reported.

## 4. CPS PROSECUTION GUIDANCE (own-domain, OGL v3.0 — verified)
`cps.gov.uk/prosecution-guidance` + `cps.gov.uk/publication/...` — the Code for Crown Prosecutors + the full legal-guidance library (the prosecutorial interpretation of criminal law: how charging decisions are made). Licence VERIFIED OGL v3.0 (CPS content carries the OGL statement; confirm at the CPS copyright page, not a footer). Own domain (not the gov.uk content API) → own enumerator (sitemap or the guidance-library index). Probe size, pilot one guidance doc end-to-end (HTML or PDF), auto-upgrade. New sourceType `cps-guidance`. Acceptance: enumerable route confirmed, licence verified at source, piloted, seeded post-push.

## 5. INDEPENDENT REVIEWS — BUILD (V28 §6 scoped it; build now)
Build the family from INDEPENDENT_REVIEWS_UNIVERSE.md. Commissioned independent reviews/audits (Cass, Casey 2025 CSE audit, Augar, Lammy, Windrush, Francis, Taylor, Laming…) — distinct from statutory inquiries, mostly gov.uk-published OGL PDFs. Clone the inquiry-reports machinery + gov.uk Search discovery (V28 already proved Casey extracts clean at 72,663 words). New sourceType/corpus `independent-reviews`. Curate reports-only (exclude government responses, ToR, terms). Own-domain reviews (e.g. Cass on its own site) → Web Archive adapter or note as a follow-up. Acceptance: register built, all paths PDF-verified, seeded post-push, denominator confirmed.

## 6. EXEMPT-ORG BUILDS — Ofgem + Ofcom (V28 §8 licence-cleared)
V28 corrected V27: **Ofgem publishes under OGL v3.0** and **Ofcom has own open re-use terms** (free + attribution) — both buildable. Build both (own-domain enumerators, not the gov.uk API):
- **Ofgem** — ~20k publications via the paged Drupal sitemap (V27 probe sized it). OGL v3.0.
- **Ofcom** — statements/decisions/consultations; own-open licence (verify the exact reuse wording at source and record it).
Probe→pilot→auto-upgrade each; new sourceTypes `ofgem` / `ofcom`. Ofwat (© Ofwat) and BoE (no clear open statement) stay a V30 email/contact item — do not build. Acceptance: both built + piloted + seeded post-push, licences recorded at source.

## 7. OMBUDSMEN PROBE WAVE (licence-gated — check then build)
A whole uncaptured family of quasi-judicial bodies that interpret and apply law to real cases. Probe each for route + universe size + **licence** (the gating question — many ombudsmen assert own copyright with no OGL). Build only clean-licence ones this sprint; the rest → ranked V30 list. Deliver `OMBUDSMEN_PROBE.md` (body | route | size | licence | effort), mirroring EXEMPT_ORGS_PROBE.md.
- **Financial Ombudsman Service** — final decisions database since 1 Apr 2013 (large, plausibly 100k+; anonymised). Highest volume + highest relevance (financial-services law application).
- **Pensions Ombudsman** — all Determinations published (binding, County-Court-enforceable).
- **Local Government & Social Care Ombudsman** — decisions database.
- **Parliamentary & Health Service Ombudsman** — decisions/reports.
- **Housing Ombudsman** — decisions.
Acceptance: all five probed + sized + licence-checked-at-source; clean-licence ones built+piloted+seeded post-push; the rest ranked in the doc with the blocker named.

## 8. HMRC SOFT-LAW AUDIT (gov.uk route — likely small)
Audit whether the HMRC interpretation soft-law is already in our corpora or needs explicit seeding: **Extra-Statutory Concessions** (consolidated in VAT Notice 48, gov.uk), **HMRC Statements of Practice**, **Revenue & Customs Briefs**, and the **VAT Notices** set. Most are gov.uk-published (so reachable via the route quangos-govuk uses) — check coverage against `corpus_sections` before seeding; seed only the genuinely-missing, via the existing gov.uk-content path where possible. Acceptance: coverage report (have / missing per family); missing clean-licence items seeded.

## 9. POSTnotes + LIBRARY BRIEFINGS (capture-gated — same CF wall)
- **§9.1 POSTnotes / POSTbriefs** (`post.parliament.uk` + `researchbriefings.parliament.uk`, archive to 1989) — peer-reviewed expert briefings, the same explanatory layer as the Library briefings. **Re-probe `post.parliament.uk` specifically** — it may be a separate WP install less aggressively gated than commonslibrary. If reachable server-side, build it (OPL). If CF-gated, it shares the V28 §5 capture seam.
- **§9.2 Library briefings** (V28 §5, built to the gate) — unblocks the moment Charlie supplies the `cf_clearance` + research-briefing endpoint capture. **One capture likely unblocks BOTH** POSTnotes and Library briefings (same researchbriefings host). Wire POSTnotes into the same capture-gated seam. Acceptance: POST reachability re-confirmed; if open, built; if gated, the seam is capture-ready and the report states the single capture that unblocks both families.

## 10. VERIFICATION & DOCS
Per-source scorecards with predictions (scored at drain). licence-map additions (Erskine May/EDM/petitions/interests → OPL3; cps-guidance → ogl-3.0; independent-reviews per-source; ofgem → ogl-3.0, ofcom → own-open; ombudsmen as found; POST → OPL). seed-rate-limits.ts for every new sourceType. CHANGE_LOG V29 + handoff CURRENT STATE + playbook (any new patterns — esp. ombudsmen licence findings, the Parliament API family, CPS enumerator). OMBUDSMEN_PROBE.md delivered. Corpus-status table generator (run POST-DRAIN → CORPUS_STATUS_V29.csv). `tsc --noEmit` clean. **Report a category-completeness summary: for each family in this brief — DONE / BUILT-POST-PUSH / PROBED-V30 / GATED-ON-CAPTURE — so Charlie can read "UK complete" status at a glance.**

## 11. POST-PUSH RUN ORDER (after commit-all.sh deploys Ingest+Ops)
1. `seed-rate-limits.ts` (all new sourceTypes). 2. Confirm Ingest deploy SUCCESS before seeding new sourceTypes. 3. Seed in this order with a canary + egress check on each new host: quango-t3 → erskine-may → edm → petitions → members-interests → cps-guidance → independent-reviews → ofgem → ofcom → (clean ombudsmen) → (missing HMRC soft-law). 4. At drain: re-baseline new/changed corpora; `v29-corpus-status-table.ts`; `v20-licence-backfill.ts` for NULL stragglers.

## 12. CHARLIE'S PARALLEL ACTIONS
- **One devtools capture** (`cf_clearance` + research-briefing endpoint on the researchbriefings host) — unblocks POSTnotes + Library briefings together (same technique as V27 Scottish Courts).
- **College of Policing** — chase the pending response on post-2022 APP access (external dependency; no CC action beyond a draft chase email if you want one).
- **FCL computational-analysis licence** — submit the completed application (keeps bulk case-law access legitimate; coverage already ~complete).
- **V26 DROP** — give the go once soak + §1.3 (done) + search-thread Lex-grounding repoint are all met.

## 13. OUT OF SCOPE (deliberate tail, not category gaps)
Inquiry evidence bundles; pre-2016 Scottish OR (legacy archive host); Ofwat/BoE (no clean licence — V30 contact); financial corpus; SSRN (licence-hostile); other regulators' decision databases (CMA/ASA — lower priority, V30 if appetite); procedure rules (Civil/Criminal/Family Procedure Rules — add to V30 probe if wanted); the search FTS/embeddings build (search thread); US jurisdiction spec (next structural move, separate).

## 14. GIT
No git mid-sprint; single commit-all.sh; preview approval; Main.
