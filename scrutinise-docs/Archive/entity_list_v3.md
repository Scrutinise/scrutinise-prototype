# SCRUTINISE — ENTITY LIST v3
*All 47 entities with complete field specifications.*
*Source: Entity List original + v2 changes + AI integration spec (March 2026)*
*Last updated: March 2026*

---

## CONTENTS

### SECTION 1 — CORE
- User
- Idea
- WordingHistory
- StageTransition

### SECTION 2 — STRATEGIC KERNEL
- Diagnosis
- RootCause
- GuidingPolicy
- Evidence
- CoherentAction
- ResourcesCommitted

### SECTION 3 — LEGISLATION & ORGANISATION
- TargetLegislation
- TargetOrganisation
- Situation
- ParliamentaryProgress

### SECTION 4 — RESEARCH
- Research
- Attachment

### SECTION 5 — IDEA MODIFICATIONS
- Vote
- Comment
- CommentRating
- Amendment
- AmendmentVote
- ConsultationVote
- BroadcastMessage

### SECTION 6 — ENDORSEMENTS
- Endorsement
- DraftsmanEndorsement

### SECTION 7 — COLLABORATION
- IdeaCollaborator
- Group
- GroupMember
- GroupInvite
- UserInvite

### SECTION 8 — REPUTATION & POINTS
- Reputation
- PointsLedger
- CredibilityScore

### SECTION 9 — REFERRAL & MERGE
- ReferralEvent
- MergedIdea

### SECTION 10 — MESSAGING
- MessageThread
- Message

### SECTION 11 — MODERATION
- ContentReport

### SECTION 12 — GDPR & EMAIL
- EmailSuppression
- UserParliamentaryVerification
- UserProfessionalVerification

### SECTION 13 — NOTIFICATIONS & ACTIVITY
- Notification
- ActivityLog

### SECTION 14 — AI & TRACKING
- AIUsageLog
- AIConversation

### SECTION 15 — DEFERRED
- Fundraise
- WhatsAppIntegration

### SECTION 16 — TRAINING
- Training

### SECTION 17 — FOLLOWS & WATCHES
- Follow

### SECTION 18 — DISPUTED LOGIC FLAGS
- DisputedLogicFlag

---

## SECTION 1 — CORE

### User

The central entity. One record per registered user, created immediately on Clerk webhook.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| clerkId | String UNIQUE | Clerk's user ID — join key between Clerk and our DB |
| email | String UNIQUE | Verified email |
| firstName | String | |
| lastName | String | |
| displayName | String | What the user is called (defaults to "Boss" until set) |
| username | String UNIQUE | @handle, auto-generated from name, user can change once |
| bio | Text nullable | Rich text, public-facing |
| expertType | String nullable | Free text professional credentials |
| politicalParty | String nullable | Optional |
| role | Enum | CITIZEN, MODERATOR, ADMIN, SUPER_ADMIN |
| parliamentary_status | Enum nullable | MP, PEER, NONE |
| parliamentary_verified | Boolean | Default false |
| professional_verified | Boolean | Default false — for Parliamentary Draftsmen |
| referralCode | String UNIQUE | Cryptographically random, generated on account creation |
| referredByUserId | FK nullable | User who referred this user |
| country | String nullable | ISO 3166-1 alpha-2 country code. Default 'GB'. For future international expansion. |
| aiPreferredStyle | String nullable | User's preferred Lex interaction style |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| status | Enum | ACTIVE, SUSPENDED, DELETION_PENDING, DELETED |
| lastActiveAt | DateTime nullable | |

Relations: ideas[], votes[], comments[], endorsements[], reputation, credibilityScore, notifications[], messages[], groups[], ideaCollaborators[]

---

### Idea

