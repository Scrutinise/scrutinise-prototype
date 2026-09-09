# CCW-B21a — the kernel and logic checks, run standalone on all twelve measures

*Generated 2026-09-09 13:33 UTC. Marked by `gemini-2.5-pro`.*

> **Nothing was written to the database and no build was run.** These two passes take a
> kernel string and a model, so they need neither. The pass in the product also writes
> `DeepeningIssue` rows against a run version; CCW is building Appendix B out of those
> rows, so this harness deliberately does not touch them.

⚠ **This is a harness around the product's own functions, not a copy of them.**
`kernelText`, `runKernelCompliance`, `runLogicCheck`, `verifyModel`, `KERNEL_TESTS`,
`complianceIssueText` and `logicIssueText` are imported. Only the glue between them is
written here — and the control below is what tests the glue.

## ⚠⚠ The control — read this before the table

M-01, M-02 and M-06 have already had these passes run on a complete kernel by a real
build. **The prompt size is deterministic given the same kernel**, so if this harness
feeds the marker the same input a build does, the token counts match. The score may move
a little — the model is not deterministic, and the live kernel can have changed since the
build. **A token mismatch means the glue is wrong and the other nine must not be believed.**

| measure | build tokens | harness tokens | Δ | build score | harness score |
|---|---|---|---|---|---|
| M-01 | 3829 | 3868 | +39 | 8 of 9 | 8 of 9 |
| M-02 | 3549 | 3549 | 0 | 8 of 9 | 8 of 9 |
| M-06 | 3332 | 3332 | 0 | 6 of 9 | 6 of 9 |

✔ **The control holds.** The harness reads the same kernel the build read, so the nine measures below stand on the same footing as the three.

---

## ⚠⚠ Is any of this reproducible? The kernel score is. The logic verdict is not.

Three measures have now been marked several times on a kernel that did not change between
readings — once by a real build and twice by this harness — and this run adds another.
**The prompt token counts are identical, so these are readings of the same input.**

| Measure | When | By | KERNEL_CHECK | LOGIC_CHECK |
|---|---|---|---|---|
| M-01 | 09 Sep 04:16 | build v4 | 8 of 9 | holds, 0 defects |
| M-01 | 09 Sep 13:2x | harness run 1 | 8 of 9 | ⚠ does NOT hold, 2 defects |
| M-01 | 09 Sep 13:4x | harness run 2 | 8 of 9 | holds, 0 defects |
| M-01 | **this run** | harness | **8 of 9** | **holds, 0 defects** |
| M-02 | 09 Sep 03:48 | build v2 | 8 of 9 | holds, 0 defects |
| M-02 | 09 Sep 13:2x | harness run 1 | 8 of 9 | holds, 0 defects |
| M-02 | 09 Sep 13:4x | harness run 2 | 9 of 9 | holds, 0 defects |
| M-02 | **this run** | harness | **8 of 9** | **holds, 0 defects** |
| M-06 | 09 Sep 04:02 | build v2 | 6 of 9 | ⚠ does NOT hold, 4 defects |
| M-06 | 09 Sep 13:2x | harness run 1 | 6 of 9 | ⚠ does NOT hold, 3 defects |
| M-06 | 09 Sep 13:4x | harness run 2 | 6 of 9 | ⚠ does NOT hold, 3 defects |
| M-06 | **this run** | harness | **6 of 9** | **⚠ does NOT hold, 3 defect(s)** |

**Read the M-01 rows.** On a kernel that did not change, the chain verdict has gone *holds*
→ *does NOT hold* → *holds*. `KERNEL_CHECK` over the same readings never moved by more than
one test.

⚠⚠ **CCW-B21 says the claim that the system argues against itself rests on `LOGIC_CHECK`.**
On this evidence a single `LOGIC_CHECK` verdict cannot carry that claim: the pass is
reporting something real about difficult arguments, but *"the chain does not hold"* is not a
stable property of a kernel the way *"6 of 9"* is. If the report needs the claim, it needs
the pass run several times per measure and the SPREAD printed — not one verdict quoted as a
finding.

