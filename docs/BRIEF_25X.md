# BRIEF — LEX 25-X: every build starts from what the last one learned

**Thread:** LEX. **Written:** 2 September 2026.
**Source:** Charlie's decisions 54, 58, 59 and 60, and a new product instruction in his own words:

> *"Taking everything we now know, let's run it all through again" — so the quality should increase
> with each build.*

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the report. **Stop only for** spend beyond a ceiling or a change of scope.

⚠ **§1–§3 are the approved decisions and are the sprint. §4 is a design section: report and propose
before building any of it.** It changes what a build *is*, and Charlie should see the shape before it
exists.

⚠ **CLAUDE.md §25–§28 apply.** Note §28's newest member from the CENTRAL session: **a verification
step that cannot report failure is not one** — a build check reported exit 0 while the build had
panicked, because it was piped through `tail`.

⚠ **A CENTRAL session shares this repository.** Commit by explicit file path only. Never
`git add -A`, never `commit-all.sh` without printing the file list first — **that mechanism has now
caused cross-contamination in both directions today.**

**Also outstanding and yours to confirm:** `scrutinise-web/package.json` and
`scrutinise-web/prisma/schema.prisma` are dirty in the shared tree with no confirmed owner. **Read
the diff. If it is 25-W's `emailOnBuildComplete` default and your own script registration, claim them
and commit by explicit path. If it is not yours, say so** — do not guess, and do not leave them.

---

## §1 — Decision 59: a build must not destroy an acceptance

**Measured on the scratch idea:** an accepted `rootCause` and an accepted `chosenApproach` both
reverted to awaiting-confirmation. The text survived; the acceptance did not, and the user was told
nothing.

**Charlie chose option (c). Build it:**

**1a. An accepted field is not overwritten by a build.** The value the user accepted stays.
**1b. The build's new version is written beside it as a proposal**, in the pattern already on screen —
*PROPOSED BY LEX — REFINE*. The user takes it or leaves it.
**1c.** ⚠ **The rejected option, and why, so nobody rebuilds it later:** simply guarding the status
would leave a field marked ACCEPTED whose text had changed underneath — **the user recorded as
having agreed to words they never read.** That is worse than losing the acceptance.
**1d. Assert both directions:** an accepted field survives a build with its value intact **and** the
new proposal is present and visibly distinct.

## §2 — Decision 60: a user's root-cause mark is a user decision

The revise pass deletes causes whose source is `LEX_CORPUS`, and a root-cause mark on one of those
dies with the row.

⚠ **The row was written by Lex; the mark is the user's.** A user decision attached to a
machine-written row is still a user decision.

**2a. Protect it.** Either exclude marked causes from the revise deletion, or re-mark the replacement.
⚠ **Report which is safer and why before building** — re-marking assumes the replacement is the same
cause, which may be false.
**2b.** If the cause genuinely no longer exists after a revise, **say so on screen** rather than
silently unmarking. The user chose it; they should learn if it has gone.

## §3 — Decisions 54 and 58: the challenge cleanup, at a tighter bar

**Approved: the 43 promotions.** Apply them, marked with the draft each was raised against.

⚠ **Re-run the DUPLICATE and SUPERSEDED classifications at a tighter bar** — about 6.4p, and worth it.

**3a. DUPLICATE must be a point-level match, not a topic-level one.** Your own example —
*"Statutory individual legal duties"* archived under *"Interaction with the Constitutional Reform
Act"* — is plausible and not obviously the same objection. ⚠ **119 is a great deal of criticism to
retire on "plausible".** The challenges are the sharpest thing the platform produces; a real one lost
to a loose match costs more than a duplicate left in.
**3b. Add a third state: POSSIBLY DUPLICATE.** Topic match without point match stays visible, marked.
**3c. SUPERSEDED must distinguish a criticism from an assessment.** Two of the six rows you sampled
were older *positive* judgements — *"the sequencing is logical"* — which the current set contradicts.
⚠ **That is not a criticism aimed at deleted text and must not be archived as one.**
**3d. Apply the 7 merge groups.**
**3e.** ⚠ **Report the new counts against the old before writing**, so the effect of the tighter bar is
visible.

⚠ **Not a defect, worth recording:** four challenges all say there is no guiding policy and four all
say no pivotal obstacle is identified. **They are correct** — none is committed — and they will
disappear when one is. That is the adversarial pass telling the truth four times, not noise.

## §4 — The cumulative build. Report and propose; build nothing yet.

**Charlie's instruction:** *"Taking everything we now know, let's run it all through again."* A second
build should be better than the first **because of what the first found**, not merely more recent.

Today a full build re-searches from nothing and a re-run skips search entirely. ⚠ **Neither learns.**
Searching from nothing while ignoring what the last pass discovered is the wasteful option, not the
thorough one.

**4a. Report what the previous build produces that could improve the next search.** At minimum
consider, and say for each whether it is available and what it would cost:

- **The terms of art the cross-model expansion surfaced** — Carltona, Osmotherly, Accounting Officer,
  SMCR. ⚠ **Rediscovering these every build is pure waste; they are the platform's best trick.**
- **The diagnosed causes** — searching against each cause is sharper than against the raw idea.
- **The candidate guiding policies** — precedent for each specific approach.
- **The challenges** — each names a weakness, and evidence on a named weakness is high-value.
- **The known unknowns** — *questions the research could not answer* is already a search list.
- **The instrument** — once the vehicle and the parent Act are known, its statutory family is
  searchable.
- **The citation graph** — ⚠ over a million verified edges exist and Lex does not use them. Report
  whether the coverage contract now permits it, or what is still missing.

**4b. Report the risks honestly, and one of them is serious.** ⚠⚠ **Quality does not increase
automatically. A build that starts from the last build's frame can entrench the last build's
mistakes** — a term read wrongly in pass one becomes a search term in pass two and evidence in pass
three. **Propose how a later build can contradict an earlier one**, and how the user is told when it
does. *Where the research changed my mind* already exists as a section; it may be the right home.

**4c.** ⚠ **The user's own words remain the anchor.** Their testimony, verbatim and attributed, and
their uploaded documents are inputs to **every** build, not just the first. **Confirm this is already
true and say so; do not assume it.**

**4d. Report the cost.** A full build is 37p today. Say what the cumulative version would cost, and
whether it replaces the full build or becomes a third mode.

**4e.** ⚠ **Prerequisite: decision 54 must land first.** A build that searches more will produce more
challenges, and challenges already accumulate across every build — 225 from nine drafts before the
cleanup. **The version filter is what makes a cumulative build survivable.**

## §5 — Before Charlie rebuilds the accountability idea

He has settled nothing on it deliberately, but has **pressed buttons at random while testing**.

⚠ **With §1 built, a randomly accepted field would be frozen against improvement** — protected
exactly as if he had meant it.

**5a. List everything currently accepted, marked or ruled out on
`452c5ade-3153-400a-bf48-3b71aaa52773`**, so he can clear anything he did not intend.
**5b. Do not clear anything yourself.** Show him the list.

## §6 — Acceptance criteria

- An accepted field survives a build with its value intact, and the build's version appears beside it
  as a proposal, visibly distinct. Both asserted.
- A user's root-cause mark survives a revise, or the user is told it has gone.
- The tighter classification is reported with new counts against old before anything is written.
- POSSIBLY DUPLICATE exists as a state and those challenges remain visible.
- No positive assessment is archived as a superseded criticism.
- §4 is reported and proposed, not built, with costs and the entrenchment risk addressed.
- The list of accepted and marked items on the accountability idea is shown to Charlie, unchanged.