The central content entity. Everything on the platform revolves around an Idea.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| creatorId | FK | → User |
| title | String | Max 200 chars |
| summaryDescription | String | Max 280 chars — used on cards and snippets |
| ideaType | Enum | LEGISLATION, ORGANISATION |
| govtArea | String | Government area (housing, health, transport etc.) |
| govtLevel | Enum | LOCAL, DEVOLVED, NATIONAL, INTERNATIONAL |
| country | String nullable | ISO 3166-1 alpha-2 country code. Default 'GB'. For future international expansion. |
| stage | Enum | STAGE_1, STAGE_2, STAGE_3, STAGE_4, STAGE_5, ARCHIVED, WITHDRAWN |
| visibility | Enum | PRIVATE, LINK_ONLY, PLATFORM_LISTED |
| status | Enum | DRAFT, ACTIVE, ARCHIVED, MERGED, WITHDRAWN |
| proposedWording | Text nullable | The actual proposed legislation text. Locked for direct edit once first vote received. |
| wordingLocked | Boolean | Default false. Set true on first vote received. |
| version | Integer | Increments on every ProposedWording change. Default 1. |
| diagnosis | Text nullable | Strategic kernel: what is the real problem |
| guidingPolicy | Text nullable | Strategic kernel: the approach |
| rootCause | Text nullable | Strategic kernel: the underlying cause |
| voteCount | Integer | Denormalised total. Default 0. |
| passionScore | Decimal nullable | Average strength/certainty score across all non-withdrawn votes. Recalculated on every vote. Public-facing. |
| voteDistribution | JSON nullable | Breakdown for owner analytics: {for: N, against: N, undecided: N, avgStrengthFor: X, avgStrengthAgainst: X, avgStrengthUndecided: X, strengthBuckets: [...]}. Updated on every vote. |
| commentCount | Integer | Denormalised. Default 0. |
| endorsementCount | Integer | Denormalised. Default 0. |
| eligibleForNextStage | Boolean | Set true when threshold crossed |
| voteTarget | Integer nullable | Owner-set motivational target (optional) |
| connectedIdeaIds | JSON nullable | Array of related idea IDs |
| aiProvider | Enum | GEMINI_FLASH, GROK_FAST, USER_CLAUDE, USER_GPT4O, USER_GROK |
| aiChatHistory | JSON | Rolling last-20-messages array: [{role, content, timestamp}] |
| aiChatSummary | Text nullable | AI-generated compression of older history |
| aiCurrentField | String nullable | Which field Lex is currently working on |
| aiSessionCount | Integer | Total AI sessions on this idea. Default 0. |
| referralLinkActive | Boolean | Default false. Set true on Stage 3. |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Relations: votes[], comments[], amendments[], endorsements[], research[], attachments[], collaborators[], stageTransitions[], wordingHistory[], targetLegislation[], targetOrganisations[], coherentActions[], evidence[], mergedIdeas[]

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
| triggeredByUserId | FK | → User (owner who triggered) |
| adminUserId | FK nullable | → User (admin who approved, if required) |
| notes | Text nullable | |
| createdAt | DateTime | |

---

## SECTION 2 — STRATEGIC KERNEL

The Strategic Kernel is the analytical backbone of every idea. Based on Rumelt's Good Strategy / Bad Strategy framework. All fields belong to the Idea entity but are represented as linked sub-entities for complex ideas. For MVP, these are fields on Idea; the sub-entities are for future multi-item support.

---

### Diagnosis

What is the real problem? The pivotal constraint — not a list of symptoms.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| text | Text | The diagnosis statement |
| version | Integer | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### RootCause

The underlying cause behind the diagnosis.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| text | Text | |
| version | Integer | |
| createdAt | DateTime | |

---

### GuidingPolicy

The approach that deals with the diagnosis. Not a goal — a method.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| text | Text | |
| version | Integer | |
| createdAt | DateTime | |

---

### Evidence

Supporting evidence for the diagnosis or guiding policy.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| title | String | |
| description | Text | |
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
| title | String | |
| description | Text | |
| proposedWording | Text nullable | The specific legislative clause for this action |
| order | Integer | Display order |
| version | Integer | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Note: Votes on an idea auto-vote for all CoherentActions. Users can optionally vote for/against specific CoherentActions within an idea. If a user votes for 35 of 50 CAs, that counts as 1 idea vote for display (rounded to nearest whole). Full CA-level vote data retained internally.

