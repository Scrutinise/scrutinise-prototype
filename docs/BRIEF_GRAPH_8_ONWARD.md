# BRIEF_GRAPH_8 — THE ONWARD READER (one step, walkable)

Stream: Graph · 23 Oct 2026 · CCh-Search
Depends on: GRAPH_6 `effectsFor()` (live), GRAPH_7 `ideaLawSet()` (live)
Answers: CCh-Lex 26-V question 3 · blocks Lex 26-V's collision report at depth > 1

**Self-contained.** Everything needed is below.

---

## 0. THE ANSWER TO LEX'S QUESTION, FIRST

Yes, build the reader. One step, typed, walkable. But the thing it returns
is **not a cascade of consequences**, and the whole brief turns on that.

> **A citation is not a consequence.** If provision X cites provision Y and we
> amend Y, it does not follow that X changes. It follows that **a drafter
> should read X**. Those are different artefacts with different names, and
> conflating them would be the worst thing this product could do.

A *consequential schedule* is a real legal instrument: the amendments a Bill
must make to other Acts for it to work. It is drafted by a lawyer. Generating
one from citation reach would be manufacturing legal consequence out of
textual reference, published under our name, to a committee clerk.

So the reader returns **two different things, never merged**:

| | What it is | Does the data support it? | Depth |
|---|---|---|---|
| **A dependency chain** | Instruments made under a power; a power exercised. Repeal the power and what was made under it is genuinely in question. | **Yes — this is a real consequence** | Walk it until it ends |
| **A review set** | Provisions that refer to the one we are changing. Candidates for a drafter to read. | **Yes, as candidates only** | Depth 1 is useful. Depth 2 is weak. Depth 3 is noise — see §2 |

Lex's 26-V §3 "collision report" should be built on the first and should
present the second under a heading that says what it is. The
"Consequential amendments and repeals" annexe (233) must **not** be filled
from either.

---

## 1. WHAT THE DATA CAN SUPPORT

### 1.1 Edge kinds, strongest first

| kind | Source | What it means | Strength as a consequence |
|---|---|---|---|
| `made-under` / enabling | our extraction (`clml-si-preamble`) | this instrument exists because of that power | **Strong.** Repeal the power and this is directly in question |
| official effect (`amends` `repeals` `modifies` `commences`) | legislation.gov.uk | this provision operates on that one | **Strong**, and carries the change-the-words split from GRAPH_6 |
| `cites` | our extraction (`clml-body-citation`) | these words mention that provision | **Weak.** A candidate for review, nothing more |
| `caselaw-markup` | GRAPH 5 | a judgment refers to the provision | **Not a drafting consequence at all.** Useful as interpretation; exclude from the walk |

The reader must return the kind on every row and must never collapse them.
Lex's walk then uses strength, not depth, as its stopping rule.

### 1.2 Known branching, from GRAPH_6's five Acts

Inbound, per Act, for the two extracted kinds:

| Act | `made-under` | `cites` |
|---|--:|--:|
| Equality Act 2010 | 206 | 61 |
| Human Rights Act 1998 | 85 | 28 |
| Data Protection Act 2018 | 39 | 42 |
| Companies Act 2006 | 354 | 193 |
| Offences against the Person Act 1861 | 0 | 8 |

**No equivalent figure exists for the three marquee Acts.** Report them: CRaG
2010 (`ukpga/2010/25`), Civil Service (Management Functions) Act 1992
(`ukpga/1992/61`), Government Resources and Accounts Act 2000
(`ukpga/2000/20`).

## 2. WHAT THE DATA CANNOT SUPPORT — AND THE PREDICTION TO RECORD

### 2.1 Depth 3 by citation does not terminate usefully; it saturates

Record this prediction **before measuring it**, then measure it:

> On a well-cited Act, depth 3 by `cites` returns a substantial fraction of
> the statute book, because the statute book is densely interlinked. On a
> lightly-cited Act like CRaG 2010 it returns hundreds. **Either way the set
> is not reviewable by a human, and the proportion of it that genuinely needs
> amending approaches zero.**

Measure the real branching factor at depths 1, 2 and 3 for the three marquee
Acts and for the Equality Act, de-duplicated, and report the counts. If the
prediction is wrong, say so and the design changes. If it holds, **the
stopping rule is dependency strength, not a depth number**, and a depth-3
citation view should not be built at all.

A depth number is the wrong control because it treats a strong edge and a
weak one as the same hop.

### 2.2 `cites` rows carry no text — and that is the biggest limitation

GRAPH_6 §1.2: **0 of 121,279 `cites` rows in `legislation_edges` hold any
text.** The citing sentence lives in `citation_edge.citation_text`, which no
reader currently joins.

Without the sentence, a review set is a list of pointers. A drafter cannot
judge whether a citation matters without reading the words around it — the
difference between *"a person appointed under section 5 of the 2010 Act"* and
*"nothing in this section affects section 5 of the 2010 Act"* is the whole
judgement, and both are one `cites` row.

**Requirement: join `citation_edge.citation_text` and return the sentence on
every `cites` row that has one, with a count of those that do not.** This is
the single change that turns the review set from a pointer list into evidence.
⚠ Verify whether that stored text is itself truncated before displaying it as
a quotation — GRAPH_6 left the same question open on `made-under` phrases
(longest observed 179 characters, unverified). The test: count rows at exactly
the maximum length. A pile-up at one length is the signature of a limit; a
lone maximum is a natural distribution. **A truncated quotation displayed
without a mark is an invented quotation.**

