# LEX — positions: what is there, what is not, and the design point

Written 2026-09-03. **Nothing was built.** Every claim below is a code or database reading and
each says which. Where a previous report was wrong, it is corrected rather than restated.

> Charlie's intent: *"This is meant to be a detailed assessment of who is for and against this
> idea, or might be."* And it must be in the printed document, not screen-only.

---

## §A.1 — Does the POSITIONS heading reach the generated document?

**It does. 25-M §3's "no carrier" is CORRECTED — measured, not inferred.**

Rendered all three documents for the pilot proposal and searched for the exact heading string
`Key people and groups likely to support or oppose`:

| document | heading present |
|---|---|
| evidence pack | **YES** |
| long report | **YES** |
| meeting pack | **YES** |

⚠⚠ **THE CARRIER WAS NEVER MISSING. THE CONTENT WAS.** All three builders group evidence by
`headingKey` and skip any heading with no items (`if (!items?.length) continue`). POSITIONS was
absent because nothing had ever been filed under it — not because no path existed.

⚠⚠ **AND WHAT IT CARRIES TODAY IS ONE LINE, WHICH IS CHARLIE'S OWN DOCUMENT.** Exactly one
`EvidenceItem` in the entire database has `headingKey = 'POSITIONS'`:

- *"Ministers from across the political spectrum have expressed frustration with civil service
  resistance."*
- `sourceType: USER_DOCUMENT`, `status: PROPOSED`, `runVersion: 1`, written 30 August
- citation: *Accountability - UK minister talking about the challenges they faced from the civil
  service.docx*

It was filed under POSITIONS by the **material extraction**, not by any Lex pass. So the printed
report already contains a section headed *"Key people and groups likely to support or oppose"*
whose entire content is one sentence from a document Charlie uploaded himself.

**What is genuinely screen-only:**

- `NO_PRODUCER_NOTE` / `statedGap()` — the honest caveat *"No pass writes findings under this
  heading yet."* Called from `lib/lex/question-panel.ts` and **nowhere else**. No document
  imports it. So the screen says the heading is unproduced and the printed document does not.
- `ClaimReview` — the 25-L §5 beta record surface. Screen-only, and see §A.4.

---

## §A.2 — The smallest change that carries it into the document

**None. It is already carried.** §B's precondition is satisfied vacuously and there is nothing
to build for it — see §B.

The adjacent change that IS available, sized honestly:

**Carry the no-producer caveat into the three documents** — import `HEADINGS_WITH_NO_PRODUCER`
and `statedGap` and emit a note under the heading. **3 files, roughly 15 lines, no migration, no
model call, no build.** Risk: very low; it adds a note and changes no data.

⚠ **But it prints a disclaimer, not an assessment**, and it is not what §B asked for. It would
change tonight's positions section from *one line under a promising heading* to *one line under a
promising heading, plus a sentence saying no pass produces this*. That is more honest and less
impressive. **Charlie's call, one word either way.**

---

## §A.3 — Which flag gates it, and its live value

⚠⚠ **THERE IS NO FLAG. The positions surface is gated only by being signed in.**

- `grep flagEnabled` across `lib/graph/*.ts`, `components/lex/ClaimReview.tsx` and
  `components/lex/QuestionPanel.tsx` returns **nothing**.
- `app/api/graph/claim/route.ts` calls `getAuthenticatedUser()` and no capability check. Its own
  header says why, deliberately: *"SIGNED IN, BUT NOT ADMIN … gating it to admins would mean the
  only people scoring the graph are the people who built it."*
- `LEX_SEARCH_GRAPH` is **read live as `false`** on production (`/api/health`, commit
  `f272ec7`) — ⚠ **but it gates a different thing**: its only consumer is
  `lib/lex/search-gateway.ts:87`, the graph leg of retrieval. It does not touch the positions
  surface in either direction.

So: **on in production for every signed-in user, gated by nothing.** The admin-only surface
(`/admin/positions`, `PositionGraphExplorer`) is separate and is gated by the admin layout's role
check.

---

## §A.4 — Where it renders, and why Charlie could not find it

**Route:** `/ideas/create` → `CreateIdeaClient` → `BackgroundPanel` → `QuestionPanel` → open the
heading *"Key people and groups likely to support or oppose"* → `<ClaimReview>`.

⚠⚠ **AND ON HIS IDEA IT RENDERS NOTHING. That is the answer to why he could not identify it.**

Measured, by calling the same functions the route calls:

```
idea terms  → "The civil service is plagued by the same issues as any bureaucracy…"
findClaimTarget(terms) → NO TARGET
→ the route returns claim: null and an honest note
```

The note it returns is: *"We could not find a vote or motion in the record that clearly bears on
this subject, so there is nothing here to check. That is a gap in what we hold, not a statement
about whether anybody has taken a position."*

**The failure is the idea→target mapping, not the graph.** The graph has real data:

- `position_signal_for` returns **366 signals for a single recent Commons division**, each with
  an actor, a direction, a derivation (`whipped-with:v1`) and an evidence id.
