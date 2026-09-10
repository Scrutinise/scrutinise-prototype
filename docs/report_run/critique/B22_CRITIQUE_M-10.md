# M-10 — Publicly funded charities campaigning on government policy

*The critique, per measure. Exported 2026-09-10 11:29 UTC.*

- idea `a6473880-e328-4674-b747-2eb3c658306b`
- build `3a5ad39f-5432-4dab-aee6-fd07f44a6f90` — **v1 DONE**, 2026-09-02 15:55 UTC · 31.38p

> **No model wrote anything to the database to produce this file, and no build was run.**
> `KERNEL_CHECK`, `LOGIC_CHECK` and `ADVERSARIAL` were re-run against the current kernel;
> `SMART` is carried from the build because re-running it rewrites the kernel.

## The headline, before anything else

| | |
|---|---|
| KERNEL_CHECK | **8–9 of 9** across 2 readings |
| LOGIC_CHECK | holds on all 2 readings |
| Kernel the marker read | complete kernel, 2836 prompt tokens |

## Was the kernel complete when the build marked it?

`kernelText()` read the empty canonical `Idea` columns until 9 September, so a build marked
before that fix was handed a title and two lists. The prompt SIZE is the discriminator, and
it is a measurement rather than a date comparison.

| build | when | KERNEL_CHECK tokens in | what it read | score |
|---|---|---|---|---|
| v1 DONE | 2026-09-02 15:55 | 1808 | STARVED kernel | 2 of 9 kernel tests passed; 7 failed and are on your list |
| **this export** | **just now** | **2836** | **complete kernel** | **8–9 of 9** across 2 readings |

## KERNEL_CHECK — 2 readings of the same kernel

| reading | prompt tokens | score | failing criteria |
|---|---|---|---|
| 1 | 2836 | **9 of 9** | — |
| 2 | 2836 | **8 of 9** | `ACTIONS_DEFEAT_CAUSES` |

### The criteria that failed, and on how many readings

**`ACTIONS_DEFEAT_CAUSES` — The actions defeat the diagnosed causes** · failed on 1 of 2 readings ⚠ **not on every reading**

> The actions do not defeat the material cause. The policy is to work around the cause (general permission for charities to campaign) by imposing specific grant conditions, which is a valid strategic choice. However, the test asks if the cause is defeated, and it is not; it is managed.

## LOGIC_CHECK — 2 readings

| reading | verdict | defects |
|---|---|---|
| 1 | the chain holds | 0 |
| 2 | the chain holds | 0 |

**Reading 1** — read as: *The kernel argues that public money is used by charities to campaign against the government not because rules are absent, but because they are unenforced. This happens due to an 'accountability vacuum': the departmental Accounting Officers who could prevent this are not explicitly tasked with it and have competing pressures. The proposed approach is to fix this vacuum by making these Accounting Officers explicitly and personally answerable for ensuring grant conditions prohibit the use of public funds for lobbying the grantor. The coherent actions and plan then lay out the necessary steps to implement this, such as creating standard grant clauses, mandating their use, establishing enforcement mechanisms, and adding external checks via the National Audit Office.*


**Reading 2** — read as: *The problem is that public money is used by charities to campaign against the policies of the government body that funded them. This is attributed to permissive Charity Commission guidance which creates an 'accountability vacuum' where no single person is responsible for preventing this. The proposed approach directly addresses this vacuum by making departmental Accounting Officers explicitly answerable for ensuring grant conditions prevent public funds from being used to lobby the grantor. The actions and plan logically follow, providing the tools and mandates to achieve this: creating standard anti-lobbying clauses for grants, requiring their use, establishing enforcement, and inviting external audit bodies to treat this as a value-for-money issue.*


## ADVERSARIAL — re-run, read-only

Model `gemini-2.5-pro` · 13241 in / 2034 out.

⚠ The prompt is the build's own: the SMART critique and the verification carry are read off
the stored pass log rather than re-derived, and the cost lines and the proposer's testimony
come through the same functions the pass uses.

**1.** The proposal hinges on defining 'campaigning activities' and 'directly oppose' in a legally robust way, but provides no evidence that such definitions are possible without also blocking legitimate, expert feedback from service delivery partners.

