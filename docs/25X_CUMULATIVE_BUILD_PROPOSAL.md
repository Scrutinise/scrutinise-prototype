# 25-X §4 — the cumulative build. REPORT AND PROPOSAL. Nothing here is built.

> *"Taking everything we now know, let's run it all through again"* — so the quality should
> increase with each build.

Written 2026-09-03. Every claim below is a code or database reading, and each says which.

---

## The problem, stated precisely

Today there are two modes and **neither learns**:

| mode | what it does with the last build | cost |
|---|---|---|
| `FULL` | ignores it. Re-searches from the raw idea as though nothing had ever been found. | ~30–37p |
| `REUSE` | copies ORIENT and RESEARCH forward verbatim and skips searching entirely. | ~1 third |

⚠ **Searching from nothing while ignoring what the last pass discovered is the wasteful option,
not the thorough one.** A build has just spent ten minutes discovering that this policy area
turns on *Carltona*, the *Osmotherly Rules* and the Accounting Officer regime — and the next
build begins by not knowing any of those words.

---

## §4a — what the previous build already produces, and whether it is reachable

Seven candidates. **Six are already stored and cost nothing to read; one needs a decision.**

### 1. The terms of art the cross-model expansion surfaced — ✅ AVAILABLE, FREE

`IdeaBuild.passes` stores an `IssuedQuery[]` per pass: `terms[]`, a one-line `purpose`, and
`provenance` (`written` by the query writer, or `extracted` by the term-frequency fallback).
Persisted by `writePass` on ORIENT and RESEARCH.

⚠ **This is the platform's best trick and it is thrown away every build.** Rediscovering
"Carltona" costs a cross-model expansion call; reading it back costs a JSON parse. **Filter to
`provenance: 'written'`** — the extracted fallback is a term-frequency dump and feeding it
forward would entrench a bad query rather than a good term.

**Cost: nil.** No new storage, no new call.

### 2. The diagnosed causes — ✅ AVAILABLE, FREE TO READ, COSTS SEARCHES TO USE

`DiagnosisCause` rows, with `classification` (MATERIAL / CONTRIBUTORY) and the tree. Searching
against each cause is sharper than against the raw idea, which is a paragraph about everything.

⚠ **Scope it by classification.** Searching every cause on a nine-cause tree is nine searches
where three matter. MATERIAL causes and the marked root cause only.

**Cost: ~3–4 extra retrievals** (~1–2p, and wall-clock inside the RESEARCH pass).

### 3. The candidate guiding policies — ✅ AVAILABLE, FREE TO READ

`PolicyOption` rows now carry `kind`, `kindReason`, `number` and `status` since the sort runs.
Precedent for a *specific instrument* is a far better query than precedent for a policy area.

⚠ **Exclude `RULED_OUT`.** Searching for precedent for an approach the user has rejected is
paid research into a settled question — and under decision 60's reasoning, a user's rejection is
a user decision.

**Cost: ~2–3 retrievals** on the live candidates only.

### 4. The challenges — ✅ AVAILABLE, AND NOW FILTERABLE

Each names a weakness; evidence on a named weakness is the highest-value retrieval on this list,
because it is the only one aimed at something the proposal is known to be bad at.

⚠ **This is the item that could not have been built before today.** Until 25-X §3 the challenge
set was 225 rows spanning nine drafts with no version filter, so "search against the challenges"
meant searching against criticism of deleted text. It is now `current` — **79 open, of which 43
are earlier criticisms that still bite** — and archived ones are excluded by construction.

**Cost: the largest single item.** 79 is too many to search individually. **Recommend the merged
current set, capped** — 8–10 searches, ~4–5p.

### 5. The known unknowns — ✅ AVAILABLE, FREE, AND ALREADY A SEARCH LIST

`DeepeningPass.knownUnknowns` is `{ question, why }[]`. *"Questions the research could not
answer"* is literally a list of queries somebody has already written for us.

⚠ **A question that failed once may fail again, and the second failure is worth more than the
first** — it is the difference between "not found" and "not there". Carry the attempt count so
the report can say which, rather than silently re-asking for ever.

**Cost: ~3–5 retrievals**, and it retires a section of the report that currently says only that
these are unanswered.

### 6. The instrument — ✅ AVAILABLE, FREE

The instrument fork (`INSTRUMENT_FORK_KEY`, `guidingPolicy:instrument`) records the vehicle
chosen and the alternatives. Once the vehicle and parent Act are known, the statutory family is
searchable.

