# SPRINT V25 — FEED THE MACHINE (newly-unblocked sources)
**Written:** 16 Jun 2026, by CCh. Repo `Main` (HEAD = V24 close).
**Numbering note:** the structural unification brief previously labelled V25 is now **V26** — it waits on the search-thread FTS-scope decision and the two production gates. THIS sprint is pure ingest, no production-DB risk, runnable now while that homework completes.

## AUTONOMY
Run this sprint end-to-end without pausing for approval. Every decision here is pre-made; implementation choices within scope are yours. If something needs rethinking: fix it if reversible and in-scope; otherwise complete everything else and put the issue with a recommendation in the final report. No git until commit-all.sh; no spend beyond these seeds; no destructive ops.

## 0. WHY
Ingestion has run dry (queue empty, +0 sections since ~14 Jun). Several sources are now newly reachable; seed them to keep the machine productive. All are additive `corpus_sections` work — zero structural risk.

## 1. CARRY-OVER (first)
1. Apply the agreed divergence-check fix: base the email's divergence warning on `produced_output`, not compiled-section delta (stops false wolf-cries on marker-heavy hours).
2. Rebaseline the corpora that finished draining since V24 → ✓: committees-reports, committees-evidence, niassembly-hansard, inquiry-reports.
3. Regenerate CORPUS_STATUS CSV with the TOTAL row dropped (or labelled) so the workbook import can't double-count.

## 2. SENEDD COFNOD — licence confirmed, seed (~200k)
Charlie verified the licence: Senedd content is Crown Copyright, reproducible under the **Open Government Licence** with source acknowledgement and non-misleading context (senedd.wales/commission/access-to-information/copyright/). Set `licence='ogl-3.0'`, attribution string per Senedd's terms. Build/seed the Cofnod (Record of Proceedings) from record.senedd.wales via the route sized in V23; per-speech shape consistent with pwdata/historic-hansard/niassembly. Pilot one session predict-measure-commit, then seed.

## 3. COLLEGE OF POLICING — 2022 web-archive, seed (~8k)
Charlie's decision: take the 2022 UK Government Web Archive snapshots for now (live site CF-blocked; fresher snapshots are JS shells). Licence verified V24 = **Non-Commercial College Licence** → set `licence='college-nc'` and ensure this corpus is flagged for **commercial-surface exclusion** (same default-exclude treatment as OECD BY-NC; link-only on any future commercial deployment). Seed Authorised Professional Practice from the archived snapshots; note snapshot date in metadata so staleness is visible; clear the breaker.

## 4. BILLS API — seed (~5k)
bills.parliament.uk / Bills API: bill texts, versions, amendments, explanatory notes. OGL/Open Parliament Licence — verify and record. This is mission-critical "intention" material (what was proposed, how it changed). Seed at P2.

## 5. PUBLIC INQUIRIES — expand to the full register (reports-only)
V24 seeded 8 concluded inquiries (53 PDFs). Extend to the full concluded-inquiry register in INQUIRIES_UNIVERSE.md via the Web Archive route, **reports only** (evidence bundles remain deferred — huge, mixed-licence). Licence per inquiry (most Crown/OGL — verify). Re-baseline the inquiry denominator from what's seeded.

## 6. SCOTTISH (build-ready, seed gated on Charlie's XHR capture)
Scottish Parliament Official Report (~320k) and Scottish Courts (~20k) remain blocked on the auth key in the site's XHR calls. If Charlie has supplied the captured request URL + headers in the session prompt: build the seeder and seed. If not: build the seeder to the point of needing the key, produce a dry-run, seed nothing, and note it waits on the capture. Do NOT attempt to brute-force or guess the key.

## 7. CASE-LAW LICENCE COMPLIANCE (record now, enforce at serving)
Create `docs/LICENCE_COMPLIANCE.md` capturing the Find Case Law commitments made in Charlie's licence application as **hard build requirements** for when case law is served: (a) judgment text auth-only, no public URL; (b) `noindex` / robots / no crawlable route; (c) no open or third-party API exposing judgment text or extracted data; (d) no open-web publication of citation/entity/statistical extracts drawn from judgments. Flag to the search thread as serving-layer constraints. Not built this sprint — recorded so they can't be forgotten when serving is built.

## 8. VERIFICATION & DOCS
Per-source scorecards with predictions; ✓-or-classified rule; licence map additions (Senedd OGL, College NC, Bills, inquiries); LICENCE_COMPLIANCE.md delivered; CHANGE_LOG + handoff + playbook; emit the corrected per-corpus table (corpus | sections | words | R2 | Neon) for the workbook.

## 9. OUT OF SCOPE
Structural unification + Railway decommission (V26, gated on FTS decision + cutover gates); quango T2/T3 + exempt-org adapters (later); inquiry evidence bundles; SSRN (parked); search/enrichment build (search thread); US spec.

## 10. GIT
No git mid-sprint; single commit-all.sh; preview approval; Main.
