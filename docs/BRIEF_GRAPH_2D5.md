# BRIEF — GRAPH 2D-5: SHOW THE WORKING, THEN TEST A DIFFERENT ARCHITECTURE

**Owner:** CC-Graph
**Stream:** GRAPH
**Written:** 17 August 2026
**Follows:** 2D-4 — the error rate on the same fifty went from 27 wrong to 22 wrong from one change,
and version 3 was correctly refused for fixing none of the failures it was built for.

**Where this sits:**
- *2D-3:* first extraction, 27 of 50 wrong on a hand read
- *2D-4:* 22 of 50, attributable to one change
- **This: 2D-5 — show Charlie the actual documents, then test whether the whole approach is the
  right one**
- ⚠ **Do not re-extract the full set yet.** $8.50 to move from unshowable to unshowable is not a
  purchase. Keep iterating on the fifty at $0.62 a cycle.

---

## §1 — The sample document, and this comes first

Charlie has asked to read the actual material rather than the scores. **He is right to, and it should
have been offered rather than requested.** Every number in this workstream is a summary of judgements
nobody outside the thread has seen.

**Produce `docs/POSITION_SAMPLE.md`** — roughly a dozen cases, chosen to span the failure types
rather than to look good. For each:

1. **The claim**, as put to the extractor.
2. **The submission** — who wrote it, which inquiry, and enough of the actual text to judge by.
   ⚠ **Real prose, not a snippet stripped of context.** If it takes 400 words to see why a passage is
   or is not a position, use 400 words.
3. **What the extractor recorded** — the polarity and the passage it quoted.
4. **What the hand-read concluded**, and **the reasoning in a sentence**.

**Include, deliberately:** two or three it got right, one where it invented a position, one where a
qualified view was recorded as a plain one, one where it quoted the bibliography, one it declined
that it should have declined, and — if one exists — one where the hand-read is arguable.

⚠ **Mark the arguable ones as arguable.** The hand-read is itself a judgement, and a sample that
presents every score as obvious would misrepresent how this actually works.

---

## §2 — Charlie's challenge on neutrality, which finds a real weakness

> *If an entity has been asked to submit on a specialist subject it seems unlikely that most would be
> completely neutral… even someone broadly neutral would make say 4 points for one side and 5 for the
> other, so there would be degrees of support.*

**Two different things are being conflated in the current design, and separating them is the work.**

- **Silence** — a submission about damp and repairs says nothing about 80 of the 83 claims. That is
  not neutrality; it is a different subject.
- **Engaged but not one-sided** — the submission addresses the claim and does not come down cleanly.
  Four points one way, five the other. **This is real and the current design handles it badly.**

The evidence that it handles it badly is in 2D-4's own numbers: **11 of the 50 failures were a
qualified position recorded as a plain one**, `balanced` was used 6 times in 16,196 rows, and version
3's attempt to add a `qualified` polarity fixed **none** of the 11.

⚠ **2D-4's conclusion stands and should be honoured: a conditional position needs a SECOND PASS, not
another field.** Version 3 proved that adding output fields degrades the extraction itself. So:

**On the positions the extractor is most confident about, run a second, narrower question:**
*is this position qualified, and if so by what?* One thing asked at a time. Score it on the same
fifty.

⚠ **And Charlie's second point deserves recording even where it cannot be measured:** an organisation
invited to give evidence *because it is expert* is not a neutral party in the ordinary sense, even
when its submission is balanced. **Being asked is itself a fact about standing.** We already hold it
— the `gave-evidence-to` edge — and it should be surfaced alongside the position rather than folded
into it.

---

## §3 — What the committee asked is context, and we are throwing it away

> *If the committee was itself biased in one direction and phrased the question so that neutrality is
> itself a position that is not neutral in the wider context.*

**This is right and nothing in the current design accounts for it.** An inquiry titled *"How should
the Government implement X"* has already conceded X. A submission that engages neutrally with *how*
has accepted *whether*, and recording it as "balanced" would misrepresent it.

**Capture the inquiry's own framing** — its title and, where published, its terms of reference — and
store it on the inquiry rather than on the position.

⚠ **Do not adjust the position for it.** Adjusting would be us inferring a bias correction and
presenting it as data. **Record the framing next to the position and let the reader see both.** That
is the same discipline as everywhere else in this design: show the working, do not do the reasoning
for the user.

---

## §4 — Charlie's bigger idea: extract the claims, do not ask about them

> *Submissions may have revealing data about other questions, not the specific one in the headline of
> the committee… we almost need to parse them all and pull out all the claims on all matters, so we
> have a secondary parallel corpus of just the claims.*

**This is a better architecture than the one in the design document, and the design document is
mine.**

**What we do now is top-down.** We wrote 83 claims for one policy area and asked every submission
about each. **It can only ever find positions on claims somebody thought of in advance** — so a
submission that contains something genuinely surprising, or something relevant to a different
inquiry entirely, contributes nothing.

**What Charlie is describing is bottom-up.** Read each submission once and pull out every claim it
makes, whatever the inquiry was about. The output is a corpus of claims with an author, a date and a
source, which can then be queried by anyone about anything.

**Three advantages, and the third is the one that matters most:**

1. **It finds what we did not think to ask.** The current approach is blind by construction.
2. **It is probably not more expensive.** One pass per submission, against 83 questions per
   submission today.
3. **It matches how the product actually needs to work.** *"Who has said anything about this?"* is
   the real user question. *"Does this document address claim 47?"* never was.

**And two real difficulties, which is why this is a test rather than a switch:**

- **There is no answer key.** Top-down can be scored against fixed claims. Bottom-up produces claims
  nobody specified, and *"is this a good claim to have extracted?"* is a harder thing to score.
  **Design the scoring before running the extraction**, or the result will be unmeasurable and
  therefore unusable.
- **The same claim arrives in many wordings.** Two organisations saying the same thing differently
  must end up together or the corpus is unqueryable. That is a clustering problem and it is not free.

### The test

⚠ **Do not switch architecture on an argument. Run both on the same submissions and compare.**

- Take the submissions behind the existing fifty hand-scored positions.
- Run bottom-up claim extraction over them.
- **Report: how many claims were found that the 83 do not cover; how many of the 83 the bottom-up
  pass also found; and the cost per submission for each approach.**
- Hand-read a sample of the extracted claims and report how many are real claims worth holding
  against how many are trivia, restatement, or the submission describing itself.

**That comparison decides the architecture.** If bottom-up finds materially more at similar cost and
the claims survive a hand read, the design changes and this brief's §2 and §3 fold into it.

---

## §5 — Standing

- Label change-log and handoff entries **GRAPH**.
- ⚠ **Still nothing user-facing.** 22 wrong in 50 is better than 27 and is not showable.
- ⚠ **The graph of record stays untouched** — trials in `graph_position_trial`, as 2D-4 did.
