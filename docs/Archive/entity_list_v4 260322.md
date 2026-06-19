# SCRUTINISE — ENTITY LIST v4
*Complete entity and field specification. Source of truth for Prisma schema generation.*
*v4: Full restoration from source .docx + intentional v3 design decisions preserved.*
*CCh-only document — never edited directly by CC. Charlie approves all changes.*
*Last updated: March 2026*

---

## FIELD PRESERVATION RULE
**Never remove a field, entity, or section unless Charlie has explicitly instructed its deletion in the same conversation. "Tidying", "consolidating", and "simplifying" are not valid reasons to remove anything. When in doubt, keep it. This rule cannot be waived.**

---

## CONTENTS

User · Idea · WordingHistory · StageTransition · Stage
Diagnosis · RootCause · GuidingPolicy · Evidence · CoherentAction · ResourcesCommitted
TargetLegislation · TargetOrganisation · Situation · ParliamentaryProgress
Research · Attachment
Vote · Comment · CommentRating · Amendment · AmendmentVote · ConsultationVote · BroadcastMessage
Endorsement · DraftsmanEndorsement
IdeaCollaborator · Group · GroupMember · GroupMessage · GroupInvite · UserInvite
Reputation · PointsLedger · CredibilityScore
ReferralEvent · MergedIdea
MessageThread · Message
ContentReport
EmailSuppression · UserParliamentaryVerification · UserProfessionalVerification
Notification · ActivityLog
AIUsageLog · AIConversation
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
| username | String UNIQUE | @handle, auto-generated from name, user can change once |
| email | String UNIQUE | |
| emailVerified | Boolean | Default false |
| mobile | String | Required for registration |
| mobileVerified | Boolean | Default false. Verified via SMS OTP. |
| bio | Text nullable | Rich text, public-facing |
| role | Enum | CITIZEN, MODERATOR, ADMIN, SUPER_ADMIN |
| expertType | String nullable | Free text professional credentials |
| politicalParty | String nullable | |
| partyMembership | String nullable | |
| membershipNumber | String nullable | |
| memberSince | DateTime nullable | |
| address | Text nullable | |
| businessOrOrganisation | String nullable | |
| parliamentary_status | Enum nullable | MP, PEER, NONE |
| parliamentary_verified | Boolean | Default false |
| professional_verified | Boolean | Default false — for Parliamentary Draftsmen |
| aiCreditBalance | Decimal | Default 0 |
| aiUsageTotal | Decimal | Default 0 |
| aiPreferredStyle | String nullable | User's preferred Lex interaction style |
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

Relations: ideas[], votes[], comments[], endorsements[], reputation, credibilityScore, notifications[], messages[], groups[], ideaCollaborators[]

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
| diagnosis | Text nullable | Strategic kernel: what is the real problem |
| guidingPolicy | Text nullable | Strategic kernel: the approach |
| rootCause | Text nullable | Strategic kernel: the underlying cause |
| **CLASSIFICATION** | | |
| stage | Enum | STAGE_1, STAGE_2, STAGE_3, STAGE_4, STAGE_5, ARCHIVED, WITHDRAWN |
| visibility | Enum | PRIVATE, LINK_ONLY, PLATFORM_LISTED |
| status | Enum | DRAFT, ACTIVE, ARCHIVED, MERGED, WITHDRAWN |
| sector | String nullable | |
| legalType | String nullable | |
| **WORDING** | | |
| proposedWording | Text nullable | The actual proposed legislation text. Locked for direct edit once first vote received. |
| wordingLocked | Boolean | Default false. Set true on first vote received. |
| version | Integer | Increments on every ProposedWording change. Default 1. |
| **METRICS** | | |
| voteCount | Integer | Denormalised total. Default 0. |
| passionScore | Decimal nullable | Average strength/certainty score across all non-withdrawn votes. |
| voteDistribution | JSON nullable | {for: N, against: N, undecided: N, avgStrengthFor: X, avgStrengthAgainst: X, avgStrengthUndecided: X, strengthBuckets: [...]} |
| commentCount | Integer | Denormalised. Default 0. |
| amendmentCount | Integer | Denormalised. Default 0. |
| endorsementCount | Integer | Denormalised. Default 0. |
| viewCount | Integer | Denormalised. Default 0. |
| approvalRating | Decimal nullable | |
| votesSupport | Integer | Default 0 |
| votesOppose | Integer | Default 0 |
| votesAbstain | Integer | Default 0 |
| **STAGE ELIGIBILITY** | | |
| eligibleForNextStage | Boolean | Set true when threshold crossed |
| stageEligibleSince | DateTime nullable | |
| voteTarget | Integer nullable | Owner-set motivational target (optional) |
| **VERSION CONTROL** | | |
| parentIdeaId | FK nullable | → Idea (if forked) |
| linkedIdeaIds | JSON nullable | |
| linkTypes | JSON nullable | |
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

