# LEX 25-G — MAKE IT AFFORDABLE, NAVIGABLE, WHOLE — AND THE FLIP, PREPARED AND UNTHROWN

*Written 25 August 2026. Thread: LEX. Brief: `docs/BRIEF_25G.md`.*

**§6's flip has NOT been performed.** The flag is `create`, `check:lex-25g` asserts it, and
§6 gates it on §1a/§2/§3/§4 being done *and on Charlie's confirmation that the rebuild reads
well*. The first four are done; the fifth is a fact about Charlie, not a permission I need.
The one-row flip and the runbook are at the end of this document.

---

## §0 — THE AUDIT, FROM BUILD `42d68bea` (217,687 in / 49,111 out / 33.4p)

### ⚠ Where the money actually goes — and nobody had looked

```
  ORIENT           77,970 in    2,101 out   2.26p   2 calls   ← 36% of the input
  RESEARCH         63,956 in   11,955 out   3.88p   7 calls   ← 29%
  SMART            30,716 in   19,628 out  17.75p   5 calls   ← 53% of the COST
  ADVERSARIAL      13,587 in    2,028 out   2.83p   2 calls
  REVISE            9,518 in    2,352 out   0.69p   1 call
  APPROACH          8,104 in    2,442 out   0.67p   1 call
  DIAGNOSIS         7,399 in    1,913 out   0.55p   1 call
  ACTIONS           3,010 in    1,516 out   0.37p   1 call
  KERNEL_CHECK      2,189 in    2,825 out   2.45p   1 call
  LOGIC_CHECK       1,238 in    2,351 out   1.98p   1 call
```

**Two passes are 65% of what a build READS. One pass is 53% of what it COSTS.** Those are
different passes, and §1's four items land on the first pair while §1d protects the second.

### ⚠⚠ The orient pass was reading ~434 documents and storing 20

`merged` is every result from both gateway calls — and the gateway returns ~15× what it is
asked for, so `limit: 16` twice over becomes ~434. **All of it went into the prompt** at
~39,000 tokens a call, while the pass stored 20 and the panel showed 20. Three different
numbers for one set, and a citation to source #300 counted as "cited" against a document
that was never kept.

### §4a — the duplicated paragraph, located exactly

`composeSummary` does two things with one string: writes it to the TRANSCRIPT
(`build:summary` bubble) and stores it on `IdeaBuild.summaryMessage`. `BuildIdeaClient`
renders the transcript; `BuildProgress` rendered the column. **537 characters, byte-identical,
twice on one screen.**

### §4c — the forks, and why labelling them keys on `fieldKey`

```
  diagnosis:rootCause        fieldKey=rootCause              ← a CAUSE
  diagnosis:pivotalObstacle  fieldKey=pivotalObstacle        ← an OBSTACLE
  approach:primaryLever      fieldKey=chosenApproach         ← an APPROACH
  guidingPolicy:instrument   fieldKey=summaryGuidingPolicy   ← an INSTRUMENT
```

Four kinds, rendered identically. ⚠ **The model invents its own fork keys** — the first
build produced `approach:chosen` and the second `approach:primaryLever` for the same
decision — so the label keys on `fieldKey`, which is drawn from the platform's own closed
set. Same reasoning `decisionIdentity` uses to de-duplicate them (25-F §6c).

### §4e — checked, and it passes

The brief asks us to confirm the failures reach the user's list with the specific text.
Read back from the database: **6 of 6 kernel-test failures are `DeepeningIssue` rows, and
every one quotes the text that fails it.** Nothing to fix.

---

## §1 — COST

### §1a — a re-run reuses the research

- `claimBuild(…, mode)` with `REUSE` copies the previous build's ORIENT and RESEARCH pass
  records — **the carry, not the usages**. That single distinction decides whether the
  saving is real: `carry.research` is what the later passes read (and since 25-F it carries
  the FINDINGS themselves), while the usages belong to the build that spent them. Copying
  them forward would make every re-run report the full price of a build it did not run.
- The passes are `SKIPPED`, not `DONE` — a pass that did not run must not claim it did —
  and `nextPassKey` steps over them.
- ⚠⚠ **The reused EVIDENCE is carried forward to the new `runVersion`**, and this is the
  step that makes reuse mean reuse rather than skip. Everything downstream is scoped by
  version: `buildHighlights` reads the new one, the clerk reads the new one, and
  `supersedeOlderProposals` REJECTS anything PROPOSED at an older one. A re-run that merely
  skipped would produce a build with no findings on its screen while `carry.research` told
  the revision there were seventy-five. **Only PROPOSED rows move** — an ACCEPTED or
  REJECTED finding is the user's judgement.