⚠ The defect *counts* move too (M-06: 4 → 3 → 3), so a count of defects is not a measurement
either. What has been stable on M-06 is the DIRECTION — every reading says the chain fails.

---

## Summary

| Measure | Title | Kernel chars | KERNEL_CHECK | LOGIC_CHECK |
|---|---|---|---|---|
| M-01 | Human Rights Act 1998 and the European Convention on Human Rights | 12,160 | **8 of 9** | holds, 0 defects |
| M-02 | Equality Act 2010 | 9,585 | **8 of 9** | holds, 0 defects |
| M-03 **new** | The United Kingdom Supreme Court | 7,396 | **9 of 9** | ⚠ **does NOT hold**, 2 defect(s) |
| M-04 **new** | The arm's-length body estate | 10,058 | **9 of 9** | holds, 0 defects |
| M-05 **new** | Judicial review of executive decisions | 7,517 | **8 of 9** | holds, 0 defects |
| M-06 | The permanent, appointed civil service | 9,673 | **6 of 9** | ⚠ **does NOT hold**, 3 defect(s) |
| M-07 **new** | Operational independence of the Bank of England | 7,794 | **7 of 9** | ⚠ **does NOT hold**, 1 defect(s) |
| M-08 **new** | Diversity, equity and inclusion practice in the civil service | 8,607 | **9 of 9** | holds, 0 defects |
| M-09 **new** | Gender self-identification | 7,923 | **7 of 9** | ⚠ **does NOT hold**, 2 defect(s) |
| M-10 **new** | Publicly funded charities campaigning on government policy | 7,606 | **9 of 9** | holds, 0 defects |
| M-11 **new** | The Sentencing Council and sentencing guidelines | 7,013 | **9 of 9** | holds, 0 defects |
| M-12 **new** | The Great Repeal: the programme as a single instrument | 9,572 | **9 of 9** | holds, 0 defects |

---

## M-01 — Human Rights Act 1998 and the European Convention on Human Rights

`72a29705-3365-4979-b8ad-a6bc80e4d488` · kernel 12,160 characters · prompt 3868 tokens

### KERNEL_CHECK — 8 of 9

> This is a strong kernel that correctly identifies a distinct root cause and pivotal obstacle, and proposes a guiding policy with clear leverage. However, the actions are a repetitive list rather than a coordinated, sequenced plan, which weakens the final section.

**FAILS `ACTIONS_COHERE` — The actions cohere with each other**

The actions are a repetitive list of the same few steps (draft bill, pass bill, notify, communicate) rather than a single, coordinated set of actions. This smears effort by presenting multiple versions of the same plan instead of one coherent sequence.

### LOGIC_CHECK — the chain holds

**Read as:** The problem is that the Human Rights Act 1998 gives courts the final say on political matters that should be decided by Parliament. According to the diagnosis, this situation persists not because Parliament lacks power, but because the political establishment is inert and risk-averse, preferring failed, piecemeal reforms. The pivotal obstacle is therefore this political inertia. The proposed approach is to overcome this inertia with a single, decisive 'clean break': a legislative act that simultaneously repeals the HRA and denounces the ECHR. The actions are the necessary steps to draft, pass, and implement this act, including managing the political and legal transition.

- **UNSUPPORTED** — This is an assertion about the motivations of 'legal and administrative bodies'. No evidence or reasoning is provided to support the claim that they 'benefit' from the current framework or that this benefit 'reinforces' the political inertia.

## M-02 — Equality Act 2010

`282806fe-ef6f-4022-843d-d9b733b8c38b` · kernel 9,585 characters · prompt 3549 tokens

### KERNEL_CHECK — 8 of 9

