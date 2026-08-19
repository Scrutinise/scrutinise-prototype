# GOLD CANDIDATES — S8 §5

**Status:** ⚠⚠ **DRAFT INSTRUMENT. NOTHING HAS BEEN SCORED AGAINST THESE, AND NOTHING SHOULD BE
UNTIL CHARLIE HAS VALIDATED THEM.** §5 is explicit: "Do not score anything against these yet…
Charlie's validation pass is what makes it real."

**Written:** 19 August 2026, by CC-Search, executing `BRIEF_SEARCH_S8.md` §5.
**Purpose:** the binding constraint on all retrieval-quality work is the test set
(SEARCH_STRATEGY v5 §5.2). Committees — the largest evidence collection — is unevaluable today;
caselaw and guidance are scored on questions we wrote ourselves; the §4 candidate streams have
none at all. This is the draft that fixes that.

**How to use this file:** every question is one numbered block ending in an
**Accept / Reject / Amend** line. Strike through, edit in place, or write `REJECT — <reason>`.
A rejected question with a reason is more useful to the next pass than a silently deleted one.

---

## ⚠⚠ READ THIS BEFORE THE QUESTIONS — THREE FINDINGS FROM BUILDING THE KEYS

Building an answer key meant querying `corpus_sections` **directly**, never through
`runSearch()`. Keying a question on whatever retrieval returns for it makes recall 100% by
construction and measures nothing. Doing it that way surfaced three facts about the corpus that
matter more than any individual question below.

**1. ⚠⚠ CASE LAW CANNOT BE KEYED FROM THE DATABASE AT ALL.** Every `tna-caselaw` row has
`sectionTitle = NULL`. The **id IS the neutral citation** (`tna-caselaw:[2003] EWCA Civ 1769:1`);
the case name, the parties and the subject matter exist only in the R2 body. So there is no way
to ask the database "which case is about reasonable adjustments" — a title search returns nothing
for *every* legal topic, not because the corpus lacks the cases but because it holds no titles.

Consequently the ten case-law questions below carry a key that is **half-verified**: the citation
is confirmed PRESENT in the corpus (read back by id), but that the case is *about* what the
question asks is asserted from outside knowledge and **is not verified from here**. Each is marked
`KEY: PRESENT / SUBJECT UNVERIFIED`. That is the honest state, and closing it needs either an R2
read or Charlie's eye — it is the single biggest obstacle to a real case-law gold set.

**2. ⚠ IMPACT ASSESSMENTS ARE KEYED THROUGH THEIR PARENT, NOT THEIR TITLE.** `sectionTitle` on
`impact-assessments` is the internal heading — "Summary", "Costs and benefits", "RPC opinion" —
the S2C6 §1 finding, still true. The subject lives on the parent instrument via `parentDocId` →
`corpus_acts.title`, and **only 1,566 of 3,000 sampled rows (52%) resolve to a named instrument**.
The other 48% cannot be keyed this way either. Every impact-assessment key below is a row whose
parent resolved.

**3. ⚠ SEVERAL GUIDANCE COLLECTIONS ARE UNASKABLE BY TITLE.** `ico`, `fca-handbook`,
`sentencing-council` and `planning-policy` returned nothing for their own core subject matter —
ICO titles are decision-notice respondents ("Bracknell Forest Borough Council"), FCA titles are
`NULL`, and the handbook code is the whole identity. The guidance questions below are drawn from
the collections that DO carry topical titles (`hmrc-manuals`, `cps-guidance`,
`college-of-policing`), and the gap in the others is recorded here rather than worked around.

### Sourcing method, per §5

Every question is marked **`document-outward`** (found a real document, wrote the question it
answers) or **`outside-in`** (took a real public controversy, wrote what a user would ask, then
searched the store for what should answer it). §5 requires both, because "a set built only
document-outward inherits the corpus's vocabulary and overstates recall". The split is **21
outside-in / 29 document-outward**; the outside-in ones are the harder half and the ones most
likely to fail.

### Question shapes (archetypes)

The existing gold archetypes A–K were written for legislation, debates and the citation graph and
do not describe these collections. Six new shapes, so coverage is visible rather than accidental:

| shape | what the user wants |
|---|---|
| **L — who said it** | the specific testimony or submission on a subject |
| **M — what was concluded** | a committee's finding or recommendation |
| **N — what was predicted** | an impact assessment's estimate of cost or effect |
| **O — what was asked** | the consultation on a policy, and what came back |
| **P — what the regulator says** | operational guidance on a duty |
| **Q — what the court decided** | a named judgment's holding |

