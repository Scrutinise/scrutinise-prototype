# BRIEF — Sprint 25-B: research, revision, and the adversarial read

**Spec:** `docs/LEX_REBUILD_DESIGN.md` §25 (passes 3–5), §22, §24. **Thread:** Lex/UX.
**Written:** 18 August 2026.

**What this sprint does.** 25-A drafts a kernel from four answers, unresearched, in one pass. That is
the skeleton. **25-B is what makes it worth reading**: it researches what the draft revealed, rewrites
the diagnosis in the light of it, and then reads the whole thing back as a hostile committee clerk.

---

## §0 — Gating, and the honest position on it

**Do not start until both are true:**

1. **Production is genuinely serving 25-A** — verified by reading a 25-A string off the live site, per
   the new CLAUDE.md delivery section. It has not been for the last day.
2. **Charlie has run the premise test** and said go.

⚠ **And a caveat worth stating rather than hiding.** If the premise test comes back *"this is thin and
generic"*, that is the expected result for a kernel drafted from four answers with **no research
behind it**, and 25-B is precisely the thing that would fix it. So a marginal verdict argues for
building this, not against. Only *"I'd have been quicker writing it myself, and reading it did not
make me think"* argues against the model itself — and that is Charlie's call, not a build decision.

## §1 — The architectural problem this sprint has to solve first

**25-A's build ran in 45–53 seconds inside one request. 25-B's will not fit.** Ten or more library
questions, each retrieving ~100 candidates and sifting them, plus a revision pass and an adversarial
read, is minutes of model time. **Vercel's `maxDuration` ceiling is 300 seconds**, which 25-A already
documented as the binding constraint, and there is no configuration that raises it.

So the build must come off the request path. **Recommendation: one pass per request, driven by the
polling the client already does.** The client polls the build row; when a pass completes, the poll
response says which pass is next and the client triggers it. No new infrastructure, each pass gets its
own 300-second budget, incremental persistence already exists, and the settle already handles a pass
that dies.

- **Guard the obvious failure:** a client that closes mid-build must not leave a permanently RUNNING
  row. The existing abandoned-run settle covers it; extend it to resume rather than only to fail,
  and make an orphaned build resumable from its last completed pass.
- **The alternative, if pass-per-request proves awkward:** run the build on the Railway worker, which
  has no such ceiling. More robust, more setup. Take it only if the first approach fails, and say why.

`// A ceiling that cannot be raised is an architecture constraint, not a configuration problem.`

## §2 — Reuse, do not rebuild: this IS the Deepening

**Audit before writing anything.** §22's Deepening already contains almost every part of pass 3–5:

| 25-B needs | Already exists |
|---|---|
| retrieve wide, sift by relevance | `deepening-sift.ts` — target ~100, keep with reasons, report the discard count |
| findings with provenance, accept/reject | `EvidenceItem` + the panel |
| the adversarial issues call | `deepening-adversarial.ts` — hostile committee clerk, structured output |
| issue triage: address / defer / dismiss-with-reason | `DeepeningIssue` + the panel |
| known unknowns as an invariant | the engine's per-run computation |
| passes as configuration | `deepening-config.ts` |

**They are the same mechanism with a different trigger** — the Deepening runs on request, the build
runs automatically. **Unify them: one evidence layer, one issues list, one sift, one adversarial
call.** Two systems doing the same job is how the drift we have twice fixed begins.

Practically: the build's pass 3 writes `EvidenceItem` rows exactly as a Deepening pass does, tagged
with the build version; the user can still re-run any individual pass later through the existing UI.
**Report what you reused and what genuinely needed to be new.**

## §3 — The interrogation library, as configuration

`lib/lex/interrogation-library.ts`, on the `deepening-config.ts` pattern: **adding a question is one
array entry, never a code change.** The check should assert that no question id appears outside the
config file.

Each entry: `{ id, question, kind: CORPUS | DOMAIN_TRANSFER, intents[], firesWhen, mustAnswer[],
panelHeading }`.

**Corpus questions** (§25.4) — `LEGAL_LANDSCAPE`, `CASE_INTERPRETATION`, `LINEAGE`, `PRECEDENT`,
`CAUSAL_EVIDENCE`, `CAUSE_SEEDING`, `EXISTING_POWER`, `DEVOLUTION_SCOPE`. Four of those intents are new
to Search and **may not be routed yet — a question whose intent is unavailable must render as a stated
gap, never as an absence of evidence.** Check the SEARCH_CONTRACT before assuming an intent works.

**Domain-transfer questions** — answered by reasoning plus web, **labelled as reasoning**, then the
follow-up corpus question asked: *has UK legislation ever used this shape?* The standing one, and the
highest-yield question we have:

> Who else has this problem, outside this sector, and what have they built to deal with it?

**Two rules that make the library honest.** `firesWhen` decides relevance from the draft — a question
about devolution does not fire on a reserved matter — and **a question that fires and finds nothing
produces a stated gap under its own panel heading.** "We looked for X and found nothing" is a result.

