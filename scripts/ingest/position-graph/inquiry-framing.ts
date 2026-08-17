/**
 * inquiry-framing.ts — BRIEF_GRAPH_2D5 §3: what the committee asked is context, and we throw it away.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE POINT, IN CHARLIE'S WORDS
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * "If the committee was itself biased in one direction and phrased the question so that neutrality
 * is itself a position that is not neutral in the wider context."
 *
 * An inquiry titled "How should the Government implement X" has already conceded X. A submission
 * that engages neutrally with *how* has accepted *whether*, and recording that as "balanced"
 * misrepresents it.
 *
 * ⚠⚠ WE DO NOT ADJUST THE POSITION FOR IT, AND THAT IS THE WHOLE DESIGN OF THIS FILE.
 * §3: "Adjusting would be us inferring a bias correction and presenting it as data. Record the
 * framing next to the position and let the reader see both." So this writes ONE table, keyed by
 * inquiry, and nothing in it is ever joined into a polarity. `verify-2d5.ts` asserts that no
 * position row gained a column and that no code reads framing to change a polarity.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHERE THE FRAMING COMES FROM — AND WHY NOT THE OBVIOUS PLACE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The inquiry page `committees.parliament.uk/work/{ref}/` is the obvious source and it is behind
 * Cloudflare: every programmatic GET returns 403 with a "Just a moment…" challenge page. That is a
 * block on us, not a missing document.
 *
 * `committees-api.parliament.uk/api/CommitteeBusiness/{ref}` is the SAME record, is not challenged,
 * and carries the field we want. ⚠ It is called `scope`, not `termsOfReference` — the endpoint has
 * no field by that name, and looking for one is how this gets recorded as unavailable.
 *
 * ⚠ AND THE SCOPE IS SOMETIMES NOT THE FRAMING. Inquiry 277's entire scope reads "The Committee held
 * its last oral evidence session in connection with this inquiry on Tuesday 30 June 2020." That is
 * an administrative status note that has REPLACED the terms of reference. It is stored as-is and
 * flagged, because a 106-character scope presented as an inquiry's framing would be worse than no
 * scope at all.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/inquiry-framing.ts --self-test
 *   npx tsx position-graph/inquiry-framing.ts --sample     # the 12 behind the hand-scored fifty
 *   npx tsx position-graph/inquiry-framing.ts --area       # every inquiry in the area
 *   npx tsx position-graph/inquiry-framing.ts --report
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { decodeHtmlEntities } from '../shared/html-entities'

export {}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)

const API = 'https://committees-api.parliament.uk/api/CommitteeBusiness'
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; scrutinise-research/1.0; +https://www.scrutinise.org)' }

const DDL = `
CREATE TABLE IF NOT EXISTS graph_inquiry (
  inquiry_ref   TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  committee     TEXT,
  business_type TEXT,
  open_date     DATE,
  close_date    DATE,
  scope         TEXT,
  scope_chars   INTEGER,
  -- ⚠ TRUE when the scope is an administrative note rather than terms of reference. Stated as a
  -- judgement with its rule attached, not as a fact about the inquiry.
  scope_is_status BOOLEAN NOT NULL DEFAULT FALSE,
  -- ⚠ TRUE when the published framing is the Committee's OWN REPORT CONCLUSION. See below.
  scope_is_conclusion BOOLEAN NOT NULL DEFAULT FALSE,
  source_url    TEXT,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ⚠ CREATE TABLE IF NOT EXISTS does NOT add a column to a table that already exists, so a
-- second-run column arrives here. Additive only; nothing is dropped or retyped.
ALTER TABLE graph_inquiry ADD COLUMN IF NOT EXISTS scope_is_conclusion BOOLEAN NOT NULL DEFAULT FALSE;`

/**
 * ⚠ A SCOPE THAT IS REALLY A STATUS NOTE.
 *
 * Rule, stated so it can be argued with: under 200 characters AND matching a past-tense
 * administrative phrase. Both conditions, because a genuinely terse terms of reference exists and a
 * long page that mentions a closing date is still terms of reference. Inquiry 277 is the worked
 * example — 106 characters, "held its last oral evidence session".
 */
export function scopeIsStatusNote(scope: string): boolean {
  const s = scope.trim()
  if (s.length >= 200) return false
  return /\b(held its last|has concluded|this inquiry (is now )?closed|no longer accepting|inquiry has ended|report was published)\b/i.test(s)
}

