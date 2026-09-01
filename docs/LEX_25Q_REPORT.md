# Sprint 25-Q — the things a pilot tester will try and fail to do

**1 September 2026, 11:11 UTC.** Brief: `docs/BRIEF_25Q.md`.

§0 said to assume a fourth brief premise would be overturned by measurement. **Five were** — four of
them because 25-N had already fixed the thing. The one that was not is §1, and it was worse than
the brief described.

---

## §1 — Lex can talk about the draft but cannot write to it

### §1a — the diagnosis, which decided the size of everything else

**The chat is not read-only by construction.** `POST /api/ideas/[id]/lex` already writes: a valid
proposal for the *current* field goes to `setProposal`, and `causes` and `rootCause` have bespoke
handlers. **But it cannot reach the fields the middle panel renders**, for three independent
reasons, any one of which is sufficient:

1. **`validateProposal` has no schema for them.** `FIELD_VALUE_SCHEMAS` covers the text and
   structured fields and stops. `policyOptions`, `chosenApproach` and `actions` are absent, so
   `validateProposal` returns `null` — *"not a proposable field"* — and the rewrite is dropped with
   **no sign to the user at all**.
2. **Even a successful write would be invisible.** `setProposal` writes `IdeaFieldState.proposal`,
   and the loop fields do not render from it — they render their child rows. This is already
   written down in `field-machine.ts`'s §6a note: *"the panel does not read this value"*.
3. It writes immediately rather than offering, which is not what §1b asks for.

**Measured on Charlie's own idea rather than reasoned about:** `currentField` on `452c5ade` is
`policyOptions`, status `AWAITING_CONFIRMATION` — precisely the field with no schema. So that is
what happened to him, not a plausible story about what might have.

### What was built

Lex now returns an **offer**, and only a click writes it.

| | |
|---|---|
| **§1b** | A rewrite of a numbered candidate comes back as `editOffer`, rendered as a card: *"Shall I put that in as guiding policy 4? You can edit it after."* The card shows **what it says now** above what would replace it, because a card that asks you to overwrite a sentence without showing it asks you to decide from memory. |
| **§1c** | Accepting posts to `/field-edit`, which returns the new canonical state; `applyState` redraws the middle panel. No reload. Lex then says where it went, because the panel changed a few centimetres away and a user reading the chat has no reason to look unless told. |
| **§1d** | `FieldRevision` — a **table, not a `priorText` column**, because a column holds one previous version and loses the one before it, so the principle would hold for exactly one edit and then quietly stop. It records **who wrote the superseded text**, since "Lex's earlier draft was replaced" and "the user's own words were replaced" are different facts and only the second is testimony. `PriorVersions` renders it on the card: a row nobody can see is a record, not testimony. |
| **§1e** | Asserted on the **rendered panel**, through `computeCanonicalState`, with controls. |

**Three design points worth stating, because each one could reasonably have gone the other way:**

- **The offer and the write are separate endpoints.** `/lex` computes and writes nothing; `/field-edit`
  writes and computes nothing. That is what makes *"never a silent write"* a property of the system
  rather than a promise about a prompt — **a model cannot reach the write endpoint, because a model
  does not have a mouse.**
- **A rewrite is addressed by 25-P's stable number.** Those numbers never move, survive a merge and
  a restore, so the number Lex names in a turn still means the same row when the user presses Accept
  a minute later. Addressing by position would have made this quietly unsafe. **Ambiguity is refused,
  not guessed** — writing into whichever policy is nearest would be the product choosing which of the
  user's candidates to overwrite.
- **This does not make the policy loop chat-authored**, and the existing note saying it must not be
  still stands. Adding, costing and stress-testing options remains panel work. The one thing that
  crosses is a rewrite of an existing row's approach sentence, asked for by number.

---

## §2 — A build gives no sign it is running

**§2a is already built, by 25-N §1e, and I verified it live against the build running now.**
`RerunBanner` says *"Re-running now…"* and *"Re-run finished."* verbatim, on both surfaces. Measured
at 10:30 UTC against v8 (RUNNING, on ADVERSARIAL): `running = true`, so the re-run block renders
*"It is running now — you can re-run it again once this one finishes"*, **not a refusal**. Charlie
hit this before 25-N shipped on 31 August.

**§2b found a real defect inside that banner, in its purest form.** Mounted on the build page, its
finished control linked to `/ideas/build` — **the page the user was already on**. A control that
reloads where you are is exactly "left where they were", made worse by looking like a way out. It
was invisible because the banner is written once and mounted twice, and on the *other* surface the
same link was right. The banner now knows which surface it is on: from the build page a finished run
offers **"Go to the Strategy"**, from the Strategy it offers **"Reload to see it"** (the panel beside
them was drawn before the run finished), and a **stopped** run still goes to the build page, because
"what happened" is a question about the run. The running state no longer offers "Watch it" to
somebody already watching.

**§2c measured, and the answer is that the sentence the brief proposes would be the wrong one.**
`npm run measure:outputs-open`:

