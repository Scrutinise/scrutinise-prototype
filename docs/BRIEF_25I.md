# BRIEF — Sprint 25-I: pilot readiness

**Thread:** LEX. **Written:** 26 August 2026.

## §0 — Run mode

**Continuous.** Where this brief says *diagnose*, diagnose it, record the finding in the CHANGE_LOG,
and proceed with the fix the diagnosis indicates — **including when the finding contradicts this
brief.** A contradicted premise is a line in the report, not a stop. Batch everything else into one
report at the end.

**Stop only for:** spend beyond the ceilings named here, or a change of scope.

**Shell:** CLAUDE.md §22 applies — logic in a file, run the file; no `cd` compounds with redirection;
no heredocs where `Write` will do.

**Browser: the extension works.** 25-H proved it — connected, signed-in session on production, text
extraction reliable. ⚠ Screenshots time out on the streaming build page (30s CDP limit); **use text
extraction, and do not report that as a blocker.** Walk the signed-in site for every acceptance
criterion that needs it.

---

## §1 — ⚠ Loading a page creates an idea

25-H's walk found that **the landing page auto-created a draft idea in Charlie's account** — nobody
asked for it. Two consequences, both bad: his idea list fills with things he did not make, and the
one place he goes to find his real work becomes unreliable.

**Diagnose and fix:** an idea is created when a person **starts one**, not when a page loads. If a
draft shell is needed to hold elicitation answers, create it on the **first answer**, not on render.
**Then sweep the accidental ones** — count them, report the count, delete them, and re-read each after
deletion.

⚠ **Re-read after deletion.** Three "deleted" verification copies survived five days because a
deletion was reported without being re-read, and two of them carried real titles, so they were
indistinguishable from Charlie's own ideas in any list. **A delete you did not re-read is a delete you
did not do.**

## §2 — Document upload: check it exists, then make it work

Charlie: *"I don't think the current UI has a doc upload option, please check we have that."*

25-H reported §4 as shipped. **Verify it on the live signed-in site before changing anything**, then
close whatever is still open:

- **A real file input** at "anything to read?", not a text box that records a filename.
  ⚠ `elicitation.ts` recorded *"Given to read, NOT yet read by Lex"* — honest code, broken promise.
- **Files and URLs both.** Extracted text stored, never the binary (§25.6).
- **Visible proof it was read** — what we took from each document, so a user can see it landed.
- **Findings appear under the question they answer**, marked as the user's own source, and are
  available to every drafting pass.
- **If a document cannot be read, say so at the time**, on screen.

**Charlie's private-sector accountability document is the test case** — it has now been lost twice.

## §3 — The build style on the ideas page

The door is flipped and `/ideas/new` resolves to the build flow. **Charlie expects to see the build
style in the normal ideas page**, with the additions he asked for in 25-H:

- **One visual language** from first question to last action — the build screen and the proposal are
  the same product, not two.
- **"Your account" (verbatim, never overwritten) and "The idea" (the agreed, edited version)** both
  visible. 25-H built the projection; **verify on the live site that editing one does not touch the
  other, and that a pill-edit refreshes rather than leaving a stale field.**
- **Panels collapse at stage one**, expand when they have content, restorable at any time, with a
  persistent route between build and proposal in both directions.
- **The "what we found that you didn't mention" box** on page one — Carltona, Accounting Officer, SRO
  — with unverified model-named terms listed separately and labelled.

**Report anything from 25-H §1–§7 that did not survive the walk.**

## §4 — Tell the user what they are about to spend and wait

CC's three pilot-stranger stumbles, and all three are one problem: **the product does not set
expectations before it takes them.**

**4a. Before the build starts**, say what it will cost and roughly how long — *"This takes about
[measured] minutes and uses one of your builds."* ⚠ **Nothing currently says a build costs money or
takes minutes until it is already running.** For a pilot with a paid allowance this is the difference
between a considered choice and a surprise.

**4b. The reuse choice must say what the research was.** *"Re-run using the research already gathered
— 94 findings, 81 cited sources"* against *"Search again from scratch."* Offering a cheaper option
without saying what it reuses is asking someone to choose blind.

**4c. Explain why "The idea" behaves differently** from the four fields above it — one sentence where
the user meets it, not in a FAQ.

## §5 — The measurement 25-H left open

**§7e's output side is unmeasured** — the six §25.7 qualities reach every drafting pass, checked and
controlled, but no build has run since. **Charlie has authorised the spend.**

Run **one** live build on a real idea, and report: whether the six qualities appear in the output, the
cost, the duration, and — since this is the first re-run since 25-G — ⚠ **the measured reuse saving**,
which is still arithmetic (141,926 of 217,687 tokens skipped) and not a figure.

**Ceiling: one build.** More than one is spend beyond this brief.

## §6 — Prepare, do not build: the citation pass

`HANDOVER_lex_citation_pass.md` proposes a fifth Deepening pass — *"you want to change section 3 of
the Equality Act; forty-one other provisions refer to it, and here is what each would need."* **It is
a genuine differentiator and it is not in this sprint.**

Two things to do now, both cheap:

- **Record Charlie's answers to its §5 decisions** when he gives them: placement (fifth pass, per the
  recommendation), volume ceiling (group first, drill down on request), cost, and re-run cache keying
  on coverage state.
- ⚠ **Note the constraint that shapes it**, from `OPEN_ITEMS.md` OI-16 and OI-18: markup-based
  citation covers **2–5%** of the cross-references actually in the text — 0% for CRaG 2010 — and
  93,772 act-name spans resolve to nothing. **Any count is a floor, and the coverage statement is
  mandatory and computed, never a hardcoded string.**

## §7 — Acceptance criteria

- Loading a page creates no idea; accidental drafts are counted, deleted, and **re-read after
  deletion**.
- A document can be uploaded at the new door, is visibly read, and its findings appear under the
  question they answer — **proved with Charlie's private-sector document.**
- One visual language throughout; "Your account" and "The idea" both present and independent; a
  pill-edit refreshes the projected fields; panels collapse and restore; the route between build and
  proposal works both ways.
- Cost and duration are stated **before** a build starts; the reuse option names what it reuses.
- One live build run; the six qualities assessed in the output; **the reuse saving measured, not
  calculated.**
- Walked signed-in on production, reported as a walk, with text extraction rather than screenshots.
- Delivery verified per §20 — `/api/health` gives an unauthenticated string to read back.
