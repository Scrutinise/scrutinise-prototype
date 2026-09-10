# M-03 — The United Kingdom Supreme Court

*The critique, per measure. Exported 2026-09-10 11:17 UTC.*

- idea `e4ece7d7-8f94-41a0-b9e0-8f5c1b5ae506`
- build `ccf15409-a7ea-45b9-83b5-02e4f281a1ac` — **v1 DONE**, 2026-09-02 14:33 UTC · 33.74p

> **No model wrote anything to the database to produce this file, and no build was run.**
> `KERNEL_CHECK`, `LOGIC_CHECK` and `ADVERSARIAL` were re-run against the current kernel;
> `SMART` is carried from the build because re-running it rewrites the kernel.

## The headline, before anything else

| | |
|---|---|
| KERNEL_CHECK | **8–9 of 9** across 2 readings |
| LOGIC_CHECK | holds on all 2 readings |
| Kernel the marker read | complete kernel, 2821 prompt tokens |

## Was the kernel complete when the build marked it?

`kernelText()` read the empty canonical `Idea` columns until 9 September, so a build marked
before that fix was handed a title and two lists. The prompt SIZE is the discriminator, and
it is a measurement rather than a date comparison.

| build | when | KERNEL_CHECK tokens in | what it read | score |
|---|---|---|---|---|
| v1 DONE | 2026-09-02 14:33 | 1804 | STARVED kernel | 1 of 9 kernel tests passed; 8 failed and are on your list |
| **this export** | **just now** | **2821** | **complete kernel** | **8–9 of 9** across 2 readings |

## KERNEL_CHECK — 2 readings of the same kernel

| reading | prompt tokens | score | failing criteria |
|---|---|---|---|
| 1 | 2821 | **8 of 9** | `ACTIONS_COHERE` |
| 2 | 2821 | **9 of 9** | — |

### The criteria that failed, and on how many readings

**`ACTIONS_COHERE` — The actions cohere with each other** · failed on 1 of 2 readings ⚠ **not on every reading**

> The actions are not fully coherent with the plan. The first action specifies a 'joint committee of both Houses of Parliament', but the final plan describes a 'new House of Lords select committee'. These are different bodies, and the inconsistency undermines the coordination of the proposal.

## LOGIC_CHECK — 2 readings

| reading | verdict | defects |
|---|---|---|
| 1 | the chain holds | 0 |
| 2 | the chain holds | 0 |

**Reading 1** — read as: *The argument is that the Constitutional Reform Act 2005, by creating a physically separate Supreme Court, fostered a new institutional culture where the court sees itself as a 'constitutional guardian' rather than a subordinate of Parliament. This cultural shift has gone unchecked because Parliament lacks a robust mechanism for scrutinizing how the judiciary interprets constitutional laws. The pivotal obstacle, therefore, is not the court's existence but this specific failure of parliamentary oversight. The proposed approach is to fix this by creating a powerful new parliamentary scrutiny mechanism. This will be achieved through a series of coherent actions: introducing a bill to establish a dedicated joint committee, mandating it to review judicial interpretation against parliamentary intent, empowering it to recommend legislative corrections, and requiring Parliament to act on those recommendations.*


**Reading 2** — read as: *The 2005 Constitutional Reform Act created a separate Supreme Court, and Parliament lacks a robust process for reviewing how the court interprets laws. This has led to the pivotal obstacle: Parliament's own failure to assert its sovereignty due to political inertia and the absence of a dedicated body to hold the court's interpretations accountable to legislative intent. The guiding policy is therefore to re-establish Parliament's authority not by attacking the court, but by creating a powerful new scrutiny mechanism. This will be achieved through a series of coherent actions: introducing a bill to create a new joint parliamentary committee, mandating it to review judicial interpretations against parliamentary intent, empowering it to recommend legislative fixes, and requiring Parliament to vote on those recommendations.*


## ADVERSARIAL — re-run, read-only

Model `gemini-2.5-pro` · 26793 in / 2029 out.

⚠ The prompt is the build's own: the SMART critique and the verification carry are read off
the stored pass log rather than re-derived, and the cost lines and the proposer's testimony
come through the same functions the pass uses.

**1.** The proposal's core premise—that the Supreme Court has a different 'self-conception' than the Appellate Committee, leading to different behaviour—is an unquantified claim. No evidence is presented comparing judgments or judicial rhetoric pre- and post-2005 to substantiate this alleged cultural shift.

