# GOLD CANDIDATES — the validation set

**Status:** ⚠⚠ **DRAFT INSTRUMENT. NOTHING HAS BEEN SCORED AGAINST THESE, AND NOTHING SHOULD BE UNTIL CHARLIE HAS VALIDATED THEM.** S8 §5 is explicit: "Do not score anything against these yet… Charlie's validation pass is what makes it real."

**Written:** 19 August 2026, by CC-Search, executing `BRIEF_SEARCH_S8.md` §5. **Purpose:** the binding constraint on all retrieval-quality work is the test set (SEARCH_STRATEGY v5 §5.2). Committees — the largest evidence collection — is unevaluable today; caselaw and guidance are scored on questions we wrote ourselves; the §4 candidate streams have none at all. This is the draft that fixes that.

**Since written, in this order:**

1.  **19 Aug 22:54 UTC — CC-Ingest** inserted a case-name and first-paragraph extract into each of the ten case-law blocks (`BRIEF_INGEST_NAMES.md` §1.3). Those ten blockquotes are theirs and are preserved byte-for-byte below.
2.  **19 Aug 23:0x UTC — CC-Search** restructured the file for review (`BRIEF_SEARCH_S9.md` §1) and appended Q51–Q60 (§5). **No question, key or rationale was reworded** — §1 says the review is Charlie's. What changed is the shape only: a single running number Q1–Q60, the archetype spelled out where it is used, a one-line VERDICT slot, and the progress index below.

***

## HOW TO REVIEW THIS — one pass, sixty lines

Every question is a numbered block ending in a **VERDICT** line. Fill in that one line and move on:

```
- **VERDICT →** ACCEPT
- **VERDICT →** REJECT — the case is about something else entirely
- **VERDICT →** AMEND — a real user would say "sewage", not "effluent"
```

A rejected question **with a reason** is worth more to the next pass than a silently deleted one. You do not need to supply a replacement; "reject, and here is roughly what I'd ask instead" is plenty.

**The three things worth your eye above all:**

1.  **Q11–Q20, case law.** ⚠⚠ **Four are now known WRONG** — see the note under that heading. CC-Ingest's extracts closed the subject question for all ten, and six survived it.
2.  **Is this what a real person would type?** The questions were written by the thing being tested. That is the exact failure S8 §5 exists to correct, and only you can close it.
3.  **Q51–Q60, statistics.** Brand new and marked UNVALIDATED for the same reason.

### Progress index — tick as you go

| \#      | Section                                 | Count | Reviewed |
|---------|-----------------------------------------|-------|----------|
| Q1–Q10  | Committees                              | 10    | ☐        |
| Q11–Q20 | Case law ⚠ **four known-wrong keys**    | 10    | ☐        |
| Q21–Q30 | Guidance                                | 10    | ☐        |
| Q31–Q40 | Impact assessments                      | 10    | ☐        |
| Q41–Q50 | Consultations                           | 10    | ☐        |
| Q51–Q60 | **Statistics — UNVALIDATED, new in S9** | 10    | ☐        |

The old block codes (`C3`, `K7`, `I10` …) are kept beside the running number because `SEARCH_S8_REPORT.md` and the change log already cite them. Either handle works.

***

## ⚠⚠ READ THIS BEFORE THE QUESTIONS — THREE FINDINGS FROM BUILDING THE KEYS

Building an answer key meant querying `corpus_sections` **directly**, never through `runSearch()`. Keying a question on whatever retrieval returns for it makes recall 100% by construction and measures nothing. Doing it that way surfaced three facts about the corpus that matter more than any individual question below.

**1. ⚠⚠ CASE LAW CANNOT BE KEYED FROM THE DATABASE AT ALL.** Every `tna-caselaw` row has `sectionTitle = NULL`. The **id IS the neutral citation** (`tna-caselaw:[2003] EWCA Civ 1769:1`); the case name, the parties and the subject matter exist only in the R2 body. So there is no way to ask the database "which case is about reasonable adjustments" — a title search returns nothing for *every* legal topic, not because the corpus lacks the cases but because it holds no titles.

Consequently the ten case-law questions below carry a key that is **half-verified**: the citation is confirmed PRESENT in the corpus (read back by id), but that the case is *about* what the question asks is asserted from outside knowledge and **is not verified from here**. Each is marked `KEY: PRESENT / SUBJECT UNVERIFIED`. That is the honest state, and closing it needs either an R2 read or Charlie's eye — it is the single biggest obstacle to a real case-law gold set.

**2. ⚠ IMPACT ASSESSMENTS ARE KEYED THROUGH THEIR PARENT, NOT THEIR TITLE.** `sectionTitle` on `impact-assessments` is the internal heading — "Summary", "Costs and benefits", "RPC opinion" — the S2C6 §1 finding, still true. The subject lives on the parent instrument via `parentDocId` → `corpus_acts.title`, and **only 1,566 of 3,000 sampled rows (52%) resolve to a named instrument**. The other 48% cannot be keyed this way either. Every impact-assessment key below is a row whose parent resolved.

**3. ⚠ SEVERAL GUIDANCE COLLECTIONS ARE UNASKABLE BY TITLE.** `ico`, `fca-handbook`, `sentencing-council` and `planning-policy` returned nothing for their own core subject matter — ICO titles are decision-notice respondents ("Bracknell Forest Borough Council"), FCA titles are `NULL`, and the handbook code is the whole identity. The guidance questions below are drawn from the collections that DO carry topical titles (`hmrc-manuals`, `cps-guidance`, `college-of-policing`), and the gap in the others is recorded here rather than worked around.

### Sourcing method, per §5

Every question is marked `document-outward` (found a real document, wrote the question it answers) or `outside-in` (took a real public controversy, wrote what a user would ask, then searched the store for what should answer it). §5 requires both, because "a set built only document-outward inherits the corpus's vocabulary and overstates recall". Across Q1–Q50 the split is **21 outside-in / 29 document-outward**; the outside-in ones are the harder half and the ones most likely to fail. Q51–Q60 add 8 outside-in / 2 document-outward.

### Question shapes (archetypes)

The existing gold archetypes A–K were written for legislation, debates and the citation graph and do not describe these collections. Seven new shapes, so coverage is visible rather than accidental. **Each is spelled out inline at every question**, so this table is a reference rather than something to hold in your head:

| shape                            | what the user wants                                                                 |
|----------------------------------|-------------------------------------------------------------------------------------|
| **L — who said it**              | the specific testimony or submission on a subject                                   |
| **M — what was concluded**       | a committee's finding or recommendation                                             |
| **N — what was predicted**       | an impact assessment's estimate of cost or effect                                   |
| **O — what was asked**           | the consultation on a policy, and what came back                                    |
| **P — what the regulator says**  | operational guidance on a duty                                                      |
| **Q — what the court decided**   | a named judgment's holding                                                          |
| **R — does a measurement exist** | ⚠ new in S9 · whether a numeric series exists at all — **never what the number is** |

***

# Q1–Q10 · COMMITTEES

### Q1 · C1 — What did the Lords say about how badly water and sewage regulation was failing?

-   **Key:** `committees-reports:publication:34458:189872-0001` and `…-0002` — *1st Report — The affluent and the effluent: cleaning up failures in water and sewage regulation*, Industry and Regulators Committee, 22 Mar 2023.
-   **Why asked:** sewage discharge is the most-complained-about environmental issue in England; someone drafting a water-regulation proposal needs the committee that already concluded the regulator failed.
-   **Shape:** M — what was concluded · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q2 · C2 — Has a committee looked at the Post Office Horizon compensation scheme?

