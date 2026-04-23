# SCRUTINISE — ENTITY LIST v4
*Complete entity and field specification. Source of truth for Prisma schema generation.*
*v4.1: All pre-build review and prototype feedback changes applied. 22 March 2026.*
*CCh-only document — never edited directly by CC. Charlie approves all changes.*

---

## FIELD PRESERVATION RULE
**Never remove a field, entity, or section unless Charlie has explicitly instructed its deletion in the same conversation. "Tidying", "consolidating", and "simplifying" are not valid reasons to remove anything. When in doubt, keep it. This rule cannot be waived.**

---

## CONTENTS

User · PartyMembership · Idea · WordingHistory · StageTransition · Stage
Diagnosis · RootCause · GuidingPolicy · Evidence · CoherentAction · ResourcesCommitted
TargetLegislation · TargetOrganisation · Situation · ParliamentaryProgress
Research · Attachment
Vote · Comment · CommentRating · Amendment · AmendmentVote · ConsultationVote · BroadcastMessage
Endorsement · DraftsmanEndorsement
IdeaCollaborator · IdeaCollaboratorRole · IdeaReview · TeamMessage
Group · GroupMember · GroupMessage · GroupInvite · UserInvite · StageTransitionRequest
Reputation · PointsLedger · CredibilityScore
ReferralEvent · MergedIdea
MessageThread · Message
ContentReport
EmailSuppression · UserParliamentaryVerification · UserProfessionalVerification
Notification · ActivityLog
AIUsageLog · AIConversation
LexFeedbackEvent
PlatformConfig
LegislativeQualityScore
OwnerThanks
FeatureRequest · FeatureRequestVote
JurisdictionType
Fundraise · WhatsAppIntegration
Training
Follow
DisputedLogicFlag

---

## SECTION 1 — CORE

### User

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| clerkId | String UNIQUE | Clerk's user ID — join key between Clerk and our DB |
| name | String | Full name |
| firstName | String | |
| lastName | String | |
| displayName | String | What the user is called (defaults to "Boss" until set) |
| **preferredName** | String nullable | How the user wants Lex to address them. Defaults to firstName. Set during Clerk sign-up. |
| username | String UNIQUE | @handle, auto-generated from name, user can change once |
| email | String UNIQUE | |
| emailVerified | Boolean | Default false |
| mobile | String | Required for registration |
| mobileVerified | Boolean | Default false. Verified via SMS OTP. |
| bio | Text nullable | Rich text, public-facing |
| role | Enum | CITIZEN, MODERATOR, ADMIN, SUPER_ADMIN |
| expertType | String nullable | Free text professional credentials |
| **manualCredibilityOverride** | Decimal nullable | Set by SuperAdmin to establish a minimum credibility floor for Trust Seeds / Verified Experts. Displayed credibility = max(rawScore, manualCredibilityOverride). |
| politicalParty | String nullable | Legacy single-party field. Retained for backwards compatibility. New code should use PartyMembership entity. |
| partyMembership | String nullable | Legacy field. Retained. New code uses PartyMembership entity. |
| membershipNumber | String nullable | |
| memberSince | DateTime nullable | |
| address | Text nullable | |
| businessOrOrganisation | String nullable | |
| parliamentary_status | Enum nullable | MP, PEER, NONE |
| parliamentary_verified | Boolean | Default false |
| professional_verified | Boolean | Default false — for Parliamentary Draftsmen |
| aiCreditBalance | Decimal | Default 0 |
| aiUsageTotal | Decimal | Default 0 |
| aiPreferredStyle | String nullable | User's preferred Lex mode. Values: COLLABORATIVE (default), SOCRATIC, DIRECT. |
| **politicalSpectrumX** | Decimal nullable | Self-declared Left/Right position, -5.0 to +5.0. Private — used for cross-spectrum bonus calculations only. |
| **politicalSpectrumY** | Decimal nullable | Self-declared Nation State position, -5.0 to +5.0. Based on Goodhart Somewhere/Anywhere model. Private. |
| **ageConfirmed** | Boolean | Default false. Self-declaration of 18+ on sign-up. |
| **tcAgreedAt** | DateTime nullable | Timestamp of T&Cs agreement. |
| **rulesAgreedAt** | DateTime nullable | Timestamp of community rules agreement. |
| **tcVersion** | String nullable | Version of T&Cs agreed, e.g. "1.0". Allows detection of T&C updates. |
| donationsMadeTotal | Decimal | Default 0 |
| donationsMadeList | JSON nullable | Array of donation references |
| friendsWith | JSON nullable | Array of User IDs |
| referralCode | String UNIQUE | Cryptographically random, generated on account creation |
| referredByUserId | FK nullable | → User who referred this user |
| country | String nullable | ISO 3166-1 alpha-2. Default 'GB'. |
| joinDate | DateTime | User-facing join date |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| lastActiveAt | DateTime nullable | |
| status | Enum | ACTIVE, SUSPENDED, DELETION_PENDING, DELETED |

Relations: ideas[], votes[], comments[], endorsements[], reputation, credibilityScore, notifications[], messages[], groups[], ideaCollaborators[], partyMemberships[]

---

### PartyMembership

*New entity — replaces the legacy politicalParty and partyMembership String fields on User for multi-party support.*

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK | → User |
| partyName | String | Free text party name |
| membershipNumber | String nullable | |
| memberSince | DateTime nullable | |
| isPrimary | Boolean | Default false. Only one per user should be true. |
| createdAt | DateTime | |

---

