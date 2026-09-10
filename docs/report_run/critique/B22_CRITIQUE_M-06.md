# M-06 — The permanent, appointed civil service

*The critique, per measure. Exported 2026-09-10 11:22 UTC.*

- idea `8c216e8e-0557-45b4-b774-82f32a5e1662`
- build `61ff9933-6d1c-4caf-8cad-a67614810475` — **v2 DONE**, 2026-09-09 03:51 UTC · 36.06p

> **No model wrote anything to the database to produce this file, and no build was run.**
> `KERNEL_CHECK`, `LOGIC_CHECK` and `ADVERSARIAL` were re-run against the current kernel;
> `SMART` is carried from the build because re-running it rewrites the kernel.

## The headline, before anything else

| | |
|---|---|
| KERNEL_CHECK | 6 of 9 on all 2 readings |
| LOGIC_CHECK | **does NOT hold** on all 2 readings |
| Kernel the marker read | complete kernel, 3332 prompt tokens |

## Was the kernel complete when the build marked it?

`kernelText()` read the empty canonical `Idea` columns until 9 September, so a build marked
before that fix was handed a title and two lists. The prompt SIZE is the discriminator, and
it is a measurement rather than a date comparison.

| build | when | KERNEL_CHECK tokens in | what it read | score |
|---|---|---|---|---|
| v1 DONE | 2026-09-02 15:11 | 1841 | STARVED kernel | 6 of 9 kernel tests passed; 3 failed and are on your list |
| v2 DONE | 2026-09-09 03:51 | 3332 | complete kernel | 6 of 9 kernel tests passed; 3 failed and are on your list |
| **this export** | **just now** | **3332** | **complete kernel** | 6 of 9 on all 2 readings |

## KERNEL_CHECK — 2 readings of the same kernel

| reading | prompt tokens | score | failing criteria |
|---|---|---|---|
| 1 | 3332 | **6 of 9** | `HAS_LEVERAGE`, `ACTIONS_COHERE`, `NO_BAD_STRATEGY_SMELL` |
| 2 | 3332 | **6 of 9** | `HAS_LEVERAGE`, `ACTIONS_COHERE`, `NO_BAD_STRATEGY_SMELL` |

### The criteria that failed, and on how many readings

**`HAS_LEVERAGE` — The approach has leverage on the named obstacle** · failed on 2 of 2 readings

> The guiding policy has no leverage on the pivotal obstacle. The obstacle is a 'broad, cross-party political and constitutional consensus' that makes reform 'prohibitively high' in political cost. The policy is a direct challenge to that consensus, without exploiting any asymmetry or pivot point to overcome the cost. It ignores the obstacle rather than acting upon it.

**`ACTIONS_COHERE` — The actions cohere with each other** · failed on 2 of 2 readings

> The kernel presents two separate, overlapping, and slightly contradictory lists of actions under the 'ACTIONS' heading, rather than a single coordinated set. For example, the first list proposes to 'amend Part 1' of the Act, while the second proposes to 'repeal Part 1'. This is a list, not a coherent plan.

**`NO_BAD_STRATEGY_SMELL` — No bad-strategy smell** · failed on 2 of 2 readings

> The kernel exhibits 'Failure to face the problem' and 'Impracticable objectives'. The diagnosis correctly identifies the pivotal obstacle as a powerful political consensus that makes direct reform prohibitively costly. The guiding policy and actions then propose exactly that direct reform, without any mechanism to overcome the prohibitive political cost. The strategy is to do the very thing the diagnosis says is impossible.

## LOGIC_CHECK — 2 readings

| reading | verdict | defects |
|---|---|---|
| 1 | ⚠ **does NOT hold** | 4 |
| 2 | ⚠ **does NOT hold** | 2 |

**Reading 1** — read as: *The problem is that elected ministers feel their policy agendas are moderated by a permanent civil service for which they are constitutionally responsible but have little control over. The diagnosis states that the root cause is the 170-year-old Northcote-Trevelyan settlement, not the CRAG 2010 act, and that repealing CRAG would be ineffective. The pivotal obstacle is identified as the broad political consensus that an impartial civil service is a public good, making any attempt to change it politically costly. Despite the diagnosis and obstacle, the guiding policy and actions propose to directly challenge the settlement by repealing CRAG 2010 and giving ministers direct appointment and removal powers, a move the obstacle identifies as having a 'prohibitively high' political cost. The strategy contains two contradictory statements of approach: one to use existing powers and another to pass new legislation, with all actions following the latter.*