---

### ResourcesCommitted

Resources, costs, and implementation requirements.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| resourceType | Enum | FINANCIAL, HUMAN, INFRASTRUCTURE, LEGISLATIVE, OTHER |
| description | Text | |
| estimatedCost | Decimal nullable | |
| timeframe | String nullable | e.g. "6 months", "2 years" |
| createdAt | DateTime | |

---

## SECTION 3 — LEGISLATION & ORGANISATION

### TargetLegislation

Specific legislation the idea aims to change, repeal, or create.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| title | String | e.g. "Housing Act 1988" |
| year | String | e.g. "1988" |
| legislationUrl | String nullable | Link to legislation.gov.uk |
| relevantClauses | Text nullable | Which specific sections are affected |
| changeType | Enum | AMEND, REPEAL, NEW_ACT |
| createdAt | DateTime | |

---

### TargetOrganisation

For ORGANISATION type ideas — the body to be created or changed.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| organisationName | String | |
| organisationType | String | e.g. "Regulatory Body", "Public Service" |
| description | Text | |
| createdAt | DateTime | |

---

### Situation

Context and background information about the current state of affairs.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| description | Text | |
| affectedPopulation | Integer nullable | Estimated number of people affected |
| geographicScope | String nullable | |
| createdAt | DateTime | |

---

### ParliamentaryProgress

Tracks the idea's progress through the actual parliamentary process (Stage 5+).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK UNIQUE | → Idea (one record per idea) |
| billNumber | String nullable | e.g. "HC-2026-047" |
| committeeName | String nullable | e.g. "Housing, Communities & Local Government" |
| committeeChair | String nullable | |
| currentParliamentaryStage | Enum nullable | SUBMITTED, FIRST_READING, EVIDENCE_SESSION, SECOND_READING, COMMITTEE_STAGE, THIRD_READING, LORDS, ROYAL_ASSENT |
| nextSessionDate | DateTime nullable | |
| nextSessionType | String nullable | Free text — "First Reading", "Evidence Session" etc. |
| submissionDeadline | DateTime nullable | |
| submissionEmail | String nullable | |
| progressStages | JSON | Array of {title, description, links[], status} — owner-maintained custom stages |
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
| addedByUserId | FK | → User |
| title | String | |
| snippet | Text | Short excerpt or key finding |
| relevanceExplanation | Text | Why this is relevant |
| summary | Text | Summary of the source content |
| sourceUrl | String | Validated via Google Safe Browsing |
| sourceType | Enum | ACADEMIC, GOVERNMENT, NEWS, CASE_STUDY, LEGISLATION, OTHER |
| forPolicy | Boolean | Does this support the policy direction? |
| forAction | Boolean | Does this support the proposed action? |
| constructiveScore | Integer nullable | 1-5 self-assessed quality rating |
| createdAt | DateTime | |

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

One vote per user per idea. All votes are raw and equal — no weighting.

Vote structure: a direction (FOR / AGAINST / UNDECIDED) plus a strength/certainty slider (0–5 in 0.5 increments).
- FOR + strength: 0 = barely convinced, 5 = passionately behind this
- AGAINST + strength: 0 = barely opposed, 5 = passionately against
- UNDECIDED + strength: 0 = don't care about this issue, 5 = care a lot but can't decide yet

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| userId | FK | → User. Email verification required before voting. |
| direction | Enum | FOR, AGAINST, UNDECIDED |
| strength | Decimal | 0.0 to 5.0 in 0.5 increments |
| qualityFlags | JSON nullable | Array of ticked quality flags: ["doesnt_go_far_enough", "goes_too_far", "poorly_worded"] |
| referralCode | String nullable | Referral code active when vote was cast |
| ipAddressHash | String nullable | SHA-256 hash of IP only |
| pendingPort | Boolean | Default false. Set true during merge withdrawal window. |
| withdrawn | Boolean | Default false |
| castAt | DateTime | |
| updatedAt | DateTime | |

