# SURFACE 4 — the audit first, then what a user can now click

**Sprint:** SURFACE 4. **Written:** 2026-09-04. **Brief:** `docs/BRIEF_SURFACE_4.md`.
**Executes:** the open half of `SURFACE_3_REPORT.md` plus Charlie's observation —
*"Key people and groups shows up a couple but you can't click through."*

Every figure below is a live query or a rendered document, and each says which.

---

## §1 — THE AUDIT. WAS THE EVIDENCE IN THE PAYLOAD, OR DROPPED ON THE WAY?

**It was in the payload, and in the row, and on the screen.** `claimFor()` returns `grounds[]`
with the date, the direction, the signal type and a source URL per act; the panel exposes both the
body and a real link. **This was not a missing view.** It was three separate things, and the brief
predicted two of them exactly.

### ⚠⚠ Finding 1 — the screen and the document used DIFFERENT MATCHERS and disagreed on 4 of 25 of Charlie's ideas

**This is the answer to "you can't click through", and it is my own defect from SURFACE 3.**

| path | what it read |
|---|---|
| the drillable claim card (`findClaimTarget`) | one blob — `problem` + `goalDetail`, **title left out** |
| the document filer (`filePositionsForIdea`) | the **title passed separately**, so title phrases outranked body phrases |

On *The Sentencing Council and sentencing guidelines*, *Civil Service Decision Paralysis* and both
plastic-bag ideas, **the document carried positions and the card beside them resolved to NO TARGET
and rendered nothing.** The names Charlie could see were the filed document rows; the thing with
the links was blank.

▶ **Fixed by deletion, not by patching both.** There is now one resolver — `lib/graph/
idea-target.ts` — and both callers import it. `check:surface-4` asserts over **all 83 live ideas**
that the two paths return the identical target: **83 of 83 agree, 0 disagree.** The control calls
the old title-less shape and requires it to diverge; **it diverges on 12 of 40 ideas**, so the fix
was load-bearing rather than cosmetic.

### ⚠⚠ Finding 2 — "a couple" is literally correct, and the cause is that WE HOLD NO EDM SIGNATURES

The brief asked whether "a couple" might be a second filter doing what the phrase-selection bug
did. **It is not a filter. It is the data.**

| target kind | actors returned |
|---|---:|
| a division | **189–254** |
| an Early Day Motion | **exactly 1, always** |

Most ideas match an EDM. And an EDM returns one actor because:

```
edm_sponsor           60,995 rows over 60,995 motions  = 1.00 per motion
sponsors_count        2,125,547 signatories PUBLISHED  = 34.8 per motion
motions with >1 signatory                      58,193
```

**We hold the member who TABLED each motion. We hold none of the ~2.06 million signatures.** The
position graph's own design document calls an EDM signature *"the highest-confidence position
signal anywhere"* — and we have never had one.

⚠ **This also corrects SURFACE 3's own coverage wording**, which called the layer *"signatures on
Early Day Motions"*. It is sponsorships, and describing it as signatures made a limit look like a
result. Fixed in `position-coverage.ts`; the surface now says so in ordinary words whenever the
target is a motion.

### ⚠⚠ Finding 3 — the five names in the document were ALPHABETICAL, and nothing said so

`positionsFor()` has computed a `Ranking` since GRAPH 3B, for exactly this. On *Human Rights Act
1998*: **254 actors matched, 12 tied at the top, `shownOrderIsNameOrderOnly = true`**, and the
graph produced the sentence

> *5 of 254 actors, tied at this confidence (0.394, 1 signal) — ordered by name. This is not a
> ranking.*

**Both of my SURFACE 3 assemblers threw it away.** So the report printed five names out of 254, in
name order, as though they were the significant people. That is the precise failure `Ranking` was
built to prevent — `/admin/positions` once said *"showing the top 40"* over an alphabetical list —
and it is the **third time this thread has had correct data computed and then dropped by the layer
that assembles the output**. It is now carried into the card and the document, and asserted.

---

## WHAT A USER NOW SEES — a real example, from Charlie's own idea

**Idea: *Human Rights Act 1998 and the European Convention on Human Rights*.** Rendered through the
app's own readers, not described:

**On the card** (what a user judges, before we show ours):

> Where does **Brian Leishman** stand on *"European Convention on Human Rights (withdrawal): Ten
> Minute Rule Motion"*?
> This person, identified.
> *We picked this by matching the phrase "european convention on human" from your own words…
> That is a close match to your subject. This is a recorded division, so everyone who voted is
> here.*
> **2025-10-29 · against · "European Convention on Human Rights (withdrawal)" → [source]**
> ⚠ *We are showing **one of 254** people with a record on this. 12 actors are tied at the top of
> this order (confidence 0.394, 1 signal); among those the order is by name.*

