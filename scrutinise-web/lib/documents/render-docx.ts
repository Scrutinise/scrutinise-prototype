// ─────────────────────────────────────────────────────────────────────────────
// §8.2 — DocumentModel → .docx. Knows nothing about briefings; it renders blocks.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Document, Packer, Paragraph, TextRun, ExternalHyperlink, HeadingLevel,
  AlignmentType, BorderStyle,
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

  for (const block of model.blocks) children.push(...blockToParagraphs(block))

  const doc = new Document({
    title: model.title,
    description: model.subtitle,
    creator: 'Scrutinise',
    sections: [{ children }],
  })
  return Buffer.from(await Packer.toBuffer(doc))
}
