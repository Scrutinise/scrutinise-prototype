# M-06 — The permanent, appointed civil service

*The four critique passes as they ran, on a complete kernel. Exported 2026-09-09 11:34 UTC. No model was called to produce this file.*

- idea `8c216e8e-0557-45b4-b774-82f32a5e1662`
- build `61ff9933-6d1c-4caf-8cad-a67614810475` — **v2 DONE**, 2026-09-09 03:51 → 2026-09-09 04:02 UTC
- cost of the whole build: 36.06p

## Was the kernel complete when it was marked?

`KERNEL_CHECK` prompt size across every build of this measure. The kernel the four passes
read went from ten mostly-empty canonical columns to the drafted wording on 9 September;
a step in `tokensIn` is that change, visible without reading a word of the output.

| build | when | KERNEL_CHECK tokensIn | score |
|---|---|---|---|
| v1 DONE | 2026-09-02 15:11 | 1841 | 6 of 9 kernel tests passed; 3 failed and are on your list |
| v2 DONE | 2026-09-09 03:51 | 3332 | 6 of 9 kernel tests passed; 3 failed and are on your list |

## SMART

**DONE** — 2 models answered your own words (gemini-2.5-pro, claude-sonnet-5); 10 terms of art named — 10 confirmed by the corpus, 0 unverified; 30 cited findings from them; 7 of their points already covered, 3 not; verdict WEAK; 5 fields rewritten; read by gemini-2.5-pro

Model: `gemini-2.5-pro`, `claude-sonnet-5`, `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.5-pro` · 33813 in / 19126 out

Ran 03:57:23 → 04:01:08

<details><summary>carry <code>smart</code></summary>

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

### The 7 items it put on the list

**1. Fixed-Term Senior Appointments**

Tying senior appointments to fixed terms focuses on performance and provides a natural point for a minister to make a change without needing to prove misconduct. Without considering fixed-term appointments, your plan for ministerial control lacks a key mechanism for enabling change without the political difficulty of firing a permanent official.

*Raised by gemini-2.5-pro.*

**2. Ministerial Confidence as Employment Condition**

Strengthening ministerial authority requires making the minister's confidence in their Permanent Secretary a formal condition of their employment. Your proposal focuses on process but overlooks the powerful tool of making ministerial confidence a formal, contractual condition for senior civil service employment.

*Raised by gemini-2.5-pro.*

**3. Accounting Officer System Reform**

The Accounting Officer system, while important for financial propriety, can be used to obstruct policy; its application needs to be narrowed. By not addressing the Accounting Officer role, your strategy misses a significant lever officials can use to challenge or delay ministerial policy on grounds of financial propriety.

*Raised by gemini-2.5-pro.*

**4. *(no title recorded — not invented downstream)***

THE KERNEL FAILS A RUMELT TEST — The actions are not coordinated. The 'Actions' section presents two mutually exclusive sets of legislative proposals (one to amend CRAG, one to repeal it) as a single list. This is a menu of options, not a coherent set of actions designed to implement a single policy. The text: "Draft and introduce a Government Bill to amend Part 1 of the Constitutional Reform and Governance Act 2010... Draft and introduce a Government Bill to repeal Part 1 of the Constitutional Reform and Governance Act 2010..."

**5. *(no title recorded — not invented downstream)***

THE KERNEL FAILS A RUMELT TEST — The guiding policy is contradicted by the actions. The Guiding Policy explicitly states the approach is to leverage existing powers *without* new primary legislation, but the Actions section is composed almost entirely of proposals for new primary legislation. The text: "The guiding policy is to exploit existing statutory provisions... without directly challenging the statutory basis... thereby avoiding the significant political and legal hurdles associated with repealing primary legislation..."

**6. *(no title recorded — not invented downstream)***

THE KERNEL FAILS A RUMELT TEST — Failure to face the problem. The kernel does not address the core problem that repealing the 2010 CRAG Act would not reverse the 1854 Northcote-Trevelyan settlement. It would return civil service management to the Royal Prerogative, leaving the conventions of permanence and impartiality intact. The strategy proceeds on a false premise. The text: "The core problem is that elected administrations feel their agendas are moderated by a permanent official class, driven by the constitutional doctrine of ministerial responsibility which vests accountability in Ministers rather than individual civil servants."

