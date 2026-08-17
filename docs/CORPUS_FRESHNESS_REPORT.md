# CORPUS FRESHNESS — NOTHING WAS WITHDRAWN, AND THE MISSING NAMES WERE ALREADY STORED

**Executes:** `docs/BRIEF_INGEST_CORPUS_FRESHNESS.md` §1 and §2
**Written:** 17 August 2026
**Owner:** CC-Ingest
**Cost:** no LLM tokens. ~1,600 HTTP probes and ~1,700 API calls. **~$0.00.**

---

## THE HEADLINE

| | |
|---|---:|
| §1 committee publication citations that do NOT open (n=498 scored of 500) | **35.7%** |
| …**withdrawn, renumbered or superseded at source** — the brief's diagnosis | **0 of 498 (0.0%, 95% CI 0–0.8%)** |
| …**openable at a different URL** — an addressing defect, repairable | **13.9%** (~6,300 publications) |
| …**no document at all** — nothing to open, ever | **21.9%** (~10,000 publications) |
| §2 mentions that can now show the name as it appeared | **0% → 99.4%** (2,701,597 of 2,717,900) |
| …delivered by a VIEW CHANGE alone, no sweep, no backfill | **2,537,466 — 93.4% of the total** |
| new guards | `committees-freshness --self-test` **16/16**, `verify-surface` 6 sections + a firing control |

⚠⚠ **Both halves of the brief reverse in the same direction: what looked missing or dead was
mostly present and mis-addressed.** §1's dead ids are alive at a URL we do not store. §2's
unrecoverable surfaces were sitting in two columns nobody joined to.

---

## §1 — THE COMMITTEE CITATIONS

### §1.1 What was measured

`scripts/ingest/committees-freshness.ts`, a **deterministic** sample (ids hashed with a fixed salt,
so a surprising result can be re-run rather than re-rolled) of 500 of the 45,610 publication ids we
hold, each probed live and classified against the committees API.

| verdict | n | rate | 95% CI | what it means |
|---|---:|---:|---|---|
| `html-ok` | 320 | 64.3% | 59.9–68.4% | `/publications/{id}/html/` returns 200. Nothing wrong. |
| `other-url` | 69 | **13.9%** | 11.1–17.2% | ⚠ opens at `/publications/{id}/documents/{docId}/default/` |
| `no-document` | 109 | **21.9%** | 18.5–25.7% | ⚠ the API holds it and it has NO file at all |
| `gone` | **0** | **0.0%** | 0.0–0.8% | the class the brief hypothesised |
| unresolved | 2 | — | — | still 403 after a slow re-probe; excluded, not folded in |

**Extrapolated over the 45,610 publications we hold — an extrapolation, not a census: ~6,300
repairable and ~10,000 with nothing behind them.**

⚠ **`no-document` HERE MEANS `/html/` 404s AND the API lists no file — both halves.** It is NOT the
same as `committee_publication_document.document_id IS NULL`, which counts only the second half and
is 30.0% of the indexed rows. **45.0% of that wider class still opens at `/html/`** (n=60, CI
33.1–57.5%), so the two counts must never be quoted as each other. The 21.9% above is the
user-facing number: nothing opens at all.

### §1.2 Why — and it is not withdrawal

Three ids the brief names as dead, checked directly:

```
GET committees.parliament.uk/publications/22140/html/                    404
GET committees-api.parliament.uk/api/Publications/22140                  200   ← still there
GET committees.parliament.uk/publications/22140/documents/164408/default/ 200   ← opens
```

A committee publication is addressable three ways, and **we store the one that never works**:

- `/publications/{id}/` — 404 for every publication there is (the §19-E finding)
- `/publications/{id}/html/` — 200 only where an HTML rendition exists
- `/publications/{id}/documents/{docId}/default/` — **200 for both classes**, checked on one of each

`22140`'s only file is a PDF in `OriginalFormat`, and a PDF-only publication is addressed through
its `documentId`. `13110` is a different animal: a real correspondence record, held by the API,
carrying no file at all — nothing can open it, and that is a fact about the record rather than a
fault in a URL.

