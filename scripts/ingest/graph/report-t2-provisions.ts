/**
 * report-t2-provisions.ts — T2 of `docs/CC_BRIEF_report_corpus.md`.
 *
 * "The report needs to quote actual statutory words. One quoted clause showing
 * what breaks does more work than a page of explanation."
 *
 * Writes `docs/report_run/{ws_id}_provisions.json` holding two things:
 *
 *   1. THE TARGET ACT'S OWN PROVISIONS IN SCOPE — for WS-05, Part 1 only, with
 *      the membership read from CRAG's own CLML rather than assumed. Each
 *      provision carries its number, its heading and its full text.
 *
 *   2. FOR EVERY INBOUND REFERENCE, THE FULL SENTENCE CONTAINING IT — taken
 *      from the referring document's own CLML, held locally, not from the
 *      600-character evidence window.
 *
 * ── WHY THE SENTENCE IS TAKEN FROM THE DOCUMENT AND NOT THE FRAGMENT ────────
 *
 * `citation_edge.raw_fragment` is capped at 600 characters by the extractor, so
 * a sentence that runs longer arrives CUT — and a cut sentence quoted in a
 * report is a misquotation, not a short quotation. All 1,235 source documents
 * of the four measures are in the local bulk CLML file (measured: 1,235 of
 * 1,235), so the sentence is rebuilt from the document and the fragment is used
 * only as a declared fallback.
 *
 * ⚠ EVERY QUOTED SENTENCE SAYS WHERE IT CAME FROM AND WHETHER IT IS WHOLE.
 *   `sentence_source`   provision-text | document-text | raw-fragment | not-found
 *   `sentence_complete` true only when a full stop was found on BOTH sides
 * A row with `sentence_complete: false` is material to read, not material to
 * quote. The counts are reported so the analysis track knows how much of each
 * it has before it starts drafting, rather than discovering it at the quote.
 *
 * ⚠ An em-dash is not a sentence boundary — see `report-common.ts`. Statutes
 * hang definitions off one, and cutting there produces a quotation that can say
 * the opposite of the provision.
 *
 *   npx tsx graph/report-t2-provisions.ts [--include-t4]
 */
import { endNeonPool } from '../shared/neon-pool'
import { inboundEvidence, expandPart, InboundEvidenceRow } from './inbound'
import {
  MEASURES, MEASURE_T4, Measure, DocVersion, readDoc, readDocVersion, versionsHeld, zipHolds,
  closeZip, flattenClml, provisionSlice, preambleSlice, sentenceAround, actNameRegex,
  countsByDetection, MERGE_WARNING, writeJson, enclosingChain, contextName, bestMatchIndex,
} from './report-common'

// ── the target Act's own provisions ─────────────────────────────────────────

export type TargetProvision = {
  ref: string
  kind: string
  number: string | null
  heading: string | null
  text: string
  words: number
}

/**
 * Every section (and schedule paragraph) of an Act, from its CLML.
 *
 * A section is a `<P1 id="section-N">` inside a `<P1group>` whose `<Title>` is
 * the heading a reader knows it by; a schedule paragraph is the same element
 * with a `schedule-` id. `restrictTo` limits the set to the refs a Part expands
 * to, so WS-05 gets Part 1 and not the whole Act.
 */
export function targetProvisions(xml: string, restrictTo: Set<string> | null): TargetProvision[] {
  const out: TargetProvision[] = []
  const groups = [...xml.matchAll(/<P1group\b[^>]*>[\s\S]*?<\/P1group>/g)].map(m => m[0])
  // ⚠ A P1 outside any P1group is real (the HRA has several); take those too,
  // or the deliverable silently omits provisions that exist.
  const seen = new Set<string>()
  const push = (slice: string, headingFromGroup: string | null) => {
    const p1 = slice.match(/<P1\b[^>]*\sid="([^"]+)"[^>]*>[\s\S]*?<\/P1>/)
    if (!p1) return
    const ref = p1[1]
    if (seen.has(ref)) return
    if (restrictTo && !restrictTo.has(ref)) return
    seen.add(ref)
    const num = p1[0].match(/<Pnumber\b[^>]*>([\s\S]*?)<\/Pnumber>/)
    const text = flattenClml(p1[0])
    out.push({
      ref,
      kind: ref.startsWith('schedule-') ? 'schedule-paragraph' : 'section',
      number: num ? flattenClml(num[1]) || null : null,
      heading: headingFromGroup,
      text,
      words: text.split(/\s+/).filter(Boolean).length,
    })
  }
  for (const g of groups) {
    const t = g.match(/<Title\b[^>]*>([\s\S]*?)<\/Title>/)
    push(g, t ? flattenClml(t[1]) || null : null)
  }
  for (const m of xml.matchAll(/<P1\b[^>]*\sid="([^"]+)"[^>]*>[\s\S]*?<\/P1>/g)) push(m[0], null)
  return out.sort((a, b) => a.ref.localeCompare(b.ref, 'en', { numeric: true }))
}