> This is a strong and coherent kernel that makes a clear choice. Its only weakness is in the `ACTIONS` section, which appears to be a list of duplicated items rather than a coordinated sequence. Consolidating these would make the kernel ready.

**FAILS `ACTIONS_COHERE` — The actions cohere with each other**

The actions are a list, not a coordinated set. Several actions are duplicated, suggesting a lack of concentration and sequencing. For example, the action to draft a bill appears twice with different implementers, as does the action to develop guidance.

### LOGIC_CHECK — the chain holds

**Read as:** The strategy argues that the Public Sector Equality Duty (PSED) law, by imposing a broad, process-based 'due regard' obligation enforced by courts, has created the pivotal obstacle: a legal and cultural incentive for public bodies to prioritize creating a legally defensible paper trail over delivering their core services. The proposed approach is to remove this obstacle directly by abolishing the PSED statute itself, while retaining other substantive anti-discrimination laws. The coherent actions logically follow this approach, consisting of the legislative steps to repeal the specific sections of the Equality Act 2010 and the subsequent administrative work to update official guidance for public bodies.

- **UNSUPPORTED** — The kernel cites evidence of spending on equality and diversity roles, but this does not substantiate the claim that a 'compliance industry' exists or that specific groups benefit from 'reduced accountability' and have an incentive to resist change. These assertions about motive and economic structure are not supported by the evidence provided.

## M-03 — The United Kingdom Supreme Court

`e4ece7d7-8f94-41a0-b9e0-8f5c1b5ae506` · kernel 7,396 characters · prompt 2821 tokens

### KERNEL_CHECK — 9 of 9

> A strong kernel that passes all tests. The diagnosis is sharp, the policy has leverage on the named obstacle, and the actions are coherent and directly address the diagnosed causes.

*Every test passed.*

### LOGIC_CHECK — ⚠ the chain does NOT hold

**Read as:** The Supreme Court's self-conception as a 'constitutional guardian' is said to be caused by its physical separation from Parliament under the 2005 Constitutional Reform Act and a lack of robust parliamentary review of how laws are interpreted. The pivotal obstacle is identified not as the court itself, but as Parliament's own failure to assert its sovereignty, due to political inertia and the absence of a specific body to hold the judiciary accountable. The proposed approach is to create a powerful new parliamentary scrutiny mechanism. This is to be achieved through a series of actions: drafting a bill to create a joint committee, mandating this committee to review judicial interpretation against parliamentary intent, empowering it to recommend legislative changes, and establishing a process for Parliament to act on these recommendations.

- **UNSUPPORTED** — This central claim is presented as fact but is not supported by evidence. The kernel later states, 'The provided sources do not directly address the Supreme Court's self-conception or demonstrate how it might have deviated from its intended role,' which confirms the assertion is unsupported by the materials at hand.
- **NON_SEQUITUR** — The evidence cited—that no bill has been tabled to reverse the 2005 Act—does not logically support the conclusion that Parliament has failed to assert its sovereignty. The absence of a repeal bill could equally suggest parliamentary satisfaction with the Act, not inertia or a failure of will.

## M-04 — The arm's-length body estate

`b9628162-b1b8-4a9d-8128-749d67c2ace3` · kernel 10,058 characters · prompt 3467 tokens

### KERNEL_CHECK — 9 of 9

> This is a strong strategy kernel that passes all tests. The diagnosis is sharp, the policy has leverage on the named obstacle, and the actions are coherent and directly address the causes.

*Every test passed.*

### LOGIC_CHECK — the chain holds

**Read as:** The diagnosis posits that the lack of accountability from arm's-length bodies (ALBs) is not an accident but a deliberate feature of a fragmented legal landscape, which benefits both ministers who can avoid blame and officials who gain autonomy. This has created an entrenched political and administrative culture resistant to change, which is identified as the pivotal obstacle. The guiding policy directly confronts this obstacle by attacking the fragmentation itself. Instead of piecemeal reform, it proposes a single, powerful law that forces every ALB into a mandatory review cycle with a default presumption of abolition or absorption. The coherent actions are to draft and pass this new Act, establish the unit to run the review cycle, and create a parliamentary oversight mechanism, directly executing the guiding policy.