⚠ **`fileDataFormat` does NOT distinguish HTML from PDF** — every file in a 200-publication page
reads `OriginalFormat` — so the class cannot be told from metadata. It does not need to be: the
`documents/{docId}/default/` form serves both.

### §1.3 The three options, decided

1. **Re-crawl and update the ids** — the brief's first option, and the measurement changes what it
   means: there are no new ids to find, only a `documentId` to capture. **DONE**:
   `scripts/ingest/committees-doc-index.ts` sweeps the Publications LIST endpoint (the same lesson
   `sweep-committees.ts` learned — the list carries what the detail carries) into
   `committee_publication_document`. **260 calls at Take=200, ~2 minutes, no LLM, no R2.**
2. **Mark the rows unavailable** — correct for the `no-document` class, and ⚠ **it would not work
   today.** `corpus_sections.availability_status` exists and is carried into the FTS index, but
   **nothing at serve time filters or labels on it** (grepped across `lib/` and `app/`). Marking
   ~10,000 publications would change no user-visible behaviour on its own.
3. **Leave it** — refused for the repairable class, which is a one-join fix.

▶ **What is NOT done, and whose it is.** The stored `sourceUrl` is untouched and the web resolver
is unchanged, so **the 35.7% is still 35.7% for a user today.** The remaining step is a downstream
one and the brief assigns it there ("fixed at display time in `lib/lex/committee-url.ts`"): join
`committee_publication_document` in the hydrate that `fts-search.ts` / `vector-search.ts` already
run, and emit `…/documents/{document_id}/default/` where `document_id` is non-null.

⚠⚠ **AND WHERE IT IS NULL, KEEP THE `/html/` LINK — MY FIRST VERSION OF THIS RECOMMENDATION SAID
"NO LINK AT ALL" AND THAT WAS WRONG.** `document_id IS NULL` means *no file listed in the API*, not
*nothing to open*: measured on 60 held publications with no API file, **27 (45.0%, 95% CI
33.1–57.5%) still return 200 at `/publications/{id}/html/`**. Dropping the link would have removed
working citations from nearly half that class. The corrected rule is in `publicationUrl()`, which
returns the URL **and** whether it is `measured` or a `best-guess`.

I have not made the web change in another thread's file mid-sprint; the data it needs now exists.

**The join was run and its output probed, rather than being recommended untested:**

```sql
LEFT JOIN committee_publication_document d
  ON d.publication_id = NULLIF(split_part(s."parentDocId", ':', 2), '')::int
```

```
stored    https://committees.parliament.uk/publications/42694/            404
resolved  https://committees.parliament.uk/publications/42694/documents/299116/default/   200
```

⚠ **Two further resolved URLs came back 403 rather than 200 and are NOT counted as working.** After
~1,600 probes in one afternoon the site rate-limits this client, which is the same 403 that opened
§1.4 — worth knowing before anyone verifies the downstream change: **space the probes, and treat a
403 as "ask again later", never as a verdict.**

### §1.4 Two defects in my own measurement, both caught by the data

⚠⚠ **The first run returned 403 on 300 of 300 probes.** `committees.parliament.uk` refuses Node's
`fetch` regardless of User-Agent — Cloudflare fingerprints the TLS handshake, and curl's is
accepted. **This is documented in our own `sources/committees-portal.ts` and I did not read it
first** (CLAUDE.md §17: *read our own code before the internet*). The classifier did behave
correctly — it called them `error`, never "dead", which is exactly the trap §1 of the brief warns
about. The script now uses curl and **refuses to start unless a live canary returns 200 and a known
dead one does not**, so this class of run can never again produce a formatted table of nothing.

⚠⚠ **The corrected run then reported two `gone` verdicts, and both were a 403.** I had applied "a
403 is our problem, not a statement about the document" to the site URL and **not** to the document
URL — so the one class the brief hypothesised got two instances manufactured out of rate limiting.
Fixed, with the three cases **watched failing before the fix**. Its true count is zero.

