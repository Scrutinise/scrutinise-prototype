export {}  // module scope — without it main() lands in the global scope shared by every script here
/**
 * v36-check-pdf-probe.ts — the `pdf-only` classification, against the live source.
 *
 * The probe this replaces was `headRequest(/{id}/data.pdf)`. legislation.gov.uk
 * answers HEAD on that path with **405 Method Not Allowed**, so it returns false
 * for every instrument — including the Companies Act 2006, whose PDF is 23 MB and
 * plainly there. It is a probe that cannot say yes *today*. It clearly said yes at
 * some point, because 117,667 instruments carry `pdf-only` and a random sample of
 * 52 of them found 0 with a PDF. So whatever TNA answered in June 2026, the probe
 * was wrong in that direction too. Only the false-negative half is reproducible
 * now, so only that half is asserted here — the positive controls below are what
 * fail against the old probe, and the negative controls are what stop the fix
 * being over-applied.
 *
 * Positive control : ukpga/2006/46      → a real 23 MB PDF (206 Partial Content)
 * Negative control : uksi/2016/1150     → /data.pdf 301s to /made/data.pdf, 404
 *                    eur/1991/2412      → same shape, and it is classified pdf-only today
 *
 * This hits the network deliberately: the bug was a wrong belief about what the
 * source does, and a stubbed fetch would have re-encoded the same wrong belief.
 *
 * Usage: tsx v36-check-pdf-probe.ts
 */
process.env.TNA_THROTTLE_FLOOR_MS = process.env.TNA_THROTTLE_FLOOR_MS ?? '500'

const CASES: { id: string; expect: boolean; why: string }[] = [
  { id: 'ukpga/2006/46', expect: true, why: 'positive control — 23 MB PDF served' },
  { id: 'uksi/1990/2360', expect: true, why: 'positive control — PDF at /made/data.pdf via redirect' },
  { id: 'uksi/2016/1150', expect: false, why: 'negative control — redirect target 404s' },
  { id: 'eur/1991/2412', expect: false, why: 'negative control — currently classified pdf-only' },
  { id: 'ssi/2018/197', expect: false, why: 'negative control — currently classified pdf-only' },
]

async function main() {
  const mod: Record<string, unknown> = await import('./sources/tna-legislation')
  // pdfExists is module-private on purpose; the check exercises it through the
  // classifier's own contract instead of exporting internals for a test's benefit.
  const classify = mod.classifyNoProvisionsItem as (docId: string, xml: string) => Promise<string>

  // A CLML body with no provisions, a post-1980 year and a title that is not a
  // commencement order — so classification lands squarely on the PDF branch, which
  // is the branch under test.
  const XML = '<Legislation><Metadata><SecondaryMetadata><NumberOfProvisions Value="0"/></SecondaryMetadata></Metadata><Title>Test Regulations</Title></Legislation>'

  let pass = 0, fail = 0
  for (const c of CASES) {
    // Year is read from the docId; anything pre-1980 short-circuits to
    // metadata-only before the PDF branch, so those ids are stated as such.
    const cls = await classify(c.id, XML)
    const sawPdf = cls === 'pdf-only'
    const shortCircuited = cls === 'metadata-only' || cls === 'commencement'
    const ok = shortCircuited ? !c.expect : sawPdf === c.expect
    ok ? pass++ : fail++
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.id.padEnd(16)} expect pdf=${String(c.expect).padEnd(5)} classified=${cls.padEnd(14)} ${c.why}`)
  }
  console.log(`\n[check] ${pass}/${pass + fail} passed`)
  if (fail > 0) process.exitCode = 1
}

main().catch(e => { console.error(e); process.exitCode = 1 })
