# Scrutinise — Session Handover

*Produced by CCh — 16 April 2026* *For continuation in a new conversation. Attach handoff_summary.md (v25) alongside this document.*

***

## CURRENT STATE

Sprint V2-D is complete and deployed. The build is clean on Main. The platform is live at scrutinise.org.

***

## IMMEDIATE TASKS — COMPLETE BEFORE MOVING ON

### 1. Remove debug code from mobile panel

The yellow `fieldValues` debug block and the temporary "← Back to Chat" button added in commit `V2D-debug2` must be removed now that diagnosis is confirmed. Send this to CC:

>   In `app/ideas/create/CreateIdeaClient.tsx`, inside the `MobileSidebarContent` function, remove:

>   The `{/* TEMPORARY DEBUG */}` yellow div block

>   The `{/* TEMPORARY BACK BUTTON */}` div

>   The `onClose` prop (remove from both the function signature and the call site)

>   Keep the permanent "← Back to chat" text button that was already in the panel header. Run `tsc --noEmit`, produce `commit-all.sh`, execute, delete. Commit: `fix: remove V2D debug blocks from mobile panel (V2D-cleanup)`

### 2. Confirm mobile sidebar diagnosis

The debug screenshot (Reply 60) confirmed:

-   `fieldValues` IS arriving in `MobileSidebarContent` with correct data
-   The Diagnosis section shows empty because the test idea genuinely has no Diagnosis fields filled yet — the idea only has Guiding Policy and Coherent Actions data
-   The mobile sidebar is therefore working correctly — it shows what exists

**Action:** Test on a fresh idea where you fill Diagnosis fields via Lex on mobile. The Diagnosis section should then show content. No further code changes needed for field display.

### 3. Confirm mobile swipe

The swipe handlers were updated in V2D-fix9 (80px threshold, direction ratio check, attached to toolbar and panel header). The `onClose` button now works as a reliable fallback. Test whether the swipe is now reliable after the reboot — CC's environment issues after the reboot may have caused some changes not to land correctly.

***

## LEGISLATION MODULE — NEXT SPRINT (V2-E)

### Architecture question: download first, then process?

**Short answer: yes, download raw CLML XML into R2 first, then process separately.**

This is the right architecture for three reasons:

1.  **Cost control** — AI compilation costs money per section. If a compilation run fails or produces poor quality, you want to reprocess without re-fetching. Separating fetch from compile means you pay the network cost once and the AI cost only when needed.
2.  **Rate limiting** — legislation.gov.uk will rate-limit aggressive fetching. A separate ingestion pass with delays is easier to manage than a combined fetch+compile pipeline.
3.  **Reprocessing** — as better AI models emerge, you'll want to recompile sections with improved prompts. Having the raw XML stored means you can do this without hitting legislation.gov.uk again.

**The pipeline is:**

```
legislation.gov.uk → ingest.ts → R2 (raw CLML XML) → compile.ts → PostgreSQL (compiled text + metadata)
```

Both scripts exist in `scripts/legislation/`. The R2 bucket `scrutinise-legislation` was created in Cloudflare.

**To start:** Run `ingest.ts` with `slice(0, 5)` to test on 5 Acts first. Confirm sections land in the DB, then run `compile.ts` on those 5 to check compilation quality before committing to the full batch.

### Indexing and categorisation for Lex

Before running the full compilation, design the metadata layer that will make legislation searchable and usable by Lex. The following should be built as part of V2-E:

**Full-text search index**

Add a PostgreSQL full-text search index on `LegislationSection.compiledText` and `LegislationSection.sectionTitle`. This enables Lex to search for relevant sections by keyword when a user's idea mentions a specific concept.

```sql
CREATE INDEX legislation_section_fts ON "LegislationSection" 
USING gin(to_tsvector('english', coalesce(compiled_text, '') || ' ' || coalesce(section_title, '')));
```

Add this as a Prisma `@@index` with `type: GinIndex` or add it via a raw migration.

**Subject area tagging**

During compilation, extract and store subject area tags per section. Add a `tags` field (`String[]`) to `LegislationSection`. The compilation prompt should be extended to also return a `tags` array: `["housing", "tenancy", "landlord", "eviction"]`. These tags enable filtering by policy area.

**Amendment count and complexity score**

Store `amendmentCount` (Int) on `LegislationSection`. Sections with many amendments are more likely to be policy-active areas. A complexity score (1-5, derived from amendment count and confidence) helps Lex prioritise which sections to surface.

**Jurisdiction and commencement status flags**

