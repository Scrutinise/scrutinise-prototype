# SPRINT 25-D / 20-E — the panel by question, the user's own material, and the annex

**Executes:** `docs/BRIEF_25D_20E.md` §1–§6 in full. **Thread:** LEX. **Written:** 2026-08-21 01:20 UTC.
**Guards:** `check:lex-25d` **77/77, 26 controls, all fired** · `verify:lex-25d` **32/32** ·
`verify:lex-25d --with-model` **37/37** · `check:20bd` 47/47 · `check:build-25a` 40/40 ·
`check:build-25b` 54/54 · `check:lex-25c` 32/32 · `check:model-reachability --controls`
**15 usable, 5 controls fired** · `check:deepening`, `check:never-claim`, `check:panel-claims`,
`check:flags`, `check:model-registry`, `check:corpus-types`, `check:llm-guards` all pass ·
`tsc` clean.
**Live:** two reachability sweeps (16 and 15 models, real structured calls), five vendor
parameter controls, one findings pass over a real document, four live URL extractions.

---

## The one-paragraph version

§5 was reachable, so all six sections shipped. The right-hand panel is now organised by the
ten §25.5 questions rather than by document type, and **an empty heading states its gap with
the right one of four reasons** — which is the part that took the most care, because "we
looked and found nothing", "this wasn't asked of your draft" and "nothing we have can answer
this" are three different sentences and only the third is true of *"Who has taken a
position"*. Sources can be excluded with a reason and stay visible as excluded; publishing
pins the outstanding items into the version so a recipient sees what the author knew was
unfinished; documents and links are read once into findings and never enter a prompt again;
and the Evidence Pack and the Online View are both built over the existing snapshot.

⚠ **Three findings are worth reading before the sections.** One reverses part of the brief's
framing, one is a defect this sprint introduced and caught, and one is a limit I could not
close.

---

## §1 — three model-registry fixes

**1a. `grok-4.20-multi-agent-0309` is out of `REACHABLE`.** Charlie's decision, executed with
the reason recorded beside the absence rather than left as a silent gap for someone to
"fix". xAI stays a vendor; its standard models are reachable and untouched.

**1b. Sampling parameters are per-model, and it is a general decision rather than a second
one-off.** 25-C fixed `claude-sonnet-5`'s hard 400 with an allow-list **inside the Anthropic
branch**. That was correct and too narrow in two ways: it lived in one vendor path, and it
listed models that *accept* — so an Anthropic id nobody had probed silently lost a parameter
it supports. `lib/lex/model-sampling.ts` now states the measured fact instead
(`REJECTS_TEMPERATURE`: five ids, probed live, an allow-list and **not** a version rule), and
**all three vendor paths plus the build's own Gemini client go through one gate.** The
omission is logged rather than silent.

