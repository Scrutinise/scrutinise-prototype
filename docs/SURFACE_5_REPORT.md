# SURFACE 5 — CONNECT THE CROSS-REFERENCE GRAPH

**2026-09-08. Brief: `docs/BRIEF_SURFACE_5.md`.**

---

## The short version

**§0's premise is half wrong and half worse than it says.** `scrutinise-web/lib/lex/statutory-graph.ts`
has read `citation_edge` since 27 August, and a whole Deepening pass is built around it. But
**the pass has never run.** Zero `DeepeningPass` rows for `STATUTORY_CONSEQUENCES`, zero
`EvidenceItem` rows from the citation graph, on any idea, ever — so the brief's real sentence
still stands: *every answer this graph has given was given to a script.*

**And when it did run, on 8 September, it was wrong about the one thing the brief says matters
most.** The web reader typed `detection` as two values and mapped everything else to `markup`:

```ts
detection: r.detection === 'text' ? 'text' : 'markup'
```

**191,258 `enabling` rows — the strongest kind in the table — came back claiming the source
document had asserted the target's identity itself.** Then, because every one of them has a null
`source_provision_ref` (the enacting words sit in a preamble, above any provision), the two-way
split filed **100% of them** under `titleOnly`, whose own description reads *"real references, but
not provisions that would break"*. That is the exact inverse of what an enabling power is.

So the pass reached no group, no disposition and no document with them. On the European
Communities Act 1972 the gap is **6,017 rows**; on the Constitutional Reform Act 2005 it is
**120 instruments**.

**Now live, on Charlie's own idea:** *Abolish the Supreme Court* → `ukpga/2005/4`. **120 instruments
are recorded as made under it**, listed with their enacting words, above 840 provision references in
six groups, with the coverage statement as a row of its own. **0.0839p, 5.8 seconds.**

⚠ **And reading that output found a second defect the checks could not have.** Half of those 120
quote enacting words that do not name the Act they are filed under, and at least one is a verified
misattribution in the graph itself. It is labelled on the page, and it is §6 and decision 4.

---

## §1 — THE ORDERING, AND WHAT IT RESTS ON

**Recommendation: order by the KIND of reference. Nothing else in this data supports an order,
and the surface says so on screen.**

### What it rests on

`citation_edge.detection` is a stored column with a `CHECK` constraint behind it, written by three
extractors with three different warrants. The three are not degrees of confidence in one thing —
they are different facts:

| kind | rows, graph-wide | what it is | why it sorts where it does |
|---|---|---|---|
| **enabling** | 191,258 | the instrument's own enacting words name the power it was made under | ⚠⚠ an instrument that merely mentions an Act survives its repeal; one whose enabling power is repealed **may fall with it** |
| **markup** | 385,346 | the source document identified the target in its own markup | the source said which instrument it meant — read, not inferred |
| **text** | 649,202 | the target's *name* found in running prose and resolved against titles we hold | ⚠ the target is derived by us, and must never be presented as the document's own identification |

**This is an order read off the record, not a score.** `DETECTION_KINDS` carries a `strength` per
kind and `kindsPresent()` sorts by it; adding a fourth kind puts it in the order automatically,
because the record is keyed by the union type. There is no arithmetic and nothing to tune.

### What the data does NOT support, and I have not built

**Candidate 2 — "is the referring provision itself still in force?" — is the right thing to want
and cannot be answered today.** Measured:

- the repeal record is in `legislation_edges` (322,346 `repeals` rows) under a **corpus-prefixed**
  identifier — `primary-acts-pre-2000:ukpga/1985/6:section-229-4` — against `citation_edge`'s bare
  `ukpga/1985/6`. Joinable, with work.
- it is recorded at **four granularities** (`section-section` 157,960, `act-act` 127,861,
  `section-act` 32,025, `act-section` 4,500), so "this provision was repealed" and "the Act
  containing it was repealed" are different rows.
- ⚠⚠ **and decisively: the ABSENCE of a repeal edge is not evidence that a provision is in force.**

That last point is what settles it. Ordering by an in-force flag we cannot compute would rank live
law *below* repealed law wherever our effects coverage is thin — a confident wrong answer, which
§4 forbids. **So it is stated on screen instead**, in the ordering note the coverage row carries:

