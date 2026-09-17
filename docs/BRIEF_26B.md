# BRIEF — LEX 26-B: the instrument comes out of the kernel, not in before it

**Thread:** LEX. **Written:** 17 September 2026.
**Source:** Charlie's decision of 17 September, following Angus Barry's pilot feedback.

⚠⚠ **This supersedes decision 78.** That decision made the user's stated method binding on the
output. Charlie has since concluded the question should not be asked at all: *"the question of whether
they want a legislative or operational solution is a holdover from the earlier version when we asked
the user to draft the kernel. Decisions about whether the coherent action should be legislative or
operational should come out of the strategy kernel, not be a pre-condition."*

**Do not build decision 78's design.** Build this instead.

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the report. **Stop only for** spend beyond a ceiling or a change of scope.

⚠ **§1 is a report before it is a build.** Charlie asked whether the product already works this way.
**Answer that first, section by section, before changing anything** — he expects most of it does not.

⚠ **Blocking and not in this sprint: the two contamination bugs.** Charlie's testimony in the build
prompts, and the account overwrite. **Nothing here is worth building on top of a diagnosis that
describes somebody else's idea.** Say in this report whether they have shipped.

⚠ **CLAUDE.md §25–§28 apply.** Read-back list for every string. A CENTRAL session shares this
repository: explicit file paths only.

---

## §1 — Report what exists today, before building

For each of §2 to §5, state plainly whether the product already does it, partly does it, or does not.
⚠ **Quote the current wording and name the files.** Charlie's question was *"check if that is the
case"*, and the answer is worth more to him than the build.

## §2 — The method question comes out of the elicitation

**The initial questioning asks two things and no more:**
1. **What is the problem you want solved?**
2. **Anything you want to add about what you are looking for** — free text, optional.

⚠ **The second is testimony, not a switch.** If a user writes *"I want a legislative amendment"*, that
is their words, kept verbatim and carried into every pass as testimony. **It is not a flag, it does
not gate retrieval, and nothing branches on it.**

**2a. Remove `goalKind` and `intent` from the elicitation.** ⚠ CC has twice measured both as
decorative — read as a label line in four prompts, branched on nowhere. **Report every place they are
read before removing them**, and what each prompt looks like without the line.
**2b.** ⚠ **Report what else the elicitation currently asks and whether it survives this.** Charlie
named two questions; the current flow has five steps. **Do not delete anything he did not name —
report it and let him decide.**

## §3 — Coherent actions evaluate three avenues, always

**Every kernel evaluates a combination of legislative, organisational and financial routes.** The
instrument is an output of the strategy, not an input to it.

⚠⚠ **And the whole design fails unless each is worked to the same depth.** Angus's complaint was that
he asked for legislation and received administration. The cause was measured: **the smart pass
softened or deferred the legislative step in 7 of 31 action rewrites**, because Rumelt rewards
feasible concentrated action and administration is always more feasible than legislation.

**Three avenues evaluated unequally is the same defect with better manners.** If the legislative route
is only ever sketched before being judged hard, the user gets the same answer they got before.

**3a.** Each avenue is drafted, costed for difficulty, and its trade-offs stated — **to comparable
length and specificity.** ⚠ **Assert that**: report the median length of each avenue's treatment
across builds, and flag any systematic shortfall.
**3b.** ⚠ **An avenue that genuinely does not apply says so and says why** — a gap that announces
itself. It is not silently omitted.
**3c.** ⚠ **The existing-power question stays and moves.** *"Is there an existing power that removes
the need for a Bill?"* is the best question the platform asks. It now belongs to the legislative
avenue's evaluation, as a finding. **The line telling the revise pass "This must be reconsidered
before anything else" goes** — that is what turned a finding into an override.

## §4 — The choice between the avenues is a question, not a decision Lex makes

**The choice goes in the Initial Questions document**, as a decision for the user, with what each
avenue rules in and rules out.

⚠ **It follows the rule the document already enforces: every item states what would settle it.**
For this one that is usually evidence — what would have to be true for the legislative route to be
worth the difficulty.

## §5 — The first pass delivers a complete draft kernel and says what is missing

**5a.** The first pass fills in as many gaps as it can and produces **a draft kernel that is complete
in shape** — every field drafted, subject to the questions it raises. ⚠ **Report whether it does.**
25-F found four kernel fields never drafted at all, and `costSummary` was later measured as starved.

**5b. The user is told plainly what to do next**, in one message they cannot miss: go through the
questions, answer them, and then re-run so the next pass searches on what you have added.

## §6 — The re-run sits beneath a checklist

**Charlie's design:** the re-run control sits **below a clear checklist with checkboxes** — *I have
read the briefing · I have answered the outstanding questions · …* — drawn from the idea's own
state, not a fixed list.

**6a.** Each item reflects something real and countable: questions answered of questions posed,
challenges responded to, kernel fields settled. ⚠ **A checkbox that is always unticked teaches the
user to ignore it.**
**6b.** ⚠ **Report, do not decide: should an unticked checklist prevent the re-run, or only inform
it?** Recommend informing only — a user spending their own allowance early is entitled to. **Put it
to Charlie.**
**6c.** The allowance line stays where it is, with the control.

## §7 — Two carried items

**7a.** ⚠ **`readKnownUnknowns()` drops the gap's kind, so the agenda files every corpus gap as
research the user must do.** A search that found nothing is being presented to the user as their
homework. **One line, and it inverts the gap-announces-itself principle. Fix it.**

**7b. Angus's rebuild, in CC's own order and no other:** restore his account from
`aiChatHistory[1]`, take the four quotations out of the prompts, **then** re-run. ⚠ **A rebuild
before the first two repeats the contamination.**

## §8 — Acceptance criteria

- §1 answers, for each section, whether the product already does it, with wording quoted.
- The elicitation asks the problem and an optional free-text addition; nothing branches on either.
- Every build evaluates legislative, organisational and financial avenues, to comparable depth, with
  the median length of each reported.
- An inapplicable avenue states that it is and why.
- The choice between avenues appears in Initial Questions with what each rules out and what would
  settle it.
- The existing-power finding sits within the legislative avenue and overrides nothing.
- The re-run control sits beneath a checklist drawn from the idea's own state.
- A corpus gap is no longer presented as the user's research to do.

## §9 — Say what only Charlie can confirm

⚠ **And say plainly whether, after this, a user asking for a legislative route would recognise the
answer as one.** That is the question Angus actually raised, and no check can answer it.
