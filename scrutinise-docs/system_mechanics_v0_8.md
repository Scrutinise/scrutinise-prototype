# SCRUTINISE — SYSTEM MECHANICS v0.8
*How the platform calculates, decides, and adjudicates behind the scenes.*
*Last updated: 13 April 2026*
*Changes from v0.7: Section 3 points schedule updated to V2A values (full schedule with caps). Section 21 added: Referral Mechanics, Points, and Credibility end-to-end. TargetOrganisationType enum added. ResourcesCommitted human capital fields. GuidingPolicy Rumelt fields. CoherentAction benefit mirrors.*

---

## CONTENTS

1. Stage Progression
2. Idea Wording & Amendment Mechanics
3. Points System
4. Credibility Score
5. Voting & Contribution Mechanics
6. MP & Peer Endorsements
7. Parliamentary Draftsman Endorsement
8. Referral & Tracking Link System
9. Referral Landing Pages
10. File, Media & Link Attachments
11. Offline Mode & Sync
12. Anti-Gaming & Abuse Prevention
13. Notifications & Communication
14. Private Messaging
15. Idea Merging
16. GDPR & Email Suppression
17. SEO & Analytics
18. Privacy Log
19. Lex AI Modes
20. User Onboarding & Preferred Name
21. Referral Mechanics, Points, and Credibility: End-to-End

---

## 1. STAGE PROGRESSION

### 1.1 Stage Overview

| Stage | Name | Visibility | Voting |
|-------|------|------------|--------|
| 1 | Create | Private | Hidden |
| 2 | Draft | Invited only | Hidden |
| 3 | Develop | Link-only | Hidden |
| 4 | Campaign | Platform-listed | Visible |
| 5 | Legislate | Public | Visible |

Stage 5 is **Legislate** everywhere. Never "Parliament" as a stage name.

Voting is **hidden** (not disabled — hidden entirely) at Stages 1, 2, 3. This is a quality signal: ideas must complete a scrutiny period before public voting opens.

### 1.2 Stage Gate Criteria

**Stage 1 → 2 (Create → Draft)**
- title non-empty AND summaryDescription non-empty
- Trigger: **AUTOMATIC** — server-side check on every idea PATCH
- Lex delivers achievement message; explains team-building features
- No owner action required

**Stage 2 → 3 (Draft → Develop)**
- diagnosis non-empty + guidingPolicy non-empty + ≥1 CoherentAction + ≥3 Research records
- Trigger: owner clicks "Take Public"
- Warning modal: *"This makes your idea publicly accessible via a link. Are you ready for feedback from strangers?"*
- If in a Policy Development Group with veto: StageTransitionRequest created pending group admin approval

**Stage 3 → 4 (Develop → Campaign)**
- ≥12 unique IdeaReview records + average quality rating ≥ 2.5
- platformConfig.credibilityWeightingActive = false at launch (raw ratings only)
- Trigger: owner clicks "Begin Campaign"
- Vote widget becomes visible from this point

**Stage 4 → 5 (Campaign → Legislate)**
- ≥3 MP Endorsement records AND ≥3 Peer Endorsement records (separate, not combined)
- ≥1 DraftsmanEndorsement record
- All proposedWording fields non-empty
- Trigger: owner clicks "Submit to Parliament"

---

## 2. IDEA WORDING & AMENDMENT MECHANICS

### 2.1 ProposedWording Field

Locked for direct editing once first vote received (`wordingLocked = true`). All subsequent changes via formal amendment process. Every change creates WordingHistory record.

### 2.2 Amendment Owner Actions

Owner can take four actions on a pending amendment:

