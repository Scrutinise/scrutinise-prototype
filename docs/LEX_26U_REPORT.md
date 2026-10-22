# LEX 26-U REPORT — drafting instructions, illustrative clauses, what each clause touches

**Run:** 22 Oct 2026, overnight, in the brief's order (§2 → §3 → §4 → §5 gate). **Status at 02:41 UTC:**
- §2, §3 and §4 are built and checked: `check:lex-26u` passes 40/40, with 5 controls and none dead.
- §5 is **stopped as the brief instructs**, because `idea_law_link` is not on Main (GRAPH 7 has not landed).
- Nothing is pushed. Search's `763c620` is underneath and waits on Search's Railway token.

---

## §2 — the editing defect (227): DONE, applied to the data

| | |
|---|---|
| **Cause** | Two faults combined. The 26-S1 import pass appended "— More on this action, imported … —" blocks to the **statement**. And `BoundedInput` clamped **every** change to the limit, so deleting one word from #38's 3,196-character statement cut it to 1,000. |
| **Migration** (applied 01:55 UTC, every idea) | Only 452c5ade was affected: 11 actions, 50 blocks, 10 statements over 1,000. All 50 blocks were moved verbatim into Commentary under "Parts of this action, quoted". **Read back:** 50/50 verbatim; 0 live statements over 1,000; 0 still holding a block; 11 `FieldRevision` rows keep the pre-migration statements. |
| **#38** | 3,196 → **462** characters: Charlie's sentence alone, with the seven blocks in Commentary. |
| **Editing never truncates** | Text already in a box is never removed. An over-limit box accepts edits that shorten it, refuses edits that lengthen it, and says "⚠ N over the limit of 1,000 — shorten it to save". Save refuses with **"Not saved: the statement is N characters; the limit is 1,000. Move the extra into Commentary or shorten."** The text stays as typed, and Cancel restores it. |
| **Import pass** | "Adds to" / "Part of" now go into Commentary. |
| **Check** | A 3,000-character fixture is split losslessly. The REAL `ActionCard` in Chromium: deleting one word keeps the other 2,000+ characters, Save is refused in words, nothing reaches the API, and Cancel restores. **Mutation run with the old clamp: 4 failures and the dead-control alarm.** |

## §3 — the drafting instruction and the illustrative clause (148, 228): BUILT

- **The record.** `record.draft = { versions[], proposal? }` (`lib/lex/action-draft-pure.ts`).
  - Fields: Instrument; provisions in legislation.gov.uk form with relation (`amends · repeals · relies_on · constrains · modifies · precedent`); Duty on whom; Enforced how; Commencement; Extent; Precedents; the clause; plain wording for non-legislative actions; purpose; citations.
  - **Every save is a new version and earlier versions are kept.** The caveat is the clause's first line on every write and cannot be separated from it (148).
  - ⚠ `parseRecord` used to drop unknown keys, and every slot save writes the parsed record back. It now carries `draft` through. Saving a step-2 slot after a draft keeps the draft (asserted).
- **Lex drafts** (`lib/lex/action-draft.ts`, Sonnet 5.5, effort high).
  - Reads: the statement, Commentary and slots; the Guiding Policy; the conditions; the OPC Drafting Guidance Parts **5.1, 6 and 9.2**, cut from the held text; the five §2.4 precedents, **found by their own text** in the corpus, never by a recalled section number.
  - The Corporate Manslaughter Act 2007 is supplied as "the objection", for the caveat.
  - Output is a **proposal beside** the owner's version. Provision lines not in legislation.gov.uk form, and citations not supplied, are dropped, and the reason says so.
