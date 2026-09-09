# The report build toolchain — how to rebuild the document

**Written 9 September 2026 by the first CCW session, which still had the files.**

⚠ **This supersedes the "recovery route" in `claude/REPORT_SOURCE_POSITION.md`.** That document concluded the source files and toolchain were lost and that the text would have to be recovered by running pandoc over the printed `.docx`. **It was wrong on the facts, not on the principle.** The files were not lost — they were still live in the first Cowork session's workspace, and they are now in this project at `report_src/`.

**Do not run the pandoc recovery.** Use the files below. They are the exact inputs that produced the 125-page printed draft, and they are not truncated.

---

## 1. What is now in the project

Everything sits under `report_src/`.

### The toolchain

| File | What it does |
|---|---|
| `build.js` | The docx generator. Reads the markdown, emits `.docx` |
| `mkpagemap.py` | Extracts real page numbers from the built PDF so the contents page is correct |
| `titles.txt` | Section titles for the full version's page map, one per line, exact |
| `titles_short.txt` | Same, for the short version |
| `pagemap.json` | Page numbers from the last full build |
| `pagemap_short.json` | Page numbers from the last short build |

### The nine source files

| File | Contains |
|---|---|
| `01_front.md` | Title page, "What this is", limits |
| `02a_twelve.md` | Part 1 opener — the twelve at a glance, provenance, assumptions, surprises |
| `02_register.md` | The twelve register entries plus the four unsourced measures |
| `03_part2.md` | 2.1 absorption · 2.2 annulment · 2.3 four plans · 2.4 devolution · 2.5 who else has said what · 2.6 what is before Parliament · 2.7 sources |
| `07_bingham.md` | 2.8 what happened 1997–2010 · 2.9 the Political / Legal Constitution framework |
| `04_part3_4.md` | Part 3 interlock · 4.1 and 4.2 statute-book collision |
| `08_part4_full.md` | 4.3 HRA · 4.4 Equality Act · 4.5 civil service — the three worked in full |
| `09_part5_rest.md` | 5.1–5.5 |
| `05_part5_short.md` | The condensed Part 5, used only by the short variant |
| `06_part6_7.md` | Part 6 questions · Part 7 method and limits |

**On the two big ones.** `08_part4_full.md` and `09_part5_rest.md` are the same content as `docs\report_run\report_src\part4_full.md` and `part5_rest.md` on Charlie's machine, but passed through the renderer and its character caps. **Prefer the machine copies for the second draft**, because removing the truncation is item B12 and the machine copies are the untruncated originals. Use these two only if the machine copies cannot be reached.

---

## 2. How to build

### Setup

```
npm install docx
```

That is the only dependency — `build.js` requires nothing else beyond Node's `fs` and `path`. Node 22 is fine.

`mkpagemap.py` needs `pdftotext` (from poppler-utils) and a way to render the docx to PDF — LibreOffice headless was used:

```
soffice --headless --convert-to pdf FIRST_SCRUTINY_Restoration_Programme.docx
```

### The build is two passes. This is the part that is easy to get wrong.

```
node build.js                # pass 1 — produces the docx with placeholder page numbers
soffice --headless --convert-to pdf FIRST_SCRUTINY_Restoration_Programme.docx
python3 mkpagemap.py         # reads the PDF, writes pagemap.json
node build.js                # pass 2 — contents page now carries real page numbers
```

**Why two passes:** Word's own field-based page numbering does not resolve until the document is opened in Word, and the contents page has to be correct in the PDF that gets printed. So the page numbers are baked in as literal text, which means the document has to be built once to find out where things land, and again to write the numbers down.

### The short variant

```
VARIANT=short node build.js
```

That one environment variable swaps three things at once: the file list, the output filename (`..._SHORT`), and the page map it reads (`pagemap_short.json`). Same two-pass rule applies.

---

## 3. How `build.js` is structured

**File list and variant switch, at the top:**

```js
const SHORT = process.env.VARIANT === 'short';
const FILES = SHORT
  ? ['01_front.md','02a_twelve.md','02_register.md','03_part2.md','07_bingham.md',
     '04_part3_4.md','05_part5_short.md','06_part6_7.md']
  : ['01_front.md','02a_twelve.md','02_register.md','03_part2.md','07_bingham.md',
     '04_part3_4.md','08_part4_full.md','09_part5_rest.md','06_part6_7.md'];
const OUTNAME = SHORT ? 'FIRST_SCRUTINY_Restoration_Programme_SHORT'
                      : 'FIRST_SCRUTINY_Restoration_Programme';
const TOCFILE = SHORT ? 'pagemap_short.json' : 'pagemap.json';
```

**To add, remove or reorder a part, edit `FILES` — and edit `titles.txt` to match**, because the page map matches on exact title strings.

**Sectioning.** A `# Heading` in the markdown starts a new docx section: new page, its own running header. `##` and below are ordinary headings within the section. So the level-1 headings are structural, not cosmetic — changing one changes the pagination.

**The running header** is a teal banner across the full text width, `PART N` bold on the left, the section title on the right, white on `1F6F6B`. The part number is derived from the section title by regex:

```js
function partOf(t) {
  const m = t.match(/^Part\s+(\d+)/i);
  if (m) return 'PART ' + m[1];
  return 'FRONT';
}
```

**So a level-1 heading must begin `Part N` for the banner to label it.** Anything else falls through to `FRONT`. That is the whole rule.

**Page setup:** A4, margins `{ top: 1500, bottom: 1100, left: 1250, right: 1250, header: 560 }` in twentieths of a point. The right tab stop for the header is at `9260`, which is the full text width; if margins change, that number has to change with them or the header title will not sit flush right.

---

## 4. How `mkpagemap.py` works, and the trap in it

It renders the PDF, runs `pdftotext` on each page from page 3 onward (skipping cover and contents), and for each title in `titles.txt` finds the first page whose text contains it.

**Matching is done twice:** first normalising apostrophes and dashes, then, if that fails, stripping everything that is not a letter or digit. The second pass exists because PDF text extraction mangles punctuation unpredictably.

⚠ **The trap, which has already bitten once.** An earlier version fell back to a loose `Part N.N` regex when an exact title did not match. That regex matched body text — any sentence mentioning "Part 4.3" — and put wrong numbers on the contents page. **It now matches exact titles only.** If a title in `titles.txt` does not match its heading in the markdown character for character, the page number will be missing rather than wrong. **Missing is the correct failure mode. Do not reintroduce a loose fallback.**

---

## 5. The rule that caused this

**No report source file lives only in a Cowork session workspace.** A Cowork workspace is ephemeral — it is reclaimed when the session ends. The project (these files) and the repo on Charlie's machine are the two durable places.

**For the second draft:** write each finished file to `docs\report_run\report_src\` on the machine as it is completed, not batched at the end, and keep the project copy in step. The repo copy is the one that gets backed up to R2.
