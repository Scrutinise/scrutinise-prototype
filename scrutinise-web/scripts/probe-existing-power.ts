// ─────────────────────────────────────────────────────────────────────────────
// 25-C §3a — IS IT THE RETRIEVAL OR THE ASSESSMENT?
//
// `EXISTING_POWER` has returned `powerFound: false` on four consecutive live runs, and the
// standing assumption has been that the corpus does not surface enabling provisions. The 25-B
// transcripts say otherwise: the research pass DID find them, and the revision pass acted on them
// in prose —
//
//   "The Renters' Rights Act 2025 already enables the Decent Homes Standard to be applied to the
//    private rented sector, removing the need for new primary legislation for this proposal."
//   "Section 123 of the Housing and Planning Act 2016 may allow for regulations to achieve the
//    desired outcome without new primary legislation."
//
// — while `assessInstrumentRetirement`, reading those same findings, still said no.
//
// So before choosing a test idea and running a fifth build, this feeds the assessment the findings
// it already had and asks whether the GATE opens. Isolating it costs one small model call instead
// of a 200-second build, and it distinguishes two very different defects:
//
//   gate opens  → retrieval is fine, the four false negatives were about those ideas
//   gate shut   → the assessment is the blocker, and no test idea would ever have proven the fork
//
// Usage: npx tsx --env-file=.env scripts/probe-existing-power.ts
// ─────────────────────────────────────────────────────────────────────────────

import { assessInstrumentRetirement } from '../lib/lex/build-client'
import { llmOk } from '../lib/lex/build-llm'

/** Verbatim from the 25-B live runs (docs/BUILD_25B_REPORT.md §5/§6). */
const CASES: Array<{ label: string; instrument: string; findings: Array<{ kind: string; title: string; body: string }> }> = [
  {
    label: 'Renters’ Rights Act 2025 — named in a contradiction the revision itself acted on',
    instrument: 'primary legislation · national · reserved',
    findings: [
      {
        kind: 'CONTRADICTS',
        title: 'An existing power may already reach this',
        body: 'The Renters\' Rights Act 2025 already enables the Decent Homes Standard to be applied '
          + 'to the private rented sector, removing the need for new primary legislation for this '
          + 'proposal.',
      },
    ],
  },
  {
    label: 'Housing and Planning Act 2016 s.123 — named by the adversarial reader',
    instrument: 'primary legislation · national · reserved',
    findings: [
      {
        kind: 'FINDING',
        title: 'Section 123 of the Housing and Planning Act 2016',
        body: 'Section 123 of the Housing and Planning Act 2016 may allow for regulations to achieve '
          + 'the desired outcome without new primary legislation. The proposer needs to clarify why '
          + 'primary legislation is still necessary given this existing power.',
      },
    ],
  },
  {
    label: 'Electrical safety regulations — the narrow power the first run found',
    instrument: 'primary legislation · national · reserved',
    findings: [
      {
        kind: 'FINDING',
        title: 'Electrical safety standards for properties let by private landlords',
        body: 'Regulations under section (Electrical safety standards for properties let by private '
          + 'landlords) may provide for covenants to be implied into a tenancy.',
      },
    ],
  },
  {
    // ⚠ THE NEGATIVE CONTROL. Without it, a gate that says "yes" to everything looks like a fix.
    label: 'CONTROL — a finding that names no power at all',
    instrument: 'primary legislation · national · reserved',
    findings: [
      {
        kind: 'FINDING',
        title: 'Damp and mould are widespread in the private rented sector',
        body: 'A 2023 survey found that 4% of privately rented homes had a Category 1 damp hazard. '
          + 'No enabling provision is mentioned.',
      },
    ],
  },
]

async function main() {
  console.log('── probe:existing-power — does the assessment gate open on findings that name a power? ──\n')
  let opened = 0
  for (const c of CASES) {
    const r = await assessInstrumentRetirement({
      question: 'Is there already a delegated power that removes the need for primary legislation?',
      findings: c.findings,
      instrument: c.instrument,
    })
    if (!llmOk(r)) {
      console.log(`  ✗ ${c.label}\n      the call FAILED: ${r.reason} — ${r.detail.slice(0, 120)}`)
      continue
    }
    const v = r.value
    const isControl = c.label.startsWith('CONTROL')
    const want = !isControl
    const ok = v.powerFound === want
    if (v.powerFound) opened++
    console.log(`  ${ok ? '✓' : '✗'} ${c.label}`)
    console.log(`      powerFound=${String(v.powerFound)} reach=${v.reach} provision="${v.provision}"`)
    console.log(`      ${v.reachNote}`)
  }
  console.log(`\n${opened} of ${CASES.length - 1} real powers were recognised (the 4th is a control and must be false).`)
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
