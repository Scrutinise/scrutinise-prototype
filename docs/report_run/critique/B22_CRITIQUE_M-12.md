# M-12 — The Great Repeal: the programme as a single instrument

*The critique, per measure. Exported 2026-09-10 11:32 UTC.*

- idea `6aa6d116-853a-4f11-b510-94408e40176e`
- build `5183ac14-781a-4354-83d8-5f9a9b34224e` — **v1 DONE**, 2026-09-02 16:17 UTC · 32.48p

> **No model wrote anything to the database to produce this file, and no build was run.**
> `KERNEL_CHECK`, `LOGIC_CHECK` and `ADVERSARIAL` were re-run against the current kernel;
> `SMART` is carried from the build because re-running it rewrites the kernel.

## The headline, before anything else

| | |
|---|---|
| KERNEL_CHECK | 9 of 9 on all 2 readings |
| LOGIC_CHECK | holds on all 2 readings |
| Kernel the marker read | complete kernel, 3446 prompt tokens |

## Was the kernel complete when the build marked it?

`kernelText()` read the empty canonical `Idea` columns until 9 September, so a build marked
before that fix was handed a title and two lists. The prompt SIZE is the discriminator, and
it is a measurement rather than a date comparison.

| build | when | KERNEL_CHECK tokens in | what it read | score |
|---|---|---|---|---|
| v1 DONE | 2026-09-02 16:17 | 1933 | STARVED kernel | 1 of 9 kernel tests passed; 8 failed and are on your list |
| **this export** | **just now** | **3446** | **complete kernel** | 9 of 9 on all 2 readings |

## KERNEL_CHECK — 2 readings of the same kernel

| reading | prompt tokens | score | failing criteria |
|---|---|---|---|
| 1 | 3446 | **9 of 9** | — |
| 2 | 3446 | **9 of 9** | — |

*Every criterion passed on every reading.*

## LOGIC_CHECK — 2 readings

| reading | verdict | defects |
|---|---|---|
| 1 | the chain holds | 0 |
| 2 | the chain holds | 0 |

**Reading 1** — read as: *The problem is that constitutional reforms from 1997-2010 are interlocked, making a piecemeal reversal politically unviable. The root cause is that these reforms were enacted as distinct but interconnected laws, creating a pivotal obstacle: this new constitutional order cannot be dismantled by a simple, uniform repeal because its components have different foundations (domestic statute, devolved powers, international treaty) and will resist through different means. A single legislative instrument treating them all the same would be defeated. The guiding policy directly counters this by proposing a single, omnibus Act that is internally differentiated, with specific legal mechanisms tailored to dismantle each distinct component. The actions and plan then coherently execute this policy by first categorizing the laws by their foundation, then drafting a multi-part bill with tailored repeal mechanisms for each category, and finally using a parliamentary strategy to pass the entire package at once while pre-empting the anticipated legal and diplomatic challenges.*


**Reading 2** — read as: *The problem is that constitutional reforms from 1997-2010 are too interlocked to be reversed piecemeal. The diagnosis refines this, stating these reforms have created a new, self-defending order resting on different foundations: domestic statutes, devolved powers, and international treaties. This leads to the pivotal obstacle: a single, uniform repeal will be defeated by the most resistant component, such as the international treaty obligations of the Belfast/Good Friday Agreement. The guiding policy directly addresses this by proposing a single omnibus Act that is internally differentiated, with specific legal mechanisms tailored to dismantle each type of foundation. The actions and plan then execute this policy by categorizing the laws based on their foundation, drafting a bill with separate parts for each category, and using a parliamentary strategy to pass the entire package at once while preparing for the resulting legal and diplomatic challenges.*


## ADVERSARIAL — re-run, read-only

Model `gemini-2.5-pro` · 11239 in / 1651 out.

⚠ The prompt is the build's own: the SMART critique and the verification carry are read off
the stored pass log rather than re-derived, and the cost lines and the proposer's testimony
come through the same functions the pass uses.

