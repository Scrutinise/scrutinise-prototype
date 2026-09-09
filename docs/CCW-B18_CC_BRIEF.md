# CCW-B18 — CC brief: second draft of the Restoration Programme report

**From:** CCW (Cowork) · **To:** CC (Claude Code, Windows repo) · **Date:** 9 September 2026
**Repo:** `C:\Code\scrutinise-prototype` · **Report working dir:** `docs\report_run\`

---

## 0. Read first

1. `docs/handoff_summary.md` — current status of the people graph, the citator, and the recent search upgrades. **You will need it twice:** once to know what you can run today, once to write §9 of this brief (the limitations section).
2. `docs/CHANGE_LOG.md` — what has landed since the twelve builds ran on 8 September.
3. `docs/report_run/SECOND_DRAFT_PLAN.md` — the full ~60-item plan. This brief covers only the CC-owned items (C1–C6, D1–D2) plus four new ones surfaced by the 8 September technical reports.

## 0.1 Standing rules — unchanged, still binding

- **No git mid-sprint** (CLAUDE.md §12). Scoped commits by explicit path at the end. Never `git add -A`.
- **BAILII is blocked.** No fetch, no stored HTML, no robot access. `check:graph5-case-edges` must keep failing on any network call.
- **Never sum the detection types.** `markup` 385,346 · `text` 649,202 · `enabling` 191,258 · `caselaw-markup` 1,288,630 are four different measurements of different things.
- **Never present a count as complete.** Never say a provision or case is "no longer good law" — the schema has no column for it and no basis to assert it.
- **Verify against what is running, not against what is in the repo.** Two errors in one week came from checking a repo file when Railway builds from a different commit and the worker reads a different host. If a check reads a startup banner, confirm the banner is in the committed file that Railway actually built.

---

## 1. ⚠ Allowance — do this first, everything else is blocked behind it

The kernel re-runs need 36–48 full builds. At `FULL_BUILD_THIRDS = 3` that is 108–144 thirds against the 60 currently granted.

**Raise to 200 thirds via `PATCH /api/admin/allowance` with a note.** Suggested note: `B18 kernel iteration — Restoration Programme second draft — CCW-B18 §2`.

⚠ **Do not use `LEX_PILOT_ALLOWANCE_THIRDS`.** An explicit per-user grant overrides the env var, and the override is detectable only by the presence of `buildAllowanceNote` — never by the number. If you set the env var and a grant already exists, the env var does nothing and you will not be able to tell from the figure.

**Verify after:** read back the user row and confirm both the number and the note. Report both.

---

## 2. ⚠⚠ C1 — The kernel re-runs. This is the largest item and it gates the report.

**The problem in one line:** all twelve builds produced a diagnosis, a guiding policy and a set of actions, the critique passes then failed several of those kernels, and **no kernel was ever re-run against its own critique.** The Equality Act kernel was marked *"not a strategy… a list of actions"*; two of nine strategy tests passed.

**Why this matters:** the kernel (diagnosis → guiding policy → coherent actions) is the product's central claim. A report that ships twelve failed kernels demonstrates the critique works and the loop does not.

**Per measure, the loop:**

1. Read the existing build's `KERNEL_CHECK`, `LOGIC_CHECK` and `ADVERSARIAL` output.
2. Re-run the build with the critique fed back in as input.
3. Repeat until the kernel passes the strategy and logic tests, or until it is clear it cannot pass and the reason is stated.
4. **Constraint:** each iteration must stay aligned with David's stated intention as recorded in `lex_build_inputs.json`. If an iteration only passes by changing what the measure is trying to do, that is a fail, not a pass — record it as such.
5. Export the final kernel **and, separately, the alternatives generated along the way.** The alternatives are report content: they are the "choices that require human decisions" the report exists to present.

**Order:** the three worked in full first — **M-03 Human Rights Act, M-04 Equality Act, M-05 civil service.** If those converge, extend to the other nine. Report after the first three before spending the rest of the allowance.

**Watch for:** `goalKind` must be one of the four enum keys — `LAW_CHANGE`, `APPLICATION_CHANGE`, `INSTITUTIONAL_PRESSURE`, `UNSURE`. Free text resolves silently to "not stated". This bit us once already.

---

## 3. ⚠ D2 — Re-run M-01 (Human Rights Act) before anything else uses it

M-01 v1 ran with `FTS_SEARCH_URL` unset and `LEX_VECTOR_STREAMS` empty. Eighteen searches broke, returned zero results, and the build **still reported `DONE`, 11/11 passes.** That is why chapter 4.3 shows two statutory instruments and one judgment, against the Equality Act's 107 provisions / 91 / 33 judgments on a working run. Charlie spotted the discrepancy in review.

Re-run it with retrieval confirmed live. Ten minutes, three thirds.

**Separate, and worth a line in the limitations section:** `assertRetrievalConfig()` exists in `harness-preflight.ts`, but `build-worker.ts:43` imports only `resolvedConfigLine()` — the printer, not the guard. That is the sixth instance in a week of a guard whose scope is narrower than the thing it guards. **Fix it: import and call the assertion in the worker.** A build that retrieved nothing must not be allowed to report `DONE`.

---

## 4. ⚠ NEW — Link each of the twelve ideas to its instrument

Source: `SURFACE_5_REPORT.md`, decision 3. **This is the highest-value new item in the brief and it is Lex-owned, not Search-owned.**

The `STATUTORY_CONSEQUENCES` Deepening pass had never run for anybody until 8 September. When it ran on *"Abolish the Supreme Court"* against `ukpga/2005/4` it produced, in 5.8 seconds for 0.0839p: **120 instruments recorded as made under the Act, 840 provision references in six groups.**

It fires on one idea only **because only one idea has a linked instrument.**

**What to build:** a prompt in the Lex build — *"which Act would this change?"* — with the instrument link written from the answer. Then the pass runs on all twelve.

**This is the appendix Charlie asked for** (C5): every provision each measure touches, with citation and link.

⚠ **Two known defects to carry into the output, not to hide:**
- 60 of the 120 instruments quote enacting words that do not name CRA 2005. The link is real; the *basis* recorded for 60 of them is not evidenced.
- `nisr/2010/381` is a **verified misattribution.**

Print the count honestly: *"120 instruments identified as made under the Act; the enacting words of 60 do not name it, and one is a confirmed misattribution."* Do not print 120 unqualified.

---

## 5. C3 — The citator

`GRAPH_5_REPORT.md`: the substance exists — 1,288,630 case-law → legislation edges, 565,931 case-to-case edges over 137,153 authorities, `caselaw_treatment_edge` with 1,749 rows across nine treatments.

**Run every judgment cited in the report through it and print, per judgment: doubted, distinguished, overruled, followed, or no treatment recorded.**

⚠⚠ **It cannot ship without an accuracy figure.** GRAPH_5's own words: *"§3 ships with 1,749 edges and no accuracy number at all, which is worse than a bad one, because a citator with an unmeasured error rate will be quoted."*

**Q1 in that report needs Charlie to score the 15 rows in `docs/GRAPH_5_VALIDATION.md`.** Put that in front of him as a single scoring task — fifteen rows, ten minutes. Until it is scored, every citator output in the report carries the line *"treatment edges are unvalidated; error rate not yet measured."*

Known false-positive classes to state: hypothetical clauses read as holdings; word-sense collisions ("distinguishable" ≠ "distinguished"); and a Victorian statute quotation recorded as `overruled` of HRA s.6.

---

## 6. C4 — The people graph

Per measure: who is on the record for and against, what they said, and where.

⚠ **Constraint from `SEARCH_CONTRACT.md`:** 16,196 positions are extracted but **not exposed to search**, and hand-reading gives a **44% error rate**. The contract's own verdict: *"it is not going in front of a user at that number."*

**So:** produce the register, but treat it as a **candidate list requiring human confirmation**, not a finding. Two columns Charlie can work down: the extracted position, and the source quote it came from. Anything he cannot confirm from the quote is dropped, not softened.

---

## 7. C6 — Cost and benefit

`SEARCH_S18_REPORT.md`: the costing block exists (`lib/lex/costing.ts`) but **has no route into any idea** (D-4). `costSummary` is starved — **0 of 119 coherent actions carry a cost range.**

**Build the route.** Then, per measure, attach cost ranges to the coherent actions.

⚠ **One finding is directly a report answer.** S18's own control question X7 is literally *"What has the Public Sector Equality Duty cost to date?"* — which is Charlie's question at 4.4. The honest answer is **three absences**: no impact assessment held, no post-implementation review held, and no statistics series measures it. **Print it as three absences, named.** "We could not find a figure" is weak; "no impact assessment was made, no post-implementation review was carried out, and no statistical series measures it" is a finding.

**Related, from `INGEST_IMPACT_NUMBERS_REPORT.md`:** 1,169 assessments held (not 18,700). Only 71 are genuine post-implementation reviews. **196 of 231 measures with a stated review due-year are overdue with no review deposited** — but that is *a floor on the gap*, not the gap, and cannot be published as an answer until gov.uk's route is ingested. State it as a floor or leave it out.

---

## 8. C2 — The Research panel appendix

Charlie's instruction: *"CC built the right-hand panel so should know what's in it without needing to look."* Agreed — **do not send anyone to screenshot the UI.** Take the heading set from the component source and build the exporter from that.

Output: per idea, every Research panel heading with its content, as an appendix section.

---

## 9. NEW — Write the "still under construction" section

Charlie wants a limitations section in the report written from what is actually true today, not from what CCW guesses is true. **You have the handoff summary and the change log; CCW does not.**

**Write, in plain English, no repo jargon, aimed at a reader who is a Member of Parliament:**

- What the search can do today, and what it cannot yet reach.
- Which parts of the corpus are complete and which are partial — with the never-claim-complete rule applied.
- The citator's status and its unmeasured error rate.
- The people graph's status and its 44% hand-read error rate.
- The cost-benefit block's status.
- Anything shipped since 8 September that changes what the report can assert.

**Register:** the tone of the report is a High Court judgment. Sober, factual. No process chat, no model names, no "we", no apologies. State what is built, what is not, and what follows from that.

Hand it back as `docs/report_run/LIMITATIONS_from_CC.md`. CCW will place it.

---

## 10. Gemini hallucination — cross-check and self-prefilter

The cross-model verification sweep produced roughly 160 sources and **five fabricated citations. All five came from Gemini**: HL Paper 150, HL Paper 88, a Sedwill IfG lecture, a Policy Exchange "Cost of Compliance", a Lady Hale 2023 lecture. Every one had a real neighbour — a real paper with a different number, a real lecture by a different person. Grok and ChatGPT, which flagged their own uncertainty, produced almost none.

**Two things to check and one to build:**

1. **Which Gemini model is configured, and at what temperature,** in whichever service made those calls. Charlie's hypothesis is that a cheaper tier was in use. Report the model ID, not a guess.
2. **Whether any Gemini output reaches a build without passing a verification step.** If it does, that is the defect, independent of model tier.
3. **Add a self-prefilter instruction to every citation-producing prompt:** *"For each source, state whether you are certain of the exact citation. If you are not certain of the number, name and date, say so and give the nearest source you are certain of instead. A source you cannot vouch for must be labelled unverified, not omitted and not guessed."* The models that self-flagged were the models that did not fabricate; make self-flagging mandatory rather than optional.

⚠ **Standing rule for the report:** no citation reaches the client document without a second source or a corpus hit. Five in one sweep is a rate, not an accident.

---

## 11. D1 — Backup

3.1 MB of `.docx` and `.pdf` source (the 16 Word files, the conference PDF, raw VTT, `starkey_hits.json`, `register_candidates*.json`) are deliberately gitignored and are **not in the R2 backup.**

**Write them to R2 alongside the existing corpus backup.** Ten minutes; credentials are already on the machine. Routing them through Cowork is impractical at that size.

---

## 12. Order of work

| Order | Item | Blocked by |
|---|---|---|
| 1 | §1 allowance raise | — |
| 2 | §3 M-01 re-run + worker guard fix | §1 |
| 3 | §2 kernel re-runs, M-03/M-04/M-05 first | §1 |
| 4 | §4 instrument links → consequences pass on all twelve | — (parallel) |
| 5 | §11 R2 backup | — (parallel, do it early, it is ten minutes) |
| 6 | §9 limitations section | reading handoff + change log |
| 7 | §8 panel appendix · §5 citator · §6 people graph · §7 cost | — |
| 8 | §10 Gemini check | — |

**Report back after step 3** with the first three kernel results before committing the rest of the allowance.

---

## 13. What CCW is doing in parallel

The voice rewrite, the promotion of the Political Constitution / Legal Constitution framework to Part 1, the Part 4 merge, the glossary, and the new research items (Grieve's two-judgments claim, the Public Office (Accountability) Bill, Bank of England, Safety of Rwanda Act, Appellate Committee vs Supreme Court, the 100-day / six-month Article 58 sequencing, retained rights, devolution amending wording, Miller I and II, Belmarsh and Abu Qatada, the comparative table, Bellamy) plus draft clauses for the three worked measures.

**Nothing CCW is doing blocks CC, and nothing CC is doing blocks CCW** until assembly.
