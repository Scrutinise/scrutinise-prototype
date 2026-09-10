# M-04 — The arm's-length body estate

*The critique, per measure. Exported 2026-09-10 11:19 UTC.*

- idea `b9628162-b1b8-4a9d-8128-749d67c2ace3`
- build `485aafaf-3e45-463d-a9b4-ca6439a4692a` — **v1 DONE**, 2026-09-02 14:45 UTC · 36.22p

> **No model wrote anything to the database to produce this file, and no build was run.**
> `KERNEL_CHECK`, `LOGIC_CHECK` and `ADVERSARIAL` were re-run against the current kernel;
> `SMART` is carried from the build because re-running it rewrites the kernel.

## The headline, before anything else

| | |
|---|---|
| KERNEL_CHECK | 9 of 9 on all 2 readings |
| LOGIC_CHECK | ⚠⚠ **UNSTABLE — the verdict changed between readings** |
| Kernel the marker read | complete kernel, 3467 prompt tokens |

## Was the kernel complete when the build marked it?

`kernelText()` read the empty canonical `Idea` columns until 9 September, so a build marked
before that fix was handed a title and two lists. The prompt SIZE is the discriminator, and
it is a measurement rather than a date comparison.

| build | when | KERNEL_CHECK tokens in | what it read | score |
|---|---|---|---|---|
| v1 DONE | 2026-09-02 14:45 | 1809 | STARVED kernel | 2 of 9 kernel tests passed; 7 failed and are on your list |
| **this export** | **just now** | **3467** | **complete kernel** | 9 of 9 on all 2 readings |

## KERNEL_CHECK — 2 readings of the same kernel

| reading | prompt tokens | score | failing criteria |
|---|---|---|---|
| 1 | 3467 | **9 of 9** | — |
| 2 | 3467 | **9 of 9** | — |

*Every criterion passed on every reading.*

## LOGIC_CHECK — 2 readings

| reading | verdict | defects |
|---|---|---|
| 1 | ⚠ **does NOT hold** | 1 |
| 2 | the chain holds | 0 |

⚠⚠ **The verdict is not stable on this measure.** It changed between readings of a kernel
that did not change. A single verdict from this pass cannot be quoted as a property of the
kernel; what can be reported is that the readings disagree.

**Reading 1** — read as: *The diagnosis posits that the accountability gap for arm's-length bodies is not an accident but a deliberate feature of a fragmented system, which benefits ministers and officials by diffusing responsibility. This leads to the pivotal obstacle: an entrenched political and administrative culture that resists change because it benefits from the status quo. The guiding policy directly confronts this by attacking the fragmentation itself, proposing a single, powerful law to force a systematic review of every body against mandatory templates, with a default presumption of abolition. This policy is then executed through actions to pass this new Act, create a unit to run the review cycle, and establish parliamentary oversight.*

- **BROKEN_LINK** — This action does not directly execute the guiding policy. The policy is to create an internal statutory mechanism to overcome the obstacle of an 'entrenched political and administrative culture'. A public information campaign is an external communication effort that does not act on this internal obstacle or the policy chosen to address it.

**Reading 2** — read as: *The problem is that arm's-length bodies (ALBs) are unaccountable because the legal framework diffuses responsibility, making ministers accountable in theory but ALB decision-makers unaccountable in practice. This situation is caused by a fragmented legal landscape where each body has its own statute. The diagnosis identifies the pivotal obstacle as the entrenched political and administrative culture that benefits from this lack of clarity, as it shields ministers from blame and gives officials autonomy. The guiding policy is to attack this fragmentation directly by creating a single, powerful legal mechanism that forces a choice about each ALB's status on a rolling timetable, with a default presumption of abolition. The actions directly implement this approach by passing a new Act to create this mechanism, establishing the mandatory review cycle, and giving a parliamentary committee oversight of the new process.*


## ADVERSARIAL — re-run, read-only

Model `gemini-2.5-pro` · 15287 in / 1980 out.

