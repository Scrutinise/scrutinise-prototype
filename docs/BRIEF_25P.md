# BRIEF — Sprint 25-P: the Guiding Policy becomes a decision, not a list

**Thread:** LEX. **Written:** 31 August 2026, evening.
**Source:** Charlie's walkthrough finding *"How do I choose? Do I have to choose one only?"*; his
decisions of 31 August; Rumelt's published method, researched rather than recalled; and the four
items 25-O and its addendum left open.

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. ⚠ **Two of the last three briefs had a false premise that measurement overturned, and CC
was right both times. Expect a third.** Batch the rest into one report. **Stop only for** spend
beyond a ceiling or a change of scope. Shell per CLAUDE.md §22.

**§1 is the sprint.** §2–§5 if reached, in order. If the sprint runs long, stop at a section
boundary and report — do not leave §1 half-built.

**Charlie is asleep.** Nothing in this brief needs his browser until §1 is complete. Say plainly at
the end what he must confirm himself.

**Must not be disturbed:** the divider fix, the toggling kernel headings, the report running header,
the two collapsed sections from the addendum, the three write paths now proven live
(`verify:write-paths` 13/0), and the commentary pass added in 25-O — **which has still never been
generated and must not be modified before it has been seen once.**

**Also do not disturb:** `/ideas/build`. Charlie's decision, on CC's own measurement — it is the
front door and Stage 1, it stays exactly as it is for the pilot, and the "See this as others would"
control stays where it is.

---

## §1 — The Guiding Policy screen

### 1.0 Why this exists

Today Lex produces a list of possible guiding policies and the user has no way to act on it. The
walkthrough finding was *"How do I choose? Do I have to choose one only?"* — and there is no answer
on screen. This section builds the answer.

**The method is Rumelt's own and should be followed rather than improvised.** Two things from the
published work drive the design:

- **A guiding policy rules out as many options as it rules in.** It is the approach to the obstacles
  named in the diagnosis — a signpost marking direction without defining the details of the trip.
  Coherent actions are the feasible, coordinated commitments that carry it out. ⚠ **The single most
  common defect in a generated list is a coherent action wearing a guiding policy's clothes.**
- **The reduction is collect → cluster → filter.** Filter by sequencing the immediate first and by
  rating each item for *importance* and *addressability*. Rumelt is explicit that these are separate
  judgements and that the discipline is not to spread effort across all of them.

### 1.1 Numbering

Every guiding policy carries a **stable number, 1..n**, shown on screen. Charlie refers to them by
number when instructing Lex ("merge 4 and 8"). ⚠ **Stable means the number does not change when
another item is merged, rejected or moved.** A rejected 7 leaves a gap; nothing renumbers. **Why:**
a renumbering between the user reading and the user typing turns "merge 4 and 8" into a merge of two
different policies, silently.

### 1.2 Step one — Sort, and show the sorting

Lex applies three tests to every item on the list:

1. **Does it rule things out?** A guiding policy closes doors. If it closes none, it is a goal.
2. **Can several different actions be derived from it?** If so, it is a policy. If the item *is* the
   thing you do, it is an action.
3. **Does it name an instrument, a body, a date or an amount?** "Amend s.12 of the 2014 Act" is an
   action. "Move accountability from the department to the frontline body" is a policy.

**Three outcomes**, and all three are shown to the user with the reasoning:

- **Stays a guiding policy.**
- **Is really a coherent action.** See 1.3 — this does not simply vanish.
- **Is really a restatement of the goal.** Set aside, with the reason.

⚠ **Visible, not silent.** If Lex removes four of a user's twelve without saying so, the user
believes Lex lost them. The screen says *"Three of these were not guiding policies. Here is why, and
here is where each has gone."*

### 1.3 An item that is really a coherent action moves out of the section — with consent

**Charlie's instruction, and it is right against Rumelt's structure.** An item that fails the test is
not demoted within the guiding-policy list; it belongs in the **coherent actions** section of the
kernel. Lex **proposes** the move with its reasoning; the user accepts or rejects; only then does it
move.

⚠ **One thing to get right: an action belongs to a policy, not to the kernel in general.** If the
policy it implements is not the one finally settled, the action goes with it.

- If it implements the policy currently being settled → it moves into coherent actions on
  acceptance.
- If it implements a policy still in contention → it is **parked with that policy** and follows its
  fate. If that policy is rejected, the action goes to the rejected list with it, not into the
  kernel.

**Why:** otherwise a user settles policy 3 and finds the coherent actions section full of steps that
implement policy 8, which they rejected an hour earlier.

### 1.4 A policy that implies a cause the user has not chosen

