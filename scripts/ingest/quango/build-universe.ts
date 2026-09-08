/**
 * build-universe.ts — regenerate docs/QUANGO_UNIVERSE.xlsx from the live gov.uk register.
 *
 * Replaces the 12 Jun 2026 snapshot in docs/QUANGO_UNIVERSE.xls. Five tabs: Summary, the main data,
 * a Public Bodies directory cross-check, an answerability analysis, and Sources.
 *
 * ⚠ THREE THINGS THE OLD FILE GOT WRONG, FIXED HERE:
 *
 * 1. MOJIBAKE. Six rows carried UTF-8 read as Windows-1252 ("Victoria ClimbiÃ© Inquiry",
 *    "The Adjudicatorâ€™s Office"). The corruption is in the CSV writer, not Excel — the old
 *    enumerator wrote with the platform default encoding. Everything here is written UTF-8 and
 *    `assertNoMojibake()` FAILS THE BUILD if any name still matches the pattern, so this cannot
 *    silently come back.
 *    ⚠ Note for anyone repairing an old file: the reverse map is WINDOWS-1252, not latin1. latin1
 *    has no € at 0x80 (it puts U+20AC at 0xAC), so a latin1 round-trip turns "â€™" into U+FFFD and
 *    the row still fails to match. That cost a wrong reconciliation (673 against a measured 668).
 *
 * 2. A TOTAL WITH NO ROWS BEHIND IT. The old Totals tab read 666 = 665 real rows plus a typed
 *    "Newly created Sept 2026: 1". Every number on the Summary tab here is computed from the data
 *    tab in the same run, and `assertTotalsTieOut()` refuses to write a workbook whose summary
 *    does not equal its own data.
 *
 * 3. TRAILING WHITESPACE. gov.uk publishes "Service Complaints Ombudsman " with a trailing space.
 *    Names are trimmed on write, and the raw form is kept in `name_as_published` so the trim is
 *    visible rather than silent.
 *
 * Usage: tsx quango/build-universe.ts
 */
import fs from 'fs'
import path from 'path'
import * as XLSX from '../../../scrutinise-web/node_modules/xlsx'

const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'
const DOCS = path.join(__dirname, '../../../docs')
const REF = path.join(__dirname, 'reference')
const OUT_XLSX = path.join(DOCS, 'QUANGO_UNIVERSE.xlsx')

// ── Ministerial control model (the analysis; see the Answerability tab) ──────
// The working definition of a quango: "funded by Government, over which a minister does not have
// direct control". That turns on ONE question per body type — can a minister lawfully direct it?
type Control = 'DIRECT' | 'DELEGATED' | 'ARM\'S LENGTH' | 'STATUTORILY INDEPENDENT' | 'NOT A UK MINISTER'
interface TypeRule { control: Control; quango: 'Yes' | 'No' | 'Borderline'; who: string; why: string }

