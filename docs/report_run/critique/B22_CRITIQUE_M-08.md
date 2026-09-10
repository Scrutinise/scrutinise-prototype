# M-08 — Diversity, equity and inclusion practice in the civil service

*The critique, per measure. Exported 2026-09-10 11:25 UTC.*

- idea `f73f3928-1eac-47b2-8ecc-9248f37e1504`
- build `991df3f6-4349-4707-bdf5-d915ced2c5cb` — **v1 DONE**, 2026-09-02 15:34 UTC · 31.67p

> **No model wrote anything to the database to produce this file, and no build was run.**
> `KERNEL_CHECK`, `LOGIC_CHECK` and `ADVERSARIAL` were re-run against the current kernel;
> `SMART` is carried from the build because re-running it rewrites the kernel.

## The headline, before anything else

| | |
|---|---|
| KERNEL_CHECK | 9 of 9 on all 2 readings |
| LOGIC_CHECK | holds on all 2 readings |
| Kernel the marker read | complete kernel, 3151 prompt tokens |

## Was the kernel complete when the build marked it?

`kernelText()` read the empty canonical `Idea` columns until 9 September, so a build marked
before that fix was handed a title and two lists. The prompt SIZE is the discriminator, and
it is a measurement rather than a date comparison.

| build | when | KERNEL_CHECK tokens in | what it read | score |
|---|---|---|---|---|
| v1 DONE | 2026-09-02 15:34 | 1930 | STARVED kernel | 2 of 9 kernel tests passed; 7 failed and are on your list |
| **this export** | **just now** | **3151** | **complete kernel** | 9 of 9 on all 2 readings |

## KERNEL_CHECK — 2 readings of the same kernel

| reading | prompt tokens | score | failing criteria |
|---|---|---|---|
| 1 | 3151 | **9 of 9** | — |
| 2 | 3151 | **9 of 9** | — |

*Every criterion passed on every reading.*

## LOGIC_CHECK — 2 readings

| reading | verdict | defects |
|---|---|---|
| 1 | the chain holds | 0 |
| 2 | the chain holds | 0 |

**Reading 1** — read as: *The argument is that the Public Sector Equality Duty (PSED), a statutory requirement, has been interpreted expansively by the Civil Service, creating an internal culture that rewards DEI initiatives. This has led to practices that lack specific democratic authorization and may undermine merit-based principles. The pivotal obstacle is the institutional inertia and cultural capture that benefits from this expansive interpretation, which is presented as a legal necessity. The proposed approach is to break this inertia by having the central government issue new, legally authoritative guidance that narrows the interpretation of the PSED to its core anti-discrimination function. This will be executed by the Cabinet Office issuing the guidance, the Civil Service Commission updating recruitment rules, the Treasury removing financial incentives for the broader DEI programs, and a parliamentary committee providing oversight.*


**Reading 2** — read as: *The argument is that the vague 'due regard' requirement of the Public Sector Equality Duty (PSED) has been interpreted expansively by the Civil Service. This has fostered an internal culture that rewards DEI initiatives, creating institutional inertia that shields these discretionary policies from political challenge by framing them as legal necessities. The proposed approach is to break this inertia by having the central government issue new, legally authoritative guidance that narrows the interpretation of the PSED to its core anti-discrimination function. This will be executed by the Cabinet Office issuing the guidance, the Civil Service Commission updating recruitment principles, the Treasury removing financial incentives for the broader DEI programs, and a parliamentary committee providing ongoing oversight.*


## ADVERSARIAL — re-run, read-only

Model `gemini-2.5-pro` · 16147 in / 2882 out.

⚠ The prompt is the build's own: the SMART critique and the verification carry are read off
the stored pass log rather than re-derived, and the cost lines and the proposer's testimony
come through the same functions the pass uses.

**1.** The central action is to issue 'legally authoritative guidance' to narrow the interpretation of the Public Sector Equality Duty. The meaning of 'due regard' in this duty has been established by over a decade of case law. The proposal does not state the legal basis on which executive guidance can override judicial interpretation of primary legislation, making the entire strategy vulnerable to being struck down at the first judicial review.

**2.** The proposal aims to refocus the PSED onto 'avoiding unlawful discrimination', effectively ignoring the statutory limbs concerning 'advancing equality of opportunity' and 'fostering good relations'. How can guidance legally redefine a three-part statutory duty into a one-part duty? Furthermore, the proposal hinges on upholding 'merit', but provides no operational definition of the term that is itself robust against legal challenge.

