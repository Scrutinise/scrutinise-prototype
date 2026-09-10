# M-02 — Equality Act 2010

*The critique, per measure. Exported 2026-09-10 11:15 UTC.*

- idea `282806fe-ef6f-4022-843d-d9b733b8c38b`
- build `d5d23c9f-f058-49e8-ac61-2ea9bf041980` — **v2 DONE**, 2026-09-09 03:37 UTC · 33.99p

> **No model wrote anything to the database to produce this file, and no build was run.**
> `KERNEL_CHECK`, `LOGIC_CHECK` and `ADVERSARIAL` were re-run against the current kernel;
> `SMART` is carried from the build because re-running it rewrites the kernel.

## The headline, before anything else

| | |
|---|---|
| KERNEL_CHECK | 8 of 9 on all 2 readings |
| LOGIC_CHECK | ⚠⚠ **UNSTABLE — the verdict changed between readings** |
| Kernel the marker read | complete kernel, 3549 prompt tokens |

## Was the kernel complete when the build marked it?

`kernelText()` read the empty canonical `Idea` columns until 9 September, so a build marked
before that fix was handed a title and two lists. The prompt SIZE is the discriminator, and
it is a measurement rather than a date comparison.

| build | when | KERNEL_CHECK tokens in | what it read | score |
|---|---|---|---|---|
| v1 DONE | 2026-09-02 14:18 | 1801 | STARVED kernel | 2 of 9 kernel tests passed; 7 failed and are on your list |
| v2 DONE | 2026-09-09 03:37 | 3549 | complete kernel | 8 of 9 kernel tests passed; 1 failed and are on your list |
| **this export** | **just now** | **3549** | **complete kernel** | 8 of 9 on all 2 readings |

## KERNEL_CHECK — 2 readings of the same kernel

| reading | prompt tokens | score | failing criteria |
|---|---|---|---|
| 1 | 3549 | **8 of 9** | `ACTIONS_COHERE` |
| 2 | 3549 | **8 of 9** | `ACTIONS_COHERE` |

### The criteria that failed, and on how many readings

**`ACTIONS_COHERE` — The actions cohere with each other** · failed on 2 of 2 readings

> The actions are a list, not a coordinated plan. Several actions are duplicated with slightly different wording, which smears effort and shows a lack of concentration.

## LOGIC_CHECK — 2 readings

| reading | verdict | defects |
|---|---|---|
| 1 | ⚠ **does NOT hold** | 1 |
| 2 | the chain holds | 0 |

⚠⚠ **The verdict is not stable on this measure.** It changed between readings of a kernel
that did not change. A single verdict from this pass cannot be quoted as a property of the
kernel; what can be reported is that the readings disagree.

**Reading 1** — read as: *The problem is that public bodies are focusing on demonstrating compliance with the Public Sector Equality Duty (PSED) rather than on delivering their core services. This is caused by the PSED's broad, process-based 'due regard' obligation, which is enforced by courts through judicial review. The pivotal obstacle is this statutory framework itself, which creates a legal and cultural incentive to prioritize process over results to avoid legal challenges. The proposed approach is to abolish the PSED by repealing the relevant section of the Equality Act 2010. The coherent actions involve drafting and passing this repeal bill, and then updating guidance for public bodies to focus on their remaining anti-discrimination obligations and service outcomes.*

- **UNSUPPORTED** — The assertion that there are actors who benefit from 'reduced accountability for service outcomes' and have 'little incentive to deviate' is presented without evidence or reasoning. While the existence of a 'compliance industry' is supported elsewhere, the claim about a group benefiting from reduced service accountability is an unsupported assumption about motive.

**Reading 2** — read as: *The strategy argues that the Public Sector Equality Duty (PSED), being a broad, process-based legal obligation, is the root cause of a problem. This cause leads to the pivotal obstacle: a judicially-enforced framework that creates a legal and cultural incentive for public bodies to prioritize demonstrating compliance through paperwork over delivering their core services. The chosen approach is to directly remove this obstacle by abolishing the PSED entirely. The coherent actions logically follow this approach, consisting of drafting and passing a bill to repeal the specific section of the Equality Act 2010, and then updating all associated guidance and policies to reflect this change and refocus public bodies on their remaining anti-discrimination duties and service outcomes.*


