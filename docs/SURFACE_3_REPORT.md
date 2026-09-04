# SURFACE 3 — what a user sees now, per surface, in ordinary words

**Sprint:** SURFACE 3. **Written:** 2026-09-04. **Brief:** `docs/BRIEF_SURFACE_3.md`, plus
Charlie's §0a added mid-sprint.

Every figure below is a live query or a rendered document, and each says which. Where a figure in
the brief turned out to be wrong, it is corrected rather than restated.

---

## §0a — THE SOURCE-FAMILY COUNTS, VERIFIED. THREE CORRECTIONS, AND ONE FILE THAT DOES NOT EXIST

⚠⚠ **`SEARCH_TO_LEX_POSITION_SOURCES.md` IS NOT IN THIS REPOSITORY.** Not on disk, not tracked,
and not in the history of any ref — `git log --all --diff-filter=A -- '*SEARCH_TO_LEX*'` returns
nothing. The only file that mentions it is `BRIEF_SURFACE_3.md`, which lists it as required
reading. **It could not be marked superseded because there is nothing to mark**, and writing
"marked superseded" would have been the exact fault the instruction is about.

The substantive half was done instead, and it found more than expected.
**`docs/POSITION_SOURCE_FAMILIES.md` is now generated** by
`npm run report:position-sources -- --write` — every figure a live query, every row stating its
grain, regenerable rather than maintained.

### ⚠⚠ Correction 1 — the members-interests disagreement is not a contradiction. It is a grain error, and every number is correct

That is worse than a contradiction, because nothing looks wrong.

| grain — what ONE row is | where | n |
|---|---|---:|
| a published interest | `interests-api.parliament.uk` | 4,100 *(census reading of 2026-08-27 — the only non-live figure in the file, labelled as such)* |
| **a held document** | `corpus_sections` (`members-interests`) | **3,448** |
| **an edge** | `graph_edge` (`declared-interest`) | **1,505** |
| **a signal** | `position_signal_stored` | **1,723** |

**The 3,448 that circulates as "the interests we hold" is a count of documents in the SEARCH
CORPUS**, marked excluded-by-design for retrieval. It is not a position-graph figure at all. Lex
building against it would be building against the wrong number by a factor of two.

### ⚠⚠ Correction 2 — "more signals than edges" is not corruption. `graph_edge` is deduplicated to a PAIR; the signal layer is DATED

This is the finding that explains both remaining oddities, and it is exact:

| | edges | signals cover N distinct **pairs** | signals cover N distinct **(pair, date)** | signals |
|---|---:|---:|---:|---:|
| `declared_interest` | 1,505 | **1,505** | **1,723** | 1,723 |
| `witness_appearance` | 162,733 | **162,733** | **175,290** | 175,290 |

The pair counts equal the edge counts exactly, and the dated counts equal the signal counts
exactly. **A witness who appeared before one inquiry on three days is ONE edge and THREE signals.**
Neither number is wrong; quoting either as "how many we hold" without its grain is.

### ⚠ Correction 3 — for votes, the two families are not nested at all

A division CONTAINS many votes, so no "percentage surviving" is meaningful across the first two
rows. **The only lossy step is the last: 2,129,113 votes → 2,080,585 signals (97.7%).** The 48,528
missing are votes cast by members who do not resolve to a graph entity.

⚠ My own first generator printed *"5,645 → 2,080,585 (36,857% survives)"* for this family, and
*"107.7% survives"* for witnesses. Both were my arithmetic assuming nested descending grains. The
generator now computes a reconciliation per family instead of applying one formula to all of them.

---

## §1 — THE COVERAGE STATEMENT. BUILT, LIVE, AND IT CANNOT BE HARDCODED

**What a user saw before:** positions for the people we hold records on, and a computed count —
*"1 person has a record here"* — with nothing at all about the people or periods we do not hold.
**What a user sees now,** on the same screen, under a heading *"What this does not cover"*:

> Our record of recorded divisions of the House of Commons begins on 9 March 2016 and runs to 15
> July 2026 — anything before that date is absent from this answer, which is not the same as
> nobody having taken a position.
>
> What is shown above draws on signatures on Early Day Motions.
>
> We also hold votes in recorded divisions of the Commons and the Lords, interests declared in the
> register, appearances as a witness before a committee inquiry and donations recorded in the
> Electoral Commission register, and none of it bore on this question.
>
> We hold no data at all of these kinds, for anybody: seats held on select and public bill
> committees and amendments a member put their name to. Their absence here says nothing about
> whether they exist.
>
> The stance and the confidence are estimates. They have never been scored against a verified
> answer key — no such set exists yet — so read them as our reading of the record, not as a
> finding. The recorded acts themselves are facts: each one happened on the date shown, and each
> links to its source.