*No defects found.*

## M-05 — Judicial review of executive decisions

`3e797bad-d0ee-4696-926b-a9eebb7170e3` · kernel 7,517 characters · prompt 2959 tokens

### KERNEL_CHECK — 8 of 9

> This is a strong kernel that correctly identifies a specific obstacle and designs a policy with leverage against it. The actions are coherent and directly address the diagnosed causes. The main weakness is the diagnosis section itself, which describes the context rather than simplifying the problem to a single pivotal point to be defeated. This is a minor flaw in an otherwise well-constructed strategy.

**FAILS `DIAGNOSIS_SIMPLIFIES` — The diagnosis simplifies rather than inventories**

The diagnosis describes the context and competing principles ('constitutional tension') rather than simplifying the problem to the single thing that must be defeated. It inventories factors rather than naming what is pivotal.

### LOGIC_CHECK — the chain holds

**Read as:** The executive perceives that courts are increasingly reviewing the policy merits of ministerial decisions, not just their legality, which undermines the executive's function. This happens because courts consistently interpret any legislative attempt to limit their oversight (ouster clauses) very narrowly, a judicial principle that is the pivotal obstacle to change. The proposed approach is to counter this by drafting exceptionally clear and specific primary legislation for targeted policy areas. This legislation will statutorily define the boundaries between 'merits' and 'legality' so precisely that a court cannot interpret its way around the restriction without directly challenging Parliament's authority. The actions support this by drafting such a law for a test case (e.g., immigration), creating an internal pre-decision review to ensure compliance with the new definitions, requiring a statement of reasons to narrow the grounds for challenge, and establishing a fast-track court procedure to quickly resolve disputes over these new boundaries.

*No defects found.*

## M-06 — The permanent, appointed civil service

`8c216e8e-0557-45b4-b774-82f32a5e1662` · kernel 9,673 characters · prompt 3332 tokens

### KERNEL_CHECK — 6 of 9

> This kernel has a strong diagnosis but fails on execution. The diagnosis correctly identifies the deep-seated nature of the problem and the pivotal obstacle of political consensus. However, the guiding policy and actions then propose a direct, frontal assault on this obstacle, which the diagnosis itself describes as having a 'prohibitively high' political cost. This is not leverage; it is a failure to face the problem as diagnosed, leading to an impracticable objective. The action list is also incoherent, containing contradictory steps and appearing as a list rather than a coordinated plan.

**FAILS `HAS_LEVERAGE` — The approach has leverage on the named obstacle**

The policy has no leverage on the named obstacle. The obstacle is a 'prohibitively high' political cost arising from a strong consensus. The policy is a direct, frontal challenge to that consensus, which does not exploit any asymmetry or pivot point to reduce the cost. It simply proposes to pay a cost the diagnosis has already established is too high.

**FAILS `ACTIONS_COHERE` — The actions cohere with each other**

The actions are an uncoordinated list, not a coherent plan. The list contains directly contradictory actions: one action proposes to amend a law that another action proposes to repeal.

**FAILS `NO_BAD_STRATEGY_SMELL` — No bad-strategy smell**

The kernel smells of 'Impracticable Objectives'. The diagnosis explicitly states that the political cost of the proposed reform is 'prohibitively high', yet the guiding policy and actions proceed to propose exactly that reform without any mechanism to lower the cost. The strategy diagnoses its own objective as impracticable.

### LOGIC_CHECK — ⚠ the chain does NOT hold

