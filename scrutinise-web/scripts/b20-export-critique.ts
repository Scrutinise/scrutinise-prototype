export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B20 §5 — EXPORT THE CRITIQUE, AS IT WAS ACTUALLY RUN, FOR M-01, M-02 AND M-06.
//
// ⚠⚠ NOTHING IS SPENT BY THIS SCRIPT. The four critique passes have already run against a
// complete kernel on all three measures — M-01 v4, M-02 v2, M-06 v2, all on 9 September
// between 03:37 and 04:17 — so §5 is an export, not a re-run. Whether that is safe to say
// is not taken on trust: `KERNEL_CHECK.usages[].tokensIn` is printed for EVERY version of
// every measure, because a kernel of ten empty columns and a complete one differ by
// thousands of prompt tokens and that difference is visible without reading a word.
//
// ⚠ THE KERNEL PRINTED AT THE FOOT IS RE-DERIVED NOW, NOT THE FROZEN INPUT. `kernelText`
// reads live rows; a field accepted or reopened since the build would change it. It is
// included because it is the only way to see what the marker saw, and it is labelled as a
// re-derivation rather than as the record.
//
//   npx tsx --env-file=.env scripts/_b20-export-critique.ts
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { kernelText } from '../lib/lex/build'
import { KERNEL_TESTS } from '../lib/lex/build-verify'

const BUILDS = join(__dirname, '../../docs/report_run/builds')
const OUT = join(__dirname, '../../docs/report_run/critique')
const CRITIQUE = ['SMART', 'KERNEL_CHECK', 'LOGIC_CHECK', 'ADVERSARIAL'] as const

/** The build each measure's critique is taken from — the newest run on the fixed path. */
const TARGET: Record<string, { ref: string; version: number }> = {
  'M-01': { ref: 'M-01', version: 4 },
  'M-02': { ref: 'M-02', version: 2 },
  'M-06': { ref: 'M-06', version: 2 },
}

interface PassEntry {
  key: string; status: string; output?: string | null; failureReason?: string | null
  carry?: Record<string, string> | null
  usages?: Array<{ model: string; tokensIn: number; tokensOut: number; echoedModel?: string }> | null
  startedAt?: string | null; completedAt?: string | null
}

function fence(s: string) { return s.replace(/\r/g, '').trimEnd() }

