# Summary: AI Integration Design & Voting System Refinement

**First Claude reply:** 25-02-26  
**Last Claude reply:** 05-03-26  
**Total replies:** \~13

***

## Build Stage

Pre-development specification finalisation — this conversation extended and deepened the voting system design, and introduced the full AI integration architecture as a core platform specification. Output feeds directly into the entity list, system mechanics document, and the Lex system prompt before the 4-week build sprint begins.

***

## Areas Covered

The conversation began as a continuation of the wireframe audit decisions, with the user providing answers to outstanding questions from the previous session. It evolved into a major design session covering two substantial areas:

**1. Voting system refinement** — the 3-way vote + strength slider design was confirmed and extended with idea-quality feedback mechanics, owner analytics, and a public passion score display.

**2. AI integration architecture** — the most significant output of this conversation. Claude proposed and the user confirmed that AI (Lex) should function as the *primary interface* for idea development through guided Socratic dialogue, rather than as a supplementary tool alongside a traditional form. This is a central architectural decision. A full AI Integration specification was drafted covering provider assignment, context management, guided field completion, navigation model, agent architecture, and schema additions.

Additional topics: V2 feature planning (training page, marketing/campaign support), business model structure (CIC vs charity), and multi-agent architecture deferral to V1.1.

***

## Decisions Made

### Voting System

1.  **3-way voting confirmed** — For / Against / Undecided, with a 0–5 strength/certainty slider. This matches the previous conversation's decision and is now fully specified with UI copy.
2.  **Idea-quality feedback on vote page confirmed** — checkboxes as specified in the wireframe audit conversation, plus Undecided-specific options. This is an additive UX enhancement, not a separate voting dimension.
3.  **Public passion score** — average strength/certainty score is visible publicly on idea pages. Idea owners can drill into the distribution breakdown. This is a public-facing display, not just internal analytics.
4.  **Owner analytics for votes** — owners can export voter distribution data for group creation and messaging purposes. Exportable data to be included in the entity/schema design.

### AI Integration Architecture

5.  **AI (Lex) is the primary interface for idea development** — users do not fill out fields directly. Lex conducts a Socratic conversation that populates fields silently in the background. The form is the data structure; the experience is conversation.
6.  **Provider assignment locked at Idea level** — not session level. When an idea is created, one provider is assigned and never changed for the lifetime of that idea, ensuring context continuity across sessions.
7.  **Default provider: Gemini 2.5 Flash** — assigned as primary (free tier headroom checked first). Fallback: Grok 4.1 Fast. Both at \~\$0.003/session, making 10,000 sessions cost \~\$30.
8.  **Provider assignment logic:**
    -   Check Gemini daily free tier headroom
    -   If available → assign Gemini (record `aiProvider = 'gemini-flash'`)
    -   If exhausted → assign Grok (record `aiProvider = 'grok-fast'`)
    -   If both paid → assign Gemini (cheaper)
    -   Assignment stored on Idea record and never changed
9.  **Sliding window with summary for context management** — last 20 messages of chat history sent with each API call. Older history compressed by AI into a `chatSummary` field stored on the Idea record. This is standard "sliding window with summary" architecture.
10. **Bring-your-own-key model deferred to V1.1** — power users will be able to connect their own API key (Anthropic, OpenAI, xAI) via Settings. Personal key takes precedence over platform-funded AI. User sees a "Powered by Claude / GPT-4o" badge. Not in MVP scope.
11. **Navigation model for guided field completion** — completed fields visible above as a live document panel; unfilled fields ahead are hidden until reached. Users can scroll back to review and edit completed fields at any time.
12. **Single-agent MVP, multi-agent V1.1** — all AI roles (Socratic guide, grammar advisor, researcher, political realist) folded into one system prompt for MVP. Claude recommended against multi-agent architecture for MVP due to added complexity and unpredictability. Multi-agent split confirmed for V1.1 (Guide, Research, Review, Political agents).
13. **"Refine Answer" (WF-11)** — confirmed: triggers Lex to review a completed field directly and suggest improvements on demand.

### Schema Additions

14. **New fields on** `Idea` **entity:**
    -   `aiProvider` (Enum: GEMINI_FLASH / GROK_FAST / USER_CLAUDE / USER_GPT4O / USER_GROK)
    -   `aiChatHistory` (JSON array: {role, content, timestamp}, last 20 messages)
    -   `aiChatSummary` (Text, AI-generated compression of older history, nullable)
    -   `aiCurrentField` (String, which field Lex is currently working on)
    -   `aiSessionCount` (Integer)
15. **New entity:** `UserAIKey` — for V1.1 bring-your-own-key. Fields: id, userId (FK), provider (Enum), encryptedKey (AES-256), isActive, createdAt.
16. **New entity:** `AIUsageLog` — tracks token consumption per API call for cost monitoring and future credit billing. Fields: id, ideaId (FK), userId (FK), provider (Enum), inputTokens, outputTokens, costUSD (Decimal 8,6), fieldTarget, createdAt.
17. **Training entity fields confirmed** — id, title, type (video/article/podcast), governmentCategory, areaOfTraining, author, duration, url, rating (0–5). No formal course structure for MVP — YouTube links only. Tags for stage, topic, and difficulty to be supported from day one.
18. **Follow/Watch entity added** — single `Follow` entity handles both "follow a user" and "watch an idea." Fields: id, followerId (FK User), followedUserId (FK User, nullable), watchedIdeaId (FK Idea, nullable), createdAt. Generates alerts on idea stage changes, new comments, amendments.
19. **Country field added** — to be added to relevant entities in anticipation of international expansion.

### Business & Structure

20. **CIC (Community Interest Company) recommended** over charity structure — allows trading income and reasonable salary, fewer restrictions. User to discuss with accountant before public launch.
21. **Marketing/campaign support confirmed as external service** — separate from Scrutinise, no platform integration. Scrutinise must never recommend or reference the external company. Reputation mechanics must have no pathway to being influenced by external commercial relationships.
22. **Training page as potential education business** — YouTube embeds for V1, organised/filtered content as V2. Paid course model (£49–£99) identified as viable long-term revenue. Architecture to support this from day one.

***

## Issues Discussed But Not Concluded

-   **WF-64** — still unresolved from the previous conversation. Not addressed in this session either.
-   **Lex system prompt** — the document `01_Lex_System_Prompt_v2` exists and is the primary input for production Lex integration. The conversation confirmed that a full system prompt incorporating values from the vision document needs to be written before the build. The spec was drafted here but the final compiled prompt was not confirmed as complete.
-   **Amendment consultation (Mode A)** — deferred to V1.1. Architecture implications not fully explored.
-   **Full Coherent Action entity model update** — confirmed needed but not completed within this conversation. Touches Idea, CoherentAction, Vote, Amendment, and Wording entities.
-   **Lex AI agent framework selection** — Claude noted that Claude, Gemini, and Grok all support different function-calling / tool-use formats. The exact implementation of guided field completion (how Lex signals that a field is complete and triggers the background save) was specified architecturally but not at code level.
-   **Cost monitoring thresholds** — `AIUsageLog` entity created, but no alert thresholds or cost cap logic was defined. This is an operational decision to make before launch.