**2.** The proposed committee's remit covers 'significant constitutional legislation', a term the proposal never defines. This ambiguity is a critical weakness, as any Bill to establish the committee would likely founder on the contentious and difficult task of defining its own jurisdiction.

**3.** The proposal fails to explain why the existing House of Lords Constitution Committee, which is already charged with reviewing the operation of constitutional law, is not the proper vehicle for this work. Creating a new committee that duplicates an existing one's remit is a fatal flaw unless the existing body's failure is proven.

**4.** The mechanism for dialogue with the judiciary—inviting testimony—has no teeth. The proposal does not specify what happens if the judiciary declines the invitation, which is a likely outcome given concerns about judicial independence. Without a plan for non-cooperation, the central 'accountability loop' fails.

**5.** The proposal asserts that parliamentary intent is an objective, discernible standard against which judicial interpretation can be measured. However, Findings [29] and [72] state that 'parliamentary intent' is itself a judicial construct, often confused with ministerial intent, and is not a simple, objective fact that a committee can retrieve and enforce.

**6.** The proposal's guiding policy is to 're-assert parliamentary intent' where judicial interpretation has diverged. This directly contradicts the established constitutional principle, cited in Findings [24] and [62], that it is for the courts, and not a select committee, to decide questions of law. The proposal does not explain how its mechanism can function without violating this separation of powers.

**7.** The proposal's plan relies on a 'Constitutional Scrutiny Bill' but offers no strategy for securing the government support and legislative time needed to pass it. The evidence suggests any government would view this Bill as creating a new source of political trouble for itself, yet the proposal does not identify a political champion or a path to overcoming this predictable executive resistance.

## SMART — carried from the build, not re-run

⚠⚠ **This pass rewrites the kernel.** `smartPass` calls `setProposal` on up to five fields,
and since the B18 fix those rewrites reach every marker that follows it. Re-running it here
would change the measure while the report is being written from it, so it is not re-run.

**DONE** — 2 models answered your own words (gemini-2.5-pro, claude-sonnet-5); 10 terms of art named — 8 confirmed by the corpus, 2 unverified; 19 cited findings from them; 7 of their points already covered, 9 not; verdict WEAK; 5 fields rewritten; read by gemini-2.5-pro

⚠ Produced by the build above, on a **STARVED kernel** (its own prompt: 1315 tokens).

<details><summary>The critique in full</summary>

