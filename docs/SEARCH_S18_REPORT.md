# SEARCH S18 — THE COST AND BENEFIT BLOCK

**Executes:** `BRIEF_SEARCH_S18_COSTING.md` · **Written:** 2026-09-07, by CC-Search
**Configuration every number below was taken under:** `QUERY_EXPANSION=off QUERY_ROUTER=ON
SEARCH_VECTOR=off SEARCH_RERANKER=off SEARCH_GRAPH=off COHERENCE_CORPUS=off SEARCH_STUB=off
TIER_FUSION=off BUILD_PERSPECTIVES=off ROUTER_STREAMS_V2=off STATS_STREAM=off FUSION_WEIGHTS=off
SEARCH_JUDGED_MERGE=off ROUTER_CONFIDENCE=off ROUTER_APPRAISAL=off | fts=fts-serve-production
(build `S16-fts-cancel-bounded`) | vector streams set but NOT used by the sparse probes`

⚠ **This is the LOCAL harness configuration, and it is not production's.** `/api/health` reports
production running `LEX_QUERY_EXPANSION=true LEX_SEARCH_RERANKER=true LEX_SEARCH_JUDGED_MERGE=true
LEX_TIER_FUSION=true LEX_STATS_STREAM=true` on commit `ba18891`. S17's D-6 (re-take the baseline
under production's real flag string) is **still outstanding and this sprint does not close it.**

---

## §1 — THE ROUTING DIAGNOSIS. ⚠⚠ THE BRIEF'S PREMISE IS OVERTURNED.

The brief opens: *"Impact assessments are the worst-performing collection we have … **The right
stream is never searched.** ▶ Nothing else in this sprint matters if the collection cannot be
reached."*

**It is reached.** It is routed to on 5 of 9 questions, admitted by the `legislation` stream on
every one of its rows, indexed under the right tier, and retrievable. What fails is **the answer
key and the unit** — and no routing change can move either.

### §1.1 — Which streams the router chose, and why

`scripts/audit-s18-routing.ts`, 3 rolls per question per arm, artefact
`docs/census/s18-routing.json`. **Routing was 3/3 stable on every question** — no intermittency at
all on this set.

| | routed streams (V2 off) | `legislation` |
|---|---|---|
| I1 plastic straws cost | legislation + debates + committees + guidance | **3/3** |
| I2 building safety levy | legislation + debates + committees + guidance | **3/3** |
| I3 residual waste target cost | debates + committees + guidance | **0/3** |
| I4 RPC / tobacco fees | debates + committees + guidance | **0/3** |
| I5 tobacco fees cost to business | debates + committees + guidance | **0/3** |
| I6 environmental permitting | legislation + debates + committees + guidance | **3/3** |
| I7 South Korea adequacy | legislation + debates + committees + guidance | **3/3** |
| I8 Public Guardian fees | legislation + debates + committees + guidance | **3/3** |
| I9 Public Guardian options | debates + committees + guidance | **0/3** |

▶ **`legislation` named on 5 of 9, omitted on 4** — and the four are *exactly* S17's published
NOT-ROUTED set (Q33, Q34, Q35, Q39). The recount reproduces live, three times each.

**Why**, legibly, from the prompt itself: `legislation` is described to the model as *"primary Acts,
statutory instruments, retained-EU law"*. Under that description *"what was the predicted cost of
the residual waste reduction target"* is plainly **not** a legislation question — while impact
assessments sit in the legislation tier and nothing in the prompt says so.

⚠ **My prediction P-1 was that `legislation` would be named on fewer than half. It was named on 5
of 9. P-1 is REFUTED on its own stated threshold** (logged in CHANGE_LOG before the run).

### §1.2 — Which of the three causes is it? ▶ NONE OF THEM.

The brief names three candidates with three different fixes. Measured, not reasoned:

| candidate | verdict | evidence |
|---|---|---|
| **TIER** | ❌ not it | Every key reads back tier `legislation` **off the served index** — not off `corpus_reachability.json`, which is what made S16 wrong. |
| **SCOPE** | ❌ not it | `streamCanSelect` (**imported**, never re-implemented) admits every key to `legislation`. |
| **STREAM SELECTION** | ⚠ real, on 4 of 9 | Above. Fixed in §1.3, flag-gated, and it **buys no recall** — see below. |

