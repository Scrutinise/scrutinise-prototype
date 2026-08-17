# DECODE AT RENDER — THE OPTION CHARLIE CHOSE, BUILT, MEASURED, AND WIDER THAN IT LOOKED

**Executes:** the open decision left by `docs/ENTITY_DECODE_REPORT.md` §4 — *decode-at-render now,
fold the R2 rewrite into the next reprocessing pass*
**Written:** 17 August 2026, 14:26 UTC
**Owner:** CC-Ingest (read side)
**Cost:** ~$0.00 — every measurement is a query, an HTTP call or a local read. No LLM tokens.

---

## THE HEADLINE

| | |
|---|---:|
| served hits carrying a literal entity, live FTS, 7 scoped probes | **38 / 321** |
| the same documents, read through `runFtsSearch` after the change | **38 / 38 clean** |
| results reaching a caller with a literal entity, all probes | **0 / 381** |
| read paths given the decode | **10** |
| **stored values found contaminated that the 17 Aug repair never covered** | **6,840** |
| guards added | 5 in `check:render-decode` + 1 in `check:entity-decode`, **all six watched failing first** |
| R2 objects rewritten | **0 — that was the point of choosing this option** |

⚠ **The one number that changes the picture: 6,840 contaminated values in tables nobody had
measured.** The 17 Aug repair rewrote `corpus_sections`. It did not touch `corpus_acts` (57 titles),
`LegislationSection` (1,838 titles + 4,874 bodies), `LegislationItem` (57 titles) or
`OperationalSection` (14). Those are the legacy legislation tables — the ones `lib/search.ts`, the
Act browse list and the Act detail page read. Decode-at-render covers all of them today, but they
are stored values and they are still wrong in the database.

---

## §1 — WHAT WAS MEASURED, BEFORE ANYTHING WAS CHANGED

`npm run measure:render-decode` (`scrutinise-web/scripts/measure-render-decode.ts`), read-only.

### §A — the stored values, on Neon

| table.column | rows with a literal entity | note |
|---|---:|---|
| `corpus_sections.sectionTitle` | **0** | repaired 17 Aug — holds |
| `corpus_sections.speaker` | **0** | repaired 17 Aug — holds |
| `corpus_sections.attribution` | **0** | repaired 17 Aug — holds |
| `corpus_acts.title` | **57** | ⚠ never measured before |
| `LegislationSection.sectionTitle` | **1,838** | ⚠ legacy, served by `lib/search.ts` |
| `LegislationSection.originalText` | **4,874** | ⚠ legacy, the FTS body behind `ts_headline` |
| `LegislationItem.title` | **57** | ⚠ legacy act titles |
| `OperationalSection.pageTitle` | **2** | ⚠ `&#xA3;5,000` in a sentencing guideline |
| `OperationalSection.extractedText` | **12** | ⚠ `INTM161270 &amp; 161280` |

**The dominant form here is not the corpus's.** The census found `&#8217;`/`&#8220;`/`&#xa0;` —
typography. These tables are full of `&amp;c.`, the statutory *"&c."* abbreviation escaped once too
often: `Docks, &amp;c.`, `Weights and Measures &amp;c. Act 1976`, `under 8 &amp; 9 Vict. c. 19`.
⚠ **And this is the case the decoder was explicitly built to get right in BOTH directions**: a bare
`&c;` is left alone (it is not an entity, it is how old statute abbreviates *et cetera*), while
`&amp;c.` decodes to `&c.` because that is markup escaping itself. Both are asserted in
`check:render-decode` §2 as refusal cases.

### §B — the served values, live

Seven corpus-scoped probes against `fts-serve-production`, 50 hits each, **the scope refused rather
than assumed** (the probe fails if the service does not echo the corpus filter back).

| corpus | hits | snippets carrying one |
|---|---:|---:|
| `hmrc-codes-guidance` | 50 | **23** |
| `committees-evidence` | 50 | **11** |
| `planning-policy` | 50 | **4** |
| `tna-caselaw` | 50 | 0 |
| `building-regs` | 21 | 0 |
| `eur-lex` | 50 | 0 |
| `pwdata-debates` (control) | 50 | 0 |
| **total** | **321** | **38 (11.8%)** |