/**
 * ⚠⚠ THE SHARPEST FORM OF §3's POINT, AND IT IS A FACT RATHER THAN A READING.
 *
 * On some inquiries the published "scope" is not terms of reference at all — it is the Committee's
 * OWN REPORT, quoted as the framing. Inquiry 3005's entire scope is: "Primary care is the bedrock of
 * the NHS … but it is under unprecedented strain and struggling to keep pace with relentlessly
 * rising demand, WARNS THE HEALTH COMMITTEE IN ITS REPORT." Inquiry 2912's opens "Schools and
 * colleges struggle to provide adequate time and resource … ACCORDING TO the Health and Education
 * Committees IN A JOINT REPORT published today."
 *
 * ⚠ This detects an ATTRIBUTION PHRASE, which is a fact about the text — not a judgement about
 * whether the inquiry is biased. Charlie's point ("the committee phrased the question so that
 * neutrality is itself a position") does not need us to grade bias in order to be recorded: it is
 * enough to show the reader that the question came with a conclusion already attached, and let them
 * decide. That is the §3 discipline — show the working, do not do the reasoning for the user.
 */
export function scopeIsReportConclusion(scope: string): boolean {
  return /\b(warns?|says?|according to|concludes?|finds?|found)\b[^.]{0,80}\bcommittees?\b[^.]{0,80}\b(report|inquiry report)\b/i.test(scope)
    || /\bcommittees?\b[^.]{0,60}\b(warns?|concludes?|says?)\b[^.]{0,60}\bin (its|their) report\b/i.test(scope)
    || /\bin a joint report published\b/i.test(scope)
}