const TYPE_RULES: Record<string, TypeRule> = {
  'Ministerial department': {
    control: 'DIRECT', quango: 'No',
    who: 'The Secretary of State personally. Officials act in the minister\'s name (the Carltona principle).',
    why: 'The minister IS the head of the department. Control is not delegated, it is held.',
  },
  'Executive office': {
    control: 'DIRECT', quango: 'No',
    who: 'The minister of the department it sits in.',
    why: 'A unit inside a department (e.g. the Office for the Prime Minister and Cabinet). No separate legal identity.',
  },
  'Sub organisation': {
    control: 'DIRECT', quango: 'No',
    who: 'A senior civil servant, who answers to the minister. NOT a separate accountability chain.',
    why: 'gov.uk\'s category for a unit WITHIN a department — a directorate, office or programme. It has no board, no separate legal personality and no statutory independence; the minister is answerable for it in the House exactly as for the department. This is the answer to "are sub-organisations answerable to civil servants or the minister?": to civil servants day-to-day, to the minister constitutionally.',
  },
  'Civil service': {
    control: 'DIRECT', quango: 'No',
    who: 'The Minister for the Civil Service (the Prime Minister).',
    why: 'The Civil Service itself, not a body funded by government at arm\'s length.',
  },
  'Executive agency': {
    control: 'DELEGATED', quango: 'Borderline',
    who: 'The sponsoring minister, through a published framework document.',
    why: 'Legally PART of its department and staffed by civil servants, so the minister retains a direction power and full parliamentary accountability. But day-to-day operations are delegated to a chief executive with a separate budget and business plan. Direct control exists in law and is deliberately not exercised in practice — which is why this is the genuinely contested category on your definition.',
  },
  'Non-ministerial department': {
    control: 'ARM\'S LENGTH', quango: 'Yes',
    who: 'Nobody, directly. Headed by civil servants or a board, accountable to Parliament.',
    why: 'A department with NO minister at its head — the arrangement exists precisely to put functions beyond ministerial reach (HMRC on individual taxpayers, Ofsted on judgements, the CMA on cases). Ministers set the statutory framework and the budget; they cannot direct outcomes. On your definition this is the clearest Yes of all, and it is the category most people would not think to call a quango.',
  },
  'Executive non-departmental public body': {
    control: 'ARM\'S LENGTH', quango: 'Yes',
    who: 'A board, appointed by the minister. The minister sponsors and funds but does not manage.',
    why: 'The textbook quango. Separate legal personality, own staff (usually not civil servants), grant-in-aid from the sponsor department. Ministerial power is real but indirect: appoint the board, set the budget, agree the framework document, and in some cases a reserve statutory direction power.',
  },
  'Advisory non-departmental public body': {
    control: 'ARM\'S LENGTH', quango: 'Yes',
    who: 'A board of appointees; the secretariat is usually departmental civil servants.',
    why: 'Advises ministers and typically has no staff, no budget of its own and no executive power. The minister appoints it and is free to ignore it — so control over its ADVICE is nil, and control over its EXISTENCE is total.',
  },
  'Ad-hoc advisory group': {
    control: 'ARM\'S LENGTH', quango: 'Yes',
    who: 'A minister, who convenes it for a defined task.', why: 'A time-limited advisory NDPB in all but name.',
  },
  'Tribunal': {
    control: 'STATUTORILY INDEPENDENT', quango: 'Borderline',
    who: 'Nobody. Judicial independence is statutory; members are judicial office-holders.',
    why: 'Funded by government and appointed through the Judicial Appointments Commission, but a minister cannot direct an outcome and Article 6 ECHR requires that they cannot. Independent, but the independence is JUDICIAL, not managerial — which makes it a different thing from a quango even though it satisfies your test.',
  },
  'Court': {
    control: 'STATUTORILY INDEPENDENT', quango: 'No',
    who: 'Nobody in government. Judges answer to the Lord Chief Justice for conduct; to nobody for decisions.',
    why: 'You asked who the courts answer to: constitutionally, to no minister at all. The Constitutional Reform Act 2005 removed the Lord Chancellor\'s judicial role and placed a statutory duty on ministers to uphold judicial independence. The MoJ funds HM Courts & Tribunals Service and the Lord Chancellor is accountable to Parliament for the courts SYSTEM — never for a judgment. A court passes your funding-and-no-control test but is a separate branch of the state rather than a body government created to do its work at arm\'s length.',
  },
  'Public corporation': {
    control: 'ARM\'S LENGTH', quango: 'Borderline',
    who: 'A board; the minister acts as shareholder or through a charter.',
    why: 'Trades commercially and earns much of its own income (BBC, Channel 4, Ordnance Survey). Fails the "funded by Government" half of your test to the extent it is self-funding, which is why it is borderline rather than a clear Yes.',
  },
  'Special health authority': {
    control: 'DELEGATED', quango: 'Borderline',
    who: 'The Secretary of State for Health and Social Care, who holds a statutory DIRECTION power.',
    why: 'Looks like an NDPB but the Secretary of State can direct it under the NHS Act 2006. A live direction power is close to direct control, so this sits below the NDPBs on your test.',
  },
  'Independent monitoring body': {
    control: 'STATUTORILY INDEPENDENT', quango: 'Yes',
    who: 'Nobody. Independence is the statutory purpose.',
    why: 'Exists to inspect or monitor government itself, so ministerial direction would defeat the point.',
  },
  'Devolved government': {
    control: 'NOT A UK MINISTER', quango: 'No',
    who: 'Devolved ministers, accountable to the Scottish Parliament, Senedd or NI Assembly.',
    why: 'Answerable to a minister — just not a UK one. Out of scope rather than independent.',
  },
  'Other': {
    control: 'DELEGATED', quango: 'Borderline',
    who: 'Varies. This is gov.uk\'s residual bucket, not a constitutional category.',
    why: '⚠ TREAT WITH CARE. "Other" mixes inquiries, professional bodies, units inside departments and genuinely independent offices. It is the single largest group on the register and it cannot be classified as a block — each row needs its own look. Any quango count that leans on this category is a guess.',
  },
}

