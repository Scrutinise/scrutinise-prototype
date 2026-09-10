# M-07 — Operational independence of the Bank of England

*The critique, per measure. Exported 2026-09-10 11:24 UTC.*

- idea `5c7287d2-c059-4c84-a4e4-5cf1e97c19db`
- build `84bb57c7-4d4c-4a74-99b5-7b45144ade45` — **v1 DONE**, 2026-09-02 15:23 UTC · 30.52p

> **No model wrote anything to the database to produce this file, and no build was run.**
> `KERNEL_CHECK`, `LOGIC_CHECK` and `ADVERSARIAL` were re-run against the current kernel;
> `SMART` is carried from the build because re-running it rewrites the kernel.

## The headline, before anything else

| | |
|---|---|
| KERNEL_CHECK | **6–7 of 9** across 2 readings |
| LOGIC_CHECK | **does NOT hold** on all 2 readings |
| Kernel the marker read | complete kernel, 2992 prompt tokens |

## Was the kernel complete when the build marked it?

`kernelText()` read the empty canonical `Idea` columns until 9 September, so a build marked
before that fix was handed a title and two lists. The prompt SIZE is the discriminator, and
it is a measurement rather than a date comparison.

| build | when | KERNEL_CHECK tokens in | what it read | score |
|---|---|---|---|---|
| v1 DONE | 2026-09-02 15:23 | 1792 | STARVED kernel | 2 of 9 kernel tests passed; 7 failed and are on your list |
| **this export** | **just now** | **2992** | **complete kernel** | **6–7 of 9** across 2 readings |

## KERNEL_CHECK — 2 readings of the same kernel

| reading | prompt tokens | score | failing criteria |
|---|---|---|---|
| 1 | 2992 | **7 of 9** | `ACTIONS_DEFEAT_CAUSES`, `ACTIONS_COHERE` |
| 2 | 2992 | **6 of 9** | `ACTIONS_DEFEAT_CAUSES`, `ACTIONS_COHERE`, `NO_BAD_STRATEGY_SMELL` |

### The criteria that failed, and on how many readings

**`ACTIONS_DEFEAT_CAUSES` — The actions defeat the diagnosed causes** · failed on 2 of 2 readings

> The kernel presents three different sets of actions ('THE APPROACH', 'ACTIONS', 'THE PLAN') which are not consistent. 'THE PLAN' is the only set that directly addresses the second material cause, which is about perception. The other action sets ignore this cause.

**`ACTIONS_COHERE` — The actions cohere with each other** · failed on 2 of 2 readings

> The kernel presents three different and contradictory sets of actions under the headings 'THE APPROACH', 'THE GUIDING POLICY', 'ACTIONS', and 'THE PLAN'. They cannot all be pursued at once. For example, 'THE APPROACH' suggests using existing powers, while 'ACTIONS' and 'THE PLAN' aim to change the law. This is not a coordinated set of actions; it is a list of mutually exclusive strategies.

**`NO_BAD_STRATEGY_SMELL` — No bad-strategy smell** · failed on 1 of 2 readings ⚠ **not on every reading**

> The 'ACTIONS' section smells of 'Mistaking Goals for Strategy'. It is a list of things to achieve (draft a bill, introduce a bill, develop a framework) without a coherent plan for how to overcome the diagnosed political obstacle to achieve them. It is a wish-list, not a set of coordinated actions that execute the guiding policy.

## LOGIC_CHECK — 2 readings

| reading | verdict | defects |
|---|---|---|
| 1 | ⚠ **does NOT hold** | 3 |
| 2 | ⚠ **does NOT hold** | 2 |

**Reading 1** — read as: *The problem is a lack of accountability for monetary policy decisions made by the independent Bank of England. This is caused by the 1998 Act which framed these political decisions as purely technical. The pivotal obstacle to changing this is a strong cross-party political consensus that this independence is non-negotiable, creating a 'credibility trap' for any government that challenges it. The strategy then splits into two contradictory paths. The first, described in the 'Guiding Policy', is to attack the consensus by commissioning an audit of monetary policy's effects, using it to force a parliamentary debate, and publishing a green paper to build a coalition for change. The second, described in 'The Approach', is to bypass the consensus and the need for new legislation by using existing reserve powers. The listed 'Actions' then contradict this second approach by proposing to draft and pass a new bill, which is new legislation.*

- **BROKEN_LINK** — The stated 'Approach' is to act 'without requiring new primary legislation,' but the first 'Action' is to draft a bill, which is the definition of new primary legislation. The actions contradict the approach.
- **NON_SEQUITUR** — The kernel presents two different and conflicting strategies. 'The Approach' suggests using a specific, existing legal power to bypass the need for legislative change. 'The Guiding Policy' describes a political campaign to build pressure for legislative change. These are not one coherent approach.
- **BROKEN_LINK** — The Guiding Policy is about creating political pressure to make legislative change possible. The listed 'Actions' describe the legislative outcomes that would occur *after* that policy has succeeded. They are the goal, not the coherent actions that execute the policy. The steps listed under 'THE PLAN' (audit, debate, green paper) are the actions that actually align with the Guiding Policy.

