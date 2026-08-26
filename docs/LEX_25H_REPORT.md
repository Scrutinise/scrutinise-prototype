# Sprint 25-H — one flow, the user's own words, and pilot-ready

**2026-08-26 00:14 UTC**

Brief: `docs/BRIEF_25H.md`, plus Charlie's amendment of 25 Aug (§8's premise, §1's cause,
the leftover copy, the harness, and the pausing rule).

---

## The short version

§1–§7 are built. Twenty new checks, eighteen with negative controls, every control watched
rejecting a corrupted copy. `tsc --noEmit` clean, `next build` clean, all 339 checks across
the eight sprint suites green.

Three things in this report are corrections to things I previously told you, not features:

1. **The three 25-G verification copies were never deleted.** I reported them gone. They
   were still in the database this evening. They are gone now, verified individually.
2. **Deleting them took the only post-25-F build with them**, so §7e's output-side
   measurement cannot be made this sprint. Details in §7e below.
3. **§1's stated cause was wrong and you were right about the real one** — the fields were
   written, once. What I built is the refresh path, not a write path.

---

## §1 — One flow: the new page one replaces the old

**The amendment corrected my diagnosis, and the correction changed the build.**
`confirmElicitation` *did* write those fields. The defect was that it wrote them **once**,
at first confirm, and nothing ever wrote them again — so §3's pill-edit, the very feature
this sprint adds, would leave page one showing an answer the user had since replaced.

A write path passes "the fields get filled". Only a refresh path passes "they change when
the answer changes". So:

- `lib/lex/page-one.ts` — `projectElicitationOntoPageOne(ideaId)`, called from
  `lib/lex/state.ts` on **every canonical-state read**. The four page-one answers
  (`yourAccount`, `yourGoal`, `yourKnowledge`, `yourReading`) are now **derived** — projected
  from the elicitation each time it is read, never copied.
- The one-time copy block inside `confirmElicitation` is gone. Two writers for one field is
  how they come to disagree.

The check for this does not assert "something writes them". It runs the projection twice —
once on an elicitation, once on the same elicitation with one answer edited — and requires
the projected value to have changed, to be **verbatim**, and for the *untouched* answers not
to have churned. `--self-test` runs that same assertion against a write-once stub (a
projection that memoises its first result — precisely the defect) and requires it to fail.

**Migration.** `scripts/migrate-page-one.ts`. First run: 11 examined, 10 migrated, 1 skipped
(the skipped one has an elicitation, so it gets a better page one from the projection than
the retired blob ever held). Re-run this evening: **11 examined, 0 migrated, 11 skipped** —
idempotent, which is the property that matters for a migration you may have to run twice.

---

## §2 — "Your account" vs "The idea": the provenance rule

- The four account fields are `derived: true`. **They cannot be written.** The guard
  (`assertWriteable`) is in `lib/lex/field-machine.ts` — the state machine, not the panel —
  and is called from all four writers (`submitBox`, `acceptField`, `reopenField`,
  `skipField`). It **throws** (`DerivedFieldNotWriteable`); a silent refusal leaves the
  caller believing the write landed.
- `ideaNarrative` — "The idea, as agreed" — is **not** derived. It is seeded once as a
  **proposal** (`AWAITING_CONFIRMATION`), and the seed is gated on the field being untouched,
  so an edit is never overwritten by a later projection.

The user's own words stay the user's. The agreed statement is something they agree to.

---

## §3 — The pills reopen what they name

Every pill on the build rail now opens **its own** answer, populated with what the user
wrote. A pill that opens an empty box is the same complaint one step along, so the check
asserts `setText(s?.answer ?? '')` specifically.

`ElicitationClosed` was **narrowed, not removed**: a CONFIRMED elicitation refuses an
ordinary answer POST (a stale tab) but accepts an explicit `editing: true`.

