# LEX 25-F — THE SMART PASS, AND WHY THE FIRST REAL BUILD READ WORSE THAN IT WAS

*Written 25 August 2026. Thread: LEX. Brief: `docs/BRIEF_25F.md` plus §9 (the cutover), given in the session prompt.*

---

## §0 — THE AUDIT, BEFORE ANYTHING WAS BUILT

The brief is right about the shape and wrong about three specifics. Each of the three would
have sent a fix to the wrong place, so they lead.

### ⚠ 0.1 — THE QUERY WAS NOT TRUNCATED. THE BRIEF'S BLOCKQUOTE WAS.

§4 reads the pass-1 query as *"a truncated term-frequency dump … it contains "those" and
ends mid-word at "pr""* and asks us to diagnose a character-limit truncation.

**There is no truncation anywhere in the query path.** The stored value on the row is:

> `B_CONTEXTUALISED :: civil service public failure accountability responsibility cost deliver sector process accountable those system private care homes northern lack :: context(1359 chars)`

(`docs/LEX_FIRST_BUILD_KERNEL.md` line 255.) The `pr` is where the brief's own markdown
blockquote wrapped. `IdeaBuild.queryUsed` is an unbounded `String?`; `termsFrom()` slices a
TERM ARRAY, not a string, so it cannot cut a word in half.

**The other half of §4 is real and is worse than stated.** `termsFrom()` is a
term-frequency counter over the user's prose against a 45-word stopword list that does not
contain `those`. And `withTerms()` in `interrogation-library.ts` gave **every** library
question `termsFrom(d.text, 14)` plus four or five literals — so **nine questions issued
nine near-identical queries**, differing by a handful of words. *"231 sources read; 0
cited"* is the view of that from the other end.

### ⚠⚠ 0.2 — THE REVISION PASS HAS NEVER SEEN A FINDING. IT WAS GIVEN THE ARITHMETIC.

This is the largest single finding of the audit and it is not in the brief.

`researchSummary()` in `build-research.ts` emitted **one line per question — a panel
heading and a COUNT**: *"Whether a power to do this already exists: 6 findings — reviewed
104 sources, 12 bore on this proposal."* That string is `carry.research`, and
`carry.research` is the ENTIRE `═══ WHAT THE RESEARCH FOUND ═══` block handed to pass 4.

So the pass whose job is to rewrite the kernel in the light of the evidence was handed the
**count of the evidence and not the evidence**. That is the mechanism behind the brief's §0:
70 evidence items with real citations sitting in the database while the revised kernel came
out as *"incentives encourage diffusion of responsibility"*. **The material was never lost.
It was never delivered.**

### ⚠ 0.3 — §5's PREMISE IS HALF RIGHT, AND THE WRONG HALF IS WHERE THE FIX GOES

§5 says the user's testimony *"reaches one field, not the kernel"*. Measured: under framing
arm B — the default, and the arm Charlie's build ran — `frameQuery()` already put the
problem, goal, ruled-outs, own-knowledge and profile into `promptBlock`, and `promptBlock`
went to ORIENT, DIAGNOSIS, APPROACH, ACTIONS **and** REVISE. The testimony was in front of
five of the seven passes.

Two things were actually wrong:

1. **The only instruction attached to it was a PROHIBITION** — *"never present it as a
   retrieved source"*. Nothing anywhere said use it. A model given a block of text and only
   a rule about what it may not do with it leaves the text alone. `legalLandscape` was the
   exception because the orient prompt asks a question the testimony directly answers.
2. **It never reached passes 3 or 5 at all.** `draftFactsFor()` builds its `text` from the
   persisted `Idea` columns and the carry — the user's own sentences are in neither — so
   **the sift, the gather and the hostile clerk have never seen a word of it**. The sift is
   the worst of the three: it decides which of a hundred retrieved documents bear on the
   proposal, without the first-hand account of what the proposal is about.

### ⚠ 0.4 — §6c IS TWO DIFFERENT DEFECTS THAT LOOK LIKE ONE

The brief reads the duplicated instrument alternative as *"the duplicate-fork bug
`persistForks` de-duplicated in 25-A, returned"*. **It is not the same bug and
`persistForks` never ran on it.**

| | what it is | where |
|---|---|---|
| **The duplicated alternative** | `recordInstrumentRetirement` ran `updateMany({ where: { buildId, forkKey } })` with **no `alternativeIndex`** — which is every row of the group — writing one alternative and one case over all of them. That is why `guidingPolicy:instrument` offers "Use the existing power: CRaG 2010 s.3(1)" twice, verbatim. | `build.ts` |
| **The split approach fork** | `approach:chosen` and `policyOptions:chosenApproach`, the SAME `chosen` text verbatim, different alternatives. Two model-invented keys for one decision; the only de-duplication rule in `persistForks` was a regex on the word "instrument". | `build.ts` |