### 2.3 Missing data removes a whole subtree, silently

At depth 1 a stale record means some rows are absent and the caveat says so.
At depth 2 and 3 **one missing edge removes everything beneath it, and
nothing in the output can show the gap.** The record is 108 days old and
primary-Act effects run ~11 months behind.

The caveat therefore has to get stronger with depth, not merely repeat:
depth 1 says *"as at 5 July"*; depth 2 and beyond say *"and any gap at the
step above hides everything below it"*.

### 2.4 Parts and Chapters cannot start a walk

GRAPH_7 §6.5: the corpus holds no Part rows, only the sections inside them.
A walk from `part/11` must return `unaddressable` — the Act checked, the
provision reported uncheckable here — never an empty list.

### 2.5 The identity bridge applies at every step

Regnal and calendar forms of the same Act. It has bitten three times now
(the 419 duplicate calendar ids; the Offences against the Person Act in
GRAPH_6; `ukpga/1801/52` in GRAPH_7). At depth 2 a missed bridge silently
drops every old Act from the tree. **Every hop resolves through
`legislation_identity`, not just the first.**

---

## 3. THE READER

```
onwardFrom(target, opts) -> {
  rows: OneStep[],
  unaddressable: { reason: string } | null,
  truncated:     { kind: string, counted: number, returned: number }[] ,
  freshness:     { loadDate: date, basis: string }
}

OneStep = {
  provision:        string,   // legislation.gov.uk form, bridged
  act:              string,
  kind:             'made-under' | 'amends' | 'repeals' | 'modifies'
                  | 'commences' | 'cites',
  strength:         'dependency' | 'operation' | 'reference',
  changeKind:       'textual' | 'not-textual' | 'unclassified' | null,
  changeReason:     string | null,
  split:            { total, changeWords, doNot, unclassified } | null,
  citingText:       string | null,   // from citation_edge; null where absent
  citingTextState:  'held' | 'none-stored' | 'possibly-truncated',
  origin:           'official' | 'extracted',
  source:           string
}
```

`opts`: `kinds` (default: everything except `caselaw-markup`), `limit`.

**One step only.** Lex walks it. The reader does not recurse — recursion in
the reader would hide the branching factor from the caller, which is the one
number the caller most needs.

**`truncated` is not optional.** A capped result that does not say it was
capped is a lie about completeness. Report counted and returned per kind.

---

## 4. WHAT LEX IS TOLD, IN THE TOOL'S OWN DESCRIPTION

Put these in the tool description, as GRAPH_6 put its three standing rules
there — they are the difference between a useful tool and a fabrication
engine:

1. **A `cites` row is a provision to read, not a provision that changes.**
   Describe such a set as *"provisions that refer to this — for review"*,
   never as consequences, knock-ons or a consequential schedule.
2. **Walk `made-under` and official effects as far as they go. Stop citations
   at depth 1, or depth 2 with the set labelled weak.** Never present a
   depth-3 citation set to a user.
3. **Count and say what was not walked.** A truncated subtree, an
   unaddressable provision, and a step with no rows are three different
   facts.
4. **Never put a figure from this reader in the "Consequential amendments and
   repeals" annexe.** That annexe records drafted amendments. This reader
   produces candidates.

---

## 5. CONSTRAINTS

a. **No schema change.** Read-only, beside `effectsFor()`.

b. **Bridge identity at every hop.** §2.5.

c. **Join `citation_edge.citation_text`** and report the three text states.
   Verify truncation before any sentence is displayed as a quotation (§2.2).

d. **`caselaw-markup` is excluded from the default walk** and must be
   requestable separately. A judgment citing a provision is interpretation,
   not a drafting consequence, and GRAPH 5 added 19,017 such rows for the
   Equality Act alone — they would swamp every other kind.

e. **Never merge the strengths.** One row, one kind, one strength.

f. **An unaddressable provision is a result, not an empty list.** §2.4.

g. **State what you counted.** Rows examined and rows asserted on, per guard.

h. **The check must be able to fail.** Two deliberate breaks, cases red
   reported, reverted exactly. GRAPH_6 and GRAPH_7 both did this; it is now
   the standard. At least one break must be *a citation row presented as a
   consequence* — the failure this brief exists to prevent.

---

## 6. REPORT

1. **The measured branching factor** at depths 1, 2 and 3, de-duplicated, for
   CRaG 2010, the Civil Service (Management Functions) Act 1992, the
   Government Resources and Accounts Act 2000 and the Equality Act 2010 — set
   against the prediction in §2.1. Say whether it held.
2. `made-under` and `cites` inbound counts for the three marquee Acts.
3. The truncation determination on `citation_edge.citation_text`, with the
   length distribution at the maximum.
4. How many `cites` rows carry a sentence and how many do not, as a
   proportion of those walked.
5. One worked example end to end: a provision in CRaG 2010, its depth-1 set
   by each kind, with the sentence where held — and the same set as it would
   be *wrongly* described if the kinds were merged, so the difference is on
   the record.
6. The mutation run.
7. What the data said that this brief got wrong. Both previous sprints found
   five and seven such things respectively, and each one changed a decision.