-   **Key:** `committees-reports:publication:48294:252814` (letter on improving the Horizon redress process, 10 Jun 2025); `committees-reports:publication:34605:190516` (Post Office compensation for the Horizon scandal, 23 Mar 2023).
-   **Why asked:** the best-known miscarriage-of-justice scandal of the decade; anyone proposing a redress mechanism starts from how this one went.
-   **Shape:** M — what was concluded · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q3 · C3 — What has Parliament been told about the government's response to the Grenfell Inquiry?

-   **Key:** `committees-reports:publication:46883:241779` — letter from the MHCLG Permanent Secretary on the UK government response to the Grenfell Tower Inquiry Phase 2 Report, 26 Feb 2025.
-   **Why asked:** building-safety proposals are all downstream of Grenfell; the user wants to know what government has actually committed to.
-   **Shape:** M — what was concluded · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q4 · C4 — What did the committee say about moving people onto Universal Credit?

-   **Key:** `committees-reports:publication:22289:164915` and `…:165036` — correspondence with the Secretary of State on managed migration to Universal Credit, 18 May 2022.
-   **Why asked:** managed migration is where the harm concentrated; a welfare proposal needs the scrutiny record, not the policy statement.
-   **Shape:** M — what was concluded · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q5 · C5 — Has anyone in Parliament raised leasehold reform with ministers?

-   **Key:** `committees-reports:publication:34123:187763` (Minister of State for Housing, 20 Feb 2023); `committees-reports:publication:255:1142` (Chair to Minister, 9 Mar 2020); `committees-reports:publication:257:1111` (CMA to Chair on leaseholds, 28 Feb 2020).
-   **Why asked:** leasehold reform has been "imminent" for years; the user wants to see the paper trail rather than the announcements.
-   **Shape:** M — what was concluded · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q6 · C6 — What did people submitting evidence say about how AI should be governed?

-   **Key:** `committees-evidence:writtenevidence:112256:179384` and `…:112257:175552` — submissions to the *Governance of artificial intelligence (AI)* inquiry, 13 Dec 2022.
-   **Why asked:** an AI-regulation proposal needs the range of positions already on the record, not a summary of them.
-   **Shape:** L — who said it · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q7 · C7 — What evidence was submitted about net zero and trade?

-   **Key:** `committees-evidence:writtenevidence:129871:220666` and `…:129872:220668` — submissions to the *Net zero and trade* inquiry, 8 May 2024.
-   **Why asked:** carbon border measures are live policy; the user wants the submissions rather than the committee's digest of them.
-   **Shape:** L — who said it · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q8 · C8 — What did witnesses tell the committee about special educational needs?

-   **Key:** `committees-evidence:writtenevidence:100004:146799` (SCN0679) and `…:100008:145455` (SCN0680) — *Special educational needs and disabilities* inquiry, 2019.
-   **Why asked:** SEND is one of the highest-volume complaint areas in English local government; a reform proposal needs the parent and provider testimony.
-   **Shape:** L — who said it · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q9 · C9 — What was the committee told about serious violence?

-   **Key:** `committees-evidence:writtenevidence:100005:145526` (SVC0052) — *Serious violence* inquiry, 6 Mar 2019.
-   **Why asked:** knife-crime proposals are common from members of the public; the evidence base already exists and is rarely cited.
-   **Shape:** L — who said it · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q10 · C10 — Has Parliament examined NHS waiting times for planned operations?

-   **Key:** `committees-reports:publication:50376:272506` (DHSC Permanent Secretary follow-up on reducing NHS waiting times for elective care, 13 Nov 2025); `committees-reports:publication:22555:166025` (PAC report follow-up on waiting times for elective and cancer treatment, 31 May 2022).
-   **Why asked:** the single most common complaint about the NHS; the user wants the scrutiny record across more than one Parliament.
-   **Shape:** M — what was concluded · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

***

# Q11–Q20 · CASE LAW — ⚠⚠ EVERY KEY HERE IS `PRESENT / SUBJECT UNVERIFIED`

See finding 1 above. The citation is confirmed present in the corpus by reading the id back; that the case concerns the question's subject is asserted from outside knowledge and **cannot be checked from this machine**. Charlie's pass on this section matters more than on any other.

## ⚠⚠ RESOLVED, AND BADLY — CC-INGEST'S EXTRACTS REFUTE FOUR OF THE TEN KEYS

**19 Aug 2026, 22:54 UTC.** CC-Ingest inserted the case name and first paragraph into every block below, read from each judgment's own Akoma Ntoso `FRBRname` metadata — the source's statement of what the case is, not a parse of its text. That closes finding 1 for these ten. **Six keys were right and four were wrong**, and every one of the four was asserted with confidence:

| \#      | The question asks about                             | The citation actually is                                                                                    |    |
|---------|-----------------------------------------------------|-------------------------------------------------------------------------------------------------------------|----|
| **Q11** | the public sector equality duty                     | `[2015] UKSC 21` = **R (Evans) v Attorney General** — the "black spider memos" FOI case                     | ❌ |
| **Q17** | whether benefit caps discriminate                   | the **same** `[2015] UKSC 21` = R (Evans) — as the author already flagged                                   | ❌ |
| **Q18** | when a public authority owes a duty of care         | `[2018] UKSC 22` = **Newcastle upon Tyne Hospitals NHS FT v Haywood** — an employment notice-period case    | ❌ |
| **Q19** | the legality of a climate-targets policy            | `[2020] UKSC 12` = **WM Morrison Supermarkets v Various Claimants** — vicarious liability for a data breach | ❌ |
| Q12     | prorogation                                         | Miller v The Prime Minister                                                                                 | ✅ |
| Q13     | gig-economy employment status                       | Uber BV v Aslam                                                                                             | ✅ |
| Q14     | deprivation of liberty in care                      | P v Cheshire West and Chester Council                                                                       | ✅ |
| Q15     | employment tribunal fees                            | R v Lord Chancellor (UNISON)                                                                                | ✅ |
| Q16     | the duty to investigate deaths in custody           | In re McCaughey (NI)                                                                                        | ✅ |
| Q20     | *(exact-pin control, subject deliberately unknown)* | Phillips v Symes — the control still works                                                                  | ✅ |

**▶ The four marked ❌ should be REJECTED or re-keyed, and the decision is yours.** They are left in place, unedited, rather than quietly deleted: **a 40% error rate on keys written from outside knowledge is the single strongest piece of evidence this file produces**, and it is exactly the "implementer writing its own exam" failure that SEARCH_STRATEGY v5 §5.2 names as the binding constraint. Deleting them would delete the finding.

⚠ **This does not mean the corpus lacks those cases** — only that these citations are not them. Re-keying needs a subject-searchable case-law index, which does not exist (finding 1).

### Q11 · K1 — Can a public body be taken to court for failing to consider equality when making cuts?