- **BROKEN_LINK** — The Guiding Policy and Actions (e.g., 'Draft and introduce a Government Bill to repeal Part 1 of the Constitutional Reform and Governance Act 2010') directly contradict the Diagnosis, which explicitly states that repealing CRAG Part 1 is the wrong remedy and would be ineffective.
- **BROKEN_LINK** — The Guiding Policy ('replacing the statutory basis... with a new framework giving ministers direct power of appointment') and Actions propose a course of action that the Pivotal Obstacle describes as having a 'prohibitively high' political cost, but they offer no mechanism to overcome or mitigate this obstacle.
- **NON_SEQUITUR** — This statement of approach is immediately contradicted by the Guiding Policy and all subsequent Actions, which are entirely focused on passing new primary legislation to repeal CRAG Part 1. The actions do not follow from this approach.
- **NON_SEQUITUR** — The list of actions is internally contradictory. One action calls for a bill to 'amend' CRAG Part 1, while another calls for a bill to 'repeal' it. These are mutually exclusive legislative goals.

**Reading 2** — read as: *The argument is that elected ministers lack control over policy implementation because of a permanent, irremovable civil service. The pivotal obstacle to changing this is the strong political consensus that an impartial civil service is a public good. The strategy then presents two contradictory approaches: one is to leverage existing powers without new laws, while the other is to directly challenge the entire system with new legislation. The specific actions all follow the second, more radical path, aiming to repeal the Constitutional Reform and Governance Act (CRAG) 2010 to give ministers direct appointment powers. This contradicts the kernel's own diagnosis, which states that repealing CRAG would not solve the problem.*

- **NON_SEQUITUR** — The diagnosis explicitly states that repealing CRAG Part 1 will not achieve the desired outcome. However, the Guiding Policy and multiple Actions are centered on doing exactly that. The proposed solution does not follow from the diagnosis.
- **BROKEN_LINK** — This stated approach is completely contradicted by the 'Guiding Policy' and all listed 'Actions', which are based on introducing a new Government Bill to repeal CRAG Part 1. The actions do not execute the stated approach.

## ADVERSARIAL — re-run, read-only

Model `gemini-2.5-pro` · 15878 in / 1932 out.

⚠ The prompt is the build's own: the SMART critique and the verification carry are read off
the stored pass log rather than re-derived, and the cost lines and the proposer's testimony
come through the same functions the pass uses.

**1.** The core problem is that an administration's programme is 'moderated' by officials. This is an unquantified claim. We have no data on how many policies are affected, what the economic or social cost of this 'moderation' is, or how this compares to the cost of policy failures caused by a lack of institutional memory.

**2.** The proposal transfers Accounting Officer responsibilities from Permanent Secretaries to Ministers. An Accounting Officer's duty is to Parliament, specifically on the proper use of public funds. How can a Minister, whose first duty is political, be held accountable by the Public Accounts Committee in the same apolitical way? This appears to replace a clear line of financial accountability with a political one.

**3.** The plan requires a Bill to repeal Part 1 of CRAG 2010. This part of the Act covers the entire Civil Service, not just the Senior Civil Service. What is the legal and management framework for the 99% of civil servants who are not senior, once the statutory basis for their management is repealed? Does this repeal not create a legal vacuum for the main body of the service?

**4.** The proposal creates a two-tier system: a politically appointed Senior Civil Service and a permanent, merit-appointed service below it. What is the mechanism for ensuring that the career civil service will impartially and effectively implement directions from politically appointed superiors, particularly when those directions conflict with established evidence or professional ethics?

**5.** The plan involves removing senior civil servants who are on permanent contracts. What is the projected cost in severance and early retirement packages for the initial wave of removals? Has a budget been allocated for this, and who bears the cost if it exceeds projections?