**7. *(no title recorded — not invented downstream)***

A choice that may have been made the wrong way, on approach — main lever — The chosen path is to dismantle the entire Northcote-Trevelyan settlement, because the proposer ruled out incremental reform. This is the 'honest' strategy given their stated aims, but it is politically maximalist and has a near-zero chance of success. A more pragmatic strategy would have challenged the proposer's ruled-out option and focused on the narrower, achievable reforms (like those in the Maude review) that strengthen ministerial accountability within the current system. By taking the proposer at their word, we have drafted a strategy that is coherent but almost certainly impracticable.

## KERNEL_CHECK

**DONE** — 6 of 9 kernel tests passed; 3 failed and are on your list — marked by gemini-2.5-pro

Model: `gemini-2.5-pro` · 3332 in / 2736 out

Ran 04:01:09 → 04:01:31

<details><summary>carry <code>verification</code></summary>

```
KERNEL COMPLIANCE (gemini-2.5-pro): This kernel is internally inconsistent. The 'Approach' describes a cautious, leveraged strategy, but the 'Guiding Policy' and 'Actions' describe a high-risk, head-on assault that ignores the kernel's own diagnosis of the pivotal obstacle. The actions are a list of related activities rather than a coordinated, sequenced plan.
- FAILS "The approach has leverage on the named obstacle": The guiding policy has no leverage on the named pivotal obstacle. The obstacle is the 'prohibitively high' political cost of reform due to a 'broad, cross-party political and constitutional consensus'. The policy is to directly challenge the consensus head-on, without any mechanism to reduce the political cost or exploit an asymmetry. It proposes to pay the very cost the diagnosis identifies as prohibitive.
- FAILS "The actions cohere with each other": The actions are a list, not a coordinated plan. There is no sequencing; for example, a bill is drafted twice under different actions, and a transitional committee is established without clarity on when it operates relative to the new legislation passing. The actions are also inconsistent with the stated 'Approach', which explicitly rules out primary legislation, whereas the actions are almost entirely dependent on it.
- FAILS "No bad-strategy smell": The kernel fails to face the problem it identifies. The pivotal obstacle is the prohibitive political cost of this reform. The guiding policy and actions proceed as if this obstacle does not exist, offering no plan to overcome it. This is a failure to face the hardest part of the problem.
```

</details>

### The 3 items it put on the list

**1. *(no title recorded — not invented downstream)***

The strategy does not yet meet this test — The approach has leverage on the named obstacle. The guiding policy has no leverage on the named pivotal obstacle. The obstacle is the 'prohibitively high' political cost of reform due to a 'broad, cross-party political and constitutional consensus'. The policy is to directly challenge the consensus head-on, without any mechanism to reduce the political cost or exploit an asymmetry. It proposes to pay the very cost the diagnosis identifies as prohibitive. The text that fails it: "THE GUIDING POLICY: Directly challenge the Northcote-Trevelyan settlement by replacing the statutory basis for a permanent, merit-based civil service with a new framework giving ministers direct power of appointment and removal over senior officials."

**2. *(no title recorded — not invented downstream)***

The strategy does not yet meet this test — The actions cohere with each other. The actions are a list, not a coordinated plan. There is no sequencing; for example, a bill is drafted twice under different actions, and a transitional committee is established without clarity on when it operates relative to the new legislation passing. The actions are also inconsistent with the stated 'Approach', which explicitly rules out primary legislation, whereas the actions are almost entirely dependent on it. The text that fails it: "THE APPROACH: Leverage existing statutory powers to increase ministerial influence over senior civil service appointments, without requiring primary legislation to repeal CRAG Part 1 or dismantle the merit principle."

**3. *(no title recorded — not invented downstream)***

The strategy does not yet meet this test — No bad-strategy smell. The kernel fails to face the problem it identifies. The pivotal obstacle is the prohibitive political cost of this reform. The guiding policy and actions proceed as if this obstacle does not exist, offering no plan to overcome it. This is a failure to face the hardest part of the problem. The text that fails it: "PIVOTAL OBSTACLE: The pivotal obstacle is the broad, cross-party political and constitutional consensus that a permanent, impartial civil service is a public good... making the political cost of such a reform prohibitively high."

