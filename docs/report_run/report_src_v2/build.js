const fs = require('fs');
const path = require('path');
const D = require('docx');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak, AlignmentType,
  Header, Footer, PageNumber, Table, TableRow, TableCell, WidthType, ShadingType,
  BorderStyle, LevelFormat, convertInchesToTwip, PositionalTab, PositionalTabAlignment,
  PositionalTabLeader, ExternalHyperlink
} = D;

// Volume configuration replaces the old SHORT flag. The report is issued as three
// files - the argument, the measures worked, the appendices - because the binding
// constraint is email attachments, not print.
const VOL = (process.env.VOLUME || (process.env.VARIANT === 'short' ? 'short' : 'all'));
const VOLUMES = {
  all:   { files: ['01_front.md','00_glossary.md','02_framework.md','02a_twelve.md','02_register.md',
                   '03_part2.md','07_bingham.md','04_part3.md','08_part4.md','09_part5_rest.md',
                   '06_part6.md','13_part7_limitations.md'],
           out: 'SECOND_DRAFT_Restoration_Programme',
           sub: 'Repeal, annulment, and what the programme would actually require',
           vol: '' },
  vol1:  { files: ['01_front.md','00_glossary.md','02_framework.md','02a_twelve.md','02_register.md',
                   '03_part2.md','07_bingham.md','04_part3.md','12_part6_tests.md','06_part6.md',
                   '13_part7_limitations.md'],
           out: 'RESTORATION_1_The_programme_and_the_argument',
           sub: 'What the programme is, and the argument it turns on',
           vol: 'Volume 1 of 3',
           // Volume 1 renumbers its last two Parts 4 and 5 so it reads 1-5 with no gaps;
           // Volume 2 takes 6 and 7 in exchange. Part names are therefore per-volume.
           parts: {
             '1': 'PART 1 \u00b7 THE PROGRAMME, IN DAVID\u2019S OWN WORDS',
             '2': 'PART 2 \u00b7 ACROSS THE WHOLE PROGRAMME',
             '3': 'PART 3 \u00b7 DO THE TWELVE HAVE TO MOVE TOGETHER?',
             '4': 'PART 4 \u00b7 ASSESSING RESILIENCE \u2014 THREAT ANALYSIS',
             '5': 'PART 5 \u00b7 LIMITATIONS OF THIS ANALYSIS',
           } },
  vol2:  { files: ['01a_front_vol2.md','08_part4.md','09_part5_rest.md'],
           out: 'RESTORATION_2_The_measures_worked',
           sub: 'Twelve measures worked against the statute book',
           vol: 'Volume 2 of 3',
           // Volume 1 took Parts 4 and 5 for its own sections, so the worked
           // measures move to 6 and 7. See the build note in the vol1 entry.
           parts: {
             '6': 'PART 6 \u00b7 THREE MEASURES WORKED IN FULL',
             '7': 'PART 7 \u00b7 NINE FURTHER MEASURES',
           } },
  // The citator appendix was dropped on 15 September: it reported judicial
  // TREATMENT (has a case been followed, doubted, overruled) on unvalidated data,
  // which is not what a reader expects a citator to show and not something the
  // data could support. 20_appendix_a_citator.md is left on disk, out of the build.
  vol3:  { files: ['01b_front_vol3.md','21_appendix_b_positions.md','22_appendix_c_research_panel.md'],
           out: 'RESTORATION_3_The_evidence',
           sub: 'Who is arguing, and what the research found',
           vol: 'Volume 3 of 3',
           // Volume 3 continues the Part numbering of Volumes 1 and 2.
           parts: {
             '8': 'PART 8 \u00b7 WHO IS FOR AND AGAINST THE PROPOSED MEASURES',
             '9': 'PART 9 \u00b7 THE RESEARCH',
           } },
  short: { files: ['01_front.md','00_glossary.md','02_framework.md','02a_twelve.md','02_register.md',
                   '03_part2.md','07_bingham.md','04_part3.md','05_part5_short.md','06_part6.md',
                   '13_part7_limitations.md'],
           out: 'SECOND_DRAFT_Restoration_Programme_SHORT',
           sub: 'Repeal, annulment, and what the programme would actually require',
           vol: 'Short version' },
};
const CFG = VOLUMES[VOL] || VOLUMES.all;
const SHORT = VOL === 'short';
const FILES = CFG.files;
const OUTNAME = CFG.out;
const TOCFILE = 'pagemap_' + VOL + '.json';
const DIR = __dirname;