// ── the referring provision's sentence ──────────────────────────────────────

export type QuotedRow = {
  ws_id: string
  detection: string
  scope_band: string
  source_type: string
  source_gid: string
  source_doc_uri: string
  source_provision_ref: string | null
  target_provision_ref: string | null
  citation_text: string
  referring_provision_heading: string | null
  quoted_sentence: string | null
  sentence_source: 'provision-text' | 'document-text' | 'as-made-text' | 'raw-fragment' | 'not-found'
  sentence_complete: boolean
  /** ⚠ which copy of the referring document the sentence was read from. The zip
   *  holds two copies of 2,894 gids and this is never left to iteration order. */
  document_version: DocVersion | null
  versions_held: DocVersion[]
  /** the left boundary is the start of the provision rather than a found stop */
  sentence_starts_at_provision_start: boolean
  /**
   * ⚠⚠ THE MOST CONSEQUENTIAL FIELD IN THIS FILE.
   *   confirmed          — source_provision_ref names a provision, and the
   *                        reference really is inside it
   *   MISATTRIBUTED      — source_provision_ref names a provision, the reference
   *                        is NOT in it, and it IS elsewhere in the document.
   *                        The citation is real and the target is real; the
   *                        SOURCE PROVISION is wrong. source_provision_ref is
   *                        the column that answers "which provision breaks if
   *                        you repeal this", so a wrong value is worse than a
   *                        missing one, and a disposition written against one of
   *                        these is written against the wrong clause.
   *   no-provision-named — source_provision_ref is NULL. Honest, not wrong.
   *   unchecked          — the document could not be read.
   */
  provision_attribution: 'confirmed' | 'MISATTRIBUTED' | 'no-provision-named' | 'unchecked'
  /** WHERE in the document the reference actually sits. Set only when
   *  MISATTRIBUTED. A cross-heading or a repeals table is a real reference in a
   *  real place; it is simply not inside the provision the row names. */
  reference_found_in: string | null
  /** how many times the target Act is named in the material searched */
  name_occurrences: number
  note: string | null
}

/** The heading a reader would cite the referring provision by. */
function headingFor(xml: string, ref: string | null): string | null {
  if (!ref) return null
  const ix = xml.indexOf(`id="${ref}"`)
  if (ix < 0) return null
  const before = xml.slice(Math.max(0, ix - 4000), ix)
  const titles = [...before.matchAll(/<Title\b[^>]*>([\s\S]*?)<\/Title>/g)]
  return titles.length ? flattenClml(titles[titles.length - 1][1]) || null : null
}

type Base = Omit<QuotedRow,
  'quoted_sentence' | 'sentence_source' | 'sentence_complete' | 'name_occurrences' | 'note' |
  'referring_provision_heading' | 'document_version' | 'sentence_starts_at_provision_start' |
  'provision_attribution' | 'reference_found_in'>