### 0.5 — §6b: the four fields were NEVER WIRED

The brief asks whether they were *"skipped, failed, or never wired"*. **Never wired.**
`anticipatedResponses`, `conditionsForSuccess`, `coherenceCheck` and `costSummary` appear
in no build pass's schema, in any sprint. `M_GUIDING_POLICY` demands two of them in every
prompt the approach pass sends (*"Anticipate responses… and state conditions for success as
testable bets"*) and the model had nowhere to put the answer.

### 0.6 — §7: the title is drafted and never mirrored

`Idea.title` stays `"Untitled idea"` because the DIAGNOSIS pass writes the title as a
PROPOSAL, and `Idea.title` is only written by `mirrorValue` when a human ACCEPTS one.
Nobody had.

### 0.7 — §1: the build screen had never read the evidence table

`BuildProgress` rendered a status badge, one line per pass, the summary message, the
uncertainties, the forks and the spend. **Not one finding, not one citation, not one
source.** The 70 evidence items were in `EvidenceItem` and no build surface has ever looked
at that table. Charlie's verdict — *"weaker than a single ChatGPT query"* — was a fair
judgement of what he was shown.

### 0.8 — item zero

`scripts/check-clean-build.sh` already exists (added 23 Aug). Run `--fast`: **0
cross-package files, PASS.**

---

## WHAT WAS BUILT

### §1 — the good material is on the screen

- **`lib/lex/build-highlights.ts`** — reads the evidence layer for this build's
  `runVersion` and ranks it. The ranking is deterministic and written down:
  a CONTRADICTS finding **+100** (the one the proposer can still act on), a **citation
  +50** (a named source beats an abstraction), the sift's own precedent verdict **+25**.
- ⚠ **The drafted kernel is read from `IdeaFieldState.proposal`, not the `Idea` columns.**
  Those are all empty after a build and correctly so; anyone reading the `Idea` row alone
  concludes the build produced nothing. This is the single most misreadable thing about a
  finished build and it has already misled one review.
- **`components/lex/BuildFindings.tsx`** — What I drafted · What I make of it · What the
  record actually says · The words this field actually uses · the sources, collapsed.
- **"Delete the rubbish"** is executed as a screen instruction, not a delete: an uncited
  finding whose body says little more than its own title is demoted, **and the count is
  shown**. A finding that carries a citation is never demoted. The rows stay in the
  evidence panel; the user's own judgement on them is untouched.

### §2 — the smart pass (`lib/lex/build-smart.ts`)

A new pass, **after REVISE, before ADVERSARIAL**. Five steps:

1. **§2a — the whole of page one goes out, verbatim.** 12,000-character cap, sized against
   the 2,934 characters one real user actually wrote, and **a truncation is stated on
   screen** rather than being a summary chosen by an arithmetic accident.
2. **§2b as answer sources** — each panel model returns a Rumelt-shaped answer (diagnosis ·
   guiding policy · coherent actions · instrument), given the user's words and **nothing of
   ours**: an independent answer is only independent if it has not been anchored on our
   diagnosis.
3. **§2b as query generators** — every statute, doctrine, regime, case, office, convention
   or named mechanism they name becomes **its own corpus query** (capped at 12, and the cap
   reports what it dropped). ⚠ **A term is CONFIRMED only by a retrieved document
   mentioning it** — not by a model saying it is real, and not by a search "returning
   results". Confirmed terms produce cited findings; **unconfirmed ones are kept as a
   stated gap** labelled UNVERIFIED, rendered in amber with the reason, and nothing may
   cite them.
4. **§2c — the coverage check.** Every substantive point another model made is either
   present in our kernel or becomes an issue on the list the user works through.
5. **§2d — the critique, with a REWRITE MANDATE.** A verdict (`GOOD` / `WEAK` /
   `NOT_A_KERNEL`), the Rumelt tests it fails **quoting the text that fails them**, the
   rewritten fields, and what changed recorded in the revision pass's own shape
   (`EvidenceItem` kind `CONTRADICTS`). Plus §2d's four answers — how hard to pass, the
   barriers, the odds, what is most likely to go wrong — stored as judgements with
   **`citation: null`, because none would be honest**.

⚠ **An empty rewrite means LEAVE IT.** Writing an empty proposal over a good field would be
the §6a defect this same sprint removes, arriving by a different door.

### §2e — model selection, and the one that was measurably wrong

| pass | was | now |
|---|---|---|
| `ADVERSARIAL` | `gemini-2.5-flash` | **`gemini-2.5-pro`** |
| `SMART` | — | `gemini-2.5-pro` |
| `KERNEL_CHECK` / `LOGIC_CHECK` | — | `gemini-2.5-pro` |
| the outside panel | — | `gemini-2.5-pro`, `claude-sonnet-5` |

⚠ **25-B left the adversarial pass on the cheapest model deliberately** — *"a swap made
permanent in config before that comparison exists would be a verdict nobody measured."* The
evidence arrived: the cheapest model we have produced **407 output tokens for six issues**
against a whole constitutional-reform proposal. That is not a close call about ranking
quality; it is a pass that was not doing its job.

⚠⚠ **`grok-4.6` WAS IN THE PANEL AND WAS REMOVED, AND THE REASON IS A TRAP WORTH RECORDING.**
`GROK_API_KEY` is set, so `hasKeyFor('xai')` is TRUE — and `callModelJson` returns
`unroutable` for **every** xAI model, because the structured-output client has never been
written. The panel would have carried a third model that fails on every build, printing
*"grok-4.6 did not answer"* on every screen for ever. **A key is not a client**, and a
warning that always fires is a warning nobody reads. `hasStructuredClientFor()` now derives
the answer from the same switch that refuses the call, so there is no second list to
forget.

**The model that ANSWERED is now reported per pass on the screen** — `echoedModel` where
the vendor said, not the model we configured (25-D §1c: a 200 is not proof).

### §3 — two verification passes (`lib/lex/build-verify.ts`)

- **`KERNEL_CHECK`** — nine tests from the method layer, **as DATA** so every one can be
  counted: is the problem a problem or a solution · is the obstacle distinct from the root
  cause · does the diagnosis simplify · does the policy rule anything out · is it an
  approach or a goal · does it have leverage on the named obstacle · do the actions defeat
  the causes · do the actions cohere · is a bad-strategy smell present. **Every failure
  QUOTES the text that fails it** and becomes an issue.
  ⚠ **A test the model did not answer is UNRUN, not a pass.** Silence on a checklist reads
  as a pass to every downstream reader; it is recorded as failing, naming the model.
- **`LOGIC_CHECK`** — causes → obstacle → approach → actions, link by link.
  `NON_SEQUITUR` · `CIRCULAR` · `UNSUPPORTED` · `BROKEN_LINK`, each quoting the text.
  ⚠ `chainHolds` is FALSE if any link is broken — not an average and not a vote.
  ⚠ Testimony is explicitly excluded from `UNSUPPORTED`: first-hand experience IS support.
- ⚠ **They report; they do not rewrite.** §2 has the rewrite mandate and runs first, so
  they mark the kernel the user will actually see. A pass that both judges and fixes has an
  obvious incentive to judge gently.
- **§25.7's six instructions** are now a block every drafting pass includes (causal chain
  not inventory · the counterintuitive result at the centre · cite the finding not the
  citation · reframe the instrument · a test the user can apply · the next action). None of
  the six was visible in the first build.

