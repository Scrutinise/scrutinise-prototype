# M-01 — Human Rights Act 1998 and the European Convention on Human Rights

*The critique, per measure. Exported 2026-09-10 11:14 UTC.*

- idea `72a29705-3365-4979-b8ad-a6bc80e4d488`
- build `73ef4f80-ef65-4508-8c33-6e5384930f37` — **v4 DONE**, 2026-09-09 04:02 UTC · 34.08p

> **No model wrote anything to the database to produce this file, and no build was run.**
> `KERNEL_CHECK`, `LOGIC_CHECK` and `ADVERSARIAL` were re-run against the current kernel;
> `SMART` is carried from the build because re-running it rewrites the kernel.

## The headline, before anything else

| | |
|---|---|
| KERNEL_CHECK | **8–9 of 9** across 2 readings |
| LOGIC_CHECK | holds on all 2 readings |
| Kernel the marker read | complete kernel, 3868 prompt tokens |

## Was the kernel complete when the build marked it?

`kernelText()` read the empty canonical `Idea` columns until 9 September, so a build marked
before that fix was handed a title and two lists. The prompt SIZE is the discriminator, and
it is a measurement rather than a date comparison.

| build | when | KERNEL_CHECK tokens in | what it read | score |
|---|---|---|---|---|
| v1 DONE | 2026-09-02 11:58 | 1827 | STARVED kernel | 2 of 9 kernel tests passed; 7 failed and are on your list |
| v2 DONE | 2026-09-02 12:24 | 2096 | STARVED kernel | 1 of 9 kernel tests passed; 8 failed and are on your list |
| v3 DONE | 2026-09-09 03:21 | 2400 | STARVED kernel | 1 of 9 kernel tests passed; 8 failed and are on your list |
| v4 DONE | 2026-09-09 04:02 | 3829 | complete kernel | 8 of 9 kernel tests passed; 1 failed and are on your list |
| **this export** | **just now** | **3868** | **complete kernel** | **8–9 of 9** across 2 readings |

## KERNEL_CHECK — 2 readings of the same kernel

| reading | prompt tokens | score | failing criteria |
|---|---|---|---|
| 1 | 3868 | **9 of 9** | — |
| 2 | 3868 | **8 of 9** | `ACTIONS_COHERE` |

### The criteria that failed, and on how many readings

**`ACTIONS_COHERE` — The actions cohere with each other** · failed on 1 of 2 readings ⚠ **not on every reading**

> The 'Actions' section is not a coordinated plan but a repetitive list of similar items. It presents multiple versions of the same core actions (drafting a bill, communications, notification) without clear sequencing or distinction, smearing effort rather than concentrating it. The section titled 'The Plan' provides the necessary coordination and sequencing that this section lacks.

## LOGIC_CHECK — 2 readings

| reading | verdict | defects |
|---|---|---|
| 1 | the chain holds | 0 |
| 2 | the chain holds | 1 |

**Reading 1** — read as: *The problem is that UK courts, applying the European Convention on Human Rights (ECHR) via the Human Rights Act 1998 (HRA), have the final say on political issues that should be decided by Parliament. The root cause is the HRA itself, which gives the ECHR domestic legal force. This situation persists not because Parliament lacks power, but because of political inertia and a tendency to attempt piecemeal reforms that fail. The proposed approach is therefore a 'clean break': a single, decisive legislative act to both repeal the HRA and denounce the ECHR simultaneously. The coherent actions to execute this are to draft and pass this single bill, formally notify the Council of Europe of the UK's withdrawal, manage the public communications, and conduct a legislative audit to handle the transition.*


**Reading 2** — read as: *The core problem is identified as the Human Rights Act shifting final authority on political matters from Parliament to the courts. This situation persists, according to the diagnosis, because of political inertia and a preference for ineffective, partial reforms. The pivotal obstacle is therefore this very inertia and risk aversion within the political establishment, which leads to these failed piecemeal attempts. To overcome this, the guiding policy is a 'clean break'—a single, decisive legislative act to both repeal the Human Rights Act and denounce the European Convention on Human Rights. The coherent actions flow directly from this: drafting and passing this specific bill, formally notifying the Council of Europe of the denunciation, and managing the legal and public transition.*

- **UNSUPPORTED** — This is a significant claim about the motivations of 'legal and administrative bodies,' but no evidence or reasoning is provided to support it. It is presented as a fact without backing.