// ---------- inline formatting ----------
// Splits a line into runs, honouring **bold**, *italic*, and ⚠ markers.
// Emphasis only: ** ** and * *. Split out so that link labels get the same
// treatment as ordinary text.
function emph(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(new TextRun({ ...base, text: text.slice(last, m.index) }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ ...base, text: t.slice(2, -2), bold: true }));
    else out.push(new TextRun({ ...base, text: t.slice(1, -1), italics: true }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ ...base, text: text.slice(last) }));
  return out;
}

function runs(text, base = {}) {
  // Markdown links were previously printed literally as [label](url), which is how
  // every source reference in the appendices came out. They are now real hyperlinks.
  // Underline carries the "this is a link" signal as well as the colour, because
  // colour alone is not a cue every reader can use.
  const out = [];
  const link = /\[((?:[^\[\]]|\[[^\[\]]*\])+)\]\((https?:\/\/[^)\s]+)\)/g;
  let last = 0, m;
  while ((m = link.exec(text)) !== null) {
    if (m.index > last) out.push(...emph(text.slice(last, m.index), base));
    out.push(new ExternalHyperlink({
      link: m[2],
      children: emph(m[1], { ...base, color: '1F6F6B', underline: {} }),
    }));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...emph(text.slice(last), base));
  if (out.length === 0) out.push(new TextRun({ ...base, text: '' }));
  return out;
}

const P = (text, opts = {}) => new Paragraph({
  children: runs(text, opts.runOpts || {}),
  spacing: { after: opts.after ?? 120, before: opts.before ?? 0, line: 276 },
  ...opts.para
});

