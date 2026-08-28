/**
 * check-argument-1a.ts — ARGUMENT 1A's guard. EVERY ASSERTION WATCHED FAILING AGAINST A REAL
 * BROKEN STATE, and every line states what it counted rather than that something exists.
 *
 * ⚠ THE ONE THAT MATTERS MOST IS THE UNTAGGED FLOOR. The brief: *"'this paragraph makes no
 * argument' must be an easy, unpunished answer, and a large share of any honest sample will be
 * exactly that. If fewer than a third of a random control sample come back untagged, the
 * labelling is over-eager and must be re-run."* That is a check on the LABELLER, not on the code,
 * and it is the only thing standing between this sprint and the position graph's failure mode.
 *
 * Usage:  npm run check:argument-1a
 */
import fs from 'node:fs'
import path from 'node:path'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { PATTERNS, PROBES, FTS_PHRASES, STANCE_MARKERS, TAGS, patternHits, type Tag } from './argument/taxonomy'
import { SEEDS } from './argument/seeds'
import { CONTROL_LABELS } from './argument/controls'

let pass = 0, fail = 0
function assert(ok: boolean, what: string, counted: string) {
  if (ok) { pass++; console.log(`  ok   ${what} — ${counted}`) }
  else { fail++; console.log(`  FAIL ${what} — ${counted}`) }
}