Relations: votes[], comments[], amendments[], endorsements[], research[], attachments[], collaborators[], stageTransitions[], wordingHistory[], targetLegislation[], targetOrganisations[], coherentActions[], evidence[], mergedIdeas[], situations[], rootCauses[]

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
| idea | Relation | → Idea |
| fromStage | Enum | |
| toStage | Enum | |
| triggeredBy | String | |
| triggeredByUserId | FK | → User (owner who triggered) |
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
| name | String | e.g. "Create", "Draft", "Develop", "Campaign", "Parliament" |
| description | Text | |
| requiredPermissions | JSON | What roles/verifications are needed |
| transitionCriteria | JSON | Gate criteria for moving to next stage |
| availableActions | JSON | What actions are available at this stage |

---

## SECTION 2 — STRATEGIC KERNEL

The Strategic Kernel is the analytical backbone of every idea. Based on Rumelt's Good Strategy / Bad Strategy framework.

**Phase 1 (Basic Info):** title, summaryDescription, summaryDiagnosis, summaryGuidingPolicy, summaryCoherentActions, govtArea, ideaType, connectedIdeas — collected on the Create screen before Lex engagement.

**Phase 2 (Strategic Kernel):** All sub-entities below. When AI is enabled, Lex populates these fields progressively through Socratic dialogue. When AI is disabled, all fields are displayed as plain text inputs.

---

### Diagnosis

What is the real problem? The pivotal constraint — not a list of symptoms.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| diagnosisTitle | String nullable | |
| diagnosisDescription | Text nullable | Full diagnosis narrative |
| text | Text nullable | Legacy/short form diagnosis statement |
| obstacleDefined | Text nullable | What is the specific obstacle |
| whoAffected | Text nullable | |
| howAffected | Text nullable | |
| whyPersisted | Text nullable | Why has this problem not been solved already |
| impactDescription | Text nullable | |
| impactCost | Text nullable | Estimated cost of problem persisting |
| diagnosisData | JSON nullable | Supporting data points (multiple) |
| version | Integer | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Relations: rootCauses[]

---

### RootCause

The underlying cause behind the diagnosis. Multiple root causes possible per idea.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| rootCauseTitle | String nullable | |
| rootCauseDescription | Text nullable | |
| text | Text nullable | Legacy/short form |
| rootCauseLinkBack | Text nullable | What historical or structural factor created this cause |
| rootCauseLinkForward | Text nullable | How this cause produces the problem |
| rootCauseMechanism | Text nullable | The mechanism by which it operates |
| whyNotSolved | Text nullable | Why existing attempts haven't resolved it |
| incentiveDrivers | Text nullable | Incentives that perpetuate the problem |
| structureDrivers | Text nullable | Structural factors that perpetuate the problem |
| version | Integer | |
| createdAt | DateTime | |

---

### GuidingPolicy

The approach that deals with the diagnosis. Not a goal — a method.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| guidingPolicyTitle | String nullable | |
| guidingPolicyDescription | Text nullable | |
| text | Text nullable | Legacy/short form |
| coreTheory | Text nullable | The theory of change |
| mechanismIncentives | Text nullable | What incentives will address the root cause |
| mechanismRules | Text nullable | |
| mechanismTransparency | Text nullable | |
| mechanismMarketDesign | Text nullable | |
| mechanismInstitutionalRestructuring | Text nullable | |
| tradeOffs | Text nullable | Acknowledged trade-offs of this approach |
| competitiveIdeaAnalysis | Text nullable | How this compares to alternative approaches |
| version | Integer | |
| createdAt | DateTime | |

Relations: evidence[]

---

### Evidence

Supporting evidence for the diagnosis or guiding policy. Also tracks comparable policy outcomes.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| title | String | |
| description | Text | |
| comparablePolicy | Text nullable | A comparable policy that has been tried elsewhere |
| successFailure | Enum nullable | SUCCESS, FAILURE, MIXED |
| whatWorked | Text nullable | |
| whatFailed | Text nullable | |
| resultCauses | Text nullable | Why it succeeded or failed |
| sourceUrl | String nullable | Validated via Google Safe Browsing |
| sourceType | Enum | ACADEMIC, GOVERNMENT, NEWS, CASE_STUDY, LEGISLATION, OTHER |
| createdAt | DateTime | |

---

### CoherentAction

