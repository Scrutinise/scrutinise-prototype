const fs = require('fs');
const path = require('path');
const D = require('docx');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak, AlignmentType,
  Header, Footer, PageNumber, Table, TableRow, TableCell, WidthType, ShadingType,
  BorderStyle, LevelFormat, convertInchesToTwip, PositionalTab, PositionalTabAlignment,
  PositionalTabLeader
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
                   '03_part2.md','07_bingham.md','04_part3.md','06_part6.md','13_part7_limitations.md'],
           out: 'RESTORATION_1_The_programme_and_the_argument',
           sub: 'What the programme is, and the argument it turns on',
           vol: 'Volume 1 of 3' },
  vol2:  { files: ['01a_front_vol2.md','08_part4.md','09_part5_rest.md'],
           out: 'RESTORATION_2_The_measures_worked',
           sub: 'Eleven measures worked against the statute book',
           vol: 'Volume 2 of 3' },
  vol3:  { files: ['01b_front_vol3.md','20_appendix_a_citator.md','21_appendix_b_positions.md','22_appendix_c_research_panel.md'],
           out: 'RESTORATION_3_The_evidence',
           sub: 'Supporting schedules and the record of testing',
           vol: 'Volume 3 of 3' },
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
function runs(text, base = {}) {
  const out = [];
  // tokenise on ** ... ** and * ... *
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
  const colW = Math.floor(TOTAL / nCols);
  const widths = Array(nCols).fill(colW);
  widths[nCols - 1] = TOTAL - colW * (nCols - 1);
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
      push(new Paragraph({
        children: runs(line.replace(/^## /, '')),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 160 },
      }));
      i++; continue;
    }
    if (/^### /.test(line)) {
      push(new Paragraph({
        children: runs(line.replace(/^### /, '')),
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
  const md = fs.readFileSync(path.join(DIR, f), 'utf8');
  allSections = allSections.concat(parse(md));
}

function partOf(t) {
  const m = t.match(/^Part\s+(\d+)/i);
  if (m) return 'PART ' + m[1];
  return 'FRONT';
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
      children: [new TextRun({ text: 'Scrutiny by Scrutinise  \u00b7  Second draft, 9 September 2026' + (CFG.vol ? '  \u00b7  ' + CFG.vol : ''), size: 20, color: '555555' })] }),
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
    const md = fs.readFileSync(path.join(DIR, f), 'utf8');
    for (const line of md.split('\n')) {
      const m = line.match(/^# (.+)$/);
      if (m && m[1].trim() !== 'Title') heads.push(m[1].trim());
    }
  }
  const count = {};
  for (const h of heads) {
    const pm = h.match(/^Part (\d+)/);
    if (pm) count[pm[1]] = (count[pm[1]] || 0) + 1;
  }
  const PARTNAMES = {
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
    const pm = full.match(/^Part (\d+)(?:\.(\d+))? \u00b7 (.+)$/);
    if (pm) {
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
  headers: { default: HDR('Contents') },
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
      children: [new TextRun({ text: 'The Part number is in the teal banner across the top of every page, with the section name beside it.', italics: true, size: 18, color: '666666' })],
    }),
  ],
};

allSections = allSections.filter(s => s.title !== 'Title');
const bodySections = allSections.map(s => ({
  properties: pageCfg,
  headers: { default: HDR(s.title) },
  footers: { default: FTR },
  children: s.children,
}));

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