- **Price (measured, n=4):** 7.34p (#59), 15.41p (#38, the whole Bill), 10.00p and 10.16p (#202), giving a **mean of 10.7p**. The button says "about 10.7p, measured (n=4)" and asks first (above 5p).
  - ⚠ Two earlier calls hit an 8,000-token output ceiling: 19.7p, recorded as failed, nothing written. The ceiling is now 16,000.
- **The live drafts, on a scratch copy of 452c5ade.** The decisions were written into the copy's Commentary, because Lex drafts from the record.

| Clause | What came out, against the decision |
|---|---|
| Definition (220) | `“publicly funded body” means (a) a public authority listed in Schedule 1 to the Freedom of Information Act 2000, or (b) a contracting authority within the meaning of the Procurement Act 2023, in respect of work done under a contract`. There is a power to extend by regulations, and commencement is phased: departments → arm's-length bodies → the rest. ✓ |
| Named-owner duty (#38) | One named individual per task; the duty is never shared; a written statement (task, purpose, measure) before work; escalation of constraints, with the person retaining a constraint accountable for it. ✓ ⚠ **"Voided if unmatched" is not drafted.** Lex chose "non-compliance does not of itself make void anything done", the opposite. **This needs Charlie's eye.** |
| Visibility (221) | The statement is published (s.2(4)). The record is visible to everyone above in the line, and to Parliament and the C&AG on request (s.6). ✓ |
| The Code (#59) | Issued by the Minister for the Civil Service and laid before Parliament; revised only to improve the service in line with the principles; held to brevity and burden. It states openly that the limit is political, not legal. ✓ |
| PSED (#202, 222) | A new s.149A disapplies s.149 and the specific-duty regulations for accountable bodies, as a `modifies` relation. Subsection (3) states the standard that remains, "on merit on the basis of fair and open competition", and (4) cites CRaG s.10. There is no reporting regime. ⚠ The wording "must secure that selection and advancement … are on merit" is arguably a duty. **This needs Charlie's eye against "no separate duty".** |
| Precedents (223, §3c) | #38 adapts LGA 1972 s.151 and HCA 2022 s.113, cites FSMA s.204A and BSA 2022 s.1 for structure, and cites the CMCHA 2007 in the caveat as the objection. ✓ |

- **Draft all legislative actions.** One per action, each stored as it completes, so it is resumable. It asks first with the total price.
  - ⚠ **Runs from the page, not on the build worker** as the brief asks. Each call is under 150 s, within the route's 300 s. Moving it to the worker is a follow-up.
- **Not run on Charlie's own idea.** Drafting his actions spends money (about 10.7p each), and the 220/221/Code decisions need writing into #38's and #59's Commentary on his idea. Both are his to start; I can add the decision lines on his word.

## §4 — what this touches (144, 209, 210, 229): BUILT

- **The computation** (`lib/lex/action-touches.ts`). For each provision line:
  - the **held text** (`read_section`);
  - the GRAPH 6 reader's **per-type counts exactly as returned**: "N change the words, M do not", the unclassified count printed, the load date and freshness sentence from the data;
  - **near provisions** from legislation.gov.uk's own contents for the Act (same cross-heading, then Chapter, then Part), each with "consistent with this action? — not yet answered".
- **The honest states**, all four exercised against the real statute book:

| Case | Result |
|---|---|
| CRaG s.5 | held; s.10 "Selections for appointments to the civil service" is listed as near (same Chapter) |
| `bill/3812` | **before Parliament — not yet law** |
| `ukpga/2099/999` | **no such Act** |
| `aep/1540/42` (named in the record as `external:`) | **named, not held** |
| a lookup that throws | **lookup failed**, with its reason |

- Three defects were found by cold reads and fixed:
  - a 1911 Act held under its regnal id read "not held";
  - devolved Acts held in `regional` read "not held";
  - the Procurement Act 2023 read "not held" because the first 50 rows were explanatory notes.
- **Where it shows:**
  - The opened record has a "Draft text and what this touches" block, open on legislative actions.
  - The **Actions Pack** gains sections **12 Draft text** and **13 What this touches**. They are appended, so 1–11 keep their numbers. There is also a generated **annexe, "Consequential amendments and repeals"**, with the counted sentence.
  - The **Background Report** gains section 8: the schedule counts and the precedents drawn on.
- ⚠ The **"Consequential amendments and repeals" action** under Primary legislation is not created or linked. The idea has no heading named "Primary legislation" (the visible one is "Legislation"), and Charlie should say whether that action exists.

## §5 — the join: STOPPED (brief §0)

`idea_law_link` is not on Main: `origin/Main` is still `041e4e3`. The row-writer was not started. When GRAPH 7 lands, the drafting instruction already holds everything a row needs:
- `relation` per line;
- `source_detail` = action id + version;
- `as_at` = the effects load date (2026-07-05);
- `note` = the instruction's purpose.

## §6 — verification

| Suite | Result |
|---|---|
| `check:lex-26u` | **40/40**, 5 controls, 0 dead, 0 not run (§2 browser, §3 scripted, §4 cold read, pack and report rendered) |
| `check:prompt-examples` | 24 illustrations, 0 ever in stored output |
| `check:lex-26s2` | 221/221 (4 not run, as before) |
| `check:lex-26s2-browser` | 33/33 |
| `check:lex-26t2` | 72/72 (4 not run, as before) |
| `check:lex-26p` | 116/116 (Part B not run) |
| `check:read-section` | 9/9 · `check:lex-read-section-turn` 4/4 scripted, 5/5 live |
| `check:field-revision-on-accept` | 7/7 · `check:add-research-md-browser` 13/13 |
| `check:client-boundary` | clean · `tsc` clean |

## §7 — only Charlie can confirm

1. #38: his sentence alone in the statement, the seven blocks under Commentary, and an edit that saves. **The data is migrated now.**
2. The definition clause against 220 (as drafted above).
3. The PSED clause against 222: "must secure … on merit". Is that a separate duty?
4. "What this touches" on #38: does the near-provision question on CRaG s.10 read as he would ask it?
5. #38's "voided if unmatched": the draft says the opposite.

## Spend this sprint

- Drafting: **62.6p** in all — 42.9p over the four successful drafts (the n=4 runs) and 19.7p on the two calls cut off at the old ceiling. The three schema-rejected calls cost nothing.
- The live 212 check: 14.4p.
- The #202 policy test: 1.17p.
- All of it is on the ledger.

## §20

**Not pushed.** The push waits on Search's token question.

The string to read back off the running site after the push is **"Move the extra into Commentary or shorten."**:
- this sprint introduced it, in the action card's Save refusal;
- it ships in the Coherent Actions page's client JavaScript;
- the control is the same chunk before this commit, where it is absent.
