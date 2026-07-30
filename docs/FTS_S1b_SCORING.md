# FTS S1b — scoring report

*Generated 2026-07-29T19:24:39.623Z against the Lance FTS dataset. Expected-sources are CCh's UNVALIDATED draft — these numbers are PROVISIONAL; the top-20 dumps below are the validation artefact.*

## Headline

*Headline = SCOREABLE recall@20 queries only (the v1 specific set, 31 queries). Principle streams G–I (0–2 lesson, rubric not calibrated) and new SPECIFIC queries with TODO expected-sources (B6, J1, K1, K2) are PRESENT but EXCLUDED until their answer-keys land — see the two tables below.*

| scope | recall@20 | MRR | n |
|---|---|---|---|
| overall (scoreable v1 set) | 67.2% | 0.671 | 31 |
| **overall excl. [GRAPH] floor** | **65.4%** | **0.701** | 26 |

## By archetype (scoreable recall streams)

| archetype | stream | recall@20 | MRR | n | note |
|---|---|---|---|---|---|
| A | legislation | 60.0% | 0.800 | 5 | [INFORCE] aspects are floors |
| B | legislation | 33.3% | 0.269 | 6 |  |
| C | legislation + guidance | 60.0% | 0.625 | 5 |  |
| D | citation graph | 76.7% | 0.512 | 5 | ALL [GRAPH] — engine floor |
| E | debates | 90.0% | 0.900 | 5 |  |
| F | bills + debates | 90.0% | 1.000 | 5 | [BILLS] scores for real |

## Principle streams (G–I) — 0–2 lesson · SCAFFOLD, excluded from headline

*Metric is a 0–2 transferable-lesson judgement, not recall@20. The rubric is set by example once a principle-stream result exists (§C.3); the principle-retrieval method is not built. Scored NOT CALIBRATED for now. Top-20 dumps below exist so the rubric can later be calibrated against real output.*

| id | persona | stream | lesson target |
|---|---|---|---|
| G1 | H1 | codes / guidance | Under-resourced-duty patterns drawn from across domains (the transferable lesson, not the topic). |
| G2 | H2 | codes / guidance | Enforcement/compliance patterns from duty-to-report regimes (financial, safeguarding, environmental). |
| G3 | H1 | codes / guidance | Cross-domain implementation of a recurring mechanism. |
| H1 | H1 | investigations / inquiries | Behavioural regularity across inquiries (e.g. Horizon and others) — the pattern, not one case. |
| H2 | H2 | investigations / inquiries | Cross-inquiry IT-failure patterns (not one named project). |
| H3 | H1 | investigations / inquiries | Transferable regulatory-capture patterns. |
| I1 | H1 | parliamentary evaluations | PAC/NAO/post-legislative-scrutiny patterns of effective vs ineffective enforcement law. |
| I2 | H2 | parliamentary evaluations | Cross-domain evaluation of a mechanism (sunset/review clauses). |
| I3 | H1 | parliamentary evaluations | Transferable unintended-consequence patterns. |

## Pending validation (specific, expected-sources TODO) — excluded from headline

*These are scoreable-in-principle recall@20 queries, but their expected-sources are TODO placeholders pending the validated answer-key (§C). Excluded from the headline until filled. B6 is the validated MiFID lay-vocabulary test; J1 is deferred (no foreign corpus).*

| id | archetype | persona | stream | query |
|---|---|---|---|---|
| J1 | J | H1 | web + foreign corpus | How do other countries regulate short-term lets — and what worked? |
| K1 | K | H2 | legislation (section-level) | I want to remove the no-fault eviction route — which exact provision do I amend? |
| K2 | K | H1 | legislation (section-level) | To add a statutory duty of candour for public bodies, where would it slot in? |

## Per-query detail + top-20 eyeball dump

### A1 (A/H1) [INFORCE]
*Query:* Section 21 Housing Act 1988
*stream:* legislation · *kind:* specific · *metric:* recall@20
*recall@20:* 100.0% · *MRR:* 1.000

Expected sources:
- ✓ @1 — HA 1988 s.21 text
- ✓ @3 — HA 1988 prospective abolition (Renters’ Rights Act 2025) [INFORCE]

