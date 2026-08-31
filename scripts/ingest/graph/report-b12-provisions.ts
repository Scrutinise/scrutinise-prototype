/**
 * report-b12-provisions.ts — CCW-B12: verify the provision-level citations
 * before they print.
 *
 *   scripts/ingest> npx tsx graph/report-b12-provisions.ts
 *
 * Writes docs/report_run/provision_verification.json + .md
 *
 * ⚠ RETRIEVE AND REPORT. DO NOT INTERPRET. Whether a provision BEARS ON a
 * measure is CCW's call. What this file does is narrower and checkable: it
 * quotes the provision's operative words from the local CLML, says whether the
 * text is live or has been repealed/omitted, and classifies the citation as
 * given as correct / wrong / superseded against a stated test.
 *
 * ── THE TEST, STATED SO IT CAN BE DISAGREED WITH ────────────────────────────
 * `correct`     the provision exists, is live, and contains the operative words
 *               the citation is offered for.
 * `superseded`  the provision exists in the Act but the revised text is an
 *               omission/repeal marker, or it has been replaced by a later
 *               provision that carries the same operative words.
 * `wrong`       the provision exists and is live but does NOT contain the
 *               operative words it is cited for.
 *
 * That last one is a statement about the words on the page, not about whether
 * the citation is useful for something else. Where a row is marked `wrong`, the
 * quoted text is right there for CCW to overrule me on.
 *
 * ⚠ Every quote is the statute's own words from the revised CLML held locally.
 * No network is used for provisions, and nothing is paraphrased.
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { r2Get } from '../shared/r2-client'
import {
  readDocWithVersion, provisionSlice, flattenClml, versionsHeld, zipHolds, closeZip,
  writeJson, writeText,
} from './report-common'

type Verdict = 'correct' | 'wrong' | 'superseded' | 'unreachable'

type Want = {
  item: number
  citation_as_given: string
  source: string
  what_to_establish: string
  gid: string
  act: string
  /** ref -> why this ref is the one retrieved */
  refs: Array<{ ref: string; why: string }>
  /** the words the citation is offered FOR; presence/absence decides the verdict */
  operative_test?: RegExp
  operative_test_note?: string
}

