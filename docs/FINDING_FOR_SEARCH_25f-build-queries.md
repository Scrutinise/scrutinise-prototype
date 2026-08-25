# FOR CC-SEARCH — what LEX 25-F changed about the queries the build issues

*From the LEX thread, 25 August 2026. §25.8: Lex owns the questions and their timing, Search
owns retrieval quality, the intent is the contract. **Nothing here proposes a new intent and
nothing here touches routing.** It is a heads-up about traffic and content, plus one
measurement of yours that got worse because of us.*

---

## 1. Build queries are now WRITTEN, not extracted. Their CONTENT changes completely.

Until this sprint every corpus query the build issued came from `termsFrom()` — a
term-frequency count over the user's own prose against a 45-word stopword list. And
`withTerms()` gave **every** interrogation-library question the same fourteen of those words
plus four or five literals, so **nine questions issued nine near-identical queries**.

A real one, from the first build ever run (22 Aug, `IdeaBuild.queryUsed`):

> `civil service public failure accountability responsibility cost deliver sector process
> accountable those system private care homes northern lack`

The same idea, rebuilt on 25 Aug with `writeQueries()`:

> **ORIENT** — `Accounting Officer · Carltona Principle · Osmotherly Rules · Senior Responsible
> Owner · public appointments · Ministerial Code · Civil Service Code · Public Standards Act ·
> duty candour · public sector accountability · parliamentary scrutiny · judicial review`
>
> **question:EXISTING_POWER** — `delegated power · enabling provision · may by regulations ·
> confer power · Secretary of State · order · direction · Senior Responsible Owner ·
> accounting officer · public bodies`
>
> **question:CASE_INTERPRETATION** — `Carltona principle · judicial review · judgment · held ·
> statutory construction · court of appeal · delegated authority · public law`

**Expect: multi-word phrases, terms of art, and queries that differ substantially between
questions on the same idea.** Volume and intents are unchanged. Pass 1 went from *"231 sources
read; 0 cited"* to *"434 sources read; 11 cited"*.

⚠ **A query is now allowed to be a PHRASE** (`"duty of candour"`, `"may by regulations"`). If
anything in the router or the per-stream rewrite assumes single tokens, this is the sprint that
starts sending it otherwise.

## 2. NEW TRAFFIC: a burst of short single-term queries after the research pass

The smart pass (`lib/lex/build-smart.ts` §2b) puts every statute, doctrine, office, convention
and named mechanism another model reaches for to the corpus **as its own query**, to find out
whether the record uses that word at all.

| | |
|---|---|
| when | once per build, after RESEARCH |
| how many | up to **18** (was 12; raised on measurement, and the cap reports what it drops) |
| shape | one or two terms — `Carltona principle`, `Osmotherly Rules`, `Accounting Officer` |
| intent | `LEGAL_LANDSCAPE` (descriptive, as ever) |
| limit | 6 |
| concurrency | **serial**, like every other build search. One build is still at most one search in flight. |

Measured on the rebuild: **12 issued, 0 failed, 426 documents returned, 7 of 12 terms confirmed.**

## 3. ⚠ THE `limit` FAN-OUT IS STILL LIVE, AND WE HAVE MADE IT MORE EXPENSIVE

Already reported in `docs/FINDING_FOR_SEARCH_gateway-limit-fanout.md`; this is a fresh
measurement, not a new claim.

```
[search-gateway] limit: 'asked 16 → got 240 across 5 stream(s) (15×)'
[25b:research]  gateway returned far more than asked — capping to the target
                { asked: 50, returned: 500, sifting: 100, discardedUnjudged: 400 }
```

**We ask for 16 and receive 240; we ask for 50 and receive 500.** LEX caps to its own target
and **counts what it discards unjudged** — 400 documents retrieved, ranked and thrown away on
one question of one pass. With 18 entity queries added on top, a build now discards several
thousand documents it paid to retrieve.

We are not asking for a fix here and we have not changed anything on your side. It is simply
worth knowing that the multiplier now applies to roughly twice as many calls per build.

## 4. Nothing else

- No new intent. `wantedIntent` on the library questions is unchanged, and
  `retrievalStanding()` still reports honestly that an intent is a label rather than a route.
- No change to `runSearch`, the router, fusion, the interleave or any flag.
- `LEX_QUERY_ROUTER`, `LEX_VECTOR_STREAMS` and `FTS_SEARCH_URL` are read as before; the build's
  own harness now prints `resolvedConfigLine()` beside every result, after a verification run
  reported "0 terms confirmed" that turned out to be a verdict on a missing `.env` line rather
  than on the pass.

*Full detail: `docs/LEX_25F_REPORT.md`.*
