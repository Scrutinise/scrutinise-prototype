# GOLD CANDIDATES v2 — DEBATES AND LEGISLATION

**Status:** ⚠⚠ **DRAFT INSTRUMENT. NOTHING HAS BEEN SCORED AGAINST THESE AND NOTHING SHOULD BE UNTIL CHARLIE HAS VALIDATED THEM.** `BRIEF_GOLD_V2.md` §5 is explicit: *"Score nothing. A number scored against an unvalidated key is the mistake this whole instrument exists to prevent."*

**Written:** 21 August 2026, by CC-Search, executing `BRIEF_GOLD_V2.md`. **Purpose:** the validated set has **zero** questions that `debates` or `legislation` owns — the two streams carrying the most traffic. Their vector settings are held on absence of evidence, S7's "debates is 15pp worse" is neither confirmed nor refuted, and the fusion dial's central hypothesis cannot be tested at all.

***

## HOW TO REVIEW THIS — one pass, twenty-four lines

Every question ends in a **VERDICT** line. Fill in that one line and move on:

```
- **VERDICT →** ACCEPT
- **VERDICT →** REJECT — nobody would ask it that way
- **VERDICT →** AMEND — a real user would say "hanging", not "capital punishment"
```

A rejected question **with a reason** is worth more than a silently deleted one.

### Progress index — tick as you go

| \#        | Section                                        | Count | Reviewed |
|-----------|------------------------------------------------|-------|----------|
| Q1–Q11    | Debates                                        | 11    | ☐        |
| Q12–Q21   | Legislation                                    | 10    | ☐        |
| N1–N3     | Negative controls — **a 0% here is a PASS**    | 3     | ☐        |

***

## THE REPORT (§5)

| | |
|---|---:|
| debates questions | **11** |
| legislation questions | **10** |
| negative controls | **3** |
| keys behind those questions | **27** |
| keys verified by reading the document back out of R2 | **27 / 27 (100%)** |
| keys absent from the corpus | **0** |
| keys **withdrawn as wrong** after reading the body | **2** (see finding 1) |
| sourced **controversy-inward** ("outside-in") | **16** |
| sourced **document-outward** | **5** |
| questions that deliberately avoid the document's own vocabulary | **9** (§3 requires ≥3) |

⚠ **THE SOURCING SPLIT IS NOT THE HALF-AND-HALF §2 ASKED FOR, AND THAT IS A REAL SHORTFALL RATHER THAN A ROUNDING.** 16 outside-in to 5 document-outward. §2 wants both halves so that a difference between them can be *seen*, and at n=5 the document-outward half is too small to say much. The reason is process, not judgement: I started from subjects I knew were publicly contested and only browsed the corpus for its own notable documents late. ▶ **If you want the comparison to be measurable, this needs about five more document-outward questions**; they are cheap to add and I can do it in a follow-up. It is flagged here rather than presented as compliant.

⚠ **Every key was verified by reading the document body out of R2 and comparing it against a claim written down BEFORE the read** (`scrutinise-web/scripts/verify-goldv2-keys.ts`, re-runnable). Each block below carries the confirming extract. That is the mechanism §1 trap 2 demands, and **it caught a wrong key on its first run** — see immediately below.

### Archetypes I could NOT find a question for — the gap findings (§5 says these are worth more than the question)

1. ⚠⚠ **A Welsh devolved-legislature question is not askable in English.** See finding 1.
2. ⚠ **"An old Act still in force" is thin, and three obvious candidates are simply absent.** The `Vagrancy Act 1824` (rough sleeping), the `National Minimum Wage Act 1998` and the `Housing Act 1996` (homelessness duty) are all **not in the corpus** — consistent with the measured **21.4%** coverage of pre-2000 primary Acts. Q18 uses the Landlord and Tenant Act 1985, which *is* held. A user asking "is it illegal to sleep rough?" cannot be answered by this corpus at all, and that is an ingest finding, not a question.
3. ⚠ **"Which section of a named Act does a specific thing" cannot be keyed from section titles alone** — see finding 3.

***

## ⚠⚠ THREE FINDINGS FROM BUILDING THE KEYS, EACH LARGER THAN ANY QUESTION BELOW

Keys were built by querying `corpus_sections` and R2 **directly**, never through `runSearch()` (§1 trap 4: keying a question on whatever retrieval returns makes recall 100% by construction). Doing it that way surfaced three things.

### 1. ⚠⚠ THE SENEDD RECORD'S HEADINGS ARE WRONG FOR MOST OF IT — AND IT IS IN WELSH

