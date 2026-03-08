# SCRUTINISE — WIREFRAMES v3
*All wireframe pages with audit corrections applied.*
*Source: 05b_COMPLETE_WIREFRAME_SET.md + Wireframe_Audit_responses.xlsx*
*Last updated: March 2026*

---

## CONTENTS

**Public / Guest Pages**
- [WF-01 Homepage (Guest)](#wf-01-homepage-guest)
- [WF-02 Browse Ideas](#wf-02-browse-ideas)
- [WF-03 Idea Detail Page (Guest)](#wf-03-idea-detail-page-guest)
- [WF-04 Vote on Idea](#wf-04-vote-on-idea)
- [WF-05 Referral Landing Page — Idea](#wf-05-referral-landing-page--idea)
- [WF-06 Referral Landing Page — User Profile](#wf-06-referral-landing-page--user-profile)

**Authentication**
- [WF-08 Registration](#wf-08-registration)
- [WF-09 Login](#wf-09-login)

**Logged-In Core**
- [WF-10 Dashboard](#wf-10-dashboard)
- [WF-11 Create Idea — Lex Interface](#wf-11-create-idea--lex-interface)
- [WF-12 Idea Detail — Owner View](#wf-12-idea-detail--owner-view)
- [WF-13 Idea Detail — Tabs Detail](#wf-13-idea-detail--tabs-detail)
- [WF-14 Amendments Tab](#wf-14-amendments-tab)
- [WF-15 Propose Amendment](#wf-15-propose-amendment)
- [WF-16 Owner Reviews Amendment](#wf-16-owner-reviews-amendment)
- [WF-17 Comments Tab](#wf-17-comments-tab)
- [WF-18 Rate a Comment](#wf-18-rate-a-comment)
- [WF-19 Research Tab](#wf-19-research-tab)
- [WF-20 Add Research](#wf-20-add-research)
- [WF-21 Wording History Tab](#wf-21-wording-history-tab)

**Collaboration**
- [WF-22 Invite Collaborator](#wf-22-invite-collaborator)
- [WF-23 Groups Dashboard](#wf-23-groups-dashboard)
- [WF-24 Create Group](#wf-24-create-group)
- [WF-25 Group Detail](#wf-25-group-detail)

**Endorsements**
- [WF-26 Parliamentary Endorsements Section](#wf-26-parliamentary-endorsements-section)
- [WF-27 Give Endorsement Modal](#wf-27-give-endorsement-modal)
- [WF-28 Claim Parliamentary Status](#wf-28-claim-parliamentary-status)
- [WF-29 Claim Draftsman Status](#wf-29-claim-draftsman-status)

**Profile & Settings**
- [WF-30 User Profile (Public)](#wf-30-user-profile-public)
- [WF-31 Account Settings](#wf-31-account-settings)
- [WF-32 Notifications](#wf-32-notifications)

**Admin**
- [WF-33 Admin Dashboard](#wf-33-admin-dashboard)
- [WF-34 Moderation Queue](#wf-34-moderation-queue)

---

> **NOTE:** WF-07 (Anonymous Voting) has been deleted. Anonymous voting is not supported. Email verification is required before voting.

---

## WF-01 HOMEPAGE (GUEST)

**URL:** `/`

**Purpose:** Introduction to Scrutinise for first-time visitors. Clear call to action.

**Layout:**
- Nav: Logo | Browse Ideas | About | Sign Up | Log In
- Hero: Large headline — "Turn your idea into a law." Subhead explaining the 5-stage process. Two CTAs: "Get Started" (→ signup) and "Browse Ideas" (→ WF-02)
- How it works: 5-stage visual (Create → Draft → Develop → Campaign → Parliament) with brief description of each
- Featured ideas: 3–4 idea cards from Stage 4+ (most voted, most recent)
- Stats bar: Total ideas, total votes cast, MPs engaged
- Footer: About | Privacy | Terms | Contact

---

## WF-02 BROWSE IDEAS

**URL:** `/ideas`

**Purpose:** Discover and filter ideas on the platform. Shows Stage 4 (Campaign) and Stage 5 (Parliament) ideas only.

**Layout:**
- Page header: "Ideas" + count
- Filter bar (horizontal): Area of Government (dropdown) | Stage (Campaign / Parliament) | Sort by (Most Votes / Most Recent / Most Comments / Most Views) | Search box
- Default sort: Most recent activity
- Idea cards grid (2–3 columns desktop, 1 mobile):
  - Each card: Title | SummaryDescription (truncated) | Stage badge | Vote count | Comment count | Endorsement icon (if any) | Owner name
- Pagination or infinite scroll
- "Developing" ideas (Stage 3) NOT shown here

---

## WF-03 IDEA DETAIL PAGE (GUEST)

**URL:** `/ideas/[id]`

**Purpose:** Full idea view for guests and logged-in users who don't own the idea.

**Layout:**
- Idea header: Title | Stage badge | Vote count | Passion score | Vote button (triggers login if guest) | Owner name + avatar | Created date | Area of Government
- Summary section: summaryDescription
- Tabs: Overview | Amendments | Comments | Research | Wording | History

**Overview tab:**
- Diagnosis section
- Guiding Policy section
- Coherent Actions list (numbered)
- Target Legislation (if applicable)
- Parliamentary Endorsements section (visible to guests — see WF-26)
- Parliamentary Draftsman Certificate (if applicable)

**All tabs visible to guests at Stage 3+.**

---

## WF-04 VOTE ON IDEA

**Correction applied:** Vote is direction (FOR / AGAINST / UNDECIDED) plus a 0–5 strength/certainty slider in 0.5 increments. No single bipolar scale. No anonymous voting.

**Trigger:** User clicks vote button on idea page.

**If not logged in:** Email capture modal → signup → return to vote.
**If logged in but not email-verified:** Prompt to verify email first.

**Vote UI (logged-in, email-verified):**

Step 1 — Direction:
- Three buttons: FOR | AGAINST | UNDECIDED
- Selected state clearly highlighted

Step 2 — Strength/certainty slider (shown after direction selected):
- Slider: 0–5 in 0.5 increments
- Current value shown numerically above slider
- Contextual label changes based on direction:
  - FOR: "0 — barely convinced → 5 — passionately behind this"
  - AGAINST: "0 — barely opposed → 5 — passionately against"
  - UNDECIDED: "0 — I don't care about this issue → 5 — I care a lot but can't decide yet"

Step 3 — Quality flags (optional, shown below slider):
- Checkbox: "It doesn't go far enough"
- Checkbox: "It goes too far"
- Checkbox: "It's poorly worded"
- Label: "Optional — help the owner improve this idea"

Submit Vote button.

If previously voted: current direction and strength shown, can change.

**After voting:**
- Confirmation shown
- Passion score updated on idea page
- If Stage 3 with <25 votes: progress bar shown — "X more votes to Campaign status"
- Owner vote target (if set): "X of [target] votes"

---

## WF-05 REFERRAL LANDING PAGE — IDEA

**URL:** `/ideas/[id]?ref=[code]`

**Purpose:** When a user shares an idea via referral link, this is what the recipient sees.

**Layout:**
- Idea header: Title | Stage badge | Vote count | Passion score | Large vote button
- summaryDescription
- Diagnosis summary
- Guiding Policy summary
- Coherent Actions list
- Parliamentary Endorsements (full — visible to guests)
- "What is Scrutinise?" explainer section
- Login/signup prompt (contextual based on cookie state)

**Cookie states:**
- New visitor: "What is Scrutinise?" + signup prompt
- Returning, not logged in: "Welcome back [name]" + login prompt
- Logged in: vote button active, no login prompt

---

## WF-06 REFERRAL LANDING PAGE — USER PROFILE

**URL:** `/user/[username]?ref=[code]`

**Purpose:** User shares their profile as a referral landing page.

**Layout:**
- User header: Avatar | Display name | Credibility Score | Expert Badges
- Their ideas: cards with vote counts and stage badges
- Their contributions: recent comments and amendments
- "What is Scrutinise?" explainer
- Contextual login/signup prompt

---

## WF-08 REGISTRATION

**URL:** `/sign-up`

**Correction applied:** Phone number is required, not optional.

**Fields:**
- First name (required)
- Last name (required)
- Email address (required)
- Phone number (required)
- Password (required — or magic link option)
- "I agree to Terms of Service and Privacy Policy" checkbox (required)

**Post-signup:**
- Double opt-in email sent
- Account inactive until email verified
- On verification: redirected to dashboard

---

## WF-09 LOGIN

**URL:** `/sign-in`

**Layout:**
- Email + password form
- "Email me a login link" option (magic link)
- "Forgot password?" link
- "Don't have an account? Sign up" link

---

## WF-10 DASHBOARD

**URL:** `/dashboard`

**Purpose:** Logged-in home. Personalised overview.

**Layout:**
- Greeting: "Welcome back, [Name]"
- Account summary row: Credibility Score | Points breakdown (Strategist / Thinker / Rallymaster / Teambuilder) | Expert Badges
- AI credits balance + "Top up" link
- My Ideas section: List of ideas with stage badge, vote count, progress indicator. "New Idea" button prominent.
- My Contributions: Recent comments, amendments, ratings — click through to each
- Notifications: Recent unread (2–3 shown, "View all" link)
- Messages: Unread count

---

## WF-11 CREATE IDEA — LEX INTERFACE

**URL:** `/ideas/create`

**Purpose:** Primary idea creation interface. Lex guides via conversation — not a form.

**Layout (desktop, two-panel):**

**Left panel — Chat:**
- Lex message history (scrollable)
- Input box at bottom: "Type your reply..."
- Send button
- Lex avatar / indicator

**Right panel — Summary:**
- Live idea summary — updates as fields complete
- Navigation: hierarchical list of fields with completion indicators:
  - ✅ Complete (green) — field populated and confirmed
  - ◐ Draft (amber) — field partially populated
  - ○ Empty (grey) — not yet reached
- Completed fields shown with content, expandable
- Empty fields ahead NOT shown (prevents anchoring)
- "Return to where I was →" button always visible when reviewing a completed field

**Field review interaction:**
When user clicks a completed field:
- Hover overlay: "You're reviewing [Field Name]. To edit with Lex's help, click 'Discuss with Lex'. To edit directly, click 'Edit text'."
- "Discuss with Lex" → re-enters conversation focused on that field
- "Edit text" → inline editor on field in summary panel

**Mobile:**
- Single panel: chat primary
- "View summary" button opens summary as drawer from bottom

---

## WF-12 IDEA DETAIL — OWNER VIEW

**URL:** `/ideas/[id]` (when user is owner)

**Purpose:** Owner sees everything a guest sees plus owner-specific controls.

**Additional elements vs guest view:**
- "Progress to [Next Stage]" button (shown when gate criteria met)
- "Stage Requirements" checklist (when gate not yet met)
- **Vote analytics panel:** FOR / AGAINST / UNDECIDED counts | Passion score | Strength distribution chart | Quality flag tallies ("X voters said it doesn't go far enough" etc.) | Export data button
- "Broadcast to Voters" button (Voters tab)
- "Archive Idea" in settings menu
- Edit controls on non-wording fields
- Reply button on comments (owner only)
- Accept/Reject/Request Revision controls on pending amendments

---

## WF-13 IDEA DETAIL — TABS DETAIL

**Tabs:**
1. Overview (default)
2. Amendments
3. Comments
4. Research
5. History (not "Timeline" — correction applied)
6. Wording

**Wording tab:** Shows ProposedWording in full. If wordingLocked: shows "Changes require amendment process" notice. If owner at Stage 1–2: inline edit available.

**History tab:** Chronological log of all idea events (stage changes, amendment acceptances, ownership changes, wording edits).

---

## WF-14 AMENDMENTS TAB

**Purpose:** View all amendments proposed on this idea.

**Layout:**
- Filter: All | Pending | Accepted | Rejected | Consulting
- Amendment cards: proposer name, summary of change, vote tally (support/oppose), status badge, date
- "Propose Amendment" button (for all users at Stage 3+)
- Pending amendments highlighted for owner

**Amendment card detail (expanded):**
- Current wording (left) | Proposed wording (right) — diff highlighted
- Rationale text
- Research links
- Vote tally
- Owner controls (if owner): Accept Mode A | Accept Mode B | Request Revision | Reject

---

## WF-15 PROPOSE AMENDMENT

**Purpose:** Form for proposing a wording change.

**Fields:**
- Select section to amend (dropdown — which CoherentAction or which part of ProposedWording)
- Current text (auto-populated, read-only)
- Proposed text (editable — shows diff in real-time as user types)
- Rationale (required, text area)
- Supporting research URLs (optional, add multiple)
- Relevant legislation (optional, text)
- Submit button

---

## WF-16 OWNER REVIEWS AMENDMENT

**Purpose:** Owner action interface for a pending amendment.

**Layout:**
- Full amendment detail: current vs proposed diff | rationale | votes | research
- Action buttons:
  - "Circulate for Consultation" (Mode A — recommended, shown prominently)
  - "Accept Amendment" (Mode B — shows warning modal)
  - "Request Revision" (opens text field for guidance)
  - "Reject" (opens text field for reason)
- Mode A warning (if skipping): "Accepting without consultation may cause voters to withdraw. We recommend circulating for consultation first."

---

## WF-17 COMMENTS TAB

**Purpose:** Flat comment list with owner-reply threading.

**Layout:**
- Sort controls: Most helpful | Most recent | Most critical | Most supportive
- Add comment button (logged-in users only at Stage 3+)
- Comment cards:
  - Author name | Credibility Score | Stance badge (Supportive/Critical/Neutral/Question)
  - Comment text
  - Rate button | Report button
  - Owner reply (indented) if exists

**Stance filter:** All | Supportive | Critical | Neutral | Question

---

## WF-18 RATE A COMMENT

**Correction applied:** Not a simple 5-star rating. Multi-flag system with positive and negative boxes.

**Layout:**
- Section 1 — Positive flags (tick what applies):
  Constructive | Insightful | Relevant | Fresh perspective | Balanced | Helpful facts | Direct experience | Good question

- Section 2 — Negative flags / logical issues (tick what applies):
  Ad hominem | Straw man | Red herring | False dilemma | Slippery slope | Moving goalposts | Motte-bailey | Tu quoque | Cherry picking | Not relevant

- Note field (optional): "What specifically prompted this rating?"

- Submit Rating button

**Note:** Rating credibility is weighted by the rater's own Credibility Score.

---

## WF-19 RESEARCH TAB

**Purpose:** All research attached to this idea.

**Layout:**
- Filter: All | For the policy | Against the policy | Academic | Government | News
- Sort: Most constructive | Most recent
- Add Research button (owner + editors at Stage 2+; all users at Stage 3+)
- Research cards: title | source type badge | snippet | relevance explanation | for/against indicator | source link | attached files

---

## WF-20 ADD RESEARCH

**Purpose:** Form for adding a research record.

**Fields:**
- Title (required)
- Snippet — key finding (required, short)
- Relevance explanation (required)
- Summary of content
- Source URL (required — Google Safe Browsing validated)
- Source type: Academic | Government | News | Case Study | Legislation | Other
- For this policy: Yes / No
- For proposed action: Yes / No
- Constructive score (self-assessed, 1–5)
- Attach file (PDF, max 10MB — optional)
- Submit button

---

## WF-21 WORDING HISTORY TAB

**Purpose:** Audit trail of all ProposedWording versions.

**Layout:**
- Version list in reverse chronological order
- Each entry: version number | date | changed by | change type (Direct Edit / Amendment Accepted / Owner Edit)
- Click to expand: shows full ProposedWording text for that version
- Diff view available between any two versions

---

## WF-22 INVITE COLLABORATOR

**Purpose:** Owner invites someone to collaborate on an idea at Stage 2.

**Fields:**
- First name (required)
- Last name (required)
- Email (required)
- Phone (optional)
- Role: Editor / Viewer
- Custom message (pre-populated with default, editable)
- Send Invitation button

---

## WF-23 GROUPS DASHBOARD

**URL:** `/dashboard/groups` or accessible from Profile

**Purpose:** Manage all groups the user belongs to or owns.

**Layout (Owner/Admin):**
- "My Groups" heading
- Group cards: name | member count | type badge | role badge (Owner/Admin/Member)
- "Create Group" button
- For each owned group: manage link

**Note:** Only group owners and admins see the full group dashboard. Regular members see their group membership in their own dashboard only.

---

## WF-24 CREATE GROUP

**Fields:**
- Group name (required)
- Description (optional)
- Group type: Collaborators | Supporters | Public
- Add initial members: enter email addresses
- Create Group button

---

## WF-25 GROUP DETAIL

**Owner/Admin view:**
- Group header: name | type | member count | invite link (copy button)
- Member list: name | role | joined date | remove button
- Add members: email input
- Group settings: edit name/description, delete group
- Ideas associated with this group (filterable)

---

## WF-26 PARLIAMENTARY ENDORSEMENTS SECTION

**Purpose:** Displays on idea page — visible to guests at Stage 3+.

**Layout:**
- "Parliamentary Endorsements" heading + count badge
- Each endorsement card:
  - MP/Peer name | Role | Constituency (for MPs) / Peerage (for Peers)
  - Public statement (if provided)
  - Endorsed date
- "This idea has [N] parliamentary endorsement(s)" summary line
- If logged-in verified MP/Peer: "Endorse this Idea" button shown
- Required count for Stage 5 shown: "[N] of 3 required endorsements"

---

## WF-27 GIVE ENDORSEMENT MODAL

**Available to:** Verified MPs and Peers only (parliamentary_verified=true).

**Layout:**
- Idea title and summary shown
- Your role and constituency/peerage shown (auto-populated from profile)
- Public statement field (optional, text area, 1000 char limit)
- "Your endorsement will be publicly displayed on this idea and on all referral landing pages."
- Endorse button | Cancel

---

## WF-28 CLAIM PARLIAMENTARY STATUS

**URL:** Profile → Settings → "Claim Parliamentary Status"

**Fields:**
- Role: MP | Member of the House of Lords
- Constituency (MPs only, required)
- Peerage title (Peers only, required)
- Parliament.uk profile URL (required — for manual verification)
- Submit claim button

**After submission:**
- "Your claim is under review. We'll notify you when it has been verified."
- Status shown as "Pending verification" badge on profile

---

## WF-29 CLAIM DRAFTSMAN STATUS

**URL:** Profile → Settings → "Claim Professional Status"

**Fields:**
- Role: Parliamentary Draftsman / Legislative Counsel
- Firm or Chambers (required)
- Professional credentials (required)
- Licence or bar number (optional)
- Upload supporting document: PDF (max 5MB, required)
- Submit claim button

---

## WF-30 USER PROFILE (PUBLIC)

**URL:** `/user/[username]`

**Purpose:** Public profile page for any user.

**Layout:**
- Avatar | Display name | Username | Bio
- Credibility Score (Phase 1: raw number + progress bar; Phase 2: normalised score)
- Expert Badges (top 3 subject areas)
- Points breakdown: Strategist | Thinker | Rallymaster | Teambuilder
- Parliamentary verification badge (if verified)
- Professional verification badge (if verified)
- Their ideas (public ones only): cards with vote counts and passion scores
- Their contributions: recent highly-rated comments and accepted amendments
- **"Follow" button** — follows this user, generating notifications on their new ideas and stage changes. Stores a Follow record (followedUserId set). Shows "Following" when already followed.

---

## WF-31 ACCOUNT SETTINGS

**URL:** `/settings`

**Sections:**
1. Account: display name, username, email, password, bio, expertType, politicalParty
2. Privacy: Download my data | Delete my account
3. Notifications: per-type toggles + global email toggle
4. AI: preferred interaction style, credit balance, top-up

---

## WF-32 NOTIFICATIONS

**URL:** `/notifications` or slide-out panel from nav bell

**Layout:**
- Filter tabs: All | Votes | Comments | Amendments | Merges | Endorsements | System
- Notification list: type icon | message | timestamp | read/unread indicator
- "Mark all as read" button
- Click notification → navigate to relevant content

---

## WF-33 ADMIN DASHBOARD

**URL:** `/admin`
**Access:** Admin and Super Admin roles only.

**Layout:**
- Summary metrics panel: total accounts | active users | ideas by stage | votes cast | comments | amendments — all filterable by time period (hour / day / week / month / year / all time)
- Trend indicators vs previous period
- Quick links: Moderation queue | Verification queue | User management | Platform config
- Recent activity feed: real-time log of platform events

---

## WF-34 MODERATION QUEUE

**URL:** `/admin/moderation`

**Layout:**
- Queue ordered by: flag count (primary) + recency (secondary)
- Each item: content type badge | flag reason | flag count | reporter name | full content in context
- Actions (per role — see permissions matrix):
  - Dismiss | Hide | Remove | Warn user | Suspend account
- Bulk dismiss (same flag type)
- Moderation history tab

---

*wireframes_v3.md — Scrutinise — March 2026*
*Total: 34 wireframe pages (WF-01 to WF-34, WF-07 deleted)*
*Corrections applied from Wireframe Audit v3 responses.*

---

## WF-35 TRAINING PAGE

**URL:** `/training`

**Purpose:** Library of training resources for users at any stage of the process. Sprint 1: YouTube embeds only.

**Layout:**
- Page header: "Training" + brief description
- Filter bar: Stage (Create / Draft / Develop / Campaign / Parliament / All) | Topic | Difficulty (Beginner / Intermediate / Advanced) | Type (Video / Article / Podcast)
- Resource cards grid:
  - Each card: Title | Type badge | Author | Duration | Stage tag | Rating (0–5) | Watch/Read button
- Click card → opens resource (YouTube embed or external link in new tab)
- "Watch" button on video cards triggers inline embed below card

**Admin only:** Publish/unpublish resources. Add new resources via admin panel.

---

## WF-36 FOLLOW / WATCH

**No dedicated page** — follow/watch actions are triggered inline:

**Follow a user:** "Follow" button on WF-30 (User Profile). Stores Follow record (followedUserId).

**Watch an idea:** "Watch" button on WF-03 / WF-05 idea header (shown to logged-in users who are not the owner). Stores Follow record (watchedIdeaId).

**Notification triggers from follows/watches:**
- Following a user: notified when they publish a new idea (Stage 3+)
- Watching an idea: notified on stage changes, new amendments, new comments

**Followed/Watched items shown in dashboard (WF-10):** "Watching" section showing watched ideas with recent activity. "Following" section showing followed users' recent ideas.

---

*wireframes_v3.md — Scrutinise — March 2026 (updated)*
*Total: 36 wireframe pages (WF-01 to WF-36, WF-07 deleted)*
*Corrections applied from Wireframe Audit v3 responses. New: WF-35 Training, WF-36 Follow/Watch.*