⚠ The prompt is the build's own: the SMART critique and the verification carry are read off
the stored pass log rather than re-derived, and the cost lines and the proposer's testimony
come through the same functions the pass uses.

**1.** The 'strict statutory criteria' for justifying an ALB's continued existence are the heart of the mechanism, but they are completely undefined. Opponents will capture the drafting process to make these criteria so broad that everything qualifies, rendering the entire exercise moot.

**2.** The proposal fails to distinguish between ALBs where independence is a convenience and those where it is a constitutional necessity, such as bodies with judicial or quasi-judicial functions. Lumping the Sentencing Council in with all other ALBs ignores that its independence from ministers is a widely supported feature, not a bug.

**3.** The plan creates a new Cabinet Office review unit but does not address what happens to the existing Cabinet Office and departmental machinery that already oversees ALBs. This risks creating a parallel structure and bureaucratic conflict rather than a streamlined system.

**4.** The proposal's costings cover only the central administrative setup. It omits the substantial transitional costs of abolition, absorption, or privatisation, such as staff redundancies, asset transfers, and potential legal challenges, which will fall on individual departments.

**5.** The new Act provides a 'standing power' for ministers, but the diagnosis states ministers benefit from the current ambiguity. What mechanism forces a reluctant minister to use this power to abolish a body providing them with a political shield, especially if PACAC oversight has no statutory teeth to compel action?

**6.** The proposal is based on the premise that decision-makers 'cannot be removed'. While direct electoral accountability is absent, it overlooks existing mechanisms for removal, such as for misconduct or poor performance, and the role of the Commissioner for Public Appointments in overseeing board appointments and reappointments. The case for new powers must address why these existing levers are insufficient.

## SMART — carried from the build, not re-run

⚠⚠ **This pass rewrites the kernel.** `smartPass` calls `setProposal` on up to five fields,
and since the B18 fix those rewrites reach every marker that follows it. Re-running it here
would change the measure while the report is being written from it, so it is not re-run.

**DONE** — 2 models answered your own words (gemini-2.5-pro, claude-sonnet-5); 10 terms of art named — 6 confirmed by the corpus, 4 unverified; 11 cited findings from them; 8 of their points already covered, 10 not; verdict WEAK; 5 fields rewritten; read by gemini-2.5-pro

⚠ Produced by the build above, on a **STARVED kernel** (its own prompt: 1266 tokens).

<details><summary>The critique in full</summary>

