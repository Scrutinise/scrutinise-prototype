# DESIGN — THE MECHANISM GRAPH AND THE ARGUMENT GRAPH

**Written:** 23 August 2026, by CCh-Search **Status:** design paper. Nothing here is built. Cite by section number in briefs. **Sits under:** `SEARCH_STRATEGY_v5.md` §9.3 (the mechanism lens) and §3.1 (principle streams), both of which this paper replaces and expands.

***

## 1. Two different things were being called "principles"

Charlie separated these and the separation is the reason this paper exists. They are genuinely different objects, they are built differently, and conflating them has kept both on the shelf.

**The mechanism graph** is about **provisions**. It tags a piece of law by *what kind of lever it is*, not what subject it covers: a levy with a rebate, a duty to consult, a licensing regime with a fitness test, a sunset clause, a reversed burden of proof, a statutory time limit with a default. It answers: *"Where else has this lever been used, and what happened when it was?"*

**The argument graph** is about **passages of speech and evidence**. It tags a paragraph of a debate, a witness answer, or a piece of written evidence by *what kind of move it makes*: a cost objection, a warning about unintended consequences, a doubt about whether anyone will enforce it, a rights objection, a "this belongs in guidance, not statute" objection. It answers: *"What is the strongest argument against my idea, who made it, and what happened to it?"*

⚠ **The join between them is the platform's most valuable asset, and it does not exist anywhere else.** An argument is almost always an argument *about a mechanism*. "Sunset clauses create a cliff edge for business" is an argument attached to a lever, made in a debate about something else entirely. Once both are tagged, a housing reformer can be shown the enforcement-cost objection that sank an identical mechanism in fisheries — a connection nobody has ever been able to make, because every existing system indexes by subject.

**A note on names.** "Principle graph" has been used for both. This paper uses **mechanism** and **argument**. Anything called "principle streams" in older documents — reading National Audit Office and Public Accounts Committee evaluations as *lessons* rather than as documents — is a third thing and belongs with the mechanism graph, because a lesson is a finding about how a lever performed.

***

## 2. Why debates fail today, which is not primarily a vector problem

**What a user experiences.** Ask what MPs have argued about an idea and the platform answers weakly, or with the wrong debate. On its first honest measurement debates scored **0 of 11**.

Four causes, in the order they should be fixed. **Only the fourth is what most people would call a search-quality problem.**

### 2.1 We retrieve a passage and then display the wrong text

The meaning-based index already works at **chunk** level — roughly a paragraph. But what gets shown is the **head of the document**. That is how the case-law stylesheet defect stayed invisible for months: the stylesheet sat at the top of the body, and the top of the body is what gets served.

For a 4,000-word speech, the head is the opening pleasantries. The system finds the right paragraph and shows a different one. **This is the single most consequential defect for debates and it is a display-layer change, not a retrieval change.**

▶ **Fix: return the matched chunk with its offsets, and show that.** Then the answer to "what did MPs argue about assisted dying" is the three sentences where somebody argued it, not the first three sentences of the sitting.

### 2.2 The merge throws away what the search found

Each source is searched separately and the five lists are merged into one. On guidance, **six of ten questions found the right document inside its own stream's list and lost it in the merge**. In-stream recall is 48%; merged it is 34%.

Debates suffers a particular version of this: a debate speech and a committee report are ranked against each other on scores that were never comparable, and a long speech and a short paragraph are not comparable either. **This is the next search sprint and it is agreed as the priority.**

### 2.3 The answer key marks debates on a harder target than everything else

A debates question is scored correct only if search returns **one specific speech out of \~200** in a sitting. A committee question is scored correct if it returns a whole report. Same test, different difficulty. Charlie has approved widening the debates keys to any speech in the same debate.

⚠ Until that lands, **no number about debates means anything**, including the 0 of 11 and including the earlier "meaning-based search is 15 points worse on debates" that has kept it switched off.

### 2.4 Only then: is meaning-based search right for debates?

Charlie's instinct — that debates are exactly where meaning-based search should shine, because you are looking for an argument that may appear inside a debate on a different topic — is right, **and it is the opposite of the reason it was switched off.** The earlier measurement asked *"does this find the right debate?"*, where matching the words is nearly unbeatable, because a debate about e-scooters says "e-scooter" constantly. It never asked *"does this find the right argument?"*, which is the question that matters and the one only meaning-based search can answer.

▶ **So the setting should not be re-decided on the old question.** It should be re-decided after 2.1 and 2.3, on questions of the form *"find me the argument that X"*.

***

## 3. The argument graph

### 3.1 The unit is a passage, not a document

