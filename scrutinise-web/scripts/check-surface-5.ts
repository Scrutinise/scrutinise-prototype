// ─────────────────────────────────────────────────────────────────────────────
// check:surface-5 — the cross-reference graph's surface.
//
// ⚠⚠ WHAT THIS EXISTS TO CATCH, IN ONE SENTENCE: a kind of evidence that arrives at a user
// wearing another kind's name. The reader flattened `enabling` into `markup` in a ternary's
// else-branch and then filed every one of those rows under "not provisions that would break".
// Nothing threw, nothing logged, every count was right, `tsc` was clean, and the strongest
// fact in the table reached no group, no disposition and no document.
//
// ⚠ SO THE ASSERTIONS HERE ARE ABOUT VALUES, NOT SOURCE, wherever the property is about a
// value (CLAUDE.md §25) — and two of them are COLD READS (§26): they take a subject this
// script did not create and did not touch, and call only what the product calls.
//
// Usage:
//   npm run check:surface-5
//   npm run check:surface-5 -- --self-test    (watch every control fire)
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import {
  inboundFor, graphCoverage, describeCoverage, splitInbound, detectionOf,
  DETECTION_KINDS, type Detection, type InboundRow,
} from '../lib/lex/statutory-graph'
import {
  kindsPresent, describeOrdering, groupEnabling, renderEnablingBody, enablingSiftReason,
  consequencesSiftReason,
} from '../lib/lex/consequences-ordering'
import {
  consequencesCaveat, tallyConsequences, CONSEQUENCE_SOURCE_TYPES,
} from '../lib/lex/consequences-caveat'
import { DISPOSITION_WORDS, type ClassifiedGroup } from '../lib/lex/statutory-consequences'
import { isAssembled } from '../lib/lex/evidence-labels'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').split('\r\n').join('\n')

let passed = 0
let failed = 0
const controls: Array<{ name: string; fired: boolean }> = []

interface Case {
  name: string
  run: () => string | null | Promise<string | null>
  /** ⚠ Returns whether the PROPERTY holds under the broken behaviour — never whether a string
   *  still matches. A control that tests the text tests the check, not the code. */
  control?: () => string | null | Promise<string | null>
}

function row(detection: Detection, prov: string | null, gid = 'uksi/2010/1', words = ''): InboundRow {
  return {
    sourceDocUri: `http://www.legislation.gov.uk/${gid}`,
    sourceGid: gid,
    sourceProvisionRef: prov,
    citationText: words || 'in exercise of the powers conferred by section 15 of the Example Act',
    sourceType: 'SI',
    detection,
    targetProvisionRef: prov ? null : 'section-15',
  }
}

