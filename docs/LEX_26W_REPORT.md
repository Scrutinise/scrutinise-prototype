# LEX 26-W — report

*Laptop session, 2 November 2026 (UTC). BRIEF_26W, decisions 301–306. Charlie's screen is the last check (§8).*

## Run, size and split

§5 ran first, as the brief asks: it was done and read back at 00:24 UTC, sixteen minutes after Lex's write.

Sized after that, the brief is two parts:

| Part | What | State |
|---|---|---|
| **26-W-a** (this session) | §5 clean-up; §4c `read_source` in full; §6 step limit; §2b document tools; §2c the Action-details guard; §4a templates, §4b refusal, §4d re-measure, §4e; `check:lex-26w` | **built and checked** — not yet committed (see "Shared files") |
| **26-W-b** (next) | §3 the field guide (`explain_field`, `list_fields`, a coverage check over every rendered label); §2a's remaining non-document gaps (inventory below); §2d comparisons for those rows; "Draft what this heading needs" as a tool | **not started** |

The reason for the split: §3 has to be generated from, or sit beside, the components that render each label, and the inventory found more than 120 labels across four surfaces. That is a sprint of its own. Every §7 line that belongs to 26-W-b is reported below as NOT RUN.

## §5 (305) — the clean-up of #207

**Done, then read back cold: 7/7.** CHANGE_LOG has the 00:24 entry.

- **No FieldRevision existed for #207.** `add_action_details_section` wrote straight to the column. The brief's "restore from its FieldRevision" could not be followed as written, so the 00:07 state was rebuilt from the tool's own append rule (`current.trim() + "\n\n" + section`) and proved arithmetically from the tool log:
  - the first call reported `actionDetailsLength` 21,068, which is 17,946 + 2 + 3,120;
  - the four sections are 3,120 + 4,330 + 4,753 + 3,397 characters;
  - the text before them, plus "\n\n", plus the sections rebuilds the field byte for byte;
  - `updatedAt` was still Lex's 00:08:51.765, so nothing had touched the field since.
- ⚠ **Departure from the letter: the proposal is on D.207.2 (a new code-text document), not D.207.1.**
  - D.207.1 is the `DRAFT_CLAUSE` document: the enabling clause. Its one proposal is Lex's clause, which Charlie dismissed at 23:27 on 1 Nov.
  - A clause document's proposals are read as a drafting instruction (`draftsFor`), and "Use it" refuses them (`useTextProposal`). Code text placed there could not have been used, edited or set aside.
  - D.207.2 was written through `writeTextProposal`, the writer that "Draft what this action needs" uses.
  - **The "proposals list" the brief describes is D.207.1's dismissed clause proposal.** It is unchanged.
- **Counts:**
  - D.207.2 "Code text": PROPOSAL 1 by LEX, **15,606 characters**, the four sections verbatim and in order. Its reason begins "Lex's draft from chat, 2 Nov". No price, because no model call was made.
  - Action details: **33,554 → 17,946**.
  - One FieldRevision, `LEX_26W_305_MOVED_TO_DOCUMENT`, holding both states (previous 33,554, new 17,946). It is the only revision #207 has, because none existed before.
- Script: `scripts/apply-26w-305.ts`. It refuses to run unless the field is exactly the 00:08:51 state, and it writes the proposal before the restore, so a failure part-way would leave the text in both places, never in neither.

## §2a — inventory of the owner's controls against Lex's tools

Traced control by control, from the rendered label to the route to the server function. Full tables with file:line references: the Explore pass of 2 Nov, summarised here.

**Document view, after 26-W-a:** every row is matched or is "none" with a reason. `check:lex-26w` G asserts this table.

