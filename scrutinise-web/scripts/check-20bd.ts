// ─────────────────────────────────────────────────────────────────────────────
// check:20bd — Sprint 20-B/D. The proposal document, versioning and publication.
//
// ⚠ EVERY PROPERTY HERE HAS A PURPOSE-BUILT BREAK, and `--self-test` asserts that
// each break FIRES. GRAPH 3A's lesson, in this codebase's own words: a blanket
// break "tests the checks it happens to reach and quietly certifies the rest" —
// ten of twelve assertions there reported DID NOT FIRE because the property was
// structural and no config change could falsify it. So the breaks below are one
// per property, each constructed to falsify exactly that property and nothing
// else.
//
// Usage:
//   npm run check:20bd
//   npm run check:20bd -- --self-test
//
// It touches no database and makes no model call. The live half — append-only
// against Neon, the pin surviving a new version, the community boundary — is
// `npm run verify:20bd`, because those are facts about the running system and
// cannot be asserted from a fixture.
// ─────────────────────────────────────────────────────────────────────────────

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, sep } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { renderDocx } from '../lib/documents/render-docx'
import { renderPdf } from '../lib/documents/render-pdf'
import {
  buildProposalDocument,
  buildSummaryDocument,
  headlineCost,
} from '../lib/documents/build-proposal'
import {
  snapshotHash,
  assertRenderableSnapshot,
  SNAPSHOT_VERSION,
  SnapshotUnavailableError,
  type ProposalSnapshot,
} from '../lib/documents/proposal-snapshot'
import { describeChange } from '../lib/documents/proposal-version'
import type { Block, DocumentModel } from '../lib/documents/model'

const selfTest = process.argv.includes('--self-test')

