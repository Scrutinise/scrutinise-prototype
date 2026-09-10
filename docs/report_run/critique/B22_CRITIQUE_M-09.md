# M-09 — Gender self-identification

*The critique, per measure. Exported 2026-09-10 11:27 UTC.*

- idea `9209fd61-7aa6-452c-9307-a195288413e7`
- build `0dd7864e-5157-49e5-b30b-3ee2612984e0` — **v1 DONE**, 2026-09-02 15:44 UTC · 30.47p

> **No model wrote anything to the database to produce this file, and no build was run.**
> `KERNEL_CHECK`, `LOGIC_CHECK` and `ADVERSARIAL` were re-run against the current kernel;
> `SMART` is carried from the build because re-running it rewrites the kernel.

## The headline, before anything else

| | |
|---|---|
| KERNEL_CHECK | 7 of 9 on all 2 readings |
| LOGIC_CHECK | **does NOT hold** on all 2 readings |
| Kernel the marker read | complete kernel, 3239 prompt tokens |

## Was the kernel complete when the build marked it?

`kernelText()` read the empty canonical `Idea` columns until 9 September, so a build marked
before that fix was handed a title and two lists. The prompt SIZE is the discriminator, and
it is a measurement rather than a date comparison.

| build | when | KERNEL_CHECK tokens in | what it read | score |
|---|---|---|---|---|
| v1 DONE | 2026-09-02 15:44 | 1808 | STARVED kernel | 2 of 9 kernel tests passed; 7 failed and are on your list |
| **this export** | **just now** | **3239** | **complete kernel** | 7 of 9 on all 2 readings |

## KERNEL_CHECK — 2 readings of the same kernel

| reading | prompt tokens | score | failing criteria |
|---|---|---|---|
| 1 | 3239 | **7 of 9** | `ACTIONS_DEFEAT_CAUSES`, `ACTIONS_COHERE` |
| 2 | 3239 | **7 of 9** | `ACTIONS_DEFEAT_CAUSES`, `ACTIONS_COHERE` |

### The criteria that failed, and on how many readings

**`ACTIONS_DEFEAT_CAUSES` — The actions defeat the diagnosed causes** · failed on 2 of 2 readings

> The actions directly contradict the diagnosis. The diagnosis states the legal ambiguity has been resolved by the Supreme Court and is no longer the problem. However, the first two actions are to amend the Equality Act to resolve that same ambiguity, which the diagnosis claims is already settled.

**`ACTIONS_COHERE` — The actions cohere with each other** · failed on 2 of 2 readings

> The actions do not cohere with the guiding policy. The policy explicitly rules out seeking new primary legislation, but the first two actions are to draft and introduce new primary legislation. This is a direct contradiction.

## LOGIC_CHECK — 2 readings

| reading | verdict | defects |
|---|---|---|
| 1 | ⚠ **does NOT hold** | 2 |
| 2 | ⚠ **does NOT hold** | 2 |

**Reading 1** — read as: *The problem is that public bodies have not updated their policies to reflect a recent Supreme Court ruling that clarified 'sex' in the Equality Act means biological sex. This is due to institutional inertia, as there is no automatic mechanism to compel them to change. The stated approach is to use existing statutory powers to issue guidance and enforce compliance with the law as it now stands, specifically avoiding the need for new primary legislation. However, the first actions listed are to draft and pass new primary legislation to amend the Equality Act, after which new guidance would be issued.*

- **NON_SEQUITUR** — The Guiding Policy explicitly states the strategy is to avoid seeking new primary legislation, but the first and second actions are to draft and introduce new primary legislation (an amendment to the Equality Act). The actions directly contradict the stated policy.
- **BROKEN_LINK** — The 'ACTIONS' list and 'THE PLAN' describe two different and contradictory sets of activities. The 'ACTIONS' focus on creating new legislation, while 'THE PLAN' focuses on using existing powers, as described in the Guiding Policy. They cannot both be the intended course of action.

**Reading 2** — read as: *The problem is identified as legal ambiguity around the term 'sex', which the diagnosis states has now been resolved by a Supreme Court ruling clarifying that 'sex' means biological sex. The pivotal obstacle is therefore not the law, but institutional inertia, as public bodies have failed to update their policies to align with this ruling. The guiding policy is to use existing statutory powers to enforce compliance with the clarified law, and explicitly to avoid seeking new primary legislation. However, the first two coherent actions listed are to draft and pass new primary legislation, which directly contradicts the guiding policy.*

