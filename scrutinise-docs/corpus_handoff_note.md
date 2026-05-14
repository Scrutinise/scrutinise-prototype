# Handoff note — legislation corpus context from parallel CCh thread

*From the parallel CCh conversation working on Stage 1 Lex flow, FAQ, and homepage. Passed across to inform the corpus ingestion plan.*

***

## 1. Concrete user-journey artefact: the cyclist-enforcement test

Charlie ran a live Stage 1 test on 14 May 2026 with an idea about enforcing cyclist red-light offences. Three screenshots from that session exposed a gap:

-   The user described a proposed solution centred on a **public information / safety campaign** (educating cyclists, plus enforcement signalling) rather than a discrete legislative change.
-   Lex correctly recognised this might need funding rather than (or in addition to) statutory change — it talked accurately about Supply and Appropriation Bills, New Powers/Mandates, and Cross-departmental coordination.
-   But the platform had **no data to back this up**. Lex's response was generic LLM knowledge of how UK government funds campaigns; it could not surface "here is the actual Transport spending line that funds this, here is the recent Spending Review allocation, here is the relevant Departmental Annual Report."

This is a real platform gap, not a hypothetical one. A meaningful fraction of policy ideas users will bring won't be "amend section 21 of the Housing Act" but rather "fund a campaign / reallocate resources / create a new programme" — and the platform currently has nothing to offer those users beyond an LLM's general knowledge.

Recommend the corpus plan grounds itself in this case rather than abstract phasing. The question isn't "should we ingest Estimates documents?" but "what does Lex need to be able to do for the cyclist-campaign user?"

***

## 2. What IS in the current ingest scope

Per the V2.75 handoff (handoff_summary.md, v41, 30 April 2026):

-   **All UKPGA** (Acts of Parliament) — being ingested via per-section API ingest as part of the V2.75 hard reset. \~12,009 acts in the corpus, ingested at time of writing.
-   **All UKSI** (Statutory Instruments) — in scope, started after UKPGA completes.
-   **NIA / NISI / UKLA / ASP / ANAW** — in Phase 1 scope, sequence TBD.

This means **Appropriation Acts and Supply and Appropriation Acts ARE in scope** — they're UKPGA. So `Appropriation Act 2024`, `Supply and Appropriation (Main Estimates) Act 2024` etc. will be ingested.

What this gives us: the total quanta of money authorised, by Vote, with the legal authority for spending. The Acts themselves are quite skeletal — they list department totals.

***

## 3. What is NOT in the current ingest scope (the gap)

The detail underneath the Appropriation Acts lives in documents that are NOT legislation:

-   **Main Estimates and Supplementary Estimates** (HM Treasury, presented to Parliament) — line-item detail of department spending, published as PDFs on gov.uk and parliament.uk
-   **Spending Review documents** (HM Treasury, periodic) — multi-year departmental settlements with policy commentary
-   **Departmental Annual Reports and Accounts** (one per department, annual) — actual outturn vs plan, with detailed programme breakdowns
-   **Public Expenditure Statistical Analyses (PESA)** (HM Treasury, annual) — historical time series
-   **Treasury Green Book and Magenta Book** — appraisal and evaluation guidance, central to how spending decisions are justified
-   **Departmental policy papers, consultation responses, and ministerial directions** — programme-level policy detail

None of these are at legislation.gov.uk. They're scattered across gov.uk department pages and the parliament.uk Hansard / Library / Committee archives. Format is overwhelmingly PDF, occasionally HTML, very occasionally CSV (PESA back-data).

This is the data needed for the cyclist-campaign user case.

***

## 4. Current handoff_summary phasing — and why it doesn't fit

From handoff_summary.md lines 117–121:

>   Phase 1 (now): legislation.gov.uk corpus — primary, secondary, amendments. UKPGA, UKSI, ASP, ANAW, NIA, NISI, UKLA, historic acts.

>   Phase 2+3 (combined post-trip): scraping workstreams — HMRC manuals, BAILII case law, FCA Handbook, PRA Rulebook, CMA decisions, other regulator codes. Finance/tax content prioritised first.

>   Phase 4: Cabinet Office codes (Ministerial Code, Civil Service Code), professional codes, ACAS guidance.

>   Phase 5: Hansard, bills-in-progress.

The Treasury/spending content doesn't fit neatly anywhere:

-   It's not legislation (not Phase 1)
-   It's not regulator codes (not Phase 2/3)
-   It's not Cabinet Office governance codes (not Phase 4)
-   It's not parliamentary speech / bills (not Phase 5)

