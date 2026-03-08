# Scrutinise — Master Claude Code Brief
## Full Clickable Prototype Build
*Version 2 — March 2026*

---

## IMPORTANT: READ THIS FIRST

You are continuing work on an **existing project** that is already set up and partially built. Before writing any code:

1. Read this entire brief
2. Audit what already exists against the file structure in Step 3
3. Report what is COMPLETE, PARTIAL, or MISSING
4. Only then begin building — completing and correcting what exists, not rebuilding from scratch

The project is a **Next.js monorepo** already:
- Running locally via `npm run dev`
- Connected to GitHub
- Deployed to Vercel at `www.scrutinise.org`
- Using Clerk for authentication (already wired in)
- Using Tailwind CSS and shadcn/ui (already installed)
- Has an existing homepage, navbar, and design language

**Do not touch** the existing homepage, sign-in, sign-up, about pages, or the `scrutinise-api/` and `scrutinise-db/` directories.

---

## WHAT YOU ARE BUILDING

A **fully clickable prototype** of the Scrutinise platform — every page, every field, all five user journeys navigable end to end. No real database, no real AI, no real auth. All data is hardcoded mock data. Lex conversations are scripted.

**Purpose:** Let real users walk through every core flow before the production build begins.

The prototype lives at `/prototype` and is accessible from the live homepage.

---

## CONTEXT: WHAT SCRUTINISE IS

Scrutinise is a civic engagement platform that helps citizens develop policy ideas into Parliament-ready proposals through:

- **Structured idea development** via Lex (an AI guide) using Socratic dialogue
- **Collaborative refinement** through amendments, voting, and expert input
- **A staged progression pipeline**: Create → Draft → Develop → Campaign → Parliament
- **A credibility system** that weights contributions by quality and verification
- **An AI Fuel system** that allocates tokens fairly across users

### User Roles
- **Citizen** — standard verified user
- **MP** — elected representative with special privileges
- **Expert** — domain-verified contributor
- **Moderator** — content moderation team
- **Admin** — platform administrator

### The Five Stages
| Stage | Colour | Meaning |
|---|---|---|
| Create | Gray | Initial idea entry |
| Draft | Blue | Developing with Lex |
| Develop | Amber | Community refinement |
| Campaign | Purple | Building support |
| Parliament | Green | Submitted to Parliament |

---

## TERMINOLOGY — APPLY CONSISTENTLY

| Wrong | Correct |
|---|---|
| Claude | Lex |
| Reputation | Credibility |
| Community Debate / Expert Review | Develop / Active |
| Research Ideas | Browse Ideas |
| Binary vote (yes/no) | For / Against / Undecided + strength slider |
| Anonymous voting | Removed — all votes require login |
| Raw token count | AI Fuel gauge (show token count only on hover) |
| "Claude is thinking..." | "Lex is thinking..." or "Thinking..." |
| +reputation | +Credibility or +points |
| Reset Password | Send Password Reset Email |

---

## STEP 1 — AUDIT THE EXISTING PROJECT

Read these files before writing anything:

```
scrutinise-web/app/page.tsx
scrutinise-web/app/layout.tsx
scrutinise-web/components/Navbar.tsx
scrutinise-web/tailwind.config.js
scrutinise-web/package.json
```

Then check whether each file listed in Step 3 already exists and whether its content matches the spec in Steps 5–8.

Report your findings as:
- **COMPLETE** — exists and matches spec
- **PARTIAL** — exists but missing content or fields
- **MISSING** — does not exist at all

Do this before writing any code.

---

## STEP 2 — DEPENDENCIES

Check first — these may already be installed:

```bash
# Check
ls scrutinise-web/components/ui

# Only run if components/ui is missing or incomplete
cd scrutinise-web
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card badge tabs slider progress avatar separator
npm install lucide-react
```

---

## STEP 3 — COMPLETE FILE STRUCTURE

