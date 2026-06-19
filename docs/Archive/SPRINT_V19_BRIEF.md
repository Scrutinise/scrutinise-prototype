# SPRINT V19 — P1 TO 100% + PARLIAMENTARY RECORD COMPLETION + TAX COMPLETENESS
**Written:** 11 Jun 2026, by CCh. **Repo:** `C:/Code/scrutinise-prototype`, branch `Main`.
**Read first:** handoff, INGEST_PLAYBOOK (breakers, cost model, source priority bulk → HTML → API → PDF).

## 0. CONTEXT & GOALS
Corpus at 83.7% (10,525,196 / ~12.57M), queue empty, V18 complete. Charlie's directive for V19, in priority order: (1) **every Priority-1 corpus to a verified 100%** — primary legislation tails and the complete tax universe; (2) **the parliamentary record to verified completion** (it's P3 but cheap and high-value in Lex's hands); (3) standing hygiene: classify, never discard; re-baseline denominators to measured reality (✓) wherever a corpus completes.

A politeness doctrine change applies throughout (see §7): last night's 503 storm on TWFY means our default rates were too hot. **Speed is no longer the scarce resource; source goodwill is.** When retrying any source that 5xx'd under load, halve the previous rate.

## 1. PARLIAMENTARY RECORD — finish it
1. Reset the 297 failed pwdata rows (192 debates, 55 lords, 49 lordswrans, 1 wrans) to pending; set twfy-pwdata rate to half the V18 value before Ingest picks them up. The 503s were us overdriving a charity's server — document the rate and reasoning.
2. After the retry drains: **re-baseline all seven pwdata denominators to measured actuals, marked ✓** (the era-average estimates are now provably wrong — wrans shows 60.9% only because the 2.0M estimate was bad). Any residual file that still fails goes to the specialist queue with classification, not silent retirement.
3. Acceptance: all pwdata corpora ≥99.9% against ✓ denominators; remaining failures individually classified.

## 2. P1 LEGISLATION TAILS
1. **primary-acts-pre-2000**: 1,084-section gap (69,630/70,714✓). Root-cause why discovery stopped (retained-eu-style pagination? hasNoProvisions? unfetched CLML?), fix, complete.
2. **regional** (123,641/~160,000): same audit-then-complete treatment; if the 160k estimate is wrong, re-baseline with evidence.
3. **retained-eu**: the approved completion pass from V18 §6 is STILL OUTSTANDING — run it first (bounded ~2h), close the corpus at its real ~23k, retire the 140k phantom denominator.
4. si-pre-2010 tail (8 sections) and lda-commonsoralquestions tail: close or classify.

## 3. TAX COMPLETENESS (new corpora — the IBFD-replication pass)
Charlie reviewed IBFD's platform: their replicable layer is aggregated public primary sources; their commentary is proprietary and out of scope (Lex generates analysis; we never ingest IBFD content itself). Gaps to seed, all via existing clients:
1. **HMRC ancillary instruments** via govuk-content: Revenue & Customs Briefs, Statements of Practice, Extra-Statutory Concessions, VAT/excise Notices. Enumerate via the gov.uk Content/Search API per document type; report universe sizes before mass-seeding.
2. **Double Taxation Agreements**: gov.uk hosts the full per-country DTA collection (HTML pages + PDFs). Seed as corpus `tax-treaties-dta`. NOTE: this is also the probable unblock for `uk-treaties` — same documents, working host. If confirmed, retire the broken FCO client and fold uk-treaties into this corpus with the breaker cleared and CHANGE_LOG note.
3. **Historic tax tribunal decisions**: FCL already gives FtT(Tax) 2019+ and UT(TCC) — covered by §4. Investigate the older tribunals decisions archive (Special Commissioners / VAT & Duties Tribunal, financeandtax.decisions.tribunals.gov.uk or successor) — one classification fetch, report access route, do not build without confirming.
4. **OECD models/TP guidelines**: licensing check only — OECD material is generally NOT freely redistributable; report findings, seed nothing without Charlie's sign-off.
5. **hmrc-manuals 16,061 zero-section done rows**: classify by sampling ~100 (withdrawn? redirect? parser miss?), fix the real ones, mark the dead ones `skipped` with reason. Re-measure the universe and re-baseline ✓.

## 4. CASE LAW RE-POINT (bailii → official sources)
Extend the working FCL client/discovery to the tribunal courts FCL now publishes: EAT, Upper Tribunals (incl. TCC), Investigatory Powers Tribunal, FtT chambers available (Tax, GRC, Employment — the FtT(Employment) collection alone is ~72k documents). Map and retire the blocked corpora: `bailii-eat` → FCL EAT; `bailii-tribunals` → FCL UT/FtT + gov.uk Employment Tribunal decisions (2017+) where FCL is thin; `bailii-privy-ni` → Privy Council via FCL now; **NI courts stay parked** (FCL excludes them — judiciaryni.uk is a future source; BAILII contact in progress). Update the Sources doc and breaker/queue rows accordingly. Politeness: FCL took our 99.6% run happily; keep its existing rate.

## 5. CHARLIE'S PARALLEL ACTIONS
- BAILII email (Hale, cc Bell_West) + donation — drafted separately.
- Run any seeders CC hands over (same terminal pattern).

## 6. VERIFICATION
1. Every corpus this sprint touches ends at a ✓ denominator or a classified residue — no `~` estimates left on completed corpora.
2. Email's P1 block shows 100.0% across primary legislation + tax corpora (or named, classified exceptions).
3. Sections-vs-rows divergence ~0 on all new seeds; zero-output breaker armed for govuk-content tax types.
4. Predicted vs observed line in CHANGE_LOG for each new corpus (universe size, duration, cost).

## 7. DOCS (mandatory)
Playbook: new doctrine entry — **"Source politeness budget: a 5xx storm under load is a rate signal, not a retry signal; halve and document. Sections/hour is not the KPI on small charitable/public hosts — completion without complaint is."** Plus: denominator re-baselining procedure (✓ rules), tax-source map, FCL court-coverage table. Handoff + CHANGE_LOG per usual.

## 8. OUT OF SCOPE
Committees API task (CCh write-up pending), quango scoping (V20), HUDOC/NAO/SSRN classification (CCh), corpus unification + Railway-DB migration, all search/enrichment work (owned by the search conversation).

## 9. GIT DISCIPLINE
No git mid-sprint; single commit-all.sh; Vercel preview approval; Main.
