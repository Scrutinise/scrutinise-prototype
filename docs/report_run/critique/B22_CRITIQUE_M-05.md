# M-05 — Judicial review of executive decisions

*The critique, per measure. Exported 2026-09-10 11:20 UTC.*

- idea `3e797bad-d0ee-4696-926b-a9eebb7170e3`
- build `52660c90-659f-4174-bef2-bd0253407ead` — **v1 DONE**, 2026-09-02 14:56 UTC · 34.12p

> **No model wrote anything to the database to produce this file, and no build was run.**
> `KERNEL_CHECK`, `LOGIC_CHECK` and `ADVERSARIAL` were re-run against the current kernel;
> `SMART` is carried from the build because re-running it rewrites the kernel.

## The headline, before anything else

| | |
|---|---|
| KERNEL_CHECK | 9 of 9 on all 2 readings |
| LOGIC_CHECK | ⚠⚠ **UNSTABLE — the verdict changed between readings** |
| Kernel the marker read | complete kernel, 2959 prompt tokens |

## Was the kernel complete when the build marked it?

`kernelText()` read the empty canonical `Idea` columns until 9 September, so a build marked
before that fix was handed a title and two lists. The prompt SIZE is the discriminator, and
it is a measurement rather than a date comparison.

| build | when | KERNEL_CHECK tokens in | what it read | score |
|---|---|---|---|---|
| v1 DONE | 2026-09-02 14:56 | 1897 | STARVED kernel | 2 of 9 kernel tests passed; 7 failed and are on your list |
| **this export** | **just now** | **2959** | **complete kernel** | 9 of 9 on all 2 readings |

## KERNEL_CHECK — 2 readings of the same kernel

| reading | prompt tokens | score | failing criteria |
|---|---|---|---|
| 1 | 2959 | **9 of 9** | — |
| 2 | 2959 | **9 of 9** | — |

*Every criterion passed on every reading.*

## LOGIC_CHECK — 2 readings

| reading | verdict | defects |
|---|---|---|
| 1 | ⚠ **does NOT hold** | 1 |
| 2 | the chain holds | 0 |

⚠⚠ **The verdict is not stable on this measure.** It changed between readings of a kernel
that did not change. A single verdict from this pass cannot be quoted as a property of the
kernel; what can be reported is that the readings disagree.

**Reading 1** — read as: *The problem is that courts are reviewing the merits of ministerial decisions, not just their legality, because they interpret laws designed to prevent this (ouster clauses) very narrowly. The core obstacle is the judiciary's principled resistance to having its review powers removed, which means any attempt to do so must use exceptionally clear and specific legislative language. The proposed approach is to assert parliamentary sovereignty by drafting very targeted legislation for specific policy areas. This legislation will explicitly define the difference between 'merits' (which are not reviewable) and 'legality' (which are). This is executed through four actions: drafting this specific legislation for an area like immigration, creating an internal pre-decision legal review to ensure compliance, requiring a statement of reasons that ties the decision to the new definitions, and creating a fast-track court procedure to quickly resolve disputes about whether a challenge is about merits or legality.*

- **CIRCULAR** — This statement is presented as a cause, but it is a restatement of the problem itself. The problem is that decisions are challenged on their merits; stating that this is also the cause of the problem is a circular argument.

**Reading 2** — read as: *The problem is that courts are perceived to be reviewing the policy merits of ministerial decisions, not just their legality, which undermines the executive. This is caused by the judiciary's long-standing principle of interpreting any legislative attempt to limit their oversight (ouster clauses) as narrowly as possible, a principle which is identified as the pivotal obstacle. The proposed approach is to counter this by drafting exceptionally clear and targeted legislation for specific policy areas. This new law would statutorily define the boundaries between reviewable 'legality' and non-reviewable 'merits', making it constitutionally difficult for courts to ignore Parliament's intent. The actions directly support this by drafting such a law for a test case, creating an internal pre-decision review to ensure decisions comply with the new definitions, requiring a statement of reasons to narrow the grounds for challenge, and establishing a fast-track court process to quickly resolve disputes over the new law's scope.*


## ADVERSARIAL — re-run, read-only

Model `gemini-2.5-pro` · 17079 in / 1955 out.

⚠ The prompt is the build's own: the SMART critique and the verification carry are read off
the stored pass log rather than re-derived, and the cost lines and the proposer's testimony
come through the same functions the pass uses.

**1.** The proposal's entire premise rests on an unquantified claim of judicial overreach based on 'executive perception', which directly contradicts the findings of the Independent Review of Administrative Law. Without specific data on how many decisions, in what policy areas, are being challenged on 'merits' rather than 'legality', the problem being solved is undefined.