Constraint: UNIQUE(ideaId, userId)

Note: qualityFlags are optional — shown as three checkboxes on the vote page. UNDECIDED voters see the same three flags.

---

### Comment

Flat comment system. Owner-only replies (no user-to-user threading).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| userId | FK | → User |
| content | Text | Rich text. DOMPurify sanitised before storing. |
| stance | Enum | SUPPORTIVE, CRITICAL, NEUTRAL, QUESTION |
| parentId | FK nullable | → Comment. Only set when comment is owner reply. |
| isOwnerReply | Boolean | Default false |
| helpfulCount | Integer | Denormalised upvote count |
| notHelpfulCount | Integer | Denormalised downvote count |
| isHidden | Boolean | Default false. Set by moderator. |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### CommentRating

Multi-dimension quality rating on a comment.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| commentId | FK | → Comment |
| userId | FK | → User |
| positiveFlags | JSON | Array of ticked positive boxes: ["constructive", "insightful", "relevant", "fresh_perspective", "balanced", "helpful_facts", "direct_experience", "good_question"] |
| negativeFlags | JSON | Array of ticked negative boxes: ["ad_hominem", "straw_man", "red_herring", "false_dilemma", "slippery_slope", "moving_goalposts", "motte_bailey", "tu_quoque", "cherry_picking", "not_relevant"] |
| note | Text nullable | Free text explaining rating |
| createdAt | DateTime | |

Constraint: UNIQUE(commentId, userId)

Note: Rating credibility is weighted by the rater's own CredibilityScore (highest credibility rater's assessment takes precedence for conflicting flags). Rating feeds into commenter's Thinker points. Points formula: 3 is baseline-helpful; 5 is worth 10x 3; 1 is worth 1/10th of 3; 2 and 4 interpolated proportionally.

---

### Amendment

A proposed change to an idea's wording, submitted by any user at Stage 3+.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| proposedByUserId | FK | → User |
| sectionChanged | String | Which part of the idea is being changed |
| currentText | Text | The text as it currently reads |
| proposedText | Text | The proposed new text |
| rationale | Text | Why this change improves the idea (required) |
| researchUrls | JSON nullable | Array of supporting source URLs |
| relevantLegislation | Text nullable | |
| status | Enum | PENDING, REVISION_REQUESTED, CONSULTING, ACCEPTED, REJECTED |
| mode | Enum nullable | MODE_A (advisory consultation), MODE_B (binding accept) |
| rejectionReason | Text nullable | |
| revisionGuidance | Text nullable | |
| mergedAt | DateTime nullable | |
| textDiff | Text nullable | Stored diff for display |
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
| sentAt | DateTime | |

---

## SECTION 6 — ENDORSEMENTS

### Endorsement

Parliamentary endorsement by a verified MP or Peer. Separate from voting.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| userId | FK | → User (must be parliamentary_verified = true) |
| endorserRole | Enum | MP, PEER |
| endorserConstituency | String nullable | For MPs |
| endorserPeerage | String nullable | For Peers |
| publicStatement | Text nullable | Optional public endorsement statement |
| status | Enum | ACTIVE, WITHDRAWN |
| withdrawalReason | Text nullable | |
| endorsedAt | DateTime | |
| withdrawnAt | DateTime nullable | |

Constraint: UNIQUE(ideaId, userId)

Note: Displayed publicly on idea page and referral landing pages. No points awarded for endorsing — it is a public duty. Feeds into owner's CredibilityScore at High weight. Required: minimum 3 active endorsements for Stage 4→5 transition.

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

Note: Only available at Stage 4+. Certificate displayed with draftsman's credentials on idea page.

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