/** One attempt at a sentence, against one copy of the referring document. */
function tryVersion(m: Measure, r: InboundEvidenceRow, version: DocVersion, base: Base):
  Omit<QuotedRow, 'note'> & { note: string | null } | null {
  const xml = readDocVersion(r.source_gid, version)
  if (!xml) return null
  const nameRx = actNameRegex(m.title)
  const heading = headingFor(xml, r.source_provision_ref)
  // 1 — the provision the edge names, or the enacting words when it names none
  const slice = r.source_provision_ref ? provisionSlice(xml, r.source_provision_ref) : preambleSlice(xml)
  if (slice) {
    const hit = sentenceAround(flattenClml(slice), nameRx, r.citation_text)
    if (hit) return {
      ...base, referring_provision_heading: heading, document_version: version,
      quoted_sentence: hit.sentence, sentence_source: 'provision-text',
      sentence_complete: hit.complete, sentence_starts_at_provision_start: hit.atStart,
      provision_attribution: r.source_provision_ref ? 'confirmed' : 'no-provision-named',
      reference_found_in: null,
      name_occurrences: hit.occurrences,
      note: hit.complete ? null
        : `sentence boundary not found on the ${hit.leftBounded ? 'right' : 'left'} within 2000 characters of the reference — read, do not quote`,
    }
  }
  // 2 — the reference is real but sits outside the element the edge names (a
  //     marginal note, a cross-heading, a Part-level preamble). Widening is
  //     DECLARED, never silent: `document-text` tells a reader the sentence is
  //     not from the provision the edge points at.
  const hit = sentenceAround(flattenClml(xml), nameRx, r.citation_text)
  if (hit) {
    // ⚠ WHERE does the reference actually sit? Measured off the RAW markup,
    // because the chain of open elements is what answers it — not guessed from
    // the words, which is how a plausible wrong category gets published.
    let foundIn: string | null = null
    if (r.source_provision_ref) {
      const raw = bestMatchIndex(xml, nameRx, r.citation_text)
      foundIn = raw >= 0 ? contextName(enclosingChain(xml, raw), xml, raw) : 'could not be located in the raw markup'
    }
    return {
    ...base, referring_provision_heading: heading, document_version: version,
    quoted_sentence: hit.sentence, sentence_source: 'document-text',
    sentence_complete: hit.complete, sentence_starts_at_provision_start: hit.atStart,
    provision_attribution: r.source_provision_ref ? 'MISATTRIBUTED' : 'no-provision-named',
    reference_found_in: foundIn,
    name_occurrences: hit.occurrences,
    note: r.source_provision_ref
      ? `⚠ MISATTRIBUTED: the Act is named in ${r.source_gid} but NOT inside ${r.source_provision_ref}. The citation is real and the target is real; the source provision is wrong. Do not write a disposition against ${r.source_provision_ref} on the strength of this row.`
      : `the Act is named in ${r.source_gid} but not inside the enacting words — this sentence is from elsewhere in the document`,
    }
  }
  return null
}

export function quoteRow(m: Measure, r: InboundEvidenceRow & { scope_band?: string }): QuotedRow {
  const versions = versionsHeld(r.source_gid)
  const base: Base = {
    ws_id: m.ws_id,
    detection: r.detection,
    scope_band: r.scope_band ?? 'whole-act',
    source_type: r.source_type,
    source_gid: r.source_gid,
    source_doc_uri: r.source_doc_uri,
    source_provision_ref: r.source_provision_ref,
    target_provision_ref: r.target_provision_ref,
    citation_text: r.citation_text,
    versions_held: versions,
  }

  // preferred copy first — `revised` is the law as it stands, which is what a
  // repeal would strike
  const preferred = versions[0]
  if (preferred) {
    const hit = tryVersion(m, r, preferred, base)
    if (hit) return hit as QuotedRow
  }

  // ⚠⚠ Not in the current copy. Before calling that a lookup failure, ask the
  // OTHER copies — because a reference present in the as-made text and absent
  // from the revised text has not gone missing, it has been AMENDED OR REVOKED
  // AWAY, and for a repeal analysis that is a finding rather than a gap. The
  // Criminal Procedure Rules 2005 are the worked example: they cite section 4
  // of the Human Rights Act, and the revised copy is a shell reading "(revoked)".
  for (const v of versions.slice(1)) {
    const hit = tryVersion(m, r, v, base)
    if (hit) return {
      ...hit, sentence_source: 'as-made-text',
      note: `⚠ the reference is NOT in the ${preferred} copy of ${r.source_gid}; this sentence is from the ${v} copy. ` +
        `The referring provision has since been amended or revoked, so this is a reference that no longer bites — ` +
        `a finding for the disposition, not a retrieval failure.`,
    } as QuotedRow
  }

  // fall back to the stored evidence window, which may be cut at 600 chars
  const fragHit = sentenceAround(flattenClml(r.raw_fragment), actNameRegex(m.title), r.citation_text)
  if (fragHit) return {
    ...base, referring_provision_heading: null, document_version: null,
    quoted_sentence: fragHit.sentence, sentence_source: 'raw-fragment',
    sentence_complete: fragHit.complete, sentence_starts_at_provision_start: fragHit.atStart,
    provision_attribution: 'unchecked', reference_found_in: null,
    name_occurrences: fragHit.occurrences,
    note: versions.length
      ? `the Act is not named by name in any copy held of ${r.source_gid} — sentence taken from the stored evidence window, which may be cut at 600 characters`
      : `${r.source_gid} is not in the local bulk CLML file — sentence taken from the stored 600-character evidence window, which may be cut`,
  }

  return {
    ...base, referring_provision_heading: null, document_version: null,
    quoted_sentence: null, sentence_source: 'not-found', sentence_complete: false,
    sentence_starts_at_provision_start: false, provision_attribution: 'unchecked',
    reference_found_in: null, name_occurrences: 0,
    note: 'the target Act is not named by that name anywhere in the referring document or the stored fragment — ' +
      'expected for a markup edge that cites by URI alone (e.g. "the 1998 Act"), and the row still stands on its URI',
  }
}