## ADVERSARIAL — re-run, read-only

Model `gemini-2.5-pro` · 24144 in / 1653 out.

⚠ The prompt is the build's own: the SMART critique and the verification carry are read off
the stored pass log rather than re-derived, and the cost lines and the proposer's testimony
come through the same functions the pass uses.

**1.** The proposal claims the Public Sector Equality Duty leads to 'less effective or efficient public services,' but this is unquantified. It offers no specific examples of a service that was measurably degraded by resources being diverted to PSED compliance.

**2.** The proposal asserts that repealing the PSED will shift focus from process to outcomes. However, public bodies will still be liable for substantive discrimination claims. How does the new guidance prevent a similar 'compliance culture' from re-emerging to manage the remaining litigation risk?

**3.** The proposal doesn't address the risk of judicial substitution. If the PSED is repealed, what prevents courts from interpreting other duties, such as those under the Human Rights Act or the remaining Equality Act provisions, more broadly to require a similar 'due regard' process, thereby recreating the problem?

**4.** The proposal states the EHRC will develop new guidance, but Finding 61 notes its powers were curtailed, including its ability to issue statutory guidance on the PSED. Does the EHRC currently have the statutory authority and resources to create and enforce the new framework as envisioned?

**5.** The proposal contrasts the UK's PSED with Northern Ireland's Section 75 duty. However, Section 75 is noted as deriving from the Belfast/Good Friday Agreement. No assessment has been made of whether this constitutional underpinning makes the NI experience a valid or transferable model for a post-PSED Great Britain.

**6.** The proposal relies on a 2022 think tank report arguing the PSED is burdensome. This contradicts the last formal government review from 2013 which found the duty was 'operating as intended'. The proposal does not account for this discrepancy or explain why the 2013 finding is no longer valid.

## SMART — carried from the build, not re-run

⚠⚠ **This pass rewrites the kernel.** `smartPass` calls `setProposal` on up to five fields,
and since the B18 fix those rewrites reach every marker that follows it. Re-running it here
would change the measure while the report is being written from it, so it is not re-run.

**DONE** — 2 models answered your own words (gemini-2.5-pro, claude-sonnet-5); 18 terms of art named — 11 confirmed by the corpus, 7 unverified; 24 cited findings from them; 11 of their points already covered, 7 not; verdict WEAK; 3 fields rewritten; read by gemini-2.5-pro

⚠ Produced by the build above, on a **complete kernel** (its own prompt: 1428 tokens).

<details><summary>The critique in full</summary>

