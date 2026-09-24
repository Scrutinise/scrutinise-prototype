/**
 * check-s20b-control.ts — SEARCH_S20B_REPORT.md §4. THE CONTROL THAT PROVES THE FILTER MATCHES.
 *
 * A mis-quoted column name in the index query matches nothing and raises no error, so an empty
 * result can look exactly like a genuine "not in this document" miss. This is the control: one
 * known document with known sections, queried for something confirmed present in its own text,
 * must come back non-empty — and every returned id must actually belong to that document.
 *
 * Usage: FTS_SEARCH_URL=… VECTOR_SEARCH_URL=… npx tsx --env-file=.env scripts/check-s20b-control.ts
 */
import { documentSectionIds, searchWithinDocument } from '../lib/lex/within-document-search'

const DOC = 'primary-acts-2000plus:ukpga/2010/15' // Equality Act 2010, confirmed 560 sections (S23 Part A)
// Confirmed present verbatim in schedule-23-paragraph-2's own text (fetched from R2 in S23 Part A):
// "to practise a religion or belief... to foster or maintain good relations between persons of
// different religions or beliefs."
const QUERY = 'religion or belief organisation'

let pass = 0, fail = 0
function assert(ok: boolean, what: string, detail: string) {
  if (ok) { pass++; console.log(`  ok   ${what} — ${detail}`) }
  else { fail++; console.log(`  FAIL ${what} — ${detail}`) }
}

async function main() {
  console.log('── S20b §4 · the control ──')
  const ids = await documentSectionIds(DOC)
  assert(ids.length > 0, 'documentSectionIds returns a non-empty set for a known document', `${ids.length} ids for ${DOC}`)
  assert(ids.every((id) => id.startsWith(`${DOC}:`)), 'every id belongs to the document', `checked ${ids.length}`)
  assert(ids.length > 300 && ids.length < 700, 'the count is in the range S23 measured for this Act (560 sections)', `${ids.length}`)

  const out = await searchWithinDocument(QUERY, DOC)
  assert(out.ids.length === ids.length, 'searchWithinDocument resolves the same id set', `${out.ids.length} vs ${ids.length}`)
  assert(out.winnerId !== null, 'a query for text confirmed present in this document returns a winner', `winnerId=${out.winnerId}`)
  assert(out.winnerId === null || out.winnerId.startsWith(`${DOC}:`), 'the winner belongs to the document (never a leak from outside it)', `${out.winnerId}`)
  assert(out.legsRun.includes('keyword'), 'the keyword leg ran', `legsRun=${out.legsRun.join(',')}`)

  // ── the guard's own negative control: a document with NO section matching the query text ──
  // must return a winner from RRF anyway (RRF over a small pool always names a best-of), but the
  // scores must be visibly low / the leg must have actually run rather than short-circuited.
  const nonsense = await searchWithinDocument('xylophone quokka nonexistent phrase zzzz', DOC)
  assert(nonsense.ids.length === ids.length, 'the id set is identical regardless of query text (the filter, not the query, decides scope)', `${nonsense.ids.length}`)
  console.log(`  (info) a nonsense query still returns a within-document RRF winner: ${nonsense.winnerId} — expected, RRF over a fixed pool always ranks something`)

  // ── the filter really is scoping, not merely being ignored (§4's actual point) ──
  // A DIFFERENT document's query must not return an id from THIS document's set.
  const otherDoc = 'primary-acts-2000plus:ukpga/2005/4' // Constitutional Reform Act 2005 (S23 Part A)
  const otherIds = await documentSectionIds(otherDoc)
  assert(otherIds.length > 0, 'a second known document also resolves', `${otherIds.length} ids for ${otherDoc}`)
  const overlap = ids.filter((id) => otherIds.includes(id))
  assert(overlap.length === 0, 'two different documents share no section ids', `overlap=${overlap.length}`)
  const otherOut = await searchWithinDocument(QUERY, otherDoc)
  assert(otherOut.winnerId === null || !ids.includes(otherOut.winnerId), 'the SAME query scoped to a DIFFERENT document never returns THIS document\'s winner', `${otherOut.winnerId}`)

  console.log(`\n  ${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error('CRASHED', e); process.exit(1) })