**Read as:** The argument is that elected ministers feel their agenda is moderated by a permanent civil service, a problem rooted in the 170-year-old Northcote-Trevelyan settlement, not the CRAG 2010 Act which merely codifies it. The pivotal obstacle to changing this is the prohibitively high political cost of being accused of creating a 'spoils system'. The kernel then presents two contradictory approaches: one that leverages existing powers without new legislation, and another that directly challenges the settlement by repealing CRAG 2010 to give ministers direct appointment powers. The listed actions all follow the second, more radical path, directly contradicting the first approach and proceeding with the very actions that the diagnosis identified as mis-targeted and that the pivotal obstacle identified as politically non-viable.

- **NON_SEQUITUR** — The kernel's own diagnosis states that repealing CRAG Part 1 is the wrong remedy and will not solve the problem. However, the Guiding Policy and all subsequent Actions are built around repealing CRAG Part 1. The proposed solution does not follow from the diagnosis; it directly contradicts it.
- **BROKEN_LINK** — The actions do not address the pivotal obstacle. The obstacle is the 'prohibitively high' political cost of being seen to create a 'spoils system'. The actions propose to do exactly that, without any component designed to overcome, mitigate, or otherwise navigate this cost. The approach does not engage with the identified obstacle.
- **NON_SEQUITUR** — The actions do not follow from the stated approach. The 'Approach' explicitly states the strategy is to work *without* primary legislation or repealing CRAG Part 1. The 'Actions' are entirely focused on introducing a Government Bill to do precisely that. The two sections are in direct contradiction.

## M-07 — Operational independence of the Bank of England

`5c7287d2-c059-4c84-a4e4-5cf1e97c19db` · kernel 7,794 characters · prompt 2992 tokens

### KERNEL_CHECK — 7 of 9

> This kernel is strong, with a clear diagnosis that correctly distinguishes the root cause from the pivotal obstacle. However, it presents two different sets of actions that are not aligned with each other or the guiding policy, creating a critical incoherence between the strategy and its execution.

**FAILS `ACTIONS_DEFEAT_CAUSES` — The actions defeat the diagnosed causes**

The actions listed under the 'ACTIONS' heading do not defeat the second material cause. They are a direct legislative assault that ignores the diagnosed pivotal obstacle (the political consensus) and the guiding policy (which is to attack that consensus first). The actions in 'THE PLAN' section are better aligned, but the 'ACTIONS' section as written fails to address the cause that monetary policy is perceived as technical, not political.

**FAILS `ACTIONS_COHERE` — The actions cohere with each other**

The kernel presents two separate and contradictory sets of actions under the headings 'ACTIONS' and 'THE PLAN'. The 'ACTIONS' list is a direct legislative assault, while 'THE PLAN' describes a sequenced campaign to first change the political environment. These are not coordinated; they are two different strategies.

### LOGIC_CHECK — ⚠ the chain does NOT hold

**Read as:** The problem is that unelected officials at the Bank of England make unaccountable monetary policy decisions with significant distributional consequences, a situation caused by the 1998 Bank of England Act which framed these political choices as technical. The pivotal obstacle to changing this is a strong cross-party consensus that the Bank's independence is essential for economic credibility, creating a 'credibility trap' for any government that tries to reclaim control. The guiding policy is to attack this consensus by reframing monetary policy as an issue of democratic accountability. The plan to achieve this involves commissioning an audit of monetary policy's consequences, using it to force a parliamentary debate, and then publishing a green paper to build a coalition for change. However, the kernel presents a completely different and contradictory strategy under 'The Approach', which suggests using existing reserve powers without new legislation, while the 'Actions' list describes drafting and passing a new bill—the exact opposite.

- **BROKEN_LINK** — The kernel presents two mutually exclusive strategies. 'The Approach' explicitly states the goal is to act 'without requiring new primary legislation', while the first 'Action' is to 'Draft a Bill to amend or repeal' the existing legislation. The actions do not follow from the stated approach; they directly contradict it.

## M-08 — Diversity, equity and inclusion practice in the civil service