**1.** The proposal defines its scope as constitutional legislation passed between 1997 and 2010, but provides no schedule of the specific Acts of Parliament it intends to repeal. Without this list, the scale of the drafting and legislative task is entirely unquantified.

**2.** The plan's mechanism for repealing legislation linked to international treaties, such as the Human Rights Act's role in the Belfast/Good Friday Agreement, is to make repeal contingent on a successful renegotiation. It offers no mechanism or alternative path if the other state parties refuse to renegotiate the treaty.

**3.** The plan assumes the complete compliance of the Civil Service, Parliamentary Counsel, and government legal departments in drafting and implementing what amounts to a political revolution. It does not account for institutional resistance from the permanent government, which was itself shaped by the reforms being repealed.

**4.** The proposal is silent on what replaces the current settlement. It details a comprehensive plan for repeal but provides no corresponding detail on the constitutional arrangements that would exist on the day after the Act takes effect, creating a vacuum that opponents will define as chaos.

**5.** The proposal relies on ouster clauses to limit judicial review, but it does not specify what happens if the Supreme Court finds these clauses ineffective or rules against the Act on fundamental constitutional principles. There is no 'plan B' for judicial defiance.

**6.** The cost of this proposal is unquantified. It omits the cost of the immense legal and administrative resources required for drafting, the parliamentary time for what would be a multi-year fight, and the potential economic and diplomatic costs of the resulting constitutional crises.

**7.** The term 'factory reset' is used to describe the objective, but this is not defined. Does it mean a return to the constitutional arrangements of 1 May 1997, and does that include the body of case law and convention that existed at that specific moment?

## SMART — carried from the build, not re-run

⚠⚠ **This pass rewrites the kernel.** `smartPass` calls `setProposal` on up to five fields,
and since the B18 fix those rewrites reach every marker that follows it. Re-running it here
would change the measure while the report is being written from it, so it is not re-run.

**DONE** — 2 models answered your own words (gemini-2.5-pro, claude-sonnet-5); 9 terms of art named — 8 confirmed by the corpus, 1 unverified; 4 of their points already covered, 6 not; verdict WEAK; 5 fields rewritten; read by gemini-2.5-pro

⚠ Produced by the build above, on a **STARVED kernel** (its own prompt: 1464 tokens).

<details><summary>The critique in full</summary>

