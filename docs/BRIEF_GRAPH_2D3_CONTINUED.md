# BRIEF — GRAPH 2D-3 CONTINUED: THE 25.9%, AND THE OFFICES THAT RESOLVE THEMSELVES

**Owner:** CC-Graph
**Stream:** GRAPH
**Written:** 17 August 2026
**Continues:** `BRIEF_GRAPH_2D3.md` §1 and §2, paused at a clean point. Schema applied, 83
propositions derived, 60-submission pilot run, $0.33 spent.

---

## §0 — Charlie's direction on the graph, which settles two things

> *I want all the names I possibly can in the graph, whether or not we can pin them down precisely.
> I'd rather know "Gareth Evans supports this idea" with a link to why we know that, than remove
> that valuable information because we couldn't check who Gareth Evans is… it's just a label for a
> voice and it's the content of the voice that matters.*

**That is now the standing rule, and Amendment 2 already built it.** `graph_mention` has no
resolution filter, and its negative control fires at 73,829 mentions the old gate would have hidden.
Nothing further is needed — but read it as an instruction rather than a coincidence: **a name with a
position and a source is a deliverable. Resolution is an improvement to it, never a precondition.**

⚠ **One thing this does not relax, and it is the same asymmetry as before.** Keeping every name is
free. *Merging* two names is a claim, and the Amendment 2 calibration is why: same-party pairs of
members who are certainly different people agree **97.9%** of the time. Display widely; merge on
evidence.

---

## §1 — Diagnose the 25.9% before spending anything more

**65 of 251 extracted passages could not be found in the document they were quoted from.** That is
the check working, and it is the only thing standing between the pilot and the full run.

⚠ **Do not loosen the matcher to make the number look better.** `extract_found_in_source` exists to
be the fabrication rate; a fuzzier match would produce a smaller number that means nothing. If the
matcher turns out to be wrong, fix the matcher *and say by how much the number moved and why*.

**Read a dozen misses by hand and classify them.** The classes call for opposite responses:

| what the miss looks like | what it is | what to do |
|---|---|---|
| the passage is there, differing by whitespace, a table cell break, a ligature | a **matcher** defect | fix the matcher, re-measure, report the delta |
| the passage is there but the model has joined two separated sentences | a **prompt** defect | forbid it more concretely, or accept a locator instead of a quotation |
| the passage is a close paraphrase of something present | **models paraphrase when asked to quote** — extremely common | change what is asked for: a locator (first six words, last six words) is checkable and a paraphrase is not |
| nothing resembling it exists in the document | **fabrication** | the number is real and it is the finding |

**Report the mix.** A 25.9% paraphrase rate and a 25.9% fabrication rate are different products.

⚠ **Check the 9,000-word cap on both sides.** If the extractor caps the text it sends but the checker
searches a differently-capped copy, a perfectly honest quotation from word 8,500 could fail to match.
That is a one-line class of bug and it would explain the whole thing.

---

## §2 — Offices resolve themselves, and this is Charlie's insight

> *As for Archbishops of Canterbury, we can identify them by cross-referencing the date. There's only
> ever one A of C at a time. Same with lords and Earls and ministers and CEOs of businesses.*

**He is right, and it dissolves the largest category in the Amendment 2 signal table.**

`disjoint-service` accounts for **150 of 187 scored pairs, 139 of them episcopal**. Amendment 2 read
those as *ambiguity we cannot resolve*. They are not ambiguous at all — they are **an office held in
succession, and an office plus a date is a deterministic lookup.** "The Lord Bishop of Durham" on
14 March 2019 is exactly one person, and the register already holds the membership dates that say
which.

### What to build

- **Where a surface is an OFFICE rather than a personal name, resolve by date against the
  succession.** The evidence is already in `graph_member_register`'s membership windows, and
  `disjoint-service` has already identified which clusters are successions.
- **This is not a name match and must not be recorded as one.** It is a temporal lookup against a
  register that states who held the office when. Give it its own `key_source` — something like
  `office-by-date` — at a confidence that reflects what it is: **higher than a name match, because
  the register asserts the succession rather than us inferring it.**
- ⚠ **It needs a date on the act.** An undated mention of an office cannot be resolved this way, and
  must stay a mention. Report how many fall into that.

### Where it generalises, and where it does not

Charlie names lords, earls, ministers and company chief executives. **The principle holds wherever a
register states who held a titled position when**, and the data differs sharply by case:

- **Bishops and peers** — the register holds it. Buildable now.
- **Ministers** — Parliament publishes ministerial appointments with dates. A separate source, real
  work, and high value: *"the Minister for X on that date"* appears constantly in evidence.
- **Company officers** — Companies House holds appointment and resignation dates, which arrives free
  with §2's register work.

⚠ **A title is not always an office.** "Lord Sharma" and "Mr Virendra Sharma" both normalise to
`sharma` and are two people who sat simultaneously — the signal table already shows them at 5.4%
agreement over 868 divisions. **Succession resolution applies to offices held one at a time, and the
test for that is the register showing non-overlapping tenure, not the name looking grand.**

⚠ **And MNIS 3296 is the counter-example to check against**: a Lord Archbishop of Canterbury record
covering 1991–2002 that casts zero votes, while 310 Bishops' votes exist in that window under other
records. **If office-by-date resolution attributes those votes to the wrong Archbishop, that is a
fabricated voting record for a named person.** Use it as the test case before trusting the mechanism.

---

## §3 — Then, in order

1. **Re-pilot** after §1's fix, and report the not-found rate again.
2. **The full run**, ~$8.51 at the current 83-proposition vocabulary. Prediction is on the record;
   score it after.
3. **The hand-score of fifty positions, with failures classified by type.** This is the brief's real
   acceptance test and it has not moved. ⚠ *"We extracted 4,000 positions"* is not an accuracy
   claim.
4. **§2's registers** — Companies House bulk data and the Charity Commission extract, both open,
   keyless and confirmed reachable. The single largest improvement to the organisation half.

---

## §4 — Two things carried, both reported not fixed

- **Three of 2D-2's 788 name matches stand on a surface the register itself says is shared** —
  `Mr George`, `Robinson`. Coin flips recorded at 0.9. A rule refusing a match on a
  register-ambiguous surface is small and worth writing.
- **The submitter's own name is in the document and not in the database.** `parseDocumentHeader` is
  written and self-tested; the Amendment 2 session recorded the source as absent. Worth measuring
  the disagreement rate — the one worked case had the graph saying *Cheshire and Merseyside ICS* and
  the document saying *the Champs Public Health Collaborative*, which is two different bodies, not
  two spellings.

---

## Working rules

Unchanged. The one that governs this sprint: **an inference must not travel as a measurement.** A
position is an inference, a quotation is checkable, and the whole design rests on keeping the two
apart.