**6.** The proposal states that the Senior Civil Service will be subject to direct ministerial appointment. Which specific roles fall into the 'Senior Civil Service' for this purpose? Is it just Permanent Secretaries, or does it include Directors General and Directors? The proposal lacks a precise definition, which will be the central point of conflict in drafting the legislation.

## SMART — carried from the build, not re-run

⚠⚠ **This pass rewrites the kernel.** `smartPass` calls `setProposal` on up to five fields,
and since the B18 fix those rewrites reach every marker that follows it. Re-running it here
would change the measure while the report is being written from it, so it is not re-run.

**DONE** — 2 models answered your own words (gemini-2.5-pro, claude-sonnet-5); 10 terms of art named — 10 confirmed by the corpus, 0 unverified; 30 cited findings from them; 7 of their points already covered, 3 not; verdict WEAK; 5 fields rewritten; read by gemini-2.5-pro

⚠ Produced by the build above, on a **complete kernel** (its own prompt: 1433 tokens).

<details><summary>The critique in full</summary>

```
VERDICT ON THE KERNEL: WEAK — The kernel is internally contradictory. The Guiding Policy states the approach is to use existing powers without primary legislation, while the Actions list two different plans that both require new primary legislation. The Actions themselves are a list of alternatives, not a coordinated plan, which is a classic failure to make a strategic choice. Crucially, it fails to address the central finding from the research: that the proposer's target (the 170-year-old Northcote-Trevelyan settlement) and their proposed remedy (repealing the 2010 CRAG Act) are mismatched, and the latter will not achieve the former.

RUMELT TESTS IT FAILS:
- The actions are not coordinated: The 'Actions' section presents two mutually exclusive sets of legislative proposals (one to amend CRAG, one to repeal it) as a single list. This is a menu of options, not a coherent set of actions designed to implement a single policy.
- The guiding policy is contradicted by the actions: The Guiding Policy explicitly states the approach is to leverage existing powers *without* new primary legislation, but the Actions section is composed almost entirely of proposals for new primary legislation.
- Failure to face the problem: The kernel does not address the core problem that repealing the 2010 CRAG Act would not reverse the 1854 Northcote-Trevelyan settlement. It would return civil service management to the Royal Prerogative, leaving the conventions of permanence and impartiality intact. The strategy proceeds on a false premise.

WHAT THE CRITIQUE REWROTE:
- summaryDiagnosis: The original diagnosis failed to face the core problem identified in the research: the mismatch between the complaint and the remedy. A good strategy must correctly identify the landscape; this change corrects a fundamental error in the kernel's understanding of the problem.
- pivotalObstacle: While ministerial responsibility is part of the context, it's not the primary reason this problem remains unsolved. The true obstacle is political and cultural: the deep-seated belief across the political spectrum that an impartial civil service is valuable, making any attack on it politically toxic. This is a more accurate and actionable obstacle.
- summaryGuidingPolicy: A guiding policy must be a decisive choice. The original was confused. The rewrite makes a clear choice that aligns with the proposer's stated (if radical) ambition, resolving the internal contradiction.
- summaryCoherentActions: Strategy requires coordinated action, not a list of possibilities. The rewrite replaces the list with a coherent plan where each step logically follows from the guiding policy and reinforces the others.

TERMS OF ART THE CORPUS CONFIRMED: Accounting Officer, Civil Service Commission, Constitutional Reform and Governance Act 2010, Managing Public Money, Northcote-Trevelyan Report, Royal Prerogative, Senior Responsible Owner, The Carltona principle, The Civil Service Code, The Osmotherly Rules

POINTS OTHER MODELS MADE THAT WE DO NOT ADDRESS:
- Tying senior appointments to fixed terms focuses on performance and provides a natural point for a minister to make a change without needing to prove misconduct.
- Strengthening ministerial authority requires making the minister's confidence in their Permanent Secretary a formal condition of their employment.
- The Accounting Officer system, while important for financial propriety, can be used to obstruct policy; its application needs to be narrowed.

HOW HARD TO PASS: Extremely hard. This is not a minor legislative tweak; it is a fundamental reversal of a 170-year-old constitutional settlement. It would face ferocious opposition from within the civil service, from all opposition parties, from constitutional watchdogs in the House of Lords, and from former ministers and civil servants. It is most likely to die at the Cabinet committee stage, where the sheer scale of the political and legislative battle required would become apparent and deter any Prime Minister from proceeding.

MOST LIKELY TO GO WRONG: The government will lose control of the narrative. The policy will be successfully branded by opponents as a corrupt 'spoils system' designed to reward political loyalists and silence impartial advice, making the government look authoritarian and self-serving. This toxic perception will unite opposition and make it impossible to pass the legislation.
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

⚠ Read live at export time. 9673 characters.

```
⚠ 10 of the fields below were drafted by this build and are awaiting the proposer's confirmation. Mark the WORDING, which is the kernel as it currently stands. Do not mark a field down for being unconfirmed.