**3.** The proposal's premise is that DEI practices have undermined merit-based selection. This is presented as a perception or risk, with no specific evidence of less meritorious candidates being appointed, or of standards for promotion being lowered. What is the evidence of the harm that the proposal seeks to remedy?

**4.** Enforcement relies on PACAC scrutiny and Treasury revision of funding metrics. What specific sanctions can PACAC apply if a department fails to comply? Similarly, how does the Treasury's plan to stop incentivising expansive DEI translate into a concrete penalty for a department that continues with its existing strategy? The mechanism appears to lack teeth.

**5.** The Equality and Human Rights Commission is the statutory body for enforcing the Equality Act. The proposal makes no mention of the EHRC's likely view of guidance that seeks to narrow a duty it is mandated to uphold. What is the plan if the EHRC determines that departments following the new guidance are in fact failing to comply with the law?

**6.** Finding 39 shows the Civil Service's strategy is to deliberately 'go further than the current Equality Act provisions'. This suggests the problem is a conscious policy choice, not a misinterpretation of legal duty. If so, why is the proposed solution a legalistic re-interpretation of the PSED, rather than a direct ministerial instruction to rescind the current Civil Service Diversity and Inclusion Strategy?

## SMART — carried from the build, not re-run

⚠⚠ **This pass rewrites the kernel.** `smartPass` calls `setProposal` on up to five fields,
and since the B18 fix those rewrites reach every marker that follows it. Re-running it here
would change the measure while the report is being written from it, so it is not re-run.

**DONE** — 2 models answered your own words (gemini-2.5-pro, claude-sonnet-5); 10 terms of art named — 10 confirmed by the corpus, 0 unverified; 28 cited findings from them; 9 of their points already covered, 8 not; verdict WEAK; 5 fields rewritten; read by gemini-2.5-pro

⚠ Produced by the build above, on a **STARVED kernel** (its own prompt: 1278 tokens).

<details><summary>The critique in full</summary>

```
VERDICT ON THE KERNEL: WEAK — The kernel contains the necessary components, but they are not assembled into a coherent strategy. The diagnosis is presented as a list of causes rather than a simplifying judgment, and the guiding policy is entirely absent, leaving a list of actions without a stated approach connecting them to the diagnosis. The actions themselves are coherent, but without the framing of a diagnosis and policy, they are just a to-do list.

RUMELT TESTS IT FAILS:
- A diagnosis is a simplification, not an inventory: The 'CAUSES' section lists three distinct 'MATERIAL' causes. This is an inventory of problems rather than a single, simplifying judgment about the nature of the challenge.
- The guiding policy is an approach, not a list of actions: The kernel provides no guiding policy at all. It jumps from a list of causes to a list of actions, leaving the reader to guess the overall approach.

WHAT THE CRITIQUE REWROTE:
- summaryDiagnosis: A diagnosis must be a simplification that explains what is going on, not an inventory of contributing factors. The rewrite provides a single, coherent judgment that connects the root cause to the pivotal obstacle, fulfilling the primary function of a diagnosis.
- pivotalObstacle: The original was good but slightly verbose. The rewrite is sharper and introduces the concept of 'cultural capture' and the 'laundering' of policy as legal necessity, which gets closer to the core of the problem identified in the proposer's account and the better external models.
- summaryGuidingPolicy: A strategy kernel must have a guiding policy. This new text provides one, creating the crucial link between the diagnosis (the problem is interpretation and inertia) and the coherent actions (which use central levers to change that interpretation).
- whatItRulesOut: A guiding policy is a choice, and stating what is ruled out makes that choice explicit. This clarifies the strategic commitment to an administrative, rather than legislative, solution.
- summaryCoherentActions: This summarises the list of actions into a coherent whole, demonstrating that they are not just a list but a coordinated set of steps designed to implement the guiding policy.

TERMS OF ART THE CORPUS CONFIRMED: Accounting Officer, Cabinet Office, Carltona principle, Civil Service Commission, Civil Service Management Code, Constitutional Reform and Governance Act 2010, Equality Act 2010, Managing Public Money, Public Sector Equality Duty (PSED), Stonewall Workplace Equality Index

POINTS OTHER MODELS MADE THAT WE DO NOT ADDRESS:
- External benchmarking schemes create pressure for conformity and reduce the accountability of individual departments for their own policies.
- Restricting funding for external DEI consultants is a key lever for changing departmental behaviour.
- <item>The proposer's complaint about "absence of an authorising decision" is correct in substance but misattributes the source: section 149 was authorised by Parliament, and on the Institute for Government's reading it does not itself mandate the contested practices, so the unauthorised element is the departmental and HR interpretation layered on top of it.</item>
- <item>Repealing or narrowing section 149 would satisfy the proposer's literal demand while leaving the Civil Service Commission's recruitment rules, departmental D&I strategies and internal training guidance fully in place, because those are not derived from the statute in the way the practice claims.</item>
- <item>The absence of accountability the proposer identifies is real but located in the wrong place if the target is s.149: it lies in the fact that no single named office currently has to sign off "we are doing X because the law requires it" versus "we are doing X as a policy choice," which lets both be defended interchangeably.</item>
- <item>Ending "the DEI agenda" as a single act is not achievable because there is no single instrument called that; it is dozens of departmental policies, Civil Service Commission rules and guidance documents, each requiring separate action by a different accountable body.</item>
- <item>Constraints on what officials may say are better tested against the existing Civil Service Code and the Osmotherly convention on ministerial-official accountability than against equality law, since that is the instrument Parliament already recognises as governing official conduct and speech.</item>
- <item>The proposer, as a self-described political non-specialist, is right to distrust the assumption that "the law made us do it," and the corrective is transparency about which parts are law and which are discretionary choice — not necessarily reversal of either.</item>

HOW HARD TO PASS: Moderately hard. The proposed actions do not require new primary legislation, which is a major advantage. They rely on the executive using its existing powers through the Cabinet Office and Treasury. However, it will face significant internal resistance from within the Civil Service, including from staff networks, HR departments, and unions who benefit from or believe in the current system. The most likely stage for it to die is in implementation, where passive resistance, 'malicious compliance', and legal challenges to the new guidance could dilute or stall the changes until political attention moves elsewhere.

MOST LIKELY TO GO WRONG: The new guidance will be interpreted by departments in a minimalist way that satisfies the letter of the new rules while changing nothing of substance in their recruitment and management practices. Without relentless, detailed oversight from the centre—which is difficult to maintain—the 'institutional inertia' identified in the diagnosis will simply absorb the reform and carry on as before.
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

⚠ Read live at export time. 8607 characters.

```
⚠ 10 of the fields below were drafted by this build and are awaiting the proposer's confirmation. Mark the WORDING, which is the kernel as it currently stands. Do not mark a field down for being unconfirmed.