⚠ A third, smaller one: a targeted `--ids` re-probe **overwrote a completed 500-id run's output
file**. `--out` now exists so a partial run cannot destroy a complete one.

---

## §2 — THE SURFACE ON THE EDGE

### §2.1 Most of it was never missing

`schema-amd2.sql` recorded, honestly, that a per-appearance surface could not be supplied:
`graph_edge` had no column, `corpus_sections.speaker` is NULL on 5,000 of 5,000 sampled
committees-evidence rows, and `graph_alias` is keyed on (entity, source). So every mention showed
the entity's canonical name with `surface_is_per_entity = TRUE`.

⚠⚠ **But two tables already held the name as the record printed it, for 2.5M mentions:**

```
division_votes.member_name   2,528,032 rows   the name as the division record printed it
edm_sponsor.sponsor_name        60,995 rows   the name as the motion record printed it
```

Those needed no column, no sweep and no backfill — only a view that stops discarding them. **93.4%
of all mentions gained a real surface the moment the views were replaced.**

### §2.2 The grain, which is the one design decision

The brief asks for "one column on the edge". An edge is (subject, predicate, object) **aggregated
over every appearance behind it**, so one surface on an edge is only truthful when every appearance
used the same one. So it is recorded in both places, saying different things:

| | |
|---|---|
| `graph_evidence.subject_surface` | **the fact** — one appearance, one surface, exactly as matched |
| `graph_edge.subject_surface` | the FIRST surface seen for this edge, for display |
| `graph_edge.subject_surface_varies` | TRUE when a later appearance used a different one |

**The flag is not hypothetical.** Real pairs from the backfill:

```
"National Police Chiefs' Council"              vs  "National Police Chiefs Council"
"London School of Hygiene & Tropical Medicine" vs  "the London School of Hygiene and Tropical Medicine"
```

Showing either as *the* name in the record would be the invented fact Amendment 2 refused to
commit. `graph_mention` now exposes `display_name`, `recorded_surface`, `surface_varies` **and**
`canonical_name`, so a screen can say *"Sir Lindsay Hoyle (recorded as: Hoyle, rh Sir Lindsay)"*
and mark it when other forms exist.

⚠ **An INFERRED edge carries NULL, on purpose.** `holds-position` is derived from other edges, so
"the name as it appeared" has no referent; filling it from the canonical name would manufacture the
claim. 16,196 inferred mentions, 0 with a surface, asserted by the verify.

### §2.3 What it cost and what it covers

| storage | mentions | with a recorded surface | surfaces vary |
|---|---:|---:|---:|
| derived (votes, motions) | 2,537,466 | **2,537,466 — 100%, from a view change alone** | n/a (one appearance each) |
| stored (committees, interests) | 164,238 | **164,131 — 99.93%**, from two sweep re-runs | **1,470** |
| inferred (holds-position) | 16,196 | **0, correctly** | — |

**The two sweep re-runs cost 36.5 minutes and ~4 minutes, and no LLM tokens** — committees: 143,849
items seen at source, 174,235 edge upserts, 54 new entities; interests: 3,415 interests, 100%
attached, 1,822 edge upserts. Per predicate: `gave-evidence-to` **162,626 of 162,733**,
`declared-interest` **1,505 of 1,505**.

⚠ **107 `gave-evidence-to` edges still carry NULL, and that is the correct outcome.** Their source
item was not returned by the API on this pass, so nothing was written — rather than the canonical
name being substituted and flagged as though it were the record's.

The surfaces are genuinely the record's, not a copy of ours: **794,019 differ from our canonical
name**:

```
"Northeastern University London"        recorded as  "Northeastern University - London"
"News Media Association"                recorded as  "The News Media Association"
"British Vehicle Rental and Leasing…"   recorded as  "British Vehicle Rental & Leasing…"
"Medical Women’s Federation"            recorded as  "Medical Women's Federation"
"Zenobē"                                recorded as  "Zenobe"
"Mrs Theresa May"                       recorded as  "Theresa May"
```