```
VERDICT ON THE KERNEL: WEAK — This is a kernel, but its central proposal is likely impracticable. The actions propose creating a new joint committee, a step a previous parliamentary committee explicitly recommended against. A core action—compelling testimony from Supreme Court justices on their interpretative methods—is constitutionally contentious, likely to be resisted by the judiciary as a breach of the separation ofpowers, and unsupported by any existing power.

RUMELT TESTS IT FAILS:
- Impracticable objectives: The kernel proposes an action that is directly contradicted by evidence on the record and another that is constitutionally explosive with no clear basis in existing powers.
- Failure to face the problem: The kernel fails to acknowledge or address the direct finding that a key parliamentary committee has already considered and rejected its central proposal (a new joint scrutiny committee). A strategy that ignores direct, negative precedent is not facing the problem of political feasibility.

WHAT THE CRITIQUE REWROTE:
- summaryDiagnosis: A strategy kernel needs a clear, single-sentence diagnosis. This rewrite synthesises the listed causes into a coherent statement of what is going on, framing the problem as a cultural drift enabled by a scrutiny vacuum.
- pivotalObstacle: This sharpens the obstacle from a vague 'lack of will' to a specific 'institutional failure', which the proposed actions can then target directly. It also incorporates the proposer's own evidence about the lack of bills to show this inertia is real.
- summaryGuidingPolicy: A guiding policy must be an explicit statement of the approach. This provides that statement, making clear that the strategy is about creating a new process of oversight, not direct confrontation or abolition.
- whatItRulesOut: A policy that rules nothing out is not a policy. This makes the strategic choices explicit, showing why this path was chosen over credible alternatives, including the one favoured by the proposer.
- summaryCoherentActions: The original actions were impracticable. The research shows the Commons has no interest in a joint committee and a previous committee recommended against it. A Lords-only committee is more plausible. 'Inviting' testimony is a constitutionally realistic alternative to 'mandating' it, which would provoke a crisis. This makes the action plan more credible.

TERMS OF ART THE CORPUS CONFIRMED: Appellate Committee of the House of Lords, Appellate Jurisdiction Act 1876, Constitutional Reform Act 2005, Lord Chancellor, Lords of Appeal in Ordinary, Parliamentary Sovereignty, R (Miller) v The Prime Minister [2019] UKSC 41, Separation of Powers

NAMED BUT UNVERIFIED (never assert these): Middlesex Guildhall, R (Jackson) v Attorney General [2005] UKHL 56

POINTS OTHER MODELS MADE THAT WE DO NOT ADDRESS:
- The creation of the Supreme Court was a solution to a problem of perception about the separation of powers, not a problem of substance in the quality of justice.
- Reversing the 2005 reform would be a powerful reaffirmation of the UK's traditional constitutional model centred on parliamentary sovereignty.
- The pre-2005 arrangement, where Law Lords could contribute to legislative scrutiny, provided a valuable and now-lost source of judicial insight in Parliament.
- The cost and disruption of abolishing a major state institution after less than two decades would be significant and require strong political justification.
- Restoring the Law Lords would be seen internationally as a constitutional regression, undermining the UK's image as a modern state with a clear separation of powers.
- The current Justices of the Supreme Court are unlikely to have their legitimacy enhanced by being moved back into the legislature as Law Lords.
- The practical benefits of a separate court, such as improved public access and visibility, would be lost by returning the final court of appeal to the Palace of Westminster.
- Lord Sumption's reported argument — that the 2005 reform was "largely cosmetic" and the Court never held strike-down power — if accurate, would mean the proposer's own remedy (repealing Part 3) targets a power that was never granted, making abolition a category error relative to the actual complaint.
- Before any legislative step is contemplated, the Sumption claim needs to be verified, because if it is correct the entire premise that "the 2005 change" created new constitutional-guardian powers collapses, and the proposer's diagnosis needs re-stating as purely about symbolism and conduct.

HOW HARD TO PASS: Very hard. The revised proposal for a Lords-only committee is more plausible than a joint committee, but it still requires primary legislation (a 'Constitutional Scrutiny Bill') to give it teeth, such as the power to compel a parliamentary vote on its findings. Getting scarce legislative time for such a bill will be difficult, especially when the government may see it as creating a new source of political trouble for itself. It is most likely to die at the stage of securing a place in the government's legislative programme.

MOST LIKELY TO GO WRONG: The government will refuse to grant the necessary legislative time for the 'Constitutional Scrutiny Bill', killing the proposal quietly. Without a major public controversy to force the issue onto the agenda, it will be seen as a niche constitutional tinkering exercise that offers ministers more risk than reward.
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

⚠ Read live at export time. 7396 characters.

```
⚠ 10 of the fields below were drafted by this build and are awaiting the proposer's confirmation. Mark the WORDING, which is the kernel as it currently stands. Do not mark a field down for being unconfirmed.

TITLE: Curbing UK Supreme Court's 'Constitutional Guardian' Self-Conception

THE PROBLEM: The UK Supreme Court has developed a self-conception as a constitutional guardian above the legislature, despite its statutory creation, leading to judicial behavior that exceeds its intended appellate role and undermines parliamentary sovereignty.

WHO IS AFFECTED: The cost is primarily constitutional and political, rather than financial. It manifests as a weakening of democratic accountability and potential for legislative gridlock or judicial intervention in policy. Quantifying this cost financially is not established in the provided materials. · Erosion of parliamentary sovereignty, potential for judicial activism, and a shift in the balance of power within the UK constitution. This could lead to a less accountable judiciary influencing policy areas traditionally reserved for elected representatives. · The proposer reports the institution's self-conception and its effect on how judges behave. Reasoning here rather than citing: The historical development of judicial review in other common law jurisdictions (e.g., US Supreme Court, Canadian Supreme Court post-Charter) provides analogous examples of courts expanding their role beyond initial statutory or constitutional definitions. · The UK Parliament, the executive, and ultimately the electorate

CAUSES:
- (MATERIAL) The Constitutional Reform Act 2005 established the Supreme Court as a physically separate entity, replacing the Appellate Committee of the House of Lords, which fostered an institutional identity distinct from the legislature.
- (MATERIAL) Parliamentary mechanisms for comprehensive post-legislative scrutiny of constitutional legislation are not consistently applied or sufficiently robust.

