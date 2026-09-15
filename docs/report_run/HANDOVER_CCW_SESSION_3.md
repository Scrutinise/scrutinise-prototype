# HANDOVER — Starkey Restoration Report, CCW session 3

**Written 14 September 2026 by CCW session 2. Paste this into the first message of the new conversation.**

***

## 0. What you are picking up

A scrutiny report on **David Starkey's "Restoration Programme"** — twelve constitutional repeal measures. First draft (125pp) was printed and given to David; he kept the copy. **This is the second draft**, for David's team and for **Danny Kruger MP**.

Charlie's stated purpose, verbatim:

>   *"Our main purpose is to investigate how do we put these ideas into law."*

and for Kruger:

>   *"delivers to David's team something that is as far advanced as possible towards a finished legislative proposal, but with lots of choices and alternatives that require human decisions."*

**Current state: three volumes built, 50 / 118 / 364 pages, delivered to Charlie and committed.** The report is substantially finished. What remains is corrections, one appendix reshape, and a final read-through.

***

## 1. The three actors — do not confuse them

|         | Who                                                                      | What it can reach                                                                                                           |
|---------|--------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| **CCh** | Claude Chat                                                              | Specs and discussion. No tools.                                                                                             |
| **CC**  | Claude Code on Charlie's Windows machine, `C:\Code\scrutinise-prototype` | **The only actor with Neon (database), R2 (storage) and graph credentials.** Runs the builds, the tests, the corpus passes. |
| **CCW** | This Cowork session                                                      | Analysis, drafting, document production. **No corpus access, no credentials.**                                              |

⚠ **Charlie is the only link between CC and CCW.** They cannot talk to each other. Every instruction to CC goes as a written brief that Charlie pastes in; every CC result comes back as a log Charlie pastes to CCW.

**Naming convention, already established and in use:**

-   Files named `CCW-B*` are **briefs for CC** (B19 … B23 delivered so far; the next is **B24**).
-   Files named `PART*` / the numbered `.md` files are **report content**.

***

## 2. Standing constraints — these must keep applying

**Legal / licensing**

-   **BAILII:** its terms forbid storing search results or HTML judgments, and forbid robot access. **Nothing may be fetched from BAILII. Ever.**
-   **The Wolfson advice** is stamped "PRIVATE & CONFIDENTIAL / SUBJECT TO LEGAL PROFESSIONAL PRIVILEGE" on every page **but was published by the Conservative Party.** Cite it as a published document, name where it was published, and imply no privileged access.

**Security**

-   **CC alone holds Neon/R2 credentials. CCW must not hold them and must not ask for them.**
-   The private corpus — the 16 `.docx`, the conference PDF, the raw VTT, `starkey_hits.json`, `register_candidates*.json` — is **gitignored deliberately** because the repo pushes to GitHub. It stays on disk and out of history.
-   **Charlie's email is** `cl@scrutinise.org`**.** `scalablefinance.com` is in liquidation — historic personal correspondence and web logins only.

**Honesty rules, schema-enforced in the product**

-   **Never sum the three detection types.**
-   **Never present a count as complete.**
-   **Never say a provision or case is "no longer good law"** — no such column exists.
-   Print counts in the honest long form: *"120 instruments identified as made under the Act; the enacting words of 60 do not name it, and one is a confirmed misattribution"* — never the bare number.

**Git discipline**

-   **No git mid-sprint.** Scoped commits by explicit path at the end.
-   **Never** `git add -A` — two or more sessions share the tree.

***

## 3. Charlie's standing editorial rules (learned the hard way)

1.  **Plain English. No jargon, no superfluous words.** If a legal term is needed, explain what it does without using its label. Charlie's words: *"you are veering into CC speak… I don't understand 'a named abrogation is leaky'."*
2.  **The symbols (⚠, ⚠⚠) are for tables where they are explained on the spot** — not scattered through prose.
3.  **"Absorption" means:** when the interpretation of a statute in common law means the effects of that statute remain after it has been removed. *(Charlie corrected an earlier wrong definition. Use his.)*
4.  **"The Common Thread"** is the name of the Part 1 framework section (was "The argument underneath all 12").
5.  **"Cost and benefit"** is the heading — ⚠ do **not** upgrade it to "Cost Benefit Analysis" until the module covers **human** costs and benefits, not only money.
6.  **Duration belongs in the workings, not the header.**
7.  Every measure ends with a **Consequential Decisions** section.
8.  **Title pages carry "Volume 1 of 3" / "2 of 3" / "3 of 3".**

***

## 4. ⚠⚠ The single most important reframing — do not get this backwards

Charlie corrected a serious error. Quoting him:

>   *"Baroness Hale is arch LC, so appeasing someone from that side is not David's plan. He wants blitzkrieg, and thorough planning to ensure the judges cannot retaliate and ruin the plan. Avoiding an argument is absolutely not the plan."*

**The legal analysis is written from the premise that the programme faces a prepared, expert, highly motivated defence — not inertia, and not an audience to be placated.** The job is to make the plan airtight against people who are very good at law.

The documented evidence for the prepared defence, now in the report:

-   *R (Osborn) v Parole Board* [2013] UKSC 61 — analysis should not "begin and end with the Strasbourg case law"
-   *Kennedy v Charity Commission* [2014] UKSC 20 — Lord Mance, "the natural starting point in any dispute is to start with domestic law"; Lord Toulson, "a baleful and unnecessary tendency to overlook the common law … it was not the purpose of the Human Rights Act that the common law should become an ossuary"
-   *A v British Broadcasting Corporation* [2014] UKSC 25 — the same reasoning applied to open justice
-   *R (UNISON) v Lord Chancellor* [2017] UKSC 51 — tribunal fees struck down on the **common law** right of access to a court, without needing the Convention

**The strategic conclusion in the report:** repealing the Human Rights Act does not restore 1997, because the courts spent a decade making sure it would not. That is evidence *for* the programme's diagnosis, not against it — but it means the programme faces a prepared defence.

**The drafting recommendation that follows (Option C):** legislate the outcome, not the doctrine. For each protection to be removed, state the rule that applies instead and provide that it applies whatever any other rule of law says. Option A (name the doctrines) is a **supplement**, not an alternative. Option B (one sweeping sentence) reads strongest and is weakest in court.

***

## 5. The leading finding of the report

Part 6.1 now opens with it, and it is the sentence that will be quoted back:

>   **Across the twelve measures the opponent found between 47 and 49 separate ways to stop them. The plan, as it stands, closes none.**

Three runs: 49 / 47 / 47 routes found; **closes 0 / 0 / 0**; partly 5 / 4 / 3; does not close 33 / 35 / 33; ⚠ **makes it easier 11 / 8 / 11**; measures with every route open 7 / 8 / 9 of 12.

>   **143 readings across three runs. Not one route was judged closed.** The ranges above are printed because they are ranges. The zero is printed because it is not.

⚠⚠ The opponent was never told the courts had been moving rights onto the common law. **It found that on its own, named UNISON unprompted, and rated the programme's fall-back-on-the-common-law proposal as making the problem worse.**

***

## 6. Files and where they live

**Cloud workspace (session-only, dies with the session):** `/home/claude/report/work/` **Authoritative copy on Charlie's machine:** `C:\Code\scrutinise-prototype\docs\report_run\report_src_v2\` **Also mirrored to the claude.ai Project** (`report_src/` and `claude/` folders).

| File                                                       | Contents                                                                                                                                                |
|------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| `00_glossary.md`                                           | 20 terms + mark legend                                                                                                                                  |
| `01_front.md`                                              | Title page + "What this is"                                                                                                                             |
| `01a_front_vol2.md`, `01b_front_vol3.md`                   | Volume 2 and 3 front matter                                                                                                                             |
| `02_framework.md`                                          | Part 1 · The Common Thread                                                                                                                              |
| `02a_twelve.md`                                            | The twelve measures + four unsourced                                                                                                                    |
| `02_register.md`                                           | Part 1 · What David said                                                                                                                                |
| `03_part2.md`                                              | Parts 2.1–2.6                                                                                                                                           |
| `07_bingham.md`                                            | Part 2.7                                                                                                                                                |
| `04_part3.md`                                              | Part 3 · the interlock                                                                                                                                  |
| `08_part4.md`                                              | Parts 4.1–4.3 — **three measures worked in full; carries the HRA rights schedule, the draft clauses, the six attacks, and the consequential decisions** |
| `09_part5_rest.md`                                         | Parts 5.1–5.9 (the other nine measures)                                                                                                                 |
| `12_part6_tests.md`                                        | Part 6.1 — **the 49-routes finding leads here**                                                                                                         |
| `06_part6.md`                                              | Part 6 questions                                                                                                                                        |
| `13_part7_limitations.md`                                  | Part 7 · limitations                                                                                                                                    |
| `20_…` – `25_appendix_f_legislation.md`                    | Appendices A–F                                                                                                                                          |
| `build.js`, `mkpagemap.py`, `titles.txt`, `pagemap_*.json` | Toolchain                                                                                                                                               |
| `absorption_v2.md`, `absorption_v3.md`, `draft_clauses.md` | Drafting workings (v3 is the plain-English version now in the report)                                                                                   |