1. **Accept (Mode B — Binding):** Updates wording permanently. 14-day voter withdrawal window opens. +150 Thinker points to proposer after 7-day cooling-off.
2. **Circulate for Consultation (Mode A — Advisory):** Sends advisory poll to all voters (SUPPORT/OPPOSE/NO_OPINION). Non-binding. Owner sees live tally. No wording change.
3. **Request Revision:** Returns amendment to proposer with specific guidance. Status → REVISION_REQUESTED. Proposer notified with guidance text.
4. **Counter-Proposal:** Owner proposes alternative wording in response. Creates a new Amendment record linked to the original as a counter. Both shown in the Amendments tab with their relationship visible.
5. **Reject:** Owner enters rejection reason. Status → REJECTED. Proposer notified.

**UI help text for actions:**
- [Consult First] — "Click to send this amendment out to all those who have voted on your idea so far, for their opinion"
- [Request Revision] — "Send back to the proposer with your suggestion for a compromise wording"

### 2.3 Amendment Notification Routing

Clicking an amendment notification takes the user to the **Amendments tab** of the idea — not to the generic notifications page.

### 2.4 Amendment Counter-Proposal Flow

1. Owner clicks "Counter-Propose"
2. Owner writes alternative wording with rationale
3. New Amendment record created: `isCounterProposal = true`, `parentAmendmentId = original.id`
4. Original proposer notified: "The owner has proposed an alternative wording to your amendment"
5. Both wording versions shown side by side in the Amendments tab
6. Original proposer can: Accept the counter / Reject and revert to original / Propose a further revision
7. Credibility points awarded based on final resolution

---

## 3. POINTS SYSTEM

Five categories. No time decay. Points are permanent.

**Strategist:** Rewards idea development — starting ideas, advancing stages, completing key fields, adding research, voting on others. Capped per action type to prevent farming.

**Thinker:** Rewards intellectual contribution — submitting contributions, receiving quality ratings, having amendments accepted. Quality-weighted: 5★ earns 3× what a bare submission earns.

**Rallymaster:** Rewards community growth — inviting people who join and qualify (complete 3 meaningful actions within 30 days).

**Rainmaker:** £1 raised = +50. Deferred Sprint 2.

**Teambuilder:** 30% of direct recruits' Strategist+Thinker points. 10% of their recruits'. Circular chains blocked. Accrues passively.

### 3.1 Points Schedule (V2A)

| Action | Points | Category | Cap |
|--------|--------|----------|-----|
| IDEA_STARTED | 10 | STRATEGIST | 5 distinct ideas |
| STAGE_2_ADVANCE | 10 | STRATEGIST | 5 distinct ideas |
| DIAGNOSIS_COMPLETE | 12 | STRATEGIST | 3 distinct ideas |
| GUIDING_POLICY_COMPLETE | 12 | STRATEGIST | 3 distinct ideas |
| FIRST_COHERENT_ACTION | 12 | STRATEGIST | 3 distinct ideas |
| RESEARCH_ADDED | 3 | STRATEGIST | 6 per idea, 3 distinct ideas |
| STAGE_3_ADVANCE | 35 | STRATEGIST | 3 distinct ideas |
| STAGE_4_ADVANCE | 75 | STRATEGIST | 3 distinct ideas |
| STAGE_5_ADVANCE | 150 | STRATEGIST | 3 distinct ideas |
| CONTRIBUTION_SUBMITTED | 4 | THINKER | None |
| CONTRIBUTION_RATED_3 | 4 | THINKER | None |
| CONTRIBUTION_RATED_4 | 8 | THINKER | None |
| CONTRIBUTION_RATED_5 | 12 | THINKER | None |
| CONTRIBUTION_RATED_1_2 | −4 | THINKER | None |
| IDEA_RATED | 2 | THINKER | Once per idea |
| IDEA_VOTED | 3 | STRATEGIST | Once per idea |
| AMENDMENT_ACCEPTED | 100 | THINKER | None |
| REFERRAL_JOIN | 10 | RALLYMASTER | None |
| REFERRAL_QUALIFIED | 75 | RALLYMASTER | None |

---

## 4. CREDIBILITY SCORE

Single visible number on profile. Does NOT affect vote weight — all votes raw and equal for counting.

