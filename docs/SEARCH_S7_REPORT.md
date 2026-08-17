# SEARCH S7 — THE BACKLOG CLEARED, AND TWO MEASUREMENTS THAT REFUSE TO ANSWER

**Executes:** `docs/BRIEF_SEARCH_S7.md` §1–§4
**Written:** 17 August 2026, 23:12 UTC
**Owner:** CC-Search
**Verification:** `npx tsx scripts/check-s7-retrieval.ts` — **31/31**, with run negative controls.
`tsc --noEmit` clean both runtimes. **Cost: $0** — no model calls; every measurement is retrieval.

⚠ **S5 shipped the batching**, so §1's precondition is met — see `docs/SEARCH_S5_REPORT.md`.

---

## THE SHORT VERSION

| | |
|---|---|
| **§1 semantic on four more streams** | ⚠ **Measured live for the first time. The brief's prediction did not hold, and the pre-batching latency scare does not reproduce.** Recommendation: turn on **caselaw** and **guidance**; do **not** turn on **debates**; **committees is unmeasurable** until it has gold questions. |
| **§2 PRECEDENT + DEVOLUTION_SCOPE** | ✅ Both built, with the two unbuildable ones named and reasoned. Public-sources block built with separate `[W1]` numbering. |
| **§3 query framing** | ⚠⚠ **The experiment is underpowered and says so.** 27 of 31 queries scored zero in *both* arms, so only 4 could have shown a difference. "+0.0pp" is a floor effect, not a finding. |

---

## §1 — SEMANTIC SEARCH ON THE OTHER FOUR STREAMS

### What was already known, and what was not

`score-stream-fusion.ts` measured recall for all four on **6 August, offline**, straight against the
Lance tables. Those numbers stand and are not re-derived:

| stream | BM25 | vector | verdict |
|---|---:|---:|---|
| **committees** | 100.0% | 100.0% | ⚠ **at a ceiling — cannot show a gain** |
| **debates** | 90.0% | 75.0% | ❌ **vector is 15pp WORSE** |
| **caselaw** | 87.5% | 100.0% | ✅ **+12.5pp** |
| **guidance** | 87.5% | 100.0% | ✅ **+12.5pp** |

⚠ Three of those four are scored on **CC-drafted questions**, because `gold-queries.ts` contains no
committee, caselaw or guidance archetype. That caveat is not cleared and is not cleared here.

What those numbers could not give is what §1 actually asks for: **latency, and queue depth under two
simultaneous users.** Nothing offline can. `scripts/measure-s7-streams.ts` measures it live.

### ⚠⚠ The brief's prediction did not hold, and it could not have

> §1: *"Committee evidence is where a lay description most often has to bridge to specialist
> language, so it should show the largest gain — and if it does not, that is worth knowing before
> spending four sprints."*

**Committees cannot show a gain, because it is already at 100% on the only questions it has.** That
is a ceiling, not a result. Turning it on first — the brief's order — would spend a sprint on the
one stream whose benefit is unmeasurable, and the two streams with a **measured +12.5pp** would wait
behind it.

▶ **Recommended order: caselaw, guidance, then committees only after it has real gold questions.
Debates not at all on current evidence.**

### Live latency, per stream

| stream | BM25 p50 | +vector p50 | Δ | top-20 overlap between arms |
|---|---:|---:|---:|---:|
| committees | 4,874 ms | 5,733 ms | +859 ms | 65% |
| debates | 3,676 ms | 3,905 ms | +229 ms | **45%** |
| caselaw | 5,744 ms | 6,033 ms | +289 ms | 68% |
| guidance | 4,986 ms | 7,514 ms | **+2,528 ms** | **43%** |

⚠ **The overlap column is the informative one.** Turning vector on changes **32–57% of the top 20**.
The dense half is doing a great deal of work — it is emphatically not inert — which makes the
question of whether that work *helps* the important one, and this harness cannot answer it (below).

### ⚠ The on-kind count saturates and says nothing

My first live metric counted how many results were of the stream's own type. It came back **identical
in every arm** — 180 of 180, four times. That is not "vector adds nothing"; it is a **saturated
metric**: every routed stream returns its full window on every question, so the count is pinned at
(questions × window) whatever retrieval does. It can show that a stream *answers*; it cannot show
that it answers *better*. **Reported rather than quietly dropped**, because a table of identical
numbers is exactly the shape of evidence that gets mistaken for a null result.

