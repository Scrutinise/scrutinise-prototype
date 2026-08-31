# LEX 25-N — what the first real walk found, answered

**Executed:** `docs/BRIEF_25N.md`. **Run mode:** continuous, per §0.
**Built:** §1, §2, §3, §4, §5, §11. **Designed and reported, not built:** §6, §7, §8.
**Reported, deliberately not built:** §9, §10.

---

## 0. The headline

> **The build that "stopped before it finished the passes, with no re-start" did not
> malfunction — it hit its ceiling correctly, and then four separate things conspired to make
> that invisible and irreversible. And `resumable` was already in the API payload, rendered by
> nothing at all.**

And the second one:

> **"Panels resize themselves and cannot be restored" is one CSS token.** A grid track written
> `Nfr` is `minmax(auto, Nfr)`. Its automatic minimum means a long citation or an unbreakable
> legislation.gov.uk URL — exactly what appears when you click an item in the research panel —
> **widens that column past the fraction the user set, and takes the difference out of the other
> two.** Nothing in our code moved. The stored layout was never touched. Which is why there was
> no control that put it back: from the layout's point of view nothing had happened.

---

## §1 — Broken behaviour

### 1a. The stopped build — diagnosed from the row

**Build v7 of idea `452c5ade-3153-400a-bf48-3b71aaa52773`, 30 Aug 2026 11:14:42 → 11:30:05 UTC:**

| field | value |
|---|---|
| `status` | `FAILED` |
| `passesComplete` | **8 of 10** |
| DONE | ORIENT, DIAGNOSIS, APPROACH, ACTIONS, RESEARCH, REVISE, SMART, KERNEL_CHECK |
| NOT_REACHED | **LOGIC_CHECK, ADVERSARIAL** |
| `failureReason` | "The build ran out of time after 922 seconds and stopped." |
| `summaryMessage` | **NULL — the settle did not write it** |

**Which pass:** it stopped *between* KERNEL_CHECK and LOGIC_CHECK. **What error:** none. It hit
`HARD_STOP_MS` (900,000 ms), checked between passes, at 922 s. That is the ceiling doing its job.

**Why there was no restart — four things, and each is now fixed:**

1. ⚠⚠ **`stopBuild` rewrites every remaining pass to `NOT_REACHED`, and `nextPassKey` only ever
   returns a `PENDING` or `RUNNING` pass.** So from the instant a build stops, `isResumable` is
   **false** — by construction, for every build that has ever hit a ceiling. New
   `resumablePassKey` treats `NOT_REACHED` as work; `isResumable` reads it.
2. ⚠⚠ **`resumable` was in `BuildView` and rendered by NOTHING.** `grep -rn resumable` returned
   the producer, the type, two check scripts and two harness fixtures — and no component. There
   has never been a resume control on any screen.
3. ⚠ **The clock made a resume impossible even if the button had existed.** `checkStop` measures
   elapsed from `startedAt`; a build already 922 s over a 900 s ceiling stops again *before its
   first resumed pass*, for ever. It now measures from `resumedAt ?? startedAt` — and the
   **spend** ceiling is deliberately not reset, because it sums the stored usages across every
   pass including the stopped attempt's.
4. ⚠ **`claimQueuedBuild` stamped `startedAt` unconditionally**, so a resumed build would have
   rewritten the moment it began — the number the duration estimate is measured from — with the
   moment it was picked up. Now set only on a build that has never run.

**What it does now:** a terminal build that did not run every pass carries `incomplete`, and the
screen says so: *"This build did not finish. 8 of 10 passes ran… What did not run: Logic check,
Hostile read."* It says the summary is **missing** rather than leaving a blank where Lex's
account of the run belongs. And it offers **"Carry on from 'Logic check'"**, which writes no new
`IdeaBuild` row and therefore **spends no allowance** — the passes already paid for are the
passes you get. Bounded at `MAX_RESUMES = 3`, so a build that stops on the same pass cannot be
resumed round a loop.

⚠ **A build stopped by a pass that FAILED rather than timed out is not resumable, and says why**
— picking up after it would build on an output that does not exist.

### 1b. Panels resize themselves — one token

See §0. `gridTemplate()` and the create page's inline template now emit `minmax(0, Nfr)`, and the
three panel bodies carry `min-w-0` (a grid *item* has `min-width: auto` for the same reason a
track does). **Panels now change size only when a divider is dragged.**

⚠ Both dividers now carry a **visible three-dot grip** — a shape, not a colour, so it survives
greyscale — and the left panel has its own **horizontal divider** between the worklist and the
chat. That replaces `max-h-[42%]`: one number, chosen once, for everybody. Both are
keyboard-operable, because a drag handle is the one control with no other route.

### 1c. Sections could not be closed — and the cause was "Work on this"

