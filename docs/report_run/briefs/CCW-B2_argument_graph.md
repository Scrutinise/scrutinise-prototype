# CC BRIEF B2 — Argument graph: historic objections for §9

**Track:** corpus · **Owner:** CC-Graph · **Run:** Saturday 29 Aug
**Output location:** `docs/report_run/`. Standing rules: `CLAUDE.md`. No git mid-run.

---

## 1. Why this exists

Every worked chapter of the report has a §9: *historic objections to this shape of measure*. The
rule for that section is that each objection is one somebody **actually made in Parliament**, quoted
with speaker, date and debate — and that the difference between a sourced objection and a generated
one is visible to a reader who is skimming. You produce the sourced ones. Nothing else can.

Targets: **WS-01** Human Rights Act 1998 · **WS-04** Equality Act 2010 · **WS-05** CRAG 2010 Part 1.

---

## 2. Before you run anything — two things I could not settle from here

**The script exists but its runner does not.** `scrutinise-web/scripts/argument-questions.ts`
(14,766 bytes, 28 Aug) is present. `scrutinise-web/package.json` carries six `argument:*` entries —
`label-sheet`, `measure`, `peroration`, `propagate`, `recall`, `seed-draw` — and **`argument:questions`
is not among them**, although `docs/ARGUMENT_1A_REPORT.md` refers to `npm run argument:questions`.

So: **read the script's own header and argument handling first, report its actual interface, then
invoke it directly with `tsx`** in the pattern the sibling entries use. Do not add an npm entry to
`package.json` — a report run does not change the app's script table.

If the script cannot be run at all, say so this evening with the error. §9 then becomes a declared
gap in all three chapters, which is an acceptable outcome and a far better one than a thin section.

---

## 3. Output contract

`docs/report_run/argument_{ws_id}.json`, one file per measure:

```
{
  "generated_at": "",
  "measure": "",
  "invocation": "the exact command you ran",
  "prediction": { "objections_expected": 0, "recorded_before_run": true },
  "objections": [
    { "quoted_paragraph": "",        // verbatim, unedited
      "word_count": 0,
      "fragment": false,             // true when word_count < 30 — see §4
      "speaker": "", "party": "", "date": "", "house": "",
      "debate_title": "", "column": "",
      "source_key": "",              // the R2 key or row id it was read back from
      "retrieval_arm": "dense | keyword",
      "subject_of_debate": "",       // often NOT this measure; record it, do not filter on it
      "why_it_bears_on_this_measure": "" // one line, factual, no argument
    }
  ],
  "returned_nothing_usable": false,
  "coverage_note": ""                // verbatim from the tool if it emits one
}
```

## 4. ⚠ Three constraints that come from ARGUMENT 1A's own findings

`docs/ARGUMENT_1A_REPORT.md` measured this instrument. Its results are constraints on this run:

1. **48.8% of dense-retrieval candidates are under 30 words, and 28.2% under fifteen.** A short
   candidate is usually a fragment, not an objection — the report records *"Where is the money to
   come from?"* retrieved four times from four different decades. **Set `fragment: true` below 30
   words and never drop the row.** A fragment is material to read; it is not material to quote.
2. **Record `retrieval_arm`.** The keyword arm returned a median 130 words against the dense arm's
   32. The report will want to say which arm its quoted objections came from.
3. **The subject of the debate is usually something else entirely.** That is expected and is part of
   the finding, not a defect. Record it; do not filter it out.

## 5. What you do not do

- **Do not interpret.** `why_it_bears_on_this_measure` is one factual line ("objects to a statutory
  duty owed to an unbounded class"), not an argument. Whether the objection lands is my call.
- **Do not paraphrase a quotation.** Verbatim or omitted.
- **Do not merge the arms** into one count.

## 6. Record a prediction before each run

Per measure, before invoking: how many objections you expect, and how many you expect to survive the
30-word floor. A run returning materially fewer than predicted is evidence the query was weak, not
that the record is thin. Log to `CHANGE_LOG.md` with actuals after.

## 7. Done means

- [ ] `argument_WS-01.json`, `argument_WS-04.json`, `argument_WS-05.json` exist
- [ ] every objection carries speaker, date, debate and a source key it was read back from
- [ ] `fragment` set on every row by measured word count, none dropped
- [ ] predictions logged before, actuals after
- [ ] any measure returning nothing usable is named, with the query tried
