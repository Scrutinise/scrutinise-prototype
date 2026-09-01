# Sprint 25-R — three shipped features that render nothing

**1 September 2026, 13:58 UTC.** Brief: `docs/BRIEF_25R.md`.

**The three defects share one root cause.** They are not three coincidences, and §1's third
instance is not a third instance of "a lookup that misses" either — it is the same mechanism as
the other two, one level up.

---

## The root cause, in one paragraph

`computeCanonicalState` marks a page **`visited`** when *"any of its fields has left EMPTY"*. The
comment beside that line explains the reasoning: entering a page is what takes a field out of
EMPTY, because the conductor seeds the first field on arrival. **That was true when only the
conductor wrote fields. A build writes a proposal into every field of every page.**

So one build marks all four pages `visited`. And `FieldsPanel` collapsed on
`complete || visited` — while its own comment two lines above stated the rule as *"a stage you
have **finished** opens collapsed"*. `visited` is not finished. **A collapsed page renders none of
its fields: `{!isLocked && !collapsed && (…)}` — unmounted, not hidden.**

**So the build hid everything it had just made, behind headings the user had never opened.**

---

## §1 — The commentary is generated, costs money, and appears nowhere

**§1a — where it is written, and what reads it.** Every link in the chain exists and works:

| | |
|---|---|
| written | `build.ts:3058` → `IdeaBuild.causesCommentary`, a jsonb column |
| read | `GET /api/ideas/[id]/commentary` — and its query **returns the row** |
| rendered | `CausesCommentaryPanel`, mounted at the top of `CausesField` in `FieldsPanel.tsx:680` |

Measured on production, on the idea Charlie built this morning: the column holds a complete object —
`terrain`, `conflicts` (2), `complexity: SEVERAL_BIND`, `howPiecesFit`, `complexityWhy` — and the
route's own query returns it.

**§1b — it is the third: rendered somewhere Charlie would not think to look.** Not "written and
never read", and not "read and never rendered". The component is mounted in exactly the place 25-O
§5 specified. **It sits inside the DIAGNOSIS section, which was collapsed — so it was never
mounted, never fetched, and never drawn.** The user cannot look there, because there is no "there"
until the heading is opened, and nothing said anything was inside.

**§1c — ⚠ SUPERSEDED BY THE ADDENDUM BELOW, AND THIS PARAGRAPH WAS WRONG.** It read: *"fixed by
opening the section, not by moving the commentary — it still renders at the top of the causes
section."* It did not. Charlie challenged it with a screenshot of an expanded DIAGNOSIS and no
commentary, and the measurement proved him right: mounted inside `CausesField`, it began **1,080 px
below the section heading**. The collapse was half the explanation. See the addendum.

---

## §2 — The guiding policy shows none of what 25-P built

**§2a — the data is absent, and §2d's hypothesis is right in substance.**

Measured, without touching the rows:

```
  31055aef (built 12:36 today)   0/3 numbered   0/3 sorted   0/3 with reasoning
  452c5ade (built 10:40 today)  21/21 numbered  0/21 sorted  0/21 with reasoning
```

⚠ **The difference between those two lines is the whole sprint in miniature.** 452c5ade's
candidates are numbered because **`check:lex-25p` called `readPolicyState()` on it** while I was
working on that sprint — and that function calls `ensureNumbered`, which writes. The check numbered
the rows and then asserted they were numbered. The idea no check ever touched has none.

**§2c — the sort has never run outside a check, on any idea, ever.** `sortedAt` is null on every
policy option in the database. 25-P wired `sortPolicies` to a **control the user presses** on a
screen that never mounted. So the kind, the reasoning, the two ratings, the cause links and the
chain-link are absent from every real proposal, and the screen renders what Charlie saw: a plain
list labelled CANDIDATE.

**§2d — ruled in.** The candidates are written by `createPolicyOptions` in the approach pass, which
25-P never touched. 25-P added a parallel screen that *would* have numbered and sorted them, if
anything had opened it.

**Three fixes, because there were three separate causes:**

1. **The number is assigned where the row is created** (`field-machine.ts`, both writers). A row's
   identity is not a property of somebody looking at it.
2. **The build sorts its own candidates** — in the approach pass, which has just written them and
   already holds the causes, calling the same `writeSort` the screen calls. It never fails the
   build: an unsorted candidate is where it was a minute ago.
3. **The section opens**, per the root cause above.

**14 rows across 5 ideas were backfilled** with numbers; re-read confirms 0 unnumbered and 0
(idea, number) collisions.

---

## §3 — Lex still tells the user to do it themselves