```
scrutinise-web/
├── lib/
│   ├── mockData.ts              ← All mock data (single source of truth)
│   └── lexScripts.ts            ← Pre-written Lex conversation scripts
├── context/
│   └── UserContext.tsx          ← React context for active persona
├── components/
│   ├── UserSwitcher.tsx         ← Prototype persona switcher (bottom-right corner)
│   ├── LexChat.tsx              ← Lex AI chat interface component
│   ├── SummaryPanel.tsx         ← Right-side idea summary panel
│   ├── VoteWidget.tsx           ← For/Against/Undecided + strength slider
│   ├── AIFuelGauge.tsx          ← Horizontal depleting fuel bar
│   └── DiffView.tsx             ← Red/green word-level diff for amendments
└── app/
    └── prototype/
        ├── layout.tsx            ← Prototype layout wrapper
        ├── page.tsx              ← Prototype hub / journey selector
        ├── browse/
        │   └── page.tsx          ← Browse Ideas (Journey 2a)
        ├── idea/
        │   └── [id]/
        │       └── page.tsx      ← Idea detail with tabs (Journey 2b)
        ├── create/
        │   ├── stage1/
        │   │   └── page.tsx      ← Create: Title + Summary form (Journey 1a)
        │   └── stage2/
        │       └── page.tsx      ← Create: Lex Q&A chat (Journey 1b)
        ├── dashboard/
        │   └── page.tsx          ← User dashboard (Journey 3a)
        ├── amendment/
        │   └── [id]/
        │       └── page.tsx      ← Amendment review (Journey 3b)
        └── admin/
            └── page.tsx          ← Admin moderation queue (Journey 5)
```

---

## STEP 4 — LINK FROM LIVE HOMEPAGE

In `scrutinise-web/app/page.tsx` (or `components/HomeClient.tsx`), add to the hero section below the main CTA:

```tsx
<Link href="/prototype">
  <Button size="lg" variant="outline">
    Explore the Prototype →
  </Button>
</Link>
<p className="text-sm text-muted-foreground mt-2">
  Interactive prototype — no account needed
</p>
```

---

## STEP 5 — MOCK DATA (`lib/mockData.ts`)

This is the single source of truth. All pages import from here. Create or verify this file exactly:

```typescript
// lib/mockData.ts

export type Stage = 'Create' | 'Draft' | 'Develop' | 'Campaign' | 'Parliament'
export type UserRole = 'citizen' | 'mp' | 'expert' | 'moderator' | 'admin'

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

export interface MockIdea {
  id: string
  title: string
  summary: string
  stage: Stage
  country: 'UK' | 'Ireland'
  area: string
  voteCount: { for: number; against: number; undecided: number }
  commentCount: number
  credibilityScore: number
  ownerId: string
  createdAt: string
  coherentActions: CoherentAction[]
  amendments: Amendment[]
  comments: Comment[]
}

export interface CoherentAction {
  id: string
  text: string
  voteFor: number
  voteAgainst: number
}

export interface Amendment {
  id: string
  ideaId: string
  proposedBy: string
  currentWording: string
  proposedWording: string
  status: 'pending' | 'accepted' | 'rejected' | 'consulting'
  createdAt: string
}

export interface Comment {
  id: string
  author: string
  text: string
  createdAt: string
  ratings: { quality: number; evidence: number; civility: number }
  reported?: boolean
}

export interface Notification {
  id: string
  type: 'amendment' | 'vote' | 'stage' | 'moderation'
  message: string
  ideaId: string
  amendmentId?: string
  createdAt: string
  read: boolean
}

export interface ModerationItem {
  id: string
  contentType: 'comment' | 'idea' | 'amendment'
  contentId: string
  content: string
  reportedBy: string
  reason: string
  ideaTitle: string
  createdAt: string
}

// ─── PERSONAS ───────────────────────────────────────────────────────────────

export const MOCK_USERS: MockUser[] = [
  {
    id: 'u1', name: 'Alex Chen', role: 'citizen',
    credibility: 340, aiFuelRemaining: 42000, aiFuelTotal: 60000,
    verified: true
  },
  {
    id: 'u2', name: 'Rt Hon. Sarah Mills MP', role: 'mp',
    credibility: 1240, aiFuelRemaining: 55000, aiFuelTotal: 60000,
    verified: true, constituency: 'Bristol East'
  },
  {
    id: 'u3', name: 'Dr James Okafor', role: 'expert',
    credibility: 890, aiFuelRemaining: 48000, aiFuelTotal: 60000,
    verified: true
  },
  {
    id: 'u4', name: 'Mod Team', role: 'moderator',
    credibility: 500, aiFuelRemaining: 60000, aiFuelTotal: 60000,
    verified: true
  },
  {
    id: 'u5', name: 'Admin', role: 'admin',
    credibility: 999, aiFuelRemaining: 60000, aiFuelTotal: 60000,
    verified: true
  },
]

// ─── IDEAS ───────────────────────────────────────────────────────────────────

export const MOCK_IDEAS: MockIdea[] = [
  {
    id: 'idea-1',
    title: 'Mandatory Energy Efficiency Ratings Before Property Sale',
    summary: 'Require all residential properties to achieve a minimum EPC rating of C before being listed for sale, with a grant scheme to support low-income homeowners.',
    stage: 'Develop',
    country: 'UK',
    area: 'Housing & Energy',
    voteCount: { for: 847, against: 203, undecided: 91 },
    commentCount: 34,
    credibilityScore: 78,
    ownerId: 'u1',
    createdAt: '2025-11-12',
    coherentActions: [
      {
        id: 'ca-1',
        text: 'Amend the Energy Performance of Buildings Regulations 2012 to require a minimum EPC rating of C for all residential properties listed for sale from January 2027.',
        voteFor: 612, voteAgainst: 145
      },
      {
        id: 'ca-2',
        text: 'Establish a £500m Green Home Improvement Fund to provide grants of up to £10,000 to households below median income to meet the new standard.',
        voteFor: 798, voteAgainst: 89
      }
    ],
    amendments: [
      {
        id: 'amend-1',
        ideaId: 'idea-1',
        proposedBy: 'Dr James Okafor',
        currentWording: 'require a minimum EPC rating of C for all residential properties listed for sale from January 2027',
        proposedWording: 'require a minimum EPC rating of C for all residential properties listed for sale from January 2028, with an exemption for listed buildings and properties in conservation areas where compliance is technically unfeasible',
        status: 'pending',
        createdAt: '2025-12-01'
      }
    ],
    comments: [
      {
        id: 'c1', author: 'Priya S.', createdAt: '2025-11-20',
        text: 'This is badly needed. My landlord has been putting off upgrades for years because there is no legal requirement. This changes that.',
        ratings: { quality: 4, evidence: 2, civility: 5 }
      },
      {
        id: 'c2', author: 'RogerT', createdAt: '2025-11-22',
        text: 'What about rural properties where it\'s genuinely difficult to achieve a C rating? Blanket rules don\'t work.',
        ratings: { quality: 4, evidence: 3, civility: 4 }
      },
      {
        id: 'c3', author: 'FlaggedUser99', createdAt: '2025-11-25',
        text: 'This is just another way to stop people buying homes. The whole thing is a scam.',
        ratings: { quality: 1, evidence: 1, civility: 1 },
        reported: true
      }
    ]
  },
  {
    id: 'idea-2',
    title: 'Right to Disconnect: Legal Protection for Out-of-Hours Contact',
    summary: 'Give workers the legal right to ignore work communications outside contracted hours, with enforcement via Employment Tribunals.',
    stage: 'Draft',
    country: 'UK',
    area: 'Employment',
    voteCount: { for: 1203, against: 445, undecided: 178 },
    commentCount: 67,
    credibilityScore: 65,
    ownerId: 'u3',
    createdAt: '2025-10-03',
    coherentActions: [
      {
        id: 'ca-3',
        text: 'Insert a new section into the Employment Rights Act 1996 establishing the right to disconnect, prohibiting employer retaliation for employees not responding to communications outside contracted hours.',
        voteFor: 980, voteAgainst: 312
      }
    ],
    amendments: [],
    comments: []
  },
  {
    id: 'idea-3',
    title: 'Universal Basic Digital Infrastructure',
    summary: 'Treat broadband access as a public utility — government-funded minimum 50Mbps connection guaranteed for every household.',
    stage: 'Campaign',
    country: 'UK',
    area: 'Digital & Technology',
    voteCount: { for: 3421, against: 892, undecided: 341 },
    commentCount: 112,
    credibilityScore: 88,
    ownerId: 'u2',
    createdAt: '2025-08-15',
    coherentActions: [],
    amendments: [],
    comments: []
  }
]

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    type: 'amendment',
    message: 'Dr James Okafor proposed an amendment to your Coherent Action on EPC ratings.',
    ideaId: 'idea-1',
    amendmentId: 'amend-1',
    createdAt: '2025-12-01',
    read: false
  },
  {
    id: 'n2',
    type: 'vote',
    message: 'Your idea "Mandatory Energy Efficiency Ratings" received 50 new votes.',
    ideaId: 'idea-1',
    createdAt: '2025-11-30',
    read: true
  }
]

// ─── MODERATION QUEUE ─────────────────────────────────────────────────────────

export const MOCK_MODERATION_QUEUE: ModerationItem[] = [
  {
    id: 'report-1',
    contentType: 'comment',
    contentId: 'c3',
    content: 'This is just another way to stop people buying homes. The whole thing is a scam.',
    reportedBy: 'Priya S.',
    reason: 'Dismissive and unconstructive — does not engage with the proposal',
    ideaTitle: 'Mandatory Energy Efficiency Ratings Before Property Sale',
    createdAt: '2025-11-26'
  },
  {
    id: 'report-2',
    contentType: 'idea',
    contentId: 'idea-2',
    content: 'Right to Disconnect: Legal Protection for Out-of-Hours Contact',
    reportedBy: 'UserABC',
    reason: 'Duplicate of existing petition',
    ideaTitle: 'Right to Disconnect: Legal Protection for Out-of-Hours Contact',
    createdAt: '2025-12-03'
  }
]
```