Top-20 retrieved:
 1. [legislation/primary-acts-pre-2000] score=99.288↑R `primary-acts-pre-2000:ukpga/1988/50:section-21`
    **Recovery of possession on expiry or termination of assured shorthold tenancy.** — 21 1 Without prejudice to any right of the landlord under an assured shorthold tenancy to recover possession of the dwelling-house let on the tenancy in accorda
 2. [legislation/primary-acts-2000plus] score=98.288↑T `primary-acts-2000plus:ukpga/2004/34:section-215C`
    **Sections 215A and 215B: transitional provisions** — 215C 1 Sections 215A and 215B are treated as having had effect since 6 April 2007, subject to the following provisions of this section. 2 Sections 215A and 215B
 3. [legislation/primary-acts-2000plus] score=95.279↑T `primary-acts-2000plus:ukpga/2025/26:section-134`
    **Use by local housing authority of certain information** — 134 1 Section 212A of the Housing Act 2004 (tenancy deposit schemes: provision of information to local authorities) is amended in accordance with subsections (2
 4. [legislation/primary-acts-2000plus] score=94.807↑T `primary-acts-2000plus:ukpga/2011/20:section-156`
    **Creation of tenancies of social housing** — 156 1 In section 52 of the Law of Property Act 1925 (requirement that conveyances of land and interests in land be made by deed) in subsection (2) (exceptions) 
 5. [parliamentary/pwdata-wrans] score=65.950↑T `pwdata-wrans:answers2019-07-24:105`
    **Ministry of Housing, Communities and Local Government — Evictions** — Q (Andrew Rosindell): To ask the Secretary of State for Housing, Communities and Local Government, what his Department's definition is of eviction at short noti
 6. [parliamentary/pwdata-wrans] score=65.268↑T `pwdata-wrans:answers2006-07-18d:118`
    **COMMUNITIES AND LOCAL GOVERNMENT — Housing Act** — Q (David Taylor): To ask the Secretary of State for Communities and Local Government when she next plans to discuss the operation of section 21 (4a) of the Hous
 7. [parliamentary/pwdata-wrans] score=64.291↑T `pwdata-wrans:answers2019-11-04:160`
    **Ministry of Housing, Communities and Local Government — Social Rented Housing: Wycombe** — Q (Mr Steve Baker): To ask the Secretary of State for Housing, Communities and Local Government, if he will meet Wycombe social housing providers to discuss the
 8. [parliamentary/pwdata-debates] score=63.862↑T `pwdata-debates:debates1988-06-13a:500`
    **Clause 38 — PART I AMENDMENTS OF PART I WITH RESPECT TO THE HOUSING CORPORATION, HOUSING FOR WALES A** — 21.—(1) In section 31 (exercise of powers in relation to registered charities), in subsection (1) immediately before the entry relating to section 41 of the 198
 9. [parliamentary/historic-hansard] score=63.526↑T `historic-hansard:S5LV0574P0:3728`
    **Lords: Housing Bill** — Lord Lucas moved Amendment No. 95: Page 134, leave out lines 3 to 10 and insert— ("(a) amendments or repeals of provisions of the Housing Associations Act 1985,
10. [parliamentary/historic-hansard] score=63.080↑T `historic-hansard:S5LV0511P0:3219`
    **Lords: Local Government and Housing Bill** — Lord Hesketh moved Amendment No. 188CA: Page 216, line 2, leave out ("21 of the Housing Act 1988") and insert ("7 of the Housing Act 1988 (orders for possession
11. [parliamentary/pwdata-wrans] score=62.227↑T `pwdata-wrans:answers2007-06-20b:201`
    **COMMUNITIES AND LOCAL GOVERNMENT — Housing: Standards** — Q (Dai Davies): To ask the Secretary of State for Communities and Local Government what representations (a) she and (b) her predecessor responsible for housing 
12. [parliamentary/pwdata-wrans] score=62.127↑T `pwdata-wrans:answers2019-04-23:174`
    **Ministry of Housing, Communities and Local Government — Rented Housing: Older People** — Q (Stephen Timms): To ask the Secretary of State for Housing, Communities and Local Government, what steps his Department is taking to help local authorities im
13. [parliamentary/historic-hansard] score=62.070↑T `historic-hansard:S5LV0572P0:4887`
    **Lords: Housing Bill** — Clause 91 [ Form of notices under section 21 of the Housing Act 1988 ]:
14. [parliamentary/pwdata-wrans] score=61.432↑T `pwdata-wrans:answers2023-03-30:12`
    **Department for Levelling Up, Housing and Communities — Evictions** — Q (Kerry McCarthy): To ask the Secretary of State for Levelling Up, Housing and Communities, what plans he has to abolish section 21 of the Housing Act 1988.
15. [parliamentary/historic-hansard] score=61.152↑T `historic-hansard:S5LV0511P0:2889`
    **Lords: Local Government and Housing Bill** — .In section 21 of the Housing Act 1988, in subsection (1)(b) after the word "months" there shall be inserted "written").
16. [parliamentary/pwdata-wrans] score=61.082↑T `pwdata-wrans:answers2019-04-15:165`
    **Ministry of Housing, Communities and Local Government — Private Rented Housing: Evictions** — Q (Ellie Reeves): To ask the Secretary of State for Housing, Communities and Local Government, what recent assessment he has made of the adequacy of Section 21 
17. [other/petitions] score=60.852↑T `petitions:729348:1`
    **Abolish Section 21 'no-fault' evictions with immediate effect** — Abolish Section 21 'no-fault' evictions with immediate effect State: closed · Signatures: 51 · Opened: 2025-06-24 · Departments: Ministry of Housing, Communitie
18. [parliamentary/pwdata-debates] score=60.815↑T `pwdata-debates:debates1996-04-30a:354`
    **Orders of the Day — Housing Bill — FORM OF NOTICES UNDER SECTION 21 OF THE HOUSING ACT 1988** — '.—(1) Section 21 of the Housing Act 1988 (recovery of possession on expiry or termination of assured shorthold tenancy) shall be amended as follows.
19. [parliamentary/pwdata-wrans] score=60.742↑T `pwdata-wrans:answers2022-11-11:151`
    **Department for Levelling Up, Housing and Communities — Private Rented Housing: Unemployment** — Q (Christopher Pincher): To ask the Secretary of State for Levelling Up, Housing and Communities, if he will make an assessment of the potential impact of repea
20. [parliamentary/senedd-cofnod] score=60.703↑T `senedd-cofnod:4651:160`
    **Senedd Plenary: Notices under Section 21 of the Housing Act 1988** — 8. Will the Cabinet Secretary make a statement on the use of notices served under section 21 of the Housing Act 1988 in Wales? (OAQ51195)

### A2 (A/H2)
*Query:* What does section 1 of the Theft Act 1968 actually say?
*stream:* legislation · *kind:* specific · *metric:* recall@20
*recall@20:* 50.0% · *MRR:* 1.000

Expected sources:
- ✓ @1 — TA 1968 s.1
- ✗ MISS — TA 1968 ss.2–6 (dishonesty/appropriation defs)

Top-20 retrieved:
 1. [legislation/primary-acts-pre-2000] score=148.869↑R `primary-acts-pre-2000:ukpga/1968/60:section-1`
    1 1 A person is guilty of theft if he dishonestly appropriates property belonging to another with the intention of permanently depriving the other of it; and “ 
 2. [legislation/si-pre-2010] score=147.869↑T `si-pre-2010:uksi/2009/2610:article-24`
    **Amendments to the Safeguarding Vulnerable Groups Act 2006 (Prescribed Criteria and Miscellaneous Pro** — 24 1 The Safeguarding Vulnerable Groups Act 2006 (Prescribed Criteria and Miscellaneous Provisions) Regulations 2009 are amended as follows. 2 In Part 1 of the 
 3. [legislation/primary-acts-pre-2000] score=133.005↑T `primary-acts-pre-2000:ukpga/1968/60:section-36`
    **Short title, and general provisions as to Scotland and Northern Ireland.** — 36 1 This Act may be cited as the Theft Act 1968. 2 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 3 This Act does not extend to Scotland or, .
 4. [legislation/si-pre-2010] score=131.970↑T `si-pre-2010:uksi/2007/2171:article-2`
    **Amendment of the Criminal Justice and Court Services Act 2000** — 2 1 Schedule 6 to the Criminal Justice and Court Services Act 2000 (which specifies trigger offences for the purposes of section 70 of that Act) shall be amende
 5. [legislation/si-pre-2010] score=131.824↑T `si-pre-2010:uksi/2004/1892:article-2`
    **Amendment of the Criminal Justice and Court Services Act 2000** — 2 1 Schedule 6 to the Criminal Justice and Court Services Act 2000 (which specifies trigger offences for the purposes of section 70 of the Act) shall be amended
 6. [legislation/primary-acts-pre-2000] score=129.099↑T `primary-acts-pre-2000:ukpga/1980/43:section-33`
    **Maximum penalties on summary conviction in pursuance of section 22.** — 33 1 Where in pursuance of subsection (2) of section 22 above a magistrates’ court proceeds to the summary trial of an information, then, if the accused is summ
 7. [legislation/si-pre-2010] score=127.705↑T `si-pre-2010:uksi/2007/296:article-3`
    **Amendment of Schedule 5 to the Sexual Offences Act 2003** — 3 1 Schedule 5 to the Act is amended as follows. 2 After paragraph 4 insert – 4A Outraging public decency. . 3 After paragraph 31 insert – 31A An offence under 
 8. [legislation/primary-acts-pre-2000] score=126.251↑T `primary-acts-pre-2000:ukpga/1996/62:section-3`
    **The new offences: jurisdiction.** — 3 (1) In section 1(2) of the Criminal Justice Act 1993 (Group A offences for the purposes of the jurisdictional provisions) paragraph (a) (list of offences unde
 9. [legislation/primary-acts-pre-2000] score=126.190↑T `primary-acts-pre-2000:ukpga/1980/58:section-4`
    **Special time limit in case of theft.** — 4 1 The right of any person from whom a chattel is stolen to bring an action in respect of the theft shall not be subject to the time limits under sections 2 an
10. [legislation/si-2010plus] score=124.973↑T `si-2010plus:uksi/2014/1229:article-2`
    **Amendment of the Prosecution of Offences Act 1985 (Specified Proceedings) Order 1999** — 2 1 The Prosecution of Offences Act 1985 (Specified Proceedings) Order 1999 is amended as follows. 2 In Part 1 of the Schedule, after paragraph 16 insert— 16A T
11. [legislation/primary-acts-2000plus] score=124.123↑T `primary-acts-2000plus:ukpga/2006/52:section-77`
    **Sections 75 and 76: definitions** — 77 1 Subsections (2) to (6) apply for the purposes of sections 75 and 76. 2 “ Controlled drug ” has the meaning given by section 2 of the Misuse of Drugs Act 19
12. [parliamentary/pwdata-debates] score=93.004↑T `pwdata-debates:debates1991-02-20a:320`
    **Orders of the Day — Criminal Justice Bill — MINIMUM SENTENCES** — '(1) That the minimum sentence for any offender convicted under— (a) Section 37 Schedule 2 part 1 to the Sexual Offences Act 1956 shall be 10 years. (b) Section
13. [parliamentary/historic-hansard] score=90.918↑T `historic-hansard:S5LV0582P0:5246`
    **Lords: Thefts from Mail** — Lord Williams of Mostyn : Information collected centrally for England and Wales under Section 1 of the Theft Act 1968 and Post Office Act 1953, Section 53 as am
14. [parliamentary/pwdata-wrans] score=87.418↑T `pwdata-wrans:answers2022-04-20:4`
    **Attorney General — Distributive Trade: Theft** — Q (Emily Thornberry): To ask the Attorney General, how many CPS prosecutions there have been to date for the theft of goods by customers from retail and wholesa
15. [parliamentary/pwdata-debates] score=87.393↑T `pwdata-debates:debates2005-12-02b:289`
    **Orders of the Day — Criminal Law (Amendment) (Protection of Property) Bill** — Of course I intend to do that. It is a little way down my list of subjects, but I hope there will be time to get to the Human Rights Act and the implications of
16. [parliamentary/pwdata-lordswrans] score=87.145↑T `pwdata-lordswrans:lordswrans2011-12-13a:17`
    **Crime: Metal Theft** — Q (Lord Kennedy of Southwark): To ask Her Majesty's Government, further to the Written Answer by Lord Henley on 21 November ( WA 184 ), where and in what format
17. [parliamentary/pwdata-debates] score=80.930↑T `pwdata-debates:debates2025-06-18e:349`
    **Crime and Policing Bill — New Clause 130 - Theft of tools: prevention of re-sale and prosecution of ** — (1) The Equipment Theft Act 2023 is amended as follows. (2) In section 3 (Enforcement), subsection (2) at end insert “equal to— (a) the replacement cost of the 
18. [parliamentary/historic-hansard] score=80.324↑T `historic-hansard:S5LV0582P0:5248`
    **Lords: Thefts from Mail** — Number of recorded offences and defendants prosecuted at magistrates' courts and convicted at all courts for the offence of theft or unauthorised taking from ma
19. [parliamentary/historic-hansard] score=78.248↑T `historic-hansard:S5LV0388P0:1358`
    **Lords: THEFT BILL [H.L.]** — Lord HARRIS of GREENWICH : I am grateful to my noble friend Lord Hale for having explained this Amendment. I fear that I cannot recommend the House to accept it
20. [parliamentary/pwdata-debates] score=78.135↑T `pwdata-debates:debates1988-06-28a:721`
    **Clause 34 — Extradition under Part I of the Criminal Justice Act 1988.** — No. 177, in line 25, leave out from beginning to '(intimate' and insert— '79A. The Police and Criminal Evidence Act 1984 shall be amended as follows. 79B. At th

### A3 (A/H1)
*Query:* Working Time Regulations 1998
*stream:* legislation · *kind:* specific · *metric:* recall@20
*recall@20:* 100.0% · *MRR:* 1.000

Expected sources:
- ✓ @1 — SI 1998/1833
- ✓ @5 — reg 4 / regs 13–13A

Top-20 retrieved:
 1. [legislation/si-pre-2010] score=88.985↑R `si-pre-2010:uksi/1998/1833:regulation-1`
    1 1 These Regulations may be cited as the Working Time Regulations 1998 and shall come into force on 1st October 1998. 2 These Regulations extend to Great Brita
 2. [legislation/si-pre-2010] score=87.985↑R `si-pre-2010:uksi/1998/1833:regulation-10`
    10 1 A worker is entitled to a rest period of not less than eleven consecutive hours in each 24-hour period during which he works for his employer. 2 Subject to
 3. [legislation/si-pre-2010] score=86.985↑R `si-pre-2010:uksi/1998/1833:regulation-11`
    11 1 Subject to paragraph (2), a worker is entitled to an uninterrupted rest period of not less than 24 hours in each seven-day period during which he works for
 4. [legislation/si-pre-2010] score=85.985↑R `si-pre-2010:uksi/1998/1833:regulation-12`
    12 1 Where a worker's daily working time is more than six hours, he is entitled to a rest break. 2 The details of the rest break to which a worker is entitled u
 5. [legislation/si-pre-2010] score=84.985↑R `si-pre-2010:uksi/1998/1833:regulation-13`
    13 A1 This regulation applies to— a a worker in respect of any leave years beginning before 1st April 2024, and b a worker to whom regulation 15B does not apply
 6. [legislation/si-pre-2010] score=83.985↑R `si-pre-2010:uksi/1998/1833:regulation-13A`
    13A A1 This regulation applies to— a a worker in respect of any leave years beginning before 1st April 2024, and b a worker to whom regulation 15B does not appl
 7. [legislation/si-pre-2010] score=82.985↑R `si-pre-2010:uksi/1998/1833:regulation-14`
    14 1 Paragraphs (1) to (4) of this regulation apply where— a a worker’s employment is terminated during the course of his leave year, and b on the date on which
 8. [legislation/si-pre-2010] score=81.985↑R `si-pre-2010:uksi/1998/1833:regulation-15`
    15 1 A worker may take leave to which he is entitled under regulations 13, 13A and 15B on such days as he may elect by giving notice to his employer in accordan
 9. [legislation/si-pre-2010] score=80.985↑R `si-pre-2010:uksi/1998/1833:regulation-15A`
    15A 1 During the first year of his employment, the amount of leave a worker may take at any time in exercise of his entitlement under regulation 13 or regulatio
10. [legislation/si-pre-2010] score=79.985↑R `si-pre-2010:uksi/1998/1833:regulation-15B`
    15B 1 This regulation applies to an irregular hours worker, or a part-year worker, to whom the Agricultural Wages (Scotland) Act 1949 (as that Act had effect on
11. [legislation/si-pre-2010] score=78.985↑R `si-pre-2010:uksi/1998/1833:regulation-15C`
    15C 1 This regulation applies for the purposes of determining the amount of annual leave which a worker to whom regulation 15B applies, accrues in a pay period 
12. [legislation/si-pre-2010] score=77.985↑R `si-pre-2010:uksi/1998/1833:regulation-15D`
    15D 1 Leave to which a worker is entitled under regulation 15B may be taken in instalments but, subject to the exceptions in paragraphs (2), (3), (4) and (6), i
13. [legislation/primary-acts-pre-2000] score=76.985↑T `primary-acts-pre-2000:ukpga/1996/18:section-101A`
    **Working time cases.** — 101A 1 An employee who is dismissed shall be regarded for the purposes of this Part as unfairly dismissed if the reason (or, if more than one, the principal rea
14. [parliamentary/pwdata-wrans] score=50.810↑T `pwdata-wrans:answers2021-12-02:121`
    **Ministry of Justice — Ministry of Justice: Working Hours** — Q (Rachel Hopkins): To ask the Secretary of State for Justice, what records relating to staff working times are kept by his Department under Regulation 9 of the
15. [parliamentary/pwdata-wrans] score=50.339↑T `pwdata-wrans:answers2021-12-02:175`
    **Department for Work and Pensions — Department for Work and Pensions: Working Hours** — Q (Rachel Hopkins): To ask the Secretary of State for Work and Pensions, what records relating to staff working times are kept by her Department under Regulatio
16. [parliamentary/pwdata-wrans] score=50.334↑T `pwdata-wrans:answers2022-01-17:219`
    **Department for Environment, Food and Rural Affairs — Department for Environment, Food and Rural Affa** — Q (Grahame Morris): To ask the Secretary of State for Environment, Food and Rural Affairs, what assessment he has made of the compliance of his Department's sta
17. [parliamentary/pwdata-wrans] score=50.206↑T `pwdata-wrans:answers2021-12-02:137`
    **Treasury — Treasury: Working Hours** — Q (Rachel Hopkins): To ask the Chancellor of the Exchequer, what records relating to staff working times are kept by his Department under Regulation 9 of the Wo
18. [parliamentary/niassembly-hansard] score=49.993↑T `niassembly-hansard:259251:20`
    **NI Assembly: Executive Committee Business — Working Time Regulations (Northern Ireland) 2016** — Thank you Mr Speaker. I welcome the opportunity to outline the views of the Committee for Employment and Learning on the statutory rules relating to the working
19. [parliamentary/pwdata-wrans] score=49.586↑T `pwdata-wrans:answers2003-12-11:123`
    **NORTHERN IRELAND — Working Time Directive** — Q (Lady Hermon): To ask the Secretary of State for Northern Ireland if he will make a statement on the implementation of the European Union Working Time Directi
20. [parliamentary/pwdata-wrans] score=49.420↑T `pwdata-wrans:answers2019-01-14:172`
    **Treasury — Revenue and Customs: Working Hours** — Q (Chris Law): To ask the Chancellor of the Exchequer, what processes HMRC has in place to ensure compliance with Regulation 5 of the Working Time Regulations 1

### A4 (A/H1)
*Query:* Equality Act 2010 section 149
*stream:* legislation · *kind:* specific · *metric:* recall@20
*recall@20:* 50.0% · *MRR:* 1.000

Expected sources:
- ✓ @1 — EqA 2010 s.149 (PSED)
- ✗ MISS — Sch 18 exceptions

Top-20 retrieved:
 1. [legislation/primary-acts-2000plus] score=83.077↑R `primary-acts-2000plus:ukpga/2010/15:section-149`
    **Public sector equality duty** — 149 1 A public authority must, in the exercise of its functions, have due regard to the need to— a eliminate discrimination, harassment, victimisation and any o
 2. [parliamentary/pwdata-lordswrans] score=82.077↑T `pwdata-lordswrans:lordswrans2010-11-01a:28`
    **Equality Act 2010** — Q (Lord Laird): To ask Her Majesty's Government when they plan to table commencement orders for sections 1-3, 64-80, 127-135, and 149-159 of the Equality Act 20
 3. [guidance/quangos-govuk] score=77.197↑T `quangos-govuk:government/publications/equality-diversity-and-inclusion-statement-early-career-framework-and-national-professional-qualification-inspection-framework-and-handbook:1`
    **Equality, diversity and inclusion statement: early career framework and national professional qualif** — This statement sets out Ofsted’s consideration of how the new early career framework (ECF) and national professional qualification (NPQ) inspection framework an
 4. [parliamentary/pwdata-wrans] score=76.201↑T `pwdata-wrans:answers2016-11-03:123`
    **Department for Education — Government Departments: Equality** — Q (Dawn Butler): To ask the Secretary of State for Education, pursuant to the Answer of 20 October 2016 to Question 48637, how the Government Equalities Office 
 5. [parliamentary/pwdata-lordswrans] score=76.034↑T `pwdata-lordswrans:lordswrans2014-01-30a:12`
    **Equality Act 2010** — Q (Lord Moynihan): To ask Her Majesty’s Government whether it is their intention to add Sport England, by statutory instrument, as a named public body in the Eq
 6. [guidance/quangos-govuk] score=75.701↑T `quangos-govuk:government/publications/equality-act-2010-the-public-sector-equality-duty-reducing-bureaucracy-policy-review-paper:1`
    **Equality Act 2010:  The public sector Equality Duty:  reducing bureaucracy.  Policy review paper** — In addition to the general Equality Duty at section 149 of the Equality Act 2010, section 153 the Act gives the Government a power to impose specific duties on 
 7. [parliamentary/pwdata-lordswrans] score=75.236↑T `pwdata-lordswrans:lordswrans2011-04-26a:94`
    **Equality Act 2010** — Q (Lord Ouseley): To ask Her Majesty's Government when the Public Sector Equality Duty under the Equality Act 2010 will come into force, following their decisio
 8. [guidance/quangos-govuk] score=72.597↑T `quangos-govuk:government/publications/draft-the-equality-act-2010-specific-duties-regulations-2011:1`
    **Draft The Equality Act 2010 (Specific Duties) Regulations 2011** — Draft specific duties regulations were laid before Parliament on 27 June 2011 and are expected to come into force in September 2011, subject to parliamentary ap
 9. [guidance/quangos-govuk] score=72.015↑T `quangos-govuk:government/publications/equality-act-2010-schedule-19-consolidated-april-2011:1`
    **Equality Act 2010: Schedule 19 (consolidated) - April 2011** — Section 149 of the Equality Act 2010, the public sector Equality Duty, applies to the public bodies listed in Schedule 19. Being listed in the Schedule also mea
10. [parliamentary/pwdata-debates] score=71.976↑T `pwdata-debates:debates2019-01-08b:383`
    **FINANCE (NO. 3) BILL — Impact of provisions of section 5 on child poverty and equality** — ‘(1) The Chancellor of the Exchequer must review the impact of the provisions of section 5 and lay a report of that review before the House of Commons within si
11. [parliamentary/pwdata-debates] score=71.786↑T `pwdata-debates:debates2018-11-19c:439`
    **FINANCE (NO. 3) BILL — Impact of provisions of section 5 on child poverty and equality** — ‘(1) The Chancellor of the Exchequer must review the impact of the provisions of section 5 and lay a report of that review before the House of Commons within si
12. [parliamentary/pwdata-lordswrans] score=70.983↑T `pwdata-lordswrans:lordswrans2025-09-18:7`
    **Home Office — Home Office: Equality** — Q (Baroness Jenkin of Kennington): To ask His Majesty's Government, further to the Written Answer by the Minister of State for Policing, Fire and Crime Preventi
13. [parliamentary/pwdata-lordswrans] score=70.541↑T `pwdata-lordswrans:lordswrans2011-09-05a:10`
    **Equality** — Q (Lord Laird): To ask Her Majesty's Government, further to the Written Answer by Baroness Verma on 15 June ( WA 192-2 ), whether they will pilot a cost assessm
14. [parliamentary/pwdata-wrans] score=70.346↑T `pwdata-wrans:answers2022-05-30:64`
    **Department for Work and Pensions — Universal Credit: Impact Assessments** — Q (Dawn Butler): To ask the Secretary of State for Work and Pensions, whether her Department undertook an equality impact assessment on the migration of claiman
15. [parliamentary/pwdata-wrans] score=69.734↑T `pwdata-wrans:answers2016-11-24:95`
    **Department for Education — Schools: Equality** — Q (Dawn Butler): To ask the Secretary of State for Education, if she will undertake an impact assessment on the compatibility of the Schools that Work for Every
16. [parliamentary/pwdata-lordswrans] score=69.724↑T `pwdata-lordswrans:lordswrans2010-11-29a:13`
    **Equality Act 2010** — Q (Lord Laird): To ask Her Majesty's Government which sections or subsections of the Equality Act 2010 have not been commenced; of those, which ones they intend
17. [parliamentary/pwdata-wrans] score=69.600↑T `pwdata-wrans:answers2024-01-24:193`
    **Northern Ireland Office — Northern Ireland Office: Equality** — Q (Neil O'Brien): To ask the Secretary of State for Northern Ireland, how many equalities impact assessments his Department completed in each of the last five y
18. [parliamentary/pwdata-wrans] score=69.230↑T `pwdata-wrans:answers2016-12-07:183`
    **Women and Equalities — Local Government: Equality** — Q (Caroline Lucas): To ask the Minister for Women and Equalities, with reference to the report, Acting on equalities: are local authorities in England meeting t
19. [parliamentary/pwdata-debates] score=69.222↑T `pwdata-debates:debates2021-04-19d:279`
    **Finance (No. 2) Bill — New Clause 23 - EQUALITY IMPACT ANALYSIS** — ‘(1) The Chancellor of the Exchequer must review the equality impact of sections 1 to 5, 24 to 26, 28, 31 to 33, 40 and 86 of this Act and lay a report of that 
20. [guidance/quangos-govuk] score=69.020↑T `quangos-govuk:government/publications/mhra-public-sector-equality-duty-report-2025-2026:1`
    **MHRA Public Sector Equality Duty Report 2025-2026** — This report outlines how the Medicines and Healthcare products Regulatory Agency (MHRA) meets our obligations under the Public Sector Equality Duty (PSED), as s

### A5 (A/H2)
*Query:* Find me the law that says you have to wear a seatbelt
*stream:* legislation · *kind:* specific · *metric:* recall@20
*recall@20:* 0.0% · *MRR:* 0.000

Expected sources:
- ✗ MISS — RTA 1988 ss.14–15
- ✗ MISS — Motor Vehicles (Wearing of Seat Belts) Regs 1993

Top-20 retrieved:
 1. [other/petitions] score=91.214↑T `petitions:597320:1`
    **Make it LAW to wear a seatbelt on all dangerous machinery.** — Make it LAW to wear a seatbelt on all dangerous machinery. State: rejected · Signatures: 21 We need the there to be a law on people having to wear seatbelts on 
 2. [parliamentary/pwdata-wrans] score=84.365↑T `pwdata-wrans:answers2006-04-24b:63`
    **TRANSPORT — Seatbelts** — Q (David Amess): To ask the Secretary of State for Transport what steps he (a) is taking and (b) plans to take to increase the seatbelt wearing rate to 97 per c
 3. [parliamentary/pwdata-wrans] score=83.401↑T `pwdata-wrans:answers2006-10-25b:13`
    **NORTHERN IRELAND — Seat Belts** — Q (Sammy Wilson): To ask the Secretary of State for Northern Ireland how many motorists in Northern Ireland have been prosecuted for not wearing seat belts in e
 4. [parliamentary/pwdata-wrans] score=83.164↑T `pwdata-wrans:answers2006-06-19c:213`
    **NORTHERN IRELAND — Road Safety** — Q (Peter Robinson): To ask the Secretary of State for Northern Ireland what steps he (a) is taking and (b) plans to take to increase the seatbelt-wearing rate i
 5. [parliamentary/historic-hansard] score=82.817↑T `historic-hansard:S5LV0520P0:321`
    **Lords: Horses (Protective Headgear for Young Riders) Bill** — Viscount Mountgarret : My Lords, I wish to say to the noble Lord, Lord Monson, that his argument about the freedom of the individual perhaps goes too far on thi
 6. [parliamentary/pwdata-debates] score=81.961↑T `pwdata-debates:debates2008-04-22d:186`
    **Orders of the Day — New Clause 2 — Means testing** — That is an important issue that we need to guard against. Furthermore, it is clear from the work carried out by the PPI that there is a whole tranche of people—
 7. [parliamentary/pwdata-wrans] score=80.934↑T `pwdata-wrans:answers2006-06-21c:271`
    **NORTHERN IRELAND — Seatbelts** — Q (Iris Robinson): To ask the Secretary of State for Northern Ireland what advice he has provided to education and library boards in Northern Ireland regarding 
 8. [parliamentary/pwdata-wrans] score=77.323↑T `pwdata-wrans:answers2003-06-25:236`
    **NORTHERN IRELAND — School Buses** — Q (Lady Hermon): To ask the Secretary of State for Northern Ireland what action he is taking to tackle overcrowding on school buses in Northern Ireland; and wha
 9. [parliamentary/pwdata-wrans] score=76.917↑T `pwdata-wrans:answers2005-11-21c:320`
    **NORTHERN IRELAND — Driving Offences** — Q (Peter Robinson): To ask the Secretary of State for Northern Ireland how many people were stopped for not wearing their seatbelts in each of the last five yea
10. [parliamentary/pwdata-debates] score=75.908↑T `pwdata-debates:debates1976-03-01a:324`
    **Orders of the Day — ROAD TRAFFIC (SEAT BELTS) BILL** — Yes, I meant the consequences of accidents—in other words, deaths or injuries from accidents. If this proposal goes ahead as it seems the Government intend, wit
11. [parliamentary/pwdata-wrans] score=74.418↑T `pwdata-wrans:answers2005-11-09c:191`
    **HOME DEPARTMENT — Seatbelts (Fixed Penalties)** — Q (Shona McIsaac): To ask the Secretary of State for the Home Department how many fixed penalty notices were issued for (a) carrying a child under 14 years with
12. [parliamentary/pwdata-westminster] score=72.550↑T `pwdata-westminster:westminster2022-12-01a:24`
    **Backbench Business — International Day for the Elimination of Violence Against Women — [Julie Elliot** — It is a pleasure to serve under your chairmanship, Ms Elliott. Violence against women and girls is a problem not just for women and girls. Every woman or girl w
13. [parliamentary/pwdata-lords] score=72.309↑T `pwdata-lords:daylord2020-07-08a:210`
    **Health Protection (Coronavirus, Wearing of Face Coverings on Public Transport) (England) Regulations** — My Lords, I wholeheartedly support the wearing of face masks on public transport and, indeed, more widely. My reason for doing so is neatly summarised in the Go
14. [parliamentary/historic-hansard] score=70.708↑T `historic-hansard:S5LV0565P0:4921`
    **Lords: Seatbelts in Minibuses and Coaches** — Lord Renton : My Lords, is my noble friend aware that seatbelts can be fitted with high or low clasps? Small children cannot wear the seatbelts fitted with high
15. [parliamentary/historic-hansard] score=69.782↑T `historic-hansard:S5LV0605P0:7390`
    **Lords: Taxis: Prosecutions for Failing to Wear Rear Seatbelts** — How many passengers have been convicted for failing to wear seatbelts in the rear of taxis in each year since wearing became compulsory (a) in the Metropolitan 
16. [parliamentary/pwdata-westminster] score=69.751↑T `pwdata-westminster:westminster2018-10-16a:46`
    **Road Safety — [Mrs Madeleine Moon in the Chair]** — I agree to an extent, in that those are some of the key roads where investment should be prioritised. There are also far too many accidents occurring in urban a
17. [parliamentary/pwdata-debates] score=69.573↑T `pwdata-debates:debates1980-02-22a:56`
    **Orders of the Day — ROAD TRAFFIC (SEAT BELTS) BILL — COMMENCEMENT OF REGULATIONS** — It is up to us to make the legislation as good as possible. My constituency has a vast mileage of unfenced roadway along canals and rivers. Many accidents in Ca
18. [parliamentary/pwdata-debates] score=68.388↑T `pwdata-debates:debates1980-02-22a:143`
    **Orders of the Day — ROAD TRAFFIC (SEAT BELTS) BILL — COMMENCEMENT OF REGULATIONS** — That may be, but to allay the voices of doubt I make absolutely clear what I believe to be the effect of the new clause. For whatever reason and by whatever mea
19. [parliamentary/committees-evidence] score=68.267↑T `committees-evidence:writtenevidence:68008:113411`
    **Improving the rail passenger experience inquiry — RPE0149** — RPE0149 - Evidence on Improving rail passenger experience Written evidence submitted by Mr Ken Grocott (RPE0149) Thank you for giving me the opportunity to comm
20. [other/petitions] score=68.009↑T `petitions:601847:1`
    **Drop the "urban bus" exemption from laws requiring seatbelts on buses** — Drop the "urban bus" exemption from laws requiring seatbelts on buses State: closed · Signatures: 172 · Opened: 2021-11-30 · Departments: Department for Transpo

### B1 (B/H2)
*Query:* Can my landlord kick me out without giving a reason?
*stream:* legislation · *kind:* specific · *metric:* recall@20
*recall@20:* 0.0% · *MRR:* 0.000

Expected sources:
- ✗ MISS — HA 1988 s.21
- ✗ MISS — HA 1988 s.8 / Sch 2
- ✗ MISS — Renters’ Rights Act 2025
- ✗ MISS — Deregulation Act 2015 ss.33–41 (retaliatory eviction)

Top-20 retrieved:
 1. [other/petitions] score=73.139↑T `petitions:568553:1`
    **Increase legal protection for lodgers (people with live-in landlords)** — Increase legal protection for lodgers (people with live-in landlords) State: closed · Signatures: 37 · Opened: 2021-01-20 The laws protecting lodgers need to be
 2. [parliamentary/pwdata-debates] score=69.122↑T `pwdata-debates:debates1967-06-20a:310`
    **Orders of the Day — LEASEHOLD REFORM BILL — Clause 3.—(PROVISIONS WHERE LANDLORD DESIRES TO SELL FRE** — The Parliamentary Secretary is making very heavy weather of objecting to the Clause of my hon. Friend the Member for Hendon, South (Sir H. Lucas-Tooth). I canno
 3. [parliamentary/historic-hansard] score=66.430↑T `historic-hansard:S5LV0491P0:3534`
    **Lords: Landlord and Tenant Bill [H.L.]** — Lord Coleraine : My Lords, I beg to move that this Bill he now read a second time. This Bill is that appended to Law Commission Report No. 161, Leasehold Convey
 4. [parliamentary/pwdata-debates] score=63.026↑T `pwdata-debates:debates1927-11-08a:352`
    **Orders of the Day — LANDLORD AND TENANT (No. 2) BILL.** — I think the Home Secretary is inaccurate with regard to the Agricultural Holdings Acts. I have read them on many occasions. My recollection is that his statemen
 5. [parliamentary/historic-hansard] score=61.882↑T `historic-hansard:S5LV0069P0:1574`
    **Lords: LANDLORD AND TENANT (No. 2) BILL.** — LORD PHILLIMORE : I hold no brief for the Government. I simply speak as a lawyer and, I may say, as a landlord well versed in the law of real property. A decisi
 6. [parliamentary/pwdata-debates] score=60.757↑T `pwdata-debates:debates1949-02-16a:371`
    **Orders of the Day — LANDLORD AND TENANT (RENT CONTROL) BILL — CLAUSE 2.—(PROVISION AS TO PREMIUMS, E** — I beg to move, in page 4, line 25, to leave out subsection (7). My reasons for moving this Amendment are very simple. I want to ask the Minister to explain the 
 7. [parliamentary/pwdata-lords] score=60.448↑T `pwdata-lords:daylord2025-10-14c:110`
    **Renters’ Rights Bill - Commons Reasons and Amendments — Motion B** — My Lords, first, I join the noble Lord, Lord Best, in praising the noble Lord, Lord Young, for his tenacity and commitment to shared ownership owners, who reall
 8. [parliamentary/pwdata-lords] score=29.067 `pwdata-lords:daylord2025-07-07b:93`
    **Renters’ Rights Bill - Report (2nd Day) — Amendment 47** — My Lords, I start by declaring an interest: I own a dog that is subject to approval by a superior landlord of the flat in which we live. It has that approval. I
 9. [parliamentary/pwdata-lords] score=28.906 `pwdata-lords:daylord2025-05-15b:156`
    **Renters’ Rights Bill - Committee (7th Day) — Amendment 278** — I am telling the noble Lord that, from my experience, it is. From my experience, what has happened is that tenants have made a very large section of the populat
10. [parliamentary/pwdata-debates] score=28.876 `pwdata-debates:debates1985-11-28a:388`
    **Orders of the Day — Housing (Scotland) Bill** — Yes, and private landlords. At least a local authority is elected, and if the people do not like what it does they can kick it out. I suspect that many Tories i
11. [parliamentary/historic-hansard] score=28.053 `historic-hansard:gapday:commons:1900/feb/09:424`
    **Commons: IRISH LAND ACTS.** — I have not read his election address; I never read election addresses. What I ask myself is this: Who is going to pay that additional money? The British taxpaye
12. [parliamentary/historic-hansard] score=28.038 `historic-hansard:S5CV0012P0:4771`
    **Commons: HOUSING, TOWN PLANNING, ETC., BILL. — CLAUSE 15.—(Condition as to Keeping Houses Let to Per** — Mr. G. N. BARNES : With all respect to the right hon. Gentleman he has altogether evaded the point raised by my hon. Friend the Member for Merthyr Tydvil (Mr. K
13. [parliamentary/historic-hansard] score=27.188 `historic-hansard:S5LV0543P0:3253`
    **Lords: Housing and Urban Development Bill** — Lord Strathclyde : This is another amendment which deals with a matter of balance. We decided that a period of five years is fair to both the long leaseholder a
14. [parliamentary/historic-hansard] score=27.113 `historic-hansard:S5LV0203P0:1571`
    **Lords: RENT BILL** — THE EARL OF MUNSTER : If the noble Lord had really read and understood the Bill, he would not have made a speech such as he has. I hoped we might be able to cut
15. [parliamentary/pwdata-debates] score=26.976 `pwdata-debates:debates1923-07-30a:459`
    **Orders of the Day — RENT AND MORTGAGE INTEREST RESTRICTIONS BILL. — NEW CLAUSE.—(Restriction on righ** — The Lords Amendment provides that Where the dwelling-house is reasonably required by the landlord for occupation as a residence for himself or for any son or da
16. [parliamentary/historic-hansard] score=26.543 `historic-hansard:S5LV0039P0:1129`
    **Lords: AGRICULTURE BILL.** — LORD PHILLIMORE : Those who defend this clause do not seem to appreciate that paragraph (d) does not enable the landlord to force any contract upon the tenant, 
17. [parliamentary/pwdata-lords] score=26.414 `pwdata-lords:daylord2021-11-24b:137`
    **Police, Crime, Sentencing and Courts Bill - Committee (11th Day) — Amendment 292H** — My Lords, I support Amendment 292H in particular. It is a bit of a stretch to have included Amendment 292J, which has been clearly explained, in this group, but
18. [parliamentary/pwdata-debates] score=26.353 `pwdata-debates:debates2023-10-23d:433`
    **Renters (Reform) Bill** — We have a mandate from the British people to deliver this Bill, and I know that passing it into law will be warmly welcomed by renters in the 4.6 million househ
19. [parliamentary/historic-hansard] score=26.316 `historic-hansard:S5LV0356P0:454`
    **Lords: RENT ACT 1974** — Lord JANNER : My Lords, the noble Lord had better not goad me. I did not want to enter into discussion on this particular topic; but if the House really wants t
20. [parliamentary/pwdata-debates] score=26.101 `pwdata-debates:debates1940-03-13a:399`
    **Orders of the Day — FOOD SUPPLIES.** — In the short time at his disposal, the right hon. Gentleman has certainly given me a number of points to answer; he has also succeeded in compressing into that 

### B2 (B/H2)
*Query:* I want to stop people renting out whole houses as Airbnbs all year round
*stream:* legislation · *kind:* specific · *metric:* recall@20
*recall@20:* 33.3% · *MRR:* 0.111

Expected sources:
- ✗ MISS — Levelling-up and Regeneration Act 2023 (short-term lets)
- ✓ @9 — Use Classes Order
- ✗ MISS — Deregulation Act 2015 s.44 (London 90-night)

Top-20 retrieved:
 1. [parliamentary/pwdata-westminster] score=87.497↑T `pwdata-westminster:westminster2022-04-27a:50`
    **Affordable Housing (Devon and Cornwall) — [Stewart Hosie in the Chair]** — I do agree. People used the word “crisis” earlier—none of us likes to use it, but this is a crisis. Many constituents are struggling to find a suitable home. I 
 2. [parliamentary/pwdata-westminster] score=86.846↑T `pwdata-westminster:westminster2022-04-27a:48`
    **Affordable Housing (Devon and Cornwall) — [Stewart Hosie in the Chair]** — Thank you, Mr Hosie, for chairing the debate. I start by congratulating my hon. Friend the Member for North Devon (Selaine Saxby) on securing the debate and mak
 3. [parliamentary/pwdata-westminster] score=85.013↑T `pwdata-westminster:westminster2022-04-27a:53`
    **Affordable Housing (Devon and Cornwall) — [Stewart Hosie in the Chair]** — I thank the hon. Member for South West Devon (Sir Gary Streeter) —my constituency neighbour—for those remarks. There is cross-party agreement on this issue that
 4. [parliamentary/pwdata-westminster] score=78.466↑T `pwdata-westminster:westminster2022-04-27a:55`
    **Affordable Housing (Devon and Cornwall) — [Stewart Hosie in the Chair]** — I think there is a good route for covenants. As someone whose little sisters work in farming, I know that the agricultural ties on some properties are a really 
 5. [parliamentary/pwdata-debates] score=77.720↑T `pwdata-debates:debates2016-01-12b:280`
    **Housing and Planning Bill — [2nd Allocated Day] — New Clause 62 — Offence of contravening an overcro** — My hon. Friend is making a very strong case for the Government to take electrical safety checks more seriously. May I suggest, given the pressure on housing and
 6. [parliamentary/senedd-cofnod] score=77.650↑T `senedd-cofnod:13008:164`
    **Senedd Plenary: Football World Cup** — I also declare an interest that’s on the public record as well. Colleagues, I’m delighted to have the opportunity to contribute to this debate. It was a pleasur
 7. [parliamentary/pwdata-debates] score=77.249↑T `pwdata-debates:debates1972-04-11a:233`
    **HOUSING (FINANCIAL PROVISIONS) (SCOTLAND) BILL (ALLOCATION OF TIME)** — The hon. Member for South Angus (Mr. Bruce-Gardyne) was not there at the time. But I will come to him in a moment. The Leader of the House spoke about points of
 8. [parliamentary/pwdata-lords] score=76.907↑T `pwdata-lords:daylord2024-03-14a:127`
    **Housing: Young People - Motion to Take Note** — My Lords, I thank the noble Baroness, Lady Donaghy for her contribution. I know how she feels: when one is speaking after the noble Lord, Lord Young of Cookham,
 9. [parliamentary/committees-evidence] score=42.423 `committees-evidence:writtenevidence:62924:108345`
    **The digital economy inquiry — TDE0103** — TDE0103 - Evidence on The Digital Economy Supplementary written evidence from the British Hospitality Association (TDE 103) This supplementary evidence is submi
10. [parliamentary/committees-evidence] score=39.893 `committees-evidence:writtenevidence:63651:109272`
    **Economics of the United Kingdom housing market inquiry — EHM0152** — EHM0152 - Evidence on Economics of the United Kingdom Housing Market British Hospitality Association – Written evidence (EHM0152) INTRODUCTION This evidence is 
11. [parliamentary/pwdata-lords] score=39.739 `pwdata-lords:daylord2020-10-29b:233`
    **Fire Safety Bill - Committee — Amendment 13** — My Lords, Amendment 13 in my name sets out to highlight what may be a gap in the protection afforded by the fire safety order. The fire safety order does not ap
12. [parliamentary/pwdata-debates] score=38.201 `pwdata-debates:debates2022-05-10b:146`
    **Debate on the Address — [1st day]** — The bare bones of a list of Bills has now been revealed to us all by what I call a skeleton of a functioning Government. Bill titles conceal their contents and 
13. [parliamentary/pwdata-lords] score=38.084 `pwdata-lords:daylord2025-05-12c:216`
    **Renters’ Rights Bill - Committee (5th Day) — Amendment 185** — My Lords, as mentioned previously in Committee, I declare my interest as a landlord and former long-term tenant in the private rented sector. I support the amen
14. [parliamentary/pwdata-westminster] score=37.763 `pwdata-westminster:westminster2024-09-12a:18`
    **Short-term Lets: Regulation — [Carolyn Harris in the Chair]** — I could have not said it better myself. The large increase in short-term holiday lets has left whole streets dark and empty for months on end as the days shorte
15. [parliamentary/pwdata-debates] score=37.532 `pwdata-debates:debates2019-01-10d:266`
    **BUSINESS OF THE HOUSE** — On new year’s eve, 40 people were arrested at a flat in Fulham in my constituency, following a serious knife attack nearby. The police told me that the flat had
16. [parliamentary/pwdata-westminster] score=36.978 `pwdata-westminster:westminster2023-05-23a:9`
    **Short-term Holiday Lets: Planning — [Dame Caroline Dinenage in the Chair]** — It is an honour to serve under your tutelage and guidance, Dame Caroline. I pay tribute to the hon. Member for Torbay (Kevin Foster) for securing the debate and
17. [parliamentary/committees-evidence] score=36.738 `committees-evidence:writtenevidence:110503:171614`
    **Reforming the Private Rented Sector — RRS0080** — Written evidence submitted by Mrs Smith [RRS 080] I cannot quote you the laws and the specific changes, but what I can say is that in the position to give someo
18. [parliamentary/pwdata-westminster] score=36.735 `pwdata-westminster:westminster2023-04-19c:63`
    **Future of Social Housing — [Ian Paisley in the Chair]** — It is always a pleasure, Mr Paisley. Here is a scandal: in York over the past four years, just 94 social housing units were developed, in addition to some reset
19. [parliamentary/pwdata-lords] score=36.642 `pwdata-lords:daylord2026-06-01c:176`
    **Social Housing Bill [HL] - Second Reading** — My Lords, I declare my housing interests as a landlord, leaseholder, former renter and co-chair of the All-Party Group on Leasehold and Commonhold Reform. The S
20. [parliamentary/committees-evidence] score=36.619 `committees-evidence:writtenevidence:105123:150646`
    **Sustainable tourism inquiry — TOU0017** — TOU0017 - Evidence on Sustainable tourism TOU0017 Written evidence submitted by Airbnb Introduction Airbnb welcomes the opportunity to contribute our views to t

### B3 (B/H2)
*Query:* Is it illegal to take a photo of someone in public without their permission?
*stream:* legislation · *kind:* specific · *metric:* recall@20
*recall@20:* 0.0% · *MRR:* 0.000

Expected sources:
- ✗ MISS — Sexual Offences Act 2003 ss.67–67A (voyeurism)
- ✗ MISS — Protection from Harassment Act 1997
- ✗ MISS — UK GDPR / DPA 2018

Top-20 retrieved:
 1. [other/petitions] score=108.818↑T `petitions:575513:1`
    **Make it illegal to video or take photos of a disabled person without permission** — Make it illegal to video or take photos of a disabled person without permission State: closed · Signatures: 16 · Opened: 2021-03-11 · Departments: Ministry of J
 2. [other/petitions] score=99.089↑T `petitions:642688:1`
    **Make it illegal to take photos or videos of other people without permission** — Make it illegal to take photos or videos of other people without permission State: closed · Signatures: 35 · Opened: 2023-08-24 · Departments: Department for Cu
 3. [other/petitions] score=94.498↑T `petitions:724817:1`
    **Make it illegal to take photos or videos of minors without consent.** — Make it illegal to take photos or videos of minors without consent. State: rejected · Signatures: 10 It is our responsibility to keep children and young people 
 4. [other/petitions] score=93.807↑T `petitions:635287:1`
    **Make posting photos and videos of children without consent a crime** — Make posting photos and videos of children without consent a crime State: closed · Signatures: 70 · Opened: 2023-03-24 Make posting photos and videos of childre
 5. [other/petitions] score=91.193↑T `petitions:584731:1`
    **Taking Photos of children in a public place without adult consent** — Taking Photos of children in a public place without adult consent State: rejected · Signatures: 7 The law states that photos can be taken in a public place incl
 6. [other/petitions] score=90.633↑T `petitions:750083:1`
    **Make it illegal to take pictures of children and/or faces in public places** — Make it illegal to take pictures of children and/or faces in public places State: rejected · Signatures: 8 To make illegal to take photos of children in public 
 7. [other/petitions] score=89.849↑T `petitions:612293:1`
    **Create a Law on taking video & photos on private property any public place** — Create a Law on taking video & photos on private property any public place State: rejected · Signatures: 6 Create a law on taking photo/videos of private proper
 8. [other/petitions] score=86.215↑T `petitions:770721:1`
    **Protect Children’s Privacy: Ban Strangers Photographing Children Without Consent** — Protect Children’s Privacy: Ban Strangers Photographing Children Without Consent State: rejected · Signatures: 8 Children deserve privacy and protection. Strang
 9. [other/petitions] score=85.196↑T `petitions:655506:1`
    **Make it illegal to take photos of children on private property without consent** — Make it illegal to take photos of children on private property without consent State: closed · Signatures: 16 · Opened: 2024-01-31 · Departments: Department for
10. [other/petitions] score=83.626↑T `petitions:734798:1`
    **Make it illegal to photograph children in public without parental consent** — Make it illegal to photograph children in public without parental consent State: closed · Signatures: 82 · Opened: 2025-08-07 · Departments: Ministry of Justice
11. [guidance/quangos-govuk] score=77.599↑T `quangos-govuk:guidance/data-protection-in-schools/taking-and-using-photos-and-videos-and-using-cctv-in-schools:1`
    **Taking and using photos and videos, and using CCTV in schools** — Schools routinely take and use photos, videos and CCTV to support learning and help keep pupils, staff and visitors safe. Images of individuals who can be ident
12. [other/petitions] score=74.899↑T `petitions:586996:1`
    **Change the law on recording or photographing children in public places.** — Change the law on recording or photographing children in public places. State: rejected · Signatures: 8 Currently in 2021 it is legal for anyone to video record
13. [other/petitions] score=74.595↑T `petitions:635691:1`
    **Make uploading images of minors on social media illegal without parental consent** — Make uploading images of minors on social media illegal without parental consent State: rejected · Signatures: 8 There is currently no law that stops a person f
14. [other/petitions] score=74.362↑T `petitions:575101:1`
    **Make it illegal to post photos of under 16s online** — Make it illegal to post photos of under 16s online State: closed · Signatures: 12 · Opened: 2021-04-14 · Departments: Ministry of Justice It’s about time childr
15. [other/petitions] score=73.496↑T `petitions:764350:1`
    **Make it an offence to use someone's bank card if they're dying in hospital** — Make it an offence to use someone's bank card if they're dying in hospital State: open · Signatures: 46 · Opened: 2026-04-16 · Departments: HM Treasury Current 
16. [guidance/quangos-govuk] score=72.185↑T `quangos-govuk:guidance/how-to-take-a-photo-for-a-visa-application-or-permission:1`
    **How to take a photo for a visa application or permission** — The quality of your digital photo Your photo must be: clear and in focus in colour unaltered by computer software or through other means taken in a well-lit roo
17. [other/petitions] score=71.933↑T `petitions:606826:1`
    **Make maliciously 'outing' someone's sexuality and/or gender identity illegal.** — Make maliciously 'outing' someone's sexuality and/or gender identity illegal. State: rejected · Signatures: 6 To make it illegal for people to 'out' someone for
18. [other/petitions] score=71.827↑T `petitions:550125:1`
    **Make sending unsolicited explicit photos a specific sexual offence** — Make sending unsolicited explicit photos a specific sexual offence State: closed · Signatures: 29 · Opened: 2020-09-08 Categorise the unsolicited sending of sex
19. [other/petitions] score=71.788↑T `petitions:562366:1`
    **Make it illegal and an enforceable act, if someone parks on your owned driveway** — Make it illegal and an enforceable act, if someone parks on your owned driveway State: rejected · Signatures: 15 At the moment if someone parks on your property
20. [guidance/quangos-govuk] score=70.770↑T `quangos-govuk:government/consultations/tackling-illegal-immigration-in-privately-rented-accommodation:3`
    **Tackling illegal immigration in privately rented accommodation: overview of the proposals ** — Tackling illegal immigration in privately rented accommodation Overview of the proposals Introduction The Government is consulting on proposals to require priva

### B4 (B/H1) [BILLS]
*Query:* Statutory duty of candour — who does it bind and where is it heading?
*stream:* legislation · *kind:* specific · *metric:* recall@20
*recall@20:* 100.0% · *MRR:* 1.000

Expected sources:
- ✓ @1 — HSCA 2008 (Regulated Activities) Regs 2014 reg 20
- ✓ @9 — Public Office (Accountability) Bill / Hillsborough Law [BILLS]

Top-20 retrieved:
 1. [parliamentary/pwdata-lords] score=90.303↑T `pwdata-lords:daylord2011-11-07a:129`
    **Health and Social Care Bill — Committee (3rd Day) (Continued)** — My Lords, Amendment 20 would establish a duty of candour so that any provider of National Health Service services would have to inform a patient, or their famil
 2. [parliamentary/pwdata-lords] score=82.680↑T `pwdata-lords:daylord2022-03-22a:24`
    **Police, Crime, Sentencing and Courts Bill - Commons Reasons and Amendments — Motion C** — My Lords, in relation to Motion C, one of the main recommendations of the Daniel Morgan Independent Panel, led by the noble Baroness, Lady O’Loan, was for the p
 3. [parliamentary/pwdata-lords] score=82.479↑T `pwdata-lords:daylord2022-01-17a:121`
    **Police, Crime, Sentencing and Courts Bill - Report (6th Day) — Amendment 114C** — Amendment 114C would place a statutory duty of candour on members of the police workforce. It would create a duty on law enforcement to act at all times in the 
 4. [parliamentary/pwdata-lords] score=80.647↑T `pwdata-lords:daylord2012-02-27a:73`
    **Health and Social Care Bill — Report (3rd Day) — Relevant documents: 18th and 22nd Reports from the ** — My Lords, I remember well the degree of consensus in your Lordships' House when we debated the statutory duty of candour-namely, that everything should be done 
 5. [parliamentary/pwdata-lords] score=80.596↑T `pwdata-lords:daylord2021-11-03b:130`
    **Police, Crime, Sentencing and Courts Bill - Committee (5th Day) — Amendment 130** — My Lords, I thank the noble Lord, Lord Paddick, for introducing this group and referring to his personal experiences on the issue we are debating. The amendment
 6. [parliamentary/niassembly-hansard] score=80.184↑T `niassembly-hansard:416633:374`
    **NI Assembly: Private Members' Business — Statutory Duty of Candour** — In addressing the motion, I will set out the fact that the SDLP has always stood alongside the families who were impacted, be that by Dr Watt or the scandals at
 7. [parliamentary/niassembly-hansard] score=78.929↑T `niassembly-hansard:443696:6`
    **NI Assembly: Members' Statements — Individual Statutory Duty of Candour** — I thank the Speaker for calling me to make a Member's statement about my public consultation on the Bill that I propose to introduce on an individual statutory 
 8. [parliamentary/pwdata-westminster] score=78.733↑T `pwdata-westminster:westminster2010-12-01b:16`
    **[Mr James Gray in the Chair] — Candour in Health Care** — In this particular case, interviews were conducted with the two qualified nurses. The trust did not read both transcripts together and did not see that both nur
 9. [parliamentary/pwdata-westminster] score=78.165↑T `pwdata-westminster:westminster2025-09-03a:77`
    **Duty of Candour for Public Authorities and Legal Representation for Bereaved Families — [Wera Hobhou** — It is a pleasure to speak in this debate. I congratulate my hon. Friend the Member for Liverpool West Derby (Ian Byrne) on securing it. The Government committed
10. [parliamentary/pwdata-lords] score=78.077↑T `pwdata-lords:daylord2024-02-26b:80`
    **Victims and Prisoners Bill - Committee (6th Day) — Amendment 133** — My Lords, there is an urgent need to introduce the duty of candour for those operating across public services such as policing, health, social care and housing.
11. [parliamentary/pwdata-lords] score=78.015↑T `pwdata-lords:daylord2012-02-13a:99`
    **Health and Social Care Bill — Report (2nd Day)** — My Lords, my name is down in support of the amendment. I want to make it clear at the outset that it is substantially different from the amendment put forward i
12. [parliamentary/pwdata-wrans] score=77.301↑T `pwdata-wrans:answers2018-03-20:51`
    **Department of Health and Social Care — NHS: Reviews** — Q (Rosie Cooper): To ask the Secretary State for Health and Social Care, whether the NHS (a) fit and proper person requirement and (b) duty of candour applies t
13. [parliamentary/pwdata-lords] score=76.773↑T `pwdata-lords:daylord2024-02-26b:82`
    **Victims and Prisoners Bill - Committee (6th Day) — Amendment 133** — My Lords, I have signed the amendment and it is a pleasure to follow the noble Lord, Lord Ponsonby, and the right reverend Prelate the Bishop of Manchester. The
14. [parliamentary/niassembly-hansard] score=76.672↑T `niassembly-hansard:416633:362`
    **NI Assembly: Private Members' Business — Statutory Duty of Candour** — I rise to propose our motion calling on the Health Minister to introduce a statutory organisational and individual duty of candour by the end of the mandate. Si
15. [parliamentary/pwdata-lords] score=75.851↑T `pwdata-lords:daylord2024-04-30a:122`
    **Victims and Prisoners Bill - Report (3rd Day) — Amendment 113** — My Lords, I support the amendment tabled by the noble Lord, Lord Ponsonby. My right reverend friend the Bishop of Manchester is also a strong supporter of this 
16. [parliamentary/pwdata-lords] score=75.498↑T `pwdata-lords:daylord2022-01-17a:131`
    **Police, Crime, Sentencing and Courts Bill - Report (6th Day) — Amendment 114C** — I thank all noble Lords who have spoken in the debate, particularly the noble Lord, Lord Paddick, and the noble and learned Lord, Lord Thomas of Cwmgiedd, for a
17. [parliamentary/niassembly-hansard] score=75.493↑T `niassembly-hansard:416633:431`
    **NI Assembly: Private Members' Business — Statutory Duty of Candour** — I thank the Member for her intervention, and I agree. I hear Members say that, even when individuals in HSC are willing to come forward and talk about what went
18. [parliamentary/pwdata-westminster] score=75.244↑T `pwdata-westminster:westminster2010-12-01b:5`
    **[Mr James Gray in the Chair] — Candour in Health Care** — It is a pleasure to serve under your chairmanship this morning, Mr Gray. I congratulate my hon. Friend the Member for Poole (Mr Syms) on securing the debate and
19. [parliamentary/pwdata-wrans] score=74.720↑T `pwdata-wrans:answers2025-10-09:6`
    **Department of Health and Social Care — Mental Health Services: Disclosure of Information** — Q (Cameron Thomas): To ask the Secretary of State for Health and Social Care, whether his Department plans to hold discussions with leaders of mental health ser
20. [parliamentary/pwdata-lords] score=74.500↑T `pwdata-lords:daylord2014-11-05a:134`
    **Health and Social Care Act 2008 (Regulated Activities) Regulations 2014 — Motion to Approve** — My Lords, I am glad, but not surprised, that the noble Lord, Lord Hunt of Kings Heath, has shown such a keen interest in the importance of providing protection 

### B5 (B/H2)
*Query:* What are the rules about how much noise my neighbours can make at night?
*stream:* legislation · *kind:* specific · *metric:* recall@20
*recall@20:* 66.7% · *MRR:* 0.500

Expected sources:
- ✓ @2 — EPA 1990 Part III (statutory nuisance)
- ✓ @8 — Noise Act 1996
- ✗ MISS — Control of Pollution Act 1974 s.60

Top-20 retrieved:
 1. [parliamentary/pwdata-debates] score=105.185↑T `pwdata-debates:debates1996-02-16a:108`
    **PRAYERS — Noise Bill** — I add my congratulations to my hon. Friend the Member for Ealing, North (Mr. Greenway) on introducing the Bill and I appreciate his reasons for not being in the
 2. [parliamentary/pwdata-debates] score=98.734↑T `pwdata-debates:debates1996-02-16a:111`
    **PRAYERS — Noise Bill** — It is a privilege to speak in this debate, which has attracted wide interest both within and outside the House. I compliment my hon. Friend the Member for Ealin
 3. [parliamentary/pwdata-debates] score=97.073↑T `pwdata-debates:debates1992-10-29a:413`
    **PETITION — Noise Pollution** — I am grateful for the opportunity tonight to raise the important issue of neighbourhood noise pollution and to explain some of the work of a dedicated group of 
 4. [parliamentary/pwdata-debates] score=97.017↑T `pwdata-debates:debates2025-12-03g:252`
    **Fireworks (Noise Control etc)** — I beg to move, That leave be given to bring in a Bill to make provision about the maximum noise levels of fireworks which may be sold to the public; to require 
 5. [parliamentary/pwdata-debates] score=96.878↑T `pwdata-debates:debates1990-10-31a:386`
    **Noise Abatement and the Environment** — The hon. Member for Tooting (Mr. Cox) referred to the suffering that noise nuisance causes ordinary people. He was right to put it so strongly. Suffering is ind
 6. [parliamentary/pwdata-debates] score=96.366↑T `pwdata-debates:debates1996-07-12a:35`
    **Orders of the Day — Noise Bill — ADOPTION OF THESE PROVISIONS BY LOCAL AUTHORITIES** — I respectfully point out to my hon. Friend that that is a technical question for our hon. Friend the Minister, rather than for me. I shall leave it to my hon. F
 7. [parliamentary/pwdata-debates] score=95.560↑T `pwdata-debates:debates1996-02-16a:9`
    **PRAYERS — Noise Bill** — Although I accept that, £40 is a reasonable starting level and we should see how it goes. I am looking for a much tougher fine of—perhaps—about £100. Clause 10 
 8. [parliamentary/pwdata-debates] score=95.461↑T `pwdata-debates:debates2002-03-21:338`
    **NOISY NEIGHBOURS** — I wish to dedicate this debate to the memory of the late Spike Milligan, who was the patron of the Right to Peace and Quiet Campaign, predecessor to the Noise N
 9. [parliamentary/pwdata-debates] score=95.235↑T `pwdata-debates:debates2002-03-21:341`
    **NOISY NEIGHBOURS** — I understood that it was a hung council, but I give praise where praise is due. I realise, of course, that going round to see one's neighbour does not always pr
10. [parliamentary/pwdata-debates] score=95.046↑T `pwdata-debates:debates1990-10-31a:385`
    **Noise Abatement and the Environment** — I apologise to my hon. Friend the Minister for the Environment and Countryside in his absence that I was not here for his opening remarks. I was detained in my 
11. [parliamentary/pwdata-debates] score=93.347↑T `pwdata-debates:debates1996-02-16a:115`
    **PRAYERS — Noise Bill** — I welcome this opportunity to make a brief contribution to the Second Reading debate. Before welcoming the Bill, I should like to join other hon. Members in con
12. [parliamentary/pwdata-debates] score=93.165↑T `pwdata-debates:debates2006-03-17b:153`
    **Orders of the Day — Climate Change and Sustainable Energy Bill — Clause 8 — Functions of the Gas and** — I certainly agree, but I have another reservation about amendment No. 13. By specifying some factors, it could be taken that others are excluded—for example, th
13. [parliamentary/pwdata-debates] score=92.786↑T `pwdata-debates:debates1990-10-31a:353`
    **Noise Abatement and the Environment** — I am sorry that the Minister will not be here for the final paragraph of my speech. I should tell the House that he has already warned me that he will not be he
14. [parliamentary/pwdata-debates] score=91.744↑T `pwdata-debates:debates1996-02-16a:110`
    **PRAYERS — Noise Bill** — I understand my hon. Friend's comments about cockerels in a rural environment. However, he must remember that the noise of cockerels in a urban area, where ther
15. [parliamentary/pwdata-debates] score=91.589↑T `pwdata-debates:debates1996-05-10a:138`
    **Orders of the Day — Noise Bill — Return etc of seized equipment** — I congratulate the hon. Member for Ealing, North (Mr. Greenway) on piloting the Bill through the House. Many people up and down the country will welcome it when
16. [parliamentary/pwdata-debates] score=91.567↑T `pwdata-debates:debates1996-05-10a:120`
    **Orders of the Day — Noise Bill — Return etc of seized equipment** — I beg to move, That the Bill be now read the Third time. I should like to thank most warmly colleagues on both sides of the House who have taken such a supporti
17. [parliamentary/pwdata-debates] score=91.466↑T `pwdata-debates:debates1996-07-12a:107`
    **Orders of the Day — Noise Bill — ADOPTION OF THESE PROVISIONS BY LOCAL AUTHORITIES** — If that were the nature of the Bill, it would be taking much more wide-ranging powers than in fact it is. The Bill concentrates very much on neighbour-to-neighb
18. [parliamentary/historic-hansard] score=91.355↑T `historic-hansard:S5LV0224P0:1814`
    **Lords: NOISE ABATEMENT BILL** — LORD TAYLOR : My Lords, my noble friend Lord Morrison of Lambeth asked me to say how sorry he was that he could not be in his place to speak for the Opposition 
19. [parliamentary/pwdata-debates] score=91.243↑T `pwdata-debates:debates1968-07-19a:10`
    **Orders of the Day — CIVIL AVIATION BILL [Lords]** — As the hon. Member for Luton (Mr. Howie) has said, there is grave concern in our part of the country about the extension of flying at Luton Airport. This year, 
20. [parliamentary/pwdata-debates] score=91.078↑T `pwdata-debates:debates1996-02-16a:99`
    **PRAYERS — Noise Bill** — I join other hon. Members in congratulating the hon. Member for Ealing, North (Mr. Greenway) on his success in the ballot and on introducing the Bill, which I a

### C1 (C/H1)
*Query:* Everything currently regulating short-term holiday lets in England
*stream:* legislation + guidance · *kind:* specific · *metric:* recall@20
*recall@20:* 33.3% · *MRR:* 0.063

Expected sources:
- ✗ MISS — Levelling-up and Regeneration Act 2023
- ✗ MISS — Deregulation Act 2015 s.44 (London 90-night)
- ✓ @16 — FHL tax treatment (Finance Act)

Top-20 retrieved:
 1. [parliamentary/pwdata-wrans] score=85.230↑T `pwdata-wrans:answers2022-04-25:654`
    **Department for Digital, Culture, Media and Sport — Holiday Accommodation** — Q (Rachael Maskell): To ask the Secretary of State for Digital, Culture, Media and Sport, whether she has made an assessment of the potential merits of (a) the 
 2. [parliamentary/pwdata-wrans] score=84.757↑T `pwdata-wrans:answers2017-01-25:25`
    **Department for Communities and Local Government — Holiday Accommodation** — Q (Ben Howlett): To ask the Secretary of State for Communities and Local Government, if he will bring forward legislative proposals to enable regulation of shor
 3. [parliamentary/pwdata-wrans] score=84.041↑T `pwdata-wrans:answers2022-04-26:672`
    **Department for Digital, Culture, Media and Sport — Holiday Accommodation** — Q (Rachael Maskell): To ask the Secretary of State for Digital, Culture, Media and Sport, if she will bring forward legislative proposals in the next Parliament
 4. [parliamentary/pwdata-lordswrans] score=83.068↑T `pwdata-lordswrans:lordswrans2018-02-20:61`
    **Ministry of Housing, Communities and Local Government — Holiday Accommodation: Greater London** — Q (baroness gardner of parkes): To ask Her Majesty's Government, further to the Written Answer by Lord Bourne of Aberystwyth on 28 September 2017 (HL1598), what
 5. [parliamentary/pwdata-debates] score=80.656↑T `pwdata-debates:debates2022-12-09d:92`
    **Short-term and Holiday-let Accommodation (Licensing) Bill** — I do. There are many complex issues around this important point, and the hon. Lady highlights one of them. During my time as the Minister for Housing, I was spe
 6. [parliamentary/pwdata-wrans] score=79.301↑T `pwdata-wrans:answers2023-09-04:360`
    **Department for Culture, Media and Sport — Holiday Accommodation** — Q (Rachael Maskell): To ask the Secretary of State for Culture, Media and Sport, if she will make an estimate of the number of short term holiday lets operating
 7. [parliamentary/pwdata-wrans] score=78.773↑T `pwdata-wrans:answers2022-06-24:104`
    **Department for Digital, Culture, Media and Sport — Holiday Accommodation: Age** — Q (Rachael Maskell): To ask the Secretary of State for Digital, Culture, Media and Sport, whether her Department requires owners of short term holiday lets to v
 8. [parliamentary/pwdata-debates] score=78.010↑T `pwdata-debates:debates2022-12-09d:82`
    **Short-term and Holiday-let Accommodation (Licensing) Bill** — I beg to move, That the Bill be now read a Second time. Housing matters. Our communities matter. There can be no greater human right than having shelter, yet in
 9. [parliamentary/pwdata-wrans] score=78.005↑T `pwdata-wrans:answers2022-04-25:641`
    **Department for Digital, Culture, Media and Sport — Holiday Accommodation** — Q (Rachael Maskell): To ask the Secretary of State for Digital, Culture, Media and Sport, if she will make it her policy to enable local authorities to cap the 
10. [parliamentary/pwdata-wrans] score=77.788↑T `pwdata-wrans:answers2022-11-03:518`
    **Department for Digital, Culture, Media and Sport — Holiday Accommodation and Second Homes: Public Co** — Q (Tim Farron): To ask the Secretary of State for Digital, Culture, Media and Sport, when his Department's consultation on second homes and holiday lets will be
11. [parliamentary/pwdata-wrans] score=77.578↑T `pwdata-wrans:answers2022-12-20:440`
    **Department for Digital, Culture, Media and Sport — Holiday Accommodation: Licensing** — Q (Rachael Maskell): To ask the Secretary of State for Digital, Culture, Media and Sport, if she will commission a pilot short term holiday let licensing scheme
12. [parliamentary/pwdata-wrans] score=77.512↑T `pwdata-wrans:answers2022-06-20:206`
    **Department for Digital, Culture, Media and Sport — Holiday Accommodation** — Q (Rachael Maskell): To ask the Secretary of State for Digital, Culture, Media and Sport, if he will introduce a consultation on legislative measures to address
13. [parliamentary/pwdata-wrans] score=77.165↑T `pwdata-wrans:answers2022-04-26:673`
    **Department for Digital, Culture, Media and Sport — Holiday Accommodation** — Q (Rachael Maskell): To ask the Secretary of State for Digital, Culture, Media and Sport, pursuant to the Answer of 19 April 2022 to Question 150212 on Holiday 
14. [parliamentary/pwdata-wrans] score=76.904↑T `pwdata-wrans:answers2024-05-13:331`
    **Department for Culture, Media and Sport — Holiday Accommodation** — Q (Mark Menzies): To ask the Secretary of State for Culture, Media and Sport, if she will make an assessment of the potential impact of differences in the (a) l
15. [parliamentary/pwdata-wrans] score=76.085↑T `pwdata-wrans:answers2022-04-28:421`
    **Department for Digital, Culture, Media and Sport — Holiday Accommodation** — Q (Rachael Maskell): To ask the Secretary of State for Digital, Culture, Media and Sport, if she will consult on licensing short-term holiday lets. A (Nigel Hud
16. [parliamentary/pwdata-lordswrans] score=75.454↑T `pwdata-lordswrans:lordswrans2024-03-21:29`
    **Treasury — Holiday Accommodation and Multiple Occupation: Tax Allowances** — Q (Lord Taylor of Warwick): To ask His Majesty's Government, further to the Budget statement announced by the Chancellor of the Exchequer on 6 March, what asses
17. [parliamentary/pwdata-wrans] score=75.139↑T `pwdata-wrans:answers2023-01-16:625`
    **Department for Digital, Culture, Media and Sport — Holiday Accommodation** — Q (Rachael Maskell): To ask the Secretary of State for Digital, Culture, Media and Sport, with reference to her Department's proposals for a new registration sc
18. [parliamentary/pwdata-lordswrans] score=75.116↑T `pwdata-lordswrans:lordswrans2026-03-11:13`
    **Ministry of Housing, Communities and Local Government — Holiday Accommodation: Regulation** — Q (Lord Truscott): To ask His Majesty's Government when they plan to introduce legislation to regulate short-term let properties. A (Baroness Taylor of Stevenag
19. [parliamentary/pwdata-wrans] score=74.760↑T `pwdata-wrans:answers2022-05-20:191`
    **Department for Digital, Culture, Media and Sport — Holiday Accommodation** — Q (Rachael Maskell): To ask the Secretary of State for Digital, Culture, Media and Sport, what steps she will take to help ensure local planning authorities can
20. [parliamentary/pwdata-wrans] score=74.725↑T `pwdata-wrans:answers2022-04-28:417`
    **Department for Digital, Culture, Media and Sport — Flats: Holiday Accommodation** — Q (Rebecca Long Bailey): To ask the Secretary of State for Digital, Culture, Media and Sport, what recent assessment she has made of the impact of holiday and s

### C2 (C/H2)
*Query:* What laws govern e-scooters?
*stream:* legislation + guidance · *kind:* specific · *metric:* recall@20
*recall@20:* 66.7% · *MRR:* 1.000

Expected sources:
- ✓ @3 — RTA 1988 (motor vehicle classification)
- ✗ MISS — Electrically Assisted Pedal Cycles Regs 1983
- ✓ @1 — e-scooter trial SIs (2020–)

Top-20 retrieved:
 1. [parliamentary/pwdata-lordswrans] score=77.611↑T `pwdata-lordswrans:lordswrans2022-07-28:14`
    **Department for Transport — Electric Scooters** — Q (Baroness Stowell of Beeston): To ask Her Majesty's Government what assessment they have made of the current public understanding regarding the law on e-scoot
 2. [parliamentary/pwdata-lordswrans] score=76.614↑T `pwdata-lordswrans:lordswrans2021-12-16:49`
    **Home Office — Metropolitan Police: Electric Scooters** — Q (Lord Blencathra): To ask Her Majesty's Government what discussions they plan to have, if any, with the Metropolitan Police following their announced decision
 3. [parliamentary/pwdata-wrans] score=76.220↑T `pwdata-wrans:answers2021-10-20:43`
    **Department for Transport — Electric Scooters** — Q (Dr Julian Lewis): To ask the Secretary of State for Transport, what (a) preventive measures and (b) sanctions are in place to ensure that e-scooters are used
 4. [parliamentary/pwdata-lordswrans] score=75.533↑T `pwdata-lordswrans:lordswrans2023-03-29:16`
    **Department for Transport — Electric Scooters: Urban Areas** — Q (Lord Rogan): To ask His Majesty's Government what assessment they have made of whether existing legislation relating to the use of e-scooters in urban areas 
 5. [parliamentary/pwdata-lordswrans] score=74.939↑T `pwdata-lordswrans:lordswrans2021-12-14:13`
    **Department for Transport — Electric Scooters** — Q (Lord Blencathra): To ask Her Majesty's Government what steps they have taken to ensure that retailers are advising their customers of the law regarding the u
 6. [parliamentary/pwdata-wrans] score=74.674↑T `pwdata-wrans:answers2021-07-19:31`
    **Department for Transport — Electric Scooters: Pilot Schemes** — Q (Rachael Maskell): To ask the Secretary of State for Transport, what steps his Department is taking to collect data independently of e-scooter companies on e-
 7. [parliamentary/pwdata-lordswrans] score=74.405↑T `pwdata-lordswrans:lordswrans2023-12-07:25`
    **Department for Transport — Electric Scooters: Regulation** — Q (The Lord Bishop of St Albans): To ask His Majesty's Government what plans they have to strengthen the regulation of e-scooters and e-bikes following the 1,08
 8. [parliamentary/pwdata-lordswrans] score=74.299↑T `pwdata-lordswrans:lordswrans2023-09-20:25`
    **Department for Transport — Bicycles and Electric Scooters: Pedestrian Areas** — Q (Lord Whitty): To ask His Majesty's Government what current laws or regulations govern the (1) use, and (2) parking, of electric, and non-electric, bicycles a
 9. [parliamentary/committees-evidence] score=74.269↑T `committees-evidence:writtenevidence:119500:189889`
    **E-scooters: follow-up — ESF0023** — Written evidence submitted by Guide Dogs for the Blind Association (ESF0023) About Guide Dogs Guide Dogs provides services that support the independence of peop
10. [parliamentary/pwdata-lordswrans] score=74.128↑T `pwdata-lordswrans:lordswrans2024-01-24:28`
    **Home Office — Electric Scooters** — Q (Lord Naseby): To ask His Majesty's Government what steps they are taking to curb the illegal use of e-scooters. A (Lord Sharpe of Epsom): Enforcement of road
11. [parliamentary/pwdata-lordswrans] score=73.991↑T `pwdata-lordswrans:lordswrans2021-11-19:3`
    **Department for Transport — Electric Scooters and cycling: Road Traffic Offences** — Q (Lord Mawson): To ask Her Majesty's Government whether electric scooters are legally required to have lights. A (Baroness Vere of Norbiton): The Government he
12. [parliamentary/pwdata-wrans] score=73.957↑T `pwdata-wrans:answers2020-10-06:15`
    **Department for Transport — Electric Scooters** — Q (Mr Barry Sheerman): To ask the Secretary of State for Transport, what steps he is taking to ensure (a) widespread public understanding of the laws on e-scoot
13. [other/petitions] score=73.870↑T `petitions:727359:1`
    **Urgently regulate e-scooters** — Urgently regulate e-scooters State: closed · Signatures: 31487 · Opened: 2025-06-18 · Departments: Department for Transport We are calling on the government to 
14. [parliamentary/pwdata-lordswrans] score=73.797↑T `pwdata-lordswrans:lordswrans2026-03-30:72`
    **Department for Transport — Electric Bicycles and Electric Scooters: Sales** — Q (Baroness McIntosh of Pickering): To ask His Majesty's Government what assessment they have made of the unrestricted sale of e-scooters and e-bikes that do no
15. [parliamentary/pwdata-wrans] score=73.514↑T `pwdata-wrans:answers2025-12-11:344`
    **Department for Transport — Electric Scooters: Regulation** — Q (Anneliese Dodds): To ask the Secretary of State for Transport, what steps she is taking to regulate the sale and purchase of private escooters. A (Simon Ligh
16. [parliamentary/pwdata-wrans] score=73.447↑T `pwdata-wrans:answers2025-10-14:91`
    **Department for Transport — Electric Scooters: Regulation** — Q (Helen Maguire): To ask the Secretary of State for Transport, what assessment she has made of the potential merits of a public awareness campaign on the law r
17. [parliamentary/pwdata-lordswrans] score=73.357↑T `pwdata-lordswrans:lordswrans2022-07-28:12`
    **Department for Transport — Electric Scooters** — Q (Baroness Stowell of Beeston): To ask Her Majesty's Government what assessment they made of law enforcement against illegal use of private e-scooters on publi
18. [parliamentary/pwdata-lordswrans] score=73.118↑T `pwdata-lordswrans:lordswrans2023-06-27:57`
    **Department for Transport — Bicycles and Electric Scooters: Motorways** — Q (Lord Blencathra): To ask His Majesty's Government what discussions they plan to hold with the police regarding the enforcement of section 148(c) of the Highw
19. [parliamentary/pwdata-wrans] score=73.113↑T `pwdata-wrans:answers2023-03-01:163`
    **Home Office — Electric Scooters** — Q (Stephen Morgan): To ask the Secretary of State for the Home Department, what steps she is taking to help ensure (a) consistency and (b) effectiveness of poli
20. [parliamentary/pwdata-wrans] score=72.968↑T `pwdata-wrans:answers2022-02-21:303`
    **Department for Transport — Electric Scooters** — Q (Sir Greg Knight): To ask the Secretary of State for Transport, what policies he plans to introduce to (a) tackle the potential dangers caused by e-scooter us

### C3 (C/H1) [INFORCE]
*Query:* The statutory framework for adult social care funding in England
*stream:* legislation + guidance · *kind:* specific · *metric:* recall@20
*recall@20:* 33.3% · *MRR:* 0.063

Expected sources:
- ✗ MISS — Care Act 2014 Part 1 (ss.14–18)
- ✗ MISS — Care and Support (Charging) Regs 2014
- ✓ @16 — cap provisions / commencement [INFORCE]

Top-20 retrieved:
 1. [guidance/nao-reports] score=100.263↑T `nao-reports:adult-social-care-england-overview-2:3`
    **adult social care england overview 2** — Social care for adults in England: overview Online appendices Department of Health Department of Communities and Local Government Report by the Comptroller and 
 2. [parliamentary/committees-reports] score=99.631↑T `committees-reports:publication:43227:215117`
    **Correspondence: Public Accounts Committee hearing: Reforming Adult Social Care in England, 24 Januar** — 01 February 2024 Dear Chair, RE: Public Accounts Committee hearing: Reforming Adult Social Care in England, 24 January 2024 During the hearing of the committee 
 3. [parliamentary/pwdata-wrans] score=92.767↑T `pwdata-wrans:answers2018-06-05:21`
    **Department of Health and Social Care — Better Care Fund** — Q (Diana Johnson): To ask the Secretary of State for Health and Social Care, with reference to the innovation and Better Care Fund element of the additional £2 
 4. [parliamentary/pwdata-wrans] score=90.638↑T `pwdata-wrans:answers2025-11-26:117`
    **Department of Health and Social Care — Hospices: Contracts** — Q (Dr Ellie Chowns): To ask the Secretary of State for Health and Social Care, what steps he is taking to ensure a sustainable funding settlement for hospice an
 5. [parliamentary/pwdata-wrans] score=90.561↑T `pwdata-wrans:answers2026-01-28:181`
    **Department of Health and Social Care — Hospices: Finance** — Q (Joe Robertson): To ask the Secretary of State for Health and Social Care, what proportion of hospice funding for dementia end-of-life care is provided by cen
 6. [parliamentary/committees-evidence] score=90.473↑T `committees-evidence:writtenevidence:134717:235616`
    **The Armed Forces Covenant — AFC0022** — AFC0022 Written evidence submitted by Royal Star and Garter. Background Royal Star & Garter (charity number 210119) provides care for veterans and their partner
 7. [parliamentary/pwdata-wrans] score=90.320↑T `pwdata-wrans:answers2022-07-18:85`
    **Department of Health and Social Care — Continuing Care: Finance** — Q (Catherine West): To ask the Secretary of State for Health and Social Care, if he will provide additional funding to NHS Continuing Care in the context of inc
 8. [parliamentary/pwdata-lordswrans] score=90.278↑T `pwdata-lordswrans:lordswrans2017-02-20:58`
    **Department of Health — Social Services** — Q (the marquess of lothian): To ask Her Majesty’s Government how many elderly people in the UK presently require social care; what is their estimate of the incr
 9. [parliamentary/pwdata-wrans] score=90.091↑T `pwdata-wrans:answers2026-02-23:401`
    **Department of Health and Social Care — Respite Care: Parents** — Q (Jim Shannon): To ask the Secretary of State for Health and Social Care, whether he is providing additional resources for respite care for parents. A (Stephen
10. [parliamentary/pwdata-wrans] score=89.790↑T `pwdata-wrans:answers2026-03-02:683`
    **Department of Health and Social Care — Dementia: Training** — Q (Jenny Riddell-Carpenter): To ask the Secretary of State for Health and Social Care, what steps he is taking to improve dementia training for adult social car
11. [parliamentary/pwdata-wrans] score=89.714↑T `pwdata-wrans:answers2026-01-05:180`
    **Department of Health and Social Care — Hospices: Finance** — Q (Joe Robertson): To ask the Secretary of State for Health and Social Care, whether the Department plans to review the level of statutory funding provided to h
12. [parliamentary/pwdata-wrans] score=89.537↑T `pwdata-wrans:answers2025-10-22:153`
    **Department of Health and Social Care — Older People: Advocacy** — Q (Neil Duncan-Jordan): To ask the Secretary of State for Health and Social Care, whether his Department has made an assessment of the potential merits of appoi
13. [parliamentary/pwdata-wrans] score=89.173↑T `pwdata-wrans:answers2026-04-28:390`
    **Department of Health and Social Care — Care Homes: Dementia** — Q (Suella Braverman): To ask the Secretary of State for Health and Social Care, whether his Department is considering reform of the residential care funding fra
14. [parliamentary/pwdata-lordswrans] score=88.858↑T `pwdata-lordswrans:lordswrans2026-06-05:7`
    **Department of Health and Social Care — Social Services: Artificial Intelligence** — Q (Lord Taylor of Warwick): To ask His Majesty's Government what assessment they have made of the use of AI technologies in residential care settings to reduce 
15. [parliamentary/pwdata-wrans] score=88.841↑T `pwdata-wrans:answers2011-04-04a:272`
    **HEALTH — Social Services** — Q (Robert Syms): To ask the Secretary of State for Health what plans he has for improvement of the social care system. A (Paul Burstow): "A Vision for Adult Soc
16. [parliamentary/committees-evidence] score=88.828↑T `committees-evidence:writtenevidence:132521:230199`
    **Adult Social Care Reform: The Cost of Inaction — ASC0101** — Written evidence submitted by The Chartered Institute of Public Finance and Accountancy (ASC0101) Adult social care reform : the cost of inaction Call for evide
17. [parliamentary/pwdata-wrans] score=88.586↑T `pwdata-wrans:answers2018-05-21:76`
    **Department of Health and Social Care — Social Services: Finance** — Q (Jonathan Ashworth): To ask the Secretary of State for Health and Social Care, whether NHS England is legally required to ring fence any part of its allocatio
18. [parliamentary/pwdata-wrans] score=88.237↑T `pwdata-wrans:answers2015-10-20:241`
    **Department of Health — Palliative Care** — Q (Sir Nicholas Soames): To ask the Secretary of State for Health, when he plans to publish an updated end of life care strategy; and if he will make a statemen
19. [parliamentary/committees-evidence] score=88.053↑T `committees-evidence:writtenevidence:133246:230279`
    **Adult Social Care Reform: The Cost of Inaction — ASC0129** — Written evidence submitted by Centre for Mental Health (ASC0129) Centre for Mental Health submission to the Health and Adult Socia l Care Select Committee’s adu
20. [parliamentary/pwdata-wrans] score=87.952↑T `pwdata-wrans:answers2026-04-13:450`
    **Department of Health and Social Care — Hospices: Finance** — Q (Alex Ballinger): To ask the Secretary of State for Health and Social Care, what assessment she has made of potential shortfalls in funding for service delive

### C4 (C/H1)
*Query:* What duties do water companies have about sewage discharges, and where do they come from?
*stream:* legislation + guidance · *kind:* specific · *metric:* recall@20
*recall@20:* 66.7% · *MRR:* 1.000

Expected sources:
- ✓ @9 — Water Industry Act 1991 (s.94 etc.)
- ✓ @1 — Environment Act 2021 storm overflow duties
- ✗ MISS — Urban Waste Water Treatment Regs 1994

Top-20 retrieved:
 1. [parliamentary/pwdata-debates] score=127.808↑T `pwdata-debates:debates2021-10-20c:331`
    **Environment Bill — After Clause 72 - Protection of pollinators from pesticides** — I wanted to speak on interim targets in the first group of amendments, but given the time constraints, I have saved myself for sewage. I rise to support the Duk
 2. [other/petitions] score=123.614↑T `petitions:582336:1`
    **Ban Water Companies discharging raw sewage into water courses.** — Ban Water Companies discharging raw sewage into water courses. State: closed · Signatures: 111428 · Opened: 2021-04-12 · Departments: Department for Environment
 3. [parliamentary/pwdata-westminster] score=119.753↑T `pwdata-westminster:westminster2021-11-15b:61`
    **Water Companies: Sewage Discharge — [Ian Paisley in the Chair]** — If the right hon. Member had waited for the rest of my sentence, she would have found that I agree with her about certain bits of that assessment, because on th
 4. [parliamentary/pwdata-wrans] score=119.099↑T `pwdata-wrans:answers2021-10-27:220`
    **Department for Environment, Food and Rural Affairs — Rivers: Sewage** — Q (Feryal Clark): To ask the Secretary of State for Environment, Food and Rural Affairs, what recent steps his Department has taken to help ensure untreated sew
 5. [parliamentary/pwdata-westminster] score=118.477↑T `pwdata-westminster:westminster2021-01-13a:33`
    **Rivers: Discharges** — It is a pleasure to be here with you this morning, Dame Angela, albeit with a very small crowd. I congratulate the hon. Member for Blaydon (Liz Twist) on securi
 6. [parliamentary/pwdata-debates] score=117.421↑T `pwdata-debates:debates2023-12-05b:353`
    **Water Companies: Executive Bonuses** — We have such a strong plan and it will be fully operational. I completely support the Government with the line they took last night. I am lined up with what we 
 7. [parliamentary/pwdata-debates] score=117.399↑T `pwdata-debates:debates2023-04-25c:281`
    **Water Quality: Sewage Discharge** — I stand with the people of beautiful Hastings and Rye, who are all quite rightly angry about the extent of water companies’ excessive use of overflows. Only the
 8. [parliamentary/pwdata-lords] score=116.201↑T `pwdata-lords:daylord2022-07-07b:110`
    **Sewage Disposal in Rivers and Coastal Waters - Motion to Take Note** — I do not agree with that. I also believe it is good that international sovereign wealth funds want to invest in our regulated utility sector, but it has to be a
 9. [parliamentary/committees-evidence] score=115.913↑T `committees-evidence:writtenevidence:25995:54889`
    **Water Quality in Rivers — WQR0085** — Salmon & Trout Conservation WQR0085 Additional written evidence from Salmon & Trout Conservation Rt Hon Philip Dunne MP Chair Environment Audit Committee Dear C
10. [parliamentary/pwdata-debates] score=114.856↑T `pwdata-debates:debates2021-10-27a:232`
    **Sewage Pollution: Whitburn** — I thank the hon. Member for that. There has been no U-turn whatever. As I said, we have six pages of clauses in the Environment Bill committing to reducing sewa
11. [parliamentary/pwdata-wrans] score=114.716↑T `pwdata-wrans:answers2025-03-27:152`
    **Department for Environment, Food and Rural Affairs — Sewage: Surrey Heath** — Q (Dr Al Pinkerton): To ask the Secretary of State for Environment, Food and Rural Affairs, what assessment his Department has made of the potential merits of r
12. [parliamentary/pwdata-wrans] score=114.197↑T `pwdata-wrans:answers2024-03-08:27`
    **Department for Environment, Food and Rural Affairs — Sewage: Rivers** — Q (Rachael Maskell): To ask the Secretary of State for Environment, Food and Rural Affairs, what steps is he taking to neutralise sewage in rivers. A (Robbie Mo
13. [parliamentary/pwdata-debates] score=113.875↑T `pwdata-debates:debates2021-10-20c:298`
    **Environment Bill — After Clause 72 - Protection of pollinators from pesticides** — I thank my hon. Friend. This is an important issue and we have thought about it. The Government will come back and report on the costs and benefits; we are doin
14. [parliamentary/pwdata-lordswrans] score=113.839↑T `pwdata-lordswrans:lordswrans2022-02-17:30`
    **Department for Environment, Food and Rural Affairs — Water Companies: Pollution** — Q (Baroness Jones of Whitchurch): To ask Her Majesty's Government what recent discussions they have had with Ofwat about the powers it has to take action agains
15. [parliamentary/pwdata-lords] score=113.669↑T `pwdata-lords:daylord2023-05-18a:188`
    **Levelling-up and Regeneration Bill - Committee (13th Day) — Amendment 390** — My Lords, apart from the Government, I have the bulk of the other amendments in this group so I thought I would go through them now. I thank the noble Baroness,
16. [parliamentary/pwdata-lordswrans] score=113.516↑T `pwdata-lordswrans:lordswrans2021-11-01:30`
    **Department for Environment, Food and Rural Affairs — Beaches: South East** — Q (Baroness Redfern): To ask Her Majesty's Government what assessment they have made of the release of sewage at beaches in south-east England by Southern Water
17. [parliamentary/pwdata-debates] score=113.254↑T `pwdata-debates:debates2021-10-27a:234`
    **Sewage Pollution: Whitburn** — I am very well aware of that, but it was the hon. Member who started on all these other, much wider areas, so I thought I would set the record straight. The poi
18. [parliamentary/pwdata-lords] score=113.122↑T `pwdata-lords:daylord2022-07-07b:112`
    **Sewage Disposal in Rivers and Coastal Waters - Motion to Take Note** — The noble Baroness may well be right. I agree that there probably needs to be a change. Just behind us, the River Thames is subject to storm overflows that we a
19. [parliamentary/pwdata-wrans] score=112.973↑T `pwdata-wrans:answers2022-10-11:170`
    **Department for Environment, Food and Rural Affairs — Water Companies: Pollution** — Q (Mr Virendra Sharma): To ask the Secretary of State for Environment, Food and Rural Affairs, what assessment his Department has made of the efficacy of the fi
20. [parliamentary/pwdata-westminster] score=112.446↑T `pwdata-westminster:westminster2021-11-15b:25`
    **Water Companies: Sewage Discharge — [Ian Paisley in the Chair]** — I beg to move, That this House has considered e-petition 582336, relating to the discharge of sewage by water companies. It is a pleasure to serve under your ch

### C5 (C/H2)
*Query:* What protections do people who live in park homes / mobile homes have?
*stream:* legislation + guidance · *kind:* specific · *metric:* recall@20
*recall@20:* 100.0% · *MRR:* 1.000

Expected sources:
- ✓ @1 — Mobile Homes Act 1983
- ✓ @2 — Mobile Homes Act 2013
- ✓ @15 — Caravan Sites Act 1968

Top-20 retrieved:
 1. [legislation/si-2010plus] score=147.313↑T `si-2010plus:uksi/2012/2466:article-7`
    **Residential mobile homes** — 7 In Part 7 of Schedule 3 to the Act, after paragraph 30C insert— Residential mobile homes 30D 1 A person (A) who is the owner of a protected site does not cont
 2. [parliamentary/pwdata-westminster] score=95.565↑T `pwdata-westminster:westminster2019-02-27a:126`
    **Residents of Leisure Park Homes** — It is a pleasure to serve under your chairmanship, Mr Austin. I congratulate my hon. Friend the Member for Faversham and Mid Kent (Helen Whately) on securing th
 3. [parliamentary/pwdata-debates] score=93.204↑T `pwdata-debates:debates2012-07-02c:79`
    **COMMUNITIES AND LOCAL GOVERNMENT — Park Homes** — I belong to the all-party mobile homes group, and we have been campaigning for years to strengthen the hand of local authorities to enforce properly the licence
 4. [parliamentary/pwdata-westminster] score=90.903↑T `pwdata-westminster:westminster2026-04-28b:35`
    **Park Home Owners — [Sir Alec Shelbrooke in the Chair]** — It is a pleasure to serve under your chairmanship, Sir Alec. I have been involved with the park homes issue for the best part of 30 years; I have 2,000 people i
 5. [parliamentary/pwdata-debates] score=90.857↑T `pwdata-debates:debates1983-05-05a:244`
    **Orders of the Day — Mobile Homes Bill [Lords] — PARTICULARS OF AGREEMENTS** — My hon. Friend is right. Any reference to legislation will have to mention the Mobile Homes Act 1975 or 1983. None the less, the designation of the site, which 
 6. [parliamentary/pwdata-debates] score=90.583↑T `pwdata-debates:debates2010-12-16b:349`
    **Backbench Business — [14(th) Allotted Day] — Park Homes** — I thank you, Madam Deputy Speaker, for giving me the opportunity to speak in this debate, and I congratulate my hon. Friend the Member for Mid Dorset and North 
 7. [parliamentary/pwdata-westminster] score=90.368↑T `pwdata-westminster:westminster2026-04-28b:9`
    **Park Home Owners — [Sir Alec Shelbrooke in the Chair]** — I trust that the Minister and his team will do exactly that. This is not just about the 10% sales commission; there are broader issues impacting park home resid
 8. [other/petitions] score=88.984↑T `petitions:701798:1`
    **Review the enforcement policy guidance for LAs to protect mobile home owners.** — Review the enforcement policy guidance for LAs to protect mobile home owners. State: closed · Signatures: 1634 · Opened: 2024-12-18 · Departments: Ministry of H
 9. [parliamentary/pwdata-debates] score=88.342↑T `pwdata-debates:debates1982-07-09a:202`
    **Copyright Act 1956 (Amendment) Bill [Lords] — Mobile Home Owners** — I am extremely grateful to my hon. and learned Friend the Member for Hemel Hempstead (Mr. Lyell) for allowing me to contribute briefly to the debate because, li
10. [parliamentary/pwdata-debates] score=88.206↑T `pwdata-debates:debates1975-02-28a:83`
    **Orders of the Day — MOBILE HOMES BILL** — I point out to the hon. Member for Chester-le-Street (Mr. Radice) that for many hon. Members the Bill is a measure of the utmost importance. My hon. Friend the 
11. [parliamentary/pwdata-westminster] score=88.057↑T `pwdata-westminster:westminster2026-04-28b:3`
    **Park Home Owners — [Sir Alec Shelbrooke in the Chair]** — Absolutely. I am sure that we will talk a lot about the 10% sales commission, but the hon. Member is right to raise it early on. I am pleased that the Minister 
12. [parliamentary/pwdata-lords] score=87.943↑T `pwdata-lords:daylord2013-02-01a:35`
    **Mobile Homes Bill — Second Reading** — My Lords, I follow the noble Lord, Lord Best, with great pleasure. I endorse all that he said. We are very much in his debt for piloting this Bill through your 
13. [parliamentary/pwdata-debates] score=87.206↑T `pwdata-debates:debates1999-04-21a:27`
    **Park Homes** — I commend the hon. Gentleman for raising that issue, and I share his concern. Personally, I feel that the issues relating to holiday parks are even more complex
14. [parliamentary/pwdata-lords] score=86.326↑T `pwdata-lords:daylord2000-10-04a:276`
    **Park Home Owners** — My Lords, I am grateful to the noble Lord, Lord Graham of Edmonton, for the opportunity to debate the Report of the Park Homes Working Party on the welfare of p
15. [parliamentary/pwdata-debates] score=86.001↑T `pwdata-debates:debates1999-04-21a:32`
    **Park Homes** — I congratulate the hon. Member for Lancaster and Wyre (Mr. Dawson) on securing today's Adjournment debate and dealing comprehensively with some of the problems 
16. [parliamentary/pwdata-westminster] score=85.919↑T `pwdata-westminster:westminster2019-02-27a:135`
    **Residents of Leisure Park Homes** — I agree with that completely. The poor form tarnishes the whole industry, and people who are doing things well do not, on the whole, object to changes to regula
17. [parliamentary/historic-hansard] score=85.179↑T `historic-hansard:S5LV0437P0:116`
    **Lords: Mobile Homes Bill [H.L.]** — Lord Avebury : I do not want to prolong this discussion. However, one point that has not been mentioned is the reluctance of the local authorities to grant plan
18. [parliamentary/pwdata-debates] score=84.745↑T `pwdata-debates:debates1983-05-05a:234`
    **Orders of the Day — Mobile Homes Bill [Lords] — PARTICULARS OF AGREEMENTS** — Like you, Mr. Deputy Speaker, I have recently participated in two very late night sittings on the Police and Criminal Evidence Bill, and I am conscious that Mem
19. [parliamentary/pwdata-debates] score=84.380↑T `pwdata-debates:debates2012-10-19b:18`
    **Mobile Homes Bill** — I am absolutely delighted to follow the hon. Member for Waveney (Peter Aldous) . I am very pleased that he has chosen this subject for his Bill, and I hope that
20. [parliamentary/pwdata-debates] score=84.102↑T `pwdata-debates:debates2010-12-16b:379`
    **Backbench Business — [14(th) Allotted Day] — Park Homes** — I pay tribute to the hon. Member for Mid Dorset and North Poole (Annette Brooke) , who has been an indefatigable champion of park home residents for a number of

### D1 (D/H1) [GRAPH] — ENGINE FLOOR
*Query:* What has amended section 21 of the Housing Act 1988 since 2015?
*stream:* citation graph · *kind:* specific · *metric:* recall@20
*recall@20:* 50.0% · *MRR:* 0.167

Expected sources:
- ✗ MISS — Deregulation Act 2015 ss.33–41
- ✓ @6 — Renters’ Rights Act 2025 (prospective repeal)

Top-20 retrieved:
 1. [legislation/primary-acts-pre-2000] score=133.981↑R `primary-acts-pre-2000:ukpga/1988/50:section-21`
    **Recovery of possession on expiry or termination of assured shorthold tenancy.** — 21 1 Without prejudice to any right of the landlord under an assured shorthold tenancy to recover possession of the dwelling-house let on the tenancy in accorda
 2. [legislation/primary-acts-2000plus] score=132.981↑T `primary-acts-2000plus:ukpga/2004/34:section-215C`
    **Sections 215A and 215B: transitional provisions** — 215C 1 Sections 215A and 215B are treated as having had effect since 6 April 2007, subject to the following provisions of this section. 2 Sections 215A and 215B
 3. [legislation/primary-acts-2000plus] score=114.535↑T `primary-acts-2000plus:ukpga/2004/34:section-98`
    **Other consequences of operating unlicensed houses: restriction on terminating tenancies (England)** — 98 1 No section 21 notice may be given in relation to a shorthold tenancy of the whole or part of an unlicensed house so long as it remains such a house. 2 In t
 4. [legislation/primary-acts-2000plus] score=111.242↑T `primary-acts-2000plus:ukpga/2004/34:section-75`
    **Other consequences of operating unlicensed HMOs: restriction on terminating tenancies (England)** — 75 1 No section 21 notice may be given in relation to a shorthold tenancy of a part of an unlicensed HMO so long as it remains such an HMO. 2 In this section— a
 5. [legislation/explanatory-notes] score=110.014↑T `explanatory-notes:en:ukpga/2015/20:1`
    **Explanatory Notes: ukpga/2015/20** — EXPLANATORY NOTES Deregulation Act 2015 Chapter 20 £23.25 These notes refer to the Deregulation Act 2015 (c. 20) which received Royal Assent on 26 March 2015 1 
 6. [legislation/primary-acts-2000plus] score=109.372↑T `primary-acts-2000plus:ukpga/2025/26:section-134`
    **Use by local housing authority of certain information** — 134 1 Section 212A of the Housing Act 2004 (tenancy deposit schemes: provision of information to local authorities) is amended in accordance with subsections (2
 7. [parliamentary/pwdata-wrans] score=79.439↑T `pwdata-wrans:answers2019-05-08:165`
    **Ministry of Housing, Communities and Local Government — Private Rented Housing: Evictions** — Q (Sir David Evennett): To ask the Secretary of State for Housing, Communities and Local Government, what deterrents are in place to stop rogue landlords illega
 8. [parliamentary/pwdata-wrans] score=78.997↑T `pwdata-wrans:answers2019-04-02:181`
    **Ministry of Housing, Communities and Local Government — Private Rented Housing: Safety** — Q (Mr Clive Betts): To ask the Secretary of State for Housing, Communities and Local Government, what assessment his Department has made of the potential merits
 9. [parliamentary/pwdata-wrans] score=78.894↑T `pwdata-wrans:answers2017-10-25:15`
    **Department for Communities and Local Government — Private Rented Housing: Evictions** — Q (Andrew Gwynne): To ask the Secretary of State for Communities and Local Government, what protections exist for (a) vulnerable tenants and (b) people in recei
10. [parliamentary/pwdata-wrans] score=78.753↑T `pwdata-wrans:answers2017-03-23:144`
    **Department for Communities and Local Government — Private Rented Housing** — Q (Richard Burden): To ask the Secretary of State for Communities and Local Government, what steps his Department is taking to protect tenants in the private re
11. [parliamentary/pwdata-wrans] score=77.846↑T `pwdata-wrans:answers2019-07-24:105`
    **Ministry of Housing, Communities and Local Government — Evictions** — Q (Andrew Rosindell): To ask the Secretary of State for Housing, Communities and Local Government, what his Department's definition is of eviction at short noti
12. [parliamentary/pwdata-wrans] score=77.526↑T `pwdata-wrans:answers2020-10-20:272`
    **Ministry of Housing, Communities and Local Government — Private Rented Housing: Evictions** — Q (Tim Farron): To ask the Secretary of State for Housing, Communities and Local Government, what estimate he has made of the number of Section 21 eviction noti
13. [parliamentary/pwdata-lordswrans] score=77.394↑T `pwdata-lordswrans:lordswrans2019-04-04:19`
    **Ministry of Housing, Communities and Local Government — Private Rented Housing: Safety** — Q (lord tope): To ask Her Majesty's Government what assessment they have made of whether landlords and letting agents should be prevented from renting propertie
14. [parliamentary/senedd-cofnod] score=75.673↑T `senedd-cofnod:5572:121`
    **Senedd Plenary: Amending Section 21 of the Housing Act 1988** — 4. What plans does the Welsh Government have to amend Section 21 of the Housing Act 1988 to give people who privately rent homes more secure tenancies? OAQ53675
15. [parliamentary/historic-hansard] score=74.977↑T `historic-hansard:S5LV0574P0:3728`
    **Lords: Housing Bill** — Lord Lucas moved Amendment No. 95: Page 134, leave out lines 3 to 10 and insert— ("(a) amendments or repeals of provisions of the Housing Associations Act 1985,
16. [parliamentary/pwdata-lords] score=74.227↑T `pwdata-lords:daylord2004-10-20a:368`
    **Housing Bill** — My Lords, the problem with housing Bills not coming along very often is that people take the opportunity to raise issues that are of the day and need dealing wi
17. [parliamentary/pwdata-wrans] score=73.601↑T `pwdata-wrans:answers2023-03-30:12`
    **Department for Levelling Up, Housing and Communities — Evictions** — Q (Kerry McCarthy): To ask the Secretary of State for Levelling Up, Housing and Communities, what plans he has to abolish section 21 of the Housing Act 1988.
18. [parliamentary/pwdata-debates] score=73.428↑T `pwdata-debates:debates2014-05-14d:269`
    **DEREGULATION BILL (PROGRAMME) (NO. 2) — Schedule 18 — Legislation no longer of practical use** — Amendments made: 75, page 159, line 32, at end insert— ‘Merchant Shipping Act 1988 (c. 12) The Merchant Shipping Act 1988 is repealed.’. This amendment repeals 
19. [parliamentary/pwdata-lordswrans] score=73.079↑T `pwdata-lordswrans:lordswrans2020-09-21:42`
    **Ministry of Housing, Communities and Local Government — Private Rented Housing: Coronavirus** — Q (Baroness Grender): To ask Her Majesty's Government what estimate they have made of the number of private rented sector tenants who are in arrears due to the 
20. [parliamentary/pwdata-lordswrans] score=73.068↑T `pwdata-lordswrans:lordswrans2019-10-02:13`
    **Ministry of Housing, Communities and Local Government — Private Rented Housing: Older People** — Q (the marquess of lothian): To ask Her Majesty's Government how many tenants over the age of 60 currently live in private rental accommodation; whether this pr

### D2 (D/H1) [GRAPH] — ENGINE FLOOR
*Query:* List the statutory instruments made under the Building Safety Act 2022
*stream:* citation graph · *kind:* specific · *metric:* recall@20
*recall@20:* 100.0% · *MRR:* 1.000

Expected sources:
- ✓ @1 — Building Safety Act 2022
- ✓ @1 — Higher-Risk Buildings regs

Top-20 retrieved:
 1. [legislation/primary-acts-pre-2000] score=159.738↑T `primary-acts-pre-2000:ukpga/1985/70:section-20F`
    **Limitation of service charges: excluded costs for higher-risk buildings** — 20F 1 This section applies in relation to a lease to which section 30D (higher-risk buildings: building safety costs) applies. 2 Excluded costs are not to be re
 2. [legislation/primary-acts-pre-2000] score=137.837↑T `primary-acts-pre-2000:ukpga/1985/70:section-30D`
    **Liability for building safety costs** — 30D 1 This section applies to a relevant lease of premises which consist of or include a dwelling in a higher-risk building. 2 In this section “relevant lease”—
 3. [legislation/explanatory-memoranda] score=132.801↑T `explanatory-memoranda:em:uksi/2022/1181:1`
    **Explanatory Memorandum: uksi/2022/1181** — 1 CO/EM/2022.3 EXPLANATORY MEMORANDUM TO EMPLOYMENT TRIBUNALS ACT 1996 (APPLICATION OF CONCILIATION PROVISIONS) ORDER 2022 2022 No. 1181 1. Introduction 1.1 Thi
 4. [legislation/primary-acts-2000plus] score=130.364↑T `primary-acts-2000plus:ukpga/2023/55:section-130`
    **Regulations and orders under the Planning Acts** — 130 1 In section 333 of TCPA 1990 (regulations and orders)— a after subsection (2A) insert— 2B Regulations made under this Act may make consequential, supplemen
 5. [legislation/primary-acts-2000plus] score=127.321↑T `primary-acts-2000plus:ukpga/2022/30:section-110`
    **Managers appointed under Part 2 of the Landlord and Tenant Act 1987** — 110 1 Section 24 of the Landlord and Tenant Act 1987 (appointment of a manager by a tribunal) is amended as follows. 2 After subsection (2ZA) insert— 2ZB Subsec
 6. [legislation/explanatory-memoranda] score=125.416↑T `explanatory-memoranda:em:uksi/2022/1393:1`
    **Explanatory Memorandum: uksi/2022/1393** — 1 CO/EM/2022.3 EXPLANATORY MEMORANDUM TO THE PRODUCT SAFETY AND METROLOGY (AMENDMENT AND TRANSITIONAL PROVISIONS) REGULATIONS 2022 2022 No. 1393 1. Introduction
 7. [legislation/primary-acts-pre-2000] score=124.824↑T `primary-acts-pre-2000:ukpga/1997/9:section-73F`
    **Applications for listed building or conservation area consent by Crown** — 73F 1 This section applies to an application for— a listed building consent, or b conservation area consent, made by or on behalf of the Crown. 2 The Scottish M
 8. [legislation/explanatory-memoranda] score=123.234↑T `explanatory-memoranda:em:uksi/2022/1182:1`
    **Explanatory Memorandum: uksi/2022/1182** — 1 CO/EM/2022.3 EXPLANATORY MEMORANDUM TO THE AMMONIUM NITRATE MATERIALS (HIGH NITROGEN CONTENT) SAFETY (AMENDMENT) (NO. 2) REGULATIONS 2022 2022 No. 1182 1. Int
 9. [legislation/explanatory-memoranda] score=123.142↑T `explanatory-memoranda:em:uksi/2022/1403:1`
    **Explanatory Memorandum: uksi/2022/1403** — 1 CO/EM/2022.3 EXPLANATORY MEMORANDUM TO THE NON-DOMESTIC RATING (CHARGEABLE AMOUNTS) (ENGLAND) REGULATIONS 2022 2022 No. 1403 1. Introduction 1.1 This explanat
10. [parliamentary/committees-reports] score=90.227↑T `committees-reports:publication:39125:192317`
    **Report: Thirty-Third Report of Session 2022–23 - 4 Statutory Instruments Reported** — House of Lords House of Commons Joint Committee on Statutory Instruments Thirty-Third Report of Session 2022–23 Drawing special attention to: Building Safety Ac
11. [parliamentary/committees-reports] score=85.056↑T `committees-reports:publication:22608:166326`
    **Correspondence: Letter from the Minister for Building Safety and Fire to the Chair dated 1 June 2022** — Clive Betts MP Chair of the Levelling Up Housing & Communities Select Committee. House of Commons London SW1A 0AA Dear Clive, STRENGTHENING BUILDING REGULATIONS
12. [parliamentary/committees-reports] score=85.008↑T `committees-reports:publication:23086:169097`
    **Report: Ninth Report of Session 2022–23 - 3 Statutory Instrument reported** — House of Lords House of Commons Joint Committee on Statutory Instruments Ninth Report of Session 2022–23 Drawing special attention to: Building Safety (Leasehol
13. [parliamentary/pwdata-lords] score=84.038↑T `pwdata-lords:daylord2022-03-29c:226`
    **Building Safety Bill - Report (Continued) — Amendments 87 to 99** — Moved by Lord Greenhalgh 87: Clause 115, page 119, line 37, leave out “section 30C or 30D” and insert “sections 30C to 30DA”Member’s explanatory statementThis a
14. [parliamentary/committees-reports] score=83.603↑T `committees-reports:publication:23001:168495`
    **Report: Eighth Report of Session 2022-23 - No Statutory Instruments reported** — House of Lords House of Commons Joint Committee on Statutory Instruments Eighth Report of Session 2022–23 Ordered by the House of Lords to be printed 6 July 202
15. [parliamentary/committees-reports] score=83.497↑T `committees-reports:publication:40677:198257`
    **Report: 45th Report - Includes information paragraphs on: Draft Building Safety (Leaseholder Protect** — HOUSE OF LORDS Secondary Legislation Scrutiny Committee 45th Report of Session 2022–23 Includes information paragraphs on: Draft Building Safety (Leaseholder Pr
16. [parliamentary/pwdata-lords] score=82.870↑T `pwdata-lords:daylord2022-07-12b:211`
    **Building etc. (Amendment) (England) Regulations 2022 - Motion to Regret** — My Lords, I thank the noble Baroness, Lady Hayman of Ullock, for securing this important debate—I know that not many people have spoken, but it is quality and n
17. [parliamentary/committees-reports] score=82.607↑T `committees-reports:publication:40896:199134`
    **Report: Forty-Fourth Report of Session 2022–23 - 2 Statutory Instruments Reported** — House of Lords House of Commons Joint Committee on Statutory Instruments Forty-Fourth Report of Session 2022–23 Ordered by the House of Lords to be printed 12 J
18. [parliamentary/pwdata-wms] score=82.112↑T `pwdata-wms:ministerial2021-12-14:3`
    **Department of Health and Social Care — The Food and Feed Safety (Miscellaneous Amendments and Transi** — Following the end of the Transition Period, the Government continues to regard food and feed safety and standards a top priority. This Statutory Instrument corr
19. [parliamentary/pwdata-lords] score=82.060↑T `pwdata-lords:daylord2022-03-29c:223`
    **Building Safety Bill - Report (Continued) — Amendments 74 to 84** — Moved by Lord Greenhalgh 74: Clause 115, page 117, line 4, leave out “(6)” and insert “(5)”Member’s explanatory statementThis amendment is consequential on othe
20. [parliamentary/pwdata-lordswms] score=81.765↑T `pwdata-lordswms:lordswms2021-12-14:2`
    **Department of Health and Social Care — The Food and Feed Safety (Miscellaneous Amendments and Transi** — My Honourable Friend the Minister of State (Minister of State for Health) (Ed Argar) has made the following written statement: Following the end of the Transiti

### D3 (D/H1) [GRAPH][INFORCE] — ENGINE FLOOR
*Query:* Which provisions of the Environment Act 2021 are not yet in force?
*stream:* citation graph · *kind:* specific · *metric:* recall@20
*recall@20:* 100.0% · *MRR:* 0.143

Expected sources:
- ✓ @7 — Environment Act 2021

Top-20 retrieved:
 1. [legislation/regional] score=110.435↑T `regional:wsi/2021/297:article-2`
    **Provisions coming into force on 1 April 2021** — 2 The following provisions of the 2021 Act come into force on 1 April 2021, so far as those provisions are not already in force— a sections 89 to 91; b sections
 2. [legislation/explanatory-memoranda] score=104.318↑T `explanatory-memoranda:em:uksi/2021/289:1`
    **Explanatory Memorandum: uksi/2021/289** — DExEU/EM/7-2018.2 1 EXPLANATORY MEMORANDUM TO THE ARMED FORCES ACT (CONTINUATION) ORDER 2021 2021 No. 289 1. Introduction 1.1 This explanatory memorandum has be
 3. [legislation/si-2010plus] score=102.801↑T `si-2010plus:uksi/2015/1376:article-3`
    **Transfer of concurrently exercisable functions of the Lord President to the Chancellor of the Duchy** — 3 1 The functions of the Secretary of State under— a an Act, or a provision of an Act or instrument, listed in Schedule 1, or b an instrument having effect unde
 4. [legislation/si-2010plus] score=102.500↑T `si-2010plus:uksi/2016/997:article-3`
    **Transfer of concurrently exercisable functions of the Chancellor of the Duchy to the Minister for th** — 3. (1) The functions of the Secretary of State under— (a) an Act, or a provision of an Act or instrument, listed in Schedule 1, or (b) an instrument having effe
 5. [legislation/explanatory-notes] score=100.838↑T `explanatory-notes:en:ukpga/2021/21:1`
    **Explanatory Notes: ukpga/2021/21** — c. 21–EN ANIMAL WELFARE (SENTENCING) ACT 2021 EXPLANATORY NOTES What these notes do These Explanatory Notes relate to the Animal Welfare (Sentencing) Act 2021 w
 6. [legislation/regional] score=100.822↑T `regional:wsi/2021/354:article-2`
    **Provisions coming into force on 1 May 2021** — 2 The following provisions of the 2021 Act come into force on 1 May 2021 so far as those provisions are not already in force— a section 47; b section 49; c Sche
 7. [legislation/primary-acts-2000plus] score=100.059↑T `primary-acts-2000plus:ukpga/2023/55:section-152`
    **Power to specify environmental outcomes** — 152 1 Regulations made by an appropriate authority under this Part (“ EOR regulations ”) may specify outcomes relating to environmental protection in the United
 8. [legislation/explanatory-notes] score=99.225↑T `explanatory-notes:en:ukpga/2021/30:1`
    **Explanatory Notes: ukpga/2021/30** — Published by TSO (The Stationery Off ice), a Williams Lea company, and available f rom: Online www.tsoshop.co.uk Mail, Telephone, Fax & E-mail TSO PO Box 29, No
 9. [legislation/explanatory-notes] score=98.589↑T `explanatory-notes:en:ukpga/2021/35:1`
    **Explanatory Notes: ukpga/2021/35** — EXPLANATORY NOTES Armed Forces Act 2021 Chapter 35 £11.50 c. 35–EN ARMED FORCES ACT 2021 EXPLANATORY NOTES What these notes do These Explanatory Notes relate to
10. [parliamentary/pwdata-wrans] score=74.547↑T `pwdata-wrans:answers2008-06-05c:66`
    **ENVIRONMENT FOOD AND RURAL AFFAIRS — Departmental Legislation** — Q (James Paice): To ask the Secretary of State for Environment, Food and Rural Affairs which Acts for which his Department has policy responsibility received Ro
11. [parliamentary/pwdata-wrans] score=71.731↑T `pwdata-wrans:answers2009-05-18c:46`
    **ENVIRONMENT FOOD AND RURAL AFFAIRS — Animal Welfare Act 2006** — Q (David Amess): To ask the Secretary of State for Environment, Food and Rural Affairs when he expects to bring forward those provisions of the Animal Welfare A
12. [parliamentary/pwdata-debates] score=70.688↑T `pwdata-debates:debates2026-02-12c:298`
    **Business of the House** — May I begin by thanking my right hon. Friend the Leader of the House for his remarks about Kingsbury school, which for 27 years was in my constituency before it
13. [parliamentary/pwdata-wrans] score=69.825↑T `pwdata-wrans:answers2007-09-03c:467`
    **ENVIRONMENT FOOD AND RURAL AFFAIRS — Departments: Legislation** — Q (Nicholas Clegg): To ask the Secretary of State for Environment, Food and Rural Affairs what legislative provisions introduced by his Department and its prede
14. [parliamentary/pwdata-wrans] score=68.036↑T `pwdata-wrans:answers2007-07-24b:88`
    **ENVIRONMENT FOOD AND RURAL AFFAIRS — Rights of Way** — Q (Christopher Chope): To ask the Secretary of State for Environment, Food and Rural Affairs if he will make it the policy of the Government to exclude built-up
15. [parliamentary/pwdata-wrans] score=67.581↑T `pwdata-wrans:answers2004-11-18:953`
    **ENVIRONMENT FOOD AND RURAL AFFAIRS — Commencement of Legislation** — Q (Brian White): To ask the Secretary of State for Environment, Food and Rural Affairs what pieces of legislation passed in the last 30 years that the Departmen
16. [parliamentary/pwdata-debates] score=67.163↑T `pwdata-debates:debates2025-03-20c:61`
    **Environment, Food and Rural Affairs — Environment Act 2021: Deforestation Due Diligence** — I thank the Minister for her answer. Tomorrow is the International Day of Forests. The Environment Act 2021 was passed over three years ago, with strong public 
17. [caselaw/et-decisions] score=65.212↑T `et-decisions:employment-tribunal-decisions/mr-g-cue-v-ministry-of-defence-2304997-slash-2021-and-others:2`
    **Mr G Cue v Ministry of Defence: 2304997/2021 and others - Judgment with Reasons** — : Case No: 2304997/2021, 2301970/2022 and 2302699/2022 EMPLOYMENT TRIBUNALS Claimant: Mr G Cue Respondent: Ministry of Defence Heard at: London South (by video)
18. [parliamentary/pwdata-wrans] score=65.113↑T `pwdata-wrans:answers2021-07-07:133`
    **Department for Environment, Food and Rural Affairs — Dogs: Animal Welfare** — Q (Andrew Rosindell): To ask the Secretary of State for Environment, Food and Rural Affairs, where and how protection dogs are covered by the provisions of (a) 
19. [parliamentary/committees-reports] score=64.983↑T `committees-reports:publication:43472:216182`
    **Correspondence: Letter on deforestation from Baroness Sheehan to the Secretary of State for DEFRA 14** — Baroness Sheehan Chair of the Environment and Climate Change Committee House of Lords London SW1A 0PW The Rt Hon Steve Barclay MP Secretary of State for the Dep
20. [parliamentary/pwdata-wrans] score=64.874↑T `pwdata-wrans:answers2023-11-20:342`
    **Department for Environment, Food and Rural Affairs — Forests** — Q (Steve Reed): To ask the Secretary of State for Environment, Food and Rural Affairs, whether his Department plans to bring forward secondary legislation under

### D4 (D/H2) [GRAPH] — ENGINE FLOOR
*Query:* Has the Dangerous Dogs Act 1991 been changed since it was passed — what changed and why?
*stream:* citation graph · *kind:* specific · *metric:* recall@20
*recall@20:* 33.3% · *MRR:* 1.000

Expected sources:
- ✓ @1 — Dangerous Dogs Act 1991
- ✗ MISS — ABCPA 2014 s.106
- ✗ MISS — XL Bully designation order 2023

Top-20 retrieved:
 1. [parliamentary/historic-hansard] score=115.418↑T `historic-hansard:S5LV0552P0:3709`
    **Lords: Dangerous Dogs (Amendment) Bill [H. L.]** — Lord Houghton of Sowerby : My Lords, I beg to move that the Bill do now pass. This Bill is a unique one. It is the first attempt that has been made to amend the
 2. [parliamentary/pwdata-westminster] score=110.362↑T `pwdata-westminster:westminster2011-07-06a:2`
    **[Hugh Bayley in the Chair] — Dangerous Dogs** — It is a pleasure to serve under your chairmanship, Mr Bayley. I am immensely grateful to Mr Speaker for allowing this debate. We can see from the number of Memb
 3. [parliamentary/pwdata-wrans] score=108.957↑T `pwdata-wrans:answers2002-05-08:31`
    **ENVIRONMENT FOOD AND RURAL AFFAIRS — Dangerous Dogs Act** — Q (Andrew Rosindell): To ask the Secretary of State for Environment, Food and Rural Affairs what has been the total cost of keeping dogs under the provisions of
 4. [other/petitions] score=108.926↑T `petitions:643670:1`
    **Do NOT ban the American Bully XL dog breed** — Do NOT ban the American Bully XL dog breed State: rejected · Signatures: 8 The Dangerous Dogs Act was put into place in 1991. 32 years later this legislation ha
 5. [parliamentary/pwdata-wrans] score=108.876↑T `pwdata-wrans:answers2017-03-14:236`
    **Department for Environment, Food and Rural Affairs — Assistance Dogs** — Q (Philip Davies): To ask the Secretary of State for Environment, Food and Rural Affairs, what estimate she has made of the number of assistance dogs that have 
 6. [parliamentary/pwdata-westminster] score=108.756↑T `pwdata-westminster:westminster2019-03-07b:3`
    **Dangerous Dogs — [James Gray in the Chair]** — It is a pleasure to serve under your chairmanship, Mr Gray. It always has been, and I hope today will be no different. I see we are completely packed out this a
 7. [parliamentary/committees-evidence] score=108.643↑T `committees-evidence:writtenevidence:91429:136784`
    **Dangerous Dogs: Breed Specific Legislation  inquiry — DDL0396** — DDL0396 - Evidence on Dangerous Dogs: Breed Specific Legislation Written evidence submitted by Miss Melinda Ashby (DDL0396) I am making this submission as I fee
 8. [parliamentary/historic-hansard] score=108.569↑T `historic-hansard:S5LV0567P0:1380`
    **Lords: Dangerous Dogs (Amendment) Bill [H.L.]** — Lord Soulsby of Swaffham Prior : My Lords, it is a great pleasure to support the noble Lord, Lord Houghton of Sowerby, in what I understand is his fourth attemp
 9. [parliamentary/pwdata-wrans] score=108.339↑T `pwdata-wrans:answers2010-12-21b:467`
    **ENVIRONMENT FOOD AND RURAL AFFAIRS — Dangerous Dogs** — Q (William Bain): To ask the Secretary of State for Environment, Food and Rural Affairs how many entries have been made on the Index of Exempted Dogs in each ye
10. [parliamentary/pwdata-wrans] score=107.849↑T `pwdata-wrans:answers2017-03-14:235`
    **Department for Environment, Food and Rural Affairs — Dangerous Dogs: Private Property** — Q (Philip Davies): To ask the Secretary of State for Environment, Food and Rural Affairs, what estimate she has made of the number of people who have been (a) k
11. [parliamentary/pwdata-wrans] score=107.205↑T `pwdata-wrans:answers2001-10-24:184`
    **HOME DEPARTMENT — Dangerous Dogs Act** — Q (Andrew Dismore): To ask the Secretary of State for the Home Department what plans he has to review the Dangerous Dogs Act 1991; and if he will make a stateme
12. [parliamentary/pwdata-wrans] score=106.309↑T `pwdata-wrans:answers2002-05-08:28`
    **ENVIRONMENT FOOD AND RURAL AFFAIRS — Dangerous Dogs Act** — Q (Andrew Rosindell): To ask the Secretary of State for Environment, Food and Rural Affairs what the average length of time dogs have been held by the police un
13. [parliamentary/pwdata-wrans] score=105.920↑T `pwdata-wrans:answers2008-01-22d:385`
    **ENVIRONMENT FOOD AND RURAL AFFAIRS — Dangerous Dogs Act 1991** — Q (Bill Wiggin): To ask the Secretary of State for Environment, Food and Rural Affairs (1) what estimate he has made of the number of illegal dogs under the Dan
14. [parliamentary/committees-evidence] score=105.885↑T `committees-evidence:writtenevidence:91320:136660`
    **Dangerous Dogs: Breed Specific Legislation  inquiry — DDL0295** — DDL0295 - Evidence on Dangerous Dogs: Breed Specific Legislation Written evidence submitted by Melinda Janki LL.B , BCL, LL.M (DDL0295) I thank the Committee fo
15. [parliamentary/pwdata-wrans] score=105.841↑T `pwdata-wrans:answers2009-11-04c:140`
    **ENVIRONMENT FOOD AND RURAL AFFAIRS — Dangerous Dogs Act 1991** — Q (Andrew Rosindell): To ask the Secretary of State for Environment, Food and Rural Affairs what guidance his Department provides to police forces on the implem
16. [parliamentary/pwdata-wrans] score=105.406↑T `pwdata-wrans:answers2006-02-06c:455`
    **HOME DEPARTMENT — Dangerous Dogs Act** — Q (Chris Ruane): To ask the Secretary of State for the Home Department how many people have been prosecuted under the Dangerous Dogs Act 1991 in each year since
17. [parliamentary/pwdata-wrans] score=105.333↑T `pwdata-wrans:answers2006-05-15c:121`
    **HOME DEPARTMENT — Dangerous Dogs Act** — Q (Roger Williams): To ask the Secretary of State for the Home Department how many people in (a) England and Wales and (b) London have been prosecuted under the
18. [parliamentary/pwdata-wrans] score=105.298↑T `pwdata-wrans:answers2015-11-04:87`
    **Department for Environment, Food and Rural Affairs — Dangerous Dogs** — Q (Chris Evans): To ask the Secretary of State for Environment, Food and Rural Affairs, what assessment she has made of the effect of the Dangerous Dogs Act 199
19. [parliamentary/pwdata-wrans] score=104.356↑T `pwdata-wrans:answers2013-07-01c:189`
    **ENVIRONMENT FOOD AND RURAL AFFAIRS — Dangerous Dogs** — Q (Philip Davies): To ask the Secretary of State for Environment, Food and Rural Affairs what estimate he has made of the likely reduction of incidents in priva
20. [parliamentary/pwdata-wrans] score=104.345↑T `pwdata-wrans:answers2016-12-07:89`
    **Department for Environment, Food and Rural Affairs — Dangerous Dogs** — Q (Angela Smith): To ask the Secretary of State for Environment, Food and Rural Affairs, what advice or guidance her Department has issued to (a) the Police, (b

### D5 (D/H1) [GRAPH] — ENGINE FLOOR
*Query:* What case law has considered 'philosophical belief' under section 10 of the Equality Act 2010?
*stream:* citation graph · *kind:* specific · *metric:* recall@20
*recall@20:* 100.0% · *MRR:* 0.250

Expected sources:
- ✓ @4 — Grainger plc v Nicholson
- ✓ @4 — Forstater v CGD Europe

Top-20 retrieved:
 1. [legislation/primary-acts-2000plus] score=155.678↑R `primary-acts-2000plus:ukpga/2010/15:section-10`
    **Religion or belief** — 10 1 Religion means any religion and a reference to religion includes a reference to a lack of religion. 2 Belief means any religious or philosophical belief an
 2. [legislation/explanatory-memoranda] score=154.678↑T `explanatory-memoranda:em:uksi/2010/2192:1`
    **Explanatory Memorandum: uksi/2010/2192** — EXPLANATORY MEMORANDUM TO THE EQUALITY ACT 2010 (QUALIFYING COMPROMISE CONTRACT SPECIFIED PERSON) ORDER 2010 2010 No. 2192 1. This explanatory memorandum has be
 3. [caselaw/et-decisions] score=128.066↑T `et-decisions:employment-tribunal-decisions/mr-j-barker-v-the-chief-constable-of-warwickshire-police-1306859-slash-2020:3`
    **Mr J Barker v The Chief Constable of Warwickshire Police: 1306859/2020 - Preliminary** — Case No: 1306859/2020 EMPLOYMENT TRIBUNALS Claimant: Mr J Barker Respondent: The Chief Constable of Warwickshire Police Heard at: Birmingham On: 4 th and 5 th J
 4. [caselaw/et-decisions] score=121.143↑T `et-decisions:employment-tribunal-decisions/ms-m-kilburn-v-sensient-flavors-llc-and-others-3302208-slash-2024:2`
    **Ms M Kilburn v Sensient Flavors LLC and Others: 3302208/2024 - Preliminary** — Case Number: 3302208/2024 1 EMPLOYMENT TRIBUNALS Claimant: Ms Misti Kilburn Respondent: 1. Sensient Flavors LLC 2. Sensient Technologies Corporation 3. Sensient
 5. [caselaw/et-decisions] score=120.761↑T `et-decisions:employment-tribunal-decisions/mr-e-mcclung-v-doosan-babcock-ltd-and-others-4110538-slash-2019:4`
    **Mr E McClung v Doosan Babcock Ltd and others: 4110538/2019 - Preliminary** — EMPLOYMENT TRIBUNALS (SCOTLAND) Case No: 4110538/2019 Held in Glasgow on 1 June 2022 Employment Judge L Wiseman Mr E McClung Claimant In Person Doosan Babcock L
 6. [caselaw/et-decisions] score=116.746↑T `et-decisions:employment-tribunal-decisions/mr-m-pollard-v-aquinas-church-of-england-education-trust-and-others-2303117-slash-2019:2`
    **Mr M Pollard v Aquinas Church of England Education Trust and Others: 2303117/2019 - Preliminary** — Case No: 2303117/2019 (V) 10.5 Reserved judgment with reasons – rule 62 March 2017 EMPLOYMENT TRIBUNALS Claimant: Mr M Pollard Respondents: (1) Aquinas Church o
 7. [caselaw/et-decisions] score=108.457↑T `et-decisions:employment-tribunal-decisions/mrs-h-bannerman-v-the-land-restoration-trust-3306483-slash-2024:3`
    **Mrs H Bannerman v The Land Restoration Trust: 3306483/2024 and 3311035/2024 - Reserved Judgment** — Case Number: 3311035/2024 3306483/2024 1 EMPLOYMENT TRIBUNALS Claimant Respondent Mrs H Bannerman v The Land Restoration Trust Heard at: Bury St Edmunds (by CVP
 8. [caselaw/et-decisions] score=108.079↑T `et-decisions:employment-tribunal-decisions/mr-j-casamitjana-costa-v-the-league-against-cruel-sports-3331129-2018:2`
    **Mr J Casamitjana Costa v The League Against Cruel Sports: 3331129/2018 - Preliminary** — Case Number: 3331129/2018 1 EMPLOYMENT TRIBUNALS Claimant Respondent Mr J Casamitjana Costa v The League Against Cruel Sports RECORD of a PUBLIC PRELIMINARY HEA
 9. [caselaw/et-decisions] score=106.348↑T `et-decisions:employment-tribunal-decisions/mr-q-hawkins-v-the-chief-constable-of-northumbria-police-2502640-2019:2`
    **Mr Q Hawkins v The Chief Constable of Northumbria Police: 2502640/2019 - Dissmissal** — Case No: 2502640/2019 EMPLOYMENT TRIBUNALS Claimant: Mr Q Hawkins Respondent: The Chief Constable of Northumbria Police PUBLIC PRELIMINARY HEARING Heard at: Nor
10. [parliamentary/pwdata-lords] score=105.691↑T `pwdata-lords:daylord2010-03-23a:111`
    **Equality Bill — Third Reading** — The noble Lord is exactly right: it is clarifying. I had a note, which of course I do not have in front of me now, that explained why the amendment is in front 
11. [guidance/quangos-govuk] score=105.606↑T `quangos-govuk:government/publications/post-legislative-memorandum-the-equality-act-2010:3`
    **Memorandum to the Women and Equalities Select Committee on the Post-Legislative Assessment of the Eq** — M Le CM 91 Memo an Co egisl 01 oran nd E omm ativ Eq u ndum Equa mittee e As ualit m to alitie e on sses ty Ac o the es S n the ssm ct 20 e Wo Sele e Po ment 01
12. [guidance/quangos-govuk] score=105.606↑T `quangos-govuk:government/publications/post-legislative-memorandum-the-equality-act-2010:2`
    **Memorandum to the Women and Equalities Select Committee on the Post-Legislative Assessment of the Eq** — M Le CM 91 Memo an Co egisl 01 oran nd E omm ativ Eq u ndum Equa mittee e As ualit m to alitie e on sses ty Ac o the es S n the ssm ct 20 e Wo Sele e Po ment 01
13. [caselaw/et-decisions] score=103.439↑T `et-decisions:employment-tribunal-decisions/mr-g-conisbee-v-crossley-farms-ltd-and-others-3335357-2018:2`
    **Mr G Conisbee v Crossley Farms Ltd and others: 3335357/2018 - Reserved Judgment** — Case Number: 3335357/2018 1 EMPLOYMENT TRIBUNALS Claimant Respondents Mr G Conisbee v (1) Crossley Farms Limited; (2) Shane Foulger; (3) William Durrant; (4) Ja
14. [parliamentary/pwdata-lords] score=102.898↑T `pwdata-lords:daylord2010-01-13a:78`
    **Equality Bill — Committee (2nd Day)** — The amendment concerns matters of religion or belief and would prevent beliefs of a philosophical nature being protected under domestic legislation. There are s
15. [caselaw/et-decisions] score=101.899↑T `et-decisions:employment-tribunal-decisions/dr-m-grigorova-v-the-university-of-leeds-1801041-slash-2022:2`
    **Dr M Grigorova v The University of Leeds: 1801041/2022 - Preliminary** — Case No. 1801041/2022 1 EMPLOYMENT TRIBUNALS BETWEEN: Dr M Grigorova and The University of Leeds Claimant Respondent Heard at: Leeds on: 5 and 6 October 2022 Be
16. [caselaw/et-decisions] score=101.425↑T `et-decisions:employment-tribunal-decisions/n-n-khair-v-the-chief-constable-of-leicestershire-police-and-mr-g-jacques-2601576-slash-2021:2`
    **N N Khair v The Chief Constable of Leicestershire Police and Mr G Jacques: 2601576/2021 - Judgment** — CASE NO: 2601576/2021 1 EMPLOYMENT TRIBUNALS Claimant: Nurun Nahar Khair Respondents: R1) The Ch
17. [caselaw/et-decisions] score=100.945↑T `et-decisions:employment-tribunal-decisions/professor-j-mccambridge-v-the-university-of-york-6001997-slash-2023:2`
    **Professor J McCambridge v The University of York: 6001997/2023 - Reserved Judgment** — Case No: 6001997/2023 10.5 Reserved judgment with reasons – rule 62 March 2017 EMPLOYMENT TRIBUNALS Claimant: Professor J McCambridge Respondent: The University
18. [caselaw/et-decisions] score=100.890↑T `et-decisions:employment-tribunal-decisions/mr-a-cave-v-the-open-university-3313198-slash-2020:2`
    **Mr A Cave v The Open University: 3313198/2020 - Reserved Preliminary Judgment** — Case Number: 3313198/2020 1 EMPLOYMENT TRIBUNALS Claimant Respondent Mr A Cave The Open University Heard at Cambridge On: 17 April 2023 and 18 April 2023 (in ch
19. [parliamentary/pwdata-debates] score=100.112↑T `pwdata-debates:debates2013-05-20b:393`
    **WORK AND PENSIONS — New Clause 1 — Education Act 1996** — That example shows the danger of trying to make law on the basis of one individual case, particularly when—as in that case—the litigant failed to apply and foll
20. [parliamentary/pwdata-lords] score=99.500↑T `pwdata-lords:daylord2010-03-23a:101`
    **Equality Bill — Third Reading** — My Lords, in Committee in your Lordships' House we had a debate that centred around exactly what was included by the protected characteristic "religion or belie

### E1 (E/H1)
*Query:* What did ministers say the under-occupancy provisions of the Welfare Reform Act 2012 were intended to achieve?
*stream:* debates · *kind:* specific · *metric:* recall@20
*recall@20:* 100.0% · *MRR:* 1.000

Expected sources:
- ✓ @1 — Welfare Reform Act 2012
- ✓ @20 — Hansard 2011–12 (under-occupancy / bedroom tax)

Top-20 retrieved:
 1. [legislation/primary-acts-2000plus] score=138.820↑T `primary-acts-2000plus:ukpga/2001/11:section-10`
    **Power to supplement and mitigate loss of benefit provisions** — 10 1 The Secretary of State may by regulations provide for any social security benefit to be treated for the purposes of sections 6A to 9 — a as a disqualifying
 2. [legislation/regional] score=136.741↑T `regional:nia/2001/17:section-9`
    **Power to supplement and mitigate loss of benefit provisions** — 9 1 The Department may by regulations provide for any social security benefit to be treated for the purposes of sections 5A to 8 — a as a disqualifying benefit 
 3. [legislation/si-2010plus] score=134.937↑T `si-2010plus:uksi/2019/167:article-5`
    **Amendment of the No. 9, No. 21 and No. 23 Orders** — 5 1 With effect from 1st February 2019, the No. 9, No. 21 and No. 23 Orders are amended as follows. 2 In the No. 9 Order— a in article 5A(1) , after “disability
 4. [legislation/primary-acts-pre-2000] score=131.544↑T `primary-acts-pre-2000:ukpga/1992/5:section-170`
    **The Social Advisory Committee** — 170 1 The Social Security Advisory Committee (in this Act referred to as “ the Committee ”) constituted under section 9 of the Social Security Act 1980 shall co
 5. [legislation/si-2010plus] score=131.114↑T `si-2010plus:uksi/2018/138:article-5`
    **Modifications of the No. 11 Order, the No. 13 Order, the No. 17 Order, the No. 19 Order, the No. 22 ** — 5 1 This article applies in respect of claims in relation to which provisions of the No. 11 Order, the No. 13 Order, the No. 17 Order, the No. 19 Order, the No.
 6. [parliamentary/pwdata-wrans] score=103.041↑T `pwdata-wrans:answers2012-03-21a:12`
    **NORTHERN IRELAND — Welfare Reform Act 2012** — Q (Vernon Coaker): To ask the Secretary of State for Northern Ireland what assessment he has made of the effect of the Welfare Reform Act on (a) child poverty, 
 7. [parliamentary/pwdata-debates] score=98.484↑T `pwdata-debates:debates2015-12-16c:455`
    **Representation of the People (Proportional Representation) (House of Commons) — Welfare Cap** — As someone who voted against the welfare cap when it was introduced and whenever it was reset, I am happy that the Government are trying to relax the original l
 8. [parliamentary/pwdata-lordswrans] score=98.210↑T `pwdata-lordswrans:lordswrans2013-01-28a:77`
    **Welfare Reform Act 2012** — Q (Baroness Kinnock of Holyhead): To ask Her Majesty's Government what is their assessment of the impact of the Welfare Reform Act 2012 on refuges in the United
 9. [guidance/hmrc-manuals] score=96.220↑T `hmrc-manuals:hmrc-internal-manuals/vat-government-and-public-bodies/vatgpb11170:1`
    **VATGPB11170 — Government departments and health authorities: Contracted Out Services (COS) Headings:** — The full heading reads: Services supplied solely for the purpose of duties imposed by, or powers provided pursuant to, welfare legislation enacted by Parliament
10. [parliamentary/pwdata-debates] score=90.951↑T `pwdata-debates:debates1998-03-26a:120`
    **Welfare Reform** — Today's statement is a significant milestone for the Government, as much as for the House, and it deserves some scrutiny. I welcome the fact that the Minister f
11. [parliamentary/pwdata-wrans] score=89.069↑T `pwdata-wrans:answers2012-05-22c:331`
    **WORK AND PENSIONS — Welfare Reform Act 2012** — Q (Kate Green): To ask the Secretary of State for Work and Pensions what recent progress he has made in preparing regulations to support the implementation of t
12. [parliamentary/pwdata-wms] score=84.839↑T `pwdata-wms:ministerial2012-12-10b:11`
    **WORK AND PENSIONS — Welfare Reform Regulations** — I am pleased to announce that later today the Department intends to lay and publish the following draft affirmative regulations: The Universal Credit Regulation
13. [parliamentary/niassembly-hansard] score=84.642↑T `niassembly-hansard:249944:172`
    **NI Assembly: Executive Committee Business — Welfare Reform: Legislative Consent Motion** — We do not wash our hands of political responsibility for how we have addressed and tried to manage the issue of welfare reform arising from the 2012 legislation
14. [parliamentary/pwdata-lordswms] score=84.472↑T `pwdata-lordswms:lordswms2012-12-10a:11`
    **Welfare Reform Regulations** — My right honourable friend the Secretary of State for Work and Pensions (Iain Duncan Smith) has made the following Written Ministerial Statement. I am pleased t
15. [parliamentary/pwdata-debates] score=84.331↑T `pwdata-debates:debates1983-07-05a:295`
    **Orders of the Day — Housing and Building Control Bill** — Yes, for home ownership. We did that by introducing a mortgage option scheme and the Leasehold Reform Act 1967 described by Conservative Members as Rachmanism i
16. [parliamentary/pwdata-westminster] score=83.872↑T `pwdata-westminster:westminster2012-03-14a:84`
    **Women’s Aid — [Dr William McCrea in the Chair]** — What my hon. Friend says echoes what I said at the beginning of my speech about how the benefits system relates to specialised individual needs. I hope that the
17. [parliamentary/pwdata-westminster] score=83.129↑T `pwdata-westminster:westminster2016-02-09b:82`
    **Work Capability Assessments — [Mrs Madeleine Moon in the Chair]** — I would not put it in quite those words, perhaps, but I know exactly what my hon. Friend is getting at. The Government’s own data show that the people involved 
18. [parliamentary/pwdata-westminster] score=82.895↑T `pwdata-westminster:westminster2012-03-14a:80`
    **Women’s Aid — [Dr William McCrea in the Chair]** — I appreciate that. I may not have explained myself properly. I was saying that there are men who find themselves on the receiving end of domestic violence. Howe
19. [guidance/nao-reports] score=82.730↑T `nao-reports:local-welfare-provision:2`
    **local welfare provision** — JANUARY 2016 Local government report by the Comptroller and Auditor General Local government Local welfare provision 4 Key facts Local welfare provision Key fac
20. [parliamentary/committees-evidence] score=82.457↑T `committees-evidence:writtenevidence:45887:90997`
    **Support for housing costs in the reformed welfare system — HCT0049** — HCT0049 - Evidence on Support for housing costs in the reformed welfare system Written evidence submitted by The Scottish Federation of Housing Associations 1 W

### E2 (E/H2)
*Query:* Why was the sugar tax designed as a levy on manufacturers instead of a tax at the till?
*stream:* debates · *kind:* specific · *metric:* recall@20
*recall@20:* 100.0% · *MRR:* 1.000

Expected sources:
- ✓ @5 — Finance Act 2017 Part 2 (Soft Drinks Industry Levy)
- ✓ @1 — Budget 2016 / Finance Bill 2017 debate

Top-20 retrieved:
 1. [parliamentary/historic-hansard] score=102.583↑T `historic-hansard:S3V0055P0:1098`
    **Commons: POTATO SUGAR.]** — The Chancellor of the Exchequer , in a Committee of the whole House, moved a resolution, that the excise duty now payable on sugar made from beet-root be charge
 2. [parliamentary/historic-hansard] score=98.449↑T `historic-hansard:S4V0092P0:1868`
    **Commons: WAYS AND MEANS. — SUGAR.—CUSTOMS.** — * MR. LOUGH : The Committee has really not given these two resolutions that consideration which they deserve. There is first the question of Excise. What will b
 3. [parliamentary/historic-hansard] score=97.527↑T `historic-hansard:S3V0077P0:620`
    **Commons: FINANCIAL STATEMENT—THE BUDGET.]** — Mr. Warburton was quite prepared to agree with the hon. Member for Halifax, that if Government were prepared to act with energy in laying open the industry of t
 4. [parliamentary/historic-hansard] score=95.409↑T `historic-hansard:gapday:commons:1906/apr/30:326`
    **Commons: THE FINAL BALANCE SHEET.** — (Sheffield, Hallam) wished to say a few words as to sugar, with the claims of which he had a good deal more sympathy than with the interests of tea and coal. Th
 5. [parliamentary/pwdata-wrans] score=94.801↑T `pwdata-wrans:answers2017-03-06:228`
    **HM Treasury — Sugar: Taxation** — Q (Sir Hugo Swire): To ask Mr Chancellor of the Exchequer, if he will consider mitigating the effects of the soft drinks industry levy on those manufacturers cu
 6. [parliamentary/historic-hansard] score=94.541↑T `historic-hansard:S3V0245P0:1517`
    **Commons: MOTIONS. — SUGAR INDUSTRIES.—RESOLUTION.** — DR. CAMERON , in seconding the Motion, said, that his hon. Friend (Mr. Ritchie) had drawn attention to the doubt cast by some persons on the existence of the bo
 7. [parliamentary/pwdata-debates] score=93.713↑T `pwdata-debates:debates1934-03-05a:245`
    **Orders of the Day — SUPPLY. — BEET SUGAR SUBSIDY, GREAT BRITAIN.** — I recognise that I am on somewhat uncertain ground on the point of Order in raising the question of inquiry. Therefore, in deference to what you have said, I wi
 8. [other/petitions] score=92.087↑T `petitions:702008:1`
    **Scrap the Sugar tax on soft drinks** — Scrap the Sugar tax on soft drinks State: closed · Signatures: 138 · Opened: 2025-03-04 · Departments: HM Treasury The Sugar Tax was brought in by the last Cons
 9. [parliamentary/historic-hansard] score=91.291↑T `historic-hansard:S3V0070P0:256`
    **Commons: SUGAR DUTIES.]** — Mr. Scarlett said, that both sugar and rum paid heavy taxes to the State. Suppose they were divided into fifteen parts, thirteen of them were taken by the Gover
10. [parliamentary/pwdata-wrans] score=91.280↑T `pwdata-wrans:answers2018-09-04:266`
    **Treasury — Sugar: Soft Drinks** — Q (Royston Smith): To ask Mr Chancellor of the Exchequer, what assessment he has made of the effectiveness of the introduction of the sugar tax on reducing the 
11. [parliamentary/pwdata-debates] score=89.900↑T `pwdata-debates:debates1925-05-11a:343`
    **Orders of the Day — WAYS AND MEANS. — SILK [CUSTOMS).** — We hope to raise the tax from the consumer. That is the whole object. There will be no change in policy in making such an alteration. It will be simply carrying
12. [parliamentary/pwdata-wrans] score=88.047↑T `pwdata-wrans:answers2025-12-17:156`
    **Treasury — Soft Drinks: Taxation** — Q (Luke Myer): To ask the Chancellor of the Exchequer, whether she plans to review the sugar content of powdered milk based drinks and include those products wi
13. [parliamentary/pwdata-lordswrans] score=87.389↑T `pwdata-lordswrans:lordswrans2016-04-04:22`
    **HM Treasury — Sugar: Taxation** — Q (Lord Kennedy of Southwark): To ask Her Majesty’s Government what assessment they have made of the comments of Chief Executive NHS England, in response to the
14. [parliamentary/pwdata-lords] score=86.815↑T `pwdata-lords:daylord2022-01-24a:19`
    **Sugar - Question** — I thank the noble Baroness for raising the success so far of the programme in reducing sugar in drinks. Between 2015 and 2019, we saw a 44% reduction in sales-w
15. [parliamentary/historic-hansard] score=86.685↑T `historic-hansard:S3V0038P0:1744`
    **Commons: EXCISE ACTS (BEET-ROOT SUGAR.)]** — Mr. Poulett Thomson said, he had been asked if any facts had come to his knowledge that induced him to press the Bill this Session? To this question he must rep
16. [parliamentary/historic-hansard] score=85.159↑T `historic-hansard:S5CV0016P0:3535`
    **Commons: Brussels Sugar Convention (Duties on Raw and Refined Sugar).** — Sir E. GREY : All sugar other than candy, whether manufactured in or imported into France, is subject to an Excise Tax of 25 francs per 100 kilogrammes of its e
17. [parliamentary/historic-hansard] score=84.972↑T `historic-hansard:S3V0215P0:2327`
    **Commons: WAYS AND MEANS—DIRECT AND INDIRECT TAXATION. — SECOND NIGHT.** — SIR TOLLEMACHE SINCLAIR said, he appreciated the reduction of the sugar duties, but he hoped the remission of all duties on tea, coffee, and sugar, would have p
18. [other/petitions] score=84.583↑T `petitions:649866:1`
    **Scrap the Sugar Levy on Soft drinks** — Scrap the Sugar Levy on Soft drinks State: rejected · Signatures: 16 · Departments: HM Treasury Scrap the sugary levy on soft drinks that was introduced in 2018
19. [parliamentary/historic-hansard] score=83.459↑T `historic-hansard:S3V0245P0:1522`
    **Commons: MOTIONS. — SUGAR INDUSTRIES.—RESOLUTION.** — MR. COURTNEY said he would be sorry that this Motion should be agreed to, even in a modified form, without someone rising to offer some objections to the propos
20. [parliamentary/pwdata-wrans] score=83.409↑T `pwdata-wrans:answers2018-09-04:270`
    **Treasury — Sugar: Consumption** — Q (Jim Shannon): To ask Mr Chancellor of the Exchequer, what recent assessment he has made of the effect of the soft drinks industry levy on sugar consumption l

### E3 (E/H1)
*Query:* What assurances were given during the passage of the Investigatory Powers Act 2016 about safeguards on bulk powers?
*stream:* debates · *kind:* specific · *metric:* recall@20
*recall@20:* 100.0% · *MRR:* 1.000

Expected sources:
- ✓ @1 — Investigatory Powers Act 2016
- ✓ @1 — Hansard double-lock / IPC oversight

Top-20 retrieved:
 1. [legislation/primary-acts-2000plus] score=159.741↑T `primary-acts-2000plus:ukpga/2024/9:section-27`
    **Bulk equipment interference: safeguards for confidential journalistic material etc** — Section 27 1. The Investigatory Powers Act 2016 is amended as follows. 2. For section 195 (additional safeguard for confidential journalistic material) substitu
 2. [legislation/explanatory-notes] score=155.519↑T `explanatory-notes:en:ukpga/2016/25:1`
    **Explanatory Notes: ukpga/2016/25** — EXPLANATORY NOTES Investigatory Powers Act 2016 Chapter 25 £19.00 c. 25–EN INVESTIGATORY POWERS ACT 2016 EXPLANATORY NOTES What these notes do These Explanatory
 3. [legislation/primary-acts-2000plus] score=154.316↑T `primary-acts-2000plus:ukpga/2016/25:section-243`
    **Functions of Tribunal in relation to this Act etc.** — Section 243 1. In section 65 of the Regulation of Investigatory Powers Act 2000 (the Investigatory Powers Tribunal)— a. in subsection (2)(c) (jurisdiction of th
 4. [legislation/si-2010plus] score=153.514↑T `si-2010plus:uksi/2024/514:article-2`
    **Substitution of section 154 of the Investigatory Powers Act 2016** — 2 For section 154 of the Investigatory Powers Act 2016, substitute— Additional safeguards for confidential journalistic material etc 154 1 Subsection (2) applie
 5. [parliamentary/committees-reports] score=140.593↑T `committees-reports:publication:42310:210397`
    **Correspondence: Letter from Baroness Drake, Chair of the Constitution Committee, to Lord Sharpe of E** — Select Committee on the Constitution House of Lords London SW1A 0PW Tel: 020 7219 1228 constitution@parliament.uk www.parliament.uk/lords Lord Sharpe of Epsom 2
 6. [caselaw/echr-hudoc] score=115.848↑T `echr-hudoc:001-249612:1`
    **THE NATIONAL COUNCIL FOR CIVIL LIBERTIES v. THE UNITED KINGDOM** — Published on 30 March 2026 SECOND SECTION Application no. 15250/24 THE NATIONAL COUNCIL FOR CIVIL LIBERTIES against the United Kingdom lodged on 28 May 2024 com
 7. [parliamentary/committees-reports] score=112.601↑T `committees-reports:publication:42869:213120`
    **Report: First Report - Draft Investigatory Powers Act 2016 (Remedial) Order 2023: Second Report** — House of Commons House of Lords Joint Committee on Human Rights Draft Investigatory Powers Act 2016 (Remedial) Order 2023: Second Report First Report of Session
 8. [parliamentary/committees-reports] score=111.257↑T `committees-reports:publication:40304:196874`
    **Report: Thirteenth Report - Proposal for a Draft Investigatory Powers Act 2016 (Remedial) Order 2023** — House of Commons House of Lords Joint Committee on Human Rights Proposal for a Draft Investigatory Powers Act 2016 (Remedial) Order 2023 Thirteenth Report of Se
 9. [parliamentary/pwdata-debates] score=110.248↑T `pwdata-debates:debates2016-03-15a:322`
    **Investigatory Powers Bill** — I am grateful for the opportunity to participate in this debate. I want to summarise the views of the Intelligence and Security Committee on the Bill. The Commi
10. [parliamentary/pwdata-lords] score=109.790↑T `pwdata-lords:daylord2016-06-27b:151`
    **Investigatory Powers Bill - Second Reading (Continued)** — My Lords, I am sure the whole House is relieved to hear of this newfound friendship between their two noble Lordships. It is always a pleasure to follow the nob
11. [parliamentary/committees-evidence] score=107.611↑T `committees-evidence:writtenevidence:62259:107678`
    **Draft Investigatory Powers Bill Joint Committee - publications — IPB0015** — IPB0015 - Evidence on Draft Investigatory Powers Bill Amberhawk Training Limited —written evidence (IPB0015) 12 December 2015 Introduction This submission is pr
12. [parliamentary/committees-evidence] score=107.174↑T `committees-evidence:writtenevidence:62889:108354`
    **Draft Investigatory Powers Bill Joint Committee - publications — IPB0159** — IPB0159 - Evidence on Draft Investigatory Powers Bill Home Office—further supplementary written evidence (IPB0159) The draft Investigatory Powers Bill: Further 
13. [parliamentary/pwdata-wrans] score=106.682↑T `pwdata-wrans:answers2017-04-27:47`
    **Home Office — Investigatory Powers Act 2016: Codes of Practice** — Q (Sarah Olney): To ask the Secretary of State for the Home Department, how many responses her Department received to its consultation on codes of practice in r
14. [parliamentary/pwdata-wms] score=105.186↑T `pwdata-wms:ministerial2017-02-23:8`
    **Home Office — Consultation on draft codes of practice under the Investigatory Powers Act 2016** — I am today announcing the publication of the Government’s consultation on five new codes of practice under the Investigatory Powers Act 2016. The Investigatory 
15. [parliamentary/pwdata-lordswms] score=103.925↑T `pwdata-lordswms:lordswms2017-02-23:6`
    **Home Office — Consultation on draft codes of practice under the Investigatory Powers Act 2016** — My hon Friend the Minister of State for Security (Ben Wallace) has today made the following Written Ministerial Statement: I am today announcing the publication
16. [parliamentary/pwdata-lords] score=103.359↑T `pwdata-lords:daylord2024-01-23c:127`
    **Investigatory Powers (Amendment) Bill [HL] - Report — Amendment 39** — Yes. The noble Lord, Lord Fox, says, “Don’t get too excited”, and he is right. I now turn to the government amendment in this group, Amendment 46. This proposed
17. [parliamentary/pwdata-lords] score=102.258↑T `pwdata-lords:daylord2023-12-11a:86`
    **Investigatory Powers (Amendment) Bill [HL] - Committee (1st Day) — Amendment 1** — My Lords, if I suddenly fall over, it is not excitement over my amendments but that I have a brand new starboard knee, which is still slightly wobbly, so I migh
18. [parliamentary/pwdata-lords] score=101.725↑T `pwdata-lords:daylord2024-01-23c:131`
    **Investigatory Powers (Amendment) Bill [HL] - Report — Amendment 46** — Moved by Lord Sharpe of Epsom 46: After Clause 25 insert the following new Clause—“Bulk equipment interference: safeguards for confidential journalistic materia
19. [parliamentary/pwdata-lords] score=101.671↑T `pwdata-lords:daylord2016-10-19a:128`
    **Investigatory Powers Bill - Report (3rd Day)** — My Lords, these amendments would remove the bulk equipment interference provisions from the Bill. Before I address the amendments specifically, it is worth paus
20. [parliamentary/pwdata-lords] score=101.603↑T `pwdata-lords:daylord2018-02-01a:60`
    **Investigatory Powers (Codes of Practice) Regulations 2018 - Motions to Approve** — My Lords, if the House will allow me, I should like to make a few comments about what happened during Oral Questions yesterday. Perhaps I may say that the decis

### E4 (E/H2)
*Query:* Why does the indoor smoking ban not apply to private homes? What was said when it was passed?
*stream:* debates · *kind:* specific · *metric:* recall@20
*recall@20:* 50.0% · *MRR:* 0.500

Expected sources:
- ✗ MISS — Health Act 2006 Part 1
- ✓ @2 — 2005–06 debate on scope/exemptions

Top-20 retrieved:
 1. [parliamentary/pwdata-lords] score=108.058↑T `pwdata-lords:daylord2004-02-09a:18`
    **Smoking in Public Places** — My Lords, how many people does my noble friend estimate die as a result of smoking in the UK every year; and what percentage of such lives have been estimated a
 2. [parliamentary/pwdata-debates] score=106.525↑T `pwdata-debates:debates2014-02-10b:406`
    **Children and Families Bill (Programme No. 3) — Protection of Children’s Health: Offence of Smoking i** — I have no quibble at all with the hon. Member for Liverpool, Wavertree (Luciana Berger) , who represents the smug, patronising excesses of new Labour. They thin
 3. [other/petitions] score=106.403↑T `petitions:582168:1`
    **Ban smoking indoors in flats, terraced, and semi-detached houses** — Ban smoking indoors in flats, terraced, and semi-detached houses State: closed · Signatures: 47 · Opened: 2021-04-12 Potential risks from second-hand smoke incl
 4. [parliamentary/pwdata-lords] score=105.981↑T `pwdata-lords:daylord2006-10-09d:236`
    **Smoking (Northern Ireland) Order 2006** — My Lords, I thank the Minister for presenting the order succinctly, as he always does. I am not very happy about the order. I support, as does my party, the pro
 5. [parliamentary/committees-evidence] score=104.371↑T `committees-evidence:writtenevidence:121517:196016`
    **Outdoor and indoor air quality targets — AIR0023** — Mr Chris Todd AIR0023 Submission of evidence by Chris Todd I am an individual who has suffered increasing exposure over the past few years to air pollution both
 6. [parliamentary/pwdata-debates] score=103.500↑T `pwdata-debates:debates2006-02-14b:280`
    **Orders of the Day — Health Bill — New Clause 5 — Smoke-free premises: exemptions** — I could not agree more and will come on to that point. Health and safety concerns are sufficient reason for resisting the Government's original plans to exempt 
 7. [parliamentary/pwdata-debates] score=101.811↑T `pwdata-debates:debates2006-02-14b:195`
    **Orders of the Day — Health Bill — New Clause 5 — Smoke-free premises: exemptions** — As I have already said, I think that the arguments are extremely finely balanced. In the spirit of the free vote that we on the Government Benches will have, I 
 8. [parliamentary/pwdata-debates] score=100.524↑T `pwdata-debates:debates2005-11-29c:352`
    **Orders of the Day — Health Bill** — Thank you very much, Madam Deputy Speaker, for calling me to speak in the debate on the Second Reading of this very important Bill, which will improve the well-
 9. [parliamentary/pwdata-debates] score=100.490↑T `pwdata-debates:debates2005-11-29c:323`
    **Orders of the Day — Health Bill** — My hon. Friend is correct to say that that matter should be taken into account. However, the evidence shows that stopping smoking in public places does not incr
10. [parliamentary/pwdata-debates] score=100.426↑T `pwdata-debates:debates1981-07-28a:396`
    **Orders of the Day — Transport Bill — COMPULSORY WEARING OF SEAT BELTS** — The hon. Member for Faversham (Mr. Moate), my right hon. Friend the Member for Norwich, North (Mr. Ennals) and all those in favour of the proposal that is befor
11. [parliamentary/historic-hansard] score=98.487↑T `historic-hansard:S5LV0593P0:5083`
    **Lords: ("PART IVA — Smoking in Public Places** — Lord Belhaven and Stenton : My Lords, I have only three minutes and so I apologise to other noble Lords for not taking up the themes of their speeches. At the o
12. [parliamentary/pwdata-debates] score=98.225↑T `pwdata-debates:debates2011-06-22c:176`
    **Smoking in Private Vehicles** — I beg to move, That leave be given to bring in a Bill to require the Secretary of State to make provision for a ban on smoking in private vehicles where there a
13. [parliamentary/historic-hansard] score=97.844↑T `historic-hansard:S5LV0550P0:1107`
    **Lords: British Rail: Smoking Ban** — Lord Stoddart of Swindon : My Lords, I shall not argue about segregation on aircraft. Modern techniques make it possible to ensure that there is clean air as we
14. [other/petitions] score=96.950↑T `petitions:332981:1`
    **Ban all indoor tobacco smoking.** — Ban all indoor tobacco smoking. State: rejected · Signatures: 9 Protect people who choose not to smoke, children, the vulnerable, the NHS and public funds. Obli
15. [parliamentary/pwdata-lords] score=96.106↑T `pwdata-lords:daylord2004-04-23a:69`
    **Tobacco Smoking (Public Places and Workplaces) Bill [HL]** — My Lords, like other noble Lords, I welcome the opportunity the Bill presents to debate these important issues again. The Government share the noble Lord's desi
16. [parliamentary/pwdata-wrans] score=95.520↑T `pwdata-wrans:answers2010-07-07a:279`
    **HEALTH — Smoking** — Q (Greg Knight): To ask the Secretary of State for Health (1) whether his Department has made an assessment of whether the introduction of the smoking ban in Ju
17. [parliamentary/pwdata-lordswrans] score=95.343↑T `pwdata-lordswrans:lordswrans2000-07-24a:9`
    **Smoking in the Workplace** — Q (Lord Laird): asked Her Majesty's Government: What encouragement they give to private organisations to operate a "no smoking policy" in their workplaces. A (L
18. [parliamentary/pwdata-debates] score=94.816↑T `pwdata-debates:debates2006-02-14b:295`
    **Orders of the Day — Health Bill — New Clause 5 — Smoke-free premises: exemptions** — Amendment No. 8 would delete part 1 of the Bill in its entirety, which would force the Government and—dare I say it?—Her Majesty's official Opposition to think 
19. [parliamentary/pwdata-wrans] score=94.454↑T `pwdata-wrans:answers2004-06-29:279`
    **NORTHERN IRELAND — Smoking** — Q (Lady Hermon): To ask the Secretary of State for Northern Ireland what assessment has been made of the merits of instituting a ban on smoking in public places
20. [parliamentary/pwdata-debates] score=93.773↑T `pwdata-debates:debates2005-11-29c:356`
    **Orders of the Day — Health Bill** — A large part of England, anyway. Earlier, the right hon. Member for Charnwood (Mr. Dorrell) said that employers and employees are working gradually to provide s

### E5 (E/H1)
*Query:* When the Hunting Act 2004 was passed, what did ministers say about how it would be enforced?
*stream:* debates · *kind:* specific · *metric:* recall@20
*recall@20:* 100.0% · *MRR:* 1.000

Expected sources:
- ✓ @1 — Hunting Act 2004 ss.1–6
- ✓ @1 — Hansard 2003–04 enforcement passages

Top-20 retrieved:
 1. [parliamentary/pwdata-wrans] score=98.021↑T `pwdata-wrans:answers2008-06-24c:143`
    **HOME DEPARTMENT — Hunting** — Q (Vincent Cable): To ask the Secretary of State for the Home Department how many cases have been reported of threatening or abusive behaviour towards hunt moni
 2. [parliamentary/pwdata-debates] score=95.760↑T `pwdata-debates:debates2007-03-22b:428`
    **HUNTING ACT 2004** — I am grateful for the opportunity to raise before the House the issue of the enforcement of the Hunting Act 2004. As has often been said, hundreds of hours were
 3. [parliamentary/pwdata-westminster] score=94.373↑T `pwdata-westminster:westminster2022-04-25b:30`
    **Hunting — [David Mundell in the Chair]** — It is a pleasure to serve under your chairmanship, Mr Mundell. I thank my hon. Friend the Member for Newcastle upon Tyne North (Catherine McKinnell) , who is no
 4. [parliamentary/pwdata-westminster] score=93.161↑T `pwdata-westminster:westminster2019-03-20a:138`
    **Wildlife Crime — [Andrew Rosindell in the Chair]** — Like a few others present in the Chamber, I bear the scars of the 700 hours it took, in one capacity or another, to pass the Hunting Act 2004, which was introdu
 5. [parliamentary/pwdata-lords] score=93.142↑T `pwdata-lords:daylord2003-10-21a:105`
    **Hunting Bill** — My noble friend Lord Ullswater may well have put his finger on the issue. This is not, as the noble Lord, Lord Graham, believes, an animal welfare Bill—it was n
 6. [parliamentary/pwdata-debates] score=92.788↑T `pwdata-debates:debates2003-07-09:650`
    **Hunting Bill — New Clause 1 — Compensation** — In the Minister's introductory remarks a moment or two ago, he said that the process that had brought us to this point in our proceedings had been "interesting"
 7. [parliamentary/pwdata-lords] score=92.411↑T `pwdata-lords:daylord2004-10-12a:190`
    **Hunting Bill** — My Lords, first, perhaps I may congratulate my noble friend Lady Morris of Bolton on her excellent maiden speech. No doubt she will be relieved to hear that we 
 8. [parliamentary/pwdata-wrans] score=92.094↑T `pwdata-wrans:answers2008-02-18f:1049`
    **HOME DEPARTMENT — Hunting: Prosecutions** — Q (Stephen Hesford): To ask the Secretary of State for the Home Department how many prosecutions there have been for hunting foxes with dogs since 2005; and wha
 9. [parliamentary/pwdata-debates] score=91.610↑T `pwdata-debates:debates2003-06-30:542`
    **Hunting Bill — New Clause 13 — Registered Hunting: Absolute Bans: Deer, Hares, Foxes and Terrierwork** — I will not. The hon. Gentleman has had a good say today. I want to get on because others want to get in. Licensing has done nothing to abolish fox hunting, whic
10. [parliamentary/historic-hansard] score=91.234↑T `historic-hansard:S3V0006P0:3398`
    **Commons: PARLIAMENTARY REFORM—BILL FOR ENGLAND—CONSIDERATION OF THE REPORT.** — Mr. Hunt thought it would be better if Members of Parliament were left out of the Commission; it would be more satisfactory to the country. The noble Lord had s
11. [parliamentary/pwdata-debates] score=91.115↑T `pwdata-debates:debates2004-09-15:174`
    **Hunting Bill (Procedure)** — Let us get to the nub of the question of urgency. How can we say that this Bill is as urgent as the other Bills on which the Parliament Acts were used, when the
12. [parliamentary/pwdata-lords] score=91.040↑T `pwdata-lords:daylord2004-11-15a:242`
    **Hunting Bill** — My Lords, as we are now close to a decision in this House, I think that it is right to turn away from the arguments with which we have been familiar during the 
13. [parliamentary/pwdata-debates] score=90.948↑T `pwdata-debates:debates2003-06-30:551`
    **Hunting Bill — New Clause 13 — Registered Hunting: Absolute Bans: Deer, Hares, Foxes and Terrierwork** — The hon. Gentleman is absolutely right, and I pay tribute to the middle way group for trying to introduce some science and thought into the process. The fact is
14. [parliamentary/pwdata-lords] score=90.942↑T `pwdata-lords:daylord2001-03-07a:133`
    **Scotland Act 1998 (Transfer of Functions to the Scottish Ministers etc.) Order 2001** — My Lords, the question I had in mind to ask the Minister was a very simple one; namely, what does the order mean when it says that Scottish Ministers and a Mini
15. [parliamentary/historic-hansard] score=89.958↑T `historic-hansard:S3V0276P0:3157`
    **Commons: ORDERS OF THE DAY. — CLASS III.—LAW AND JUSTICE.** — MR. LEAMY rose to support the Amendment, and to mention one or two cases of hardship, in the hope of obtaining some information with regard to them from the rig
16. [parliamentary/pwdata-lords] score=89.443↑T `pwdata-lords:daylord2003-09-16a:123`
    **Hunting Bill** — My Lords, I have no interest to declare on this occasion. I do not hunt, and confine my sporting activities to the riverbank. I hope that the Government have no
17. [parliamentary/historic-hansard] score=88.574↑T `historic-hansard:S3V0305P0:2918`
    **Commons: ORDERS OF THE DAY. — SECOND READING.** — MR. DILLON (Mayo, E.) said, there was good reason why no Nationalists appeared to give evidence before the Commission of Inquiry at Derry. It was because the in
18. [parliamentary/pwdata-debates] score=88.056↑T `pwdata-debates:debates2007-03-22b:435`
    **HUNTING ACT 2004** — If my hon. Friend bears with me, I shall come to some of those issues shortly. The Act does not prevent hunts from meeting and it does not prevent activities su
19. [parliamentary/pwdata-lords] score=87.945↑T `pwdata-lords:daylord2004-10-12a:116`
    **Hunting Bill** — My Lords, all the arguments for and against hunting have been put forward ad nauseam; like most noble Lords, I do not propose particularly to add to them today.
20. [parliamentary/pwdata-debates] score=87.870↑T `pwdata-debates:debates2004-09-15:325`
    **Orders of the Day — Hunting Bill** — It is the hon. Gentleman who used the word "sabotaged". I would not wish to be impolite to their lordships, but I have to say that that term lends itself to the

### F1 (F/H2) [BILLS]
*Query:* Has anyone tried to ban single-use plastics completely? What happened?
*stream:* bills + debates · *kind:* specific · *metric:* recall@20
*recall@20:* 100.0% · *MRR:* 1.000

Expected sources:
- ✓ @1 — Plastics / Wet Wipes PMBs
- ✓ @1 — EPA 1990 s.140 SIs (straws/stirrers/plates)

Top-20 retrieved:
 1. [parliamentary/pwdata-lords] score=95.570↑T `pwdata-lords:daylord2024-02-13b:37`
    **Recycled Plastics - Question** — My Lords, my noble friend the Minister will be aware that Wales led the way in introducing a charge for single-use plastic bags. It was so successful that it wa
 2. [other/petitions] score=92.024↑T `petitions:584430:1`
    **Ban the sale of plastic wet wipes; affordable alternatives are widely available** — Ban the sale of plastic wet wipes; affordable alternatives are widely available State: closed · Signatures: 3955 · Opened: 2021-05-05 · Departments: Department 
 3. [other/petitions] score=91.888↑T `petitions:600659:1`
    **Ban the sale of plastic wet wipes; affordable alternatives are widely available** — Ban the sale of plastic wet wipes; affordable alternatives are widely available State: closed · Signatures: 463 · Opened: 2021-11-12 · Departments: Department f
 4. [parliamentary/pwdata-wrans] score=91.448↑T `pwdata-wrans:answers2024-03-19:185`
    **Department for Environment, Food and Rural Affairs — Plastics: Pollution** — Q (Sir Mark Hendrick): To ask the Secretary of State for Environment, Food and Rural Affairs, what assessment he has made of the implications for his policies o
 5. [parliamentary/pwdata-lordswrans] score=90.802↑T `pwdata-lordswrans:lordswrans2022-04-26:8`
    **Department for Environment, Food and Rural Affairs — Plastics: Packaging** — Q (Baroness Bennett of Manor Castle): To ask Her Majesty's Government, further to the discovery of microplastics in the lungs and blood of living people, what p
 6. [parliamentary/pwdata-wrans] score=89.690↑T `pwdata-wrans:answers2024-10-30:196`
    **Department for Environment, Food and Rural Affairs — Plastics: Waste** — Q (Josh Newbury): To ask the Secretary of State for Environment, Food and Rural Affairs, what discussions he has had with businesses on steps to reduce the (a) 
 7. [parliamentary/pwdata-wrans] score=89.585↑T `pwdata-wrans:answers2024-03-08:20`
    **Department for Environment, Food and Rural Affairs — Plastics: Waste Disposal** — Q (Sir Mark Hendrick): To ask the Secretary of State for Environment, Food and Rural Affairs, what steps he has taken to contribute towards the target in the Gl
 8. [parliamentary/pwdata-wrans] score=88.861↑T `pwdata-wrans:answers2021-09-21:188`
    **Department for Environment, Food and Rural Affairs — Plastics: Waste** — Q (Sarah Jones): To ask the Secretary of State for Environment, Food and Rural Affairs, what steps his Department is taking to ban the (a) export of plastic was
 9. [parliamentary/pwdata-wrans] score=88.839↑T `pwdata-wrans:answers2025-09-10:372`
    **Department for Environment, Food and Rural Affairs — Plastics: Pollution** — Q (Dr Luke Evans): To ask the Secretary of State for Environment, Food and Rural Affairs, what recent assessment he has made of the potential impact of his Depa
10. [parliamentary/pwdata-wrans] score=88.462↑T `pwdata-wrans:answers2024-04-23:96`
    **Department for Environment, Food and Rural Affairs — Plastics: Waste** — Q (Claire Hanna): To ask the Secretary of State for Environment, Food and Rural Affairs, what progress her Department has made on achieving its target to elimin
11. [parliamentary/pwdata-wrans] score=88.171↑T `pwdata-wrans:answers2022-11-24:239`
    **Department for Environment, Food and Rural Affairs — Plastics: Pollution Control** — Q (Mr Tanmanjeet Singh Dhesi): To ask the Secretary of State for Environment, Food and Rural Affairs, what recent steps has she taken to help reduce plastic pol
12. [parliamentary/pwdata-debates] score=87.974↑T `pwdata-debates:debates2021-11-02c:151`
    **Plastics (Wet Wipes)** — I beg to move, That leave be given to bring in a Bill to prohibit the manufacture and sale of wet wipes containing plastic; and for connected purposes. I thank 
13. [parliamentary/pwdata-wrans] score=87.750↑T `pwdata-wrans:answers2022-01-12:305`
    **Department for Environment, Food and Rural Affairs — Plastics** — Q (Tulip Siddiq): To ask the Secretary of State for Environment, Food and Rural Affairs, what assessment he has made of the potential merits of banning all non-
14. [other/petitions] score=87.661↑T `petitions:332920:1`
    **Ban single use plastic bags across the country, including smaller retailers.** — Ban single use plastic bags across the country, including smaller retailers. State: rejected · Signatures: 15 To impose a ban across the next 12 months to ban s
15. [parliamentary/pwdata-lordswrans] score=87.520↑T `pwdata-lordswrans:lordswrans2023-09-12:5`
    **Department for Environment, Food and Rural Affairs — Plastics: Pollution** — Q (Lord Redesdale): To ask His Majesty's Government what steps they are taking to (1) prevent, (2) reduce, and (3) eliminate, plastic pollution. A (Lord Benyon)
16. [parliamentary/pwdata-wrans] score=87.174↑T `pwdata-wrans:answers2023-03-23:133`
    **Department for Environment, Food and Rural Affairs — Plastics: Waste** — Q (Dean Russell): To ask the Secretary of State for Environment, Food and Rural Affairs, what steps her Department has taken to support small businesses to redu
17. [parliamentary/pwdata-lordswrans] score=87.114↑T `pwdata-lordswrans:lordswrans2023-01-26:56`
    **Department for Environment, Food and Rural Affairs — Plastics: Waste** — Q (Baroness Jones of Whitchurch): To ask His Majesty's Government what consideration they are giving to a ban on the use of all non-medical single use plastics.
18. [parliamentary/pwdata-wrans] score=87.068↑T `pwdata-wrans:answers2019-10-17:124`
    **Department for Environment, Food and Rural Affairs — Plastics** — Q (Dr Dan Poulter): To ask the Secretary of State for Environment, Food and Rural Affairs, what plans she has to reduce the availability of single use plastics;
19. [other/petitions] score=86.709↑T `petitions:636541:1`
    **Ban single-use plastic cutlery and plates in schools** — Ban single-use plastic cutlery and plates in schools State: closed · Signatures: 149 · Opened: 2023-04-17 · Departments: Department for Education There is too m
20. [parliamentary/pwdata-lordswrans] score=85.893↑T `pwdata-lordswrans:lordswrans2020-08-07:7`
    **Department for Environment, Food and Rural Affairs — Plastics: Seas and Oceans** — Q (lord pendry): To ask Her Majesty's Government what estimate they have made of the amount of ocean plastic debris globally; and what steps they are taking to 

### F2 (F/H1) [BILLS]
*Query:* Previous Private Members’ Bills attempting to restrict fireworks sales, and why they failed
*stream:* bills + debates · *kind:* specific · *metric:* recall@20
*recall@20:* 100.0% · *MRR:* 1.000

Expected sources:
- ✓ @1 — Repeated Fireworks Bills
- ✓ @8 — Fireworks Act 2003

Top-20 retrieved:
 1. [parliamentary/committees-evidence] score=112.685↑T `committees-evidence:writtenevidence:100831:146622`
    **Fireworks inquiry — FWS0159** — FWS0159 - Evidence on Fireworks Written evidence submitted by Mr Paul Read (FWS0159) &#xa0; Fireworks are explosive and as such I cannot understand why they are
 2. [parliamentary/pwdata-westminster] score=105.003↑T `pwdata-westminster:westminster2024-12-09a:29`
    **Fireworks: Sale and Use — [Sir Edward Leigh in the Chair]** — It is a pleasure to serve under your chairmanship, Sir Edward. I thank the hon. Member for Keighley and Ilkley (Robbie Moore) for presenting this debate on rest
 3. [other/petitions] score=102.328↑T `petitions:756386:1`
    **Ban private fireworks to protect animals** — Ban private fireworks to protect animals State: rejected · Signatures: 15 Introduce legislation to ban the sale and use of private consumer fireworks, restricti
 4. [parliamentary/committees-evidence] score=101.857↑T `committees-evidence:writtenevidence:101336:146797`
    **Fireworks inquiry — FWS0320** — FWS0320 - Evidence on Fireworks Written evidence submitted by Marisa Morgan (FWS0320) &#xa0; To whom it may concern, &#xa0; Please find below my written submiss
 5. [parliamentary/pwdata-debates] score=100.218↑T `pwdata-debates:debates2003-02-28:141`
    **Fireworks Bill** — Last year, I received more complaints from constituents about fireworks than ever before, as did Bournemouth borough council, which serves my constituency. In r
 6. [parliamentary/pwdata-westminster] score=99.563↑T `pwdata-westminster:westminster2002-10-30:39`
    **Fireworks** — Under-16s are covered by legislation, but provisions under a Home Office Act—I am not prepared to quote it off the top of my head because I do not have it in fr
 7. [parliamentary/pwdata-debates] score=99.516↑T `pwdata-debates:debates2003-02-28:153`
    **Fireworks Bill** — I congratulate the hon. Member for Hamilton, South (Mr. Tynan) on his good fortune and all the other Members who have worked on this issue over the years. The h
 8. [parliamentary/pwdata-wrans] score=98.383↑T `pwdata-wrans:answers2006-11-06c:104`
    **ENVIRONMENT FOOD AND RURAL AFFAIRS — Fireworks** — Q (Philip Hollobone): To ask the Secretary of State for Environment, Food and Rural Affairs what discussions his Department has held with the Department of Trad
 9. [parliamentary/committees-evidence] score=97.926↑T `committees-evidence:writtenevidence:101262:146746`
    **Fireworks inquiry — FWS0268** — FWS0268 - Evidence on Fireworks Written evidence submitted by Mr Frank Winfield (FWS0268) If fireworks had only just been invented and offered for sale to the p
10. [parliamentary/pwdata-westminster] score=97.232↑T `pwdata-westminster:westminster2021-11-08a:29`
    **Fireworks: Sale and Use — [Derek Twigg in the Chair]** — In a moment. This is my sixth debate on this issue, and I remember when the illusion of action was played out in previous debates, with talk of consultations an
11. [parliamentary/pwdata-debates] score=97.068↑T `pwdata-debates:debates2003-02-28:152`
    **Fireworks Bill** — The hon. Gentleman is absolutely right. That is why I want the Bill to do two specific things, and I hope that the hon. Member for Hamilton, South will deal wit
12. [parliamentary/committees-evidence] score=96.433↑T `committees-evidence:writtenevidence:101124:146703`
    **Fireworks inquiry — FWS0227** — FWS0227 - Evidence on Fireworks Written evidence submitted by Yvonne Cullen (FWS0227) &#xa0; Current regulations do not prevent fireworks being set off at diffe
13. [parliamentary/pwdata-debates] score=95.412↑T `pwdata-debates:debates2002-02-27:120`
    **Fireworks** — I beg to move, That leave be given to bring in a Bill to make provision with respect to the retail sale of fireworks and use of fireworks by the general public.
14. [parliamentary/pwdata-debates] score=95.379↑T `pwdata-debates:debates2002-01-08:109`
    **Control of Fireworks** — I beg to move, That leave be given to bring in a Bill to make provision with respect to the sale and use of fireworks; and for connected purposes. I am by no me
15. [parliamentary/pwdata-westminster] score=94.785↑T `pwdata-westminster:westminster2024-12-09a:24`
    **Fireworks: Sale and Use — [Sir Edward Leigh in the Chair]** — My hon. Friend is right. Those who use fireworks responsibly would be little concerned about a reduction in the noise level. It is a sensible call that many peo
16. [parliamentary/pwdata-lords] score=94.635↑T `pwdata-lords:daylord2003-07-04a:47`
    **Fireworks Bill** — My Lords, I thank my noble friend Lady Ramsay of Cartvale for bringing forward this important Bill and I was glad to note the general support expressed for it d
17. [parliamentary/pwdata-westminster] score=94.125↑T `pwdata-westminster:westminster2024-12-09a:11`
    **Fireworks: Sale and Use — [Sir Edward Leigh in the Chair]** — It is a pleasure to see you in the Chair today, Sir Edward. I thank the hon. Member for Keighley and Ilkley (Robbie Moore) for presenting the petition. We have 
18. [parliamentary/committees-evidence] score=93.296↑T `committees-evidence:writtenevidence:99838:145498`
    **Fireworks inquiry — FWS0016** — FWS0016 - Evidence on Fireworks Written evidence submitted by James Walker (FWS0016) Submission to The Petitions Committee into fireworks law Balance between sa
19. [parliamentary/pwdata-westminster] score=93.276↑T `pwdata-westminster:westminster2018-11-26a:52`
    **Fireworks: Public Sales — [Steve McCabe in the Chair]** — It is a pleasure to serve under your chairmanship, Mr Howarth. I pay tribute to the hon. Member for Warrington North (Helen Jones) not only for introducing the 
20. [parliamentary/committees-evidence] score=93.256↑T `committees-evidence:writtenevidence:100836:146625`
    **Fireworks inquiry — FWS0162** — FWS0162 - Evidence on Fireworks Written evidence submitted by Rosie Ingham (FWS0162) &#xa0; I would like to see the removal of the sale of fireworks to the gene

### F3 (F/H2) [BILLS]
*Query:* I want a law making landlords accept tenants with pets. Has this been tried?
*stream:* bills + debates · *kind:* specific · *metric:* recall@20
*recall@20:* 100.0% · *MRR:* 1.000

Expected sources:
- ✓ @1 — Dogs and Domestic Animals (Accommodation) Bill
- ✓ @5 — Renters (Reform) Bill 2023 / Renters’ Rights Act 2025 pets

Top-20 retrieved:
 1. [parliamentary/pwdata-wrans] score=112.587↑T `pwdata-wrans:answers2021-10-18:219`
    **Department for Levelling Up, Housing and Communities — Private Rented Housing: Pets** — Q (Zarah Sultana): To ask the Secretary of State for Levelling Up, Housing and Communities, if he will introduce legislative proposals to prevent landlords from
 2. [parliamentary/pwdata-lordswrans] score=108.731↑T `pwdata-lordswrans:lordswrans2022-06-29:52`
    **Department for Levelling Up, Housing and Communities — Rented Housing: Pets** — Q (Baroness Hayman of Ullock): To ask Her Majesty's Government what steps they are taking, if any, to support individuals who rent and have a pet (1) dog, or (2
 3. [parliamentary/pwdata-lordswrans] score=108.291↑T `pwdata-lordswrans:lordswrans2022-06-29:53`
    **Department for Levelling Up, Housing and Communities — Tenancy Agreements: Pets** — Q (Baroness Hayman of Ullock): To ask Her Majesty's Government what assessment they have made of the uptake of the revised Model Tenancy Agreement to support mo
 4. [other/petitions] score=108.196↑T `petitions:550148:1`
    **I want landlords to be more accepting of tenants with pets.** — I want landlords to be more accepting of tenants with pets. State: rejected · Signatures: 21 I want parliment to stop landlords to stop discriminating against p
 5. [parliamentary/pwdata-wrans] score=107.228↑T `pwdata-wrans:answers2023-05-26:32`
    **Department for Levelling Up, Housing and Communities — Social Rented Housing: Pets** — Q (Julian Knight): To ask the Secretary of State for Levelling Up, Housing and Communities, if his Department will make an assessment of the potential merits of
 6. [other/petitions] score=106.649↑T `petitions:549192:1`
    **A PETITION TO ENCOURAGE PRIVATE LANDLORDS TO ACCEPT DOMESTIC PETS.** — A PETITION TO ENCOURAGE PRIVATE LANDLORDS TO ACCEPT DOMESTIC PETS. State: rejected · Signatures: 9 Tenants pay a deposit to cover damages including from pets!! 
 7. [other/petitions] score=101.465↑T `petitions:634582:1`
    **Stop landlords discrimination against having pets** — Stop landlords discrimination against having pets State: rejected · Signatures: 8 I want the government to make a law that says landlords can no longer say NO P
 8. [parliamentary/pwdata-wrans] score=101.383↑T `pwdata-wrans:answers2021-03-16:255`
    **Ministry of Housing, Communities and Local Government — Rented Housing: Pets** — Q (Rachael Maskell): To ask the Secretary of State for Housing, Communities and Local Government, with reference to the changes outlined in the recently revised
 9. [parliamentary/pwdata-wrans] score=100.386↑T `pwdata-wrans:answers2024-09-17:184`
    **Ministry of Housing, Communities and Local Government — Private Rented Housing: Pets** — Q (Claire Hazelgrove): To ask the Secretary of State for Housing, Communities and Local Government, whether she has made a recent assessment of the level of ava
10. [parliamentary/pwdata-wrans] score=100.352↑T `pwdata-wrans:answers2021-09-24:83`
    **Department for Levelling Up, Housing and Communities — Rented Housing: Pets** — Q (Emma Hardy): To ask the Secretary of State for Levelling Up, Housing and Communities, what assessment his Department has made of the potential merits of remo
11. [other/petitions] score=99.536↑T `petitions:586033:1`
    **Make it illegal for landlords to refuse pets.** — Make it illegal for landlords to refuse pets. State: rejected · Signatures: 10 The landlord should not discriminate against people with animals and should allow
12. [parliamentary/pwdata-wrans] score=97.166↑T `pwdata-wrans:answers2022-04-26:612`
    **Department for Levelling Up, Housing and Communities — Private Rented Housing: Pets** — Q (Mr Virendra Sharma): To ask the Secretary of State for Levelling Up, Housing and Communities, whether the Government plans to take steps to support private r
13. [parliamentary/pwdata-lords] score=96.295↑T `pwdata-lords:daylord2021-06-15b:36`
    **Private Landlords: Tenants with Pets - Question** — My Lords, we have set out a model tenancy agreement that encourages wider pet ownership. It also ensures that the landlord must give a clear reason why they wil
14. [parliamentary/pwdata-wrans] score=95.815↑T `pwdata-wrans:answers2024-12-05:220`
    **Ministry of Housing, Communities and Local Government — Rented Housing: Pets** — Q (Sam Carling): To ask the Secretary of State for Housing, Communities and Local Government, what progress her Department has made on improving access to pet f
15. [parliamentary/pwdata-wrans] score=95.755↑T `pwdata-wrans:answers2023-04-03:35`
    **Department for Levelling Up, Housing and Communities — Private Rented Housing: Pets** — Q (Margaret Ferrier): To ask the Secretary of State for Levelling Up, Housing and Communities, what assessment he has made of the potential merits of ensuring t
16. [parliamentary/pwdata-wrans] score=95.002↑T `pwdata-wrans:answers2021-02-25:250`
    **Ministry of Housing, Communities and Local Government — Private Rented Housing: Pets** — Q (Bill Esterson): To ask the Secretary of State for Housing, Communities and Local Government, what steps he is taking to support pet owners in the private ren
17. [legislation/regional] score=69.777 `regional:asp/2025/13:section-35`
    35 1 The 2016 Act is modified as follows. 2 After Part 5 (termination) insert— Part 5A keeping pets and making changes to let property Chapter 1 Keeping pets Te
18. [parliamentary/pwdata-debates] score=50.025 `pwdata-debates:debates2021-03-18e:177`
    **Business of the House** — Indeed, allegedly, some people even keep tarantulas, though I do not believe that that particular right hon. Friend of mine is resident or has been resident in 
19. [parliamentary/committees-evidence] score=48.538 `committees-evidence:writtenevidence:110752:172168`
    **Reforming the Private Rented Sector — RRS0209** — Written evidence submitted by Platinum Property Partners [RRS 209] Do you want to hurt the vulnerable and help the bully? Would you be happy for your daughter t
20. [parliamentary/pwdata-lords] score=47.085 `pwdata-lords:daylord2025-10-14c:96`
    **Renters’ Rights Bill - Commons Reasons and Amendments — Motion A1 (as an amendment to Motion A)** — I thank your Lordships for your thoughts and speeches. I am pleased about, and support, the amendment from the noble Baroness, Lady Grender, being accepted by t

### F4 (F/H1) [BILLS]
*Query:* Attempts since 2010 to introduce proportional representation for Westminster elections
*stream:* bills + debates · *kind:* specific · *metric:* recall@20
*recall@20:* 50.0% · *MRR:* 1.000

Expected sources:
- ✓ @1 — PR / PMB attempts
- ✗ MISS — Parliamentary Voting System and Constituencies Act 2011

Top-20 retrieved:
 1. [parliamentary/pwdata-debates] score=84.265↑T `pwdata-debates:debates2003-12-02:43`
    **BCCI — Elections** — Does the Minister recall that when proportional representation was introduced for the Scottish elections we were promised that voting participation would increa
 2. [parliamentary/pwdata-debates] score=83.267↑T `pwdata-debates:debates2003-12-03:354`
    **PROPORTIONAL VOTING** — As I was saying, I have already promised the Minister that I will leave him a good amount of time to respond to this debate and to take numerous interventions i
 3. [parliamentary/pwdata-westminster] score=81.178↑T `pwdata-westminster:westminster2006-07-20c:6`
    **[Mr. Martin Caton in the Chair] — Boundaries, Voting and Representation (Scotland)** — I have never been keen on first past the post and prefer proportional representation, but the mess that I witnessed during elections to the Scottish Parliament 
 4. [parliamentary/pwdata-debates] score=80.498↑T `pwdata-debates:debates2003-12-03:358`
    **PROPORTIONAL VOTING** — I congratulate the hon. Member for Yeovil (Mr. Laws) on allowing us an opportunity to look in more detail at the cornucopia of luscious psephological fruit that
 5. [parliamentary/pwdata-lords] score=74.924↑T `pwdata-lords:daylord2006-01-19b:53`
    **Elections: Arbuthnott Commission** — My Lords, does the noble Lord agree that there is a great deal to be studied with care and that it would be wrong to jump to conclusions? The underlying support
 6. [parliamentary/pwdata-debates] score=74.539↑T `pwdata-debates:debates1998-03-12a:237`
    **Orders of the Day — European Parliamentary Elections Bill — REVIEW OF ALTERNATIVE VOTING SYSTEMS** — I accept that there is a difference between the Westminster Parliament and the European Parliament—indeed, many of us feel that the European Parliament is not s
 7. [parliamentary/pwdata-debates] score=74.376↑T `pwdata-debates:debates2025-01-30a:328`
    **Proportional Representation: General Elections** — I absolutely agree and will come on to that later. Young people believe that the system does not deliver, and that their voice is not heard. These statistics sh
 8. [parliamentary/pwdata-lordswms] score=73.897↑T `pwdata-lordswms:lordswms2008-01-24b:2`
    **Elections: Review of Voting Systems** — My honourable friend the Minister of State (Michael Wills) has made the following Written Ministerial Statement. The Government have today laid before Parliamen
 9. [other/early-day-motions] score=73.606↑T `early-day-motions:49843:1`
    **VOTING SYSTEM FOR GENERAL ELECTIONS** — VOTING SYSTEM FOR GENERAL ELECTIONS EDM 591 · Tabled: 2016-10-25 · Primary sponsor: Mr Chuka Umunna (Labour, Streatham) · Signatures: 71 That this House welcome
10. [parliamentary/pwdata-debates] score=72.827↑T `pwdata-debates:debates1997-11-25a:213`
    **Orders of the Day — European Parliamentary Elections Bill** — Well, these days it is very easy to get a place. Professor Plant produced a report recommending a regional list system for those elections. That policy was endo
11. [parliamentary/historic-hansard] score=72.473↑T `historic-hansard:S5LV0517P0:1737`
    **Lords: European Parliament Electoral Reform Bill [H.L.]** — Baroness Ewart-Biggs : My Lords, the noble Lord, Lord Eonham-Carter, made a very good case for his Bill and I was extremely interested in the speech of the nobl
12. [parliamentary/historic-hansard] score=72.220↑T `historic-hansard:S5LV0518P0:2244`
    **Lords: European Parliament Electoral Reform Bill [H.L.]** — Lord Stoddart of Swindon : Yes, but that is for the future and the Labour Party has not yet decided as to whether a Scottish assembly should be elected by propo
13. [parliamentary/pwdata-debates] score=72.215↑T `pwdata-debates:debates2016-03-04b:121`
    **Illegal Immigrants (Criminal Sanctions) Bill — European Parliament Elections Bill** — As my hon. Friend will know, this country agreed to change the electoral system at European level from first past the post, and having done so, it would be fair
14. [parliamentary/pwdata-debates] score=71.781↑T `pwdata-debates:debates2006-01-30c:325`
    **Orders of the Day — Government of Wales Bill — [3rd Allotted Day] — Clause 7 — Candidates at General** — We now come to one of the meatier sections of the Bill, as I am sure the Secretary of State appreciates; I see him grinning. It is indicative of the strength of
15. [parliamentary/pwdata-lordswrans] score=71.400↑T `pwdata-lordswrans:lordswrans2022-05-23:7`
    **Northern Ireland Office — Northern Ireland Assembly: Elections** — Q (Lord Hylton): To ask Her Majesty's Government what plans they have, if any, to introduce proportional representation into elections for the Northern Ireland 
16. [parliamentary/pwdata-debates] score=71.395↑T `pwdata-debates:debates1977-07-06a:183`
    **Orders of the Day — EUROPEAN ASSEMBLY ELECTIONS BILL** — That is the case and as a Welshman born and bred I am glad that it is, because we are part of the United Kingdom. Wales is not independent and the people of Wal
17. [parliamentary/historic-hansard] score=71.196↑T `historic-hansard:S5LV0527P0:395`
    **Lords: Proportional Representation** — Lord Reay : My Lords, the noble Lord is quite right. In Northern Ireland proportional representation is used for local government elections and European electio
18. [parliamentary/historic-hansard] score=70.551↑T `historic-hansard:S5LV0380P0:1792`
    **Lords: REPRESENTATION OF THE PEOPLE (AMENDMENT) BILL [H.L.]** — Lord BANKS : My Lords, I beg to move that this Bill be now read a second time. The Bill amends the Representation of the People Act 1949 so as to provide for th
19. [parliamentary/pwdata-debates] score=70.450↑T `pwdata-debates:debates1985-03-07a:357`
    **Northern Ireland (Local Elections)** — In a sense, we are engaged in a two-tier discussion. On one tier, hon. Members have been seeking clarification of many important points which should be cleared 
20. [other/petitions] score=70.314↑T `petitions:300274:1`
    **Introduce a form of proportional representation for all UK elections** — Introduce a form of proportional representation for all UK elections State: closed · Signatures: 10135 · Opened: 2020-03-06 · Departments: Cabinet Office First 

### F5 (F/H2) [BILLS]
*Query:* Has Parliament ever tried to make first aid training compulsory in schools?
*stream:* bills + debates · *kind:* specific · *metric:* recall@20
*recall@20:* 100.0% · *MRR:* 1.000

Expected sources:
- ✓ @1 — Emergency First Aid Education Bill 2015
- ✓ @8 — Children and Social Work Act 2017 s.34 (statutory RSHE)

Top-20 retrieved:
 1. [parliamentary/pwdata-debates] score=92.832↑T `pwdata-debates:debates2015-11-20a:278`
    **Compulsory Emergency First Aid Education (State-funded Secondary Schools) Bill** — Damage could be done if the person has not had a heart attack. I am just basing what I am saying on what I was told when I did my CPR training. There are other 
 2. [parliamentary/pwdata-debates] score=92.645↑T `pwdata-debates:debates2015-11-20a:274`
    **Compulsory Emergency First Aid Education (State-funded Secondary Schools) Bill** — I did not make a statement; I said that I was speaking about my personal opinion. I do not want to undermine the superb training that our voluntary organisation
 3. [other/petitions] score=92.615↑T `petitions:764819:1`
    **Make first aid education compulsory in all UK schools** — Make first aid education compulsory in all UK schools State: rejected · Signatures: 10 We want the Government to make first aid training a compulsory part of th
 4. [other/petitions] score=91.471↑T `petitions:643606:1`
    **Make it compulsory for schools to first aid train all staff** — Make it compulsory for schools to first aid train all staff State: closed · Signatures: 60 · Opened: 2023-09-18 · Departments: Department for Education This cou
 5. [parliamentary/pwdata-wrans] score=90.477↑T `pwdata-wrans:answers2012-06-28d:108`
    **EDUCATION — First Aid: Training** — Q (Justin Tomlinson): To ask the Secretary of State for Education (1) how many (a) teachers and (b) childminders in (i) Swindon and (ii) England are first aid t
 6. [parliamentary/pwdata-debates] score=90.028↑T `pwdata-debates:debates2015-11-20a:272`
    **Compulsory Emergency First Aid Education (State-funded Secondary Schools) Bill** — May I clarify the point that I made in an earlier intervention? If somebody has a pulse that cannot be detected, or if somebody is breathing very shallowly, som
 7. [other/petitions] score=86.874↑T `petitions:767525:1`
    **Make First Aid Education Mandatory in all UK schools.** — Make First Aid Education Mandatory in all UK schools. State: rejected · Signatures: 6 Introduce compulsory first aid education in all UK schools, including CPR,
 8. [parliamentary/pwdata-wrans] score=86.750↑T `pwdata-wrans:answers2020-12-08:153`
    **Department for Education — First Aid: Secondary Education** — Q (Andrew Rosindell): To ask the Secretary of State for Education, what assessment he has made of the potential merits of making first-aid training a compulsory
 9. [other/petitions] score=85.811↑T `petitions:754302:1`
    **Make First Aid Education Compulsory for All Secondary School Students** — Make First Aid Education Compulsory for All Secondary School Students State: rejected · Signatures: 19 We call on the UK Government to introduce compulsory firs
10. [other/petitions] score=85.648↑T `petitions:634117:1`
    **Make first aid a compulsory part of the school curriculum** — Make first aid a compulsory part of the school curriculum State: rejected · Signatures: 7 Make first aid, recovery position, etc. a compulsory part of the schoo
11. [parliamentary/pwdata-wrans] score=85.528↑T `pwdata-wrans:answers2025-10-14:187`
    **Department for Education — Teachers: First Aid** — Q (Damien Egan): To ask the Secretary of State for Education, whether her Department has made an assessment of the potential merits of introducing introducing c
12. [other/petitions] score=85.152↑T `petitions:644245:1`
    **Make First Aid & Mental Health 1st Aid mandatory in schools & further education** — Make First Aid & Mental Health 1st Aid mandatory in schools & further education State: rejected · Signatures: 7 I would like Parliament to make an Act stating t
13. [parliamentary/pwdata-debates] score=84.861↑T `pwdata-debates:debates2015-11-20a:281`
    **Compulsory Emergency First Aid Education (State-funded Secondary Schools) Bill** — My hon. Friend makes a very good point that merely passing a piece of legislation and enshrining something in law does nothing to guarantee the outcome at the e
14. [parliamentary/pwdata-debates] score=83.756↑T `pwdata-debates:debates2015-11-20a:279`
    **Compulsory Emergency First Aid Education (State-funded Secondary Schools) Bill** — As always, it is a great pleasure to follow my hon. Friend the Member for South East Cornwall (Mrs Murray) . I congratulate the hon. Member for Erith and Thames
15. [other/petitions] score=83.436↑T `petitions:642184:1`
    **Make learning about money (taxes, investments, bills) compulsory in schools** — Make learning about money (taxes, investments, bills) compulsory in schools State: rejected · Signatures: 6 I would like Parliament to add compulsory presentati
16. [parliamentary/pwdata-wrans] score=82.247↑T `pwdata-wrans:answers2021-07-07:82`
    **Department for Education — Secondary Education: First Aid** — Q (Sir Mark Hendrick): To ask the Secretary of State for Education, what assessment he has made of the potential merits of including CPR as a compulsory part of
17. [parliamentary/pwdata-wrans] score=81.715↑T `pwdata-wrans:answers2018-07-19:50`
    **Department of Health and Social Care — Mental Health: First Aid** — Q (Adam Afriyie): To ask the Secretary of State for Health and Social Care, what steps his Department has taken to promote mental health first aid. A (Jackie Do
18. [other/petitions] score=81.339↑T `petitions:741416:1`
    **Make First Aid and Seizure Training Mandatory in All Schools** — Make First Aid and Seizure Training Mandatory in All Schools State: rejected · Signatures: 21 Change the law so that all schools must provide age-appropriate fi
19. [parliamentary/pwdata-debates] score=81.031↑T `pwdata-debates:debates2015-11-20a:249`
    **Compulsory Emergency First Aid Education (State-funded Secondary Schools) Bill** — It would be very worth while if everybody joined the scouts. It would be very worth while if everybody joined the guides. It would be very worth while if everyb
20. [parliamentary/pwdata-westminster] score=81.008↑T `pwdata-westminster:westminster2015-03-10a:31`
    **First Aid Techniques: National Curriculum — [Sir David Amess intheChair]** — The hon. and learned Gentleman clearly caught sight of my speech before he raised his point. I was about to go on to say that Mandy Hobbs was really lucky, too.

### B6 (B/H2)
*Query:* I want to revoke MiFID II
*stream:* legislation · *kind:* specific · *metric:* recall@20
*recall@20:* 0.0% · *MRR:* 0.000

Expected sources:
- ✗ MISS — FSMA 2023 — revocation framework (ukpga/2023/29; s.1+Sch 1, Sch 2 UK MiFID amendments)
- ✗ MISS — FSMA 2000 (Markets in Financial Instruments) Regs 2017 (uksi/2017/701)
- ✗ MISS — Retained/assimilated MiFIR — Reg (EU) 600/2014 (eur/2014/600)
- ✗ MISS — FCA Handbook COBS + SYSC (fca-handbook)
- ✗ MISS — FSMA 2000 — framework Act (ukpga/2000/8)
- ✗ MISS — Post-Brexit onshoring SIs (uksi/2019/1390; uksi/2021/1388)

Top-20 retrieved:
 1. [guidance/hmrc-manuals] score=65.095↑T `hmrc-manuals:hmrc-internal-manuals/vat-finance-manual/vatfin7550:1`
    **VATFIN7550 — Intermediaries: Brokers: MiFID II research** — MiFID II (Market in Financial Instruments Directive) originates from the European Commission and seeks to provide a European-wide legislative framework for regu
 2. [guidance/hmrc-manuals] score=64.561↑T `hmrc-manuals:hmrc-internal-manuals/stamp-taxes-shares-manual/stsm121050:1`
    **STSM121050 — Financial markets: background: Markets in Financial Instruments Directive II (MiFID II)** — MiFID II (Directive 2014/65/EU) originates from the European Commission and seeks to provide a European-wide legislative framework for regulating the operation 
 3. [guidance/quangos-govuk] score=60.477↑T `quangos-govuk:government/publications/mifid-ii-rpc-opinion:2`
    **RPC Opinion: MiFID II** — Date of issue: 26/06/18 www.gov.uk/rpc 1 Opinion: EANDCB validation O rigin : d omestic RPC reference number: RPC - 4261/4262/4263/4264/4265/4267/4268/4269/4270
 4. [guidance/quangos-govuk] score=60.312↑T `quangos-govuk:government/publications/extension-of-mifid-ii-product-governance-provisions-rpc-opinion:1`
    **Extension of MiFID II product governance provisions: RPC Opinion** — This is the RPC’s opinion on FCA’s EANDCB validation impact assessment for the MiFID II product governance provisions to non-MiFID firms.
 5. [guidance/quangos-govuk] score=56.699↑T `quangos-govuk:government/publications/extension-of-mifid-ii-product-governance-provisions-rpc-opinion:2`
    **RPC Opinion: Extension of MiFID II product governance provisions to non-MiFID firms** — Opinion: EANDCB validation Origin: domestic RPC reference number: RPC-4273(1)-HMT-FCA Date of implementation: January 2018 Date of issue:1 st August 2018 www.go
 6. [guidance/quangos-govuk] score=52.699↑T `quangos-govuk:government/publications/mifid-ii-rpc-opinion:1`
    **MiFID II: RPC Opinion** — This is the RPC’s opinion on FCA’s validation impact assessments for the MiFID II: inducements; research and inducement; taping; best-execution; client categori
 7. [guidance/quangos-govuk] score=50.059↑T `quangos-govuk:government/publications/future-of-computer-trading-in-financial-markets-mifid-ii-working-paper:1`
    **Future of computer trading in financial markets: MiFID II - working paper** — This report presents interim findings of the Foresight project on computer trading. In particular, it considers the costs, risks and benefits of 6 possible regu
 8. [guidance/quangos-govuk] score=49.292↑T `quangos-govuk:government/publications/computer-trading-economic-impact-of-mifid-ii-proposals-on-computer-trading:1`
    **Computer trading: economic impact of MiFID II proposals on computer trading** — This report provides an evidence-based analysis of a number of measures targeted at computer trading. Some of these measures were included in the European Commi
 9. [guidance/hmrc-manuals] score=47.587↑T `hmrc-manuals:hmrc-internal-manuals/stamp-taxes-shares-manual/stsm121030:1`
    **STSM121030 — Financial markets: background: Markets in Financial Instruments Directive (MiFID)** — There were further major changes to how the European financial markets operate with the introduction in 2007 of the Markets in Financial Instruments Directive (
10. [legislation/explanatory-memoranda] score=47.150 `explanatory-memoranda:em:uksi/2017/488:1`
    **Explanatory Memorandum: uksi/2017/488** — TNA/EM/10-2015.1 1 EXPLANATORY MEMORANDUM TO THE FINANCIAL SERVICES AND MARKETS ACT 2000 (REGULATED ACTIVITIES) (AMENDMENT) ORDER 2017 2017 No. 488 1. Introduct
11. [legislation/explanatory-memoranda] score=45.552 `explanatory-memoranda:em:uksi/2017/699:1`
    **Explanatory Memorandum: uksi/2017/699** — TNA/EM/10-2015.1 1 EXPLANATORY MEMORANDUM TO THE DATA REPORTING SERVICES REGULATIONS 2017 2017 No. 699 1. Introduction 1.1 This explanatory memorandum has been 
12. [legislation/explanatory-memoranda] score=45.530 `explanatory-memoranda:em:uksi/2018/786:1`
    **Explanatory Memorandum: uksi/2018/786** — TNA/EM/10-2015.1 1 EXPLANATORY MEMORANDUM TO THE FINANCIAL SERVICES AND MARKETS ACT 2000 (PROSPECTUS AND MARKETS IN FINANCIAL INSTRUMENTS) REGULATIONS 2018 2018
13. [legislation/si-2010plus] score=42.164 `si-2010plus:uksi/2014/2444:article-2`
    **Appointed day** — 2 1st November 2014 is the day appointed for the coming into force of the following provisions of the Gambling (Licensing and Advertising) Act 2014— a section 1
14. [legislation/explanatory-memoranda] score=39.742 `explanatory-memoranda:em:uksi/2018/1403:1`
    **Explanatory Memorandum: uksi/2018/1403** — DExEU/EM/7-2018.2 1 EXPLANATORY MEMORANDUM TO THE MARKETS IN FINANCIAL INSTRUMENTS (AMENDMENT) (EU EXIT) REGULATIONS 2018 2018 No. 1403 1. Introduction 1.1 This
15. [legislation/si-2010plus] score=37.424 `si-2010plus:uksi/2019/145:schedule-2-paragraph-17`
    17 In section 474(1) (minor definitions) — a in the definition of “MiFID investment firm”— i in the opening words, for “Article 4.1.1 of Directive 2014/65/EU” s
16. [legislation/si-2010plus] score=37.081 `si-2010plus:uksi/2021/849:article-10`
    10 In Part 31 (Behaviour orders)— a in rule 31.1 (When this Part applies), in paragraph (1) for “make, vary or revoke” substitute “make, vary, renew, discharge 
17. [legislation/si-2010plus] score=37.014 `si-2010plus:uksi/2025/909:rule-32.2`
    32.2 1 This rule applies where— a the responsible officer or supervisor wants the court to— i deal with a defendant for failure to comply with an order to which
18. [legislation/si-2010plus] score=36.881 `si-2010plus:uksi/2013/1554:article-44.2`
    **Application by responsible officer or supervisor** — 44.2 1 This rule applies where— a the responsible officer or supervisor wants the court to— i deal with a defendant for failure to comply with an order to which
19. [legislation/si-2010plus] score=36.881 `si-2010plus:uksi/2014/1610:article-44.2`
    **Application by responsible officer or supervisor** — 44.2 1 This rule applies where— a the responsible officer or supervisor wants the court to— i deal with a defendant for failure to comply with an order to which
20. [legislation/si-2010plus] score=36.881 `si-2010plus:uksi/2012/1726:article-44.2`
    **Application by responsible officer or supervisor** — 44.2 1 This rule applies where— a the responsible officer or supervisor wants the court to— i deal with a defendant for failure to comply with an order to which

### G1 (G/H1) [PRINCIPLE-STREAM] — PRINCIPLE (0–2, uncalibrated)
*Query:* A regulator is handed a new statutory duty with no extra budget — how has that gone before?
*stream:* codes / guidance · *kind:* principle · *metric:* lesson
*0–2 lesson:* NOT CALIBRATED — scaffold only (rubric set by example once a principle-stream result exists, §C.3). Excluded from the headline.

Lesson target: Under-resourced-duty patterns drawn from across domains (the transferable lesson, not the topic).

Top-20 retrieved:
 1. [parliamentary/pwdata-debates] score=86.697↑T `pwdata-debates:debates2008-07-02c:150`
    **Orders of the Day — New Clause 3 — Vehicle excise duty: variation of graduated rates for light passe** — With this it will be convenient to discuss the following: New clause 7— Vehicle mileage costs— 'The Treasury shall publish annually alongside the Pre-Budget rep
 2. [parliamentary/pwdata-debates] score=83.751↑T `pwdata-debates:debates2000-07-18a:274`
    **Orders of the Day — Finance Bill — RATES OF DUTY, ETC.: REFERENCE TO RETAIL PRICE INDEX** — New clause 7 relates to the timing of the announcement of the increase in income tax allowances. It is a modest new clause, but it would provide real benefits t
 3. [parliamentary/pwdata-debates] score=81.674↑T `pwdata-debates:debates2001-03-12a:147`
    **Budget Resolutions and Economic Situation** — The figure from the National Institute of Economic and Social Research is 13,000 new jobs from the new deal. The report showed that hundreds and millions of pou
 4. [parliamentary/historic-hansard] score=81.596↑T `historic-hansard:S5LV0001P0:1291`
    **Lords: THE NEW SPIRIT AND TOBACCO DUTIES.** — LORD MUSKERRY : My Lords, I rise to ask His Majesty's Government if it is a fact that the Excise are charging all traders taking spirits and tobacco out of bond
 5. [parliamentary/pwdata-debates] score=81.508↑T `pwdata-debates:debates2003-03-05:162`
    **Local Government Bill — [1st Allotted Day] — New Clause 10 — Local Retention of Rates** — The new clause puts me in a bit of a quandary. I want local authorities to have extra autonomy for their spending and local taxation, so allowing local authorit
 6. [parliamentary/pwdata-debates] score=80.199↑T `pwdata-debates:debates2000-03-27a:310`
    **Orders of the Day — Budget Resolutions and Economic Situation** — I begin by welcoming the right hon. Member for Ashton-under-Lyne (Mr. Sheldon) back to the House. I congratulate the Chancellor of the Exchequer. There is no de
 7. [parliamentary/pwdata-debates] score=79.521↑T `pwdata-debates:debates2012-03-23b:203`
    **AMENDMENT OF THE LAW — Budget Resolutions and Economic Situation** — Well, what a Budget! People were hoping for a Robin Hood tax, but instead they got a Sheriff of Nottingham Budget—a Budget where the poor pay for tax cuts for t
 8. [parliamentary/pwdata-debates] score=79.363↑T `pwdata-debates:debates1984-07-11a:460`
    **Orders of the Day — Finance (No. 2) Bill — PARLIAMENTARY CONTROL OF EXTRA-STATUTORY CONCESSIONS** — I beg to move, That the clause be read a Second time. It should be common ground between both sides of the House that control over taxation has been one of the 
 9. [parliamentary/pwdata-westminster] score=79.001↑T `pwdata-westminster:westminster2025-12-02a:64`
    **Gambling: Regulatory Reform — [Sir Desmond Swayne in the Chair]** — We talk to the gambling industry about that constantly. My noble Friend Baroness Twycross, the gambling Minister, is taking some of those discussions forward. W
10. [parliamentary/committees-reports] score=78.124↑T `committees-reports:publication:43965:217840`
    **Scrutiny evidence: Submission on the Economic Growth (Regulatory Functions) (Amendment) Order 2024 a** — Submission on the Economic Growth (Regulatory Functions) (Amendment) Order 2024 Submission from Wildlife & Countryside Link - p 2 Response and further informati
11. [parliamentary/pwdata-debates] score=77.968↑T `pwdata-debates:debates1971-03-31a:371`
    **BUDGET RESOLUTIONS AND ECONOMIC SITUATION** — My right hon. Friend the Member for Thirsk and Malton (Mr. Turton) said how much he welcomed the extra provision for the very old, and I share that view. There 
12. [parliamentary/pwdata-debates] score=77.701↑T `pwdata-debates:debates2001-03-19a:444`
    **Orders of the Day — Regulatory Reform Bill [Lords]** — No, I shall not give way. The desirability test—a new test—was inserted into the Bill as a result of an amendment in the Lords. In the case of the imposition of
13. [parliamentary/pwdata-debates] score=76.243↑T `pwdata-debates:debates1999-03-09a:451`
    **Budget Resolutions and Economic Situation — AMENDMENT OF THE LAW** — One Minister leaking to the Financial Times over the weekend promised a "substantial, surprising and important" Budget. What is substantial is the amount of rev
14. [parliamentary/pwdata-debates] score=76.140↑T `pwdata-debates:debates2008-07-02c:296`
    **Orders of the Day — New Clause 3 — Vehicle excise duty: variation of graduated rates for light passe** — We have had a fascinating debate with many interesting and thoughtful contributions, for which I commend Members. The Government recognise the impact that high 
15. [parliamentary/pwdata-debates] score=75.509↑T `pwdata-debates:debates2000-03-27a:238`
    **Orders of the Day — Budget Resolutions and Economic Situation** — As could be expected from this Chancellor, we have had a Budget with a high degree of spin. He naturally claimed how well the economy was doing and, on that, he
16. [parliamentary/pwdata-debates] score=75.157↑T `pwdata-debates:debates1971-03-31a:353`
    **BUDGET RESOLUTIONS AND ECONOMIC SITUATION** — This is a depressing day for hon. Gentlemen opposite. For six years, in Budget after Budget they have been able to revel in the Socialist joys of increasing tax
17. [parliamentary/pwdata-debates] score=74.932↑T `pwdata-debates:debates2005-03-16a:113`
    **Budget Resolutions — AMENDMENT OF THE LAW** — May I begin by welcoming the return of the Chancellor to the general election campaign, not that I am entirely sure that it was worth waiting for? Earlier this 
18. [parliamentary/pwdata-debates] score=74.433↑T `pwdata-debates:debates2007-10-15b:173`
    **Orders of the Day — New Clause 2 — Appeal against public censure** — I am pleased to hear the opening remarks from across the House about how we have reached this stage in the Bill as a result of a great deal of healthy discussio
19. [parliamentary/pwdata-debates] score=74.337↑T `pwdata-debates:debates2000-03-21a:137`
    **Budget Resolutions and Economic Situation — AMENDMENT OF THE LAW** — I should be happy to change the custom, if the Chancellor would give way during his Budget statement in future. We could then correct him as he goes along, inst
20. [parliamentary/pwdata-debates] score=74.135↑T `pwdata-debates:debates1995-01-23a:310`
    **Orders of the Day — Finance Bill — RATES OF DUTY** — As a result of new clause 3—the increases in excise duty on hydrocarbons—the Chancellor has imposed an extra tax of £51 a year on a typical car owner. This is t

### G2 (G/H2) [PRINCIPLE-STREAM][MECHANISM] — PRINCIPLE (0–2, uncalibrated)
*Query:* If we make companies report something, how do we make sure they actually do it?
*stream:* codes / guidance · *kind:* principle · *metric:* lesson
*0–2 lesson:* NOT CALIBRATED — scaffold only (rubric set by example once a principle-stream result exists, §C.3). Excluded from the headline.

Lesson target: Enforcement/compliance patterns from duty-to-report regimes (financial, safeguarding, environmental).

Top-20 retrieved:
 1. [parliamentary/pwdata-debates] score=75.459↑T `pwdata-debates:debates2004-03-26:186`
    **Performance of Companies and Government Departments (Reporting) Bill** — It is important that the Government put their money where their mouth is. The Prime Minister issued a challenge to the top 350 companies in October 2000: to iss
 2. [parliamentary/pwdata-lords] score=74.627↑T `pwdata-lords:daylord2023-12-06a:179`
    **Hillsborough Families Report: Government Response - Statement** — My Lords, I thank the Minister for repeating the Statement. This was one occasion when it was actually needed. Can he convey my thanks to those on the Governmen
 3. [parliamentary/pwdata-lords] score=73.360↑T `pwdata-lords:daylord2012-11-13a:166`
    **EU Report: Women on Boards — Question for Short Debate** — My Lords, I thank the noble Baroness, Lady O'Cathain for securing this incredibly topical debate. In the 1980s, she was the Chief Executive of the Milk Marketin
 4. [parliamentary/pwdata-lords] score=72.885↑T `pwdata-lords:daylord2015-03-03a:108`
    **Small Business, Enterprise and Employment Bill — Report (1st Day)** — My Lords, I rise to speak against these amendments. I must first declare an interest because I run a large public company, TalkTalk, which would clearly be subj
 5. [parliamentary/pwdata-lords] score=71.597↑T `pwdata-lords:daylord2025-04-25a:73`
    **Public Inquiries: Enchancing Public Trust (Statutory Inquiries Committee Report) - Motion to Take No** — My Lords, I thank the noble Lord, Lord Norton, for chairing the committee. I was one of its members who did not have a legal background, and I was not made to f
 6. [parliamentary/pwdata-debates] score=71.587↑T `pwdata-debates:debates1935-12-16a:418`
    **Orders of the Day — RAILWAYS (AGREEMENT) BILL. — NEW CLAUSE.—(Report and accounts of finance company** — I would like to make a suggestion with regard to the new Clause. I see the point that as the company is a statutory company it would, of course, make an annual 
 7. [parliamentary/pwdata-lords] score=71.411↑T `pwdata-lords:daylord2024-09-09b:136`
    **Watchdogs (Industry and Regulators Committee Report) - Motion to Take Note** — My Lords, when I put my name down for this debate, I suspected I would learn more than I imparted to the House. What dragged me towards this debate—that moment 
 8. [parliamentary/pwdata-westminster] score=70.927↑T `pwdata-westminster:westminster2017-11-22a:192`
    **PUBLIC COUNTRY-BY-COUNTRY REPORTING** — That might be slightly above my pay grade, but I am grateful for the hon. Gentleman’s questioning of that situation. That is the challenge we put to the Ministe
 9. [parliamentary/pwdata-debates] score=70.826↑T `pwdata-debates:debates1976-05-19a:534`
    **NATIONALISATION — COMPANIES (No. 2) BILL [Lords]** — They may be maxima, but £400 and £40 per day is a hefty penalty. Although they are the maximum, perhaps we should consider whether they should be varied a littl
10. [parliamentary/pwdata-debates] score=70.757↑T `pwdata-debates:debates1967-01-23a:554`
    **BILL PRESENTED — Clause 7.—(VESTING IN THE CORPORA- TION OF SECURITIES OF SCHEDULED COMPANIES.)** — As far as I can see, if we draw the line at 475,000 tons we automatically, and without being able to help it, include 14 companies in the Schedule. If we drew i
11. [parliamentary/historic-hansard] score=70.654↑T `historic-hansard:S5LV0398P0:637`
    **Lords: FOREIGN BOYCOTTS BILL: SELECT COMMITTEE'S REPORT** — Lord AYLESTONE : My Lords, the House is grateful to the noble Lord, Lord Byers, for initiating this debate which gives those of us who had the honour and privil
12. [parliamentary/pwdata-debates] score=70.336↑T `pwdata-debates:debates1963-05-06a:361`
    **Orders of the Day — FORT WILLIAM PULP AND PAPER MILLS BILL — Clause 1.—(POWER OF BOARD TO MAKE ADVAN** — I should like to ask one or two questions. First, what guarantee have the Government after they have advanced the funds mentioned in the Bill? If the company do
13. [parliamentary/pwdata-lords] score=70.275↑T `pwdata-lords:daylord2011-05-18a:59`
    **Weightman Report — Statement** — My Lords, I have a little familiarity with the Fukushima event but I have not yet had the privilege of reading Dr Weightman's report. However, it is worth makin
14. [parliamentary/pwdata-lords] score=70.213↑T `pwdata-lords:daylord2023-12-08d:5`
    **Love Matters (Archbishops’ Commission on Families and Households Report) - Motion to Take Note** — My Lords, I am pleased to rise broadly to support what I consider to be the main thrust of the report commissioned by the most reverend Primates. I am not a goo
15. [parliamentary/pwdata-lords] score=32.749 `pwdata-lords:daylord2023-05-16a:90`
    **Online Safety Bill - Committee (7th Day) — Amendment 56** — My Lords, I also put my name to Amendments 250A and 250B, but the noble Baronesses, Lady Newlove and Lady Kidron, have done such a good job that I shall be very
16. [parliamentary/pwdata-lords] score=31.068 `pwdata-lords:daylord2023-04-27a:148`
    **Online Safety Bill - Committee (3rd Day) (Continued) — Amendment 16** — My Lords, this group of amendments concerns terms of service. All the amendments either have the phrase “terms of service” in them or imply that we wish to see 
17. [parliamentary/committees-evidence] score=30.926 `committees-evidence:oralevidence:8265:157472`
    Oral evidence - Regulation of the water industry - 11 Jul 2018 &#xa0; Environment, Food and Rural Affairs Committee &#xa0; Oral evidence: Regulation of the w at
18. [parliamentary/pwdata-debates] score=30.539 `pwdata-debates:debates2009-01-14b:114`
    **PRIME MINISTER — Businesses (Financial Support)** — As a Government, we are always prepared to see proper parliamentary scrutiny of Government decisions and I have no doubt that, subject to issues of commercial c
19. [parliamentary/pwdata-westminster] score=30.409 `pwdata-westminster:westminster2026-04-16b:6`
    **Science, Innovation and Technology Committee** — I welcome the Chair of the Select Committee’s launch of a new inquiry on digital childhoods. Like her, I sit on the Science, Innovation and Technology Committee
20. [parliamentary/pwdata-debates] score=30.314 `pwdata-debates:debates2014-06-23b:29`
    **WORK AND PENSIONS — Personal Independence Payments** — It is interesting that yet again a Labour Member uses the word “fiasco”, and I know the Public Accounts Committee Chairman, the right hon. Member for Barking (M

### G3 (G/H1) [PRINCIPLE-STREAM][MECHANISM] — PRINCIPLE (0–2, uncalibrated)
*Query:* How is a 'fit and proper person' test typically operated by regulators in practice?
*stream:* codes / guidance · *kind:* principle · *metric:* lesson
*0–2 lesson:* NOT CALIBRATED — scaffold only (rubric set by example once a principle-stream result exists, §C.3). Excluded from the headline.

Lesson target: Cross-domain implementation of a recurring mechanism.

Top-20 retrieved:
 1. [legislation/primary-acts-pre-2000] score=134.228↑T `primary-acts-pre-2000:ukpga/1988/52:section-132`
    **Examinations and tests of ability to give driving instruction.** — 132 1 Regulations may make provision with respect to— a the nature of examinations of the ability of persons to give instruction in the driving of motor cars an
 2. [parliamentary/pwdata-wrans] score=95.907↑T `pwdata-wrans:answers2026-03-02:138`
    **Ministry of Housing, Communities and Local Government — Park Homes: Managers** — Q (Sarah Gibson): To ask the Secretary of State for Housing, Communities and Local Government, how many applications for Fit and Proper Person status have been 
 3. [parliamentary/committees-reports] score=85.979↑T `committees-reports:publication:5914:67380`
    **Correspondence: Correspondence from Ian Trenholm, Chief Executive CareQuality Commission, re Respons** — Chairman: Peter Wyman CBE DL Chief Executive: Ian Trenholm September 2017 Meg Hillier MP Chair of the Public Accounts Committee By email: pubaccom@parliament.uk
 4. [guidance/quangos-govuk] score=85.906↑T `quangos-govuk:government/publications/mgn-578-m-amendment-3-use-of-overside-working-systems-on-vessels:2`
    **MGN 578 (M) Amd 3 Use of overside working systems on commercial yachts small commercial vessels and ** — 1 MARINE GUIDANCE NOTE MGN 578 (M) Amendment 3 Use of overside working systems on commercial yachts, small commercial vessels and loadline vessels Notice to all
 5. [caselaw/scottish-courts] score=84.510↑T `scottish-courts:media/wnhlnmsm/upper-tribunal-decision-2022ut08-anu-sharma-against-renfrewshire-council:1`
    **Upper Tribunal - Housing and Property Chamber: upper tribunal decision 2022ut08 anu sharma against r** — 1 [2022]UT08 Ref: UTS/AP/19/0046 Sheriff Tony Kelly IN APPEAL FROM DECISION OF FIRST-TIER TRIBUNAL FOR SCOTLAND (HOUSING AND PROPERTY CHAMBER) IN THE CASE OF Mr
 6. [parliamentary/pwdata-wrans] score=82.556↑T `pwdata-wrans:answers2018-03-19:88`
    **Department of Health and Social Care — NHS: Reviews** — Q (Rosie Cooper): To ask the Secretary of State for Health and Social Care, if the (a) Government's fit and proper person test and (b) NHS duty of candour is su
 7. [guidance/hmrc-manuals] score=82.239↑T `hmrc-manuals:hmrc-internal-manuals/economic-crime-supervision-handbook/ecsh51250:1`
    **ECSH51250 — Principals and agent networks** — Money service businesses (MSBs) frequently enter into arrangements with other parties to enable the MSB to provide its services to customers. This is known as a
 8. [parliamentary/pwdata-wrans] score=82.105↑T `pwdata-wrans:answers2025-07-21:477`
    **Ministry of Housing, Communities and Local Government — Health Services and Social Services: Directo** — Q (Sarah Gibson): To ask the Secretary of State for Housing, Communities and Local Government, what mechanisms exist for residents to report breaches of the fit
 9. [parliamentary/pwdata-wrans] score=80.585↑T `pwdata-wrans:answers2018-02-27:202`
    **Department of Health and Social Care — NHS: Managers** — Q (Diana Johnson): To ask the Secretary of State for Health and Social Care, on how many occasions have NHS Trusts received concerns about alleged unfitness to 
10. [guidance/quangos-govuk] score=80.395↑T `quangos-govuk:government/publications/safety-alerts-2010:5`
    **SA 04/10: fuel and other chemical storage: TAV level switches manufactured by Cynergy3 Components Li** — SAFETY ALERT Fuel & Other Chemical Storage - TAV level switches manufactured by Cynergy3 Components Limited Number: SA 04/10 Strategy & Policy Directorate Spons
11. [guidance/hmrc-manuals] score=80.366↑T `hmrc-manuals:hmrc-internal-manuals/economic-crime-supervision-handbook/ecsh45030:1`
    **ECSH45030 — The fit and proper test** — The fit and proper test (F P) is applied to money service businesses (MSBs) and trust or company service providers (TCPSs) and the beneficial owners, officers a
12. [parliamentary/pwdata-wrans] score=79.485↑T `pwdata-wrans:answers2021-03-26:177`
    **Ministry of Housing, Communities and Local Government — Park Homes** — Q (Sir Christopher Chope): To ask the Secretary of State for Housing, Communities and Local Government, when the draft guidance on fit and proper person licensi
13. [parliamentary/pwdata-wms] score=79.452↑T `pwdata-wms:ministerial2020-07-08:2`
    **Ministry of Housing, Communities and Local Government — Park Homes** — I am today publishing the Government response to our consultation “Mobile Homes –a fit and proper person test for park home sites”. I am placing copies of the r
14. [parliamentary/historic-hansard] score=78.783↑T `historic-hansard:S5LV0588P0:70`
    **Lords: Bank of England Bill** — Lord Eatwell moved Amendment No. 2: After Clause 22, insert the following new clause— LISTED MONEY MARKET INSTITUTIONS: INCLUSION ON THE LIST (". In section 43 
15. [parliamentary/pwdata-lordswrans] score=78.643↑T `pwdata-lordswrans:lordswrans2018-05-17:17`
    **Department of Health and Social Care — Health Services: Directors** — Q (lord hunt of kings heath): To ask Her Majesty's Government when they will announce the details of the review into the use of the fit and proper persons test 
16. [parliamentary/pwdata-lordswms] score=78.590↑T `pwdata-lordswms:lordswms2020-07-08:2`
    **Ministry of Housing, Communities and Local Government — Park Homes** — My Hon. Friend, the Minister for Rough Sleeping and Housing (Luke Hall) has today made the following Written Ministerial Statement: I am today publishing the Go
17. [parliamentary/pwdata-wrans] score=77.457↑T `pwdata-wrans:answers2026-03-31:98`
    **Ministry of Housing, Communities and Local Government — Park Homes: Ownership** — Q (Mary Kelly Foy): To ask the Secretary of State for Housing, Communities and Local Government what assessment he has made of the effectiveness of the Fit and 
18. [guidance/quangos-govuk] score=77.449↑T `quangos-govuk:government/consultations/dsa-and-vosa-legislative-amendments-proposed-as-a-consequence-of-the-merger:2`
    **Legislative amendments proposed as a consequence of the merger of DSA and VOSA: consultation documen** — Consultation on the legislative amendments proposed as a consequence of the merger of the Driving Standards Agency and the Vehicle & Operator Services Agency De
19. [guidance/quangos-govuk] score=77.020↑T `quangos-govuk:government/publications/mobile-homes-fit-and-proper-person-test-guidance-for-local-authorities:1`
    **Mobile homes fit and proper person test: guidance for local authorities** — Guidance for local authorities on the implementation of the fit and proper person test From 1 July and by 1 October 2021, all park home site owners must apply t
20. [parliamentary/pwdata-wrans] score=76.727↑T `pwdata-wrans:answers2025-03-03:448`
    **Ministry of Housing, Communities and Local Government — Park Homes** — Q (Jack Rankin): To ask the Secretary of State for Housing, Communities and Local Government, what steps she is taking to enhance the fit and proper person test

### H1 (H/H1) [PRINCIPLE-STREAM] — PRINCIPLE (0–2, uncalibrated)
*Query:* When an arms-length body fails, how do departments typically respond, and how fast?
*stream:* investigations / inquiries · *kind:* principle · *metric:* lesson
*0–2 lesson:* NOT CALIBRATED — scaffold only (rubric set by example once a principle-stream result exists, §C.3). Excluded from the headline.

Lesson target: Behavioural regularity across inquiries (e.g. Horizon and others) — the pattern, not one case.

Top-20 retrieved:
 1. [parliamentary/pwdata-lordswrans] score=93.255↑T `pwdata-lordswrans:lordswrans2025-06-03:33`
    **Cabinet Office — Arms Length Bodies** — Q (Lord Agnew of Oulton): To ask His Majesty's Government how many arm’s-length bodies are sponsored by more than one department; and for each such body, what i
 2. [parliamentary/niassembly-hansard] score=89.403↑T `niassembly-hansard:476718:400`
    **NI Assembly: Private Members' Business — Waste and Inefficiency in Government** — No. Let me make some progress. A culture of efficiency must be led from the top. That is why we have called on the Minister of Finance to take the lead. I point
 3. [parliamentary/pwdata-westminster] score=87.386↑T `pwdata-westminster:westminster2025-11-12a:74`
    **Public Bodies: Governance and Accountability** — My hon. Friend raises an interesting and important issue. Far too often there have been departmental silos, and silos within other public bodies, and they are n
 4. [parliamentary/pwdata-wrans] score=83.224↑T `pwdata-wrans:answers2023-07-26:58`
    **Department of Health and Social Care — Department of Health and Social Care: Staff** — Q (Sir Jacob Rees-Mogg): To ask the Secretary of State for Health and Social Care, how many officials were working in his Department on (a) the date of the appo
 5. [parliamentary/pwdata-wrans] score=82.492↑T `pwdata-wrans:answers2026-03-25:327`
    **Cabinet Office — Arms Length Bodies** — Q (Gregory Stafford): To ask the Minister for the Cabinet Office, to whom Arm's Length Bodies report annually. A (Anna Turley): Arm’s Length Bodies (ALBs) are a
 6. [parliamentary/pwdata-wrans] score=82.130↑T `pwdata-wrans:answers2018-05-14:60`
    **Department of Health and Social Care — Department of Health and Social Care: Training** — Q (Hywel Williams): To ask the Secretary of State for Health and Social Care, what training his Department has provided to (a) general civil servants, (b) fast 
 7. [guidance/nao-reports] score=80.993↑T `nao-reports:central-oversight-of-arms-length-bodies:2`
    **central oversight of arms length bodies** — A picture of the National Audit Office logo SESSION 2021-22 23 JUNE 2021 HC 297 REPORT by the Comptroller and Auditor General Central oversight of arm’s‑length 
 8. [parliamentary/pwdata-wrans] score=80.656↑T `pwdata-wrans:answers2018-01-18:54`
    **Department of Health and Social Care — Eating Disorders** — Q (Barbara Keeley): To ask the Secretary of State for Health and Social Care, with reference to the Parliamentary and Health Ombudsman’s report, Ignoring the al
 9. [parliamentary/pwdata-wrans] score=80.603↑T `pwdata-wrans:answers2025-05-07:1`
    **Foreign, Commonwealth and Development Office — Foreign, Commonwealth and Development Office: Public ** — Q (Priti Patel): To ask the Secretary of State for Foreign, Commonwealth and Development Affairs, how much his Department spent on on (a) business hospitality, 
10. [guidance/nao-reports] score=80.365↑T `nao-reports:central-oversight-of-arms-length-bodies:1`
    **central oversight of arms length bodies** — A picture of the National Audit Office logo SESSION 2021-22 23 JUNE 2021 HC 297 REPORT by the Comptroller and Auditor General Central oversight of arm’s‑length 
11. [parliamentary/pwdata-debates] score=80.283↑T `pwdata-debates:debates2025-03-14b:85`
    **Arm’s-Length Bodies (Review) Bill** — I do not think my Bill would make any of that harder. What I am saying is that if the Government wish to abolish these arm’s length bodies, or some of them, and
12. [parliamentary/pwdata-wrans] score=80.082↑T `pwdata-wrans:answers2013-09-02d:32`
    **CULTURE MEDIA AND SPORT — Apprentices** — Q (Andrew Gwynne): To ask the Secretary of State for Culture, Media and Sport how many apprenticeships her Department offered to people aged (a) 16 to 18, (b) 1
13. [guidance/nao-reports] score=80.036↑T `nao-reports:department-for-environment-food-and-rural-affairs-managing-front-line-delivery-costs:1`
    **department for environment food and rural affairs managing front line delivery costs** — Department for Environment, Food and Rural Affairs Managing front line delivery costs REpoRt by thE ComptRollER AnD AuDitoR GEnERAl hC 1279 SESSion 2010–2012 22
14. [parliamentary/pwdata-wrans] score=79.789↑T `pwdata-wrans:answers2024-04-25:203`
    **Department for Culture, Media and Sport — Public Buildings: Concrete** — Q (Rachael Maskell): To ask the Secretary of State for Culture, Media and Sport, how many (a) museums, (b) theatres, (c) art galleries, (d) sports venues and (e
15. [parliamentary/pwdata-lords] score=79.728↑T `pwdata-lords:daylord2007-07-23b:291`
    **Local Government and Public Involvement in Health Bill** — The Minister made a valiant attempt to tell us that all will be well. She told us how all the local authorities were finding hosts and how CSCI and everybody el
16. [parliamentary/pwdata-wrans] score=79.618↑T `pwdata-wrans:answers2026-03-11:191`
    **Department of Health and Social Care — Department of Health and Social Care: Tyres** — Q (Mr Richard Holden): To ask the Secretary of State for Health and Social Care, pursuant to the Answer of 2 March 2026 to Question 114110, what information his
17. [parliamentary/pwdata-wrans] score=79.284↑T `pwdata-wrans:answers2013-11-18c:48`
    **SCOTLAND — Conditions of Employment** — Q (John McDonnell): To ask the Secretary of State for Scotland how many direct employees and contracted workers of his Department and its arms lengths bodies ar
18. [parliamentary/pwdata-wrans] score=79.067↑T `pwdata-wrans:answers2013-02-12a:36`
    **COMMUNITIES AND LOCAL GOVERNMENT — Travel and Subsistence Payments** — Q (Chi Onwurah): To ask the Secretary of State for Communities and Local Government (1) how many senior officials in his Department's arm's length bodies (a) ha
19. [guidance/nao-reports] score=79.029↑T `nao-reports:department-for-environment-food-and-rural-affairs-geographic-information-strategy:1`
    **department for environment food and rural affairs geographic information strategy** — Department for Environment, Food and Rural Affairs Geographic information strategy REpoRt by thE ComptRollER AnD AuDitoR GEnERAl hC 1274 SESSion 2010–2012 13 ju
20. [parliamentary/pwdata-wrans] score=78.873↑T `pwdata-wrans:answers2013-02-04a:168`
    **ATTORNEY-GENERAL — Travel and Subsistence Payments** — Q (Chi Onwurah): To ask the Attorney-General (1) how many senior officials in the Law Officers' Departments arm's-length bodies (a) have and (b) have had during

### H2 (H/H2) [PRINCIPLE-STREAM] — PRINCIPLE (0–2, uncalibrated)
*Query:* What usually goes wrong when government runs a big IT programme?
*stream:* investigations / inquiries · *kind:* principle · *metric:* lesson
*0–2 lesson:* NOT CALIBRATED — scaffold only (rubric set by example once a principle-stream result exists, §C.3). Excluded from the headline.

Lesson target: Cross-inquiry IT-failure patterns (not one named project).

Top-20 retrieved:
 1. [parliamentary/pwdata-lordswrans] score=67.233↑T `pwdata-lordswrans:lordswrans2011-05-10a:24`
    **Government: Big Society** — Q (Lord Hennessy of Nympsfield): To ask Her Majesty's Government what are the specific responsibilities of each individual minister for aspects of the big socie
 2. [parliamentary/pwdata-debates] score=63.603↑T `pwdata-debates:debates1989-12-06a:496`
    **Local Government (Sports and Leisure)** — What we have heard from Opposition Members tonight makes it abundantly clear that the Labour party is interested only in who runs sports facilities, not what go
 3. [other/petitions] score=60.344↑T `petitions:306407:1`
    **We call the UK Government to tell shops to stop overpricing essential products** — We call the UK Government to tell shops to stop overpricing essential products State: rejected · Signatures: 7 We want the UK Government to tell all shops not t
 4. [parliamentary/pwdata-debates] score=60.094↑T `pwdata-debates:debates2013-02-26b:186`
    **Regulation of the Private Rented Sector — Groceries Code Adjudicator Bill [Lords] (Programme) (No. 3** — It is a great pleasure to follow my hon. Friend the Member for Christchurch (Mr Chope) . I want to query a couple of things that my hon. Friend the Minister sai
 5. [parliamentary/pwdata-debates] score=59.834↑T `pwdata-debates:debates2008-07-01b:53`
    **COMMUNITIES AND LOCAL GOVERNMENT — Social Housing** — Sixty years ago, Aneurin Bevan came up with his other big idea—a national housing service that was publicly owned and run, and a massive house building programm
 6. [parliamentary/pwdata-wrans] score=59.468↑T `pwdata-wrans:answers2011-03-08f:112`
    **COMMUNITIES AND LOCAL GOVERNMENT — Local Government Services: Third Sector** — Q (Peter Bone): To ask the Secretary of State for Communities and Local Government what role he expects the big society to play in providing services previously
 7. [parliamentary/pwdata-debates] score=59.449↑T `pwdata-debates:debates2013-02-26b:194`
    **Regulation of the Private Rented Sector — Groceries Code Adjudicator Bill [Lords] (Programme) (No. 3** — No. That is exactly the wrong reason. We want to discuss the issues and argue about them. The hon. Gentleman’s amendments might be very good and when I listen t
 8. [parliamentary/pwdata-debates] score=59.093↑T `pwdata-debates:debates2025-02-05b:549`
    **Local Government Finance** — I will in just a second, but I want to make a really important point to the Minister about why all this matters. Why does it matter? If we do not have a set of 
 9. [parliamentary/pwdata-debates] score=58.641↑T `pwdata-debates:debates1959-02-04a:298`
    **Orders of the Day — Clause 1.—(APPROVAL OF BUILDING SOCIETIES FOR INVESTMENT BY TRUSTEES AND GOVERNM** — I have listened with very great care and attention to what has been said, because, unlike most hon. Members who have taken part in the discussion, I have no con
10. [parliamentary/pwdata-debates] score=58.447↑T `pwdata-debates:debates1953-12-15a:403`
    **Orders of the Day — TELEVISION DEVELOPMENT (GOVERNMENT POLICY)** — At the same time the hon. Member, who is a fair man, would be the first to admit that it was not a coincidence that the first application for a licence was for 
11. [parliamentary/historic-hansard] score=29.540 `historic-hansard:S5LV0263P0:1259`
    **Lords: FORESTRY** — My Lords, I have made more speeches than I care to remember about this in the last 35 years, both in the House of Commons and here, and I have always been criti
12. [parliamentary/pwdata-lords] score=28.805 `pwdata-lords:daylord2010-06-23a:139`
    **Academies Bill [HL] — Committee (2nd Day)** — I shall also speak to Amendment 58. In doing so I am conscious that we are about two and three-quarter hours into day 2 and still on page 1 of the Bill. I shall
13. [parliamentary/pwdata-debates] score=28.091 `pwdata-debates:debates2002-07-04:331`
    **Orders of the Day — Finance Bill — [2nd Allotted Day] — Schedule 37 — Aggregates levy amendments** — When the Government imposed their big windfall licence fee on the telecommunications industry—a very big one-off tax—I warned that it would lead to job losses a
14. [parliamentary/pwdata-debates] score=27.883 `pwdata-debates:debates2000-10-26a:295`
    **Defence Procurement** — How will the United States transfer the key technologies that are relevant to that programme, as BAE will tell them time and again that stealth technologies are
15. [parliamentary/pwdata-debates] score=27.571 `pwdata-debates:debates2004-05-24:150`
    **Deepcut Barracks** — I recognise that, but we should not take one given set of circumstances and say that, when something goes wrong anywhere within government, we should automatica
16. [parliamentary/pwdata-debates] score=27.153 `pwdata-debates:debates1975-03-13a:340`
    **Orders of the Day — SMALL BUSINESSES AND THE SELF-EMPLOYED** — I wish merely to say a few words about the position of small businesses, which are a vital part of our industrial sector. From that sector will come the entrepr
17. [parliamentary/pwdata-lords] score=26.984 `pwdata-lords:daylord2008-01-29b:134`
    **Dormant Bank and Building Society Accounts Bill [HL]** — My Lords, we on this side appreciate and admire the noble Lord's spirited attempt to ensure that the investment of dormant account funds in communities across t
18. [parliamentary/pwdata-lords] score=26.850 `pwdata-lords:daylord2022-02-28c:43`
    **Crypto Currencies - Question** — My Lords, the FCA advice to customers, last updated on 18 June 2021, says: “Before you invest in cryptoassets you should be aware of the following … cryptoasset
19. [parliamentary/pwdata-debates] score=26.525 `pwdata-debates:debates1972-11-01a:81`
    **Orders of the Day — INDUSTRIAL RELATIONS** — I do not know whether dinosaurs were cannibals. When these large companies have eaten up everything, what will be left of our economic system? An enormous perce
20. [parliamentary/pwdata-debates] score=26.477 `pwdata-debates:debates2001-04-09a:331`
    **Committee** — The programme motion has two deficiencies: it is the wrong motion, and it is wrong to have it in the first place: otherwise, it is perfect. What is wrong with t

### H3 (H/H1) [PRINCIPLE-STREAM][MECHANISM] — PRINCIPLE (0–2, uncalibrated)
*Query:* Where inquiries have examined regulatory capture, what mechanisms recur?
*stream:* investigations / inquiries · *kind:* principle · *metric:* lesson
*0–2 lesson:* NOT CALIBRATED — scaffold only (rubric set by example once a principle-stream result exists, §C.3). Excluded from the headline.

Lesson target: Transferable regulatory-capture patterns.

Top-20 retrieved:
 1. [parliamentary/committees-evidence] score=65.782↑T `committees-evidence:writtenevidence:138581:242020`
    **Delivering 1.5 million new homes: Land Value Capture — HLV0012** — Written evidence submitted by the Vistry Group [HLV 012] Introduction – Vistry Group Vistry Group is the UK’s leading provider of affordable homes. At Vistry, w
 2. [parliamentary/committees-evidence] score=64.649↑T `committees-evidence:writtenevidence:88054:133840`
    **Land value capture inquiry — LVC0087** — LVC0087 - Evidence on Land Value Capture Written evidence submitted by Network Rail [LVC 087] Introduction 1.1. Network rail is owns, operates and develops Brit
 3. [parliamentary/committees-evidence] score=64.539↑T `committees-evidence:writtenevidence:138196:241558`
    **Delivering 1.5 million new homes: Land Value Capture — HLV0008** — Written evidence submitted by the Housing Forum [HLV 008] About The Housing Forum The Housing Forum is the UK’s cross-sector, industry-wide organisation that re
 4. [parliamentary/committees-evidence] score=63.231↑T `committees-evidence:writtenevidence:138960:244662`
    **Delivering 1.5 million new homes: Land Value Capture — HLV0047** — Written evidence submitted by RICS [HLV 047] Our responses below are based on the ability of suggested measures to contribute to delivering 1.5 million dwelling
 5. [parliamentary/committees-evidence] score=60.420↑T `committees-evidence:writtenevidence:138680:244654`
    **Delivering 1.5 million new homes: Land Value Capture — HLV0042** — Written evidence submitted by the Home Builders Federation [HLV 042] Introduction The Home Builders Federation (HBF) is the representative body of the home buil
 6. [parliamentary/pwdata-wrans] score=58.051↑T `pwdata-wrans:answers2025-11-07:75`
    **Cabinet Office — Government: Inquiries** — Q (Max Wilkinson): To ask the Minister for the Cabinet Office, what assessment his Department made of the potential impact of a legal duty to implement public e
 7. [parliamentary/pwdata-wrans] score=57.860↑T `pwdata-wrans:answers2008-03-13b:229`
    **BUSINESS, ENTERPRISE AND REGULATORY REFORM — Coal Fired Power Stations: Kingsnorth** — Q (Colin Challen): To ask the Secretary of State for Business, Enterprise and Regulatory Reform if he will require the implementation of heat capture mechanisms
 8. [parliamentary/committees-evidence] score=57.797↑T `committees-evidence:writtenevidence:87795:133813`
    **Land value capture inquiry — LVC0068** — LVC0068 - Evidence on Land Value Capture Written e vidence submitted by CPRE [LVC 068] Introduction CPRE campaigns for a beautiful and living countryside. We wo
 9. [parliamentary/pwdata-lords] score=57.719↑T `pwdata-lords:daylord2025-04-25a:69`
    **Public Inquiries: Enchancing Public Trust (Statutory Inquiries Committee Report) - Motion to Take No** — My Lords, I too had the pleasure of serving on this committee and add my tribute to the noble Lord, Lord Norton, chair of the committee, and Andrea Dowsett, cle
10. [parliamentary/committees-evidence] score=57.675↑T `committees-evidence:writtenevidence:138165:241556`
    **Delivering 1.5 million new homes: Land Value Capture — HLV0007** — Written evidence submitted by Dr Thomas Aubrey [HLV 007] Background I have been working on land value capture for more than 30 years following research I undert
11. [parliamentary/committees-evidence] score=57.271↑T `committees-evidence:writtenevidence:138606:242886`
    **Delivering 1.5 million new homes: Land Value Capture — HLV0019** — Written evidence submitted by the Chartered Institute of Housing [HLV 019] Introduction The Chartered Institute of Housing (CIH) is the professional body for pe
12. [parliamentary/committees-evidence] score=57.107↑T `committees-evidence:writtenevidence:139013:244665`
    **Delivering 1.5 million new homes: Land Value Capture — HLV0050** — Written e vidence submitted by the Ministry for Housing, Communities and Local Government [HLV 050] The Ministry of Housing, Communities and Local Government su
13. [parliamentary/committees-evidence] score=56.548↑T `committees-evidence:writtenevidence:138672:243770`
    **Delivering 1.5 million new homes: Land Value Capture — HLV0038** — Written evidence submitted by WSP [HLV 038] WSP is a world-leading multi-disciplinary professional services consultancy which supports significant projects in b
14. [parliamentary/pwdata-lords] score=56.039↑T `pwdata-lords:daylord2004-12-02a:74`
    **Regulatory State** — My Lords, I have pleasure in moving the Motion standing in my name on the Order Paper. The inquiry by the Constitution Committee into the accountability of gove
15. [parliamentary/committees-evidence] score=55.386↑T `committees-evidence:writtenevidence:138665:243128`
    **Delivering 1.5 million new homes: Land Value Capture — HLV0034** — Written evidence submitted by the Land, Planning and Development Federation [HLV 034] Introduction The L and, Planning and Development Federation (LPDF) welcome
16. [parliamentary/pwdata-wrans] score=55.285↑T `pwdata-wrans:answers2008-01-15b:305`
    **BUSINESS, ENTERPRISE AND REGULATORY REFORM — Carbon Sequestration** — Q (Gregory Barker): To ask the Secretary of State for Business, Enterprise and Regulatory Reform how carbon capture and storage technology will be considered in
17. [parliamentary/committees-evidence] score=55.165↑T `committees-evidence:writtenevidence:138667:243129`
    **Delivering 1.5 million new homes: Land Value Capture — HLV0035** — Written evidence submitted by Keepmoat Homes [HLV 035] Keepmoat Homes Keepmoat Homes is a leading partnership homebuilder delivering c.4,000 homes per year. As 
18. [parliamentary/pwdata-debates] score=54.835↑T `pwdata-debates:debates2001-04-05a:218`
    **Regulatory Reform Bill [Lords] — REVIEW OF ORDERS** — I do not agree with the hon. Gentleman's first point, because, as I understand it, the review that the Deregulation Committee proposes would not allow a detaile
19. [parliamentary/committees-evidence] score=54.817↑T `committees-evidence:writtenevidence:87625:133726`
    **Land value capture inquiry — LVC0027** — LVC0027 - Evidence on Land Value Capture Written e vidence submitted by Staffordshire County Council [LVC 027] Re: Inquiry: Land value capture, Communities and 
20. [parliamentary/committees-evidence] score=54.801↑T `committees-evidence:writtenevidence:135321:241546`
    **Delivering 1.5 million new homes: Land Value Capture — HLV0001** — Written evidence submitted by Mike Lake [HLV 001] Response to: “Delivering 1.5 million new homes: Land Value Capture” How effective and efficient are current me

### I1 (I/H1) [PRINCIPLE-STREAM] — PRINCIPLE (0–2, uncalibrated)
*Query:* What distinguishes regulatory-enforcement laws that worked from ones that didn't?
*stream:* parliamentary evaluations · *kind:* principle · *metric:* lesson
*0–2 lesson:* NOT CALIBRATED — scaffold only (rubric set by example once a principle-stream result exists, §C.3). Excluded from the headline.

Lesson target: PAC/NAO/post-legislative-scrutiny patterns of effective vs ineffective enforcement law.

Top-20 retrieved:
 1. [guidance/quangos-govuk] score=73.077↑T `quangos-govuk:guidance/general-regulatory-chamber-tribunal-hearings-and-decisions:1`
    **General Regulatory Chamber tribunal hearings and decisions** — After you appeal to the tribunal The regulator has 28 days to respond to your appeal. They will send you a copy of their response. If you wish, you can write ba
 2. [parliamentary/committees-evidence] score=65.428↑T `committees-evidence:writtenevidence:99772:145191`
    **Bailiffs: Enforcement of debt inquiry — BFF0004** — BFF0004 - Evidence on Bailiffs: Enforcement of debt Written evidence from Association of Civil Enforcement Agents (BFF0004) I am Stephen Wood (Steve) I am the P
 3. [guidance/quangos-govuk] score=64.935↑T `quangos-govuk:government/publications/local-regulation-retail-enforcement-pilot:3`
    **Assessment of methodology in the retail enforcement pilot** — REVIEW AND ASSESSMENT OF THE METHODOLOGY OF THE RETAIL ENFORCEMENT PILOT (REP) IN A BUSINESS ENVIRONMENT May 2009: Report submitted to the Local Better Regulati
 4. [parliamentary/pwdata-debates] score=64.894↑T `pwdata-debates:debates2017-12-12b:382`
    **EUROPEAN UNION (WITHDRAWAL) BILL — Regulations to deal with deficiencies arising from withdrawal - I** — My hon. Friend raises an excellent point, which has also been raised by the European Chemicals Agency. Those registrations, which will have cost our businesses 
 5. [parliamentary/committees-evidence] score=64.328↑T `committees-evidence:writtenevidence:86114:132404`
    **Brexit: enforcement and dispute resolution inquiry — BED0009** — BED0009 - Evidence on Brexit: enforcement and dispute resolution TheCityUK – Written Evidence (BED0009) Summary TheCityUK believes that in any context – and par
 6. [parliamentary/committees-evidence] score=63.572↑T `committees-evidence:writtenevidence:102707:148725`
    **Domestic Threat of Drones inquiry — DTD0010** — DTD0010 - Evidence on Domestic Threat of Drones (DTD0010) Written evidence submitted by the UK Civil Aviation Authority &#xa0; Introduction &#xa0; 1. &#xa0;&#xa
 7. [guidance/quangos-govuk] score=63.175↑T `quangos-govuk:government/publications/immigration-bill-part-3-enforcement:2`
    **Enforcement officer powers: factsheet** — Immigration Act 2016 Factsheet – Enforcement Officer Powers (Sections 46-58, 62) What are we going to do?  Tackle illegal immigration and minimise its impact o
 8. [guidance/quangos-govuk] score=62.822↑T `quangos-govuk:government/publications/business-regulation-business-views:2`
    **From the business end of the telescope** — 2 Purpose Local regulation and enforcement can play a major part in either increasing or alleviating the regulatory burden on business. Different businesses and
 9. [parliamentary/pwdata-debates] score=62.699↑T `pwdata-debates:debates2008-05-21c:125`
    **Orders of the Day — Regulatory Enforcement and Sanctions Bill [ Lords]** — As I said, the Bill does not alter the fundamental relationship between UK law and European law. We recently debated the European treaty at length, and the Bill
10. [parliamentary/committees-evidence] score=31.000 `committees-evidence:writtenevidence:95838:139974`
    **Enforcing the Equality Act: the law and the role of the EHRC inquiry — EEA0205** — EEA0205 - Evidence on Enforcing the Equality Act: the law and the role of the Equality and Human Rights Commission Written submission from Mr Peter Hanley (EEA0
11. [guidance/quangos-govuk] score=30.900 `quangos-govuk:government/publications/response-to-the-ai-growth-lab-call-for-evidence:2`
    **The Biometrics and Surveillance Camera Commissioner's response to the AI Growth Lab call for evidenc** — AI Growth Lab Consultation - Call for evidence questions Response from the Biometrics and Surveillance Camera Commissioner, Professor William Webster About you 
12. [parliamentary/committees-evidence] score=30.885 `committees-evidence:writtenevidence:95856:141912`
    **Enforcing the Equality Act: the law and the role of the EHRC inquiry — EEA0220** — EEA0220 - Evidence on Enforcing the Equality Act: the law and the role of the Equality and Human Rights Commission Written submission from a member of the publi
13. [guidance/ico] score=30.151 `ico:action-weve-taken/decision-notices/2025/05/ic-351751-n1j8:1`
    **NHS England** — Reference: IC-351751-N1J8 1 Freedom of Information Act 2000 (FOIA) Decision notice Date: 15 May 2025 Public Authority: NHS England Address: Quarry House Quarry 
14. [parliamentary/committees-evidence] score=29.882 `committees-evidence:writtenevidence:43018:161944`
    **Regulation of private renting — RPR0003** — PRP0003 Written evidence submitted by ACORN Introduction ACORN is a community and renters union operating across England and Wales. We support tenants to resolv
15. [parliamentary/committees-evidence] score=29.564 `committees-evidence:writtenevidence:161758:284701`
    **Regulating for growth — RFG0008** — Written evidence submitted by PRICI C.I.C ( RFG0008 ) 1. Who I Am and Why I'm Qualified I am not an economist. I am a logistics professional with budget ownersh
16. [guidance/ico] score=28.557 `ico:action-weve-taken/decision-notices/2026/02/ic-399995-p9z7:1`
    **Independent Parliamentary Standards Authority** — Reference: IC-399995-P9Z7 1 Freedom of Information Act 2000 (FOIA) Decision notice Date: 23 February 2026 Public Authority: Independent Parliamentary Standards 
17. [parliamentary/committees-evidence] score=27.987 `committees-evidence:writtenevidence:103792:149831`
    **English language tests for overseas students inquiry — ELT0062** — ELT0062 - Evidence on English language tests for overseas students ELT0062 Written evidence submitted by Shammi Akka’s Akter (ELT0062) &#xa0; My name is Shammi 
18. [guidance/ico] score=27.880 `ico:action-weve-taken/decision-notices/2026/02/ic-400553-k1y7:1`
    **Independent Parliamentary Standards Authority** — Reference: IC-400553-K1Y7 1 Freedom of Information Act 2000 (FOIA) Decision notice Date: 23 February 2026 Public Authority: Independent Parliamentary Standards 
19. [parliamentary/pwdata-debates] score=27.867 `pwdata-debates:debates2025-11-12f:491`
    **Energy** — My hon. Friend references Scotland. I was at COP26 in Glasgow the last time we had a Conservative Prime Minister who showed real climate leadership on the globa
20. [parliamentary/committees-evidence] score=27.654 `committees-evidence:writtenevidence:126664:210156`
    **Fraud — FRA0096** — FRA0096 Written evidence submitted by t he National Trading Standards Scams Team (updated) The National Trading Standards (NTS) Scams Team helps tackle mass mar

### I2 (I/H2) [PRINCIPLE-STREAM][MECHANISM] — PRINCIPLE (0–2, uncalibrated)
*Query:* Do sunset clauses actually work — do laws get reviewed when they are meant to?
*stream:* parliamentary evaluations · *kind:* principle · *metric:* lesson
*0–2 lesson:* NOT CALIBRATED — scaffold only (rubric set by example once a principle-stream result exists, §C.3). Excluded from the headline.

Lesson target: Cross-domain evaluation of a mechanism (sunset/review clauses).

Top-20 retrieved:
 1. [parliamentary/pwdata-lords] score=87.880↑T `pwdata-lords:daylord2013-12-18a:248`
    **Transparency of Lobbying, Non-Party Campaigning and Trade Union Administration Bill — Committee (4th** — My Lords, I rise briefly to support what has been said by the noble and right reverend Lord and to make two precise points. The first is that the original amend
 2. [parliamentary/pwdata-lords] score=85.963↑T `pwdata-lords:daylord2013-12-18a:247`
    **Transparency of Lobbying, Non-Party Campaigning and Trade Union Administration Bill — Committee (4th** — My Lords, I wish to speak to Amendments 181A, 181B and 181C, which all move in the same direction as the noble Lord, Lord Hodgson, on reviewing the Act. We made
 3. [guidance/quangos-govuk] score=80.614↑T `quangos-govuk:government/consultations/sunset-clauses-in-market-investigation-remedies-updated-guidance:2`
    **Updated guidance on sunset clauses in market investigation remedies: consultation document** — Updated guidance on ‘sunset clauses’ in market investigation remedies Consultation document 27 May 2015 © Crown copyright 2015 You may reuse this information (n
 4. [parliamentary/committees-reports] score=75.192↑T `committees-reports:publication:134:885`
    **Report: 7th Report - Correspondence: Lapsed sunset clauses** — Dear House of Lords Secondary Legislation Scrutiny Committee The Merchant Shipping (Ship-to-Ship Transfers) Regulations 2020 (SI 2020/94, “the new Regulations”)
 5. [parliamentary/pwdata-lords] score=36.943 `pwdata-lords:daylord2023-02-23c:223`
    **Retained EU Law (Revocation and Reform) Bill - Committee (1st Day) (Continued) — Amendment 3** — One of the more entertaining bits of the Minister’s elegant reply was the opening bit, in which she gave us a new rationale for the sunset clause: it was necess
 6. [parliamentary/pwdata-lords] score=36.159 `pwdata-lords:daylord2021-06-22c:180`
    **Professional Qualifications Bill [HL] - Committee (3rd Day) — Amendment 59** — My Lords, I support the amendment of the noble Lord, Lord Hunt of Kings Heath, which would insert a sunset clause into the Bill. Why do I say that? Because many
 7. [parliamentary/pwdata-lords] score=36.019 `pwdata-lords:daylord2023-02-28a:320`
    **Retained EU Law (Revocation and Reform) Bill - Committee (2nd Day) — Amendment 26** — No, I do not accept that, because the vast majority of the rule that would be allowed to sunset is now legally inoperable and not working. My noble friend Lord 
 8. [parliamentary/bills-api] score=35.820 `bills-api:3340:98`
    **Bill 3340 — publication 98** — WRITTEN EVIDENCE SUBMITTED BY LEWIS SILKIN LLP (REULB14) CALL FOR WRITTEN EVIDENCE: RETAINED EU LAW (REVOCATION AND REFORM) BILL This evidence is submitted by L
 9. [guidance/quangos-govuk] score=35.775 `quangos-govuk:government/consultations/sunset-clauses-in-market-investigation-remedies-updated-guidance:7`
    **Law Society of Scotland** — © The Law Society of Scotland 2015
10. [parliamentary/pwdata-debates] score=35.647 `pwdata-debates:debates2005-03-09a:411`
    **Orders of the Day — Prevention of Terrorism Bill — Clause 1 — Power to Make Control Orders** — I am trying to recognise the dilemma in which the Government find themselves, as they try to find a way between the requirements of security and our traditions 
11. [parliamentary/pwdata-lords] score=35.132 `pwdata-lords:daylord2023-02-28a:301`
    **Retained EU Law (Revocation and Reform) Bill - Committee (2nd Day) — Amendment 26** — I support the amendment in the name of the noble and learned Lord, Lord Hope, and Amendment 26. The point about consultation is extremely important, especially 
12. [parliamentary/pwdata-debates] score=35.036 `pwdata-debates:debates2020-02-12c:314`
    **Terrorist Offenders (Restriction of Early Release) Bill — Clause 1 - Eligibility for release on lice** — I am not seeking to press new clause 3, but I am seeking reassurances from the Minister relating to the purpose behind it and a commitment to post-legislative s
13. [parliamentary/pwdata-debates] score=34.491 `pwdata-debates:debates2023-01-18e:346`
    **Retained EU Law (Revocation and Reform) Bill — New Clause 1 - “Assimilated law”** — I rise to speak in support of amendments 18, 19, 21, 24 and 36. What is clear from the Government is that this Bill is ideologically driven, lacks common sense,
14. [parliamentary/pwdata-lords] score=34.227 `pwdata-lords:daylord2015-01-19a:344`
    **Recall of MPs Bill — Committee (2nd Day) (Continued)** — I am grateful to the Minister. I said in my opening remarks that the alternative was a review system and I think that the Government ought to think about that. 
15. [parliamentary/pwdata-lords] score=34.177 `pwdata-lords:daylord2023-02-28a:318`
    **Retained EU Law (Revocation and Reform) Bill - Committee (2nd Day) — Amendment 26** — I will address the noble Lord’s point at the end of my remarks, after I have moved the government amendments. I think I had got to the new clause tabled as Amen
16. [guidance/quangos-govuk] score=34.100 `quangos-govuk:government/consultations/sunset-clauses-in-market-investigation-remedies-updated-guidance:5`
    **Elcena Jeffers Foundation ** — ELCENA JEFFERS FOUNDATION (EJF) PO BOX 63057, LONDON NW9 1LQ UNITED KINGDOM Registered Charity Number: 1072333 Company Registration Number: 3601958 Alice Cole R
17. [parliamentary/pwdata-lords] score=34.074 `pwdata-lords:daylord2015-01-20a:88`
    **Counter-Terrorism and Security Bill — Committee (1st Day)** — My Lords, we have had a very good, short debate on this, with a lot of contributions that in many ways highlight the difficulties that there are in this area wh
18. [parliamentary/pwdata-lords] score=34.018 `pwdata-lords:daylord2023-03-02b:81`
    **Retained EU Law (Revocation and Reform) Bill - Committee (3rd Day) — Amendment 29** — My Lords, this has been a very full and comprehensive debate—I did not expect anything less, given the subject matter. Amendments 29, 33, 34, 35, 36, 49, 55 and
19. [parliamentary/pwdata-lords] score=33.810 `pwdata-lords:daylord2025-02-26a:149`
    **Product Regulation and Metrology Bill [HL] - Report (1st Day) — Amendment 5** — My Lords, I rise to speak in favour of my Amendments 21 and 59, and to support the amendments, to which I have added my name, from the noble Lord, Lord Frost. A
20. [parliamentary/pwdata-lords] score=33.795 `pwdata-lords:daylord2015-01-20a:75`
    **Counter-Terrorism and Security Bill — Committee (1st Day)** — My Lords, I do not understand the two-year period contained in these amendments. The issue which we are dealing with and which is covered in this clause is, unf

### I3 (I/H1) [PRINCIPLE-STREAM] — PRINCIPLE (0–2, uncalibrated)
*Query:* When has post-legislative scrutiny found a law had significant unintended consequences, and of what kind?
*stream:* parliamentary evaluations · *kind:* principle · *metric:* lesson
*0–2 lesson:* NOT CALIBRATED — scaffold only (rubric set by example once a principle-stream result exists, §C.3). Excluded from the headline.

Lesson target: Transferable unintended-consequence patterns.

Top-20 retrieved:
 1. [parliamentary/pwdata-lords] score=107.910↑T `pwdata-lords:daylord2026-02-03d:115`
    **Children’s Wellbeing and Schools Bill - Report (5th Day) — Amendment 205** — My Lords, this is a big Bill. The noble Baroness, Lady Smith, has spent many hours at the Dispatch Box justifying its provisions. This amendment enables her to 
 2. [parliamentary/pwdata-debates] score=105.987↑T `pwdata-debates:debates2007-07-25b:253`
    **Orders of the Day — Temporary restriction on the purchase of annuiities** — As the Minister has explained, the Government amendments are, in effect, a compromise arising from the Lords debates, and on behalf of the official Opposition, 
 3. [parliamentary/pwdata-lords] score=105.677↑T `pwdata-lords:daylord2011-12-21a:121`
    **Health and Social Care Bill — Committee (15th Day)** — My Lords, I rise to move the amendment in my name and that of my noble friend Lord Patel, who sends his apologies to the Committee. He is strongly enthusiastic 
 4. [parliamentary/pwdata-debates] score=97.952↑T `pwdata-debates:debates2020-02-12c:314`
    **Terrorist Offenders (Restriction of Early Release) Bill — Clause 1 - Eligibility for release on lice** — I am not seeking to press new clause 3, but I am seeking reassurances from the Minister relating to the purpose behind it and a commitment to post-legislative s
 5. [parliamentary/pwdata-westminster] score=96.997↑T `pwdata-westminster:westminster2004-02-24:38`
    **Pre-legislative Scrutiny** — I apologise. My Lancastrian ignorance of the south-west is coming to the fore. As the hon. Member for Somerton and Frome (Mr. Heath) said, programming, or timet
 6. [guidance/quangos-govuk] score=92.361↑T `quangos-govuk:government/publications/post-legislative-scrutiny:2`
    **Post-legislative scrutiny** — Law Com No 302 Post-Legislative Scrutiny The Law Commission (LAW COM No 302) POST-LEGISLATIVE SCRUTINY Presented to the Parliament of the United Kingdom by the 
 7. [parliamentary/pwdata-debates] score=91.169↑T `pwdata-debates:debates2023-06-21c:199`
    **Retained EU Law (Revocation and Reform) Bill — After Clause 16 - Environmental protection** — I am grateful to my hon. Friend. Knowing him, he will develop those points in due course. He agrees with what my noble Friend Lord Callanan said in the other pl
 8. [parliamentary/pwdata-lords] score=89.634↑T `pwdata-lords:daylord2013-10-22a:83`
    **Transparency of Lobbying, Non-Party Campaigning and Trade Union Administration Bill — Second Reading** — My Lords, it is important that we retain some clarity about why there were calls for a Bill to regulate lobbying. It was to deal with the damage to our democrac
 9. [parliamentary/committees-evidence] score=89.443↑T `committees-evidence:writtenevidence:73846:119480`
    **Legislative Process inquiry — LEG0019** — LEG0019 - Evidence on Legislative process Dr Edgar A. Whitley, Associate Professor (Reader) in Information Systems, London School of Economics and Political Sci
10. [parliamentary/niassembly-hansard] score=89.111↑T `niassembly-hansard:351845:19`
    **NI Assembly: Executive Committee Business — Adoption and Children Bill: Second Stage** — I, too, want to express my solidarity with the Minister of Health in the face of the abhorrent threats that he has had to endure in recent days. My party and I 
11. [parliamentary/pwdata-lords] score=88.976↑T `pwdata-lords:daylord2009-07-09a:110`
    **Coroners and Justice Bill — Committee (6th Day)** — I have been somewhat intimidated by the Bill. It has tremendous scope, covering many emotive issues. I am not a policeman or a lawyer; I am not interested in po
12. [parliamentary/pwdata-lords] score=86.021↑T `pwdata-lords:daylord2012-01-10b:87`
    **Legal Aid, Sentencing and Punishment of Offenders Bill — Committee (2nd Day)** — My Lords, I, too, support the amendment, which is about unintended consequences. The Government should be grateful that it has been raised at this stage of deba
13. [parliamentary/pwdata-lords] score=85.216↑T `pwdata-lords:daylord2026-04-13d:279`
    **English Devolution and Community Empowerment Bill - Report (3rd Day) — Amendment 318B** — My Lords, as I mentioned earlier, good law is a public good. It is essential that Acts deliver what they are expected to deliver, and not all do so, as the nobl
14. [parliamentary/pwdata-lords] score=85.184↑T `pwdata-lords:daylord2023-02-06b:246`
    **Retained EU Law (Revocation and Reform) Bill - Second Reading (Continued)** — My Lords, setting out on a journey when you do not know where you are going seems somewhat unwise. Politicians sometimes have to pursue careers without certaint
15. [parliamentary/pwdata-debates] score=85.143↑T `pwdata-debates:debates2025-03-26b:330`
    **Tobacco and Vapes Bill — New Clause 11 - Age verification in relation to tobacco and vaping products** — In our post-spiritual or at least post-religious age, two phenomena are evident. When God is forgotten and faith declines, people do not believe in nothing but,
16. [other/erskine-may] score=84.522↑T `erskine-may:4989:1`
    **Erskine May: Preliminary view of public bills: Pre- and post-legislative scrutiny** — 26.18 The Modernisation Committee, 1 the Constitution Committee of the House of Lords 2 and the Law Commission 3 have also drawn attention to the desirability o
17. [parliamentary/committees-reports] score=84.511↑T `committees-reports:publication:52418:290924`
    **Correspondence: Correspondence from Dr Jo Farrar CB OBE, Ministry of Justice Permanent Secretary, da** — Andy Slaughter MP Chair Justice Committee House of Commons London SW1A 0AA By email only Dr Jo Farrar CB OBE Permanent Secretary Ministry of Justice 102 Petty F
18. [parliamentary/pwdata-lords] score=84.219↑T `pwdata-lords:daylord2008-07-16a:187`
    **Pre-legislative Scrutiny** — My Lords, I congratulate my noble friend Lord Goodlad on raising this important question. The Constitution Committee's report on pre-legislative scrutiny follow
19. [parliamentary/pwdata-lords] score=83.732↑T `pwdata-lords:daylord2011-12-21a:126`
    **Health and Social Care Bill — Committee (15th Day)** — My Lords, I thank the noble Earl for his response, which I think recognises the fact that there will be a need continually to provide reassurance that the purpo
20. [parliamentary/pwdata-lords] score=83.290↑T `pwdata-lords:daylord2021-01-20c:137`
    **Overseas Operations (Service Personnel and Veterans) Bill - Second Reading** — My Lords, this is an important Bill, but it has to be examined closely so that it does not create more problems than it sets out to solve. Ordinarily, I would a

### J1 (J/H1) [FOREIGN] — PENDING VALIDATION
*Query:* How do other countries regulate short-term lets — and what worked?
*stream:* web + foreign corpus · *kind:* specific · *metric:* recall@20
*recall@20:* pending — expected-sources are TODO placeholders (§C); excluded from the headline until the validated answer-key lands.

Expected sources (TODO):
- ⋯ TODO — TODO (deferred): comparator regimes — EU registration models, US city caps

Top-20 retrieved:
 1. [legislation/primary-acts-pre-2000] score=118.651↑T `primary-acts-pre-2000:ukpga/1997/8:section-26B`
    **Material change of use: short-term lets** — 26B 1 A planning authority may designate all or part of its area as a short-term let control area for the purposes of this section. 2 In a short-term let contro
 2. [parliamentary/pwdata-debates] score=78.142↑T `pwdata-debates:debates2026-02-11b:153`
    **Short-term Let Accommodation (Data Sharing Requirements)** — I beg to move, That leave be given to bring in a Bill to require certain persons or organisations to share specified data relating to the short-term letting of 
 3. [parliamentary/pwdata-debates] score=75.986↑T `pwdata-debates:debates2022-06-16a:366`
    **Sharing Economy: Short-term Letting** — My hon. Friend is absolutely right. With the explosion in the number of short-term lettings, a whole host of problems associated with such lettings have become 
 4. [parliamentary/pwdata-lordswrans] score=75.175↑T `pwdata-lordswrans:lordswrans2019-01-07:28`
    **Ministry of Housing, Communities and Local Government — Holiday Accommodation: Registration** — Q (baroness gardner of parkes): To ask Her Majesty's Government what assessment they have made of steps taken in other countries requiring home owners to offer 
 5. [parliamentary/pwdata-wrans] score=71.854↑T `pwdata-wrans:answers2024-02-22:136`
    **Department for Culture, Media and Sport — Holiday Accommodation: Registration** — Q (Rachael Maskell): To ask the Secretary of State for Culture, Media and Sport, whether the proposed register for short-term lets will be shared with HMRC to e
 6. [parliamentary/pwdata-westminster] score=71.261↑T `pwdata-westminster:westminster2023-05-23a:18`
    **Short-term Holiday Lets: Planning — [Dame Caroline Dinenage in the Chair]** — It is a pleasure to speak in this debate, and to support my neighbour, my hon. Friend the Member for Torbay (Kevin Foster) . Across south Devon, we have been de
 7. [parliamentary/pwdata-westminster] score=71.187↑T `pwdata-westminster:westminster2024-09-12a:42`
    **Short-term Lets: Regulation — [Carolyn Harris in the Chair]** — It has been a real honour to hear the stories of different places across our country. It has been a real privilege to serve under your chairship, Mrs Harris; to
 8. [parliamentary/pwdata-westminster] score=70.751↑T `pwdata-westminster:westminster2024-09-12a:10`
    **Short-term Lets: Regulation — [Carolyn Harris in the Chair]** — I thank the hon. Gentleman for that helpful intervention and for elaborating on that point. I definitely believe in the politics of justice over the politics of
 9. [parliamentary/pwdata-lordswms] score=70.506↑T `pwdata-lordswms:lordswms2024-02-19:1`
    **Department for Culture, Media and Sport — Delivery Update** — Following consultation on a registration scheme for short-term lets in England, today the Government sets out further details on how the scheme will operate. Sh
10. [parliamentary/pwdata-wms] score=70.426↑T `pwdata-wms:ministerial2024-02-19:2`
    **Department for Culture, Media and Sport — Delivery Update** — Following consultation on a registration scheme for short-term lets in England, today the Government sets out further details on how the scheme will operate. Sh
11. [parliamentary/pwdata-debates] score=70.421↑T `pwdata-debates:debates2015-03-10a:282`
    **DEREGULATION BILL (PROGRAMME) (NO.3) — Clause 1 — Health and safety at work: general duty of self-em** — The honest answer is that we do not yet have such details, but they will be set out in regulations. I assume that a local authority would have to provide exampl
12. [parliamentary/pwdata-westminster] score=70.247↑T `pwdata-westminster:westminster2015-01-07a:93`
    **Short Let Deregulation (London)** — I suspect, therefore, that the hon. Gentleman will be pleased to support the Government’s proposals. If he looks back at my opening remarks, I think that that w
13. [parliamentary/pwdata-lords] score=69.873↑T `pwdata-lords:daylord2023-03-22a:132`
    **Levelling-up and Regeneration Bill - Committee (7th Day) — Amendment 180** — I will be coming to that in a moment. Finally, I turn to Amendments 445, 445A, 445B and 447, tabled by the noble Lord, Lord Foster of Bath. These amendments con
14. [parliamentary/pwdata-wrans] score=68.996↑T `pwdata-wrans:answers2020-06-30:374`
    **Department for Digital, Culture, Media and Sport — Holiday Accommodation: Bristol** — Q (Thangam Debbonaire): To ask the Secretary of State for Digital, Culture, Media and Sport, what assessment his Department has made of the effect of the covid-
15. [parliamentary/pwdata-westminster] score=68.873↑T `pwdata-westminster:westminster2023-05-23a:30`
    **Short-term Holiday Lets: Planning — [Dame Caroline Dinenage in the Chair]** — It is a great pleasure to see you in the Chair, Dame Caroline, and I thank my hon. Friend the Member for Torbay (Kevin Foster) for introducing this vital debate
16. [parliamentary/pwdata-westminster] score=68.797↑T `pwdata-westminster:westminster2024-09-12a:1`
    **Short-term Lets: Regulation — [Carolyn Harris in the Chair]** — I beg to move, That this House has considered the regulation of short-term lets. It is an honour and a genuine privilege to serve under your chairship, Mrs Harr
17. [parliamentary/pwdata-wrans] score=68.787↑T `pwdata-wrans:answers2022-04-25:654`
    **Department for Digital, Culture, Media and Sport — Holiday Accommodation** — Q (Rachael Maskell): To ask the Secretary of State for Digital, Culture, Media and Sport, whether she has made an assessment of the potential merits of (a) the 
18. [parliamentary/pwdata-debates] score=68.737↑T `pwdata-debates:debates2022-06-16a:379`
    **Sharing Economy: Short-term Letting** — The hon. Lady makes an important point. I will come on to registration, but clearly we do need to look at the options. We have heard about the problems caused, 
19. [parliamentary/pwdata-lords] score=68.649↑T `pwdata-lords:daylord2023-03-22a:126`
    **Levelling-up and Regeneration Bill - Committee (7th Day) — Amendment 180** — My Lords, I am speaking as a former member of the Built Environment Committee; I was a member when the committee’s report was drawn up. I thank the chairman, th
20. [parliamentary/pwdata-debates] score=68.492↑T `pwdata-debates:debates2022-03-23c:332`
    **Short and Holiday-Let Accommodation (Registration) Bill** — I beg to move, That leave be given to bring in a Bill to establish a national register of short and holiday-let accommodation; to give local authorities powers 

### K1 (K/H2) — PENDING VALIDATION
*Query:* I want to remove the no-fault eviction route — which exact provision do I amend?
*stream:* legislation (section-level) · *kind:* specific · *metric:* recall@20
*recall@20:* pending — expected-sources are TODO placeholders (§C); excluded from the headline until the validated answer-key lands.

Expected sources (TODO):
- ⋯ TODO — TODO (validate): HA 1988 s.21 (exact-pin) + Renters’ Rights Act 2025 repealing provision

Top-20 retrieved:
 1. [parliamentary/pwdata-lords] score=81.082↑T `pwdata-lords:daylord2025-10-14c:109`
    **Renters’ Rights Bill - Commons Reasons and Amendments — Motion B** — My Lords, I congratulate the noble Lord, Lord Young of Cookham, on the compromise he has achieved on this important amendment. I must declare a family interest:
 2. [parliamentary/pwdata-westminster] score=80.555↑T `pwdata-westminster:westminster2018-12-06a:59`
    **SELECT COMMITTEE ON EDUCATION — Section 21 Evictions** — The Minister highlights important and hard-won preconditions for taking eviction proceedings, but that does not alter the fact that, in the generality of cases,
 3. [parliamentary/niassembly-hansard] score=80.210↑T `niassembly-hansard:396690:283`
    **NI Assembly: Opposition Business — No-fault Evictions: Ban** — I have three minutes, so I will try to fly through this as quickly as possible. As the Alliance Party's housing spokesperson, I can say that we will support the
 4. [parliamentary/pwdata-lords] score=78.695↑T `pwdata-lords:daylord2025-07-01b:213`
    **Renters’ Rights Bill - Report (1st Day) (Continued) — Amendment 41** — My Lords, I thank my noble friend Lord Hacking and the noble Lords, Lord Cromwell and Lord Young, for their amendments and their engagement on these issues. I a
 5. [parliamentary/pwdata-wrans] score=77.649↑T `pwdata-wrans:answers2021-11-15:239`
    **Department for Levelling Up, Housing and Communities — Evictions** — Q (Fabian Hamilton): To ask the Secretary of State for Levelling Up, Housing and Communities, whether he is taking steps to (a) end Section 21 evictions and (b)
 6. [parliamentary/pwdata-lords] score=77.234↑T `pwdata-lords:daylord2019-05-15a:2`
    **Housing: No-fault Evictions - Question** — My Lords, there was no widespread support for a fixed-term tenancy model. We concluded that the best way to introduce greater security was to remove Section 21 
 7. [parliamentary/pwdata-wrans] score=77.046↑T `pwdata-wrans:answers2019-05-08:165`
    **Ministry of Housing, Communities and Local Government — Private Rented Housing: Evictions** — Q (Sir David Evennett): To ask the Secretary of State for Housing, Communities and Local Government, what deterrents are in place to stop rogue landlords illega
 8. [parliamentary/pwdata-debates] score=75.803↑T `pwdata-debates:debates1920-07-01a:592`
    **Orders of the Day — SUPPLY [15TH ALLOTTED DAY]. — CLAUSE 13.—(Application to business premises.)** — I wish to offer objection to the way we have been treated in connection with this matter. The right hon. Gentleman in speaking to this Amendment offered no argu
 9. [parliamentary/niassembly-hansard] score=75.438↑T `niassembly-hansard:428904:266`
    **NI Assembly: Private Members' Business — New Deal for Private Renters in Northern Ireland** — I start by thanking Members for tabling the motion, and by saying that I own a private property from which I gain a rental income. Sinn Féin believes that housi
10. [parliamentary/pwdata-wrans] score=74.527↑T `pwdata-wrans:answers2021-10-18:221`
    **Department for Levelling Up, Housing and Communities — Evictions** — Q (Dr Rupa Huq): To ask the Secretary of State for Levelling Up, Housing and Communities, what assessment he has made of the potential merits of abolishing sect
11. [parliamentary/pwdata-lords] score=74.399↑T `pwdata-lords:daylord2025-04-28a:180`
    **Renters’ Rights Bill - Committee (3rd Day) — Amendment 76** — My Lords, as colleagues have already said, the Liberal Democrats have long campaigned to abolish no-fault evictions. We support the measures in this Bill, parti
12. [parliamentary/pwdata-lords] score=73.613↑T `pwdata-lords:daylord2021-01-27b:31`
    **No-fault Evictions - Question** — I will have to write on that specific point. It is important that this is seen as a balance of strengthening the rights for eviction while removing the no-fault
13. [parliamentary/niassembly-hansard] score=73.437↑T `niassembly-hansard:418424:114`
    **NI Assembly: Oral Answers to Questions — No-fault Evictions** — The Member is right to raise the situation in Scotland. Scotland tried to put in place what is, in theory, a no-fault eviction ban, but, in practice, it has bee
14. [parliamentary/pwdata-westminster] score=73.022↑T `pwdata-westminster:westminster2022-10-25b:84`
    **Section 21 Evictions — [Caroline Nokes in the Chair]** — It is a pleasure to serve under your chairmanship this afternoon, Ms Nokes. I congratulate my hon. Friend the Member for Liverpool, Walton (Dan Carden) on secur
15. [parliamentary/pwdata-wrans] score=72.740↑T `pwdata-wrans:answers2021-12-02:250`
    **Department for Levelling Up, Housing and Communities — Evictions** — Q (Lloyd Russell-Moyle): To ask the Secretary of State for Levelling Up, Housing and Communities, what assessment he has made of the potential effect of abolish
16. [parliamentary/pwdata-debates] score=72.577↑T `pwdata-debates:debates2025-10-22b:230`
    **Renters’ Rights Bill — Clause 15 - Other duties** — I will be brief, because this is a time-limited debate. I welcome the Bill, although it has deficiencies, because it does not regulate the amount of rent that i
17. [parliamentary/pwdata-debates] score=72.087↑T `pwdata-debates:debates2024-03-14d:166`
    **Business of the House** — First, I pay tribute to Tommy McAvoy, the former Member for Rutherglen. Tommy was a legend of the Labour Whips Office, and the longest ever serving Government W
18. [parliamentary/pwdata-lords] score=71.886↑T `pwdata-lords:daylord2025-07-01b:128`
    **Renters’ Rights Bill - Report (1st Day) — Amendment 8** — My Lords, I thank the noble Lord, Lord Carrington, for these considered amendments, which reflect the debate we had around his similar suggestions in Committee,
19. [parliamentary/pwdata-lords] score=71.799↑T `pwdata-lords:daylord2025-04-22a:168`
    **Renters’ Rights Bill - Committee (1st Day) (Continued) — Amendment 15** — My Lords, this is my first speech today, so I will take the opportunity to thank the Minister and her team for all the discussions so far. I support the fundame
20. [parliamentary/pwdata-debates] score=71.496↑T `pwdata-debates:debates1952-10-16a:386`
    **Orders of the Day — HOUSING (SCOTLAND) BILL — Clause 3.—(SCHEMES FOR THE PROVISION, OTHERWISE THAN B** — I had thought that there might have been more discussion on this Amendment, but I shall try not to keep the Committee long, although there are one or two points

### K2 (K/H1) [BILLS] — PENDING VALIDATION
*Query:* To add a statutory duty of candour for public bodies, where would it slot in?
*stream:* legislation (section-level) · *kind:* specific · *metric:* recall@20
*recall@20:* pending — expected-sources are TODO placeholders (§C); excluded from the headline until the validated answer-key lands.

Expected sources (TODO):
- ⋯ TODO — TODO (validate): HSCA 2008 (Regulated Activities) Regs reg 20 + Public Office (Accountability) Bill

Top-20 retrieved:
 1. [parliamentary/bills-api] score=99.837↑T `bills-api:4019:8`
    **Bill 4019 — publication 8** — Written evidence submitted by Independent Public Advocate for the Public Office (Accountability) Bill Committee (POAB13) IPA Background 1. The Independent Publi
 2. [parliamentary/committees-reports] score=92.867↑T `committees-reports:publication:49802:266912`
    **Correspondence: Correspondence from the Minister for Victims and Violence Against Women and Girls to** — T +4420 3334 3555 F +44870 761 7753 E https://contact-moj.service.justice.gov.uk/ www.gov.uk/moj 102 Petty France London SW1H 9AJ Alex Davies-Jones MP Parliamen
 3. [parliamentary/committees-reports] score=92.711↑T `committees-reports:publication:49610:264286`
    **Correspondence: Correspondence from Alex Davies-Jones MP, Minister for Victims and Violence Against ** — T +4420 3334 3555 F +44870 761 7753 E https://contact-moj.service.justice.gov.uk/ www.gov.uk/moj 102 Petty France London SW1H 9AJ Alex Davies-Jones MP Parliamen
 4. [parliamentary/committees-reports] score=90.254↑T `committees-reports:publication:42532:211487`
    **Correspondence: Letter from Alex Chalk KC MP, Lord Chancellor and Secretary of State for Justice, da** — T 020 3334 3555 F 0870 761 7753 E https://contact-moj.service.justice.gov.uk/ www.gov.uk/moj 102 Petty France London SW1H 9AJ The Right Honourable Alex Chalk KC
 5. [parliamentary/committees-evidence] score=89.999↑T `committees-evidence:writtenevidence:128905:220302`
    **Statutory Inquiries — STI0006** — Written submission from Steffan Groch ( STI0006 ) My submission below is largely to address Questions numbers 1[a] and 2, but it also has relevance to Questions
 6. [parliamentary/pwdata-westminster] score=89.521↑T `pwdata-westminster:westminster2010-12-01b:16`
    **[Mr James Gray in the Chair] — Candour in Health Care** — In this particular case, interviews were conducted with the two qualified nurses. The trust did not read both transcripts together and did not see that both nur
 7. [parliamentary/pwdata-lords] score=88.106↑T `pwdata-lords:daylord2025-04-25a:61`
    **Public Inquiries: Enchancing Public Trust (Statutory Inquiries Committee Report) - Motion to Take No** — My Lords, I thank the noble Lord, Lord Norton of Louth, for his introductory remarks and his clear, disciplined leadership of the committee. With no experience 
 8. [parliamentary/pwdata-westminster] score=87.410↑T `pwdata-westminster:westminster2010-12-01b:6`
    **[Mr James Gray in the Chair] — Candour in Health Care** — I am sure that Mr Powell will be listening carefully to what is said and reading the remarks in Hansard later. That family have played a major role in bringing 
 9. [parliamentary/pwdata-westminster] score=87.397↑T `pwdata-westminster:westminster2025-09-03a:88`
    **Duty of Candour for Public Authorities and Legal Representation for Bereaved Families — [Wera Hobhou** — It is a pleasure to serve under your chairmanship, Mrs Hobhouse. I thank the hon. Member for Liverpool West Derby (Ian Byrne) for securing this important debate
10. [parliamentary/pwdata-wrans] score=86.189↑T `pwdata-wrans:answers2025-10-09:6`
    **Department of Health and Social Care — Mental Health Services: Disclosure of Information** — Q (Cameron Thomas): To ask the Secretary of State for Health and Social Care, whether his Department plans to hold discussions with leaders of mental health ser
11. [parliamentary/niassembly-hansard] score=85.728↑T `niassembly-hansard:416633:414`
    **NI Assembly: Private Members' Business — Statutory Duty of Candour** — I give my party's support to the motion and the amendment. The report into hyponatraemia-related deaths was published in January 2018, 14 years after the inquir
12. [parliamentary/bills-api] score=85.424↑T `bills-api:4019:5`
    **Bill 4019 — publication 5** — 1 Written evidence submitted by Centre for People’s Justice for the Public Office (Accountability) Bill Committee (POAB05) Lead Author: Professor Lydia Hayes, S
13. [parliamentary/pwdata-debates] score=85.199↑T `pwdata-debates:debates2022-02-28a:514`
    **Police, Crime, Sentencing and Courts Bill — After Clause 54 - Accountability of public authorities: ** — Lords amendment 71 would introduce a duty of candour for the police workforce. I am sure that hon. Members know that the Government take police integrity and ac
14. [parliamentary/pwdata-debates] score=84.913↑T `pwdata-debates:debates2026-04-27e:467`
    **Public Office (Accountability) Bill (Carry-over)** — I could not agree more with the hon. Gentleman. He is fundamentally correct that the Bill is about much more than just the duty of candour. This is about rebuil
15. [parliamentary/bills-api] score=83.549↑T `bills-api:4019:6`
    **Bill 4019 — publication 6** — 1 Public Office (Accountability) Bill 2025 Briefing for Committee Stage, House of Commons, November 2025 1. Hillsborough Law Now (HLN) has worked closely with t
16. [parliamentary/bills-api] score=83.300↑T `bills-api:4019:7`
    **Bill 4019 — publication 7** — Campaign Group Statement – The Chinook Justice Campaign Submitted by: The Chinook Justice Campaign Bill: Public Office (Accountability) Bill Stage: House of Com
17. [parliamentary/pwdata-debates] score=82.849↑T `pwdata-debates:debates2026-07-14a:263`
    **Public Office (Accountability) Bill — New Clause 8 - Information contained in public records** — With this it will be convenient to discuss the following: Government new clause 9. New clause 1—Post-legislative assessment of the legal duty of candour for pub
18. [parliamentary/pwdata-debates] score=82.849↑T `pwdata-debates:debates2026-07-14a:263`
    **Public Office (Accountability) Bill — New Clause 8 - Information contained in public records** — With this it will be convenient to discuss the following: Government new clause 9. New clause 1—Post-legislative assessment of the legal duty of candour for pub
19. [parliamentary/committees-evidence] score=82.644↑T `committees-evidence:writtenevidence:128967:220290`
    **Statutory Inquiries — STI0014** — Written Evidence from Pete Weatherby KC and Anna Morris KC (STI0014) Pete Weatherby KC I have been a barrister for 32 years, 12 of them in silk. A significant p
20. [parliamentary/committees-reports] score=82.569↑T `committees-reports:publication:44986:223253`
    **Report: Third Report - Human rights and the proposal for a “Hillsborough Law”** — House of Lords House of Commons Joint Committee on Human Rights Human rights and the proposal for a “Hillsborough Law” Third Report of Session 2023–24 Report, t