- On `plastic bags` the same path finds an EDM, and `claimFor` returns a real claim —
  *Lord Goldsmith of Richmond Park*, 1 ground, coverage sentence computed.
- ⚠ **A correction to my own first reading:** I reported "no vote edges" after finding
  `graph_edge` holds only `gave-evidence-to` (162,733) and `declared-interest` (1,505). That was
  the wrong table — votes come through `position_signal_for`, not `graph_edge`. My first
  `claimFor` test also passed `questionText` where `actorId` belongs and returned a false null.
  Both corrected above by re-running.

⚠ **So the screen's own caveat is currently false.** `NO_PRODUCER_NOTE.POSITIONS` promises
*"What is here instead, in beta, is the record itself: how members have actually voted."* On this
idea nothing is there. The sentence was true when 25-L wrote it and is not true here.

### Does the screen state that the Commons division record begins in March 2016?

⚠⚠ **IT SAYS NOTHING. Not on any screen, in any file.** `grep -rn "2016"` across `lib/graph`,
`components/lex`, `components/admin` and `app/api/graph` returns **no match**.

What the user is shown instead is a **count**, computed at read time:

> *"Built from 1 recorded action across 1 question. 1 person has a record here."*

**And the date window is real and material:**

| house | divisions | earliest | latest |
|---|---:|---|---|
| Commons | 2,361 | **2016-03-09** | 2026-07-15 |
| Lords | 3,284 | 1999-11-24 | 2026-07-22 |

**The Commons record begins 9 March 2016 and nothing tells the user so.** A member who voted on
something in 2013 has no record here, and the screen's phrasing — *"1 person has a record here"* —
invites the reader to conclude nobody else took a position. ⚠ That is the same class as the
citation defect 25-V fixed: a true sentence that misleads because the coverage behind it is not
stated. **It should be stated wherever a count is shown, and it is a one-line change to
`coverage` in `lib/graph/claim-review.ts` — recommended for the next sprint, not tonight.**

---

## §B — NOT BUILT, and why

**§A.2's answer is "nothing to build":** the heading already reaches all three documents. The
only content it can carry today is one sentence from Charlie's own upload, and the beta surface
that was supposed to supply the rest returns nothing on this idea.

Building the caveat (§A.2's 15-line option) would print a disclaimer under a heading Charlie is
already covering with the title page's "in development" notice. **Left alone, as the brief
directs.** No files were changed.

---

## §C — Recorded vs likely. The design point, for the next sprint

**A recorded position and a likely position are different things and must be visibly different
on the page.** Nothing is built for this; what follows is the design and the specific hazards.

### The distinction, and where the existing code already gets it right

The 25-L machinery is closer to this than it looks, and the parts to keep are:

- **`stanceWording` and `confidenceWording` come from a fixed vocabulary** (`position-math.ts`),
  so two screens cannot invent two different adjectives for the same number. ⚠ Keep that. A free
  adjective at the render site is how "expected to oppose" becomes "opposes".
- **Every ground is a dated, sourced action** with a link. ⚠ Keep that as the *only* thing that
  may be printed unqualified.
- **`identityStatement` / `identityCaveat`** already distinguish an identified actor from a
  probable one, defined once in SQL. The same shape is what a likely position needs.

### What the page must do

**RECORDED — printed as a statement.**
The organisation or person said or did this. Quoted, cited, dated, linked. No hedge, because
none is needed. *"Voted against the Second Reading on 9 March 2021."*

**LIKELY — printed as Lex's reasoning, never as the actor's position.**
Three things must appear together or the item does not render at all:
1. the inference, worded as an expectation, never as a present-tense statement of position;
2. **the prior positions it reasoned from, shown, dated and linked** — not summarised, shown;
3. a visible label that this is Lex reasoning.

> ✅ *"The TaxPayers' Alliance is expected to oppose this, because it argued X in 2019 [link]."*
> ✗ *"The TaxPayers' Alliance opposes this."*

⚠⚠ **The failure mode is a rendering one, not a modelling one.** The wrong sentence is one
careless template away from the right one, and it is the same fault this thread has now found
four times: **correct data reaching the output stripped of the qualification that made it
correct** — the citation URL space (25-V), the challenge title (25-W), the policy sort (25-V), the
build's proposal on an accepted field (25-X). So:

- **The inference and its grounds must be ONE object in the snapshot**, not two fields a renderer
  can print separately. If the grounds are empty, the object does not exist. A renderer must not
  be *able* to print the claim alone.
- **Never colour alone** to distinguish the two (Charlie is colour blind, §21). The label text,
  a border weight and the presence of the grounds block are the cues.
- **The distinction must survive the document as well as the screen** — which is exactly the
  failure §A.1 found for the caveat, screen-only for two sprints.

⚠ **And the coverage window belongs on every likely position**, for the reason in §A.4: an
inference drawn from a record that starts in March 2016 is an inference about the last ten years,
and a reader who does not know that will read it as a career.

**One wrong attribution costs more than the feature is worth.** The cheapest guard is that the
claim cannot be constructed without its grounds — not a review step, not a prompt instruction, a
type.