**Every date, every count and the answer-key sentence are queried on each call.** `lib/graph/
position-coverage.ts` follows `scripts/ingest/graph/coverage.ts`'s pattern rather than inventing a
second one, as the brief directs.

Three properties are worth naming because each was a decision:

- **The signal ladder is DERIVED from `POSITION_CONFIG.halfLifeYears`, never restated.** A signal
  type added to the config appears in the coverage statement with no edit. A hand-kept list could
  only be right by accident.
- **"No source data at all" is decided FIRST, and by the graph-wide count.** A caller claiming a
  type contributed cannot promote one that holds no rows — asserted, with the case constructed.
- ⚠ **The "our record starts late" test has no threshold in it.** A number like "warn if it begins
  within 25 years" would be a figure about the graph, written down, going stale. The test is
  self-referential: a record is late if it begins after the earliest date the graph holds
  *anywhere*. Commons divisions begin 26 years after our own EDM record does, and that is
  arithmetic on two queried dates.

**Where it appears:** the user's positions surface (`ClaimReview`, on the answered path AND the
empty one), the admin explorer (`/admin/positions`, as the full block, open by default), and all
three generated documents (§2).

### The check, and what it found

`npm run check:surface-3` — **41 passed, 0 failed, 0 not checked, 9 controls, 0 dead.**
Both controls the brief names by name fire: a build with the statement hardcoded, and a build that
omits a signal type with no data rather than naming it.

⚠⚠ **It found a real blind spot on its first run, and the fault is shared.** The natural way to
write the hardcoded-figure rule is one alternation ending in a word boundary:

```
/\b\d[\d,.]*\s*(rows|%|signals|…)\b/i
```

**That expression can never flag `46%`.** `%` is a non-word character and so is the space after it,
so the trailing `\b` has no boundary to sit on. The rule looked complete and was blind to the
commonest way of stating a figure about a corpus. Found by planting *"we hold 46% of divisions"*
and watching the control come back DEAD.

▶ **`scripts/ingest/graph/check-4a-coverage.ts` carries the same construction and the same blind
spot.** That file belongs to the graph stream, so it is reported here rather than edited. The fix
is to split the percentage into its own alternative.

---

## §2 — POSITIONS IN THE GENERATED DOCUMENT. ⚠⚠ THE BRIEF'S PREMISE WAS ALREADY OVERTURNED, AND THE REAL BLOCKER WAS SOMETHING ELSE ENTIRELY

### The premise

The brief says *"LEX 25-M's audit found `POSITIONS` is the one heading with no carrier"* and asks
for a carrier in the snapshot. **25-Z §A.1 had already corrected that** by rendering all three
documents: the heading reaches the evidence pack, the long report and the meeting pack. The carrier
was never missing — **the content was.**

⚠ **That is a better outcome than the brief expected: nothing owned by the Lex stream had to
change.** Verified by reading the seam rather than assuming it — `proposal-snapshot.ts` selects
`evidenceItem.findMany({ where: { ideaId, status: { not: 'REJECTED' } } })` with no version filter,
so a row written under `headingKey='POSITIONS'` is carried by the existing machinery.

### ⚠⚠ The real blocker: the positions surface had rendered nothing for anybody, on every idea, since it shipped

25-Z found `findClaimTarget` returning NO TARGET on Charlie's idea and called it "the idea→target
mapping, not the graph". **It is not idea-specific. Measured before touching anything: NO TARGET on
all twelve live ideas, and the title control found zero candidates on eight of eight.**

The cause: `findTargets` runs `title ILIKE '%' || $1 || '%'` with the **whole query as one
pattern**. Given a two-word phrase that works; given a user's 200-character problem statement it
can only match if that entire sentence appears verbatim inside a division title. It never does.

⚠⚠ **And the obvious fix is worse than the bug.** Splitting the statement into words was measured
on the same ideas:

| word | matched |
|---|---|
| `diversity` | *Biodiversity Beyond National Jurisdiction Bill* |
| `permanent` | *Shoemakers Museum shortlisted for Permanent Exhibition* |
| `equity` | *Proposed Energy Equity Commission Bill* |
| `appointed` | *Licensing Act 2003 (Second Appointed Day) Order* |

Every one is a confident, sourced, **wrong** attribution — a real member really did vote in that
division. Presenting one under a user's idea would collect judgements about our search while
telling them it was a judgement about the graph. A word-level fix would have quietly repealed
`findClaimTarget`'s own "returns NULL rather than a weak match" rule while appearing to fix a bug.

