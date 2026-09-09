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

## THE FOUR THINGS IT KEEPS APART, AND NEVER SUMS UNNAMED

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
4. **`caselaw-markup`** *(GRAPH 5)* — a judgment citing a provision, from the `<ref>` elements in
   The National Archives' Akoma Ntoso. ⚠⚠ **Every one carries `uk:origin="TNA"`: the court did not
   mark these up, the publisher's enrichment did.** Stronger than our own name-matching, weaker
   than a source asserting its own meaning — which is exactly why it is not called `markup`.
   The *words* quoted are the court's own; the *identity* is TNA's assertion.

⚠ **A probe defined by exclusion is not safe here.** `coverage.ts`'s enabling-power layer counted
`detection NOT IN ('markup','text')` and silently absorbed 1,288,630 case-law rows the day this
fourth value appeared, reporting 1,479,888 where the truth was 191,258. Nothing failed; the number
simply grew in the flattering direction. **Every detection probe is named positively.**

## IDENTITY

One resolver, `graph/identity.ts`, and one table, `legislation_identity`, that every join reads.
Pre-1963 Acts are cited by regnal year and the two graph tables record them under different forms; a
join on the raw identifier drops every one of them **and the loss reads as a coverage result, not as
a bug.** Every equivalence has a named basis — the source's own enumeration, a declared prefix
family, or leading zeros. ⚠ **Never similarity.** A form that names more than one instrument is
recorded as a *refusal*, not resolved by first-wins, because a refusal that is merely absent from the
table cannot be counted.

## ⚠⚠⚠ THE LINE THE CASE-LAW HALF MUST NOT CROSS

**We never say a provision or a case is "no longer good law".** That is a legal conclusion, people
act on it, and being wrong about it could cost somebody badly. **We report the treatment, quote the
words, cite the judgment, and let the reader conclude.** This is the never-claim rule in its most
consequential form anywhere on the platform.

It is enforced by the schema, not by care: `caselaw_treatment_edge` has **no column** matching
`good_law`, `status`, `valid`, `authority_score`, `superseded` or `overturned`, and
`check-graph5-treatment.ts` fails if one appears. There is nowhere to put the conclusion, so nothing
can compute one by accident. ⚠ *"Considered"* and *"mentioned"* are likewise not treatments and have
no pattern: **an unclassified citation is an honest result, and most citations are exactly that.**

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

Reading of **2026-09-08 22:52 UTC**, after GRAPH 5 §2.4:

```
COVERAGE — what this answer could NOT see (generated 2026-09-08T22:54Z)
  searched:
    markup-citations — references the document asserted by <Citation URI> (385,346 rows)
    text-citations — act NAMES resolved in running text against corpus_acts titles (649,202 rows)
    enabling-power — made-under: "this instrument was made under section N of that Act", with the enacting words attached (191,258 rows)
    case-law-citations — a judgment citing a statutory provision (1,288,630 rows)
    case-to-case-citations — a judgment we hold citing another CASE, whether or not we hold that case (565,931 rows)
  NOT searched:
    amendment-effects — amends / repeals / commences / modifies, from TNA’s own effects data
        held in legislation_edges (1,997,033 rows), not joined here
        consequence: a repeal or amendment is not a citation and is not returned by this query
    treaty-obligations — a treaty article bearing on a domestic provision
        NOT BUILT
        consequence: a change may be prevented by an international obligation that this graph cannot see
  detector split (never summed unnamed):
    caselaw-markup — 1,288,630 rows from 52,861 documents
    text — 649,202 rows from 61,127 documents
    markup — 385,346 rows from 35,898 documents
    enabling — 191,258 rows from 70,576 documents
  rows whose reference is not inside a provision: 639,120 of 2,514,436 (25.4%)
    — an Act named in a title, long title or explanatory note. A real reference; not a provision that breaks.
  rows whose target is an instrument the corpus holds no text for: 185,069 (7.4%)
  measured at extraction time:
    dta_orders_recoverable_from_held_bytes: 127 — double taxation Orders whose scheduled agreement is ABSENT from the corpus but PRESENT in the bulk CLML already on disk. No fetch is needed to recover these; an ingest pass is. The remainder need the source.
        measured 11.9 days ago by graph/audit-4b-tax.ts
    identity_ambiguous_calendar_forms: 419 — calendar-year id forms that name MORE THAN ONE Act, because two parliamentary sessions can fall inside one calendar year and each numbers its chapters from the start. REFUSED a bridge and recorded as refusals, never resolved by first-wins.
        measured 11.9 days ago by graph/audit-4b-identity.ts
    madeunder_section_refs_wrong_pct: 36.1 — percentage of the pre-2026-08-28 preamble parser's SECTION-level refs that were wrong — a bracketed subsection read as a section, or a ref list attached to a different Act named in the same preamble. legislation_edges still holds them; citation_edge's enabling rows were written by the fixed parser.
        measured 11.9 days ago by graph/audit-4b-layer2.ts
    oi15_documents_skipped: 2,431 — documents in the bulk CLML file the shipped calendar-year entry filter skipped, of the total it should have read
        measured 13.4 days ago by graph/audit-4a-blast-radius.ts
    oi15_residual_edges: 924 — citation edges recoverable from the pre-1963 documents the July cites extractor never opened; the residual against legislation_edges, which has NOT been re-extracted. citation_edge itself reads every document.
        measured 13.4 days ago by graph/audit-4a-t2-hole.ts
    si_schedule_retention_pct: 41.3 — percentage of sampled instruments whose bulk-CLML schedule also reached the corpus as a schedule section. A schedule the ingest dropped presents as a SHORT DOCUMENT, not as an error, so this bounds every answer that depends on scheduled text — a treaty above all.
        measured 11.9 days ago by graph/audit-4b-schedules.ts
    unresolved_act_name_spans: 97,095 — act-name spans in running text that resolved to no instrument we hold a title for — short forms ("the 1998 Act"), pre-1963 Acts under the other id form, and Acts the corpus does not hold. Counted, never dropped silently; short-form resolution is not built.
        measured 13.4 days ago by graph/audit-4a-t3-spans.ts
    unresolved_spans_in_target_docs_pct: 29.9 — percentage of those unresolved spans sitting in a document that also carries a resolved citation to one of twelve research-target Acts — the number that decides whether short-form resolution is urgent
        measured 13.4 days ago by graph/audit-4a-t3-spans.ts
  identity bridge (pre-1963 Acts are cited by regnal year, and the two graph tables disagree):
    13,454 id forms resolve to a canonical identity
    regnal-form targets in this table: 1,219, of which 39 have no calendar twin
        — those cannot be joined against a table that keeps calendar forms, and are counted, not guessed at.
    ⚠ calendar-form targets REFUSED a bridge because they name more than one Act: 77
        — two parliamentary sessions inside one calendar year, each numbering its chapters from the start.
  schedule coverage: 9,418 of 109,202 instruments hold a schedule section (8.6%)
    — ⚠ a scheduled agreement that was not ingested presents as a SHORT DOCUMENT, not as an error.
  case targets, by whether we hold the judgment (⚠ an unheld target must never render like a held one):
    565,931 citation edges reaching 137,153 distinct authorities
    held: 32,990  ·  NOT held: 75,366  ·  unknown: 28,797
    — ⚠⚠ "unknown" is a law report citation at or after our floor: we MAY hold that judgment under
      its neutral citation, unlinked. Calling it not-held would say we lack something we have.
    — ⚠ an authority we do not hold is a node with NO TEXT. What is shown for it is the passage from
      OUR judgment that cites it, never a headnote and never an extract of the judgment itself.
  CASE-LAW COVERAGE — the window these edges could have been found in (generated 2026-09-08T22:54Z)
      et-decisions — 161,753 documents, CONTINUOUS FROM 2017 to 2026
          ⚠ 4 documents carry no date and cannot be placed inside or outside this window.
      tna-caselaw — 74,896 documents, CONTINUOUS FROM 2003 to 2026
          ⚠ 239 older items are held, back to 1965-08-09 — a scatter of survivors, NOT a line of authority.
            An authority from that period is far more likely to be absent than present, and its absence is not evidence.
      cma-cases — 22,898 documents, CONTINUOUS FROM 2003 to 2026
          ⚠ 15 older items are held, back to 2001-04-18 — a scatter of survivors, NOT a line of authority.
            An authority from that period is far more likely to be absent than present, and its absence is not evidence.
          ⚠ 20,336 documents carry no date and cannot be placed inside or outside this window.
      tax-tribunals — 13,099 documents, CONTINUOUS FROM 2003 to 2024
          ⚠ 34 older items are held, back to 1989-11-09 — a scatter of survivors, NOT a line of authority.
            An authority from that period is far more likely to be absent than present, and its absence is not evidence.
          ⚠ 1,010 documents carry no date and cannot be placed inside or outside this window.
      scottish-courts — 13,070 documents, CONTINUOUS FROM 1999 to 2026
      ni-judgments — 7,927 documents, CONTINUOUS FROM 2002 to 2026
          ⚠ 244 older items are held, back to 1984-09-07 — a scatter of survivors, NOT a line of authority.
            An authority from that period is far more likely to be absent than present, and its absence is not evidence.
          ⚠ 155 documents carry no date and cannot be placed inside or outside this window.
      echr-hudoc — 4,460 documents spanning 1956 to 2026, with NO YEAR FROM WHICH IT BECOMES CONTINUOUS.
          ⚠⚠ Density varies across the span rather than starting at a floor, so neither the
            presence nor the absence of any one decision says much about the period around it.
          ⚠ 50 documents carry no date and cannot be placed inside or outside this window.
    ⚠⚠ An authority outside a collection's window CANNOT appear in these results, and this
       platform has been measured returning a DIFFERENT case with a similar name in its place.
       A short list here is a statement about our holdings, never about the law.
```