**And the control that decides what those mean.** Scoped to `impact-assessments` **alone**, with
every other collection removed from the race, BM25-only, top 200:

```
section-level  recall@20   0 of 9      in top 200:  2 of 9
DOCUMENT-level recall@20   4 of 9      in top 200:  8 of 9
```

▶▶ **The right ASSESSMENT comes back for 8 of 9 questions and the key comes back for 2.** For I1
the assessment ranks **3**; what is at rank 3 is `impact-assessments:2020-57:12`, *"Rationale for
intervention (part 4)"*, and the answer key is `…:1`.

### §1.3 — ⚠⚠ WHAT THE KEYS ACTUALLY ARE. THE RULER IS BROKEN, NOT THE RETRIEVER.

`scripts/audit-s18-keys.ts`, every key read out of R2, artefact `docs/census/s18-keys.json`:

| kind | n of 18 | |
|---|---|---|
| SUBSTANTIVE | 7 | 38.9% |
| **COVER-SHEET** | **5** | 27.8% |
| **STRIPPED-TABLE** | **4** | 22.2% |
| DECLARED-ABSENT | 2 | 11.1% |
| ▶ **UNANSWERABLE (cover sheet + stripped table)** | **9** | **50.0%** |

- `impact-assessments:2020-57:1` — I1's key. **71 words:** *"Title: Impact Assessment on the
  proposal to ban the supply of plastic drinking straws … IA No: … RPC Reference No: RPC-4316(3)-
  DEFRA … Contact for enquiries: Dan Quinlan"*. **It is the cover of the document.** It contains no
  cost, no benefit and no finding.
- `impact-assessments:2020-57:2` — I1's other key. **17 words:** *"Cost of Preferred Option (2016
  prices, 2017 present value) / Total Net Present Value / Business Net Present Value"* — the column
  headings of the appraisal table, **and not one digit under any of them.**

⚠⚠ **This is S16's committees finding arriving in a second collection.** S17 published *"committees
52.6% off-kind, every other collection 0.0% across 76 keys — there is NO second instance of the
wrong-kind defect."* **There is.** That is not S17 being wrong: its `kindOf()` returns the single
string `'impact assessment'` for every row of this collection, so a cover sheet and a 1,748-word
rationale are the same kind to it. **The axis it measured collapses inside this collection**, and
this sprint adds the second axis, computed from the BODY.

⚠ **And S17 named the hazard it could not compute.** *"A legislation key 1 of a 200-section median
Act"* — here it can be computed, because the sections of one assessment ARE all about one measure,
which is precisely the property S17 said it could not claim for an Act's sections. **16.0 sections
per assessment, 18,759 sections over 1,172 assessments. The hazard has fired.**

### §1.4 — The narrow routing fix, flag-gated, measured, and honest about what it buys

`LEX_ROUTER_APPRAISAL`, **default OFF** — one appended paragraph telling the router that the
legislation corpus also holds the government's own appraisal material. `ROUTER_PROMPT_BASE` reaches
the model byte-identical with it off, the same arrangement S8 §4 uses.

⚠⚠ **AND THE CONTROL IS WHAT MAKES THE COST NUMBER MEAN ANYTHING.** The first full run reported
7 of 36 other questions (19.4%) losing a routed stream, which reads as a regression. An LLM sits
between the question and the route, so an OFF-vs-OFF run was taken to establish the noise floor.

| arm (36 non-impact questions) | gained `legislation` | lost `legislation` | lost ANY stream |
|---|---|---|---|
| **CONTROL — OFF vs OFF (the noise floor)** | 0 | 0 | 3 · 8.3% |
| OFF vs ON | 3 | **4** | 7 · 19.4% |

| arm (10 impact-assessment questions) | named `legislation` on a majority of rolls |
|---|---|
| **CONTROL — OFF vs OFF** | 5 → 5 · **0 gained** |
| OFF vs ON | 5 → **10** · **5 gained** |

▶ **The gain is unambiguous and far outside the noise floor** (5 gained against a control floor of
0). ▶ **The cost is real but roughly half the headline**: ~11pp above an 8.3% floor, i.e. about
four questions of 36, and **4 of them lose `legislation` itself** against a control floor of zero.
The losers are named per question in `docs/census/s18-appraisal.json`; K4 and G2 collapse to a
single stream, which is the same over-selectivity that made `LEX_ROUTER_STREAMS_V2` a regression.

