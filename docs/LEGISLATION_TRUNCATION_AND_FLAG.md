# Legislation truncation before the vector flip, and which flag is load-bearing

*2026-08-07 23:43 UTC. Read-only measurement — no rows written, no index touched, no flag set.
Script of record: `scripts/ingest/search/measure-legislation-truncation.ts`.
Companion to `docs/V32_COMMITTEES_AUDIT.md` §4 (the corpus-wide 59.4% figure this is measured
against).*

---

## §1 — Verdict: the flip is NOT blocked by truncation

**The legislation tier embeds 79.2% of its body words against a corpus-wide 59.4% — materially
above, not below. The brief's own framing of the tier (primary + SI + retained EU) embeds 99.3%,
with 256 truncated sections out of 1,188,286.** Long-form UK instruments — the worst cases the
decision rule singled out — are not heavily truncated: **every Finance Act section is embedded
whole (0 truncated of 24)**, the wider tax family embeds 89.3%, Companies/Insolvency 96.3%, and
schedules across all instruments 84.7%.

Applying the decision rule as stated: legislation is largely short-section content that embeds
whole, so **the flip can proceed and the chunking fix follows.**

⚠ **With one qualification that matters for how the flip is scoped — see §1.4.** The 79.2% is a
tier average concealing a hard split: UK primary and secondary legislation is essentially
untouched (97.7–99.9%), while `eur-lex` (57.3%), `explanatory-notes` (14.3%) and
`explanatory-memoranda` (65.8%) carry nearly all the damage. Those three corpora are *inside* the
`legislation` tier, so `LEX_VECTOR_STREAMS=legislation` switches dense retrieval on for them too.

### 1.1 Method — and why the answer does not rest on a model

The corpus-wide 59.4% is a **model** over the `wordCount` histogram at a measured chars-per-word.
This report gives the legislation figure both ways so the comparison is like-for-like *and* the
verdict is not hostage to the model:

- **(A) Model** — identical method, over the full 1,615,500-row legislation histogram, at a CPW
  **measured on 400 real legislation bodies: 6.066** (corpus-wide measurement was 6.05 —
  consistent). The cap works out at **~3,666 words of legislation text**.
- **(B) Measured** — every legislation section that could possibly be truncated (`wordCount >
  1,500`: **21,033 rows**) had its **real R2 body** read and run through the **real exported
  `chunkBody`**. No modelling in the numerator.

**The two agree to 0.2pp** — model 79.4% / 8,149 truncated, measured 79.2% / 8,167 truncated —
which is the check that the model is describing this tier and not an idealised one.

Three properties of (B) worth stating, because they are what make it trustworthy:

- **Harness fidelity is enforced, not assumed.** The offset-tracking chunker used to find the
  covered span is asserted against the real `chunk.ts` export on **every one of the 21,033
  bodies**; a single mismatch is fatal. This measures what the chunker does, not what a second
  implementation of it does.
- **The ranged read cannot manufacture a truncation.** Bodies are read head-first (64 KB). If a
  body looked truncated but its head did not contain more normalised text than the cap can span,
  it was **re-read in full** — 1,322 rows were. So "truncated" is a fact about the body, never an
  artefact of the read.
- **The candidate floor is verified, not asserted.** The smallest genuinely truncated section is
  **2,470 words — 1.65× the 1,500-word floor**, so nothing below the floor could have been
  missed.

### 1.2 The tier, corpus by corpus (measured)

| corpus | tier words | truncated | words lost | **% of words embedded** |
|---|---:|---:|---:|---:|
| `primary-acts-pre-2000` | 24,783,975 | 13 | 34,765 | **99.9%** |
| `primary-acts-2000plus` | 22,001,014 | 9 | 127,732 | **99.4%** |
| `si-pre-2010` | 61,581,830 | 97 | 288,622 | **99.5%** |
| `si-2010plus` | 40,102,967 | 87 | 204,648 | **99.5%** |
| `regional` | 45,623,780 | 125 | 477,438 | **99.0%** |
| `retained-eu` | 18,991,303 | 50 | 443,195 | **97.7%** |
| `eur-lex` | 159,379,976 | 6,630 | 68,040,357 | **57.3%** |
| `explanatory-notes` | 9,173,040 | 298 | 7,864,192 | **14.3%** |
| `explanatory-memoranda` | 13,515,324 | 858 | 4,627,114 | **65.8%** |
| **LEGISLATION TIER** | **395,153,209** | **8,167** | **82,108,063** | **79.2%** |
| *brief's set (primary + SI + retained EU)* | *167,461,089* | *256* | *1,098,962* | ***99.3%*** |