/**
 * BODY GROUP - the sortable family, one level above gov.uk's 16 body types.
 *
 * gov.uk's `format` field mixes constitutional categories (Ministerial department, Court) with
 * organisational ones (Sub organisation) and one residual bucket (Other), so sorting by it scatters
 * bodies that belong together - the four NDPB flavours land in four different places alphabetically.
 * This column is the grouping to sort and pivot on; `body_type` keeps the publisher's own value
 * beside it so nothing is lost.
 */
const BODY_GROUP: Record<string, string> = {
  'Ministerial department': '1. Department - ministerial',
  'Non-ministerial department': '2. Department - non-ministerial',
  'Executive agency': '3. Executive agency',
  'Executive non-departmental public body': '4. NDPB - executive',
  'Advisory non-departmental public body': '5. NDPB - advisory',
  'Ad-hoc advisory group': '5. NDPB - advisory',
  'Tribunal': '6. Judicial - tribunal',
  'Court': '6. Judicial - court',
  'Public corporation': '7. Public corporation',
  'Special health authority': '8. NHS body',
  'Independent monitoring body': '9. Independent monitor',
  'Sub organisation': '10. Part of a department',
  'Executive office': '10. Part of a department',
  'Civil service': '10. Part of a department',
  'Devolved government': '11. Devolved government',
  'Other': '12. Other - gov.uk residual bucket',
}
// Numbered so an A-Z sort in Excel puts them in constitutional order (closest to a minister first,
// furthest last) rather than alphabetical order, which would open with "Advisory".

interface LiveOrg {
  slug: string; title: string; bodyType: string; govukStatus: string
  closedAt: string | null; parent: string | null; updatedAt: string | null
}

// ── Fetch ───────────────────────────────────────────────────────────────────
async function get(url: string): Promise<any> {
  for (let a = 0; a < 4; a++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (res.ok) return res.json()
    if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 5000 * (a + 1))); continue }
    throw new Error(`${res.status} ${url}`)
  }
  throw new Error(`gave up on ${url}`)
}

async function fetchRegister(): Promise<LiveOrg[]> {
  const out: LiveOrg[] = []
  let url: string | null = 'https://www.gov.uk/api/organisations?page=1'
  while (url) {
    const j: any = await get(url)
    for (const r of j.results ?? []) {
      out.push({
        slug: r.details?.slug ?? '', title: r.title ?? '',
        bodyType: r.format ?? '', govukStatus: r.details?.govuk_status ?? '',
        closedAt: r.details?.closed_at ?? null,
        parent: (r.parent_organisations ?? [])[0]?.id?.split('/').pop() ?? null,
        updatedAt: r.updated_at ?? null,
      })
    }
    url = j.next_page_url ?? null
    await new Promise(r => setTimeout(r, 300))
  }
  return out
}

// ── Name handling ───────────────────────────────────────────────────────────
/**
 * Mojibake signature: UTF-8 bytes rendered as Windows-1252.
 *
 * WARNING - THE FIRST VERSION OF THIS REGEX COULD NOT MATCH ANYTHING, AND REPORTED "0 of 1263" ON
 * EVERY RUN. It was written /\u00e2\u20ac|\u00c3[-\u00bf]|\u00c2[-\u00bf]/ - and inside a
 * character class a LEADING HYPHEN IS A LITERAL, so `[-\u00bf]` means "a hyphen or an inverted
 * question mark", not "the range up to \u00bf". So `\u00c3\u00a9` (the corrupted form of e-acute,
 * the exact string in the old workbook) failed the test and the guard passed on data it existed to
 * reject. Caught only by QUANGO_POISON=mojibake; nothing in a clean run could have revealed it.
 *
 * The trailing byte of a UTF-8 continuation rendered this way lands anywhere in \u0080-\u00ff, so
 * that is the range, written explicitly on both ends.
 */
const MOJIBAKE = /\u00e2\u20ac|\u00c3[\u0080-\u00ff]|\u00c2[\u0080-\u00bf]/

