# SPRINT 25-C — the review agenda, and four defects that undermined it

**Executes:** `docs/BRIEF_25C.md` §1–§5 plus Charlie's five-point addendum and the §C4-style note on
model reachability. **Thread:** LEX. **Written:** 2026-08-20 23:24 UTC.
**Guards:** `check:lex-25c` **32/32, every control firing** · `check:build-25a` 40/40 (40 controls,
0 inert) · `check:build-25b` 54/54 · `check:deepening`, `check:never-claim`, `check:panel-claims`,
`check:flags`, `check:model-registry` all pass · `tsc` clean · `lint:templates` (new) gates `lib/`.
**Live:** four seven-pass builds, one three-vendor reachability sweep, one per-vendor structured call.

---

## The one-paragraph version

The four presentation defects are fixed, the agenda is built and mounted, and **the acceptance
criterion that has carried "undemonstrated" for two sprints is demonstrated**: a positive
`EXISTING_POWER` finding now visibly moves the instrument fork, on a real build, on a deliberately
chosen idea. Getting there took **three defects stacked on top of each other**, none of which was the
one everybody assumed. Separately, the sift's failure turned out to be a **platform-wide retrieval
fan-out** rather than a Deepening bug, and closing §4c made `gemini-2.5-pro` reachable for the first
time while revealing that **five of seven Claude models reject a parameter we send on every call.**

⚠ **Four findings reverse a standing assumption.** Each is stated where it belongs below.

---

## §1 — two corrections that went wrong by standing still

**1a. The attribution note had inverted the rule it exists to enforce.** It asserted, as a standing
fact, that committee witness names are not stored. CC-Ingest recovered them on 19 Aug and **96.87% of
committee evidence rows now carry attribution** — so Lex was being told to disclaim names it was
being handed and shown. A never-claim rule running backwards is still a false statement, and a worse
one than the gap it replaced, because it makes Lex sound careful while being wrong.

⚠ **The claim was in THREE places** — the constant, the module header, and the `EvidenceResult` field
doc. Fixing only the one the model reads would have left the next reader believing the gap was open.

**The fix is not "update the sentence".** A coverage figure written into code is a claim that decays
the moment another thread does its job, silently, because nothing re-reads it.
`attributionAbsenceNote(held, total)` now **counts the rows in front of it**: *"11 of the 12 items
below carry a '—' line naming who said it; 1 does not."* It cannot go stale because it is recomputed
per call. The guard asserts the SHAPE — that the note is derived and not a constant — because a check
that only fires when someone edits the file would not have caught this.

**1b. `tna-caselaw` added to `TITLE_FROM_DB`.** Case law went 0% → 99.98% titled and the FTS index has
not been rebuilt since, so the dense half of a hybrid search showed *Miller v Secretary of State* and
the keyword half showed the literal string `tna-caselaw` — the same document under two titles in one
result set, which reads to a user as two documents.

---

## §2.1 — why the sift stopped running

The evidence was already on disk: **3 of 4 passes hit
`[deepening:sift] truncated — cut off at maxOutputTokens=8000`** and honestly reported *"Reviewed 630
sources. The sift did not run…"*.

⚠ **§18's truncation guard worked exactly as designed.** It turned what would otherwise have been a
silent fall-back to ranked order into a sentence a user could read. The defect was upstream of it.

### ⚠⚠ IT IS NOT A DEEPENING BUG. IT IS A PLATFORM-WIDE RETRIEVAL FAN-OUT.

`GatewayQuery.limit` is documented as *"Max canonical results before grouping"*. It is not. It goes to
**every routed stream**, each stream over-fetches ×3 for fusion, and the interleaved **sum** comes
back. Measured live:

| asked | `results` | per stream | `grouped` |
|---|---|---|---|
| `limit: 10` | **150** | 30 · 30 · 30 · 30 · 30 | 20 |
| `limit: 34` | **500** | 100 · 100 · 100 · 100 · 100 | 20 |

`min(3 × limit, 100) × streams` — **15× at small limits.** `grouped` is 20 either way, which is
precisely why nobody has seen it: every caller that reads `grouped` is capped downstream and looks
correct while paying for the rest in latency and tokens.

**Callers reading `results` unfiltered, and therefore getting the flood:** `chat-retrieval.ts` (every
Lex chat turn) · `gateway-legacy.ts` (the three legacy legislation surfaces) · `deepening.ts` ·
`build-research.ts` · `build.ts` orient · `deepening-retrieval.ts` · `orchestrator.ts`.
`general-chat.ts` already knew and slices — it still pays for what it discards.

