# Sprint 25-I — pilot readiness

**2026-08-27. Brief: `docs/BRIEF_25I.md`.**

---

## The short version

The brief asked me to verify things on the live site before changing them. That instruction
is what made this sprint worth running: **three of the six sections found something different
from what the brief — or 25-H — believed, and two of those were defects that only appear when
something actually runs.**

1. **`IdeaUserMaterial` had zero rows in the entire production database.** The document
   pipeline 25-H reported shipped had never once been used. Driving it found it was throwing
   away **73% of what it read**.
2. **The reuse carry destroyed the research it reused.** One aborted re-run left **69
   evidence rows stranded on a cancelled build** and killed the next build with *"the
   research pass produced nothing to revise against"*. Restored, and fixed.
3. **The stale-answer banner was quoting the wrong price on the live site**, telling Charlie
   a re-run would search from scratch when reuse was available.

§5's build ran, failed on (2) at 1.4p, and produced one of the four measurements. **The other
three need a second build, which is spend beyond the brief's ceiling — so that is the one
thing I have stopped for.** Everything else is done.

---

## §1 — Loading a page created an idea

**Cause.** `BuildIdeaClient`'s boot effect POSTed `/api/ideas` on mount whenever there was no
`ideaId`. It was not recording intent — it had no way to draw the first question without a
row to draw it from, so it made one.

⚠ **25-E's resume made this less visible without fixing it.** A returning user with an
unfinished elicitation reopens that row, so minting only happened to someone whose rows were
all empty or all built — which is to say it kept happening and stopped being obvious.
*Resume is not creation control.*

**Fix.** `blankElicitationState()` projects the first question from a blank row and writes
nothing — **through the same `projectState` the real one uses**, so the pre-creation view
cannot drift from the post-creation view. The idea is created by `ensureIdea()` on the first
answer, and `post()` is the only caller, so there is exactly one path.

⚠ Two things that had to survive the move: the id is held in a **ref**, because
`setIdeaId` would not have updated in time for the very next line and the first answer would
have been dropped; and the **URL is still written the moment the id exists**, which is
25-E's fix for a refresh orphaning what the user just wrote.

⚠ **The old door had the identical defect** and would have refilled the bucket. `/ideas/create`
is no longer a creation entry — since 25-G it is the proposal, always reached with an
`ideaId` — so arriving bare now goes to whatever the current door is. The redirect tests the
**resolved path**, not the flag: if the door is ever flipped back to `create`, redirecting
would loop for ever.

**The sweep.** 27 drafts, soft-deleted, **each re-read individually after the write**.

| | |
|---|---|
| live ideas before | 95 |
| candidates | 27 |
| kept despite a blank elicitation | 12 — they have non-EMPTY proposal fields, i.e. real work typed straight into the panel |
| soft-deleted and verified | 27 |
| survived | 0 |
| live ideas after | **68** (expected 68 ✓) |

They include a **three-in-eight-seconds cluster on 19 Aug** — the refresh-minting signature —
and the one I created myself yesterday while testing the browser.

⚠ **Soft, not hard, and deliberately.** `deletedAt` is what every list on the site filters
on, so this achieves the whole of §1's purpose at once. What it does not do is destroy 27
production rows and their cascades on the strength of a heuristic I wrote this morning. One
`UPDATE` reverses it; the script prints the exact statement. `--hard` is there for when
you are satisfied the list is right.

---

## §2 — Document upload

**Verified live first, as asked.** The control is real: a genuine `<input type="file">`,
`FormData` to `/api/ideas/[id]/material`, links as well as files, extraction to text with the
binary never stored, a per-document delete. On screen it reads *"PDF, Word, text or a web
page — up to 10MB… We keep the text, never the file."*

⚠⚠ **And it had never been used. `IdeaUserMaterial`: zero rows, whole database.** So I drove
it with your own document — *How is accountability measured and achieved anywhere.docx*,
40,877 bytes.

It worked. It also **dropped 11 of the 15 findings it produced**, reporting
*"the quote could not be found in the document"*.

**Ten of those eleven quotes were in the document.** The eleventh shows the mechanism:

```
document : …advantage over government there are imperfect but ultimately fair…
model    : …advantage over government. there
```

The model added a full stop. `quoteIsInText` is **all-or-nothing over the whole passage**, so
one tidied character at position 200 of a 300-character quote discarded the entire finding —
and told you your document had produced nothing, which reads as *the document was useless*
rather than *our comparison is brittle*. The same shape as the "fabrication rate" that turned
out to be our own undecoded HTML entities.

