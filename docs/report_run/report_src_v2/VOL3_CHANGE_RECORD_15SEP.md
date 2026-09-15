# Volume 3 — what changed, and why

**15 September 2026. Output: `RESTORATION_3_The_evidence.docx` / `.pdf`, 164 pages (was 320).**

---

## 1. Appendix B has been rebuilt around the question you asked

The old Appendix B answered "who is on the record" with parliamentary data alone, and the data would not carry it: two of twelve measures returned a real division, eight returned a single early day motion — several on the wrong subject — and two returned nothing.

**Appendix B is now in two parts.**

**B.1 · The stakeholder map** is new. For each of the twelve measures it names the organisations and individuals who will argue about it, in two tables:

- **On the record** — a specific published position, with what was said, when, and where.
- **Likely to engage, position not stated** — bodies that will certainly respond to a Bill and have not yet said how.

It covers think tanks, campaign groups, professional and legal bodies, unions, regulators, statutory commissions, named peers and former judges, academics, bloggers, podcasters and committee witnesses. Roughly 170 entries.

**B.2 · The parliamentary record** keeps the division and motion data, compressed: a key naming the two divisions, then names grouped by direction and party as lists rather than 80 near-identical table rows, then one table covering all eight early-day-motion measures.

### Three honesty guards carried into B.1

1. **Every entry carries a mark** — [verified], [corroborated, unchecked], [single mention, unchecked] — and the marks are explained at the head.
2. **Anyone who could not be pinned to a dated statement was moved** to "likely to engage" rather than given a stance.
3. **One source was dropped rather than qualified.** A June 2026 think tank paper proposing a prohibition on public grants to campaigning charities could not be retrieved and its named authors could not be confirmed as real people. It is named as a gap, not cited.

### What the map found that the measures do not yet say

- **M-03 (the Supreme Court) has almost no map.** The case for abolition has been argued inside one think tank and one academic blog. There is no organised opposition because there has been no proposal concrete enough to oppose.
- **M-06 (the civil service): every named opponent defends the 1854 settlement, not the 2010 Act.** This is the same finding Volume 2 Part 6.3 reaches from the statute, reached independently from who is arguing.
- **M-07 (the Bank of England) splits the party most associated with the programme.** Reform UK's Treasury spokesman defends the Bank's independence; its deputy leader proposes Treasury appointees on the rate-setting committee.
- **M-09 (gender self-identification) was overtaken by the courts.** *For Women Scotland* [2025] UKSC 16, 16 April 2025, held unanimously that "sex" in the Equality Act means biological sex. The measure needs re-stating against the law as it now is.
- **M-11 (the Sentencing Council): Parliament has already acted twice.** Abolition is now a third step after two already taken, and the measure should say which of them it treats as sufficient.
- **M-12 (the Great Repeal) has no stakeholders** because nobody has been shown it. B.1 lists the bodies whose published work on omnibus and retrospective legislation will decide how it is received.

### A fact-check pass corrected five things before publication

| Claim as first researched | Corrected to |
|---|---|
| Suella Braverman joined Reform UK around June 2026 | 26 January 2026 |
| Robert Jenrick was Reform UK "as of February 2026" | Sacked and defected 15 January 2026; Treasury spokesman from 17 February |
| Reform UK's "Fixing the Centre" was autumn 2025 | 24 May 2026 |
| Dr Mary-Ann Stephenson became EHRC Chair in June 2026 | 1 December 2025, succeeding Baroness Falkner |
| *For Women Scotland* paraphrased | Replaced with the Court's own words from the press summary |

⚠ **Danny Kruger MP left the Conservative Party for Reform UK on 15 September 2025.** He wrote the Prosperity Institute's April 2026 ECHR foreword, and "Fixing the Centre", as a Reform UK MP. This is recorded because it changes who is speaking for whom, and it should be confirmed before the appendix is relied on.

---

## 2. Appendix C is 119 pages shorter and says the same things

Appendix C held 99 tables of the same four columns — Source, Citation, Standing, Why it matters — roughly 1,300 rows. In a table every cell carries its own margins and the column widths are set by the longest cell, so the format cost far more height than the content needed.

**Each row is now a numbered entry** rather than a table row. Nothing was cut. Three boilerplate phrases in the Standing column, which between them accounted for most of it, are stated once at the head of the appendix and replaced by short marks in the entries.

**Appendix C: 283 pages → 152. Volume 3 overall: 320 → 164.**

---

## 3. Four build defects fixed, all of which were in the printed volumes

| Symptom you would have seen | Cause | Fix |
|---|---|---|
| Source references printed as `[label](https://...)` — raw markdown, everywhere in the appendices | The builder handled bold and italic but had no rule for links | Links are now real, clickable hyperlinks, underlined as well as coloured so the cue does not depend on colour |
| Whole sections missing from the contents list, with no error | The source files come off a Windows machine with CRLF line endings; a trailing carriage return defeats the `$` anchor in the heading regex, so those headings were invisible to the contents scan | Line endings are normalised on read, in one place |
| Contents entries pointing at the wrong page | The page-map scanner matched a title anywhere on a page, so a cross-reference in the body captured the entry | It now matches the running header only, and reads front-matter pages by their own heading since those no longer carry a banner |
| A word split across two lines mid-word — "authorit / y" | Column widths were floored at 7% of the page, about four characters | Every column is floored at the width its longest word needs; overflow is taken only from columns with slack |

**Checked, not assumed.** A detector builds a dictionary from the source and looks for any line ending in a fragment that joins with the next line's opening to form a real word where neither fragment is one. **Zero hits across all three volumes.**

---

## 4. Formatting, matching Volumes 1 and 2

- Front pages carry no banner; the page's own heading is the header, at the same size as "Contents".
- Volume 3 is grouped by appendix rather than by Part, so divider pages and the contents list are keyed on the appendix letter.
- Sub-headings that merely restate the section title are suppressed.

---

## 5. Not done

- **Appendix A is unchanged** at 8 pages. It is already compact and nothing in it needed compressing.
- **The 44% interpretation-error finding** on extracted positions is carried over unchanged from the first draft. It has not been re-measured.
- **B.1 is a first pass.** It is a list to work down and confirm, and it says so on its first page. Before any name in it is quoted in public, the underlying document should be read.