**The Deepening was not the defect; it was the only caller loud enough to notice**, because it is
unusual in reading `results` unfiltered AND then paying a per-candidate model cost. Everything else
absorbs it silently.

▶ **Written up for CC-Search as `docs/FINDING_FOR_SEARCH_gateway-limit-fanout.md`. The gateway,
router and interleave are untouched** — the contract is theirs and a change there moves recall for
every surface on the platform.

**Fixed on our side** by capping the candidate set at the configured target in both callers (a prefix
is fair *only* because `interleaveStreams` round-robins, so it is stream-balanced rather than
legislation-heavy) and by sizing the sift's ceiling from the candidate count so it cannot fire for an
arithmetic reason again. The unjudged discard is logged loudly, because it is retrieval we paid for
and did not use.

### The separate question — REFUTED

The brief asked whether the even 6/6/6/6 type split is **a cap applied before the sift**, and flagged
it as a possible design question for Charlie. **It is not a cap.** It is `interleaveStreams`
round-robining across the routed streams. `groupForPanel`'s cap is **3** per type, not 6, and the
Deepening reads `res.results`, not `res.grouped`. **The sift receives the whole union and can choose
the best 28 of 630.** Nothing quotas it, and there is no design question here.

---

## §2.2–§2.4 — the other three presentation defects

**§2.2 — model instructions were on the user's screen.** Two strings travelled inside
`EvidenceItem.body`, which is both rendered in the panel and fed to the adversarial reader: *"Never
tell a user a matter is devolved or reserved…"* and *"Say so plainly. Do NOT substitute what was
PREDICTED for what was OBSERVED."* Split **at construction** into `{ forUser, forModel }`, never by
stripping afterwards — a stripper is a regex over prose that stops matching the day someone rewords
the sentence, and the leak returns unnoticed. ⚠ **The substance stays with the user**: a caveat they
cannot see is a caveat that cannot protect them; only the imperative moves.

⚠⚠ **The check caught a bug `tsc` structurally cannot.** After the split, one call site still read
`${precedentBlock(p)}` — which compiles cleanly and writes the string **`[object Object]`** into every
precedent body. See §Addendum-2.

**§2.3 — two things wore one badge.** A deterministically assembled precedent record (built around a
named instrument, precedent test satisfied *by construction*) and a model's summary of one document
both rendered as "Precedent". Now `Precedent — assembled record` and `Precedent — read from one
document`, **derived from `sourceType`**, not set per call site. The model-written items are kept, as
the brief requires; what changed is that the user can tell which is which.

**§2.4 — the unknowns repeated themselves.** Collapsed on **(statement type, question)** with subjects
unioned — never on string similarity, which would merge two gaps about different instruments and lose
one invisibly. The type is **tagged at creation** by the producer that knows it, so nothing downstream
guesses. **Losslessness is asserted**, and the control proves the assertion can fail: it feeds
`subjectsLost` a naive dedupe and requires it to notice the dropped instrument.

---

## §3 — the review agenda

`lib/lex/agenda.ts` + `AgendaPanel.tsx` + a GET/PATCH route, mounted **above** the Deepening's cards.

⚠ **CONTRADICTIONS LEAD, and the ordering is data rather than JSX order.** `AGENDA_SECTIONS` is a
constant the check asserts, because §3b's point is exactly that *"I first concluded X; the evidence
says Y"* was buried mid-list and is the most valuable sentence a build produces.

| section | what it does |
|---|---|
| **Contradictions** | before / after / why, struck-through original — leads the agenda |
| **Decisions** | Lex's recommendation **with its reasoning**, the alternative, the case for each |
| **Challenges** | the existing triage; a dismissed issue stays visible with its reason |
| **Reading** | **2–3 sources**, each with the sift's own "what it bears on" sentence |
| **Gaps** | classified research task · only-you · **a limit in our tooling** |
| **Your contribution** | what you told us, and where more would help most |

**The framing is at the bottom** — §19-E's placement lesson, and the check asserts it via `indexOf`
(not `lastIndexOf`, which the control proved would miss a duplicate planted above the work).

Three design points worth naming:

- **It assembles; it does not generate.** No model call, asserted by a guard. An agenda that
  re-summarised the findings would be a fifth opinion about them, billed on every page load.
