# BRIEF — SEARCH STAGE 2C-2: THREE DECISIONS ANSWERED, THEN THE GATED MEASUREMENT

**Owner:** Search thread (CC-Search)
**Written:** 10 August 2026
**Follows:** `BRIEF_SEARCH_S2C.md` — §0 and §1 landed (commit `1822fdd`); **§2 never ran** and is
carried into §4 below.

**A note on the numbering, because it matters for what comes next.** This is **not** Stage 2D.
2D is the graph layer — the position graph in `POSITION_GRAPH_DESIGN.md` — and it starts only once
the retrieval stack is measured and closed. This brief is the second pass of 2C: the three
decisions 2C surfaced, plus the measurement 2C could not reach.

---

## §1 — `EXPLANATORY_NOTE` as a tenth display type — APPROVED, build it

**Decision: yes.** Reasoning, because it is not obvious from the file count: labelling an
explanatory note "Guidance & regulators" tells a user they are reading a regulator's soft law when
they are in fact reading a statement of what Parliament meant a provision to do. In a product whose
entire claim is knowing precisely what the corpus says and does not say, presenting commentary in
the costume of another evidentiary class is a correctness error, not a cosmetic one. Five files is
cheap against that.

Requirements:

- The new type must **not** trip `isLeg` in `fts-search.ts`. Your reasoning for holding it out of
  the legislation types was right — rewriting the title to the Act's and the URL to a provision
  link would present an annotation as enacted text, which is a worse error than the one being
  fixed. Preserve that property explicitly, with a check, so a later refactor cannot quietly
  restore it.
- It stays reachable from the **legislation** stream by corpus scope, as now. A user asking about
  an Act should get the note that explains it.
- Panel label: propose one. It needs to read, to someone with no legal training, as *"this explains
  the law, it is not the law"*. Say what you chose and why.
- It gets its own `PER_TYPE_CAP` bucket like every other type. State whether that changes the panel
  mix on the five queries you already measured, and by how much.

**Pin the capability with gold questions.** You measured explanatory notes taking ranks 1–9 on
*"why was the Building Safety Act 2022 introduced"* and sitting below the operative-law hits on
*"speed limit enforcement on motorways"* — winning on **why**, losing on **what**. That is exactly
the intended behaviour, it is currently covered by **zero** gold questions, and it is therefore
unprotected: any future change could lose it silently. Add two draft gold questions that encode
both halves — one *why* question that should surface a note, one *what* question that should not.

---

## §2 — Explanatory note titles: show the Act, not the gid — APPROVED, build it

You reported this rather than fixing it quietly, which was right, and it should now be fixed.
`Explanatory Notes: ukpga/2022/30 — Article 50 (30)` is unreadable to a user with no legal
training, and users with no legal training are the entire point of the platform. A source panel
that shows machine identifiers reads as unfinished software, and Pilot B is people who do not know
us.

You named the risk correctly: teaching `fts-search.ts` to read the Act gid out of the annotation's
four-part id touches a function every legislation result passes through. So:

- The lookup fires **only** for the annotation corpora. Every other legislation result must be
  byte-identical before and after — assert that, don't assume it. A snapshot comparison over a few
  hundred real legislation hits is the cheapest form.
- Where the Act title cannot be resolved, **fall back to the current string rather than to an empty
  or partial title.** A gid is ugly; a blank is a defect.
- Report how many of the annotation rows resolve. If it is not close to all of them, say what the
  remainder look like before deciding whether to chase them.

---

## §3 — `scottish-parliament-or` into the debates stream — APPROVED as a measurement, not a config entry

**Charlie's decision: fix it now.** Your caution was correct and is adopted as the method: 1,044,188
sections is 86% of the remaining reachability gap, and it is also a change to what the debates
stream returns for **every** query, so it ships with a before-and-after or not at all.

Mechanism is the one you just built — an `extraCorpora` leg on the debates stream, as for
`erskine-may`, because the collection is already typed `DEBATE` and only carries tier `other` in
the built index.

### What to measure, before and after

1. **The debates-stream gold questions** — recall, and whether any answer key stops being satisfied.
2. **Contamination rate**: on questions that are plainly about Westminster, how many Scottish rows
   appear in the top 20? A number, not an impression.
3. **Latency**: the debates leg now scans a wider corpus filter. Report p50 and p95 before and
   after; warm queries, order reversed, per the standing rule.

### The decision that follows the numbers

If Westminster queries degrade materially, we do **not** revert — we gate the leg behind a
devolution filter and it becomes a routing question rather than a scoping one. Report the numbers
and stop there; the call is Charlie's.

### One correctness requirement regardless of the numbers

**A user must be able to tell Holyrood from Westminster at a glance.** Someone reading a Scottish
Parliament Official Report extract believing it to be a Commons debate is a worse outcome than not
finding it at all. Make the jurisdiction visible in the citation or title as rendered in the panel,
and confirm what it now reads as.

---

## §4 — Carried from S2C §2: the benchmark and the ordering baseline

Unchanged in substance. Check the `corpus_vec` delta-embed completion marker in
`handoff_summary.md` before starting; ingest predicted completion around midday UTC on 10 August.
If the marker is absent, do §1–§3 and stop, exactly as you did last time.

Two corrections you established, now the instruction:

- **The ordering baseline excludes 4 questions, not 6** — D2, D3, D4 and D5, the archetype-D set
  declaring a "citation graph" stream the router does not have. The undeliverable-collection set
  went 4 → 0 with your §1 fix and overlapped archetype D at D2/D3. State the excluded count in the
  report so a future reader does not have to re-derive it.
- **Report recall lost to scoping separately from ordering changed.** 12 questions are satisfied in
  part by keyword-only collections, so a single routed-versus-unrouted delta would blame the router
  for a coverage loss. Only the ordering half bears on the reranker.

Then `score-ordering.ts` over the 20 committed pairs, on the interleaved list handed to the answer
call, before `groupForPanel`. Record a prediction first, as before. **The reranker is authorised by
that number or not at all** — and it is the last item standing between here and calling the
first-pass retrieval stack closed.

---

## §5 — Carried, unchanged

- `caselaw` selection 36/36 → 22/36 after the few-shot examples. Answered by the gold set in §4, not
  reverted on suspicion.
- All `--pre-fix` modes stay in the tree.

---

## Working rules

Unchanged. The three that keep earning their place: **repeats are not optional** on anything
intermittent; **prove a check can fail before trusting it passes**; and **a fact that was inferred
must not look like a fact that was measured** — which is now `CLAUDE.md` §19, and which caught the
`RAILWAY_ROLE.md` error this week.