## ADVERSARIAL — re-run, read-only

Model `gemini-2.5-pro` · 28165 in / 1791 out.

⚠ The prompt is the build's own: the SMART critique and the verification carry are read off
the stored pass log rather than re-derived, and the cost lines and the proposer's testimony
come through the same functions the pass uses.

**1.** The proposal claims policy on 'borders, deportation, and protest' is determined by courts, but provides no quantification. To justify this level of constitutional change, the proposer must state how many government decisions per year are successfully challenged on human rights grounds in these specific areas.

**2.** The proposal's plan for the day after repeal is a 'cross-departmental audit' and 'transitional guidance'. This is insufficient. It must specify the new legal framework for public authorities. What specific principles or statutes will guide, for example, a Home Office official's decision on an asylum case on the first Monday after the Human Rights Act is gone?

**3.** The findings state Parliament can already legislate to override the Human Rights Act's interpretive duty, as it did in the Victims and Prisoners Act 2024. The proposal does not explain why this existing power is insufficient to give Parliament the 'last word', which is the central problem it claims to solve.

**4.** The proposal does not address the legal vacuum created by repealing the Act. It must state what, if anything, will replace the positive obligation on public authorities under Section 6 of the HRA to act compatibly with rights. Without this, it is unclear what standard of conduct citizens can expect from the state.

**5.** The proposal's plan for consequential legislative amendments is a 'cross-departmental audit'. The evidence identifies at least 41 statutory instruments made under the HRA and 259 acts that borrow definitions from it. The proposal must provide a resourced plan for identifying, redrafting, and passing this remedial legislation, which appears to be a multi-year project in itself.

**6.** The proposal aims to stop UK courts applying the Convention, but the UK will remain bound by ECHR obligations for six months after denunciation under Article 58. The proposal needs a plan for how the government will ensure compliance during this period without the HRA's domestic legal framework, and how it will handle adverse Strasbourg judgments that land in this interim.

## SMART — carried from the build, not re-run

⚠⚠ **This pass rewrites the kernel.** `smartPass` calls `setProposal` on up to five fields,
and since the B18 fix those rewrites reach every marker that follows it. Re-running it here
would change the measure while the report is being written from it, so it is not re-run.

**DONE** — 2 models answered your own words (gemini-2.5-pro, claude-sonnet-5); 18 terms of art named — 12 confirmed by the corpus, 6 unverified; 16 cited findings from them; 8 of their points already covered, 7 not; verdict WEAK; 5 fields rewritten; read by gemini-2.5-pro

⚠ Produced by the build above, on a **complete kernel** (its own prompt: 1456 tokens).

<details><summary>The critique in full</summary>

