/**
 * measure-s5-lex-scope.ts — BRIEF_SEARCH_S5 §3. Before and after, on the same questions.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A PERMANENT COMPARISON AND NOT A BEFORE-AND-AFTER
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * A temporal before/after stops being runnable the moment the change ships: the "before" is gone,
 * and any later re-measurement compares the new code against a number in a document. So the old
 * arm is kept ALIVE — `searchLegislationViaGateway` is untouched (POST /api/search and the
 * legislation panel still use it, and S4 measured that scope as correct) — and both arms are
 * called side by side, today and in six months.
 *
 * ⚠ THE RUN ORDER IS REVERSED, because §3 says so and because a cache-warming artefact has
 * already misled one measurement in this project. Arm B runs first on the odd-numbered questions
 * and arm A first on the even-numbered ones, so neither arm systematically gets the warm cache.
 * `--same-order` disables that, for confirming the artefact exists at all.
 *
 * ⚠ WHAT THIS DOES NOT MEASURE. The answers Lex actually writes. §3 asks for "what the answer
 * says" and that needs a real model call per question per arm; `--answers` does it and costs
 * about a penny a question. Retrieval is measured on every run because it is free and
 * deterministic; the answers are measured when asked for, and the report says which was run.
 *
 * Usage (from scrutinise-web):
 *   FTS_SEARCH_URL=https://fts-serve-production.up.railway.app \
 *   LEX_VECTOR_STREAMS=legislation,debates,committees,caselaw,guidance \
 *   LEX_QUERY_ROUTER=true \
 *     npx tsx --env-file=.env scripts/measure-s5-lex-scope.ts
 *   ... --answers        # also generate and print a real Lex answer per arm
 *   ... --same-order     # do NOT alternate; for demonstrating the cache artefact
 */
import { searchLegislationViaGateway } from '../lib/lex/gateway-legacy'
import { retrieveForChat, evidenceBlock, gapNote, type ChatRetrieval } from '../lib/lex/chat-retrieval'
import { resolvedConfigLine, assertRetrievalConfig } from '../lib/lex/harness-preflight'

export {}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const LIMIT = 10

/** ⚠ THE SAME TEN QUESTIONS S4 AUDITED, verbatim, so the two sprints are comparable. */
const PROBES: Array<{ q: string; expect: string; shape: 'legislation' | 'not-legislation' }> = [
  { q: 'companies act 2006 directors duties', expect: 'the Act itself', shape: 'legislation' },
  { q: 'data protection lawful basis for processing personal data', expect: 'UK GDPR / DPA 2018', shape: 'legislation' },
  { q: 'equality act public sector equality duty', expect: 'EA 2010 s.149', shape: 'legislation' },
  { q: 'what have select committees said about water company sewage discharge', expect: 'committee evidence and reports', shape: 'not-legislation' },
  { q: 'what did MPs argue in the debate on assisted dying', expect: 'Hansard', shape: 'not-legislation' },
  { q: 'how have the courts interpreted the duty to make reasonable adjustments', expect: 'case law', shape: 'not-legislation' },
  { q: 'government guidance on procurement social value', expect: 'guidance', shape: 'not-legislation' },
  { q: 'what evidence did witnesses give on leasehold reform', expect: 'committee evidence', shape: 'not-legislation' },
  { q: 'has parliament scrutinised the rollout of universal credit', expect: 'committees and Hansard', shape: 'not-legislation' },
  { q: 'what was said about buy now pay later regulation in parliament', expect: 'Hansard and committees', shape: 'not-legislation' },
]

const pct = (a: number, b: number) => (b === 0 ? '—' : `${((100 * a) / b).toFixed(0)}%`)

function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}

interface ArmRow { ms: number; nLeg: number; nEvi: number; kinds: string }

/** The legislation material arm A would have put in the prompt — used only by --answers. */
async function armBeforeMaterial(q: string) {
  const out = await searchLegislationViaGateway({ q, limit: 5, intent: 'IDEA_CHAT_GROUNDING' })
  return out.results
}

/**
 * One Lex-shaped answer. ⚠ The instruction block is IDENTICAL in both arms, including the
 * never-claim rule, so the comparison isolates the material rather than the wording.
 */
