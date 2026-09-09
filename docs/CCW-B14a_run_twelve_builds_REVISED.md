# CCW-B14a — Run twelve Lex builds and export them · REVISED after CC's survey

**From:** CCW · **To:** CC · **Date:** 2 Sep 2026 · **Supersedes CCW-B14.** Input file unchanged:
`docs/report_run/lex_build_inputs.json`.

**CC's survey answered the question that was asked and the answer was right.** One thing needs
correcting, because the question was narrower than the plan.

---

## ⚠ The concurrency block does not apply — this is twelve ideas, not twelve builds on one

CC's finding: *"claimBuild refuses if any QUEUED/RUNNING build exists for that idea. Twelve parallel
calls on one idea gives you one build and eleven 409s, by design."*

Correct, and not what this run does. **`lex_build_inputs.json` contains twelve separate measures, each
becoming its own Idea.** One build each. The per-idea guard is never approached.

CC's own suggested shape — *"enqueue twelve builds across twelve different ideas, let the worker drain
them one at a time with `--once`, then export the IdeaBuild rows"* — **is exactly the plan. Do that.**

**And serial is fine, so do not fight the guard or raise concurrency.** Twelve builds at roughly ten
minutes each is about two hours. It is 13:00 on Wednesday and print is Thursday afternoon. **Wall
clock is not the constraint; being sure the output is right is.** Nothing here is worth putting the
search service at risk for.

---

## ⚠⚠ Pre-flight — the one that will silently eat the run

**`LEX_BUILD_DRIVER` is not set in `.env` or `.env.local`.** I checked both. `buildDriver()` therefore
returns `'client'` (`lib/lex/build-config.ts:326`), and `claimBuild` branches on it — so enqueued
builds sit there and the worker warns that it should not be running.

**The pattern for fixing it already exists in the repo:** `scripts/check-lex-25t-1b.ts:28` sets
`process.env.LEX_BUILD_DRIVER = 'worker'` in-process, **before** importing `lib/lex/build`, and the
comment says it is forced on purpose for exactly this reason.

**Do the same in the enqueue script and in the worker invocation.** ⚠ Set it before the import, not
after — the module reads it at call time but the ordering has bitten this repo before.

**Second pre-flight:** `PILOT_ALLOWANCE_THIRDS` defaults to 12 (`lib/lex/allowance.ts:78`) and is not
overridden. **Twelve full builds need 36.** Do not raise it yourself — see the decision gate below.

---

## The sequence

### Step 1 — M-01 alone. Stop. Report. · DO NOT SKIP

Create the M-01 Idea and elicitation, `claimBuild()`, run `build-worker.ts --once`, export it, and
**stop there.** Then tell Charlie four things:

1. **The export shape** — I have never seen a build output and I write the interlock layer off these
   tonight. If the shape is wrong I need to know at 14:00, not at 23:00.
2. **What one full build actually cost**, from `LlmSpend` / `check:cost-summary`. **This turns the
   allowance decision from a guess into arithmetic**, which is why this step exists.
3. **How long it took**, so twelve can be scheduled honestly.
4. **What the problem gate did** — see below.

### Step 2 — the remaining eleven, drained serially

Enqueue M-02 to M-12 and let `--once` drain them. One at a time.

### Step 3 — export

**No exporter exists; one has to be written.** Read the `IdeaBuild` rows and their relations, one JSON
per build, to `docs/report_run/builds/M-01.json` … `M-12.json`, each carrying:

- The **kernel** — diagnosis, causes, guiding policy, coherent actions
- **Every pass output**, keyed: ORIENT, DIAGNOSIS, APPROACH, ACTIONS, RESEARCH, REVISE,
  CAUSES_COMMENTARY, SMART, KERNEL_CHECK, LOGIC_CHECK, ADVERSARIAL
- The **coverage** blocks from ORIENT and RESEARCH — what was searched, over what, what was not found
- **Every citation with its evidence**, so I quote a source and not a summary of one
- Whatever REVISE kept about **where the evidence changed its mind**
- **Pass status and failure reasons.** ⚠ A failed pass is reportable, not embarrassing. Do not
  suppress it and do not re-run to make it disappear. The same pass failing across several measures
  is a finding about the instrument and it goes in the report.

`dump:kernel` may already do most of this — **extend it rather than writing a new exporter at 14:00
on the last working day.**

⚠ **Confirm the files, not the pattern** (§20): `ls -l docs/report_run/builds/` and report twelve
names with byte counts.

### Step 4 — the .gitignore, before the first export lands

`docs/report_run/.gitignore` covers `*.docx`, `starkey_hits.json`, `register_candidates*.json` and
`sources/*.pdf`. **It does not cover `builds/`.** Add it before anything is written there, on the
house rule already recorded in that file — *"if these should be backed up, R2 is the right home, not
git."*

⚠ **Verify with `find`, not `git check-ignore`** — the same trap the file's own comment records.

*(`lex_build_inputs.json` is mine, is a report deliverable, and contains no transcript material. It
stays tracked.)*

---

## ⚠⚠ The thing I most want watched: the problem gate

The elicitation carries a deterministic problem gate that fires on solution-shaped input. **Every one
of Starkey's measures is stated by him as a remedy** — repeal this, abolish that. I have therefore
written each `problem` field as the *complaint behind* the measure, with the measure itself in
`goalDetail`. The separation is deliberate.

**Record what the gate does with each of the twelve — `problemGateFired`, and the exact text.**

- If it fires, that is **the instrument doing precisely what the report says it does** — separating
  diagnosis from remedy at the first exchange, which is the distinction running through the whole of
  Part 2.
- If it fires on a genuine *problem* statement, **that is a defect**, and I would much rather find it
  in our own run than have Starkey find it.

**Do not reword my inputs until the gate stops firing.** If one has to be reworded to proceed, keep
the original, the response, and the reworded version. Either outcome is worth a page.

---

## Decision gate for Charlie — do not proceed past step 1 without it

**`LEX_PILOT_ALLOWANCE_THIRDS` must go from 12 to at least 36** for twelve full builds. That is a
spend decision and it is Charlie's, not ours. **Step 1 exists so that he decides it knowing what one
build actually cost rather than estimating.** Report the number and wait.

---

## Two open items from CC's survey

1. **Whether the worker drives in production** — unresolved because `scrutinise.co.uk/api/health`
   returns a Cloudflare 403. **It does not matter for this run**: we are driving locally with the
   variable forced in-process. Leave it; do not spend the afternoon on it.
2. **Build output contains idea content.** Here the ideas are ours and the material is a public
   lecture series, so there is no third-party confidentiality problem — but the gitignore rule in step
   4 stands anyway, on the house rule.

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

## Priority

**This brief first.** CCW-B13 tasks 2 and 3 (Northern Ireland mentions in the corpus; CRAG case law)
still stand but sit below it. B13 task 1 is optional.
