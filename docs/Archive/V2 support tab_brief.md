# V2-SUPPORT-TAB — CC Brief

**Sprint:** V2-SUPPORT-TAB **Scope:** Rename the "Training" navigation item to "Support". Restructure the Support page to host three tabs: Training, FAQs, Feedback. Wire up a basic Feedback form that sends an email to admin and logs the submission. Mark AI categorisation of feedback as a near-term roadmap item. **Estimated size:** Small. Navigation rename, page tab structure, one new form component, one new API route, one new DB entity.

***

## Context

The current navigation has a "Training" tab pointing to a training page. Charlie wants:

1.  The navigation item renamed from "Training" to "Support".
2.  The Support page to expose three tabs: **Training**, **FAQs**, **Feedback**.
3.  Existing training content to live under the Training tab unchanged.
4.  A new FAQs tab to render the markdown file produced separately (see `scrutinise_FAQ_final.md`).
5.  A new Feedback tab with a simple form that emails admin and logs the submission to the database. AI categorisation comes later (see roadmap note at the end).

***

## Change 1 — Rename navigation item

Find the "Training" label in the main navigation component and rename to "Support". The href can stay the same (e.g. `/training` → kept as `/training` for URL continuity, or renamed to `/support` if straightforward — Charlie's preference: rename to `/support` with a 301 redirect from `/training` to preserve any external links).

If the existing route is `/training` and renaming touches lots of internal links, leave the path alone and just change the label. The label is the user-facing change; the URL path is a follow-up if needed.

## Change 2 — Three tabs on the Support page

Restructure the Support page (whatever it's currently called) to have three tabs along the top: **Training**, **FAQs**, **Feedback**.

Use the existing tab styling pattern already used elsewhere on the site (e.g. on the idea detail page, which has Overview / Contributions / Amendments / Activity tabs). Don't introduce a new tab component.

Tab routing: query parameter (e.g. `/support?tab=faqs`) is fine; doesn't need to be a separate page route per tab. Default tab on landing: Training (preserves existing behaviour).

## Change 3 — Training tab

The existing training content moves under this tab unchanged. No content edits in this sprint.

## Change 4 — FAQs tab

Render the markdown file `scrutinise_FAQ_final.md` (provided separately, place at `/content/faq.md` or equivalent location).

Rendering: use the existing markdown renderer already in use on the platform (e.g. the one rendering proposed wording or research notes). Each top-level `##` heading becomes a collapsible section; questions (`###`) appear as expandable items inside. The "A note for new arrivals" section at the top should be open by default; all others closed.

A small in-page nav on the left (or a "jump to" dropdown on mobile) listing the `##` section headings would be a nice-to-have but is not required for this sprint.

## Change 5 — Feedback tab

A simple form:

-   **Subject** (required, single line)
-   **Message** (required, textarea)
-   **Type** (optional dropdown): "Feature suggestion" / "Bug or problem" / "General comment" / "I need help with my account"
-   **Email** (auto-populated from the logged-in user; readonly. If not logged in, the form requires an email field.)
-   Submit button

On submit:

1.  Create a `Feedback` record in the database (see schema below).
2.  Send an email to admin at `cl@scrutinise.org` with subject `[Scrutinise Feedback] <user-subject>` and body containing the message, type, user identity (clerkId, preferredName, email), and a link to the Feedback admin view.
3.  Show a success message: *"Thanks — we've received your feedback. We read every one."*

No retry-on-failure or rate-limit logic needed in this sprint beyond standard hard caps.

### New DB entity: `Feedback`

```prisma
model Feedback {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  email       String   // either user's email or anonymous submission email
  subject     String
  message     String   @db.Text
  feedbackType String? // "feature" | "bug" | "general" | "support" | null
  status      String   @default("NEW") // "NEW" | "TRIAGED" | "RESOLVED" | "WONTFIX"
  adminNotes  String?  @db.Text
  
  // Roadmap fields (added now for forward compatibility; populated later by AI)
  aiCategory      String?  // populated by AI categorisation when implemented
  aiPriority      String?  // "low" | "medium" | "high" | "urgent"
  aiSummary       String?  @db.Text
  aiCategorisedAt DateTime?
  
  @@index([status, createdAt])
  @@index([userId])
}
```

### New API route

`POST /api/feedback` — accepts the form payload, creates the Feedback record, sends the admin email via Resend, returns success/failure.

Validation: subject ≤ 200 chars, message ≤ 5000 chars, email is a valid email.

### Admin view (out of scope this sprint)

A `/admin/feedback` listing page is **out of scope for this sprint** but the entity is being built to support it. Charlie will request it in a follow-up sprint.

***

## Roadmap note (do not implement now, but capture in `roadmap.md`)

Add to the roadmap:

>   **AI feedback categorisation and triage.** After a Feedback record is created, an AI categorisation step runs in the background:

>   Categorises into: Functionality suggestion / Bug or problem / General complaint / Immediate support need / Other

>   Assigns a priority (low / medium / high / urgent)

>   Generates a one-line summary for fast admin scanning

>   Posts urgent items to admin via additional channel (Slack? SMS?)

>   Target: implement within 2-3 sprints of the V2-SUPPORT-TAB completion. The Feedback entity already has the columns (`aiCategory`, `aiPriority`, `aiSummary`, `aiCategorisedAt`) to support this.

>   Longer-term ambition: replicate basic Zendesk-style functionality — threaded conversations, status tracking, admin assignment, customer notifications on status change. Not Zendesk itself; a lightweight in-house equivalent.

***

## Acceptance criteria

1.  Main nav shows "Support" not "Training".
2.  The Support page has three working tabs: Training, FAQs, Feedback.
3.  The Training tab shows the existing training content unchanged.
4.  The FAQs tab renders the FAQ markdown content with collapsible sections; the "Note for new arrivals" is open by default.
5.  The Feedback tab shows a working form. Submitting it creates a `Feedback` DB record and sends an email to `cl@scrutinise.org`.
6.  The user sees a confirmation message on successful submission.
7.  The Feedback schema includes the `aiCategory`/`aiPriority`/`aiSummary`/`aiCategorisedAt` columns ready for the future roadmap item.
8.  `roadmap.md` updated with the AI categorisation note.
9.  `tsc --noEmit` clean. Vercel build passes. Prisma migrate runs cleanly.

## Git discipline

CC does **not** call git during this sprint. At the end of the sprint, CC produces `commit-all.sh` in the project root containing:

-   All `git add` commands for files modified
-   A single commit with message `V2-SUPPORT-TAB: Rename Training to Support, add tabs and Feedback form`
-   `git push origin Main` (capital M)

Charlie reviews the Vercel preview deployment. After Charlie approves, CC executes `commit-all.sh` immediately, then deletes it.

## Out of scope

-   Admin view of feedback records (separate sprint)
-   AI categorisation of feedback (roadmap, separate sprint)
-   Zendesk-style threading / status workflow (longer-term roadmap)
-   Editing the existing training content
-   Editing the FAQ markdown content (it's provided ready to render)
