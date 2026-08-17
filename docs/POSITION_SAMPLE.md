# POSITION EXTRACTION — THIRTEEN CASES, IN FULL, SO THE SCORES CAN BE CHECKED

**For:** Charlie · **Written:** 17 August 2026 · **Source:** the fifty hand-scored positions from
GRAPH 2D-3, dumped by `scripts/ingest/position-graph/sample-2d5.ts`

You asked to read the actual material rather than the scores. That should have been offered rather
than requested — every number in this workstream ("27 of 50 wrong", then "22 of 50") is a summary of
judgements nobody outside the thread has seen.

**What follows is thirteen of the fifty, chosen to span the failure types rather than to look good.**
Three it got right, one it correctly stayed silent on, two where it reversed the direction, two where
it attached a position to a passage that does not argue it, one where it quoted a bibliography, two
where it flattened a qualified view — and **two where I think my own hand-read is arguable, marked as
such.**

The selection is mine and it is a judgement. **All fifty are dumped to
`position-graph/sample-2d5-cases.json`**, so the twelve I did not choose can be read too. Every
passage below is real text from the submission, located in the document at the offset recorded, with
its surroundings.

> **How to read a case.** The **CLAIM** is one of 83 propositions we wrote for health and social care
> and put to every submission. The extractor's job is to say whether *this* submission takes a
> position on *that* claim, and to quote the passage proving it. **Silence is a correct answer** — a
> submission about damp housing addresses none of the 83.

---

## PART ONE — THE ONES IT GOT RIGHT

### Case 1 — an explicit position, read correctly ✓

**CLAIM** — Assisted dying should be legalised in England and Wales for terminally ill adults.
**SUBMISSION** — Sir Mark Allen, Chairman of the Ethics Committee, Hospital of St John and St
Elizabeth · *Assisted dying/assisted suicide* inquiry · 204 words
**RECORDED** — `against`, capacity `representative`, confidence 1.0

> Written evidence submitted by Mark Allen (ADY0483)
>
> As the Chairman of the Ethics Committee of the Hospital of St John and St Elizabeth, I write with
> reference to your inquiry into possible changes in the law dealing with 'assisted dying' and
> assisted suicide. You will have received many learned and detailed submissions on this question. My
> purpose is not to repeat these, but simply to register that **as a charity responsible for one of
> the principal hospices in central London, our position is clear: we put the sanctity of life first
> and cannot condone or collaborate with any form of assisted suicide or euthanasia.**
>
> I would also like to question the equation of 'assisted dying' with 'assisted suicide'. One may help
> someone to die without ever directly intending to help that person commit suicide or to kill that
> person oneself. Excellent palliative care, such that this hospice offers, helps people to die well
> without there ever being any need whatsoever to help them commit suicide or to practice euthanasia.
> A fruitful inquiry requires clarity in its use of terms.
>
> With our best wishes for your deliberations, Jan 2023

**QUOTED** — "as a charity responsible for one of the principal hospices in central London, our
position is clear: we put the sanctity of life first and cannot condone or collaborate with any form
of assisted suicide or euthanasia."

**HAND READ — correct.** The passage is the position, stated as a position. Note also that `capacity`
is right and not trivially so: Sir Mark writes in the first person singular but the sentence is
"*our* position", so this is the hospice's view and not a private citizen's. That distinction matters
downstream and the extractor got it.

---

### Case 2 — an "against" that runs opposite to the submitter's evident sympathies ✓

**CLAIM** — There should be a system of segregated 'COVID' and 'non-COVID' units within hospitals to
ensure patient and staff safety.
**SUBMISSION** — FODO (the optical sector body) and NCHA · *Delivering Core NHS and Care Services
during the Pandemic* · 2,736 words
**RECORDED** — `against`, capacity `representative`, confidence 0.85

> …It makes clear that site designation where "patients without Covid-19 symptoms needing essential
> care" can be seen "is likely to be the most effective option in managing cross-contamination".
> **In contrast, attempting to zone within facilities – i.e. separate Covid-19 and non Covid-19
> patients – is likely to make minimising cross-contamination more difficult**; the guidance states:
> "Not all premises are likely to have separate entry/exits point to help maintain this kind of
> separation."
>
> Therefore, we need urgently to plan how and where we see patients for non-Covid-19 health issues
> during the pandemic rather than simply not seeing them because of Covid-19… As a general principle
> a patient without Covid-19 and in need of general healthcare should not attend a shared Covid-19
> site where zoning is difficult to manage…

