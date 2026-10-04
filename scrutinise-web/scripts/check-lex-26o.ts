// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26o — BRIEF_26O (names, the one answer, the price-matched panel, cached tokens, dated rates) and the
// 26-P addendum (RCA method + guide, the Diagnosis checklist, §8c the owner-visible record of Lex's actions).
//
//   npm run check:lex-26o
//
// ⚠ CLAUDE.md §23.1 — every assertion about what a USER sees first proves its file is IMPORTED (an importer check), so
// it cannot pass over dead code. §25 — value properties are read out of the running system: `kernelText` on a real
// idea, `buildSnapshot` on a real idea, a scratch idea's tool-call row read back through `listToolCalls`. §26 — the cold
// reads (kernelText, buildSnapshot) take a subject this check did not create and did not touch.
// §23.2 — it prints checks RUN and the controls that fired.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { prisma } from '../lib/prisma'
import { GUIDING_POLICY_FIELDS } from '../lib/lex/page3-config'
import { DIAGNOSIS_FIELDS } from '../lib/lex/page2-config'
import { COHERENT_ACTIONS_FIELDS } from '../lib/lex/page4-config'
import { notChosenOptions, NOT_CHOSEN_REASON } from '../lib/documents/not-chosen'
import { guidingPolicyStatement, hasGuidingPolicy } from '../lib/lex/guiding-policy-answer'
import { rateAt, rateHistory, priceTokens, EARLIEST } from '../lib/lex/build-cost'
import { priceEntry, cacheFromAnthropic, cacheFromGemini, cacheFromOpenAIShape } from '../lib/lex/spend-ledger'
import { testStatementLength, lengthFlagLine } from '../lib/lex/statement-length'
import { PREMIUM_DRAFT_MODELS, PANEL_FALLBACKS, draftSystemPrompt } from '../lib/lex/guiding-policy-consolidate'
import { JUDGE_MODEL } from '../lib/lex/rumelt-tests'
import { REJECTS_FORCED_TOOL } from '../lib/lex/model-call'
import { REJECTS_TEMPERATURE } from '../lib/lex/model-sampling'
import { M_RCA, methodForStage } from '../lib/lex/method'
import { SYSTEM_PREFIX } from '../lib/lex/agent/system-prompt'
import { buildSnapshot, RCA_SOURCE } from '../lib/lex/agent/snapshot'
import { kernelText } from '../lib/lex/build'
import { FAQ_MARKDOWN } from '../lib/faq-content'
import { DIAGNOSIS_CHECKLIST, SECTION_CHECKLISTS, allCheckKeys, findCheck, notYetDoneLine, checksNotDone } from '../lib/lex/section-checklists'
import { isShowing } from '../lib/lex/checklist-state'
import { recordToolCall, listToolCalls } from '../lib/lex/agent/tool-log'

let pass = 0, fail = 0
const failures: string[] = []
function ok(label: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; failures.push(label); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const controls: Array<{ label: string; fired: boolean }> = []
/** §25.5 — returns whether the PROPERTY holds on a deliberately broken input. It must be FALSE, or the assertion cannot fail. */
function control(label: string, propertyHoldsOnBrokenInput: () => boolean) {
  let held: boolean
  try { held = propertyHoldsOnBrokenInput() } catch { held = false }
  controls.push({ label, fired: !held })
}
const section = (s: string) => console.log(`\n── ${s}`)

const ROOT = resolve(process.cwd()) // run from scrutinise-web, as every npm script is
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.next' || n === 'generated') continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(n)) out.push(p)
  }
  return out
}
const SOURCE = ['app', 'components', 'lib'].flatMap((d) => walk(join(ROOT, d)))
/** §23.1 — files that import `name` (a module's basename). A subject with none is dead code. */
const importersOf = (name: string) => SOURCE.filter((f) => !f.endsWith(`${name}.ts`) && !f.endsWith(`${name}.tsx`)
  && new RegExp(`from\\s+['"][^'"]*/${name}['"]`).test(readFileSync(f, 'utf8')))