async function main() {
  mkdirSync(OUT, { recursive: true })
  const alternatives: string[] = []
  const indexRows: string[] = []

  for (const [measure, { ref, version }] of Object.entries(TARGET)) {
    const ideaId: string = JSON.parse(readFileSync(join(BUILDS, `${ref}.json`), 'utf8')).idea.id
    const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } })

    const all = await prisma.ideaBuild.findMany({
      where: { ideaId },
      select: { id: true, version: true, status: true, startedAt: true, completedAt: true, passes: true, estCostPence: true },
      orderBy: { version: 'asc' },
    })
    const row = all.find((b) => b.version === version)
    if (!row) { console.error(`${measure}: no v${version}`); continue }
    const log = (Array.isArray(row.passes) ? row.passes : []) as unknown as PassEntry[]
    const pass = (k: string) => log.find((p) => p.key === k)

    const L: string[] = []
    L.push(`# ${measure} — ${idea?.title}`)
    L.push('')
    L.push(`*The four critique passes as they ran, on a complete kernel. Exported ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. No model was called to produce this file.*`)
    L.push('')
    L.push(`- idea \`${ideaId}\``)
    L.push(`- build \`${row.id}\` — **v${row.version} ${row.status}**, ${row.startedAt?.toISOString().slice(0, 16).replace('T', ' ')} → ${row.completedAt?.toISOString().slice(0, 16).replace('T', ' ')} UTC`)
    // ⚠ `estCostPence` is a Prisma Decimal, not a number — arithmetic on it typechecks nowhere and
    // string-concatenates everywhere. Converted once, at the read.
    // ⚠ THE COLUMN IS ALREADY PENCE. Dividing by 100 and then writing "p" reported a 34p build as
    // "0.34 p" — the label said pence and the number was pounds. Printed in its own unit.
    L.push(`- cost of the whole build: ${Number(row.estCostPence ?? 0).toFixed(2)}p`)
    L.push('')

    // ══ THE EVIDENCE THAT THE KERNEL WAS COMPLETE ═══════════════════════════════════
    //
    // ⚠ This is the control on the whole export. Every version of the measure is printed,
    // so the reader can see the prompt size step rather than take "complete kernel" on
    // trust. It is a MEASURE, not an assertion.
    L.push('## Was the kernel complete when it was marked?')
    L.push('')
    L.push('`KERNEL_CHECK` prompt size across every build of this measure. The kernel the four passes')
    L.push('read went from ten mostly-empty canonical columns to the drafted wording on 9 September;')
    L.push('a step in `tokensIn` is that change, visible without reading a word of the output.')
    L.push('')
    L.push('| build | when | KERNEL_CHECK tokensIn | score |')
    L.push('|---|---|---|---|')
    for (const b of all) {
      const bl = (Array.isArray(b.passes) ? b.passes : []) as unknown as PassEntry[]
      const kc = bl.find((p) => p.key === 'KERNEL_CHECK')
      const tin = kc?.usages?.[0]?.tokensIn ?? null
      L.push(`| v${b.version} ${b.status} | ${b.startedAt?.toISOString().slice(0, 16).replace('T', ' ')} | ${tin ?? '—'} | ${(kc?.output ?? '—').replace(/ — marked by.*$/, '')} |`)
    }
    L.push('')

    // ══ PASS BY PASS ════════════════════════════════════════════════════════════════
    for (const key of CRITIQUE) {
      const p = pass(key)
      L.push(`## ${key}`)
      L.push('')
      if (!p) { L.push('⚠ **This pass has no entry on the build row at all.**'); L.push(''); continue }
      L.push(`**${p.status}** — ${p.output ?? p.failureReason ?? '(no output recorded)'}`)
      L.push('')
      const u = p.usages ?? []
      if (u.length) {
        L.push(`Model: ${u.map((x) => `\`${x.echoedModel ?? x.model}\``).join(', ')}`
          + ` · ${u.reduce((a, b) => a + (b.tokensIn ?? 0), 0)} in / ${u.reduce((a, b) => a + (b.tokensOut ?? 0), 0)} out`)
        // ⚠ THE ECHOED MODEL, NOT THE REQUESTED ONE. A provider that silently substitutes
        // answers 200 with a different model; the two are printed apart where they differ.
        for (const x of u) {
          if (x.echoedModel && x.echoedModel !== x.model) {
            L.push('')
            L.push(`⚠⚠ **requested \`${x.model}\`, the provider echoed \`${x.echoedModel}\`.**`)
          }
        }
        L.push('')
      } else {
        L.push('⚠ No usage recorded on this pass entry — so no model call is evidenced here.')
        L.push('')
      }
      L.push(`Ran ${p.startedAt?.slice(11, 19) ?? '—'} → ${p.completedAt?.slice(11, 19) ?? '—'}`)
      L.push('')
      const carry = p.carry ?? {}
      for (const [k, v] of Object.entries(carry)) {
        if (typeof v !== 'string' || !v.trim()) continue
        L.push(`<details><summary>carry <code>${k}</code></summary>`)
        L.push('')
        L.push('```')
        L.push(fence(v))
        L.push('```')
        L.push('')
        L.push('</details>')
        L.push('')
      }

      // The rows this pass wrote, which are what a reader actually needs listed out.
      const issues = await prisma.deepeningIssue.findMany({
        where: { ideaId, passKey: key, runVersion: version },
        select: { title: true, text: true, sourceModel: true, status: true },
        orderBy: { createdAt: 'asc' },
      })
      if (issues.length) {
        L.push(`### The ${issues.length} item${issues.length === 1 ? '' : 's'} it put on the list`)
        L.push('')
        issues.forEach((it, i) => {
          L.push(`**${i + 1}. ${it.title ?? '*(no title recorded — not invented downstream)*'}**${it.status !== 'OPEN' ? ` — ${it.status}` : ''}`)
          L.push('')
          L.push(fence(it.text))
          if (it.sourceModel) L.push(`\n*Raised by ${it.sourceModel}.*`)
          L.push('')
        })
      } else {
        L.push(`*No \`DeepeningIssue\` rows for this pass at runVersion ${version}.*`)
        L.push('')
      }
    }

    // ══ THE NINE TESTS, NAMED ═══════════════════════════════════════════════════════
    //
    // ⚠ IMPORTED, NEVER RESTATED. Retyping the nine tests here is how an export drifts
    // from the thing it claims to report.
    L.push('## The nine kernel tests, as the marker has them')
    L.push('')
    for (const t of KERNEL_TESTS) L.push(`- \`${t.id}\` — ${t.test}`)
    L.push('')

    // ══ THE KERNEL, RE-DERIVED ══════════════════════════════════════════════════════
    const kernel = await kernelText(ideaId)
    L.push('## The kernel, re-derived now')
    L.push('')
    L.push('⚠ **Read live, at export time, not frozen at the moment of marking.** If a field has been')
    L.push('accepted or reopened since the build this differs from what the marker saw. It is here')
    L.push(`because it is the closest available reading of the input. ${kernel.length} characters.`)
    L.push('')
    L.push('```')
    L.push(fence(kernel))
    L.push('```')
    L.push('')

    const file = join(OUT, `B20_CRITIQUE_${measure}.md`)
    writeFileSync(file, L.join('\n'), 'utf8')
    console.log(`wrote ${file} (${L.join('\n').length} bytes)`)
    indexRows.push(`| ${measure} | ${idea?.title} | v${version} | ${(pass('KERNEL_CHECK')?.output ?? '—').replace(/ — marked by.*$/, '')} | ${(pass('LOGIC_CHECK')?.output ?? '—').replace(/ — traced by.*$/, '')} |`)

    // ══ THE ALTERNATIVES, SEPARATELY, AS §5 ASKS ════════════════════════════════════
    const forks = await prisma.buildFork.findMany({
      where: { buildId: row.id },
      orderBy: [{ forkKey: 'asc' }, { alternativeIndex: 'asc' }],
      select: {
        forkKey: true, fieldKey: true, chosen: true, alternative: true,
        caseForAlternative: true, recommendationReason: true, resolved: true, alternativeIndex: true,
      },
    })
    alternatives.push(`\n## ${measure} — ${idea?.title}`)
    alternatives.push(`\n*Build v${version} \`${row.id}\`. ${forks.length} alternative${forks.length === 1 ? '' : 's'} across ${new Set(forks.map((f) => f.forkKey)).size} decision points.*`)
    let lastKey = ''
    for (const f of forks) {
      if (f.forkKey !== lastKey) {
        lastKey = f.forkKey
        alternatives.push(`\n### ${f.forkKey}  ·  field \`${f.fieldKey}\`${f.resolved ? '' : '  ·  **unresolved**'}`)
        alternatives.push(`\n**What Lex chose.** ${fence(f.chosen)}`)
        if (f.recommendationReason) alternatives.push(`\n*Why:* ${fence(f.recommendationReason)}`)
        else alternatives.push('\n*No recommendation reason recorded on this row — rendered as absent, not guessed.*')
      }
      alternatives.push(`\n**Alternative ${f.alternativeIndex + 1}.** ${fence(f.alternative)}`)
      alternatives.push(`\n*The case for it:* ${fence(f.caseForAlternative)}`)
    }
  }

  const alt: string[] = [
    '# CCW-B20 §5 — the alternatives, kept apart from the critique',
    '',
    '*The choices each build made and the roads it did not take, for M-01, M-02 and M-06. These are',
    'the decisions that require a human, which is why §5 asks for them as their own file. Exported',
    `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC from \`BuildFork\`; no model was called.*`,
    '',
    '⚠ **`chosen` is what Lex proposed, not what Charlie decided.** `resolved` is false on every row',
    'below unless marked, which means nobody has yet gone through them.',
    ...alternatives,
    '',
  ]
  const altFile = join(OUT, 'B20_ALTERNATIVES.md')
  writeFileSync(altFile, alt.join('\n'), 'utf8')
  console.log(`wrote ${altFile} (${alt.join('\n').length} bytes)`)

  console.log('\n' + ['| measure | title | build | KERNEL_CHECK | LOGIC_CHECK |', '|---|---|---|---|---|', ...indexRows].join('\n'))
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error('ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
