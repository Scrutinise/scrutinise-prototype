// Sprint 2.5 (§8.2) — render-path check. Exercises the block model, the markdown
// parser and BOTH renderers against adversarial content (curly quotes, dashes,
// accents, currency and section symbols, and codepoints outside WinAnsi that
// pdf-lib would otherwise throw on — docs/CLAUDE.md §14).
//
// Run: npx tsx scripts/check-document-render.ts [outDir]

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { PDFDocument, PDFDict, PDFName, PDFString } from 'pdf-lib'
import { markdownToBlocks, parseInline } from '../lib/documents/markdown'
import { renderDocx } from '../lib/documents/render-docx'
import { renderPdf, toWinAnsi } from '../lib/documents/render-pdf'
import type { DocumentModel } from '../lib/documents/model'

const outDir = process.argv[2] ?? join(process.cwd(), '.tmp-export-check')
mkdirSync(outDir, { recursive: true })

const BODY = `
# What the law says today

The **Road Traffic Act 1988**, s.36 — “failing to comply with a traffic sign” — is the
operative provision, and it has been amended by the *Traffic Management Act 2004*.
Enforcement is split between police forces and local authorities under [the 2004 Act](https://www.legislation.gov.uk/ukpga/2004/18).

## Where it falls short

- Penalties are set in cash terms and have not been uprated since 2013 (£100 → €118 at
  today's rate), so deterrence has decayed in real terms.
- Councils in Ceredigion and Ynys Môn report enforcement costs above the fines recovered.
- The § numbering in the consolidated text no longer matches the enacted text.

### Committee comment

1. The Transport Committee raised this in 2019.
2. The Government response accepted the analysis but not the remedy.

---

A closing paragraph with an arrow → and a tick ✓ and an emoji 🚗 that WinAnsi cannot
encode, present precisely so the export proves it degrades rather than fails.
`.trim()

const model: DocumentModel = {
  title: 'Uprating fixed-penalty notices for traffic offences',
  subtitle: 'Initial Background briefing',
  sourceLabel: 'the stored Initial Background briefing, 4 sources, corpus search of 2026-08-05 09:12 UTC',
  generatedAt: new Date('2026-08-05T12:00:00Z'),
  blocks: [
    { kind: 'note', text: 'A short preview line, as stored on the Document record.' },
    ...markdownToBlocks(BODY),
    { kind: 'rule' },
    { kind: 'heading', level: 2, runs: [{ text: 'Sources' }] },
    {
      kind: 'sources',
      label: 'Primary legislation',
      refs: [
        {
          title: 'Road Traffic Act 1988',
          citation: 'Road Traffic Act 1988, s.36',
          url: 'https://www.legislation.gov.uk/ukpga/1988/52/section/36',
          snippet: 'A person driving a vehicle who fails to comply with a traffic sign…',
          date: '1988-05-15',
        },
        {
          title: 'Traffic Management Act 2004',
          citation: 'Traffic Management Act 2004, Part 6',
          url: 'https://www.legislation.gov.uk/ukpga/2004/18/part/6',
        },
      ],
    },
    {
      kind: 'sources',
      label: 'Committee reports',
      refs: [{
        title: 'Transport Committee — Road traffic enforcement',
        citation: 'HC 1745, 2018–19',
        url: 'https://publications.parliament.uk/pa/cm201719/cmselect/cmtrans/1745/1745.pdf',
        snippet: 'The Committee heard that penalty levels have not kept pace with inflation.',
        date: '2019-07-24',
      }],
    },
  ],
}

/** Pull the visible text out of a .docx by unzipping word/document.xml. */
async function readDocxText(buf: Buffer): Promise<string> {
  const { default: mammoth } = await import('mammoth')
  const { value } = await mammoth.extractRawText({ buffer: buf })
  // Hyperlink targets live in relationships, not the text run, so read them from
  // the raw part as well — "sources and citations intact" includes the links.
  const rels = buf.toString('latin1')
  const urls = rels.match(/https?:\/\/[^"'\s<>]+/g) ?? []
  return `${value}\n${urls.join('\n')}`
}

/** Pull the visible text out of a PDF, using the parser already in the app. */
async function readPdfText(buf: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(buf) })
  try {
    const { text } = await parser.getText()
    return text
  } finally {
    await parser.destroy()
  }
}