TITLE: Rebalancing Power: Ministerial Control over Senior Civil Service Appointments

THE PROBLEM: Elected administrations find their policy agendas moderated by a permanent, appointed, and effectively irremovable official class, leading to a perceived lack of ministerial control over departmental authority and policy implementation.

WHO IS AFFECTED: Not established, but could include the political cost of unfulfilled manifestos, the economic cost of delayed or ineffective policy implementation, and the opportunity cost of maintaining a system perceived as resistant to change. · Reduced ability for elected governments to implement their mandates fully, potential for policy drift, and a perception that accountability is diffused rather than concentrated in elected officials. The proposer reports a feeling of programmes being 'moderated' by officials. · The proposer's direct account of administrations finding their programmes moderated. Parliamentary debates and committee reports frequently discuss the balance between ministerial accountability and civil service impartiality, acknowledging the tension (e.g., [pwdata-lords:daylord2024-11-28b:151], [committees-reports:publication:24925:arc-0037]). · Elected Ministers and their administrations, the public (through potentially diluted policy implementation), and senior civil servants (facing unclear lines of accountability).

CAUSES:
- (MATERIAL) Elected administrations perceive their policy agendas are moderated by a permanent, appointed, and effectively irremovable official class.
- (MATERIAL) The constitutional doctrine of ministerial responsibility assigns accountability for departmental actions to Ministers, not individual civil servants.

ROOT CAUSE: The constitutional doctrine of ministerial responsibility assigns accountability for departmental actions to Ministers, not individual civil servants.

PIVOTAL OBSTACLE: The pivotal obstacle is the broad, cross-party political and constitutional consensus that a permanent, impartial civil service is a public good. Any attempt to replace it with direct ministerial appointments will be characterised as introducing a politicised 'spoils system', making the political cost of such a reform prohibitively high. This consensus is why no serious attempt has been made to reverse the settlement, and why reviews like Lord Maude's explicitly recommend reform within the existing structure.

THE DIAGNOSIS: The proposer misidentifies the target. The problem is not the Constitutional Reform and Governance Act 2010 (CRAG), but the 170-year-old Northcote-Trevelyan settlement that created a permanent, impartial civil service appointed on merit. CRAG 2010 merely codified parts of this settlement. Repealing CRAG Part 1, the proposer's stated remedy, would not end the settlement; it would simply return civil service management to the Royal Prerogative, leaving the core conventions of permanence and impartiality in place.

THE LEGAL LANDSCAPE AS STATED: The current legal framework for the Civil Service is primarily governed by Part 1 of the Constitutional Reform and Governance Act 2010. This Act provides a statutory basis for the Civil Service, including the requirement for appointments to be made on merit through fair and open competition, overseen by the Civil Service Commission (Constitutional Reform and Governance Act 2010, sch.1 para.1; explanatory-notes:en:ukpga/2010/25:1-0002). The Civil Service Management Code sets out detailed regulations and instructions regarding civil servants' terms and conditions (quangos-govuk:government/publications/civil-servants-terms-and-conditions:1). The 'Carltona principle' dictates that, in general, powers given to ministers can be exercised by officials acting on their behalf, reinforcing ministerial responsibility (tna-caselaw:[2020] UKSC 19:1; et-decisions:employment-tribunal-decisions/mr-r-wagener-v-the-right-honourable-m-gove-mp-2407553-slash-2021:2). Ministers are also bound by the Ministerial Code to uphold the political impartiality of the Civil Service (pwdata-lords:lordswrans2003-11-10a:28). · The current framework, while enshrining impartiality and merit-based appointments, is perceived by the proposer as failing to provide elected administrations with sufficient control over the senior official class. The complaint is that the 'settled institutional views' of a permanent civil service can effectively moderate or impede a government's agenda, despite the principle of ministerial accountability. While the 'Carltona principle' theoretically places responsibility on ministers for civil servants' actions, it doesn't address the perceived lack of direct control over appointments and removals of senior officials. The system is designed to ensure continuity and impartiality, but this can be seen as a barrier to rapid policy implementation or significant shifts in governmental direction when there is a mismatch between ministerial priorities and entrenched departmental views. The tension lies between the constitutional expectation of a permanent, impartial civil service serving successive governments and a minister's desire for direct leverage over the personnel responsible for delivering their specific mandate.