⚠⚠ **AND IT CANNOT MOVE THE RECALL NUMBER, WHICH IS SAID HERE RATHER THAN DISCOVERED LATER.**
Section-level recall@20 is **0 of 9 with the collection scoped to itself**. Routing the right stream
cannot make a cover sheet come back. **This flag fixes a real defect in stream selection and buys
nothing until the keys are re-cut.** A flag whose comment claimed otherwise would be a guard that
cannot fail.

⚠ **Re-measured while I was there: `LEX_ROUTER_STREAMS_V2`'s mechanism is now visible.** With V2 on,
the router routes **8 of these 10 questions to `impact-assessments` ALONE**, dropping legislation,
debates, committees and guidance entirely. It does not dilute impact assessments; **it starves
everything else.** That is a better account of S8's 32 → 29 than "the router became more selective".

---

## §2/§3 — THE BLOCK. ⚠⚠ AND TWO LIVE DEFECTS FOUND IN THE THING IT EXTENDS.

`lib/lex/costing.ts`. It is a **specialisation of `PRECEDENT`, not a second assembler** — §2's
explicit requirement. `retrievePrecedent()` is imported and its legs are what PREDICTED and CHECKED
are built from.

### ⚠⚠ DEFECT 1 — `PRECEDENT`'s PREDICTED AND OBSERVED LEGS HAD NEVER RETURNED A ROW

The join was `s.id LIKE '%:{gid}:%'`. That is right for explanatory material
(`explanatory-notes:ukpga/2010/25:1` contains the gid). **It cannot be right for an impact
assessment**: the id is `impact-assessments:2020-57:1`, whose middle segment is the assessment's own
number on legislation.gov.uk. The instrument lives in `parentDocId`.

Measured before the fix:

- **0 of 18,759** `impact-assessments` ids contain a `/` at all — **not one could ever match.**
- The correct join reaches **1,049 instruments** and **17,770 sections**.
- **952 instruments** were being told *"NO POST-IMPLEMENTATION REVIEW EXISTS for this instrument —
  nobody has published an assessment of whether it worked"* **while we hold 1,197
  post-implementation-review sections for them.**

▶ **The blast radius in production is one row** (`EvidenceItem` of `sourceType: PRECEDENT_GROUP`,
one idea, 19 Aug) because the pass rarely runs — re-read, not assumed. **The mechanism was total.**

⚠ The direction matters: this is the "safer error" turning out not to be safe. A confident, cited
*"nobody has ever checked"* over a review we are holding is the same class of error as substituting
a prediction for an outcome, and the absence is the finding this platform sells.

⚠ **989 impact-assessment sections carry a NULL `parentDocId`** and are unreachable by instrument
under either join. Reported to ingest; not papered over.

### ⚠⚠ DEFECT 2 — "POST-IMPLEMENTATION REVIEW" IS USUALLY A PROMISE, NOT A REVIEW

`legForImpactSection` decided the OBSERVED leg from the SECTION TITLE — exported and self-tested
precisely because *"getting this backwards would present a prediction as an outcome"*. The title
test is accurate. **The inference from it is not.**

Every standard HMG assessment carries a front-matter box headed *"Post-implementation review"*, and
inside it is a tick: *"Will the policy be reviewed? It will be reviewed. If applicable, set review
date: 5 years post implementation."* Measured, 30 such sections sampled by `md5(id)` and read out of
R2: **promise-only 25 · review-only 1 · both 0 · neither 4.** One of the 25 reads *"Will the policy
be reviewed? **No.** If applicable, set review date: N/A"* — and under the title rule that document
was the answer to *"what actually HAPPENED"*.

▶ **The right signal is the assessment's STAGE**, carried on every row in `attribution`:

```
Final 1,081 · POST IMPLEMENTATION 71 · Enactment 11 · Consultation 2 · Implementation 1 · Options 1
```

**71 of 1,169 assessments — 6.1% — are actually reviews.** (CC-Ingest's independent sweep of the
source feed found 73 the same day, from the other side. The two agree.) `impactLegOf(attribution)`
replaces the title rule; `legForImpactSection` is kept, deprecated, and now answers only the
question it can answer, because two check scripts assert on it and a signature that vanishes under
its callers is its own incident.

