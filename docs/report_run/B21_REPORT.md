# CCW-B21 / B21a — the four tracks, run unsupervised

**From:** CC (Claude Code, Windows repo) · **To:** CCW · **9 September 2026**
Briefs: `CCW-B21_next_steps.md`, `CCW-B21a_run_unsupervised.md`

> **Three of the four tracks found that the brief's own premise was one layer above the fault.**
> That is not a complaint about the briefs — each premise was the honest reading of the symptom.
> It is the pattern, and it is worth naming: watch paths, a stale register, a "blank" panel row and
> a scaffolding leak were all reported at the layer where they were *visible*.

| | Track | Status |
|---|---|---|
| 1 | `build-worker` watch paths | ⚠ **Half done, and the other half is one action of Charlie's** |
| 2 | Position register re-run | ✅ Done — 8 of 12 single-name measures → 0 |
| 3 | Transcript corpus swept properly | ✅ Done — 87 hits → 2,764, and a finding about the corpus |
| 4 | The two product defects | ✅ 4a fixed; 4b's premise measured and the durable fix put in the producer |
| — | Critique on the other nine measures (B21a) | ✅ Done, read-only, with a control — **and a repeatability finding** |

---

## Track 1 — ⚠ the watch paths were the symptom. `build-worker` has no repo trigger at all.

Set `watchPatterns` to `scrutinise-web/lib/**`, `scripts/build-worker.ts`, `prisma/**` and the
package files, and read them back identical. **Then pushed a real change to a watched path and no
deployment appeared.**

**`repoTriggers` on `build-worker` is 0. Every other repo-backed service in the project has 1.**
So no push has ever reached the service; the empty watch list was irrelevant because there was
nothing arriving to be filtered.

> A `SKIPPED` deployment record is a trigger firing and the watch declining.
> **No record at all is no trigger.**

That is why build-worker was the only service with no deployment row per push while `fts-serve` and
`vector-serve` got a SKIPPED one each — and why its silence read as "nothing to do".

⚠ **The config read-back is not the test, and reporting track 1 done on it would have been the
guard-that-cannot-fail in its deployment-shaped form.** The test is a push to a watched path
followed by a deployment nobody triggered, and that has not happened.

⚠ **A project token cannot fix it.** `deploymentTriggerCreate` and
`serviceInstanceAutoDeployUpdate` both return `Bad Access`. `serviceInstanceUpdate` succeeded with
the same credential minutes earlier, so this is a specific permission boundary and not a dead token
— they need the account's GitHub linkage.

### ⚠ CHARLIE — ONE ACTION, AND IT IS THE WHOLE OF WHAT IS LEFT ON TRACK 1

**Railway → build-worker → Settings → Source → connect `Scrutinise/scrutinise-prototype` @ `Main`,
and enable auto-deploy.** The watch paths are already set, so it will rebuild only on the files the
worker actually runs. Until then the worker is deployed by hand with
`serviceInstanceDeployV2(serviceId, environmentId, commitSha)` — **and the sha read back**.

The §3 deploy rule is recorded in `CLAUDE.md` → Railway Operations, as asked, along with this.

---

## Track 2 — the register's own premise was the thing that had gone stale

| | before | after |
|---|---|---|
| Measures returning exactly one person | **8 of 12** | **0 of 12** |
| M-06 the civil service | 1 | **44** (1 tabled, 43 signed) |
| M-02 Equality Act | 1 | **11** (1 tabled, 10 signed) |
| M-11 sentencing guidelines | 1 | **189** |

⚠⚠ **The script said, in capitals, "`edm_signature` IS NOT A SIGNATURE … we hold no signatures",**
and its assessment repeated it in prose: *"an EDM target can therefore only ever return one name."*
Re-running it untouched would have regenerated a freshly-dated appendix asserting the opposite of
what the database now holds.

**Tabling and signing are told apart by `derivation`, not by `signal_type`** — both are still called
`edm_signature`:

| derivation | rows | act |
|---|---|---|
| `primary-sponsor:*` | 59,925 | the member who **tabled** it |
| `signatory:*` | 2,002,584 | a member who **signed** it |

A register printing one verb over both would have said every signatory tabled the motion. The verb
now comes from the derivation, an unrecognised derivation says so rather than inheriting "tabled",
and every measure reports the split.

**The assessment is now derived rather than written.** The old prose named four wrong-subject
collisions by hand; recomputing them found the same ones — M-06 and M-08 both resolve to *Civil
Service pensions* on the two words "civil service" — so the prose was right and is now incapable of
going stale. It also found what the prose could not: **9 of 10 resolved targets were matched on two
content words or fewer.**

⚠ The display cap is now load-bearing and says so: M-01 matches 254 people and the table shows 40.
Before the load an EDM target returned one actor and the cap never bit.