`collapsible = page.status === 'complete' || page.status === 'visited'`. Pressing **"Work on
this"** makes a section **active** — which is neither — so **the heading stopped being a toggle
at the exact moment the user chose to open it.** Now `collapsible = !isLocked`, with two sets
(`manualExpanded` / `manualCollapsed`) because the default differs by status and one flipped
boolean cannot express both. Headings are now real controls: `role="button"`, `aria-expanded`,
Enter/Space, and a **word** beside the glyph (`show +` / `hide −`).

`AgendaPanel`'s **Decisions** and **"Where the research changed my mind"** had *no toggle at all*
— the heading was an `<h4>` and the body was always there. Both toggle now, and a worklist jump
opens the section it lands on (a link to a collapsed element is a link that appears to do
nothing).

### 1d. The allowance was built and wired into exactly one place

`build.allowance.line` reached **only the re-run dialogue**. It was absent from the "Build it"
card — the *first* moment a user commits to spending one — and from the Re-run block on the page,
which is where you decide whether to open the dialogue at all. Both now carry the same sentence
from the same `readAllowance`, so no two screens can quote different balances.

### 1e. "A rerun is not available at this time"

That is `blockedReason` — *"A build is already running for this idea"* — reaching a surface with
no idea what to do with it. It is a refusal where a **status** belongs.

New `RerunBanner`, mounted on **both** surfaces from one component (two copies of "is a build
running" would eventually disagree, and the user believes whichever they are looking at):
**"Re-running now… 6 of 10 passes done — Research"** with a link, and **"Re-run finished"** —
or, honestly, *"The re-run stopped before it finished"* — which persists until dismissed, because
a banner that vanishes when the run ends is only ever seen by someone watching the screen at that
second. Polling stops when the run does.

### 1f. Uploaded files

⚠ **The file itself has never been stored, deliberately** — §25.6 keeps extracted text and no
binary, and the upload control says so. So "let the user open what they uploaded" cannot mean
handing back a PDF without breaking that promise. **Open** now shows *the text Lex read*, in a
viewer that says which it is in those words, with a link to the original for a link.

*"9 findings · 87k characters kept"* is gone. The row now reads **"Lex read this and took 9
findings from it."** The character count moves into the viewer, where "how much of my document did
you keep" is a question somebody might actually have.

---

## §2 — Naming and layout

All applied verbatim: **WORKING AREA · DRAFT STRATEGY · THE RESEARCH**; two subtitles deleted and
THE RESEARCH's kept word for word; **"Hide this Panel"** from one constant (there were three
hand-written variants); the **Background** and **Resources** headings deleted; *"Everything Lex
found or worked out:"*; **"0 of 7 approved"**; *"You can:"* deleted; and the purpose sentence in
the modal, verbatim, directly under "Welcome to Scrutinise".

⚠ **"You've finished this section" — the sentence was not the problem, the place was.** A card in
THE RESEARCH saying *"this part's complete, move on to Guiding Policy"* is the research panel
giving navigation orders to somebody reading a committee report. It is gone. Moving between
sections still works from the two places that are about moving — the section headings in DRAFT
STRATEGY, and the stage bar. Nothing was removed from either.

⚠ **The tour now teaches the names that are on the screen**, and §3's logic as the blurb. A tour
that names the columns differently from the page is the failure that list was written to prevent,
one sprint later.

---

## §3 — One logic for the three columns

**3a.** *"Make priority"* named the flag; **"Add to report"** names the act, and **"Remove from
report"** is the balancing control (the on-state used to read *"★ Priority"* — a label for the
state, so the only way to learn it was also the way out was to press it and see).

⚠⚠ **And the button now does something visible.** Until this sprint "Add to report" set a flag
whose only effect was inside a generated `.docx` — a control with no feedback on the screen that
produced it, which is a large part of why the middle and right columns read as two similar lists
rather than as a report and its raw material. New `ReportAdditions` in DRAFT STRATEGY: **what you
have put in the report, under the section headings that arrived with the first item from each**,
in the server's heading order, with removal available where a reader is most likely to decide
something does not belong.

**3b.** **Decisions** and **Where the research changed my mind** have moved to THE RESEARCH,
Decisions at the top of the contents list. One component, one `view` prop — splitting the file
would have produced two decision handlers writing the same table.

⚠ **THE ROOT CAUSE HAS NOT MOVED, and that is a stated exception.** §3b lists it with the other
two, but the root cause in the middle column is not a *finding* — it is the `causes` loop field of
the kernel state machine, with its own accept path, its own child-entity API and §8's nesting work
sitting on top of it. Moving it is a refactor of `FieldsPanel`, not a relocation of a panel, and
doing it blind alongside §8's redesign of the same data would have put two half-finished changes
on one structure. **The design is in §8 below; the move is one sprint's work, not a line.**

**3c.** The left panel is the working area: worklist, a **draggable divider**, then the chat with
**two tabs**.

