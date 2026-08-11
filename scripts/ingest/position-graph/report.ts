/**
 * report.ts — what the position graph actually contains (BRIEF_GRAPH_2D1 §3/§4/§5).
 *
 * Everything here is READ BACK FROM THE TABLES. The sweeps print what they attempted; this prints
 * what is stored, and only the second is a result. That distinction is not pedantry — the first live
 * run of the stats layer found six real bugs in a tsc-clean build, three of which were reporting
 * SUCCESS (docs/CLAUDE.md, "built inert hides write-path bugs").
 *
 * Sections, in the brief's own order:
 *   §3  resolution rate — distinct strings, how many resolve to a stable key, how many merged on
 *       name, how many are singletons
 *   §4  the policy-area candidate table, ranked. Charlie picks from it; this does not pick.
 *   §5  the done-counts, the integrity checks, and a hand-read of three organisations
 *
 * Usage: npx tsx position-graph/report.ts [--md docs/POSITION_GRAPH_2D1_REPORT.md]
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const arg = (f: string): string | null => {
  const i = argv.indexOf(`--${f}`)
  const v = i >= 0 ? argv[i + 1] : undefined
  return v && !v.startsWith('--') ? v : null
}
const MD = arg('md')

const out: string[] = []
const say = (s = '') => { console.log(s); out.push(s) }
const n = (v: number | string) => Number(v).toLocaleString('en-GB')
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : 'n/a')

/**
 * The committee, recovered from an edge's object_label.
 *
 * The label is written by the sweeps as `{inquiry title} ({committee})`, so this is the inverse of a
 * function we control rather than a guess at someone else's format. It is still CHECKED: a trailing
 * parenthesised group only counts as a committee when it reads like one, because an inquiry title can
 * carry its own brackets. The number that fails the check is reported, not swallowed.
 */
export function committeeOf(label: string | null): string | null {
  if (!label) return null
  const m = /\(([^()]+)\)\s*$/.exec(label)
  const cand = m?.[1]?.trim()
  if (!cand) return /committee|sub-committee|commission|panel/i.test(label) ? label.trim() : null
  return /committee|sub-committee|commission|panel/i.test(cand) ? cand : null
}

