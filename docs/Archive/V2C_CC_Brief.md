# CC BRIEF — SPRINT V2-C

*Prepared by CCh — 13 April 2026* *Read CLAUDE.md and handoff_summary.md (v23) first. V2-B is the last completed sprint.*

***

## BEFORE STARTING ANY CODE

1.  Run `git status` — confirm on Main
2.  Run `npx prisma generate`
3.  Run the credibility backfill script if not already done: `cd scrutinise-web && npx ts-node ../scripts/backfill-credibility.ts`

***

## OVERVIEW — 8 COMMITS THIS SPRINT

| \# | Commit                                                   | Area                     |
|----|----------------------------------------------------------|--------------------------|
| 1  | Admin nav link — visible to ADMIN/SUPER_ADMIN            | UI                       |
| 2  | Legislation Evaluator page at /legislation-compare       | Next.js page + API route |
| 3  | Legislation DB schema — 5 new models                     | DB                       |
| 4  | Legislation ingestion script — fetch and parse CLML      | Script                   |
| 5  | Legislation compilation script — AI batch processor      | Script                   |
| 6  | Legislation API routes — search, retrieve, link to idea  | API                      |
| 7  | Legislation search UI — public-facing browse page        | UI                       |
| 8  | Docs update — CHANGE_LOG, handoff, entity_list reference | Docs                     |

***

## COMMIT 1 — Admin nav link

### File: `components/PublicNav.tsx` (or wherever the main nav is defined)

Add an "Admin" link to the navigation bar, visible only when the current user's role is `ADMIN` or `SUPER_ADMIN`.

The link should appear in the authenticated user's nav section (right side of nav, near Dashboard/Sign out). Style it identically to existing nav links. It should link to `/admin`.

```tsx
{(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
  <Link href="/admin" className="...existing nav link classes...">
    Admin
  </Link>
)}
```

The `user.role` should already be available in the nav component from the Clerk session or the user fetch. If it's not, add it to whatever user data is fetched for the nav.

Run `tsc --noEmit`. Commit: `feat: admin nav link visible to ADMIN/SUPER_ADMIN (V2C-admin-nav)`

***

## COMMIT 2 — Legislation Evaluator at /legislation-compare

### Purpose

A public-facing page at `scrutinise.org/legislation-compare` that allows comparison of AI-compiled legislation against the TNA gold standard. Public, no auth required. API keys entered in the UI are session-only (never stored server-side).

The page is based on the standalone HTML evaluator CCh produced, rebuilt as a proper Next.js page. The key improvement over the standalone HTML is that legislation fetching happens server-side (no CORS issues).

### New API route: `app/api/legislation/fetch/route.ts`

