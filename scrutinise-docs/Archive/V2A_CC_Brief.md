# CC BRIEF — SPRINT V2-A

*Prepared by CCh — 13 April 2026* *Read CLAUDE.md and handoff_summary.md (v22) first. L5-A is the last completed sprint.*

***

## BEFORE STARTING ANY CODE

1.  Run `git status` — confirm on Main
2.  Run `npx prisma generate`
3.  Confirm `GEMINI_API_KEY` and `GROK_API_KEY` are present in Vercel Production env vars — these were listed as "needs verification" in the handoff. Check the Vercel dashboard before writing any code. If missing, flag to Charlie immediately.

***

## OVERVIEW — 8 COMMITS THIS SPRINT

| \# | Commit                                                                                   | Area |
|----|------------------------------------------------------------------------------------------|------|
| 1  | AI reliability — Vercel timeout, Grok fallback, auto-retry, Sentry logging               | API  |
| 2  | Stage labels — replace stage names with "Stage X" in UI                                  | UI   |
| 3  | Field labels — `lib/field-labels.ts`                                                     | Lib  |
| 4  | Schema additions — GuidingPolicy, CoherentAction, ResourcesCommitted, TargetOrganisation | DB   |
| 5  | Navigation and UX fixes                                                                  | UI   |
| 6  | Credibility points system                                                                | Lib  |
| 7  | "What Next?" static panel                                                                | UI   |
| 8  | Docs — system_mechanics v0.8, entity_list reference update, CHANGE_LOG, handoff          | Docs |

***

## COMMIT 1 — AI reliability: Vercel timeout, Grok fallback, auto-retry, Sentry logging

### File: `vercel.json`

Ensure explicit `maxDuration` on the AI route:

```json
{
  "functions": {
    "app/api/ai/[ideaId]/route.ts": {
      "maxDuration": 60
    }
  }
}
```

If `vercel.json` does not exist, create it in the project root.

### File: `app/api/ai/[ideaId]/route.ts`

**Change 1 — Audit and fix the Grok fallback.**

Find the try/catch around the Gemini API call. The fallback to Grok must trigger on *any* Gemini failure — timeout, 5xx, API error, rate limit. If the catch block currently returns an error response directly without attempting Grok, fix it. The correct structure:

```typescript
let aiResponse;
const startTime = Date.now();

try {
  aiResponse = await callGemini(/* ... */);
  await logAICall({ provider: 'gemini', success: true, durationMs: Date.now() - startTime });
} catch (geminiError) {
  const geminiDuration = Date.now() - startTime;
  const geminiErrorType = classifyError(geminiError); // 'timeout' | 'rate_limit' | 'api_error' | 'network'
  await logAICall({ provider: 'gemini', success: false, durationMs: geminiDuration, errorType: geminiErrorType });

  const grokStart = Date.now();
  try {
    aiResponse = await callGrok(/* ... */);
    await logAICall({ provider: 'grok', success: true, durationMs: Date.now() - grokStart, fallbackUsed: true });
  } catch (grokError) {
    await logAICall({ provider: 'grok', success: false, durationMs: Date.now() - grokStart, errorType: classifyError(grokError) });
    return NextResponse.json({ error: 'both_failed', errorType: 'both_failed' }, { status: 503 });
  }
}
```

Add a `classifyError` helper in the same file:

```typescript
function classifyError(error: unknown): string {
  const msg = String(error).toLowerCase();
  if (msg.includes('timeout') || msg.includes('etimedout')) return 'timeout';
  if (msg.includes('rate') || msg.includes('429')) return 'rate_limit';
  if (msg.includes('network') || msg.includes('econnrefused')) return 'network';
  return 'api_error';
}
```

**Change 2 — Structured Sentry logging.**

Import Sentry (already wired) and add after every AI call attempt:

```typescript
import * as Sentry from '@sentry/nextjs';

// Add this inside logAICall (create this helper function):
async function logAICall(params: {
  provider: string;
  success: boolean;
  durationMs: number;
  errorType?: string;
  fallbackUsed?: boolean;
  ideaId?: string;
}) {
  Sentry.captureEvent({
    message: 'lex_ai_call',
    level: params.success ? 'info' : 'warning',
    extra: {
      provider: params.provider,
      ideaId: params.ideaId,
      success: params.success,
      durationMs: params.durationMs,
      errorType: params.errorType ?? null,
      fallbackUsed: params.fallbackUsed ?? false,
    }
  });
}
```

**Change 3 — Return structured error type** in the 503 response so the client can display a better message:

```typescript
return NextResponse.json({
  error: 'connection_failed',
  errorType: geminiErrorType // 'timeout' | 'rate_limit' | 'api_error' | 'both_failed'
}, { status: 503 });
```

### File: `app/ideas/create/CreateIdeaClient.tsx` (and equivalent editing client)

**Change 4 — Auto-retry with progressive messaging.**

Replace the current error handling on AI call failure:

```typescript
// State additions:
const [retryCount, setRetryCount] = useState(0);
const [retryMessage, setRetryMessage] = useState<string | null>(null);

// Replace current error catch:
} catch (error: unknown) {
  const errorType = (error as { errorType?: string })?.errorType ?? 'api_error';

  if (retryCount === 0) {
    // First failure: silent auto-retry after 1 second
    setRetryCount(1);
    setIsLoading(true);
    setTimeout(() => handleSendMessage(messageText, true), 1000);
    return;
  }

  if (retryCount === 1 && (errorType === 'timeout' || errorType === 'rate_limit')) {
    // Second failure with recoverable error: show message + auto-retry after 5 seconds
    setRetryCount(2);
    const provider = errorType === 'timeout' ? 'Gemini' : 'Lex';
    setRetryMessage(`${provider} is taking a while to think — we'll keep trying, thank you for your patience.`);
    setIsLoading(true);
    setTimeout(() => handleSendMessage(messageText, true), 5000);
    return;
  }

  // Final failure or unrecoverable error: show error with Try Again button
  setRetryCount(0);
  setRetryMessage(null);
  setMessages(prev => [...prev, {
    role: 'assistant',
    content: errorType === 'both_failed'
      ? 'Lex is temporarily unavailable — please try again in a moment.'
      : 'Lex is taking a while — please try again.',
    isConnectionError: true,
  }]);
  setIsLoading(false);
}
```

The `handleSendMessage` function should accept an optional `isRetry: boolean` parameter so it skips appending the user message again on retry.

When `retryMessage` is non-null, display it as a subtle inline note below the chat input (not as an error bubble). Clear it when a successful response arrives.

Commit message: `fix: AI reliability — Vercel timeout, Grok fallback audit, auto-retry, Sentry logging (V2A-connection)`

***

## COMMIT 2 — Stage labels: replace stage names with "Stage X" in notifications and idea pills

### New file: `lib/display-utils.ts` (or add to existing if it exists)

```typescript
export function stageToLabel(stage: string): string {
  const map: Record<string, string> = {
    STAGE_1: 'Stage 1',
    STAGE_2: 'Stage 2',
    STAGE_3: 'Stage 3',
    STAGE_4: 'Stage 4',
    STAGE_5: 'Stage 5',
    ARCHIVED: 'Archived',
    WITHDRAWN: 'Withdrawn',
  };
  return map[stage] ?? stage;
}
```

### Apply everywhere a stage name appears in the UI:

1.  Dashboard notification cards — wherever the notification body or title includes a stage name ("Draft", "Develop", "Campaign", "Legislate"), replace with the `stageToLabel()` output.
2.  Idea list pill (the status badge on each idea card in the dashboard and browse page) — replace the stage name text with `stageToLabel(idea.stage)`.
3.  Remove the box "Voting opens when this idea reaches the Campaign stage" from `app/ideas/[id]/IdeaDetailClient.tsx` entirely.

**Important:** The DB enum values (`STAGE_1`, `STAGE_2` etc.) stay unchanged. This is display-only.

Commit message: `feat: stage labels in UI — Stage X format, remove voting box (V2A-labels)`

***

## COMMIT 3 — Field labels: `lib/field-labels.ts`

Create a new file `lib/field-labels.ts` with the complete field label mapping. This is a static lookup — zero DB changes, no migration.

```typescript
export const FIELD_LABELS: Record<string, { sectionHeading?: string; userLabel: string }> = {
  // Diagnosis
  diagnosisTitle:         { sectionHeading: 'Diagnosis — The Challenge',          userLabel: 'The Challenge' },
  diagnosisDescription:   {                                                        userLabel: 'Describe the Challenge' },
  obstacleDefined:        {                                                        userLabel: "What's Blocking Progress" },
  whoAffected:            {                                                        userLabel: 'Who Is Affected' },
  howAffected:            {                                                        userLabel: "How They're Affected" },
  whyPersisted:           {                                                        userLabel: 'Why Has This Gone Unsolved' },
  impactDescription:      {                                                        userLabel: 'The Impact' },
  impactCost:             {                                                        userLabel: 'The Cost of Inaction' },

  // Root Cause
  rootCauseTitle:         { sectionHeading: 'Root Causes — Why It Happens',       userLabel: 'Root Cause' },
  rootCauseDescription:   {                                                        userLabel: 'Explain This Cause' },
  rootCauseLinkBack:      {                                                        userLabel: 'What Caused This Cause' },
  rootCauseLinkForward:   {                                                        userLabel: 'What Does This Cause Lead To' },
  rootCauseMechanism:     {                                                        userLabel: 'How It Works' },
  whyNotSolved:           {                                                        userLabel: "Why Hasn't This Been Fixed" },
  incentiveDrivers:       {                                                        userLabel: 'Incentives Keeping It in Place' },
  structureDrivers:       {                                                        userLabel: 'Structural Factors' },

  // Guiding Policy
  guidingPolicyTitle:                       { sectionHeading: 'Guiding Policy — Your Approach', userLabel: 'Your Approach' },
  guidingPolicyDescription:                 { userLabel: 'Describe Your Approach' },
  coreTheory:                               { userLabel: 'Your Theory of Change' },
  linkToDiagnosis:                          { userLabel: 'How This Addresses the Root Cause' },
  whatThisPolicyRulesOut:                   { userLabel: "What We're Not Doing" },
  whyThisApproachNotOthers:                 { userLabel: 'Why This Approach' },
  conditionsForSuccess:                     { userLabel: 'What Has to Be True' },
  mechanismIncentives:                      { userLabel: 'Incentive Mechanisms' },
  mechanismRules:                           { userLabel: 'Rules & Mandates' },
  mechanismTransparency:                    { userLabel: 'Transparency Measures' },
  mechanismMarketDesign:                    { userLabel: 'Market Design' },
  mechanismInstitutionalRestructuring:      { userLabel: 'Institutional Changes' },
  tradeOffs:                                { userLabel: 'Trade-offs & Compromises' },
  competitiveIdeaAnalysis:                  { userLabel: 'Competing Approaches' },

  // Evidence
  comparablePolicy:  { sectionHeading: 'Evidence — Real-World Precedents', userLabel: 'Comparable Policy' },
  successFailure:    { userLabel: 'Did It Work' },
  whatWorked:        { userLabel: 'What Worked' },
  whatFailed:        { userLabel: 'What Failed' },
  resultCauses:      { userLabel: 'Why It Turned Out That Way' },

  // Coherent Action
  coherentActionTitle:                  { sectionHeading: 'Coherent Actions — What Is to Be Changed', userLabel: 'Action Title' },
  summarySnippet:                       { userLabel: 'One-line Summary' },
  detailedDescription:                  { userLabel: 'What This Does and Why' },
  actionType:                           { userLabel: 'Type of Change' },
  legislationDraftWording:              { userLabel: 'Draft Legislation Wording' },
  organisationalChangeDraftWording:     { userLabel: 'Organisational Change Wording' },
  costBenefitAnalysis:                  { userLabel: 'Cost-Benefit Summary' },
  netCostOngoing:                       { userLabel: 'Net Annual Cost (£)' },
  netCostOneOff:                        { userLabel: 'Net One-off Cost (£)' },
  costFinancial:                        { userLabel: 'Financial Cost of this Action' },
  costSocial:                           { userLabel: 'Social Cost of this Action' },
  costOngoing:                          { userLabel: 'Annual Ongoing Costs of this Action' },
  benefitFinancial:                     { userLabel: 'Financial Benefits of this Action' },
  benefitSocial:                        { userLabel: 'Social Benefits of this Action' },
  benefitOngoing:                       { userLabel: 'Annual Ongoing Benefits of this Action' },
  benefits:                             { userLabel: 'Benefits (general)' },
  practicalExecution:                   { userLabel: 'How This Action Is Carried Out' },
  implementationPlan:                   { userLabel: 'Implementation Plan' },
  accountability:                       { userLabel: 'Accountability' },
  successMeasurement:                   { userLabel: 'How Success Is Measured' },
  keyRisks:                             { userLabel: 'Key Risks' },
  potentialHarm:                        { userLabel: 'Potential Harms' },
  keyChallenges:                        { userLabel: 'Key Challenges' },
  sourcesOfOpposition:                  { userLabel: 'Sources of Opposition' },
  oppositionWho:                        { userLabel: 'Who Will Oppose This' },
  oppositionWhy:                        { userLabel: "Why They'll Oppose It" },
  oppositionAnswers:                    { userLabel: 'Responses to Opposition' },

  // Resources Committed
  resourceDescription:              { sectionHeading: "Resources — What You're Committing", userLabel: 'Resource Description' },
  capitalCommitment:                { userLabel: 'Capital Commitment' },
  annualCost:                       { userLabel: 'Annual Cost' },
  timeframe:                        { userLabel: 'Timeframe' },
  humanCapitalCommitted:            { userLabel: 'Human Capital Committed' },
  humanCapitalAnnualRequirement:    { userLabel: 'Human Capital Annual Requirement' },

  // Idea core
  title:                { userLabel: 'Idea Title' },
  summaryDescription:   { userLabel: 'Your Idea in Brief' },
  situationalAnalysis:  { userLabel: 'Background & Context' },
  targetLegislation:    { userLabel: 'Laws to Change' },
  targetOrganisation:   { userLabel: 'Who Must Act' },
  proposedWording:      { userLabel: 'Draft Legislation' },
};