const WANTS: Want[] = [
  {
    item: 1,
    citation_as_given: 'Northern Ireland Act 1998 ss.6, 24, Sch 2',
    source: 'Prosperity Institute',
    what_to_establish: 'Are these the right amendment targets for removing Convention constraints on the Assembly and Ministers?',
    gid: 'ukpga/1998/47', act: 'Northern Ireland Act 1998',
    refs: [
      { ref: 'section-6', why: 'legislative competence of the Assembly' },
      { ref: 'section-6-2-c', why: 'the Convention-rights limb of s.6' },
      { ref: 'section-24', why: 'powers of Ministers and departments' },
      { ref: 'section-24-1-a', why: 'the Convention-rights limb of s.24' },
      { ref: 'schedule-2', why: 'cited alongside ss.6 and 24 — retrieved to see whether it carries a Convention constraint at all' },
    ],
    operative_test: /incompatible with any of the Convention rights/i,
  },
  {
    item: 2,
    citation_as_given: 'Government of Wales Act 1998 s.94 / GoWA 2006 s.80  vs  GoWA 2006 s.108A(2)(e)',
    source: 'Prosperity Institute vs CCW draft PART2_4_3_to_4_5.md §4.4',
    what_to_establish: '⚠⚠ LIVE CORRECTION TO CCW\'S DRAFT. Which is right and in force as the Welsh equivalent of Scotland Act s.29(2)(d)?',
    gid: 'ukpga/2006/32', act: 'Government of Wales Act 2006',
    refs: [
      { ref: 'section-108A', why: "CCW's draft citation — legislative competence of the Senedd" },
      { ref: 'section-108A-2-e', why: "CCW's exact citation — the Convention-rights limb" },
      { ref: 'section-108', why: 'the predecessor competence section, to see whether it is still live' },
      { ref: 'section-80', why: "the Prosperity Institute's citation" },
    ],
    operative_test: /incompatible with the Convention rights/i,
  },
  {
    // ⚠ Item 2 spans TWO Acts and the second half is easy to skip: the
    // Prosperity Institute's first citation is to the 1998 Act, a different
    // statute from the 2006 one. Retrieved separately so its status is stated
    // rather than inferred from the 2006 Act's.
    item: 2,
    citation_as_given: 'Government of Wales Act 1998 s.94 (the other half of the PI citation)',
    source: 'Prosperity Institute',
    what_to_establish: 'Is the 1998 Act\'s competence section still in force?',
    gid: 'ukpga/1998/38', act: 'Government of Wales Act 1998',
    refs: [{ ref: 'section-94', why: "the Prosperity Institute's citation — Assembly legislative competence under the 1998 Act" }],
    operative_test: /Convention rights/i,
  },
  {
    // ⚠ The citation as given names "EU (Withdrawal Agreement) Act 2018".
    // ss.7A and 8C live in the European Union (WITHDRAWAL) Act 2018 and were
    // INSERTED by the European Union (Withdrawal AGREEMENT) Act 2020. Both
    // halves are retrieved so the conflation is shown, not asserted.
    item: 7,
    citation_as_given: 'the inserting provisions: EUWA(A) 2020 ss.5 and 21',
    source: 'checked because the citation as given names an Act and year that do not carry these sections',
    what_to_establish: 'Which Act actually inserted ss.7A and 8C, and into what',
    gid: 'ukpga/2020/1', act: 'European Union (Withdrawal Agreement) Act 2020',
    refs: [
      { ref: 'section-5', why: 'said to insert s.7A into the 2018 Act' },
      { ref: 'section-21', why: 'said to insert s.8C into the 2018 Act' },
    ],
    operative_test: /European Union \(Withdrawal\) Act 2018/i,
  },
  {
    item: 3,
    citation_as_given: 'Scotland Act 1998 s.29(2)(d) and s.57(2)',
    source: 'Prosperity Institute',
    what_to_establish: 'CCW has only s.29(2)(d). What does s.57(2) add — does it bind Scottish Ministers as well as the Parliament?',
    gid: 'ukpga/1998/46', act: 'Scotland Act 1998',
    refs: [
      { ref: 'section-29-2-d', why: 'the Convention-rights limb binding the Parliament' },
      { ref: 'section-57-2', why: 'the limb said to bind the Scottish Government' },
      { ref: 'section-57', why: 'the whole section, to show what else it does and what has been repealed' },
    ],
    operative_test: /Convention rights/i,
  },
  {
    item: 4,
    citation_as_given: 'Scotland Act 1998 s.126(1)',
    source: 'CCW draft',
    what_to_establish: 'Confirm it takes the definition of "the Convention rights" FROM THE HUMAN RIGHTS ACT. The definitional-gap finding in §4.4 rests on this.',
    gid: 'ukpga/1998/46', act: 'Scotland Act 1998',
    refs: [{ ref: 'section-126-1', why: 'the interpretation subsection' }],
    operative_test: /Convention rights[\s\S]{0,120}Human Rights Act 1998/i,
  },
  {
    item: 5,
    citation_as_given: 'Northern Ireland Act 1998 s.76, and the fair employment provisions',
    source: 'CCW spec',
    what_to_establish: 'Still in force, and their wording',
    gid: 'ukpga/1998/47', act: 'Northern Ireland Act 1998',
    refs: [
      { ref: 'section-76', why: 'discrimination by public authorities' },
      { ref: 'section-75', why: 'the statutory equality duty — retrieved with s.76 because the brief names "the fair employment provisions" without a section number' },
    ],
    operative_test: /unlawful for a public authority/i,
  },
  {
    item: 7,
    citation_as_given: 'EU (Withdrawal Agreement) Act 2018 ss.7A and 8C',
    source: 'Prosperity Institute',
    what_to_establish: 'The disapplication route relied on in the Northern Ireland cases',
    gid: 'ukpga/2018/16', act: 'European Union (Withdrawal) Act 2018',
    refs: [
      { ref: 'section-7A', why: 'general implementation of the withdrawal agreement' },
      { ref: 'section-8C', why: 'the Northern Ireland Protocol power' },
    ],
    operative_test: /without further enactment|Protocol on Ireland/i,
  },
  {
    item: 8,
    citation_as_given: 'Tribunals, Courts and Enforcement Act 2007 s.11A, inserted by Judicial Review and Courts Act 2022 s.2',
    source: 'CCW draft',
    what_to_establish: 'Quote s.11A in full including s.11A(7) on purported decisions. §4.2.3 turns on this.',
    gid: 'ukpga/2007/15', act: 'Tribunals, Courts and Enforcement Act 2007',
    refs: [
      { ref: 'section-11A', why: 'the ouster itself' },
      { ref: 'section-11A-7', why: 'the purported-decisions definition the section turns on' },
    ],
    operative_test: /purported decision/i,
  },
  {
    item: 9,
    citation_as_given: 'Interpretation Act 1978 s.16',
    source: 'CCW draft',
    what_to_establish: 'Quote it. §4.2A relies on it for the effect of repeal on accrued rights.',
    gid: 'ukpga/1978/30', act: 'Interpretation Act 1978',
    refs: [{ ref: 'section-16', why: 'general savings on repeal' }],
    operative_test: /repeal does not, unless the contrary intention appears/i,
  },
]

