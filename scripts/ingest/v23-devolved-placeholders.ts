/**
 * v23-devolved-placeholders.ts — V23 §4: honest-denominator placeholders for
 * the three devolved-legislature debate records (playbook §1d). Probed/sized
 * 13 Jun 2026; none seeded this sprint (build is V24 — see DEVOLVED_RECORDS.md
 * and the sprint report). Sizes are MEASURED (NI) or ROUGH (Senedd/Scottish).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const ROWS = [
  {
    key: 'niassembly-hansard', est: 270000, label: 'NI Assembly Hansard (2012-)',
    notes: 'AIMS API data.niassembly.gov.uk/hansard.asmx (GetAllHansardReports + GetHansardComponentsByReportId), clean per-speech XML. MEASURED: 646 plenary reports 2012-09-10..2026-06-09; sampled 539-1172 components/report, ~400 Spoken-Text speech sections each => ~250-300k. Speaker attribution via Speaker(MlaName)+Spoken-Text pairs (pwdata-shaped). Pre-2012 not in AIMS (Assembly suspended 2002-07, 2017-20). Licence pending-verification (devolved-legislature, likely OGL). BUILD V24 — cleanest devolved route.',
  },
  {
    key: 'senedd-cofnod', est: 200000, label: 'Senedd Cofnod / Record of Proceedings (1999-)',
    notes: 'record.senedd.wales structured archive (English) + cofnod.senedd.cymru (Welsh) + business.senedd.wales ModernGov. record.senedd.wales/Search/ live (200). ROUGH ~150-250k (bilingual, Senedd since 1999). Structure mapping needed (Search API / ModernGov agendaitem extraction). Licence pending-verification (likely OGL). BUILD V24.',
  },
  {
    key: 'scottish-parliament-or', est: 320000, label: 'Scottish Parliament Official Report (1999-)',
    notes: 'parliament.scot/chamber-and-committees/official-report — HTML, date-based + alphabetical-list-of-debates + search; data.parliament.scot is the SpOpenData platform but its API base is not exposed in static HTML (path guesses 404 — needs JS-bundle/XHR inspection, same class as the blocked scottish-courts API). ROUGH ~250-400k (SP sits heavily since 1999). Licence pending-verification. HARDEST devolved route — HTML-crawl fallback; BUILD V24 after API discovery.',
  },
]

async function main() {
  const pool = getNeonPool()
  for (const r of ROWS) {
    await pool.query(`
      INSERT INTO corpus_targets (corpus_key, est_sections, est_is_confirmed, blocked, retired, display_label, notes)
      VALUES ($1, $2, false, false, false, $3, $4)
      ON CONFLICT (corpus_key) DO UPDATE SET
        est_sections = EXCLUDED.est_sections, est_is_confirmed = false,
        display_label = EXCLUDED.display_label, notes = EXCLUDED.notes`,
      [r.key, r.est, r.label, r.notes])
    console.log(`placeholder: ${r.key} ~${r.est.toLocaleString()}`)
  }
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