---

## COMMITTEES (10)

### C1 — What did the Lords say about how badly water and sewage regulation was failing?
- **Key:** `committees-reports:publication:34458:189872-0001` and `…-0002` — *1st Report — The
  affluent and the effluent: cleaning up failures in water and sewage regulation*, Industry and
  Regulators Committee, 22 Mar 2023.
- **Why a user asks it:** sewage discharge is the most-complained-about environmental issue in
  England; someone drafting a water-regulation proposal needs the committee that already
  concluded the regulator failed.
- **Shape:** M · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### C2 — Has a committee looked at the Post Office Horizon compensation scheme?
- **Key:** `committees-reports:publication:48294:252814` (letter on improving the Horizon redress
  process, 10 Jun 2025); `committees-reports:publication:34605:190516` (Post Office compensation
  for the Horizon scandal, 23 Mar 2023).
- **Why a user asks it:** the best-known miscarriage-of-justice scandal of the decade; anyone
  proposing a redress mechanism starts from how this one went.
- **Shape:** M · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### C3 — What has Parliament been told about the government's response to the Grenfell Inquiry?
- **Key:** `committees-reports:publication:46883:241779` — letter from the MHCLG Permanent
  Secretary on the UK government response to the Grenfell Tower Inquiry Phase 2 Report,
  26 Feb 2025.
- **Why a user asks it:** building-safety proposals are all downstream of Grenfell; the user
  wants to know what government has actually committed to.
- **Shape:** M · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### C4 — What did the committee say about moving people onto Universal Credit?
- **Key:** `committees-reports:publication:22289:164915` and `…:165036` — correspondence with the
  Secretary of State on managed migration to Universal Credit, 18 May 2022.
- **Why a user asks it:** managed migration is where the harm concentrated; a welfare proposal
  needs the scrutiny record, not the policy statement.
- **Shape:** M · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### C5 — Has anyone in Parliament raised leasehold reform with ministers?
- **Key:** `committees-reports:publication:34123:187763` (Minister of State for Housing, 20 Feb
  2023); `committees-reports:publication:255:1142` (Chair to Minister, 9 Mar 2020);
  `committees-reports:publication:257:1111` (CMA to Chair on leaseholds, 28 Feb 2020).
- **Why a user asks it:** leasehold reform has been "imminent" for years; the user wants to see
  the paper trail rather than the announcements.
- **Shape:** M · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### C6 — What did people submitting evidence say about how AI should be governed?
- **Key:** `committees-evidence:writtenevidence:112256:179384` and `…:112257:175552` — submissions
  to the *Governance of artificial intelligence (AI)* inquiry, 13 Dec 2022.
- **Why a user asks it:** an AI-regulation proposal needs the range of positions already on the
  record, not a summary of them.
- **Shape:** L · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### C7 — What evidence was submitted about net zero and trade?
- **Key:** `committees-evidence:writtenevidence:129871:220666` and `…:129872:220668` — submissions
  to the *Net zero and trade* inquiry, 8 May 2024.
- **Why a user asks it:** carbon border measures are live policy; the user wants the submissions
  rather than the committee's digest of them.
- **Shape:** L · **Sourced:** document-outward
- **Accept / Reject / Amend:**

### C8 — What did witnesses tell the committee about special educational needs?
- **Key:** `committees-evidence:writtenevidence:100004:146799` (SCN0679) and
  `…:100008:145455` (SCN0680) — *Special educational needs and disabilities* inquiry, 2019.
- **Why a user asks it:** SEND is one of the highest-volume complaint areas in English local
  government; a reform proposal needs the parent and provider testimony.
- **Shape:** L · **Sourced:** document-outward
- **Accept / Reject / Amend:**

### C9 — What was the committee told about serious violence?
- **Key:** `committees-evidence:writtenevidence:100005:145526` (SVC0052) — *Serious violence*
  inquiry, 6 Mar 2019.
- **Why a user asks it:** knife-crime proposals are common from members of the public; the
  evidence base already exists and is rarely cited.
- **Shape:** L · **Sourced:** document-outward
- **Accept / Reject / Amend:**

### C10 — Has Parliament examined NHS waiting times for planned operations?
- **Key:** `committees-reports:publication:50376:272506` (DHSC Permanent Secretary follow-up on
  reducing NHS waiting times for elective care, 13 Nov 2025);
  `committees-reports:publication:22555:166025` (PAC report follow-up on waiting times for
  elective and cancer treatment, 31 May 2022).
