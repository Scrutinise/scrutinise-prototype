# ADDENDUM to BRIEF_INGEST_committees-content-gap.md
**Written:** 07 Aug 2026, by CCh. **Append to the base brief; do not replace it.** The base brief is sound and ready — this widens it from "report bodies" to "all the missing committee content + the full scrutiny loop," and hardens the data model so the fix doesn't create a new duplicate class. If the full scope is too large for one pass, **report bodies (base brief) are priority one**; treat A2/A3 below as fast-follow within the same sprint.

## A. Scope — the full scrutiny loop, not just report bodies
`GOLD_TEST_09` found `committees-reports` is 71.6% correspondence, 10.4% "Report:" (stubs), 3.2% minutes, **2.4% government responses**. The report bodies are the priority, but two more parts of the same gap matter for the product:

- **A1 (base brief) — report bodies.** Findings, conclusions, recommendations. Priority one.
- **A2 — government responses to reports.** Audit whether the 2.4% "government response" rows are full bodies or stubs like the reports; if stubbed, pull the full response documents. **Why it matters:** the committee scrutiny loop is *inquiry → evidence (we have it) → report conclusions (A1 adds them) → government response*. The mission-critical question your H1 persona asks is "what did the committee recommend, and did the government act on it?" — report bodies answer only the first half. The response half is what makes the corpus show whether scrutiny *changed* anything.
- **A3 — confirm oral evidence is full transcripts.** We hold `committees-evidence` (140,567 rows). Audit that oral-evidence (hearing transcript) rows are full transcripts, not stubs/summaries — if any are stubbed, they belong in this same pass. (Written evidence was confirmed present in the diagnosis; oral is the one to check.)

## B. Data model — link to the existing record, never fork
The 2,511 existing "Report:" stub rows ARE the report records. When the bodies land they must **attach to the existing report record** (shared inquiry id / parent key), not create a second report beside the stub — the exact duplicate class the stats layer just spent a sprint removing with `seriesKey`. Concretely: de-dup against the existing stubs; the stub becomes the head of its report, body sections hang off it. Same for A2 (a government response links to its report) and for the evidence already held (evidence links to its inquiry). The join key across evidence ↔ report ↔ response is the **inquiry**, so carry a stable inquiry id on every row.

## C. Coverage completeness — audit and report the span (known-unknowns, not silent gaps)
- **All committee types.** Confirm the acquisition spans **Commons select committees, Lords committees, AND Joint committees** — not just Commons. `committees.parliament.uk` covers all three; verify none is silently dropped.
- **Historical depth.** The modern `committees.parliament.uk` likely only serves recent sessions; older report bodies may live on the archived `publications.parliament.uk` / the web archive — the same pattern as the pre-2016 Scottish OR split. Audit the **date span** the primary route actually yields. If older reports exist only as stubs because their bodies sit on an archive host, **report that span explicitly** so the gap is a recorded known-unknown (honest-denominator doctrine), and flag whether a second archive route is worth a follow-on. Do not silently ingest only the recent ones and call committees "done."

## D. Metadata — so the search prefilter and future gold questions can target these rows
Every new body/response section must carry the metadata the live stream needs: **`type=COMMITTEE`**, committee name, report/inquiry title, publication date, and the inquiry id from (B). Rationale: the search thread's live committees stream filters on `types:['COMMITTEE']`, and the *next* round of gold questions will test committee **conclusions** — both only work if the new rows are correctly typed and titled. Rows that land without this are ingested-but-unfindable in the committees stream.

## E. Acceptance — prove the loop, not just the phrases
Keep the base brief's acceptance (the 10 `GOLD_TEST_09` conclusion phrases now present). **Add one loop test:** for a single known inquiry (Carillion is the natural choice — its "recklessness, hubris and greed" verdict is the canonical missing phrase), confirm that its **evidence, its report conclusions, and the government's response are all retrievable and all linked to the same inquiry id.** That proves the scrutiny loop end-to-end, which is the actual product capability, not just that a string is present.

## F. Cost anchor (for the step-7 embedding gate)
Ballpark so the number isn't a surprise: ~2,511 reports plus responses, chunked per-finding, is on the order of low-hundreds-of-thousands of sections — a small fraction of the full corpus, so a small fraction of the ~$600 full-corpus embed gate, i.e. **expect low tens of dollars**. Size it precisely and report before spending, exactly as the base brief says; this is just the expected magnitude so Charlie can approve quickly.

## G. Unchanged from the base brief
Audit-before-build; source priority bulk→scrape→API; predict-then-measure the row increase; FTS catch-up AND fold into the index (never Railway for the merge); hand back to the search thread on completion; the live post-filter→prefilter fix stays the **search thread's** call (don't touch it here — it would confound the re-test); no mid-sprint git.
