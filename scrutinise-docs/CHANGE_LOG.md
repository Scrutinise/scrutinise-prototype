# SCRUTINISE — CHANGE LOG
*Pending and applied changes to all spec documents.*
*PENDING section: cleared after each batch application.*
*APPLIED section: permanent audit trail, never deleted.*
*Last updated: 23 April 2026*

---

## CODE CHANGES — 23 April 2026 Sprint V2-K

### V2K-D2: Lex onboarding flow + userProfiling step
| File | Change |
|------|--------|
| `scrutinise-web/app/ideas/create/CreateIdeaClient.tsx` | Added `onboardingState` ('pending'→'done') and `skipUserProfilingRef`. Two onboarding choice handlers: `handleOnboardingKnow` (sets done, marks skip flag) and `handleOnboardingTellMore` (sets done). Two teal pill buttons rendered below first Lex message when `i === 0 && onboardingState === 'pending' && !msg.isStreaming`. `handleCurrentProposalAccept`: injects "Congratulations — Stage 1 complete" Lex message when `fieldKey === 'ideaType'`. Uses `effectiveNextIdx` to skip `userProfiling` when `skipUserProfilingRef.current` is true. |
| `scrutinise-web/lib/field-labels.ts` | Added `userProfiling` step to `FIELD_SEQUENCE` between `title` (index 0) and `summaryDescription` (index 2). |
| `scrutinise-web/app/api/ai/[ideaId]/route.ts` | Added `userProfilingInstruction` constant. `fieldInstruction` condition now excludes `userProfiling`. System prompt appends `userProfilingInstruction` after `fieldInstruction`. `applyFieldUpdatesAndSave`: extracts `parsedJson.userAdditionalNotes`, persists to DB, adds `userAdditionalNotes` to `DIRECT_IDEA_FIELDS`. Returns `userAdditionalNotes` in done event. |
| `scrutinise-web/app/api/ideas/[id]/route.ts` | Added `userAdditionalNotes: z.string().optional()` to `PatchIdeaSchema`. |

**Deploy actions needed:** `npx prisma db push` + `npx prisma generate` (for `userAdditionalNotes String?` on `Idea`).

---

### V2K-D1: `userAdditionalNotes` schema field
| File | Change |
|------|--------|
| `scrutinise-web/prisma/schema.prisma` | Added `userAdditionalNotes String?` to `Idea` model. |

**Deploy actions needed:** `npx prisma db push` ✅ `npx prisma generate` ✅

---

### V2K-C2: Homepage Section 2 text tweaks
| File | Change |
|------|--------|
| `scrutinise-web/app/page.tsx` | Vision paragraph: "Empower anyone" → "Empower you"; removed "We call it: 'Active Democracy'." Third box: removed "and MPs to promote it" from influencers sentence. |

**Deploy actions needed:** None.

---

### V2K-C1: Homepage — Vision/Tool section + layout reorder
| File | Change |
|------|--------|
| `scrutinise-web/app/page.tsx` | Added new Section 2 "Vision and Tool" (dark `bg-[#0a0a0f]`, large bold headline, two labelled paragraphs, three dark info boxes). Moved "If you're serious" from Section 3 to Section 8 (bottom). Changed "into" → "to help build" in middle box. |

**Deploy actions needed:** None.

---

### V2K-B1: Legislation compare — Llama model fix + single-line TNA cleaning
| File | Change |
|------|--------|
| `scrutinise-web/app/legislation-compare/LegislationCompareClient.tsx` | Fixed Llama model ID to `meta-llama/Llama-3.3-70B-Instruct-Turbo`, label `'Llama 3.3 70B'`. System prompt changed to verbatim-accuracy prompt. `cleanTnaText()` improved: single-line path now tries subsection marker regex `(\d+[A-Z]?\s+[A-Z][a-z][^\n]{0,60}\n?\s*\(\d+\))` before falling back to `sectionNumber` last-occurrence scan. Both call sites pass `s.section`. |

**Deploy actions needed:** None.

---

### V2K-A4: Legislation search route + LegislationPanel TNA/lexSummary
| File | Change |
|------|--------|
| `scrutinise-web/app/api/ideas/[id]/legislation-search/route.ts` | Added `tnaCompiledText`, `lexSummary` to SELECT. FTS tsvector updated to `COALESCE(tnaCompiledText, compiledText)`. |
| `scrutinise-web/components/LegislationPanel.tsx` | `LegislationResult` interface gets `tnaCompiledText?` and `lexSummary?`. TNA verified badge (teal) shown when `tnaCompiledText` present. Plain English / statutory text toggle shown when `lexSummary` present. `statutoryText = tnaCompiledText ?? compiledText`. |

**Deploy actions needed:** None (schema fields added in A1).

---

### V2K-A3: Verbatim-first compile script
| File | Change |
|------|--------|
| `scripts/legislation/compile.ts` | Rewritten. `VERBATIM_SYSTEM_PROMPT` (legal editor prompt). `SUMMARY_SYSTEM_PROMPT` (plain English for Lex). `compileSection()`: if `tnaCompiledText` present, copies to `compiledText`, sets `HIGH` confidence, skips Gemini, generates `lexSummary` via separate Gemini call. Else: calls Gemini with verbatim JSON prompt, generates `lexSummary`. Progress logging: `✓ s.N — TNA (verbatim)` vs `✓ s.N — AI (verbatim attempt)`. |

**Deploy actions needed:** Re-run `cd scrutinise-web && npx ts-node ../scripts/legislation/compile.ts` to compile any sections with `tnaCompiledText`.

---

### V2K-A2: Ingest script — fetch TNA compiled text per section
| File | Change |
|------|--------|
| `scripts/legislation/ingest.ts` | Added `cleanTnaCompiledText(raw, sectionNumber)`: multi-line path (find content start, strip footnotes) and single-line path (subsection marker regex, then sectionNumber fallback). Added `fetchTnaCompiledText(legislationGovUkId, sectionNumber)`: fetches `https://www.legislation.gov.uk/{id}/section/{num}`, 404-safe (warning + null). `ingestAct()`: after each section upsert, 1000ms delay then fetch + store `tnaCompiledText`. |

**Deploy actions needed:** Re-run `cd scrutinise-web && npx ts-node ../scripts/legislation/ingest.ts` to populate `tnaCompiledText` for existing sections.

---

### V2K-A1: `LegislationSection` — `tnaCompiledText` + `lexSummary` fields
| File | Change |
|------|--------|
| `scrutinise-web/prisma/schema.prisma` | Added `tnaCompiledText String?` and `lexSummary String?` to `LegislationSection` model. |

**Deploy actions needed:** `npx prisma db push` ✅ `npx prisma generate` ✅

---

## CODE CHANGES — 22 April 2026 Sprint V2-J

### V2J-D1: Llama 4 Maverick model ID fix + TNA cleaning improvement
| File | Change |
|------|--------|
| `scrutinise-web/app/legislation-compare/LegislationCompareClient.tsx` | Fixed Llama 4 Maverick model ID from `Llama-4-Maverick-17B-128E-Instruct-FP8` to `Llama-4-Maverick-17B-128E-Instruct-Turbo` (FP8 requires a dedicated endpoint). Extended `cleanTnaText()` with single-line fallback: when no newline-based start found, tries regex `\s(\d+[A-Z]?\s+[A-Z][a-z])` on full raw string and slices from there. |

**Deploy actions needed:** None.

---

### V2J-C1: Inject legislation context into Lex system prompt
| File | Change |
|------|--------|
| `scrutinise-web/app/api/ai/[ideaId]/route.ts` | `MessageSchema` extended with optional `legislationContext` array (actTitle, sectionNumber, sectionTitle, compiledText). `buildSystemPrompt` ctx type extended with same. When `legislationContext` provided, appends `RELEVANT LEGISLATION FOUND` block to `fieldInstruction` with per-section text (first 800 chars). Includes scripted language guidance for Moments 1/2 vs Moment 3 (Coherent Actions). POST handler destructures and passes `legislationContext` to `buildSystemPrompt`. |
| `scrutinise-web/app/ideas/create/CreateIdeaClient.tsx` | `handleSend` now includes `legislationContext` in request body (top 2 results, mapped to actTitle/sectionNumber/sectionTitle/compiledText) when `legislationResults.length > 0`. |

**Deploy actions needed:** None.

---

### V2J-B2: LegislationPanel slide-out component
| File | Change |
|------|--------|
| `scrutinise-web/components/LegislationPanel.tsx` | New component. Slide-over panel (fixed right, full-height, max-w-md, z-50). Backdrop overlay. Header with close button. Amber disclaimer banner linking to legislation.gov.uk. Per-result cards: act title + section number + year, teal section title, scrollable monospace compiled text (max-h-200px), legislation.gov.uk link, change type selector (Amend/Repeal/Add), proposed wording textarea, "Attach to this action" button (only visible when `currentCoherentActionId` set). Calls POST `/api/ideas/[id]/legislation-link`. Shows saved state. Empty state message. |
| `scrutinise-web/app/ideas/create/CreateIdeaClient.tsx` | Imported `LegislationPanel`. Added `coherentActionIds: string[]` state populated from `ideaData.coherentActions[*].id` in `populateFieldValuesFromIdea`. Derived `currentCoherentActionId = coherentActionIds[caLoopCount]` when in `coherentActions` section. Added legislation toggle button to toolbar (desktop: hidden lg:inline-flex, teal; mobile: alongside "See completed answers"). Rendered `<LegislationPanel>` as slide-over before `<SiteFooter>`. |

**Deploy actions needed:** None.

---

### V2J-B1: Three-moment legislation search in CreateIdeaClient
| File | Change |
|------|--------|
| `scrutinise-web/app/ideas/create/CreateIdeaClient.tsx` | Added `LegislationResult` interface. Added state: `legislationResults`, `showLegislationPanel`, `legislationLoading`. Added `searchLegislation(query)` function (POST to `/api/ideas/[id]/legislation-search`, sets results + opens panel). Added three trigger moments in `handleCurrentProposalAccept` after `handleSend`: (1) `summaryDescription` accepted → search `title + value`; (2) `diagnosis.whyPersisted` accepted → search `value`; (3) `coherentAction.title` accepted → search `value`. |

**Deploy actions needed:** None.

---

### V2J-A1: Legislation search API, CoherentActionSection schema, legislation-link route
| File | Change |
|------|--------|
| `scrutinise-web/prisma/schema.prisma` | Added `CoherentActionSection` model (cuid id, coherentActionId, legislationSectionId, proposedWording?, changeType default AMEND, timestamps). Added `legislationSections CoherentActionSection[]` to `CoherentAction`. Added `coherentActionLinks CoherentActionSection[]` to `LegislationSection`. |
| `scrutinise-web/app/api/ideas/[id]/legislation-search/route.ts` | New POST route. Auth required. Zod body: `{ query, limit? }`. Runs PostgreSQL FTS query via `prisma.$queryRaw` — joins LegislationSection + LegislationItem, filters `compilationStatus = COMPILED` and `compiledText IS NOT NULL`, ranks by `ts_rank` DESC and `amendmentCount` ASC. Returns `{ results: [...] }`. |
| `scrutinise-web/app/api/ideas/[id]/legislation-link/route.ts` | New POST + DELETE route. POST: auth + idea ownership check, upsert CoherentActionSection (findFirst + update/create). DELETE: auth + ownership check, delete by id. |

**Deploy actions needed:** `npx prisma db push` ✅ `npx prisma generate` ✅

---

## CODE CHANGES — 22 April 2026 Sprint V2-I (continued)

### V2I-A3: Server-side proxy for Together AI (CORS fix)
| File | Change |
|------|--------|
| `scrutinise-web/app/api/legislation/together-proxy/route.ts` | New POST route. Reads `{ model, messages, apiKey }` from request body, forwards to `https://api.together.xyz/v1/chat/completions` with `Authorization: Bearer {apiKey}`, returns response JSON. Proxies the request server-side to avoid browser CORS block. |
| `scrutinise-web/app/legislation-compare/LegislationCompareClient.tsx` | `together` caller updated to POST to `/api/legislation/together-proxy` instead of calling Together AI directly. `apiKey` included in body rather than Authorization header. |

**Deploy actions needed:** None.

---

### V2I-A2: Clean TNA gold standard text before Jaccard scoring
| File | Change |
|------|--------|
| `scrutinise-web/app/legislation-compare/LegislationCompareClient.tsx` | Added `cleanTnaText()` function that strips metadata preamble (seeks first line matching operative statutory text: section number + capital, "Part N", "Chapter N", or `**N`) and amendment footnotes from the end (strips trailing lines starting "Words in s.", "S. N", "Substituted", "Inserted", "Omitted", "Repealed", "Modified"). Applied to gold text before Jaccard comparison in both success and error paths. TNA Gold Standard display heading shows `(cleaned)` label in grey. |

**Deploy actions needed:** None.

---

## CODE CHANGES — 21 April 2026 Sprint V2-I

### V2I-A1: Llama 4 Maverick (Together AI) on legislation-compare
| File | Change |
|------|--------|
| `scrutinise-web/app/legislation-compare/LegislationCompareClient.tsx` | Added `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8` to `MODELS` array (provider: `together`). Added `together` caller in `PROMPTS` — OpenAI-compatible format, endpoint `https://api.together.xyz/v1/chat/completions`. Added `together: ''` to `apiKeys` state. Added Together AI API key input to API keys section (placeholder `key_...`). Errors shown as "Error" in results like other models. Client-side only — no server changes. |

**Deploy actions needed:** None.

---

## CODE CHANGES — 17 April 2026 Sprint V2-H

### V2H-A1: FIELD_SEQUENCE in field-labels.ts
| File | Change |
|------|--------|
| `lib/field-labels.ts` | Added `FieldStep` interface and `FIELD_SEQUENCE` array (57 steps: 4 Initial Information, 8 Diagnosis + summary, 9 Guiding Policy + summary, 10 Coherent Action loop + summary). `isLexGenerated` flag for 3 summary steps. `isLoop` flag for 9 CA fields. Canonical ordered sequence — frontend walks it one step at a time. |

**Deploy actions needed:** None.

---

### V2H-A2: currentFieldIndex state machine — platform controls field sequence
| File | Change |
|------|--------|
| `app/ideas/create/CreateIdeaClient.tsx` | Added `currentFieldIndex`, `caLoopCount`, `addAnotherCAPrompt` states. Added `currentFieldIndexRef` for stale-closure-safe access in handleSend. `populateFieldValuesFromIdea` computes first unfilled field on load (resume from where user left off). Every API call now includes `currentFieldKey`, `currentFieldLabel`, `currentFieldSection`. `handleCurrentProposalAccept` advances `currentFieldIndex`, triggers CA loop "Add another?" prompt at last isLoop step, auto-sends generation trigger for isLexGenerated steps. `handleAddAnotherCA` handles Yes/No response to CA loop. `handleSkipField` advances without writing a value. Skip button added to input area. Old `prev === null ? fp : prev` gate removed — platform controls sequence now. |

**Deploy actions needed:** None.

---

### V2H-B1: Dynamic single-field instruction to Lex
| File | Change |
|------|--------|
| `app/api/ai/[ideaId]/route.ts` | `MessageSchema` extended with `currentFieldKey`, `currentFieldLabel`, `currentFieldSection` (all nullable optional). `buildSystemPrompt` accepts and uses these fields to generate dynamic `fieldInstruction`. `fieldInstruction` injected after `${stageSection}` in system prompt. Removed old FIELD CONVERSATION PROTOCOL block (FIELD SEQUENCE, SECTION GATE RULE, EVIDENCE NUDGING, MECHANISM TYPE, 5-step protocol, ONE FIELD AT A TIME rule, FIELD ACCEPTANCE rule, Valid fieldUpdates keys list) from Stage 1 section. SCOPE BOUNDARIES added to `fieldInstruction` (no team names, sharing, voting in Lex chat). |