```
  quick=1  (pass 1)      46 ms
  full     (pass 1)     439 ms
  quick=1  (pass 2)      40 ms
  full     (pass 2)     169 ms
```

First paint is **46 ms**, not five seconds — 25-N §5d moved the twelve-table snapshot hash behind
it. **"Building reports" would be false: nothing is being built.** The remaining 439 ms is a
staleness read that happens after the filenames are on screen.

⚠ **My first version of that measurement printed a false alarm** — it asked whether `stale` was null
on *every* row and reported "the quick read is doing the expensive work" because two of four rows had
never been generated, and an ungenerated file cannot be out of date. The measurement was asking the
wrong question and would have sent someone to fix correct code. Scoped and noted in the script.

---

## §3 — Stage 1

**§3a — a Lex chat, which answers and does not conduct.** The elicitation owns the state machine on
that page; a chat that could propose a field or advance a stage would be a **second conductor on one
page**, and the two would disagree about which question is live. So `AskLexPanel` sends
`mode: 'ASK'`, and the route discards any proposal and never advances — the prompt says so *and* the
platform enforces it. ⚠ This is therefore **not literally "the same Lex/Notes pair used on Stage 2"**,
and the difference is stated rather than hidden: Stage 2's chat can fill boxes because Stage 2's
boxes are what the conversation is for. Notes are the same component, not a copy.

**§3b — moved, not copied.** Re-run, add-a-file and the new further-information box are now one block
directly under the section pills. Everything below that point is the *result* of the last run;
everything in the block is an input to the next one, which is the division a returning user is
actually making. The page was built for a first-time reader, and after the first build every visit is
the other kind.