### What was built: phrase matching, with the match disclosed

`lib/graph/phrases.ts` — two-to-four-word phrases from the proposal's own text, never single words,
ranked and matched over the same two tables. No new retrieval, no model call, no new index.

⚠ **The ranking took four measured wrong answers to get right**, and each key is there because of
one:

| key | the wrong answer it fixes |
|---|---|
| **from the title** | *The United Kingdom Supreme Court* matched *Young farmers' organisations across the United Kingdom*. Nothing lexical can tell a central subject from a passing mention; the title can, because a human chose it. |
| **content words** | "public and private" (3 words, 1 of them a subject) beat "civil service", offering *PUBLIC AND PRIVATE HEALTHCARE PROVISION* under a civil service proposal. |
| **phrase length** | "publicly funded" lost a date tiebreak to "money campaign", offering *NARPO Love or Money Campaign* under a proposal about charities. |
| **date** | last, because where two matches are equally justified the current Parliament is the one a proposer is writing for. |

⚠ **And "united kingdom" is now a commonplace** — it names the whole jurisdiction. England,
Scotland, Wales and Northern Ireland deliberately are not: those distinguish.

⚠⚠ **Twice I capped the phrase list with the ranking rule, and twice it silently discarded the
matching phrase.** v1 took the longest 40 (four-word phrases fill the quota; two-word phrases never
reached the query). v2 capped per word-count band, and *Enhancing Civil Service Accountability* —
the very proposal this sprint exists to serve — still dropped "civil service" behind "delivering
accountability". **Both were a RANKING rule acting as a FILTER.** There is now no selection rule at
all: every phrase is tried, and only the ranking decides. That was affordable because the query was
restructured — the EDM arm was cross-joining every phrase against every sponsorship row before
comparing a single title.

**Result: 45 of 84 live ideas now find a target, from 0 of 84.**

### What the document now prints

Filed for **22 of Charlie's 47 ideas**, re-read from the database after each write.

**The long report** carries the whole thing — the acts, our reading, the match basis, the freeze
line, and the coverage statement in full. **The evidence pack and the meeting pack print title +
citation + `siftReason` only**, so the act rides in `siftReason` and the coverage substance rides
in the title. Measured by rendering all three through the real builders:

| | heading | a recorded act | coverage | method + date |
|---|---|---|---|---|
| long report | ✓ | ✓ | **in full** | ✓ |
| evidence pack | ✓ | ✓ | one line | ✓ |
| meeting pack | ✓ | ✓ | one line | ✓ |

### The three §2 requirements, and how each is met

- **The evidence travels with the claim.** `PositionForDocument.grounds` is a **non-empty tuple** —
  `[RecordedAct, ...RecordedAct[]]`. A claim with no grounds does not fail a check; **it does not
  compile.** `positionForDocument()` is the only constructor and returns `null` rather than an
  object when the grounds are empty. That is 25-Z §C's instruction taken literally: a type, not a
  review step.
- **Frozen at publication.** Two mechanisms, because they fail differently. `ProposalVersion.
  snapshot` stores the whole snapshot as JSON, so a published version cannot re-render against a
  changed graph. **And the decay date and config version are written into the prose**, which
  protects any paragraph someone copies out of it — a failure a stored blob cannot reach.
- **§1's statement carried into the document**, at least once, as its own row under the heading.

---

## §3 — COMPANIES HOUSE. BUILT, AND BLOCKED ONLY ON THE KEY

`scripts/graph/resolve-3d-companies-house.ts`. `--plan` needs no key and runs today:

```
donor-resolved rows        1,489
rows with a number we lack 14,879
political_donation signals 244

distinct normalised numbers          3,887
…that can yield a signal (donee ok)    640
rate limit  600 requests / 5 min · estimated elapsed 36.3 min for all of them
```

⚠ **`COMPANIES_HOUSE_API_KEY` is not set**, so nothing has been fetched. The script says so and
exits 3 rather than crashing. The key is HTTP Basic auth's **username with an empty password** — an
unusual shape that reads as a broken credential if you assume a bearer token.

### ⚠⚠ THE PREDICTION, RECORDED BEFORE THE RUN — AND THE BRIEF'S ~11× IS CORRECTED

The brief predicts *"roughly eleven times the current yield"* from 14,879 unresolved rows against
1,489 resolved. **That ratio is right about ROWS and wrong about SIGNALS**, because a
`political_donation` signal needs **both** ends resolved, and most of those 14,879 rows have no
resolvable recipient:

```
rows with a CH number we do not hold                  14,879
  …of which the DONEE also resolves to a member        1,682
distinct (donee, number, date) triples in those rows   1,659   ← the signal ceiling
distinct registration numbers needed to reach them       640   ← the API calls
political_donation signals today                         244
```