export const SIDEBAR_SECTIONS = [
  { key: 'diagnosis',       label: 'Diagnosis — The Challenge' },
  { key: 'guidingPolicy',   label: 'Guiding Policy — Your Approach' },
  { key: 'coherentActions', label: 'Coherent Actions — What Is to Be Changed' },
];

export function getFieldLabel(fieldKey: string): string {
  return FIELD_LABELS[fieldKey]?.userLabel ?? fieldKey;
}

export function getSectionHeading(fieldKey: string): string | undefined {
  return FIELD_LABELS[fieldKey]?.sectionHeading;
}
```

Wire into the right-hand sidebar and wherever field names appear in the UI. Section headings use `sectionHeading` (only on section-level headers); individual field labels use `userLabel`.

**Sidebar behaviour:**

-   Always show all three main section headings (Diagnosis, Guiding Policy, Coherent Actions)
-   For the **current active section**: show all individual fields within it, with completion state (filled / empty)
-   For **completed sections**: show as collapsed with a "show/hide" toggle; expanded shows individual fields
-   For **not-yet-reached sections**: show heading only — no individual fields visible yet

Commit message: `feat: field labels — lib/field-labels.ts, sidebar section navigation (V2A-field-labels)`

***

## COMMIT 4 — Schema additions: GuidingPolicy, CoherentAction, ResourcesCommitted, TargetOrganisation

### File: `prisma/schema.prisma`

**4a. GuidingPolicy — add 4 new fields:**

```prisma
model GuidingPolicy {
  // ... existing fields unchanged ...

  // NEW v5 — Rumelt guiding policy fields
  linkToDiagnosis           String?
  whatThisPolicyRulesOut    String?
  whyThisApproachNotOthers  String?
  conditionsForSuccess      String?

  // ... rest unchanged ...
}
```

**4b. CoherentAction — add 5 new fields:**

```prisma
model CoherentAction {
  // ... existing fields unchanged ...

  // NEW v5 — benefit mirrors for cost fields
  benefitFinancial    String?
  benefitSocial       String?
  benefitOngoing      String?
  netCostOngoing      Decimal?
  netCostOneOff       Decimal?

  // ... rest unchanged ...
}
```

**4c. ResourcesCommitted — add 2 new fields:**

```prisma
model ResourcesCommitted {
  // ... existing fields unchanged ...

  // NEW v5 — human capital
  humanCapitalCommitted            String?
  humanCapitalAnnualRequirement    String?

  // ... rest unchanged ...
}
```

**4d. TargetOrganisation — change organisationType from String? to Enum:**

Add the new enum (place with other enums at top of schema file):

```prisma
enum TargetOrganisationType {
  GOVERNMENT_DEPARTMENT
  ARMS_LENGTH_BODY
  LOCAL_AUTHORITY
  DEVOLVED_GOVERNMENT
  NHS_BODY
  REGULATOR
  POLICE_FORCE
  COURT_OR_TRIBUNAL
  PRIVATE_SECTOR
  THIRD_SECTOR
  EDUCATION_INSTITUTION
  INTERNATIONAL_BODY
  OTHER
}
```

Update the field:

```prisma
model TargetOrganisation {
  // ... existing fields ...
  organisationType    TargetOrganisationType?   // was: String?
  // ... rest unchanged ...
}
```

**After schema changes:**

```bash
npx prisma db push
npx prisma generate
tsc --noEmit
```

Commit message: `feat: schema additions — GuidingPolicy Rumelt fields, CoherentAction benefit mirrors, ResourcesCommitted human capital, TargetOrganisationType enum (V2A-schema)`

***

## COMMIT 5 — Navigation and UX fixes

### 5a. Sign-in redirect to dashboard

In `app/sign-in/[[...sign-in]]/page.tsx`: if there is no `forceRedirectUrl` query param, or it equals `/ideas/create`, redirect to `/dashboard` after sign-in. If `forceRedirectUrl` is anything else (e.g. an idea page), preserve it.

```typescript
const searchParams = useSearchParams();
const redirectUrl = searchParams.get('forceRedirectUrl');
const afterSignInUrl = (!redirectUrl || redirectUrl === '/ideas/create')
  ? '/dashboard'
  : redirectUrl;