**Charlie's instruction, and it is the strongest single idea in this brief.** Rumelt's structure
makes it a hard logical relation rather than a nicety: **a guiding policy is an answer to a
diagnosed cause.** If the user favours a policy that answers a cause not on their causal chain, then
either the policy does not belong or **the diagnosis is incomplete** — and the second is far more
often true.

Lex says so, in plain words:

> *"Choosing 6 implies a cause you haven't included — that the information reaching ministers is
> filtered before it arrives. Would you like to add it to your causes?"*

- The user accepts or declines. **Lex does not add a cause on its own.**
- On acceptance, the cause is added to the causal chain and the causes section is marked as changed,
  so the user can see the diagnosis moved under them.
- On decline, the mismatch is **recorded against the policy** — it is a real weakness and the
  adversarial read should be able to see it.

⚠ **Do not let this fire on every item.** It fires where the mismatch is clear from the causal
chain, not as a general invitation.

### 1.5 Step two — Cluster by cause

Group the surviving policies by which cause each attacks, read off the causal chain that 25-M built
and 25-O displays material-cause-up. This determines what the relationships between them can be, and
means the relationship is derived from evidence rather than asserted.

- **Same cause, incompatible means** → alternatives; one of them wins.
- **Different links of one chain** → candidates to merge; each necessary, none sufficient.
- **Unrelated branches** → not complementary but dispersive; the honest answer is *sequence, don't
  combine*.
- **Attacks a cause the user ruled out** → out, automatically, with the reason shown.

### 1.6 Step three — Rate, on two axes, kept apart

Each policy carries **two separate judgements, never combined into a score**:

- **How much of the diagnosed problem it fixes** (importance).
- **How likely it is actually to happen** (addressability) — parliamentary time, money, whether the
  power already exists, whether something similar has failed before.

⚠ **Label which is reasoning and which is retrieved.** Where the corpus has nothing on whether a
comparable measure passed, say that, rather than estimating. This is the rating most likely to be
wrong and it is the one a reviewer will attack first.

⚠ **Charlie is colour blind. Position and text only — no colour-coded grid, no red/amber/green.**

### 1.7 Step four — Design: merge, and the four verdicts

The user types an instruction referring to policies by number: *"merge 4 and 8"*. Lex replies with
exactly one of four verdicts and its reasoning:

1. **Merge.** They attack different links of the same chain and each is necessary. ⚠ **A merge
   produces a new policy written as one thing, not two paragraphs joined** — Rumelt's point that
   design work is strategy work, and that the obvious first answer is rarely the best. The merged
   policy takes the lowest unused number.
2. **Not a merge — one contains the other.** 8 is a coherent action of 4. Route through §1.3.
   **Expect this to be the most common verdict.**
3. **Not a merge — sequence them.** Both are real policies on unrelated causes. Combining widens the
   Bill and lowers its chance of passing. Lex offers one now, the other as a **later phase**.
4. **Refused — they contradict.** You cannot centralise and devolve the same power. Lex says which
   two things cannot both be true.

⚠ **A legislative policy and an operational policy combining is not an error.** It is verdict 1 or
2. A statutory duty plus the performance regime that makes it bite is a genuine chain.

### 1.8 The chain-link consequence, stated prominently

Where a merged policy has links that each bind, Lex states what happens if only part is delivered:

> *"Passed without the performance-management reform, expect this to change little. The
> accountability gap has two causes and each binds on its own."*

⚠ **Flagged as important, and it must survive into both generated documents.** A legislature will
take the easy half of a proposal and leave the hard half; this sentence is the warning, and it will
be the first thing cut for length unless it is marked.

### 1.9 Stopping, and the state that survives

**The user can stop anywhere.** Four of twelve merged and nothing settled is a valid saved state and
must reload exactly as left — numbers, merges, moves, ratings, declined suggestions.

**Two rounds, then Lex stops asking.** If after two rounds of comments and re-runs the user has not
narrowed to one, Lex offers to continue with **the choice recorded as unresolved and why**. ⚠ Three
rounds of the same question reads as nagging; "unresolved, and here is what it turns on" is a
respectable thing for a proposal to say.

### 1.10 What the user leaves with

- **One settled guiding policy**, or an explicit record that it is unresolved.
- **Later phases** — policies wanted but not now, with the reason. ⚠ This is what makes narrowing
  feel like ordering rather than loss, and it is Rumelt's own addressability discipline: break the
  long-term challenge into chunks, one of which can be tackled today.
- **Rejected**, with reasons, **searchable and restorable.** Charlie's requirement. A restore
  returns the policy with its original number and its reason for rejection retained as history.

### 1.11 Editing without re-running the build

**Charlie's instruction: Lex must be able to edit a field without a full pass.** A full build is
pre-population; once the user is working through the issues, no further full pass should be needed
until near the end, to review challenges and legislation affected.