**8,167 truncated sections of 1,615,500 — 0.51% of the tier's rows.** Corpus-wide the equivalent
is 242,957.

### 1.3 Long-form instruments — the cases the rule singled out

| group | sections (in candidate set) | truncated | **words embedded** |
|---|---:|---:|---:|
| Finance Acts | 24 | **0 (0.0%)** | **100.0%** |
| Taxation / income tax / CGT / VAT family | 54 | 3 (5.6%) | 89.3% |
| Companies / Insolvency | 19 | 3 (15.8%) | 96.3% |
| Schedules (any instrument) | 730 | 90 (12.3%) | 84.7% |
| Explanatory notes / memoranda | 2,634 | 1,156 (43.9%) | **37.0%** |
| EU (`eur-lex` + `retained-eu`) | 15,313 | 6,680 (43.6%) | **39.1%** |

**The premise behind the worry — that big consolidating Acts and Finance Acts would be
gutted — does not hold.** UK legislation is drafted in sections, and a section is a natural
chunk: the median legislation row is 34–78 words. The cap only bites where one database row
holds a whole document.

### 1.4 Where the damage actually is, and why it is a different problem

The worst 15 sections in the entire tier are all `eur-lex`, and all of the same shape:

```
  0.5% embedded   760,509 words   eur-lex:32007B0143:1
  0.6% embedded   648,822 words   eur-lex:32014B0067:1
  0.6% embedded   628,138 words   eur-lex:32013B0102:1
```

Note the `:1` — **these are single-section rows holding an entire document** (EU budget and
similar instruments running to three-quarters of a million words). `explanatory-notes` is the
same shape: 410 rows for 9.2M words, a 10,913-word median.

That is a **sectioning** problem, not a chunk-cap problem. Raising `MAX_CHUNKS` to 64 would still
leave a 760,509-word document embedding a small fraction of itself; only splitting the document
into sections fixes it — the same conclusion the committees work reached for reports. Recorded
here for the ingest thread; **not acted on, not this thread's work.**

### 1.5 Caveat on what "embedded" means here

This measures what `chunkBody` does to the **current** R2 bodies. It does not re-verify that the
live `corpus_vec` index contains a chunk for every one of these sections — the V32 addendum
records 47,845 corpus-wide sections recompiled since the chunk build whose stored chunks are not
guaranteed reproducible. That is an ingest-side reconciliation, and it can only make the served
coverage *lower* than the figures above, never higher.

---

## §2 — The flag question, answered from the code

**Short answer: `LEX_VECTOR_STREAMS` is the load-bearing flag for this flip. `LEX_SEARCH_VECTOR`
is the superseded whole-query switch and it stands *down* automatically the moment
`LEX_VECTOR_STREAMS` names any stream. Both threads should gate on `LEX_VECTOR_STREAMS` — but
neither flag does anything at all unless `VECTOR_SEARCH_URL` is set, and `LEX_VECTOR_STREAMS`
additionally requires `LEX_QUERY_ROUTER=true`.**

Both flags exist, both can cause the served vector index to be read, and they are **mutually
exclusive by construction**:

| flag | read at | what it does | status |
|---|---|---|---|
| `LEX_VECTOR_STREAMS` | `query-router.ts:88`, used at `:124` | Comma-separated **stream names**. `fusedStream(name, …)` returns BM25 alone unless the list contains `name`; when it does, it calls `runVectorSearch` scoped to that stream's tier/corpora and fuses. | **Load-bearing. This is the flip.** |
| `LEX_SEARCH_VECTOR` | `search-gateway.ts:59` → `:245` | Boolean. Fuses **one unscoped dense ranking over all 21.8M vectors** into whatever BM25 returned, for the whole query. | Legacy; superseded 2026-08-06 |

The mutual exclusion is explicit at `search-gateway.ts:245`:

```ts
let results = ftsResults
if (flags.vector && !perStreamVectorActive()) {   // ← legacy path stands down
  const { results: vecResults } = await runVectorSearch(queryKeywords, limit)
  ...
} else if (flags.vector) {
  console.log('[search-gateway] whole-query fusion stood down — per-stream vector is active', …)
}
```

