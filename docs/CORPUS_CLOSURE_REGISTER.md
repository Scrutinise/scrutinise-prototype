# SCRUTINISE — CORPUS CLOSURE & LICENCE REGISTER
*Snapshot 20 Jun 2026. Purpose: clean closure on the current spec'd UK corpus — every item is either DONE, has a verified route + named blocker + owner, or is deferred by an explicit decision. Nothing in a blind spot.*

> **Authoritative source note:** the licence codes below are compiled from the sprint record and the in-repo `licence-map.ts`. The licence-map in code is the single source of truth; if you want a code-verified dump, have CC emit the current map. Treat anything marked **(verify)** as not yet confirmed at the source's own licence page.

---

## 1. LICENCE STATUS BY TIER

### Tier 1 — Open Government Licence v3.0 (Crown copyright; open, **commercial-safe** with attribution)
UK primary & secondary legislation (`primary-acts-2000plus`, `primary-acts-pre-2000`, `si-2010plus`, `si-pre-2010`, `regional`, `retained-eu`, `explanatory-notes`, `explanatory-memoranda`); `tna-caselaw` *(open to read; **bulk/computational** use gated on the FCL licence — see §3)*; `et-decisions`, `tax-tribunals`, `ni-judgments` (verify); HMRC (`hmrc-manuals`, `hmrc-codes-guidance`, `hmrc-tiins`, `hmrc-ancillary`), `tax-treaties-dta`, `uk-treaties`, `ots-reports`; `nao-reports`, `lawcom`, `scotlawcom`, `nilawcom`, `sentencing-council`; `govuk-core-docs`, `quangos-govuk`, `planning-policy`, `building-regs`; `inquiry-reports`, `independent-reviews`; `ico`, `scottish-courts`, `ofgem`, `cps-guidance`; `senedd-cofnod`.

### Tier 2 — Open Parliament Licence v3.0 (Parliamentary material; open, **commercial-safe** with attribution)
`pwdata-*` (debates, lords, lordswms, lordswrans, wms, wrans, westminster), `historic-hansard`, `lda-commonsoralquestions`, `lda-commonsdivisions`, `lda-lordsdivisions`, `bills-api`, `committees-reports`, `committees-evidence`, `division-votes` (commons + lords), `erskine-may`, `early-day-motions`, `petitions`, `members-interests`. **Pending capture:** `postnotes`, `commons-library-briefings`, `lords-library-briefings` (expected OPL — confirm on capture).

### Tier 3 — Devolved / bespoke open licences (**commercial-safe** with attribution, bespoke terms)
`scottish-parliament-or` — **Scottish Parliament Copyright Licence (SPCB)**, verified; *excludes party-political / advertising-endorsement use* (a serving-layer note). `niassembly-hansard` — NI Assembly copyright (verify exact terms).

### Tier 4 — Own-open / OGL-equivalent (**commercial-safe** with attribution; bespoke wording)
`ofcom` — Ofcom own re-use terms (verified). `lgsco` — LGSCO open re-use, OGL-equivalent (verified).

### Tier 5 — Non-commercial / restricted (**NOT commercial-safe — exclude from any commercial surface**)
`college-of-policing` — `college-nc` (non-commercial). `oecd` — CC-BY-NC pre-2024 (link-only, commercial-excluded). `fca-handbook` — FCA copyright (verify; treat as restricted until confirmed). `echr-hudoc` / `eur-lex` — Council of Europe / EU re-use terms (generally permissive with attribution; verify for commercial).

### Tier 6 — Gated on your action (see §2)
Library briefings + POSTnotes (capture); the six ombudsman/regulator bodies (email); FCL computational licence (submission); College of Policing post-2022 (their response).

### Tier 7 — Blocked / declined (will not ingest)
`ssrn` — licence-hostile (author copyright, no open licence). `bailii` — declined by BAILII; coverage replaced by FCL + `scottish-courts` + `ni-judgments`.

### ⚠️ COMMERCIAL-FORK CALLOUT
If/when a commercial arm launches, the load-bearing exclusions are **Tier 5** (`college-of-policing`, `oecd`, `fca-handbook` until verified) and the **FCL serving constraints** on `tna-caselaw` (judgment text auth-only / noindex / no open API or open-web republication of judgment-derived extracts). Everything in Tiers 1–4 is commercial-safe with attribution. Anything granted by the §2 emails will carry whatever terms the body sets — re-confirm those for commercial use specifically.

---

## 2. CLOSURE TRACKER — remaining items to clean closure

