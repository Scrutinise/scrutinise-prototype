# GRAPH 2D-5 — THE DOCUMENTS, AND A BETTER ARCHITECTURE MEASURED RATHER THAN ARGUED

**Executes:** `docs/BRIEF_GRAPH_2D5.md` §1–§5
**Written:** 17 August 2026, 21:52 UTC
**Owner:** CC-Graph
**Cost:** **$0.88** — $0.06 qualification pass, $0.58 bottom-up arm, $0.16 top-down arm re-run for
the cost comparison, $0.08 coverage matching. No full re-extraction (§0: "$8.50 to move from
unshowable to unshowable is not a purchase").
**Verification:** `npx tsx position-graph/verify-2d5.ts` — **26/26**, including two negative controls
that fire on planted faults.

---

## THE SHORT VERSION

| | |
|---|---|
| **§1 the sample** | ✅ `docs/POSITION_SAMPLE.md` — 13 cases in full prose, spanning the failure types, with two of my own hand-reads marked as arguable. All fifty dumped so the selection can be audited. |
| **§2 qualification** | ⚠ **Half works.** 3 of the 11 known nuance failures fixed; 53% of what it found is real. **And it exposed that the baseline was understated** — 6 of the 23 rows scored "correct" carry a qualification nobody had recorded. |
| **§3 inquiry framing** | ✅ Captured for all 12 inquiries and stored on the inquiry, never on the position. ⚠⚠ **2 of 12 published "scopes" are the Committee's own report conclusions** — Charlie's point is not hypothetical. |
| **§4 architecture** | ⚠ **Bottom-up wins on discovery and LOSES on cost.** 74.4% of its claims lie outside all 83 propositions and 85% of a hand-read sample are real claims — but it costs **3.73× top-down**, not less, and it recovers only **57%** of the positions we know are right. |

**The recommendation is a supplement, not a switch.** The decision rule was fixed before the numbers
existed and bottom-up fails one of its three conditions.

---

## §1 — THE SAMPLE DOCUMENT

**`docs/POSITION_SAMPLE.md`.** Thirteen cases: three it got right, one where it correctly stayed
silent on four claims its author certainly holds views on, two reversed polarities, two positions
attached to topically-adjacent passages, one where it quoted a **bibliography**, two flattened
qualifications, and **two where I mark my own hand-read as arguable**.

⚠ **The selection is a judgement, so all fifty are dumped** to
`position-graph/sample-2d5-cases.json` by `sample-2d5.ts`. The twelve I did not choose can be read.

Three things the writing-up surfaced that the scores had hidden:

⚠ **The bibliography case passes every mechanical check we have.** Case 9's "passage" is the title of
a cited paper under the heading *References*. The words really are in the document, verbatim and
contiguous, so extract-verification says found; it is over 20 characters and looks like prose. **The
only signal is that it sits at 94% of the way through.** 7 of the fifty extracts come from the last
15% and only 3 are failures, so a position rule costs more than it saves — 2D-4 already measured that
at 4.3% false positives. **The real conclusion is that we throw away the document's structure before
the model sees it.**

⚠ **Some of the 83 propositions cannot be answered either way.** Case 13 bundles a subject (MSK
prevention) with a named vehicle (the Major Conditions Strategy); a submission that addresses one and
not the other is neither `for` nor `against`. That is a fault in claim-writing, and it is an argument
for §4.

⚠ **`capacity` is quietly doing well.** Case 1 is a hospice chairman writing "I write… **our** position
is clear" — first person singular, organisational view. The extractor recorded `representative`.

---

## §2 — QUALIFICATION AS A SECOND PASS

**Built as §2 and 2D-4 both require: a second call, not another field.** v3 had added a `qualified`
polarity and a `condition` field to the same prompt and fixed **none** of the 11 while pushing
mechanical discards from 22 to 62.

⚠⚠ **The new pass CANNOT change a polarity, and that is enforced rather than requested** — its
response schema has no polarity field at all, so there is no channel through which a bad second pass
could corrupt the column that already works. The verifier asserts it and **fires on a planted polarity
field**. Four kinds are recorded (`conditional` / `scoped` / `weighed` / `reserved`) because a bare
"qualified" would be as lossy as the "for" it replaces. Every condition must be **quoted**; all 24
located quotes were found in their documents.

### The result, and the correction that changed it

| | |
|---|---:|
| known nuance failures fixed | **3 / 11 (27%)** |
| qualifications located in total | 24 |
| …with the quote verified in the document | **24 / 24** |
| precision **as first computed** | 18% |
| ⚠ **precision after hand-adjudication** | **53%** |

⚠⚠ **The first number was wrong and the way it was wrong matters.** My scoring design counted every
qualification found on a baseline-"correct" row as a false positive. But **those 23 rows were scored
on polarity and extract — the hand-read never asked whether they were qualified.** Counting them as
false positives assumed something the answer key does not contain. That is an uncontrolled comparison
of precisely the kind this workstream has been caught making before.

So all 14 were re-read by hand (`qualify-verdicts.json`, one verdict and one reason each).
**Six are genuine qualifications** — Care England asking for funding *in social care settings*
specifically; a GP partnership saying the model is sustainable *"for us locally"* before a financial-risk
reservation; Dr Burville's *"benefits for certain groups (multi-morbidity/elderly)"*. **Eight are not** —
most often because a **reason** was recorded as a **condition** (FODO's "not all premises have separate
entry/exits" is *why* they oppose zoning, not a limit on their opposition).

⚠⚠ **And this makes the baseline worse, not better. 6 of the 23 rows we called correct carry an
unrecorded qualification. The nuance problem is bigger than 11 in 50.**

⚠ One diagnostic worth keeping: **14 of the 24 located conditions re-quote the position passage**
rather than a limiting one — the pass found no new evidence, it re-described one sentence. *The first
version of that check used substring containment and fired on 21 of 24, including six I had just
certified as genuine. Containment is the normal case; a condition legitimately sits inside the passage
that states the position. The rule is equality and nothing looser.*

⚠ **Charlie's second point, recorded because it cannot be measured:** an organisation invited to give
evidence *because it is expert* is not neutral in the ordinary sense even when balanced. We already
hold `gave-evidence-to`, and it should be surfaced beside the position rather than folded into it.
**Not built this sprint** — it is a display decision, and nothing is displayed yet.

---

## §3 — WHAT THE COMMITTEE ASKED

**Captured for all 12 inquiries behind the fifty, stored in `graph_inquiry`, keyed by inquiry.**

⚠ **The obvious source is blocked and the right one is not.** `committees.parliament.uk/work/{ref}/`
returns **403 with a Cloudflare "Just a moment…" challenge** on every programmatic GET. The same
record is on `committees-api.parliament.uk/api/CommitteeBusiness/{ref}`, unchallenged. ⚠ The field is
called **`scope`** — there is no `termsOfReference`, and looking for one is how this gets written up
as unavailable.

⚠⚠ **NOTHING ADJUSTS A POSITION, AND THAT IS CHECKED.** §3: *"Adjusting would be us inferring a bias
correction and presenting it as data."* The verifier greps every file in the stream for a statement
that reads framing and writes a polarity, and **fires on a planted `UPDATE graph_position SET polarity
= f.x FROM graph_inquiry f`**.

### ⚠⚠ Charlie's point is not hypothetical — 2 of 12 framings are the Committee's own conclusions

Not "this inquiry seems slanted", which would be my reading. **A fact about the text:** on two of the
twelve, the published scope carries an attribution phrase that makes it a report finding.

> **Primary care inquiry (ref 3005)** — the *entire* scope is:
> *"Primary care is the bedrock of the NHS and the setting for ninety per cent of all NHS patient
> contacts but it is under unprecedented strain and struggling to keep pace with relentlessly rising
> demand, **warns the Health Committee in its report**."*

> **Children and young people's mental health (ref 2912)** — opens:
> *"Schools and colleges struggle to provide adequate time and resource for pupils' well-being,
> **according to the Health and Education Committees in a joint report published today**."*

A submission engaging with either has accepted a premise the Committee had already stated as a
finding. **We now store that next to the position and let the reader see both.** The detection rule is
an attribution phrase, so it reports provenance rather than grading bias — and the self-test includes
the case it deliberately does *not* catch: a scope that asserts a substantive claim **without**
attributing it to the Committee (Healthy Ageing's *"Physical activity can help prevent ill health"*)
is left unflagged, because catching that would require judging the claim.

⚠ One further finding: **inquiry 277's entire "scope" is an administrative status note** — *"The
Committee held its last oral evidence session… on Tuesday 30 June 2020."* The terms of reference have
been overwritten. It carries **6,255 position rows**, the second-largest inquiry in the set, and we
have no record of what it asked.

---

## §4 — TOP-DOWN vs BOTTOM-UP, MEASURED

⚠ **The scoring was fixed and printed before any extraction ran** (`--design`), as §4 requires, with
a decision rule stated before the numbers existed: *bottom-up replaces top-down only if it matches a
majority of the certified-correct positions AND its novel claims survive the hand read AND the cost is
comparable. Failing any one of the three, it is a supplement or a no.*

Both arms ran over **the same 49 submissions, in the same session, on the same meter**. The top-down
arm re-ran 2D-4's winning prompt (imported, not re-typed) and **wrote no positions** — the graph of
record is untouched, asserted by the verifier at exactly 37,657 rows and 16,196 positions.

### Measure 3 — cost. ⚠ The brief's prediction is refuted.

| arm | in tokens | out tokens | total | per submission |
|---|---:|---:|---:|---:|
| top-down (83 propositions) | 271,137 | 29,880 | **$0.1560** | $0.00318 |
| bottom-up (no vocabulary) | 161,504 | **213,383** | **$0.5819** | $0.01188 |

**Bottom-up costs 3.73× top-down.** §4 predicted *"it is probably not more expensive"* — and the
reasoning behind that prediction was right about the half it considered and silent on the half that
dominates. **Input really is cheaper**: 161k against 271k, because there is no 83-proposition
vocabulary on every call. But **output is 7× larger** — 39.4 claims per submission against 5.1
positions — and output bills at 8.3× the input rate. *One pass per submission is not one unit of cost
per submission.*

⚠ **And 39.4 is censored: 35 of the 49 submissions hit the 40-claim cap** (one returned 77 anyway).
The true rate, and the true cost, are higher than measured.

### Measure 1 — recall against the only answer key that exists

**13 of the 23 hand-certified-correct positions were also found bottom-up = 57%.**

⚠ Two further matches were **refused by the verbatim-echo guard**: the matcher said "matched" and then
could not quote the claim it had matched. Counted as not matched, never resolved to a nearest row —
2D-3 was bitten once by trusting a model-supplied index and the fault was intermittent, which a spot
check cannot find. The honest ceiling is therefore 15/23 = 65%.

**57% is the number that decides the recommendation.** Bottom-up misses two of every five positions
we know are right.

### Measure 2 — what the 83 do not cover

| | |
|---|---:|
| claims extracted | **1,933** over 49 submissions (39.4 each) |
| covered by one of the 83 | 494 (25.6%) |
| ⚠ **not covered by any of the 83** | **1,439 (74.4%)** |
| model-supplied claim numbers outside the list, discarded | 7 |

⚠⚠ **This number was nearly an artefact.** My first implementation would have computed it as
"claims minus the measure-1 matches" — but measure 1 only tests **23** propositions, so it would have
reported **1,920 of 1,933 uncovered** when 60 of the 83 had never been put to a single claim. It would
have been the largest number in the sprint and it would have been a fact about my test. Coverage is
now asked properly: all 83 put to every claim, one call per submission.

### ⚠ Measure 4 — the hand read, which is what decides

A volume of 1,439 is worthless if it is self-description. **40 claims read by hand**
(`claims-handread.json`, deterministic sample, one verdict each):

| | | |
|---|---:|---|
| **REAL** — contestable, worth holding | **34 (85%)** | *"Swimming was the only sporting activity associated with a protective effect against falls"* · *"The majority of these doctors neither support a legal change nor would they personally be involved"* |
| self-description | 3 | *"We intend to consult on this work in 2021."* |
| trivia | 2 | a single school's staffing ask |
| **not a claim** | **1** | ⚠ see below |
| restatement | 0 | |

**85% real.** So roughly **1,220 real claims from 49 submissions lie outside everything the 83 could
ask** — and they are the kind we could not have thought to ask for: what doctors think, which sport
prevents falls, why policymakers cannot apply research evidence.

⚠ **The one outright failure is the bibliography case in a new costume.** Claim 769's quote is a bare
bullet — *"Workforce development aligned to national standards."* — and the model supplied the verb
that makes it a claim (*"is an enabler for system collaboration"*). **The assertion is ours, not the
submitter's.** Same root cause as POSITION_SAMPLE Case 9: the document arrives as an undifferentiated
wall of text with its headings, tables and lists stripped of their role. **That is now two failure
modes in two different architectures traced to one missing input, and it is the highest-value fix
available in this workstream.**

⚠ Also worth flagging: on the assisted-dying hospice letter the model set `isAboutSelf` **true** for
the organisation's own policy position. That flag is wrong in exactly the direction that would filter
out the most valuable rows, so it must not be used as a filter.

### ⚠⚠ NOT MEASURED — clustering, and the floor that turned out to be useless

§4's second difficulty is that the same claim arrives in many wordings. **This run does not address
it.** I intended the exact-duplicate-string count as a floor; it came back **0 of 1,933**, which tells
us only that the model never emitted the same string twice — a fact about its phrasing, not about the
corpus. *"Continuity of care benefits"*, *"Continuity of care importance"* and *"Continuity of care
factors"* appear as three separate subjects. **A floor of zero is uninformative and is reported as
uninformative.** The clustering problem stands entirely open, and it is the thing that decides whether
a bottom-up corpus is queryable at all.

### The verdict against the rule fixed in advance

| condition | result |
|---|---|
| matches a majority of certified-correct positions | ⚠ **57%** — a bare majority, with 43% lost |
| novel claims survive the hand read | ✅ **85% real** |
| cost is comparable | ❌ **3.73×**, and censored by the cap |

**Two of three. So: a SUPPLEMENT, not a switch — and not yet at corpus scale.**

Bottom-up finds a great deal the current design is blind to by construction, and the hand read says
that material is real. But it loses two of every five positions we already know are right, so
replacing top-down would trade a known error rate for an unknown one. ▶ **The sequenced answer is to
run bottom-up as a second layer on the submissions that matter, and to fix the structure problem
first** — because 3.73× on 39 claims per submission, at least one of which is a heading the model
turned into an assertion, is paying more for a corpus with the same defect.

---

## What should happen next, in order

1. ⚠⚠ **Give the model the document's structure.** Headings, reference lists, tables and bullet
   fragments, marked as what they are. **Two failure modes in two architectures come from this one
   missing input** — the bibliography quoted as a position, and the bullet turned into a claim. It is
   the cheapest high-value fix in the workstream and it is not a prompt change.
2. **Clustering.** Until two organisations saying the same thing land together, a bottom-up corpus
   cannot be queried, and no volume number means anything.
3. **Re-read the 23 "correct" rows for qualification.** Six of them are qualified and unrecorded, so
   the error rate of record is understated. That is a hand-read, not a spend.
4. **Fix the claim-writing fault** that bundles a subject with a named policy vehicle (Case 13).
5. **Surface `gave-evidence-to` beside the position** when anything is finally displayed.
6. **Get inquiry 277's terms of reference** from somewhere other than the API — 6,255 position rows
   sit under a scope that is an administrative note.

## §5 — Standing

- ✅ Change-log and handoff entries labelled **GRAPH**.
- ✅ **Still nothing user-facing.** 22 wrong in 50 is not showable, and §2 found the true figure is
  worse than 22.
- ✅ **The graph of record is untouched** — 37,657 rows, 16,196 positions, 5 run ids, no new column.
  Everything this sprint wrote lives in `graph_inquiry`, `graph_position_qualifier`,
  `graph_claim_bottomup`, `graph_claim_match`, `graph_claim_coverage`, `graph_claim_cost`.
- ✅ No full re-extraction. **$0.88 against the $0.62-a-cycle budget** the brief set, for four sections.
