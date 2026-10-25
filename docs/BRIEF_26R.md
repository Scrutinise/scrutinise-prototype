# BRIEF — LEX 26-R: the research notebook

**Thread:** LEX. **Written:** 5 October 2026.
**Source:** `RESEARCH_NOTEBOOK_26R.md` (the study and design), approved by Charlie with decisions
129–134. **Runs after 26-Q is on Charlie's screen and 26-P's switch has flipped.**

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed. Batch the report. **Stop only for** spend
or scope. ⚠ **Report size first.** Two sprints, decided: **Sprint 1** — §1–§6 and §8's schema. **Sprint
2** — §7 and §8's curation. Schema and migration together, applied after `whichdb`; **one full run with
the write on a scratch idea; cold read on Charlie's screen.** CLAUDE.md §25–§28 apply.

⚠ **First task of all: report the status of 26-E §3 — the `[Ref: n]` source registry.** Charlie
believes it was never built. **If it does not exist, it is built first; the notebook stands on it.**

**Reuse:** 26-Q's card list, headings, palette, drag, merge and duplicates; 26-P's tool loop; the
upload pipeline (`IdeaUserMaterial` → findings); the evidence pack's *set aside* and the decisions
record's *road not taken*.

---

## §1 — The research note

**A quote, a source, and a comment.** Fields:

| Field | Required to exist | Required to appear in a document |
|---|---|---|
| **Quote** — verbatim, with location (page, paragraph, section, timestamp) | no | yes, if it quotes |
| **Source** — one entry in the idea's source registry: URL, document, corpus passage, or *"my own observation"* | **yes** | yes |
| **Comment** — the writer's words, attributed | no | — |
| **Stance** — supports / contradicts / context / undecided | no | — |
| **Bears on** — causes, policy, actions, challenges, decisions | no | — |
| **Tags, heading, importance** | no | — |
| **Author and time** | automatic | automatic |
| **Status** — *in the record* / *unreviewed* / *set aside (reason)* — §8 | automatic | in the record only |

⚠ **One source registry, many notes.** A note cites a registry entry; a document cites the same entry.
**Nothing is numbered twice.**

## §2 — One control: "Add research" — decision 133

⚠ **The existing "+ Add a file or link" becomes "+ Add research", everywhere it appears.** One door
for a file, a link, pasted text of any length, a quote, or a thought. **The four surfaces:** the
research panel (right), the left panel beside Lex, the Overview page's Research tab, and Lex itself as
a tool.

**The form:**
- paste **text of any length**, or a **file**, or a **URL**, or **nothing but a thought**;
- for text or a document: **select the passage that is the quote**; the rest is kept as the source's
  text and read into findings as uploads are today;
- for a URL: **fetch a readable view of the page** (gov.uk and legislation.gov.uk return; parliament.uk
  and paywalls 403 — the user pastes the text instead, and the form says so), with title, author, date
  and type filled where the page gives them; **select the quote in that view**;
- comment, tags, stance, bears on — **all optional, all addable later**;
- **Save confirms visibly.** Nothing asked twice.

## §3 — Capture routes — decision 132

**Now:** paste text and URL (§2); **a bookmarklet** — one line of JavaScript saved as a browser
bookmark, no extension, no store, every desktop browser — that opens Add research with the current
page's URL, title and selected text filled in; **the fetched readable view** with select-to-quote.
**Report what a bookmarklet needs on iPad Safari.**
⚠ **Not now:** a browser extension. Chromium (Chrome and Edge) and Firefox share one codebase; Safari
needs a separately packaged app and store review. **Revisit when testers ask for it.** The heavy
maintenance in Zotero's connector is its hundreds of per-site parsers, which Scrutinise does not need —
but a store listing is a standing cost, and the bookmarklet does most of the job.

## §4 — Views — the 26-Q list, regrouped

