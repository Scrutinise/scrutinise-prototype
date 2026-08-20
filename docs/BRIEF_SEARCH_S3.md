# BRIEF — SEARCH STAGE 3: WIRE THE PRODUCT TO THE STACK

**Owner:** CC-Search
**Stream:** SEARCH
**Written:** 12 August 2026

**Where this sits:**
- *S2A–S2C6:* built and measured the retrieval stack — routing, stream interleaving, semantic
  search on legislation, three new display types, 99.12% of collections reachable
- **This: Stage 3 — connect the surfaces users actually touch to the stack we built**
- *Blocked and waiting on the corpus:* the ordering baseline, the reranker decision, and any
  recall measurement. V36/V37 own those.
- *Next:* semantic search on the remaining four streams; the divisions lane; the reranker

**Why now, and why these three together.** Everything we have built over the past fortnight reaches
the admin general-chat surface, the Page-1 briefing and ad-hoc research. **It does not reach the Lex
chat route**, which is where pilot users will spend their time. That is the single largest gap
between what exists and what anyone will experience, and it does not depend on the corpus work at
all.

---

## §1 — The routed-gateway migration

Three surfaces — **the Lex chat route, `/api/search`, and the legislation-search panel** — pass an
explicit tier, take the tier-scoped branch, and call `runFtsSearch` directly. They get **neither
routing nor dense retrieval**.

That was a deliberate first blast radius when semantic search went live and it was right then. It is
not a good state to enter a pilot in.

### What to do

Move these callers onto `runSearch`'s routed path, so they get the router, the interleave, the
per-stream fusion and the display typing like every other caller.

### Requirements, and the third is the one that matters

1. **Audit every tier-scoped caller before changing any**, and report the list. The S2A audit found
   six more consumers than the brief predicted, and the S2B audit found the same shape again. Expect
   it a third time.
2. **Preserve the ability to scope by tier where a caller genuinely needs it.** The legislation
   panel is a legislation panel; a user there is not asking for Hansard. Routing and tier-scoping are
   not mutually exclusive — the router should be able to run *within* a scope. If that turns out to
   need a change to `runSearch`'s signature, say so rather than dropping the scope.
3. ⚠ **Measure what the Lex chat route actually returns, before and after, on the same questions.**
   This is a change to what users see on the platform's main surface, so it ships with a
   before-and-after or not at all — the discipline from the Scottish material and the bills. Report
   answer content, source panel composition, and latency.

### The thing to watch for

The legacy path currently returns **Companies Act 2006 at rank 1** on a directors' duties query,
because it reads the old table that still holds text the corpus does not. **Moving the Lex chat route
onto the corpus path could make its answers worse until V36 lands.**

**So measure it, and if the routed path is worse on those questions, say so and hold the flip behind
a flag rather than shipping a regression.** Being right about the architecture is not the same as
being right today.

---

## §2 — Batch the per-stream vector calls

Today a routed query makes one HTTP request to `vector-serve` per stream. With one stream live that
is one request. With five it is five, against a service that caps concurrency at 4 and has been
observed with a queue depth of 46. **One user would saturate it.**

Send one request carrying all the stream queries; have the service run them and return the results
keyed by stream. Same total work, one slot, no queue.

- Report the latency change on a routed query with the streams currently live, and **model** what it
  would be with five.
- Keep the per-request path working, behind the same interface, so the change is revertible.
- This is what makes both the remaining streams and the divisions lane affordable, so it is worth
  doing properly rather than quickly.

---

## §3 — The deepening's retrieval intents

`REPLY_TO_SEARCH_ON_DEEPENING.md` §4a asks for four new retrieval intents. **Two are buildable now
and two are not.** Build the two.

### `PRECEDENT` — has this been tried, and what happened?

The triangulation: **explanatory notes** say what a provision was *for*, **impact assessments** say
what was *predicted*, **post-implementation reviews** say what actually *happened*. All three are now
in the corpus and reachable — the notes since S2C, the assessments since V35.

⚠ **There is no separate PIR corpus.** The Lex thread established that the "what happened" leg is
**1,235 sections inside `impact-assessments`**, tagged by stage. So the intent needs to distinguish
them within that collection rather than routing to a stream that does not exist.

Return them **as a cluster around one instrument**, not as a ranked list. The value is the
comparison — intended, predicted, observed — and a flat ranking destroys it.

### `DEVOLUTION_SCOPE` — is this reserved or devolved?

Same corpus, same retrieval. The Lex reply calls it the single most-asked question a lay user has,
and we now hold Scottish, Welsh and Northern Irish material.

⚠ Jurisdiction must be unmistakable in the output — the same requirement that applied to Holyrood
material in the debates stream.

### Not now, with reasons

- **`MECHANISM_ANALOGUE`** wants results that are topically *distant* — a duty-to-report regime in an
  unrelated field. That is the opposite of what both keyword and semantic search reward. It needs
  provisions tagged by lever type first, which is unbuilt.
- **`CAUSAL_EVIDENCE`** needs documents that *bear on* a claim including those that refute it. That
  is a reranker problem and the reranker is not authorised.

### One design note worth acting on

**Deepening runs in the background, so minutes are acceptable.** That is a completely different
budget from interactive search, and it means these intents can afford large candidate sets, multiple
queries per question, and iterative retrieval — the very things the interactive path cannot.

Given that recall, not ordering, is the measured constraint, **the deepening may be the first place
where a genuinely thorough retrieval strategy is affordable.** Worth treating as an opportunity
rather than a constraint.

### Public sources

Charlie's addition, and it is needed rather than optional: the corpus is UK-only, so international
comparisons cannot come from it at all. A **"Public sources"** block, clearly separated.

⚠ **Never share a citation sequence with corpus results.** Separate numbering, separate block,
visually distinct. The corpus's authority is the product's main asset and the fastest way to spend it
is to make a web claim look like a statutory one. Prefer institutional sources — foreign
legislatures, audit offices, the OECD.

---

## §4 — Standing

- Thread labelling in `CHANGE_LOG.md` and `handoff_summary.md` — **SEARCH**, **INGEST**, **LEX**,
  **CENTRAL**, **GRAPH**. Scoped commits by explicit path; never `git add -A`.
- `VECTOR_NPROBES` stays at 64. The revert rule is **suspended, not satisfied** — it was written
  before we knew the corpus was incomplete, so the test it specifies could not have passed. Re-test
  after V36.
- The `LegislationSection` DROP stays blocked until the recovery lands.