**2.** The proposal is functionally a repeat of a 2016 Cabinet Office policy that introduced a similar grant clause. The proposal does not diagnose why that policy failed to stick, and therefore cannot explain why this attempt will not also become a dead letter.

**3.** The mechanism for enforcement does not address the fungibility of money. The proposal offers no practical method for an Accounting Officer to prove that a specific government grant pound, rather than a privately-donated pound, funded a specific lobbying activity, yet the entire clawback provision depends on this.

**4.** The scale of the problem is unquantified. The proposal cites a 'sock puppet' phenomenon and loss of public trust but provides no data on how many charities or how much public money is involved, while findings show official reports of inappropriate activity are rare and public support for charity campaigning is high.

**5.** The proposal makes departmental Accounting Officers responsible for enforcement, but does not address the conflicting incentive structures of their own grant managers, who are rewarded for successful service delivery and maintaining relationships with charity partners, not for policing their advocacy.

**6.** The proposal is silent on the status of organisations that are not charities but deliver public services under grant and engage in lobbying, such as academic institutions, think tanks, or community interest companies. The focus on the Charity Commission's guidance in the plan risks creating an incoherent regime.

## SMART — carried from the build, not re-run

⚠⚠ **This pass rewrites the kernel.** `smartPass` calls `setProposal` on up to five fields,
and since the B18 fix those rewrites reach every marker that follows it. Re-running it here
would change the measure while the report is being written from it, so it is not re-run.

**DONE** — 2 models answered your own words (gemini-2.5-pro, claude-sonnet-5); 17 terms of art named — 9 confirmed by the corpus, 8 unverified; 12 cited findings from them; 7 of their points already covered, 9 not; verdict NOT_A_KERNEL; 5 fields rewritten; read by gemini-2.5-pro

⚠ Produced by the build above, on a **STARVED kernel** (its own prompt: 1227 tokens).

<details><summary>The critique in full</summary>

