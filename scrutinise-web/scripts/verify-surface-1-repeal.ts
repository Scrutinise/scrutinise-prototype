/**
 * verify-surface-1-repeal.ts — BRIEF_SURFACE_1 §3, verified through the product rather than the row.
 *
 * ⚠ "A row existing and a user seeing it are different claims." So this drives the REAL retrieval
 * path — the same `searchLegislationViaGateway` the Lex chat route calls — and prints exactly what
 * the panel would render and exactly what Lex would read. Then it asks a real model the question the
 * job exists to prevent getting wrong: *is this provision still current law?*
 *
 * ⚠ WHAT THIS IS NOT: a browser walk. Production deploys are Charlie's (the Vercel token is
 * SAML-blocked from here) and local Clerk is a dev instance, so the on-screen check is his. This
 * exercises every layer beneath the pixels, and the report says plainly which step is outstanding.
 *
 * Usage (from scrutinise-web):
 *   FTS_SEARCH_URL=https://fts-serve-production.up.railway.app \
 *     npx tsx --env-file=.env scripts/verify-surface-1-repeal.ts
 */
import { Client } from 'pg'
import { searchLegislationViaGateway } from '../lib/lex/gateway-legacy'
import {
  lookupRepeals, annotate, repealLabel, repealExplanation, repealPromptNote,
  REPEAL_PROMPT_INSTRUCTION, REPEAL_UNAVAILABLE_INSTRUCTION,
} from '../lib/lex/repeal-status'

export {}

let pass = 0
let fail = 0
const check = (ok: boolean, name: string, detail = '') => {
  if (ok) pass++; else fail++
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
}

async function askLex(prompt: string, question: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return '(no GEMINI_API_KEY — model check skipped)'
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: prompt }] },
      contents: [{ role: 'user', parts: [{ text: question }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
    }),
  })
  const j = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '(no answer)'
}