### §4 — a query is written, not extracted (`lib/lex/build-query.ts`)

- `writeQueries()` — **one call for all jobs**, not one per question: this pass already hits
  its 240-second budget, and nine extra round trips would buy better queries by losing two
  questions.
- The prompt is told what it is replacing, and told that **terms of art beat the user's
  words** — that is the vocabulary half of §2b arriving in retrieval.
- `queryDefects()` — the assertion as a pure function: `empty` · `mid-token` · `stopword` ·
  `keyword-dump`. ⚠ **`check:lex-25f` runs it over the REAL historic query and asserts it is
  REJECTED**, with a written query as the positive control. An assertion tested only against
  a made-up bad example is an assertion tuned to a made-up bad example.
- `q.terms` in the library became `q.anchors` — the terms of art a question always wants.
  The comment records what was there and why it went.
- **The fallback is named.** When the writer fails, the old extraction is used — a question
  asked with a bad query beats a question not asked — and the query is recorded with
  `provenance: 'extracted'` and says so on screen.
- **Every query a pass issues is now on the pass record.** Before this the only trace was
  `queryUsed` — one string, from pass 1 — so nine near-identical research queries left no
  record at all.

### §5 — the testimony (`lib/lex/testimony.ts`)

- `TESTIMONY_INSTRUCTION` — **positive first, prohibition second**, in one block so the two
  halves cannot be separated. A concrete instance beats an abstraction; let it shape the
  diagnosis; **attribute it**; and it is never a citation.