ROOT CAUSE: The Constitutional Reform Act 2005 established the Supreme Court as a physically separate entity, replacing the Appellate Committee of the House of Lords, which fostered an institutional identity distinct from the legislature.

PIVOTAL OBSTACLE: The pivotal obstacle is Parliament's institutional failure to assert its sovereignty through systematic scrutiny, not the existence of the Supreme Court itself. This failure is rooted in political inertia—as the proposer reports, no bill to reverse the 2005 Act has been tabled in 15 years—and the absence of a body with the specific mandate and authority to hold judicial interpretation to account against legislative intent.

THE DIAGNOSIS: The Constitutional Reform Act 2005, by creating a physically and institutionally separate Supreme Court, inadvertently fostered a judicial culture that sees itself as a constitutional guardian rather than a creature of statute. This cultural drift persists because Parliament lacks a dedicated, robust mechanism to conduct post-legislative scrutiny of constitutional statutes and their judicial interpretation, creating a vacuum which the court's self-conception has filled.

THE LEGAL LANDSCAPE AS STATED: The current law governing the Supreme Court's existence and jurisdiction is primarily the Constitutional Reform Act 2005. This Act abolished the Appellate Committee of the House of Lords and transferred its appellate jurisdiction to the newly established Supreme Court. The Act details the framework for the Supreme Court, including its composition and powers, explicitly stating that it would exercise the 'same appellate jurisdiction' as the former Appellate Committee. The Human Rights Act 1998 also plays a significant role, as it incorporates the European Convention on Human Rights into UK law, allowing courts to review legislation for compatibility with Convention rights, though it does not grant the power to strike down primary legislation. · The user's complaint is not about a specific power granted by the Constitutional Reform Act 2005, but rather about the Supreme Court's evolving 'self-conception' as a constitutional guardian, which they perceive as exceeding its statutory remit. The provided sources do not directly address the Supreme Court's self-conception or demonstrate how it might have deviated from its intended role as defined by the 2005 Act. While debates around the Act mention the desire for a clearer separation of powers, there is no explicit discussion of the court's potential to overstep its appellate jurisdiction. The key failure, from the user's perspective, is not in the letter of the law, but in the institutional culture and interpretation that has emerged since the Act's implementation. The available documents do not contain post-legislative scrutiny specifically addressing this perceived institutional drift, although reports highlight the importance of such scrutiny for significant constitutional legislation.

THE APPROACH: Establish a robust, mandatory parliamentary post-legislative scrutiny mechanism for all significant constitutional legislation, specifically targeting judicial interpretation and adherence to statutory intent, and empower it with explicit authority to engage the Supreme Court.

THE GUIDING POLICY: Re-establish parliamentary supremacy over constitutional interpretation not by abolishing the court, but by creating a new, powerful mechanism to scrutinise and, where necessary, correct judicial interpretation of constitutional statutes. The approach is to create a formal dialogue and accountability loop where one is currently missing.

ACTIONS:
- Draft and introduce a 'Constitutional Scrutiny Bill' establishing a joint committee of both Houses of Parliament with a mandate for mandatory, quinquennial post-legislative review of all constitutional legislation, including the Constitutional Reform Act 2005. — Ministry of Justice, in coordination with the Leader of the House of Commons and Leader of the House of Lords
- Mandate that the new Joint Committee's review specifically assesses the judiciary's interpretation of constitutional statutes against original parliamentary intent, requiring the Supreme Court to provide written submissions and oral testimony on its interpretative methodologies and their evolution. — Joint Committee on Constitutional Scrutiny (once established)
- Empower the Joint Committee to recommend to Parliament statutory amendments or resolutions to clarify or reassert parliamentary intent where judicial interpretation is deemed to have departed significantly from it. — Joint Committee on Constitutional Scrutiny
- Establish a formal process for Parliament to consider and vote on the Joint Committee's recommendations within a specified timeframe, ensuring that the scrutiny process leads to concrete parliamentary action or explicit affirmation of the status quo. — House of Commons and House of Lords

THE PLAN: Introduce a 'Constitutional Scrutiny Bill' to establish a new House of Lords select committee with a mandate for quinquennial review of constitutional legislation. This committee will be empowered to invite testimony from the judiciary on interpretative trends and to recommend to Parliament statutory clarifications where interpretation is found to have diverged from legislative intent. Parliament will then be required to formally debate and vote on these recommendations.
```