▶ **The prediction is 244 → at most 1,903 signals, about 7.8×, not 11×** — and that is a **ceiling**
assuming every one of the 640 numbers resolves. It is the per-source-hits-inflate-counts trap:
right for a list, wrong for a count.

⚠ **A hypothesis I tested and had to abandon:** the register publishes numbers both padded and
unpadded (`1430799` and `01430799` are the same company), so part of the 14,879 might have been a
normalisation failure needing no API call at all. **Measured: only 8 rows and 4 numbers recover
that way, and none of them has a resolved donee.** Normalisation still matters for the *lookup
count* — 4,458 raw strings are 3,887 real companies — but not for recovery.

**Safety:** the resolver contains no name comparison on any path, including any fallback, and
`check:surface-3-donations` §4c asserts that with a control. A number Companies House does not
recognise is written as `unresolved:number-not-at-companies-house` — **recorded and counted**, not
left indistinguishable from a number nobody has looked up.

---

## §4 — DONATIONS AS A GRADED SIGNAL. THE HARD LINE IS A TYPE, NOT A WORDING RULE

`lib/graph/donation-alignment.ts`, `/api/graph/donations`, `components/lex/DonationReview.tsx`,
and the `GraphDonationJudgement` table (applied to production and re-read: 20 columns, 5 CHECK
constraints, 4 indexes).

**The three tiers are implemented exactly as specified**, and multi-party is **absorbing**: a donor
who gave to one party for a decade plus once to another is still multi-party, because testing
volume before party count is how a multi-party donor would get promoted.

### ⚠⚠ How the hard line is enforced

§4 requires *"a party-level alignment can never support a claim about a specific proposal … enforced
in code rather than in wording."*

**A `PartyAlignment` has no `direction` field, no `stanceScore`, no `targetId` and no
`targetType`.** There is nothing on it a caller could hand to `aggregate()`, nothing to point at a
division, and nothing that composes into a stance on a proposal. `directionForTarget()` exists and
returns `{ direction: 0, refused: true, reason }` for every input, so a caller who goes looking
finds a refusal rather than a gap. **The wrong sentence cannot be constructed because the value it
needs does not exist.**

`npm run check:surface-3-donations` — **23 passed, 0 failed, 6 controls, 0 dead**, including the
constructed case the brief asks for and the banned implementation watched failing.

**The live case is the one the design exists for:** *Joseph Rowntree Reform Trust Limited — donated
£7,880,624 to 3 different parties (Liberal Democrats, Labour Party, Green Party)* → multi-party →
**"NO DIRECTION AT ALL … that tells us something about seeking access and nothing about belief."**

**The screen** shows the published record first in the largest type, the user's four-way judgement
second, and our reading last under the label *"Our reading — an inference, not a record"*, followed
by the never-about-a-proposal caveat in full. The one-click verdict is three-way — right · wrong ·
**not sure** — because "not sure" is what a careful person says about a thin record, and folding it
into "wrong" would make the agreement rate a measure of how decisive our users are.

**Nothing writes back.** No path from `GraphDonationJudgement` reaches `position_signal` or
`position_estimate`; asserted, with a control.

---

## WHAT IS **NOT** DONE, NAMED

1. **§3 has not been run.** No Companies House key exists. Everything is built and `--plan` is
   live; the pilot is one env var away.
2. **No positions producer runs inside a Lex build.** Filing is a separate route and script
   (`npm run positions:file`) because the build pipeline is Lex-owned and §5 forbids editing it.
   The one-line change is in decision 3 below.
3. **`NO_PRODUCER_NOTE.POSITIONS` is now misleading** and I did not edit it — it is Lex-owned. It
   says *"No pass writes findings under this heading yet"*, which stays literally true (no *pass*
   does) while positions now appear there. Decision 4.
4. **`DonationReview` has no route rendering it.** The component, the API and the storage are
   built and checked; nothing imports the component yet, because every candidate parent is
   Lex-owned. ⚠ Recorded honestly rather than counted as shipped — §23.1 is explicit that "it is
   written down" and "it is reached" are different claims.
5. **39 of 84 ideas still find no target**, including *Gender self-identification* and *Reinstating
   Biodegradable Plastic Straws*. Those are genuine coverage gaps — we hold no division or motion
   about plastic straws — and the surface now says so instead of rendering nothing.
6. **Match quality is variable and disclosed, not solved.** *"Civil Service pensions"* under a
   civil-service-accountability proposal is topically adjacent, not on the nose. Every match prints
   the phrase it matched on and warns when only two words matched.