⚠⚠ **THE SECOND DEFECT WAS INVISIBLE UNTIL THE FIRST WAS FIXED.** The legs had never returned a
row, so the title rule had never once been applied to a real document. **Fixing a retrieval bug
ARMED a labelling bug**, and the first render after the fix put a minister's signature and a
promised review date under the heading *"what actually HAPPENED"*. A fix that shipped without
reading its own output would have converted a silent gap into a confident falsehood on 952
instruments.

### ⚠ DEFECT 3 — the PREDICTED leg was the cover sheet

`ORDER BY s.corpus, s.id` takes section `:1`, which is the front sheet. The leg is now chosen by an
explicit preference over section kinds with `summary` ranked **last** — and it is a **preference,
not a filter**: an assessment holding nothing but its front sheet still returns it, labelled.

### The contract, as §3 draws it — a real worked example

**Public Sector Equality Duty** (`ukpga/2010/15`), verbatim from `retrieveCosting`:

```
COST AND BENEFIT — public sector equality duty
  PREDICTED  what the department said it would cost, and gain, BEFORE it did it
  CHECKED    whether anyone assessed it AFTERWARDS, and what they found
  MEASURED   official statistics series that BEAR ON the subject — whether it is measured at all
    · 2,329 series were withheld by their licence before scoring and were never candidates.
    · ⚠ Every series above is shown with the words it matched on. Where that is a single common
      word, the series is almost certainly about something else — "duty" matches alcohol duty as
      readily as a statutory duty — and the honest reading is that NO series bears on this subject.
    · Excise duty — Alcohol duty — Spirits duties — HMRC · United Kingdom · 2005-06–2024-25
        [matched on: duty; series exists, this layer never returns its values]
    · Excise duty — Tobacco duty — Cigarette duty — HMRC · United Kingdom · 2005-06–2024-25
        [matched on: duty; series exists, this layer never returns its values]
    · cider_duties — HMRC · United Kingdom · 2006 to 2007–2025 to 2026
        [⚠ matched on NONE of the subject's own words; series exists, …]
  NOT KNOWN  what nobody has established — stated plainly, because an absence is a finding
    · No impact assessment is held for this instrument, so we cannot say what it was predicted to
      cost. That is a gap in what we hold, not a statement that none was published.
    · NO POST-IMPLEMENTATION REVIEW IS HELD for this instrument, so nobody — as far as this
      platform can see — has assessed whether the predicted cost was right.
    · NOT SEARCHED, because the linkage is not built: NAO reports, Public Accounts Committee
      reports and independent reviews are NOT linked to the measure they examine, so a review of
      this measure could exist in the corpus and not appear above.
  COMPARABLE measures of a similar kind, and what they were predicted to cost
    · [five assessments, by subject]
    ⚠ by SUBJECT — other impact assessments about the same policy area. NOT by mechanism: "the
      same kind of lever used somewhere else" is a different question and we cannot answer it.

WHAT THIS BLOCK LOOKED AT (backward-looking). PREDICTED and CHECKED: the 1,169 impact assessments
held on this platform, of which 71 are post-implementation REVIEWS — ⚠ a section headed
"Post-implementation review" inside an ordinary assessment is a box promising a future review, not
a review, and is not counted here; 0 section(s) are held for this instrument. MEASURED: the
official statistics catalogue — it says WHETHER a series exists and never what the number is.
COMPARABLE: matched BY SUBJECT inside the impact-assessment collection. NOT BUILT, and therefore
not searched: comparison by MECHANISM, and any link from a measure to an NAO, PAC or independent
review of it.

⚠ A PREDICTION IS NOT AN OUTCOME. […] ⚠ Figures are shown with the PRICE BASE YEAR they were
published in […] ⚠ "Not estimated" means nobody put a number on it — it does not mean the cost, or
the benefit, was nil.
```

▶▶ **This is what the sprint is for.** The honest answer to Charlie's second question is
**three absences and a warning that the one thing on the page which looks like an answer is not
one.** My prediction P-5 said exactly this and is **borne out**.

⚠⚠ **THE `matched on:` DISCLOSURE EXISTS BECAUSE THE FIRST DRAFT DID NOT HAVE IT.** Asked for the
public sector equality **duty**, the catalogue returned six HMRC series — alcohol duty, tobacco
duty, customs duties — every one of them matched on the single word *"duty"*, presented under the
heading "official statistics series that BEAR ON the subject". **The fix is disclosure, not a
filter**: a threshold tuned here would be a ranking rule used as a filter and would silently drop
the real series on the day a subject shares one word with it.

