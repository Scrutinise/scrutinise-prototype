# SPRINT V24 — REBASELINE, BREAKER FIX, DEVOLVED RECORDS, INQUIRY PROBE, UNIFICATION READINESS
**Written:** 13 Jun 2026, by CCh. Repo `Main` (HEAD = V23 close). Read handoff carry-overs, playbook §1d, politeness budget, licence map.

## AUTONOMY
Run this sprint end-to-end without pausing for approval. Every decision in this brief is pre-made; implementation choices within its scope are yours. If something genuinely needs rethinking: fix it autonomously if it's reversible and in-scope; otherwise complete everything else and put the issue — with your recommendation — in the final report. Do not stop to ask. The only hard stops: no git until commit-all.sh, no spend commitments beyond the brief's seeds, no destructive operations on production data outside the brief's scope.

## 0. SEQUENCING NOTE
§1 must run only AFTER the listed corpora have finished draining (a corpus still ingesting must not be stamped ✓). Everything else is independent. Work §1→§7; if a drain hasn't finished when you reach §1, do the rest first and rebaseline whatever has settled, listing the still-draining ones in the report.

## 1. REBASELINE THE SETTLED CORPORA
Run `v23-rebaseline.ts --confirm` for each corpus that has fully drained (retained-eu, si-2010plus, committees-reports, committees-evidence, explanatory-notes, explanatory-memoranda, ni-judgments, historic-hansard, quangos-govuk T1). Replace each estimated denominator with the exact measured count, stamp ✓. Report the before/after for each.

## 2. ZERO-OUTPUT BREAKER FIX (CC's own V23 recommendation — approved)
The zero-output breaker currently infers emptiness from aggregate section-count growth, so it false-trips when already-complete rows are reseeded (no growth ≠ no output) — it parked 108,349 legitimate rows in V23. Fix: track genuinely-empty done-rows **at the worker** (a row completing with zero sections written *by that row*), not by inferring from corpus-level aggregate deltas. Re-verify the committees and tna-legislation paths don't false-trip on idempotent reseeds. Playbook pattern updated.

## 3. EMAIL: RETIRE THE >100% PERCENTAGE (Charlie-directed)
The headline crossed 100% because exact numerators run against stale estimated denominators. Replace the single percentage with: (a) two hard numbers — sections ingested and words (both exact) — and (b) a completion table: ✓-confirmed corpora at 100%, in-progress as ingested/measured, unstarted/unsized listed openly. A labelled estimate of the eventual total may sit alongside ("~N est. when open corpora land") but NEVER as a percentage that can exceed 100. Keep the unenumerated-sources list.

## 4. DEVOLVED PARLIAMENT RECORDS — seed the build-ready ones
1. **NI Assembly Hansard** — V23 confirmed build-ready (646 reports, ~250–300k sections) via the AIMS/data.niassembly.gov.uk API. Verify licence (expected OGL-equivalent — record it), pilot one session predict-measure-commit, seed.
2. **Scottish Parliament Official Report** and **Senedd Cofnod** — seed IF the licence is verified AND the access route is confirmed. The Scottish route needs Charlie's devtools XHR capture (§7); if not yet supplied, build the seeder and produce a dry-run, seed nothing. Senedd's record.senedd.wales archive was sized in V23 — proceed if route + licence confirm.

## 4b. COLLEGE OF POLICING — via the Government Web Archive (Charlie-flagged route)
The live site is Cloudflare-blocked, but the UK Government Web Archive (webarchive.nationalarchives.gov.uk) holds college.police.uk snapshots on CF-free TNA infrastructure.
1. Fetch the College's terms/licence page from the web archive — verify the APP licence (expected OGL). This resolves the "licence unverified" half in one fetch.
2. If clean, seed Authorised Professional Practice from the archived snapshots (check snapshot freshness; note staleness if any). Clear the breaker. If snapshots are too stale, report and recommend a direct permission email (fallback).

## 5. PUBLIC INQUIRIES — first real seed
V23 built INQUIRIES_UNIVERSE.md and verified the Infected Blood route (Web Archive, 9 PDFs). Seed reports-only for 3–5 concluded major inquiries (Infected Blood, Grenfell, Post Office Horizon, + 2 from the register) via the Web Archive route. Licence per inquiry (most Crown/OGL — verify). Evidence bundles remain deferred (huge, mixed-licence). Re-baseline the inquiry register denominator from what's seeded.

## 6. UNIFICATION READINESS ASSESSMENT (report only — no migration this sprint)
Produce `scrutinise-docs/UNIFICATION_PLAN.md`: (a) inventory the 914,274 legacy `LegislationSection` rows on Railway Postgres — schema, what they represent, overlap with `corpus_sections`; (b) the conversion plan to fold them into `corpus_sections` (format mapping, R2 backfill if text isn't already there, dedup); (c) the web-app table inventory and the plan to move app tables Railway→Neon (pooled endpoint); (d) predicted downtime and rollback. This is the spec for the next sprint; build nothing yet.

## 7. CHARLIE'S PARALLEL ACTIONS
FCL licence application — submit to caselawlicence@nationalarchives.gov.uk (insert prepared). Scottish devtools XHR capture (unblocks scottish-courts + Scottish Parliament). FCA Handbook licence read. BAILII email + donation.

## 8. VERIFICATION & DOCS
Per-task scorecards with predictions; no settled corpus left on `~`; licence map additions (NI Assembly, Senedd, College APP, inquiries); breaker-fix verified against idempotent reseed; email format changed; UNIFICATION_PLAN.md delivered; CHANGE_LOG + handoff + playbook. **Emit the per-corpus table — corpus | sections | words | R2 bytes | Neon bytes — in the final report for the Corpus Status xls** (CCh updates the workbook from it).

## 9. OUT OF SCOPE
The unification/migration build itself (next sprint, off UNIFICATION_PLAN.md); quango T2/T3 + exempt-org adapters (V25); inquiry evidence bundles; SSRN (parked); search/enrichment (search thread); the US spec (after unification).

## 10. GIT
No git mid-sprint; single commit-all.sh; preview approval; Main.
