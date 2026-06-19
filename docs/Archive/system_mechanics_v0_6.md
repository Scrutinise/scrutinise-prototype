# SCRUTINISE — SYSTEM MECHANICS v0.6
*How the platform calculates, decides, and adjudicates behind the scenes.*
*Source: SYSTEM_MECHANICS_v0_6.docx — post-reconciliation*
*All 67 decisions resolved. Last updated: March 2026*

---

## CONTENTS

1. [Stage Progression](#1-stage-progression)
2. [Idea Wording & Amendment Mechanics](#2-idea-wording--amendment-mechanics)
3. [Points System](#3-points-system)
4. [Credibility Score](#4-credibility-score)
5. [Voting Mechanics](#5-voting-mechanics)
6. [MP & Peer Endorsements](#6-mp--peer-endorsements)
7. [Parliamentary Draftsman Endorsement](#7-parliamentary-draftsman-endorsement)
8. [Referral & Tracking Link System](#8-referral--tracking-link-system)
9. [Referral Landing Pages](#9-referral-landing-pages)
10. [File, Media & Link Attachments](#10-file-media--link-attachments)
11. [Offline Mode & Sync](#11-offline-mode--sync)
12. [Anti-Gaming & Abuse Prevention](#12-anti-gaming--abuse-prevention)
13. [Notifications & Communication](#13-notifications--communication)
14. [Private Messaging](#14-private-messaging)
15. [Idea Merging](#15-idea-merging)
16. [GDPR & Email Suppression](#16-gdpr--email-suppression)
17. [SEO & Analytics](#17-seo--analytics)

---

## 1. STAGE PROGRESSION

### 1.1 Stage Overview

Five stages govern an idea's lifecycle. Each stage has a name, a visibility level, and gate criteria that must be met before the owner can progress.

Stage 3 vs Stage 4 distinction: Stage 3 ideas are publicly accessible via link and Google-indexable, but do NOT appear in Scrutinise browse or search. Full functionality is available (voting, commenting, amendments). Stage 4 is when an idea enters the platform's browse/search and reaches the full Scrutinise audience.

### 1.2 Stage Gate Criteria

**Stage 1 → Stage 2 (Create → Draft)**
- title non-empty
- summaryDescription non-empty
- Trigger: owner manually promotes

**Stage 2 → Stage 3 (Draft → Develop)**
- diagnosis non-empty
- guidingPolicy non-empty
- At least 1 CoherentAction record
- If ideaType = LEGISLATION: at least 1 TargetLegislation record
- At least 1 Research record attached
- Trigger: owner manually promotes

**Stage 3 → Stage 4 (Develop → Campaign)**
- Minimum 25 votes
- Trigger: owner manually promotes (button unlocked when 25 votes reached)
- Owner notified when threshold crossed

**Stage 4 → Stage 5 (Campaign → Parliament)**
- Minimum 3 active Endorsement records (MP or Peer)
- At least 1 active DraftsmanEndorsement record
- All proposedWording fields complete and non-empty
- Trigger: owner manually promotes

### 1.3 Stage Labels & UI Indicators

Each stage change logged in StageTransition entity. Lex's background context updates with current stage — Lex's prompts shift to reflect what's needed for the next stage.

---

## 2. IDEA WORDING & AMENDMENT MECHANICS

### 2.1 ProposedWording Field

The `proposedWording` field holds the full text of the proposed legislation or organisational change — the actual wording intended for parliamentary submission. It is distinct from summaryDescription.

Every change to proposedWording creates a WordingHistory record. This provides a complete audit trail of how the wording evolved.

### 2.2 Direct Editing (Stages 1 & 2)

In Stages 1 and 2 (no public access, no votes), the owner may edit proposedWording directly at any time. No amendment process required. WordingHistory records created on every save.

### 2.3 Wording Lock (Stage 3+, once first vote received)

Once an idea receives its first vote (at Stage 3 or later), proposedWording is locked for direct editing. `wordingLocked = true` on the Idea record. All subsequent changes to wording must go through the formal amendment process (P15–P18).

The system intercepts any direct edit attempt and redirects the owner to "Propose Amendment."

### 2.4 Amendment Mode A — Consult First (Advisory)

Owner circulates a proposed wording change to all current voters for an advisory vote before deciding whether to accept.

1. Owner clicks "Circulate for Consultation" on a pending amendment
2. ConsultationVote records created as voters respond (SUPPORT / OPPOSE / NO_OPINION)
3. Owner sees live tally — non-binding
4. No wording change, no withdrawal window, no points change
5. Owner then decides: Accept (→ Mode B), Reject, or re-circulate with modifications

Warning shown to owner when NOT using Mode A first:
"Accepting this amendment without consultation may cause voters to withdraw. Consider circulating for consultation first to test voter response."

### 2.5 Amendment Mode B — Accept & Notify (Binding)

1. Owner accepts amendment → proposedWording updated
2. WordingHistory record created (changeType=AMENDMENT_ACCEPTED)
3. All voters notified of change; 14-day withdrawal window opens
4. pendingPort=true on all Vote records
5. 7-day cooling-off begins for Thinker points bonus to amendment author
6. After 7 days: +150 Thinker points awarded (if acceptance not reversed)
7. After 14 days: withdrawal window closes; PointsLedger entries finalised

### 2.6 Version History Display

A "Wording History" tab on the idea page shows all prior versions of proposedWording in reverse chronological order, with timestamps, who changed it, and how (direct edit or amendment). Accessible to all users.

---

## 3. POINTS SYSTEM

### 3.1 Overview & Philosophy

Five categories. No time decay. Points are permanent. Global (not per-topic). Top-3 subject area Expert Badges on profiles. All transactions in PointsLedger.

"Teambuilder" is the canonical name — never "Dealweaver".

### 3.2 Strategist Points

Awarded to an idea owner when their idea receives votes.

| Event | Points |
|-------|--------|
| Idea receives a vote | +10 |
| Vote withdrawn | −10 |
| Merge completed (surviving owner) | ported votes × 10 |

### 3.3 Thinker Points

Awarded/deducted based on comment ratings. Scale: −5 to +5, 0.5 increments. All ratings additive. Owner and general user ratings stack independently.

Rating multiplier logic:
- 3 stars = baseline helpful
- 5 stars = 10× the value of 3 stars
- 1 star = 1/10th the value of 3 stars
- 2 and 4 stars interpolated proportionally

Amendment author bonus: +150 Thinker points after 7-day cooling-off when owner accepts amendment (Mode B).

Comment character limit: 20,000 characters.

### 3.4 Rallymaster Points

Awarded for successful referrals.

| Event | Points |
|-------|--------|
| Referred user qualifies (30 days + 3 actions) | +100 |
| Merge completed (absorbed idea owner) | ported votes × 10 |

Qualification: referred user must remain active for 30 days AND complete at least 3 meaningful actions (vote, comment, or amendment).

### 3.5 Rainmaker Points

Schema ready; implementation deferred to Sprint 2.

| Event | Points |
|-------|--------|
| Per £1 raised gross | +50 |
| Per £1 refunded | −50 |

### 3.6 Teambuilder Points

Network points from recruiting active contributors.

- Level 1 (direct recruits): 30% of their Strategist + Thinker + Rainmaker → your Teambuilder; 30% of their Rallymaster → your Rallymaster
- Level 2 (recruits' recruits): 10% of same, cascading on directly earned points only
- No cap on network depth
- Circular Teambuilder chains auto-detected and blocked

---

## 4. CREDIBILITY SCORE

### 4.1 Purpose

Single visible number on profile. Used for display, leaderboards, and Expert Badge eligibility. Does NOT affect vote weight — all votes are raw and equal.

### 4.2 Two-Phase Model

**Phase 1 (rawScore < 350):** Raw number shown + "Building credibility..." + progress bar toward 350.

**Phase 2 (rawScore ≥ 350):** Percentile-normalised score vs all Phase 2 users. Can go below 0 (no floor). Nightly batch recalculation; immediate recalculation on large events (e.g. parliamentary endorsement received).

### 4.3 Inputs & Weights

| Input | Weight |
|-------|--------|
| Strategist points | Medium |
| Thinker points | High |
| Rallymaster points | Low |
| Teambuilder points | Low |
| Parliamentary endorsements received | High |
| Expert Badge qualification | Medium |
| Account age | Very low |

### 4.4 Expert Badges

Users' top 3 subject areas by Thinker points concentration earn Expert Badges displayed on their profile. Expert Badge eligibility is based on credibility + Thinker points concentration in a government area. Initial bars are set high. Subject area tags are applied to ideas, and Thinker points concentrate in those areas when comments are highly rated.

---

## 5. VOTING MECHANICS

### 5.1 Vote Structure

Every vote has two components:

**Direction:** FOR / AGAINST / UNDECIDED

**Strength/certainty slider:** 0–5 in 0.5 increments
- FOR: 0 = barely convinced, 5 = passionately behind this
- AGAINST: 0 = barely opposed, 5 = passionately against
- UNDECIDED: 0 = don't care about this issue, 5 = care a lot but can't decide yet

**Quality flags (optional):** Three checkboxes shown on the vote page for all voters including UNDECIDED:
- "It doesn't go far enough"
- "It goes too far"
- "It's poorly worded"

These are stored as a JSON array on the Vote record. They are owner-facing analytics only — not displayed publicly.

All votes are raw and unweighted — no vote weight mechanism of any kind. Email verification required before voting. One vote per user per idea. IP rate limit: 20 votes per hour per IP address.

### 5.2 Passion Score

The passion score is the average strength/certainty value across all non-withdrawn votes on an idea, regardless of direction. It is a public-facing display on the idea page showing how intensely voters feel about the issue. Recalculated on every vote event.

Range: 0.0–5.0. Displayed as a single decimal number with label "Passion score."

### 5.3 Vote Distribution (Owner Analytics)

Idea owners can view and export a breakdown of their vote data:
- Count of FOR / AGAINST / UNDECIDED votes
- Average strength for each direction
- Strength bucket distribution (0–1, 1–2, 2–3, 3–4, 4–5)
- Quality flag tallies

Stored in `voteDistribution` JSON field on Idea. Updated on every vote. Owners can export this data for group creation and targeted messaging.

### 5.4 Vote Changes

If a user changes their vote:
- Old points reversed from owner's Strategist total
- New points applied based on new direction
- Referral attribution persists (not re-triggered)
- Vote record updated, not replaced
- passionScore and voteDistribution recalculated

### 5.5 Strategist Points & Vote Direction

Strategist points are awarded to the idea owner when a vote is cast, regardless of direction. A strong AGAINST vote (direction=AGAINST, strength=5) still awards points to the owner — the owner is rewarded for generating engagement, not agreement.

| Event | Points |
|-------|--------|
| Vote cast (any direction) | +10 |
| Vote withdrawn | −10 |
| Merge completed (surviving owner) | ported votes × 10 |

### 5.6 Vote Withdrawal Window

When an amendment is accepted (Mode B), a 14-day withdrawal window opens:
- pendingPort=true on all Vote records
- Visual "pending" indicator on idea page
- Voters notified; can withdraw via P14b
- After 14 days: window closes, all non-withdrawn votes confirmed permanent

---

## 6. MP & PEER ENDORSEMENTS

- Verified MPs and Peers may vote like any citizen AND give a formal Endorsement
- No points awarded for endorsing — it is a public duty
- Endorsements visible to guests on idea pages and referral landing pages
- Feed into owner's Credibility Score at High weight
- Displayed as dedicated "Parliamentary Endorsements" section on idea page
- Required: minimum 3 active endorsements for Stage 4→5 gate
- Verification v1: manual (admin checks Parliament.uk URL)
- Verification v2 (deferred): automated via Parliament Members API

---

## 7. PARLIAMENTARY DRAFTSMAN ENDORSEMENT

Separate from MP/Peer endorsements. A legal quality certificate, not a political endorsement.

- Required (along with ≥3 MP/Peer endorsements) for Stage 4→5 transition
- Available at Stage 4+ only
- The endorsement is a public legal readiness statement certifying the idea's proposedWording is fit for parliamentary submission
- Displayed with draftsman's credentials on idea page
- Parliamentary draftsmen are government employees (Office of Parliamentary Counsel); whether they are permitted to participate publicly on a platform like this is unclear. Admin reviews each claim carefully.

---

## 8. REFERRAL & TRACKING LINK SYSTEM

### 8.1 Referral Codes

Every user has a permanent cryptographically random referral code generated on account creation. Used in referral links: `/idea/[id]?ref=[code]` and `/user/[username]?ref=[code]`.

### 8.2 Attribution Hierarchy

1. Server-side session (highest priority — permanent)
2. localStorage
3. 60-day cookie (lowest priority)

### 8.3 Attribution Rules

- Multiple links: last referral attribution for voting; first referral for recruitment (account creation)
- Self-referral blocked
- ReferralEvent record created when a referred user votes

### 8.4 Qualification Window

Points are not awarded immediately on referral. Qualification requires:
- 30 days since registration
- 3 meaningful actions (vote, comment, or amendment proposal)

Lazy check: qualification checked on each of the referred user's actions. Cron job runs nightly to catch any missed qualifications.

---

## 9. REFERRAL LANDING PAGES

Two public landing pages — fully functional for guests.

### User Profile Landing Page (`/user/[username]?ref=[code]`)

Sections:
- User header: name, Credibility Score, Expert Badges
- Their ideas: with vote counts, endorsement counts
- Their contributions: comments and amendments
- "What is Scrutinise?" explainer
- Contextual login/signup prompt

### Idea Landing Page (`/idea/[id]?ref=[code]`)

Sections:
- Idea header: title, owner, stage, vote count + vote button
- summaryDescription
- Diagnosis summary
- Policy summary
- Coherent Actions list
- Parliamentary Endorsements (full, visible to guests)
- "What is Scrutinise?" explainer
- Login/signup prompt

### Guest Vote Flow

Click vote → email capture modal → signup offer (double opt-in email sent) → on verification, redirected back to vote. Referral attribution preserved throughout.

### Cookie States

- New visitor: "What is Scrutinise?" + signup prompt
- Returning, not logged in: personalised login prompt ("Welcome back [name]")
- Logged in: vote button active, no login prompt

---

## 10. FILE, MEDIA & LINK ATTACHMENTS

### Storage

Railway has no persistent storage. All files stored in Cloudflare R2.

R2 buckets:
- `scrutinise-uploads` — private, signed URLs with 24hr expiry
- `scrutinise-profiles` — public CDN for profile images

R2 cost: $0.015/GB/month storage, $0 egress. Free tier: 10GB storage.

### Security

- ClamAV virus scan on all PDF uploads before storing
- Google Safe Browsing API check on all external URLs submitted by users
- Upload rate limit: 10 file uploads per user per day

### File Size Limits

- PDFs: max 10MB
- Images: max 5MB (JPEG/PNG/WebP)

### Served Files

All private R2 files served via signed URLs (24hr expiry). Profile images served via public CDN URL.

---

## 11. OFFLINE MODE & SYNC

**DEFERRED to Sprint 2.**

Planned implementation: Dexie.js (IndexedDB) + service worker.
- Read-only cache available offline
- Draft editing queued locally
- Voting, messaging, uploads require connectivity
- Conflict resolution: side-by-side diff

---

## 12. ANTI-GAMING & ABUSE PREVENTION

### Approach

No hard caps on most actions — retrospective anomaly detection + admin review. Hard limits only where abuse is clearly defined.

### Hard Limits

| Action | Limit |
|--------|-------|
| Votes per IP per hour | 20 |
| File uploads per user per day | 10 |
| Merge proposals per owner per month | 3 |
| Minimum votes for merge eligibility | 5 per idea |
| Owner broadcasts per idea | 1 per 7 days |

### Referral Anti-Gaming

- 30-day + 3-action qualification window (prevents fake account referrals)
- Self-referral blocked at server level
- Circular Teambuilder chains auto-detected

### Anomaly Detection

Retrospective review flags:
- Sudden vote spikes on an idea
- Multiple accounts from same IP
- Rapid referral chains
- Unusual amendment acceptance/rejection patterns

Admin reviews flagged anomalies. No automated account suspension — always a human decision except for hard-limit violations.

---

## 13. NOTIFICATIONS & COMMUNICATION

### Notification Triggers

| Event | Who is notified |
|-------|----------------|
| New vote received | Idea owner |
| Stage eligibility threshold crossed | Idea owner |
| New comment on idea | Idea owner |
| New amendment proposed | Idea owner |
| Amendment accepted | Amendment author |
| Parliamentary endorsement given | Idea owner |
| Merge proposed | Both idea owners |
| Merge accepted | Both idea owners |
| Owner broadcast | All voters |
| Amendment consultation (Mode A) | All voters |
| Mode B acceptance + withdrawal window | All voters |
| Stage change | All voters and subscribers |
| Message received | Recipient |
| Moderation action | Content owner + reporter |

### Notification Settings

Per-type toggles + global email toggle per user. Every email includes one-click unsubscribe.

### Moderator Display

Moderator name shown as "First Name Initial." (e.g. "James T.") with Moderator badge. Full identity visible only to Admins.

---

## 14. PRIVATE MESSAGING

- 1:1 DMs only in v1
- Merge proposal threads auto-created (MessageThread with context)
- Read receipts
- AES encrypted at rest; not end-to-end encrypted in v1
- Out of scope v1: group messaging, file attachments, message search
- Owner broadcast to voters is a separate mechanism (BroadcastMessage entity) — not DMs

---

## 15. IDEA MERGING

### Prerequisites

- Both ideas must have at least 5 votes each
- An owner may not propose more than 3 merge proposals per month

### Negotiation Phase

- 30-day negotiation window
- Both parties notified at 7 days remaining
- Merges are owner-consensual only — platform admins cannot force a merge
- Counter-proposal option: flip the ownership direction

### Execution

On acceptance:
1. MergedIdea record created; absorbed idea marked status=MERGED
2. All content from absorbed idea retained, displayed in collapsible section
3. 14-day voter withdrawal window for absorbed idea's voters
4. 48-hour reminder sent before window closes
5. After 14 days: votes ported; points calculated

### Points Awarded

| Who | Points | Category |
|-----|--------|----------|
| Owner of absorbed idea | ported votes × 10 | Rallymaster |
| Owner of surviving idea | ported votes × 10 | Strategist |

Neither owner loses existing points. Absorbed idea's Strategist points retained.

---

## 16. GDPR & EMAIL SUPPRESSION

### 16.1 Email Suppression

Every platform email includes one-click unsubscribe. Unsubscribe → email added to EmailSuppression table → no further emails ever.

Account remains active. User can still use platform without receiving emails.

### 16.2 Re-Opt-In

If a suppressed email receives an invitation from another user:

Special consent restoration notice shown:
"You previously asked not to be contacted by Scrutinise. Clicking this link will remove you from that list. You are under no obligation to do so."

User must actively click to restore consent. This is the ONLY re-opt-in mechanism besides navigating to Account Settings and re-enabling emails manually.

### 16.3 Account Deletion

1. User requests deletion → 30-day grace period (status=DELETION_PENDING; all emails stop immediately)
2. After 30 days: personal data deleted; contributions anonymised ("Deleted User")
3. Email added to EmailSuppression (reason=ACCOUNT_DELETED)
4. Right to erasure fulfilled; documented in ActivityLog

### 16.4 Data Export

On request: system compiles all user data → secure download link (R2 signed URL, 7-day expiry). Target delivery: 72 hours; legal maximum: 30 days.

### 16.5 Double Opt-In

All account creation (including magic-link invitations) requires email confirmation before account activation. Magic link click serves as the email confirmation.

---

## 17. SEO & ANALYTICS

### 17.1 Google Analytics 4

GA4 tag on all pages via Next.js Script component.

Custom events:
- idea_created
- idea_stage_changed
- vote_cast
- amendment_proposed
- user_registered
- referral_link_clicked
- endorsement_given

### 17.2 SEO Implementation

All public pages (Stage 3+) implement:
- Unique meta title + description per page
- Open Graph tags (og:title, og:description, og:image via Vercel OG, og:type)
- Twitter Card tags for X/Twitter rich previews
- Schema.org Article structured data on idea pages
- Canonical tags (prevents duplicate content from referral parameters)
- robots.txt: allow Stage 3+, disallow Stage 1/2
- sitemap.xml: auto-generated for Stage 4+ ideas, regenerated on stage change

---

*system_mechanics_v0.6.md — Scrutinise — March 2026*
*67 decisions resolved. Source of truth for all platform algorithms and rules.*
