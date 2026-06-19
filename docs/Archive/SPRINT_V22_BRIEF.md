# SPRINT V22 — REPAIRS, THE SECOND HANSARD CENTURY, WORD COUNTS, QUANGO TRANCHE 1
**Written:** 12 Jun 2026, by CCh. Repo `Main`, HEAD `c93ca7c`. Read handoff carry-overs + playbook §1d (honest denominator) + politeness budget.

## AUTONOMY
Run this sprint end-to-end without pausing for approval. Every decision in this brief is pre-made; implementation choices within its scope are yours. If something genuinely needs rethinking: fix it autonomously if it's reversible and in-scope; otherwise complete everything else and put the issue — with your recommendation — in the final report. Do not stop to ask. The only hard stops: no git until commit-all.sh, no spend commitments beyond the brief's seeds, no destructive operations on production data outside the brief's scope.

## 1. REPAIRS (first — 58k+ rows are parked behind two breakers)
1. **committees-api breaker**: tripped on `list WrittenEvidence skip=103500: fetch failed` — a deep-pagination failure, not Cloudflare. Diagnose (offset cap on the API? timeout at depth?) and re-strategise the listing (date-windowed or per-committee paging instead of one giant offset walk). Clear the breaker once the new walk is verified; resume the 57,713 blocked + 10,120 blocked evidence rows.
2. **judiciaryni breaker** + 332 failed rows: classify the fetch failures (rate? URL pattern? transient?), fix, clear, resume the NI listing from its checkpoint.
3. Reset the throttled enum rows after cooloff (regional 61, ukpga 27) and drain the si-2010plus 17-row tail.
4. As retained-eu, EN/EMs, historic-hansard, tax-tribunals and NAO drain: ✓ re-baseline each per playbook rules.

## 2. HUDOC REVIVAL
Implement the live routes the V20 probe found (`/app/query/results` + `conversion/pdf`, browser UA + Referer headers). Probe one judgment end-to-end (licence: ECHR/HUDOC terms — record in the licence map), then auto-upgrade against the re-measured ✓4,471 universe.

## 3. LORDS HANSARD 1919–1999 (named V21 hole; client ready)
Lift the S5L volume cap, set the per-house cutoff (Lords bulk runs to 2004 but pwdata-lords starts 1999 — cut at the pwdata boundary exactly as done for the Commons), pilot one volume with the predict-measure-commit pattern, seed. The parliamentary record then has no known gap 1803 → present in either House.

## 4. HANSARD GAP-FILL (169 missing volumes)
Targeted HTML crawl of api.parliament.uk/historic-hansard for ONLY the 169 volumes absent from the bulk archive (verified genuinely missing in V21). Same per-speech shape, same OPL licence, polite rate; ✓ re-baseline historic-hansard when done.

## 5. WORD COUNTS (Charlie-requested)
1. Add `word_count` to `corpus_sections`, computed at ingest from compiled text.
2. Backfill script: R2 listing walk summing compiled-text bytes per corpus (÷ ~6.2 bytes/word for the estimate where exact recount is too slow; exact count for new ingests). Run it; report total words and per-corpus words in the final report and add the figures to the email's TOTAL block (one line: "≈ N words").

## 6. QUANGO TRANCHE 1 — gated on Charlie's tier confirmation
The Corpus Status xls "Quango Universe" sheet proposes tiers (T1 = top 20 live arm's-length bodies by statutory weight, HMRC excluded as already ingested; T2 = next 40 + ministerial departments restricted to statutory_guidance/regulation/manual formats; T3 = closed orgs, deferred).
- **If Charlie has confirmed tiers in the session prompt:** seed T1 via govuk-content (per-org, per-format), licence = OGL, breakers armed, auto-upgrade per probe doctrine. Dedupe rule: skip any document already present from another corpus (URL-level dedup).
- **If not confirmed:** build the tranche seeder + produce dry-run counts per T1 org; seed nothing.
Borderline formats from V21 finding 4 (utaac_decision, fatality_notice): EXCLUDE both — UTAAC decisions likely overlap FCL tribunal feeds (verify and note), fatality notices are not legal corpus.

## 7. CHARLIE'S PARALLEL ACTIONS (not CC work)
- Confirm/amend quango tiers on the xls sheet.
- FCL computational-analysis licence application (drafting with CCh; senior responsible person = Charlie).
- FCA Handbook licence read; Scottish-courts devtools XHR capture (10 min: open scotcourts search in Chrome → F12 → Network → run a search → copy the XHR request URL + headers → paste to CC next session).

## 8. VERIFICATION & DOCS
Per-task scorecards with predictions; no completed corpus on `~`; licence map updated (HUDOC, quangos); playbook gains the deep-pagination failure pattern; CHANGE_LOG + handoff. Email TOTAL block gains the words line.

## 9. OUT OF SCOPE
Quango T2/T3 and exempt-org adapters (V23 after T1 lands); corpus unification + Railway-DB migration (the next structural sprint — flag readiness in the report); college-of-policing (licence first); search/enrichment work (search thread).

## 10. GIT
No git mid-sprint; single commit-all.sh; preview approval; Main.
