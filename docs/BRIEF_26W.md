# BRIEF 26-W — LEX: parity with the screen, a field guide, real drafts, full-text sources

**From CCh-Lex, 2 November 2026.** Decisions 301–306 (§1). Charlie, verbatim: *"Lex should have full access to every field the user has, and should be able to explain what each field is for, how it fits in, and be able to edit when instructed."* And on the Code draft: *"it was just a set of proposals, not an actual draft code."*

What happened on 1–2 Nov (Lex Replies 64–66 on 452c5ade), which this brief fixes:
1. "Draft what this action needs" produced D.207.1 as a **list of proposals**, not a Code.
2. Charlie asked Lex in chat for the real Code. Lex wrote a good draft, but could not save it as a draft document. It has **no tool for documents**, so it wrote all four sections into #207's **Action details**, now about 33,500 characters.
3. Lex stopped "after 8 steps without finishing".
4. Asked where the draft was, Lex said it **didn't know which control makes a document version**.
5. Charlie had filed the Civil Service Code and Management Code as sources. Lex could read only **extracts** of them, not the whole text, so it could not model the style.

---

## §0 Run mode

- As BRIEF_26S §0: continuous; CHANGE_LOG; report in `docs/LEX_26W_REPORT.md`; stop only for spend or scope; cold reads; scratch run before done; `check:prompt-examples`; Charlie's screen is the last check.
- **Do §5 first.** It is the clean-up of #207, and Charlie is working on it now.
- Size first; report the split.
- Nothing deletes. Proposals sit beside, never over. Every rejection is worded. Schema ships with or after the code that reads it. §20 read-back.

---

## §1 Decisions

| # | Decision |
|---|---|
| **301** | **Parity.** Anything the owner can do on screen, Lex can do from chat, through the **same code path** as the button. The same asks-first rules apply: a press that asks first on screen gives a priced confirm card in chat. Lex's writing is a proposal beside the owner's version. "Use it", "Accept" and "Save as version" are done by Lex only on the owner's instruction, through a confirm card. |
| **302** | **Lex knows the screen.** A field guide: every section, field and button on the action record, the documents and the research panel. For each, what it is for, how it fits, and which tool acts on it. It is generated from the same definitions the screen uses, so it cannot drift. Lex answers "what is this field for?" from it, never from general knowledge. |
| **303** | **A draft is the instrument, not notes about it.** Each document kind's template produces the thing itself: Code text reads as a Code, a clause as a clause, a specification as a specification. It is drawn from the action's Action details, and the form is modelled on the existing instrument where one is filed or held. A draft that returns a list of proposals, recommendations or "what must be done" is refused, and the reason is given. |
| **304** | **Lex reads a filed source in full.** A free tool `read_source(ref)`, the counterpart of `read_section` for the corpus, reads the whole held text of any `[Ref: n]`. A long text is read in parts. |
| **305** | **Clean-up of #207.** Lex's four sections move out of Action details into a **new version of D.207.1, as Lex's proposal**. Action details is restored to its content before 2 Nov 00:08 GMT from its FieldRevision. Nothing deleted. |
| **306** | **The step limit.** A Lex turn that writes a document runs to the end of the document. It saves each section as it lands, and "carry on" resumes (287). Report the step limit now, and raise it for writing turns. |

---

## §2 Parity (301)

**2a. Inventory first.** List every button and editable field the owner has on:
- the action record (statement, title, Action details, heading, kind, the step-2 slots, costs, order, rule out, Later phase, comments);
- the document view (Edit, Ask Lex to redraft, Use it, Accept, Set aside, Save as version, Review this document, Add a document, Draft what this action/heading needs);
- the research panel (Add research, sources, notebook);
- the Overview (Diagnosis, Guiding Policy, conditions).

For each, name the Lex tool that does the same, or "none". Report the table before building. Expect most of the gaps to be in documents.

**2b. Build the missing tools**, each calling the same server function the button calls. No second code path. Minimum set:
- `list_documents(action)`, `read_document(D)`;
- `draft_document(action, kind)` and `redraft_document(D, instruction)`: asks first, measured price, result a proposal;
- `propose_document_text(D, text)`: Lex's own words as a proposal, written a section at a time;
- `use_proposal(D)`, `accept_document(D)`, `set_aside_proposal(D)`: owner's instruction plus confirm card only;
- `review_document(D)`: asks first.

