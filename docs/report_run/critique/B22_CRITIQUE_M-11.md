# M-11 — The Sentencing Council and sentencing guidelines

*The critique, per measure. Exported 2026-09-10 11:30 UTC.*

- idea `a379e439-5ca8-4afc-a3be-548382fe0e5e`
- build `090ae92f-ef6b-44ac-87a2-020bc5351206` — **v1 DONE**, 2026-09-02 16:07 UTC · 30.35p

> **No model wrote anything to the database to produce this file, and no build was run.**
> `KERNEL_CHECK`, `LOGIC_CHECK` and `ADVERSARIAL` were re-run against the current kernel;
> `SMART` is carried from the build because re-running it rewrites the kernel.

## The headline, before anything else

| | |
|---|---|
| KERNEL_CHECK | 9 of 9 on all 2 readings |
| LOGIC_CHECK | holds on all 2 readings |
| Kernel the marker read | complete kernel, 2910 prompt tokens |

## Was the kernel complete when the build marked it?

`kernelText()` read the empty canonical `Idea` columns until 9 September, so a build marked
before that fix was handed a title and two lists. The prompt SIZE is the discriminator, and
it is a measurement rather than a date comparison.

| build | when | KERNEL_CHECK tokens in | what it read | score |
|---|---|---|---|---|
| v1 DONE | 2026-09-02 16:07 | 1760 | STARVED kernel | 2 of 9 kernel tests passed; 7 failed and are on your list |
| **this export** | **just now** | **2910** | **complete kernel** | 9 of 9 on all 2 readings |

## KERNEL_CHECK — 2 readings of the same kernel

| reading | prompt tokens | score | failing criteria |
|---|---|---|---|
| 1 | 2910 | **9 of 9** | — |
| 2 | 2910 | **9 of 9** | — |

*Every criterion passed on every reading.*

## LOGIC_CHECK — 2 readings

| reading | verdict | defects |
|---|---|---|
| 1 | the chain holds | 0 |
| 2 | the chain holds | 0 |

**Reading 1** — read as: *The problem is a 'democratic deficit' because an unelected Sentencing Council sets politically significant guidelines, for which ministers are held accountable but have no control. This is caused by the Council's statutory independence and the non-binding nature of consultation. The pivotal obstacle to simply giving ministers control is the strong constitutional principle of judicial independence, which would view such a move as an unacceptable 'political veto'. The proposed approach navigates this obstacle by requiring dual approval from both a political actor (the Lord Chancellor) and the head of the judiciary (the Lady Chief Justice), thereby re-asserting democratic control while securing judicial buy-in. The actions directly implement this by creating the necessary legislation, the internal government process for review, and a transparency mechanism for the new power.*


**Reading 2** — read as: *The problem is a 'democratic deficit' because an unelected body, the Sentencing Council, sets politically significant guidelines for which ministers are held accountable but have no direct control. The primary obstacle to simply giving ministers control is the strong constitutional principle of judicial independence; any such move would be seen as a 'political veto' and face fierce opposition. The approach is to re-assert democratic accountability by amending the law to require dual approval for any new guideline from both a political actor (the Lord Chancellor) and the head of the judiciary (the Lady Chief Justice). The actions are to pass the legislation enabling this dual-key system, establish the formal processes for the minister to review guidelines, and create a transparent framework for how these new powers will be used.*


## ADVERSARIAL — re-run, read-only

Model `gemini-2.5-pro` · 25584 in / 2389 out.

⚠ The prompt is the build's own: the SMART critique and the verification carry are read off
the stored pass log rather than re-derived, and the cost lines and the proposer's testimony
come through the same functions the pass uses.

**1.** The consequences of deadlock are not specified. What happens if the Lord Chancellor vetoes the Sentencing Council's annual business plan, as Finding [16] notes the Sentencing Bill is silent on this? And what is the resolution process if the Lord Chancellor and the Lady Chief Justice disagree on whether to approve a guideline?

**2.** The proposal rests on guidelines having 'significant political content,' but this term is undefined. Without objective criteria, the Lord Chancellor's veto power appears arbitrary, justifying the 'political veto' concerns raised in Findings [35] and [56]. What is the proposed test for what constitutes a 'political' guideline subject to this new oversight?

**3.** The proposal lacks a strategy for managing judicial non-compliance. Finding [17] states the judiciary accepts guidelines because they emanate from an independent body. What is the plan if judges begin to systematically depart from politically-approved guidelines in the 'interests of justice', undermining the consistency the Council was created to provide?

**4.** The mechanism for accountability is incomplete. The proposal calls for the development of 'clear criteria' for the Lord Chancellor's decisions, but does not state what they might be. Finding [51] mentions a 'very high bar' for rejection, but this is legally undefined and provides no meaningful constraint on the exercise of the veto.

**5.** The proposal fails to account for the impact of a dual veto on the Sentencing Council's ability to plan its work. If guidelines can be vetoed late in the process by either the Lord Chancellor or Lady Chief Justice, how can the Council effectively manage its resources or provide the courts with timely guidance, especially for new offences?