**Phase 1** (rawScore < 350): raw number + "Building credibility..." progress bar.
**Phase 2** (rawScore ≥ 350): percentile-normalised vs all Phase 2 users.

**Manual Override (Trust Seeds):** SuperAdmin sets `manualCredibilityOverride`. Displayed score = max(rawScore, override). Users with override set see "Below Standard" button on ideas alongside MPs and Peers.

**Inputs:** Thinker (high), parliamentary endorsements received (high), Strategist (medium), Expert Badges (medium), Rallymaster (low), Teambuilder (low), account age (very low), lexLogicScore (Sprint 2).

**Credibility-Weighted Rating (Sprint 2):** When `credibilityWeightingActive = true`, displayed quality rating weighted by rater credibility. Raw vote counts still used for stage gate thresholds.

**Moderator Invitation:** When credibilityScore hits 500, Admin dashboard shows invite button. Invited user sees Accept/Decline alert.

---

## 5. VOTING & CONTRIBUTION MECHANICS

### 5.1 Voting

**Hidden at Stages 1, 2, 3. Visible only from Stage 4.**

Direction: FOR / AGAINST / UNDECIDED. Strength: 0–5 in 0.5 increments.
Quality flags (optional): "It doesn't go far enough" / "It goes too far" / "It's poorly worded."
All votes raw and equal for counting. One vote per user per idea.

### 5.2 Contribution Types

"Contributions" not "Comments" in all UI. Types (contributor selects):
1. New Information
2. Red Team Challenge (must target a strike zone)
3. Minor Adjustment Suggestion
4. Additional Coherent Action Suggestion
5. Amendment
6. Other

One point per contribution. Lex reminds: different points need separate contributions.

### 5.3 Contribution Display

Numbered sequentially per idea. Groupable ("Group with contribution 12"). Up to 10 shown as snippets, ranked by quality rating DESC then author credibilityScore DESC. Groups collapsed. "Show more" at 10+.

### 5.4 Passion Score

Average strength across non-withdrawn votes. Range 0.0–5.0. Public.

---

## 6. MP & PEER ENDORSEMENTS

Gate for Stage 4→5: **≥3 MP AND ≥3 Peer endorsements (separate counts).**

MPs, Peers, and manualCredibilityOverride users see "Below Standard" button → creates IdeaReview record (outcome=BELOW_STANDARD).

---

## 7. PARLIAMENTARY DRAFTSMAN ENDORSEMENT

Required alongside MP+Peer endorsements for Stage 4→5. Legal quality certificate. Available Stage 4+ only.

---

## 8. REFERRAL & TRACKING LINK SYSTEM

Every user has a permanent referral code. Links: `/idea/[id]?ref=[code]`.
Attribution hierarchy: server session > localStorage > 60-day cookie.
Qualification: 30 days + 3 actions.

---

## 9. REFERRAL LANDING PAGES

**"What is Scrutinise?" section on all referral pages must read:**
> "Scrutinise is a not-for-profit platform where citizens, experts, and MPs develop policy ideas into Parliament-ready legislation. Every idea goes through five stages — Create, Draft, Develop, Campaign, **Legislate** — with Lex AI guidance and community scrutiny at each step."

The word "Parliament" must not appear as a stage name on referral pages. "Legislate" is the correct Stage 5 name.

---

## 10. FILE, MEDIA & LINK ATTACHMENTS

R2 storage. ClamAV on PDFs. Google Safe Browsing on URLs. Limits: PDFs 10MB, images 5MB, 10 uploads/day.

---

## 11. OFFLINE MODE & SYNC

Deferred to Sprint 2. Dexie.js + service worker planned.

---

## 12. ANTI-GAMING & ABUSE PREVENTION

No automated suspension — always a human Admin decision. Innocent until proven guilty.

Hard limits: votes 20/hr per IP, 10 uploads/day, 3 merge proposals/month, 1 broadcast per idea per 7 days.

---