`f73f3928-1eac-47b2-8ecc-9248f37e1504` · kernel 8,607 characters · prompt 3151 tokens

### KERNEL_CHECK — 9 of 9

> This is a strong kernel. It passes all nine tests, demonstrating a clear diagnosis, a focused guiding policy with leverage, and a set of coherent actions designed to defeat the diagnosed causes.

*Every test passed.*

### LOGIC_CHECK — the chain holds

**Read as:** The strategy argues that the statutory Public Sector Equality Duty (PSED) has been interpreted expansively by the Civil Service, fostering an internal culture that rewards visible commitment to DEI. This has created the pivotal obstacle: an entrenched institutional culture that benefits from this broad interpretation, presenting discretionary policies as legal necessities and shielding them from oversight. The proposed approach is to counter this by having the central government issue legally authoritative guidance that narrows the interpretation of the PSED, focusing it on core anti-discrimination duties. This will be executed through coordinated actions: the Cabinet Office will issue the new guidance, the Civil Service Commission will update recruitment rules accordingly, the Treasury will remove financial incentives for the old interpretation, and a parliamentary committee will provide ongoing oversight.

*No defects found.*

## M-09 — Gender self-identification

`9209fd61-7aa6-452c-9307-a195288413e7` · kernel 7,923 characters · prompt 3239 tokens

### KERNEL_CHECK — 7 of 9

> This kernel is internally contradictory. The diagnosis and guiding policy identify the problem as a failure to implement existing law and explicitly rule out seeking new legislation. However, the listed actions do exactly that, proposing a new bill to amend the Equality Act. This fundamental conflict must be resolved.

**FAILS `ACTIONS_DEFEAT_CAUSES` — The actions defeat the diagnosed causes**

The actions contradict the guiding policy. The policy explicitly rules out new legislation, but the first action is to draft an amendment to the Equality Act. The actions address the original material causes, which the diagnosis states have already been resolved by a court ruling, instead of addressing the diagnosed problem of the implementation gap.

**FAILS `ACTIONS_COHERE` — The actions cohere with each other**

The kernel presents two contradictory sets of actions. The 'ACTIONS' section proposes changing the law, while 'THE PLAN' section proposes enforcing the existing law through guidance. These are two different strategies and do not cohere.

### LOGIC_CHECK — ⚠ the chain does NOT hold

**Read as:** The problem is identified as legal ambiguity about the word 'sex', which the diagnosis states has been resolved by a Supreme Court ruling. The remaining problem, and pivotal obstacle, is institutional inertia: public bodies are not updating their practices to align with this clarified law. The guiding policy is therefore to use existing powers to enforce compliance and close this implementation gap, explicitly avoiding new legislation. However, the first two coherent actions listed are to draft and pass new primary legislation to amend the Equality Act, which directly contradicts the guiding policy and the diagnosis that the law itself is no longer the problem.

- **BROKEN_LINK** — The Guiding Policy explicitly states the approach is to avoid new primary legislation. The first action directly contradicts this by proposing new primary legislation. The action does not execute the stated approach.
- **BROKEN_LINK** — The Diagnosis states that the problem is not the law itself but the failure of public bodies to implement it. The first action is to amend the law. This action does not address the diagnosed problem (the implementation gap) but instead addresses the issue of legal ambiguity, which the diagnosis claims is already solved.

## M-10 — Publicly funded charities campaigning on government policy

`a6473880-e328-4674-b747-2eb3c658306b` · kernel 7,606 characters · prompt 2836 tokens

### KERNEL_CHECK — 9 of 9

> This is a well-formed strategy kernel that passes all tests. The diagnosis correctly distinguishes between the root cause and the pivotal obstacle, and the guiding policy and actions are tightly focused on resolving that obstacle with high leverage.

*Every test passed.*

### LOGIC_CHECK — the chain holds

