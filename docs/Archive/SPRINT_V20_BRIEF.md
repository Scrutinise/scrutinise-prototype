# SPRINT V20 — THE PROBE WAVE
**Written:** 12 Jun 2026, by CCh. **Repo:** `C:/Code/scrutinise-prototype`, branch `Main`.
**Read first:** handoff checklist (V19 carry-over), INGEST_PLAYBOOK (politeness budget, ✓ re-baselining, breakers).

## 0. CONTEXT & DOCTRINE
Corpus ~91% of the *enumerated* universe; throughput now comes from parallelism across many polite sources, not rate. V20 opens every remaining front with bounded probes.

**Probe-with-auto-upgrade rule (Charlie-approved):** each probe proves route, universe size (✓), polite rate, and verified sections end-to-end on a small bounded run. If fully clean → proceed straight to full seed, no round-trip. If anything is ambiguous (licensing, access instability, parse quality, universe >2× expectation) → classify and report instead. One guard on very large universes: if projected Neon size would exceed 16GB of the 20GB headroom, report before upgrading.

## 1. V19 CLOSEOUT (first, from the handoff checklist)
1. Pre-1963 regnal pass: cleanup of the 5,840 chrome-garbage acts + regnal seeder run (TNA penalty-box cooloff respected — confirm IP is clear before starting).
2. Regional enumeration → complete or re-baseline ✓.
3. ✓ re-baseline retained-eu, et-decisions, uk-treaties as they drain.

## 2. LICENCE METADATA (infrastructure, before new seeds)
Add a `licence` field (+ attribution string where required) to `corpus_sections`; per-source licence map maintained in the playbook and applied at ingest. Backfill existing corpora from the map. Expected mappings to verify, not assume: TNA legislation + gov.uk → Open Government Licence; parliamentary material (pwdata, LDA, Hansard) → Open Parliament Licence; Find Case Law → Open Justice Licence (note its re-use conditions explicitly); EUR-Lex → EU reuse decision; FCA/quangos → per-source check.
**OECD:** post-2024 CC-BY material may be seeded with attribution. Pre-2024 CC-BY-NC is **not ingested** (link-only) — default-excluded from any future commercial surface; Charlie's free-tier idea is deferred as a legal question for if/when a commercial product exists. Log the decision and rationale in CHANGE_LOG.

## 3. PROBE WAVE (run as parallel fronts; each gets a one-paragraph scorecard)
1. **Committees API — first probe.** Pull the OpenAPI spec from `committees-api.parliament.uk`, identify publications/evidence endpoints, run ONE document end-to-end. Decision point: are document files served CF-free (API host or CDN), or do links route back to the blocked site? If clean → reseed reports + evidence via API, clear the breaker, retire the portal rows (retirement SQL in handoff). If blocked → report; local-fetch decision returns to Charlie.
2. **Historic tax tribunals** (financeandtax archive, Apr 2003+, postback scraping) — approved, auto-upgrade. Tax-relevant corpora carry a standing auto-upgrade.
3. **Explanatory Notes (Acts) + Explanatory Memoranda (SIs)** on legislation.gov.uk — the mission-critical "intention" layer. Same TNA infrastructure and politeness budget; universe likely six figures.
4. **Law Commission England & Wales** (lawcom.gov.uk) — reports + consultation papers.
5. **NI courts** (judiciaryni.uk) and **Scottish courts** (scotcourts.gov.uk) — the Find-Case-Law gaps.
6. **HUDOC**: probe the search UI's own XHR calls to find the post-change endpoint; classify.
7. **NAO** and **SSRN**: one classification fetch each — name the failure mode, then route or park.
8. **Partials audit**: written-statements, college-of-policing, sentencing-council, building-regs, planning-policy, nilawcom — root-cause why each discovery stopped (the retained-eu pagination bug pattern is the prime suspect), then complete or re-baseline ✓.
9. **Historic Hansard 1803–1918** (api.parliament.uk/historic-hansard) — universe-sizing probe; auto-upgrade permitted subject to the 16GB Neon guard.

## 4. EMAIL HONESTY
TOTAL block: label the percentage "of enumerated universe" and add one line listing major unenumerated sources (committees, EN/EMs, quangos, historic Hansard, NI/Scot case law, …) — the number must never quietly flatter us. Update the list as probes land.

## 5. VERIFICATION
Per-probe scorecard in CHANGE_LOG: route | universe (✓ or ~) | polite rate | sections verified | auto-upgraded Y/N | prediction vs observed. Breakers armed for every new sourceType. No completed corpus left on a `~` denominator.

## 6. OUT OF SCOPE
Quango scoping (V21 — needs its own scoping document against the gov.uk organisations register); corpus unification (legacy 914k) + Railway-DB→Neon migration (the sprint after); all search/enrichment schema work (owned by the search conversation — if a probe suggests enrichment-at-ingest opportunities, note them for that thread, do not build).

## 7. CHARLIE'S PARALLEL ACTIONS
BAILII email (Hale, cc Bell_West) + donation; Railway → Hobby on 28 Jun (calendared); confirm or override the OECD §2 position.

## 8. GIT DISCIPLINE
No git mid-sprint; single commit-all.sh; Vercel preview approval; Main.