```
VERDICT ON THE KERNEL: WEAK — This is a kernel, but it fails on key tests. The diagnosis is an abstract restatement of the problem rather than a sharp insight into the underlying dynamics. The actions are a generic list of government processes ('draft a bill', 'create a task force') that lack specific costs, sequencing, or a clear theory of change. It correctly identifies the need for an omnibus approach but doesn't build a sufficiently robust policy or set of actions to overcome the inertia it also correctly identifies as the pivotal obstacle.

RUMELT TESTS IT FAILS:
- A diagnosis is a simplification, not an inventory or a restatement: The diagnosis restates the problem in more abstract terms ('making direct accountability... difficult to establish') rather than explaining the dynamic that creates and sustains it.
- Actions must be coordinated, not merely listed: The actions are a list of procedural steps, not a coordinated set of actions designed to concentrate force. They lack costs, specific timelines, and an explanation of how they overcome the identified obstacle of administrative inertia.
- The guiding policy rules nothing out: The kernel does not state what its chosen approach rules out. While the internal decision log shows alternatives were considered, this is not reflected in the policy itself, making it seem like the only possible option rather than a deliberate choice.

WHAT THE CRITIQUE REWROTE:
- summaryDiagnosis: The original diagnosis was a weak restatement of the problem. The rewrite names who benefits from the status quo (ministers and officials), turning it from a passive 'problem' into an active system with beneficiaries, which is a much stronger basis for strategy.
- summaryGuidingPolicy: The original was a goal, not an approach. The rewrite specifies the 'how' – a forcing mechanism that attacks the root of the problem (fragmentation) rather than just stating the desired end state. This provides a clear guide for action.
- whatItRulesOut: A guiding policy that rules nothing out is not a strategy. Making the rejected alternatives explicit defines the policy by what it is not, sharpening the choice that has been made.
- summaryCoherentActions: Bad strategy mistakes goals or generic processes for actions. The rewrite proposes concrete, coordinated steps that directly implement the guiding policy and address the pivotal obstacle, including the crucial details of cost and responsibility.

TERMS OF ART THE CORPUS CONFIRMED: Accounting Officer, Commissioner for Public Appointments, Framework Document, Ministerial Responsibility, The Cabinet Office, The Haldane Principle

NAMED BUT UNVERIFIED (never assert these): Arm's-Length Body (ALB), Public Accounts Committee (PAC), Sentencing Council for England and Wales, The Osmotherly Rules

POINTS OTHER MODELS MADE THAT WE DO NOT ADDRESS:
- The existence of arm's-length bodies is a deliberate trade-off, sacrificing direct ministerial control for perceived gains in expertise, impartiality, or efficiency.
- Parliamentary select committees are the most appropriate venue for scrutinising ALB performance, but they need to be empowered with clearer mandates and processes to do so systematically.
- Many of the necessary reforms can be implemented through executive action, without requiring primary legislation.
- The distinction between statutory bodies (like the Sentencing Council) and non-statutory, self-regulatory bodies (like the Advertising Standards Authority) is crucial, as the government has no direct power to abolish the latter.
- <item>Rejecting body-by-body review is right as far as it goes, but the alternative cannot be a single Act naming 400 bodies either; both extremes fail for the same reason (no forcing mechanism versus unworkable legislative bulk), so the answer has to be a standing statutory machine, not a one-off Act.</item>
- <item>The Sentencing Council example cuts against blanket abolition: some independence is constitutionally load-bearing (keeping day-to-day sentencing decisions away from ministerial populism), so the reform needs a genuine-independence carve-out with an explicit override power, not uniform absorption.</item>
- <item>The Advertising Standards Authority is a different species of problem from the Sentencing Council — it is not even statutory, it is self-regulation with government backing — so "abolish, privatise or absorb" will not be a single operation even within the proposer's own two examples.</item>
- <item>The 2010 "bonfire of the quangos" already tested the proposer's preferred remedy at scale and mostly failed to stick, because the reclassification power existed but nothing forced departments to use it against their own bodies; any new version must fix that specific failure, not repeat it.</item>
- <item>The accountability gap the proposer describes is best understood as a shield ministers want, not an oversight nobody noticed — which is why voluntary reform proposals from within Whitehall are unlikely to originate this change, and it favours a Parliament-led or externally forced instrument (PACAC, NAO) over a Cabinet Office-led one.</item>
- <item>Because each body has its own founding statute, full legal tidiness (repealing/amending each founding Act individually) is incompatible with the pace of reform sought; some legal untidiness (a standing SI power under enabling primary legislation) has to be accepted as the price of tractability.</item>

HOW HARD TO PASS: Extremely hard. This is a fundamental 'machinery of government' reform that challenges the established way power is exercised and accountability is diffused. It will face intense resistance from every government department, the civil service leadership, and the ALBs themselves. It is most likely to die at the Cabinet committee stage, where multiple Secretaries of State will object to losing the flexibility and political shielding their ALBs provide.

MOST LIKELY TO GO WRONG: The reform will be captured by the very system it seeks to change. The new Act will be passed, but the 'strict statutory criteria' for justifying an ALB's existence will be drafted by the civil service to be so broad and flexible that every Accounting Officer can easily certify their bodies, resulting in a huge administrative exercise with no actual change in accountability.
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

⚠ Read live at export time. 10058 characters.

```
⚠ 10 of the fields below were drafted by this build and are awaiting the proposer's confirmation. Mark the WORDING, which is the kernel as it currently stands. Do not mark a field down for being unconfirmed.

TITLE: Reasserting Democratic Accountability over Arm's-Length Bodies

