# Handover — Restoration Programme report, second draft

**Written 9 September 2026 by CCW (Cowork session running out of context).**
**For: the next Cowork conversation. Give this to it first, in full.**

---

## 1. What this is

Charlie (Scrutinise) is producing a scrutiny report on **David Starkey's constitutional repeal programme — "The Restoration Programme".** A first draft has been printed and shown to David Starkey, who was impressed and kept the copy. **A second draft is now required, for David's team and for Danny Kruger MP.**

**The global framing, in Charlie's words:** *"Our main purpose is to investigate how do we put these ideas into law."* The report is the Scrutinise product demonstrated at length: an idea goes in, and the output is what legislation would have to change, what stands in the way, and how far towards a finished legislative proposal the system can get.

**What the report is for Danny Kruger:** *"Danny wants to see what Scrutinise does. This is what it does: delivers to David's team something that is as far advanced as possible towards a finished legislative proposal, but with lots of choices and alternatives that require human decisions."*

---

## 2. The three actors — this matters, do not blur it

| | Who | What it owns |
|---|---|---|
| **CCh** | Claude Chat | Writes specs. **Feedback on the report comes back only as a separate document of proposed changes for CCW to implement** — never as edits to the report itself. |
| **CC** | Claude Code on Charlie's Windows machine, `C:\Code\scrutinise-prototype` | The only actor with Neon / R2 / graph credentials. Runs builds, exports, the graph, the citator. |
| **CCW** | This Cowork session | Analysis, research, drafting, document production. **Has no corpus access.** Confirmed empirically: `curl` from `device_bash` to `localhost:3000` and to `scrutinise.org` both return 000 — the desktop VM has no network. |

**Charlie is the only link between CC and CCW.** Everything passes through him.

**Naming convention, established after three mistakes:** files named `CCW-B*` are briefs for CC and must not be sent to Charlie as report content; files named `PART*` are report content for Charlie.

---

## 3. The four decisions Charlie has now made (binding)

**A1 — Whose case is it.** It is David's case, **but the draft does not claim to be his case.** Charlie's words: *"it is for David and his team to review it, check it does deliver his case (since this draft is our attempt to describe his case not a confirmed account of his case)… This is very much for him and his team and all of us to work through and develop into his case, not claiming to be his case in this first draft."*

→ The cover must say that. The current cover line stands: *"A draft for the proposers to correct."*

**A2 — Framework promoted.** The **Political Constitution vs Legal Constitution** distinction moves from 2.9 to **Part 1** and becomes the spine of the whole document. Every measure is framed against it.

**A3 — Voice.** Third person. **"Lex" is the author name for anything the system produced** — Lex meaning any of the models and all of the passes. Internal distinctions between passes and layers are team chat and stay out. Charlie: *"the reader just wants to proceed as quickly and efficiently to the legislation. Even the legislation should be proposed and wording suggested as a coherent action."*

**A4 — One document**, not two. Kruger is a legislator; what he needs is what David's team needs.

---

## 4. The voice rules — these are absolute and have been broken repeatedly

- **No "we". No "I". No "the instrument". No "us".** Charlie: *"There is no 'us' in this report."* *"Who is 'we', who is 'the instrument'?"*
- **No process chat.** No models, no passes, no drafts, no disagreements between models, no corrections to earlier versions. Charlie: *"no chat in this customer facing document, facts only."*
- **Register:** *"the report of a High Court judge. Like Lord Wolfson. Sober, facts only, and no chat or gossip about what's going on in the team."*
- **"David", never "He".**
- **Delete every instance of "the research changed my mind" / "changed the draft".**
- **All limitations move to one closing section, "Limitations of this analysis."**
- Alternatives are presented as **numbered views**: *"Alternative views on this issue: 1… 2… 3…"* — never as a narrated disagreement.

---

## 5. Where everything is