## LOGIC_CHECK

**DONE** — ⚠ the chain from causes to actions does NOT hold; 4 defects in the argument — traced by gemini-2.5-pro

Model: `gemini-2.5-pro` · 2381 in / 2212 out

Ran 04:01:31 → 04:01:50

<details><summary>carry <code>verification</code></summary>

```
KERNEL COMPLIANCE (gemini-2.5-pro): This kernel is internally inconsistent. The 'Approach' describes a cautious, leveraged strategy, but the 'Guiding Policy' and 'Actions' describe a high-risk, head-on assault that ignores the kernel's own diagnosis of the pivotal obstacle. The actions are a list of related activities rather than a coordinated, sequenced plan.
- FAILS "The approach has leverage on the named obstacle": The guiding policy has no leverage on the named pivotal obstacle. The obstacle is the 'prohibitively high' political cost of reform due to a 'broad, cross-party political and constitutional consensus'. The policy is to directly challenge the consensus head-on, without any mechanism to reduce the political cost or exploit an asymmetry. It proposes to pay the very cost the diagnosis identifies as prohibitive.
- FAILS "The actions cohere with each other": The actions are a list, not a coordinated plan. There is no sequencing; for example, a bill is drafted twice under different actions, and a transitional committee is established without clarity on when it operates relative to the new legislation passing. The actions are also inconsistent with the stated 'Approach', which explicitly rules out primary legislation, whereas the actions are almost entirely dependent on it.
- FAILS "No bad-strategy smell": The kernel fails to face the problem it identifies. The pivotal obstacle is the prohibitive political cost of this reform. The guiding policy and actions proceed as if this obstacle does not exist, offering no plan to overcome it. This is a failure to face the hardest part of the problem.
LOGIC (gemini-2.5-pro): the chain DOES NOT HOLD.
Read as: The stated problem is that elected ministers feel their policy agendas are moderated by a permanent civil service for which they are constitutionally responsible but over which they lack direct control. The pivotal obstacle to changing this is the strong political and constitutional consensus that a permanent, impartial civil service is a public good, making any attempt at radical reform politically costly. The guiding policy is to directly challenge this consensus by replacing the current statutory framework with one giving ministers direct power of appointment and removal. The actions follow this by proposing legislation to repeal the existing law (CRAG Part 1), creating new codes reflecting ministerial control, and establishing new appointment panels led by ministers.
- NON_SEQUITUR: The diagnosis explicitly states that repealing CRAG Part 1 is the wrong remedy and will not achieve the desired outcome. However, the actions and plan are entirely focused on repealing CRAG Part 1. The actions do not follow from the diagnosis; they do the exact thing the diagnosis warns against.
- BROKEN_LINK: This approach is completely contradicted by the Guiding Policy and all subsequent actions, which are based on repealing CRAG Part 1 via primary legislation. The actions do not follow from this stated approach.
- BROKEN_LINK: The Guiding Policy and Actions propose to do exactly what the obstacle describes as having a 'prohibitively high' political cost, but they offer no mechanism to overcome, mitigate, or otherwise address this obstacle. The strategy identifies the key barrier but does not engage with it.
- NON_SEQUITUR: The list of actions contains two mutually exclusive primary legislative actions. A bill cannot both 'amend Part 1' and 'repeal Part 1' of the same Act. This makes the set of actions incoherent.
```

</details>

### The 4 items it put on the list

**1. *(no title recorded — not invented downstream)***

THE CONCLUSION DOES NOT FOLLOW — The diagnosis explicitly states that repealing CRAG Part 1 is the wrong remedy and will not achieve the desired outcome. However, the actions and plan are entirely focused on repealing CRAG Part 1. The actions do not follow from the diagnosis; they do the exact thing the diagnosis warns against. The text: "THE DIAGNOSIS: The proposer misidentifies the target. The problem is not the Constitutional Reform and Governance Act 2010 (CRAG), but the 170-year-old Northcote-Trevelyan settlement that created a permanent, impartial civil service appointed on merit. CRAG 2010 merely codified parts of this settlement. Repealing CRAG Part 1, the proposer's stated remedy, would not end the settlement; it would simply return civil service management to the Royal Prerogative, leaving the core conventions of permanence and impartiality in place."