**Deploy actions needed:** None.

---

### V2H-C1: Five mobile UX fixes
| File | Change |
|------|--------|
| `app/ideas/create/CreateIdeaClient.tsx` | Fix 1 (viewport clip): added `max-w-full overflow-x-hidden` to chat panel and `max-w-full` to input box. Fix 2 (scroll): chat now scrolls to TOP of latest Lex message (`data-role="assistant"` added to Lex bubbles, `scrollIntoView({block: 'start'})` used). Fix 3/5 (Initial Information): always expanded when has content; chevron shows collapse state; collapses via `initialInformation_collapsed` toggle key. Fix 4 (team name scope): SCOPE BOUNDARIES added to system prompt via `fieldInstruction` (covers both field-active and field-complete states). |

**Deploy actions needed:** None.

---

### V2H-D1: RootCause multiple causes with depth and parent-child chain
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `causeDepth Int @default(0)`, `orderIndex Int @default(0)`, `parentId String?` to `RootCause`. Added self-referential `parent`/`children` relations via `"CauseChain"`. Added `@@index([parentId])`. `prisma db push` ✅ (additive only — no data loss). `prisma generate` ✅. |

**Deploy actions needed:** `npx prisma db push` + `npx prisma generate` (already applied locally).

---

## CODE CHANGES — 17 April 2026 Sprint V2-G

### V2G-A1: MechanismType enum + schema refactor
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `MechanismType` enum (INCENTIVES, RULES, TRANSPARENCY, MARKET_DESIGN, INSTITUTIONAL_RESTRUCTURING). Removed 5 deprecated `mechanism*` String? fields from `GuidingPolicy`, replaced with `mechanismTypes MechanismType[]`. Added `mechanismType MechanismType?` to `CoherentAction`. `prisma db push --accept-data-loss` applied (test data only in DB). `prisma generate` run. |

**Deploy actions needed:** None (db push already applied).

---

### V2G-B1: field-labels.ts restructure — numbered fields, Initial Information, DEPRECATED_FIELDS
| File | Change |
|------|--------|
| `lib/field-labels.ts` | Restructured `SIDEBAR_SECTIONS` from flat array to nested `{ key, heading, fields[] }` structure. Added `initialInformation` section (fields 1–4). Added field numbers (1–27) to all labels. Replaced 5 mechanism field entries with single `mechanismTypes` (field 14). Added `mechanismType` (field 20a) to coherent actions section. Removed `summaryDiagnosis`, `summaryGuidingPolicy`, `summaryCoherentActions`, `proposedWording`, `whoAffected` from sections (Lex-generated, not user-filled). Added `DEPRECATED_FIELDS` export (infrastructure only — not wired to UI). |

**Deploy actions needed:** None.

---

### V2G-C1: Lex system prompt — field sequence, section gates, evidence nudging, mechanism type
| File | Change |
|------|--------|
| `app/api/ai/[ideaId]/route.ts` | Updated FIELD CONVERSATION PROTOCOL: added explicit numbered field sequence (1–27) with section gate rule. Added EVIDENCE NUDGING instruction (once per section for factual assertions). Added MECHANISM TYPE FOR COHERENT ACTIONS instruction (ask after each CA title). Updated fieldUpdates key list to include `mechanismTypes` and `mechanismType`, remove deprecated mechanism fields. Updated field label references to use numbered format. Updated Stage 2 field targets. Added `mechanismType` persistence to most recent CoherentAction in `applyFieldUpdatesAndSave`. |

**Deploy actions needed:** None.

---

### V2G-D1: Mobile answers panel — Initial Information section
| File | Change |
|------|--------|
| `app/ideas/create/CreateIdeaClient.tsx` | Added `summaryDescription`, `govtArea`, `ideaType` to `FieldCompletion` interface and `EMPTY_FIELDS`. Added govtArea and ideaType to `populateFieldValuesFromIdea`. Updated mechanism field handling in `populateFieldValuesFromIdea` to use `mechanismTypes` array. Added `initialInformation` section to `MobileSidebarContent`. |
| `app/api/ai/[ideaId]/route.ts` | Added `summaryDescription`, `govtArea`, `ideaType` to completedFields select and response. |
| `app/api/ideas/[id]/field-approval/route.ts` | Updated to remove deprecated mechanism field refs; added `mechanismType` CoherentAction handler; added `guidingPolicy.mechanismTypes` array handler; added `summaryDescription`, `govtArea`, `ideaType` to completedFields. |
| `app/api/ideas/[id]/guiding-policy/route.ts` | Replaced 5 mechanism String? fields in Zod schema with `mechanismTypes` enum array. Added new Rumelt fields (`linkToDiagnosis`, `whatThisPolicyRulesOut`, `whyThisApproachNotOthers`, `conditionsForSuccess`). |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Replaced `GuidingPolicyRecord` interface (5 mechanism fields → `mechanismTypes: string[] | null`). Updated `updateGuidingPolicyField` default object. Replaced 5 `FieldDisplay` mechanism components with single `mechanismTypes` display. |

**Deploy actions needed:** None (db push already applied).

---

## CODE CHANGES — 16 April 2026 Sprint V2-F

### V2F-A1: Fix fieldUpdates not persisting to DB
| File | Change |
|------|--------|
| `app/api/ai/[ideaId]/route.ts` | Added DB write inside `applyFieldUpdatesAndSave`: when `fieldUpdates` contains keys matching direct Idea fields (`title`, `summaryDiagnosis`, `summaryGuidingPolicy`, `summaryCoherentActions`, `govtArea`, `ideaType`, `whoAffected`, etc.), writes them to DB via `prisma.idea.update`. Root cause: `fieldUpdates` was parsed and returned in `pendingProposals` but never persisted; `hasFieldUpdates: true` triggered a DB re-fetch which returned stale data, overwriting the client's optimistic state. |

**Deploy actions needed:** None (Vercel auto-deploy on push).

---

### V2F-A2: Strengthen FIELD ACCEPTANCE in Lex system prompt
| File | Change |
|------|--------|
| `app/api/ai/[ideaId]/route.ts` | Rewrote the FIELD ACCEPTANCE rule in `buildSystemPrompt` to be explicit that `fieldUpdates` is mandatory on "Accepted:" messages, includes example JSON, and makes clear this is a machine-generated signal not user text. |

**Deploy actions needed:** None.

---

### V2F-B1: Mobile UI — remove label, full-width black action buttons
| File | Change |
|------|--------|
| `app/ideas/create/CreateIdeaClient.tsx` | (1) Removed "Developing with Lex" label from toolbar; changed `justify-between` to `justify-end`. (2) Removed teal `See completed answers →` button from inside toolbar button row; added full-width black button (`bg-foreground text-background`) below toolbar (`lg:hidden`). (3) Removed teal `← Back to chat` button from panel h2 header row (kept "Your Idea" heading); added full-width black `← Back to chat` button below the header. |

**Deploy actions needed:** None.

---

## CODE CHANGES — 16 April 2026 Sprint V2-E

### V2E-A1: Mobile sidebar field display fix
| File | Change |
|------|--------|
| `app/ideas/create/CreateIdeaClient.tsx` | Removed V2D debug console.logs and yellow debug block. Removed temporary "Back to Chat" button from `MobileSidebarContent`. Added `useEffect` that auto-expands sections with content so filled fields are always visible when mobile panel opens. Fixed `renderFieldCard` to use direct key lookup (no broken regex fallback). |
| `app/api/ai/[ideaId]/route.ts` | Removed V2D debug console.logs. |

**Deploy actions needed:** None.

---

### V2E-A2: "See completed answers →" button in mobile chat toolbar
| File | Change |
|------|--------|
| `app/ideas/create/CreateIdeaClient.tsx` | Added `See completed answers →` button to Lex toolbar (`lg:hidden`). Updated "← Back to chat" button in mobile panel header to teal styling. Both buttons use `text-teal-600 hover:text-teal-700`. |

**Deploy actions needed:** None.

---

### V2E-A3: Auto-flip to answers on acceptance + field whoosh animation
| File | Change |
|------|--------|
| `app/ideas/create/CreateIdeaClient.tsx` | Added `lastAcceptedField` state. In `handleCurrentProposalAccept`, on mobile (< 1024px): sets `mobilePanelOpen(true)` and `lastAcceptedField(normKey)`. Added `lastAcceptedField` + `setLastAcceptedField` props to `MobileSidebarContent`. In `renderFieldCard`, applies `field-whoosh` class when key matches `lastAcceptedField`. Added `useEffect` to clear `lastAcceptedField` after 800ms. |
| `app/globals.css` | Added `fieldWhoosh` keyframe (slide from right, teal peak, fade) and `.field-whoosh` utility class (800ms). |

**Deploy actions needed:** None.

---

### V2E-A4: Gate Lex to one field proposal at a time
| File | Change |
|------|--------|
| `app/api/ai/[ideaId]/route.ts` | Added CRITICAL RULE — ONE FIELD AT A TIME to the FIELD CONVERSATION PROTOCOL in the system prompt. |
| `app/ideas/create/CreateIdeaClient.tsx` | In done event handler, `setCurrentProposal` now uses functional update: `prev => prev === null ? fp : prev` — only sets a new proposal if no proposal is currently showing. |

**Deploy actions needed:** None.

---

### V2E-B1: Legislation schema — FTS fields, tags, jurisdiction, crossref
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `tags String[]`, `amendmentCount Int`, `complexityScore Int`, `inForce Boolean`, `jurisdiction String`, `policyArea String?` to `LegislationSection`. Added `subjectArea String?`, `policyArea String?`, `crossRefsOut`, `crossRefsIn` to `LegislationItem`. Added `LegislationCrossRef` model. |

**Deploy actions needed:** `npx prisma db push` ✅ `npx prisma generate` ✅

---

### V2E-B2: PostgreSQL GIN FTS index + ingest/compile script updates
| File | Change |
|------|--------|
| `prisma/migrations/20260416120000_legislation_fts_index/migration.sql` | Raw SQL migration: GIN index on `LegislationSection` for FTS (compiledText + sectionTitle + policyArea), GIN index on tags array, btree index on jurisdiction + inForce. Apply via psql when ingestion is ready. Column casing note in file header. |
| `scripts/legislation/compile.ts` | Extended Gemini prompt to return `tags` array. After compilation, writes `tags`, `amendmentCount` (count of amendment records), `complexityScore` (`ceil(amendmentCount/3)` capped at 5) to `LegislationSection`. |
| `scripts/legislation/ingest.ts` | Refactored to fetch CLML once per act. Added `extractClmlMetadata()` to parse `dc:coverage`, `ukm:Subject`, `dc:subject` elements. Writes `jurisdiction`, `subjectArea`, `policyArea` to `LegislationItem` on create and update. |

**Deploy actions needed:** Apply `migration.sql` via psql when running ingestion (not before). Casing of column names should be verified with `\d "LegislationSection"` first.

---

## CODE CHANGES — 15 April 2026 Sprint V2-D

### V2D-fix-params: Async params verified clean (V2C-fix already applied)
| File | Change |
|------|--------|
| `app/api/legislation/[itemId]/route.ts` | Confirmed `params: Promise<{itemId: string}>` and `await params` — applied in V2C-fix. No further changes needed. |
| `app/legislation/[itemId]/page.tsx` | Same — already correct. No other dynamic routes required fixing. |

**Deploy actions needed:** None.

---

### V2D-proposal-card-desktop: Teal proposal card on desktop + swipe gesture threshold
| File | Change |
|------|--------|
| `components/FieldProposalCard.tsx` | Rewrote swipe detection: `absDx > 50 && absDx > absDy * 2.5` ratio (was just `absDx > absDy`). Edit button now calls `onEdit(proposedValue)` to copy text to chat input (card goes to `discussed`), replacing in-card textarea editing. Updated visual to teal border design per brief. Added `proposal-pulse-animation` class on Accept. Removed autoAcceptSeconds countdown complexity. |
| `app/ideas/create/CreateIdeaClient.tsx` | `handleProposalEdit` now marks proposal as `discussed` and copies proposed text to `inputValue` + focuses input. No longer calls `handleProposalAccept`. |

**Deploy actions needed:** None.

---

### V2D-mobile-panel: Mobile sidebar panel — swipe-right navigation
| File | Change |
|------|--------|
| `app/ideas/create/CreateIdeaClient.tsx` | Added `mobilePanelOpen` state. Added `outerTouchStartX/Y` refs and `handleOuterTouchStart/End` (threshold 80px, ratio 2.0). Main area wrapped with touch handlers. Added teal edge indicator button (fixed right, `lg:hidden`). Added full-screen `fixed inset-0 z-40 lg:hidden` panel overlay with slide-in transition. Added `MobileSidebarContent` component: shows all Diagnosis + GuidingPolicy fields with value preview, Edit (copies to input + closes panel) and Chat (sends revisit message + closes panel) buttons per field. |

**Deploy actions needed:** None.

---

### V2D-sidebar-answers: Desktop sidebar — filled answers with open/close toggles
| File | Change |
|------|--------|
| `app/ideas/create/CreateIdeaClient.tsx` | Added `sidebarExpanded`, `openFields` (Set<string>), `fieldValues` (Record<string, string>) states. Desktop sidebar: added expand/collapse button (⊞/⊟), sidebar width transitions between `w-72` and `w-1/2`. Stage 1 sidebar fields now show collapsible value div with `field-accept-animation` when toggled. `Stage2Sidebar` updated with same props + `renderFieldRow` updated to show value when `openFields` contains field key. `handleProposalAccept` stores value in `fieldValues` and adds to `openFields`. Streaming `done` handler auto-opens newly completed fields. |

**Deploy actions needed:** None.

---

### V2D-whoosh-animation: Whoosh animation on field accept
| File | Change |
|------|--------|
| `app/globals.css` | Added `@keyframes fieldAccept` (slide-in from right, 200ms) and `@keyframes proposalPulse` (teal background pulse, 300ms). Added `.field-accept-animation` and `.proposal-pulse-animation` utility classes. |
| `components/FieldProposalCard.tsx` | Accept button triggers `proposal-pulse-animation` via `isPulsing` state on the saved-state card. |
| `app/ideas/create/CreateIdeaClient.tsx` | Field values in sidebar render with `field-accept-animation` class. |

**Deploy actions needed:** None.

---

### V2D-lex-flow: Lex field conversation protocol
| File | Change |
|------|--------|
| `app/api/ai/[ideaId]/route.ts` | Added FIELD CONVERSATION PROTOCOL section to `buildSystemPrompt` (Stage 1 section): 5-step flow (Orientation → Question → Assess → Confirmation → Next field). Added FIELD ACCEPTANCE rule: messages starting with "Accepted: " trigger `fieldUpdates` population and next-field orientation. `applyFieldUpdatesAndSave` now parses `fieldProposal` JSON key (alongside `fieldUpdates`, `insightFlag`) and strips it from `displayText`. Returns `fieldProposal` in done SSE event. |
| `app/ideas/create/CreateIdeaClient.tsx` | Added `currentProposal` state. Streaming `done` handler extracts `fieldProposal` from event and sets `currentProposal`. Renders `FieldProposalCard` above input when `currentProposal` is non-null. `handleCurrentProposalAccept`: optimistically updates `fieldValues` + `openFields`, clears `currentProposal`, sends silent system message `Accepted: [label]` to Lex via `handleSend(false, systemMessage)`. `handleCurrentProposalEdit` / `handleCurrentProposalDiscuss` clear `currentProposal`. `handleSend` updated to accept optional `systemMessageOverride` — when set, message is sent to API without appearing in chat UI. |