### Idea

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| creatorId | FK | → User |
| **BASIC INFO** | | |
| title | String | Max 200 chars |
| summaryDescription | String | Max 280 chars — used on cards and snippets |
| summaryDiagnosis | Text nullable | Short summary of the diagnosis |
| summaryGuidingPolicy | Text nullable | Short summary of the guiding policy |
| summaryCoherentActions | Text nullable | Short summary of the coherent actions |
| ideaType | Enum | LEGISLATION, ORGANISATION |
| govtArea | String | Government area (housing, health, transport etc.) |
| govtLevel | Enum | LOCAL, DEVOLVED, NATIONAL, INTERNATIONAL |
| country | String nullable | ISO 3166-1 alpha-2. Default 'GB'. |
| connectedIdeaIds | JSON nullable | Array of related idea IDs |
| **STRATEGIC KERNEL** | | |
| diagnosis | Text nullable | Strategic kernel: what is the challenge (UI label: "What's the Challenge?") |
| guidingPolicy | Text nullable | Strategic kernel: the approach (UI label: "How Will We Solve It?") |
| rootCause | Text nullable | Strategic kernel: the underlying cause |
| **CLASSIFICATION** | | |
| stage | Enum | STAGE_1, STAGE_2, STAGE_3, STAGE_4, STAGE_5, ARCHIVED, WITHDRAWN |
| visibility | Enum | PRIVATE, LINK_ONLY, PLATFORM_LISTED |
| status | Enum | DRAFT, ACTIVE, ARCHIVED, MERGED, WITHDRAWN |
| sector | String nullable | |
| legalType | String nullable | |
| **JURISDICTION** | | |
| jurisdictionTypeId | FK nullable | → JurisdictionType (replaces govtLevel enum for fine-grained classification) |
| jurisdictionName | String nullable | e.g. "Scotland", "Metropolitan Police", "California" |
| **WORDING** | | |
| proposedWording | Text nullable | The actual proposed legislation text. Locked for direct edit once first vote received. |
| wordingLocked | Boolean | Default false. Set true on first vote received (Stage 4+). |
| version | Integer | Increments on every ProposedWording change. Default 1. |
| **METRICS** | | |
| voteCount | Integer | Denormalised total. Default 0. |
| passionScore | Decimal nullable | Average strength/certainty score across all non-withdrawn votes. |
| **credibilityWeightedRating** | Decimal nullable | Credibility-weighted quality rating. Calculated nightly when platformConfig.credibilityWeightingActive = true. Sprint 2. |
| voteDistribution | JSON nullable | {for: N, against: N, undecided: N, avgStrengthFor: X, avgStrengthAgainst: X, avgStrengthUndecided: X, strengthBuckets: [...]} |
| commentCount | Integer | Denormalised. Default 0. |
| amendmentCount | Integer | Denormalised. Default 0. |
| endorsementCount | Integer | Denormalised. Default 0. |
| viewCount | Integer | Denormalised. Default 0. |
| approvalRating | Decimal nullable | |
| votesSupport | Integer | Default 0 |
| votesOppose | Integer | Default 0 |
| votesAbstain | Integer | Default 0 |
| **MATURITY INDEX** | | |
| **maturityIndex** | Decimal | Default 0. 0–100. Campaign ready at 85. Populated Sprint 2. |
| **maturityIndexDetail** | JSON nullable | Component breakdown: {linguisticStability, complexitySpecificity, redTeamExhaustion, evidenceGrounding} |
| **maturityLastUpdated** | DateTime nullable | |
| **STAGE ELIGIBILITY** | | |
| eligibleForNextStage | Boolean | Set true when threshold crossed |
| stageEligibleSince | DateTime nullable | |
| voteTarget | Integer nullable | Owner-set motivational target (optional) |
| **VERSION CONTROL** | | |
| parentIdeaId | FK nullable | → Idea (if forked) |
| linkedIdeaIds | JSON nullable | |
| linkTypes | JSON nullable | |
| **TEAM** | | |
| teamClonedFromIdeaId | FK nullable | → Idea. Set when team was copied from another idea. |
| **SEARCH** | | |
| searchVector | Text nullable | Full-text search index |
| **GROUP ASSOCIATION** | | |
| groupId | FK nullable | → Group |
| **AI** | | |
| aiProvider | Enum | GEMINI_FLASH, GROK_FAST, USER_CLAUDE, USER_GPT4O, USER_GROK |
| aiChatHistory | JSON | Rolling last-20-messages array: [{role, content, timestamp}] |
| aiChatSummary | Text nullable | AI-generated compression of older history |
| aiCurrentField | String nullable | Which field Lex is currently working on |
| aiSessionCount | Integer | Total AI sessions on this idea. Default 0. |
| **REFERRAL** | | |
| referralLinkActive | Boolean | Default false. Set true on Stage 3. |
| **TIMESTAMPS** | | |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| publishedAt | DateTime nullable | |
| withdrawnAt | DateTime nullable | |

Relations: votes[], comments[], amendments[], endorsements[], research[], attachments[], collaborators[], stageTransitions[], wordingHistory[], targetLegislation[], targetOrganisations[], coherentActions[], evidence[], mergedIdeas[], situations[], rootCauses[], ideaReviews[]

---

### WordingHistory

Immutable audit trail of every change to ProposedWording.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| version | Integer | Which version number this record represents |
| wordingText | Text | Full text of ProposedWording at this version |
| changedByUserId | FK | → User |
| changeType | Enum | DIRECT_EDIT, AMENDMENT_ACCEPTED, OWNER_EDIT |
| amendmentId | FK nullable | → Amendment, if changeType is AMENDMENT_ACCEPTED |
| createdAt | DateTime | |

---

### StageTransition

Audit log of every stage change on every idea.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| fromStage | Enum | |
| toStage | Enum | |
| triggeredBy | String | "AUTOMATIC" or "OWNER" |
| triggeredByUserId | FK | → User |
| transitionReason | Text nullable | |
| voteCountAtTransition | Integer nullable | |
| approvalRatingAtTransition | Decimal nullable | |
| adminUserId | FK nullable | → User (admin who approved, if required) |
| notes | Text nullable | |
| createdAt | DateTime | |

