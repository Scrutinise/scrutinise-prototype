# BRIEF — SEARCH S11: MAKE THE CORPUS REACHABLE, AND MAKE THE INDEXES CURRENT

**For:** CC-Search
**Written:** 21 August 2026, by CCh-Search
**Executes:** `SEARCH_S10_REPORT.md` §1 (the `cps-guidance` finding) and Q3;
`INGEST_CASELAW_TEXT_REPORT.md` decisions 1, 2 and 5. **Charlie has approved the ~$31 re-embed and
the heavy-job reindex.**
**Format:** audit-then-build. No git during the sprint; one **`commit-search-s11.sh`** at the end.
Scoped commits by explicit path. `SEARCH_CONTRACT.md` updated in the same commit as any capability
change.

---

## §0 — WHY THIS SPRINT, AND WHY IT IS ONE SPRINT AND NOT THREE

Three findings landed on 20 August that look separate and are the same job:

1. **`cps-guidance` cannot be returned by any query, at any setting.** Not ranked low — excluded
   before retrieval, because it is display-typed as guidance but indexed under tier `other`, and the
   router can only select streams. **Eight further collections are in the same state**, roughly
   48,600 sections including `cma-cases` (22,898), `ofgem` (17,161) and `ofcom` (4,169). This is
   *reachability is not completeness* for the third time in this project, in a new disguise.
2. **The keyword index is stale after any backfill.** Case-law titles were recovered into the
   database on 19 August and no user ever saw one, because nothing refreshes `corpus_fts` when a
   row's *content* changes — `fts-catchup` only appends ids the index lacks. The case-law rows were
   refreshed by hand; **the general defect is unfixed and will recur on the next backfill.**
3. **74,896 case-law rows sit un-indexed**, brute-force scanned on every query alongside the index,
   and **12.7% of everything ever embedded for case law is stylesheet text** — chunk 0 is more than
   half CSS in 77% of documents.

All three are closed by the same two heavy jobs plus a tier decision. Doing them separately means
running the same expensive index build three times.

⚠ **`fts-serve` has already been redeployed** and is serving the corrected case-law bodies and
titles. Anything this sprint changes in the index requires **another** redeploy — it loads its table
once at boot. Name that in the report as the final step.

**Coordination:** the ingest thread's eight commits are being pushed; **confirm they are on the
server before starting**, because the heavy job builds from `Main`. If `origin/Main` is still at
`41dc13e`, stop and say so.

---

## §1 — THE TIER DECISION: AUDIT ALL NINE, DECIDE EXPLICITLY, REPORT BEFORE BUILDING

**Audit.** For every collection in the corpus, produce one table: display type · indexed tier ·
`streamCanSelect` true/false · section count · whether any query can return it in production with
the router on. **Read this off the index and the stream scopes, not off a manifest.** S10 found
`cps-guidance` by probing; the other eight are inferred from the same pattern and must be confirmed
the same way, one probe each.

⚠ **Expect the audit to find collections not on the list of nine.** The list came from a deferral
note, not from a sweep. A sweep is what this section is for.

**Decide, per collection, in the report:** which stream should own it, or that it should own none —
with one line of reasoning each. Two traps, both named because they are the tempting answers:

- ⚠ **Do not put everything in `guidance` to make the number go up.** A stream that owns nine
  unrelated collections retrieves worse for all of them, and S10 already measured the mechanism:
  turning `cps-guidance` on inside `guidance` cost consultations two answers, because
  `mergeLegs` divides a fixed budget. **Widening a stream is zero-sum inside that stream.**
- ⚠ **Do not create a new stream per collection.** Each routed stream costs a retrieval call
  against a service four requests wide (§4).

▶ **Report the audit and the proposed mapping before building.** If the right answer for some
collection is a sixth stream, that is a decision for Charlie with the latency cost stated.

---

## §2 — THE REINDEX, WHICH DOES FOUR THINGS AT ONCE

One `fts-index` heavy job on the rented large-memory box — **never the always-on serving host**
(standing rule; measured at 18.0–19.8 GB peak, ~9 minutes, about €0.05):

1. Re-tier the collections per §1's approved mapping.
2. Absorb the 74,896 un-indexed case-law rows. Precedent: 1,191,345 un-indexed of 17.7M took warm
   p50 from 4.5s to 25–32s; this is a sixteenth of that, so expect a small but real latency gain.
