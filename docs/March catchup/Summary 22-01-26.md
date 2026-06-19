# Summary 22-01-26.md

## Conversation Metadata

-   **First Reply:** Reply \#23; 22-01-26; 17:15
-   **Last Reply:** Reply \#27; 22-01-26; 18:30
-   **Total Replies:** 5
-   **Conversation Title:** Architecture Review, Security Analysis & 4-Week Build Plan
-   **Build Stage:** Pre-Build Planning & Preparation (Week 0)

***

## Areas Covered

### 1. Architecture & Database Review

-   Complete gap analysis between wireframes and existing Prisma schema
-   Identification of 10 missing database models needed for wireframe functionality
-   Comprehensive entity and field list across 25 total entities
-   Updated Idea entity structure incorporating Strategic Kernel framework

### 2. Security Analysis

-   Top 10 security risks and mitigation strategies
-   Explanation of where security lives in the architecture (not in Prisma schema)
-   6-layer security model: Authentication, Authorization, Input Validation, Rate Limiting, Database Security, Content Security
-   Pre-build security checklist with 21 items

### 3. Cost & Time Analysis

-   Detailed comparison of Claude Code vs. manual copy-paste approach
-   Three implementation options analyzed: Pure Claude Code (\$200), Pure Copy-Paste (\$20), Hybrid (\$120)
-   Time estimates: Pure Claude Code (3-4 weeks), Pure Copy-Paste (5-6 weeks), Hybrid (3-4 weeks)
-   Token usage calculations and subscription tier recommendations

### 4. 4-Week Build Plan

-   Week-by-week execution plan with specific prompts for Claude Code vs. Claude.ai
-   Day-by-day task breakdown with time estimates
-   Strategic subscription management (upgrade to Max 5x for Weeks 1-3, downgrade for Week 4)
-   Decision gates at end of each week to evaluate progress

### 5. Data Modeling Refinement

-   Updated User entity with political party, donations, business affiliation, friends
-   New entities: CoherentAction, TargetOrganisation, Situation
-   Expanded TargetLegislation with jurisdiction, draft history, change tracking
-   Enhanced Research entity with for/against policy tracking
-   Improved Comment entity with suggested changes and attached references

***

## Key Decisions Made

### Architecture Decisions

1.  **Add 10 Missing Models to Schema:**
    -   CommentRating (5-star rating system for comments)
    -   MPEndorsement (Parliament Ready stage endorsements)
    -   ParliamentaryProgress (committee tracking, bill status)
    -   ContentReport (moderation queue system)
    -   AIUsageLog (detailed AI cost tracking)
    -   GroupMessage (group admin messaging)
    -   ActivityLog (comprehensive user activity tracking)
    -   WhatsAppIntegration (group synchronization)
    -   GroupInvite (invite link management)
    -   Anonymous vote handling in Vote model
2.  **Strategic Kernel Framework Integrated:**
    -   Idea entity expanded with Obstacle, Guiding Policy, Coherent Actions structure
    -   CoherentAction as separate entity (one Idea → many Actions)
    -   Each action includes: cost-benefit analysis, risks, opposition analysis, execution plan
3.  **Separate TargetLegislation from TargetOrganisation:**
    -   Different workflows and field requirements
    -   One idea can target both legislation AND organizational change

### Build Approach Decisions

4.  **HYBRID BUILD APPROACH (Recommended):**
    -   Total Cost: \$120 (Max 5x for 1 month + existing Pro)
    -   Total Time: 3-4 weeks
    -   Use Claude Code for: complex multi-file changes, integration, testing, debugging
    -   Use Claude.ai for: planning, individual components, documentation, quick fixes
5.  **Subscription Strategy:**
    -   Week 0: Use Claude.ai Pro (already paying \$20/month)
    -   Weeks 1-3: Upgrade to Claude Max 5x (\$100/month)
    -   Week 4+: Downgrade back to Pro (\$20/month)
6.  **UK Legislation Repository: NOT for MVP**
    -   Significant technical complexity
    -   Value unproven until platform has users
    -   Can be added in v2.0 without changing core architecture
    -   MVP approach: Simple URL links to legislation.gov.uk with manual references
7.  **Design Approach: shadcn/ui for MVP**
    -   Use shadcn/ui component library (professional, accessible, free)
    -   Focus on functionality over aesthetics for MVP
    -   Saves £10-30k in design costs
    -   Hire designer after launch for rebrand if needed

### Data Field Strategy

8.  **Start Simple, Add Fields Later:**
    -   Begin with core fields only for MVP
    -   All new fields should be optional (nullable) to avoid migration issues
    -   Prisma migrations make adding fields easy (3-step process)
    -   Evolve schema based on real user needs, not speculation

***

## Pre-Build Action Items

### Immediate (Before Week 1)