A specific coordinated step implementing the guiding policy. An idea may have multiple.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| idea | Relation | → Idea |
| title | String | |
| summarySnippet | Text nullable | Short summary for display on cards |
| detailedDescription | Text nullable | Full description, linking back to diagnosis and policy |
| actionType | String nullable | e.g. "Legislative", "Regulatory", "Structural" |
| legislationDraftWording | Text nullable | Draft wording if action requires legislation |
| organisationalChangeDraftWording | Text nullable | Draft wording if action requires organisational change |
| proposedWording | Text nullable | The specific legislative clause for this action |
| costBenefitAnalysis | Text nullable | |
| costFinancial | Text nullable | |
| costSocial | Text nullable | |
| costOngoing | Text nullable | |
| benefits | Text nullable | |
| practicalExecution | Text nullable | How this will actually be implemented |
| implementationPlan | Text nullable | |
| accountability | Text nullable | Who is responsible and how |
| successMeasurement | Text nullable | How success will be measured |
| keyRisks | Text nullable | |
| potentialHarm | Text nullable | |
| keyChallenges | Text nullable | |
| sourcesOfOpposition | Text nullable | |
| oppositionWho | Text nullable | |
| oppositionWhy | Text nullable | |
| oppositionAnswers | Text nullable | |
| orderIndex | Integer | Display order |
| version | Integer | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Note: Votes on an idea auto-vote for all CoherentActions. Users can optionally vote for/against specific CoherentActions within an idea.

Relations: resourcesCommitted[]

---

### ResourcesCommitted

Resources, costs, and implementation requirements attached to a specific CoherentAction.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| coherentActionId | FK | → CoherentAction |
| description | Text | |
| capitalCommitment | Decimal nullable | One-off capital cost |
| annualCost | JSON nullable | Year-by-year breakdown, up to 50 years |
| estimatedCost | Decimal nullable | Summary estimated cost |
| timeframe | String nullable | Default "10 years" |
| resourceType | Enum | FINANCIAL, HUMAN, INFRASTRUCTURE, LEGISLATIVE, OTHER |
| createdAt | DateTime | |

---

## SECTION 3 — LEGISLATION & ORGANISATION

### TargetLegislation

Specific legislation the idea aims to change, repeal, or create.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| idea | Relation | → Idea |
| targetLegislationTitle | String | e.g. "Housing Act 1988" |
| targetLegislationYear | String | e.g. "1988" |
| targetLegislationUrl | String nullable | Link to legislation.gov.uk |
| legislationJurisdictionType | String nullable | e.g. "Primary", "Secondary" |
| jurisdictionName | String nullable | e.g. "England and Wales" |
| legalType | String nullable | e.g. "Act", "Statutory Instrument" |
| targetOrRelevant | Enum nullable | TARGET, RELEVANT |
| changeType | Enum | AMEND, REPEAL, NEW_ACT |
| wordingOfRevision | Text nullable | Proposed revision wording |
| draftNumber | String nullable | |
| draftHistory | JSON nullable | Array of previous draft versions |
| relevantClauses | Text nullable | Which specific sections are affected |
| relationshipType | String nullable | How this legislation relates to the idea |
| summary | Text nullable | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### TargetOrganisation

For ORGANISATION type ideas — the body to be created, changed, or abolished.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| idea | Relation | → Idea |
| targetOrganisationalTitle | String | |
| organisationType | String nullable | e.g. "Regulatory Body", "Public Service" |
| description | Text nullable | |
| currentBehaviourDescription | Text nullable | What the organisation currently does |
| changeRequired | Text nullable | What needs to change |
| howToBringAbout | Text nullable | Mechanism for achieving the change |
| whoAccountable | Text nullable | Who is responsible for delivering the change |
| howResultsMeasured | Text nullable | |
| howChangeIncentivised | Text nullable | |
| problemsLikely | Text nullable | Anticipated obstacles |
| mitigatingActions | Text nullable | How obstacles will be addressed |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### Situation

Context and background information about the current state of affairs.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| idea | Relation | → Idea |
| title | String | |
| description | Text | |
| practicalEffect | Text nullable | The practical effect of this situation |
| affectedPopulation | Integer nullable | Estimated number of people affected |
| geographicScope | String nullable | |
| createdBy | FK | → User |
| creator | Relation | → User |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### ParliamentaryProgress

Tracks the idea's progress through the actual parliamentary process (Stage 5+).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK UNIQUE | → Idea (one record per idea) |
| idea | Relation | → Idea |
| billNumber | String nullable | e.g. "HC-2026-047" |
| committeeId | String nullable | |
| committeeName | String nullable | e.g. "Housing, Communities & Local Government" |
| committeeChair | String nullable | |
| nextReadingDate | DateTime nullable | |
| nextReadingTime | String nullable | |
| nextReadingType | String nullable | e.g. "First Reading", "Evidence Session" |
| submissionDeadline | DateTime nullable | |
| submissionEmail | String nullable | |
| submissionFormat | String nullable | |
| currentStage | Enum nullable | SUBMITTED, FIRST_READING, EVIDENCE_SESSION, SECOND_READING, COMMITTEE_STAGE, THIRD_READING, LORDS, ROYAL_ASSENT |
| progressStages | JSON | Array of {title, description, links[], status} — owner-maintained |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

## SECTION 4 — RESEARCH