**2.** The core mechanism—a statutory definition of 'merits' and 'legality'—is presented as a solution, but the proposal gives no indication of what these definitions would contain or how they could be drafted to be immune from the very judicial interpretation they seek to prevent. This is the central, unresolved definitional fight.

**3.** The proposal does not account for the behaviour of claimants. Litigants will not stop bringing challenges; their lawyers will instead focus on arguing that a case falls on the 'legality' side of the new statutory line, or challenge the definition itself. The proposal creates a new, preliminary ground for litigation without explaining why this is an improvement.

**4.** The proposal presents itself as a novel test case, but the evidence base shows that targeted ousters already exist, notably in the Judicial Review and Courts Act 2022 (abolishing Cart JRs) and the Safety of Rwanda Act 2024. Why is another test case needed before the legal and practical effects of these existing, recent examples are known?

**5.** The proposal assumes the test case would be in an area like immigration, but Finding 45 states that judicial review is a devolved matter and devolved administrations are opposed to reform. The proposal does not state whether the chosen policy area is devolved and, if so, how it would manage the legal and political complexity of restricting judicial review in England while it remains unchanged in Scotland, Wales, and Northern Ireland.

**6.** The proposal focuses entirely on limiting judicial review, but does not address the quality of initial decision-making. If ministerial decisions are being successfully challenged, is the only remedy to block the challenge, rather than improve the decision-making process that is leading to legal error?

**7.** The 'pre-decision review' and 'statement of reasons' actions are presented as internal departmental processes. However, making their findings 'available to potential challengers' risks creating a new, extensive duty of disclosure on the government's internal legal advice, which is currently subject to legal professional privilege. Has the impact on privilege been considered?

## SMART — carried from the build, not re-run

⚠⚠ **This pass rewrites the kernel.** `smartPass` calls `setProposal` on up to five fields,
and since the B18 fix those rewrites reach every marker that follows it. Re-running it here
would change the measure while the report is being written from it, so it is not re-run.

**DONE** — 2 models answered your own words (gemini-2.5-pro, claude-sonnet-5); 18 terms of art named — 15 confirmed by the corpus, 3 unverified; 38 cited findings from them; 9 of their points already covered, 9 not; verdict WEAK; 5 fields rewritten; read by gemini-2.5-pro

⚠ Produced by the build above, on a **STARVED kernel** (its own prompt: 1330 tokens).

<details><summary>The critique in full</summary>