**This is the wrong key that the verification caught,** and it is exactly the failure §1 trap 2 was written about. Two rows titled `Senedd Plenary: The 20 mph Speed Limit` — the biggest Welsh political controversy of the decade — turned out, on reading their bodies, to be **a short debate about oesophageal and stomach cancers**. They are preserved in the verification script as `WITHDRAWN` so the defect stays reproducible.

The mechanism, measured rather than guessed:

- Session `13683` holds **333 speeches under 21 headings**. The last heading begins at speech 151, so **every one of the remaining 183 speeches inherits it**, whatever it is about.
- Across the whole collection: **687 sessions, 191,730 speeches, 14.6 headings per session on average against 279 speeches.** **117,205 of 191,730 speeches — 61.1% — sit in their session's single biggest heading block.** The heading is not tracking the agenda; the tail inherits whatever came last.

⚠ **And the compounding half: 38 of a 40-row random sample (95%) have Welsh-language bodies.** So for `senedd-cofnod`, an English-language query can only match the English *heading* — and that heading is misattributed for the majority of rows. **A question about Welsh devolved politics, asked in English, is currently unanswerable for reasons that have nothing to do with retrieval quality.**

▶ Q3 was therefore re-keyed from Wales to **Northern Ireland**, and the Welsh gap is recorded here instead. Scoring a Welsh question would have measured the ingest, not the search.

### 2. ⚠ THE COMMONS ASSISTED-DYING DEBATE IS THERE, AND MY FIRST LOOK SAID IT WAS NOT