-   **Key:** `tna-caselaw:[2015] UKSC 21:1` — PRESENT / SUBJECT UNVERIFIED.
-   **Why asked:** the public sector equality duty is the most cited hook for challenging a council decision, and users routinely ask whether it has teeth.
-   **Shape:** Q — what the court decided · **Sourced:** outside-in
-   **VERDICT →REJECT**
-   **STATUS → REJECTED — AWAITING RE-KEY** *(S10 §5, 20 Aug 2026)*. Excluded from scoring; **not deleted**. **Blocker:** re-keying needs a subject-searchable case-law index, which does not exist until CC-Ingest's case-law text fix lands. **Not to be re-keyed from outside knowledge — that is the method that produced this wrong key.** When the index exists it is re-keyed *by search* and re-validated by Charlie.

>   **Extract for verification (INGEST, 19 Aug 2026) — not part of the question.**

>   **Case name:** **R (on the application of Evans) and another v Attorney General** **Route:** `source` — fetched from the judgment's own Akoma Ntoso metadata (`FRBRname`), not parsed from text. **Source states:** citation `[2015] UKSC 21` · court `UKSC` · judgment date `2015-03-26`

>   **First \~200 words of the judgment:**

>   Hilary Term [2015] UKSC 21 On appeal from: [2014] EWCA Civ 254 JUDGMENT R (on the application of Evans) and another ( Respondents ) v Attorney General ( Appellant ) before Lord Neuberger, President Lady Hale, Deputy President Lord Mance Lord Kerr Lord Wilson Lord Reed Lord Hughes JUDGMENT GIVEN ON 26 March 2015 Heard on 24 and 25 November 2014 Appellant Respondent (1) James Eadie QC Dinah Rose QC Karen Steyn QC Ben Jaffey Josh Holmes Aidan Eardley (Instructed by Treasury Solicitor) (Instructed by Jan Clements, Editorial Legal Services, Guardian News Media Ltd) Respondent (2) Timothy Pitt-Payne QC (Instructed by The Information Commissioner) Intervener (Campaign for Freedom of Information) Nathalie Lieven QC Richard Stein Julianne Morrison (Instructed by Leigh Day) Lord Neuberger: ( with whom Lord Kerr and Lord Reed agree) Introductory 1. This is an appeal brought by HM Attorney General against the decision of the Court of Appeal quashing a certificate which he issued on 16 October 2012 pursuant to section 53(2) of the Freedom of Information Act 2000 (“the FOIA 2000”) and regulation 18(6) of the Environmental Information Regulations 2004 (“EIR 2004”). The underlying question in this appeal is whether communications passing between HRH The Prince …

### Q12 · K2 — What did the Supreme Court decide about prorogation of Parliament?

-   **Key:** `tna-caselaw:[2019] UKSC 41:1` — PRESENT / SUBJECT UNVERIFIED.
-   **Why asked:** the best-known constitutional judgment of the era; a proposal touching parliamentary procedure will be measured against it.
-   **Shape:** Q — what the court decided · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

>   **Extract for verification (INGEST, 19 Aug 2026) — not part of the question.**

>   **Case name:** **R (on the application of Miller) v The Prime Minister** **Route:** `source` — fetched from the judgment's own Akoma Ntoso metadata (`FRBRname`), not parsed from text. **Source states:** citation `[2019] UKSC 41` · court `UKSC` · judgment date `2019-09-24`

>   **First \~200 words of the judgment:**

>   [2019] UKSC 41 On appeals from: [2019] EWHC 2381 (QB) and [2019] CSIH 49 JUDGMENT R (on the application of Miller) ( Appellant ) v The Prime Minister ( Respondent ) Cherry and others (Respondents) v Advocate General for Scotland (Appellant) (Scotland) before Lady Hale, President Lord Reed, Deputy President Lord Kerr Lord Wilson Lord Carnwath Lord Hodge Lady Black Lord Lloyd-Jones Lady Arden Lord Kitchin Lord Sales JUDGMENT GIVEN ON 24 September 2019 Heard on 17, 18 and 19 September 2019 Appellant (Gina Miller) Respondent (The Prime Minister) Lord Pannick QC Sir James Eadie QC Tom Hickman QC David Blundell Warren Fitt Christopher Knight Richard Howell (Instructed by Mishcon de Reya LLP (London)) (Instructed by The Government Legal Department) Appellant (The Advocate General) Respondents (Joanna Cherry MP and others) Lord Keen of Elie QC Aidan O’Neill QC Andrew Webster QC David Welsh Sam Fowles (Instructed by Office of the Advocate General for Scotland) (Instructed by Balfour and Manson LLP (Edinburgh)) 1st Intervener James Wolffe QC, Lord Advocate James Mure QC Christine O’Neill (Instructed by the Legal Department of the Scottish Government) 2nd Intervener Ronan Lavery QC Conan Fegan BL Richard Smyth (Instructed by McIvor Farrell Solicitors) 3rd Intervener Michael …

### Q13 · K3 — Has the Supreme Court ruled on whether gig-economy workers are employees?

-   **Key:** `tna-caselaw:[2021] UKSC 5:1` — PRESENT / SUBJECT UNVERIFIED.
-   **Why asked:** employment-status proposals are common; the user wants the controlling authority rather than commentary.
-   **Shape:** Q — what the court decided · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

>   **Extract for verification (INGEST, 19 Aug 2026) — not part of the question.**

>   **Case name:** **Uber BV and others v Aslam and others** **Route:** `source` — fetched from the judgment's own Akoma Ntoso metadata (`FRBRname`), not parsed from text. **Source states:** citation `[2021] UKSC 5` · court `UKSC` · judgment date `2021-02-19`

>   **First \~200 words of the judgment:**

>   Hilary Term [2021] UKSC 5 On appeal from: [2018] EWCA Civ 2748 JUDGMENT Uber BV and others ( Appellants ) v Aslam and others ( Respondents ) before Lord Reed, President Lord Hodge, Deputy President Lady Arden Lord Kitchin Lord Sales Lord Hamblen Lord Leggatt JUDGMENT GIVEN ON 19 February 2021 Heard on 21 and 22 July 2020 Appellants Respondents (1 and 2) Dinah Rose QC Jason Galbraith-Marten QC Fraser Campbell Sheryn Omeri (Instructed by DLA Piper (UK) LLP (London)) (Instructed by Bates Wells Braithwaite LLP (London)) Respondent (3) Oliver Segal QC Melanie Tether (Instructed by Leigh Day (London)) Respondents:- (1) Yaseen Aslam (2) James Farrar (3) Robert Dawson and others LORD LEGGATT: ( with whom Lord Reed, Lord Hodge, Lady Arden, Lord Sales and Lord Hamblen agree) Introduction 1. New ways of working organised through digital platforms pose pressing questions about the employment status of the people who do the work involved. The central question on this appeal is whether an employment tribunal was entitled to find that drivers whose work is arranged through Uber’s smartphone application (“the Uber app”) work for Uber under workers’ contracts and so qualify for the national minimum wage, paid annual leave and other …

### Q14 · K4 — What has the Supreme Court said about deprivation of liberty in care settings?

-   **Key:** `tna-caselaw:[2014] UKSC 19:1` — PRESENT / SUBJECT UNVERIFIED.
-   **Why asked:** social-care reform proposals run straight into this; it changed what every care home has to do.
-   **Shape:** Q — what the court decided · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

>   **Extract for verification (INGEST, 19 Aug 2026) — not part of the question.**