---

## STEP 6 — LEX SCRIPTS (`lib/lexScripts.ts`)

```typescript
// lib/lexScripts.ts

export interface LexMessage {
  role: 'lex' | 'user'
  content: string
  fieldUpdate?: {
    field: string
    value: string
    status: 'draft' | 'complete'
  }
  fallacyFlag?: boolean
}

// ─── JOURNEY 1: EPC Idea Development ─────────────────────────────────────────

export const LEX_JOURNEY_1_SCRIPT: LexMessage[] = [
  {
    role: 'lex',
    content: `Welcome to Scrutinise. I'm Lex — I'll be helping you develop your idea into something that could genuinely influence policy.\n\nBefore we go any further, I want to understand the problem you're trying to solve. Not the solution — the problem. What is actually broken, and who is it broken for?`
  },
  {
    role: 'user',
    content: 'People are living in cold, inefficient homes and paying huge energy bills because landlords and sellers have no incentive to improve them.'
  },
  {
    role: 'lex',
    content: `That's a clear starting point. "No incentive" is doing a lot of work in that sentence — let's be precise about it.\n\nIs the problem that sellers and landlords genuinely don't know their properties are inefficient, or that they know and have calculated it's cheaper not to act?`,
    fieldUpdate: {
      field: 'Problem Statement',
      value: 'Residential properties remain energy inefficient because sellers and landlords face no legal or financial incentive to improve them, resulting in high bills and poor living conditions for occupants.',
      status: 'draft'
    }
  },
  {
    role: 'user',
    content: 'They know. An EPC survey is required when selling — they can see the rating. They just don\'t act because improving it costs money they\'d rather not spend.'
  },
  {
    role: 'lex',
    content: `Good — so this is an incentive problem, not an information problem. That matters for the solution design.\n\nYou've mentioned EPC ratings. The current system requires disclosure but not improvement. Your proposal is to change that — to make a minimum standard mandatory at point of sale.\n\nI want to flag something before we go further. There's an argument embedded here that might need strengthening: you're assuming that a mandatory standard at point of sale will cause sellers to improve properties, rather than simply reducing the pool of sellable homes or pushing up prices for already-compliant properties. How would you address someone who makes that objection?`,
    fallacyFlag: true
  },
  {
    role: 'user',
    content: 'That\'s fair. I\'d say the grant scheme addresses the financial barrier, and the 2027 deadline gives time to prepare. Properties won\'t disappear from the market — they\'ll be improved.'
  },
  {
    role: 'lex',
    content: `That's a reasonable response — the grant scheme does work against the price-shock objection, and a phased deadline is standard legislative practice.\n\nLet me note that down and we'll move to the evidence base. What existing evidence supports the idea that mandatory standards at point of sale actually drive improvement — has this been tried anywhere?`,
    fieldUpdate: {
      field: 'Problem Statement',
      value: 'Residential properties remain energy inefficient because sellers and landlords face no legal or financial incentive to improve them. EPC disclosure is required but improvement is not. A mandatory minimum standard at point of sale would create a direct incentive to upgrade, supported by a grant scheme to avoid market distortion.',
      status: 'complete'
    }
  },
  {
    role: 'user',
    content: 'The Netherlands has had minimum EPC requirements for social housing since 2020. Scotland has consulted on similar rules. The EU Energy Performance of Buildings Directive is pushing this direction across Europe.'
  },
  {
    role: 'lex',
    content: `Good — three relevant reference points. The Netherlands example is the strongest because it's implemented, not consulted on.\n\nI'd want to know one more thing about the Dutch case: what happened to the market in the transition period? Did prices rise, did supply contract, or did it go smoothly? That evidence either strengthens or complicates your proposal.\n\nFor now, let me record the comparative evidence and we'll keep moving.`,
    fieldUpdate: {
      field: 'Evidence Base',
      value: 'Netherlands: mandatory EPC standards for social housing from 2020. Scotland: active consultation on similar measures. EU EPBD directive driving harmonisation. Further research needed on Dutch market impact during transition.',
      status: 'draft'
    }
  },
  {
    role: 'user',
    content: 'I\'ll look into the Dutch transition data. What should we work on next?'
  },
  {
    role: 'lex',
    content: `The next thing I want to understand is your proposed solution in detail — not just "raise the minimum EPC standard" but the exact mechanism.\n\nSpecifically: who enforces it, what happens to a seller who can't or won't comply, and how does the grant scheme work — who qualifies, who administers it, and what's the funding source?\n\nThese aren't peripheral details. Parliamentary drafters will need all of this, and any gap here is an objection waiting to happen.`,
    fieldUpdate: {
      field: 'Evidence Base',
      value: 'Netherlands: mandatory EPC standards for social housing from 2020. Scotland: active consultation on similar measures. EU EPBD directive driving harmonisation. Dutch market impact during transition: TBC — further research required.',
      status: 'complete'
    }
  }
]