- **Lex** — *"Talk to me, Lex, and I'll help you shape each part."* ⚠ *"Only conversations started
  on this page appear here"* was **already true and had never been said**; "the chat has lost my
  conversation" and "that conversation was somewhere else" look identical from the outside.
- **Notes** — new `IdeaNote` table, new route, new panel. Titled, grouped under free-text
  headings, drag-to-reorder (with ↑/↓ and a heading box, because a drag handle has no keyboard
  equivalent), each with show/hide. **The user's original idea is seeded there under "My original
  idea"**, on first read, marked as copied.

⚠⚠ **PRIVACY IS THE KEY, NOT A FLAG.** There is no `visibility` column and there must not be one:
a boolean defaulting to private is a boolean somebody will set the other way, and every read is
then one missing `where` clause from publishing a user's working notes to their team. Every query
is `(ideaId, userId)`, so a note is unreachable to anyone else *by construction*. `authorizeIdea`
answers "may you be on this idea" — a collaborator passes it — and the `userId` scope is what
makes the notes theirs. The two are deliberately separate.

> ### ⚠ CHARLIE — YOUR OPEN QUESTION, RECORDED AND NOT RESOLVED
>
> *Should notes be visible to the idea-team?* Three options, and the trade is not close to even:
>
> 1. **Private only (what is built).** The one place on the page that is only yours. Its value is
>    exactly that you can write "I don't believe the DfE numbers" and "ask J before the
>    committee" without composing them for an audience. **Cost:** a team cannot see the owner's
>    working, and there is nowhere to leave a note *for* somebody.
> 2. **A per-note switch.** Each note private or team-visible. **Cost, and it is the reason this
>    is not the default:** it is precisely the flag the schema comment argues against. Every
>    future read of the table is one clause from leaking the private ones, and the *interesting*
>    notes are the ones that would be leaked. It also changes how people write — a box that
>    *might* be shared gets written as though it will be.
> 3. **Two lists, side by side: "My notes" (private, no switch) and "Notes for the team"
>    (visible, no switch).** ⚠ **This is the one I would recommend if you want sharing at all.**
>    The privacy question is answered by *which box you type in*, before you write a word, and it
>    can never be answered wrongly by a later query — the private list keeps the `(ideaId,
>    userId)` key it has now, and the shared list is a different table with different rules.
>
> **Not chosen. Say which.**

**3d.** Both panel texts verbatim: the worklist's *"This panel lists the decisions and actions
you need to take…"* and the draft's *"Here is the draft strategy I have written for you to
review…"*, the latter now the first thing in DRAFT STRATEGY.

**3e.** Four parts, in order, each hidden until clicked: **Things to read · Decisions to make ·
Put it out for scrutiny · Promote it**, with §3e's wording verbatim on the last two.

⚠⚠ **The last two parts were absent entirely.** The worklist ended at the research, so a user who
had finished the research was told *"nothing is waiting on you"* while three quarters of the
actual job — get it read, get it argued with, get it supported — had never been named once.

⚠⚠ **AND THE MOBILE CLICKABILITY HAS A CAUSE.** The old rows were `<a href="#anchor">`. On a phone
the anchor is **inside a tab that is not on screen**, so the link resolved to nothing and the row
did nothing — not a styling problem, a structural one. Every item is now a real checkbox (which
acts on the row itself) or a link to a **route**, never to a fragment. Ticks persist per user in
`IdeaWorklistTick`; a resolved decision is ticked whether or not anybody pressed the box.

---

## §4 — The right-hand contents

**Order applied:** Decisions · Where the research changed my mind · Outputs · How hard will this
be to achieve? · Cost and duration · **divider** · Inputs · everything else · *not asked of this
draft* at the bottom.

⚠ *"Where the research changed my mind"* is not in §4's list. It is placed immediately below
Decisions because §3b names the two together and they are the same kind of thing — something Lex
did, for the user to judge. **Say if you want it lower.**

⚠ **"Not asked of this draft" sinks by EMPTY REASON, not by count.** *"We asked and found
nothing"* is a **finding** and stays in the body of the list; *"this was never asked"* is
housekeeping and goes to the bottom. Sorting both down because both are empty would bury a real
result with a non-result.

### ⚠⚠ "Clicking a contents item shows neighbouring sections too" — the list was never at fault

`QuestionPanel` renders exactly one item, correctly. **`BackgroundPanel` then went on rendering
the retrieved-by-type fold, the stage search, the exports and the page-one source cards
underneath it, unconditionally.** The library sat on top of a scroll, so "one item at a time" was
true of one component and false of the screen.

The fix is also §4's own **Inputs** group: those two blocks are now handed *into* `QuestionPanel`
as contents items, and nothing renders beside it. One component decides what is on screen, so
"shows that item only" is a property of the code rather than an aspiration.

