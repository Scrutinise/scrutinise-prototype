// ─────────────────────────────────────────────────────────────────────────────
// attach:idea-law — hand-attach laws to an idea from a simple file (BRIEF_GRAPH_7 §3).
//
//   npx tsx --env-file=.env scripts/attach-idea-law.ts <idea id or prefix> <file>            (dry run: verifies, writes nothing)
//   npx tsx --env-file=.env scripts/attach-idea-law.ts <idea id or prefix> <file> --write    (inserts, all or nothing)
//
// File: one row per line — `relation, doc_uri, provision_path, note` — `#` for comments, provision_path empty for a
// whole Act. Rows are source='hand', source_detail='<by> <date>', as_at = the run date (UTC), action_id null.
// Options: --by <name> (default charlie) · --as-at YYYY-MM-DD (default today, UTC).
//
// ⚠ Every row prints held / named-not-held / no-such-id / lookup-failed with the reason. Any row that is not held
// means NOTHING is written, and the exit code is 1.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import { parseHandFile, attachHandRows } from '../lib/lex/idea-law-attach'
import { RESOLUTION_WORDS } from '../lib/lex/idea-law-pure'

async function main() {
  const args = process.argv.slice(2)
  const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
  const positional = args.filter((a, i) => !a.startsWith('--') && !['--by', '--as-at'].includes(args[i - 1]))
  const [ideaId, file] = positional
  if (!ideaId || !file) {
    console.error('usage: attach-idea-law.ts <idea id or prefix> <file> [--write] [--by <name>] [--as-at YYYY-MM-DD]')
    process.exit(2)
  }
  const write = args.includes('--write')
  const { rows, errors } = parseHandFile(readFileSync(file, 'utf8'))
  if (errors.length) {
    console.error(`The file has ${errors.length} line(s) that are not rows — nothing checked, nothing written:`)
    for (const e of errors) console.error(`  ${e}`)
    process.exit(1)
  }
  if (!rows.length) { console.error('The file holds no rows.'); process.exit(1) }

  const r = await attachHandRows(ideaId, rows, { write, by: flag('--by') ?? 'charlie', asAt: flag('--as-at') })
  console.log(`idea    : ${r.ideaId} — ${r.ideaTitle}`)
  console.log(`as_at   : ${r.asAt}    source_detail: ${r.sourceDetail}    ${write ? 'WRITE' : 'dry run (nothing is written)'}`)
  console.log(`rows    : ${r.rows.length} read from ${file}\n`)
  for (const x of r.rows) {
    const target = `${x.row.docUri}${x.row.provisionPath ? ` · ${x.row.provisionPath}` : ''}`
    console.log(`  line ${String(x.row.line).padStart(2)}  ${x.row.relation.padEnd(10)} ${target.padEnd(32)} ${x.resolution.state.toUpperCase().padEnd(15)} ${x.outcome}`)
    console.log(`           ${x.resolution.title ?? '(no title held)'} — ${x.resolution.reason}`)
    if (x.resolution.provision) console.log(`           provision: ${x.resolution.provision.state} — ${x.resolution.provision.reason}`)
  }
  const by = (s: string) => r.rows.filter((x) => x.resolution.state === s).length
  console.log(`\n  ${Object.keys(RESOLUTION_WORDS).map((s) => `${s} ${by(s)}`).join(' · ')}`)
  if (r.refusedReason) { console.log(`\n⚠ ${r.refusedReason}`); process.exitCode = 1 }
  else if (write) console.log(`\nwrote ${r.wrote}; ${r.rows.filter((x) => x.outcome === 'already-attached').length} already attached`)
  else console.log(`\nall held — run again with --write to insert ${r.rows.filter((x) => x.outcome === 'would-insert').length}`)
}

main().catch((e) => { console.error('FAILED:', e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