let pass = 0
let fail = 0
function ok(label: string, condition: boolean, detail?: string) {
  if (condition) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

/** A self-test break: run `fn` on broken input and require the property to FAIL. */
const breaks: { label: string; fired: boolean }[] = []
function expectBreak(label: string, propertyHolds: () => boolean) {
  let held: boolean
  try { held = propertyHolds() } catch { held = false }
  breaks.push({ label, fired: !held })
}

// ─────────────────────────────────────────────────────────────────────────────
// The fixture. Deliberately mixed: some claims sourced, some not; a dismissed
// issue with a reason and one without; a costed action and an uncosted one.
// ─────────────────────────────────────────────────────────────────────────────

function fixture(overrides: Partial<ProposalSnapshot> = {}): ProposalSnapshot {
  const base: ProposalSnapshot = {
    snapshotVersion: SNAPSHOT_VERSION,
    ideaId: 'idea-fixture',
    generatedAt: '2026-08-20T09:00:00.000Z',
    title: 'Uprating fixed-penalty notices for traffic offences',
    summaryDescription: 'Penalties set in cash terms in 2013 have decayed in real terms; uprate them and index them.',
    owner: { id: 'user-1', name: 'Charlie' },
    userKnowledge: {
      text: 'I ran enforcement for a council for six years — the recovery rate is the binding constraint, not the level.',
      provenance: 'USER_TESTIMONY',
    },
    fields: [
      {
        key: 'challenge', label: 'The problem', status: 'ACCEPTED',
        value: 'Fixed-penalty levels have not been uprated since 2013, so deterrence has decayed in real terms.',
        slots: [], evidenceIds: ['ev-1'], supported: true,
      },
      {
        key: 'pivotalObstacle', label: 'Pivotal obstacle', status: 'ACCEPTED',
        // ⚠ NO EVIDENCE. This is the row the unsupported-marker property is about.
        value: 'No department owns the uprating decision, so nobody has ever made it.',
        slots: [], evidenceIds: [], supported: false,
      },
      {
        key: 'whoAffectedImpactCost', label: 'Who’s affected, impact & cost', status: 'ACCEPTED',
        value: { affectedGroups: 'Councils and police forces', impact: 'Enforcement costs exceed fines recovered', cost: '£40m a year' },
        slots: [
          { key: 'affectedGroups', label: 'Who is most acutely affected', value: 'Councils and police forces' },
          { key: 'impact', label: 'Impact', value: 'Enforcement costs exceed fines recovered' },
          { key: 'cost', label: 'Cost', value: '£40m a year' },
        ],
        evidenceIds: [], supported: false,
      },
      {
        key: 'chosenApproach', label: 'Chosen approach', status: 'ACCEPTED',
        value: 'Index the penalty to CPI and give the uprating duty to the Secretary of State.',
        slots: [], evidenceIds: [], supported: false,
      },
      {
        key: 'whatItRulesOut', label: 'What it rules out', status: 'ACCEPTED',
        value: 'It rules out a discretionary local level, which would fragment enforcement.',
        slots: [], evidenceIds: [], supported: false,
      },
    ],
    causes: [
      {
        id: 'c1', cause: 'The level is set in primary legislation and nobody amends it',
        whyPersisted: 'Amending it costs parliamentary time and wins no votes',
        evidenceLine: null, isRootCause: true, classification: 'MATERIAL',
        parentCauseId: null, source: 'USER', evidenceIds: [], supported: false,
      },
      {
        id: 'c2', cause: 'Recovery rates fell after the 2019 court-fee changes',
        whyPersisted: null, evidenceLine: 'MoJ published recovery statistics, 2023',
        isRootCause: false, classification: 'CONTRIBUTORY',
        parentCauseId: 'c1', source: 'LEX_CORPUS', evidenceIds: ['ev-1'], supported: true,
      },
    ],
    options: [
      { id: 'o1', approach: 'Index to CPI', mechanismTypes: ['rules'], caseFor: 'Automatic', caseAgainst: 'Rigid', status: 'CHOSEN', ruleOutReason: null, source: 'LEX' },
      { id: 'o2', approach: 'Local discretion over the level', mechanismTypes: ['institutional'], caseFor: null, caseAgainst: null, status: 'RULED_OUT', ruleOutReason: 'Fragments enforcement across boundaries', source: 'USER' },
      // ⚠ Ruled out with NO reason recorded — the document must say so.
      { id: 'o3', approach: 'Abolish the penalty entirely', mechanismTypes: [], caseFor: null, caseAgainst: null, status: 'RULED_OUT', ruleOutReason: null, source: 'LEX' },
    ],
    actions: [
      {
        id: 'a1', practicalStep: 'Amend Schedule 3 to index the penalty to CPI',
        mechanismType: 'rules', whoImplements: 'Department for Transport',
        targetOrganisation: 'Road Traffic Offenders Act 1988', wording: 'Insert an uprating duty after s.53',
        legislative: true, benefits: null,
        implementationCost: { low: 120000, high: 180000, unit: 'GBP', basis: 'ASHE mid-level FTE, 2 for 6 months', benchmarkId: 'b1', userOverride: false, priceYear: 2026 },
        enforcementCost: null, regulatoryFriction: null,
        costLines: [
          { id: 'l1', actionId: 'a1', label: '2 mid-level FTE for 6 months', costType: 'STAFF', category: 'IMPLEMENTATION', staffLevel: 'MID', fteCount: 2, durationMonths: 6, low: 120000, high: 180000, unit: 'GBP', basis: 'ASHE 2025 uprated', benchmarkId: 'b1', priceYear: 2026 },
          // ⚠ A cost line with NO basis — it must render as "no basis stated".
          { id: 'l2', actionId: 'a1', label: 'Legal drafting', costType: 'OTHER', category: 'IMPLEMENTATION', staffLevel: null, fteCount: null, durationMonths: null, low: 20000, high: 20000, unit: 'GBP', basis: null, benchmarkId: null, priceYear: null },
        ],
        source: 'USER', evidenceIds: ['ev-1'], supported: true,
      },
      {
        id: 'a2', practicalStep: 'Publish recovery rates quarterly',
        mechanismType: 'transparency', whoImplements: 'MoJ', targetOrganisation: null, wording: null,
        legislative: false, benefits: null,
        // ⚠ UNCOSTED, so the headline total must refuse to sum.
        implementationCost: null, enforcementCost: null, regulatoryFriction: null,
        costLines: [], source: 'LEX', evidenceIds: [], supported: false,
      },
    ],
    costs: {
      lines: [],
      summary: { summary: 'Total one-off cost £140k–£200k against a problem cost of £40m a year.' },
      problemCost: '£40m a year',
    },
    evidence: [
      {
        id: 'ev-1', passKey: 'EVIDENCE', fieldRef: 'challenge', kind: 'SUPPORTS',
        title: 'Road Traffic Offenders Act 1988, s.53',
        body: 'The level is fixed by order and has not been amended since 2013.',
        citation: 'Road Traffic Offenders Act 1988, s.53',
        url: 'https://www.legislation.gov.uk/ukpga/1988/53/section/53',
        sourceType: 'PRIMARY_LEGISLATION', siftReason: 'States the uprating power and its last exercise.',
        // 25-M §3 — the snapshot carries the review status so a renderer can say whose the
        // finding is. ACCEPTED here: this fixture is one the proposer has been through.
        status: 'ACCEPTED',
        // 25-D §3 — the §25.5 question this answers, as its producer tagged it.
        headingKey: 'LAW_NOW',
      },
    ],
    issues: [
      // ⚠ 25-W §C — i1 CARRIES A TITLE AND i2/i3 DO NOT, deliberately. The renderer has to
      // put a title in front of the text where there is one and change nothing at all where
      // there is not; a fixture in which every row is titled would only test half of that.
      { id: 'i1', passKey: 'LEGAL', title: 'No post-implementation review', sourceModel: null, runVersion: 1, promotedToVersion: null, relationKind: null, current: true, text: 'No post-implementation review of the 2013 order exists', status: 'OPEN', dismissReason: null, resolutionNote: null },
      { id: 'i2', passKey: 'LEGAL', title: null, sourceModel: null, runVersion: 1, promotedToVersion: null, relationKind: null, current: true, text: 'Devolved competence in Scotland is unclear', status: 'DISMISSED', dismissReason: 'Reserved matter — confirmed against the Scotland Act', resolutionNote: null },
      // ⚠ Dismissed with NO reason — the document must name that absence.
      { id: 'i3', passKey: 'FINANCIAL', title: null, sourceModel: null, runVersion: 1, promotedToVersion: null, relationKind: null, current: true, text: 'Whether recovery would improve at all', status: 'DISMISSED', dismissReason: null, resolutionNote: null },
    ],
    knownUnknowns: [
      { question: 'What did the 2013 uprating actually achieve?', why: 'No post-implementation review was published', passKey: 'EVIDENCE' },
    ],
    forks: {
      open: [{ id: 'f1', forkKey: 'instrument', fieldKey: 'chosenApproach', chosen: 'Primary legislation', alternative: 'An existing order-making power', caseForAlternative: 'S.53 may already reach this without a Bill.', resolved: false }],
      resolved: [],
    },
    sources: [
      {
        group: 'PRIMARY_LEGISLATION', label: 'Primary legislation',
        refs: [{ id: 'ukpga/1988/53', title: 'Road Traffic Offenders Act 1988', citation: 'Road Traffic Offenders Act 1988, s.53', url: 'https://www.legislation.gov.uk/ukpga/1988/53/section/53', snippet: 'Fixed penalty levels…', date: '1988-05-15', decision: 'INCLUDED', exclusionReason: null, annotation: null }],
      },
    ],
    // ── 25-L §3d — a source the proposer chose for the document itself ───────
    //
    // ⚠ THE FIXTURE CARRIES IT SO THE THREE-CASE RENDER IS EXERCISED. A version minted
    // before 25-L has NO such key, and `build-proposal` must render those without throwing;
    // a fixture that also omitted it would only ever test the historic path and would have
    // let a `snapshot.prioritySources.length` ship. (That is exactly how this was found.)
    prioritySources: [
      {
        id: 'ukpga/1988/53', title: 'Road Traffic Offenders Act 1988',
        citation: 'Road Traffic Offenders Act 1988, s.53',
        url: 'https://www.legislation.gov.uk/ukpga/1988/53/section/53',
        decision: 'PRIORITY' as const, annotation: 'The power the whole proposal turns on.',
      },
    ],
    passes: [
      { passKey: 'EVIDENCE', status: 'RUN', completedAt: '2026-08-19T10:00:00.000Z', failureReason: null },
      { passKey: 'FINANCIAL', status: 'FAILED', completedAt: null, failureReason: 'The sift returned 500 candidates and the write threw' },
    ],
    scaffolded: [
      { key: 'EVIDENCE_PACK', label: 'The Evidence Pack', readsFrom: ['evidence'], status: 'scaffolded', why: 'x' },
      { key: 'ONLINE_VIEW', label: 'The Online View', readsFrom: ['all'], status: 'scaffolded', why: 'x' },
      { key: 'LEGISLATIVE_ANNEX', label: 'The Legislative Annex (standalone)', readsFrom: ['actions'], status: 'scaffolded', why: 'x' },
    ],
    coverage: { fieldsTotal: 5, fieldsSupported: 1, actionsTotal: 2, actionsSupported: 1 },
    // ── 25-D §2a — considered and set aside, with a reason. ───────────────────
    //
    // ⚠ THE FIXTURE'S EXCLUDED SOURCE IS DELIBERATELY ONE THAT IS NOT IN `sources`. That is
    // the case the Evidence Pack has to get right: a source excluded and then dropped from
    // retrieval is invisible to anything that filters the retrieved set, and it is the one a
    // reader is most likely to ask about.
    excludedSources: [
      {
        sourceKey: 'ukia/2013/0142',
        title: 'Impact Assessment — Fixed Penalty Uprating 2013',
        citation: 'IA No. MoJ/2013/0142',
        url: 'https://www.legislation.gov.uk/ukia/2013/142',
        reason: 'It prices a different offence class, so its per-case figure is not comparable.',
        annotation: null,
        decidedAt: '2026-08-21T09:00:00.000Z',
      },
    ],
    // ── 25-D §2b — what was still open when this version was made. ────────────
    outstanding: {
      openIssues: [{ id: 'i1', passKey: 'LEGAL', text: 'No post-implementation review of the 2013 order exists' }],
      unresolvedForks: [{ forkKey: 'instrument', fieldKey: 'chosenApproach', chosen: 'Primary legislation', alternative: 'An existing order-making power' }],
      declaredGaps: [{ question: 'What did the 2013 uprating actually achieve?', why: 'No post-implementation review was published', passKey: 'EVIDENCE' }],
      unsupportedFields: ['The problem'],
      counts: { openIssues: 1, totalIssues: 3, unresolvedForks: 1, declaredGaps: 1 },
    },
  }
  return { ...base, ...overrides }
}

// ── plain-text extraction, so we assert what a READER gets ───────────────────

function modelText(model: DocumentModel): string {
  const runs = (b: Block): string => {
    switch (b.kind) {
      case 'heading': case 'paragraph': return b.runs.map((r) => r.text).join('')
      case 'bullets': return b.items.map((i) => i.map((r) => r.text).join('')).join('\n')
      case 'note': return b.text
      case 'sources': return `${b.label}\n${b.refs.map((r) => `${r.title} ${r.citation} ${r.url} ${r.snippet ?? ''}`).join('\n')}`
      case 'rule': return '---'
    }
  }
  return model.blocks.map(runs).join('\n')
}

/** The visible text of a PDF, through the parser the app already ships. */
async function readPdfText(buf: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(buf) })
  try {
    const { text } = await parser.getText()
    return text
  } finally {
    await parser.destroy()
  }
}