### "The strongest case against" — deleted, and its rows kept

⚠⚠ **The heading goes; the KEY stays in the type.** `EvidenceItem.headingKey` holds `'AGAINST'`
on every row the adversarial pass has ever written. Removing the key from the union would make
`isHeadingKey('AGAINST')` false and every one of those rows would silently become "not filed under
a question" — the material §4 is trying to *keep*, deleted by the change meant to relocate it.

So it is a **redirect**: `AGAINST → ARGUED` ("Who has argued about this" — §4's own second
destination, and the one that is a panel heading; Challenges is a different mechanism entirely,
in the middle column, which §0 says must not be disturbed). `prisma/lex_25n_backfill_against.sql`
repoints the stored rows too, so the two cannot drift. **Unrun — it is yours to run, and the panel
is already correct without it.**

⚠⚠ **THIS FOUND THREE REAL DEFECTS, TWO OF THEM BY A CHECK RATHER THAN BY READING:**

1. **`deepening-config.ts` still declared `heading: 'AGAINST'`** on the POLITICAL_RISK pass — a
   *second* producer, in a different config array. `check:lex-25l` §3b caught it: *"a producer
   declares a heading nobody renders"*. It would have gone on writing rows under a heading the
   panel no longer draws, for ever.
2. **The evidence pack tested `QUESTION_HEADINGS.some(...)` directly**, so every `AGAINST` row
   fell into "not filed" — where the pack *tells the reader* their question was never recorded.
   Caught by `check:lex-25d` §5a. A false statement about our own work.
3. **The public proposal page did the same**, on the outward-facing surface.

`liveHeading()` now exists precisely because of this shape, and its own comment says it: *a
redirect applied in two of three places is a redirect that puts the same finding under two
headings.* All four readers go through it, and `check:lex-25n` asserts each one does.

### Items are movable between sections

The mechanism already existed and had **no door**: `heading-map.ts`'s first rule is that the
stored tag always wins, written for exactly this, and nothing had ever written it except the
producers. A misfiled finding could only be *set aside*, which deletes the material §4 wants kept.
New `PATCH /api/ideas/[id]/panel`, scoped to the idea, refusing a retired heading (`isHeadingKey`
still accepts `'AGAINST'` so stored rows resolve — accepting it *here* would let a user file
something where the panel does not look). A move touches no source decision: excluded stays
excluded, in-the-report stays in-the-report. **Only the shelf changes.** The control is on every
finding except the user's own documents, which have no `headingKey` to write.

### Cost and duration

⚠ **It exists now, and it honestly has no producer.** Nothing in the build costs a proposal;
what figures exist are the cost lines on individual actions. Rather than render *"we looked and
found nothing"* — a false statement about the world made to cover a hole in our tooling — the
heading says so in amber, points at where the figures are, and carries §4's caveat as part of the
heading itself: **a purely financial view, which leaves out the human costs and benefits
entirely, and where the kernel is unsettled the figures rest on a draft.** A costing quoted
without that sentence is a costing that will be read as the whole picture.

---

## §5 — The documents

**5a.** *"9 of 9 settled kernel fields carry no source"* and *"167 questions remain open"* are
**gone from both**. In their place, once, at the top, and only when something really is open:
**"This is a DRAFT report for a proposal in process."** ⚠ The counts still *decide* whether the
sentence appears; only the verdict is printed. The honesty is not removed — the full report still
carries the gaps **as prose**, which a reader can weigh, rather than our arithmetic.

**5b.** The summary is **one page**: four headings — **The problem · Cause · Guiding Policy ·
Proposed Actions** — at ~450 characters each. ⚠ The old six included "The pivotal obstacle" and
"The approach" (a vocabulary the platform teaches nowhere) and **dropped the cause entirely**, so
the one-page version of a proposal never said why the problem happens.

A field with several candidates takes the top one and **labels it**: *"Current leading cause, of
10 under consideration. No root cause has been settled on yet."* ⚠ "Top" is the **user's order**,
not a score — a cause the user has marked as root wins over position, and nothing here ranks
them, because §5b's next sentence asks for the user to choose.

