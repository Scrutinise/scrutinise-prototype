# SPRINT V30 — UK DEPTH COMPLETION · REPORT & SCORECARDS

*CC, 24 Jun 2026. Build-only sprint (no git until `commit-all.sh`; new sourceTypes seed POST-PUSH). `tsc --noEmit` clean. Corpus baseline at open: 16,785,723 sections / 5.84B words / Neon 14 GB (3.5 GB headroom to the 17.5 GB flag — V30 adds well under 1 GB of metadata).*

---

## CATEGORY-COMPLETENESS SUMMARY (read this first)

| # | Item | Status | Detail |
|---|---|---|---|
| §1.1 | **CMA / OIM / SAU cases** | **BUILT-POST-PUSH** | `cma-cases`, OGL v3.0 verified. 2,562 cases → **~12,511 sections** (measured). Pilot ✓. |
| §1.2 | **Competition Appeal Tribunal** | **PROBED-V31 (email-gate)** | Route clean (~1,100 judgments) but licence **NOT open** (CAT/Competition Service own copyright, private-study-only). Not in Find Case Law. Email the Competition Service. |
| §1.3 | **FCA enforcement / final notices** | **PROBED-V31 (email-gate)** | Route exists; FCA **own copyright** (OGL only for expressly-stated statistical outputs). Email-gate with BoE/PRA. |
| §2 | **Independent-reviews own-domain tail (Cass)** | **BUILT — PDF-route-blocked** | Adapter + registry + seeder built; the flagship microsites (Cass, Children's Social Care, IMMDS) are SPA shells with **0 archive-enumerable PDFs**. Listed for Charlie. |
| §3 | **Inquiry & review evidence** | **PILOTED-SEQUENCED** | Pipeline + §0 exclusion built + unit-tested. Post Office Horizon piloted (OGL v3.0, ~19,605 items). Infected Blood + Grenfell probed + sequenced. `SENSITIVE_EVIDENCE_POLICY.md` written. |
| §4 | **Pre-2016 Scottish OR (1999–2016)** | **BUILT-POST-PUSH** | `scottish-parliament-or` (same corpus) extended back via the Wayback archive. 2,322 reports, old-format parser ✓. Pilot ✓ (avg 157 turns / 22k words per content report). |

**Net new built this sprint:** 2 new sourceTypes (`cma-cases`, `inquiry-evidence`) + 1 corpus extension (`scottish-parliament-or` pre-2016) + 1 corpus extension (`independent-reviews` own-domain, blocked). **After V30, what remains under "UK" is only email-gated bodies (CAT, FCA, BoE/PRA, the ombudsmen) and capture-gated briefings — not build work.**

⚠️ **Carried-forward catch (verify-before-asserting):** `scottish-parliament-or` has **0 sections / 0 queue rows** on Neon — the V28 sessions-5–6 build (`v28-seed-scottish-parliament-or.ts --seed`) was coded+piloted but **its seed was never run**. The POST-PUSH order below seeds BOTH the 2016+ (V28) and the pre-2016 (V30) sets.

---

## PER-SOURCE SCORECARDS

### §1.1 CMA / OIM / SAU cases — `cma-cases` (BUILT, OGL v3.0 ✓)
- **Route:** gov.uk `cma_case` finder. Enumerate `api/search.json?filter_content_store_document_type=cma_case` (2,562, paged). Per case `api/content/cma-cases/{slug}`: `details.body` (overview HTML) + `details.attachments` PDFs on assets.publishing.service.gov.uk.
- **Granularity:** one OVERVIEW section/case + one section/decision-PDF (per-PDF budget — merger cases carry ~30 PDFs).
- **Measured (60-case sample):** avg 3.9 PDFs/case → **prediction 2,562 overview + ~9,949 PDF = ~12,511 sections**.
- **Pilot:** body 925 w + lead PDF 5,199 w extracted ✓. **Dedup:** no `/cma-cases/` pages in `quangos-govuk` (verified) — fully additive.
- **Licence:** OGL v3.0 — CMA is a non-ministerial dept (Crown copyright); gov.uk terms + assets PDFs.

### §1.2 Competition Appeal Tribunal — `cat-judgments` (PROBED, NOT BUILT)
- **Route (clean):** catribunal.org.uk `/judgments` (paged `?page=N`, ~20/page, **~1,100 judgments** 50–69 pages); PDFs at `/sites/cat/files/`.
- **Licence (BLOCKER):** `/copyright-notice` — "copyright … held by the Competition Appeal Tribunal and/or the Competition Service"; material "may be freely downloaded … for **private reference, research and study**"; "**application for any other proposed use … should be made to**" the Information Centre. **Not an open licence** (no redistribution / computational grant).
- **No FCL fallback:** CAT is **not** a Find Case Law court (no `cat`/`ukcat` court code; free-text search returns no CAT judgments). So the OJL `tna-caselaw` route does not cover it.
- **Recommendation:** **V31 email** — re-use / computational-analysis licence from the Competition Service Information Centre (info@catribunal.org.uk). High value: the financial/competition *court* layer.

### §1.3 FCA enforcement / final notices — `fca-enforcement` (PROBED, NOT BUILT)
- **Route:** fca.org.uk final/decision notices + enforcement register (faceted search-results endpoint).
- **Licence (BLOCKER):** fca.org.uk/legal (verified) — Handbook "apply for a licence agreement"; OGL applies only to "**some statistical outputs … where the UKOGL is expressly stated**". Final/decision notices are **not** expressly OGL → FCA own copyright. Same posture as `fca-handbook` (`fca-restricted`).
- **Recommendation:** **V31 email** alongside BoE/PRA (FCA + BoE jointly publish some stats under OGL — a re-use request may unlock the notices).

### §2 Own-domain reviews — `independent-reviews` extension (BUILT, route-blocked)
- **Route reality:** the flagship modern reviews (Cass, Children's Social Care/MacAlister, IMMDS/Cumberlege) are **JS-SPA microsites**. Live sites gone; Cass survives only in **UKGWA (no public CDX)**; the Internet Archive holds **0 PDF captures** for these hosts (PDFs sat on client-side-loaded CDN paths). The College-of-Policing SPA-shell blocker.
- **Built:** `sources/own-domain-reviews.ts` (Wayback-CDX PDF enumerator + pinned-PDF support) + curated registry + seeder. Any review with archive-findable or pinned PDFs ingests into `independent-reviews` via the deployed per-PDF processor (no new code).
- **Measured:** 0/3 flagship reviews archive-enumerable. **Listed for Charlie** (recommend: direct report-PDF capture from a browser, or an NHS/gov.uk mirror, then pin into the registry).

### §3 Inquiry evidence — `inquiry-evidence` (PILOTED-SEQUENCED, §0-governed)
- **Pipeline:** `sources/inquiry-evidence.ts` (per-inquiry adapters) + `processInquiryEvidence` (per-document rows, detail page resolves the live `/file` token + §0 metadata, then PDF→text; parentDocId = inquiry). New corpus `inquiry-evidence`.
- **§0 exclusion:** `classifyEvidence` — structural keep/exclude/flag on evidence-type / witness-category / restriction markers; enforced at ingest (excluded → `sensitive-excluded` marker, never text). **6/6 unit assertions pass.** `SENSITIVE_EVIDENCE_POLICY.md` written.
- **Pilot — Post Office Horizon** (OGL v3.0 ✓, sensitivity low): **~19,605 published evidence items** (1,307 pages). §0 sample 12/12 keep (all institutional — POL/FUJ/UKGI/WBON); 2 PDFs extracted (933 w, 1,505 w) ✓.
- **Sequenced (probed, not built):** Infected Blood (`/evidence` + `/hearings` 200; **high** sensitivity → §0 excludes individual medical/claimant testimony, keeps expert/clinician/government evidence + public-hearing transcripts) and Grenfell (`/evidence` + `/hearings` 200; high sensitivity). Recommended seed sequence: **Post Office Horizon → Infected Blood (kept-only) → Grenfell** — measure each before the next; do not blanket-seed.
- **Flagged "not cleanly separable":** none surfaced in the Post Office sample (low-sensitivity, well-structured library). Expect flags in Infected Blood (unlabelled individual statements) — those land as `sensitive-flagged` markers for Charlie's per-bundle call.

### §4 Pre-2016 Scottish OR — `scottish-parliament-or` extension (BUILT, SPCB ✓)
- **Route:** legacy `report.aspx?r={id}&mode=html` (retired in the 2021 redesign) via the **Internet Archive Wayback** (`web/{ts}id_/{url}`). Membership = any capture before 2016-05 (sessions 1–4); fetch = multi-capture fallback preferring the `or_speaker`-era rendering. **2,322 distinct pre-2016 reports** (r 3…10,442).
- **Old-format parser:** `<li>` + `or_speaker` speaker turns; sitting date = most-frequent "DD Month YYYY" in content (the `DC.date` meta is a constant template value — verified, do not use).
- **Pilot:** content reports rich (r=10110 → 298 turns; r=6031 → 164 turns / 43.9k w; r=9616 → 91 turns). Sparse/non-debate reports classify as honest `archive-miss` markers (breaker-safe). Re-baseline ✓ at drain.
- **Licence:** SPCB (same corpus, same code) — extends coverage to 1999.

---

## POST-PUSH RUN ORDER (after `commit-all.sh` deploys the new dispatch cases)
1. `seed-rate-limits.ts` (adds `cma-cases`, `inquiry-evidence`).
2. Confirm the Ingest deploy is **SUCCESS** (Railway deployments API; newest commit hash) before seeding any new sourceType (V24 markSkip rule).
3. `v30-seed-cma-cases.ts --seed` (gov.uk + assets-PDF egress is known-good; ~2,562 case fetches at seed).
4. **`v28-seed-scottish-parliament-or.ts --seed`** (the never-run 2016+ seed) **then** `v30-seed-scottish-or-pre2016.ts --seed` (1999–2016).
5. `v30-seed-inquiry-evidence.ts --seed` (Post Office Horizon; optionally `--max-pages N` to tranche). Charity host — watch the rate.
6. (If/when own-domain review PDFs are pinned) `v30-seed-own-domain-reviews.ts --seed`.
7. At drain: re-baseline (`*-corpus-status-table`), `v20-licence-backfill.ts` (confirm `cat-restricted`/`fca-restricted` NOT applied — those corpora aren't built; confirm `cma-cases`/`inquiry-evidence` OGL applied).

## DECISIONS WAITING ON CHARLIE (V30 additions)
- **V31 emails:** Competition Appeal Tribunal (Competition Service) · FCA enforcement (with BoE/PRA).
- **Own-domain reviews:** direct PDF capture (or mirror URLs) for Cass / Children's Social Care / IMMDS to unblock §2.
- **Inquiry evidence sequence:** approve Post Office Horizon seed; approve Infected Blood (kept-only) + Grenfell as the next tranches.
- (Carried) the never-run `scottish-parliament-or` 2016+ seed is now folded into the order above.