**HAND READ — correct, and this is the harder kind of correct.** FODO are plainly *in favour* of
separating COVID from non-COVID patients in general; what they oppose is doing it by **zoning within
one building**, which is precisely what the claim proposes. A shallower reader — human or machine —
matches on "separate COVID and non-COVID" and records `for`. The extractor read the distinction.

---

### Case 3 — a genuinely balanced view, recorded as balanced ✓

**CLAIM** — Continuity of care with a named GP should be prioritised over immediate access to any
clinician.
**SUBMISSION** — Dr Ben Burville, Coquet Medical Group · *The future of General Practice* · 1,829 words
**RECORDED** — `balanced`, confidence 0.8

> **What role does having a named GP—and being able to see that GP—play in providing patients with the
> continuity of care they need?**
>
> An interesting question! **I am a great believer in continuity of care for a condition / problem
> more than continuity of care per se. Having a named GP is often a paper exercise more than a
> practical process. Continuity of care has significant benefits for certain groups (multi-morbidity /
> elderly).**

**HAND READ — correct.** This is the case Case 11 and Case 12 below are *not*: the submitter engages
the claim directly and lands between the two options — continuity yes, named GP no, and for some
patients more than others. `balanced` is the right record. ⚠ Worth knowing that `balanced` was used
**744 times in 16,196 positions (4.6%)**, which is the point you raised about degrees of support: the
extractor almost never uses it, and when it does it is usually right to.

---

### Case 4 — four claims it correctly stayed silent on ✓

**SUBMISSION** — Barbara Coombs Lee, President Emerita, Compassion & Choices · *Assisted dying* ·
513 words

> My name is Barbara Coombs Lee. I'm an attorney, nurse, advocate and author. I was among those
> drafting the Oregon Death with Dignity Act in 1994… **I want to comment specifically on the impact of
> medical aid in dying on the quality of end-of-life care.** In 1997, Dr. Susan Tolle… a dedicated
> opponent of medical aid in dying, nevertheless observed a strong association between passage of the
> Oregon Death with Dignity Act… and improved end-of-life care in the state… Specific areas of
> verifiable improvement include: Rising hospice admissions, a full 20% in the first year… Declining
> proportion of deaths occurring in acute care hospitals… More appropriate use of opioid analgesics…

**RECORDED** — `for` on legalisation; `against` on "improvements in palliative care would negate the
arguments for assisted dying"; **and `no-position` on four others**, including:

- *Legalising assisted dying would diminish the value of older and disabled people's lives*
- *Legalising assisted dying would lead to an erosion of safeguards and a widening of eligibility over time*
- *Healthcare professionals should have the right to conscientiously object without being required to refer*
- *The current legal distinction between withdrawing life-prolonging treatment and assisted dying is ethically sound*

**HAND READ — correct, and this is the case that should reassure most.** The author is one of the
most committed advocates in the field and certainly *holds* views on all four. **The submission does
not argue them**, and the extractor recorded silence rather than filling them in from what the author
obviously believes. That is rule 4 of the prompt working — *judge what the submission argues, not what
its author probably believes*.

⚠ It also shows the shape of the real problem. **21,461 of the 37,657 rows are `no-position`.** The
machinery can decline. It declines far too seldom, which is Part Two.

---

## PART TWO — THE ONES IT GOT WRONG

### Case 5 — the direction reversed ✗ `polarity-flipped`

**CLAIM** — Continuity of care with a named GP should be prioritised over immediate access to any
clinician.
**SUBMISSION** — Richard Davis, Reynard Electronics Ltd · *Department's White Paper on health and
social care* · 2,726 words
**RECORDED** — `against`, confidence 0.8

The submission is an anti-privatisation campaign letter. Its opening: *"This response is to object to
American Style medical services being introduced to the UK."*

> **SPECIFIC AREAS OF CONCERN — 1. Patient care likely to be compromised and local accountability
> reduced**
>
> The White Paper does not explain how patient care and experience would be improved. Establishing
> ICSs would not easily allow local needs to be implemented. ICSs would be further away from the
> public; 135 CCGs would be reduced to 42 ICSs in England. **The increasing numbers of large Primary
> Care Networks (PCNs) would destroy continuity of care and make access to care more difficult.**
> General practitioners are already hard pressed; the addition of implementing integrated care would
> further reduce time for patients.

**HAND READ — wrong, and squarely wrong.** "PCNs would **destroy** continuity of care" is an argument
*for* valuing continuity — it is offered as a reason to oppose the reform. It was recorded as
`against` prioritising continuity, which is the opposite of what the sentence does. My best guess at
the mechanism is that the passage is *negative in tone* and *about continuity*, and the direction was
taken from the tone.

