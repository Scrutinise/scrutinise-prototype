# CCW-B13 — Post-sweep retrieval tasks

**From:** CCW · **To:** CC · **Date:** 2 Sep 2026 · **Print deadline:** Thu 3 Sep, afternoon

**Context.** A four-model commentary sweep plus a verification pass produced two live Bills, a hard
Northern Ireland correction, three documented negatives and one correction to our own draft. I have
already worked the s.149 collision slice out of the existing `WS-04_inbound.json` — that is written
up as `PART2_4_10_psed_collision.md` and does **not** need repeating.

Three tasks remain that need the corpus or the graph tables. **Ordered by value. If time runs out,
stop after task 2 and say so** rather than half-finishing three.

⚠ **CLAUDE.md §20: confirm the file, not the pattern.** Each output is a named file; the check is
that it exists with non-zero rows.

---

## Task 1 — Resolve the 1,256 unresolved rows in WS-04 · HIGHEST VALUE

**Why.** `WS-04_inbound.json` holds 2,016 rows. **1,256 of them resolve to the Equality Act 2010 but
to no particular provision.** They can be neither counted into the §4.10 figures nor ruled out of
them, and §4.10 says so on its face. **That caveat currently swallows 62% of the file.**

If even part of that 1,256 can be resolved to a provision, the public-sector-duty cluster count
(currently 162) may move materially, and **the finding that 18 of 19 enabling instruments are
devolved is the one most worth stress-testing** — it is the strongest claim in the section.

**Do:**

1. Determine **why** those rows carry a null `target_provision_ref` — is it that the citing text names
   the Act without a section, or that provision resolution failed on text that does name one?
2. Report the split. If it is the first, that is a fact about how the statute book cites, and §4.10's
   caveat is correct as written and can be sharpened.
3. If any are recoverable, re-emit `WS-04_inbound.json` with them resolved.

**Output:** `docs/report_run/WS-04_UNRESOLVED_NOTE.md`, plus a re-emitted JSON if anything changes.

⚠ **Predict before you run** (CLAUDE.md §22 discipline): state in the file what you expect the split
to be, then what it was. If they differ, that difference is the finding.

---

## Task 2 — Does the proposer address Northern Ireland at all? · HIGH VALUE

**Why.** The Equality Act 2010 does not extend to Northern Ireland save for the three provisions in
s.217(3), and s.149 is not among them — so the public sector equality duty has never applied there.
The twelve-point list treats the measure as UK-wide. **Before the report says the programme has
missed this, we must check he has not addressed it somewhere we have not read.**

**Do:** full-text search the `starkey` schema (all 287 transcripts) for, at minimum:

`Northern Ireland`, `Belfast Agreement`, `Good Friday`, `section 75`, `Stormont`, `devolution`,
`Equality Commission`, `equality duty`, `public sector equality`, `Scotland Act`, `Sewel`

**Output:** `docs/report_run/NI_MENTIONS.md` — every hit with video ID, timestamp and 200 words
either side. **If there are no hits, say so explicitly and give the searched-term list and row
counts.** A clean negative is a usable finding and will print as one.

---

## Task 3 — Judgments citing CRAG 2010 Part 1 · MEDIUM VALUE

**Why.** Three independent research passes each report **no Bill, no review and no developed legal
case for repealing CRAG Part 1**. If the case law is also thin, the picture completes: the measure
would be drafted from nothing. If it is not thin, that is the more interesting result.

**Do:** query the case reference layer (74,894 judgments; corpus starts 2003) for judgments citing
the **Constitutional Reform and Governance Act 2010**. ⚠ **Separate Part 1 from the
treaty-ratification provisions in Part 2**, which are a different subject and will dominate the raw
count if not split.

**Output:** `docs/report_run/CRAG_CASELAW.md`. **State the corpus start date (2003) on the face of
the count.**

---

## Verified facts you may rely on

Checked against primary sources today. URLs in `PART2_4_9_source_register.md`.

| Fact | Status |
|---|---|
| ECHR (Notification of Withdrawal) Bill, **Bill 4242**, Mike Wood MP, 1R 22 Jun 2026, 2R listed 11 Sep 2026. **No text published** | ✔ bills.parliament.uk |
| PSED (Repeal) Bill, **Bill 4189**, Joy Morrissey MP, 1R 22 Jun 2026, 2R listed 5 Mar 2027. **No text published** | ✔ bills.parliament.uk |
| Public Office (Accountability) Bill, **Bill 4019**, Government Bill, Commons 3R 14 Jul 2026, Lords 2R 1 Sep 2026. Session **2024-26**, carried over | ✔ bills.parliament.uk |
| Farage ECHR (Withdrawal) ten-minute-rule motion, 29 Oct 2025: **Ayes 96, Noes 154** | ✔ Hansard |
| *For Women Scotland Ltd v The Scottish Ministers* **[2025] UKSC 16**, 16 Apr 2025 | ✔ — **not** [2024] UKSC 12; that is the case number |
| Maude, *Independent Review of Governance and Accountability in the Civil Service*, **13 Nov 2023** — **retains the impartial permanent service; does not recommend repeal** | ✔ gov.uk |
| Equality Act 2010 **s.217(3)**: only ss.82, 105(3)–(4) and 199 form part of the law of Northern Ireland | ✔ legislation.gov.uk |
| EA 2010 Part 11 Ch.1 side-headings: s.149 duty; s.150 introduces Sch 19; s.151 power to specify authorities; s.152 consultation; s.153 specific duties; s.154 cross-border; s.155 supplementary; s.156 enforcement; s.157 interpretation. **Sch 18 = exceptions (introduced by s.149); Sch 19 = public authorities (introduced by s.150)** | ✔ legislation.gov.uk |
| Starkey, *Bingham's failed revolution*, **The Critic, March 2025** | ✔ — **the thesis in his own writing, no transcription risk** |

## Do not rely on these — five confirmed fabrications

Named by one model, checked, non-existent. **If any appears in a draft, remove it.**

- HL Constitution Committee, *The Civil Service and the Constitution: 10 Years after CRAG*, HL 150, 2020
- HL Constitution Committee, *The Governance of the Civil Service*, HL 88, 2024
- Lord Sedwill, *The Future of Civil Service Impartiality*, IfG, 2022
- Policy Exchange, *The Cost of Compliance: Evaluating the Public Sector Equality Duty*, 2020
- Lady Hale, *The Human Rights Act 1998: A British Success Story?*, Sir David Williams Lecture, 2023

*(The real neighbour of the fourth is **Paul Yowell, The Future of Equality, Policy Exchange, 2021**,
Part 2 of which is on s.149.)*