---

### Stage

Standalone definition of each platform stage. Lookup/config entity.

| Field | Type | Notes |
|-------|------|-------|
| stageNumber | Integer PK | 1–5 |
| name | String | Create, Draft, Develop, Campaign, **Legislate** |
| description | Text | |
| requiredPermissions | JSON | |
| transitionCriteria | JSON | |
| availableActions | JSON | |

Note: Stage 5 display name is "Legislate" — never "Parliament".

---

## SECTION 2 — STRATEGIC KERNEL

### Diagnosis

What is the real challenge? (UI label: "What's the Challenge?")

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| diagnosisTitle | String nullable | |
| diagnosisDescription | Text nullable | |
| text | Text nullable | |
| obstacleDefined | Text nullable | |
| whoAffected | Text nullable | |
| howAffected | Text nullable | |
| whyPersisted | Text nullable | |
| impactDescription | Text nullable | |
| impactCost | Text nullable | |
| diagnosisData | JSON nullable | |
| version | Integer | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Relations: rootCauses[]

---

### RootCause

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| rootCauseTitle | String nullable | |
| rootCauseDescription | Text nullable | |
| text | Text nullable | |
| rootCauseLinkBack | Text nullable | |
| rootCauseLinkForward | Text nullable | |
| rootCauseMechanism | Text nullable | |
| whyNotSolved | Text nullable | |
| incentiveDrivers | Text nullable | |
| structureDrivers | Text nullable | |
| version | Integer | |
| createdAt | DateTime | |

---

### GuidingPolicy

The approach that deals with the challenge. (UI label: "How Will We Solve It?")

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| guidingPolicyTitle | String nullable | |
| guidingPolicyDescription | Text nullable | |
| text | Text nullable | |
| coreTheory | Text nullable | |
| mechanismIncentives | Text nullable | |
| mechanismRules | Text nullable | |
| mechanismTransparency | Text nullable | |
| mechanismMarketDesign | Text nullable | |
| mechanismInstitutionalRestructuring | Text nullable | |
| tradeOffs | Text nullable | |
| competitiveIdeaAnalysis | Text nullable | |
| version | Integer | |
| createdAt | DateTime | |

Relations: evidence[]

---

### Evidence

Supporting evidence for the diagnosis or guiding policy.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| title | String | |
| description | Text | |
| comparablePolicy | Text nullable | |
| successFailure | Enum nullable | SUCCESS, FAILURE, MIXED |
| whatWorked | Text nullable | |
| whatFailed | Text nullable | |
| resultCauses | Text nullable | |
| sourceUrl | String nullable | |
| sourceType | Enum | ACADEMIC, GOVERNMENT, NEWS, CASE_STUDY, LEGISLATION, OTHER |
| createdAt | DateTime | |

---

### CoherentAction

A practical step implementing the guiding policy. (UI label: "A Practical Step")

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| title | String | |
| summarySnippet | Text nullable | |
| detailedDescription | Text nullable | |
| actionType | String nullable | e.g. "Legislative", "Regulatory", "Structural" |
| legislationDraftWording | Text nullable | |
| organisationalChangeDraftWording | Text nullable | |
| proposedWording | Text nullable | |
| costBenefitAnalysis | Text nullable | |
| costFinancial | Text nullable | |
| costSocial | Text nullable | |
| costOngoing | Text nullable | |
| benefits | Text nullable | |
| practicalExecution | Text nullable | |
| implementationPlan | Text nullable | |
| **implementationSubQuestions** | JSON nullable | Structured: { who, what, where, how, why, when }. Lex populates progressively. |
| accountability | Text nullable | |
| successMeasurement | Text nullable | |
| keyRisks | Text nullable | |
| potentialHarm | Text nullable | |
| keyChallenges | Text nullable | |
| sourcesOfOpposition | Text nullable | |
| oppositionWho | Text nullable | |
| oppositionWhy | Text nullable | |
| oppositionAnswers | Text nullable | |
| orderIndex | Integer | |
| version | Integer | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Note: Votes on an idea auto-vote for all CoherentActions. Users can optionally vote for/against specific CoherentActions.

Relations: resourcesCommitted[]

---

### ResourcesCommitted

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| coherentActionId | FK | → CoherentAction |
| description | Text | |
| capitalCommitment | Decimal nullable | |
| annualCost | JSON nullable | |
| estimatedCost | Decimal nullable | |
| timeframe | String nullable | Default "10 years" |
| resourceType | Enum | FINANCIAL, HUMAN, INFRASTRUCTURE, LEGISLATIVE, OTHER |
| createdAt | DateTime | |

---

## SECTION 3 — LEGISLATION & ORGANISATION

### TargetLegislation

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| targetLegislationTitle | String | |
| targetLegislationYear | String | |
| targetLegislationUrl | String nullable | |
| legislationJurisdictionType | String nullable | |
| jurisdictionName | String nullable | |
| legalType | String nullable | |
| targetOrRelevant | Enum nullable | TARGET, RELEVANT |
| changeType | Enum | AMEND, REPEAL, NEW_ACT |
| wordingOfRevision | Text nullable | |
| draftNumber | String nullable | |
| draftHistory | JSON nullable | |
| relevantClauses | Text nullable | |
| relationshipType | String nullable | |
| summary | Text nullable | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### TargetOrganisation

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| targetOrganisationalTitle | String | |
| organisationType | String nullable | |
| description | Text nullable | |
| currentBehaviourDescription | Text nullable | |
| changeRequired | Text nullable | |
| howToBringAbout | Text nullable | |
| whoAccountable | Text nullable | |
| howResultsMeasured | Text nullable | |
| howChangeIncentivised | Text nullable | |
| problemsLikely | Text nullable | |
| mitigatingActions | Text nullable | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### Situation

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| title | String | |
| description | Text | |
| practicalEffect | Text nullable | |
| affectedPopulation | Integer nullable | |
| geographicScope | String nullable | |
| createdBy | FK | → User |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### ParliamentaryProgress

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK UNIQUE | → Idea |
| billNumber | String nullable | |
| committeeId | String nullable | |
| committeeName | String nullable | |
| committeeChair | String nullable | |
| nextReadingDate | DateTime nullable | |
| nextReadingTime | String nullable | |
| nextReadingType | String nullable | |
| submissionDeadline | DateTime nullable | |
| submissionEmail | String nullable | |
| submissionFormat | String nullable | |
| currentStage | Enum nullable | SUBMITTED, FIRST_READING, EVIDENCE_SESSION, SECOND_READING, COMMITTEE_STAGE, THIRD_READING, LORDS, ROYAL_ASSENT |
| progressStages | JSON | Array of {title, description, links[], status} |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