> *"We cannot yet tell you whether the provision doing the referring is itself still in force, and
> we have not guessed: our record of repeals is not complete enough for its silence to mean 'still
> in force', so ordering by it would put live law below repealed law wherever that record is
> thin."*

**Candidate 3 — grouping by referring instrument — is right, but only for the enabling kind, and
that is where it is used.** A preamble naming four sections of the target produces four rows and is
**one instrument** standing on that Act. Counting rows would inflate the consequence fourfold in
the one place over-reporting costs most: a committee counts instruments. On CRA 2005 that is
**120 instruments over 212 enacting references**. For the other two kinds the existing grouping —
by what the words *do* — is better, and it already existed.

### And the count is not a ranking

Within a kind, groups are ordered largest first. That is arithmetic, and the note says so —
*"largest group first, which is a count, not a ranking"* — because this thread has twice shipped an
alphabetical list under the word "top".

---

## §2 — WHERE IT APPEARS

### The Deepening's legal pass — it was already there, and it had never fired

`STATUTORY_CONSEQUENCES` is the fifth pass, under its own heading `REFERS_TO_THIS`
(*"What else refers to this law"*), driven by the `CITATION_CONSEQUENCES` job. All of that shipped
on 27 August. What this sprint found is that **it has produced nothing for anybody**, and the
reason is upstream of the graph: the pass refuses to guess its target, and **exactly one idea in
the database has a linked instrument.**

### The printed output — the words did not travel, and now they do

Measured by reading the three builders rather than assuming:

| document | what it prints per finding |
|---|---|
| long report | `title`, then `body` |
| evidence pack | `title` + `siftReason` |
| **meeting pack** | **`title` + `citation`, and nothing else** |

Three things followed from that, all fixed:

1. **The sift reason carried no evidence.** It was `From the citation graph: what refers to
   ukpga/2005/4.` — identical on every row, no count, no quotation, no source. So in the evidence
   pack a disposition stood with nothing behind it. It now reads:
   > *"307 references in 289 provisions that borrow a definition from the target: would need a
   > substitute reference. anaw/2014/4 section-125D: 'Lord Chief Justice may nominate a judicial…'."*
2. **The coverage statement reached one document out of three.** It was appended to each group's
   *body*, and only the long report prints a body. It is now **a row of its own**, with its
   substance in its **title** — the one field every builder prints:
   > *"What this reference search could not see — 3 layers are not searched, and every count here
   > is what we found in the layers we have"*
3. **The disposition printed as a raw enum.** `— no_action` reached the meeting-pack line. It is
   now `DISPOSITION_WORDS`, keyed by the union so a new disposition is a compile error.
   ⚠ And the title now reads *"335 references — each mentions the target without acting on it. **As
   a kind:** needs no action."* — "as a kind" is not padding: the disposition is a judgement about a
   *kind* of reference, not a legal opinion on each of 335 provisions.

### A legislation view — recommend, not built

**Recommendation: yes, but as a second sprint and only after §1's decision 3.** A legislation page
is the one surface where a reader arrives already holding the target, so no resolver is needed and
the pass's single hardest step disappears. But it is a different product question — a public,
un-owned page with no proposal behind it — and the honest read of this sprint is that the
proposal-side surface has still never been used by anybody. **Build the second surface after the
first has an audience.**

---

## §3 — THE COVERAGE STATEMENT

**Rendered live, on every call, and it now says all of it.** What was there before said which
layers were missing and stopped. `notInAProvision` and `unresolvedTargets` were **queried on every
call and printed nowhere** — a figure computed and not printed is, on the page, indistinguishable
from a figure never computed.

**This is the statement as it actually rendered on 8 September** (from the stored row, not a
mock-up):