```

### 5b. "My Dashboard" button on Create page

In `app/ideas/create/CreateIdeaClient.tsx`, add a "My Dashboard" button to the toolbar strip next to "Save & Exit". It performs the same save logic as "Save & Exit" (save if there is unsaved content) then navigates to `/dashboard`. Label: "My Dashboard". Style: same as existing toolbar buttons.

### 5c. Idea page layout changes

In `app/ideas/[id]/IdeaDetailClient.tsx`:

1.  Move the "Requirements to Take Public" box and "Take Public" button to **below** the main content tab area (below Research, above footer). They should no longer appear above the tabs.
2.  Move the "Edit" button to below the author/date line (currently it is above or separate).
3.  Add a "What Next?" button immediately next to the "Edit" button, same row. Style: secondary/outline, same size as Edit button. On click: toggles the `WhatNextPanel` (see Commit 7).
4.  Remove the "Voting opens when this idea reaches the Campaign stage" box entirely.

### 5d. Notification redesign

In the notification component (dashboard notifications list): update each notification card layout:

```
[Headline text]
[Idea name — muted, smaller font]
[Date — left-aligned]          [What Next? button — right-aligned, same font size as date]
```

The "What Next?" button in a notification navigates to the idea page and opens the WhatNextPanel. Pass `?whatnext=true` as a query param; IdeaDetailClient reads this on mount and opens the panel.

### 5e. Lex orienteering intro on return

In `app/api/ai/[ideaId]/route.ts`, in `buildSystemPrompt`, find the RETURNING SESSION section and replace or extend it with:

```
ORIENTEERING ON RETURN: When a user returns to an idea (aiSessionCount > 0), your FIRST message must contain all three of:

1. A brief personal welcome using their preferredName (e.g. "Welcome back, [name].")
2. One sentence on the last thing worked on — draw from chatSummary or the last 1-2 messages in history. If no summary exists, say "last time we started your idea."
3. The specific next step — name the next unpopulated field using its user-friendly label (not the DB field name). Consult the field targets list.
4. An invitation to continue: "Shall we continue?"

Example: "Welcome back, Charles. Last time we worked through your diagnosis of the challenge and identified housing affordability as the core problem. Next up is identifying the root causes — the underlying mechanisms that keep the problem in place. Shall we continue?"

Keep this to 2-3 sentences. Do not use "Great to see you again", "Wonderful", or any hollow affirmations. Do not thank the user for returning.
```

Commit message: `feat: UX fixes — sign-in redirect, dashboard button, idea page layout, notification redesign, Lex orienteering (V2A-ux)`

***

## COMMIT 6 — Credibility points system

### File: `lib/points.ts`

Implement the full points schedule. The key pattern is: before awarding, check the cap by counting existing PointsLedger entries for this user and actionType.

**Points schedule — implement exactly these values:**

```typescript
export const POINTS_SCHEDULE = {
  IDEA_STARTED:              { points: 10, category: 'STRATEGIST', cap: { type: 'idea_count', max: 5 } },
  STAGE_2_ADVANCE:           { points: 10, category: 'STRATEGIST', cap: { type: 'idea_count', max: 5 } },
  DIAGNOSIS_COMPLETE:        { points: 12, category: 'STRATEGIST', cap: { type: 'idea_count', max: 3 } },
  GUIDING_POLICY_COMPLETE:   { points: 12, category: 'STRATEGIST', cap: { type: 'idea_count', max: 3 } },
  FIRST_COHERENT_ACTION:     { points: 12, category: 'STRATEGIST', cap: { type: 'idea_count', max: 3 } },
  RESEARCH_ADDED:            { points: 3,  category: 'STRATEGIST', cap: { type: 'per_idea', max: 6, ideaMax: 3 } },
  STAGE_3_ADVANCE:           { points: 35, category: 'STRATEGIST', cap: { type: 'idea_count', max: 3 } },
  STAGE_4_ADVANCE:           { points: 75, category: 'STRATEGIST', cap: { type: 'idea_count', max: 3 } },
  STAGE_5_ADVANCE:           { points: 150, category: 'STRATEGIST', cap: { type: 'idea_count', max: 3 } },
  CONTRIBUTION_SUBMITTED:    { points: 4,  category: 'THINKER',    cap: null },
  CONTRIBUTION_RATED_3:      { points: 4,  category: 'THINKER',    cap: null },
  CONTRIBUTION_RATED_4:      { points: 8,  category: 'THINKER',    cap: null },
  CONTRIBUTION_RATED_5:      { points: 12, category: 'THINKER',    cap: null },
  CONTRIBUTION_RATED_1_2:    { points: -4, category: 'THINKER',    cap: null },
  IDEA_RATED:                { points: 2,  category: 'THINKER',    cap: { type: 'once_per_idea' } },
  IDEA_VOTED:                { points: 3,  category: 'STRATEGIST', cap: { type: 'once_per_idea' } },
  AMENDMENT_ACCEPTED:        { points: 100, category: 'THINKER',   cap: null },
  REFERRAL_JOIN:             { points: 10, category: 'RALLYMASTER', cap: null },
  REFERRAL_QUALIFIED:        { points: 75, category: 'RALLYMASTER', cap: null },
} as const;
```

**Core award function:**

```typescript
export async function awardPoints(params: {
  userId: string;
  actionType: keyof typeof POINTS_SCHEDULE;
  relatedIdeaId?: string;
  relatedUserId?: string;
}): Promise<boolean> {
  const schedule = POINTS_SCHEDULE[params.actionType];
  if (!schedule) return false;

  // Check cap
  const cappedOut = await checkCap(params.userId, params.actionType, params.relatedIdeaId);
  if (cappedOut) return false;

  await prisma.pointsLedger.create({
    data: {
      userId: params.userId,
      category: schedule.category,
      pointsDelta: schedule.points,
      actionType: params.actionType,
      reason: params.actionType,
      relatedIdeaId: params.relatedIdeaId ?? null,
      relatedUserId: params.relatedUserId ?? null,
    }
  });

  // Update denormalised Reputation table
  await prisma.reputation.upsert({
    where: { userId: params.userId },
    create: {
      userId: params.userId,
      [`reputationPoints${schedule.category.charAt(0) + schedule.category.slice(1).toLowerCase()}`]: schedule.points,
    },
    update: {
      [`reputationPoints${schedule.category.charAt(0) + schedule.category.slice(1).toLowerCase()}`]: { increment: schedule.points },
    }
  });

  return true;
}
```

**Cap checking function:**

```typescript
async function checkCap(userId: string, actionType: string, relatedIdeaId?: string): Promise<boolean> {
  const schedule = POINTS_SCHEDULE[actionType as keyof typeof POINTS_SCHEDULE];
  if (!schedule?.cap) return false;

  const cap = schedule.cap;

  if (cap.type === 'once_per_idea') {
    if (!relatedIdeaId) return false;
    const existing = await prisma.pointsLedger.count({
      where: { userId, actionType, relatedIdeaId }
    });
    return existing > 0;
  }

  if (cap.type === 'idea_count') {
    // Count distinct ideas for which this action was awarded
    const existingIdeas = await prisma.pointsLedger.findMany({
      where: { userId, actionType },
      select: { relatedIdeaId: true },
      distinct: ['relatedIdeaId'],
    });
    // If this is a new idea, check if we've already hit the max distinct ideas
    const alreadyAwardedForThisIdea = existingIdeas.some(e => e.relatedIdeaId === relatedIdeaId);
    if (alreadyAwardedForThisIdea) return true; // already awarded for this idea
    return existingIdeas.length >= cap.max; // new idea but cap reached
  }

  if (cap.type === 'per_idea') {
    // RESEARCH_ADDED: max 6 per idea, max 3 distinct ideas
    if (!relatedIdeaId) return false;
    const perIdeaCount = await prisma.pointsLedger.count({
      where: { userId, actionType, relatedIdeaId }
    });
    if (perIdeaCount >= cap.max) return true;
    const distinctIdeas = await prisma.pointsLedger.findMany({
      where: { userId, actionType },
      select: { relatedIdeaId: true },
      distinct: ['relatedIdeaId'],
    });
    const alreadyAwardedForThisIdea = distinctIdeas.some(e => e.relatedIdeaId === relatedIdeaId);
    if (!alreadyAwardedForThisIdea && distinctIdeas.length >= (cap as { ideaMax: number }).ideaMax) return true;
    return false;
  }

  return false;
}
```

**Wire up call sites:**

-   `lib/stage-gates.ts` — call `awardPoints({ userId, actionType: 'STAGE_X_ADVANCE', relatedIdeaId })` in each stage advance function
-   `app/api/ideas/[id]/route.ts` (PATCH) — call `awardPoints` for IDEA_STARTED when stage first created, DIAGNOSIS_COMPLETE / GUIDING_POLICY_COMPLETE / FIRST_COHERENT_ACTION when respective fields become non-empty for first time
-   `app/api/ideas/[id]/contributions/route.ts` — call `awardPoints` for CONTRIBUTION_SUBMITTED
-   `app/api/ideas/[id]/contributions/[commentId]/rate/route.ts` — call `awardPoints` for CONTRIBUTION_RATED_X based on avg rating
-   `app/api/ideas/[id]/votes/route.ts` — call `awardPoints` for IDEA_VOTED

**Also confirm:** Check whether `lib/points.ts` already has the Teambuilder cascade and referral qualification logic from earlier sprints. If not, add:

```typescript
// Teambuilder cascade — call after any Strategist or Thinker award
export async function cascadeTeambuilderPoints(earnerUserId: string, pointsEarned: number): Promise<void> {
  const earner = await prisma.user.findUnique({ where: { id: earnerUserId }, select: { referredByUserId: true } });
  if (!earner?.referredByUserId) return;

  // Level 1: direct referrer gets 30%
  const level1Points = Math.floor(pointsEarned * 0.3);
  if (level1Points > 0) {
    await awardPointsDirect({ userId: earner.referredByUserId, category: 'TEAMBUILDER', points: level1Points, reason: 'TEAMBUILDER_CASCADE', relatedUserId: earnerUserId });
  }

  // Level 2: referrer's referrer gets 10%
  const referrer = await prisma.user.findUnique({ where: { id: earner.referredByUserId }, select: { referredByUserId: true } });
  if (!referrer?.referredByUserId) return;
  const level2Points = Math.floor(pointsEarned * 0.1);
  if (level2Points > 0) {
    await awardPointsDirect({ userId: referrer.referredByUserId, category: 'TEAMBUILDER', points: level2Points, reason: 'TEAMBUILDER_CASCADE', relatedUserId: earnerUserId });
  }
}
```

Run `tsc --noEmit` after wiring.

Commit message: `feat: points system — full schedule with caps, Teambuilder cascade, wire-up to stage gates and contribution routes (V2A-points)`

***

## COMMIT 7 — "What Next?" static panel

### New file: `components/WhatNextPanel.tsx`

The panel is not a modal overlay — it renders as an expandable inline panel, similar to the current "Requirements to Take Public" box. It receives the idea's stage and field completion state as props.

```typescript
interface WhatNextPanelProps {
  idea: {
    stage: string;
    diagnosis: { diagnosisTitle?: string | null; diagnosisDescription?: string | null } | null;
    guidingPolicy: { guidingPolicyTitle?: string | null } | null;
    coherentActions: { id: string }[];
  };
  isOpen: boolean;
  onClose: () => void;
}
```

**Panel sections:**

**Section 1 — Progress bar**

Four segments: "Build your idea" (Stages 1–2), "Public scrutiny" (Stage 3), "Build support" (Stage 4), "Parliament" (Stage 5).

-   Current segment: wider, with a fill bar showing approximate completion (0–100% based on field completion)
-   Other segments: narrow inactive blocks with text label only
-   Use Tailwind width classes and a simple div-based bar — no chart library needed

Field completion percentage calculation:

-   Stage 1–2: count filled fields out of (diagnosisTitle, diagnosisDescription, obstacleDefined, whoAffected, howAffected, guidingPolicyTitle, guidingPolicyDescription, coherentActions.length \> 0, rootCauses.length \> 0) → percentage
-   Stage 3: based on research count and review count
-   Stage 4+: endorsement progress

**Section 2 — Overview of your journey** (collapsible, label: "What does this journey involve?")

Static text per stage. At Stage 1–2 show:

>   "You are currently building your idea to the point where it is robust enough for public scrutiny. This requires three main elements:

>   **1. The Diagnosis** — getting complete clarity on the challenge and its causes. Until this is clear, it is hard to form an effective policy. You can't solve a problem if you don't know what's causing it, and if you identify the wrong causes you'll get the wrong solution.

>   **2. The Guiding Policy** — stating in broad terms what approach will overcome the challenge. You need a guiding policy because you need a set of principles and goals to judge your specific actions against. Without these, you won't know whether your actions will actually solve the problem.

>   **3. Coherent Actions** — the specific changes you want to make, such as legislation changes or organisational reforms. These should be made as robust as possible with research, evidence, and honest analysis of costs and opposition."

**Section 3 — Where you are now** (template-based, always visible)

Generate from idea's completion state. Examples:

-   If Diagnosis is empty: "Start with your Diagnosis — click Edit to describe the challenge you want to address and work with Lex to identify its root causes."
-   If Diagnosis is done but Guiding Policy empty: "Your Diagnosis is complete. The next step is your Guiding Policy — the broad approach that will address the root causes you've identified."
-   If both done but no Coherent Actions: "Your Diagnosis and Guiding Policy are in place. Now you need to define your Coherent Actions — the specific changes you want to make."
-   If all three done: "Your Strategic Kernel is taking shape. Keep refining and adding research evidence to strengthen your idea before taking it public."

**Section 4 — Ways to improve** (collapsible, Stage 2+)

Static per-stage tips. At Stage 2:

>   "You can now invite collaborators to help you. Click the **Team** tab and invite friends, colleagues, or subject experts. Each of them will have access to Lex to help build your evidence base. You can restrict their roles — Editor can contribute text, Viewer can read only."

Style: grey box (`bg-gray-50 border border-gray-200`), same treatment as the Requirements box it replaces in position. Rounded corners, inner padding.

### Wire into `IdeaDetailClient.tsx`

1.  Import `WhatNextPanel`
2.  Add `const [whatNextOpen, setWhatNextOpen] = useState(false)` state
3.  On mount, check for `?whatnext=true` query param — if present, set `whatNextOpen(true)`
4.  Pass `isOpen` and `onClose` to `WhatNextPanel`
5.  Render `WhatNextPanel` below the "Edit" and "What Next?" buttons

Commit message: `feat: What Next panel — progress bar, journey overview, template status, team tips (V2A-whatnext)`

***

## COMMIT 8 — Docs update

### 8a. Update `scrutinise-docs/system_mechanics_v0.7.md` → `v0.8`

Add the following as **Section 21 — Referral Mechanics, Points, and Credibility: End-to-End** at the end of the file, before the closing line. Also update the points schedule in Section 3 to match the V2A values.

Update header: `# SCRUTINISE — SYSTEM MECHANICS v0.8` and `Last updated: 13 April 2026`.