/** The API returns HTML in `scope`. Strip it without inventing whitespace where none existed. */
export function plainScope(html: string): string {
  return decodeHtmlEntities(
    String(html ?? '')
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '· ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  ).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

interface Framing {
  ref: string; title: string; committee: string | null; type: string | null
  open: string | null; close: string | null; scope: string; statusNote: boolean
  conclusion: boolean; ok: boolean
}

export async function fetchFraming(ref: string): Promise<Framing | null> {
  const res = await fetch(`${API}/${ref}`, { headers: UA })
  if (!res.ok) { console.log(`  ⚠ ${ref}: HTTP ${res.status}`); return null }
  const j: any = await res.json()
  const scope = plainScope(j.scope ?? '')
  return {
    ref,
    title: String(j.title ?? '').trim(),
    committee: j.committee?.name ?? j.committees?.[0]?.name ?? null,
    type: j.type?.name ?? (typeof j.type === 'string' ? j.type : null),
    open: j.openDate ? String(j.openDate).slice(0, 10) : null,
    close: j.closeDate ? String(j.closeDate).slice(0, 10) : null,
    scope,
    statusNote: scopeIsStatusNote(scope),
    conclusion: scopeIsReportConclusion(scope),
    ok: true,
  }
}

async function sweep(which: 'sample' | 'area') {
  const pool = getNeonPool()
  for (const st of DDL.split(/;\s*\n/).filter((s) => s.trim())) await pool.query(st)

  const sql = which === 'sample'
    ? `SELECT DISTINCT p.inquiry_ref FROM graph_position p
         JOIN graph_position_review r ON r.position_id = p.id ORDER BY 1`
    : `SELECT DISTINCT inquiry_ref FROM graph_position ORDER BY 1`
  const { rows } = await pool.query<{ inquiry_ref: string }>(sql)
  console.log(`\n════ INQUIRY FRAMING — ${rows.length} inquiries (${which}) ════`)
  console.log('  source: committees-api CommitteeBusiness/{ref}.scope')
  console.log('  ⚠ the /work/{ref}/ page itself is Cloudflare-blocked (403 "Just a moment…") — the API is not\n')

  let got = 0; let missing = 0; let status = 0; let concl = 0
  for (const { inquiry_ref: ref } of rows) {
    const f = await fetchFraming(ref)
    if (!f) { missing++; continue }
    if (f.statusNote) status++
    if (f.conclusion) concl++
    if (f.scope) got++
    await pool.query(
      `INSERT INTO graph_inquiry (inquiry_ref, title, committee, business_type, open_date, close_date,
         scope, scope_chars, scope_is_status, scope_is_conclusion, source_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (inquiry_ref) DO UPDATE SET title=EXCLUDED.title, committee=EXCLUDED.committee,
         business_type=EXCLUDED.business_type, open_date=EXCLUDED.open_date, close_date=EXCLUDED.close_date,
         scope=EXCLUDED.scope, scope_chars=EXCLUDED.scope_chars, scope_is_status=EXCLUDED.scope_is_status,
         scope_is_conclusion=EXCLUDED.scope_is_conclusion, fetched_at=now()`,
      [ref, f.title, f.committee, f.type, f.open, f.close, f.scope || null, f.scope.length,
        f.statusNote, f.conclusion, `https://committees.parliament.uk/work/${ref}/`])
    const tag = f.statusNote ? '⚠status    ' : f.conclusion ? '⚠⚠CONCLUSION' : '            '
    console.log(`  ${ref.padStart(5)}  ${String(f.scope.length).padStart(5)}c ${tag}  ${f.title.slice(0, 62)}`)
  }
  console.log(`\n  stored ${rows.length - missing} · with a scope ${got} · ⚠ status note ${status}`
    + ` · ⚠⚠ the Committee's own report conclusion ${concl} · unreachable ${missing}`)
  await endNeonPool()
}

async function report() {
  const pool = getNeonPool()
  const { rows } = await pool.query<{
    inquiry_ref: string; title: string; scope: string | null; scope_is_status: boolean
    scope_is_conclusion: boolean; open_date: string | null; n: string
  }>(`
    SELECT i.inquiry_ref, i.title, i.scope, i.scope_is_status, i.scope_is_conclusion, i.open_date::text,
           (SELECT count(*) FROM graph_position p WHERE p.inquiry_ref = i.inquiry_ref)::text n
    FROM graph_inquiry i ORDER BY i.title`)
  console.log(`\n════ THE FRAMING, BESIDE THE POSITIONS IT SHOULD BE READ WITH ════`)
  console.log('  ⚠ Nothing below adjusts a polarity. It is context for a reader, per §3.\n')
  for (const r of rows) {
    console.log(`── ${r.title}`)
    console.log(`   ref ${r.inquiry_ref} · opened ${r.open_date ?? '?'} · ${Number(r.n).toLocaleString('en-GB')} position rows`)
    if (!r.scope) console.log('   ⚠ NO SCOPE PUBLISHED — the framing is the title alone')
    else if (r.scope_is_status) console.log(`   ⚠ SCOPE IS A STATUS NOTE, NOT TERMS OF REFERENCE: "${r.scope}"`)
    else if (r.scope_is_conclusion) {
      console.log(`   ⚠⚠ THE FRAMING IS THE COMMITTEE'S OWN REPORT CONCLUSION, not a question:`)
      console.log(`   ${r.scope.replace(/\s+/g, ' ').slice(0, 480)}`)
    }
    else console.log(`   ${r.scope.replace(/\n+/g, ' ').slice(0, 500)}${r.scope.length > 500 ? '…' : ''}`)
    console.log()
  }
  await endNeonPool()
}

// ── offline self-test ───────────────────────────────────────────────────────────────────────────
function selftest() {
  const cases: Array<[string, boolean]> = [
    ['html is stripped', plainScope('<p>The Committee has launched</p>') === 'The Committee has launched'],
    ['a list item keeps a marker', plainScope('<ul><li>one</li><li>two</li></ul>').includes('· one')],
    ['paragraphs become newlines, not run-on words',
      plainScope('<p>one</p><p>two</p>') === 'one\ntwo'],
    ['entities are decoded by the shared decoder',
      plainScope('<p>Children&#8217;s services</p>') === 'Children’s services'],
    ['a numeric nbsp does not survive as an entity', !plainScope('<p>a&#xa0;b</p>').includes('&#')],
    // ⚠ the status-note rule, both directions
    ['⚠ inquiry 277\'s real scope is called a status note',
      scopeIsStatusNote('The Committee held its last oral evidence session in connection with this inquiry on Tuesday 30 June 2020.')],
    ['⚠ a SHORT but genuine terms of reference is NOT called a status note',
      !scopeIsStatusNote('The Committee invites evidence on the future funding of adult social care.')],
    ['⚠ a LONG scope that mentions a concluded session is NOT called a status note',
      !scopeIsStatusNote('The Committee has concluded '.padEnd(250, 'x'))],
    ['an empty scope is not a status note (it is simply absent)', !scopeIsStatusNote('')],
    ['a closed-inquiry note is caught', scopeIsStatusNote('This inquiry is now closed.')],
    // ⚠ the report-conclusion rule, both directions, against the real strings
    ['⚠⚠ inquiry 3005 — "warns the Health Committee in its report" is caught',
      scopeIsReportConclusion('Primary care is the bedrock of the NHS and the setting for ninety per cent of all NHS patient contacts but it is under unprecedented strain and struggling to keep pace with relentlessly rising demand, warns the Health Committee in its report.')],
    ['⚠⚠ inquiry 2912 — "according to the Committees in a joint report" is caught',
      scopeIsReportConclusion('Schools and colleges struggle to provide adequate time and resource for pupils’ well-being, according to the Health and Education Committees in a joint report published today.')],
    ['⚠ a plain terms of reference is NOT called a conclusion',
      !scopeIsReportConclusion('The Committee has launched a new inquiry to explore the future of NHS general practice, examining the key challenges facing general practice over the next five years.')],
    ['⚠ merely naming a future report is NOT a conclusion',
      !scopeIsReportConclusion('The Committee will publish its report in due course.')],
    ['⚠ a scope that asserts a claim WITHOUT attributing it to the Committee is not caught — by design',
      !scopeIsReportConclusion('Physical activity can help prevent ill health, but activity levels in England are decreasing.')],
  ]
  let bad = 0
  for (const [n, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}

async function main() {
  if (flag('self-test')) return selftest()
  if (flag('report')) return report()
  await sweep(flag('area') ? 'area' : 'sample')
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1) })