**In the long report**, each name is its own openable card carrying:

> What the record shows. **Brian Leishman, Parliament member id 5196** — This person, identified.
>
> 2025-10-29 — against "European Convention on Human Rights (withdrawal): Ten Minute Rule Motion"
> (vote, **sitting as Independent**)
>     https://votes.parliament.uk/Votes/Commons/Division/2159
>
> Our reading of those acts, **which is an estimate and not a finding**: opposed… Confidence: some
> recorded signals **(0.39 on a scale of 0 to 1)**.
>
> How this question was chosen. We matched the phrase "european convention on human" (4 words)…
>
> **Who else is here. 5 of 254 actors, tied at this confidence — ordered by name. This is not a
> ranking.**
>
> *Computed on 2026-09-04 under method 3c.7bac2c10d652.*

⚠ **The body is now plain text with the URL on its own line**, because the question panel renders
that field with `whitespace-pre-wrap` and **not** as markdown — so SURFACE 3's `**bold**` and `- `
bullets were printing as literal asterisks and hyphens. Asserted, with a control.

---

## §2 — WHY 39 IDEAS SHOW NOTHING. THE THREE COUNTS

Of **83** live ideas, **44 find a target**. The other 39, measured:

| | count | what the surface now says |
|---|---:|---|
| **Parliament HAS debated it; we hold no division or motion** | **6** | *"Parliament has discussed this subject — we can find it in the debate record — but we hold no division or motion on it we can attribute to named members. That is a gap in what we hold."* |
| **Nothing we hold mentions the subject at all** | **33** | *"Nothing in the record we hold mentions this subject… A subject can be entirely absent here and well established in Parliament."* |
| **Names nothing concrete enough to look up** | 0 today | *"The record we hold is of specific things — a division, a motion, an inquiry, an organisation — never of topics."* |

The 6: *The Great Repeal*, *Gender self-identification*, *E-Cycle Speed Restriction*,
*Homelessness Reduction Act 2017*, *Homes (Fitness for Human Habitation)*, *Well-being of Future
Generations*. Several of the 33 are untitled or scratch drafts; one is *Addressing Litter in
Huddersfield*, which is genuinely too local for a national record.

⚠⚠ **My first attempt at this count was wrong and I caught it by printing the corpus list.** It
queried `corpus_sections` for corpora named `debates` and `commons-debates`, **which do not
exist** — the real names are `pwdata-debates`, `historic-hansard`, `pwdata-lords` — and returned a
confident *"0 discussed elsewhere, 39 nowhere"*. A wrong question, answered without complaint.

---

## §3 — INTO THE PRINTED REPORT

Every item the brief lists is now carried, asserted by rendering the real document:

| §3 requires | carried |
|---|---|
| the actor — name, **party at the time**, identifier | ✓ *"Brian Leishman, Parliament member id 5196"*, *"sitting as Independent"* |
| the concrete target with title and date | ✓ |
| the stance, or the recorded act with no stance | ✓ |
| confidence as **both a number and the shared function's words** | ✓ *"some recorded signals (0.39 on a scale of 0 to 1)"* |
| **every** supporting act — what, when, how classified, its source | ✓ each on its own line with its URL |
| the config version and the date computed | ✓ |
| the coverage statement **beside the positions** as well as in the report | ✓ its own row under the heading |

⚠ **Party is read off the vote record and printed beside the ACT, never beside the name.** A member
who has crossed the floor since must not appear under today's label next to a vote cast under
another. It is `NULL` on a motion, because a motion carries no party — and an invented one would be
exactly the plausible wrong detail this graph exists to refuse.

**On the freeze:** unchanged from SURFACE 3 and still correct — `ProposalVersion.snapshot` stores
its own copy, so a published version cannot re-render against a changed graph, and the date and
method are in the prose as well, which protects any paragraph copied out of it.

---

## §4 — THE TWO THINGS SURFACE 3 LEFT

- ▶▶ **`NO_PRODUCER_NOTE.POSITIONS` — LANDED, by Lex, in `1f157f2` (26-A §3).** The note is
  deleted, `HEADINGS_WITH_NO_PRODUCER` is now `['COST_DURATION']` alone, and `heading-map.ts`
  records positions as a producer with the reasoning: *"A capability is a capability whichever code
  path exercises it."* **`check:lex-25d` passes 77/0 with my changes in the tree.**
- ▶ **The one-line `build.ts` change — NOT LANDED.** `grep -rn "filePositionsForIdea"
  scrutinise-web/lib/lex/` returns only a comment in `heading-map.ts` describing it. **Positions
  are still filed only by `npm run positions:file` or the route.** Nothing is broken by this; it
  means a rebuild does not refresh the section until someone runs it.
