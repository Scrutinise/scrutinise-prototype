# SCRUTINISE — SYSTEM MECHANICS v0.7
*How the platform calculates, decides, and adjudicates behind the scenes.*
*Last updated: 22 March 2026*
*Changes from v0.6: Stage gates overhauled, voting suppressed until Stage 4, Stage 5 = Legislate, contributions terminology, group types renamed, credibility-weighted rating, contribution types, amendment counter-proposal, AI modes spec, notification routing rules, privacy log, preferred name field.*

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

**Strategist:** Awarded when idea receives votes. +10 per vote, −10 on withdrawal.

**Thinker:** From contribution ratings (−5 to +5). 5 stars = 10× value of 3 stars. +150 bonus when amendment accepted after 7-day cooling-off. Red Team bonus for validated challenges against ideas the contributor voted against. WikiTrust longevity rule: if a contribution is retracted or heavily down-rated, contributor loses more than they gained.

**Rallymaster:** +100 on referral qualification (30 days + 3 actions). Merge ported votes × 10.

**Rainmaker:** £1 raised = +50. Deferred Sprint 2.

**Teambuilder:** 30% of direct recruits' Strategist+Thinker+Rainmaker. 10% of their recruits'. Circular chains blocked.

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

*system_mechanics_v0.7.md — Scrutinise — 22 March 2026*