A passage is a chunk of roughly 100–250 words, already the unit the meaning-based index uses. Every passage carries what we already hold: **who said it, their party, the date, the debate or inquiry it sat in, and whether it was said in the chamber or to a committee.**

⚠ **Where a passage was said changes what it is worth.** Chamber speech is performative and written for an audience; committee evidence and inquiry testimony are markedly less so. That weighting is a property of the source and should be recorded, not discovered repeatedly.

### 3.2 The taxonomy of moves

Deliberately small to begin with — a taxonomy nobody can apply consistently is worse than none. A first set, each of which a user would recognise as a thing they need:

| tag                | the move it makes                                               |
|--------------------|-----------------------------------------------------------------|
| `COST`             | this will cost more than claimed, or the costing is wrong       |
| `ENFORCEMENT`      | nobody will enforce it / the enforcer lacks capacity            |
| `UNINTENDED`       | it will produce this specific consequence nobody wants          |
| `EVIDENCE_GAP`     | the problem is not established, or the data does not show it    |
| `WRONG_VEHICLE`    | this belongs in guidance, or in secondary legislation, not here |
| `RIGHTS`           | it conflicts with a right, a convention, or the rule of law     |
| `PRECEDENT`        | this was tried before, here is what happened                    |
| `SCOPE`            | it catches things it should not, or misses things it should     |
| `IMPLEMENTATION`   | it cannot be operated as drafted                                |
| `SUPPORT_EVIDENCE` | affirmative: here is why it will work, with evidence            |

⚠ **A passage can carry more than one tag and most carry none.** The failure mode of the earlier position work was a model that produced an answer because being asked a question feels like being asked to answer. **"This passage makes no argument" must be the easy, default, unpunished output**, and the check should assert that a sizeable proportion of any real sample comes back untagged.

### 3.3 Tag at query time first, pre-compute only what proves worth it

**This is the cost discipline that decides whether the argument graph is affordable.** We hold 15.1 million parliamentary sections. Tagging them all with a model up front would be a very large bill for a benefit nobody has yet measured.

Instead:

1.  **Retrieve broadly** with meaning-based search — a few hundred candidate passages.
2.  **Tag only those candidates**, at query time. The deepening passes run in the background with a minutes-long budget, which is exactly what this needs.
3.  **Store every tag produced**, so the corpus tags itself in the places users actually go, and the pre-computed set grows for free along the paths that matter.
4.  **Pre-compute in bulk only where measurement shows it pays** — most likely for the debates on bills that are frequently asked about.

⚠ **Record the cost of every pass beside its estimate.** Estimates in this project have run low repeatedly, and the one time an estimate was accurate it was because somebody counted the real output rather than modelling it.

### 3.4 Confidence and provenance, exactly as the position graph learned it

Every tag is an **estimate**, not a fact: it carries the passage id, the model and prompt version, and a confidence. A tag is never displayed as though it were a property of the document. The position graph's rebuild established the pattern — facts in an immutable layer, estimates derived and rebuildable — and this follows it.

### 3.5 What a user actually gets

Not a list of documents. **Arguments, grouped by the move they make, each with the words somebody actually said, who said it, when, and where:**

>   **Enforcement (4 arguments)** *"…the local authority has no officers to inspect and the duty will sit unused…"* — Baroness X, Lords Committee, 14 March 2019, Housing and Planning Bill

⚠ This is also where the platform's existing honesty rules do the most work. If we searched and found no counter-argument, that must be said — the deepening pass already flags one-sidedness and cannot yet cure it. **The argument graph is the cure.**

***

## 4. The mechanism graph

### 4.1 The unit is a provision

A section or regulation, tagged by the lever it uses. The taxonomy is a genuine piece of jurisprudential work and should start from existing scholarship on regulatory instruments rather than being invented here — that is a research task in its own right and should be named as one.

### 4.2 It fights both our retrieval methods, deliberately

**A mechanism analogue is topically distant by design.** Matching the words and matching the meaning both reward *similarity*, and a levy-and-rebate in fisheries is maximally dissimilar to one in housing. So this cannot be a tuning change — retrieval happens **over the tags**, not over the text. Find the mechanism, then find every other provision carrying it.

⚠ **This is why the mechanism graph has to be tagged in bulk and cannot be tagged at query time**, unlike the argument graph. You cannot retrieve candidates by similarity when similarity is precisely what you are trying to escape. That makes it the more expensive of the two and the one that must be scoped carefully. **Start with a narrow, high-value slice** — for example, every provision in Acts passed since 2000 that creates a duty, a power, or a charge — rather than all 1.6 million.

### 4.3 What it connects to

