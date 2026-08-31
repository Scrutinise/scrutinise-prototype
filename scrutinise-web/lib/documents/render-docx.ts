// ─────────────────────────────────────────────────────────────────────────────
// §8.2 — DocumentModel → .docx. Knows nothing about briefings; it renders blocks.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Document, Packer, Paragraph, TextRun, ExternalHyperlink, HeadingLevel,
  AlignmentType, BorderStyle, Header,
} from 'docx'
import type { Block, DocumentModel, Run } from './model'

const HEADING_FOR: Record<1 | 2 | 3, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
}

function runsToDocx(runs: Run[]): (TextRun | ExternalHyperlink)[] {
  return runs.map((r) => {
    const inner = new TextRun({ text: r.text, bold: r.bold, italics: r.italic })
    if (!r.href) return inner
    return new ExternalHyperlink({
      link: r.href,
      children: [new TextRun({ text: r.text, bold: r.bold, italics: r.italic, style: 'Hyperlink' })],
    })
  })
}

function blockToParagraphs(block: Block): Paragraph[] {
  switch (block.kind) {
    // ⚠ 25-N §5c — HANDLED BY `renderDocx`, NOT HERE. A .docx repeating header is a property
    // of a document SECTION, not a paragraph in the flow, so a `section` block splits the
    // children into real docx sections. Returning a paragraph here would produce a heading
    // printed once, which is exactly what §5c is replacing.
    case 'section':
      return []

    case 'heading':
      return [new Paragraph({ heading: HEADING_FOR[block.level], children: runsToDocx(block.runs), spacing: { before: 240, after: 120 } })]

    case 'paragraph':
      return [new Paragraph({ children: runsToDocx(block.runs), spacing: { after: 140 } })]

    case 'bullets':
      // Ordered lists are numbered inline rather than through a document-level
      // numbering definition — one less construct to keep in step, and for a flat
      // list the rendered result is identical.
      return block.items.map((item, i) =>
        block.ordered
          ? new Paragraph({
              children: [new TextRun({ text: `${i + 1}. ` }), ...runsToDocx(item)],
              indent: { left: 360 },
              spacing: { after: 60 },
            })
          : new Paragraph({ children: runsToDocx(item), bullet: { level: 0 }, spacing: { after: 60 } }),
      )

    case 'note':
      return [new Paragraph({
        children: [new TextRun({ text: block.text, italics: true, color: '52525B' })],
        spacing: { after: 200 },
      })]

    case 'rule':
      return [new Paragraph({
        text: '',
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D4D4D8', space: 1 } },
        spacing: { before: 160, after: 160 },
      })]

    case 'sources': {
      const out: Paragraph[] = [
        new Paragraph({
          children: [new TextRun({ text: block.label.toUpperCase(), bold: true, size: 18, color: '52525B' })],
          spacing: { before: 200, after: 80 },
        }),
      ]
      for (const ref of block.refs) {
        out.push(new Paragraph({
          children: [new TextRun({ text: ref.title, bold: true })],
          spacing: { after: 20 },
        }))
        const meta = [ref.citation, ref.date].filter(Boolean).join(' · ')
        if (meta) {
          out.push(new Paragraph({
            children: [new TextRun({ text: meta, size: 18, color: '71717A' })],
            spacing: { after: 20 },
          }))
        }
        if (ref.snippet) {
          out.push(new Paragraph({
            children: [new TextRun({ text: ref.snippet, size: 18, italics: true, color: '52525B' })],
            spacing: { after: 20 },
          }))
        }
        if (ref.url) {
          out.push(new Paragraph({
            children: [new ExternalHyperlink({
              link: ref.url,
              children: [new TextRun({ text: ref.url, size: 18, style: 'Hyperlink' })],
            })],
            spacing: { after: 140 },
          }))
        }
      }
      return out
    }
  }
}

export async function renderDocx(model: DocumentModel): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: model.title })] }),
  ]
  if (model.subtitle) {
    children.push(new Paragraph({
      children: [new TextRun({ text: model.subtitle, color: '52525B' })],
      spacing: { after: 60 },
    }))
  }
  // Provenance travels INSIDE the file, not only beside the download link — a
  // document that leaves the platform must still say what it was made from.
  children.push(new Paragraph({
    children: [new TextRun({
      text: `Generated ${model.generatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC from ${model.sourceLabel}.`,
      size: 18, italics: true, color: '71717A',
    })],
    spacing: { after: 240 },
    alignment: AlignmentType.LEFT,
  }))

  // ══ 25-N §5c — REAL DOCX SECTIONS, EACH WITH ITS NAME AS A REPEATING HEADER ═══
  //
  // §5c: *"the heading repeated in large bold type on every page of that section, so a reader
  // leafing through a hundred pages always knows where they are."*
  //
  // ⚠⚠ A WORD HEADER IS A PROPERTY OF A SECTION, WHICH IS WHY THIS SPLITS THE DOCUMENT RATHER
  // THAN INSERTING ANYTHING. Writing the title into the body at each break would print it once
  // — on the page the section starts — and Word would carry the PREVIOUS section's header (or
  // none) across the other ninety-nine.
  //
  // ⚠ AND THE FIRST SECTION HOLDS THE TITLE PAGE AND HAS NO HEADER. A running "DRAFT STRATEGY"
  // over the document's own title block would be a header describing the wrong thing.
  const docSections: Array<{ title: string | null; children: Paragraph[] }> = [
    { title: null, children },
  ]
  for (const block of model.blocks) {
    if (block.kind === 'section') {
      docSections.push({ title: block.title, children: [] })
      continue
    }
    docSections[docSections.length - 1].children.push(...blockToParagraphs(block))
  }

  const doc = new Document({
    title: model.title,
    description: model.subtitle,
    creator: 'Scrutinise',
    sections: docSections.map((sec) => ({
      children: sec.children.length
        ? sec.children
        // ⚠ A DOCX SECTION WITH NO CHILDREN IS INVALID and Word offers to repair the file. An
        // empty section is a real state — a builder emitting a heading for material that turned
        // out not to exist — so it gets one paragraph saying so rather than a broken document.
        : [new Paragraph({ children: [new TextRun({ text: 'Nothing was recorded under this heading.', italics: true, color: '71717A' })] })],
      ...(sec.title
        ? {
            headers: {
              default: new Header({
                children: [new Paragraph({
                  children: [new TextRun({ text: sec.title, bold: true, size: 24, color: '52525B' })],
                })],
              }),
            },
          }
        : {}),
    })),
  })
  return Buffer.from(await Packer.toBuffer(doc))
}
