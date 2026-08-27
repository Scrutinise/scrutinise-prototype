// ─────────────────────────────────────────────────────────────────────────────
// 25-I §2 — drive the document pipeline for real, with Charlie's own document.
//
// ⚠⚠ WHY THIS EXISTS: `IdeaUserMaterial` had ZERO ROWS across the whole production
// database. 25-H reported §4 shipped and the component IS real — a file input, FormData,
// an extractor, a findings pass — but nothing had ever been through it. "Built inert"
// hides write-path bugs: the first live run of the stats layer found six real bugs in a
// tsc-clean build, three of which were reporting SUCCESS.
//
// So this runs the SAME functions the route runs, in the SAME order, and then RE-READS
// what was stored. It does not re-implement the route: `extractFile` → create →
// `runMaterialFindings` is exactly the POST path, minus Clerk.
//
// ⚠ IT RECONCILES ATTEMPTED AGAINST STORED. Every claim printed at the end is read back
// out of the database after the fact, never taken from a return value.
//
// Usage:
//   tsx --env-file=.env scripts/verify-material-live.ts <ideaId> <path-to-file>
//   tsx --env-file=.env scripts/verify-material-live.ts <ideaId> <path> --keep
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { prisma } from '../lib/prisma'
import { extractFile, runMaterialFindings } from '../lib/lex/user-material'
import { USER_MATERIAL_PASS_PREFIX } from '../lib/lex/heading-map'

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.html': 'text/html',
}