> This covers statutory instruments (the regulations made under Acts), Acts of Parliament and other
> instruments. **We hold amends, repeals, commences or modifies, from TNA's own effects data — but
> not in this search, so they are not joined into any number here.** We do not hold any of these at
> all yet: a judgment citing a statutory provision; a treaty article bearing on a domestic
> provision. There will be further references we cannot see. A repeal or an amendment is not a
> citation and is not returned by this query. A provision may be read down, disapplied or construed
> by a court with nothing here to show it. A change may be prevented by an international obligation
> this graph cannot see. **21.8%** of the references we hold sit in a title, long title, preamble or
> explanatory note rather than inside a provision — real references, but not provisions that would
> break. **14.1%** point at an instrument we hold no text for, so we can count them and cannot show
> you what they say. **77** of the Acts referred to here are named by an identifier that fits more
> than one Act, because two parliamentary sessions can fall inside one calendar year. **We refused
> to guess between them, so those are recorded as refusals — a refusal, not an absence, and not
> evidence that nothing refers to them.** **36.1%** of the OLD preamble parser's section-level
> made-under references were wrong — the effects table still holds those, while the enabling rows
> quoted here came from the fixed parser (measured 11.5 days ago). **41.3%** of the instruments
> sampled had their scheduled text reach our corpus as well — ⚠ a scheduled agreement that was not
> ingested presents as a SHORT DOCUMENT, not as an error (measured 11.5 days ago). **97,095** act
> names found in running text resolved to no instrument we hold a title for — short forms that name
> only a year, and Acts the corpus does not hold. Counted, never dropped (measured 13 days ago).
> **Treat any number here as what we found in the layers we have searched, not as a total.**

Every figure in that paragraph is interpolated; `check:statutory`'s figure guard still fails the
build on a prose string containing one, **and it fired once during this sprint** — on the phrase
*"short forms such as 'the 1998 Act'"*. It was an illustration, not a corpus figure, and the guard
was still right to reject it: a guard for prose cannot tell one digit from another, and one that
has to be argued with gets deleted by the next person to hit it.

### Three things the block did not know

1. ⚠⚠ **"held elsewhere" was decided by the wrong table.** The `amendment-effects` layer's status
   came from `SELECT COUNT(*) FROM graph_edge` — **the POSITION graph's** subject/predicate/object
   table (164,238 rows), which holds no statutory effect of any kind. TNA's effects are in
   `legislation_edges` (1,997,033 rows). The status was right by accident: it would have gone on
   saying "held elsewhere" with the effects table empty, and said "NOT BUILT" if the position graph
   were cleared. It now counts the effects table **with the effects predicate**.
2. **"held elsewhere" and "not built" read identically in the prose.** The status field told them
   apart and the sentence lumped both under *"does not yet cover"*, which tells a reader the
   amendment data does not exist when it exists and this query does not reach it — a caveat lying
   in the reassuring direction about the layer this feature can least afford to lose.
3. **A refusal was not distinguished from an absence, and the identity bridge was not read at all.**
   77 targets are named by a form that fits more than one Act; the graph records those as
   `basis = 'ambiguous-refused'` rows precisely so they can be counted. The statement now says so
   in those words.

### On screen and in all three documents, from one function

`lib/lex/consequences-caveat.ts` — the same shape as `positions-caveat.ts`, imported by
`QuestionPanel.tsx`, `build-proposal.ts`, `build-evidence-pack.ts` and `build-meeting-pack.ts`.
⚠ **It imports nothing**, and that is load-bearing: the panel is a `'use client'` component, so a
value import of `statutory-graph.ts` would follow `lib/prisma` into the browser bundle and fail the
Vercel build on `dns`/`fs`/`net`/`tls` (CLAUDE.md §28). The live figures reach the page through the
coverage **row**; the caveat is a function of the rows and states no corpus figure at all.

⚠ **It reports its own absence.** If the coverage row is not under the heading, the caveat says the
statement is **MISSING** rather than quietly rendering a shorter paragraph.

---

## §4 — WHAT THIS SPRINT DOES NOT SAY

Asserted, with controls, in `check:surface-5`:

- **Never "still good law".** The caveat contains the phrase only inside the sentence refusing it:
  *"None of this says whether the law here is or is not still good law. Those are legal
  conclusions."* The enabling block says an instrument **may fall with** the target and never that
  it would be revoked.
- **Never a total.** *"Every number here is a count of what we found in the layers we have
  searched, never a total."*
- **Never flattened.** The three kinds have three lists, three descriptions and three positions in
  the order; the caveat says in words that they are *"kept apart here rather than added together"*.

---

## §5 — VERIFICATION