**Scripts at** `/home/claude/report/`**:** `detrunc3.py` (provenance-filtered de-truncation), `place_appendices.py` (re-applies the standard transformations each time CC regenerates an export), `voice*.py`.

***

## 7. Build commands

```
VOLUME=vol1 node build.js      # or vol2 | vol3 | all
soffice --headless --convert-to pdf <file>.docx
python3 mkpagemap.py           # extracts page numbers from the PDF
VOLUME=vol1 node build.js      # second pass, now with real page numbers
```

**It is a two-pass build:** build → render PDF → extract page numbers → build again. The contents pages are wrong on pass one by design.

Volume file sets are configured in `build.js` under `const VOLUMES = {...}`.

***

## 8. What is outstanding

1.  **Charlie's corrections** — he has a list and has been holding it pending this handover. **Take these first.**
2.  **Reshape the for/against register (Appendix B)** — "for" first then "against", brief disclaimer, succinct reason tags, scannable tables. \~30 minutes, CCW's job.
3.  **Charlie's fourteen citator validation rows** → one line in Part 7 and a note in Appendix A.
4.  **Final read-through** for anything the last days of edits broke.
5.  ⚠ **Flag to Charlie:** CC renamed `docs/New Lex First Test - Accountability.docx` → `.local-backup.docx` during a pull. Needs checking against the repo copy.
6.  **Graph validation** — Charlie said he would do this himself.

**Explicitly dropped, with Charlie's agreement** — do not reopen without asking: Bank of England, Appellate Committee vs Supreme Court, sentencing, retained rights beyond the HRA, Convention jurisprudence after repeal, other treaties, Windsor Framework, comparative table, draft clauses for the Equality Act and civil service measures.

**Deferred until Charlie says otherwise:** the spawned-idea pass, the build-row lease, the cost-module widening.

***

## 9. Error patterns recorded — read these before writing a brief for CC

These are real mistakes made in this project, each caught by CC or by Charlie. They repeat.

1.  **Check what executes, not what is in the repo.** A fix was reported as "committed but not deployed". It had never been committed — `git log --all -S` returned nothing on any branch.
2.  **After any deploy, read** `meta.commitHash` **— never the status, never the deployment id.** `serviceInstanceDeployV2(serviceId, environmentId)` returns SUCCESS with a fresh deployment id *while building the old commit*. The mutation takes a third argument. This trapped four separate sprints, and the fix for the trap was itself trapped.
3.  **Diagnose the layer where the fault is, not the layer where it is visible.** CC's own count: CCW's briefs named the wrong layer three times in four. Example: an empty `watchPatterns` looked like the root cause; the service had never been connected to the repo at all.
4.  **Exact-string replacements, never blanket regex** when editing the report source.
5.  **Do not conclude something is lost from one location being empty** when a second location is known to exist. Nine "lost" source files were live in a still-running session.
6.  **A single chain-of-reasoning verdict is a reading, not a measurement.** Run it repeatedly and print the spread. The nine-criteria test is stable to within one test of nine; the chain-of-reasoning test returned *holds → does not hold → holds → holds* on unchanged text.
7.  **Verify every citation, including from reputable sources.** A chambers source named "the Terrorism Act 2005 within 17 days". It is the **Prevention of Terrorism Act 2005**, months later.
8.  **Only 3 of 285 recordings have a second transcript** — 98.7% have never been cross-checked. No claim that quotations are machine-verified may be made.
9.  **Counts in the build are counts of build revisions, not of things.** §4.1 printed 8 actions (true count 4) and 89 open challenges (true count 59). Check any number before printing it.

***

## 10. Verified corpus figures

-   **285 recordings, 128.4 hours, 1,172,546 words** *(not 287 — that figure was wrong)*
-   **246 case-law sources; 78 addressable; 52 not covered; 1 with a treatment** — which is exactly the index's 1.275% base rate, not a malfunction
-   **74,896 rows of court judgments, containing no House of Lords judgments at all**
-   The **661,000-word transcript index** and the **916,000-word legislation schedule** are supplied as searchable files, not printed; summaries are printed.

***

## 11. How Charlie wants to be talked to

He is the business owner; treat him as one working with a senior engineer. Direct and factual. No "hopefully" or "fingers crossed" — use "expect", "should", "if X then Y".

**When reporting a finding or a sprint result, in this order:** the symptom he would have seen → the cause → the fix. Plain English, jargon defined on first use. Never summarise a CC log — rewrite it in layman's terms. Always separate **what's solved / what isn't / what's next**. Any decision needed goes as a **numbered question with a recommendation attached** — never left implied.

Every reply opens with three lines: `## Reply N`, a bold `**DD-MM-YY; (TZ) HH:MM**` London timestamp fetched fresh from bash, then `---`.
