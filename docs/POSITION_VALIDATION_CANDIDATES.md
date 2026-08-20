# POSITION GRAPH — VALIDATION CANDIDATES (DRAFT, UNSCORED)

**For:** Charlie, to accept / reject / amend one line at a time.
**Produced by:** `scripts/graph/draft-3b-validation.ts`, GRAPH 3B §3. Regenerate with
`npx tsx draft-3b-validation.ts` from `scripts/graph`.
**Generated:** 2026-08-20 06:19 UTC. **Nothing here has been scored against anything.**

---

## What this is, and the one property that makes it worth having

Design §8 makes a hand-labelled answer key the gate on any position estimate reaching a
user. This is the draft of that key.

**Every citation below is a BILL OR AMENDMENT SPONSORSHIP, fetched live from
`bills-api.parliament.uk` during this run.** That source is non-circular *by construction*,
and the proof is a number rather than an argument: this database holds **zero**
`amendment_sponsorship` signals — 3A's audit found the source data does not exist here, and
`check-3b.ts` prints that zero on every run. **The graph cannot be scored against itself
using a signal it does not hold.**

It is also better evidence than a vote. Tabling or signing an amendment is a deliberate act
a whip did not require; a whipped vote mostly measures the whip.

### How to read the `proposed` column

| basis | what it means | how much to trust it |
| --- | --- | --- |
| `bill-sponsor` | This member is a named sponsor of the Bill itself. | **Mechanical.** A sponsor supports their own Bill. |
| `amendment-sponsor` | This member put their name to an amendment. The amendment's own text is quoted. | **Direction is PROPOSED**, read off the quoted text. Check the quote, not me. |

⚠ **The direction on an `amendment-sponsor` row is the thing most likely to be wrong, and
it is wrong in a specific way:** an amendment can strengthen a Bill or wreck it, and the
text alone does not always say which. SEARCH S8 found **4 of 10** case-law gold keys wrong
when they were asserted from outside knowledge. That is the error rate this format exists to
expose — which is why the amendment's own words are printed beside every proposal.

### Verdict line

Add one line per row: `ACCEPT` · `REJECT` · `AMEND: <the correct position>` · `UNSURE`.

---

## The matters at a glance

| # | matter | divisions we hold | candidates drafted | note |
| --- | --- | ---: | ---: | --- |
| M1 | Assisted dying | 11 | 16 | |
| M2 | Removals to Rwanda | 57 | 16 | |
| M3 | Illegal migration and small boats | 81 | 16 | |
| M4 | Asylum and the Nationality and Borders Act | 84 | 16 | |
| M5 | Leaving the European Union | 78 | 16 | |
| M6 | The generational smoking ban | 8 | 16 | |
| M7 | Protest and public order | 31 | 16 | |
| M8 | Employment rights and industrial action | 24 | 13 | |
| M9 | Sewage, water quality and the Environment Act | 39 | 16 | |
| M10 | Retained EU law and the "sunset" clause | 25 | 16 | |

**157 candidate rows across 10 matters.** Design §8 asks for ~10 matters ×
~10 actors; where a Bill produced fewer, the shortfall is stated rather than padded.

---


## M1 — Assisted dying

A free vote throughout, and the clearest conscience matter in the corpus. 11 divisions, Nov 2024 – Jun 2025.

**What the graph holds:** 11 divisions
(2024-11-29 → 2025-06-20), 9 classified free-vote-like.
**Bill:** `Terminally Ill Adults (End of Life) Bill` — <https://bills.parliament.uk/bills/3774>

### M1.001 — Kim Leadbeater (MNIS 4923), Labour

- **Proposed position on Assisted dying:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Terminally Ill Adults (End of Life) Bill" (bills-api billId 3774)
- **Source:** <https://bills.parliament.uk/bills/3774>
- **In its own words:** “A Bill to allow adults who are terminally ill, subject to safeguards and protections, to request and be provided with assistance to end their own life; and for connected purposes.”
- **VERDICT:** _______

### M1.002 — Lord Falconer of Thoroton (MNIS 2758), Labour

- **Proposed position on Assisted dying:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Terminally Ill Adults (End of Life) Bill" (bills-api billId 3774)
- **Source:** <https://bills.parliament.uk/bills/3774>
- **In its own words:** “A Bill to allow adults who are terminally ill, subject to safeguards and protections, to request and be provided with assistance to end their own life; and for connected purposes.”
- **VERDICT:** _______

### M1.003 — Dame Meg Hillier (MNIS 1524), Labour

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC1 at Report stage, with 36 co-sponsors (Naz Shah, Antonia Bance, Jess Asato, Kirsteen Sullivan, …)
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “To move the following Clause— “No health professional shall raise assisted dying first”
- **VERDICT:** _______

### M1.004 — Tom Gordon (MNIS 5032), Liberal Democrat

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 1 at Report stage
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “Clause 2, page 2, line 2, leave out “within 6 months” and insert— “(i) in the case of a neurodegenerative illness, disease, or medical condition, within 12 months; or”
- **VERDICT:** _______

### M1.005 — Sir Edward Leigh (MNIS 345), Conservative

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC3 at Report stage
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “To move the following Clause— “Guidance: administration of pain relief to people who are terminally ill”
- **VERDICT:** _______

### M1.006 — Andrew Pakes (MNIS 5243), Labour

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC4 at Report stage, with 7 co-sponsors (Dame Meg Hillier, Antonia Bance, Jess Asato, Melanie Ward, …)
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “To move the following Clause— “Monitoring by Chief Medical Officer”
- **VERDICT:** _______

### M1.007 — Valerie Vaz (MNIS 4076), Labour

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC5 at Report stage, with 1 co-sponsor (Rachael Maskell)
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “To move the following Clause— “Implications for civil procedure rules and probate proceedings”
- **VERDICT:** _______

### M1.008 — Saqib Bhatti (MNIS 4818), Conservative

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC7 at Report stage
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “To move the following Clause— “Doctor independence”
- **VERDICT:** _______

### M1.009 — Gregory Stafford (MNIS 5351), Conservative

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC8 at Report stage
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “To move the following Clause— “Novel treatments not authorised by the Medicines and Healthcare products Regulatory Agency”
- **VERDICT:** _______

### M1.010 — Sarah Bool (MNIS 5355), Conservative

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC9 at Report stage
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “To move the following Clause— “Standard of proof”
- **VERDICT:** _______

### M1.011 — Rachael Maskell (MNIS 4471), Labour

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 25 at Report stage, with 7 co-sponsors (Sir Desmond Swayne, Graham Stringer, Margaret Mullane, Marsha De Cordova, …)
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “Clause 9, page 6, line 3, leave out from “person” to the second “the” in line 5 and insert “convene a panel to carry out the first assessment. (1A) The clinical panel should consist of—”
- **VERDICT:** _______

### M1.012 — Dr Ben Spencer (MNIS 4785), Conservative

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 18 at Report stage
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “Clause 2, page 2, line 6, leave out from “expected” to end”
- **VERDICT:** _______

### M1.013 — Jess Asato (MNIS 5156), Labour

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 9 at Report stage, with 5 co-sponsors (Dame Meg Hillier, Rachael Maskell, Melanie Ward, Neil Coyle, …)
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “Clause 11, page 9, line 25, leave out paragraph (g) and insert— “(g) ask the person whether they have discussed the request with their next of kin and other persons they are close to and, where they have not done so, discuss their reasons for not doing so.”…”
- **VERDICT:** _______

