/**
 * area-2d3.ts — the chosen policy area and the SQL that scopes it, in one place.
 *
 * BRIEF_GRAPH_2D3 §1: "the data chooses the area, not us". The area is the top row of 2D-1 §4's
 * ranking — organisations appearing in more than one inquiry — recomputed from `graph_edge` by
 * probe-2d3-area.ts rather than copied out of the report:
 *
 *     1  Health and Social Care Committee        794 orgs in >1 inquiry   130 inquiries   7,560 held
 *     2  Environmental Audit Committee           754                      139             (runner-up)
 *
 * Every script in this sprint imports the area from here, so there is exactly one place where the
 * choice could drift and exactly one place a reader has to check it.
 */

/** The chosen area. Override with GRAPH_2D3_AREA for a re-run on the runner-up. */
export const AREA = process.env.GRAPH_2D3_AREA ?? 'Health and Social Care Committee'
export const RUNNER_UP = 'Environmental Audit Committee'

/** `graph_edge.object_label` is "{inquiry title} ({committee})". The committee is the parenthetical. */
export const COMMITTEE_RE = String.raw`\(([^()]*Committee[^()]*)\)\s*$`

/** The area's `gave-evidence-to` edges, as a CTE body named `e`. */
export function areaEdgeCte(): string {
  return `
    e AS (
      SELECT ge.id edge_id, ge.subject_id, ge.object_ref, ge.object_label
      FROM graph_edge ge
      WHERE ge.predicate = 'gave-evidence-to'
        AND (regexp_match(ge.object_label, '${COMMITTEE_RE}'))[1] = '${AREA.replace(/'/g, "''")}'
    )`
}

/**
 * Rows: one per inquiry in the area that holds evidence, most submissions first.
 *
 * ⚠ The section set is DISTINCT before the words are summed. A submission carrying both an
 * organisation and a named witness has two edges pointing at one section, and summing across the
 * join double-counts its words — which would have inflated the cost prediction this feeds.
 */
export function areaInquirySql(): string {
  return `
    WITH ${areaEdgeCte()},
    s AS (SELECT DISTINCT e.object_ref, gv.section_id FROM e JOIN graph_evidence gv ON gv.edge_id = e.edge_id),
    l AS (SELECT object_ref, regexp_replace(MIN(object_label), ' \\([^()]*\\)$', '') AS label FROM e GROUP BY object_ref)
    SELECT s.object_ref, l.label,
           COUNT(*)::text                            AS secs,
           COALESCE(SUM(c."wordCount"), 0)::text     AS words
    FROM s JOIN corpus_sections c ON c.id = s.section_id JOIN l ON l.object_ref = s.object_ref
    GROUP BY s.object_ref, l.label
    ORDER BY COUNT(*) DESC`
}
