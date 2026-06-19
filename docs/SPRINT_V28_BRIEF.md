# SPRINT V28 — SEARCH-RELAY SCHEMA, VOTING RECORDS, INQUIRY REGISTER, LIBRARY BRIEFINGS, SCOTTISH OR
**Written:** 19 Jun 2026, by CCh. Repo `Main` (HEAD = V27 close). Read handoff (V27 seeds draining; V26 soak → DROP ~25 Jun), playbook §breakers/§1c/§1d, politeness budget, licence map, and the **Search-thread relay** (three asks, §1 below).

## AUTONOMY
Run end-to-end without pausing. Decisions here are pre-made; reversible in-scope choices are yours. Anything needing a rethink: fix if reversible, else complete the rest and report with a recommendation. No git until commit-all.sh; no spend beyond these seeds; no destructive ops. New sourceTypes seed POST-PUSH (V24 lesson). Probe-with-auto-upgrade applies; Neon ~13GB, flag if any single corpus would push the total past 16GB.

## 0. PRIORITY ORDER
§1 (search relay — the title extraction races the DROP) → §2 Ops timeout sweep → §3 voting records → §4 inquiry report register → §5 library briefings → §6 independent-reviews scoping → §7 Scottish OR (gated). §1.3 is time-critical: it must complete before the V26 §6 DROP (~25 Jun) or the data is lost.

## 1. SEARCH-THREAD RELAY (schema/enrichment owned by the search thread; built here)
### 1.1 Split the `written-answers` aggregate rows
The `written-answers` corpus stores date-RANGE aggregates as single sections (audit found a 1.87 MB blob; ~128 rows >512 KB) — wrong retrieval unit. Re-ingest split to **one section per individual question-and-answer**, carrying question text + answering member + date as metadata. **Confirmed: `pwdata-wrans` (1.22M) is a DIFFERENT corpus, already per-answer — do NOT touch it.** Acceptance: max section size for `written-answers` well under 512 KB; section count rises toward one-per-answer. Also AUDIT inquiry-reports + any other whole-document corpora for the same oversized-blob problem and report which share it (split only where the document has natural sub-units; an inquiry report splits by chapter/heading, not by Q&A).

### 1.2 Add a `jurisdiction` column on `corpus_sections`
Per-section `jurisdiction`, populated corpus-level as the first approximation: `senedd-cofnod`→wales; `niassembly-hansard`/`ni-judgments`/`nilawcom`→ni; `scotlawcom`/`scottish-courts`/`scottish-parliament-or`→scotland; rest→uk-wide. Flag in the column comment that some UK-wide Acts have territorial-extent differences for later per-section refinement. Acceptance: column present + populated; search thread switches off its stopgap map.

### 1.3 ⏰ TIME-CRITICAL — carry `sectionTitle` + `itemDate` into legislation/caselaw BEFORE the DROP
`sectionTitle` (and `itemDate`) are NULL for ALL legislation & caselaw rows in `corpus_sections`, but exist in the legacy `LegislationSection` table — which the V26 §6 DROP deletes (~25 Jun). Section headings ("Power to enter premises") are high-signal for ranking. **Extract `sectionTitle`/`itemDate` from `LegislationSection` into the matching `corpus_sections` rows (join on the gid+section identity) NOW, before the legacy table is dropped.** This is a hard pre-DROP gate: the DROP cannot proceed until this lands and is verified. Acceptance: legislation/caselaw rows carry titles where the legacy table had them; search thread re-indexes to pick them up. Report coverage (% of rows that gained a title).

## 2. OPS FULL-TABLE-QUERY SWEEP (the V27 §1 root cause, generalised)
V27 fixed the breaker-eval timeout (17M-row GROUP BY → snapshot read). CC flagged `reseedExhaustedPwdata` hits the SAME class: `SELECT id FROM corpus_sections WHERE corpus='pwdata-debates'` pulls ~8.8M ids past the 60s client timeout, so pwdata auto-reseed of new TWFY files is currently failing. Fix it (keyset pagination or `NOT EXISTS`/anti-join, not a full id pull) AND **sweep `ops.ts` + the seeders for any other full-`corpus_sections`-scan on the 60s-timeout path** — list them in the report, fix the ones on a live cron path. Verify pwdata reseed works against the live table.

