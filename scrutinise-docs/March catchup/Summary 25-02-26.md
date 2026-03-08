# Summary: Wireframe Audit & Critical Decisions

**First Claude reply:** 24-02-25  
**Last Claude reply:** 25-02-26  
**Total replies:** \~15

***

## Build Stage

Pre-development consistency review — wireframes v3 audited against reconciled specification documents (Process List v2, Entity List v2, SYSTEM_MECHANICS v0.6). This work directly precedes the clickable prototype build.

***

## Areas Covered

Claude conducted a comprehensive page-by-page audit of all 34 wireframes against the three core specification documents, producing a formal Wireframe Audit Report (Wireframe_Audit_v3.docx). The audit identified misalignments between the evolved specifications and the wireframes, with five critical structural issues and 14 decisions needed. The conversation also produced the answers to all 14 decisions and a prioritised list of 23 missing wireframes.

Significant discussion occurred around the voting mechanic history — whether votes had previously been specified as binary or as a -5/+5 slider. Claude investigated prior transcripts and confirmed the -5/+5 scale had appeared in earlier conversations, but the user clarified their actual intent was always binary (For/Against/Undecided) with a separate 0-5 strength/certainty slider, not a single bipolar scale.

***

## Decisions Made

1.  **Stage names corrected** — all wireframes use outdated labels (Community Debate, Expert Review). These must be replaced with the agreed backend labels throughout.
2.  **Voting mechanic finalised** — votes are 3-way: **For / Against / Undecided**. A separate **0–5 strength/certainty slider** accompanies each vote (not a -5/+5 bipolar scale). UI guidance text confirmed: "0 - I'm barely convinced; 3 - I'm confident; 5 - I'm passionately behind this."
3.  **Idea-quality feedback on vote page** — optional multiple-choice checkboxes added to the vote flow: "It doesn't go far enough"; "It is too harsh/extreme"; "It's poorly worded"; "It needs a special case exemption." Undecided voters see: "I don't care about this issue"; "I don't know enough yet"; "I don't have time"; "I care but this needs more work"; "Other."
4.  **All -5/+5 scales use 0.5 increments** across the board.
5.  **No anonymous voting** — eliminated entirely. Minimum requirement to vote: verified email address. Postcode and mobile required to comment. Full ID verification deferred to V2.
6.  **Stage gate thresholds corrected** — admin panel thresholds replaced with the new spec: field-completion based progression (Stage 1→2, 2→3), 25 votes (Stage 3→4), endorsements (Stage 4→5).
7.  **Reply buttons removed** — only idea owners may reply to comments. Reply buttons removed from all wireframes showing public comment threads.
8.  **23 missing wireframes identified and prioritised:**
    -   *Must have for clickable prototype:* Stage gate screen, owner's amendment review view, guest vote email capture modal, invitation landing page, public user profile page, private messaging / DM inbox
    -   *Must have for build but not prototype:* MP/Peer/Draftsman claim and endorsement flows, merge proposal flow, GDPR pages, admin verification queues, wording history view, referral landing pages
    -   *Defer to V1.1:* Amendment consultation view (Mode A), voter withdrawal notification
9.  **CoherentAction confirmed as core entity** — entity model to be updated to reflect this, touching Idea, CoherentAction, Vote, Amendment, and Wording entities.
10. **"Refine Answer" button on WF-11** — confirmed to trigger Lex to review a completed field directly and suggest improvements, rather than through continued conversation.
11. **Country field added** — platform may go international, so a country field is to be added to the relevant entity.
12. **Coherent Actions visible to all users** (WF group A answer 1).
13. **Admin controls confirmed to retain:** "User Registration Open" toggle, "AI Features Enabled" toggle (kills all Lex functionality sitewide), "Maintenance Mode."

***

## Issues Discussed But Not Concluded

-   **WF-64** — "What does this do?" — the feature this referred to was not conclusively identified during this conversation. The audit document may reference it but it was not resolved in the transcript reviewed.
-   **Voting history discrepancy** — Claude flagged that a -5/+5 scale had appeared in earlier conversation transcripts. The user confirmed binary + strength slider was always the intent; the discrepancy in the prior transcript was not traced to its source. No action needed, decision is locked.
-   **Wireframe correction process** — the 34 existing wireframes need updating to reflect the above decisions. This was flagged as work to complete before the prototype build but the mechanism for doing so (user updates manually vs. new wireframes generated) was not resolved in this conversation.
