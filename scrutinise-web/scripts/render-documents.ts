// ─────────────────────────────────────────────────────────────────────────────
// 25-U §2 — generate EVERY document this idea can produce, as flat text, so it can be read
// end to end as a reader rather than inspected as a component.
//
// ⚠ IT RENDERS THE SAME `DocumentModel` THE DOCX AND PDF RENDERERS CONSUME. Reading the model
// rather than the source is the point — §2 asks what a stranger sees, and the source cannot
// answer that. The only thing this adds is a flattening to text; every word comes from a builder.
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { prisma } from '../lib/prisma'
import { buildProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { buildProposalDocument, buildSummaryDocument } from '../lib/documents/build-proposal'
import { buildEvidencePackDocument } from '../lib/documents/build-evidence-pack'
import { buildMeetingPackDocument } from '../lib/documents/build-meeting-pack'
import { buildInitialBackground } from '../lib/documents/build-initial-background'
import type { Block, DocumentModel, Run } from '../lib/documents/model'

const IDEA = process.argv[2] ?? '452c5ade-3153-400a-bf48-3b71aaa52773'
// ⚠ Not a session scratchpad path — this is a tool, and the next person to run it will not have
// that directory. Override with the second argument.
const OUT = process.argv[3] ?? join(tmpdir(), 'scrutinise-documents')

const runs = (r: Run[]) => r.map((x) => x.text).join('')

function flatten(m: DocumentModel): string {
  const out: string[] = []
  out.push(`TITLE: ${m.title}`)
  if (m.subtitle) out.push(`SUBTITLE: ${m.subtitle}`)
  out.push(`SOURCE LABEL: ${m.sourceLabel}`)
  out.push('')
  for (const b of m.blocks as Block[]) {
    switch (b.kind) {
      case 'section': out.push(`\n════════ SECTION: ${b.title} ════════\n`); break
      case 'heading': out.push(`\n${'#'.repeat(b.level)} ${runs(b.runs)}`); break
      case 'paragraph': out.push(runs(b.runs)); break
      case 'bullets':
        b.items.forEach((it, i) => out.push(`${b.ordered ? `${i + 1}.` : '  -'} ${runs(it)}`))
        break
      case 'sources':
        out.push(`[SOURCES — ${b.label}]`)
        for (const r of b.refs) {
          out.push(`   · ${r.title} | ${r.citation}${r.date ? ` | ${r.date}` : ''} | ${r.url}`)
          if (r.snippet) out.push(`     "${r.snippet}"`)
        }
        break
      case 'note': out.push(`[NOTE] ${b.text}`); break
      case 'rule': out.push('---'); break
      default: out.push(`[UNKNOWN BLOCK ${JSON.stringify(b).slice(0, 120)}]`)
    }
  }
  return out.join('\n')
}

function words(s: string) { return s.split(/\s+/).filter(Boolean).length }

async function main() {
  mkdirSync(OUT, { recursive: true })
  const snapshot = await buildProposalSnapshot(IDEA)

  const docs: Array<{ name: string; model: DocumentModel }> = []
  const push = (name: string, fn: () => { model: DocumentModel }) => {
    try { docs.push({ name, model: fn().model }) }
    catch (e) { console.log(`DOC ${name}: THREW — ${e instanceof Error ? e.message : e}`) }
  }

  push('01-proposal-long', () => buildProposalDocument(snapshot))
  push('02-summary-short', () => buildSummaryDocument(snapshot))
  push('03-evidence-pack', () => buildEvidencePackDocument(snapshot))
  push('04-meeting-pack', () => buildMeetingPackDocument(snapshot))

  try {
    const bg = await buildInitialBackground(IDEA)
    if (bg && 'model' in bg && bg.model) docs.push({ name: '05-initial-background', model: bg.model as DocumentModel })
    else console.log(`DOC 05-initial-background: returned ${JSON.stringify(bg).slice(0, 160)}`)
  } catch (e) { console.log(`DOC 05-initial-background: THREW — ${e instanceof Error ? e.message : e}`) }

  for (const d of docs) {
    const text = flatten(d.model)
    writeFileSync(`${OUT}/${d.name}.txt`, text, 'utf8')
    console.log(`DOC ${d.name.padEnd(22)} ${String(words(text)).padStart(6)} words  ${String(d.model.blocks.length).padStart(4)} blocks  "${d.model.title}"`)
  }
  console.log(`DOC written to ${OUT}`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
