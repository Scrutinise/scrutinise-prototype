# SEARCH S5 — LEX CAN SEE THE WHOLE CORPUS

**Executes:** `docs/BRIEF_SEARCH_S5_LEX_SCOPE.md` §1–§5
**Written:** 17 August 2026, 22:44 UTC
**Owner:** CC-Search
**Verification:** `npx tsx scripts/check-lex-scope.ts` — **29/29**, with a run negative control on the
batcher. `tsc --noEmit` clean.
**Cost:** about $0.02 — four Gemini calls for the answer comparison. Retrieval measurement is free.

---

## THE RESULT, MEASURED ON THE SAME TEN QUESTIONS S4 AUDITED

| | arm A (before) | arm B (after) |
|---|---:|---:|
| legislation results | 100 | 50 |
| **non-legislation results** | **0** | **100** |
| non-legislation questions served | **0 of 7** | **7 of 7** |
| legislation questions still returning legislation | 3 of 3 | **3 of 3** — no regression |
| latency p50 | 3,345 ms | 5,392 ms |
| latency p95 | 5,280 ms | 9,034 ms |

**100 documents per ten questions that the platform's main conversation could not previously
reach.** Arm A was not returning bad results; it was returning *only Acts and SIs*, on every
question, forever.

⚠ **Both arms are still callable, and that is deliberate.** A temporal before-and-after stops being
runnable the moment the change ships. `searchLegislationViaGateway` is untouched — the legislation
panel and `POST /api/search` still use it, and S4 measured that scope as correct — so
`scripts/measure-s5-lex-scope.ts` is a **standing comparison** rather than a number in a document.
⚠ Run order **alternates per question**, because a cache-warming artefact has already misled one
measurement in this project.

---

## §1 — THREE GATES, ALL THREE MOVED

S4's most useful finding was that this is not a one-line change.

| gate | what it was | what happened |
|---|---|---|
| **1. the tier filter** | the caller passed `tier: 'legislation'` | ✅ **removed** — `retrieveForChat` passes no tier, so the router picks the streams |
| **2. the type filter** | applied *after* it, keeping 3 display types, dropping **24 of 36** results | ✅ **replaced** by a split, not a widening |
| **3. the response contract** | `LegacySearchResult` has `actId`, `actTitle`, `sectionNumber` — **nowhere to put a committee transcript** | ✅ **a second shape**, `EvidenceResult` |

⚠⚠ **Gate 3 is done structurally, not by convention.** `EvidenceResult` has no `actId`, no
`actTitle`, no `sectionNumber`. There is no field on it through which a committee transcript could
be rendered as a section of an Act — the outcome §1 calls *worse than doing nothing*. The check
asserts the absence of all three field names.

---

## §2 — TWO CHANNELS, AND THE ROUTER LEFT ALONE

**Legislation** keeps the shape it had. **Everything else** gets its own block, its own label, and
one line saying what kind of document it is:

```
=== OTHER EVIDENCE FROM OUR CORPUS (NOT legislation) ===
- [Committee evidence] Water quality in rivers (2022-01-13)
    what a witness told a select committee, or what that committee reported
    "…a huge chemical cocktail…"
```

The labels are deliberately roles rather than collection names. *"What a witness told a select
committee"* tells a reader what weight to give it; *"committees-evidence"* does not, and invites it
to be cited as though settled.

⚠ **A Bill is in the EVIDENCE channel, not the legislation one.** A Bill is a proposal and may never
pass. Putting it beside operative law would let Lex cite a clause as though it were in force — the
same class of error as citing a repealed section, which SURFACE 1 spent a sprint closing.

✅ **Route rather than widen.** The chat route is now a routed caller like the untiered surfaces
already are. On *"what have select committees said about sewage"* the router chooses `committees`
alone; on *"companies act 2006 directors duties"* it chooses legislation alone and the evidence
channel is correctly **empty**. The router was always right — the caller was overruling it with a
constant.

✅ **The legislation panel is NOT widened.** S4 measured its scope and found it correct; the check
asserts `gateway-legacy.ts` still carries both its tier and its type filter.

### ⚠ Batching, which §2 makes a prerequisite

`runRoutedSearch` was `Promise.all(active.map(...))` — **five streams fired at once against a
service that handles four.** One user saturated it, and S5 is the sprint that makes five streams the
*normal* case rather than the exception.

Now batched at **3 concurrent** (`LEX_STREAM_CONCURRENCY`), and the concurrency is **observed rather
than assumed** — §2 asks for exactly that: `streams: 5, cap: 3, maxInFlight: 3`. A limiter that
silently failed open would look identical to one that worked, so `maxInFlight` is measured and
logged. The self-test includes a **run** negative control: a 2-wide batch of four 40 ms tasks really
does take longer than a 4-wide one, so the limiter is provably not a no-op.

⚠ **A failed stream still rejects the batch**, exactly as `Promise.all` did. Swallowing it would
turn *"committees is down"* into *"committees found nothing"* — the never-claim rule broken at the
retrieval layer.

---

## §3 — WHAT THE ANSWERS ACTUALLY SAY

⚠ **More sources is not a better answer**, so four were generated with a real model, both arms, same
question, same instructions, differing **only** in the material carried.

### *"what did MPs argue in the debate on assisted dying"*

> **A (legislation only):** *"I looked for information on what MPs argued in the debate on assisted
> dying but could not find it. The provided legislation mentions 'Recall of MPs Act 2015'… and
> **'assist investi'** (from The Regulation of Investigatory Powers (Communications Data) Order
> 2010), but none of the sources discuss debates…"*

