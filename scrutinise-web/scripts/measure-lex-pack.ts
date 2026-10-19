// 26-T2 - THE LIVE PATH for the three new documents, on a SCRATCH COPY of Charlie's idea: generate -> render -> upload to R2 -> signed download ->
// read the bytes back. Then (with --thread) one real thread summary by Lex. The R2 objects it writes are DELETED, and so is the copy.
//
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/measure-lex-pack.ts [--thread] [ideaPrefix]
import JSZip from 'jszip'
import { prisma } from '../lib/prisma'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'
import { CHARLIES_TEN, CONDITIONS_SOURCE } from './lib/seven-headings'
import * as CD from '../lib/lex/action-conditions-server'
import * as N from '../lib/lex/research-notes'
import { generateProposalExport, signedProposalDownload, proposalFilename, type ProposalKind } from '../lib/documents/proposal-export'
import { r2Delete } from '../lib/r2'
import { summariseThread } from '../lib/lex/action-thread'

const args = process.argv.slice(2)
const prefix = args.find((a) => !a.startsWith('--')) ?? '452c5ade'
let pass = 0, fail = 0
const ok = (name: string, cond: boolean, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }

async function main() {
  const probe = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = probe
  const copy = await scratchCopy(prefix, 'pack')
  const keys: string[] = []
  try {
    if (!(await CD.readConditions(copy.id)).items.length) await CD.seedConditions(copy.id, copy.userId, CHARLIES_TEN, CONDITIONS_SOURCE)
    const live = await prisma.lexCoherentAction.findMany({ where: { ideaId: copy.id, status: 'LIVE' }, orderBy: { number: 'asc' }, select: { id: true, number: true } })
    console.log(`  the copy: ${live.length} live actions`)
    const runs: Array<{ kind: ProposalKind; selection?: { actionIds: string[] } }> = [
      { kind: 'ACTIONS_PACK', selection: { actionIds: live.slice(0, 5).map((a) => a.id) } },
      { kind: 'ACTIONS_PACK' },
      { kind: 'BACKGROUND_REPORT' },
      { kind: 'INTRODUCTORY_SUMMARY' },
    ]
    for (const r of runs) {
      const label = `${r.kind}${r.selection ? ' (5 selected)' : r.kind === 'ACTIONS_PACK' ? ' (all)' : ''}`
      const t0 = Date.now()
      const st = await generateProposalExport(copy.id, r.kind, { force: true, selection: r.selection })
      const secs = ((Date.now() - t0) / 1000).toFixed(1)
      ok(`${label}: generated in ${secs}s, Word and PDF links present, no error`, st.generated && !!st.docxUrl && !!st.pdfUrl && !st.lastError, JSON.stringify(st))
      keys.push(`_exports/${copy.id}/${r.kind === 'ACTIONS_PACK' ? 'actions-pack' : r.kind === 'BACKGROUND_REPORT' ? 'background-report' : 'introductory-summary'}`)
      for (const fmt of ['docx', 'pdf'] as const) {
        const dl = await signedProposalDownload(copy.id, r.kind, fmt, proposalFilename('scratch', r.kind, fmt), null)
        ok(`${label}: ${fmt} has a signed link and it is not stale`, !!dl && dl.stale === false, JSON.stringify(dl))
        if (!dl) continue
        const bytes = Buffer.from(await (await fetch(dl.url)).arrayBuffer())
        if (fmt === 'docx') {
          const zip = await JSZip.loadAsync(bytes)
          const xml = await zip.file('word/document.xml')!.async('string')
          ok(`${label}: the downloaded .docx opens as a zip with a body (${(bytes.length / 1024).toFixed(0)} KB)`, xml.length > 2000)
          if (r.kind === 'ACTIONS_PACK') ok(`${label}: it carries the numbering key and a B.n.n paragraph`, /How the paragraphs are numbered/.test(xml) && /[A-Z]\.1\.1/.test(xml))
        } else ok(`${label}: the downloaded PDF is a PDF (${(bytes.length / 1024).toFixed(0)} KB)`, bytes.subarray(0, 4).toString() === '%PDF')
      }
    }
    if (args.includes('--thread')) {
      const a = live[0]
      const owner = { id: copy.userId, isOwner: true }
      await N.addNote(copy.id, { id: copy.userId }, owner, { op: 'addNote', ownObservation: true, comment: 'This action needs a named owner before it can be enforced.', stance: 'CONTEXT', tags: ['comment'], bearsOn: [{ kind: 'action', id: a.id, label: `Action ${a.number}` }] })
      const note = await prisma.researchNote.findFirst({ where: { ideaId: copy.id }, orderBy: { createdAt: 'desc' } })
      if (note) await N.reply(copy.id, owner, note.id, 'Agreed, and the Cabinet Office should hold it.')
      const t0 = Date.now()
      const s = await summariseThread(copy.id, copy.userId, owner, a.id)
      ok(`the thread summary came back in ${((Date.now() - t0) / 1000).toFixed(1)}s`, s.ok, (s as { error?: string }).error)
      if (s.ok) {
        console.log(`  summary (${s.data.pence}p): ${s.data.summary}`)
        ok('the summary stored nothing (no new note or reply was written by it)', (await prisma.researchNote.count({ where: { ideaId: copy.id } })) === 1 && (await prisma.researchNoteReply.count({ where: { note: { ideaId: copy.id } } })) === 1)
      }
    }
  } finally {
    for (const k of keys) for (const ext of ['docx', 'pdf']) await r2Delete(`${k}.${ext}`).catch(() => {})
    await deleteScratch(copy.id)
  }
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