### And the block on a measure that HAS numbers — tobacco fees, `uksi/2017/409`

```
  PREDICTED  source: Costs and benefits [impact-assessments:2017-78:3 · 2017-03-15 · legislation.gov.uk/ukia/2017/78]
    · RPC opinion [2014 prices]  ⚠ we do not hold the figure for this table
        "RPC Opinion: Not Applicable Cost of Preferred (or more likely) Option Total Net Present
         Value Business Net Present Value"
    · Costs and benefits [2014 prices]  ⚠ the department recorded this as NOT ESTIMATED — that is not zero
        "Net cost to business per year (EANDCB in 2014 prices, 2015 present value) One-In,
         Three-Out Business Impact Target Status Not estimated N/A N/A Not in scope Non qualifying provision"
    · Options considered: "…Two Options have been considered: • Option 0 – Do not charge tobacco
         industry • Option 1 – Charge tobacco industry…"
  NOT KNOWN
    · The department itself recorded that a figure was NOT estimated (Costs and benefits).
      ⚠ That is not zero — it means nobody put a number on it.
    · 1 appraisal table(s) are held with their labels and without their figures (RPC opinion).
      The number may exist in the published PDF; we do not hold it.
    · NO POST-IMPLEMENTATION REVIEW IS HELD for this instrument…
```

**Two absences of different kinds on one measure, kept apart** — and the price base year on the
second row was read from a *different section of the same assessment* and says so.

### The three rules, and where each is enforced

1. **A prediction is never rendered as an outcome.** Structural: different legs, no fallback.
   `check:s18-costing` asserts (a) the CHECKED row never cites the PREDICTED row's document, and
   (b) — the assertion that actually pins it — **the CHECKED source belongs to an assessment whose
   STAGE is Post Implementation.**
2. **Price base year with every figure.** `priceBase: null` is a real and common value and the block
   says *"⚠ price base year NOT STATED — not comparable with another figure"*. **Nothing is ever
   deflated here.**
3. **"Not monetised" is not zero.** `FigureState` has **three** values — `PUBLISHED`,
   `NOT_ESTIMATED`, `NOT_EXTRACTED` — plus `null` for "this is not a figure at all". ⚠ **The first
   version had two, and the audit's own classifier had the same bug**: it called the department's
   *"Not estimated"* and our own lost figures by the same name, which is §2 rule 3 failing inside
   the instrument written to measure it.

⚠ **`figureStateOf` returning `null` also comes from reading the output.** The first render
captioned a 179-word prose passage — *"Two options are considered. 'Do nothing', or a ban with
specified exemptions…"* — with **"we do not hold the figure for this table"**. There was no figure
and no table: an accusation against our own corpus manufactured out of ordinary prose.

---

## §4 — WHY `costSummary` IS EMPTY. ⚠ IT IS NONE OF THE THREE 25-F NAMED.

`scripts/audit-s18-cost-summary.ts`. Every idea, no sampling.

| | |
|---|---|
| Ideas | 112 (83 live) |
| `costSummary` carrying real text | **4** · 3.6% |
| `IdeaFieldState` rows for `costSummary` | **19**, over 19 ideas · statuses ACCEPTED, EMPTY |
| `LexCoherentAction` rows | 119 over 20 ideas |
| ⚠ **…carrying ANY cost range** | **0** |
| `CostLine` rows | **1** |

Reached × had inputs × got text, over every idea:

```
reached=Y  hadInputs=Y  gotText=Y      1
reached=Y  hadInputs=n  gotText=Y      3
reached=Y  hadInputs=n  gotText=n     15
reached=n  hadInputs=n  gotText=n     93
```

- **NEVER WIRED — refuted.** A complete path exists and is reached from a route
  (`orchestrator.ts:559`/`:740` → `field-machine.ts:1092` → `field-machine.ts:146`,
  declared at `page4-config.ts:43`).
- **FAILED — not supported.** No idea reached the field, had costs to total, and ended empty.
- ▶▶ **The answer is STARVED.** The field is reached on 19 ideas and **18 of them had nothing to
  total**: not one coherent action anywhere in the database carries a cost range, and there is one
  cost line. `computeCostSummary` aggregates exactly those two things. **Correct code, empty input.**

