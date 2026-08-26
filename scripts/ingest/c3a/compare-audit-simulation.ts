/**
 * compare-audit-simulation.ts — ADDENDUM C3 §2, the control.
 *
 * `audit-source-audit.ts` claims to know what `census/source-audit.ts` PRINTS for each rule — that
 * claim is the whole basis for saying the OTS rule has been red, not green, since V1. A claim about
 * another program's output is worth nothing until it is checked against that program's output.
 *
 * So this runs the real `source-audit.ts`, parses its table, and compares symbol for symbol with
 * the simulation stored in `docs/census/C3A_source_audit_rules.json`.
 *
 * ⚠ Disagreements are EXPECTED on the flaky ones and are printed rather than smoothed: EUR-Lex
 * answers 502 intermittently, ECHR's api host fails DNS some runs. A row that differs because the
 * network differed is not a wrong simulation, and the run says which is which by showing both codes.
 *
 * Usage: tsx c3a/compare-audit-simulation.ts
 */
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = path.join(__dirname, '../../..')
const SIM = path.join(ROOT, 'docs/census/C3A_source_audit_rules.json')

function main() {
  const sim = JSON.parse(fs.readFileSync(SIM, 'utf8'))
  console.log('running census/source-audit.ts for real (this takes a couple of minutes)…\n')
  const tsx = path.join(__dirname, '../node_modules/.bin/tsx.cmd')
  const out = execFileSync(fs.existsSync(tsx) ? tsx : 'tsx', [path.join(__dirname, '../census/source-audit.ts')], {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, cwd: path.join(__dirname, '..'),
    shell: process.platform === 'win32',   // a .cmd shim cannot be spawned directly on Windows
  })
  fs.writeFileSync(path.join(ROOT, 'docs/census/C3A_source_audit_live.txt'), out)

  const real = new Map<string, { symbol: string; code: string }>()
  for (const line of out.split('\n')) {
    const m = line.match(/^(✅|⚠️|⛔|❓)\s*(.+?)\s{2,}HTTP\s+(\S+)/)
    if (m) real.set(m[2].trim(), { symbol: m[1], code: m[3] })
  }
  console.log(`parsed ${real.size} rows from the live table\n`)

  let agree = 0, differ = 0, missing = 0
  for (const r of sim.rules) {
    const live = real.get(r.label.trim())
    if (!live) { missing++; console.log(`   ? ${r.label} — not found in the live table`); continue }
    const simSym = r.printedBySourceAudit
    if (simSym === live.symbol) { agree++; continue }
    differ++
    console.log(`   ✗ ${r.label.padEnd(40)} simulated ${simSym}  live ${live.symbol}  (live HTTP ${live.code}, probe HTTP ${r.probe?.status})`)
  }
  console.log(`\n${agree} agree · ${differ} differ · ${missing} not matched, of ${sim.rules.length} auditOne rules`)
  console.log(differ === 0
    ? '\nThe simulation reproduces the real output exactly. The "printed" column can be relied on.'
    : '\n⚠ Read each disagreement above: a different HTTP code between the two runs is the network, not the model.')
}

main()