| gate | result |
|---|---|
| `check:surface-5` | **16 passed, 0 failed, 7 controls, 0 dead** — 16 assertions executed of 16 declared |
| `check:statutory` | **17 passed, 0 failed** (4 failed on first run against my changes; all four were the check being stale, all four fixed) |
| `verify:statutory-parity` | **parity holds, and now kind for kind** — CRaG 208/208, Equality Act 2,016/2,016 |
| `verify:consequences` | **8 rows written through `runJob`, re-read, reconciled ✓**, on a real idea |
| `check:deepening` | ⚠ **1 pre-existing failure, not mine** — see §7 |
| `check:lex-26a` | 26 passed, 0 failed, 5 controls, 1 standing finding (not mine) |
| `check:client-boundary` | ✓ 576 files, 136 client components, no server reach; control fired |
| `tsc --noEmit` | clean |
| `check-clean-build.sh --fast` | **PASS** — 0 cross-package files in the web program |

### Every check watched failing against the real broken state

I reintroduced all three defects in `statutory-graph.ts` at once — the defaulting mapper, the
provision-ref-first split, and the wrong effects table — and ran the check:

```
✗ §4 the reader knows three kinds and REFUSES a fourth rather than defaulting
     enabling did not map to itself
✗ §1 an enabling row is never filed as a title-only mention
     the enabling row was not kept apart
✗ LIVE §3 amendment-effects is HELD-ELSEWHERE on the effects table, not on an unrelated one
     the layer no longer names the effects table and its predicate
✗ COLD READ — the reader agrees with the table, kind for kind
     ukpga/1972/68: the table holds 6017 enabling rows and the reader reports 0
```

⚠ **The cold read is the one that matters** (CLAUDE.md §26). It takes a target it did not choose —
the busiest enabling target in the graph, picked by the data, not by id order — reads the table with
plain SQL, then calls **only what the product calls** and compares kind for kind. It creates nothing
and touches nothing.

### ⚠⚠ And the parity check would NOT have caught this

`verify:statutory-parity` existed for exactly this drift and **compares counts**. Before this
sprint, ours and theirs both said 2,016 for the Equality Act — because every row *was* returned,
just wearing the wrong kind. **A reconciliation of totals cannot see a mislabelling.** It now
compares `detection` for every row and asserts no enabling row is in the title-only list.

⚠ It had also gone red at some point since 28 August and nobody ran it: `rows + titleOnly` no longer
equals the table once `enabling` is its own list. That is the check working. It is green again.

---

## §6 — THE WORKED EXAMPLE

▶ **Charlie: open the idea *"Abolish the Supreme Court"* (`374c54e5`), go to the question panel, and
open the heading *"What else refers to this law"*.** The rows are on production now, at
`runVersion 2`, status `PROPOSED` — they are proposals for you to judge, exactly like every other
finding.

What you should be able to click, in stored order:

```
· 120 instruments are recorded as made under ukpga/2005/4 — the strongest kind of reference here
· 335 references — each mentions the target without acting on it. As a kind: needs no action.
· 307 references — each borrows a definition from the target. As a kind: would need a substitute reference.
· 71 references — each brings the target into force, or is named after it. As a kind: needs no action.
· 67 references — each amends or repeals part of the target. As a kind: would go with the target.
· 51 references — each exercises or relies on a power in the target. As a kind: would need a substitute reference.
· 9 references — each disapplies, qualifies or overrides the target. As a kind: would need a substitute reference.
· What this reference search could not see — 3 layers are not searched, and every count here is
  what we found in the layers we have
```

Open the first one. It is the section that did not exist before this sprint:

> 120 instruments are recorded as made under ukpga/2005/4, across 212 enacting references. For 60 of
> them the words we can quote do not name this Act — see the note below.
>
> This is a different and stronger fact than a mention. An instrument that merely mentions an Act
> survives its repeal; an instrument whose enabling power is repealed may fall with it, and each of
> these would have to be read on its own terms before that could be settled.
>
> **uksi/2014/1919** (naming section-115, section-116, section-117, section-120, section-121):
> *"Lord Chief Justice, in exercise of powers conferred under sections 115, 116, 117, 120 and 121 of
> the Constitutional Reform Act 2005"*
> https://www.legislation.gov.uk/uksi/2014/1919
>
> **nisr/2010/381** (naming section-55A, section-55):
> *"Northern Ireland Court of Judicature Rules Committee makes the following Rules in exercise of the
> powers conferred by sections 55 and 55A of the Judicature (Northern Ireland) Act 1978"*
> https://www.legislation.gov.uk/nisr/2010/381