7. **The estimates still have no answer key.** Design §8's gate has never been passed; the coverage
   statement now says so on every surface, live, and will stop saying so by itself when a
   `position_answer_key` table appears.

---

## DECISIONS FOR CHARLIE

**1 · How should donation verdicts aggregate?** *(§4 puts this to you explicitly.)*
- **(a) They never move an estimate; they raise a review flag only.** ← recommended.
  *Consequence:* the agreement rate stays a clean measurement. A partisan sample cannot tune the
  thing it is measuring. Costs nothing; you learn where we are wrong without the graph drifting.
- (b) A threshold of disagreements suppresses the alignment on screen.
  *Consequence:* protects against a visibly wrong claim, but a coordinated handful of users can
  suppress a true record, and the suppression is invisible in the numbers afterwards.
- (c) Verdicts feed a weight adjustment.
  *Consequence:* the graph learns — and every accuracy figure measured afterwards is circular.
  I would not do this before the §8 answer key exists.

**2 · Is a two-word phrase match good enough to show?**
- **(a) Keep the floor at two words, with the match disclosed.** ← recommended.
  *Consequence:* 45 of 84 ideas get a section; some matches are adjacent rather than exact, and
  every one says what it matched on so a user can tell us it is wrong. That judgement is the most
  useful thing the beta loop can collect about retrieval.
- (b) Raise the floor to three words. *Consequence:* precision rises sharply — three- and four-word
  matches were right in essentially every case measured — but only about 8 of 84 ideas get
  anything, and the feature is invisible again.

**3 · Should the Lex build file positions automatically?** The change is one line in `build.ts`:
`await filePositionsForIdea(ideaId)` after the evidence passes. It is Lex-owned, so it is reported
rather than made.
- **(a) Yes, at the end of a build.** ← recommended. *Consequence:* every rebuild refreshes the
  section; published versions are unaffected because a version stores its own snapshot.
- (b) No — keep it a deliberate act via `npm run positions:file`. *Consequence:* nothing appears
  unless someone runs it, and it will be forgotten.

**4 · What should `NO_PRODUCER_NOTE.POSITIONS` now say?** It is Lex-owned and one string.
- **(a) Rewrite it to say a producer now files the record, with the coverage window.** ←
  recommended. *Consequence:* the screen stops contradicting the document.
- (b) Remove `POSITIONS` from `HEADINGS_WITH_NO_PRODUCER` entirely. *Consequence:* honest, but the
  heading loses its stated-gap sentence on ideas where nothing matched — which is precisely where
  the sentence is most needed.

---

## ▶ WHAT CHARLIE MUST CLICK, AND THE SIGNAL THAT PROVES EACH PART IS LIVE

| # | what to do | the signal that proves it |
|---|---|---|
| 1 | Open any of your ideas → **Outputs → the long report**. Find *"Key people and groups likely to support or oppose"*. | A block headed *"<name> — recorded acts bearing on …"* with dated votes and links, then *"Our reading of those acts, which is an estimate and not a finding"*, then *"Computed on 2026-09-04 under method 3c.7bac2c10d652."* **If the method string is there, §2 is live.** Try *Human Rights Act 1998* or *Freedom of Speech in Universities* — both filed 5 positions. |
| 2 | In the same section, find *"What this section does not cover"*. | The sentence *"Our record of recorded divisions of the House of Commons begins on 9 March 2016"*. **That sentence has never existed anywhere before today.** |
| 3 | Open an idea → the background panel → the heading above → the **beta claim card**. | *"What this does not cover"* under the record, ending *"…never been scored against a verified answer key."* On an idea with no match you now get the same block instead of one bare apology. |
| 4 | `/admin/positions` → search a subject → run it. | A block *"What this answer could not see"*, **open by default**, listing `committee_membership` and `amendment_sponsorship` as NO SOURCE DATA AT ALL. |
| 5 | `npm run report:position-sources` | The §0a table. Nothing is stored; regenerate any time. |
| 6 | `npm run positions:file -- --all --dry-run` | Per-idea, what would be filed and why not, writing nothing. |
| 7 | `npx tsx scripts/graph/resolve-3d-companies-house.ts --plan` (from `scripts/graph`) | The §3 counts and the 36-minute estimate, with no key needed. |

**Checks:** `check:surface-3` 41/0 (9 controls, 0 dead) · `check:surface-3-donations` 23/0
(6 controls, 0 dead) · `tsc` clean · `check:client-boundary` clean (569 files, 134 client, 0
crossings) · `check-clean-build.sh --fast` PASS · `check:scripts` red **only** on another session's
untracked `_b17*.ts` globals.
