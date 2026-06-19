# SPRINT V27 — BREAKER FIX, SCOTTISH COURTS, QUANGO T2, EXEMPT-ORG PROBES
**Written:** 18 Jun 2026, by CCh. Repo `Main` (HEAD = V26 close, 58f2e76). Read handoff (V26 cutover done + soak), playbook §1c/§1d/§19, politeness budget, licence map.

## AUTONOMY
Run end-to-end without pausing. Decisions here are pre-made; reversible in-scope choices are yours. Anything needing a rethink: fix if reversible, else complete the rest and report with a recommendation. No git until commit-all.sh; no spend beyond these seeds; no destructive ops. Probe-with-auto-upgrade applies (Neon ~13GB now; flag if any single corpus would push the total past 16GB).

## 0. CONTEXT — safe to ingest during the soak
The V26 app-DB cutover is live; the Railway→Neon soak runs to ~25 Jun with the legacy `Legislation*` tables intact as the rollback path. **New ingestion is safe during the soak** — it writes only to `corpus_sections` on Neon, which is orthogonal to the app tables and the legacy rollback path. Do NOT touch the legacy `Legislation*` tables or the §6 DROP (still gated).

## 1. OPS BREAKER-EVALUATION FIX (first — it's a safety mechanism, and V27 resumes ingestion)
CC flagged in V25/V26 that Ops breaker-evaluation looks stale (`source_status` last updated 14 Jun) — breakers aren't currently being re-evaluated. No harm while the queue was empty, but V27 seeds new sources, so fix first. Diagnose why the 15-min breaker-eval loop stopped updating `source_status` (Ops liveness clearly runs — it restarts the worker — so it's the eval step specifically), repair, and verify a deliberate trip + recovery before mass-seeding. Playbook pattern updated.

## 2. SCOTTISH COURTS — build the seeder from the captured endpoints (auto-upgrade)
Charlie captured the API (no auth token — gated only by Origin/Referer; CORS is browser-only, so a server-side fetch with these headers works):
- **Enumerate:** `POST https://api.pa.web.scotcourts.gov.uk/web/search`, `Content-Type: application/json`, body `{"indexType":"Judgments","category":"","filters":[],"query":"","page":N,"limit":50}` — empty query returns all judgments; page through N until exhausted (try a larger `limit` politely; fall back to 50).
- **Fetch:** `GET https://api.pa.web.scotcourts.gov.uk/web/definition/{id}` for each id returned.
- **Required headers on both:** `Origin: https://www.scotcourts.gov.uk`, `Referer: https://www.scotcourts.gov.uk/`, `Accept: application/json`. The `X-Ms-*` headers in the capture are Azure-SDK telemetry (client-generated GUIDs) — not auth; omit or generate fresh.
Probe one judgment end-to-end (verify sections + licence — Scottish court judgments are Crown copyright, reusable under OGL; confirm and record), then auto-upgrade. Seed as `scottish-courts`, clear the blocked status. Politeness: start modest, the empty-query enumeration is cheap for them but page deliberately.

## 3. QUANGO TRANCHE 2 — seed per the workbook tiers
Charlie confirmed T1 (seeded V23). T2 per the Corpus Status xls "Quango Universe" sheet = the next ~40 live arm's-length bodies by statutory weight, PLUS ministerial departments **restricted to statute-adjacent formats only** (`statutory_guidance`, `regulation`, `manual`, `manual_section`) to avoid policy/press noise. Seed via govuk-content, licence OGL, per-org slug tagging, URL-level dedup against existing corpora. Exclude (as V22): `utaac_decision`, `fatality_notice`. T3 (590 closed orgs) stays deferred. If a T2 org's measured count exceeds 5× its register estimate, pause that org and report rather than seeding blind.

## 4. EXEMPT-ORG PROBES (size before building — do NOT mass-build adapters)
The exempt orgs (regulators on their own domains — e.g. Ofgem, Ofcom, Ofwat, ICO, Bank of England/PRA) are NOT in the 162k govuk relevant-count; each needs its own adapter, FCA-style. This sprint **sizes**, it does not mass-build:
1. Identify the top ~5 exempt orgs by likely legal-content weight (statutory guidance, decisions, enforcement notices).
2. For each, one probe: is there a bulk download or API (bulk → HTML → API priority), what's the universe size, what licence? Output `docs/EXEMPT_ORGS_PROBE.md` (org | route | est. size | licence | adapter effort).
3. Build + auto-upgrade ONLY the cleanest one or two (clear licence, clean route, < 1GB). The rest become a ranked V28 build list for Charlie to prioritise. Report sizes before committing to the long tail.

## 5. SCOTTISH PARLIAMENT OFFICIAL REPORT — still gated on a separate capture
~320k, parliament.scot (SpOpenData), distinct from the courts API in §2. Build the seeder to the point of needing Charlie's XHR capture (same devtools technique, on the Scottish Parliament OR search), produce a dry-run, seed nothing. Note in the report that it waits on Charlie's capture.

## 6. VERIFICATION & DOCS
Per-source scorecards with predictions; ✓-or-classified; licence-map additions (Scottish courts OGL, quango T2 OGL, any exempt-org licences); breaker-fix verified with a deliberate trip+recover; EXEMPT_ORGS_PROBE.md delivered; CHANGE_LOG + handoff + playbook; emit the per-corpus table for the workbook.

## 7. CHARLIE'S PARALLEL ACTIONS
Scottish Parliament OR XHR capture (unblocks §5); Railway Hobby downgrade 28 Jun; soak-watch to ~25 Jun then the §6 DROP go (separate, gated on the search thread's new FTS + Lex-grounding repoint); FCL application follow-up; the search-thread FTS-scope decision.

## 8. OUT OF SCOPE
The §6 DROP + Railway decommission (gated); quango T3; inquiry evidence bundles; financial corpus; SSRN (parked); search/enrichment build (search thread); US spec (after the soak + DROP close the UK structural chapter).

## 9. GIT
No git mid-sprint; single commit-all.sh; preview approval; Main.
