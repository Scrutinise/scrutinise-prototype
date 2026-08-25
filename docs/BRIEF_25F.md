# BRIEF — Sprint 25-F: the smart pass, and why the first real build read worse than it was

**Thread:** LEX. **Written:** 24 August 2026.
**Source:** the first build ever completed by a human — Charlie's civil-service accountability idea,
build `a7f7151c`, 7 passes, 5m 14s, 107,380 in / 21,446 out, **6.78p** — read together with the full
kernel dump (`docs/LEX_FIRST_BUILD_KERNEL.md`, 287KB).

*(Supersedes the earlier part-1/part-2 drafts; those were written before the field-level dump was
available and part of part 1 was wrong. This is the whole brief.)*

---

## §0 — What actually happened, because the summary and the data disagree

**The machinery worked.** Seven passes ran. Forks and their alternatives were recorded. The
contradiction was kept. **The existing-power check fired on a real idea for the first time** — it found
CRaG 2010 s.3(1) confers on the Minister for the Civil Service the power to manage the civil service,
and told the user to decide whether he needed an Act at all. "What I'm least sure about" produced six
specific, real uncertainties.

**And the research was good.** The dump shows **70 evidence items** with genuine citations: CRaG 2010
ss.1–3 *with Explanatory Note paragraph numbers*, Public Bodies Act 2011 ss.1 and 8, the Constitution
Committee's *6th Report — The accountability of civil servants* (2012), PASC's *Who's accountable?
Relationships between Government and arm's-length bodies* (2014), NAO major-projects material, Hansard
from 2008 and 1994. **Several of those are things four public chat models did not find** when the same
question was put to them.

⚠ **None of it was on the screen the user read.** He saw abstract causes — *"incentives encourage
diffusion of responsibility"* — and a bag-of-words search query. The committee reports, the statutory
citations and his own testimony were sitting in field proposals the summary never displayed. His
verdict, *"weaker than a single ChatGPT query"*, was a fair judgement of **what he was shown** and an
unfair one on what was built.

**So the ordering of this brief is deliberate: §1 (presentation) is the cheapest and most valuable fix,
because the content already exists. §2 (the smart pass) is the largest. Everything else is
supporting.**

Standing rules: audit-then-build; **`commit-lex-25f.sh`**; scoped paths; checks watched failing first.
⚠ **Item zero: if the pre-push clean-package build check from `URGENT_BUILD_BROKEN.md` §3 still does
not exist, build it first.** Two multi-day production outages have been caused by its absence.

---

## §1 — Put the good material on the screen

- **Cited findings and named sources lead. Abstractions follow.** *"The Constitution Committee reported
  on exactly this in 2012"* is worth more than *"incentives encourage diffusion of responsibility"*,
  and currently only the second reaches the user.
- **The most important references and case studies go at the top.** Everything else is a footnote or a
  reference list, not a peer. §2 identifies which is which; this section acts on it.
- ⚠ **The summary screen must show what was actually drafted.** A build that produces a cited legal
  landscape and displays a keyword soup is misrepresenting its own work.
- **Delete the rubbish** rather than rendering everything at equal weight.

**Verify by rebuilding Charlie's idea and reading the screen he will actually see** — not the dump.

## §2 — The smart pass

Charlie's design. A new pass, **after revision and before the agenda**, that reads the whole kernel and
asks what nothing currently asks.

**2a. What goes out.** ⚠ **The whole of page one — not a ten-word mashup.** The problem in the user's
words, their first-hand knowledge, their goal and their ruled-outs, verbatim and unsummarised. And
**ask for a Rumelt-shaped response**: diagnosis, guiding policy, coherent actions — so what comes back
is directly comparable to ours.

**2b. The other models are query generators AND answer sources.** Both roles, not one:

- **As answer sources** — their Rumelt-shaped answer is compared against ours.
- **As query generators** — every statute, doctrine, regime, case and mechanism they name becomes a
  corpus query, and what the corpus returns is cited. ⚠ **This is how a user gets terms of art they
  have never heard of.** A user says *"nobody is accountable"*; the field says *Carltona*,
  *Osmotherly*, *Accounting Officer*, *Senior Responsible Owner*. **The models supply the vocabulary;
  the corpus supplies the authority.**