## 13. NOTIFICATIONS & COMMUNICATION

| Event | Who notified |
|-------|-------------|
| Stage 1→2 automatic advance | Owner (Lex achievement message) |
| New vote | Owner |
| Stage eligibility crossed | Owner |
| New contribution | Owner |
| New amendment | Owner |
| Amendment notification clicked | → Amendments tab of the idea (not generic notifications page) |
| Amendment accepted | Amendment author |
| Parliamentary endorsement | Owner |
| Merge proposed | Both owners |
| Owner broadcast | All voters |
| Stage change | All voters + subscribers |
| Message received | Recipient |
| Moderation action | Content owner + reporter |
| Moderator invitation (credibility 500) | Admin alert → invited user |
| Owner Thank You badge | Recipient |

---

## 14. PRIVATE MESSAGING

1:1 DMs in v1. TeamMessage entity for idea team group messaging. AES encrypted at rest.

---

## 15. IDEA MERGING

Both ideas need ≥5 votes. Max 3 proposals/month. 30-day negotiation. Owner-consensual only. 14-day voter withdrawal after acceptance.

---

## 16. GDPR & EMAIL SUPPRESSION

One-click unsubscribe on every email. Deletion: 30-day grace → anonymise → suppress.
Data export: R2 signed URL, 7-day expiry, 72hr target.

---

## 17. SEO & ANALYTICS

GA4 on all pages. SEO on Stage 3+ pages. robots.txt: allow Stage 3+, disallow 1/2. sitemap.xml for Stage 4+ ideas.

---

## 18. PRIVACY LOG

Admin/SuperAdmin access to another user's idea → ActivityLog (accessType=ADMIN_ACCESS, accessReason required).

Admin panel: reason-selection dropdown before loading another user's idea.

Privacy Log tab (owner-only, idea detail page): green banner if no admin access; amber if any occurred with detail.

Promise in Privacy Policy: all internal human access is logged and visible to idea owner in real time.

---

## 19. LEX AI MODES

Three modes, selectable in Settings and on idea creation. **Default: Collaborative.**

| Mode | Identifier | User-facing description |
|------|-----------|------------------------|
| Collaborative | COLLABORATIVE | "Lex will work through each step with you and contribute text suggestions where you are unsure what to write. For most users." |
| Socratic | SOCRATIC | "Lex will ask you questions to inspire you in ways to improve and strengthen your idea but will leave you in total control of the wording. For experts." |
| Direct | DIRECT | "Lex will give you the answer, prepare the draft, and prepare the research based on your direction and approvals." |

Mode stored as `aiPreferredStyle` on User entity (existing field). Value: COLLABORATIVE / SOCRATIC / DIRECT. Injected into every Lex API call as `{{lexMode}}` in runtime context.

---

## 20. USER ONBOARDING & PREFERRED NAME

**Preferred name:** Collected during Clerk sign-up as a custom field. Labelled "How would you like Lex to address you?" Defaults to first name. Editable in Account Settings.

Stored as `preferredName` on User entity. Injected into Lex runtime context as `{{preferredName}}`.

Lex uses it naturally and sparingly — once on first return to a session.

**Stage 1 — No upfront registration gate.** User lands on Create and Lex is already there. Account creation triggered only after first Strategic Kernel draft (`triggerSavePrompt: true`).

---

## 21. REFERRAL MECHANICS, POINTS, AND CREDIBILITY: END-TO-END

*How points are earned, how referrals work, how Teambuilder cascades, and how it all feeds into the Credibility Score.*

### 21.1 — The five point categories

All users accumulate points across five categories. Points are permanent and never decay.

**Strategist** points reward idea development: starting and advancing ideas, completing core fields, adding research, voting on others' ideas. Capped per action type to prevent farming.

**Thinker** points reward intellectual contribution: submitting contributions (comments, challenges, amendments), receiving quality ratings from other users, having amendments accepted. Quality-weighted: a 5★ rated contribution earns 3× what a bare submission earns.

