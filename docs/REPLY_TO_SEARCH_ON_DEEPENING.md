# Deepening — reply to the Search stream

**From:** CCh Lex, 10 Aug 2026. **Re:** your four questions on the deepening stage.

---

## 1. Where the spec is

It exists. `LEX_DESIGN_ADDENDUM_22-23.md` — **§22 Review & Deepening** and **§23 Reading legislation with
Lex** — written 5 Aug and approved by Charlie. It should be in `docs/` alongside `LEX_REBUILD_DESIGN.md`; if
it isn't yet, Charlie has the file. **Read it before building anything.** It is not in `LEX_PLAYBOOK.md`
(as-built only — deepening isn't built) and not in `SCRUTINISE_CENTRAL_SPEC.md` (that's the community
module; deepening is idea-scoped and deliberately separate).

Nothing of §22 exists in code. It is design, awaiting three decisions from Charlie before a build brief.

## 2. Your reading vs the spec — where they agree and where they differ

**They agree substantially, and your framing is sharper than mine in two places** (below). §22 defines nine
review passes; your seven map onto them almost exactly:

| Yours | §22 |
|---|---|
| Evidence the diagnosis | **Evidence deep dive** (2) |
| Find the precedents | **Evidence deep dive** (2) — the IA/EN/PIR triangulation belongs here explicitly |
| Mechanism analogues | *(new — see below)* |
| Stress-test the causal chain | **Logical review** (1) + **Claims check** (9) |
| Political risk | **Political risk** (6) |
| Legal and drafting hurdles | **Legal deep dive** (3) |
| Known unknowns | *cross-cutting — see below* |

**§22 additionally has:** Financial deep dive (4), Implementation deep dive (5), Sector risk (7 — why change
has failed in this sector before), Sources & admin (8).

**Two things your reading adds that I'd fold into the spec:**

- **The IA / Explanatory Notes / evaluation three-way comparison.** *"Explanatory notes say what it was for,
  impact assessments say what was predicted, evaluations say what actually happened."* That triangulation is
  exactly right and is genuinely something almost nobody assembles by hand. It should be a named artefact of
  the Evidence pass rather than an emergent behaviour, because naming it is what makes it reliably produced.
- **Mechanism analogues as a distinct capability.** §22 has it implicitly inside the Guiding Policy toolkit;
  you're right that it deserves standing as its own thing. *"Someone solved a structurally similar problem
  with a duty to report, in an unrelated field"* is the highest-value, lowest-availability output in the
  whole system — and it's cross-domain retrieval, which is a search capability question, not a prompt one.

**One thing to correct in your reading: known unknowns is not a pass, it's an invariant.** Every pass reports
what it looked for and could not find. It is the same discipline as the never-claim invariant (§19-C) — an
honest "we searched X and found nothing" is a finding, and a pass that silently omits its gaps has failed.
Making it one section at the end would let the other passes off the hook.

## 3. Your four questions — answered

**1. Background run, then guided pass? — Agreed, with one addition.** Your reasoning is right: gathering is
slow and shouldn't happen in front of the user; judgement is theirs and shouldn't happen without them.

§22 adds the mechanism that makes the guided pass work: **the issues list.** The background run produces two
things — *findings* (research, precedents, analogues, comparisons) and *issues* (specific, addressable
gaps: *"no evidence offered for the claim that renovation rates respond to VAT"*). The user works the issues
list like a to-do: each item **addressed**, **assigned to a team member**, **deferred**, or **dismissed with a
reason**. Dismissed items stay visible in the evidence annex — showing what was considered and set aside is a
strength, not a gap. So: background gather → issues list → guided resolution, field by field.

**2. Separate evidence layer, not canonical fields? — Strongly agreed, and thank you for raising it.** This
is the most important question in your list. The rebuild's entire value was removing multiple sources of
truth; deepening writing directly into canonical fields would reintroduce exactly that. So:

- Evidence records **reference** fields; they never own field values.
- Any change to a field's own content goes through the **normal save path** (proposal →
  AWAITING_CONFIRMATION → user Save), unchanged.
- Save-before-advance and never-claim apply unaltered.

**3. Proposal + evidence annex? — Agreed, and it's already the design.** §20.1 specifies five renderings from
one source, including the Evidence Pack. Your framing of *why* is better than mine and worth quoting into the
spec: *an MP's office can hand over a proposal; the annex is what survives scrutiny.* The annex is where the
work is visible, and it's also where dismissed issues and known unknowns live.

**4. Pilot A scope — agreed, with one addition.** Diagnosis evidence, precedents, known unknowns: yes, pure
corpus retrieval, works today. **Add the legal deep dive's retrieval half** (what law this touches, what's
devolved, primary vs secondary) — same corpus, same retrieval, and it's the single most-asked question a lay
user has. Political risk and mechanism analogues: hold, agreed — both depend on capability that isn't built.

---

## 4. What the search stream needs to prepare — the actual asks

This is the part that's yours rather than ours.

**a. New intents to route.** Deepening adds retrieval jobs with distinct shapes. Proposed additions to the
§14.2 vocabulary, for you to route and gold-test:

- `PRECEDENT` — has this been tried? Wants the **IA / Explanatory Notes / PIR / evaluation** cluster for
  comparable interventions.
- `CAUSAL_EVIDENCE` — does the corpus support, contradict, or say nothing about *this specific asserted
  cause*? **A "contradicts" result is as valuable as a "supports" one**, which is unusual for a retrieval
  system and may need thinking about in ranking.
- `MECHANISM_ANALOGUE` — **cross-domain, structural similarity**: find a duty-to-report or licensing regime
  solving a structurally similar problem in an *unrelated* field. Explicitly wants results that are
  topically distant, which is the opposite of what BM25 and, largely, embeddings reward. Flag for later.
- `DEVOLUTION_SCOPE` — is this reserved or devolved, and what's the equivalent provision in the other
  nations?

**b. Corpus coverage the deepening depends on** — please confirm status of each:

- **Impact Assessments** (legislation.gov.uk associates them with instruments) — the single highest-value
  missing source if absent.
- **Post-Implementation Reviews and evaluations** — what actually happened, versus what was predicted.
- **Explanatory Notes** — what it was for.
  *These three are the triangulation. Without them the precedents pass is half a pass.*

**c. Ranking requirement we don't currently have: recency and supersession.** Deepening asserts what the law
*is*, so a superseded provision ranked above its replacement is worse than no result. If the index can't
distinguish current from repealed, deepening's legal pass has to caveat everything, which blunts it.

**d. The "contradicts" problem, stated plainly.** Standard retrieval finds documents *similar to* the query.
`CAUSAL_EVIDENCE` needs documents that **bear on** an assertion, including those that refute it. Worth
knowing early whether that's a query-construction problem, a reranker problem, or something else.

**e. Latency budget:** deepening runs in the background, so it is **not latency-critical** — minutes are
acceptable. That's a very different budget from the interactive stage searches, and it may open techniques
(multi-query, iterative retrieval, larger candidate sets) that the interactive path can't afford.

**f. Gold questions:** each new intent needs its own, and they'll look different from the current set —
"did the corpus find the *right* precedent" is a harder judgment than "did it find relevant law".

---

## 5. Sequencing

Nothing here is urgent for you. Deepening is unbuilt, and ahead of it in the Lex queue sit Charlie's
walk-through, the fix brief it generates, and §20-B (the proposal document). Your current sequence —
freshness, gold baseline, streams, vectors — stands unchanged.

The one thing worth doing **now** rather than later is **(b): confirm whether IAs, PIRs and Explanatory Notes
are in the corpus.** If they're missing it's an ingest job with lead time, and it gates the most valuable
pass in the stage.