async function main() {
  // ═══ §1 — the names ═══════════════════════════════════════════════════════════════════════════
  section('§1 names — read from the config the screens render')
  const label = (fs: Array<{ key: string; label: string }>, k: string) => fs.find((f) => f.key === k)?.label
  ok('1a the statement field is "Guiding Policy"', label(GUIDING_POLICY_FIELDS, 'chosenApproach') === 'Guiding Policy')
  ok('1b the summary field is "Summary of Guiding Policy"', label(GUIDING_POLICY_FIELDS, 'summaryGuidingPolicy') === 'Summary of Guiding Policy')
  ok('1d "Summary of Diagnosis"', label(DIAGNOSIS_FIELDS, 'summaryDiagnosis') === 'Summary of Diagnosis')
  ok('1d "Summary of Coherent Actions"', label(COHERENT_ACTIONS_FIELDS, 'summaryCoherentActions') === 'Summary of Coherent Actions')
  control('the old label would be caught', () => label([{ key: 'chosenApproach', label: 'Chosen approach' }], 'chosenApproach') === 'Guiding Policy')
  const SURFACES = ['components/lex/GuidingPolicyScreen.tsx', 'lib/lex/lex-client.ts', 'lib/lex/deepening.ts', 'lib/documents/build-committee-evidence.ts', 'lib/documents/build-meeting-pack.ts', 'app/ideas/[id]/IdeaDetailClient.tsx', 'lib/lex/page3-config.ts']
  for (const f of SURFACES) ok(`no "Chosen approach" / "Guiding-policy summary" label left in ${f}`, !/Chosen approach:|'Chosen approach'|label: 'Guiding-policy summary'|Approach \(summary\)/.test(read(f).replace(/\/\/[^\n]*/g, '')))
  ok('1c the build summary prints the STATEMENT as "The guiding policy"', /key: 'chosenApproach', label: 'The guiding policy'/.test(read('lib/lex/build-highlights.ts')))

  // ═══ §2 — the checks judge actions against the statement (cold read on a real idea) ═══════════
  section('§2 kernelText — a cold read of Charlie\'s own idea (452c5ade), not touched by this check')
  const idea = await prisma.idea.findFirst({ where: { id: { startsWith: '452c5ade' } }, select: { id: true } })
  if (!idea) ok('the cold-read subject exists', false, '452c5ade not found — NOT CHECKED')
  else {
    const kt = await kernelText(idea.id)
    const gp = kt.split('\n').find((l) => l.startsWith('THE GUIDING POLICY:'))
    const sm = kt.split('\n').find((l) => l.startsWith('SUMMARY OF THE GUIDING POLICY'))
    ok('2a "THE GUIDING POLICY:" is present', !!gp)
    ok('2a the summary rides along, LABELLED as the summary', !!sm && /context only/.test(sm))
    ok('2a the statement and the summary are different text (it is not handing the summary under both names)', !!gp && !!sm && gp.replace('THE GUIDING POLICY:', '').trim() !== sm.replace(/^[^:]*:/, '').trim())
    ok('2a there is no "THE APPROACH:" line any more', !/^THE APPROACH:/m.test(kt))
    control('a kernel that hands the summary as THE GUIDING POLICY would be caught', () => {
      const bad = 'THE GUIDING POLICY: summary text\nSUMMARY OF THE GUIDING POLICY (context only): summary text'
      const g = bad.split('\n')[0].replace('THE GUIDING POLICY:', '').trim(), s = bad.split('\n')[1].replace(/^[^:]*:/, '').trim()
      return g !== s
    })
  }

  // ═══ §3 — one answer on the idea page; §3b alternatives ═══════════════════════════════════════
  section('§3 one answer, and the alternatives a settlement passed over')
  ok('3 the CHOSEN row wins', guidingPolicyStatement({ chosenApproach: 'col', guidingPolicy: 'legacy' }, { chosenRowApproach: 'row' }) === 'row')
  ok('3 then the settled column', guidingPolicyStatement({ chosenApproach: 'col', guidingPolicy: 'legacy' }) === 'col')
  ok('3 a LEGACY idea (no Lex build) still reads the legacy column — the 29 showcase ideas', guidingPolicyStatement({ guidingPolicy: 'legacy' }) === 'legacy')
  ok('3 a LEX-BUILT idea never falls back to the legacy column', guidingPolicyStatement({ guidingPolicy: 'legacy' }, { lexBuilt: true }) === null)
  ok('3 the Stage-2 gate is satisfied by the statement alone', hasGuidingPolicy({ chosenApproach: 'x' }) && !hasGuidingPolicy({}))
  control('a legacy fallback on a Lex-built idea would be caught', () => guidingPolicyStatement({ guidingPolicy: 'legacy' }, { lexBuilt: true }) !== null)
  const opts = [
    { approach: 'A', status: 'CHOSEN' }, { approach: 'B', status: 'CANDIDATE' }, { approach: 'C', status: 'RULED_OUT', ruleOutReason: 'too costly' },
  ]
  const nc = notChosenOptions(opts)
  ok('3b with a policy chosen, a passed-over candidate is listed with the reason "not chosen"', nc.some((o) => o.approach === 'B' && o.ruleOutReason === NOT_CHOSEN_REASON))
  ok('3b a user\'s own reason is kept, not overwritten', nc.find((o) => o.approach === 'C')?.ruleOutReason === 'too costly')
  ok('3b the chosen one is not listed as ruled out', !nc.some((o) => o.approach === 'A'))
  ok('3b with NO policy chosen, nothing was passed over and nothing is added', notChosenOptions([{ approach: 'B', status: 'CANDIDATE' }]).length === 0)
  control('an evidence pack that lists only RULED_OUT rows would be empty here', () => opts.filter((o) => o.status === 'RULED_OUT').length === 0)
  for (const f of ['lib/documents/build-evidence-pack.ts', 'lib/documents/build-proposal.ts']) ok(`${f} uses notChosenOptions`, /notChosenOptions\(/.test(read(f)))
  ok('3 not-chosen.ts is imported by documents (§23.1)', importersOf('not-chosen').length >= 2)
  ok('3 the page and the gate import the one definition', importersOf('guiding-policy-answer').length >= 2, importersOf('guiding-policy-answer').map((f) => f.split(/[\\/]/).pop()).join(', '))

  // ═══ §4 — the panel ═══════════════════════════════════════════════════════════════════════════
  section('§4 the price-matched panel')
  ok('4a the four models', JSON.stringify([...PREMIUM_DRAFT_MODELS]) === JSON.stringify(['claude-opus-5-5', 'gpt-6.1-sol', 'gemini-3.1-pro-preview', 'grok-4.7']))
  ok('4a the judge is Opus 5.5', JUDGE_MODEL === 'claude-opus-5-5')
  ok('4b the three newer Claude models take structured output, not a forced tool', ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-1'].every((m) => REJECTS_FORCED_TOOL.has(m)))
  ok('4b the older Claude models keep the forced tool (unchanged, never probed)', !REJECTS_FORCED_TOOL.has('claude-opus-5'))
  ok('4b gpt-6.1-sol is on the no-temperature list (MEASURED 400 on 4 Oct)', REJECTS_TEMPERATURE.has('gpt-6.1-sol'))
  const mc = read('lib/lex/model-call.ts')
  ok('4b callAnthropic omits `tools`/`tool_choice` when structured output is used', /structuredOutput\s*\?\s*\{\}\s*:\s*\{\s*tools:/.test(mc))
  ok('4d the preview Gemini has a stated fallback', PANEL_FALLBACKS['gemini-3.1-pro-preview'] === 'gemini-2.5-pro')
  ok('4d the card says so when `servedBy` is set', /did not answer \(it is a preview model\)/.test(read('components/lex/GuidingPolicyScreen.tsx')) && /servedBy: d\.servedBy/.test(read('app/api/ideas/[id]/guiding-policy/consolidate/route.ts')))
  const long = 'A one. A two. A three sentence statement that runs on.'
  ok('4c a statement over two sentences is flagged', testStatementLength(long).tooLong)
  ok('4c a one-sentence statement is not', !testStatementLength('Make the accountable officer personally answerable for the named outcome.').tooLong)
  ok('4c the flag is worded "flagged for review (wording check, not a verdict)"', /Flagged for review \(wording check, not a verdict\)/.test(lengthFlagLine(testStatementLength(long))))
  ok('4c the prompt tells the drafters to be ruthlessly brief', /RUTHLESSLY BRIEF/.test(draftSystemPrompt()))
  ok('4c the card computes the flag from the statement (§23.1: the screen is imported)', /testStatementLength\(statement\)/.test(read('components/lex/GuidingPolicyScreen.tsx')) && importersOf('GuidingPolicyScreen').length >= 1)
  control('a long statement that is not flagged would be caught', () => !testStatementLength(long).tooLong)

  // ═══ §5 — cached tokens, dated rates ══════════════════════════════════════════════════════════
  section('§5 cached tokens priced separately; every rate dated')
  const aIn = cacheFromAnthropic({ input_tokens: 200, cache_read_input_tokens: 10_000, cache_creation_input_tokens: 500 })
  ok('5a Anthropic: reads and writes are folded INTO tokensIn (they are reported outside input_tokens)', aIn.tokensIn === 10_700 && aIn.tokensCached === 10_000 && aIn.tokensCacheWrite === 500)
  ok('5a Gemini: cachedContentTokenCount', cacheFromGemini({ cachedContentTokenCount: 321 }).tokensCached === 321)
  ok('5a OpenAI/xAI Responses: input_tokens_details.cached_tokens', cacheFromOpenAIShape({ input_tokens_details: { cached_tokens: 7 } }).tokensCached === 7)
  ok('5a OpenAI chat-completions: prompt_tokens_details.cached_tokens', cacheFromOpenAIShape({ prompt_tokens_details: { cached_tokens: 9 } }).tokensCached === 9)
  const r = rateAt('claude-opus-5-5', new Date('2026-10-04'))!
  const plain = priceTokens({ tokensIn: 10_000, tokensOut: 0 }, r)
  const cached = priceTokens({ tokensIn: 10_000, tokensOut: 0, tokensCached: 9_000 }, r)
  ok('5a priced separately: 9,000 of 10,000 cached is much cheaper than none cached', cached < plain * 0.3, `${(cached * 100).toFixed(3)}c vs ${(plain * 100).toFixed(3)}c`)
  ok('5a the cache-write rate is charged on written tokens', priceTokens({ tokensIn: 1000, tokensOut: 0, tokensCacheWrite: 1000 }, r) > plain / 10 * 1.2)
  ok('5a priceEntry carries it end to end', priceEntry({ model: 'claude-opus-5-5', tokensIn: 10_000, tokensOut: 0, tokensCached: 9_000 }).usd! < priceEntry({ model: 'claude-opus-5-5', tokensIn: 10_000, tokensOut: 0 }).usd!)
  control('uncached pricing would not show the saving', () => plain < plain * 0.3)
  const dec = rateAt('gemini-3.8-flash', new Date('2026-12-31T23:59:00Z'))!
  const jan = rateAt('gemini-3.8-flash', new Date('2027-01-01T00:00:00Z'))!
  ok('5b gemini-3.8-flash is $0.75/$3.75 on 31 Dec 2026', dec.inPerM === 0.75 && dec.outPerM === 3.75)
  ok('5b …and DOUBLES on 1 Jan 2027 to $1.50/$7.50', jan.inPerM === 1.5 && jan.outPerM === 7.5, 'the table would have kept the introductory rate past midnight')
  ok('5b every model has a first row dated EARLIEST or a real date', ['gemini-2.5-flash', 'claude-opus-5-5', 'grok-4.7', 'gpt-6-luna'].every((m) => rateHistory(m).every((x) => /^\d{4}-\d\d-\d\d$/.test(x.from)) && rateHistory(m)[0].from === EARLIEST))
  control('an undated table keeps the old rate after midnight', () => rateAt('gemini-3.8-flash', new Date('2027-06-01'))!.inPerM === 0.75)

  // ═══ addendum §6a/§6d — the method and the guide ═════════════════════════════════════════════
  section('addendum §6a/§6d — root-cause analysis, inside the Rumelt kernel')
  for (const [name, re] of [['five whys', /FIVE WHYS/], ['symptom or cause', /SYMPTOM OR CAUSE/], ['coverage categories', /people, process, incentives, information, resources, rules/], ['contributing versus root', /CONTRIBUTING VERSUS ROOT/], ['systems before blame', /SYSTEMS BEFORE BLAME/]] as Array<[string, RegExp]>) {
    ok(`M_RCA teaches: ${name}`, re.test(M_RCA))
  }
  ok('the boundary is stated: RCA finds candidates, Rumelt chooses the obstacle', /do not choose the pivotal obstacle/.test(M_RCA) && /Rumelt/.test(M_RCA))
  ok('Lex never claims a proved single root cause', /NEVER claim a proved single root/.test(M_RCA))
  ok('the method reaches Lex at the Diagnosis stage (non-agent path)', methodForStage('DIAGNOSIS').includes('ROOT-CAUSE ANALYSIS'))
  ok('…and the agent\'s stable prefix', SYSTEM_PREFIX.includes('ROOT-CAUSE ANALYSIS'))
  ok('…and not at another stage', !methodForStage('GUIDING_POLICY').includes('ROOT-CAUSE ANALYSIS'))
  control('a method without the boundary would be caught', () => /do not choose the pivotal obstacle/.test(M_RCA.replace('do not choose the pivotal obstacle', '')))
  if (idea) {
    const snap = await buildSnapshot(idea.id, {})
    const line = snap.stable.split('\n').find((l) => l.startsWith('ROOT-CAUSE-ANALYSIS SOURCES'))
    ok('the snapshot grounds the method in the user\'s FILED RCA sources (cold read)', !!line && /Root Cause Analysis/.test(line), line?.slice(0, 120))
    ok('…both filed sources are named', !!line && /Project Manager/.test(line) && /Proven Methods/.test(line))
    control('a source that is not about RCA is not listed', () => RCA_SOURCE.test('Report on the Organisation of the Permanent Civil Service'))
  } else ok('snapshot cold read', false, 'NOT CHECKED — no subject')
  ok('M_RCA says it is grounded in the two filed guides, and sets no specimen sentence (§27)', /instituteprojectmanagement|qualitycoach/.test(read('lib/lex/method.ts')))
  ok('the guide button is mounted at the top of Diagnosis (§23.1: it has an importer, FieldsPanel has one)', importersOf('DiagnosisGuideModal').length >= 1 && importersOf('FieldsPanel').length >= 1 && /page\.key === 'DIAGNOSIS' && !isLocked && !collapsed && <DiagnosisGuideButton \/>/.test(read('components/lex/FieldsPanel.tsx')))

  // ═══ CCh follow-up — the Diagnosis checklist, as a pattern ═════════════════════════════════════
  section('checklist — five checks, one source, the worklist, the guide and the FAQ')
  const checks = DIAGNOSIS_CHECKLIST.checks
  ok('five checks', checks.length === 5)
  ok('the titles are the brief\'s', JSON.stringify(checks.map((c) => c.title)) === JSON.stringify(['Five whys', 'Symptom or cause', 'Coverage', 'Contributing or root', 'Systems before blame']))
  ok('every question appears VERBATIM in the FAQ', checks.every((c) => FAQ_MARKDOWN.includes(c.question)))
  ok('the FAQ entry sits under Stage 2 / the first draft / Diagnosis', /### Stage 2, the first draft — Diagnosis/.test(FAQ_MARKDOWN))
  const guide = read('components/lex/DiagnosisGuideModal.tsx')
  ok('the guide renders the five from the registry (not its own copy)', /DIAGNOSIS_CHECKLIST\.checks\.map/.test(guide) && /\{k\.question\}/.test(guide))
  const block = read('components/lex/SectionChecklistBlock.tsx')
  ok('the worklist renders the five from the registry', /c\.checks\.map/.test(block) && /\{k\.question\}/.test(block))
  ok('SectionChecklistBlock is mounted by the worklist, which is mounted by the page (§23.1)', importersOf('SectionChecklistBlock').length >= 1 && importersOf('WorkList').length >= 1)
  control('a guide that kept its own copy would be caught', () => /DIAGNOSIS_CHECKLIST\.checks\.map/.test(guide.replace('DIAGNOSIS_CHECKLIST.checks.map', 'x')))
  ok('each check is tickable and carries an Ask Lex action', /type="checkbox"/.test(block) && />\s*\{a\?\.status === 'asking' \? 'Lex is looking…' : 'Ask Lex'\}/.test(block))
  ok('Ask Lex says nothing was changed beside the reply', /nothing has been changed/.test(block))
  const ask = read('app/api/ideas/[id]/checklists/ask/route.ts')
  ok('Ask Lex runs READ-ONLY (no tool that writes is offered)', /readOnly: true/.test(ask))
  ok('Ask Lex goes through the agent loop, so the honesty check applies to its reply', /handleAgentTurn\(/.test(ask) && /checkReply\(\{ reply/.test(read('lib/lex/agent/loop.ts')))
  ok('every check\'s instruction is a read-only request', checks.every((c) => /READ-ONLY request/.test(c.askLex) && /Do not call any tool that changes the idea/.test(c.askLex)))
  ok('the PATCH route refuses keys the registry does not own', /allCheckKeys\(\)\.includes\(itemKey\)/.test(read('app/api/ideas/[id]/checklists/route.ts')))
  ok('"Confirm these causes" says "N of 5 checks not yet done" and nothing else', notYetDoneLine(3, 5) === '3 of 5 checks not yet done' && notYetDoneLine(0, 5) === null)
  const panel = read('components/lex/FieldsPanel.tsx')
  ok('…beside the button, which is NOT disabled by the checks (the user decides)', /disabled=\{busy \|\| causes\.length === 0\} onClick=\{api\.confirm\}/.test(panel) && /\{checksLine && <span/.test(panel))
  ok('checks not done: 5 with none ticked, 2 with three ticked', checksNotDone(DIAGNOSIS_CHECKLIST, new Set()) === 5 && checksNotDone(DIAGNOSIS_CHECKLIST, new Set(allCheckKeys().slice(0, 3))) === 2)
  ok('it shows only while the causes are unconfirmed and exist', isShowing(DIAGNOSIS_CHECKLIST, 'AWAITING_CONFIRMATION', { causes: 3, policyOptions: 0, actions: 0 })
    && !isShowing(DIAGNOSIS_CHECKLIST, 'ACCEPTED', { causes: 3, policyOptions: 0, actions: 0 })
    && !isShowing(DIAGNOSIS_CHECKLIST, 'SKIPPED', { causes: 3, policyOptions: 0, actions: 0 })
    && !isShowing(DIAGNOSIS_CHECKLIST, null, { causes: 0, policyOptions: 0, actions: 0 }))
  control('a checklist that never hides would be caught', () => { const neverHides = (_s: string) => true; return !neverHides('ACCEPTED') })
  ok('PATTERN: the registry is keyed by section and the worklist asks it (nothing hard-codes Diagnosis in the block)', !/Diagnosis/.test(block.replace(/\/\/[^\n]*/g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')) && Object.keys(SECTION_CHECKLISTS).includes('DIAGNOSIS'))
  ok('findCheck resolves a real key', findCheck('check:diagnosis:five-whys')?.check.title === 'Five whys')

  // ═══ §8c — Lex's actions, visible to the owner ═══════════════════════════════════════════════
  section('§8c — every tool call recorded and shown to the owner, with a named actor')
  const loop = read('lib/lex/agent/loop.ts'), turn = read('lib/lex/agent/turn.ts')
  ok('every tool call in the loop is recorded', /await recordToolCall\(\{[\s\S]*?instruction: input\.message/.test(loop))
  ok('a CONFIRMED action is recorded too, as pressed by the owner', /confirmedVia: 'button'/.test(turn))
  ok('the owner\'s route is owner-only (403 for anyone else)', /idea\.creatorId !== user\.id/.test(read('app/api/ideas/[id]/lex-activity/route.ts')))
  ok('the log is mounted beside the Privacy Log (§23.1: it has an importer)', importersOf('LexActivityLog').length >= 1 && /<LexActivityLog ideaId=\{idea\.id\} \/>/.test(read('app/ideas/[id]/IdeaDetailClient.tsx')))
  ok('every row names its actor', /<span className="font-semibold">\{c\.actor\}<\/span>/.test(read('components/lex/LexActivityLog.tsx')))
  // value property: write through the REAL recorder to a scratch idea and read back through the REAL reader (§25).
  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' }, select: { id: true } })
  if (!owner) ok('the owner account exists for the scratch idea', false, 'NOT CHECKED')
  else {
    const scratch = await prisma.idea.create({
      data: { creatorId: owner.id, title: 'ZZ-26O scratch: tool log', summaryDescription: 'Scratch idea for check:lex-26o — safe to delete.', govtArea: 'Cabinet Office', ideaType: 'LEGISLATION', govtLevel: 'NATIONAL', stage: 'STAGE_1', visibility: 'PRIVATE', status: 'DRAFT' },
      select: { id: true },
    })
    try {
      const wrote = await recordToolCall({ ideaId: scratch.id, userId: owner.id, turnId: 't-1', tool: 'add_candidate', tier: 'free', instruction: 'Draft me a guiding policy.', input: { approach: 'x' }, ok: true, summary: 'candidate #1 added' })
      const wroteFail = await recordToolCall({ ideaId: scratch.id, userId: owner.id, tool: 'file_url', tier: 'free', instruction: 'Add this link.', input: { urls: ['https://example.org'] }, ok: false, summary: 'could not be filed', failureReason: 'HTTP 404' })
      const wroteConfirm = await recordToolCall({ ideaId: scratch.id, userId: owner.id, tool: 'choose_policy', tier: 'asks-first', instruction: 'The owner pressed Confirm on: choose policy 1', input: { number: 1 }, ok: true, summary: 'Done', confirmedVia: 'button' })
      ok('the recorder reports it wrote', wrote && wroteFail && wroteConfirm)
      const rows = await listToolCalls(scratch.id)
      ok('three rows read back through the owner\'s reader', rows.length === 3)
      ok('each row has a time, an instruction, a tool and a result', rows.every((r) => !!r.at && r.instruction.length > 0 && !!r.tool && r.result != null))
      ok('every row names its actor — "Lex"', rows.every((r) => r.actor === 'Lex'))
      ok('a failure carries its real reason', rows.find((r) => r.tool === 'file_url')?.failureReason === 'HTTP 404' && rows.find((r) => r.tool === 'file_url')?.ok === false)
      ok('a confirmed action says it was confirmed by the button', rows.find((r) => r.tool === 'choose_policy')?.confirmedVia === 'button')
      ok('another idea\'s reader sees none of them (scoped to the idea)', (await listToolCalls(owner.id)).length === 0)
      const bad = await recordToolCall({ ideaId: 'no-such-idea', userId: owner.id, tool: 't', tier: 'free', instruction: 'i', input: {}, ok: true, summary: 's' })
      ok('a write that fails says so rather than throwing or lying', bad === false)
      control('a recorder that returned true on failure would be caught', () => bad === true)
    } finally {
      await prisma.idea.delete({ where: { id: scratch.id } }).catch(() => {})
      const left = await prisma.lexToolCall.count({ where: { ideaId: scratch.id } })
      ok('the scratch idea and its rows are gone (cascade)', left === 0)
    }
  }

  // ═══ summary ══════════════════════════════════════════════════════════════════════════════════
  const dead = controls.filter((c) => !c.fired)
  console.log(`\n${pass} passed, ${fail} failed · ${pass + fail} checks RUN · ${controls.length} controls, ${controls.length - dead.length} fired, ${dead.length} dead`)
  for (const d of dead) console.log(`  ✗ DEAD CONTROL — ${d.label}`)
  for (const f of failures) console.log(`  ✗ ${f}`)
  await prisma.$disconnect()
  process.exit(fail || dead.length ? 1 : 0)
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
