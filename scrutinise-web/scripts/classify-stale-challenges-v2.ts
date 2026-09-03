import { prisma } from '../lib/prisma'
import { callModelJson } from '../lib/lex/model-call'
import { priceBuild, formatSpend } from '../lib/lex/build-cost'
import { buildProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { writeFileSync } from 'fs'

// ─────────────────────────────────────────────────────────────────────────────────────────
// 25-X §3 (DECISIONS 54 + 58) — THE SAME 178 CRITICISMS, AT A TIGHTER BAR.
//
// 25-W's pass retired 119 of 178 as duplicates. Charlie: ⚠ *"119 is a great deal of criticism
// to retire on 'plausible'. The challenges are the sharpest thing the platform produces; a real
// one lost to a loose match costs more than a duplicate left in."*
//
// Three changes, and each is a category the first pass did not have:
//
//   §3a DUPLICATE IS NOW A POINT-LEVEL MATCH. The first pass accepted a TOPIC match —
//       "Statutory individual legal duties" retired under "Interaction with the Constitutional
//       Reform Act", which is the same area of law and not the same objection.
//   §3b POSSIBLY_DUPLICATE is the new home for exactly that: topic without point. It stays
//       VISIBLE and marked, rather than being archived on a maybe.
//   §3c AN ASSESSMENT IS NOT A CRITICISM. Two of the six SUPERSEDED rows read in 25-W were
//       older POSITIVE judgements — "the sequencing is logical" — which the current set
//       contradicts. That is a superseded ASSESSMENT, not a criticism aimed at deleted text,
//       and archiving it as one would file a compliment as a retired complaint.
//
// ⚠⚠ IT WRITES NOTHING. The counts go to a report and Charlie reads them against the old ones
// before `apply-challenge-cleanup.ts` touches a row. There is no --write here.
//
// ⚠ §27 — the prompt describes the SHAPE of each judgement and quotes no specimen criticism.
//
// Usage: npx tsx --env-file=.env scripts/classify-stale-challenges-v2.ts [ideaId]
// ─────────────────────────────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const IDEA = process.argv.slice(2).find((a) => UUID.test(a)) ?? '452c5ade-3153-400a-bf48-3b71aaa52773'
const MODEL = 'gemini-2.5-flash'
const BATCH = 10
const OUT = '../docs/25X_CHALLENGE_CLASSIFICATION.md'
const PLAN = '../docs/25X_CHALLENGE_PLAN.json'

/**
 * ⚠ THE 25-W FIGURES, QUOTED FROM `docs/25W_CHALLENGE_CLASSIFICATION.md` SO THE EFFECT OF THE
 * TIGHTER BAR IS VISIBLE (§3e). They are a historical measurement, not a live one — nothing
 * recomputes them, and if they are ever re-derived they will differ, because that pass is gone.
 */
const OLD = { DUPLICATE: 119, APPLICABLE: 43, SUPERSEDED: 16, UNDECIDED: 0 }

type Verdict = 'DUPLICATE' | 'POSSIBLY_DUPLICATE' | 'APPLICABLE' | 'SUPERSEDED' | 'ASSESSMENT' | 'UNDECIDED'

const SYSTEM = [
  'You are auditing the criticisms made of a policy proposal over nine successive drafts.',
  'The proposal has been rewritten repeatedly. You are given THE DRAFT AS IT NOW STANDS, then',
  'THE CRITICISMS RAISED AGAINST THE CURRENT DRAFT, then numbered OLDER CRITICISMS.',
  '',
  'For each older item decide ONE of:',
  '',
  '  DUPLICATE          — a current criticism makes THE SAME POINT. Not the same topic: the',
  '                       same objection. The test is whether answering the current one would',
  '                       also answer this one. If it would not, it is not a duplicate.',
  '                       Name the current criticism by its number.',
  '  POSSIBLY_DUPLICATE — a current criticism is about the same thing but objects to a',
  '                       different aspect of it, or is broader or narrower, so answering it',
  '                       might leave this point standing. Name the current criticism.',
  '                       ⚠ Use this whenever you would have to argue for DUPLICATE. It is the',
  '                       honest verdict for a close call and it costs nothing: the criticism',
  '                       stays visible either way.',
  '  APPLICABLE         — no current criticism makes this point, and it still bites: the thing',
  '                       it objects to is still in the proposal.',
  '  SUPERSEDED         — it is a criticism, no current criticism makes the point, and what it',
  '                       attacks is no longer in the proposal — the mechanism, body, power,',
  '                       duty or wording has been removed or replaced. Say what is gone.',
  '  ASSESSMENT         — it is NOT a criticism at all. It is a judgement about the proposal',
  '                       being sound, coherent, well sequenced or adequate — praise, or a',
  '                       finding of no problem. Say so plainly. Do not try to fit it to one of',
  '                       the categories above; a positive judgement that later work contradicts',
  '                       is not a retired complaint and must not be filed as one.',
  '  UNDECIDED          — you cannot tell. Use it rather than guessing.',
  '',
  'The rules that decide the hard cases:',
  '  · SAME SUBJECT AREA IS NOT SAME POINT. Two criticisms can both be about a regulator\'s',
  '    powers and object to entirely different things about them. Ask what each one WANTS.',
  '  · Being differently worded from every current criticism does not make it APPLICABLE.',
  '  · Being aimed at an earlier draft does not make it SUPERSEDED. Most of the proposal',
  '    survives from draft to draft; ask whether the thing it objects to is still there.',
  '  · A criticism of a general weakness the proposal still has is APPLICABLE even if the',
  '    sentence it quoted has been rewritten.',
  '  · Never soften, sharpen or reinterpret a criticism to make it fit a category.',
  '',
  'Give a reason of at most 25 words for every verdict. DUPLICATE and POSSIBLY_DUPLICATE',
  'require `duplicateOf`. SUPERSEDED must name what is no longer in the proposal.',
  'Return one entry per numbered older item. Every number must appear exactly once.',
].join('\n')

const SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer' },
          verdict: {
            type: 'string',
            enum: ['DUPLICATE', 'POSSIBLY_DUPLICATE', 'APPLICABLE', 'SUPERSEDED', 'ASSESSMENT', 'UNDECIDED'],
          },
          duplicateOf: { type: 'integer' },
          reason: { type: 'string' },
        },
        required: ['n', 'verdict', 'reason'],
      },
    },
  },
  required: ['verdicts'],
}

