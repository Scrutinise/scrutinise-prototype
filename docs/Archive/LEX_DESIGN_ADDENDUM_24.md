# Append to LEX_REBUILD_DESIGN.md — §24 (and the replacement of §22.3)

*(Design, for Charlie's review. Prompted by his 11 Aug critique of the depth thermometer, which was correct:
the 1–5 levels conflated progress, effort and credibility, and a self-awardable scale measuring "work done"
was being asked to carry a meaning — "trust this" — that it cannot honestly carry. §22.3 is superseded by
§24.1–24.2 below. §22's passes, issues list, and team roles are unchanged.)*

---

## 24. Credibility: the Scrutinise Review

### 24.0 The principle: separate what got conflated

Three different questions were being answered by one scale:

| Question | Nature | Honest form |
|---|---|---|
| **How far along is this?** | Workflow | A stage label |
| **How much is verifiable?** | Countable fact | Numbers, machine-derived |
| **Should a stranger trust it?** | Judgment | **Attributed human assessments, weighable by the reader** |

The design rule that follows: **numbers for what can be counted; named humans for what must be judged; never
a number that launders a judgment.** A single star rating is exactly such a laundering — Charlie's
brother-in-law point in one line: a "full review" is worth what its reviewer is worth, and no scale can
carry that. Only attribution can.

And the direct answer to "if we are really after quality, what is the best way of achieving it?" — quality
does not come from a score. It comes from a **loop**: hard findings → fixes → verified re-review. Everything
below is machinery for running that loop and making its results visible. The metric is the residue of the
loop, never a substitute for it.

### 24.1 Progress (replaces thermometer-as-progress)

A plain stage label on the idea, matching how the work actually proceeds:

**Skeleton** (kernel pages complete) → **Deepened** (deepening passes run and worked) → **Team-reviewed**
(worked with a private team/group) → **Published** (§20.3 visibility). Formal review sits **parallel** to
this track, exactly as Charlie said — it can happen at any stage and is not a stage itself.

Internally, the §22 passes keep a **workflow state** for the owner's dashboard (untouched / AI pass run /
issues open / issues resolved) — useful for managing the work, never displayed as a public quality score.

### 24.2 Evidence facts (replaces thermometer-as-depth)

Public, countable, machine-derived — displayed as facts with no aggregation into a score:

- **Claims backed:** *"87% of factual claims carry a source"* — the §22 claims check already computes this.
- **Issues:** raised / resolved / open — from the issues list.
- **Known unknowns declared:** count, with the list one click away.
- **Sources:** count, by type (legislation / debates / committee / statistics / case law).
- **Last deepening run:** date.

These are hard to fake and require no judgment. A reader can weigh them; the platform never sums them.

### 24.3 The review instrument (Charlie's "lay out the structure")

A review is a **structured assessment, not a comment.** Its structure mirrors the kernel and the deepening
passes, so reviews are comparable and partial reviews are legitimate:

**Sections** (each: verdict `SOUND | MINOR ISSUES | MAJOR ISSUES | NOT ASSESSED` + written reasoning):
1. Problem clarity — is a real problem stated, and is it the right one?
2. Diagnosis — are the causes evidenced? Is the pivotal obstacle the true blocker?
3. Guiding policy — genuine leverage? Are the ruled-out alternatives honestly argued?
4. Coherent actions — implementable, coherent, owned?
5. Evidence quality — **spot-check the citations: does the source say what's claimed?** (The evidence layer
   makes every citation clickable, so this is genuinely checkable — a property paper proposals don't have.)
6. Costings — realistic? Right benchmarks? Sensitivity honest?
7. Risks — political and sector risks adequately anticipated?
8. Overall assessment — free text.

**Findings.** The heart of it: specific, addressable defects — *"the £14m figure cites a source that gives
£1.4m"*, *"no answer to the precedent-for-other-sectors attack"*. **Each finding lands on the owner's §22
issues list**, tagged to the review. The review plugs into the machinery that already exists; nothing new to
learn on the owner's side.

**Declaration.** Reviewer name; credentials (self-declared, displayed as self-declared — the same honest
pattern as the legislation-guide form; verification badges are a later layer); conflicts of interest; scope
(which sections reviewed); whether the review was invited by the owner or unsolicited; time spent (optional).

**Lex serves the reviewer too.** On opening a review, Lex assembles the reviewer's pack: the claims-to-source
map for spot-checking, the cost basis, the known unknowns, and — for re-reviews — the diff. Scrutiny is the
product; the reviewer is a first-class user of it.