```
VERDICT ON THE KERNEL: WEAK — The kernel fails on three core tests. The diagnosis restates the problem and ignores contradictory evidence (the IRAL finding of no systemic overreach). It lacks a guiding policy, jumping from a weak diagnosis to a list of actions. The actions themselves are not coherent; they mix a legislative strategy with an administrative one, failing to concentrate effort on a single approach.

RUMELT TESTS IT FAILS:
- the diagnosis is a restatement of the problem: The first 'material cause' is a direct rephrasing of the problem statement, offering no insight into why the situation exists.
- failure to face the problem: The diagnosis ignores the central contradictory finding from the Independent Review of Administrative Law (IRAL), which was commissioned to investigate this exact issue and found no systemic overreach by the courts. A strategy cannot be built on a premise the evidence refutes.
- a list of actions is not a strategy: The actions are a mix of two different strategies: one is legislative (defining terms in an Act), and the other is administrative (improving internal government processes to make decisions more robust to challenge). This is a list, not a coordinated set of actions executing a single guiding policy.
- the guiding policy is missing: The kernel has no guiding policy. It presents causes and then a list of actions, with no statement of the overall approach chosen to overcome the pivotal obstacle.

WHAT THE CRITIQUE REWROTE:
- summaryDiagnosis: The original diagnosis failed to face the problem by ignoring the most relevant piece of evidence (the IRAL report). Good strategy must be grounded in reality, including inconvenient facts. The rewrite makes the diagnosis more robust by incorporating this evidence.
- pivotalObstacle: A strategy needs to identify the one thing that must be defeated for anything else to matter. The rewrite isolates the core challenge—the courts' principled resistance—which any viable policy must address directly.
- summaryGuidingPolicy: A strategy is not a list of actions; it is an approach. Adding a guiding policy provides the crucial link between the diagnosis and the actions, explaining *how* the pivotal obstacle will be tackled.
- whatItRulesOut: A policy that rules nothing out is not a choice. This addition makes the strategy sharper by clarifying which alternative paths are being rejected and why.
- summaryCoherentActions: Good strategy concentrates force. The original list smeared effort across different approaches. The rewrite focuses all effort on executing the guiding policy through a single, decisive action, which is more likely to have an impact.

TERMS OF ART THE CORPUS CONFIRMED: Judicial Review and Courts Act 2022, Safety of Rwanda (Asylum and Immigration) Act 2024, Anisminic Ltd v Foreign Compensation Commission, Anisminic Ltd v Foreign Compensation Commission [1969], Delegated Powers and Regulatory Reform Committee, House of Lords Constitution Committee, Independent Review of Administrative Law, Independent Review of Administrative Law (IRAL), Ouster clause, Parliamentary Sovereignty, Principle of Legality, R (Privacy International) v Investigatory Powers Tribunal, R (Privacy International) v Investigatory Powers Tribunal [2019], Rule of Law, Ultra vires

NAMED BUT UNVERIFIED (never assert these): Bill of Rights 1689, Article 9 / parliamentary privilege, Human Rights Act 1998, s.3 and s.4, R (Miller) v Secretary of State for Exiting the European Union [2017] and R (Miller) v The Prime Minister [2019]

POINTS OTHER MODELS MADE THAT WE DO NOT ADDRESS:
- The proposer correctly identifies that recent procedural reforms, like those in the Judicial Review and Courts Act 2022, do not address this fundamental constitutional tension.
- The Safety of Rwanda Act 2024 serves as a real-world test of the 'specific and targeted' approach to limiting judicial review.
- Any attempt to legislate in this area will be portrayed by opponents as an attack on the rule of law and the separation of powers.
- The Independent Review of Administrative Law's finding of 'no systemic overreach' suggests that the problem may be one of specific, high-profile cases rather than a routine issue across government.
- The proposer's central evidentiary source (IRAL) found against the premise of their own proposal, and that finding should be treated as evidence, not as an obstacle to route around.
- High-profile ministerial defeats (Miller I, Miller II/Cherry) are better explained as orthodox applications of established constitutional limits on prerogative power than as courts straying into merits review.
- The Safety of Rwanda Act 2024 is not a precedent for restricting judicial review grounds generally; it is a precedent for Parliament statutorily deeming a contested factual question resolved, a different and riskier constitutional move whose durability under future litigation is untested.
- Whichever government is in office has an institutional incentive to narrow review of its own decisions, so any proposal to do so should be judged by the strength of the evidence for overreach, not by the fact that a government wants it.
- Before further legislating, the operation of the two most recent targeted interventions — Cart-JR abolition and the Rwanda Act ouster — should be observed in practice, since neither has yet generated the kind of case law record IRAL was set up to examine.

HOW HARD TO PASS: Extremely hard. Any such legislation would face intense scrutiny and opposition in the House of Lords, from the legal profession, and from civil society groups. It would be portrayed as a constitutional power grab and an attack on the rule of law. It is most likely to die in the House of Lords, where it would be amended to the point of ineffectiveness.

MOST LIKELY TO GO WRONG: The legislation will be passed, but in a form so diluted by parliamentary amendments (particularly from the House of Lords) that it fails to effectively constrain the courts in the first significant test case, leaving the government politically weakened and the legal status quo unchanged.
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

⚠ Read live at export time. 7517 characters.

```
⚠ 10 of the fields below were drafted by this build and are awaiting the proposer's confirmation. Mark the WORDING, which is the kernel as it currently stands. Do not mark a field down for being unconfirmed.

TITLE: Narrowing Judicial Review of Executive Action

THE PROBLEM: Ministerial decisions are frequently challenged in court on grounds that extend beyond strict legality into the merits, leading to policy being determined by courts rather than elected officials, which undermines executive effectiveness.

WHO IS AFFECTED: Not established, but includes direct legal costs, indirect costs of delayed or abandoned policies, and the opportunity cost of executive time spent on litigation rather than governance. · Delays in policy implementation, potential for policy dilution or reversal by judicial intervention, increased legal costs for the government, and a blurring of the lines between executive and judicial branches. · The proposer reports ministerial decisions are routinely reopened. The Independent Review of Administrative Law (IRAL) examined these trends (committees-reports:publication:2295:22736). · Government ministers and departments, the public (through delayed or altered policy implementation), and the judiciary.

CAUSES:
- (MATERIAL) Ministerial decisions are frequently challenged in court on grounds that extend beyond strict legality into the merits.
- (MATERIAL) The prevailing legal interpretation of ouster clauses by courts limits their effectiveness, allowing for continued judicial scrutiny of executive decisions.

ROOT CAUSE: The prevailing legal interpretation of ouster clauses by courts limits their effectiveness, allowing for continued judicial scrutiny of executive decisions.

