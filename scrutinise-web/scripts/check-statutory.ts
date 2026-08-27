// ─────────────────────────────────────────────────────────────────────────────
// check:statutory — the Statutory Consequences guards.
//
// ⚠ THE ONE THIS FILE EXISTS FOR is §8's *"a check fails if any coverage wording is a
// literal in the code"*. Every other assertion here protects a property; that one protects
// the project from a specific recurring failure — a hardcoded caveat that outlives its own
// truth. The "17.5 GB Neon alert line" was retired twice and came back a third time.
//
// Offline: no database, no API key, no network.
//
// Usage:
//   npm run check:statutory
//   npm run check:statutory -- --self-test
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PASSES, PASS_KEYS, isPassKey } from '../lib/lex/deepening-config'
import { jobQuestion } from '../lib/lex/deepening-jobs'
import {
  cleanCitationText, groupReferences, describeScale, DISPOSITIONS,
} from '../lib/lex/statutory-consequences'
import { describeCoverage, coverageStateKey, type Coverage } from '../lib/lex/statutory-graph'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').split('\r\n').join('\n')

/** Strip comments — a guard that cannot tell code from prose guards the topic (25-I §7f). */
function codeOnly(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n')
}

type Sources = Record<string, string>
interface Check {
  name: string
  run: (src: Sources) => string | null
  break?: (src: Sources) => Sources
  control?: () => string | null
}

const FILES = [
  'lib/lex/statutory-graph.ts',
  'lib/lex/statutory-consequences.ts',
  'lib/lex/deepening-config.ts',
  'lib/lex/deepening-jobs.ts',
]
function loadSources(): Sources {
  const out: Sources = {}
  for (const f of FILES) out[f] = read(f)
  return out
}

// A coverage block with figures that are obviously not from any hardcoded string.
const FAKE: Coverage = {
  generatedAt: '2026-01-01T00:00:00.000Z',
  layers: [
    { id: 'markup-citations', what: 'markup references', status: 'searched', rows: 7, consequence: 'x' },
    { id: 'case-law-citations', what: 'a judgment citing a provision', status: 'not-built', rows: 0, consequence: 'a court may have read it down' },
  ],
  detection: [{ detection: 'markup', rows: 7 }],
  notInAProvision: { rows: 1, total: 7, pct: 14.3 },
  unresolvedTargets: { rows: 2, total: 7, pct: 28.6 },
  sourceTypes: [{ sourceType: 'primary', rows: 7 }],
  caseLaw: null,
}

