# M-02 — Equality Act 2010

*The four critique passes as they ran, on a complete kernel. Exported 2026-09-09 11:34 UTC. No model was called to produce this file.*

- idea `282806fe-ef6f-4022-843d-d9b733b8c38b`
- build `d5d23c9f-f058-49e8-ac61-2ea9bf041980` — **v2 DONE**, 2026-09-09 03:37 → 2026-09-09 03:48 UTC
- cost of the whole build: 33.99p

## Was the kernel complete when it was marked?

`KERNEL_CHECK` prompt size across every build of this measure. The kernel the four passes
read went from ten mostly-empty canonical columns to the drafted wording on 9 September;
a step in `tokensIn` is that change, visible without reading a word of the output.

| build | when | KERNEL_CHECK tokensIn | score |
|---|---|---|---|
| v1 DONE | 2026-09-02 14:18 | 1801 | 2 of 9 kernel tests passed; 7 failed and are on your list |
| v2 DONE | 2026-09-09 03:37 | 3549 | 8 of 9 kernel tests passed; 1 failed and are on your list |

## SMART

**DONE** — 2 models answered your own words (gemini-2.5-pro, claude-sonnet-5); 18 terms of art named — 11 confirmed by the corpus, 7 unverified; 24 cited findings from them; 11 of their points already covered, 7 not; verdict WEAK; 3 fields rewritten; read by gemini-2.5-pro

Model: `gemini-2.5-pro`, `claude-sonnet-5`, `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.5-pro` · 31264 in / 19091 out

Ran 03:43:06 → 03:48:08

<details><summary>carry <code>smart</code></summary>

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

### The 11 items it put on the list

**1. Northern Ireland Equality Duty Model**

The existence of a different equality duty model in Northern Ireland under the Northern Ireland Act 1998 shows that alternative approaches are possible within the UK. By not considering the distinct Northern Irish model, your proposal misses an opportunity to learn from a real-world alternative that has operated within the UK for decades.

*Raised by gemini-2.5-pro.*

**2. Future of the EHRC**

The logic of repealing the PSED also implies the abolition of its institutional champion, the Equality and Human Rights Commission. Your proposal tasks the EHRC with creating new guidance after its primary enforcement duty is removed, without addressing the fundamental question of whether the institution itself should continue to exist.

*Raised by gemini-2.5-pro.*

**3. Amending vs. Repealing PSED**

Amendment of s.149 short of repeal would likely reproduce the same problem in narrower form, since any replacement wording softer than full removal still leaves a standard for courts to elaborate case by case. Your proposal does not explain why full repeal is necessary over amendment, leaving it open to the criticism that a less drastic reform could achieve the same goals.

*Raised by claude-sonnet-5.*

**4. Specific Legislative Repeal Options**