### ⚠⚠ The pre-batching latency scare does NOT reproduce

> §1: *"Earlier load testing had all five at once doubling the slowest queries to 25 seconds. That
> was before batching; it may not hold, and it may not be wrong either."*

**It does not hold.** Two simultaneous users, measured against the same warm services in the same
session as their own serial baseline:

| stream | serial p95 | 2 users p95 | ratio |
|---|---:|---:|---:|
| committees | 6,068 ms | 8,331 ms | 1.37× |
| debates | 6,588 ms | 6,246 ms | 0.95× |
| caselaw | 13,983 ms | 10,514 ms | 0.75× |
| guidance | 7,252 ms | 8,605 ms | 1.19× |

**No doubling anywhere.** Two of the four came in *below* their serial baseline, which at this sample
size means the difference is inside the noise rather than that concurrency makes things faster. ⚠ **n
is three questions per stream** — this rules out the 2× catastrophe, and it does not establish a
precise concurrency cost.

▶ **`LEX_VECTOR_STREAMS` is Charlie's to set.** It is a Vercel environment variable, unreadable and
unsettable from here (`docs/CLAUDE.md` §19 — the token is SAML-blocked). This sprint produces a
recommendation with numbers under it, not a deployment.

---

## §2 — THE TWO RETRIEVAL JOBS THE DEEPENING NEEDS

### ✅ `PRECEDENT` — has this been tried, and what happened?

Three documents around **one instrument**, returned **as a group, never as a ranked list** — §2 is
explicit that a flat ranking destroys the comparison, which is the whole value.

```
INTENDED   explanatory note        what the provision was FOR
PREDICTED  impact assessment       what was EXPECTED of it
OBSERVED   post-implementation     what actually HAPPENED
```

⚠ **There is no separate collection of post-implementation reviews**, and looking for one is how
this gets written up as impossible. The "what happened" leg is **inside** `impact-assessments`,
distinguished by section title. **Measured: 1,014 sections** — the brief says 1,235, and 1,014 is
what the corpus holds today.

⚠⚠ **A missing PIR is never filled from the impact assessment.** That substitution is the tempting
one and it converts *"nobody has checked whether this worked"* into *"here is what it achieved"*. The
note says so in terms, and the check asserts the sentence is present. `legForImpactSection(null)`
defaults to **predicted**, because mislabelling a prediction as an outcome is the damaging direction.

### ✅ `DEVOLUTION_SCOPE` — reserved or devolved?

⚠ **Jurisdiction is derived from the identifier, never the title**, and every rendered line leads
with it. The check includes the case that makes this necessary: **the Scotland Act 1998 is `ukpga`
and therefore UK-wide** — a title-based rule would file the foundational reservation statute as
Scottish.

Coverage confirmed across all three nations, contrary to any suspicion the corpus is England-only:

| | |
|---|---|
| Scotland | `ssi` 87,398 · `asp` 25,985 · Scottish Parliament OR 1,044,188 · Scottish courts 13,070 |
| Wales | `wsi` 70,062 · `anaw` 4,717 · `asc` 4,585 · `mwa` 1,446 |
| Northern Ireland | `nisr` 129,681 · `nisi` 23,920 · `nia` 9,367 · NI judgments 7,927 |

⚠⚠ **It does NOT answer "is it reserved".** It shows *who has legislated*, which is evidence, not a
conclusion. The reservation question is settled by Schedule 5 to the Scotland Act 1998, Schedule 7A
to the Government of Wales Act 2006 and Schedules 2 and 3 to the Northern Ireland Act 1998 — held as
text, not as a structured answer. **A retrieval layer that implied otherwise would be answering a
constitutional question with a frequency count.** The note names all three schedules and the check
asserts it.

### ✅ The Public sources block

⚠⚠ **`[W1]`, never `[1]`.** §2: *"The corpus's authority is the platform's main asset, and the
fastest way to spend it is to make a web claim look like a statutory one."* The prefix is a
**constant**, not a per-call-site convention, and `markersCollide()` proves the two schemes cannot
overlap in a 200-source range — with a negative control that shows the collision test detects a real
collision.

⚠ Institutional preference is an **ordered allow-list** rather than a vague instruction, and a
non-institutional publisher is **flagged in the rendered block** (`⚠ not an institutional source`)
rather than silently accepted. An empty list renders the honest line — *"our corpus is UK-only…
do NOT answer from general knowledge"* — not an empty string.