⚠ **Draggable kernel items (§5b's second half) are NOT built** — same reason as §3b's root cause:
the ordering control belongs with §8's causes work, on the same rows.

**5c.** **"Guiding Policy"**, not "The approach". Approaches under consideration are **listed**
with the "none committed to" line kept. **"In Charlie's own words" is deleted** — the account
stays and is still marked as testimony; what goes is naming the author inside their own outward
document. And the six **sections**, with the heading repeated on every page:

**DRAFT STRATEGY · HOW HARD WILL THIS BE TO ACHIEVE · WHAT THE LAW SAYS NOW · QUESTIONS THE
RESEARCH COULDN'T ANSWER · CHALLENGES · SOURCES**

⚠ A new `section` block in the document model, **not a flag on a heading** — a running header is
state that persists across pages; a heading is a mark at one point in the flow, and inferring one
from the other would have the renderers reading the document's structure out of its typography.
The PDF stamps it inside `newPage()` (the only place a page is made, so it lands on page 87 as
well as page 1); the .docx splits into real Word sections with a `Header` each, because a Word
header is a property of a **section** and writing the title into the body would print it once.

⚠ CHALLENGES is now a section rather than a sub-heading of "what this does not establish" — §0
calls it *"the most valuable part of the run so far"* and it was filed as a shortcoming of the
proposal rather than as the scrutiny it has survived.

**5d. It was a page load, and the cost is one line.** `readProposalExportStatus` called
`buildProposalSnapshot` on **every GET** — the whole twelve-table assembler — for **one purpose**:
to hash it, so a generated file could be reported as stale. The user waited five seconds for the
answer to *"is this file current?"* before being shown the file's **name**.

The staleness check is not dropped — it is the fact that matters to somebody about to send a
document to an MP. It is no longer in front of the first paint: `?quick=1` returns everything the
document rows know, staleness comes back **`null`**, and ⚠ **`null` is a third state rendered as
*"Checking whether it still matches…"*, never as "current"** (§19 — a fact measured and a fact
assumed must not look identical). Generation itself now says **"Building reports…"**.

**5e. The meeting pack** — a third document, and ⚠ **not a shorter proposal.** The Proposal and
the Summary are written for somebody being asked to **agree**; they lead on what is settled. This
is written for somebody being asked to **argue, in a room, for an hour**, so the order is
inverted: what is being decided → what nobody has answered → what a hostile reader would ask →
the kernel as background → the evidence. **It has no "ask"**: a person who has not joined the team
is not being asked to endorse anything.

Printable, with the five sections chosen before printing (all on by default — not choosing is not
choosing to omit), and **what was left out is named on the front of the pack**, so the reader
knows to ask for it.

⚠⚠ **The chosen sections are part of the fingerprint.** The store is idempotent by hash; without
that, a user who unticked two sections and pressed Generate would get the **cached** file back —
reported as freshly generated, with the sections they removed still in it.

---

## §6 — The public view *(designed, not built)*

*"See this as others would"* points at `/ideas/[id]`, which is the **team** view. The public view
does not exist. It was not reached this sprint — §5 ran long — and it is the one item here I would
put first next time, because it is the only one a stranger ever sees.

**The design, ready to build:**

- **Route:** `/ideas/[id]/public`, and the existing "See this as others would" link repoints to it.
  ⚠ **A new route, not a mode on the team page.** A `?public=1` flag on a page that already renders
  privileged material is one forgotten conditional away from publishing it, and the conditional
  will be forgotten — the same argument the Notes table makes against a `visibility` column.
- **A title and summary card**, clickable to open. Nothing else above the fold: the reader is
  deciding whether to spend two minutes, and the card is that decision.
- **Inside, four headings only — Problem · Cause · Policy · Actions — each clickable to reveal.**
  ⚠ Closed by default. A public reader who is handed four screens of text reads none of it.
- **Space below for contributions**, reusing the existing `Contribution` surface.
- ⚠ **It reads a published VERSION, never live working state**, exactly as `/proposals/[token]`
  does. A public view of a draft that changes under the reader is a view that can quote them
  something the owner has since retracted.
- ⚠ **The DRAFT banner (§5a) belongs here too**, and matters more here than in a file: the reader
  has no other way to know.
- **Reachable from the top of Stage 1, beside the re-run.**

## §7 — Choosing a guiding policy *(designed, not built — §7 asks for the design first)*

Charlie: *"How do I choose? Do I have to choose one only? What if I want parts of others built
in?"* The mechanics are undefined, and **the honest answer to the second question is "no", which
nothing in the product currently says.**

**The logic, in order:**

1. **A comment box under each candidate — what you like, what you dislike.** Two boxes, not one:
   *"what I like"* and *"what I dislike"* produce usable material where *"comments"* produces a
   shrug. Stored on the option, shown back, and fed to the next run **as an instruction**
   (`⚠ ACT ON THIS`, the 25-L §1 rule — material with no instruction is material a pass ignores).
2. **Lex re-runs with a proposed rule-in / rule-out**, plus *what you would have to resolve to
   reach one clear guiding policy*, with comment boxes again for the answers. Iterates.
3. ⚠⚠ **Lex must first say which candidates are genuinely mutually exclusive and which combine.**
   This is the part the current product gets wrong by omission: it presents a list and implies a
   choice. Charlie's example — legislation alongside an HR and performance rethink — is *"not
   only complementary but essential to have together"*, and a product that forces one of them
   loses the proposal's actual answer.
   **Mechanically:** a new pass output, one row per **pair**, with a verdict from a closed set —
   `EXCLUSIVE` / `COMPLEMENTARY` / `INDEPENDENT` — and a **reason**, which is the part a user can
   argue with. ⚠ Pairwise and not a clustering: a user needs to know why *these two* cannot
   coexist, and a cluster label cannot say.
4. ⚠⚠ **Impasse: never block.** If the user will not narrow, they proceed. Lex records a **risk** —
   *"this proposal carries two potentially conflicting guiding policies, to be resolved"* — which
   travels into the documents like any other open issue. Splitting into two ideas is **offered**,
   never imposed. §7's own sentence is the rule: *a "computer says no" is worse than an unresolved
   tension.*
5. **Instructions at the top of the section**, once the logic is settled: what a guiding policy
   is, that you may combine, that you may proceed unresolved, and what happens if you do.

**What this needs:** a `PolicyOptionComment` table (option, user, likes, dislikes), a
`PolicyOptionRelation` table (pair, verdict, reason, whose), one new build-pass output, and the
section header. **It is a sprint, and the pairwise verdicts are the risky half** — they are a new
model output making claims a user will hold us to.

## §8 — Causes: nesting and evidence *(designed, not built)*

**Charlie's question, answered.** *If the material cause is the last link in the chain, should the
preceding causes stack above and indented, so that choosing the final material cause highlights
the whole chain?*

⚠⚠ **The model chosen is: the chain is stored root-**down**, and displayed material-cause-**up**,
and those are two different things that must not be conflated.**

- **Stored:** `parentCauseId` points from a cause to the thing that **drives** it, as it does
  today. That is the causal direction (`drivenBy`), it is what the two build passes already write,
  and it is what makes "why does this persist" answerable by walking the links.
- **Displayed:** the **material cause — the last link, the one a proposal can actually act on —
  is the anchor**, with the causes that produce it stacked **above and indented**, so the eye runs
  from the thing you can change up to the reasons it stays true. **Selecting the material cause
  highlights the whole chain**, because the chain is the argument for it.

**Why this way round, and not the storage order:** a diagnosis is *read* as an argument for one
intervention. Root-down display puts the least actionable thing at the top and buries the
intervention at the bottom of an indent stack — which is how the current flat list came to be
tolerable. Storage stays causal because storage is what the passes and `nestByDrivenBy` reason
over; **display is a `reverse()` at the render boundary, not a second schema.**

**Also to fix, and diagnosed:**

- ⚠ **"Add cause beneath" creates a duplicate with no hierarchy** — it does not set
  `parentCauseId`. One field on the create call.
- **Drag and drop:** drop cause A onto cause B ⇒ `A.parentCauseId = B.id`, drawn indented and
  visually linked. ⚠ **Needs a cycle guard** — a chain that loops renders for ever, and a user
  will make one within a day.
- **The title box must expand** like the others.
- ⚠⚠ **Lex puts everything in the title and leaves "why it has persisted" empty, despite having
  clear answers for both — and CLAUDE.md §24 says where to look first: the PROMPT, not the code.**
  This is the fourth instance of schema-permits ≠ prompt-requires, and §24.1's rule applies
  exactly: **two passes write causes and the second replaces the first**, so the fix is one
  shared, imported instruction given to both, asserting the **value** (`whyPersisted` is
  non-empty and is not a restatement of the title) and not the schema. ⚠ *Assert the value, not
  the schema* — §23.3, and the reason `drivenBy` cost five sprints.

## §9 — Deferred *(recorded, not built)*

Carried forward verbatim, with one thing worth flagging: **the Deepening-as-research-tool must not
be blocked on kernel completion**, and it currently is. That gate is a single condition
(`unlocked={kernelComplete}`), and §9's argument against it is decisive — research changes the
kernel, so it cannot wait for it. **It is a small change with a large consequence and is the
cheapest item in §9.**

The rest — the challenges Respond button and Resolved challenges, "Remove 'Another model made
this point'", re-run challenges, the positions for-and-against list, and Lex answering navigation
questions from the FAQ — are recorded and untouched.

## §10 — Content quality *(an approach, per §10's instruction; no fix attempted)*

Charlie's finding: **a single 2014 Lords remark that civil service productivity had improved was
accepted, used to change Lex's mind, and never questioned** — not for its date, not for its
absence of figures, not against contrary evidence. His standard: *"I've tracked down the numbers
he referred to and they no longer hold."*

### (a) Date-checking and challenging a retrieved claim before relying on it

⚠ **The hard part is not the date. It is that we currently have no representation of a CLAIM at
all** — we store findings, which are prose about a document. "This assertion, made by this person,
on this date, resting on these figures" is not a thing the schema can hold, so nothing can test
it.

**What it would take, in order:**

1. **A claim is extracted with its date and its basis**, not just its text: `assertedOn`,
   `assertedBy`, `basis` (`FIGURES` / `EXPERIENCE` / `ASSERTION`), and — critically — **whether
   the source states figures or merely characterises them**. A 2014 remark with no figures and a
   2014 remark citing an ONS series are different evidence and are currently identical to us.
2. **A staleness rule that is about the SUBJECT, not the age.** Twelve years is nothing for a
   constitutional principle and fatal for a productivity claim. ⚠ A blanket "flag anything over N
   years" is the guard-measuring-the-wrong-dimension shape: it would flag the durable claims and
   miss a two-year-old number that has already moved. The rule has to key on the *kind* of claim —
   a measurement decays, a principle does not.
3. **A contradiction search before reliance, not after.** The revise pass changes its mind on the
   strength of one finding; before it does, the claim's own terms should be searched for
   *contrary* evidence and the result carried into the decision. ⚠ This is the expensive half —
   one extra retrieval per mind-changing finding — and it is also the half that would have caught
   this one.
4. **The mind-change records what it rested on.** `Contradiction` already stores *"I first
   concluded X; the evidence says Y"*; it should store **which finding moved it**, so a user can
   go straight to the thing they need to check. Today they cannot.

⚠ **Steps 1 and 4 are cheap and would have made this finding *findable*. Steps 2 and 3 are what
would have made it *caught*.** I would do 1 and 4 first and measure how often a mind-change rests
on a single undated assertion before paying for 3.

### (b) The opening commentary on the causes section

**The larger gap, and I think the more valuable of the two.** There is no commentary at the start
of the causes section setting out the evidence, the issues, the level of complexity, and how the
pieces might fit into a coherent strategy. **The user is asked to choose between options at a
granular level with no overview of the terrain.**

⚠ **This is one pass, and it is the only pass that would read the causes as a SET.** Everything
today reasons about one cause at a time — that is why the output is a list. What it would write:
how many candidate causes there are and how they group; which are contested and which are not;
where the evidence is thin; which combinations are coherent; and what the user is actually being
asked to decide.

⚠⚠ **And it has to run LAST, after the research, or it is a summary of a draft rather than of the
evidence.** It also has to be re-runnable on its own after a kernel change, because it is the one
output that goes stale the moment anything under it moves.

**Both are prompt-and-pass work, and both are more valuable than anything else outstanding** —
including §6 and §7. §10(b) in particular changes the shape of the user's decision rather than
the ergonomics of making it.

---

## Checks

`check:lex-25n` — **98 passed, 0 failed, 18 negative controls, all 18 fired.**

⚠⚠ **Four of my own assertions failed against correct code, and the cause is worth recording:**
every *"this string must NOT appear"* assertion was reading the ⚠ comment that **explains the
deletion** and quotes the deleted string. `!/own words/` cannot pass on a file whose comment says
*"was `In ${owner}'s own words`"*. That is not a formatting annoyance — it is a check measuring
the wrong thing, since the property is about what the document **emits** and a comment emits
nothing. There is now a `code()` reader that strips comments, and the assertions use it.

⚠ **And three of my controls did not fire, all the same inversion** — the lambda returned "does
the broken text still match" instead of "does the property hold". A control that cannot fire is
the thing the control exists to prevent, one level up.

**The whole suite, run and reported (§23.2), not a selection.** See the CHANGE_LOG entry.

⚠ **Seven guards from three earlier sprints fired and were REPOINTED, not relaxed** — and **three
of them found real defects in this sprint's code**, listed under §4 above. Each repointing says
which brief changed the property and why the new assertion is at least as strong.

---

## ⚠ VERIFIED LIVE — 2026-08-31, production, signed in

**§20 checks 3 and 4 are SATISFIED, and not by the SHA alone.** `/api/health` reports
`commit: 19bf8df…`, `env: production`; and the authed surface was walked at
`/ideas/create?ideaId=452c5ade…`. **These strings came back off the running site:**

| §  | read back off production |
|---|---|
| §2 | **WORKING AREA · DRAFT STRATEGY · THE RESEARCH**, and **"Hide this Panel ‹ / ›"** on all three |
| §2 | *"This panel is where you'll find the background, the research, the issues, the numbers and the debates behind your draft strategy."* |
| §2 | **"8 of 8 approved" · "3 of 7 approved" · "0 of 7 approved"** |
| §1c | **`show +` / `hide −` on EVERY section — including the ACTIVE one (DIAGNOSIS, reading `hide −`)**, which is the exact case "Work on this" used to lock |
| §1c | **"Challenges 135 · hide −"** — the AgendaPanel toggle that did not exist |
| §3d | *"Here is the draft strategy I have written for you to review and develop into your formal proposal…"*, verbatim, at the top of the middle column |
| §3d | *"This panel lists the decisions and actions you need to take to build the draft strategy I've prepared for you into your formal proposal."*, verbatim |
| §3c | the **Lex / Notes** tabs, and *"Talk to me, Lex, and I'll help you shape each part. Only conversations started on this page appear here."* |
| §3a | `ReportAdditions`' empty state, **in the middle column** — *"…open an item there and press 'Add to report', and it appears here under its own heading."* |
| §3e | **all four parts, with real counts: Things to read 0 of 3 · Decisions to make 2 of 4 · Put it out for scrutiny 0 of 2 · Promote it 0 of 2** |
| §4 | the contents list **in §4's order — Decisions → Outputs → Cost and duration → Inputs** |

⚠ **AND THE CONTROL FIRED ON PRODUCTION TOO:** a search of the live accessibility tree for
**"The strongest case against"** returns nothing, while it lists Challenges, Read these, What
nobody has answered and the rest. The heading is gone from the running site and its neighbours
are not.

▶ **"Decisions to make — 2 of 4 done"** is worth pointing at: nobody has ticked anything. Those
two are **resolved forks, ticked by the server**, which is the route's own rule working on real
data — a decision made an hour ago is not bookkeeping the user should have to repeat.

▶ **All six API reads returned 200**, including the two routes this sprint added
(`/worklist`, `/notes`). ⚠ They are **slow — several seconds** — which is the same shape as §5d
and is noted below.

### ⚠ Two things the walk found that the harnesses could not

1. ⚠⚠ **THE PANEL FETCH IS NOW MADE TWICE.** `ReportAdditions` calls `/panel` and `QuestionPanel`
   calls `/panel?field=causes` — two reads of the same assembler on one page load, and I added the
   first one. It is correct but wasteful, and on this idea (135 issues, seven builds) the whole
   first paint takes **several seconds** with everything pending. **The fix is the one §5d already
   demonstrates:** hoist the panel read to the page and pass it down, or give the middle column a
   `priority`-only projection. Not done — it is a new finding, not a brief item, and it wants
   measuring before it is optimised.
2. ⚠ **`/agenda` is also fetched twice** (WorkList and AgendaPanel), which predates this sprint
   but is now three heavy reads deep on one paint.

### Still only Charlie can confirm

- **That the panels stop re-proportioning** — the `minmax(0, …)` is on the page, but the symptom
  needs a wide finding opened and an eye on the columns.
- **That the resume actually resumes.** Asserted over a real stopped pass log; **no live resume has
  been run**, and it costs two passes' spend.
- **The three new WRITE paths** — a note typed, an item ticked, a document opened. The reads are
  proven; ⚠ "built inert hides write-path bugs" is a standing finding here.
- **The .docx running header, in Word.**
- **The mobile items, on a phone, in a hand.**

---

## ⚠ WHAT REMAINS UNVERIFIED

The live walk above covers the RENDER of §1c, §2, §3a, §3c, §3d, §3e and §4 on production.
What it does not cover, and what only Charlie can confirm:

1. **That the panels stop re-proportioning.** The `minmax(0, …)` fix is asserted in the template
   string; that it cures the symptom is a claim about a browser's grid algorithm on real content.
2. **That the resume button actually resumes.** The pass-log functions are asserted over a real
   stopped log, and `resumedAt` is asserted in the source — but **a live resume of build v7 has
   not been run**, and it costs two passes' spend. It is the one assertion here that needs a
   build (§23.3: where that needs a live run, the live run is the check).
3. **The Notes tab, the worklist ticks and the material viewer** — three new write paths, none
   exercised by a real user. ⚠ "Built inert hides write-path bugs" is a standing finding in this
   repo; the first live run of the stats layer found six real bugs in a `tsc`-clean build.
4. **The .docx repeating headers in Word itself.** `check:documents` proves the file renders and
   the PDF keeps `£` and `§`; whether Word shows the running header on page 87 is a Word question.
5. **The mobile items being clickable**, on a phone, in a hand.

**Three SQL files are applied; one is not.**

| file | state |
|---|---|
| `prisma/lex_25n.sql` | **APPLIED** to Neon (`ep-old-dust-aboxi69a`, host checked first). Read back. |
| `prisma/lex_25n_notes.sql` | **APPLIED.** |
| `prisma/lex_25n_worklist.sql` | **APPLIED.** |
| `prisma/lex_25n_backfill_against.sql` | ⚠ **NOT RUN — yours.** The panel is already correct without it; it stops the stored tag and the rendered heading drifting. Run the count first and keep the number. |

⚠ **`IdeaNote` carries a PARTIAL unique index that `schema.prisma` cannot express** —
`UNIQUE (ideaId, userId, source) WHERE source <> 'USER'`. The obvious `@@unique` is **wrong in
the direction that breaks the feature**: it would apply to `source = 'USER'` too, so a user could
have exactly one note. It is on the CLAUDE.md §21 hazard register, and **`prisma migrate diff`
will propose dropping it as drift**.