**6.** The assertion of a 'perceived democratic deficit' is unquantified. The entire proposal is predicated on this deficit, but presents no evidence to establish its scale or nature. Is this a widespread public concern, or a disagreement confined to ministers and Parliament, as suggested by Finding [32]?

## SMART — carried from the build, not re-run

⚠⚠ **This pass rewrites the kernel.** `smartPass` calls `setProposal` on up to five fields,
and since the B18 fix those rewrites reach every marker that follows it. Re-running it here
would change the measure while the report is being written from it, so it is not re-run.

**DONE** — 2 models answered your own words (gemini-2.5-pro, claude-sonnet-5); 8 terms of art named — 7 confirmed by the corpus, 1 unverified; 18 cited findings from them; 7 of their points already covered, 3 not; verdict WEAK; 5 fields rewritten; read by gemini-2.5-pro

⚠ Produced by the build above, on a **STARVED kernel** (its own prompt: 1250 tokens).

<details><summary>The critique in full</summary>

```
VERDICT ON THE KERNEL: WEAK — The kernel identifies a real problem and proposes actions, but it fails to connect them with a diagnosis or a guiding policy in the main text. More importantly, it fails to face the problem as it currently exists: the actions it proposes ('draft a bill') are already being pursued by the government in the 'Sentencing Bill'. The real challenge, which the kernel ignores, is the significant constitutional and judicial opposition to that existing Bill, as detailed in the evidence.

RUMELT TESTS IT FAILS:
- failure to face the problem: The actions are presented as if they are a new initiative, when the evidence shows a government Bill with these exact provisions is already facing intense scrutiny and opposition. The kernel proposes starting a journey that is already near its most difficult stage.
- a list of actions is not a strategy: The kernel presents a list of actions without an explicit diagnosis or guiding policy to explain their strategic purpose. The 'why' is missing, leaving only the 'what'.

WHAT THE CRITIQUE REWROTE:
- summaryDiagnosis: A strategy needs a diagnosis that simplifies the situation into a coherent picture of what is going on. Listing causes is only the first step; synthesising them is what creates insight.
- pivotalObstacle: The diagnosis must identify why the problem persists. The obstacle isn't a lack of ideas for reform; it's a powerful, principled resistance to the most direct solution, as evidenced by the research findings.
- summaryGuidingPolicy: The guiding policy is the crucial link between diagnosis and action. Without it, the actions are just a to-do list. This policy gives the actions a clear strategic purpose.
- whatItRulesOut: A guiding policy is only meaningful if it makes a choice. Stating what is *not* being done makes the chosen path clearer and more deliberate.
- summaryCoherentActions: This change forces the strategy to confront the actual situation. The problem is not the absence of a bill, but the political and constitutional fight over the one that already exists. The strategy must engage with that reality to be effective.

TERMS OF ART THE CORPUS CONFIRMED: Coroners and Justice Act 2009, Criminal Justice Act 2003, Judicial independence, Justice Select Committee, Lord Chancellor, Sentencing Council for England and Wales, Sentencing Guidelines

NAMED BUT UNVERIFIED (never assert these): Halliday Report (Making Punishments Work)

POINTS OTHER MODELS MADE THAT WE DO NOT ADDRESS:
- Abolishing the Sentencing Council would make the government of the day directly responsible for the detailed sentencing framework.
- This change would risk sentencing policy becoming more volatile and susceptible to short-term populist pressures.
- Critics would argue that this reform could lead to a rapid increase in the prison population if ministers compete to appear tough on crime.

HOW HARD TO PASS: Very difficult. Although a government with a majority can force legislation through the House of Commons, this proposal faces profound constitutional objections. The evidence shows strong opposition from the House of Lords Constitution Committee and the judiciary. It is most likely to be defeated or significantly diluted in the House of Lords, which sees its role as defending constitutional principles like judicial independence from executive overreach.

MOST LIKELY TO GO WRONG: The Lord Chancellor, under political pressure, will use the veto power to block a guideline for populist reasons. This will be seen by the judiciary as the political interference they always feared, triggering a constitutional conflict, damaging the relationship between ministers and judges, and potentially leading to judges refusing to apply the politically-mandated guidelines, creating chaos in the courts.
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

⚠ Read live at export time. 7013 characters.

```
⚠ 10 of the fields below were drafted by this build and are awaiting the proposer's confirmation. Mark the WORDING, which is the kernel as it currently stands. Do not mark a field down for being unconfirmed.

TITLE: Rebalancing Accountability for Sentencing Guidelines

THE PROBLEM: Sentencing guidelines, which have significant political content and impact on public confidence in justice, are currently set by an unelected, independent body without direct ministerial or parliamentary control, leading to a perceived democratic deficit.