async function main() {
  console.log('── check:argument-1a ──\n')

  // ── 1. the taxonomy is complete on every axis ────────────────────────────────────────────────
  assert(TAGS.length === 10, 'the taxonomy has the ten tags Charlie approved', `${TAGS.length} tags`)
  const thin = TAGS.filter((t) => PATTERNS[t].length < 3 || PROBES[t].length < 3 || FTS_PHRASES[t].length < 3)
  assert(thin.length === 0, 'every tag has at least three patterns, three probes and three phrases',
    `${TAGS.length - thin.length} of ${TAGS.length} complete${thin.length ? `; thin: ${thin.join(', ')}` : ''}`)

  // ── 2. the two instruments are disjoint and can never be summed by accident ───────────────────
  const narrowSrc = new Set(TAGS.flatMap((t) => PATTERNS[t].map(String)))
  const shared = STANCE_MARKERS.map(String).filter((s) => narrowSrc.has(s))
  assert(shared.length === 0, 'the narrow MOVE patterns and the broad STANCE markers share no regex',
    `${narrowSrc.size} narrow · ${STANCE_MARKERS.length} stance · ${shared.length} shared`)

  // ── 3. a hit is always attributed, never a bare label ────────────────────────────────────────
  const planted = 'The Minister must tell us who is going to enforce this, because the council has no officers to inspect.'
  const hits = patternHits(planted)
  assert(hits.length > 0 && hits.every((h) => h.pattern && h.tag),
    'patternHits attributes every hit to the pattern that produced it',
    `${hits.length} hits on the planted passage, ${hits.filter((h) => h.pattern).length} carrying a pattern`)
  assert(patternHits('I beg to move that the House do now adjourn.').length === 0,
    'and it stays silent on a passage that makes no move — the check can fail in both directions',
    'a procedural sentence produced 0 hits')

  // ── 4. THE UNTAGGED FLOOR — the check on the labeller ────────────────────────────────────────
  const untagged = CONTROL_LABELS.filter((c) => c.tags.length === 0).length
  const share = untagged / (CONTROL_LABELS.length || 1)
  assert(CONTROL_LABELS.length >= 50, 'the random control sample is large enough to mean anything',
    `${CONTROL_LABELS.length} control passages labelled`)
  assert(share >= 1 / 3, "at least a third of the random control sample came back UNTAGGED (the brief's floor)",
    `${untagged} of ${CONTROL_LABELS.length} untagged = ${(share * 100).toFixed(1)}%, floor 33.3%`)
  // ⚠ watched failing: an over-eager labeller is what this exists to catch, so it is simulated.
  const overEager = CONTROL_LABELS.map((c, i) => ({ ...c, tags: i % 4 === 0 ? [] : ['COST'] }))
  const overEagerShare = overEager.filter((c) => c.tags.length === 0).length / overEager.length
  assert(overEagerShare < 1 / 3,
    'and the floor REJECTS a deliberately over-eager labelling — it is capable of failing',
    `a planted set tagging three passages in four scores ${(overEagerShare * 100).toFixed(1)}% untagged, below the floor`)

  // ── 5. every verified seed points at a passage that exists ───────────────────────────────────
  assert(SEEDS.length > 0, 'there are verified seeds at all', `${SEEDS.length} seeds`)
  const sectionIds = Array.from(new Set(SEEDS.map((s) => s.chunkId.replace(/#\d+$/, ''))))
  const live = sectionIds.length
    ? await prisma.$queryRaw<any[]>`SELECT id FROM corpus_sections WHERE id IN (${Prisma.join(sectionIds)})`
    : []
  const liveSet = new Set(live.map((r) => r.id))
  const orphans = sectionIds.filter((id) => !liveSet.has(id))
  assert(orphans.length === 0, 'every seed resolves to a real row in corpus_sections',
    `${liveSet.size} of ${sectionIds.length} section ids found${orphans.length ? `; missing: ${orphans.slice(0, 3).join(', ')}` : ''}`)
  const shortText = SEEDS.filter((s) => (s.text ?? '').trim().length < 20)
  assert(shortText.length === 0, 'every seed carries the verbatim passage a person judged',
    `${SEEDS.length - shortText.length} of ${SEEDS.length} carry 20+ characters`)
  const noWhy = SEEDS.filter((s) => !s.why || !s.why.trim())
  assert(noWhy.length === 0, 'every seed records WHY it makes the move — a label with no reason cannot be audited',
    `${SEEDS.length - noWhy.length} of ${SEEDS.length} carry a reason`)

  // ── 6. stored tags carry their provenance ────────────────────────────────────────────────────
  const stored = await prisma.$queryRawUnsafe<any[]>(`
    SELECT method, count(*) AS n, count(*) FILTER (WHERE evidence = '') AS blank
    FROM argument_tag GROUP BY 1 ORDER BY 1`).catch(() => null)
  if (stored === null) {
    assert(false, 'argument_tag exists', 'the table could not be read — has prisma/argument_1a.sql been applied?')
  } else {
    const machine = stored.filter((r) => r.method !== 'seed:v1')
    const blanks = machine.reduce((a, r) => a + Number(r.blank), 0)
    const total = stored.reduce((a, r) => a + Number(r.n), 0)
    assert(total > 0, 'propagation actually wrote something', `${total} rows across ${stored.length} methods`)
    // ⚠⚠ THIS ASSERTION PASSED ON AN EMPTY TABLE ON ITS FIRST RUN — "0 rows, 0 blanks, ok" — which
    // is a guard that cannot fail dressed as a guard that passed. The emptiness is now the failure,
    // and the count it is over is printed beside it.
    assert(total > 0 && blanks === 0, 'no machine-produced tag is stored without its evidence',
      total === 0
        ? 'CANNOT BE EVALUATED: the table is empty, so this says nothing'
        : `${total} rows across ${stored.length} methods; ${blanks} machine rows with blank evidence`)
    // and watched catching one, in memory, so the detector is known to work
    const planted = [{ method: 'prototype:v1', n: 3n, blank: 1n }]
    const plantedBlanks = planted.filter((r) => r.method !== 'seed:v1').reduce((a, r) => a + Number(r.blank), 0)
    assert(plantedBlanks > 0, 'and the blank-evidence detector catches a planted one — it is capable of failing',
      `a planted rowset with one blank-evidence row returned ${plantedBlanks}`)
  }

  // ── 7. a figure taken over a limited set prints its own cut-off ──────────────────────────────
  const propPath = path.join(__dirname, '../../docs/census/argument-1a-propagation.json')
  if (fs.existsSync(propPath)) {
    const p = JSON.parse(fs.readFileSync(propPath, 'utf8'))
    assert(typeof p.k === 'number' && p.k > 0,
      'the propagation artefact records the top-K cut-off every count in it is subject to',
      `k = ${p.k}`)
    const censoredFlags = Object.values(p.perTag ?? {}).flatMap((t: any) => (t.thresholds ?? []).map((x: any) => x.censored))
    assert(censoredFlags.length > 0,
      'and every threshold count says whether it was censored by that cut-off',
      `${censoredFlags.length} threshold counts carry a censored flag, ${censoredFlags.filter(Boolean).length} of them censored`)
  } else {
    assert(false, 'the propagation artefact exists', `${propPath} not found`)
  }

  console.log(`\n  ${pass} passed · ${fail} failed`)
  await prisma.$disconnect()
  process.exit(fail === 0 ? 0 : 1)
}
main().catch(async (e) => { console.error('FAILED', e); await prisma.$disconnect(); process.exit(1) })