- **BROKEN_LINK** — The Guiding Policy explicitly states the approach is to avoid new primary legislation, but the first action listed is to draft new primary legislation. The action does not follow from the guiding policy.
- **BROKEN_LINK** — The diagnosis concludes that the problem is not the law itself, but a failure to implement the law as clarified. The proposed action to amend the law does not address the diagnosed problem.

## ADVERSARIAL — re-run, read-only

Model `gemini-2.5-pro` · 13366 in / 1700 out.

⚠ The prompt is the build's own: the SMART critique and the verification carry are read off
the stored pass log rather than re-derived, and the cost lines and the proposer's testimony
come through the same functions the pass uses.

**1.** The proposal's diagnosis rests on 'widespread' non-compliance by public bodies with the Supreme Court's ruling, but this is unquantified. What is the scale of this non-compliance? Without knowing if this affects 10 or 10,000 public bodies, the resources required for the audit and enforcement actions are entirely unknown.

**2.** The enforcement mechanism relies on the Equality and Human Rights Commission, but its capacity and willingness to pursue numerous non-compliant public bodies is assumed, not established. What specific enforcement powers would be used, and what is the evidence that the EHRC has the resources and political will to deploy them effectively against organised institutional resistance?

**3.** The proposal is silent on the legal status of individuals who already hold a Gender Recognition Certificate. The Gender Recognition Act 2004 states their acquired gender is 'for all purposes'. The proposal's actions, based on the Supreme Court ruling, appear to create a direct conflict with this provision for Equality Act purposes. How is this conflict to be resolved without new primary legislation?

**4.** The proposed statutory guidance will face a 40-day test in both Houses of Parliament. Given the contentious nature of the issue, what is the proposer's assessment of the risk that the guidance is rejected by a negative resolution, particularly in the House of Lords, and what is the fallback plan if the chosen vehicle fails?

**5.** The Cabinet Office is tasked with directing a compliance audit across all public bodies. What specific power enables the Cabinet Office to compel an arm's-length body, such as a university or local authority, to conduct such an audit, and what are the sanctions for non-compliance with the directive?

**6.** Finding [49] states the Supreme Court ruling 'does not clarify how the Act should be implemented or how the Gender Recognition Act interacts with the Equality Act and the right to privacy.' This contradicts the proposal's premise that the law is now fully settled. How can statutory guidance resolve these remaining ambiguities without itself being vulnerable to a fresh judicial review?

## SMART — carried from the build, not re-run

⚠⚠ **This pass rewrites the kernel.** `smartPass` calls `setProposal` on up to five fields,
and since the B18 fix those rewrites reach every marker that follows it. Re-running it here
would change the measure while the report is being written from it, so it is not re-run.

**DONE** — 2 models answered your own words (gemini-2.5-pro, claude-sonnet-5); 8 terms of art named — 5 confirmed by the corpus, 3 unverified; 13 cited findings from them; 8 of their points already covered, 1 not; verdict WEAK; 5 fields rewritten; read by gemini-2.5-pro

⚠ Produced by the build above, on a **STARVED kernel** (its own prompt: 1275 tokens).

<details><summary>The critique in full</summary>

