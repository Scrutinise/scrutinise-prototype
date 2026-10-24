/**
 * audit-g9-mentions-notes.ts — GRAPH 9 §3 and §4, measured where the reader reads.
 *
 *   §3  For GRAPH 8's four Acts: references held by kind — marked-up (`citation_edge.detection = 'markup'`), text-detected
 *       (`'text'`, the new `mentions` kind), and the `cites` edges the reader walks (`legislation_edges`) — and the
 *       marked-up : text ratio, so GRAPH 8's "1 in 19" for the Equality Act has company.
 *   §4  The share of stored words that come from a NOTE (not the law), with the denominator stated: (a) every stored
 *       markup/text row with a determined zone; (b) the `cites` rows the reader walks, joined to their words the way
 *       onward.ts joins them (same source document and provision, same target, detection 'markup'); (c) per Act.
 *
 * Read-only. Writes audit-g9-mentions-notes.json.   npx tsx graph/audit-g9-mentions-notes.ts
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

const OUT = path.join(__dirname, 'audit-g9-mentions-notes.json')
// GRAPH_8_REPORT §2's four Acts.
const ACTS: Array<[string, string]> = [
  ['ukpga/2010/25', 'Constitutional Reform and Governance Act 2010'],
  ['ukpga/2000/20', 'Government Resources and Accounts Act 2000'],
  ['ukpga/2010/15', 'Equality Act 2010'],
  ['ukpga/1992/61', 'Civil Service (Management Functions) Act 1992'],
]
const NOTE = `source_zone IN ('explanatory-note', 'earlier-orders-note')`

async function main() {
  const pool = getNeonPool()
  const q = async <T>(sql: string, p: unknown[] = []) => (await pool.query(sql, p)).rows as T[]

  // (a) every stored markup/text row
  const all = await q<{ detection: string; zone: string | null; n: number }>(
    `SELECT detection, source_zone zone, COUNT(*)::int n FROM citation_edge WHERE detection IN ('markup', 'text') GROUP BY 1, 2 ORDER BY 1, 2`)

  // (b) the cites rows the reader walks, joined as onward.ts joins them. A row is "from a note" when its FIRST joined
  // window (the words shown) is; "any" and "all" are reported too so the reading does not hang on the order.
  const cites = await q<{ rows: number; with_words: number; first_note: number; any_note: number; all_note: number; first_undetermined: number }>(`
    WITH c AS (
      SELECT e.from_id, e.to_id, split_part(e.from_id, ':', 2) g, NULLIF(split_part(e.from_id, ':', 3), '') p, split_part(e.to_id, ':', 2) t
        FROM legislation_edges e WHERE e.edge_type = 'cites'),
    w AS (
      SELECT c.from_id, c.to_id,
             (array_agg(ce.source_zone ORDER BY ce.id))[1] first_zone,
             bool_or(ce.${NOTE}) any_note, bool_and(COALESCE(ce.${NOTE}, false)) all_note, COUNT(ce.id) n
        FROM c LEFT JOIN citation_edge ce
          ON ce.source_gid = c.g AND ce.source_provision_ref IS NOT DISTINCT FROM c.p AND ce.target_act_id = c.t AND ce.detection = 'markup'
       GROUP BY c.from_id, c.to_id)
    SELECT COUNT(*)::int rows, COUNT(*) FILTER (WHERE n > 0)::int with_words,
           COUNT(*) FILTER (WHERE first_zone IN ('explanatory-note', 'earlier-orders-note'))::int first_note,
           COUNT(*) FILTER (WHERE any_note)::int any_note,
           COUNT(*) FILTER (WHERE n > 0 AND all_note)::int all_note,
           COUNT(*) FILTER (WHERE n > 0 AND first_zone IS NULL)::int first_undetermined
      FROM w`)

  // (c) per Act
  const perAct = []
  for (const [gid, title] of ACTS) {
    const k = await q<{ detection: string; n: number; notes: number; undetermined: number; docs: number }>(
      `SELECT detection, COUNT(*)::int n, COUNT(*) FILTER (WHERE ${NOTE})::int notes,
              COUNT(*) FILTER (WHERE source_zone IS NULL)::int undetermined, COUNT(DISTINCT source_gid)::int docs
         FROM citation_edge WHERE target_act_id = $1 AND detection IN ('markup', 'text') GROUP BY 1`, [gid])
    const by = Object.fromEntries(k.map((r) => [r.detection, r]))
    const citesRows = (await q<{ n: number }>(`SELECT COUNT(*)::int n FROM legislation_edges WHERE edge_type = 'cites' AND split_part(to_id, ':', 2) = $1`, [gid]))[0].n
    const markup = by.markup?.n ?? 0, text = by.text?.n ?? 0
    perAct.push({
      gid, title,
      marked_up: markup, text_detected: text, cites_edges_walked: citesRows,
      marked_up_share_of_both: markup + text ? Math.round((1000 * markup) / (markup + text)) / 10 : null,
      reads_as: markup ? `1 in ${Math.round((markup + text) / markup)}` : 'no marked-up reference',
      notes: { marked_up: by.markup?.notes ?? 0, text_detected: by.text?.notes ?? 0, undetermined: (by.markup?.undetermined ?? 0) + (by.text?.undetermined ?? 0) },
    })
  }

  const c = cites[0]
  const det = (d: string) => all.filter((r) => r.detection === d)
  const share = (rows: typeof all) => {
    const z = rows.filter((r) => r.zone !== null).reduce((a, r) => a + r.n, 0)
    const n = rows.filter((r) => r.zone === 'explanatory-note' || r.zone === 'earlier-orders-note').reduce((a, r) => a + r.n, 0)
    const u = rows.filter((r) => r.zone === null).reduce((a, r) => a + r.n, 0)
    return { from_notes: n, zone_determined: z, pct: Math.round((10000 * n) / Math.max(z, 1)) / 100, zone_not_determined: u }
  }
  const result = {
    measured_at: new Date().toISOString(),
    section_3_marked_up_vs_text: perAct,
    section_4_note_share: {
      all_stored_markup_and_text: share(all),
      marked_up_only: share(det('markup')),
      text_detected_only: share(det('text')),
      by_detection_and_zone: all,
      cites_rows_the_reader_walks: {
        rows: c.rows, with_words: c.with_words,
        words_shown_are_from_a_note: c.first_note, pct_of_rows_with_words: Math.round((10000 * c.first_note) / Math.max(c.with_words, 1)) / 100,
        any_window_from_a_note: c.any_note, every_window_from_a_note: c.all_note, words_shown_zone_not_determined: c.first_undetermined,
      },
      graph_8_said: 'at least 15,934 of 279,243 joined windows (5.7%) — a floor: only windows that happened to include the note header were counted',
    },
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
  await endNeonPool()
}
main().catch((e) => { console.error('[mentions-notes] FATAL', e); process.exit(1) })