- ⚠ **Reuse is refused when the elicitation changed since the last build**, and the user is
  told which reason applies. The contrapositive is the one that matters: if they have told
  us something new, the cheap option would answer the question they stopped asking.
- The mode is **not a column**. It is expressed in the stored pass log, so "what did this
  build actually run" is answered by the same record that answers everything else about it.

**The measured figure: not yet taken.** ⚠ Running a REUSE build to measure it costs ~12p and
would write a fourth verification copy to production, which is outside what this sprint's
run-mode authorises without asking. **The arithmetic is on the record instead**: ORIENT and
RESEARCH are 141,926 of 217,687 input tokens (65%) and 6.14p of 33.4p, so a re-run that
skips both lands at **~27p by cost and ~76,000 input tokens** — the saving is in the model
calls not made, and every one of them is now skipped rather than repeated. **The figure to
report is the first real re-run's, and `verify:lex-25f -- --execute` plus a `REUSE` claim
will produce it in about four minutes.**

### §1b — a full re-search is an explicit, separately-priced choice

Both controls are on screen with their prices in words: *"Redraft from what I found"* and
*"Search again from scratch"*, with a line saying redrafting "costs roughly a third of a
full build" and re-searching is for "when what you have told me has really changed".

⚠ **The ROUTE defaults to `FULL`, not `REUSE`** — the safe direction rather than the cheap
one. An omitted mode means the caller expressed no preference (a first build, an old tab,
the worker), and a build that quietly reused a search nobody asked it to reuse would be
indistinguishable on screen from one that had searched.

### §1c — input tokens

**`ORIENT_SOURCE_CAP = 40`.** The orient model now reads 40 of the ~434 retrieved instead of
all of them: **~78,000 → ~8,000 input tokens, a 32% cut in a whole build's input.**

⚠ **This is not §1c's forbidden truncation.** The brief's warning is against showing a pass
a SUMMARY in place of findings — the 25-F defect — and nothing here summarises anything.
Every source the model reads is a whole source. A prefix is a fair sample for the same
reason 25-C's research cap is: `interleaveStreams` round-robins, so the head of the list is
stream-balanced. *(A prefix of a SCORE-ordered list would have been a silent bias. That
distinction is the whole reason this is safe, and `check:lex-25g` asserts the retrieved
count is still reported so capping what is READ cannot shrink what the build says it found.)*

⚠ **And the citation check got stricter as a side effect.** A cited id is now validated
against what the model was HANDED, not against everything retrieved — so a citation to a
document that was never in front of it no longer counts.

### §1d — the smart pass is untouched

17.75p of 33.4p, and the brief says do not cheapen it before 1a and 1c are measured.
**Recorded, not implemented** — options if a further saving is wanted: drop the panel from
two models to one (~6p, at the cost of the divergence that is the point of it); move the
coverage check to `gemini-2.5-flash` (~2p, on a pass that compares two analyses and is the
one place cheapness showed); or cap `LEX_SMART_ENTITY_CAP` back to 12 (~1p, and it cost
seven confirmed terms of art last time it was 12).

---

## §2 — NAVIGATION

`lib/lex/surfaces.ts` + `components/lex/SurfaceSwitch.tsx`, rendered by **both** screens so
they cannot drift into describing each other differently.

- Each screen **names itself** — *"You're looking at the build"* — as well as offering the
  other. Both halves are needed: the two screens look similar at a glance, and a user who
  cannot tell them apart concludes the platform lost their work.
- The detail is **counted**: *"23 fields, 10 decisions waiting"*. ⚠ Decisions waiting is
  unresolved forks **plus** open issues — counting only forks would have told the second
  build's user there were 4 when there were 21.
- **A returning user lands on the proposal.** `app/ideas/build/page.tsx` redirects when the
  idea already has a finished build. ⚠ `build=1` is the escape and it is not optional: a
  user watching their own build finish is on that URL with no flag, so the client writes it
  into its own URL (`replaceState`) the moment a build exists — otherwise a refresh would
  throw them off the screen they are reading. The proposal's link back carries it too, or
  the two screens would bounce a user between them.
- ⚠ `surfaceContext` returns **null** when there is nothing on the other side. A link to an
  empty build screen is a promise of something that is not there.
- The temporary previous-ideas panel stays, per §2.

---

## §3 — WHAT THE NEW DOOR LOST (A1–A7)

**All seven built. Nothing deferred.**