**Who can review: anyone logged in** with access to the idea (shared URL or public). No gatekeeping of who
may speak — gatekeeping of **weight**, via attribution, declared credentials, and track record (§24.5). The
brother-in-law can review; his review displays "no credentials declared · first review", and the reader
weighs it accordingly. A KC's carries its weight the same honest way.

### 24.4 Version pinning and the staleness loop (Charlie's "review is out of date" problem)

**A review attaches to a version, never to "the idea."** §20.3 already versions published proposals; a review
records the version (content hash) it assessed. Then staleness stops being a defect and becomes the engine:

1. Review of **v3** raises 14 findings → they land as issues.
2. Owner resolves 12 in **v4–v6**; each resolution links back to its finding.
3. Display, automatically: *"Reviewed by Jane Smith KC at v3 — 14 findings; 12 resolved since; 2 contested.
   [What changed since this review]"* — the review is never silently outdated; it is visibly **answered**.
4. The reviewer is invited to a **delta re-review**: Lex shows only what changed and how each finding was
   addressed. Minutes, not hours. Outcome appended: *"Re-reviewed at v6 — 12/14 resolved, 2 contested."*
5. Reviews and re-reviews are **append-only** — never edited retroactively. The full exchange is the audit
   trail, and *"survived a harsh review and fixed everything it found"* becomes the strongest credibility
   statement a proposal can display.

### 24.5 Judging the reviewer (Charlie's voting idea, with two refinements)

Yes — the review is itself open to public assessment, and the responsibility is the point. Two refinements
to make the incentive land on *harshness with substance* rather than popularity:

1. **Readers rate rigour, not agreement.** The control is *"rigorous / not rigorous"* (or "useful for judging
   this proposal"), explicitly not "do you agree with the verdict" — otherwise harsh reviews of popular ideas
   get buried, which is the opposite of the incentive we want. *(Later refinement, noted: weight ratings by
   rater diversity, Community-Notes-style, so a partisan pile-on counts less than agreement across camps.)*
2. **The strongest reputation signal is objective and automatic: findings that led to changes.** "12 of 14
   findings accepted and fixed" proves the review was substantive in a way no vote can. Reviewer reputation
   is therefore built from: findings-accepted rate, re-reviews completed, reader rigour ratings, and declared
   credentials — displayed on a reviewer's track-record page. The way to build a reputation on Scrutinise is
   to find real holes. **Harshness is rewarded precisely when it is right.**

### 24.6 Endorsement ≠ review (split them)

Charlie's instinct — "less like a stage, more like a formal endorsement, like an MP endorsement" — points at
two objects that must not be one:

- **A review** says *"I examined this."* Structured, version-pinned, findings, may be harsh, may conclude
  against. Epistemic capital.
- **An endorsement** says *"I support this."* Identity + statement, no structure. Political capital.

Splitting them keeps reviews **safe to be negative** — a KC can do a bruising review without it reading as
opposition, and an MP can endorse without pretending to have audited the costings. Displayed separately.

### 24.7 What the public sees (replaces the star rating)

A **credibility panel** on the published proposal — all facts, all attributed, nothing summed:

> **Stage:** Deepened · **Claims backed:** 87% · **Issues:** 14 raised, 12 resolved, 2 contested ·
> **Known unknowns:** 4 declared
> **Reviews:** Jane Smith KC *(self-declared; invited)* — v3, 14 findings, re-reviewed v6 · rigour 91% ·
> [read the exchange]
> **Endorsements:** …

The composition *is* the signal. No single number exists to be gamed, and every judgment on the page has a
name attached to it.

### 24.8 Data model (sketch)

`Review { id, ideaId, versionHash, reviewerUserId, invited, scopeSections[], sections[{key, verdict,
reasoning}], declaration{credentials, conflicts, timeSpent?}, createdAt }` — append-only.
`ReviewFinding { id, reviewId, section, text, issueId (→ §22 issue), status: OPEN | RESOLVED | CONTESTED }`
`ReviewRating { reviewId, raterUserId, rigorous: boolean }` (one per rater)
`Endorsement { id, ideaId, endorserUserId, statement, createdAt }`
Reviewer track record is derived, never stored as a score.

### 24.9 Sequencing

Nothing here changes the current build order. **Dependencies:** versioning (§20-D) must exist before reviews
can pin to versions; the issues list (§22 mechanism) must exist for findings to land on. So: 3-D fixes → §22
mechanism + Legal/Financial/Political passes (issues list included) → §20-B/C/D → **§24 build**. The §22
brief will now specify the per-pass *workflow* state and the *evidence facts*, and omit the 1–5 thermometer
and star rating entirely.