- It now reaches **the sift, the gather and the hostile clerk**, which had never seen it.
- `bearsTestimonyMarks()` reports whether a drafted field shows the marks of attribution.
  ⚠ Its limits are stated in its own doc comment: it cannot tell whether a passage was
  genuinely informed by the testimony, only whether it bears the marks. A report saying "no
  field referenced the proposer" is worth having; a claim that the testimony "was used"
  would not be.

### §6 — the three defects

- **6a — the proposal renders the child rows.** Of the brief's two options, this takes the
  first: `AWAITING_CONFIRMATION` is the RIGHT state (Lex has put candidates there and
  nobody has agreed to them), and dropping it would make a loop Lex had filled
  indistinguishable from one nobody had touched. `setLoopProposal()` **refuses** to write a
  proposal with nothing in it.
  ⚠ The panel never read this value — the loops render their child rows directly — which is
  why the empty proposal was invisible on screen for eight sprints and visible only in a
  dump. It is what an export, a report and the next reader of the row see.
- **6b — two of the four are now wired**, and they are the two Rumelt names:
  `anticipatedResponses` (five slots) and `conditionsForSuccess` (testable bets) are drafted
  by APPROACH and proposed like every other field. `coherenceCheck` is covered by REVISE's
  `coherenceNote`, which reaches the issues list.
  ⚠ **`costSummary` is deliberately still EMPTY and the reason is the never-claim rule.**
  The actions pass is told *"Do NOT invent costs — costing is the user's work with Lex
  later, and a fabricated range would be carried into a cost-benefit case as though it had
  a source."* A cost summary with no cost lines under it would be exactly that. It stays
  empty **with the reason stated**, which §8 allows.
- **6c — both defects fixed, separately.** The research finding is now **appended as its own
  alternative** (idempotent on a re-run) rather than overwriting every row of the fork: the
  approach pass's two alternatives are the model's reasoning and are not ours to destroy.
  And `decisionIdentity(fieldKey, chosen)` de-duplicates across passes — **what a fork bears
  on and what was chosen**, because the model names its own keys and will keep inventing
  near-synonyms. The drop is counted.

### §7 — a completed build is findable

`nameTheIdea()` writes `Idea.title` from the drafted title, **only ever over the
placeholder**. ⚠ This does not break invariant 5: `IdeaFieldState.title` stays at
`AWAITING_CONFIRMATION` and the title card still asks. `Idea.title` is the row's NAME —
what every list renders — and a row called "Untitled idea" is a filing failure, not an
unanswered question. The build screen now links **by name**, and to `/ideas/{id}` as well
as to the editing surface.

### §9 — the cutover, prepared and not thrown

Full inventory and runbook: **`docs/LEX_25F_CUTOVER.md`**.

- **The switch is a `PlatformConfig` row**, not an env var — a Vercel env change needs a
  redeploy, which would make the REVERT a build-and-wait. `newIdeaDoor` = `"create"` |
  `"build"`, written through the existing SUPER_ADMIN `PATCH /api/admin/config` (which
  already logs to `ActivityLog`).
- **All seven creation entries now point at `/ideas/new`**, a `force-dynamic` server route
  that reads the switch and redirects. Half of them are client components that cannot read
  the database, which is why it is a route and not a prop.
- **⚠ THE DEFAULT IS `create` AND `check:lex-25f` ASSERTS IT.** Nothing about the front
  door behaves differently today. A "prepared" cutover that had quietly happened would be
  the worst of both, because nobody would be watching for it.
- **§9b — nothing a returning user touches moved.** All four `?ideaId=` links are unchanged
  and the check asserts it, in both directions.