- ▶ **`DonationReview` still has no route.** The exact change needed, for Lex:
  `components/lex/QuestionPanel.tsx`, beside the existing `<ClaimReview ideaId={ideaId} />` at
  line 795, add `<DonationReview ideaId={ideaId} />` under the same heading. The component, the
  API (`/api/graph/donations`) and the storage are built, checked and deployed. **One import and
  one line.**

---

## WHAT IS **NOT** DONE, NAMED

1. **We hold no EDM signatures** — ~2.06 million of them, the single largest coverage gap in the
   position graph. Ingesting them is a SURFACE/INGEST sprint of its own, not a fix here.
2. **`build.ts` still does not file positions** (above).
3. **`DonationReview` is still unrendered** (above).
4. **The card still shows ONE actor of up to 254.** That is 25-L's blind-judgement design and I did
   not weaken it; it now states the ratio instead of implying significance. A "show me the others"
   control is a decision, not an oversight — question 2 below.
5. **Confidence vocabularies still differ between positions and donations.** Positions use
   `describeConfidence()`'s three bands; donation tiers use moderate/low/none. Mapping one onto the
   other would mean inventing a numeric confidence for a tier. Question 3 below.
6. **Estimates remain unvalidated.** No answer key; the coverage statement says so live.
7. **6 ideas name subjects Parliament has debated where we hold no division.** Improving that means
   matching against the debate record, which is new retrieval and out of scope per §5.

---

## DECISIONS FOR CHARLIE

**1 · Should we ingest EDM signatures?** ~2.06 million rows from Parliament's own API.
- **(a) Yes, next sprint.** ← recommended. *Consequence:* an EDM target goes from 1 name to ~35,
  and the design's highest-confidence signal type starts existing. It is the difference between
  "shows up a couple" being a bug report and being a data statement. Cost is an ingest run, no
  model spend.
- (b) No. *Consequence:* motions stay one-name for ever, and the surface keeps explaining why.

**2 · Should the card offer "show me the others"?**
- **(a) No — keep one, and state the ratio.** ← recommended. *Consequence:* the blind-judgement
  experiment stays clean; a user who sees 254 names before judging is judging our list, not the
  record. The ratio sentence already tells them the list exists.
- (b) Yes, after they judge. *Consequence:* more useful to a report writer, and it needs a second
  surface with its own ranking problem — the 254 are genuinely tied.

**3 · One confidence vocabulary, or two?**
- **(a) Keep two, and label the scale.** ← recommended. *Consequence:* a donation tier is not a
  [0,1] estimate and forcing it through `describeConfidence()` would mean manufacturing a score.
  The words differ because the things differ.
- (b) One vocabulary everywhere. *Consequence:* consistent adjectives, bought with an invented
  number — the exact move `position-config.ts` refuses everywhere else.

**4 · Should a published report offer a re-run?** (The brief recommends it and I agree.)
- **(a) A published version keeps its figures and offers "re-check against today's record".** ←
  recommended. *Consequence:* the document never silently changes, and a reader can see whether it
  has moved. Small build.
- (b) Leave it frozen with no re-run. *Consequence:* correct but inert; the only way to refresh is
  to publish again.

---

## ▶ WHAT CHARLIE SHOULD OPEN, AND WHAT HE SHOULD BE ABLE TO CLICK

| # | open this | you should be able to click |
|---|---|---|
| 1 | **Human Rights Act 1998 and the European Convention on Human Rights** → the background panel → *Key people and groups likely to support or oppose* | **Six entries.** Open any one: the act, the date, *"sitting as Independent"*, and **"Open the original ↗"** → `votes.parliament.uk`. That link is the click that did not exist. |
| 2 | the same heading, the **beta card** below the entries | A named member, their one recorded act **with its own source link**, and — new — *"We are showing one of 254 people with a record on this."* |
| 3 | **Enhancing Civil Service Accountability** → the same heading | One entry, and the card now agrees with it. Before this sprint the card said nothing here. |
| 4 | any idea with no positions — e.g. **Gender self-identification** | Not an empty panel: *"Parliament has discussed this subject… but we hold no division or motion on it."* |
| 5 | **Outputs → the long report** on any of the 22 | The section, each position with its member id, party at the time, act, link, numeric confidence, the *"this is not a ranking"* line, and the coverage statement. |

**Checks:** `check:surface-4` **26/0 (8 controls, 0 dead)** · `check:surface-3` 41/0 ·
`check:surface-3-donations` 23/0 · `check:lex-25d` 77/0 · `tsc` clean · `check:client-boundary`
clean · `check-clean-build.sh --fast` PASS.