async function main() {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) throw new Error('NEON_DATABASE_URL / DATABASE_URL not set')
  const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await db.connect()

  try {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗')
    console.log('║  SURFACE 1 — VERIFIED THROUGH THE PRODUCT                                      ║')
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝')

    // ── the data, and the counts §4 asks for ────────────────────────────────────────────────
    const { rows: [c] } = await db.query<{ total: string; known: string }>(
      'SELECT COUNT(*)::text total, COUNT(repealed_by)::text known FROM section_repeals')
    console.log(`\n  repeal records: ${Number(c.total).toLocaleString('en-GB')} · with the repealing instrument: ${Number(c.known).toLocaleString('en-GB')}`)

    // ── pick real provisions for each of the three states ───────────────────────────────────
    const { rows: [known] } = await db.query<{ section_id: string; repealed_by: string; title: string | null }>(`
      SELECT r.section_id, r.repealed_by, cs."sectionTitle" title
      FROM section_repeals r JOIN corpus_sections cs ON cs.id = r.section_id
      WHERE r.repealed_by IS NOT NULL AND cs."sectionTitle" IS NOT NULL
      ORDER BY md5(r.section_id) LIMIT 1`)
    const { rows: [unknown] } = await db.query<{ section_id: string }>(`
      SELECT section_id FROM section_repeals WHERE repealed_by IS NULL ORDER BY md5(section_id) LIMIT 1`)
    const { rows: [clean] } = await db.query<{ id: string; t: string | null }>(`
      SELECT cs.id, cs."sectionTitle" t FROM corpus_sections cs
      WHERE cs.corpus = 'primary-acts-2000plus' AND cs."sectionTitle" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM section_repeals r WHERE r.section_id = cs.id)
      ORDER BY md5(cs.id) LIMIT 1`)

    console.log('\n── THE THREE STATES, each on a real provision ──')
    const { statuses, ok } = await lookupRepeals([known.section_id, unknown.section_id, clean.id])
    check(ok, 'the repeal lookup succeeded')

    // ⚠ THE MAP HOLDS ONLY REPEALED SECTIONS. Turning absence into the explicit `no-record` state
    // is `annotate`'s job, not the map's — and reading the map directly for state 3 was a bug in
    // THIS TEST, not in the product: it reported "(none)" for a provision the gateway correctly
    // labels "No repeal recorded". Exercise the same function the gateway uses.
    const [annKnown, annUnknown, annClean] = annotate(
      [{ id: known.section_id }, { id: unknown.section_id }, { id: clean.id }], statuses, ok)
    const a = annKnown.repeal
    const b = annUnknown.repeal
    const cst = annClean.repeal

    console.log(`\n  1. REPEALED, INSTRUMENT KNOWN   ${known.section_id}`)
    console.log(`     panel : ${a ? repealLabel(a) : '(none)'}`)
    console.log(`     prompt: ${a ? repealPromptNote(a) : '(none)'}`)
    check(a?.state === 'repealed-known', 'state is repealed-known')
    check(!!a && repealLabel(a).includes('REPEALED'), 'the panel says REPEALED plainly')
    check(!!a && (repealPromptNote(a) ?? '').includes('do NOT describe this as current law'),
      'what LEX READS forbids describing it as current')

    console.log(`\n  2. REPEALED, INSTRUMENT UNKNOWN ${unknown.section_id}`)
    console.log(`     panel : ${b ? repealLabel(b) : '(none)'}`)
    check(b?.state === 'repealed-unknown', 'state is repealed-unknown')
    check(!!b && repealLabel(b).includes('we do not know which instrument'),
      'it says plainly that we do not know by what')

    console.log(`\n  3. NO REPEAL RECORDED           ${clean.id}`)
    console.log(`     panel : ${cst ? repealLabel(cst) : '(none)'}`)
    console.log(`     detail: ${cst ? repealExplanation(cst) : '(none)'}`)
    check(cst?.state === 'no-record', 'state is no-record')
    check(!!cst && repealPromptNote(cst) === null, 'it adds NO line to the prompt (the instruction covers it)')

    // ⚠⚠ THE ASSERTION THE WHOLE JOB TURNS ON
    const thirdStateText = `${cst ? repealLabel(cst) : ''} ${cst ? repealExplanation(cst) : ''}`
    check(!/\bin force\b|\bstill current\b|\bremains? current\b/i.test(thirdStateText),
      '⚠ the third state NEVER says "in force" or "still current"',
      thirdStateText.slice(0, 90))
    check(/not the same as confirming/i.test(thirdStateText),
      'and it says explicitly that no record is not confirmation')

    // ── through the REAL retrieval path ─────────────────────────────────────────────────────
    console.log('\n── THROUGH THE REAL GATEWAY (the path the Lex chat route uses) ──')
    if (!process.env.FTS_SEARCH_URL) {
      console.log('  ⚠ FTS_SEARCH_URL not set — retrieval leg SKIPPED, not passed. Re-run with it set.')
    } else {
      const q = (known.title ?? '').split(/\s+/).slice(0, 6).join(' ')
      console.log(`  query: "${q}"`)
      const gw = await searchLegislationViaGateway({ q, limit: 8, intent: 'IDEA_CHAT_GROUNDING' })
      console.log(`  ${gw.results.length} results, failed=${gw.failed}`)
      const withStatus = gw.results.filter((r) => r.repeal).length
      const repealed = gw.results.filter((r) => r.repeal && r.repeal.state !== 'no-record')
      check(gw.results.length === 0 || withStatus === gw.results.length,
        'EVERY result from the gateway carries a repeal status', `${withStatus}/${gw.results.length}`)
      console.log(`  repealed among them: ${repealed.length}`)
      for (const r of gw.results.slice(0, 6)) {
        console.log(`    ${r.repeal ? repealLabel(r.repeal).slice(0, 46).padEnd(46) : '(no status)'.padEnd(46)} ${r.actTitle.slice(0, 40)} s.${r.sectionNumber}`)
      }
      check(gw.results.every((r) => r.repealNote !== undefined),
        'every result carries the prompt note field (null is a value, undefined is a bug)')
    }

    // ── ⚠ THE TEST THAT MATTERS: ask Lex directly ───────────────────────────────────────────
    console.log('\n── ⚠ ASKING A REAL MODEL WHETHER THE REPEALED PROVISION IS CURRENT LAW ──')
    const label = `${known.title} [id: ${known.section_id.split(':')[1] ?? ''}]`
    const promptWith = `LEGISLATION CANDIDATES:\n- ${label}  ${a ? repealPromptNote(a) : ''}\n\n${REPEAL_PROMPT_INSTRUCTION}`
    const promptWithout = `LEGISLATION CANDIDATES:\n- ${label}\n`
    const question = `Is ${known.title} still current law? Answer in two sentences.`

    const before = await askLex(promptWithout, question)
    const after = await askLex(promptWith, question)
    console.log(`\n  WITHOUT the status (what the platform did until today):\n    ${before.replace(/\s+/g, ' ').slice(0, 300)}`)
    console.log(`\n  WITH the status:\n    ${after.replace(/\s+/g, ' ').slice(0, 300)}`)
    const saysRepealed = /repeal/i.test(after)
    check(saysRepealed, '⚠ WITH the status, the model says the provision is REPEALED',
      saysRepealed ? '' : 'IT DID NOT — the prompt note is not doing its job')
    check(!/\bis (still )?(in force|current)\b/i.test(after),
      'and it does not assert the provision is in force')

    // ── the unavailable path ────────────────────────────────────────────────────────────────
    const unavailable = await askLex(`LEGISLATION CANDIDATES:\n- ${label}\n\n${REPEAL_UNAVAILABLE_INSTRUCTION}`, question)
    console.log(`\n  On the path where status could NOT be checked:\n    ${unavailable.replace(/\s+/g, ' ').slice(0, 260)}`)
    check(/cannot confirm|could not|unable to confirm|not able to confirm/i.test(unavailable),
      'the unavailable-path instruction makes the model decline to confirm currency')

    console.log(`\n════ ${fail ? `${fail} FAILED` : `all ${pass} checks pass`} ════`)
    if (fail) process.exitCode = 1
  } finally { await db.end() }
}
main().catch((e) => { console.error('[verify-surface-1] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
