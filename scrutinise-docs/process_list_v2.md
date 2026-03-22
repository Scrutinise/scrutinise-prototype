# SCRUTINISE — PROCESS LIST v2.1
*All platform processes with step-by-step flows.*
*v2.1: Updated 22 March 2026 — stage gates revised, contributions terminology, amendment counter-proposal, Lex opening/welcome messages, notification routing, AI modes.*
*Reconciled against entity_list_v4.1 and system_mechanics_v0.7.*

---

## CONTENTS

- [CORE IDEA PROCESSES](#core-idea-processes) — P01–P08
- [ONBOARDING & SIGN-UP](#onboarding--sign-up) — P00–P00b
- [INVITATION & COLLABORATION](#invitation--collaboration-processes) — P09–P13
- [VOTING PROCESSES](#voting-processes) — P14–P14b
- [AMENDMENT PROCESSES](#amendment-processes) — P15–P20
- [CONTRIBUTION PROCESSES](#contribution-processes) — P21–P25
- [RESEARCH PROCESSES](#research-processes) — P26–P27
- [ENDORSEMENT PROCESSES](#endorsement-processes) — P28–P32
- [MERGE PROCESSES](#merge-processes) — P33–P35
- [ACCOUNT & PROFILE PROCESSES](#account--profile-processes) — P36–P43
- [AI ASSISTANCE](#ai-assistance) — P44
- [ADMIN & MODERATION](#admin--moderation-processes) — P45–P48
- [DISCOVERY & SEARCH](#discovery--search-processes) — P49–P51
- [SETTINGS & DISPLAY](#settings--display-processes) — P52–P55
- [ANALYTICS & SEO](#analytics--seo) — P56–P57
- [DEFERRED PROCESSES](#deferred-processes) — P-D1 to P-D8
- [ROLE PERMISSIONS MATRIX](#role-permissions-matrix)

---

## ONBOARDING & SIGN-UP

### P00 — New User Sign-Up

1. User clicks "Sign Up" or is redirected to sign-up after clicking "Get Started" as a guest
2. Clerk sign-up form shown with these required fields:
   - Email address
   - **"How would you like Lex to address you?"** (preferredName — defaults to first name, editable)
   - First name, Last name
   - Age confirmation checkbox: "I confirm I am 18 or over"
   - T&Cs checkbox: "I have read and agree to the Terms of Service"
   - Community rules checkbox: "I agree to the Community Rules and Scrutinise values"
3. User submits → Clerk sends magic link / verification email
4. On verification: Clerk fires UserCreated webhook
5. Backend creates User record in DB:
   - preferredName set from sign-up field (defaults to firstName if blank)
   - ageConfirmed = true
   - tcAgreedAt = now(), tcVersion = "1.0"
   - rulesAgreedAt = now()
   - role = CITIZEN
   - referralCode = crypto.randomUUID()
   - aiPreferredStyle = "COLLABORATIVE" (default)
6. User redirected to originating URL (never to homepage)

---

### P00b — Returning User Sign-In

1. User clicks "Log In"
2. Clerk sign-in flow (email + magic link or 2FA for ADMIN/SUPER_ADMIN)
3. On success: user redirected to originating URL (never to homepage)
4. User.lastActiveAt updated

---

## CORE IDEA PROCESSES

### P01 — Create an Idea

**Stage 1 — No upfront registration gate.** Lex is present before account creation.

1. User clicks "Create" or "Get Started" — no login required to reach this step
2. Lex chat interface opens immediately
3. **Exact Lex opening message:**
   > *"I'm Lex, your researcher and guide. What's the challenge you want to fix?"*
   - Cursor auto-focused in input field — no click required
   - No platform explanation before this message
4. User responds (however briefly)
5. Lex reacts specifically to what the user said, then asks:
   > *"Have you written anything about this before? If you have a paper, article, YouTube link or anything else that could give me some background, that would be really helpful."*
6. Lex guides conversation to populate: title, summaryDescription, govtArea, ideaType, diagnosis, guidingPolicy, coherentActions, proposedWording
7. Fields populated silently in background via JSON blocks in Lex responses
8. Progress indicator starts at 20% on first message sent. Advances: 30% (background answered), 45% (diagnosis), 60% (guidingPolicy), 75% (first CA), 90% (all core fields), 100% (user confirms)
9. Auto-save every 3 seconds of inactivity after first input
10. **Save prompt trigger:** When diagnosis + guidingPolicy + first coherentAction are populated → system surfaces: *"I've put together a first shape for your idea — want to save this so you can come back to it?"* → triggers Clerk sign-up (P00) if not already logged in

---

### P02 — Progress Idea: Stage 1 → Stage 2 (Create → Draft)

**Trigger: AUTOMATIC — server-side, no owner action required.**

Gate criteria:
- title non-empty AND summaryDescription non-empty

1. On every idea PATCH, `checkAndAdvanceStage()` runs server-side
2. When both gate fields are non-empty: stage updated to STAGE_2, StageTransition record created (triggeredBy = "AUTOMATIC")
3. Lex delivers Stage 2 welcome message on next AI call:
   > *"Good [morning/afternoon/evening], [preferredName]. Welcome to Scrutinise and congratulations on completing the first stage of your idea.*
   >
   > *You are now at the Draft stage and I'm here to help you develop your idea into the most credible proposal possible. By reaching this stage you've also unlocked the ability to bring a team of your own in to help you. Please think about who you know who could contribute the most insight and credibility to this. You can manage your team in the Groups section.*
   >
   > *[If user has collaborators on another idea:] You can also copy over a team from a previous idea if you'd like to.*
   >
   > *As a first step, can you tell me a little more about the challenge you're seeking to address — what is it you want to change, and why?"*
4. Team-building features unlocked and explained by Lex

---

### P03 — Progress Idea: Stage 2 → Stage 3 (Draft → Develop)

**Trigger:** Owner manually initiates.

Gate criteria:
- diagnosis non-empty
- guidingPolicy non-empty
- At least 1 CoherentAction record
- At least 3 Research records (increased from 1)
- If ideaType = LEGISLATION: at least 1 TargetLegislation record

1. Owner clicks "Take Public"
2. System validates gate criteria — shows checklist of missing items
3. **Warning modal shown:**
   > *"This makes your idea publicly accessible via a link. Anyone with the link can read and contribute. Are you ready for feedback from strangers?"*
4. If idea is in a Policy Development Group with veto enabled → StageTransitionRequest created (status=PENDING) → group admin notified → stage does NOT advance until approved
5. On pass (or group approval): stage=STAGE_3, visibility=LINK_ONLY, StageTransition record created
6. referralLinkActive set to true; referral link shown to owner
7. Collaborators notified
8. Idea NOT shown in browse or search
9. **Voting does not open at Stage 3**

---

### P04 — Progress Idea: Stage 3 → Stage 4 (Develop → Campaign)

**Trigger:** Owner manually initiates.

Gate criteria:
- ≥12 unique IdeaReview records (outcome = VIEWED, ENDORSED, or BELOW_STANDARD)
- Average quality rating ≥ 2.5 from those reviewers
- platformConfig.credibilityWeightingActive = false at launch (raw ratings used until switched on)

1. Owner receives notification when threshold crossed: "Your idea qualifies for Campaign status"
2. eligibleForNextStage set to true on Idea
3. Owner clicks "Begin Campaign"
4. On pass: stage=STAGE_4, visibility=PLATFORM_LISTED, StageTransition record created
5. **Vote widget becomes visible for the first time**
6. Idea appears in platform browse and search
7. All collaborators and subscribers notified

---

### P05 — Progress Idea: Stage 4 → Stage 5 (Campaign → Legislate)

**Trigger:** Owner manually initiates.

Gate criteria:
- ≥3 active MP Endorsement records (endorserRole = MP) — separate count
- ≥3 active Peer Endorsement records (endorserRole = PEER) — separate count, not combined with MPs
- At least 1 active DraftsmanEndorsement record
- All proposedWording fields complete and non-empty

1. Owner clicks "Submit to Parliament"
2. System validates gate criteria — shows checklist
3. On pass: stage=STAGE_5, StageTransition record created
4. Idea labelled "Legislate" on all surfaces
5. All voters, subscribers, endorsers notified
6. Admin alerted for parliamentary submission support

---

### P06 — Edit Idea (Stages 1 & 2)

1. Owner edits field directly or via Lex
2. proposedWording editable directly — no amendment process required at Stage 1 & 2
3. Auto-save every 3 seconds; manual save available
4. WordingHistory record created on every save where proposedWording changed

---

### P07 — Edit Idea Wording (Stage 3+, once any vote exists)

1. Owner attempts to edit proposedWording
2. System intercepts: wordingLocked = true → owner redirected to "Propose Amendment"
3. Strategic kernel fields (diagnosis, guidingPolicy, coherentActions) remain editable by owner at all stages

---

### P08 — Withdraw an Idea

1. Owner navigates to idea settings → "Withdraw Idea"
2. Confirmation: "Withdrawing archives this idea. It will no longer be publicly accessible."
3. On confirm: status=WITHDRAWN, visibility=PRIVATE
4. Voters and subscribers notified
5. Idea hidden from browse/search; accessible via direct link to owner only

---

## INVITATION & COLLABORATION PROCESSES

### P09 — Invite a Collaborator (Stage 2+)

1. Owner navigates to idea → Team tab → "Invite Collaborator"
2. Enters email address, selects role (EDITOR or VIEWER), optionally adds message
3. System checks EmailSuppression — if suppressed, show message: "This address has previously opted out of Scrutinise emails. You can still share the idea link with them directly."
4. UserInvite record created with magicLinkToken (crypto.randomUUID())
5. Email sent via Resend: "[Owner name] has invited you to collaborate on [idea title]"
6. Link: `/invite/[token]`

---

### P10 — Accept a Collaboration Invite

1. Recipient clicks magic link
2. If not registered: Clerk sign-up flow (P00) runs; on completion, returns to magic link destination
3. If already registered: Clerk sign-in if not logged in
4. IdeaCollaborator record created; invite status=ACCEPTED
5. Recipient sees the idea at Stage 2 (LINK_ONLY visibility applied)

---

### P11 — Remove a Collaborator

1. Owner navigates to Team tab → clicks remove next to collaborator
2. Confirmation shown
3. IdeaCollaborator record deleted
4. User loses access to the idea

---

### P12 — Invite to a Group

1. Group owner/admin navigates to Group → Members → "Invite"
2. Enters email or generates public invite link (if group type = COMMUNICATIONS or POLICY_DEVELOPMENT)
3. GroupInvite record created
4. Email sent or link shared

---

### P13 — Owner Broadcast to All Voters

Rate-limited to 1 broadcast per idea per 7 days.

1. Owner navigates to idea → Voters tab → "Send Message to All Voters"
2. Compose (subject + body, max 500 words)
3. Warning: "This will send a notification to [N] voters. Use sparingly."
4. System checks EmailSuppression for each recipient
5. In-app notification + email sent to all active voters
6. BroadcastMessage record created

---

## VOTING PROCESSES

### P14 — Vote for an Idea

**Voting is available only at Stage 4+. Vote widget is hidden at Stages 1, 2, 3.**

1. User arrives at idea page (Stage 4 or 5 only — otherwise no vote widget shown)
2. If not logged in: vote button triggers email capture modal → signup → redirect back
3. If logged in but not email-verified: prompted to verify first
4. User selects direction: FOR / AGAINST / UNDECIDED
5. User sets strength/certainty slider (0–5 in 0.5 increments)
6. User optionally ticks quality flags
7. Vote submitted; Strategist points awarded to owner regardless of direction
8. passionScore and voteDistribution recalculated
9. wordingLocked set to true on first vote received
10. ReferralEvent created if arrived via referral link

---

### P14b — Withdraw a Vote

1. User navigates to idea → clicks "Withdraw vote"
2. Confirmation shown
3. Vote record: withdrawn=true; Strategist points reversed from owner
4. passionScore recalculated

---

## AMENDMENT PROCESSES

### P15 — Propose an Amendment

Available at Stage 3+.

1. User navigates to idea → Amendments tab → "Propose Amendment"
2. Selects contribution type: AMENDMENT
3. Completes form: proposed text change (diff view), rationale (required), supporting research URLs (optional)
4. Submit → Amendment record created, status=PENDING
5. Owner notified
6. Amendment visible to all users in Amendments tab

---

### P16 — Vote on an Amendment

1. User navigates to idea → Amendments tab
2. Selects amendment → reviews text, rationale, diff view
3. Casts vote: SUPPORT / OPPOSE / ABSTAIN
4. AmendmentVote record created; running tally shown

---

### P17 — Owner Reviews Amendment

100% owner's decision. Owner chooses one of five actions:

**Action buttons with help text shown to owner:**

1. **Accept (Mode B — Binding):** → P18
2. **Consult First (Mode A — Advisory):** *"Click to send this amendment out to all those who have voted on your idea so far, for their opinion"* → P19
3. **Request Revision:** *"Send back to the proposer with your suggestion for a compromise wording"* — Owner enters guidance → status=REVISION_REQUESTED → proposer notified with guidance
4. **Counter-Propose:** → P20
5. **Reject:** Owner enters rejection reason → status=REJECTED → proposer notified

---

### P18 — Accept Amendment (Mode B — Binding)

Warning shown when skipping Mode A: "Accepting without consultation may cause voters to withdraw."

1. Owner clicks "Accept Amendment"
2. Warning modal: "This will update the idea wording and notify [N] voters, who may withdraw within 14 days."
3. On confirm:
   - Amendment status=ACCEPTED, mergedAt set
   - proposedWording updated
   - WordingHistory record created
   - All voters notified (notification deepLinkTab = "amendments")
   - 14-day withdrawal window opens; pendingPort=true on all Vote records
   - 7-day cooling-off for Thinker points
4. After 7 days: +150 Thinker points to amendment author
5. After 14 days: withdrawal window closes; PointsLedger finalised

---

### P19 — Circulate Amendment for Consultation (Mode A — Advisory)

1. Owner clicks "Consult First"
2. System sends notification to all current voters: advisory poll (SUPPORT / OPPOSE / NO_OPINION)
3. Voters see: current wording | proposed wording | diff | rationale
4. Owner sees live tally
5. No wording change. No points change.
6. Owner then decides: Accept (→ P18), Request Revision (→ P17), or Reject (→ P17)
7. ConsultationVote records created

---

### P20 — Counter-Propose an Amendment

Owner disagrees with the proposed text but wants to offer an alternative.

1. Owner clicks "Counter-Propose"
2. Owner writes alternative wording with rationale
3. New Amendment record created: isCounterProposal = true, parentAmendmentId = original.id
4. Original proposer notified: "The owner has proposed an alternative wording to your amendment"
5. Both versions shown side by side in Amendments tab
6. Original proposer can:
   - Accept the counter → triggers P18 with counter text
   - Reject → reverts both to original status
   - Propose further revision → new cycle
7. Credibility points awarded based on final resolution

---

## CONTRIBUTION PROCESSES

*"Contributions" is the UI label. Database field name remains "comment".*

### P21 — Make a Contribution

Available at Stage 3+.

1. User navigates to idea → Contributions tab
2. Clicks "Add Contribution"
3. **Selects contribution type:**
   - **New Information** — case study, research, facts
   - **Red Team Challenge** — challenge to diagnosis, causes, policy, or actions. Must target one strike zone: Edge Case, Semantic Trap, Fiscal Sinkhole, or Incentive Inversion.
   - **Minor Adjustment Suggestion** — refinement to existing content
   - **Additional Coherent Action Suggestion** — proposed new step
   - **Amendment** — routes to P15
   - **Other**
4. Lex guidance shown: *"One point per contribution — if you have multiple points, please make them as separate contributions so each can be rated independently."*
5. Sets stance: SUPPORTIVE / CRITICAL / NEUTRAL / QUESTION
6. Contribution submitted; Comment record created with contributionType set
7. commentNumber assigned (sequential per idea)
8. Idea owner notified
9. Displayed in Contributions tab; first 10 shown as snippets ranked by quality rating DESC then author credibilityScore DESC

---

### P22 — Owner Replies to a Contribution

1. Owner clicks "Reply" on a contribution (button visible to owner only)
2. Writes reply — displayed indented under the original
3. Comment record created with parentId = original, isOwnerReply = true
4. Original contributor notified

---

### P23 — Rate a Contribution

1. User selects a contribution to rate
2. Checks positive boxes: constructive, insightful, relevant, fresh perspective, balanced, helpful facts, direct experience, good question
3. Checks negative boxes (logical fallacy flags): ad hominem, straw man, red herring, false dilemma, slippery slope, moving goalposts, motte-bailey, tu quoque, cherry picking, not relevant
4. Optionally adds note
5. CommentRating record created
6. Thinker points awarded/deducted to contribution author per System Mechanics

---

### P24 — Group Contributions

1. Contributor optionally clicks "Group with contribution [N]" when submitting
2. groupedWithCommentId set on new contribution record
3. Grouped contributions displayed collapsed in Contributions tab: "X more contributions on this issue"
4. "Show more contributions on this issue" button expands group

---

### P25 — Flag / Report Content

1. User clicks "Report" on idea, contribution, or amendment
2. Selects reason: spam / harmful / off-topic / misinformation / abusive / other
3. ContentReport record created; content remains visible
4. If threshold reached: content auto-hidden pending review
5. Moderator notified (admin dashboard queue)
6. Moderator reviews: dismiss / hide / remove / warn user
7. Reporter and content owner notified of outcome

---

## RESEARCH PROCESSES

### P26 — Add Research to an Idea

Available to: owner + editors at Stage 2+; all users at Stage 3+.

1. User navigates to idea → Research tab → "Add Research"
2. Completes form:
   - Title, snippet, relevance explanation, summary
   - Source URL (validated + Google Safe Browsing)
   - **Research type:** EVIDENCE / CASE_STUDY / CAUSES / PERSPECTIVES / OTHER (Enum — not free text)
   - Source type: academic / government / news / case study / legislation / other
   - For/Against policy, For/Against action (boolean)
3. Research record created
4. If sourceType = ACADEMIC: Lex runs citation check against retraction databases. If retracted: record flagged, contributor notified, Thinker points held pending review.
5. Owner notified if added by non-owner

---

### P27 — Attach File to Idea

1. User clicks "Attach File"
2. File uploaded → ClamAV scan → if clean, stored in Cloudflare R2
3. Attachment record created with R2 key
4. Served via 24hr signed URL

---

## ENDORSEMENT PROCESSES

### P28 — Claim MP / Peer Status

1. User navigates to Settings → "Claim Parliamentary Status"
2. Selects role: MP or Peer
3. Enters constituency (MP) or peerage title (Peer)
4. Submits Parliament.uk profile URL
5. UserParliamentaryVerification record created (status=PENDING); admin alerted
6. Admin verifies manually
7. On approval: User.parliamentary_verified = true, User.parliamentary_status = MP/PEER

---

### P29 — Claim Professional Status (Parliamentary Draftsman)

1. User navigates to Settings → "Claim Professional Status"
2. Enters firm/chambers, credentials, licence number
3. Uploads supporting document (PDF — virus scanned, stored in R2)
4. UserProfessionalVerification record created (status=PENDING); admin alerted
5. On approval: User.professional_verified = true

---

### P30 — Give Parliamentary Endorsement

Available to verified MPs and Peers only.

1. MP/Peer navigates to idea page
2. IdeaReview record created (outcome=VIEWED)
3. Clicks "Endorse this Idea"
4. Optionally adds public statement
5. Endorsement record created (status=ACTIVE, endorserRole=MP or PEER)
6. Owner notified; endorsementCount incremented
7. Credibility Score of owner updated (High weight)
8. Stage 4→5 eligibility checked: ≥3 MP AND ≥3 Peer endorsements required separately

---

### P31 — Mark Idea Below Standard

Available to verified MPs, Peers, and users with manualCredibilityOverride set.

1. Reviewer views idea
2. Clicks "Reviewed — Below Standard" button (visible only to qualified reviewers)
3. IdeaReview record created (outcome=BELOW_STANDARD)
4. Small credibility decay applied to idea's displayed quality rating
5. Owner not notified directly — visible in idea quality metrics

---

### P32 — Give Parliamentary Draftsman Endorsement

Available to verified Parliamentary Draftsmen only.

1. Draftsman navigates to Stage 4+ idea
2. Clicks "Certify for Parliamentary Submission"
3. Enters public statement and credentials
4. DraftsmanEndorsement record created (status=ACTIVE)
5. Owner notified; Stage 4→5 eligibility updated

---

## MERGE PROCESSES

### P33 — Propose a Merge

1. Owner navigates to their idea → "Propose Merge" → searches for other idea
2. Both ideas must have ≥5 votes; owner has not exceeded 3 merge proposals this month
3. Proposal message written
4. MergedIdea record created (status=PROPOSED)
5. Target idea owner notified; MessageThread auto-created

---

### P34 — Negotiate a Merge

1. 30-day window for negotiation via MessageThread
2. Counter-proposal: flip ownership direction
3. Both parties notified at 7 days remaining
4. Owner-consensual only — no platform override

---

### P35 — Execute a Merge

1. Target owner accepts proposal
2. MergedIdea status=ACCEPTED
3. 14-day voter withdrawal window for absorbed idea's voters
4. After 14 days: votes ported; Rallymaster points to absorbed owner; Strategist points to surviving owner

---

## ACCOUNT & PROFILE PROCESSES

### P36 — Edit Profile

1. User navigates to Settings → Account
2. Editable fields: displayName, preferredName, username (once), bio, expertType, politicalParty (legacy), businessOrOrganisation, country
3. Saves → User record updated

---

### P37 — Add Party Membership

1. User navigates to Settings → Political Alignment
2. Clicks "+" to add party membership
3. Enters party name, membership number (optional), member since (optional)
4. Selects isPrimary (only one can be primary)
5. PartyMembership record created

---

### P38 — Set Political Spectrum

1. User navigates to Settings → Political Alignment
2. Message shown: "If you fill this in, the information remains private but allows you to earn bonus points for contributing to ideas from different political backgrounds."
3. User positions themselves on the two-axis grid (Left/Right × Nation State/Globalist)
4. politicalSpectrumX and politicalSpectrumY saved to User record
5. Never shown publicly — used only for cross-spectrum bonus calculations

---

### P39 — Set Lex AI Mode

1. User navigates to Settings → Lex AI
2. Three options shown with descriptions:
   - **Collaborative (default):** *"Lex will work through each step with you and contribute text suggestions where you are unsure what you want to write. For most users."*
   - **Socratic:** *"Lex will ask you questions to inspire you in ways to improve and strengthen your idea but will leave you in total control of the wording. For experts."*
   - **Direct:** *"Lex will give you the answer, prepare the draft, and prepare the research based on your direction and approvals."*
3. Selection saved to User.aiPreferredStyle
4. Applied to all subsequent Lex API calls via {{lexMode}} context variable

---

### P40 — Account Deletion

1. User navigates to Settings → "Delete my account"
2. Confirmation: 30-day grace period explained
3. User.status = DELETION_PENDING; all emails stop immediately
4. After 30 days: personal data deleted; contributions anonymised ("Deleted User")
5. Email added to EmailSuppression (reason=ACCOUNT_DELETED)

---

### P41 — Data Export

1. User navigates to Settings → "Download my data"
2. System compiles all user data → JSON → R2 → signed URL (7-day expiry)
3. Email sent with download link
4. Target delivery: 72 hours; legal max: 30 days

---

### P42 — Email Unsubscribe

1. User clicks one-click unsubscribe link in any email
2. Email added to EmailSuppression immediately
3. Account remains active; no further emails
4. Can re-subscribe via Settings

---

### P43 — Consent Restoration

When a suppressed address receives an invitation:

1. Special consent restoration page shown: "You previously asked not to be contacted by Scrutinise. Clicking this link will remove you from that suppression list. You are under no obligation to do so."
2. User must actively click to restore consent

---

## AI ASSISTANCE

### P44 — Lex Conversation

1. User is in idea creation/editing context (Stage 1 or 2) or contribution context (Stage 3+)
2. User sends message to Lex
3. Backend constructs context: system prompt + aiChatSummary + last 20 messages + {{preferredName}} + {{lexMode}} + {{currentStage}} + {{completedFieldsSummary}}
4. API call to Gemini 2.5 Flash (primary) or Grok 4.1 Fast (fallback)
5. Response returned; `fieldUpdates` JSON block stripped server-side before client receives response
6. fieldUpdates applied to Idea record in DB
7. AIUsageLog record created; aiCreditBalance decremented
8. If triggerSavePrompt=true in response: frontend surfaces save prompt → Clerk sign-up if needed
9. If Stage 1→2 gate now met after field updates: `checkAndAdvanceStage()` fires automatically

---

## ADMIN & MODERATION PROCESSES

### P45 — Admin Accesses a User's Idea (Privacy Log)

1. Admin navigates to a user's idea via admin panel
2. **Reason dropdown shown before idea loads:** Content moderation review / User support request / Legal compliance / Technical audit
3. Admin selects reason and confirms
4. ActivityLog record created: accessType=ADMIN_ACCESS, accessReason=[selected], accessedByUserId=[admin]
5. Idea loads normally
6. Idea owner can see this in their Privacy Log tab

---

### P46 — Moderate Content

1. Admin/Moderator views flagged content queue
2. Reviews ContentReport with context
3. Selects action: dismiss / hide / remove / warn user / suspend user
4. ContentReport status updated; moderationAction recorded
5. Reporter and content owner notified

---

### P47 — Invite a Moderator

1. When a user's credibilityScore reaches 500, Admin dashboard shows alert: "[User] has reached the credibility threshold for Moderator invitation."
2. Admin clicks "Send Moderator Invitation"
3. User receives in-app notification and email with Accept/Decline buttons
4. Accept button remains live until user deletes the alert
5. On accept: User.role = MODERATOR

---

### P48 — SuperAdmin Platform Config

1. SuperAdmin navigates to Admin → Platform Config
2. Toggles platform-wide settings (PlatformConfig records):
   - credibilityWeightingActive (off by default, activates when platform has sufficient Phase 2 users)
   - peerReviewRequired (off by default)
   - minReviewersForStage4 (default 12)
   - minRatingForStage4 (default 2.5)
3. Changes take effect immediately; updatedByUserId and updatedAt recorded

---

## DISCOVERY & SEARCH PROCESSES

### P49 — Browse Ideas

1. User navigates to Browse (Stage 4+ ideas only — PLATFORM_LISTED)
2. Filters available: govtArea, stage, country, sortBy (newest, most votes, passion score)
3. Results shown as idea cards with stage badge, vote counts, passion score, summaryDescription
4. Search box auto-focused on page load

---

### P50 — Search Ideas

1. User types in search box (cursor auto-focused)
2. Full-text search against searchVector field
3. Stage 4+ ideas only in public search
4. Results ranked by relevance then vote count

---

### P51 — Referral Link Access (Stage 3+)

1. User clicks referral link `/idea/[id]?ref=[code]`
2. Referral attribution stored (server session > localStorage > cookie)
3. Idea detail page shown (Stage 3 link-only: full content but not in browse)
4. IdeaReview record created (outcome=VIEWED) — counts toward Stage 3→4 gate
5. Vote widget shown only if idea is Stage 4+

---

## SETTINGS & DISPLAY PROCESSES

### P52 — Notification Settings

1. User navigates to Settings → Notifications
2. Per-type toggles + global email toggle
3. Preferences saved to User record

---

### P53 — Amendment Notification Click

1. User receives amendment notification (in-app or email)
2. Clicks notification
3. **Routes to the Amendments tab of the specific idea** (deepLinkTab = "amendments")
4. NOT to the generic notifications page

---

### P54 — Privacy Log View

1. Idea owner navigates to idea detail → Privacy Log tab (owner-only tab)
2. All ActivityLog records for this idea shown chronologically
3. **Green banner:** "No Scrutinise team members have accessed this idea." (if no ADMIN_ACCESS records)
4. **Amber banner with detail:** "[First Name I.] accessed this idea on [date]. Reason: [reason]." (if ADMIN_ACCESS records exist)

---

### P55 — Owner Thank You Badge

1. Owner navigates to a contribution on their idea
2. Clicks "Send Thank You"
3. Optionally adds a personal note
4. OwnerThanks record created
5. Recipient notified: "[Owner name] has sent a Thank You for your contribution to '[Idea title]'"
6. Badge count shown on recipient's profile (thanksReceived on Reputation entity)

---

## ANALYTICS & SEO

### P56 — GA4 Event Tracking

Custom events fired: idea_created, idea_stage_changed, vote_cast, amendment_proposed, user_registered, referral_link_clicked, endorsement_given.

### P57 — SEO for Public Ideas

Stage 3+ ideas: unique meta title/description, Open Graph, Twitter Card, Schema.org Article, canonical tags. sitemap.xml for Stage 4+ ideas. robots.txt: allow Stage 3+, disallow Stage 1/2.

---

## DEFERRED PROCESSES

| Process | Notes |
|---------|-------|
| P-D1 | Address book import (Google Contacts/Outlook OAuth) |
| P-D2 | Vector search / AI recommendation engine |
| P-D3 | WhatsApp group sync |
| P-D4 | Fundraising (Stripe Connect) |
| P-D5 | SMS verification (Twilio) |
| P-D6 | Parliament Members API (automated MP verification) |
| P-D7 | Offline mode (Dexie.js + service worker) |
| P-D8 | Bring-your-own API key (UserAIKey entity) |
| P-D9 | Campaign in a Box / GeneratedOutput templates |
| P-D10 | Site-wide Lex panel (beyond idea creation context) |
| P-D11 | Voice dictation UI (Web Speech API) — see UX_and_voice_build_notes.md |

---

## ROLE PERMISSIONS MATRIX

| Action | CITIZEN | MODERATOR | ADMIN | SUPER_ADMIN |
|--------|---------|-----------|-------|-------------|
| Create idea | ✅ | ✅ | ✅ | ✅ |
| Vote (Stage 4+) | ✅ | ✅ | ✅ | ✅ |
| Make contribution | ✅ | ✅ | ✅ | ✅ |
| Propose amendment | ✅ | ✅ | ✅ | ✅ |
| Hide content (pending review) | ❌ | ✅ | ✅ | ✅ |
| Remove content | ❌ | ❌ | ✅ | ✅ |
| Suspend user | ❌ | ❌ | ✅ | ✅ |
| Change idea stage (override) | ❌ | ❌ | ✅ | ✅ |
| View admin dashboard | ❌ | Limited | ✅ | ✅ |
| Change platform config | ❌ | ❌ | ❌ | ✅ |
| Promote/demote roles | ❌ | ❌ | ✅ (up to ADMIN) | ✅ |
| Set manualCredibilityOverride | ❌ | ❌ | ❌ | ✅ |
| Access Privacy Log of any idea | ✅ (own ideas) | ✅ (own ideas) | ✅ (logged) | ✅ (logged) |

---

*process_list_v2.md — Scrutinise — 22 March 2026 v2.1*
*Reconciled against entity_list_v4.1 and system_mechanics_v0.7*