`perStreamVectorActive()` is simply `LEX_VECTOR_STREAMS` being non-empty. So setting both is safe
but pointless: the per-stream path wins and the boolean becomes a no-op. Setting **only**
`LEX_SEARCH_VECTOR` would switch dense retrieval on for **every stream at once, unscoped** — the
opposite of the sequenced legislation-first flip.

### The two preconditions that are easy to miss

1. **`VECTOR_SEARCH_URL` is the real master switch.** `vector-search.ts:111` returns `[]`
   immediately if it is unset, so *both* flags are inert without it. It is unset locally and in
   Vercel today.
2. **`LEX_VECTOR_STREAMS` only has effect when `LEX_QUERY_ROUTER=true`.** `fusedStream` is only
   ever reached via `runRoutedSearch`, which is only called from the router branch at
   `search-gateway.ts:169`. With the router off, retrieval goes straight to `runFtsSearch` and the
   stream list is never consulted.

### ⚠ A gap in "legislation first" that neither thread has stated

**The three legacy legislation surfaces will NOT get dense retrieval from
`LEX_VECTOR_STREAMS=legislation`.**

`gateway-legacy.ts:162` passes `tier: 'legislation'`, which routes into the **tier-scoped branch**
at `search-gateway.ts:140`. That branch uses the router only to rewrite the query and then calls
`runFtsSearch` **directly** — it never goes through `runRoutedSearch`, so `fusedStream` and the
stream list are bypassed entirely. Those three surfaces are:

- `app/api/ai/[ideaId]` — **the Lex chat route**
- `app/api/search`
- `app/api/ideas/[id]/legislation-search`

And because `perStreamVectorActive()` would now be true, the legacy whole-query fusion stands down
as well — so setting `LEX_SEARCH_VECTOR=true` *alongside* the stream list would not cover them
either. They would be on BM25 alone, silently.

The callers that **would** get dense retrieval are the untiered ones, which go through the router:
`field-machine.ts:318` (the Page-1 background briefing), `orchestrator.ts:326` and `:478`
(cause-seeding), and `stage-search.ts:130`/`:158` (ad-hoc research).

Whether that is the intended blast radius is Charlie's call — it may well be the right first step,
since Page-1 briefing is where the concept-win was measured. But it should be a decision, not a
surprise. **Reported, not changed.**

### Current state, for both threads

| variable | local `.env` | effect today |
|---|---|---|
| `VECTOR_SEARCH_URL` | unset | dense returns `[]` everywhere |
| `LEX_VECTOR_STREAMS` | unset | per-stream fusion off |
| `LEX_SEARCH_VECTOR` | unset | legacy fusion off |
| `LEX_QUERY_ROUTER` | unset | router off (so the stream list would be inert even if set) |

---

## §3 — repoint-confirm

**All three Act-title reads are repointed to `corpus_acts` and verified.** Done 2026-08-07 17:52
UTC; full account in `docs/CHANGE_LOG.md` and `docs/CORPUS_SECTIONS_STORAGE_AUDIT.md`.

- `scrutinise-web/lib/lex/vector-search.ts:128` ✅
- `scrutinise-web/lib/lex/fts-search.ts:195` ✅
- `scripts/ingest/search/citation-resolver.ts:29` ✅ (the `fts-serve` boot-time ActIndex)

Verified whole-table (135,531 = 135,531, 0 missing, 0 differing), on 12,520 real hit gids
(0 missing, 0 differing), and by running the real `loadActIndex` against Neon (135,236 byTitle
entries, citations resolving). `tsc` clean both sides.

⚠ **Two things the ingest thread needs before scheduling the legacy DROP:**

1. **`scripts/ingest/search/backfill-citations.ts:48` still reads `LegislationItem`** — build-time
   only, but it is a live reference to the table.
2. **The six web-app read paths in `V26_LEGACY_DROP_RECHECK.md` §(a) are untouched**, including
   `gateway-legacy.ts:287`, which reads `LegislationSection` on the Lex chat route and is **not
   flag-gated**. Plus the one `IdeaLegislation` row of real user data.

So: **search-side Act-title reads are clear. The DROP itself is not yet unblocked** — the ingest
thread should not read repoint-confirm as "safe to drop".