Both things you asked to be said, are said: **signing a motion is not agreement** — a member may
sign to have it debated, for one clause, or as a courtesy — and it **remains a candidate list
requiring confirmation**.

**The conclusion does not change, and the reason is worth keeping: the load fixes the VOLUME and not
WHICH MOTION the measure resolved to, and the second is what decides whether the names mean
anything.**

---

## Track 3 — `WHAT_DAVID_SAID.md`, and a finding about the corpus rather than about him

| | before | after |
|---|---|---|
| Videos searched | 8 | **285** |
| Videos with a hit | 8 | **254** |
| Search terms | 22 general | **102, built from the twelve measures** |
| Hits | 87 | **2,764 occurrences** |

Grouped by measure, in date order, each with the date, the video title, the passage and a link that
starts playing at the right second — the shape you asked for, and the JSON keeps `measure`, `text`,
`title`, `published_on`, `start_s`, `match_url`.

### ⚠⚠ 98.7% of it has never been cross-checked, and marking only the divergences would have hidden that

You asked that where the two transcripts diverge the passage be marked rather than resolved. Done —
and it would have been a guard that cannot fail, because **there is almost never a second
transcript**:

| | occurrences | share |
|---|---|---|
| Two transcripts, agreeing | 34 | 1.2% |
| Two transcripts, **disagreeing** 🔀 | 2 | 0.1% |
| **NOT CROSS-CHECKED** — one only | **2,728** | **98.7%** |

**3 videos of 285 hold two transcripts.** By passage: `asr` 6,126, `turboscribe` 29, `human` 2.

An unmarked entry would have read as "two engines agreed" when in 2,728 cases there was no second
engine. **Absence of a disagreement is not agreement.** Every entry now states its status in words,
and the 98.7% is a table near the top rather than a footnote.

That is sufficient for *finding* what he said and where. It is not sufficient for *printing* a
quotation — "Israeli" for "Disraeli" is exactly what one machine transcript does. **The timestamped
link on every entry exists to make listening a click rather than a search.**

⚠ Two more traps handled: an occurrence is a **moment, not a transcript row** (4,003 raw hits
collapse to 2,764), and the windows are **not chained** — grouping any two overlapping passages
transitively walks a whole video into one occurrence.

⚠ **10 of the 102 terms found nothing and they are listed.** `the yookay` is one of them: it is in
the title of thesis Part 2 and appears in no transcript, which is a fact about how the captions
render it rather than about what he says.

---

## Track 4 — both defects, and neither was where it was reported

### 4a — "Key sources" was never blank. The exporter printed the four columns the row does not have.

**Every one of the twelve has a real reading list**, naming documents: the Scotland Act's
entrenchment of the HRA, the Good Friday Agreement as the hardest obstacle, the Joint Committee on
Human Rights *against* repeal, the Public Administration Committee on arm's-length bodies, *For
Women Scotland v Scottish Ministers*.

What is null on those rows is `citation`, `url` and `siftReason` — **deliberately**.
`recordPrognosis` sets them null because the row is Lex's reasoning over the whole proposal, and
attaching a citation to a judgement would be the never-claim breach the rest of the build refuses.

The exporter printed **Source | Citation | Standing | Why it matters** — exactly the four fields
such a row does not have. The one field carrying its entire value, `body`, was not printed, and
`PanelEntry.body` has been populated since 25-Z §1. **Seventh instance of correct data discarded at
a seam.**

Fixed: the body prints beneath the table for rows whose value *is* the body — no citation, no URL,
body not already the "why" — so a row with a real citation keeps the compact table it had.
`RESEARCH_PANEL_all.md` goes 2,202 → 3,091 lines.

⚠ **Charlie's four-slot redesign is NOT built.** It needs a producer, not a renderer fix: the
provision from the citator, David's passage from track 3, and a strongest-case-for and
strongest-case-against document each. Track 3 has just made slot 2 possible for the first time.
**Say whether you want it as a report-side export (safe, and I can do it) or as a change to the
build pass (changes what the product shows every user).**

### 4b — the premise, measured

| | |
|---|---|
| `EvidenceItem` bodies containing `[FINDING]`/`[CONTRADICTS]` | **0** |
| `DeepeningIssue` texts containing them | **0** of 764 |
| `carry` strings across the twelve exports | 120 |
| …of which contain those markers | **12** |

**No scaffolding has reached a report heading through the database.** And most carry strings are not
"instructions addressed to the model" — the ORIENT, DIAGNOSIS and APPROACH carries are ordinary
prose. There is also **no Lex-side renderer that turns a build export into report markdown**:
`b14-export.ts` writes JSON and nothing in `scrutinise-web` renders it. The mapping happens in the
report build, whose own `_pass_detruncate.py` already filters by provenance path — and that file is
yours, so I have not touched it.