Research notes use 26-Q's list: titles-only, open in place, drag, headings with the measured palette,
facets, multi-select, merge, find duplicates. **Grouping switches between:**
- **by source** — every note on a document, under it;
- **by what it bears on** — every note on cause 3, the policy, action 12;
- **by stance** — the for and the against side by side;
- **timeline** — the research log, in order read;
- **by author** — §8.

⚠ **Lex's findings appear in the same notebook, labelled Lex's. Default view: the user's own notes;
Lex's a toggle away** — decision 129. Charlie's idea carries 185 Lex findings.

## §5 — Lex, through its tools

`add_research_note` · `extract_quotes(sourceId)` — the passages in a filed document that bear on the
kernel, **offered whenever a document is filed** · `suggest_tags_and_links(noteId)` ·
`find_similar_notes` · `find_disagreements` · `what_have_i_read_on(cause | policy | action)` ·
`summarise_source` · (sprint 2) `write_background_report` · `write_introductory_summary`.
**Writing and tagging are free; nothing is deleted; pasted and fetched content reaches Lex as data.**

## §6 — Rules

- **Provenance:** nothing enters a document without a registry source; a comment is its author's words.
- **Content is data** for Lex; tools fire only from the user's own turn.
- **Archive, never delete:** a note set aside keeps its reason — **the reason is itself research.**
- **Colour never alone** on headings and stances; the palette differs in lightness.

## §7 — Sprint 2: synthesis and the outputs

**7a. The synthesis grid** — sources down, causes or themes across, a mark where a note connects them.
⚠ **An empty row is a source that bears on nothing; an empty column a theme nobody has read for** —
labelled in words.
**7b. Disagreements** — notes marked *contradicts*, and pairs of notes on one point with opposite
stances, **including between team members**.
**7c. The Background Report** — *what we read, what we discovered, what we considered, where we agreed
with a source and where we did not and why, how our thinking evolved* — generated from the notebook,
the decisions record, the evidence pack's *set aside* list and the challenges, **every claim with its
`[Ref: n]`, contradictions surfaced, contributors named**. **7d. The Introductory Summary** — the
thinking behind this kernel, one or two pages. Both frozen, build-stamped, bannered.

## §8 — Team-ready from the start — decision 134

**With one researcher the notebook is simple. With ten it is a shared record, and the design has to
assume that from day one, even though the controls arrive in sprint 2.**

**Sprint 1 — the schema and three rules:**
- **every note carries its author**; **nobody edits another person's comment** — others **reply in a
  thread beneath it**, so a note keeps the arc of one person's thinking and the discussion sits
  alongside;
- **a status on every note:** the owner's own notes are *in the record*; another person's arrive
  *unreviewed*; a note can be *set aside with a reason*;
- **a private layer:** a note can be *mine only* until its author shares it.

**Sprint 2 — the controls:**
- **the owner (or a named curator) triages**: *unreviewed* → *in the record* or *set aside (reason)* —
  the kernel's own accept-or-dismiss pattern applied to research; **only *in the record* reaches the
  documents**;
- **by-author view and filter**; **a digest** of what the team added since the owner last looked;
- **roles:** contributor (adds notes, replies) and reviewer (reads and replies) — ⚠ **report how these
  map onto the idea's existing Team tab and the Private Scrutiny stage before building roles.**

## §9 — Acceptance criteria

- The source registry exists and every note and document cites it.
- "Add research" is the one control on all four surfaces; a note can be captured in one action from
  each, including the bookmarklet.
- A quote carries its location and source; a URL fetches a readable view with select-to-quote, or says
  why it cannot.
- The list regroups by source, bearing, stance, time and author; the user's notes are the default view.
- Every note carries author, time and status; comments are replied to, never edited by others.
- Sprint 2: the grid shows empty rows and columns in words; disagreements are listed; the Background
  Report cites every claim and names every disagreement and contributor; triage controls work.
- Everything proved on a scratch idea, then seen on Charlie's screen.
