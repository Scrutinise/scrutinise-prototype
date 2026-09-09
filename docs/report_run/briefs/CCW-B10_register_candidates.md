# CCW-B10 — harvest the candidate proposals from the corpus

**Written:** Sun 30 Aug 2026 by CCW. **Runs after B9.** ~30 minutes.
**Output:** `docs/report_run/register_candidates.json` (git-ignored by `docs/report_run/.gitignore`)

---

## Why this exists — it is the critical path

The report's centrepiece is a two-column register: **what Starkey says he wants to change, in his own
words** ǀ **our best guess at the legislation that would have to change, and why.**

Column two is brief B5, and B5 is blocked on `register_proposals.json`, which CCW writes. **CCW cannot
write it without this brief**, because the transcript corpus lives in Neon and only you can reach it.
Everything else in the report run has landed. This is the one thing holding up the register.

You are producing **raw candidates**, not the register. CCW sifts, deduplicates and decides what is a
distinct proposal. Over-return rather than under-return: a wrong candidate costs CCW ten seconds to
discard, a missed one is a hole in a printed document.

---

## Step 1 — search for proposal language

Use `scripts/starkey/search.ts`. Two passes, reported separately and never merged:

**Pass A — the thesis videos** (the six parts, `EMbRv6aaQrs`, `2Khgz5sMMBU`). Highest density; these
carry the programme as he states it.

**Pass B — the rest of the channel** (the remaining ~277 videos). Lower density, but this is where a
measure he has not put in the thesis series will surface — and finding one of those is worth more to
the report than another restatement of the six.

Search terms, in three groups. Report hits per group so CCW can see which language is productive:

- **Imperative** — `we should`, `we must`, `we need to`, `we have to`, `I would`, `what I would do`,
  `the first thing`, `has to go`, `must go`
- **Action verbs** — `abolish`, `repeal`, `annul`, `scrap`, `get rid of`, `restore`, `bring back`,
  `take back`, `dismantle`, `reverse`
- **Named targets** — `human rights act`, `equality act`, `supreme court`, `lord chancellor`,
  `civil service`, `judicial review`, `quango`, `climate change act`, `european convention`,
  `hate speech`, `sentencing council`, `house of lords`, `civil service commission`

⚠ **Report the corpus-wide total for each term alongside the hit count.** A term matching 4,000
passages is uninformative and CCW needs to see that rather than infer it.

## Step 2 — the output

```
{ "generated_at": "", "pass": "A | B",
  "candidates": [
    { "video_id": "", "title": "", "published": "", "source": "asr | turboscribe",
      "start_s": 0, "end_s": 0, "watch_url": "",
      "text": "",                  // the passage, verbatim, with enough either side to read as a claim
      "matched_terms": [],
      "term_group": "imperative | action | target" }
  ],
  "term_totals": { "<term>": { "hits_in_pass": 0, "hits_corpus_wide": 0 } },
  "capped_at": null }
```

- **`text` must carry enough context to stand as a proposal.** A bare "we should abolish it" with no
  antecedent is useless — CCW cannot tell what "it" is. Roughly ±30 seconds around the hit.
- **Where a video has both `asr` and `turboscribe`, return the hit from each**, as B9 does, so a
  divergence in a quotable sentence is visible immediately rather than at print.
- **Cap Pass B at 300 candidates** if it runs large, and set `capped_at` to the number dropped. Never
  truncate silently. Pass A is not capped.

## Step 3 — what you do not do

- **Do not map anything to legislation.** That is B5, and it is a separate judgement with its own
  evidence trail. A candidate here is a sentence he said, nothing more.
- **Do not deduplicate across videos.** He repeats himself, and the repetition is itself evidence of
  what he considers central. CCW needs to see the repeats.
- **Do not drop a candidate for being vague.** Vagueness is a finding — several register rows will
  end up saying "he calls for X without naming an instrument", and that is a question for him.
- **Do not quote from `2Khgz5sMMBU` after 20:20.** B7 established YouTube's captions stop there. If
  a hit appears past that point, the coverage flag is wrong — stop and report it.

## Step 4 — report

1. Hit counts per term group, per pass, with corpus-wide totals beside them.
2. Candidate count per pass, and the cap if it fired.
3. **The five videos outside the thesis series with the most action-verb hits**, with titles. This is
   the answer to "has he proposed something that is not in the twelve", and it is the single most
   valuable line in your report.
4. Anything that made you doubt the search itself.

**Record a prediction before running:** how many distinct candidates you expect from Pass A, and
whether you expect Pass B to surface a target not already in the twelve workstreams. Score against it.