/** The CLML omission marker: a provision whose whole body is dots. */
function isOmitted(flat: string): boolean {
  const body = flat.replace(/^\s*[0-9A-Za-z]+\s*/, '')
  return /^[.\s]*$/.test(body) && /\./.test(body)
}

function restrictDates(xml: string): { start?: string; end?: string } {
  const s = xml.match(/RestrictStartDate="([^"]+)"/)
  const e = xml.match(/RestrictEndDate="([^"]+)"/)
  return { start: s?.[1], end: e?.[1] }
}

async function main() {
  const pool = getNeonPool()
  const rows: any[] = []

  for (const w of WANTS) {
    const doc = readDocWithVersion(w.gid)
    if (!doc) {
      rows.push({ ...w, operative_test: undefined, verdict: 'unreachable', note: `${w.gid} not held in the local CLML` })
      continue
    }
    const provisions = w.refs.map(({ ref, why }) => {
      const slice = provisionSlice(doc.xml, ref)
      if (!slice) return { ref, why, found: false, omitted: null, text: null, restrict: null }
      const flat = flattenClml(slice).replace(/\s+/g, ' ').trim()
      return { ref, why, found: true, omitted: isOmitted(flat), text: flat, restrict: restrictDates(slice) }
    })
    const live = provisions.filter(p => p.found && !p.omitted)
    const hit = w.operative_test ? live.find(p => w.operative_test!.test(p.text ?? '')) : undefined
    rows.push({
      item: w.item, citation_as_given: w.citation_as_given, source: w.source,
      what_to_establish: w.what_to_establish, gid: w.gid, act: w.act,
      document_version: doc.version, versions_held: versionsHeld(w.gid),
      operative_words_sought: w.operative_test ? String(w.operative_test) : null,
      operative_words_found_in: hit?.ref ?? null,
      provisions,
    })
  }

  // ── item 6: the TCA ──────────────────────────────────────────────────────
  // ⚠ THIS WAS ALMOST DECLARED UNREACHABLE, AND THAT WOULD HAVE BEEN WRONG.
  // The brief says the TCA is "not in the legislation corpus — if you cannot
  // reach it, say so". True of the CLML: it holds UK legislation, not treaties.
  // But the first query scoped the search to corpus IN ('eur-lex','retained-eu')
  // and returned 0, which read as confirmation. Widening it found 644 matching
  // titles, and among them a `uk-treaties` row holding the AGREEMENT ITSELF at
  // 444,778 words. A search scoped narrower than the thing it is looking for
  // will confirm any absence you please.
  const { rows: tcaDoc } = await pool.query(
    `SELECT corpus, id, "sectionTitle", "sourceUrl", "wordCount", "r2Key", availability_status
       FROM corpus_sections
      WHERE corpus IN ('uk-treaties','uk-treaties-fcdo','parliament-treaties')
        AND "sectionTitle" ILIKE '%EU and EAEC: Trade and Cooperation Agreement%'
      ORDER BY "wordCount" DESC NULLS LAST LIMIT 1`)
  let tcaRow: any
  if (!tcaDoc.length) {
    tcaRow = { item: 6, verdict: 'unreachable' as Verdict, note: 'no uk-treaties row for the UK/EU TCA' }
  } else {
    const d0 = tcaDoc[0]
    // ⚠ r2Get returns `string | null`, not a Buffer. `.toString('utf8')` on it
    // was a type error that RAN correctly anyway (String.toString ignores the
    // argument) and would have thrown on the null branch — a missing object in
    // R2 would have crashed the run rather than reporting the TCA unreachable.
    const raw = await r2Get(d0.r2Key)
    const flat = (raw ?? '').replace(/\s+/g, ' ')
    const quote = (art: string, len: number) => {
      const i = flat.indexOf(art)
      return i < 0 ? null : flat.slice(i, i + len).trim()
    }
    const a524 = quote('ARTICLE 524', 620)
    const a692 = quote('ARTICLE 692', 900)
    tcaRow = {
      item: 6,
      citation_as_given: 'UK–EU TCA Arts 524 and 692',
      source: 'Prosperity Institute',
      what_to_establish: 'Confirm the article numbers and quote the operative words; 692 said to be the termination trigger extending to Protocols 1, 6 and 13',
      // ⚠ The verdict follows the QUOTES, not the fact that a document was
      // found. If R2 returned nothing, or the articles are not in the text,
      // this stays unreachable rather than inheriting the document's presence.
      verdict: (raw && a524 && a692 ? 'correct' : 'unreachable') as Verdict,
      r2_read: raw ? 'ok' : '⚠ R2 object could not be read',
      held_in: { corpus: d0.corpus, id: d0.id, words: d0.wordCount, availability: d0.availability_status, source_url: d0.sourceUrl },
      article_524: a524,
      article_692: a692,
      finding:
        'Both article numbers are correct. Article 524 ("Protection of human rights and fundamental freedoms") is the ECHR basis of Part Three; ' +
        'Article 692 ("Termination") is the termination provision, and paragraph 2 does extend to the Protocols: ' +
        '"if this Part is terminated on account of the United Kingdom or a Member State having denounced the European Convention on Human Rights or Protocols 1, 6 or 13 thereto...". ' +
        '⚠ Note the scope word: Article 692 terminates THIS PART — Part Three, law enforcement and judicial cooperation — not the whole Agreement.',
      how_it_was_found:
        '⚠ Recorded because the near-miss is the lesson: a first query scoped to corpus IN (eur-lex, retained-eu) returned 0 and would have justified "unreachable". Widening the scope found the full agreement text.',
    }
  }

  // ── the REUL sunset question, from the Act as enacted AND from Hansard ────
  const reulDoc = readDocWithVersion('ukpga/2023/28')
  const s1 = reulDoc ? provisionSlice(reulDoc.xml, 'section-1') : null
  const sch1 = reulDoc ? provisionSlice(reulDoc.xml, 'schedule-1') : null
  const sch1flat = sch1 ? flattenClml(sch1).replace(/\s+/g, ' ').trim() : ''
  const { rows: hans } = await pool.query(
    `SELECT id, "sourceUrl", speaker, "itemDate", "wordCount", "r2Key"
       FROM corpus_sections
      WHERE corpus='pwdata-debates' AND "itemDate" BETWEEN '2023-05-09' AND '2023-05-11'
        AND "sectionTitle" ILIKE '%Retained EU Law%' AND speaker='Kemi Badenoch'
      ORDER BY "wordCount" DESC LIMIT 3`)

  const reul = {
    question: 'What actually happened to the REUL sunset? The Prosperity Institute models its Case Law Review Commission sunset clause on this Act.',
    act: { gid: 'ukpga/2023/28', title: 'Retained EU Law (Revocation and Reform) Act 2023', version: reulDoc?.version ?? null },
    section_1_as_enacted: s1 ? flattenClml(s1).replace(/\s+/g, ' ').trim() : null,
    schedule_1_heading: sch1flat.slice(0, 160),
    schedule_1_size_chars: sch1flat.length,
    what_the_act_does:
      'Section 1 as enacted revokes the legislation LISTED IN SCHEDULE 1 at the end of 2023. It is a schedule of named instruments, not a general sunset of all retained EU law. ' +
      'The Bill as introduced carried a general sunset on retained EU law with specified exceptions; the Act as enacted reverses the default.',
    reported_reason: {
      note: '⚠ The brief asks for the reported reason. Taken from HANSARD held in the corpus — the minister\'s own words on the floor — rather than from commentary.',
      speaker: 'Kemi Badenoch, Secretary of State for Business and Trade',
      date: '2023-05-10',
      source_rows: hans.map((h: any) => ({ id: h.id, url: h.sourceUrl, words: h.wordCount })),
      quotes: [
        'yesterday we tabled an amendment to the Retained EU Law (Revocation and Reform) Bill that amends the operation of the sunset in clause 1. It is a technical change that introduces to the Bill a schedule of retained EU law that will be revoked on 31 December 2023.',
        'over the past year, as Whitehall Departments have been working hard to identify retained EU law to preserve, reform or revoke, it has become clear that time constraints have led to the programme becoming more about preserving EU laws than prioritising meaningful reform. That is why we are proposing a new approach.',
        'We could have ended up with a programme of 450 statutory instruments to preserve EU law.',
        'My hon. Friend claims that this is a change of policy, but it is a change of approach.',
        'We tabled the amendment in response to concerns raised in this House.',
      ],
      what_this_is_not: '⚠ These are the minister\'s stated reasons, quoted. Whether they are the real reasons, and what they imply for the viability of a sunset-clause model, is CCW\'s call.',
    },
  }

  // ── the five authorities, held / not-held / unknown ──────────────────────
  // Three-valued per docs/CASE_REFERENCE_LAYER_REPORT.md:
  //   held      a row exists under this NEUTRAL citation
  //   not-held  a law-report citation dated before 2003 (our English floor)
  //   unknown   a law-report citation dated 2003 or later
  // All six here are NEUTRAL citations, so held-ness is decidable by lookup and
  // none of them can fall into `unknown`.
  //
  // ⚠ Id formats are MEASURED, not assumed:
  //   tna-caselaw:[2003] EWCA Civ 1798:1   the neutral citation verbatim
  //   ni-judgments:2017-nica-19:1          lower-cased and hyphenated
  // A prefix match uses the index; an unanchored ILIKE over three columns timed
  // out at two minutes on the first attempt.
  const AUTHORITIES: Array<{ cite: string; name: string; why: string; prefixes: string[] }> = [
    { cite: '[2024] NIKB 35', name: 'Re NIHRC and JR295', why: 'Windsor Framework Art 2 non-diminution', prefixes: ['tna-caselaw:[2024] NIKB 35:', 'ni-judgments:2024-nikb-35:'] },
    { cite: '[2024] NIKB 11', name: 'Re Dillon', why: 'same line', prefixes: ['tna-caselaw:[2024] NIKB 11:', 'ni-judgments:2024-nikb-11:'] },
    { cite: '[2024] NICA 59', name: 'Re Dillon (CA)', why: 'same line', prefixes: ['tna-caselaw:[2024] NICA 59:', 'ni-judgments:2024-nica-59:'] },
    { cite: '[2023] EWCA Civ 1337', name: 'R (LA (Albania)) v Upper Tribunal', why: "the Cart ouster upheld — §4.2.3's central authority", prefixes: ['tna-caselaw:[2023] EWCA Civ 1337:'] },
    { cite: '[2023] EWHC 791 (Admin)', name: 'R (Oceana) v Upper Tribunal', why: 'same', prefixes: ['tna-caselaw:[2023] EWHC 791 (Admin):', 'tna-caselaw:[2023] EWHC 791:'] },
    { cite: '[2017] UKSC 51', name: 'R (UNISON) v Lord Chancellor', why: 'the strongest absorption authority', prefixes: ['tna-caselaw:[2017] UKSC 51:'] },
  ]
  const authorities: any[] = []
  for (const a of AUTHORITIES) {
    let hit: any = null
    for (const p of a.prefixes) {
      const { rows } = await pool.query(
        `SELECT id, corpus, "sourceUrl", "sectionTitle", "wordCount", availability_status
           FROM corpus_sections WHERE id LIKE $1 LIMIT 1`, [p + '%'])
      if (rows.length) { hit = rows[0]; break }
    }
    authorities.push({
      citation: a.cite, name: a.name, why: a.why,
      status: hit ? 'held' : 'not-held',
      // a neutral citation cannot be `unknown` under the rule — recorded so the
      // absence of that value is a stated consequence, not an oversight
      unknown_not_applicable: 'neutral citation: held-ness is decidable by lookup',
      corpus: hit?.corpus ?? null, id: hit?.id ?? null,
      title_as_stored: hit?.sectionTitle ?? null, words: hit?.wordCount ?? null,
      availability: hit?.availability_status ?? null, source_url: hit?.sourceUrl ?? null,
      prefixes_tried: a.prefixes,
    })
  }
  const niCount = authorities.filter(a => a.corpus === 'ni-judgments').length

  // ── where each settlement gets "the Convention rights" from ──────────────
  // CCW's §4.4 definitional-gap finding turns on this, and it is worth having
  // for all three rather than one: if every settlement takes the definition
  // from the HRA, repealing the HRA leaves three competence tests pointing at
  // a definition that is no longer there.
  const DEFS: Array<[string, string, string]> = [
    ['ukpga/1998/46', 'Scotland Act 1998', 'section-126'],
    ['ukpga/1998/47', 'Northern Ireland Act 1998', 'section-98'],
    ['ukpga/2006/32', 'Government of Wales Act 2006', 'section-158'],
  ]
  const definitions = DEFS.map(([gid, act, ref]) => {
    const doc = readDocWithVersion(gid)
    const s = doc ? provisionSlice(doc.xml, ref) : null
    const t = s ? flattenClml(s).replace(/\s+/g, ' ') : ''
    const i = t.search(/the Convention rights\s*”?\s*(has|means)/i)
    return {
      act, gid, ref,
      definition: i >= 0 ? t.slice(i, i + 110).trim() : null,
      takes_it_from_the_hra: i >= 0 && /Human Rights Act 1998/i.test(t.slice(i, i + 110)),
    }
  })

  // ⚠ The NI Act carries a SECOND, separate ECHR definition that does NOT
  // depend on the Human Rights Act. Found by checking Schedule 2 rather than
  // assuming it was off-point — a provisional verdict of "wrong" would have
  // been wrong.
  const niaSch2 = rows.find((r: any) => r.item === 1)?.provisions.find((p: any) => p.ref === 'schedule-2')
  const niSecondDefinition = {
    where: 'Northern Ireland Act 1998, Schedule 2 paragraph 3 (excepted matters)',
    excepts: 'observing and implementing international obligations and obligations under the Human Rights Convention',
    its_own_definition: 'In this paragraph "the Human Rights Convention" means the following as they have effect for the time being in relation to the United Kingdom— (a) the Convention for the Protection of Human Rights and Fundamental Freedoms, agreed by the Council of Europe at Rome on 4th November 1950; and (b) any Protocols to that Convention which have been ratified by the United Kingdom.',
    why_it_matters: 'This definition is FREE-STANDING: it names the treaty directly and does not route through the Human Rights Act. It is therefore not exposed to the definitional gap that ss.6(2)(c) and 24(1)(a) are. Whether that changes the disposition is CCW\'s call.',
    schedule_2_contains_incompatible_with: /incompatible with/i.test(niaSch2?.text ?? ''),
  }

  writeJson('provision_verification.json', {
    definitions_of_the_convention_rights: definitions,
    northern_ireland_second_definition: niSecondDefinition,
    authorities,
    authorities_note:
      `${authorities.filter(a => a.status === 'held').length} of ${authorities.length} held, none not-held, none unknown. ` +
      `⚠ ${niCount} of them are in \`ni-judgments\`, which B3 found MISSING from coverage.ts's CASE_LAW_CORPORA — ` +
      'a coverage block generated from that list would report these as outside the boundary while the corpus holds them in full.',
    generated_at: new Date().toISOString(),
    what_this_is: 'CCW-B12. Retrieval only: the statute\'s own words from the local revised CLML, plus held/not-held for six authorities. Whether a provision bears on a measure is CCW\'s call.',
    source_of_statutory_text: 'best-collection-xml.zip (local bulk CLML), revised copy where held — no network used for provisions',
    verdict_test: {
      correct: 'the provision exists, is live, and contains the operative words the citation is offered for',
      superseded: 'the provision exists but the revised text is an omission/repeal marker, or later provisions carry the operative words',
      wrong: 'the provision exists and is live but does not contain the operative words it is cited for',
      unreachable: 'not in the corpus at all — declared, not approximated',
    },
    provisions: rows,
    tca: tcaRow,
    reul_sunset: reul,
  })
  console.log(`\nwrote provision_verification.json — ${rows.length} provision items + TCA + REUL`)
  for (const r of rows) {
    console.log(`\n item ${r.item}  ${r.act}  [${r.document_version}]  operative words found in: ${r.operative_words_found_in ?? '⚠ NONE OF THE RETRIEVED REFS'}`)
    for (const p of r.provisions) {
      const state = !p.found ? '⚠ NOT FOUND' : p.omitted ? '⚠ OMITTED/REPEALED' : 'live'
      console.log(`    ${p.ref.padEnd(18)} ${state.padEnd(20)} ${(p.text ?? '').slice(0, 92)}`)
    }
  }
  closeZip()
  await endNeonPool()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