**Read as:** The kernel argues that public money is used by charities to campaign against their government funders because existing Charity Commission guidance is permissive. This creates an 'accountability vacuum,' which is the pivotal obstacle: no specific person is tasked with preventing this, as departmental Accounting Officers lack an explicit mandate and have competing incentives. The proposed approach directly addresses this obstacle by making these Accounting Officers explicitly answerable for enforcing grant conditions. This is to be achieved through coherent actions: creating and mandating standard grant conditions that prohibit using public funds for such lobbying, establishing enforcement mechanisms, and training the relevant officials.

*No defects found.*

## M-11 — The Sentencing Council and sentencing guidelines

`a379e439-5ca8-4afc-a3be-548382fe0e5e` · kernel 7,013 characters · prompt 2910 tokens

### KERNEL_CHECK — 9 of 9

> This is a well-formed strategy kernel that passes all tests. The diagnosis is sharp, the policy has leverage on the named obstacle, and the actions are coherent and directly address the causes.

*Every test passed.*

### LOGIC_CHECK — the chain holds

**Read as:** The argument states that a 'democratic deficit' exists because the unelected Sentencing Council sets politically significant sentencing guidelines without direct control from elected officials. The primary obstacle to rectifying this by simply giving ministers control is the strong constitutional principle of judicial independence, which would provoke strong opposition from the judiciary. The proposed approach is to navigate this obstacle by creating a dual-key approval system, requiring sign-off from both the Lord Chancellor (representing the government) and the Lady Chief Justice (representing the judiciary). This re-asserts democratic accountability while respecting the judicial role. The plan is to enact this change through legislation, establish a formal review process for the Lord Chancellor, and create public criteria for approval to ensure transparency.

*No defects found.*

## M-12 — The Great Repeal: the programme as a single instrument

`6aa6d116-853a-4f11-b510-94408e40176e` · kernel 9,572 characters · prompt 3446 tokens

### KERNEL_CHECK — 9 of 9

> This is a well-formed strategy kernel that passes all tests. The diagnosis is sharp, the guiding policy has leverage on the named obstacle, and the actions are coherent and sequenced.

*Every test passed.*

### LOGIC_CHECK — the chain holds

**Read as:** The strategy argues that because the constitutional reforms from 1997-2010 were enacted as distinct but interconnected laws, they have created a new, self-defending constitutional order. This leads to the pivotal obstacle: this new order cannot be undone with a simple, uniform repeal because its components rest on different foundations (domestic law, devolved powers, international treaties). A single bill that treats them all the same would be defeated by the strongest component, likely the Belfast/Good Friday Agreement. The proposed approach directly counters this by using a single, omnibus Act of Parliament that is internally differentiated, with specific legal mechanisms tailored to dismantle each type of component. The actions and plan then lay out the steps to execute this approach: first, categorizing all the target legislation by its foundation, then drafting the differentiated bill with separate parts for each category, and finally, using a parliamentary strategy to pass the entire package at once to prevent it from being defeated piecemeal.

*No defects found.*

---

## ⚠ What is NOT here, and why

**`ADVERSARIAL` and `SMART` were not run standalone.** Both are mechanically capable of it
— B20 §4 sets out what each consumes — but neither is safe to run this way today:

- **`SMART` rewrites the kernel.** It calls `setProposal` on up to five fields, and since
  the B18 fix those rewrites are visible to every marker that follows. A "read-only SMART"
  is not SMART, and a real one would change the twelve measures while CCW is writing the
  report from them (CCW-B21a §5).
- **`ADVERSARIAL`'s prompt is assembled from the build's own carried state** — the SMART
  critique, the verification carry, and the elicitation testimony. Rebuilding that outside
  a build means restating a prompt rather than importing one, and a critique produced from
  an approximation of the real prompt is not comparable with the three that were not.

Both would be sound with one `export` on `runOnePass` and a shared context builder, which
is a change to `build.ts` — the file every build runs through — and is not something to
make unsupervised on the strength of an export.