### Research

Supporting research records attached to an idea.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| idea | Relation | → Idea |
| addedByUserId | FK | → User |
| contributor | Relation | → User |
| linkedIdeas | JSON nullable | Array of related idea IDs |
| researchType | String nullable | e.g. "Academic", "Policy", "News" |
| title | String | |
| snippet | Text | Short excerpt or key finding |
| relevanceExplanation | Text | Why this is relevant |
| summaryOfContent | Text nullable | Summary of the full source |
| summary | Text nullable | |
| link | String nullable | Direct link to source |
| sourceUrl | String | Validated via Google Safe Browsing |
| sourceType | Enum | ACADEMIC, GOVERNMENT, NEWS, CASE_STUDY, LEGISLATION, OTHER |
| forOrAgainstPolicy | Boolean nullable | Does this support or contradict the policy direction |
| forOrAgainstAction | Boolean nullable | Does this support or contradict the proposed action |
| forPolicy | Boolean nullable | |
| forAction | Boolean nullable | |
| constructiveScore | Integer nullable | 1–5 self-assessed quality rating |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### Attachment

Uploaded files (PDFs, images) attached to an idea or research record.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK nullable | → Idea |
| researchId | FK nullable | → Research |
| uploadedByUserId | FK | → User |
| fileName | String | Original filename |
| fileType | Enum | PDF, IMAGE |
| fileSizeBytes | Integer | |
| r2ObjectKey | String | Key in Cloudflare R2 bucket |
| r2Bucket | String | Which bucket |
| virusScanStatus | Enum | PENDING, CLEAN, INFECTED |
| createdAt | DateTime | |

---

## SECTION 5 — IDEA MODIFICATIONS

### Vote

One vote per user per idea. Direction (FOR/AGAINST/UNDECIDED) plus strength slider (0–5 in 0.5 increments).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| idea | Relation | → Idea |
| userId | FK | → User. Email verification required before voting. |
| user | Relation | → User |
| voteType | String nullable | Legacy field |
| direction | Enum | FOR, AGAINST, UNDECIDED |
| strength | Decimal | 0.0 to 5.0 in 0.5 increments |
| voteWeight | Decimal nullable | |
| vote_weight | Decimal nullable | Legacy alias |
| rating | Integer nullable | |
| review | Text nullable | |
| qualityFlags | JSON nullable | Array: ["doesnt_go_far_enough", "goes_too_far", "poorly_worded"] |
| ipAddress | String nullable | Raw IP — stored only transiently |
| ipAddressHash | String nullable | SHA-256 hash of IP only |
| isAnonymous | Boolean | Default false |
| anonymousToken | String nullable | |
| referralCode | String nullable | Referral code active when vote was cast |
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

Flat comment system. Owner-only replies (no user-to-user threading).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| idea | Relation | → Idea |
| authorId | FK | → User |
| author | Relation | → User |
| userId | FK | → User (alias) |
| parentId | FK nullable | → Comment. Only set when comment is owner reply. |
| parent | Relation | → Comment |
| stageNumber | Integer nullable | Which stage the comment was made at |
| content | Text | Rich text. DOMPurify sanitised before storing. |
| commentType | String nullable | e.g. "general", "amendment_suggestion", "question" |
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
| helpfulCount | Integer | Denormalised. Default 0. |
| notHelpfulCount | Integer | Denormalised. Default 0. |
| isHidden | Boolean | Default false. Set by moderator. |
| editHistory | JSON nullable | Array of previous versions |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### CommentRating

Two-column popup rating widget on a comment. Left column = "Constructive" (positive contributions). Right column = "Unhelpful" (logical fallacies and quality failures). User can tick multiple boxes on both sides simultaneously. Each negative flag has an "i" tooltip with a brief definition, linking to the FAQ for full explanation.

**Rating weight rule:** No matter how many users apply the same flag, the credibility-weighted rating of the single most credible rater determines how that flag affects Thinker points. This prevents pile-ons. If a rating is disputed and found unfair, the negative points are nullified for the receiver and allocated to the rater.

**Dispute flow:** User → AI first review → Moderator → Senior Moderator → Jury of 6 peers (high-credibility users, balanced political views).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| commentId | FK | → Comment |
| comment | Relation | → Comment |
| userId | FK | → User |
| user | Relation | → User |
| positiveFlags | JSON | Array of ticked LEFT column boxes: ["constructive", "insightful", "relevant", "fresh_perspective", "balanced", "helpful_facts", "direct_experience", "good_question"] |
| negativeFlags | JSON | Array of ticked RIGHT column boxes: ["ad_hominem", "straw_man", "red_herring", "false_dilemma", "slippery_slope", "moving_goalposts", "motte_bailey", "tu_quoque", "cherry_picking", "not_relevant"] |
| note | Text nullable | Free text box for additional detail |
| disputeStatus | Enum nullable | NONE, AI_REVIEW, MODERATOR_REVIEW, SENIOR_REVIEW, PEER_JURY, RESOLVED |
| disputeRaisedByUserId | FK nullable | → User who raised the dispute |
| disputeVerdict | Text nullable | Final verdict from review process |
| createdAt | DateTime | |