**Cost: nil to read; feeds item 7.**

### 7. The citation graph — ✅ REACHABLE. **The coverage contract already permits it.**

⚠⚠ **The brief asks whether the coverage contract now permits it. It does, and the reader is
already built.** `lib/lex/statutory-graph.ts` is the web app's reader over `citation_edge`
(**1,034,548 rows**, in the same Neon database this app already queries). It has:

- a coverage block in which **no figure is written down** — every number is queried at call
  time, and `check:statutory` fails if a digit appears in a coverage sentence;
- layer declarations that are prose-only, so a layer built tomorrow flips to `searched` with no
  edit;
- `verify:statutory-graph-parity`, which runs this reader and Search/Graph's own `inbound()`
  against the same targets and fails on a single differing row id or coverage number.

**What is still missing is not permission — it is a caller.** The graph answers *"what else cites
this provision"*, and the build never asks. ⚠ Two known limits must travel with any answer, and
both are already recorded: **19.1% of non-null `source_provision_ref` values point at a provision
that does not contain the reference** (Explanatory Notes lead), and one gid can have two zip
copies. Neither blocks use; both belong in the caveat the coverage block already generates.

**Cost: nil in model spend** — it is a SQL read, not a retrieval. Wall-clock only.

---

## §4b — the risks, and one of them is serious

### ⚠⚠ Quality does not increase automatically. Entrenchment is the real risk.

A build that starts from the last build's frame can entrench the last build's mistakes. **This
has already happened once on this platform and it is worth naming, because it is the exact
shape:** 25-U found a plastic-bag research gap printed on a civil-service proposal — a sentence
lifted from a prompt's own illustration — and *the next morning's build rewrote the row and put
it back*. A wrong term became data, and the mechanism that should have corrected it re-asserted
it instead. Now imagine that term is also a search query.

**Three proposals, in order of how much they matter.**

**(a) A CONTRADICTION PASS THAT RUNS AGAINST THE CARRIED FRAME, NOT ONLY THE NEW EVIDENCE.**
`REVISE` already produces `contradictions` (`firstConcluded` / `evidenceSays`) and the report
already has a section — *Where the research changed my mind*. That is the right home, and the
change is one of INPUT, not of rendering: the pass must be given the carried terms, causes and
challenges **explicitly labelled as inherited**, and asked which of them the new evidence does
not support. Today it only ever contradicts the current build's own earlier passes.

**(b) EVERY CARRIED ITEM KEEPS ITS PROVENANCE AND ITS AGE.** A term carried from build 7 into
build 10 must say so. Three cheap consequences: the report can show it, the contradiction pass
can weigh it, and **a term that has survived three builds without ever being supported by
evidence is a visible defect rather than an established fact.**

**(c) A CEILING ON INHERITANCE, AND IT SHOULD BIND.** Carry from the **last completed build
only**, never transitively. Without this, a term entering at build 3 is still steering build 12
with nobody having re-derived it — and the platform's own record shows how long a wrong value can
survive when nothing forces a re-read.

⚠ **What the user is told when a later build contradicts an earlier one** is not a new surface.
*Where the research changed my mind* exists; it currently reports only within-build changes.
Widening its input is the whole of the user-facing work.

### The second risk: the search layer

`vector-serve` runs 4 wide with a 64-deep queue and **a client abort does not cancel queued
work**, so timed-out legs feed it. Warm p95 has gone 7.7s → 707s under exactly that. A cumulative
build issuing 15–25 retrievals where a full build issues 10–20 is a real increase against a
service sized for one build at a time. ✅ `LEX_BUILD_WORKER_CONCURRENCY = 1` already holds the
line — **but it must stay at 1**, and this is the reason.

---

## §4c — the user's own words. CONFIRMED, AND IT IS NOT WHOLLY TRUE TODAY

The brief says confirm, do not assume. Confirmed by reading, and the answer is split.

✅ **TESTIMONY: YES, VERBATIM, ON EVERY PASS OF EVERY BUILD.** `runNextPass` calls
`elicitationContext(ideaId, userId)` on every pass — not once per build — and it returns
`problem`, `goalDetail`, `ruledOut` and `ownKnowledge` as stored, with
`ownKnowledgeProvenance = USER_TESTIMONY`, never blended into Lex's prose. Build 10 reads it as
freshly as build 1.

