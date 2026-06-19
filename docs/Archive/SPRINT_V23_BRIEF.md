# SPRINT V23 — THE LAST EXPANSION RING: ORAL EVIDENCE, INQUIRIES, DEVOLVED RECORDS, QUANGO T1
**Written:** 13 Jun 2026, by CCh. Repo `Main` (HEAD = V22 close). Read handoff carry-overs, playbook §1d, politeness budget, licence map.

## AUTONOMY
Run this sprint end-to-end without pausing for approval. Every decision in this brief is pre-made; implementation choices within its scope are yours. If something genuinely needs rethinking: fix it autonomously if it's reversible and in-scope; otherwise complete everything else and put the issue — with your recommendation — in the final report. Do not stop to ask. The only hard stops: no git until commit-all.sh, no spend commitments beyond the brief's seeds, no destructive operations on production data outside the brief's scope.

## 0. PRIORITY ORDER
§1 closeout → §2 oral evidence → §3 quango T1 → §4 devolved records → §5 public inquiries scoping → §6 small probes. Probe-with-auto-upgrade doctrine applies throughout (16GB Neon guard; Neon is ~12GB post-V22, so flag in the report if projected total exceeds 16GB and proceed only for corpora individually < 1GB).

## 1. V22 CLOSEOUT
Whatever the V22 final report left open: S5L Lords walk completion + gap-fill seed verification, uksi throttle resets, ✓ re-baselines for historic-hansard, echr-hudoc, ni-judgments, committees as they drain. Words line confirmed in the email TOTAL block.

## 2. COMMITTEE ORAL EVIDENCE (Charlie's catch — verify, size, seed)
The V20–V22 committees enumeration walked the API's *WrittenEvidence* type. Verify whether **OralEvidence** (witness-session transcripts — select committees quizzing experts, both Houses) is a distinct publication type in the Committees API. If yes: size it ✓, probe one transcript end-to-end (these are the highest-density "what experts told Parliament" material in the corpus), seed as `committees-oral` under the standing auto-upgrade. If it's bundled inside an existing type, prove that with counts and document it. Either way the final report states definitively whether expert oral sessions are covered.

## 3. QUANGO TRANCHE 1 — CONFIRMED, seed it
Charlie has confirmed the T1 tier as proposed on the Corpus Status xls (top 20 live arm's-length bodies by statutory weight, HMRC excluded; utaac_decision and fatality_notice formats excluded; URL-level dedup against existing corpora). Seed via govuk-content, licence OGL, per-org sub-corpus tagging (org slug in metadata) so search can filter by regulator. Breakers armed per org-format where cheap, else per source.

## 4. DEVOLVED PARLIAMENT RECORDS (three probes, auto-upgrade each)
We hold devolved legislation but no devolved debate. Probe → size ✓ → pilot → seed:
1. **Scottish Parliament Official Report** (parliament.scot — check for API/bulk before HTML).
2. **Senedd Cofnod y Trafodion / Record of Proceedings** (record.senedd.wales has a structured archive — likely the easiest).
3. **NI Assembly Hansard** (aims.niassembly.gov.uk / data.niassembly.gov.uk — there is an official AIMS API; prefer it).
Per-speech shape consistent with pwdata/historic-hansard; licences: each body's own open licence — verify and record all three in the map.

## 5. PUBLIC INQUIRIES — scoping probe (new source family, mission-critical)
Statutory inquiries are not committees; each runs its own site (Covid, Grenfell, Post Office Horizon, Infected Blood, Manchester Arena, …), concluded ones preserved in the UK Government Web Archive.
1. Build the inquiry register: enumerate from gov.uk's inquiries list + the Web Archive's inquiry collection; output `docs/INQUIRIES_UNIVERSE.md` (inquiry | status | site | reports | transcripts/evidence | est. size | licence).
2. Probe ONE concluded inquiry end-to-end via the Web Archive route (CF-free, TNA-hosted) — reports first, transcripts second.
3. Seed reports-only for the probed inquiry if clean; the full family is V24 against the measured register. Inquiry *evidence* bundles (often huge, mixed-licence) are explicitly report-first, evidence-deferred.

## 6. SMALL PROBES (time permitting)
ONS statistical releases relevant to legislation outcomes (sizing only); OBR publications (small, OGL, seed if trivial); pre-2010s select-committee archive on parliament.uk (sizing probe only — depth gap named in the workbook).

## 7. CHARLIE'S PARALLEL ACTIONS
FCL licence application review with CCh before submission; Scottish-courts devtools XHR capture (still open — unblocks scottish-courts in V24); FCA Handbook licence read; BAILII email + donation (still open).

## 8. VERIFICATION & DOCS
Scorecards with predictions per probe; ✓-or-classified rule; licence map additions (OralEvidence/OPL, three devolved licences, inquiry licences, quango OGL); playbook gains the inquiries register method; email unenumerated list updated as probes size things. **Flag in the final report: readiness assessment for the unification + Railway-migration sprint** (legacy 914k conversion plan, web-app table inventory, predicted downtime) — it's next.

## 9. OUT OF SCOPE
Quango T2/T3 + exempt-org adapters (V24); inquiry full family (V24); college-of-policing (licence still unverified); SSRN (parked); search/enrichment (search thread).

## 10. GIT
No git mid-sprint; single commit-all.sh; preview approval; Main.
