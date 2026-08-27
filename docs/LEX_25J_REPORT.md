# Sprint 25-J — the ideas hub, and the front door a stranger meets

**2026-08-27. Brief: `docs/BRIEF_25J.md`.**

---

## The short version

§1–§4 are built. **§5's premise is superseded: the measurement it asks for was taken an hour
before this brief was written**, so its one-build ceiling is unspent.

The sprint's most useful moments were three guards firing on correct code and one on my own:
`check:deepening` (three times, over the statutory sprint), `check:lex-25d`'s heading count,
and my own §1 sweep **twice** — each time because the rule I had written was cruder than the
thing it was guarding.

---

## §1 — One voice, swept

Nine collection labels changed to "my", across the dashboard, the ideas page, the communities
page, the prototype dashboard, the training exchange and the build surface. The nav item
**Create → My ideas**.

⚠ **The five-stage vocabulary is untouched.** `STAGE_1` is still called *Create*
(Create/Draft/Develop/Campaign/Legislate — `docs/CLAUDE.md` §4, "use exactly, never
substitute"). A sweep that renamed the stage would have broken the vocabulary the whole
product shares and would have looked like tidying up. The check asserts both halves: the nav
says "My ideas" **and** `STAGE_1` still says Create.

### The guard I wrote twice, and why the second version is better

§1 says *sweep, don't spot-fix*, so the check walks every `.tsx` under `app/` and
`components/` rather than pinning the two files Charlie noticed. It fired on correct code
twice:

1. **Matched `ideas?`** — so *"Your idea has reached Parliament"* and *"Ways to improve your
   idea"* came back as violations. Those are the product **speaking to** the user about one
   idea, which is correct English.
2. **Narrowed to the plural** — still wrong: *"Export all your ideas, contributions and
   votes"* and *"It will disappear from your ideas straight away"* are sentences too.

⚠ **The real distinction is heading versus sentence, and a heading IS the whole label.** The
rule now requires the phrase to occupy the entire text node — bounded left by `>` or a quote,
bounded right by `<`, a quote, or an opening bracket for a count. That is a rule about
structure rather than a list of exceptions, so a new screen with `<h2>Your ideas</h2>` fails
on the day it is written.

**A guard that cries wolf gets turned off, and a guard that is off protects nothing.**

---

## §2 — My Ideas is a hub

`RecentIdeasPanel` is deleted. Its own header said it should be — *"a stopgap… it should be
deleted the moment a real 'my ideas' surface exists"*. `MyIdeasList` is that surface, and
three things about the stopgap were real defects once it became the front door:

| | stopgap | hub |
|---|---|---|
| visibility | behind a `<details>` | open, on the page |
| identity | **no title at all, ever** | real title, or the user's own words |
| context | elicitation/build status | stage, build state, last worked on |

⚠ **The stopgap carried `title` on its type and deliberately never displayed it**, because 11
of 11 ideas were called "Untitled idea" and a title list would have rendered eleven identical
rows. Right for a stopgap, wrong for a hub — §2 asks for *"not eleven rows called 'Untitled
idea'; where a title has not been generated, identify it by the user's own opening words."*

So a real title wins when there is one, and the opening words stand in when there is not —
**labelled as the user's words** (*"In your words: …"*), never dressed up as a title we chose
for them. The placeholder test is an exact match on `Untitled idea`, not a heuristic: "does
it look generated" would misfire the day somebody genuinely names an idea *Untitled thoughts
on buses*, and would do it silently.

**The transition.** The list renders only while there is no idea and the user is on the first
question. Answering creates the idea and the working view takes over. A hub list that
persisted alongside the three-column view would be a permanent invitation to abandon what you
are doing.

⚠ **25-I §1 held, and the check asserts it.** Nothing is created by arriving; `ensureIdea`
still runs on the first answer only. A hub that re-introduced the mint would refill the very
list it exists to make trustworthy.

The excerpt is cut at 110 characters rather than the stopgap's 180 — a list row the eye can
scan, not a diagnostic paragraph that wraps to four lines.

---

## §3 — Progressive disclosure

`PanelEdge` renders a collapsed panel as a slim labelled edge; `panelOpen` is
`boolean | null` so a panel follows content until the user decides; both a collapse and a
restore control exist; and the landing redirect still sends a returning user with a finished
build to the proposal. All asserted by `check:lex-25j`, each with a control.

⚠ **The collapsed-edge state was NOT walked, and the reason is a tooling limit rather than a
finding.** See the walk below.

---

## The walk — signed in, on production, after this sprint deployed

**What I verified live:**

| | |
|---|---|
| `/ideas/new` resolves through the door to `/ideas/build` | ✓ the 25-G cutover holds |
| the first question is dominant — prompt, hints, Send | ✓ |
| **"My ideas (1)"** beneath it | ✓ §2's hub |
| the idea shows a **real title** — *"Enhancing Civil Service Accountability and Performance"* | ✓ not "Untitled idea" |
| stage, build state and last-worked-on | ✓ *"Create · built · last worked on 22 Aug, 01:56 UTC"* |
| the surface switch routes to the build and reports **8 passes** | ✓ §3's both-ways route, and it is reading the completed v5 build |
| **loading the page created nothing** | ✓ 68 live ideas before and after; newest still 26 Aug |

⚠ **What I could not walk: the three-column desktop layout.** `read_page` reports
**`Viewport: 0x0`** for the extension's window, so Tailwind's `lg:` breakpoints never match
and the page renders its mobile tab layout (`Chat | Progress | Background`) whatever I resize
the window to. Resizing to 1600×1000 did not change it.

That means the **collapsed-edge and expand-on-content states of §3 are verified by
`check:lex-25j` and by the render harness, not by the walk.** I stopped after three attempts
rather than keep pulling at it. It is worth noting for future sprints: **any acceptance
criterion that depends on a desktop breakpoint cannot currently be walked from a Claude Code
session**, and briefs should assume that until the viewport reporting is fixed.

⚠ One naming judgement I made and want on the record: `PanelEdge`'s labels are **"Your
proposal"** and **"Legislation"**. I left "Your proposal" in the second person. §1 names
*ideas, communities, teams* — collections — and this is a label on the single working
document the product is discussing with you, the same register as "Your account" (25-H §2)
and "Your material". If you want it as "My proposal", say so and it is a one-line change.

---

## §4 — Where the user meets statutory consequences

⚠ **A correction of my own reasoning from last sprint.** The statutory-consequences sprint
filed the pass under `LAW_NOW`, arguing *"a user reading what the law says now wants both
what it says and what else depends on it"*. §4 is right and I was wrong: they are **two
questions, not two answers to one**. "What the law says now" is the ground; "what else refers
to this law" is what would break if you moved it — a different shape of answer and a
different meaning when empty. Sharing a heading also made the pass **invisible**: its output
landed among the legal map's findings, where nobody had reason to look for it.

New heading `REFERS_TO_THIS` — *"What else refers to this law"* — placed **immediately after**
`LAW_NOW`, because `HEADING_ORDER` is the panel order and the two are read together.

**A group now opens to its members.** Verified on a live row:

```
headingKey: REFERS_TO_THIS
title: 4 references that disapplies, qualifies or overrides the target — replace

This reference defines terms by reference to the Act, so it will need to point to the
new location of those definitions if the Act changes.

One of them, in ukpga/2025/18 p08160:
“…“treaty” and “ratified” have the same meaning as in Part 2 of the Constitutional
Reform and Governance Act 2010”

Where they are — 4 distinct provisions:
  · ukpga/2025/18 p08160
  · uksi/2012/3028 article-2
  · uksi/2012/3029 article-2
  · uksi/2014/3249 article-2

6 groups covering 149 references inside provisions. 33 further references name the
target in a title… This covers statutory instruments…  Treat any number here as what
we found in the layers we have searched, not as a total.
```

⚠ Members are **deduplicated on (document, provision)** and capped at 12 with the remainder
counted. Two references in one section are one place to go and read; printing it twice would
inflate the apparent work in exactly the direction the brief warns about — and the count
above the list would then disagree with the number of places a reader can actually visit.

---

## §5 — Superseded, and the ceiling is unspent

⚠ **The brief says the measurement "has never been measured" and authorises one build. It was
measured at 12:28 UTC today**, before this brief was written, as the 25-I addendum records.
Running another would be spend for a number I already have, so I have not.

**From v5 — `DONE`, 8 passes executed and 2 reused, 4m 21s, 24.83p:**

| quality | in the output | evidence |
|---|---|---|
| 1 a causal chain, not an inventory | ✗ | 0 of 4 causes nested |
| 2 a counterintuitive finding | ✓ | 8 CONTRADICTS |
| 3 the finding, not the citation | ✓ | 80 of 82 substantive |
| 4 reframes the instrument if wrong | ✓ | — |
| 5 a test the user can apply | ✗ | — |
| 6 the next action | ✗ | — |

**The reuse saving from a build that finished: 107,380 → 55,626 input tokens, 48%.** That is
the figure §5 asks for, and it replaces the 85% ceiling — which came from runs that died at
pass 5 and looked cheaper for stopping early.

⚠ **The reuse build cost more than the full build it reused from** (24.83p vs 6.78p) because
v1 is a seven-pass pre-25-F build and v5 ran SMART, KERNEL_CHECK and LOGIC_CHECK. A
like-for-like saving still needs a full ten-pass baseline, which does not exist.

**Two open defects, neither in this sprint's scope:** quality 1 fails against 25-H's own fix
(`nestByDrivenBy` is in the code and checked; the model is not populating `drivenBy`), and
qualities 5 and 6 have never been observed in any output despite reaching every drafting
pass.

---

## Verification

| gate | result |
|---|---|
| `check:lex-25j` | **12 passed, 7 with negative controls**, all watched rejecting |
| `verify:my-ideas-ui` | **15 passed** — renders the markup, three controls |
| `check:deepening` · `check:statutory` | all pass · 17 |
| `check:lex-25c`…`25i`, `build-25a/b` | 32 · **77** · 28 · 62 · 27 · 20 · 14 · 40 · 54 |
| `tsc --noEmit` | clean |
| `next build` | clean |
| `check-clean-build.sh --fast` | PASS — 0 cross-package files |
| live row written under the new heading | ✓ quote, members, coverage all present |

**Other sprints' guards that fired, and were right:**

- **`check:lex-25f`** — its §9b assertion pinned `RecentIdeasPanel.tsx`, which this sprint
  deleted. Repointed at `MyIdeasList`; the **property** is unchanged and still asserted (a
  built idea opens on the proposal, never through the creation switch).
- **`check:lex-25d`** — "the ten §25.5 headings are the library" is now eleven. The count is
  still asserted rather than dropped: a check that stopped counting would stop noticing a
  heading appearing by accident, which is how a panel grows a section nobody designed.
- **`verify-recent-ideas-ui`** — replaced by `verify-my-ideas-ui`, which asserts more: that
  an untitled idea shows the user's words, that a real title wins, and that neither happens
  when it should not.

⚠ **`lib/lex/reranker.ts` is still untracked, another session's, and does not compile.** Not
on `Main`, not reachable from the app graph, not touched.