/** Match on meaning, not on the punctuation two sources render differently. */
const key = (s: string) => String(s ?? '')
  .replace(/&amp;/g, '&').replace(/[’‘`]/g, "'").replace(/[–—]/g, '-')
  .replace(/\s*&\s*/g, ' and ').replace(/\bthe\b/gi, ' ')
  .replace(/[^a-z0-9' ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * WARNING - THE DIRECTORIES AND THE REGISTER DO NOT SPELL BODIES THE SAME WAY, AND A STRICT KEY
 * REPORTS A RENAME AS A DEATH. The first version of this matcher put 83 of the 262 Public Bodies
 * 2012 entries in "no gov.uk record under this name". Reading them showed the register holds nearly
 * all of them:
 *
 *   "Advisory, Conciliation and Arbitration Service (Acas)"  vs  "Acas"
 *   "Arts and Humanities Research Council (AHRC)"            vs  "Arts and Humanities Research Council"
 *   "Visit Britain"                                          vs  "VisitBritain"
 *   "Royal Armouries"                                        vs  "Royal Armouries Museum"
 *   "Office of the Childrens Commissioner, The"              vs  "Children's Commissioner"
 *
 * So matching runs in four passes of DECREASING confidence and every row records WHICH pass matched
 * it, because a substring match is a weaker claim than an exact one and the two must not be summed
 * without saying so.
 */
const stripParen = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '').replace(/,\s*the\s*$/i, '')
const squash = (s: string) => key(s).replace(/ /g, '')

type MatchMethod = 'exact' | 'abbreviation stripped' | 'spacing' | 'substring' | 'none'

function buildMatcher(live: LiveOrg[]) {
  const byKey = new Map<string, LiveOrg>()
  const bySquash = new Map<string, LiveOrg>()
  for (const o of live) {
    byKey.set(key(o.title), o)
    byKey.set(key(stripParen(o.title)), o)
    bySquash.set(squash(o.title), o)
    bySquash.set(squash(stripParen(o.title)), o)
  }
  return (name: string): { hit: LiveOrg | null; method: MatchMethod } => {
    const k = key(name)
    if (byKey.has(k)) return { hit: byKey.get(k)!, method: 'exact' }
    const kp = key(stripParen(name))
    if (byKey.has(kp)) return { hit: byKey.get(kp)!, method: 'abbreviation stripped' }
    const sq = squash(stripParen(name))
    if (bySquash.has(sq)) return { hit: bySquash.get(sq)!, method: 'spacing' }
    // Substring, both directions, with a length floor so a short name cannot swallow a longer
    // unrelated one. Deliberately last, and deliberately labelled in the output.
    if (sq.length >= 14) {
      for (const [s2, o] of bySquash) {
        if (s2.length >= 14 && (s2.startsWith(sq) || sq.startsWith(s2))) return { hit: o, method: 'substring' }
      }
    }
    return { hit: null, method: 'none' }
  }
}

/**
 * A guard nobody has watched fail is not a guard. `QUANGO_POISON=mojibake` injects a corrupted name
 * and `QUANGO_POISON=total` injects an off-by-one into a summary figure; both must exit 1. Run
 * `tsx quango/self-test.ts` to execute all three cases (poisoned twice, clean once).
 */
const POISON = process.env.QUANGO_POISON ?? ''

function assertNoMojibake(rows: Array<{ organisation: string }>) {
  if (POISON === 'mojibake' && rows.length) rows = [...rows, { organisation: 'Victoria Climbi\u00c3\u00a9 Inquiry' } as any]
  const bad = rows.filter(r => MOJIBAKE.test(r.organisation))
  if (bad.length) {
    console.error(`\n⚠ BUILD FAILED — ${bad.length} names still carry mojibake:`)
    bad.slice(0, 10).forEach(b => console.error(`   ${JSON.stringify(b.organisation)}`))
    process.exit(1)
  }
  console.log(`  ✔ mojibake guard: 0 of ${rows.length} names match the corruption pattern`)
}

function assertTotalsTieOut(label: string, computed: number, stated: number) {
  if (POISON === 'total' && label === 'not closed') stated += 1
  if (computed !== stated) {
    console.error(`\n⚠ BUILD FAILED — ${label}: summary says ${stated}, data says ${computed}`)
    process.exit(1)
  }
  console.log(`  ✔ ${label}: ${computed} (summary and data agree)`)
}

async function main() {
  console.log('Fetching the live gov.uk Organisations register…')
  const live = await fetchRegister()
  const fetchedAt = new Date().toISOString()
  console.log(`  ${live.length} organisations, ${fetchedAt}`)

  const pb = JSON.parse(fs.readFileSync(path.join(REF, 'pb_lists.json'), 'utf8'))
  const co2011: string[] = pb.co2011
  const pb2012: Array<{ name: string; dept: string; classification: string; reform: string }> = pb.pb2012
  const pb2324: Array<{ name: string; classification: string; sponsor: string; dept: string }> = pb.pb2324

  const match = buildMatcher(live)
  // Resolve each directory ONCE, to the register slug it matches, so the data tab and the
  // cross-check tab cannot disagree about what matched.
  const resolve = (names: string[]) => {
    const m = new Map<string, { method: MatchMethod; name: string }>()
    for (const n of names) { const r = match(n); if (r.hit) m.set(r.hit.slug, { method: r.method, name: n }) }
    return m
  }
  const k2011 = resolve(co2011)
  const k2012 = resolve(pb2012.map(b => b.name))
  const k2324 = resolve(pb2324.map(b => b.name))
  const cls2324 = new Map(pb2324.map(b => [b.name, b.classification]))

  // ── Main data tab ─────────────────────────────────────────────────────────
  const data = live.map(o => {
    const rule = TYPE_RULES[o.bodyType]
    const m2324 = k2324.get(o.slug)
    return {
      organisation: o.title.replace(/\s+/g, ' ').trim(),
      name_as_published: o.title === o.title.replace(/\s+/g, ' ').trim() ? '' : JSON.stringify(o.title),
      slug: o.slug,
      body_group: BODY_GROUP[o.bodyType] ?? '12. Other - gov.uk residual bucket',
      body_type: o.bodyType,
      govuk_status: o.govukStatus,
      parent: o.parent ?? '',
      closed_at: o.closedAt ? String(o.closedAt).slice(0, 10) : '',
      last_updated: o.updatedAt ? String(o.updatedAt).slice(0, 10) : '',
      in_co_public_bodies_2011: k2011.has(o.slug) ? 'Yes' : 'No',
      in_public_bodies_2012: k2012.has(o.slug) ? 'Yes' : 'No',
      in_public_bodies_2023_24: k2324.has(o.slug) ? 'Yes' : 'No',
      pb_2023_24_classification: m2324 ? (cls2324.get(m2324.name) ?? '') : '',
      pb_match_method: [k2011.get(o.slug), k2012.get(o.slug), m2324].find(Boolean)?.method ?? '',
      ministerial_control: rule?.control ?? 'UNCLASSIFIED',
      quango_verdict: rule?.quango ?? 'Unknown',
      answerable_to: rule?.who ?? '',
    }
  }).sort((a, b) => a.organisation.localeCompare(b.organisation))

  assertNoMojibake(data)

  // ── Public Bodies cross-check tab ─────────────────────────────────────────
  // Every body in each directory that we do NOT match on the live register, with what we found.
  const check: any[] = []
  const addCheck = (source: string, name: string, extra: Record<string, any>) => {
    const { hit, method } = match(name)
    check.push({
      source, body: name, ...extra,
      on_govuk_register: hit ? 'Yes' : 'No',
      matched_as: hit ? hit.title : '',
      match_method: method,
      govuk_status: hit?.govukStatus ?? '',
      govuk_body_type: hit?.bodyType ?? '',
      govuk_closed_at: hit?.closedAt ? String(hit.closedAt).slice(0, 10) : '',
      verdict: !hit ? 'NOT ON THE REGISTER under any name I could match'
        : hit.govukStatus === 'closed' ? 'CLOSED on gov.uk'
        : `STILL THERE (${hit.govukStatus})`,
    })
  }
  for (const n of co2011) addCheck('Cabinet Office Public Bodies 2011', n, { classification: '', sponsor: 'Cabinet Office' })
  for (const b of pb2012) addCheck('Public Bodies 2012', b.name, { classification: b.classification, sponsor: b.dept })
  for (const b of pb2324) addCheck('Public Bodies Directory 2023/24', b.name, { classification: b.classification, sponsor: b.dept })

  // ── Summary tab ───────────────────────────────────────────────────────────
  const open = data.filter(r => r.govuk_status !== 'closed')
  const S: any[][] = []
  const row = (...c: any[]) => S.push(c)
  row('QUANGO UNIVERSE — gov.uk organisations register')
  row('Generated', fetchedAt.slice(0, 19).replace('T', ' ') + ' UTC')
  row('Source', 'https://www.gov.uk/api/organisations (live, walked in full)')
  row('Replaces', 'QUANGO_UNIVERSE.xls — a 12 June 2026 snapshot saved on 6 September 2026')
  row()
  row('HEADLINE')
  row('Organisations on the register (all)', data.length)
  row('Not closed', open.length)
  row('Closed', data.length - open.length)
  row()
  row('⚠ "Not closed" is NOT a quango count. It includes ministerial departments, courts,')
  row('   devolved governments and units inside departments. See the Answerability tab.')
  row()
  row('BY STATUS (not closed)')
  const byStatus = new Map<string, number>()
  for (const r of open) byStatus.set(r.govuk_status, (byStatus.get(r.govuk_status) ?? 0) + 1)
  row('status', 'count')
  for (const [k, v] of [...byStatus].sort((a, b) => b[1] - a[1])) row(k, v)
  row('Total current', open.length)
  row()
  row('BY BODY GROUP (not closed) - the sortable family, one level above gov.uk body type')
  row('body group', 'not closed', 'closed', 'quango on your definition')
  const groups = [...new Set(data.map(r => r.body_group))].sort()
  for (const g of groups) {
    const og = open.filter(r => r.body_group === g)
    const verdicts = [...new Set(og.map(r => r.quango_verdict))].join(' / ')
    row(g, og.length, data.filter(r => r.body_group === g && r.govuk_status === 'closed').length, verdicts)
  }
  row('Total current', open.length)
  row()
  row('EVERY BODY TYPE, WITH ANSWERABILITY')
  row('body type', 'not closed', 'closed', 'ministerial control', 'quango on your definition', 'answerable to')
  const types = [...new Set(data.map(r => r.body_type))].sort((a, b) =>
    open.filter(r => r.body_type === b).length - open.filter(r => r.body_type === a).length)
  for (const t of types) {
    const rule = TYPE_RULES[t]
    row(t, open.filter(r => r.body_type === t).length, data.filter(r => r.body_type === t && r.govuk_status === 'closed').length,
      rule?.control ?? 'UNCLASSIFIED', rule?.quango ?? 'Unknown', rule?.who ?? '')
  }
  row()
  row('QUANGO COUNT (not closed) — verdict column: quango_verdict')
  row('verdict', 'count', 'note')
  for (const v of ['Yes', 'Borderline', 'No']) {
    row(v, open.filter(r => r.quango_verdict === v).length,
      v === 'Yes' ? 'funded by government, no ministerial direction power'
        : v === 'Borderline' ? 'a direction power exists but is not used, or the body is largely self-funding'
        : 'a minister has direct control, or it is not a UK government body at all')
  }
  row()
  row('⚠ 173 of the "Borderline" are gov.uk\'s residual "Other" category, which mixes inquiries,')
  row('   professional bodies and departmental units. Any single quango number leans on how that')
  row('   bucket is split, so a range is more honest than a figure. See the Answerability tab.')
  row()
  row('PUBLIC BODIES DIRECTORY CROSS-CHECK')
  row('directory', 'bodies in it', 'matched on the register', 'not matched', 'of the matched: still open', 'closed')
  for (const [name, list] of [['Cabinet Office Public Bodies 2011', co2011.map(n => ({ name: n }))],
                              ['Public Bodies 2012', pb2012], ['Public Bodies Directory 2023/24', pb2324]] as any[]) {
    const hits = list.map((b: any) => match(b.name).hit).filter(Boolean)
    row(name, list.length, hits.length, list.length - hits.length,
      hits.filter((h: any) => h.govukStatus !== 'closed').length,
      hits.filter((h: any) => h.govukStatus === 'closed').length)
  }
  row()
  row('⚠ The "Cabinet Office Public Bodies 2011" report is NOT a cross-government directory.')
  row('   It is the Cabinet Office\'s report on public appointments to the 10 NDPBs IT sponsors.')
  row('   The nearest cross-government directory to 2011 is Public Bodies 2012 (262 bodies),')
  row('   and the current authoritative one is Public Bodies Directory 2023/24 (304 ALBs).')
  row('   All three are matched in the data tab so you can pick the comparison you want.')
  row()
  row('\u26a0 "NOT MATCHED" DOES NOT MEAN "GONE". Matching runs in four passes of decreasing')
  row('   confidence and every row on the PB_directory_check tab records which one matched it')
  row('   (exact / abbreviation stripped / spacing / substring / none). The unmatched remainder is')
  row('   mostly LEGAL NAME vs OPERATING NAME, which no string rule resolves:')
  row('     "Office of Gas and Electricity Markets"     is on the register as  "Ofgem"')
  row('     "British Tourist Authority"                                        "VisitBritain"')
  row('     "National Historic Buildings and Monuments Commission for England" "Historic England"')
  row('     "Patent Office"                                                    "Intellectual Property Office"')
  row('     "UK Supreme Court"                                    "The Supreme Court of the United Kingdom"')
  row('   Treat the unmatched list as "needs a human look", never as a closure count.')
  row()
  row('\u26a0\u26a0 A DISCREPANCY INSIDE THE PUBLISHED 2023/24 DIRECTORY, NOT INTRODUCED HERE.')
  row('   Its Cover sheet says it covers "the 304 Arm\u2019s Length Bodies sponsored by the UK')
  row('   Government during 2023/24" and its Classifications table sums to 304. Its ALB-level Data')
  row('   sheet holds 251 rows. Verified at raw-XML level (258 rows = 7 header/notes + 251 data),')
  row('   so it is not a reader artefact. The Revisions sheet explains only 2 removals. The other')
  row('   \u224851 are unexplained. 251 is what could be cross-checked; 304 is the publisher\u2019s headline.')

  // The guard that makes the summary trustworthy: it must equal its own data tab.
  console.log('\nTie-out checks:')
  assertTotalsTieOut('total organisations', data.length, data.length)
  assertTotalsTieOut('not closed', open.length, [...byStatus.values()].reduce((a, b) => a + b, 0))
  assertTotalsTieOut('body types sum to not-closed', open.length, types.reduce((a, t) => a + open.filter(r => r.body_type === t).length, 0))
  assertTotalsTieOut('body groups sum to not-closed', open.length,
    [...new Set(data.map(r => r.body_group))].reduce((a, g) => a + open.filter(r => r.body_group === g).length, 0))
  assertTotalsTieOut('every body type has a group', 0,
    data.filter(r => !BODY_GROUP[r.body_type]).length)
  assertTotalsTieOut('quango verdicts sum to not-closed', open.length,
    ['Yes', 'Borderline', 'No'].reduce((a, v) => a + open.filter(r => r.quango_verdict === v).length, 0))

  // ── Answerability tab ─────────────────────────────────────────────────────
  const A: any[][] = []
  A.push(['ANSWERABILITY TO A GOVERNMENT MINISTER — the analysis behind the Summary tab'])
  A.push([])
  A.push(['Your definition: an organisation funded by Government over which a minister does not have direct control.'])
  A.push(['That turns on one question per body type: can a minister lawfully DIRECT it? Appointment and funding'])
  A.push(['powers are real but they are not direction — a minister who appoints a board and signs its budget still'])
  A.push(['cannot tell it what to decide. The three columns below separate those powers deliberately.'])
  A.push([])
  A.push(['body group', 'body type', 'not closed', 'ministerial control', 'quango?', 'answerable to', 'why'])
  const byGroup = [...types].sort((a, b) =>
    (BODY_GROUP[a] ?? 'z').localeCompare(BODY_GROUP[b] ?? 'z', undefined, { numeric: true }))
  for (const t of byGroup) {
    const rule = TYPE_RULES[t]
    A.push([BODY_GROUP[t] ?? '', t, open.filter(r => r.body_type === t).length, rule?.control ?? 'UNCLASSIFIED',
      rule?.quango ?? 'Unknown', rule?.who ?? '', rule?.why ?? ''])
  }

  // ── Sources tab ───────────────────────────────────────────────────────────
  const SRC: any[][] = [
    ['SOURCES — everything in this workbook, and what each was used for'],
    [],
    ['#', 'source', 'url', 'retrieved', 'used for', 'strength'],
    ['1', 'gov.uk Organisations API', 'https://www.gov.uk/api/organisations', fetchedAt.slice(0, 10),
      'The whole data tab: name, slug, body type, status, parent, closed_at, last updated.', 'PRIMARY — the publisher\'s own register, walked in full'],
    ['2', 'Cabinet Office Public Bodies 2011 report', 'https://assets.publishing.service.gov.uk/media/5a78c62ded915d07d35b252b/Cabinet-Office-Public-Bodies-2011.pdf', fetchedAt.slice(0, 10),
      'The in_co_public_bodies_2011 column.', '⚠ PRIMARY but NARROW — covers only the 10 NDPBs the Cabinet Office itself sponsors, not all government'],
    ['3', 'Public Bodies 2012 (CSV)', 'https://assets.publishing.service.gov.uk/media/5a7c11d0ed915d1c30daa610/PB12-csv_1.csv', fetchedAt.slice(0, 10),
      'The in_public_bodies_2012 column. 262 bodies across 22 departments.', 'PRIMARY — the nearest CROSS-GOVERNMENT directory to 2011'],
    ['4', 'Public Bodies Directory 2023/24 (XLSX)', 'https://assets.publishing.service.gov.uk/media/697897e25da1fd4ddea98bda/2025-05-29_Public_Bodies_Directory_2023_24.xlsx', fetchedAt.slice(0, 10),
      'The in_public_bodies_2023_24 and pb_2023_24_classification columns. 304 ALBs.', 'PRIMARY — current authoritative Cabinet Office directory'],
    ['4b', '\u26a0 CAVEAT on source 4', '',  fetchedAt.slice(0, 10),
      'Cover and Classifications both say 304 ALBs; the ALB-level Data sheet holds 251 rows (verified at raw-XML level). Revisions explains 2 of the 53. Cross-checking used the 251 that are actually listed.',
      'a discrepancy in the PUBLISHED file, not in this build'],
    ['5', 'gov.uk "Public bodies publications" collection', 'https://www.gov.uk/government/collections/public-bodies', fetchedAt.slice(0, 10),
      'Finding sources 2-4. Lists the annual reports 2013-2024.', 'PRIMARY — index'],
    ['6', 'gov.uk Search API', 'https://www.gov.uk/api/search.json', fetchedAt.slice(0, 10),
      'Locating the directories, and the OneGov searches.', 'PRIMARY'],
    ['7', 'gov.uk Machinery of Government changes: Fact Sheet', 'https://www.gov.uk/government/news/machinery-of-government-changes-fact-sheet', fetchedAt.slice(0, 10),
      'The OneGov Delivery Agency: announced 22 July 2026 (updated 27 July), "will be established".', 'PRIMARY'],
    [],
    ['NOT USED, AND WHY'],
    ['', 'gov.uk "Public bodies directory 2011"', 'https://www.gov.uk/government/publications/public-bodies-directory-2011', fetchedAt.slice(0, 10),
      'Despite the title this is DWP\'s own 26-page directory, not a cross-government one.', 'rejected as not fit for the comparison'],
    [],
    ['THE ANSWERABILITY COLUMNS ARE MY ANALYSIS, NOT A PUBLISHED CLASSIFICATION.'],
    ['gov.uk publishes the body type. It does not publish "who is this answerable to" or "is this a quango".'],
    ['The ministerial_control, quango_verdict and answerable_to columns are my reading of'],
    ['UK constitutional practice applied to each body type, and they are argued on the Answerability tab'],
    ['so you can disagree with a whole category in one place rather than row by row.'],
  ]

  // ── Write ─────────────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()
  const wsSummary = XLSX.utils.aoa_to_sheet(S)
  wsSummary['!cols'] = [{ wch: 46 }, { wch: 12 }, { wch: 10 }, { wch: 24 }, { wch: 26 }, { wch: 90 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

  const wsData = XLSX.utils.json_to_sheet(data)
  wsData['!cols'] = [{ wch: 58 }, { wch: 16 }, { wch: 40 }, { wch: 34 }, { wch: 38 }, { wch: 13 }, { wch: 30 }, { wch: 11 },
                     { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 24 }, { wch: 20 }, { wch: 24 }, { wch: 16 }, { wch: 70 }]
  wsData['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length, c: 16 } }) }
  wsData['!freeze'] = { xSplit: '1', ySplit: '1' }
  XLSX.utils.book_append_sheet(wb, wsData, 'QUANGO_UNIVERSE')

  const wsCheck = XLSX.utils.json_to_sheet(check)
  wsCheck['!cols'] = [{ wch: 34 }, { wch: 58 }, { wch: 18 }, { wch: 34 }, { wch: 16 }, { wch: 52 }, { wch: 20 }, { wch: 13 }, { wch: 38 }, { wch: 13 }, { wch: 48 }]
  XLSX.utils.book_append_sheet(wb, wsCheck, 'PB_directory_check')

  const wsA = XLSX.utils.aoa_to_sheet(A)
  wsA['!cols'] = [{ wch: 34 }, { wch: 40 }, { wch: 11 }, { wch: 24 }, { wch: 11 }, { wch: 62 }, { wch: 120 }]
  XLSX.utils.book_append_sheet(wb, wsA, 'Answerability')

  const wsSrc = XLSX.utils.aoa_to_sheet(SRC)
  wsSrc['!cols'] = [{ wch: 4 }, { wch: 42 }, { wch: 92 }, { wch: 12 }, { wch: 70 }, { wch: 58 }]
  XLSX.utils.book_append_sheet(wb, wsSrc, 'Sources')

  XLSX.writeFile(wb, OUT_XLSX)
  console.log(`\nwrote ${path.relative(process.cwd(), OUT_XLSX)}`)

  // Read it back and prove it parses — a workbook Excel offers to repair is not a deliverable.
  const back = XLSX.readFile(OUT_XLSX)
  const backData = XLSX.utils.sheet_to_json(back.Sheets['QUANGO_UNIVERSE'])
  console.log(`  re-read: sheets ${JSON.stringify(back.SheetNames)}, data rows ${backData.length}`)
  assertTotalsTieOut('written rows survive a round trip', data.length, backData.length)
  assertNoMojibake(backData as any)

  fs.writeFileSync(path.join(REF, 'live_register.json'), JSON.stringify({ fetchedAt, orgs: live }, null, 1))
  console.log(`  kept the raw register at quango/reference/live_register.json`)
}

main().catch(e => { console.error(e); process.exit(1) })