### M1.014 — Naz Shah (MNIS 4409), Labour

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 14 at Report stage, with 15 co-sponsors (Dame Meg Hillier, Rachael Maskell, Melanie Ward, Neil Coyle, …)
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “Clause 2, page 2, line 6, at end insert— “(1A) A person who would not otherwise meet the requirements of subsection (1) shall not be considered to meet those requirements solely as a result of voluntarily stopping eating or drinking.”…”
- **VERDICT:** _______

### M1.015 — Daniel Francis (MNIS 5184), Labour

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 24 at Report stage, with 17 co-sponsors (Melanie Ward, Neil Coyle, Dame Meg Hillier, Antonia Bance, …)
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “Clause 3, page 2, line 18, at end insert “except that section 1(2) of that Act shall not apply””
- **VERDICT:** _______

### M1.016 — Patricia Ferguson (MNIS 5190), Labour

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 13 at Report stage, with 9 co-sponsors (Dame Meg Hillier, Rachael Maskell, Melanie Ward, Neil Coyle, …)
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “Clause 4, page 2, line 22, at end insert— “(2A) A person may not be appointed under subsection (2) unless the appointment has the consent of the Health and Social Care Select Committee of the House of Commons.”
- **VERDICT:** _______

---

## M2 — Removals to Rwanda

Whipped. 54 divisions, Dec 2023 – Apr 2024, plus 63 mentioning Rwanda across other bills.

**What the graph holds:** 57 divisions
(2023-12-12 → 2024-04-22), 0 classified free-vote-like.
**Bill:** `Safety of Rwanda (Asylum and Immigration) Act 2024` — <https://bills.parliament.uk/bills/3540>

### M2.017 — James Cleverly (MNIS 4366), Conservative

- **Proposed position on Removals to Rwanda:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Safety of Rwanda (Asylum and Immigration) Act 2024" (bills-api billId 3540)
- **Source:** <https://bills.parliament.uk/bills/3540>
- **In its own words:** “Make provision about the removal of certain migrants to the Republic of Rwanda.”
- **VERDICT:** _______

### M2.018 — Lord Sharpe of Epsom (MNIS 4888), Conservative

- **Proposed position on Removals to Rwanda:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Safety of Rwanda (Asylum and Immigration) Act 2024" (bills-api billId 3540)
- **Source:** <https://bills.parliament.uk/bills/3540>
- **In its own words:** “Make provision about the removal of certain migrants to the Republic of Rwanda.”
- **VERDICT:** _______

### M2.019 — Robert Jenrick (MNIS 4320), Conservative

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 11 at Committee of the whole House, with 60 co-sponsors (Suella Braverman, Sir John Hayes, Sir Iain Duncan Smith, Mr David Jones, …) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “Clause 3, page 3, line 21, after “Act” insert “, and of the Illegal Migration Act 2023 insofar as they relate to the removal of persons to Rwanda””
- **VERDICT:** _______

### M2.020 — Mr Alistair Carmichael (MNIS 1442), Liberal Democrat

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 6 at Committee of the whole House, with 1 co-sponsor (Sir Robert Buckland) — decision: NotSelected
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “Page 3, line 21, leave out Clause 3”
- **VERDICT:** _______

### M2.021 — Alison Thewliss (MNIS 4430), Scottish National Party

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 51 at Committee of the whole House, with 3 co-sponsors (Chris Stephens, Stephen Flynn, Owen Thompson) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “Clause 5, page 5, line 15, leave out “not””
- **VERDICT:** _______

### M2.022 — Yvette Cooper (MNIS 420), Labour

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 38 at Committee of the whole House, with 1 co-sponsor (Stephen Kinnock) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “Clause 5, page 5, line 23, after “person” insert “in consultation with the Attorney General.””
- **VERDICT:** _______

### M2.023 — Stella Creasy (MNIS 4088), Labour

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 9 at Committee of the whole House, with 1 co-sponsor (Claire Hanna) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “Clause 5, page 5, line 23, at end insert— “(5) The Government must, within three months of this Act receiving Royal Assent, lay before Parliament a copy of a report setting out how this clause is compatible with Section 7A of the European Withdrawal Act and th…”
- **VERDICT:** _______

### M2.024 — Sir Robert Buckland (MNIS 4106), Conservative

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 26 at Committee of the whole House — decision: NotSelected
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “Page 5, line 8, leave out Clause 5”
- **VERDICT:** _______

### M2.025 — Patrick Grady (MNIS 4432), Scottish National Party

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 4 at Committee of the whole House, with 1 co-sponsor (Joanna Cherry) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “Clause 8, page 6, line 23, leave out “Scotland””
- **VERDICT:** _______

### M2.026 — Joanna Cherry (MNIS 4419), Scottish National Party

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 32 at Committee of the whole House — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “Clause 8, page 6, line 25, leave out “the United Kingdom” and insert “England and Wales and Northern Ireland.””
- **VERDICT:** _______

