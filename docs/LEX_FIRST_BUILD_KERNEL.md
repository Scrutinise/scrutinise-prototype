# LEX — THE FIRST BUILD EVER RUN ON THE PLATFORM

*Complete data dump for CCh review. Every row this build wrote, verbatim from the*
*production database (Neon `ep-old-dust-aboxi69a`), nothing summarised or paraphrased.*

- **Idea:** `452c5ade-3153-400a-bf48-3b71aaa52773`
- **Owner:** cl@scrutinise.org
- **Dumped:** 2026-08-24 20:53 UTC
- **Live:** https://www.scrutinise.org/ideas/create?ideaId=452c5ade-3153-400a-bf48-3b71aaa52773

⚠ **Read the provenance line on every section.** The elicitation is the USER'S OWN WORDS.
Everything under "the build" is LEX'S DRAFT, proposed and not yet accepted by a human —
`IdeaFieldState.status` is the field that says which.

---

## 0. How to read this — and the one thing that will otherwise mislead you

### ⚠⚠ THE CANONICAL `Idea` COLUMNS ARE EMPTY, AND THAT IS CORRECT

`Idea.challenge`, `Idea.chosenApproach`, `Idea.pivotalObstacle`, `Idea.summaryDiagnosis`
and the rest of the kernel columns in §1 are all **empty strings**. Nothing failed.

**The drafted kernel lives in `IdeaFieldState` (§5), as `proposal` JSON, at status**
**`AWAITING_CONFIRMATION`** — Lex has proposed it and *no human has agreed to any of it yet*.
A proposal is promoted into the canonical column only when the user accepts it. Reading §1
alone would tell you this build produced nothing; reading §5 tells you what it actually wrote.