The check asserts the precise property — *the caller's temperature is read in exactly one
place, and three vendor bodies spread it* — because the obvious assertion ("no `temperature:`
anywhere") fails on the gate's own helper and would have taught the next person to delete the
guard.

### ⚠⚠ 1c — the reachability check certified a model on which every real call would fail, and it now cannot

**Watched failing first, and this is the evidence.** With the per-model gate temporarily
emptied — i.e. the pre-fix state — the rewritten check reports:

```
✗ REJECTED  claude-sonnet-5   HTTP 400 {"message":"`temperature` is deprecated for this model."}
✗ REJECTED  claude-opus-5 · claude-fable-5 · claude-opus-4-8 · claude-opus-4-7
10 usable · 5 rejected
```

With the gate restored: **15 usable · 0 rejected · 0 unusable · 0 substituted.**

The probe is now `callModelJson` — the production entry point, production parameters,
production structured-output mode — and the schema **nests an array of objects**, because
every real schema in this codebase does and the three vendors handle nesting differently. A
flat `{answer: string}` probe would be the same "tested the door" error one level down.

⚠ **`UNUSABLE` is the verdict 25-C did not have, and it is where `claude-sonnet-5` lived.**
Five outcomes now, and they must not be collapsed: `OK` · `SUBSTITUTED` · `REJECTED` (the
provider said no) · `UNUSABLE` (the provider said yes and the answer could not be used) ·
`NO KEY` (a fact about this machine, never a failure).

⚠ **xAI is an honest exception, stated per model.** `callModelJson` has no xAI
structured-output client, so no representative call is possible; those six are marked
`[ping only]` and the summary names them. A green tick beside a ping and a green tick beside
a production-shaped call must not read the same — that equivalence is the 25-C defect itself,
one level up.

⚠ **And the echoed model now comes back on EVERY call**, not only inside the check.
`LlmUsage.echoedModel` carries what answered; `build-llm.ts` warns loudly when it differs.
The check runs on demand, and a substitution that begins between runs was invisible until
someone thought to look — which is exactly how `grok-3-fast-beta` served a different model
for months.

---

## §2a — a source can be set aside, and stays

`IdeaSourceDecision`: include / exclude / annotate, one row per (idea, source).

⚠ **A ROW, NOT A FLAG, and the reason is not tidiness.** Corpus sources live in JSON columns
that *retrieval* writes — `Idea.legislationRefs`, the per-stage search store. A decision
written there is **destroyed the next time the search runs**, which it does on every stage
transition and every retry. "Excluded, never deleted" cannot be built on a column a re-run
overwrites.

⚠⚠ **AND THE ROW CARRIES THE SOURCE'S OWN TITLE, CITATION AND URL.** This is the part that
is cheap now and expensive later. A source can be excluded today and gone from retrieval
tomorrow — rankings move, collections are reindexed, a stage search re-runs with different
terms. Without its own copy, *"what was considered and set aside"* degrades into a list of
ids nobody can resolve, and **the feature fails precisely in the case it exists for**: the
source someone went looking for and could not find. The fixture and the live harness both
exclude a source that is deliberately **not** in the retrieved set, and assert it still
renders.

**An exclusion with no reason is refused by the write path**, not defaulted and not stored
with a null — watched refusing against a real row, with nothing written. And **re-including
keeps the reason**: the user changed their mind, and why they had set it aside is part of the
record of that. There is no `DELETE` on the route, which is the structural form of "never
deleted".

---

## §2b — publishing pins what was open

20-B/D found the distinction and it is real: **the review agenda is per-idea and continuous;
a published version is per-artefact and frozen.** `ProposalSnapshot.outstanding` now carries
the open issues, the unresolved forks, the declared gaps and the settled-but-unsupported
fields **as they stood**, and `mintVersion` freezes it by storing it.

Proved by moving the state afterwards:

| | live snapshot | pinned version |
|---|---|---|
| open issues | 0 | **1** |
| unresolved decisions | 0 | **1** |
| excluded sources | 3 | **2** |

⚠ **One entry per decision point, not per alternative.** A three-way fork is three `BuildFork`
rows sharing a `forkKey`; counting rows would report one open decision as three — and that is
the number §24's *"12 of 14 findings resolved since"* would then compare against. The live
harness plants a second alternative on the same fork specifically to catch this.

**Curation was NOT built as a separate surface.** 20-B/D's recommendation to merge is right
and §25.3 item 9 already absorbs the claims check.

---

## §3 — the panel, by question

`SNAPSHOT_VERSION` is 2; the panel is `lib/lex/question-panel.ts` + `QuestionPanel.tsx`,
mounted **above** the type-grouped list, which stays and folds.

⚠ **A HEADING KNOWS WHY IT IS EMPTY, AND THERE ARE FOUR REASONS THAT MUST NOT SHARE A
SENTENCE.** This is the part of §3 that mattered most and the part that would have been
easiest to get quietly wrong:

| reason | what it says | when |
|---|---|---|
| `asked-found-nothing` | *"We looked for judgments construing the provisions this turns on, and found nothing."* | the question ran |
| `not-asked` | *"This wasn't asked of your draft."* | `firesWhen` was false |
| `no-producer` | *"We hold the voting record, and Lex cannot yet read it — a limit in our tooling."* | nothing can answer it |
| `nothing-added` | an invitation, not a gap | "Your material", empty |

⚠⚠ **`no-producer` is the one that would otherwise have been a false statement about the
world.** *"Who has taken a position"* has no producer: the position graph holds 2.3M signals
and **nothing in Lex reads it** (§25.8 item 6). Rendering that as "we looked and found
nothing" would blame the record for a gap of ours. The check asserts both directions — no
heading may be silently unanswerable, **and** a heading declared unanswerable may not also
carry findings, because that combination tells the user their evidence does not exist while
showing it to them.

**The heading is tagged by the producer, never derived by the panel.** `EvidenceItem
.headingKey` is written at creation by the code that knows the answer; questions declare
their heading in `interrogation-library.ts`, Deepening passes in `deepening-config.ts`, and
the two retrieval jobs declare **their own** rather than their pass's — `runDevolutionScope`
runs inside LEGAL and answers *"what's devolved"*.

### The mapping, and what had no home

`check:lex-25d --map` prints this from the code rather than from a report that goes stale:

| §25.5 heading | producer |
|---|---|
| What the law says now | EXISTING_POWER · LEGAL_LANDSCAPE · the Legal pass |
| How the courts have read it | CASE_INTERPRETATION |
| What was tried before — and what happened | LINEAGE · PRECEDENT · the Evidence & precedents pass |
| Where this mechanism works elsewhere | DOMAIN_TRANSFER |
| Who has argued about this | CAUSE_SEEDING |
| **Who has taken a position** | **NOTHING — declared, not hidden** |
| The numbers | CAUSAL_EVIDENCE · the Financial pass |
| What's devolved | DEVOLUTION_SCOPE · the devolution job |
| The strongest case against | the Political risk pass · the adversarial read |
| Your material | this sprint |

Two mappings are judgement calls and both are defended in the code:

- ⚠ **LINEAGE files under "what was tried before"** — *the current provision is itself a
  previous attempt.* What it was enacted to fix, and whether the complained-of feature was a
  deliberate compromise, is exactly "what was tried and what happened"; it just happens to be
  the attempt still in force.
- ⚠ **POLITICAL_RISK files under "the strongest case against", NOT "who has taken a
  position".** It produces attack lines and what killed a comparable measure — an argument,
  not a register of who voted which way. Filing it under POSITIONS would have let that heading
  look answered while the voting record stayed unread, which is the honest gap this panel
  exists to show.

⚠ **`REVISE` — the build's contradictions — is deliberately UNFILED**, and the code says so
rather than leaving it to look forgotten. *"I first concluded X; the evidence says Y"* leads
the review agenda (25-C §3b); giving it a panel heading would file the build's best output
back among the source cards, which is where §3b found it buried in the first place.

**Rows with no heading are NAMED, not dropped** — everything written before 25-D — under an
explicit "Not filed under a question", in the panel and in the Evidence Pack. §3's rule: a
source with no heading is a gap in the library, not a source to drop.

Every entry carries the sift's own reason **verbatim or not at all**. Where none was
recorded, the panel says so; it never writes a plausible sentence for a judgement nobody made.

---

## §4 — documents and links

`IdeaUserMaterial`: PDF, Word, text, HTML and URLs. **The extracted text and nothing else** —
no binary is written to the database or to R2.

⚠⚠ **THE DOCUMENT IS READ ONCE AND NEVER ENTERS A PROMPT AGAIN.** On ingest it becomes
findings with provenance, and those go into the evidence layer like any other source. A
fifty-page report then costs nothing per turn. The check asserts the text is read in exactly
one place and that the route never selects or returns it.

⚠⚠ **EVERY QUOTE IS VERIFIED AGAINST THE STORED TEXT, NOT TRUSTED.** This is the check that
makes "findings with provenance" mean anything. A model asked to quote will sometimes
reconstruct, and a reconstructed quote attributed to *the user's own document* is the most
damaging thing this feature could produce. Comparison is on normalised whitespace and quote
marks — anything stricter rejects honest quotes out of a PDF and teaches us to remove the
check; anything looser (first-few-words, similarity) lets a reconstruction through. A finding
whose quote is not found is **dropped, counted and logged**. On the live run: **3 of 3
findings quoted verbatim, filed under the questions they answer, marked as the user's own.**

Findings appear **under the question they answer, beside corpus material**; the *document*
appears under "Your material" saying what it produced — read / read-and-nothing-useful /
stored-but-not-read / failed are four different states and each is named.

Deleting the idea deletes the text and every finding taken from it — **watched firing**, not
inferred from a cascade nobody has seen fire.

### ⚠⚠ The defect this sprint introduced, and how it was caught

A careless edit to the control-character class made it match **the letter `u`**. Every
uploaded document silently lost every `u` — *"Treasury"* became *"Treasry"* — with no error,
nothing in a log, and no way to notice short of reading the stored text. It was caught by
**looking at the output of a live fetch**, which is not a method that scales.

`normalise` is now exported and `check:lex-25d` asserts **letters survive**, with a control
that plants a class matching a letter. The assertion is deliberately about the output rather
than about the regex, because the regex is what gets edited next.

The same live run found the original whitespace collapse could not touch what it was for:
gov.uk and legislation.gov.uk extractions began with hundreds of characters of newline-space
pairs — the skeleton of stripped navigation — because those are not consecutive newlines.
That is budget the findings pass spends on nothing, and a document whose visible beginning is
blank reads as a failed extraction. 12,348 → 12,039 chars, and the head is now the title.

⚠ **A raw NUL byte in the source made the whole module read as BINARY to `grep`** — a guard
that grepped this file would have matched nothing and reported a clean pass. §13's byte-level
rule, arriving from the other direction.

---

## §5 — the Evidence Pack and the Online View

**5a. The Evidence Pack** renders through the existing document model, from the snapshot
only. Sources grouped by the question they answer; the cost basis figure by figure with
**`NO BASIS STATED`** on anything unbacked; ruled-out alternatives with reasons; the resolved
forks with the road not taken; **the excluded sources with their reasons**; and what was
outstanding at that version.

⚠ *"Nothing was set aside"* **is stated, not omitted.** An absent section reads as "we did
not do this part"; the sentence reads as "we did, and the answer was none".

⚠ **A shape-1 snapshot still renders.** A version published last week is one somebody holds a
link to. The newer sections are stated as *never recorded* rather than shown empty, which
would say the author had nothing to declare.

**5b. The Online View** is now the thing rather than a cover sheet: the kernel, the causes,
the actions, what it rules out, the evidence by question **with the corpus links live**, the
sources set aside with reasons, and the pinned outstanding block — all from
`publishedProposalVersion.snapshot`, with **no read of live idea state anywhere on the page**.
The Evidence Pack is offered from the shared link.

---

## §6 — acceptance criteria

| criterion | status |
|---|---|
| three model fixes live; the reachability check makes a representative structured call and was watched failing against `claude-sonnet-5` | ✅ |
| a source can be excluded with a reason and remains visible as excluded | ✅ live |
| publishing pins the outstanding items; a later change does not alter what was pinned | ✅ live |
| the panel renders by question; a fired question with no results shows a stated gap; every entry has a specific reason line; the mapping report names anything with no home | ✅ |
| a document and a link can both be added; neither appears wholesale in a prompt; findings appear under the right question, marked as the user's; deleting the idea deletes the text | ✅ live |
| Evidence Pack renders with excluded sources and gaps; the Online View is pinned to its version | ✅ |
| `check:committed` clean; delivery verified per §20 | see below |

---

## Delivery (CLAUDE.md §20)

Recorded in the change log entry. Any check that could not be measured from this machine is
labelled as an inference rather than a measurement.

---

## What is NOT verified

1. ⚠ **No signed-in browser walk — still.** The extension has no host permission for
   `localhost:3000` and this session has no Clerk session on production. **The by-question
   panel and the "Your material" control have never been seen in a browser.** They are
   covered by guards over their assembly, their routes and their rendering, and by a live
   run of every write path — and that is not the same thing. ▶ Charlie.
2. **Document *upload* through the HTTP route is unproven end to end.** The extraction,
   storage, findings pass, panel rendering and deletion are all exercised live; what is not
   is a real `multipart/form-data` POST from a browser, because that needs a session.
   The PDF and Word extractors specifically have not run on a real file this sprint — only
   the text and HTML paths have.
3. **The Evidence Pack has not been rendered to PDF/docx through R2.** `buildEvidencePackDocument`
   is exercised over both a fixture and a real stored snapshot; `ensureVersionExport` for the
   new kind has not been run, so the first download will be the first render.
4. **OpenAI is still unproven end to end.** No key on this machine; `REACHABLE.openai` is
   empty and the check says so explicitly.
5. **The `GatewayQuery.limit` fan-out reported in 25-C is untouched** — six callers still
   take the flood. It belongs to CC-Search.

---

## Cost

| | |
|---|---|
| two reachability sweeps + five vendor controls | ~2p |
| one document findings pass | <1p |
| **total** | **~3p** |
