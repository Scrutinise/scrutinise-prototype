# BRIEF — LEX 25-U: is the report fit to put in front of someone?

**Thread:** LEX. **Written:** 2 September 2026.
**Purpose:** Charlie wants to print the Civil Service Accountability proposal **today**, in its
fullest form, showing the questions that remain open, and show it to people.
⚠ **Nobody has ever read one of these documents end to end.**

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed. Batch the report. **Stop only for** spend
beyond a ceiling or a change of scope.

⚠ **This is a content audit, not a UI sprint.** The question is not whether the document renders. It
is whether a well-informed stranger reading it would find it credible, or would find something in it
that embarrasses the person who handed it over. **Read it as that stranger.**

⚠ **Take this up when 25-T §1 blocks on Charlie's Vercel change**, or run it alongside if 25-T is
waiting. Commit by explicit file path only; a CENTRAL session shares this repository.

**§1 and §2 are the sprint. §3 only if §2 shows it is needed.**

---

## §1 — The build has to run first, and there is a reason

⚠ **The policy sort has never run on any build in the database.** On this idea that means the
guiding-policy section is **21 candidates in a flat list, unsorted, with no reasoning and no history
lines.** A list of twenty-one approaches with no structure is, in Rumelt's own terms, the marker of
bad strategy — and it is the first thing a strategist reading this document will notice.

**1a. Run one full build on the Civil Service Accountability idea** — `452c5ade-3153-400a-bf48-3b71aaa52773`.
Report the cost and the balance before and after.

⚠ **1b. Establish first whether you can complete a build at all.** The build driver is currently the
browser tab: each pass is a separate call and the tab polls for the next. **If you cannot drive it
to completion server-side, stop and say so** — do not start a build you cannot finish, and do not
report a partial run as a build. Charlie will run it himself if you can't.

**1c.** Run `npm run backfill:challenge-source -- --write` afterwards. ⚠ Challenges written before
that change still carry the **"ANOTHER MODEL MADE THIS POINT"** prefix and no title, and they are the
most valuable content in the document. Report how many rows it touched.

## §2 — Read every generated document end to end and report what is wrong with it

Generate **every** document this idea can produce, for a fully-built idea, and read each one as a
reader. ⚠ **Report defects with the offending text quoted.** Not "the summary section is weak" —
the sentence, and what is wrong with it.

Look specifically for:

**2a. Internal working leaking outward.** 25-N fixed *"9 of 9 settled kernel fields carry no source"*
appearing in an outward-facing report. ⚠ **Report every remaining instance of a count, a field name,
a status word or a pass name that means something to us and nothing to a reader.**

**2b. Empty sections, and which kind of empty they are.** The standing principle is that a gap which
announces itself beats a gap that looks like an absence of evidence. **Report each empty heading and
what it currently says.** "Cost and duration — we can't answer this yet" is correct behaviour; a
blank heading is not.

**2c. The date flags at scale.** 315 of 501 evidence rows are five or more years old and now say so.
⚠ **Report how many such flags appear in the printed document and quote three.** The open question
is whether they read as useful caution or as noise, and nobody has seen them at length.

**2d. The unstructured list problem.** After the build, report **how the guiding-policy section reads
in the document** — grouped and reasoned, or twenty-one paragraphs in a row.

**2e. Challenges.** How many appear? Do they carry titles and a source line at the foot? ⚠ **There is
no way to show that a challenge has been answered** — the Respond flow is designed and unbuilt.
**Report how a reader would interpret 178 open issues with nothing marked as addressed.** That is a
content judgement and Charlie needs it before he hands the document to anyone.

**2f. Attribution and testimony.** Charlie's own words should appear as his, verbatim and attributed.
⚠ He asked for *"In Charlie's own words"* to be removed as a heading from the long report — **report
whether it is still there.**

**2g. Citations.** Take **ten citations at random** and check each resolves to something real.
⚠ Report any that do not. A single fabricated or dead citation in front of a think tank costs more
than every other defect in this list combined.

**2h. Draft status.** Both documents should say plainly that this is a draft of a proposal in
progress. **Quote what they actually say.**

**2i. Repetition and length.** Report the word count of each document, and any section that says the
same thing twice.

## §3 — The open questions, if they are not already in the document

Charlie wants the document to show **all the questions that need answering**. Report first whether
any existing document does this. ⚠ **If one does, do not build a second.**

If none does, add to the fullest document a single section listing:

- **Decisions still open** — what Lex has asked and Charlie has not settled.
- **Challenges not yet answered**, by section.
- **Known unknowns** — what the corpus could not answer, and what kind of gap each is.

⚠ **Every item states what would resolve it.** A question with no route to an answer is a complaint.

## §4 — Acceptance criteria

- Either a full build completed with its cost reported, or a plain statement that it could not be
  driven to completion.
- Every generated document read end to end, with defects quoted rather than characterised.
- Every instance of internal working appearing in outward-facing text is listed.
- Ten citations checked individually, with any failure named.
- The guiding-policy section's readability after the sort is reported as a judgement, not a count.
- A stated view on whether 178 unanswered challenges help or hurt the document.
- Word counts given.

## §5 — The bottom line Charlie needs

⚠ **End the report with a direct answer to one question: would you hand this document to a think
tank today?** If not, name the three things that must change first, in order. **An honest "not yet"
is worth more than a list of observations.**