## SECTION 4 — RESEARCH

### Research

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| addedByUserId | FK | → User |
| linkedIdeas | JSON nullable | |
| researchType | Enum | **EVIDENCE, CASE_STUDY, CAUSES, PERSPECTIVES, OTHER** (changed from free String) |
| title | String | |
| snippet | Text | |
| relevanceExplanation | Text | |
| summaryOfContent | Text nullable | |
| summary | Text nullable | |
| link | String nullable | |
| sourceUrl | String | Validated via Google Safe Browsing |
| sourceType | Enum | ACADEMIC, GOVERNMENT, NEWS, CASE_STUDY, LEGISLATION, OTHER |
| forOrAgainstPolicy | Boolean nullable | |
| forOrAgainstAction | Boolean nullable | |
| forPolicy | Boolean nullable | |
| forAction | Boolean nullable | |
| constructiveScore | Integer nullable | |
| **retracted** | Boolean | Default false. Set true if Lex detects citation in retraction database. |
| **retractionUrl** | String nullable | Link to retraction notice if found. |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### Attachment

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK nullable | → Idea |
| researchId | FK nullable | → Research |
| uploadedByUserId | FK | → User |
| fileName | String | |
| fileType | Enum | PDF, IMAGE |
| fileSizeBytes | Integer | |
| r2ObjectKey | String | |
| r2Bucket | String | |
| virusScanStatus | Enum | PENDING, CLEAN, INFECTED |
| createdAt | DateTime | |

---

## SECTION 5 — IDEA MODIFICATIONS

### Vote

One vote per user per idea. Visible from Stage 4 only.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| userId | FK | → User |
| voteType | String nullable | Legacy |
| direction | Enum | FOR, AGAINST, UNDECIDED |
| strength | Decimal | 0.0 to 5.0 in 0.5 increments |
| voteWeight | Decimal nullable | |
| vote_weight | Decimal nullable | Legacy alias |
| rating | Integer nullable | |
| review | Text nullable | |
| qualityFlags | JSON nullable | ["doesnt_go_far_enough", "goes_too_far", "poorly_worded"] |
| ipAddress | String nullable | Raw IP — stored only transiently |
| ipAddressHash | String nullable | SHA-256 hash of IP only |
| isAnonymous | Boolean | Default false |
| anonymousToken | String nullable | |
| referralCode | String nullable | |
| referral_event_id | FK nullable | → ReferralEvent |
| ported_from_merge_id | FK nullable | → MergedIdea |
| ported_at | DateTime nullable | |
| pendingPort | Boolean | Default false |
| withdrawn | Boolean | Default false |
| castAt | DateTime | |
| updatedAt | DateTime | |

Constraint: UNIQUE(ideaId, userId)

---

### Comment

Flat contribution system. Owner-only replies. UI label: "Contribution" (not "Comment").

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| authorId | FK | → User |
| userId | FK | → User (alias) |
| parentId | FK nullable | → Comment. Only set when comment is owner reply. |
| **commentNumber** | Integer nullable | Sequential number per idea. Displayed as "#12" etc. |
| **groupedWithCommentId** | FK nullable | → Comment. Self-reference for grouping related contributions. |
| **groupLabel** | String nullable | User-defined group label, e.g. "Fiscal concerns" |
| stageNumber | Integer nullable | Stage at which contribution was made |
| content | Text | Rich text. DOMPurify sanitised. |
| **contributionType** | Enum nullable | NEW_INFORMATION, RED_TEAM_CHALLENGE, MINOR_ADJUSTMENT, ADDITIONAL_COHERENT_ACTION, AMENDMENT, OTHER |
| commentType | String nullable | Legacy |
| stance | Enum | SUPPORTIVE, CRITICAL, NEUTRAL, QUESTION |
| constructivenessScore | Integer nullable | |
| suggestedChanges | Boolean | Default false |
| suggestedChangeType | String nullable | |
| suggestedChangeField | String nullable | |
| suggestedChangeOldText | Text nullable | |
| suggestedChangeNewText | Text nullable | |
| attachedLegislationId | FK nullable | → TargetLegislation |
| attachedResearchId | FK nullable | → Research |
| isOwnerReply | Boolean | Default false |
| helpfulCount | Integer | Default 0 |
| notHelpfulCount | Integer | Default 0 |
| isHidden | Boolean | Default false |
| editHistory | JSON nullable | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### CommentRating

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| commentId | FK | → Comment |
| userId | FK | → User |
| positiveFlags | JSON | ["constructive", "insightful", "relevant", "fresh_perspective", "balanced", "helpful_facts", "direct_experience", "good_question"] |
| negativeFlags | JSON | ["ad_hominem", "straw_man", "red_herring", "false_dilemma", "slippery_slope", "moving_goalposts", "motte_bailey", "tu_quoque", "cherry_picking", "not_relevant"] |
| note | Text nullable | |
| disputeStatus | Enum nullable | NONE, AI_REVIEW, MODERATOR_REVIEW, SENIOR_REVIEW, PEER_JURY, RESOLVED |
| disputeRaisedByUserId | FK nullable | → User |
| disputeVerdict | Text nullable | |
| createdAt | DateTime | |