## 3. PER-MEMBER DIVISION VOTING RECORDS (Charlie-confirmed — high search value)
We hold division *results* (`lda-commonsdivisions` 5,553; `lda-lordsdivisions` 2,089) but NOT the per-member breakdown. Seed the individual "how each MP/peer voted in each division" data from the Commons Votes + Lords Votes APIs (`commonsvotes-api.parliament.uk`, `lordsvotes-api.parliament.uk`), Open Parliament Licence. Model: one record per division carrying the aye/no member lists (member id + name + party + vote), linked to the existing division where possible. Probe one division end-to-end (predict-measure-commit), verify the member lists resolve, then auto-upgrade. This pairs with Bills (bill text + amendments + who voted for them = the full legislative story). Decide section granularity to suit search (likely one section per division with structured member metadata, NOT one per member — confirm in the report).

## 4. PUBLIC INQUIRY REPORT REGISTER — complete it (Charlie-confirmed; evidence still deferred)
V23/V24 seeded 21 inquiries / 146 report PDFs. Complete the **concluded statutory-inquiry report register** (gov.uk inquiries list + UK Government Web Archive inquiry collection), reports-only, OGL/Crown per inquiry. Evidence bundles remain DEFERRED (huge, mixed-licence, sensitive personal data — their own later decision). Re-baseline the inquiry denominator from what's seeded. Report the full concluded-inquiry count vs what we now hold.

## 5. HOUSE OF COMMONS & LORDS LIBRARY RESEARCH BRIEFINGS (Charlie-flagged gap — high value)
The Commons Library research briefings (`commonslibrary.parliament.uk` + its briefing-papers API) are the neutral expert per-topic summaries MPs/researchers rely on — exactly the H1 persona's working material and the explanatory layer over the primary law. Add the Lords Library briefings too. Probe the briefing-papers API (universe size, licence — expect Open Parliament Licence), pilot one briefing end-to-end, auto-upgrade. Seed as `commons-library-briefings` / `lords-library-briefings`. This is likely higher-value than the exempt-org tail — prioritise it above §6.

## 6. INDEPENDENT REVIEWS — scoping probe only (Charlie-flagged new category)
Commissioned independent reviews/audits are NOT statutory inquiries and are a distinct, currently-uncaptured family: e.g. the Cass Review (NHS England-commissioned), Dame Louise Casey's 2025 National Audit on Group-Based CSE (and her earlier reviews), Francis, Laming, Taylor, etc. Scattered across commissioning bodies but many gov.uk-published under OGL. **Scope only this sprint:** build `INDEPENDENT_REVIEWS_UNIVERSE.md` (review | commissioning body | year | route | licence | est. size), probe one (Cass or Casey) end-to-end via gov.uk/Web Archive, seed only that one if clean. The family becomes a ranked V29 build list.

## 7. SCOTTISH PARLIAMENT OFFICIAL REPORT — HTML scrape (no capture needed)
V27 §5 confirmed no open JSON API; the OR is conventional server-rendered HTML. Build the seeder via the **date-indexed Official Report browse** at `parliament.scot/chamber-and-committees/official-report` (one report per sitting day, 1999→present): enumerate report URLs from the date/year index, fetch each report's HTML, parse per-contribution (per-speech shape consistent with historic-hansard/niassembly). Licence: Scottish Parliament Official Report reuse terms (verify — expect OGL/SPCB licence; record it). Probe one report, predict-measure-commit, auto-upgrade. ~320k est. (No Charlie capture required — supersedes the V27 §5 gated stub.)

## 8. EXEMPT-ORG LICENCE CHECKS (carry-over, low priority)
Ofgem/Ofwat/Ofcom/BoE from EXEMPT_ORGS_PROBE.md each assert own-org copyright. One licence-check each (is there an OGL statement or a reuse policy?); build only those that come back clean. Most likely outcome: report findings, build none, leave for V29. Below §5–§7 in priority.

## 9. VERIFICATION & DOCS
Per-source scorecards with predictions; ✓-or-classified; licence-map additions (voting OPL, library OPL, Scottish OR, any reviews); §1.3 coverage % reported; Ops sweep findings listed; CHANGE_LOG + handoff + playbook; emit the per-corpus table for the workbook. **Flag explicitly in the report whether §1.3 is complete so the DROP gate can clear.**

## 10. CHARLIE'S PARALLEL ACTIONS
V26 §6 DROP go (after soak ~25 Jun AND §1.3 title-extraction verified AND search-thread Lex-grounding repoint); Railway Hobby downgrade 28 Jun; search-thread FTS-scope decision; FCL application follow-up.

## 11. OUT OF SCOPE
Inquiry evidence bundles; the independent-reviews full family (V29); exempt-org builds without a clean licence; financial corpus; SSRN; the search FTS/embeddings build (search thread); US spec.

## 12. GIT
No git mid-sprint; single commit-all.sh; preview approval; Main.