async function main() {
  const pool = getNeonPool()
  try {
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL ?? '')?.[1]
    say(`# Position graph — what is stored (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)`)
    say()
    say(`Read back from \`${host}\`. Every number below is a \`COUNT(*)\`, not a sweep counter.`)

    // ── §5 counts first: the reader wants the size before the analysis ──────────────────────────
    say()
    say('## §5 — the counts')
    say()
    const { rows: kinds } = await pool.query<{ kind: string; c: string }>(
      `SELECT kind, COUNT(*)::text AS c FROM graph_entity GROUP BY 1 ORDER BY 2 DESC`)
    say('| entity kind | rows |')
    say('|---|---:|')
    for (const r of kinds) say(`| ${r.kind} | ${n(r.c)} |`)
    const { rows: [tot] } = await pool.query<{ e: string; a: string; g: string; v: string; m: string }>(
      `SELECT (SELECT COUNT(*) FROM graph_entity)::text AS e, (SELECT COUNT(*) FROM graph_alias)::text AS a,
              (SELECT COUNT(*) FROM graph_edge)::text AS g, (SELECT COUNT(*) FROM graph_evidence)::text AS v,
              (SELECT COUNT(*) FROM graph_merge_log)::text AS m`)
    say(`| **total entities** | **${n(tot.e)}** |`)
    say()
    say(`Aliases ${n(tot.a)} · edges ${n(tot.g)} · evidence rows ${n(tot.v)} · merge-log rows ${n(tot.m)}`)

    say()
    say('### edges by predicate, with evidence coverage')
    say()
    // ⚠ Counted from graph_evidence, NOT from graph_edge.n_evidence. The counter is reconciled at the
    // END of a sweep, so mid-run it reads 0 and this column would report "0.0% of edges have
    // evidence" about 78,579 evidence rows that are sitting right there. Measure the thing, not the
    // counter — the drift check below is what watches the counter.
    const { rows: preds } = await pool.query<{ predicate: string; edges: string; with_ev: string; ev: string; lo: string; hi: string }>(
      `SELECT e.predicate,
              COUNT(*)::text AS edges,
              COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM graph_evidence v WHERE v.edge_id = e.id))::text AS with_ev,
              (SELECT COUNT(*) FROM graph_evidence v2 JOIN graph_edge e2 ON e2.id = v2.edge_id WHERE e2.predicate = e.predicate)::text AS ev,
              MIN(e.first_seen)::text AS lo, MAX(e.last_seen)::text AS hi
         FROM graph_edge e GROUP BY 1 ORDER BY COUNT(*) DESC`)
    say('| predicate | edges | with evidence | evidence rows | first seen | last seen |')
    say('|---|---:|---:|---:|---|---|')
    for (const r of preds) say(`| \`${r.predicate}\` | ${n(r.edges)} | ${n(r.with_ev)} (${pct(+r.with_ev, +r.edges)}) | ${n(r.ev)} | ${r.lo ?? '—'} | ${r.hi ?? '—'} |`)

    // The brief says evidence coverage "should be 100%". Assert it rather than eyeballing it.
    const { rows: [orphan] } = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM graph_edge e WHERE NOT EXISTS (SELECT 1 FROM graph_evidence v WHERE v.edge_id = e.id)`)
    say()
    say(+orphan.c === 0
      ? '✓ **Every edge has at least one evidence row.** An edge without one is a claim we cannot show our working for, so this is a constraint, not a statistic.'
      : `✗ **${n(orphan.c)} edges have NO evidence row.** That is a defect, not a caveat — the design's §5.1 makes it unacceptable.`)
    const { rows: [drift] } = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM graph_edge e
         WHERE e.n_evidence <> (SELECT COUNT(*) FROM graph_evidence v WHERE v.edge_id = e.id)`)
    say(+drift.c === 0
      ? '✓ `n_evidence` matches the stored evidence rows on every edge.'
      : `⚠ \`n_evidence\` disagrees with the stored rows on ${n(drift.c)} edges. That is expected DURING a sweep (it is reconciled at the end, never incremented as it goes) and a defect afterwards — re-run the sweep's reconciliation before quoting the counter.`)

    // ── §3 resolution ───────────────────────────────────────────────────────────────────────────
    say()
    say('## §3 — the resolution rate')
    say()
    const { rows: keys } = await pool.query<{ kind: string; key_source: string; c: string; conf: string }>(
      `SELECT kind, key_source, COUNT(*)::text AS c, ROUND(AVG(confidence)::numeric, 2)::text AS conf
         FROM graph_entity GROUP BY 1, 2 ORDER BY 1, COUNT(*) DESC`)
    say('| kind | identity established by | entities | mean confidence |')
    say('|---|---|---:|---:|')
    for (const r of keys) say(`| ${r.kind} | \`${r.key_source}\` | ${n(r.c)} | ${r.conf} |`)
    const { rows: [surf] } = await pool.query<{ surfaces: string; entities: string; multi: string }>(
      `SELECT (SELECT COUNT(DISTINCT surface) FROM graph_alias)::text AS surfaces,
              (SELECT COUNT(*) FROM graph_entity)::text AS entities,
              (SELECT COUNT(*) FROM (SELECT entity_id FROM graph_alias GROUP BY entity_id HAVING COUNT(DISTINCT surface) > 1) x)::text AS multi`)
    say()
    say(`- **${n(surf.surfaces)} distinct raw surface strings** were seen, resolving to **${n(surf.entities)} entities**.`)
    say(`- **${n(surf.multi)} entities carry more than one spelling.** Each of those is a name match — a judgement, not a key.`)
    const { rows: [keyed] } = await pool.query<{ keyed: string; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE key_source IN ('parl-member-id','parl-cis-id','parl-idms-id'))::text AS keyed, COUNT(*)::text AS total FROM graph_entity`)
    say(`- **${n(keyed.keyed)} of ${n(keyed.total)} entities (${pct(+keyed.keyed, +keyed.total)}) rest on a stable external key**; the rest are name-matched or singletons at confidence 0.7.`)
    say(`- \`graph_merge_log\` holds ${n(tot.m)} rows, so every fold can be undone. Two rows for one body is visible and fixable; one row for two bodies is neither.`)

    say()
    say('### the widest name matches — read these by hand, they are where contamination would live')
    say()
    const { rows: wide } = await pool.query<{ id: string; kind: string; canonical_name: string; forms: string; surfaces: string }>(
      `SELECT e.id::text, e.kind, e.canonical_name, COUNT(DISTINCT a.surface)::text AS forms,
              string_agg(DISTINCT a.surface, ' | ' ORDER BY a.surface) AS surfaces
         FROM graph_entity e JOIN graph_alias a ON a.entity_id = e.id
        WHERE e.key_source NOT IN ('parl-member-id','parl-cis-id','parl-idms-id')
        GROUP BY e.id, e.kind, e.canonical_name HAVING COUNT(DISTINCT a.surface) > 1
        ORDER BY COUNT(DISTINCT a.surface) DESC LIMIT 12`)
    if (!wide.length) say('_No unkeyed entity has more than one surface form yet._')
    for (const r of wide) say(`- **${r.canonical_name}** (${r.kind}, ${r.forms} forms): ${r.surfaces.slice(0, 300)}`)

    // ── §4 policy-area candidates ───────────────────────────────────────────────────────────────
    say()
    say('## §4 — the policy-area candidate table')
    say()
    say('**Policy area = the committee.** Chosen because it is *Parliament\'s own* division of policy')
    say('rather than ours: the brief rules out picking an area by intuition, and any clustering of')
    say('inquiry titles we invented would be exactly that curation act. The committee is carried on')
    say('every evidence item at source, on 100% of the items sampled in §1.')
    say()
    const { rows: edgeRows } = await pool.query<{ subject_id: string; object_ref: string; object_label: string | null; kind: string }>(
      `SELECT e.subject_id::text, e.object_ref, e.object_label, s.kind
         FROM graph_edge e JOIN graph_entity s ON s.id = e.subject_id
        WHERE e.predicate = 'gave-evidence-to' AND e.object_kind = 'inquiry'`)
    interface Area { inquiries: Set<string>; orgs: Map<string, Set<string>>; people: Set<string>; submissions: number }
    const areas = new Map<string, Area>()
    let noCommittee = 0
    for (const r of edgeRows) {
      const cttee = committeeOf(r.object_label)
      if (!cttee) { noCommittee++; continue }
      let a = areas.get(cttee)
      if (!a) { a = { inquiries: new Set(), orgs: new Map(), people: new Set(), submissions: 0 }; areas.set(cttee, a) }
      a.inquiries.add(r.object_ref)
      a.submissions++
      if (r.kind === 'organisation') {
        const set = a.orgs.get(r.subject_id) ?? new Set<string>()
        set.add(r.object_ref)
        a.orgs.set(r.subject_id, set)
      } else a.people.add(r.subject_id)
    }
    say(`Edges whose label yielded no committee: **${n(noCommittee)} of ${n(edgeRows.length)}** (${pct(noCommittee, edgeRows.length)}).`)
    say()
    const ranked = [...areas.entries()]
      .map(([name, a]) => {
        const repeat = [...a.orgs.values()].filter((s) => s.size > 1).length
        return {
          name, inquiries: a.inquiries.size, orgs: a.orgs.size, repeat, people: a.people.size,
          submissions: a.submissions,
          perInquiry: a.inquiries.size ? a.submissions / a.inquiries.size : 0,
        }
      })
      .sort((x, y) => y.repeat - x.repeat)
    say('| policy area (committee) | inquiries | orgs | **orgs in >1 inquiry** | people | submissions | subs/inquiry |')
    say('|---|---:|---:|---:|---:|---:|---:|')
    for (const r of ranked.slice(0, 20)) {
      say(`| ${r.name} | ${n(r.inquiries)} | ${n(r.orgs)} | **${n(r.repeat)}** | ${n(r.people)} | ${n(r.submissions)} | ${r.perInquiry.toFixed(1)} |`)
    }
    say()
    say('**Ranked by organisations appearing in more than one inquiry** — the brief\'s own primary')
    say('signal, and the right one: repeat participation is what gives the most edges per unit of')
    say('extraction cost when proposition extraction is proved on one area.')
    say()
    say('**On the contestation proxy, and what was chosen instead.** The brief suggests counting')
    say('organisations in inquiries whose recommendations were *not accepted in full*, "or another')
    say('countable signal you can defend". Acceptance is not derivable from anything structured we')
    say('hold: it lives inside the prose of government responses, and mining prose is what this')
    say('sprint refuses. So the defensible countable signal reported here is **submissions per')
    say('inquiry** — an inquiry many bodies felt the need to be heard on is where positions are')
    say('contested. It is a proxy for *salience*, which is weaker than contestation, and it is')
    say('labelled as such rather than dressed up.')

    // ── §5 the hand-read ────────────────────────────────────────────────────────────────────────
    say()
    say('## §5 — three organisations, read by hand')
    say()
    say('_"If the graph says something obviously wrong about a body you can check, the counts are decoration."_')
    say()
    const { rows: busiest } = await pool.query<{ id: string; canonical_name: string; key_source: string; edges: string }>(
      `SELECT e.id::text, e.canonical_name, e.key_source, COUNT(g.id)::text AS edges
         FROM graph_entity e JOIN graph_edge g ON g.subject_id = e.id
        WHERE e.kind = 'organisation' AND g.predicate = 'gave-evidence-to'
        GROUP BY e.id, e.canonical_name, e.key_source ORDER BY COUNT(g.id) DESC LIMIT 3`)
    for (const b of busiest) {
      say(`### ${b.canonical_name} — ${n(b.edges)} \`gave-evidence-to\` edges, identity by \`${b.key_source}\``)
      say()
      const { rows: al } = await pool.query<{ surface: string; source: string; n_seen: number }>(
        `SELECT surface, source, n_seen FROM graph_alias WHERE entity_id = $1 ORDER BY n_seen DESC LIMIT 6`, [b.id])
      say(`Surfaces seen: ${al.map((a) => `"${a.surface}" (${a.source} ×${a.n_seen})`).join(', ')}`)
      say()
      const { rows: ed } = await pool.query<{ object_label: string | null; object_ref: string; first_seen: string | null; n_evidence: number; section_id: string | null }>(
        `SELECT g.object_label, g.object_ref, g.first_seen::text, g.n_evidence,
                (SELECT v.section_id FROM graph_evidence v WHERE v.edge_id = g.id LIMIT 1) AS section_id
           FROM graph_edge g WHERE g.subject_id = $1 AND g.predicate = 'gave-evidence-to'
          ORDER BY g.first_seen DESC NULLS LAST LIMIT 8`, [b.id])
      say('| inquiry | id | first seen | evidence | a section id you can open |')
      say('|---|---|---|---:|---|')
      for (const e of ed) say(`| ${(e.object_label ?? '—').slice(0, 76)} | ${e.object_ref} | ${e.first_seen ?? '—'} | ${e.n_evidence} | \`${e.section_id ?? 'NONE'}\` |`)
      say()
    }

    // ── integrity: the things that would make the above meaningless ─────────────────────────────
    say('## integrity checks')
    say()
    const checks: Array<[string, string]> = [
      ['every evidence row points at a section that exists', `SELECT COUNT(*)::text AS c FROM graph_evidence v LEFT JOIN corpus_sections s ON s.id = v.section_id WHERE s.id IS NULL`],
      ['no entity has an empty normal form', `SELECT COUNT(*)::text AS c FROM graph_entity WHERE name_norm = '' OR name_norm IS NULL`],
      ['no edge points at itself', `SELECT COUNT(*)::text AS c FROM graph_edge WHERE object_entity_id = subject_id`],
      ['every declared-interest edge has an entity object', `SELECT COUNT(*)::text AS c FROM graph_edge WHERE predicate = 'declared-interest' AND object_entity_id IS NULL`],
      ['every gave-evidence-to edge has an inquiry object', `SELECT COUNT(*)::text AS c FROM graph_edge WHERE predicate = 'gave-evidence-to' AND object_kind <> 'inquiry'`],
      ['no cisId of 0 was stored as an identity', `SELECT COUNT(*)::text AS c FROM graph_entity WHERE parl_cis_id = 0`],
      ['every entity has at least one alias', `SELECT COUNT(*)::text AS c FROM graph_entity e WHERE NOT EXISTS (SELECT 1 FROM graph_alias a WHERE a.entity_id = e.id)`],
    ]
    for (const [label, sql] of checks) {
      const { rows: [r] } = await pool.query<{ c: string }>(sql)
      say(`- ${+r.c === 0 ? '✓' : `✗ **${n(r.c)}**`} ${label}`)
    }

    if (MD) {
      const dest = path.isAbsolute(MD) ? MD : path.join(__dirname, '../../../', MD)
      fs.writeFileSync(dest, out.join('\n') + '\n')
      console.log(`\n[report] written to ${dest}`)
    }
  } finally {
    await endNeonPool()
  }
}
main().catch((e) => { console.error('[report] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