Constraint: UNIQUE(commentId, userId)

---

### Amendment

A proposed change to an idea's wording. Available at Stage 3+.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| originalIdeaId | FK | → Idea |
| amendedIdeaId | FK nullable | → Idea |
| authorId | FK | → User |
| proposedByUserId | FK | → User |
| stageNumber | Integer nullable | |
| sectionChanged | String | Which part of the idea |
| changesProposed | Text nullable | |
| currentText | Text | |
| proposedText | Text | |
| rationale | Text | Required |
| researchUrls | JSON nullable | |
| relevantLegislation | Text nullable | |
| status | Enum | PENDING, REVISION_REQUESTED, CONSULTING, ACCEPTED, REJECTED |
| amendmentStatus | String nullable | |
| amendmentHistory | JSON nullable | |
| mode | Enum nullable | MODE_A, MODE_B |
| rejectionReason | Text nullable | |
| revisionGuidance | Text nullable | Guidance sent to proposer when status=REVISION_REQUESTED |
| **isCounterProposal** | Boolean | Default false. True when this amendment is a counter to another. |
| **parentAmendmentId** | FK nullable | → Amendment. Set when isCounterProposal = true. |
| textDiff | Text nullable | |
| mergedAt | DateTime nullable | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### AmendmentVote

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| amendmentId | FK | → Amendment |
| userId | FK | → User |
| vote | Enum | SUPPORT, OPPOSE, ABSTAIN |
| castAt | DateTime | |

Constraint: UNIQUE(amendmentId, userId)

---

### ConsultationVote

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| amendmentId | FK | → Amendment |
| userId | FK | → User |
| response | Enum | SUPPORT, OPPOSE, NO_OPINION |
| castAt | DateTime | |

Constraint: UNIQUE(amendmentId, userId)

---

### BroadcastMessage

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| sentByUserId | FK | → User |
| subject | String | Max 200 chars |
| content | Text | Max 500 words |
| recipientCount | Integer | |
| requiresCoSignatory | Boolean | Default false |
| coSignatoryUserId | FK nullable | → User |
| coSignedAt | DateTime nullable | |
| status | Enum | DRAFT, PENDING_COSIGN, SENT, RECALLED |
| recalledAt | DateTime nullable | |
| recallReason | Text nullable | |
| sentAt | DateTime nullable | |

---

## SECTION 6 — ENDORSEMENTS

### Endorsement

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| userId | FK | → User (must be parliamentary_verified = true) |
| mpUserId | FK | → User (alias) |
| endorserRole | Enum | MP, PEER |
| endorserConstituency | String nullable | |
| endorserPeerage | String nullable | |
| displayTitle | String nullable | |
| endorsementType | String nullable | |
| publicStatement | Text nullable | |
| statement | Text nullable | Alias |
| officeContact | String nullable | |
| status | Enum | ACTIVE, WITHDRAWN |
| withdrawalReason | Text nullable | |
| endorsedAt | DateTime | |
| withdrawnAt | DateTime nullable | |

Constraint: UNIQUE(ideaId, userId)

Note: Stage 4→5 gate requires ≥3 MP endorsements AND ≥3 Peer endorsements — separate counts, not combined.

---

### DraftsmanEndorsement

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| draftsmanUserId | FK | → User (must be professional_verified = true) |
| publicStatement | Text | Required |
| draftsmanCredentials | Text | |
| status | Enum | ACTIVE, WITHDRAWN |
| certifiedAt | DateTime | |
| withdrawnAt | DateTime nullable | |

---

## SECTION 7 — COLLABORATION

### IdeaCollaborator

Users invited to work on an idea at Stage 2+.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| userId | FK | → User |
| role | Enum | EDITOR, VIEWER |
| roleId | FK nullable | → IdeaCollaboratorRole (Sprint 2 — replaces role Enum with flexible roles) |
| invitedByUserId | FK | → User |
| invitedAt | DateTime | |
| acceptedAt | DateTime nullable | |

Constraint: UNIQUE(ideaId, userId)

---

### IdeaCollaboratorRole

*New entity — Sprint 2. Flexible named roles replacing the binary EDITOR/VIEWER enum.*

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| roleName | String | e.g. "Co-Owner", "Rallymaster", "Researcher", "Credibility Builder", "Political Support" |
| permissions | JSON | Object describing what this role can do |
| createdByUserId | FK | → User |
| createdAt | DateTime | |

Default roles created on each new idea: Co-Owner, Admin, Rallymaster, Researcher, Credibility Builder, Political Support. All assigned to idea owner until changed.

---

### IdeaReview

*New entity — tracks when MPs, Peers, and Trust Seeds view or formally assess an idea.*

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| userId | FK | → User |
| outcome | Enum | VIEWED, ENDORSED, BELOW_STANDARD |
| timeOnPageSeconds | Integer nullable | |
| createdAt | DateTime | |

Constraint: UNIQUE(ideaId, userId)

Note: BELOW_STANDARD button shown only to MPs, Peers, and users with manualCredibilityOverride set. Used in Stage 3→4 gate calculation.

---

### TeamMessage

*New entity — group messaging scoped to an idea's team (distinct from Group messaging).*

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| authorId | FK | → User |
| content | Text | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### Group

A group for sharing ideas and messaging.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ownerId | FK | → User |
| name | String | |
| description | Text nullable | |
| groupType | Enum | **MY_TEAM, COMMUNICATIONS, POLICY_DEVELOPMENT** |
| visibility | String nullable | |
| isPublic | Boolean | Default false |
| inviteCode | String UNIQUE | |
| memberCount | Integer | Denormalised |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Note: groupType values changed: MY_TEAM (was COLLABORATORS), COMMUNICATIONS (was SUPPORTERS), POLICY_DEVELOPMENT (new). PUBLIC removed.