- Anything the corpus cannot confirm is kept and **labelled unverified** — never asserted, never
  dropped. The never-claim rule is unchanged; this widens what we look for, not what we claim.

**2c. The coverage check.** Every substantive point in a model's answer is either present in our
kernel, or becomes an issue on the agenda saying what we missed. ⚠ **This is the direct defence
against the one outcome §25 says would mean we had failed** — a user getting a better answer by typing
the question into their own chat window.

**2d. The critique — this is what "smart" means.** In the user's own terms:

- **Is this a good kernel by Rumelt's standards? Critique it. Rewrite it if it is bad.**
- Are the choices at each fork the best available ones?
- Are the most important references and case studies at the top? **Is there rubbish to delete?**
- **How hard will this be to pass** — as a law, or as an implemented organisational change?
- What are the **barriers and challenges**, and how likely is it to succeed?
- **What is most likely to go wrong?**

The first is a **rewrite mandate, not a comment**: where the kernel fails Rumelt's tests, this pass
fixes it and records what it changed, in the same shape as the revision pass's *"where the evidence
changed my mind."*

**2e. Model selection.** ⚠ The adversarial pass ran on **`gemini-2.5-flash`** — the cheapest model we
have, on the pass where reasoning strength matters most, producing 407 output tokens for six issues.
`gemini-2.5-pro` is reachable; Anthropic and OpenAI keys are set. **Choose per pass on the job it is
doing** — cheap for extraction, strong for adversarial reading and verification — and **report which
model ran each pass**. The whole build cost 6.78p; **a build that produces something worth an MP's
attention can afford 30p.** Spend it where it changes the output.

⚠ **Is this Lex or Search?** **Lex.** §25.8 settles it — *Lex owns the questions and their timing;
Search owns retrieval quality; the intent is the contract.* Everything here is question-asking,
sequencing and judgement over material already retrieved. The one part touching Search is 2b's
recycled queries, and those go through the existing gateway like every other caller. **Build it here;
tell Search what changed about the queries being issued.**

## §3 — Nothing verifies anything: two more passes

The hostile clerk asks *"where is this weak?"* — a lesser question than *"is this a kernel at all?"*

**3a. Kernel compliance**, mechanically, against the method layer (§16.3): is the problem stated as a
problem rather than a solution; does the diagnosis name a **pivotal obstacle** distinct from the root
cause; does the guiding policy **rule things out**, or is it compatible with any action; does it have
**leverage** — does it hit the named obstacle or merely act nearby; do the actions **defeat the
diagnosed causes** and cohere with each other; is any bad-strategy smell present (fluff, failure to
face the problem, goals mistaken for strategy, impracticable objectives). Each failure is an issue
naming the text that fails it. **This should not be a cheap pass — it is the standard the product
claims to hold users to.**

**3b. Logical consistency.** Does the chain hold — causes → obstacle → approach → actions?
Non-sequiturs, circularity, claims that do not follow, assertions with no support.

**And apply §25.7, which was specified and is not being honoured.** The drafting passes should produce
a causal chain rather than an inventory; the counterintuitive finding where one holds; the finding
rather than the citation; a reframe of the instrument where it is wrong; a test the user can apply;
a next action. **None of the six is visible in this build.**

## §4 — The query is a bag of words

Pass 1 reports **"231 sources read; 0 cited."** The query it issued:

> `B_CONTEXTUALISED :: civil service public failure accountability responsibility cost deliver sector
> process accountable those system pr`

That is a truncated term-frequency dump of the user's own prose — it contains *"those"* and ends
mid-word at *"pr"*. **Diagnose before fixing**: a `terms()` builder stripping stopwords from user
text, a character-limit truncation, or both. Then:

- **A query is written, not extracted** — each library question builds a purposeful query for its own
  job.