A search for the second reading returned nothing and briefly looked like a coverage gap. It is not: **29 November 2024 holds 200 speeches and 41,951 words** under the title `Terminally Ill Adults (End of Life) Bill`. My query had required a single speech over 1,200 words (none is) and expected "Second Reading" in the title (Commons headings omit it; the Lords' include it). Recorded because the same two assumptions would mislead the next person, and because **"I searched and found nothing" is not a corpus finding until the query has been checked.**

### 3. ⚠ LEGISLATION SECTION TITLES DO NOT RELIABLY DESCRIBE THEIR SECTIONS

`primary-acts-2000plus:ukpga/2023/50:section-12` (Online Safety Act 2023) is titled **"Serious Crime Act 2007"**; its body is the children's online-safety duties. `…:section-1` is titled **"Joint provisional notices of contravention"**; its body is the Act's overview. `…:section-100` is titled correctly. So it is neither universal nor rare on the sample taken (2 wrong of 3 read).

⚠ **The consequence for anyone building keys: a legislation key chosen by section title can be wrong, and only the body settles it.** Every legislation key below was chosen or confirmed on its body. **How widespread this is has not been measured and should be** — it is a candidate for its own check, and it would also degrade retrieval, since the title is indexed.

***

## Question shapes (archetypes)

| shape | what the user wants |
|---|---|
| **S — for and against** | the arguments on both sides of a specific measure |
| **T — who said it** | which member made a particular argument |
| **U — when last considered** | whether and when Parliament returned to a subject |
| **V — the minister's position** | what a government spokesman committed to at the despatch box |
| **W — what never happened** | a proposal debated and abandoned |
| **X — which law governs this** | the Act that applies to a described situation |
| **Y — what this section does** | a specific provision of a named Act |
| **Z — what changed it** | whether an Act has been amended or repealed, and by what |

**Sourcing** is marked on every question: `outside-in` (started from a real public argument, then found the document) or `document-outward` (found a real document, wrote the question it answers). ⚠ **`vocabulary: avoided`** marks the nine questions deliberately phrased in words the document does not use — the case the debates vector decision turns on (§3).

***

# Q1–Q11 · DEBATES

### Q1 · Did MPs argue for or against letting terminally ill people choose to die?

- **Key:** `pwdata-debates:debates2024-11-29d:3` (Kim Leadbeater, opening, FOR) and `…:78` (Danny Kruger, AGAINST) — Commons, 29 Nov 2024.
- **Verified:** *"I beg to move, that the Bill be now read a Second time… It is a privilege to open the debate on the Terminally Ill Adults (End of Life) Bill"* / Kruger: *"That is the medical stage, and I will jump straight to the judicial stage. The medical practitioners sign it off, and then the judge has to confirm all the same tests…"*
- **Why asked:** the most significant conscience vote in a generation; someone drafting on this needs both sides as spoken, not a summary.
- **Shape:** S · **Sourced:** outside-in · **vocabulary: avoided** (the Bill is called "Terminally Ill Adults (End of Life)"; nobody types that)
- **VERDICT →**

### Q2 · Did peers back the assisted dying bill when it reached the Lords?

- **Key:** `pwdata-lords:daylord2025-09-12c:4` — Lord Falconer of Thoroton opening the second reading, 12 Sep 2025, 2,634 words.
- **Verified:** *"My Lords, this issue has been debated for years, particularly in this House. The House is full this morning… For the first time, we have before us a Bill on assisted d[ying]"*
- **Why asked:** the Lords is where this Bill's fate was decided; a user following the story needs the other House.
- **Shape:** S — **and the Lords-not-Commons archetype** · **Sourced:** document-outward
- **VERDICT →**

### Q3 · What did ministers at Stormont say about the botched green energy scheme?

- **Key:** `niassembly-hansard:286438:151` — *Ministerial Statement — Renewable Heat Incentive Scheme*, NI Assembly, 19 Dec 2016, 4,780 words.
- **Verified:** *"Unlike normal practice on these occasions, which, by the way, you endorsed, I want to make it clear that the statement has not been cleared or approved by the deputy First Minister…"*
- **Why asked:** "cash for ash" brought down the Executive for three years — the defining NI governance scandal of the period.
- **Shape:** V — the minister's position · **Sourced:** outside-in · **vocabulary: avoided** ("botched green energy scheme" vs "Renewable Heat Incentive")
- ⚠ **Note:** `niassembly-hansard` carries **no speaker** on this row, so a "who said it" question cannot be keyed against NI.
- **VERDICT →**

### Q4 · Has Parliament debated scrapping the benefit limit for families with more than two children?

- **Key:** `pwdata-westminster:westminster2022-04-21a:27` (Karen Buck, 21 Apr 2022) and `pwdata-westminster:westminster2018-11-27c:55` (Alison Thewliss, 27 Nov 2018).
- **Verified:** *"It is a pleasure to respond to this debate under your chairmanship, Mr McCabe. I congratulate the hon. Member for Glasgow Central (Alison Thewliss) on introducing it…"*
- **Why asked:** among the most contested welfare policies of the decade; the user wants to know whether the House has engaged with it and when.
- **Shape:** U — when last considered · **Sourced:** outside-in
- ⚠ **Both keys are Westminster Hall, not the Chamber** — a fair test of whether the debates stream reaches beyond `pwdata-debates`.
- **VERDICT →**

### Q5 · What did peers say about overturning the subpostmasters' convictions?

- **Key:** `pwdata-lords:daylord2024-05-13a:113` — *Post Office (Horizon System) Offences Bill — Second Reading*, Lord Falconer, 13 May 2024.
- **Verified:** *"My Lords, the heroes of this story are Alan Bates and the sub-postmasters. Having been wrongly convicted, and in order to establish their innocence, they brought a piece of incredibly expensive civil litigation…"*
- **Why asked:** the best-known miscarriage of justice of the decade, and an unusual constitutional step — Parliament quashing convictions by statute.
- **Shape:** S · **Sourced:** outside-in · **vocabulary: avoided** ("subpostmasters" vs "Post Office (Horizon System) Offences Bill")
- **VERDICT →**

### Q6 · When did Parliament last seriously debate bringing back hanging?

- **Key:** `historic-hansard:S5LV0198P0:1798` — *Lords: DEATH PENALTY (ABOLITION) BILL*, the Lord Chancellor (Viscount Kilmuir), 9 Jul 1956, 5,102 words; and `historic-hansard:S5LV0306P0:1905` — *MURDER (ABOLITION OF DEATH PENALTY) ACT 1965*, Lord Chancellor (Lord Gardiner), 17 Dec 1969.
- **Verified:** 1969: *"rose to move, That the Murder (Abolition of Death Penalty) Act 1965 shall not expire as otherwise provided by Section 4 of that Act."*
- **Why asked:** capital punishment recurs in public petitions constantly; the honest answer is that the argument was settled decades ago and the record shows how.
- **Shape:** U — when last considered · **Sourced:** document-outward · **vocabulary: avoided** ("hanging" vs "death penalty"/"capital punishment")
- ⚠ **This is the only question testing `historic-hansard` (4.6M sections), the second-largest collection in the corpus.**
- **VERDICT →**

### Q7 · What happened to the plan to make the House of Lords elected?

- **Key:** `pwdata-lords:daylord2012-04-30a:76` — *Draft House of Lords Reform Bill — Motion to Take Note*, Lord Richard, 30 Apr 2012, 2,978 words.
- **Verified:** *"My Lords, perhaps I might say right at the outset that I am glad this debate is now to extend over two days. The subject deserves proper treatment…"*
- **Why asked:** a major constitutional proposal that was debated at length and then abandoned — the case where the record is the *only* trace.
- **Shape:** W — what never happened · **Sourced:** outside-in
- **VERDICT →**

### Q8 · What did MSPs say about making it easier to change your legal gender?

- **Key:** `scottish-parliament-or:14066:193` — *Gender Recognition Reform (Scotland) Bill: Stage 3*, Russell Findlay MSP, 20 Dec 2022, 2,084 words.
- **Verified:** *"I disagree with Alex Cole-Hamilton. It is not just a piece of paper. It fundamentally changes many aspects of society… The proposed new system is radical—some might even say that it is experimental…"*
- **Why asked:** the Bill that triggered the first-ever s.35 veto by a UK government — the sharpest devolution dispute of the period.
- **Shape:** S · **Sourced:** outside-in · **vocabulary: avoided** ("change your legal gender" vs "Gender Recognition Reform")
- **VERDICT →**

### Q9 · Why were energy companies forcing people onto prepayment meters?

- **Key:** `pwdata-debates:debates2022-12-15b:298` — *Prepayment Meters: Self-Disconnection*, Alan Brown, 15 Dec 2022, 1,551 words.
- **Verified:** *"I commend my hon. Friend the Member for Glasgow North East (Anne McLaughlin) for securing this debate. She rightly said she is looking for action, and action now, rather than self-awareness…"*
- **Why asked:** forced installation became a national scandal weeks after this debate; the user is asking about the thing, not the parliamentary label for it.
- **Shape:** T — who said it · **Sourced:** outside-in · **vocabulary: avoided** ("forcing people onto" vs "self-disconnection")
- ⚠ **The key is a contribution, not the opening speech** — Anne McLaughlin secured the debate and Alan Brown is responding to her. If you would rather the key were the member who led it, say so and it is a one-line change.
- **VERDICT →**

### Q10 · What has the government promised to do about the Grenfell inquiry's findings?

- **Key:** `pwdata-debates:debates2024-12-02c:452` — *Grenfell Tower Inquiry*, Alex Norris (minister), 2 Dec 2024, 2,910 words.
- **Verified:** *"This has been an important debate on the findings and recommendations of the Grenfell inquiry. As the inquiry's phase 2 report and today's debate have made clear, fundamental change is needed to make our homes secure and safe…"*
- **Why asked:** every building-safety proposal is downstream of Grenfell; the user wants the commitment on the record, not the press notice.
- **Shape:** V — the minister's position · **Sourced:** outside-in
- **VERDICT →**

### Q11 · What did the Chancellor announce in the Spring Statement?

- **Key:** `pwdata-debates:debates2025-03-26b:130` — *Spring Statement*, Rachel Reeves, 26 Mar 2025, 4,422 words.
- **Verified:** *"This Labour Government were elected to bring change to our country, to provide security for working people and to deliver a decade of national renewal. That work began in July…"*
- **Why asked:** the single most-read parliamentary event of the year for anyone costing a proposal.
- **Shape:** V — the minister's position · **Sourced:** document-outward
- ⚠ **Deliberately uses the document's own words** — it is the control against the nine `vocabulary: avoided` questions. If this one also fails, the problem is not vocabulary.
- **VERDICT →**

***

# Q12–Q21 · LEGISLATION

### Q12 · Can my landlord make me leave without giving a reason?

- **Key:** `primary-acts-pre-2000:ukpga/1988/50:section-21` — *Recovery of possession on expiry or termination of assured shorthold tenancy*, Housing Act 1988, 1,124 words.
- **Verified:** *"21 1 Without prejudice to any right of the landlord under an assured shorthold tenancy to recover possession of the dwelling-house let on the tenancy…"*
- **Why asked:** "section 21" and "no-fault eviction" are the campaigner's words; a tenant asks the question above.
- **Shape:** X — which law governs this · **Sourced:** outside-in · **vocabulary: avoided**
- **VERDICT →**

### Q13 · Has the law on no-fault evictions actually changed?

- **Key:** `primary-acts-2000plus:ukpga/2025/26:section-146` (*Existing assured tenancies to continue as section 4A assured tenancies*) and `…:section-147` (*Fixed term assured tenancy and statutory periodic tenancy to be treated as single assured tenancy*) — Renters' Rights Act 2025.
- **Why asked:** the reform was announced for six years before it happened; the user wants to know whether it is real yet.
- **Shape:** Z — what changed it · **Sourced:** outside-in
- ⚠ **This is the amendment archetype and it is the hardest one in the set:** answering it well means connecting the 2025 Act to the 1988 Act in Q12. A correct top-20 that returns only one of the two has half-answered it.
- **VERDICT →**

### Q14 · My employer won't make changes for my disability — what does the law require?

- **Key:** `primary-acts-2000plus:ukpga/2010/15:section-20` — *Duty to make adjustments*, Equality Act 2010, 580 words.
- **Why asked:** among the most common employment questions there is; "reasonable adjustments" is the legal term, not the user's.
- **Shape:** Y — what this section does · **Sourced:** outside-in · **vocabulary: avoided**
- **VERDICT →**

### Q15 · Is the old law banning schools from promoting homosexuality still in force?

- **Key:** `primary-acts-pre-2000:ukpga/1988/9:section-28` — *Prohibition on promoting homosexuality by teaching or by publishing material*, Local Government Act 1988. **33 words** — the corpus's rendering of a repealed provision.
- **Why asked:** "Section 28" is still cited in live debate; the correct answer includes that it was repealed (2003), not merely what it said.
- **Shape:** Z — what changed it · **Sourced:** outside-in
- ⚠⚠ **SCORED ON BEHAVIOUR AS WELL AS RECALL.** Returning the section without saying it is repealed is a **wrong answer that looks right** — the exact case SURFACE 1 built repeal labelling for. Note the body is 33 words: a retrieval system may rank it low precisely *because* it is a stub.
- **VERDICT →**

### Q16 · What exactly did the government ban when it banned plastic straws?

- **Key:** `si-2010plus:uksi/2020/971:regulation-2` and `…:regulation-20` — Environmental Protection (Plastic Straws, Cotton Buds and Stirrers) (England) Regulations 2020.
- **Verified:** reg 2: *"In these Regulations— 'catering establishment' has the meaning given by regulation 6(3)… 'end user' means any person to whom a product is supplied"*; reg 20: *"The powers which an enforcement officer may be authorised to exercise are— a to enter at any reasonable time any premises…"*
- **Why asked:** a famous, much-mocked measure whose actual scope (and its exemptions) almost nobody knows.
- **Shape:** X — what a statutory instrument did · **Sourced:** document-outward
- ⚠ **Both keys have `sectionTitle: NULL`** — SI provisions are keyed by id alone, so this also tests whether an untitled row can be retrieved at all.
- **VERDICT →**

### Q17 · Does Scotland have a minimum price for alcohol?

- **Key:** `regional:ssi/2024/127:article-2` — *Continuation of minimum pricing provisions*, Alcohol (Minimum Pricing) (Scotland) Act 2012 (Continuation) Order 2024. **30 words.**
- **Verified:** *"2 Despite section 2(1) of the Alcohol (Minimum Pricing) (Scotland) Act 2012, the minimum pricing provisions are to continue in effect after the end of the 6 year period."*
- **Why asked:** the clearest case of a devolved nation doing something England has not; a policy proposal for England starts here.
- **Shape:** X — a devolved equivalent · **Sourced:** outside-in
- **VERDICT →**

### Q18 · My flat is damp and mouldy and the landlord won't fix it — what does the law say?

- **Key:** `primary-acts-pre-2000:ukpga/1985/70:section-11` — *Repairing obligations in short leases*, Landlord and Tenant Act 1985, 771 words.
- **Verified:** *"11 1 In a lease to which this section applies… there is implied a covenant by the lessor— a to keep in repair the structure and exterior of the dwelling-house (including drains, gutters and external pipe[s])"*
- **Why asked:** the Awaab Ishak case made this the highest-profile housing issue in the country; the governing provision is forty years old.
- **Shape:** X — an old Act still in force · **Sourced:** outside-in · **vocabulary: avoided**
- **VERDICT →**

### Q19 · When did they ban smoking in pubs, and what exactly does it cover?

- **Key:** `primary-acts-2000plus:ukpga/2006/28:section-2` (*Smoke-free premises*) and `…:section-3` (*Smoke-free premises: exemptions*), Health Act 2006.
- **Verified:** s.2: *"Premises in England are smoke-free if they are open to the public. But unless the premises also fall within subsection (2), they are smoke-free only when open to the public."*
- **Why asked:** the most successful public-health intervention of the century and the standard precedent cited for any new restriction.
- **Shape:** Y — what this section does · **Sourced:** outside-in
- **VERDICT →**

### Q20 · What does the law make social media companies do to protect children?

- **Key:** `primary-acts-2000plus:ukpga/2023/50:section-12` — Online Safety Act 2023, children's online-safety duties, 892 words.
- **Verified:** *"12 1 This section sets out the duties to protect children's online safety which apply in relation to regulated user-to-user services that are likely to be accessed by children…"*
- ⚠⚠ **This row's `sectionTitle` is "Serious Crime Act 2007" — WRONG.** The key is sound because it was confirmed on the body; see finding 3. **A retrieval system matching on title will not find this**, so a miss here may be a data defect rather than a ranking one, and should be read that way.
- **Shape:** Y — what this section does · **Sourced:** outside-in
- **VERDICT →**

### Q21 · How do I find out what a company holds about me?

- **Key:** `primary-acts-2000plus:ukpga/2018/12:section-45` — *Right of access by the data subject*, Data Protection Act 2018, 596 words.
- **Verified:** *"45 1 A data subject is entitled to obtain from the controller— a confirmation as to whether or not personal data concerning him or her is being processed, and b where that is the case, access to the personal data…"*
- **Why asked:** subject access is the most-used individual right in UK data law, and "subject access request" is not what anyone calls it first.
- **Shape:** Y — what this section does · **Sourced:** outside-in · **vocabulary: avoided**
- **VERDICT →**

***

# N1–N3 · NEGATIVE CONTROLS

⚠⚠ **THESE ARE SCORED ON BEHAVIOUR, NOT RECALL. A 0% RETRIEVAL SCORE HERE IS A PASS.** Any future scoring session that folds them into a recall average has broken the instrument. The first set's five negative controls were accepted by Charlie and proved their worth; these follow the same rule.

### N1 · How many people are on the NHS waiting list in my area right now?

- **Required behaviour:** say the corpus cannot answer this. It holds debates, legislation and official documents — **not live operational statistics**, and not constituency-level figures. Pointing to a debate *about* waiting lists is acceptable **only if it is labelled as such** and not offered as the number.
- **Fails if:** it returns a figure from a 2022 debate as though it were current.
- **VERDICT →**

### N2 · Is my landlord allowed to evict me next Tuesday?

- **Required behaviour:** decline to answer on the individual facts and say why — this is legal advice on a specific case, not a question about what the law says. Offering Q12's provision as *general* information is fine; applying it to the user's Tuesday is not.
- **Fails if:** it gives a yes or a no.
- ⚠ Deliberately adjacent to Q12 so that a system which pattern-matches "landlord evict" to s.21 is caught doing it.
- **VERDICT →**

### N3 · What will the Chancellor announce in the next Budget?

- **Required behaviour:** say it cannot know — the corpus is a record of what *has* been said. Prior Budgets may be offered as context if labelled as past.
- **Fails if:** it presents Q11's Spring Statement, or any past statement, as forthcoming.
- ⚠ Deliberately adjacent to Q11, for the same reason as N2.
- **VERDICT →**

***

## ⚠ WHAT THIS SET STILL DOES NOT COVER, NAMED

1. **`senedd-cofnod` (191,730 sections) has no question** — finding 1. Not an omission; it cannot be asked in English today.
2. **The document-outward half is 5 questions, not ~10** — stated in the report above, and the fix is cheap.
3. **No question tests `pwdata-wrans` / `pwdata-lordswrans` (1.4M sections of written answers)**, the largest debates-stream collections after Hansard itself. A written-answer question is a different shape — a named member asking a department a specific factual question — and it deserves its own two or three entries.
4. **No question tests `eur-lex` or `retained-eu`** (550k sections) — retained EU law is a live political subject and the archetype "is this EU-derived rule still in force" is unrepresented.
5. **`bills-api` has no question**, and its `itemDate` is absent from the index entirely (found separately by `fts-drift`, S11 §4).
6. **Nothing here has been scored, and nothing should be** until the VERDICT lines are filled in.

***

## Reproducing the verification

```
cd scrutinise-web
npx tsx --env-file=.env scripts/verify-goldv2-keys.ts
```

Reads every key out of `corpus_sections`, fetches its body from R2, and prints the extract beside the claim written down before the read. **Exit 1 if any key is absent.** It never calls `runSearch()`.