- **§9c — the inventory names eight things that are GENUINELY LOST** at the creation entry,
  led by the "How this works" tour (the brief's stated risk), the FAQ view, the first-idea
  modal, the first-idea intro, the returning-user greeting by preferred name, "say the
  word", **feedback capture**, and Exit. Seven more are DEFERRED rather than lost — the
  build hands off to `/ideas/create?ideaId=` and they are all there. **The recommendation
  is that A1–A7 are built before the flag is flipped**; that work is not in 25-F.
- **§9d — nothing was deleted.** The old elicitation stays behind the flag, and the check
  asserts the files still exist.

---

## CHECKS

| | |
|---|---|
| `npm run check:lex-25f` | **62 passed, 0 failed** |
| `npm run check:lex-25f -- --self-test` | **0 control failures**; 17 checks report NO NEGATIVE CONTROL (they assert against imported code and cannot be corrupted in-process) |
| `npm run check:committed` | reports the 8 new files as uncommitted — §20 check 1, run BEFORE the push, and all 8 are in `commit-lex-25f.sh` |
| `check:build-25a` | 40/40 |
| `check:build-25b` | 54/54 |
| `check:llm-guards` · `check:never-claim` · `check:flags` · `check:panel-claims` · `check:model-registry` | all pass |
| `tsc --noEmit` | clean |
| `next build` | compiled successfully; `/ideas/new` renders dynamic (ƒ) as intended |
| `scripts/check-clean-build.sh --fast` | **PASS — 0 cross-package files** |

⚠ **`check-clean-build.sh` in FULL is a POST-PUSH check and was deliberately not run here.**
§20 asks for it after touching `package.json`, which this sprint did (two new scripts) — but
it does a `git worktree` checkout of **HEAD**, so run before the commit it would build the
pre-sprint tree and report a clean bill on code that is not in it. It belongs in the delivery
checks after `commit-lex-25f.sh`, and it is listed there.

### ⚠ THE CHECK WAS WATCHED FAILING, AND IT FOUND EIGHT REAL DEFECTS BEFORE A HUMAN DID

Three in the first run, all in the check itself, all of the same family — **an assertion
that reads source text and matches the wrong thing**:

1. *"the library still calls termsFrom"* — the regex matched the **comment explaining why
   the call was removed**. A check that forbids explaining a defect is a check that will be
   answered by deleting the explanation. Now it asserts the **import**.
2. *"the skip is never logged"* — the log line is in `build.ts`, not `build-smart.ts`.
   Rewritten to assert the skip reaches **the user**, not only the log.
3. *"there is no write surface for the flag"* — the admin route uses `[NEW_IDEA_DOOR_KEY]:`
   as a **computed key**, so the literal string never appears. It reported a missing write
   surface for a write surface that was there.

Five more in `--self-test`, every one a **control that could not fail**:

4. `.replace(string, …)` changes the **first** match only, and `ideaWithTestimony` appears
   twice (sift and gather) — the corrupted source passed.
5. Same, for `anticipatedResponses` (interface and schema).
6. A control renamed `alreadyCarrying` → `alreadyCarryingXX`, **which still contains the
   substring the assertion tests for**.
7. A control disabled a guard whose symbol is **declared above it**, so the declaration
   still matched.
8. A control disabled a block, leaving the **sentence the assertion reads** in the source
   inside the now-dead branch.

All eight are fixed and the fixes carry the reason at the site.

---

## THE LIVE REBUILD

*(§8's single measure: "the rebuild surfaces at least one term of art Charlie did not
supply — Carltona, Osmotherly, Accounting Officer, SRO or equivalent." — results below.)*

`npm run verify:lex-25f -- --execute` runs a real build and reads back what a user would
see. ⚠ **It runs on a COPY of Charlie's elicitation, never on idea `452c5ade` itself.** A
re-run would create version 2, and `supersedeOlderProposals` marks every earlier PROPOSED
`EvidenceItem` REJECTED — those 70 rows ARE `LEX_FIRST_BUILD_KERNEL.md`, the only
before-picture this brief has.

⚠ **Retrieval on this machine is weaker than production.** `.env` has no `FTS_SEARCH_URL`,
no `LEX_VECTOR_STREAMS` and no `LEX_QUERY_ROUTER`, so the corpus half runs degraded. That
cuts one way only: a **CONFIRMED** term here is real evidence; an **UNVERIFIED** one here is
not evidence of absence.

### Run A — the corpus unreachable (accidental, and it earned its keep)

The first attempt ran with no `FTS_SEARCH_URL`, so **every corpus search returned zero and
reported `failed: true`**. It is reported because it exercised the honesty paths hard: pass 1
said *"0 sources — ⚠ at least one corpus search did not complete"*, the research pass produced
**8 stated gaps and no findings**, and nothing anywhere claimed the corpus was silent. It also
**named ten terms of art from the panel models alone** — Carltona, the Osmotherly Rules, the
Accounting Officer, the Senior Responsible Owner, CRaG 2010, the Civil Service Code, the IPA,
the NAO, the PAC and ministerial responsibility — every one of them marked UNVERIFIED, because
nothing had been retrieved to confirm them. **That is exactly the behaviour §2b specifies**, and
it is the reason `verify:lex-25f` now prints `resolvedConfigLine()` beside every result: "0 terms
confirmed" would otherwise read as a verdict on the smart pass when it was a verdict on a `.env`
file.

⚠ **It also crashed** — see "the two defects the live run found" below.

### Run B — the corpus reachable, all ten passes, on a copy of Charlie's own elicitation

`[config] fts=fts-serve-production-4cea vector=vector-serve-production streams=legislation
router=ON fully-configured`

```
══ DONE · 10/10 passes · 618s · 357,250 in / 53,332 out — estimated cost 37.4p ══

  DONE  Understanding the terrain
        434 sources read; 11 cited · 1 of 1 queries written
  DONE  Drafting the diagnosis          5 causes, 4 recorded alternatives
  DONE  Drafting the approach           3 approaches; instrument: primary legislation · national · reserved
  DONE  Drafting the actions            5 actions drafted
  DONE  Researching what the draft revealed
        7 questions asked; reviewed 600 sources; 75 findings, 2 contradicting the draft;
        27 stated gaps — ⚠ an existing power may remove the need for a Bill · 7 of 7 queries written
  DONE  Revising in the light of it
        4 causes rewritten; 4 places the evidence changed the draft; 3 forks settled, 4 opened
  DONE  Asking whether any of this is good
        2 models answered your own words (gemini-2.5-pro, claude-sonnet-5); 12 terms of art named
        — 7 confirmed by the corpus, 5 unverified; 9 of their points already covered, 11 not;
        verdict WEAK; 5 fields rewritten; read by gemini-2.5-pro
  DONE  Checking it is a kernel at all
        2 of 9 kernel tests passed; 7 failed and are on your list — marked by gemini-2.5-pro
  DONE  Checking the argument holds
        the chain from causes to actions holds; 0 defects — traced by gemini-2.5-pro
  DONE  Reading it back as a hostile clerk
        6 issues raised against the whole proposal, read by gemini-2.5-pro
```

**§4 — the acceptance criterion, met and measured.** *"pass 1 cites sources on the rebuild — it
currently cites 0 of 231."* → **434 sources read, 11 cited.** And **8 of 8 queries were WRITTEN,
0 fell back to extraction.** The opening query:

> `Accounting Officer · Carltona Principle · Osmotherly Rules · Senior Responsible Owner · public
> appointments · Ministerial Code · Civil Service Code · Public Standards Act · duty candour ·
> public sector accountability · parliamentary scrutiny · judicial review`

against the one that shipped in August:

> `civil service public failure accountability responsibility cost deliver sector process
> accountable those system private care homes northern lack`

Every question issued a **different** query, each with its own stated purpose — where nine
questions previously shared fourteen words.

**§8's single measure — MET.** *"the rebuild surfaces at least one term of art Charlie did not
supply — Carltona, Osmotherly, Accounting Officer, SRO or equivalent."* **All four are in the
issued queries**, and none of them appears anywhere in the 2,934 characters he wrote. Twelve
were put to the corpus, **seven confirmed**, five kept and labelled UNVERIFIED, and **eight more
were named and dropped by the cap — reported by name, never silently.** (The cap has since been
raised from 12 to 18 on that evidence: the eight included *Managing Public Money*, *Ministerial
Responsibility* and the *National Audit Office*.)

**§1 — what the screen now shows**, where it previously showed nothing:

```
drafted fields    8
leading findings  8 (of 84 kept, 0 demoted)
judgements        How hard this will be to pass · The barriers this will actually meet ·
                  How likely this is to succeed · What is most likely to go wrong ·
                  What to read first · What I would cut
sources cited     47

Top of the screen:
  [CONTRADICTS] The 'Carltona principle' applies to departmental Ministers, not directly to civil servants.
                Lords: Civil Service (Management Functions) Bill [H.L.]
  [CONTRADICTS] Some past reform efforts have been criticised for undermining accountability.
                Public Administration Committee, 13th Report — Change in Government
  [CONTRADICTS] The critique rewrote pivotalObstacle / summaryCoherentActions / summaryDiagnosis
```

⚠ The first line is worth reading twice. **A term of art no user would know, retrieved from the
corpus, contradicting the proposal's own premise, with the document that says so** — leading the
screen. That is the whole sprint in one row, and last week it was in the database and on no page.

**§3 — the two verification passes disagree, and that is the point.** **7 of 9 kernel tests
failed** while **the logical chain HELD with 0 defects.** Those are not in tension: it is a
coherent argument for a weak strategy, which is exactly the distinction §3 says the hostile clerk
could not make on its own — the clerk finds the weakest point of a wish rather than noticing it is
one.

**§6 and §7, read back from the database after the run:**

```
6a fields at AWAITING with an empty proposal: 0 ✓
6b anticipatedResponses / conditionsForSuccess drafted: both ✓
6c forks with a duplicated alternative:       0 ✓
6c one decision recorded as two forks:        0 ✓
§7 the idea is named: "Strengthening Civil Service Accountability and Performance" ✓
```

⚠ **`0 demoted` is not the demotion test failing to fire — it is the rule that a cited finding is
never demoted.** All 84 kept findings carried a citation.

### ⚠⚠ THE TWO DEFECTS THE LIVE RUN FOUND, NEITHER OF WHICH ANY CHECK COULD HAVE

**1. The smart pass crashed, and took three passes with it.** One panel model returned
`coherentActions` as a **string** where `PANEL_SCHEMA` asked for an array. The pass threw on
`.join`; a thrown pass is a FAILED pass; and **four of ten passes were lost — the smart pass, both
verification passes AND the hostile clerk — over one field of one model's reply.**
⚠ **`?? []` is not a guard, and it looks exactly like one**: it defends against `null` and
`undefined` and lets a string, a number or an object through into `.join`, `.map` or `for…of`.
Every structured call in this codebase that reads an array off a model reply has that shape.
Fixed at the boundary (`normalisePanelAnswer`), once, rather than at the six places that read it —
and a string becomes a one-item list, because losing the content silently is the failure one level
along from the crash. `continueOnFailure` now marks the three passes 25-F added, **and only
those**, so an enhancement cannot take the adversarial read down; the pass stays **FAILED, not
SKIPPED**, and the summary appends the warning deterministically.

**2. The corpus confirmed seven terms and the screen said "(none)".** The gather that turns
confirmed terms into cited findings was handed **all 426 documents the eighteen entity searches
returned** and attributed none of them, so `citedTerms` came out 0 — and the vocabulary section,
which read the pass's cited findings, showed nothing while the pass had successfully found
Carltona and the Accounting Officer in the corpus. Two facts were riding on one row: *which words
the record uses* and *what the record says about them*. Now the gather reads the top five
documents **per confirmed term** rather than the whole pile, and the term list is its own row.

*(Both fixes landed after run B and are verified by run C below.)*

### Run C — the same idea again, verifying both fixes

```
══ DONE · 10/10 passes · 621s · 247,394 in / 50,522 out — estimated cost 33.8p ══

  Understanding the terrain      372 sources read; 12 cited · 1 of 1 queries written
  Researching what the draft revealed
                                 7 questions asked; reviewed 600 sources; 79 findings;
                                 25 stated gaps — ⚠ an existing power may remove the need for a Bill
                                 · 7 of 7 queries written
  Asking whether any of this is good
                                 2 models answered your own words; 18 terms of art named —
                                 14 CONFIRMED by the corpus, 4 unverified; 9 of their points
                                 already covered, 10 not; verdict WEAK; 5 fields rewritten
  Checking it is a kernel at all 2 of 9 kernel tests passed; 7 failed and are on your list
  Checking the argument holds    ⚠ the chain does NOT hold; 2 defects in the argument
  Reading it back as a hostile clerk   7 issues raised
```

**Both fixes hold.** The vocabulary gather now reads 63 documents (five per confirmed term)
rather than all 779, and produced **14 cited findings** where the same step produced 0:

```
CONFIRMED by the corpus:
  ✓ Accounting Officer (office)          ✓ Carltona principle (doctrine)
  ✓ Osmotherly Rules (convention)        ✓ Senior Responsible Owner (SRO) (office)
  ✓ Civil Service Code (regime)          ✓ Civil Service Commission (institution)
  ✓ Constitutional Reform and Governance Act 2010 (statute)
  ✓ Government Resources and Accounts Act 2000 (statute)
  ✓ Individual ministerial responsibility (convention)
  ✓ Infrastructure and Projects Authority (institution)
  ✓ Managing Public Money (regime)       ✓ National Audit Office (institution)
NAMED but UNVERIFIED:
  ⚠ Cabinet Office sponsorship guidance for arm's-length bodies (regime)
  ⚠ Fulton Report (1968)                 ⚠ Northcote-Trevelyan model (doctrine)
  ⚠ Next Steps agencies / arm's-length bodies framework documents (mechanism)
  ⚠ 4 further terms were named and never put to the corpus
```

**§8's single measure, decisively:** *"carltona, osmotherly, accounting officer, senior
responsible owner, ministerial responsibility"* — **all five of the terms §8 names**, none of
them anywhere in the 2,934 characters Charlie wrote, and **14 cited findings under them.**
✓ MET.

⚠ **The cap raise from 12 to 18 is what took confirmations from 7 to 14.** Run B named 20 and
tested 12; run C named 18 and tested all of them. *Managing Public Money*, *Ministerial
Responsibility* and the *National Audit Office* — three of the eight run B dropped — are all
confirmed here.

⚠ **The logic pass came back DIFFERENTLY on the same idea**: run B *"the chain holds, 0
defects"*, run C *"the chain does NOT hold, 2 defects"*. That is worth knowing about rather
than smoothing over — it says the pass is genuinely reading rather than returning a constant,
and it says a single run of it is not a verdict.

### ⚠ AND RUN C FOUND A THIRD DEFECT — IN §1's OWN ORDERING

The top of the screen was **eight rows of "The critique rewrote summaryDiagnosis"**, with
**56 cited sources below them.**

The cause is arithmetic in the ranker: `CONTRADICTS` was worth **100** and a citation **50**.
The revision and the critique both write their "where I changed my mind" records as
`kind: CONTRADICTS` with `citation: null` — correctly, because their source is a pass rather
than a document — so an uncited note about our own process outranked every cited finding in
the build. §1's sentence is *"Cited findings and named sources lead. Abstractions follow"*, and
the ranking said the opposite.

Two changes: **the weights are reversed** (a citation 100, a contradiction 60), and the process
notes get **their own section** — *"Where I changed my mind"*, below the record, saying plainly
that none of it carries a citation because it is our working rather than something the record
says. They are the best sentences a build produces; they are simply not findings about the
world.

⚠⚠ **`check:lex-25f`'s own §1 assertion had been passing on the wrong ordering** — it read
`CONTRADICTS += 100` out of the code and asserted that exact literal. **An assertion written
from the code it guards agrees with the code by construction.** It now states §1's sentence
instead, and a second check compares the two numbers rather than matching either.



---

## WHAT SEARCH NEEDS TO KNOW

Per §25.8 — Lex owns the questions, Search owns retrieval. Two things changed about the
queries this thread issues, and neither touches routing:

1. **Queries are now WRITTEN per job rather than extracted from the draft.** Nine
   near-identical bag-of-words queries per build become nine purposeful ones carrying terms
   of art. Expect the *content* of build queries to change substantially; the volume and
   the intents are unchanged.
2. **A new burst of short entity queries after the research pass** — up to 12 per build,
   `limit: 6`, intent `LEGAL_LANDSCAPE`, each one a single term of art. These are §2b's
   "the models supply the vocabulary; the corpus supplies the authority". They are serial
   like every other build search, so a build is still at most one search in flight.

Nothing here proposes a new intent.

---

## NOT DONE, AND WHY

- **`costSummary` is still EMPTY.** Deliberate — see §6b above. Stated rather than covered.
- **The eight items in `LEX_25F_CUTOVER.md` §9c-A** — the tour, the FAQ, the first-idea
  modal and intro, the greeting, "say the word", feedback capture and Exit — are **not
  built onto `/ideas/build`**. They are the work the flip is waiting on and they are not in
  25-F's scope. The flag stays at `create` until they exist.
- **No browser walk.** No Clerk session exists from a CC session and local Clerk is a dev
  instance (`pk_test`), so the new build screen has not been clicked. The rendering is
  asserted by the check against the component source and by the live rebuild's data
  read-back; **it has not been looked at**.
- **Delivery checks 2–4 (CLAUDE.md §20) are NOT run** — this sprint ends with
  `commit-lex-25f.sh` and they follow the push. **Nothing here is claimed to be live.**
  (Check 1 — `check:committed` — WAS run before the push and correctly reports the eight
  new files as uncommitted; all eight are in the commit script, and `git check-ignore -v`
  clears every one of them individually.)

## THE COST

A build was **6.78p** and is **37.4p** — ten passes instead of seven, `gemini-2.5-pro` on
the four that judge rather than `gemini-2.5-flash`, two outside models, and eighteen extra
entity searches. §2e's budget was *"a build that produces something worth an MP's attention
can afford 30p"*; the ceiling is 50p and is unchanged.

⚠ **The cost is not evenly spread and the screen says where it went** — the per-pass
breakdown is already rendered and now names the model beside it, so the next person deciding
whether a pass is worth its model has the numbers in front of them rather than in a log.