**§3c — a box for something new.** Editing answer 2 rewrites the record of what the user told us
*and* costs a full search (25-G's reuse rule). Adding a note leaves the record intact and rides along.
It writes the `userCritique` field the re-run dialogue already uses — one store, two doors — and it
travels on **both** start paths, because two ways to start a run with only one of them reading the box
is how a user concludes they were ignored.

**§3d — one line above the pills.** They already carried a per-pill title, and a title is something
you find by hovering a thing you already suspect is a control.

---

## §4 — Uploaded files

**§4b, reported before building, as asked.** The permission set is `authorizeIdea` — **owner plus
collaborators** — and material is looked up scoped to the idea, never by id alone. So "can see the
idea" and "can see its files" *are* the same set, and there is nothing to reconcile.

**§4a is already built (25-N §1f) — and the download half cannot be built without changing what is
stored.** §25.6 stores extracted text and **no binary**: *"the file itself is never stored"* is
printed on the upload control and repeated in the viewer. "Open" therefore shows the text Lex read,
which is the thing that actually determined what Lex concluded, and a **link** carries "Original ↗"
to its own URL. Handing back a PDF would require storing one. **Not built; flagged as a product
decision rather than a defect.**

---

## §5 — "Findings" and "characters kept"

**Read what produces them, as instructed.** `findingCount` is the number of `EvidenceItem` rows
written from that document. `charCount` is `extracted.text.length`, and `extracted` has been through
`cap()`, which slices at `MAX_TEXT_CHARS` and nowhere else — so it is the length of what we hold, and
short of the document **only when the cap fired**.

25-N §1f had already moved "findings" into words on the list (*"Lex read this and took 9 findings from
it"*) and relocated the count into the viewer. What was left was the bare figure. It now reads either
*"That is all of it: 12,431 characters of text, nothing dropped"* or *"I kept the first 200,000
characters — about fifty pages — and the rest of it was not read."* **The two cases are different news
and must not share a sentence**; the second is the one thing a user genuinely needs to be told, and
the bare number never said it. The `truncated` flag is computed server-side, because the cap is an
environment variable and a client comparing against its own copy of 200,000 would be right until
somebody changed it.

---

## §6 — Lex can answer questions about the product

`lib/lex/product-facts.ts` — eight facts, written as **answers to questions somebody actually asks**,
because a list of features produces exactly the failure Charlie hit: a description of what a panel
contains, offered to somebody who asked how to get to it.

⚠ **§6's real instruction is its last clause**, and it is the half that would have been skipped:
*"sourced from one place that is also what 'How this works' renders"*. Putting the facts in the prompt
alone would have satisfied the feature and not the instruction. `HowItWorksModal` now renders
`PRODUCT_FACTS`; `productFactsBlock()` is the prompt's view of the same array. The drift this
prevents is not hypothetical — the panel names have been changed twice (25-K §1, 25-N §2) and the tour
was named both times as the last place a retired word could survive.

---

## §7 — Challenges: the attribution is in the wrong place

⚠ **The heading §7 names does not exist in any source file, and my first search of the data missed it
because the string is uppercase.** It is written by `build.ts`, and it is worse than a heading:

```
ANOTHER MODEL MADE THIS POINT AND OUR PROPOSAL DOES NOT ADDRESS IT — <the point> (<model>). <why>
```

**Eleven capitalised words of provenance in front of every coverage challenge**, with the model's name
in brackets in the middle of the sentence. So the most valuable output of the run was headed by its
own attribution and titled by nothing, and the same eleven words led all of them.

- **7a** — `DeepeningIssue.title`, required of the coverage check in both its schema **and** its prompt
  (CLAUDE.md §24: a schema field with no prose is a field the model has no reason to fill), asked for
  as a subject — *"Employment law exposure"* — never a sentence and never a restatement of the point.
- **7b** — `DeepeningIssue.sourceModel`, rendered at the foot: *"· Raised by claude-sonnet-5, reading
  your account on its own."*
- **The 36 existing rows are backfilled**, deterministically, because the template is ours: 36 of 36
  split, 36 named a model, and a control confirms a challenge without the prefix is left untouched.
  ⚠ **A third of them carried the attribution twice** — the point itself opened `[16] (claude-sonnet-5)`,
  the panel answer's own index and model name copied in "verbatim". Found by reading the rows, not the
  code.
- ⚠ **Titles are not backfilled.** A title is a judgement about what a point is *about*, and 25-D §3's
  rule is that the producer tags it. Old rows render without one rather than with a guess; new runs
  carry them.

Nothing else in this section was started.

---

## §8 — Three small ones

- **§8a — already built.** `isNotAsked` excludes those headings from *both* lists above the fold and
  they render last. Asserted so it stays true.
- **§8b — built.** The cause title was an `<input>`, which cannot grow at all, while the two boxes
  beneath it were resizable textareas. One control behaving unlike its neighbours reads as broken
  rather than as different. All three are now textareas, "why has it persisted" starts at four rows,
  and the same change went on the **add** form — fixing only the edit form would leave the two doors
  into one record behaving differently, which is the same complaint one step earlier.
- **§8c — already done by 25-N §5a, in both documents, conditionally.** Confirmed and unchanged, as
  the brief instructed.

---

## The checks

```
check:lex-25q    50 passed, 0 failed, 10 controls (0 dead)
check:lex-25p    72 passed, 0 failed, 24 controls (0 dead)
```

`check:lex-25q` creates a scratch idea, calls **the route's own `applyFieldEdit`**, and reads the
result back through `computeCanonicalState` — the panel the middle column draws from.

⚠ **Three things the checks caught in my own work this sprint**, which is the whole point of them:

1. **My first round trip re-implemented the route's transaction** instead of calling it — the exact
   thing CLAUDE.md §25.3 forbids, written by the person who added §25 last sprint. The write is now
   `lib/lex/field-edit-write.ts`, called by both.
2. **`check:text-integrity` went red** because I inserted two prompt blocks between `sourceValuesBlock`
   and `fieldBlock`. Those two are adjacent on purpose (§19-E Task 1: the complete source values sit
   immediately before the field they compose, so a summary cannot be written from an abridged stump).
   The new blocks moved in front. The check was right and I was wrong.
3. **`check:lex-25p` went red on correct code** — its own `findFirst` for a dated evidence row picked
   an arbitrary one, and once the running build wrote new rows it picked a `REJECTED` one, which
   `buildQuestionPanel` filters out. A check that picks its own subject must pick it by the same
   predicate the thing under test uses. Fixed there.

Also green: `lex-25o` 56/0, `lex-25n` 98/0, `lex-25d` 77/0, `lex-25l` 19/0, `lex-25m` 12/0,
`lex-general` 25/0, `documents`, `export`, `orientation`, `answer`, `text-integrity`, `panel-claims`,
`never-claim`, `sprint3e-ui`, `check:scripts`, `check-clean-build --fast`, and `npm run build`.

---

## §10 — What only Charlie's browser can confirm

The render assertions above are assertions. These are not confirmed by them:

1. **The Lex-writes-to-the-panel round trip on a real model call.** Whether Lex actually emits
   `targetNumber` when asked to rewrite "the second one", and whether the offer card appears at the
   right moment rather than on every helpful paragraph. The conservative guard means it will
   sometimes *miss* a rewrite; whether that reads as restraint or as unresponsiveness is a browser
   question.
2. **The "Re-running now" banner during an actual run**, and the new "Go to the Strategy" control at
   the end of one.
3. **Opening a file on a real upload**, and whether the new "that is all of it / I kept the first N"
   sentence reads as reassurance or as a warning.
4. **The Stage-1 Ask Lex box** — in particular whether it answers "how do I re-run this?" with the
   controls now sitting directly above it, and whether refusing to change anything there is
   experienced as honest or as unhelpful.
5. **The re-ordered Stage 1 page.** Moving three controls to the top is the largest visual change in
   the sprint and the one most likely to be wrong in a way no check can see.
6. **The challenges with titles.** Existing rows have none by design; only Charlie's next build will
   show whether the titles the coverage check produces are the *"Employment law issues"* kind or a
   restatement of the point.