### ❌ Not built, with reasons (§2's own list)

- **Cross-domain mechanism analogues** — wants results that are topically *distant*, the opposite of
  what BM25 and dense retrieval both reward. Neither can be tuned into it. Needs provisions tagged by
  mechanism first, which is unbuilt.
- **Contradiction retrieval** — a reranker problem, and the reranker is not authorised. S2C-5
  measured its preference accuracy at 66.7% but only 4 of 15 pairs compared two documents the system
  actually returned, so the binding constraint was recall rather than ordering.

Both are constants in the code carrying their reasons, so they read as decisions rather than as a
backlog nobody has looked at.

---

## §3 — THE QUERY-FRAMING EXPERIMENT

### ⚠⚠ Which comparison ran, stated in the brief's own terms

> §3: *"On the gold set there is no user and no profile, so the contrast becomes bare query versus
> query plus whatever context the caller holds. That is still a real and useful comparison, but it is
> not the same comparison, and the report must say which one it ran."*

**This ran: bare query vs query plus caller-held context** (the stream the caller would search and
its read of the question's shape). **It did NOT run the Lex-build comparison**, which contrasts the
user's problem as typed against the problem plus their goal, their rejected options, what they
already know, and their profile. **No result here licenses any claim about user profiles.**

### The result is that the measurement cannot answer the question

| | recall@20 |
|---|---:|
| bare | 8.1% |
| caller-enriched | 8.1% |
| difference | +0.0pp |

⚠⚠ **Do not read that as "context does not help".** **27 of the 31 scored queries returned nothing in
either arm**, so only **4** could have shown a difference in either direction. That is a floor
effect. The harness prints the headroom count itself, so the limitation travels with the artefact
rather than living only in this report.

**Why the floor is so low:** the harness calls `rankedSearch` straight against `corpus_fts` — bare
BM25, no tier scoping, no per-stream fusion, no query expansion, no citation resolver. The platform's
own BM25 gold headline is around **62%**. This measures a far weaker system than anyone runs.

▶ **What would fix it:** run both arms through `runSearch()` — the real gateway. It cannot be done
from `scripts/ingest`, which sets `rootDir: "."` and cannot import anything under `scrutinise-web/`.
**That is a harness-location problem, not a measurement problem**, and it is the next thing to do.

### ⚠⚠ One bug caught, and it would have halved the sample

The leak test — which excludes any query whose enrichment contains part of the answer key — was
first written non-differentially, and **excluded 13 of 31 scoreable queries**. Every one of those
"leaks" was in the **original question**: *"What laws govern e-scooters?"* trips `/e-scooter/i`;
*"Has the Dangerous Dogs Act 1991 been changed?"* trips `/dangerous dogs act 1991/i`. **A question
naming its own subject is not a leak, it is a question.** Excluding them would have shrunk n by 42%
and biased what remained towards queries whose answer key happens not to use the subject's name. The
test is now differential — does the *enrichment* add a match the bare query did not already have —
and excludes **0**.

**The recording requirement (§3) is met by construction:** the framing used is an argument to the
harness and appears in the generated report header, so a re-run after a model upgrade is a
comparison rather than an assumption.

---

## What I would do next, in order

1. ▶ **Charlie: `LEX_VECTOR_STREAMS=legislation,caselaw,guidance`** — the two streams with a measured
   +12.5pp, at +289 ms and +2,528 ms p50 respectively. ⚠ Guidance's latency cost is the one to watch.
2. **Do not add `debates`** — 15pp worse on the only recall data that exists.
3. **Write committee gold questions.** Until then committees cannot be evaluated at all, and the
   brief's own hypothesis about it cannot be tested.
4. **Move the framing harness to the web side** so it runs through the real gateway. The current
   answer is "unmeasurable", which is worth knowing and is not worth repeating.
5. **Wire PRECEDENT and DEVOLUTION_SCOPE into the Deepening passes.** They are built and tested and
   **nothing calls them yet** — named here rather than left to be discovered.

## §4 — Standing

- ✅ Change-log and handoff labelled **SEARCH**.
- ✅ Scoped commits by explicit path.
- ✅ **Nothing widened before it was measured** — and twice the measurement came back "this cannot
  answer the question", which is reported as the result rather than dressed up as one.