Constraint: UNIQUE(commentId, userId)

Note: The old boolean fields (constructive, insightful, valuable, relevant, abusive, notConstructive) and constructiveScore are superseded by positiveFlags/negativeFlags arrays. The Thinker points formula applies to the weighted flag count: 3 positive flags = baseline helpful; 5 positive flags = 10x value of 3; 1 positive flag = 1/10th of 3; 2 and 4 interpolated proportionally.

---

### Amendment

A proposed change to an idea's wording, submitted by any user at Stage 3+.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| originalIdeaId | FK | → Idea (the idea being amended) |
| amendedIdeaId | FK nullable | → Idea (the resulting amended idea, if accepted) |
| originalIdea | Relation | → Idea |
| authorId | FK | → User |
| author | Relation | → User |
| proposedByUserId | FK | → User |
| stageNumber | Integer nullable | Stage at which amendment was proposed |
| sectionChanged | String | Which part of the idea is being changed |
| changesProposed | Text nullable | Description of changes proposed |
| currentText | Text | The text as it currently reads |
| proposedText | Text | The proposed new text |
| rationale | Text | Why this change improves the idea (required) |
| researchUrls | JSON nullable | Array of supporting source URLs |
| relevantLegislation | Text nullable | |
| status | Enum | PENDING, REVISION_REQUESTED, CONSULTING, ACCEPTED, REJECTED |
| amendmentStatus | String nullable | |
| amendmentHistory | JSON nullable | |
| mode | Enum nullable | MODE_A, MODE_B |
| rejectionReason | Text nullable | |
| revisionGuidance | Text nullable | |
| textDiff | Text nullable | Stored diff for display |
| mergedAt | DateTime nullable | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### AmendmentVote

User votes on a proposed amendment (separate from voting on the idea itself).

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

Advisory vote during Mode A consultation. Does not change the idea vote.

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

Owner message sent to all voters on an idea. Rate-limited to 1 per idea per 7 days.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| sentByUserId | FK | → User (must be idea owner) |
| subject | String | Max 200 chars |
| content | Text | Max 500 words |
| recipientCount | Integer | Number of voters at time of send |
| requiresCoSignatory | Boolean | Default false. If true, a second owner must approve before send. |
| coSignatoryUserId | FK nullable | → User (second signatory, for large groups) |
| coSignedAt | DateTime nullable | |
| status | Enum | DRAFT, PENDING_COSIGN, SENT, RECALLED |
| recalledAt | DateTime nullable | If recalled after send |
| recallReason | Text nullable | |
| sentAt | DateTime nullable | |

---

## SECTION 6 — ENDORSEMENTS

### Endorsement

Parliamentary endorsement by a verified MP or Peer.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| idea | Relation | → Idea |
| userId | FK | → User (must be parliamentary_verified = true) |
| mpUserId | FK | → User (alias) |
| mpUser | Relation | → User |
| endorserRole | Enum | MP, PEER |
| endorserConstituency | String nullable | For MPs |
| endorserPeerage | String nullable | For Peers |
| displayTitle | String nullable | e.g. "MP for Bristol West" |
| endorsementType | String nullable | |
| publicStatement | Text nullable | Optional public endorsement statement |
| statement | Text nullable | Alias |
| officeContact | String nullable | Contact details for MP/Peer office |
| status | Enum | ACTIVE, WITHDRAWN |
| withdrawalReason | Text nullable | |
| endorsedAt | DateTime | |
| withdrawnAt | DateTime nullable | |

Constraint: UNIQUE(ideaId, userId)

---

### DraftsmanEndorsement

Legal readiness certificate from a verified Parliamentary Draftsman. Required for Stage 4→5 gate.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| draftsmanUserId | FK | → User (must be professional_verified = true) |
| publicStatement | Text | Required — legal readiness assessment |
| draftsmanCredentials | Text | Firm/chambers and credentials, displayed publicly |
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
| invitedByUserId | FK | → User |
| invitedAt | DateTime | |
| acceptedAt | DateTime nullable | |

Constraint: UNIQUE(ideaId, userId)

---

### Group

A group for sharing ideas and messaging.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ownerId | FK | → User |
| name | String | |
| description | Text nullable | |
| groupType | Enum | COLLABORATORS, SUPPORTERS, PUBLIC |
| visibility | String nullable | |
| isPublic | Boolean | Default false |
| inviteCode | String UNIQUE | Public shareable join code |
| memberCount | Integer | Denormalised |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### GroupMember

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| groupId | FK | → Group |
| group | Relation | → Group |
| userId | FK | → User |
| user | Relation | → User |
| role | Enum | OWNER, ADMIN, MEMBER |
| joinedAt | DateTime | |