let fail = 0
const ok = (label: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`✓ ${label}`)
  else { console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`); fail++ }
}

async function main() {
  // ── the parser ────────────────────────────────────────────────────────────
  const blocks = markdownToBlocks(BODY)
  ok('markdown → headings', blocks.filter((b) => b.kind === 'heading').length === 3)
  ok('markdown → bullets kept as one list',
    blocks.some((b) => b.kind === 'bullets' && !b.ordered && b.items.length === 3))
  ok('markdown → ordered list kept separate',
    blocks.some((b) => b.kind === 'bullets' && b.ordered && b.items.length === 2))
  ok('markdown → horizontal rule', blocks.some((b) => b.kind === 'rule'))

  const inline = parseInline('The **Road Traffic Act 1988** and [the 2004 Act](https://example.gov.uk/x) apply.')
  ok('inline → bold run', inline.some((r) => r.bold && r.text.includes('Road Traffic Act')))
  ok('inline → link carries href', inline.some((r) => r.href === 'https://example.gov.uk/x'))
  ok('inline → no markdown syntax leaks into text',
    !inline.map((r) => r.text).join('').includes('**'))

  // ── the WinAnsi guard ─────────────────────────────────────────────────────
  ok('WinAnsi keeps curly quotes and dashes', toWinAnsi('“a” — b’s') === '“a” — b’s',
    JSON.stringify(toWinAnsi('“a” — b’s')))
  ok('WinAnsi keeps £, €, §', toWinAnsi('£100 €118 §36') === '£100 €118 §36')
  ok('WinAnsi maps an arrow', toWinAnsi('a → b') === 'a -> b')
  ok('WinAnsi drops an emoji rather than throwing', !toWinAnsi('car 🚗 here').includes('🚗'))

  // ── the renderers ─────────────────────────────────────────────────────────
  const docx = await renderDocx(model)
  const docxPath = join(outDir, 'initial-background.docx')
  writeFileSync(docxPath, docx)
  ok('docx is a zip (PK header)', docx.subarray(0, 2).toString('latin1') === 'PK')
  ok('docx is non-trivial in size', docx.length > 8000, `${docx.length} bytes`)
  // The .docx XML is compressed, so assert on structure rather than searching bytes
  // for prose — a substring check here would pass for the wrong reason.
  ok('docx contains word/document.xml', docx.includes(Buffer.from('word/document.xml')))

  const pdf = await renderPdf(model)
  const pdfPath = join(outDir, 'initial-background.pdf')
  writeFileSync(pdfPath, pdf)
  const head = pdf.subarray(0, 8).toString('latin1')
  ok('pdf has a %PDF header', head.startsWith('%PDF-'), head)
  ok('pdf is non-trivial in size', pdf.length > 5000, `${pdf.length} bytes`)

  // pdf-lib writes object streams, so the page tree and the annotations are
  // compressed — scanning the raw bytes would fail for the wrong reason. Read the
  // file back with a parser instead, which also proves it is loadable at all.
  const reloaded = await PDFDocument.load(pdf)
  ok('pdf reloads and declares pages', reloaded.getPageCount() >= 1, `${reloaded.getPageCount()} pages`)

  const urls = new Set<string>()
  for (const page of reloaded.getPages()) {
    const annots = page.node.Annots()
    if (!annots) continue
    for (let i = 0; i < annots.size(); i++) {
      const annot = annots.lookup(i, PDFDict)
      const action = annot.lookup(PDFName.of('A'), PDFDict)
      const uri = action?.lookup(PDFName.of('URI'), PDFString)
      if (uri) urls.add(uri.asString())
    }
  }
  ok('pdf carries the source URLs as clickable link annotations',
    [...urls].some((u) => u.includes('legislation.gov.uk/ukpga/1988/52/section/36')),
    `${urls.size} link annotations`)
  ok('pdf links include the in-prose markdown link',
    [...urls].some((u) => u.includes('ukpga/2004/18')))

  // A long body must paginate rather than run off the bottom of page one.
  const long: DocumentModel = {
    ...model,
    blocks: Array.from({ length: 60 }, (_, i) => ({
      kind: 'paragraph' as const,
      runs: [{ text: `Paragraph ${i + 1}. ${'Enforcement costs exceed the fines recovered. '.repeat(4)}` }],
    })),
  }
  const pageCount = (await PDFDocument.load(await renderPdf(long))).getPageCount()
  ok('pdf paginates long content', pageCount >= 3, `${pageCount} pages`)

  // ── readable, not merely well-formed ──────────────────────────────────────
  // Extract the text back out of both files. A file that parses but whose prose
  // and citations cannot be read out of it is not an export, it is a container.
  const docxXml = await readDocxText(docx)
  ok('docx text contains the briefing prose', docxXml.includes('Road Traffic Act 1988'))
  ok('docx text contains a citation', docxXml.includes('Road Traffic Act 1988, s.36'))
  ok('docx text contains a source URL', docxXml.includes('legislation.gov.uk'))
  ok('docx text keeps the bullet that wrapped across lines',
    docxXml.includes('deterrence has decayed in real terms'))
  ok('docx text carries the provenance line', docxXml.includes('Generated 2026-08-05 12:00 UTC from'))

  const pdfText = await readPdfText(pdf)
  ok('pdf text contains the briefing prose', pdfText.includes('Road Traffic Act 1988'))
  ok('pdf text contains a citation', pdfText.includes('Road Traffic Act 1988, s.36'))
  ok('pdf text contains a source URL', pdfText.includes('legislation.gov.uk'))
  ok('pdf text keeps the numbered list', pdfText.includes('1.') && pdfText.includes('Transport Committee raised this in 2019'))
  ok('pdf text carries the provenance line', pdfText.includes('Generated 2026-08-05 12:00 UTC from'))
  ok('pdf text keeps £ and § intact', pdfText.includes('£100') && pdfText.includes('§'))

  console.log(`\nWritten: ${docxPath}\n         ${pdfPath}`)
  if (fail) { console.error(`\n${fail} check(s) failed.`); process.exit(1) }
  console.log('\nAll render checks passed.')
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1) })