TITLE: Reining in Civil Service Diversity, Equity, and Inclusion (DEI) Practices

THE PROBLEM: Civil Service recruitment, promotion, and conduct practices are shaped by a Diversity, Equity, and Inclusion (DEI) agenda, adopted without explicit parliamentary or electoral authorisation, leading to concerns about its legitimacy and impact on merit-based selection.

WHO IS AFFECTED: The annual cost to the public purse for promoting DEI policies within the Civil Service is established to be substantial, with specific expenditure reviews published by the Cabinet Office. (See Cabinet Office — Civil Service: Equality, 2025-06-09 [pwdata-wrans:answers2025-06-09:1180]). Specific figures for the total cost are available in the cited documents. · Applicants may perceive unfairness in recruitment processes if merit is perceived to be secondary to diversity targets. Current civil servants may feel pressured to conform to specific DEI narratives or face limitations in career progression. The public may lose trust in the impartiality and effectiveness of the civil service if its hiring practices are seen as politically driven rather than meritocratic. The proposer reports a concern about the absence of an authorising decision for these practices. · The Cabinet Office has published 'Civil Service Equality, Diversity and Inclusion Expenditure Review' and 'Civil Service 2024/2025 External Expenditure on Equality, Diversity and Inclusion' (Cabinet Office — Civil Service: Equality, 2025-06-09 [pwdata-wrans:answers2025-06-09:1180]). The Civil Service Commission's annual reports acknowledge the statutory requirement for diversity alongside merit-based selection (Civil Service Commission annual report and accounts 2017-18, 2018-07-27 [quangos-govuk:government/publications/civil-service-commission-annual-report-and-accounts-2017-to-2018:2]). · Civil Service applicants (both internal and external), current civil servants, and the wider public.

CAUSES:
- (MATERIAL) The Civil Service has adopted an expansive interpretation and application of the PSED, aiming to be the 'UK’s most inclusive employer' and implementing specific DEI strategies and roles.
- (MATERIAL) An internal culture within the Civil Service rewards visible commitment to DEI, creating an environment where these practices are expanded without explicit parliamentary or electoral authorisation.
- (MATERIAL) The statutory Public Sector Equality Duty (PSED) under Section 149 of the Equality Act 2010 mandates public authorities to 'have due regard' to eliminating discrimination, advancing equality of opportunity, and fostering good relations.

