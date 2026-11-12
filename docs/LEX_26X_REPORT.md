# LEX 26-X — REPORT

## X3b — built 11 Nov 2026, committed 12 Nov (CCh-Lex 7 Nov (2): "X3: go, as split"; CCh-Lex 12 Nov (1): "finish X3b")

BRIEF_26X §6a.6 (decision 315) and the §7 renames (decision 300). This closes X3.

**Where the build was between sessions (CCh-Lex 12 Nov (1)).** It was built on Wednesday 11 Nov, not Saturday: the new files are stamped
09:39 and 10:02 UTC that day, and X3a was committed on Monday the 9th. It was all in the tree on 12 Nov, uncommitted: 25 modified files and
2 new ones, identical to what was left. The 11 Nov regression was not a code failure. Claude Code stopped it for low memory after four checks
(all green), and it was left stopped as the note asked. As CCh asked, the build was then committed to `wip/26x` before anything else ran (05ce99a; HEAD,
index and tree untouched, through a private index), and squashed onto Main when green.

**§6a.6 "Who delivers and who resists" (315)** — `components/lex/DeepeningWho.tsx`, section 6 of the Deepening.
- It opens whatever the lock says (recommendation 1). `DeepeningGate`'s children are now a render prop `(open) => …`: sections 1–5 and
  everything after mount only when open; section 6 always renders, and when locked it says "Open while the rest of the Deepening is
  locked: it reads the actions, not the drafts."
- At the top, the incentive count line (`incentiveChecklistLine`). Filters: Every action · Not yet specific · Against, and nothing changes it,
  each with its count.
- One row per live action. Its line shows: specific or not, "X of 7 answered", proposals by Lex waiting, and "▼ against, nothing changes it".
  Opening a row edits the seven slots in place (`ActionSlots`, through the shared `useOps` write route). The incentive map is below.
- **It left the action record.** `RECORD_SECTIONS` loses `who`. The band no longer shows Who, and the Organising page's step 2 no longer
  renders slots. The field guide, the controls file (the three slot controls now name section 6 on the Deepening) and Lex's prompt all say
  where it went.
- On 452c5ade: 58 live actions, 0 recorded as against with nothing changing it. The count equals a plain query (cold read, part F).

**§7 renames (300): "document" → "draft" wherever it means a draft on an action.** Uploaded files keep "Documents", for example the idea
page's inbound list. Tool names (`list_documents`, `review_document`, …) are unchanged; the prompt tells Lex the screen says drafts.

| where | count |
|---|---|
| `screen-labels.ts` | 4 labels renamed; 9 inline strings moved into a new `DRAFTS_UI` table |
| components (DocumentView, DocumentsTree, RisksView, DraftNeedsPanel, ActionRecordSections, ActionsBoard, IdeaDetailClient, CreateIdeaClient) | 26 strings |
| the record | 2: the section label and the band ("N drafts") |
| the Actions Pack | 5: section 14 is "Drafts"; the key; the list heading "DRAFTS"; "No draft is recorded…" (a pack printed earlier keeps "Documents") |
| field guide | 37 prose strings, plus 9 new entries for `DRAFTS_UI` |
| Lex's tool descriptions | 15 words in 10 descriptions |
| Lex's system prompt | 3 |

"Stage names per §2c" were already done in X1 (17 strings). "Draft D.38.1": no "Document D.x" label exists anywhere, so there was nothing to rename.

**Checks.**
- `check:lex-26x3b` 36/36, 3 controls, 0 dead, 0 not run. Three mutations each went red: the gate not rendering `children(false)`;
  `DeepeningWho` put behind `open &&` (11 red); "Needs no document" restored (2 red).
- Moved by X3b (each one marked `⚠ MOVED BY 26-X X3b`): 26s2 (step 2 has no slots), 26x ("who" is not a record section), 26v1b (9 sections; the
  record label "Drafts"), 26v ("DRAFTS", "14 Drafts", the find box "Find in the drafts"), 26w-b ("Review this draft"), 26w (the mapping table).
  Two of those were found red on 12 Nov and fixed: 26v's find box and 26v1b's record label. Both were renames the checks had not followed.
- Regression, one at a time, after the renames:
  - prompt-examples ✓ · 26w 66 · 26w-b 60 · 26x 110 (11 Nov)
  - 26v 66 · 26v2d 62 · 26v2b 47 · 26v2c 44 · 26u 67 · 26x2 75 · 26x3 62 · 26x3b 36 · 26v1b 81 · 26p 126 · 26s2 215 · 26t1 98 · 26t2 72 ·
    26s2-browser 33 (12 Nov)
  - ⚠ 26s2-structure: 106/107, red 2 runs of 3 on "Retire heading … unassigns exactly the actions it held". **Not X3b:** neither
    `action-structure.ts` nor the check is in this diff. Cause, read from the code: `deleteHeading` unassigns every action on the heading
    whatever its status, while the check (and the 18 Oct (9) record: "its LIVE actions lose the heading") counts only LIVE ones. `heads2` has no
    `orderBy`, so the check fails whenever the heading it happens to pick also holds a parked or ruled-out action. **For CCh:** should retiring
    a heading unassign its non-live actions too? Then the check is wrong. If not, `deleteHeading` should filter on LIVE.