**2c. Where Lex writes.** Lex's prompt states the rule: an instrument's text goes in a document; Action details holds the action's explanation, parts and reasoning. A turn that would put more than ~3,000 characters of instrument-like text into Action details is stopped, and Lex is told to use `propose_document_text`.

**2d. Check:** for every row of the 2a inventory, the chat tool and the button produce the same stored result on a scratch copy, compared field by field. Mutation: a tool that writes through its own path (not the button's) turns the check red.

---

## §3 The field guide (302)

- One definition per section, field and button: label as shown, purpose in one sentence, how it fits (what feeds it, what reads it), limits, and the tool that acts on it.
- Kept beside the components that render them (or generated from them), so a renamed label changes the guide too.
- Given to Lex as a free tool, `explain_field(name)` and `list_fields(area)`. It is not in the per-turn prefix, to protect 293's savings.
- Check: every label rendered on the record and the document view has a guide entry. A label without one turns the check red.

---

## §4 Real drafts (303, 304)

**4a. Templates.** Rewrite the five V2b templates and the clause drafter's instruction so each produces the instrument:
- **Code text:** introduction, values or principles, then numbered duties in the form "You must… / You must not…", modelled on the filed or held Civil Service Code (`read_source` or `read_section`), drawing every duty from the action's Action details with its clause number.
- **Specification:** purpose, users, records, rules, measures, exclusions.
- **Operating text:** numbered rules.
- **Costing:** the cost lines.
- **Background note:** cited paragraphs.

**4b. Refusal.** A draft whose body is mainly proposals ("should", "consider", "recommend", lists of actions to take) or "what must be done" is refused. It is not saved, and the screen gives the reason in words. Test this with a fixture, not a word count alone.

**4c. `read_source(ref)`.** Reads the full held text of a filed source: an uploaded file's extracted text, a fetched page, pasted text. A long text is read in parts (offset, length). Report how Charlie's two filed Codes are held: full text, or extracts only?

**4d. Re-measure** the Code-text price on scratch with the new template, n ≥ 3, and replace the V2b figure.

**4e. Check:** on a scratch copy of 452c5ade, "Draft this" for #207 produces a Code: its headings follow the filed Code's structure; every duty cites a clause in Action details; and no paragraph is a proposal.

---

## §5 Clean-up of #207 (305) — first

1. Read #207's Action details and its FieldRevisions. Identify the content as at 2 Nov 00:07 GMT and the four sections Lex added at 00:08–00:12.
2. Write the four sections, in order and verbatim, as a **new proposal on D.207.1** ("Lex's draft from chat, 2 Nov"). The existing proposals-list version stays in Versions as it is.
3. Restore Action details to the 00:07 content. Keep a FieldRevision of the 33,500-character state.
4. Read back: D.207.1's proposal holds all four sections, character count reported; Action details equals the 00:07 content; both revisions exist.

Report counts. Charlie then reads the proposal in the document view and uses it, edits it, or asks for a redraft.

---

## §6 Step limit (306)

Report the agent's step limit and which turn types hit it in the last 14 days. For turns that write documents, raise the limit or let the turn run to the end of the document within the 40p turn cap. Each section is saved as it lands. "Carry on" resumes from the saved state (287).

---

## §7 Verification — `check:lex-26w`

1. §5 read-back on 452c5ade (data, cold).
2. Parity table: every row is either matched by a tool (and the 2d comparison passes) or listed as "none, by decision".
3. The field guide covers every rendered label.
4. Code-text draft on scratch: it is a Code; a proposals-list fixture is refused.
5. `read_source` on a filed long document reads the whole text in parts; a control on extracts-only fails it.
6. Lex in chat: "redraft D.207.1 as a Code modelled on [Ref: n]" produces a proposal on D.207.1 and leaves Action details unchanged.
7. Regression: 26-U, 26-V, 26-V1b, 26-V2b/c/d, 287, 235; `check:prompt-examples`.

## §8 Only Charlie can confirm

- D.207.1's proposal, after §5.
- A redraft from chat, compared with one from the button.
- Lex answering "what is the Order section for?".

## §9 Not in this sprint

Lex tools for Stage 4 review roles; Word-comment import; the radial map.
