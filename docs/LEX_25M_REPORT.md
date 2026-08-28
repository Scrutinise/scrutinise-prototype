# LEX 25-M — The outputs, where the work is

**Run:** 2026-08-28, closing 12:01 UTC. **Thread:** LEX. **Brief:** `docs/BRIEF_25M.md`.
**Mode:** continuous (§0).

---

## The headline

**§1–§5 are built. Two of the brief's own premises turned out to be wrong about the data,
and both would have shipped as silent failures. And the sprint found a class of defect
nobody could have found by reading: 172 scripts — every check and every verify this codebase
relies on — had never been typechecked.**

⚠⚠ **§5b PASSES: the causes nest. This is the first causal chain any build has ever
produced.** One live build on the only buildable idea, resumed rather than re-claimed, 10
passes, **22.98p, 249s**. Baseline, measured before spending anything: **0 nested causes from
any build, in the whole database, ever** — the single nested row in production was created by
a user, by hand, on 14 August. After: **2 of 3 build-written causes sit beneath another.**

> A Civil Service culture that actively discourages individual accountability
> └─ Lack of clear performance metrics and effective mechanisms for managing performance
> └─ Legal advisors within government departments operate with perceived autonomy

The assertion is on `DiagnosisCause.parentCauseId` — the **value**, not the schema — which is
the whole point of §5b and of the new CLAUDE.md §23.3.

⚠⚠ **§4's premise is wrong and the correct implementation is the opposite of what it says.**
§4: *"The counter is over `LlmSpend`, which already carries the user and the cost."* Measured:

| | |
|---|---|
| `LlmSpend` rows | **2,702** |
| …with a `userId` | **2** |
| …with an `ideaId` | 5 |
| build-stream rows sampled with a `userId` | **0 of 306** |

`SpendAttribution` is an **optional** argument to the model-call helper and the build passes
have never passed it. **An allowance counted over `LlmSpend` would read zero for every user
and hand out unlimited free builds** — the exact failure the allowance exists to prevent,
shipped as a feature, invisible until a bill arrived. The counter is `IdeaBuild`: also not a
new source of truth, and the unit §4 states its own spend rule in. `check:lex-25m` asserts
the counter is **not** `LlmSpend`, so a future edit "restoring" the brief's wording fails.

