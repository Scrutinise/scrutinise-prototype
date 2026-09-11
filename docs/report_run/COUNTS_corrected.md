# COUNTS — corrected (CCW-B23 §2)

*2026-09-11 16:08 UTC · read off the database by `scripts/b23-counts.ts`; the report's figures are copied from `report_src_v2/08_part4.md` and `09_part5_rest.md` as they stood on 11 September.*

## The mechanism

`LexCoherentAction` and `DiagnosisCause` have **no `runVersion` column**. Every build APPENDS its actions
to the idea (a re-run REPLACES the causes — the table below shows only the latest build's rows survive),
and `b14-export.ts` exports every row on the idea. `EvidenceItem` and
`DeepeningIssue` DO carry `runVersion` — the export scopes the evidence to the build's version (and says
so in a comment written after M-01 v1+v2 were once merged), **but exports every deepening issue on the
idea regardless of version**. So of the four surfaces:

| surface | column | export scoped? | collapse across builds? |
|---|---|---|---|
| actions | none | ❌ all rows | **yes** — wherever an idea has more than one build |
| causes | none | ❌ all rows — but a re-run replaces them, so all rows = latest | **no** (superseded, not summed) |
| evidence | `runVersion` | ✅ build version | **no** |
| provisions / judgments | derived from evidence | ✅ | **no** |
| challenges | `runVersion` | ❌ all rows | **yes** — wherever an idea has more than one build |

Nine of the twelve have one build, so their rows belong to one version and nothing collapses. The
three re-built after the kernel fix (M-01, M-02, M-06) are where the figures move.

## Builds per measure

| Measure | Builds (DONE) | Latest |
|---|---|---|
| M-01 — Human Rights Act 1998 and the European Convention on Human Rights | v1 2026-09-02 · v2 2026-09-02 · v3 2026-09-09 · v4 2026-09-09 | v4 |
| M-02 — Equality Act 2010 | v1 2026-09-02 · v2 2026-09-09 | v2 |
| M-03 — The United Kingdom Supreme Court | v1 2026-09-02 | v1 |
| M-04 — The arm's-length body estate | v1 2026-09-02 | v1 |
| M-05 — Judicial review of executive decisions | v1 2026-09-02 | v1 |
| M-06 — The permanent, appointed civil service | v1 2026-09-02 · v2 2026-09-09 | v2 |
| M-07 — Operational independence of the Bank of England | v1 2026-09-02 | v1 |
| M-08 — Diversity, equity and inclusion practice in the civil service | v1 2026-09-02 | v1 |
| M-09 — Gender self-identification | v1 2026-09-02 | v1 |
| M-10 — Publicly funded charities campaigning on government policy | v1 2026-09-02 | v1 |
| M-11 — The Sentencing Council and sentencing guidelines | v1 2026-09-02 | v1 |
| M-12 — The Great Repeal: the programme as a single instrument | v1 2026-09-02 | v1 |

## 1. Actions — the true, de-duplicated count

