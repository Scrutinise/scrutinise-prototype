# SCRUTINISE — CLICKABLE PROTOTYPE BRIEF
*Complete guide for building the interactive prototype*
*Last updated: March 2026*

---

## CONTENTS

1. [Current Codebase State](#1-current-codebase-state)
2. [Target File Structure](#2-target-file-structure)
3. [Mock Data Objects](#3-mock-data-objects)
4. [Scripted Lex Conversation](#4-scripted-lex-conversation)
5. [Component Specifications](#5-component-specifications)
6. [Five User Journeys](#6-five-user-journeys)
7. [Terminology Reminders](#7-terminology-reminders)
8. [Styling Guidelines](#8-styling-guidelines)
9. [Deployment Notes](#9-deployment-notes)
10. [Recommended Build Order](#10-recommended-build-order)

---

## 1. CURRENT CODEBASE STATE

### What Exists ✅

**Core Infrastructure:**
- Next.js 14 App Router project structure
- Clerk authentication integration (sign-in/sign-up pages)
- Tailwind CSS + shadcn/ui components
- TypeScript configuration
- Mock data system (`lib/mockData.ts`) with Stage types, Ideas, Users, Comments, Amendments, Notifications

**Pages Built (9 total):**
1. `/` — Homepage with hero section (RevolutHero component)
2. `/about` — About page with project description
3. `/prototype` — Prototype landing page with 5 user journey cards
4. `/prototype/create/stage1` — Simple form (title + summary input)
5. `/prototype/create/stage2` — Full Lex chat interface with two-panel layout
6. `/prototype/browse` — Idea browser with filters (area, stage, search)
7. `/prototype/idea/[id]` — Idea detail page with tabs (Overview, Research, Amendments, History)
8. `/prototype/dashboard` — User dashboard showing ideas, notifications, stats
9. `/prototype/amendment/[id]` — Amendment review page with diff view
10. `/prototype/admin` — Admin moderation queue

**Components Built (14 total):**
- `LexChat.tsx` — Scripted chat interface with typing indicator
- `VoteWidget.tsx` — Direction + strength slider voting UI ✅ (matches spec)
- `SummaryPanel.tsx` — Right panel showing idea fields as they populate
- `DiffView.tsx` — Side-by-side text comparison for amendments
- `AIFuelGauge.tsx` — Visual fuel remaining indicator
- `UserSwitcher.tsx` — Demo user role switcher
- `PrototypeBanner.tsx` — Prototype notice banner
- `RevolutHero.tsx` — Homepage hero section ✅ (stage names fixed)
- Plus shadcn/ui components in `/components/ui/`

**Context & Utilities:**
- `context/UserContext.tsx` — Mock user state management
- `lib/mockData.ts` — All mock data types and objects ✅ (comment ratings fixed to multi-flag system)
- `lib/lexScripts.ts` — Two scripted Lex conversations

**What's Working:**
- All navigation between pages functional
- Stage names correctly use Create/Draft/Develop/Campaign/Parliament
- Voting UI matches spec (direction + strength, NOT bipolar scale)
- Mock data drives all content (no database)
- Responsive layouts (desktop + mobile)
- Five user journeys accessible from `/prototype`

### What Doesn't Exist Yet ⚪

**Pages Missing from Wireframes (per WF-01 to WF-36):**
- WF-05: Referral landing page (idea)
- WF-06: Referral landing page (user profile)
- WF-15: Propose amendment form
- WF-22: Invite collaborator form
- WF-23: Groups dashboard
- WF-24: Create group form
- WF-30: User public profile
- WF-31: Account settings
- WF-32: Notifications panel/page
- WF-35: Training page
- Plus any additional pages per implementation_plan.md Section 2

**Components Not Built:**
- Comment rating UI (multi-flag checkboxes) — data structure ready, UI not built
- Comments list with stance badges
- Parliamentary endorsements section
- Stage progress indicator/gate checklist
- Research cards
- Group invitation UI
- Email templates (beyond scope for clickable prototype)

**Backend/API:**
- No API routes (all mock data)
- No database (Prisma schema not implemented)
- No Clerk webhook for user creation
- No AI provider integration
- No file upload (R2 storage)
- No email sending (Resend)

**This is expected** — the prototype is intentionally hard-coded HTML/React with no backend.

---

## 2. TARGET FILE STRUCTURE

### Current Structure (Prototype Phase)

```
scrutinise-web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                            # Homepage
│   ├── about/page.tsx
│   ├── training/page.tsx
│   ├── sign-in/[[...sign-in]]/page.tsx
│   ├── sign-up/[[...sign-up]]/page.tsx
│   ├── prototype/
│   │   ├── page.tsx                        # Journey selector
│   │   ├── layout.tsx
│   │   ├── browse/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── admin/page.tsx
│   │   ├── create/
│   │   │   ├── stage1/page.tsx
│   │   │   └── stage2/page.tsx
│   │   ├── idea/[id]/page.tsx
│   │   └── amendment/[id]/page.tsx
│   └── api/
│       └── health/route.ts                 # Placeholder
├── components/
│   ├── ui/                                 # shadcn components
│   ├── AIFuelGauge.tsx
│   ├── DiffView.tsx
│   ├── LexChat.tsx
│   ├── PrototypeBanner.tsx
│   ├── RevolutHero.tsx
│   ├── SummaryPanel.tsx
│   ├── UserSwitcher.tsx
│   └── VoteWidget.tsx
├── context/
│   └── UserContext.tsx
├── lib/
│   ├── mockData.ts
│   └── lexScripts.ts
└── public/
    └── woman-in-library-by-candlelight.mp4
```

### Recommended Additions for Complete Prototype

```
app/prototype/
├── profile/[username]/page.tsx             # WF-30 User profile
├── settings/page.tsx                       # WF-31 Account settings
├── notifications/page.tsx                  # WF-32 Notifications
├── groups/
│   ├── page.tsx                            # WF-23 Groups dashboard
│   └── create/page.tsx                     # WF-24 Create group
├── invite/[token]/page.tsx                 # WF-22 Invitation landing
└── referral/
    ├── idea/[id]/page.tsx                  # WF-05 Referral LP (idea)
    └── user/[username]/page.tsx            # WF-06 Referral LP (user)

components/
├── CommentList.tsx
├── CommentRatingForm.tsx
├── EndorsementCard.tsx
├── NotificationBell.tsx
├── ResearchCard.tsx
└── StageGateChecklist.tsx
```

---

## 3. MOCK DATA OBJECTS

All mock data is defined in `lib/mockData.ts`. Below are the key objects with example values for prototype pages.

### Types

```typescript
export type Stage = 'Create' | 'Draft' | 'Develop' | 'Campaign' | 'Parliament'
export type UserRole = 'citizen' | 'mp' | 'expert' | 'moderator' | 'admin'
```

### MockUser

```typescript
export interface MockUser {
  id: string
  name: string
  role: UserRole
  credibility: number
  aiFuelRemaining: number
  aiFuelTotal: number
  verified: boolean
  constituency?: string
}

// Example (current default user)
{
  id: 'u1',
  name: 'Alex Chen',
  role: 'citizen',
  credibility: 340,
  aiFuelRemaining: 42000,
  aiFuelTotal: 60000,
  verified: true
}
```

### MockIdea

```typescript
export interface MockIdea {
  id: string
  title: string
  summary: string
  stage: Stage
  country: 'UK' | 'Ireland'
  area: string                              // e.g. "Housing & Energy"
  voteCount: { for: number; against: number; undecided: number }
  passionScore: number                      // Average strength across all votes (0-5)
  commentCount: number
  credibilityScore: number
  ownerId: string
  createdAt: string
  coherentActions: CoherentAction[]
  amendments: Amendment[]
  comments: Comment[]
}

// Example
{
  id: 'idea-1',
  title: 'Mandatory Energy Efficiency Ratings Before Property Sale',
  summary: 'Require all residential properties to achieve...',
  stage: 'Develop',
  country: 'UK',
  area: 'Housing & Energy',
  voteCount: { for: 847, against: 203, undecided: 91 },
  passionScore: 3.8,
  commentCount: 34,
  credibilityScore: 78,
  ownerId: 'u1',
  createdAt: '2025-11-12',
  coherentActions: [/* ... */],
  amendments: [/* ... */],
  comments: [/* ... */]
}
```

### Comment (Updated Structure ✅)

```typescript
export interface Comment {
  id: string
  author: string
  text: string
  createdAt: string
  positiveFlags: string[]                   // NEW: multi-flag system
  negativeFlags: string[]                   // NEW: multi-flag system
  reported?: boolean
}

// Valid positive flags:
// 'constructive', 'insightful', 'relevant', 'fresh_perspective',
// 'balanced', 'helpful_facts', 'direct_experience', 'good_question'

// Valid negative flags:
// 'ad_hominem', 'straw_man', 'red_herring', 'false_dilemma',
// 'slippery_slope', 'moving_goalposts', 'motte_bailey', 'tu_quoque',
// 'cherry_picking', 'not_relevant'

// Example
{
  id: 'c1',
  author: 'Priya S.',
  createdAt: '2025-11-20',
  text: 'This is badly needed. My landlord has been...',
  positiveFlags: ['relevant', 'direct_experience', 'constructive'],
  negativeFlags: []
}
```

### Amendment

```typescript
export interface Amendment {
  id: string
  ideaId: string
  proposedBy: string
  currentWording: string
  proposedWording: string
  status: 'pending' | 'accepted' | 'rejected' | 'consulting'
  createdAt: string
}
```

### Notification

```typescript
export interface Notification {
  id: string
  type: 'amendment' | 'vote' | 'stage' | 'moderation'
  message: string
  ideaId: string
  amendmentId?: string
  createdAt: string
  read: boolean
}
```

### Extending Mock Data

When building new prototype pages, add new mock objects to `lib/mockData.ts`:

```typescript
// Example: Add mock groups
export interface MockGroup {
  id: string
  name: string
  description: string
  type: 'Collaborators' | 'Supporters' | 'Public'
  ownerId: string
  memberCount: number
}

export const MOCK_GROUPS: MockGroup[] = [
  {
    id: 'grp-1',
    name: 'Housing Policy Network',
    description: 'Cross-party group focused on housing legislation',
    type: 'Public',
    ownerId: 'u2',
    memberCount: 47
  }
]
```

---

## 4. SCRIPTED LEX CONVERSATION

Below is an **extended scripted conversation** covering the full idea creation flow (minimum 8 exchanges). This should be used in `lib/lexScripts.ts` for Journey 1 (Create an idea with Lex).

### Full Scripted Journey: Energy Efficiency Idea

```typescript
export const LEX_FULL_JOURNEY: LexMessage[] = [
  // Exchange 1: Opening
  {
    role: 'lex',
    content: `Welcome to Scrutinise. I'm Lex — I'll be helping you develop your idea into something that could genuinely influence policy.

Before we go any further, I want to understand the problem you're trying to solve. Not the solution — the problem. What is actually broken, and who is it broken for?`
  },

  // Exchange 2: User describes problem
  {
    role: 'user',
    content: 'People are living in cold, inefficient homes and paying huge energy bills because landlords and sellers have no incentive to improve them.'
  },

  // Exchange 3: Lex probes for precision
  {
    role: 'lex',
    content: `That's a clear starting point. "No incentive" is doing a lot of work in that sentence — let's be precise about it.

Is the problem that sellers and landlords genuinely don't know their properties are inefficient, or that they know and have calculated it's cheaper not to act?`,
    fieldUpdate: {
      field: 'Problem Statement',
      value: 'Residential properties remain energy inefficient because sellers and landlords face no legal or financial incentive to improve them, resulting in high bills and poor living conditions for occupants.',
      status: 'draft'
    }
  },

  // Exchange 4: User clarifies
  {
    role: 'user',
    content: "They know. An EPC survey is required when selling — they can see the rating. They just don't act because improving it costs money they'd rather not spend."
  },

  // Exchange 5: Lex flags potential objection
  {
    role: 'lex',
    content: `Good — so this is an incentive problem, not an information problem. That matters for the solution design.

You've mentioned EPC ratings. The current system requires disclosure but not improvement. Your proposal is to change that — to make a minimum standard mandatory at point of sale.

I want to flag something before we go further. There's an argument embedded here that might need strengthening: you're assuming that a mandatory standard at point of sale will cause sellers to improve properties, rather than simply reducing the pool of sellable homes or pushing up prices for already-compliant properties. How would you address someone who makes that objection?`,
    fallacyFlag: true
  },

  // Exchange 6: User responds to objection
  {
    role: 'user',
    content: "That's fair. I'd say the grant scheme addresses the financial barrier, and the 2027 deadline gives time to prepare. Properties won't disappear from the market — they'll be improved."
  },

  // Exchange 7: Lex validates and moves to evidence
  {
    role: 'lex',
    content: `That's a reasonable response — the grant scheme does work against the price-shock objection, and a phased deadline is standard legislative practice.

Let me note that down and we'll move to the evidence base. What existing evidence supports the idea that mandatory standards at point of sale actually drive improvement — has this been tried anywhere?`,
    fieldUpdate: {
      field: 'Problem Statement',
      value: 'Residential properties remain energy inefficient because sellers and landlords face no legal or financial incentive to improve them. EPC disclosure is required but improvement is not. A mandatory minimum standard at point of sale would create a direct incentive to upgrade, supported by a grant scheme to avoid market distortion.',
      status: 'complete'
    }
  },

  // Exchange 8: User provides evidence
  {
    role: 'user',
    content: 'The Netherlands has had minimum EPC requirements for social housing since 2020. Scotland has consulted on similar rules. The EU Energy Performance of Buildings Directive is pushing this direction across Europe.'
  },

  // Exchange 9: Lex evaluates evidence
  {
    role: 'lex',
    content: `Good — three relevant reference points. The Netherlands example is the strongest because it's implemented, not consulted on.

I'd want to know one more thing about the Dutch case: what happened to the market in the transition period? Did prices rise, did supply contract, or did it go smoothly? That evidence either strengthens or complicates your proposal.

For now, let me record the comparative evidence and we'll keep moving.`,
    fieldUpdate: {
      field: 'Evidence Base',
      value: 'Netherlands: mandatory EPC standards for social housing from 2020. Scotland: active consultation on similar measures. EU EPBD directive driving harmonisation. Further research needed on Dutch market impact during transition.',
      status: 'draft'
    }
  },

  // Exchange 10: User acknowledges research gap
  {
    role: 'user',
    content: "I'll look into the Dutch transition data. What should we work on next?"
  },

  // Exchange 11: Lex moves to proposed solution
  {
    role: 'lex',
    content: `The next thing I want to understand is your proposed solution in detail — not just "raise the minimum EPC standard" but the exact mechanism.

Specifically: who enforces it, what happens to a seller who can't or won't comply, and how does the grant scheme work — who qualifies, who administers it, and what's the funding source?

These aren't peripheral details. Parliamentary drafters will need all of this, and any gap here is an objection waiting to happen.`,
    fieldUpdate: {
      field: 'Evidence Base',
      value: 'Netherlands: mandatory EPC standards for social housing from 2020. Scotland: active consultation on similar measures. EU EPBD directive driving harmonisation. Dutch market impact during transition: TBC — further research required.',
      status: 'complete'
    }
  },

  // Exchange 12: User describes solution
  {
    role: 'user',
    content: 'Amend the Energy Performance of Buildings Regulations 2012 to require minimum EPC rating C from January 2027. Trading Standards enforce. Grant scheme administered by local authorities, funded by £500m Green Home Improvement Fund, available to households below median income, up to £10k per property.'
  },

  // Exchange 13: Lex validates and structures
  {
    role: 'lex',
    content: `Perfect — those are the specifics we need. Enforcement by Trading Standards is sensible (existing remit, local knowledge). Local authority administration for grants follows the ECO scheme precedent, so there's institutional experience there.

One question: what happens if a seller lists a property below rating C and refuses to improve it? Is the sale blocked, or is there a penalty mechanism?`,
    fieldUpdate: {
      field: 'Proposed Solution',
      value: 'Amend Energy Performance of Buildings Regulations 2012 to require minimum EPC rating C for residential properties listed for sale from January 2027. Trading Standards enforce at local level. Green Home Improvement Fund (£500m) provides grants up to £10,000 to households below median income, administered by local authorities.',
      status: 'draft'
    }
  },

  // Exchange 14: User clarifies enforcement
  {
    role: 'user',
    content: 'The sale would be blocked — you cannot legally complete a sale if the EPC is below C. That creates the forcing function.'
  },

  // Exchange 15: Lex finalizes and asks about affected groups
  {
    role: 'lex',
    content: `Understood — a regulatory gate rather than a penalty after the fact. That's a stronger incentive but also a harder sell politically. Let's make sure we're explicit about who's affected by this.

Who are the main groups impacted, and how? Sellers, obviously. Buyers. Who else?`,
    fieldUpdate: {
      field: 'Proposed Solution',
      value: 'Amend Energy Performance of Buildings Regulations 2012 to require minimum EPC rating C for all residential properties listed for sale from January 2027. Sales cannot legally complete if EPC is below C, creating a regulatory gate enforced by Trading Standards. Green Home Improvement Fund (£500m) provides grants up to £10,000 to low-income households, administered by local authorities.',
      status: 'complete'
    }
  },

  // Exchange 16: User identifies affected groups
  {
    role: 'user',
    content: 'Sellers (especially those with older properties), buyers (may face higher prices short-term), current occupants (benefit from improved homes), construction sector (increased demand for retrofit work), local authorities (administer grants).'
  },

  // Exchange 17: Lex records and asks about coherent actions
  {
    role: 'lex',
    content: `Good breakdown. The construction sector point is important — this creates jobs, which is a political positive.

Now let's turn this into Coherent Actions — the specific legislative or administrative steps needed to implement this. I count at least two:

1. Regulatory amendment (EPC minimum at point of sale)
2. Fund establishment and grant scheme

Are there others, or is that the full set?`,
    fieldUpdate: {
      field: 'Who Is Affected',
      value: 'Property sellers (compliance requirement), buyers (potential short-term price impacts), current occupants (improved living conditions), construction sector (retrofit demand), local authorities (grant administration).',
      status: 'complete'
    }
  },

  // Exchange 18: User confirms actions
  {
    role: 'user',
    content: "That's the core set. Maybe add a third: mandate local authority reporting on fund uptake to track effectiveness."
  },

  // Exchange 19: Lex finalizes coherent actions
  {
    role: 'lex',
    content: `Excellent — that third action turns this into a policy with built-in evaluation, not fire-and-forget legislation. Reporting requirements also create accountability.

Your idea now has:
✓ Problem Statement
✓ Evidence Base
✓ Proposed Solution
✓ Who Is Affected
✓ Coherent Actions

This is ready to move to Stage 2 (Draft) where you can invite collaborators to refine it further. Would you like to review any section before progressing, or shall we save this and move forward?`,
    fieldUpdate: {
      field: 'Coherent Actions',
      value: `1. Amend Energy Performance of Buildings Regulations 2012 to require minimum EPC rating C for all residential properties listed for sale from January 2027.
2. Establish Green Home Improvement Fund (£500m) providing grants up to £10,000 to low-income households, administered by local authorities.
3. Mandate quarterly reporting by local authorities on fund uptake and compliance rates to DESNZ for policy evaluation.`,
      status: 'complete'
    }
  }
]
```

**Total exchanges:** 19 (well exceeds minimum 8)

This script demonstrates:
- Socratic questioning
- Precision probing
- Fallacy flagging
- Evidence evaluation
- Structured field population
- Progressive refinement
- Policy-focused thinking

---

## 5. COMPONENT SPECIFICATIONS

Specifications for each component used across prototype pages.

### LexChat

**File:** `components/LexChat.tsx`

**Purpose:** Displays a scripted conversation between user and Lex AI, with typing indicators and field update triggers.

**Props:**
```typescript
interface LexChatProps {
  script: LexMessage[]                      // Array of scripted messages
  onFieldUpdate?: (
    field: string,
    value: string,
    status: 'draft' | 'complete'
  ) => void
}
```

**Behavior:**
- Auto-plays first Lex message after 1.2s
- User types anything → sends as "user" message
- Lex responds after 1.2s delay with typing indicator
- If message has `fieldUpdate`, fires `onFieldUpdate` callback 800ms after message displays
- When script exhausted, shows "End of scripted conversation" notice

**Styling:**
- Lex messages: light gray bubble, left-aligned, blue avatar with "L"
- User messages: blue bubble, right-aligned
- Fallacy flag (⚠): amber warning icon top-right of Lex message if `fallacyFlag: true`

---

### VoteWidget

**File:** `components/VoteWidget.tsx`

**Purpose:** Voting UI matching updated spec (direction + strength slider).

**Props:**
```typescript
interface VoteWidgetProps {
  currentVotes: { for: number; against: number; undecided: number }
}
```

**UI Flow:**
1. User selects direction: FOR / AGAINST / UNDECIDED (three buttons)
2. Strength slider appears (0–5 in 0.5 increments: 0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0)
3. Contextual label updates based on strength value
4. Submit Vote button
5. After submit: confirmation + updated vote bars with passion score

**Styling:**
- Direction buttons: green (for), red (against), gray (undecided)
- Slider: blue accent
- Vote bars: show FOR (green), AGAINST (red) with percentages + passion scores

**CRITICAL:** This is NOT a single bipolar -5 to +5 scale. It is direction THEN strength.

---

### SummaryPanel

**File:** `components/SummaryPanel.tsx`

**Purpose:** Right-hand panel showing idea fields as they populate during Lex conversation.

**Props:**
```typescript
interface SummaryField {
  name: string
  value: string
  status: 'empty' | 'draft' | 'complete'
}

interface SummaryPanelProps {
  fields: SummaryField[]
  onDiscuss?: (fieldName: string) => void
  onEdit?: (fieldName: string) => void
}
```

**UI:**
- Each field shows:
  - Status indicator: ○ Empty (gray) | ◐ Draft (amber) | ✓ Complete (green)
  - Field name
  - Value (if populated)
  - On hover: "Discuss with Lex" / "Edit text" buttons

**Behavior:**
- Empty fields NOT shown (prevents anchoring)
- Only show fields that have at least 'draft' status
- Click field → hover overlay with actions

---

### DiffView

**File:** `components/DiffView.tsx`

**Purpose:** Side-by-side comparison of current vs proposed text (for amendments).

**Props:**
```typescript
interface DiffViewProps {
  current: string
  proposed: string
}
```

**UI:**
- Left column: "Current Wording" — gray background
- Right column: "Proposed Wording" — subtle blue background
- Differences highlighted inline (if implementing word-level diff, use `diff` library)

---

### AIFuelGauge

**File:** `components/AIFuelGauge.tsx`

**Purpose:** Visual indicator of remaining AI credits.

**Props:**
```typescript
interface AIFuelGaugeProps {
  remaining: number                         // Tokens remaining
  total: number                             // Total tokens
}
```

**UI:**
- Horizontal progress bar
- Percentage text
- Color: green (>50%), amber (20-50%), red (<20%)

---

### VoteWidget Context Labels

```typescript
const strengthLabels = [
  'No strong view',          // 0.0
  'Barely convinced',        // 0.5
  'Slight view',             // 1.0
  'Leaning',                 // 1.5
  'Moderate view',           // 2.0
  'Fairly convinced',        // 2.5
  'Quite strongly',          // 3.0
  'Very convinced',          // 3.5
  'Strongly',                // 4.0
  'Extremely strongly',      // 4.5
  'Passionately',            // 5.0
]
```

---

### CommentRatingForm (TO BUILD)

**Purpose:** Multi-flag checkbox rating for comments (per updated spec).

**Props:**
```typescript
interface CommentRatingFormProps {
  commentId: string
  onSubmit: (positiveFlags: string[], negativeFlags: string[]) => void
}
```

**UI:**
- Section 1: "Positive Qualities" — checkboxes for:
  - Constructive, Insightful, Relevant, Fresh perspective, Balanced, Helpful facts, Direct experience, Good question
- Section 2: "Logical Issues" — checkboxes for:
  - Ad hominem, Straw man, Red herring, False dilemma, Slippery slope, Moving goalposts, Motte-bailey, Tu quoque, Cherry picking, Not relevant
- Optional note field: "What specifically prompted this rating?"
- Submit button

**Behavior:**
- User can select multiple boxes in each section
- On submit, return two arrays: `positiveFlags[]` and `negativeFlags[]`

---

## 6. FIVE USER JOURNEYS

These are the five journeys accessible from `/prototype` landing page. Each journey should be fully navigable with working links and realistic mock data.

### Journey 1: Create an idea with Lex

**Entry point:** `/prototype/create/stage1`

**Flow:**
1. User lands on simple form (title + summary input)
2. User enters basic info, clicks "Continue to develop with Lex →"
3. Redirects to `/prototype/create/stage2`
4. Two-panel layout: Lex chat (left), summary panel (right)
5. Scripted conversation plays out (use `LEX_FULL_JOURNEY` from Section 4)
6. Fields populate in summary panel as conversation progresses
7. At end, "Save and return to dashboard" button

**Pages involved:**
- `/prototype/create/stage1`
- `/prototype/create/stage2`

**Components:**
- LexChat
- SummaryPanel
- AIFuelGauge

**Mock data:**
- `LEX_FULL_JOURNEY` script

---

### Journey 2: Browse and vote on ideas

**Entry point:** `/prototype/browse`

**Flow:**
1. User sees grid of idea cards (3 mock ideas)
2. Filter by area, stage, search text
3. Sort by votes / date / credibility
4. Click idea card → `/prototype/idea/[id]`
5. See idea detail with tabs
6. Click Vote button → VoteWidget expands
7. Select direction + strength → Submit Vote
8. See confirmation + updated vote bars

**Pages involved:**
- `/prototype/browse`
- `/prototype/idea/[id]`

**Components:**
- VoteWidget
- Stage badges
- Tab navigation

**Mock data:**
- `MOCK_IDEAS` (3 ideas with different stages)

---

### Journey 3: Review an incoming amendment

**Entry point:** `/prototype/dashboard`

**Flow:**
1. User sees dashboard with notifications
2. Unread notification: "Dr James Okafor proposed an amendment to your Coherent Action on EPC ratings"
3. Click "Review →" link
4. Redirects to `/prototype/amendment/amend-1`
5. See side-by-side diff view (DiffView component)
6. Current wording vs proposed wording highlighted
7. (Buttons for Accept/Reject shown but non-functional in prototype)

**Pages involved:**
- `/prototype/dashboard`
- `/prototype/amendment/[id]`

**Components:**
- DiffView
- Notification cards

**Mock data:**
- `MOCK_NOTIFICATIONS` (2 notifications)
- `MOCK_IDEAS[0].amendments[0]` (pending amendment)

---

### Journey 4: Navigate the summary panel

**Entry point:** `/prototype/create/stage2`

**Flow:**
1. User lands on Lex chat interface (Stage 2 page)
2. Right panel shows summary with empty/draft/complete fields
3. As scripted conversation progresses, fields populate
4. User sees fields transition: empty → draft (amber ◐) → complete (green ✓)
5. Hover over completed field → see "Discuss with Lex" / "Edit text" buttons
6. (Buttons shown but non-functional in prototype)

**Pages involved:**
- `/prototype/create/stage2`

**Components:**
- LexChat
- SummaryPanel
- AIFuelGauge

**Mock data:**
- `LEX_JOURNEY_1_SCRIPT` or `LEX_FULL_JOURNEY`

---

### Journey 5: Moderate flagged content

**Entry point:** `/prototype/admin`

**Flow:**
1. User (role: admin or moderator) lands on moderation queue
2. See list of flagged content ordered by flag count
3. Each item shows: content type, content text, reporter, reason, idea title
4. Highlighted item: "This is just another way to stop people buying homes. The whole thing is a scam." — reported as dismissive/unconstructive
5. Action buttons: Dismiss / Hide / Warn User (non-functional in prototype)
6. Shows moderator identity format: "James T." with Moderator badge

**Pages involved:**
- `/prototype/admin`

**Components:**
- Moderation queue list
- Action buttons (visual only)

**Mock data:**
- `MOCK_MODERATION_QUEUE` (2 flagged items)

---

## 7. TERMINOLOGY REMINDERS

**Use these terms EXACTLY. Never substitute.**

| ✅ Correct | ❌ Never Use |
|-----------|-------------|
| Lex | Claude, the AI, AI assistant, chatbot |
| Credibility Score | Reputation, reputation score |
| Strategist | (no synonym — this is a points category) |
| Thinker | (no synonym) |
| Rallymaster | (no synonym) |
| Teambuilder | Dealweaver ❌ |
| Rainmaker | (no synonym) |
| Create / Draft / Develop / Campaign / Parliament | Stage 1 / Stage 2 / Stage 3 / Stage 4 / Stage 5 |
| summaryDescription | summary, description |
| proposedWording | draft wording, proposed legislation |
| Passion score | Vote score, net votes, vote total |
| Direction: FOR / AGAINST / UNDECIDED | Support/Oppose, Upvote/Downvote |
| Strength slider: 0–5 | Bipolar scale -5 to +5 ❌ |

**Stage Names in UI:**
- Always use: Create, Draft, Develop, Campaign, Parliament
- Never use: Stage 1, Stage 2, Stage 3, Stage 4, Stage 5

**Voting UI:**
- Two separate inputs: direction (FOR/AGAINST/UNDECIDED) + strength (0–5)
- NOT a single slider from -5 to +5

**Comment Ratings:**
- Multi-flag checkboxes (positive + negative)
- NOT 5-star or numeric rating

---

## 8. STYLING GUIDELINES

### Design System

**Framework:** Tailwind CSS 3.x + shadcn/ui components

**Color Palette:**
```css
/* Primary */
--revolutBlue: #0066FF              /* Primary CTA, links, active states */
--blue-600: hover state for primary

/* Backgrounds */
--gray-950: #0a0a0a                 /* Page background (dark mode) */
--gray-900: #1a1a1a                 /* Card background */
--gray-800: #2a2a2a                 /* Borders, dividers */

/* Text */
--white: #ffffff                    /* Headings, primary text */
--gray-300: #d1d5db                 /* Body text */
--gray-400: #9ca3af                 /* Secondary text */
--gray-500: #6b7280                 /* Tertiary text, labels */
--gray-600: #4b5563                 /* Disabled text */

/* Semantic */
--green-500: #10b981                /* FOR votes, success, complete status */
--red-500: #ef4444                  /* AGAINST votes, errors */
--amber-400: #fbbf24                /* Draft status, warnings */
--amber-900: #78350f                /* Pending status background */
--blue-900: #1e3a8a                 /* Draft stage badge */
--purple-900: #581c87               /* Campaign stage badge */
```

**Typography:**
- Font family: System font stack (default Tailwind)
- Headings: `font-bold`, `font-semibold`
- Body: `text-sm` or `text-base`, `leading-relaxed`
- Labels: `text-xs`, `uppercase`, `tracking-wider`

**Spacing:**
- Page padding: `px-6 py-10` (mobile), `max-w-3xl mx-auto` (desktop)
- Card padding: `p-4` or `p-5`
- Gap between elements: `gap-3`, `gap-4`, `space-y-3`

### Component Patterns

**Buttons:**
```tsx
// Primary CTA
<button className="px-5 py-2.5 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors">
  Continue →
</button>

// Secondary
<button className="px-4 py-2 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 rounded-xl text-sm font-medium transition-colors">
  Save Draft
</button>

// Disabled
<button className="... disabled:opacity-40" disabled>...</button>
```

**Cards:**
```tsx
<div className="bg-gray-900 border border-gray-700 rounded-xl p-5 hover:border-gray-500 hover:bg-gray-800 transition-all">
  {/* content */}
</div>
```

**Stage Badges:**
```tsx
const stageBadgeColors: Record<Stage, string> = {
  Create: 'bg-gray-700 text-gray-300',
  Draft: 'bg-blue-900 text-blue-300',
  Develop: 'bg-amber-900 text-amber-300',
  Campaign: 'bg-purple-900 text-purple-300',
  Parliament: 'bg-green-900 text-green-300',
}

<span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageBadgeColors[stage]}`}>
  {stage}
</span>
```

**Input Fields:**
```tsx
<input
  type="text"
  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
  placeholder="Enter text..."
/>
```

### Government-Adjacent Aesthetic

**Principles:**
- Clean, minimal, high-contrast
- Dark mode optimized (black backgrounds, white text)
- Clear information hierarchy
- No decorative elements
- Functional, not flashy
- Accessibility-first (WCAG AA minimum)

**Avoid:**
- Bright neon colors
- Gradient backgrounds
- Drop shadows (except subtle on cards)
- Animations beyond transitions
- Decorative icons
- Playful language

**Reference:** GOV.UK design system (clean, functional) + modern dark UI

---

## 9. DEPLOYMENT NOTES

### Pre-Deployment Checklist

**Before pushing to Vercel:**

1. **Environment variables** (Vercel dashboard):
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   CLERK_SECRET_KEY=sk_...
   NEXT_PUBLIC_APP_URL=https://scrutinise.co.uk
   ```

2. **Build test locally:**
   ```bash
   npm run build
   npm run start
   ```
   Check for:
   - TypeScript errors
   - Build warnings
   - Missing imports
   - Hydration errors

3. **Test all journeys:**
   - Create idea (Stage 1 → Stage 2)
   - Browse → Idea detail → Vote
   - Dashboard → Amendment review
   - Admin moderation queue
   - All nav links work

4. **Mobile responsive check:**
   - Test each page at 375px width (iPhone SE)
   - Summary panel should hide on mobile or appear below chat
   - Filters should stack vertically
   - Vote widget should be full-width

5. **Performance:**
   - Run Lighthouse audit (aim for 90+ on all metrics)
   - Check bundle size (should be <500kb JS)
   - Optimize images (use `next/image` component)

### Vercel Configuration

**vercel.json** (if needed):
```json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "devCommand": "next dev",
  "installCommand": "npm install"
}
```

**Environment:**
- Framework Preset: Next.js
- Node Version: 18.x or 20.x
- Build Command: `next build` (default)
- Output Directory: `.next` (default)

### Post-Deployment Checks

1. Visit `/prototype` — all 5 journey cards visible
2. Click each journey — no 404s
3. Clerk sign-in/sign-up working (if enabled)
4. No console errors in browser DevTools
5. Analytics tracking (GA4) firing if configured

### Known Prototype Limitations

**These are EXPECTED and acceptable for clickable prototype:**
- No database — all data hard-coded in `mockData.ts`
- No API routes — no backend logic
- Actions don't persist (votes, comments, amendments are visual only)
- No real AI — scripted Lex conversations only
- No file uploads
- No email sending
- User switching via UserSwitcher component (not real auth for demo purposes)

**User messaging:**
- Add banner: "This is a clickable prototype. All data is fictional. Actions do not persist."
- Show on `/prototype` landing page and at top of prototype layout

---

## 10. RECOMMENDED BUILD ORDER

If building the complete prototype from current state, follow this order:

### Phase 1: Core Journeys (Already Complete ✅)

1. ✅ Prototype landing page (`/prototype`)
2. ✅ Journey 1: Create idea (Stage 1 + Stage 2 with Lex)
3. ✅ Journey 2: Browse and vote
4. ✅ Journey 3: Amendment review
5. ✅ Journey 4: Summary panel navigation
6. ✅ Journey 5: Admin moderation

### Phase 2: Supporting Pages (Optional for MVP)

7. User profile page (`/prototype/profile/[username]`)
   - Mock profile data (name, credibility, ideas, contributions)
   - Public view (no edit mode)
   - Follow button (visual only in prototype — functional in production build)

8. Account settings (`/prototype/settings`)
   - Mock form (name, email, bio, notifications toggles)
   - Non-functional save button

9. Notifications panel (`/prototype/notifications`)
   - Expand `MOCK_NOTIFICATIONS`
   - Filter tabs: All / Votes / Amendments / Comments
   - Mark as read (visual state change only)

10. Groups pages (`/prototype/groups`, `/prototype/groups/create`)
    - Mock groups list
    - Create group form (non-functional)

### Phase 3: Polish

11. Add comment rating UI (WF-18)
    - CommentRatingForm component
    - Multi-flag checkboxes (positive + negative)
    - Wire to comments on idea detail page

12. Training page (`/training`)
    - Mock YouTube embeds
    - Filter by stage/topic/difficulty

13. Referral landing pages (WF-05, WF-06)
    - Idea referral LP with "What is Scrutinise?" explainer
    - User profile referral LP

14. Mobile optimization pass
    - Test all pages on mobile viewport
    - Ensure summary panel collapses correctly
    - Fix any layout issues

### Time Estimates (Rough)

- Current state → Complete MVP (Phases 1-3): **2-3 days** for experienced developer
- Phase 1 alone (core 5 journeys): ✅ **Already complete**
- Phase 2 (supporting pages): **1 day**
- Phase 3 (polish): **1 day**

### What NOT to Build (Out of Scope)

- Database integration (Prisma/PostgreSQL)
- API routes with real logic
- Clerk webhook for user sync
- AI provider integration (Gemini/Grok)
- File upload (R2)
- Email sending (Resend)
- Payment/fundraising (Stripe)
- Real-time features (WebSockets)
- Admin user management beyond moderation queue
- Anything marked "Sprint 2" in implementation_plan.md

---

## QUICK START CHECKLIST

Use this checklist when starting a new prototype build session:

- [ ] Read `CLAUDE.md` in full (session context)
- [ ] Review `wireframes_v3.md` for page you're building
- [ ] Check `mockData.ts` for required mock objects
- [ ] Use correct terminology (Create/Draft/Develop, NOT Stage 1-5)
- [ ] Test in browser after each page (don't batch multiple pages before testing)
- [ ] Ensure all nav links work (no dead ends)
- [ ] Mobile responsive (test at 375px width)
- [ ] Dark mode optimized (bg-gray-950, white text)
- [ ] Add to prototype landing page if new journey

---

*End of scrutinise_prototype_brief.md*
*This document contains everything needed to build the complete clickable prototype.*
*For backend implementation, refer to implementation_plan.md.*