```
VERDICT ON THE KERNEL: WEAK — The kernel identifies the basic steps but fails two critical tests. The pivotal obstacle is fluff ('political and institutional inertia' is a restatement of the problem, not an explanation for it). The coherent actions are not coherent; they are a repetitive list of the same three steps, failing the coordination test. The kernel misses the real, concrete obstacle: the ECHR is constitutionally embedded in the devolution settlements, and withdrawal would risk a crisis of the Union.

RUMELT TESTS IT FAILS:
- the pivotal obstacle is not fluff: The pivotal obstacle is named as 'political and institutional inertia'. This is an abstract restatement of the fact that the change has not happened, not a diagnosis of the specific forces that prevent it. It fails to name the concrete problem that must be solved.
- actions are coordinated, not merely listed: The 'Actions' section lists the same three steps (draft bill, pass bill, notify withdrawal) multiple times with slightly different wording. This is a list, not a coordinated set of actions with clear sequencing and concentration of effort.

WHAT THE CRITIQUE REWROTE:
- pivotalObstacle: The original obstacle was fluff. It described the effect (nothing has happened) without naming the cause. The rewrite identifies the specific, concrete barrier—the devolution statutes—that creates the 'inertia' and explains why the political will has been lacking. This moves from a vague complaint to a specific, high-stakes problem.
- summaryCoherentActions: The original was a classic example of a list substituting for a strategy. It failed the coordination test. The rewrite provides a sequenced, coherent set of actions that directly address the rewritten, more accurate pivotal obstacle.
- summaryDiagnosis: This change connects the diagnosis directly to the sharpened pivotal obstacle, making the entire kernel coherent. It explains *why* the problem is so intractable.

TERMS OF ART THE CORPUS CONFIRMED: Council of Europe, Human Rights Act 1998, Scotland Act 1998, Article 58 ECHR, Declaration of incompatibility, European Convention on Human Rights, European Convention on Human Rights (ECHR), European Court of Human Rights, European Court of Human Rights (ECtHR), Government of Wales Act 2006, Human Rights Act 1998, section 2, Human Rights Act 1998, section 3

NAMED BUT UNVERIFIED (never assert these): Bill of Rights Bill 2022, Article 58 of the ECHR, Belfast/Good Friday Agreement, Dualism, ECHR (Notification of Withdrawal) Bill (Bill 4242), Good Friday Agreement (Belfast Agreement)

POINTS OTHER MODELS MADE THAT WE DO NOT ADDRESS:
- The most significant practical obstacle to withdrawal is not the legal procedure itself, but the integration of the ECHR into the devolution settlements for Scotland, Wales, and Northern Ireland.
- Withdrawing from the ECHR would place the UK in breach of its obligations under the Good Friday Agreement, which explicitly requires ECHR incorporation.
- The actions required would involve the UK Parliament unilaterally altering the constitutional arrangements of the devolved nations, a move with profound implications for the stability of the Union.
- Withdrawal would affect numerous other international agreements, particularly with the EU on matters of security and data sharing, which presuppose ECHR membership.
- Unlike Brexit, which was preceded by a referendum, this proposal could be enacted through a simple majority in Parliament, despite its profound constitutional impact.
- The proposer's rejection of sequential reform is a substantive claim about litigation and political dynamics, not just a preference: it asserts that any right or mechanism left standing after partial reform will become the vehicle for reconstituting the status quo through litigation, which is a testable claim about how courts and campaigners behave, not a self-evident truth.
- Transitional arrangements for cases already decided or in progress under the HRA are not a peripheral drafting detail: without savings provisions, repeal creates immediate uncertainty for ongoing litigation and for individuals relying on findings already made against the UK by Strasbourg.

HOW HARD TO PASS: Extremely difficult. The proposal would trigger a constitutional crisis with the devolved nations, particularly Scotland and Northern Ireland. It would almost certainly be blocked in the House of Lords and face legal challenges. The most likely point of failure is the government backing down when faced with the reality of unilaterally rewriting the devolution settlements and the potential unravelling of the Good Friday Agreement.

MOST LIKELY TO GO WRONG: The government will be forced into a retreat when confronted with the choice between its policy goal and triggering a full-blown constitutional crisis with Scotland and breaching the Good Friday Agreement. The political cost of the latter will be deemed too high to bear.
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

⚠ Read live at export time. 12160 characters.

```
⚠ 10 of the fields below were drafted by this build and are awaiting the proposer's confirmation. Mark the WORDING, which is the kernel as it currently stands. Do not mark a field down for being unconfirmed.

TITLE: Restoring Parliamentary Supremacy over Human Rights Decisions

THE PROBLEM: Decisions on fundamental issues like borders, deportation, and protest, traditionally settled by elected politicians, are increasingly being determined by courts applying the ECHR, creating an unchangeable legal constraint on the elected government.

WHO IS AFFECTED: Not established, but includes potential political costs of perceived democratic erosion and the practical costs of legal challenges and delays to government policy implementation. The cost of withdrawing from the ECHR is also not quantified here. · Reduced ability of the elected government to implement policies supported by the electorate, leading to perceived democratic deficit and frustration with the political process. The proposer reports that this leads to 'endless legal obstruction'. · The proposer's account highlights specific policy areas (borders, deportation, protest) where judicial decisions are seen to override political will. Debates in Parliament (pwdata-westminster:westminster2025-11-05a:215) reflect concerns that ECHR membership constrains the government's ability to control borders and uphold Parliament's decisions. · The elected government and, by extension, the British electorate whose policy choices are constrained; individuals whose rights are adjudicated by courts rather than through legislative processes.

CAUSES:
- (MATERIAL) Decisions on fundamental issues are increasingly determined by courts applying the ECHR, creating an unchangeable legal constraint on the elected government.
- (MATERIAL) The Human Rights Act 1998 (HRA) incorporates the European Convention on Human Rights (ECHR) into domestic law, making Convention rights enforceable in UK courts.