>   **Case name:** **P v Cheshire West and Chester Council and another** **Route:** `source` — fetched from the judgment's own Akoma Ntoso metadata (`FRBRname`), not parsed from text. **Source states:** citation `[2014] UKSC 19` · court `UKSC` · judgment date `2014-03-19`

>   **First \~200 words of the judgment:**

>   Hilary Term [2014] UKSC 19 On appeal from: [2011] EWCA Civ 1257; [2011] EWCA Civ 190 JUDGMENT P (by his litigation friend the Official Solicitor) ( Appellant ) v Cheshire West and Chester Council and another ( Respondents ) P and Q (by their litigation friend, the Official Solicitor) ( Appellants ) v Surrey County Council ( Respondent ) before Lord Neuberger, President Lady Hale, Deputy President Lord Kerr Lord Clarke Lord Sumption Lord Carnwath Lord Hodge JUDGMENT GIVEN ON 19 March 2014 Heard on 21, 22 and 23 October 2013 Appellant Respondent Richard Gordon QC Jenni Richards QC Simon Burrows Amy Street Neil Allen Peter Mant (Instructed by O’Donnells Solicitors) (Instructed by Cheshire West and Chester Council Legal Services) 2 nd Respondent Joseph O’Brien Ian Goldsack (Instructed by Irwin Mitchell LLP) Appellant Respondent Richard Gordon QC Jenni Richards QC Fenella Morris Benjamin Tankel Neil Allen Peter Mant (Instructed by Steel Shamash Solicitors) (Instructed by Surrey County Council Legal Services) Intervener Paul Bowen QC (Instructed by Equality and Human Rights Commission) Intervener (National Autistic Society and Mind) Ian Wise QC Stephen Broach Martha Spurrier (Instructed by Clifford Chance LLP) Intervener (The AIRE Centre) Elizabeth-Anne Gumbel QC Henry Witcomb Duncan Fairgrieve …

### Q15 · K5 — Is there a Supreme Court case about employment tribunal fees?

-   **Key:** `tna-caselaw:[2017] UKSC 51:1` — PRESENT / SUBJECT UNVERIFIED.
-   **Why asked:** the standard example of access to justice defeating a fees policy — directly relevant to any proposal that charges for a remedy.
-   **Shape:** Q — what the court decided · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

>   **Extract for verification (INGEST, 19 Aug 2026) — not part of the question.**

>   **Case name:** **R v Lord Chancellor** **Route:** `source` — fetched from the judgment's own Akoma Ntoso metadata (`FRBRname`), not parsed from text. **Source states:** citation `[2017] UKSC 51` · court `UKSC` · judgment date `2017-07-26`

>   **First \~200 words of the judgment:**

>   Trinity Term [2017] UKSC 51 On appeal from: [2015] EWCA Civ 935 JUDGMENT R (on the application of UNISON) ( Appellant ) v Lord Chancellor ( Respondent ) before Lord Neuberger, President Lady Hale, Deputy President Lord Mance Lord Kerr Lord Wilson Lord Reed Lord Hughes JUDGMENT GIVEN ON 26 July 2017 Heard on 27 and 28 March 2017 Appellant Respondent Dinah Rose QC David Barr QC Karon Monaghan QC Victoria Wakefield Iain Steele Matthew Purchase (Instructed by UNISON Legal Services) (Instructed by The Government Legal Department) Intervener (1) Michael Ford QC Mark Whitcombe Spencer Keen (Instructed by Equality and Human Rights Commission) Intervener (2) (Written submissions only) Aidan O’Neill QC (Instructed by Balfour Manson) (1) Equality and Human Rights Commission (2) Independent Workers Union of Great Britain LORD REED: (with whom Lord Neuberger, Lord Mance, Lord Kerr, Lord Wilson and Lord Hughes agree) 1. The issue in this appeal is whether fees imposed by the Lord Chancellor in respect of proceedings in employment tribunals (“ETs”) and the employment appeal tribunal (“EAT”) are unlawful because of their effects on access to justice. 2. ETs have jurisdiction to determine numerous employment-related claims, most of which are based on rights created by …

### Q16 · K6 — What did the court decide about the duty to investigate deaths in custody?

-   **Key:** `tna-caselaw:[2011] UKSC 20:1` — PRESENT / SUBJECT UNVERIFIED.
-   **Why asked:** prison and detention proposals need the Article 2 procedural duty.
-   **Shape:** Q — what the court decided · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

>   **Extract for verification (INGEST, 19 Aug 2026) — not part of the question.**

>   **Case name:** **In the matter of an application by Brigid McCaughey and another for Judicial Review (Northern Ireland)** **Route:** `source` — fetched from the judgment's own Akoma Ntoso metadata (`FRBRname`), not parsed from text. **Source states:** citation `[2011] UKSC 20` · court `UKSC` · judgment date `2011-05-18`

>   **First \~200 words of the judgment:**

>   Easter Term [2011] UKSC 20 On appeal from: [2010] NICA 13 JUDGMENT In the matter of an application by Brigid McCaughey and another for Judicial Review (Northern Ireland) before Lord Phillips, President Lord Hope, Deputy President Lord Rodger Lady Hale Lord Brown Lord Kerr Lord Dyson JUDGMENT GIVEN ON 18 May 2011 Heard on 2 and 3 February 2011 Appellant Respondent Karen Quinlivan Frank O’Donoghue QC Jessica Simor Sean Doran BL (Instructed by Madden Finucane) (Instructed by Coroner’s Service for Northern Ireland) Respondent Intervener Paul Maguire QC Rabinder Singh QC Dr Tony McGleenan BL Fiona Doherty BL (Instructed by Instructed by Crown Solicitor’s Office) (Instructed by Northern Ireland Human Rights Commission and Equality and Human Rights Commission) Intervener John Larkin QC David Scoffield BL (Attorney General for Northern Ireland) LORD PHILLIPS: Introduction 1. These appeals require the Court to consider once again the impact of article 2 of the European Convention on Human Rights (“the Convention”) on the scope of an inquest. They arise because of a change that the Grand Chamber of the Strasbourg Court has made as to the nature of the obligations imposed by article 2. I shall start by describing briefly the nature of that change. …

### Q17 · K7 — Has the Supreme Court considered whether benefit caps discriminate?

-   **Key:** `tna-caselaw:[2015] UKSC 21:1` (see Q11 — ⚠ **the same citation is offered for two different questions**; at most one can be right, and this is exactly the ambiguity finding 1 produces). PRESENT / SUBJECT UNVERIFIED.
-   **Why asked:** welfare-cap proposals invite the discrimination challenge immediately.
-   **Shape:** Q — what the court decided · **Sourced:** outside-in
-   **VERDICT →** **REJECT**
-   **STATUS → REJECTED — AWAITING RE-KEY** *(S10 §5, 20 Aug 2026)*. Excluded from scoring; **not deleted**. **Blocker:** re-keying needs a subject-searchable case-law index, which does not exist until CC-Ingest's case-law text fix lands. **Not to be re-keyed from outside knowledge — that is the method that produced this wrong key.** When the index exists it is re-keyed *by search* and re-validated by Charlie.

>   **Extract for verification (INGEST, 19 Aug 2026) — not part of the question.**

>   **Case name:** **R (on the application of Evans) and another v Attorney General** **Route:** `source` — fetched from the judgment's own Akoma Ntoso metadata (`FRBRname`), not parsed from text. **Source states:** citation `[2015] UKSC 21` · court `UKSC` · judgment date `2015-03-26`