PIVOTAL OBSTACLE: The judiciary's consistent and principled resistance to legislative attempts to oust its jurisdiction, established in *Anisminic* (1969) and reaffirmed in *Privacy International* (2019). Courts will interpret any ambiguity in statute to preserve their supervisory role, meaning that only exceptionally clear and specific legislative language has any chance of being effective.

THE DIAGNOSIS: Despite the Independent Review of Administrative Law finding no systemic judicial overreach, the executive perceives that in high-stakes cases, judicial review blurs the line between legality and policy merits. This perception fuels a desire for legislative certainty. The root cause is the constitutional tension between parliamentary sovereignty and the rule of law.

THE LEGAL LANDSCAPE AS STATED: Currently, ministerial decisions are subject to judicial review on grounds such as illegality, irrationality, and procedural impropriety. While Parliament can legislate to restrict judicial review through ouster clauses, courts have historically interpreted these narrowly to preserve their supervisory jurisdiction, particularly concerning errors of law (tna-caselaw:[2019] UKSC 22:1). The Judicial Review and Courts Act 2022 made modest changes to judicial review, including the removal of the *Cart* jurisdiction, demonstrating a targeted approach to limiting review (pwdata-debates:debates2024-01-16e:240, committees-reports:publication:8886:152174-0001). The Safety of Rwanda (Asylum and Immigration) Act 2024 represents a recent attempt to use targeted ouster clauses to limit judicial scrutiny of decisions related to removals to Rwanda (bills-api:3540:12, bills-api:3540:24, pwdata-lords:daylord2024-03-04a:92). However, even these targeted clauses are subject to judicial interpretation and parliamentary debate regarding their compatibility with the rule of law and international obligations (pwdata-debates:debates2023-12-12b:310). · The current legal framework, despite recent reforms, is perceived by the proposer as failing because ministerial decisions are still routinely reopened in court on grounds that extend beyond strict legality into the merits of the decision. This leads to the practical question of governmental action being settled *after* the decision, rather than through the political process. The core failure, from the proposer's perspective, is that existing procedural reforms and targeted ouster clauses have not sufficiently narrowed judicial intervention to prevent what they see as courts effectively substituting their judgment for that of the executive. The historical judicial resistance to broad ouster clauses, as exemplified by *Anisminic* and *Privacy International*, means that any new statutory restriction would likely face similar interpretive challenges, potentially leading to continued litigation over the scope of judicial review itself, rather than a clear reduction in its reach.

THE APPROACH: Strengthen targeted ouster clauses through a statutory definition of 'merits' and 'legality' for specific policy areas, coupled with a pre-emptive judicial review process.

THE GUIDING POLICY: Assert parliamentary sovereignty by using narrow, targeted primary legislation that defines the precise boundaries of judicial review for a specific statutory power, rather than attempting a broad, general ouster. The approach is to make the statutory language so explicit that for a court to set it aside would require it to directly challenge Parliament's authority, not merely 'interpret' its intent.

ACTIONS:
- Draft primary legislation to amend the relevant Act(s) for a specific, high-frequency area of challenge (e.g., immigration decisions), introducing statutory definitions of 'merits' and 'legality' that explicitly delineate the boundaries of judicial review for decisions made under that Act. This legislation should specify that decisions falling within the 'merits' as defined are not subject to judicial review on those grounds. — Ministry of Justice, in consultation with the relevant policy department (e.g., Home Office)
- Establish a new, mandatory 'pre-decision review' mechanism within the relevant department's legal advisory function, requiring high-risk ministerial decisions (as defined by criteria set in the new legislation) to undergo an internal legal review specifically assessing compliance with the statutory 'legality' definition before being published. This review's findings would be recorded and made available to potential challengers. — Relevant policy department (e.g., Home Office Legal Advisers)
- Introduce a statutory requirement for a 'statement of reasons' accompanying all ministerial decisions covered by the new legislation, explicitly linking the decision to the statutory 'merits' and 'legality' definitions. This statement would serve as the primary document for any subsequent legal challenge, limiting the scope for discovery into the decision-making process itself. — Relevant policy department
- Amend the Civil Procedure Rules (CPR) to introduce a fast-track procedure for challenges to the scope of judicial review under the new legislation, specifically for cases where the claimant argues a decision falls outside the statutory 'merits' definition. This would provide early clarity on jurisdictional questions. — Civil Procedure Rule Committee (CPRC)

THE PLAN: Draft primary legislation for a single, specific area of executive action (e.g., a particular immigration power) that explicitly defines the statutory grounds for a decision and states that these are the only grounds on which a decision may be judicially reviewed, specifically excluding review on grounds of common-law irrationality for that power. This creates a clear test case for the new legislative approach.
```