**The fix makes provenance stronger rather than looser.** Matching on the first few words, or
on a similarity score, would let a reconstruction through — the thing the check exists to
stop. Instead `verbatimSpan` finds the longest prefix of the model's quote that really is in
the document and returns **the document's own words for that span**. The model's string is
never stored. A stored quote is now verbatim *by construction* rather than by having passed a
test, and the floor rose from 20 characters to 60.

| | before | after |
|---|---|---|
| findings offered | 15 | 15 |
| **stored** | **4** | **8** |
| dropped | 11 | 7 |

All 11 previously-rejected quotes now anchor, every returned span is a literal substring of
the document, and four negative controls (invented outright; real opening reworded at word 5;
a ten-character phrase; a real phrase under the 60-char floor) are all still refused.

**Your document is now attached to your idea with 8 findings**, filed under the questions they
answer (`LAW_NOW`, `ELSEWHERE`, `TRIED_BEFORE`, `ARGUED`) and badged `USER_DOCUMENT`.

### The finding I nearly reported that was mine

The reconciliation printed *"reported 8 · stored 12 ✗ MISMATCH"*. Four findings from my
first run were orphaned — material deleted, findings left behind. I was one step from
reporting that as a product defect. **The route deletes them in a transaction; my harness
did not.** That is 25-H's lesson landing again: *a verification artefact that isn't a
faithful copy produces findings about itself* — and a cleanup path has to be as faithful as
the path under test, because its damage lands in the same table. Harness fixed, orphans
removed and re-read.

---

## §3 — The walk

Signed in, on production, by text extraction. **Everything 25-H built survived**, verified on
the running site:

- the five pills with edit affordances, and the stale-answer banner
- *"Everything above is mine until you've been through it"*
- `CUTS AGAINST THE DRAFT`, `WHERE I CHANGED MY MIND`, `WHAT I'M LEAST SURE ABOUT`
- the surface switch: *"You're looking at the build. The proposal — 19 fields, 39 decisions waiting"*
- the reuse offer naming what it reuses

**Three things the walk found that no check would have:**

1. ⚠ **The stale banner was quoting the wrong price.** It said *"the next build will search
   the corpus again rather than reusing what it found"* — and reuse was available. The two
   facts have **different conditions**: `staleUnderstanding` is `updatedAt > confirmedAt`,
   `reuseSourceFor` refuses on `updatedAt > previousBuild.startedAt`. You edited an answer
   after confirming but before the build ran, so the reading really is stale *and* reuse is
   fine. 25-H coupled them on the reasoning that they are one event. They are not. The
   banner now reads the price from the build state, which is the thing that decides it.
2. **A 7-pass build renders headings for all 10 passes.** The three 25-F passes appear with
   no content beneath them, which looks like they ran and found nothing rather than never
   having run. The count line does say "7 of 10".
3. **The decisions list repeats itself** — `THE APPROACH` appears twice, and `THE INSTRUMENT`
   shows the same alternative verbatim twice. Not in this sprint's scope; recorded here.

⚠ **The walk is not read-only**: landing on `/ideas/build` minted a draft. That is §1's
defect, now fixed, and it is why the memory that said the walk was impossible has been
corrected rather than left.

---

## §4 — Saying what it costs before taking it

**4a — the duration was already there; the cost was not.** `buildEstimate` has said *"This
usually takes about N minutes"* since 25-E. It now also says what a build spends, **measured
over the same sample** rather than hardcoded — a fixed "about 30p" would be a guess wearing a
number's clothes and would go stale the first time a pass changed model.

⚠ Two decisions inside it. A build with **no recorded cost is excluded, not counted as zero**
— counting it drags the mean towards free, the one direction a price someone is about to
accept must never err in. And when there is no figure at all it still says **"It uses one of
your builds"**, because *this spends something of yours* is true regardless and is the half
that changes behaviour; a silent estimate would let someone conclude a build is free because
we could not price it.

**4b — the premise is contradicted: this already exists and I have verified rather than
rebuilt it.** The live site reads *"Re-running from the research already gathered — 70
findings, 69 cited sources"* against *"Search again from scratch"*, which is what §4b asks
for, built in 25-G §1b. It is now covered by a check so it cannot quietly disappear.

**4c — one sentence, where the user meets it.** `ideaNarrative` carries a `note`, rendered
above the box and **not hidden on a proposal** — the proposal is exactly when someone is
deciding whether they are allowed to change it:

> The four answers above are your own words, kept as you wrote them. This one is the version
> we work from — edit it freely, and it is what goes to an MP or a committee.

---

## §5 — The measurement, and the defect it found

One build, on your real idea, REUSE mode. **It failed**, at 1.4p, after 3 of 10 passes:
*"Revising in the light of it failed: the research pass produced nothing to revise against."*

**The cause is a serious defect and it was worth the build on its own.**