ROOT CAUSE: The Human Rights Act 1998 (HRA) incorporates the European Convention on Human Rights (ECHR) into domestic law, making Convention rights enforceable in UK courts, thereby shifting the final arbiter of certain policy decisions from Parliament to the judiciary.

PIVOTAL OBSTACLE: The pivotal obstacle is the political establishment's inertia and risk aversion, which defaults to piecemeal reforms (like the failed 2022 Bill of Rights Bill or the notify-without-repeal Bill 4242) that are ultimately absorbed or defeated by the remaining legal structures. This inertia is reinforced by legal and administrative bodies who benefit from the stability and influence afforded by the current framework.

THE DIAGNOSIS: The Human Rights Act 1998, by incorporating the ECHR into domestic law, has shifted final authority on sensitive political questions (like borders, deportation, and protest) from the elected Parliament to the judiciary, particularly the European Court of Human Rights in Strasbourg. As the proposer states, the core issue is 'who has the last word'. This arrangement persists not because Parliament lacks the sovereign power to act, but because of a political and institutional preference for partial, ineffective solutions over a decisive break.

THE LEGAL LANDSCAPE AS STATED: Currently, the Human Rights Act 1998 (HRA) incorporates the European Convention on Human Rights into UK domestic law. Under the HRA, courts can issue a 'declaration of incompatibility' if they find that a provision of primary or subordinate legislation is incompatible with a Convention right (Human Rights Act 1998, s.4). Such a declaration does not affect the validity, continuing operation, or enforcement of the incompatible legislation, nor does it bind the parties to the proceedings (Human Rights Act 1998, s.4). Following a declaration of incompatibility, a Minister of the Crown may, if they consider there are 'compelling reasons', make a 'remedial order' by statutory instrument to amend the legislation to remove the incompatibility (AD and Lelia Joanne Armstrong and Department for Communities and Department for Work and Pensions; Margaret Kelly v Secretary of State for Work and Pensions). This mechanism is discretionary and does not oblige the Minister to act. Parliament retains the ultimate decision-making power on whether to remove the incompatibility (CASE OF GREENS AND M.T. v. THE UNITED KINGDOM). The Legislative and Regulatory Reform Act 2006 specifically states that an order under that Part cannot amend or repeal the Human Rights Act 1998 (Legislative and Regulatory Reform Act 2006, s.8). · The current system, as described, fails to satisfy the user's core concern because, while Parliament retains ultimate sovereignty, the process of judicial declarations of incompatibility and the subsequent discretionary ministerial action means that decisions on matters the user believes should be settled politically are still subject to judicial review and interpretation under the Convention. The user's complaint is not about the text of the Convention itself, but about the 'last word' and the perceived inability of elected governments to reverse judicial decisions. The current framework, even with remedial orders, does not provide the immediate and decisive political override the user desires. The existence of a discretion for the Minister to act on a declaration of incompatibility, rather than a direct legislative reversal, is seen as insufficient to restore what the user perceives as lost political control over these issues. The user's testimony highlights that various proposals for reform exist, indicating a widespread perception of shortcomings, but none of the ruled-out options fully address the desire for a complete severing of the link to the ECHR and its judicial oversight.

THE APPROACH: Initiate immediate and comprehensive legislative action to repeal the Human Rights Act 1998 and concurrently trigger Article 58 of the ECHR for denunciation.

THE GUIDING POLICY: Adopt a 'clean break' approach: use a single, comprehensive legislative act to simultaneously repeal the Human Rights Act 1998 and provide for the denunciation of the European Convention on Human Rights under Article 58. This approach is designed to be a single, irreversible event to overcome the cycle of failed partial reforms.