**2. *(no title recorded — not invented downstream)***

A LINK IN THE CHAIN IS MISSING — This approach is completely contradicted by the Guiding Policy and all subsequent actions, which are based on repealing CRAG Part 1 via primary legislation. The actions do not follow from this stated approach. The text: "THE APPROACH: Leverage existing statutory powers to increase ministerial influence over senior civil service appointments, without requiring primary legislation to repeal CRAG Part 1 or dismantle the merit principle."

**3. *(no title recorded — not invented downstream)***

A LINK IN THE CHAIN IS MISSING — The Guiding Policy and Actions propose to do exactly what the obstacle describes as having a 'prohibitively high' political cost, but they offer no mechanism to overcome, mitigate, or otherwise address this obstacle. The strategy identifies the key barrier but does not engage with it. The text: "PIVOTAL OBSTACLE: The pivotal obstacle is the broad, cross-party political and constitutional consensus that a permanent, impartial civil service is a public good. Any attempt to replace it with direct ministerial appointments will be characterised as introducing a politicised 'spoils system', making the political cost of such a reform prohibitively high."

**4. *(no title recorded — not invented downstream)***

THE CONCLUSION DOES NOT FOLLOW — The list of actions contains two mutually exclusive primary legislative actions. A bill cannot both 'amend Part 1' and 'repeal Part 1' of the same Act. This makes the set of actions incoherent. The text: "Draft and introduce a Government Bill to amend Part 1 of the Constitutional Reform and Governance Act 2010 (CRAG 2010) to remove the statutory requirement for appointments to the Senior Civil Service (SCS) to be on merit... [and] Draft and introduce a Government Bill to repeal Part 1 of the Constitutional Reform and Governance Act 2010 (CRAG 2010)..."

## ADVERSARIAL

**DONE** — 6 issues raised against the whole proposal, read by gemini-2.5-pro

Model: `gemini-2.5-pro`, `gemini-2.5-flash` · 16918 in / 2119 out

Ran 04:01:50 → 04:02:11

### The 6 items it put on the list

**1. *(no title recorded — not invented downstream)***

The proposal grants ministers the power of removal but is silent on the employment law consequences. On what specific grounds can a senior civil servant be dismissed under the new regime, and what is the legal mechanism for doing so that avoids creating a new category of expensive unfair dismissal claims against the Crown?

**2. *(no title recorded — not invented downstream)***

The proposal transfers Accounting Officer responsibilities from Permanent Secretaries to Ministers by revising 'Managing Public Money'. As this guidance is subordinate to statutes governing parliamentary supply and audit, what primary legislation is required to make this transfer of accountability to Parliament legally effective, and has the necessity of such legislation been established?

**3. *(no title recorded — not invented downstream)***

The central problem is that an administration's programme is 'moderated'. The evidence base contains the contrary finding [31] that the Civil Service more often fails by agreeing with poor ministerial ideas. The proposal does not address this, nor does it quantify the scale of the 'moderation' problem, making it impossible to judge if the remedy is proportionate.

**4. *(no title recorded — not invented downstream)***

The plan vests appointment power in ministers to overcome the 'settled institutional views' of a permanent official class. What mechanism prevents a new permanent class of politically-appointed officials from developing its own 'settled institutional views', and how does the proposal ensure future governments are not moderated by their predecessors' appointees?

**5. *(no title recorded — not invented downstream)***

The proposal creates Ministerial Appointment Panels to replace the Civil Service Commission's role. What are the proposed criteria for appointment by these panels, and what is the legal recourse for a candidate who believes they were rejected for reasons of political discrimination rather than merit?

**6. *(no title recorded — not invented downstream)***

The proposal rests on repealing CRAG Part 1, which the proposal's own diagnosis states would return civil service management to the Royal Prerogative, leaving the Northcote-Trevelyan settlement intact as convention. The proposal does not explain how, in the absence of a statutory framework, it will legally compel the abolition of these entrenched conventions.

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

## The kernel, re-derived now

⚠ **Read live, at export time, not frozen at the moment of marking.** If a field has been
accepted or reopened since the build this differs from what the marker saw. It is here
because it is the closest available reading of the input. 9673 characters.

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