-   [ ] Update Prisma schema with all 10 missing models
-   [ ] Show wireframes to 5-10 potential users for testing
-   [ ] Document authorization rules for each model
-   [ ] Plan input validation schemas (Zod) for all endpoints
-   [ ] Design rate limiting strategy
-   [ ] Set up audit logging requirements
-   [ ] Draft Privacy Policy and Terms of Service
-   [ ] Decide on data storage location (UK/EU/US)
-   [ ] GDPR compliance check
-   [ ] Define ruthless MVP scope and lock it down

### Week 0 Tasks (Use Claude.ai)

-   [ ] Finalize database schema with all entities
-   [ ] Design complete API route structure
-   [ ] Create security requirements document
-   [ ] Plan frontend component hierarchy
-   [ ] Conduct user testing and gather feedback
-   [ ] Create locked MVP scope document
-   [ ] Generate build order master plan

***

## Educational Content (No Decisions Required)

### Understanding Prisma Schema

-   **What it is:** Database blueprint written in readable code
-   **Models = Drawers:** Each model is a drawer with specific compartments
-   **Fields = Labels:** Each field is a compartment label with data type
-   **What to look for when reviewing:**
    1.  Is every "thing" in wireframes represented?
    2.  Are relationships clear (one-to-many, many-to-many)?
    3.  Are field types correct (String/Int/DateTime/Decimal)?
    4.  Are there indexes for searches?
    5.  Are defaults sensible?

### Where Security Lives

Security is NOT in Prisma schema - it's implemented across 6 layers:

1.  **Authentication:** Clerk (already implemented)
2.  **Authorization:** API route checks (to be built)
3.  **Input Validation:** Zod schemas (to be built)
4.  **Rate Limiting:** Middleware (to be built)
5.  **Database Security:** Environment variables, SSL, no direct access
6.  **Content Security:** XSS/CSRF/SQL injection protection (to be built)

### Top 10 Security Risks Explained

1.  **Injection Attacks:** Malicious code in inputs (Prisma prevents SQL injection automatically)
2.  **Broken Authentication:** Users bypass login (Clerk handles, add session timeout)
3.  **Broken Access Control:** Users access data they shouldn't (check permissions on every route)
4.  **Sensitive Data Exposure:** Personal data in logs/errors (never log emails/IPs/passwords)
5.  **Cross-Site Scripting (XSS):** Malicious JavaScript in comments (use DOMPurify to sanitize)
6.  **CSRF Attacks:** Tricked requests (check origin headers, use CSRF tokens)
7.  **Insecure Deserialization:** Malicious JSON data (validate with Zod, never use eval())
8.  **Insufficient Logging:** Attacks go unnoticed (log all security events)
9.  **SSRF Attacks:** Server requests internal resources (whitelist allowed domains)
10. **Denial of Service:** Overwhelm server (rate limiting: 100 votes/hour per user)

### Claude Code vs. Claude.ai Usage Patterns

**Claude Code excels at:**

-   Multi-file refactoring (touches 15 files at once)
-   Debugging integration issues (examines auth + API + database together)
-   Writing comprehensive tests (creates test files, fixtures, runs tests)
-   Complex business logic (understands context across multiple models)

**Claude.ai excels at:**

-   Individual components (single clear output to paste)
-   Template/boilerplate code (easy to adapt)
-   Explanation and planning (free consultation)
-   Documentation (pure text, easy to paste)

**When copy-paste makes sense:**

-   ✅ Individual React components
-   ✅ Utility functions
-   ✅ Type definitions
-   ✅ Single API routes (once pattern established)

**When copy-paste is painful:**

-   ❌ Changes spanning multiple files
-   ❌ Database migrations (risky to get wrong)
-   ❌ Integration between layers
-   ❌ Debugging errors across the stack

### Cost-Benefit Math

**Time Value Calculation:**

-   Pure copy-paste: Saves £100-180 in subscription costs
-   But costs 50-65 hours of tedious manual work
-   At £30/hour: Costs £1,500 of your time
-   At £50/hour: Costs £2,500 of your time
-   **Conclusion:** Spending £100 to save 50 hours is excellent ROI

### UK Legislation Repository Benefits (Future v2.0)

If built later, would provide:

1.  **Faster Search:** Query your own database vs. hitting legislation.gov.uk
2.  **Consolidated Text:** Automatically apply amendments to show current version
3.  **AI Integration:** Claude can cite specific clauses and suggest amendments
4.  **Conflict Detection:** "Warning: Your proposal conflicts with Education Act 2011"
5.  **Amendment Tracking:** Full history of how laws changed over time

***

## Open Questions / Future Considerations

### For Later Discussion

1.  **AI Integration Scope for MVP:**
    -   How many Stage 1 questions? (All 15 or start with 3-5?)
    -   Which AI provider for MVP? (Anthropic, OpenAI, both?)
    -   Store full AI conversation history or just results?