*Rows on the idea · rows per build (assigned by the build's time window) · the count in the latest build ·
duplicates within that build by normalised text · what the report prints and which build that is.*

| Measure | Rows | Per build | **True count (latest build)** | Dups within latest | Report prints | Report figure is |
|---|---|---|---|---|---|---|
| M-01 | 16 | v1: 4, v2: 4, v3: 4, v4: 4 | **4** | 0 | 8 (§4.1) | ⚠ **v1+v2 summed** |
| M-02 | 8 | v1: 4, v2: 4 | **4** | 0 | 4 (§4.2) | v1 or v2 |
| M-03 | 4 | v1: 4 | **4** | 0 | 4 (§5.1) | v1 |
| M-04 | 4 | v1: 4 | **4** | 0 | 4 (§5.2) | v1 |
| M-05 | 4 | v1: 4 | **4** | 0 | 4 (§5.3) | v1 |
| M-06 | 8 | v1: 4, v2: 4 | **4** | 0 | 4 (§4.3) | v1 or v2 |
| M-07 | 4 | v1: 4 | **4** | 0 | 4 (§5.4) | v1 |
| M-08 | 4 | v1: 4 | **4** | 0 | 4 (§5.5) | v1 |
| M-09 | 4 | v1: 4 | **4** | 0 | 4 (§5.6) | v1 |
| M-10 | 4 | v1: 4 | **4** | 0 | 4 (§5.7) | v1 |
| M-11 | 3 | v1: 3 | **3** | 0 | 3 (§5.8) | v1 |
| M-12 | 4 | v1: 4 | **4** | 0 | 4 (§5.9) | v1 |
| **all twelve** | **67** | | **47** | | **51** | |

⚠ "True count" is the number of coherent actions in the build the measure now stands on. A build
replaces the previous build's actions — it does not add to them — so the rows from earlier builds are
revisions of the same work, not further work. Within a single build there are no duplicates on any
measure (column 5).

## 2. Causes — replaced by a re-run, not appended

*Only the rows of the latest build exist on the idea, so nothing sums. Where the report prints a figure no
build now holds (M-01, M-06), it is the count from the superseded build the chapter describes, and
those rows were overwritten by the re-run.*

| Measure | Rows | Per build | Latest build | Report prints | Report figure is |
|---|---|---|---|---|---|
| M-01 | 2 | v4: 2 | 2 | 3 | ⚠ **matches no build and no sum** |
| M-02 | 2 | v2: 2 | 2 | 2 | v2 |
| M-03 | 2 | v1: 2 | 2 | 2 | v1 |
| M-04 | 3 | v1: 3 | 3 | 3 | v1 |
| M-05 | 2 | v1: 2 | 2 | 2 | v1 |
| M-06 | 2 | v2: 2 | 2 | 3 | ⚠ **matches no build and no sum** |
| M-07 | 2 | v1: 2 | 2 | 2 | v1 |
| M-08 | 3 | v1: 3 | 3 | 3 | v1 |
| M-09 | 2 | v1: 2 | 2 | 2 | v1 |
| M-10 | 2 | v1: 2 | 2 | 2 | v1 |
| M-11 | 2 | v1: 2 | 2 | 2 | v1 |
| M-12 | 3 | v1: 3 | 3 | 3 | v1 |

## 3. Evidence — scoped by the export, and it holds

*"Rows" and "per version" count the rows each BUILD wrote. Rows appended to a version afterwards by later
producers (`positions`, 4 Sep; `STATUTORY_CONSEQUENCES`, 9 Sep) are in the last column, by pass — they are
additions, not duplicates, and they are why a raw `count(*)` per version today exceeds the export.*

| Measure | Rows | Per version | Latest version | Dups within latest | Report prints | Report figure is | Appended since, by pass |
|---|---|---|---|---|---|---|---|
| M-01 | 315 | v1: 9, v2: 73, v3: 101, v4: 132 | 132 | 25 | 73 | v2 | v2 positions: 6 |
| M-02 | 207 | v2: 100, v1: 107 | 100 | 6 | 107 | v1 | v2 STATUTORY_CONSEQUENCES: 8, v1 positions: 2 |
| M-03 | 128 | v1: 128 | 128 | 1 | 128 | v1 | v1 STATUTORY_CONSEQUENCES: 8, v1 positions: 2 |
| M-04 | 103 | v1: 103 | 103 | 3 | 103 | v1 | v1 positions: 2 |
| M-05 | 109 | v1: 109 | 109 | 0 | 109 | v1 | v1 positions: 2 |
| M-06 | 247 | v1: 118, v2: 129 | 129 | 2 | 118 | v1 | v1 positions: 2 |
| M-07 | 119 | v1: 119 | 119 | 0 | 119 | v1 | v1 STATUTORY_CONSEQUENCES: 8, v1 positions: 2 |
| M-08 | 110 | v1: 110 | 110 | 0 | 110 | v1 | v1 positions: 2 |
| M-09 | 83 | v1: 83 | 83 | 3 | 83 | v1 | — |
| M-10 | 75 | v1: 75 | 75 | 1 | 75 | v1 | v1 positions: 2 |
| M-11 | 96 | v1: 96 | 96 | 2 | 96 | v1 | v1 STATUTORY_CONSEQUENCES: 8, v1 positions: 6 |
| M-12 | 52 | v1: 52 | 52 | 1 | 52 | v1 | — |

### 3a. Findings that run the other way (`kind = CONTRADICTS`)

| Measure | Per version | Latest version | Report prints | Report figure is |
|---|---|---|---|---|
| M-01 | v1: 5, v2: 15, v3: 12, v4: 17 | 17 | 15 | v2 |
| M-02 | v2: 12, v1: 15 | 12 | 15 | v1 |
| M-03 | v1: 12 | 12 | 12 | v1 |
| M-04 | v1: 10 | 10 | 10 | v1 |
| M-05 | v1: 9 | 9 | 9 | v1 |
| M-06 | v1: 15, v2: 14 | 14 | 15 | v1 |
| M-07 | v1: 17 | 17 | 17 | v1 |
| M-08 | v1: 8 | 8 | 8 | v1 |
| M-09 | v1: 10 | 10 | 10 | v1 |
| M-10 | v1: 9 | 9 | 9 | v1 |
| M-11 | v1: 19 | 19 | 19 | v1 |
| M-12 | v1: 14 | 14 | 14 | v1 |

### 3b. Provisions and judgments retrieved and read

*Evidence rows written by the latest build with `sourceType = PRIMARY_LEGISLATION` / `CASE_LAW`; "distinct" is
by CITATION, which is the rule the report used (checked exact on M-01, M-03, M-07, M-12 against their exports).
The report figure is the version its chapter describes, so it differs from "latest" only where the chapter
describes a superseded build.*

| Measure | Provision rows (latest) | distinct | Report prints | Judgment rows (latest) | distinct | Report prints |
|---|---|---|---|---|---|---|
| M-01 | 33 | 15 | 3 | 12 | 10 | 1 |
| M-02 | 11 | 7 | 13 | 24 | 13 | 17 |
| M-03 | 14 | 9 | 9 | 23 | 16 | 16 |
| M-04 | 13 | 6 | 6 | 16 | 14 | 14 |
| M-05 | 7 | 7 | 7 | 23 | 14 | 14 |
| M-06 | 14 | 12 | 10 | 21 | 11 | 11 |
| M-07 | 21 | 10 | 10 | 6 | 4 | 4 |
| M-08 | 12 | 7 | 7 | 17 | 14 | 14 |
| M-09 | 12 | 6 | 6 | 10 | 5 | 5 |
| M-10 | 5 | 4 | 4 | 6 | 5 | 5 |
| M-11 | 8 | 3 | 3 | 10 | 8 | 8 |
| M-12 | 17 | 11 | 11 | 2 | 1 | 1 |

## 4. Challenges (`DeepeningIssue`) — exported unscoped, and it collapses

| Measure | Rows | Per version | Status | **Latest version** | Dups within latest | Report prints | Report figure is |
|---|---|---|---|---|---|---|---|
| M-01 | 182 | v2: 59, v1: 30, v3: 44, v4: 49 | OPEN: 182 | **49** | 0 | 89 | ⚠ **v1+v2 summed** |
| M-02 | 86 | v1: 46, v2: 40 | OPEN: 86 | **40** | 0 | 46 | v1 |
| M-03 | 46 | v1: 46 | OPEN: 46 | **46** | 0 | 46 | v1 |
| M-04 | 46 | v1: 46 | OPEN: 46 | **46** | 0 | 46 | v1 |
| M-05 | 50 | v1: 50 | OPEN: 50 | **50** | 0 | 50 | v1 |
| M-06 | 86 | v1: 41, v2: 45 | OPEN: 86 | **45** | 0 | 41 | v1 |
| M-07 | 46 | v1: 46 | OPEN: 46 | **46** | 0 | 46 | v1 |
| M-08 | 48 | v1: 48 | OPEN: 48 | **48** | 0 | 48 | v1 |
| M-09 | 39 | v1: 39 | OPEN: 39 | **39** | 0 | 39 | v1 |
| M-10 | 48 | v1: 48 | OPEN: 48 | **48** | 0 | 48 | v1 |
| M-11 | 39 | v1: 39 | OPEN: 39 | **39** | 0 | 39 | v1 |
| M-12 | 48 | v1: 48 | OPEN: 48 | **48** | 0 | 48 | v1 |
| **all twelve** | **764** | | | **544** | | **586** | |

Deepening passes per version (each pass raises its own issues; a re-run adds a second set):

| Measure | Passes | Per version |
|---|---|---|
| M-01 | 9 | v1: 1, v3: 4, v4: 4 |
| M-02 | 9 | v2: 8, v1: 1 |
| M-03 | 8 | v1: 8 |
| M-04 | 7 | v1: 7 |
| M-05 | 7 | v1: 7 |
| M-06 | 8 | v2: 7, v1: 1 |
| M-07 | 9 | v1: 9 |
| M-08 | 6 | v1: 6 |
| M-09 | 8 | v1: 8 |
| M-10 | 7 | v1: 7 |
| M-11 | 9 | v1: 9 |
| M-12 | 8 | v1: 8 |

## Which figures in the report are wrong, and by how much

- **M-01 actions (§4.1): prints 8** — ⚠ **v1+v2 summed**. The build the chapter describes (v2) has **4**; the latest build (v4) has **4**.
- **M-01 challenges (§4.1): prints 89** — ⚠ **v1+v2 summed**. The build the chapter describes (v2) raised **59**; the latest build (v4) raised **49**.

Every other printed action, challenge, evidence, contradicting-finding, provision and judgment figure
belongs to exactly one build. ⚠ In §4.1 the eight printed steps are the four from v1 (steps 1–4) followed by
the four from v2 (steps 5–8); the chapter describes v2, so steps 5–8 are the ones that belong to it.

### And which figures are right but describe a superseded build

- M-01 (§4.1): the chapter's evidence base (73) is build **v2**; the measure now stands on **v4** (132 rows). The B22 critique and the B23 opponent read the kernel through `kernelText()` — the latest proposals, i.e. v4 — and the opponent's evidence is the latest DONE build's; `cost-route.ts` read every action row on the idea, all 16, which is where the duplicate finding came from.
- M-02 (§4.2): the chapter's evidence base (107) is build **v1**; the measure now stands on **v2** (100 rows). The B22 critique and the B23 opponent read the kernel through `kernelText()` — the latest proposals, i.e. v2 — and the opponent's evidence is the latest DONE build's; `cost-route.ts` read every action row on the idea, all 8, which is where the duplicate finding came from.
- M-06 (§4.3): the chapter's evidence base (118) is build **v1**; the measure now stands on **v2** (129 rows). The B22 critique and the B23 opponent read the kernel through `kernelText()` — the latest proposals, i.e. v2 — and the opponent's evidence is the latest DONE build's; `cost-route.ts` read every action row on the idea, all 8, which is where the duplicate finding came from.

---

## Appendix — the de-duplicated actions, latest build, verbatim

### M-01 — Human Rights Act 1998 and the European Convention on Human Rights (v4, 4 actions)

1. Draft and introduce a Bill to Parliament, explicitly repealing the Human Rights Act 1998 in its entirety and providing the necessary statutory authority for the government to issue a notice of denunciation under Article 58 of the European Convention on Human Rights.
2. Secure parliamentary passage for the Bill, coordinating with government whips and party leadership to ensure sufficient support and manage potential opposition from within and outside Parliament.
3. Following Royal Assent, the Foreign, Commonwealth & Development Office (FCDO) formally notifies the Secretary General of the Council of Europe of the United Kingdom's denunciation of the ECHR under Article 58, initiating the six-month withdrawal period.
4. During the six-month denunciation period, the Ministry of Justice, in consultation with other government departments, identifies and reviews all domestic legislation and administrative practices that currently rely on or refer to the HRA or ECHR, preparing for their cessation.

### M-02 — Equality Act 2010 (v2, 4 actions)

1. Draft a Bill to repeal Section 149 and Schedule 18 of the Equality Act 2010, ensuring that the substantive anti-discrimination provisions of the Act (e.g., direct and indirect discrimination, harassment, victimisation) remain intact.
2. Introduce the Repeal Bill to Parliament, clearly articulating the rationale for repeal as shifting focus back to core service delivery and ministerial accountability, while reaffirming commitment to anti-discrimination principles.
3. Develop and disseminate clear guidance for public bodies, post-repeal, on how to meet their remaining anti-discrimination obligations under the Equality Act 2010 without the 'due regard' duty, emphasising a focus on service outcomes.
4. Review and update internal policies and training within public bodies to reflect the removal of the PSED, re-orienting staff towards service delivery metrics and clear ministerial accountability for outcomes.

### M-03 — The United Kingdom Supreme Court (v1, 4 actions)

1. Draft and introduce a 'Constitutional Scrutiny Bill' establishing a joint committee of both Houses of Parliament with a mandate for mandatory, quinquennial post-legislative review of all constitutional legislation, including the Constitutional Reform Act 2005.
2. Mandate that the new Joint Committee's review specifically assesses the judiciary's interpretation of constitutional statutes against original parliamentary intent, requiring the Supreme Court to provide written submissions and oral testimony on its interpretative methodologies and their evolution.
3. Empower the Joint Committee to recommend to Parliament statutory amendments or resolutions to clarify or reassert parliamentary intent where judicial interpretation is deemed to have departed significantly from it.
4. Establish a formal process for Parliament to consider and vote on the Joint Committee's recommendations within a specified timeframe, ensuring that the scrutiny process leads to concrete parliamentary action or explicit affirmation of the status quo.

### M-04 — The arm's-length body estate (v1, 4 actions)

1. Draft and introduce an 'Arm's-Length Body Accountability Bill' that establishes a unified statutory framework for ministerial oversight and direct accountability of ALB decision-makers, including provisions for removal based on performance or policy divergence.
2. Establish a cross-departmental task force, led by the Cabinet Office, to identify all existing ALBs and categorize them by function and current accountability mechanisms, preparing a schedule for their integration into the new framework.
3. Develop and consult on new departmental guidance for Ministers and senior civil servants, clarifying their enhanced responsibilities for ALB outcomes and the process for exercising powers of intervention and removal under the new legislation.
4. Implement a public information campaign explaining the new accountability framework, its benefits for democratic oversight, and the process for public engagement with ALB decisions, managed by the relevant departmental communications teams.

### M-05 — Judicial review of executive decisions (v1, 4 actions)

1. Draft primary legislation to amend the relevant Act(s) for a specific, high-frequency area of challenge (e.g., immigration decisions), introducing statutory definitions of 'merits' and 'legality' that explicitly delineate the boundaries of judicial review for decisions made under that Act. This legislation should specify that decisions falling within the 'merits' as defined are not subject to judicial review on those grounds.
2. Establish a new, mandatory 'pre-decision review' mechanism within the relevant department's legal advisory function, requiring high-risk ministerial decisions (as defined by criteria set in the new legislation) to undergo an internal legal review specifically assessing compliance with the statutory 'legality' definition before being published. This review's findings would be recorded and made available to potential challengers.
3. Introduce a statutory requirement for a 'statement of reasons' accompanying all ministerial decisions covered by the new legislation, explicitly linking the decision to the statutory 'merits' and 'legality' definitions. This statement would serve as the primary document for any subsequent legal challenge, limiting the scope for discovery into the decision-making process itself.
4. Amend the Civil Procedure Rules (CPR) to introduce a fast-track procedure for challenges to the scope of judicial review under the new legislation, specifically for cases where the claimant argues a decision falls outside the statutory 'merits' definition. This would provide early clarity on jurisdictional questions.

### M-06 — The permanent, appointed civil service (v2, 4 actions)

1. Draft and introduce a Government Bill to repeal Part 1 of the Constitutional Reform and Governance Act 2010 (CRAG 2010) and amend relevant sections of the Civil Service Order in Council 1995, specifically removing the statutory basis for the Civil Service Commission's role in senior appointments and the requirement for appointments to be on merit through fair and open competition.
2. Develop and publish a new Senior Civil Service (SCS) Appointment and Removal Code, replacing the existing Civil Service Commission Recruitment Principles. This code will establish a framework for direct ministerial appointment and removal of SCS roles, outlining the scope of ministerial discretion and any remaining procedural safeguards.
3. Establish departmental Ministerial Appointment Panels for all SCS roles, chaired by the relevant Minister and including other designated political appointees. These panels will be responsible for interviewing candidates and making final recommendations directly to the Minister for approval.
4. Implement a comprehensive training and induction programme for Ministers and their Special Advisers on the new appointment and removal powers, focusing on legal compliance, best practice in selection, and managing potential conflicts of interest.

### M-07 — Operational independence of the Bank of England (v1, 4 actions)

1. Draft a Bill to amend or repeal the relevant sections of the Bank of England Act 1998 that confer operational independence on the Monetary Policy Committee (MPC) for setting interest rates and other monetary policy tools.
2. Introduce the drafted Bill into Parliament, initiating the legislative process for its passage, including securing cross-party support where possible and navigating parliamentary debate and scrutiny.
3. Develop and publish a new framework for monetary policy decision-making, outlining how elected officials (e.g., the Chancellor or a new parliamentary committee) will set policy, including clear objectives, decision-making processes, and accountability mechanisms.
4. Establish new institutional arrangements within HM Treasury or Parliament to support the political decision-making process for monetary policy, including analytical capacity, advisory functions, and reporting structures.

### M-08 — Diversity, equity and inclusion practice in the civil service (v1, 4 actions)

1. The Cabinet Office, in consultation with the Government Legal Department, should issue revised, legally authoritative guidance on the interpretation and application of Section 149 of the Equality Act 2010 for the Civil Service. This guidance must explicitly state that 'due regard' primarily means avoiding unlawful discrimination and promoting genuine equality of opportunity, rather than mandating specific diversity quotas, targets, or extensive proactive DEI initiatives beyond those necessary to meet the core duty.
2. The Civil Service Commission should update its recruitment principles and guidance to align with the narrowed interpretation of the PSED, emphasising merit-based selection and ensuring that DEI considerations do not override the primary duty to appoint on merit. This includes reviewing and revising existing job descriptions, interview processes, and promotion criteria.
3. The Treasury should review and revise funding allocations and performance metrics for Civil Service departments and agencies to ensure they do not incentivise or reward expansive DEI programs that exceed the narrowed interpretation of the PSED. Funding should be directed towards core anti-discrimination training and processes.
4. The Public Administration and Constitutional Affairs Committee (PACAC) should conduct regular reviews of Civil Service compliance with the revised PSED guidance, scrutinising recruitment outcomes, promotion data, and internal conduct policies to ensure adherence to the merit principle and the focused interpretation of equality duties.

### M-09 — Gender self-identification (v1, 4 actions)

1. Draft an amendment to the Equality Act 2010 to define 'sex' explicitly as biological sex at birth, and to clarify that single-sex provisions are based on this definition, subject to specific, tightly defined exceptions for holders of Gender Recognition Certificates where appropriate and explicitly stated.
2. Introduce the drafted amendment as a Bill or as part of a wider legislative vehicle to Parliament for debate and enactment.
3. Upon enactment, the Equality and Human Rights Commission (EHRC) should issue updated statutory guidance on the Equality Act 2010, reflecting the new statutory definition of 'sex' and its implications for single-sex services and spaces.
4. All government departments and public bodies must review and update their internal policies, guidance, and training materials to align with the amended Equality Act 2010 and the EHRC's updated statutory guidance.

### M-10 — Publicly funded charities campaigning on government policy (v1, 4 actions)

1. Develop a template for explicit grant conditions, stipulating that public funds (defined as funds originating from a government department, agency, or local authority) cannot be used for campaigning activities that directly oppose the stated policies of the funding body. This template should include clear definitions of 'campaigning activities' and 'directly oppose'.
2. Mandate the adoption of these template grant conditions by all government departments, agencies, and local authorities when distributing public funds to third-sector organizations. This mandate should be communicated through a Treasury or Cabinet Office circular.
3. Establish a clear, accessible reporting mechanism for funding bodies to flag potential breaches of these grant conditions, and a process for investigation and enforcement, including clawback provisions for misused funds.
4. Provide training and guidance to public sector grant managers on how to interpret, apply, and enforce the new grant conditions, ensuring consistent application across different funding bodies.

### M-11 — The Sentencing Council and sentencing guidelines (v1, 3 actions)

1. Draft and introduce a Bill to amend the Coroners and Justice Act 2009, specifically sections 120-125, to require that any sentencing guideline issued by the Sentencing Council must be approved by the Lord Chancellor and the Lady Chief Justice before coming into effect.
2. Establish a formal, time-bound consultation process within the MoJ for the Lord Chancellor to review proposed guidelines, including mechanisms for parliamentary committees (e.g., Justice Committee) to provide input directly to the Lord Chancellor.
3. Develop clear criteria and a public statement of reasons for the Lord Chancellor's approval or rejection of guidelines, ensuring transparency and accountability in the new approval process.

### M-12 — The Great Repeal: the programme as a single instrument (v1, 4 actions)

1. Identify all primary legislation enacted between 1997 and 2010 that significantly altered the UK's constitutional arrangements, cross-referencing with the proposer's understanding of the target date range and any explicit statutory protections (e.g., for the Human Rights Act 1998).
2. Draft a single 'Constitutional Reform Act' that explicitly repeals, amends, or re-enacts with modifications, all identified legislation and relevant statutory provisions. The drafting must be 'legally watertight' to withstand anticipated legal challenges, as highlighted by the proposer and Lord Wolfson KC's advice regarding a 'factory reset'.
3. Develop a comprehensive parliamentary strategy for the passage of the 'Constitutional Reform Act', anticipating significant opposition and leveraging the government's mandate for comprehensive reform. This includes preparing detailed explanatory notes and impact assessments.
4. Establish a dedicated implementation task force immediately following the Act's passage to manage the transition and address any unforeseen legal or administrative complexities arising from the comprehensive repeal, ensuring a coordinated unwinding of the previous framework.