async function answer(question: string, material: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return '(no GEMINI_API_KEY — answers not generated)'
  const system = 'You are Lex, a UK policy assistant. Answer the user using ONLY the material '
    + 'below. Say what kind of source each point comes from. If the material does not contain what '
    + 'the user asked for, say so plainly and specifically — name what you looked for and could not '
    + 'find. NEVER answer from your own general knowledge and present it as though it came from our '
    + 'sources. Four sentences maximum.'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: `QUESTION: ${question}

${material}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
      }),
    })
  if (!res.ok) return `(HTTP ${res.status})`
  const data = await res.json() as { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }> }
  const c = data.candidates?.[0]
  // §18 — name truncation as truncation rather than letting it read as a short answer.
  if (c?.finishReason === 'MAX_TOKENS') return '(TRUNCATED at maxOutputTokens — not a short answer)'
  return c?.content?.parts?.[0]?.text?.trim() ?? '(no text)'
}

async function armBefore(q: string): Promise<ArmRow> {
  const t = Date.now()
  const out = await searchLegislationViaGateway({ q, limit: LIMIT, intent: 'IDEA_CHAT_GROUNDING' })
  return { ms: Date.now() - t, nLeg: out.results.length, nEvi: 0, kinds: '(legislation only)' }
}

async function armAfter(q: string): Promise<ArmRow & { r: ChatRetrieval }> {
  const t = Date.now()
  const r = await retrieveForChat({ query: q, limit: LIMIT })
  const m = new Map<string, number>()
  for (const e of r.evidence) m.set(e.kindLabel, (m.get(e.kindLabel) ?? 0) + 1)
  const kinds = [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}×${n}`).join(' ') || '(none)'
  return { ms: Date.now() - t, nLeg: r.legislation.length, nEvi: r.evidence.length, kinds, r }
}

