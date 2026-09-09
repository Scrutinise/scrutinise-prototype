# CC BRIEF B5 — Resolving the Register: from what he said to what it means

**Track:** corpus · **Owner:** CC-Graph · **Run:** Sunday 30 Aug evening / Monday 31 Aug first thing
**Blocked by:** my input file (see §2). Do not start before it exists.
**Output location:** `docs/report_run/`. Standing rules: `CLAUDE.md`. No git mid-run.

---

## 1. Why this exists — this is now the centre of the report

The report's centrepiece is a two-column register:

| what David Starkey says he wants to change, in his own words | our best guess at the legislation that would have to change, and why |

Column one is mine, from the transcripts and a search sweep of his channel. **Column two is yours**,
and it is the demonstration the whole document rests on: it is the Scrutinise process — a stated
desire in, an identified legislative action out — performed on his material in front of him.

His first task on receiving it is to review column two for completeness and correctness. So every
row must carry its reasoning, and every guess must be visibly a guess.

**You have already done this well once.** `scoping_remaining.csv` labelled each of your instrument
identifications `MY identification` with the reasoning attached, and flagged that WS-09 overlaps
WS-03. That is exactly the standard. Keep it.

---

## 2. Input — do not start without it

`docs/report_run/register_proposals.json`, which I write. One row per distinct proposal:

```
{ "proposal_id": "", "verbatim": "", "session": "", "timestamp": "",
  "source": "transcript | channel-video", "video_url": "", "paraphrase_flag": false }
```

If a proposal is ambiguous about its target, I will say so in the row rather than guessing for you.

---

## 3. What to produce, per proposal

`docs/report_run/register_resolved.json` (and `.csv`, flat, for drafting):

```
{ "proposal_id": "",
  "candidate_instruments": [
    { "title": "", "gid": "", "provision_scope": "",
      "basis": "named by the proposer | my identification",
      "reasoning": "",                      // why this instrument achieves what he described
      "confidence": "high | medium | low",
      "markup": 0, "text": 0, "enabling": 0,   // NEVER summed
      "act_level_rows": 0,
      "distinct_source_instruments": 0,
      "made_under_edges": 0,
      "gates": { "devolution": "yes|no|unknown",
                 "international": "yes|no|unknown",
                 "northern_ireland": "yes|no|unknown",
                 "absorption": "yes|no|unknown" },
      "overlaps": []                        // other proposal_ids hitting the same instrument
    }
  ],
  "unresolved": false,
  "why_unresolved": "" }
```

## 4. ⚠ Five rules, all of them load-bearing

1. **`basis` is never blank and never optimistic.** If the proposer named the Act, say so. If you
   picked it, `my identification` — and the reasoning is what he will actually read and correct.
2. **`gates` are yes/no/unknown flags, not analysis.** `unknown` is a perfectly good answer and is
   better than a guess. Whether a gate bites is my call.
3. **The three detection counts are never merged**, here or anywhere.
4. **Record `overlaps`.** Several proposals will land on the same statute — CRA 2005 already carries
   three of them. The report needs to say so, because it changes what "twelve measures" means.
5. **A proposal you cannot resolve is `unresolved: true` with the search terms tried.** Do not
   attach a weak instrument to make the table look finished. An honest blank is a row he can fill in;
   a wrong instrument is a row that discredits the ones beside it.

## 5. Record a prediction before running

Before you start: how many proposals you expect to resolve to a named instrument, how many to your
own identification, and how many to remain unresolved. Score against it.

## 6. Done means

- [ ] every `proposal_id` from the input appears in the output, including the unresolved ones
- [ ] every instrument carries `basis`, `reasoning` and `confidence`
- [ ] detection counts separate throughout; no totals anywhere
- [ ] overlaps recorded both ways
- [ ] prediction logged before, actual after