> **B (two channels):** *"…MPs have expressed strong and varied opinions on assisted dying
> (Parliamentary debate, 2019-07-04; 2015-09-11). Some MPs have called for a thorough and fresh
> debate, suggesting the Commons vote in 2015 did not reflect public opinion (Parliamentary debate,
> 2024-04-29)… **The material does not contain specific arguments made by MPs for or against
> assisted dying, only that strong opinions exist.**"*

⚠ **Read arm A closely: it matched `"assist investi"` inside an investigatory-powers SI.** That is
the whole problem in one string — a substring collision offered as the platform's best answer about
a live moral controversy Parliament has debated for a decade.

⚠ **And read arm B's last sentence.** It declines to overclaim from what it was given. That is the
§4 discipline working in the place it is hardest.

### *"what have select committees said about water company sewage discharge"*

> **A:** *"I cannot find any information… The documents mainly consist of sections from the Sewerage
> (Scotland) Act 1968, the Water Industry Act 1991…"*

> **B:** *"The Environmental Audit Committee reported in 2022 that water in rivers is a 'huge
> chemical cocktail'… Severn Trent was fined £1.5 million for illegal sewage discharge in December
> 2021… WASP found 'clear evidence that operator self-monitoring by the water industry and
> regulation by the Environment Agency are not working'… Salmon & Trout Conservation submitted
> written evidence…"*

Every claim in B carries `(Committee evidence)`. **The labelling requirement works in the output,
not only in the prompt.**

❌ **Only 2 of the 4 answer pairs completed** — the harness run hit its wall-clock limit. Both are
reported; the other two were not generated and are not guessed at.

### Latency, stated plainly

p50 **3.3s → 5.4s**, p95 **5.3s → 9.0s**. Arm B searches up to five streams instead of one, so
slower is expected; the honest question is whether it is acceptable, and **p95 at 9 seconds is not
comfortable.** ▶ Batching at 3 is a floor, not a ceiling — raising `LEX_STREAM_CONCURRENCY` to 4
would recover some of it, and is a one-variable experiment somebody should run against the real
service rather than against a guess.

---

## §4 — THE SEARCH CONTRACT FOR LEX

`docs/SEARCH_CONTRACT.md` already existed from S6. **§6 is new** and is the part Charlie was really
asking for:

> **If Lex wants something and search cannot supply it, Lex says so plainly and specifically.** Not
> silence, not a vague deflection, and above all **not an answer composed from general knowledge
> presented as though it came from the corpus.**

⚠ **A gap that announces itself is a feature. A gap that looks like an absence of evidence is the
single most damaging thing this platform can produce**, because the user cannot tell the difference
and neither can we.

**Enforced, not hoped for:**

- `GAP_INSTRUCTION` forbids *"I don't have information on that"* **by name** — the check asserts the
  phrase is present in the prohibition, because a rule stated only in spirit is a rule nobody obeys.
- `kindsPlainlyAskedFor()` reads the question for the kind of material it wants; if the user names
  committees and none come back, `gapNote()` says so specifically.
- ⚠ A **failed** search gets a different sentence — *"the corpus was not consulted at all"* — because
  "we could not look" and "we looked and found nothing" are different facts.
- The **legacy fallback declares its own limits**: it reaches legislation only and always will, and
  it says so rather than letting silence imply the corpus holds nothing else.

⚠⚠ **The check caught a real bug in this machinery.** `/\bcommittee\b/` does **not** match
"committees" — the plural, which is how anybody actually asks. The very first non-legislation probe
in the question set is phrased that way, so the gap note would have been **silent on the exact case
§4 exists for**. Anchoring is now at the word start only.

⚠ **The gap note did not fire on any of the ten questions in the live run**, because all ten were
served. It is exercised by the check with synthetic inputs, not by a live miss. Its behaviour in
production is therefore asserted, not observed — worth saying rather than implying it has been seen
working end to end.

### Every unmet request is logged

`LexUnmetRequest` (+ view `LexUnmetDemand`) records the **kind** wanted, the **keywords searched**,
**which streams the router chose**, and the result count. V37's gap-filler expects exactly this:
*what Lex looked for and could not get is the most direct evidence available about what the corpus
should hold next.*

⚠ **The question text is NOT stored.** A Stage-1 idea is private by design and a gap log is not a
reason to keep a copy of it. The check asserts the insert carries no question or message column.

⚠ **`streams` is the most diagnostic column**, because it separates two failures that look identical
from outside: *the router never selected committees* (our bug, fixable today) versus *it searched
committees and found nothing* (a corpus gap, the ingest stream's work). `LexUnmetDemand` splits
them, so the gap-filler is not handed a work list contaminated with our own routing bugs.

---

## What is NOT done, named

| | |
|---|---|
| ⚠ **Who said it** | `SearchResult` carries no `attribution` field — the adapters fold it into the title before it reaches the gateway. For a committee transcript "who was speaking" is the single most useful fact about it. **A gap in the gateway contract, reported rather than faked from the title.** |
| ⚠ **p95 at 9 seconds** | acceptable-ish, not good. One variable to try: `LEX_STREAM_CONCURRENCY=4`. |
| ⚠ **2 of 4 answer pairs** | the harness run was cut short; not regenerated. |
| ⚠ **No browser walk** | Vercel is SAML-blocked here and local Clerk is a dev instance. ▶ **Charlie: ask Lex on a real idea what select committees have said about something, and confirm the answer cites committee evidence AS committee evidence.** |
| **The `unhandled` channel** | zero on all ten questions — every display type returned landed in one of the two channels. It is logged loudly if that ever changes. |

## §5 — Standing

- ✅ Change-log and handoff labelled **SEARCH**.
- ✅ Scoped commits by explicit path.
- ✅ **Nothing widened before it was measured**, and the latency cost is reported alongside the gain.
