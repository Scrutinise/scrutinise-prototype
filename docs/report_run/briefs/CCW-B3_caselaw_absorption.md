# CC BRIEF B3 — Case law for the absorption gate (§8)

**Track:** corpus · **Owner:** CC-Graph · **Run:** Saturday 29 Aug, after B2
**Output location:** `docs/report_run/`. Standing rules: `CLAUDE.md`. No git mid-run.

---

## 1. Why this exists

§8 of every worked chapter asks one question: **does the principle survive repeal?** The proposer's
central claim is that it does — that judges have absorbed Convention principles into the common law,
so repealing the statute changes nothing, and annulment is required instead. That claim is testable
against decided cases, and the report tests it either way.

I do the testing. **You retrieve the cases and put the words in front of me.** Whether the claim
holds is not your call and nothing you write should imply a view.

Targets: **WS-01** Human Rights Act 1998 · **WS-04** Equality Act 2010 · **WS-05** CRAG 2010 Part 1.

---

## 2. What to retrieve, per measure

Two sets, kept separate and never merged:

**Set A — cases that cite the target Act.** Straight retrieval from the case-law layer
(`scripts/ingest/caselaw-text/`, `scripts/ingest/caseref/`). For each: neutral citation, court,
date, the passage that carries the citation, and the R2 key it was read from.

**Set B — cases on whether the right is protected at common law independently of the statute.**
Retrieve on the underlying principle rather than on the Act — for WS-01 this means the common-law
authorities on access to court, natural justice, legality, and freedom of expression; for WS-04, the
common-law position on discrimination before the statutory regime; for WS-05, the prerogative basis
of the civil service before CRAG put it on a statutory footing. Same fields.

⚠ **Set B is where the answer lives and it is the harder retrieval.** If a search returns nothing,
record the search terms you tried in `gaps` rather than returning an empty set silently.

---

## 3. ⚠ Establish the date range by measurement, not assumption

The report's front matter currently states *"case law from 2001 only"*. **Do not repeat that number
back to me — measure it.** Report the actual minimum and maximum judgment date present in the
case-law layer, the count by decade, and whether coverage differs by court. If the real floor is not
2001, the front matter is wrong and I need to know today, not on Wednesday.

This is a coverage statement and it prints as generated. Return it verbatim with its timestamp.

---

## 4. Output contract

`docs/report_run/caselaw_{ws_id}.json`:

```
{
  "generated_at": "",
  "measure": "",
  "coverage": { },                    // verbatim, unedited, with its own timestamp
  "date_range_measured": { "earliest": "", "latest": "", "by_decade": { }, "by_court": { } },
  "set_a_cites_the_act": [
    { "neutral_citation": "", "case_name": "", "court": "", "date": "",
      "passage": "", "passage_word_count": 0, "source_key": "",
      "provision_cited": "" }
  ],
  "set_b_common_law_independent": [
    { "neutral_citation": "", "case_name": "", "court": "", "date": "",
      "principle_searched": "", "passage": "", "source_key": "" }
  ],
  "gaps": [ { "principle_searched": "", "terms_tried": [], "returned": 0 } ]
}
```

## 5. Rules

- **Verbatim passages only.** A summarised holding is not usable — I have to read the court's words.
- **Every row carries the key it was read back from**, so any claim in the report can be checked.
- **Retrieve, do not interpret.** No `relevance` or `holding` field is asked for here on purpose.
- **Never present a count as complete.** Every number states what it counts and out of what.

## 6. Record a prediction before running

Per measure and per set: how many cases you expect. Set B is the one to predict honestly — if you
expect it to return little, say so before you run it, and the result is then informative either way.

## 7. Done means

- [ ] `caselaw_WS-01.json`, `caselaw_WS-04.json`, `caselaw_WS-05.json` exist
- [ ] the measured date range is reported, and any conflict with "2001 only" is called out explicitly
- [ ] Set A and Set B are separate everywhere, never summed
- [ ] every empty search appears in `gaps` with its terms
- [ ] predictions logged before, actuals after