⚠ **The last two are the argument for the whole change in one line.** `Zenobē` / `Zenobe` and the
two apostrophes are OUR normalisation, not the record's — and until now the record's own spelling
was unrecoverable.

### §2.4 A check I deliberately broke, and one I found broken

⚠ **`verify-amd2.ts` asserted `surface_is_per_entity IS NOT TRUE` → 0.** That was right when it was
written — the flag was a constant. After this change it failed with **bad = 2,548,656**, which is
the correct behaviour for a check whose premise has been deliberately changed: go red, be
re-decided, never quietly keep passing. It now asserts the invariant that was always meant — never
claim a surface we do not hold, and never hide one we do — in both directions.

⚠⚠ **AND A SEPARATE CHECK IS RED, IT IS NOT MINE, AND IT IS A LIVE USER-FACING DEFECT.**
`verify-amd2.ts`: *"no MENTION-ONLY actor is carrying a stable key"* — **bad = 1,785**.
`match-registers.ts --promote` writes `companies_house_no` / `charity_no` onto `graph_entity`
**without updating `key_source`**, so those entities still read `singleton` → tier `mention-only`.
Measured: **1,471 singletons carry a Companies House number and 763 a charity number.**

In user terms: **1,785 organisations are shown as "The name as it appeared, and nothing more" while
we hold a stable public identifier for them.** `graph_identity_tier` already classes both as tier 1
— the decision was taken in advance, and the promoter simply never recorded it. The fix is one line
in `match-registers.ts` plus one UPDATE. ▶ **Not run: it changes what 1,785 entities claim about
their own identity, which Amendment 2 says is a decision made on purpose. CC-GRAPH's call.**

---

## §3 — VERIFICATION

- `committees-freshness.ts --self-test` — **16/16**, including four refusal cases (403, 5xx, network
  fault, unprobed) and the three added after the `gone` defect, **watched failing first**
- `verify-surface.ts` — 6 sections pass, **negative control fires**: the invariant is re-run against
  a fixture planting all four ways of lying about a surface and must catch 4 of 4
- `verify-amd2.ts` — the surface assertion passes; the register-promotion failure above is
  pre-existing and reported, not masked
- `setup-surface.ts` printed the target host and refused any DROP before applying (CLAUDE.md §16)
- `tsc --noEmit` in `scripts/ingest` — no new errors from these files (the project's 23 pre-existing
  cross-project errors are unchanged)

⚠ **Neon is at 16.63 GiB — 95.0% of the 17.5 GiB ops ALERT line.** Not the enforced ceiling (V38
established that is 16 TiB, read from the compute), but the alert exists to be noticed. This
sprint's DDL adds three columns and one small table.

---

## §4 — WHAT IS NOT DONE

- **The web resolver for committee publications** — the data now exists; the join does not. §1.3.
- **Marking the ~10,000 `no-document` publications** — and ⚠ marking alone would change nothing,
  because no serve path reads `availability_status`. Both halves are Charlie's call.
- **`match-registers.ts`'s key_source omission** — 1,785 entities, reported to CC-GRAPH, not fixed.
- **107 `gave-evidence-to` edges carry no surface** — their source item was absent from the API on
  this pass. Left NULL rather than filled; `verify-surface.ts` reports the live figure.
- **`committees-doc-index.ts` stopped at 40,800 of 51,854 publications**, covering **37,917 of the
  45,610 we hold (83.1%)** — 26,547 with a file, 11,370 without. It is idempotent, so finishing it
  is a re-run; a missing row costs coverage only, because the resolver falls back to `/html/`.
- **Which of the ~11,000 no-file publications actually open is known only to ±12pp** (45.0% on
  n=60). A one-off probe of that class would turn a 45% guess into a stored fact per publication —
  ~11,000 polite requests, a few hours, no LLM.
- **The 2 unresolved probes** of the 500 — still 403 after a slow re-probe. Excluded from every
  rate rather than assumed to behave like the rest.