- **Why a user asks it:** the single most common complaint about the NHS; the user wants the
  scrutiny record across more than one Parliament.
- **Shape:** M · **Sourced:** outside-in
- **Accept / Reject / Amend:**

---

## CASE LAW (10) — ⚠⚠ EVERY KEY HERE IS `PRESENT / SUBJECT UNVERIFIED`

See finding 1 above. The citation is confirmed present in the corpus by reading the id back; that
the case concerns the question's subject is asserted from outside knowledge and **cannot be
checked from this machine**. Charlie's pass on this section matters more than on any other.

### K1 — Can a public body be taken to court for failing to consider equality when making cuts?
- **Key:** `tna-caselaw:[2015] UKSC 21:1` — PRESENT / SUBJECT UNVERIFIED.
- **Why a user asks it:** the public sector equality duty is the most cited hook for challenging
  a council decision, and users routinely ask whether it has teeth.
- **Shape:** Q · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### K2 — What did the Supreme Court decide about prorogation of Parliament?
- **Key:** `tna-caselaw:[2019] UKSC 41:1` — PRESENT / SUBJECT UNVERIFIED.
- **Why a user asks it:** the best-known constitutional judgment of the era; a proposal touching
  parliamentary procedure will be measured against it.
- **Shape:** Q · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### K3 — Has the Supreme Court ruled on whether gig-economy workers are employees?
- **Key:** `tna-caselaw:[2021] UKSC 5:1` — PRESENT / SUBJECT UNVERIFIED.
- **Why a user asks it:** employment-status proposals are common; the user wants the controlling
  authority rather than commentary.
- **Shape:** Q · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### K4 — What has the Supreme Court said about deprivation of liberty in care settings?
- **Key:** `tna-caselaw:[2014] UKSC 19:1` — PRESENT / SUBJECT UNVERIFIED.
- **Why a user asks it:** social-care reform proposals run straight into this; it changed what
  every care home has to do.
- **Shape:** Q · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### K5 — Is there a Supreme Court case about employment tribunal fees?
- **Key:** `tna-caselaw:[2017] UKSC 51:1` — PRESENT / SUBJECT UNVERIFIED.
- **Why a user asks it:** the standard example of access to justice defeating a fees policy —
  directly relevant to any proposal that charges for a remedy.
- **Shape:** Q · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### K6 — What did the court decide about the duty to investigate deaths in custody?
- **Key:** `tna-caselaw:[2011] UKSC 20:1` — PRESENT / SUBJECT UNVERIFIED.
- **Why a user asks it:** prison and detention proposals need the Article 2 procedural duty.
- **Shape:** Q · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### K7 — Has the Supreme Court considered whether benefit caps discriminate?
- **Key:** `tna-caselaw:[2015] UKSC 21:1` (see K1 — ⚠ **the same citation is offered for two
  different questions**; at most one can be right, and this is exactly the ambiguity finding 1
  produces). PRESENT / SUBJECT UNVERIFIED.
- **Why a user asks it:** welfare-cap proposals invite the discrimination challenge immediately.
- **Shape:** Q · **Sourced:** outside-in
- **Accept / Reject / Amend:** ⚠ **likely REJECT or re-key** — flagged deliberately.

### K8 — What is the leading case on when a public authority owes a duty of care?
- **Key:** `tna-caselaw:[2018] UKSC 22:1` — PRESENT / SUBJECT UNVERIFIED.
- **Why a user asks it:** proposals creating new statutory duties need to know how courts treat
  them in negligence.
- **Shape:** Q · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### K9 — Has the Supreme Court ruled on the legality of a government policy on climate targets?
- **Key:** `tna-caselaw:[2020] UKSC 12:1` — PRESENT / SUBJECT UNVERIFIED.
- **Why a user asks it:** net-zero proposals are increasingly litigated; the user wants the
  standard of review.
- **Shape:** Q · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### K10 — What did the Court of Appeal decide in [2003] EWCA Civ 1769?
- **Key:** `tna-caselaw:[2003] EWCA Civ 1769:1` — PRESENT; subject unknown even to the author.
- **Why a user asks it:** ⚠ **a real user would NOT ask this.** It is included as a deliberate
  CONTROL: a pure citation lookup with no topical content, which retrieval should ace. If it does
  not, the problem is the index rather than the question set.
- **Shape:** Q (exact-pin control) · **Sourced:** document-outward
- **Accept / Reject / Amend:**

---

## GUIDANCE (10)

