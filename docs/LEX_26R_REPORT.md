# LEX 26-R — Sprint 1 report: the source registry and the research notebook

**Written 9 October 2026, 00:50 UTC.** Brief: `docs/BRIEF_26R.md`. Size report that preceded it: `docs/LEX_26R_SIZE.md`.
Status: **built and verified at the database, route, library, tool and render level. Not seen in a browser. Not pushed.**

## 0 · What this report is, and is not

**Sprint 1 is done (§1–§6 and §8's schema). Sprint 2 (§7 and §8's curation) is not started** — the brief splits them and says so.
Nothing here has been used in a browser, so the brief's last acceptance line — *"seen on Charlie's screen"* — is **open**, and is Charlie's.

## 1 · The first task: 26-E §3 — did the `[Ref: n]` registry exist?

**No. It was never built.** CHANGE_LOG 24 Sep (26-E): *"§3 — SIZED, NOT BUILT"*. Confirmed on the code: no `[Ref:` in any `.ts/.tsx/.prisma/.sql`, no "Add source" control, the research panel's heading still "Key sources". Charlie's belief was right. **It was built first, as the brief says; the notebook stands on it.**

## 2 · The registry (26-E §3)

| What | How |
|---|---|
| One numbered list per idea | `IdeaSource`. **The database assigns the number** (trigger `lex_source_number_trg`: one past the highest *ever* used in the idea) |
| **A number is never reused** (26-E §3e) | A source is archived, never deleted; an archived row keeps its number. Proved: remove source 2, add another → **3** |
| Nothing numbered twice | It *points at* the three places a source already lived — `IdeaSourceDecision` (corpus), `EvidenceItem` (what a pass cited), `IdeaUserMaterial` (uploads/links) — each unique per idea. The same page added twice returns the same source |
| An unread source never looks read | `readStatus` + `readNote`. An address that was only saved is NOT READ with the reason; a snippet the user typed does not make the page "read" |
| Backfill | **1,337 sources across 42 ideas** (Charlie's idea: **211**), idempotent (second pass creates 0), **0 duplicate (idea, number) pairs**, read back by exact address |

**Documents cite the same number.** `[Ref: n]` is printed on the source lines of the **Proposal, the Evidence Pack (including "considered and set aside") and the Written Evidence**, and on the evidence lines in the proposal. **Read back out of the rendered .docx** on Charlie's idea. Not yet in: the Meeting Pack and the two briefing documents (Initial Background / Initial Questions) — they build from other data and were not touched.

**Where numbers are assigned** (and where they deliberately are not): on filing a document; on **generating** a document and on **minting a version** (explicit acts); on reading the notebook or the Sources list. **The snapshot read — which runs on every page load to fingerprint staleness — writes nothing** (proved: row count unchanged across the read). The reason is CLAUDE.md §26: a read that numbers on first sight is the 25-P trap.

**"Sources" in the research panel** (26-E §3a): renamed from "Key sources"; the numbered list; **Add source** (title; address, or "+ a document"; snippet; **Create snippet** — Lex reads the page/document and writes 20–80 words). Where a page cannot be read the form **says so** and the user writes it; the source is saved NOT READ.
**"Add source" in the middle panel's boxes** (26-E §3d): a menu under all 12 editable boxes inserts `[Ref: n]` at the cursor (spacing handled; proved on the splice function and on the component rendered with and without an idea).

## 3 · The notebook

**A quote, a source, and a comment** (`ResearchNote`, `ResearchNoteReply`). Exactly the fields in §1 of the brief. **Team-ready from the first row** (§8, decision 134):

| Rule | Where it is enforced | Proved |
|---|---|---|
| Every note cites a registry source, always; "my own observation" is itself an entry | `research-notes.ts` | a note with none is refused, saying how to give one; naming two is refused |
| **Nobody edits another person's comment — others reply beneath it** | library, not the screen | the owner is **refused** editing a colleague's comment, told to reply; comment read back unchanged |
| Status follows the author: owner's own notes **in the record**, anyone else's (and anything Lex writes) **unreviewed** | library | read back |
| A private layer: "mine only" until its author shares | library | invisible to the owner until shared; the owner cannot share it for them |
| **Nothing deletes**; set aside keeps its reason | library | hidden from the default list, kept with its reason, comes back with one press; no delete op exists |

**Views** (§4): by source · by what it bears on · by stance (the for and the against side by side) · timeline · by author. Pure functions, shared by the screen and the check; *no note is ever dropped* (a note with nothing to group it by lands in a group that says so in words). **Default view: the user's own notes; Lex's findings (211-source idea: 185+) are a toggle away and labelled Lex's** (decision 129).

## 4 · "+ Add research" (decision 133) — the four surfaces

One component replaces "+ Add a file or link" **everywhere it appeared**: the **research panel** (right) — at the top of the contents, and inside Your material; **beside Lex** (the chat's "+"); the **Overview page's Research tab** (with the whole notebook under it); and **Lex itself, as a tool**. It also replaces the control on the **Build page** and the **three question cards**. One form: paste text of any length, or a file, or an address, or nothing but a thought; **select the passage that is the quote** (the rest is kept as the source's text and **read into findings as uploads are today**); for an address, **a readable view** with select-to-quote — **and where the page refuses (parliament.uk, paywalls) it says so and tells the user to paste**; everything else optional; **Save confirms visibly, with the source number**. A file/link/text with **no note** is valid (it becomes a numbered source) — decision 133's "all optional".
Filing a document's text asserts the user may share it (§25.6): **"I may share this" is never defaulted**.

## 5 · The bookmarklet (decision 132) and the iPad question

A one-line `javascript:` bookmark; on any page it opens "Add research" with the **address, title and selected text** filled in (selection capped at 3,000 characters). **Proved by executing the bookmarklet against a mock page** and reading its address back through the landing page's own parser. The notebook explains it: drag the link on a computer.
**Report — what a bookmarklet needs on iPad Safari:** Safari on iPad cannot drag a link to a bookmarks bar, so the user bookmarks any page, **edits that bookmark and replaces its address with the code**, then presses it from the bookmarks/Favourites. The code is shown in a box to copy. Caveats: sites with a strict Content-Security-Policy can block a bookmarklet's `window.open`; the code falls back to navigating the current tab. **I have not tried this on a device**, and the page says so rather than promising. **Not now (decision 132): a browser extension** — Chromium and Firefox share one codebase, Safari needs a separately packaged app and store review; revisit when testers ask.

## 6 · Lex's tools (§5) — nine

`add_research_note` (a quote is checked **word for word against the stored text** and what is saved is **the document's own words**, never the model's string; written **by Lex**, **unreviewed**) · `list_research_notebook` · `extract_quotes(sourceNumber)` (offered whenever a document is filed; refuses a source that was never read) · `suggest_tags_and_links` (proposals only) · `update_research_note` (no comment or quote parameter exists) · `find_similar_notes` · `find_disagreements` (including between team members, named) · `what_have_i_read_on(cause|policy|action)` · `summarise_source`. Writing and tagging are free; nothing deletes; third-party text arrives in the **untrusted** channel; Lex's control list and prompts name **"Add research"** and describe the notebook.

## 7 · Schema (applied after `whichdb`, each committed with its SQL)

`lex_26r_registry_notebook.sql` — `bafa361`; `lex_26r_fk_noaction.sql` — `609a344` (RESTRICT → NO ACTION, found by me before it bit: RESTRICT is checked immediately, so deleting an idea with notes could have failed depending on cascade order). **Local only — not pushed.** ⚠ Pushing pushes 26-H, 26-O, 26-Q and everything since with it.

## 8 · Verification

`check:lex-26r` — **124 run / 124 passed with `--live`; 117 offline**; 13 controls fired, 0 dead. Parts: **A pure**; **B COLD READ** of Charlie's idea with plain reads (every cited source, upload and decision has a number; no duplicate; the snapshot read writes nothing; the **rendered .docx** prints `[Ref: n]`); **C FULL RUN** on a scratch copy through the **real routes and tools** with a second person for the team rules, every write read back, the scratch deleted and its deletion checked (a **hard** delete, not the soft fallback); **D** the surfaces are reached (§23.1); **E** the splice and the component rendered. **Live** adds the real snippet writer, the real fetch of legislation.gov.uk and parliament.uk, `extract_quotes`, `summarise_source`, `suggest_tags_and_links`.
Regression: `tsc` 0; `check:client-boundary` clean; `check:lex-26p` 102, `26m` 47, `26m-actions` 40, `26q` 74, `26o` 99, `26h` 66, `25k` 18, `25z` 50, `25d` 77, `check:documents`, `check:export` all green. **Red and not mine:** `lex-25n` 93/5 (the five assert text/imports absent from `HEAD`), `lex-25g` 26/1 (Build page's stage indicator), `lex-25f` 58/5, `check:20bd` (one older import in `build-initial-questions.ts` — I removed the two I had added), `25w`, `25x`, `25p` as before.

## 9 · Not done, and decisions that are Charlie's

**Sprint 2 (not started):** §7a the synthesis grid; §7b the disagreements *report* (the tool exists); §7c the Background Report; §7d the Introductory Summary; §8's triage controls, by-author filter *controls*, the digest and **roles — which need a report on how contributor/reviewer map onto the Team tab and Private Scrutiny first; not written.**
**Sprint 1 gaps against §4:** the notebook list **does not yet have drag-reorder, merge, find-duplicates** (it has `find_similar_notes`), the heading palette, or facets — it reuses the *idea* of 26-Q's list, not its code. **`[Ref: n]`** is not yet in the Meeting Pack or the two briefing documents.
**Open:** browser use of every surface; the bookmarklet on an iPad; whether `Idea.stage`-style team roles are wanted before Sprint 2; whether the notebook should offer "put in the record" in bulk.