```
VERDICT ON THE KERNEL: WEAK — The kernel fails to face the problem as it currently stands. The proposer's own testimony and the supplied research findings (specifically the Supreme Court ruling in *For Women Scotland*) show that the central legal ambiguity has been resolved. The kernel's diagnosis and actions are therefore aimed at a problem that no longer exists (legal ambiguity) and ignore the actual pivotal obstacle: the failure of administrative and institutional practice to conform to the now-clarified law. It proposes primary legislation where existing ministerial and regulatory powers of enforcement may be sufficient and more appropriate.

RUMELT TESTS IT FAILS:
- Failure to face the problem: The diagnosis identifies 'ambiguity' as the material cause, but the evidence, including the proposer's own account, states this ambiguity has been resolved by a Supreme Court ruling. The diagnosis fails to address the current problem, which is non-compliance with that ruling.
- The actions do not address the pivotal obstacle: The actions propose new primary legislation to define 'sex', a task the Supreme Court has already accomplished. They do not tackle the real obstacle, which is the institutional inertia preventing public bodies from updating their practices to align with the court's definitive ruling.
- The guiding policy is missing: The kernel moves from a list of causes to a list of actions without stating a guiding policy. This omits the crucial step of choosing an approach and explaining what that choice rules out.

WHAT THE CRITIQUE REWROTE:
- summaryDiagnosis: The original diagnosis was factually incorrect according to the provided evidence, including the proposer's own testimony. It failed to face the real, current problem. The rewrite aligns the diagnosis with the evidence.
- pivotalObstacle: A good diagnosis must name the pivotal obstacle. The original kernel did not. The rewrite identifies why the problem persists even after the root cause (legal ambiguity) was removed.
- summaryGuidingPolicy: A strategy kernel must have a guiding policy. The original had none. The new policy provides a clear approach that directly addresses the rewritten diagnosis and pivotal obstacle.
- whatItRulesOut: A guiding policy is only a real choice if it rules things out. This makes the strategic trade-off explicit.
- summaryCoherentActions: The original actions were incoherent with the real problem. The new actions are coherent with the new diagnosis and guiding policy, forming a logical plan to tackle institutional non-compliance.

TERMS OF ART THE CORPUS CONFIRMED: Equality Act 2010, Equality and Human Rights Commission (EHRC), Forstater v CGD Europe, Gender Recognition Act 2004, Government Equalities Office (GEO)

NAMED BUT UNVERIFIED (never assert these): For Women Scotland Ltd v The Lord Advocate [2022] CSIH 4, Single-sex services exception, Statutory Code of Practice

POINTS OTHER MODELS MADE THAT WE DO NOT ADDRESS:
- A statutory definition of sex would provide clarity not only for single-sex services but also for data collection, sports, and healthcare.

HOW HARD TO PASS: The revised strategy, using ministerial powers, is significantly easier to implement than passing a new Act of Parliament. It does not require a legislative slot or navigating the full parliamentary process. However, it will face intense political and media opposition and likely legal challenges (via judicial review) from groups who oppose the clarification. The hardest stage will be enforcing compliance across the public sector, where there is likely to be significant passive and active resistance.

MOST LIKELY TO GO WRONG: The government will issue the guidance, declare victory, but then fail to dedicate the political capital and resources needed for the long, difficult process of enforcing it across hundreds of resistant public bodies. The guidance will then exist on paper, but practice on the ground will change very little.
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

⚠ Read live at export time. 7923 characters.

```
⚠ 10 of the fields below were drafted by this build and are awaiting the proposer's confirmation. Mark the WORDING, which is the kernel as it currently stands. Do not mark a field down for being unconfirmed.

TITLE: Clarifying Legal Sex for Single-Sex Provisions

THE PROBLEM: The incremental reinterpretation of 'sex' in law, particularly concerning Gender Recognition Certificates, has led to confusion and unintended consequences for single-sex provisions, without explicit parliamentary approval.

WHO IS AFFECTED: Not established, but includes costs of litigation (e.g., *For Women Scotland* cases), potential costs of adapting or creating new single-sex provisions, and intangible costs related to diminished trust and social cohesion. The proposer reports that the issue led to 'four years to do what a private solicitor did in an afternoon' to resolve a specific instance, indicating significant wasted effort and cost. · Erosion of single-sex provisions, leading to concerns about safety, privacy, and dignity for women; legal uncertainty and increased litigation for service providers; potential for misapplication of the Equality Act 2010; social tension and division. · Court cases such as *For Women Scotland Ltd v The Scottish Ministers* [2025] UKSC 16 [tna-caselaw:[2025] UKSC 16:1, pwdata-lords:daylord2026-06-03a:112], parliamentary debates [scottish-parliament-or:13823:7, pwdata-westminster:westminster2023-06-12a:69], and impact assessments on proposed changes to GRC processes [impact-assessments:2023-8:9, si-2010plus:uksi/2023/41:schedule-2-paragraph-12] highlight the ongoing debate and legal challenges. · Women, particularly those relying on single-sex spaces and services (e.g., domestic abuse refuges, changing rooms, prisons); service providers (e.g., schools, public facilities); transgender individuals seeking clarity on their rights and access.

CAUSES:
- (MATERIAL) Ambiguity in the statutory definition of 'sex' in the Equality Act 2010.
- (MATERIAL) Conflicting interpretations of the interaction between the Gender Recognition Act 2004 and the Equality Act 2010.

ROOT CAUSE: Ambiguity in the statutory definition of 'sex' in the Equality Act 2010.

PIVOTAL OBSTACLE: The pivotal obstacle is institutional inertia. Public bodies have not updated their policies and guidance to conform with the law as clarified by the Supreme Court. This persists because there is no automatic, centralised mechanism to compel this update, and institutions benefit from the status quo by avoiding the operational and reputational costs of change. The primary mechanism for forcing compliance is costly, slow, case-by-case litigation by private individuals.