---

### GroupMember

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| groupId | FK | → Group |
| userId | FK | → User |
| role | Enum | OWNER, ADMIN, MEMBER |
| joinedAt | DateTime | |

Constraint: UNIQUE(groupId, userId)

---

### GroupMessage

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| groupId | FK | → Group |
| authorId | FK | → User |
| content | Text | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### GroupInvite

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| groupId | FK | → Group |
| inviteCode | String UNIQUE | |
| inviteType | Enum | PUBLIC_LINK, PRIVATE_EMAIL, BULK_UPLOAD |
| email | String nullable | |
| maxUses | Integer | Default 1 |
| usedCount | Integer | Default 0 |
| expiresAt | DateTime nullable | |
| createdByUserId | FK | → User |
| createdAt | DateTime | |

---

### UserInvite

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| invitedByUserId | FK | → User |
| email | String | |
| firstName | String | |
| lastName | String | |
| magicLinkToken | String UNIQUE | |
| ideaId | FK nullable | → Idea |
| groupId | FK nullable | → Group |
| collaboratorRole | Enum nullable | EDITOR, VIEWER |
| customMessage | Text nullable | |
| status | Enum | PENDING, ACCEPTED, EXPIRED |
| expiresAt | DateTime | |
| createdAt | DateTime | |

---

### StageTransitionRequest

*New entity — used when a Policy Development Group has stage-gate veto enabled.*

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| requestedByUserId | FK | → User |
| toStage | Enum | |
| groupId | FK nullable | → Group (the Policy Development Group with veto) |
| status | Enum | PENDING, APPROVED, BLOCKED |
| reviewedByUserId | FK nullable | → User (group admin who reviewed) |
| reviewedAt | DateTime nullable | |
| blockReason | Text nullable | |
| createdAt | DateTime | |

---

## SECTION 8 — REPUTATION & POINTS

### Reputation

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK UNIQUE | → User |
| reputationPointsCitizen | Integer | Default 0 |
| reputationPointsExpert | Integer | Default 0 |
| reputationPointsMP | Integer | Default 0 |
| reputationPointsHOL | Integer | Default 0 |
| reputationPointsStrategist | Integer | Default 0 |
| reputationPointsThinker | Integer | Default 0 |
| reputationPointsRallymaster | Integer | Default 0 |
| reputationPointsRainmaker | Integer | Default 0 |
| reputationPointsTeambuilder | Integer | Default 0 — canonical name, never "Dealweaver" |
| **thanksReceived** | Integer | Default 0. Incremented when an OwnerThanks record is created for this user. |
| reputationRankScore | Decimal nullable | |
| updatedAt | DateTime | |

---

### PointsLedger

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK | → User |
| category | Enum | STRATEGIST, THINKER, RALLYMASTER, RAINMAKER, TEAMBUILDER |
| pointsDelta | Integer | |
| reason | Enum | VOTE_RECEIVED, VOTE_REVERSED, COMMENT_RATED, AMENDMENT_ACCEPTED, REFERRAL_QUALIFIED, MERGE_COMPLETED, RED_TEAM_BONUS, etc. |
| triggerType | String nullable | |
| triggerEntityId | String nullable | |
| relatedIdeaId | FK nullable | |
| relatedUserId | FK nullable | |
| createdAt | DateTime | |
| reversedAt | DateTime nullable | |

---

### CredibilityScore

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK UNIQUE | → User |
| rawScore | Integer | Sum of all weighted inputs |
| normalisedScore | Decimal nullable | Percentile score (null until rawScore >= 350) |
| phase | Enum | BUILDING (raw < 350), ESTABLISHED (raw >= 350) |
| thinkerComponent | Decimal nullable | |
| strategistComponent | Decimal nullable | |
| rallymasterComponent | Decimal nullable | |
| rainmakerComponent | Decimal nullable | |
| teambuilderComponent | Decimal nullable | |
| accountAgeComponent | Decimal nullable | |
| peerEndorsementComponent | Decimal nullable | |
| **lexLogicScore** | Decimal nullable | Lex-assessed logical consistency score. Null until Sprint 2 scoring is built. |
| totalScore | Decimal nullable | |
| lastCalculatedAt | DateTime | |
| calculatedAt | DateTime | Alias |

---

## SECTION 9 — REFERRAL & MERGE

### ReferralEvent

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| referrerUserId | FK | → User |
| referredUserId | FK | → User |
| referralCode | String | |
| registeredAt | DateTime | |
| qualifiedAt | DateTime nullable | |
| actionCount | Integer | Default 0 |
| pointsAwarded | Boolean | Default false |

---

### MergedIdea

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| survivingIdeaId | FK | → Idea |
| absorbedIdeaId | FK | → Idea |
| survivingOwnerId | FK | → User |
| absorbedOwnerId | FK | → User |
| proposedByUserId | FK | → User |
| mergeType | Enum | MERGER, TAKEOVER |
| proposalType | String nullable | |
| status | Enum | PROPOSED, ACCEPTED, REJECTED, LAPSED, COUNTER_PROPOSED |
| proposalMessage | Text | |
| negotiationThreadId | FK nullable | → MessageThread |
| proposedAt | DateTime | |
| acceptedAt | DateTime nullable | |
| votesPortedCount | Integer | |
| rallymasterPointsAwarded | Integer nullable | |
| strategistPointsAwarded | Integer nullable | |
| pointsAwarded | Boolean | Default false |
| createdAt | DateTime | |

---

## SECTION 10 — MESSAGING

### MessageThread

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| threadType | Enum | DIRECT_MESSAGE, MERGE_NEGOTIATION |
| createdByUserId | FK | → User |
| relatedIdeaId | FK nullable | |
| relatedMergeId | FK nullable | → MergedIdea |
| createdAt | DateTime | |

