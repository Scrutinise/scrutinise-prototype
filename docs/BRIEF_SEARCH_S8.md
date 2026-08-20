# BRIEF — SEARCH S8: FINISH THE INFRASTRUCTURE (WIRE, ATTRIBUTE, MEASURE HONESTLY)

**For:** CC-Search
**Written:** 19 August 2026, by CCh-Search
**Executes:** SEARCH_STRATEGY v5 §12 Block 1 + Block 2 item 8
**Format:** audit-then-build. No git operations during the sprint; one `commit-all.sh` at the end,
scoped by explicit file path; Charlie approves on Vercel preview; then execute and delete the
script. Update `docs/SEARCH_CONTRACT.md` **in the same commit** as any change to what search can do.

---

## §0 — WHERE WE ARE

Recent past: **S5** gave the Lex chat route the whole corpus (two channels, gap notes, unmet-demand
log, batching at 3). **S7** cleared the carried backlog: semantic search measured per stream
(caselaw +12.5pp, guidance +12.5pp, debates −15pp, committees unmeasurable), `PRECEDENT` and
`DEVOLUTION_SCOPE` built and tested, the framing experiment found underpowered by its own output.

This sprint: **no new retrieval capability.** Everything here either connects something already
built, makes an existing result carry its provenance, or repairs a measurement so it can answer its
question. When S8 lands, the first-pass search infrastructure is *finished*, and the project moves
to the measurement phase (gold-set validation) and the graph (GRAPH 3A, separate stream).

Next after this: gold-set validation pass (Charlie + CC), re-scored per-stream vector decisions,
statistics catalogue (S9), GRAPH 3A in parallel on the graph stream.

**Do not touch:** the graph tables (CC-Graph owns them), anything under `scripts/ingest` beyond
reading, `gateway-legacy.ts` scope (S4 measured it correct), the router's stream-selection for the
five existing streams (§4 *adds* candidates; it does not retune what works).

---

## §1 — WIRE `PRECEDENT` AND `DEVOLUTION_SCOPE` INTO THE DEEPENING

**Why:** both were built and verified in S7 and nothing calls them. Built-but-unwired is the exact
pattern this project keeps paying for (the spend meter existed and recorded nothing; almost
everything built in a fortnight was invisible to users). The Deepening (the background passes that
enrich an idea after the kernel is drafted) is their designed consumer and already has the pass
framework — passes are pure configuration.

**Audit first:**
1. Read the Deepening pass config and confirm how a pass declares its retrieval intent.
2. Read what S7 built: where `PRECEDENT` and `DEVOLUTION_SCOPE` live, their input shape, their
   rendered-block output shape (PRECEDENT: the intended/predicted/observed **group**;
   DEVOLUTION_SCOPE: jurisdiction-led lines plus the three-schedules note).
3. Confirm the intents are still DESCRIPTIVE at the gateway (they select no streams — the retrieval
   they do is their own). State in the report what actually executes retrieval for each.

**Build:**
- Add a Deepening pass (or extend the political-risk/evidence passes if the config shape says so —
  your call, justified in the report) that calls each job for the idea's identified instrument(s),
  and persists the rendered blocks through the existing PROPOSED-item machinery.
- **Constraints that must survive the wiring, asserted in checks:**
  - PRECEDENT renders as a group, never a ranked list.
  - A missing post-implementation review is **never** filled from the impact assessment; the
    "nobody has checked whether this worked" sentence must be reachable in real output.
  - DEVOLUTION_SCOPE never answers "is it reserved"; the three schedules are named.
  - Web sources keep `[W1]` numbering; `markersCollide()` still guards.
  - Deepening's standing invariant holds: evidence-layer writes never touch a canonical field;
    ACCEPTED items are never superseded.
- If an idea has no identifiable instrument, the pass writes nothing and logs why — a pass that
  invents an instrument to have something to say is the never-claim rule broken upstream.

**Verify:** run the Deepening on at least two real ideas (one with a clear instrument, one
without). Read the persisted artefacts back from Neon — the artefact, not the counter. Extend
`check:deepening` with the assertions above, each watched failing first.

---

## §2 — ATTRIBUTION: WHO SAID IT, THROUGH THE GATEWAY