`carryEvidenceForward` — 25-G's step that makes reuse mean reuse rather than skip — was an
`updateMany` that rewrote `runVersion`. That is a **move**, not a copy. It runs inside
`claimBuild`, *before a single pass*, so **any re-run that is claimed and then fails, is
cancelled, or crashes takes the previous build's research away with it, permanently.** The
next re-run reuses from a source that no longer has any evidence and dies.

Measured on your idea:

| version | status | passes | evidence rows |
|---|---|---|---|
| v1 | DONE | 7 | **9** (should have been 78) |
| v2 | CANCELLED | **0** | **69** ← stranded here |
| v3 | FAILED | 3 | 0 |

One aborted re-run was enough to lose the whole of a build you had already paid for, and
nothing anywhere said so.

⚠ **`runVersion` has to be a fact about that version.** Moving made it mean "the newest run
that happens to be interested in this row" — v1's screen would go blank the moment anyone
clicked Re-run. It now **copies**, which costs some duplicated rows and makes each version
independently readable, which is what every version-scoped reader already assumes.

**Your 69 rows are restored** — v1 is back to 78, v2 holds none, each count re-read after the
write. `scripts/restore-stranded-evidence.ts` targets only builds that ran **zero** passes,
because a build that failed at pass 5 legitimately owns what it read.

### What the build did measure

⚠⚠ **The reuse saving, measured rather than calculated — this is the figure 25-G left as
arithmetic.**

| | input tokens |
|---|---|
| full build v1 | 107,380 |
| reuse build v3 | 15,590 |
| **measured saving** | **91,790 — 85%** |
| 25-G predicted | 141,926 of 217,687 — **65%** |

⚠ The prediction was made against a 217,687-token build and this baseline is 107,380, so the
**percentages** are the comparison, not the absolute figures. **The saving is larger than
predicted — 85% against 65%** — because the reuse run skipped both search passes on a build
whose search passes were a larger share of a smaller total.

⚠ **And it is a floor, not a clean measurement, because this run died at pass 5.** A reuse
build that completed all ten would spend more than 15,590. Treat 85% as the ceiling of the
saving and the true figure as somewhere below it, until a complete reuse build runs.

### What it did not measure — and the stop

§5's main question is whether §25.7's six qualities appear in the **output**. The build failed
before writing a kernel, so:

| quality | present |
|---|---|
| 1 causal chain | ✓ (1 of 7 causes nested) |
| 2 counterintuitive finding | ✗ |
| 3 the finding, not the citation | ✗ |
| 4 reframes the instrument | ✓ |
| 5 a test the user can apply | ✗ |
| 6 the next action | ✗ |

**These are the numbers from a build that died at pass 3 of 10 with zero evidence rows.**
They measure the defect, not the qualities, and reporting them as a verdict would be
dishonest.

▶▶ **This is the one thing I have stopped for.** §5 says *"Ceiling: one build. More than one
is spend beyond this brief"*, and spend is one of only two stops the brief allows. The
defect that wasted the first build is fixed; a second run would cost roughly 7p and would
answer the question properly. **Say the word and I will run it.**

---

## ADDENDUM — 27 Aug, the approved re-run, and a second defect underneath the first

Charlie approved the re-run. It took **two more builds**, because fixing the evidence carry
revealed a second, independent defect on the same path — and I ran a third to actually
deliver the measurement he approved. Both are now fixed.

**v4 — the approved second build. FAILED, 1.41p.** Same message as v3. But the fix *had*
worked: **69 evidence rows were now at v4** where v3 had zero. The rows carried; something
else did not.

**The second defect: `carryInto` accepted only `DONE` passes.** A reused pass is written to
the log as `SKIPPED` with the previous build's carry copied onto it — so `carry.research`
(6,031 characters, sitting right there on the record) was **stored correctly and discarded on
read**. REVISE received nothing and died with the identical sentence.

⚠ **Two independent defects on one path, and the second was invisible until the first was
fixed.** The rows were carried and the string was not; each alone produced the same error
message. That is the strongest argument I have for the "run it live" discipline: no amount of
reading either function would have separated them.

**v5 — DONE. The first reuse build that has ever completed.**

| | |
|---|---|
| status | **DONE**, 4m 21s |
| passes | **8 executed, 2 reused** — all ten accounted for |
| tokens | 55,626 in / 30,609 out |
| cost | **24.83p** |

⚠ **The counter says "8 of 10 passes", which under-reads a reuse build.** Two passes were
reused, not missed. Worth fixing so a complete re-run does not look partial.

### The reuse saving — the real figure replaces the ceiling

| | input tokens |
|---|---|
| full build v1 | 107,380 |
| **completed** reuse build v5 | **55,626** |
| **measured saving** | **51,754 — 48%** |
| the earlier failed-run figure | 85% |
| 25-G predicted | 65% |