An edit sets `staleUnderstanding`, and the banner says **both** consequences together — the
reading is out of date **and** the next build will search the corpus again rather than
reusing, so it will cost more. They are one event; the user should not have to join them up.

---

## §4 — Documents and sources: the silent failure

The pipeline existed. The **new door had never been connected to it** — that was the whole
defect. `YourMaterial` is now on the build surface, on the reading step and again after the
elicitation confirms.

And the three states a document can be in are now **named apart** in the projected
`yourReading`, because "we have a filename" is not "we read it":

- findings were taken from it,
- it was read and nothing in it bore on this proposal,
- it could not be read.

An old-shape record that only ever held a filename now says **"NAMED but never uploaded, so
nothing was read from it"** rather than rendering as though we had read it.

---

## §5 — Progressive disclosure

A collapsed panel is a slim **labelled edge** — present, not absent — with a hint saying what
it is waiting for, so "empty" and "not yet" are different things on screen.

The state is `boolean | null`, and `null` is the point: it means *nobody has said*, so the
panel follows content and opens by itself once it has something in it. A boolean would freeze
the first render's answer — a user arriving before the build finished would keep an
empty-looking panel shut for ever. The moment the user touches a toggle, their answer wins.

---

## §6 — What the research found that you didn't mention

The box exists, leads the panel, and separates the unverified terms under an explicit
`Unverified —` label. It previously sat **fifth**, under a heading about vocabulary, which is
where it read as a footnote; the check asserts its position relative to the findings list, not
just its existence.

---

## §7 — The six smaller defects

**a — the map view.** It was not broken. `CauseTreeView` draws from `parentCauseId`, and the
build never set one: every cause was a root, the tree had no edges, and the map rendered a
flat list identical to the list view. *A view that silently looks like another view is
indistinguishable from a view that failed.* The build now emits `drivenBy` and nests
(`nestByDrivenBy`). When there genuinely is no chain — a real answer — the map **says so**
instead of impersonating the list. A cause whose parent cannot be resolved **survives as a
root** and the loss is counted; a cycle is broken rather than recursed.

**b — the title** follows the user's goal, not the loudest term in the retrieved sources.

**c — the causes** include the incentive-and-culture reading *as a cause among causes*,
explicitly not a replacement for the structural ones.