⚠ **Only 2 of 50 failures were of this kind**, and that is the single most encouraging number in the
workstream. When the model says a submission addresses a claim, it usually reads the direction right.
Its problem is saying so far too often.

---

### Case 6 — the direction reversed, again ✗ `polarity-flipped`

**CLAIM** — Local authorities should receive adequate funding for children's services, including
safeguarding and preventative health care.
**SUBMISSION** — Cambridge Curiosity and Imagination, Fullscope, UCL, Cambridge Acorn Project, Anglia
Ruskin University (a five-organisation joint submission) · *Prevention in health and social care*
**RECORDED** — `against`, confidence 0.8

> Amongst policy makers there is recognition of the need for creating the right environment and
> context to support children's mental health to reduce the growing need for interventions from mental
> health services; **schools and education settings have been identified as having a key role in
> providing such support, yet they receive few resources to do so.**

**HAND READ — wrong.** "*yet* they receive few resources to do so" is a complaint about
under-funding, i.e. an argument *for* adequate funding. Recorded as `against`. Same mechanism as Case
5: the sentence contains a negative ("few resources") and the negative became the polarity.

---

### Case 7 — a position attached to a topically adjacent passage ✗ `position-invented`

**CLAIM** — General Practice funding should be significantly increased **as a proportion of the
overall NHS budget**.
**SUBMISSION** — Dr Lucia Magee, salaried GP, St Chad's Surgery · *The future of General Practice* ·
416 words
**RECORDED** — `against`, confidence 0.9

> I currently work as a salaried GP in South-West England… I am concerned that the current demand on
> primary care is unsustainable. I think we need to ask if supply will ever be able to meet demand,
> given rising populations, increasingly complex morbidity… **I am concerned that the publics level of
> expectation of primary care and health services, will never be met with the current funding model**
> (for example patients who attend with multiple, frequent minor health complaints, when other
> services and options are available). If we were to increase access (supply) to primary care
> appointments, we run the risk of throwing the door open to more of the worried well and frequent
> attenders, rather than supporting those with complex mental and physical health needs… **What level
> of primary care access are the Government willing to fund for each patient?**

**HAND READ — wrong.** Dr Magee argues that demand will always outstrip supply and warns against
widening *access*. She says nothing about general practice's **share of the NHS budget**, which is
what the claim asks. The extractor found a passage containing "funding model" and "primary care" and
built a position out of the overlap.

⚠ **This is the largest failure class: 12 of 50.** The claim and the passage are about the same
*subject*; they are not about the same *question*.

---

### Case 8 — the same failure, from a source that would carry weight ✗ `position-invented`

**CLAIM** — Bureaucracy and administrative burdens in General Practice should be significantly reduced.
**SUBMISSION** — The Nuffield Trust · *The future of General Practice* · 3,306 words
**RECORDED** — `for`, confidence 0.7

> **3. Policies to support positive change**
>
> **Even with general practice in a chronic state of low capacity relative to need, matching the right
> care to the right patient and retaining core capacity can allow more value to be provided to
> patients. Policymakers will need to use the levers at their disposal carefully to help find
> solutions.**
>
> **3.1. Objectives** In the difficult task of prioritising what general practice can do, the
> Government's approach needs to balance several important objectives which at times are overlooked:
> Improving the health of the whole local population they serve. Value for money… Equal access for
> all… Safeguarding staff wellbeing…

**HAND READ — wrong.** The quoted passage is a section-opening bridge sentence. It argues nothing
about bureaucracy; the word does not appear in it. **This one is worth singling out because of whose
it is** — "The Nuffield Trust argues that bureaucracy in general practice should be reduced" is a
sentence a journalist would print, and we would have manufactured it.

---

### Case 9 — it quoted the bibliography ✗ `position-invented`

**CLAIM** — Physical activity interventions for older adults should include a social element.
**SUBMISSION** — Dr Jennifer Liddle, Newcastle University, with RISE · *Healthy Ageing* · 1,854 words
**RECORDED** — `for`, confidence 0.85, **at 94% of the way through the document**

> …The RISE website contains more information about their work: https://www.risenortheast.co.uk
>
> **References**
>
> Liddle, J., Stowell, M., Warwick. S., Thompson, A., Brittain, K., Hanratty, B. (2022) A Qualitative
> Evaluation of the Active Ageing Programme. Final Report, 1-38.
>
> Liddle, J., Stowell, M., Ali, M., Warwick, S., Thompson, A., Brittain, K., Brougham, A., Hanratty,
> B. **Community-based physical and social activity for older adults with mild frailty: a rapid
> qualitative study of a collaborative intervention pilot.** BMC Geriatrics 24, 1011 (2024).
> https://doi.org/10.1186/s12877-024-05604-y