**§3a — `currentField` was `actions`, not `policyOptions`.** The build had carried the idea on to
Coherent Actions. 25-Q read the policy rows **only when `currentField === 'policyOptions'`**, so
`livePolicies` was empty, Lex was never shown the numbers it is instructed to cite,
`resolvePolicyTarget` could only return null, and **no offer could be built no matter what Lex
produced.**

⚠ **25-Q's own diagnosis is what misled it.** It measured `currentField = policyOptions` on 30
August and built the gate around that reading — *a measurement of one moment treated as a property
of the idea*. The field moves; the candidates do not stop existing when it does. The read is now
conditioned on the idea having candidates, which is what the feature actually depends on.

**§3b — a merge is not a case the offer handles at all. This is a design gap, not a bug, and it is
Charlie's call.** `EditTarget` has two kinds: `POLICY_OPTION` (rewrite one row's sentence) and
`TEXT_FIELD` (replace one field's value). **A merge creates a new numbered row, supersedes two
others, and inherits both their causes** — three writes and a new identity. No `EditTarget` can
express it, and I have not invented one. 25-P's merge exists and is good; it lives on the
guiding-policy screen behind a two-number instruction, and reaching it from chat would be a new
piece of design rather than a fix.

**§3c — Lex must never send the user on an errand.** A `NO_ERRANDS_BLOCK` is now in **every** turn's
prompt: never say "go to the Strategy stage", "find the section", "amend it there"; if it can write,
offer; if it cannot, **say so plainly and say why in one sentence, then stop**. Dressing an
inability up as an instruction is worse than silence — it is the product describing its own job as
the user's chore.

---

## §4 — The systemic question

### §4a — the exact assertion that passed while each feature was invisible

**§1 — `check:lex-25o`:**

```ts
ok('§5 — the commentary opens the causes section, above the choice',
  /<CausesCommentaryPanel ideaId=\{ideaId\} \/>/.test(read('components/lex/FieldsPanel.tsx'))
  && read(...).indexOf('<CausesCommentaryPanel') < read(...).indexOf('Add cause'))
```

It asserted that the JSX tag **appears in the file**, and that its **character offset is lower than
the string "Add cause"**. Character offsets in a source file, standing in for render order on a
screen. It would have passed with the whole section wrapped in `{false && …}`.

**§2 — `check:lex-25p`:**

```ts
let state = await readPolicyState(ideaId)
ok('every candidate is numbered on first read', numbers.every((n) => n != null))
```

`readPolicyState` calls `ensureNumbered`, which **writes the numbers**. The label even says it —
*"on first read"*. The check performed the missing step and then asserted the step had happened.

**§3 — `check:lex-25q`:** it called `applyFieldEdit()` directly, which is *downstream of the gate
that decides whether an offer is ever computed*. The gate was covered only by
*"the chat route computes the offer and never writes a policy option"* — true, and silent on
whether an offer is ever computed at all.

### §4b — are they inside the 83%?

**Partly, and the part that is not is the more dangerous half.**

- `check:lex-25o` is squarely inside it — one of the 18 scripts the 25-P audit counted as reading
  no system output at all.
- `check:lex-25p` and `check:lex-25q` are **outside** it. They read the database. They were counted
  as the good kind.

⚠ **So the 83% figure understates the problem, and CLAUDE.md §25 does not cover it.** §25 says
*assert the data present in the rendered output*. Both of those did. **The defect is a different
one: the check created the conditions the feature needs, and then asserted the feature worked.**
A rule about *what* you assert cannot catch a fault in *what you did first*.

### §4c — the mechanism: the cold read

Not a rule. `scripts/check-lex-25r.ts`, and the discipline is one sentence:

> **A cold read takes a subject the check did not create and did not touch, and calls only what the
> browser calls.**

No fixture. No setup. No calling the feature's own functions first. If the feature needs something
to have happened, the cold read finds out **whether it happened** — rather than making it happen
and admiring the result. Concretely, in this file:

- the subject is **the most recently built real idea**, whatever state that leaves it in — not one
  chosen because it makes the feature look well;
- policy rows are read with `prisma`, **never** `readPolicyState`, because that function writes;
- what cannot be checked is counted as **NOT CHECKED and printed**, so a skip cannot read as a pass.

**It works, and it caught me inside this sprint.** The first draft kept its own copy of the panel's
collapse rule plus a guard asserting the copy still matched — and that guard went red on the first
run after I fixed the rule. So the rule was lifted into `lib/lex/panel-collapse.ts`, which the panel
and the check both import. A shared function beats a guard against drift.

**And it would have caught all three**, because all three fail it: the run below is the same file
against production before any fix.

---

## The red run, before any fix

```
  ✗ §1 31055aef: the commentary exists AND its section is open — causes page "DIAGNOSIS" is
                 visited → COLLAPSED, fields not mounted
  ✗ §2 31055aef: every candidate is numbered after a build — 0/3 numbered
  ✗ §2 31055aef: the sort has run on them — 0/3 sorted
  ✗ §2 31055aef: and Lex's reasoning is there to show — 0/3 carry a reason
  ✗ §2 31055aef: and its section is open — page "GUIDING_POLICY" is visited
  ✗ §3 31055aef: the rewrite offer is reachable — currentField=actions → no offer can be built
  ✗ §1 452c5ade: … (the same six)
  ✗ §3c the prompt forbids sending the user to another stage to do it themselves

5 passed, 12 failed, 2 controls (0 dead)
```

**After:**

```
17 passed, 0 failed, 2 not checked, 4 controls (0 dead)
```

⚠ **The 2 NOT CHECKED are the in-build sort**, and they are not passes. Every build in the database
finished before the sort was added to the approach pass, so there is nothing yet to read it on. The
check names them, dates them, and says so rather than skipping them silently.

Neighbouring suites all green: `lex-25n` 98/0, `lex-25o` 56/0, `lex-25p` 72/0, `lex-25q` 50/0,
`lex-25d` 77/0, `lex-25l`, `lex-25m`, `documents`, `export`, `orientation`, `answer`,
`text-integrity`, `panel-claims`, `never-claim`, `sprint3e-ui`, `check:scripts`, and
`npm run build`.

---

## §6 — What only Charlie's browser can confirm

⚠ **None of §1–§3 is reported as fixed on a render assertion.** All three were reported as working
once already, and the cold read proves the *data and the state*, not the pixels.

1. **The commentary actually on screen**, at the top of the causes section of a built idea. The
   cold read proves the section is no longer collapsed by default and the commentary exists; it
   cannot prove the component draws.
2. **⚠ The collapse change is the largest visual change here and the one most likely to be wrong.**
   After a build, DIAGNOSIS, GUIDING_POLICY and COHERENT_ACTIONS will all open. That is deliberate —
   the alternative is hiding a ten-minute build — but it makes the middle panel much longer, and
   whether that reads as *"here is everything I made"* or as *"a wall"* is a browser question. The
   headings still toggle both ways and a section you shut stays shut.
3. **The guiding policy sorted, numbered, with reasoning — which needs a new build.** Nothing in
   the database has been through the in-build sort. This is the one acceptance criterion I cannot
   demonstrate: it needs one full build, and it costs three credits.
4. **The rewrite offer firing from the Coherent Actions stage**, on a real model call — asking Lex
   to reword candidate 4 while standing somewhere else.
5. **Lex refusing a merge properly** — saying it cannot merge two candidates from here and why,
   rather than sending you to the Strategy stage. The prompt now forbids the errand; only a real
   turn shows whether it obeys.
6. **That the in-build sort does not push the build over its ceiling.** The addendum measured
   v8 at 761.5s of 900s with the approach pass at 16.3s; this adds one flash-model turn to that
   pass. It should be ~25s. It has not been measured because it has not run.

---

# Addendum — Charlie's decision on the collapse, and A5's challenge

**1 September 2026, 16:23 UTC.**

## A5 — the challenge was right. The collapse explains half of it.

⚠ **Measured, not argued** — in Charlie's own production session, on the idea built this morning:

| | |
|---|---|
| section shut | the commentary is **absent**, and so are the section's other fields — unmounted |
| re-opened | it **fetches and draws again** |
| section open | it begins **1,080 px below the section heading — 1.4 viewport heights** |

**So the collapse explains its absence when shut, and the geometry explains its absence when
open.** A5's screenshot shows an expanded DIAGNOSIS, and an expanded DIAGNOSIS does render the
commentary — but only after *The problem* and *Who's affected*, each a full card with its own
Save and Skip. A user who opens the section and reads what appears never reaches it.

**Why**: it was mounted inside `CausesField` — the causes **field**, third of the seven on that
page. 25-O §5 and 25-R §1c both say the commentary *"opens the causes section"*. It opened the
third field. It now renders above the section's fields.

⚠ **What I could not settle.** I could not reproduce a state where the section is open and the
commentary is wholly absent from the DOM, so I cannot claim the geometry is a complete account of
that screenshot — only that it is a measured second defect sufficient to explain a view of the
section's top. Charlie's original root-cause challenge stands as correct: **the collapse was not
the whole explanation, and I reported it as though it were.**

### And the fix made an old assertion prove §4a's point

Moving the commentary out of `CausesField` turned `check:lex-25o` §5 **red on a correct fix**.
That assertion compared **character offsets in the source file** — the tag's index against the
index of the string `Add cause` — as a proxy for what is higher on the screen:

```
idx '<CausesCommentaryPanel' : 35,719  →  91,406      (later in the file)
rendered position            : third card  →  top of the section   (higher on the page)
```

**Source order and render order are unrelated.** The assertion §4a named as the specimen would
have argued for reverting the fix. It is structural now: rendered by the page loop before the
fields are mapped, and not inside `CausesField`.

## A1 — collapsed and tidy, with the worklist as the entry point

Sections collapse again — `complete || visited` — this time deliberately rather than inherited
from a rule whose own comment said *"finished"*. The rule stays in `lib/lex/panel-collapse.ts`
so the panel and the check share it.

## A2 — the first thing to read

> *Read the diagnosis I've prepared — are you happy with both the description of the problem and
> the accuracy of the causes?*

First in "Things to read", **only once a build has produced a diagnosis**. An item asking somebody
to read something that does not exist is the control-that-does-nothing this repository keeps
finding.

## A3 — the Lex panel on arrival

One line — *"Welcome to the Strategic analysis, I'm Lex, ask me anything here."* — and **only on
arrival**; a standing sentence above a transcript is furniture. The chat box is three rows rather
than one.

⚠ **This retires 25-N §3c's second sentence** (*"Only conversations started on this page appear
here"*) from that position. That was a real fix, so it is not deleted: it survives as the
`this page only` marker in the tab strip immediately above, and `check:lex-25n` asserts it there.
Flagging it because it was one of yours.

## A4 — why re-collapsing is safe

Three properties are asserted, and the fourth was measured because a cold read cannot see a paint:

1. **shut, not absent** — the heading, its counts and its toggle sit *above* the guard that hides
   the fields, so there is something to open;
2. **opening mounts** — the contents are inside that guard, created on open rather than revealed;
3. **mounting fetches** — the effect depends only on the id, with no "fetched once ever" guard,
   which would make the first open of a session draw nothing: the defect returning by another
   route;
4. **it draws** — measured live, above.

⚠ Two assertions in `check:lex-25r` encoded the fix A1 reversed, and were inverted with it. An
assertion that demands yesterday's implementation fails correct code tomorrow — the same fault as
§3's gate, applied to my own work one day later.

```
check:lex-25r   29 passed, 0 failed, 2 NOT CHECKED, 7 controls (0 dead)
```

The 2 remain the in-build sort; every existing build predates it.

## What the browser confirmed, and what it did not

**Confirmed live, on production, before the addendum's changes:** the collapse/re-open cycle —
shut → the commentary and the section's fields are unmounted; re-opened → it fetches and draws
again. That is the measurement the A4 argument rests on, and it was taken on the code path that
still runs.

**Confirmed live, after A1 deployed:** the sections arrive **collapsed**, the DIAGNOSIS heading and
its toggle are present while shut (**shut, not absent**), and the worklist API returns Charlie's
item **first of four** with the panel reading *"Things to read — 0 of 4 done"*.

⚠ **Found live, and it was mine:** A3's arrival line **never rendered**. I had gated it on
`messages.length === 0`, and a built idea always has messages because the build seeds its own
bubble. **And `check:lex-25r` asserted my gate rather than the property, so it passed while the
line was invisible** — this sprint's own class, committed an hour after I wrote CLAUDE.md §26
about it, and caught by looking at the page rather than by the check. Fixed in `a529bf6`; the
assertion now tests that the line is *not* gated behind an empty transcript.

⚠⚠ **NOT VERIFIED, because the browser renderer froze after three attempts:**

1. **A4's exact wording — the commentary drawing on a FIRST open, in a session where the section
   has never been open.** What I measured was a re-open. The mechanism is the same (a collapsed
   section unmounts, so every open is a mount), but I did not observe the first-open case and
   will not report it as though I had.
2. **The new geometry.** The commentary now renders above the section's fields rather than 1,080 px
   down, and I have asserted that structurally — but I have not re-measured the pixel offset on
   the deployed page.
3. **A3's line actually on screen** after `a529bf6`.

## Two things worth knowing

⚠ **`check:scripts` is currently red, and it is not this work.** One error, in
`scripts/check-central-25a.ts` — an **untracked** file, with `lib/admin-users-labels.ts` and
`lib/admin-users.ts`, from another session's in-flight Central work. 28 files in the tree are
modified by that thread. Nothing of theirs is in these commits.

⚠ **Still unverified after this addendum**: the in-build sort (needs one real build), and every
paint. §6 of the main report stands.