```
VERDICT ON THE KERNEL: NOT_A_KERNEL — This is a list of actions with no diagnosis or guiding policy. It jumps from a description of the legal landscape ('Causes') to a to-do list ('Actions') without first establishing what is pivotal or choosing an approach. It therefore fails Rumelt's core test: a strategy is a coherent argument, not a list.

RUMELT TESTS IT FAILS:
- It is a list of actions with no diagnosis under it: The kernel presents a list of four actions without an explicit diagnosis or guiding policy to explain why these specific actions, and not others, are the right ones. The 'Causes' section describes the situation but does not simplify it to a pivotal obstacle.
- Failure to face the problem: The 'Causes' are statements of fact about the existing rules, not a diagnosis of why the problem of 'sock puppets' persists despite them. A proper diagnosis must explain why the problem is unsolved; this one merely describes the context in which it happens.

WHAT THE CRITIQUE REWROTE:
- summaryDiagnosis: A diagnosis must explain what is pivotal. The original 'causes' were just context. The new diagnosis points to a specific, actionable problem: the accountability gap, which explains why the issue persists.
- pivotalObstacle: Good strategy requires naming the single thing that must be overcome. The rewrite identifies this as a specific failure of institutional design, which the guiding policy can then target.
- summaryGuidingPolicy: A strategy needs an approach, not just a list of actions. This new policy provides the central idea for the actions, giving them coherence and leverage by targeting an existing, powerful role (the Accounting Officer).
- whatItRulesOut: A policy that rules nothing out is not a choice. This makes the chosen approach sharp by defining it against credible alternatives, showing a deliberate decision has been made.
- summaryCoherentActions: The original actions were generic. The rewritten actions are coordinated and directly execute the guiding policy of fixing accountability on the Accounting Officer, creating a chain of mutually reinforcing steps.

TERMS OF ART THE CORPUS CONFIRMED: Accounting Officer, Charities Act 2011, Cabinet Office, Charity Commission, Charity Commission for England and Wales, Grant Agreement, National Audit Office, Public Accounts Committee, Transparency of Lobbying, Non-party Campaigning and Trade Union Administration Act 2014

NAMED BUT UNVERIFIED (never assert these): 'anti-advocacy clause' (2016 grant condition), Article 10, European Convention on Human Rights, CC9 guidance (Charities, Elections and Campaigning), Compact (Government and voluntary sector), Government Grants Management Function (GGMF), Managing Public Money, National Audit Office (NAO), Speaking out: guidance on campaigning and political activity by charities (CC9)

POINTS OTHER MODELS MADE THAT WE DO NOT ADDRESS:
- The central challenge is the fungibility of money; public grants for salaries and overheads free up privately-raised funds for lobbying.
- A previous attempt to introduce an 'anti-advocacy clause' into grant agreements in 2016 was withdrawn after a strong backlash, indicating the political sensitivity of this issue.
- The policy must focus on transparency and accounting separation rather than an outright ban on political commentary by recipients of public funds.
- The government relies on the third sector for both service delivery and expert policy advice, creating a dependency that complicates any attempt to impose restrictive new rules.
- Any new rules must be carefully drafted to avoid a chilling effect on legitimate policy engagement by charities, particularly in providing expert evidence to government and parliament.
- A blanket ban on publicly funded charities campaigning against government policy would sweep in legitimate service-user advocacy (e.g. disability or carers' charities) and risks conflict with charities' established right to campaign in furtherance of their objects.
- The department issuing a grant has a structural incentive to tolerate or even welcome favourable lobbying from its own grantees, which is why self-correction has not happened without external pressure.
- Fixing this by strengthening Accounting Officer duties under Managing Public Money targets the actual decision point — the grant award — rather than charity law generally.
- Transparency (a published register of grants to advocacy-engaged bodies) converts an invisible pattern into one Parliament and the public can scrutinise, without needing new prohibition.

HOW HARD TO PASS: As an administrative change driven by the Treasury and Cabinet Office, it does not require a vote in Parliament, which makes it easier than legislation. However, implementation will be very hard. It is most likely to die from passive-aggressive resistance from government departments who will see it as a bureaucratic burden that damages their relationships with key delivery partners for no direct gain.

MOST LIKELY TO GO WRONG: Departments will adopt the mandatory grant clause on paper but will not enforce it in practice. Grant managers will avoid confrontation with their delivery partners, and in the absence of a major scandal, there will be no central audit or political pressure to force them to act. The policy will become a dead letter.
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

⚠ Read live at export time. 7606 characters.

```
⚠ 10 of the fields below were drafted by this build and are awaiting the proposer's confirmation. Mark the WORDING, which is the kernel as it currently stands. Do not mark a field down for being unconfirmed.

TITLE: Curbing Publicly Funded Charity Campaigning Against Government Policy

THE PROBLEM: Publicly funded charities campaign to change the policy of their funding body, creating a situation where public money implicitly supports one side of a political argument without explicit democratic approval.

WHO IS AFFECTED: The financial cost of these campaigns is not established in the provided sources. However, there is an unquantified cost in terms of public trust in charities and government efficiency. · Taxpayers' money is used to fund opposition to policies they implicitly support through taxation. Government departments face publicly funded opposition to their policies, potentially diverting resources and creating policy incoherence. Charities risk public distrust and accusations of political bias, which can undermine their legitimacy and long-term funding prospects. · The proposer reports the phenomenon of 'sock puppets'. The Public Administration Committee notes ongoing controversy regarding whether government-funded charities should lobby against the government, expressing concern that taxpayer money should not subsidise such activities [committees-reports:publication:25188:arc-0088]. · Taxpayers, government departments, and the charities themselves.

CAUSES:
- (MATERIAL) Charity Commission guidance permits charities to campaign to further their charitable purposes, including advocating for policy changes.
- (CONTRIBUTORY) The existing legal framework and Charity Commission guidance distinguish between legitimate policy advocacy and prohibited party-political activity, but this distinction is often blurred in practice regarding public funds.

ROOT CAUSE: Charity Commission guidance permits charities to campaign to further their charitable purposes, including advocating for policy changes.

