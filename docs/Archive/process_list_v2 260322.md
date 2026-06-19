# SCRUTINISE — PROCESS LIST v2.0
*All platform processes with step-by-step flows.*
*Source: Process_List_v2.docx — reconciled against Entity List v3 and System Mechanics v0.6*
*Last updated: March 2026*

---

## CONTENTS

- [CORE IDEA PROCESSES](#core-idea-processes) — P01–P08
- [INVITATION & COLLABORATION](#invitation--collaboration-processes) — P09–P13
- [VOTING PROCESSES](#voting-processes) — P14–P14b
- [AMENDMENT PROCESSES](#amendment-processes) — P15–P19
- [COMMENT PROCESSES](#comment-processes) — P20–P23
- [RESEARCH PROCESSES](#research-processes) — P24–P25
- [ENDORSEMENT PROCESSES](#endorsement-processes) — P26–P30
- [MERGE PROCESSES](#merge-processes) — P31–P33
- [ACCOUNT & PROFILE PROCESSES](#account--profile-processes) — P34–P41
- [AI ASSISTANCE](#ai-assistance) — P42
- [ADMIN & MODERATION](#admin--moderation-processes) — P43–P46
- [DISCOVERY & SEARCH](#discovery--search-processes) — P47–P49
- [SETTINGS & DISPLAY](#settings--display-processes) — P50–P53
- [ANALYTICS & SEO](#analytics--seo) — P54–P55
- [DEFERRED PROCESSES](#deferred-processes) — P-D1 to P-D8
- [ROLE PERMISSIONS MATRIX](#role-permissions-matrix)

---

## CORE IDEA PROCESSES

### P01 — Create an Idea

1. User clicks "New Idea" from dashboard or nav
2. System creates Idea record: status=draft, stage=STAGE_1, visibility=PRIVATE
3. Owner lands on idea editor — Lex chat interface open (not a form)
4. Lex opens with: "Let's start with the thing that's bothering you. In your own words — what's broken, and why does it matter to you?"
5. Lex guides conversation to populate: title, summaryDescription, govtArea, ideaType, diagnosis, guidingPolicy, coherentActions, proposedWording
6. Fields populated silently in background via JSON blocks in Lex responses
7. Auto-save every 30 seconds
8. Stage 1 gate indicator shown: "Complete Basic Info to invite collaborators"

---

### P02 — Progress Idea: Stage 1 → Stage 2 (Create → Draft)

**Trigger:** Owner manually initiates. System checks gate criteria.

**Gate criteria:**
- title non-empty
- summaryDescription non-empty

1. Owner clicks "Invite Collaborators" or "Progress to Stage 2"
2. System validates gate criteria — shows inline errors if not met
3. On pass: stage updated to STAGE_2, StageTransition record created
4. Owner prompted to invite first collaborators (can skip)
5. No notifications (no subscribers yet)
6. Lex prompt updates: "Here's what would strengthen your idea before going wider..."

---

### P03 — Progress Idea: Stage 2 → Stage 3 (Draft → Develop)

**Trigger:** Owner manually initiates. System checks gate criteria.

**Gate criteria:**
- diagnosis non-empty
- guidingPolicy non-empty
- At least 1 CoherentAction record
- If ideaType = LEGISLATION: at least 1 TargetLegislation record
- At least 1 Research record

1. Owner clicks "Open to Wider Audience" or "Progress to Stage 3"
2. System validates gate criteria — shows checklist of missing items
3. On pass: stage=STAGE_3, visibility=LINK_ONLY, StageTransition record created
4. referralLinkActive set to true; referral link activated and shown to owner
5. Voters and collaborators notified
6. Lex prompt: "Your idea is now publicly accessible. Here's how to promote it effectively..."
7. Idea labelled "Developing" on all public-facing surfaces
8. Idea NOT shown in browse or search

---

### P04 — Progress Idea: Stage 3 → Stage 4 (Develop → Campaign)

**Trigger:** Owner manually initiates. System checks gate criteria.

**Gate criteria:**
- Minimum 25 votes

1. Owner receives notification when 25-vote threshold crossed: "Your idea qualifies for Active status"
2. eligibleForNextStage set to true on Idea
3. Owner clicks "Make Active on Platform"
4. System updates stage=STAGE_4, visibility=PLATFORM_LISTED, StageTransition record created
5. Idea now appears in platform browse and search
6. Label changes from "Developing" to "Campaign"
7. All voters and subscribers notified

---

### P05 — Progress Idea: Stage 4 → Stage 5 (Campaign → Parliament)

**Trigger:** Owner manually initiates. System checks gate criteria.

**Gate criteria:**
- Minimum 3 active Endorsement records (parliamentary_status = MP or PEER)
- At least 1 active DraftsmanEndorsement record
- All proposedWording fields complete and non-empty

1. Owner clicks "Submit for Parliamentary Process"
2. System validates gate criteria — shows checklist
3. On pass: stage=STAGE_5, StageTransition record created
4. Idea labelled "Parliamentary Ready"
5. All voters, subscribers, endorsers notified
6. Admin alerted for parliamentary submission support

---

### P06 — Edit Idea (Stages 1 & 2)

1. Owner opens any field in the idea editor or via Lex
2. proposedWording editable directly — no amendment process required at Stage 1 & 2
3. All strategic kernel fields (diagnosis, guidingPolicy, coherentActions) editable
4. Auto-save every 30 seconds; manual save available
5. WordingHistory record created on every save where proposedWording has changed
6. No voter notifications (no public access yet)

---

### P07 — Edit Idea Wording (Stage 3+, once any vote exists)

Once an idea has received at least 1 vote, proposedWording is locked for direct editing. wordingLocked=true on Idea record.

1. Owner attempts to edit proposedWording directly
2. System intercepts — shows: "This idea has votes. Wording changes must go through the amendment process to notify voters."
3. Owner directed to "Propose Amendment" flow (P15)
4. Non-wording fields (research, evidence, diagnosis detail) remain directly editable

---

### P08 — Archive an Idea

Owner only. Idea leaves active platform but is preserved.

1. Owner clicks "Archive Idea" in idea settings
2. Confirmation modal: "Archived ideas are hidden from the platform but your history is preserved. Voters are notified."
3. On confirm: status=ARCHIVED, visibility=PRIVATE
4. All voters notified: "An idea you voted for has been archived by its owner"
5. Idea removed from browse/search; direct URL shows "This idea has been archived"

---

## INVITATION & COLLABORATION PROCESSES

### P09 — Invite Individual Collaborator (Stage 2)

1. Owner navigates to idea → Collaborators tab → "Invite Someone"
2. Owner enters: first name, last name, email, phone (optional), role (Editor / Viewer)
3. Owner may customise invitation message (defaults provided below)
4. System checks if email already exists as a user:
   - Existing user: in-app notification + email with link; no signup required
   - New user: UserInvite record created; personalised email with magic link sent
5. Magic link click: verifies email + creates account + grants IdeaCollaborator access
6. IdeaCollaborator record created: ideaId, userId, role, invitedAt
7. Invitee lands on idea with editor/viewer access

**Check before sending:** If email is in EmailSuppression table, show consent restoration notice (see P40).

**Default invitation message (Editor):**
"Dear [Firstname], I've created an Idea on Scrutinise and would like your help to improve it. Would you be willing to work with me on this? If you would, please sign up so I can make you an editor."

**Default invitation message (Vote invite, Stage 3+):**
"Dear [Firstname], I've created an Idea on Scrutinise and would like your support by voting for it, and/or suggesting improvements. Would you be willing to help me promote this?"

---

### P10 — Create a Group & Invite Members

1. Owner navigates to Profile → Groups → "Create Group"
2. Enter: group name, description, group type (Collaborators / Supporters / Public)
3. Add members: enter email addresses individually or import (P11)
4. For each new email: same invitation flow as P09
5. Group created; GroupMember records created for each accepted invite
6. Owner can associate group with an idea via idea → Collaborators tab → "Add Group"
7. Group members inherit access level based on Group Type and idea stage

---

### P11 — Address Book Import

**DEFERRED to Sprint 2 — see P-D1**

---

### P12 — Accept an Invitation

1. Invitee receives email with personalised magic link
2. Click opens landing page:
   - New user: brief "What is Scrutinise?" + account creation form (pre-filled from invite)
   - Existing user: "You've been invited to [Idea/Group]" + one-click accept
   - Previously unsubscribed: consent restoration notice (see P40)
3. On account creation or accept: email verified, IdeaCollaborator / GroupMember record created
4. User redirected to the idea or group they were invited to

---

### P13 — Owner Broadcast to All Voters

Owner can send a message to all users who have voted on their idea. Rate-limited to 1 broadcast per idea per 7 days.

1. Owner navigates to idea → Voters tab → "Send Message to All Voters"
2. Compose message (subject + body, max 500 words)
3. Warning shown: "This will send a notification to [N] voters. Use sparingly."
4. System checks EmailSuppression for each recipient before sending
5. System sends in-app notification + email to all active voters
6. BroadcastMessage record created
7. Recipients can reply via DM to owner only (no reply-all)

---

## VOTING PROCESSES

### P14 — Vote for an Idea

1. User arrives at idea page (via browse, search, or referral link)
2. If not logged in: vote button triggers email capture modal
   - Enter email → offered full signup → on completion, redirected back to vote
   - Referral attribution preserved throughout (cookie/localStorage)
3. If logged in but not email-verified: prompted to verify email first
4. User selects direction: FOR / AGAINST / UNDECIDED
5. User sets strength/certainty slider (0–5 in 0.5 increments)
   - Contextual label shown based on direction chosen
6. User optionally ticks quality flags: "It doesn't go far enough" / "It goes too far" / "It's poorly worded"
7. Vote submitted; Vote record created; Strategist points awarded to owner (regardless of direction)
8. passionScore and voteDistribution recalculated on Idea record
9. If arrived via referral link: ReferralEvent record created; Rallymaster points queued (30-day qualification)
10. User sees confirmation; vote direction displayed on idea (public); passion score updated
11. If wordingLocked=false: wordingLocked set to true (first vote received)
12. If idea is Stage 3 with <25 votes: progress indicator shown ("X more votes to reach Campaign status")

---

### P14b — Withdraw a Vote

1. User navigates to idea they have voted on (via dashboard or idea page)
2. Clicks "Withdraw vote"
3. Confirmation: "Withdrawing your vote cannot be undone without re-voting"
4. Vote record: withdrawn=true; Strategist points reversed from owner
5. If vote was within a merge port window: pendingPort set to false

---

## AMENDMENT PROCESSES

### P15 — Propose an Amendment

Available to any user at Stage 3+.

1. User navigates to idea → Amendments tab → "Propose Amendment"
2. Complete amendment form:
   - Proposed text change (with diff view showing current vs proposed)
   - Rationale (why this change improves the idea — required)
   - Supporting research URLs (optional)
   - Relevant legislation (optional)
3. Submit → Amendment record created, status=PENDING
4. Owner notified (in-app + email): "New amendment proposed for your idea"
5. Amendment visible to all users on Amendments tab
6. Other users can vote on the amendment (P16)
7. Owner reviews and takes action (P17)

---

### P16 — Vote on an Amendment

1. User navigates to idea → Amendments tab
2. Browse or filter amendments (pending, accepted, rejected, consulting)
3. Select amendment → review text, rationale, research, diff view
4. Cast vote: SUPPORT / OPPOSE / ABSTAIN
5. AmendmentVote record created
6. Running tally shown on amendment card

---

### P17 — Owner Reviews Amendment

100% owner's decision — no platform override.

1. Owner receives notification of new amendment
2. Owner navigates to Amendments tab → reviews proposed text, rationale, vote tally
3. Owner chooses action:
   - **Accept (Mode B — binding):** See P18
   - **Circulate for consultation (Mode A — advisory):** See P19
   - **Reject:** Owner enters rejection reason → status=REJECTED → proposer notified
   - **Request revision:** Owner enters guidance → status=REVISION_REQUESTED → proposer notified

---

### P18 — Accept Amendment (Mode B — Binding)

Warning shown to owner when skipping Mode A:
"Accepting this amendment without consultation may cause voters to withdraw. Consider circulating for consultation first."

1. Owner clicks "Accept Amendment"
2. Warning modal: "This will update the idea wording and notify [N] voters, who may withdraw their vote within 14 days. This action cannot be undone."
3. On confirm:
   - Amendment status=ACCEPTED, mergedAt timestamp set
   - proposedWording updated with amendment text
   - WordingHistory record created (changeType=AMENDMENT_ACCEPTED, amendmentId linked)
   - All voters notified: "The wording of an idea you voted for has changed. Review and decide if you wish to withdraw your vote."
   - 14-day withdrawal window opens; pendingPort=true on all Vote records
   - 7-day cooling-off begins for Thinker points bonus
4. After 7-day cooling-off: +150 Thinker points awarded to amendment author
5. After 14-day window: withdrawal window closes; PointsLedger records finalised

---

### P19 — Circulate Amendment for Consultation (Mode A — Advisory)

Owner shares proposed amendment with voters to gauge support before committing.

1. Owner clicks "Circulate for Consultation"
2. System sends notification to all current voters:
   "Would you support the following amendment to an idea you've voted for?" (shows: current wording | proposed wording | diff | rationale)
3. Voters respond: SUPPORT / OPPOSE / NO_OPINION (does not change their idea vote)
4. Owner sees live result tally: "47 support / 12 oppose / 8 no opinion"
5. No wording change. No withdrawal window. No points change.
6. Owner then decides: Accept (→ P18), Reject (→ P17), or modify and re-circulate
7. ConsultationVote records created (advisory only, separate from AmendmentVote)

---

## COMMENT PROCESSES

### P20 — Make a Comment

1. User navigates to idea → Comments tab
2. Clicks "Add Comment"
3. Writes comment (rich text, DOMPurify sanitised on save)
4. Sets stance: SUPPORTIVE / CRITICAL / NEUTRAL / QUESTION
5. Comment submitted; Comment record created
6. Idea owner notified
7. Comments are flat — no threading between users (owner replies only)

---

### P21 — Owner Replies to a Comment

1. Owner navigates to comment on their idea
2. Clicks "Reply" (this button only visible to idea owner)
3. Writes reply — displayed indented under the original comment
4. Comment record created with parentId pointing to original, isOwnerReply=true
5. Original commenter notified

---

### P22 — Rate a Comment

1. User navigates to Comments tab
2. Selects comment to rate
3. Checks positive boxes: constructive, insightful, relevant, fresh perspective, balanced, helpful facts, direct experience, good question
4. Checks negative boxes (logical fallacy flags): ad hominem, straw man, red herring, false dilemma, slippery slope, moving goalposts, motte-bailey, tu quoque, cherry picking, not relevant
5. Optionally adds note explaining rating
6. CommentRating record created
7. Thinker points awarded/deducted from comment author per System Mechanics Section 3

---

### P23 — Flag / Report Content

1. User clicks "Report" on idea, comment, or amendment
2. Selects reason: spam / harmful / off-topic / misinformation / abusive / other
3. Optional description added
4. ContentReport record created; content remains visible
5. If threshold of reports reached (configurable): content auto-hidden pending review
6. Moderator notified (admin dashboard queue)
7. Moderator reviews: dismiss / hide / remove / warn user (per role permissions)
8. Reporter and content owner notified of outcome

---

## RESEARCH PROCESSES

### P24 — Add Research to an Idea

Available to: owner + editors at Stage 2+; all users at Stage 3+.

1. User navigates to idea → Research tab → "Add Research"
2. Completes form:
   - Title, snippet, relevance explanation, summary of content
   - Source URL (validated + Google Safe Browsing check)
   - Source type: academic paper / government report / news article / case study / legislation / other
   - For/Against policy (boolean)
   - For/Against action (boolean)
   - Constructive score (self-assessed 1–5)
3. Research record created; linked to idea
4. Owner notified if added by non-owner

---

### P25 — Attach File to Idea

PDFs (max 10MB) or images (max 5MB, JPEG/PNG/WebP).

1. User clicks "Attach File" in Research or Idea tabs
2. File picker opens; user selects file
3. File uploaded to API route → ClamAV virus scan → if clean, stored in Cloudflare R2
4. Attachment record created with R2 object key
5. File displayed in idea with download link (served via signed URL, 24hr expiry)
6. If scan fails: user notified, file rejected, no record created

---

## ENDORSEMENT PROCESSES

### P26 — Claim MP / Peer Status

1. User navigates to Profile → Settings → "Claim Parliamentary Status"
2. Selects role: MP or Member of the House of Lords
3. Enters constituency (MP) or peerage title (Peer)
4. Submits Parliament.uk profile URL
5. UserParliamentaryVerification record created (status=PENDING); admin alerted
6. Status shown as "Pending verification" on profile
7. Admin verifies (P44) → on approval: parliamentary_verified=true, parliamentary_status set, verified badge shown

---

### P27 — Give Parliamentary Endorsement

Available to verified MPs and Peers only (parliamentary_verified=true).

1. Verified MP/Peer navigates to any idea at Stage 3+
2. "Parliamentary Endorsements" section shown with "Endorse this Idea" button
3. Clicks button → modal opens
4. Reviews idea summary
5. Optionally writes public statement (why they endorse)
6. Submits → Endorsement record created (status=ACTIVE)
7. Idea owner notified (in-app + email): "Your idea has been endorsed by [Name], [Role]"
8. Endorsement displayed publicly on idea page and on referral landing pages
9. Owner's CredibilityScore recalculated (High weight input applied)

---

### P28 — Withdraw Parliamentary Endorsement

1. MP/Peer navigates to idea → their endorsement
2. Clicks "Withdraw Endorsement"
3. Enters optional withdrawal reason
4. Endorsement status=WITHDRAWN; owner notified
5. Removed from public display; retained in audit history
6. Stage 4→5 gate re-checked: if now below 3 active endorsements, owner notified

---

### P29 — Claim Parliamentary Draftsman Status

1. User navigates to Profile → Settings → "Claim Professional Status"
2. Selects: Parliamentary Draftsman / Legislative Counsel
3. Enters: firm/chambers, professional credentials, licence/bar number
4. Uploads supporting document (PDF, max 5MB) as evidence
5. UserProfessionalVerification record created (status=PENDING); admin alerted
6. Admin verifies (P45) → on approval: professional_verified=true; badge shown

---

### P30 — Give Parliamentary Draftsman Endorsement

Available to verified Parliamentary Draftsmen only (professional_verified=true). Available at Stage 4+ only.

1. Verified Draftsman navigates to idea at Stage 4+
2. "Legal Readiness" section shown with "Certify as Parliament-Ready" button
3. Reviews proposedWording, targetLegislation, coherentActions
4. Writes required public statement: legal readiness assessment
5. Submits → DraftsmanEndorsement record created
6. Owner notified; idea now qualifies for Stage 4→5 gate check
7. Certificate displayed on idea page with draftsman's credentials

---

## MERGE PROCESSES

### P31 — Propose an Idea Merge

**Prerequisites:** Both ideas have ≥5 votes; proposer has not exceeded 3 proposals/month.

1. Owner navigates to another idea → "Propose Merge" (visible to idea owners only)
2. Selects merge type:
   - **Merger:** "I propose your idea absorbs mine. You keep ownership. I bring my votes."
   - **Takeover:** "I propose my idea absorbs yours. I keep ownership. I take your votes."
3. Writes proposal message (pre-populated in private MessageThread)
4. MergedIdea record created (status=PROPOSED); private MessageThread auto-created
5. Both owners notified (in-app + email)
6. Proposal lapses after 30 days; both notified at 7 days remaining

---

### P32 — Respond to Merge Proposal

1. Receiving owner opens MessageThread or notification
2. Reviews proposal via idea comparison view
3. Chooses: Accept / Reject / Counter-propose (flip ownership direction)
4. On reject: MergedIdea status=REJECTED; proposer notified
5. On counter-propose: new framing sent to original proposer for acceptance
6. On accept: → P33

---

### P33 — Execute Merge

1. On acceptance: MergedIdea status=ACCEPTED; acceptedAt timestamp
2. Absorbed idea status=MERGED; redirect banner shown on absorbed idea page
3. All content from absorbed idea attached to surviving idea (collapsible section)
4. All voters on absorbed idea notified of 14-day withdrawal window
5. pendingPort=true on all Vote records for absorbed idea
6. 48-hour reminder sent before window closes
7. After 14 days: votes ported; PointsLedger records created for both owners:
   - Absorbed owner: Rallymaster points = ported votes × 10
   - Surviving owner: Strategist points = ported votes × 10
8. MergedIdea record updated: votesPortedCount, pointsAwarded=true

---

## ACCOUNT & PROFILE PROCESSES

### P34 — Create Account

1. User arrives at signup page (or via invitation magic link)
2. Enters: name, email, password (or magic link auto-verifies email)
3. Double opt-in: confirmation email sent; user must click to verify before account active
4. On verification: account active; referralCode generated (cryptographically random)
5. If arrived via referral link: referredByUserId stored on User record
6. Profile setup prompted: bio, expertType, politicalParty (all optional)
7. Lex setup: user selects preferred AI interaction style

---

### P35 — Login

1. Enter email + password, or use magic link ("email me a login link")
2. On success: session created via Clerk; redirected to dashboard or original destination
3. If returning user via referral link: existing referral cookie checked; attribution preserved

---

### P36 — Change Password

Standard: current password + new password + confirm. Email notification sent on change.

---

### P37 — Change Idea Ownership

1. Owner navigates to idea → Settings → "Transfer Ownership"
2. Enters new owner's email address
3. System sends invitation to new owner
4. New owner accepts → ownership transferred; original owner becomes collaborator (Editor)
5. Ownership history preserved in StageTransition audit log
6. All voters notified of ownership change

---

### P38 — GDPR: Request Data Export

1. User navigates to Account Settings → Privacy → "Download My Data"
2. Request logged; system compiles data package (all user records, ideas, comments, votes, messages)
3. Email sent within 30 days (target: 72 hours) with secure download link (R2 signed URL, 7-day expiry)

---

### P39 — GDPR: Request Account Deletion

1. User navigates to Account Settings → Privacy → "Delete My Account"
2. Warning: "This will permanently delete your account. Your ideas, comments, and contributions will be anonymised and may remain visible."
3. Confirmation: user types "DELETE"
4. Account status=DELETION_PENDING (30-day grace period)
5. All email communications stop immediately
6. After 30 days: personal data deleted; contributions anonymised ("Deleted User")
7. Email added to EmailSuppression (reason=ACCOUNT_DELETED)

---

### P40 — Email Unsubscribe

1. Every platform email includes one-click unsubscribe link in footer
2. Click → landing page: "You have been unsubscribed from all Scrutinise emails"
3. User's email added to EmailSuppression record
4. No further emails sent (including invitations)
5. Account remains active; user can still use platform but receives no emails
6. To re-subscribe: Account Settings → Notifications → re-enable emails
7. If suppressed email receives an invitation: special consent restoration notice shown:
   "You previously asked not to be contacted by Scrutinise. Clicking this link will remove you from that list. You are under no obligation to do so."

---

### P41 — Referral Landing Page Journey (Guest)

1. Guest arrives at User Profile LP or Idea LP via referral link
2. Referral code written to cookie + localStorage immediately
3. Guest can browse all content (ideas, comments, endorsements, contributions)
4. Guest clicks Vote → email capture modal:
   a. Enters email → offered full signup
   b. Double opt-in email sent (single email both verifies + creates account)
   c. On account creation: referral attribution preserved, redirected back to vote
5. Guest who already has account: login prompt instead of signup

---

## AI ASSISTANCE

### P42 — AI Assist (Lex)

Primary use: Lex guides idea creation through Socratic conversation (Stage 1 onwards). This is the main interaction model — not a bolt-on.

Secondary uses (explicit "AI Assist" mode within other flows):

1. Within idea editor or amendment drafting, user clicks "AI Assist"
2. Selects mode:
   - Draft text (generate or improve wording)
   - Analyse argument (identify weaknesses, logical gaps)
   - Suggest improvements (based on stage requirements)
   - Check against existing legislation (identify conflicts or gaps)
   - Evidence finder (suggest research sources)
3. Lex response shown in panel; user may accept, edit, or discard
4. AI interaction logged: AIUsageLog record created (provider, model, inputTokens, outputTokens, costUSD)
5. Provider assignment: always use the provider locked to this Idea (aiProvider field)

**Context per Lex API call:**
- System prompt (~2,000 tokens)
- Platform context: stage, idea title, current field target (~200 tokens)
- Completed fields summary (~500 tokens)
- aiChatSummary if exists (~300 tokens)
- Last 20 messages from aiChatHistory (~3,000 tokens)
- Current user message (~100 tokens)
- Total: ~6,000–7,000 input tokens per call

**Field population:** Lex includes JSON at end of response: `{"fieldUpdates": {"fieldName": "content"}}`. Backend strips this before displaying to user, parses it, updates Idea record. Frontend summary panel re-renders.

---

## ADMIN & MODERATION PROCESSES

### P43 — Moderation Queue

1. Moderator logs into admin dashboard → Moderation tab
2. Views flagged content ordered by flag count + recency
3. Sees: flag reason, reporter identity, content in full context
4. Takes action per role permissions:
   - Dismiss: flag cleared, content remains, reporter notified
   - Hide: content hidden from public, owner notified
   - Remove permanently: Admin/Super Admin only
   - Warn user: in-app warning sent
   - Suspend account: Admin/Super Admin only
5. Moderator displayed as "First Name Initial." (e.g. "James T.") with Moderator badge
6. All moderation actions logged in ActivityLog

---

### P44 — Verify Parliamentary Status (Admin)

1. Admin navigates to Admin Dashboard → Verification Queue → Parliamentary
2. Reviews claim: name, role, submitted Parliament.uk URL
3. Admin visits Parliament.uk to manually verify
4. Approves or rejects; user notified either way
5. On approval: parliamentary_verified=true; parliamentary_status set; verified badge shown

---

### P45 — Verify Parliamentary Draftsman Status (Admin)

1. Admin navigates to Admin Dashboard → Verification Queue → Professional
2. Reviews claim: credentials, firm/chambers, supporting document
3. Admin verifies via professional register or direct contact
4. Approves or rejects; user notified
5. On approval: professional_verified=true; DraftsmanEndorsement capability unlocked

---

### P46 — Platform Configuration

Super Admin only.

Configurable settings:
- Stage gate criteria (vote thresholds, required fields)
- Points values per action type
- Anti-gaming rate limits
- Notification batching rules
- Areas of government list
- Flag reason list

---

## DISCOVERY & SEARCH PROCESSES

### P47 — Browse Ideas

1. User navigates to "Ideas" from main nav
2. Default view: Campaign ideas (Stage 4+) ordered by recent activity
3. Filters: stage (Stage 4 or Stage 5 only), govtArea, ideaType, date created, most votes, most comments, most views, most recent
4. Idea cards show: title, summaryDescription, stage label, vote count, comment count, endorsement count
5. Stage 3 (Developing) ideas NOT shown in browse (link-only discovery)
6. Click card → idea detail page

---

### P48 — Search Ideas

1. User enters search query in search bar
2. Full-text search across: title, summaryDescription, diagnosis, guidingPolicy, coherentActions
3. Results ranked by: relevance + vote count + recency
4. Same filters as browse (P47)
5. Stage 3 ideas excluded from search results

---

### P49 — AI-Powered Idea Recommendation

**DEFERRED to Sprint 2 — requires vector embedding setup. See P-D2.**

---

## SETTINGS & DISPLAY PROCESSES

### P50 — Dashboard

1. User lands on dashboard after login
2. Sections:
   - Account overview (name, Credibility Score, points summary, Expert Badges)
   - My Ideas (list with stage, vote count, stage progress indicator)
   - My Contributions (comments, amendments, ratings — click through to each)
   - Notifications (recent, unread count)
   - Messages (unread count)
   - AI credit balance
3. Click any item → navigate to relevant idea, comment, or amendment

---

### P51 — Notifications

1. Bell icon in nav shows unread count
2. Notification centre: list with type icons, message, timestamp
3. Mark individual as read; mark all as read
4. Filter by type: votes / comments / amendments / merges / endorsements / system
5. Click notification → navigate to relevant content

---

### P52 — Settings

1. Account Settings: name, password, email, bio, expertType, politicalParty
2. Privacy Settings: data export (P38), account deletion (P39)
3. Notification Settings: per-type toggles + global email toggle
4. AI Settings: preferred provider, credit balance, top-up

---

### P53 — Feedback & Feature Requests

1. User navigates to Help → "Send Feedback"
2. Selects type: bug report / feature request / improvement suggestion
3. Writes title + description; submits
4. Publicly visible by default
5. Other users can vote (upvote only) and comment
6. Admin manages status: under review / planned / in progress / completed / won't fix
7. User notified when status changes on requests they submitted or voted on

---

## ANALYTICS & SEO

### P54 — Platform Analytics (GA4)

1. GA4 tag installed on all pages via Next.js Script component
2. Custom events: idea_created, idea_stage_changed, vote_cast, amendment_proposed, user_registered, referral_link_clicked, endorsement_given
3. Standard GA4 metrics: sessions, bounce rate, time on site, page views, user retention

---

### P55 — SEO & Rich Search Results

All public pages (Stage 3+) implement:

1. Unique meta title + description per page
2. Open Graph tags: og:title, og:description, og:image (Vercel OG dynamic), og:type
3. Twitter Card tags for rich X/Twitter previews
4. Schema.org Article structured data on idea pages (rich Google snippets)
5. Canonical tags (prevents duplicate content from referral parameters)
6. robots.txt: allow Stage 3+, disallow Stage 1/2
7. sitemap.xml: auto-generated for Stage 4+ ideas; regenerated on stage change

---

## DEFERRED PROCESSES

| Ref | Process | Notes |
|-----|---------|-------|
| P-D1 | Address book import (Google Contacts / Outlook OAuth) | Sprint 2 |
| P-D2 | AI-powered idea recommendation engine (vector search) | Sprint 2 |
| P-D3 | WhatsApp group integration | Sprint 2 |
| P-D4 | Fundraising / donation flow (Stripe) | Sprint 2 |
| P-D5 | Phone (SMS) verification (Twilio) | Sprint 2 |
| P-D6 | Parliament Members API automated verification | Sprint 2 |
| P-D7 | Offline mode (service worker / Dexie.js sync) | Sprint 2 |
| P-D8 | Change idea ownership — full process | Sprint 2 (P37 is simplified version) |

---

## ROLE PERMISSIONS MATRIX

| Action | Citizen | Moderator | Admin | Super Admin |
|--------|---------|-----------|-------|-------------|
| Create idea | ✅ | ✅ | ✅ | ✅ |
| Vote on idea | ✅ | ✅ | ✅ | ✅ |
| Comment | ✅ | ✅ | ✅ | ✅ |
| Propose amendment | ✅ | ✅ | ✅ | ✅ |
| Report content | ✅ | ✅ | ✅ | ✅ |
| Give parliamentary endorsement | Verified MPs/Peers only | | | |
| Give draftsman endorsement | Verified draftsmen only | | | |
| Hide content | ❌ | ✅ | ✅ | ✅ |
| Remove content permanently | ❌ | ❌ | ✅ | ✅ |
| Warn user | ❌ | ✅ | ✅ | ✅ |
| Suspend account | ❌ | ❌ | ✅ | ✅ |
| Ban user | ❌ | ❌ | ✅ | ✅ |
| Force stage change | ❌ | ❌ | ✅ | ✅ |
| Verify parliamentary status | ❌ | ❌ | ✅ | ✅ |
| View full moderator identity | ❌ | ❌ | ✅ | ✅ |
| Assign Admin role | ❌ | ❌ | ❌ | ✅ |
| Platform configuration | ❌ | ❌ | ❌ | ✅ |
| Delete any content | ❌ | ❌ | ✅ | ✅ |

**Moderator display:** First name + initial of surname (e.g. "James T.") with "Moderator" badge. Full identity visible to Admins only.

---

*process_list_v2.md — Scrutinise — March 2026*
*Total processes: P01–P55 (active) + P-D1 to P-D8 (deferred)*

---

## TRAINING PROCESSES

### P56 — Browse Training Resources

1. User navigates to Training from main nav
2. Default view: all resources, most recent first
3. Filters: Stage | Topic | Difficulty | Type (Video/Article/Podcast)
4. Click resource card → opens YouTube embed inline (video) or external link in new tab
5. No login required to browse or view training resources

---

## FOLLOW & WATCH PROCESSES

### P57 — Follow a User

1. User navigates to another user's profile (WF-30)
2. Clicks "Follow" button
3. Follow record created (followerId=current user, followedUserId=target user)
4. Button changes to "Following"
5. User now receives notifications when followed user publishes a new idea (Stage 3+)
6. Followed users appear in dashboard "Following" section

### P58 — Watch an Idea

1. User navigates to any idea page at Stage 3+ (not their own)
2. Clicks "Watch" button in idea header
3. Follow record created (followerId=current user, watchedIdeaId=idea)
4. Button changes to "Watching"
5. User now receives notifications on: stage changes, new amendments, new comments
6. Watched ideas appear in dashboard "Watching" section

### P59 — Unfollow / Unwatch

1. User clicks "Following" / "Watching" button (toggle)
2. Follow record deleted
3. Notifications for that user/idea cease

---

*process_list_v2.md — Scrutinise — March 2026 (updated)*
*Total processes: P01–P59 (active) + P-D1 to P-D8 (deferred)*