**Reading 2** — read as: *The problem is a lack of accountability for monetary policy decisions, which have significant distributional consequences. This is caused by the 1998 Bank of England Act, which granted the bank operational independence and framed these political choices as merely technical. The pivotal obstacle to changing this is a strong cross-party political consensus that this independence is essential for economic credibility, a consensus that benefits politicians who can outsource blame for unpopular decisions. The stated guiding policy is to attack this consensus by reframing the debate around democratic accountability and exposing the political consequences of 'technical' decisions. However, the kernel then presents two different and conflicting sets of actions: one set involves immediately drafting and introducing a bill to repeal the Act, while another, more coherent plan involves commissioning an audit and publishing a green paper to first shift the political debate.*

- **BROKEN_LINK** — The 'ACTIONS' do not execute the 'GUIDING POLICY'. The policy is to attack the political consensus to make change possible, but the actions jump straight to legislative repeal, which the diagnosis identifies as impossible until that consensus is broken. The actions are the goal, not the execution of the approach.
- **BROKEN_LINK** — This stated 'APPROACH' is a distinct strategy that is completely disconnected from the rest of the kernel. Neither the 'GUIDING POLICY', the 'ACTIONS', nor 'THE PLAN' contain any steps to execute this idea of using reserve powers.

## ADVERSARIAL — re-run, read-only

Model `gemini-2.5-pro` · 24559 in / 2477 out.

⚠ The prompt is the build's own: the SMART critique and the verification carry are read off
the stored pass log rather than re-derived, and the cost lines and the proposer's testimony
come through the same functions the pass uses.

**1.** The proposal's 'Approach' is to use the existing Section 19 reserve power, but its 'Plan' and 'Actions' are designed to build a coalition for new primary legislation. Which is it? The strategy is incoherent, simultaneously arguing that a new law is not needed and laying out a multi-year plan to pass one.

**2.** The proposal to use the Section 19 reserve power hinges entirely on the phrase 'extreme economic circumstances'. The proposal does not define this term, nor does it set out who would define it or what criteria would apply. Any attempt to use the power without this would be immediately vulnerable to legal and political challenge that it was being used improperly.

**3.** The pivotal obstacle is identified as the political consensus that benefits the incumbent government, allowing the Chancellor to deflect blame. The plan requires that same Chancellor to be compelled by 'political pressure' to invoke Section 19 and take direct responsibility for monetary policy. The mechanism by which an audit and a debate would force a Chancellor to act so directly against their own political interest is not specified.

**4.** The plan assumes an audit of QE's distributional effects will produce politically explosive findings sufficient to overturn a 25-year cross-party consensus. This is an unquantified claim. There is no evidence presented to suggest the audit's findings would be conclusive enough to force this outcome, or what would happen to the strategy if they were ambiguous.

**5.** The proposal diagnoses the 'credibility trap' — that any attempt to reclaim control risks a hostile market reaction. However, the plan to commission an audit and publish a green paper with the explicit aim of questioning independence would itself signal intent and could trigger that very reaction. The proposal does not specify how this market risk would be managed during the 'consensus-building' phase, or who would bear the cost of it.

## SMART — carried from the build, not re-run

⚠⚠ **This pass rewrites the kernel.** `smartPass` calls `setProposal` on up to five fields,
and since the B18 fix those rewrites reach every marker that follows it. Re-running it here
would change the measure while the report is being written from it, so it is not re-run.

**DONE** — 2 models answered your own words (gemini-2.5-pro, claude-sonnet-5); 8 terms of art named — 6 confirmed by the corpus, 2 unverified; 18 cited findings from them; 3 of their points already covered, 7 not; verdict NOT_A_KERNEL; 5 fields rewritten; read by gemini-2.5-pro

⚠ Produced by the build above, on a **STARVED kernel** (its own prompt: 1249 tokens).

<details><summary>The critique in full</summary>