**48% is the honest number.** The 85% in the main report came from builds that died at pass 5
— they looked cheaper because they stopped early. I flagged it as a ceiling at the time; it
was, and this is the floor beneath it.

⚠⚠ **AND THE REUSE BUILD COST MORE THAN THE FULL BUILD IT REUSED FROM — 24.83p against
6.78p.** That is not a contradiction and it must not be quoted without the reason: **v1 is a
seven-pass build from before 25-F**. v5 ran SMART, KERNEL_CHECK and LOGIC_CHECK, which v1
never had, and 25-G measured SMART alone at 53% of a build's cost. Reuse saved 48% of the
*input tokens on the two passes it skipped*; it did not make this build cheaper than a build
that did less work. **A like-for-like reuse saving needs a full 10-pass baseline, which does
not exist yet.** Quoting "48% cheaper" as a headline would be wrong.

### §25.7's six qualities, in the output at last

| quality | v5 | evidence |
|---|---|---|
| 1 a causal chain, not an inventory | ✗ | **0 of 4 causes nested** |
| 2 a counterintuitive finding | ✓ | 8 CONTRADICTS |
| 3 the finding, not the citation | ✓ | 80 of 82 substantive |
| 4 reframes the instrument if wrong | ✓ | — |
| 5 a test the user can apply | ✗ | — |
| 6 the next action | ✗ | — |

**Three of six reach the output.** Two things to say plainly about the three that do not:

⚠ **Quality 1 failing is a real regression against 25-H's own fix.** `nestByDrivenBy` is in
the code and `check:lex-25h` asserts it; the output still has **0 of 4 causes nested**. The
wiring exists and the model is not populating `drivenBy`. That is a live defect, not a
measurement artefact, and it is the single most valuable of the six — the brief calls it "a
causal chain, not an inventory".

⚠ **Qualities 5 and 6 have never been observed in any output**, across every build measured
in 25-H and 25-I. The instructions reach every drafting pass (checked, controlled) and
nothing comes back. On the evidence, *reaching the prompt is not sufficient* for these two,
and the next step is to look at whether any pass is actually asked to produce them in its
output contract rather than merely told to in its method block.

**Neither is in this sprint's scope. Both are first items for the next.**

---

## §6 — The citation pass: prepared, not built

`docs/CITATION_PASS_PREP.md`. It records the four §5 decisions as a table awaiting your
answers, and — the part that matters now — the constraint that shapes the whole feature:

⚠ **Markup covers 2–5% of the cross-references actually in the text, and 0% for CRaG 2010** —
the very Act this sprint's own build kept surfacing as the existing power. 93,772 act-name
spans resolve to nothing. **Any count is a floor**, and the coverage statement is **mandatory
and computed**, never a hardcoded string, because coverage varies by Act across the whole
0–5.4% range: a sentence reading "coverage is around 2–5%" beside a CRaG count of zero would
be precisely wrong in the case a user is most likely to test.

One note not in the handover: keying the re-run cache on *coverage state* means the key must
move when the **corpus** moves. The day the absent Acts are ingested, every cached answer
becomes wrong in the same direction at once, and nothing would invalidate them.

---

## Verification

| gate | result |
|---|---|
| `check:lex-25i` | **14 passed, 13 with negative controls**, every control watched rejecting |
| `check:build-25a` / `25b` | 40/40 · 54 |
| `check:lex-25c` … `25h` | 32 · 77 · **28** · 62 · 27 · 20 |
| `tsc --noEmit` | clean |
| `next build` | clean |
| live document pipeline | driven end to end, reconciled, re-read |
| live build | ran; failed on the defect above; 1.4p |
| signed-in walk | **done** — production, text extraction |

⚠ **The 25-I check failed on its first run against correct code, and the defect was in the
check.** The §5 assertion looks for the `updateMany` that used to move evidence — and the
fix, being a serious defect, *documents* it, so the function now carries that exact
expression in its comment block. The guard matched its own explanation. It now strips
comments before asserting: **a source-text guard that cannot tell code from prose is a guard
against the topic, not the behaviour**, and it gets stricter every time somebody documents
something properly.

⚠ **`check:lex-25e` went from 27 to 28 and one of its assertions was rewritten.** §4a wraps
the zero-sample estimate line, which 25-E read as a bare string literal. Its property —
*don't answer the user's question and then disclaim our sample size at the moment they commit*
— is unchanged and now reads the composed sentence. What the user is about to spend is their
business, not our apology.

⚠ **`lib/lex/reranker.ts` is untracked, belongs to another live session, and does not
compile.** It is not on `Main`, not reachable from the app graph (`next build` is clean), and
I have not touched it. My typechecks filter it out.
