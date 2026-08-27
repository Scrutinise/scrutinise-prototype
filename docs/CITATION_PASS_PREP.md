# The citation pass — prepared, not built

**25-I §6. Written 2026-08-27. Nothing in this sprint implements it.**

Source proposal: `HANDOVER_lex_citation_pass.md` — a fifth Deepening pass that answers
*"you want to change section 3 of the Equality Act; forty-one other provisions refer to it,
and here is what each would need."*

§6 is explicit that this is a genuine differentiator and that it is **not in this sprint**.
Two things were asked for now, both cheap. Here they are.

---

## 1. The constraint that shapes it, before any design is settled

⚠⚠ **Any citation count this pass produces is a FLOOR, not a total, and the reason is in the
source data rather than in our code.** From `OPEN_ITEMS.md`:

**OI-16 — markup covers 2–5% of the cross-references actually in the text.** Measured over
6,045 documents against the bulk CLML: **5.4%** of body mentions of the Human Rights Act
carry `<Citation URI>` markup, **1.8%** of the Equality Act, and **0% of CRaG 2010** — the
very Act this sprint's own build kept surfacing as the existing power. A pass that quoted
markup-derived `cites` rows as "the citations" would be quoting about 2% of them.

**OI-18 — 93,772 act-name spans in the text pass resolve to nothing**, and 11.3% of the rows
that *do* resolve are not in a provision at all (an Act named in an SI's title, long title or
explanatory note — real references, but not provisions that break). Re-measured on 26 Aug as
97,095 spans over the same 132,990 documents: a **3.5% discrepancy with 25-H's own counter
that is unexplained and flagged rather than reconciled.**

⚠ And the obvious lever is the wrong one. Classifying the 60 commonest unresolved names
(30,472 spans): **title-absent 59.2% · title-mismatch 31.6% · short-form 9.3%.** The single
commonest unresolved name is *"the Interpretation Act (Northern Ireland) 1954"* — a full
title, not an abbreviation. **Short-form resolution would recover under a tenth of the gap.**

### What this forces on the pass, whatever else is decided

- **The coverage statement is mandatory and COMPUTED.** Never a hardcoded string. It must be
  derived from the same query that produced the count, for the Act in question, at the time
  it is shown — because coverage varies by Act across the full 0%–5.4% range, and a sentence
  that said "citation coverage is around 2–5%" beside a CRaG count of zero would be
  precisely wrong in the one case a user is most likely to test.
- **"Forty-one other provisions refer to it" is not a sentence we can currently write.**
  "Forty-one that we can see, from markup that covers a small and Act-specific share of the
  real references" is. The difference is the whole credibility of the feature.
- **Filter `source_provision_ref IS NOT NULL` for a repeal work-list**, and say that you
  did. The query surface deliberately does not do it for you, because a title reference is
  still a reference — it is just not a provision that breaks.

---

## 2. Charlie's §5 decisions — to be recorded when he gives them

The proposal's §5 asks four questions. They are **not** answered here; this is the shape for
recording them, so the answers land in one place rather than in a chat scroll.

| # | Decision | The recommendation in the handover | Charlie's answer |
|---|---|---|---|
| 1 | **Placement** | A fifth Deepening pass | *awaiting* |
| 2 | **Volume ceiling** | Group first, drill down on request | *awaiting* |
| 3 | **Cost** | — | *awaiting* |
| 4 | **Re-run cache keying** | Key on coverage state | *awaiting* |

⚠ On (4), one note that is not in the handover and that this sprint makes urgent: keying a
cache on *coverage state* means the key must change when the corpus does. `GRAPH_4A_REPORT.md`
decision Q4 proposes ingesting the absent Acts (`apni` above all — fifty years of NI primary
legislation, 2,602 references). **The day that lands, every cached citation answer becomes
wrong in the same direction at once** — undercounting — and nothing would invalidate them.
Whatever the key is, it has to include something that moves when the ingest moves.

⚠ On (2), a caution from 25-I's own experience: the "group first" recommendation is right,
but the grouped count is the number a user will quote to a committee. It is the number that
most needs the coverage sentence attached to it, not the drill-down.