const CASES: Case[] = [
  // ═══ §1 / §4 — THE THREE KINDS, KEPT APART ══════════════════════════════════
  {
    name: '§4 the reader knows three kinds and REFUSES a fourth rather than defaulting',
    run: () => {
      for (const k of ['markup', 'text', 'enabling'] as const) {
        if (detectionOf(k) !== k) return `${k} did not map to itself`
      }
      // ⚠ THE WHOLE DEFECT IN ONE LINE. A fourth value must come back as "unknown", not as
      // whichever member the else-branch happened to name.
      return detectionOf('made-under-v2') === null
        ? null
        : 'an unknown detection value was folded into a known kind'
    },
    control: () => {
      // The old mapper, exactly: `r.detection === 'text' ? 'text' : 'markup'`.
      const old = (d: string) => (d === 'text' ? 'text' : 'markup')
      return old('enabling') === 'markup' && old('made-under-v2') === 'markup'
        ? null
        : 'the control did not reproduce the defaulting mapper'
    },
  },
  {
    name: '§1 every kind has a strength and a gloss, and the order is DERIVED from them',
    run: () => {
      const kinds = Object.keys(DETECTION_KINDS) as Detection[]
      if (kinds.length < 3) return `only ${kinds.length} kinds are described`
      for (const k of kinds) {
        if (!DETECTION_KINDS[k].gloss) return `${k} has no statement of what it is NOT`
      }
      // ⚠ ENABLING IS THE STRONGEST, AND IT IS AN ORDER READ OFF THE RECORD. If this ever
      // reverses, the section leads with the weakest evidence in the table.
      const ordered = kindsPresent([row('text', null), row('markup', 'section-1'), row('enabling', null)])
      return ordered[0] === 'enabling'
        ? null
        : `the strongest kind does not sort first: ${ordered.join(' > ')}`
    },
  },
  {
    name: '§1 the ordering statement SAYS WHAT IT CANNOT ORDER BY',
    run: () => {
      const t = describeOrdering(kindsPresent([row('enabling', null), row('text', 'section-1')]))
      if (!/still in force/i.test(t)) return 'it does not say the in-force question is unanswered'
      if (!/have not guessed/i.test(t)) return 'it does not say we declined to guess'
      // ⚠ AND IT MUST NOT CALL A COUNT A RANKING. "Largest group first" is arithmetic; saying
      // so is what stops a reader treating the top group as the most important one.
      return /count, not a ranking/i.test(t) ? null : 'a count is presented as a ranking'
    },
    control: () => {
      // The property: does a statement that omits the limit still warn the reader? It cannot.
      const naive = 'These are ordered strongest first.'
      return /still in force/i.test(naive) ? 'the control text unexpectedly names the limit' : null
    },
  },

  // ═══ §1 — THE SPLIT, AS A VALUE ═════════════════════════════════════════════
  {
    name: '§1 an enabling row is never filed as a title-only mention',
    run: () => {
      const all = [row('enabling', null), row('text', null), row('markup', 'section-3')]
      const s = splitInbound(all)
      if (s.enabling.length !== 1) return 'the enabling row was not kept apart'
      if (s.titleOnly.some((r) => r.detection === 'enabling')) return 'an enabling row is in titleOnly'
      return s.enabling.length + s.rows.length + s.titleOnly.length === all.length
        ? null : 'the split is not exhaustive'
    },
    control: () => {
      const all = [row('enabling', null)]
      const old = { enabling: [] as InboundRow[], titleOnly: all.filter((r) => r.sourceProvisionRef === null) }
      return old.titleOnly.length === 1 && old.enabling.length === 0
        ? null : 'the control did not reproduce the provision-ref-first split'
    },
  },

  // ═══ §2 — THE WORDS TRAVEL INTO THE PRINTED OUTPUT ══════════════════════════
  {
    name: '§2 the enabling block quotes real enacting words and counts INSTRUMENTS',
    run: () => {
      const e = groupEnabling([
        row('enabling', null, 'uksi/2010/2279', 'in exercise of the powers conferred by section 216 of the Equality Act'),
        row('enabling', null, 'uksi/2010/2279', 'in exercise of the powers conferred by section 207 of the Equality Act'),
        row('enabling', null, 'uksi/2011/96', 'made in exercise of the powers conferred by sections 82 and 207 of that Act'),
      ])
      // ⚠ TWO INSTRUMENTS, THREE REFERENCES. A preamble naming two sections is ONE instrument
      // standing on the Act; counting rows would inflate the consequence in the one place
      // over-reporting costs most.
      if (e.instruments !== 2) return `instruments counted as ${e.instruments}, not 2`
      if (e.references !== 3) return `references counted as ${e.references}, not 3`
      const body = renderEnablingBody('ukpga/2010/15', e)
      if (!/in exercise of the powers/.test(body)) return 'the enacting words are not quoted in the body'
      if (!/legislation\.gov\.uk\/uksi\/2010\/2279/.test(body)) return 'the source is not named in the body'
      // ⚠⚠ §4 — NEVER A LEGAL CONCLUSION. "may fall with it" is the distinction; "would be
      // revoked" is an opinion we are not entitled to.
      if (/would (?:be revoked|fall|cease)/i.test(body)) return 'the body asserts a legal conclusion'
      return /may fall with it/.test(body) ? null : 'the consequence of an enabling power is not stated'
    },
  },
  {
    name: '§2 the sift reason carries a QUOTATION and a COUNT — the only field two documents print',
    run: () => {
      const e = groupEnabling([row('enabling', null, 'uksi/2010/2279',
        'in exercise of the powers conferred by section 216 of the Equality Act')])
      const s = enablingSiftReason('ukpga/2010/15', e)
      if (!/in exercise of the powers/.test(s)) return 'no quotation in the enabling sift reason'
      if (!/uksi\/2010\/2279/.test(s)) return 'no source named in the enabling sift reason'

      const g: ClassifiedGroup = {
        kind: 'borrowed-definition',
        label: 'borrows a definition from the target',
        members: [row('markup', 'section-3', 'ukpga/2006/3'), row('markup', 'section-4', 'ukpga/2006/3')],
        exemplar: { sourceGid: 'ukpga/2006/3', provision: 'section-3', words: 'within the meaning of section 3 of the Equality Act' },
        unquotable: 0,
        disposition: 'replace',
        reason: 'x',
        evidence: { sourceGid: 'ukpga/2006/3', provision: 'section-3', words: 'within the meaning of section 3 of the Equality Act' },
      }
      const r = consequencesSiftReason(g)
      if (!/within the meaning of/.test(r)) return 'no quotation in the group sift reason'
      if (!/ukpga\/2006\/3/.test(r)) return 'no source named in the group sift reason'
      return /2 references/.test(r) ? null : 'the group sift reason does not carry the count'
    },
    control: () => {
      // The property: does the sentence the pass used to write carry any evidence at all?
      const old = 'From the citation graph: what refers to ukpga/2010/15.'
      return /within the meaning of|in exercise of|\d+ references/.test(old)
        ? 'the control sentence unexpectedly carries evidence'
        : null
    },
  },
  {
    name: '§2 a disposition never reaches a title as a raw enum member',
    run: () => {
      for (const [k, words] of Object.entries(DISPOSITION_WORDS)) {
        if (!words || /_/.test(words)) return `${k} renders as ${JSON.stringify(words)}`
      }
      // ⚠ THE TITLE AS THE PRODUCER BUILDS IT — the one field the meeting pack prints.
      const title = `92 references that mention the target — ${DISPOSITION_WORDS.no_action}`
      return /no_action/.test(title) ? 'the raw enum reached the title' : null
    },
    control: () => {
      const title = `92 references that mention the target — ${'no_action'}`
      return /no_action/.test(title) ? null : 'the control did not reproduce the raw enum title'
    },
  },

  {
    // ⚠⚠ FOUND BY READING THE FIRST WORKED EXAMPLE, NOT BY A CHECK. `nisr/2010/381` is recorded
    // as made under the Constitutional Reform Act 2005 and its entire enacting text names only
    // the Judicature (Northern Ireland) Act 1978 — which is not among its recorded targets at
    // all. The block would have asserted "in their own enacting words" over it.
    name: '§2 an enabling quotation that does not name the target is labelled, counted and still shown',
    run: () => {
      const e = groupEnabling([
        row('enabling', null, 'uksi/2014/1919',
          'Lord Chief Justice, in exercise of powers conferred under sections 115 and 116 of the Constitutional Reform Act 2005'),
        row('enabling', null, 'nisr/2010/381',
          'Rules Committee makes the following Rules in exercise of the powers conferred by sections 55 and 55A of the Judicature (Northern Ireland) Act 1978'),
      ], 'Constitutional Reform Act 2005')
      if (e.quotationMismatch !== 1) return `mismatches counted as ${e.quotationMismatch}, not 1`
      const good = e.groups.find((g) => g.sourceGid === 'uksi/2014/1919')
      if (good?.quotedWordsNameTheTarget !== true) return 'a quotation that DOES name the target was flagged'
      const body = renderEnablingBody('ukpga/2005/4', e)
      // ⚠ STILL SHOWN. A row we cannot vouch for is labelled, never dropped — dropping it would
      // under-report the reach, which is the error in the direction a committee notices.
      if (!/nisr\/2010\/381/.test(body)) return 'the flagged instrument was dropped rather than labelled'
      // ⚠ THE WORDING IS "DO NOT NAME THE TARGET", NOT "NAME A DIFFERENT ACT". Two causes look
      // identical from here — a preamble clipped at 300 characters, and a target resolved from a
      // footnote — and the second is the only one that would be a defect. Asserting the stronger
      // claim would put it in front of a user on evidence that does not carry it.
      if (!/do not name the target/.test(body)) return 'the mismatch is not labelled on the row'
      if (/names? a different Act/.test(body)) return 'the block asserts a misattribution it has not established'

      // ⚠ AND THE PUNCTUATION TRAP, WHICH THE FIRST VERSION OF THIS TEST FELL INTO. A preamble
      // carries a curly apostrophe and `corpus_acts` a straight one; matching raw would put a
      // warning beside correct rows, and a warning that fires on correct rows gets ignored.
      const curly = groupEnabling([row('enabling', null, 'nisr/2008/35',
        'the powers conferred by Article 13 of the Magistrates’ Courts (Northern Ireland) Order 1981')],
      "The Magistrates' Courts (Northern Ireland) Order 1981")
      if (curly.quotationMismatch !== 0) return 'a curly apostrophe was reported as a failed quotation'

      // ⚠ AND THE 300-CHARACTER CLIP, which is the commonest cause by far: a preamble cut off
      // before its Act's year must not be reported as naming something else.
      const clipped = groupEnabling([row('enabling', null, 'uksi/2005/2284',
        'Lord Chancellor, in exercise of the powers conferred upon him by section 148(1) of the Constitutional Reform Act')],
      'Constitutional Reform Act 2005')
      if (clipped.quotationMismatch !== 0) return 'a preamble clipped before its year was reported as a failed quotation'

      // ⚠ AND AN UNANSWERABLE QUESTION IS NOT A PASS.
      const noTitle = groupEnabling([row('enabling', null, 'uksi/2014/1919', 'some words')], null)
      if (!noTitle.cannotCheckQuotations) return 'a missing target title was treated as a clean check'
      return /could not check whether these quotations name it/.test(
        renderEnablingBody('ukpga/2005/4', noTitle))
        ? null : 'an unchecked quotation set does not say it was unchecked'
    },
    control: () => {
      // The property: does a raw containment test agree with a preamble that names another Act?
      const raw = 'in exercise of the powers conferred by sections 55 and 55A of the Judicature (Northern Ireland) Act 1978'
      return raw.toLowerCase().includes('constitutional reform act 2005')
        ? 'the control text unexpectedly names the target'
        : null
    },
  },

  // ═══ §3 — THE COVERAGE STATEMENT AND THE CAVEAT ═════════════════════════════
  {
    name: '§3 the caveat never draws a legal conclusion, and never presents a total',
    run: () => {
      const t = consequencesCaveat(tallyConsequences([
        { sourceType: CONSEQUENCE_SOURCE_TYPES.enabling },
        { sourceType: CONSEQUENCE_SOURCE_TYPES.reference },
        { sourceType: CONSEQUENCE_SOURCE_TYPES.coverage },
      ]))
      // ⚠⚠ §4's first rule. "still good law" may appear only inside the sentence REFUSING it.
      if (/\bis (?:still|no longer) good law\b/i.test(t)) return 'it states a legal conclusion'
      if (!/legal conclusions/i.test(t)) return 'it does not refuse the legal conclusion'
      if (!/never a total/i.test(t)) return 'it does not refuse the total'
      return /kept apart here rather than added together/i.test(t)
        ? null : 'it does not say the kinds are not summed'
    },
  },
  {
    name: '§3 a MISSING coverage statement is reported as missing, not tidied away',
    run: () => {
      const without = consequencesCaveat(tallyConsequences([
        { sourceType: CONSEQUENCE_SOURCE_TYPES.reference },
      ]))
      if (!/MISSING/.test(without)) return 'a section with no coverage row does not say so'
      const with_ = consequencesCaveat(tallyConsequences([
        { sourceType: CONSEQUENCE_SOURCE_TYPES.reference },
        { sourceType: CONSEQUENCE_SOURCE_TYPES.coverage },
      ]))
      // ⚠ AND IT MUST STOP SAYING IT when the row is there — a caveat that always fires is a
      // caveat a reader learns to skip.
      return /MISSING/.test(with_) ? 'it still claims the statement is missing when it is present' : null
    },
  },
  {
    name: '§3 an empty section says what its emptiness does and does not mean',
    run: () => {
      const t = consequencesCaveat(tallyConsequences([]))
      return /not about whether anything in the statute book refers to/i.test(t)
        ? null : 'an empty section reads as "nothing refers to this"'
    },
  },
  {
    name: '§3 the caveat is imported by the panel AND all three documents',
    // ⚠ A SOURCE ASSERTION, AND LEGITIMATELY SO: the property is "this module is imported by
    // these four files", which is about source. §23.1 — and the panel is checked for an
    // IMPORTER too, because a component nothing imports cannot be what a user sees.
    run: () => {
      const surfaces = [
        'components/lex/QuestionPanel.tsx',
        'lib/documents/build-proposal.ts',
        'lib/documents/build-evidence-pack.ts',
        'lib/documents/build-meeting-pack.ts',
      ]
      for (const f of surfaces) {
        const s = read(f)
        if (!/consequences-caveat/.test(s)) return `${f} does not import the caveat`
        if (!/consequencesCaveat\(tallyConsequences\(/.test(s)) return `${f} imports it and does not call it`
        if (!/REFERS_TO_THIS/.test(s)) return `${f} calls it under no heading`
      }
      return null
    },
  },
  {
    name: '§3 the citation graph\'s rows are badged as ASSEMBLED, not as a model\'s reading',
    run: () => {
      for (const t of Object.values(CONSEQUENCE_SOURCE_TYPES)) {
        if (!isAssembled(t)) return `${t} is not treated as an assembled record`
      }
      return isAssembled('DEBATE') ? 'an ordinary source type is being called assembled' : null
    },
  },

  // ═══ LIVE — the graph itself ════════════════════════════════════════════════
  {
    name: 'LIVE §3 the coverage statement carries the four facts that were computed and never said',
    run: async () => {
      const c = await graphCoverage()
      const t = describeCoverage(c)
      if (!/sit in a title, long title, preamble/.test(t)) return 'the not-in-a-provision share is not stated'
      if (!/hold no text for/.test(t)) return 'the unheld-target share is not stated'
      if (!/refusal, not an absence/.test(t)) return 'a refusal is not distinguished from an absence'
      // ⚠⚠ "HELD ELSEWHERE" IS NOT "NOT BUILT", AND IT HAS TO BE SAID IN WORDS, NOT ONLY HELD
      // IN A STATUS FIELD. The prose lumped both under "does not yet cover", which tells a
      // reader the amendment data does not exist when it exists and this query does not reach
      // it — a caveat that lies in the reassuring direction about the layer this feature can
      // least afford to lose.
      if (c.layers.some((l) => l.status === 'held-elsewhere') && !/not joined into any number here/.test(t)) {
        return 'a held-elsewhere layer reads as one we do not hold'
      }
      if (c.layers.some((l) => l.status === 'not-built') && !/do not hold/.test(t)) {
        return 'a not-built layer is not named as one we do not hold at all'
      }
      // ⚠ A PERCENTAGE WITHOUT ITS SIGN IS A COUNT — "36.1: of the parser's references were
      // wrong" reads as thirty-six references.
      for (const f of c.recorded) {
        if (f.key.endsWith('_pct') && f.n !== null && !t.includes(`${f.n}%`)) {
          return `a recorded percentage (${f.key}) is printed without its sign`
        }
      }
      if (!c.recorded.length) return 'no recorded fact reached the statement — the facts table was not read'
      if (!/measured \d/.test(t)) return 'a recorded fact is quoted without its age'
      return /not as a total/.test(t) ? null : 'a count is presented as complete'
    },
  },
  {
    name: 'LIVE §3 amendment-effects is HELD-ELSEWHERE on the effects table, not on an unrelated one',
    run: async () => {
      const c = await graphCoverage()
      const layer = c.layers.find((l) => l.id === 'amendment-effects')
      if (!layer) return 'the amendment-effects layer is not declared'
      if (layer.status !== 'held-elsewhere') {
        return `the effects layer reports ${layer.status} — either the effects table is empty or the wrong table is being counted`
      }
      // ⚠⚠ THE STATUS WAS RIGHT FOR THE WRONG REASON. It was decided by a row count over
      // `graph_edge`, which is the POSITION graph's table and holds no statutory effect at all.
      // This asserts the count that decides it moves with the EFFECTS table specifically.
      const [{ n }] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT COUNT(*)::bigint AS n FROM legislation_edges
          WHERE edge_type IN ('amends','repeals','commences','modifies')`)
      if (Number(n) === 0) return 'the effects table holds no effects, yet the layer says held-elsewhere'
      const src = read('lib/lex/statutory-graph.ts')
      return /heldIn: \{ table: EFFECTS_TABLE, where: EFFECTS_TYPES \}/.test(src)
        ? null : 'the layer no longer names the effects table and its predicate'
    },
    control: async () => {
      // The property: would a bare count over the position graph's table distinguish the two?
      const [{ n }] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT COUNT(*)::bigint AS n FROM graph_edge`)
      return Number(n) > 0
        ? null
        : 'the control could not run — graph_edge is empty, so the old evidence cannot be shown to be unrelated'
    },
  },
  {
    // ══ ⚠⚠ THE COLD READ (CLAUDE.md §26) ═══════════════════════════════════════════════
    //
    // A subject this script did not create and did not touch: an Act that real instruments
    // were really made under. It reads the table with the plainest tool available and then
    // calls ONLY what the product calls — `inboundFor` — and compares. Nothing here arranges
    // the state it then asserts.
    name: 'COLD READ — the reader agrees with the table, kind for kind, on a target it did not choose',
    run: async () => {
      // ⚠ NOT `ORDER BY target_act_id`. Ids begin with the citation, so id order is a sample
      // of one year and not a sample of the corpus — a 400-row pilot once said 76.1% where the
      // corpus said 26.9% for exactly that reason. The busiest enabling target is chosen by
      // the DATA, which is a property of the graph rather than of this script.
      const picked = await prisma.$queryRawUnsafe<Array<{ target_act_id: string }>>(
        `SELECT target_act_id FROM citation_edge WHERE detection = 'enabling'
          GROUP BY 1 ORDER BY COUNT(*) DESC, target_act_id LIMIT 1`)
      if (!picked.length) return 'NOT CHECKED — the graph holds no enabling rows at all'
      const target = picked[0].target_act_id

      const table = await prisma.$queryRawUnsafe<Array<{ detection: string; n: bigint; prov: bigint }>>(
        `SELECT detection, COUNT(*)::bigint AS n,
                COUNT(*) FILTER (WHERE source_provision_ref IS NOT NULL)::bigint AS prov
           FROM citation_edge WHERE target_act_id = $1 GROUP BY 1`, target)
      const truth = new Map(table.map((r) => [r.detection, Number(r.n)]))

      const got = await inboundFor(target)
      const seen = {
        enabling: got.enabling.length,
        markup: [...got.rows, ...got.titleOnly].filter((r) => r.detection === 'markup').length,
        text: [...got.rows, ...got.titleOnly].filter((r) => r.detection === 'text').length,
      }
      for (const k of ['enabling', 'markup', 'text'] as const) {
        if ((truth.get(k) ?? 0) !== seen[k]) {
          return `${target}: the table holds ${truth.get(k) ?? 0} ${k} rows and the reader reports ${seen[k]}`
        }
      }
      // ⚠ AND THE ONE THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT: not one enabling row may be
      // sitting in the list a renderer describes as "not provisions that would break".
      if (got.titleOnly.some((r) => r.detection === 'enabling')) {
        return `${target}: an enabling row is in the title-only list`
      }
      const total = Number(table.reduce((s, r) => s + Number(r.n), 0))
      const partitioned = got.enabling.length + got.rows.length + got.titleOnly.length + got.unrecognised.length
      return total === partitioned
        ? null
        : `${target}: the table holds ${total} rows and the partition accounts for ${partitioned}`
    },
  },
]

async function main() {
  const selfTest = process.argv.includes('--self-test')
  console.log('── check:surface-5 ──')
  for (const c of CASES) {
    const r = await c.run()
    if (r) { failed++; console.log(`  ✗  ${c.name}\n       ${r}`) } else { passed++; console.log(`  ✓  ${c.name}`) }
    if (c.control) {
      const cr = await c.control()
      controls.push({ name: c.name, fired: cr === null })
      if (cr !== null) console.log(`       ⚠ control did not fire: ${cr}`)
    }
  }
  const dead = controls.filter((c) => !c.fired)
  console.log(`\n${passed} passed, ${failed} failed. `
    + `${controls.length} controls, ${dead.length} dead.`)
  // ⚠ §23.2 — the closing line names how many checks RAN, not only how many passed.
  console.log(`${CASES.length} assertions executed of ${CASES.length} declared.`)
  if (selfTest && dead.length) console.log('⚠ a dead control is a finding, not a formatting choice.')
  await prisma.$disconnect()
  process.exit(failed > 0 || dead.length > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