```
VERDICT ON THE KERNEL: NOT_A_KERNEL — This is a goal ('Reverse the operational independence of the Bank of England') followed by a list of the procedural steps required to pass a law. It is not a strategy. It fails to diagnose the pivotal obstacle (the powerful consensus that independence is essential for stability), offers no guiding policy for how to overcome that obstacle, and presents a mechanical sequence rather than a set of coordinated actions. It ignores the substantial body of evidence retrieved that contradicts its premise and supports the status quo.

RUMELT TESTS IT FAILS:
- Failure to face the problem: The kernel does not acknowledge or address the overwhelming political and economic consensus in favour of central bank independence, which is the primary obstacle to the proposal. The retrieved evidence shows cross-party support and cites benefits like lower inflation, but the kernel proceeds as if this opposition does not exist.
- Mistaking goals for strategy: The kernel mistakes the goal (reverse independence) for a strategy. The 'actions' are simply a description of the legislative process ('Draft a Bill', 'Introduce the drafted Bill'), not a strategy for achieving the goal in the face of opposition.
- The diagnosis is an inventory: The 'Causes' section is not a diagnosis. It restates the problem (the 1998 Act exists, and its effects are perceived as political) rather than identifying the pivotal obstacle that prevents the problem from being solved.

WHAT THE CRITIQUE REWROTE:
- summaryDiagnosis: A diagnosis must identify the critical barrier to progress. The barrier isn't the 1998 Act itself, but the powerful political forces that protect it. The rewrite focuses the strategy on that barrier.
- summaryGuidingPolicy: A strategy needs an approach. Instead of assuming the political will exists to pass a law, the new policy is designed to *create* that political will by changing the terms of the debate.
- summaryCoherentActions: Coherent actions must be mutually reinforcing and focused on the pivotal obstacle. The rewrite replaces a procedural checklist with a political strategy designed to overcome the identified consensus.

TERMS OF ART THE CORPUS CONFIRMED: Asset Purchase Facility (APF), Bank of England Act 1998, Inflation Target, Monetary Policy Committee (MPC), Quantitative Easing (QE), Treasury Committee

NAMED BUT UNVERIFIED (never assert these): The 'Ken and Eddie show', Time-inconsistency problem

POINTS OTHER MODELS MADE THAT WE DO NOT ADDRESS:
- The primary obstacle to reversal is not legal or procedural, but the fear of capital flight and a loss of market confidence in the UK economy.
- The use of unconventional monetary policy like Quantitative Easing since 2008 has fundamentally changed the nature of the Bank's intervention in the economy, making its political neutrality harder to defend.
- Accountability of the Bank of England to Parliament is currently weak, resting primarily on select committee hearings which have no power to sanction.
- The current separation of monetary and fiscal policy is an institutional fiction; in reality, decisions made by the MPC have profound fiscal consequences, particularly regarding the cost of government debt.
- A broader mandate for the Bank, including targets for employment or nominal GDP, would force an explicit acknowledgement of the trade-offs involved in its decisions.
- The international consensus in favour of central bank independence has weakened since the 2008 financial crisis, creating a more permissive environment for reform.
- The true beneficiary of central bank independence is often the government of the day, which can avoid responsibility for painful but necessary economic policies.

HOW HARD TO PASS: Extremely difficult. This proposal challenges a quarter-century of economic orthodoxy supported by the Treasury, the Bank of England, the financial services industry, and the leadership of both major political parties. It would be portrayed as a reckless act of economic vandalism. It is most likely to die at the earliest stage: the attempt to get a major political party to adopt it as policy.

MOST LIKELY TO GO WRONG: The proposal will be immediately and overwhelmingly dismissed by the entire political and economic establishment as populist, irresponsible, and economically illiterate, failing to gain any serious traction and being rejected before it even becomes a subject of public debate.
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

⚠ Read live at export time. 7794 characters.

```
⚠ 10 of the fields below were drafted by this build and are awaiting the proposer's confirmation. Mark the WORDING, which is the kernel as it currently stands. Do not mark a field down for being unconfirmed.

TITLE: Reversing Bank of England's Operational Independence

THE PROBLEM: Monetary policy decisions, which have significant distributional consequences, are made by unelected officials at the Bank of England, leading to a lack of accountability when these decisions are perceived to go wrong.

WHO IS AFFECTED: Not established, but could include economic instability due to uncoordinated policies or social unrest from perceived unaccountable power. · Loss of public trust in economic governance, perceived democratic deficit in critical economic decision-making, and potential for policy misalignment between fiscal and monetary authorities. · The proposer reports that when decisions go wrong, there is no mechanism for accountability. Reasoning here rather than citing: The distributional consequences of monetary policy, such as those arising from quantitative easing or interest rate hikes, are widely acknowledged in economic literature, though specific cost figures for the lack of accountability are difficult to quantify directly. · The general public, particularly those sensitive to inflation, interest rate changes, and the distributional effects of monetary policy; elected officials whose policy goals may be undermined by independent monetary decisions.

CAUSES:
- (MATERIAL) The Bank of England Act 1998 granted operational independence to the Monetary Policy Committee (MPC) for formulating monetary policy.
- (MATERIAL) Monetary policy decisions, despite having significant distributional consequences, are perceived as technical rather than political choices.

ROOT CAUSE: The Bank of England Act 1998 granted operational independence to the Monetary Policy Committee (MPC) for formulating monetary policy.