const CHECKS: Check[] = [
  // ═══ §5 — THE COVERAGE STATEMENT ═════════════════════════════════════════
  {
    // ⚠⚠ §8's explicit requirement.
    name: '§5 no coverage wording in the code contains a FIGURE',
    run: (src) => {
      const s = codeOnly(src['lib/lex/statutory-graph.ts'])
      // Every string literal in the file, minus SQL and identifiers.
      // ⚠ THIS CHECK FAILED ON ITS FIRST RUN AGAINST CORRECT CODE, and the defect was here.
      // It matched a TEMPLATE LITERAL that contained code — `${present.slice(0, -1)…}` — and
      // reported the `0` and `1` in an array index as a hardcoded corpus figure. A guard for
      // *prose* has to exclude interpolation, or every template in the file is a false
      // positive and the guard gets deleted by whoever hits it next.
      // ⚠ SINGLE-LINE LITERALS ONLY. Allowing a match to span newlines let an unterminated
      // backtick pair with a distant one and swallow half the file, which then "found" the
      // array index inside it. Prose caveats are single-line quoted strings; anything that
      // spans lines in this file is SQL or code.
      const strings = [...s.matchAll(/'([^'\\\n]{12,})'|"([^"\\\n]{12,})"/g)]
        .map((m) => m[1] ?? m[2])
        .filter((t) => !/SELECT|FROM|WHERE|COUNT|GROUP BY|::|ORDER BY|\$\d|\$\{|=>|\.\w+\(/.test(t))
      const withDigits = strings.filter((t) => /\d/.test(t) && /[a-z]{4,}\s+[a-z]{4,}/i.test(t))
      return withDigits.length
        ? `a prose string carries a figure — it will outlive its own truth: ${JSON.stringify(withDigits[0])}`
        : null
    },
    break: (src) => ({
      ...src,
      'lib/lex/statutory-graph.ts': src['lib/lex/statutory-graph.ts'].replace(
        "const EDGE_TABLE = 'graph_edge'",
        "const EDGE_TABLE = 'graph_edge'\nconst STALE = 'this graph covers about 5 percent of real cross references'",
      ),
    }),
  },
  {
    name: '§5 the statement is COMPOSED from the block, and names missing layers from status',
    run: () => {
      const text = describeCoverage(FAKE)
      if (!text.includes('a judgment citing a provision')) return 'a not-built layer is not named'
      // ⚠ CASE-INSENSITIVE ON THE FIRST LETTER. `describeCoverage` capitalises each
      // consequence into its own sentence, so an exact lower-case match failed against
      // correct output — the check was wrong, not the prose.
      if (!/court may have read it down/i.test(text)) return 'the consequence of the gap is not stated'
      // ⚠ AND IT MUST NOT NAME A SEARCHED LAYER AS MISSING — the day a layer lands, this
      // paragraph must stop claiming it is absent without anyone editing anything.
      const after: Coverage = {
        ...FAKE,
        layers: FAKE.layers.map((l) => ({ ...l, status: 'searched' as const, rows: 5 })),
      }
      const t2 = describeCoverage(after)
      return /does not yet cover/.test(t2) ? 'it still claims a gap after every layer is searched' : null
    },
  },
  {
    name: '§5 no count is presented as complete',
    run: () => (/not as a total/.test(describeCoverage(FAKE))
      ? null
      : 'the statement does not say the number is a floor'),
  },
  {
    name: '§6 the cache key moves when coverage moves, and is not a version constant',
    run: () => {
      const before = coverageStateKey(FAKE)
      const after = coverageStateKey({
        ...FAKE,
        layers: FAKE.layers.map((l) => (l.id === 'case-law-citations' ? { ...l, rows: 900 } : l)),
      })
      if (before === after) return 'widening a layer does not change the key — a re-run would serve the narrow answer'
      return /markup-citations:7/.test(before) ? null : 'the key is not built from the live counts'
    },
  },

  // ═══ §2 — THE READER ═════════════════════════════════════════════════════
  {
    name: '§2 the act lookup is INDEXABLE — no lower() on the indexed column',
    run: (src) => {
      const s = codeOnly(src['lib/lex/statutory-graph.ts'])
      // ⚠ MEASURED: lower(target_act_id) forces a seq scan over 1,034,548 rows — 474ms
      // against 3.7ms on the index.
      if (/lower\(target_act_id\)/.test(s)) return 'lower() on target_act_id defeats citation_edge_target_act'
      return /target_act_id = ANY\(\$1::text\[\]\)/.test(s) ? null : 'the act predicate is not an indexable equality'
    },
    break: (src) => ({
      ...src,
      'lib/lex/statutory-graph.ts': src['lib/lex/statutory-graph.ts']
        .replace('target_act_id = ANY($1::text[])', 'lower(target_act_id) = $1'),
    }),
  },
  {
    name: '§2 …and it still matches the regnal-year Acts, which are not lower-case',
    run: (src) => {
      const s = codeOnly(src['lib/lex/statutory-graph.ts'])
      // Both candidate spellings must be offered, or `ukpga/Eliz2/9-10/33` returns nothing.
      return /return raw === lower \? \[raw\] : \[raw, lower\]/.test(s)
        ? null
        : 'only one spelling is tried — a Victorian or Elizabethan Act would silently return no consequences'
    },
    break: (src) => ({
      ...src,
      'lib/lex/statutory-graph.ts': src['lib/lex/statutory-graph.ts']
        .replace('return raw === lower ? [raw] : [raw, lower]', 'return [lower]'),
    }),
  },
  {
    name: '§7 title-only references are SEPARATED, not filtered and not mixed in',
    run: (src) => {
      const s = codeOnly(src['lib/lex/statutory-graph.ts'])
      if (!/titleOnly: all\.filter\(\(r\) => r\.sourceProvisionRef === null\)/.test(s)) {
        return 'title-only rows are not returned separately'
      }
      return /rows: all\.filter\(\(r\) => r\.sourceProvisionRef !== null\)/.test(s)
        ? null
        : 'the provision list is not filtered, so title-only rows are mixed into the work count'
    },
    break: (src) => ({
      ...src,
      'lib/lex/statutory-graph.ts': src['lib/lex/statutory-graph.ts']
        .replace('titleOnly: all.filter((r) => r.sourceProvisionRef === null)', 'titleOnly: []'),
    }),
  },

  // ═══ §3/§4 — GROUPING AND CLASSIFICATION ═════════════════════════════════
  {
    name: '§3 leaked XML never reaches a quotation',
    run: () => {
      const xml = 'IdURI="http://www.legislation.gov.uk/id/uksi/2010/1277/body" NumberOfProvisions="3"> '
      const words = 'This Order may be cited as the Constitutional Reform and Governance Act 2010 Commencement Order.'
      const cleaned = cleanCitationText(xml + words)
      if (!cleaned) return 'a row with real words after the markup was discarded entirely'
      if (/="|IdURI|https?:\/\//.test(cleaned)) return `markup survived into the quotation: ${cleaned.slice(0, 60)}`
      if (!cleaned.startsWith('This Order may be cited')) return `the words were mangled: ${cleaned.slice(0, 60)}`
      // ⚠ AND A ROW THAT IS *ONLY* MARKUP MUST YIELD NOTHING rather than a stub.
      return cleanCitationText('IdURI="http://x/y" NumberOfProvisions="3">') === null
        ? null
        : 'a markup-only row produced a quotable string'
    },
  },
  {
    name: '§4 the tail is counted — title-only and unquotable both named',
    run: () => {
      const rows = [
        { sourceDocUri: 'a', sourceGid: 'a', sourceProvisionRef: 's1', citationText: 'IdURI="x">', sourceType: 'primary' as const, detection: 'markup' as const, targetProvisionRef: null },
        { sourceDocUri: 'b', sourceGid: 'b', sourceProvisionRef: 's2', citationText: 'within the meaning of section 3 of the Equality Act 2010 as it applies here', sourceType: 'SI' as const, detection: 'text' as const, targetProvisionRef: null },
      ]
      const g = groupReferences(rows, 41)
      const s = describeScale(g)
      if (!/41 further/.test(s)) return 'the title-only tail is not counted'
      if (!/1 of the 2 have no quotable words/.test(s)) return `the unquotable tail is not counted: ${s}`
      if (g.totalReferences !== 2) return 'the reference total is wrong'
      return null
    },
  },
  {
    name: '§4 grouping is by what the reference DOES, not which Act it sits in',
    run: () => {
      const mk = (gid: string, text: string) => ({
        sourceDocUri: gid, sourceGid: gid, sourceProvisionRef: 's1', citationText: text,
        sourceType: 'primary' as const, detection: 'text' as const, targetProvisionRef: null,
      })
      // Two different Acts doing the SAME thing must land in ONE group…
      const same = groupReferences([
        mk('act/a', 'the term has the same meaning as in section 3 of the target Act 2010'),
        mk('act/b', 'construed in accordance with section 3 of the target Act 2010 for this purpose'),
      ], 0)
      if (same.totalGroups !== 1) return `same function, different Acts, split into ${same.totalGroups} groups`
      // …and one Act doing two things must land in TWO.
      const split = groupReferences([
        mk('act/a', 'the term has the same meaning as in section 3 of the target Act 2010'),
        mk('act/a', 'this Order brings into force section 3 of the target Act 2010 on 1 April'),
      ], 0)
      return split.totalGroups === 2 ? null : `one Act doing two things collapsed into ${split.totalGroups} group(s)`
    },
  },
  {
    name: '§3 all five dispositions exist and each has its meaning',
    run: () => {
      const want = ['repeal', 'amend', 'save', 'replace', 'no_action']
      const missing = want.filter((d) => !(d in DISPOSITIONS))
      if (missing.length) return `missing: ${missing.join(', ')}`
      const empty = Object.entries(DISPOSITIONS).filter(([, v]) => !v.trim())
      return empty.length ? `no meaning for ${empty[0][0]}` : null
    },
  },
  {
    name: '§3 a disposition is never invented when the model fails or omits one',
    run: (src) => {
      const s = codeOnly(src['lib/lex/statutory-consequences.ts'])
      // ⚠ THE ENUM IS ENFORCED IN CODE, not trusted from the schema — a JSON schema is a
      // REQUEST, and "amend/replace" would otherwise flow into a disposition nothing renders.
      if (!/if \(!kind \|\| !\(d in DISPOSITIONS\)\) continue/.test(s)) {
        return 'an unrecognised disposition string is accepted'
      }
      return /Not classified — the reading pass did not return a disposition/.test(
        src['lib/lex/statutory-consequences.ts'],
      ) ? null : 'an unclassified group borrows a neighbouring reason instead of saying so'
    },
    break: (src) => ({
      ...src,
      'lib/lex/statutory-consequences.ts': src['lib/lex/statutory-consequences.ts']
        .replace('if (!kind || !(d in DISPOSITIONS)) continue', 'if (!kind) continue'),
    }),
  },
  {
    name: '§4 classification runs over GROUPS, never over references',
    run: (src) => {
      const s = codeOnly(src['lib/lex/statutory-consequences.ts'])
      // The prompt is built from groups; a members loop feeding the model would be the
      // ruinous per-reference call the whole design exists to avoid.
      if (/g\.groups\.map\(\(grp\)/.test(s) === false) return 'the prompt is not built from the groups'
      return /grp\.members\.map\([\s\S]{0,120}callJson/.test(s)
        ? 'the model is called per member'
        : null
    },
  },

  // ═══ §1 — THE PASS ═══════════════════════════════════════════════════════
  {
    name: '§1 STATUTORY_CONSEQUENCES is its own pass, not folded into LEGAL',
    run: () => {
      if (!isPassKey('STATUTORY_CONSEQUENCES')) return 'the pass key is not registered'
      const p = PASSES.find((x) => x.key === 'STATUTORY_CONSEQUENCES')
      if (!p) return 'the pass is not in PASSES'
      if (!p.jobs?.includes('CITATION_CONSEQUENCES')) return 'the pass declares no citation job'
      // ⚠ NO INTENTS ON PURPOSE — a keyword search filed beside verified references is what
      // §7 forbids. Asserted so nobody "fixes" it by adding one.
      if (p.intents.length) return 'the pass declares search intents — it reads a graph, it does not search'
      return PASS_KEYS.length === 5 ? null : `expected five passes, found ${PASS_KEYS.length}`
    },
  },
  {
    name: '§1 the job key differs from the pass key',
    run: () => {
      // ⚠ THEY WERE THE SAME AND check:deepening FIRED. Two registries sharing one name is
      // indistinguishable, to a source guard and to a reader, from a pass key leaking into
      // the engine.
      const q = jobQuestion('CITATION_CONSEQUENCES')
      if (!q || !/statute book/.test(q)) return 'the job has no question of its own'
      return PASS_KEYS.includes('CITATION_CONSEQUENCES' as never)
        ? 'the job key is also a pass key'
        : null
    },
  },
  {
    name: '§2 an unresolved target ASKS rather than guessing',
    run: (src) => {
      const s = src['lib/lex/deepening-jobs.ts']
      if (!/No enactment is identified for this idea/.test(s)) return 'a skip does not explain itself'
      const code = codeOnly(s)
      // ⚠ NO SECOND RESOLVER. A looser fallback here would give this pass the guess the rest
      // of the platform refuses — and a wrong target produces a confidently wrong list.
      if (/mostCited|guessInstrument|keywordToInstrument/.test(code)) return 'a fallback resolver exists'
      return /if \(!instruments\.length\)/.test(code) ? null : 'an empty instrument list is not handled'
    },
    break: (src) => ({
      ...src,
      'lib/lex/deepening-jobs.ts': src['lib/lex/deepening-jobs.ts']
        .split('No enactment is identified for this idea').join('Nothing found'),
    }),
  },
  {
    name: '§3/§5 every written row carries BOTH its quotation and the coverage statement',
    run: (src) => {
      const s = src['lib/lex/deepening-jobs.ts']
      if (!/One of them, in \$\{g\.evidence\.sourceGid\}/.test(s)) return 'the quotation is not written into the row'
      if (!/None of the references in this group has quotable words/.test(s)) {
        return 'a group with no quotable words does not say so'
      }
      // ⚠ COVERAGE IN THE SAME BODY, not a footer a renderer could drop (§5: adjacent).
      return /\$\{coverage\}/.test(s) ? null : 'the coverage statement is not adjacent to the count'
    },
    break: (src) => ({
      ...src,
      'lib/lex/deepening-jobs.ts': src['lib/lex/deepening-jobs.ts']
        .replace('`\\n${coverage}`,', '``,'),
    }),
  },
]

function main() {
  const selfTest = process.argv.includes('--self-test')
  const src = loadSources()
  let pass = 0, fail = 0, uncontrolled = 0
  console.log(`── check:statutory${selfTest ? ' --self-test' : ''} ──`)
  for (const c of CHECKS) {
    let err: string | null
    try { err = c.run(src) } catch (e) {
      err = `the check itself threw: ${e instanceof Error ? e.message : String(e)}`
    }
    if (err) { fail++; console.log(`  ✗  ${c.name}\n       ${err}`); continue }
    pass++
    console.log(`  ✓  ${c.name}`)
    if (!selfTest) continue
    if (!c.break && !c.control) {
      uncontrolled++; console.log('       ⚠ NO NEGATIVE CONTROL — asserts against imported behaviour'); continue
    }
    let broken: string | null
    try { broken = c.control ? c.control() : c.run(c.break!(src)) } catch { broken = 'threw' }
    if (broken) console.log('       ↳ control OK — rejects the broken version')
    else { fail++; console.log('       ✗ CONTROL FAILED — the broken version PASSES') }
  }
  console.log(`\n${pass} passed, ${fail} failed${selfTest ? `, ${uncontrolled} with no negative control` : ''}.`)
  process.exit(fail ? 1 : 0)
}

main()