### ⚠⚠ AND READING IT FOUND A DEFECT NO CHECK WOULD HAVE

`nisr/2010/381` appears in that list quoted as made under the **Judicature (Northern Ireland) Act
1978** — not the Constitutional Reform Act it is filed under. I checked the stored bytes rather than
assuming a display problem:

- its whole `raw_fragment` is the complete `<EnactingText>` element, and it names **only** the
  Judicature (NI) Act 1978;
- `target_uri` is an explicit `http://www.legislation.gov.uk/id/ukpga/2005/4`;
- and **every one of its four enabling rows points at CRA 2005.** The Judicature Act is not among
  its recorded enabling targets at all.

So this is a **misattribution, verified** — not a quotation-window artefact. ⚠ The *mechanism* is
inferred: the URI is explicit, so the extractor read a citation from the preamble region, and the
likeliest source is the footnote hanging off the Judicature Act's name, whose amendment note cites
the Constitutional Reform Act 2005.

**Built in response, from data already held, with no new extraction:** each enabling quotation is now
checked against the target's own title from `corpus_acts`, and where the words do not name it the row
says so, in place:

> `nisr/2010/381` (naming section-55A, section-55): **⚠ the words we can quote do not name the
> target. Either the preamble was clipped before it got there, or the graph reached the target
> through a footnote — we have not checked which, so read this one against the instrument itself**

⚠⚠ **The wording is deliberately weaker than "names a different Act", and measuring is what forced
that.** Two causes look identical from here and only one is a defect:

| target | instruments | words do not name it | what they mostly are |
|---|---|---|---|
| Constitutional Reform Act 2005 | 120 | **60 (50.0%)** | *"of that Act"*; a second Act filling the clipped window; and at least one real misattribution |
| Equality Act 2010 | 74 | **0** | — |
| European Communities Act 1972 | 3,054 | **14 (0.5%)** | a typo in the source (*"European Communitites Act"*), a missing space (*"EuropeanCommunities"*), clipped preambles |

⚠ **Two measurement errors of my own, both caught before publishing, both the same shape.** A first
version stripped only `(revoked)` from a stored title, so the European Communities Act — recorded as
*"…1972 (repealed)"* — matched nothing and **100% of 3,054 instruments were flagged**: a warning on
every correct row, which is worse than no warning at all. A second required the title's year, and
`citation_text` is capped at 300 characters, so *"…section 148(1) of the Constitutional Reform Act"*
was flagged for lacking *"2005"*. Both are now controls in `check:surface-5`, along with the curly
apostrophe that broke the first raw comparison.

The opening line and the sift reason are qualified for the same reason. They now read **"120
instruments are *recorded as* made under ukpga/2005/4… For 60 of them the words we can quote do not
name this Act"** rather than *"were made under it, in their own enacting words"*, which was an
over-claim on half of them.

Above the list, on screen and in all three documents:

> The instruments listed at the top were made under this law, in their own enacting words. That is a
> different and stronger fact than a mention of it, and the two are kept apart here rather than added
> together: an instrument that merely mentions an Act survives its repeal, while one whose enabling
> power is repealed may fall with it. The rest are references grouped by what their words do, with
> what each kind would need if this law changed. The count tells you the scale; the grouping tells
> you the work — most references to a well-known Act are untouched by changing it. None of this says
> whether the law here is or is not still good law. Those are legal conclusions. What is recorded is
> that certain words in certain provisions point at this one, with the words quoted and the source
> named, so you can go and read them. Every number here is a count of what we found in the layers we
> have searched, never a total. What this search could not see is set out in full in the item titled
> below — read it before quoting any number from this section.

**Cost of that run, read back from the ledger: 0.0839p, one model call, 5.8 seconds.** The enabling
block costs nothing extra — it is grouped in code and never goes to the model. (The rendering was
corrected between runs; the ledger's total against this idea is **0.2525p** across the three runs made
after spend recording was in place.)

---

## §7 — WHAT IS NOT DONE, NAMED

- **The in-force state of the referring provision.** Measured as unjoinable-today in §1 and said on
  screen. It is the single biggest improvement available to this surface and it is decision 2.
- **The pass still runs on one idea.** `identifiedInstruments` refuses to guess, correctly, and one
  idea in the database has a linked instrument. **This surface has an audience of one until ideas
  get instruments**, which is a Lex-side problem, not a graph one.
