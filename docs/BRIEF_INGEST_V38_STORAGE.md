# BRIEF — INGEST V38: WHAT IS THE STORAGE LIMIT, AND WHAT IS THE STORAGE FOR?

**Owner:** CC-Ingest **Stream:** INGEST **Written:** 16 August 2026 — **supersedes the earlier V38 draft, which was wrong about the premise**

**Where this sits:**

-   *Last:* V36 (legislation recovered and served) → V37 (the corpus audits itself) → 2D-2 (graph edges, built as views because a 17.5 GiB "line" said there was no room)
-   **This: V38 — establish what that line actually is, then reclaim what is genuinely redundant**
-   *Unblocked by this, in priority order:* the \~23,000 orphaned sections, the 117,667 false `pdf-only` rows, the \~288 broken R2 keys

***

## §0 — The correction, because it changes the shape of the whole brief

The earlier draft opened *"the database is full"* and made storage the first item in the queue. **Charlie checked the Neon console and there is no such limit on the plan we are on.** The Launch plan prices storage at **\$0.35 per GB-month, usage-based**, with no hard ceiling shown.

**So 17.5 GiB is a number of ours, not Neon's** — and it has been treated as a wall for a fortnight. It has already changed a design: 2D-2 built its edges as views rather than rows because 2.21 GiB "would not fit". That may have been the better call regardless — views over 2.5M rows are cheaper and just as correct — but **it was made against a constraint nobody had verified.**

⚠ **This is the failure this project keeps finding in other people's code, arriving in mine.** I took a figure out of the handoff and asserted it as a fact about the platform. It is an inference that travelled as a measurement, and the brief it produced would have stopped three pieces of real work to solve a problem that may not exist.

**§1 settles it. Nothing else here matters until it reports.**

***

## §1 — Find out what the limit actually is

Establish, with evidence rather than inference:

1.  **What Neon enforces on this plan.** Read the console or the API — not the handoff, not a comment, not this brief. Is there a hard storage ceiling at all, is there a soft one, and what happens at it?
2.  **Where 17.5 GiB came from.** Search the repository and the docs for it. Likely candidates: a limit from an earlier plan that was never revised, a monitoring threshold someone set, or a figure copied forward. **Whichever it is, say so** — a number nobody can source is worse than a number that is merely out of date.
3.  **What we currently pay for storage**, at \$0.35/GB-month against current usage.

**Report before doing anything else.** If there is no hard limit, this brief becomes housekeeping with a small cost attached, and the three blocked items start immediately.

***

## §2 — Reclaim what is genuinely redundant, because it is billed either way

Whatever §1 finds, storage costs money and redundant storage is worth removing. Carefully rather than urgently.

Measure first, per table and per index: size on disk, row count, and whether anything reads it. Specifically:

-   **What** `corpus_sections` **costs**, split between rows, indexes and TOAST. Recorded at 12.6 GiB of a then-15.93 GiB total; confirm that is still the shape.
-   **Which indexes have no reader**, with the evidence. The safest reclaim available: immediate, reversible, no table rewrite.
-   **Whether the body text is stored in the database at all, and whether anything reads it.** Every section carries an `r2Key` and the compiled text is in R2, so a database copy may be redundant. ⚠ **Find the readers; do not reason from the schema.** If something reads it, that is the finding.
-   **What** `LegislationSection` **costs** — recorded at 1.73 GiB, still undroppable, and the largest single thing we would like to remove.

Then, in this order, reporting after each:

1.  Drop the indexes with no reader.
2.  Ordinary maintenance on the largest tables. V36 deleted 89,377 rows and retracted the dot leaders, so there may be real space to return. ⚠ A full vacuum rewrites the table and needs the space to do it; a plain one does not. **Know which you are running.**
3.  **Only then** consider dropping a column, which needs a full-table rewrite.

⚠ **Predict the reclaim before each step and score it after.** "Expected 800 MB, got 40 MB" tells us where the space actually is. Unmeasured, it is a step that felt productive.

***

## §3 — The cost question, with both halves

If §1 finds no hard limit, the question is not *"will it fit"* but **"what will the corpus cost to hold, and is that the right trade?"**

Report: current spend at current usage; projected spend if the corpus doubles; and what the Scale tier adds beyond storage — it carries a support arrangement and an uptime commitment that may matter more than the compute as the platform approaches a pilot.

**Give the figures. The decision is Charlie's and it is a business one, not a technical one.**

***

## §4 — Then unblock the queue

None of these should wait on §2 or §3 once §1 reports there is room:

1.  **The \~23,000 sections held only in the legacy table** — S3's finding. The amending instruments' own provisions, whose corpus copies are incomplete. A real corpus gap of a class nothing reports, and the last thing standing between us and dropping `LegislationSection`.
2.  **The 117,667** `pdf-only` **rows** carrying a classification measured as false on 0 of 52 samples.
3.  **The \~288 sections pointing at R2 objects that do not exist.**

⚠ **Item 1 is the one with product consequences** and should go first. The others are hygiene.

***

## §5 — Standing

**Do not shrink work to fit a constraint without first verifying the constraint.** 2D-2 did the right thing on the evidence it had, and the evidence was mine and unchecked. The rule that would have caught it is already in the playbook: *a number without a source is not a measurement.* Apply it to numbers that arrive in briefs, including this one.
