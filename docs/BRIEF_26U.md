# BRIEF 26-U — LEX: something to scrutinise — drafting instructions, illustrative clauses, what each clause touches, the idea↔law join

**From CCh-Lex, 22 October 2026.** Follows 26-T. Charlie's position, firmly held: *"To have scrutiny you must first have something to scrutinise."* Decisions carried: 144, 148, 209, 210, 220–223, 226. New: 227–229 (§1). Specification of record for the join: `IDEA_LAW_JOIN_SPEC.md` (CCh-Search, 19 Oct) as amended (text uuids; relation `modifies`). Effects reader: GRAPH 6, live. Join table and panel: GRAPH 7, in build.

---

## §0 Run mode

- As BRIEF_26S §0: continuous; diagnose → CHANGE_LOG → proceed; batch the report (`docs/LEX_26U_REPORT.md`); stop only for spend or scope; CLAUDE.md §25–§31; cold reads; scratch-idea full run before done; `check:prompt-examples`; Charlie's screen is the last check; handoff_summary at every push.
- **Overnight run.** §2 (the data defect) first — it is corrupting Charlie's edits now. Then §3 and §4 (drafting and touches), which need nothing from GRAPH 7. §5 (the join rows) only once `idea_law_link` exists on Main; if it does not by the time §4 is done, stop and report.
- **Prices from measurement**; every button "measured (n=…)" or "estimate"; asks-first above ~5p.
- **No real user's words in any prompt** (§27). The OPC Drafting Guidance is held (`quangos-govuk:government/publications/drafting-bills-for-parliament:2`, tier guidance); Lex drafts to it and cites it.
- **Honest states on every drafting output:** the effects data's load date and unclassified counts come from the data (210), never a fixed sentence; a Bill is "before Parliament — not yet law"; an Act we do not hold is "named, not held", distinct from "no such Act" and "lookup failed".

---

## §1 Decisions

| # | Decision | Where |
|---|---|---|
| 148 | Drafting instruction + illustrative clause as one object; the caveat cannot be separated from the clause | §3 |
| 144 | Near provisions flagged with a consistency question (merit, s.10) | §4 |
| 209 | Unclassified "modifies" rows printed as unclassified, never as zero | §4 |
| 210 | The caveat comes from `describeCoverage` and the data | §4 |
| 220 | "Publicly funded body" = FOI Sch 1 bodies by statute, extended by the Procurement Act contracting-authority test; everyone else by condition of funding; phased: departments → arm's-length bodies → the rest | §3b (clause 1) |
| 221 | The goal statement is published; the full accountability record is visible up the line, to Parliament and the NAO | §3b (clause 3) |
| 222 | The PSED action: amend or remove the duty; the standard that remains is selection on merit on fair and open competition (CRaG 2010 s.10), enforced by the structure, no separate duty or reporting | §3b (clause 7), §4 |
| 223 | The five precedents attached as `precedent` rows and drafted *from* | §3c, §5 |
| 226 | `modifies`; `as_at` = law as held; drafting instruction on the action record; locator + url on quotation notes | §3, §5 |
| **227** | Imported "More on this action" material is Commentary, not statement; editing never truncates — a refusal keeps the text | §2 |
| **228** | A drafting instruction is a structured record on the action (section 6), versioned, and the clause is drafted from it, never free-hand | §3 |
| **229** | "What this touches" is computed from the drafting instruction's named provisions plus the effects reader, and printed with the three honest states; the consequential schedule is generated, counted in the report, listed in an annexe | §4 |

---

## §2 First — the editing defect (227)