### G1 — What does HMRC say about why the money laundering rules cover company formation agents?
- **Key:** `hmrc-manuals:hmrc-internal-manuals/economic-crime-supervision-handbook/ecsh52050:1` —
  *ECSH52050 — Why do the Money Laundering Regulations include Trust or Company Service Providers*.
- **Why a user asks it:** anti-money-laundering scope is a live proposal area, and HMRC's own
  reasoning is more useful than the regulation's text.
- **Shape:** P · **Sourced:** document-outward
- **Accept / Reject / Amend:**

### G2 — How do prosecutors decide whether to charge in a domestic abuse case?
- **Key:** `cps-guidance:prosecution-guidance/domestic-abuse:1` — *Domestic Abuse*, 1 Aug 2024.
- **Why a user asks it:** the commonest complaint about domestic abuse policy is that charges are
  not brought; the guidance is the operative document.
- **Shape:** P · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### G3 — What happens when someone is accused of making a false allegation of rape?
- **Key:**
  `cps-guidance:prosecution-guidance/perverting-course-justice-and-wasting-police-time-cases-involving-allegedly:1`.
- **Why a user asks it:** a contested area where proposals are made from both directions; the CPS
  policy is the thing being argued about.
- **Shape:** P · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### G4 — What are the rules police have to follow when stopping and searching someone?
- **Key:** `college-of-policing:app-content/stop-and-search:1` — *Stop and search*, 19 Apr 2022.
- **Why a user asks it:** one of the most common public-order proposal subjects; users usually
  cite PACE and miss the operational guidance that actually governs the encounter.
- **Shape:** P · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### G5 — What is the CPS guidance on abuse of process?
- **Key:** `cps-guidance:prosecution-guidance/abuse-process:1`.
- **Why a user asks it:** relevant to any proposal about delayed or repeated prosecutions.
- **Shape:** P · **Sourced:** document-outward
- **Accept / Reject / Amend:**

### G6 — How does a case get sent from the magistrates' court to the Crown Court?
- **Key:** `cps-guidance:prosecution-guidance/allocation-sending-and-committal-sentence:1`.
- **Why a user asks it:** court-backlog proposals depend on where cases are heard, and users
  usually do not know the allocation rules exist.
- **Shape:** P · **Sourced:** document-outward
- **Accept / Reject / Amend:**

### G7 — How do I appeal a decision to the Administrative Court?
- **Key:** `cps-guidance:prosecution-guidance/appeals-administrative-court:1`.
- **Why a user asks it:** a member of the public proposing a right of appeal needs to know what
  route already exists.
- **Shape:** P · **Sourced:** document-outward
- **Accept / Reject / Amend:**

### G8 — What guidance does HMRC give its own staff on money laundering compliance checks?
- **Key:** `hmrc-manuals:hmrc-internal-manuals/money-laundering-regulations-compliance/mlr3cupdate001:1`.
- **Why a user asks it:** the gap between the rule and the enforcement practice is where most
  regulatory proposals live.
- **Shape:** P · **Sourced:** document-outward
- **Accept / Reject / Amend:**

### G9 — When can HMRC depart from the strict letter of the law?
- **Key:** `hmrc-manuals:hmrc-internal-manuals/admin-law-manual/adml4100:1` — *Extra-statutory
  concessions: What an Extra-statutory concession (ESC) is*.
- **Why a user asks it:** proposals often assume the tax rule is applied as written; ESCs are the
  standing counter-example.
- **Shape:** P · **Sourced:** document-outward
- **Accept / Reject / Amend:**

### G10 — What happens if HMRC gives a taxpayer wrong advice?
- **Key:** `hmrc-manuals:hmrc-internal-manuals/admin-law-manual/adml1800:1` (*Incorrect Advice to
  Customers: Unsolicited Advice*) and `…/adml1100:1` (*Incorrect Advice to Customers:
  Introduction*).
- **Why a user asks it:** a very common real grievance and a common proposal subject
  (compensation for official error).
- **Shape:** P · **Sourced:** document-outward
- **Accept / Reject / Amend:**

---

## IMPACT ASSESSMENTS (10)

⚠ Every key is keyed through `parentDocId` → `corpus_acts.title` (finding 2). The section named is
the one that carries the answer — `Costs and benefits` for a cost question, `RPC opinion` for a
scrutiny question — because an impact assessment is many sections and only some answer any
given question.

### I1 — What did the government think banning plastic straws would cost?
- **Key:** `impact-assessments:2020-57:1` and `…:2` — *The Environmental Protection (Plastic
  Straws, Cotton Buds and Stirrers) (England) Regulations 2020* (`uksi/2020/971`).