THE APPROACH: Leverage existing statutory powers to increase ministerial influence over senior civil service appointments, without requiring primary legislation to repeal CRAG Part 1 or dismantle the merit principle.

THE GUIDING POLICY: Directly challenge the Northcote-Trevelyan settlement by replacing the statutory basis for a permanent, merit-based civil service with a new framework giving ministers direct power of appointment and removal over senior officials.

ACTIONS:
- Draft and introduce a Government Bill to amend Part 1 of the Constitutional Reform and Governance Act 2010 (CRAG 2010) to remove the statutory requirement for appointments to the Senior Civil Service (SCS) to be on merit following fair and open competition, and to explicitly vest appointment and removal powers for SCS roles in the relevant Secretary of State. — Cabinet Office, Departmental Legal Services, Leader of the House of Commons/Lords
- Develop and publish a new Ministerial Code and a revised Civil Service Code reflecting the changes in appointment and removal powers, clearly outlining the roles and responsibilities of ministers and senior civil servants under the new regime, and establishing clear lines of accountability directly to ministers. — Cabinet Office, Prime Minister's Office
- Establish a transitional oversight committee, chaired by a senior non-executive director with experience in public appointments, to oversee the initial wave of ministerial appointments and removals, ensuring transparency and adherence to new guidelines while the system beds in. — Cabinet Office (with independent oversight)
- Implement a new performance management framework for the Senior Civil Service, directly linked to ministerial objectives and departmental outcomes, with performance reviews conducted by ministers and directly informing decisions on retention, promotion, or removal. — Individual Government Departments, Cabinet Office
- Draft and introduce a Government Bill to repeal Part 1 of the Constitutional Reform and Governance Act 2010 (CRAG 2010) and amend relevant sections of the Civil Service Order in Council 1995, specifically removing the statutory basis for the Civil Service Commission's role in senior appointments and the requirement for appointments to be on merit through fair and open competition. — Cabinet Office, in conjunction with the Ministry of Justice and Parliamentary Counsel
- Develop and publish a new Senior Civil Service (SCS) Appointment and Removal Code, replacing the existing Civil Service Commission Recruitment Principles. This code will establish a framework for direct ministerial appointment and removal of SCS roles, outlining the scope of ministerial discretion and any remaining procedural safeguards. — Cabinet Office and individual government departments
- Establish departmental Ministerial Appointment Panels for all SCS roles, chaired by the relevant Minister and including other designated political appointees. These panels will be responsible for interviewing candidates and making final recommendations directly to the Minister for approval. — Individual government departments, led by Ministers
- Implement a comprehensive training and induction programme for Ministers and their Special Advisers on the new appointment and removal powers, focusing on legal compliance, best practice in selection, and managing potential conflicts of interest. — Cabinet Office, supported by the Government Legal Department

THE PLAN: 1. Draft and introduce a Government Bill to repeal Part 1 of CRAG 2010, formally abolishing the Civil Service Commission and the statutory requirement for merit-based appointment. 2. The Bill will create a new statutory framework vesting appointment and removal powers for all Senior Civil Service roles in the relevant Secretary of State. 3. HM Treasury will revise 'Managing Public Money' to transfer Accounting Officer responsibilities from Permanent Secretaries to Ministers, concentrating financial accountability with the power of appointment. 4. The Cabinet Office will publish a new Civil Service Code and Ministerial Code reflecting these changes, replacing impartiality with direct accountability to the minister as the primary duty of senior officials.
```