**Rallymaster** points reward community growth: inviting people who join and then qualify (complete 3 meaningful actions within 30 days of sign-up). The qualification requirement means Rallymaster points reflect genuine introductions, not spam invites.

**Teambuilder** points reward building a productive network: automatically calculated as 30% of every direct recruit's Strategist + Thinker + Rainmaker points, plus 10% of their recruits' equivalent total. Circular chains are blocked. No action required — these accrue passively as your network contributes.

**Rainmaker** points reward fundraising. Deferred to Sprint 2. £1 raised = +50 points.

### 21.2 — How referral links work

Every user has a permanent referral code stored on their User record. Referral links take two forms: idea-specific (`scrutinise.org/ideas/[id]?ref=[code]`) and general (`scrutinise.org?ref=[code]`). When a user follows a referral link, attribution is stored in three layers in priority order: server session (most reliable), localStorage, and a 60-day cookie. The referring user's code is preserved through sign-up.

**Qualification:** A referred user qualifies — triggering the Rallymaster +75 award to the referrer — when they complete 3 meaningful actions within 30 days of signing up. Meaningful actions are: submitting a contribution, voting, adding research, completing a field on their own idea, or advancing an idea to a new stage. Account creation alone does not qualify.

**What fires on qualification:** A ReferralEvent record is updated with `qualifiedAt`. The referring user receives a Notification. The PointsLedger is updated with REFERRAL_QUALIFIED.

### 21.3 — Teambuilder cascade

When User B (recruited by User A) earns Strategist or Thinker points, User A automatically receives 30% of that amount as Teambuilder points. When User C (recruited by User B) earns points, User A receives 10%. The chain stops at two levels. Circular chains are detected at referral attribution and blocked.

Teambuilder points appear in the PointsLedger with `category: TEAMBUILDER` and `reason: TEAMBUILDER_CASCADE`. The UI shows "from your network" — individual source users are not named.

### 21.4 — The Phase 1 / Phase 2 transition at 350 points

Below 350 raw points, users are in Phase 1 (BUILDING). Their displayed Credibility Score is their raw point total with a "Building credibility..." progress bar toward 350.

At 350 points, a transition notification fires: *"You've built enough credibility on Scrutinise to join the expert tier. From now on, your credibility score reflects how other experts on the platform rate your contributions — not just your activity. Your current score is [X]. Keep contributing quality work and it will grow."* The progress bar is replaced by a percentile display vs all Phase 2 users.

In Phase 2, the Credibility Score is a percentile-normalised figure calculated from weighted inputs: Thinker (highest), parliamentary endorsements received (highest), Strategist (medium), Expert Badges (medium), Rallymaster (low), Teambuilder (low), account age (very low).

### 21.5 — Credibility vs other point categories

Credibility Score is the quality indicator. It is dominated by Thinker points and community feedback. Rallymaster and Teambuilder points have low weight in the credibility calculation — they can grow without bound and do not distort the quality signal.

The other categories serve different purposes: Rallymaster and Teambuilder are displayed on profiles and used for peer recognition and team-building mechanics. They are not subordinate to Credibility — they measure different things.

### 21.6 — What the user sees

On their profile page: points broken down by category (Strategist / Thinker / Rallymaster / Teambuilder / Rainmaker), their current Credibility Score, and whether they are Phase 1 or Phase 2. In Phase 1 a progress bar shows how far to 350. In Phase 2 their percentile rank is shown ("Top 23% of contributors"). The points breakdown is visible to the user only — other users see the Credibility Score number only.

### 21.7 — Build status

The ReferralEvent and PointsLedger entities exist in the schema. V2A implements the full points award function with cap checking, Teambuilder cascade, and referral qualification logic in `lib/points.ts`. The points system is wired to stage gates, contribution routes, vote route, and idea PATCH route.

---

*system_mechanics_v0.8.md — Scrutinise — 13 April 2026*