// ══ ⚠⚠ 25-Y §2b — THE MERGE PROMPT AT THE SAME POINT-LEVEL BAR AS THE DUPLICATE PROMPT ══════
//
// 25-X tightened DUPLICATE and left this one alone, and the fault simply moved: the merge pass
// returned a group of EIGHT under "these all require legislative changes" — objections about
// the Constitutional Reform Act, the Civil Service Commission, the NAO's mandate, civil service
// terms, a new board's legal basis, public reporting and the Government Legal Department. Same
// subject area; seven different objections about seven different bodies. And a second group of
// five under "these all want more evidence", which describes what a criticism IS.
//
// ⚠ The single test below — WOULD ONE ANSWER SATISFY ALL OF THEM — is the merge equivalent of
// the duplicate prompt's "would answering the current one also answer this one". It is stated
// as a test the model must apply to each pair, rather than as an adjective, because "the same
// point" is exactly the phrase both loose groups would have claimed to satisfy.
const MERGE_SYSTEM = [
  'You are given the criticisms raised against the current draft of a policy proposal, each',
  'numbered. Find the groups that make the SAME POINT in different words.',
  '',
  'THE TEST, and apply it to every pair in a group before you return it:',
  '  Could ONE answer satisfy both of them completely?',
  'If a single fix, sentence or piece of evidence would close both, they are a group. If',
  'answering one would leave the other still standing, they are NOT — however similar they look',
  'and however much subject matter they share.',
  '',
  'What is NOT a group, stated because these are the mistakes actually made:',
  '  · SAME AREA OF LAW OR POLICY. Objections about different bodies, powers, duties or',
  '    instruments are different objections even when all of them concern one statute or one',
  '    reform. Amending body A and amending body B are two pieces of work, not one.',
  '  · SAME KIND OF COMPLAINT. "These all ask for more evidence", "these all want more detail",',
  '    "these all say something is missing" describe what a criticism IS. Every criticism asks',
  '    for something. That is not a shared point.',
  '  · SAME STAGE OR SECTION of the proposal.',
  '  · A GENERAL one and a SPECIFIC one. If a group needs a heading broader than any criticism',
  '    in it, you have found a topic and not a point.',
  '',
  'A pair is the normal size of a group. A group of four should be rare, and you should be able',
  'to state the one answer that closes all four. A group of eight is almost certainly a topic.',
  '',
  'Return only genuine groups. Returning none is a valid and common answer; inventing groups to',
  'look productive merges distinct objections and loses one of them for good — and a criticism',
  'lost to a loose match costs far more than a duplicate left in.',
  '',
  'For each group give the numbers and, as the reason, THE ONE ANSWER that would close all of',
  'them, in at most 25 words. If you cannot write that sentence, it is not a group.',
].join('\n')