// ─── JOURNEY 4: Return to Summary Panel ──────────────────────────────────────

export const LEX_JOURNEY_4_SCRIPT: LexMessage[] = [
  {
    role: 'lex',
    content: `Welcome back. Last time we were working on your Evidence Base — we'd got as far as the Netherlands comparison. Shall we continue from there, or is there something you want to revisit first?`
  },
  {
    role: 'user',
    content: 'I want to revisit the Problem Statement — I think I can make it sharper.'
  },
  {
    role: 'lex',
    content: `Good instinct — the problem statement is the foundation everything else rests on. Open the summary panel and click the Problem Statement field. You'll see what we have so far. What specifically do you want to change?`
  },
  {
    role: 'user',
    content: 'I want to emphasise that this is a market failure, not just a behaviour problem.'
  },
  {
    role: 'lex',
    content: `That's a sharper framing and it's more defensible. "Market failure" is a recognised economic concept — it signals that this isn't about blaming individuals but about a structural gap that policy legitimately corrects.\n\nLet me update the Problem Statement to reflect that.`,
    fieldUpdate: {
      field: 'Problem Statement',
      value: 'The residential property market fails to price in energy efficiency because the costs of inefficiency fall on occupants, not sellers. This classic market failure — where the party making the decision does not bear the consequences — justifies regulatory intervention at point of sale.',
      status: 'edited'
    }
  }
]
```

---

## STEP 7 — COMPONENTS

### `context/UserContext.tsx`

```tsx
'use client'
import { createContext, useContext, useState, ReactNode } from 'react'
import { MockUser, MOCK_USERS } from '@/lib/mockData'

interface UserContextType {
  activeUser: MockUser
  setActiveUser: (user: MockUser) => void
}