ACTIONS:
- Develop and implement a public communication strategy to explain the rationale for withdrawal, address concerns about human rights protections, and clarify the implications for individuals and public bodies. — Cabinet Office / Government Communications Service
- Secure parliamentary passage of the Repeal Bill through both Houses, engaging in public and parliamentary debate to build consensus and address concerns regarding the implications of withdrawal. — Government Whips' Office, relevant Cabinet Ministers, and MPs/Peers sponsoring the Bill
- Following Royal Assent, the Foreign, Commonwealth & Development Office (FCDO) formally notifies the Secretary General of the Council of Europe of the United Kingdom's denunciation of the European Convention on Human Rights under Article 58. — Foreign, Commonwealth & Development Office (FCDO)
- Develop and implement a communications strategy to explain the rationale for repeal and denunciation to the public, legal community, and international partners, managing expectations and mitigating potential negative perceptions. — Cabinet Office Communications Team, MoJ, and FCDO
- Draft and introduce an 'Act of Repeal and Denunciation' Bill to Parliament, explicitly repealing the Human Rights Act 1998 and providing for the formal notification of denunciation of the European Convention on Human Rights under Article 58. — Ministry of Justice (MoJ) and the Office of the Parliamentary Counsel
- Secure parliamentary passage of the 'Act of Repeal and Denunciation' through both Houses, requiring whips and party leadership to manage the legislative timetable and secure votes, potentially using the Parliament Acts if necessary. — Government Whips' Office and relevant Cabinet Ministers
- Following Royal Assent, the Foreign, Commonwealth & Development Office (FCDO) formally notifies the Secretary General of the Council of Europe of the United Kingdom's denunciation of the ECHR, specifying the effective date (which will be six months after notification, per Article 58(2)). — Foreign, Commonwealth & Development Office (FCDO)
- Develop and implement a public communication strategy to explain the rationale for repeal and denunciation, addressing concerns about human rights protections and clarifying the future domestic legal landscape, to manage public and international perception. — Cabinet Office and No. 10 Communications Team
- Draft and introduce a Bill to repeal the Human Rights Act 1998, ensuring it includes provisions for the orderly transition of ongoing cases and the cessation of domestic enforceability of ECHR rights. — Ministry of Justice (MoJ) and the Office of the Parliamentary Counsel
- Introduce a Bill to Parliament to repeal the Human Rights Act 1998 and provide for the denunciation of the European Convention on Human Rights under Article 58, specifying an effective date for withdrawal. — Ministry of Justice / Prime Minister's Office
- The Foreign, Commonwealth & Development Office (FCDO) formally notifies the Secretary General of the Council of Europe of the UK's denunciation of the ECHR, in accordance with the denunciation clause (Article 58) of the Convention, following parliamentary approval of the Bill. — Foreign, Commonwealth & Development Office
- Conduct a comprehensive review and legislative audit across government departments to identify and amend or repeal domestic legislation, policies, and practices that currently rely on or are shaped by the HRA and ECHR jurisprudence, ensuring consistency with the new legal framework. — Cabinet Office / Ministry of Justice (cross-departmental task force)
- Draft and introduce a Bill to Parliament, explicitly repealing the Human Rights Act 1998 in its entirety and providing the necessary statutory authority for the government to issue a notice of denunciation under Article 58 of the European Convention on Human Rights. — Ministry of Justice, working with the Office of the Parliamentary Counsel
- Secure parliamentary passage for the Bill, coordinating with government whips and party leadership to ensure sufficient support and manage potential opposition from within and outside Parliament. — Government Whips' Office, Ministry of Justice, Cabinet Office
- Following Royal Assent, the Foreign, Commonwealth & Development Office (FCDO) formally notifies the Secretary General of the Council of Europe of the United Kingdom's denunciation of the ECHR under Article 58, initiating the six-month withdrawal period. — Foreign, Commonwealth & Development Office
- During the six-month denunciation period, the Ministry of Justice, in consultation with other government departments, identifies and reviews all domestic legislation and administrative practices that currently rely on or refer to the HRA or ECHR, preparing for their cessation. — Ministry of Justice, Cabinet Office, relevant government departments

THE PLAN: 1. (Legislation) Draft and introduce a single 'Repeal and Denunciation Bill' that repeals the HRA 1998 in its entirety, provides statutory authority for denouncing the ECHR, and makes necessary consequential amendments to other legislation, including the devolution acts. (Ministry of Justice, Office of Parliamentary Counsel). 2. (Passage) Secure parliamentary passage of the Bill, managing opposition and potential use of the Parliament Acts. (Government Whips' Office). 3. (Denunciation) Upon Royal Assent, immediately notify the Secretary General of the Council of Europe of the UK's denunciation under Article 58, triggering the six-month withdrawal period. (Foreign, Commonwealth & Development Office). 4. (Transition) During the withdrawal period, conduct a cross-departmental audit to amend all domestic legislation, policies, and guidance reliant on the HRA/ECHR, and issue transitional guidance for the justice system. (Cabinet Office, Ministry of Justice).
```