A group for sharing ideas and messaging. Like a WhatsApp group — for distribution, not a formal entity.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ownerId | FK | → User |
| name | String | |
| description | Text nullable | |
| groupType | Enum | COLLABORATORS, SUPPORTERS, PUBLIC |
| isPublic | Boolean | Default false |
| inviteCode | String UNIQUE | Public shareable join code |
| memberCount | Integer | Denormalised |
| createdAt | DateTime | |

Note: Groups are for messaging and distribution only. Group membership is not shown on comments. Users can filter ideas by groups they belong to, but there are no "group ideas" per se — multiple owners of an idea auto-creates a group for messaging.

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

### GroupInvite

Invite links for joining a group.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| groupId | FK | → Group |
| inviteCode | String UNIQUE | Short code for URL |
| inviteType | Enum | PUBLIC_LINK, PRIVATE_EMAIL, BULK_UPLOAD |
| email | String nullable | Specific email if private |
| maxUses | Integer | Default 1 |
| usedCount | Integer | Default 0 |
| expiresAt | DateTime nullable | |
| createdByUserId | FK | → User |
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
| reputationPointsStrategist | Integer | Default 0 |
| reputationPointsThinker | Integer | Default 0 |
| reputationPointsRallymaster | Integer | Default 0 |
| reputationPointsRainmaker | Integer | Default 0 |
| reputationPointsTeambuilder | Integer | Default 0 |
| updatedAt | DateTime | |

Note: "Teambuilder" is the canonical name — never "Dealweaver".

---

### PointsLedger

Immutable transaction log of every points event. The audit trail behind the Reputation totals.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK | → User |
| category | Enum | STRATEGIST, THINKER, RALLYMASTER, RAINMAKER, TEAMBUILDER |
| pointsDelta | Integer | Positive or negative |
| reason | Enum | VOTE_RECEIVED, VOTE_REVERSED, COMMENT_RATED, AMENDMENT_ACCEPTED, REFERRAL_QUALIFIED, MERGE_COMPLETED, etc. |
| relatedIdeaId | FK nullable | |
| relatedUserId | FK nullable | |
| createdAt | DateTime | |

---

### CredibilityScore

The single visible number on a user's profile. Computed from all points inputs. Separate from raw Reputation totals.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK UNIQUE | → User |
| rawScore | Integer | Sum of all weighted inputs |
| normalisedScore | Decimal nullable | Percentile score (null until rawScore >= 350) |
| phase | Enum | BUILDING (raw < 350), ESTABLISHED (raw >= 350) |
| lastCalculatedAt | DateTime | Nightly batch + immediate on major events |

Phase 1 (raw < 350): Show raw number + "Building credibility..." + progress bar.
Phase 2 (raw >= 350): Show percentile-normalised score vs all Phase 2 users. Can go below 0.

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
| id | UUID PK | |
| survivingIdeaId | FK | → Idea |
| absorbedIdeaId | FK | → Idea |
| proposedByUserId | FK | → User (who initiated the proposal) |
| mergeType | Enum | MERGER (absorbed owner proposes), TAKEOVER (surviving owner proposes) |
| status | Enum | PROPOSED, ACCEPTED, REJECTED, LAPSED, COUNTER_PROPOSED |
| proposalMessage | Text | |
| negotiationThreadId | FK nullable | → MessageThread |
| acceptedAt | DateTime nullable | |
| votesPortedCount | Integer | Votes ported after 14-day window |
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

Note: AES encrypted at rest. Not end-to-end encrypted in v1. Out of scope v1: group messaging, file attachments, message search.

---

## SECTION 11 — MODERATION

### ContentReport

User report of content requiring moderation review.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| reporterUserId | FK | → User |
| contentType | Enum | IDEA, COMMENT, AMENDMENT, USER |
| contentId | String | ID of the reported content |
| reason | Enum | SPAM, HARMFUL, OFF_TOPIC, MISINFORMATION, ABUSIVE, OTHER |
| description | Text nullable | Additional context |
| status | Enum | PENDING, UNDER_REVIEW, DISMISSED, ACTION_TAKEN |
| reviewedByUserId | FK nullable | → User (moderator/admin) |
| reviewedAt | DateTime nullable | |
| action | Enum nullable | NONE, WARNING_SENT, CONTENT_HIDDEN, CONTENT_REMOVED, USER_SUSPENDED, USER_BANNED |
| moderatorNotes | Text nullable | Internal notes |
| createdAt | DateTime | |

