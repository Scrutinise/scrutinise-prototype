# BRIEF 26-S — ADDENDUM 1 (16 October 2026)

**From CCh-Lex, after reading `docs/LEX_26S_REPORT.md` and CC's closing note.** Sprint 1 is accepted as built and live at `a535920`, pending Charlie's browser pass. This addendum carries Charlie's answers to 153–156, four new decisions (158–161), and the order of the next work. §0 run mode of BRIEF_26S applies unchanged.

---

## §A Charlie's answers — act on these now

| # | Answer | What CC does |
|---|---|---|
| 153 | **Yes** | §8a: restore the hard-deleted action from its `ActionIdea` row as a **ruled-out** action on 452c5ade, reason = the verdict text; read back; it appears under "Ruled out and merged away" |
| 154 | **Yes** | §8b: build the feedback admin list (status new / looked at / fixed / not doing; notes; attachments openable; bug reports show the technical block). Small; before 26-S2 |
| 155 | **Size first** — sized at 3–4 h, 34 Lex / 29 Central / 17 elsewhere | See 161 below |
| 156 | **Both confirmed** | §8d: change nothing. Record in the CHANGE_LOG that "entered the Deepening" = a user-started Deepening pass exists, and that the two briefing documents stay Stage 1 |
| 157 | Charlie will read the string any time | **Closed for this push**: CC read `a535920` off `/api/health`. The human half is the browser pass (1d), which is Charlie's. Every future push: name the string in the CHANGE_LOG entry at push time |
| `LEX_AGENT` | Production value is **`cl@scrutinise.org`** | See 158 |
| 8e | Rule out #10 | **After** Charlie reports the browser pass, as the brief says |

---

## §B New decisions

**158 — Flip `LEX_AGENT` to `all`, then remove the old Lex code path.** *Recommendation: flip once Charlie reports the browser pass clean; remove the old path in 26-S2.*
Why: the value is `cl@scrutinise.org`, so only Charlie has the new Lex. Everyone else (Angus included) has the old Lex, which cannot see the registry, the notebook, the import pass or any of the 26-Q/26-R tools — yet those controls are now on everyone's screen. Decision 123 was "replace, do not run two"; the pilot (122) has run since 4 October. The old path (`app/api/ideas/[id]/lex/route.ts` ~105–631) stays until the flip is confirmed on Charlie's screen, then goes, with its tests retired by name.
Charlie's action after the flip: open an idea as a second account (or ask Angus) and confirm Lex answers from the new path — the running cost line in the panel ("This conversation has cost …") is the tell; the old Lex never showed one.

**159 — Fix the cause-numbering race and the three bad rows.** *Recommendation: yes, in 26-S2, schema and migration together.*
What CC found: `check:lex-25s` is red on real production data — idea `9910c16e` has an unnumbered cause and two causes numbered 4; idea `f73f3928` has two causes numbered 2. The pairs were created ~20 ms apart: a build numbering causes by "count + 1" in parallel, the same fault that mis-ordered actions on 8 October. Why it matters: "Cause 4" is printed in documents and cited by the gap check, the coverage grid and the notebook's bears-on; two causes with one number make every such reference ambiguous.
Fix: a database trigger assigning cause numbers exactly as `lex_action_number_trg` and `lex_source_number_trg` do (one past the highest ever used, never reused); then renumber the three rows with the reason in the CHANGE_LOG and read back; `check:lex-25s` green. Report any document or finding on those two ideas that cited the duplicated numbers.

**160 — Finish the check sweep and classify every red suite.** *Recommendation: yes, before 26-S2 code.*
The sweep stopped at `check:lex-26n-tidy` on low memory; sixteen more suites were red before it stopped and the rest were not run. Rule 16: known-red checks are fixed or deliberately retired, never left red. Run the sweep **in parts** (one suite per process if the machine needs it); for each red suite record one of: *stale assertion — updated, citing the decision* / *real defect — listed for a decision* / *retired — with the reason*. **`check:prompt-examples` has not run and 26-S1 added prompts: run it before 26-S1 is called done** (rule 12).

**161 — The 80 bare rejections, by stream.** *Recommendation: Lex's 34 inside 26-S2 (mechanical: route them through `lib/api-rejection.ts`); Central's 29 by hand-off note to the Central session; CC names which stream owns the 17 "elsewhere" and they go to it.*
Why not leave them: a bare "not valid" is a defect by CLAUDE.md §30; the helper exists; the cost is proportion of 3–4 h.

---

## §C Record-keeping

1. **The unrecorded push.** `7a28d52` (26-R sprint 1 + the 8–9 Oct fixes) was on production before 15 October and no CHANGE_LOG entry says when or by whom. Add the entry now: the sha, the date from `git log`, the session that pushed if the reflog shows it, and the note that in a shared tree a push of `Main` by any session carries every local commit. Why: the log is the record; a push nobody logged is how 1 September happened.
2. **`entity_list_v5.md` Section 24**: add `ActionImportPass`, `ActionHeading.purpose`, and the 26-R tables (`IdeaSource`, `ResearchNote`, `ResearchNoteReply`) if not already there. (Charlie's instruction, via this addendum.)
3. **Attribution**: confirm the import pass's ledger rows carry user, idea and pass id (the 29 Sep ambient-context rule), so the ~13p per 1,000 words is attributable. Report the rows from Charlie's first real run.

---

## §D Order of the next work

1. §A items (153, 154, 156) and §C 1–2 — small, now.
2. 160 — the sweep, `check:prompt-examples`.
3. **Wait for Charlie's browser pass and his real import run.** His run on the OpenAI document is the first real test of the mapping table; what he changes in the table is the feedback. Do not start 26-S2's data moves before it.
4. 158 — flip on Charlie's word.
5. **26-S2** begins with the **§4a field-mapping report** (what the body text, `Who`, `Target`, `Impl`, `Enforce`, `Friction` hold today, row counts, and the proposed mapping onto the eleven sections) — **report only, stop for Charlie's sign-off** — then build §4, the rest of §5, §7, 159, 161 (Lex's 34), the old-Lex removal.

---

## §E What only Charlie can confirm

- The browser pass (1d), on scrutinise.org, in order; screenshots of anything wrong.
- The real import: file the OpenAI document through "+ Add research", press "Import actions from a document", review, confirm; then "Title these for me" and "Classify with Lex" as offered; send screenshots of the table before confirm and the list after.
- His policy note (6d), through Lex: "note this for the policy: …".
- 158 after the pass; a second account's view after the flip.
- The Search relay (Managing Public Money; departmental Annual Reports and Accounts 2015-16 to date; dates on `nao-reports`; Central's 29 rejections to Central).
