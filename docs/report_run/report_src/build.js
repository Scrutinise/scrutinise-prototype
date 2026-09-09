const fs = require('fs');
const path = require('path');
const D = require('docx');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak, AlignmentType,
  Header, Footer, PageNumber, Table, TableRow, TableCell, WidthType, ShadingType,
  BorderStyle, LevelFormat, convertInchesToTwip, PositionalTab, PositionalTabAlignment,
  PositionalTabLeader
} = D;

const SHORT = process.env.VARIANT === 'short';
const FILES = SHORT
  ? ['01_front.md','02a_twelve.md','02_register.md','03_part2.md','07_bingham.md','04_part3_4.md','05_part5_short.md','06_part6_7.md']
  : ['01_front.md','02a_twelve.md','02_register.md','03_part2.md','07_bingham.md','04_part3_4.md','08_part4_full.md','09_part5_rest.md','06_part6_7.md'];
const OUTNAME = SHORT ? 'FIRST_SCRUTINY_Restoration_Programme_SHORT' : 'FIRST_SCRUTINY_Restoration_Programme';
const TOCFILE = SHORT ? 'pagemap_short.json' : 'pagemap.json';
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
      children: [new TextRun({ text: 'Repeal, annulment, and what the programme would actually require', italics: true, size: 24, color: '555555' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
      children: [new TextRun({ text: 'An issues paper. The starting point of legislative scrutiny, not the end of it.', size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1800 },
      children: [new TextRun({ text: 'A draft for the proposers to correct.', bold: true, size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
      children: [new TextRun({ text: 'Proposer: David Starkey', bold: true, size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
      children: [new TextRun({ text: 'Scrutiny by Scrutinise  ·  First pass, 4 September 2026', size: 20, color: '555555' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Scrutinise is free and non-partisan. It takes a proposal and works out what', italics: true, size: 18, color: '666666' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'delivering it would actually require. It is available on identical terms to anyone.', italics: true, size: 18, color: '666666' })] }),
  ],
};

// ---- Contents ----
let PAGEMAP = {};
try { PAGEMAP = JSON.parse(fs.readFileSync(path.join(DIR, TOCFILE), 'utf8')); } catch (e) {}
const tocLong = [
  ['FRONT', 'What this is'],
  ['What this is, and what it is not', 'What this is'],
  ['', ''],
  ['PART 1 · THE PROGRAMME, IN DAVID’S OWN WORDS', 'Part 1 · The twelve, and how we chose them'],
  ['The twelve measures, and how we chose them', 'Part 1 · The twelve, and how we chose them'],
  ['The register — what David said, and what the law must do', 'Part 1 · The register'],
  ['', ''],
  ['PART 2 · ACROSS THE WHOLE PROGRAMME', 'Part 2.1 · Does repeal remove the rights?'],
  ['2.1  Does repeal actually remove the rights?', 'Part 2.1 · Does repeal remove the rights?'],
  ['2.2  “Annulment” — does the Henry VIII device work?', 'Part 2.2 · Annulment'],
  ['2.3  Four plans for the same problem', 'Part 2.3 · Four plans'],
  ['2.4  Scotland, Wales and Northern Ireland', 'Part 2.4 · Scotland, Wales, Northern Ireland'],
  ['2.5  Who else has published on this', 'Part 2.5 · Who else has said what'],
  ['2.6  What is already before Parliament', 'Part 2.6 · Already before Parliament'],
  ['2.7  Where our sources came from', 'Part 2.7 · Where our sources came from'],
  ['2.8  What happened between 1997 and 2010', 'Part 2.8 · What happened between 1997 and 2010'],
  ['2.9  Democracy, courts and international obligation', 'Part 2.9 · Democracy and international obligation'],
  ['', ''],
  ['PART 3 · DO THE TWELVE HAVE TO MOVE TOGETHER?', 'Part 3 · Do the twelve move together?'],
  ['', ''],
  ['PART 4 · THREE MEASURES WORKED IN FULL', 'Part 4.1 · Human Rights Act — the statute book'],
  ['4.1  Human Rights Act — what the statute book shows', 'Part 4.1 · Human Rights Act — the statute book'],
  ['4.2  Equality Act — what the statute book shows', 'Part 4.2 · Equality Act — the statute book'],
  ['4.3  Human Rights Act — the full analysis', 'Part 4.3 · Human Rights Act — full analysis'],
  ['4.4  Public sector equality duty — the full analysis', 'Part 4.4 · Equality Act — full analysis'],
  ['4.5  The permanent civil service — the full analysis', 'Part 4.5 · Civil service — full analysis'],
  ['', ''],
  ['PART 5 · FIVE FURTHER MEASURES', 'Part 5.1 · The Supreme Court'],
  ['5.1  The Supreme Court', 'Part 5.1 · The Supreme Court'],
  ['5.2  The arm’s-length bodies', "Part 5.2 · The arm's-length bodies"],
  ['5.3  Judicial review of ministers’ decisions', 'Part 5.3 · Judicial review of ministers’ decisions'],
  ['5.4  The independence of the Bank of England', 'Part 5.4 · The independence of the Bank of England'],
  ['5.5  Diversity and inclusion in the civil service', 'Part 5.5 · Diversity and inclusion practice in the civil service'],
  ['', ''],
  ['PART 6 · THE QUESTIONS ONLY DAVID CAN ANSWER', 'Part 6 · The questions'],
  ['PART 7 · HOW THIS WAS MADE, AND WHAT IT CANNOT DO YET', 'Part 7 · How this was made'],
];
const tocShort = [
  ['FRONT', 'What this is'],
  ['What this is, and what it is not', 'What this is'],
  ['', ''],
  ['PART 1 · THE PROGRAMME, IN DAVID\u2019S OWN WORDS', 'Part 1 · The twelve, and how we chose them'],
  ['The twelve measures, and how we chose them', 'Part 1 · The twelve, and how we chose them'],
  ['The register — what David said, and what the law must do', 'Part 1 · The register'],
  ['', ''],
  ['PART 2 · ACROSS THE WHOLE PROGRAMME', 'Part 2.1 · Does repeal remove the rights?'],
  ['2.1  Does repeal actually remove the rights?', 'Part 2.1 · Does repeal remove the rights?'],
  ['2.2  \u201cAnnulment\u201d — does the Henry VIII device work?', 'Part 2.2 · Annulment'],
  ['2.3  Four plans for the same problem', 'Part 2.3 · Four plans'],
  ['2.4  Scotland, Wales and Northern Ireland', 'Part 2.4 · Scotland, Wales, Northern Ireland'],
  ['2.5  Who else has published on this', 'Part 2.5 · Who else has said what'],
  ['2.6  What is already before Parliament', 'Part 2.6 · Already before Parliament'],
  ['2.7  Where our sources came from', 'Part 2.7 · Where our sources came from'],
  ['2.8  What happened between 1997 and 2010', 'Part 2.8 · What happened between 1997 and 2010'],
  ['2.9  Democracy, courts and international obligation', 'Part 2.9 · Democracy and international obligation'],
  ['', ''],
  ['PART 3 · DO THE TWELVE HAVE TO MOVE TOGETHER?', 'Part 3 · Do the twelve move together?'],
  ['', ''],
  ['PART 4 · TWO MEASURES WORKED THROUGH', 'Part 4.1 · Human Rights Act — the statute book'],
  ['4.1  Human Rights Act — what the statute book shows', 'Part 4.1 · Human Rights Act — the statute book'],
  ['4.2  Equality Act — what the statute book shows', 'Part 4.2 · Equality Act — the statute book'],
  ['', ''],
  ['PART 5 · THE OTHER TEN MEASURES, IN BRIEF', 'Part 5 · The other ten measures'],
  ['', ''],
  ['PART 6 · THE QUESTIONS ONLY DAVID CAN ANSWER', 'Part 6 · The questions'],
  ['PART 7 · HOW THIS WAS MADE, AND WHAT IT CANNOT DO YET', 'Part 7 · How this was made'],
];
const toc = SHORT ? tocShort : tocLong;

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