**Deploy actions needed:** None.

---

## CODE CHANGES — 15 April 2026 Sprint V2-C

### V2C-admin-nav: Admin nav link visible to ADMIN/SUPER_ADMIN
| File | Change |
|------|--------|
| `app/api/user/role/route.ts` | NEW — `GET /api/user/role` returns `{ role }` from DB for the current Clerk session. |
| `components/PublicNav.tsx` | Added `useEffect` to fetch `/api/user/role` when signed in. `isAdmin` computed from `dbRole`. Admin link rendered in desktop and mobile nav when `isAdmin` is true. Added Legislation link to both nav variants. |

**Deploy actions needed:** None.

---

### V2C-leg-compare: Legislation evaluator at /legislation-compare
| File | Change |
|------|--------|
| `app/api/legislation/fetch/route.ts` | NEW — server-side CORS proxy for legislation.gov.uk CLML XML. Accepts `type`, `year`, `chapter`, `section`, `version` params. Caches 24h. |
| `app/legislation-compare/page.tsx` | NEW — Server Component wrapper with metadata. |
| `app/legislation-compare/LegislationCompareClient.tsx` | NEW — Full interactive evaluator. 20 test sections, 6 models, Jaccard similarity scoring, per-section gold/AI comparison, leaderboard. API keys entered client-side only, never sent to server. |
| `middleware.ts` | Added `/legislation-compare`, `/api/legislation/fetch`, `/legislation`, `/api/legislation/search`, `/api/legislation/(.*)` to public routes. |

**Deploy actions needed:** None. Page is public.

---

### V2C-leg-schema: Legislation DB schema
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added enums: `LegislationTier`, `LegislationType`, `CompilationConfidence`, `CompilationStatus`, `CorrectionStatus`, `CorrectionDecision`. Added models: `LegislationItem`, `LegislationSection`, `LegislationAmendment`, `IdeaLegislation`, `LegislationCorrection`. Added `legislationLinks` relation to `Idea`. Added `legislationCorrections` relation to `User`. Added `@@unique([legislationItemId, sectionNumber])` on `LegislationSection`. |

**Deploy actions needed:** `npx prisma db push` + `npx prisma generate` ✓ done.

---

### V2C-leg-ingest: Legislation ingestion script
| File | Change |
|------|--------|
| `scripts/legislation/ingest.ts` | NEW — Fetches Tier 1 (post-2010 UKPGA) Act list from legislation.gov.uk Atom feed. Parses CLML P1group elements into sections. Upserts `LegislationItem` and `LegislationSection` records. Rate-limited. Run: `cd scrutinise-web && npx ts-node ../scripts/legislation/ingest.ts` |

**Deploy actions needed:** Manual — run after deploy. Start with `slice(0, 5)` to test.

---

### V2C-leg-compile: Legislation compilation script
| File | Change |
|------|--------|
| `scripts/legislation/compile.ts` | NEW — AI batch compiler using Gemini 2.5 Flash. Picks up `PENDING` sections in batches of 50. Applies amendments chronologically. Stores `compiledText`, `confidence`, `unappliedAmendments`. Sections with `LOW` confidence flagged `NEEDS_REVIEW`. Run: `GEMINI_API_KEY=xxx npx ts-node scripts/legislation/compile.ts` |

**Deploy actions needed:** Manual — run after ingestion.

---

### V2C-leg-api: Legislation API routes
| File | Change |
|------|--------|
| `app/api/legislation/search/route.ts` | NEW — `GET /api/legislation/search` — public, filterable by q/type/year/jurisdiction, paginated (20/page). |
| `app/api/legislation/[itemId]/route.ts` | NEW — `GET /api/legislation/[itemId]` — public, returns full item with compiled sections and amendments. |
| `app/api/legislation/link/route.ts` | NEW — `POST /api/legislation/link` — auth required, upserts `IdeaLegislation` link with linkType (target/relevant/precedent). |

**Deploy actions needed:** None.

---

### V2C-leg-ui: Legislation search and browse UI
| File | Change |
|------|--------|
| `app/legislation/page.tsx` | NEW — Server Component wrapper with metadata. |
| `app/legislation/LegislationBrowseClient.tsx` | NEW — Browse/search page with debounced search, type/jurisdiction filters, paginated results list. |
| `app/legislation/[itemId]/page.tsx` | NEW — Server Component, fetches full item from DB, passes to client. |
| `app/legislation/[itemId]/LegislationItemClient.tsx` | NEW — Section list with expand/collapse. Provenance banner on every section (TNA source link, amendment count, confidence badge, suggest correction). Correction submission form (auth-gated — redirects to sign-in if not signed in). |

**Deploy actions needed:** None. Initially empty pending ingestion + compilation.

---

## CODE CHANGES — 13 April 2026 Sprint V2-A

### V2A-connection: AI reliability — Vercel timeout, Grok fallback, auto-retry, Sentry logging
| File | Change |
|------|--------|
| `vercel.json` | Added `maxDuration: 60` for the AI route function. |
| `app/api/ai/[ideaId]/route.ts` | Added `classifyError` helper ('timeout', 'rate_limit', 'network', 'api_error'). Added `logAICall` helper via Sentry. Gemini/Grok try/catch now structured with timing, error type, and fallback flag. All 503 responses return `errorType` field. |
| `app/ideas/create/CreateIdeaClient.tsx` | Progressive retry: silent 1s auto-retry on first failure; message + 5s auto-retry on second failure (timeout/rate_limit); final error with Try Again button on third failure. `handleSend` accepts `isRetry` param to skip user message append. |

**Deploy actions needed:** None (Vercel env var verification needed).

### V2A-labels: Stage labels — Stage X format, notification redesign, remove voting box
| File | Change |
|------|--------|
| `lib/display-utils.ts` | NEW — `stageToLabel()` maps STAGE_1→'Stage 1' etc. |
| `app/dashboard/page.tsx` | Uses `stageToLabel()` for idea stage pills. Notification cards redesigned: title/message/date/What Next? link layout. Added `relatedIdeaId` to notification query. `normaliseStages()` replaces STAGE_X in notification text. |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Removed "Voting opens when this idea reaches the Campaign stage" box. |

**Deploy actions needed:** None.

### V2A-field-labels: Field labels — lib/field-labels.ts, sidebar section navigation
| File | Change |
|------|--------|
| `lib/field-labels.ts` | NEW — `FIELD_LABELS` record (80+ fields), `SIDEBAR_SECTIONS` array, `getFieldLabel()`, `getSectionHeading()`. |
| `app/ideas/create/CreateIdeaClient.tsx` | Stage2Sidebar rewritten to use SIDEBAR_SECTIONS loop, show/hide toggles, getFieldLabel(). Fixed `onClick={handleSend}` → `onClick={() => handleSend()}`. |

**Deploy actions needed:** None.

### V2A-schema: Schema additions
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added enums: `TargetOrganisationType`, `PointsCategory`, `PointsReason`. GuidingPolicy: +4 Rumelt fields (linkToDiagnosis, whatThisPolicyRulesOut, whyThisApproachNotOthers, conditionsForSuccess). CoherentAction: +5 benefit/cost fields (benefitFinancial, benefitSocial, benefitOngoing, netCostOngoing, netCostOneOff). New models: ResourcesCommitted, TargetOrganisation, PointsLedger, Reputation, ReferralEvent. Updated User and Idea relations. |

**Deploy actions needed:** `npx prisma db push` ✓ `npx prisma generate` ✓

### V2A-ux: Navigation and UX fixes
| File | Change |
|------|--------|
| `app/sign-in/[[...sign-in]]/page.tsx` | After sign-in, redirect to /dashboard (not /ideas/create). |
| `app/ideas/create/CreateIdeaClient.tsx` | Added "My Dashboard" link button to Lex toolbar. |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Edit + What Next? buttons moved below author/date line. Gate cards moved below tab content area. Added `whatNextOpen` state, reads `?whatnext=true` param on mount. |
| `app/api/ai/[ideaId]/route.ts` | RETURNING SESSION replaced with ORIENTEERING ON RETURN — specific 3-step return welcome (name + last thing + next field + "Shall we continue?"). |

**Deploy actions needed:** None.

### V2A-points: Credibility points system
| File | Change |
|------|--------|
| `lib/points.ts` | NEW — `POINTS_SCHEDULE`, `awardPoints`, `checkCap`, `cascadeTeambuilderPoints`, `awardPointsDirect`. Full cap logic (once_per_idea, idea_count, per_idea). |
| `lib/stage-gates.ts` | Added `awardPoints` import. Awards STAGE_2_ADVANCE, STAGE_3_ADVANCE, STAGE_4_ADVANCE, STAGE_5_ADVANCE at each advance function. |
| `app/api/ideas/[id]/route.ts` | Awards IDEA_STARTED (first PATCH), DIAGNOSIS_COMPLETE, GUIDING_POLICY_COMPLETE when fields first populated. |
| `app/api/ideas/[id]/contributions/route.ts` | Awards CONTRIBUTION_SUBMITTED on POST. |
| `app/api/ideas/[id]/contributions/[commentId]/rate/route.ts` | Awards CONTRIBUTION_RATED_3/4/5/1_2 to contribution author; IDEA_RATED to rater. |
| `app/api/ideas/[id]/vote/route.ts` | Awards IDEA_VOTED on POST. |

**Deploy actions needed:** None.

### V2A-whatnext: "What Next?" static panel
| File | Change |
|------|--------|
| `components/WhatNextPanel.tsx` | NEW — Progress bar (4 segments), collapsible journey overview, template status text, collapsible tips section. |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Imports WhatNextPanel. Renders below Edit button. Passes `diagnoses[0]`, `guidingPolicies[0]`, `coherentActions`. |

**Deploy actions needed:** None.

### V2A-docs: Docs update
| File | Change |
|------|--------|
| `scrutinise-docs/system_mechanics_v0_8.md` | NEW — v0.8 with updated Section 3 points schedule and new Section 21 (Referral Mechanics, Points, and Credibility end-to-end). |
| `scrutinise-docs/CHANGE_LOG.md` | This entry. |
| `scrutinise-docs/handoff_summary.md` | Sprint V2-A section added. |
| `CLAUDE.md` | Updated entity_list reference from v4 to v5. |

**Deploy actions needed:** None.

---

## CODE CHANGES — 28 March 2026 Sprint L5-A (L5-insight, L5-adapt, L5-research)

### L5-insight: LexInsight system — DB, admin panel, approved rules in prompt
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `LexInsightStatus` enum (DRAFT/APPROVED/REJECTED). Added `LexInsight` model. Added `lexInsightReviews` relation to User. |
| `app/api/ai/[ideaId]/route.ts` | Fetches up to 50 APPROVED LexInsight rules before building system prompt; injects as `## APPROVED BEHAVIOUR RULES`. Parses `insightFlag` from Lex JSON response; creates LexInsight DB record when present. Added INSIGHT LOGGING instruction to system prompt. |
| `app/api/admin/lex-insights/route.ts` | NEW — GET /api/admin/lex-insights — returns all insights sorted DRAFT→APPROVED→REJECTED. ADMIN/SUPER_ADMIN only. |
| `app/api/admin/lex-insights/[id]/route.ts` | NEW — PATCH /api/admin/lex-insights/[id] — update status + approvedRule. ADMIN/SUPER_ADMIN only. |
| `app/admin/page.tsx` | Added `LexInsight` type, `LexInsightCard` component, `LexInsightsSection` component. Added "Lex Insights" tab (available to all admins, not just SUPER_ADMIN). |

**Deploy actions needed:** `npx prisma db push` then `npx prisma generate`.

### L5-adapt: Lex adapts to experience level and user confidence
| File | Change |
|------|--------|
| `app/api/ai/[ideaId]/route.ts` | Added full EXPERIENCE LEVEL ADAPTATION section (all 5 levels with specific guidance). Added CONFIDENCE ADAPTATION section (HIGH/MEDIUM/LOW signals with response strategies). Both added as top-level sections in `buildSystemPrompt`. |

**Deploy actions needed:** None.

### L5-research: Lex proactive research and engagement facts
| File | Change |
|------|--------|
| `app/api/ai/[ideaId]/route.ts` | Added PROACTIVE RESEARCH AND ENGAGEMENT section to `buildSystemPrompt` — when/what/how to surface surprising facts, ironies, and examples. Hard limits: one fact per exchange, never fabricate. |

**Deploy actions needed:** None.

---

## CODE CHANGES — 28 March 2026 (team-invite-1, nav-lex-1, edit-button-1, Lex v5.1)

### team-invite-1: Team invite — search existing users and email invite for new users
| File | Change |
|------|--------|
| `app/api/users/search/route.ts` | NEW — GET /api/users/search?q= — search by name/username, auth required, excludes self and historical accounts, returns id/name/firstName/lastName/username |
| `app/api/ideas/[id]/collaborators/route.ts` | Extended POST to support two flows: userId (Flow A — add existing user directly as IdeaCollaborator) and email+name (Flow B — send invite via UserInvite+Resend) |
| `app/ideas/[id]/IdeaDetailClient.tsx` | TeamTab: "Add existing user" modal with debounced search results and Invite button; "Invite by email" form with firstName/lastName/email |
| `lib/email.ts` | Added `sendInviteMismatchNotificationEmail` — notifies inviter when signed-up user has different name from invite |
| `app/api/webhooks/clerk/route.ts` | On `user.created`: check for pending UserInvite to same email; if name differs, send mismatch notification email + create in-app Notification for inviter |

### nav-lex-1: Add top and bottom nav bars to Lex editing page
| File | Change |
|------|--------|
| `app/ideas/create/CreateIdeaClient.tsx` | Replaced minimal inline header with `PublicNav`. Added Lex toolbar (Save & Exit, View your idea, Sign in for unauthenticated). Added `SiteFooter` at bottom. |
| `components/SiteFooter.tsx` | NEW — minimal footer: Home, Browse, Dashboard, About, Privacy, Contact |

### edit-button-1: Rename Edit With Lex to Edit, make primary button
| File | Change |
|------|--------|
| `app/ideas/[id]/IdeaDetailClient.tsx` | "Edit with Lex" button renamed to "Edit". Changed from `variant="outline"` to `variant="default"` (solid dark/white). Owner only, Stage 1–2. |

### Lex v5.1: System prompt updates (6 targeted changes)
| File | Change |
|------|--------|
| `app/api/ai/[ideaId]/route.ts` | 4a: Stage 2 team message — exact wording from brief. 4b: OFFER HELP PROACTIVELY added. 4c: RETURN NAVIGATION — dashboard nav reminder for aiSessionCount < 3; aiSessionCount injected and incremented. 4d: No false praise — three bullets in What Lex Never Does. 4e: RETURNING SESSION — welcome back opening for returning users. 4f: TEAM NAME SUGGESTION on Stage 2 entry. |
| `scrutinise-docs/lex_system_prompt_v5.0.md` | Updated to v5.1 with all 6 changes documented. |

**Deploy actions needed:** None — no schema changes (aiSessionCount already existed), no new env vars.

---

## CODE CHANGES — 27 March 2026 (UX-mobile-1 — mobile swipe hint, connection retry button, accepted card position)

