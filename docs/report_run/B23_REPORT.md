# CCW-B22, continued — the prepared opponent, the cost route, and Railway closed

**From:** CC · **To:** CCW · **10 September 2026**

| | Status |
|---|---|
| Railway | ✅ **Closed. Verified by a deployment appearing that nobody triggered.** |
| §1 addendum — the prepared opponent | ✅ **Built and run on twelve. The plan fully closes NONE of 49 routes.** |
| §6 — the cost route | ✅ **Built and run on twelve** (was a design note only) |
| §1, §2, §4, §5, §7 | ✅ Delivered earlier today; unchanged and verified still in place |

---

## Railway — closed, and the last switch was invisible

**It took three things, and only the first is readable as a value:**

| | | how it reads when wrong |
|---|---|---|
| 1 | `watchPatterns` | readable — was `[]` |
| 2 | a repo trigger | `repoTriggers` = 0 where every sibling had 1 |
| 3 | **auto-deploy enabled** | ⚠⚠ **`repoTriggers` reads 1 and nothing happens** |

⚠ **Step 3 is the trap and it is worth keeping.** After the repository was connected, `repoTriggers`
read `1` — identical to every healthy sibling — while a push to `prisma/schema.prisma`, a watched
path, still produced no deployment. **A service with a trigger and auto-deploy off is
indistinguishable, through this API, from one that works.**

**The proof, in order:** `abf125c5` pushed at 14:08 → deployment `1dda5512` appeared unprompted at
14:08:49 carrying `meta.commitHash = abf125c56194` → SUCCESS → the container printed
`retrieval configuration OK — …` at 14:13, a string a container built before 9 September cannot
produce. Sha first, then the string only the new build can emit. Never the status, never the id.

Recorded in `CLAUDE.md` → Railway Operations.

---

## §1 addendum — the opponent is not a sceptic

`lib/lex/adversarial-prepared.ts`, twelve exports at `critique/B23_OPPONENT_M-XX.md`.

The reviewer is now a specialist in public law, instructed **against** the proposal, holding a
position already settled. The question is not whether the proposal will annoy anyone; it is where a
first-rate lawyer would attack, and **whether the plan closes that route.**

**⚠⚠ The attack that works is almost never a refusal. It is a reading.** A court does not decline to
apply an Act; it construes it. So the mechanisms are enumerated and named — `NARROW_READING`,
`ALTERNATIVE_SOURCE`, `ENTRENCHED_ELSEWHERE`, `PROCEDURAL_SURVIVAL`, `DISAPPLICATION` — and *"this
will be unpopular"* is explicitly refused as a route.

### The result

| verdict | routes |
|---|---|
| ✔ the plan **closes** it | **0** |
| ◐ partly closed | 5 |
| ⚠ the plan does **not** close it | 33 |
| ⚠⚠ the plan **makes it worse** | **11** |
| **total** | **49** |

**The plan fully closes none of the forty-nine.** Five are partly closed, and eleven are made
*worse* by the proposal as drafted — a repeal that hands its opponent a stronger and less
constrained substitute than the thing repealed.

⚠ **I nearly published "closes 5 of 49".** That was my own softening: five are `PARTLY`, and
counting a partial closure as a closure is precisely the rounding this project has spent three
sprints catching in other people's numbers. Zero and five-partly are different claims.

Seven measures have **every** route left open: M-02, M-03, M-04, M-09, M-10, M-11, M-12.

That is a different kind of finding from the old pass's process objections, and it is the one a
proposer needs before anyone else tells them.

### ⚠⚠ The doctrinal context was withheld on the first arm, deliberately

The finding behind the change is that since 2013 the senior judiciary has been relocating rights
protection onto the common law — Osborn, Kennedy, A v BBC, UNISON — so repeal does not restore 1997
because the courts have spent a decade ensuring it would not. **Handing the pass that paragraph
would have told it the answer and proved nothing.**

So `doctrinalContext` is optional, off by default, and labelled in the prompt as context it was
*given* rather than found.

| arm | result |
|---|---|
| **A — unhinted, persona only** | **Found it.** On M-01 it named *UNISON* [2017] UKSC 51 in its own reasoning and rated the common-law substitution **`MAKES_IT_WORSE`** |
| **B — hinted** | The **same four routes**: common-law substitution, devolution entrenchment, treaty obligations, narrow construction |

**The reframing is doing the work, not the hint.** A pass that only finds the answer when handed the
answer is not finding it, and this is the arm that could have said so either way.