- **`citation_text` quotation quality, and one verified misattribution.** 32.4% of the column is
  leaked XML (cleaned at read time, counted when it cannot be); the 300-character cap clips preambles
  before the Act they name; and `nisr/2010/381` is recorded as made under CRA 2005 when its enacting
  text names only the Judicature (NI) Act 1978. All three belong to the extractor. **Surfaced and
  labelled here, not fixed** — repairing it in one consumer leaves every other consumer wrong.
- **The legislation view.** Recommended in §2, not built, deliberately.
- **`check:deepening` has one pre-existing failure that is not mine and I have not edited their
  file.** ▶ **The exact change, for Charlie to relay to the LEX stream:** in
  `scrutinise-web/scripts/check-deepening.ts:358`, the assertion *"the engine uses it in place of
  the gather's own issues"* tests for
  `/const issueTexts = adversarial \?\? gathered\.issues/`. Commit `686eaf7` (25-V §7) rewrote that
  line in `lib/lex/deepening.ts:631` to a typed ternary, so the regex has been stale ever since.
  **The property still holds** — the engine does use the adversarial issues and falls back with a
  warning. The regex should become `/issueTexts[^=]*= adversarial\s*\n?\s*\?/` or, better, an
  assertion that `adversarial` is the left-hand branch. **Nothing in the product is wrong.**
- **A run does not update itself.** The rows are stamped at the run's `runVersion`; re-running
  replaces nothing automatically (this sprint's runs were cleared by hand between attempts). The
  positions producer solved the same problem by deleting its own `passKey` rows in a transaction.
  ▶ **Recommended, one small change, not made because it changes write behaviour on a shared
  surface** — decision 5.

---

## §8 — DECISIONS FOR CHARLIE

**1. Should the enabling block lead the section, above the reference groups?**
It does now. It is the strongest evidence and the only kind whose consequence differs in kind from
the others.
▶ **Recommend: keep it.** *Consequence of the alternative:* ordering by size would put 335 rows that
need no action above 120 instruments that may fall — the reader would meet the least consequential
thing first.

**2. Build the in-force join for referring provisions? (~1 sprint)**
The join is `legislation_edges.to_id` stripped of its corpus prefix, at two granularities, and it
needs a coverage figure of its own so that "no repeal edge" never renders as "in force".
▶ **Recommend: yes, but with the honest three-state answer — repealed / not repealed in our record /
we do not hold the record.** *Consequence of not doing it:* the surface can say what points at a
law but not which of those pointers are themselves live, which is the second question every
reviewer will ask.

**3. Give more ideas a linked instrument.**
The pass fires on one idea because one idea has a link. The resolver's refusal to guess is right and
should not be relaxed.
▶ **Recommend: a prompt in the Lex build — "which Act would this change?" — with the link written
from the answer.** *Consequence of not doing it:* the whole pass, and this sprint, serve one idea.
⚠ **This is the highest-value item on the page and it is Lex-owned, not graph-owned.**

**4. The enabling attribution — a message for Search/Graph.**
Half of the Constitutional Reform Act's enabling instruments quote words that do not name it, and at
least one (`nisr/2010/381`) is a verified misattribution: its whole enacting text names the Judicature
(NI) Act 1978, which is not among its recorded targets. The label is on the page now, but a label is a
workaround.
▶ **Recommend: ask Search/Graph for two things — (a) raise the `citation_text` cap for `enabling`
rows, or clip to the clause naming the target rather than to 300 characters; and (b) check whether the
preamble parser is resolving citations out of FOOTNOTES, where an amendment note names a different
Act.** *Consequence of not doing it:* a reader who checks one quotation against legislation.gov.uk
finds a different Act and distrusts the whole panel — and on this evidence they would sometimes be
right to.

**5. Should a re-run replace its own previous rows?**
Today it does not; two runs would put two answers under one heading.
▶ **Recommend: yes — delete by `passKey` inside the write transaction, exactly as
`filePositionsForIdea` does.** *Consequence of not doing it:* the first user who re-runs a build
sees the section double, and neither copy says which is current.

---

*Report by CC-Surface. `check:surface-5` 15/0 with 6 live controls; parity holds kind for kind;
run live on `374c54e5` at 0.0883p and re-read from the database.*
