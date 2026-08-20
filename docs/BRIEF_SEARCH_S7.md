# BRIEF — SEARCH S7: THE WORK THAT HAS BEEN CARRIED SINCE S3

**Owner:** CC-Search
**Stream:** SEARCH
**Written:** 17 August 2026, revised the same day
**Run after S5.** ⚠ **S5 includes the batching**, which was in an earlier draft of this brief and has
been removed from it. If for any reason S5 shipped without it, do it here first — nothing in §1
below is safe at five streams without it.

**Where this sits:**
- *S3:* named three jobs. §1 was done. **§2 and §3 have been carried, unstarted, through S4, S5 and
  S6.**
- **This: S7 — clear that backlog**
- *After this the first-pass search stack is complete*, and what remains is the reranker (still
  unauthorised) and the five items in the strategy addendum.

⚠ **Three of these have been "next sprint" for five days.** Work that is carried rather than
scheduled quietly stops happening, which is the reason this brief exists at all.

---

## §1 — Semantic search on the other four parts of the corpus

Today, meaning-based search runs on **legislation only**. Debates, committee evidence, case law and
guidance get keyword matching alone — so a user who describes a problem in their own words, without
happening to use the terms the document uses, will not find them.

**The embeddings already exist for all of it.** Turning a part on is one entry in a list.

⚠ **One at a time, gold-tested each time.** Earlier load testing had all five at once doubling the
slowest queries to 25 seconds. That was before batching; it may not hold, and **it may not be wrong
either.**

Order: **committees, then debates, then case law, then guidance.** Committee evidence is where a lay
description most often has to bridge to specialist language, so it should show the largest gain — and
if it does not, that is worth knowing before spending four sprints.

**Report per stream:** recall before and after, latency at p50 and p95, and the queue depth on the
semantic service under two simultaneous users.

---

## §2 — The two retrieval jobs the deepening needs

From the deepening design. **Two are buildable now and two are not.**

### `PRECEDENT` — has this been tried, and what happened?

Three documents read together: the **explanatory note** says what a provision was *for*, the
**impact assessment** says what was *predicted*, the **post-implementation review** says what
actually *happened*. All three are now in the corpus.

⚠ **There is no separate collection of post-implementation reviews.** The "what happened" part is
**1,235 sections inside the impact assessments collection**, tagged by stage. So this must
distinguish them within that collection rather than route to something that does not exist.

**Return them as a group around one instrument, not as a ranked list.** The value is the comparison —
intended, predicted, observed — and a flat ranking destroys it.

### `DEVOLUTION_SCOPE` — is this reserved to Westminster or devolved?

Same corpus, same retrieval. The Lex stream calls it the single most-asked question a lay user has,
and we hold Scottish, Welsh and Northern Irish material.

⚠ **Which parliament a document came from must be unmistakable in the output** — the same
requirement that applied when Scottish debates joined the search.

### Not now, with reasons

- **Cross-domain analogues** — a mechanism solving a similar problem in an unrelated field. Wants
  results that are topically *distant*, which is the opposite of what both kinds of search reward.
  Needs provisions tagged by mechanism first, which is unbuilt.
- **Contradiction retrieval** — documents that *bear on* a claim including those refuting it. A
  reranker problem, and the reranker is not authorised.

### The Public sources block

The corpus is UK-only, so international comparisons cannot come from it at all. A **"Public
sources"** block, clearly separated.

⚠ **Never share a citation sequence with corpus results.** Separate numbering, separate block,
visually distinct. The corpus's authority is the platform's main asset, and the fastest way to spend
it is to make a web claim look like a statutory one. Prefer institutional sources — foreign
legislatures, audit offices, the OECD.

---

## §3 — The query-framing experiment, transferred from Lex

The Lex stream is building its first pass with two ways of phrasing the search question, and has
handed the comparison here because this stream owns the scoring harness and the gold set.

### ⚠ Define the two framings before running anything — the Lex stream flagged this and they are right

**In the Lex build**, the contrast is: *the user's problem as they would type it into a chat window*
versus *the problem plus their goal, what they have ruled out, what they already know, and their
profile.*

**On the gold set there is no user and no profile**, so the contrast becomes **bare query** versus
**query plus whatever context the caller holds.** That is still a real and useful comparison, **but
it is not the same comparison**, and the report must say which one it ran.

⚠ **Do not let the two be conflated in the write-up.** A result about "context helps" measured
without a user profile does not license a claim about user profiles.

### The method

**Run it across the gold set**, which already exists and is scored. Three ideas will not separate a
real effect from noise; the gold set produces a number.

**Why this matters beyond the deepening:** if the plainer framing wins, that changes how *every*
retrieval call in the platform should be constructed, not just this one.

**And keep the recording requirement**: which framing was used goes on every build. That turns a
one-off experiment into a standing comparison — so if the answer shifts after a model upgrade we see
it rather than assuming the old result still holds.

---

## §4 — Standing

- Label change-log and handoff entries **SEARCH**.
- Scoped commits by explicit path; four streams share this tree.
- ⚠ **Nothing widens before it is measured**, and the measurement is reported whichever way it goes.