- **Why a user asks it:** the single most-cited example of a small environmental ban; users
  proposing similar bans are asked "what will it cost" first.
- **Shape:** N · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### I2 — What did the government predict the building safety levy scheme would do?
- **Key:** `impact-assessments:2023-77:1`, `…:2` (Preferred option), `…:3` (Costs and benefits) —
  *The Building Safety (Responsible Actors Scheme and Prohibitions) Regulations 2023*
  (`uksi/2023/753`).
- **Why a user asks it:** post-Grenfell remediation funding is a live proposal area.
- **Shape:** N · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### I3 — What was the predicted cost of the residual waste reduction target?
- **Key:** `impact-assessments:2023-14:1` and `…:3` — *The Environmental Targets (Residual Waste)
  (England) Regulations 2023* (`uksi/2023/92`).
- **Why a user asks it:** waste-reduction proposals need the government's own arithmetic on the
  existing target before proposing a tighter one.
- **Shape:** N · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### I4 — Did the Regulatory Policy Committee approve the tobacco products fees regulations?
- **Key:** `impact-assessments:2017-78:2` (RPC opinion) — *The Tobacco Products and Herbal
  Products for Smoking (Fees) Regulations 2017* (`uksi/2017/409`).
- **Why a user asks it:** the RPC opinion is the nearest thing to independent scrutiny of a
  costing, and almost nobody knows it exists.
- **Shape:** N · **Sourced:** document-outward
- **Accept / Reject / Amend:**

### I5 — What did the government say the tobacco fee changes would cost business?
- **Key:** `impact-assessments:2017-78:3` (Costs and benefits) — `uksi/2017/409`.
- **Why a user asks it:** a fee-raising proposal is the commonest form of self-funding
  regulation, and this is the worked precedent.
- **Shape:** N · **Sourced:** document-outward
- **Accept / Reject / Amend:**

### I6 — What was the impact assessment for the environmental permitting changes?
- **Key:** `impact-assessments:2018-21:1`, `…:2`, `…:3` — *The Environmental Permitting (England
  and Wales) (Amendment) Regulations 2018* (`uksi/2018/110`).
- **Why a user asks it:** environmental permitting is the mechanism behind most pollution
  proposals, including sewage.
- **Shape:** N · **Sourced:** document-outward
- **Accept / Reject / Amend:**

### I7 — What did the government expect from the data adequacy decision for South Korea?
- **Key:** `impact-assessments:2022-92:1` and `…:2` — *The Data Protection (Adequacy) (Republic of
  Korea) Regulations 2022* (`uksi/2022/1213`).
- **Why a user asks it:** international data transfers are a standing business complaint;
  adequacy is the mechanism.
- **Shape:** N · **Sourced:** document-outward
- **Accept / Reject / Amend:**

### I8 — What was the justification for raising the Public Guardian's fees?
- **Key:** `impact-assessments:2017-92:4` (Problem under consideration) and `…:3` (Costs and
  benefits) — *The Public Guardian (Fees, etc.) (Amendment) Regulations 2017* (`uksi/2017/503`).
- **Why a user asks it:** lasting-power-of-attorney costs are a real household grievance.
- **Shape:** N · **Sourced:** document-outward
- **Accept / Reject / Amend:**

### I9 — What options did the government consider before setting the Public Guardian fee?
- **Key:** `impact-assessments:2017-92:6` (Options considered) and `…:7` (Preferred option) —
  `uksi/2017/503`.
- **Why a user asks it:** "what else did you consider" is the first question a committee asks;
  the options section is where the answer lives and is almost never cited.
- **Shape:** N · **Sourced:** document-outward
- **Accept / Reject / Amend:**

### I10 — Has anyone assessed whether the plastic straw ban actually worked?
- **Key:** ⚠ **NO KEY — DELIBERATELY.** The corpus holds the impact assessment (I1) and, on the
  evidence of the S7 PIR work, no post-implementation review for this instrument.
- **Why a user asks it:** it is the single most important question about any past measure, and
  the honest answer is usually "nobody has checked".
- **Shape:** N (negative control) · **Sourced:** outside-in
- **Accept / Reject / Amend:** ⚠ This question exists to test that the platform says *nobody has
  checked* rather than substituting the prediction. A "correct" answer here is an admission.

---

## CONSULTATIONS (10)