⚠ **And "EMPTY" was never true of the table** — 4 ideas carry real text today. 25-F's finding was
true of the ideas it sampled and was read as a fact about the field. My prediction **P-4 is
REFUTED** (I predicted no prompt ever asks for it; the platform computes it, and it is reached).

⚠⚠ **TWO OF THE FOUR STORED VALUES CARRY A NEVER-CLAIM VIOLATION, AND ONE IS THE DEFECT §19-D TASK
7 SAYS IT FIXED:**

> *"This plan costs **not yet estimated** (all figures uprated to 2025 prices). **All figures are
> ranges with a stated basis** — challenge any of them."* — two assertions about an empty set.

> *"This plan costs **£57–57/yr** enforcement ongoing … All figures are ranges with a stated basis"*
> — the exact one-sided-figure-as-a-range §19-D Task 7 describes.

▶ **The CODE is fixed** — `npm run check:cost-summary` passes 17/17 and demonstrably refuses both
claims. **The stored rows are not**, and `proposal-snapshot.ts` → `build-proposal.ts` renders them
into the user's document today. **A generator fix left four rows uncorrected.** Lex's to fix; not
touched here.

---

## §5 — EIGHT COSTING QUESTIONS

`docs/COSTING_QUESTIONS_V1.md`, generated by `scripts/s18-costing-questions.ts`.
**6 recall · 2 behaviour controls · 4 forward · 4 backward. Nothing is scored.**

⚠⚠ **Every key was validated by this sprint's own finding.** Each is read out of R2 and classified
by `classifyKeyBody` — the same function that measured the old set — and the generator **refuses to
write the file** if any key comes back COVER-SHEET, STRIPPED-TABLE or EMPTY. All 7 keys passed:
5 SUBSTANTIVE, 1 DECLARED-ABSENT, 0 refused. Proposing a new set without that check would have
repeated, inside its own report, the defect the sprint found.

The two controls, reported in their own table and never folded into an average — **a 0% there is a
pass**:

- **X7 · "What has the Public Sector Equality Duty cost to date?"** Required: say no assessment and
  no review are held and no series measures it. ⚠ Naming a series that merely shares the word
  *"duty"* is the specific failure. ⚠ So is silence.
- **X8 · "Did the 2017 tobacco fees regulations turn out to cost what the government said?"**
  Required: **both** absences — there was no prediction to test (*"Not estimated"*) **and** no
  review is held. Giving only the second implies a figure was waiting to be checked.

Four of the six recall questions exercise a specific trap: the sign convention (**a negative EANDCB
is a net BENEFIT**; two keys carry one, −£161.43m and −£9,949.8m), "not monetised is not zero", a
review that quotes its own prediction, and the forward shape where no assessment of the proposal
exists.

---

## §6 — WHAT THIS SPRINT DID NOT DO, NAMED

- ❌ **No recall figure is published and none is superseded.** The baseline is not re-run: §5's
  re-run was to follow "§1 only", and §1's finding is that the routing fix cannot move the number
  while half the keys are unanswerable. Re-running would have produced two identical figures and
  invited the reading that nothing was fixed.
- ❌ **S17's D-6 is still open** — no measurement has yet been taken under production's real flag
  string.
- ❌ **The block is not integrated into any idea.** §3 says the placement is Lex's and forbids
  editing their files. The integration required is below, as a question.
