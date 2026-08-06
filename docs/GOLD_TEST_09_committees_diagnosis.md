# GOLD_TEST_09 — why the committees stream can't discriminate, and what to do about it

*6 Aug 2026. Read before answering the candidate questions at the end — the finding changes what
the question is.*

## Summary

The brief's diagnosis was that CM1–CM4 test a committee's **subject matter** rather than its
**conclusion**, and that better questions would fix it. The first half is right. The second half
does not survive contact with the corpus.

**A question about what a committee CONCLUDED is not answerable from this corpus, however well
it is worded.** Committee conclusions are essentially not ingested. What is ingested is the
evidence submitted *to* committees and the correspondence around them.

This is an ingest finding, not an answer-key finding, and it needs your call rather than another
drafting pass.

## How that was established

Five read-only probes, each narrowing the last. Scripts are in `scripts/ingest/search/`.

| probe | finding |
|---|---|
| `probe-committee-corpora` | Committee content exists: `committees-evidence` 140,567 rows + `committees-reports` 24,876 = **1.17% of the 14.17M-row `parliamentary` tier** |
| `probe-committee-yield` | **CM1 scores 100% in GOLD_TEST_05 while returning 0/20 committee documents.** Its answer key is satisfied entirely by Hansard debates about Carillion |
| `probe-committee-conclusions` | All 10 candidate conclusion phrases absent from committee text — including "recklessness, hubris and greed", which a 2020 Hansard debate quotes *verbatim from the report* |
| `probe-committee-composition` | `committees-reports` is **71.6% Correspondence**, 10.4% "Report:", 3.2% minutes, 2.4% government responses |
| `probe-committee-reports` | Those "Report:" rows are **2,575 rows across 2,511 distinct titles** — ~1 row per report. They are stubs and front matter, not report bodies |

The CM1 result is the one that matters. A question can score a perfect 100% on this stream while
retrieving nothing from it — so the existing 100%-at-every-weight is not "committees works", it
is "the measurement is not attached to committees at all".

## The structural problem, which better questions cannot solve

Two things compound:

**1. The scoring harness is not scoped to committees.** `score-stream-fusion.ts` prefilters
`tier='parliamentary'` for both the debates and the committees streams — identical scoping for
two different streams. The live router (`query-router.ts`) additionally post-filters committees
to `types: ['COMMITTEE']`. So the harness measures something the app does not serve. Its own
docstring names this failure: *"Scoring unscoped and shipping scoped would measure a system
nobody runs."*

**2. Every committee subject is also a Chamber subject, and the Chamber corpus is 85× larger.**
This is the deeper reason, and it is why I stopped drafting and wrote this instead. Measured
literal containment within a depth-200 BM25 result, committee vs the rest of Hansard:

| anchor phrase | committee hits | Hansard hits |
|---|---|---|
| "Dangerous Dogs Act" | 53 | 129 |
| "Equality and Human Rights Commission" | 20 | 129 |
| "Women in the Armed Forces" | 9 | 34 |
| "written submission" | 29 | 102 |
| **"breed specific legislation"** | **184** | **5** |
| **"written evidence submitted"** | **148** | **5** |

Any answer key built on subject vocabulary is dominated by Hansard. Only two kinds of phrase
discriminate: **inquiry-specific jargon the Chamber does not use for the same subject**
(the Chamber says "the Dangerous Dogs Act"; submissions say "breed specific legislation"), and
**the machinery of written evidence itself**, which cannot appear in Hansard because Hansard is
not a submissions inbox.

## Decisions for you

**D1 — Scope the committees measurement to the committee corpora.** Currently the harness cannot
distinguish this stream from debates. Low risk, offline only, no live behaviour changes. I have
not done it because it also changes the *debates* numbers, and debates is one of the two
validated streams behind the 0.5 weight decision. **Recommend: yes, and re-run 04 and 05.**

**D2 — The live committees stream post-filters rather than prefilters.** `ftsStream` retrieves
the top-N over all 14.17M parliamentary rows and *then* keeps the COMMITTEE-typed ones. Measured
yield on the four CM queries: 0/20, 7/20, 4/20, 19/20 — lossy and highly query-dependent, and
CM1 returns nothing at all. This is **live now** on the BM25 path, independent of the vector
flag. Fixing it means a corpus-level prefilter server-side. **This changes what users see, so I
have not touched it.**

**D3 — Committee reports are not ingested.** If the product intends "what did a committee
conclude" to be answerable, that is an ingest job, not a search job. If it intends "what evidence
was put to Parliament", the corpus already supports it and only the questions need changing.
**This is the one that decides whether the candidates below are the right shape at all.**

## Candidate questions — for your yes/no

Drafted on the verified principle above: lay wording that avoids the Chamber's vocabulary, with
an answer key built on inquiry-specific jargon plus the written-evidence register. All three ask
**what evidence was put to a committee**, because that is what the corpus contains. None asks
what a committee concluded, because nothing in the corpus answers that.

### CQ1 — dangerous dogs *(verification: STRONG)*
> **"Do the people who actually work with rescue dogs think banning particular types of dog keeps the public safe?"**

- **Expected 1** — the BSL inquiry evidence: `breed specific legislation`
- **Expected 2** — a submission's own argument: `banning dogs by breed`, `physical appearance`, `catch-all`
- **Why it discriminates:** the question never says "Dangerous Dogs Act" (Hansard's term, 53/129
  against us). "Breed specific legislation" is 184 committee vs 5 Hansard — measured. And the
  lay phrasing gives BM25 nothing to lock onto, so it is a genuine vector-vs-BM25 test.
- **Verified:** anchor measured directly. Real source rows exist, e.g.
  `committees-evidence:writtenevidence:90015:135351` (DDL0002), which argues banning by breed is
  "a catch-all, knee-jerk response".

### CQ2 — women in the armed forces *(verification: PARTIAL — anchor is Hansard-dominated)*
> **"What did servicewomen themselves tell Parliament about how they are treated, in their own words?"**

- **Expected 1** — the WIF follow-up inquiry: `Women in the Armed Forces`
- **Expected 2** — the first-person submission register: `written evidence submitted`, `anonymous written evidence`
- **Why it discriminates:** "in their own words" targets submitted testimony, which only this
  stream holds; `written evidence submitted` is 148 vs 5.
- **Caveat, stated plainly:** the topic anchor is 9 vs 34 against us. Expected-1 will partly match
  Hansard. If you want this one, I would replace Expected 1 with a WIF-specific phrase first.

### CQ3 — enforcing the Equality Act *(verification: PARTIAL — same caveat)*
> **"Who told Parliament that the equality watchdog wasn't actually enforcing anything?"**

- **Expected 1** — the EHRC inquiry: `Equality and Human Rights Commission`
- **Expected 2** — the submission register: `written evidence submitted`, `written submission from`
- **Caveat:** anchor is 20 vs 129 against us — weaker than CQ2. Real rows exist
  (`committees-evidence:writtenevidence:103429:149643`, the Fawcett Society submission), but
  "Fawcett Society" is itself 26 vs 108 Hansard-dominated.

**My recommendation:** take CQ1 as drafted. Treat CQ2 and CQ3 as not yet ready — I would rather
bring you two verified questions than three of which two are guesses, which is how CM1–CM4
happened. Answer D3 first: if committee *reports* are going to be ingested, all three of these
are the wrong shape and should be redrafted against conclusions instead.

**Nothing has been re-scored.** GOLD_TEST_05 still carries the CM1–CM4 numbers and its
drafted-questions warning, and the flag stays OFF.