async function main() {
  console.log('\n════ SEARCH S5 §3 — LEX CONVERSATION SCOPE, BEFORE AND AFTER ════')
  console.log(`  ${resolvedConfigLine()}`)
  assertRetrievalConfig('measure-s5-lex-scope')
  console.log(`  ⚠ run order ${flag('same-order') ? 'FIXED (cache artefact NOT controlled)' : 'ALTERNATES per question — neither arm gets the warm cache systematically'}`)
  console.log(`  arm A = searchLegislationViaGateway (today's chat path, tier + type filter)`)
  console.log(`  arm B = retrieveForChat (routed, two channels)\n`)

  const beforeMs: number[] = []
  const afterMs: number[] = []
  let legOnlyTotal = 0
  let afterLegTotal = 0
  let afterEviTotal = 0
  const unhandled = new Set<string>()
  const rows: Array<{ p: typeof PROBES[number]; a: ArmRow; b: ArmRow & { r: ChatRetrieval } }> = []

  for (let i = 0; i < PROBES.length; i++) {
    const p = PROBES[i]
    // ⚠ ALTERNATING ORDER. A cache-warming artefact already misled one measurement here.
    const bFirst = !flag('same-order') && i % 2 === 1
    let a: ArmRow; let b: ArmRow & { r: ChatRetrieval }
    if (bFirst) { b = await armAfter(p.q); a = await armBefore(p.q) }
    else { a = await armBefore(p.q); b = await armAfter(p.q) }

    beforeMs.push(a.ms); afterMs.push(b.ms)
    legOnlyTotal += a.nLeg; afterLegTotal += b.nLeg; afterEviTotal += b.nEvi
    for (const u of b.r.unhandled) unhandled.add(u)
    rows.push({ p, a, b })

    console.log(`── ${p.q}`)
    console.log(`   expects: ${p.expect}   [${p.shape}]${bFirst ? '   (arm B ran first)' : ''}`)
    console.log(`   A  ${String(a.nLeg).padStart(2)} legislation, 0 evidence            ${String(a.ms).padStart(5)}ms`)
    console.log(`   B  ${String(b.nLeg).padStart(2)} legislation, ${String(b.nEvi).padStart(2)} evidence   ${b.kinds}`)
    console.log(`      ${String(b.ms).padStart(5)}ms   streams: ${b.r.routedStreams?.join(',') ?? '(unrouted)'}`)
    const gap = gapNote(b.r)
    if (gap) console.log(`      ⚠ gap note that would go to Lex: ${gap.slice(0, 120)}…`)
    console.log()
  }

  console.log('════ TOTALS ════')
  console.log(`  arm A  legislation ${legOnlyTotal}   evidence 0`)
  console.log(`  arm B  legislation ${afterLegTotal}   evidence ${afterEviTotal}`)
  console.log(`  ⚠ documents the conversation could not previously reach: ${afterEviTotal}`)
  const notLeg = rows.filter((r) => r.p.shape === 'not-legislation')
  const nowServed = notLeg.filter((r) => r.b.nEvi > 0).length
  console.log(`  of the ${notLeg.length} questions that are NOT about legislation, ${nowServed} now return some — ${pct(nowServed, notLeg.length)}`)
  const legShape = rows.filter((r) => r.p.shape === 'legislation')
  const legHeld = legShape.filter((r) => r.b.nLeg >= Math.min(3, r.a.nLeg)).length
  console.log(`  ⚠ REGRESSION CHECK — of the ${legShape.length} legislation-shaped questions, ${legHeld} still return legislation in arm B`)
  console.log(`     (a widening that costs legislation recall on legislation questions is a regression, not a fix)`)

  console.log('\n  latency')
  console.log(`    arm A  p50 ${percentile(beforeMs, 50)}ms   p95 ${percentile(beforeMs, 95)}ms`)
  console.log(`    arm B  p50 ${percentile(afterMs, 50)}ms   p95 ${percentile(afterMs, 95)}ms`)
  console.log(`    ⚠ arm B searches more streams, so slower is expected. The question is whether it is`)
  console.log(`      acceptable, not whether it is zero.`)

  if (unhandled.size) {
    console.log(`\n  ⚠⚠ DISPLAY TYPES IN NEITHER CHANNEL: ${[...unhandled].join(', ')}`)
    console.log(`     Add them to EVIDENCE_KINDS in chat-retrieval.ts — until then they are dropped.`)
  } else {
    console.log('\n  ✓ every display type returned landed in one of the two channels')
  }

  // ── §3: WHAT THE ANSWER SAYS ────────────────────────────────────────────────────────────────
  // ⚠ A REAL MODEL CALL PER ARM. More sources is not the same as a better answer, and the brief
  // says to read a handful by hand before declaring an improvement. The two prompts differ ONLY
  // in what material they carry — same question, same instructions — so any difference in the
  // answers is attributable to the retrieval change and to nothing else.
  if (flag('answers')) {
    const targets = rows.filter((r) => r.p.shape === 'not-legislation').slice(0, 4)
    const fmtLeg = (rs: Array<{ actTitle: string; sectionNumber: string; snippet: string }>) =>
      rs.length ? rs.map((r) => `- ${r.actTitle} (s.${r.sectionNumber})\n    "${r.snippet.slice(0, 200)}"`).join('\n') : 'none'
    const indent = (t: string) => t.split('\n').map((l) => '  ' + l).join('\n')
    for (const t of targets) {
      console.log(`\n════ ANSWERS — "${t.p.q}" ════`)
      const aAns = await answer(t.p.q, `LEGISLATION FROM OUR CORPUS:\n${fmtLeg(await armBeforeMaterial(t.p.q))}`)
      const bAns = await answer(t.p.q,
        `LEGISLATION FROM OUR CORPUS:\n${fmtLeg(t.b.r.legislation)}\n\n`
        + `=== OTHER EVIDENCE FROM OUR CORPUS (NOT legislation) ===\n${evidenceBlock(t.b.r.evidence) ?? 'none'}`)
      console.log(`\n  ── A (legislation only) ──\n${indent(aAns.slice(0, 900))}`)
      console.log(`\n  ── B (two channels) ──\n${indent(bAns.slice(0, 900))}`)
    }
  }

  // ⚠ Show one full evidence block, because a count is not a rendering. §3: "Read a handful of the
  // new answers by hand before declaring it an improvement — more sources is not the same as a
  // better answer." This is the material those answers would be built from.
  const example = rows.find((r) => r.b.nEvi > 0)
  if (example) {
    console.log(`\n════ WHAT LEX WOULD ACTUALLY READ — "${example.p.q}" ════`)
    console.log(evidenceBlock(example.b.r.evidence)?.slice(0, 1800))
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