```
VERDICT ON THE KERNEL: WEAK — The diagnosis is sound, but the kernel fails on two key tests. The guiding policy does not explicitly rule out alternatives, making the choice less sharp than it should be. More seriously, the coherent actions are a repetitive list rather than a coordinated, sequenced plan, which is a classic sign of bad strategy.

RUMELT TESTS IT FAILS:
- The actions are a list, not a coordinated set: The 'ACTIONS' section contains multiple duplicated entries for drafting a bill, introducing it, and developing guidance. It presents a to-do list rather than a sequenced plan where each step enables the next.
- The guiding policy rules nothing out: The 'THE GUIDING POLICY' section describes the chosen approach but does not explicitly state which alternative approaches were considered and rejected, and why. A policy that doesn't rule anything out is not a real choice.
- The root cause is not distinct from the material causes: The stated root cause is a simple restatement of one of the material causes, describing what the PSED is. It fails to explain *why* a duty with these unintended consequences was created in the first place.

WHAT THE CRITIQUE REWROTE:
- summaryDiagnosis: A good diagnosis explains not just what is happening but why it arose. By framing the PSED as a well-intentioned reform with unforeseen consequences, it provides a stronger foundation for arguing that its removal is a necessary correction, not an attack on its original aims.
- whatItRulesOut: A strategy is a choice. Making the rejected alternatives explicit, with reasons, is what makes the guiding policy sharp and prevents it from being misinterpreted as a vague goal. It demonstrates that a deliberate choice has been made.
- summaryCoherentActions: Good strategy requires coordinated action, not just a list of activities. The rewrite imposes sequence and coherence, turning a simple to-do list into a plausible plan of execution where each step builds on the last.

TERMS OF ART THE CORPUS CONFIRMED: Judicial Review, Belfast/Good Friday Agreement, Due regard, Equality Act 2006, Equality Act 2010, Equality Act 2010, s.149, Equality and Human Rights Commission, Equality and Human Rights Commission (EHRC), Northern Ireland Act 1998, s.75, private member's bill procedure, Public Sector Equality Duty (PSED)

NAMED BUT UNVERIFIED (never assert these): Accounting Officer, Codes of Practice (EHRC), Equality Act 2010, s.217(3), Equality Act 2010, Schedule 18, For Women Scotland Ltd v The Scottish Ministers [2025] UKSC 16, Managing Public Money, Public Sector Equality Duty (Repeal) Bill (Bill 4189)

POINTS OTHER MODELS MADE THAT WE DO NOT ADDRESS:
- The existence of a different equality duty model in Northern Ireland under the Northern Ireland Act 1998 shows that alternative approaches are possible within the UK.
- The logic of repealing the PSED also implies the abolition of its institutional champion, the Equality and Human Rights Commission.
- Amendment of s.149 short of repeal would likely reproduce the same problem in narrower form, since any replacement wording softer than full removal still leaves a standard for courts to elaborate case by case.
- There are at least three distinct legislative options in live political circulation right now (Bill 4189's narrow repeal, Badenoch's repeal-with-retained-protections, and Reform UK's reported whole-Act repeal), and the proposer's ask (whole-Act repeal) is closest to the third, not the first two — this needs to be stated explicitly because 'repeal the PSED' is currently being used by different politicians to mean different bills.
- Northern Ireland's s.75 is cited by the proposer as evidence the PSED is not universal even within the UK, but it should not be read as a workable template for GB repeal, since it is anchored in the Belfast/Good Friday Agreement's constitutional architecture rather than ordinary domestic equality policy.
- For Women Scotland v Scottish Ministers demonstrates the proposer's underlying complaint in an adjacent area of equality law (sex/gender definition) even though it does not concern s.149 directly, showing the pattern of courts resolving contested value questions is not confined to the PSED alone — which suggests repealing s.149 alone would not fully address the proposer's stated objection to judicial rather than ministerial resolution of equality questions.
- Repeal without consequential attention to the EHRC's enforcement remit and to cross-references in procurement and sectoral regulation would leave orphaned statutory machinery that courts would then have to interpret in the absence of the duty it was built to enforce, recreating a version of the same problem in a different guise.

HOW HARD TO PASS: Extremely hard. The proposal will be characterised by opponents as a direct assault on equality and the rights of minorities, women, and disabled people. It will face a coordinated and well-funded campaign from NGOs, opposition parties, and public sector unions. It is most likely to die from a lack of political will in the face of this opposition, either before a bill is introduced or during its passage through the House of Lords, where it would be heavily amended or rejected.

MOST LIKELY TO GO WRONG: The government will lose control of the public narrative. The debate will be successfully shifted away from administrative reform and onto whether the government is hostile to equality itself, forcing a political retreat into a compromised position that fails to solve the core problem.
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

⚠ Read live at export time. 9585 characters.

```
⚠ 10 of the fields below were drafted by this build and are awaiting the proposer's confirmation. Mark the WORDING, which is the kernel as it currently stands. Do not mark a field down for being unconfirmed.

TITLE: Rebalancing Public Body Focus from Compliance to Service Delivery