// ── run ─────────────────────────────────────────────────────────────────────

async function runMeasure(m: Measure) {
  console.log(`\n══ ${m.ws_id} — ${m.title} ══`)
  const actXml = readDoc(m.gid)
  if (!actXml) throw new Error(`${m.gid} is not in the local bulk CLML file — T2 cannot run for ${m.ws_id}`)

  // 1 — the target's own provisions in scope
  let restrict: Set<string> | null = null
  let expansion: ReturnType<typeof expandPart> | null = null
  if (m.scope) {
    expansion = expandPart(m.gid, m.scope)
    restrict = new Set(expansion.refs)
  }
  const provisions = targetProvisions(actXml, restrict)
  console.log(`  target provisions in scope: ${provisions.length}` +
    (m.scope ? ` (restricted to ${m.scope}, expanded from the Act's own CLML)` : ' (whole Act)'))
  if (m.scope && provisions.length === 0)
    console.error(`  ⚠⚠ ${m.ws_id}: the scope expanded but matched NO provisions — reported, not hidden`)

  // 2 — a full sentence for every inbound reference
  const { rows } = await inboundEvidence(m.gid)
  let scoped = new Set<string>()
  if (m.scope) {
    const { rows: s } = await inboundEvidence(m.gid, m.scope)
    scoped = new Set(s.map(r => `${r.source_gid}|${r.source_provision_ref}|${r.target_uri}|${r.target_provision_ref}|${r.detection}|${r.citation_text}`))
  }
  // sorted by document so the zip cache reads each source once
  const ordered = [...rows].sort((a, b) => a.source_gid.localeCompare(b.source_gid))
  const quoted: QuotedRow[] = []
  const t0 = Date.now()
  for (const r of ordered) {
    const band = !m.scope ? 'whole-act'
      : scoped.has(`${r.source_gid}|${r.source_provision_ref}|${r.target_uri}|${r.target_provision_ref}|${r.detection}|${r.citation_text}`) ? m.scope
        : r.target_provision_ref === null ? 'act-level' : 'other-provision'
    quoted.push(quoteRow(m, { ...r, scope_band: band }))
  }

  const bySource: Record<string, number> = { 'provision-text': 0, 'document-text': 0, 'as-made-text': 0, 'raw-fragment': 0, 'not-found': 0 }
  for (const q of quoted) bySource[q.sentence_source]++
  const complete = quoted.filter(q => q.sentence_complete).length
  const quotable = quoted.filter(q => q.quoted_sentence !== null).length
  const atStart = quoted.filter(q => q.sentence_starts_at_provision_start).length
  const attribution: Record<string, number> = { confirmed: 0, MISATTRIBUTED: 0, 'no-provision-named': 0, unchecked: 0 }
  for (const q of quoted) attribution[q.provision_attribution]++
  const namesAProvision = attribution.confirmed + attribution.MISATTRIBUTED
  const whereFound = {}
  for (const q of quoted) if (q.provision_attribution === 'MISATTRIBUTED' && q.reference_found_in) {
    const k = q.reference_found_in.replace(/ \(nearest id: [^)]*\)/, '')
    whereFound[k] = (whereFound[k] ?? 0) + 1
  }
  console.log(`  quoted ${quotable} of ${quoted.length} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  console.log(`    by source: ${Object.entries(bySource).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  console.log(`    whole sentences (boundary found both sides): ${complete} of ${quoted.length} (${(100 * complete / quoted.length).toFixed(1)}%)`)
  console.log(`    of which the left boundary is the provision's own start, not a found stop: ${atStart}`)
  console.log(`  ⚠⚠ SOURCE-PROVISION ATTRIBUTION — of the ${namesAProvision} rows that NAME a source provision:`)
  console.log(`        confirmed in that provision : ${attribution.confirmed}`)
  console.log(`        MISATTRIBUTED              : ${attribution.MISATTRIBUTED}` +
    (namesAProvision ? ` (${(100 * attribution.MISATTRIBUTED / namesAProvision).toFixed(1)}% of rows naming a provision)` : ''))
  console.log(`      (${attribution['no-provision-named']} rows name no provision at all — honest, not wrong; ${attribution.unchecked} unchecked)`)
  for (const [k, v] of Object.entries(whereFound).sort((a, b) => (b[1] as number) - (a[1] as number)))
    console.log(`        where the reference actually sits: ${String(v).padStart(4)} × ${k}`)

  // ⚠ the version ambiguity, quantified for this measure
  const twoCopies = quoted.filter(q => q.versions_held.length > 1)
  const onlyAsMade = quoted.filter(q => q.sentence_source === 'as-made-text')
  const versionAmbiguity = {
    rows_whose_source_document_has_more_than_one_copy: twoCopies.length,
    distinct_such_documents: new Set(twoCopies.map(q => q.source_gid)).size,
    rows_found_only_in_the_superseded_copy: onlyAsMade.length,
    documents_found_only_in_the_superseded_copy: [...new Set(onlyAsMade.map(q => q.source_gid))],
    note:
      'The bulk CLML file holds two copies of 2,894 gids — an as-made (or as-enacted) copy and a revised copy. ' +
      'This run prefers the revised copy, because a repeal analysis is about the law as it stands. ' +
      '⚠ rows_found_only_in_the_superseded_copy are references that exist in the as-made text and NOT in the ' +
      'current text: the referring provision has since been amended or revoked, so the reference no longer bites. ' +
      'That is a disposition finding, not a retrieval failure. ' +
      '⚠⚠ SEPARATELY, AND NOT FIXED HERE: extract-citation-edges.ts iterated ENTRIES rather than gids, so for those ' +
      '2,894 gids it extracted from BOTH copies and wrote the rows under one source_gid with no column saying which. ' +
      'citation_edge therefore mixes as-made and current text for those documents. Reported for the next sprint.',
  }
  if (onlyAsMade.length) {
    console.log(`    ⚠ ${onlyAsMade.length} row(s) exist ONLY in a superseded copy — the referring provision has been amended or revoked away:`)
    for (const g of versionAmbiguity.documents_found_only_in_the_superseded_copy.slice(0, 6)) console.log(`        ${g}`)
  }
  console.log(`    rows whose source document has two copies in the corpus: ${twoCopies.length} (${versionAmbiguity.distinct_such_documents} documents)`)

  const p = writeJson(`${m.ws_id}_provisions.json`, {
    generated_at: new Date().toISOString(),
    measure: m,
    source_of_statutory_text: 'best-collection-xml.zip (local bulk CLML) — no network was used',
    target_provisions: {
      scope: m.scope ?? 'whole-act',
      part_expansion: expansion,
      count: provisions.length,
      note: m.scope
        ? `Membership of ${m.scope} is read from the Act's own CLML, not assumed. ` +
          `A provision inserted into ${m.scope} after enactment is included; one moved out is not.`
        : 'Every section and schedule paragraph of the Act.',
      provisions,
    },
    referring_provisions: {
      rows_in_this_file: quoted.length,
      rows_in_this_file_note: 'A count of rows in this file, not a count of evidence. The three detection values are not summed.',
      counts_by_detection: countsByDetection(quoted),
      merge_warning: MERGE_WARNING,
      sentence_provenance: bySource,
      sentence_provenance_note:
        'provision-text = the referring provision\'s own words, from its CLML. ' +
        'document-text = the Act is named in the referring document but not inside the provision the edge points at; the sentence is from elsewhere in that document and is labelled so. ' +
        'as-made-text = ⚠ the reference is ABSENT from the current copy of the document and present only in the as-made copy; the referring provision has been amended or revoked since. ' +
        'raw-fragment = from the stored 600-character evidence window, which may be cut. ' +
        'not-found = the Act is not named by name; expected where a markup edge cites by URI alone ("the 1998 Act"), and the row still stands on its URI.',
      version_ambiguity: versionAmbiguity,
      provision_attribution: {
        ...attribution,
        where_the_misattributed_reference_actually_sits: whereFound,
        rows_naming_a_provision: namesAProvision,
        misattribution_rate_over_rows_naming_a_provision:
          namesAProvision === 0 ? null : attribution.MISATTRIBUTED / namesAProvision,
        note:
          '⚠⚠ READ THIS BEFORE QUOTING ANY source_provision_ref. MISATTRIBUTED means the citation is real and ' +
          'the target is real, and the referenced Act is NOT named inside the provision element that ' +
          'source_provision_ref points at — it is elsewhere in the same document. ' +
          'where_the_misattributed_reference_actually_sits says where, measured from the chain of open CLML elements ' +
          'at the match rather than guessed from the words. ' +
          'TWO CONSEQUENCES, AND THEY ARE NOT EQUALLY SEVERE. ' +
          '(a) CERTAIN — you cannot quote that provision as containing the reference, because the words are not in ' +
          'it. A quotation built from one of these rows would be a misquotation. ' +
          '(b) NOT SETTLED BY THIS MEASUREMENT — whether the provision nonetheless BEARS on the target. A ' +
          'cross-heading reading "Consequential amendment to the Constitutional Reform and Governance Act 2010" ' +
          'sitting immediately above a paragraph is strong evidence that the paragraph does amend it. So these are ' +
          'NOT 496 false rows; they are rows whose evidence sits outside the provision named, and each needs its own ' +
          'look before a disposition is written. ' +
          'The denominator is rows that NAME a provision — rows with a NULL source_provision_ref are honest about ' +
          'naming none and are excluded from both halves. ' +
          '⚠ This is NOT coverage.notInAProvision, which counts the NULLs. Nothing before this run counted the ' +
          'non-null-and-elsewhere case.',
      },
      whole_sentences: complete,
      whole_sentences_note:
        'A sentence is whole only when a real sentence end was found on both sides within 2000 characters. ' +
        'A chapter number ("(c. 25)") is not a sentence end and neither is an em-dash; the first version of this ' +
        'extractor split on both and produced "Constitutional Reform and Governance Act 2010 (c." as a quotable ' +
        'sentence. A row that is not whole is material to read, not material to quote.',
      sentences_starting_at_the_provision_start: atStart,
      sentences_starting_at_the_provision_start_note:
        'For these the left boundary is the beginning of the provision rather than a full stop that was found. ' +
        'A provision does begin a sentence, so the quotation is sound — but the count is reported because it is a ' +
        'boundary that was ASSUMED and the others were FOUND, and that difference should not be invisible.',
      rows: quoted,
    },
  })
  console.log(`  wrote ${p}`)
  return { quoted, bySource, complete, attribution, namesAProvision }
}

async function main() {
  const list = process.argv.includes('--include-t4') ? [...MEASURES, MEASURE_T4] : MEASURES
  let allRows = 0, allComplete = 0, allMisattributed = 0, allNamingAProvision = 0
  const missing: string[] = []
  for (const m of list) {
    if (!zipHolds(m.gid)) { missing.push(m.gid); continue }
    const { quoted, complete, attribution, namesAProvision } = await runMeasure(m)
    allRows += quoted.length; allComplete += complete
    allMisattributed += attribution.MISATTRIBUTED; allNamingAProvision += namesAProvision
  }
  if (missing.length) console.error(`\n⚠⚠ NOT IN THE LOCAL CLML FILE, so T2 could not run for: ${missing.join(', ')}`)
  console.log(`\n══ P1 SCORED ══`)
  console.log(`  predicted ≥85% of rows would get a sentence with both boundaries found.`)
  console.log(`  actual: ${allComplete} of ${allRows} = ${(100 * allComplete / allRows).toFixed(1)}%`)
  console.log(`
══ NOT PREDICTED, AND THE MOST IMPORTANT NUMBER HERE ══`)
  console.log(`  source-provision misattribution across all three measures:`)
  console.log(`  ${allMisattributed} of ${allNamingAProvision} rows that name a source provision do NOT contain the reference in that provision`)
  console.log(`  = ${(100 * allMisattributed / allNamingAProvision).toFixed(1)}%.`)
  console.log(`  The citation is real and the target is real; the words are NOT inside the provision the row names.`)
  console.log(`  CERTAIN     : those provisions cannot be QUOTED as containing the reference.`)
  console.log(`  NOT SETTLED : whether they nonetheless BEAR on the target. A cross-heading naming the Act above a`)
  console.log(`                paragraph is good evidence the paragraph amends it. Each needs its own look.`)
  closeZip()
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[t2] FATAL', e); process.exit(1) })
}