### The sharpest thing it said, unprompted

> By removing the text of the ECHR, which contains explicit limitations and qualifications on rights,
> the plan creates a vacuum. Courts will be invited to fill it by identifying 'fundamental rights' in
> the common law. These are not constrained by the Convention's text, margin of appreciation, or
> established jurisprudence — **potentially giving judges more, not less, power.**

That is the prepared defence, described from the inside, by a pass that was not told about it.

⚠ **Two limitations, in the output rather than only here.** Every `restsOn` citation needs checking
before it is quoted — the prompt asks the pass to name a doctrine rather than invent a citation, and
that is an instruction, not a guarantee. And the pass is not deterministic: two unhinted runs of M-01
gave the same four routes with different wording and one different closure verdict.

---

## §6 — the cost route, built

`lib/lex/cost-route.ts`, output at `appendices/COSTS.md`. Was a design note only; it is now a
producer that has run.

**Three rules decide its shape:**

1. **A range, never a point.** A single number on a policy nobody has implemented is false precision,
   and it is the number that gets quoted.
2. **No line without a basis.** `basis` is nullable in the schema and required here. A line whose
   basis the model could not state is **dropped, and the drop is listed** — a silently shorter table
   reads as a cheaper policy.
3. **A benchmark is cited or absent, never implied.** Where a figure rests on one of the 53
   `CostBenchmark` rows, `benchmarkId` records which; a cited benchmark that does not exist is
   rejected as a fabricated source. **A Green Book unit cost and a plausible guess look identical
   once both are numbers in a table.**

### ⚠ Two things the first real run showed that the design did not anticipate

**68 cost lines across twelve measures, 0 dropped, 11 actions declined.** 48 lines cite a benchmark;
20 are reasoned and say so.

1. ⚠⚠ **I nearly published that `FRICTION` was never used.** That came from a one-measure pilot and
   was wrong — across twelve the split is `IMPLEMENTATION` **58**, `FRICTION` **6**, `ENFORCEMENT`
   **4**. Generalising a pass's behaviour from one measure is the same error as quoting one
   `LOGIC_CHECK` verdict. **The real finding is the imbalance:** 85% of lines are the cost of *doing*
   the thing, and compliance cost is six lines across the whole programme.
2. **The actions list carries duplicates across build versions.** M-01 has 16 coherent actions and
   twelve were identified as duplicates of four — *"draft and introduce a Bill"* under three
   near-identical wordings from three builds. **Any count of "actions" in the report counts build
   revisions, not distinct work**, and that is a defect one layer above the costing.
3. ⚠⚠ **The pass is not deterministic, and visibly so.** The same M-01 actions gave **4 lines with 12
   declined** on the pilot and **13 lines with 3 declined** on the full run. Same input, same prompt,
   same model. Neither run is wrong — what moves is *how much of the proposal is judged costable*,
   which is a far less comfortable instability than a number moving inside a range. **A costing
   quoted from one run states an arbitrary fraction of the work.**

### ⚠⚠ And I corrected my own design note

It said `COST_DURATION` should join `headingsWithProducers()` once a producer existed. **Building the
route showed that was wrong.** That function asserts *a producer exists for that heading*, and the
panel feeds `COST_DURATION` from `EvidenceItem` rows carrying that heading — of which there are still
**0**. The route writes `CostLine` rows against actions: a different surface, the proposal document
rather than the question panel.

Adding it would flip the heading from *"our gap, in amber"* to *"we asked and found nothing"* — a
false statement about the world made to cover a hole in our tooling, which is exactly what the note
in `heading-map.ts` exists to prevent. **It stays out**, and the open question is now named: should
the costing appear in the panel at all? If so, something must write evidence rows there, and this
route does not.

**The heading constraint is unchanged and now enforced in code:** `costKindOf()` returns
`FINANCIAL_ONLY` and the appendix prints the caveat above its first table. Do not rename the module
to promise a cost-benefit analysis while it attempts only the money.

---

## What is yours

1. **Whether to write the costings.** They are proposed for all twelve; nothing was written to the
   database except where noted. Same pattern as the spawned ideas.
2. **Whether the report should use the 5-of-49 figure.** It is the sharpest single number this
   exercise has produced about the programme's readiness, and it rests on a pass that is not
   deterministic — so it should be run more than once before it is printed, exactly as with
   `LOGIC_CHECK`.
3. **The duplicate-actions defect.** It is upstream of the costing and it affects any count of
   actions in the report.
