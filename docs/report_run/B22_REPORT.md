# CCW-B22 — the remaining work

**From:** CC · **To:** CCW · **10 September 2026**
Brief: `CCW-B22_remaining_work.md`, run under CCW-B21a's autonomy boundaries.

| § | | Status |
|---|---|---|
| 1 | The four tests on the other nine | ✅ **All twelve, one file each — and the chain verdict flips on three** |
| 2 | Legislation and judgments schedule | ✅ Built — ⚠ **seven measures cannot be linked, and that is the finding** |
| 3 | Railway — Charlie's action | ⚠ **Still outstanding. `repoTriggers` is still 0.** |
| 4 | Go looking for the eighth seam | ✅ A register that runs — and it caught my own false positive first |
| 5 | The sweep holds everything in memory | ✅ Fixed, and the output is byte-identical |
| 6 | The cost route | ❌ **Not built.** Design note written, gap measured, brief's figure corrected |
| 7 | The idea that should change the product | ✅ **Built, shipped, and it terminates on the row** |

---

## §1 — the four tests, all twelve, with the spread

Twelve files, `critique/B22_CRITIQUE_M-XX.md`, one per measure so you can place each beside its own
measure. Plus `B22_ALTERNATIVES.md` and `B22_FOUR_TESTS_INDEX.md`.

**The B21 finding generalises, and it is worse than three measures could show.** At two readings
each, on kernels that did not change between readings:

| | |
|---|---|
| `KERNEL_CHECK` moved at all | **4 of 12** — M-01, M-03, M-07, M-10. Never by more than one test of nine. |
| `LOGIC_CHECK` verdict **flipped** | **3 of 12** — M-02, M-04, M-05 |

⚠ **Two readings is a floor, not a measurement.** Three flipping out of twelve on a single pair is
consistent with a verdict that flips well under half the time — so the true rate is *higher* than
3 in 12, not lower. **M-03 is the proof:** it flipped on the pilot pair and held on the run pair.
That makes four of twelve demonstrably unstable and **none of them stable-by-demonstration**.

**So: a `KERNEL_CHECK` score is quotable, with ±1 as noise. A `LOGIC_CHECK` verdict quoted from one
run is not.** Where the direction is consistent across readings — M-06, M-07 and M-09 fail on both —
that is reportable, and it is the form the claim should take.

### What is re-run and what is carried

| | |
|---|---|
| `KERNEL_CHECK`, `LOGIC_CHECK` | Re-run twice. They take a kernel string and a model. |
| `ADVERSARIAL` | Re-run once, read-only, and **faithfully** — its prompt is assembled from the build's own stored carry, read off the pass log rather than re-derived. `costLinesFor` exported (one word, no behaviour change), `testimonyForPrompt` imported. Nothing about the prompt is retyped. |
| `SMART` | **Not re-run — a policy limit, not a capability one.** It calls `setProposal` on up to five kernel fields, and since the B18 fix those rewrites reach every marker after it. Running it would change the twelve measures while you are writing from them (B21a §5). Its build output is carried verbatim and labelled with which code path produced it. |

**Nothing wrote to the database and no build ran**, so no allowance was spent and the
`DeepeningIssue` rows you are building Appendix B from are untouched.

---

## §2 — ⚠⚠ the schedule is built, and the brief's route is not available

`docs/report_run/appendices/LEGISLATION_AND_JUDGMENTS.md`, 1.9 MB.

**"Link the other eleven and run it across all twelve" — neither half is available as written.**

**The pass was never the gap.** Five measures are already linked and the consequences pass has
already run on all five, 8 rows each. What had never been built is the appendix.

**And seven cannot be linked.** That is B18 §4's deliberate refusal, not an omission: judicial review
is a common law jurisdiction with no Act conferring it; gender self-identification was never enacted;
the arm's-length body estate is ~400 unnamed bodies; the Great Repeal's scope is temporal; the civil
service candidate is either an 1854 settlement that is not an enactment or the 2010 Act that codified
it, and choosing is Charlie's. **Linking them means naming an instrument David did not name.** The
schedule prints each refusal with its reason — a stronger row in a schedule than a guessed citation —
and says explicitly that it does *not* mean the measure touches no legislation.