## WHAT IT CANNOT DO TODAY

Named here so nobody has to infer it from an empty result:

- ~~**No case law.**~~ **BUILT, GRAPH 5, 8 September 2026** — 1,288,630 edges from 74,896 TNA
  judgments, and a separate `caselaw_treatment_edge` for how courts have treated a case or a
  provision. ⚠ **But only for England & Wales and the UK-wide courts, from 2003.** The raw markup
  the extractor depends on exists for `tna-caselaw` alone; `et-decisions`, `scottish-courts`,
  `ni-judgments`, `tax-tribunals`, `echr-hudoc` and `cma-cases` — **218,207 documents, 74% of the
  case-law corpus** — carry no raw XML and contribute nothing.
  ⚠⚠ **And the judgment structure cannot say whether the case TURNED ON a provision or merely
  recited it**: 74,896 of 74,896 judgments carry `<decision>` and no other division, so the
  reference is stored flat and no column pretends otherwise.
- **A case we do not hold is now a NODE, but only inbound** *(GRAPH 5 §2.4)* — 565,931 edges to
  137,153 distinct authorities, **54.9% of which we do not hold and 21.0% of which are `unknown`**
  (a law-report citation at or after our floor that may already be held under a neutral citation).
  ⚠ We can say what cites *Wednesbury*; we cannot say what *Wednesbury* cited. **A line of authority
  can be walked forwards from a case we hold and never backwards through one we do not.**
  ⚠⚠ For an unheld authority the platform shows the passage from OUR OWN judgment that cites it —
  never a headnote, never an extract of a judgment we lack, and **nothing is ever fetched from
  BAILII**, which is asserted against the extractor's source rather than promised in a comment.
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
| the extractors | `extract-citation-edges.ts` (markup + text) · `extract-enabling-edges.ts` (enabling) · `extract-caselaw-citation-edges.ts` (case law) |
| the treatment layer | `caselaw_treatment_edge` · `treatment-patterns.ts` · `extract-caselaw-treatment.ts` |
| the case-to-case layer | `caselaw_case_edge` · `extract-caselaw-case-edges.ts` — ⚠ inbound only, and `held_state` is THREE-valued |
| the case-law boundary | `caselaw-coverage.ts` — ⚠ a derived FLOOR per collection, never `MIN(date)` |
| the checks | `check-25h-*`, `check-4a-coverage.ts`, `check-4b-identity.ts`, `check-4b-layer2.ts`, `check-graph5-*` (prereq · boundary · citation · treatment) |