- **No query is ever truncated mid-word**; a truncated query is logged as such.
- Assert in a check that no issued query ends mid-token or is a stopword-bearing keyword dump.

*(§2b is the deeper fix — the vocabulary problem cannot be solved by better extraction from a
vocabulary that does not contain the right words.)*

## §5 — The user's testimony reaches one field, not the kernel

`legalLandscape` uses it well — *"Based on the user's testimony…"*, working through the diffusion of
responsibility, the legal advisers refusing to communicate, and promotion after failure. **That is
working; do not rebuild it.**

But the causes, the pivotal obstacle and the summaries are abstract restatements of the user's own
sentences. **Make the elicited testimony available to every drafting pass, verbatim, with the prompt
saying what it is for:** first-hand evidence the record does not contain — use it, name it, let it
shape the diagnosis. **A concrete instance beats an abstraction wherever it fits**: a cause that can
cite *"four years to do what a private solicitor did in an afternoon"* is a better cause than one that
cannot. Attribute it to the user wherever used.

## §6 — Three defects in the data

**6a. Loop fields propose empty strings.** `causes`, `actions`, `policyOptions` sit at
`AWAITING_CONFIRMATION` carrying `{"value": "", "rationale": null}`. The real content is in the child
tables, so nothing is lost — but **an empty proposal claims something was proposed when nothing was**,
which is the never-claim rule broken inside the field machine. Either the proposal renders the child
rows, or the field does not enter `AWAITING_CONFIRMATION`. **Diagnose and report which.**

**6b. Four kernel fields were never drafted** — `anticipatedResponses`, `conditionsForSuccess`,
`coherenceCheck`, `costSummary`, all EMPTY with no proposal. ⚠ These are not optional: **conditions
for success and anticipated responses are two of Rumelt's three tests for a guiding policy**, and the
coherence check is what separates coordinated actions from a list. **Establish whether they were
skipped, failed, or never wired.**

**6c. The instrument fork lists the same alternative twice**, verbatim — the duplicate-fork bug
`persistForks` de-duplicated in 25-A, returned. And the chosen approach appears as **two separate
forks** with different alternatives, reading as confusion rather than choice. **Diagnose whether these
are the same defect.**

## §7 — A completed build must be findable

Charlie logged out and could not find the idea his build had produced; the spend view shows build
ideas as *"Untitled idea"*. **Every build produces a titled, listed idea, and the build screen links
to it.** ⚠ A five-minute build the user cannot find again is worse than no build.
*(The temporary previous-ideas panel is a good stopgap; this is the durable fix.)*

## §8 — Acceptance criteria

- **The summary screen leads with cited findings and named sources** — verified by rebuilding
  Charlie's idea and reading the screen he will actually see, not the dump.
- The smart pass sends the whole of page one, unsummarised, and requests a Rumelt-shaped response.
- Every entity another model names is issued as a corpus query; the build reports how many became
  **cited findings** and how many remain **unverified**.
- The coverage check produces an issue for each substantive point in a model's answer that our kernel
  does not address.
- The smart pass critiques the kernel against Rumelt's tests, **rewrites it where it fails**, and
  records what it changed and why.
- It answers, in the output: how hard this will be to pass, the main barriers, the likelihood of
  success, and what is most likely to go wrong.
- Kernel-compliance and logical-consistency passes run; their failures appear as issues.
- Each pass reports its model; adversarial and verification passes do not run on the cheapest one.
- No issued query ends mid-token or is a stopword-bearing keyword dump; **pass 1 cites sources** on
  the rebuild — it currently cites 0 of 231.
- The user's testimony is referenced in more than one drafted field, attributed to them.
- No field sits at `AWAITING_CONFIRMATION` with an empty proposal; no fork lists the same alternative
  twice; the four empty kernel fields are covered or the reason stated.
- The built idea is titled, listed and linked from the build screen.
- ⚠ **The single measure of whether §2 and §4 worked: the rebuild surfaces at least one term of art
  Charlie did not supply** — Carltona, Osmotherly, Accounting Officer, SRO or equivalent.