Constraint: UNIQUE(groupId, userId)

---

### GroupMessage

Messages sent within a group.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| groupId | FK | → Group |
| group | Relation | → Group |
| authorId | FK | → User |
| author | Relation | → User |
| content | Text | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### GroupInvite

Invite links for joining a group.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| groupId | FK | → Group |
| group | Relation | → Group |
| inviteCode | String UNIQUE | Short code for URL |
| inviteType | Enum | PUBLIC_LINK, PRIVATE_EMAIL, BULK_UPLOAD |
| email | String nullable | Specific email if private |
| maxUses | Integer | Default 1 |
| usedCount | Integer | Default 0 |
| expiresAt | DateTime nullable | |
| createdByUserId | FK | → User |
| createdBy | Relation | → User |
| creator | Relation | → User |
| createdAt | DateTime | |

---

### UserInvite

Invitation to a non-registered user to join the platform (via magic link).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| invitedByUserId | FK | → User |
| email | String | |
| firstName | String | |
| lastName | String | |
| magicLinkToken | String UNIQUE | Cryptographically random |
| ideaId | FK nullable | → Idea (if invited as collaborator) |
| groupId | FK nullable | → Group (if invited as group member) |
| collaboratorRole | Enum nullable | EDITOR, VIEWER |
| customMessage | Text nullable | |
| status | Enum | PENDING, ACCEPTED, EXPIRED |
| expiresAt | DateTime | |
| createdAt | DateTime | |

---

## SECTION 8 — REPUTATION & POINTS

### Reputation

Aggregate points per category per user. Single record per user, updated in real time.

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
| reputationRankScore | Decimal nullable | Overall computed rank score |
| updatedAt | DateTime | |

---

### PointsLedger

Immutable transaction log of every points event.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | (also: ledger_id) |
| userId | FK | → User (also: user_id) |
| category | Enum | STRATEGIST, THINKER, RALLYMASTER, RAINMAKER, TEAMBUILDER |
| pointsDelta | Integer | Positive or negative (also: points_delta) |
| reason | Enum | VOTE_RECEIVED, VOTE_REVERSED, COMMENT_RATED, AMENDMENT_ACCEPTED, REFERRAL_QUALIFIED, MERGE_COMPLETED, etc. |
| triggerType | String nullable | |
| triggerEntityId | String nullable | |
| relatedIdeaId | FK nullable | |
| relatedUserId | FK nullable | (also: source_user_id) |
| createdAt | DateTime | (also: created_at) |
| reversedAt | DateTime nullable | |

---

### CredibilityScore

The single visible credibility number on a user's profile. Computed from all points inputs. CredibilityScore is the canonical name — InfluenceScore was an earlier name for the same concept and is now retired.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | (also: score_id) |
| userId | FK UNIQUE | → User (also: user_id) |
| rawScore | Integer | Sum of all weighted inputs |
| normalisedScore | Decimal nullable | Percentile score (null until rawScore >= 350) |
| phase | Enum | BUILDING (raw < 350), ESTABLISHED (raw >= 350) |
| thinkerComponent | Decimal nullable | Contribution from Thinker points |
| strategistComponent | Decimal nullable | Contribution from Strategist points |
| rallymasterComponent | Decimal nullable | Contribution from Rallymaster points |
| rainmakerComponent | Decimal nullable | Contribution from Rainmaker points |
| teambuilderComponent | Decimal nullable | Contribution from Teambuilder points |
| accountAgeComponent | Decimal nullable | Contribution from account age |
| peerEndorsementComponent | Decimal nullable | Contribution from peer endorsements received |
| totalScore | Decimal nullable | Final computed score |
| lastCalculatedAt | DateTime | Nightly batch + immediate on major events |
| calculatedAt | DateTime | Alias |

---

## SECTION 9 — REFERRAL & MERGE

### ReferralEvent

Tracks successful referrals (30-day qualification window, 3 meaningful actions required).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| referrerUserId | FK | → User (who shared the link) |
| referredUserId | FK | → User (who registered via the link) |
| referralCode | String | Code used |
| registeredAt | DateTime | When referred user registered |
| qualifiedAt | DateTime nullable | When 30-day + 3-action condition met |
| actionCount | Integer | Default 0 — actions taken by referred user |
| pointsAwarded | Boolean | Default false |

---

### MergedIdea