**What Charlie saw (22 Oct, #38):** the opened record's statement holds his sentence *plus* seven "— More on this action, imported 2026-10-18 (From: [Ref: 213] …) —" blocks, which the import appended to the body (26-S1 §3e allowed "append to the body" before the Commentary field existed). The statement is therefore far over 1,000 characters. On Edit, deleting one word triggered the 1,000-character rule and **90% of the text vanished**, with no undo but Cancel.

**Fix, in this order:**
1. **Migrate**, on every idea: every "— More on this action, imported …" block (and any "Adds to" append from the import pass) moves from the statement into Commentary under "Parts of this action, quoted", keeping its source line and quotes verbatim; the statement keeps only the text that was there before the first append. Read back: no statement over 1,000 after migration; count of blocks moved per idea in the CHANGE_LOG. Nothing deleted; the pre-migration statement kept as a revision.
2. **Editing never truncates.** An edit box with over-limit content shows the counter red and refuses Save with "Not saved: the statement is N characters; the limit is 1,000. Move the extra into Commentary or shorten." The text stays exactly as typed. Cancel restores. Rule 168 applies.
3. **The import pass writes "Adds to" into Commentary from now on**, never the statement.
4. Check: a 3,000-character statement fixture → migrated to ≤ 1,000 + Commentary; an edit over limit is refused with the text intact; browser-asserted on the real card.

---

## §3 The drafting instruction and the illustrative clause (148, 228)

**3a. The record.** Section 6 of the action record ("Draft text") becomes a structured **drafting instruction** plus the **clause**:

| Field | Content |
|---|---|
| Instrument | Act (new) · amendment to an existing Act · statutory code · statutory instrument · management code · guidance |
| Amends / inserts into / repeals | the Act and provision(s), in legislation.gov.uk form (`ukpga/2010/25`, `section/5`) — one line per provision, with relation (`amends` · `repeals` · `relies_on` · `constrains` · `modifies` · `precedent`) |
| Duty on whom | the person or body |
| Enforced how | by whom, with what consequence |
| Commencement | when, and by what (Royal Assent / order) |
| Extent | England and Wales · Scotland · Northern Ireland · UK |
| Precedent drawn on | which of the five, and which provision |
| The clause | illustrative wording, numbered, in OPC style (short subsections, defined terms, duty → person → consequence), with its caveat as the first line: *"Illustrative, not settled: drafted by Lex to the Parliamentary Counsel's guidance from the instruction above; not Parliamentary Counsel's text."* |
| Version | every save a version; the previous kept |

Only legislative-avenue actions get the full set; organisational and financial actions get Instrument, Duty on whom, Enforced how, and a plain-English wording instead of a clause.

**3b. Lex drafts.** "Draft this clause" on a legislative action (asks-first, measured): Lex reads the action's statement, Commentary, who/how/against, the policy, the conditions, the OPC guidance (`read_section` on the relevant parts: 5.1 citation, 6 amendments, 9.2 enabling powers), the precedent's text where held (`read_section`), and writes the instruction fields and the clause as a **proposal beside** anything the user wrote. "Draft all legislative actions" runs it over the heading, on the worker, resumable, price measured.

The first four clauses are fixed by decision and must come out in this shape:
1. **Definition** (220): "publicly funded body" = a public authority listed in Schedule 1 to the Freedom of Information Act 2000, and a contracting authority within the Procurement Act 2023 in respect of work done under contract; with a power to extend by order; phasing in commencement (departments → arm's-length bodies → the rest); the condition-of-funding mechanism named as a financial action, not drafted here.
2. **The named-owner duty** (#38): no work begins or continues without one named individual; the pair (duty + means) voided if unmatched, the duty travelling upward; the written statement before work starts (task, purpose, measure).
3. **Visibility** (221): the statement published; the record visible up the line, to Parliament and the NAO.
4. **The Code** (the Civil Service Code action): issued by the Minister for the Civil Service, laid before Parliament; changed only to improve the service in line with the general principles; the Code itself held to the brevity test.
Then the rest of the heading, including:
7. **The equality duty** (222): amend or remove Equality Act 2010 s.149 for bodies within the definition; the clause states that selection and advancement are on merit on fair and open competition as CRaG 2010 s.10 requires; no separate duty; its collision report (§4) printed beside it.

**3c. Precedents in the drafting.** Where a precedent holds the mechanism (Building Safety Act 2022 "accountable person"; FSMA 2000 as amended 2013 "statement of responsibilities"; Local Government Act 1972 s.151; Health and Care Act 2022 safe space), Lex cites the provision beside the clause and may adapt its wording, saying so. Corporate Manslaughter and Corporate Homicide Act 2007 is cited as the objection ("the last attempt at this did not bite on large organisations") in the clause's caveat, not as a model.

**3d. Check:** a fixture action produces a clause with every instruction field, the caveat first, OPC citations by section id, at least one precedent citation where one applies; a user-written clause is never overwritten; a re-draft is a new version with the old kept.

---

## §4 What this touches (144, 209, 210, 229)

**4a. Computed, not written.** From the instruction's named provisions:
- For each **amends / repeals / modifies** target: the provision's held text (`read_section`), and the **onward effects** from the GRAPH 6 reader: per-type counts (amends / repeals / modifies, with "N change the words, M do not" and the unclassified count), the load date, the source split — exactly as the tool returns them, never summarised into a total.
- For each **relies_on**: the enabling power and what has been made under it.
- For each **constrains**: the constraint's text and, where the citator has them, cases interpreting it.
- **Near provisions** (144): other provisions of the same Act on the same subject (same Part, or same defined term), listed with the question *"consistent with this action? — not yet answered"* for the user or Lex to answer. For CRaG this must surface s.10 (merit) and s.5 (the Code) beside any clause touching Part 1.
- **Unresolved** in words: "named, not held" / "no such Act" / "lookup failed" — three states, never an empty list.

**4b. The consequential schedule** (229): across the heading, one generated annexe — every provision the clauses amend or repeal, with what else that change knocks on to, counted per Act in the report body ("Primary legislation: 11 provisions amended, 3 repealed; 47 onward effects, of which 9 do not change the words; 12 unclassified") and listed in full in the annexe. This feeds the action "Consequential amendments and repeals" that Charlie keeps under Primary legislation (its Commentary links to the annexe; it is not retyped).

**4c. Where it shows:** section 7 of the record ("What this touches") and the Actions Pack; the Background Report prints the schedule counts and the precedent citations.

**4d. Check:** cold read on a scratch action amending CRaG s.5: the held text appears; the effects counts match the tool; s.10 is listed as a near provision with its question; a Bill target renders "before Parliament — not yet law"; a made-up Act id renders "no such Act"; an Act named but not held renders "named, not held".

---

## §5 The join (223, 226) — only once `idea_law_link` exists on Main

- Every provision line in a drafting instruction writes one `idea_law_link` row: `source='drafting_instruction'`, `source_detail` = action id + version, `action_id` set, `relation` as given, `as_at` = the effects data's load date, `note` = the instruction's one-line purpose. Superseding a version supersedes its rows (never deletes).
- Precedents named in instructions write `relation='precedent'` rows.
- Charlie's hand-attached rows (via GRAPH 7's script) are read, never duplicated: if a hand row and an instruction row name the same provision and relation, the panel shows one line with both sources.
- Report `ideaLawSet(452c5ade)` after the first "Draft all" run: rows by relation, held / named-not-held / no-such-id.

---

## §6 Verification — `check:lex-26u`

1. §2: migration counts; no statement over 1,000; over-limit edit refused with text intact (browser).
2. §3: the fixture clause with every field and the caveat first; versions kept; the four fixed clauses on a scratch copy of 452c5ade read as decided (definition cites FOI Sch 1 and the Procurement Act; visibility splits statement from record; the PSED clause cites CRaG s.10 and no new duty).
3. §4: the four honest states; near provisions; counts equal the tool's; `check:prompt-examples` green.
4. §5: rows written and superseded correctly; no duplicates against hand rows.
5. Regression: the 26-S2, 26-T suites green; known-red fixed or retired.

---

## §7 Only Charlie can confirm

- #38 after the migration: his sentence alone in the statement, the seven imported blocks under Commentary, and an edit that saves.
- The first drafted clause (the definition) read against 220.
- The PSED clause against 222.
- "What this touches" on #38: does the near-provision question on CRaG s.10 read as he would ask it.

## §8 Not in this sprint

Costing (the Deepening); the stated-positions and committee quotation rows (Ingest); the demonstration page (Graphs + Lex, after GRAPH 7); Stage 4 review roles; the remaining hard-delete paths and 11d (still queued).