2.  **Comment System Scope:**
    -   Full threading (replies to replies) or single-level?
    -   5-star rating system now or later?
    -   Client-side or server-side sorting?
3.  **Groups Feature Scope:**
    -   Just create/view or also invites and member management?
    -   Group ideas and messaging in MVP?
    -   WhatsApp integration priority?
4.  **Amendment System Complexity:**
    -   Just propose amendments or also accept/reject?
    -   Full version control and forking?
    -   How to handle vote inheritance when amendments accepted?
5.  **Testing Strategy:**
    -   Unit tests for business logic (priority?)
    -   Integration tests for API routes (how comprehensive?)
    -   E2E tests for critical flows only or broader coverage?
6.  **Deployment & Infrastructure:**
    -   Staging environment setup (Railway? Vercel preview?)
    -   Database backup strategy (nightly? continuous?)
    -   Error monitoring service (Sentry? LogRocket?)
    -   CDN for static assets?

### Not Discussed in Detail (May Need Future Exploration)

-   Email notification system (SendGrid? AWS SES?)
-   File upload handling (PDFs, evidence documents)
-   Image handling (user avatars, idea images)
-   Export functionality (PDF generation of ideas)
-   Mobile app considerations
-   Internationalization/localization
-   Analytics and metrics tracking
-   A/B testing framework
-   Performance monitoring
-   SEO optimization
-   Social media integration
-   Payment processing for donations

***

## Documents Generated This Session

1.  **architecture_review.md** - Complete gap analysis between wireframes and schema
2.  **security_analysis.md** - Top 10 security risks with mitigation code examples
3.  **build_readiness.md** - Data fields flexibility, UK law analysis, pre-build checks
4.  **cost_comparison.md** - Detailed cost/time analysis of build approaches
5.  **4_week_build_plan.md** - Day-by-day execution plan with exact prompts
6.  **complete_entity_list.md** - All 25 entities with all fields listed

***

## Next Session Starting Points

### Immediate Next Steps (Week 0 Continues)

1.  Review and approve complete entity list (25 entities)
2.  Make any final adjustments to entity structure
3.  Begin generating complete Prisma schema with all models
4.  Create API design document with all endpoints
5.  Write security requirements checklist
6.  Plan frontend component hierarchy
7.  Conduct user testing with wireframes
8.  Lock down MVP scope

### When Ready to Start Build (Week 1)

1.  Upgrade to Claude Max 5x subscription
2.  Install and authenticate Claude Code
3.  Provide Claude Code with all planning documents
4.  Begin database setup and migrations
5.  Implement authentication layer
6.  Start building core API routes

***

## Key Insights from This Session

1.  **Architecture is sound but needs expansion:** Core structure is good, but 10 models need to be added for full wireframe support.
2.  **Security must be planned now, built throughout:** Can't be bolted on later. Every API route needs auth/validation from day one.
3.  **Hybrid approach is optimal:** Pure Claude Code is expensive, pure copy-paste is tedious. Hybrid gets best of both worlds.
4.  **Start simple, evolve based on reality:** Don't over-engineer. Build MVP, get users, then enhance based on actual needs.
5.  **Strategic Kernel framework fits well:** Obstacle → Guiding Policy → Coherent Actions structure maps cleanly to database entities.
6.  **Cost is manageable:** £120 total for 4-week build is very reasonable compared to hiring developers (£50k-160k).
7.  **Time is realistic:** 3-4 weeks full-time is achievable with good planning and right tools.
8.  **Decision gates prevent scope creep:** Check progress at end of each week, adjust or cut scope as needed.

***

## Conversation Tone & Working Relationship

Charlie demonstrated:

-   Strong grasp of complex systems and strategic thinking
-   Appreciation for detailed explanations and learning-focused approach
-   Practical focus on ROI and cost-effectiveness
-   Methodical planning before execution
-   Comfort with technical concepts while acknowledging non-coding background

Approach maintained:

-   Detailed explanations of "why" not just "what"
-   Code examples with context
-   Multiple options with pros/cons
-   Honest assessments of complexity and effort
-   Practical, actionable recommendations
-   Balance of encouragement and realism

***

## Status at End of Session

**Planning Phase:** 80% complete **Schema Design:** 90% complete (entity list done, Prisma code generation next) **API Design:** 60% complete (structure planned, detailed specs needed) **Security Planning:** 70% complete (risks identified, implementation details needed) **Build Strategy:** 100% complete (clear 4-week plan with prompts) **User Testing:** 0% complete (wireframes ready, testing needed) **MVP Scope:** 80% complete (mostly locked, minor adjustments possible)

**READY TO PROCEED TO:** Week 0 execution (planning tasks) → Week 1 (build start)