***

**New section to add:**

***

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

The ReferralEvent and PointsLedger entities exist in the schema. V2A implements the full points award function with cap checking, Teambuilder cascade, and referral qualification logic in `lib/points.ts`. Check `lib/points.ts` and confirm all five award functions are wired to their call sites.

***

### 8b. Update `CHANGE_LOG.md`

Add one entry per commit in this sprint.

### 8c. Update `handoff_summary.md`

Add a Sprint V2-A section at the top of the current state block. Include:

-   All 8 commits listed with one-line descriptions
-   Schema additions confirmed (4 new fields on GuidingPolicy, 5 on CoherentAction, 2 on ResourcesCommitted, TargetOrganisationType enum)
-   `npx prisma db push` completed
-   Points system wired to stage gates and contribution routes
-   Field labels in `lib/field-labels.ts`
-   Next: Sprint V2-B (Legislation DB) — pending R2 bucket creation and 20 test sections from Charlie

### 8d. Rename entity list reference

The working entity list is now `entity_list_v5.md`. Charlie is providing this file. Update any references in CLAUDE.md or README from `entity_list_v4.md` to `entity_list_v5.md`.

Commit message: `docs: system_mechanics v0.8, entity list ref update, CHANGE_LOG, handoff (V2A-docs)`

***

## AFTER ALL COMMITS

```bash
tsc --noEmit        # must be zero errors
git status          # confirm nothing uncommitted
git push origin Main
```

***

## DEFERRED — DO NOT BUILD

-   Vanity referral URLs (`scrutinise.org/[userNumber]`) — V3 backlog
-   Sprint V2-B (Legislation DB) — awaiting R2 bucket creation and 20 test sections from Charlie
-   Sprint V2-C (Regulatory Costing) — Sprints 10–11, after legislation DB

***

## V3 BACKLOG (accumulating, do not build)

-   Vanity referral URLs (`scrutinise.org/[userNumber]`)

***

*CC Brief — Sprint V2-A — 13 April 2026 — Prepared by CCh* *Read CLAUDE.md and handoff_summary.md before starting.*
