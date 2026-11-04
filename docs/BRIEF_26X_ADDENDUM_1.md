# BRIEF 26-X — ADDENDUM 1: the Organising toolbar, "Add action", and the title proposals

**From CCh-Lex, 4 November 2026.** Adds to §4 of BRIEF_26X (the Organising page). Decisions 321–323. Charlie, 4 Nov: *"Am I blind or are we missing a basic button for 'Add Coherent Action'?"* He is not: there is none. Actions enter only from Lex's build, the import pass, a merge, or Lex's chat tool. Belongs in X1.

## §1 Decisions

| # | Decision |
|---|---|
| 321 | The Organising toolbar is three labelled rows: **View** · **Add** · **Lex and checks**. "Add action" and "Add heading" are the primary (filled) buttons of the page |
| 322 | "Add action" opens a small form: title (required), statement (up to 1,000, counter), heading (dropdown, default "Unsorted"), kind inherited from the heading. Source = USER. It lands at the top of its heading, opened, with its progress strip at "Defined ◐". Lex's `add_action` tool does the same through the same function |
| 323 | A count on a button is never unexplained: "Title these for me (4)" becomes "4 actions have no title · Title them with Lex", and the 4 are shown by a filter "Untitled" that the button also applies. "Use proposed titles" appears only when proposals exist, says how many, and the rows carrying a proposal show it beside the statement with Accept / Not this — never hidden |

## §2 The toolbar (321)

**Row 1 — View.** Label "View" at the left. List · Board · Coverage grid · Conditions (toggle, as now) · Group by · Hide all / Show all headings · the find box (284) · Show (All / Unreviewed / Conflicts / Untitled / …). Nothing on this row changes data.

**Row 2 — Add.** Label "Add". **Add action** (primary, filled) · **Add heading** (primary, filled; the name box opens on press, not permanently shown) · Suggest headings from my guiding policy · Import actions from a document (moved here from above the panel). The "New heading — e.g. legislation…" box and "60 left" counter go inside the Add heading press.

**Row 3 — Lex and checks.** Label "Lex and checks". Title them with Lex (with its count sentence, 323) · Classify with Lex · Find duplicates · Re-sort into headings · Test against the policy (with "16 untested") · Ask four models about the whole set · Check for gaps (moved down from its own box above) · Print all. Each with its asks-first price where it spends.

Every button keeps its label in `screen-labels.ts` and its field-guide entry; the field guide says which row a control is on.

## §3 "Add action" (322)

- Form: Title (required, 120, counter) · Statement (optional, 1,000, counter) · Heading (dropdown of the idea's headings + "Unsorted") · the kind is the heading's. Save / Cancel. Worded refusals.
- Written through the same server function the import and Lex's `add_action` use; `source: USER`; number from the trigger (159); no cause links until classified (the grid says so).
- After save: the row appears at the top of its heading, opened; the record shows the Brief empty with "write the Brief, or ask Lex to prefill it"; the progress strip reads "Defined ◐" until the statement and heading are both set.
- Field-guide entries for the form and its fields.

## §4 Title proposals (323)

- "Title these for me" today: Lex proposes a title for every action that has none (the count is those actions). "Use proposed titles" accepts every waiting proposal at once. Neither says so.
- Now: the button reads **"N actions have no title · Title them with Lex"** (price); pressing it also applies the Untitled filter so the N are on screen. A row with a proposal waiting shows it under the statement: "Lex proposes: *…* — Accept · Not this". **"Accept all N proposed titles"** appears beside the button only while proposals wait. A title the owner wrote is never replaced.
- The same rule applies to every counted button on the page ("16 untested", "(4)"): the count's meaning is in the label, and a filter shows the rows.

## §5 Checks (added to `check:lex-26x`)

12. The toolbar renders three labelled rows with the controls as §2 (browser); Import and Check for gaps are on it and not above the panel.
13. Add action: a new USER action appears at the top of its heading, opened, numbered by the trigger, with "Defined ◐"; Lex's `add_action` stores the same (parity, as 26-W).
14. Title proposals: the count equals the untitled actions; pressing applies the filter; a proposal shows on its row with Accept / Not this; "Accept all" absent when none wait; an owner title is never replaced (mutation: replace → red).