### ⚠⚠ Rows are not instruments, and the brief is what caught it

The first version printed **212** under the word "instruments" for the Constitutional Reform Act
where the instrument count is **120**. One instrument carries several enabling references. It
surfaced only because your brief quotes 120 — a reader would otherwise have been handed a document
that was internally consistent and wrong. Both counts are now printed and labelled:

> **120 instruments identified as made under the Act**, from 212 enabling references. A further
> **278 documents** refer to it from inside a provision (840 references), and **42** in a title or
> preamble only (81 references).
>
> ⚠ **223 statutory instruments reference this Act in total; the enacting words of 103 of them do
> not name it.** Those 103 mention the Act without being made under it, so a repeal does not carry
> them with it.

⚠ I then walked into the same trap one line below fixing it: `nisr/2010/381` carries four rows and
printed as "4 confirmed misattributions", listing one instrument four times. Deduped.

### ⚠ And GitHub found a defect before I did

Push protection rejected the commit: a legislation.gov.uk XML attribute, `CommentaryRef="key-<32
hex>"`, has the shape of a Mailgun API key. **A false positive as a secret and a true positive as a
defect** — the column headed *"the words in the source"* was printing markup, a stray tag remnant and
a truncated sentence. `cleanCitationText` is now imported (the product's own cleaner, not a new one),
which strips attributes, tags and bare URIs and returns null below forty characters. A row that does
not survive that floor still counts; it simply cannot be quoted, and the cell says so.

⚠ **The brief asks for the court and there is no court column**, because the evidence rows have no
court field. Inferring one from a case name would be a manufactured value.

---

## §3 — Railway, still outstanding

**`repoTriggers` on `build-worker` is still 0.** I re-checked. `deploymentTriggerCreate` and
`serviceInstanceAutoDeployUpdate` both return `Bad Access` to a project token while
`serviceInstanceUpdate` succeeds with the same credential, so it is a permission boundary and not a
dead token.

**Railway → build-worker → Settings → Source → connect the repo.** The watch paths are already set.
Until then the worker is deployed by hand with `serviceInstanceDeployV2(..., commitSha)` — **and the
sha read back**.

---

## §4 — a register that goes looking, and its first finding was mine

`docs/report_run/SEAM_REGISTER.md`, regenerated by `b22-seam-sweep.ts`.

Nine claims are named, each with the query that answers the same question and a line saying *why* it
is the same question:

| | |
|---|---|
| **3 moved** | EDM sponsorships 60,995 → 59,925 · signatories published 2,125,547 → 2,126,171 · Starkey passages 6,138 → 6,157 |
| **6 hold** | including the 16,196 extracted positions and the 15,937 that round-trip |

All three moves are small and **none is a seam of the severity of the seven**. The value is that the
register now exists, so the next one is found by running a script rather than by re-running an
appendix and noticing.

⚠⚠ **Its first finding was my own false positive.** The first version counted all `graph_position`
rows and reported *"16,196 → 37,657, MOVED"*. Wrong: 21,461 of those record `no-position`, and the
sentence is about positions that record *a* position. A false alarm in a register whose whole value
is that it is not one — arriving one paragraph after I wrote the header warning that a human has to
decide what each claim asserts. Fixed, and the mistake is recorded beside the query.

That correction produced a check worth keeping: `positions-never-round-tripped` asks whether the
98.4% is computed over a population that silently excludes rows the check never ran on. **It is 0**,
so the denominator is sound — now asserted rather than assumed.

The text sweep also lists **675 numeric claims** in comments and strings for triage, ranked by file.

---

## §5 — the sweep, and the test is that the output did not move

Collapsed per measure instead of holding all 4,003 hits. **It is safe to collapse early because of
what it groups by:** a hit only ever joins a bucket of the same measure and the same video, and the
loop is measure-outer, so once a measure's last term has run nothing that could join its buckets is
still to come. Peak is now one measure's hits (largest: M-12 at 617).

Also fixed one layer down: `[...(prev ?? []), h]` rebuilt the whole array on every hit — quadratic in
bucket size.

| | before | after |
|---|---|---|
| occurrences | 2,764 | **2,764** |
| identical as sets / in order | — | **True / True** |
| raw hits | 4,003 | **4,003** |

The only diff in the appendix is its own generated-at line. ⚠ **Not the whole problem, and the
comment says so**: the occurrences are still all held, because the header counts them before the body
prints them.

---

## §6 — ❌ the cost route is not built

`docs/COST_MODULE_DESIGN_NOTE.md` records Charlie's decision and measures the gap.

⚠ **The brief's figure is corrected in two small ways that change where to start:**

| | brief | measured |
|---|---|---|
| coherent actions carrying a cost range | 0 of 119 | **1 of 135** |
| `CostBenchmark` rows | — | **53** |

The "1" means the write path has executed at least once and is **demonstrably reachable** — a
different starting point from a path that has never run. And **53 cost benchmarks already exist**:
the reference data a costing would be built against is in the database and unused, which is the
opposite of the conclusion "0 of 119" invites.

Charlie's constraint is recorded verbatim: **do not rename the module to anything promising a
cost-benefit analysis while it attempts only the money.** A heading is a claim; keep it behind the
capability.

---

## §7 — ⚠⚠ built, shipped, and it terminates on the row

> **"Identifying things that need their own idea-project is a valid output from an idea. It's not an
> ever-flowing hierarchy."**

**Schema and migration shipped together and first** (`cdc8fc57`), applied to Neon and read back off
`information_schema` and `pg_constraint` rather than assumed from a mutation that returned without
error: five nullable columns, the FK's delete rule (`SET NULL`, confirmed `confdeltype = 'n'`), and
the partial index.

**⚠ `SET NULL`, not `CASCADE`.** A spawned idea is independent work, not a detail of its parent.
Deleting the parent must leave the question standing — orphaned and visible — rather than silently
deleting a work item somebody may have picked up.

### It terminates, and the guard was watched refusing

Two mechanisms, neither of them an instruction to a model:

1. **`refuseToSpawn()` refuses any row with `spawnedFromIdeaId` set.** Depth is capped at one *by the
   row*. A prompt saying "do not go deeper" is not a cap; a row that cannot be a parent is.
2. **A spawned idea is created and not built.** Nothing enqueues it.

Run on M-01, both proven:

```
→ 3 created, 0 already existed
termination: ✔ asked `Defining the state's duty to investigate deaths after HRA repeal`
             to spawn and it refused: "this idea was itself spawned from another…"
```

Verified in the database: all three at `STAGE_1`, `DRAFT`, `PRIVATE`, `summaryDescription: ""`, and
**0 builds**. ⚠ The empty summary is load-bearing: Stage 1→2 fires automatically when title *and*
`summaryDescription` are both non-empty, so writing a summary would promote every spawned idea out of
stage 1 — the opposite of "named and queued".

### ⚠⚠ And the pass is not deterministic, which mattered more than it looked

Run three times on the same kernel it named four questions, then three different ones, then four
different ones again. **Idempotency by title cannot hold when the titles change between runs** — so
re-running would have grown the queue for ever, one plausible new item at a time, and every addition
would have looked like a finding.

`writeSpawns` now refuses a parent that already has children unless `extendExisting` is passed.
Watched refusing; the queue held at 3.

> **A work programme that silently lengthens every time somebody re-runs a pass is not a work
> programme.**

⚠ **This is a real limitation to record, not just a guard.** The pass names *a* set of questions, not
*the* set. For M-01 the sets overlap heavily in substance — the devolution settlements, the Good
Friday Agreement, the status of HRA case law recur — but the titles and framings differ each time.
**Treat the queue as a starting point somebody edits, not as an answer.**

---

## Still parked

**The build-row lease.** Untouched, as instructed. ⚠ Note that §7's schema change has now been made
on production, so the next schema ships into a tree where one has just landed cleanly.

## What is Charlie's or yours

1. **Railway → build-worker → connect the repo.** Unchanged from B21; one action.
2. **Whether to spawn the other eleven measures.** They are proposed in `SPAWNED_IDEAS.md` and
   **nothing was written for them** — M-01 alone was written, as the worked example. Say the word and
   the rest go in.
3. **Whether the report rests anything on a single `LOGIC_CHECK` verdict.** On twelve measures the
   answer is firmer than it was on three: it should not.
4. **The cost route** — a producer, and only then the heading.