PIVOTAL OBSTACLE: The pivotal obstacle is the cross-party political consensus that operational independence is non-negotiable for economic stability, which creates a 'credibility trap': any government attempting to reclaim control risks triggering a hostile market reaction that would punish it for the attempt.

THE DIAGNOSIS: The 1998 Bank of England Act reclassified the inherently political and distributional choices of monetary policy as a technical exercise in inflation targeting. The pivotal obstacle to reversing this is not legal but political: a deeply entrenched, cross-party consensus that operational independence is essential for economic credibility. This consensus allows incumbent governments to outsource blame for unpopular but necessary decisions (like raising interest rates), meaning the key political actors benefit from the status quo and have a strong incentive to resist any change that would return accountability directly to them.

THE LEGAL LANDSCAPE AS STATED: The current law governing the operational independence of the Bank of England for monetary policy is primarily the Bank of England Act 1998, as amended by the Bank of England and Financial Services Act 2016. Section 13 of the 1998 Act establishes the Monetary Policy Committee (MPC) with responsibility for formulating monetary policy. The Chancellor of the Exchequer sets the MPC's remit annually, including the inflation target, and the Government takes responsibility for these objectives (TREASURY — Interest Rates, 2001-10-25; Bank of England: Monetary Policy — Question, 2013-03-19). However, the day-to-day operational decisions on how to achieve that target rest with the independent MPC (Bank of England: Monetary Policy — Question, 2013-03-19; Bank of England: Monetary Policy Committee — Question, 2013-10-14). While independent, the Bank is accountable to Parliament, particularly through scrutiny by the Treasury Committee (Treasury — Public Sector Debt, 2020-06-03). · The user's core complaint is that the current framework reclassifies a political choice (monetary policy with distributional consequences) as a technical one, leading to a lack of accountability when decisions go wrong. The existing accountability mechanisms, such as scrutiny by the Treasury Committee, appear to be perceived as insufficient to address this 'democratic deficit' (Bank of England (Economic Affairs Committee Report) - Motion to Take Note, 2024-05-02). While the Chancellor sets the remit, the operational independence means that the government does not comment on the conduct or effectiveness of monetary policy itself (Bank of England (Economic Affairs Committee Report) - Motion to Take Note, 2024-05-02). This creates a gap where the public, through their elected representatives, feels unable to hold decision-makers directly to account for the outcomes of monetary policy, especially when those outcomes have significant societal impact. The problem is not necessarily a lack of formal legal mechanisms for accountability, but rather that these mechanisms are seen as inadequate to address the perceived depoliticisation of a fundamentally political issue, leaving no clear avenue for redress when policies have adverse distributional effects.

THE APPROACH: Utilise the existing reserve power of the Treasury under Section 19 of the Bank of England Act 1998 to direct monetary policy in 'extreme economic circumstances', thereby re-establishing a form of direct political control without requiring new primary legislation.

THE GUIDING POLICY: Attack the legitimacy of the consensus by reframing monetary policy as an issue of democratic accountability for distributional outcomes. The approach is to create new, unavoidable political pressure by systematically exposing the political choices and consequences currently disguised as 'technical' decisions, thereby making the status quo politically indefensible.

ACTIONS:
- Draft a Bill to amend or repeal the relevant sections of the Bank of England Act 1998 that confer operational independence on the Monetary Policy Committee (MPC) for setting interest rates and other monetary policy tools. — HM Treasury legal department, in consultation with the Attorney General's Office
- Introduce the drafted Bill into Parliament, initiating the legislative process for its passage, including securing cross-party support where possible and navigating parliamentary debate and scrutiny. — The relevant Secretary of State (e.g., Chancellor of the Exchequer) and government whips
- Develop and publish a new framework for monetary policy decision-making, outlining how elected officials (e.g., the Chancellor or a new parliamentary committee) will set policy, including clear objectives, decision-making processes, and accountability mechanisms. — HM Treasury, in consultation with the Bank of England and parliamentary committees
- Establish new institutional arrangements within HM Treasury or Parliament to support the political decision-making process for monetary policy, including analytical capacity, advisory functions, and reporting structures. — HM Treasury and the House of Commons (e.g., Treasury Committee)

THE PLAN: 1. (HM Treasury/NAO) Commission and publish an independent audit of the distributional consequences of monetary policy since 2008, focusing on Quantitative Easing's impact on wealth inequality. 2. (Backbench/Opposition MPs) Use the audit's findings to secure a full debate and vote on the floor of the House of Commons on the democratic governance of monetary policy, forcing MPs to publicly defend the current settlement's outcomes. 3. (HM Treasury) Based on the audit and debate, publish a green paper outlining alternative models for monetary policy governance, including a return to direct political control, to shift the Overton window and build a coalition for legislative change.
```