>   **First \~200 words of the judgment:**

>   Hilary Term [2015] UKSC 21 On appeal from: [2014] EWCA Civ 254 JUDGMENT R (on the application of Evans) and another ( Respondents ) v Attorney General ( Appellant ) before Lord Neuberger, President Lady Hale, Deputy President Lord Mance Lord Kerr Lord Wilson Lord Reed Lord Hughes JUDGMENT GIVEN ON 26 March 2015 Heard on 24 and 25 November 2014 Appellant Respondent (1) James Eadie QC Dinah Rose QC Karen Steyn QC Ben Jaffey Josh Holmes Aidan Eardley (Instructed by Treasury Solicitor) (Instructed by Jan Clements, Editorial Legal Services, Guardian News Media Ltd) Respondent (2) Timothy Pitt-Payne QC (Instructed by The Information Commissioner) Intervener (Campaign for Freedom of Information) Nathalie Lieven QC Richard Stein Julianne Morrison (Instructed by Leigh Day) Lord Neuberger: ( with whom Lord Kerr and Lord Reed agree) Introductory 1. This is an appeal brought by HM Attorney General against the decision of the Court of Appeal quashing a certificate which he issued on 16 October 2012 pursuant to section 53(2) of the Freedom of Information Act 2000 (“the FOIA 2000”) and regulation 18(6) of the Environmental Information Regulations 2004 (“EIR 2004”). The underlying question in this appeal is whether communications passing between HRH The Prince …

### Q18 · K8 — What is the leading case on when a public authority owes a duty of care?

-   **Key:** `tna-caselaw:[2018] UKSC 22:1` — PRESENT / SUBJECT UNVERIFIED.
-   **Why asked:** proposals creating new statutory duties need to know how courts treat them in negligence.
-   **Shape:** Q — what the court decided · **Sourced:** outside-in
-   **VERDICT →Reject**
-   **STATUS → REJECTED — AWAITING RE-KEY** *(S10 §5, 20 Aug 2026)*. Excluded from scoring; **not deleted**. **Blocker:** re-keying needs a subject-searchable case-law index, which does not exist until CC-Ingest's case-law text fix lands. **Not to be re-keyed from outside knowledge — that is the method that produced this wrong key.** When the index exists it is re-keyed *by search* and re-validated by Charlie.

>   **Extract for verification (INGEST, 19 Aug 2026) — not part of the question.**

>   **Case name:** **Newcastle upon Tyne Hospitals NHS Foundation Trust v Haywood** **Route:** `source` — fetched from the judgment's own Akoma Ntoso metadata (`FRBRname`), not parsed from text. **Source states:** citation `[2018] UKSC 22` · court `UKSC` · judgment date `2018-04-25`

>   **First \~200 words of the judgment:**

>   Easter Term [2018] UKSC 22 On appeal from: [2017] EWCA Civ 153 JUDGMENT Newcastle upon Tyne Hospitals NHS Foundation Trust ( Appellant ) v Haywood ( Respondent ) before Lady Hale, President Lord Wilson Lady Black Lord Lloyd-Jones Lord Briggs JUDGMENT GIVEN ON 25 April 2018 Heard on 20 November 2017 Appellant Respondent John Cavanagh QC Caspar Glyn QC Holly Stout Tom Brown (Instructed by Samuel Phillips) (Instructed by Irwin Mitchell LLP (Birmingham)) LADY HALE: (with whom Lord Wilson and Lady Black agree) 1. If an employee is dismissed on written notice posted to his home address, when does the notice period begin to run? Is it when the letter would have been delivered in the ordinary course of post? Or when it was in fact delivered to that address? Or when the letter comes to the attention of the employee and he has either read it or had a reasonable opportunity of doing so? 2. Given the vast numbers of working people who might be affected by this issue, it is perhaps surprising that it has not previously come before the higher courts. This Court, in Gisda Cyf v Barratt [2010] UKSC 41 ; [2010] ICR 1475 , held …

### Q19 · K9 — Has the Supreme Court ruled on the legality of a government policy on climate targets?

-   **Key:** `tna-caselaw:[2020] UKSC 12:1` — PRESENT / SUBJECT UNVERIFIED.
-   **Why asked:** net-zero proposals are increasingly litigated; the user wants the standard of review.
-   **Shape:** Q — what the court decided · **Sourced:** outside-in
-   **VERDICT →Reject**
-   **STATUS → REJECTED — AWAITING RE-KEY** *(S10 §5, 20 Aug 2026)*. Excluded from scoring; **not deleted**. **Blocker:** re-keying needs a subject-searchable case-law index, which does not exist until CC-Ingest's case-law text fix lands. **Not to be re-keyed from outside knowledge — that is the method that produced this wrong key.** When the index exists it is re-keyed *by search* and re-validated by Charlie.

>   **Extract for verification (INGEST, 19 Aug 2026) — not part of the question.**

>   **Case name:** **WM Morrison Supermarkets plc v Various Claimants** **Route:** `source` — fetched from the judgment's own Akoma Ntoso metadata (`FRBRname`), not parsed from text. **Source states:** citation `[2020] UKSC 12` · court `UKSC` · judgment date `2020-04-01`

>   **First \~200 words of the judgment:**

>   Hilary Term [2020] UKSC 12 On appeal from: [2018] EWCA Civ 2339 JUDGMENT WM Morrison Supermarkets plc ( Appellant ) v Various Claimants ( Respondents ) before Lady Hale Lord Reed Lord Kerr Lord Hodge Lord Lloyd-Jones JUDGMENT GIVEN ON 1 April 2020 Heard on 6 and 7 November 2019 Appellant Respondents Lord Pannick QC Jonathan Barnes Anya Proops QC Victoria Jolliffe Rupert Paines Gayatri Sarathy (Instructed by DWF Law LLP (Manchester)) (Instructed by JMW Solicitors LLP (Manchester)) LORD REED: (with whom Lady Hale, Lord Kerr, Lord Hodge and Lord Lloyd-Jones agree) 1. This appeal is primarily concerned with the circumstances in which an employer is vicariously liable for the conduct of its employees, and provides the court with an opportunity to address the misunderstandings which have arisen since its decision in the case of Mohamud v WM Morrison Supermarkets plc [2016] UKSC 11 ; [2016] AC 677 . It also raises an important question about the Data Protection Act 1998 (“the DPA”). The facts 2. The appellant, Morrisons, is a company which operates a chain of supermarkets. The respondents are 9,263 of its employees or former employees. I shall refer to them as the claimants. Personal information about them …

### Q20 · K10 — What did the Court of Appeal decide in [2003] EWCA Civ 1769?

-   **Key:** `tna-caselaw:[2003] EWCA Civ 1769:1` — PRESENT; subject unknown even to the author.
-   **Why asked:** ⚠ **a real user would NOT ask this.** It is included as a deliberate CONTROL: a pure citation lookup with no topical content, which retrieval should ace. If it does not, the problem is the index rather than the question set.
-   **Shape:** Q — what the court decided (exact-pin control) · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

>   **Extract for verification (INGEST, 19 Aug 2026) — not part of the question.**

>   **Case name:** **Phillips & Anor v Symes & Anor** **Route:** `source` — fetched from the judgment's own Akoma Ntoso metadata (`FRBRname`), not parsed from text. **Source states:** citation `[2003] EWCA Civ 1769` · court `EWCA-Civil` · judgment date `2003-12-05`