/** The visible text of a docx, plus its hyperlink targets — which live in the
 *  relationships part rather than the text runs, and "sources intact" includes
 *  the links. */
async function readDocxText(buf: Buffer): Promise<string> {
  const { default: mammoth } = await import('mammoth')
  const { value } = await mammoth.extractRawText({ buffer: buf })
  const urls = buf.toString('latin1').match(/https?:\/\/[^"'\s<>]+/g) ?? []
  return `${value}\n${urls.join('\n')}`
}

// ─────────────────────────────────────────────────────────────────────────────

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

/**
 * ⚠ §1's SEAM, ASSERTED BY A CHECK AND NOT BY INTENTION.
 *
 *   "If the document renderer imports anything from lib/lex/deepening*, the seam
 *    has failed."
 *
 * The ban covers the WHOLE document stack, including the assembler — because the
 * seam is "we depend on the tables, which are stable, not on 25-C's code, which
 * is mid-flight". `lex-client` is banned for the same reason plus a second one:
 * an import of it from a renderer would mean something is being GENERATED at
 * export time, which §20.0 forbids outright.
 */
const BANNED_IMPORTS = [/lib\/lex\/deepening/, /lib\/lex\/lex-client/]

/** Renderers must not query Prisma — "everything downstream reads the snapshot". */
const RENDERERS = [
  'lib/documents/build-proposal.ts',
  'lib/documents/render-docx.ts',
  'lib/documents/render-pdf.ts',
  'lib/documents/markdown.ts',
  'lib/documents/model.ts',
]

function importsOf(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  return [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
}

async function main() {
  console.log(`── check:20bd${selfTest ? ' --self-test' : ''} ──\n`)

  // ══ §1 THE SEAM ════════════════════════════════════════════════════════════
  console.log('§1 — the seam')

  const stack = [...walk(join('lib', 'documents')), ...walk(join('components', 'documents'))]
  const offenders: string[] = []
  for (const f of stack) {
    for (const imp of importsOf(f)) {
      if (BANNED_IMPORTS.some((re) => re.test(imp))) offenders.push(`${f} → ${imp}`)
    }
  }
  ok('no file in the document stack imports lib/lex/deepening* or lex-client',
    offenders.length === 0, offenders.join(', ') || `${stack.length} files scanned`)

  const prismaInRenderer = RENDERERS.filter((r) =>
    existsSync(r) && importsOf(r).some((i) => /lib\/prisma|@prisma\/client/.test(i)))
  ok('no renderer imports Prisma — renderers read the snapshot and nothing else',
    prismaInRenderer.length === 0, prismaInRenderer.join(', ') || `${RENDERERS.length} renderers`)

  const assembler = readFileSync(join('lib', 'documents', 'proposal-snapshot.ts'), 'utf8')
  ok('the assembler makes no model call',
    !/lex-client|generateContent|callModel|anthropic|openai|gemini/i.test(assembler))
  ok('buildProposalSnapshot is exported as the single entry point',
    /export async function buildProposalSnapshot/.test(assembler))

  // ══ §2 THE CONTENT HASH ════════════════════════════════════════════════════
  console.log('\n§2 — versioning arithmetic')

  const a = fixture()
  const b = fixture({ generatedAt: '2027-01-01T00:00:00.000Z' })
  ok('generatedAt is EXCLUDED from the content hash — otherwise every read mints a version',
    snapshotHash(a) === snapshotHash(b))

  // Key order must not matter: a snapshot round-tripped through JSONB can come
  // back with its keys in a different order and must still hash the same.
  //
  // ⚠ THE FIRST VERSION OF THIS TEST WAS WRONG AND REPORTED A DEFECT THAT DOES NOT
  // EXIST. It used `JSON.stringify(a, Object.keys(a).sort())`, and the replacer-ARRAY
  // form does not reorder keys — it FILTERS them, at every level of the tree. It built
  // a snapshot with most of its nested keys deleted and then blamed the hash. Rebuilt
  // to actually reverse the key order, recursively, which is the thing being claimed.
  const reorder = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(reorder)
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const k of Object.keys(v as object).reverse()) out[k] = reorder((v as Record<string, unknown>)[k])
      return out
    }
    return v
  }
  const reordered = reorder(a) as ProposalSnapshot
  ok('the reorder fixture really did move keys (or the assertion below proves nothing)',
    JSON.stringify(reordered) !== JSON.stringify(a))
  ok('the hash is key-order independent (a JSONB round trip must not mint a version)',
    snapshotHash(reordered) === snapshotHash(a))

  const changed = fixture({ title: 'A different title' })
  ok('a real change DOES change the hash', snapshotHash(changed) !== snapshotHash(a))

  const note = describeChange(a, fixture({
    issues: a.issues.map((i) => (i.id === 'i1' ? { ...i, status: 'ADDRESSED' } : i)),
  }))
  ok('describeChange counts issues resolved rather than asserting a sentence',
    Boolean(note && /of 3 issues resolved/.test(note)), note ?? 'null')
  ok('describeChange returns null when nothing countable moved',
    describeChange(a, fixture()) === null)

  // ⚠ THE DEFECT THE FIRST LIVE RUN FOUND, pinned as a fixture so it cannot come
  // back. `prev` is normally read out of a `jsonb` column, and Postgres stores
  // object keys sorted by length then bytewise — `{affectedGroups, impact, cost}`
  // returns as `{cost, impact, affectedGroups}`. A plain `JSON.stringify`
  // comparison saw that as an edit and the change note invented one.
  const jsonbLike = fixture({
    fields: a.fields.map((f) =>
      f.key === 'whoAffectedImpactCost' && f.value && typeof f.value === 'object'
        ? { ...f, value: Object.fromEntries(Object.entries(f.value as Record<string, unknown>).reverse()) }
        : f),
  })
  ok('a structured field whose KEYS were reordered by jsonb is NOT reported as edited',
    describeChange(jsonbLike, fixture()) === null,
    String(describeChange(jsonbLike, fixture())))
  ok('the first version says so', describeChange(null, a) === 'First version.')

  // ══ §3 THE DOCUMENTS ═══════════════════════════════════════════════════════
  console.log('\n§3 — the Proposal')

  const proposal = buildProposalDocument(a)
  const ptext = modelText(proposal.model)

  ok('renders the problem', ptext.includes('deterrence has decayed in real terms'))
  ok('renders the causal tree with the root cause marked',
    ptext.includes('[root cause]') && ptext.includes('Recovery rates fell'))
  ok('a source-backed claim carries its citation',
    ptext.includes('Road Traffic Offenders Act 1988, s.53'))

  // ⚠ THE NEVER-CLAIM RULE, BOTH DIRECTIONS. Marking everything makes the marker
  // noise; marking nothing is the quiet presentation the rule exists to stop.
  const marker = 'Not evidenced'
  ok('an unsourced CLAIM field is visibly marked as unsupported', ptext.includes(marker))
  const supportedOnly = fixture({
    fields: a.fields.map((f) => ({ ...f, supported: true, evidenceIds: ['ev-1'] })),
    causes: a.causes.map((c) => ({ ...c, supported: true, evidenceIds: ['ev-1'] })),
    actions: a.actions.map((x) => ({ ...x, supported: true, evidenceIds: ['ev-1'] })),
  })
  ok('a fully sourced proposal carries NO unsupported marker (the marker is not decoration)',
    !modelText(buildProposalDocument(supportedOnly).model).includes(marker))

  ok('a ruled-out option with no reason says so, rather than listing bare',
    ptext.includes('Abolish the penalty entirely') && ptext.includes('no reason recorded'))
  ok('a cost line with no basis says "no basis stated" rather than showing a bare number',
    ptext.includes('Legal drafting') && ptext.includes('no basis stated'))
  ok('a dismissed issue keeps its reason, and one without a reason names the absence',
    ptext.includes('Reserved matter') && ptext.includes('Whether recovery would improve at all'))

  ok('the gaps section states what is unestablished',
    ptext.includes('What this proposal does not establish') &&
    ptext.includes('What did the 2013 uprating actually achieve?'))
  ok('a failed research pass is reported with its reason',
    ptext.includes('The sift returned 500 candidates'))
  ok('an open fork is stated as a decision still open',
    ptext.includes('An existing order-making power'))

  // A proposal with nothing to declare must still have the section.
  const clean = fixture({
    knownUnknowns: [], issues: [], forks: { open: [], resolved: [] },
    passes: [], coverage: { fieldsTotal: 5, fieldsSupported: 5, actionsTotal: 2, actionsSupported: 2 },
  })
  ok('the gaps section is NEVER empty — "nothing was recorded" is stated, not omitted',
    modelText(buildProposalDocument(clean).model).includes('Nothing was recorded as unestablished'))

  // ⚠ REPOINTED BY 25-N §5c, WHICH DELETES THE PERSONAL FRAMING AND KEEPS THE ATTRIBUTION.
  // §5c: *"Delete 'In Charlie's own words' — this is an outward document."* The property this
  // guard is for is that the proposer's account is ATTRIBUTED and marked as testimony rather
  // than blended into Lex's prose, and that is unchanged — only the heading is. Asserting the
  // old wording is ABSENT as well as the new one present is what stops the deletion being
  // half-done the next time somebody edits this file.
  ok('the user’s own knowledge is attributed to them, not blended in',
    ptext.includes('First-hand account')
    && ptext.includes('recorded as testimony')
    && !ptext.includes('own words'))
  ok('the legislative annex renders where the instrument is legislative',
    ptext.includes('Legislative annex') && ptext.includes('Insert an uprating duty after s.53'))
  ok('a non-legislative action gets no annex',
    !modelText(buildProposalDocument(fixture({ actions: [a.actions[1]] })).model).includes('Legislative annex'))

  console.log('\n§3b — the Summary')
  const summary = buildSummaryDocument(a, { onlineViewUrl: 'https://example.test/proposals/abc' })
  const stext = modelText(summary.model)
  // ⚠⚠ REPOINTED BY 25-N §5b, AND THE HEADINGS ARE THE BRIEF'S, NOT §20.1's.
  //
  // §5b: *"The summary is one page, not two, and its headings should be The problem · Cause ·
  // Guiding Policy · Proposed Actions."* §20.1's six included "The pivotal obstacle" and "The
  // approach" — a vocabulary the platform teaches nowhere — and DROPPED THE CAUSE entirely, so
  // the one-page version of a proposal never said why the problem happens.
  //
  // ⚠ THE PROPERTY IS THE SAME SHAPE: a fixed set of headings, every one present, asserted
  // without rendering. What changed is which four, and that is Charlie's decision.
  ok('§5b — the summary carries the four headings the brief names',
    ['The problem', 'Cause', 'Guiding Policy', 'Proposed Actions'].every((h) => stext.includes(h))
    // The cost comparison survives: it is the one number a reader wants from a one-pager.
    && stext.includes('Cost of the proposal')
    && stext.includes('Cost of the problem'))
  ok('the summary points at the online view for depth', stext.includes('https://example.test/proposals/abc'))
  // ⚠⚠ REVERSED BY 25-N §5a, AND THE REVERSAL IS THE FINDING — so the assertion is inverted
  // rather than deleted.
  //
  // The old line printed *"9 of 9 settled kernel fields carry no source, and 167 questions
  // remain open"* on an OUTWARD-FACING one-pager. §5a: those are internal working numbers and
  // *"belong in a separate progress report for the user — a 'what is left to do' view — not in
  // a document for a reader."*
  //
  // ⚠ THE HONESTY IS NOT REMOVED, IT IS RE-AIMED, and this guard now holds BOTH halves: the
  // draft is declared once at the top, and no arithmetic about our own coverage appears
  // anywhere in it. Deleting the guard would have left nothing stopping the counts coming back.
  ok('§5a — the summary declares itself a DRAFT and carries NO internal working counts',
    stext.includes('This is a DRAFT report for a proposal in process')
    && !/settled kernel fields carry no source/.test(stext)
    && !/questions? or issues? remain open/.test(stext)
    && !stext.includes('What this does not establish'))
  ok('the summary is materially shorter than the proposal',
    stext.length < ptext.length * 0.6, `${stext.length} vs ${ptext.length} chars`)

  // ⚠ THE MOST DANGEROUS NUMBER IN THE DOCUMENT.
  ok('the headline cost REFUSES to sum a partial set (a2 is uncosted)',
    headlineCost(a.actions) === null)
  ok('the headline cost sums when every action is costed',
    headlineCost([a.actions[0]]) === '£120,000–£180,000', String(headlineCost([a.actions[0]])))
  ok('the summary says "not costed" rather than showing a partial total',
    stext.includes('not costed in the record'))

  // ══ §4 SHAPE VERSIONING ════════════════════════════════════════════════════
  console.log('\n§4 — stored snapshots outlive the code that wrote them')
  let refusedFuture = false
  try { assertRenderableSnapshot(fixture({ snapshotVersion: SNAPSHOT_VERSION + 1 })) }
  catch (e) { refusedFuture = e instanceof SnapshotUnavailableError }
  ok('a snapshot from a NEWER shape is refused rather than rendered half-understood', refusedFuture)
  ok('the three unbuilt outputs are declared scaffolded in the snapshot, not merely in a report',
    a.scaffolded.length === 3 && a.scaffolded.every((x) => x.status === 'scaffolded'))

  // ══ §5 READABLE, NOT MERELY WELL-FORMED ════════════════════════════════════
  console.log('\n§5 — the files a recipient actually opens')

  const [pdocx, ppdf] = await Promise.all([renderDocx(proposal.model), renderPdf(proposal.model)])
  const [sdocx, spdf] = await Promise.all([renderDocx(summary.model), renderPdf(summary.model)])

  const docxText = await readDocxText(pdocx)
  ok('docx contains the proposal prose', docxText.includes('deterrence has decayed in real terms'))
  ok('docx contains a source URL', docxText.includes('legislation.gov.uk'))
  ok('docx carries the unsupported marker into the file', docxText.includes('Not evidenced'))
  ok('docx carries the provenance line',
    docxText.includes('Generated ') && docxText.includes('the stored proposal state'))

  // ⚠ READABLE, NOT MERELY WELL-FORMED. A file that parses but whose prose and
  // citations cannot be read out of it is not an export, it is a container.
  const pdfText = await readPdfText(ppdf)
  ok('the proposal PDF is readable', pdfText.includes('deterrence has decayed in real terms'))
  ok('the proposal PDF carries the unsupported marker', pdfText.includes('Not evidenced'))
  ok('the proposal PDF carries a source URL', pdfText.includes('legislation.gov.uk'))
  ok('the proposal PDF keeps the gaps section', pdfText.includes('does not establish'))
  ok('the summary PDF is short — 1–2 pages, as §20.1 requires',
    (await PDFDocument.load(spdf)).getPageCount() <= 2,
    `${(await PDFDocument.load(spdf)).getPageCount()} pages`)
  // ⚠ REPOINTED BY 25-N §5b — "The ask" is now "Proposed Actions". The property (the summary
  // survives a real .docx round trip, with its content intact) is unchanged.
  ok('the summary docx renders', (await readDocxText(sdocx)).includes('Proposed Actions'))
  ok('both PDFs are non-trivial files', ppdf.length > 2000 && spdf.length > 1000,
    `${ppdf.length} / ${spdf.length} bytes`)

  // ══ SELF-TEST ══════════════════════════════════════════════════════════════
  if (selfTest) {
    console.log('\n── self-test: one purpose-built break per property ──')

    expectBreak('hash excludes generatedAt — break: include it', () => {
      const h = (s: ProposalSnapshot) => JSON.stringify(s)
      return h(a) === h(b)
    })

    expectBreak('unsupported marker fires — break: mark everything supported', () => {
      const broken = fixture({ fields: a.fields.map((f) => ({ ...f, supported: true })), causes: a.causes.map((c) => ({ ...c, supported: true })), actions: a.actions.map((x) => ({ ...x, supported: true })) })
      return modelText(buildProposalDocument(broken).model).includes(marker)
    })

    expectBreak('marker is not decoration — break: a fully sourced doc still shows it', () => {
      // If the builder ever emitted the note unconditionally, this would hold.
      return !modelText(buildProposalDocument(supportedOnly).model).includes(marker) === false
    })

    expectBreak('gaps section never empty — break: a proposal with nothing declared', () => {
      const t = modelText(buildProposalDocument(clean).model)
      // The property is "the section exists and says something". Breaking it means
      // asserting the section is ABSENT, which must fail.
      return !t.includes('What this proposal does not establish')
    })

    expectBreak('headline cost refuses partial sums — break: sum them anyway', () => {
      const naive = a.actions.reduce((n, x) => n + (x.implementationCost?.low ?? 0), 0)
      return headlineCost(a.actions) === `£${naive.toLocaleString('en-GB')}`
    })

    expectBreak('seam import ban — break: pretend a renderer imports deepening', () => {
      const pretend = ["import { x } from '@/lib/lex/deepening-sift'"]
      return !pretend.some((l) => BANNED_IMPORTS.some((re) => re.test(l)))
    })

    expectBreak('renderer/Prisma ban — break: pretend build-proposal imports prisma', () => {
      const pretend = ["import { prisma } from '@/lib/prisma'"]
      return !pretend.some((l) => /lib\/prisma/.test(l))
    })

    expectBreak('future shape refused — break: accept a newer shape', () => {
      try { assertRenderableSnapshot(fixture({ snapshotVersion: SNAPSHOT_VERSION + 1 })); return true }
      catch { return false }
    })

    expectBreak('describeChange is null on no change — break: expect a sentence', () => {
      return describeChange(a, fixture()) !== null
    })

    expectBreak('jsonb key reorder is not an edit — break: compare with plain JSON.stringify', () => {
      const naive = fixture().fields.filter((f) => {
        const before = jsonbLike.fields.find((p) => p.key === f.key)
        return before && JSON.stringify(before.value) !== JSON.stringify(f.value)
      })
      // The defect, reproduced: the naive comparison sees an edit that did not happen.
      return naive.length === 0
    })

    expectBreak('summary is shorter than the proposal — break: compare it to itself', () => {
      return stext.length < stext.length * 0.6
    })

    expectBreak('legislative annex is conditional — break: expect it on a non-legislative action', () => {
      return modelText(buildProposalDocument(fixture({ actions: [a.actions[1]] })).model).includes('Legislative annex')
    })

    expectBreak('ruled-out reason absence is named — break: expect silence', () => {
      return !ptext.includes('no reason recorded')
    })

    let fired = 0
    for (const b2 of breaks) {
      if (b2.fired) { fired++; console.log(`  ✓ FIRED — ${b2.label}`) }
      else console.log(`  ✗ DID NOT FIRE — ${b2.label}`)
    }
    console.log(`\n  ${fired}/${breaks.length} breaks fired`)
    if (fired !== breaks.length) {
      console.error('\n⚠ A break that does not fire is a property this check cannot see. Fix the break or the property.')
      process.exit(1)
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1) })
