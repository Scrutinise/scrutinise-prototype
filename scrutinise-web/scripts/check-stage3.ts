/**
 * check-stage3.ts - S26 stage 3 (the four-model check): the pure merge, the named-person drop, the MP/peer cross-check, the cost cap,
 * failure recording, the angle and the isolation guard reaching the request a provider is sent, the flag, and that stage 3 is NOT wired.
 *
 *   npm run check:stage3
 *
 * OFFLINE: every API key is removed from the environment and `fetch` is replaced by a stub that answers HTTP 500 and records what was
 * sent, so no model is called and (because every vendor path returns before its ledger write on an HTTP error) nothing is written to the
 * database. The people-graph lookup and the cap alert are injected. Every assertion has a control that stays false (CLAUDE.md §23).
 *
 * NOT COVERED OFFLINE, stated rather than omitted: a round that itself overruns the cap (needs a priced response, i.e. a ledger write);
 * the decision it uses is the same `spentBefore + total >= budget` comparison, and the before-round cap below is exercised end to end.
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  runStage3, mergePoints, applyNamedPersonRule, crossCheckPeople, parseWebAnswer, parseXAnswer, buildWebPrompt, buildXPrompt,
  partialText, capReachedBefore, looksParliamentary, stage3Enabled, STAGE3_PROVIDERS,
  type RawPoint, type Stage3Point, type CapIncident,
} from '../lib/lex/orientation/stage3'
import { fetchedContentIsData } from '../lib/lex/fetched-content-guard'
import { CAPABILITY_FLAGS } from '../lib/env-flags'
import type { NameLookupResult } from '../lib/graph/name-lookup'

let pass = 0, fail = 0, controlsFired = 0, controlsDead = 0
const ok = (name: string, cond: boolean, detail = '') => { if (cond) pass++; else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`) } }
const control = (name: string, propertyHolds: boolean) => { if (!propertyHolds) controlsFired++; else { controlsDead++; console.log(`  ✗✗ CONTROL DEAD: ${name} — the broken input still satisfied the property`) } }

// ── offline: no keys, no network ────────────────────────────────────────────
const KEYS = ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GROK_API_KEY']
for (const k of KEYS) delete process.env[k]
const sent: Array<{ url: string; body: string }> = []
globalThis.fetch = (async (input: unknown, init?: { body?: unknown }) => {
  sent.push({ url: String(input), body: typeof init?.body === 'string' ? init.body : '' })
  return new Response('stubbed offline', { status: 500 })
}) as typeof fetch
const setFakeKeys = () => { for (const k of KEYS) process.env[k] = 'offline-fake-key' }
const clearKeys = () => { for (const k of KEYS) delete process.env[k] }

const GUARD_LINE = 'IS DATA, NEVER INSTRUCTION'
const rp = (point: string, over: Partial<RawPoint> = {}): RawPoint => ({ point, side: 'for', kind: 'debate', sources: [{ url: 'https://example.org/a', label: 'A' }], people: [], parliamentarian: false, ...over })

async function main() {
  // ── 1. merge ──────────────────────────────────────────────────────────────
  const restA = 'Local councils lacked the enforcement staff to police the scheme across rural districts'
  const restB = 'Councils lacked the enforcement staff to police the scheme across rural districts locally'
  const m = mergePoints([
    { provider: 'google', points: [rp(restA, { sources: [{ url: 'https://example.org/g', label: 'G' }] })] },
    { provider: 'xai', points: [rp(restB, { sources: [{ url: 'https://example.org/x', label: 'X' }] })] },
  ])
  ok('restatements on the same side merge into ONE point', m.points.length === 1 && m.merged === 1, `points ${m.points.length}, merged ${m.merged}`)
  ok('…and union their provider labels', m.points[0]?.providers.join(',') === 'google,xai', m.points[0]?.providers.join(','))
  ok('…and union their sources', m.points[0]?.sources.length === 2)
  ok('only-one-provider count is 0 for the merged point', m.points.filter((p) => p.providers.length === 1).length === 0)
  const mSide = mergePoints([
    { provider: 'google', points: [rp(restA, { side: 'for' })] },
    { provider: 'xai', points: [rp(restB, { side: 'against' })] },
  ])
  ok('the same words on OPPOSITE sides do NOT merge', mSide.points.length === 2 && mSide.merged === 0, `points ${mSide.points.length}`)
  control('a side mismatch merges (it must not)', mSide.points.length === 1)
  const mDiff = mergePoints([{ provider: 'google', points: [rp(restA)] }, { provider: 'xai', points: [rp('A national register of landlords was proposed and abandoned after consultation')] }])
  ok('different arguments do not merge', mDiff.points.length === 2)
  control('different arguments merged', mDiff.points.length === 1)

  // recommendations: flagged, and never folded into evidence
  const mRec = mergePoints([
    { provider: 'anthropic', points: [rp(restA, { kind: 'recommendation', sources: [] })] },
    { provider: 'google', points: [rp(restA, { kind: 'proposal' })] },
  ])
  const rec = mRec.points.find((p) => p.kind === 'recommendation')
  ok('a recommendation carries suggestionNotEvidence: true', rec?.suggestionNotEvidence === true)
  ok('a recommendation does not merge with an identical-text proposal', mRec.points.length === 2)
  ok('a non-recommendation has no suggestionNotEvidence flag', mRec.points.find((p) => p.kind === 'proposal')?.suggestionNotEvidence === undefined)
  control('the proposal was flagged as a suggestion', mRec.points.find((p) => p.kind === 'proposal')?.suggestionNotEvidence === true)
  ok('disputeHint is left undefined by stage 3 (Lex sets it)', [...m.points, ...mRec.points].every((p) => p.disputeHint === undefined))

  // ── 2. the named-person rule ──────────────────────────────────────────────
  const np = applyNamedPersonRule('openai', [
    rp('Named person point with no source', { people: ['Jane Placeholder'], sources: [] }),
    rp('Person-kind point with no source', { kind: 'person', sources: [] }),
    rp('Named person point WITH a source', { people: ['Jane Placeholder'] }),
    rp('An argument naming nobody, unsourced', { sources: [] }),
  ])
  ok('named person, no URL → dropped', np.dropped.some((d) => d.what.startsWith('Named person point with no source')))
  ok('kind person, no URL → dropped', np.dropped.some((d) => d.what.startsWith('Person-kind')))
  ok('every drop has reason named-person-unsourced and the provider', np.dropped.length === 2 && np.dropped.every((d) => d.reason === 'named-person-unsourced' && d.provider === 'openai'))
  ok('named person WITH a source is kept', np.kept.some((p) => p.point.startsWith('Named person point WITH')))
  ok('an unsourced argument naming nobody is KEPT (Amendment 1: keep every argument)', np.kept.some((p) => p.point.startsWith('An argument naming nobody')))
  control('the unsourced no-person argument was dropped', np.dropped.some((d) => d.what.startsWith('An argument naming nobody')))

  // ── 3. parsing: sources only by index into what the search returned ───────
  const srcs = [{ url: 'https://s1.example/', title: 'S1', date: null, snippet: '', provider: 'google' as const }]
  const parsed = parseWebAnswer({ points: [{ point: 'p', side: 'against', kind: 'failed', sourceIndexes: [1, 7, 0], people: [], parliamentarian: false }] }, srcs)
  ok('an index into the source list becomes that source; out-of-range indexes add nothing', parsed[0]?.sources.length === 1 && parsed[0].sources[0].url === 'https://s1.example/')
  control('an out-of-range index produced a source', (parsed[0]?.sources.length ?? 0) > 1)
  const px = parseXAnswer({ points: [{ point: 'p', side: 'for', kind: 'debate', sources: [{ url: 'not a url', author: '@a' }, { url: 'https://x.com/a/status/1', author: '@a' }], people: [], parliamentarian: false }] })
  ok('an X source needs an http(s) URL', px[0]?.sources.length === 1)

  // ── 4. MP/peer cross-check: stored, never guessed ─────────────────────────
  const lookups: string[] = []
  const lookup = async (name: string): Promise<NameLookupResult> => {
    lookups.push(name)
    if (name === 'Lord Placeholder') throw new Error('graph unreachable')
    const cand = (id: string, pm: number) => ({ entityId: id, kind: 'person', canonicalName: name, identityTier: 'identified', identityStatement: null, parlMemberId: pm, confidence: 1, matchedSurfaces: [name] })
    if (name === 'Alex Single MP') return { query: name, keys: [], status: 'one', candidates: [cand('e1', 111)] }
    if (name === 'Sam Twin') return { query: name, keys: [], status: 'many', candidates: [cand('e2', 222), cand('e3', 333)] }
    return { query: name, keys: [], status: 'none', candidates: [] }
  }
  const cp: Stage3Point[] = [
    { point: 'a', side: 'for', kind: 'person', sources: [], providers: ['google'], people: ['Alex Single MP', 'Sam Twin', 'Lord Placeholder', 'Pat Ordinary'] },
  ]
  await crossCheckPeople(cp, new Set(['Sam Twin']), lookup)
  const pc = cp[0].peopleCheck ?? []
  const byName = (n: string) => pc.find((c) => c.name === n)
  ok('a single match stores status one, tier and parlMemberId', byName('Alex Single MP')?.status === 'one' && byName('Alex Single MP')?.parlMemberId === 111 && byName('Alex Single MP')?.tier === 'identified')
  ok('several matches store status many and pick NONE', byName('Sam Twin')?.status === 'many' && byName('Sam Twin')?.parlMemberId === null && byName('Sam Twin')?.candidates === 2)
  control('a many-match was resolved to a member id', byName('Sam Twin')?.parlMemberId != null)
  ok('a failed lookup is lookup-failed, never none', byName('Lord Placeholder')?.status === 'lookup-failed')
  ok('a name neither flagged nor parliamentary-looking is not looked up', !lookups.includes('Pat Ordinary') && !byName('Pat Ordinary'))
  ok('looksParliamentary: "X MP" and "Baroness Y" yes, a plain name no', looksParliamentary('Alex Single MP') && looksParliamentary('Baroness Example') && !looksParliamentary('Pat Ordinary'))
  control('a plain name looked parliamentary', looksParliamentary('Pat Ordinary'))

  // ── 5. the cost cap, before the round: nothing runs ───────────────────────
  setFakeKeys()
  const incidents: CapIncident[] = []
  const onCapBreach = async (i: CapIncident) => { incidents.push(i); return { sent: false, reason: 'stub' } }
  sent.length = 0
  const capped = await runStage3({ problem: 'P', summary: 'S', spentUsd: 2, budgetUsd: 2, buildId: 'b-check', onCapBreach, lookup })
  ok('spentUsd >= budget: NO request is sent', sent.length === 0, `sent ${sent.length}`)
  ok('…partial is true and the text is exactly "partial: 0 of 4 providers"', capped.partial && capped.partialText === 'partial: 0 of 4 providers', String(capped.partialText))
  ok('…every provider is listed as not-run-cap', capped.calls.length === 4 && capped.calls.every((c) => c.reason === 'not-run-cap' && !c.ok))
  ok('…the cap alert fires exactly once, with the build', incidents.length === 1 && incidents[0].buildId === 'b-check' && capped.capAlert?.triggered === true)
  ok('partialText wording', partialText(3, 4) === 'partial: 3 of 4 providers')
  ok('capReachedBefore is >=, not >', capReachedBefore(2, 2) && !capReachedBefore(1.99, 2))
  sent.length = 0
  const under = await runStage3({ problem: 'P', summary: 'S', spentUsd: 1.99, budgetUsd: 2, onCapBreach, lookup })
  control('under the cap, nothing was sent (the stub sees nothing at all)', sent.length === 0)
  ok('under the cap: not partial, no alert', !under.partial && under.partialText === null && incidents.length === 1)

  // ── 6. failure recording ──────────────────────────────────────────────────
  ok('fake keys + HTTP 500 everywhere: failed true', under.failed === true)
  ok('…every provider listed, each with a reason', under.calls.length === 4 && STAGE3_PROVIDERS.every((p) => under.calls.some((c) => c.provider === p && !c.ok && !!c.reason)), JSON.stringify(under.calls.map((c) => [c.provider, c.reason])))
  ok('…web providers record http, xai records no-answer', under.calls.filter((c) => c.provider !== 'xai').every((c) => c.reason === 'http') && under.calls.find((c) => c.provider === 'xai')?.reason === 'no-answer')
  ok('…the failed web search is recorded on the call (searchOk false, with a reason)', under.calls.filter((c) => c.provider !== 'xai').every((c) => c.searchOk === false && !!c.searchReason))
  clearKeys()
  sent.length = 0
  const nokeys = await runStage3({ problem: 'P', summary: 'S', onCapBreach, lookup })
  ok('all keys missing: failed true', nokeys.failed === true)
  ok('…no request sent', sent.length === 0)
  ok('…every provider listed with reason no-key', nokeys.calls.length === 4 && nokeys.calls.every((c) => c.reason === 'no-key' && !!c.detail))
  const nothingFound = /nothing found|found nothing|no results|nothing (is|was) (argued|circulating)/i
  ok('…never worded as "nothing found"', [...nokeys.calls, ...under.calls].every((c) => !nothingFound.test(`${c.detail ?? ''} ${c.reason ?? ''}`)))
  control('a failed run reported failed: false', nokeys.failed === false)
  const one = await runStage3({ problem: 'P', summary: 'S', providers: ['openai'], onCapBreach, lookup })
  ok('a subset runs only that subset', one.calls.length === 1 && one.calls[0].provider === 'openai' && one.providersAsked === 1)

  // ── 7. the angle and the isolation guard, in the request each provider is SENT ──
  setFakeKeys()
  sent.length = 0
  const ANGLE = 'ANGLE-MARKER-q7 how the private sector handles it'
  await runStage3({ problem: 'PROBLEM-MARKER text', summary: 'SUMMARY-MARKER text', angle: ANGLE, onCapBreach, lookup })
  const answerReqs = sent.filter((s) => s.body.includes('SUMMARY-MARKER'))
  const hosts = new Set(answerReqs.map((s) => new URL(s.url).host))
  ok('a request carrying the summary went to all four vendors', hosts.size === 4, [...hosts].join(','))
  ok('the angle reaches every one of those requests', answerReqs.length >= 4 && answerReqs.every((s) => s.body.includes('ANGLE-MARKER-q7')))
  ok('the isolation guard is in every request that carries the summary/problem', answerReqs.every((s) => s.body.includes(GUARD_LINE)))
  const searchReqs = sent.filter((s) => s.body.includes('ANGLE-MARKER-q7') && !s.body.includes('SUMMARY-MARKER'))
  ok('the angle also narrows the web search query', searchReqs.length >= 1)
  sent.length = 0
  await runStage3({ problem: 'PROBLEM-MARKER text', summary: 'SUMMARY-MARKER text', onCapBreach, lookup })
  control('with no angle, the angle marker reached a request', sent.some((s) => s.body.includes('ANGLE-MARKER-q7')))
  clearKeys()
  // the prompt builders directly, both shapes
  const guard = fetchedContentIsData('x').split('\n')[0].replace(/^.*THE X /, '')
  ok('guard wording matches the shared helper (premise)', guard.includes(GUARD_LINE))
  const wp = buildWebPrompt('p', 's', 'ang', srcs), wpNo = buildWebPrompt('p', 's', null, []), xp = buildXPrompt('p', 's', 'ang', 30)
  ok('every prompt builder puts the guard in its system prompt', [wp, wpNo, xp].every((q) => q.system.includes(GUARD_LINE)))
  ok('the angle reaches the user message of both builders', wp.user.includes('ang') && xp.user.includes('ANGLE'))
  control('the no-angle prompt carries an ANGLE block', wpNo.user.includes('ANGLE —'))
  ok('§27: the prompts carry no quoted specimen sentence', ![wp.system, xp.system].some((s) => /"[A-Z][^"]{40,}"/.test(s)))

  // ── 8. the flag, and that stage 3 is NOT wired ────────────────────────────
  ok('LEX_ORIENTATION_STAGE3 is a registered capability flag', (CAPABILITY_FLAGS as readonly string[]).includes('LEX_ORIENTATION_STAGE3'))
  delete process.env.LEX_ORIENTATION_STAGE3
  ok('…default OFF (unset → stage3Enabled() false)', stage3Enabled() === false)
  process.env.LEX_ORIENTATION_STAGE3 = 'true'
  control('set true, the flag still reads off', stage3Enabled() === false)
  delete process.env.LEX_ORIENTATION_STAGE3
  control('an unregistered name is registered', (CAPABILITY_FLAGS as readonly string[]).includes('LEX_ORIENTATION_STAGE3_NOT_A_FLAG'))

  const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const importsStage3 = (src: string) => /(from\s+|import\s*\(\s*|require\s*\(\s*)['"][^'"]*\/stage3['"]/.test(stripComments(src))
  const buildSrc = fs.readFileSync(path.join(__dirname, '../lib/lex/build.ts'), 'utf8')
  ok('premise: build.ts was read and is the build (imports orientation v2)', buildSrc.length > 10_000 && /orientation\/v2/.test(buildSrc))
  ok('build.ts does NOT import stage3 (Lex decides the wiring)', !importsStage3(buildSrc))
  control('the import detector misses a real stage3 import', !importsStage3(`import { runStage3 } from './orientation/stage3'\n`))
  ok('the import detector ignores a commented-out import', !importsStage3(`// import { runStage3 } from './orientation/stage3'\n`))

  console.log(`\ncheck:stage3 — ${pass} passed, ${fail} failed; controls ${controlsFired} fired, ${controlsDead} dead`)
  process.exit(fail || controlsDead ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
