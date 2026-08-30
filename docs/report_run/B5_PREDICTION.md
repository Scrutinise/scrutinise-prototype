# CCW-B5 — prediction, recorded before any resolution was attempted

**Written 2026-08-30, after reading `register_proposals.json` and `CCW-B5_register_resolution.md`,
before writing the resolver or querying `corpus_acts`.** B5 §5 requires it.

## The counts

14 proposals in. Predicting the disposition of each:

| | predicted |
|---|---|
| resolve to an instrument **named by the proposer** | **2** |
| resolve to an instrument that is **my identification** | **8** |
| **unresolved** | **4** |

### Named by the proposer — 2

Only **SP-02** (Human Rights Act 1998, Equality Act 2010) and **SP-05** (European Convention) carry a
named instrument in their verbatim text. CCW's own headline says the target statutes are named
exactly once in the whole thesis series, so I expect this number to be small and I expect it to be
these two.

⚠ Both are compromised in ways the row must carry: SP-02's naming is **Littlewood's**, not
Starkey's, and SP-05 names a **treaty**, which is not repealable by an Act at all.

### My identification — 8

SP-03 (quangos), SP-04 (Supreme Court), SP-08 (judicial review), SP-09 (civil service), SP-10 (DEI /
gender self-ID), SP-11 (Bank of England), SP-12 (charities), SP-13 (Sentencing Council). In every
one he names an institution, a practice or a defect, and no instrument.

### Unresolved — 4

- **SP-01** — the scope statement is a **date range**, not an instrument. Nothing to resolve to.
- **SP-06** — corroborates SP-05; carries no independent target.
- **SP-07** — parliamentary sovereignty is the **aim**, not a measure.
- **SP-14** — explicitly not a measure; it is his drafting standard, for the front matter.

## Three substantive predictions I expect to be able to check

1. **SP-01 is countable even though it is unresolvable.** "Legislation passed 1997–2010" is a query,
   not a guess. I predict the corpus holds **1,000–1,800 UK public general Acts** for 1997–2010, and
   that this number will be large enough to make the point that a temporal scope is a different and
   much larger drafting problem than twelve named measures.

2. **SP-10 rests on a mistaken premise and the corpus will show it.** Gender self-identification was
   never enacted in Great Britain. I predict the instrument actually in force is the **Gender
   Recognition Act 2004**, which requires a diagnosis and a panel — close to the opposite of self-
   identification. If so, the honest row says *there is nothing to repeal*, which is a finding.

3. **CRA 2005 will be the most-overlapped instrument.** WS-02, WS-03 and WS-09 already converge on
   it in `scoping_remaining.csv`; SP-04 makes a fourth. That changes what "twelve measures" means.

## What would make me wrong

- If **more than 4** proposals resolve to a proposer-named instrument, I have been too willing to
  read an institution's name ("the Supreme Court") as naming the statute that created it. That is
  exactly the error B5 §4.1 warns against, and it inflates his commitment.
- If **fewer than 3** come back unresolved, I have probably attached a weak instrument to make the
  table look finished — B5 §4.5's explicit prohibition.