THE PROBLEM: A large number of arm's-length bodies make decisions with significant public consequences without clear mechanisms for democratic accountability, leading to a situation where decision-makers cannot be removed for their actions.

WHO IS AFFECTED: The cost of unaccountable decisions is not easily quantifiable in monetary terms but includes reduced public confidence, potential for policy failures that are difficult to correct, and the administrative overhead of managing a complex and opaque ALB landscape. The Public Bodies Reform Programme aimed for cumulative administrative spend reductions of £2.6bn by March 2015, suggesting significant financial implications related to ALB efficiency and oversight (Special Report: 6th Special Report - Who's accountable? Relationships between Government and arm's-length bodies: Government Response to the Committee's First Report of Session 2014-15 — Public Administration Committee, 2015-03-20). · Lack of recourse for citizens against decisions made by unelected and unremovable officials; erosion of public trust in government and democratic processes; potential for inconsistent or unaccountable policy implementation. · The proposer's direct account of the problem, citing the Sentencing Council and advertising standards as examples. Parliamentary committees have repeatedly highlighted that accountability for ALBs remains 'confused, overlapping and neglected,' with inconsistent organisational forms and blurred responsibilities (Report: 1st Report - Who's accountable? Relationships between Government and arm's-length bodies — Public Administration Committee, 2014-11-10, Summary, para 13). The Public Accounts Committee noted that ALBs are responsible for spending approximately £265bn a year, emphasizing the scale of their public impact (Report: Eighteenth Report - Government’s delivery through arm’s-length bodies — Public Accounts Committee, 2021-09-24). · The electorate, citizens subject to decisions by ALBs (e.g., those affected by sentencing guidance or advertising standards), and ministers who bear ultimate but often indirect responsibility.

CAUSES:
- (MATERIAL) The legal and constitutional framework assigns accountability for public functions primarily to Ministers, even when delegated, making direct accountability for ALB decision-makers difficult to establish.
- (CONTRIBUTORY) A fragmented legal landscape for ALBs, with each body established by its own specific statute or statutory instrument.
- (CONTRIBUTORY) The Public Bodies Act 2011, while providing powers to abolish, merge, or modify ALBs, includes deliberate restrictions on ministerial powers for independent functions.

ROOT CAUSE: The legal and constitutional framework assigns accountability for public functions primarily to Ministers, even when delegated, making direct accountability for ALB decision-makers difficult to establish.

PIVOTAL OBSTACLE: The entrenched political and administrative culture that benefits from the status quo. Ministers gain a shield from accountability, while departments and ALBs retain autonomy. Overcoming this requires a mechanism that forces a choice and reverses the current default, where continued existence is easier than abolition.

THE DIAGNOSIS: The accountability gap is not an accident but a design feature. The ALB estate is fragmented across hundreds of individual statutes precisely because this diffusion of responsibility benefits both ministers, who can delegate blame for controversial decisions, and officials, who can exercise power without direct accountability. This deliberate fragmentation is why piecemeal reform always fails; there is no single lever to pull.

THE LEGAL LANDSCAPE AS STATED: The primary legal framework for the abolition or merger of arm's-length bodies is the Public Bodies Act 2011. This Act grants ministers the power to abolish bodies listed in Schedule 1 and transfer their functions, or merge groups of bodies listed in Schedule 2 (Public Bodies Act 2011, s.1, s.2). However, this power is not indefinite; each entry in the schedules has a five-year sunset clause (Public Bodies Act 2011, s.12). For bodies not covered by the 2011 Act, abolition or significant structural change would typically require specific primary legislation, as each body often has its own founding statute or statutory instrument, as reported by the proposer. The 'Carltona principle' generally allows ministers to delegate decision-making authority to officials within their department, with the minister remaining constitutionally responsible to Parliament for those decisions (Director of Public Prosecutions v Haw, 2007-08-06; Austin v Chief Constable of Surrey Police, 2010-02-18). However, this principle applies to departmental officials, not necessarily to the independent decision-makers within arm's-length bodies, where accountability lines are often described as 'confused' (Report: 1st Report - Who's accountable? Relationships between Government and arm's-length bodies — Public Administration Committee, 2014-11-10, Summary). · The current framework fails to address the user's core concern that decision-makers within arm's-length bodies cannot be removed for their decisions, leading to a perceived lack of direct accountability. While the Public Bodies Act 2011 provides a mechanism for *structural* reform (abolition, merger, function transfer), it is a time-limited power and does not inherently resolve the ongoing accountability challenge for the existing estate (Public Bodies Act 2011, s.12). The Act allows for the transfer of functions to ministers, which could increase direct accountability, but it doesn't mandate this. The problem is exacerbated by the sheer number and variety of these bodies, each with its own statutory basis, making a wholesale, consistent approach to accountability difficult without a broader legislative intervention. Parliamentary committees have consistently noted the 'confused, overlapping and neglected' accountability arrangements and the lack of clarity on who is responsible for what (Report: 1st Report - Who's accountable? Relationships between Government and arm's-length bodies — Public Administration Committee, 2014-11-10, Summary; Report: 21st Report - Departments' oversight of arm's-length bodies — Public Accounts Committee, 2016-10-21). This confusion means that even with existing oversight mechanisms, the direct line of accountability from decision-maker to minister to Parliament to electorate, which the proposer seeks, is often absent or obscured. The 'Carltona principle' ensures ministerial accountability for delegated decisions within a department, but it doesn't automatically extend to independent bodies where the power to make decisions is conferred directly on the body itself by statute, rather than being delegated by a minister. The problem is not just about the existence of these bodies, but the perceived inability to hold individual decision-makers within them directly accountable through removal.

THE APPROACH: Utilise and extend the Public Bodies Act 2011 to establish a unified accountability framework, focusing on redefining ministerial responsibility for ALB decisions and mandating direct accountability mechanisms for ALB decision-makers, while addressing the time-limited nature of its powers.

THE GUIDING POLICY: Attack the fragmentation itself, not the individual bodies. Create a single, powerful statutory mechanism that forces every ALB to be sorted into one of a few mandatory accountability templates (e.g., full absorption, statutory body with ministerial override, privatisation, or abolition) on a fixed, rolling timetable.

ACTIONS:
- Draft and introduce an 'Arm's-Length Body Accountability Bill' that establishes a unified statutory framework for ministerial oversight and direct accountability of ALB decision-makers, including provisions for removal based on performance or policy divergence. — Ministry of Justice / Cabinet Office
- Establish a cross-departmental task force, led by the Cabinet Office, to identify all existing ALBs and categorize them by function and current accountability mechanisms, preparing a schedule for their integration into the new framework. — Cabinet Office
- Develop and consult on new departmental guidance for Ministers and senior civil servants, clarifying their enhanced responsibilities for ALB outcomes and the process for exercising powers of intervention and removal under the new legislation. — Cabinet Office / Departmental Permanent Secretaries
- Implement a public information campaign explaining the new accountability framework, its benefits for democratic oversight, and the process for public engagement with ALB decisions, managed by the relevant departmental communications teams. — Government Communications Service / Departmental Communications Teams

THE PLAN: 1. Pass an 'Accountability of Public Bodies Act' to create a standing power for ministers to reform ALBs via secondary legislation, superseding the fragmented founding statutes. (Cost: £2-3m in legislative and legal counsel time; Lead: Cabinet Office, Ministry of Justice). 2. The Act will mandate a rolling 5-year review cycle for all ALBs, run by a new Cabinet Office/Treasury unit, with a default presumption of abolition or absorption unless an Accounting Officer personally certifies its case for arm's-length status against strict statutory criteria. (Cost: £5-7m annually for the review unit; Lead: Cabinet Office). 3. The Public Administration and Constitutional Affairs Committee (PACAC) will be given a statutory oversight role, required to report annually on the progress of the review cycle and the justifications provided for retaining ALBs. (Cost: Negligible direct cost, redirects existing resources; Lead: PACAC).
```
