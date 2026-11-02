# LEX — CCh-Lex 2 Nov (1): report

*Written 2026-11-02, UTC throughout. Desktop session. Idea 452c5ade = Charlie's "civil service accountability". Every figure below was read
from production (Neon) with plain prisma reads, or from R2, on 2 Nov; nothing is inferred unless it says so. 2 Nov (1) replaces 1 Nov (1) and
(2); 295 ("Documents on your actions" in the right-hand panel) is not in it and was not built.*

⚠ **A second session (LEX 26-W, `docs/BRIEF_26W.md`) was working in the same tree at the same time.** It and this one have both edited
`lib/lex/agent/honesty.ts`, `lib/lex/agent/system-prompt.ts`, `package.json` and `docs/CHANGE_LOG.md`. See "Delivery" at the end.

---

## A — What the corpus holds of the two Codes (checked first; nothing was changed)

| | what it is | words |
|---|---|---|
| `govuk-core-docs:government/publications/civil-service-code:1` | **the gov.uk publication page's summary, not the Code.** Its whole text: *"This code sets out the standards of behaviour expected of all civil servants to uphold the Civil Service's core values, which are integrity, honesty, objectivity and impartiality. It also gives details of civil servants' rights and responsibilities in relation to the code."* | 42 |
| `…/civil-service-code/the-civil-service-code` (the Code's own page) | **not held anywhere in the corpus.** `govuk-core-docs` holds 59 documents (179 rows) and has only the one row above under `civil-service`; `quangos-govuk` has none for the Code. | — |
| `quangos-govuk:government/publications/civil-servants-terms-and-conditions:1` | the **Civil Service Management Code**'s publication page summary ("The management code sets out regulations and instructions related to civil servants' terms and conditions of service. It covers: recruitment and probation …") | 54 |
| the Management Code's full text | **not held anywhere in the corpus.** The only other hits are Lords written answers that mention it (`lordswrans2010-12-07a:17`, `lordswrans2011-01-27a:12`). | — |

**Filed as sources on 452c5ade — yes, both, since Charlie filed them on 1 Nov:**

| Ref | kind | what | held text |
|---|---|---|---|
| **[Ref: 88]** | CORPUS | "Civil Service Code" — actually a 2011 Lords written answer *about* the Code (`pwdata-lordswrans:lordswrans2011-01-27a:12`) | 138 words |
| **[Ref: 189]** | CORPUS | "Civil Service management code" — the 54-word publication summary above | 54 words |
| **[Ref: 217]** | DOCUMENT | **Civil Service Management Code — the full text**, filed by Charlie 1 Nov 23:42 UTC | **192,110 characters** (Chapter 1 "Taking up appointment" … para 12.2.5); findings read: 5 |
| **[Ref: 218]** | URL | **The Civil Service code - GOV.UK** — the Code's own page, fetched, filed by Charlie 1 Nov 23:47 UTC | 12,446 characters (the Code's text **plus the page's cookie banner and footer**) ; findings read: 6 |

So Lex's sentence on 1 Nov 23:29 (Reply 64) — *"The corpus holds only a summary of the current Civil Service Code, not its full text"* — was **true of the corpus** and
was the reply that 297 now refuses (below). Thirteen minutes later the full texts were on the idea as 217 and 218. ⚠ Both are held as **extracts
for findings**, which is why 26-W §4c (`read_source`) exists — that is the other stream's work, not this one's.

---

## B — 297: a "not found" carries its working

- **The rule, in the prompt** (`SYSTEM_PREFIX`): when Lex cannot find something it says what it searched; what it found and why that falls
  short; and how to fill the gap — "+ Add research" and where the official text is published (or that it does not know).
- **The honesty check refuses a bare one** (`lib/lex/agent/honesty.ts`, new violation `bare-not-found`, `notFoundGaps()`): a reply with a
  "not found" about MATERIAL (corpus, sources, law, a document's text…) must carry all four parts, checked over the whole reply. Flagged →
  the one corrective retry, naming exactly which parts are missing. If the retry still lacks them, the last resort **keeps the true sentence**
  (it is incomplete, not false) and adds the platform's own line: *"To fill the gap: if you have the document, or know where its official text
  is published, add it with "+ Add research" — the "+" just above the box you type in — and I will read it."* No "Nothing was changed" note
  is added, because nothing was removed.
- **Measured over all 702 stored Lex replies:** the first pattern flagged 9; 4 were "not found" about the screen, a field, the chat or the
  user's own search ("I have not found your second paragraph in either field"). Those are now excluded; **5 are flagged**, all about
  material — including Reply 64. One more turn in about 140 pays the retry.
- **`check:lex-297` — 18/18.** Cold read of Charlie's real Reply 64 through the real `checkReply` (flagged; names "+ Add research" and
  "published"); the same reply with its working added is not flagged (the control); the last resort keeps the sentence and the layout; five
  non-material "not found"s are left alone; the rule reaches the model.
- ⚠ Not run: a live Lex turn. The retry path is the existing one (unchanged); what is new is the predicate, and it is tested on real replies.

## C — Names

- The right-hand panel's **"Outputs"** and the idea page's top tab **"Reports"** are both **"Output Reports"** (`QuestionPanel.tsx`,
  `IdeaDetailClient.tsx`). Lex's controls list names neither, so nothing else moved.
- **300 — NOT BUILT.** The brief makes it conditional ("if Charlie agrees"): "Drafts" for the things written for actions (Overview tab
  "Drafts", Deepening tree "Drafts on actions", "Draft D.38.1"), and "Documents" meaning uploaded files only. ⚠ 26-W is building the document
  tools and the field guide (302) on those same labels right now, so the rename should land after it or with it.

## D — 298: Add research, simplified

In this order: **1 · what** (a file, a web address, text — or just a thought), as before · **2 · Title**, prefilled from the file's name (its
extension dropped) or the page's title, editable · **"Already added as [Ref: N] — add this as a further note to it?"** by the held text's
sha-256 (a file read, a page fetched — the same normalise and cap the save applies) or by the page's address (no scheme, no www, no
trailing slash); *Yes* makes it a further note on N, *No* keeps it a new source · the drop-down is gone: **"This is a further note on a source
I've already added"** opens a type-to-search picker, which is 299's own component · **"+ Add a quote", "+ Add your comment", "+ More details"**.
A thought alone is filed against "My own observation" (as choosing it did); a quote with no source cannot be saved and the foot says why.
**Nothing about how notes are stored changed**: the request is the same `NotebookRequest`; the only new value is the registry row's
`sourceType` — "document" for a file, "pasted text" for pasted text — because both were stored identically and 299 has to tell them apart.
(Pasted text filed before 2 Nov cannot be told from a file and counts as a Document.)