THE PROBLEM: Public bodies are prioritising demonstrating compliance with equality obligations over their core service delivery, leading to a de-facto shift in administrative purpose not chosen by elected officials, because the open-ended nature of the Public Sector Equality Duty allows courts, rather than ministers, to determine compliance.

WHO IS AFFECTED: The PSED resulted in a one-off transitional cost of around £2.7 million to the public sector upon implementation (pwdata-lordswrans:lordswrans2011-07-11a:16). A 2022 Policy Exchange report found major public institutions are spending tens of millions annually on equality, diversity, and inclusion roles, training, and compliance measures (pwdata-westminster:westminster2025-09-10b:9). · Public bodies divert resources, time, and focus from their primary service delivery mandates to 'tick boxes' for PSED compliance, leading to less effective or efficient public services. The proposer reports this changes what public administration is for. There is also a risk of 'pre-emptive overreach' due to the broad framing of the duty, enabling particular ideologies to seep into institutions that should be neutral (pwdata-westminster:westminster2025-09-10b:9). · The proposer's account, parliamentary debate records (pwdata-lordswrans:lordswrans2011-07-11a:16, pwdata-westminster:westminster2025-09-10b:9), and reports on PSED implementation (committees-evidence:writtenevidence:22692:47281). · Public bodies and their employees (e.g., local councils, government departments, NHS trusts), and ultimately, the general public receiving services.

CAUSES:
- (MATERIAL) The Public Sector Equality Duty (PSED) imposes a broad, anticipatory 'due regard' obligation on public authorities, requiring them to proactively consider equality issues in all functions.
- (MATERIAL) The 'due regard' obligation is a duty of process, not outcome, requiring rigorous consideration of equality issues throughout policy development and execution.

ROOT CAUSE: The Public Sector Equality Duty (PSED) imposes a broad, anticipatory 'due regard' obligation on public authorities, requiring them to proactively consider equality issues in all functions.

PIVOTAL OBSTACLE: The statutory mandate of the PSED itself, coupled with the judicial interpretation of 'due regard' as a rigorous process, creates a legal and cultural incentive for public bodies to prioritise demonstrating compliance to courts over delivering core services, a situation from which those benefiting from the compliance industry or a reduced accountability for service outcomes have little incentive to deviate.

THE DIAGNOSIS: Public bodies prioritise demonstrating compliance with equality obligations over their core service delivery. This is an unintended consequence of the Public Sector Equality Duty (PSED), which was created to simplify previous duties but instead established a broad, process-based 'due regard' obligation. Because compliance is determined by courts through judicial review, not by ministers, a risk-averse culture has developed that focuses on creating legally defensible paper trails rather than on service outcomes. The pivotal obstacle is this judicially-enforced statutory framework, which incentivises process over results and benefits a compliance industry with no incentive to change.

THE LEGAL LANDSCAPE AS STATED: The current law governing this is Section 149 of the Equality Act 2010, known as the Public Sector Equality Duty (PSED) [primary-acts-2000plus:ukpga/2010/15:section-149]. This duty applies to public authorities and those exercising public functions, requiring them to have 'due regard' to the need to eliminate discrimination, advance equality of opportunity, and foster good relations. The Equality Act 2006 grants the Equality and Human Rights Commission (EHRC) powers to assess compliance and issue enforcement notices related to the PSED [primary-acts-2000plus:ukpga/2006/3:section-31, primary-acts-2000plus:ukpga/2006/3:section-32]. Judicial review is available to challenge decisions where a public authority has failed to comply with its PSED obligations [tna-caselaw:[2025] EWCA Civ 1868:1]. · The user's account and some evidence suggest the PSED, despite its intentions, may lead public bodies to prioritise demonstrating compliance over service delivery. This is supported by a 2022 Policy Exchange report mentioned in a debate, which found public institutions spending 'tens of millions of pounds annually on equality, diversity and inclusion roles, as well as training and compliance measures, all to ensure that they tick the right boxes against the public sector equality duty' [pwdata-westminster:westminster2025-09-10b:9]. The broad framing of the duty and its requirement for anticipatory compliance are cited as fostering a 'culture of pre-emptive overreach' [pwdata-westminster:westminster2025-09-10b:9]. Furthermore, while the PSED aims to embed equality considerations, some evidence suggests that compliance with guidance is the 'exception rather than the rule,' leading to a deterioration in the socio-economic position of certain groups since 2010 [committees-evidence:writtenevidence:22692:47281]. The burden of enforcement often falls on individuals to challenge discrimination, rather than proactive action by public bodies [committees-reports:publication:3440:32850-0029]. The core failure, as articulated by the user, is that the open-ended nature of the obligations shifts the ultimate arbiter of compliance from elected ministers to the courts, fundamentally altering the accountability structure of public administration.