**So the durable fix went in the producer, which is ours.** The export now *declares* which of its
paths are the proposal's own content and which are scaffolding, with the marker counts measured on
each export rather than asserted. A consumer restating that rule in a hardcoded path list is the
shape that goes stale the first time a pass is added — `_pass_detruncate.py` can read `provenance`
instead of carrying `CONTENT`.

⚠ `--out <dir>` added so the change could be proved without overwriting the twelve files you are
writing from. **The committed exports are untouched** and will carry the block when you next
regenerate them.

---

## B21a — the critique on the other nine, and ⚠⚠ a repeatability finding

`docs/report_run/critique/B21_KERNEL_LOGIC_ALL_TWELVE.md`. **Nothing was written to the database and
no build was run**, so no allowance was spent and nothing you are drafting from moved.

`KERNEL_CHECK` and `LOGIC_CHECK` take a kernel string and a model, so they need neither a build nor
a database write. The pass in the product also writes `DeepeningIssue` rows against a run version;
you are building Appendix B out of those rows, so the harness deliberately does not touch them
(B21a §5).

**The control, and it is the point.** M-01, M-02 and M-06 already had these passes run on a complete
kernel by a real build. The prompt size is deterministic given the same kernel, so a match proves
the harness feeds the marker what a build feeds it. **M-02 and M-06 reproduced their build token
counts exactly (3,549 and 3,332); M-01 was +39 on a kernel that has moved slightly since.**

### ⚠⚠ `KERNEL_CHECK` is stable to one test. `LOGIC_CHECK` flipped on an unchanged kernel.

Four readings of kernels that did not change between them — one build and three harness runs. The
prompt token counts are identical across them, so these are readings of the same input:

| Measure | build | run 1 | run 2 | run 3 |
|---|---|---|---|---|
| M-01 kernel | 8 of 9 | 8 of 9 | 8 of 9 | 8 of 9 |
| **M-01 logic** | holds, 0 | **⚠ does NOT hold, 2** | holds, 0 | holds, 0 |
| M-02 kernel | 8 of 9 | 8 of 9 | **9 of 9** | 8 of 9 |
| M-02 logic | holds, 0 | holds, 0 | holds, 0 | holds, 0 |
| M-06 kernel | 6 of 9 | 6 of 9 | 6 of 9 | 6 of 9 |
| M-06 logic | ⚠ fails, **4** | ⚠ fails, **3** | ⚠ fails, **3** | ⚠ fails, **3** |

And across the two full runs of the other nine: **M-07's kernel moved 6 of 9 → 7 of 9** and
**M-03's defect count moved 1 → 2**; the other seven were identical on both.

**Stated precisely, because the difference matters to how the report uses it:**

- **`KERNEL_CHECK` never moved by more than one test out of nine**, on any measure, on any reading.
  A score is safe to quote, with the caveat that ±1 is noise.
- **`LOGIC_CHECK`'s direction flipped once in four readings on M-01** — *holds* → *does not hold* →
  *holds* → *holds*. Once in four is not "unstable every time"; it is enough that **a single
  verdict cannot be quoted as a property of the kernel.**
- **Defect counts are not measurements at all.** M-06 has gone 4, 3, 3, 3 while never changing its
  direction; M-03 went 1 → 2.

⚠⚠ **CCW-B21 says the claim that the system argues against itself rests on `LOGIC_CHECK`.** What
survives this evidence is the *direction*, and only where it is consistent — M-06 says the chain
fails on all four readings, and that is worth reporting. **"The chain does not hold, with N defects"
quoted from one run is not**, and M-01 is the counter-example: on the build run it said the chain
holds with 0 defects, and one reading later it said the opposite.

**If the report needs the claim, run the pass several times per measure and print the spread.**
The harness does this for a few pence and writes nothing.

⚠ **`ADVERSARIAL` and `SMART` were not run standalone.** `SMART` rewrites the kernel through
`setProposal` and those rewrites are now visible to every marker after it, so a real one would
change the twelve measures while you are writing from them; `ADVERSARIAL`'s prompt is assembled from
the build's own carried state, so running it outside a build means restating a prompt rather than
importing one. Both would be sound with one `export` on `runOnePass` and a shared context builder —
a change to `build.ts`, the file every build runs through, which is not something to make
unsupervised on the strength of an export.

---

## Held back, as instructed

- **The build-row lease** — untouched. It needs a schema column on production.
- **Nothing in `report_src_v2/`** was edited. The three RESTORATION PDFs are still uncommitted from
  B20 and still your call.

## What is Charlie's or yours

1. **Railway → build-worker → connect the repo.** One action; it is the whole of track 1's remainder.
2. **The four-slot "Key sources" redesign** — report-side export, or a change to the build pass?
3. **Whether the report should rest anything on a single `LOGIC_CHECK` verdict.** On the evidence
   above, I do not think it can.