**Why:** a committee transcript currently reaches Lex with no "who was speaking" — named in S5 as
the most useful fact about that document, and a gap in the gateway contract. Without it, the
evidence channel asks the user to weigh testimony without knowing whose it is; with it, the
position graph later gets its evidence pointers for free.

**Audit first — this section's scope depends on it:**
1. For each non-legislation collection served through the evidence channel (committees evidence,
   debates, caselaw, guidance, consultations, impact assessments): does the *stored section or its
   metadata* carry speaker/witness/author/court **as a structured field**, or is it only folded
   into the title string, or absent? Produce a small table: collection → where attribution lives →
   coverage estimate (sample ≥50 rows per collection, read from the store, not inferred from the
   schema).
2. Report the table **before** building. If a collection holds attribution only in the title, that
   collection ships `attribution: null` — **never parse it back out of a title**; a title is
   display text, and a regex over display text is an inference travelling as a fact.

**Build:**
- Add an optional `attribution` field to the gateway's canonical result shape and to
  `EvidenceResult` (e.g. `{ name, role }`, shape to fit what the audit found). Adapters populate it
  only from structured metadata; otherwise null.
- Render it in the evidence-channel block (`— evidence of <name>, <role>` or similar) and pass it
  to Lex's material so answers can carry it.
- `LegacySearchResult` is untouched.
- Update `SEARCH_CONTRACT.md`: what attribution means, which collections carry it, and that null
  means *not held structurally*, not *anonymous*.

**Verify:** the S5 ten-question set re-run; count results carrying attribution per collection and
report the rate against the audit's coverage estimate — if the two diverge, that is the finding.
Check asserts: no code path derives attribution from a title (grep-enforced with one allowed
null-assignment site, watched failing on a planted violation).

---

## §3 — MOVE THE FRAMING HARNESS THROUGH `runSearch()`

**Why:** GOLD TEST 11 measured bare BM25 against `corpus_fts` — a floor of 8.1% recall against a
platform headline of ~62% — so 27 of 31 queries scored zero in both arms and the experiment could
not answer its question. The harness location (under `scripts/ingest`, which cannot import
`scrutinise-web/`) was the fault, not the design.

**Build:**
- Re-home the harness on the web side so both arms run through `runSearch()` — real routing,
  fusion, expansion. Keep: per-query alternating run order (cache-warming has misled a measurement
  before); the **differential** leak test (a question naming its own subject is not a leak); the
  framing recorded in the report header; the headroom count printed by the harness itself.
- ⚠ A local run without the production flags is keyword-only and will look like a regression
  (`SEARCH_CONTRACT` §4). The harness must **print the flag state it observed** (read positively —
  a `served`/config readback, not the env), and the report must state which configuration ran. If
  the live configuration is unreachable from the machine, run against locally-enabled flags and say
  so in the header — a labelled approximation beats an unlabelled one.

**Verify and report:** both arms, recall@20, headroom count front and centre. State which
comparison ran (bare vs caller-enriched; NOT the Lex user-profile contrast). Prediction to record
before running (predict-measure-compare): with routing and fusion live, headroom should rise well
above 4 of 31; if it does not, the gold queries themselves are the next suspect, and that feeds §5.

---

## §4 — EXTEND THE ROUTER TO THE NEWEST TYPED STREAMS

**Why:** impact assessments, consultations and explanatory material are typed, indexed and
retrievable, but the router's stream-selection prompt predates them — they surface only through
neighbouring streams. A user asking "what did the government predict this policy would cost" has a
stream that answers exactly that, which the router cannot deliberately choose.

**Build (flag-gated, default OFF — e.g. `LEX_ROUTER_STREAMS_V2`):**
- Extend the router prompt/config with the candidate streams. Do not retune the five existing
  streams' selection behaviour.
- Divisions stay out: a graph input, never text-searched (strategy §3.3).

**Measure before recommending:**
- On the existing gold set plus the S5 ten questions: (a) selection behaviour — when is a new
  stream chosen, and does its choice displace a stream that was serving the answer; (b) recall on
  the questions the old router already served — **no regression is the gate**; (c) latency delta.
- ⚠ The gold set has no archetype for these streams (same instrument problem as committees), so a
  *gain* is probably unmeasurable today. Expected honest outcome: "no regression, selection looks
  sane on N probe questions, gain unmeasurable until §5 questions exist." Report it that way if
  that is what the numbers say. The flag stays OFF; the report recommends; Charlie flips.