⚠⚠ **UPLOADED DOCUMENTS: NO — AND THIS IS A DEFECT, NOT A DESIGN.**

- **`build.ts` never reads `IdeaUserMaterial`.** Not once. The elicitation context carries
  `reading: { url, fileName, read: false }` — a filename and a flag **hardcoded `false`**.
- The document's *findings* are written as `EvidenceItem` rows with
  `sourceType: 'USER_DOCUMENT'` and **`runVersion: 1`**.
- ⚠⚠ **And several passes filter evidence by `runVersion = c.buildVersion`.** So from build 2
  onward those passes cannot see the user's own document at all. The SMART pass reads evidence
  unfiltered and does see it; the adversarial/clerk pass does not.

**On the accountability idea this is live**: `yourReading` is ACCEPTED — *"How is accountability
measured and achieved anywhere.docx — read; 9 findings taken"* — and those nine findings sit at
`runVersion: 1` while the current build is v9.

▶ **Recommendation, and it is not part of the cumulative build — it should be fixed first and
separately: user-document findings are version-less by nature and every pass should see them.**
Either write them at the current build's version when a build starts, or exempt
`sourceType: 'USER_DOCUMENT'` from the version filter. The second is better: it says what is
true, which is that the user's own document belongs to the idea and not to a run.

---

## §4d — the cost, and whether it is a third mode

**Today: ~30–37p** for a full eleven-pass build (measured: 36.95p, 33.14p, 34.49p, 36.19p,
28.98p, 30.18p).

**Cumulative, estimated: ~45–55p.** The increase is almost entirely retrieval and the calls that
sift it, not prompt size:

| item | added |
|---|---|
| carried terms, instrument, provenance (reading stored JSON) | ~0 |
| causes (MATERIAL + root only) | 3–4 retrievals |
| live guiding-policy candidates | 2–3 |
| current challenges, merged and capped | 8–10 |
| known unknowns, capped | 3–5 |
| citation graph | 0 model spend (SQL) |
| the contradiction pass reading a larger frame | ~1–2p of prompt |

⚠ **The estimate is a bound, not a measurement, and it should be treated as one.** Every figure
above this line is measured; this table is arithmetic over an unbuilt thing. The honest way to
settle it is one build in each mode on the same idea.

▶ **RECOMMENDATION: it REPLACES `FULL` for any idea that has a completed build, and is not a
third mode.**

- A third mode makes the user choose between "thorough" and "learns from last time", and there
  is no reading of the product under which the wasteful one should ever be picked.
- The machinery already downgrades gracefully: `reuseSourceFor` returns null when there is
  nothing to reuse and `claimBuild` records what actually ran rather than what was asked for
  (25-M §4 / 25-O §1a). **A cumulative build on an idea with no previous build IS a full build**,
  with no branch anywhere.
- `REUSE` stays exactly as it is. It answers a different question — *"redraft cheaply without
  re-searching"* — and 25-G built it for that.

⚠ **The allowance has to move with it.** A build costing ~50p against a 37p third is a third that
no longer means what it says. **This is Charlie's call and it is a prerequisite, not a
follow-up:** either the third is repriced, or a cumulative build costs two.

---

## §4e — the prerequisite, and it has landed

✅ **Decision 54 is applied.** The version filter exists (`current` on every snapshot issue), the
documents render the current set by default, and the cleanup has run: 225 challenges, **79 open
in the current set**, 79 archived and still visible under previous drafts, **nothing deleted**.

Without it a cumulative build would have been unsurvivable: it produces MORE challenges, and
challenges already accumulate across every build.

---

## What is proposed, in one list

1. Fix the user-document version filter **first and separately** (§4c). It is a defect today,
   independent of any of this.
2. Carry six things forward from the last completed build only: written query terms, MATERIAL
   causes, live policy candidates, current challenges (merged, capped), known unknowns, the
   instrument.
3. Give the citation graph a caller, with the coverage block's generated caveat attached.
4. Feed the carried frame to the contradiction pass **labelled as inherited**, and widen *Where
   the research changed my mind* to report it.
5. Stamp provenance and age on every carried item; never carry transitively.
6. Replace `FULL` rather than adding a mode; keep `REUSE`.
7. Reprice the allowance, or charge a cumulative build two thirds.

⚠ **Nothing above is built.** §4 is a report-and-propose section and this is the report.