**QUOTED** — "Community-based physical and social activity for older adults with mild frailty: a rapid
qualitative study of a collaborative intervention pilot."

**HAND READ — wrong, and instructive about our own checks.** The "passage" is **the title of a cited
paper, sitting under the heading "References".** It reads like a position because an academic title
is a compressed claim.

⚠ **Every mechanical check we have passes this row.** The words really are in the document, verbatim
and contiguous, so the extract-verification says found. It is over 20 characters and looks like prose.
The only signal is *where it sits*: 94% of the way in. Of the fifty, **7 extracts come from the last
15% of their document, and 3 of those 7 are failures** — a rule on position alone would cost more than
it saved, which is why 2D-4 refused it (4.3% false positives). **The honest reading is that the
document's own structure — headings, reference lists, tables — is information we currently throw away
before the model ever sees the text.**

---

### Case 10 — a description recorded as an endorsement ✗ `nuance-flattened`

**CLAIM** — **The White Paper's proposals will deliver** effective integration of health and social
care services.
**SUBMISSION** — Social Work England (the statutory regulator, ~100,000 registrants) · 974 words
**RECORDED** — `for`, confidence 0.8

> There are a number of points arising from the White Paper that may mean change for social workers and
> the wider teams and settings in which they work. **We look forward to working closely with the
> Government as their plans develop**, to make clear the unique contribution of social workers in the
> NHS and the centrality of social work to the integration agenda.
>
> **Social work at the heart of integration**
>
> **The aim of integrating services is to enable professionals, each with their own distinctive
> professional expertise and identity, to collaborate effectively in the delivery of person-centred
> care.** In their everyday practice, social workers work in step with a range of professionals and
> services. **We have seen this collaborative nature of social work give rise to a number of
> developments pertinent to the matter of integration**: The advance of integrated social work degrees…

**HAND READ — wrong, and wrong in a way that matters constitutionally.** Social Work England is a
regulator at arm's length from Government. The passage defines what integration is *for* and describes
the profession's contribution to it. **It does not say the White Paper will deliver it** — which is
the claim, and which is a prediction about a specific government document. A regulator recorded as
endorsing a Minister's White Paper is not a small error.

Read the first quoted sentence again: *"We look forward to working closely with the Government as
their plans develop."* That is the language of an organisation declining to say whether the plans are
any good.

---

### Case 11 — a warning recorded as a weighing ✗ `nuance-flattened`

**CLAIM** — Digital-first primary care, including video and online consultations, should be widely
adopted and embedded across the NHS.
**SUBMISSION** — Somerset Local Medical Committee (representing all GPs in Somerset) · 2,741 words
**RECORDED** — `balanced`, confidence 0.8

> **Demand increase** — The number of appointments has increased by 10% since the pandemic… On one
> Monday in Somerset a practice with a population of 14,000 was faced with 640 contacts. **Online
> consulting is designed to make it easier to contact a surgery but demand is infinite and ease of
> access encourages unlocks more unmet needs. All other parts of the NHS have capped capacity.** For
> example NHS dentists, secondary care referrals, physio appointments have long waiting lists… **We
> need to address the demand and not necessarily encourage ease of access when we do not have the
> capacity to manage it.**

**HAND READ — wrong, though less badly than the others.** Somerset LMC are *sceptical* of digital-first
access, not balanced on it. The passage concedes the intention ("designed to make it easier") before
rejecting the consequence, and the concession was read as the other half of a weighing. The
paragraph's own conclusion — *"not necessarily encourage ease of access"* — is one sentence further on
and was not quoted.

⚠ **This is your point about degrees of support, and it is the failure class the current design
handles worst: 11 of 50.** A submission that makes four points one way and five the other is not
`balanced`; it has a position with conditions attached. There is nowhere in the current record to put
the conditions, so they are dropped, and dropping them changes what the row says.

---

## PART THREE — TWO WHERE I THINK MY OWN SCORE IS ARGUABLE

⚠ **The hand-read is itself a judgement.** A sample that presented every score as obvious would
misrepresent how this works. These two I scored as failures and would not defend hard.

### Case 12 — arguable ⚖ scored `nuance-flattened`