### M2.027 — Sir Jeffrey M Donaldson (MNIS 650), Democratic Unionist Party

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC3 at Committee of the whole House, with 7 co-sponsors (Sammy Wilson, Gavin Robinson, Mr Gregory Campbell, Carla Lockhart, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “To move the following Clause— “Effect in Northern Ireland”
- **VERDICT:** _______

### M2.028 — Lord German (MNIS 4163), Liberal Democrat

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 35 at Committee stage, with 1 co-sponsor (Lord Scriven) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18451/amendments>
- **In its own words:** “After Clause 2, insert the following new Clause— “Applicability of decisions”
- **VERDICT:** _______

### M2.029 — Baroness Chakrabarti (MNIS 4579), Labour

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 36 at Committee stage, with 2 co-sponsors (Baroness Hale of Richmond, The Lord Archbishop of Canterbury) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18451/amendments>
- **In its own words:** “Leave out Clause 3 and insert the following new Clause— “Limited disapplication of section 6 of the Human Rights Act 1998”
- **VERDICT:** _______

### M2.030 — Lord Etherton (MNIS 4902), Crossbench

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 38 at Committee stage, with 2 co-sponsors (Lord Cashman, Lord Purvis of Tweed) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18451/amendments>
- **In its own words:** “Clause 4, page 4, line 12, after “question” insert “or, where the person in question is a member of a particular social group within Article 1A(2) of the Refugee Convention 1951, for that group””
- **VERDICT:** _______

### M2.031 — Lord Dubs (MNIS 805), Labour

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 41 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18451/amendments>
- **In its own words:** “Clause 4, page 4, line 13, after “circumstances” insert “such as a claim based on the grounds outlined in Article 1A(2) of the Refugee Convention 1951 including on religion or belief grounds””
- **VERDICT:** _______

### M2.032 — Lord Coaker (MNIS 360), Labour

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 48 at Committee stage, with 2 co-sponsors (Lord Hope of Craighead, Lord Purvis of Tweed) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18451/amendments>
- **In its own words:** “Clause 4, page 4, line 23, leave out subsection (2)”
- **VERDICT:** _______

---

## M3 — Illegal migration and small boats

Whipped. 80 divisions, Mar – Jul 2023.

**What the graph holds:** 81 divisions
(2023-03-13 → 2023-07-17), 0 classified free-vote-like.
**Bill:** `Illegal Migration Act 2023` — <https://bills.parliament.uk/bills/3429>

### M3.033 — Suella Braverman (MNIS 4475), Conservative

- **Proposed position on Illegal migration and small boats:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Illegal Migration Act 2023" (bills-api billId 3429)
- **Source:** <https://bills.parliament.uk/bills/3429>
- **In its own words:** “A Bill to Make provision for and in connection with the removal from the United Kingdom of persons who have entered or arrived in breach of immigration control; to make provision about detention for immigration purposes;…”
- **VERDICT:** _______

### M3.034 — Lord Murray of Blidworth (MNIS 4950), Conservative

- **Proposed position on Illegal migration and small boats:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Illegal Migration Act 2023" (bills-api billId 3429)
- **Source:** <https://bills.parliament.uk/bills/3429>
- **In its own words:** “A Bill to Make provision for and in connection with the removal from the United Kingdom of persons who have entered or arrived in breach of immigration control; to make provision about detention for immigration purposes;…”
- **VERDICT:** _______

### M3.035 — Liz Saville Roberts (MNIS 4521), Plaid Cymru

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC1 at Report stage, with 6 co-sponsors (Hywel Williams, Ben Lake, Apsana Begum, Nadia Whittome, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “To move the following Clause— “Detainees: permission to work after six months”
- **VERDICT:** _______

### M3.036 — Apsana Begum (MNIS 4790), Labour

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC2 at Report stage, with 21 co-sponsors (Bell Ribeiro-Addy, Richard Burgon, Rebecca Long Bailey, Ms Diane Abbott, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “To move the following Clause— “Arrangements for removal: pregnancy”
- **VERDICT:** _______

### M3.037 — Dame Diana Johnson (MNIS 1533), Labour

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC4 at Report stage, with 5 co-sponsors (Caroline Lucas, Hywel Williams, Ben Lake, Jonathan Edwards, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “To move the following Clause— “Independent child trafficking guardian”
- **VERDICT:** _______

### M3.038 — Bell Ribeiro-Addy (MNIS 4764), Labour

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC5 at Report stage, with 14 co-sponsors (Apsana Begum, Caroline Lucas, Beth Winter, Ian Byrne, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “To move the following Clause— “Immigration rules since December 2020: human rights of migrants”
- **VERDICT:** _______

### M3.039 — Yvette Cooper (MNIS 420), Labour

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC9 at Report stage, with 1 co-sponsor (Stephen Kinnock) — decision: NegativedOnDivision
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “To move the following Clause— “Accommodation: duty to consult”
- **VERDICT:** _______

### M3.040 — Alison Thewliss (MNIS 4430), Scottish National Party

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC18 at Report stage, with 7 co-sponsors (Stuart C McDonald, Patrick Grady, Brendan O'Hara, Hywel Williams, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “To move the following Clause— “Suspensive claims and related appeals: legal aid and legal advice”
- **VERDICT:** _______

### M3.041 — Stella Creasy (MNIS 4088), Labour

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 17 at Report stage, with 5 co-sponsors (Caroline Lucas, Hywel Williams, Ben Lake, Jonathan Edwards, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “Clause 2, page 3, line 9, at end insert ”, and— (a) was aged 18 years or older on the date on which they entered or arrived in the United Kingdom, and”
- **VERDICT:** _______

### M3.042 — Stephen Farry (MNIS 4856), Alliance

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 1 at Report stage, with 1 co-sponsor (Claire Hanna) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “Clause 2, page 4, line 4, at end insert— “(d) the person enters the United Kingdom from Ireland across the land border with Northern Ireland.””
- **VERDICT:** _______

### M3.043 — Tim Loughton (MNIS 114), Conservative

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 181 at Report stage, with 15 co-sponsors (Tracey Crouch, Sir Robert Buckland, Mrs Flick Drummond, Richard Fuller, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “Clause 3, page 4, line 9, leave out subsections (2) to (4)”
- **VERDICT:** _______

### M3.044 — The Lord Bishop of Durham (MNIS 4312), Bishops

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 128B at Committee stage, with 3 co-sponsors (Baroness Stroud, Lord Purvis of Tweed, Baroness Lister of Burtersett) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17659/amendments>
- **In its own words:** “Clause 58, page 61, line 3, at end insert— “(6A) The Secretary of State may not make regulations under subsection (1) specifying any limit on the number of persons who arrive under the following schemes—”
- **VERDICT:** _______

### M3.045 — Lord Purvis of Tweed (MNIS 4293), Liberal Democrat

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of amendment 10007073 at Committee stage, with 1 co-sponsor (Baroness Chakrabarti) — decision: StoodPart
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17659/amendments>
- **In its own words:** “The above-named Lords give notice of their intention to oppose the Question that Clause 58 stand part of the Bill.”
- **VERDICT:** _______

### M3.046 — Baroness Stroud (MNIS 4546), Conservative

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 128C at Committee stage, with 3 co-sponsors (Baroness Helic, Lord Kirkhope of Harrogate, Baroness Mobarik) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17659/amendments>
- **In its own words:** “After Clause 58, insert the following new Clause— “Duty to establish safe and legal routes”
- **VERDICT:** _______

### M3.047 — Baroness Ludford (MNIS 1867), Liberal Democrat

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 129 at Committee stage, with 3 co-sponsors (Lord Paddick, Lord Kerr of Kinlochard, Baroness Bennett of Manor Castle) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17659/amendments>
- **In its own words:** “After Clause 59, insert the following new Clause— “Refugee family reunion”
- **VERDICT:** _______

### M3.048 — Baroness Lister of Burtersett (MNIS 4234), Labour

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 130 at Committee stage, with 3 co-sponsors (Lord Carlile of Berriew, Lord Dubs, Lord Kerr of Kinlochard) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17659/amendments>
- **In its own words:** “After Clause 59, insert the following new Clause— “Safe passage visa scheme”
- **VERDICT:** _______

---

## M4 — Asylum and the Nationality and Borders Act

Whipped, and the largest single block of divisions in the corpus (84).

**What the graph holds:** 84 divisions
(2021-07-20 → 2022-04-27), 0 classified free-vote-like.
**Bill:** `Nationality and Borders Act 2022` — <https://bills.parliament.uk/bills/3023>

### M4.049 — Priti Patel (MNIS 4066), Conservative

- **Proposed position on Asylum and the Nationality and Borders Act:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Nationality and Borders Act 2022" (bills-api billId 3023)
- **Source:** <https://bills.parliament.uk/bills/3023>
- **In its own words:** “Make provision about nationality, asylum and immigration; to make provision about victims of slavery or human trafficking; to provide a power for Tribunals to charge participants where their behaviour has wasted the Trib…”
- **VERDICT:** _______

### M4.050 — Baroness Williams of Trafford (MNIS 4311), Conservative

- **Proposed position on Asylum and the Nationality and Borders Act:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Nationality and Borders Act 2022" (bills-api billId 3023)
- **Source:** <https://bills.parliament.uk/bills/3023>
- **In its own words:** “Make provision about nationality, asylum and immigration; to make provision about victims of slavery or human trafficking; to provide a power for Tribunals to charge participants where their behaviour has wasted the Trib…”
- **VERDICT:** _______

### M4.051 — Baroness Hamwee (MNIS 2652), Liberal Democrat

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 1 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “leave out “equally” and insert “in the same terms””
- **VERDICT:** _______

### M4.052 — Baroness McIntosh of Pickering (MNIS 384), Conservative

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 3 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “at end insert— The Secretary of State must not charge a fee for the processing of applications under this section.””
- **VERDICT:** _______

### M4.053 — Baroness Lister of Burtersett (MNIS 4234), Labour

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 11 at Committee stage, with 3 co-sponsors (Baroness Ludford, Lord Woolley of Woodford, Baroness Bennett of Manor Castle) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “Insert the following new Clause— “Provision for Chagos Islanders to acquire British nationality”
- **VERDICT:** _______

### M4.054 — Lord Russell of Liverpool (MNIS 2134), Crossbench

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 14 at Committee stage, with 1 co-sponsor (Baroness Hamwee) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “at end insert— In section 1 (acquisition by birth or adoption), in subsection (5)—”
- **VERDICT:** _______

### M4.055 — Lord Moylan (MNIS 4883), Conservative

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 27 at Committee stage, with 3 co-sponsors (Baroness Fox of Buckley, Baroness Mobarik, Baroness Warsi) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “Leave out Clause 9 and insert the following new Clause— “Deprivation of citizenship”
- **VERDICT:** _______

### M4.056 — Lord Anderson of Ipswich (MNIS 4705), Crossbench

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of Unnumbered at Committee stage, with 3 co-sponsors (Lord Rosser, Lord Paddick, Baroness Warsi) — decision: Disagreed
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “The above-named Lords give notice of their intention to oppose the Question that Clause 9 stand part of the Bill.”
- **VERDICT:** _______

### M4.057 — Lord Paddick (MNIS 4288), Liberal Democrat

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 29 at Committee stage, with 1 co-sponsor (Baroness Hamwee) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “Insert the following new Clause— “Deprivation of citizenship: procedure”
- **VERDICT:** _______

### M4.058 — Lord Dubs (MNIS 805), Labour

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 30 at Committee stage, with 2 co-sponsors (Baroness Ludford, Baroness Bennett of Manor Castle) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “after “birth” insert “without any legal or administrative barriers””
- **VERDICT:** _______

### M4.059 — Baroness Bennett of Manor Castle (MNIS 4719), Green Party

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 32 at Committee stage, with 1 co-sponsor (Baroness Chakrabarti) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “Insert the following new Clause— “Repeal of power to deprive citizenship except for cases of fraud etc.”
- **VERDICT:** _______

### M4.060 — Baroness Ludford (MNIS 1867), Liberal Democrat

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 34 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “Insert the following new Clause— “Acquisition of British citizenship by birth or adoption: comprehensive sickness insurance”
- **VERDICT:** _______

### M4.061 — Baroness D'Souza (MNIS 3709), Crossbench

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 19A at Report stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16165/amendments>
- **In its own words:** “leave out subsections (5) to (7)”
- **VERDICT:** _______

### M4.062 — Baroness Chakrabarti (MNIS 4579), Labour

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 24 at Report stage, with 3 co-sponsors (Lord Judge, Lord Pannick, Baroness Hamwee) — decision: Agreed
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16165/amendments>
- **In its own words:** “Insert the following new Clause— “Compliance with the Refugee Convention”
- **VERDICT:** _______

### M4.063 — The Lord Bishop of Durham (MNIS 4312), Bishops

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 29 at Report stage, with 1 co-sponsor (Baroness Lister of Burtersett) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16165/amendments>
- **In its own words:** “at end insert— In section 16 of the Nationality, Immigration and Asylum Act 2002 (establishment of centres), at end insert—”
- **VERDICT:** _______

### M4.064 — Baroness Stroud (MNIS 4546), Conservative

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 30 at Report stage, with 3 co-sponsors (Baroness Lister of Burtersett, Baroness Ludford, Baroness Meacher) — decision: Agreed
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16165/amendments>
- **In its own words:** “Insert the following new Clause— “Changes to the Immigration Act 1971”
- **VERDICT:** _______

---

## M5 — Leaving the European Union

Whipped on paper and split in practice; 78 divisions, Nov 2017 – Jun 2018.

**What the graph holds:** 78 divisions
(2017-11-15 → 2018-06-20), 0 classified free-vote-like.
**Bill:** `European Union (Withdrawal) Act 2018` — <https://bills.parliament.uk/bills/2045>

### M5.065 — Mr David Davis (MNIS 373), Conservative

- **Proposed position on Leaving the European Union:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "European Union (Withdrawal) Act 2018" (bills-api billId 2045)
- **Source:** <https://bills.parliament.uk/bills/2045>
- **In its own words:** “A Bill to repeal the European Communities Act 1972 and make other provision in connection with the withdrawal of the United Kingdom from the EU.”
- **VERDICT:** _______

### M5.066 — Baroness Evans of Bowes Park (MNIS 4329), Conservative

- **Proposed position on Leaving the European Union:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "European Union (Withdrawal) Act 2018" (bills-api billId 2045)
- **Source:** <https://bills.parliament.uk/bills/2045>
- **In its own words:** “A Bill to repeal the European Communities Act 1972 and make other provision in connection with the withdrawal of the United Kingdom from the EU.”
- **VERDICT:** _______

### M5.067 — Lord Callanan (MNIS 4336), Conservative

- **Proposed position on Leaving the European Union:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "European Union (Withdrawal) Act 2018" (bills-api billId 2045)
- **Source:** <https://bills.parliament.uk/bills/2045>
- **In its own words:** “A Bill to repeal the European Communities Act 1972 and make other provision in connection with the withdrawal of the United Kingdom from the EU.”
- **VERDICT:** _______

### M5.068 — Lord Wigley (MNIS 547), Plaid Cymru

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 1 at Committee stage, with 1 co-sponsor (Lord Dykes) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “at beginning insert “Subject to subsections (2) and (3),””
- **VERDICT:** _______

### M5.069 — Lord Adonis (MNIS 3743), Labour

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 2 at Committee stage, with 3 co-sponsors (Lord Hain, Lord Triesman, Baroness Meacher) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “leave out “on exit day” and insert “on a date to be determined by a further Act of Parliament””
- **VERDICT:** _______

### M5.070 — Lord Foulkes of Cumnock (MNIS 579), Labour

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 5 at Committee stage, with 2 co-sponsors (Lord Dykes, Lord Judd) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “at end insert— Regulations under section 19(2) bringing into force subsection (1) may not be made until the Prime Minister is satisfied that resolutions have been passed by the Scottish Parliament, the National Assembly for Wales and the Northern Ireland Assem…”
- **VERDICT:** _______

### M5.071 — Lord Hunt of Kings Heath (MNIS 2024), Labour

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 8 at Committee stage, with 3 co-sponsors (Lord Warner, Baroness Finlay of Llandaff, Lord Teverson) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “at end insert— Regulations bringing into force subsection (1) may not be made until the Secretary of State has set out a strategy for seeking to remain a member of (or maintain equivalent participatory relations with) Euratom, in order to provide continuity wi…”
- **VERDICT:** _______

### M5.072 — Baroness Thornton (MNIS 1782), Labour

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 9 at Committee stage, with 3 co-sponsors (Baroness Jolly, Lord Warner, The Earl of Clancarty) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “at end insert— Regulations bringing into force subsection (1) may not be made until the Secretary of State has set out a strategy for seeking to ensure that any citizen of the United Kingdom or of an EU country, who requires health care in a different country …”
- **VERDICT:** _______

### M5.073 — Lord Wallace of Saltaire (MNIS 1816), Liberal Democrat

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 12 at Committee stage, with 3 co-sponsors (Baroness Smith of Newnham, Lord Judd, Viscount Hailsham) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “at end insert— Regulations bringing into force subsection (1) may not be made until the Secretary of State has laid before both Houses of Parliament procedures agreed with the EU for continued coordination of foreign and security policy, including association …”
- **VERDICT:** _______

### M5.074 — Baroness Ludford (MNIS 1867), Liberal Democrat

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 13 at Committee stage, with 3 co-sponsors (Baroness Smith of Newnham, Lord Judd, Lord Cormack) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “at end insert— Regulations bringing into force subsection (1) may not be made until the Secretary of State has laid before both Houses of Parliament procedures agreed with the EU for continued UK participation in measures to promote internal security, police c…”
- **VERDICT:** _______

### M5.075 — Lord Goldsmith (MNIS 2490), Labour

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 13A at Committee stage, with 3 co-sponsors (Baroness Hayter of Kentish Town, Lord Lennie, Lord Tunnicliffe) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “at end insert— Regulations bringing into force subsection (1) may not be made until the Secretary of State has laid before both Houses of Parliament proposals for arrangements for the continued application of the Charter of Fundamental Rights to retained EU la…”
- **VERDICT:** _______

### M5.076 — Viscount Hailsham (MNIS 349), Conservative

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 14A at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “At end insert “and forms part of domestic primary legislation””
- **VERDICT:** _______

### M5.077 — Lord Pannick (MNIS 3870), Crossbench

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 15 at Committee stage, with 3 co-sponsors (Baroness Taylor of Bolton, Lord Norton of Louth, Lord Beith) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “leave out paragraphs (b) to (d)”
- **VERDICT:** _______

### M5.078 — Baroness McIntosh of Pickering (MNIS 384), Conservative

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 18 at Committee stage, with 1 co-sponsor (Lord Wigley) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “Insert the following new Clause— “Status of EU directives adopted, but not implemented, before exit day”
- **VERDICT:** _______

### M5.079 — Baroness Hayter of Kentish Town (MNIS 4159), Labour

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 21 at Committee stage, with 3 co-sponsors (Lord Warner, Baroness Smith of Newnham, Lord Kirkhope of Harrogate) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “Insert the following new Clause— “Future treatment of retained EU law”
- **VERDICT:** _______

### M5.080 — Baroness Kennedy of The Shaws (MNIS 1987), Labour

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 22 at Committee stage, with 1 co-sponsor (Lord Cashman) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “At end insert— human rights protection.””
- **VERDICT:** _______

---

## M6 — The generational smoking ban

A free vote on the Conservative side at Second Reading, Apr 2024 — the corpus holds 8 divisions.

**What the graph holds:** 8 divisions
(2024-04-16 → 2026-02-24), 0 classified free-vote-like.
**Bill:** `Tobacco and Vapes Act 2026` — <https://bills.parliament.uk/bills/3879>

### M6.081 — Wes Streeting (MNIS 4504), Labour

- **Proposed position on The generational smoking ban:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Tobacco and Vapes Act 2026" (bills-api billId 3879)
- **Source:** <https://bills.parliament.uk/bills/3879>
- **In its own words:** “A Bill to make provision about the supply of tobacco, vapes and other products, including provision prohibiting the sale of tobacco to people born on or after 1 January 2009 and provision about the licensing of retail sa…”
- **VERDICT:** _______

### M6.082 — Baroness Merron (MNIS 347), Labour

- **Proposed position on The generational smoking ban:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Tobacco and Vapes Act 2026" (bills-api billId 3879)
- **Source:** <https://bills.parliament.uk/bills/3879>
- **In its own words:** “A Bill to make provision about the supply of tobacco, vapes and other products, including provision prohibiting the sale of tobacco to people born on or after 1 January 2009 and provision about the licensing of retail sa…”
- **VERDICT:** _______

### M6.083 — Mary Kelly Foy (MNIS 4753), Labour

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC1 at Committee stage, with 1 co-sponsor (Bob Blackman) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19324/amendments>
- **In its own words:** “To move the following Clause— “Mandatory health warnings on cigarettes and cigarette rolling papers: consultation”
- **VERDICT:** _______

### M6.084 — Jim Dickson (MNIS 5223), Labour

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC4 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19324/amendments>
- **In its own words:** “To move the following Clause— “Ban on supply of cigarette filters”
- **VERDICT:** _______

### M6.085 — Mary Glindon (MNIS 4126), Labour

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC5 at Committee stage — decision: NegativedOnDivision
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19324/amendments>
- **In its own words:** “To move the following Clause— “Ban on manufacture and sales of high-strength nicotine pouches”
- **VERDICT:** _______

### M6.086 — Dr Caroline Johnson (MNIS 4592), Conservative

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC6 at Committee stage — decision: NegativedOnDivision
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19324/amendments>
- **In its own words:** “To move the following Clause— “Consultation on licensing regulations”
- **VERDICT:** _______

### M6.087 — Andrew Gwynne (MNIS 1506), Labour

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 15 at Committee stage — decision: Agreed
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19324/amendments>
- **In its own words:** “Clause 168, page 121, line 1, after “force” insert “(so far as not in force by virtue of subsection (2))””
- **VERDICT:** _______

### M6.088 — Helen Maguire (MNIS 5336), Liberal Democrat

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 49 at Committee stage — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19324/amendments>
- **In its own words:** “Title, line 2, leave out “born on or after 1 January 2009” and insert “under the age of 25””
- **VERDICT:** _______

### M6.089 — Sarah Bool (MNIS 5355), Conservative

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 96 at Committee stage — decision: NegativedOnDivision
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19324/amendments>
- **In its own words:** “Clause 12, page 6, line 8, at end insert— “(1A) The offence set out in subsection (1) does not apply to vending machines that are located within specialised mental health units that provide care for mental health patients.”…”
- **VERDICT:** _______

### M6.090 — Helen Morgan (MNIS 4934), Liberal Democrat

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 2 at Committee stage, with 2 co-sponsors (Liz Jarvis, Dr Danny Chambers) — decision: Disagreed
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19324/amendments>
- **In its own words:** “Clause 38, page 20, line 18, leave out from“must” to the end of line 19 and insert “be allocated by the relevant Local Health and Wellbeing Board to public health projects.””
- **VERDICT:** _______

### M6.091 — Wera Hobhouse (MNIS 4602), Liberal Democrat

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC1 at Report stage, with 6 co-sponsors (Steve Darling, Ian Sollom, Caroline Voaden, Daisy Cooper, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19506/amendments>
- **In its own words:** “To move the following Clause— “Review of contaminated e-liquid”
- **VERDICT:** _______

### M6.092 — Dame Caroline Dinenage (MNIS 4008), Conservative

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC2 at Report stage, with 19 co-sponsors (Vikki Slade, Tim Farron, Mike Martin, Ellie Chowns, …) — decision: NegativedOnDivision
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19506/amendments>
- **In its own words:** “To move the following Clause— “Ban on the supply of plastic cigarette filters”
- **VERDICT:** _______

### M6.093 — Jim Allister (MNIS 5356), Traditional Unionist Voice

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC3 at Report stage, with 7 co-sponsors (Gavin Robinson, Sammy Wilson, Jim Shannon, Alex Easton, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19506/amendments>
- **In its own words:** “To move the following Clause— “Amendment of the European Union (Withdrawal) Act 2018”
- **VERDICT:** _______

### M6.094 — Catherine Atkinson (MNIS 5143), Labour

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC5 at Report stage — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19506/amendments>
- **In its own words:** “To move the following Clause— “Report on sale of vaping products to facilitate child sexual exploitation”
- **VERDICT:** _______

### M6.095 — Jack Rankin (MNIS 5340), Conservative

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC8 at Report stage, with 10 co-sponsors (Sarah Bool, Ben Obese-Jecty, Jim Shannon, Sir Desmond Swayne, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19506/amendments>
- **In its own words:** “To move the following Clause— “Prohibition of advertising of vaping, nicotine and heated tobacco products”
- **VERDICT:** _______

### M6.096 — Sir John Hayes (MNIS 350), Conservative

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC12 at Report stage, with 5 co-sponsors (Jack Rankin, Sir Edward Leigh, Mr Peter Bedford, Sammy Wilson, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19506/amendments>
- **In its own words:** “To move the following Clause— “Review of provisions”
- **VERDICT:** _______

---

## M7 — Protest and public order

Whipped. 25 divisions, May 2022 – Jun 2023.

**What the graph holds:** 31 divisions
(2022-05-23 → 2026-02-04), 0 classified free-vote-like.
**Bill:** `Public Order Act 2023` — <https://bills.parliament.uk/bills/3153>

### M7.097 — Priti Patel (MNIS 4066), Conservative

- **Proposed position on Protest and public order:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Public Order Act 2023" (bills-api billId 3153)
- **Source:** <https://bills.parliament.uk/bills/3153>
- **In its own words:** “A Bill to make provision for new offences relating to public order; to make provision about stop and search powers; to make provision about the exercise of police functions relating to public order; to make provision abo…”
- **VERDICT:** _______

### M7.098 — Lord Sharpe of Epsom (MNIS 4888), Conservative

- **Proposed position on Protest and public order:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Public Order Act 2023" (bills-api billId 3153)
- **Source:** <https://bills.parliament.uk/bills/3153>
- **In its own words:** “A Bill to make provision for new offences relating to public order; to make provision about stop and search powers; to make provision about the exercise of police functions relating to public order; to make provision abo…”
- **VERDICT:** _______

### M7.099 — Dr Rupa Huq (MNIS 4511), Labour

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC1 at Committee stage, with 38 co-sponsors (Sir Bernard Jenkin, Dame Diana Johnson, Wera Hobhouse, Simon Fell, …) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16490/amendments>
- **In its own words:** “To move the following Clause— “Offence of interference with access to or provision of abortion services”
- **VERDICT:** _______

### M7.100 — Stella Creasy (MNIS 4088), Labour

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC2 at Committee stage, with 1 co-sponsor (Alex Cunningham) — decision: NegativedOnDivision
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16490/amendments>
- **In its own words:** “To move the following Clause— “Hostility towards sex or gender”
- **VERDICT:** _______

### M7.101 — Paul Maynard (MNIS 3926), Conservative

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC3 at Committee stage, with 1 co-sponsor (Jackie Doyle-Price) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16490/amendments>
- **In its own words:** “To move the following Clause— “Offences impeding emergency workers”
- **VERDICT:** _______

### M7.102 — Marsha De Cordova (MNIS 4676), Labour

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC8 at Committee stage, with 1 co-sponsor (Dr Rupa Huq) — decision: Disagreed
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16490/amendments>
- **In its own words:** “To move the following Clause— “Publication of data about use of stop and search powers”
- **VERDICT:** _______

### M7.103 — Sarah Jones (MNIS 4631), Labour

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC10 at Committee stage, with 1 co-sponsor (Yvette Cooper) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16490/amendments>
- **In its own words:** “To move the following Clause— “Guidance on locking on”
- **VERDICT:** _______

### M7.104 — Kit Malthouse (MNIS 4495), Conservative

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 24 at Committee stage — decision: Agreed
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16490/amendments>
- **In its own words:** “Title, line 2, leave out “delegation” and insert “exercise””
- **VERDICT:** _______

### M7.105 — Anne McLaughlin (MNIS 4437), Scottish National Party

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 1 at Committee stage
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16490/amendments>
- **In its own words:** “Page 1, line 4, leave out Clause 1”
- **VERDICT:** _______

### M7.106 — Wendy Chamberlain (MNIS 4765), Liberal Democrat

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 29 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16490/amendments>
- **In its own words:** “Clause 1, page 1, line 10, leave out “or is capable of causing””
- **VERDICT:** _______

### M7.107 — Suella Braverman (MNIS 4475), Conservative

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC7 at Report stage — decision: Agreed
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16631/amendments>
- **In its own words:** “To move the following Clause— “Power of Secretary of State to bring proceedings”
- **VERDICT:** _______

### M7.108 — Liz Saville Roberts (MNIS 4521), Plaid Cymru

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC12 at Report stage, with 2 co-sponsors (Hywel Williams, Ben Lake) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16631/amendments>
- **In its own words:** “To move the following Clause— “Justice impact assessments for Wales”
- **VERDICT:** _______

### M7.109 — Bell Ribeiro-Addy (MNIS 4764), Labour

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC15 at Report stage, with 28 co-sponsors (Apsana Begum, Liz Saville Roberts, Hywel Williams, Ben Lake, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16631/amendments>
- **In its own words:** “To move the following Clause— “Public inquiry into the impact of policing of public order on Black, Asian and minority ethnic people”
- **VERDICT:** _______

### M7.110 — Joanna Cherry (MNIS 4419), Scottish National Party

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 28 at Report stage, with 3 co-sponsors (Florence Eshalomi, Apsana Begum, Bell Ribeiro-Addy) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16631/amendments>
- **In its own words:** “Clause 1, page 1, line 6, after “they” insert “, without reasonable excuse, and using a device or substance that impedes detachment””
- **VERDICT:** _______

### M7.111 — Alicia Kearns (MNIS 4805), Conservative

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 51 at Report stage, with 16 co-sponsors (Sir Geoffrey Clifton-Brown, Sally-Ann Hart, Greg Smith, Dr Ben Spencer, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16631/amendments>
- **In its own words:** “Clause 7, page 7, line 31, at end insert— “(j) farms and food production infrastructure.””
- **VERDICT:** _______

### M7.112 — Baroness Chakrabarti (MNIS 4579), Labour

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 117 at Committee stage, with 3 co-sponsors (Lord Paddick, Baroness Boycott, Baroness Jones of Moulsecoomb) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3153/stages/17066/amendments>
- **In its own words:** “After Clause 18, insert the following new Clause— “Protection for journalists and others monitoring protests”
- **VERDICT:** _______

---

## M8 — Employment rights and industrial action

Whipped. 24 divisions, Jan – Jul 2023.

**What the graph holds:** 24 divisions
(2023-01-16 → 2023-07-17), 0 classified free-vote-like.
**Bill:** `Strikes (Minimum Service Levels) Act 2023` — <https://bills.parliament.uk/bills/3396>

### M8.113 — Grant Shapps (MNIS 1582), Conservative

- **Proposed position on Employment rights and industrial action:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Strikes (Minimum Service Levels) Act 2023" (bills-api billId 3396)
- **Source:** <https://bills.parliament.uk/bills/3396>
- **In its own words:** “A Bill to make provision about minimum service levels in connection with the taking by trade unions of strike action relating to certain services.”
- **VERDICT:** _______

### M8.114 — Lord Callanan (MNIS 4336), Conservative

- **Proposed position on Employment rights and industrial action:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Strikes (Minimum Service Levels) Act 2023" (bills-api billId 3396)
- **Source:** <https://bills.parliament.uk/bills/3396>
- **In its own words:** “A Bill to make provision about minimum service levels in connection with the taking by trade unions of strike action relating to certain services.”
- **VERDICT:** _______

### M8.115 — Lord Collins of Highbury (MNIS 4222), Labour

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 42 at Committee stage, with 2 co-sponsors (Baroness O'Grady of Upper Holloway, Lord Hendy) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “leave out subsections (2) and (3)”
- **VERDICT:** _______

### M8.116 — Lord Fox (MNIS 4322), Liberal Democrat

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 43 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “leave out subsections (2) to (5) and insert— A statutory instrument containing regulations under this section may not be made unless a draft of the instrument has been laid before, and approved by a resolution of, each House of Parliament.”…”
- **VERDICT:** _______

### M8.117 — Baroness Randerson (MNIS 4230), Liberal Democrat

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 48 at Committee stage, with 1 co-sponsor (Lord Thomas of Cwmgiedd) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “leave out from “Act” to end of line 11 and insert “of Parliament. This section does not apply to—”
- **VERDICT:** _______

### M8.118 — Lord Greenhalgh (MNIS 4877), Conservative

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 48A at Committee stage, with 1 co-sponsor (Lord Hogan-Howe) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “Insert the following new Clause— “Review: extending restrictions to other services”
- **VERDICT:** _______

### M8.119 — Lord Balfe (MNIS 4302), Conservative

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 50 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “after first “on” insert “the day two years after””
- **VERDICT:** _______

### M8.120 — Lord Allan of Hallam (MNIS 397), Liberal Democrat

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 15 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “at end insert— Before making regulations under this section the Secretary of State must lay before each House of Parliament a statement outlining how the regulations are both necessary and proportionate.””
- **VERDICT:** _______

### M8.121 — Baroness Noakes (MNIS 2554), Conservative

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 17 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “After paragraph (b) insert— users of the services or others who are affected by the availability of the services,””
- **VERDICT:** _______

### M8.122 — Lord Patel (MNIS 2443), Crossbench

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 18 at Committee stage, with 1 co-sponsor (Lord Kakkar) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “at end insert— Regulations made under subsection (4)(a) specifying minimum service levels for health services may not be made unless the Government has first established, via primary legislation, appropriate and legally enforceable staffing levels across healt…”
- **VERDICT:** _______

### M8.123 — Lord Hendy (MNIS 4723), Labour

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 18A at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “at end insert— Regulations may not prohibit or enable the prohibition of participation in, or any activity in connection with, a strike or other industrial action; or create an offence.””
- **VERDICT:** _______

### M8.124 — Lord Thomas of Cwmgiedd (MNIS 4309), Crossbench

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 6 at Report stage, with 3 co-sponsors (Baroness Randerson, Baroness Finlay of Llandaff, Lord Collins of Highbury) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17586/amendments>
- **In its own words:** “leave out from “Act” to end of line 11 and insert “of Parliament. This section does not apply to—”
- **VERDICT:** _______

### M8.125 — Baroness O'Grady of Upper Holloway (MNIS 4977), Labour

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 4 at Report stage, with 2 co-sponsors (The Lord Bishop of London, Lord Fox) — decision: Agreed
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17586/amendments>
- **In its own words:** “at end insert— “234CA Protection of employees”
- **VERDICT:** _______

---

## M9 — Sewage, water quality and the Environment Act

39 divisions, Jan – Nov 2021. The sewage amendments are the well-reported part.

**What the graph holds:** 39 divisions
(2021-01-26 → 2021-11-08), 0 classified free-vote-like.
**Bill:** `Environment Act 2021` — <https://bills.parliament.uk/bills/2593>

### M9.126 — George Eustice (MNIS 3934), Conservative

- **Proposed position on Sewage, water quality and the Environment Act:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Environment Act 2021" (bills-api billId 2593)
- **Source:** <https://bills.parliament.uk/bills/2593>
- **In its own words:** “A Bill to make provision about targets, plans and policies for improving the natural environment; for statements and reports about environmental protection; for the Office for Environmental Protection; about waste and re…”
- **VERDICT:** _______

### M9.127 — Lord Goldsmith of Richmond Park (MNIS 4062), Conservative

- **Proposed position on Sewage, water quality and the Environment Act:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Environment Act 2021" (bills-api billId 2593)
- **Source:** <https://bills.parliament.uk/bills/2593>
- **In its own words:** “A Bill to make provision about targets, plans and policies for improving the natural environment; for statements and reports about environmental protection; for the Office for Environmental Protection; about waste and re…”
- **VERDICT:** _______

### M9.128 — The Earl of Lindsay (MNIS 2059), Conservative

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 1 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “Insert the following new Clause— “Environmental objectives”
- **VERDICT:** _______

### M9.129 — Lord Teverson (MNIS 3789), Liberal Democrat

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 2 at Committee stage, with 3 co-sponsors (Baroness Jones of Whitchurch, Baroness Jones of Moulsecoomb, Baroness Bennett of Manor Castle) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “Insert the following new Clause— “Purpose and declaration of biodiversity and climate emergency”
- **VERDICT:** _______

### M9.130 — The Duke of Wellington (MNIS 4541), Crossbench

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 4 at Committee stage, with 1 co-sponsor (Baroness Altmann) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “at end insert “, in particular water quality;””
- **VERDICT:** _______

### M9.131 — Lord Blencathra (MNIS 497), Conservative

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 5 at Committee stage, with 1 co-sponsor (Lord Randall of Uxbridge) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “leave out paragraph (c) and insert— nature;””
- **VERDICT:** _______

### M9.132 — Baroness Bennett of Manor Castle (MNIS 4719), Green Party

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 7 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “leave out “resource efficiency” and insert “reduction in resource use””
- **VERDICT:** _______

### M9.133 — Baroness Scott of Needham Market (MNIS 2542), Liberal Democrat

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 8 at Committee stage, with 3 co-sponsors (Baroness Quin, Baroness Bennett of Manor Castle, Lord Teverson) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “at end insert— public access to and enjoyment of the natural environment.””
- **VERDICT:** _______

### M9.134 — Lord Lucas (MNIS 1879), Conservative

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 9 at Committee stage, with 2 co-sponsors (Baroness Boycott, Lord Blencathra) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “at end insert— connecting people with nature.””
- **VERDICT:** _______

### M9.135 — Lord Randall of Uxbridge (MNIS 209), Conservative

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 10 at Committee stage, with 3 co-sponsors (Lord Carrington, Baroness Bakewell of Hardington Mandeville, Lord Taylor of Holbeach) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “at end insert— light pollution.””
- **VERDICT:** _______

### M9.136 — Lord Harries of Pentregarth (MNIS 3813), Crossbench

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 12 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “at end insert— the planting of new trees.”
- **VERDICT:** _______

### M9.137 — Baroness Bakewell of Hardington Mandeville (MNIS 4285), Liberal Democrat

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 13 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “at end insert— a reduction in the use of conventional plastic packaging.”
- **VERDICT:** _______

### M9.138 — Lord Addington (MNIS 3453), Liberal Democrat

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 19 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “at end insert— Before making regulations under subsection (1)(b), the Secretary of State must consult—”
- **VERDICT:** _______

### M9.139 — Baroness Jones of Whitchurch (MNIS 3792), Labour

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 20 at Committee stage, with 3 co-sponsors (Baroness Walmsley, Baroness Finlay of Llandaff, Lord Randall of Uxbridge) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “leave out subsection (2) and insert— The PM2.5 air quality target must—”
- **VERDICT:** _______

### M9.140 — Lord Whitty (MNIS 2444), Labour

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 21 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “at end insert— The Secretary of State must by regulations stipulate the numbers of fixed or mobile devices to monitor the level of PM2.5 in ambient air to be operated by highways authorities or local authorities.””
- **VERDICT:** _______

### M9.141 — Lord Chidgey (MNIS 50), Liberal Democrat

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 23 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “After subsection (1) insert— In the range of species which contribute to the target, at least one must be a species that is significant to chalk streams and its abundance an indicator of the health of its ecosystem.””
- **VERDICT:** _______

---

## M10 — Retained EU law and the "sunset" clause

Whipped. 25 divisions, Oct 2022 – Jun 2023.

**What the graph holds:** 25 divisions
(2022-10-25 → 2023-06-21), 0 classified free-vote-like.
**Bill:** `Retained EU Law (Revocation and Reform) Act 2023` — <https://bills.parliament.uk/bills/3340>

### M10.142 — Mr Jacob Rees-Mogg (MNIS 4099), Conservative

- **Proposed position on Retained EU law and the "sunset" clause:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Retained EU Law (Revocation and Reform) Act 2023" (bills-api billId 3340)
- **Source:** <https://bills.parliament.uk/bills/3340>
- **In its own words:** “A Bill to revoke certain retained EU law; to make provision relating to the interpretation of retained EU law and to its relationship with other law; to make provision relating to powers to modify retained EU law; to ena…”
- **VERDICT:** _______

### M10.143 — Lord Callanan (MNIS 4336), Conservative

- **Proposed position on Retained EU law and the "sunset" clause:** SUPPORTS
- **Basis:** `bill-sponsor`
- **Citation:** Named sponsor of "Retained EU Law (Revocation and Reform) Act 2023" (bills-api billId 3340)
- **Source:** <https://bills.parliament.uk/bills/3340>
- **In its own words:** “A Bill to revoke certain retained EU law; to make provision relating to the interpretation of retained EU law and to its relationship with other law; to make provision relating to powers to modify retained EU law; to ena…”
- **VERDICT:** _______

### M10.144 — Brendan O'Hara (MNIS 4371), Scottish National Party

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 70 at Committee stage, with 1 co-sponsor (Peter Grant) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17082/amendments>
- **In its own words:** “Clause 16, page 18, line 25, at end insert— “(1A) Before the power in subsection (1) may be exercised, the relevant national authority must publish a written statement on any societal and economic changes relevant to the intended modifications.”…”
- **VERDICT:** _______

### M10.145 — Justin Madders (MNIS 4418), Labour

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 87 at Committee stage, with 4 co-sponsors (Alex Sobel, Stella Creasy, Paul Blomfield, Mary Glindon) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17082/amendments>
- **In its own words:** “Clause 16, page 18, line 27, at end insert— “(3) No regulations may be made under this section unless the conditions set out in section [Conditions on the exercise of powers under section 15 and 16] have been complied with.”…”
- **VERDICT:** _______

### M10.146 — Ms Nusrat Ghani (MNIS 4460), Conservative

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 1 at Committee stage — decision: Agreed
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17082/amendments>
- **In its own words:** “Schedule 3, page 30, line 5, leave out paragraph 2 and insert— ““2 (1)Sub-paragraph (2) applies to a statutory instrument containing regulations under this Act which is subject to a procedure before Parliament for the approval of the instrument in draft before…”
- **VERDICT:** _______

### M10.147 — Baroness Randerson (MNIS 4230), Liberal Democrat

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 117 at Committee stage, with 1 co-sponsor (Lord Bruce of Bennachie) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “Clause 15, page 18, line 38, at end insert— “(3A) Regulations under subsections (2) or (3) may not be made if they apply to an instrument, or a provision of an instrument, which is subject to an agreed Common Framework unless it has been subject to the full pr…”
- **VERDICT:** _______

### M10.148 — Baroness Humphreys (MNIS 4300), Liberal Democrat

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 118 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “Clause 15, page 18, line 38, at end insert— “(3A) A Minister of the Crown may not make regulations under subsections (1) to (3) if any provision of those regulations is within the legislative competence of the Scottish Parliament, Senedd Cymru or the Northern …”
- **VERDICT:** _______

### M10.149 — Baroness Thornton (MNIS 1782), Labour

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 118A at Committee stage, with 1 co-sponsor (Baroness Crawley) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “Clause 15, page 18, line 38, at end insert— “(3A) A Minister of the Crown, whether acting alone or with another relevant national authority, may not exercise the power in subsection (2) or (3) unless—”
- **VERDICT:** _______

### M10.150 — Baroness Ritchie of Downpatrick (MNIS 4130), Labour

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 119 at Committee stage, with 2 co-sponsors (Baroness Suttie, Baroness Chapman of Darlington) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “Clause 15, page 19, line 16, at end insert— “(iii) effect substantial policy change so far as it relates to human rights, equality or environmental protection legislation with effect in Northern Ireland.””
- **VERDICT:** _______

### M10.151 — Lord Fox (MNIS 4322), Liberal Democrat

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 120 at Committee stage, with 2 co-sponsors (Baroness Ludford, Baroness Chapman of Darlington) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “Clause 15, page 19, line 17, leave out subsection (5)”
- **VERDICT:** _______

### M10.152 — The Earl of Lindsay (MNIS 2059), Conservative

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 121 at Committee stage, with 1 co-sponsor (Baroness Crawley) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “Clause 15, page 19, line 17, leave out subsections (5) and (6)”
- **VERDICT:** _______

### M10.153 — Lord Whitty (MNIS 2444), Labour

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 121A at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “Clause 15, page 19, line 17, leave out subsections (5) to (11)”
- **VERDICT:** _______

### M10.154 — Baroness McIntosh of Pickering (MNIS 384), Conservative

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 122 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “Clause 15, page 19, line 27, leave out “23 June 2026” and insert “11:59 pm on 31 December 2028””
- **VERDICT:** _______

### M10.155 — Baroness Lawlor (MNIS 4965), Conservative

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 122A at Committee stage — decision: WithdrawnBeforeDebate
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “[Withdrawn] Clause 15, page 19, line 27, leave out “23 June 2026” and insert “the end of 2024””
- **VERDICT:** _______

### M10.156 — Baroness Parminter (MNIS 4178), Liberal Democrat

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 126 at Committee stage, with 3 co-sponsors (Lord Krebs, Lord Randall of Uxbridge, Baroness Bennett of Manor Castle) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “After Clause 15, insert the following new Clause— “Powers to revoke or replace: application to environmental law”
- **VERDICT:** _______

### M10.157 — Baroness Ludford (MNIS 1867), Liberal Democrat

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 128 at Committee stage, with 1 co-sponsor (Lord Fox) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “After Clause 16, insert the following new Clause— “Conditions on the exercise of powers under sections 15 and 16”
- **VERDICT:** _______

---