Records the outcome of a merge proposal between two ideas.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | (also: merge_id) |
| survivingIdeaId | FK | → Idea (also: surviving_idea_id) |
| absorbedIdeaId | FK | → Idea (also: absorbed_idea_id) |
| survivingOwnerId | FK | → User (also: surviving_owner_id) |
| absorbedOwnerId | FK | → User (also: absorbed_owner_id) |
| proposedByUserId | FK | → User (also: proposed_by_user_id) |
| mergeType | Enum | MERGER, TAKEOVER |
| proposalType | String nullable | |
| status | Enum | PROPOSED, ACCEPTED, REJECTED, LAPSED, COUNTER_PROPOSED |
| proposalMessage | Text | |
| negotiationThreadId | FK nullable | → MessageThread |
| proposedAt | DateTime | (also: proposal_date) |
| acceptedAt | DateTime nullable | |
| votesPortedCount | Integer | Votes ported after 14-day window (also: votes_ported) |
| rallymasterPointsAwarded | Integer nullable | |
| strategistPointsAwarded | Integer nullable | |
| pointsAwarded | Boolean | Default false |
| createdAt | DateTime | |

---

## SECTION 10 — MESSAGING

### MessageThread

Container for a conversation. Auto-created for merge proposals.

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

Individual message in a thread.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| threadId | FK | → MessageThread |
| senderId | FK | → User |
| content | Text | Rich text. DOMPurify sanitised. |
| readAt | DateTime nullable | When recipient read it |
| createdAt | DateTime | |

---

## SECTION 11 — MODERATION

### ContentReport

User report of content requiring moderation review.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| reporterUserId | FK | → User |
| reporter | Relation | → User |
| reportedContentType | Enum | IDEA, COMMENT, AMENDMENT, USER |
| contentType | Enum | Alias |
| reportedCommentId | FK nullable | → Comment |
| reportedComment | Relation | → Comment |
| reportedIdeaId | FK nullable | → Idea |
| reportedIdea | Relation | → Idea |
| reportedUserId | FK nullable | → User |
| reportedUser | Relation | → User |
| contentId | String nullable | ID of the reported content |
| reportReason | Enum | SPAM, HARMFUL, OFF_TOPIC, MISINFORMATION, ABUSIVE, OTHER |
| reason | Enum | Alias |
| description | Text nullable | Additional context |
| status | Enum | PENDING, UNDER_REVIEW, DISMISSED, ACTION_TAKEN |
| reviewedByUserId | FK nullable | → User (moderator/admin) |
| reviewedBy | Relation | → User |
| reviewer | Relation | → User |
| reviewedAt | DateTime nullable | |
| moderationAction | Enum nullable | NONE, WARNING_SENT, CONTENT_HIDDEN, CONTENT_REMOVED, USER_SUSPENDED, USER_BANNED |
| action | Enum nullable | Alias |
| moderatorNotes | Text nullable | Internal notes |
| createdAt | DateTime | |

---

## SECTION 12 — GDPR & EMAIL

### EmailSuppression

Global email suppression list. Check before EVERY email send.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| email | String UNIQUE | |
| reason | Enum | USER_UNSUBSCRIBED, ACCOUNT_DELETED, BOUNCE, COMPLAINT |
| suppressedAt | DateTime | |

---

### UserParliamentaryVerification

Claim and verification record for MP/Peer status.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK | → User |
| claimedRole | Enum | MP, PEER |
| constituency | String nullable | For MPs |
| peerageTitle | String nullable | For Peers |
| parliamentProfileUrl | String | Submitted Parliament.uk URL |
| status | Enum | PENDING, APPROVED, REJECTED |
| reviewedByUserId | FK nullable | → User (admin) |
| reviewedAt | DateTime nullable | |
| adminNotes | Text nullable | |
| createdAt | DateTime | |

---

### UserProfessionalVerification

Claim and verification record for Parliamentary Draftsman status.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK | → User |
| firmOrChambers | String | |
| credentials | String | |
| licenceNumber | String nullable | |
| supportingDocumentR2Key | String | R2 key for uploaded PDF evidence |
| status | Enum | PENDING, APPROVED, REJECTED |
| reviewedByUserId | FK nullable | → User (admin) |
| reviewedAt | DateTime nullable | |
| adminNotes | Text nullable | |
| createdAt | DateTime | |

---

## SECTION 13 — NOTIFICATIONS & ACTIVITY

### Notification

In-app notification for a user.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK | → User |
| user | Relation | → User |
| notificationType | Enum | VOTE_RECEIVED, STAGE_ELIGIBLE, COMMENT_POSTED, AMENDMENT_PROPOSED, ENDORSEMENT_GIVEN, MERGE_PROPOSED, MESSAGE_RECEIVED, SYSTEM, etc. |
| type | Enum | Alias |
| relatedIdeaId | FK nullable | |
| relatedIdea | Relation | → Idea |
| relatedUserId | FK nullable | |
| relatedUser | Relation | → User |
| title | String nullable | |
| message | String | Human-readable notification text |
| linkUrl | String nullable | |
| actionUrl | String nullable | Alias |
| isRead | Boolean | Default false |
| read | Boolean | Alias |
| createdAt | DateTime | |

---

### ActivityLog