---

### Message

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| threadId | FK | → MessageThread |
| senderId | FK | → User |
| content | Text | DOMPurify sanitised |
| readAt | DateTime nullable | |
| createdAt | DateTime | |

---

## SECTION 11 — MODERATION

### ContentReport

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| reporterUserId | FK | → User |
| reportedContentType | Enum | IDEA, COMMENT, AMENDMENT, USER |
| contentType | Enum | Alias |
| reportedCommentId | FK nullable | → Comment |
| reportedIdeaId | FK nullable | → Idea |
| reportedUserId | FK nullable | → User |
| contentId | String nullable | |
| reportReason | Enum | SPAM, HARMFUL, OFF_TOPIC, MISINFORMATION, ABUSIVE, OTHER |
| reason | Enum | Alias |
| description | Text nullable | |
| status | Enum | PENDING, UNDER_REVIEW, DISMISSED, ACTION_TAKEN |
| reviewedByUserId | FK nullable | → User |
| reviewedAt | DateTime nullable | |
| moderationAction | Enum nullable | NONE, WARNING_SENT, CONTENT_HIDDEN, CONTENT_REMOVED, USER_SUSPENDED, USER_BANNED |
| action | Enum nullable | Alias |
| moderatorNotes | Text nullable | |
| createdAt | DateTime | |

---

## SECTION 12 — GDPR & EMAIL

### EmailSuppression

Check before EVERY email send.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| email | String UNIQUE | |
| reason | Enum | USER_UNSUBSCRIBED, ACCOUNT_DELETED, BOUNCE, COMPLAINT |
| suppressedAt | DateTime | |

---

### UserParliamentaryVerification

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK | → User |
| claimedRole | Enum | MP, PEER |
| constituency | String nullable | |
| peerageTitle | String nullable | |
| parliamentProfileUrl | String | |
| status | Enum | PENDING, APPROVED, REJECTED |
| reviewedByUserId | FK nullable | → User |
| reviewedAt | DateTime nullable | |
| adminNotes | Text nullable | |
| createdAt | DateTime | |

---

### UserProfessionalVerification

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK | → User |
| firmOrChambers | String | |
| credentials | String | |
| licenceNumber | String nullable | |
| supportingDocumentR2Key | String | |
| status | Enum | PENDING, APPROVED, REJECTED |
| reviewedByUserId | FK nullable | → User |
| reviewedAt | DateTime nullable | |
| adminNotes | Text nullable | |
| createdAt | DateTime | |

---

## SECTION 13 — NOTIFICATIONS & ACTIVITY

### Notification

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK | → User |
| notificationType | Enum | VOTE_RECEIVED, STAGE_ELIGIBLE, COMMENT_POSTED, AMENDMENT_PROPOSED, ENDORSEMENT_GIVEN, MERGE_PROPOSED, MESSAGE_RECEIVED, OWNER_THANKS_RECEIVED, MODERATOR_INVITE, SYSTEM, etc. |
| type | Enum | Alias |
| relatedIdeaId | FK nullable | |
| relatedUserId | FK nullable | |
| title | String nullable | |
| message | String | |
| linkUrl | String nullable | |
| **deepLinkTab** | String nullable | For amendment notifications: "amendments". Routes click to specific tab. |
| actionUrl | String nullable | Alias |
| isRead | Boolean | Default false |
| read | Boolean | Alias |
| createdAt | DateTime | |

---

### ActivityLog

Immutable audit log of all significant platform events. Also used for the Privacy Log feature.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK | → User (the user who performed the action) |
| activityType | Enum | IDEA_CREATED, IDEA_STAGE_CHANGED, VOTE_CAST, VOTE_WITHDRAWN, COMMENT_POSTED, AMENDMENT_PROPOSED, AMENDMENT_ACCEPTED, ENDORSEMENT_GIVEN, MERGE_PROPOSED, ACCOUNT_CREATED, ADMIN_ACTION, etc. |
| entityType | String nullable | |
| entityId | String nullable | |
| description | String | |
| metadata | JSON nullable | |
| **accessType** | Enum nullable | OWNER, COLLABORATOR, LEX_AI, SYSTEM, ADMIN_ACCESS — for Privacy Log |
| **accessReason** | String nullable | Required when accessType = ADMIN_ACCESS |
| **accessedByUserId** | FK nullable | → User (the admin who accessed) — for Privacy Log |
| createdAt | DateTime | |

---

## SECTION 14 — AI & TRACKING

### AIUsageLog

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK | → User |
| ideaId | FK nullable | → Idea |
| provider | Enum | GEMINI_FLASH, GROK_FAST |
| model | String | |
| activityType | String nullable | |
| inputTokens | Integer | |
| outputTokens | Integer | |
| costAmount | Decimal | |
| fieldTarget | String nullable | |
| requestSummary | Text nullable | |
| createdAt | DateTime | |

---

### AIConversation

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| userId | FK | → User |
| conversationType | String nullable | |
| conversationData | JSON nullable | |
| sessionStartAt | DateTime | |
| sessionEndAt | DateTime nullable | |
| messagesCount | Integer | Default 0 |
| totalTokens | Integer | Default 0 |
| totalCostUSD | Decimal | Default 0 |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| completedAt | DateTime nullable | |

---

### LexFeedbackEvent

*New entity — emotional signal routing from Lex conversations to admin dashboard.*

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK | → User |
| ideaId | FK nullable | → Idea |
| conversationContext | Text | What was happening in the conversation |
| userSnippet | Text | The user's emotionally-charged text |
| lexInterpretation | Text | Lex's assessment of what went right or wrong |
| sentiment | Enum | POSITIVE, NEGATIVE, FRUSTRATED, DELIGHTED |
| intensity | Decimal | 0.0 to 1.0 |
| createdAt | DateTime | |