⚠ **Diagnose before building.** Report whether a targeted pass can rewrite the guiding-policy field
without touching the rest. **The known risk is 25-L's:** a second pass not given everything the
first pass was given overwrites good work with a thinner version, silently. If a targeted pass
cannot be made safe, say so and report what a safe one would need — do not build an unsafe one and
do not fall back to a full re-run without saying that is what happened.

### 1.12 Checks for §1 — read this before writing them

⚠ **The addendum's finding is the instruction here.** `check:lex-25n` asserted the filter and the
button label — both true, both passing — for a feature that rendered nothing, because the panel wrote
under one key and read under another. **A source assertion cannot see a join that misses.**

Every check in this section must assert **the data present in the rendered output**, not that the
code which would render it exists. At minimum:

- A merge instruction produces a policy that **renders**, carrying both parents' content.
- A moved coherent action **renders in the coherent actions section** and no longer renders in the
  guiding-policy list.
- A declined cause suggestion **renders as a recorded weakness** where the adversarial read can see
  it.
- A restored rejected policy **renders with its original number.**
- **Controls that must stay false**, on every one of the above.

---

## §2 — `EvidenceItem` has nowhere to put a date

25-O §6 diagnosed rather than built, and the diagnosis changed the fix: **`EvidenceItem` has no date
column at all.** The 2014 Lords claim came from a debate of 16 January 2014; the date is in the URL
and in the corpus row and there is nowhere for it to land. ⚠ **No prompt instruction can work
against a missing column** — that is why the earlier framing of this as a content problem was wrong.

**2a.** Add the column. **2b.** Populate it at write time from the corpus row, not from the model.
**2c.** Backfill what can be recovered, and **report how many rows could not be dated and why** —
an undated row must be visibly undated, not silently assumed current.
**2d.** Only then: a claim older than a stated threshold is marked as needing checking against
current figures; a claim with no figures behind it is labelled an assertion rather than evidence; a
claim that changed Lex's position names what it was weighed against, or says nothing was.

## §3 — Sweep for the join-blind check class

The addendum found a defect that survived two sprints of green checks because the checks asserted
source strings and the failure was in a lookup. **This is a class, not an incident.**

**3a.** Find every place where a check asserts on a source file, a label or a filter for a feature
whose **data path is never exercised end to end**. Enumerate them.
**3b.** Report the list before changing anything — Charlie should see how large the class is.
**3c.** Add to `CLAUDE.md`: *a check must assert the data present in the rendered output, not that
the code which would render it exists.*

## §4 — Two wording defects the allowance work left

**4a.** The message reads "You have 4 builds left". Twelve thirds genuinely is four full builds, but
Charlie's intent was **three builds and three re-runs**, and the sentence does not say so. Make it
say what he actually has, in both currencies.
**4b.** "What to do next · 136" is accurate — 2 decisions plus 135 open challenges — but reads as a
wall on a collapsed header. Show the **actionable** count on the header and the total inside.

## §5 — The unbilled pass on a resumed historic build

Inserting the commentary pass changed what a historic build says about itself: v7 now reads "8 of
11" and resumes at the commentary. Not harmful, and "8 of 11" is true — but a resumed historic build
runs one pass it is not billed for. Fix or record with a stated reason.

---

## §6 — Acceptance criteria

- Policies are numbered, and a number never moves when another is merged, rejected or restored.
- Every item Lex reclassifies is shown to the user with its reasoning; nothing disappears silently.
- An item identified as a coherent action moves only on the user's acceptance, and one belonging to
  an unsettled policy follows that policy's fate rather than entering the kernel early.
- Where a favoured policy implies an undiagnosed cause, Lex offers the cause; accepting adds it and
  marks the causes section changed; declining records the mismatch against the policy.
- A merge instruction by number returns exactly one of four verdicts, with reasoning.
- The chain-link consequence renders on screen and in both generated documents.
- Importance and addressability are shown separately, in text and position, never by colour, and
  each is labelled as reasoning or retrieved.
- Stopping mid-way reloads exactly as left.
- After two rounds Lex offers to proceed with the choice recorded as unresolved.
- Rejected policies are searchable and restorable, and restore returns the original number.
- Every §1 check asserts rendered data, with a control that stays false.
- Undated evidence rows are visibly undated and counted.
- The join-blind check class is enumerated and reported before anything is changed.

## §7 — Say what only Charlie's browser can confirm

Expected to include at least: pressing "Add to report" on a fresh item since the fix shipped; the
resumed v7 build and the commentary prose it generates; and the guiding-policy screen end to end on
a real idea. **List these rather than reporting the render assertions as user-confirmed.**
