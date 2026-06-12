# SPRINT V21 — QUANGO ENUMERATOR + HISTORIC HANSARD + HONEST DENOMINATOR
**Written:** 12 Jun 2026, by CCh. **Time-boxed: ~2 hours of CC session.** Repo `Main`, HEAD `e1f9ba1`.
Everything already running on Railway continues untouched; this sprint only BUILDS and SEEDS new fronts.

## AUTONOMY
Run this sprint end-to-end without pausing for approval. Every decision in this brief is pre-made; implementation choices within its scope are yours. If something genuinely needs rethinking: fix it autonomously if it's reversible and in-scope; otherwise complete everything else and put the issue — with your recommendation — in the final report. Do not stop to ask. The only hard stops: no git until commit-all.sh, no spend commitments beyond the brief's seeds, no destructive operations on production data outside the brief's scope.

## 0. PRIORITY ORDER (work down the list; stop where the clock stops)
Tasks are ordered so a hard stop at any point leaves only finished work. Skip §4 entirely if §1–§3 consume the session.

## 1. QUANGO UNIVERSE ENUMERATOR (~45 min) — the V21 scoping input, generated not written
Build `scripts/ingest/enumerate-quangos.ts` (run by CC directly — read-only against public APIs, no production writes except a results table):
1. Pull the full organisations register from the gov.uk Organisations API (departments, agencies, NDPBs — all of them).
2. For each organisation, query the gov.uk Search API for document counts by relevant format (guidance, statutory_guidance, policy_paper, decision, regulation, etc.).
3. Output: `scrutinise-docs/QUANGO_UNIVERSE.md` — ranked table: organisation | body type | total docs | docs by format | on-gov.uk vs external-site flag. Plus a CSV alongside for the Corpus Status xls.
4. Sum the universe and write the total into `corpus_targets` as `quangos-govuk (~N, unenumerated-by-org)` so the denominator sees it (see §3).
This converts V21's planned "scoping document" from an opinion into a measurement. No seeding of quango content this sprint — the ranked table is the deliverable Charlie triages.

## 2. HISTORIC HANSARD 1803–1918 (~60 min) — the largest enumerated hole
The V20 sizing probe put it at ~1.1M sections. Neon is at 11GB/20GB; projected addition ≤ ~1GB — inside the 16GB guard, so the standing auto-upgrade applies.
1. Build the source client + seeder for Historic Hansard (api.parliament.uk/historic-hansard). Reuse the pwdata per-speech section model (heading/speaker/date/parent metadata, same supersession rules) so the parliamentary record is one continuous, consistently-shaped corpus 1803 → present.
2. Polite rate: start at half whatever feels reasonable — it is a Parliament-hosted static archive, but the politeness doctrine applies; document the chosen rate.
3. Probe one parliamentary session end-to-end (sections verified, licence = Open Parliament Licence confirmed), then seed the full universe at P3 and let Railway grind it unattended.
4. Licence field populated per V20 §2.

## 3. HONEST DENOMINATOR PASS (~15 min)
Charlie's challenge stands: ~11.98M still understates the universe. Insert explicit `~` placeholder rows into `corpus_targets` (and the email's unenumerated list) for every known-but-unenumerated source, with the best current estimate and its provenance: historic-hansard (~1.1M ✓ from §2 probe), quangos-govuk (from §1's measured total), scottish-courts (~ estimate from V20 probe notes), college-of-policing APP (~8k, blocked), HUDOC (~ estimate), committees-evidence growth (listing still expanding), bills-api (~ rough), financial-corpus (placeholder, unsized). Rule for the playbook: **a known source missing from the denominator is a lie of omission — placeholders with honest `~` beat absence.** Expect the headline % to drop; that is the point.

## 4. IF TIME REMAINS: SSRN classification probe (~15 min)
One fetch, name the failure mode (auth wall? API change? CF?), route or park with a recommendation in the report. The last unclassified blocker.

## 5. FINAL REPORT MUST INCLUDE
Per-task scorecard; new denominator and headline %; the QUANGO_UNIVERSE.md headline numbers (top 20 bodies by document weight); confirmation historic-hansard is seeded and grinding; any deferred issues with recommendations.

## 6. OUT OF SCOPE
Quango content seeding (V22, after Charlie triages the table); Scottish courts and college-of-policing unblocking (CF + licence questions pending); corpus unification + Railway migration; all search/enrichment work. The FCL computational-analysis licence and FCA Handbook licence flags are CHARLIE reading, not CC work.

## 7. GIT
No git mid-sprint; single commit-all.sh; preview approval; Main.
