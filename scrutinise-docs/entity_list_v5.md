# SCRUTINISE — ENTITY LIST v5

*Complete entity and field specification. Source of truth for Prisma schema generation.* *v5.0: V2 changes — Strategic Kernel expansion, field labels, CoherentAction benefits structure, ResourcesCommitted human capital, GuidingPolicy Rumelt additions, TargetOrganisation type field. 13 April 2026.* *CCh-only document — never edited directly by CC. Charlie approves all changes.*

***

## FIELD PRESERVATION RULE

**Never remove a field, entity, or section unless Charlie has explicitly instructed its deletion in the same conversation. "Tidying", "consolidating", and "simplifying" are not valid reasons to remove anything. When in doubt, keep it. This rule cannot be waived.**

***

Contents

[SCRUTINISE — ENTITY LIST v5](#scrutinise--entity-list-v5)

[FIELD PRESERVATION RULE](#field-preservation-rule)

[Contents](#_Toc227021317)

[SECTION 1 — CORE {\#section-1}](#section-1--core-section-1)

[User](#user)

[PartyMembership](#partymembership)

[Idea](#idea)

[WordingHistory](#wordinghistory)

[StageTransition](#stagetransition)

[Stage](#stage)

[SECTION 2 — STRATEGIC KERNEL {\#section-2}](#section-2--strategic-kernel-section-2)

[Diagnosis](#diagnosis)

[RootCause](#rootcause)

[GuidingPolicy](#guidingpolicy)

[Evidence](#evidence)

[CoherentAction](#coherentaction)

[ResourcesCommitted](#resourcescommitted)

[SECTION 3 — LEGISLATION & ORGANISATION {\#section-3}](#section-3--legislation--organisation-section-3)

[TargetLegislation](#targetlegislation)

[TargetOrganisation](#targetorganisation)

[Situation](#situation)

[ParliamentaryProgress](#parliamentaryprogress)

[SECTION 4 — RESEARCH {\#section-4}](#section-4--research-section-4)

[Research](#research)

[Attachment](#attachment)

[SECTION 5 — IDEA MODIFICATIONS {\#section-5}](#section-5--idea-modifications-section-5)

[Vote](#vote)

[Comment](#comment)

[CommentRating](#commentrating)

[Amendment](#amendment)

[AmendmentVote](#amendmentvote)

[ConsultationVote](#consultationvote)

[BroadcastMessage](#broadcastmessage)

[SECTION 6 — ENDORSEMENTS {\#section-6}](#section-6--endorsements-section-6)

[Endorsement](#endorsement)

[DraftsmanEndorsement](#draftsmanendorsement)

[SECTION 7 — COLLABORATION {\#section-7}](#section-7--collaboration-section-7)

[IdeaCollaborator](#ideacollaborator)

[IdeaCollaboratorRole](#ideacollaboratorrole)

[IdeaReview](#ideareview)

[TeamMessage](#teammessage)

[Group](#group)

[GroupMember](#groupmember)

[GroupMessage](#groupmessage)

[GroupInvite](#groupinvite)

[UserInvite](#userinvite)

[StageTransitionRequest](#stagetransitionrequest)

[SECTION 8 — REPUTATION & POINTS {\#section-8}](#section-8--reputation--points-section-8)

[Reputation](#reputation)

[PointsLedger](#pointsledger)

[CredibilityScore](#credibilityscore)

[SECTION 9 — REFERRAL & MERGE {\#section-9}](#section-9--referral--merge-section-9)

[ReferralEvent](#referralevent)

[MergedIdea](#mergedidea)

[SECTION 10 — MESSAGING {\#section-10}](#section-10--messaging-section-10)

[MessageThread](#messagethread)

[Message](#message)

[SECTION 11 — MODERATION {\#section-11}](#section-11--moderation-section-11)

[ContentReport](#contentreport)

[SECTION 12 — GDPR & EMAIL {\#section-12}](#section-12--gdpr--email-section-12)

[EmailSuppression](#emailsuppression)

[UserParliamentaryVerification](#userparliamentaryverification)

[UserProfessionalVerification](#userprofessionalverification)

[SECTION 13 — NOTIFICATIONS & ACTIVITY {\#section-13}](#section-13--notifications--activity-section-13)

[Notification](#notification)

[ActivityLog](#activitylog)

[SECTION 14 — AI & TRACKING {\#section-14}](#section-14--ai--tracking-section-14)

[AIUsageLog](#aiusagelog)

[AIConversation](#aiconversation)

[LexFeedbackEvent](#lexfeedbackevent)

[SECTION 15 — PLATFORM CONFIG {\#section-15}](#section-15--platform-config-section-15)

[PlatformConfig](#platformconfig)

[SECTION 16 — QUALITY METRICS {\#section-16}](#section-16--quality-metrics-section-16)

[LegislativeQualityScore](#legislativequalityscore)

[SECTION 17 — SOCIAL {\#section-17}](#section-17--social-section-17)

[OwnerThanks](#ownerthanks)

[FeatureRequest](#featurerequest)

[FeatureRequestVote](#featurerequestvote)

[SECTION 18 — JURISDICTION {\#section-18}](#section-18--jurisdiction-section-18)

[JurisdictionType](#jurisdictiontype)

[SECTION 19 — DEFERRED {\#section-19}](#section-19--deferred-section-19)

[Fundraise](#fundraise)

[WhatsAppIntegration](#whatsappintegration)

[SECTION 20 — TRAINING {\#section-20}](#section-20--training-section-20)

[Training](#training)

[SECTION 21 — FOLLOWS & WATCHES {\#section-21}](#section-21--follows--watches-section-21)

[Follow](#follow)

[SECTION 22 — DISPUTED LOGIC FLAGS {\#section-22}](#section-22--disputed-logic-flags-section-22)

[DisputedLogicFlag](#disputedlogicflag)

[SECTION 23 — FIELD LABELS {\#section-23}](#section-23--field-labels-section-23)

[Diagnosis](#diagnosis-1)

[Root Cause](#root-cause)

[Guiding Policy](#guiding-policy)

[Evidence](#evidence-1)

[Coherent Action](#coherent-action)

[Resources Committed](#resources-committed)

[Idea core](#idea-core)

***

## SECTION 1 — CORE {\#section-1}

### User

| Field                         | Type              | Notes                                                                                    |
|-------------------------------|-------------------|------------------------------------------------------------------------------------------|
| id                            | UUID PK           |                                                                                          |
| clerkId                       | String UNIQUE     | Clerk's user ID — join key between Clerk and our DB                                      |
| name                          | String            | Full name                                                                                |
| firstName                     | String            |                                                                                          |
| lastName                      | String            |                                                                                          |
| displayName                   | String            | What the user is called (defaults to "Boss" until set)                                   |
| **preferredName**             | String nullable   | How the user wants Lex to address them. Defaults to firstName. Set during Clerk sign-up. |
| username                      | String UNIQUE     | @handle, auto-generated from name, user can change once                                  |
| email                         | String UNIQUE     |                                                                                          |
| emailVerified                 | Boolean           | Default false                                                                            |
| mobile                        | String            | Required for registration                                                                |
| mobileVerified                | Boolean           | Default false. Verified via SMS OTP.                                                     |
| bio                           | Text nullable     | Rich text, public-facing                                                                 |
| role                          | Enum              | CITIZEN, MODERATOR, ADMIN, SUPER_ADMIN                                                   |
| expertType                    | String nullable   | Free text professional credentials                                                       |
| **manualCredibilityOverride** | Decimal nullable  | Set by SuperAdmin. Displayed credibility = max(rawScore, override).                      |
| politicalParty                | String nullable   | Legacy. Retained for backwards compatibility.                                            |
| partyMembership               | String nullable   | Legacy. Retained.                                                                        |
| membershipNumber              | String nullable   |                                                                                          |
| memberSince                   | DateTime nullable |                                                                                          |
| address                       | Text nullable     |                                                                                          |
| businessOrOrganisation        | String nullable   |                                                                                          |
| parliamentary_status          | Enum nullable     | MP, PEER, NONE                                                                           |
| parliamentary_verified        | Boolean           | Default false                                                                            |
| professional_verified         | Boolean           | Default false — for Parliamentary Draftsmen                                              |
| aiCreditBalance               | Decimal           | Default 0                                                                                |
| aiUsageTotal                  | Decimal           | Default 0                                                                                |
| aiPreferredStyle              | String nullable   | COLLABORATIVE (default), SOCRATIC, DIRECT                                                |
| **politicalSpectrumX**        | Decimal nullable  | Left/Right, -5.0 to +5.0. Private.                                                       |
| **politicalSpectrumY**        | Decimal nullable  | Nation State, -5.0 to +5.0. Private.                                                     |
| **ageConfirmed**              | Boolean           | Default false                                                                            |
| **tcAgreedAt**                | DateTime nullable |                                                                                          |
| **rulesAgreedAt**             | DateTime nullable |                                                                                          |
| **tcVersion**                 | String nullable   |                                                                                          |
| donationsMadeTotal            | Decimal           | Default 0                                                                                |
| donationsMadeList             | JSON nullable     |                                                                                          |
| friendsWith                   | JSON nullable     |                                                                                          |
| referralCode                  | String UNIQUE     | Cryptographically random, generated on account creation                                  |
| referredByUserId              | FK nullable       | → User                                                                                   |
| country                       | String nullable   | ISO 3166-1 alpha-2. Default 'GB'.                                                        |
| joinDate                      | DateTime          |                                                                                          |
| createdAt                     | DateTime          |                                                                                          |
| updatedAt                     | DateTime          |                                                                                          |
| lastActiveAt                  | DateTime nullable |                                                                                          |
| status                        | Enum              | ACTIVE, SUSPENDED, DELETION_PENDING, DELETED                                             |

Relations: ideas[], votes[], comments[], endorsements[], reputation, credibilityScore, notifications[], messages[], groups[], ideaCollaborators[], partyMemberships[]

***

### PartyMembership

| Field            | Type              | Notes         |
|------------------|-------------------|---------------|
| id               | UUID PK           |               |
| userId           | FK                | → User        |
| partyName        | String            |               |
| membershipNumber | String nullable   |               |
| memberSince      | DateTime nullable |               |
| isPrimary        | Boolean           | Default false |
| createdAt        | DateTime          |               |

***

### Idea

| Field                     | Type              | Notes                                                            |
|---------------------------|-------------------|------------------------------------------------------------------|
| id                        | UUID PK           |                                                                  |
| creatorId                 | FK                | → User                                                           |
| **BASIC INFO**            |                   |                                                                  |
| title                     | String            | Max 200 chars                                                    |
| summaryDescription        | String            | Max 280 chars                                                    |
| summaryDiagnosis          | Text nullable     |                                                                  |
| summaryGuidingPolicy      | Text nullable     |                                                                  |
| summaryCoherentActions    | Text nullable     |                                                                  |
| ideaType                  | Enum              | LEGISLATION, ORGANISATION                                        |
| govtArea                  | String            |                                                                  |
| govtLevel                 | Enum              | LOCAL, DEVOLVED, NATIONAL, INTERNATIONAL                         |
| country                   | String nullable   | ISO 3166-1 alpha-2. Default 'GB'.                                |
| connectedIdeaIds          | JSON nullable     |                                                                  |
| **STRATEGIC KERNEL**      |                   |                                                                  |
| diagnosis                 | Text nullable     | Legacy short field. Retained.                                    |
| guidingPolicy             | Text nullable     | Legacy short field. Retained.                                    |
| rootCause                 | Text nullable     | Legacy short field. Retained.                                    |
| **CLASSIFICATION**        |                   |                                                                  |
| stage                     | Enum              | STAGE_1, STAGE_2, STAGE_3, STAGE_4, STAGE_5, ARCHIVED, WITHDRAWN |
| visibility                | Enum              | PRIVATE, LINK_ONLY, PLATFORM_LISTED                              |
| status                    | Enum              | DRAFT, ACTIVE, ARCHIVED, MERGED, WITHDRAWN                       |
| sector                    | String nullable   |                                                                  |
| legalType                 | String nullable   |                                                                  |
| **JURISDICTION**          |                   |                                                                  |
| jurisdictionTypeId        | FK nullable       | → JurisdictionType                                               |
| jurisdictionName          | String nullable   |                                                                  |
| **WORDING**               |                   |                                                                  |
| proposedWording           | Text nullable     | Locked once first vote received.                                 |
| wordingLocked             | Boolean           | Default false                                                    |
| version                   | Integer           | Default 1                                                        |
| **METRICS**               |                   |                                                                  |
| voteCount                 | Integer           | Default 0                                                        |
| passionScore              | Decimal nullable  |                                                                  |
| credibilityWeightedRating | Decimal nullable  | Sprint 2                                                         |
| voteDistribution          | JSON nullable     |                                                                  |
| commentCount              | Integer           | Default 0                                                        |
| amendmentCount            | Integer           | Default 0                                                        |
| endorsementCount          | Integer           | Default 0                                                        |
| viewCount                 | Integer           | Default 0                                                        |
| approvalRating            | Decimal nullable  |                                                                  |
| votesSupport              | Integer           | Default 0                                                        |
| votesOppose               | Integer           | Default 0                                                        |
| votesAbstain              | Integer           | Default 0                                                        |
| **MATURITY INDEX**        |                   |                                                                  |
| maturityIndex             | Decimal           | Default 0                                                        |
| maturityIndexDetail       | JSON nullable     |                                                                  |
| maturityLastUpdated       | DateTime nullable |                                                                  |
| **STAGE ELIGIBILITY**     |                   |                                                                  |
| eligibleForNextStage      | Boolean           |                                                                  |
| stageEligibleSince        | DateTime nullable |                                                                  |
| voteTarget                | Integer nullable  |                                                                  |
| **VERSION CONTROL**       |                   |                                                                  |
| parentIdeaId              | FK nullable       | → Idea                                                           |
| linkedIdeaIds             | JSON nullable     |                                                                  |
| linkTypes                 | JSON nullable     |                                                                  |
| **TEAM**                  |                   |                                                                  |
| teamClonedFromIdeaId      | FK nullable       | → Idea                                                           |
| **SEARCH**                |                   |                                                                  |
| searchVector              | Text nullable     |                                                                  |
| **GROUP ASSOCIATION**     |                   |                                                                  |
| groupId                   | FK nullable       | → Group                                                          |
| **AI**                    |                   |                                                                  |
| aiProvider                | Enum              | GEMINI_FLASH, GROK_FAST, USER_CLAUDE, USER_GPT4O, USER_GROK      |
| aiChatHistory             | JSON              | Rolling last-20-messages                                         |
| aiChatSummary             | Text nullable     |                                                                  |
| aiCurrentField            | String nullable   |                                                                  |
| aiSessionCount            | Integer           | Default 0                                                        |
| **REFERRAL**              |                   |                                                                  |
| referralLinkActive        | Boolean           | Default false. Set true on Stage 3.                              |
| **TIMESTAMPS**            |                   |                                                                  |
| createdAt                 | DateTime          |                                                                  |
| updatedAt                 | DateTime          |                                                                  |
| publishedAt               | DateTime nullable |                                                                  |
| withdrawnAt               | DateTime nullable |                                                                  |

***

### WordingHistory

| Field           | Type        | Notes                                       |
|-----------------|-------------|---------------------------------------------|
| id              | UUID PK     |                                             |
| ideaId          | FK          | → Idea                                      |
| version         | Integer     |                                             |
| wordingText     | Text        |                                             |
| changedByUserId | FK          | → User                                      |
| changeType      | Enum        | DIRECT_EDIT, AMENDMENT_ACCEPTED, OWNER_EDIT |
| amendmentId     | FK nullable | → Amendment                                 |
| createdAt       | DateTime    |                                             |

***

### StageTransition

| Field                      | Type             | Notes                  |
|----------------------------|------------------|------------------------|
| id                         | UUID PK          |                        |
| ideaId                     | FK               | → Idea                 |
| fromStage                  | Enum             |                        |
| toStage                    | Enum             |                        |
| triggeredBy                | String           | "AUTOMATIC" or "OWNER" |
| triggeredByUserId          | FK               | → User                 |
| transitionReason           | Text nullable    |                        |
| voteCountAtTransition      | Integer nullable |                        |
| approvalRatingAtTransition | Decimal nullable |                        |
| adminUserId                | FK nullable      | → User                 |
| notes                      | Text nullable    |                        |
| createdAt                  | DateTime         |                        |

***

### Stage

| Field               | Type       | Notes                                           |
|---------------------|------------|-------------------------------------------------|
| stageNumber         | Integer PK | 1–5                                             |
| name                | String     | Create, Draft, Develop, Campaign, **Legislate** |
| description         | Text       |                                                 |
| requiredPermissions | JSON       |                                                 |
| transitionCriteria  | JSON       |                                                 |
| availableActions    | JSON       |                                                 |

Note: Stage 5 is **Legislate** everywhere. Never "Parliament" as a stage name.

***

## SECTION 2 — STRATEGIC KERNEL {\#section-2}

*The Strategic Kernel is the intellectual core of every idea. Lex guides users through these entities in sequence: Diagnosis → RootCause(s) → GuidingPolicy → Evidence → CoherentAction(s) → ResourcesCommitted.*

### Diagnosis

What is the real challenge? UI section heading: **Diagnosis — The Challenge**

| Field                | Type            | Notes                                      |
|----------------------|-----------------|--------------------------------------------|
| id                   | UUID PK         |                                            |
| ideaId               | FK              | → Idea                                     |
| diagnosisTitle       | String nullable | User label: **The Challenge**              |
| diagnosisDescription | Text nullable   | User label: **Describe the Challenge**     |
| text                 | Text nullable   | Legacy field, retained                     |
| obstacleDefined      | Text nullable   | User label: **What's Blocking Progress**   |
| whoAffected          | Text nullable   | User label: **Who Is Affected**            |
| howAffected          | Text nullable   | User label: **How They're Affected**       |
| whyPersisted         | Text nullable   | User label: **Why Has This Gone Unsolved** |
| impactDescription    | Text nullable   | User label: **The Impact**                 |
| impactCost           | Text nullable   | User label: **The Cost of Inaction**       |
| diagnosisData        | JSON nullable   | Multiple supporting data points            |
| version              | Integer         |                                            |
| createdAt            | DateTime        |                                            |
| updatedAt            | DateTime        |                                            |

Relations: rootCauses[]

***

### RootCause

Multiple per Diagnosis. Each root cause is a distinct causal chain node. UI section heading: **Root Causes — Why It Happens**

| Field                | Type            | Notes                                                                                 |
|----------------------|-----------------|---------------------------------------------------------------------------------------|
| id                   | UUID PK         |                                                                                       |
| ideaId               | FK              | → Idea                                                                                |
| diagnosisId          | FK nullable     | → Diagnosis                                                                           |
| rootCauseTitle       | String nullable | User label: **Root Cause**                                                            |
| rootCauseDescription | Text nullable   | User label: **Explain This Cause**                                                    |
| text                 | Text nullable   | Legacy, retained                                                                      |
| rootCauseLinkBack    | Text nullable   | User label: **What Caused This Cause** — upstream in the causal chain                 |
| rootCauseLinkForward | Text nullable   | User label: **What Does This Cause Lead To** — downstream effects                     |
| rootCauseMechanism   | Text nullable   | User label: **How It Works** — the mechanism by which this cause produces the problem |
| whyNotSolved         | Text nullable   | User label: **Why Hasn't This Been Fixed**                                            |
| incentiveDrivers     | Text nullable   | User label: **Incentives Keeping It in Place**                                        |
| structureDrivers     | Text nullable   | User label: **Structural Factors**                                                    |
| version              | Integer         |                                                                                       |
| createdAt            | DateTime        |                                                                                       |

***

### GuidingPolicy

The approach that deals with the challenge. Informed by Rumelt's definition: a guiding policy channels action by ruling out some approaches and ruling in others. It does not specify every action, but it gives every subsequent decision a test to pass. UI section heading: **Guiding Policy — Your Approach**

**Rumelt test for a strong guiding policy:** It must (1) connect explicitly to the diagnosed root cause, (2) rule out alternative approaches, (3) explain *why* this approach rather than others, and (4) state the pre-conditions that must be true for it to work. A policy that does not close off alternatives is a goal, not a policy.

| Field                               | Type            | Notes                                                                                                                                                                                 |
|-------------------------------------|-----------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| id                                  | UUID PK         |                                                                                                                                                                                       |
| ideaId                              | FK              | → Idea                                                                                                                                                                                |
| guidingPolicyTitle                  | String nullable | User label: **Your Approach**                                                                                                                                                         |
| guidingPolicyDescription            | Text nullable   | User label: **Describe Your Approach** — the broad statement of how you will deal with the challenge                                                                                  |
| text                                | Text nullable   | Legacy, retained                                                                                                                                                                      |
| coreTheory                          | Text nullable   | User label: **Your Theory of Change** — the causal logic: "If we do X, then Y will happen, because Z"                                                                                 |
| **linkToDiagnosis**                 | Text nullable   | **NEW v5** — User label: **How This Addresses the Root Cause** — explicit connection: "This approach works because the root cause is X and this mechanism directly addresses X by..." |
| **whatThisPolicyRulesOut**          | Text nullable   | **NEW v5** — User label: **What We're Not Doing** — explicitly closes off alternatives (the Rumelt test). A policy that doesn't rule anything out is a wish, not a policy.            |
| **whyThisApproachNotOthers**        | Text nullable   | **NEW v5** — User label: **Why This Approach** — justification for this approach over the alternatives in competitiveIdeaAnalysis                                                     |
| **conditionsForSuccess**            | Text nullable   | **NEW v5** — User label: **What Has to Be True** — pre-conditions that must hold for this policy to work; assumptions that if wrong would invalidate it                               |
| **mechanismTypes**                  | MechanismType[] | **UPDATED v5.1** — replaces 5 separate mechanism String? fields. Array of enum values. User label: **Mechanism Types** — which mechanism categories does this approach use?           |
| tradeOffs                           | Text nullable   | User label: **Trade-offs & Compromises** — what does this approach sacrifice or accept as a cost?                                                                                     |
| competitiveIdeaAnalysis             | Text nullable   | User label: **Competing Approaches** — what alternative approaches exist and why are they inferior for this diagnosis?                                                                |
| version                             | Integer         |                                                                                                                                                                                       |
| createdAt                           | DateTime        |                                                                                                                                                                                       |

Relations: evidence[]

**Note on mechanism types (v5.1):** The 5 separate mechanism String? fields (`mechanismIncentives`, `mechanismRules`, `mechanismTransparency`, `mechanismMarketDesign`, `mechanismInstitutionalRestructuring`) were replaced in V2G sprint with a single `mechanismTypes MechanismType[]` array. Mechanism types are not mutually exclusive — most strong policies use multiple. Lex should guide the user to select all that apply. See MechanismType enum below.

**MechanismType enum (NEW v5.1):**

```
INCENTIVES                   — changes what it is in actors' interest to do
RULES                        — imposes rules that actors must follow
TRANSPARENCY                 — uses disclosure or information to change behaviour
MARKET_DESIGN                — restructures how a market operates
INSTITUTIONAL_RESTRUCTURING  — changes who is responsible for what
```

***

### Evidence

Supporting evidence for the guiding policy. Real-world precedents of comparable policies. UI section heading: **Evidence — Real-World Precedents**

| Field            | Type            | Notes                                                                              |
|------------------|-----------------|------------------------------------------------------------------------------------|
| id               | UUID PK         |                                                                                    |
| ideaId           | FK              | → Idea                                                                             |
| guidingPolicyId  | FK nullable     | → GuidingPolicy                                                                    |
| title            | String          |                                                                                    |
| description      | Text            |                                                                                    |
| comparablePolicy | Text nullable   | User label: **Comparable Policy** — the real-world policy being cited              |
| successFailure   | Enum nullable   | SUCCESS, FAILURE, MIXED. User label: **Did It Work**                               |
| whatWorked       | Text nullable   | User label: **What Worked**                                                        |
| whatFailed       | Text nullable   | User label: **What Failed**                                                        |
| resultCauses     | Text nullable   | User label: **Why It Turned Out That Way** — the causal explanation of the outcome |
| sourceUrl        | String nullable |                                                                                    |
| sourceType       | Enum            | ACADEMIC, GOVERNMENT, NEWS, CASE_STUDY, LEGISLATION, OTHER                         |
| createdAt        | DateTime        |                                                                                    |

***

### CoherentAction

A practical step implementing the guiding policy. Multiple per idea. UI section heading: **Coherent Actions — What Is to Be Changed**

**Design note:** Benefits must mirror costs. For every cost dimension there is a matching benefit dimension. Net cost/benefit fields sit above both cost and benefit breakdowns.

| Field                            | Type             | Notes                                                                                                                                                  |
|----------------------------------|------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| id                               | UUID PK          |                                                                                                                                                        |
| ideaId                           | FK               | → Idea                                                                                                                                                 |
| title                            | String           | User label: **Action Title**                                                                                                                           |
| summarySnippet                   | Text nullable    | User label: **One-line Summary**                                                                                                                       |
| detailedDescription              | Text nullable    | User label: **What This Does and Why** — link explicitly to the diagnosis and guiding policy                                                           |
| actionType                       | String nullable  | User label: **Type of Change** — e.g. "Legislative", "Regulatory", "Structural", "Operational"                                                         |
| legislationDraftWording          | Text nullable    | User label: **Draft Legislation Wording**                                                                                                              |
| organisationalChangeDraftWording | Text nullable    | User label: **Organisational Change Wording**                                                                                                          |
| proposedWording                  | Text nullable    | Legacy alias, retained                                                                                                                                 |
| **NET COST/BENEFIT**             |                  |                                                                                                                                                        |
| costBenefitAnalysis              | Text nullable    | User label: **Cost-Benefit Summary** — high-level narrative of net position upfront and ongoing. Populated after cost and benefit fields are complete. |
| **netCostOngoing**               | Decimal nullable | **NEW v5** — User label: **Net Annual Cost (£)** — ongoing costs minus ongoing benefits, annualised                                                    |
| **netCostOneOff**                | Decimal nullable | **NEW v5** — User label: **Net One-off Cost (£)** — one-off setup costs minus one-off benefits                                                         |
| **COSTS**                        |                  |                                                                                                                                                        |
| costFinancial                    | Text nullable    | User label: **Financial Cost of this Action**                                                                                                          |
| costSocial                       | Text nullable    | User label: **Social Cost of this Action**                                                                                                             |
| costOngoing                      | Text nullable    | User label: **Annual Ongoing Costs of this Action**                                                                                                    |
| **BENEFITS**                     |                  |                                                                                                                                                        |
| **benefitFinancial**             | Text nullable    | **NEW v5** — User label: **Financial Benefits of this Action** — mirrors costFinancial                                                                 |
| **benefitSocial**                | Text nullable    | **NEW v5** — User label: **Social Benefits of this Action** — mirrors costSocial                                                                       |
| **benefitOngoing**               | Text nullable    | **NEW v5** — User label: **Annual Ongoing Benefits of this Action** — mirrors costOngoing                                                              |
| benefits                         | Text nullable    | Legacy general benefits field, retained                                                                                                                |
| **IMPLEMENTATION**               |                  |                                                                                                                                                        |
| practicalExecution               | Text nullable    | User label: **How This Action Is Carried Out**                                                                                                         |
| implementationPlan               | Text nullable    | User label: **Implementation Plan**                                                                                                                    |
| implementationSubQuestions       | JSON nullable    | Structured: { who, what, where, how, why, when }                                                                                                       |
| accountability                   | Text nullable    | User label: **Accountability**                                                                                                                         |
| successMeasurement               | Text nullable    | User label: **How Success Is Measured**                                                                                                                |
| **RISKS & OPPOSITION**           |                  |                                                                                                                                                        |
| keyRisks                         | Text nullable    | User label: **Key Risks**                                                                                                                              |
| potentialHarm                    | Text nullable    | User label: **Potential Harms**                                                                                                                        |
| keyChallenges                    | Text nullable    | User label: **Key Challenges**                                                                                                                         |
| sourcesOfOpposition              | Text nullable    | User label: **Sources of Opposition**                                                                                                                  |
| oppositionWho                    | Text nullable    | User label: **Who Will Oppose This**                                                                                                                   |
| oppositionWhy                    | Text nullable    | User label: **Why They'll Oppose It**                                                                                                                  |
| oppositionAnswers                | Text nullable    | User label: **Responses to Opposition**                                                                                                                |
| **mechanismType**                | MechanismType? nullable | **NEW v5.1** — User label: **Mechanism Type** — the primary mechanism category for this specific action (see MechanismType enum)                  |
| **META**                         |                  |                                                                                                                                                        |
| orderIndex                       | Integer          | Display order                                                                                                                                          |
| version                          | Integer          |                                                                                                                                                        |
| createdAt                        | DateTime         |                                                                                                                                                        |
| updatedAt                        | DateTime         |                                                                                                                                                        |

Note: Votes on an idea auto-vote for all CoherentActions. Users can optionally vote for/against specific CoherentActions. Relations: resourcesCommitted[]

***

### ResourcesCommitted

Resources committed to a specific Coherent Action. Multiple per CoherentAction. UI section heading: **Resources — What You're Committing**

| Field                             | Type             | Notes                                                                                                                                  |
|-----------------------------------|------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| id                                | UUID PK          |                                                                                                                                        |
| ideaId                            | FK               | → Idea                                                                                                                                 |
| coherentActionId                  | FK               | → CoherentAction                                                                                                                       |
| description                       | Text             | User label: **Resource Description**                                                                                                   |
| resourceType                      | Enum             | FINANCIAL, HUMAN, INFRASTRUCTURE, LEGISLATIVE, OTHER                                                                                   |
| capitalCommitment                 | Decimal nullable | User label: **Capital Commitment** — one-off upfront cost                                                                              |
| annualCost                        | JSON nullable    | User label: **Annual Cost** — array of up to 50 years of costs; default to 10-year projection                                          |
| estimatedCost                     | Decimal nullable | Legacy total estimate, retained                                                                                                        |
| timeframe                         | String nullable  | User label: **Timeframe** — default "10 years"                                                                                         |
| **humanCapitalCommitted**         | Text nullable    | **NEW v5** — User label: **Human Capital Committed** — people, roles, or FTE committed upfront (e.g. "3 FTE project team for 2 years") |
| **humanCapitalAnnualRequirement** | Text nullable    | **NEW v5** — User label: **Human Capital Annual Requirement** — ongoing staffing need (e.g. "1 FTE compliance officer permanently")    |
| createdAt                         | DateTime         |                                                                                                                                        |

***

## SECTION 3 — LEGISLATION & ORGANISATION {\#section-3}

### TargetLegislation

| Field                       | Type            | Notes                          |
|-----------------------------|-----------------|--------------------------------|
| id                          | UUID PK         |                                |
| ideaId                      | FK              | → Idea                         |
| targetLegislationTitle      | String          | User label: **Laws to Change** |
| targetLegislationYear       | String          |                                |
| targetLegislationUrl        | String nullable |                                |
| legislationJurisdictionType | String nullable |                                |
| jurisdictionName            | String nullable |                                |
| legalType                   | String nullable |                                |
| targetOrRelevant            | Enum nullable   | TARGET, RELEVANT               |
| changeType                  | Enum            | AMEND, REPEAL, NEW_ACT         |
| wordingOfRevision           | Text nullable   |                                |
| draftNumber                 | String nullable |                                |
| draftHistory                | JSON nullable   |                                |
| relevantClauses             | Text nullable   |                                |
| relationshipType            | String nullable |                                |
| summary                     | Text nullable   |                                |
| createdAt                   | DateTime        |                                |
| updatedAt                   | DateTime        |                                |

***

### TargetOrganisation

Organisation that must act or change behaviour as a result of the idea. User label: **Who Must Act**

| Field                       | Type          | Notes                                                                         |
|-----------------------------|---------------|-------------------------------------------------------------------------------|
| id                          | UUID PK       |                                                                               |
| ideaId                      | FK            | → Idea                                                                        |
| targetOrganisationalTitle   | String        | Name of the organisation                                                      |
| **organisationType**        | Enum          | **UPDATED v5** — See TargetOrganisationType enum below. Was free-text String. |
| description                 | Text nullable |                                                                               |
| currentBehaviourDescription | Text nullable |                                                                               |
| changeRequired              | Text nullable |                                                                               |
| howToBringAbout             | Text nullable |                                                                               |
| whoAccountable              | Text nullable |                                                                               |
| howResultsMeasured          | Text nullable |                                                                               |
| howChangeIncentivised       | Text nullable |                                                                               |
| problemsLikely              | Text nullable |                                                                               |
| mitigatingActions           | Text nullable |                                                                               |
| createdAt                   | DateTime      |                                                                               |
| updatedAt                   | DateTime      |                                                                               |

**TargetOrganisationType enum (NEW v5):**

```
GOVERNMENT_DEPARTMENT    — e.g. HMRC, DWP, DHSC
ARMS_LENGTH_BODY         — e.g. Ofcom, Environment Agency, CMA
LOCAL_AUTHORITY          — council or combined authority
DEVOLVED_GOVERNMENT      — Scottish Government, Welsh Government, NI Executive
NHS_BODY                 — NHS England, NHS Trust, ICB
REGULATOR                — financial, professional, or sector regulator
POLICE_FORCE             — individual force or NPCC
COURT_OR_TRIBUNAL        — HMCTS, specific court or tribunal
PRIVATE_SECTOR           — named company or industry sector
THIRD_SECTOR             — charity, housing association, social enterprise
EDUCATION_INSTITUTION    — school, university, college
INTERNATIONAL_BODY       — UN agency, EU institution, treaty body
OTHER                    — open text fallback
```

This is a controlled list, not free text. Lex should suggest the most appropriate type; the user confirms. Admin can extend the list via PlatformConfig.

***

### Situation

| Field              | Type             | Notes  |
|--------------------|------------------|--------|
| id                 | UUID PK          |        |
| ideaId             | FK               | → Idea |
| title              | String           |        |
| description        | Text             |        |
| practicalEffect    | Text nullable    |        |
| affectedPopulation | Integer nullable |        |
| geographicScope    | String nullable  |        |
| createdBy          | FK               | → User |
| createdAt          | DateTime         |        |
| updatedAt          | DateTime         |        |

***

### ParliamentaryProgress

| Field              | Type              | Notes                                                                                                           |
|--------------------|-------------------|-----------------------------------------------------------------------------------------------------------------|
| id                 | UUID PK           |                                                                                                                 |
| ideaId             | FK UNIQUE         | → Idea                                                                                                          |
| billNumber         | String nullable   |                                                                                                                 |
| committeeId        | String nullable   |                                                                                                                 |
| committeeName      | String nullable   |                                                                                                                 |
| committeeChair     | String nullable   |                                                                                                                 |
| nextReadingDate    | DateTime nullable |                                                                                                                 |
| nextReadingTime    | String nullable   |                                                                                                                 |
| nextReadingType    | String nullable   |                                                                                                                 |
| submissionDeadline | DateTime nullable |                                                                                                                 |
| submissionEmail    | String nullable   |                                                                                                                 |
| submissionFormat   | String nullable   |                                                                                                                 |
| currentStage       | Enum nullable     | SUBMITTED, FIRST_READING, EVIDENCE_SESSION, SECOND_READING, COMMITTEE_STAGE, THIRD_READING, LORDS, ROYAL_ASSENT |
| progressStages     | JSON              |                                                                                                                 |
| createdAt          | DateTime          |                                                                                                                 |
| updatedAt          | DateTime          |                                                                                                                 |

***

## SECTION 4 — RESEARCH {\#section-4}

### Research

| Field                | Type             | Notes                                                      |
|----------------------|------------------|------------------------------------------------------------|
| id                   | UUID PK          |                                                            |
| ideaId               | FK               | → Idea                                                     |
| addedByUserId        | FK               | → User                                                     |
| linkedIdeas          | JSON nullable    |                                                            |
| researchType         | Enum             | EVIDENCE, CASE_STUDY, CAUSES, PERSPECTIVES, OTHER          |
| title                | String           |                                                            |
| snippet              | Text             |                                                            |
| relevanceExplanation | Text             |                                                            |
| summaryOfContent     | Text nullable    |                                                            |
| summary              | Text nullable    |                                                            |
| link                 | String nullable  |                                                            |
| sourceUrl            | String           | Validated via Google Safe Browsing                         |
| sourceType           | Enum             | ACADEMIC, GOVERNMENT, NEWS, CASE_STUDY, LEGISLATION, OTHER |
| forOrAgainstPolicy   | Boolean nullable |                                                            |
| forOrAgainstAction   | Boolean nullable |                                                            |
| forPolicy            | Boolean nullable |                                                            |
| forAction            | Boolean nullable |                                                            |
| constructiveScore    | Integer nullable |                                                            |
| retracted            | Boolean          | Default false                                              |
| retractionUrl        | String nullable  |                                                            |
| createdAt            | DateTime         |                                                            |
| updatedAt            | DateTime         |                                                            |

***

### Attachment

| Field            | Type        | Notes                    |
|------------------|-------------|--------------------------|
| id               | UUID PK     |                          |
| ideaId           | FK nullable | → Idea                   |
| researchId       | FK nullable | → Research               |
| uploadedByUserId | FK          | → User                   |
| fileName         | String      |                          |
| fileType         | Enum        | PDF, IMAGE               |
| fileSizeBytes    | Integer     |                          |
| r2ObjectKey      | String      |                          |
| r2Bucket         | String      |                          |
| virusScanStatus  | Enum        | PENDING, CLEAN, INFECTED |
| createdAt        | DateTime    |                          |

***

## SECTION 5 — IDEA MODIFICATIONS {\#section-5}

### Vote

One vote per user per idea. Visible from Stage 4 only.

| Field             | Type             | Notes                                                     |
|-------------------|------------------|-----------------------------------------------------------|
| id                | UUID PK          |                                                           |
| ideaId            | FK               | → Idea                                                    |
| userId            | FK               | → User                                                    |
| direction         | Enum             | FOR, AGAINST, UNDECIDED                                   |
| strength          | Decimal          | 0.0 to 5.0 in 0.5 increments                              |
| voteWeight        | Decimal nullable |                                                           |
| qualityFlags      | JSON nullable    | ["doesnt_go_far_enough", "goes_too_far", "poorly_worded"] |
| ipAddressHash     | String nullable  | SHA-256 only                                              |
| isAnonymous       | Boolean          | Default false                                             |
| referralCode      | String nullable  |                                                           |
| referral_event_id | FK nullable      | → ReferralEvent                                           |
| withdrawn         | Boolean          | Default false                                             |
| castAt            | DateTime         |                                                           |
| updatedAt         | DateTime         |                                                           |

Constraint: UNIQUE(ideaId, userId)

***

### Comment

Flat contribution system. UI label: **Contribution** (not "Comment").

| Field                  | Type             | Notes                                                                                               |
|------------------------|------------------|-----------------------------------------------------------------------------------------------------|
| id                     | UUID PK          |                                                                                                     |
| ideaId                 | FK               | → Idea                                                                                              |
| authorId               | FK               | → User                                                                                              |
| parentId               | FK nullable      | → Comment (owner reply only)                                                                        |
| commentNumber          | Integer nullable | Sequential per idea. Displayed as "\#12".                                                           |
| groupedWithCommentId   | FK nullable      | → Comment                                                                                           |
| groupLabel             | String nullable  |                                                                                                     |
| stageNumber            | Integer nullable |                                                                                                     |
| content                | Text             | Rich text. DOMPurify sanitised.                                                                     |
| contributionType       | Enum nullable    | NEW_INFORMATION, RED_TEAM_CHALLENGE, MINOR_ADJUSTMENT, ADDITIONAL_COHERENT_ACTION, AMENDMENT, OTHER |
| stance                 | Enum             | SUPPORTIVE, CRITICAL, NEUTRAL, QUESTION                                                             |
| constructivenessScore  | Integer nullable |                                                                                                     |
| suggestedChanges       | Boolean          | Default false                                                                                       |
| suggestedChangeType    | String nullable  |                                                                                                     |
| suggestedChangeField   | String nullable  |                                                                                                     |
| suggestedChangeOldText | Text nullable    |                                                                                                     |
| suggestedChangeNewText | Text nullable    |                                                                                                     |
| attachedLegislationId  | FK nullable      | → TargetLegislation                                                                                 |
| attachedResearchId     | FK nullable      | → Research                                                                                          |
| isOwnerReply           | Boolean          | Default false                                                                                       |
| helpfulCount           | Integer          | Default 0                                                                                           |
| notHelpfulCount        | Integer          | Default 0                                                                                           |
| isHidden               | Boolean          | Default false                                                                                       |
| editHistory            | JSON nullable    |                                                                                                     |
| qualityRating          | Integer nullable | Denormalised avg from CommentRating                                                                 |
| createdAt              | DateTime         |                                                                                                     |
| updatedAt              | DateTime         |                                                                                                     |

***

### CommentRating

| Field         | Type             | Notes                                                                 |
|---------------|------------------|-----------------------------------------------------------------------|
| id            | UUID PK          |                                                                       |
| commentId     | FK               | → Comment                                                             |
| userId        | FK               | → User                                                                |
| qualityRating | Integer nullable | 1–5                                                                   |
| positiveFlags | JSON             |                                                                       |
| negativeFlags | JSON             |                                                                       |
| note          | Text nullable    |                                                                       |
| disputeStatus | Enum nullable    | NONE, AI_REVIEW, MODERATOR_REVIEW, SENIOR_REVIEW, PEER_JURY, RESOLVED |
| createdAt     | DateTime         |                                                                       |
| updatedAt     | DateTime         |                                                                       |

Constraint: UNIQUE(commentId, userId)

***

### Amendment

| Field             | Type          | Notes                                                       |
|-------------------|---------------|-------------------------------------------------------------|
| id                | UUID PK       |                                                             |
| ideaId            | FK            | → Idea                                                      |
| authorId          | FK            | → User                                                      |
| sectionChanged    | String        |                                                             |
| currentText       | Text          |                                                             |
| proposedText      | Text          |                                                             |
| rationale         | Text          | Required                                                    |
| researchUrls      | JSON nullable |                                                             |
| status            | Enum          | PENDING, REVISION_REQUESTED, CONSULTING, ACCEPTED, REJECTED |
| mode              | Enum nullable | MODE_A, MODE_B                                              |
| rejectionReason   | Text nullable |                                                             |
| revisionGuidance  | Text nullable |                                                             |
| isCounterProposal | Boolean       | Default false                                               |
| parentAmendmentId | FK nullable   | → Amendment                                                 |
| createdAt         | DateTime      |                                                             |
| updatedAt         | DateTime      |                                                             |

***

### AmendmentVote

| Field       | Type     | Notes                    |
|-------------|----------|--------------------------|
| id          | UUID PK  |                          |
| amendmentId | FK       | → Amendment              |
| userId      | FK       | → User                   |
| vote        | Enum     | SUPPORT, OPPOSE, ABSTAIN |
| castAt      | DateTime |                          |

Constraint: UNIQUE(amendmentId, userId)

***

### ConsultationVote

| Field       | Type     | Notes                       |
|-------------|----------|-----------------------------|
| id          | UUID PK  |                             |
| amendmentId | FK       | → Amendment                 |
| userId      | FK       | → User                      |
| response    | Enum     | SUPPORT, OPPOSE, NO_OPINION |
| castAt      | DateTime |                             |

Constraint: UNIQUE(amendmentId, userId)

***

### BroadcastMessage

| Field               | Type              | Notes                                 |
|---------------------|-------------------|---------------------------------------|
| id                  | UUID PK           |                                       |
| ideaId              | FK                | → Idea                                |
| sentByUserId        | FK                | → User                                |
| subject             | String            | Max 200 chars                         |
| content             | Text              | Max 500 words                         |
| recipientCount      | Integer           |                                       |
| requiresCoSignatory | Boolean           | Default false                         |
| coSignatoryUserId   | FK nullable       | → User                                |
| status              | Enum              | DRAFT, PENDING_COSIGN, SENT, RECALLED |
| sentAt              | DateTime nullable |                                       |

***

## SECTION 6 — ENDORSEMENTS {\#section-6}

### Endorsement

| Field                | Type              | Notes                                          |
|----------------------|-------------------|------------------------------------------------|
| id                   | UUID PK           |                                                |
| ideaId               | FK                | → Idea                                         |
| userId               | FK                | → User (must be parliamentary_verified = true) |
| endorserRole         | Enum              | MP, PEER                                       |
| endorserConstituency | String nullable   |                                                |
| endorserPeerage      | String nullable   |                                                |
| publicStatement      | Text nullable     |                                                |
| status               | Enum              | ACTIVE, WITHDRAWN                              |
| withdrawalReason     | Text nullable     |                                                |
| endorsedAt           | DateTime          |                                                |
| withdrawnAt          | DateTime nullable |                                                |

Constraint: UNIQUE(ideaId, userId) Note: Stage 4→5 gate requires ≥3 MP AND ≥3 Peer endorsements — separate counts.

***

### DraftsmanEndorsement

| Field                | Type              | Notes             |
|----------------------|-------------------|-------------------|
| id                   | UUID PK           |                   |
| ideaId               | FK                | → Idea            |
| draftsmanUserId      | FK nullable       | → User            |
| draftsmanName        | String nullable   |                   |
| organisation         | String nullable   |                   |
| publicStatement      | Text              | Required          |
| draftsmanCredentials | Text              |                   |
| qualifications       | Text nullable     |                   |
| statement            | Text nullable     |                   |
| status               | Enum              | ACTIVE, WITHDRAWN |
| certifiedAt          | DateTime          |                   |
| withdrawnAt          | DateTime nullable |                   |

***

## SECTION 7 — COLLABORATION {\#section-7}

### IdeaCollaborator

| Field           | Type              | Notes          |
|-----------------|-------------------|----------------|
| id              | UUID PK           |                |
| ideaId          | FK                | → Idea         |
| userId          | FK                | → User         |
| role            | Enum              | EDITOR, VIEWER |
| invitedByUserId | FK                | → User         |
| invitedAt       | DateTime          |                |
| acceptedAt      | DateTime nullable |                |

Constraint: UNIQUE(ideaId, userId)

***

### IdeaCollaboratorRole

| Field           | Type     | Notes  |
|-----------------|----------|--------|
| id              | UUID PK  |        |
| ideaId          | FK       | → Idea |
| roleName        | String   |        |
| permissions     | JSON     |        |
| createdByUserId | FK       | → User |
| createdAt       | DateTime |        |

***

### IdeaReview

| Field             | Type             | Notes                            |
|-------------------|------------------|----------------------------------|
| id                | UUID PK          |                                  |
| ideaId            | FK               | → Idea                           |
| userId            | FK               | → User                           |
| outcome           | Enum             | VIEWED, ENDORSED, BELOW_STANDARD |
| qualityRating     | Integer nullable | 1–5                              |
| timeOnPageSeconds | Integer nullable |                                  |
| createdAt         | DateTime         |                                  |

Constraint: UNIQUE(ideaId, userId)

***

### TeamMessage

| Field     | Type     | Notes  |
|-----------|----------|--------|
| id        | UUID PK  |        |
| ideaId    | FK       | → Idea |
| authorId  | FK       | → User |
| content   | Text     |        |
| createdAt | DateTime |        |
| updatedAt | DateTime |        |

***

### Group

| Field       | Type          | Notes                                       |
|-------------|---------------|---------------------------------------------|
| id          | UUID PK       |                                             |
| ownerId     | FK            | → User                                      |
| name        | String        |                                             |
| description | Text nullable |                                             |
| groupType   | Enum          | MY_TEAM, COMMUNICATIONS, POLICY_DEVELOPMENT |
| isPublic    | Boolean       | Default false                               |
| inviteCode  | String UNIQUE |                                             |
| memberCount | Integer       | Denormalised                                |
| createdAt   | DateTime      |                                             |
| updatedAt   | DateTime      |                                             |

***

### GroupMember

| Field    | Type     | Notes                |
|----------|----------|----------------------|
| id       | UUID PK  |                      |
| groupId  | FK       | → Group              |
| userId   | FK       | → User               |
| role     | Enum     | OWNER, ADMIN, MEMBER |
| joinedAt | DateTime |                      |

Constraint: UNIQUE(groupId, userId)

***

### GroupMessage

| Field     | Type     | Notes   |
|-----------|----------|---------|
| id        | UUID PK  |         |
| groupId   | FK       | → Group |
| authorId  | FK       | → User  |
| content   | Text     |         |
| createdAt | DateTime |         |
| updatedAt | DateTime |         |

***

### GroupInvite

| Field           | Type              | Notes                                   |
|-----------------|-------------------|-----------------------------------------|
| id              | UUID PK           |                                         |
| groupId         | FK                | → Group                                 |
| inviteCode      | String UNIQUE     |                                         |
| inviteType      | Enum              | PUBLIC_LINK, PRIVATE_EMAIL, BULK_UPLOAD |
| email           | String nullable   |                                         |
| maxUses         | Integer           | Default 1                               |
| usedCount       | Integer           | Default 0                               |
| expiresAt       | DateTime nullable |                                         |
| createdByUserId | FK                | → User                                  |
| createdAt       | DateTime          |                                         |

***

### UserInvite

| Field            | Type          | Notes                      |
|------------------|---------------|----------------------------|
| id               | UUID PK       |                            |
| invitedByUserId  | FK            | → User                     |
| email            | String        |                            |
| firstName        | String        |                            |
| lastName         | String        |                            |
| magicLinkToken   | String UNIQUE |                            |
| ideaId           | FK nullable   | → Idea                     |
| groupId          | FK nullable   | → Group                    |
| collaboratorRole | Enum nullable | EDITOR, VIEWER             |
| customMessage    | Text nullable |                            |
| status           | Enum          | PENDING, ACCEPTED, EXPIRED |
| expiresAt        | DateTime      |                            |
| createdAt        | DateTime      |                            |

***

### StageTransitionRequest

| Field             | Type              | Notes                      |
|-------------------|-------------------|----------------------------|
| id                | UUID PK           |                            |
| ideaId            | FK                | → Idea                     |
| requestedByUserId | FK                | → User                     |
| toStage           | Enum              |                            |
| groupId           | FK nullable       | → Group                    |
| status            | Enum              | PENDING, APPROVED, BLOCKED |
| reviewedByUserId  | FK nullable       | → User                     |
| reviewedAt        | DateTime nullable |                            |
| blockReason       | Text nullable     |                            |
| createdAt         | DateTime          |                            |

***

## SECTION 8 — REPUTATION & POINTS {\#section-8}

### Reputation

| Field                       | Type             | Notes                          |
|-----------------------------|------------------|--------------------------------|
| id                          | UUID PK          |                                |
| userId                      | FK UNIQUE        | → User                         |
| reputationPointsStrategist  | Integer          | Default 0                      |
| reputationPointsThinker     | Integer          | Default 0                      |
| reputationPointsRallymaster | Integer          | Default 0                      |
| reputationPointsRainmaker   | Integer          | Default 0                      |
| reputationPointsTeambuilder | Integer          | Default 0 — never "Dealweaver" |
| thanksReceived              | Integer          | Default 0                      |
| reputationRankScore         | Decimal nullable |                                |
| updatedAt                   | DateTime         |                                |

***

### PointsLedger

| Field           | Type              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                       |
|-----------------|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| id              | UUID PK           |                                                                                                                                                                                                                                                                                                                                                                                                                             |
| userId          | FK                | → User                                                                                                                                                                                                                                                                                                                                                                                                                      |
| category        | Enum              | STRATEGIST, THINKER, RALLYMASTER, RAINMAKER, TEAMBUILDER                                                                                                                                                                                                                                                                                                                                                                    |
| pointsDelta     | Integer           |                                                                                                                                                                                                                                                                                                                                                                                                                             |
| actionType      | String nullable   | Matches keys in points schedule — used for cap checking                                                                                                                                                                                                                                                                                                                                                                     |
| reason          | Enum              | IDEA_STARTED, STAGE_2_ADVANCE, STAGE_3_ADVANCE, STAGE_4_ADVANCE, STAGE_5_ADVANCE, DIAGNOSIS_COMPLETE, GUIDING_POLICY_COMPLETE, FIRST_COHERENT_ACTION, RESEARCH_ADDED, CONTRIBUTION_SUBMITTED, CONTRIBUTION_RATED_3, CONTRIBUTION_RATED_4, CONTRIBUTION_RATED_5, CONTRIBUTION_RATED_1_2, IDEA_RATED, IDEA_VOTED, AMENDMENT_ACCEPTED, REFERRAL_JOIN, REFERRAL_QUALIFIED, TEAMBUILDER_CASCADE, MERGE_COMPLETED, RED_TEAM_BONUS |
| triggerEntityId | String nullable   |                                                                                                                                                                                                                                                                                                                                                                                                                             |
| relatedIdeaId   | FK nullable       |                                                                                                                                                                                                                                                                                                                                                                                                                             |
| relatedUserId   | FK nullable       |                                                                                                                                                                                                                                                                                                                                                                                                                             |
| createdAt       | DateTime          |                                                                                                                                                                                                                                                                                                                                                                                                                             |
| reversedAt      | DateTime nullable |                                                                                                                                                                                                                                                                                                                                                                                                                             |

***

### CredibilityScore

| Field                    | Type             | Notes                                            |
|--------------------------|------------------|--------------------------------------------------|
| id                       | UUID PK          |                                                  |
| userId                   | FK UNIQUE        | → User                                           |
| rawScore                 | Integer          | Sum of all weighted inputs                       |
| normalisedScore          | Decimal nullable | Percentile (null until rawScore \>= 350)         |
| phase                    | Enum             | BUILDING (raw \< 350), ESTABLISHED (raw \>= 350) |
| thinkerComponent         | Decimal nullable |                                                  |
| strategistComponent      | Decimal nullable |                                                  |
| rallymasterComponent     | Decimal nullable |                                                  |
| rainmakerComponent       | Decimal nullable |                                                  |
| teambuilderComponent     | Decimal nullable |                                                  |
| accountAgeComponent      | Decimal nullable |                                                  |
| peerEndorsementComponent | Decimal nullable |                                                  |
| lexLogicScore            | Decimal nullable | Sprint 2                                         |
| lastCalculatedAt         | DateTime         |                                                  |

***

## SECTION 9 — REFERRAL & MERGE {\#section-9}

### ReferralEvent

| Field          | Type              | Notes                                                     |
|----------------|-------------------|-----------------------------------------------------------|
| id             | UUID PK           |                                                           |
| referrerUserId | FK                | → User                                                    |
| referredUserId | FK                | → User                                                    |
| referralCode   | String            |                                                           |
| registeredAt   | DateTime          |                                                           |
| qualifiedAt    | DateTime nullable | Set when referred user completes 3 actions within 30 days |
| actionCount    | Integer           | Default 0                                                 |
| pointsAwarded  | Boolean           | Default false                                             |

***

### MergedIdea

| Field               | Type              | Notes                                                  |
|---------------------|-------------------|--------------------------------------------------------|
| id                  | UUID PK           |                                                        |
| survivingIdeaId     | FK                | → Idea                                                 |
| absorbedIdeaId      | FK                | → Idea                                                 |
| survivingOwnerId    | FK                | → User                                                 |
| absorbedOwnerId     | FK                | → User                                                 |
| proposedByUserId    | FK                | → User                                                 |
| mergeType           | Enum              | MERGER, TAKEOVER                                       |
| status              | Enum              | PROPOSED, ACCEPTED, REJECTED, LAPSED, COUNTER_PROPOSED |
| proposalMessage     | Text              |                                                        |
| negotiationThreadId | FK nullable       | → MessageThread                                        |
| proposedAt          | DateTime          |                                                        |
| acceptedAt          | DateTime nullable |                                                        |
| createdAt           | DateTime          |                                                        |

***

## SECTION 10 — MESSAGING {\#section-10}

### MessageThread

| Field           | Type        | Notes                             |
|-----------------|-------------|-----------------------------------|
| id              | UUID PK     |                                   |
| threadType      | Enum        | DIRECT_MESSAGE, MERGE_NEGOTIATION |
| createdByUserId | FK          | → User                            |
| relatedIdeaId   | FK nullable |                                   |
| relatedMergeId  | FK nullable | → MergedIdea                      |
| createdAt       | DateTime    |                                   |

***

### Message

| Field     | Type              | Notes               |
|-----------|-------------------|---------------------|
| id        | UUID PK           |                     |
| threadId  | FK                | → MessageThread     |
| senderId  | FK                | → User              |
| content   | Text              | DOMPurify sanitised |
| readAt    | DateTime nullable |                     |
| createdAt | DateTime          |                     |

***

## SECTION 11 — MODERATION {\#section-11}

### ContentReport

| Field               | Type              | Notes                                                                            |
|---------------------|-------------------|----------------------------------------------------------------------------------|
| id                  | UUID PK           |                                                                                  |
| reporterUserId      | FK                | → User                                                                           |
| reportedContentType | Enum              | IDEA, COMMENT, AMENDMENT, USER                                                   |
| reportedCommentId   | FK nullable       | → Comment                                                                        |
| reportedIdeaId      | FK nullable       | → Idea                                                                           |
| reportedUserId      | FK nullable       | → User                                                                           |
| reportReason        | Enum              | SPAM, HARMFUL, OFF_TOPIC, MISINFORMATION, ABUSIVE, OTHER                         |
| description         | Text nullable     |                                                                                  |
| status              | Enum              | PENDING, UNDER_REVIEW, DISMISSED, ACTION_TAKEN                                   |
| reviewedByUserId    | FK nullable       | → User                                                                           |
| reviewedAt          | DateTime nullable |                                                                                  |
| moderationAction    | Enum nullable     | NONE, WARNING_SENT, CONTENT_HIDDEN, CONTENT_REMOVED, USER_SUSPENDED, USER_BANNED |
| moderatorNotes      | Text nullable     |                                                                                  |
| createdAt           | DateTime          |                                                                                  |

***

## SECTION 12 — GDPR & EMAIL {\#section-12}

### EmailSuppression

Check before EVERY email send without exception.

| Field        | Type          | Notes                                                 |
|--------------|---------------|-------------------------------------------------------|
| id           | UUID PK       |                                                       |
| email        | String UNIQUE |                                                       |
| reason       | Enum          | USER_UNSUBSCRIBED, ACCOUNT_DELETED, BOUNCE, COMPLAINT |
| suppressedAt | DateTime      |                                                       |

***

### UserParliamentaryVerification

| Field                | Type              | Notes                       |
|----------------------|-------------------|-----------------------------|
| id                   | UUID PK           |                             |
| userId               | FK                | → User                      |
| claimedRole          | Enum              | MP, PEER                    |
| constituency         | String nullable   |                             |
| peerageTitle         | String nullable   |                             |
| parliamentProfileUrl | String            |                             |
| status               | Enum              | PENDING, APPROVED, REJECTED |
| reviewedByUserId     | FK nullable       | → User                      |
| reviewedAt           | DateTime nullable |                             |
| createdAt            | DateTime          |                             |

***

### UserProfessionalVerification

| Field                   | Type              | Notes                       |
|-------------------------|-------------------|-----------------------------|
| id                      | UUID PK           |                             |
| userId                  | FK                | → User                      |
| firmOrChambers          | String            |                             |
| credentials             | String            |                             |
| licenceNumber           | String nullable   |                             |
| supportingDocumentR2Key | String            |                             |
| status                  | Enum              | PENDING, APPROVED, REJECTED |
| reviewedByUserId        | FK nullable       | → User                      |
| reviewedAt              | DateTime nullable |                             |
| createdAt               | DateTime          |                             |

***

## SECTION 13 — NOTIFICATIONS & ACTIVITY {\#section-13}

### Notification

| Field            | Type            | Notes                                                                                                                                                                   |
|------------------|-----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| id               | UUID PK         |                                                                                                                                                                         |
| userId           | FK              | → User                                                                                                                                                                  |
| notificationType | Enum            | VOTE_RECEIVED, STAGE_ELIGIBLE, COMMENT_POSTED, AMENDMENT_PROPOSED, ENDORSEMENT_GIVEN, MERGE_PROPOSED, MESSAGE_RECEIVED, OWNER_THANKS_RECEIVED, MODERATOR_INVITE, SYSTEM |
| relatedIdeaId    | FK nullable     |                                                                                                                                                                         |
| relatedUserId    | FK nullable     |                                                                                                                                                                         |
| title            | String nullable |                                                                                                                                                                         |
| message          | String          |                                                                                                                                                                         |
| linkUrl          | String nullable |                                                                                                                                                                         |
| deepLinkTab      | String nullable | For amendment notifications: "amendments"                                                                                                                               |
| isRead           | Boolean         | Default false                                                                                                                                                           |
| createdAt        | DateTime        |                                                                                                                                                                         |

***

### ActivityLog

| Field            | Type            | Notes                                                                                                                                                 |
|------------------|-----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| id               | UUID PK         |                                                                                                                                                       |
| userId           | FK              | → User                                                                                                                                                |
| activityType     | Enum            | IDEA_CREATED, IDEA_STAGE_CHANGED, VOTE_CAST, COMMENT_POSTED, AMENDMENT_PROPOSED, AMENDMENT_ACCEPTED, ENDORSEMENT_GIVEN, ACCOUNT_CREATED, ADMIN_ACTION |
| entityType       | String nullable |                                                                                                                                                       |
| entityId         | String nullable |                                                                                                                                                       |
| description      | String          |                                                                                                                                                       |
| metadata         | JSON nullable   |                                                                                                                                                       |
| accessType       | Enum nullable   | OWNER, COLLABORATOR, LEX_AI, SYSTEM, ADMIN_ACCESS                                                                                                     |
| accessReason     | String nullable | Required when accessType = ADMIN_ACCESS                                                                                                               |
| accessedByUserId | FK nullable     | → User                                                                                                                                                |
| createdAt        | DateTime        |                                                                                                                                                       |

***

## SECTION 14 — AI & TRACKING {\#section-14}

### AIUsageLog

| Field        | Type             | Notes                                   |
|--------------|------------------|-----------------------------------------|
| id           | UUID PK          |                                         |
| userId       | FK               | → User                                  |
| ideaId       | FK nullable      | → Idea                                  |
| provider     | Enum             | GEMINI_FLASH, GROK_FAST                 |
| model        | String           |                                         |
| inputTokens  | Integer          |                                         |
| outputTokens | Integer          |                                         |
| costAmount   | Decimal          |                                         |
| fieldTarget  | String nullable  |                                         |
| success      | Boolean          | Default true                            |
| durationMs   | Integer nullable |                                         |
| errorType    | String nullable  | timeout, rate_limit, api_error, network |
| fallbackUsed | Boolean          | Default false                           |
| createdAt    | DateTime         |                                         |

***

### AIConversation

| Field          | Type              | Notes     |
|----------------|-------------------|-----------|
| id             | UUID PK           |           |
| ideaId         | FK                | → Idea    |
| userId         | FK                | → User    |
| sessionStartAt | DateTime          |           |
| sessionEndAt   | DateTime nullable |           |
| messagesCount  | Integer           | Default 0 |
| totalTokens    | Integer           | Default 0 |
| totalCostUSD   | Decimal           | Default 0 |
| createdAt      | DateTime          |           |
| updatedAt      | DateTime          |           |

***

### LexFeedbackEvent

| Field               | Type        | Notes                                     |
|---------------------|-------------|-------------------------------------------|
| id                  | UUID PK     |                                           |
| userId              | FK          | → User                                    |
| ideaId              | FK nullable | → Idea                                    |
| conversationContext | Text        |                                           |
| userSnippet         | Text        |                                           |
| lexInterpretation   | Text        |                                           |
| sentiment           | Enum        | POSITIVE, NEGATIVE, FRUSTRATED, DELIGHTED |
| intensity           | Decimal     | 0.0 to 1.0                                |
| createdAt           | DateTime    |                                           |

***

## SECTION 15 — PLATFORM CONFIG {\#section-15}

### PlatformConfig

| Field           | Type      | Notes  |
|-----------------|-----------|--------|
| key             | String PK |        |
| value           | JSON      |        |
| updatedByUserId | FK        | → User |
| updatedAt       | DateTime  |        |

Default seed values: credibilityWeightingActive: false, peerReviewRequired: false, minReviewersForStage4: 12, minRatingForStage4: 2.5

***

## SECTION 16 — QUALITY METRICS {\#section-16}

### LegislativeQualityScore

| Field              | Type             | Notes  |
|--------------------|------------------|--------|
| id                 | UUID PK          |        |
| ideaId             | FK UNIQUE        | → Idea |
| rentonClarity      | Decimal nullable |        |
| fiscalNeutrality   | Decimal nullable |        |
| vestedInterestTest | Decimal nullable |        |
| enforceability     | Decimal nullable |        |
| logicalSoundness   | Decimal nullable |        |
| simplicity         | Decimal nullable |        |
| compositeScore     | Decimal nullable |        |
| lexNarrative       | Text nullable    |        |
| calculatedAt       | DateTime         |        |

***

## SECTION 17 — SOCIAL {\#section-17}

### OwnerThanks

| Field      | Type          | Notes     |
|------------|---------------|-----------|
| id         | UUID PK       |           |
| fromUserId | FK            | → User    |
| toUserId   | FK            | → User    |
| ideaId     | FK            | → Idea    |
| commentId  | FK nullable   | → Comment |
| message    | Text nullable |           |
| createdAt  | DateTime      |           |

***

### FeatureRequest

| Field             | Type          | Notes                                                |
|-------------------|---------------|------------------------------------------------------|
| id                | UUID PK       |                                                      |
| submittedByUserId | FK            | → User                                               |
| title             | String        |                                                      |
| description       | Text          |                                                      |
| status            | Enum          | CONSIDERING, PLANNED, IN_PROGRESS, SHIPPED, DECLINED |
| voteCount         | Integer       | Default 0                                            |
| adminNotes        | Text nullable |                                                      |
| createdAt         | DateTime      |                                                      |
| updatedAt         | DateTime      |                                                      |

***

### FeatureRequestVote

| Field            | Type     | Notes            |
|------------------|----------|------------------|
| id               | UUID PK  |                  |
| featureRequestId | FK       | → FeatureRequest |
| userId           | FK       | → User           |
| createdAt        | DateTime |                  |

Constraint: UNIQUE(featureRequestId, userId)

***

## SECTION 18 — JURISDICTION {\#section-18}

### JurisdictionType

| Field          | Type        | Notes                                                                                 |
|----------------|-------------|---------------------------------------------------------------------------------------|
| id             | UUID PK     |                                                                                       |
| name           | String      |                                                                                       |
| parentId       | FK nullable | → JurisdictionType                                                                    |
| category       | Enum        | NATIONAL, DEVOLVED, STATE, LOCAL, CIVIL_SERVICE, POLICE, QUANGO, INTERNATIONAL, OTHER |
| status         | Enum        | ACTIVE, PENDING_REVIEW                                                                |
| suggestedByLex | Boolean     | Default false                                                                         |
| createdAt      | DateTime    |                                                                                       |

***

## SECTION 19 — DEFERRED {\#section-19}

### Fundraise

Schema ready; implementation deferred to Sprint 2.

| Field           | Type            | Notes                        |
|-----------------|-----------------|------------------------------|
| id              | UUID PK         |                              |
| ideaId          | FK              | → Idea                       |
| userId          | FK              | → User                       |
| amountGBP       | Decimal         |                              |
| status          | Enum            | PENDING, COMPLETED, REFUNDED |
| stripePaymentId | String nullable |                              |
| createdAt       | DateTime        |                              |

***

### WhatsAppIntegration

Deferred to Sprint 2.

| Field              | Type            | Notes        |
|--------------------|-----------------|--------------|
| id                 | UUID PK         |              |
| groupId            | FK UNIQUE       | → Group      |
| whatsappGroupId    | String nullable |              |
| whatsappInviteLink | String nullable |              |
| syncEnabled        | Boolean         | Default true |
| createdAt          | DateTime        |              |
| updatedAt          | DateTime        |              |

***

## SECTION 20 — TRAINING {\#section-20}

### Training

| Field              | Type             | Notes                                       |
|--------------------|------------------|---------------------------------------------|
| id                 | UUID PK          |                                             |
| title              | String           |                                             |
| resourceType       | Enum             | VIDEO, ARTICLE, PODCAST                     |
| governmentCategory | String           |                                             |
| areaOfTraining     | String           |                                             |
| author             | String           |                                             |
| durationMinutes    | Integer nullable |                                             |
| url                | String           |                                             |
| rating             | Decimal nullable |                                             |
| stageTag           | Enum nullable    | CREATE, DRAFT, DEVELOP, CAMPAIGN, LEGISLATE |
| topicTag           | String nullable  |                                             |
| difficultyTag      | Enum nullable    | BEGINNER, INTERMEDIATE, ADVANCED            |
| isPublished        | Boolean          | Default false                               |
| createdAt          | DateTime         |                                             |
| updatedAt          | DateTime         |                                             |

***

## SECTION 21 — FOLLOWS & WATCHES {\#section-21}

### Follow

| Field          | Type        | Notes  |
|----------------|-------------|--------|
| id             | UUID PK     |        |
| followerId     | FK          | → User |
| followedUserId | FK nullable | → User |
| watchedIdeaId  | FK nullable | → Idea |
| createdAt      | DateTime    |        |

Constraint: UNIQUE(followerId, followedUserId), UNIQUE(followerId, watchedIdeaId)

***

## SECTION 22 — DISPUTED LOGIC FLAGS {\#section-22}

### DisputedLogicFlag

| Field        | Type          | Notes             |
|--------------|---------------|-------------------|
| id           | UUID PK       |                   |
| ideaId       | FK            | → Idea            |
| userId       | FK            | → User            |
| lexFlag      | Text          |                   |
| userDispute  | Text          |                   |
| status       | Enum          | PENDING, REVIEWED |
| adminVerdict | Text nullable |                   |
| createdAt    | DateTime      |                   |

***

## SECTION 23 — FIELD LABELS {\#section-23}

*This section defines the user-facing labels for all Strategic Kernel fields. Implemented in* `lib/field-labels.ts` *— a static lookup, zero DB changes, no migration required.*

*Rule: Section headings use the dual format (DB name — User label). Individual field labels in the UI use User label only.*

### Diagnosis

| DB field             | Section heading           | User label                 |
|----------------------|---------------------------|----------------------------|
| diagnosisTitle       | Diagnosis — The Challenge | The Challenge              |
| diagnosisDescription | —                         | Describe the Challenge     |
| obstacleDefined      | —                         | What's Blocking Progress   |
| whoAffected          | —                         | Who Is Affected            |
| howAffected          | —                         | How They're Affected       |
| whyPersisted         | —                         | Why Has This Gone Unsolved |
| impactDescription    | —                         | The Impact                 |
| impactCost           | —                         | The Cost of Inaction       |

### Root Cause

| DB field             | Section heading              | User label                     |
|----------------------|------------------------------|--------------------------------|
| rootCauseTitle       | Root Causes — Why It Happens | Root Cause                     |
| rootCauseDescription | —                            | Explain This Cause             |
| rootCauseLinkBack    | —                            | What Caused This Cause         |
| rootCauseLinkForward | —                            | What Does This Cause Lead To   |
| rootCauseMechanism   | —                            | How It Works                   |
| whyNotSolved         | —                            | Why Hasn't This Been Fixed     |
| incentiveDrivers     | —                            | Incentives Keeping It in Place |
| structureDrivers     | —                            | Structural Factors             |

### Guiding Policy

| DB field                            | Section heading                | User label                        |
|-------------------------------------|--------------------------------|-----------------------------------|
| guidingPolicyTitle                  | Guiding Policy — Your Approach | Your Approach                     |
| guidingPolicyDescription            | —                              | Describe Your Approach            |
| coreTheory                          | —                              | Your Theory of Change             |
| linkToDiagnosis                     | —                              | How This Addresses the Root Cause |
| whatThisPolicyRulesOut              | —                              | What We're Not Doing              |
| whyThisApproachNotOthers            | —                              | Why This Approach                 |
| conditionsForSuccess                | —                              | What Has to Be True               |
| mechanismTypes                      | —                              | Mechanism Types                   |
| tradeOffs                           | —                              | Trade-offs & Compromises          |
| competitiveIdeaAnalysis             | —                              | Competing Approaches              |

### Evidence

| DB field         | Section heading                  | User label                 |
|------------------|----------------------------------|----------------------------|
| comparablePolicy | Evidence — Real-World Precedents | Comparable Policy          |
| successFailure   | —                                | Did It Work                |
| whatWorked       | —                                | What Worked                |
| whatFailed       | —                                | What Failed                |
| resultCauses     | —                                | Why It Turned Out That Way |

### Coherent Action

| DB field                         | Section heading                          | User label                             |
|----------------------------------|------------------------------------------|----------------------------------------|
| title                            | Coherent Actions — What Is to Be Changed | Action Title                           |
| summarySnippet                   | —                                        | One-line Summary                       |
| detailedDescription              | —                                        | What This Does and Why                 |
| actionType                       | —                                        | Type of Change                         |
| legislationDraftWording          | —                                        | Draft Legislation Wording              |
| organisationalChangeDraftWording | —                                        | Organisational Change Wording          |
| costBenefitAnalysis              | —                                        | Cost-Benefit Summary                   |
| netCostOngoing                   | —                                        | Net Annual Cost (£)                    |
| netCostOneOff                    | —                                        | Net One-off Cost (£)                   |
| costFinancial                    | —                                        | Financial Cost of this Action          |
| costSocial                       | —                                        | Social Cost of this Action             |
| costOngoing                      | —                                        | Annual Ongoing Costs of this Action    |
| benefitFinancial                 | —                                        | Financial Benefits of this Action      |
| benefitSocial                    | —                                        | Social Benefits of this Action         |
| benefitOngoing                   | —                                        | Annual Ongoing Benefits of this Action |
| benefits                         | —                                        | Benefits (general)                     |
| practicalExecution               | —                                        | How This Action Is Carried Out         |
| implementationPlan               | —                                        | Implementation Plan                    |
| accountability                   | —                                        | Accountability                         |
| successMeasurement               | —                                        | How Success Is Measured                |
| keyRisks                         | —                                        | Key Risks                              |
| potentialHarm                    | —                                        | Potential Harms                        |
| keyChallenges                    | —                                        | Key Challenges                         |
| sourcesOfOpposition              | —                                        | Sources of Opposition                  |
| oppositionWho                    | —                                        | Who Will Oppose This                   |
| oppositionWhy                    | —                                        | Why They'll Oppose It                  |
| oppositionAnswers                | —                                        | Responses to Opposition                |

### Resources Committed

| DB field                      | Section heading                    | User label                       |
|-------------------------------|------------------------------------|----------------------------------|
| description                   | Resources — What You're Committing | Resource Description             |
| capitalCommitment             | —                                  | Capital Commitment               |
| annualCost                    | —                                  | Annual Cost                      |
| timeframe                     | —                                  | Timeframe                        |
| humanCapitalCommitted         | —                                  | Human Capital Committed          |
| humanCapitalAnnualRequirement | —                                  | Human Capital Annual Requirement |

### Idea core

| DB field            | User label           |
|---------------------|----------------------|
| title               | Idea Title           |
| summaryDescription  | Your Idea in Brief   |
| situationalAnalysis | Background & Context |
| targetLegislation   | Laws to Change       |
| targetOrganisation  | Who Must Act         |
| proposedWording     | Draft Legislation    |

***

*entity_list_v5.md — Scrutinise — 13 April 2026* *v5.0 — V2 field additions: GuidingPolicy Rumelt fields (linkToDiagnosis, whatThisPolicyRulesOut, whyThisApproachNotOthers, conditionsForSuccess); CoherentAction benefit mirrors (benefitFinancial, benefitSocial, benefitOngoing, netCostOngoing, netCostOneOff); ResourcesCommitted human capital (humanCapitalCommitted, humanCapitalAnnualRequirement); TargetOrganisation type changed from String to TargetOrganisationType enum; Section 23 field labels added; Contents page added.* *CCh-only: never edited directly by CC without explicit Charlie instruction.*