### A. Gated on capture (you — one devtools session)
| Item | Host | What to capture | Then |
|---|---|---|---|
| Commons Library briefings | commonslibrary.parliament.uk | `cf_clearance` cookie + User-Agent + the research-briefing CPT REST slug | CC seeds + drains |
| Lords Library briefings | lordslibrary.parliament.uk | same (per-host) | CC seeds + drains |
| POSTnotes | post.parliament.uk | same (separate host → separate cookie) | CC seeds + drains |

**Capture how-to (per host):** open the site in Chrome and let the "Just a moment…" challenge pass → F12 → **Application → Cookies** → copy the **`cf_clearance`** value → also copy your exact **User-Agent** (Console: `navigator.userAgent`). For the **CPT slug**: in the **Network** tab, filter `wp-json`, click into a briefing page, and find the request to `/wp-json/wp/v2/{slug}` (the `{slug}` is the research-briefing post type — e.g. `research-briefing` or similar). Give CC the three values per host. The shared PDF host `researchbriefings.files.parliament.uk` is covered by one of these captures. *Note: `cf_clearance` is short-lived (often ~30 min–hours), so capture and hand to CC in the same session.*

### B. Pending email (you — drafts in OUTREACH_EMAILS.md)
| Body | Volume | Current licence posture |
|---|---|---|
| Housing Ombudsman | ~165,000 decisions | Own copyright — **priority** (largest prize) |
| Financial Ombudsman Service | large (decisions since 2013) | Own copyright |
| Pensions Ombudsman | all determinations | Own copyright |
| Parliamentary & Health Service Ombudsman | reports/decisions | Own copyright |
| Ofwat | regulatory publications | © Ofwat |
| Bank of England / PRA | publications/regulatory | No clear open statement |
| Competition Appeal Tribunal (V30 §1.2) | ~1,100 judgments | CAT/Competition Service own copyright (private-study-only) — email Information Centre (info@catribunal.org.uk) for a re-use/computational licence |
| FCA enforcement / final notices (V30 §1.3) | final/decision notices + register | FCA own copyright (OGL only for expressly-stated stats) — email with BoE/PRA |

### C. Pending external response (chase only)
- **College of Policing** — post-2022 APP access. We hold the 2022 Web Archive snapshots (`college-nc`); awaiting their reply. *Action: chase email if gone quiet.*
- **Find Case Law computational-analysis licence** — *Action: submit the completed application (FCL_Licence_Application_Insert.docx) to caselawlicence@nationalarchives.gov.uk.* Coverage is already ~complete; the licence legitimises ongoing bulk use.

### D. Deferred by design (the deliberate tail — explicit decisions, not gaps)
**V30 (24 Jun 2026) pulled the four starred items below into scope — see `docs/SPRINT_V30_REPORT.md`.**
| Item | Status after V30 |
|---|---|
| ~~Inquiry evidence bundles~~ ★ | **PILOTED-SEQUENCED** — `inquiry-evidence` pipeline + §0 sensitive-exclusion (`SENSITIVE_EVIDENCE_POLICY.md`); Post Office Horizon piloted (OGL v3.0, ~19,605 items); Infected Blood + Grenfell sequenced. |
| ~~Pre-2016 Scottish OR (sessions 1–4)~~ ★ | **BUILT-POST-PUSH** — `scottish-parliament-or` extended to 1999 via the Internet Archive Wayback of the legacy `report.aspx` site (2,322 reports). |
| ~~Financial corpus~~ ★ | **DEFINED + partly built** — = CMA/OIM/SAU (built) + CAT (court layer, V31 email) + FCA enforcement (V31 email) + the already-email-gated BoE/PRA/Ofwat/FOS/Pensions. No longer an unscoped placeholder. |
| ~~Cass Review (own-domain)~~ ★ | **BUILT, PDF-ROUTE-BLOCKED** — adapter + registry ready; the SPA microsites expose 0 archive-enumerable PDFs. Listed for a direct-PDF capture/pin. |
| CMA (regulator) ★ | **BUILT** (`cma-cases`, OGL v3.0). ASA / court procedure rules: still a lower-priority probe if wanted. |

---

## 3. STATE OF "UK COMPLETE"
**Every category** of UK public legal, parliamentary, and quasi-judicial interpretation material available under a clean licence is now **acquired or has a verified route**. Clean closure = items A–C resolved (captures done, emails answered, FCL submitted, College replied). The Tier-7 blocked items and the §2D tail are deliberate, documented decisions — they do not reopen on their own. After A–C resolve, the UK corpus is closed and the next structural move is the US jurisdiction spec (held until search + Lex are working well).