`LegislationSection.jurisdiction` (UK / Scotland / Wales / NI) and `LegislationSection.inForce` (Boolean) are essential for filtering. An idea scoped to England-only should not surface Scottish-only provisions.

**Cross-reference relationships**

When compiling, Lex identifies that section X amends section Y. Store these as `LegislationCrossRef` records: `{sourceItemId, sourceSectionId, targetItemId, targetSectionId, crossRefType}`. This enables graph-style queries: "show me everything that amends the Housing Act 1988 s.21."

**Act-level subject classification**

Add `subjectArea` (String) and `policyArea` (String) to `LegislationItem`. Populated during ingestion from the Act's metadata on legislation.gov.uk (the CLML feed includes subject classification). Enables "show me all housing legislation" queries.

**The Lex integration (V2-E core work)**

When a user's idea reaches Stage 2, Lex should:

1.  At the start of the Guiding Policy section, run a background search of `LegislationSection` using keywords from the idea's `summaryDiagnosis`
2.  Surface the top 3 most relevant sections inline: "I found some legislation that might be relevant — do you want me to look at this?"
3.  If the user says yes, include the compiled section text in Lex's context window for subsequent exchanges
4.  When Lex proposes wording for `proposedWording`, it should cite the relevant sections it has referenced

API route: `POST /api/ideas/[id]/legislation-search` — takes `query` string, returns top 5 ranked `LegislationSection` records with their parent `LegislationItem` metadata.

Ranking: PostgreSQL full-text search score × (1 / (1 + amendmentCount)) to favour clean, simpler sections over heavily amended ones.

***

## BUGS / KNOWN ISSUES

| Issue                                    | Status           | Notes                                                 |
|------------------------------------------|------------------|-------------------------------------------------------|
| proposal card collapses on window switch | Known            | React state reset on component unmount — low priority |
| `[V2D-DEBUG]` logs still in Vercel       | Cleanup needed   | Remove in V2D-cleanup commit                          |
| Mobile swipe reliability                 | Testing needed   | fix9 deployed, needs re-testing after reboot          |
| `commit-all.sh` pattern                  | Working          | CC reading CLAUDE.md correctly now                    |
| Gemini model string                      | Fixed (V2D-fix5) | `gemini-2.5-flash` confirmed 200                      |
| Legislation `/legislation-compare`       | Live             | Needs Together AI key for Llama 4 Maverick            |

***

## POINTS / CREDIBILITY

The credibility backfill returned 0 records (no Reputation records exist). Points will start accruing from V2-B onwards on new user actions. No further action needed.

***

## INFRASTRUCTURE STATUS

| Item                        | Status                         |
|-----------------------------|--------------------------------|
| Vercel (Hobby)              | Live, streaming solves timeout |
| Railway PostgreSQL          | Live                           |
| Clerk auth                  | Live                           |
| R2 `scrutinise-uploads`     | Live                           |
| R2 `scrutinise-profiles`    | Live                           |
| R2 `scrutinise-legislation` | Created, empty                 |
| Gemini 2.5 Flash            | Live, model fixed              |
| Grok fallback               | Live                           |
| Sentry                      | Live                           |
| Resend email                | Live                           |

***

## NEXT SPRINT: V2-E

After V2-D cleanup, V2-E covers:

1.  Legislation ingestion — run `ingest.ts` against Tier 1 Acts (start slice 0–5)
2.  Add full-text search index and subject tagging to schema
3.  Legislation compilation — run `compile.ts` on ingested sections
4.  Lex context injection — `POST /api/ideas/[id]/legislation-search`, inject top 3 results into Lex's system prompt at Stage 2
5.  Correction flow UI — "Suggest a correction" form on `/legislation/[itemId]` section cards

***

## KEY DOCUMENT LOCATIONS

| Document              | Location                                            |
|-----------------------|-----------------------------------------------------|
| Handoff summary       | `scrutinise-docs/handoff_summary.md` (v25)          |
| CLAUDE.md             | `scrutinise-docs/CLAUDE.md`                         |
| Entity list           | `scrutinise-docs/entity_list_v5.md`                 |
| System mechanics      | `scrutinise-docs/system_mechanics_v0_8.md`          |
| CHANGE_LOG            | `scrutinise-docs/CHANGE_LOG.md`                     |
| Legislation DB design | `Scrutinise_LegislationDB_Design_v2_23Mar2026.docx` |
| Ingestion script      | `scripts/legislation/ingest.ts`                     |
| Compilation script    | `scripts/legislation/compile.ts`                    |

***

*End of handover — 16 April 2026*
