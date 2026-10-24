/**
 * backfill-271-enabling-role.ts — DECISION 271 (24 Oct 2026) on the enabling rows already in `citation_edge`.
 *
 * Every existing `detection = 'enabling'` row is given the role its own enacting words give it (`enablingRole`, via
 * `parseEnabling` — the one parser both writers use), and every power named by BACK-REFERENCE ("…section 2(2) of that
 * Act"), which no row held before, is inserted as a row of its own.
 *
 * ⚠ A ROW IS MATCHED BY ITS OWN WORDS, NOT BY POSITION: (source_gid, target_uri, target_provision_ref, citation_text)
 * — exactly the values `rowsFor` wrote, from the same bytes. A stored row the re-parse does not produce again is NOT
 * guessed at from position: it is read from its OWN stored words by the same `enablingRole`, its phrase marked
 * "[stored words]", and counted apart (the rows of instruments the bulk file on disk no longer holds). Only if a row
 * still has no role is the presence CHECK left NOT VALID, so `check-271-enabling-role.ts` fails until someone looks.
 * ⚠ RE-RUNNABLE: an update writes the same value twice harmlessly, and a back-reference row already present (same
 * key) is not inserted again.
 *
 *   npx tsx graph/backfill-271-enabling-role.ts --dry-run   — match and count, NO writes
 *   npx tsx graph/backfill-271-enabling-role.ts             — write, then VALIDATE the presence CHECK if every row has a role
 */
import fs from 'fs'
import { ZipReader, ZipEntryMeta } from './zip-reader'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { ENTRY_RX, gidFromEntry } from './audit-25h-citations'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { parseEnabling, enablingRole } from './extract-madeunder-edges'
import { rowsFor, loadHeld, insert, EnablingRow } from './extract-enabling-edges'
import { loadIdentityBridge } from './identity'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
const DRY = process.argv.includes('--dry-run')
const key = (gid: string, targetUri: string, ref: string | null, text: string) => `${gid}\u0000${targetUri}\u0000${ref ?? ''}\u0000${text}`