```
VERDICT ON THE KERNEL: WEAK — The kernel correctly identifies the proposer's core idea—a single, comprehensive repeal act—but fails to construct a credible strategy around it. The diagnosis is superficial, missing the profound legal and political complexities (devolution, international treaties, established case law) that the research and the proposer's own evidence (Lord Wolfson's advice) highlight. It lacks an explicit guiding policy, and the actions are a generic to-do list, not a set of coordinated steps designed to overcome the specific, multi-faceted obstacles. It fails to face the problem in its true difficulty.

RUMELT TESTS IT FAILS:
- failure to face the problem: The diagnosis and actions treat the repeal as a straightforward, if large, legislative drafting exercise. They ignore the distinct and severe challenges posed by the devolution settlements (which are politically and legally distinct from ordinary statutes) and the Belfast/Good-Friday Agreement (an international treaty). The proposer's own evidence from Lord Wolfson KC warns that a simple repeal is insufficient, but the kernel does not incorporate this critical warning into its design.
- the guiding policy is missing: The kernel has no section for the guiding policy. It jumps from a list of causes to a list of actions, omitting the crucial step of defining the overall approach to overcoming the pivotal obstacle. Without a guiding policy, the actions are just a list, not a strategy.
- the actions are not coordinated: The actions are a simple, sequential list of steps (identify, draft, pass, implement). They are not designed as a set of mutually reinforcing measures that concentrate effort. For example, it does not explain how the 'parliamentary strategy' is designed to protect the 'legally watertight' drafting from being amended into incoherence, or how the drafting will pre-empt the specific legal challenges arising from devolution.
- fluff: The kernel uses abstract, unspecific language where concrete choices are needed. This phrase sounds purposeful but offers no actual guidance on the difficult choices required to pass such a controversial bill.

WHAT THE CRITIQUE REWROTE:
- summaryDiagnosis: The original diagnosis was too shallow and failed to face the full problem. The rewrite makes the diagnosis sharper and more accurate by acknowledging the multiple, distinct layers of entrenchment (legal, political, judicial, international), which is the true nature of the 'Gordian knot'.
- pivotalObstacle: This change moves from a general description of complexity to a specific, actionable diagnosis of *why* it is complex. It clarifies that the strategy must be tailored to the different types of resistance, not just be a bigger hammer.
- summaryGuidingPolicy: A strategy kernel requires a guiding policy. This new policy provides the crucial bridge between the diagnosis (a multi-faceted problem) and the actions (a multi-part solution), giving the actions a coherent logic. It resolves the tension between the proposer's political need for 'one Act' and the legal need for multiple, tailored approaches.
- summaryCoherentActions: Good strategy requires coherent, focused action. The rewrite replaces vague goals ('develop a strategy') with concrete steps ('secure a programme motion') and ensures each action is designed to solve a specific part of the diagnosed problem, making the entire plan more credible and less like a wish list.

TERMS OF ART THE CORPUS CONFIRMED: Constitutional Reform Act 2005, Human Rights Act 1998, Ouster Clause, Parliamentary Sovereignty, Rule of Law, Scotland Act 1998, Sewel Convention, Supreme Court

NAMED BUT UNVERIFIED (never assert these): R (Miller) v Secretary of State for Exiting the European Union (Miller I)

POINTS OTHER MODELS MADE THAT WE DO NOT ADDRESS:
- The principal obstacle is not the statutes themselves, but the political, judicial, and administrative reality that has been constructed on them over a quarter of a century.
- Such an Act would represent a direct and unprecedented confrontation between the principles of Parliamentary Sovereignty and the Rule of Law as currently interpreted by the judiciary.
- The success of this strategy hinges on Parliament's ability to draft ouster clauses that the courts, particularly the Supreme Court, would be unwilling or unable to strike down or interpret away.
- The proposal necessitates explicitly overriding the Sewel Convention, guaranteeing a constitutional crisis with the devolved nations, particularly Scotland.
- The 'legally watertight' standard sought by the proposer is likely impossible to achieve; it is a political goal, not a legal reality, as any Act can be challenged in court.
- The core of this proposal is not a legal adjustment but a political revolution intended to reset the UK's uncodified constitution to a prior state by an act of supreme legislative will.

HOW HARD TO PASS: Extremely difficult. This would be one of the most contentious pieces of legislation in modern British history, far exceeding the political difficulty of the Brexit legislation. It would face ferocious, unified opposition in Parliament, from the judiciary, from all devolved administrations, and from civil society. It is most likely to die at the Second Reading in the House of Lords, if it even makes it out of the Commons, where it would likely require the Parliament Acts to overcome the Lords' opposition.

MOST LIKELY TO GO WRONG: The single thing most likely to go wrong is that the government will discover that it cannot unilaterally legislate its way out of the Belfast/Good Friday Agreement. The attempt to do so will provoke an immediate international crisis with Ireland and the US, which will force a humiliating retreat on the entire legislative programme long before the domestic obstacles are even fully engaged.
```

</details>

## The nine kernel tests, as the marker has them

- `PROBLEM_IS_A_PROBLEM` — The problem is stated as a problem, not as a solution
- `OBSTACLE_DISTINCT` — The pivotal obstacle is distinct from the root cause
- `DIAGNOSIS_SIMPLIFIES` — The diagnosis simplifies rather than inventories
- `POLICY_RULES_OUT` — The guiding policy rules things out
- `POLICY_NOT_A_GOAL` — The guiding policy is an approach, not a goal
- `HAS_LEVERAGE` — The approach has leverage on the named obstacle
- `ACTIONS_DEFEAT_CAUSES` — The actions defeat the diagnosed causes
- `ACTIONS_COHERE` — The actions cohere with each other
- `NO_BAD_STRATEGY_SMELL` — No bad-strategy smell

## The kernel that was marked

⚠ Read live at export time. 9572 characters.