## E — 299: the Sources list

- **Quick pills:** Documents · Web pages · Found by Lex, each with its count. **All filters:** every kind with counts (Documents · Web pages ·
  Pasted text · My own notes · Found by Lex), **Bears on #N** (a note on the source bears on action N, or action N's own words cite its
  [Ref: n]) and **Possible duplicates**. **Sort:** Ref number / date added / A–Z. **Search:** titles and the text we HOLD (a document's or page's
  kept text, the snippet, the notes, and a corpus passage's text from R2); the line under it says how many held texts were searched and how
  many sources hold none.
- One component, `components/lex/SourceBrowser.tsx`, on the rules in `lib/lex/source-list.ts` (pure); the same component is 298's picker.
- On / off is a glyph (● / ○), weight and a 2px border as well as colour (§21).
- **452c5ade today:** 218 sources — Documents 7 · Web pages 5 · Pasted text 0 · My own notes 2 · Found by Lex 204 (203 corpus + the
  position-graph entry, Ref 170). 3 sources bear on an action.

### Possible duplicates on 452c5ade — reported, NOT merged (numbers are never reused)

**21 groups, 62 sources.** "Same document" = the same corpus publication / report; Hansard is matched only within one sitting, and two
sections of one Act are never "the same document".

| Refs | why | what |
|---|---|---|
| **12, 13** | same document, same title | Civil Service competency framework — the gov.uk page (13) and its PDF (12) |
| **189, 217** | same title | Civil Service Management Code — the 54-word corpus summary (189) and Charlie's full text (217) |
| 14, 130, 188 | same document | PAC 28th Report, *Accountability for public money* — three passages |
| 16, 32, 36, 96, 102, 157, 159, 169, 198 | same document | Lords Constitution Committee 6th Report, *The accountability of civil servants* — nine passages |
| 22, 26 | same document | PAC 23rd Report, *Civil service workforce* |
| 23, 43, 61 | same document | PACAC 8th Report, *Truth to power* |
| 25, 40, 48, 52, 55, 87, 92, 142 | same document | Explanatory Notes to CRAG Act 2010 — eight passages |
| 30, 33, 58, 90 | same title, same sitting | Commons 12 Feb 1996, *Ministerial Responsibility* |
| 46, 91, 148 | same title, same sitting | Commons 13 Jul 1994, *Civil Service* |
| 51, 121 | same document | PACAC 15th Report, *The Work of the Civil Service* |
| 59, 140, 206 | same document | PAC 13th Report, *Civil Service Reform* |
| 67, 99 | same document | 1st Report, *Who's accountable?* |
| 75, 131 | same document | NHS foundation trusts: accounting officer's responsibilities |
| 93, 111 | same title, same sitting | Lords 16 Jan 2014, *The Future of the Civil Service* |
| 95, 161 | same document | NAO, *Civil service workforce* — summary and full report |
| 101, 181 | same document | 16th Report, *The work of the Committee 2015–17* |
| 104, 138 | same document | NI Assembly, Private Members' Business — NI Civil Service |
| 115, 156 | same document | 13th Report, *Change in Government* |
| 120, 132, 209 | same title, same sitting | Lords 7 Feb 2013, *Accountability of Civil Servants* debate |
| 127, 172 | same document | Effective professional development design in a Civil Service context |
| 165, 196 | same document | Knowledge Asset Senior Responsible Owner guide |

True copies of one text are the two pairs at the top (12/13: a page and its own PDF; 189/217: a summary and the full Code). The rest are one
report or debate cited by several passages — worth seeing together, not wrong. Not grouped, deliberately: Ref 88 (a Lords answer *about* the
Code) with 218 (the Code); ten sections of CRAG 2010; written answers that share only a heading ("Cabinet Office — Civil Service", 2016 and 2024).

## Size (asked for first; recorded here as built)

| item | files | size |
|---|---|---|
| A | read-only probes | — |
| B 297 | `honesty.ts`, `system-prompt.ts`, `check-lex-297.ts` | S |
| C names | 2 labels | XS |
| D 298 | `AddResearch.tsx`, `extract`/`fetch` routes (`textHash`), `research-notes.ts` (`sourceType`) | M |
| E 299 | `source-list.ts` (new, pure), `SourceBrowser.tsx` (new), `SourcesRegistry.tsx`, `source-registry.ts` (`listRegistryDetail`, `searchRegistry`, `heldTextHash`), registry route (`?detail=1`, `?q=`) | M–L |
| checks | `check-lex-298-299.ts` (new), harness fixture, one 26-S2 assertion updated | M |

No schema change; no migration.

## Checks

See CHANGE_LOG for the sweep. `check:lex-297` 18/18 · `check:lex-298-299` 50/50, 7 controls, 0 dead, 0 not run (A cold read of 452c5ade;
B and C in Chromium against the stand-in server) · `check:lex-26s2-browser`: its 26-S2 field-order assertion was superseded by 298 and now
asserts 298's order.

## Delivery

Not pushed by this session at the time of writing — see CHANGE_LOG's entry for what shipped and the live read-back. ⚠ `honesty.ts`,
`system-prompt.ts` and `package.json` carry BOTH streams' edits (26-W added its document tools to the honesty check's claim lists and its
`check:lex-26w` script). Under the root CLAUDE.md shared-file rule those files are committed once, by agreement, naming both streams' work —
never split by hunk.