Note: Moderator identity shown on platform as "First Name Initial." e.g. "James T." with Moderator badge. Full identity visible to Admins only.

---

## SECTION 12 — GDPR & EMAIL

### EmailSuppression

Global email suppression list (blacklist). Check before EVERY email send.

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
| type | Enum | VOTE_RECEIVED, STAGE_ELIGIBLE, COMMENT_POSTED, AMENDMENT_PROPOSED, ENDORSEMENT_GIVEN, MERGE_PROPOSED, MESSAGE_RECEIVED, SYSTEM, etc. |
| message | String | Human-readable notification text |
| linkUrl | String nullable | Where to go on click |
| relatedIdeaId | FK nullable | |
| isRead | Boolean | Default false |
| createdAt | DateTime | |

---

### ActivityLog

Immutable audit log of all significant platform events.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| userId | FK | → User |
| activityType | Enum | IDEA_CREATED, IDEA_STAGE_CHANGED, VOTE_CAST, VOTE_WITHDRAWN, COMMENT_POSTED, AMENDMENT_PROPOSED, AMENDMENT_ACCEPTED, ENDORSEMENT_GIVEN, MERGE_PROPOSED, ACCOUNT_CREATED, ADMIN_ACTION, etc. |
| entityType | String nullable | "Idea", "Comment", "Vote" etc. |
| entityId | String nullable | ID of the entity |
| description | String | Human-readable description |
| metadata | JSON nullable | Additional structured data |
| createdAt | DateTime | |

---

## SECTION 14 — AI & TRACKING

### AIUsageLog

Tracks token consumption and cost per AI API call. Used for cost monitoring and future billing.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK nullable | → Idea |
| userId | FK | → User |
| provider | Enum | GEMINI_FLASH, GROK_FAST |
| model | String | e.g. "gemini-2.5-flash" |
| inputTokens | Integer | |
| outputTokens | Integer | |
| costUSD | Decimal(8,6) | |
| fieldTarget | String nullable | Which field Lex was working on |
| createdAt | DateTime | |

---

### AIConversation

A session of Lex conversation attached to an idea. Linked to the rolling aiChatHistory on Idea.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| ideaId | FK | → Idea |
| userId | FK | → User |
| sessionStartAt | DateTime | |
| sessionEndAt | DateTime nullable | |
| messagesCount | Integer | Default 0 |
| totalTokens | Integer | Default 0 |
| totalCostUSD | Decimal(8,6) | Default 0 |

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

---

### WhatsAppIntegration

WhatsApp group sync. Deferred to Sprint 2.

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

## SECTION 16 — TRAINING

### Training

A training resource (video, article, or podcast) linked from the platform's training section. Sprint 1: YouTube embeds only. Future: paid course model.

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
| stageTag | Enum nullable | CREATE, DRAFT, DEVELOP, CAMPAIGN, PARLIAMENT — which stage this is most relevant to |
| topicTag | String nullable | Free-text topic tag |
| difficultyTag | Enum nullable | BEGINNER, INTERMEDIATE, ADVANCED |
| isPublished | Boolean | Default false. Admin publishes. |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

## SECTION 17 — FOLLOWS & WATCHES

### Follow

Handles both "follow a user" and "watch an idea" in a single entity. Generates notifications on stage changes, new comments, and amendments.

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

Created when a user disputes Lex's fallacy flag and the disagreement is unresolved. Reviewed by Logic admin role. Feeds into prompt refinement.

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

*entity_list_v3.md — Scrutinise — March 2026*
*Total entities: 52 (47 original + Training, Follow, DisputedLogicFlag, plus passionScore/voteDistribution/country additions)*
*Source of truth for Prisma schema generation.*