const UserContext = createContext<UserContextType>({
  activeUser: MOCK_USERS[0],
  setActiveUser: () => {}
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [activeUser, setActiveUser] = useState<MockUser>(MOCK_USERS[0])
  return (
    <UserContext.Provider value={{ activeUser, setActiveUser }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
```

### `components/UserSwitcher.tsx`

- Fixed position, bottom-right corner: `fixed bottom-4 right-4 z-50`
- Label: "🎭 Viewing as:"
- `<select>` dropdown listing all 5 personas from `MOCK_USERS`
- Shows current persona name and role badge below the selector
- On change: calls `setActiveUser` from UserContext
- Small note underneath: "Test mode — not visible in production"
- Wrap in a card with subtle border

### `components/AIFuelGauge.tsx`

Props: `remaining: number, total: number`

- Horizontal bar using Tailwind width percentage
- Colour: green (`bg-green-500`) when >50%, amber (`bg-amber-500`) when 25–50%, red (`bg-red-500`) when <25%
- Label: "AI Fuel" with the bar beside it
- Tooltip on hover showing exact token count: "42,000 / 60,000 tokens remaining"
- Use a `title` attribute or a hover state div for the tooltip

### `components/LexChat.tsx`

Props: `script: LexMessage[], onFieldUpdate?: (field: string, value: string, status: string) => void`

- Scrollable message area with alternating bubbles:
  - Lex messages: left-aligned, `bg-gray-100 text-gray-900`, small "L" avatar circle
  - User messages: right-aligned, brand primary colour bg, white text
- Input field at bottom with Send button
- Any non-empty user input advances to next scripted message
- Show typing indicator (three animated dots) for 1200ms before each Lex message appears
- If `fallacyFlag: true` on a Lex message: show amber ⚠️ icon with tooltip "Lex flagged a potential argument issue"
- If `fieldUpdate` present: call `onFieldUpdate` after 800ms delay

### `components/SummaryPanel.tsx`

Props: `fields: { name: string, value: string, status: 'empty' | 'draft' | 'complete' | 'edited' }[]`

- Vertical list of fields, each with:
  - Colour dot indicator: gray=empty, amber=draft, green=complete, blue=edited
  - Field name as label
  - Field value (or "Not yet completed" in muted text if empty)
- Hover state on completed/draft fields: show overlay with two buttons:
  - "💬 Discuss with Lex" 
  - "✏️ Edit text"
- "↩ Return to conversation" button at top — visible when a field is focused/expanded

### `components/VoteWidget.tsx`

Props: `ideaId: string, currentVotes: { for: number; against: number; undecided: number }`

- Three toggle buttons: **For** (green) / **Against** (red) / **Undecided** (gray)
- Only one selectable at a time; selected state is visually distinct
- Strength slider (0–5) below the buttons
  - Label changes dynamically: 0="No strong view", 1–2="Slightly", 3="Quite strongly", 4–5="Very strongly"
- On vote: show "Vote recorded ✓" confirmation state
- Horizontal bar chart below showing vote proportions (green for, red against)
- If user not logged in: show "Sign in to vote" instead of the buttons

### `components/DiffView.tsx`

Props: `current: string, proposed: string`

- Side-by-side panels on desktop, stacked on mobile
- Left panel: "Current Wording" heading + text with removed words shown in `line-through text-red-600 bg-red-50`
- Right panel: "Proposed Wording" heading + text with added words shown in `text-green-700 bg-green-50`
- Word-level diffing: split both strings on spaces, compare arrays, highlight differences
- Below both panels: four action buttons:
  - **Accept** (`bg-green-600`)
  - **Consult First** (`bg-amber-500`)
  - **Request Revision** (`bg-blue-600`)
  - **Reject** (`bg-red-600`)
- Each button click shows a confirmation message state (e.g. "Amendment accepted — voters will be notified")

---

## STEP 8 — THE PROTOTYPE PAGES

### `app/prototype/layout.tsx`

- Wraps all prototype pages via Next.js layout nesting
- Includes `<UserProvider>` from UserContext
- Includes the existing `<Navbar>` component — use the site's existing navbar, do not create a new one
- Adds a dismissible top banner: `🔬 Prototype Mode — fictional data only` (amber/yellow, subtle)
- Renders `<UserSwitcher>` (fixed position, always visible)

### `app/prototype/page.tsx` — Prototype Hub

- Heading: "Scrutinise — Interactive Prototype"
- Subheading: "Explore the five core user journeys. No account needed."
- Five journey cards in a grid, each with:
  - Journey title
  - One-sentence description
  - "Start →" link button
- Journey links:
  1. "Create an idea with Lex" → `/prototype/create/stage1`
  2. "Browse and vote on ideas" → `/prototype/browse`
  3. "Review an incoming amendment" → `/prototype/dashboard`
  4. "Navigate the summary panel" → `/prototype/create/stage2`
  5. "Moderate flagged content (Admin)" → `/prototype/admin`
- Note at bottom: "This is a prototype — all data is fictional. Actions don't persist."
- Style: use the existing site design language (fonts, colours, card styles from existing components)

### `app/prototype/create/stage1/page.tsx` — Journey 1a

- Stage progress indicator at top: 5 steps — Create (active) / Draft / Develop / Campaign / Parliament
  - Use coloured dots or step pills, left to right
- Heading: "What's your idea?"
- Field: "Idea title" — text input, max 100 chars, character counter shown below (`${count}/100`)
- Field: "Summary" — textarea, max 500 chars, character counter shown below (`${count}/500`)
- Two buttons at bottom:
  - "Save Draft" (secondary/outline)
  - "Continue to develop with Lex →" (primary) — links to `/prototype/create/stage2`
- Note below buttons: "Your idea is private until you choose to share it"
- Clean centred single-column layout, max-width ~600px

### `app/prototype/create/stage2/page.tsx` — Journey 1b

- Two-panel layout:
  - Left/centre (65% width on desktop): `<LexChat>` with `LEX_JOURNEY_1_SCRIPT`
  - Right (35% width, desktop only — hidden on mobile): `<SummaryPanel>`
- SummaryPanel initial fields (all empty on load):
  - Problem Statement
  - Evidence Base
  - Proposed Solution
  - Who Is Affected
  - Coherent Actions
- Stage indicator: Draft (active)
- Top nav bar: "Save Draft" button (right-aligned) + `<AIFuelGauge>` (uses `MOCK_USERS[0]` fuel values)
- On LexChat `onFieldUpdate`: update the corresponding SummaryPanel field in real time
- Mobile: stack panels vertically, chat on top, summary below

### `app/prototype/browse/page.tsx` — Journey 2a

- Page title: "Browse Ideas"
- Filter bar (horizontal, scrollable on mobile):
  - Country: UK / Ireland (toggle or select)
  - Area: dropdown from idea areas in mock data
  - Stage: dropdown (all stages)
  - Sort by: Most Votes / Most Recent / Highest Credibility
- Search box
- Grid of idea cards (3 columns desktop, 2 tablet, 1 mobile)
- Each card shows:
  - Title (bold)
  - Summary (truncated to 2 lines)
  - Stage badge (colour per stage)
  - Vote count (for / against)
  - Area tag
  - Credibility score with ⭐ icon
- Click anywhere on card → `/prototype/idea/[id]`
- Show all 3 ideas from `MOCK_IDEAS`

### `app/prototype/idea/[id]/page.tsx` — Journey 2b

- Get idea by `params.id` from `MOCK_IDEAS`
- Header: title, owner name, stage badge, created date
- Four tabs: **Overview** | **Research** | **Amendments** | **History**

**Overview tab:**
- Full summary text
- `<VoteWidget>` component
- "Coherent Actions" section — list each action with:
  - Action text
  - Mini horizontal vote bar (for/against proportion)

**Research tab:**
- Three placeholder cards: "Evidence", "International Comparisons", "Cost Estimates"
- Each card: placeholder icon + "No research added yet"
- "Add Research" button — disabled with tooltip: "Available at Stage 3 (Develop) and above"

**Amendments tab:**
- List of amendments from `idea.amendments`
- Each row: proposer name, date, status badge, preview of proposed change
- "Propose Amendment" button (enabled — clicking shows a simple modal or inline form placeholder)

**History tab:**
- Simple vertical timeline
- Events: "Idea created [date]", "Moved to [stage] [date]", "[name] proposed an amendment [date]"
- Use timeline styling (vertical line, dots)

### `app/prototype/dashboard/page.tsx` — Journey 3a

- Get active user from `useUser()` context
- Greeting: "Welcome back, [user.name]"
- Stats row:
  - Credibility score (large number, ⭐ icon, label "Credibility")
  - `<AIFuelGauge>` component (user's current fuel)
- Notifications panel:
  - Heading: "Notifications"
  - List from `MOCK_NOTIFICATIONS`
  - Unread items highlighted (amber left border or bold)
  - Amendment notification: link to `/prototype/amendment/amend-1`
- "Your Ideas" section:
  - List of ideas owned by active user (filter `MOCK_IDEAS` by `ownerId`)
  - Each row: title, stage badge, vote count
  - Click → idea detail

### `app/prototype/amendment/[id]/page.tsx` — Journey 3b

- Get amendment by `params.id` — look up across all `MOCK_IDEAS[x].amendments`
- Heading: "Amendment Proposed"
- Proposer info: name, date
- `<DiffView>` component with the amendment's `currentWording` and `proposedWording`
- After action button click: hide DiffView, show confirmation message:
  - Accept: "Amendment accepted — voters will be notified of the change"
  - Consult First: "Consultation opened — contributors will be invited to comment"
  - Request Revision: "Revision requested — proposer will be notified"
  - Reject: "Amendment rejected — proposer has been notified"
- "← Back to Dashboard" link

### `app/prototype/admin/page.tsx` — Journey 5

- Four tabs: **Moderation Queue** | **Parliamentary Verification** | **Draftsman Verification** | **Feature Requests**

**Moderation Queue tab:**
- List from `MOCK_MODERATION_QUEUE`
- Each item (collapsed by default):
  - Content excerpt, reporter name, reason, timestamp
  - Click to expand: full content text + idea context
  - Five action buttons: **Keep** / **Hide** / **Remove** / **Warn User** / **Escalate**
  - Each action shows a confirmation state inline

**Parliamentary Verification tab:**
- Placeholder: "No items awaiting verification"
- Description: "MPs and Lords who register will appear here for verification against Parliamentary records"

**Draftsman Verification tab:**
- Placeholder: "No items awaiting verification"
- Description: "Legal draftsmen applying for verified status will appear here"

**Feature Requests tab:**
- Placeholder: "Feature request queue coming soon"

---

## STEP 9 — STYLING GUIDELINES

- **Use the existing site design** — match the fonts, colours, and component style from the existing homepage and navbar. Do not introduce a new design system.
- shadcn/ui components for buttons, cards, tabs, badges, sliders, progress bars
- Keep it clean and readable — prototype quality, not pixel-perfect
- Lex chat bubbles: Lex = `bg-gray-100 text-gray-900`, User = brand primary colour
- Stage badges:
  - Create = `bg-gray-200 text-gray-700`
  - Draft = `bg-blue-100 text-blue-700`
  - Develop = `bg-amber-100 text-amber-700`
  - Campaign = `bg-purple-100 text-purple-700`
  - Parliament = `bg-green-100 text-green-700`
- Credibility: always numeric with ⭐ icon
- Mobile: stack the summary panel below chat; chat is priority

---

## STEP 10 — BUILD ORDER

If starting from partial state, complete in this order:

1. Audit first — report COMPLETE / PARTIAL / MISSING for every file in Step 3
2. `lib/mockData.ts` — verify or create
3. `lib/lexScripts.ts` — verify or create
4. `context/UserContext.tsx` — verify or create
5. `components/UserSwitcher.tsx`
6. `components/AIFuelGauge.tsx`
7. `components/LexChat.tsx`
8. `components/SummaryPanel.tsx`
9. `components/VoteWidget.tsx`
10. `components/DiffView.tsx`
11. `app/prototype/layout.tsx`
12. `app/prototype/page.tsx` (hub)
13. `app/prototype/create/stage1/page.tsx`
14. `app/prototype/create/stage2/page.tsx` ← most important screen
15. `app/prototype/browse/page.tsx`
16. `app/prototype/idea/[id]/page.tsx`
17. `app/prototype/dashboard/page.tsx`
18. `app/prototype/amendment/[id]/page.tsx`
19. `app/prototype/admin/page.tsx`
20. Add prototype link to existing homepage

After each page: check it renders on `localhost:3000/prototype/[route]` before moving to the next.

---

## STEP 11 — DEPLOYMENT

The project is already connected to Vercel via GitHub. Once you push to `main`:

1. Vercel auto-deploys — prototype will be live at `www.scrutinise.org/prototype`
2. No environment variables needed (no real auth, no real AI in the prototype)

Push command:
```bash
git add .
git commit -m "feat: complete clickable prototype"
git push origin main
```

---

## WHAT SUCCESS LOOKS LIKE

A user with no account can:
1. Land on `scrutinise.org`, click "Explore the Prototype"
2. Choose a persona using the UserSwitcher
3. Walk through all five journeys end-to-end
4. See every field, every component, every screen — no blank pages, no placeholder text except where explicitly specified
5. Experience the Lex conversation with the scripted dialogue advancing naturally

---

*Master Brief v2 — Scrutinise Prototype — March 2026*