- **Resolving a decision keeps both.** The PATCH writes only `resolved` / `resolvedChoice` /
  `resolvedAt`; `chosen`, `alternative`, `caseForAlternative` and `recommendationReason` are
  untouched. `resolvedChoice` is a **string**, not a boolean — a boolean records *that* a decision
  happened and loses *what* was decided, which is the defect it exists to fix.
- **Missing reasoning is rendered, not hidden.** A build made before 25-C has none, and the panel
  says so rather than showing a confident blank.

---

## §3a — THE INSTRUMENT FORK, DEMONSTRATED

> ```
> RESEARCH: DONE — 7 questions asked; reviewed 500 sources; 35 findings;
>                  20 stated gaps — ⚠ an existing power may remove the need for a Bill
> ✓  the instrument question fired on a primary-legislation draft
> ✓     …and a positive finding VISIBLY changed the instrument fork
> ·  instrument fork now reads: Use the existing power: Renters' Rights Act 2025
> 16 passed, 0 failed.
> ```

The build drafted "Primary legislation (Act of Parliament)"; the research found the Renters' Rights
Act 2025; **the fork moved to offer it.** On a deliberately chosen idea, not a hopeful one.

### It took three defects, each hiding the next

**1. The assessment read the wrong findings.** Before running anything I isolated the gate
(`scripts/probe-existing-power.ts`) and fed it the powers the 25-B runs had *already surfaced*. It
recognised **3 of 3**, with a control naming no power correctly returning false. **The gate was never
shut** — which reverses the standing assumption that the corpus does not surface enabling provisions.

The fault was SCOPE: `assessInstrumentRetirement` ran *inside* the question loop on the leading
question's own findings, while the powers were surfaced by the **other** questions — the Renters'
Rights Act by the revision reading all the research, s.123 of the Housing and Planning Act 2016 by
the adversarial reader. **The one question named after the power was the one place the power was
not.** The question still leads; the verdict is now taken once, at the end, over everything.

**2. A claim whose result was not checked.** `recordInstrumentRetirement` logged *"instrument fork
changed by research"* unconditionally after its `updateMany`, without reading the count. On run 2 the
assessment correctly returned `powerFound: true`, the line duly announced the fork had changed, and
the database showed no such fork — **it was reporting the sprint's headline acceptance criterion as
met while it was not.** It now reads the count, and **creates** the fork when the approach pass named
no instrument, because losing a real finding for want of a row to put it on is the worst outcome
available.

**3. Pass 4 was erasing pass 3.** Resolving a fork overwrote `caseForAlternative` with its own
settlement note — destroying the "⚠ THE RESEARCH FOUND AN EXISTING POWER" text the research had just
written. Two passes, both behaving reasonably, and the more valuable write lost. It is also precisely
what §3a forbids. The settlement now goes to `recommendationReason`; the case for the road not taken
is never erased.

All three are guarded, each with a control.

---

## §4c and the model-reachability addendum

**Per-model thinking, three vendors behind one interface, and a check that fails loudly.**

- **`thinkingBudget` is per model, not global.** `gemini-2.5-pro` rejects a zero budget outright, and
  that single line made it unreachable through **all seven build passes** while the registry listed
  it as available. The output ceiling rises with it, because thinking tokens count against it.
- **`model-call.ts` adds Anthropic and OpenAI behind the same interface**, each held to §18's three
  rules (stop reason before parsing · the failure names itself · usage returns on failure paths).
  Structured output is requested three different ways — `responseSchema`, a forced tool,
  `json_schema` strict — which is the whole reason a shared helper is worth having. `closeSchema`
  adapts our Gemini-shaped schemas for strict mode rather than asking callers to keep two.
- **`callJson` dispatches by provider**, so all seven passes gained all three vendors at **one change
  point** — rather than seven call sites each growing a vendor branch, which is exactly how the
  truncation guard came to be missing from seven callers.
- ⚠ The result types were briefly declared in two files and `tsc` caught it immediately. There is now
  **one definition**, re-exported.

### What the live sweep found

`check:model-reachability` — 16 models, real calls, **echoed-model comparison** (a 200 is not proof
you got the model you asked for), four verdicts:

| verdict | count | note |
|---|---|---|
| OK | 15 | **including `gemini-2.5-pro`, reachable for the first time** |
| REJECTED | 1 | `grok-4.20-multi-agent-0309` — *"Multi Agent requests are not allowed on chat completions"* |
| SUBSTITUTED | 0 | the `grok-3-fast-beta` class is clean |
| NO KEY | 0 here | — |