⚠⚠ **§3's gap is not a missing field — the snapshot's evidence array came back EMPTY.** It
took `status: 'ACCEPTED'` only, for a good reason (§20.2: publishing a PROPOSED finding puts
a judgement nobody made into an artefact that leaves the building) — **and nothing has ever
been accepted.** So §2b's write-up would have contained none of the panel's material, and an
empty array renders as a document with no findings section rather than as an error. Resolved
the way this stack already resolves it for sources (`decision: null` — "the user has not
looked" is a real state, stated, never silently promoted): **carry the material, label it.**
Each finding says whose it is; a note at the top of the section says how many of them the
proposer has actually been through.

---

## §1 — Outputs, in the panel

An **Outputs** item now sits at the top of the resources contents, set apart, because it is a
different *kind* of item from the twelve questions below it — filed thirteenth among them it
would be exactly as hard to find as it is on the dashboard, which is the complaint.

It lists both documents, what each contains, **when each was last generated**, and whether
the file still matches the proposal as it stands. ⚠ **One generator, two doors** — it calls
`/api/ideas/[id]/document`, the same endpoint the Documents tab calls; `check:lex-25m` fails
if this component ever renders a document itself. ⚠ Staleness is a **sentence**, not a
colour: *"the proposal has changed since, so this file is out of date. Generate it again
before you send it."*

⚠ **The Evidence Pack is deliberately not listed.** It is a third kind the API knows about,
it is scaffolded rather than built, and a button that produces a stub is worse than no
button. It appears the day it produces a document.

**Found on the way, and fixed:** the contents list was gated on `!openHeading`, but the two
special items (`__unfiled`, added 25-L; `__outputs`, added here) set a key matching no
heading — so the whole contents list rendered **underneath** them.

## §2 — The two documents

**2a. The summary** is unchanged and already right: about two pages, and it points at the
full version.

**2b. The full write-up now carries every panel section**, in `HEADING_ORDER` — the panel's
order, imported and never restated, so the document cannot drift from the screen the proposer
worked on. The prognosis, what else refers to this law, what was tried before, how the courts
have read it, the strongest case against, key sources, the user's own material.

⚠ **An empty heading is skipped in the document, and that is deliberately NOT the panel's
rule.** On screen an empty heading is a stated gap, because the reader is judging whether the
search was any good. In a document going to a committee clerk, thirteen headings saying "we
looked and found nothing" would drown the five that found something — and the absences are
not lost: they are collected in *"What this proposal does not establish"*, immediately after.

The proposal PDF grew from **33,654 to 36,194 bytes** on the check's own fixture.

## §3 — The snapshot audit

`scripts/audit-25m-snapshot.ts`, reported in full:

| what | carried? |
|---|---|
| a heading on each evidence row | ✅ |
| `prioritySources` · `excludedSources` · `knownUnknowns` · `userKnowledge` · `issues` | ✅ |
| every panel heading has a carrier | ✅ **except `POSITIONS`** |

**One gap, and it is honest: `POSITIONS`.** No producer writes evidence under it — 25-L put
the beta review UI there instead, which is a live surface and not a snapshot field. A
document cannot contain it because there is nothing stored to contain. Stated, not papered
over.

⚠ **The renderers still read only the snapshot** — asserted for the two files this sprint
changed; `check:20bd` owns the general rule over its own list of five. My first version of
that assertion listed `build-initial-background.ts` as a renderer and failed on correct code:
it is an *assembler* for a different document and reads the database by design.

## §4 — The pilot allowance

- **One free build plus one re-run** (4 thirds). A full build costs 3, a reuse re-run 1.
  ⚠ **An integer, not a float** — this number decides whether somebody may press a button,
  and "0.30000000000000004 of a build left" is not a state anybody should reason about.
- ⚠⚠ **A failed build does not spend it, and the tie-break is enforced structurally.** The
  test is an **allow-list** — only `DONE` spends — so `FAILED`, `CANCELLED`, `QUEUED`,
  `RUNNING` **and any status added next year** all fall to "not spent" by construction. A
  deny-list would silently start charging for the next status somebody adds; the check's
  negative control is exactly that deny-list, run against `SOME_FUTURE_STATUS`.
- **The balance shows before a build starts**, beside the cost and duration line, in the
  re-run dialogue. Not after, and not only when it runs out.
- ⚠ **The hard stop is at the write path**, in `claimBuild`, not only where the UI reads it.
  A ceiling enforced where the button greys out is one the worker, a script or a repeated
  POST walks straight through. It answers **402**, not 500 — the product working, not
  failing — carrying the message and the address to ask for more.
- **Admin can grant** at `/api/admin/allowance`. ⚠ It **sets, never increments** (a
  double-clicked "add 3" gives 6; "set to 7" twice gives 7), **requires a note**, and writes
  an `ActivityLog` row against the user whose allowance changed with the admin in
  `accessedByUserId` — the privacy-log pattern already in use.
- **`IdeaBuild.mode` is now recorded.** 25-G had mode as a request parameter and never stored
  it; the allowance charges the two differently, so "what were you charged for this build"
  has to be answerable from the row. ⚠ It stores **what ran, not what was asked for** —
  `claimBuild` downgrades a REUSE request to FULL when there is nothing to reuse, and writing
  the request would charge a third for a build that did the whole job.

## §5 — Loose ends

**5a. The backfill ran.** Counts, re-read from the database rather than reported from intent:

| | |
|---|---|
| → `HOW_HARD` | **5** (how hard this will be to pass · the barriers · how likely to succeed · what is most likely to go wrong · what I would cut) |
| → `KEY_SOURCES` | **1** (what to read first) |
| still under `AGAINST` | **0** |

⚠ Four SMART rows keep a null heading and were deliberately left: they are `CONTRADICTS`
rows — the critique's rewrites — not prognosis. Mapping `SMART → HOW_HARD` wholesale would
have misfiled them, which is the same mistake this backfill just corrected, in the other
direction.

**5b.** Above. **5c.** Both rules are in CLAUDE.md — **§23.3** (where a populated value
matters, the check tests the value) and **§24.1** (when two passes write the same records and
the second replaces the first, the second must be told everything the first was told).

---

## The finding that was not in the brief

⚠⚠ **`scripts/**` is excluded from the web TypeScript program, so no check or verify script
has ever been typechecked. 172 files. `tsc --noEmit --listFiles | grep -c scripts/` = 0.**

The exclusion is *correct* — CLAUDE.md §20 check 0 forbids any file outside `scrutinise-web`
from entering the web program, and several scripts import from `../../scripts/ingest`, which
would drag `@lancedb/lancedb` into a serverless bundle. But its side effect is that every
guard this codebase relies on has been unchecked.

**How it surfaced:** my §5b harness called `runBuildToCompletion(ideaId, userId)` — a
three-argument function. It reached a **live run**, claimed a build row, and died in its
first pass on a Prisma validation error. `tsc` would have caught it in a second. ⚠ And **the
harness reported exit 0 over that crash**, because `main().finally(…)` leaves a thrown error
as an unhandled rejection — the silent-success class, in the one kind of file whose whole job
is to be believed.

**Fixed:** `scripts/tsconfig.json`, a separate program (the boundary is untouched), run as
`npm run check:scripts`. Its first run found **four real defects nobody could have seen**:

1. `measure-25i-build.ts` printed `source.reason` — a property `reuseSourceFor` has never
   returned. `undefined` in every run since 25-I.
2. `verify-lex-25g-ui.tsx` and `verify-build-25a-ui.tsx` fixtures were missing `userCritique`,
   added to `BuildView` in 25-L.
3. `verify-stages-ui.tsx` imported `StageContext` from `stages.ts` — 25-L moved it to
   `stage-context.ts`. It kept passing because `tsx` erases a type-only import.
4. `verify-build-25a-ui.tsx`'s `{ ...base, ...over }` over a `Partial<BuildView>` widened its
   own return type enough to hide **three fields missing since 25-F** (`highlights`,
   `modelsByPass`, `queries`).

⚠⚠ **And applying §23.2 immediately found a second harness that had never run.**
`verify:build-25a-ui` died on `ReferenceError: React is not defined` — the identical one-line
fault as `verify-lex-25e-ui` in 25-L. It now runs **43/43**, and doing so exposed a **stale
assertion**: it required the build summary to appear in the progress panel, which 25-G §4a
deliberately removed after finding the same 537 characters rendered twice, byte-identical,
inches apart. Inverted to assert what 25-G established.

---

## Verification

✅ `check:lex-25m` **11 passed, 0 failed, 0 without a negative control**. ⚠ Two of its
assertions failed on first run, both check artefacts: one fired on `allowance.ts`'s own
comment explaining why it does *not* count `LlmSpend` (the "guard that fires on its own
prose" shape), the other listed an assembler as a renderer.

✅ **Every check in the suite, run and reported (§23.2)** — not a selection:

| | | | | |
|---|---|---|---|---|
| `lex-25c` 32 | `lex-25g` 27 | `lex-25k` 18 | `20bd` 47 | `build-25a` 40 |
| `lex-25d` 77 | `lex-25h` 20 | `lex-25l` 19 | `statutory` 17 | `build-25b` 54 |
| `lex-25e` 28 | `lex-25i` 14 | **`lex-25m` 11** | `deepening` pass | `never-claim` pass |
| `lex-25f` 62 | `lex-25j` 12 | **`scripts` clean** | `panel-claims` pass | `documents` pass |

✅ **Every render harness, executed:** `stages-ui` 23 · `lex-25e-ui` 16 · `lex-25g-ui` 14 ·
`my-ideas-ui` 15 · **`build-25a-ui` 43** (first run ever) · **`outputs-ui` 7** (new).

✅ `tsc --noEmit` clean (web) · **`check:scripts` clean (172 scripts, first time)** ·
`next build` clean · `check-clean-build.sh --fast` clean · `prisma validate` clean.

**Database:** `prisma/lex_25m.sql` applied to Neon `ep-old-dust-aboxi69a`, host checked with
`whichdb.ts` first (§16). Additive: two columns on `User`, one on `IdeaBuild`. Plus
`lex_25l_backfill_prognosis.sql`, run, counts above.

**Spend:** one build, **22.98p**. §5b's ceiling was one and one was run — the crashed first
attempt was *resumed*, not re-claimed, so the authorised ceiling was not exceeded.

---

## ⚠ What only Charlie's browser can confirm

§0 asks for this plainly, so: **everything in §1, §2 and §4's user-facing half is behind
sign-in, and a route probe proves nothing** — Clerk answers 307 for the subject and the
control alike, which is a known non-check here. Verified by render harness and source
assertion only:

- **The Outputs item opening, generating and downloading.** The harness renders the pre-load
  state and asserts the source; the loaded state, the generate round-trip and the two
  download links need a signed-in browser.
- **The balance appearing in the re-run dialogue**, and the 402 message when it is spent.
  ⚠ Your own account has already spent 3 of its 4 thirds on today's build, so **you will see
  "enough left for a redraft, but not for a full search"** — that is the feature working, and
  the admin grant is how you clear it.
- **The full write-up's new sections in a real PDF.** The check renders a fixture; a document
  built from your own idea is the thing worth reading.
- **The three-column desktop layout**, as every sprint since 25-K has said.

⚠⚠ **A CORRECTION, MEASURED AFTER THE FIRST VERSION SHIPPED.** I wrote that Charlie's
allowance would read "4 thirds, 3 spent, enough for a redraft". That was **derived from the
default and today's build, not measured**, and measuring it found something worse: the counter
charged **every DONE build ever**, so the real reading was **granted 4 · spent 9 · remaining 0
— fully blocked.** Three builds made over the previous fortnight, when no allowance existed
and nobody could have known one was coming, locked the only account with any history out of
the product on the feature's first day. Fixed with `ALLOWANCE_EPOCH`: only builds created
since the allowance shipped are charged. Re-measured: **granted 4 · spent 0 · remaining 4 —
one full build available.** No data migration; the cut-off is applied on read.
`check:lex-25m` now guards it, with a control that removes the cut-off.

## Two things for you

1. **Your allowance reads 4 thirds with 0 spent — one full build available** (measured, not
   derived; see the correction above). Every account gets the same default. For more,
   `PATCH /api/admin/allowance` with `{ userId, thirds, note }`.
2. **`LlmSpend` records almost no attribution.** The allowance does not need it, but the
   *cost* reporting does, and today `estCostPence` on a build row is the only per-build
   figure that works. Wiring `SpendAttribution` through the build passes is small and would
   make per-user cost real. Not done here — it is not in the brief and it is not free.