**d — a queued field** now names the field holding it up and what releases it ("save or skip
that and this opens"). It said "next up", which is a position, not a condition — and a user
who has to guess the rule will guess wrong and conclude the feature is broken.

**e — §25.7's six qualities.** *See the honest version below; this one is only half-answered.*

**f — the 25-F/25-G output is not disturbed**: the cuts-against-the-draft ranking, the
unverified labelling, and the smart pass's cuts are all still in place and checked.

### §7e, honestly

**Input side: verified.** All six instructions are present and reach every drafting pass
(`ANSWER_QUALITY`, six call sites). Checked, with a negative control.

**Output side: not measurable this sprint, and here is why.** The only build left in the
database is from **24 Aug 01:25, seven passes** — i.e. before 25-F added SMART, KERNEL_CHECK
and LOGIC_CHECK. Every post-25-F build sat on one of the verification copies you asked me to
delete, and went with them when I deleted them tonight. On that surviving pre-25-F build:

| quality | present | evidence |
|---|---|---|
| 1 causal chain, not an inventory | ✗ | 0 of 4 causes nested |
| 2 a counterintuitive finding | ✓ | 2 CONTRADICTS |
| 3 the finding, not the citation | ✓ | 68 of 70 substantive, 66 cited |
| 4 reframes the instrument if wrong | ✓ | — |
| 5 a test the user can apply | ✗ | — |
| 6 the next action | ✗ | — |

Quality 1 failing at 0-of-4 is exactly the flat-causes defect §7a fixed, which is consistent
with the diagnosis but **proves nothing about the fix** — it is a measurement of the code as
it was before the fix existed. Closing this needs one live build on a real idea after this
sprint deploys. That is spend, and spend is a stop, so it is the first item in the handoff
rather than something I took on my own authority.

---

## The amendment's four other items

**§8's walk — walk blocked: no host permission.** The extension has no host permission for
the site and no Clerk session on production, so a signed-in browser walk cannot be performed
from a Claude Code session at all. Recorded and continued, per the amendment. §8's acceptance
therefore rests on the checks, the build, and your own walk.

**Leftover copy 48388e8b — deleted.** "Enhancing Civil Service Accountability and
Performance", created 25 Aug 01:22, two builds attached. Deleted and verified gone.

**The harness — fixed.** `scripts/verify-lex-25f-live.ts` now leaves the copy IN_PROGRESS and
calls `confirmElicitation(copy.id, creatorId)`. It used to write `status: 'CONFIRMED'`
straight onto the column, bypassing the only code that writes the page-one fields. That is
what made 48388e8b's page one empty, and what you then reported as a product defect. Your
sentence is now a comment at the call site: *a verification artefact that isn't a faithful
copy produces findings about itself.*

**The pausing rule — adopted.** A contradicted premise is a line in this report, not a stop.
Three of them are (§1's cause, §7e's measurability, the undeleted copies). Only spend and
scope stopped anything, and neither came up.

---

## The correction I owe you

**I told you the three 25-G verification copies were deleted. They were not.** All three —
`22406bd8` ("[25-F verification] rebuild of 452c5ade"), `ce77b998` and `263ae5ae` (both
"Strengthening Civil Service Accountability and Performance") — were still in the database
when I looked this evening, five days later. They are gone now, each one re-read after
deletion to confirm.

The reason it matters beyond the tidying: you have been walking the product against a
database you believed contained only real ideas. Two of those three carried the *real* title,
not a `[25-F verification]` prefix, so they were indistinguishable from your own work on any
list. If anything you saw between 21 and 26 Aug looked like an idea you did not remember
creating, that is where it came from.

I have not established why the deletion did not take. The honest position is that I reported
it without re-reading, which is the same failure as the harness one — asserting a state
instead of checking it.

---

## The pilot question: what still needs explaining

§8 asks whether a stranger can complete an idea end to end without being told how. Without
the walk I cannot answer it by observation, but three things are visible in the code and I
would expect a stranger to stumble on each:

1. **Nothing says the build costs money or takes minutes** until it is running. A user who
   does not know a ten-pass build is about to start may leave the page.
2. **The reuse choice** (reuse the research vs search again) is offered without saying what
   the research *was*, so the choice is between two words rather than two things.
3. **`ideaNarrative` arrives as a proposal to agree to**, but nothing on screen explains that
   this one field behaves differently from the four above it — which is exactly the
   distinction §2 exists to make.

None of these is in 25-H's scope. They are the three I would put in front of a pilot brief.

---

## Verification

| gate | result |
|---|---|
| `check:lex-25h` | 20 passed, 0 failed, 18 with negative controls (all rejecting) |
| `check:build-25a` | 40/40 |
| `check:build-25b` | 54 passed |
| `check:lex-25c` | 32 passed |
| `check:lex-25d` | 77 passed |
| `check:lex-25e` | 27 passed |
| `check:lex-25f` | 62 passed |
| `check:lex-25g` | 27 passed |
| `tsc --noEmit` | clean |
| `next build` | clean |
| `check-clean-build.sh --fast` | PASS (boundary only) |
| migration idempotency | 11 examined, 0 migrated, 11 skipped on re-run |
| signed-in browser walk | **walk blocked: no host permission** |

One check failed on its first run, and the defect was in the check: §7f looked for
`kind === 'CONTRADICTS'` in `build.ts`, which *writes* `kind: 'CONTRADICTS'` and never
compares it — the comparison lives in the ranking, one file over. A guard aimed at the wrong
file fails loudly today and then passes for ever once someone "fixes" it by relaxing it. It
now points at the three files that actually carry §7f's three surfaces.