**Report source (this Cowork session, `/home/claude/report/`, mirrored to `C:\Code\scrutinise-prototype\docs\report_run\`):**

| File | Contains |
|---|---|
| `01_front.md` | Title page, "What this is" and limits |
| `02a_twelve.md` | Part 1 opener — twelve measures at a glance, provenance (287 transcripts), six stated assumptions, three surprises |
| `02_register.md` | The register: twelve entries, each *What David said / What we think it means / The law that would have to change / What stands in the way / Status*; plus four unsourced measures |
| `03_part2.md` | 2.1 absorption · 2.2 annulment · 2.3 four plans · 2.4 Scotland/Wales/NI · 2.5 who else has said what · 2.6 what is before Parliament · 2.7 where sources came from |
| `07_bingham.md` | 2.8 what happened 1997–2010 · 2.9 the PC/LC framework (**to be promoted to Part 1**) |
| `04_part3_4.md` | Part 3 interlock · 4.1 and 4.2 statute-book collision (**4.1 merges into 4.3, 4.2 into 4.4**) |
| `08_part4_full.md` | 4.3 HRA · 4.4 Equality Act · 4.5 civil service — the three worked in full |
| `09_part5_rest.md` | 5.1–5.5 |
| `06_part6_7.md` | Part 6 questions · Part 7 method and limits |
| `SECOND_DRAFT_PLAN.md` | **The full ~60-item plan from Charlie's review, assigned by owner. Read this second, after this handover.** |
| `CCW-B18_CC_BRIEF.md` | The brief handed to CC on 9 September |
| `build.js` | The docx generator |
| `mkpagemap.py` | Two-pass page-number extraction for the contents page |
| `titles.txt` / `titles_short.txt` | Section titles for the page map |

**Outputs:** `FIRST_SCRUTINY_Restoration_Programme.docx`/`.pdf` (125 pages) and `..._SHORT.docx`/`.pdf` (53 pages).

**On Charlie's machine only:** `docs/report_run/builds/M-01.json` … `M-12.json` (the twelve build exports, gitignored), `lex_build_inputs.json`, `/tmp/render.py` (the build-JSON → markdown renderer).

### How the build works

`build.js` reads a file list, concatenates the markdown, and emits docx. `VARIANT=short` swaps the file list, the output name and the page map. **A `# Heading` starts a new docx section** — new page, own header. Headers are a teal banner (`1F6F6B`) across the full text width: `PART N` bold left, section title right. Page config A4, margins `{top:1500, bottom:1100, left:1250, right:1250, header:560}`.

**Building is two passes:** build once → `mkpagemap.py` renders the PDF and extracts page numbers into `pagemap.json` → build again so the contents page carries correct numbers.

---

## 6. What is outstanding

### CCW — can start immediately, nothing blocks it

1. **The voice pass** across all nine source files (§4 above).
2. **Promote 2.9 (PC/LC) to Part 1** and reframe every measure against it.
3. **Rename Part 1** to *"What David said, and what the law would have to do"* — Charlie does not want it called "Register". Move the four unsourced measures directly under the list of twelve.
4. **Merge 4.1 into 4.3 and 4.2 into 4.4** so "three measures worked in full" is true. (Charlie: *"Part 4 says three but there are 5."*)
5. **Glossary** of terms of art, near the front, removed from the body.
6. **Fix the truncation** — paragraphs currently end in "…" at character caps. Full text; anything over ~1,500 words to an appendix.
7. **Replace the ✔ ● ○ source-confidence marks with words.**
8. **Delete** 2.7 from the client document; delete the "limit of our own, corrected before print" passage, the "largest single thing our research missed" line, and all similar asides.

### CCW — new research, no dependencies

- **Grieve's "two adverse judgments last year"** — check it, print the real number. Charlie wants the check done, not flagged.
- **Public Office (Accountability) Bill** — summary plus the arguments for and against from the debates.
- **Bank of England (1.7)** — mistakes under ministerial control vs mistakes under independence. Who was worse, what caused it, is reversal the right remedy.
- **Safety of Rwanda Act** — full treatment. What was tried, what happened, why it did not stop the boats; the demonstration that Parliament is not currently sovereign.
- **Appellate Committee vs Supreme Court** — side by side: who they were, qualifications, appointment, method, whether complex cases went back to Parliament, which worked better.
- **Sentencing (1.11)** — examples of failure, whose fault, whether consistency between crime types is delivered.
- **The 100-day question** — Reform want delivery in 100 days; ECHR Article 58 requires six months' notice. Notify first, legislate during the notice period. What holds the line in the interim; does a challenge simply run out of time.
- **Retained rights schedule (4.3)** — what is kept, the UK equivalents, the gaps, who gains and loses, including the citizen/non-citizen question.
- **Devolution amendments** — draft the actual amending wording for the three devolution Acts, as a coherent action.
- **Referring to ECHR jurisprudence after repeal** — the solution, drafted.
- **Other human rights treaties** — UNCRC, UNCAT and the rest, on the consequential list.
- **Windsor Framework interlock.**
- **Miller I and II** — Charlie: *"this has happened already via the two Miller cases."* Short and pithy: the razor-thin line between declaring an executive act void and refusing to apply an Act, and the legislative retaliation that followed (Dissolution and Calling of Parliament Act 2022, Judicial Review and Courts Act 2022, Bill of Rights Bill).
- **Jackson (2005)** and that retaliation sequence.
- **Bingham's eighth principle** sharpened to Charlie's line: *we cannot be both sovereign and subject to international law binding us.* Charlie's assessment of Bingham's sovereignty claim: *"pure anaesthesia… taking power by stealth."*
- **Belmarsh and Abu Qatada** — the two collision cases, both readings, kept short.
- **Comparative table** — US, France, Australia, Germany.
- **Bellamy** — verify it exists and get the argument, or drop it. No more "if it exists".
- **Draft clauses** for the three worked measures, clearly labelled illustrative and not settled drafting. Charlie: this is *"the thing that would most impress Kruger."*

### Charlie's substantive positions to carry into the argument

- *"To pretend this is not transferring legislative authority to judges is dishonest/disingenuous."*
- *"If the law defines the terms used by Parliament for legislation, the law has control. Every good lawyer knows that the control of a contract lies in the definitions."*
- **DEI in judicial appointment is political patronage within the judiciary.**
- **On John Laws:** *"No you're wrong"* — common law is a fine base for a political constitution.
- **CEF are arch-Remainers**, on the Legal Constitution side.
- On "it would be impossible": *"It's not impossible, it's our job. It is by definition finite."* Check whether that phrase is a quotation before keeping it.
- The circulated twelve-point list: **check whether it exists in public at all.** It came from the Gemini research pass, not from a published source. If nothing published exists, reword to *"a list attributed to David in commentary."*

### CC — in `CCW-B18_CC_BRIEF.md`, already handed over

Allowance raise to 200 thirds · kernel re-runs (the largest item) · M-01 re-run · instrument links so the statutory-consequences pass runs on all twelve · citator · people graph · cost-benefit routing · Research panel appendix · the limitations section · Gemini model check · R2 backup.

---

## 7. Standing constraints — do not breach these

- **BAILII:** terms forbid storing search results or HTML judgments and forbid robot access. Nothing may be fetched from it. Already recorded as blocked in the register.
- **Credentials:** CC alone holds Neon/R2. **CCW must not hold them and must not ask for them.**
- **Private corpus:** the 16 `.docx`, the conference PDF, raw VTT, `starkey_hits.json` and `register_candidates*.json` are gitignored deliberately — the repo pushes to GitHub, so they stay on disk and out of history.
- **Wolfson advice:** stamped "PRIVATE & CONFIDENTIAL / SUBJECT TO LEGAL PROFESSIONAL PRIVILEGE" on every page **but published by the Conservative Party.** Charlie approved: cite as a published document, name where published, imply no privileged access.
- **Charlie's email is `cl@scrutinise.org`.** `scalablefinance.com` is in liquidation — historic personal correspondence and web logins only.
- **Never sum the three detection types.** **Never present a count as complete.** **Never say a provision or case is "no longer good law"** — schema-enforced; no such column exists.

---

## 8. Error patterns from this session — read these, they will recur

1. **Specifying a check against what is in the repository rather than against what is actually running.** Happened twice in one day. A verification step that reads a startup banner from an uncommitted working-tree file cannot pass, because Railway builds from the repo. Always ask: *is the thing I am checking the thing that executed?*
2. **A guard whose scope is narrower than the thing it guards.** Six instances in a week. The retrieval assertion exists but the worker imports only the printer, so a build that retrieved nothing reported `DONE` with 11/11 passes.
3. **Treating build output as raw material for commentary instead of as the deliverable.** This produced a 45-page assembly when Charlie expected 200. His words: *"one single report from one idea is 42 pages, how is that only 45?"* The builds **are** the report; the renderer reproduces them, it does not summarise them.
4. **Blanket find-and-replace corrupting quotations.** `"the proposers" → "David"` produced "Davids" and turned a direct quotation from a build into a fabricated one. Never blanket-replace inside quoted material.
5. **Concluding a capability is unavailable after one broken path.** Charlie: *"CCh is able to work in a chrome browser on my screen, why can't you?"* Try the second route before reporting a wall.
6. **Fabricated citations.** All five in the cross-model sweep came from Gemini; every one had a real neighbour. No citation enters the client document without a second source or a corpus hit.
7. **Not flagging the calendar.** A print deadline passed while the question being answered was "is it ready to run?" Say the date and the constraint out loud.

---

## 9. How Charlie wants to be worked with

Full detail is in his preferences, but the load-bearing parts:

- **Every reply starts with three lines:** `## Reply N` (N increments per reply, restarting at 1 in a new conversation), then a bold timestamp `**DD-MM-YY; (BST) HH:MM**` fetched fresh from bash each reply — never reused — then ` ---`. He is in Lisburn, Northern Ireland; London time.
- **Plain English, always.** He reads code but does not write it. Never summarise CC's reports — rewrite them in layman's terms: **what the issue is, what it means in practice, what he must do, how it is fixed, why that fix is best.** Name the symptom he would have seen first, then the cause, then the fix. Define jargon on first use.
- **Separate clearly: what is solved, what is not, what is next.**
- **Decisions are numbered questions with a recommendation attached.** Never leave a decision implied by a finding.
- **Ask gating questions first and wait** — unless there is work CC can be getting on with, in which case put the CC brief first and say *"Give this to CC while we resolve the following points."*
- **No hope language.** Not "hopefully" or "fingers crossed". Use "expect", "predict", "if X then Y".
- **Numbers carry units** and a statement of what they are a percentage of.
- He is the business owner and you are the senior engineer; he is also learning, so explain *why*, briefly, as you go.