**CLAIM** — Mental health awareness training for school staff should be **mandatory and integrated
into Initial Teacher Training**.
**SUBMISSION** — UCLPartners (an academic health science partnership of 24 healthcare organisations,
26 local authorities, 9 universities) · 1,367 words
**RECORDED** — `for`, confidence 0.9

> **Capacity challenges** — Much early intervention is provided in schools and by voluntary sector
> organisations in the community. There are a number of challenges associated with this: Lack of
> partnership working between these different organisations often results in a fragmented approach…
> **There are often a lack of staff appropriately trained to deliver early intervention work. Too
> often the professionals and peers who engage most regularly with at risk young people do not have
> the skills to effectively support the young person's emotional health. One consequence of this is
> that interventions which are dependent on appropriately trained staff can't be delivered at scale.**

**I scored this a failure** because the claim has two specific components — **mandatory**, and **inside
Initial Teacher Training** — and the submission argues neither. It argues that staff lack skills.

**The argument against my score:** the claim's *substance* is that school staff should be trained in
mental health, UCLPartners plainly support that, and "mandatory / via ITT" is the policy mechanism
rather than the claim. On that reading `for` is right and I am being pedantic about wording we chose.

**Why I scored it the strict way anyway:** because the mechanism is what a reader would take from the
row. "UCLPartners support mandatory mental health training in Initial Teacher Training" asserts a
position on a specific policy instrument they never mention. But I record that this is a close call,
and if the strict reading is wrong then **some of the 11 nuance failures are not failures**, and the
real error rate is lower than 22 of 50.

### Case 13 — arguable ⚖ scored `proposition-mismatch`

**CLAIM** — The prevention of poor musculoskeletal (MSK) health should be embedded in **the Major
Conditions Strategy** and prevention programmes.
**SUBMISSION** — Swim England · *Healthy Ageing* · 1,698 words
**RECORDED** — `for`, confidence 0.8

> **2. What are the opportunities for health services to promote physical activity to reduce the
> impacts of ill health…?**
>
> **Swimming supports the management of long-term conditions and reduces the risk of developing
> multiple health issues. Specifically, swimming has been demonstrated to be an effective
> musculoskeletal management strategy** for those struggling with chronic pain, poor function and low
> mobility, improving function, pain and quality of life. It improves cardiovascular health, mobility,
> and mental wellbeing… **To deliver this: GPs and allied health professionals should be supported to
> refer patients to swimming through social prescribing… Community-based aquatic rehabilitation
> programmes should be expanded.**

**I scored this a failure** because the claim names a specific government document, the **Major
Conditions Strategy**, and Swim England do not mention it.

**The argument against my score:** they argue MSK health should be addressed through prevention
programmes, and the second half of the claim says exactly that. The named strategy may be scenery.

**Why this one is genuinely hard:** it exposes a defect in **our own claims**, not in the extractor.
A proposition that bundles two things — *this subject* and *this named vehicle* — cannot be answered
`for` or `against` by a submission that addresses one and not the other. **Several of the 83 read like
this.** That is a fault in claim-writing, and it is one of the arguments for the bottom-up approach
you proposed: claims pulled *out* of submissions do not have this problem, because nobody bundled them
in advance.

---

## WHAT THE THIRTEEN ADD UP TO

| | |
|---|---|
| **Reads direction well** | Only **2 of 50** failures reversed a polarity. When it says a submission engages a claim, it usually knows which way. |
| **Cannot decline** | **12 of 50** attached a position to a passage about the same *subject* but a different *question*. |
| **Cannot qualify** | **11 of 50** flattened a conditional or sceptical view into a plain one. There is nowhere in the row to put the condition. |
| **Cannot see structure** | It quoted a bibliography (Case 9) because the text arrives as an undifferentiated wall — headings, tables and reference lists stripped of their role. |
| **Some claims are unanswerable** | Cases 12–13: propositions that bundle a subject with a named policy vehicle cannot be scored cleanly either way. |
| **Silence works when it happens** | Case 4 declined four claims its author certainly holds views on. **21,461 of 37,657 rows are `no-position`.** |

⚠ **None of this is showable to a user yet, and nothing in this document is in the product.** 22 wrong
in 50 is better than 27 and is not a standard anything should be published against.

**One thing worth knowing about the counts.** The graph holds 37,657 position rows over 2,979
submissions, which looks like heavy duplication — it is not. A joint submission is recorded once per
signatory, so Case 6's five-university letter is five rows. I checked whether they ever disagree with
each other: **0 of 7,448 multi-row groups differ on polarity**, and no (submission, claim, organisation)
triple appears twice. Counting *positions* where you mean *submissions* would overstate by about a
third; the rows themselves are right.