async function main() {
  const pool = getNeonPool()
  // ⚠ THE BRIDGE IS READ FROM ITS TABLE. `identity.ts` loads v36/source-entries.json, which is gitignored and absent
  // on this machine (24 Oct), and regenerating it is a full legislation.gov.uk walk. `legislation_identity` was built
  // FROM that bridge (setup-identity-table.ts), so it is the same pairs. Matching stored rows needs no bridge at all
  // (they are keyed on the raw target_uri); only the INSERTED back-reference rows need a canonical id and `resolved`,
  // and they take both from the table — a refused form keeps its own id, exactly as `canonicalSql` does.
  const fileBridge = !loadIdentityBridge().stats.degraded
  const { rows: idRows } = await pool.query(`SELECT form, canonical FROM legislation_identity`)
  const canonicalOf = new Map<string, string | null>(idRows.map((r: { form: string; canonical: string | null }) => [r.form, r.canonical]))
  const formsOf = new Map<string, string[]>()
  for (const r of idRows as Array<{ form: string; canonical: string | null }>) if (r.canonical) formsOf.set(r.canonical, [...(formsOf.get(r.canonical) ?? [r.canonical]), r.form])
  const bridged = (g: string) => canonicalOf.get(g) ?? g
  console.log(`[271] identity: ${fileBridge ? 'file bridge loaded' : 'file bridge ABSENT — using legislation_identity'} (${idRows.length.toLocaleString()} forms)`)
  const cols = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'enabling_role'`, [CITATION_TABLE])
  if (!cols.rowCount && !DRY) { console.error('[271] enabling_role does not exist — run setup-citation-edge-table.ts first'); process.exit(2) }

  // Every stored enabling row, by its key. ⚠ A key can name more than one row (the July run wrote duplicates); every
  // id under it gets the same role, and the count says how many.
  const { rows: stored } = await pool.query(
    `SELECT id::text, source_gid, target_uri, target_provision_ref, citation_text, extracted_from FROM ${CITATION_TABLE} WHERE detection = 'enabling'`)
  const ids = new Map<string, string[]>()
  for (const r of stored) {
    const k = key(r.source_gid, r.target_uri, r.target_provision_ref, r.citation_text)
    const l = ids.get(k); if (l) l.push(r.id); else ids.set(k, [r.id])
  }
  const gids = new Set(stored.map((r: { source_gid: string }) => r.source_gid))
  const provenance = stored[0]?.extracted_from ?? 'best-collection-xml.zip'
  console.log(`[271] ${stored.length.toLocaleString()} stored enabling rows · ${ids.size.toLocaleString()} distinct keys · ${gids.size.toLocaleString()} instruments${DRY ? ' · DRY RUN' : ''}`)

  const held = await loadHeld()
  const zip = new ZipReader(ZIP_PATH)
  const seen = new Set<string>()
  const roleOf = new Map<string, { role: string; words: string | null }>()   // stored key → role
  const toInsert: EnablingRow[] = []
  const notStored: string[] = []
  let docs = 0, parsedRows = 0
  const t0 = Date.now()
  for (const e of zip.entries) {
    const m = e.name.match(ENTRY_RX)
    if (!m) continue
    const gid = gidFromEntry(m)
    if (!gids.has(gid) || seen.has(gid)) continue          // ⚠ the first entry, as the extractor's checkpoint did
    seen.add(gid)
    const o = parseEnabling(gid, zip.readText(e as ZipEntryMeta))
    docs++
    if (o.kind !== 'hits') continue
    for (const h of o.hits) {
      for (const row of rowsFor(gid, [h], held)) {
        parsedRows++
        const k = key(gid, row.targetUri, row.targetProvisionRef, row.citationText)
        if (ids.has(k)) roleOf.set(k, { role: row.enablingRole, words: row.enablingRoleWords })
        else if (h.backReference) {
          const canonical = bridged(h.targetGid)
          toInsert.push({ ...row, targetActId: canonical, resolved: [h.targetGid, canonical, ...(formsOf.get(canonical) ?? [])].some(f => held.has(f)) })
        }
        else if (notStored.length < 5000) notStored.push(`${gid} → ${row.targetActId}${row.targetProvisionRef ? ` ${row.targetProvisionRef}` : ''}`)
      }
    }
    if (docs % 10000 === 0) console.log(`  ${docs.toLocaleString()} instruments · ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  }
  zip.close()

  const unmatched = [...ids.keys()].filter(k => !roleOf.has(k))
  const unmatchedRows = unmatched.reduce((s, k) => s + ids.get(k)!.length, 0)
  // ⚠ The rows were written from best-collection-xml.zip@2026-08-26; the zip on this machine is the 14 May 2026 copy,
  // which does not hold the instruments made after it. Those rows cannot be re-parsed — so they are read from THEIR
  // OWN stored words (the ≤240 characters before the reference) by the same `enablingRole`, and the phrase is marked
  // "[stored words]" so a reader of the table can tell. Counted apart, never passed off as a re-parse.
  const fromStored = new Map<string, { role: string; words: string | null }>()
  for (const k of unmatched) {
    const text = k.split('\u0000')[3].replace(/^\[preamble-recital\] /, '')
    const r = enablingRole(text)
    fromStored.set(k, { role: r.role, words: r.roleWords ? `[stored words] ${r.roleWords}` : null })
  }
  // How good is that fallback? Measured on the rows that DID re-parse: the stored-words role against the full one.
  let agree = 0, falsePower = 0, missedPower = 0
  for (const [k, v] of roleOf) {
    const r = enablingRole(k.split('\u0000')[3].replace(/^\[(?:preamble-recital|back-reference)\] /, '')).role
    if (r === v.role) agree++; else if (r === 'power') falsePower++; else if (v.role === 'power') missedPower++
  }
  console.log(`[271] stored-words fallback, measured on the ${roleOf.size.toLocaleString()} re-parsed keys: same role ${(100 * agree / Math.max(1, roleOf.size)).toFixed(1)}% · power where the full parse says not ${falsePower.toLocaleString()} · not power where it says power ${missedPower.toLocaleString()}`)
  const storedByRole: Record<string, number> = {}
  for (const [k, v] of fromStored) storedByRole[v.role] = (storedByRole[v.role] ?? 0) + ids.get(k)!.length
  const byRole: Record<string, number> = {}
  for (const [k, v] of roleOf) byRole[v.role] = (byRole[v.role] ?? 0) + ids.get(k)!.length
  console.log(`\n[271] re-parsed ${docs.toLocaleString()} of ${gids.size.toLocaleString()} instruments (${(gids.size - docs).toLocaleString()} not found in the bulk file) · ${parsedRows.toLocaleString()} rows produced`)
  console.log(`[271] stored rows given a role: ${(stored.length - unmatchedRows).toLocaleString()} — ${Object.entries(byRole).map(([r, n]) => `${r} ${n.toLocaleString()}`).join(' · ')}`)
  console.log(`[271] ⚠ stored rows NOT produced again: ${unmatchedRows.toLocaleString()} rows under ${unmatched.length.toLocaleString()} keys — read from their stored words instead: ${Object.entries(storedByRole).map(([r, n]) => `${r} ${n.toLocaleString()}`).join(' · ')}`)
  for (const k of unmatched.slice(0, 8)) { const [g, t, r, x] = k.split('\u0000'); console.log(`     ${g} → ${t.replace('http://www.legislation.gov.uk/id/', '')} ${r} :: …${x.slice(-90)}`) }
  console.log(`[271] back-reference power rows to insert: ${toInsert.length.toLocaleString()}`)
  console.log(`[271] non-back rows the parser now produces that are not stored: ${notStored.length.toLocaleString()}${notStored.length ? ` (e.g. ${notStored.slice(0, 3).join('; ')})` : ''}`)
  const dupKeys = [...ids.values()].filter(l => l.length > 1)
  console.log(`[271] keys naming more than one stored row: ${dupKeys.length.toLocaleString()} (${dupKeys.reduce((s, l) => s + l.length, 0).toLocaleString()} rows)`)
  if (DRY) { await endNeonPool(); return }

  // Writes. Updates in batches through unnest — one round trip per 5,000 rows.
  const pairs: Array<[string, string, string | null]> = []
  for (const [k, v] of [...roleOf, ...fromStored]) for (const id of ids.get(k)!) pairs.push([id, v.role, v.words])
  let updated = 0
  for (let i = 0; i < pairs.length; i += 5000) {
    const b = pairs.slice(i, i + 5000)
    const res = await pool.query(
      `UPDATE ${CITATION_TABLE} c SET enabling_role = u.role, enabling_role_words = u.words
         FROM unnest($1::bigint[], $2::text[], $3::text[]) AS u(id, role, words)
        WHERE c.id = u.id AND c.detection = 'enabling'`,
      [b.map(p => p[0]), b.map(p => p[1]), b.map(p => p[2])])
    updated += res.rowCount ?? 0
  }
  console.log(`[271] updated ${updated.toLocaleString()} rows`)
  const inserted = await insert(toInsert, `${provenance} · decision-271 back-reference`)
  console.log(`[271] inserted ${inserted.toLocaleString()} back-reference rows`)

  const left = await pool.query(`SELECT count(*)::int n FROM ${CITATION_TABLE} WHERE detection = 'enabling' AND enabling_role IS NULL`)
  if (left.rows[0].n === 0) {
    await pool.query(`ALTER TABLE ${CITATION_TABLE} VALIDATE CONSTRAINT citation_edge_enabling_role_present_ck`)
    console.log('[271] every enabling row has a role — citation_edge_enabling_role_present_ck VALIDATED')
  } else {
    console.log(`[271] ⚠ ${left.rows[0].n.toLocaleString()} enabling rows still have no role — the presence CHECK is LEFT NOT VALID, and check-271 will fail until they are looked at`)
  }
  fs.writeFileSync(`${__dirname}/backfill-271-unmatched.json`, JSON.stringify(unmatched.map(k => k.split('\u0000')), null, 1))
  await endNeonPool()
}

main().catch(e => { console.error('[271] FATAL', e); process.exit(1) })