```
⚠ 10 of the fields below were drafted by this build and are awaiting the proposer's confirmation. Mark the WORDING, which is the kernel as it currently stands. Do not mark a field down for being unconfirmed.

TITLE: Reversing 1997-2010 Constitutional Reforms via a Single Act

THE PROBLEM: The interlocking nature of constitutional changes enacted between 1997 and 2010 prevents effective reversal through piecemeal legislation, risking failure to achieve comprehensive reform due to time and political capital constraints.

WHO IS AFFECTED: The cost of attempting sequential reforms that are ultimately defeated or incomplete, including legislative drafting, parliamentary time, and political capital, is not established but would be substantial. The opportunity cost of not achieving desired constitutional reform is also significant. · Ineffective governance, continued operation of constitutional arrangements deemed problematic, and a perception of governmental incapacity to enact fundamental change. · The proposer reports that a measure-by-measure approach will be defeated. Lord Wolfson KC's advice (as reported by the proposer) corroborates the complexity of rolling back case law and legislative provisions, implying a high cost for a piecemeal approach. The *Miller* cases establish the need for primary legislation, further underscoring the resource intensity of any reform. · The UK government and Parliament, and by extension, the public whose governance framework is shaped by these reforms.

CAUSES:
- (MATERIAL) Constitutional reforms between 1997 and 2010 were enacted as distinct, yet interconnected, pieces of primary legislation.
- (MATERIAL) Key constitutional acts, such as the Human Rights Act 1998, contain explicit protections or are considered to have particular constitutional importance, making their amendment or repeal complex.
- (CONTRIBUTORY) The legal and political system has historically lacked a coherent process or consensus for comprehensive constitutional change, making a 'factory reset' appear daunting.

ROOT CAUSE: Constitutional reforms between 1997 and 2010 were enacted as distinct, yet interconnected, pieces of primary legislation.

PIVOTAL OBSTACLE: The pivotal obstacle is that this new order cannot be dismantled by a simple, uniform repeal. Its components rest on different foundations (domestic statute, devolved powers, international treaty) and will resist through different means (judicial review, political crisis, diplomatic breach). A single legislative instrument that treats all components as equivalent will be defeated by the strongest component it fails to properly address—likely the international treaty obligations of the Belfast/Good Friday Agreement.

THE DIAGNOSIS: The constitutional reforms of 1997-2010 are not merely an interlocked set of statutes but have created a new, self-defending constitutional order. This order is entrenched through a vast body of case law, new political conventions (e.g., the Sewel Convention), and international treaty obligations (the Belfast/Good Friday Agreement), which reproduce the effects of the reforms even if the parent Acts are repealed. As Lord Wolfson KC's advice, cited by the proposer, indicates, a simple repeal would not achieve a 'factory reset'.

THE LEGAL LANDSCAPE AS STATED: The current legal framework includes the Human Rights Act 1998, which incorporates the European Convention on Human Rights into UK law [primary-acts-pre-2000:ukpga/1998/42:schedule-1-paragraph-4]. The Constitutional Reform Act 2005 also made significant changes, including establishing the Supreme Court and amending the HRA to reflect this [primary-acts-2000plus:ukpga/2005/4:schedule-9-paragraph-66]. Other key legislation from the 1997-2010 period includes devolution acts, the Freedom of Information Act 2000, and various reforms to the House of Lords and the Civil Service [pwdata-lords:daylord2009-07-06a:239, pwdata-wms:ministerial2009-07-20d:19]. The principle of parliamentary sovereignty means that Parliament can, in theory, repeal or amend any previous legislation. However, the *Miller* cases confirm that this must be done through primary legislation, not executive prerogative [tna-caselaw:[2017] UKSC 5:1]. · The current framework, as described by the proposer, fails due to the interlocking nature of the constitutional changes made between 1997 and 2010. Attempting to undo these reforms piecemeal would leave residual elements in place that could perpetuate the original problems. The specific protection of the Human Rights Act from certain legislative orders [primary-acts-2000plus:ukpga/2006/51:section-8] highlights how individual reforms can be entrenched, making a comprehensive 'factory reset' difficult without a targeted, overarching legislative approach. Lord Wolfson's advice, as reported by the user, corroborates this, indicating that a simple repeal of the HRA would not be sufficient and a complex legislative program is required to roll back case law and provisions, which is precisely the problem a single, watertight Act aims to solve. The failure lies in the current legislative landscape's resistance to incremental unwinding, necessitating a more decisive and consolidated legal intervention.

THE APPROACH: Enact a single, comprehensive 'Constitutional Reform Act' that explicitly repeals or amends all targeted legislation from 1997-2010, leveraging parliamentary sovereignty while acknowledging the need to address devolved consent for specific acts.

THE GUIDING POLICY: The approach is to use a single, omnibus Act of Parliament as a political and procedural vehicle to ensure the programme is passed 'at once', preventing death by a thousand cuts. However, the Act itself must be internally differentiated, with specific legal mechanisms tailored to dismantle each distinct component of the 1997-2010 settlement—domestic statutes, devolved powers, international treaty obligations, and derivative case law. This asserts Parliamentary sovereignty while acknowledging and navigating, rather than ignoring, the different sources of legal and political resistance.

ACTIONS:
- Identify all primary legislation enacted between 1997 and 2010 that significantly altered the UK's constitutional arrangements, cross-referencing with the proposer's understanding of the target date range and any explicit statutory protections (e.g., for the Human Rights Act 1998). — Cabinet Office Legal Advisers, working with an independent panel of constitutional law experts.
- Draft a single 'Constitutional Reform Act' that explicitly repeals, amends, or re-enacts with modifications, all identified legislation and relevant statutory provisions. The drafting must be 'legally watertight' to withstand anticipated legal challenges, as highlighted by the proposer and Lord Wolfson KC's advice regarding a 'factory reset'. — Office of the Parliamentary Counsel, under direct instruction from the Attorney General's Office, with external constitutional law counsel review.
- Develop a comprehensive parliamentary strategy for the passage of the 'Constitutional Reform Act', anticipating significant opposition and leveraging the government's mandate for comprehensive reform. This includes preparing detailed explanatory notes and impact assessments. — Leader of the House of Commons, Chief Whip, and the relevant policy department (e.g., Ministry of Justice or Cabinet Office).
- Establish a dedicated implementation task force immediately following the Act's passage to manage the transition and address any unforeseen legal or administrative complexities arising from the comprehensive repeal, ensuring a coordinated unwinding of the previous framework. — Cabinet Office, reporting directly to the Prime Minister, with representatives from all affected government departments and devolved administrations.

THE PLAN: 1. **Scope and Categorise:** The Attorney General's Office will produce a binding schedule of all statutory provisions for repeal, categorised by their legal foundation: (a) purely domestic UK statutes (e.g., parts of CRA 2005, FOIA), (b) statutes engaging devolved competence (e.g., Scotland Act 1998), and (c) statutes giving effect to international treaties (HRA as it relates to the Belfast/Good Friday Agreement). 2. **Draft Differentiated Bill:** Parliamentary Counsel will draft a single omnibus Bill with separate parts corresponding to the categories above. Part (a) will use straightforward repeal clauses. Part (b) will include express provisions overriding the Sewel Convention. Part (c) will authorise and direct the Executive to begin the necessary treaty processes (e.g., renegotiation of the Belfast Agreement) and make repeal of the domestic statute contingent on that process. The Bill will include strong ouster clauses to limit judicial review of its provisions. 3. **Execute 'Single Vote' Parliamentary Strategy:** The Leader of the House will secure a programme motion to pass the entire omnibus Bill under an expedited timetable with a single second reading vote, ensuring the package cannot be broken up and defeated piecemeal, thus addressing the proposer's core concern about losing political capital over time. 4. **Pre-empt Legal and Diplomatic Challenges:** The Attorney General will prepare for specific, anticipated legal challenges, particularly regarding devolved powers and ouster clauses. Simultaneously, the Foreign Office will open a formal diplomatic track with the Republic of Ireland concerning the Belfast/Good Friday Agreement, as this cannot be resolved by domestic legislation alone.
```
