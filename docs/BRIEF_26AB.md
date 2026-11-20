# BRIEF 26-AB — LEX: info labels on the Brief, and three layout faults on a phone

**From CCh-Lex, 20 November 2026.** Charlie, on his phone, opening the Brief for a Code text draft: *"Can you talk me through what all these fields mean … add an info label to explain the same to the user."* Small; can ride with 26-AA (same worktree, after item 5) or run alone. Decision 354.

## §1 Decision

**354.** Every field and section heading on the Brief (common fields and each kind's own fields) carries an **ⓘ info label**. Tap or click opens a short panel, which stays until closed, with: **what it is** (one line), **what Lex does with it** (one line), and **an example** (one line, generic, never a real user's words, §27). The text lives in the **field guide** (one source: the screen's ⓘ and Lex's `explain_field` read the same entry). Shape + word: the ⓘ has an accessible name "About <field>"; keyboard and screen reader reach it.

## §2 The text (Code text kind, and the common fields) — use verbatim; adapt the other kinds in the same pattern and report them

| Field | What it is | What Lex does with it | Example |
|---|---|---|---|
| What this draft must do | The job of the instrument in a few sentences: the problem it solves, whom it governs, what changes. | Reads this first; the draft's opening and principles come from it. | "Sets the duties of every owner of a publicly funded task: one named owner, matched authority, candour." |
| Modelled on | An existing document whose structure and style the draft should follow: a source number from your Sources, or a corpus section. Leave empty for Lex's standard form. | Reads it in full and copies its shape, headings and register, not its content. | "218" (a filed copy of an existing code) |
| Tone and form | The register: statutory, code, guidance, specification or plain rules. | Sets how duties are written: "You must …" for a code; "should" for guidance; numbered subsections for statutory text. | "code" |
| Issued by | Who formally issues the instrument. | Names them in the opening and as its authority. | "The Minister for the Civil Service" |
| Laid before | The body it must be laid before, if any. | States the parliamentary step; "none" means it is not laid. | "Both Houses of Parliament" |
| Applies to | Who must follow it. | Sets the scope paragraph and the definitions it needs. | "Every publicly funded body, phased: departments first" |
| Revision rule | How, when and by whom it may be changed. | Writes the closing "changes to this code" section. | "Revised only to improve the service; reviewed every three years; laid again when changed" |
| Must include | Numbered points the draft must contain. | Each becomes at least one provision, and each provision names the point it came from. | "One named owner for every task" |
| Must not | Things the draft must avoid. | Treated as limits; a draft that breaks one is flagged. | "Create a new body"; "Add a separate reporting duty" |

Also an ⓘ on the **Brief heading** itself: "The Brief is your instruction for the draft. Lex drafts from it, and every draft records which version of the Brief it followed. Each save is a new version; earlier ones are kept."

## §3 Three faults visible on Charlie's phone (360–390 px), fix in the same commit

1. **"Modelled on" input overflows the panel** to the right (its placeholder runs off-screen). Stack label above input below 768 px, full width, placeholder shortened to "Source number or corpus section".
2. **A stray "none"** sits to the left of "Tone and form": it is Modelled on's resolved value printed on the wrong line. Show it under the Modelled on input ("Resolves to: none") or not at all when empty.
3. **"200000 left"** under "What this draft must do" is noise. For fields whose limit is effectively unlimited (≥ 50,000), show the count only within the last 10% of the limit; otherwise show "N characters".

## §4 Checks

`check:lex-26ab`: every Brief field for every kind has a guide entry with the three parts (a field without one fails, with a planted control); the ⓘ opens, stays, closes by button/Esc/tap-outside, and is reachable by keyboard (browser, 360 px); §3's three faults asserted at 360 and 390 px (no element wider than the viewport; no stray "none"; the counter rule). Mutation per item. Regression one at a time; commit by path; the push is Charlie's.
