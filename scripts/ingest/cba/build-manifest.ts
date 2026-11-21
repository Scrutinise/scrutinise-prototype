/**
 * build-manifest.ts — BRIEF_INGEST_CBA_1_EXECUTE §6: the machine-readable CITATION MANIFEST.
 * key → section id → text hash, for the three Pilot A documents (the 468 rows of 14 Nov, NOT re-keyed).
 *
 * ⚠ Built from INGEST'S OWN RECORD, not from the rows' sectionTitle: the paragraph ref comes from the reviewed split
 * (docs/ingest_traces/cba1x_existing_map.json — every stored row matched one-to-one to a reviewed section on 18 Nov).
 * Lex 26-Y's interim manifest derives keys from sectionTitle. Two derivations from the same field would agree by
 * construction; these two have independent sources, so their agreement means something.
 * The hash is Lex's own definition (citation-manifest.ts textHashOf): sha256 of the R2 text as read, UTF-8, first 16 hex.
 *
 *   npx tsx cba/build-manifest.ts           build, compare with Lex's derived manifest, write the file
 * Output: docs/manifests/cba-citation-manifest.json (+ a comparison trace in docs/ingest_traces/)
 */
import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { r2Get } from '../shared/r2-client'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
// Lex's pure module (it imports nothing), so the comparison uses Lex's key rule rather than a copy of it. Loaded by a computed
// require because a static import puts a web file into the ingest TypeScript program (TS6059, rootDir); tsx runs it either way.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CM: any = require(path.join(__dirname, '../../../scrutinise-web/lib/lex/cba/citation-manifest-pure'))
const { keyOfRow, manifestFromRows, manifestFromFile, compareManifests, ENGINE_CITATIONS } = CM
const MANIFEST_DOCS: Array<{ prefix: string; docId: string; title: string }> = CM.MANIFEST_DOCS

const ROOT = path.join(__dirname, '../../..')
const MAP = path.join(ROOT, 'docs/ingest_traces/cba1x_existing_map.json')
const OUT = path.join(ROOT, 'docs/manifests/cba-citation-manifest.json')
const TRACE = path.join(ROOT, 'docs/ingest_traces/cba1x_manifest_compare.json')
const PREFIX: Record<string, string> = { 'green-book-2026': 'green-book', 'gb-discounting': 'gb-discounting', 'gb-optimism-bias': 'gb-optimism-bias' }
const PARA = /^(\d+|[A-Z])\.\d+$/, TABLE = /^table-([0-9]+|[A-Z]\.[0-9]+)$/