THE APPROACH: Abolish the Public Sector Equality Duty (PSED) entirely while retaining substantive anti-discrimination protections.

THE GUIDING POLICY: The guiding policy is to eliminate the statutory mandate of the Public Sector Equality Duty (PSED) by repealing Section 149 and Schedule 18 of the Equality Act 2010, thereby removing the legal and judicial incentives for public bodies to prioritise process-based compliance over core service delivery. This approach aims to redirect public administration's focus back to service outcomes and ministerial accountability, while explicitly preserving fundamental anti-discrimination rights.

ACTIONS:
- Draft a Bill to repeal Section 149 and Schedule 18 of the Equality Act 2010, explicitly stating that other substantive anti-discrimination provisions of the Act remain in force. — Cabinet Office Legal Advisers / Parliamentary Counsel
- Introduce the Bill to Parliament, ensuring clear communication that the intent is to remove the process-oriented Public Sector Equality Duty, not to diminish fundamental anti-discrimination rights. — Relevant Secretary of State (e.g., Minister for Women and Equalities)
- Conduct a review of existing public body guidance and internal policies that reference the PSED, initiating a process to update or remove them post-repeal. — Cabinet Office / Department for Levelling Up, Housing and Communities (DLUHC)
- Develop and disseminate new guidance for public bodies clarifying their remaining equality obligations under other parts of the Equality Act 2010 and other relevant legislation, focusing on outcomes rather than process. — Equality and Human Rights Commission (EHRC) / Cabinet Office
- Draft a Bill to repeal Section 149 and Schedule 18 of the Equality Act 2010, ensuring that the substantive anti-discrimination provisions of the Act (e.g., direct and indirect discrimination, harassment, victimisation) remain intact. — Government Legal Department / Department for Business and Trade (or relevant sponsoring department)
- Introduce the Repeal Bill to Parliament, clearly articulating the rationale for repeal as shifting focus back to core service delivery and ministerial accountability, while reaffirming commitment to anti-discrimination principles. — Leader of the House of Commons / Sponsoring Minister
- Develop and disseminate clear guidance for public bodies, post-repeal, on how to meet their remaining anti-discrimination obligations under the Equality Act 2010 without the 'due regard' duty, emphasising a focus on service outcomes. — Equality and Human Rights Commission (EHRC) / Cabinet Office
- Review and update internal policies and training within public bodies to reflect the removal of the PSED, re-orienting staff towards service delivery metrics and clear ministerial accountability for outcomes. — Individual Public Bodies (e.g., Local Authorities, NHS Trusts, Government Departments)

THE PLAN: 1. Draft and introduce a single Repeal Bill to remove Section 149 and Schedule 18 of the Equality Act 2010, with clear messaging that it targets process-based duties, not substantive anti-discrimination rights (Cabinet Office Legal Advisers, Sponsoring Minister). 2. In parallel, conduct a cross-government review of all guidance and internal policies that reference the PSED, drafting replacement guidance focused on remaining statutory obligations and service outcomes (Cabinet Office, EHRC). 3. Following Royal Assent, disseminate the new guidance and direct all public bodies to update their internal processes and training to reflect the removal of the PSED and re-orient staff towards ministerial accountability for service delivery (DLUHC, Individual Public Bodies).
```