async function main() {
  const [ideaArg, path] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const keep = process.argv.includes('--keep')
  if (!ideaArg || !path) {
    console.error('usage: verify-material-live.ts <ideaId> <path-to-file> [--keep]')
    process.exitCode = 1
    return
  }

  const idea = await prisma.idea.findFirst({
    where: { id: { startsWith: ideaArg }, deletedAt: null },
    select: { id: true, title: true, creatorId: true },
  })
  if (!idea) { console.error(`no live idea starting ${ideaArg}`); process.exitCode = 1; return }

  const bytes = readFileSync(path)
  const name = basename(path)
  const mime = MIME[extname(path).toLowerCase()] ?? 'application/octet-stream'
  console.log(`── 25-I §2 live material run ──`)
  console.log(`idea  ${idea.id.slice(0, 8)} "${idea.title}"`)
  console.log(`file  ${name}  ${bytes.byteLength.toLocaleString()} bytes  ${mime}\n`)

  // ── 1. Extract ────────────────────────────────────────────────────────────
  let extracted
  try {
    extracted = await extractFile(bytes, mime, name)
  } catch (e) {
    console.log(`✗ EXTRACT THREW: ${e instanceof Error ? e.message : String(e)}`)
    process.exitCode = 1
    return
  }
  console.log(`✓ extracted ${extracted.text.length.toLocaleString()} chars` +
    `${extracted.truncated ? ' (TRUNCATED)' : ''}  title=${extracted.title ?? '-'}`)
  console.log(`  first 160: ${extracted.text.slice(0, 160).replace(/\s+/g, ' ')}…\n`)

  // ── 2. Store, exactly as the route does ───────────────────────────────────
  const created = await prisma.ideaUserMaterial.create({
    data: {
      ideaId: idea.id,
      kind: 'FILE',
      status: 'READY',
      label: (extracted.title || name).slice(0, 300),
      filename: name.slice(0, 300),
      mimeType: mime,
      text: extracted.text,
      charCount: extracted.text.length,
      sourceBytes: bytes.byteLength,
      rightsConfirmed: true,
      addedBy: idea.creatorId,
    },
    select: { id: true },
  })
  console.log(`✓ stored as ${created.id.slice(0, 8)}`)

  // ── 3. The findings pass ──────────────────────────────────────────────────
  let written = 0
  let note: string | null = null
  try {
    const out = await runMaterialFindings(created.id)
    written = out.written
    note = out.note
    console.log(`✓ findings pass returned written=${out.written} note=${out.note ?? '-'}\n`)
  } catch (e) {
    console.log(`✗ FINDINGS PASS THREW: ${e instanceof Error ? e.message : String(e)}\n`)
  }

  // ── 4. RE-READ. Everything below comes out of the database, not out of a variable ──
  const stored = await prisma.ideaUserMaterial.findUnique({
    where: { id: created.id },
    select: {
      status: true, charCount: true, sourceBytes: true, findingCount: true,
      findingsAt: true, failureReason: true, text: true, label: true,
    },
  })
  const evidence = await prisma.evidenceItem.findMany({
    where: { ideaId: idea.id, passKey: { startsWith: USER_MATERIAL_PASS_PREFIX } },
    select: { title: true, body: true, headingKey: true, sourceType: true, citation: true },
  })

  console.log(`── re-read from the database ──`)
  console.log(`  status        ${stored?.status}`)
  console.log(`  label         ${stored?.label}`)
  console.log(`  charCount     ${stored?.charCount?.toLocaleString()} (text actually ${stored?.text.length.toLocaleString()})`)
  console.log(`  sourceBytes   ${stored?.sourceBytes?.toLocaleString()}`)
  console.log(`  findingCount  ${stored?.findingCount ?? '-'}   findingsAt ${stored?.findingsAt?.toISOString() ?? '-'}`)
  console.log(`  failureReason ${stored?.failureReason ?? '-'}`)
  console.log(`  evidence rows ${evidence.length}`)

  // ⚠ THE RECONCILIATION. A pass that reports N and stores M is the failure mode this
  // whole script exists to catch, and it reports SUCCESS while doing it.
  const ok = written === evidence.length && (stored?.findingCount ?? 0) === evidence.length
  console.log(`\n  reported ${written} · findingCount ${stored?.findingCount ?? 0} · stored ${evidence.length}  ${ok ? '✓ reconciles' : '✗ MISMATCH'}`)

  for (const e of evidence.slice(0, 8)) {
    console.log(`\n  · [${e.headingKey ?? 'no heading'}] ${e.title}`)
    console.log(`    ${(e.body ?? '').replace(/\s+/g, ' ').slice(0, 200)}`)
    console.log(`    sourceType=${e.sourceType ?? '-'} citation=${e.citation ?? '-'}`)
  }
  if (evidence.length > 8) console.log(`\n  …and ${evidence.length - 8} more`)

  if (!keep) {
    // ⚠⚠ THE SAME TRANSACTION THE DELETE ROUTE USES — findings first, then the row.
    //
    // The first version of this script called `ideaUserMaterial.delete()` alone, and the
    // reconciliation above then reported "stored 12" against "reported 8": four findings
    // from a previous run, orphaned, still attached to the idea and citing a document that
    // no longer existed. I nearly reported that as a product defect. It was mine — the
    // ROUTE deletes the evidence in a transaction and my harness did not.
    //
    // That is the 25-H lesson exactly: a verification artefact that isn't a faithful copy
    // produces findings about itself. A cleanup path has to be as faithful as the path
    // under test, because its damage lands in the same table.
    await prisma.$transaction([
      prisma.evidenceItem.deleteMany({
        where: { ideaId: idea.id, passKey: `${USER_MATERIAL_PASS_PREFIX}${created.id}` },
      }),
      prisma.ideaUserMaterial.delete({ where: { id: created.id } }),
    ])
    const again = await prisma.ideaUserMaterial.findUnique({ where: { id: created.id }, select: { id: true } })
    const leftover = await prisma.evidenceItem.count({
      where: { ideaId: idea.id, passKey: `${USER_MATERIAL_PASS_PREFIX}${created.id}` },
    })
    console.log(`\ncleaned up: ${again ? '✗ STILL PRESENT' : '✓ material gone'}, ` +
      `${leftover === 0 ? '✓ no orphaned findings' : `✗ ${leftover} ORPHANED FINDINGS`} (pass --keep to leave it attached)`)
  } else {
    console.log(`\n--keep: left attached to ${idea.id.slice(0, 8)}.`)
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