⚠ **`tna-caselaw` served ZERO despite being 95.3% contaminated at document level.** The two numbers
measure different things and must not be conflated: the census asked *does this document contain an
entity anywhere*, the probe asks *does the 30-word window the searcher is shown contain one*. A
document-level rate is an upper bound on the served rate, never an estimate of it. One unscoped
vector probe: 1 snippet in 50.

---

## §2 — THE CHANGE

**One decoder, ten read paths, no rewrite of anything stored.**

`scrutinise-web/lib/html-entities.ts` is a **forced copy** of
`scripts/ingest/shared/html-entities.ts` — the Next build root is `scrutinise-web/`, so a file above
it is not in the deployment and cannot be imported. What is *not* forced is letting the copies
drift, so the shared region is delimited by markers and compared **byte-for-byte from both sides**.

`decodeForDisplay` is deliberately an alias of `decodeForIndex`, the same function the ingest uses
to decide what a document says. A weaker read-side repair (decode without the invisible-character
strip, say) would make a soft-hyphenated word read one way in the index and another on the page —
reintroducing, in the repair, the exact failure the repair exists to remove.

| read path | why it is on the list |
|---|---|
| `lib/lex/fts-search.ts` | sparse hits — snippet/title/speaker built from R2 |
| `lib/lex/vector-search.ts` | dense hits — same index text |
| `lib/search.ts` | legacy legislation + operational FTS (1,838 / 4,874 / 12) |
| `lib/lex/gateway-legacy.ts` | R2 `.compiled.txt` + `.summary.txt` for the panel |
| `lib/lex/repeal-status.ts` | *"repealed by X"* names a `corpus_acts` title |
| `app/api/ideas/[id]/legislation-search/route.ts` | legacy fallback — same tables, same R2 |
| `app/api/legislation/test-sections/route.ts` | public research tool, shows stored + compiled text |
| `app/api/legislation/search/route.ts` | the browse list is titles and nothing else |
| `app/api/legislation/[itemId]/route.ts` | JSON twin of the Act page |
| `app/legislation/[itemId]/page.tsx` | the Act page — **no search step in front of it** |

⚠ **Only text is decoded. `id`, `corpus`, `tier`, `parentDocId`, `gid` and `repealed_by` are KEYS**
— they are joined against Neon, parsed for gids and used as fallback labels. A decoder anywhere near
them would change what a hit *points at* rather than how it *reads*.

⚠ **Decoding turns `&lt;script&gt;` back into `<script>`.** That is inert where corpus text is
rendered — React escapes text — and would be live inside `dangerouslySetInnerHTML`. The only such
call in the app is the static support page rendering its own markdown, and `check:render-decode` §5
holds that as an allowlist so it stays a checked fact rather than a remembered one.

---

## §3 — THE EVIDENCE THAT IT IS APPLIED, NOT MERELY PRESENT

⚠ **The 17 Aug fix shipped inert first** — it decoded into a new variable and returned the old one,
with `tsc` clean and the check passing. So the proof here is behavioural at three levels.

**1. The adapters are RUN, against a stubbed service serving a contaminated hit**
(`check:render-decode` §3). The fixture's `id`/`corpus`/`tier` are **copied from a real live hit**;
the first version invented `tier: 'evidence'`, which no `corpusToType` case matches, so the hit was
dropped and the check reported "no results" — a fixture that could not reach the code it tested.

**2. The same documents, live, before and after — tied by id.** §B recorded the ids it saw served
with an entity; §C looks those exact documents up again through `runFtsSearch`:

```
  planning-policy        60 results   0 carrying a literal entity   ·  4/4  of §B's contaminated documents come back CLEAN
  hmrc-codes-guidance    60 results   0 carrying a literal entity   · 23/23 of §B's contaminated documents come back CLEAN
  committees-evidence    60 results   0 carrying a literal entity   · 11/11 of §B's contaminated documents come back CLEAN

  0/381 results reach a caller with a literal entity
  38/38 of the documents §B served contaminated are clean by the time a caller sees them
```

⚠ **The id tie is what makes this evidence.** A clean §C over a *different* result set would be
equally consistent with "the contaminated documents simply did not come back this time".

**3. Every guard was watched failing on the exact broken form**, because a guard that has never
failed is not known to be a guard:

| guard | broken form it was watched failing on | what it printed |
|---|---|---|
| §1 drift (web) | `minus: '−'` → `'-'` in the web copy | `DIVERGED at byte 1350` with both sides quoted |
| §1 drift (ingest) | the same divergence | ⚠ **it PASSED — see below** |
| §3 inertness | decode into `decoded`, `return json.results` | 3 fields reported still carrying entities |
| §4 coverage | `decodeMaybe(i.title)` → `i.title` in the browse route | named the file and the missing call |
| §5 raw HTML | a temporary component using `dangerouslySetInnerHTML` | named the file, refused the allowlist |

⚠⚠ **THE DRIFT GUARD ONLY EXISTED ON ONE SIDE, AND WATCHING IT PROVED IT.** With the web copy
deliberately diverged, `check:render-decode` failed and `check:entity-decode` still reported *all
checks pass*. A drift guard on one side leaves the other side — whichever you happened to edit —
unguarded. The assertion is now in **both** checks, and was watched failing in both.

⚠ **Two of my own checks were wrong before they were right, and both failed the same way: they
tested the name rather than the thing.** §5 matched the bare identifier `dangerouslySetInnerHTML`
and flagged two files that only *mention* it in a comment — one of them the decoder's own
documentation. It now matches the call. §3's fixture is described above.

---

## §4 — VERIFICATION

- `npm run check:render-decode` — **§1–§5 all pass**; five guards, each watched failing first
- the legacy-index claim in §5 **checked against the live database rather than reasoned about**, and
  it turned out the reasoning was wrong — see §5
- `npm run check:entity-decode` (ingest) — all pass, now including the twin comparison
- `npm run check:html-entities` — **26/26**
- `tsc --noEmit` in `scrutinise-web` — **clean, exit 0**
- ⚠ `tsc --noEmit` in `scripts/ingest` — **red, and it was red before this change**: 23 pre-existing
  errors (`@prisma/adapter-pg` missing, and `rootDir` violations from ingest scripts importing web
  files). This change adds a **24th of that identical class** — `repeal-status.ts` now imports
  `@/lib/html-entities`, an alias the ingest tsconfig cannot resolve, exactly as it already cannot
  resolve the `@/lib/prisma` import on the line above it. **Runtime is unaffected and this was
  proven, not assumed**: `page1-config.ts` references `repeal-status` in *type position only*
  (`import('./repeal-status').RepealStatus`), which is erased, and importing the whole chain under
  `tsx` from `scripts/ingest` succeeds.

---

## §5 — WHAT IS NOT DONE, AND THE DECISION IT LEAVES

- **The R2 objects are unchanged** — ~184,000 of them, $0.90 + an index rebuild. That is what
  choosing decode-at-render means, and the recommendation stands: fold it into the next
  reprocessing pass rather than running it for its own sake.
- ⚠ **The 6,840 legacy stored values are still wrong in the database — and, MEASURED, they cost
  nothing in retrieval either.** I wrote that `LegislationSection.originalText` feeds the Postgres
  FTS vector and so `&amp;c.` would index as `amp` + `c`, then checked it instead of asserting it:

  ```
  "Docks, &amp;c."  →  'c':2 'dock':1
  "Docks, &c."      →  'c':2 'dock':1     ← IDENTICAL
  ```

  Postgres' default parser has an entity token type and **discards `&amp;` outright**, so the
  contaminated and clean forms produce the same tsvector. This is the same shape as the corpus
  finding one layer down (the `simple` tokeniser splits on the entity; this parser drops it) — the
  damage is to what a reader SEES, in both indexes, and to nothing else. ▶ **So the stored-value
  rewrite is a truth-in-the-database decision, not a search one. Charlie's call, and cheap:**
  ~6,840 UPDATEs across five columns with a trigger-driven tsvector recompute — no R2, no Heavy Job
  Runner, minutes. Not run, because the ask was decode-at-render and this is a different decision.
- **The 16 hand-rolled decoders in ingest sources** — unchanged, still held at their baseline.
- **`tna-caselaw`'s 95%** — unchanged, and now known to cost even less than thought at the surface:
  it served 0 contaminated snippets in 50.
- **Nothing was measured for the Lex chat surface end-to-end with a live model.** The decode sits
  upstream of it, in the adapters, so it inherits the repair; that is an argument, not a
  measurement, and it is labelled as one.
