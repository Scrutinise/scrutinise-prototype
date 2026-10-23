# LEX 26-U REPORT — drafting instructions, illustrative clauses, what each clause touches

**Run:** 22 Oct 2026, overnight, in the brief's order (§2 → §3 → §4 → §5 gate).

**Status at 22:58 UTC, 22 Oct (this replaces the 02:41 status):**
- §2, §3 and §4 are **pushed and live** at `64d30c2`. See §20.
- §5 is **built and committed locally** (`279f5e5`, `6bc36ca`) on GRAPH's `09e8939`/`e2b60d2`/`9aa989f`. **Not pushed:** Railway incident QH8L8B3E ("Railway Platform Outage") still read "Identified" at 22:56 UTC, and CCh's 22 Oct (7) holds the push until it clears.
- `check:lex-26u` passes **49/49**, with 6 controls and none dead.

**Status at 02:41 UTC (superseded):** §2–§4 built, 40/40; §5 stopped because `idea_law_link` was not on Main; nothing pushed.

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
- ⚠ The **"Consequential amendments and repeals" action** under Primary legislation is not created or linked yet.
  - The heading was renamed "Legislation" → "Primary legislation" on 452c5ade (decision 187, 22 Oct).
  - The action is CCh's 233. CCh's 22 Oct (7) gives its statement verbatim; it is the next item.

## §5 — the join: BUILT, committed locally (`279f5e5`, `6bc36ca`), not pushed

GRAPH 7 landed locally (`09e8939`: `withdrawn_at`/`withdrawn_detail` + CHECKs, applied to Neon), so the gate opened.

- **Writer:** `lib/lex/action-law-rows.ts` → `writeInstructionRows(ideaId, actionId, v, { asAt })`.
  - It is called from `saveVersion` and `acceptProposal` in `action-draft.ts`, and **only an owner's version writes rows**. A proposal from Lex never does.
  - Each provision line becomes a row with source `drafting_instruction`, `source_detail` "<action id> v<N>", the line's relation, and note = the instruction's purpose. Each precedent becomes a `precedent` row.
  - **Every target goes through GRAPH's `resolveLawTarget()` first.** A target that is not held is not written; it comes back in `notHeld` with its state.
  - `as_at` = GRAPH's `effectsLoadDate()` (**2026-07-05**), falling back to the save date (`6bc36ca`, after GRAPH's `e2b60d2`).
- **Never deleted.** A target that reappears in a later version is superseded by the new row.
  - ⚠ **A version that DROPS a target writes nothing at all** and returns `notSuperseded` > 0. GRAPH asked that no withdrawal be written until its reader is on origin/Main, so a stale row is never left reading as current. When GRAPH says it is live, that hold becomes a withdrawal (`withdrawn_at` + "<action> instruction v<N>: target absent").
- **Reader:** GRAPH's `mergeLawLines()` (`e2b60d2`) gives one line per (relation, target) with every source on it. ⚠ On a merged line, the top-level `row.action` may be the hand row's (null).
- **On Charlie's idea:** 452c5ade has **0 live link rows**. The #38 and #202 drafts are proposals, so they write nothing until he accepts or saves one.

## §6 — verification

| Suite | Result |
|---|---|
| `check:lex-26u` | **49/49**, 6 controls, 0 dead, 0 not run (§2 browser, §3 scripted, §4 cold read, pack and report rendered, §5 rows read back with the plain prisma client). **Mutation run** (superseding skipped): 3 failures and 1 dead control, then reverted. The 02:41 figure was 40/40 with 5 controls. |
| clean build (`check-clean-build.sh`, A and B) | **passed** before the 64d30c2 push (run as a `/cygdrive/c/cb` copy, because `/tmp` is unusable in this sandbox) |
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
3. The PSED clause against 222. *Updated:* the 232 redraft removed "must secure … on merit". CCh's 238 replaces the s.10 citation with a one-line standard for every publicly funded body; that redraft is still to come.
4. "What this touches" on #38: does the near-provision question on CRaG s.10 read as he would ask it?
5. #38's "voided if unmatched". *Updated:* the 231 redraft now drafts it (subsection (7)). It is a proposal, for him to accept.

## Spend this sprint

- Drafting: **62.6p** in all — 42.9p over the four successful drafts (the n=4 runs) and 19.7p on the two calls cut off at the old ceiling. The three schema-rejected calls cost nothing.
- The live 212 check: 14.4p.
- The #202 policy test: 1.17p.
- All of it is on the ledger.

## After the run — 22 Oct (6), from CCh

- **231 (done, read back).** The decisions now head #38's and #59's Commentary on 452c5ade: 220, 221, the Code, and "The pair (duty and means) — an unmatched pair is void; the duty travels upward". The FieldRevision origin is `DRAFTING_DECISIONS_231`.
  - #38 was redrafted at 12.13p. Subsection (7): naming someone without the power and the resources has no effect, and the duty goes to the nearest individual above who holds them.
- **232 (done).** #202 was redrafted at 9.56p: (4) cites CRaG s.10 as the standard; (5) "This section creates no duty in addition to that standard". "Must secure … on merit" has gone.
  - Lex flagged that s.10 covers civil service selection only, not "advancement" and not every publicly funded body. CCh's 238 now answers that.
  - The rest of Lex's reason was cut by a 500-character clip. The limit is now 1,500 written and 1,600 parsed.
- Both drafts are **proposals awaiting Charlie**. Price: `DRAFT_RUNS` n=6, mean **10.8p**.
- **187:** "Legislation" → "Primary legislation" on 452c5ade.
- **234:** `FTS_COLD_START_MS` 120 000 ms. ⚠ Search says this hides the 86 s warm query rather than fixing it. That timing was taken during the Railway incident, so it is unproven until the incident clears.

## §20

**§2–§4 and 22 Oct (6): pushed, and verified live.**
- `origin/Main` went `041e4e3` → `64d30c2`. Production `/api/health` reports commit `64d30c2`, env production.
- **"Move the extra into Commentary or shorten."** reads back from live chunk `4f1e709a1e1ce26e.js` on /ideas/create (10:13 UTC).
  - Control: the earlier chunk `d1d792a25d5a645d.js` has "Not saved: " but not that string.
- ⚠ **build-worker: NOT verified.** `RAILWAY_API_TOKEN` answered "Not Authorized" (10:44 UTC re-test). Under CCh's instruction, that is unproven while incident QH8L8B3E affects Railway's API.

**✅ 23 Oct 00:29 UTC: §5 is pushed and verified live at `c79eb84`.**
- `/api/health` reports `c79eb84`, production.
- The merged line "Named N times — shown once, with each source:" reads back from live chunk `526a6cf30743fb97.js`.
- build-worker `ff2ae2d9`: SUCCESS, `meta.commitHash` `c79eb84cca2c`, triggered by the push.
- The old Railway token was dead ("Project Token not found"); a new one is in `.env`.
- ⚠ Before this push, build-worker had stayed on `7d7b75b` (19 Oct), so the 22 Oct pushes never reached it.

The paragraph below is kept as it was written.

**§5 (as of 22:58, superseded): committed, NOT pushed.** Five local commits wait for the incident to clear: `09e8939`, `279f5e5`, `e2b60d2`, `9aa989f`, `6bc36ca`, plus the docs commit for this update. The order then, per CCh's 22 Oct (7):
1. Re-test the original Railway token.
2. Push.
3. Read back the merged line and `/api/health`, and the build-worker's `meta.commitHash`.