⚠ **`EXISTING_POWER` is the highest-value question in the set.** *Is there already a delegated power
that removes the need for primary legislation?* A yes can retire the entire legislative route. It
should fire on every idea whose drafted instrument is primary legislation.

## §4 — Pass 3: research what the draft revealed

Run the library against the pass-2 draft. Retrieve wide, sift, keep with reasons, report the discard
count — *"reviewed 104 sources; 12 bore on this."*

**The instrument question comes first** and can short-circuit the rest: if `EXISTING_POWER` finds a
live power, that finding leads everything and pass 4 must reconsider the instrument fork.

## §5 — Pass 4: revise, and keep the contradictions

The pass that justifies the whole iterative design. Rewrite the kernel in the light of pass 3 —
**particularly the causes, which were written before anyone knew what the actions would imply.**

- Re-check the chain: do these actions defeat this obstacle, which follows from these causes?
- Run the coherence check (concentration, sequencing, missing implementers).
- ⚠ **Where the revision contradicts pass 2, keep the contradiction and surface it.** *"I first
  concluded X; the evidence says Y; here is why I changed my mind."* That is a finding about the idea
  and it is one of the most useful things the build can produce. **Silently overwriting it destroys
  the only visible evidence that the research changed anything.**
- Forks recorded in pass 2 are revisited: a fork the evidence has now settled is marked resolved with
  the reason; a fork the evidence has *opened* is added.

## §6 — Pass 5: the adversarial read

Reuse `deepening-adversarial.ts` against the whole revised kernel, not one pass's findings. A hostile
committee clerk, reading it cold, with the findings attached: where is it weakest, what can it not
answer, what will it be asked that it has no answer to.

**Model choice is configurable per pass and this is the pass where it matters** — adversarial
reasoning is where model strength shows and Flash is the cheapest thing we run. Try at least one
stronger model here and report the difference in the findings, not in a score.

## §7 — Multi-model perspectives on the coverage passes

Charlie's case, and the four-model comparison is the evidence for it: asked the same question, four
models found substantially different things — a decision frame, an empirical case study, an official
review, the constitutional depth. **Ask one and you get roughly a quarter of the available material.**
It is also the direct mitigation for the risk that a user gets a better answer by typing the question
cold into their own chat.

**Where it applies: passes 1 and 3 only** — the coverage passes. **Not pass 2 or 4**: one voice drafts
better than four merged, and merging drafts produces exactly the mush we are trying to avoid.

Build it as a **`perspectives` config on those passes** — N calls, different framings and/or
providers — with a merge step that **deduplicates and explicitly preserves divergence**: a finding
only one perspective produced is the point of the exercise and must not be averaged away. Flag-gated,
single-perspective by default.

**Then run it once and report:** the same idea built single-perspective and multi-perspective, with
what the extra perspectives found that the first did not, and what it cost. Charlie judges whether the
coverage is worth the money. *(This one stays in Lex rather than transferring to Search: it is a
question about the quality of the findings, not about retrieval.)*

## §8 — Cost, progress, and honesty

- **Report the spend per build**, broken down by pass. 25-A cost about 4p; this will be a multiple of
  that and Charlie should see it before it becomes a habit.
- **Ceilings per pass**, not just per build, so one runaway question cannot consume the budget.
- **Progress must show what is happening**, not a spinner: the current pass, the question being asked,
  and findings appearing as they land. A ten-minute wait with no evidence of work is indistinguishable
  from a hang.
- **Every failure mode says which it is** — the search broke · the corpus is silent · we reviewed N
  sources and none bore on this. Three different findings about the world; the existing engine already
  distinguishes them and 25-B must not blur them.

## §9 — Acceptance criteria

- A build completes all five passes without hitting the 300-second ceiling, and an orphaned build
  resumes from its last completed pass rather than hanging or restarting.
- Pass 3 runs the library, sifts, reports reviewed/kept, and renders a stated gap for every question
  that fired and found nothing — **including any whose intent Search has not yet routed.**
- `EXISTING_POWER` fires on every primary-legislation draft, and a positive finding visibly changes
  the instrument fork.
- Pass 4 rewrites the causes, and **at least one contradiction between pass 2 and pass 4 is preserved
  and shown** on a test idea where the evidence genuinely disagrees with the first draft.
- Pass 5 produces issues against the whole kernel from an adversarial vantage, and the panel says
  whose reading they are.
- Adding a library question is one config entry — demonstrated, with the diff shape in the CHANGE_LOG.
- No second evidence layer, no second issues list, no second sift: the audit in §2 is reported.
- Multi-perspective runs once and is reported side by side with single, including cost.
- Spend per pass is recorded and shown.
- **Browser-verified, and delivery-verified** per the new CLAUDE.md section: a 25-B string read back
  off the running site before this is reported done.
