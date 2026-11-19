# BRIEF 26-AA — LEX: loose ends (no new decisions)

**From CCh-Lex, 18 November 2026.** Everything here was already decided; none of it changes what Charlie sees in a way he must approve, except where it says so. Written to run while Charlie works on 452c5ade, so: **nothing in this brief writes to 452c5ade's content**, and every check runs on scratch copies.

## §0 Run mode

- As BRIEF_26S §0. Report `docs/LEX_26AA_REPORT.md`. Own worktree `C:\lex26aa`, branch `wip/26aa`; one session per tree; inbox per INBOX_PROTOCOL.md (report to `to-cch\` at each item's end). Run checks one at a time.
- Size first; report the list with an hour estimate per item; then work through in order. Stop rules as the protocol.

## §1 Items, in order

1. **The remaining hard-delete paths → archive with restore (decision 183/196).** Inventory every server function that still issues a `DELETE` or `deleteMany` on user content (policy options, evidence rows, private notes, sources, anything else found). For each: archive (status + reason + when + by), a restore path, numbers never reused, the screen's "Delete" becomes "Remove (can be restored)". **Exception, by Charlie's decision (320): cost lines stay deletable**; leave `remove_cost_line` and its button as they are. Report the inventory before changing anything; scratch-only checks with a mutation per path.
2. **Lex tool for editing causes** (the one gap 26-W-b's inventory left): `edit_cause`, `add_cause`, `retire_cause`, through the same functions as the Diagnosis page's buttons, asks first for anything that changes the owner's words; field-guide entries; parity check on twin scratch copies.
3. **"Draft what this heading needs" as a Lex tool** (`draft_heading_needs`), on the same worker queue and price plan as the button; asks first with the plan's total.
4. **Re-measure the four document kinds' prices** whose templates changed in 26-W (specification, costing, operating text, background note): n ≥ 3 each on a scratch copy of 452c5ade (read-only), replace the V2b figures, report old vs new. Spend cap £1.50.
5. **Field-guide coverage for Sources and Add research** (26-W-b left these unchecked): every label rendered by SourceBrowser and AddResearch has a guide entry; add the missing ones.
6. **The scripts typecheck's three errors in `scripts/ingest/shared/*`**: if still present, report them to cc-ingest through the inbox; do not edit Ingest's files.

## §2 Verification — `check:lex-26aa`

Per item: (1) no user-content DELETE remains outside the cost-line exception (a static scan with a planted control), each archived path restores; (2)/(3) parity with the buttons; (4) prices recorded with n; (5) coverage check over the two components. Regression one at a time; clean build; commit by path; the push is Charlie's.

## §3 Not in this brief

The Private Scrutiny page (319): its brief needs Charlie's design calls. The promotional plan chapter. Anything on 452c5ade's content.