Immutable audit log of all significant platform events.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK | → User |
| user | Relation | → User |
| activityType | Enum | IDEA_CREATED, IDEA_STAGE_CHANGED, VOTE_CAST, VOTE_WITHDRAWN, COMMENT_POSTED, AMENDMENT_PROPOSED, AMENDMENT_ACCEPTED, ENDORSEMENT_GIVEN, MERGE_PROPOSED, ACCOUNT_CREATED, ADMIN_ACTION, etc. |
| entityType | String nullable | "Idea", "Comment", "Vote" etc. |
| entityId | String nullable | ID of the entity |
| description | String | Human-readable description |
| metadata | JSON nullable | Additional structured data |
| createdAt | DateTime | |

---

## SECTION 14 — AI & TRACKING

### AIUsageLog

Tracks token consumption and cost per AI API call.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK | → User |
| user | Relation | → User |
| ideaId | FK nullable | → Idea |
| idea | Relation | → Idea |
| provider | Enum | GEMINI_FLASH, GROK_FAST |
| model | String | e.g. "gemini-2.5-flash" |
| activityType | String nullable | |
| inputTokens | Integer | (also: tokensUsed) |
| outputTokens | Integer | |
| costAmount | Decimal | (also: costUSD) |
| fieldTarget | String nullable | Which field Lex was working on |
| requestSummary | Text nullable | |
| createdAt | DateTime | |

---

### AIConversation

A session of Lex conversation attached to an idea.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| idea | Relation | → Idea |
| userId | FK | → User |
| user | Relation | → User |
| conversationType | String nullable | |
| conversationData | JSON nullable | |
| sessionStartAt | DateTime | |
| sessionEndAt | DateTime nullable | |
| messagesCount | Integer | Default 0 (also: messageCount) |
| totalTokens | Integer | Default 0 (also: tokensUsed) |
| totalCostUSD | Decimal | Default 0 |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| completedAt | DateTime nullable | |

---

## SECTION 15 — DEFERRED

### Fundraise

Payment and fundraising tracking. Schema ready; implementation deferred to Sprint 2.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| userId | FK | → User (donor) |
| amountGBP | Decimal | |
| status | Enum | PENDING, COMPLETED, REFUNDED |
| stripePaymentId | String nullable | |
| createdAt | DateTime | |

See System Mechanics Section 6.4 for full fundraising rules.

---

### WhatsAppIntegration

WhatsApp group sync. Deferred to Sprint 2.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| groupId | FK UNIQUE | → Group |
| group | Relation | → Group |
| whatsappGroupId | String nullable | |
| whatsappInviteLink | String nullable | |
| syncEnabled | Boolean | Default true |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

## SECTION 16 — TRAINING

### Training

A training resource linked from the platform's training section.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| title | String | |
| resourceType | Enum | VIDEO, ARTICLE, PODCAST |
| governmentCategory | String | Which area of government this relates to |
| areaOfTraining | String | e.g. "Drafting legislation", "Building support", "Strategy" |
| author | String | |
| durationMinutes | Integer nullable | |
| url | String | YouTube URL or external link |
| rating | Decimal nullable | 0–5 average user rating |
| stageTag | Enum nullable | CREATE, DRAFT, DEVELOP, CAMPAIGN, PARLIAMENT |
| topicTag | String nullable | Free-text topic tag |
| difficultyTag | Enum nullable | BEGINNER, INTERMEDIATE, ADVANCED |
| isPublished | Boolean | Default false. Admin publishes. |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

## SECTION 17 — FOLLOWS & WATCHES

### Follow

Handles both "follow a user" and "watch an idea" in a single entity.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| followerId | FK | → User (the person following/watching) |
| followedUserId | FK nullable | → User (if following a user) |
| watchedIdeaId | FK nullable | → Idea (if watching an idea) |
| createdAt | DateTime | |

Constraint: UNIQUE(followerId, followedUserId) where followedUserId not null
Constraint: UNIQUE(followerId, watchedIdeaId) where watchedIdeaId not null
Note: Exactly one of followedUserId or watchedIdeaId must be non-null per record.

---

## SECTION 18 — DISPUTED LOGIC FLAGS

### DisputedLogicFlag

Created when a user disputes Lex's fallacy flag. Reviewed by Logic admin role.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| userId | FK | → User (user who raised the dispute) |
| lexFlag | Text | The fallacy flag Lex raised, in Lex's own words |
| userDispute | Text | The user's counter-argument |
| status | Enum | PENDING, REVIEWED |
| adminVerdict | Text nullable | Logic admin's verdict after review |
| createdAt | DateTime | |

---

*entity_list_v4.md — Scrutinise — March 2026*
*Total entities: 54 (v3's 52 + Stage + GroupMessage)*
*Source of truth for Prisma schema generation.*
*CCh-only: never edited directly by CC without explicit Charlie instruction.*