PIVOTAL OBSTACLE: The pivotal obstacle is an accountability vacuum: no single person or office has the duty and incentive to prevent public grant money from funding lobbying against the grantor. The Charity Commission regulates charitable purpose in general, not specific grant conditions, while departmental Accounting Officers who could enforce this are not explicitly tasked with it and face pressure to maintain relationships with delivery partners.

THE DIAGNOSIS: Public money underwrites campaigning against the policy of the funding body not because rules are absent, but because they are not enforced. The problem persists because the bodies issuing grants have no incentive to police the boundary between service delivery and lobbying; they often benefit from the political cover that 'independent' third-sector voices provide. The proposer's term 'sock puppets' captures this dynamic.

THE LEGAL LANDSCAPE AS STATED: Currently, charities in the UK are governed by the Charities Act 2011 and guidance from the Charity Commission, notably 'Campaigning and political activity guidance for charities (CC9)'. This framework permits charities to engage in campaigning and political activity to further their charitable purposes, but strictly prohibits party-political activity, support for political parties or candidates, and having a political purpose as their main objective. Section 74 of the Charities Act 2011 specifically restricts expenditure on promoting Bills in Parliament without the consent of the court or the Commission. Grant conditions have also been used by government departments to stipulate that funds should not be spent on activities of a political nature. · The current framework, while distinguishing between legitimate policy campaigning and prohibited party-political activity, appears to fall short in explicitly addressing the 'sock puppet' scenario described by the user – where publicly funded charities campaign against the policy of their funder. While 'inappropriate political activity' by charities is noted as rare, the guidance doesn't directly tackle the perceived conflict of interest when public money underwrites advocacy against the public funder's policy. The Public Administration Committee noted conflicting evidence on whether restrictions on political campaigning should be tightened or relaxed and did not recommend changes to the rules on political campaigning by charities, suggesting the existing guidance (CC9) was sound. However, the committee did recommend that ministers make a written statement to Parliament when providing direct grants to charities involved in political campaigning, indicating an awareness of the issue of public funds and political activity, but not a direct regulatory solution for the Charity Commission to enforce.

THE APPROACH: Implement explicit, standardised grant conditions across all government funding bodies that prohibit the use of public funds for campaigning against the funding body's policies, while allowing charities to campaign using other funds.

THE GUIDING POLICY: Fix accountability for the funding decision with the grantor, not by creating a new blanket ban on charity campaigning. The approach is to make the departmental Accounting Officer—who is already personally responsible for the proper use of public money—explicitly answerable for ensuring grant conditions prevent public funds being used to lobby the grantor.

ACTIONS:
- Develop a template for explicit grant conditions, stipulating that public funds (defined as funds originating from a government department, agency, or local authority) cannot be used for campaigning activities that directly oppose the stated policies of the funding body. This template should include clear definitions of 'campaigning activities' and 'directly oppose'. — Cabinet Office, in consultation with the Charity Commission and relevant legal departments
- Mandate the adoption of these template grant conditions by all government departments, agencies, and local authorities when distributing public funds to third-sector organizations. This mandate should be communicated through a Treasury or Cabinet Office circular. — HM Treasury and Cabinet Office
- Establish a clear, accessible reporting mechanism for funding bodies to flag potential breaches of these grant conditions, and a process for investigation and enforcement, including clawback provisions for misused funds. — Funding bodies (e.g., specific government departments, local authorities), with oversight from the Cabinet Office
- Provide training and guidance to public sector grant managers on how to interpret, apply, and enforce the new grant conditions, ensuring consistent application across different funding bodies. — Civil Service Learning, in collaboration with the Cabinet Office

THE PLAN: 1. HM Treasury to amend its 'Managing Public Money' guidance to require departmental Accounting Officers to certify that grant conditions prevent funds from being used to lobby the funding department. 2. The Cabinet Office to develop and mandate a standard, legally robust 'anti-lobbying' clause for all grant agreements, replacing inconsistent departmental versions. 3. The National Audit Office and Public Accounts Committee to be invited to treat grant-funded lobbying as a value-for-money issue in their examinations, creating an external check on Accounting Officers. 4. The Charity Commission to update its guidance (CC9) to clarify how charities should manage compliance with funder-specific grant conditions alongside their general right to campaign.
```
