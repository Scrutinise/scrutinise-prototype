# BRIEF — Sprint 25-H: one flow, the user's own words, and pilot-ready

**Thread:** LEX. **Written:** 25 August 2026.
**Source:** Charlie's third build of the accountability idea, walked with the new door live.

**Where we are.** The content is working. The third build produced 94 findings, 81 cited sources,
Carltona with three judgments behind it, the Accounting Officer and SRO regimes, the Public Service
(Integrity and Ethics) Bill, and one genuinely valuable legal finding — ⚠ *the Carltona principle can
be ousted by specific statutory language (Forsey)* — which changes what is legislatively possible and
which none of four public chat models found. Unverified model-named terms are correctly labelled and
excluded from citation. **None of that is in scope here.**

**This sprint is about the container.** There are now two page ones, the user's own words are lost
after the build, the pill buttons do nothing, and an uploaded document had no visible effect. **The
goal is pilot-ready: a stranger can complete this without being told how.**

Run mode: **continuous**. Where the brief says diagnose, diagnose it, record the finding in the
CHANGE_LOG, and proceed with the fix it indicates. Batch everything else into one report. Stop only
for spend beyond the ceilings or a change of scope.

Standing rules: **`commit-lex-25h.sh`**; scoped paths; controls watched failing first; clean-package
build before push; delivery verified per §20 — **and the extension now has host permission for
scrutinise.org, so walk the signed-in site and report the walk as a walk.**

---

## §1 — One flow: the new page one replaces the old one

Right now the build asks four questions and fills the kernel, while the proposal page still shows the
**old** Page 1 fields — *The idea*, *You + the idea* — sitting **empty**, because nothing writes them
any more. Charlie: *"we should replace the old P1 fields with the new P1 fields, which I can no longer
find."*

- **The elicitation is page one.** Its answers are the page-one fields, shown in the proposal in the
  same format as every other stage, editable in place.
- **Retire the old fields** — do not leave empty boxes that nothing fills. Migrate any content in
  existing ideas across; report the count.
- **Same format throughout.** The build screen and the proposal must not look like two products. One
  visual language, one navigation model, from the first question to the last action.

## §2 — Keep what the user wrote, separately from what we made of it

⚠ **Charlie's requirement, and it is a provenance rule, not a UI preference.**

Two distinct fields, both retained permanently:

- **"Your account"** — the user's own words, **verbatim, never edited, never overwritten.** This is
  testimony. It is what makes the proposal theirs, it is the thing §24's reviewers and any MP's office
  would want to see, and it is currently discarded the moment the build runs.
- **"The idea"** — the agreed, edited statement of the problem. Lex proposes it *from* the account;
  the user edits and accepts it; it is what the rest of the kernel is built on.

Both are visible on the proposal. **Editing the second never touches the first.** Where the account is
used as evidence elsewhere (as `legalLandscape` already does well), it is attributed to the user.

## §3 — The pill buttons must reopen what they name

*"None of these pill buttons work. They should show up the initial data I wrote in so I can edit that
before I do a rebuild."*

- Each pill — **The problem · What you want · What you know · Anything to read · Confirm** — opens
  that answer, populated with what the user wrote, editable.
- Editing an answer and rebuilding is the natural iteration loop, and it connects to 25-G's reuse
  rule: ⚠ **a changed elicitation means the research is re-run, not reused.** The screen must say which
  is happening and what it will cost.
- Confirm re-runs only the confirmation, as in 25-E.

## §4 — Documents and sources: diagnose first, this is a silent failure

*"There's nothing here about accountability in the private sector despite my adding a whole word
document about it."* And: *"I don't see where 'documents added' and 'sources added' are."*

**Diagnose the chain and report where it breaks:** was the document stored? was its text extracted?
were findings produced from it? did those findings reach any pass? ⚠ **A document accepted and never
used is a silent failure and the worst kind** — the user believes we have read it.

Then:

- **An explicit place to add documents and URLs**, on page one and available later, showing what has
  been added.
- **What we took from each** — the findings extracted, so the user can see the document was read.
- **Findings from user documents appear under the question they answer**, marked as the user's source
  (§25.6), and are available to every drafting pass.
- If a document cannot be read, **say so plainly at the time.**

## §5 — Progressive disclosure: fewer panels at the start, an easy way back

Charlie: *"perhaps it's cleaner to minimise the RH panel when in this first stage, even collapse the
middle and right hand panels at first, but there should be an easy and clear UI to get them back or to
move back and forth."*

- **Stage one is the conversation.** The proposal and legislation panels collapse to slim, labelled
  edges — present, not absent, so the user knows what is coming.
- **They expand automatically** as the build completes and there is something in them.
- **A persistent, obvious control** to collapse and restore each, and to move between the build and
  the proposal in both directions (25-G §2 — verify it survives this change).
- **Returning to a built idea lands on the proposal.**

## §6 — A page-one box for what the research discovered

Charlie: *"There should also be in that P1 page, an additional box listing anything new discovered in
the model research."*

A short **"What we found that you didn't mention"** block on page one: the terms of art, statutes and
regimes surfaced that the user never supplied — Carltona, Accounting Officer, SRO — each one line,
each linking to its findings. **Unverified model-named terms are listed separately and labelled**, as
they already are in the build output.

This is the clearest single demonstration that the platform did something the user could not, and it
currently exists only buried in the build log.

## §7 — Six smaller defects from the walk

**7a. The map view does not work** — only the list renders. *(The causal tree, §16.2.)*

**7b. Title and keywords lean on the wrong subject.** *"It's not about ministerial responsibility
other than as an issue to overcome — it's about civil servant responsibility."* The generated title
and keywords should follow **the user's stated goal**, not the dominant term in the retrieved
material.

**7c. The obvious cause is missing.** Charlie: *"because civil servants like cushy jobs with power but
no responsibility, and there are no mechanisms to put responsibility on them, and the entire culture
is designed to provide endless excuses."* The drafted causes are institutional and structural; the
plainest human one is absent. **Cause generation should include the incentive-and-culture reading, in
plain terms, not only the constitutional one.**

**7d. The coherence check's sequencing is unclear** — *"I guess I have to go through and approve and
save before the coherence check can be carried out?"* Whatever the answer, **the screen must say it**:
what is waiting, on what, and what the user must do to release it.

**7e. Verify §25.7's six qualities are reaching the output** — causal chain over inventory, the
counterintuitive finding, the finding rather than the citation, the instrument reframe, a test the
user can apply, a next action.

**7f. Do not disturb** the "cuts against the draft" findings, the unverified labelling, or the smart
pass's critique and cuts. They are the best output the platform produces.

## §8 — Acceptance criteria

- One visual language and one navigation model from first question to last action; no empty legacy
  page-one fields anywhere.
- **"Your account" holds the user's verbatim words and is never overwritten**; "The idea" is the
  edited version; both visible; editing one does not touch the other.
- Every pill reopens its answer populated and editable; rebuilding after an edit re-runs the research
  and says so, with the cost stated.
- The document chain is diagnosed end to end and the break named; a document can be added, is visibly
  read, and its findings appear under the question they answer.
- Panels collapse at stage one, expand when they have content, and can be restored and moved between
  at any time.
- Page one shows what the research found that the user did not supply, unverified terms separated.
- Map view renders; title and keywords follow the user's goal; causes include the incentive reading;
  the coherence check states what it is waiting for.
- **Walked signed-in on production and reported as a walk** — the extension now has permission.
- **The pilot test: a stranger completes an idea end to end without being told how.** If any step
  requires explanation, name it in the report.