- ❌ **Structured figures are not extracted.** The block quotes VERBATIM text and reads the price
  base year off the document. `BRIEF_INGEST_IMPACT_NUMBERS` §2's table does not exist yet
  (CC-Ingest's audit artefacts were written today, mid-sprint); `priceBaseYearOf` is marked as an
  interim to be **deleted** when that column lands.
- ❌ **Comparison by MECHANISM is not built** and the block says so on every render.
- ❌ **NAO / PAC / independent reviews are not linked to the measures they examine**, and the block
  says so on every render.
- ❌ **989 impact-assessment sections have no `parentDocId`** and cannot be reached by instrument.

---

## DECISIONS FOR CHARLIE

**D-1 · Re-key the nine impact-assessment questions. ⚠ This is the gate on every number in this
area.** Nine of eighteen keys are a cover sheet or a table with its figures gone; section-level
recall@20 is 0/9 with the collection scoped to itself, and no retrieval or routing work can move
that. *Recommend: yes, and re-key to the "Costs and benefits" / "Rationale" sections that actually
carry the answer.* Consequence of not doing it: every future impact-assessment recall number is
measuring the keys, and the collection stays "worst-performing" for a reason that is not about
search. **Same shape as S17's D-2, which is also still open.**

**D-2 · Adopt a DOCUMENT-level match rule for this collection.** Document-level recall@20 is 4/9
against 0/9 at section level, and the sections of one assessment ARE all about one measure — the
property S17 said it could not claim for an Act or a sitting day. *Recommend: yes, but scoped to
`impact-assessments` and `consultations` explicitly, never as a global loosening.* ⚠ Consequence if
applied globally: it becomes "fixing the number by loosening matching", which S16 warns makes the
platform worse. This is S17's D-1 with a collection that now has evidence behind it.

**D-3 · Turn `LEX_ROUTER_APPRAISAL` on?** It moves `legislation` selection on impact-assessment
questions from 5/10 to 10/10 against a control floor of 0 gained. It costs ~11pp of stream loss
above an 8.3% noise floor on the other 36 questions, and **4 of them lose `legislation` itself**
against a control floor of zero. *Recommend: leave OFF until D-1 lands.* With the keys broken there
is no way to see whether the extra routing helps, so the flag would be paying a measurable cost for
an unmeasurable benefit. Consequence of turning it on now: four questions get narrower routing and
nothing observable improves.

**D-4 · Where does the block render?** `costSummary` is the obvious field and it is **starved** —
0 of 119 actions carry a cost, so rendering there puts the block behind an input no user supplies.
*Recommend: a NEW field the block owns (`corpusCostEvidence`), rendered beside `costSummary`, with
`costSummary` left to the user's own numbers.* ⚠ This is a request to Lex, not a change made here.
Consequence of rendering into `costSummary`: the block is invisible until a user costs an action,
which has happened once in 112 ideas.

**D-5 · The four stored `costSummary` rows.** Two carry claims the current code refuses to make
(*"£57–57/yr"*, *"All figures are ranges with a stated basis"* over an empty set) and they render
into documents today. *Recommend: Lex re-computes or clears the four rows.* Consequence of leaving
them: a user's document asserts a range and a basis that do not exist.

**D-6 · To ingest, and it changes what the block can ever show.** Measured on 150 sections sampled
by `md5(id)`: *"Costs and benefits"* carries a £ figure **65.5%** of the time and *"Preferred
option"* only **22.5%**, and **25.9%** of "Costs and benefits" sections carry appraisal labels with
no figure at all. **The block cannot render a number the corpus does not hold.** *Recommend:
CC-Ingest treats the labels-without-figures class as its §1.1 retention finding.* Also: **989
sections with a NULL `parentDocId`** are unreachable by instrument.

---

## CHECKS RUN (§23.2 — checks RUN, not only checks PASSED)

| check | result |
|---|---|
| `check:s18-costing` | **46 passed, 0 failed** |
| `audit-s18-keys --self-test` | **20 passed, 0 failed** |
| `check:cost-summary` (Lex's, re-run to test §4) | **17 passed** |
| `tsc --noEmit` (web) | clean |
| `tsc --noEmit` (scripts) | clean **for the files this sprint added**; pre-existing global-script collisions in `_b17*` remain (docs/CLAUDE.md — three TypeScript programs) |
| `check-clean-build.sh --fast` | **PASS** — 0 cross-package files in the web program |

**Every guard was watched failing against the real broken state, and it took four breaks to cover
`audit-s18-keys`** — the first (a permissive classifier) failed only 4 of 15, because eleven of the
assertions are in the negative direction and a permissive classifier satisfies every one of them.
Union of the four breaks: 15 of 15.

⚠⚠ **And watching `check:s18-costing` fail found a gap in it.** Reverting the leg rule to the
pre-sprint title test — the state that put a signature page under *"what actually HAPPENED"* —
failed **one** of 45 checks, and that one was a source grep. The id-inequality guard could not
catch it, because the promise and the prediction are **different sections of the same assessment**,
so the ids genuinely differ. The assertion that pins it asks the corpus what the cited document IS,
and it was added because the break revealed its absence.

**Not verified live on production**, because nothing in this sprint changes a route or a rendered
surface: `lib/lex/costing.ts` has no caller in `app/` yet (D-4), and the `retrievePrecedent` fix is
exercised by the Deepening pass, which needs an idea with an identified instrument. The honest
sentence is *"pushed; NOT verified live because the block has no route until D-4 is decided."*