⚠ **`REACHABLE.openai` is empty, so NOTHING was probed for OpenAI**, and the check now says so
explicitly. A green run is not a statement about a provider with no models in config — that is the
quietest failure this check could have had. Populating it needs a probe where the key exists;
**adding ids on the strength of a list read is the error this whole check exists to prevent.**

### ⚠⚠ And what only a REAL call could find

`verify:model-vendors` makes an actual structured build call per vendor. It caught what the ping
cannot: **`claude-sonnet-5` rejects `temperature`** with a hard 400 — *"`temperature` is deprecated
for this model."* Reachability said OK; every structured call would have failed.

Probed across the whole Anthropic list rather than guessed:

| | |
|---|---|
| **accepts** `temperature` | `claude-haiku-4-5`, `claude-haiku-4-5-20251001` |
| **rejects** | `claude-opus-5`, `claude-sonnet-5`, `claude-fable-5`, `claude-opus-4-8`, `claude-opus-4-7` |

⚠ **An allow-list, not a version rule.** "Anything below 5 accepts it" would have been tidy and
wrong: `claude-opus-4-8` and `4-7` reject it while `claude-haiku-4-5` does not.

**§4b honoured: the multi-perspective comparison was NOT re-run.** It stays flag-gated and off.

---

## Charlie's addendum, point by point

**1. Platform finding, reported not fixed.** ✅ Measured, callers enumerated, written up for
CC-Search, gateway untouched.

**2. Fix the class, not the instance.** ✅ `@typescript-eslint/restrict-template-expressions` is on.
Repo-wide it reports **124**: `any` 86 · boolean 18 · RegExp 8 · unknown 5 · never 3 · array 1 ·
Decimal 1, by area **scripts 80 · app+components 39 · lib 3**.

⚠ **The 86 `any` are overwhelmingly `catch (e) { … ${e} }`, and 80 of 124 are in `scripts/`.** Gating
on that would be the "thousands of findings nobody asked for" failure — the noise would train
everyone to bypass it and take the one that matters with it. So **`lint:templates` gates `lib/` only**
(the 3 remaining are CC-Search's, reported not edited, one of them real: `stats-catalogue.ts`
interpolates an `unknown` into a user-facing gloss) and `lint:templates:all` runs the sweep.

**3. §3 before §4c.** ✅ **You were right and I was wrong** — I asserted a dependency I could not
name. The agenda reads rows that already exist and needs no model. It went first.

**4. A deliberately chosen test idea.** ✅ And it produced a finding rather than a fifth
non-result — see §3a.

**5. `check:s8-attribution`.** ✅ Untouched, reported, and in the CC-Search document.

---

## Two guards that had gone inert, caught by their own harnesses

- **`check:build-25a`'s thinking guard** pinned the literal `thinkingConfig: { thinkingBudget: 0 }`,
  which moved into the helper. Now asserts the property.
- **Its progress-display control used `.replace`**, which substitutes only the FIRST occurrence — and
  25-C added a second `elapsed(build.elapsedSeconds)`. The mutation left one standing, so the
  assertion still matched and the harness correctly reported *"this assertion cannot fail, so it is
  asserting nothing"*. Now `split/join`. **40 controls, 0 inert.**

⚠ **And one of mine did the same thing in reverse.** My Python edit helper writes CRLF on Windows;
`check:build-25b`'s worker-loop guard slices on `'\n}\n'`, matched nothing, and reported a failure
about perfectly correct code. Both harnesses now normalise line endings on read.

---

## What is NOT verified

1. **No signed-in browser walk.** The extension has no host permission for `localhost:3000` and this
   session has no Clerk session on production. **The agenda has never been seen in a browser** — it is
   covered by guards over its assembly, its ordering and its route, and that is not the same thing.
2. **OpenAI is unproven end to end.** No key on this machine; `REACHABLE.openai` is empty. The
   interface is written and the Anthropic sibling works, which is evidence but not proof.
3. **`grok-4.20-multi-agent-0309` needs a decision** — remove it from `REACHABLE` or route it to the
   endpoint that accepts it. Not mine to choose.
4. **The `limit` fan-out is capped in two callers, not fixed.** Six others still take the flood.

---

## Cost

| | |
|---|---|
| four live seven-pass builds | ~24p |
| reachability sweeps + vendor probes | ~2p |
| **total** | **~26p** |