| Control | Server function | Lex tool |
|---|---|---|
| Edit → Save as a new version | `saveDocumentText` | none, by decision 301: the owner's own words. Lex writes a proposal and the owner uses it |
| Edit (instruction) → save | `DR.saveVersion` | none, by decision 301 (as above) |
| Ask Lex to redraft (instruction · explanatory note) | `DR.draftWithLex` · `draftExplanatoryNote` | **`redraft_document`** (asks first, measured price) |
| Use it as version N · Take all → Save (clause) | `useTextProposal` · `DR.acceptProposal` | **`use_proposal`** (owner's instruction + card) |
| Accept version N | `acceptDocument` | **`accept_document`** (owner's instruction + card) |
| Set aside (text · instruction) | `setAsideTextProposal` · `DR.dismissProposal` | **`set_aside_proposal`** (owner's instruction + card) |
| Review this document / Review again | `reviewPlan` → `reviewDocument` | **`review_document`** (asks first, measured price) |
| Generate again (collision report) | `generateCollisionReport` | **`generate_collision_report`** (free) |
| Add a document | `addDocumentByHand` | **`propose_document_text`** (makes the document if the action has none of that kind) |
| Draft what this action needs | `planFor` → `queueDrafting` | **`draft_document`** (asks first; the plan's measured price; `queueDrafting` re-checks the agreed price, as for the button) |
| Draft what this heading needs | same, heading scope | none: 26-W-b |
| reading the view / the tree | `openDocument` / `documentTree` | **`read_document`** / **`list_documents`** |

**Action record, research panel and Overview:** gaps remaining for 26-W-b. None of these has a Lex tool:
- title edit and title-proposal accept;
- statement edit;
- Who (card), cost ranges, cost lines, no-cost reason;
- keep-conflict note;
- slot accept and dismiss;
- facet accept and dismiss;
- heading kind;
- conditions: add, edit, move, retire, and accepting a proposal;
- comments, replies, and the thread summary;
- notebook: set aside, put in record, share, reply, edit comment;
- source registry: add, snippet, remove, set aside a filed document;
- causes editing.

⚠ Three places where the two sides disagree, found by the inventory:
- **Rule out** asks first in chat and not on screen.
- **Consolidate** asks first in chat at 9.0p and not on screen.
- **`add_research_note`** cannot attach a note to an action; the screen's "Add comment" can.

⚠ **Fixed here: Lex wrote Action details through raw Prisma**, not the button's `updateAction`. `set_action_detail` and `add_action_details_section` now call `updateAction`.

## §2b / §2c — built

- **Ten document tools** (`lib/lex/agent/tools.ts`, `DOCUMENT_TOOLS`): `list_documents`, `read_document`, `propose_document_text`, `draft_document`, `redraft_document`, `use_proposal`, `accept_document`, `set_aside_proposal`, `review_document`, `generate_collision_report`.
  - Each calls the button's own function. The "no second code path" guard is source-level: no raw write may appear in the tools' block, and its control plants one and is caught.
  - Use it, Accept and Set aside are `tier: 'ask'`, and the prompt says to call them only on the owner's instruction.
  - The price on a card comes from a new `price` hook, which uses the measured kind price, the plan, or the review plan.
  - `ctx.agreedPence` carries the price on the signed card into `queueDrafting`'s re-check.
- **`propose_document_text`** writes Lex's own text a section per call:
  - `start` begins a proposal; `appendToTextProposal` (new) adds to it, so each section is saved as it lands.
  - ⚠ Appending *changes* a waiting proposal row. The store says proposal rows are appended, never edited, so this narrows that rule: only a proposal Lex started from chat (`payload.fromChat`), and still unanswered, can grow.
  - It never writes a draft clause and never writes over a version.
- **§2c:** `instrumentLike()` plus a per-turn count.
  - More than 3,000 characters of instrument-like text going into Action details is refused, with words pointing to `propose_document_text`.
  - Instrument-like means at least three provision lines ("You must …", "(3) The Minister must …"), or a heading that names a draft instrument.
  - Lex's prompt states the rule.
  - Checked: 2 Nov's section 1 is refused, and an explanation still goes in.

## §3 — the field guide (26-W-b, built 3 Nov)

- **`lib/lex/screen-labels.ts`** holds the words the record, the document view, the tree, the workspace and the notebook render. The components render these constants, and so does the guide.
- **`lib/lex/field-guide.ts`**: 239 entries. Each has a purpose, how it fits, its limits where it has any, and the Lex tool that does the same (or "none — why"). Each guide table is typed against its label table, so a label added without an entry is a compile error. Labels are read when the guide is asked, never copied, so a rename in `screen-labels.ts` changes the screen and the guide together. That is the point for 26-X.
- **Two free tools:** `explain_field` (exact match, else near matches that share a word with the label or key) and `list_fields`. A prompt rule says to answer "what is this for?" from them, never from general knowledge. The guide stays out of the per-turn prompt, so 293's cache savings stand.
- **`check:lex-26w-b`** has four parts:
  - **A:** the guide is complete, and every tool it names exists.
  - **B and C:** each new tool and its button store the same thing on twin scratch copies.
  - **D:** a real browser renders the workspace with a record open (steps 1–4) and both document views. It fails on any rendered label the guide does not hold, and renames a label in the bundle's own table before mounting.
- **3 Nov, finishing the check:**
  - Part D had never completed: esbuild's `__name` helper was missing in the page, so the check now defines it with an init script.
  - Part D's first full run found about 25 workspace controls rendered as inline strings (the toolbar, the views, heading digests and print, "Draft all legislative actions", the row's open/close, the kept blocks, the conditions list's ↑ ↓ Retire). These moved into `WORKSPACE_UI` / `WORKSPACE_VIEW_WORD`, with guide entries.
  - Values inside controls (an action's title on its row, counts, the "N left" counter, the filter's help) are marked `data-shown-value` and dropped. A kept block's title and toggle are read as separate parts (`data-label-part`). The matching itself is unchanged.
  - The guide's tool-name scan no longer reads `(op: bring_back)` as a tool.
  - Result: **60/60, 5 controls fired, 0 not run, 113 distinct labels read.**
- **The inventory after 26-W-b:** title, statement, keep-conflict note, facet, slot and condition proposals, cost ranges, cost lines, no-cost reason, conditions, comments, replies, the thread summary, document needs and the notebook's controls each have a tool that calls the button's own function.
  - ⚠ `remove_cost_line` is built and parity-checked but **not offered to Lex**: it deletes the row, and `check:lex-26p` A1's rule is that no tool offered to the model is a delete. Whether to offer it is Charlie's call.
  - Still none: Causes editing, the source registry's snippet, and "Draft what this heading needs" (the guide says so in its tool line).
  - The summary's parity row is not run, because it spends money.

## §4 — real drafts

- **4a.** The five templates now ask for the instrument itself, and every template opens its rules with `THE_INSTRUMENT_RULE`:
  - **Code text:** introduction, then values or principles, then numbered "You must / You must not" duties. Each duty ends with the clause of the Action details it comes from, and the form is modelled on the held text of the filed code. `modelSourceFor()` picks the code-titled source held in full, preferring one the Action details cite, then the shortest.
  - **Specification:** Purpose, Users, Records, Rules, Measures, Exclusions.
  - **Costing:** leads with the cost lines.
  - **Operating text:** numbered rules.
  - **Background note:** cited paragraphs.
  - The drafter now gives the model the Action details up to 24,000 characters, line breaks kept (before: 8,000, whitespace collapsed). #207's are 17,946.
- **4b.** `proposalShape()` refuses a draft when more than 40% of at least three paragraphs propose, or when fewer than half of a code's numbered duties state a duty.
  - A refused draft is not saved. The worker's job row carries the reason in words: "Lex's code text was not saved: it reads as a list of proposals, not a code text: 5 of 5 paragraphs say … (for example: "…"). Ask Lex to draft it again, or write it yourself."
  - Tested with a fixture, not a word count: a proposals list is refused, a code is not, and a code whose numbered paragraphs state no duty is refused.
  - The same check runs on each section Lex writes from chat.
- **4c. `read_source(ref)`** (`lib/lex/source-text.ts`) reads the whole held text of any [Ref: n]: a filed file, a fetched page or pasted text (from `IdeaUserMaterial.text`), or a corpus section (through `readSection`). It reads in parts of 15,000 characters and says `held: full text | summary only | nothing`.
  - **How Charlie's two Codes are held: in full.** [Ref: 217] Civil Service Management Code is 192,110 characters; [Ref: 218] The Civil Service Code is 12,446 characters.
  - On 2 Nov Lex saw five and six extracts of them, at most 700 characters each, because the old `read_source` returned findings only.
- **4d. Code-text price re-measured** on a scratch copy, #207, claude-sonnet-5-5: **4.71, 4.91, 4.71, 4.52p** (n=4, mean **4.7p**). This replaces V2b's 1.60p and 0.90p, which came from the old template with 8,000 characters and no model.
  - Three more scored runs: 4.57, 4.69, 4.82p.
  - ⚠ The other four kinds' prices are still V2b's, measured on the old template. Their wording changed and they now see more of the Action details, so they need re-measuring before they are relied on.
- **4e. On scratch, three fresh runs.** Each opens "About this Code", then principles, then 33, 34 and 34 numbered duties. **Every duty cites a clause the Action details hold (33/33, 34/34, 34/34), and no paragraph is a proposal (0/35, 0/36, 0/41).** Each is modelled on [Ref: 218], held whole.
  - The first scored runs failed on the checker, not the drafts. The clause reader did not know "8a." (how #207 writes clause 8's parts), and "You must … propose alternatives" was counted as a proposal. Both were fixed in the shared pure module.

## §6 (306) — the step limit

- **The limit was 8 tool rounds for every turn.** In the 14 days to 2 Nov, **1 of 49 Lex replies** hit it: the 00:08 turn on 452c5ade. That was a writing turn with 16 tool calls: list_sources, get_action, the notebook, two read_source, three searches, two read_section, explain, then five section writes, one of which failed on its input.
- **Now:** once a turn has saved a section (`propose_document_text` or `add_action_details_section`), its limit is **20**, still inside the 40p cap and the 240-second deadline. The stop sentence names the number and says that "carry on" resumes.

## §7 — `check:lex-26w`

**Latest full run: offline 66/66; live 80/82, then the chat part re-run 70/70; 6 controls, 0 dead.**

| §7 | Result |
|---|---|
| 1 §5 read-back (cold, 452c5ade) | PASS (6 + 1 control) |
| 2 Parity table | document view: all rows matched or "none" with a reason; tool vs button field by field on twin documents for Use it, Accept, Set aside: PASS; the raw-write guard plus its planted control: PASS. Rows outside the document view: **NOT RUN (26-W-b)** |
| 3 Field guide covers every label | **NOT RUN (26-W-b)** |
| 4 Code draft is a Code; proposals fixture refused | PASS (fixtures offline; 3 live runs) |
| 5 `read_source` reads a long document whole; extracts-only control | PASS: [Ref: 217] in 13 parts equals the held text exactly; summary-only reads "summary only" |
| 6 Lex in chat, "Redraft D.207.1 as a Code modelled on [Ref: 218]" | PASS on the second run. Lex read [Ref: 218] whole and offered "Redraft D.207.1 — …" at **4.7p** on a card. After Confirm: a new waiting proposal (a Code, 26/26 duties with "must", 1/37 proposing), the old one kept, Action details unchanged. Turn 16.59p. |
| 7 Regression | see below |

⚠ **What the first live chat run found.** Asked to redraft, Lex wrote the Code itself through `propose_document_text`, five sections at 30.01p, instead of offering the button's drafter at about 4.7p. That proposal was written and Action details were untouched, but it was neither priced nor checked as a whole. The prompt now sends any "draft/redraft" request to `redraft_document` or `draft_document`, and keeps `propose_document_text` for text the owner asks Lex itself to write. The re-run took that path.

⚠ In that run Lex also called a code-text document a "draft clause", after a `read_document` failure that did not say the kind. The failure now names the kind and title.

**Regression: 3 of 13 ran before the machine ran low on memory and Claude Code stopped the suite.** Results:
- check:lex-26w: 66/66, 6 controls, 0 dead
- check:lex-26u: 67/67, 11 controls, 0 dead
- check:lex-26v: 66/66, 7 controls, 0 dead

**NOT RUN:** lex-26v1b, lex-26v2b, lex-26v2c, lex-26v2d, lex-287, lex-chat-real-reply, prompt-examples, llm-guards, client-boundary, check:scripts.
- **check:lex-26p** (outside the list; run after the other session found it red): **116/116, 14 controls, 0 dead**.
  - It was red on "every Change tool asks first": `generate_collision_report` was category `change` and free.
  - It is now category `run`, like `run_comparison`: it builds a generated version from data, costs nothing, and the screen's "Generate again" doesn't ask either.
- **check:lex-26v2b: 45/47 → 47/47** after two fixture fixes:
  - (a) 26-W renamed the costing's first section "Range" to "Cost lines", and the fixture now uses the template's names;
  - (b) **pre-existing, not 26-W:** since `cf58c73` (291, 28 Oct) the left-out reason reads "the Action details cite no source", while the check's regex kept "cites". The regex is now `/cites? no source/`.
- The other session reports that check:lex-26v1b's 264 (the owner's idea count) failed once while this session's scratch copies were open. They read it as a race with the copies, not code; it has not been re-run here.
- Superseded note: lex-26v2b was the one most likely to move. Its costing fixture uses the old section name "Range", and 26-W renamed the costing and specification sections.
- Web `tsc` is clean on 26-W's files. The only errors are in `components/lex/AddResearch.tsx`, the other session's file, mid-edit.

## Spend

All on scratch copies, `purpose = check`, about **84p** in all:
- code-text drafts 4.71 + 4.91 + 4.71 + 4.52 + 4.57 + 4.69 + 4.82 = **32.93p**;
- chat turns 30.01 + 16.59 = **46.60p**;
- one confirmed redraft at about 4.7p (the card's price; the ledger has the exact figure).

## Shared files — the commit has to be agreed

Another Lex session (297, CCh-Lex 2 Nov (1) B: "not found" replies and the sources browser) is editing this tree now. **`lib/lex/agent/honesty.ts`, `lib/lex/agent/system-prompt.ts`, `package.json` and `docs/CHANGE_LOG.md` carry both streams' changes.** Under the root CLAUDE.md, those files are committed once, by agreement, naming both streams' work. They are not split hunk by hunk. 26-W's other files are its own:
- `tools.ts`, `loop.ts`, `types.ts`, `turn.ts`;
- `action-documents.ts`, `document-drafting*.ts`, `source-text.ts`;
- `check-lex-26w.ts`, `apply-26w-305.ts`.

## §8 — only Charlie can confirm

1. **D.207.2 "Code text"**: Lex's proposal (the 2 Nov chat draft, 15,606 characters) in the document view. Use it, edit it, or ask for a redraft. A redraft now produces a Code like the scratch runs above, at about 4.7p.
2. A redraft from chat compared with one from the button. Both now run the same drafter (`draftKindDocument`).
3. "What is the Order section for?" Ask Lex in chat: it should answer from `explain_field` (the record's Order section, and `set_action_order`).
4. Whether D.207.1 (the dismissed enabling clause) should be redrafted or left as it is.
