# THE CROSS-REFERENCE GRAPH — A DISTINCT CAPABILITY

*Standing document. Created 2026-08-28 by GRAPH 4B §5, on a message accepted from the LEX stream.*

CC-Lex reported that the cross-reference graph should be **its own listed graph in the search
infrastructure taxonomy**, not folded into the citation/amendment row. **Accepted.** This document is
the graph's own statement of what it is, so that anyone listing the platform's capabilities has
something to point at that is not a sprint report. CCh-Search reflects it in the strategy document;
nothing here belongs to search.

---

## WHAT IT IS

**One question: "what else in the statute book points at this?"** Not "what amended it" and not
"what repealed it" — those are effects, they come from TNA's own data, and they live in a different
table. This graph answers the question a repeal programme has to ask before it can estimate
consequence: *if this provision goes, what is left pointing at nothing?*

## WHAT IT IS NOT — AND WHY THE DISTINCTION IS LOAD-BEARING

| | table | what it holds | evidence? |
|---|---|---|---|
| **the cross-reference graph** | `citation_edge` | one row per *reference instance*, with the words that make it | ⚠ yes — `citation_text` and `raw_fragment` are `NOT NULL` |
| the effects graph | `legislation_edges` | one row per (from, to, type) *pair* of amends / repeals / commences / modifies / made-under / cites | no text column at all |

⚠⚠ **Calling either of them "the graph" is how a layer gets built twice.** They are different
questions over different grains with different provenance, and the effects graph is the sole holder
of over two million rows this one does not duplicate.

## THE THREE THINGS IT KEEPS APART, AND NEVER SUMS UNNAMED

Every row carries a `detection` value, and every count that reports more than one of them reports
them **separately**. This is not presentation — it is the difference between a right and a wrong
consequence list.

1. **`markup`** — the document asserted the identity itself, in a `<Citation URI>` attribute. The
   strongest evidence there is: the source said which instrument it meant.
2. **`text`** — we resolved the Act's *name* in running prose against `corpus_acts` titles. The
   target id is **derived**, not read. ⚠ Weaker, and it must never be quoted as if the document had
   asserted it. It also has to exist: the markup alone is roughly 2% complete.
3. **`enabling`** — the instrument's own enacting words say it was **made under** the target.
   ⚠⚠ **A different and stronger fact than a mention.** An instrument that merely mentions an Act
   survives its repeal; an instrument whose enabling power is repealed may fall with it. Flattening
   the two produces a confident, wrong answer, which is worse than a short one.

## IDENTITY

One resolver, `graph/identity.ts`, and one table, `legislation_identity`, that every join reads.
Pre-1963 Acts are cited by regnal year and the two graph tables record them under different forms; a
join on the raw identifier drops every one of them **and the loss reads as a coverage result, not as
a bug.** Every equivalence has a named basis — the source's own enumeration, a declared prefix
family, or leading zeros. ⚠ **Never similarity.** A form that names more than one instrument is
recorded as a *refusal*, not resolved by first-wins, because a refusal that is merely absent from the
table cannot be counted.

## ITS OWN COVERAGE STATEMENT

⚠ **This graph does not return a list. It returns a list and a statement of what the list could not
see** — `inbound()` returns `{ rows, coverage }`, and the signature is the point: a bare array lets a
caller present a short list as a complete one.

Every figure in that statement is **generated from live state on every call**. Two facts cannot be —
the extraction-run statistics — and those carry their measurement date and **announce themselves
STALE** past their freshness window. A check greps `coverage.ts` and fails the build if any string in
it states a figure about the corpus.

> ⚠ **The block below is a DATED READING, not documentation.** Regenerate it with
> `npx tsx graph/print-coverage.ts` rather than editing it; a caveat copied by hand goes stale
> silently, and this project has already had one figure survive being retired twice by living in a
> comment.

Reading of **2026-08-28 00:33 UTC**:

```
COVERAGE — what this answer could NOT see (generated 2026-08-28T00:33Z)
  searched:
    markup-citations — references the document asserted by <Citation URI> (385,346 rows)
    text-citations — act NAMES resolved in running text against corpus_acts titles (649,202 rows)
    enabling-power — made-under: "this instrument was made under section N of that Act", with the
                     enacting words attached (191,258 rows)
  NOT searched:
    amendment-effects — held in legislation_edges (1,997,033 rows), not joined here
    case-law-citations — NOT BUILT
    treaty-obligations — NOT BUILT
  rows whose reference is not inside a provision: 267,054 of 1,225,806 (21.8%)
  rows whose target is an instrument the corpus holds no text for: 172,316 (14.1%)
  identity bridge: 13,454 id forms resolve to a canonical identity;
    783 regnal-form targets, of which 13 have no calendar twin;
    77 calendar-form targets REFUSED a bridge because they name more than one Act
  schedule coverage: 9,418 of 109,202 instruments hold a schedule section (8.6%)
```

## WHAT IT CANNOT DO TODAY

Named here so nobody has to infer it from an empty result:

- **No case law.** A provision may be read down, disapplied or construed by a court with nothing here
  to show it.
- **No treaty obligations.** A change may be prevented by an international obligation this graph
  cannot see. ⚠ The OECD Multilateral Instrument modifies many double taxation agreements **without
  amending each Order**, so an agreement read off legislation.gov.uk can be out of date without
  saying so.
- **No user-facing surface.** Nothing under `scrutinise-web/` reads either graph table. Every answer
  this graph has ever given was given to a script.
- **Schedules are ingested but not completely.** A scheduled agreement that was not ingested
  **presents as a short document, not as an error.**

## WHERE IT LIVES

| | |
|---|---|
| the resolver | `scripts/ingest/graph/identity.ts` |
| the tables | `citation_edge`, `legislation_identity`, `graph_coverage_fact` |
| the query | `scripts/ingest/graph/inbound.ts` — `inbound()`, `inboundEvidence()`, `inboundSummary()` |
| the coverage block | `scripts/ingest/graph/coverage.ts` |
| the extractors | `extract-citation-edges.ts` (markup + text) · `extract-enabling-edges.ts` (enabling) |
| the checks | `check-25h-*`, `check-4a-coverage.ts`, `check-4b-identity.ts`, `check-4b-layer2.ts` |