- Clean build: a worktree of the WIP commit, `npm ci`, `prisma generate`, tsc. The result is in the CHANGE_LOG entry.

## X3a — built 7 Nov 2026 (CCh-Lex 7 Nov (2): "X3: go, as split. Your three recommendations stand")

§6a sections 1–5 and §6b. Section 6 ("Who delivers and who resists") and the §7 renames are X3b.

**One reader for "what a review reads"** — `lib/lex/accepted-drafts.ts` (`acceptedDrafts`) and its words in `accepted-drafts-pure.ts`. Per live
action: the accepted INSTRUMENT (never a companion), at the version the owner accepted, in full; a later unaccepted version is named, never
read. The digest, the policy test and the review runner all read through it. On 452c5ade today that is one draft: #207, D.207.2 (code
text) v1, 15,606 characters.

**§6a.2 the four-model digest over drafts (311).** Each action's block says first what to read ("its ACCEPTED DRAFT, D.207.2 (code text),
version 1 — given in full" / "the statement. No draft of this action is accepted yet"), and the draft follows in full. The models are told to
judge an action by what its draft provides. Over the 360k budget, one cut length applies to every Detail and every draft, and the cut is said
in the text and counted. Each model's answer stores what it read (`read`, `dataChars`), so the panel says "The models read 1 accepted draft
(#207 D.207.2 v1) and 57 statements", per action on request, and says when models asked at different times read different texts. The
WHOLE-SET digest moved from the Organising toolbar to the Deepening; heading digests stay in Organising (and read drafts too).

**§6b the policy test over drafts (CCh-Lex 7 Nov (2), 2).** It reads the whole accepted draft, never clipped. A draft over 4,000 characters is
a call of its own; the rest batch 25 a call, and a batch carries at most 40,000 characters of drafts (`policy-test-pure.ts`). Each verdict
stores what it read (`record.policyTestRead`, carried by `parseRecord`; no schema change), and the record says "tested against the draft
D.207.2, v1" / "tested against the statement". A verdict whose reading is out of date says "⚠ Out of date: a different draft is accepted
now". The Organising button counts "N untested · M out of date" and tests both. ⚠ A verdict from before X3 carries no mark: it was a test of
the statement, so it stays CURRENT until a draft is accepted (`testIsCurrent`). Without that rule the button would have re-tested all 41 old
verdicts on 452c5ade; the mutation run reproduced exactly that ("58: the 17 untested and 41 out of date").

**Prices, measured on a scratch copy of 452c5ade carrying its live documents (`scripts/measure-26x3.ts`):**

| run | read | pence | note |
|---|---|---|---|
| policy test, 20 statements | 9,110 chars, 1 call | 5.23 | 51 s |
| policy test, #207's Code alone | 16,230 chars, 1 call | 8.09 | 71 s |
| digest, whole set (58) | 194,758 chars: 1 draft + 57 statements | models 61.50 | grok-4.7 timed out at 265 s (as on 19 Oct): a floor |
| digest, "Accountability Code" (#207 alone) | 41,552 chars | models 30.39 | all four answered |

The prices are fitted as a fixed part per call plus a part per character (`price-fit-pure.ts`), because most of a call's cost is its own
output. A price per character alone would put an eight-statement heading at about 25p against a measured 45p (a control in the check holds
that). The whole set's two runs give a negative fixed part, so the whole-set price falls back to per character alone and is labelled a floor.
On 452c5ade today the buttons read about 82p for the whole set (195k characters) and about 12.6p for the policy test: 17 untested, 2 calls,
24k characters (#207 is among the untested, and its Code is a call of its own).

⚠ **The judge could not be measured on 7 Nov.** From this machine, `api.anthropic.com` fails TLS with `SELF_SIGNED_CERT_IN_CHAIN`, while
Google, OpenAI, xAI and OpenRouter connect (a bare GET to each; no proxy or extra CA is set). Something local is intercepting that one host. The
ledger shows the judge failing at 0p on both runs tonight; on 19 Oct it worked from here. I did NOT turn certificate checking off. The judge's
part of each digest price is therefore its 19 Oct measured cost for the same scope (SET 22.46p, HEADING 18.52p), said so in `DIGEST_RUNS`.
The judge reads the four answers and an index, not the drafts, so its cost should not move with them; it is still a different run's figure.
**For Charlie:** one whole-set digest on the live site would measure the judge over drafts. Separately, worth finding what on this machine
presents its own certificate for api.anthropic.com.

**§6a.3 review passes over every accepted draft.** The Deepening lists each accepted draft (accepted at its current version: the version the
passes read) with ●/◐/○ and "N of 5 passes have read it". "Review every accepted draft — about Np" asks first at the summed `reviewPlan`
price, runs one draft after another through the existing route (a pass that already read the version is not run again), and can stop after a
draft. A draft accepted earlier and edited since is listed as not reviewed here until the new version is accepted. The Risks view (already
grouped by document) moved into this section.

**§6a.4 coherence and gaps** — the gap check (still also on Organising's toolbar) and the conditions × actions table from the owner's links.
The digest's own table stays inside the digest.

**§6a.5 costs** (CCh-Lex 7 Nov (2), 3) — `cost-years-pure.ts`: years 1–5. A one-off line falls in year 1. A per-year line falls in each year of
its duration, a part year as that part of the figure, and all five years when no duration is given. A line with no recurrence sits under "Not
said", counted, never placed in a year. Lines with no figure, and one-number floors, are counted. Uprating uses the cost summary's own
deflator (`uprater`, extracted from `computeCostSummary` so the two cannot differ). "Cost–benefit analysis: not yet available" sits below.
452c5ade has no cost lines yet, so its section says so.

**§6a.1 collision** — the schedule and every draft's collision report, with counts by part (its own lines · depend on it · for review), the
staleness, and the actions that need a report and have none. On 452c5ade: the schedule (#203), no reports yet.

**Page order:** the five sections first, inside the lock; the law table, the documents tree, the update pass and the research passes kept
below them, nothing removed. On 452c5ade the page is still locked (57 to go), so Charlie sees it only by the owner's override.

**Checks:** `check:lex-26x3` 62/62, 5 controls, 0 dead, 1 not run (no whole-set digest exists on 452c5ade to cold-read). Five mutations each
went red: the draft not given to the models (3 red); an old verdict counted out of date (3); a one-off line put in "not said" (4); the
verdict not saying what it read (2); the set digest put back on Organising (1). `measure-26x3` 10 passed, 3 failed: two judges unreachable
(above), and one assertion of mine wrong for a heading that holds only #207 ("0 statements" is right there).

## X3 — sized 7 Nov 2026, before any build (CCh-Lex 7 Nov (1): "Then X3 as sized … Size first")

Read: BRIEF_26X §6–§7; `app/ideas/create/CreateIdeaClient.tsx` (the Deepening renders there, `lexStage === 'deepening'`),
`components/lex/DeepeningGate.tsx`, `lib/lex/development.ts`, `lib/lex/action-digest(-pure).ts`, `lib/lex/action-structure.ts`
`testAgainstPolicy`, `lib/lex/document-review.ts`, `lib/lex/gap-check.ts`, `CostLine` and `computeCostSummary`, `action-record.ts` slots,
`IncentiveMap.tsx`. Nothing built.

### What exists, and what each §6a section needs

| §6a / §6b / §7 | today | X3 work | size |
|---|---|---|---|
| page order | Gate → law table → "The documents" tree → Risks → update pass → research passes (`DeepeningPanel`) | the six §6a sections first, in order; law table, update pass and research passes kept below them (nothing removed) | S |
| 1 Collision | no section; collision reports are a kind in the tree; the schedule (#203) is a document | a section: the schedule plus every draft's collision report, with counts; "What depends on this" / "for review" as 267/269 (the reader exists) | M |
| 2 Four models over drafts | `actionBlock` sends statement, avenue, causes, the 7 slots, the policy verdict and the Action details. **No drafts.** SET and HEADING digests, both only in Organising. Price: SET 74.3p for 58 actions, n=1, a floor | per action, the accepted draft's current text where one exists, else the statement, and the digest says which it read; the SET digest moves here (heading digests stay); the 360k character budget re-planned (drafts are long: #207's Code is 15,606 characters); **price re-measured on scratch** | L |
| 3 Review passes | five passes, **one document at a time** (`reviewDocument`); Risks groups every issue by document | a runner over every accepted draft (skips passes that already read the version; asks first at the summed `reviewPlan` price); Risks grouped by draft | M |
| 4 Coherence and gaps | gap check only in Organising; conditions × actions twice (from the digest; and `ConditionsCoverageView` from the owner's links, step 1 only) | both shown here | S |
| 5 Costs | `computeCostSummary`: the whole idea by category, uprated. **No roll-up by heading or by year** | a table by heading × year, plus "cost–benefit analysis: not yet available" | M |
| 6 Who delivers and who resists | the 7 slots edited in the record's "Who, how and against" (kept there until X3); "By who" `IncentiveMap` is **unreachable** (its view is step 2's, and steps are gone); **no code counts** "N actions rely on an implementer whose incentive is against and nothing changes it" | the slots edited here per action; the map; the count (new, from the slots' `direction`); the record section and its band entry removed | M |
| 6b Policy test over drafts | `testAgainstPolicy` reads the title (120) and statement (600), batches of 25; verdict + reason stored; nothing says what it read | reads the accepted draft where one exists; the verdict says "tested against the draft, v2" / "against the statement" (`policyTestFrom` exists, unwritten); price re-measured | M |
| §7 Renames (300) | screen-labels: 4 ("Add a document", "Review this document", "Save the document", "Needs no document"); 7 hard-coded outside it (Deepening "The documents", the idea page's "Documents" tab ×3, the record band, the system prompt, the Actions Pack); field guide ~42; tool descriptions ~38; components ~70 (a regex count; Sources and uploads stay) | all moved into `screen-labels.ts` and renamed; the count reported exactly | M |

**Spend:** two real measurements on scratch copies (the digest over drafts, about £1 a run at today's rate and more with drafts; the
policy test over drafts, pence). n=2 each, under £5 in all. Everything else is fixtures.

### Three things for CCh to decide before X3 (my recommendation first)

1. **The slots would be locked away.** §6a puts "Who delivers and who resists" on the Deepening, and the Deepening is LOCKED until every
   live action is accepted or needs no draft (317). On 452c5ade that is most of 58 actions, so moving the slots there leaves them with no
   editor for as long as drafting takes. **Recommend: "Who delivers and who resists" opens whatever the lock says** (it reads the actions,
   not the drafts). The rest of the page stays locked. Alternative: keep the record section until the lock opens.
2. **How much of a draft the policy test reads.** Today it reads 600 characters of statement; a draft runs to 15,000. **Recommend: the whole
   accepted draft**, one action per call when the draft is long (batched as now when it is not), priced and measured. Clipping a draft to
   fit would test part of it and say it tested the draft.
3. **"By year" needs a horizon.** Cost lines carry `recurrence` (one-off / per year / unset) and `durationMonths`. **Recommend: years 1–5**,
   one-off in year 1, per year in each year for its duration (whole term when unset), and lines with no recurrence in a "not said" column,
   counted, never guessed.

**Proposed split:** **X3a**: §6a 1–5 and §6b (the page, collision, digest and policy test over drafts with both prices measured, the
review runner, gaps, costs). **X3b**: §6a 6 (who delivers) and §7 (renames). Each is a commit with its checks; X3b's renames touch
every label file, so they go last.

## 332 and housekeeping — 7 Nov 2026 (CCh-Lex 7 Nov (1): "325 and X2 accepted. 332: #207's instrument is Code text")

**The derivation, corrected** (`lib/lex/action-documents-pure.ts` `headingMakesCode`): an action under a heading of kind **code** or
**management code** needs a **code text**, whatever its avenue. Before 332 the heading's kind was read for platforms only, so #207
(legislative avenue, "Accountability Code" heading) was derived as a draft clause. The owner's "needs nothing" / "set" still wins.

**Every action the correction changes, measured** (all 1,019 live actions on 37 ideas, derived kinds before and after, diffed): 66
change, **60 of them on 11 deleted scratch copies** of 452c5ade. **On 452c5ade, 6:**

| action | heading | avenue | before | after | holds |
|---|---|---|---|---|---|
| #207 | Accountability Code (code) | legislative | draft clause + collision report | code text | code text (accepted), draft clause (now set aside) |
| #28 | CS Mgt Code (management code) | legislative | draft clause + collision report | code text | nothing |
| #36, #158, #174 | CS Mgt Code (management code) | organisational | operating text | code text | nothing |
| #208 | CS Mgt Code (management code) | none | nothing derived | code text | nothing |

⚠ **#28 is the one to look at:** a legislative action that loses its clause because of its heading. If it is really a clause, it belongs
under a primary-legislation heading, or "set" overrides it.

**On 452c5ade** (`scripts/apply-332.ts`, dry run first, every write read back):
- **D.207.1 set aside, kept:** status SUPERSEDED, superseded by D.207.2 (the Code). It had no version, only one Lex proposal, dismissed;
  its row stays readable. #207 now shows one Brief, the Code's.
- **Its useful content is offered on #59's Brief** (#59 "Governed by a statutory Accountability and Delivery Code" is the clause that
  makes the Code statutory): **D.59.1 BRIEF_PROPOSAL v1, waiting.** Built from D.207.1's stored fields word for word, with no model
  call. It carries the purpose (as "must do"); 18 "Must include" points (duty on whom, enforcement, commencement, extent, subsections
  (1)–(10), the precedent, the law it touches, the drafting note), each saying where it came from; the CMCHA 2007 s.1(3) caveat as
  "Must not"; and tone statutory. A coverage test (every clause line placed, only the "Illustrative, not settled" banner left out) runs
  before writing, and was shown failing on a stray line.
- **#207's split** was already written against the Code's Brief (D.207.2 BRIEF_PROPOSAL v1, 7 Nov). Confirmed, not written again.

**Housekeeping.**
- Ledger row 9900 is now labelled `purpose 'check'`, `purposeInferred true` (193), so 26s2 is green: 215/215. ⚠ That label is an
  inference: the row is a `lex.agent.turn` on the owner's account (24 Oct, 13.8p) on an idea since deleted.
- 26v1b's 360 px band check now waits for "≡ More" to appear (up to 5 s; a timeout is the failure) instead of 200 ms.

**Checks.** `check:lex-26x2` 75/75, 8 controls, 0 dead: a new part H (the rule, with a control holding the pre-332 rule) and 332's cold
read in G. The X2 assertion "#207 shows a Brief for BOTH instruments" is moved, with the reason written above it. **Shown failing:**
with the rule switched off, 4 red (H ×3 and G's #207). `check:lex-26s2` 215/215; `check:lex-26v1b` 81/81.

## X2 — built 7 Nov 2026 (CCh-Lex 5 Nov (1): "Then X2 as sized"; Charlie, 7 Nov: "continue with x2")

**Before it: 325** (`65f3b6c`, live) and CBA-1's held edits committed by this session (`c2805ed`, live). **313 measured first:** of 452c5ade's
58 live actions, **1 holds more than one instrument — #207** (an accepted code text and a drafted clause); it is also the only action
whose Action details read as an instrument (`instrumentLike`, 5 provisions).

**One decision asked, and Charlie's answer (7 Nov): a draft clause's Brief is READ IN PLACE.** 26-U keeps the drafting instruction (the
clause's Brief) and the clause in the same version row, and the law rows, the collision report and the schedule all read those rows.
So the clause's Brief = new Brief rows for the common fields + the existing instruction, read where it is. **No production row was
rewritten.** The "migration" (§8 item 6) is therefore an assertion that nothing moved: the clause versions are the same rows, text and
instruction before and after every Brief write and the clause drafter (check:lex-26x2 B), and on the real data the Brief reads each live
clause's own current instruction (G).

**Schema — no table, no column** (`prisma/lex_26x_brief.sql`, applied to Neon `ep-old-dust-aboxi69a` after `whichdb`, constraints read
back): `action_document_version.role` gains `BRIEF` (every save a version, its own series) and `BRIEF_PROPOSAL` (Lex's Brief beside, or
§5e's split); an answer may sit on either proposal role; `action_document.status` gains `BRIEFED` (a Brief, no draft yet — CCh call 2).
A draft row records the Brief version it was drafted from as `payload.briefV` (a used proposal keeps the version IT was drafted from).

**§5d the Brief** (`lib/lex/action-brief-pure.ts`, `action-brief.ts`, `components/lex/BriefSection.tsx`). Common fields — What this
draft must do (counter, no limit of its own) · Modelled on ([Ref: n], a corpus section, or none) · Tone and form (statutory · code ·
guidance · specification · plain rules) · Must include · Must not (numbered points, 60 × 6,000) — then the kind's own: code text issued
by · laid before · applies to · revision rule; specification users · records · measures; costing basis · price year; operating text and
background note the common fields only; a draft clause its instruction. Refusals name the field the person knows and its limit
("“Must include, point 1” is 6,001 characters; the limit is 6,000") — the route's generic wording named `brief.mustInclude.0` on the
first run, so the limits are worded by the Brief's own check. **"Ask Lex to write the Brief"** — a proposal beside the Brief, never
over it (Use it · Edit it, then save · Set it aside), **measured: 1.5p** (n=4 on scratch copies: 0.83, 2.83, 1.64, 0.85p; 5–16 s),
asked first. **The drafters read the Brief FIRST** (code text, specification, costing, operating text, background note, and the clause):
the block opens the prompt, names its version, says what to do with each field, and every draft's reason says "Drafted from the Brief,
version N" — or that no Brief was saved. "Modelled on" decides a code's model source.

**§5c the record**, top to bottom: statement → **The Brief** → **"Draft it"** (asks first at the kind's measured price; DISABLED with
"write the Brief first — or ask Lex to prefill it" while the Brief is empty; refused below the price) with **"Needs no draft, because…"**
beside it → **the Draft** with its **companions**, each saying "companion of D.n.m" (313) and "⚠ Brief changed since this draft" when it
has → Action details → Law → Who, how and against (until X3) → Costs → Order → Comments. The jump band follows. ⚠ This REVERSES X1's
"Drafts open above the statement" (§5a); the X1 assertion is moved with the reversal written above it. The draft's own kinds are drafted
with "Draft it" (the Drafts list points there); companions keep their own controls.

**§5f the strip** — Briefed is now real: ● when every kind of the draft has a saved Brief (a clause also once it has an instruction),
◐ when some do. A briefed-only document is not a draft: the kind stays "missing", the plan offers it, the pack does not print it.

**§5e #207 — PROPOSED, nothing moved.** `scripts/propose-26x-207-split.ts` splits by the text's own structure, never by paraphrase: the
heading and the three decisions under it → "What this draft must do"; items 1–15 → 15 "Must include" points, each with its lettered
parts (8a–8k, 12.a–12.i); the Issues, the open point and Part Two (A–H, marked "CHECK") stay as the Action details (8,210 of 17,946
characters). A LOSSLESS test runs before anything is written (every non-empty line kept, word for word) and is shown failing on a split
that drops item 8. Tone, "Modelled on" and the code's own fields are left for Charlie (Part Two B1/B2/A1 hold them and stay where they
are). "Accept the split" moves the text and writes a FieldRevision (`origin BRIEF_SPLIT`) with the old details; it is REFUSED if the
details changed since. **The sweep** (§5e's last line): 1 of 58 live actions has instrument-like Action details — #207.
⚠ **Found on the way (313): #207's need is derived as a DRAFT CLAUSE** (avenue + instruction), while the instrument it holds and Charlie
calls it is the Code. The Brief section therefore shows a Brief for every instrument an action HOLDS as well as the derived one, so #207
shows both. Which is #207's one instrument is Charlie's (his own H3: "Check the avenue of #207").

**Lex** — `read_brief` (what the Brief section reads) and `propose_brief` (the prefill's own writer: always a proposal), on the buttons'
path (26-W parity); `list_documents` carries each document's Brief version. Saving, using and setting aside are the owner's. Every new
label is in `screen-labels.ts` (BRIEF_UI, BRIEF_FIELD_WORD, TONE_WORD) with a guide entry each (typed; a missing one is a compile error).

**Checks** — `check:lex-26x2` (new): 67 ran, 67 passed, 7 controls, 0 dead, 0 not run. ⚠ Its first run passed "the clause versions
are untouched" over **zero rows**: `scratchCopy` copies no documents. Now it writes a clause version first (26-U's own `saveVersion`),
requires ≥1 row, and carries a control for the empty comparison; the cold read checks the real clause on 452c5ade. Regression: see
CHANGE_LOG.

**Only Charlie can confirm (§9):** #207 with its Brief above its Draft and "Draft it" between them; the proposed split; the strips.

## X1 — built 4 Nov 2026 (CCh-Lex 4 Nov (2): go on X1 with the three recommendations)

**The lifecycle bar (§2, 316).** `StageBar` shows the seven stages — Creation · Development · Private Scrutiny · Public Scrutiny ·
Promotion · Submission · In Force — each with one state line from the data (`lib/lex/stage-context.ts`): Creation "Lex’s first pass ·
N runs"; Development "Organising N actions · N drafted · N accepted"; Private / Public Scrutiny and Promotion "not yet open";
Submission "not submitted" (nothing records a submission yet — 2b's recording is not built); In Force "not yet available". The current
one: ● + "You are here" + a dark fill + a 2px border.

**§2c — strings changed: 17 on screen and in documents**, plus Lex's prompt. SEVEN_STAGES: 2 renamed (Creation, Development), 1 removed
(The Deepening, now inside Development), 1 added (Promotion, not yet available), Development's line rewritten; the workspace screens
(`LEX_STAGES`): 2 names, 2 purpose lines; the bar's "Stage N of 3" line removed (§3c); the review-status note (Stage 4/5 → 3/4); FAQ: 3
(the Stage-2 heading, "Stages 1, 2 and 3", a new paragraph on the checklist and Submission); "How this works" (1), the re-run banner (1),
the create page's intro (1). Decision 135 amended in `stageFromProgress`: a built idea is Stage 2 whether deepened or not. **Historic
documents:** their rendered files are stored in R2 and served until regenerated, so they keep the banner they were printed with — by
construction, not read back (check:lex-26x reports it NOT RUN). The "Stage 2/3/4" words for `Idea.stage` (the platform's
Create…Legislate ladder) are a different scheme and were not touched.

**The Development checklist and the lock (§3, 317).** Seven lines under the bar, each with its state in words and a shape (●/◐/○/🔒),
each a link: `section=problem|causes|policy` opens that kernel section, `view=organising|drafting` opens the Coherent Actions section on
that page, the Deepening's line opens the Deepening. The lock: `DeepeningGate` on the Deepening screen shows only the count and the
actions still to go (each a link to `/ideas/[id]/drafting#N`) and mounts nothing else; the pass route refuses with 423 in words, before
anything is claimed. **"Live" for the lock = live and not in Later phase** — a parked action is set aside for a later phase; the count
says how many are parked, so nothing is hidden. The owner's override ("Deepen now", a reason up to 600 characters with its counter) is
**appended** to `Idea.deepenOverride` (never replacing one), shown on the Deepening page, and printed in the stage banner of every
document generated while it is in force — "Deepened with N actions undrafted — reason: …". Once Drafting reads 0 to go the line is no
longer printed.

**Schema — one column, applied first, committed with the code that reads it.** `Idea.deepenOverride jsonb` (`prisma/lex_26x_deepen_override.sql`,
applied to Neon `ep-old-dust-aboxi69a` after `whichdb`). ⚠ **"Needs no draft" needs NO column, and I did not add one:** it already
exists as the "needs a document" override, mode `nothing`, with its reason, author and time (`LexCoherentAction.record.documentNeeds`,
`setNeeds`) — the tree's "Needs no document" writes it. A second store would be two answers to one question. The Drafting record's
"Needs no draft, because…" (300 characters, counter) writes the same op. **For CCh:** `entity_list_v5.md` is CCh-only and does not yet
list `Idea.deepenOverride`.

**Organising (§4, 308).** Step 1's tools, and only those: List · Board · Coverage grid · Conditions, grouping, headings (rename, kind,
hide, retire), Classify with Lex, Find duplicates, Re-sort, Consolidate, Test against the policy, Suggest headings, Import, the find box,
the bulk bar, Rule out, Later phase, Print all. Every row carries the progress strip. No drafting control ("Draft all legislative
actions" moved to Drafting). The step tabs and per-step toolbars are gone and `ActionsSteps.tsx` is deleted; `Idea.actionsStep` is kept,
untouched and no longer read — `proposeFacets` now defaults to step 1 rather than the stored step (an idea last left on step 2 would
otherwise have had Organising's "Classify with Lex" refused).

**Drafting and the flip (§5a–b, 318).** The same list by heading, counts at the top ("57 actions: 0 accepted · 0 need no draft · 57 to
go" on 452c5ade), filters with counts (all · to brief · to draft · to review · to accept · needs no draft · accepted), a strip on every
row. Opening a row opens the record with "← Back to Organising" at its top and the Drafts section open above the statement. From
Organising a title (or "Open") flips to Drafting with that action open; Back returns to the same scroll position, and the find box,
filters and grouping survive because the one workspace stays mounted. The page is in the URL (`view=`, `#N`); `/ideas/[id]/drafting#N`
and `/ideas/[id]/organising` redirect into it.

**The progress strip (§5f, 310) — moved into X1** (both pages show it). Derived from the documents tree in `lib/lex/action-progress-pure.ts`,
never stored: Defined (statement + heading + the heading's kind — CCh item 3) → Briefed → Drafted → Reviewed (all five passes on the
current version) → Accepted (at the current version; ◐ when accepted earlier and changed since). Companions (collision report,
explanatory note, schedule) are never the draft; a costing is the draft only of a financial action. ⚠ **Briefed, until X2:** the only
Brief that exists is a draft clause's drafting instruction, so other kinds read ○ there — said in the field guide's entry.

**CCh item 1:** "Who, how and against" stays a section of the record (with Costs and Order). **What left with the step tabs and has no
home until X3:** step 2's bulk "Classify with Lex" for the seven answers (per-action "Ask Lex" stays), the "By who" incentive map, and
step 4's "The order, derived" view and order classification (each record's Order section still sets it). The data is untouched.

**Lex.** The four-step rule in the prompt and the snapshot is replaced by the two pages, the strip and the lock; the seven stages and the
checklist are in the prompt from the label table; the controls list drops the four step labels and adds Organising, Drafting, Open,
← Back to Organising, Needs no draft because…, Deepen now. **Labels:** every new word is in `screen-labels.ts`, and the field guide has
an entry for each (seven new tables, typed so a label without an entry does not compile).

**Checks.** `check:lex-26x` (new) — see the closing line in CHANGE_LOG for the counts. Moved assertions, each with the reversal written
above it: 25k (2), 26h (9), 26p (1), 26s2 (part C and the step-2/3/4 renders), 26s2-structure (2, one of which read its words from a
comment), 26v1b (the record order and the closed-sections rule). ⚠ Pre-existing, not 26-X: 26s2's "the form's words … no cost,
because…" was red at HEAD since 26-W-b (fixed: it reads `RECORD_UI.noCostOpen` now); 26s2's "no ledger row since 29 Sep belongs to a
deleted idea and lacks a purpose" is a data finding, red before this sprint's code ran, reported and not touched. Also moved after the
addendum: 26s (the import label prints through `ORGANISING_TOOLBAR_UI`), 26s-browser (a record opens on Drafting — the check now clicks the
title and flips, as a user does; the heading box opens on press; Hide all is Organising's and absent on Drafting; the Drafts section
opens), verify-lex-26q-ui (the counted title button, Accept / Not this).

### Addendum 1 (321–323) — built into X1 (CCh-Lex 4 Nov (3))

**321 — the Organising toolbar is three labelled rows.** View (List · Board · Coverage grid · Conditions · Group · Hide all / Show all ·
the find box · Show) · Add (**Add action** and **Add heading**, both filled; the heading name box opens on press · Suggest headings ·
Import actions from a document, moved up from above the list) · Lex and checks (Title them with Lex · Accept all N proposed titles ·
Classify with Lex · Find duplicates · Re-sort · Test against the policy · Ask four models · Ask Lex to propose kinds · Check for gaps,
moved down from its own box · Print all). Import and Check for gaps are the real components, passed in as the toolbar's slots
(`inline`); Check for gaps' findings open as a full-width panel under the row only once there is something to show. Every label is in
`screen-labels.ts` (`ORGANISING_TOOLBAR_UI`, `ADD_ACTION_UI`; four words that were written in their components moved there too), and
the field guide says which row each control is on.

**322 — "Add action".** A focused dialog (§32): Title (required, counter) · Statement (optional, 1,000, counter) · Heading (the idea's
headings, default Unsorted) · the kind shown from the heading, not chosen. Route op `addAction` → `addActionAtHeading` → field-machine's
**`addAction`, the one writer** (the import, the gap check and Lex's `add_action` already called it). Source USER; the number is the
trigger's; it lands **first under its heading** (`place: 'topOfHeading'`: the rows at and after that position move down one, in one
transaction, so the rest of the list keeps its order); the page flips to Drafting with it open. Lex's `add_action` gained `title` and
`heading` (an existing heading's name — a name the idea does not have is refused, listing the real ones; it never creates one) and
places the same way. ⚠ **Two things decided, not in the brief:** (a) the title limit is the existing `LIMITS.actionTitle` = **110**,
not the addendum's 120 — one limit for every title box; say if it should be 120 everywhere. (b) "Defined ◐" for a new action needed
the strip's rule widened: ◐ is now *begun but not all three* (a statement, a title or a heading) — before, a statement alone read ○.
The record's empty Brief ("write the Brief, or ask Lex to prefill it") is X2's: the Brief does not exist yet.

**323 — no unexplained count.** "Title these for me (4)" → **"4 actions have no title · Title them with Lex — about 1.7p"** (the price
is the mean of the four `actions.titles` runs in the ledger, n=4; it asks only about untitled rows with no proposal waiting). Pressing
it applies a new **Untitled** filter, so the N are on screen. A waiting proposal shows on its row under the statement: "Lex proposes:
*…* — Accept · Not this". **"Accept all N proposed titles"** appears only while proposals wait. **A title the owner wrote is never
replaced:** `acceptTitleProposals` now skips a row that has a title (its stale proposal is cleared and counted, `keptYours`) — before,
accept-all overwrote it. "Test against the policy (N untested)" also applies its filter (Unreviewed).

**Found while running the checks, fixed:** an action opened on Drafting under a **hidden heading** was not drawn at all — so a deep
link, a flip, or a new "Add action" row under a hidden heading opened nothing (26v1b's two #202 failures: "Primary legislation" is
hidden on 452c5ade). An opened action is now drawn under a hidden heading; the rest stay hidden and counted ("Hidden — 2 more actions
not shown"). Asserted in check:lex-26x part D with a control.

**Checks for the addendum** (check:lex-26x parts F and F2): F on a scratch copy through the real route — refusals in words, USER,
title, heading, trigger number, first under its heading, everyone else's order kept, "Defined ◐"; Lex's `add_action` stores the same
(parity) and refuses an unknown heading; an owner's title survives accept-all, with a mutation control. F2 in Chromium on the 26-S
harness — the three rows in order with their controls, Check for gaps not on the Add row (control), the filled primaries, the heading
box on press, the counted title button and its filter, the proposal on its row, the stale one not offered, "Accept all" present only
while one waits (control), the Add action form, and the new row first under its heading and open on Drafting.

**Not done in X1:** the flip's scroll restore (§8 item 3) is asserted statically, not measured in a browser; the real-browser walk is
§9's (Charlie's screen).

## §0 Sizing and the split (4 Nov 2026, before any build)

Read: BRIEF_26X; `lib/lex/stages.ts`, `components/lex/StageBar.tsx`, `lib/documents/stage-banner.ts`,
`lib/lex/action-steps.ts`, `components/lex/ActionsSteps.tsx`, the `ActionDocument` / `ActionDocumentVersion` /
`DocumentReview` / `LexCoherentAction` models, `lib/lex/document-view.ts`. Nothing built.

### What already exists (so the parts are smaller or different than the brief assumes)

- **A seven-stage list already exists** — `SEVEN_STAGES` in `stage-banner.ts` (26-H), printed on documents: First Pass ·
  First Draft · Deepening · Private Scrutiny · Public Scrutiny · Submission · In Force. 316 renames it to Creation ·
  Development · Private Scrutiny · Public Scrutiny · **Promotion (new)** · Submission · In Force. The workspace bar
  (`LEX_STAGES`, 3 stages, "Stage N of 3") is a separate list; X1 makes the bar read the seven, so there is one list.
- **The 26-U instruction is not a separate store.** It is `ActionDocumentVersion.payload` on `DRAFT_CLAUSE` documents
  (`document-view.ts` `instructionOf`), and the law rows point at its versions via `source_detail "<action> v<n>"`.
- **Review state is derivable:** `DocumentReview(documentId, v, passKey)` gives "all five passes read the current version".
  Accepted is `ActionDocument.status/acceptedV`. So the strip's Drafted / Reviewed / Accepted need no new storage.

### Proposed split

**X1** — §2 lifecycle bar (seven stages, state lines; banner + FAQ text renamed, count reported; historic documents
untouched) · §3 Development checklist, lock, override · §4 Organising page (step tabs and per-step toolbars removed,
data untouched) · §5a–b Drafting page + the flip (`/ideas/[id]/drafting#38`, back to the same scroll and filters) ·
**§5f the progress strip moved into X1**, because §4b and §5a both render it.
- Schema in X1 (with the code that reads it, pushed as a pair): the **override** (reason, by, at — on `Idea`) and
  **"needs no draft, because…"** (reason ≤300, by, at — on `LexCoherentAction`), since the lock and the Drafting
  filters count it.
- Until X2, *Briefed* derives from "a DRAFT_CLAUSE instruction version exists, or needs no draft"; X2 switches it to the
  Brief. Said on the strip's guide entry, not hidden.

**X2** — §5c record order and "Draft it" between Brief and Draft · §5d the Brief (common + per-kind fields, Lex prefill
as a proposal, versions, "Brief changed since this draft") · the 26-U migration (count + text equal before/after) ·
§5e #207 split as a proposal, plus the `instrumentLike` sweep of 452c5ade · companions (313).

**X3** — §6 the Deepening page (collision, digest over drafts with re-measured price, passes, coherence, cost roll-up,
"Who delivers and who resists") · §6b policy test over drafts · §7 renames (300, the remaining "Document(s)" labels, the
guide), count reported.

### Three things for CCh to decide before X1 (my recommendation first)

1. **The step-2 slots would have no editor between X1 and X3.** §4c removes the step tabs in X1; §6a gives
   who/how/against its new home in X3. Costs and Order stay as record sections (308), but the seven step-2 slots are
   edited only from step 2's opened-record sections today. **Recommend: keep "Who, how and against" as a record section
   until X3 moves it**, then remove it from the band (§5c's last line) in X3 rather than X2.
2. **Where the Brief is stored.** §5d says `ActionDocument.brief`. A column cannot hold "every save is a version", and a
   Brief exists *before* any draft, when the action may have no `ActionDocument` row. **Recommend: Brief versions as
   `ActionDocumentVersion` rows with a new role `BRIEF`** (append-only, like VERSION/PROPOSAL; Lex's prefill a PROPOSAL
   beside it), on the action's instrument document, created at first Brief save with a new status `BRIEFED` (CHECK
   widened). The 26-U payloads then migrate as BRIEF v1..vn with text compared. Same "no second store", versions native.
3. **"Defined" needs a *kind*.** Statement and heading are on the action; "kind" I read as the heading's kind (§4a's
   "headings … kind"). Confirm, or name the field.

### Not checked yet (said, not skipped)

- How many 452c5ade actions hold more than one instrument (313 "one per action") — measured at the start of X2.
- The FAQ's stage text location and the banner-string count — measured in X1 and reported there.
