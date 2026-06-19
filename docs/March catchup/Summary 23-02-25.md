# Conversation Summary: Process List Review & Expansion

**Conversation dates:** 23-02-25 (first reply) to 23-02-25 (last reply) **Total replies:** 6 **Stage / Element of Build:** Pre-development planning — Process List definition and review, prior to wireframe and entity list consistency comparison.

***

## Title

Process List Review, Gap Analysis, and Admin/Moderation Architecture

***

## Areas Covered

1.  **Review of existing process list** — assessment of the draft user-facing process list covering idea creation, voting, commenting, rating, account creation, amendment proposal, group management, and settings.
2.  **Gap analysis** — identification of missing processes and incomplete flows in the original list.
3.  **New processes drafted** — amendment voting, stage progression, AI assistance usage, content flagging/reporting, and admin/moderator flows.
4.  **Admin Dashboard and Management Console** — user-submitted admin flows were reviewed, restructured, and expanded.
5.  **Feedback & Feature Requests system** — user-facing bug/feature request flow defined and separated from the admin-facing backlog management flow.
6.  **Role and permissions architecture** — four-tier role hierarchy defined with a full permissions matrix.

***

## Decisions Made

| \# | Decision                                                | Detail                                                                                                                             |
|----|---------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------|
| 1  | Stage progression is owner-triggered                    | System monitors criteria and notifies owner when eligible; owner confirms progression rather than it being fully automatic         |
| 2  | Amendment acceptance is owner-controlled                | Idea owner decides whether to accept or reject proposed amendments                                                                 |
| 3  | Separate Moderator role with limited permissions        | Moderator can hide content and warn users but cannot delete accounts, remove content permanently, or access platform configuration |
| 4  | Four-tier role hierarchy adopted                        | Roles: Super Admin, Admin, Moderator, Standard User — each with defined permissions                                                |
| 5  | Only Super Admin can assign Admin role                  | Admins can promote users to Moderator; Super Admin role is protected root-level account                                            |
| 6  | Audit log covers all privileged actions                 | Admins can view full audit log across all roles; moderators can only view their own history                                        |
| 7  | Platform configuration in Admin console                 | Stage thresholds, reputation point values, anti-pile-on rules, and predefined lists to be configurable without code deployment     |
| 8  | User-facing and admin-facing feedback systems separated | Feedback & Feature Requests is a distinct user-facing section; admin backlog management sits within the Admin Management Console   |

***

## Open Issues / Undecided Items

| \# | Issue                            | Status                                                                                                                                                                                                            |
|----|----------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | Moderator identity visibility    | Under consideration — three options discussed: (a) named moderator shown publicly, (b) fully anonymous, (c) "Moderated by Scrutinise" with internal audit trail only. Option (c) recommended but not yet decided. |
| 2  | "Promote the idea" feature scope | Flagged as potentially out of scope for the 4-week sprint — marketing templates and landing page creation for promotional links not yet confirmed as in or out of sprint                                          |
| 3  | @mention behaviour               | Clarified that mentioned users receive a notification with context and link, and mention appears in activity feed — but the full data model for mentions not yet reviewed against entity list                     |

***

## Background / Educational Notes

-   **Role-based access control (RBAC):** Roles should be modelled as a single `role` field on the user entity, or a separate roles/permissions table for future granularity. Every protected API endpoint should check the user's role before executing. Building this clearly before development avoids costly access control retrofitting later.
-   **Admin audit logging:** On any platform where admins can suspend accounts or remove content, a full audit log is a legal and operational necessity.
-   **Moderator anonymity trade-off:** Transparency builds user trust in moderation decisions; anonymity protects moderators from harassment on politically contentious platforms. Most mature platforms display moderation as institutional ("Moderated by [Platform]") rather than naming individuals.

***

## Next Step

Compare the completed and expanded process list against the wireframes and entity list for consistency, gaps, and conflicts.