There are at least three distinct legislative options in live political circulation right now (Bill 4189's narrow repeal, Badenoch's repeal-with-retained-protections, and Reform UK's reported whole-Act repeal), and the proposer's ask (whole-Act repeal) is closest to the third, not the first two — this needs to be stated explicitly because 'repeal the PSED' is currently being used by different politicians to mean different bills. By not situating your approach among current, real-world legislative proposals, you miss the chance to clarify your specific aims and distinguish them from other, similarly-named reforms.

*Raised by claude-sonnet-5.*

**5. Northern Ireland Model's Constitutional Basis**

Northern Ireland's s.75 is cited by the proposer as evidence the PSED is not universal even within the UK, but it should not be read as a workable template for GB repeal, since it is anchored in the Belfast/Good Friday Agreement's constitutional architecture rather than ordinary domestic equality policy. Without acknowledging the unique constitutional context of Northern Ireland's equality law, your proposal risks being seen as naive if it attempts to draw parallels or lessons from that model.

*Raised by claude-sonnet-5.*

**6. Judicial Role Beyond PSED**

For Women Scotland v Scottish Ministers demonstrates the proposer's underlying complaint in an adjacent area of equality law (sex/gender definition) even though it does not concern s.149 directly, showing the pattern of courts resolving contested value questions is not confined to the PSED alone — which suggests repealing s.149 alone would not fully address the proposer's stated objection to judicial rather than ministerial resolution of equality questions. Your diagnosis risks overstating the impact of repealing the PSED alone, as it fails to address that courts will continue to resolve contentious equality questions arising from other parts of the Act.

*Raised by claude-sonnet-5.*

**7. Orphaned Statutory Machinery Post-Repeal**

Repeal without consequential attention to the EHRC's enforcement remit and to cross-references in procurement and sectoral regulation would leave orphaned statutory machinery that courts would then have to interpret in the absence of the duty it was built to enforce, recreating a version of the same problem in a different guise. Your plan does not account for the complex knock-on effects of repeal, risking the creation of legal uncertainty and new avenues for judicial interpretation that could undermine your core objective.

*Raised by claude-sonnet-5.*

**8. *(no title recorded — not invented downstream)***

THE KERNEL FAILS A RUMELT TEST — The actions are a list, not a coordinated set. The 'ACTIONS' section contains multiple duplicated entries for drafting a bill, introducing it, and developing guidance. It presents a to-do list rather than a sequenced plan where each step enables the next. The text: "Draft a Bill to repeal Section 149 and Schedule 18 of the Equality Act 2010... Draft a Bill to repeal Section 149 and Schedule 18 of the Equality Act 2010..."

**9. *(no title recorded — not invented downstream)***

THE KERNEL FAILS A RUMELT TEST — The guiding policy rules nothing out. The 'THE GUIDING POLICY' section describes the chosen approach but does not explicitly state which alternative approaches were considered and rejected, and why. A policy that doesn't rule anything out is not a real choice. The text: "The guiding policy is to eliminate the statutory mandate of the Public Sector Equality Duty (PSED) by repealing Section 149 and Schedule 18 of the Equality Act 2010, thereby removing the legal and judicial incentives for public bodies to prioritise process-based compliance over core service delivery."

**10. *(no title recorded — not invented downstream)***

THE KERNEL FAILS A RUMELT TEST — The root cause is not distinct from the material causes. The stated root cause is a simple restatement of one of the material causes, describing what the PSED is. It fails to explain *why* a duty with these unintended consequences was created in the first place. The text: "ROOT CAUSE: The Public Sector Equality Duty (PSED) imposes a broad, anticipatory 'due regard' obligation on public authorities, requiring them to proactively consider equality issues in all functions."

**11. *(no title recorded — not invented downstream)***

A choice that may have been made the wrong way, on approach — scope — The chosen approach is full repeal of the PSED, leaving other anti-discrimination law intact. The proposer's own testimony notes a senior minister's position is repeal-and-replace. Simple repeal is politically much harder to defend against accusations of 'scrapping equality law'. The strategy may be forced into the 'repeal-and-replace' fork to be politically viable, even if the diagnosis suggests any replacement duty risks recreating the problem.

## KERNEL_CHECK

**DONE** — 8 of 9 kernel tests passed; 1 failed and are on your list — marked by gemini-2.5-pro

Model: `gemini-2.5-pro` · 3549 in / 1955 out

Ran 03:48:08 → 03:48:24

<details><summary>carry <code>verification</code></summary>

```
KERNEL COMPLIANCE (gemini-2.5-pro): This is a strong, coherent strategy kernel that passes all tests. The diagnosis is sharp, the guiding policy is a decisive choice with clear leverage on the pivotal obstacle, and the actions are coordinated to execute the policy. The only weakness is a repetition of actions in the `ACTIONS` list, which is corrected in the sequenced `THE PLAN`.
- FAILS "The actions cohere with each other": The actions are not a coordinated set but a list containing duplicate items. The same actions are listed twice, suggesting a failure to consolidate into a single, coherent plan. For example, drafting the bill is listed twice with slightly different implementers.
```

</details>

### The 1 item it put on the list

**1. *(no title recorded — not invented downstream)***

The strategy does not yet meet this test — The actions cohere with each other. The actions are not a coordinated set but a list containing duplicate items. The same actions are listed twice, suggesting a failure to consolidate into a single, coherent plan. For example, drafting the bill is listed twice with slightly different implementers. The text that fails it: "Draft a Bill to repeal Section 149 and Schedule 18 of the Equality Act 2010, explicitly stating that other substantive anti-discrimination provisions of the Act remain in force. — Cabinet Office Legal Advisers / Parliamentary Counsel... Draft a Bill to repeal Section 149 and Schedule 18 of the Equality Act 2010, ensuring that the substantive anti-discrimination provisions of the Act (e.g., direct and indirect discrimination, harassment, victimisation) remain intact. — Government Legal Department / Department for Business and Trade (or relevant sponsoring department)"

## LOGIC_CHECK

**DONE** — the chain from causes to actions holds; 0 defects in the argument — traced by gemini-2.5-pro

Model: `gemini-2.5-pro` · 2598 in / 1762 out

Ran 03:48:24 → 03:48:39

<details><summary>carry <code>verification</code></summary>

```
KERNEL COMPLIANCE (gemini-2.5-pro): This is a strong, coherent strategy kernel that passes all tests. The diagnosis is sharp, the guiding policy is a decisive choice with clear leverage on the pivotal obstacle, and the actions are coordinated to execute the policy. The only weakness is a repetition of actions in the `ACTIONS` list, which is corrected in the sequenced `THE PLAN`.
- FAILS "The actions cohere with each other": The actions are not a coordinated set but a list containing duplicate items. The same actions are listed twice, suggesting a failure to consolidate into a single, coherent plan. For example, drafting the bill is listed twice with slightly different implementers.
LOGIC (gemini-2.5-pro): the chain holds.
Read as: The problem is that public bodies are focusing on demonstrating compliance with the Public Sector Equality Duty (PSED) rather than on their core service delivery. This is caused by the PSED's broad, process-based 'due regard' obligation, which is enforced by courts, creating a risk-averse culture. The pivotal obstacle is therefore the statutory framework of the PSED itself, which incentivizes this focus on process over outcomes. The proposed approach is to abolish the PSED by repealing the relevant sections of the Equality Act 2010. The coherent actions all support this approach: drafting and passing a repeal bill, communicating the intent, reviewing old guidance, and issuing new guidance for the remaining anti-discrimination laws.
```

</details>

*No `DeepeningIssue` rows for this pass at runVersion 2.*

## ADVERSARIAL

**DONE** — 6 issues raised against the whole proposal, read by gemini-2.5-pro

Model: `gemini-2.5-pro`, `gemini-2.5-flash` · 15609 in / 1868 out

Ran 03:48:40 → 03:48:58

### The 6 items it put on the list

**1. *(no title recorded — not invented downstream)***

The proposal claims repealing the PSED will refocus public bodies on service delivery, but it does not specify the mechanism that will enforce this shift. If risk of litigation under remaining anti-discrimination law persists, what prevents a new compliance culture from forming around those duties?

**2. *(no title recorded — not invented downstream)***

The plan relies on the Equality and Human Rights Commission to develop and disseminate new guidance post-repeal. Given the EHRC's statutory purpose is to uphold equality law, what is the contingency if the Commission opposes the repeal and is unwilling to draft guidance to support it?

**3. *(no title recorded — not invented downstream)***

The core assertion is that the PSED has caused a shift from service delivery to compliance. The only quantified evidence is a 'tens of millions' spending figure from a report, but there is no estimate of what proportion of this spending is directly attributable to the PSED, versus other anti-discrimination laws or discretionary EDI initiatives.

**4. *(no title recorded — not invented downstream)***

The proposal omits the implementation costs. A cross-government review of all guidance, the development of new training, and its dissemination across the entire public sector represents a significant cost in staff time and resources which is not estimated or assigned to any budget.

**5. *(no title recorded — not invented downstream)***

The proposal does not explain what happens to the specific duties to publish data and set measurable objectives, which are created via secondary legislation under the authority of the PSED. Repealing the general duty in Section 149 alone may leave this secondary legislation legally orphaned and its status uncertain.

**6. *(no title recorded — not invented downstream)***

The proposal assumes that the 'substantive anti-discrimination provisions' of the Equality Act are a clear and stable backstop. However, after repealing the main proactive duty, how will the government prevent the courts from interpreting the remaining duties—such as preventing indirect discrimination—more expansively to fill the gap, potentially recreating a similar process-based duty through case law?

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
because it is the closest available reading of the input. 9585 characters.

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