### N1 — What did the government consult on about reducing sewage discharges?
- **Key:** `consultations:government_consultations_storm-overflows-reducing-sewage-discharges:1`
  (12 May 2022) and `…_storm-overflows-discharge-reduction-plan:1` (24 Jul 2023).
- **Why a user asks it:** the user wants to know what was actually asked and what came back,
  before proposing something the consultation already rejected.
- **Shape:** O · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### N2 — Was there a consultation on the smoking age ban?
- **Key:** `consultations:government_consultations_creating-a-smokefree-generation-and-tackling-youth-vaping:1`
  (6 Dec 2023).
- **Why a user asks it:** the generational smoking ban is the highest-profile public health
  measure of the period, and vaping proposals are extremely common from the public.
- **Shape:** O · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### N3 — What did the government propose to change about building safety regulation?
- **Key:** `consultations:government_consultations_building-a-safer-future-proposals-for-reform-of-the-building-safety-regulatory-system:1`
  (31 Jul 2019).
- **Why a user asks it:** the consultation that produced the Building Safety Act; the reasoning
  is in the consultation, not the Act.
- **Shape:** O · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### N4 — Has the government consulted on gambling sponsorship?
- **Key:** `consultations:government_consultations_consultation-on-banning-unlicensed-gambling-sponsorship:1`.
- **Why a user asks it:** gambling advertising is one of the most frequent public proposal
  subjects.
- **Shape:** O · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### N5 — What has the government asked about AI and copyright?
- **Key:** `consultations:government_consultations_artificial-intelligence-and-ip-copyright-and-patents:1`
  (7 Jan 2022) and `…_artificial-intelligence-and-intellectual-property-call-for-views:1`
  (30 Nov 2020).
- **Why a user asks it:** the most contested technology-policy question in the UK right now.
- **Shape:** O · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### N6 — What was consulted on for leasehold reform?
- **Key:** `consultations:government_consultations_implementing-reforms-to-the-leasehold-system:1`
  (26 Nov 2018).
- **Why a user asks it:** pairs with C5 — the user wants both the parliamentary pressure and the
  government's own question.
- **Shape:** O · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### N7 — Is there guidance being consulted on for storm overflows?
- **Key:** `consultations:government_consultations_draft-information-and-guidance-on-storm-overflows:1`
  (24 Jan 2025).
- **Why a user asks it:** distinguishes a live consultation from a closed one — a distinction the
  platform must get right or it will tell a user to respond to something that closed in 2022.
- **Shape:** O · **Sourced:** document-outward
- **Accept / Reject / Amend:**

### N8 — What did the government consult on for net zero aviation?
- **Key:** `consultations:government_consultations_achieving-net-zero-aviation-by-2050:1` — *Jet
  Zero: our strategy for net zero aviation* (8 Sep 2021).
- **Why a user asks it:** aviation is the standard hard case in any net-zero proposal.
- **Shape:** O · **Sourced:** outside-in
- **Accept / Reject / Amend:**

### N9 — Was there a consultation about electrical safety in building regulations?
- **Key:** `consultations:government_consultations_building-regulations-electrical-safety:1`
  (27 Apr 2012).
- **Why a user asks it:** a deliberately OLD consultation — tests whether the platform surfaces
  historic material or silently favours the recent.
- **Shape:** O · **Sourced:** document-outward
- **Accept / Reject / Amend:**

### N10 — What did respondents say about the renters' reform proposals?
- **Key:** ⚠ **NO KEY.** A title search for "renters" across `consultations` returns nothing.
  Either the corpus does not hold it or it is titled differently.
- **Why a user asks it:** section 21 abolition is among the most common housing proposals from
  members of the public.
- **Shape:** O (gap probe) · **Sourced:** outside-in
- **Accept / Reject / Amend:** ⚠ Kept deliberately. A question the corpus cannot answer is a
  finding about the corpus, and the platform's required behaviour is to say so specifically
  rather than to answer from general knowledge (SEARCH_CONTRACT §6).

---

## What this set does NOT cover, named

- **The `explanatory` stream (S8 §4's third candidate) has no questions here.** It was not in
  §5's list of five collections. If `LEX_ROUTER_STREAMS_V2` is to be scored, explanatory material
  needs its own ten and does not have them.
- **`ico`, `fca-handbook`, `sentencing-council`, `planning-policy`** — four guidance collections
  with no topically-searchable titles, so no question here can key on them. They are as
  unevaluable as committees was before this file.
- **48% of impact assessments** whose `parentDocId` does not resolve to a named instrument.
- **Every case-law subject.** See finding 1. Ten questions, ten unverified subjects.