### UX-mobile-1: Three mobile UX fixes
| File | Change |
|------|--------|
| `components/FieldProposalCard.tsx` | **FIX 1:** Swipe hint already correctly implemented — `showSwipeHint` state, localStorage check, `lg:hidden` class, hint below buttons. No change required. |
| `components/FieldProposalCard.tsx` | **FIX 3:** Saved card state changed from green styling to teal chip (`#2da8a8` left border + fill, `#2da8a8` check icon). Visually connects accepted field to Lex message (Option B). |
| `app/ideas/create/CreateIdeaClient.tsx` | **FIX 2:** Added `isConnectionError?: boolean` to `ChatMessage`. Added `lastSentMessageRef` to store last sent message. Connection error catch sets `isConnectionError: true`. Added `handleRetry` function that removes error message and re-sends last message. Retry button rendered inline in error Lex bubble. |

---

## CODE CHANGES — 27 March 2026 (Sprint L4-editorial — 8 editorial seed ideas with full strategic kernels)

### L4-editorial: Seed 8 editorial ideas
| File | Change |
|------|--------|
| `scripts/seed/seed-editorial-ideas.ts` | New idempotent seed script for 8 live-policy-debate editorial ideas. Creates `editorial_scrutinise` User (clerkId, `isHistoricalAccount: false`). Upserts Ideas with `ideaOrigin: EDITORIAL_SEED`, blue banner `#3B82F6`, `STAGE_3`, `LINK_ONLY`. Upserts Diagnosis + GuidingPolicy; creates RootCause + CoherentActions if absent. |
| — | 8 ideas seeded: FCA competitiveness, pandemic preparedness, defence industrial reserve, ARIA governance, pre-legislative scrutiny, procurement open data, criminal courts digitisation, NHS diagnostic guarantee |
| — | All 8: Diagnosis ✓ (created), RootCause ✓ (created), GuidingPolicy ✓ (created), 1 CoherentAction ✓ (created) |

---

## CODE CHANGES — 27 March 2026 (Sprint L3 bug fixes — Edit with Lex button + sidebar field verification)

### L3-nav-fix: Edit with Lex button resumes existing idea session
| File | Change |
|------|--------|
| `app/ideas/[id]/IdeaDetailClient.tsx` | Replaced "Continue with Lex →" inline link with a proper `<Button variant="outline">` labelled "Edit with Lex" |
| — | href was already correct (`/ideas/create?ideaId=${idea.id}`); page.tsx and CreateIdeaClient already seed state from DB on resume — no changes needed there |
| — | Button visible to owner only at STAGE_1 or STAGE_2; placed below idea title, above gate checklist |

### L3-sidebar-fix: Sidebar field key alignment verified (no code changes required)
| File | Change |
|------|--------|
| `app/ideas/create/CreateIdeaClient.tsx` | Verified: SIDEBAR_FIELDS keys (`title`, `summaryDiagnosis`, `rootCause`, `summaryGuidingPolicy`, `summaryCoherentActions`, `whoAffected`, `proposedWording`) match exactly |
| `app/api/ai/[ideaId]/route.ts` | Verified: `buildCompletedFields` returns same keys; `rootCause` reads from `idea.rootCause` (Idea-level field), `whoAffected` reads from `idea.whoAffected` |
| `app/api/ideas/[id]/field-approval/route.ts` | Verified: `buildCompletedFields` returns same keys; completedFields returned after every acceptance |
| `app/ideas/create/CreateIdeaClient.tsx` | Verified: `handleProposalAccept` calls `setFields(prev => ({ ...prev, ...data.completedFields }))` after every acceptance |

---

## CODE CHANGES — 27 March 2026 (Sprint L4 — Historical Examples + IdeaOrigin Banner + SuperAdmin Transfer)

### L4-1: IdeaOrigin enum, isHistoricalAccount flag, banner fields
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `IdeaOrigin` enum: `USER`, `HISTORICAL_EXAMPLE`, `EDITORIAL_SEED` |
| `prisma/schema.prisma` | Added `isHistoricalAccount Boolean @default(false)` to User model |
| `prisma/schema.prisma` | Added `ideaOrigin IdeaOrigin @default(USER)`, `bannerColour String?`, `bannerText String?` to Idea model |
| — | `npx prisma db push` and `npx prisma generate` run clean |

### L4-2: IdeaOrigin banner on idea detail page
| File | Change |
|------|--------|
| `app/ideas/[id]/IdeaDetailClient.tsx` | Added `ideaOrigin`, `bannerColour`, `bannerText` to `Idea` interface |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Added `IdeaOriginBanner` component with info SVG icon, dynamic hex colour, left border, 15% opacity background |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Banner rendered between stage stepper and idea header; hidden for `USER` origin |
| — | Default text and colour per origin type; overridable per-idea via `bannerColour`/`bannerText` |

### L4-3: SuperAdmin ownership transfer in admin panel
| File | Change |
|------|--------|
| `app/admin/page.tsx` | Added `SuperAdminTransferSection` component: debounced idea/user search, inline confirmation modal |
| `app/admin/page.tsx` | "Transfer Ownership" tab added — SUPER_ADMIN only |
| `app/api/admin/ideas/search/route.ts` | New: GET search by title or ID, max 5 results, ADMIN+ |
| `app/api/admin/users/search/route.ts` | New: GET search by email/username/name, excludes `isHistoricalAccount`, max 5, ADMIN+ |
| `app/api/admin/ideas/[ideaId]/transfer-ownership/route.ts` | New: POST SUPER_ADMIN only; patches `creatorId`; creates `ActivityLog` ADMIN_ACTION record |