It needs either a new phase (suggest "Phase 2.5: Executive financial documentation") or a re-cut.

***

## 5. Open sprint that interacts with the corpus plan

There's an open sprint in the parallel CCh thread: **V2-LEX-FLOW-AND-LEGPANEL** (brief written, not yet handed to CC). Two workstreams:

-   **Workstream A**: Fix three Stage 1 Lex bugs (field skipping, mid-flow stalling, out-of-sequence writes). System prompt + frontend guard.
-   **Workstream B**: Revive the LegislationPanel originally designed in V2J/V2.5 — slide-over panel with section cards, Change Type selector, Proposed Wording textarea, Attach-to-CoherentAction button. Three trigger moments confirmed:
    -   Moment 1: after Title + Summary — light-touch flag via legislationContext in Lex's system prompt
    -   Moment 2: during root-cause exploration in Diagnosis — same handling
    -   Moment 3: after a Practical Step in CoherentActions — deep dive, panel auto-surfaces

**Implication for the corpus plan**: the LegislationPanel only becomes useful once Phase 1 ingest delivers searchable content. The two streams need to be sequenced compatibly. Suggest the corpus plan explicitly acknowledges Moment 1/2/3 as the consumption layer it's serving.

The cyclist-campaign case also suggests Moment 3 needs to be smarter than "find legislation to amend." Sometimes the right answer is "there is no legislation to amend, this is a funding question" — and the panel UX needs to handle that gracefully. Worth raising in the corpus plan even if the answer is "later phase."

***

## 6. What I'd suggest the corpus plan resolve

1.  **Naming and scope** of the executive-financial-documentation workstream — does it become Phase 2.5, or get folded into Phase 4 (governance documentation), or sit standalone? My instinct: standalone, because the data sources, formats, and ingestion engineering are different from regulator codes and from governance codes. But the user-journey integration is tightly coupled with Phase 1 legislation.
2.  **First-pass scope** for the executive workstream. My suggestion: just the current-year Main Estimates, the most recent Spending Review, and Departmental Annual Reports for the half-dozen biggest spending departments (HMT, DHSC, MoD, DfE, DfT, Home Office). That covers most "where does the money come from" questions without committing to a huge ingestion project. Defer PESA, Magenta Book, and ministerial directions to a later expansion.
3.  **Format and compilation strategy**. These are PDFs, not structured XML. Compilation will be AI-driven from day one — there's no TNA-verified gold standard equivalent. The corpus plan should specify the equivalent of the legislation `compiledBy: 'tna-direct' vs 'ai-compiled'` provenance flag, here probably `source: 'gov.uk' / 'parliament.uk'` and `extractedBy: 'pdf-text' vs 'pdf-ocr' vs 'ai-summary'`.
4.  **Priority within the wider plan**. Where does this sit vs HMRC manuals, BAILII, FCA Handbook (currently Phase 2/3)? My instinct: lower than tax content (which is the platform's flagship use case via Charlie's wife's network), higher than Hansard. But this should be explicit in the plan, not implicit.
5.  **A "no legislation needed" pathway in the LegislationPanel**. Even if the corpus plan defers executive financial docs to a later phase, the UX has to recognise that not every idea is a legislative one. Suggest the corpus plan briefly comment on what Moment 3 of Lex should do when the proposed action is a campaign, funding allocation, or operational change rather than a statutory amendment — even if the answer is "show a placeholder for now, surface relevant Departmental Annual Report content when that ingest lands."

***

## 7. Smaller flags

-   **The cyclist test also exposed an UI gap**: there is no panel for surfacing legislation in the Stage 1 flow today. The LegislationPanel (V2-LEX-FLOW-AND-LEGPANEL Workstream B) is the answer, but it's not built yet.
-   **Lex referred to "Supply and Appropriation Bill" generically and accurately, but had no link to the actual Act in our corpus.** Even though Appropriation Acts are being ingested, Lex can't cite a specific one because it has no awareness of the ingestion status. Worth thinking about Lex's grounding signal — "I can see X Act in our corpus, here is the section" vs "I have general knowledge of how this works." The Lex system prompt's `legislationContext` input is the mechanism, but it depends on a successful corpus search returning something useful.
-   **The "Legislation" navigation entry** is admin-only per Charlie's question in the parallel thread (to be confirmed in V2-LEX-FLOW-AND-LEGPANEL). Worth being aware in case the corpus plan touches surface area around that nav item.

***

*End of handoff note.*
