# BRIEF — SEARCH S9: THE STATISTICS CATALOGUE

**For:** CC-Search
**Written:** 19 August 2026, by CCh-Search
**Executes:** `SEARCH_STRATEGY_v5.md` §6d and §3.1 (statistics row), §12 Block 2
**Format:** audit-then-build. No git during the sprint. **One `commit-search-s9.sh` at the end** —
new standing rule: commit scripts are named per stream and per sprint, because two sessions sharing
`commit-all.sh` raced during S8 and one deleted the other's script mid-use. Scoped commits by
explicit path. `SEARCH_CONTRACT.md` updated **in the same commit** as any change to what search can
do.

---

## §0 — WHERE WE ARE

S8 finished the first-pass retrieval stack: the two deepening jobs are wired and live, attribution
ships where the data holds it, the framing experiment gives a real null (−1.1pp at headroom 22/31),
concurrency stays at 3 (raising it to 4 queues against vector-serve's own width), and the model
registry now checks that a provider **echoes back the model id we asked for** — xAI was silently
substituting a different model behind a 200.

Running in parallel: **CC-Ingest** is recovering case-law titles and committee speaker names (both
are ingest gaps S8 exposed). **CC-Graph** is building the position graph's factual layer (GRAPH 3A).
Neither should be touched from here.

This sprint: **the statistics catalogue** — the last unbuilt stream in the first-pass architecture
— plus a small first task that unblocks Charlie.

---

## §1 — FIRST TASK, DELIVER BEFORE ANYTHING ELSE

Charlie's validation session on `docs/GOLD_CANDIDATES_S8.md` is gated on the case-law questions,
whose keys cannot be verified because case-law rows have no title. **CC-Ingest is writing a
first-paragraph extract into those ten entries** as its own first task.

Your part: make the document reviewable in one pass. Restructure `GOLD_CANDIDATES_S8.md` so each
question is a **numbered block Charlie can accept, reject or amend in one line**, carrying: the
question as a user would phrase it, the answer key, one line on why a real user would ask it, the
archetype, and how the question was sourced (document-outward vs controversy-inward). Nothing
scored. Do not re-write the questions themselves — the review is his.

⚠ Do not edit the ten case-law entries' bodies while CC-Ingest is inserting extracts into them;
restructure the other forty and leave the case-law section's per-entry bodies alone, or coordinate
by doing your restructure first and telling them the shape. Say in your report which order
happened.

---

## §2 — WHAT THE STATISTICS STREAM IS, AND WHAT IT IS NOT

**The distinction is the whole design (§6d).** Numbers are never full-text searched. What is
searchable is the **catalogue**: the headings that describe what a series *is* — dataset title,
measure, geography, time span, department, COFOG function. Discovery finds the series; a separate
exact tool call fetches the values.

Why: a plausible-looking approximate match over a numeric series is worthless and dangerous. "Rough
answer" is a legitimate output for a debate transcript and never a legitimate output for a
statistic. Search answers *does a relevant series exist*; the tool answers *what is the number*.

---

## §3 — AUDIT BEFORE BUILDING

Report before writing the index:

1. **What is actually in the statistics store today** — series count, observation count, and which
   publishers. Read rows back; do not quote a manifest.
2. **The join key.** A deterministic series key was delivered on the ingest side and unblocked this
   work. Confirm it exists, is populated, and is stable — and quantify the two known residuals:
   `sourceSeriesId` is null on a large minority of rows (so the natural key alone does not uniquely
   identify a series — report the rate and what breaks because of it), and licence terms are
   recorded per dataset and **cannot express a per-vintage restriction**.
3. ⚠ **The licence register is load-bearing and must gate retrieval, not just be recorded.** We
   already hold at least one entry marked `commercialUseExcluded=true` (IMF) beside permissive ones
   (OECD, CC-BY). Report how many series sit under each licence class, and design §4 so a restricted
   series cannot be surfaced where its licence forbids it. A licence recorded and not enforced is
   the same failure class as a check that cannot fail.
4. **What headings exist versus what the design wants.** §6d requires the catalogue to carry
   **derived** headings later — ratios, growth rates, per-capita figures — which are not ingested
   fields. Confirm the schema can add discoverable headings that are not raw source columns, and
   say what it would take if it cannot.

If the audit contradicts this brief, stop and report. The design survives contact with the data or
it changes on the record.

---

## §4 — BUILD THE CATALOGUE INDEX AND THE STREAM

- Build a searchable index over the catalogue headings only. It is small and textual — it belongs
  in the same discovery mechanism as everything else, not in a bespoke lookup.
- Add it as a routed stream candidate behind a flag (default OFF, e.g. `LEX_STATS_STREAM`), read
  through `flagEnabled()` — never a bare `=== 'true'`, because a capitalised `TRUE` in Vercel
  silently disabled the router once for an unknown period.
- **The result shape must be a series descriptor, not a document.** It says what the series is, who
  publishes it, its geography and span, its licence class, and how to call it. A catalogue hit that
  renders like a corpus document invites Lex to quote it as evidence of a fact; it is evidence that
  a *measurement exists*.
- **Enforce the never-claim rule at the boundary:** the search layer returns "this series exists";
  it must not return, imply, or let a caller infer a value. If a value is needed, the caller makes
  the exact call. State this in `SEARCH_CONTRACT.md` §2 and §3 as part of the same commit.
- Licence enforcement per §3.3, structural rather than advisory — a restricted series is filtered
  at retrieval, not flagged for the caller to respect.

---

## §5 — MEASURE, HONESTLY

⚠ **There is no gold set for statistics, and one cannot be borrowed.** Do not report a recall
figure scored on questions you wrote for yourself as though it were a quality measurement —
committees has been unevaluable for exactly that reason since S7 and the lesson is fresh.

Instead:

- Write ~10 candidate discovery questions ("is there a series for X") in the same numbered,
  reviewable shape as §1, appended to the gold candidates document as a separate section marked
  **UNVALIDATED — statistics**. Charlie validates these alongside the rest.
- Report a **behavioural** check meanwhile: for 10 probe questions, does the router select the
  stats stream when a numeric series is plainly wanted, and — the more important half — does it
  **not** select it when the question is legal or evidential? A stream that fires on everything is
  worse than one that fires on nothing.
- Report latency added when the stream is selected, and confirm no regression on the S5 ten-question
  set with the flag OFF **and** ON.
- **Prediction to record before running** (predict-measure-compare): state, before the probes, how
  many of the 10 you expect the router to select stats for and which of the negative-control
  questions you expect it to leave alone. A written prediction is what turns a surprising result
  into a finding.

---

## §6 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-search-s9.sh`; nothing owned by CC-Ingest or CC-Graph
  edited — report needed changes instead.
- Every new check watched failing first. A check that cannot fail is not a check.
- Bytes before hypotheses: read rows and rendered output back, not counters.
- Flags default OFF; recommendations carry numbers; the variables are Charlie's to set in Vercel,
  which is unreadable from your machine (SAML).
- **Report `docs/SEARCH_S9_REPORT.md`:** audit findings first, then what was built, then the
  numbers with what each is a percentage OF and what it means for a user, then what is NOT done,
  named. Decisions for Charlie as numbered questions with a recommendation and the consequence of
  each option. Name explicitly what he should click in the browser to verify, since no live
  verification is possible from your side.
- Change-log and handoff entries labelled **SEARCH**.