---

## §5 — DRAFT THE GOLD QUESTIONS THAT MAKE MEASUREMENT REAL

**Why:** the binding constraint on all retrieval-quality work is the test set (strategy §5.2).
Committees — the largest evidence collection — is unevaluable; caselaw and guidance are scored on
questions you wrote yourself; the new §4 streams have none. This section produces the *draft*
instrument; **Charlie's validation pass is what makes it real** — do not present these as a scored
gold set until he has reviewed them.

**Build — for each of: committees, caselaw, guidance, impact assessments, consultations:**
- ~10 questions per collection. Each entry: the question **as a real user would phrase it** (a
  member of the public or a policy advocate — not corpus vocabulary); the answer key (specific
  document ids that a correct top-20 should contain, verified to exist in the corpus by reading
  them back); one line on why a real user would ask it; and the archetype it covers (so coverage
  across question-shapes is visible, not accidental).
- Sourcing discipline: derive questions from the documents (find a notable document, ask the
  question it answers) **and** from the outside in (take real public controversies and ask what a
  user would ask) — a set built only document-outward inherits the corpus's vocabulary and
  overstates recall. Mark which method produced each.
- ⚠ Do not score anything against these yet. Deliver as `docs/GOLD_CANDIDATES_S8.md` structured
  for Charlie to accept/reject/amend per question quickly (numbered, one block each).

---

## §6 — THE CONCURRENCY EXPERIMENT: 3 → 4

**Why:** S5 batched stream calls at 3 concurrent; p95 on the chat route is 9.0s — acceptable-ish,
not good. S7 showed two simultaneous users cost 0.75×–1.37× of serial p95, so headroom likely
exists. One variable, against the real services.

**Prediction to record first:** raising `LEX_STREAM_CONCURRENCY` to 4 should cut p50/p95 on
five-stream questions by roughly the cost of one serialised batch wave, without pushing the
vector/FTS services into the saturation the batching was built to prevent.

**Run:** the S5 ten questions, cap 3 vs cap 4, alternating order, same session, warm services.
Observe `maxInFlight` (the limiter's own log) in both arms — the engagement check. Report p50/p95
both arms, and any error/timeout in either. **Recommendation only** — the production variable is
Charlie's to set in Vercel.

---

## §7 — CONFIG HYGIENE FROM THE HANDOVER

Three small items, each cheap now and expensive rediscovered:

1. **Anthropic and xAI prices are unrecorded**, so any pass on those models reports "unpriced" and
   the cost ceiling cannot bind. Add them to the price table from the providers' published pricing
   pages, **recording source URL and date-checked beside each figure** (a price is a fact about a
   day). Check: no configured model resolves to "unpriced".
2. **Two configured fallback models do not exist in the accounts** — a fallback that fails only
   when the primary already has. Identify them, replace with models verified present (a live
   1-token call each, logged), or remove the fallback and say so.
3. **OpenAI has no API key on the machine.** Do not add one; record in the report whether anything
   is configured to want it. If nothing does, note it and close the item.

---

## §8 — STANDING RULES AND THE REPORT

- Scoped commits by explicit file path only; one `commit-all.sh` at the end; no git during the
  sprint.
- Every new check watched failing first. A check that cannot fail is not a check.
- Predict-measure-compare: §3 and §6 predictions written into the change log before the runs.
- Bytes before hypotheses: read artefacts back (Neon rows, rendered blocks), not counters.
- Nothing widened before it is measured; latency costs reported beside gains.
- `SEARCH_CONTRACT.md` updated in the same commit as §1/§2/§4 changes; change-log and handoff
  entries labelled **SEARCH**.
- **Report** (`docs/SEARCH_S8_REPORT.md`): per section — what was found in audit, what was built,
  the numbers with what each is a percentage OF, what is NOT done, named. Flag recommendations
  (`LEX_ROUTER_STREAMS_V2`, `LEX_STREAM_CONCURRENCY`) are recommendations with numbers under them;
  the variables are Charlie's.
- **Known environment limits:** Vercel flags unreadable/unsettable from the machine (SAML); no
  browser walk possible — name the specific things Charlie should verify in the browser at the end
  of the report (expected: a Deepening run showing PRECEDENT/DEVOLUTION_SCOPE blocks, and an
  evidence answer carrying attribution).