-   **Outcomes.** We hold explanatory notes (what a provision was *for*), impact assessments (what was *predicted*), and post-implementation reviews (what *happened*) — already assembled as a group by the precedent retrieval built this month. Tag the provision by mechanism and that group becomes *"here is how this lever performed the last five times it was used."*
-   **The National Audit Office and Public Accounts Committee**, read as lessons about levers rather than as documents about departments.
-   **The position graph**, which is where mechanism-transfer becomes possible: *"the people who resisted this lever in another domain."*
-   **The argument graph**, per §1. This is the join.

***

## 5. Build order, and what gates what

| Stage | What it is                                                                                | Gated on                                                 |
|-------|-------------------------------------------------------------------------------------------|----------------------------------------------------------|
| **0** | Fix the merge (next search sprint)                                                        | agreed, in hand                                          |
| **1** | **Show the matched passage instead of the head of the document** (§2.1)                   | the merge; small, and the largest single win for debates |
| **2** | Widen the debates answer keys (§2.3), then re-measure debates properly                    | Charlie has approved; the key change is his              |
| **3** | New question type: *"find me the argument that X"* — \~10 questions, validated by Charlie | stage 1, because the answers are passages                |
| **4** | Argument tagging at query time, small taxonomy, measured against stage 3                  | stage 3                                                  |
| **5** | Group results by argument rather than by document type                                    | stage 4                                                  |
| **6** | Mechanism taxonomy: research, then a narrow bulk tagging pilot                            | independent of 1–5; can start any time as design work    |
| **7** | The join — arguments about mechanisms, and mechanism analogues                            | 5 and 6                                                  |

⚠ **Stages 1–5 improve debates, committee evidence and inquiry evidence at the same time**, because all three are the same shape of problem: the useful thing is a passage inside a long document about something adjacent.

***

## 6. How each stage is judged

-   **Stage 1** — of results shown for debates questions, how many display text containing the reason the result was retrieved? Today this is close to zero by design.
-   **Stages 2–4** — recall on the argument questions, with the count of questions that *could* have shown a difference stated every time. A floor effect is not a null result.
-   **Stage 4 specifically** — hand-read 50 tagged passages. Report separately: **is the tag right**, and **should this passage have been tagged at all?** The position work established that the second is where models fail, not the first.
-   **Stage 6** — a mechanism taxonomy is only real if two people applying it to the same fifty provisions agree. Measure that before tagging anything in bulk.

⚠ **Nothing here reaches a user until it is measured against questions Charlie has validated.** That gate has now caught four wrong case-law keys and 138 unsound position candidates, and both times the machine's own confidence was high.

***

## 7. What Charlie decides

1.  **Argument taxonomy first, mechanism taxonomy second?** Recommended: yes. The argument graph reuses retrieval we already have, is cheap because it tags at query time, and fixes a stream that is currently answering nothing. The mechanism graph is the bigger prize and needs bulk tagging, a real taxonomy, and money.
2.  **The ten-tag taxonomy in §3.2** — the tags are the product. They should be the ten things Charlie most wants to be told about his own proposal.
3.  **Where mechanism tagging starts**, when it starts — a narrow high-value slice, not everything.
4.  **The new question type in stage 3** — about ten questions of the form *"find me the argument that X"*, drafted by a coding session and validated by Charlie.  
    \---

    **Themes someone would pay for.** Six in the paper; the strongest four:

    another good one to start with might be any new legislation that had an above-average regulatory burden (if we have a good way of computing that), giving us a hot-list of 'expensive' legislation to target if we want to make laws more efficient. Another would be any new tax that created a cliff-edge of high marginal tax. If this is going to cost money, finding 'themes' that would incite someone to pay use to produce it, would be helpful, can you think of any?

-   **The burden hot list** — impact assessments carry a declared annual cost to business, and we hold 18,756 of them. The sharper product isn't the league table: it's *the most expensive measures nobody ever checked the cost of*. We already assemble that comparison.
-   **Cliff edges** — the marginal-rate traps, the childcare withdrawal, registration thresholds. Computable from charging and threshold provisions. Accountants and tax advisers.
-   **The review calendar** — every sunset clause and review duty as a dated forward diary of what Parliament promised to look at again. That's a natural subscription for public affairs teams.
-   **Passed but never commenced** — laws enacted and never brought into force. Nobody has counted them. That's a story, and a compliance risk for people who assumed otherwise.

    The first three are computable from tags plus fields we already hold, so their cost is the tagging we're doing anyway. But the one to lead with in any funding conversation is **mechanisms that failed** — levers tried, reviewed, reversed, with the argument that predicted it. The others are useful; that one is unique.