---

## SECTION 15 — PLATFORM CONFIG

### PlatformConfig

*New entity — key/value store for SuperAdmin-controlled feature flags and settings.*

| Field | Type | Notes |
|-------|------|-------|
| key | String PK | e.g. "credibilityWeightingActive", "peerReviewRequired", "minReviewersForStage4" |
| value | JSON | The config value |
| updatedByUserId | FK | → User |
| updatedAt | DateTime | |

Default seed values:
- credibilityWeightingActive: false
- peerReviewRequired: false
- minReviewersForStage4: 12
- minRatingForStage4: 2.5

---

## SECTION 16 — QUALITY METRICS

### LegislativeQualityScore

*New entity — Sprint 2. Six-pillar Legislative Quality Index. Owner dashboard only.*

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK UNIQUE | → Idea |
| rentonClarity | Decimal nullable | Can a 14-year-old understand who the law applies to? |
| fiscalNeutrality | Decimal nullable | Does it explain where money comes from? |
| vestedInterestTest | Decimal nullable | Does it create a moat for a specific industry? |
| enforceability | Decimal nullable | Clear mechanism without a new Quango? |
| logicalSoundness | Decimal nullable | Free from nirvana fallacy and motivated reasoning? |
| simplicity | Decimal nullable | Principles-based rather than regulation-heavy? |
| compositeScore | Decimal nullable | Weighted average of all pillars |
| lexNarrative | Text nullable | Lex's plain-English assessment |
| calculatedAt | DateTime | |

---

## SECTION 17 — SOCIAL

### OwnerThanks

*New entity — owner sends personal thank-you badge to a contributor.*

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| fromUserId | FK | → User (idea owner) |
| toUserId | FK | → User (contributor) |
| ideaId | FK | → Idea |
| commentId | FK nullable | → Comment (if for a specific contribution) |
| message | Text nullable | Optional personal note |
| createdAt | DateTime | |

---

### FeatureRequest

*New entity — user-submitted feature suggestions on the Training/FAQ page.*

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| submittedByUserId | FK | → User |
| title | String | |
| description | Text | |
| status | Enum | CONSIDERING, PLANNED, IN_PROGRESS, SHIPPED, DECLINED |
| voteCount | Integer | Default 0. Denormalised. |
| adminNotes | Text nullable | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### FeatureRequestVote

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| featureRequestId | FK | → FeatureRequest |
| userId | FK | → User |
| createdAt | DateTime | |

Constraint: UNIQUE(featureRequestId, userId)

---

## SECTION 18 — JURISDICTION

### JurisdictionType

*New entity — extensible classification of legislative jurisdiction. Lex can propose new entries; admin must approve.*

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| name | String | e.g. "UK National", "Scotland", "Metropolitan Police", "Civil Service Code" |
| parentId | FK nullable | → JurisdictionType (for nested hierarchies) |
| category | Enum | NATIONAL, DEVOLVED, STATE, LOCAL, CIVIL_SERVICE, POLICE, QUANGO, INTERNATIONAL, OTHER |
| status | Enum | ACTIVE, PENDING_REVIEW |
| suggestedByLex | Boolean | Default false. True when Lex proposes a new type. |
| createdAt | DateTime | |

---

## SECTION 19 — DEFERRED

### Fundraise

Schema ready; implementation deferred to Sprint 2.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| userId | FK | → User |
| amountGBP | Decimal | |
| status | Enum | PENDING, COMPLETED, REFUNDED |
| stripePaymentId | String nullable | |
| createdAt | DateTime | |

---

### WhatsAppIntegration

Deferred to Sprint 2.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| groupId | FK UNIQUE | → Group |
| whatsappGroupId | String nullable | |
| whatsappInviteLink | String nullable | |
| syncEnabled | Boolean | Default true |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

## SECTION 20 — TRAINING

### Training

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| title | String | |
| resourceType | Enum | VIDEO, ARTICLE, PODCAST |
| governmentCategory | String | |
| areaOfTraining | String | |
| author | String | |
| durationMinutes | Integer nullable | |
| url | String | |
| rating | Decimal nullable | |
| stageTag | Enum nullable | CREATE, DRAFT, DEVELOP, CAMPAIGN, **LEGISLATE** |
| topicTag | String nullable | |
| difficultyTag | Enum nullable | BEGINNER, INTERMEDIATE, ADVANCED |
| isPublished | Boolean | Default false |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Note: stageTag enum value updated from PARLIAMENT to LEGISLATE.

---

## SECTION 21 — FOLLOWS & WATCHES

### Follow

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| followerId | FK | → User |
| followedUserId | FK nullable | → User |
| watchedIdeaId | FK nullable | → Idea |
| createdAt | DateTime | |

Constraint: UNIQUE(followerId, followedUserId) where followedUserId not null
Constraint: UNIQUE(followerId, watchedIdeaId) where watchedIdeaId not null

---

## SECTION 22 — DISPUTED LOGIC FLAGS

### DisputedLogicFlag

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| userId | FK | → User |
| lexFlag | Text | |
| userDispute | Text | |
| status | Enum | PENDING, REVIEWED |
| adminVerdict | Text nullable | |
| createdAt | DateTime | |

---

*entity_list_v4.md — Scrutinise — 22 March 2026*
*v4.1 — updated from pre-build review and prototype feedback sessions.*
*Total entities: 68 (v4's 54 + PartyMembership, IdeaCollaboratorRole, IdeaReview, TeamMessage, StageTransitionRequest, LexFeedbackEvent, PlatformConfig, LegislativeQualityScore, OwnerThanks, FeatureRequest, FeatureRequestVote, JurisdictionType, GeneratedOutput pending Sprint 2)*
*Source of truth for Prisma schema generation.*
*CCh-only: never edited directly by CC without explicit Charlie instruction.*