// ---------- tables ----------
const TOTAL = 9360; // ~6.5in in DXA
function mkTable(rows) {
  const nCols = Math.max(...rows.map(r => r.length));
  // Equal columns waste most of the page when one column holds a sentence and the
  // others hold a number, and force short cells to wrap. Size each column by the
  // typical length of its content instead: the 80th-percentile cell length, so one
  // freak long cell does not swallow the table, floored so nothing is unreadably
  // narrow. This is what compresses the tables vertically.
  const plain = (t) => String(t || '')
    .replace(/\[((?:[^\[\]]|\[[^\[\]]*\])+)\]\((https?:\/\/[^)\s]+)\)/g, '$1')
    .replace(/\*\*?|`/g, '');
  const q80 = (arr) => {
    const a = arr.slice().sort((x, y) => x - y);
    return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * 0.8))] : 1;
  };
  const weights = [];
  for (let c = 0; c < nCols; c++) {
    const lens = rows.map(r => plain(r[c]).length).filter(n => n > 0);
    const body = q80(lens);
    const head = plain(rows[0] && rows[0][c]).length;
    weights.push(Math.max(6, Math.min(Math.max(body, Math.min(head, 28)), 90)));
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  // A column narrower than its own longest WORD makes Word break that word across
  // two lines ("authorit / y"), which is worse than any amount of wasted height.
  // Floor each column at the width its longest word needs. 122 twips per character
  // is Calibri 10.5pt bold with slack for wide letters; 240 covers the cell's own
  // left and right margins. Capped at 45% so one long URL cannot take the page.
  const CHARW = 122, CELLPAD = 240;
  const floors = [];
  for (let c = 0; c < nCols; c++) {
    let longest = 1;
    for (const r of rows) {
      for (const w of plain(r[c] || '').split(/[\s\u00a0\u2011-]+/)) {
        if (w.length > longest) longest = w.length;
      }
    }
    floors.push(Math.min(Math.floor(TOTAL * 0.45), longest * CHARW + CELLPAD));
  }
  const floorSum = floors.reduce((a, b) => a + b, 0);
  let widths;
  if (floorSum >= TOTAL) {
    // Every column is already at or past its floor: proportional is the best available.
    widths = floors.map(f => Math.floor(TOTAL * f / floorSum));
  } else {
    widths = weights.map((w, i) => Math.max(floors[i], Math.floor(TOTAL * w / sum)));
    // Recover the overflow from columns that have slack above their floor, taking
    // from the one with most slack each time, so no column drops below its floor.
    let over = widths.reduce((a, b) => a + b, 0) - TOTAL;
    let guard = 0;
    while (over > 0 && guard++ < 10000) {
      let best = -1, bestSlack = 0;
      for (let i = 0; i < widths.length; i++) {
        const slack = widths[i] - floors[i];
        if (slack > bestSlack) { bestSlack = slack; best = i; }
      }
      if (best < 0) break;
      const take = Math.min(over, bestSlack);
      widths[best] -= take; over -= take;
    }
    if (over < 0) widths[widths.indexOf(Math.max(...widths))] -= over;
  }
  const drift = widths.reduce((a, b) => a + b, 0) - TOTAL;
  if (drift !== 0) widths[widths.indexOf(Math.max(...widths))] -= drift;
  return new Table({
    columnWidths: widths,
    width: { size: TOTAL, type: WidthType.DXA },
    rows: rows.map((cells, ri) => new TableRow({
      tableHeader: ri === 0,
      children: Array.from({ length: nCols }, (_, ci) => {
        const raw = cells[ci] ?? '';
        return new TableCell({
          width: { size: widths[ci], type: WidthType.DXA },
          shading: ri === 0 ? { type: ShadingType.CLEAR, fill: 'EFEFEF' } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({
            children: runs(raw, ri === 0 ? { bold: true } : {}),
            spacing: { after: 0, before: 0, line: 250 },
          })],
        });
      }),
    })),
  });
}

// ---------- markdown -> docx children ----------
function parse(md) {
  const lines = md.split('\n');
  const sections = [];       // { title, children[] }
  let cur = null;
  let i = 0;

  // A worked measure runs to a dozen sections over as many pages, so each one opens
  // with its own contents line. Built from the H3s actually present rather than
  // hand-maintained, and emitted only for measures (detected by the kernel headings)
  // so that short front-matter sections do not get one.
  const subheads = {};
  {
    let k = null;
    for (const l of lines) {
      if (/^# /.test(l)) { k = l.replace(/^# /, '').trim(); subheads[k] = []; }
      else if (k && /^### /.test(l)) subheads[k].push(l.replace(/^### /, '').trim());
    }
  }
  const KERNEL_HS = ['Diagnosis', 'Guiding policy', 'Coherent actions'];
  const sectionContents = (title) => {
    const all = subheads[title] || [];
    if (!all.includes('Diagnosis') || !all.includes('Guiding policy')) return null;
    const num = (title.match(/^Part\s+([\d.]+)/i) || [, ''])[1];
    const kernel = all.filter(h => KERNEL_HS.includes(h));
    const rest = all.filter(h => !KERNEL_HS.includes(h) && h !== 'Decisions, challenges and research');
    const out = [];
    const group = (n, label) => out.push(new Paragraph({
      spacing: { before: 140, after: 60 },
      children: [new TextRun({ text: n + '  ' + label, bold: true, size: 20, color: '333333' })],
    }));
    const item = (h) => out.push(new Paragraph({
      spacing: { before: 0, after: 20 },
      indent: { left: 620, hanging: 200 },
      children: [new TextRun({ text: '•  ' + h, size: 19, color: '555555' })],
    }));
    group(num + '.1', 'The strategic kernel'); kernel.forEach(item);
    group(num + '.2', 'Decisions, challenges and research'); rest.forEach(item);
    out.push(new Paragraph({
      text: '', spacing: { before: 60, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 6 } },
    }));
    return out;
  };

  const push = (el) => { if (cur) cur.children.push(el); };

  while (i < lines.length) {
    let line = lines[i];

    // section break
    if (/^# /.test(line)) {
      cur = { title: line.replace(/^# /, '').trim(), children: [] };
      sections.push(cur);
      i++; continue;
    }
    if (!cur) { i++; continue; }

    if (/^## /.test(line)) {
      const h2 = line.replace(/^## /, '').trim();
      const isFirstH2 = cur.children.length === 0;
      // The first H2 of a section restates the section title, which the banner
      // already carries at the top of every page. Drop it rather than print it twice.
      const key = (t) => t.toLowerCase().replace(/^part\s+[\d.]+\s*[·:-]?\s*/i, '')
                          .replace(/^[\d.]+\s*[·:-]?\s*/, '').replace(/[^a-z0-9]/g, '');
      // Exact-prefix matching missed the common case where the H2 is a longer
      // rewording of the same heading ("Already before Parliament" vs "What is
      // already before Parliament"). Compare the significant words instead, and
      // treat a 60% overlap of at least three of them as the same heading.
      const STOP = new Set(['the','a','an','of','and','or','to','in','on','for','is','are','be',
        'this','that','it','its','what','how','do','does','did','have','has','actually','at',
        'by','with','from','as','was','were','which','their','there']);
      const sig = (t) => new Set(t.toLowerCase()
        .replace(/^part\s+[\d.]+\s*[·:-]?\s*/i, '').replace(/^[\d.]+\s*[·:-]?\s*/, '')
        .split(/[^a-z0-9]+/).filter(w => w && !STOP.has(w)));
      const dup = isFirstH2 && (() => {
        const a = key(h2), b = key(cur.title);
        if (a && b && (a.startsWith(b) || b.startsWith(a))) return true;
        const A = sig(h2), B = sig(cur.title);
        const small = Math.min(A.size, B.size);
        if (small < 2) return false;
        let hit = 0; for (const w of A) if (B.has(w)) hit++;
        // Full containment counts from two words up ("The civil service" inside
        // "The permanent, appointed civil service"); below that, 60% of three.
        return hit === small || (small >= 3 && hit / small >= 0.6);
      })();
      if (!dup) {
        push(new Paragraph({
          children: runs(h2),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 160 },
        }));
      }
      if (isFirstH2) { const toc = sectionContents(cur.title); if (toc) toc.forEach(push); }
      i++; continue;
    }
    if (/^### /.test(line)) {
      const h3 = line.replace(/^### /, '').trim();
      // The three kernel headings and the block divider print as full-width bars.
      // The bar carries its own name AND the block name, so the grouping does not
      // depend on the colour being seen (Charlie is colour-blind).
      const KERNEL = ['Diagnosis', 'Guiding policy', 'Coherent actions'];
      const DIVIDER = 'Decisions, challenges and research';
      if (KERNEL.includes(h3) || h3 === DIVIDER) {
        const isKernel = KERNEL.includes(h3);
        // Kernel bars are pale green with black text; the divider is dark with white
        // text. Light-vs-dark and black-vs-white text carry the distinction, so it
        // survives being read by someone who cannot separate the hues.
        const fill = isKernel ? 'DCEBD2' : 'E0D8EC';
        const ink = '000000';
        const rightLabel = isKernel ? 'The Strategic Kernel' : '';
        push(new Paragraph({
          shading: { type: ShadingType.CLEAR, fill },
          spacing: { before: 300, after: 160 },
          tabStops: [{ type: D.TabStopType.RIGHT, position: 9260 }],
          children: [
            new TextRun({ text: '  ' + h3, bold: true, size: 26, color: ink }),
            new TextRun({ text: '\t', size: 22, color: ink }),
            new TextRun({ text: rightLabel + '  ', italics: true, size: 20, color: ink }),
          ],
        }));
        i++; continue;
      }
      push(new Paragraph({
        children: runs(h3),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 220, after: 120 },
      }));
      i++; continue;
    }
    if (/^#### /.test(line)) {
      push(new Paragraph({
        children: runs(line.replace(/^#### /, '')),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 180, after: 100 },
      }));
      i++; continue;
    }

    // horizontal rule -> thin spacer with bottom border
    if (/^---\s*$/.test(line)) {
      push(new Paragraph({
        text: '',
        spacing: { before: 60, after: 140 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB', space: 4 } },
      }));
      i++; continue;
    }

    // table
    if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        const cells = lines[i].split('|').slice(1, -1).map(c => c.trim());
        if (!cells.every(c => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      if (rows.length) { push(mkTable(rows)); push(new Paragraph({ text: '', spacing: { after: 140 } })); }
      continue;
    }

    // blockquote
    if (/^> /.test(line)) {
      const buf = [];
      while (i < lines.length && /^> ?/.test(lines[i])) { buf.push(lines[i].replace(/^> ?/, '')); i++; }
      push(new Paragraph({
        children: runs(buf.join(' '), { italics: true }),
        indent: { left: 420 },
        spacing: { before: 120, after: 160, line: 276 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: '888888', space: 12 } },
      }));
      continue;
    }

    // bullets
    if (/^[-*] /.test(line)) {
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        push(new Paragraph({
          children: runs(lines[i].replace(/^[-*] /, '')),
          numbering: { reference: 'bullets', level: 0 },
          spacing: { after: 80, line: 276 },
        }));
        i++;
      }
      continue;
    }

    // numbered list
    if (/^\d+\. /.test(line)) {
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        push(new Paragraph({
          children: runs(lines[i].replace(/^\d+\.\s*/, '')),
          numbering: { reference: 'nums', level: 0 },
          spacing: { after: 80, line: 276 },
        }));
        i++;
      }
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    push(P(line));
    i++;
  }
  return sections;
}

// ---------- assemble ----------
let allSections = [];
for (const f of FILES) {
  const md = fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n?/g, '\n');
  allSections = allSections.concat(parse(md));
}

function partOf(t) {
  // The banner shows the section number in full (PART 6.1), not just the Part.
  const m = t.match(/^Part\s+([\d.]+)/i);
  if (m) return 'PART ' + m[1].replace(/\.$/, '');
  // Volume 3 is organised by appendix rather than by Part. "B.1" and "B.2" are
  // sections of Appendix B, so they carry Appendix B's banner rather than FRONT's.
  const a = t.match(/^Appendix\s+([A-Z])\b/i);
  if (a) return 'APPENDIX ' + a[1].toUpperCase();
  const sub = t.match(/^([A-Z])\.\d/);
  if (sub) return 'APPENDIX ' + sub[1].toUpperCase();
  return 'FRONT';
}
// The group a section belongs to, for divider pages: a Part number, or an
// appendix letter. Returns null for front matter, which gets no divider.
function groupOf(t) {
  const m = t.match(/^Part\s+(\d+)/i);
  if (m) return m[1];
  const a = t.match(/^Appendix\s+([A-Z])\b/i);
  if (a) return a[1].toUpperCase();
  const sub = t.match(/^([A-Z])\.\d/);
  if (sub) return sub[1].toUpperCase();
  return null;
}
const HDR = (t) => new Header({
  children: [
    new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: '1F6F6B' },
      spacing: { before: 0, after: 0 },
      tabStops: [{ type: D.TabStopType.RIGHT, position: 9260 }],
      indent: { left: 0, right: 0 },
      children: [
        new TextRun({ text: '  ' + partOf(t), bold: true, size: 26, color: 'FFFFFF' }),
        new TextRun({ text: '\t', size: 22, color: 'FFFFFF' }),
        new TextRun({ text: t.replace(/^Part\s+[\d.]+\s*·\s*/i, '') + '  ', bold: true, size: 22, color: 'FFFFFF' }),
      ],
    }),
    new Paragraph({
      spacing: { before: 40, after: 140 },
      tabStops: [{ type: D.TabStopType.RIGHT, position: 9406 }],
      children: [
        new TextRun({ text: 'FIRST SCRUTINY  ·  The Restoration Programme', size: 14, color: '888888' }),
        new TextRun({ text: '\t', size: 14 }),
        new TextRun({ text: t, size: 14, color: '555555' }),
      ],
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 3 } },
    }),
  ],
});

const FTR = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '777777' })],
  })],
});

const pageCfg = {
  page: {
    size: { width: 11906, height: 16838 }, // A4
    margin: { top: 1500, bottom: 1100, left: 1250, right: 1250, header: 560 },
  },
};

// ---- Title page (no header) ----
const titleSection = {
  properties: { ...pageCfg, titlePage: false },
  footers: { default: new Footer({ children: [new Paragraph('')] }) },
  children: [
    new Paragraph({ text: '', spacing: { after: 2200 } }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [new TextRun({ text: 'FIRST SCRUTINY', bold: true, size: 64 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 500 },
      children: [new TextRun({ text: 'The Restoration Programme', size: 44, color: '444444' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 900 },
      children: [new TextRun({ text: CFG.sub, italics: true, size: 24, color: '555555' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
      children: [new TextRun({ text: 'An issues paper. The starting point of legislative scrutiny, not the end of it.', size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1800 },
      children: [new TextRun({ text: 'A draft for the proposers to correct.', bold: true, size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
      children: [new TextRun({ text: 'Proposer: David Starkey', bold: true, size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
      children: [new TextRun({ text: 'Scrutiny by Scrutinise  \u00b7  Second draft, revised 14 September 2026' + (CFG.vol ? '  \u00b7  ' + CFG.vol : ''), size: 20, color: '555555' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Scrutinise is free and non-partisan. It takes a proposal and works out what', italics: true, size: 18, color: '666666' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'delivering it would actually require. It is available on identical terms to anyone.', italics: true, size: 18, color: '666666' })] }),
  ],
};

// ---- Contents ----
let PAGEMAP = {};
try { PAGEMAP = JSON.parse(fs.readFileSync(path.join(DIR, TOCFILE), 'utf8')); } catch (e) {}
// The contents list is derived from the H1 headings present in this volume. The
// hand-maintained version had drifted - two entries fused onto one line, one
// section out of order - and a generated list cannot drift.
// A part gets sub-rows only when it has more than one section in this volume,
// so single-section parts (3, 6, 7) do not print their own name twice.
const toc = (() => {
  const heads = [];
  for (const f of FILES) {
    const md = fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n?/g, '\n');
    for (const line of md.split('\n')) {
      const m = line.match(/^# (.+)$/);
      if (m && m[1].trim() !== 'Title') heads.push(m[1].trim());
    }
  }
  const count = {};
  for (const h of heads) {
    const g = groupOf(h);
    if (g) count[g] = (count[g] || 0) + 1;
  }
  const PARTNAMES = CFG.parts || {
    '1': 'PART 1 \u00b7 THE PROGRAMME, IN DAVID\u2019S OWN WORDS',
    '2': 'PART 2 \u00b7 ACROSS THE WHOLE PROGRAMME',
    '3': 'PART 3 \u00b7 DO THE TWELVE HAVE TO MOVE TOGETHER?',
    '4': 'PART 4 \u00b7 THREE MEASURES WORKED IN FULL',
    '5': 'PART 5 \u00b7 EIGHT FURTHER MEASURES',
    '6': 'PART 6 \u00b7 THE QUESTIONS ONLY DAVID CAN ANSWER',
    '7': 'PART 7 \u00b7 LIMITATIONS OF THIS ANALYSIS',
  };
  const rows = []; let lastPart = null;
  for (const full of heads) {
    const am = full.match(/^Appendix ([A-Z]) \u00b7 (.+)$/) || full.match(/^([A-Z])\.(\d+) \u00b7 (.+)$/);
    const pm = full.match(/^Part (\d+)(?:\.(\d+))? \u00b7 (.+)$/);
    if (am && !pm) {
      const letter = am[1];
      if (letter !== lastPart) {
        if (lastPart !== null) rows.push(['', '']);
        rows.push([PARTNAMES[letter] || ('APPENDIX ' + letter), full]);
        lastPart = letter;
      }
      if (am.length === 4) rows.push([am[1] + '.' + am[2] + '  ' + am[3], full]);
    } else if (pm) {
      if (pm[1] !== lastPart) {
        if (lastPart !== null) rows.push(['', '']);
        rows.push([PARTNAMES[pm[1]] || ('PART ' + pm[1]), full]);
        lastPart = pm[1];
      }
      if (count[pm[1]] > 1) {
        rows.push([(pm[2] ? pm[1] + '.' + pm[2] + '  ' : '') + pm[3], full]);
      }
    } else {
      if (lastPart !== null) { rows.push(['', '']); lastPart = null; }
      rows.push([full.toUpperCase(), full]);
    }
  }
  return rows;
})();

const contentsSection = {
  properties: pageCfg,
  // The front pages carry no running banner - the page's own heading is the header.
  headers: { default: new Header({ children: [new Paragraph('')] }) },
  footers: { default: FTR },
  children: [
    new Paragraph({ children: [new TextRun({ text: 'Contents', bold: true, size: 40 })], spacing: { after: 400 } }),
    ...toc.map(([label, key]) => {
      if (label === '') return new Paragraph({ text: '', spacing: { after: 90 } });
      const isPart = /^(PART|FRONT)/.test(label);
      const pg = key && PAGEMAP[key] ? String(PAGEMAP[key]) : '';
      return new Paragraph({
        spacing: { after: isPart ? 90 : 50 },
        indent: { left: isPart ? 0 : 300 },
        tabStops: [{ type: D.TabStopType.RIGHT, position: 9406, leader: 'dot' }],
        children: [
          new TextRun({ text: label, bold: isPart, size: isPart ? 21 : 20, color: isPart ? '000000' : '333333' }),
          new TextRun({ text: '\t', size: 20 }),
          new TextRun({ text: pg, bold: isPart, size: isPart ? 21 : 20, color: '000000' }),
        ],
      });
    }),
    new Paragraph({ text: '', spacing: { before: 400 } }),
    new Paragraph({
      children: [new TextRun({ text: 'The Part number is in the banner across the top of every page, with the section name beside it.', italics: true, size: 18, color: '666666' })],
    }),
  ],
};

allSections = allSections.filter(s => s.title !== 'Title');
// Each Part opens with a divider page carrying its name, followed by a deliberate
// blank page, so a reader flipping through can find a Part by its edge. The divider
// carries no running header of its own; the blank page carries nothing at all.
const PARTNAMES_DIV = CFG.parts || {};
function partDivider(num, firstTitle) {
  const label = PARTNAMES_DIV[num] || (/^[A-Z]$/.test(num) ? 'APPENDIX ' + num : 'PART ' + num);
  const bits = label.split(' \u00b7 ');
  return [
    {
      properties: pageCfg,
      headers: { default: new Header({ children: [new Paragraph('')] }) },
      footers: { default: new Footer({ children: [new Paragraph('')] }) },
      children: [
        new Paragraph({ text: '', spacing: { after: 3200 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
          children: [new TextRun({ text: bits[0], bold: true, size: 40, color: '1F6F6B' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: (bits[1] || firstTitle || ''), size: 28, color: '444444' })] }),
      ],
    },
    {
      properties: pageCfg,
      headers: { default: new Header({ children: [new Paragraph('')] }) },
      footers: { default: new Footer({ children: [new Paragraph('')] }) },
      children: [new Paragraph({ text: '' })],
    },
  ];
}

const bodySections = [];
let lastPartNum = null;
for (const sec of allSections) {
  const num = groupOf(sec.title);
  if (num && num !== lastPartNum) {
    bodySections.push(...partDivider(num, sec.title.replace(/^Part\s+[\d.]+\s*\u00b7\s*/, '')));
  }
  lastPartNum = num;
  // Front matter (anything with no Part number) follows the Contents page: no banner,
  // and the section title printed in the text at the same size as "Contents".
  const isFront = partOf(sec.title) === 'FRONT';
  bodySections.push({
    properties: pageCfg,
    headers: { default: isFront
      ? new Header({ children: [new Paragraph('')] })
      : HDR(sec.title) },
    footers: { default: FTR },
    children: isFront
      ? [new Paragraph({ children: [new TextRun({ text: sec.title, bold: true, size: 40 })],
                         spacing: { after: 320 } }), ...sec.children]
      : sec.children,
  });
}

const doc = new Document({
  creator: 'Scrutinise',
  title: 'First Scrutiny — The Restoration Programme',
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 220 } } } }] },
      { reference: 'nums', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 220 } } } }] },
    ],
  },
  styles: {
    default: {
      document: { run: { font: 'Calibri', size: 21 }, paragraph: { spacing: { line: 276 } } },
      heading1: { run: { font: 'Calibri', size: 30, bold: true, color: '000000' } },
      heading2: { run: { font: 'Calibri', size: 25, bold: true, color: '1a1a1a' } },
      heading3: { run: { font: 'Calibri', size: 22, bold: true, color: '333333' } },
    },
  },
  sections: [titleSection, contentsSection, ...bodySections],
});

Packer.toBuffer(doc).then(b => {
  fs.writeFileSync(path.join(DIR, OUTNAME + '.docx'), b);
  console.log('sections:', allSections.length);
  allSections.forEach((s, n) => console.log('  ', n + 1, s.title));
  console.log('written');
});