```typescript
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') // ukpga, uksi, anaw etc
  const year = searchParams.get('year')
  const chapter = searchParams.get('chapter')
  const section = searchParams.get('section')
  const version = searchParams.get('version') ?? 'revised' // 'revised' | 'enacted'

  if (!type || !year || !chapter || !section) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
  }

  const baseUrl = `https://www.legislation.gov.uk/${type}/${year}/${chapter}/section/${section}`
  const url = version === 'enacted'
    ? `${baseUrl}/enacted/data.xml`
    : `${baseUrl}/data.xml`

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/xml' },
      next: { revalidate: 86400 } // cache for 24 hours
    })

    if (!res.ok) {
      return NextResponse.json({ error: `legislation.gov.uk returned ${res.status}` }, { status: res.status })
    }

    const xml = await res.text()
    return new Response(xml, {
      headers: { 'Content-Type': 'application/xml' }
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

This route proxies requests to legislation.gov.uk server-side, bypassing CORS entirely.

### New page: `app/legislation-compare/page.tsx`

This should be a Server Component wrapper that renders a Client Component for the interactive parts.

```typescript
// app/legislation-compare/page.tsx
import type { Metadata } from 'next'
import LegislationCompareClient from './LegislationCompareClient'

export const metadata: Metadata = {
  title: 'Legislation Compiler — AI Evaluation | Scrutinise',
  description: 'Compare AI-compiled UK legislation against the National Archives gold standard. Free, open tool.',
}

export default function LegislationComparePage() {
  return <LegislationCompareClient />
}
```

### New client component: `app/legislation-compare/LegislationCompareClient.tsx`

This is the full interactive UI. Copy the logic and structure from the standalone HTML evaluator (`legislation_evaluator.html` in the CCh outputs), adapting it to React/Tailwind. Key differences from the HTML version:

1.  **Legislation fetching**: call `/api/legislation/fetch?type=...&year=...&chapter=...&section=...&version=revised` (and `version=enacted` for the original) instead of using a CORS proxy.
2.  **AI calls**: these stay client-side, using the user's API keys from state (never sent to the server). Same API call structure as the HTML version.
3.  **Styling**: use Tailwind classes consistent with the rest of Scrutinise. Dark theme (`bg-gray-950`, `bg-gray-900` etc.) matching the HTML evaluator's aesthetic.
4.  **Test sections**: the same 20 sections defined in the HTML evaluator. Include the full `TEST_SECTIONS` array.
5.  **Models**: same 6 models (Gemini 2.5 Flash, Gemini 2.5 Pro, Claude Sonnet 4.5, GPT-4o, Grok 3 Fast, Perplexity Sonar).
6.  **Scoring**: same Jaccard similarity scoring.
7.  **Add a note at the top of the page:**

```tsx
<div className="rounded-lg bg-amber-950/30 border border-amber-800/40 p-4 text-sm text-amber-300 mb-6">
  <strong>Research tool.</strong> AI-compiled legislation is not a legal authority.
  Always verify against the official text on legislation.gov.uk.
  API keys you enter are used only in your browser and never stored by Scrutinise.
</div>
```

8.  **Add to the public nav**: add a "Legislation" link in the main navigation pointing to `/legislation-compare`. This page is a public good and a top-of-funnel entry point.

**Middleware**: ensure `/legislation-compare` and `/api/legislation/fetch` are public (no auth required). Add them to the public routes list in `middleware.ts`.

Run `tsc --noEmit`. Commit: `feat: legislation evaluator page at /legislation-compare with server-side fetch proxy (V2C-leg-compare)`

***

## COMMIT 3 — Legislation DB schema

### File: `prisma/schema.prisma`

Add the following models. These implement the data design from `Scrutinise_LegislationDB_Design_v2_23Mar2026.docx`.

**New enums:**

```prisma
enum LegislationTier {
  TIER_1  // Post-2010 Public General Acts — first priority
  TIER_2  // Pre-2010 Public General Acts, Devolved Acts
  TIER_3  // Statutory Instruments
  TIER_4  // Extended corpus (FCA, HMRC, etc.)
}

enum LegislationType {
  UKPGA   // UK Public General Act
  UKSI    // UK Statutory Instrument
  UKLA    // UK Local Act
  ASP     // Act of the Scottish Parliament
  SSI     // Scottish Statutory Instrument
  ANAW    // Act of the National Assembly for Wales / Senedd
  WSI     // Welsh Statutory Instrument
  NIER    // Northern Ireland legislation
  EUR     // Retained EU legislation
  OTHER
}

enum CompilationConfidence {
  HIGH    // All amendments applied without ambiguity
  MEDIUM  // Minor interpretation required
  LOW     // One or more amendments could not be applied — needs review
}

enum CompilationStatus {
  PENDING       // Not yet compiled
  COMPILING     // In progress
  COMPILED      // Complete
  FAILED        // Compilation failed — see errorLog
  NEEDS_REVIEW  // LOW confidence — queued for human review
}

enum CorrectionStatus {
  PENDING
  LEX_REVIEW
  ADMIN_REVIEW
  ACCEPTED
  REJECTED
}

enum CorrectionDecision {
  ACCEPT
  REJECT
  UNCERTAIN
}
```

**New models:**

```prisma
// Top-level legislation item (an Act or SI)
model LegislationItem {
  id                    String              @id @default(uuid())
  // Identity
  legislationType       LegislationType
  tier                  LegislationTier
  title                 String
  year                  Int
  number                Int                 // Chapter number (Acts) or SI number
  jurisdiction          String              // 'UK', 'Scotland', 'Wales', 'NI'
  // Source
  legislationGovUkId    String              @unique // e.g. "ukpga/2006/46"
  clmlUrl               String              // URL to bulk CLML XML on legislation.gov.uk
  r2Key                 String?             // Key in R2 scrutinise-legislation bucket (raw CLML)
  // Compilation state
  compilationStatus     CompilationStatus   @default(PENDING)
  compilationProvider   String?             // 'gemini-2.5-flash' etc — winning model
  compiledAt            DateTime?
  sectionCount          Int                 @default(0)
  compiledSectionCount  Int                 @default(0)
  // Metadata
  shortTitle            String?
  longTitle             String?
  enactmentDate         DateTime?
  inForce               Boolean             @default(true)
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  sections              LegislationSection[]
  ideaLinks             IdeaLegislation[]

  @@index([legislationType, year])
  @@index([tier])
  @@index([jurisdiction])
}

// Individual section within an Act
model LegislationSection {
  id                    String                  @id @default(uuid())
  legislationItemId     String
  legislationItem       LegislationItem         @relation(fields: [legislationItemId], references: [id])
  // Identity
  sectionNumber         String                  // "1", "13E", "172" etc
  sectionTitle          String?
  // Text content
  originalText          String?                 // As-enacted CLML text
  compiledText          String?                 // AI-compiled current text
  // Compilation quality
  confidence            CompilationConfidence?
  confidenceReason      String?
  compilationVersion    Int                     @default(1)
  compilationNotes      String?
  unappliedAmendments   Json?                   // Array of {sourceInstrument, reason}
  commencementNote      String?                 // If commencement is uncertain
  // Compilation metadata
  compiledAt            DateTime?
  compiledBy            String?                 // Model identifier
  compilationStatus     CompilationStatus       @default(PENDING)
  // Flags
  isRepealed            Boolean                 @default(false)
  needsReview           Boolean                 @default(false)
  // Timestamps
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt

  amendments            LegislationAmendment[]
  corrections           LegislationCorrection[]

  @@index([legislationItemId])
  @@index([compilationStatus])
  @@index([needsReview])
}

// Amendment applied to a section
model LegislationAmendment {
  id                    String              @id @default(uuid())
  sectionId             String
  section               LegislationSection  @relation(fields: [sectionId], references: [id])
  // Source of amendment
  sourceInstrument      String              // "Finance Act 2019"
  sourceInstrumentId    String?             // legislationGovUkId of the amending instrument
  sourceUrl             String?             // Direct URL to the amending provision
  effectDate            DateTime?
  // Amendment details
  amendmentType         String              // 'substitution' | 'insertion' | 'repeal' | 'modification'
  instruction           String              // The raw amendment instruction text
  targetedText          String?             // Original text targeted
  substitutedText       String?             // Replacement text (if substitution)
  // Application
  applied               Boolean             @default(false)
  applicationNotes      String?
  orderIndex            Int                 // Chronological order for application
  createdAt             DateTime            @default(now())

  @@index([sectionId])
  @@index([effectDate])
}

// Link between an Idea and relevant legislation
model IdeaLegislation {
  id                    String              @id @default(uuid())
  ideaId                String
  idea                  Idea                @relation(fields: [ideaId], references: [id])
  legislationItemId     String
  legislationItem       LegislationItem     @relation(fields: [legislationItemId], references: [id])
  linkType              String              // 'target' | 'relevant' | 'precedent'
  notes                 String?
  addedByUserId         String?
  createdAt             DateTime            @default(now())

  @@unique([ideaId, legislationItemId])
  @@index([ideaId])
  @@index([legislationItemId])
}

// User-submitted corrections to compiled text
model LegislationCorrection {
  id                    String                  @id @default(uuid())
  sectionId             String
  section               LegislationSection      @relation(fields: [sectionId], references: [id])
  userId                String
  user                  User                    @relation(fields: [userId], references: [id])
  description           String
  proposedText          String?
  sourceUrl             String?
  status                CorrectionStatus        @default(PENDING)
  lexAssessment         String?
  lexDecision           CorrectionDecision?
  adminDecision         CorrectionDecision?
  adminNotes            String?
  createdAt             DateTime                @default(now())
  resolvedAt            DateTime?

  @@index([sectionId])
  @@index([status])
}
```

**Add to Idea model relations:**

```prisma
// In the Idea model relations list, add:
legislationLinks      IdeaLegislation[]
```

**Add to User model relations:**

```prisma
// In the User model relations list, add:
legislationCorrections LegislationCorrection[]
```

After schema changes:

```bash
npx prisma db push
npx prisma generate
tsc --noEmit
```

Commit: `feat: legislation DB schema — LegislationItem, LegislationSection, LegislationAmendment, IdeaLegislation, LegislationCorrection (V2C-leg-schema)`

***

## COMMIT 4 — Legislation ingestion script

### New file: `scripts/legislation/ingest.ts`

This script fetches legislation from legislation.gov.uk, parses the CLML XML, and loads it into the DB.

```typescript
import { prisma } from '../../scrutinise-web/lib/prisma'
import { LegislationTier, LegislationType, CompilationStatus } from '@prisma/client'

// Tier 1 Acts — post-2010 UK Public General Acts
// legislation.gov.uk OData feed for ukpga
const TIER_1_FEED = 'https://www.legislation.gov.uk/ukpga/2010-2025/data.feed?results-count=100'

async function fetchActList(feedUrl: string): Promise<Array<{
  title: string, year: number, number: number, id: string, clmlUrl: string
}>> {
  const res = await fetch(feedUrl)
  const xml = await res.text()
  // Parse Atom feed XML
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
  return entries.map(([, entry]) => {
    const title = entry.match(/<title[^>]*>(.*?)<\/title>/)?.[1] ?? ''
    const id = entry.match(/<ukm:DocumentMainType\s+Value="([^"]+)"/)?.[1] ?? ''
    const year = parseInt(entry.match(/<ukm:Year\s+Value="(\d+)"/)?.[1] ?? '0')
    const number = parseInt(entry.match(/<ukm:Number\s+Value="(\d+)"/)?.[1] ?? '0')
    const clmlUrl = entry.match(/<link[^>]*type="application\/xml"[^>]*href="([^"]+)"/)?.[1] ?? ''
    return { title, year, number, id, clmlUrl }
  }).filter(a => a.year > 0 && a.number > 0)
}

async function fetchSections(clmlUrl: string): Promise<Array<{
  sectionNumber: string, sectionTitle: string, originalText: string
}>> {
  const res = await fetch(clmlUrl)
  const xml = await res.text()
  // Parse CLML P1group elements (top-level sections)
  const sections = []
  const p1groups = [...xml.matchAll(/<P1group>([\s\S]*?)<\/P1group>/g)]
  for (const [, group] of p1groups) {
    const num = group.match(/<Pnumber[^>]*>(.*?)<\/Pnumber>/)?.[1]?.trim() ?? ''
    const title = group.match(/<Title[^>]*>(.*?)<\/Title>/)?.[1]?.replace(/<[^>]+>/g, '') ?? ''
    const text = group.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (num) sections.push({ sectionNumber: num, sectionTitle: title, originalText: text })
  }
  return sections
}

async function ingestAct(act: { title: string, year: number, number: number, id: string, clmlUrl: string }) {
  console.log(`Ingesting: ${act.title} (${act.year})...`)

  // Upsert the LegislationItem
  const item = await prisma.legislationItem.upsert({
    where: { legislationGovUkId: `ukpga/${act.year}/${act.number}` },
    create: {
      legislationType: LegislationType.UKPGA,
      tier: LegislationTier.TIER_1,
      title: act.title,
      year: act.year,
      number: act.number,
      jurisdiction: 'UK',
      legislationGovUkId: `ukpga/${act.year}/${act.number}`,
      clmlUrl: act.clmlUrl,
      compilationStatus: CompilationStatus.PENDING,
    },
    update: { clmlUrl: act.clmlUrl }
  })

  // Fetch and upsert sections
  const sections = await fetchSections(act.clmlUrl)
  for (const s of sections) {
    await prisma.legislationSection.upsert({
      where: {
        // Need a unique constraint — add @@unique([legislationItemId, sectionNumber]) to schema
        // For now use findFirst + create/update pattern:
        id: (await prisma.legislationSection.findFirst({
          where: { legislationItemId: item.id, sectionNumber: s.sectionNumber }
        }))?.id ?? 'new'
      },
      create: {
        legislationItemId: item.id,
        sectionNumber: s.sectionNumber,
        sectionTitle: s.sectionTitle,
        originalText: s.originalText,
        compilationStatus: CompilationStatus.PENDING,
      },
      update: { originalText: s.originalText, sectionTitle: s.sectionTitle }
    })
  }

  await prisma.legislationItem.update({
    where: { id: item.id },
    data: { sectionCount: sections.length }
  })

  console.log(`  ✓ ${sections.length} sections loaded`)
}

async function main() {
  console.log('Fetching Tier 1 Act list...')
  const acts = await fetchActList(TIER_1_FEED)
  console.log(`Found ${acts.length} Acts`)

  for (const act of acts.slice(0, 10)) { // Start with first 10 for testing
    await ingestAct(act)
    await new Promise(r => setTimeout(r, 500)) // Rate limit
  }

  console.log('Ingestion complete')
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

**Note:** The `@@unique([legislationItemId, sectionNumber])` constraint should be added to `LegislationSection` in the schema (update Commit 3 before running Commit 4):

```prisma
@@unique([legislationItemId, sectionNumber])
```

Then update the ingestion script to use `upsert` with the composite key properly.

**How to run:**

```bash
cd scrutinise-web
npx ts-node ../scripts/legislation/ingest.ts
```

This is a manual script — not auto-run. Run it when ready to start ingesting. Start with `slice(0, 5)` to test on 5 Acts before running the full batch.

Commit: `feat: legislation ingestion script — CLML fetch and parse for Tier 1 Acts (V2C-leg-ingest)`

***

## COMMIT 5 — Legislation compilation script

### New file: `scripts/legislation/compile.ts`

This script takes `PENDING` LegislationSection records and compiles them using the AI.

```typescript
import { prisma } from '../../scrutinise-web/lib/prisma'
import { CompilationStatus, CompilationConfidence } from '@prisma/client'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!
const MODEL = 'gemini-2.5-flash'

const SYSTEM_PROMPT = `You are a legislative compilation specialist. Your task is to apply amendment instructions to original UK legislation text to produce a clean, accurate compiled version.

ABSOLUTE RULES:
1. Apply amendments exactly as written. Never interpret legislative intent. Never improve or clarify the text.
2. Apply amendments in chronological order by effectDate.
3. If an amendment instruction is ambiguous or the target text cannot be located precisely, DO NOT apply it. Record it in unappliedAmendments with your reason.
4. Never paraphrase, summarise, or reword any provision.
5. Preserve all original formatting: numbered paragraphs, lettered sub-paragraphs, defined terms in quotation marks.
6. Output ONLY valid JSON. No preamble, no explanation, no markdown.`

async function compileSection(sectionId: string): Promise<void> {
  const section = await prisma.legislationSection.findUnique({
    where: { id: sectionId },
    include: {
      legislationItem: { select: { title: true, year: true } },
      amendments: { orderBy: { orderIndex: 'asc' } }
    }
  })

  if (!section || !section.originalText) return

  const amendmentList = section.amendments.map(a =>
    `- Source: ${a.sourceInstrument} (${a.effectDate?.toISOString().split('T')[0] ?? 'unknown'})
  Type: ${a.amendmentType}
  Instruction: ${a.instruction}
  ${a.targetedText ? `Original text targeted: ${a.targetedText}` : ''}
  ${a.substitutedText ? `Substitute with: ${a.substitutedText}` : ''}`
  ).join('\n\n')

  const userPrompt = `Compile the following section of UK legislation by applying the listed amendments in chronological order.

SECTION REFERENCE: Section ${section.sectionNumber}
ACT: ${section.legislationItem.title} ${section.legislationItem.year}

ORIGINAL TEXT:
${section.originalText}

AMENDMENTS TO APPLY:
${amendmentList || 'No amendments recorded — output the original text as compiled text.'}

OUTPUT FORMAT (JSON only):
{
  "sectionRef": "string",
  "compiledText": "string",
  "confidence": "HIGH | MEDIUM | LOW",
  "confidenceReason": "string (required if not HIGH)",
  "unappliedAmendments": [{"sourceInstrument": "string", "reason": "string"}],
  "commencementNote": "string | null"
}`

  await prisma.legislationSection.update({
    where: { id: sectionId },
    data: { compilationStatus: CompilationStatus.COMPILING }
  })

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json' }
        })
      }
    )

    const data = await res.json()
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const result = JSON.parse(rawText)

    const confidence = result.confidence as CompilationConfidence
    const needsReview = confidence === 'LOW'

    await prisma.legislationSection.update({
      where: { id: sectionId },
      data: {
        compiledText: result.compiledText,
        confidence,
        confidenceReason: result.confidenceReason ?? null,
        unappliedAmendments: result.unappliedAmendments ?? [],
        commencementNote: result.commencementNote ?? null,
        compilationStatus: needsReview ? CompilationStatus.NEEDS_REVIEW : CompilationStatus.COMPILED,
        compiledAt: new Date(),
        compiledBy: MODEL,
        needsReview,
        compilationVersion: { increment: 1 }
      }
    })

    console.log(`  ✓ s.${section.sectionNumber} — ${confidence}${needsReview ? ' (flagged for review)' : ''}`)

  } catch (err) {
    await prisma.legislationSection.update({
      where: { id: sectionId },
      data: { compilationStatus: CompilationStatus.FAILED }
    })
    console.error(`  ✗ s.${section.sectionNumber} — ${err}`)
  }
}