>   **First \~200 words of the judgment:**

>   Case No: A3/2003/2068 A3/2003/1259 Neutral Citation Number: [2003] EWCA Civ 1769 IN THE SUPREME COURT OF JUDICATURE COURT OF APPEAL (CIVIL DIVISION) ON APPEAL FROM THE HIGH COURT OF JUSTICE CHANCERY DIVISION MR JUSTICE PETER SMITH Royal Courts of Justice Strand, London, WC2A 2LL Friday 5 th December 2003 Before : LORD JUSTICE WALLER LADY JUSTICE HALE and LORD JUSTICE CARNWATH - - - - - - - - - - - - - - - - - - - - - Between : JONATHAN GUY ANTHONY PHILLIPS Claimants/ ROBERT ANDREW HARLAND (suing as administrators of the estate of Christo Michailidis) Respondents - and - ROBIN JAMES SYMES ROBIN SYMES LIMITED Defendants/ Applicants - - - - - - - - - - - - - - - - - - - - - (Transcript of the Handed Down Judgment of Smith Bernal Wordwave Limited, 190 Fleet Street London EC4A 2AG Tel No: 020 7421 4040, Fax No: 020 7831 8838 Official Shorthand Writers to the Court) - - - - - - - - - - - - - - -

>   Mr Alan Steinfeld QC and Mr John Stephens (instructed by Messrs Lane …

***

# Q21–Q30 · GUIDANCE

### Q21 · G1 — What does HMRC say about why the money laundering rules cover company formation agents?

-   **Key:** `hmrc-manuals:hmrc-internal-manuals/economic-crime-supervision-handbook/ecsh52050:1` — *ECSH52050 — Why do the Money Laundering Regulations include Trust or Company Service Providers*.
-   **Why asked:** anti-money-laundering scope is a live proposal area, and HMRC's own reasoning is more useful than the regulation's text.
-   **Shape:** P — what the regulator says · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q22 · G2 — How do prosecutors decide whether to charge in a domestic abuse case?

-   **Key:** `cps-guidance:prosecution-guidance/domestic-abuse:1` — *Domestic Abuse*, 1 Aug 2024.
-   **Why asked:** the commonest complaint about domestic abuse policy is that charges are not brought; the guidance is the operative document.
-   **Shape:** P — what the regulator says · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q23 · G3 — What happens when someone is accused of making a false allegation of rape?

-   **Key:** `cps-guidance:prosecution-guidance/perverting-course-justice-and-wasting-police-time-cases-involving-allegedly:1`.
-   **Why asked:** a contested area where proposals are made from both directions; the CPS policy is the thing being argued about.
-   **Shape:** P — what the regulator says · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q24 · G4 — What are the rules police have to follow when stopping and searching someone?

-   **Key:** `college-of-policing:app-content/stop-and-search:1` — *Stop and search*, 19 Apr 2022.
-   **Why asked:** one of the most common public-order proposal subjects; users usually cite PACE and miss the operational guidance that actually governs the encounter.
-   **Shape:** P — what the regulator says · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q25 · G5 — What is the CPS guidance on abuse of process?

-   **Key:** `cps-guidance:prosecution-guidance/abuse-process:1`.
-   **Why asked:** relevant to any proposal about delayed or repeated prosecutions.
-   **Shape:** P — what the regulator says · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q26 · G6 — How does a case get sent from the magistrates' court to the Crown Court?

-   **Key:** `cps-guidance:prosecution-guidance/allocation-sending-and-committal-sentence:1`.
-   **Why asked:** court-backlog proposals depend on where cases are heard, and users usually do not know the allocation rules exist.
-   **Shape:** P — what the regulator says · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q27 · G7 — How do I appeal a decision to the Administrative Court?

-   **Key:** `cps-guidance:prosecution-guidance/appeals-administrative-court:1`.
-   **Why asked:** a member of the public proposing a right of appeal needs to know what route already exists.
-   **Shape:** P — what the regulator says · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q28 · G8 — What guidance does HMRC give its own staff on money laundering compliance checks?

-   **Key:** `hmrc-manuals:hmrc-internal-manuals/money-laundering-regulations-compliance/mlr3cupdate001:1`.
-   **Why asked:** the gap between the rule and the enforcement practice is where most regulatory proposals live.
-   **Shape:** P — what the regulator says · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q29 · G9 — When can HMRC depart from the strict letter of the law?

-   **Key:** `hmrc-manuals:hmrc-internal-manuals/admin-law-manual/adml4100:1` — *Extra-statutory concessions: What an Extra-statutory concession (ESC) is*.
-   **Why asked:** proposals often assume the tax rule is applied as written; ESCs are the standing counter-example.
-   **Shape:** P — what the regulator says · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q30 · G10 — What happens if HMRC gives a taxpayer wrong advice?

-   **Key:** `hmrc-manuals:hmrc-internal-manuals/admin-law-manual/adml1800:1` (*Incorrect Advice to Customers: Unsolicited Advice*) and `…/adml1100:1` (*Incorrect Advice to Customers: Introduction*).
-   **Why asked:** a very common real grievance and a common proposal subject (compensation for official error).
-   **Shape:** P — what the regulator says · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

***

# Q31–Q40 · IMPACT ASSESSMENTS

⚠ Every key is keyed through `parentDocId` → `corpus_acts.title` (finding 2). The section named is the one that carries the answer — `Costs and benefits` for a cost question, `RPC opinion` for a scrutiny question — because an impact assessment is many sections and only some answer any given question.

### Q31 · I1 — What did the government think banning plastic straws would cost?

-   **Key:** `impact-assessments:2020-57:1` and `…:2` — *The Environmental Protection (Plastic Straws, Cotton Buds and Stirrers) (England) Regulations 2020* (`uksi/2020/971`).
-   **Why asked:** the single most-cited example of a small environmental ban; users proposing similar bans are asked "what will it cost" first.
-   **Shape:** N — what was predicted · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q32 · I2 — What did the government predict the building safety levy scheme would do?

-   **Key:** `impact-assessments:2023-77:1`, `…:2` (Preferred option), `…:3` (Costs and benefits) — *The Building Safety (Responsible Actors Scheme and Prohibitions) Regulations 2023* (`uksi/2023/753`).
-   **Why asked:** post-Grenfell remediation funding is a live proposal area.
-   **Shape:** N — what was predicted · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q33 · I3 — What was the predicted cost of the residual waste reduction target?

-   **Key:** `impact-assessments:2023-14:1` and `…:3` — *The Environmental Targets (Residual Waste) (England) Regulations 2023* (`uksi/2023/92`).
-   **Why asked:** waste-reduction proposals need the government's own arithmetic on the existing target before proposing a tighter one.
-   **Shape:** N — what was predicted · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q34 · I4 — Did the Regulatory Policy Committee approve the tobacco products fees regulations?

-   **Key:** `impact-assessments:2017-78:2` (RPC opinion) — *The Tobacco Products and Herbal Products for Smoking (Fees) Regulations 2017* (`uksi/2017/409`).
-   **Why asked:** the RPC opinion is the nearest thing to independent scrutiny of a costing, and almost nobody knows it exists.
-   **Shape:** N — what was predicted · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q35 · I5 — What did the government say the tobacco fee changes would cost business?

-   **Key:** `impact-assessments:2017-78:3` (Costs and benefits) — `uksi/2017/409`.
-   **Why asked:** a fee-raising proposal is the commonest form of self-funding regulation, and this is the worked precedent.
-   **Shape:** N — what was predicted · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q36 · I6 — What was the impact assessment for the environmental permitting changes?

-   **Key:** `impact-assessments:2018-21:1`, `…:2`, `…:3` — *The Environmental Permitting (England and Wales) (Amendment) Regulations 2018* (`uksi/2018/110`).
-   **Why asked:** environmental permitting is the mechanism behind most pollution proposals, including sewage.
-   **Shape:** N — what was predicted · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q37 · I7 — What did the government expect from the data adequacy decision for South Korea?

-   **Key:** `impact-assessments:2022-92:1` and `…:2` — *The Data Protection (Adequacy) (Republic of Korea) Regulations 2022* (`uksi/2022/1213`).
-   **Why asked:** international data transfers are a standing business complaint; adequacy is the mechanism.
-   **Shape:** N — what was predicted · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q38 · I8 — What was the justification for raising the Public Guardian's fees?

-   **Key:** `impact-assessments:2017-92:4` (Problem under consideration) and `…:3` (Costs and benefits) — *The Public Guardian (Fees, etc.) (Amendment) Regulations 2017* (`uksi/2017/503`).
-   **Why asked:** lasting-power-of-attorney costs are a real household grievance.
-   **Shape:** N — what was predicted · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q39 · I9 — What options did the government consider before setting the Public Guardian fee?

-   **Key:** `impact-assessments:2017-92:6` (Options considered) and `…:7` (Preferred option) — `uksi/2017/503`.
-   **Why asked:** "what else did you consider" is the first question a committee asks; the options section is where the answer lives and is almost never cited.
-   **Shape:** N — what was predicted · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q40 · I10 — Has anyone assessed whether the plastic straw ban actually worked?

-   **Key:** ⚠ **NO KEY — DELIBERATELY.** The corpus holds the impact assessment (Q31) and, on the evidence of the S7 PIR work, no post-implementation review for this instrument.
-   **Why asked:** it is the single most important question about any past measure, and the honest answer is usually "nobody has checked".
-   **Shape:** N — what was predicted (negative control) · **Sourced:** outside-in
-   **VERDICT →** ⚠ This question exists to test that the platform says *nobody has checked* rather than substituting the prediction. A "correct" answer here is an admission. ACCEPT

***

# Q41–Q50 · CONSULTATIONS

### Q41 · N1 — What did the government consult on about reducing sewage discharges?

-   **Key:** `consultations:government_consultations_storm-overflows-reducing-sewage-discharges:1` (12 May 2022) and `…_storm-overflows-discharge-reduction-plan:1` (24 Jul 2023).
-   **Why asked:** the user wants to know what was actually asked and what came back, before proposing something the consultation already rejected.
-   **Shape:** O — what was asked · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q42 · N2 — Was there a consultation on the smoking age ban?

-   **Key:** `consultations:government_consultations_creating-a-smokefree-generation-and-tackling-youth-vaping:1` (6 Dec 2023).
-   **Why asked:** the generational smoking ban is the highest-profile public health measure of the period, and vaping proposals are extremely common from the public.
-   **Shape:** O — what was asked · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q43 · N3 — What did the government propose to change about building safety regulation?

-   **Key:** `consultations:government_consultations_building-a-safer-future-proposals-for-reform-of-the-building-safety-regulatory-system:1` (31 Jul 2019).
-   **Why asked:** the consultation that produced the Building Safety Act; the reasoning is in the consultation, not the Act.
-   **Shape:** O — what was asked · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q44 · N4 — Has the government consulted on gambling sponsorship?

-   **Key:** `consultations:government_consultations_consultation-on-banning-unlicensed-gambling-sponsorship:1`.
-   **Why asked:** gambling advertising is one of the most frequent public proposal subjects.
-   **Shape:** O — what was asked · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q45 · N5 — What has the government asked about AI and copyright?

-   **Key:** `consultations:government_consultations_artificial-intelligence-and-ip-copyright-and-patents:1` (7 Jan 2022) and `…_artificial-intelligence-and-intellectual-property-call-for-views:1` (30 Nov 2020).
-   **Why asked:** the most contested technology-policy question in the UK right now.
-   **Shape:** O — what was asked · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q46 · N6 — What was consulted on for leasehold reform?

-   **Key:** `consultations:government_consultations_implementing-reforms-to-the-leasehold-system:1` (26 Nov 2018).
-   **Why asked:** pairs with Q5 — the user wants both the parliamentary pressure and the government's own question.
-   **Shape:** O — what was asked · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q47 · N7 — Is there guidance being consulted on for storm overflows?

-   **Key:** `consultations:government_consultations_draft-information-and-guidance-on-storm-overflows:1` (24 Jan 2025).
-   **Why asked:** distinguishes a live consultation from a closed one — a distinction the platform must get right or it will tell a user to respond to something that closed in 2022.
-   **Shape:** O — what was asked · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q48 · N8 — What did the government consult on for net zero aviation?

-   **Key:** `consultations:government_consultations_achieving-net-zero-aviation-by-2050:1` — *Jet Zero: our strategy for net zero aviation* (8 Sep 2021).
-   **Why asked:** aviation is the standard hard case in any net-zero proposal.
-   **Shape:** O — what was asked · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q49 · N9 — Was there a consultation about electrical safety in building regulations?

-   **Key:** `consultations:government_consultations_building-regulations-electrical-safety:1` (27 Apr 2012).
-   **Why asked:** a deliberately OLD consultation — tests whether the platform surfaces historic material or silently favours the recent.
-   **Shape:** O — what was asked · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q50 · N10 — What did respondents say about the renters' reform proposals?

-   **Key:** ⚠ **NO KEY.** A title search for "renters" across `consultations` returns nothing. Either the corpus does not hold it or it is titled differently.
-   **Why asked:** section 21 abolition is among the most common housing proposals from members of the public.
-   **Shape:** O — what was asked (gap probe) · **Sourced:** outside-in
-   **VERDICT →** ⚠ Kept deliberately. A question the corpus cannot answer is a finding about the corpus, and the platform's required behaviour is to say so specifically rather than to answer from general knowledge (SEARCH_CONTRACT §6). ACCEPT

***

# Q51–Q60 · STATISTICS — ⚠⚠ **UNVALIDATED**

**New in S9 (**`BRIEF_SEARCH_S9.md` **§5), and marked UNVALIDATED for the same reason as everything above: CC-Search wrote them.** ⚠ **Nothing has been scored against them and nothing should be.** S9 §5 is explicit that there is no gold set for statistics and that one cannot be borrowed — so every number reported for this stream in `SEARCH_S9_REPORT.md` is *behavioural* (did the router choose it?) and **none of it is a recall figure.**

**⚠ THE SHAPE IS DIFFERENT, AND THAT IS THE DESIGN.** Every question here is shape **R — does a measurement exist**. The correct answer is a *series descriptor* — "yes, HMRC publishes monthly spirits duty receipts in £m from 2005-06" — and **never a number.** Search establishes that a series exists; a separate exact call fetches the figure (S9 §2). **If any of these reads to you as though it is asking for a value, that is worth a REJECT** — the question is wrong for this stream, however reasonable it sounds.

**Every key was read back from the live store on 19 Aug 2026** (10 datasets, 5,733 series, 80,443 observations). `k=` is the first 12 characters of the series' stable `seriesKey` (sha-256).

### Q51 — Does anyone publish how much the UK government spends on health compared to other things?

-   **Key:** `pesa-ch5-function` · `public_expenditure_by_function` · COFOG `07` · GBP_MILLION · 2020-21…2024-25, e.g. *Medical services — 07* (`k=00b9ceee9faf`), *Medical research — 07* (`k=c50836d2a796`). The measure covers **60 COFOG codes across 62 series**.
-   **Why asked:** "what do we actually spend it on" is the first question of almost every spending proposal, and the COFOG breakdown is the only answer comparable year to year.
-   **Shape:** R — does a measurement exist · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q52 — Is there a figure for how much tax goes uncollected each year?

-   **Key:** `hmrc-tax-gap` · 30 series, PERCENT, e.g. *Corporation Tax — Small businesses* (`tax_gap_pct_small_businesses`), *Excise duty — Alcohol duty — Beer duty* (`tax_gap_pct_beer_duty`).
-   **Why asked:** the tax gap is the standing justification for every compliance proposal, and users cite a headline figure without knowing it is broken down by tax and behaviour.
-   **Shape:** R — does a measurement exist · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q53 — Do we have numbers on how UK health spending compares with other countries?

-   **Key:** `wb-wdi-comparative` · `health_expenditure_pct_gdp` and `health_expenditure_per_capita` · **22 series each, one per geography** · 2000…2024.
-   **Why asked:** international comparison is the commonest rhetorical move in a health proposal, and the commonest place a wrong number gets quoted.
-   **Shape:** R — does a measurement exist · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q54 — Is there an official series for the unemployment rate?

-   **Key:** `ons-cdid-headline` · *Unemployment rate (aged 16 and over, seasonally adjusted): %* · `unemployment_rate` · PERCENT · 1971…2026 Q1 · `k=4ff24328fac3`.
-   **Why asked:** the single most-quoted UK statistic. A control: the stream must not miss it.
-   **Shape:** R — does a measurement exist · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q55 — Has anyone measured whether people in the UK are actually happier?

-   **Key:** `ons-beta-wellbeing-quarterly` · 40 series · e.g. *United Kingdom / Life satisfaction / Average (mean) / Seasonally adjusted* (SCORE_0_10, `k=79e90020ca0e`) · 2011 Q2…2023 Q2.
-   **Why asked:** wellbeing is invoked constantly as a policy goal, and users rarely know it is measured quarterly on a published scale.
-   **Shape:** R — does a measurement exist · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q56 — What does the OBR forecast for government borrowing?

-   **Key:** `obr-historical-forecasts` · `psnb` (PERCENT_GDP, 96 series) and `_psnb` (GBP_BILLION, 107 series), one per forecast round via `forecastVintage`, e.g. *PSNB (April 1978)*; plus `obr-psf-databank` · `public_sector_net_borrowing`.
-   **Why asked:** every spending proposal meets "how will you pay for it"; the borrowing forecast is the frame that argument happens inside.
-   **Shape:** R — does a measurement exist · **Sourced:** outside-in
-   **VERDICT →** ⚠ Expected to be **hard**, deliberately: the OBR series are labelled with the OBR's own column codes (`PSNB`, `NICS`, `PCDebtint`) rather than words. See the discoverability finding in `SEARCH_S9_REPORT.md` §A4. ACCEPT

### Q57 — Is there data on how much different government departments spend?

-   **Key:** `pesa-ch5-function` · `dept_expenditure_by_function` · 103 series · GBP_MILLION · **2024-25 only (a single period)**, e.g. *Local Government — 07* (`k=b9c5788195c9`), *Scottish Government — 07*.
-   **Why asked:** "which department's budget would this come out of" is a practical question for anyone drafting a proposal with a cost.
-   **Shape:** R — does a measurement exist · **Sourced:** outside-in
-   **VERDICT →** ⚠ Tests a **derived heading**: the department is inside the label and the function is a bare COFOG *number*, which the catalogue index resolves to its name (§A4). ACCEPT

### Q58 — Are there figures for how much alcohol duty raises?

-   **Key:** `hmrc-receipts` · GBP_MILLION · `beer_duties` (`k=9deec8b2c2e1`), `cider_duties` (`k=0b5b462452b0`), `spirits_duties` (`k=4d6d72ea8107`), `wines_duties` (`k=8d7efa6bde65`) · 2005-06…2025-26, monthly.
-   **Why asked:** minimum pricing and duty proposals are common from the public, and receipts are the first thing a Treasury objection cites.
-   **Shape:** R — does a measurement exist · **Sourced:** document-outward
-   **VERDICT →** **ACCEPT**

### Q59 — Does anyone track income inequality in the UK over time?

-   **Key:** `wb-wdi-comparative` · *United Kingdom — Gini index* · `gini_index` · INDEX · 1963…2024 · `k=b313325e32b3`, among 22 geographies.
-   **Why asked:** inequality is the stated motivation behind a large share of public proposals, and the Gini is the series people mean without naming it.
-   **Shape:** R — does a measurement exist · **Sourced:** outside-in
-   **VERDICT →** **ACCEPT**

### Q60 — How many people are on an NHS waiting list?

-   **Key:** ⚠ **NO KEY — DELIBERATE NEGATIVE CONTROL.** Measured, not assumed: a search of every series label and measure in the store for `nhs`, `waiting` or `hospital` returns **0 rows**. The Phase A spine is fiscal and macroeconomic (ONS, OBR, HMRC, PESA) plus a comparative layer (World Bank, IMF). There is health *spending*; there is no health *activity*.
-   **Why asked:** it is among the most likely real questions a user will ask of a statistics feature, and the required behaviour is to say *we do not hold that* — naming what IS held — rather than reaching for health spending as though it answered a waiting-list question.
-   **Shape:** R — does a measurement exist (negative control) · **Sourced:** outside-in
-   **VERDICT →** ⚠ A "helpful" answer here is a failure. Pairs with Q40 and Q50. ACCEPT

***

## What this set does NOT cover, named

-   **The** `explanatory` **stream (S8 §4's third candidate) has no questions here.** It was not in S8 §5's list of five collections. If `LEX_ROUTER_STREAMS_V2` is to be scored, explanatory material needs its own ten and does not have them.
-   `ico`**,** `fca-handbook`**,** `sentencing-council`**,** `planning-policy` — four guidance collections with no topically-searchable titles, so no question here can key on them. They are as unevaluable as committees was before this file.
-   **48% of impact assessments** whose `parentDocId` does not resolve to a named instrument.
-   **Case-law subjects are now RESOLVED but four keys are WRONG** — see the table under Q11–Q20. Six of the ten survive; the four that do not cannot be re-keyed from here, because nothing makes case law subject-searchable (finding 1).
-   **⚠ Statistics has no validated question at all** until Q51–Q60 come back from review. Every statistics number in `SEARCH_S9_REPORT.md` is behavioural, and none of it is recall.
-   **Nothing here scores the values path.** These questions establish that a series is discoverable. Whether the number returned by the exact call is right is a different instrument, and it does not exist.