| | | |
|---|---|---|
| **A1** | **Feedback capture** | `FeedbackDialog` + `CRITIQUE_INTENT` offer where the criticism was made, **and a permanent route** at the foot of every screen. ⚠ A control that only appears when we correctly guess the user is unhappy is not a feedback route — and the whole purpose of the flip is to find out whether this door works on real users. First, per the brief. |
| **A2** | **"How this works"** | `HowItWorksModal variant="build"` — the same modal and the same chrome, with the build door's own four steps (four questions · I read the record back · the build · your proposal). ⚠ The create-page copy describes THREE PANELS this door does not have; showing a first-time user a tour of a screen they are not on teaches them the product is confused. |
| **A3** | **First-idea modal, intro, greeting** | The tour opens unprompted on `ideaCount === 0` — the same test the old door uses, so a user whose first idea was made at `/ideas/create` is not treated as new. Greeting by `preferredName` → `firstName`. ⚠ **Rendered, not written to the transcript**: injecting a greeting into the stored history would put a message there Lex never said in a turn, and re-send it to every drafting pass as context. |
| **A4** | **The FAQ** | Shared with the create door — one modal, one place to edit it. That is the reason it is a variant rather than a second component. |
| **A5** | **"Say the word"** | `HELP_INTENT` on the answer box. ⚠ **The box is NOT cleared.** A false positive here would swallow the user's own words about their problem; the tour opens and what they typed is still there. |
| **A6** | **Exit** | With the unsaved-answer prompt, beside the help pill — the same arrangement as §19-C Task 7. |
| **A7** | — | Nothing else outstanding from the eight; the three-panel/Deepening/agenda items in `LEX_25F_CUTOVER.md` §9c-B were always **deferred rather than lost**, and §2's switch is now the explicit route to them. |

---

## §4 — THE FIVE PRESENTATION DEFECTS

- **4a** — `BuildProgress` no longer renders `summaryMessage`. ⚠ The **transcript** copy is
  the one that stays: there it is followed by its two companion bubbles (the credibility
  note, the invitation to edit) in the order §5 specifies, and dropping it would orphan them.
- **4b** — ⚠⚠ **I could not reproduce it, and the guard is built anyway.** Build `42d68bea`
  stores seven queries carrying 7–10 terms and a 240–290 character purpose each, and
  `verify:lex-25g-ui` renders the component with that shape and finds **every term and every
  purpose in the markup**. So this is not a fix for a diagnosed cause; it is the guard that
  makes the reported symptom impossible whatever caused it — a query arriving with no terms
  now says so in amber instead of rendering a blank line under a count.
- **4c** — every fork carries a label and a one-line "what is being decided", keyed on
  `fieldKey`. Verified by rendering: two forks of different kinds come out with different
  labels.
- **4d** — `conditionsForSuccess` is asked for as an ARRAY, the prompt names the defect
  ("the last build returned five entries every one of which began 'For this to work'"), and
  ⚠ **the stem is stripped in code if it survives the prompt.** Telling a model not to repeat
  an opener is a request; removing it is the guarantee.
- **4e** — checked, passes. See §0.

---

## §5 — FINDABILITY

25-F's `nameTheIdea` already titles the idea and the dashboard already lists by title —
verified: the last build's idea is *"Strengthening Civil Service Accountability and
Performance"*. **The one thing still open, now fixed: a build that STOPPED EARLY never named
its idea**, because `nameTheIdea` ran only in `finishBuild`. That is precisely the case where
someone is most likely to go looking — it drafted a diagnosis, an approach and a title, and
then hit a ceiling.

---

## CHECKS

| | |
|---|---|
| `check:lex-25g` | **27 passed, 0 failed**; `--self-test` **0 control failures**, 6 uncontrolled (imported code) |
| `verify:lex-25g-ui` | **14 passed, 0 failed** — renders both components and reads the markup |
| `check:lex-25f` | 62/62 · `check:build-25a` 40/40 · `check:build-25b` 54/54 |
| `check:llm-guards` · `never-claim` · `flags` · `panel-claims` · `model-registry` · `committed` | all pass |
| `tsc --noEmit` · `next build` | clean; `/ideas/new` and `/ideas/build` both dynamic (ƒ) |
| `check-clean-build.sh --fast` | PASS — 0 cross-package files |

### ⚠ FOUR DEFECTS THE CHECKS FOUND, AND TWO WERE THE CHECKS THEMSELVES

1. **`verify:lex-25g-ui` would not run** — `tsx` compiles with the classic JSX transform,
   so every `<Component />` needed an explicit `React` import. Watched failing exactly that
   way.
2. **A control corrupted a COMMENT.** `.replace` takes the first match, and the first
   occurrence of `useState(Boolean(isFirstIdea))` in the client is a comment quoting it.
3. **The same control broke the wrong condition** — the check reads the PAGE first and
   returns on it, so a corrupted client was never reached. **A control has to break the
   assertion's FIRST condition, or it tests the order of the ifs rather than the code.**