3. Carry the recovered case-law titles and corrected dates into the index — **verify these are
   present in the built index, not merely in the database.** The whole point of finding 2 is that
   those are different places.
4. ⚠ **Retire `LEX_GUIDANCE_CPS`.** Charlie set it true as a stopgap; once `cps-guidance` is
   correctly tiered the flag is redundant, and a redundant flag that still gates a code path is a
   trap for the next reader. Remove the flag and the branch in the same commit, and say so.

**Predict before running** (predict-measure-compare): expected index size, build time, and the
recall change per affected collection.

---

## §3 — THE CASE-LAW RE-EMBED (~$31, APPROVED)

Re-chunk and re-embed `tna-caselaw` from the corrected bodies. **Both halves or neither** — the
report is explicit that re-chunking without re-embedding is worse than doing nothing, because every
vector would then describe text no longer at that chunk index, and a match on one passage would
display another.

- Batch API for the embeddings; one `vector-index` heavy-job run on the rented box.
- **Record the actual spend against the $31 estimate.** The corpus embed was gated at ~$600 and came
  in at $430–520; estimates in this project run low and the record of that is useful.
- ⚠ **Verify by reading chunk 0 of 30 random documents** and confirming it is judgment text. A
  count of chunks written proves nothing about what is in them.

---

## §4 — CLOSE THE STALE-INDEX DEFECT PROPERLY

`refresh-fts-caselaw.ts` is the pattern; generalise it. Any backfill that rewrites a field the index
carries must be able to say *these ids changed, refresh them*.

- Build the general refresh path, and **add it to the ingest sprint checklist** so the next sprint
  that backfills a field cannot forget.
- ⚠ **The check that matters is the one that fails when someone forgets.** A refresh script nobody
  runs is not a fix. Propose a detection — for example, a periodic comparison of a sampled field
  between the database and the index, reported as drift — and say what it would cost. Report the
  proposal; build it only if it is cheap.

---

## §5 — TWO ITEMS RAISED BY OTHER THREADS, ANSWERED HERE

**§5.1 The `limit` fan-out** (`FINDING_FOR_SEARCH_gateway-limit-fanout.md`, from CC-Lex). A caller
asking for 10 results receives 150: the limit is handed to every stream, each over-fetches ×3 for
fusion, and the interleaved sum is returned. `grouped` is capped at 20, which is why nobody saw it —
every chat turn has been paying for roughly 300–500 rows it discards.

⚠ **Do not change the behaviour in this sprint.** A change here moves recall on every surface, and
the validated set still has no debates or legislation questions to measure it with. **Do** two
things:

1. **Make it self-describing:** add `meta.requested` alongside the existing `meta.perStream`, so the
   fan-out is visible in every result rather than discoverable six weeks later via a truncated sift.
2. **Document the actual semantics in `SEARCH_CONTRACT.md`** — the contract currently says "max
   canonical results before grouping" and the code does something else, and every caller was written
   against the documentation. State which it is, and note the pending decision.

**§5.2 Two template-literal findings in your files**, from the same note:
`lib/lex/stats-catalogue.ts:392` interpolates an `unknown` into a user-facing geography label — if
it is ever an object, a user reads `[object Object]`. Fix it. `lib/lex/query-router.ts:276` is a
cache key and benign; make the intent explicit with `String()` rather than suppressing the rule.

**§5.3 Recall the interleave finding and leave it standing.** S10 measured in-stream recall at 48%
against 34% merged — the interleave alone costs six of 44 questions. **Do not attempt to fix it
here.** It is the next big architectural question, it needs debates and legislation questions to
measure, and it should be its own sprint. Restate it in the report so it is not lost.

---

## §6 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-search-s11.sh`; nothing owned by ingest, graph or lex
  edited — report needed changes instead.
- Every check watched failing first. Predictions logged before the heavy jobs run.
- Bytes before hypotheses: probe the built index, read chunk 0, read rendered results.
- **Report `docs/SEARCH_S11_REPORT.md`:** the reachability audit first, as a whole-corpus table —
  this is the sprint's most valuable artefact and the first time anyone will have seen it. Then the
  mapping decisions with reasoning. Then before/after recall per affected collection on the
  validated set, with n stated. Then the re-embed with actual spend. Then what is NOT done, named.
- ▶ End with the two things only Charlie can do: **redeploy `fts-serve` again** after the reindex,
  and any flag change, with the expected observable signal for each — a counter moving, never an
  absence of errors.
- Change-log, contract and handoff entries labelled **SEARCH**.