### L4-4: Seed 20 historical examples
| File | Change |
|------|--------|
| `scripts/seed/seed-historical-examples.ts` | New idempotent seeding script |
| — | 19 User records created (isHistoricalAccount=true, clerkId=`historical_[slug]`) |
| — | 20 Idea records created (STAGE_3, LINK_ONLY, HISTORICAL_EXAMPLE, bannerColour=#F97316) |

### L4-kernels: Seed Stage 2 strategic kernels for 20 historical example ideas
| File | Change |
|------|--------|
| `scripts/seed/seed-historical-kernels.ts` | New idempotent seeding script — upserts Diagnosis, GuidingPolicy; creates RootCause + CoherentActions if none exist |
| — | All 20 ideas: Diagnosis ✓, RootCause ✓, GuidingPolicy ✓ |
| — | CoherentAction counts: 14 ideas × 1 action, 6 ideas × 2 actions (30 total) |
| — | Run against production DB — 20/20 ideas processed successfully |
| — | Shelter England user used for ideas 1 and 9 as specified |

---

## CODE CHANGES — 26 March 2026 (Sprint L3 — Idea Page UX + Ownership Transfer)

### L3-1: Idea page layout and UX improvements
| File | Change |
|------|--------|
| `app/ideas/[id]/IdeaDetailClient.tsx` | Stage2GateCard restructured to two-column: left = requirements list, right = two info chips (Voting / Campaign in a Box) |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Idea sub-tabs changed from underline style to pill/chip row to visually distinguish from main tabs |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Overview sub-tab redesigned to two-column: left 2/3 = Summary heading + summaryDescription + summary fields; right 1/3 = metadata stack with Owner linking to /user/[username] |
| `app/ideas/[id]/IdeaDetailClient.tsx` | "Approach (summary)" label replaces "Solution (summary)" for summaryGuidingPolicy |
| — | "Continue with Lex →" already present from L2-4 — verified present, no change needed |

### L3-2: Transfer idea ownership
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `ownershipTransferToken String? @unique`, `ownershipTransferToId String?`, `ownershipTransferExpiry DateTime?` to Idea model |
| `lib/email.ts` | Added `sendOwnershipTransferEmail()` — sends accept link to new owner candidate |
| `app/api/ideas/[id]/transfer/initiate/route.ts` | POST: owner-only; validates new owner is existing collaborator; generates UUID token; sets 48hr expiry; sends email |
| `app/api/ideas/[id]/transfer/accept/route.ts` | POST: validates token + recipient match + expiry; transfers creatorId; adds old owner as EDITOR collaborator; creates SYSTEM notification |
| `app/api/ideas/[id]/transfer/cancel/route.ts` | POST: owner or recipient can cancel; clears all three transfer fields |
| `app/ideas/[id]/transfer/accept/page.tsx` | Server component: auth-gated; calls Prisma directly; on success redirects to /ideas/[id]?transferSuccess=1; on error shows message with back link |
| `app/ideas/[id]/IdeaDetailClient.tsx` | TeamTab: Transfer Ownership section at bottom (owner-only, requires ≥1 collaborator); collaborator dropdown; confirm modal; pending amber banner with cancel |

### L3-3: Prisma db push (production)
| Action | Result |
|--------|--------|
| `npx prisma db push --accept-data-loss` | Database in sync — 3 new Idea fields added; unique constraint on ownershipTransferToken |
| `npx prisma generate` | Prisma Client v7.5.0 regenerated |

---

## CODE CHANGES — 26 March 2026 (Content and Copy)

| Change | File(s) | Detail |
|--------|---------|--------|
| About page copy | `app/about/page.tsx` | Replaced 5 paragraphs with 4 new ones — non-partisan mission statement, platform description, track record rationale, closing focus line |
| Training page items | `lib/mockData.ts` | All 5 MOCK_TRAINING items updated: real URLs, Item 4 renamed to "Parliament's Engagement with the Public", all changed to ARTICLE type (external/internal links) |
| Legislative drafting sub-page | `app/training/legislative-drafting/page.tsx` | New page: OPC guidance link, Core Principles, IfG Recommendations, Best Practices sections |
| Parliamentary scrutiny sub-page | `app/training/parliamentary-scrutiny/page.tsx` | New page: Key Aspects, Current Concerns, Key Links sections |
| Terms / Community Rules nav | `app/terms/page.tsx`, `app/community-rules/page.tsx`, `components/BackLink.tsx` | Removed PublicNav from both pages (used in sign-up flow); replaced with `BackLink` client component using `router.back()` |

---

## CODE CHANGES — 26 March 2026 (Post-UAT Bug Fixes)

| Bug | File(s) | Change |
|-----|---------|--------|
| B1 | `app/ideas/create/page.tsx`, `app/ideas/create/CreateIdeaClient.tsx` | Auth guard: server component with `auth()` redirect for unauthenticated users; client code extracted to `CreateIdeaClient.tsx` |
| B2 | `app/ideas/page.tsx` | Browse Ideas holding page — PublicNav, Sign Up button, back to home |
| B3 | `app/privacy/page.tsx` | Privacy Policy holding page — PublicNav, footer nav |
| B4 | `app/contact/page.tsx` | Contact Us holding page — hello@scrutinise.org, footer nav |
| B5 | `app/onboarding/page.tsx` | Post-onboarding redirect → `/dashboard`; respects `redirect_url` query param |
| B6 | `app/page.tsx`, `components/ui/Navbar.tsx` | `/prototype/create/stage1` → `/ideas/create` |
| B8 | `app/api/ai/[ideaId]/route.ts` | Full Lex v5.0 system prompt: commit-and-advance, three-exchange limit, field completion reference, Stage 1 aha moment |
| B10 | `app/ideas/create/page.tsx`, `app/ideas/create/CreateIdeaClient.tsx` | Dynamic opening message (first visit vs return visit), personalised by preferredName and time of day |

---

## CODE CHANGES — 26 March 2026 (Sprint L1 — Lex Overhaul)

### L1-1: Schema + sub-entity API routes
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add Diagnosis, RootCause, GuidingPolicy, Evidence models; EvidenceOutcome enum; missing CoherentAction fields (costFinancial/Social/Ongoing, benefits, keyChallenges, legislationDraftWording, organisationalChangeDraftWording, oppositionWho/Why/Answers); add Idea relations to new models |
| `app/api/ideas/[id]/diagnosis/route.ts` | POST upsert Diagnosis (one per idea) |
| `app/api/ideas/[id]/root-causes/route.ts` | GET list + POST create RootCause |
| `app/api/ideas/[id]/guiding-policy/route.ts` | POST upsert GuidingPolicy (one per idea) |
| `app/api/ideas/[id]/evidence/route.ts` | POST create Evidence |
| `app/api/ideas/[id]/coherent-actions/route.ts` | Updated to accept all CoherentAction fields from entity_list_v4.md |

### L1-2: Stage 1 Lex scoped to Basic Info
| File | Change |
|------|--------|
| `app/api/ai/[ideaId]/route.ts` | Stage 1 prompt: 3–5 exchange flow, targets title/summaryDescription/summaryDiagnosis/summaryGuidingPolicy/summaryCoherentActions/govtArea/ideaType; triggerSavePrompt on summaryDiagnosis+summaryGuidingPolicy; mirrors to legacy fields for sidebar compat |
| `app/api/ai/public/route.ts` | Updated SYSTEM_PROMPT to use Stage 1 field names |

### L1-3: FieldProposalCard approval UX
| File | Change |
|------|--------|
| `components/FieldProposalCard.tsx` | New: teal-accented proposal card; Accept/Edit/Discuss buttons; 30s auto-accept countdown; keyboard shortcuts; swipe gestures; edit mode; saved/discussed states |
| `app/api/ideas/[id]/field-approval/route.ts` | New: POST accepts proposal, writes to DB; handles Idea-level, diagnosis.*, guidingPolicy.*, rootCause.*, coherentActions, evidence fields; returns completedFields |
| `app/api/ai/[ideaId]/route.ts` | Stop writing fieldUpdates to DB; return pendingProposals array; serverTrigger checks proposals |
| `app/ideas/create/CreateIdeaClient.tsx` | Handle pendingProposals; render FieldProposalCards; disable input while pending; "Accept all" button; POST to field-approval |

### L1-4: Stage 2 Lex two-pass Strategic Kernel
| File | Change |
|------|--------|
| `app/api/ai/[ideaId]/route.ts` | Stage 2 system prompt: Pass 1 (core kernel) + Pass 2 (supporting detail); aha-moment reflection; research prompt; full sub-entity field targets with dot notation |

### L1-5: Idea tab with sub-tabs + full field display
| File | Change |
|------|--------|
| `app/ideas/[id]/page.tsx` | Fetch diagnoses, rootCauses, guidingPolicies, evidence; serialise; pass to IdeaDetailClient |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Rename Overview → Idea tab; add 4 sub-tabs (Overview, Diagnosis, Policy, Coherent Actions); FieldDisplay component with inline edit; sub-entity interfaces; extended CoherentAction interface |

### L1-6: Campaign in a Box button + Browse Ideas page
| File | Change |
|------|--------|
| `app/ideas/[id]/IdeaDetailClient.tsx` | Campaign in a Box button: owner-only, disabled Stages 1–3, active Stages 4–5 navigates to Campaign tab |
| `app/ideas/page.tsx` | Replace holding page with real server-side listing: Stage 3+ ACTIVE ideas, cursor pagination, "Your Ideas" section for auth users |
| `components/IdeaCard.tsx` | New: idea card with title, summary, stage badge, govtArea tag, creator link, votes, contributions, relative time |

---

## CODE CHANGES — 26 March 2026 (Sprint L2 — Lex UX and Experience Level)

### L2-0: Onboarding routing fixes
| File | Change |
|------|--------|
| `app/layout.tsx` | Add `afterSignUpUrl="/onboarding"` to ClerkProvider so Google SSO users land on onboarding |
| `app/onboarding/page.tsx` | Converted to async server component; server-side redirect if `ageConfirmed && experienceLevel` both set; passes `promptOnly` flag for existing users missing only experienceLevel |
| `app/onboarding/OnboardingForm.tsx` | New client component extracted from old page.tsx; accepts `redirectUrl`, `promptOnly`, `fromCreate` props; `promptOnly` mode shows only the experience level question |
| `app/ideas/create/page.tsx` | Gate on `ageConfirmed`; redirect existing users with no `experienceLevel` to onboarding; adds `?from=create` param |

### L2-1: Sidebar completedFields fix + Stage 1 field labels
| File | Change |
|------|--------|
| `app/ideas/create/CreateIdeaClient.tsx` | `SIDEBAR_FIELDS` updated to 7 Stage 1 fields with correct keys and labels (title, summaryDiagnosis, rootCause, summaryGuidingPolicy, summaryCoherentActions, whoAffected, proposedWording); `FieldCompletion` interface extended with 12 Stage 2 fields; `calcProgress` takes `stage` and `coherentActionsCount` |
| `app/api/ideas/[id]/field-approval/route.ts` | `buildCompletedFields` updated to return new Stage 1 key names; response now includes `{ completedFields, currentStage, coherentActionsCount }` |
| `app/api/ai/[ideaId]/route.ts` | `completedFields` map aligned to new Stage 1 key names; response includes `currentStage` and `coherentActionsCount` |

### L2-2: Lex Stage 1 prompt fixes
| File | Change |
|------|--------|
| `app/api/ai/[ideaId]/route.ts` | SECOND RESPONSE RULE (no re-intro); title proposal precedes background question; HANDLING UNCERTAINTY section; EXPERIENCE LEVEL ADAPTATION section for both Stage 1 and Stage 2 |

### L2-3: Keyboard shortcuts for FieldProposalCard
| File | Change |
|------|--------|
| `components/FieldProposalCard.tsx` | Global `keydown` listener: Enter accepts when no input/textarea focused; Escape switches to edit mode; `handleAccept` dispatches `lex-field-accepted` custom event; declaration order fixed (useCallback before dependent useEffect) |
| `app/ideas/create/CreateIdeaClient.tsx` | Global `lex-field-accepted` listener refocuses chat input after acceptance |

### L2-4: Save & Exit, View Idea, Continue with Lex navigation
| File | Change |
|------|--------|
| `app/ideas/create/page.tsx` | Accept `searchParams: Promise<{ ideaId?: string }>`; fetch `aiChatHistory` and `stage` when `?ideaId` present; pass `initialIdeaId`, `initialMessages`, `initialStage` to `CreateIdeaClient` |
| `app/ideas/create/CreateIdeaClient.tsx` | Save & Exit button (navigates to `/dashboard` if `ideaId` set, shows inline message otherwise); View Idea link (new tab, owner only); `initialStage` prop initialises `currentStage` state |
| `app/ideas/[id]/IdeaDetailClient.tsx` | "Continue with Lex →" link below idea title; owner-only; visible at STAGE_1 or STAGE_2; links to `/ideas/create?ideaId=${idea.id}` |

### L2-5: ExperienceLevelEnum + onboarding form + Lex context + settings
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `ExperienceLevelEnum` (NO_BACKGROUND, SECTOR_LIVED, THINK_TANK_JUNIOR, THINK_TANK_SENIOR, POLITICAL_JUNIOR, POLITICAL_SENIOR, PARLIAMENTARIAN); add `experienceLevel ExperienceLevelEnum?` to User model |
| `app/onboarding/OnboardingForm.tsx` | Experience level dropdown added between preferredName and T&Cs; required in both full and promptOnly modes |
| `app/api/user/onboarding/route.ts` | GET handler returns `{ preferredName, experienceLevel }`; PATCH handles full onboarding and profile-update (experience level only) modes |
| `app/api/ai/[ideaId]/route.ts` | `buildSystemPrompt` context includes `experienceLevel`; runtime context block emits `User experience level: …`; `experienceLevel` fetched from user record |
| `app/settings/page.tsx` | Experience level dropdown added to Account Details; fetches current value on mount; auto-saves on change with "Saved" confirmation |

### L2-6: Stage 2 sidebar progressive disclosure
| File | Change |
|------|--------|
| `app/ideas/create/CreateIdeaClient.tsx` | `Stage2Sidebar` component with three progressive-disclosure sections (Diagnosis, Guiding Policy, Coherent Actions); renders in place of Stage 1 sidebar when `currentStage` is STAGE_2+; `coherentActionsCount` displayed in Coherent Actions section header |
| `app/api/ideas/[id]/field-approval/route.ts` | `buildCompletedFields` fetches `diagnoses` and `guidingPolicies` sub-entities; returns 7 Stage 2 boolean fields across diagnosis and guidingPolicy groups |
| `app/api/ai/[ideaId]/route.ts` | `latest` select extended with `diagnoses` and `guidingPolicies`; Stage 2 `completedFields` includes all sub-entity boolean fields |

---

## PENDING CHANGES
*(Changes decided but not yet applied to spec docs)*

| Date | Document | Change Required | Source |
|------|----------|----------------|--------|
| 2026-03-06 | entity_list_v3.md | Add DisputedLogicFlag entity — referenced in lex_system_prompt_v2.md Section 5 but missing from entity list. Fields needed: id, ideaId, userId, lexFlag (text), userDispute (text), status (PENDING/REVIEWED), adminVerdict (nullable), createdAt | lex_system_prompt_v2.md cross-reference |
| 2026-03-06 | entity_list_v3.md | Confirm UserAIKey entity is correctly marked deferred (bring-your-own-key, v1.1). Currently in entity list — verify deferred status matches implementation_plan | handoff_summary |
| 2026-03-06 | CLAUDE.md | Add temporary instruction: "Audit existing CC build against spec before continuing Sprint 1. Produce gap report: what matches spec / what needs correcting / what doesn't exist yet. Fix all 'needs correcting' items before new build." [REMOVE AFTER: audit complete] | March 2026 session |
| 2026-03-06 | wireframes_v3.md | Add ASCII layout sketches for key pages where spatial layout is load-bearing: WF-11 (Lex two-panel interface), WF-13 (idea detail tabs), WF-33 (admin dashboard) | March 2026 session |
| 2026-03-06 | entity_list_v3.md | Clarify ProposedWording location — confirm it is per CoherentAction (not a single field on Idea). If so, update CoherentAction entity to make proposedWording the primary field and demote Idea.proposedWording to a computed/display field | handoff_summary |
| 2026-03-06 | system_mechanics_v0.6.md | Clarify 70/30 AI credit split mechanic — confirmed as 70/30 but exact mechanic (how user pays their 30%) is TBC. Add placeholder with TBC note. | handoff_summary |
| 2026-03-06 | README.md | This document — created this session, first entry | March 2026 session |
| 2026-03-06 | CHANGE_LOG.md | This document — created this session, first entry | March 2026 session |

---

## APPLIED CHANGES
*(Permanent audit trail of all changes applied to spec docs)*

| Date Applied | Document | Change Made | Originally Decided |
|-------------|----------|-------------|-------------------|
| 2026-03-24 | schema.prisma | Added User fields: deletionRequestedAt DateTime?, deletionScheduledFor DateTime?, unsubscribeToken String @unique @default(uuid()) | Sprint 9 GDPR |
| 2026-03-24 | components/PublicNav.tsx | Replaced all /prototype/* nav links with real routes (/ideas/create, /ideas, /dashboard). Updated "Profile" button label to "Dashboard". | Sprint 9 Priority 1 |
| 2026-03-24 | app/layout.tsx | Updated signInFallbackRedirectUrl from /prototype/dashboard to /dashboard. Added full Metadata export (title template, description, metadataBase, OpenGraph). | Sprint 9 Priority 1 + 3a |
| 2026-03-24 | app/error.tsx | New: global error boundary — "Something went wrong" + Try again button + home link. No stack traces exposed. | Sprint 9 Priority 2b |
| 2026-03-24 | app/not-found.tsx | New: 404 page — clean, links to homepage. | Sprint 9 Priority 2b |
| 2026-03-24 | app/loading.tsx | New: global loading skeleton (spinner + "Loading…"). | Sprint 9 Priority 2c |
| 2026-03-24 | app/ideas/[id]/loading.tsx | New: route-level loading skeleton for idea detail page. | Sprint 9 Priority 2c |
| 2026-03-24 | app/user/[username]/loading.tsx | New: route-level loading skeleton for public profile page. | Sprint 9 Priority 2c |
| 2026-03-24 | app/admin/loading.tsx | New: route-level loading skeleton for admin panel. | Sprint 9 Priority 2c |
| 2026-03-24 | app/ideas/[id]/page.tsx | Added generateMetadata: Stage 3+ public ideas get dynamic title/description/OG/twitter. Private/early-stage ideas return generic metadata. | Sprint 9 Priority 3a |
| 2026-03-24 | app/user/[username]/page.tsx | Added generateMetadata: returns user name and bio as page title/description. | Sprint 9 Priority 3a |
| 2026-03-24 | app/terms/page.tsx | Updated version label to "Version 1.0 — Draft · Last updated: March 2026". | Sprint 9 Priority 4 |
| 2026-03-24 | app/community-rules/page.tsx | Updated version label to "Version 1.0 — Draft · Last updated: March 2026". | Sprint 9 Priority 4 |
| 2026-03-24 | public/robots.txt | New: robots.txt allowing /ideas/ /user/ but blocking /admin/ /api/ /prototype/ /settings/ /dashboard/. Sitemap pointer. | Sprint 9 Priority 3b |
| 2026-03-24 | app/sitemap.ts | New: dynamic sitemap returning static pages + all Stage 4+ PLATFORM_LISTED ideas + public user profiles with Stage 3+ ideas. | Sprint 9 Priority 3c |
| 2026-03-24 | app/api/user/export/route.ts | New: POST owner-only data export (user, ideas, contributions, votes, research, amendments). Rate limited 1/24h. Returns JSON directly (R2 stub for future). | Sprint 9 Priority 5a |
| 2026-03-24 | app/api/user/account/route.ts | New: DELETE account deletion request. Sets DELETION_PENDING + 30-day grace period. Sends confirmation email if RESEND_API_KEY set. | Sprint 9 Priority 5b |
| 2026-03-24 | lib/auth.ts | Added deletion cancellation: if user logs in while DELETION_PENDING, restores to ACTIVE and clears deletion dates. Removed console.log. | Sprint 9 Priority 5b |
| 2026-03-24 | lib/gdpr.ts | New stub: anonymiseExpiredAccounts() — finds DELETION_PENDING users where deletionScheduledFor < now, anonymises PII, sets status DELETED. | Sprint 9 Priority 5b |
| 2026-03-24 | app/settings/page.tsx | New client page: Account details, Download your data button, Delete account button + confirmation modal, Notification preferences placeholder. | Sprint 9 Priority 5c |
| 2026-03-24 | app/unsubscribe/[token]/page.tsx | Updated to support both UUID token (new-style) and base64-encoded email (legacy). UUID token looks up unsubscribeToken field; base64 falls back to existing behaviour. | Sprint 9 Priority 6b |
| 2026-03-24 | app/dashboard/page.tsx | New server page: user's ideas as cards (all stages, most recent first), notifications (last 10), quick stats (ideas, contributions, credibility score), Create new idea button. | Sprint 9 Priority 7 |
| 2026-03-24 | middleware.ts | Added /dashboard(.*) and /settings(.*) to protected routes. | Sprint 9 Priority 5c/7 |
| 2026-03-24 | api/webhooks/clerk/route.ts | Removed console.log. | Sprint 9 Priority 2a |
| 2026-03-24 | schema.prisma | Added GeneratedOutputType enum (MP_BRIEFING, ONE_PAGER, PRESS_RELEASE, SOCIAL_KIT), GeneratedOutputStatus enum (PENDING, COMPLETE, FAILED), GeneratedOutput model with @@unique([ideaId, documentType]); added generatedOutputs relation to Idea | Sprint 8 Campaign in a Box |
| 2026-03-24 | lib/campaign-prompts.ts | New module: four prompt builder functions (buildMpBriefingPrompt, buildOnePagerPrompt, buildPressReleasePrompt, buildSocialKitPrompt) — each injects referral link | Sprint 8 Campaign in a Box |
| 2026-03-24 | app/api/ideas/[id]/generate/route.ts | POST — owner-only, Stage 4+ gate, Zod body, Gemini 2.5 Flash call, PENDING→COMPLETE/FAILED upsert, force-regenerate support | Sprint 8 Campaign in a Box |
| 2026-03-24 | app/api/ideas/[id]/campaign-outputs/route.ts | GET — owner-only, returns all GeneratedOutput records with 200-char preview | Sprint 8 Campaign in a Box |
| 2026-03-24 | app/ideas/[id]/CampaignTab.tsx | New component: four document cards, generate/regenerate buttons, 3-second polling, copy/download actions, owner-locked message for non-owners | Sprint 8 Campaign in a Box |
| 2026-03-24 | app/ideas/[id]/IdeaDetailClient.tsx | Added Campaign tab (Stage 4/5 only) to Tab type, isValidTab, tabs array, and tab panel render | Sprint 8 Campaign in a Box |
|-------------|----------|-------------|-------------------|
| 2026-03-06 | All docs | Initial creation of complete 9-document library from scattered architecture docs, wireframe audits, process lists, system mechanics, AI integration spec, Lex system prompt v2, and implementation plan. Consolidated two months of decisions. | March 2026 reconciliation session |
| 2026-03-08 | scrutinise-web/lib/mockData.ts | Expanded MockIdea interface with diagnosis, rootCause, guidingPolicy, research, history, endorsements, qualityFlags, targetLegislation, wordingLocked, version, proposedWording. Rewrote CoherentAction interface (title/description/proposedWording). Updated all 3 mock ideas with realistic content. Added MOCK_TRAINING (5 entries), MOCK_GROUPS (2 groups), expanded MOCK_NOTIFICATIONS to 8 entries. Added isOwnerReply and stance to Comment. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/components/CommentRatingForm.tsx | Created new component: multi-flag positive/negative rating UI for comments. Positive flags: constructive, insightful, relevant, fresh_perspective, balanced, helpful_facts, direct_experience, good_question. Negative flags: ad_hominem, straw_man, red_herring, false_dilemma, slippery_slope, moving_goalposts, motte_bailey, tu_quoque, cherry_picking, not_relevant. Optional note field. Submit state. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/idea/[id]/page.tsx | Complete rebuild. 6 tabs (Overview, Amendments, Comments, Research, Wording, History). Owner vs guest view detection. Owner panel: stage gate checklist, vote analytics with bars, quality flag tallies, Broadcast to Voters button. Tab 1 Overview: diagnosis, rootCause, guidingPolicy, expandable coherent actions, target legislation card, endorsements with required count. Tab 2 Amendments: filter bar, DiffView on expand, owner Accept/Reject/Consult buttons on PENDING. Tab 3 Comments: stance filter, sort, CommentRatingForm inline, stance badges, Report button. Tab 4 Research: filter bar, sourceType badges, for/against indicator, Add Research link. Tab 5 Wording: locked/unlocked notice, version, edit button. Tab 6 History: type icons, chronological list. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/settings/page.tsx | New page. Account section (display name, username, email read-only, bio, expertType, politicalParty). Status Claims (parliamentary modal with MP/Lords roles; professional modal with firm/credentials/file upload). Privacy (download data, delete account with warning). Notifications (global email toggle + 8 individual type toggles). AI section (interaction style dropdown, credit balance bar, top-up button). | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/notifications/page.tsx | New page. Filter tabs (All/Votes/Amendments/Stage/System). Mark all as read state. Per-notification mark-read on click. Type icons. Unread blue dot and blue-tinted card. Click navigates to idea. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/groups/page.tsx | New page. Group cards with type badge, role badge (Owner/Member), member count. Manage/View links. Create Group button. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/groups/create/page.tsx | New page. Group name (required), description, type radio (Collaborators/Supporters/Public), email chip input with add/remove, submit success state. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/groups/[id]/page.tsx | New page. Header with type badge, member count. Invite link with clipboard copy button. Member list with Remove buttons (owner only). Add member email input. Settings accordion (owner only): edit name/description, delete group. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/propose-amendment/[ideaId]/page.tsx | New page. Section dropdown (CoherentAction titles + Guiding Policy + Diagnosis). Current text auto-populated read-only. Proposed text with live word count diff. Rationale (required). Research URL multi-row input. Relevant legislation. Submit success state. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/add-research/[ideaId]/page.tsx | New page. Title, snippet, relevance, summary, source URL, source type dropdown. For policy Yes/No toggle. For action Yes/No toggle. Quality self-assessment 1–5 star buttons. PDF file input (visual). Submit success state. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/training/page.tsx | Complete rebuild. Dark mode. Filter bar: Stage (All/Create/Draft/Develop/Campaign/Parliament), Difficulty (All/Beginner/Intermediate/Advanced), Type (All/Video/Article). Resource cards with type badge, stage badge, difficulty badge. Video cards: Watch button triggers inline iframe embed. Article cards: Read → external link. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/referral/idea/[id]/page.tsx | New page. "Shared by [owner]" attribution banner. Idea title, summary, vote counts. VoteWidget. Diagnosis, guiding policy, coherent actions. Endorsements section. What is Scrutinise? explainer. Login/signup prompt with links. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/referral/user/[username]/page.tsx | New page. User avatar initials circle, display name, role badge, verified badge, Credibility Score. Their ideas list with stage badge, vote count, passion score. What is Scrutinise? explainer. Login/signup prompt. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/layout.tsx | Added sticky prototype nav bar with links to Dashboard, Groups, Training, Settings. Added notification bell icon with red unread count badge (reads from MOCK_NOTIFICATIONS). | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/components/ui/Navbar.tsx | Updated links array from plain strings to {label, href} objects with correct routes (Create→/prototype/create/stage1, Browse→/prototype/browse, Training→/training, About→/about). | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/page.tsx | Added Journey 6 (Explore dashboard → /prototype/dashboard) and Journey 7 (Browse training → /training). | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/dashboard/page.tsx | Added header shortcut links to Notifications, Groups, Settings pages. | 2026-03-08 prototype build session |
| 2026-03-06 | README.md | Added Section 4a: Concurrent Working — the critical rule. CC edits files directly on disk; CCh works from uploaded copies. They must never work on the same file simultaneously. Charlie is the gatekeeper. CCh holds decisions in context and batch-applies at handoff. | Reply 26–27, March 2026 session |
| 2026-03-06 | README.md | Clarified file access for each actor in Section 4: CC reads/writes disk directly; CCh only sees uploaded files and produces outputs for Charlie to save manually. | Reply 25–26, March 2026 session |
| 2026-03-06 | scrutinise-web/components/RevolutHero.tsx | Stage names corrected in homepage hero: Stage 1–5 → Create / Draft / Develop / Campaign / Parliament | CC build audit |
| 2026-03-06 | scrutinise-web/lib/mockData.ts | Comment rating structure changed from numeric {quality, evidence, civility} to multi-flag arrays: positiveFlags: string[], negativeFlags: string[]. Valid flags defined per spec. | CC build audit |
| 2026-03-06 | scrutinise-web/app/about/page.tsx | "burnish the reputation of parties" → "enhance the standing of parties" to avoid conflict with platform Credibility Score terminology | CC build audit |
| 2026-03-06 | scrutinise-docs/scrutinise_prototype_brief.md | Created — comprehensive prototype build guide covering codebase state, file structure, mock data, scripted Lex conversation (19 exchanges), component specs, five user journeys, terminology, styling guidelines, deployment notes, and build order | CC session |
| 2026-03-07 | scrutinise-web/app/prototype/profile/[username]/page.tsx | Created — user profile page (WF-30): credibility score display, points breakdown (Strategist/Thinker/Rallymaster/Teambuilder), expert badges, user's ideas grid, recent contributions, Follow toggle button (visual only in prototype) | Phase 2 build |
| 2026-03-08 | scrutinise-web/components/VoteWidget.tsx | Strength slider updated to step={0.5} (11 stops: 0–5 in 0.5 increments). strengthLabels changed from 6-entry array to 11-entry Record<number, string>. Display updated to toFixed(1). | Spec correction |
| 2026-03-08 | scrutinise-web/.dropboxignore | Created — excludes .next/ and node_modules/ from Dropbox sync to prevent file locking conflicts with Next.js dev server (EPERM rename errors) | Dev environment fix |
| 2026-03-09 | scrutinise-web/app/prototype/create/stage1/page.tsx | Rebuilt: 8-field Basic Info form (title, ideaType toggle, govtArea dropdown, summaryDescription, summaryDiagnosis, summaryGuidingPolicy, summaryCoherentActions, connectedIdeas). Stage progress indicator. Conditional "Ready for Stage 2" button. | CC_briefing_next_session.md Priority 1 |
| 2026-03-09 | start-session.sh | Created: session logging script — appends timestamp and branch to session-log.txt, runs git status | CC_briefing_next_session.md Priority 2 |
| 2026-03-09 | scrutinise-web/app/prototype/page.tsx | Converted from journey-selector hub to WF-10 proper dashboard: welcome greeting, My Ideas section, quick actions, notifications sidebar, following/watching placeholder, groups section | CC_briefing_next_session.md Priority 3 |
| 2026-03-09 | scrutinise-web/app/prototype/testing-guide/page.tsx | Created: tester-facing checklist with 8 journeys, step-by-step verification items per journey, full page inventory table with checkboxes | CC_briefing_next_session.md Priority 4 |
| 2026-03-09 | scrutinise-docs/entity_list_v4.md | Added to repo: replaces entity_list_v3.md. 54 entities. CommentRating redesigned with positiveFlags/negativeFlags JSON + dispute flow. DisputedLogicFlag entity added. Follow entity added. Training entity added. CredibilityScore canonical (InfluenceScore retired). User.mobile required. BroadcastMessage expanded with co-signatory fields. | CCh session 09-03-26 |
| 2026-03-09 | scrutinise-docs/CC_briefing_next_session.md | Created: CCh-produced briefing document for this CC session | CCh session 09-03-26 |
| 2026-03-09 | scrutinise-docs/CLAUDE.md | Updated: Section 1 checklist references entity_list_v4; Section 5 repo structure updated to v4 (54 entities); Section 12 Field Preservation Rule added (immutable, CCh-only entity list); Section 11/13 renumbered | CCh session 09-03-26 |
| 2026-03-10 | scrutinise-web/app/globals.css | Merged v0 design token set: full :root CSS variable block (background, foreground, card, primary, secondary, muted, accent, destructive, border, input, ring, chart-1–5, sidebar-*, stage-create through stage-parliament, success, dark-bg/fg/muted/border). Added .dark-section utility class, @theme inline block, @layer base. Replaced @tailwind v3 directives with @import 'tailwindcss' (v4). Retained DM Sans font import and video-mask-left utility. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/lib/utils.ts | Created: cn() helper (clsx + tailwind-merge) required by shadcn components | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/components/ui/button.tsx | Added: shadcn Button component (cva variants: default/destructive/outline/secondary/ghost/link; sizes: default/sm/lg/icon) | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/components/ui/badge.tsx | Added: shadcn Badge component (variants: default/secondary/destructive/outline) | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/components/ui/card.tsx | Added: shadcn Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction components | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/components/ui/input.tsx | Added: shadcn Input component | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/components/ui/textarea.tsx | Added: shadcn Textarea component | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/components/ui/separator.tsx | Added: shadcn Separator component | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/components/ui/label.tsx | Added: shadcn Label component | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/components/ui/empty.tsx | Added: v0 Empty component set (Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia) | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/components/ui/field.tsx | Added: v0 Field component | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/components/ui/item.tsx | Added: v0 Item component | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/components/ui/spinner.tsx | Added: v0 Spinner component | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/components/ui/button-group.tsx | Added: v0 ButtonGroup component | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/layout.tsx | Simplified root layout: removed old Navbar and dark body classes. ClerkProvider + clean body wrapper only. Homepage now self-contained with its own nav. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/page.tsx | Replaced RevolutHero-based homepage with full v0 design. Sticky nav with backdrop-blur, mobile hamburger. Hero section (bg-background, left-aligned). Parliament video dark band. Research video band (placeholder). Five Stages section. Stats band. Trust/Democracy copy. Footer with About/Privacy/Terms/Contact. All CTAs use Scrutinise routes (/prototype/create/stage1, /prototype/browse). No /prototype entry-point link. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/layout.tsx | Restyled: sticky header with backdrop-blur, bg-background/95. Bell icon from lucide-react (size-5). Nav links text-muted-foreground hover:text-foreground. Unread badge uses bg-primary. Removed dark bg-gray-950. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/page.tsx | Restyled dashboard: Button/Card/Badge/CardHeader/CardTitle/CardContent from shadcn. stageBadgeStyle using CSS variables. Section headings text-xs uppercase tracking-wider text-muted-foreground. Cards bg-card border-border rounded-xl. Quick action buttons use Button variants. Notification unread uses bg-primary/5 border-primary/20. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/browse/page.tsx | Style pass: stageBadgeStyle CSS variables. Cards bg-card border-border hover:border-primary/40. Filters/selects use border-border bg-background. Text foreground/muted-foreground. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/idea/[id]/page.tsx | Style pass: full token replacement. stageBadgeStyle CSS variables. Amendment/comment/research/stance badge colours use light semantic (bg-green-100 text-green-800 etc). Filter buttons bg-primary active / border-border inactive. Owner panel cards bg-card border-border. Progress bars bg-secondary. Tabs border-primary active. History timeline bg-secondary. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/create/stage1/page.tsx | Style pass: bg-background, border-border, text-foreground/muted-foreground, primary CTAs. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/create/stage2/page.tsx | Style pass: bg-background, border-border, text-foreground/muted-foreground. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/profile/[username]/page.tsx | Style pass: stageBadgeStyle CSS variables. Cards bg-card border-border. Text tokens. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/settings/page.tsx | Style pass: all form inputs border-border bg-background. Cards bg-card. Text tokens. Button variants. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/notifications/page.tsx | Style pass: bg-card border-border cards. Unread highlight bg-primary/5 border-primary/20. Text tokens. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/groups/page.tsx | Style pass: bg-card border-border. Text tokens. Button variants. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/groups/create/page.tsx | Style pass: form inputs border-border. Cards bg-card. Text tokens. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/groups/[id]/page.tsx | Style pass: bg-card border-border. Member list. Text tokens. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/propose-amendment/[ideaId]/page.tsx | Style pass: form inputs, selects, cards all use design tokens. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/add-research/[ideaId]/page.tsx | Style pass: toggles, star buttons, file input, cards all use design tokens. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/admin/page.tsx | Style pass: tabs bg-primary active / border-border inactive. Cards bg-card. Text tokens. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/dashboard/page.tsx | Style pass: stageBadgeStyle CSS variables. Nav links text-muted-foreground. Cards bg-card border-border. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/amendment/[id]/page.tsx | Style pass: bg-card border-border. Text tokens. text-primary links. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/referral/idea/[id]/page.tsx | Style pass: stageBadgeStyle CSS variables. Cards bg-card border-border. Avatar bg-primary text-primary-foreground. Text tokens. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/referral/user/[username]/page.tsx | Style pass: stageBadgeStyle CSS variables. Cards bg-card. Avatar bg-primary. Text tokens. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/prototype/testing-guide/page.tsx | Style pass: progress bar bg-primary. Checkbox bg-primary. Cards bg-card border-border. Text tokens. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/training/page.tsx | Style pass: filter buttons bg-primary active / border-border inactive. Resource cards bg-card border-border. Watch/Read buttons use primary tokens. Text tokens. | v0 design integration session 10-03-26 |
| 2026-03-10 | scrutinise-web/app/about/page.tsx | Style pass: text-foreground, bg-background. Text tokens. | v0 design integration session 10-03-26 |

| 2026-03-22 | scrutinise-web/lib/mockData.ts | Stage type `'Parliament'` → `'Legislate'`. Training resource stageTag `'Parliament'` → `'Legislate'`. | Sprint 1 session |
| 2026-03-22 | scrutinise-web/lib/lexScripts.ts | Fix 2 — LEX_JOURNEY_1_SCRIPT opening message changed to: "I'm Lex, your researcher and guide. What's the challenge you want to fix?" | Sprint 1 Fix 2 |
| 2026-03-22 | scrutinise-web/components/LexChat.tsx | Fix 4 — Full rewrite: input inside scrollable container (follows conversation, not pinned to viewport). Scroll-to-bottom arrow. autoFocus on input. | Sprint 1 Fix 4 |
| 2026-03-22 | scrutinise-web/app/prototype/referral/idea/[id]/page.tsx | Fix 1 — stageBadgeStyle key Parliament → Legislate. "What is Scrutinise?" text updated. | Sprint 1 Fix 1 |
| 2026-03-22 | scrutinise-web/app/prototype/referral/user/[username]/page.tsx | Fix 1 — same as above. | Sprint 1 Fix 1 |
| 2026-03-22 | scrutinise-web/app/prototype/idea/[id]/page.tsx | Fix 5 — five-stage progress stepper added. Fix 6 — useSearchParams reads ?tab=amendments to set activeTab. stageBadgeStyle Parliament → Legislate. | Sprint 1 Fix 5 & 6 |
| 2026-03-22 | scrutinise-web/app/prototype/settings/page.tsx | Fix 7 — Collaborative as default AI mode. Radio buttons with full descriptions replacing select dropdown. | Sprint 1 Fix 7 |
| 2026-03-22 | scrutinise-web/app/page.tsx | Fix 8 — Step 3 description: "first 25 votes" removed, now "open to referral-link scrutiny". | Sprint 1 Fix 8 |
| 2026-03-22 | scrutinise-web/app/prototype/create/stage2/page.tsx | Fix 2 — STAGES array Parliament → Legislate. Fix 3 — initialFields updated to 7 correct Lex sidebar fields. | Sprint 1 Fix 2 & 3 |
| 2026-03-22 | scrutinise-web/app/prototype/notifications/page.tsx | Fix 6 — amendment notifications deep-link to /prototype/idea/[id]?tab=amendments. | Sprint 1 Fix 6 |
| 2026-03-22 | scrutinise-web/app/prototype/browse/page.tsx | stageBadgeStyle Parliament → Legislate. stages filter array updated. autoFocus on search input. | Sprint 1 session |
| 2026-03-22 | scrutinise-web/app/prototype/dashboard/page.tsx | stageBadgeStyle Parliament → Legislate. | Sprint 1 session |
| 2026-03-22 | scrutinise-web/app/prototype/page.tsx | stageBadgeStyle Parliament → Legislate. | Sprint 1 session |
| 2026-03-22 | scrutinise-web/app/prototype/profile/[username]/page.tsx | stageBadgeStyle Parliament → Legislate. | Sprint 1 session |
| 2026-03-22 | scrutinise-web/app/prototype/create/stage1/page.tsx | STAGES array Parliament → Legislate. | Sprint 1 session |
| 2026-03-22 | scrutinise-web/app/prototype/testing-guide/page.tsx | Stage progress test description updated. | Sprint 1 session |
| 2026-03-22 | scrutinise-web/app/training/page.tsx | stageBadgeColors Parliament → Legislate. stages filter array updated. | Sprint 1 session |
| 2026-03-22 | scrutinise-web/app/api/webhooks/clerk/route.ts | Task 1a — reads preferredName, ageConfirmed, tcAgreed, rulesAgreed from unsafe_metadata; writes tcAgreedAt, rulesAgreedAt, tcVersion to User on creation | Sprint 2 Task 1a |
| 2026-03-22 | scrutinise-web/middleware.ts | Task 1b — unauthenticated requests to protected routes redirect to /sign-in?redirect_url=<current>; /ideas/create and /api/ai/public added as public routes; /onboarding and /api/user added as protected; /api/webhooks/clerk moved to public (server-to-server, verified by Svix) | Sprint 2 Task 1b + production fixes |
| 2026-03-22 | scrutinise-web/app/layout.tsx | signUpFallbackRedirectUrl changed to /onboarding; signInFallbackRedirectUrl stays /prototype/dashboard | Sprint 2 Task 1b |
| 2026-03-22 | scrutinise-web/app/api/ai/[ideaId]/route.ts | completedFields variable renamed to completedFieldsSummary to fix TS2451 redeclaration; re-fetch after field updates returns boolean completedFields map to client (no field content exposed) | Sprint 2 |
| 2026-03-22 | scrutinise-web/app/api/ai/public/route.ts | New — unauthenticated Lex endpoint. In-memory IP rate limit 20/hr. Accepts message + history array. Gemini primary / Grok fallback. Returns {response, triggerSavePrompt, completedFields} boolean map. fieldUpdates stripped server-side. | Sprint 2 Priority 2 |
| 2026-03-22 | scrutinise-web/app/ideas/create/page.tsx | New — full Lex chat UI. 75/25 layout. Hardcoded opening message. Auto-expanding textarea, Enter sends, Shift+Enter newline. Voice dictation (Web Speech API, en-GB, min 44px touch target). One-time mic hint (localStorage). Progress bar 0→90%. 7-field sidebar (grey/amber/green). Scroll-to-bottom arrow. 3s debounced auto-save PATCH. File attachment UI (PDF/doc). Unauthenticated → /api/ai/public; authenticated → ensureIdea → /api/ai/[ideaId]. triggerSavePrompt → save prompt with SignInButton. | Sprint 2 Priority 2 |
| 2026-03-22 | scrutinise-web/app/onboarding/page.tsx | New — post-sign-up onboarding. preferredName input (defaults to Clerk firstName). Three required checkboxes: age 18+, T&Cs (links /terms), Community Rules (links /community-rules). PATCH /api/user/onboarding on submit → redirect to /ideas/create. | Sprint 2 Task 1a |
| 2026-03-22 | scrutinise-web/app/api/user/onboarding/route.ts | New — PATCH handler. Zod validation (all three checkboxes must be literal true). Updates preferredName, ageConfirmed, tcAgreedAt, rulesAgreedAt, tcVersion. | Sprint 2 Task 1a |
| 2026-03-22 | scrutinise-web/app/sign-in/[[...sign-in]]/page.tsx | Updated bg-black → bg-[--background] to match current design system | Sprint 2 |
| 2026-03-22 | scrutinise-web/app/sign-up/[[...sign-up]]/page.tsx | Updated bg-black → bg-[--background] to match current design system | Sprint 2 |
| 2026-03-22 | scrutinise-web/app/api/ideas/route.ts | Made summaryDescription and govtArea optional in Zod schema (both required in Prisma; populated by Lex during Stage 1). Added try/catch with structured logging around prisma.idea.create — previously an unhandled throw produced empty 500 response body ("Unexpected end of JSON input"). Both fields default to '' when absent. | Sprint 2 production fix |
| 2026-03-23 | scrutinise-web/app/api/ai/[ideaId]/route.ts | Structured logging on all failure paths. Check GEMINI_API_KEY presence before constructing client. Check GROK_API_KEY presence before fetch. Check grokRes.ok — previously 401/429 from Grok silently set lexResponse to undefined with no error returned. Track actual provider used (GEMINI_FLASH vs GROK_FAST) and log correct value in AIUsageLog. Log auth failure explicitly. | Sprint 2 production fix |
| 2026-03-23 | scrutinise-web/app/api/ai/public/route.ts | Same logging improvements as authenticated route. Explicit grokRes.ok check. Return 503 on all Grok failure paths instead of silent fallback string. | Sprint 2 production fix |
| 2026-03-23 | scrutinise-web/lib/auth.ts | JIT user sync — if clerkId not in DB (webhook missed or delayed), fetch from Clerk API and create User + CredibilityScore in transaction. Logs at each step. Falls back to 404 only if Clerk API call itself fails. Eliminates hard dependency on webhook for platform access. | Sprint 2 production fix |
| 2026-03-23 | scrutinise-web/app/api/webhooks/clerk/route.ts | Username fallback: username ?? (firstName.toLowerCase().replace(/[^a-z0-9]/g,'_') \|\| 'user') then .slice(0,20) + '_' + timestamp. Matches JIT sync pattern. Structured error logging in catch block (logs clerkId, email, generated username, Prisma error message). Info log before transaction showing what will be written. | Sprint 2 production fix |
| 2026-03-22 | scrutinise-web/prisma/schema.prisma | Created: full Prisma 7.x schema. All Sprint 1 schema changes applied: new User fields (preferredName, ageConfirmed, tcAgreedAt, rulesAgreedAt, tcVersion, politicalSpectrumX/Y, manualCredibilityOverride, aiPreferredStyle), PartyMembership, PlatformConfig, IdeaReview, Amendment counter-proposal fields, ActivityLog access fields, CredibilityScore.lexLogicScore, Idea maturity fields, CoherentAction.implementationSubQuestions, Research ResearchType enum, Group groupType MY_TEAM/COMMUNICATIONS/POLICY_DEVELOPMENT. | Sprint 1 Days 1–2 |
| 2026-03-22 | scrutinise-web/prisma.config.ts | Created: Prisma 7.x datasource config (DATABASE_URL from env, dotenv). | Sprint 1 Days 1–2 |
| 2026-03-22 | scrutinise-web/middleware.ts | Created: Clerk middleware. Protects /prototype/(.*), /api/ideas(.*), /api/ai(.*). Public routes whitelisted. | Sprint 1 Days 1–2 |
| 2026-03-22 | scrutinise-web/lib/prisma.ts | Created: Prisma client singleton. Imports from ../generated/prisma. | Sprint 1 Days 1–2 |
| 2026-03-22 | scrutinise-web/lib/auth.ts | Created: getAuthenticatedUser() helper — Clerk auth() → DB user lookup → returns {error, user}. | Sprint 1 Days 1–2 |
| 2026-03-22 | scrutinise-web/lib/stage-gates.ts | Created: checkAndAdvanceStage (Stage 1→2 auto), checkStage2to3Gate (validates gate conditions), advanceStage2to3 (STAGE_3 + LINK_ONLY + referralLinkActive). | Sprint 1 Days 3–4 |
| 2026-03-22 | scrutinise-web/lib/email.ts | Created: isEmailSuppressed(), sendCollaboratorInviteEmail() via Resend. EmailSuppression checked before every send. One-click unsubscribe on every email. | Sprint 1 Day 5 |
| 2026-03-22 | scrutinise-web/app/api/webhooks/clerk/route.ts | Created: POST handler. Svix signature verify. user.created → upsert User + create CredibilityScore. referralCode via crypto.randomUUID(). | Sprint 1 Days 1–2 |
| 2026-03-22 | scrutinise-web/app/api/ideas/route.ts | Created: POST /api/ideas — create idea at STAGE_1/PRIVATE/DRAFT. | Sprint 1 Days 3–4 |
| 2026-03-22 | scrutinise-web/app/api/ideas/[id]/route.ts | Created: GET + PATCH /api/ideas/[id]. Privacy log for admin access. checkAndAdvanceStage on PATCH. | Sprint 1 Days 3–4 |
| 2026-03-22 | scrutinise-web/app/api/ideas/[id]/progress/route.ts | Created: POST /api/ideas/[id]/progress — Stage 2→3 manual transition with gate check. | Sprint 1 Days 3–4 |
| 2026-03-22 | scrutinise-web/app/api/ai/[ideaId]/route.ts | Created: POST /api/ai/[ideaId] — Lex endpoint. Gemini 2.5 Flash primary, Grok 4.1 Fast fallback. preferredName + lexMode injection. fieldUpdates stripped from response. Rolling aiChatHistory (last 40). AIUsageLog. checkAndAdvanceStage after update. | Sprint 1 Days 3–4 |
| 2026-03-22 | scrutinise-web/app/api/ideas/[id]/collaborators/route.ts | Created: POST /api/ideas/[id]/collaborators — owner-only invite. UserInvite with magicLinkToken (32 bytes hex), 7-day expiry. Sends invite email via Resend. | Sprint 1 Day 5 |
| 2026-03-22 | scrutinise-web/app/invite/[token]/page.tsx | Created: Magic link landing page. Token validation (invalid/expired/used). If signed in with matching email → auto-accept (create IdeaCollaborator, mark invite ACCEPTED, redirect to idea). Wrong email → error. Not signed in → invite preview with sign-up/sign-in CTAs and redirect_url param. | Sprint 1 Day 5 |
| 2026-03-22 | scrutinise-web/app/unsubscribe/[token]/page.tsx | Created: Unsubscribe page. Decodes base64 email from URL. Upserts EmailSuppression record (USER_UNSUBSCRIBED). Confirmation message. | Sprint 1 Day 5 |
| 2026-03-22 | scrutinise-web/prisma/seed.ts | Created: SuperAdmin seed (cl@scrutinise.org, SUPER_ADMIN, clerkId PENDING_CLERK_LINK). CredibilityScore for SuperAdmin. PlatformConfig defaults (9 keys incl. stage display names, credibilityWeightingActive, minReviewersForStage4). | Sprint 1 Days 1–2 |
| 2026-03-22 | scrutinise-web/package.json | Added db:seed script (ts-node). Added prisma.seed config. Added ts-node devDependency. | Sprint 1 session |
| 2026-03-22 | scrutinise-web/app/layout.tsx | Added signInFallbackRedirectUrl and signUpFallbackRedirectUrl (/prototype/dashboard) to ClerkProvider. | Sprint 1 Days 1–2 |

| 2026-03-23 | scrutinise-web/prisma/schema.prisma | Sprint 3 additions: ContributionType enum (NEW_INFORMATION / RED_TEAM_CHALLENGE / MINOR_ADJUSTMENT / ADDITIONAL_COHERENT_ACTION / AMENDMENT / OTHER). Comment: commentNumber Int?, contributionType ContributionType?. Research: forAction Boolean?. | Sprint 3 |
| 2026-03-23 | scrutinise-web/middleware.ts | Sprint 3: removed /ideas(.*) from protected routes; added /ideas(.*) and /user(.*) to public routes (visibility enforced in API/page). Added public patterns for /api/ideas/(.*)/contributions(.*), /api/ideas/(.*)/research(.*), /api/users/(.*). | Sprint 3 |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/route.ts | GET updated: LINK_ONLY/PLATFORM_LISTED ideas now public (no auth required). PRIVATE ideas require auth + owner/collaborator/admin check. Creator included in response with credibility score. | Sprint 3 |
| 2026-03-23 | scrutinise-web/app/sign-in/[[...sign-in]]/page.tsx | Updated: reads redirect_url from searchParams, passes as forceRedirectUrl to Clerk <SignIn> component. Returning users now land back on originating page after sign-in. | Sprint 3 Priority 6c |
| 2026-03-23 | scrutinise-web/app/ideas/[id]/page.tsx | New — real data-driven idea detail page. Server component: fetches idea from DB, optional auth, visibility check (PRIVATE → redirect to sign-in, LINK_ONLY/PLATFORM_LISTED → public). Passes idea + isOwner + currentUserId to client component. | Sprint 3 Priority 1 |
| 2026-03-23 | scrutinise-web/app/ideas/[id]/IdeaDetailClient.tsx | New — client component for idea detail. Five-stage stepper (wired to idea.stage). Title/description/owner/date header. Stage 2 gate checklist card (owner only). Tabs: Overview / Contributions / Research / Amendments / Team. Overview: Challenge, Root Cause, Who Affected, Guiding Policy, Coherent Actions. "Take Public" button + warning modal → POST /api/ideas/[id]/progress. Referral link shown to owner after Stage 3. Vote widget absent (Stage 4+ only). | Sprint 3 Priority 1+2 |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/contributions/route.ts | New — GET (public for Stage 3+, ordered by helpfulCount DESC) and POST (auth required, Stage 3+, creates Comment with contributionType/commentNumber, notifies owner). | Sprint 3 Priority 3 |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/contributions/[commentId]/reply/route.ts | New — POST owner reply. Owner-only. Creates Comment with parentId/isOwnerReply:true. Notifies contributor. | Sprint 3 Priority 3 |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/research/route.ts | New — GET (public for Stage 3+, owner+editors at Stage 2+) and POST (owner+editors at Stage 2, any auth at Stage 3+, Google Safe Browsing check on sourceUrl). | Sprint 3 Priority 4 |
| 2026-03-23 | scrutinise-web/app/api/users/[username]/route.ts | New — GET public profile: name, bio, joinDate, credibility score, public ideas (Stage 3+ only), contribution count. | Sprint 3 Priority 5 |
| 2026-03-23 | scrutinise-web/app/user/[username]/page.tsx | New — public profile page. Profile header with avatar initials, name, username, bio, join year, contribution count, credibility score. Public ideas list (Stage 3+ only) linking to /ideas/[id]. | Sprint 3 Priority 5 |
| 2026-03-23 | scrutinise-web/lib/rateLimit.ts | New — in-memory Map-based rate limiter. checkRateLimit(key, max, windowMs). | Sprint 3 Priority 6b |
| 2026-03-23 | scrutinise-web/app/api/ai/[ideaId]/route.ts | Rate limiting applied: 50 requests/hr per authenticated userId → 429. | Sprint 3 Priority 6b |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/collaborators/route.ts | Rate limiting applied: 10 invites/day per userId → 429. | Sprint 3 Priority 6b |

| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/vote/route.ts | New — GET aggregate counts {for, against, undecided, total} + userVote if authenticated. POST upsert vote (Stage 4+ only), Zod schema direction/strength/qualityFlags, denormalised voteCount update on Idea. | Sprint 4 Priority 3 |
| 2026-03-23 | scrutinise-web/components/VoteWidget.tsx | Full rewrite: props changed to {ideaId, currentUserId}. Fetches from GET /api/ideas/[id]/vote. All hardcoded dark colours replaced with CSS design tokens. Sign-in prompt for unauthenticated users. Existing vote display with Change flow. Optimistic count updates on submit. Quality flags: "doesn't go far enough", "goes too far", "poorly worded". | Sprint 4 Priority 3 |
| 2026-03-23 | scrutinise-web/middleware.ts | /api/ideas/(.*)/vote(.*) added to public routes. | Sprint 4 Priority 3 |
| 2026-03-23 | scrutinise-web/app/prototype/idea/[id]/page.tsx | Removed VoteWidget import (props now incompatible). Replaced with placeholder div. | Sprint 4 Priority 3 |
| 2026-03-23 | scrutinise-web/app/prototype/referral/idea/[id]/page.tsx | Removed VoteWidget import (props now incompatible). Replaced with placeholder div. | Sprint 4 Priority 3 |
| 2026-03-23 | scrutinise-web/app/ideas/[id]/ContributionsTab.tsx | New — full contributions tab. ContributionCard: comment number, type badge (NEW_INFORMATION / RED_TEAM_CHALLENGE / MINOR_ADJUSTMENT / ADDITIONAL_COHERENT_ACTION / AMENDMENT / OTHER), stance badge (SUPPORTIVE / CRITICAL / NEUTRAL / QUESTION), 200-char truncation + Read more, author name + credibility score, helpful count, owner-only Reply button. ReplyForm: inline textarea, POST to .../reply. ContributionForm: content 5000 chars, contributionType select, stance select. PAGE_SIZE=10 with Show all button. Loading skeleton. onCommentAdded callback. | Sprint 4 Priority 1 |
| 2026-03-23 | scrutinise-web/app/ideas/[id]/ResearchTab.tsx | New — full research tab. ResearchCard: title, snippet, external link icon, expandable "Why is this relevant?" relevance explanation, research type badge (colour-coded), source type badge, forPolicy/forAction indicators. ResearchForm: title 200, snippet/relevance 500 each, sourceUrl with URL validation, researchType select (EVIDENCE/CASE_STUDY/CAUSES/PERSPECTIVES/OTHER), sourceType select, forOrAgainstPolicy/forOrAgainstAction radio groups (Yes/No/N/A). canAdd: owner/editors at Stage 2+, any authenticated user at Stage 3+. onResearchAdded callback. | Sprint 4 Priority 2 |
| 2026-03-23 | scrutinise-web/app/ideas/[id]/IdeaDetailClient.tsx | Updated: replaced inline ContributionsTab and ResearchTab stubs with imports of new components. VoteWidget imported and rendered only at STAGE_4/STAGE_5 (not in DOM at Stages 1–3). onResearchAdded callback updates idea.research for gate check. commentCount state tracks new contributions for tab label. | Sprint 4 Priority 1+2+3 |

| 2026-03-23 | scrutinise-web/prisma/schema.prisma | Comment model: added isInternal Boolean @default(false). Marks contributions created at Stage 2 as internal (collaborator-only). Applied via db push (no migration history). | Product decision: Stage 2 internal contributions |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/contributions/route.ts | GET: Stage 2 returns internal-only to owner/collaborators; Stage 3+ returns non-internal to public, all to owner, own internals to their authors. POST: Stage 2 requires owner/collaborator + sets isInternal:true; Stage 3+ open to any auth user. | Product decision: Stage 2 internal contributions |
| 2026-03-23 | scrutinise-web/app/ideas/[id]/ContributionsTab.tsx | STAGE_2 added to allowed stages; public pool filtered to !isInternal at Stage 3+; Internal badge (violet) on isInternal cards; empty state and pagination use filtered pool. | Product decision: Stage 2 internal contributions |
| 2026-03-23 | scrutinise-web/app/ideas/[id]/IdeaDetailClient.tsx | DevelopmentHistory section added — owner-only, renders at Stage 3+, fetches contributions and displays internal ones grouped by contributor; self-hides when none exist. | Product decision: Stage 2 internal contributions |

| 2026-03-23 | scrutinise-web/lib/stage-gates.ts | Added: checkStage3to4Gate(ideaId) — validates ≥12 unique IdeaReview records and avgQualityRating ≥ 2.5 (VIEWED=3, ENDORSED=5, BELOW_STANDARD=0). advanceStage3to4(ideaId, ownerId) — updates stage to STAGE_4, visibility to PLATFORM_LISTED, creates StageTransition record. getStage3GateData(ideaId) — returns {reviewCount, avgQualityRating} for gate checklist display. | Sprint 5 Priority 1 |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/progress/route.ts | Extended: added STAGE_3→STAGE_4 branch. Calls checkStage3to4Gate (returns 422 if blocked) then advanceStage3to4. | Sprint 5 Priority 1 |
| 2026-03-23 | scrutinise-web/app/ideas/[id]/page.tsx | IdeaReview upsert (outcome=VIEWED) for authenticated visitors at Stage 3+ — server-side, non-blocking (.catch(()=>{})). Stage 3→4 gate data fetched when Stage 3 + owner: ideaReviewCount + avgQualityRating. Both passed as new props to IdeaDetailClient. | Sprint 5 Priority 1+3 |
| 2026-03-23 | scrutinise-web/app/ideas/[id]/IdeaDetailClient.tsx | Stage3GateCard component added (shows reviewCount/12 and avgQualityRating/2.5 with CheckCircle icons). BeginCampaignModal component added (warning modal, warns voting opens + cannot be undone). Begin Campaign action button (Stage 3, owner only, disabled until gate met). stage3GateMet derived state. handleBeginCampaignSuccess sets stage to STAGE_4 + PLATFORM_LISTED. useSearchParams reads ?tab= for deep-link support. AmendmentsTab stub replaced with real import. | Sprint 5 Priority 1+2 |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/amendments/route.ts | New — GET (public for Stage 3+, returns amendments with counter-proposals) and POST (propose amendment, auth required, Stage 3+ only). Notifies idea owner via notification with linkUrl deep-linking to Amendments tab. | Sprint 5 Priority 2 |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/amendments/[amendmentId]/route.ts | New — PATCH owner action on pending amendment. Actions: accept (MODE_B), circulate (MODE_A), request_revision (sets REVISION_REQUESTED + revisionGuidance), reject (sets REJECTED + rejectionReason). Notifies amendment author on each action. Discriminated union Zod schema. | Sprint 5 Priority 2 |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/amendments/[amendmentId]/counter/route.ts | New — POST owner counter-proposal. Creates new Amendment with isCounterProposal=true, parentAmendmentId set. Notifies original proposer. Parent must be PENDING. | Sprint 5 Priority 2 |
| 2026-03-23 | scrutinise-web/app/ideas/[id]/AmendmentsTab.tsx | New — real amendments tab. ProposeAmendmentForm: section, current/proposed wording, rationale. AmendmentCard: expandable, status badge, wording diff, rationale, rejection/revision notes, counter-proposals nested. OwnerActionPanel: 5 actions (Accept Binding, Consult First, Request Revision, Counter-Propose, Reject) with inline text forms for revision/reject/counter. | Sprint 5 Priority 2 |
| 2026-03-23 | scrutinise-web/middleware.ts | /api/ideas/(.*)/amendments added to public GET routes. | Sprint 5 Priority 2 |

| 2026-03-23 | scrutinise-web/prisma/schema.prisma | Sprint 6 P0a — Added: qualityRating Int? to IdeaReview and Comment; qualityRating Int? + updatedAt to CommentRating; AlertType enum (VOTE_OPEN/STAGE_CHANGE); IdeaAlert model (userId, ideaId, alertType, @@unique[userId,ideaId,alertType]); IdeaAlert relations on User and Idea. Removed: helpfulCount/notHelpfulCount from Comment. Group: added ideaId optional + relation to Idea + stageTransitionRequests. Added StageTransitionRequest model (ideaId, groupId, requestedByUserId, fromStage, toStage, status). | Sprint 6 P0a |
| 2026-03-23 | scrutinise-web/app/ideas/[id]/ContributionsTab.tsx | Sprint 6 P0a — Removed helpfulCount/notHelpfulCount from Contribution type; replaced helpful count display with QualityRating component per contribution card (calls POST .../rate). Added QualityRating import. | Sprint 6 P0a+P0c |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/contributions/route.ts | Sprint 6 P0a — Removed helpfulCount from orderBy (now orderBy createdAt asc). | Sprint 6 P0a |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/reviews/route.ts | New — POST /api/ideas/[id]/reviews. Auth required, Stage 3+. Upserts IdeaReview for current user with qualityRating 1–5. Creates VIEWED outcome if no existing record. | Sprint 6 P0b |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/contributions/[commentId]/rate/route.ts | New — POST /api/ideas/[id]/contributions/[commentId]/rate. Auth required. Upserts CommentRating.qualityRating 1–5. Recalculates and denormalises avg back to Comment.qualityRating. | Sprint 6 P0b |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/alerts/route.ts | New — POST /api/ideas/[id]/alerts. Auth required, Stage 2+. Upserts IdeaAlert (VOTE_OPEN or STAGE_CHANGE). | Sprint 6 P0b |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/alerts/[alertType]/route.ts | New — DELETE /api/ideas/[id]/alerts/[alertType]. Auth required. Removes IdeaAlert for current user. | Sprint 6 P0b |
| 2026-03-23 | scrutinise-web/components/QualityRating.tsx | New — shared QualityRating component. Idle: thumbs-up icon (muted if unrated, filled if rated) + avg beside it. Expanded: 1–5 slider with labelMin/labelMax, promptText. Submits on slider release or Confirm. | Sprint 6 P0c |
| 2026-03-23 | scrutinise-web/components/VoteInterceptModal.tsx | New — VoteInterceptModal. Shown at Stage 2/3 when any vote-related element is clicked. Offers VOTE_OPEN notification subscription via POST .../alerts. YES → subscribe + confirm. NO → dismiss. | Sprint 6 P0c |
| 2026-03-23 | scrutinise-web/app/ideas/[id]/IdeaDetailClient.tsx | Sprint 6 P0c/P1/P2/P3 — Added: QualityRating + VoteInterceptModal imports. VoteInterceptModal shown at Stage 2/3 on vote area click. Vote intercept banner at Stage 2/3. QualityRating for idea argument quality (Stage 3+, authenticated). Stage4GateCard (3 MP / 3 Peer / 1 Draftsman / all wording). SubmitToParliamentModal. Submit to Parliament action button (Stage 4, owner). stage4GateMet derived state. handleSubmitToParliamentSuccess. EndorsementPanel: fetches + displays MP/Peer/Draftsman endorsements; Endorse + Below Standard buttons for MPs/Peers/manualCredibilityOverride. TeamTab: full rewrite with real group data — Core Team collaborators + MY_TEAM/COMMUNICATIONS/POLICY_DEVELOPMENT group CRUD. | Sprint 6 P0c+P1+P2+P3 |
| 2026-03-23 | scrutinise-web/app/ideas/[id]/page.tsx | Sprint 6 P1/P2 — Added stage4GateData fetch (getStage4GateData, owner-only Stage 4). Added currentUserCanEndorse detection (MP/Peer/manualCredibilityOverride). Both passed as new props to IdeaDetailClient. | Sprint 6 P1+P2 |
| 2026-03-23 | scrutinise-web/lib/stage-gates.ts | Sprint 6 P1 — Added: checkStage4to5Gate (≥3 MP, ≥3 Peer endorsements, ≥1 DraftsmanEndorsement, all proposedWording complete). getStage4GateData (returns mpCount/peerCount/draftsmanCount/wordingComplete). advanceStage4to5 (STAGE_5 + PLATFORM_LISTED + StageTransition + notifies all STAGE_CHANGE IdeaAlert holders). | Sprint 6 P1 |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/progress/route.ts | Sprint 6 P1 — Extended: added STAGE_4→STAGE_5 branch. Calls checkStage4to5Gate then advanceStage4to5. | Sprint 6 P1 |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/endorsements/route.ts | New — GET public endorsements list. POST create endorsement (MP/Peer/manualCredibilityOverride only, Stage 4+). action=BELOW_STANDARD creates IdeaReview(BELOW_STANDARD). Unique constraint enforced (P2002 → 409). | Sprint 6 P2 |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/endorsements/[endorsementId]/route.ts | New — DELETE withdraw endorsement. Endorser-only. Updates status=WITHDRAWN, decrements endorsementCount. | Sprint 6 P2 |
| 2026-03-23 | scrutinise-web/middleware.ts | Sprint 6 — /api/ideas/(.*)/endorsements added to public GET routes. | Sprint 6 P2 |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/groups/route.ts | New — GET (owner/collaborators only) + POST (owner only) idea-scoped groups. | Sprint 6 P3 |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/groups/[groupId]/members/route.ts | New — POST add member to group. Owner only. | Sprint 6 P3 |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/groups/[groupId]/members/[userId]/route.ts | New — DELETE remove member from group. Owner or self. | Sprint 6 P3 |

| 2026-03-23 | scrutinise-web/prisma/schema.prisma | Sprint 7 — Added draftsmanEndorsementCount Int @default(0) to Idea. Added draftsmanName String? and organisation String? to DraftsmanEndorsement. Made DraftsmanEndorsement.draftsmanUserId optional (String?). | Sprint 7 P1 |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/endorsements/draftsman/route.ts | New — POST /api/ideas/[id]/endorsements/draftsman. Owner-only. Stage 4+. One per idea (409 on duplicate). Body: { draftsmanName, organisation, qualifications, statement }. Creates DraftsmanEndorsement, increments idea.draftsmanEndorsementCount. | Sprint 7 P1 |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/endorsements/route.ts | Sprint 7 — Updated GET to include draftsmanName and organisation in draftsman endorsement select. | Sprint 7 P1 |
| 2026-03-23 | scrutinise-web/app/ideas/[id]/IdeaDetailClient.tsx | Sprint 7 — Updated DraftsmanRecord interface (draftsmanName, organisation, draftsman nullable). Added DraftsmanEndorsementForm to EndorsementPanel (owner-only, Stage 4+, hidden once submitted). Added privacy-log Tab type and tab entry (owner-only). Added PrivacyLogTab component (green banner if no records; amber banners per event showing accessor first+initial, date, reason). | Sprint 7 P1+P2 |
| 2026-03-23 | scrutinise-web/app/api/ideas/[id]/privacy-log/route.ts | New — GET /api/ideas/[id]/privacy-log. Owner-only. Returns ActivityLog records where accessType=ADMIN_ACCESS for this idea, ordered createdAt DESC. Resolves accessedByUserId to first name + last initial only. | Sprint 7 P2 |
| 2026-03-23 | scrutinise-web/app/admin/layout.tsx | New — Admin layout. Server component. Auth guard: redirects to /sign-in if not authenticated; redirects to /dashboard if not ADMIN or SUPER_ADMIN. | Sprint 7 P3 |
| 2026-03-23 | scrutinise-web/app/admin/page.tsx | New — Admin panel page. Client component with three sections: (a) Content Reports — lists ContentReport records PENDING first; Dismiss/Hide/Remove/Warn actions via PATCH; (b) Users — paginated user list with inline role dropdown; (c) Platform Config — SUPER_ADMIN only, toggle/number inputs for credibilityWeightingActive, peerReviewRequired, minReviewersForStage4, minRatingForStage4. | Sprint 7 P3 |
| 2026-03-23 | scrutinise-web/app/api/admin/reports/route.ts | New — GET /api/admin/reports. Admin+. Lists ContentReport records PENDING first, then createdAt DESC. Returns reporter, content owner, reported content snippet, reason, status. | Sprint 7 P3a |
| 2026-03-23 | scrutinise-web/app/api/admin/reports/[reportId]/route.ts | New — PATCH /api/admin/reports/[reportId]. Admin+. Actions: DISMISS→DISMISSED, HIDE/REMOVE/WARN→ACTION_TAKEN. Creates notification for content owner (except DISMISS). HIDE also archives idea. | Sprint 7 P3a |
| 2026-03-23 | scrutinise-web/app/api/admin/users/route.ts | New — GET /api/admin/users. Admin+. Paginated (page + limit). Returns name, email, role, status, joinDate, credibilityScore, ideaCount. | Sprint 7 P3b |
| 2026-03-23 | scrutinise-web/app/api/admin/users/[userId]/role/route.ts | New — PATCH /api/admin/users/[userId]/role. SUPER_ADMIN can set any role; ADMIN can set CITIZEN or MODERATOR only. Logs to ActivityLog. | Sprint 7 P3b |
| 2026-03-23 | scrutinise-web/app/api/admin/config/route.ts | New — GET /api/admin/config (Admin+) and PATCH (SUPER_ADMIN only). Manages PlatformConfig keys: credibilityWeightingActive, peerReviewRequired, minReviewersForStage4, minRatingForStage4. Changes logged to ActivityLog. | Sprint 7 P3c |
| 2026-03-23 | scrutinise-web/middleware.ts | Sprint 7 — Added /admin(.*) and /api/admin(.*) to protected routes (Clerk session required). | Sprint 7 P3 |

---

*CHANGE_LOG.md — Scrutinise — March 2026*
*PENDING entries are cleared after batch application.*
*APPLIED entries are never deleted — this is the audit trail.*