4. **Two OTHER sprints' checks reported this sprint's fixes as regressions**, both because
   they matched a literal from the code they guard rather than stating a property:
   - `check:build-25a` §3 matched `seen.has(id)`; §1c renamed it to `readable`, which is
     **stricter**. It now accepts either.
   - `check:lex-25f` §6b matched `conditionsForSuccess: { type: 'string' }`; §4d made it an
     array. It now accepts either — how the field is shaped is §4d's business, and asserting
     both in one place made one section's fix another's failure.

---

## §6 — THE CUTOVER: READY, AND NOT THROWN

**Every gate except the last is met.** §1a, §2, §3 and §4 are built, checked and rendered.
The remaining condition is *"Charlie has confirmed the rebuild reads well"* — a fact about a
rebuild he has read, not an approval of this work.

**Verified ready:**

- `PlatformConfig["newIdeaDoor"]` is **ABSENT** on production; `newIdeaDoorState()` resolves
  `{ door: "create", path: "/ideas/create", isDefault: true }`.
- `/ideas/new` is **live**: `X-Matched-Path: /ideas/new`, issuing
  `NEXT_REDIRECT;replace;/ideas/create;307`. The control (`/ideas/definitely-not-a-route`)
  matches `/ideas/[id]` and carries no redirect.
- All seven creation entries point at `/ideas/new`; all four `?ideaId=` links are unchanged.
- `check:lex-25g` asserts the default is still `create` and fails if it is not.

**To flip** (one row, no deploy):

```
PATCH /api/admin/config    { "newIdeaDoor": "build" }      # SUPER_ADMIN
```

**To revert** — the same write with `"create"`, or delete the row. Both take effect on the
next page load.

**Then:** verify `/ideas/new` issues `NEXT_REDIRECT;replace;/ideas/build`, confirm an
existing `?ideaId=` link still opens where it did, demonstrate the revert once and undo it,
and report the first three real builds — completion, cost, time, any failed pass.

---

## DELIVERY (CLAUDE.md §20) — CHECKS 1, 2 AND 4 PASS

| | |
|---|---|
| **1. every file committed** | `check:committed` — 498 shipped source files scanned, all in the repository |
| **2. the remote has the commits** | `git ls-remote` server ref == local HEAD, `merge-base --is-ancestor` confirms |
| **3. green PRODUCTION deployment** | ⚠ **Charlie's** — the Vercel token is SAML-blocked (§19). Check 4 is indirect evidence it landed. |
| **4. the running site serves the change** | ✅ **9/9** — `scripts/probe-25g-live.sh` |

⚠⚠ **THE HTML OF `/ideas/build` IS USELESS FOR CHECK 4 AND LOOKS EXACTLY LIKE A FAILURE.**
The route is Clerk-gated, so an unauthenticated fetch returns a ~13KB sign-in shell and
every 25-G marker greps to zero — **and so does every 25-F marker**, which is the tell.
"All markers absent" is equally what a probe that cannot see the bundle returns; 25-E
recorded this exact trap and I walked into it once before reading it back.

So the probe reads the **client bundle**, and carries controls in both directions:

```
  reading 18 chunk(s) referenced by /ideas/build · 987,495 bytes of JavaScript

  ✓ §3 A1 the permanent feedback route      ✓ §1b the explicit re-search
  ✓ §3 A6 the unsaved-answer prompt         ✓ §2 the surface switch names itself
  ✓ §1a the reuse sentence                  ✓ §4c a fork says what is decided

  controls — 25-F strings that must ALREADY be there:
  ✓ 25-F §1 the findings heading            ✓ 25-E resume
  ✓ control: a string that exists nowhere is absent, so a hit means something
```

The same probe, run two minutes after the push, returned **3 passed / 6 failed** — both
controls green and all six markers absent. That is the honest intermediate state, and it is
what makes the pass above mean something rather than being a grep that matches anything.

**§6 re-verified after the push:** `PlatformConfig["newIdeaDoor"]` is **ABSENT**;
`newIdeaDoorState()` resolves `{ door: "create", path: "/ideas/create", isDefault: true }`.

---

## NOT DONE, AND WHY

- **The §1a saving is arithmetic, not a measurement.** Taking it needs a real REUSE build
  (~12p, a fourth production copy). The reasoning is above; the figure belongs to the first
  real re-run.
- **§1d's options are recorded, not implemented**, as the brief asks.
- **No browser walk.** No Clerk session exists from a CC session and local Clerk is a dev
  instance. `verify:lex-25g-ui` renders both components and asserts on the markup — that
  covers the shape and the copy of the first paint and **not** `<details>` expansion, the
  modals opening, effects, polling or layout. A human clicking is still the criterion.
- **Delivery checks 2–4 (§20)** follow the push.