| status | count | fields |
|---|---|---|
| **AWAITING_CONFIRMATION** (Lex drafted, nobody has agreed) | 16 | `actions`, `causes`, `challenge`, `chosenApproach`, `keywords`, `legalLandscape`, `leverage`, `pivotalObstacle`, `policyOptions`, `rootCause`, `summaryCoherentActions`, `summaryDiagnosis`, `summaryGuidingPolicy`, `title`, `whatItRulesOut`, `whoAffectedImpactCost` |
| **ACCEPTED** (the user's own words, from the elicitation) | 3 | `aboutYou`, `ideaNarrative`, `youAndIdeaNarrative` |
| **EMPTY** (this build does not cover them) | 4 | `anticipatedResponses`, `coherenceCheck`, `conditionsForSuccess`, `costSummary` |

### The run, in numbers

| | |
|---|---|
| status | **DONE**, 7 of 7 passes |
| framing arm | `B_CONTEXTUALISED` |
| wall clock | 5m 14s (2026-08-24T01:25:15.781Z → 2026-08-24T01:30:29.510Z) |
| tokens | 107,380 in / 21,446 out |
| cost | **6.7805p** |
| forks opened | 10 rows / 5 decision points, **0 resolved by a human** |
| failureReason | _(null)_ |

### What is NOT here

- **No `ProposalVersion`** — nothing has been published; §6 shows 0 rows.
- **No resolved forks** — 25-C's decision agenda has not been walked.
- **`Idea.title` is still "Untitled idea"** — the title is one of the 16 proposals.
- **Nothing has been cited into the canonical fields.** `legislationRefs`/`stageSearches` are
  retrieval artefacts (see the Appendix), not accepted content.

---

## 1. The idea record

_Provenance: the canonical row. **See §0 — the kernel columns here are deliberately empty.**_

| field | value |
|---|---|
| `id` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `creatorId` | 32c15f4f-2f93-424e-a8c3-19451b36d5ca |
| `title` | Untitled idea |
| `summaryDescription` | _(empty)_ |
| `summaryDiagnosis` | _(empty)_ |
| `summaryGuidingPolicy` | _(empty)_ |
| `summaryCoherentActions` | _(empty)_ |
| `backgroundResearch` | _(empty)_ |
| `initialThoughts` | _(empty)_ |
| `ideaType` | LEGISLATION |
| `govtArea` | _(empty)_ |
| `govtLevel` | NATIONAL |
| `country` | GB |
| `connectedIdeaIds` | _(object — below)_ |
| `diagnosis` | _(empty)_ |
| `guidingPolicy` | _(empty)_ |
| `rootCause` | _(empty)_ |
| `whoAffected` | _(empty)_ |
| `stage` | STAGE_1 |
| `visibility` | PRIVATE |
| `status` | DRAFT |
| `sector` | _(empty)_ |
| `proposedWording` | _(empty)_ |
| `wordingLocked` | false |
| `version` | 1 |
| `voteCount` | 0 |
| `passionScore` | _(empty)_ |
| `voteDistribution` | _(empty)_ |
| `commentCount` | 0 |
| `amendmentCount` | 0 |
| `endorsementCount` | 0 |
| `draftsmanEndorsementCount` | 0 |
| `viewCount` | 0 |
| `eligibleForNextStage` | false |
| `stageEligibleSince` | _(empty)_ |
| `maturityIndex` | _(object — below)_ |
| `maturityIndexDetail` | _(empty)_ |
| `maturityLastUpdated` | _(empty)_ |
| `credibilityWeightedRating` | _(empty)_ |
| `aiProvider` | GEMINI_FLASH |
| `aiChatHistory` | _(8121 chars of JSON — **Appendix: Idea.aiChatHistory**)_ |
| `aiChatSummary` | _(empty)_ |
| `aiCurrentField` | _(empty)_ |
| `aiSessionCount` | 0 |
| `ideaOrigin` | USER |
| `bannerColour` | _(empty)_ |
| `bannerText` | _(empty)_ |
| `userAdditionalNotes` | _(empty)_ |
| `ideaNarrative` | _(2934 chars — below)_ |
| `youAndIdeaNarrative` | _(1478 chars — below)_ |
| `ideaSlots` | _(empty)_ |
| `keywords` | _(object — below)_ |
| `ideaContext` | _(empty)_ |
| `legislationRefs` | _(19227 chars of JSON — **Appendix: Idea.legislationRefs**)_ |
| `stageSearches` | _(44343 chars of JSON — **Appendix: Idea.stageSearches**)_ |
| `orientation` | _(empty)_ |
| `lexPage` | COHERENT_ACTIONS |
| `challenge` | _(empty)_ |
| `whoAffectedImpactCost` | _(empty)_ |
| `legalLandscape` | _(empty)_ |
| `pivotalObstacle` | _(empty)_ |
| `chosenApproach` | _(empty)_ |
| `whatItRulesOut` | _(empty)_ |
| `leverage` | _(empty)_ |
| `anticipatedResponses` | _(empty)_ |
| `conditionsForSuccessLex` | _(empty)_ |
| `coherenceCheck` | _(empty)_ |
| `costSummary` | _(empty)_ |
| `referralLinkActive` | false |
| `ownershipTransferToken` | _(empty)_ |
| `ownershipTransferToId` | _(empty)_ |
| `ownershipTransferExpiry` | _(empty)_ |
| `communityId` | _(empty)_ |
| `proposalVisibility` | PRIVATE |
| `publishedProposalVersionId` | _(empty)_ |
| `proposalPublishedAt` | _(empty)_ |
| `proposalShareToken` | _(empty)_ |
| `createdAt` | 2026-08-22T01:24:21.603Z |
| `updatedAt` | 2026-08-24T01:30:29.023Z |
| `publishedAt` | _(empty)_ |
| `withdrawnAt` | _(empty)_ |
| `deletedAt` | _(empty)_ |
| `creator` | _(object — below)_ |

**`connectedIdeaIds`**

```json
[]
```

**`maturityIndex`**

```json
"0"
```

**`ideaNarrative`**

> The civil service is plagued by the same issues as any bureaucracy, but worse because it's a public service so it has none of the pressures that keep a private sector process efficient. Most seriously my experience of the civil service as I campaigned to get a VAT structure for care homes approved in Northern Ireland was a total lack of accountability. Not just a lack but the opposite: it seemed to be that every civil servant was incentived to minimise accountability and responsibility by putting the question out to as many co-respondents as possible so as to spread responsibility for the decision, both delaying and obfuscating the process and making it impossible for anyone to be blamed or held accountable for the result either in terms of getting the job done at all, or in terms of minimising the cost and time taken to achieve the objective (save Northern Irish care homes critical money that could be invested in repairs, renovations and improvements). Legal advisors to the process refused to even communicate with anyone outside the government machine instead of being accountable to the public they serve. There have also been plenty of examples of civil servants presiding over failure and being promoted. I want to build the systems and legislation to deliver proper accountability to the civil service, remove those who are not performing, measure who is performing, measure productivity with a goal to match private sector levels, and make sure specific individuals are responsible at every level for delivering the outcome required and cannot evade responsibility, and those who do well are rewarded and promoted, and those who fail are sacked form the civil service. Performance is measured not on who can avoid responsibility, but who is willing to take it and deliver results. results are measured against a metric that recognises when a failure was one of the system vs one of personal failure, and when it's the system the system is changed, and when it's the individual opporunities are there to repair failure or removal and demotion for repeated failure. Look at best practice in accountability from any area, sector or geography, how do we use legislation or any other suitable implementation to deliver the most effective accountable transparent civil service in the world
> This matters because gettign this right and removing the failures will save the taxpayer billions and slim down the civil service, make it a meritocracy, and turn it into a body that delivers for the public rather than one that opposes and puts a brake on everything politicians have been elected by the public to deliver. The cost is not just the finacial cost of perhaps 2x too many people employed, but the real financial cost of failure, and the impact on the public of massive delays and incompetence in delivery of public service which affects everyone. When it comes to the MOD, it puts the security of the realm at risk.

**`youAndIdeaNarrative`**

> What I want to happen: Not sure yet — I want MPs to regain full control and responsibility for all areas of government including the 1200 quangos and for the productivity and acountability all all areas of government to be a clear line of accountability from the top (MPs reporting to parliament) to the bottom. I want both legislation and organisational structures to be put in place to the best standards as understood by the best public and private centre research and practice worldwide. This includes both the structures of accountability in terms of hierarchy and reporting but also best practice in delivering accountability in the most effective way
> 
> Already ruled out: This will emerge as we investigate best practice
> 
> What I know that the record won’t show (my own experience): I've seen at first hand the blocks to transparency and accountability, civil servants who refuse to explain the reasoning behind their decisions or debate them, with nobody being accountable to explain their decisions. Lawyers for the government refusing to even meet with the Care home owners directly affecte by their incredible slowness and pig headedness in refusing to deal with the issue or speed up an element of their work, with nobody apparently able to tell them what to do, they seem a law unto themselves and took 4 years to do what a private lawyer did for me in an afternoon. Even after I gave them what the private lawyer did for me at my expense so the work was already done

**`keywords`**

```json
[]
```

**`creator`**

```json
{
  "email": "cl@scrutinise.org",
  "username": "charlie",
  "preferredName": "Charlie"
}
```

---

## 2. The elicitation — the user's own words

_Provenance: **USER TESTIMONY**, typed by Charlie. Not retrieved, not generated._

| field | value |
|---|---|
| `id` | 5914cd38-76ff-4c19-8c18-786bc83ef056 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `problem` | _(2934 chars — below)_ |
| `problemPresses` | 0 |
| `problemGateFired` | false |
| `goalKind` | UNSURE |
| `goalDetail` | _(619 chars — below)_ |
| `ruledOut` | This will emerge as we investigate best practice |
| `ownKnowledge` | _(690 chars — below)_ |
| `ownKnowledgeProvenance` | USER_TESTIMONY |
| `readingUrl` | _(empty)_ |
| `readingFileName` | _(empty)_ |
| `readingNote` | _(249 chars — below)_ |
| `readingStatus` | NOT_READ |
| `profileSkipped` | true |
| `understanding` | _(750 chars — below)_ |
| `corrections` | 0 |
| `status` | CONFIRMED |
| `confirmedAt` | 2026-08-22T01:56:52.185Z |
| `createdAt` | 2026-08-22T01:24:24.637Z |
| `updatedAt` | 2026-08-22T01:56:52.186Z |

**`problem`**

> The civil service is plagued by the same issues as any bureaucracy, but worse because it's a public service so it has none of the pressures that keep a private sector process efficient. Most seriously my experience of the civil service as I campaigned to get a VAT structure for care homes approved in Northern Ireland was a total lack of accountability. Not just a lack but the opposite: it seemed to be that every civil servant was incentived to minimise accountability and responsibility by putting the question out to as many co-respondents as possible so as to spread responsibility for the decision, both delaying and obfuscating the process and making it impossible for anyone to be blamed or held accountable for the result either in terms of getting the job done at all, or in terms of minimising the cost and time taken to achieve the objective (save Northern Irish care homes critical money that could be invested in repairs, renovations and improvements). Legal advisors to the process refused to even communicate with anyone outside the government machine instead of being accountable to the public they serve. There have also been plenty of examples of civil servants presiding over failure and being promoted. I want to build the systems and legislation to deliver proper accountability to the civil service, remove those who are not performing, measure who is performing, measure productivity with a goal to match private sector levels, and make sure specific individuals are responsible at every level for delivering the outcome required and cannot evade responsibility, and those who do well are rewarded and promoted, and those who fail are sacked form the civil service. Performance is measured not on who can avoid responsibility, but who is willing to take it and deliver results. results are measured against a metric that recognises when a failure was one of the system vs one of personal failure, and when it's the system the system is changed, and when it's the individual opporunities are there to repair failure or removal and demotion for repeated failure. Look at best practice in accountability from any area, sector or geography, how do we use legislation or any other suitable implementation to deliver the most effective accountable transparent civil service in the world
> This matters because gettign this right and removing the failures will save the taxpayer billions and slim down the civil service, make it a meritocracy, and turn it into a body that delivers for the public rather than one that opposes and puts a brake on everything politicians have been elected by the public to deliver. The cost is not just the finacial cost of perhaps 2x too many people employed, but the real financial cost of failure, and the impact on the public of massive delays and incompetence in delivery of public service which affects everyone. When it comes to the MOD, it puts the security of the realm at risk.

**`goalDetail`**

> I want MPs to regain full control and responsibility for all areas of government including the 1200 quangos and for the productivity and acountability all all areas of government to be a clear line of accountability from the top (MPs reporting to parliament) to the bottom. I want both legislation and organisational structures to be put in place to the best standards as understood by the best public and private centre research and practice worldwide. This includes both the structures of accountability in terms of hierarchy and reporting but also best practice in delivering accountability in the most effective way

**`ownKnowledge`**

> I've seen at first hand the blocks to transparency and accountability, civil servants who refuse to explain the reasoning behind their decisions or debate them, with nobody being accountable to explain their decisions. Lawyers for the government refusing to even meet with the Care home owners directly affecte by their incredible slowness and pig headedness in refusing to deal with the issue or speed up an element of their work, with nobody apparently able to tell them what to do, they seem a law unto themselves and took 4 years to do what a private lawyer did for me in an afternoon. Even after I gave them what the private lawyer did for me at my expense so the work was already done

**`readingNote`**

> Look for anything you can find online or in the corpus both examples for promotions for failure, examples of best practice, how is the best accountability achieved anywhere and how do we implement it across all government funded structures in the UK

**`understanding`**

> You're aiming to tackle the deep-seated lack of accountability and efficiency within the civil service, which you've experienced firsthand as a frustrating and costly impediment to public service delivery. You want to establish clear lines of responsibility from top to bottom, ensuring individuals are accountable for outcomes, and that performance is measured and rewarded, or failure addressed. This will involve implementing new legislation and organisational structures based on global best practices. I'm reading that you're open to exploring various solutions, but you're firm on the principle of MPs regaining full control and responsibility over all government areas, including quangos. Please tell me if I've misunderstood any part of this.

---

## 3. The build

### Build v1 — `a7f7151c-06e6-44d4-be42-2d4f1a1a5f2b`

| field | value |
|---|---|
| `id` | a7f7151c-06e6-44d4-be42-2d4f1a1a5f2b |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `version` | 1 |
| `status` | DONE |
| `framing` | B_CONTEXTUALISED |
| `passesComplete` | 7 |
| `currentPass` | _(empty)_ |
| `summaryMessage` | _(534 chars — below)_ |
| `queryUsed` | B_CONTEXTUALISED :: civil service public failure accountability responsibility cost deliver sector process accountable those system private care homes northern lack :: context(1359 chars) |
| `startedAt` | 2026-08-24T01:25:15.781Z |
| `completedAt` | 2026-08-24T01:30:29.510Z |
| `failureReason` | _(empty)_ |
| `cancelRequested` | false |
| `notifyEmail` | true |
| `tokensIn` | 107380 |
| `tokensOut` | 21446 |
| `estCostPence` | _(object — below)_ |
| `createdAt` | 2026-08-24T01:25:15.696Z |
| `updatedAt` | 2026-08-24T01:30:29.513Z |

**`summaryMessage`**

> I've drafted the strategy kernel, including the diagnosis, guiding policy, and coherent actions, based on your input. I'm least sure about the specific legal mechanisms for enforcing individual accountability and the precise financial cost of current inefficiencies. The research did not definitively settle whether existing legislation, specifically the Constitutional Reform and Governance Act 2010, already provides sufficient power to address the identified accountability issues, or if new primary legislation is truly necessary.

**`estCostPence`**

```json
"6.7805"
```

#### Uncertainties — what Lex says it is least sure about, per field

_Provenance: LEX, self-reported. §4.2._

**`causes`** — The extent to which civil service unions or other internal advocacy groups contribute to the persistence of diffused accountability is not explored in the current information.

**`actions`** — I am uncertain about the level of detail and frequency of public reporting on individual 'outcome owners' that would be effective without becoming overly burdensome or revealing sensitive operational information.

**`instrument`** — I am unsure about the specific legal mechanisms within primary legislation that would best define and enforce individual accountability without creating unintended bureaucratic burdens or legal challenges.

**`chosenApproach`** — No source provides a direct, quantified measure of the 'pervasive lack of individual accountability' or its direct causal link to specific levels of inefficiency, delayed public services, or financial waste, which would strengthen the diagnosis.

**`summaryGuidingPolicy`** — I drafted this as Primary legislation · national · reserved, and then the research found The Constitutional Reform and Governance Act 2010, section 3(1), confers on the Minister for the Civil Service the power to manage the civil service (excluding the diplomatic service)., which exists, and what was retrieved does not settle whether it reaches this. Before anything else, decide whether you need a new Act at all.

**`whoAffectedImpactCost`** — The precise financial cost of inefficiency and lack of accountability is not established in the provided information and would require detailed economic analysis.


#### The seven passes, in order

_Provenance: LEX. `carry` is what each pass handed the next._

##### Pass 1 — `ORIENT`

| field | value |
|---|---|
| `key` | ORIENT |
| `carry` | _(object — below)_ |
| `label` | Understanding the terrain |
| `detail` | Searching the corpus, and asking who else has solved a problem shaped like this. |
| `output` | 231 sources read; 0 cited |
| `status` | DONE |
| `usages` | _(object — below)_ |
| `activity` | _(empty)_ |
| `startedAt` | 2026-08-24T01:25:16.251Z |
| `completedAt` | 2026-08-24T01:25:42.492Z |
| `failureReason` | _(empty)_ |

**`carry`**

```json
{
  "orientation": "The user's experience highlights a perceived lack of accountability and efficiency within the civil service, particularly concerning decision-making processes and the responsiveness of government legal advisors. This aligns with broader parliamentary concerns about civil service accountability and the effectiveness of public bodies. The Public Bodies Act 2011 aimed to increase accountability for actions carried out on behalf of the state by providing ministers with powers to abolish, merge, or modify public bodies, with a focus on improving efficiency, effectiveness, economy, and securing appropriate accountability (Public Bodies Act 2011, ss. 1, 3, 4, 8, 10, 11, 16; Explanatory Notes to Public Bodies Act 2011, paras. 24, 30; CABINET OFFICE — Public Bodies Reform, 2011-12-15). There have been ongoing debates and reports from committees like the Public Administration Select Committee (PASC) and the Constitution Committee regarding the accountability of civil servants and the relationship between government and arm's-length bodies (Report: 6th Report - The accountability of civil servants — Constitution Committee, 2012-11-20; Report: 1st Report - Who's accountable? Relationships between Government and arm's-length bodies — Public Administration Committee, 2014-11-10). Recent discussions, such as the Independent Review of Governance and Accountability in the Civil Service by Lord Maude of Horsham, continue to address these issues (Cabinet Office — Update on Government Reform, 2023-11-13). The National Audit Office (NAO) also plays a role in scrutinizing public spending and reporting on the performance and assurance of major government projects, which implicitly touches upon accountability (major projects authority annual report 2012 13 and government project assurance; assurance for major projects).\n\nOn \"Who else has this problem, outside this sector, and what have they built to deal with it?\" — Reasoning here rather than citing from the corpus: Other sectors and geographies have developed robust accountability frameworks that could offer insights. For instance, in the private sector, publicly traded companies are subject to stringent corporate governance regulations (e.g., Sarbanes-Oxley Act in the US, UK Corporate Governance Code) that mandate clear lines of responsibility, independent board oversight, and transparent reporting to shareholders. These frameworks often include performance-based incentives and consequences for failure, directly linking individual and team performance to organizational outcomes. Another example is the military, which has highly structured accountability mechanisms, clear hierarchies of command, and established procedures for evaluating performance and addressing failures, often with severe consequences. Internationally, some public administrations, such as those in Singapore or New Zealand, are often cited for their focus on performance management, meritocracy, and clear accountability structures, including robust mechanisms for performance appraisal and consequence management for civil servants. These often involve performance agreements, regular reviews, and a culture that emphasizes results and individual ownership.",
  "searchFailed": false
}
```

**`usages`**

```json
[
  {
    "model": "gemini-2.5-flash",
    "tokensIn": 34040,
    "tokensOut": 1710,
    "echoedModel": "gemini-2.5-flash"
  }
]
```

##### Pass 2 — `DIAGNOSIS`

| field | value |
|---|---|
| `key` | DIAGNOSIS |
| `carry` | _(object — below)_ |
| `label` | Drafting the diagnosis |
| `detail` | What is actually going wrong, what causes it, and what has stopped anyone fixing it. |
| `output` | 5 causes, 4 recorded alternatives |
| `status` | DONE |
| `usages` | _(object — below)_ |
| `activity` | _(empty)_ |
| `startedAt` | 2026-08-24T01:25:46.610Z |
| `completedAt` | 2026-08-24T01:25:58.440Z |
| `failureReason` | _(empty)_ |

**`carry`**

```json
{
  "diagnosis": "The civil service suffers from a pervasive lack of individual accountability, leading to inefficiency, delayed public services, and significant financial waste, exacerbated by incentives that encourage diffused responsibility rather than decisive action.\nThe civil service's pervasive lack of accountability stems from a root cause where existing incentives encourage the diffusion of responsibility rather than individual ownership of outcomes. This problem persists because there is significant political and cultural resistance to implementing robust, individual-level performance management and consequence systems, as the current diffused accountability benefits those who prefer to avoid personal responsibility and maintain the status quo.\nRoot cause: Incentives within the civil service encourage diffusion of responsibility rather than individual ownership of outcomes.\nPivotal obstacle: The political and cultural resistance to implementing robust, individual-level performance management and consequence systems, as the current diffused accountability benefits those who prefer to avoid personal responsibility and maintain the status quo."
}
```

**`usages`**

```json
[
  {
    "model": "gemini-2.5-flash",
    "tokensIn": 5625,
    "tokensOut": 1911,
    "echoedModel": "gemini-2.5-flash"
  }
]
```

##### Pass 3 — `APPROACH`

| field | value |
|---|---|
| `key` | APPROACH |
| `carry` | _(object — below)_ |
| `label` | Drafting the approach |
| `detail` | The approach to the obstacle, the instrument it would use, and what it rules out. |
| `output` | 3 approaches; instrument: Primary legislation · national · reserved |
| `status` | DONE |
| `usages` | _(object — below)_ |
| `activity` | _(empty)_ |
| `startedAt` | 2026-08-24T01:26:02.213Z |
| `completedAt` | 2026-08-24T01:26:12.964Z |
| `failureReason` | _(empty)_ |

**`carry`**

```json
{
  "approach": "Implement a statutory framework for individual civil servant accountability, linking performance to clear, measurable outcomes and consequences.\nThis approach exploits the asymmetry that civil servants currently operate under a system where diffused responsibility is incentivized. By creating a statutory obligation for individual accountability, it shifts the default from collective to personal ownership, making it harder to evade responsibility and creating a legal basis for performance-based consequences.\nChoosing a statutory framework rules out relying solely on internal civil service reforms or enhanced parliamentary oversight. It rejects the idea that cultural change alone will be sufficient to overcome the deep-seated incentives for diffused responsibility. It also means foregoing the flexibility and potentially quicker implementation of non-legislative approaches, instead committing to a more rigid, legally binding structure.",
  "instrument": "Primary legislation · national · reserved"
}
```

**`usages`**

```json
[
  {
    "model": "gemini-2.5-flash",
    "tokensIn": 5989,
    "tokensOut": 1840,
    "echoedModel": "gemini-2.5-flash"
  }
]
```

##### Pass 4 — `ACTIONS`

| field | value |
|---|---|
| `key` | ACTIONS |
| `carry` | _(object — below)_ |
| `label` | Drafting the actions |
| `detail` | The coordinated steps that would execute the approach, and who does each one. |
| `output` | 4 actions drafted |
| `status` | DONE |
| `usages` | _(object — below)_ |
| `activity` | _(empty)_ |
| `startedAt` | 2026-08-24T01:26:16.208Z |
| `completedAt` | 2026-08-24T01:26:26.413Z |
| `failureReason` | _(empty)_ |

**`carry`**

```json
{}
```

**`usages`**

```json
[
  {
    "model": "gemini-2.5-flash",
    "tokensIn": 2288,
    "tokensOut": 1365,
    "echoedModel": "gemini-2.5-flash"
  }
]
```

##### Pass 5 — `RESEARCH`

| field | value |
|---|---|
| `key` | RESEARCH |
| `carry` | _(6059 chars of JSON — **Appendix: carry**)_ |
| `label` | Researching what the draft revealed |
| `detail` | Interrogating the corpus about the draft — starting with whether a power to do this already exists. |
| `output` | 7 questions asked; reviewed 600 sources; 69 findings, 1 contradicting the draft; 29 stated gaps — ⚠ an existing power may remove the need for a Bill |
| `status` | DONE |
| `usages` | _(object — below)_ |
| `activity` | _(empty)_ |
| `startedAt` | 2026-08-24T01:26:29.889Z |
| `completedAt` | 2026-08-24T01:30:04.817Z |
| `failureReason` | _(empty)_ |

**`usages`**

```json
[
  {
    "model": "gemini-2.5-flash",
    "tokensIn": 4680,
    "tokensOut": 2271
  },
  {
    "model": "gemini-2.5-flash",
    "tokensIn": 7126,
    "tokensOut": 2554
  },
  {
    "model": "gemini-2.5-flash",
    "tokensIn": 4628,
    "tokensOut": 878
  },
  {
    "model": "gemini-2.5-flash",
    "tokensIn": 10387,
    "tokensOut": 1714
  },
  {
    "model": "gemini-2.5-flash",
    "tokensIn": 5415,
    "tokensOut": 1796
  },
  {
    "model": "gemini-2.5-flash",
    "tokensIn": 8318,
    "tokensOut": 2798
  },
  {
    "model": "gemini-2.5-flash",
    "tokensIn": 1841,
    "tokensOut": 653
  },
  {
    "model": "gemini-2.5-flash",
    "tokensIn": 5247,
    "tokensOut": 117,
    "echoedModel": "gemini-2.5-flash"
  }
]
```

##### Pass 6 — `REVISE`

| field | value |
|---|---|
| `key` | REVISE |
| `carry` | _(object — below)_ |
| `label` | Revising in the light of it |
| `detail` | Rewriting the kernel — especially the causes — and keeping every place the evidence changed my mind. |
| `output` | 4 causes rewritten; 1 place the evidence changed the draft; 0 forks settled, 0 opened |
| `status` | DONE |
| `usages` | _(object — below)_ |
| `activity` | _(empty)_ |
| `startedAt` | 2026-08-24T01:30:08.139Z |
| `completedAt` | 2026-08-24T01:30:18.997Z |
| `failureReason` | _(empty)_ |

**`carry`**

```json
{
  "revision": "The civil service's pervasive lack of individual accountability stems from incentives that encourage diffused responsibility, persisting due to political and cultural resistance to robust performance management and consequence systems that would challenge the status quo.\nOur guiding policy is to establish a statutory framework that legally mandates individual civil servant accountability for outcome delivery, thereby shifting incentives from diffused responsibility to personal ownership and overcoming political and cultural resistance to robust performance management.\nThe Cabinet Office, with the Ministry of Justice, will draft a Civil Service Accountability Bill defining legal duties for senior civil servants and empowering the Civil Service Commission to create a performance management framework. Departments will implement reporting structures assigning 'outcome owners' with public reporting, and the National Audit Office will gain enhanced auditing powers for individual accountability, reporting directly to Parliament.\n\nWHERE THE RESEARCH CHANGED THE DRAFT:\n- guidingPolicy:instrument: first \"Primary legislation · national · reserved\" → now \"The Constitutional Reform and Governance Act 2010, section 3(1), confers on the Minister for the Civil Service the power to manage the civil service (excluding the diplomatic service).\" (The existence of an existing statutory power for the Minister for the Civil Service to manage the civil service suggests that primary legislation may not be strictly necessary for all aspects of the proposed reforms, requiring a re-evaluation of the instrument.)",
  "diagnosis": "The civil service's pervasive lack of individual accountability stems from incentives that encourage diffused responsibility, persisting due to political and cultural resistance to robust performance management and consequence systems that would challenge the status quo.\nOur guiding policy is to establish a statutory framework that legally mandates individual civil servant accountability for outcome delivery, thereby shifting incentives from diffused responsibility to personal ownership and overcoming political and cultural resistance to robust performance management.\nThe Cabinet Office, with the Ministry of Justice, will draft a Civil Service Accountability Bill defining legal duties for senior civil servants and empowering the Civil Service Commission to create a performance management framework. Departments will implement reporting structures assigning 'outcome owners' with public reporting, and the National Audit Office will gain enhanced auditing powers for individual accountability, reporting directly to Parliament.\n\nWHERE THE RESEARCH CHANGED THE DRAFT:\n- guidingPolicy:instrument: first \"Primary legislation · national · reserved\" → now \"The Constitutional Reform and Governance Act 2010, section 3(1), confers on the Minister for the Civil Service the power to manage the civil service (excluding the diplomatic service).\" (The existence of an existing statutory power for the Minister for the Civil Service to manage the civil service suggests that primary legislation may not be strictly necessary for all aspects of the proposed reforms, requiring a re-evaluation of the instrument.)"
}
```

**`usages`**

```json
[
  {
    "model": "gemini-2.5-flash",
    "tokensIn": 4420,
    "tokensOut": 1432,
    "echoedModel": "gemini-2.5-flash"
  }
]
```

##### Pass 7 — `ADVERSARIAL`

| field | value |
|---|---|
| `key` | ADVERSARIAL |
| `carry` | _(object — below)_ |
| `label` | Reading it back as a hostile clerk |
| `detail` | Where is it weakest, what can it not answer, what will it be asked that it has no answer to. |
| `output` | 6 issues raised against the whole proposal, read by gemini-2.5-flash |
| `status` | DONE |
| `usages` | _(object — below)_ |
| `activity` | _(empty)_ |
| `startedAt` | 2026-08-24T01:30:22.986Z |
| `completedAt` | 2026-08-24T01:30:27.116Z |
| `failureReason` | _(empty)_ |

**`carry`**

```json
{}
```

**`usages`**

```json
[
  {
    "model": "gemini-2.5-flash",
    "tokensIn": 6717,
    "tokensOut": 308
  },
  {
    "model": "gemini-2.5-flash",
    "tokensIn": 659,
    "tokensOut": 99,
    "echoedModel": "gemini-2.5-flash"
  }
]
```

---

## 4. Forks — where Lex had to choose (10 rows)

_Provenance: LEX. Two alternatives per decision point. `resolved=false` means NO HUMAN_
_HAS DECIDED YET — that is 25-C's job, not this build's._

### chosenApproach :: approach:chosen

**Lex chose:** Implement a statutory framework for individual civil servant accountability, linking performance to clear, measurable outcomes and consequences.

**Why (recommendationReason):** This approach directly tackles the pivotal obstacle by creating a legal imperative for individual accountability, thereby overriding the existing incentives for diffused responsibility and providing a strong basis for enforcing performance and consequences.

**Resolved by a human:** **no**

- **Instead of (alt 0):** Introduce comprehensive internal civil service reforms focused on cultural change and leadership development.
  - _Case for it:_ A cultural shift, driven by strong leadership and internal development programs, could foster a greater sense of ownership and responsibility from within, potentially achieving more sustainable change than top-down legislation.
- **Instead of (alt 1):** Enhance parliamentary oversight and select committee powers to scrutinize civil service performance.
  - _Case for it:_ Strengthening external scrutiny from Parliament could create stronger pressure on civil servants to deliver results and be accountable, leveraging existing democratic mechanisms without requiring new primary legislation.

### chosenApproach :: policyOptions:chosenApproach

**Lex chose:** Implement a statutory framework for individual civil servant accountability, linking performance to clear, measurable outcomes and consequences.

**Why (recommendationReason):** This approach directly addresses the user's core concern about a lack of individual accountability and the diffusion of responsibility. By embedding accountability in legislation, it creates a clear legal basis for performance management, reward, and sanction, making it harder for civil servants to evade responsibility. It aligns with the user's desire for MPs to regain control and for clear lines of accountability from top to bottom.

**Resolved by a human:** **no**

- **Instead of (alt 0):** Reform internal civil service HR and performance management systems to create a meritocratic culture with clear individual objectives, regular performance reviews, and robust consequence management.
  - _Case for it:_ This approach focuses on cultural and systemic change from within, which can be more adaptable and less rigid than a statutory approach. It allows for tailoring performance metrics to specific roles and departments, promoting a culture of ownership and results. It could be implemented through executive action and internal policy changes, potentially facing less immediate political friction than primary legislation. Reasoning here rather than citing: This mirrors best practices in high-performing private sector organisations and some international public administrations, where internal systems drive accountability and meritocracy.
- **Instead of (alt 1):** Enhance parliamentary oversight and transparency mechanisms, empowering select committees and the National Audit Office (NAO) to scrutinize individual civil servant performance and decision-making more directly.
  - _Case for it:_ This approach leverages existing democratic accountability structures and public scrutiny. Strengthening the powers of bodies like the NAO, which already scrutinizes public spending and project performance [major projects authority annual report 2012 13 and government project assurance], could provide an external check on civil service accountability. It aligns with the user's desire for MPs to regain control and for transparency. Reasoning here rather than citing: Increased transparency about individual performance and decision-making could create public pressure for accountability without requiring a complete overhaul of civil service employment law.

### pivotalObstacle :: diagnosis:pivotalObstacle

**Lex chose:** The political and cultural resistance to implementing robust, individual-level performance management and consequence systems, as the current diffused accountability benefits those who prefer to avoid personal responsibility and maintain the status quo.

**Why (recommendationReason):** This choice directly addresses why the problem has persisted despite ongoing debates and reforms (e.g., Public Bodies Act 2011). It highlights that the existing system, while inefficient for the public, provides a benefit (avoidance of responsibility) to certain actors within the civil service, creating an inherent resistance to change that requires more than just new legislation.

**Resolved by a human:** **no**

- **Instead of (alt 0):** The inherent complexity and scale of government operations, making it difficult to establish clear lines of individual accountability across numerous departments and arm's-length bodies.
  - _Case for it:_ The sheer size and interconnectedness of government functions, especially with 1200 quangos as mentioned by the user, inherently make it challenging to pinpoint individual responsibility, even with the best intentions.
- **Instead of (alt 1):** Lack of sustained political will to enforce accountability mechanisms, often due to short electoral cycles and focus on policy delivery over internal reform.
  - _Case for it:_ Politicians may introduce legislation, but the consistent, long-term effort required to embed a culture of accountability and enforce consequences can wane, especially when immediate policy wins are prioritized over difficult internal reforms.

### rootCause :: diagnosis:rootCause

**Lex chose:** Incentives within the civil service encourage diffusion of responsibility rather than individual ownership of outcomes.

**Why (recommendationReason):** This cause directly addresses the user's core observation that civil servants are 'incentived to minimise accountability and responsibility by putting the question out to as many co-respondents as possible' and that 'performance is measured not on who can avoid responsibility, but who is willing to take it and deliver results'. It underpins the other issues of lack of metrics and consequences.

**Resolved by a human:** **no**

- **Instead of (alt 0):** Lack of clear, measurable performance metrics tied to individual accountability and outcomes.
  - _Case for it:_ Without clear metrics, it's impossible to objectively assess performance, reward success, or address failure. This directly impacts the user's desire to 'measure who is performing' and 'measure productivity with a goal to match private sector levels'.
- **Instead of (alt 1):** Absence of effective consequences for underperformance and rewards for high performance.
  - _Case for it:_ Even with clear incentives and metrics, if there are no real consequences for failure or rewards for success, the system will not change. The user explicitly states a desire for 'those who do well are rewarded and promoted, and those who fail are sacked form the civil service'.

### summaryGuidingPolicy :: guidingPolicy:instrument

**Lex chose:** Primary legislation · national · reserved

**Why (recommendationReason):** The guiding policy is to implement a statutory framework for individual civil servant accountability, linking performance to clear, measurable outcomes and consequences. This leverages the current system's incentive for diffused responsibility by creating a legal obligation for personal ownership, making evasion of responsibility harder. This choice rules out relying solely on internal reforms or enhanced parliamentary oversight to achieve the desired level of accountability.

**Resolved by a human:** **no**

- **Instead of (alt 0):** Use the existing power: The Constitutional Reform and Governance Act 2010, section 3(1), confers on the Minister for the Civil Service the power to manage the civil service (excluding the diplomatic service).
  - _Case for it:_ ⚠ THE RESEARCH FOUND AN EXISTING POWER. The Constitutional Reform and Governance Act 2010, section 3(1), confers on the Minister for the Civil Service the power to manage the civil service (excluding the diplomatic service). — it exists, and what was retrieved does not settle whether it reaches this. The findings confirm the Minister for the Civil Service has a general power to manage the civil service, but it is unclear whether this power extends to all aspects of the proposed primary legislation without further detail on the specific changes intended.
- **Instead of (alt 1):** Use the existing power: The Constitutional Reform and Governance Act 2010, section 3(1), confers on the Minister for the Civil Service the power to manage the civil service (excluding the diplomatic service).
  - _Case for it:_ ⚠ THE RESEARCH FOUND AN EXISTING POWER. The Constitutional Reform and Governance Act 2010, section 3(1), confers on the Minister for the Civil Service the power to manage the civil service (excluding the diplomatic service). — it exists, and what was retrieved does not settle whether it reaches this. The findings confirm the Minister for the Civil Service has a general power to manage the civil service, but it is unclear whether this power extends to all aspects of the proposed primary legislation without further detail on the specific changes intended.

---

## 5. Field states — what is actually stored against each kernel field (23 rows)

_Provenance: the join between the build and the product. **`status` is the load-bearing_
_column**: `AWAITING_CONFIRMATION` = Lex proposed it and nobody has agreed to it yet._

| fieldKey | status | value length | has proposal |
|---|---|---|---|
| `aboutYou` | **ACCEPTED** | 34 | no |
| `actions` | **AWAITING_CONFIRMATION** | 0 | yes |
| `anticipatedResponses` | **EMPTY** | 0 | no |
| `causes` | **AWAITING_CONFIRMATION** | 0 | yes |
| `challenge` | **AWAITING_CONFIRMATION** | 0 | yes |
| `chosenApproach` | **AWAITING_CONFIRMATION** | 0 | yes |
| `coherenceCheck` | **EMPTY** | 0 | no |
| `conditionsForSuccess` | **EMPTY** | 0 | no |
| `costSummary` | **EMPTY** | 0 | no |
| `ideaNarrative` | **ACCEPTED** | 2934 | no |
| `keywords` | **AWAITING_CONFIRMATION** | 0 | yes |
| `legalLandscape` | **AWAITING_CONFIRMATION** | 0 | yes |
| `leverage` | **AWAITING_CONFIRMATION** | 0 | yes |
| `pivotalObstacle` | **AWAITING_CONFIRMATION** | 0 | yes |
| `policyOptions` | **AWAITING_CONFIRMATION** | 0 | yes |
| `rootCause` | **AWAITING_CONFIRMATION** | 0 | yes |
| `summaryCoherentActions` | **AWAITING_CONFIRMATION** | 0 | yes |
| `summaryDiagnosis` | **AWAITING_CONFIRMATION** | 0 | yes |
| `summaryGuidingPolicy` | **AWAITING_CONFIRMATION** | 0 | yes |
| `title` | **AWAITING_CONFIRMATION** | 0 | yes |
| `whatItRulesOut` | **AWAITING_CONFIRMATION** | 0 | yes |
| `whoAffectedImpactCost` | **AWAITING_CONFIRMATION** | 0 | yes |
| `youAndIdeaNarrative` | **ACCEPTED** | 1478 | no |

### `aboutYou` — ACCEPTED

**Accepted value:**

> Operator, no political background.

### `actions` — AWAITING_CONFIRMATION

**Accepted value:**

_(null — nothing accepted)_

**Proposal (awaiting the user):**

```json
{
  "value": "",
  "rationale": null
}
```

### `anticipatedResponses` — EMPTY

**Accepted value:**

_(null — nothing accepted)_

### `causes` — AWAITING_CONFIRMATION

**Accepted value:**

_(null — nothing accepted)_

**Proposal (awaiting the user):**

```json
{
  "value": "",
  "rationale": null
}
```

### `challenge` — AWAITING_CONFIRMATION

**Accepted value:**

_(null — nothing accepted)_

**Proposal (awaiting the user):**

```json
{
  "value": "The civil service suffers from a pervasive lack of individual accountability, leading to inefficiency, delayed public services, and significant financial waste, exacerbated by incentives that encourage diffused responsibility rather than decisive action.",
  "rationale": null
}
```

### `chosenApproach` — AWAITING_CONFIRMATION

**Accepted value:**

_(null — nothing accepted)_

**Proposal (awaiting the user):**

```json
{
  "value": "Implement a statutory framework for individual civil servant accountability, linking performance to clear, measurable outcomes and consequences.",
  "rationale": null
}
```

### `coherenceCheck` — EMPTY

**Accepted value:**

_(null — nothing accepted)_

### `conditionsForSuccess` — EMPTY

**Accepted value:**

_(null — nothing accepted)_

### `costSummary` — EMPTY

**Accepted value:**

_(null — nothing accepted)_

### `ideaNarrative` — ACCEPTED

**Accepted value:**

> The civil service is plagued by the same issues as any bureaucracy, but worse because it's a public service so it has none of the pressures that keep a private sector process efficient. Most seriously my experience of the civil service as I campaigned to get a VAT structure for care homes approved in Northern Ireland was a total lack of accountability. Not just a lack but the opposite: it seemed to be that every civil servant was incentived to minimise accountability and responsibility by putting the question out to as many co-respondents as possible so as to spread responsibility for the decision, both delaying and obfuscating the process and making it impossible for anyone to be blamed or held accountable for the result either in terms of getting the job done at all, or in terms of minimising the cost and time taken to achieve the objective (save Northern Irish care homes critical money that could be invested in repairs, renovations and improvements). Legal advisors to the process refused to even communicate with anyone outside the government machine instead of being accountable to the public they serve. There have also been plenty of examples of civil servants presiding over failure and being promoted. I want to build the systems and legislation to deliver proper accountability to the civil service, remove those who are not performing, measure who is performing, measure productivity with a goal to match private sector levels, and make sure specific individuals are responsible at every level for delivering the outcome required and cannot evade responsibility, and those who do well are rewarded and promoted, and those who fail are sacked form the civil service. Performance is measured not on who can avoid responsibility, but who is willing to take it and deliver results. results are measured against a metric that recognises when a failure was one of the system vs one of personal failure, and when it's the system the system is changed, and when it's the individual opporunities are there to repair failure or removal and demotion for repeated failure. Look at best practice in accountability from any area, sector or geography, how do we use legislation or any other suitable implementation to deliver the most effective accountable transparent civil service in the world
> This matters because gettign this right and removing the failures will save the taxpayer billions and slim down the civil service, make it a meritocracy, and turn it into a body that delivers for the public rather than one that opposes and puts a brake on everything politicians have been elected by the public to deliver. The cost is not just the finacial cost of perhaps 2x too many people employed, but the real financial cost of failure, and the impact on the public of massive delays and incompetence in delivery of public service which affects everyone. When it comes to the MOD, it puts the security of the realm at risk.

### `keywords` — AWAITING_CONFIRMATION

**Accepted value:**

_(null — nothing accepted)_

**Proposal (awaiting the user):**

```json
{
  "value": [
    "Civil Service",
    "Accountability",
    "Performance",
    "Bureaucracy",
    "Public Sector Reform",
    "Transparency",
    "Meritocracy",
    "Government Efficiency"
  ],
  "rationale": null
}
```

### `legalLandscape` — AWAITING_CONFIRMATION

**Accepted value:**

_(null — nothing accepted)_

**Proposal (awaiting the user):**

```json
{
  "value": {
    "currentLaw": "The primary legislative framework governing the civil service in the UK is the Constitutional Reform and Governance Act 2010. This Act establishes the Civil Service Commission and outlines principles for recruitment based on merit (Constitutional Reform and Governance Act 2010, ss. 1, 2; Explanatory Notes to Constitutional Reform and Governance Act 2010, para. 102). The Minister for the Civil Service holds the power to manage the civil service (Constitutional Reform and Governance Act 2010, s. 3). Additionally, the Public Bodies Act 2011 provides ministers with powers to reform public bodies to enhance accountability, efficiency, and effectiveness (Public Bodies Act 2011, ss. 1, 8). The National Audit Office (NAO) scrutinizes public spending and reports to Parliament, providing a layer of financial accountability for government departments and major projects (major projects authority annual report 2012 13 and government project assurance; assurance for major projects). Select committees in Parliament also play a crucial role in scrutinizing the expenditure, administration, and policy of government departments and associated public bodies, holding civil servants and ministers to account (Report: 6th Report - The accountability of civil servants — Constitution Committee, 2012-11-20; Report: 10th Report - Interests of Committee Chairs: a consultation — Committee on Standards, 2014-01-20).",
    "whereItFails": "Based on the user's testimony and parliamentary discussions, the current framework appears to fall short in several key areas. The user highlights a 'total lack of accountability' and a culture where civil servants are incentivized to 'minimise accountability and responsibility,' leading to delays and obfuscation. This resonates with concerns raised in parliamentary debates about the difficulty in identifying who is responsible when things go wrong (Ministers and Civil Servants, 2008-10-30). While legislation like the Public Bodies Act 2011 aims to improve accountability, the practical implementation and cultural aspects within the civil service seem to hinder its effectiveness. The user's experience with legal advisors refusing direct communication and perceived slowness suggests a lack of transparency and responsiveness, which existing accountability mechanisms may not adequately address. The idea of civil servants presiding over failure and being promoted also points to a disconnect between performance and career progression, indicating that current measurement and consequence management systems are insufficient. Furthermore, the sheer number of 'quangos' (quasi-autonomous non-governmental organizations) and the difficulty for MPs to maintain full control and responsibility over all areas of government suggest a complex and potentially fragmented accountability landscape (Lords: Quangos, 1994-01-19; Report: 1st Report - Who's accountable? Relationships between Government and arm's-length bodies — Public Administration Committee, 2014-11-10). The current system may lack the clear, individual-level accountability, performance measurement, and robust consequence management that the user desires, making it difficult to differentiate between systemic and personal failures and to reward or penalize accordingly."
  },
  "rationale": null
}
```

### `leverage` — AWAITING_CONFIRMATION

**Accepted value:**

_(null — nothing accepted)_

**Proposal (awaiting the user):**

```json
{
  "value": "This approach exploits the asymmetry that civil servants currently operate under a system where diffused responsibility is incentivized. By creating a statutory obligation for individual accountability, it shifts the default from collective to personal ownership, making it harder to evade responsibility and creating a legal basis for performance-based consequences.",
  "rationale": null
}
```

### `pivotalObstacle` — AWAITING_CONFIRMATION

**Accepted value:**

_(null — nothing accepted)_

**Proposal (awaiting the user):**

```json
{
  "value": "The political and cultural resistance to implementing robust, individual-level performance management and consequence systems, as the current diffused accountability benefits those who prefer to avoid personal responsibility and maintain the status quo.",
  "rationale": null
}
```

### `policyOptions` — AWAITING_CONFIRMATION

**Accepted value:**

_(null — nothing accepted)_

**Proposal (awaiting the user):**

```json
{
  "value": "",
  "rationale": null
}
```

### `rootCause` — AWAITING_CONFIRMATION

**Accepted value:**

_(null — nothing accepted)_

**Proposal (awaiting the user):**

```json
{
  "value": "Incentives within the civil service encourage diffusion of responsibility rather than individual ownership of outcomes.",
  "rationale": null
}
```

### `summaryCoherentActions` — AWAITING_CONFIRMATION

**Accepted value:**

_(null — nothing accepted)_

**Proposal (awaiting the user):**

```json
{
  "value": "The Cabinet Office, with the Ministry of Justice, will draft a Civil Service Accountability Bill defining legal duties for senior civil servants and empowering the Civil Service Commission to create a performance management framework. Departments will implement reporting structures assigning 'outcome owners' with public reporting, and the National Audit Office will gain enhanced auditing powers for individual accountability, reporting directly to Parliament.",
  "rationale": null
}
```

### `summaryDiagnosis` — AWAITING_CONFIRMATION

**Accepted value:**

_(null — nothing accepted)_

**Proposal (awaiting the user):**

```json
{
  "value": "The civil service's pervasive lack of individual accountability stems from incentives that encourage diffused responsibility, persisting due to political and cultural resistance to robust performance management and consequence systems that would challenge the status quo.",
  "rationale": null
}
```

### `summaryGuidingPolicy` — AWAITING_CONFIRMATION

**Accepted value:**

_(null — nothing accepted)_

**Proposal (awaiting the user):**

```json
{
  "value": "Our guiding policy is to establish a statutory framework that legally mandates individual civil servant accountability for outcome delivery, thereby shifting incentives from diffused responsibility to personal ownership and overcoming political and cultural resistance to robust performance management.",
  "rationale": null
}
```

### `title` — AWAITING_CONFIRMATION

**Accepted value:**

_(null — nothing accepted)_

**Proposal (awaiting the user):**

```json
{
  "value": "Enhancing Civil Service Accountability and Performance",
  "rationale": null
}
```

### `whatItRulesOut` — AWAITING_CONFIRMATION

**Accepted value:**

_(null — nothing accepted)_

**Proposal (awaiting the user):**

```json
{
  "value": "Choosing a statutory framework rules out relying solely on internal civil service reforms or enhanced parliamentary oversight. It rejects the idea that cultural change alone will be sufficient to overcome the deep-seated incentives for diffused responsibility. It also means foregoing the flexibility and potentially quicker implementation of non-legislative approaches, instead committing to a more rigid, legally binding structure.",
  "rationale": null
}
```

### `whoAffectedImpactCost` — AWAITING_CONFIRMATION

**Accepted value:**

_(null — nothing accepted)_

**Proposal (awaiting the user):**

```json
{
  "value": {
    "cost": "The user estimates the financial cost to be 'billions' due to potentially '2x too many people employed' and the 'real financial cost of failure'. The user's testimony highlights a specific instance where a private lawyer completed work in an afternoon that took government lawyers four years, indicating substantial hidden costs.",
    "impact": "Massive delays and incompetence in public service delivery, putting the security of the realm at risk (e.g., MOD), and hindering the implementation of elected politicians' mandates. For businesses like care homes, it means critical money cannot be invested in necessary improvements.",
    "evidence": "User testimony regarding the VAT structure for care homes in Northern Ireland, including refusal of government legal advisors to communicate and extreme delays. Broader concerns about civil service accountability are reflected in parliamentary debates and committee reports (e.g., Report: 6th Report - The accountability of civil servants — Constitution Committee, 2012-11-20; Report: 1st Report - Who's accountable? Relationships between Government and arm's-length bodies — Public Administration Committee, 2014-11-10).",
    "affectedGroups": "Primarily the general public through delayed and inefficient public services, and taxpayers through wasted public funds. Specific groups, such as care home owners in Northern Ireland, experience direct financial and operational detriment from bureaucratic inertia."
  },
  "rationale": null
}
```

### `youAndIdeaNarrative` — ACCEPTED

**Accepted value:**

> What I want to happen: Not sure yet — I want MPs to regain full control and responsibility for all areas of government including the 1200 quangos and for the productivity and acountability all all areas of government to be a clear line of accountability from the top (MPs reporting to parliament) to the bottom. I want both legislation and organisational structures to be put in place to the best standards as understood by the best public and private centre research and practice worldwide. This includes both the structures of accountability in terms of hierarchy and reporting but also best practice in delivering accountability in the most effective way
> 
> Already ruled out: This will emerge as we investigate best practice
> 
> What I know that the record won’t show (my own experience): I've seen at first hand the blocks to transparency and accountability, civil servants who refuse to explain the reasoning behind their decisions or debate them, with nobody being accountable to explain their decisions. Lawyers for the government refusing to even meet with the Care home owners directly affecte by their incredible slowness and pig headedness in refusing to deal with the issue or speed up an element of their work, with nobody apparently able to tell them what to do, they seem a law unto themselves and took 4 years to do what a private lawyer did for me in an afternoon. Even after I gave them what the private lawyer did for me at my expense so the work was already done


---

## 6. Everything else attached to this idea

_Counted across every model with an `ideaId`, so an empty section is a MEASURED zero_
_rather than something I forgot to look at._

### LexCoherentAction — 4 row(s)

| field | value |
|---|---|
| `id` | eba65894-f0c1-4ec9-841c-9cd7556cdf11 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `practicalStep` | _(290 chars — below)_ |
| `mechanismType` | rules |
| `whoImplements` | Cabinet Office and Ministry of Justice |
| `targetOrganisation` | _(empty)_ |
| `wording` | _(empty)_ |
| `benefits` | _(empty)_ |
| `implementationCost` | _(empty)_ |
| `enforcementCost` | _(empty)_ |
| `regulatoryFriction` | _(empty)_ |
| `source` | LEX |
| `orderIndex` | 0 |
| `createdAt` | 2026-08-24T01:26:23.942Z |
| `updatedAt` | 2026-08-24T01:26:23.942Z |

**`practicalStep`**

> The Cabinet Office, in conjunction with the Ministry of Justice, will draft a Civil Service Accountability Bill defining clear legal duties for senior civil servants regarding outcome delivery and individual responsibility, including provisions for performance measurement and consequences.

| field | value |
|---|---|
| `id` | 536c51a5-6b3c-4ccd-aeed-3b1cd21521e0 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `practicalStep` | _(318 chars — below)_ |
| `mechanismType` | institutional |
| `whoImplements` | Civil Service Commission |
| `targetOrganisation` | _(empty)_ |
| `wording` | _(empty)_ |
| `benefits` | _(empty)_ |
| `implementationCost` | _(empty)_ |
| `enforcementCost` | _(empty)_ |
| `regulatoryFriction` | _(empty)_ |
| `source` | LEX |
| `orderIndex` | 1 |
| `createdAt` | 2026-08-24T01:26:23.942Z |
| `updatedAt` | 2026-08-24T01:26:23.942Z |

**`practicalStep`**

> The Civil Service Commission will be empowered through the new legislation to establish and oversee a standardized, transparent performance management framework, including metrics for individual and team performance, linked directly to the statutory duties, and develop guidelines for rewards and disciplinary actions.

| field | value |
|---|---|
| `id` | 9997957e-46f3-4829-ad9a-94bdc21c645c |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `practicalStep` | _(247 chars — below)_ |
| `mechanismType` | transparency |
| `whoImplements` | All Government Departments |
| `targetOrganisation` | _(empty)_ |
| `wording` | _(empty)_ |
| `benefits` | _(empty)_ |
| `implementationCost` | _(empty)_ |
| `enforcementCost` | _(empty)_ |
| `regulatoryFriction` | _(empty)_ |
| `source` | LEX |
| `orderIndex` | 2 |
| `createdAt` | 2026-08-24T01:26:23.942Z |
| `updatedAt` | 2026-08-24T01:26:23.942Z |

**`practicalStep`**

> Departments will be required to implement new reporting structures that clearly assign individual senior civil servants as 'outcome owners' for specific public service objectives, with regular public reporting on progress against these objectives.

| field | value |
|---|---|
| `id` | 608f239d-cc14-4d9a-bf8b-cf5894916ae1 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `practicalStep` | _(235 chars — below)_ |
| `mechanismType` | institutional |
| `whoImplements` | National Audit Office |
| `targetOrganisation` | _(empty)_ |
| `wording` | _(empty)_ |
| `benefits` | _(empty)_ |
| `implementationCost` | _(empty)_ |
| `enforcementCost` | _(empty)_ |
| `regulatoryFriction` | _(empty)_ |
| `source` | LEX |
| `orderIndex` | 3 |
| `createdAt` | 2026-08-24T01:26:23.942Z |
| `updatedAt` | 2026-08-24T01:26:23.942Z |

**`practicalStep`**

> The National Audit Office will be granted enhanced powers under the new legislation to audit departmental performance against the established outcome metrics and individual accountability, with findings reported directly to Parliament.

### IdeaAssumption — 0 row(s)

_(none)_

### IdeaLegislation — 0 row(s)

_(none)_

### Evidence — 0 row(s)

_(none)_

### DeepeningPass — 7 row(s)

| field | value |
|---|---|
| `id` | af906eb2-515f-47bc-9634-e515be093ab9 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CASE_INTERPRETATION |
| `status` | RUN |
| `runVersion` | 1 |
| `startedAt` | 2026-08-24T01:27:51.151Z |
| `completedAt` | 2026-08-24T01:27:51.151Z |
| `failureReason` | _(empty)_ |
| `knownUnknowns` | _(object — below)_ |
| `candidatesReviewed` | 100 |
| `candidatesKept` | 19 |
| `siftSkipped` | false |
| `createdAt` | 2026-08-24T01:27:51.151Z |
| `updatedAt` | 2026-08-24T01:27:51.151Z |

**`knownUnknowns`**

```json
[
  {
    "why": "Nothing retrieved answered this.",
    "question": "Did that construction narrow or widen it, and does the proposal depend on which?"
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "Judicial construction of the Constitutional Reform and Governance Act 2010, sections 3, 5, 7, 9, and 10."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "Judicial construction of the Civil Service (Management Functions) Act 1992, section 1."
  }
]
```

| field | value |
|---|---|
| `id` | 9df269c1-3700-4d1b-90c7-87da42e3a3e8 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LINEAGE |
| `status` | RUN |
| `runVersion` | 1 |
| `startedAt` | 2026-08-24T01:28:54.793Z |
| `completedAt` | 2026-08-24T01:28:54.793Z |
| `failureReason` | _(empty)_ |
| `knownUnknowns` | _(object — below)_ |
| `candidatesReviewed` | 100 |
| `candidatesKept` | 56 |
| `siftSkipped` | false |
| `createdAt` | 2026-08-24T01:28:54.794Z |
| `updatedAt` | 2026-08-24T01:28:54.794Z |

**`knownUnknowns`**

```json
[
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source explicitly states that the 'diffusion of responsibility' was a deliberate choice when the current rules were written. Instead, the historical context suggests a tension between ministerial accountability and the delegation of functions to civil servants."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source directly quantifies the extent of 'diffusion of responsibility' or its impact on public service outcomes, making it difficult to assess the scale of the problem the proposal aims to fix."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "The specific intentions behind the design of the performance management systems, particularly regarding individual accountability for outcomes, are not fully detailed in the provided sources, beyond general aims of reform and efficiency."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source provides a direct statement from the time of the CRAG Act 2010's enactment or the 2012 Civil Service Reform Plan explicitly stating an intention to create or maintain a system that encourages diffusion of responsibility."
  }
]
```

| field | value |
|---|---|
| `id` | a9466767-8eee-44dd-b1ce-6ee3a1390ea5 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:DOMAIN_TRANSFER |
| `status` | RUN |
| `runVersion` | 1 |
| `startedAt` | 2026-08-24T01:30:03.188Z |
| `completedAt` | 2026-08-24T01:30:03.188Z |
| `failureReason` | _(empty)_ |
| `knownUnknowns` | _(object — below)_ |
| `candidatesReviewed` | 0 |
| `candidatesKept` | 0 |
| `siftSkipped` | false |
| `createdAt` | 2026-08-24T01:30:03.190Z |
| `updatedAt` | 2026-08-24T01:30:03.190Z |

**`knownUnknowns`**

```json
[]
```

| field | value |
|---|---|
| `id` | a8df956d-86d4-4a80-ad90-569e2f4c8737 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:EXISTING_POWER |
| `status` | RUN |
| `runVersion` | 1 |
| `startedAt` | 2026-08-24T01:26:59.533Z |
| `completedAt` | 2026-08-24T01:26:59.533Z |
| `failureReason` | _(empty)_ |
| `knownUnknowns` | _(object — below)_ |
| `candidatesReviewed` | 100 |
| `candidatesKept` | 19 |
| `siftSkipped` | false |
| `createdAt` | 2026-08-24T01:26:59.546Z |
| `updatedAt` | 2026-08-24T01:26:59.546Z |

**`knownUnknowns`**

```json
[
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source explicitly details the procedure (e.g., affirmative, negative resolution) for exercising the Minister for the Civil Service's general management powers under the Constitutional Reform and Governance Act 2010, beyond the lack of parliamentary procedure for laying the Civil Service Code."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source directly addresses whether the existing management powers of the Minister for the Civil Service or the Civil Service Commission are sufficient to create legally binding individual duties for civil servants regarding outcome delivery and responsibility, or to establish a statutory performance management framework with consequences, without new primary legislation."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source provides a detailed breakdown of the specific limits of the Minister for the Civil Service's management powers in relation to mandating new reporting structures for individual accountability and public reporting across departments."
  }
]
```

| field | value |
|---|---|
| `id` | 89da3543-8a44-46a2-9d0b-8540ee72c459 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `status` | RUN |
| `runVersion` | 1 |
| `startedAt` | 2026-08-24T01:27:30.987Z |
| `completedAt` | 2026-08-24T01:27:30.987Z |
| `failureReason` | _(empty)_ |
| `knownUnknowns` | _(object — below)_ |
| `candidatesReviewed` | 100 |
| `candidatesKept` | 36 |
| `siftSkipped` | false |
| `createdAt` | 2026-08-24T01:27:30.988Z |
| `updatedAt` | 2026-08-24T01:27:30.988Z |

**`knownUnknowns`**

```json
[
  {
    "why": "Nothing retrieved answered this.",
    "question": "What definitions would have to change, and what else uses them?"
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source explicitly defines 'senior civil servant' in a statutory context."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source quantifies the current level of individual accountability or its impact on efficiency and financial waste."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source details the specific legal framework for disciplinary actions against civil servants for underperformance."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source provides a comprehensive overview of the current legal basis for performance-related pay and rewards within the civil service."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source explicitly outlines the current statutory reporting structures for individual civil servant performance or outcome ownership."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source details the specific legal powers of the National Audit Office regarding auditing individual accountability within government departments."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source provides a statutory definition of 'outcome delivery' or 'individual responsibility' in the context of civil service duties."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source details the specific legal mechanisms for enforcing new statutory duties on individual civil servants."
  }
]
```

| field | value |
|---|---|
| `id` | e36efcfa-9a98-4105-9cf2-8649dd36131d |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSAL_EVIDENCE |
| `status` | RUN |
| `runVersion` | 1 |
| `startedAt` | 2026-08-24T01:29:22.643Z |
| `completedAt` | 2026-08-24T01:29:22.643Z |
| `failureReason` | _(empty)_ |
| `knownUnknowns` | _(object — below)_ |
| `candidatesReviewed` | 100 |
| `candidatesKept` | 25 |
| `siftSkipped` | false |
| `createdAt` | 2026-08-24T01:29:22.644Z |
| `updatedAt` | 2026-08-24T01:29:22.644Z |

**`knownUnknowns`**

```json
[
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source quantifies the extent to which existing incentives within the civil service encourage diffusion of responsibility over individual ownership."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source provides specific data on the clarity, measurability, and individual accountability linkage of current performance metrics across the civil service."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source quantifies the effectiveness or absence of consequences for underperformance and rewards for high performance within the civil service."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source provides direct evidence or quantification of the perceived autonomy, refusal of external communication, or delays caused by government legal advisors."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source quantifies the 'complexity and opacity' of decision-making processes, particularly involving quangos and arm's-length bodies, or their direct impact on accountability."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source provides a direct, quantified measure of the 'pervasive lack of individual accountability' or its direct causal link to specific levels of inefficiency, delayed public services, or financial waste."
  }
]
```

| field | value |
|---|---|
| `id` | 31859cf3-f64e-4e8b-88e3-47a9f3adcd50 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `status` | RUN |
| `runVersion` | 1 |
| `startedAt` | 2026-08-24T01:29:59.375Z |
| `completedAt` | 2026-08-24T01:29:59.375Z |
| `failureReason` | _(empty)_ |
| `knownUnknowns` | _(object — below)_ |
| `candidatesReviewed` | 100 |
| `candidatesKept` | 43 |
| `siftSkipped` | false |
| `createdAt` | 2026-08-24T01:29:59.375Z |
| `updatedAt` | 2026-08-24T01:29:59.375Z |

**`knownUnknowns`**

```json
[
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source quantifies how many bags enter waterways each year."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source provides specific recommendations from Lord Maude's 2023 review that were not acted upon."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source details specific recommendations from the Public Administration Select Committee (PASC) or Constitution Committee reports that were not implemented."
  },
  {
    "why": "Named by the question as unfindable in what was retrieved.",
    "question": "No source explicitly states whether the 'guided distribution model' for performance markings was recommended for abolition and if so, whether that recommendation was acted upon."
  }
]
```

### EvidenceItem — 70 row(s)

| field | value |
|---|---|
| `id` | 589f40bd-8dbe-4dee-9a46-c8a030ede834 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:EXISTING_POWER |
| `runVersion` | 1 |
| `fieldRef` | Cabinet Office, in conjunction with the Ministry of Justice, will draft a Civil Service Accountability Bill |
| `kind` | FINDING |
| `title` | Exclusion of national security vetting from management power |
| `body` | _(255 chars — below)_ |
| `sourceType` | EXPLANATORY_NOTE |
| `sourceId` | explanatory-notes:en:ukpga/2010/25:1-0015 |
| `citation` | Explanatory Notes to Constitutional Reform and Governance Act 2010 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/notes |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(217 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:26:58.787Z |
| `updatedAt` | 2026-08-24T01:26:58.787Z |

**`body`**

> Subsection (4) of section 3 of the Constitutional Reform and Governance Act 2010 expressly excludes national security vetting from the power to manage the civil service and the diplomatic service, confirming it continues under existing prerogative powers.

**`siftReason`**

> These explanatory notes clarify the scope of the Minister for the Civil Service's power to manage the civil service, which is fundamental to understanding the existing legal framework the proposal would interact with.

| field | value |
|---|---|
| `id` | 50be6e4c-f752-4535-990b-0737cbf70bd7 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:EXISTING_POWER |
| `runVersion` | 1 |
| `fieldRef` | The Civil Service Commission will be empowered through the new legislation to establish and oversee a standardized, transparent performance management framework |
| `kind` | FINDING |
| `title` | Civil Service Commission's role in recruitment principles |
| `body` | _(296 chars — below)_ |
| `sourceType` | EXPLANATORY_NOTE |
| `sourceId` | explanatory-notes:en:ukpga/2010/25:1-0018 |
| `citation` | Explanatory Notes to Constitutional Reform and Governance Act 2010 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/notes |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(251 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:26:58.869Z |
| `updatedAt` | 2026-08-24T01:26:58.869Z |

**`body`**

> Section 11 of the Constitutional Reform and Governance Act 2010 requires the Civil Service Commission to publish principles on the application of the requirement in section 10 for selection on merit on the basis of fair and open competition. These are referred to as 'the recruitment principles'.

**`siftReason`**

> These explanatory notes clarify section 11 of the Constitutional Reform and Governance Act 2010, which requires the Civil Service Commission to publish recruitment principles, relevant to the Commission's role in the proposed accountability framework.

| field | value |
|---|---|
| `id` | df65649f-6e30-4a88-b064-25bf385d9057 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `fieldRef` | Civil Service Code |
| `kind` | FINDING |
| `title` | Complaints regarding conduct conflicting with a code of conduct |
| `body` | _(220 chars — below)_ |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-2000plus:ukpga/2010/25:section-9 |
| `citation` | Constitutional Reform and Governance Act 2010, s.9 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/section/9 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(223 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:27:29.857Z |
| `updatedAt` | 2026-08-24T01:27:29.857Z |

**`body`**

> Section 9 of the Constitutional Reform and Governance Act 2010 establishes a process for civil servants to make complaints if they believe their conduct conflicts with a civil service code or the diplomatic service code.

**`siftReason`**

> This section outlines the complaints procedure for civil servants regarding conduct that conflicts with a code of conduct, which would need to be considered in conjunction with new disciplinary actions for underperformance.

| field | value |
|---|---|
| `id` | 10908ee3-d9b7-4710-bc77-eba330f5be1c |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:EXISTING_POWER |
| `runVersion` | 1 |
| `fieldRef` | Cabinet Office, in conjunction with the Ministry of Justice, will draft a Civil Service Accountability Bill |
| `kind` | FINDING |
| `title` | Minister for the Civil Service has power to manage the civil service |
| `body` | The Constitutional Reform and Governance Act 2010, section 3(1), confers on the Minister for the Civil Service the power to manage the civil service (excluding the diplomatic service). |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-2000plus:ukpga/2010/25:section-3 |
| `citation` | Constitutional Reform and Governance Act 2010, s.3 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/section/3 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(204 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:26:58.288Z |
| `updatedAt` | 2026-08-24T01:26:58.288Z |

**`siftReason`**

> This section confers the power to manage the civil service on the Minister for the Civil Service, which is directly relevant to the proposal's aim of establishing a statutory framework for accountability.

| field | value |
|---|---|
| `id` | f34eaba5-6a42-4a1c-951e-fc6ef1afa2ac |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:EXISTING_POWER |
| `runVersion` | 1 |
| `fieldRef` | Cabinet Office, in conjunction with the Ministry of Justice, will draft a Civil Service Accountability Bill |
| `kind` | FINDING |
| `title` | Delegation of Civil Service management functions |
| `body` | _(263 chars — below)_ |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-pre-2000:ukpga/1992/61:section-1 |
| `citation` | Civil Service (Management Functions) Act 1992, s.1 |
| `url` | https://www.legislation.gov.uk/ukpga/1992/61/section/1 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(280 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:26:58.376Z |
| `updatedAt` | 2026-08-24T01:26:58.376Z |

**`body`**

> The Civil Service (Management Functions) Act 1992, section 1(1), applies to the functions conferred on the Minister for the Civil Service by section 3 of the Constitutional Reform and Governance Act 2010, allowing for the delegation of these management functions.

**`siftReason`**

> This section applies to the functions conferred on the Minister for the Civil Service by section 3 of the Constitutional Reform and Governance Act 2010, providing a mechanism for delegating management functions that could be relevant to implementing new accountability structures.

| field | value |
|---|---|
| `id` | f2b36bfd-8ddf-44db-aca4-96605b32e8b7 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:EXISTING_POWER |
| `runVersion` | 1 |
| `fieldRef` | Cabinet Office, in conjunction with the Ministry of Justice, will draft a Civil Service Accountability Bill |
| `kind` | FINDING |
| `title` | Power to authorise exercise of functions without approval |
| `body` | _(259 chars — below)_ |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-pre-2000:ukpga/1992/61:section-2 |
| `citation` | Civil Service (Management Functions) Act 1992, s.2 |
| `url` | https://www.legislation.gov.uk/ukpga/1992/61/section/2 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(263 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:26:58.458Z |
| `updatedAt` | 2026-08-24T01:26:58.458Z |

**`body`**

> The Civil Service (Management Functions) Act 1992, section 2(1), applies to any statutory power relating to the appointment or management of members of the civil service (excluding the diplomatic service) within the Minister for the Civil Service's functions.

**`siftReason`**

> This section applies to statutory powers relating to the appointment or management of civil servants, providing a mechanism for authorising the exercise of functions without approval, which could be relevant to the implementation of new accountability structures.

| field | value |
|---|---|
| `id` | 9400f5de-8a4f-4c48-ad67-6456969b7d38 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:EXISTING_POWER |
| `runVersion` | 1 |
| `fieldRef` | The Civil Service Commission will be empowered through the new legislation to establish and oversee a standardized, transparent performance management framework |
| `kind` | FINDING |
| `title` | Minister for the Civil Service must publish a Civil Service Code |
| `body` | _(276 chars — below)_ |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-2000plus:ukpga/2010/25:section-5 |
| `citation` | Constitutional Reform and Governance Act 2010, s.5 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/section/5 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(217 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:26:58.539Z |
| `updatedAt` | 2026-08-24T01:26:58.539Z |

**`body`**

> The Minister for the Civil Service is required by the Constitutional Reform and Governance Act 2010, section 5(1), to publish a code of conduct for the civil service (excluding the diplomatic service). The Minister may publish separate codes covering different civil servants.

**`siftReason`**

> This section mandates the Minister for the Civil Service to publish a code of conduct, which is a potential existing mechanism that the proposed statutory framework for accountability would interact with or supersede.

| field | value |
|---|---|
| `id` | 4eb90269-52d7-4400-8d9e-1d00989665c3 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:EXISTING_POWER |
| `runVersion` | 1 |
| `fieldRef` | The Civil Service Commission will be empowered through the new legislation to establish and oversee a standardized, transparent performance management framework |
| `kind` | FINDING |
| `title` | Minimum requirements for Civil Service Code |
| `body` | _(221 chars — below)_ |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-2000plus:ukpga/2010/25:section-7 |
| `citation` | Constitutional Reform and Governance Act 2010, s.7 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/section/7 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(229 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:26:58.623Z |
| `updatedAt` | 2026-08-24T01:26:58.623Z |

**`body`**

> Section 7(1) of the Constitutional Reform and Governance Act 2010 sets out the provisions that must be included in a civil service code or the diplomatic service code in relation to the civil servants covered by the code.

**`siftReason`**

> This section sets out minimum requirements for civil service codes, which could be a mechanism for implementing aspects of the proposed performance management framework, or would need to be considered in drafting new legislation.

| field | value |
|---|---|
| `id` | 99199cb7-d870-4e47-b48c-4eb030e35ff4 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:EXISTING_POWER |
| `runVersion` | 1 |
| `fieldRef` | The Civil Service Commission will be empowered through the new legislation to establish and oversee a standardized, transparent performance management framework |
| `kind` | FINDING |
| `title` | No Parliamentary procedure for laying the Civil Service Code |
| `body` | _(302 chars — below)_ |
| `sourceType` | EXPLANATORY_NOTE |
| `sourceId` | explanatory-notes:en:ukpga/2010/25:1-0017 |
| `citation` | Explanatory Notes to Constitutional Reform and Governance Act 2010 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/notes |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(226 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:26:58.705Z |
| `updatedAt` | 2026-08-24T01:26:58.705Z |

**`body`**

> There is no Parliamentary procedure attached to the obligation in subsection (8) for the Minister for the Civil Service to lay the code before Parliament. Subsections (9) and (10) provide that the First Ministers of Scotland and Wales are also required to lay the code relevant to their administration.

**`siftReason`**

> These explanatory notes clarify the parliamentary procedure (or lack thereof) for laying the civil service code before Parliament, which is relevant to understanding the existing oversight mechanisms for civil service conduct.

| field | value |
|---|---|
| `id` | d2ec97c2-7532-49e7-8b46-6bdb5ed7fd71 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:EXISTING_POWER |
| `runVersion` | 1 |
| `fieldRef` | The Civil Service Commission will be empowered through the new legislation to establish and oversee a standardized, transparent performance management framework |
| `kind` | FINDING |
| `title` | Civil Service Commission's accounts and records |
| `body` | _(255 chars — below)_ |
| `sourceType` | EXPLANATORY_NOTE |
| `sourceId` | explanatory-notes:en:ukpga/2010/25:1-0014 |
| `citation` | Explanatory Notes to Constitutional Reform and Governance Act 2010 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/notes |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(234 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:26:58.951Z |
| `updatedAt` | 2026-08-24T01:26:58.951Z |

**`body`**

> Paragraph 16 of the Constitutional Reform and Governance Act 2010 makes provision for the accounts and records of the Civil Service Commission, requiring the preparation and content of the annual statement of accounts to comply with specific requirements.

**`siftReason`**

> These explanatory notes clarify provisions for the accounts and records of the Civil Service Commission, which is relevant to the proposal's aim of empowering the Commission to establish and oversee a performance management framework.

| field | value |
|---|---|
| `id` | ba975adf-60c0-4db4-96be-35ae7c44cbc6 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:EXISTING_POWER |
| `runVersion` | 1 |
| `fieldRef` | The Cabinet Office, in conjunction with the Ministry of Justice, will draft a Civil Service Accountability Bill |
| `kind` | FINDING |
| `title` | Existing bills addressing public service integrity and accountability |
| `body` | _(229 chars — below)_ |
| `sourceType` | BILL |
| `sourceId` | bills-api:3332:1 |
| `citation` | Public Service (Integrity and Ethics) Bill [HL] — 1st reading (last updated 2023) |
| `url` | https://bills-api.parliament.uk/api/v1/Publications/47653/Documents/2221/Download |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(213 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:26:59.033Z |
| `updatedAt` | 2026-08-24T01:26:59.033Z |

**`body`**

> Several Public Service (Integrity and Ethics) Bills [HL] and a Public Office (Accountability) Bill have been introduced, indicating ongoing legislative consideration of these issues. These include bills from 2023, 2024, and 2026.

**`siftReason`**

> This bill, 'Public Service (Integrity and Ethics) Bill [HL]', directly addresses integrity and ethics in public service, which is closely related to the proposal's goal of improving accountability and performance.

| field | value |
|---|---|
| `id` | 43c04b15-c84e-4c84-bd96-44ac193cdea4 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:EXISTING_POWER |
| `runVersion` | 1 |
| `fieldRef` | Lack of clear, measurable performance metrics tied to individual accountability and outcomes. |
| `kind` | FINDING |
| `title` | Public Accounts Committee report on civil service performance management |
| `body` | _(256 chars — below)_ |
| `sourceType` | COMMITTEE |
| `sourceId` | committees-reports:publication:43960:217831-0010 |
| `citation` | Report: Twenty-Third Report - Civil service workforce: Recruitment, pay and performance management — Public Accounts Committee |
| `url` | https://committees.parliament.uk/publications/43960/html/ |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(215 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:26:59.115Z |
| `updatedAt` | 2026-08-24T01:26:59.115Z |

**`body`**

> The Public Accounts Committee's Twenty-Third Report on 'Civil service workforce: Recruitment, pay and performance management' (2024) addresses whether departments can effectively manage underperforming staff and identify issues with staff underperformance.

**`siftReason`**

> This report discusses civil service workforce performance management, including issues with underperforming staff and the Cabinet Office's role, providing context on existing challenges the proposal aims to address.

| field | value |
|---|---|
| `id` | b77a82ae-4674-4b1b-9e86-6c1259fbe1df |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `fieldRef` | Minister for the Civil Service |
| `kind` | FINDING |
| `title` | Minister for the Civil Service has power to manage the civil service |
| `body` | _(207 chars — below)_ |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-2000plus:ukpga/2010/25:section-3 |
| `citation` | Constitutional Reform and Governance Act 2010, s.3 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/section/3 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | This section defines the Minister for the Civil Service's power to manage the civil service, which is the statutory basis the proposal would amend to introduce new duties. |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:27:29.456Z |
| `updatedAt` | 2026-08-24T01:27:29.456Z |

**`body`**

> The Minister for the Civil Service holds the power to manage the civil service, excluding the diplomatic service. This power is conferred by Section 3(1) of the Constitutional Reform and Governance Act 2010.

| field | value |
|---|---|
| `id` | ed88c430-3a12-4fdb-a436-d9c8bb551b23 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `fieldRef` | Secretary of State |
| `kind` | FINDING |
| `title` | Secretary of State manages the diplomatic service |
| `body` | The Secretary of State is responsible for the management of the diplomatic service, as outlined in Section 3(2) of the Constitutional Reform and Governance Act 2010. |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-2000plus:ukpga/2010/25:section-3 |
| `citation` | Constitutional Reform and Governance Act 2010, s.3 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/section/3 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | This section defines the Minister for the Civil Service's power to manage the civil service, which is the statutory basis the proposal would amend to introduce new duties. |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:27:29.536Z |
| `updatedAt` | 2026-08-24T01:27:29.536Z |

| field | value |
|---|---|
| `id` | 14ef866c-61bd-4b28-8b24-70702b160544 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `fieldRef` | delegation of functions |
| `kind` | FINDING |
| `title` | Delegation of Civil Service management functions |
| `body` | _(260 chars — below)_ |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-pre-2000:ukpga/1992/61:section-1 |
| `citation` | Civil Service (Management Functions) Act 1992, s.1 |
| `url` | https://www.legislation.gov.uk/ukpga/1992/61/section/1 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(231 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:27:29.617Z |
| `updatedAt` | 2026-08-24T01:27:29.617Z |

**`body`**

> The Civil Service (Management Functions) Act 1992, Section 1, applies to the functions conferred on the Minister for the Civil Service by Section 3 of the Constitutional Reform and Governance Act 2010, allowing for the delegation of these management functions.

**`siftReason`**

> This section applies to functions conferred on the Minister for the Civil Service by the Constitutional Reform and Governance Act 2010, indicating how management functions are delegated and thus how new duties might be implemented.

| field | value |
|---|---|
| `id` | b62b5a9a-248e-4b94-802c-921861360443 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `fieldRef` | Civil Service Code |
| `kind` | FINDING |
| `title` | Civil Service Code publication requirement |
| `body` | _(274 chars — below)_ |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-2000plus:ukpga/2010/25:section-5 |
| `citation` | Constitutional Reform and Governance Act 2010, s.5 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/section/5 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | This section mandates the Minister for the Civil Service to publish a code of conduct, which would need to incorporate the new legal duties and performance expectations proposed. |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:27:29.697Z |
| `updatedAt` | 2026-08-24T01:27:29.697Z |

**`body`**

> The Minister for the Civil Service is mandated by Section 5(1) of the Constitutional Reform and Governance Act 2010 to publish a code of conduct for the civil service (excluding the diplomatic service). Separate codes can be published for different groups of civil servants.

| field | value |
|---|---|
| `id` | 5148e8c1-534f-45fe-96c1-b36b4f32b7f2 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `fieldRef` | Civil Service Code |
| `kind` | FINDING |
| `title` | Minimum requirements for Civil Service and diplomatic service codes |
| `body` | _(202 chars — below)_ |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-2000plus:ukpga/2010/25:section-7 |
| `citation` | Constitutional Reform and Governance Act 2010, s.7 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/section/7 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | This section sets out minimum requirements for civil service codes, which would need to be aligned with any new statutory duties and performance management framework. |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:27:29.777Z |
| `updatedAt` | 2026-08-24T01:27:29.777Z |

**`body`**

> Section 7(1) of the Constitutional Reform and Governance Act 2010 specifies the provisions that must be included in a civil service code or the diplomatic service code for the civil servants they cover.

| field | value |
|---|---|
| `id` | c0de45d5-9c2f-4058-ac9c-afe18255524c |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CASE_INTERPRETATION |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Requirement for Civil Service Code |
| `body` | The Minister for the Civil Service is mandated to publish a code of conduct for the civil service, as per section 5 of the Constitutional Reform and Governance Act 2010. |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-2000plus:ukpga/2010/25:section-5 |
| `citation` | Constitutional Reform and Governance Act 2010, s.5 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/section/5 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | This section mandates the Minister for the Civil Service to publish a code of conduct, which the proposal intends to strengthen with legally defined duties and performance metrics. |
| `precedentTestPassed` | false |
| `headingKey` | COURTS |
| `createdAt` | 2026-08-24T01:27:50.661Z |
| `updatedAt` | 2026-08-24T01:27:50.661Z |

| field | value |
|---|---|
| `id` | 351617f3-433c-4275-99fc-829d2dd42647 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `fieldRef` | Civil Service Commission |
| `kind` | FINDING |
| `title` | Civil Service Commission's role in recruitment |
| `body` | _(290 chars — below)_ |
| `sourceType` | EXPLANATORY_NOTE |
| `sourceId` | explanatory-notes:en:ukpga/2010/25:1-0018 |
| `citation` | Explanatory Notes to Constitutional Reform and Governance Act 2010 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/notes |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(256 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:27:29.937Z |
| `updatedAt` | 2026-08-24T01:27:29.937Z |

**`body`**

> The Civil Service Commission is required by Section 11 of the Constitutional Reform and Governance Act 2010 to publish principles for the application of selection on merit based on fair and open competition for appointments to the civil service. These are known as 'recruitment principles'.

**`siftReason`**

> These explanatory notes clarify section 11 of the Constitutional Reform and Governance Act 2010, which requires the Civil Service Commission to publish recruitment principles, relevant to the Commission's existing powers and potential new responsibilities.

| field | value |
|---|---|
| `id` | 8588e22f-e499-4c24-a18a-bc7d0a3af7bf |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `fieldRef` | Civil Service Commission |
| `kind` | FINDING |
| `title` | Civil Service Commission's accounts and records |
| `body` | _(257 chars — below)_ |
| `sourceType` | EXPLANATORY_NOTE |
| `sourceId` | explanatory-notes:en:ukpga/2010/25:1-0014 |
| `citation` | Explanatory Notes to Constitutional Reform and Governance Act 2010 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/notes |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | These explanatory notes make provision for the accounts and records of the Civil Service Commission, relevant to the Commission's existing oversight functions that the proposal seeks to enhance. |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:27:30.017Z |
| `updatedAt` | 2026-08-24T01:27:30.017Z |

**`body`**

> Paragraph 16 of the Constitutional Reform and Governance Act 2010 makes provision for the accounts and records of the Civil Service Commission, requiring compliance with specific standards for the preparation and content of its annual statement of accounts.

| field | value |
|---|---|
| `id` | a7c2a1da-301b-4120-a648-f9592754ba68 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `fieldRef` | performance management |
| `kind` | FINDING |
| `title` | Civil Service performance management system |
| `body` | The Civil Service currently operates within a Performance Management System, as stated in a 2016 Cabinet Office response regarding reforms to performance management systems. |
| `sourceType` | DEBATE |
| `sourceId` | pwdata-wrans:answers2016-09-07:67 |
| `citation` | Cabinet Office — Civil Service: Performance Appraisal |
| `url` | http://www.parliament.uk/business/publications/written-questions-answers-statements/written-question/Commons/2016-09-02/44500/ |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(212 chars — below)_ |
| `precedentTestPassed` | true |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:27:30.108Z |
| `updatedAt` | 2026-08-24T01:27:30.108Z |

**`siftReason`**

> This debate discusses the policy on reform to civil service performance management systems, including the guided distribution model, which is a direct precedent for attempts to improve performance accountability.

| field | value |
|---|---|
| `id` | 3f3450f2-b40f-4b92-b465-0ec8fb26808f |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `fieldRef` | performance management |
| `kind` | FINDING |
| `title` | Civil Service Competency Framework supports performance management |
| `body` | _(262 chars — below)_ |
| `sourceType` | GUIDANCE |
| `sourceId` | quangos-govuk:government/publications/civil-service-competency-framework:2 |
| `citation` | Civil Service competency framework |
| `url` | https://assets.publishing.service.gov.uk/media/5a815610ed915d74e33fda4b/cscf_fulla4potrait_2013-2017_v2d.pdf |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(235 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:27:30.188Z |
| `updatedAt` | 2026-08-24T01:27:30.188Z |

**`body`**

> The Civil Service Competency Framework supports the Civil Service Reform Plan and the performance management system. It outlines skills, knowledge, and behaviours for successful performance, grouped into setting direction, engaging people, and producing results.

**`siftReason`**

> This document states that the Civil Service competency framework supports the Civil Service Reform Plan and the performance management system, indicating existing structures that would need to be integrated or replaced by the proposal.

| field | value |
|---|---|
| `id` | 19d47ec8-9219-42e4-a942-d68b27fd085e |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `fieldRef` | performance-related pay |
| `kind` | FINDING |
| `title` | Variations in departmental performance-related pay |
| `body` | The Cabinet Office has expressed surprise at the level of variation in departments' performance-related pay arrangements, noting it was higher than expected. |
| `sourceType` | COMMITTEE |
| `sourceId` | committees-reports:publication:43960:217831-0009 |
| `citation` | Report: Twenty-Third Report - Civil service workforce: Recruitment, pay and performance management — Public Accounts Committee |
| `url` | https://committees.parliament.uk/publications/43960/html/ |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | This report discusses variations in departmental performance-related pay arrangements, which is directly relevant to the proposal's aim of developing guidelines for rewards and disciplinary actions. |
| `precedentTestPassed` | true |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:27:30.267Z |
| `updatedAt` | 2026-08-24T01:27:30.267Z |

| field | value |
|---|---|
| `id` | 30f667f4-a2aa-45a4-b0b1-efd27b0ddaeb |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `fieldRef` | performance management |
| `kind` | FINDING |
| `title` | Ministerial input into senior official performance management |
| `body` | A more formalised ministerial input into the performance management of senior officials may require strengthened protection for civil servants in their role as guardians of propriety. |
| `sourceType` | COMMITTEE |
| `sourceId` | committees-reports:publication:9832:arc-0033 |
| `citation` | Report: 8th Report - Truth to power: how Civil Service reform can succeed - Volume II (Volume II: additional written evidence) — Public Administration Committee — ¶28 |
| `url` | http://www.publications.parliament.uk/pa/cm201314/cmselect/cmpubadm/74/74vw.pdf |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | This report discusses formalised ministerial input into senior official performance management and the transferability of private sector governance models, directly addressing aspects of the proposal. |
| `precedentTestPassed` | true |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:27:30.347Z |
| `updatedAt` | 2026-08-24T01:27:30.347Z |

| field | value |
|---|---|
| `id` | 27667718-7a4f-4471-9976-e46a1e86f200 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `fieldRef` | accountability |
| `kind` | FINDING |
| `title` | Ongoing review of governance and accountability in the Civil Service |
| `body` | The Independent Review of Governance and Accountability in the Civil Service, led by Lord Maude of Horsham, was published in full in November 2023, indicating ongoing efforts to address these issues. |
| `sourceType` | DEBATE |
| `sourceId` | pwdata-wms:ministerial2023-11-13:2 |
| `citation` | Cabinet Office — Update on Government Reform |
| `url` | https://questions-statements.parliament.uk/written-statements/detail/2023-11-13/hcws30 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | This statement announces the publication of the Independent Review of Governance and Accountability in the Civil Service, directly addressing the core problem of the proposal. |
| `precedentTestPassed` | true |
| `headingKey` | LAW_NOW |
| `createdAt` | 2026-08-24T01:27:30.427Z |
| `updatedAt` | 2026-08-24T01:27:30.427Z |

| field | value |
|---|---|
| `id` | fd10e4e5-a676-4689-ad49-9fcc1086f440 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CASE_INTERPRETATION |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Minister for the Civil Service has power to manage the civil service |
| `body` | The Constitutional Reform and Governance Act 2010, section 3, grants the Minister for the Civil Service the power to manage the civil service (excluding the diplomatic service). |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-2000plus:ukpga/2010/25:section-3 |
| `citation` | Constitutional Reform and Governance Act 2010, s.3 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/section/3 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | This section grants the Minister for the Civil Service power to manage the civil service, which the proposal seeks to influence by establishing a statutory framework for accountability. |
| `precedentTestPassed` | false |
| `headingKey` | COURTS |
| `createdAt` | 2026-08-24T01:27:50.497Z |
| `updatedAt` | 2026-08-24T01:27:50.497Z |

| field | value |
|---|---|
| `id` | 0fc1de0d-6838-49ae-95f8-a8c17a6b598f |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CASE_INTERPRETATION |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Delegation of Civil Service management functions |
| `body` | _(249 chars — below)_ |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-pre-2000:ukpga/1992/61:section-1 |
| `citation` | Civil Service (Management Functions) Act 1992, s.1 |
| `url` | https://www.legislation.gov.uk/ukpga/1992/61/section/1 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | This section applies to functions conferred on the Minister for the Civil Service for management, which the proposal aims to modify through new statutory duties for accountability. |
| `precedentTestPassed` | false |
| `headingKey` | COURTS |
| `createdAt` | 2026-08-24T01:27:50.579Z |
| `updatedAt` | 2026-08-24T01:27:50.579Z |

**`body`**

> The Civil Service (Management Functions) Act 1992, section 1, applies to the functions conferred on the Minister for the Civil Service by section 3 of the Constitutional Reform and Governance Act 2010, concerning the management of the civil service.

| field | value |
|---|---|
| `id` | 0f53df7f-ebb7-4494-b150-e17c9cb57f24 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CASE_INTERPRETATION |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Minimum requirements for Civil Service codes |
| `body` | Section 7 of the Constitutional Reform and Governance Act 2010 outlines the provisions that must be included in a civil service code or the diplomatic service code. |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-2000plus:ukpga/2010/25:section-7 |
| `citation` | Constitutional Reform and Governance Act 2010, s.7 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/section/7 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | This section sets out the minimum requirements for civil service codes, which the proposal aims to amend by defining clear legal duties for senior civil servants. |
| `precedentTestPassed` | false |
| `headingKey` | COURTS |
| `createdAt` | 2026-08-24T01:27:50.742Z |
| `updatedAt` | 2026-08-24T01:27:50.742Z |

| field | value |
|---|---|
| `id` | 3aea0860-7d74-4e02-a2e5-fb657007f98a |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CASE_INTERPRETATION |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Complaints by civil servants regarding conduct conflicting with a code |
| `body` | Section 9 of the Constitutional Reform and Governance Act 2010 establishes a process for civil servants to make complaints if conduct conflicts with a civil service code. |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-2000plus:ukpga/2010/25:section-9 |
| `citation` | Constitutional Reform and Governance Act 2010, s.9 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/section/9 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | This section outlines the complaints process for conduct conflicting with a code of conduct, which the proposal would supersede or integrate with a new statutory accountability framework. |
| `precedentTestPassed` | false |
| `headingKey` | COURTS |
| `createdAt` | 2026-08-24T01:27:50.824Z |
| `updatedAt` | 2026-08-24T01:27:50.824Z |

| field | value |
|---|---|
| `id` | 2d770c7a-7ba2-4ad3-8261-01e4e698778a |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CASE_INTERPRETATION |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Merit-based selection for civil service appointments |
| `body` | _(204 chars — below)_ |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-2000plus:ukpga/2010/25:section-10 |
| `citation` | Constitutional Reform and Governance Act 2010, s.10 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/section/10 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | This section governs selections for appointments to the civil service based on merit, which could be impacted by the proposal's emphasis on performance and accountability for senior roles. |
| `precedentTestPassed` | false |
| `headingKey` | COURTS |
| `createdAt` | 2026-08-24T01:27:50.906Z |
| `updatedAt` | 2026-08-24T01:27:50.906Z |

**`body`**

> The selection of non-civil servants for appointment to the civil service must be on merit, based on fair and open competition, according to section 10 of the Constitutional Reform and Governance Act 2010.

| field | value |
|---|---|
| `id` | ca59c0d1-a18f-4f72-a1e4-90a6727ffc41 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LINEAGE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Constitutional Reform and Governance Act 2010 (CRAG Act) established legal framework for Civil Service management |
| `body` | _(543 chars — below)_ |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-2000plus:ukpga/2010/25:section-3 |
| `citation` | Constitutional Reform and Governance Act 2010, s.3 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/section/3 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | Establishes the statutory power of the Minister for the Civil Service to manage the civil service, which the proposal aims to amend by introducing new legal duties for senior civil servants. |
| `precedentTestPassed` | false |
| `headingKey` | TRIED_BEFORE |
| `createdAt` | 2026-08-24T01:28:53.679Z |
| `updatedAt` | 2026-08-24T01:28:53.679Z |

**`body`**

> The Constitutional Reform and Governance Act 2010 (CRAG Act) codified the legal basis for the management of the Civil Service, granting the Minister for the Civil Service the power to manage the Civil Service (excluding the diplomatic service) and the Secretary of State the power to manage the diplomatic service. This Act also mandated the publication of a Civil Service Code of conduct and set minimum requirements for its content, including provisions for civil servants to raise complaints if they believe conduct conflicts with the code.

| field | value |
|---|---|
| `id` | f10805b7-2dba-4960-a2ca-af288c84f1fc |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LINEAGE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | CRAG Act 2010 aimed to provide a statutory basis for Civil Service principles |
| `body` | _(383 chars — below)_ |
| `sourceType` | EXPLANATORY_NOTE |
| `sourceId` | explanatory-notes:en:ukpga/2010/25:1-0018 |
| `citation` | Explanatory Notes to Constitutional Reform and Governance Act 2010 |
| `url` | https://www.legislation.gov.uk/ukpga/2010/25/notes |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(257 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | TRIED_BEFORE |
| `createdAt` | 2026-08-24T01:28:53.759Z |
| `updatedAt` | 2026-08-24T01:28:53.759Z |

**`body`**

> The Constitutional Reform and Governance Act 2010 was enacted to provide a statutory basis for the principles of the Civil Service, including selection on merit through fair and open competition, and to define the powers of the Minister for the Civil Service regarding its management. The Act also established the Civil Service Commission's role in publishing recruitment principles.

**`siftReason`**

> Explains Section 11 of the Constitutional Reform and Governance Act 2010, which requires the Civil Service Commission to publish recruitment principles based on merit, providing context for the Commission's existing powers that the proposal seeks to expand.

| field | value |
|---|---|
| `id` | 911ff11f-7f57-4f82-9541-4d7bfa532135 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LINEAGE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Civil Service Reform Plan (2012) aimed for a 'smaller, flatter, faster' Civil Service |
| `body` | _(249 chars — below)_ |
| `sourceType` | DEBATE |
| `sourceId` | pwdata-wms:ministerial2013-07-10a:2 |
| `citation` | CABINET OFFICE — Civil Service Reform |
| `url` | http://www.publications.parliament.uk/pa/cm201314/cmhansrd/cm130710/wmstext/130710m0001.htm#130710m0001.htm_spmin1 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(213 chars — below)_ |
| `precedentTestPassed` | true |
| `headingKey` | TRIED_BEFORE |
| `createdAt` | 2026-08-24T01:28:53.839Z |
| `updatedAt` | 2026-08-24T01:28:53.839Z |

**`body`**

> In June 2012, the Civil Service Reform Plan was published, aiming to deliver a Civil Service that is 'smaller, flatter, and faster; more digital, more unified, and more capable'. This plan set out a series of actions intended to achieve these goals.

**`siftReason`**

> Reports on the Civil Service Reform Plan, aiming for a 'smaller, flatter, and faster' civil service, indicating previous attempts at reform that the current proposal seeks to build upon or correct deficiencies in.

| field | value |
|---|---|
| `id` | 1a76d4b5-f331-4b31-8fc6-75ec65890aef |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LINEAGE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Historical emphasis on accountability through Ministers to Parliament |
| `body` | _(312 chars — below)_ |
| `sourceType` | DEBATE |
| `sourceId` | pwdata-debates:debates1994-07-13a:131 |
| `citation` | Civil Service |
| `url` | https://www.theyworkforyou.com/pwdata/scrapedxml/debates/debates1994-07-13a.xml |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(224 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | TRIED_BEFORE |
| `createdAt` | 2026-08-24T01:28:53.918Z |
| `updatedAt` | 2026-08-24T01:28:53.918Z |

**`body`**

> The principles of a professional civil service, accountable through Ministers to Parliament, recruited on merit, were first laid out nearly 150 years prior to a 1994 statement on the Civil Service White Paper. This highlights a long-standing understanding of accountability within the UK Civil Service structure.

**`siftReason`**

> Statement on the White Paper on the civil service, discussing the principles of a professional civil service accountable through Ministers to Parliament, providing historical context for the current accountability framework.

| field | value |
|---|---|
| `id` | 443ecb85-2897-4b09-8a37-badb9ef30ea5 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LINEAGE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Debates in the 1990s questioned accountability with devolved power |
| `body` | _(343 chars — below)_ |
| `sourceType` | DEBATE |
| `sourceId` | pwdata-debates:debates1994-07-13a:154 |
| `citation` | Civil Service |
| `url` | https://www.theyworkforyou.com/pwdata/scrapedxml/debates/debates1994-07-13a.xml |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | Raises concerns about accountability to Ministers if power is devolved to civil servants, directly addressing the proposal's aim to clarify individual responsibility and accountability. |
| `precedentTestPassed` | false |
| `headingKey` | TRIED_BEFORE |
| `createdAt` | 2026-08-24T01:28:53.998Z |
| `updatedAt` | 2026-08-24T01:28:53.998Z |

**`body`**

> In 1994, concerns were raised in Parliament about the implications of devolving power to civil servants in departments, questioning who would be accountable to Ministers for various aspects if civil servants were no longer directly accountable for many areas. This suggests that the issue of diffused accountability has been a recurring theme.

| field | value |
|---|---|
| `id` | ef6d381d-f829-443d-8544-d8f3ec3e8b50 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LINEAGE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Civil Service (Management Functions) Act 1992 allowed delegation of management functions |
| `body` | _(301 chars — below)_ |
| `sourceType` | PRIMARY_LEGISLATION |
| `sourceId` | primary-acts-pre-2000:ukpga/1992/61:section-1 |
| `citation` | Civil Service (Management Functions) Act 1992, s.1 |
| `url` | https://www.legislation.gov.uk/ukpga/1992/61/section/1 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | Applies to functions conferred on the Minister for the Civil Service for management, providing the statutory basis for civil service management that the proposal seeks to modify. |
| `precedentTestPassed` | false |
| `headingKey` | TRIED_BEFORE |
| `createdAt` | 2026-08-24T01:28:54.078Z |
| `updatedAt` | 2026-08-24T01:28:54.078Z |

**`body`**

> The Civil Service (Management Functions) Act 1992 applied to functions conferred on the Minister for the Civil Service by section 3 of the Constitutional Reform and Governance Act 2010 (management of the civil service, excluding the diplomatic service), allowing for the delegation of these functions.

| field | value |
|---|---|
| `id` | bc979e26-93f9-44f3-9af5-0996fc67496c |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LINEAGE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Civil Service competency framework supports performance management |
| `body` | _(315 chars — below)_ |
| `sourceType` | GUIDANCE |
| `sourceId` | quangos-govuk:government/publications/civil-service-competency-framework:2 |
| `citation` | Civil Service competency framework |
| `url` | https://assets.publishing.service.gov.uk/media/5a815610ed915d74e33fda4b/cscf_fulla4potrait_2013-2017_v2d.pdf |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(205 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | TRIED_BEFORE |
| `createdAt` | 2026-08-24T01:28:54.158Z |
| `updatedAt` | 2026-08-24T01:28:54.158Z |

**`body`**

> The Civil Service competency framework, updated in 2012-2017, was designed to support the Civil Service Reform Plan and the performance management system. It outlines skills, knowledge, and behaviours expected for successful performance, grouped into 'setting direction', 'engaging people', and 'producing results'.

**`siftReason`**

> States that the Civil Service competency framework supports the Civil Service Reform Plan and the performance management system, indicating existing mechanisms that the proposal aims to enhance or replace.

| field | value |
|---|---|
| `id` | f13ce222-c06f-4149-a831-0206a228dc7f |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LINEAGE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Performance management systems for Senior Civil Service (SCS) exist |
| `body` | _(231 chars — below)_ |
| `sourceType` | GUIDANCE |
| `sourceId` | hmrc-codes-guidance:-government-publications-senior-civil-service-performance-management:1 |
| `citation` | _(empty)_ |
| `url` | https://www.gov.uk/government/publications/senior-civil-service-performance-management |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | Provides guidance on performance management in the Senior Civil Service, outlining existing frameworks that the proposal aims to reform and make statutory. |
| `precedentTestPassed` | false |
| `headingKey` | TRIED_BEFORE |
| `createdAt` | 2026-08-24T01:28:54.237Z |
| `updatedAt` | 2026-08-24T01:28:54.237Z |

**`body`**

> Guidance documents for managing performance in the Senior Civil Service (SCS) have been published by the Civil Service, with updates occurring over time, indicating an existing framework for performance management at senior levels.

| field | value |
|---|---|
| `id` | 4f1aa0af-0045-4a6d-a247-6d6471275052 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LINEAGE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Cabinet Office expressed surprise at variation in departmental performance-related pay |
| `body` | _(269 chars — below)_ |
| `sourceType` | COMMITTEE |
| `sourceId` | committees-reports:publication:43960:217831-0009 |
| `citation` | Report: Twenty-Third Report - Civil service workforce: Recruitment, pay and performance management — Public Accounts Committee |
| `url` | https://committees.parliament.uk/publications/43960/html/ |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(247 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | TRIED_BEFORE |
| `createdAt` | 2026-08-24T01:28:54.316Z |
| `updatedAt` | 2026-08-24T01:28:54.316Z |

**`body`**

> The Cabinet Office noted a higher-than-expected level of variation in departments' performance-related pay arrangements below the Senior Civil Service (SCS) level, suggesting a lack of consistent application of performance management practices across the Civil Service.

**`siftReason`**

> Reports on civil service workforce performance management, noting variation in performance-related pay arrangements, which is relevant to the proposal's aim for a standardized performance management framework with rewards and disciplinary actions.

| field | value |
|---|---|
| `id` | bfed9650-52b4-4652-84bd-8ebfb4b82978 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSAL_EVIDENCE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Challenges in Measuring Senior Civil Servant Performance (1994) |
| `body` | In 1994, a Member of Parliament raised the question of how to measure the performance of senior civil servants, indicating that this has been a long-standing challenge. |
| `sourceType` | DEBATE |
| `sourceId` | pwdata-debates:debates1994-07-13a:131 |
| `citation` | Civil Service |
| `url` | https://www.theyworkforyou.com/pwdata/scrapedxml/debates/debates1994-07-13a.xml |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(248 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | NUMBERS |
| `createdAt` | 2026-08-24T01:29:21.600Z |
| `updatedAt` | 2026-08-24T01:29:21.600Z |

**`siftReason`**

> This statement discusses the principles of a professional civil service, accountable through Ministers to Parliament, and recruited on merit, providing historical context for the current accountability framework and how it was intended to function.

| field | value |
|---|---|
| `id` | be98ed5c-ea3e-4b87-a2f7-434b40b86d15 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSAL_EVIDENCE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Variations in Departmental Performance-Related Pay |
| `body` | The Cabinet Office expressed surprise at the level of variation in departments' performance-related pay arrangements, noting that the extent of this variation was higher than expected. |
| `sourceType` | COMMITTEE |
| `sourceId` | committees-reports:publication:43960:217831-0009 |
| `citation` | Report: Twenty-Third Report - Civil service workforce: Recruitment, pay and performance management — Public Accounts Committee |
| `url` | https://committees.parliament.uk/publications/43960/html/ |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(287 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | NUMBERS |
| `createdAt` | 2026-08-24T01:29:21.680Z |
| `updatedAt` | 2026-08-24T01:29:21.680Z |

**`siftReason`**

> This report from the Public Accounts Committee highlights significant variation in departments' performance-related pay arrangements, suggesting a lack of standardized and effective performance management, which supports the diagnosis of an absence of effective consequences and rewards.

| field | value |
|---|---|
| `id` | f913d420-a163-49e3-b5a4-3761f0d182e7 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSAL_EVIDENCE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Ongoing Debates on Civil Service Accountability |
| `body` | _(422 chars — below)_ |
| `sourceType` | DEBATE |
| `sourceId` | pwdata-wms:ministerial2023-11-13:2 |
| `citation` | Cabinet Office — Update on Government Reform |
| `url` | https://questions-statements.parliament.uk/written-statements/detail/2023-11-13/hcws30 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(234 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | NUMBERS |
| `createdAt` | 2026-08-24T01:29:21.360Z |
| `updatedAt` | 2026-08-24T01:29:21.360Z |

**`body`**

> There have been ongoing debates and reports from committees like the Public Administration Select Committee (PASC) and the Constitution Committee regarding the accountability of civil servants and the relationship between government and arm's-length bodies. Recent discussions, such as the Independent Review of Governance and Accountability in the Civil Service by Lord Maude of Horsham, continue to address these issues.

**`siftReason`**

> This statement announces the publication of the Independent Review of Governance and Accountability in the Civil Service by Lord Maude, directly confirming ongoing high-level concern and investigation into the proposal's core problem.

| field | value |
|---|---|
| `id` | e97b1d33-fcf0-474e-b872-6be984f8e9f3 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSAL_EVIDENCE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Civil Service Reform Plan (2012) |
| `body` | _(216 chars — below)_ |
| `sourceType` | DEBATE |
| `sourceId` | pwdata-wms:ministerial2013-07-10a:2 |
| `citation` | CABINET OFFICE — Civil Service Reform |
| `url` | http://www.publications.parliament.uk/pa/cm201314/cmhansrd/cm130710/wmstext/130710m0001.htm#130710m0001.htm_spmin1 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(268 chars — below)_ |
| `precedentTestPassed` | true |
| `headingKey` | NUMBERS |
| `createdAt` | 2026-08-24T01:29:21.441Z |
| `updatedAt` | 2026-08-24T01:29:21.441Z |

**`body`**

> In June 2012, Sir Bob Kerslake and the Minister for the Cabinet Office published the Civil Service Reform Plan, which aimed to deliver a civil service that is smaller, flatter, faster, more digital, and more unified.

**`siftReason`**

> This statement discusses the Civil Service Reform Plan and its aim to deliver a 'smaller, flatter, and faster' civil service, indicating an existing recognition of issues related to efficiency and potentially diffused responsibility, and outlines a past reform effort.

| field | value |
|---|---|
| `id` | a2710680-6561-4962-82fa-73b3d21d9e08 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSAL_EVIDENCE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Performance Management in the Senior Civil Service (SCS) |
| `body` | Guidance documents exist for managing performance in the Senior Civil Service (SCS), published by the Civil Service. |
| `sourceType` | GUIDANCE |
| `sourceId` | hmrc-codes-guidance:-government-publications-senior-civil-service-performance-management:1 |
| `citation` | _(empty)_ |
| `url` | https://www.gov.uk/government/publications/senior-civil-service-performance-management |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(232 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | NUMBERS |
| `createdAt` | 2026-08-24T01:29:21.521Z |
| `updatedAt` | 2026-08-24T01:29:21.521Z |

**`siftReason`**

> This guidance provides information on managing performance in the Senior Civil Service (SCS), indicating existing frameworks and potentially highlighting areas where they may be insufficient or contribute to diffused responsibility.

| field | value |
|---|---|
| `id` | 00dc9e37-ce51-49f8-b8c9-bcf74277d7e0 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSAL_EVIDENCE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Civil Service Competency Framework |
| `body` | _(257 chars — below)_ |
| `sourceType` | GUIDANCE |
| `sourceId` | quangos-govuk:government/publications/civil-service-competency-framework:1 |
| `citation` | Civil Service competency framework |
| `url` | https://www.gov.uk/government/publications/civil-service-competency-framework |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(247 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | NUMBERS |
| `createdAt` | 2026-08-24T01:29:21.761Z |
| `updatedAt` | 2026-08-24T01:29:21.761Z |

**`body`**

> The Civil Service competency framework, published in 2018, sets out 10 competencies grouped into 'setting direction', 'engaging people', and 'producing results', which are described as the skills, knowledge, and behaviours leading to successful performance.

**`siftReason`**

> This document outlines the Civil Service Competency Framework, which sets out expected skills, knowledge, and behaviours for successful performance, providing context for existing performance management structures and their potential shortcomings.

| field | value |
|---|---|
| `id` | a770b72d-32ff-48bd-892b-5e3e9007c6ad |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSAL_EVIDENCE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Civil Service Line Management Standards |
| `body` | The Civil Service has Line Management Standards, which include a 'Core stage' and cover topics like developing great line managers and the Civil Service Code. |
| `sourceType` | GUIDANCE |
| `sourceId` | quangos-govuk:government/publications/civil-service-line-management-standards:2 |
| `citation` | Civil Service Line Management Standards (PDF) |
| `url` | https://assets.publishing.service.gov.uk/media/683d6d6c72f067240eb90b40/The_Line_Management_Standards_-_updated_Core0206ContPDF.pdf |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(211 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | NUMBERS |
| `createdAt` | 2026-08-24T01:29:21.841Z |
| `updatedAt` | 2026-08-24T01:29:21.841Z |

**`siftReason`**

> This guidance outlines Civil Service Line Management Standards, which are relevant to the proposal's focus on individual accountability and performance, as effective line management is crucial for these aspects.

| field | value |
|---|---|
| `id` | c564ff40-8653-492d-a58b-50046d031149 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSAL_EVIDENCE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Need for Formalized Ministerial Input and Civil Servant Protection |
| `body` | A more formalized ministerial input into the performance management of senior officials may require strengthened protection for civil servants in their role as guardians of propriety. |
| `sourceType` | COMMITTEE |
| `sourceId` | committees-reports:publication:9832:arc-0033 |
| `citation` | Report: 8th Report - Truth to power: how Civil Service reform can succeed - Volume II (Volume II: additional written evidence) — Public Administration Committee — ¶28 |
| `url` | http://www.publications.parliament.uk/pa/cm201314/cmselect/cmpubadm/74/74vw.pdf |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(312 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | NUMBERS |
| `createdAt` | 2026-08-24T01:29:21.921Z |
| `updatedAt` | 2026-08-24T01:29:21.921Z |

**`siftReason`**

> This report discusses the need for more formalised ministerial input into the performance management of senior officials and questions the direct transferability of private sector governance models to the public sector, directly addressing the proposal's core issues of accountability and performance management.

| field | value |
|---|---|
| `id` | 30101354-2cb5-4300-8713-230baad8e4b2 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSAL_EVIDENCE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Public Perception of State Efficiency |
| `body` | _(226 chars — below)_ |
| `sourceType` | DEBATE |
| `sourceId` | pwdata-debates:debates2025-04-24b:28 |
| `citation` | Cabinet Office — Public Service Reform |
| `url` | https://www.theyworkforyou.com/pwdata/scrapedxml/debates/debates2025-04-24b.xml |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(249 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | NUMBERS |
| `createdAt` | 2026-08-24T01:29:22.001Z |
| `updatedAt` | 2026-08-24T01:29:22.001Z |

**`body`**

> The public has observed the state growing and taxes increasing, but has not always felt that they are getting the right outcome from these changes, highlighting a need for reform to make the state more efficient and effective.

**`siftReason`**

> This debate highlights public perception of the state getting 'bigger and taxes go up, but they have not always felt that they are getting the right outcome', directly supporting the proposal's diagnosis of inefficiency and lack of desired outcomes.

| field | value |
|---|---|
| `id` | d1f967d5-feb3-4255-8375-6b8c58e1bc15 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSAL_EVIDENCE |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Research on Civil Service Management Improvement |
| `body` | Professor Christian Schuster's research uses data to generate evidence on what works to improve civil service management and leadership. |
| `sourceType` | COMMITTEE |
| `sourceId` | committees-evidence:writtenevidence:122950:201730 |
| `citation` | Civil Service Leadership and Reform — CLR0015 |
| `url` | https://committees.parliament.uk/writtenevidence/122950/html/ |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(230 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | NUMBERS |
| `createdAt` | 2026-08-24T01:29:22.083Z |
| `updatedAt` | 2026-08-24T01:29:22.083Z |

**`siftReason`**

> This written evidence from Professor Christian Schuster, a researcher on civil service management, directly addresses what works to improve civil service management, providing expert insight into the causal claims of the proposal.

| field | value |
|---|---|
| `id` | 91247663-22d0-451a-82fe-e39671f5e12e |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Guidance on Senior Civil Service performance management available |
| `body` | Guidance documents for managing performance in the Senior Civil Service (SCS) have been published by the Civil Service, with updates as recent as May 2026. |
| `sourceType` | GUIDANCE |
| `sourceId` | hmrc-codes-guidance:-government-publications-senior-civil-service-performance-management:1 |
| `citation` | _(empty)_ |
| `url` | https://www.gov.uk/government/publications/senior-civil-service-performance-management |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(207 chars — below)_ |
| `precedentTestPassed` | true |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:58.744Z |
| `updatedAt` | 2026-08-24T01:29:58.744Z |

**`siftReason`**

> Guidance on Senior Civil Service performance management, directly relevant to the proposal's aim to establish a standardized performance management framework with metrics for individual and team performance.

| field | value |
|---|---|
| `id` | 41444dc5-df6f-4fdd-b55f-db54068e7b26 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Civil Service Reform Plan (2012) aimed for a 'smaller, flatter, and faster' Civil Service |
| `body` | _(298 chars — below)_ |
| `sourceType` | DEBATE |
| `sourceId` | pwdata-wms:ministerial2013-07-10a:2 |
| `citation` | CABINET OFFICE — Civil Service Reform |
| `url` | http://www.publications.parliament.uk/pa/cm201314/cmhansrd/cm130710/wmstext/130710m0001.htm#130710m0001.htm_spmin1 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(247 chars — below)_ |
| `precedentTestPassed` | true |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:57.483Z |
| `updatedAt` | 2026-08-24T01:29:57.483Z |

**`body`**

> In June 2012, Sir Bob Kerslake and the Minister for the Cabinet Office published the Civil Service Reform Plan, with a report on its progress one year later in July 2013. The plan aimed to deliver a Civil Service that is 'smaller, flatter, and faster; more digital, more unified, and more capable'.

**`siftReason`**

> Ministerial statement on the Civil Service Reform Plan, one year on, detailing actions to make the civil service 'smaller, flatter, and faster; more digital, more unified', which relates to ongoing efforts to improve efficiency and accountability.

| field | value |
|---|---|
| `id` | ee7f44b9-4322-4d80-b553-2f36ea057d31 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Public Administration Select Committee (PASC) inquiry into 'Who's accountable?' for arm's-length bodies |
| `body` | _(265 chars — below)_ |
| `sourceType` | COMMITTEE |
| `sourceId` | committees-reports:publication:24085:arc-0120 |
| `citation` | _(251 chars — below)_ |
| `url` | http://www.publications.parliament.uk/pa/cm201012/cmselect/cmpubadm/714/714.pdf |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(255 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:57.562Z |
| `updatedAt` | 2026-08-24T01:29:57.562Z |

**`body`**

> The Public Administration Select Committee (PASC) conducted an inquiry titled 'Who's accountable? Relationships between Government and arm's-length bodies', publishing its report in November 2014. This inquiry directly addressed the accountability of public bodies.

**`citation`**

> Report: 13th Report - Change in Government: the agenda for leadership - Volume I (Report and Appendices, together with formal minutes and oral and written evidence) — Public Administration Committee — 56 Change in Government: the agenda for leadership

**`siftReason`**

> Public Administration Committee report on 'Change in Government: the agenda for leadership', which explicitly states that 'other countries routinely hold civil servants accountable for their performance', supporting the need for individual accountability.

| field | value |
|---|---|
| `id` | bc7ae679-3b66-49e0-bacd-e9a0abe1f214 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Constitution Committee examined accountability of civil servants |
| `body` | The Constitution Committee published a report titled 'The accountability of civil servants' in November 2012, indicating parliamentary scrutiny of this issue. |
| `sourceType` | COMMITTEE |
| `sourceId` | committees-reports:publication:24925:arc-0037 |
| `citation` | Report: 6th Report - The accountability of civil servants — Constitution Committee — Nonetheless, on occasion a select committee will want to question a |
| `url` | http://www.publications.parliament.uk/pa/ld201213/ldselect/ldconst/61/61.pdf |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | Report on 'The accountability of civil servants' by the Constitution Committee, directly addressing the core problem of the proposal regarding civil servant accountability. |
| `precedentTestPassed` | false |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:57.641Z |
| `updatedAt` | 2026-08-24T01:29:57.641Z |

| field | value |
|---|---|
| `id` | 2da33b1f-7fc7-47dd-9566-7875300cc2a7 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Lord Maude's Independent Review of Governance and Accountability in the Civil Service (2023) |
| `body` | _(304 chars — below)_ |
| `sourceType` | DEBATE |
| `sourceId` | pwdata-wms:ministerial2023-11-13:2 |
| `citation` | Cabinet Office — Update on Government Reform |
| `url` | https://questions-statements.parliament.uk/written-statements/detail/2023-11-13/hcws30 |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | Ministerial statement publishing the Independent Review of Governance and Accountability in the Civil Service by Lord Maude, directly addressing the core problem of the proposal. |
| `precedentTestPassed` | true |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:57.720Z |
| `updatedAt` | 2026-08-24T01:29:57.720Z |

**`body`**

> The Independent Review of Governance and Accountability in the Civil Service, led by Lord Maude of Horsham, was commissioned in July 2022 and its findings were published in full in November 2023. This review aimed to ensure the government is best placed to make long-term decisions and implement reforms.

| field | value |
|---|---|
| `id` | 6746d408-3ff2-49f8-b275-06819b2abad8 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Public Accounts Committee highlighted importance of civil service skills for successful delivery |
| `body` | _(292 chars — below)_ |
| `sourceType` | COMMITTEE |
| `sourceId` | committees-reports:publication:9889:arc-0006 |
| `citation` | Report: 13th Report - Civil Service Reform — Public Accounts Committee |
| `url` | http://www.publications.parliament.uk/pa/cm201314/cmselect/cmpubacc/473/473.pdf |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(265 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:57.798Z |
| `updatedAt` | 2026-08-24T01:29:57.798Z |

**`body`**

> In September 2013, the Public Accounts Committee recognized the importance of establishing innovative ways to deliver public services amidst expenditure cuts. They concluded that if the Civil Service lacks appropriate skills and competencies, the government will fail to deliver successfully.

**`siftReason`**

> Public Accounts Committee report on 'Civil Service Reform', which states that 'if the Civil Service does not possess the appropriate skills and competencies the Government will fail to deliver successful outcomes', linking capability to accountability and outcomes.

| field | value |
|---|---|
| `id` | 6c10a34c-cc4d-40ed-b7a3-41b68984c0e4 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Civil Service performance management systems include a 'guided distribution model' |
| `body` | _(288 chars — below)_ |
| `sourceType` | DEBATE |
| `sourceId` | pwdata-wrans:answers2016-09-07:67 |
| `citation` | Cabinet Office — Civil Service: Performance Appraisal |
| `url` | http://www.parliament.uk/business/publications/written-questions-answers-statements/written-question/Commons/2016-09-02/44500/ |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(240 chars — below)_ |
| `precedentTestPassed` | true |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:57.877Z |
| `updatedAt` | 2026-08-24T01:29:57.877Z |

**`body`**

> As of September 2016, the Civil Service operates within a Performance Management Framework that includes a 'guided distribution model' for performance markings. There have been questions raised in Parliament regarding the policy on reform to these systems and the abolition of this model.

**`siftReason`**

> Parliamentary answer on Civil Service performance appraisal, specifically mentioning the guided distribution model of performance markings, which is relevant to the proposal's aim to establish a transparent performance management framework.

| field | value |
|---|---|
| `id` | 2e7916ec-1c4f-4eb9-bc0a-79b0dc6c8433 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Institute for Government's views on Civil Service work |
| `body` | _(244 chars — below)_ |
| `sourceType` | COMMITTEE |
| `sourceId` | committees-evidence:writtenevidence:77426:122681 |
| `citation` | The work of the Civil Service inquiry — WCS0026 |
| `url` | https://committees.parliament.uk/writtenevidence/77426/html/ |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | Written evidence from the Institute for Government on 'The work of the Civil Service inquiry', offering expert views on civil service issues that likely include accountability and performance. |
| `precedentTestPassed` | false |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:57.956Z |
| `updatedAt` | 2026-08-24T01:29:57.956Z |

**`body`**

> The Institute for Government provided written evidence to the Public Administration and Constitutional Affairs Committee's inquiry into the work of the Civil Service in February 2017, offering their views on issues related to the Civil Service.

| field | value |
|---|---|
| `id` | 0ff5c976-6480-4b87-b78e-0147c04ab247 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Public Service (Integrity and Ethics) Bill [HL] introduced in 2023 |
| `body` | The Public Service (Integrity and Ethics) Bill [HL] was introduced in the House of Lords on 7 December 2023. This bill addresses integrity and ethics within the public service. |
| `sourceType` | BILL |
| `sourceId` | bills-api:3552:1 |
| `citation` | Public Service (Integrity and Ethics) Bill [HL] — 1st reading (last updated 2024) |
| `url` | https://bills-api.parliament.uk/api/v1/Publications/53363/Documents/4162/Download |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | Public Service (Integrity and Ethics) Bill [HL] as introduced, which directly addresses integrity and ethics in public service, potentially including aspects of accountability and performance. |
| `precedentTestPassed` | false |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:58.035Z |
| `updatedAt` | 2026-08-24T01:29:58.035Z |

| field | value |
|---|---|
| `id` | 983831c4-f372-42ff-9dbe-84df270b7007 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Public Administration and Constitutional Affairs Committee inquiry on 'Accounting for democracy' |
| `body` | _(253 chars — below)_ |
| `sourceType` | COMMITTEE |
| `sourceId` | committees-reports:publication:14705:arc-0001 |
| `citation` | Report: 14th Report - Accounting for democracy: making sure Parliament, the people and ministers know how and why public money is spent — Public Administration and Constitutional Affairs Committee |
| `url` | https://www.publications.parliament.uk/pa/cm201617/cmselect/cmpubadm/95/95.pdf |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(231 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:58.114Z |
| `updatedAt` | 2026-08-24T01:29:58.114Z |

**`body`**

> The Public Administration and Constitutional Affairs Committee published its Fourteenth Report of Session 2016–17, titled 'Accounting for democracy: making sure Parliament, the people and ministers know how and why public money is spent', in April 2017.

**`siftReason`**

> Report on 'Accounting for democracy: making sure Parliament, the people and ministers know how and why public money is spent', which directly relates to the proposal's aim for enhanced NAO powers and public reporting on objectives.

| field | value |
|---|---|
| `id` | 19a14680-293f-4294-b763-7d85e925239e |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Civil Service Commission Triennial Review (2014) aimed for a 'Better Civil Service' |
| `body` | Sir Gerry Grimstone's Triennial Review of the Civil Service Commission, titled 'A Better Civil Service', was published in December 2014. This review aimed to improve the Civil Service. |
| `sourceType` | GUIDANCE |
| `sourceId` | quangos-govuk:government/publications/civil-service-commission-triennial-review-a-better-civil-service:2 |
| `citation` | A Better Civil Service: Triennial Review of the Civil Service Commission |
| `url` | https://assets.publishing.service.gov.uk/media/5a7f5cdeed915d74e622a010/CSC_TR_Report_a_better_civil_service.pdf |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | Triennial Review of the Civil Service Commission, which would have examined the Commission's role and effectiveness, directly relevant to the proposal's aim to empower the Civil Service Commission. |
| `precedentTestPassed` | true |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:58.192Z |
| `updatedAt` | 2026-08-24T01:29:58.192Z |

| field | value |
|---|---|
| `id` | 6ce9b3ed-4d34-4320-b34f-2cf3f7942b7d |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Public Office (Accountability) Bill introduced |
| `body` | The Public Office (Accountability) Bill was introduced and had its second reading, with updates as recent as July 2026. |
| `sourceType` | BILL |
| `sourceId` | bills-api:4019:9 |
| `citation` | Public Office (Accountability) Bill — 2nd reading (last updated 2026) |
| `url` | https://bills-api.parliament.uk/api/v1/Publications/63740/Documents/7413/Download |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | Public Office (Accountability) Bill, which directly addresses accountability in public office, indicating a legislative attempt to tackle the problem the proposal seeks to solve. |
| `precedentTestPassed` | false |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:58.271Z |
| `updatedAt` | 2026-08-24T01:29:58.271Z |

| field | value |
|---|---|
| `id` | bfbce995-a7e9-4e8c-be89-bb47f151c7d2 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Public Administration Committee emphasized personal accountability for increased performance |
| `body` | _(284 chars — below)_ |
| `sourceType` | COMMITTEE |
| `sourceId` | committees-reports:publication:24085:arc-0073 |
| `citation` | _(251 chars — below)_ |
| `url` | http://www.publications.parliament.uk/pa/cm201012/cmselect/cmpubadm/714/714.pdf |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(242 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:58.350Z |
| `updatedAt` | 2026-08-24T01:29:58.350Z |

**`body`**

> In September 2011, the Public Administration Committee noted that personal accountability would increase the performance of individual civil servants. They observed that while top officials have overall responsibility, the Civil Service often tries to avoid individual accountability.

**`citation`**

> Report: 13th Report - Change in Government: the agenda for leadership - Volume I (Report and Appendices, together with formal minutes and oral and written evidence) — Public Administration Committee — 56 Change in Government: the agenda for leadership

**`siftReason`**

> Public Administration Committee report on 'Change in Government: the agenda for leadership', which highlights that 'personal accountability would increase the performance of those individuals', directly supporting the proposal's core premise.

| field | value |
|---|---|
| `id` | 0657e64f-c9bb-4767-9b92-1fb0baca23cd |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Civil Service Competency Framework supports reform and performance management |
| `body` | _(202 chars — below)_ |
| `sourceType` | GUIDANCE |
| `sourceId` | quangos-govuk:government/publications/civil-service-competency-framework:2 |
| `citation` | Civil Service competency framework |
| `url` | https://assets.publishing.service.gov.uk/media/5a815610ed915d74e33fda4b/cscf_fulla4potrait_2013-2017_v2d.pdf |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(208 chars — below)_ |
| `precedentTestPassed` | true |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:58.428Z |
| `updatedAt` | 2026-08-24T01:29:58.428Z |

**`body`**

> The Civil Service Competency Framework (2012-2017) was designed to support the Civil Service Reform Plan and the performance management system, outlining desired behaviors and skills for civil servants.

**`siftReason`**

> Civil Service Competency Framework, which supports the Civil Service Reform Plan and performance management system, relevant to the proposal's aim to establish a standardized performance management framework.

| field | value |
|---|---|
| `id` | 73d05ea8-9f01-4c96-bc80-4ae02a39b02f |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Report on 'Improving Management in Government: The Next Steps' (1988) |
| `body` | In February 1988, a report titled 'Improving Management in Government: The Next Steps' was produced by the efficiency unit, examining the progress of management reforms in the Civil Service. |
| `sourceType` | DEBATE |
| `sourceId` | pwdata-debates:debates1988-02-18a:170 |
| `citation` | Civil Service Management |
| `url` | https://www.theyworkforyou.com/pwdata/scrapedxml/debates/debates1988-02-18a.xml |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | Statement on Civil Service Management, discussing a report on 'Improving Management in Government: The Next Steps', indicating historical efforts to address management and performance issues. |
| `precedentTestPassed` | true |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:58.507Z |
| `updatedAt` | 2026-08-24T01:29:58.507Z |

| field | value |
|---|---|
| `id` | 39064839-ab45-4836-b322-9fd46e2fbf14 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Public Administration and Constitutional Affairs Committee inquiry into 'The Work of the Civil Service' |
| `body` | _(217 chars — below)_ |
| `sourceType` | COMMITTEE |
| `sourceId` | committees-reports:publication:14767:arc-0009 |
| `citation` | Report: 16th Report - The work of the Committee during the 2015–17 Parliament — Public Administration and Constitutional Affairs Committee |
| `url` | https://www.publications.parliament.uk/pa/cm201617/cmselect/cmpubadm/1151/1151.pdf |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(257 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:58.586Z |
| `updatedAt` | 2026-08-24T01:29:58.586Z |

**`body`**

> The Public Administration and Constitutional Affairs Committee conducted a major inquiry into the work and effectiveness of the Civil Service during the 2015-17 Parliament, publishing preliminary findings in May 2017.

**`siftReason`**

> Public Administration and Constitutional Affairs Committee report on 'The work of the Committee during the 2015–17 Parliament', highlighting their major inquiry into the work and effectiveness of the civil service, indicating ongoing parliamentary scrutiny.

| field | value |
|---|---|
| `id` | e6e955bc-85d6-44a8-9187-dc019bbaf16f |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Civil servants should answer publicly on delivery effectiveness within policy constraints |
| `body` | _(317 chars — below)_ |
| `sourceType` | COMMITTEE |
| `sourceId` | committees-reports:publication:9832:arc-0031 |
| `citation` | Report: 8th Report - Truth to power: how Civil Service reform can succeed - Volume II (Volume II: additional written evidence) — Public Administration Committee — ¶10 |
| `url` | http://www.publications.parliament.uk/pa/cm201314/cmselect/cmpubadm/74/74vw.pdf |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(225 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:58.665Z |
| `updatedAt` | 2026-08-24T01:29:58.665Z |

**`body`**

> The Public Administration Committee, in September 2013, stated that while there is a public interest in exploring policy ideas confidentially, this should not prevent civil servants from publicly answering on their effectiveness in delivery within prevailing policy constraints, nor on the evidence and analysis used.

**`siftReason`**

> Public Administration Committee report 'Truth to power: how Civil Service reform can succeed', which discusses civil servants answering publicly on their effectiveness in delivery, relevant to transparency and accountability.

| field | value |
|---|---|
| `id` | e09ddbaa-c4f2-4b56-8de9-a15c441ddcad |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Public Accounts Committee examined civil service workforce, recruitment, pay, and performance management |
| `body` | _(330 chars — below)_ |
| `sourceType` | COMMITTEE |
| `sourceId` | committees-reports:publication:43960:217831-0010 |
| `citation` | Report: Twenty-Third Report - Civil service workforce: Recruitment, pay and performance management — Public Accounts Committee |
| `url` | https://committees.parliament.uk/publications/43960/html/ |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(276 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:58.822Z |
| `updatedAt` | 2026-08-24T01:29:58.822Z |

**`body`**

> In March 2024, the Public Accounts Committee published its Twenty-Third Report, which included an examination of the civil service workforce, specifically recruitment, pay, and performance management. The report highlighted the need for departments to assess the effectiveness of line managers in addressing underperforming staff.

**`siftReason`**

> Public Accounts Committee report on 'Civil service workforce: Recruitment, pay and performance management', directly addressing the effectiveness of line managers in managing underperforming staff and broader issues of staff underperformance, which is central to the proposal.

| field | value |
|---|---|
| `id` | cba8d808-a70d-4354-bc9a-85ccdcfbeeab |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | FINDING |
| `title` | Debate on measuring performance of senior civil servants (1994) |
| `body` | In July 1994, a debate in Parliament addressed the question of how to measure the performance of senior civil servants, indicating a long-standing concern with this aspect of accountability. |
| `sourceType` | DEBATE |
| `sourceId` | pwdata-debates:debates1994-07-13a:133 |
| `citation` | Civil Service |
| `url` | https://www.theyworkforyou.com/pwdata/scrapedxml/debates/debates1994-07-13a.xml |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | Debate on Civil Service management, where the measurement of performance of senior civil servants was discussed, indicating a long-standing concern about accountability and metrics. |
| `precedentTestPassed` | false |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:58.901Z |
| `updatedAt` | 2026-08-24T01:29:58.901Z |

| field | value |
|---|---|
| `id` | 338f9f5f-90c4-467a-a945-16502bcdd2ce |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `fieldRef` | _(empty)_ |
| `kind` | CONTRADICTS |
| `title` | Concern about devolution of power to civil servants reducing ministerial accountability (1994) |
| `body` | _(314 chars — below)_ |
| `sourceType` | DEBATE |
| `sourceId` | pwdata-debates:debates1994-07-13a:154 |
| `citation` | Civil Service |
| `url` | https://www.theyworkforyou.com/pwdata/scrapedxml/debates/debates1994-07-13a.xml |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(224 chars — below)_ |
| `precedentTestPassed` | false |
| `headingKey` | ARGUED |
| `createdAt` | 2026-08-24T01:29:58.981Z |
| `updatedAt` | 2026-08-24T01:29:58.981Z |

**`body`**

> During a 1994 debate on the Civil Service White Paper, a concern was raised that if power were devolved to civil servants who would no longer be accountable to Ministers for many aspects, an incoming Government might view this negatively, potentially leading to political appointments rather than merit-based ones.

**`siftReason`**

> Debate on Civil Service, raising concerns about accountability when power is devolved to civil servants and they are no longer accountable to Ministers, directly relevant to the proposal's focus on individual accountability.

| field | value |
|---|---|
| `id` | a8e81692-0708-4892-af36-76e58c08da04 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | REVISE |
| `runVersion` | 1 |
| `fieldRef` | guidingPolicy:instrument |
| `kind` | CONTRADICTS |
| `title` | The research changed my mind about guidingPolicy:instrument |
| `body` | _(551 chars — below)_ |
| `sourceType` | _(empty)_ |
| `sourceId` | _(empty)_ |
| `citation` | _(empty)_ |
| `url` | _(empty)_ |
| `status` | PROPOSED |
| `note` | _(empty)_ |
| `siftReason` | _(empty)_ |
| `precedentTestPassed` | _(empty)_ |
| `headingKey` | _(empty)_ |
| `createdAt` | 2026-08-24T01:30:18.435Z |
| `updatedAt` | 2026-08-24T01:30:18.435Z |

**`body`**

> I first concluded: Primary legislation · national · reserved
> 
> The evidence says: The Constitutional Reform and Governance Act 2010, section 3(1), confers on the Minister for the Civil Service the power to manage the civil service (excluding the diplomatic service).
> 
> Why I changed my mind: The existence of an existing statutory power for the Minister for the Civil Service to manage the civil service suggests that primary legislation may not be strictly necessary for all aspects of the proposed reforms, requiring a re-evaluation of the instrument.

### DeepeningIssue — 34 row(s)

| field | value |
|---|---|
| `id` | fcf4c174-f2ac-46e0-a6ca-c5983153ecbb |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:EXISTING_POWER |
| `runVersion` | 1 |
| `text` | _(578 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:26:59.198Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:26:59.198Z |

**`text`**

> The proposal seeks to define 'clear legal duties for senior civil servants regarding outcome delivery and individual responsibility' and establish a 'statutory framework for individual civil servant accountability'. While the Minister for the Civil Service has broad management powers, it is unclear if these powers extend to creating statutory individual legal duties and a comprehensive statutory accountability framework without primary legislation. This requires legal interpretation of the scope of 'management' under the Constitutional Reform and Governance Act 2010, s.3.

| field | value |
|---|---|
| `id` | 71a00bee-782a-4a87-b2b1-66797ed17754 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:EXISTING_POWER |
| `runVersion` | 1 |
| `text` | _(745 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:26:59.288Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:26:59.288Z |

**`text`**

> The proposal aims to empower the Civil Service Commission to 'establish and oversee a standardized, transparent performance management framework, including metrics for individual and team performance, linked directly to the statutory duties, and develop guidelines for rewards and disciplinary actions'. The existing powers of the Civil Service Commission primarily relate to recruitment principles and codes of conduct. It is an issue whether the Minister's power to publish a code of conduct (CRAG Act 2010, s.5) or the Commission's role in recruitment (CRAG Act 2010, s.11) could be interpreted to encompass establishing and overseeing a comprehensive performance management framework with disciplinary powers without new primary legislation.

| field | value |
|---|---|
| `id` | cab31c7b-81e9-4aa7-abfa-187320c4136c |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:EXISTING_POWER |
| `runVersion` | 1 |
| `text` | _(539 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:26:59.370Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:26:59.370Z |

**`text`**

> The proposal suggests that 'Departments will be required to implement new reporting structures that clearly assign individual senior civil servants as 'outcome owners' for specific public service objectives, with regular public reporting on progress against these objectives'. While the Minister for the Civil Service has management powers, it is an issue whether these powers, or existing delegated powers, are sufficient to mandate specific, publicly reported 'outcome owner' roles across all departments without new primary legislation.

| field | value |
|---|---|
| `id` | f29aa09a-e9a2-4480-93fa-8d9d47674232 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:EXISTING_POWER |
| `runVersion` | 1 |
| `text` | _(470 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:26:59.451Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:26:59.451Z |

**`text`**

> The proposal intends to grant the National Audit Office 'enhanced powers under the new legislation to audit departmental performance against the established outcome metrics and individual accountability, with findings reported directly to Parliament'. The existing powers of the Minister for the Civil Service or the Civil Service Commission do not extend to granting enhanced powers to the National Audit Office. This would almost certainly require primary legislation.

| field | value |
|---|---|
| `id` | 4ff1fb98-ef6c-46cc-a8ce-bb49e1098dd8 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `text` | _(729 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:27:30.507Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:27:30.507Z |

**`text`**

> The proposal introduces 'clear legal duties for senior civil servants regarding outcome delivery and individual responsibility'. The existing Constitutional Reform and Governance Act 2010 (CRAG Act) defines the Minister for the Civil Service's power to manage the civil service (s.3) and mandates a Civil Service Code (s.5, s.7). The proposal should clarify how these new statutory duties for individual civil servants will integrate with or supersede the existing framework of ministerial management and the general code of conduct. Specifically, will the new duties be incorporated into the Civil Service Code, or will they exist as a separate statutory layer, and what are the implications for potential conflicts or overlaps?

| field | value |
|---|---|
| `id` | 75968024-6c0a-4579-9e52-c5ddebafa9db |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `text` | _(846 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:27:30.587Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:27:30.587Z |

**`text`**

> The proposal empowers the Civil Service Commission to 'establish and oversee a standardized, transparent performance management framework, including metrics for individual and team performance, linked directly to the statutory duties, and develop guidelines for rewards and disciplinary actions'. The CRAG Act already outlines the Commission's role in recruitment principles (s.11) and its accounts (para 16 of Explanatory Notes). The proposal needs to detail how these new powers for performance management and disciplinary actions will be integrated with the Commission's existing statutory functions and whether this requires amendments to the CRAG Act beyond simply 'empowering through new legislation'. What specific sections of the CRAG Act or other relevant legislation would need to be amended to grant these new powers to the Commission?

| field | value |
|---|---|
| `id` | 89809787-eefb-4103-a6d8-e8d7f2befa84 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `text` | _(767 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:27:30.667Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:27:30.667Z |

**`text`**

> The proposal states that 'Departments will be required to implement new reporting structures that clearly assign individual senior civil servants as 'outcome owners' for specific public service objectives, with regular public reporting on progress against these objectives'. This introduces a new concept of 'outcome owners' and public reporting. The existing legal framework, particularly the CRAG Act, does not explicitly define such roles or reporting requirements. The proposal should identify which existing statutory provisions, if any, would need to be amended to mandate these departmental reporting structures and the public reporting of individual senior civil servant performance. What are the legal mechanisms to enforce such a requirement on departments?

| field | value |
|---|---|
| `id` | 273d7a1b-236c-4224-892c-a9ed7d68206e |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSAL_EVIDENCE |
| `runVersion` | 1 |
| `text` | _(433 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:29:22.483Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:29:22.483Z |

**`text`**

> The proposal highlights 'complexity and opacity of decision-making processes, especially involving quangos and arm's-length bodies.' While there are reports on the relationship between government and arm's-length bodies, the sources do not quantify the 'complexity and opacity' of decision-making processes or their direct impact on accountability. Specific examples or measurements of this complexity would strengthen the diagnosis.

| field | value |
|---|---|
| `id` | 4e0c5e2d-5527-439e-a658-8c1c6873e838 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `text` | _(752 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:27:30.747Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:27:30.747Z |

**`text`**

> The proposal grants the National Audit Office (NAO) 'enhanced powers under the new legislation to audit departmental performance against the established outcome metrics and individual accountability, with findings reported directly to Parliament'. The existing role of the NAO involves scrutinizing public spending and reporting on government projects. The proposal should specify which existing legislation governing the NAO (e.g., National Audit Act 1983, if applicable and in scope) would need to be amended to confer these 'enhanced powers' related to individual accountability and outcome metrics. What are the specific legal definitions or scope changes required for the NAO's audit functions to extend to individual civil servant accountability?

| field | value |
|---|---|
| `id` | 53774d32-98b6-48e2-82fa-07be32c5efb0 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `text` | _(618 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:27:30.828Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:27:30.828Z |

**`text`**

> The proposal refers to 'consequences for underperformance' and 'disciplinary actions'. The current legal framework for civil service discipline is largely governed by internal codes and employment law. The proposal should clarify whether the 'Civil Service Accountability Bill' will introduce new statutory disciplinary procedures or consequences, or if it will integrate with existing processes. If new statutory consequences are envisioned, how will they interact with existing employment rights and protections for civil servants, and what legal definitions would be required for 'underperformance' in this context?

| field | value |
|---|---|
| `id` | 7dad05b6-4cd2-42d7-a9df-06c3636de1fe |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LEGAL_LANDSCAPE |
| `runVersion` | 1 |
| `text` | _(569 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:27:30.908Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:27:30.908Z |

**`text`**

> The proposal mentions 'rewards for high performance'. While the Public Accounts Committee has noted variations in departmental performance-related pay, the legal basis for such rewards is not explicitly detailed in the provided sources. The proposal should consider whether the 'Civil Service Accountability Bill' will establish a statutory framework for performance-based rewards, or if it will empower the Civil Service Commission to develop guidelines within existing legal parameters. What legal provisions would govern the allocation and criteria for such rewards?

| field | value |
|---|---|
| `id` | 691266f3-06f8-4412-a028-c87a6c2dae4a |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CASE_INTERPRETATION |
| `runVersion` | 1 |
| `text` | _(287 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:27:50.988Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:27:50.988Z |

**`text`**

> No judicial construction of the Constitutional Reform and Governance Act 2010, section 3 (management of the civil service), section 5 (civil service code), section 7 (minimum requirements for codes), section 9 (complaints), or section 10 (appointments) was found in the provided sources.

| field | value |
|---|---|
| `id` | 5872b274-a1e2-4609-8b74-c33d579fd082 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CASE_INTERPRETATION |
| `runVersion` | 1 |
| `text` | No judicial construction of the Civil Service (Management Functions) Act 1992, section 1 (delegation of functions), was found in the provided sources. |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:27:51.070Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:27:51.070Z |

| field | value |
|---|---|
| `id` | 839b31a6-054f-4d19-961c-31c211855060 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LINEAGE |
| `runVersion` | 1 |
| `text` | _(339 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:28:54.396Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:28:54.396Z |

**`text`**

> Investigate the specific debates and legislative history surrounding the Constitutional Reform and Governance Act 2010 to determine if the perceived 'diffusion of responsibility' was an anticipated or deliberate outcome of its provisions, particularly concerning the balance between ministerial accountability and civil service management.

| field | value |
|---|---|
| `id` | 7092ae10-1dbb-42f9-a5c4-96877e2a8654 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LINEAGE |
| `runVersion` | 1 |
| `text` | _(265 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:28:54.475Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:28:54.475Z |

**`text`**

> Examine the 'Civil Service Reform Plan' (2012) and subsequent reports to identify if the issue of individual accountability for outcomes was explicitly addressed, and if so, what measures were proposed and why they may not have fully achieved their intended effect.

| field | value |
|---|---|
| `id` | b86bf299-4491-4ab0-a55f-37ddcf2cb47a |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LINEAGE |
| `runVersion` | 1 |
| `text` | _(246 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:28:54.555Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:28:54.555Z |

**`text`**

> Research the historical context and parliamentary discussions from the 1990s regarding the delegation of functions to civil servants to understand the arguments for and against such delegation and how accountability was intended to be maintained.

| field | value |
|---|---|
| `id` | 5403d719-c4cb-4a4f-a1b5-00a115e87422 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LINEAGE |
| `runVersion` | 1 |
| `text` | _(258 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:28:54.634Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:28:54.634Z |

**`text`**

> Analyze the current 'Senior Civil Service: performance management' guidance and its implementation across departments to identify specific areas where it may contribute to or fail to address the 'diffusion of responsibility' and lack of individual ownership.

| field | value |
|---|---|
| `id` | df93639b-a8c5-4d17-b7c2-b436d67e7136 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:LINEAGE |
| `runVersion` | 1 |
| `text` | _(261 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:28:54.714Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:28:54.714Z |

**`text`**

> Explore the reasons behind the 'higher-than-expected' variation in departmental performance-related pay arrangements below SCS level, as noted by the Cabinet Office, to understand if this variation contributes to the perceived lack of individual accountability.

| field | value |
|---|---|
| `id` | 5ed20699-3920-4dcd-8e08-8b874066319a |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSAL_EVIDENCE |
| `runVersion` | 1 |
| `text` | _(505 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:29:22.163Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:29:22.163Z |

**`text`**

> The proposal states that 'incentives within the civil service encourage diffusion of responsibility rather than individual ownership of outcomes.' While there are findings about ongoing debates on accountability and variations in performance-related pay, no source directly quantifies the extent to which diffused responsibility is incentivized or its direct impact on inefficiency, delayed services, or financial waste. Further evidence is needed to directly support this causal claim with measured data.

| field | value |
|---|---|
| `id` | f5c1d75f-a32d-4f39-bb32-60966c20336f |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSAL_EVIDENCE |
| `runVersion` | 1 |
| `text` | _(515 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:29:22.243Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:29:22.243Z |

**`text`**

> The proposal claims 'lack of clear, measurable performance metrics tied to individual accountability and outcomes.' While there are existing performance management guidelines for the SCS and a competency framework, the sources do not provide a comprehensive assessment of whether these are 'clear' or 'measurable' in practice, or the extent to which they are 'tied to individual accountability and outcomes.' This gap needs to be addressed with specific data on the application and effectiveness of current metrics.

| field | value |
|---|---|
| `id` | 3b7434ba-cbf9-41f0-b174-3a475df77e38 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSAL_EVIDENCE |
| `runVersion` | 1 |
| `text` | _(403 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:29:22.323Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:29:22.323Z |

**`text`**

> The proposal mentions 'absence of effective consequences for underperformance and rewards for high performance.' While the Cabinet Office noted variations in performance-related pay, the sources do not quantify the effectiveness or absence of consequences and rewards. Specific data on disciplinary actions for underperformance and tangible rewards for high performance is needed to validate this claim.

| field | value |
|---|---|
| `id` | 3f28177b-4bcd-49c5-8217-5112289746f2 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSAL_EVIDENCE |
| `runVersion` | 1 |
| `text` | _(398 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:29:22.403Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:29:22.403Z |

**`text`**

> The proposal states 'Government legal advisors operate with perceived autonomy, refusing external communication and delaying processes without apparent oversight.' No source directly addresses the specific behavior or accountability of government legal advisors, nor does it quantify the extent of delays or lack of oversight related to them. This is a specific claim that requires direct evidence.

| field | value |
|---|---|
| `id` | 7459ae49-4743-4360-bd1c-901d9ade5f8a |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSAL_EVIDENCE |
| `runVersion` | 1 |
| `text` | _(616 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:29:22.563Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:29:22.563Z |

**`text`**

> The proposal asserts that 'the civil service suffers from a pervasive lack of individual accountability, leading to inefficiency, delayed public services, and significant financial waste.' While public perception suggests dissatisfaction with outcomes and efficiency, and committees discuss accountability, no source provides a direct, quantified measure of the 'pervasive lack of individual accountability' or its direct causal link to specific levels of inefficiency, delays, or financial waste. The diagnosis relies on a plausible causal chain that is not fully supported by measured data in the provided sources.

| field | value |
|---|---|
| `id` | 11517ed6-84c9-485e-92f8-296a9e1aaa6d |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `text` | _(248 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:29:59.060Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:29:59.060Z |

**`text`**

> The proposal for a Civil Service Accountability Bill should consider the findings and recommendations of Lord Maude's Independent Review of Governance and Accountability in the Civil Service (2023) to avoid duplication and build upon existing work.

| field | value |
|---|---|
| `id` | f97dc601-fcad-4b17-a469-b02b65e0229b |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `text` | _(249 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:29:59.139Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:29:59.139Z |

**`text`**

> The proposal should explicitly address how the new statutory framework for individual accountability will interact with or replace the existing 'guided distribution model' for performance markings, which has been a subject of parliamentary scrutiny.

| field | value |
|---|---|
| `id` | dcdc7687-ddb0-4535-a3f4-98fa600cb323 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `text` | _(342 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:29:59.217Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:29:59.217Z |

**`text`**

> Given the historical concern about devolving power to civil servants potentially reducing ministerial accountability, the proposed Civil Service Accountability Bill needs to clearly define the relationship between individual civil servant accountability and ministerial responsibility to avoid unintended consequences or political resistance.

| field | value |
|---|---|
| `id` | 99c59139-dbc7-4e0a-bfa6-433c95d10753 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | question:CAUSE_SEEDING |
| `runVersion` | 1 |
| `text` | _(345 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:29:59.296Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:29:59.296Z |

**`text`**

> The proposal should clarify how the enhanced powers for the National Audit Office to audit departmental performance and individual accountability will integrate with existing parliamentary oversight mechanisms and committee inquiries, such as those by the Public Accounts Committee and Public Administration and Constitutional Affairs Committee.

| field | value |
|---|---|
| `id` | b065f9f6-1e09-4272-b220-72069cf63c53 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | ADVERSARIAL |
| `runVersion` | 1 |
| `text` | _(233 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:30:26.551Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:30:26.551Z |

**`text`**

> The proposal relies heavily on defining 'senior civil servant' and 'outcome owner' to assign legal duties, but no statutory definitions for these critical terms are provided, which will likely lead to extensive definitional disputes.

| field | value |
|---|---|
| `id` | 1a89c522-0369-405a-bc0d-cf5671781987 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | ADVERSARIAL |
| `runVersion` | 1 |
| `text` | _(276 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:30:26.645Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:30:26.645Z |

**`text`**

> The proposal mandates 'clear legal duties' for senior civil servants and 'consequences' for underperformance, but it does not specify the nature or severity of these legal duties or consequences, nor does it address the legal vehicle for their enforcement against individuals.

| field | value |
|---|---|
| `id` | bf3474b7-90d3-4576-a278-cccb2f4bf825 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | ADVERSARIAL |
| `runVersion` | 1 |
| `text` | _(299 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:30:26.782Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:30:26.782Z |

**`text`**

> The proposal assumes that new legislation will empower the Civil Service Commission and National Audit Office with 'enhanced powers,' but it does not clarify whether these bodies currently possess the capacity, resources, or legal expertise to undertake these significantly expanded statutory roles.

| field | value |
|---|---|
| `id` | f245c28b-bb69-4510-af78-ad95a0138774 |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | ADVERSARIAL |
| `runVersion` | 1 |
| `text` | _(248 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:30:26.864Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:30:26.864Z |

**`text`**

> The proposal does not address the potential for conflict between individual 'outcome owner' accountability and the established principle of ministerial accountability to Parliament, which has historically been a cornerstone of the UK civil service.

| field | value |
|---|---|
| `id` | 9848ba03-b6a7-4813-9e76-91412e91247d |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | ADVERSARIAL |
| `runVersion` | 1 |
| `text` | _(340 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:30:26.962Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:30:26.962Z |

**`text`**

> The proposal introduces a 'Civil Service Accountability Bill' to create new legal duties, but it does not fully reconcile this with existing statutory powers of the Minister for the Civil Service under the Constitutional Reform and Governance Act 2010 to manage the civil service, which may already cover aspects of performance and conduct.

| field | value |
|---|---|
| `id` | 91643c42-55d9-4c5c-9f93-9744749cc3be |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | ADVERSARIAL |
| `runVersion` | 1 |
| `text` | _(235 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:30:27.039Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:30:27.039Z |

**`text`**

> The proposal mentions 'regular public reporting on progress against these objectives' by departments, but it does not quantify the administrative burden this new reporting structure will place on departments or how this will be funded.

| field | value |
|---|---|
| `id` | f1f4ffda-662f-4af1-8fc8-58344d51e46c |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `passKey` | REVISE |
| `runVersion` | 1 |
| `text` | _(385 chars — below)_ |
| `status` | OPEN |
| `dismissReason` | _(empty)_ |
| `resolutionNote` | _(empty)_ |
| `resolutionEvidenceId` | _(empty)_ |
| `reviewFindingId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:30:18.515Z |
| `resolvedAt` | _(empty)_ |
| `updatedAt` | 2026-08-24T01:30:18.515Z |

**`text`**

> On the coherence of the actions: The actions are highly concentrated on establishing a new legal and structural framework for individual accountability. The sequencing is logical, starting with legislative drafting, then empowering the Civil Service Commission, followed by departmental implementation and external audit. All implementers are clearly named and have relevant authority.

### ProposalVersion — 0 row(s)

_(none)_

### Document — 1 row(s)

| field | value |
|---|---|
| `id` | 51eaaa69-912f-4c02-bbdd-738ae14ceeca |
| `ideaId` | 452c5ade-3153-400a-bf48-3b71aaa52773 |
| `kind` | INITIAL_BACKGROUND |
| `status` | ready |
| `summary` | _(400 chars — below)_ |
| `body` | _(5126 chars — below)_ |
| `docxUrl` | _(empty)_ |
| `pdfUrl` | _(empty)_ |
| `docxKey` | _(empty)_ |
| `pdfKey` | _(empty)_ |
| `generatedAt` | _(empty)_ |
| `sourceFingerprint` | _(empty)_ |
| `sourceLabel` | _(empty)_ |
| `exportError` | _(empty)_ |
| `proposalVersionId` | _(empty)_ |
| `createdAt` | 2026-08-24T01:25:42.395Z |
| `updatedAt` | 2026-08-24T01:25:42.395Z |

**`summary`**

> The user's experience highlights a perceived lack of accountability and efficiency within the civil service, particularly concerning decision-making processes and the responsiveness of government legal advisors. This aligns with broader parliamentary concerns about civil service accountability and the effectiveness of public bodies. The Public Bodies Act 2011 aimed to increase accountability for a

**`body`**

> ## What the record holds
> The user's experience highlights a perceived lack of accountability and efficiency within the civil service, particularly concerning decision-making processes and the responsiveness of government legal advisors. This aligns with broader parliamentary concerns about civil service accountability and the effectiveness of public bodies. The Public Bodies Act 2011 aimed to increase accountability for actions carried out on behalf of the state by providing ministers with powers to abolish, merge, or modify public bodies, with a focus on improving efficiency, effectiveness, economy, and securing appropriate accountability (Public Bodies Act 2011, ss. 1, 3, 4, 8, 10, 11, 16; Explanatory Notes to Public Bodies Act 2011, paras. 24, 30; CABINET OFFICE — Public Bodies Reform, 2011-12-15). There have been ongoing debates and reports from committees like the Public Administration Select Committee (PASC) and the Constitution Committee regarding the accountability of civil servants and the relationship between government and arm's-length bodies (Report: 6th Report - The accountability of civil servants — Constitution Committee, 2012-11-20; Report: 1st Report - Who's accountable? Relationships between Government and arm's-length bodies — Public Administration Committee, 2014-11-10). Recent discussions, such as the Independent Review of Governance and Accountability in the Civil Service by Lord Maude of Horsham, continue to address these issues (Cabinet Office — Update on Government Reform, 2023-11-13). The National Audit Office (NAO) also plays a role in scrutinizing public spending and reporting on the performance and assurance of major government projects, which implicitly touches upon accountability (major projects authority annual report 2012 13 and government project assurance; assurance for major projects).
> ## Who else has solved a problem like this
> *Reasoning, not retrieval — this comes from Lex’s general knowledge, not from the corpus, and is worth checking.*
> Reasoning here rather than citing from the corpus: Other sectors and geographies have developed robust accountability frameworks that could offer insights. For instance, in the private sector, publicly traded companies are subject to stringent corporate governance regulations (e.g., Sarbanes-Oxley Act in the US, UK Corporate Governance Code) that mandate clear lines of responsibility, independent board oversight, and transparent reporting to shareholders. These frameworks often include performance-based incentives and consequences for failure, directly linking individual and team performance to organizational outcomes. Another example is the military, which has highly structured accountability mechanisms, clear hierarchies of command, and established procedures for evaluating performance and addressing failures, often with severe consequences. Internationally, some public administrations, such as those in Singapore or New Zealand, are often cited for their focus on performance management, meritocracy, and clear accountability structures, including robust mechanisms for performance appraisal and consequence management for civil servants. These often involve performance agreements, regular reviews, and a culture that emphasizes results and individual ownership.
> ## Sources read
> - Public Bodies Act 2011, s.11 — Public Bodies Act 2011
> - Explanatory Notes to Public Bodies Act 2011 — Explanatory Notes — Public Bodies Act 2011
> - Lords: The Civil Service — Lords: The Civil Service
> - Opposition Day — [11th Allotted Day-First Part] — Civil Service — Opposition Day — [11th Allotted Day-First Part] — Civil Service
> - Report: 6th Report - The accountability of civil servants — Constitution Committee — Nonetheless, on occasion a select committee will want to question a — Report: 6th Report - The accountability of civil servants — Constitution Committee — Nonetheless, on occasion a select committee will want to question a
> - Report: 7th Report - Our work in the 2010-2015 Parliament — Public Administration Committee — Bernard Jenkin MP House of Commons 24 March 2015 — Report: 7th Report - Our work in the 2010-2015 Parliament — Public Administration Committee — Bernard Jenkin MP House of Commons 24 March 2015
> - major projects authority annual report 2012 13 and government project assurance — major projects authority annual report 2012 13 and government project assurance
> - major projects authority annual report 2012 13 and government project assurance — major projects authority annual report 2012 13 and government project assurance
> - Public Bodies Act 2011, s.10 — Public Bodies Act 2011
> - Cabinet Office — Civil Service Governance and Accountability Review — Cabinet Office — Civil Service Governance and Accountability Review
> - Report: 1st Report - Who's accountable? Relationships between Government and arm's-length bodies — Public Administration Committee — Report: 1st Report - Who's accountable? Relationships between Government and arm's-length bodies — Public Administration Committee
> - major projects authority annual report 2013 14 — major projects authority annual report 2013 14

### IdeaSourceDecision — 0 row(s)

_(none)_

### IdeaUserMaterial — 0 row(s)

_(none)_

### CostLine — ⚠ NOT QUERIED (this is not a zero): Invalid `model.findMany()` invocation in

---

## Appendix — the large blobs, moved out of line

_Retrieval and transcript artefacts. Here in full because a review should be able to_
_check them, but out of the body because they would otherwise bury the kernel._

### Idea.aiChatHistory

```json
[
  {
    "role": "lex",
    "field": "elicitation:problem",
    "stage": "ELICITATION",
    "content": "Tell me as much as you can about this issue and why you want it solved — what you’ve seen, what you know that isn’t written down anywhere, and what you think is really going on. The outlying details are often what change the whole approach, so nothing is too small to mention.",
    "timestamp": "2026-08-22T01:24:24.721Z"
  },
  {
    "role": "user",
    "field": "elicitation:problem",
    "stage": "ELICITATION",
    "content": "The civil service is plagued by the same issues as any bureaucracy, but worse because it's a public service so it has none of the pressures that keep a private sector process efficient. Most seriously my experience of the civil service as I campaigned to get a VAT structure for care homes approved in Northern Ireland was a total lack of accountability. Not just a lack but the opposite: it seemed to be that every civil servant was incentived to minimise accountability and responsibility by putting the question out to as many co-respondents as possible so as to spread responsibility for the decision, both delaying and obfuscating the process and making it impossible for anyone to be blamed or held accountable for the result either in terms of getting the job done at all, or in terms of minimising the cost and time taken to achieve the objective (save Northern Irish care homes critical money that could be invested in repairs, renovations and improvements). Legal advisors to the process refused to even communicate with anyone outside the government machine instead of being accountable to the public they serve. There have also been plenty of examples of civil servants presiding over failure and being promoted. I want to build the systems and legislation to deliver proper accountability to the civil service, remove those who are not performing, measure who is performing, measure productivity with a goal to match private sector levels, and make sure specific individuals are responsible at every level for delivering the outcome required and cannot evade responsibility, and those who do well are rewarded and promoted, and those who fail are sacked form the civil service. Performance is measured not on who can avoid responsibility, but who is willing to take it and deliver results. results are measured against a metric that recognises when a failure was one of the system vs one of personal failure, and when it's the system the system is changed, and when it's the individual opporunities are there to repair failure or removal and demotion for repeated failure. Look at best practice in accountability from any area, sector or geography, how do we use legislation or any other suitable implementation to deliver the most effective accountable transparent civil service in the world\nThis matters because gettign this right and removing the failures will save the taxpayer billions and slim down the civil service, make it a meritocracy, and turn it into a body that delivers for the public rather than one that opposes and puts a brake on everything politicians have been elected by the public to deliver. The cost is not just the finacial cost of perhaps 2x too many people employed, but the real financial cost of failure, and the impact on the public of massive delays and incompetence in delivery of public service which affects everyone. When it comes to the MOD, it puts the security of the realm at risk.",
    "timestamp": "2026-08-22T01:42:24.248Z"
  },
  {
    "role": "user",
    "field": "elicitation:goal",
    "stage": "ELICITATION",
    "content": "Not sure yet — I want MPs to regain full control and responsibility for all areas of government including the 1200 quangos and for the productivity and acountability all all areas of government to be a clear line of accountability from the top (MPs reporting to parliament) to the bottom. I want both legislation and organisational structures to be put in place to the best standards as understood by the best public and private centre research and practice worldwide. This includes both the structures of accountability in terms of hierarchy and reporting but also best practice in delivering accountability in the most effective way — Ruled out: This will emerge as we investigate best practice",
    "timestamp": "2026-08-22T01:49:03.363Z"
  },
  {
    "role": "user",
    "field": "elicitation:ownKnowledge",
    "stage": "ELICITATION",
    "content": "I've seen at first hand the blocks to transparency and accountability, civil servants who refuse to explain the reasoning behind their decisions or debate them, with nobody being accountable to explain their decisions. Lawyers for the government refusing to even meet with the Care home owners directly affecte by their incredible slowness and pig headedness in refusing to deal with the issue or speed up an element of their work, with nobody apparently able to tell them what to do, they seem a law unto themselves and took 4 years to do what a private lawyer did for me in an afternoon. Even after I gave them what the private lawyer did for me at my expense so the work was already done",
    "timestamp": "2026-08-22T01:54:49.384Z"
  },
  {
    "role": "user",
    "field": "elicitation:reading",
    "stage": "ELICITATION",
    "content": "Look for anything you can find online or in the corpus both examples for promotions for failure, examples of best practice, how is the best accountability achieved anywhere and how do we implement it across all government funded structures in the UK",
    "timestamp": "2026-08-22T01:56:08.097Z"
  },
  {
    "role": "lex",
    "field": "elicitation:confirm",
    "stage": "ELICITATION",
    "content": "Here’s what I understand you’re trying to do — You're aiming to tackle the deep-seated lack of accountability and efficiency within the civil service, which you've experienced firsthand as a frustrating and costly impediment to public service delivery. You want to establish clear lines of responsibility from top to bottom, ensuring individuals are accountable for outcomes, and that performance is measured and rewarded, or failure addressed. This will involve implementing new legislation and organisational structures based on global best practices. I'm reading that you're open to exploring various solutions, but you're firm on the principle of MPs regaining full control and responsibility over all government areas, including quangos. Please tell me if I've misunderstood any part of this.\n\nEverything I write next follows from this, so if I’ve got the wrong end of anything, now is the cheapest moment to say so. Otherwise I’ll go and build it.",
    "timestamp": "2026-08-22T01:56:10.535Z"
  },
  {
    "role": "lex",
    "field": "build:summary",
    "stage": "BUILD",
    "content": "I've drafted the strategy kernel, including the diagnosis, guiding policy, and coherent actions, based on your input. I'm least sure about the specific legal mechanisms for enforcing individual accountability and the precise financial cost of current inefficiencies. The research did not definitively settle whether existing legislation, specifically the Constitutional Reform and Governance Act 2010, already provides sufficient power to address the identified accountability issues, or if new primary legislation is truly necessary.",
    "timestamp": "2026-08-24T01:30:28.936Z"
  },
  {
    "role": "lex",
    "field": "build:credibility",
    "stage": "BUILD",
    "content": "Everything above is mine until you’ve been through it. If this goes to an MP or a committee, you’ll be asked to defend it — so where you disagree, or where I’ve put words in your mouth, change it. Where I’m wrong, that’s the most useful thing you can tell me.",
    "timestamp": "2026-08-24T01:30:28.936Z"
  },
  {
    "role": "lex",
    "field": "build:editing",
    "stage": "BUILD",
    "content": "Put any of it in your own words. That isn’t a fallback for when I get it wrong — it’s the point: the words you’d defend are better than the words I’d write.",
    "timestamp": "2026-08-24T01:30:28.936Z"
  }
]
```

### Idea.legislationRefs

```json
[
  {
    "id": "primary-acts-2000plus:ukpga/2011/24:section-11",
    "url": "https://www.legislation.gov.uk/ukpga/2011/24/section/11",
    "date": "2011-01-01",
    "type": "PRIMARY_LEGISLATION",
    "score": 0.01482213438735178,
    "title": "Public Bodies Act 2011",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "rrf",
    "snippet": "Public Bodies Act 2011 section 11 Procedure 11 1 If after consultation under section 10 the Minister considers it appropriate to proceed with the making of an order under sections 1 to 5, the Minister may lay before Parliament— a a draft order, and b an explanatory document. 2 The explanatory docume",
    "citation": "Public Bodies Act 2011, s.11",
    "attribution": null
  },
  {
    "id": "explanatory-notes:en:ukpga/2011/24:1-0001",
    "url": "https://www.legislation.gov.uk/ukpga/2011/24/notes",
    "date": "",
    "type": "EXPLANATORY_NOTE",
    "score": 0.014034068912117692,
    "title": "Explanatory Notes — Public Bodies Act 2011",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "rrf",
    "snippet": "EXPLANATORY NOTES Public Bodies Act 2011 Chapter 24 £5.75 These notes refer to the Public Bodies Act 2011(c.24) which received Royal Assent on 14th December 2011. 1 PUBLIC BODIES ACT 2011 —————————— EXPLANATORY NOTES INTRODUCTION 1. These explanatory notes relate to the Public Bodies Act 2011 which ",
    "citation": "Explanatory Notes to Public Bodies Act 2011",
    "attribution": null
  },
  {
    "id": "historic-hansard:S5LV0556P0:8316",
    "url": "https://www.hansard-archive.parliament.uk/The_Official_Report,_House_of_Lords_(5th_Series)_Vol_1_(Jan_1909)_to_2004/S5LV0556P0.zip",
    "date": "1994-07-13",
    "type": "DEBATE",
    "score": 78.67574214935303,
    "title": "Lords: The Civil Service",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "bm25",
    "snippet": "Lord Barnett : My Lords, perhaps I may speak as one humble accountant to another. I am sure that the noble Lord will correct me if I am wrong, but his central argument appeared to be that because the Civil Service is 150 years old it must therefore be changed. Why, if it is working well? The noble L",
    "citation": "Lords: The Civil Service",
    "attribution": {
      "name": "Lord Barnett",
      "role": "speaking in Parliament, on the record",
      "source": "speaker"
    }
  },
  {
    "id": "pwdata-debates:debates2008-05-07b:216",
    "url": "http://www.publications.parliament.uk/pa/cm200708/cmhansrd/cm080507/debtext/80507-0008.htm#08050765002093",
    "date": "2008-05-07",
    "type": "DEBATE",
    "score": 77.97638416290283,
    "title": "Opposition Day — [11th Allotted Day-First Part] — Civil Service",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "bm25",
    "snippet": "I think that we do understand how it works. I am not sure what putting it on a statutory footing would mean. The hon. Gentleman may be proposing a Prime Minister's Department; I do not think that that would be the right thing to do. Let me deal with some of the other allegations made by the right ho",
    "citation": "Opposition Day — [11th Allotted Day-First Part] — Civil Service",
    "attribution": {
      "name": "Edward Miliband",
      "role": "speaking in the House of Commons, on the record",
      "source": "speaker"
    }
  },
  {
    "id": "committees-reports:publication:24925:arc-0037",
    "url": "http://www.publications.parliament.uk/pa/ld201213/ldselect/ldconst/61/61.pdf",
    "date": "2012-11-20",
    "type": "COMMITTEE",
    "score": 0.01575682382133995,
    "title": "Report: 6th Report - The accountability of civil servants — Constitution Committee — Nonetheless, on occasion a select committee will want to question a",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "rrf",
    "snippet": "THE ACCOUNTABILITY OF CIVIL SERVANTS 41 Dr Felicity Matthews, Lecturer in Governance and Public Policy, Department of Politics, University of Sheffield * Rt Hon. Francis Maude MP, Minister for the Cabinet Office and Paymaster General Dame Julie Mellor DBE, UK Parliamentary Ombudsman and Health Servi",
    "citation": "Report: 6th Report - The accountability of civil servants — Constitution Committee — Nonetheless, on occasion a select committee will want to question a",
    "attribution": {
      "name": "Constitution Committee",
      "role": "the body that published it",
      "source": "publisher"
    }
  },
  {
    "id": "committees-reports:publication:11758:arc-0005",
    "url": "http://www.publications.parliament.uk/pa/cm201415/cmselect/cmpubadm/1152/1152.pdf",
    "date": "2015-03-28",
    "type": "COMMITTEE",
    "score": 0.014034068912117692,
    "title": "Report: 7th Report - Our work in the 2010-2015 Parliament — Public Administration Committee — Bernard Jenkin MP House of Commons 24 March 2015",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "rrf",
    "snippet": "Bernard Jenkin MP House of Commons 24 March 2015 Our work in the 2010–2015 Parliament 7 1 Introduction 1. The Public Administration Select Committee (PASC) is made up of 11 MPs from the three largest parties represented in the House of Commons. We have two main roles: to examine the reports of the P",
    "citation": "Report: 7th Report - Our work in the 2010-2015 Parliament — Public Administration Committee — Bernard Jenkin MP House of Commons 24 March 2015",
    "attribution": {
      "name": "Public Administration Committee",
      "role": "the body that published it",
      "source": "publisher"
    }
  },
  {
    "id": "nao-reports:major-projects-authority-annual-report-2012-13-and-government-project-assurance:1",
    "url": "https://www.nao.org.uk/wp-content/uploads/2015/02/Major-Projects-Authority-Annual-Report-2012-13-and-government-project-assurance.pdf",
    "date": "",
    "type": "GUIDANCE",
    "score": 0.016129032258064516,
    "title": "major projects authority annual report 2012 13 and government project assurance",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "rrf",
    "snippet": "Major Projects Authority Annual Report 2012‑13 and government project assurance Cabinet Office and HM Treasury Report by the Comptroller and Auditor General HC 1047 SESSION 2013-14 4 FEBRUARY 2014 The National Audit Office scrutinises public spending for Parliament and is independent of government. ",
    "citation": "major projects authority annual report 2012 13 and government project assurance",
    "attribution": null
  },
  {
    "id": "nao-reports:major-projects-authority-annual-report-2012-13-and-government-project-assurance:2",
    "url": "https://www.nao.org.uk/wp-content/uploads/2015/02/Major-Projects-Authority-Annual-Report-2012-13-and-government-project-assurance-Summary.pdf",
    "date": "",
    "type": "GUIDANCE",
    "score": 0.015772478887232988,
    "title": "major projects authority annual report 2012 13 and government project assurance",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "rrf",
    "snippet": "Major Projects Authority Annual Report 2012‑13 and government project assurance Cabinet Office and HM Treasury Report by the Comptroller and Auditor General HC 1047 SESSION 2013-14 4 FEBRUARY 2014 4 Key facts Major Projects Authority Annual Report 2012‑13 and government project assurance Key facts w",
    "citation": "major projects authority annual report 2012 13 and government project assurance",
    "attribution": null
  },
  {
    "id": "primary-acts-2000plus:ukpga/2011/24:section-10",
    "url": "https://www.legislation.gov.uk/ukpga/2011/24/section/10",
    "date": "2011-01-01",
    "type": "PRIMARY_LEGISLATION",
    "score": 0.013865147198480532,
    "title": "Public Bodies Act 2011",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "rrf",
    "snippet": "Public Bodies Act 2011 section 10 Consultation 10 1 A Minister proposing to make an order under sections 1 to 5 must consult— a the body or the holder of the office to which the proposal relates, b such other persons as appear to the Minister to be representative of interests substantially affected ",
    "citation": "Public Bodies Act 2011, s.10",
    "attribution": null
  },
  {
    "id": "pwdata-wrans:answers2026-07-16:519",
    "url": "https://questions-statements.parliament.uk/written-questions/detail/2026-07-09/17347",
    "date": "2026-07-16",
    "type": "DEBATE",
    "score": 71.30371570587158,
    "title": "Cabinet Office — Civil Service Governance and Accountability Review",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "bm25",
    "snippet": "Q (Mike Wood): To ask the Minister for the Cabinet Office, whether he plans to publish a formal response to the recommendations in the Independent Review of Governance and Accountability in the Civil Service by Lord Maude of Horsham. A (Nick Thomas-Symonds): The government is continuing to use Lord",
    "citation": "Cabinet Office — Civil Service Governance and Accountability Review",
    "attribution": {
      "name": "Mike Wood",
      "role": "the minister or body that answered this written question",
      "source": "speaker"
    }
  },
  {
    "id": "committees-reports:publication:11165:arc-0001",
    "url": "http://www.publications.parliament.uk/pa/cm201415/cmselect/cmpubadm/110/110.pdf",
    "date": "2014-11-10",
    "type": "COMMITTEE",
    "score": 0.013836596385542169,
    "title": "Report: 1st Report - Who's accountable? Relationships between Government and arm's-length bodies — Public Administration Committee",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "rrf",
    "snippet": "House of Commons Public Administration Select Committee Who's accountable? Relationships between Government and arm's-length bodies First Report of Session 2014–15 Report, together with formal minutes relating to the report Ordered by the House of Commons to be printed 4 November 2014 HC 110 [INCORP",
    "citation": "Report: 1st Report - Who's accountable? Relationships between Government and arm's-length bodies — Public Administration Committee",
    "attribution": {
      "name": "Public Administration Committee",
      "role": "the body that published it",
      "source": "publisher"
    }
  },
  {
    "id": "nao-reports:major-projects-authority-annual-report-2013-14:1",
    "url": "https://www.nao.org.uk/wp-content/uploads/2014/06/Major-Projects-Authority-Annual-Report-2013-14.pdf",
    "date": "",
    "type": "GUIDANCE",
    "score": 0.015772478887232988,
    "title": "major projects authority annual report 2013 14",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "rrf",
    "snippet": "Report by the Comptroller and Auditor General Cabinet Offi ce and HM Treasury Major Projects Authority Annual Report 2013-14 JUNE 2014 Our vision is to help the nation spend wisely. Our public audit perspective helps Parliament hold government to account and improve public services. The National Aud",
    "citation": "major projects authority annual report 2013 14",
    "attribution": null
  },
  {
    "id": "primary-acts-2000plus:ukpga/2011/24:section-8",
    "url": "https://www.legislation.gov.uk/ukpga/2011/24/section/8",
    "date": "2011-01-01",
    "type": "PRIMARY_LEGISLATION",
    "score": 0.00819672131147541,
    "title": "Public Bodies Act 2011",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "rrf",
    "snippet": "Public Bodies Act 2011 section 8 Purpose and conditions 8 1 A Minister may make an order under sections 1 to 5 only if the Minister considers that the order serves the purpose of improving the exercise of public functions, having regard to— a efficiency, b effectiveness, c economy, and d securing ap",
    "citation": "Public Bodies Act 2011, s.8",
    "attribution": null
  },
  {
    "id": "pwdata-debates:debates1996-05-22a:280",
    "url": "https://www.theyworkforyou.com/pwdata/scrapedxml/debates/debates1996-05-22a.xml",
    "date": "1996-05-22",
    "type": "DEBATE",
    "score": 71.08917236328125,
    "title": "Civil Service",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "bm25",
    "snippet": "It is a gross discourtesy that there is no Minister on the Front Bench to reply to the debate. If that is a trend, it is quite deplorable. For the past 30 years, since I was a consultant to the Fulton committee on the civil service, I have worked in, worked for, written about and generally shadowed",
    "citation": "Civil Service",
    "attribution": {
      "name": "Mr. John Garrett",
      "role": "speaking in the House of Commons, on the record",
      "source": "speaker"
    }
  },
  {
    "id": "committees-evidence:writtenevidence:121125:198928",
    "url": "https://committees.parliament.uk/writtenevidence/121125/html/",
    "date": "2023-07-18",
    "type": "COMMITTEE",
    "score": 0.013691226805980904,
    "title": "Civil Service Leadership and Reform — CLR0002",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "rrf",
    "snippet": "Written evidence from Professor Laurence Ferry [1] , Professor Aileen Murphie [2] and Dr Henry Midgley [3] (CLR0 2 ) Public Administration and Constitutional Affairs Committee Civil Service Leadership and Reform inquiry We welcome this inquiry into the civil service leadership and reform. Our eviden",
    "citation": "Civil Service Leadership and Reform — CLR0002",
    "attribution": {
      "name": "Dr Henry Midgley; Professor Aileen Murphie; Professor Laurence Ferry",
      "role": "the body that published it",
      "source": "publisher"
    }
  },
  {
    "id": "nao-reports:assurance-for-major-projects:2",
    "url": "https://www.nao.org.uk/wp-content/uploads/2012/05/10121698.pdf",
    "date": "",
    "type": "GUIDANCE",
    "score": 0.015504807692307693,
    "title": "assurance for major projects",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "rrf",
    "snippet": "HM Treasury and Cabinet Office Assurance for major projects REPORT BY THE COMPTROLLER AND AUDITOR GENERAL HC 1698 SESSION 2010–2012 2 MAY 2012 The National Audit Office scrutinises public spending on behalf of Parliament. The Comptroller and Auditor General, Amyas Morse, is an Officer of the House o",
    "citation": "assurance for major projects",
    "attribution": null
  },
  {
    "id": "primary-acts-2000plus:ukpga/2011/24:schedule-1-paragraph-1",
    "url": "https://www.legislation.gov.uk/ukpga/2011/24/schedule/1/paragraph/1",
    "date": "2011-01-01",
    "type": "PRIMARY_LEGISLATION",
    "score": 0.00819672131147541,
    "title": "Public Bodies Act 2011",
    "repeal": {
      "state": "repealed-unknown",
      "evidence": "dot-leader-placeholder",
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "rrf",
    "snippet": "1 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .",
    "citation": "Public Bodies Act 2011, sch.1 para.1",
    "attribution": null
  },
  {
    "id": "pwdata-westminster:westminster2008-10-30b:25",
    "url": "http://www.publications.parliament.uk/pa/cm200708/cmhansrd/cm081030/halltext/81030h0002.htm#08103037000368",
    "date": "2008-10-30",
    "type": "DEBATE",
    "score": 70.43663024902344,
    "title": "[Mr. Martyn Jones in the Chair] — Ministers and Civil Servants",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "bm25",
    "snippet": "I was coming on to that. Civil servants say that it is unfair that they should take responsibility for things which Ministers are responsible for. The problem with that case is that we did not know who was responsible. Civil servants also say, \"It's not fair if we don't get consistent leadership and",
    "citation": "[Mr. Martyn Jones in the Chair] — Ministers and Civil Servants",
    "attribution": {
      "name": "Tony Wright",
      "role": "speaking in Westminster Hall, on the record",
      "source": "speaker"
    }
  },
  {
    "id": "committees-reports:publication:14705:arc-0001",
    "url": "https://www.publications.parliament.uk/pa/cm201617/cmselect/cmpubadm/95/95.pdf",
    "date": "2017-04-27",
    "type": "COMMITTEE",
    "score": 0.012994634473507714,
    "title": "Report: 14th Report - Accounting for democracy: making sure Parliament, the people and ministers know how and why public money is spent — Public Administration and Constitutional Affairs Committee",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "rrf",
    "snippet": "HC 95 House of Commons Public Administration and Constitutional Affairs Committee Accounting for democracy: making sure Parliament, the people and ministers know how and why public money is spent Fourteenth Report of Session 2016–17 HC 95 Published on 27 April 2017 by authority of the House of Commo",
    "citation": "Report: 14th Report - Accounting for democracy: making sure Parliament, the people and ministers know how and why public money is spent — Public Administration and Constitutional Affairs Committee",
    "attribution": {
      "name": "Public Administration and Constitutional Affairs Committee",
      "role": "the body that published it",
      "source": "publisher"
    }
  },
  {
    "id": "nao-reports:projects-leaving-the-government-major-projects-portfolio:1",
    "url": "https://www.nao.org.uk/wp-content/uploads/2018/10/Projects-leaving-the-Govenment-Major-Projects-Portfolio.pdf",
    "date": "",
    "type": "GUIDANCE",
    "score": 0.015399194503672116,
    "title": "projects leaving the government major projects portfolio",
    "repeal": {
      "state": "no-record",
      "evidence": null,
      "repealedBy": null,
      "repealedByTitle": null
    },
    "scorer": "rrf",
    "snippet": "",
    "citation": "projects leaving the government major projects portfolio",
    "attribution": null
  }
]
```

### Idea.stageSearches

```json
{
  "byStage": {
    "DIAGNOSIS": {
      "ok": true,
      "query": [
        "civil",
        "service",
        "public",
        "failure",
        "accountability",
        "responsibility",
        "cost",
        "deliver",
        "sector",
        "process",
        "accountable",
        "those",
        "system",
        "private",
        "care",
        "homes",
        "northern",
        "lack"
      ],
      "ranAt": "2026-08-24T01:25:33.036Z",
      "intent": "LEGAL_LANDSCAPE",
      "results": [
        {
          "id": "primary-acts-2000plus:ukpga/2011/24:section-11",
          "url": "https://www.legislation.gov.uk/ukpga/2011/24/section/11",
          "date": "2011-01-01",
          "type": "PRIMARY_LEGISLATION",
          "score": 0.01482213438735178,
          "title": "Public Bodies Act 2011",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "Public Bodies Act 2011 section 11 Procedure 11 1 If after consultation under section 10 the Minister considers it appropriate to proceed with the making of an order under sections 1 to 5, the Minister may lay before Parliament— a a draft order, and b an explanatory document. 2 The explanatory docume",
          "citation": "Public Bodies Act 2011, s.11",
          "attribution": null
        },
        {
          "id": "explanatory-notes:en:ukpga/2011/24:1-0001",
          "url": "https://www.legislation.gov.uk/ukpga/2011/24/notes",
          "date": "",
          "type": "EXPLANATORY_NOTE",
          "score": 0.014034068912117692,
          "title": "Explanatory Notes — Public Bodies Act 2011",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "EXPLANATORY NOTES Public Bodies Act 2011 Chapter 24 £5.75 These notes refer to the Public Bodies Act 2011(c.24) which received Royal Assent on 14th December 2011. 1 PUBLIC BODIES ACT 2011 —————————— EXPLANATORY NOTES INTRODUCTION 1. These explanatory notes relate to the Public Bodies Act 2011 which ",
          "citation": "Explanatory Notes to Public Bodies Act 2011",
          "attribution": null
        },
        {
          "id": "historic-hansard:S5LV0556P0:8316",
          "url": "https://www.hansard-archive.parliament.uk/The_Official_Report,_House_of_Lords_(5th_Series)_Vol_1_(Jan_1909)_to_2004/S5LV0556P0.zip",
          "date": "1994-07-13",
          "type": "DEBATE",
          "score": 78.67574214935303,
          "title": "Lords: The Civil Service",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "bm25",
          "snippet": "Lord Barnett : My Lords, perhaps I may speak as one humble accountant to another. I am sure that the noble Lord will correct me if I am wrong, but his central argument appeared to be that because the Civil Service is 150 years old it must therefore be changed. Why, if it is working well? The noble L",
          "citation": "Lords: The Civil Service",
          "attribution": {
            "name": "Lord Barnett",
            "role": "speaking in Parliament, on the record",
            "source": "speaker"
          }
        },
        {
          "id": "pwdata-debates:debates2008-05-07b:216",
          "url": "http://www.publications.parliament.uk/pa/cm200708/cmhansrd/cm080507/debtext/80507-0008.htm#08050765002093",
          "date": "2008-05-07",
          "type": "DEBATE",
          "score": 77.97638416290283,
          "title": "Opposition Day — [11th Allotted Day-First Part] — Civil Service",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "bm25",
          "snippet": "I think that we do understand how it works. I am not sure what putting it on a statutory footing would mean. The hon. Gentleman may be proposing a Prime Minister's Department; I do not think that that would be the right thing to do. Let me deal with some of the other allegations made by the right ho",
          "citation": "Opposition Day — [11th Allotted Day-First Part] — Civil Service",
          "attribution": {
            "name": "Edward Miliband",
            "role": "speaking in the House of Commons, on the record",
            "source": "speaker"
          }
        },
        {
          "id": "committees-reports:publication:24925:arc-0037",
          "url": "http://www.publications.parliament.uk/pa/ld201213/ldselect/ldconst/61/61.pdf",
          "date": "2012-11-20",
          "type": "COMMITTEE",
          "score": 0.01575682382133995,
          "title": "Report: 6th Report - The accountability of civil servants — Constitution Committee — Nonetheless, on occasion a select committee will want to question a",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "THE ACCOUNTABILITY OF CIVIL SERVANTS 41 Dr Felicity Matthews, Lecturer in Governance and Public Policy, Department of Politics, University of Sheffield * Rt Hon. Francis Maude MP, Minister for the Cabinet Office and Paymaster General Dame Julie Mellor DBE, UK Parliamentary Ombudsman and Health Servi",
          "citation": "Report: 6th Report - The accountability of civil servants — Constitution Committee — Nonetheless, on occasion a select committee will want to question a",
          "attribution": {
            "name": "Constitution Committee",
            "role": "the body that published it",
            "source": "publisher"
          }
        },
        {
          "id": "committees-reports:publication:11758:arc-0005",
          "url": "http://www.publications.parliament.uk/pa/cm201415/cmselect/cmpubadm/1152/1152.pdf",
          "date": "2015-03-28",
          "type": "COMMITTEE",
          "score": 0.014034068912117692,
          "title": "Report: 7th Report - Our work in the 2010-2015 Parliament — Public Administration Committee — Bernard Jenkin MP House of Commons 24 March 2015",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "Bernard Jenkin MP House of Commons 24 March 2015 Our work in the 2010–2015 Parliament 7 1 Introduction 1. The Public Administration Select Committee (PASC) is made up of 11 MPs from the three largest parties represented in the House of Commons. We have two main roles: to examine the reports of the P",
          "citation": "Report: 7th Report - Our work in the 2010-2015 Parliament — Public Administration Committee — Bernard Jenkin MP House of Commons 24 March 2015",
          "attribution": {
            "name": "Public Administration Committee",
            "role": "the body that published it",
            "source": "publisher"
          }
        },
        {
          "id": "nao-reports:major-projects-authority-annual-report-2012-13-and-government-project-assurance:1",
          "url": "https://www.nao.org.uk/wp-content/uploads/2015/02/Major-Projects-Authority-Annual-Report-2012-13-and-government-project-assurance.pdf",
          "date": "",
          "type": "GUIDANCE",
          "score": 0.016129032258064516,
          "title": "major projects authority annual report 2012 13 and government project assurance",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "Major Projects Authority Annual Report 2012‑13 and government project assurance Cabinet Office and HM Treasury Report by the Comptroller and Auditor General HC 1047 SESSION 2013-14 4 FEBRUARY 2014 The National Audit Office scrutinises public spending for Parliament and is independent of government. ",
          "citation": "major projects authority annual report 2012 13 and government project assurance",
          "attribution": null
        },
        {
          "id": "nao-reports:major-projects-authority-annual-report-2012-13-and-government-project-assurance:2",
          "url": "https://www.nao.org.uk/wp-content/uploads/2015/02/Major-Projects-Authority-Annual-Report-2012-13-and-government-project-assurance-Summary.pdf",
          "date": "",
          "type": "GUIDANCE",
          "score": 0.015772478887232988,
          "title": "major projects authority annual report 2012 13 and government project assurance",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "Major Projects Authority Annual Report 2012‑13 and government project assurance Cabinet Office and HM Treasury Report by the Comptroller and Auditor General HC 1047 SESSION 2013-14 4 FEBRUARY 2014 4 Key facts Major Projects Authority Annual Report 2012‑13 and government project assurance Key facts w",
          "citation": "major projects authority annual report 2012 13 and government project assurance",
          "attribution": null
        },
        {
          "id": "primary-acts-2000plus:ukpga/2011/24:section-10",
          "url": "https://www.legislation.gov.uk/ukpga/2011/24/section/10",
          "date": "2011-01-01",
          "type": "PRIMARY_LEGISLATION",
          "score": 0.013865147198480532,
          "title": "Public Bodies Act 2011",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "Public Bodies Act 2011 section 10 Consultation 10 1 A Minister proposing to make an order under sections 1 to 5 must consult— a the body or the holder of the office to which the proposal relates, b such other persons as appear to the Minister to be representative of interests substantially affected ",
          "citation": "Public Bodies Act 2011, s.10",
          "attribution": null
        },
        {
          "id": "pwdata-wrans:answers2026-07-16:519",
          "url": "https://questions-statements.parliament.uk/written-questions/detail/2026-07-09/17347",
          "date": "2026-07-16",
          "type": "DEBATE",
          "score": 71.30371570587158,
          "title": "Cabinet Office — Civil Service Governance and Accountability Review",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "bm25",
          "snippet": "Q (Mike Wood): To ask the Minister for the Cabinet Office, whether he plans to publish a formal response to the recommendations in the Independent Review of Governance and Accountability in the Civil Service by Lord Maude of Horsham. A (Nick Thomas-Symonds): The government is continuing to use Lord",
          "citation": "Cabinet Office — Civil Service Governance and Accountability Review",
          "attribution": {
            "name": "Mike Wood",
            "role": "the minister or body that answered this written question",
            "source": "speaker"
          }
        },
        {
          "id": "committees-reports:publication:11165:arc-0001",
          "url": "http://www.publications.parliament.uk/pa/cm201415/cmselect/cmpubadm/110/110.pdf",
          "date": "2014-11-10",
          "type": "COMMITTEE",
          "score": 0.013836596385542169,
          "title": "Report: 1st Report - Who's accountable? Relationships between Government and arm's-length bodies — Public Administration Committee",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "House of Commons Public Administration Select Committee Who's accountable? Relationships between Government and arm's-length bodies First Report of Session 2014–15 Report, together with formal minutes relating to the report Ordered by the House of Commons to be printed 4 November 2014 HC 110 [INCORP",
          "citation": "Report: 1st Report - Who's accountable? Relationships between Government and arm's-length bodies — Public Administration Committee",
          "attribution": {
            "name": "Public Administration Committee",
            "role": "the body that published it",
            "source": "publisher"
          }
        },
        {
          "id": "nao-reports:major-projects-authority-annual-report-2013-14:1",
          "url": "https://www.nao.org.uk/wp-content/uploads/2014/06/Major-Projects-Authority-Annual-Report-2013-14.pdf",
          "date": "",
          "type": "GUIDANCE",
          "score": 0.015772478887232988,
          "title": "major projects authority annual report 2013 14",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "Report by the Comptroller and Auditor General Cabinet Offi ce and HM Treasury Major Projects Authority Annual Report 2013-14 JUNE 2014 Our vision is to help the nation spend wisely. Our public audit perspective helps Parliament hold government to account and improve public services. The National Aud",
          "citation": "major projects authority annual report 2013 14",
          "attribution": null
        },
        {
          "id": "primary-acts-2000plus:ukpga/2011/24:section-8",
          "url": "https://www.legislation.gov.uk/ukpga/2011/24/section/8",
          "date": "2011-01-01",
          "type": "PRIMARY_LEGISLATION",
          "score": 0.00819672131147541,
          "title": "Public Bodies Act 2011",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "Public Bodies Act 2011 section 8 Purpose and conditions 8 1 A Minister may make an order under sections 1 to 5 only if the Minister considers that the order serves the purpose of improving the exercise of public functions, having regard to— a efficiency, b effectiveness, c economy, and d securing ap",
          "citation": "Public Bodies Act 2011, s.8",
          "attribution": null
        },
        {
          "id": "pwdata-debates:debates1996-05-22a:280",
          "url": "https://www.theyworkforyou.com/pwdata/scrapedxml/debates/debates1996-05-22a.xml",
          "date": "1996-05-22",
          "type": "DEBATE",
          "score": 71.08917236328125,
          "title": "Civil Service",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "bm25",
          "snippet": "It is a gross discourtesy that there is no Minister on the Front Bench to reply to the debate. If that is a trend, it is quite deplorable. For the past 30 years, since I was a consultant to the Fulton committee on the civil service, I have worked in, worked for, written about and generally shadowed",
          "citation": "Civil Service",
          "attribution": {
            "name": "Mr. John Garrett",
            "role": "speaking in the House of Commons, on the record",
            "source": "speaker"
          }
        },
        {
          "id": "committees-evidence:writtenevidence:121125:198928",
          "url": "https://committees.parliament.uk/writtenevidence/121125/html/",
          "date": "2023-07-18",
          "type": "COMMITTEE",
          "score": 0.013691226805980904,
          "title": "Civil Service Leadership and Reform — CLR0002",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "Written evidence from Professor Laurence Ferry [1] , Professor Aileen Murphie [2] and Dr Henry Midgley [3] (CLR0 2 ) Public Administration and Constitutional Affairs Committee Civil Service Leadership and Reform inquiry We welcome this inquiry into the civil service leadership and reform. Our eviden",
          "citation": "Civil Service Leadership and Reform — CLR0002",
          "attribution": {
            "name": "Dr Henry Midgley; Professor Aileen Murphie; Professor Laurence Ferry",
            "role": "the body that published it",
            "source": "publisher"
          }
        },
        {
          "id": "nao-reports:assurance-for-major-projects:2",
          "url": "https://www.nao.org.uk/wp-content/uploads/2012/05/10121698.pdf",
          "date": "",
          "type": "GUIDANCE",
          "score": 0.015504807692307693,
          "title": "assurance for major projects",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "HM Treasury and Cabinet Office Assurance for major projects REPORT BY THE COMPTROLLER AND AUDITOR GENERAL HC 1698 SESSION 2010–2012 2 MAY 2012 The National Audit Office scrutinises public spending on behalf of Parliament. The Comptroller and Auditor General, Amyas Morse, is an Officer of the House o",
          "citation": "assurance for major projects",
          "attribution": null
        },
        {
          "id": "primary-acts-2000plus:ukpga/2011/24:schedule-1-paragraph-1",
          "url": "https://www.legislation.gov.uk/ukpga/2011/24/schedule/1/paragraph/1",
          "date": "2011-01-01",
          "type": "PRIMARY_LEGISLATION",
          "score": 0.00819672131147541,
          "title": "Public Bodies Act 2011",
          "repeal": {
            "state": "repealed-unknown",
            "evidence": "dot-leader-placeholder",
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "1 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .",
          "citation": "Public Bodies Act 2011, sch.1 para.1",
          "attribution": null
        },
        {
          "id": "pwdata-westminster:westminster2008-10-30b:25",
          "url": "http://www.publications.parliament.uk/pa/cm200708/cmhansrd/cm081030/halltext/81030h0002.htm#08103037000368",
          "date": "2008-10-30",
          "type": "DEBATE",
          "score": 70.43663024902344,
          "title": "[Mr. Martyn Jones in the Chair] — Ministers and Civil Servants",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "bm25",
          "snippet": "I was coming on to that. Civil servants say that it is unfair that they should take responsibility for things which Ministers are responsible for. The problem with that case is that we did not know who was responsible. Civil servants also say, \"It's not fair if we don't get consistent leadership and",
          "citation": "[Mr. Martyn Jones in the Chair] — Ministers and Civil Servants",
          "attribution": {
            "name": "Tony Wright",
            "role": "speaking in Westminster Hall, on the record",
            "source": "speaker"
          }
        },
        {
          "id": "committees-reports:publication:14705:arc-0001",
          "url": "https://www.publications.parliament.uk/pa/cm201617/cmselect/cmpubadm/95/95.pdf",
          "date": "2017-04-27",
          "type": "COMMITTEE",
          "score": 0.012994634473507714,
          "title": "Report: 14th Report - Accounting for democracy: making sure Parliament, the people and ministers know how and why public money is spent — Public Administration and Constitutional Affairs Committee",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "HC 95 House of Commons Public Administration and Constitutional Affairs Committee Accounting for democracy: making sure Parliament, the people and ministers know how and why public money is spent Fourteenth Report of Session 2016–17 HC 95 Published on 27 April 2017 by authority of the House of Commo",
          "citation": "Report: 14th Report - Accounting for democracy: making sure Parliament, the people and ministers know how and why public money is spent — Public Administration and Constitutional Affairs Committee",
          "attribution": {
            "name": "Public Administration and Constitutional Affairs Committee",
            "role": "the body that published it",
            "source": "publisher"
          }
        },
        {
          "id": "nao-reports:projects-leaving-the-government-major-projects-portfolio:1",
          "url": "https://www.nao.org.uk/wp-content/uploads/2018/10/Projects-leaving-the-Govenment-Major-Projects-Portfolio.pdf",
          "date": "",
          "type": "GUIDANCE",
          "score": 0.015399194503672116,
          "title": "projects leaving the government major projects portfolio",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "",
          "citation": "projects leaving the government major projects portfolio",
          "attribution": null
        }
      ]
    },
    "ORIENTATION": {
      "ok": true,
      "query": [
        "civil",
        "service",
        "public",
        "failure",
        "accountability",
        "responsibility",
        "cost",
        "deliver",
        "sector",
        "process",
        "accountable",
        "those",
        "system",
        "private",
        "care",
        "homes",
        "northern",
        "lack"
      ],
      "ranAt": "2026-08-24T01:25:33.036Z",
      "intent": "BACKGROUND_BRIEFING",
      "results": [
        {
          "id": "primary-acts-2000plus:ukpga/2011/24:section-11",
          "url": "https://www.legislation.gov.uk/ukpga/2011/24/section/11",
          "date": "2011-01-01",
          "type": "PRIMARY_LEGISLATION",
          "score": 0.01482213438735178,
          "title": "Public Bodies Act 2011",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "Public Bodies Act 2011 section 11 Procedure 11 1 If after consultation under section 10 the Minister considers it appropriate to proceed with the making of an order under sections 1 to 5, the Minister may lay before Parliament— a a draft order, and b an explanatory document. 2 The explanatory docume",
          "citation": "Public Bodies Act 2011, s.11",
          "attribution": null
        },
        {
          "id": "explanatory-notes:en:ukpga/2011/24:1-0001",
          "url": "https://www.legislation.gov.uk/ukpga/2011/24/notes",
          "date": "",
          "type": "EXPLANATORY_NOTE",
          "score": 0.014034068912117692,
          "title": "Explanatory Notes — Public Bodies Act 2011",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "EXPLANATORY NOTES Public Bodies Act 2011 Chapter 24 £5.75 These notes refer to the Public Bodies Act 2011(c.24) which received Royal Assent on 14th December 2011. 1 PUBLIC BODIES ACT 2011 —————————— EXPLANATORY NOTES INTRODUCTION 1. These explanatory notes relate to the Public Bodies Act 2011 which ",
          "citation": "Explanatory Notes to Public Bodies Act 2011",
          "attribution": null
        },
        {
          "id": "historic-hansard:S5LV0556P0:8316",
          "url": "https://www.hansard-archive.parliament.uk/The_Official_Report,_House_of_Lords_(5th_Series)_Vol_1_(Jan_1909)_to_2004/S5LV0556P0.zip",
          "date": "1994-07-13",
          "type": "DEBATE",
          "score": 78.67574214935303,
          "title": "Lords: The Civil Service",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "bm25",
          "snippet": "Lord Barnett : My Lords, perhaps I may speak as one humble accountant to another. I am sure that the noble Lord will correct me if I am wrong, but his central argument appeared to be that because the Civil Service is 150 years old it must therefore be changed. Why, if it is working well? The noble L",
          "citation": "Lords: The Civil Service",
          "attribution": {
            "name": "Lord Barnett",
            "role": "speaking in Parliament, on the record",
            "source": "speaker"
          }
        },
        {
          "id": "pwdata-debates:debates2008-05-07b:216",
          "url": "http://www.publications.parliament.uk/pa/cm200708/cmhansrd/cm080507/debtext/80507-0008.htm#08050765002093",
          "date": "2008-05-07",
          "type": "DEBATE",
          "score": 77.97638416290283,
          "title": "Opposition Day — [11th Allotted Day-First Part] — Civil Service",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "bm25",
          "snippet": "I think that we do understand how it works. I am not sure what putting it on a statutory footing would mean. The hon. Gentleman may be proposing a Prime Minister's Department; I do not think that that would be the right thing to do. Let me deal with some of the other allegations made by the right ho",
          "citation": "Opposition Day — [11th Allotted Day-First Part] — Civil Service",
          "attribution": {
            "name": "Edward Miliband",
            "role": "speaking in the House of Commons, on the record",
            "source": "speaker"
          }
        },
        {
          "id": "committees-reports:publication:24925:arc-0037",
          "url": "http://www.publications.parliament.uk/pa/ld201213/ldselect/ldconst/61/61.pdf",
          "date": "2012-11-20",
          "type": "COMMITTEE",
          "score": 0.01575682382133995,
          "title": "Report: 6th Report - The accountability of civil servants — Constitution Committee — Nonetheless, on occasion a select committee will want to question a",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "THE ACCOUNTABILITY OF CIVIL SERVANTS 41 Dr Felicity Matthews, Lecturer in Governance and Public Policy, Department of Politics, University of Sheffield * Rt Hon. Francis Maude MP, Minister for the Cabinet Office and Paymaster General Dame Julie Mellor DBE, UK Parliamentary Ombudsman and Health Servi",
          "citation": "Report: 6th Report - The accountability of civil servants — Constitution Committee — Nonetheless, on occasion a select committee will want to question a",
          "attribution": {
            "name": "Constitution Committee",
            "role": "the body that published it",
            "source": "publisher"
          }
        },
        {
          "id": "committees-reports:publication:11758:arc-0005",
          "url": "http://www.publications.parliament.uk/pa/cm201415/cmselect/cmpubadm/1152/1152.pdf",
          "date": "2015-03-28",
          "type": "COMMITTEE",
          "score": 0.014034068912117692,
          "title": "Report: 7th Report - Our work in the 2010-2015 Parliament — Public Administration Committee — Bernard Jenkin MP House of Commons 24 March 2015",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "Bernard Jenkin MP House of Commons 24 March 2015 Our work in the 2010–2015 Parliament 7 1 Introduction 1. The Public Administration Select Committee (PASC) is made up of 11 MPs from the three largest parties represented in the House of Commons. We have two main roles: to examine the reports of the P",
          "citation": "Report: 7th Report - Our work in the 2010-2015 Parliament — Public Administration Committee — Bernard Jenkin MP House of Commons 24 March 2015",
          "attribution": {
            "name": "Public Administration Committee",
            "role": "the body that published it",
            "source": "publisher"
          }
        },
        {
          "id": "nao-reports:major-projects-authority-annual-report-2012-13-and-government-project-assurance:1",
          "url": "https://www.nao.org.uk/wp-content/uploads/2015/02/Major-Projects-Authority-Annual-Report-2012-13-and-government-project-assurance.pdf",
          "date": "",
          "type": "GUIDANCE",
          "score": 0.016129032258064516,
          "title": "major projects authority annual report 2012 13 and government project assurance",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "Major Projects Authority Annual Report 2012‑13 and government project assurance Cabinet Office and HM Treasury Report by the Comptroller and Auditor General HC 1047 SESSION 2013-14 4 FEBRUARY 2014 The National Audit Office scrutinises public spending for Parliament and is independent of government. ",
          "citation": "major projects authority annual report 2012 13 and government project assurance",
          "attribution": null
        },
        {
          "id": "nao-reports:major-projects-authority-annual-report-2012-13-and-government-project-assurance:2",
          "url": "https://www.nao.org.uk/wp-content/uploads/2015/02/Major-Projects-Authority-Annual-Report-2012-13-and-government-project-assurance-Summary.pdf",
          "date": "",
          "type": "GUIDANCE",
          "score": 0.015772478887232988,
          "title": "major projects authority annual report 2012 13 and government project assurance",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "Major Projects Authority Annual Report 2012‑13 and government project assurance Cabinet Office and HM Treasury Report by the Comptroller and Auditor General HC 1047 SESSION 2013-14 4 FEBRUARY 2014 4 Key facts Major Projects Authority Annual Report 2012‑13 and government project assurance Key facts w",
          "citation": "major projects authority annual report 2012 13 and government project assurance",
          "attribution": null
        },
        {
          "id": "primary-acts-2000plus:ukpga/2011/24:section-10",
          "url": "https://www.legislation.gov.uk/ukpga/2011/24/section/10",
          "date": "2011-01-01",
          "type": "PRIMARY_LEGISLATION",
          "score": 0.013865147198480532,
          "title": "Public Bodies Act 2011",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "Public Bodies Act 2011 section 10 Consultation 10 1 A Minister proposing to make an order under sections 1 to 5 must consult— a the body or the holder of the office to which the proposal relates, b such other persons as appear to the Minister to be representative of interests substantially affected ",
          "citation": "Public Bodies Act 2011, s.10",
          "attribution": null
        },
        {
          "id": "pwdata-wrans:answers2026-07-16:519",
          "url": "https://questions-statements.parliament.uk/written-questions/detail/2026-07-09/17347",
          "date": "2026-07-16",
          "type": "DEBATE",
          "score": 71.30371570587158,
          "title": "Cabinet Office — Civil Service Governance and Accountability Review",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "bm25",
          "snippet": "Q (Mike Wood): To ask the Minister for the Cabinet Office, whether he plans to publish a formal response to the recommendations in the Independent Review of Governance and Accountability in the Civil Service by Lord Maude of Horsham. A (Nick Thomas-Symonds): The government is continuing to use Lord",
          "citation": "Cabinet Office — Civil Service Governance and Accountability Review",
          "attribution": {
            "name": "Mike Wood",
            "role": "the minister or body that answered this written question",
            "source": "speaker"
          }
        },
        {
          "id": "committees-reports:publication:11165:arc-0001",
          "url": "http://www.publications.parliament.uk/pa/cm201415/cmselect/cmpubadm/110/110.pdf",
          "date": "2014-11-10",
          "type": "COMMITTEE",
          "score": 0.013836596385542169,
          "title": "Report: 1st Report - Who's accountable? Relationships between Government and arm's-length bodies — Public Administration Committee",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "House of Commons Public Administration Select Committee Who's accountable? Relationships between Government and arm's-length bodies First Report of Session 2014–15 Report, together with formal minutes relating to the report Ordered by the House of Commons to be printed 4 November 2014 HC 110 [INCORP",
          "citation": "Report: 1st Report - Who's accountable? Relationships between Government and arm's-length bodies — Public Administration Committee",
          "attribution": {
            "name": "Public Administration Committee",
            "role": "the body that published it",
            "source": "publisher"
          }
        },
        {
          "id": "nao-reports:major-projects-authority-annual-report-2013-14:1",
          "url": "https://www.nao.org.uk/wp-content/uploads/2014/06/Major-Projects-Authority-Annual-Report-2013-14.pdf",
          "date": "",
          "type": "GUIDANCE",
          "score": 0.015772478887232988,
          "title": "major projects authority annual report 2013 14",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "Report by the Comptroller and Auditor General Cabinet Offi ce and HM Treasury Major Projects Authority Annual Report 2013-14 JUNE 2014 Our vision is to help the nation spend wisely. Our public audit perspective helps Parliament hold government to account and improve public services. The National Aud",
          "citation": "major projects authority annual report 2013 14",
          "attribution": null
        },
        {
          "id": "primary-acts-2000plus:ukpga/2011/24:section-8",
          "url": "https://www.legislation.gov.uk/ukpga/2011/24/section/8",
          "date": "2011-01-01",
          "type": "PRIMARY_LEGISLATION",
          "score": 0.00819672131147541,
          "title": "Public Bodies Act 2011",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "Public Bodies Act 2011 section 8 Purpose and conditions 8 1 A Minister may make an order under sections 1 to 5 only if the Minister considers that the order serves the purpose of improving the exercise of public functions, having regard to— a efficiency, b effectiveness, c economy, and d securing ap",
          "citation": "Public Bodies Act 2011, s.8",
          "attribution": null
        },
        {
          "id": "pwdata-debates:debates1996-05-22a:280",
          "url": "https://www.theyworkforyou.com/pwdata/scrapedxml/debates/debates1996-05-22a.xml",
          "date": "1996-05-22",
          "type": "DEBATE",
          "score": 71.08917236328125,
          "title": "Civil Service",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "bm25",
          "snippet": "It is a gross discourtesy that there is no Minister on the Front Bench to reply to the debate. If that is a trend, it is quite deplorable. For the past 30 years, since I was a consultant to the Fulton committee on the civil service, I have worked in, worked for, written about and generally shadowed",
          "citation": "Civil Service",
          "attribution": {
            "name": "Mr. John Garrett",
            "role": "speaking in the House of Commons, on the record",
            "source": "speaker"
          }
        },
        {
          "id": "committees-evidence:writtenevidence:121125:198928",
          "url": "https://committees.parliament.uk/writtenevidence/121125/html/",
          "date": "2023-07-18",
          "type": "COMMITTEE",
          "score": 0.013691226805980904,
          "title": "Civil Service Leadership and Reform — CLR0002",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "Written evidence from Professor Laurence Ferry [1] , Professor Aileen Murphie [2] and Dr Henry Midgley [3] (CLR0 2 ) Public Administration and Constitutional Affairs Committee Civil Service Leadership and Reform inquiry We welcome this inquiry into the civil service leadership and reform. Our eviden",
          "citation": "Civil Service Leadership and Reform — CLR0002",
          "attribution": {
            "name": "Dr Henry Midgley; Professor Aileen Murphie; Professor Laurence Ferry",
            "role": "the body that published it",
            "source": "publisher"
          }
        },
        {
          "id": "nao-reports:assurance-for-major-projects:2",
          "url": "https://www.nao.org.uk/wp-content/uploads/2012/05/10121698.pdf",
          "date": "",
          "type": "GUIDANCE",
          "score": 0.015504807692307693,
          "title": "assurance for major projects",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "HM Treasury and Cabinet Office Assurance for major projects REPORT BY THE COMPTROLLER AND AUDITOR GENERAL HC 1698 SESSION 2010–2012 2 MAY 2012 The National Audit Office scrutinises public spending on behalf of Parliament. The Comptroller and Auditor General, Amyas Morse, is an Officer of the House o",
          "citation": "assurance for major projects",
          "attribution": null
        },
        {
          "id": "primary-acts-2000plus:ukpga/2011/24:schedule-1-paragraph-1",
          "url": "https://www.legislation.gov.uk/ukpga/2011/24/schedule/1/paragraph/1",
          "date": "2011-01-01",
          "type": "PRIMARY_LEGISLATION",
          "score": 0.00819672131147541,
          "title": "Public Bodies Act 2011",
          "repeal": {
            "state": "repealed-unknown",
            "evidence": "dot-leader-placeholder",
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "1 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .",
          "citation": "Public Bodies Act 2011, sch.1 para.1",
          "attribution": null
        },
        {
          "id": "pwdata-westminster:westminster2008-10-30b:25",
          "url": "http://www.publications.parliament.uk/pa/cm200708/cmhansrd/cm081030/halltext/81030h0002.htm#08103037000368",
          "date": "2008-10-30",
          "type": "DEBATE",
          "score": 70.43663024902344,
          "title": "[Mr. Martyn Jones in the Chair] — Ministers and Civil Servants",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "bm25",
          "snippet": "I was coming on to that. Civil servants say that it is unfair that they should take responsibility for things which Ministers are responsible for. The problem with that case is that we did not know who was responsible. Civil servants also say, \"It's not fair if we don't get consistent leadership and",
          "citation": "[Mr. Martyn Jones in the Chair] — Ministers and Civil Servants",
          "attribution": {
            "name": "Tony Wright",
            "role": "speaking in Westminster Hall, on the record",
            "source": "speaker"
          }
        },
        {
          "id": "committees-reports:publication:14705:arc-0001",
          "url": "https://www.publications.parliament.uk/pa/cm201617/cmselect/cmpubadm/95/95.pdf",
          "date": "2017-04-27",
          "type": "COMMITTEE",
          "score": 0.012994634473507714,
          "title": "Report: 14th Report - Accounting for democracy: making sure Parliament, the people and ministers know how and why public money is spent — Public Administration and Constitutional Affairs Committee",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "HC 95 House of Commons Public Administration and Constitutional Affairs Committee Accounting for democracy: making sure Parliament, the people and ministers know how and why public money is spent Fourteenth Report of Session 2016–17 HC 95 Published on 27 April 2017 by authority of the House of Commo",
          "citation": "Report: 14th Report - Accounting for democracy: making sure Parliament, the people and ministers know how and why public money is spent — Public Administration and Constitutional Affairs Committee",
          "attribution": {
            "name": "Public Administration and Constitutional Affairs Committee",
            "role": "the body that published it",
            "source": "publisher"
          }
        },
        {
          "id": "nao-reports:projects-leaving-the-government-major-projects-portfolio:1",
          "url": "https://www.nao.org.uk/wp-content/uploads/2018/10/Projects-leaving-the-Govenment-Major-Projects-Portfolio.pdf",
          "date": "",
          "type": "GUIDANCE",
          "score": 0.015399194503672116,
          "title": "projects leaving the government major projects portfolio",
          "repeal": {
            "state": "no-record",
            "evidence": null,
            "repealedBy": null,
            "repealedByTitle": null
          },
          "scorer": "rrf",
          "snippet": "",
          "citation": "projects leaving the government major projects portfolio",
          "attribution": null
        }
      ]
    }
  },
  "version": 2,
  "research": []
}
```

### carry

```json
{
  "research": "⚠ AN EXISTING POWER MAY REMOVE THE NEED FOR PRIMARY LEGISLATION. The Constitutional Reform and Governance Act 2010, section 3(1), confers on the Minister for the Civil Service the power to manage the civil service (excluding the diplomatic service). — The findings confirm the Minister for the Civil Service has a general power to manage the civil service, but it is unclear whether this power extends to all aspects of the proposed primary legislation without further detail on the specific changes intended. This must be reconsidered before anything else in the revision.\n\nWhether a power to do this already exists: 11 findings — Reviewed 100 sources; 19 bore on this proposal. Still unanswered: No source explicitly details the procedure (e.g., affirmative, negative resolution) for exercising the Minister for the Civil Service's general management powers under the Constitutional Reform and Governance Act 2010, beyond the lack of parliamentary procedure for laying the Civil Service Code.; No source directly addresses whether the existing management powers of the Minister for the Civil Service or the Civil Service Commission are sufficient to create legally binding individual duties for civil servants regarding outcome delivery and responsibility, or to establish a statutory performance management framework with consequences, without new primary legislation.; No source provides a detailed breakdown of the specific limits of the Minister for the Civil Service's management powers in relation to mandating new reporting structures for individual accountability and public reporting across departments.\nThe law as it stands: 13 findings — Reviewed 100 sources; 36 bore on this proposal. Still unanswered: What definitions would have to change, and what else uses them?; No source explicitly defines 'senior civil servant' in a statutory context.; No source quantifies the current level of individual accountability or its impact on efficiency and financial waste.; No source details the specific legal framework for disciplinary actions against civil servants for underperformance.; No source provides a comprehensive overview of the current legal basis for performance-related pay and rewards within the civil service.; No source explicitly outlines the current statutory reporting structures for individual civil servant performance or outcome ownership.; No source details the specific legal powers of the National Audit Office regarding auditing individual accountability within government departments.; No source provides a statutory definition of 'outcome delivery' or 'individual responsibility' in the context of civil service duties.; No source details the specific legal mechanisms for enforcing new statutory duties on individual civil servants.\nHow the courts have read it: 6 findings — Reviewed 100 sources; 19 bore on this proposal. Still unanswered: Did that construction narrow or widen it, and does the proposal depend on which?; Judicial construction of the Constitutional Reform and Governance Act 2010, sections 3, 5, 7, 9, and 10.; Judicial construction of the Civil Service (Management Functions) Act 1992, section 1.\nWhy the rule reads the way it does: 9 findings — Reviewed 100 sources; 56 bore on this proposal. Still unanswered: No source explicitly states that the 'diffusion of responsibility' was a deliberate choice when the current rules were written. Instead, the historical context suggests a tension between ministerial accountability and the delegation of functions to civil servants.; No source directly quantifies the extent of 'diffusion of responsibility' or its impact on public service outcomes, making it difficult to assess the scale of the problem the proposal aims to fix.; The specific intentions behind the design of the performance management systems, particularly regarding individual accountability for outcomes, are not fully detailed in the provided sources, beyond general aims of reform and efficiency.; No source provides a direct statement from the time of the CRAG Act 2010's enactment or the 2012 Civil Service Reform Plan explicitly stating an intention to create or maintain a system that encourages diffusion of responsibility.\nWhether the diagnosis holds up: 10 findings — Reviewed 100 sources; 25 bore on this proposal. Still unanswered: No source quantifies the extent to which existing incentives within the civil service encourage diffusion of responsibility over individual ownership.; No source provides specific data on the clarity, measurability, and individual accountability linkage of current performance metrics across the civil service.; No source quantifies the effectiveness or absence of consequences for underperformance and rewards for high performance within the civil service.; No source provides direct evidence or quantification of the perceived autonomy, refusal of external communication, or delays caused by government legal advisors.; No source quantifies the 'complexity and opacity' of decision-making processes, particularly involving quangos and arm's-length bodies, or their direct impact on accountability.; No source provides a direct, quantified measure of the 'pervasive lack of individual accountability' or its direct causal link to specific levels of inefficiency, delayed public services, or financial waste.\nWhere this has been examined before: 20 findings, 1 of which CONTRADICT the draft — Reviewed 100 sources; 43 bore on this proposal. Still unanswered: No source quantifies how many bags enter waterways each year.; No source provides specific recommendations from Lord Maude's 2023 review that were not acted upon.; No source details specific recommendations from the Public Administration Select Committee (PASC) or Constitution Committee reports that were not implemented.; No source explicitly states whether the 'guided distribution model' for performance markings was recommended for abolition and if so, whether that recommendation was acted upon.\nWhat other sectors built for the same problem: 0 findings"
}
```