THE DIAGNOSIS: The Supreme Court's ruling in *For Women Scotland Ltd v The Scottish Ministers* [2025] has resolved the legal ambiguity, confirming 'sex' in the Equality Act 2010 means biological sex. The problem is therefore not the law itself, but the persistent gap between this definitive legal interpretation and the widespread administrative practices, policies, and guidance within public bodies which continue to reflect the previous, incorrect understanding based on self-identification.

THE LEGAL LANDSCAPE AS STATED: The current legal framework is primarily defined by the Gender Recognition Act 2004 (GRA 2004) and the Equality Act 2010. The GRA 2004 allows individuals to obtain a Gender Recognition Certificate (GRC), which changes their legal sex for most purposes [quangos-govuk:government/publications/call-for-input-incorrect-guidance-on-single-sex-spaces-and-gender-self-identification:1]. However, recent legal clarification, notably *For Women Scotland Ltd v The Scottish Ministers* [2025] UKSC 16, has established that 'sex' in the Equality Act 2010 refers to biological sex [tna-caselaw:[2025] UKSC 16:1, pwdata-lords:daylord2026-06-03a:112]. This means that while a GRC changes legal sex, it does not change biological sex for the purposes of the Equality Act 2010. The Equality Act 2010 allows for single-sex and separate-sex services, and service providers can, under certain conditions (proportionate means of achieving a legitimate aim), exclude or limit access for transgender people, even those with a GRC, from single-sex spaces based on biological sex [pwdata-westminster:westminster2023-06-12a:91]. · The user's account and the provided sources suggest that the primary failure was a period of ambiguity and conflicting interpretations regarding the meaning of 'sex' in the Equality Act 2010, particularly concerning its interaction with Gender Recognition Certificates. The incremental development of administrative practice and litigation, rather than explicit parliamentary decision, led to a situation where the implications for single-sex provision were not clearly or democratically addressed. Specifically, there was a widespread belief that a GRC changed a person's sex for all purposes of the Equality Act 2010, which, on the proposer's account and confirmed by recent litigation, was not the case. This confusion led to practical difficulties for organisations seeking to maintain single-sex services and spaces [scottish-parliament-or:13823:7]. While the recent Supreme Court ruling has largely clarified the legal position in the direction the proposer desires, the failure lies in the lack of clear, upfront legislative definition and the reliance on a protracted legal process to resolve fundamental interpretive questions, creating uncertainty and unintended consequences in the interim.

THE APPROACH: Leverage existing statutory powers to issue clear, updated guidance under the Equality Act 2010, reflecting the Supreme Court's ruling that 'sex' means biological sex, and to clarify its implications for single-sex provisions.

THE GUIDING POLICY: Use existing statutory and regulatory powers to enforce compliance with the law as clarified by the Supreme Court, rather than seeking new primary legislation. This approach concentrates effort on closing the implementation gap, not re-fighting a settled legal question in Parliament.

ACTIONS:
- Draft an amendment to the Equality Act 2010 to define 'sex' explicitly as biological sex at birth, and to clarify that single-sex provisions are based on this definition, subject to specific, tightly defined exceptions for holders of Gender Recognition Certificates where appropriate and explicitly stated. — Government Legal Department (GLD) in consultation with the Department for Women and Equalities (DWE)
- Introduce the drafted amendment as a Bill or as part of a wider legislative vehicle to Parliament for debate and enactment. — Department for Women and Equalities (DWE) and the relevant Secretary of State
- Upon enactment, the Equality and Human Rights Commission (EHRC) should issue updated statutory guidance on the Equality Act 2010, reflecting the new statutory definition of 'sex' and its implications for single-sex services and spaces. — Equality and Human Rights Commission (EHRC)
- All government departments and public bodies must review and update their internal policies, guidance, and training materials to align with the amended Equality Act 2010 and the EHRC's updated statutory guidance. — Cabinet Office (for cross-government coordination) and individual government departments/public bodies

THE PLAN: 1. The Minister for Women and Equalities to use the power under the Equality Act 2010 to issue statutory guidance clarifying that 'sex' means biological sex for the purposes of the Act, including for single-sex services, and direct the EHRC to update its Code of Practice accordingly. 2. The Cabinet Office to direct all government departments and public bodies to audit and update their policies and guidance in line with the new statutory guidance within a fixed timeframe. 3. The EHRC to use its existing enforcement powers to investigate and compel compliance from public bodies that fail to update their policies.
```