async function main() {
  const map: Array<{ key: string; ref: string; id: string }> = JSON.parse(fs.readFileSync(MAP, 'utf8'))
  const pool = getNeonPool()
  const { rows } = await pool.query<{ id: string; r2Key: string; sectionTitle: string; parentDocId: string; sourceUrl: string | null; status: string }>(
    `SELECT id, "r2Key", "sectionTitle", "parentDocId", "sourceUrl", status FROM corpus_sections WHERE id = ANY($1)`, [map.map((m) => m.id)])
  const byId = new Map(rows.map((r) => [r.id, r]))
  let fail = 0, ran = 0, ctrls = 0, dead = 0
  const ok = (n: string, c: boolean, s: string) => { ran++; if (!c) fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n} — ${s}`) }
  const ctrl = (n: string, c: boolean, s: string) => { ctrls++; if (!c) dead++; console.log(`${c ? 'CTRL fired' : 'CTRL DEAD '}  ${n} — ${s}`) }

  ok('every mapped row is still held and compiled', rows.length === map.length && rows.every((r) => r.status === 'compiled'), `${rows.length}/${map.length} held, ${rows.filter((r) => r.status !== 'compiled').length} not compiled`)

  const keys: Array<{ key: string; id: string; hash: string; sha256: string; r2Key: string; ref: string; label: string }> = []
  const notKeyed: Array<{ id: string; ref: string; why: string }> = []
  for (const m of map) {
    const prefix = PREFIX[m.key]
    if (!prefix) throw new Error(`unknown document key ${m.key}`)
    const t = TABLE.exec(m.ref)
    if (!PARA.test(m.ref) && !t) { notKeyed.push({ id: m.id, ref: m.ref, why: 'not a numbered paragraph or table (front matter, appendix, worked example)' }); continue }
    const row = byId.get(m.id)!
    const text = await r2Get(row.r2Key)
    if (text == null) throw new Error(`R2 text missing for ${m.id} (${row.r2Key})`)
    const sha256 = createHash('sha256').update(text, 'utf8').digest('hex')
    const doc = MANIFEST_DOCS.find((d) => d.prefix === prefix)!
    keys.push({ key: `${prefix}:${m.ref}`, id: m.id, hash: sha256.slice(0, 16), sha256, r2Key: row.r2Key, ref: m.ref, label: t ? `${doc.title}, Table ${t[1]}` : `${doc.title}, para ${m.ref}` })
  }
  const dup = keys.length - new Set(keys.map((k) => k.key)).size
  ok('no key is claimed twice', dup === 0, `${keys.length} keys, ${dup} duplicates`)

  // Compare with Lex 26-Y's interim manifest, derived (by Lex's own keyOfRow) from the same rows' sectionTitle.
  const lex = manifestFromRows(rows.map((r) => ({ id: r.id, parentDocId: r.parentDocId, sectionTitle: r.sectionTitle, sourceUrl: r.sourceUrl, r2Key: r.r2Key })))
  const lexWithHash = { ...lex, entries: new Map([...lex.entries].map(([k, e]) => [k, { ...e, textHash: keys.find((x) => x.id === e.sectionId)?.hash ?? null }])) }
  const file = manifestFromFile({ keys: keys.map((k) => ({ key: k.key, id: k.id, hash: k.hash, label: k.label })) })!
  const diffs = compareManifests(lexWithHash, file)
  // Named in advance: Lex's key grammar is table-\d+, so Green Book Table A.1 has no Lex key.
  const expected = diffs.filter((d) => d.key === 'green-book:table-A.1' && /only in the file/.test(d.why))
  const unexpected = diffs.filter((d) => !expected.includes(d))
  ok('the manifest and Lex 26-Y\'s derived manifest agree on every key, id and hash, except the one named difference', unexpected.length === 0 && expected.length === 1,
    `${file.entries.size} file keys, ${lex.entries.size} Lex keys; ${unexpected.length} unexpected: ${JSON.stringify(unexpected.slice(0, 5))}; named: ${JSON.stringify(expected)}`)
  const missingEngine = Object.values(ENGINE_CITATIONS).filter((k) => !file.entries.has(k))
  ok('every key Lex\'s engine prints is in the manifest', missingEngine.length === 0, `${Object.values(ENGINE_CITATIONS).length} engine keys, missing: ${missingEngine.join(', ') || 'none'}`)
  const g658 = file.entries.get('green-book:6.58')
  ok('green-book:6.58 resolves to the running-sequence id :186, as reported on 18 Nov', g658?.sectionId === 'govuk-core-docs:government/publications/the-green-book-2026-paragraphs:186', g658?.sectionId ?? 'absent')

  // Controls: a re-pointed id and changed text under the same id must each be named.
  const k0 = keys[0], k1 = keys[1]
  const bent = manifestFromFile({ keys: keys.map((k) => ({ key: k.key, id: k === k0 ? `${k.id}x` : k.id, hash: k === k1 ? '0000000000000000' : k.hash })) })!
  const bd = compareManifests(lexWithHash, bent, [k0.key, k1.key])
  ctrl('the comparison names a re-pointed id and a changed text', bd.length === 2 && /resolves to/.test(bd[0].why) && /text has changed/.test(bd[1].why), JSON.stringify(bd))
  const lexKeyOf6_58 = keyOfRow({ id: g658!.sectionId, parentDocId: MANIFEST_DOCS[0].docId, sectionTitle: byId.get(g658!.sectionId)!.sectionTitle, sourceUrl: null })
  ctrl('Lex\'s rule, applied to that row alone, gives the same key (the comparison is not vacuous)', lexKeyOf6_58?.key === 'green-book:6.58', JSON.stringify(lexKeyOf6_58))

  const byDoc: Record<string, number> = {}
  for (const k of keys) { const p = k.key.split(':')[0]; byDoc[p] = (byDoc[p] ?? 0) + 1 }
  const manifest = {
    about: 'Valid citation keys for the CBA guidance held in govuk-core-docs. key → section id → text hash. A key whose id or hash no longer matches the held row has been re-pointed or re-cut, and must fail (BRIEF_INGEST_CBA_1_EXECUTE §6).',
    builtAt: new Date().toISOString(),
    builtBy: 'scripts/ingest/cba/build-manifest.ts (CC-Ingest)',
    source: 'docs/ingest_traces/cba1x_existing_map.json (reviewed split ↔ stored rows, 18 Nov 2026); text read from R2',
    hash: 'sha256 of the R2 text as read (UTF-8); `hash` = first 16 hex, the same as Lex citation-manifest.ts textHashOf; `sha256` = full',
    documents: MANIFEST_DOCS.map((d) => ({ prefix: d.prefix, parentDocId: d.docId, title: d.title, keys: byDoc[d.prefix] ?? 0 })),
    notKeyed,
    keys: keys.map(({ key, id, hash, sha256, label }) => ({ key, id, hash, sha256, label })),
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 1) + '\n')
  fs.writeFileSync(TRACE, JSON.stringify({ at: manifest.builtAt, fileKeys: file.entries.size, lexKeys: lex.entries.size, diffs, byDoc, notKeyed }, null, 1) + '\n')
  console.log(`\nWROTE ${path.relative(ROOT, OUT)}: ${keys.length} keys ${JSON.stringify(byDoc)}; ${notKeyed.length} rows not keyed`)
  console.log(`${ran} ran, ${ran - fail} passed, ${fail} failed; ${ctrls} controls, ${dead} dead`)
  if (fail || dead) process.exitCode = 1
  await endNeonPool()
}
main().catch(async (e) => { console.error(e); await endNeonPool().catch(() => {}); process.exit(1) })