const MERGE_SCHEMA = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: { members: { type: 'array', items: { type: 'integer' } }, reason: { type: 'string' } },
        required: ['members', 'reason'],
      },
    },
  },
  required: ['groups'],
}

function draftText(s: Awaited<ReturnType<typeof buildProposalSnapshot>>): string {
  const out: string[] = [`TITLE: ${s.title}`]
  if (s.summaryDescription) out.push(`SUMMARY: ${s.summaryDescription}`)
  for (const f of s.fields) {
    const v = typeof f.value === 'string'
      ? f.value.trim()
      : f.slots.filter((sl) => sl.value?.trim()).map((sl) => `${sl.label}: ${sl.value.trim()}`).join('; ')
    if (v) out.push(`${f.label} [${f.status}]: ${v}`)
  }
  if (s.causes.length) {
    out.push('CAUSES:')
    for (const c of s.causes) out.push(`  - ${c.cause}${c.isRootCause ? ' [ROOT CAUSE]' : ''}`)
  }
  if (s.options.length) {
    out.push('POLICY OPTIONS UNDER CONSIDERATION:')
    for (const o of s.options) out.push(`  - ${o.approach}${o.status === 'RULED_OUT' ? ` [RULED OUT: ${o.ruleOutReason ?? 'no reason'}]` : ''}`)
  }
  if (s.actions.length) {
    out.push('ACTIONS:')
    for (const a of s.actions) out.push(`  - ${a.practicalStep}${a.wording ? ` (wording: ${a.wording})` : ''}`)
  }
  return out.join('\n')
}

const oneLine = (t: string) => t.replace(/\s+/g, ' ').trim()

/**
 * ⚠ 25-Y §2b — RE-RUN THE MERGE PASS ALONE, over the SAME 47 the first run saw.
 *
 * The 178 verdicts are already applied and re-running them would cost 6p to reproduce work
 * that is done. What §2b asks for is the merge pass at the tightened bar, compared against
 * the old result — so the comparison is made over the ORIGINAL v9 set regardless of what has
 * since been merged away, because comparing against a set the first run never saw would not
 * be a comparison at all.
 */
async function mergeOnly() {
  const snapshot = await buildProposalSnapshot(IDEA)
  const draft = draftText(snapshot)
  const rows = await prisma.deepeningIssue.findMany({
    where: { ideaId: IDEA },
    select: { id: true, runVersion: true, title: true, text: true, status: true, relationKind: true },
    orderBy: [{ runVersion: 'asc' }, { createdAt: 'asc' }],
  })
  const currentVersion = Math.max(...rows.map((r) => r.runVersion))
  const current = rows.filter((r) => r.runVersion === currentVersion)
  const currentList = current
    .map((r, i) => `C${i + 1}. ${r.title ? `[${r.title}] ` : ''}${oneLine(r.text).slice(0, 400)}`)
    .join('\n')

  console.log(`\nre-running the MERGE pass alone over the original v${currentVersion} set (${current.length})`)
  const res = await callModelJson<{ groups?: Array<{ members?: number[]; reason?: string }> }>({
    model: MODEL, system: MERGE_SYSTEM,
    user: `=== THE DRAFT AS IT NOW STANDS ===\n${draft}\n\n=== CRITICISMS (${current.length}) ===\n${currentList}`,
    schema: MERGE_SCHEMA, maxOutputTokens: 3000, timeoutMs: 180_000, temperature: 0.1,
    label: '25y-merge-tightened', stream: 'lex', pass: 'MERGE_TIGHTENED',
  })
  const price = priceBuild([{ model: MODEL, tokensIn: res.usage.tokensIn, tokensOut: res.usage.tokensOut }])
  if (!res.ok) {
    const fail = res as { reason: string; detail: string }
    console.error(`FAILED: ${fail.reason} — ${fail.detail}`)
    return
  }
  const groups: Array<{ members: number[]; reason: string }> = []
  for (const g of res.value.groups ?? []) {
    const members = (g.members ?? []).filter((m) => Number.isInteger(m) && m >= 1 && m <= current.length)
    if (new Set(members).size >= 2) groups.push({ members: [...new Set(members)], reason: oneLine(String(g.reason ?? '')) })
  }
  const covered = groups.reduce((a, g) => a + g.members.length, 0)
  const biggest = groups.reduce((a, g) => Math.max(a, g.members.length), 0)

  console.log(`\n-- 2b: new against old --`)
  console.log(`  25-W (first run, loose)    : 7 groups, 18 covered, biggest 4`)
  console.log(`  25-X (re-run, still loose) : 9 groups, 32 covered, biggest 8`)
  console.log(`  25-Y (tightened)           : ${groups.length} groups, ${covered} covered, biggest ${biggest}`)
  console.log(`\n  cost: ${formatSpend(price)}`)
  console.log(`\n-- the groups it now returns --`)
  const applied = new Set(rows.filter((r) => r.relationKind === 'MERGED_INTO').map((r) => r.id))
  for (const g of groups) {
    console.log(`\n  ONE ANSWER: ${g.reason}`)
    for (const m of g.members) {
      const c = current[m - 1]
      console.log(`    C${m} ${applied.has(c.id) ? '[already merged]' : '[still separate]'} ${c.title ?? oneLine(c.text).slice(0, 70)}`)
    }
  }
  const big = groups.find((g) => g.members.length >= 6)
  console.log(`\n  a group of six or more: ${big ? `STILL PRESENT (${big.members.length}) - ${big.reason}` : 'none'}`)
  writeFileSync('../docs/25Y_MERGE_RERUN.json', JSON.stringify({
    generatedAt: new Date().toISOString(), model: MODEL, spend: formatSpend(price),
    currentVersion, setSize: current.length,
    groups: groups.map((g) => ({
      reason: g.reason,
      members: g.members.map((m) => ({
        n: m, id: current[m - 1].id, title: current[m - 1].title,
        alreadyMerged: applied.has(current[m - 1].id),
      })),
    })),
  }, null, 2), 'utf8')
  console.log('\n  written to ../docs/25Y_MERGE_RERUN.json - nothing was written to the database.')
}

