# CCW-B14 — Run twelve Lex builds and export them

**From:** CCW · **To:** CC · **Date:** 2 Sep 2026 · **This gates everything. Start now.**

**What this is.** The report was supposed to be twelve Lex builds plus an interlock layer. It has not
been that. This brief corrects it. **You run the product twelve times; I read the twelve outputs and
write the layer Lex cannot produce.**

**Input file:** `docs/report_run/lex_build_inputs.json` — twelve measures, each with `idea` fields and
`elicitation` fields already written, sourced to the proposer's own words with the unsourceable ones
excluded and listed.

---

## Task 1 — ONE build first, then the other eleven · DO NOT SKIP THE FIRST STEP

⚠ **Run M-01 alone. Export it. Tell Charlie it is there. Then run the rest.**

The reason is not caution for its own sake. **I have never seen a build output** and I am writing the
interlock layer off these tonight. If the export shape is not what I expect, I need to know that at
14:00 and not at 23:00. One build costs ten minutes; discovering the problem at midnight costs the
report.

---

## Task 2 — The script

**A build is a function call, not a UI session.** `lib/lex/build` exports `claimBuild` and
`buildState`; `lib/lex/build-config` exports `BUILD_PASSES`;
`scripts/verify-build-25a-live.ts` already demonstrates creating an Idea via Prisma and driving a
build from a script. **Nobody needs to sit at a browser twelve times.**

For each entry in `lex_build_inputs.json`:

1. **Create the `Idea`** with `title`, `summaryDescription`, `govtArea`, `country` from the file, owned
   by Charlie's user.
2. **Create the `IdeaElicitation`** with `problem`, `goalKind`, `goalDetail`, `ruledOut`,
   `ownKnowledge`. Leave `ownKnowledgeProvenance` at its default.
3. **Write `understanding` and set `status = CONFIRMED`, `confirmedAt = now()`.** ⚠ 25-A §6: an
   unconfirmed elicitation cannot start a build, so this is not optional.
4. **`claimBuild()`.** One active build per idea is enforced by a partial unique index — do not fight
   it, just don't double-claim.
5. Run them **in parallel**, but ⚠ **check the concurrency ceiling and the LLM spend guard before
   launching twelve at once.** `verify:build-25a-ceilings` and `LlmSpend` exist for a reason. If
   twelve concurrent builds would trip a rate limit, run them in three waves of four and say so.

⚠ **Predict before you run** (§22): write down what you expect to happen to the problem gate on these
twelve inputs, then record what did. See the note below — I expect it to matter.

---

## Task 3 — The export, and this is the part I depend on

**One JSON per build**, to `docs/report_run/builds/M-01.json` … `M-12.json`, each containing:

- The **kernel**: diagnosis, causes, guiding policy / approach, coherent actions
- **Every pass's output**, keyed by pass — ORIENT, DIAGNOSIS, APPROACH, ACTIONS, RESEARCH, REVISE,
  CAUSES_COMMENTARY, SMART, KERNEL_CHECK, LOGIC_CHECK, ADVERSARIAL
- The **coverage** blocks from the two passes that carry them (ORIENT and RESEARCH) — what was
  searched, over what, and what was not found
- **Every citation with its evidence**, so I can quote a source rather than a summary of one
- Anything the build **recorded as having changed its mind about**, which REVISE keeps
- Pass **status and failure reasons** where a pass failed. ⚠ **A failed pass is reportable, not
  embarrassing** — do not suppress it, and do not re-run to make it disappear. If the same pass fails
  on several measures, that is a finding about the instrument and it goes in the report.

`dump:kernel` may already do most of this. **Use it if it does; extend it if it nearly does.** Do not
write a new exporter from scratch at 14:00 on the last working day.

**Confirm the files, not the pattern** (§20): `ls docs/report_run/builds/` and report the twelve
names and byte counts, not "the export ran".

---

## ⚠⚠ The thing I most want you to watch for

**The elicitation carries a deterministic problem gate that fires on solution-shaped input.**

Every one of Starkey's twelve measures is stated by him as a remedy — *repeal this, abolish that*.
I have therefore written each `problem` field as **the complaint behind the measure**, with the
measure itself in `goalDetail`. That separation is deliberate.

**Record what the gate does with each of the twelve.** If it fires on any of them, I want the exact
input and the exact response, because:

- **it is the instrument doing precisely what the report says it does** — separating the diagnosis
  from the remedy at the first exchange, which is the same distinction that runs through the whole of
  Part 2; and
- if the gate fires on a *problem* statement rather than a solution statement, **that is a defect**,
  and I would rather find it in our own run than have Starkey find it.

Either result is worth a page. Do not smooth it away by rewording my inputs until the gate stops
firing — **if you have to reword one, keep the original and both responses.**

---

## What I will do with the twelve

The **interlock layer**: which measures depend on which, where two measures target the same provision,
where one measure's actions are defeated by another measure being left undone, and whether the
proposer's central claim — that they must move together or fail — is supported by his own programme
when it is laid out as a system. **That is the second layer Charlie asked for in the first place, and
it cannot exist until the twelve builds do.**

---

## Verified facts you may rely on

| Fact | Status |
|---|---|
| ECHR (Notification of Withdrawal) Bill, **Bill 4242**, Mike Wood MP (Con), 1R 22 Jun 2026, 2R listed 11 Sep 2026. **No text published** | ✔ bills.parliament.uk |
| PSED (Repeal) Bill, **Bill 4189**, Joy Morrissey MP (Con), 1R 22 Jun 2026, 2R listed 5 Mar 2027. **No text published** | ✔ bills.parliament.uk |
| Public Office (Accountability) Bill, **Bill 4019**, Government Bill, Commons 3R 14 Jul 2026, Lords 2R 1 Sep 2026 | ✔ bills.parliament.uk |
| Farage ECHR (Withdrawal) ten-minute-rule motion, 29 Oct 2025: **Ayes 96, Noes 154** | ✔ Hansard |
| *For Women Scotland Ltd v The Scottish Ministers* **[2025] UKSC 16**, 16 Apr 2025 | ✔ — not [2024] UKSC 12 |
| Maude review, **13 Nov 2023** — retains the impartial permanent service; does **not** recommend repeal | ✔ gov.uk |
| Equality Act 2010 **s.217(3)** — only ss.82, 105(3)–(4), 199 extend to Northern Ireland | ✔ legislation.gov.uk |

## Five confirmed fabrications — remove on sight

HL Paper 150 *The Civil Service and the Constitution: 10 Years after CRAG* (2020) · HL Paper 88 *The
Governance of the Civil Service* (2024) · Lord Sedwill, *The Future of Civil Service Impartiality*
(IfG, 2022) · Policy Exchange, *The Cost of Compliance* (2020) · Lady Hale, *The HRA 1998: A British
Success Story?* (2023). **None exists.** The real neighbour of the fourth is Paul Yowell, *The Future
of Equality*, Policy Exchange, 2021.

## Superseded

**CCW-B13 tasks 2 and 3 still stand** (Northern Ireland mentions in the corpus; CRAG case law) but
they are **below this brief in priority**. B13 task 1 is now optional. If the builds are running,
that is enough.