async function main() {
  const pendingSections = await prisma.legislationSection.findMany({
    where: { compilationStatus: CompilationStatus.PENDING },
    select: { id: true },
    take: 50 // batch of 50 at a time
  })

  console.log(`Compiling ${pendingSections.length} sections...`)

  for (const { id } of pendingSections) {
    await compileSection(id)
    await new Promise(r => setTimeout(r, 200)) // Rate limit
  }

  console.log('Batch complete')
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

**How to run:**

```bash
GEMINI_API_KEY=your-key npx ts-node scripts/legislation/compile.ts
```

Run after ingestion. Processes 50 sections per run. Re-run to process more. Sections with `NEEDS_REVIEW` status are flagged but not blocked — they appear in the admin panel for review.

Commit: `feat: legislation compilation script — AI batch compiler using Gemini 2.5 Flash (V2C-leg-compile)`

***

## COMMIT 6 — Legislation API routes

### `app/api/legislation/search/route.ts`

```typescript
// GET /api/legislation/search?q=...&type=...&year=...&jurisdiction=...&page=1
// Public — no auth required
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const type = searchParams.get('type')
  const year = searchParams.get('year')
  const jurisdiction = searchParams.get('jurisdiction')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = 20

  const items = await prisma.legislationItem.findMany({
    where: {
      compilationStatus: { in: ['COMPILED', 'NEEDS_REVIEW'] },
      ...(type ? { legislationType: type as any } : {}),
      ...(year ? { year: parseInt(year) } : {}),
      ...(jurisdiction ? { jurisdiction } : {}),
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
    },
    select: {
      id: true,
      title: true,
      year: true,
      number: true,
      legislationType: true,
      jurisdiction: true,
      compiledSectionCount: true,
      sectionCount: true,
    },
    orderBy: [{ year: 'desc' }, { title: 'asc' }],
    skip: (page - 1) * limit,
    take: limit,
  })

  return NextResponse.json({ items, page })
}
```

### `app/api/legislation/[itemId]/route.ts`

```typescript
// GET /api/legislation/[itemId] — retrieve a LegislationItem with its compiled sections
// Public — no auth required
export async function GET(req: Request, { params }: { params: { itemId: string } }) {
  const item = await prisma.legislationItem.findUnique({
    where: { id: params.itemId },
    include: {
      sections: {
        where: { compilationStatus: { in: ['COMPILED', 'NEEDS_REVIEW'] } },
        orderBy: { sectionNumber: 'asc' },
        include: { amendments: { orderBy: { orderIndex: 'asc' } } }
      }
    }
  })

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}
```

### `app/api/legislation/link/route.ts`

```typescript
// POST /api/legislation/link — link a LegislationItem to an Idea
// Auth required
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = z.object({
    ideaId: z.string(),
    legislationItemId: z.string(),
    linkType: z.enum(['target', 'relevant', 'precedent']),
    notes: z.string().optional(),
  }).safeParse(body)

  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const link = await prisma.ideaLegislation.upsert({
    where: { ideaId_legislationItemId: { ideaId: parsed.data.ideaId, legislationItemId: parsed.data.legislationItemId } },
    create: { ...parsed.data, addedByUserId: userId },
    update: { linkType: parsed.data.linkType, notes: parsed.data.notes }
  })

  return NextResponse.json(link, { status: 201 })
}
```

Add all these routes to `middleware.ts` public GET routes where appropriate.

Commit: `feat: legislation API routes — search, retrieve, link to idea (V2C-leg-api)`

***

## COMMIT 7 — Legislation search UI

### New page: `app/legislation/page.tsx`

A public-facing search and browse page for compiled legislation. Simple, functional, consistent with Scrutinise's design.

Key elements:

-   Search input with debounce (300ms)
-   Filter by type (Act / SI), jurisdiction (UK / Scotland / Wales / NI), year range
-   Results list: Act title, year, type, section count, compilation status badge
-   Click through to individual Act page with section list
-   Each section shows: compiled text, confidence badge (HIGH/MEDIUM/LOW), provenance banner ("AI-compiled — not a legal authority. View original →"), expandable amendment history
-   "Suggest a correction" button on each section (auth required — redirects to sign-in if not logged in)
-   Provenance banner on every compiled section (required per design doc):

```
⚠️ AI-compiled — not a legal authority.
🔗 View original on legislation.gov.uk →
🗒 N amendments applied. View amendment history →
✅ Confidence: HIGH | 💡 Suggest a correction
```

Add "Legislation" to the public nav. Add `/legislation` and `/legislation/[itemId]` to `middleware.ts` public routes.

This page is initially empty (nothing compiled yet) but ready for content once the ingestion and compilation scripts have been run.

Commit: `feat: legislation search and browse UI at /legislation (V2C-leg-ui)`

***

## COMMIT 8 — Docs update

### `docs/CHANGE_LOG.md`

Add one entry per commit.

### `docs/handoff_summary.md`

Add Sprint V2-C section at the top. Include:

-   All 8 commits
-   Schema additions confirmed (5 new models)
-   Scripts ready to run (ingest + compile) — not yet executed against production
-   Legislation evaluator live at /legislation-compare
-   Admin nav link added
-   Next: run ingestion script against Tier 1 Acts (Charlie to initiate)

### Note in handoff on R2 bucket

The ingestion script stores raw CLML in R2 bucket `scrutinise-legislation`. This bucket needs to be created in Cloudflare by Charlie before the ingestion script can store files. The DB records will be created regardless — R2 storage is optional for Phase 1. The `r2Key` field can be null initially.

Commit: `docs: V2-C CHANGE_LOG, handoff v24 (V2C-docs)`

***

## AFTER ALL COMMITS

```bash
tsc --noEmit        # must be zero errors
git status          # confirm nothing uncommitted
git push origin Main
```

**Manual steps after deploy (Charlie):**

1.  Create `scrutinise-legislation` R2 bucket in Cloudflare dashboard (optional for Phase 1 but needed for bulk storage)
2.  Run ingestion: `cd scrutinise-web && npx ts-node ../scripts/legislation/ingest.ts` (start with 5 Acts to test)
3.  Run compilation: `GEMINI_API_KEY=xxx npx ts-node scripts/legislation/compile.ts`
4.  Check admin panel for any NEEDS_REVIEW sections

***

## DEFERRED — DO NOT BUILD

-   Extended corpus (FCA Handbook, HMRC manuals, devolved Acts) — V2-D
-   Lex integration for legislation context injection — V2-D
-   Correction flow UI — V2-D
-   Amendment relationship graph (i.AI Lex Graph ingestion) — V2-D

***

## V3 BACKLOG

-   Vanity referral URLs (`scrutinise.org/[userNumber]`)

***

*CC Brief — Sprint V2-C — 13 April 2026 — Prepared by CCh* *Read CLAUDE.md and handoff_summary.md before starting.*