async function main() {
  if (process.argv.includes('--merge-only')) return mergeOnly()
  // ⚠ Prove the output paths before spending anything — 25-W's first run made eighteen paid
  // calls and then died writing its report to a directory that did not exist.
  writeFileSync(OUT, '(this run has not finished)\n', 'utf8')
  writeFileSync(PLAN, '{}\n', 'utf8')

  const snapshot = await buildProposalSnapshot(IDEA)
  const draft = draftText(snapshot)

  const rows = await prisma.deepeningIssue.findMany({
    where: { ideaId: IDEA },
    select: { id: true, runVersion: true, passKey: true, title: true, text: true, status: true },
    orderBy: [{ runVersion: 'asc' }, { createdAt: 'asc' }],
  })
  const currentVersion = Math.max(...rows.map((r) => r.runVersion))
  const current = rows.filter((r) => r.runVersion === currentVersion)
  const older = rows.filter((r) => r.runVersion !== currentVersion)

  console.log(`\nidea ${IDEA} — ${rows.length} challenges; current v${currentVersion}: ${current.length}; earlier: ${older.length}`)

  const currentList = current
    .map((r, i) => `C${i + 1}. ${r.title ? `[${r.title}] ` : ''}${oneLine(r.text).slice(0, 400)}`)
    .join('\n')

  let tokensIn = 0, tokensOut = 0
  const verdicts = new Map<string, { verdict: Verdict; reason: string; duplicateOf: string | null }>()

  for (let i = 0; i < older.length; i += BATCH) {
    const batch = older.slice(i, i + BATCH)
    const user = [
      '=== THE DRAFT AS IT NOW STANDS ===', draft, '',
      `=== CRITICISMS RAISED AGAINST THE CURRENT DRAFT (${current.length}) ===`, currentList, '',
      `=== OLDER ITEMS TO CLASSIFY (${batch.length}) ===`,
      batch.map((r, j) => `${j + 1}. (raised against draft ${r.runVersion}) ${r.title ? `[${r.title}] ` : ''}${oneLine(r.text)}`).join('\n\n'),
    ].join('\n')

    const res = await callModelJson<{ verdicts?: Array<{ n?: number; verdict?: string; duplicateOf?: number; reason?: string }> }>({
      model: MODEL, system: SYSTEM, user, schema: SCHEMA,
      maxOutputTokens: 4000, timeoutMs: 180_000, temperature: 0.1,
      label: `25x-classify-${i / BATCH + 1}`, stream: 'lex', pass: 'CLASSIFY_STALE_V2',
    })
    tokensIn += res.usage.tokensIn
    tokensOut += res.usage.tokensOut
    if (!res.ok) {
      const fail = res as { reason: string; detail: string }
      console.error(`  batch ${i / BATCH + 1} FAILED: ${fail.reason} — ${fail.detail}`)
      continue
    }

    const seen = new Set<number>()
    for (const v of res.value.verdicts ?? []) {
      const n = typeof v?.n === 'number' ? v.n : NaN
      if (!Number.isInteger(n) || n < 1 || n > batch.length || seen.has(n)) continue
      const verdict = (['DUPLICATE', 'POSSIBLY_DUPLICATE', 'APPLICABLE', 'SUPERSEDED', 'ASSESSMENT', 'UNDECIDED'] as const)
        .find((k) => k === v.verdict) ?? 'UNDECIDED'
      const dupIdx = typeof v.duplicateOf === 'number' ? v.duplicateOf : NaN
      const dupOk = Number.isInteger(dupIdx) && dupIdx >= 1 && dupIdx <= current.length
      const needsDup = verdict === 'DUPLICATE' || verdict === 'POSSIBLY_DUPLICATE'
      seen.add(n)
      verdicts.set(batch[n - 1].id, {
        // ⚠ A DUPLICATE THAT NAMES NOTHING IS NOT A DUPLICATE. Without a current challenge to
        // point at, "already covered" is unfalsifiable — and this is the verdict that archives.
        verdict: needsDup && !dupOk ? 'UNDECIDED' : verdict,
        reason: needsDup && !dupOk
          ? 'called a duplicate but named no current challenge — not accepted'
          : oneLine(String(v.reason ?? '')).slice(0, 200),
        duplicateOf: needsDup && dupOk ? current[dupIdx - 1].id : null,
      })
    }
    console.log(`  batch ${i / BATCH + 1}: ${seen.size}/${batch.length}`)
  }

  // ── near-duplicates within the current set (§3d) ──────────────────────────────────────
  const mergeRes = await callModelJson<{ groups?: Array<{ members?: number[]; reason?: string }> }>({
    model: MODEL, system: MERGE_SYSTEM,
    user: `=== THE DRAFT AS IT NOW STANDS ===\n${draft}\n\n=== CRITICISMS (${current.length}) ===\n${currentList}`,
    schema: MERGE_SCHEMA, maxOutputTokens: 3000, timeoutMs: 180_000, temperature: 0.1,
    label: '25x-merge-current', stream: 'lex', pass: 'CLASSIFY_STALE_V2',
  })
  tokensIn += mergeRes.usage.tokensIn
  tokensOut += mergeRes.usage.tokensOut
  const groups: Array<{ members: number[]; reason: string }> = []
  if (mergeRes.ok) {
    for (const g of mergeRes.value.groups ?? []) {
      const members = (g.members ?? []).filter((m) => Number.isInteger(m) && m >= 1 && m <= current.length)
      if (new Set(members).size >= 2) groups.push({ members: [...new Set(members)], reason: oneLine(String(g.reason ?? '')) })
    }
  } else {
    const fail = mergeRes as { reason: string; detail: string }
    console.error(`  merge pass FAILED: ${fail.reason} — ${fail.detail}`)
  }

  // ── report ────────────────────────────────────────────────────────────────────────────
  const counts: Record<Verdict, number> = {
    DUPLICATE: 0, POSSIBLY_DUPLICATE: 0, APPLICABLE: 0, SUPERSEDED: 0, ASSESSMENT: 0, UNDECIDED: 0,
  }
  for (const r of older) counts[verdicts.get(r.id)?.verdict ?? 'UNDECIDED']++
  const price = priceBuild([{ model: MODEL, tokensIn, tokensOut }])

  const currentById = new Map(current.map((c) => [c.id, c]))
  const sampleOf = (v: Verdict, n: number) => older
    .filter((r) => (verdicts.get(r.id)?.verdict ?? 'UNDECIDED') === v)
    .slice(0, n)
    .map((r) => {
      const d = verdicts.get(r.id)!
      const dup = d.duplicateOf ? currentById.get(d.duplicateOf) : null
      return [
        `- **v${r.runVersion} · ${r.title ?? '(untitled)'}**`,
        `  - ${oneLine(r.text).slice(0, 260)}…`,
        `  - *reason:* ${d.reason}`,
        ...(dup ? [`  - *against current:* ${dup.title ?? oneLine(dup.text).slice(0, 90)}`] : []),
      ].join('\n')
    }).join('\n') || '_none_'

  const archived = counts.DUPLICATE + counts.SUPERSEDED
  const oldArchived = OLD.DUPLICATE + OLD.SUPERSEDED

  const md = [
    `# 25-X §3 — the same 178 criticisms, at a tighter bar. NOTHING WRITTEN.`,
    ``,
    `Idea \`${IDEA}\` — *${snapshot.title}*. Current build **v${currentVersion}** (${current.length} challenges).`,
    `Model \`${MODEL}\`, ${Math.ceil(older.length / BATCH) + 1} calls, **${formatSpend(price)}**.`,
    `Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.`,
    ``,
    `## §3e — new counts against old`,
    ``,
    `| verdict | 25-W | 25-X | change | what happens to it |`,
    `|---|---:|---:|---:|---|`,
    `| DUPLICATE — same POINT, not same topic | ${OLD.DUPLICATE} | **${counts.DUPLICATE}** | ${counts.DUPLICATE - OLD.DUPLICATE} | archived, naming the current challenge |`,
    `| POSSIBLY DUPLICATE — same topic, different point | – | **${counts.POSSIBLY_DUPLICATE}** | new | **stays visible**, marked |`,
    `| APPLICABLE — still bites | ${OLD.APPLICABLE} | **${counts.APPLICABLE}** | ${counts.APPLICABLE - OLD.APPLICABLE} | promoted into the current set |`,
    `| SUPERSEDED — target is gone | ${OLD.SUPERSEDED} | **${counts.SUPERSEDED}** | ${counts.SUPERSEDED - OLD.SUPERSEDED} | archived, naming what is gone |`,
    `| ASSESSMENT — not a criticism | – | **${counts.ASSESSMENT}** | new | **not archived as a criticism** |`,
    `| UNDECIDED | ${OLD.UNDECIDED} | **${counts.UNDECIDED}** | ${counts.UNDECIDED - OLD.UNDECIDED} | left alone |`,
    `| **total archived** | **${oldArchived}** | **${archived}** | **${archived - oldArchived}** | |`,
    `| **total kept visible** | **${older.length - oldArchived}** | **${older.length - archived}** | **${oldArchived - archived}** | |`,
    ``,
    `Merge groups within the current ${current.length}: **${groups.length}**`,
    `(covering ${groups.reduce((a, g) => a + g.members.length, 0)} challenges).`,
    ``,
    `## Samples`,
    ``, `### DUPLICATE — archived`, ``, sampleOf('DUPLICATE', 6), ``,
    `### POSSIBLY DUPLICATE — kept, marked`, ``, sampleOf('POSSIBLY_DUPLICATE', 6), ``,
    `### APPLICABLE — promoted`, ``, sampleOf('APPLICABLE', 5), ``,
    `### SUPERSEDED — archived, target gone`, ``, sampleOf('SUPERSEDED', 6), ``,
    `### ASSESSMENT — not a criticism, not archived as one`, ``, sampleOf('ASSESSMENT', 6), ``,
    `### UNDECIDED`, ``, sampleOf('UNDECIDED', 4), ``,
    `### Merge groups inside v${currentVersion}`, ``,
    ...(groups.length ? groups.map((g) => [
      `- **${g.reason}**`,
      ...g.members.map((m) => `  - C${m}: ${current[m - 1].title ?? oneLine(current[m - 1].text).slice(0, 100)}`),
    ].join('\n')) : ['- none found']),
  ].join('\n')
  writeFileSync(OUT, md, 'utf8')

  // ⚠ THE PLAN IS THE ARTEFACT THE APPLY STEP READS. Writing it here means what is applied is
  // exactly what was reported and reviewed, rather than a second model run that could differ.
  writeFileSync(PLAN, JSON.stringify({
    ideaId: IDEA, currentVersion, generatedAt: new Date().toISOString(),
    model: MODEL, spend: formatSpend(price),
    verdicts: older.map((r) => ({
      id: r.id, runVersion: r.runVersion, title: r.title,
      ...verdicts.get(r.id) ?? { verdict: 'UNDECIDED', reason: 'not returned by the model', duplicateOf: null },
    })),
    mergeGroups: groups.map((g) => ({ reason: g.reason, ids: g.members.map((m) => current[m - 1].id) })),
  }, null, 2), 'utf8')

  console.log(`\n${md.split('## §3e')[1]?.split('## Samples')[0] ?? ''}`)
  console.log(`written to ${OUT} and ${PLAN} — NOTHING was written to the database.`)
  console.log(`cost: ${formatSpend(price)}`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1)
})