ROOT CAUSE: The Public Sector Equality Duty (PSED) in Section 149 of the Equality Act 2010 mandates public authorities to 'have due regard' to eliminating discrimination, advancing equality of opportunity, and fostering good relations.

PIVOTAL OBSTACLE: The pivotal obstacle is the institutional inertia and cultural capture that benefits from the current expansive interpretation of the Public Sector Equality Duty. This self-reinforcing system lacks effective oversight, allowing discretionary HR policy to be presented as a legal necessity, thereby shielding it from political challenge.

THE DIAGNOSIS: A body of DEI practice governing civil service recruitment and conduct has been created without specific democratic authorisation. This practice is justified by an expansive interpretation of the vague 'due regard' duty in the Public Sector Equality Duty (PSED). While the PSED is the root cause, the problem persists because this interpretation has created an internal culture with institutional inertia, where officials and HR departments benefit from a system that rewards visible compliance.

THE LEGAL LANDSCAPE AS STATED: The current legal framework is primarily the Equality Act 2010, specifically Section 149, which establishes the Public Sector Equality Duty (PSED). This duty requires public authorities to have 'due regard' to the need to eliminate discrimination, advance equality of opportunity, and foster good relations. The Equality Act 2006 also grants the Equality and Human Rights Commission powers to assess compliance and issue compliance notices regarding this duty. The Civil Service Commission's Recruitment Principles, while emphasizing selection on merit, operate within the context of this statutory duty. Case law, such as *National Council for Civil Liberties v Equality and Human Rights Commission* and *R (on the application of Marouf) v Secretary of State for the Home Department*, clarifies that 'due regard' means a substantive and rigorous consideration of the equality aims, not merely a procedural formality, and that this duty is continuous. · The current framework, as interpreted and applied by the Civil Service, appears to be failing in the user's view because the 'due regard' requirement of Section 149 of the Equality Act 2010 has led to a body of practice (the diversity, equity, and inclusion agenda) that the user believes goes beyond the original intent and lacks proper democratic authorization. The user's account suggests that while the PSED itself is a statutory duty, the specific implementation in recruitment, promotion, and conduct within the Civil Service has evolved into practices that are perceived as unscrutinised and potentially overreaching. The core failure, from the user's perspective, is the absence of an explicit authorising decision from Parliament or the electorate for the specific practices now in place, despite the existence of the overarching statutory duty.

THE APPROACH: Clarify and narrow the interpretation of the Public Sector Equality Duty (PSED) through official guidance, focusing on a 'due regard' that prioritises eliminating unlawful discrimination over proactive diversity targets.

THE GUIDING POLICY: Re-establish democratic accountability by using existing central government powers to impose a narrower, legally authoritative interpretation of the Public Sector Equality Duty. The approach is to force a distinction between mandatory legal compliance and discretionary policy, making the latter an explicit choice for which ministers are accountable.

ACTIONS:
- The Cabinet Office, in consultation with the Government Legal Department, should issue revised, legally authoritative guidance on the interpretation and application of Section 149 of the Equality Act 2010 for the Civil Service. This guidance must explicitly state that 'due regard' primarily means avoiding unlawful discrimination and promoting genuine equality of opportunity, rather than mandating specific diversity quotas, targets, or extensive proactive DEI initiatives beyond those necessary to meet the core duty. — Cabinet Office; Government Legal Department
- The Civil Service Commission should update its recruitment principles and guidance to align with the narrowed interpretation of the PSED, emphasising merit-based selection and ensuring that DEI considerations do not override the primary duty to appoint on merit. This includes reviewing and revising existing job descriptions, interview processes, and promotion criteria. — Civil Service Commission
- The Treasury should review and revise funding allocations and performance metrics for Civil Service departments and agencies to ensure they do not incentivise or reward expansive DEI programs that exceed the narrowed interpretation of the PSED. Funding should be directed towards core anti-discrimination training and processes. — HM Treasury
- The Public Administration and Constitutional Affairs Committee (PACAC) should conduct regular reviews of Civil Service compliance with the revised PSED guidance, scrutinising recruitment outcomes, promotion data, and internal conduct policies to ensure adherence to the merit principle and the focused interpretation of equality duties. — Public Administration and Constitutional Affairs Committee (PACAC)

THE PLAN: The Cabinet Office will issue legally authoritative guidance narrowing the interpretation of 'due regard' under the PSED to its core anti-discrimination duties. The Civil Service Commission will align recruitment principles to this, re-emphasising merit. HM Treasury will revise funding and performance metrics to stop incentivising expansive DEI. The Public Administration and Constitutional Affairs Committee (PACAC) will provide oversight of compliance with the new guidance.
```