WHO IS AFFECTED: Not established. Potential costs include reduced public trust in the justice system and political friction between the judiciary and elected government. · The public may perceive a lack of democratic legitimacy in sentencing decisions. Parliament and Ministers lack direct influence over a key area of public policy. The judiciary may face public criticism for guidelines they did not directly create but must follow. · The Justice Committee acknowledges an ongoing debate regarding the balance between judicial independence and democratic scrutiny in sentencing (committees-reports:publication:11833:arc-0009). The proposer reports this as an example of the 'quango problem'. · The public (as victims and offenders), Parliament, Ministers, and the judiciary.

CAUSES:
- (MATERIAL) Sentencing guidelines, which have significant political content and impact on public confidence in justice, are currently set by an unelected, independent body without direct ministerial or parliamentary control.
- (MATERIAL) The current consultation process for sentencing guidelines is advisory, not binding, on the Sentencing Council.

ROOT CAUSE: Sentencing guidelines, which have significant political content and impact on public confidence in justice, are currently set by an unelected, independent body without direct ministerial or parliamentary control.

PIVOTAL OBSTACLE: The strong constitutional and institutional commitment to judicial independence prevents a simple transfer of authority. The judiciary's acceptance of guidelines is seen as conditional on them emanating from an independent body, and any move towards ministerial control is viewed as a 'political veto' that threatens this core principle, attracting fierce opposition from the judiciary and constitutional bodies like the House of Lords Constitution Committee.

THE DIAGNOSIS: Sentencing guidelines, which have significant political content, are set by the statutorily independent Sentencing Council. This was a deliberate design choice in the Coroners and Justice Act 2009 to insulate sentencing from direct political control and promote consistency. However, this has created a democratic deficit where a body that is unelected and not directed by ministers determines policy for which those ministers are held publicly accountable.

THE LEGAL LANDSCAPE AS STATED: The Sentencing Council for England and Wales was established by the Coroners and Justice Act 2009. This Act defines its functions, composition, and the process for developing and issuing sentencing guidelines (explanatory-notes:en:ukpga/2009/25:1-0002). The Council is statutorily obligated to consult with the Lord Chancellor and the Justice Select Committee on its draft guidelines (explanatory-notes:en:ukpga/2009/25:1-0090). While the Justice Select Committee provides comments, these are not binding on the Council (committees-reports:publication:11833:arc-0014). Courts are generally required to follow the Council's definitive guidelines (explanatory-notes:en:ukpga/2009/25:1-0002). Recent measures in the Sentencing Bill aim to introduce a statutory obligation for the Council to obtain approval from both the Lord Chancellor and Lady Chief Justice for all guidelines (pwdata-wrans:answers2025-09-10:150). · The current framework, as described by the proposer, fails because it vests significant authority over sentencing guidelines in an unelected, independent body, the Sentencing Council, leading to decisions with 'obvious political content' being settled administratively. This creates a perceived 'democratic deficit' where Parliament and ministers lack direct control or binding influence over the final guidelines (committees-reports:publication:11833:arc-0014, pwdata-debates:debates2003-05-20:323). While consultation with the Lord Chancellor and the Justice Select Committee exists, their input is not binding, meaning the Council can publish guidelines with which ministers or Parliament fundamentally disagree (explanatory-notes:en:ukpga/2009/25:1-0090, pwdata-debates:debates2025-04-30a:254). This can lead to a lack of public confidence if the Council's decisions are seen as out of step with public or political sentiment (pwdata-debates:debates2025-04-30a:290). The issue is not necessarily the existence of an expert body, but the degree to which its independence insulates it from direct democratic accountability on matters deemed politically significant.

THE APPROACH: Increase direct ministerial and parliamentary control over sentencing guidelines by requiring explicit approval.

THE GUIDING POLICY: Re-assert democratic accountability by giving ministers a decisive control point over the final content of sentencing guidelines. The approach is to amend the existing structure to require explicit approval from the Lord Chancellor (representing the executive) and the Lady Chief Justice (representing the judiciary) before any guideline can take effect, making a political actor directly answerable for the outcome.

ACTIONS:
- Draft and introduce a Bill to amend the Coroners and Justice Act 2009, specifically sections 120-125, to require that any sentencing guideline issued by the Sentencing Council must be approved by the Lord Chancellor and the Lady Chief Justice before coming into effect. — Ministry of Justice (MoJ) legislative drafting team, working with the Lord Chancellor's department.
- Establish a formal, time-bound consultation process within the MoJ for the Lord Chancellor to review proposed guidelines, including mechanisms for parliamentary committees (e.g., Justice Committee) to provide input directly to the Lord Chancellor. — Ministry of Justice, in coordination with relevant parliamentary committees.
- Develop clear criteria and a public statement of reasons for the Lord Chancellor's approval or rejection of guidelines, ensuring transparency and accountability in the new approval process. — Ministry of Justice, with input from the Sentencing Council and the Judiciary.

THE PLAN: Secure the passage of the existing Sentencing Bill's provisions (Clause 19) that require approval from both the Lord Chancellor and Lady Chief Justice for all guidelines. Support this by establishing a formal MoJ process for the Lord Chancellor's review, including input from the Justice Committee. Concurrently, develop and publish clear criteria for approval or rejection to provide transparency and a basis for the Lord Chancellor's public accountability for their decisions.
```
