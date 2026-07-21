/**
 * process-row.ts — per-row processing dispatcher + source processors (V17).
 *
 * Extracted verbatim from worker-queue.ts so the single-process pool worker
 * (ingest-pool.ts) reuses today's claim-cycle logic unchanged: the queue model,
 * R2 key scheme and per-source behaviour are identical to the fleet era.
 * Only the orchestration around processRow() changed in V17.
 */
import { AsyncLocalStorage } from 'async_hooks'
import {
  markDone as _markDone, markFailed, markSkipped,
  updateFormatsAvailable, insertSpecialistQueueRow, QueueRow,
} from '../shared/queue-client'
import { r2Exists as _r2Exists, r2Put, caselawKey, caselawRawKey, bailiiKey, hansardKey, compiledKey, rawKey } from '../shared/r2-client'
import { rawToText, pdfToText } from '../shared/compile'
import { upsertSection as _upsertSection, bulkUpsertSections as _bulkUpsertSections, deleteStaleSections, deleteSupersededVersionSections, sectionId, countWords, SectionMeta } from '../shared/db-metadata'

// Track sections written this process lifetime — the pool worker reports this
// in its exit summary, and it is the ground truth for "sections, not statuses".
let _sectionsWritten = 0
export function getSectionsWritten(): number { return _sectionsWritten }

// ── Per-row outcome tracking (V24 zero-output breaker fix) ────────────────────
// The pool runs ≤20 rows concurrently in one process, so per-row counters cannot
// be module globals — they would interleave. AsyncLocalStorage scopes them to
// the row's async call tree. processRow() establishes the store; the wrapped
// upsertSection / bulkUpsertSections / r2Exists below update it transparently,
// so no processor body changes.
//
// At markDone the worker records ingest_queue.produced_output: a row "produced"
// output if it wrote a compiled section, CONFIRMED an existing R2 file (the
// r2Exists-skip path of an idempotent reseed), or wrote a no-content marker.
// Only a done row that did NONE of these AND is not a structural seeder/no-op is
// a GENUINE zero-output row. The V23 breaker inferred emptiness from corpus-level
// section-count deltas, so idempotent reseeds (no new rows, but every row
// satisfied) read as empty and parked 108,349 legitimate rows. Counting the
// r2Exists confirmation fixes that at source.
interface RowOutcome { compiled: number; confirmed: number; markers: number; structural: boolean }
const rowCtx = new AsyncLocalStorage<RowOutcome>()

// Structural rows never produce sections by design: queue-seeding enumerators
// (enum:/list:/gapvol:) and retirement no-ops. They must not count as empty.
function isStructuralRow(row: QueueRow): boolean {
  if (row.sourceType === 'treaties') return true
  const d = row.docId
  return d.startsWith('enum:') || d.startsWith('list:') || d.startsWith('gapvol:')
}

async function upsertSection(data: Parameters<typeof _upsertSection>[0]): Promise<void> {
  await _upsertSection(data)
  _sectionsWritten++
  const o = rowCtx.getStore()
  if (o) { if (data.status === 'compiled') o.compiled++; else o.markers++ }
}

async function bulkUpsertSections(metas: SectionMeta[]): Promise<number> {
  const written = await _bulkUpsertSections(metas)
  _sectionsWritten += written
  const o = rowCtx.getStore()
  // bulkUpsertSections is only ever called with status:'compiled' metas.
  if (o) o.compiled += written
  return written
}

// Counting wrapper: an r2Exists hit means this row's content is already present
// (idempotent reseed) — that is real, confirmed output, not emptiness.
async function r2Exists(key: string): Promise<boolean> {
  const exists = await _r2Exists(key)
  if (exists) { const o = rowCtx.getStore(); if (o) o.confirmed++ }
  return exists
}

// markDone wrapper: stamps produced_output from the row's accumulated outcome.
async function markDone(id: string, formatFound?: string): Promise<void> {
  const o = rowCtx.getStore()
  const produced = o == null ? null
    : (o.structural || o.compiled > 0 || o.confirmed > 0 || o.markers > 0)
  await _markDone(id, formatFound, produced)
}

// Source clients
import { fetchJudgmentXml } from '../sources/tna-caselaw'
import { enumerateSections, discoverFormats, AVAILABILITY_NOTES } from '../sources/tna-legislation'
import { fetchCaseHtml, extractCaseText } from '../sources/bailii-scraper'
import { fetchReportContent, fetchWrittenStatements, fetchDebateText } from '../sources/parliament-api'
import { listDebatesForMonth } from '../sources/theyworkforyou'
import { getAllHandbookModules, listSectionsForModule } from '../sources/fca-handbook'
import { fetchDocumentText as fetchEurLexText, listRetainedEuInstruments, listRetainedEuPage } from '../sources/eurlex'
import { fetchLdaPage, MAX_524_RETRIES } from '../sources/lda-parliament'
import { listCommitteePublications, fetchPublicationHtml } from '../sources/committees-portal'
import { fetchPwdataFile, parsePwdataItems, PWDATA_CORPUS_CONFIG } from '../sources/twfy-pwdata'
import { fetchVolumeXml, parseHansardV12Items, volumeZipUrl } from '../sources/historic-hansard'
import { fetchDocText as fetchOecdText, listOecdOpenDocs } from '../sources/oecd-free'
import {
  listHmrcManuals, listNaoReports, listHoCLReports,
  listExplanatoryNotes, listImpactAssessments, listConsultations,
  listHmrcTiins, listOtsReports,
  listFcaPublications, listSentencingCouncilGuidelines, listCollegeOfPolicing,
  listPlanningPolicyNppf, listBuildingRegs,
  fetchDocumentText as fetchGovText,
} from '../sources/gov-scraper'

// ── Row dispatcher ────────────────────────────────────────────────────────────

export async function processRow(row: QueueRow): Promise<void> {
  const outcome: RowOutcome = { compiled: 0, confirmed: 0, markers: 0, structural: isStructuralRow(row) }
  return rowCtx.run(outcome, () => dispatchRow(row))
}

async function dispatchRow(row: QueueRow): Promise<void> {
  switch (row.sourceType) {
    case 'tna-legislation': return processTnaLegislation(row)
    case 'tna-caselaw':     return processTnaCaselaw(row)
    case 'bailii':          return processBailii(row)
    case 'hansard':         return processHansard(row)
    case 'fca':             await markSkipped(row.id); return  // retired — old SPA scraper replaced by fca-handbook
    case 'fca-handbook':    return processFcaHandbook(row)
    case 'echr':            return processEchr(row)
    case 'eurlex':          return processEurLex(row)
    case 'lda-parliament':  return processLda(row)
    case 'twfy-pwdata':     return processPwdata(row)
    case 'historic-hansard': return processHistoricHansard(row)
    case 'historic-hansard-html': return processHistoricHansardHtml(row)
    case 'govuk-content':   return processGovukContent(row)
    case 'hmrc':            return processHmrc(row)
    case 'treaties':          return processTreaties(row)
    case 'oecd':              return processOecd(row)
    case 'gov-uk':            return processGovUk(row)
    case 'fca-publications':  return processGovUk(row)
    case 'scotlawcom':        return processLawCommission(row)
    case 'nilawcom':          return processLawCommission(row)
    case 'committees-portal':  return processCommittees(row)
    case 'committees-document': return processCommitteeDocument(row)
    case 'committees-api':      return processCommitteesApi(row)
    case 'tax-tribunals':       return processTaxTribunals(row)
    case 'lawcom':              return processLawcom(row)
    case 'judiciaryni':         return processJudiciaryNi(row)
    case 'nao':                 return processNao(row)
    case 'niassembly-hansard':  return processNiAssemblyHansard(row)
    case 'inquiry-reports':     return processInquiryReports(row)
    case 'senedd-cofnod':       return processSeneddCofnod(row)
    case 'bills-api':           return processBills(row)
    case 'college-policing-archive': return processCollegePolicing(row)
    case 'scottish-courts':     return processScottishCourts(row)
    case 'ico':                 return processIco(row)
    case 'division-votes':      return processDivisionVotes(row)
    case 'scottish-parliament-or': return processScottishParliamentOr(row)
    case 'erskine-may':         return processErskineMay(row)
    case 'early-day-motions':   return processEarlyDayMotions(row)
    case 'petitions':           return processPetitions(row)
    case 'members-interests':   return processMembersInterests(row)
    case 'cps-guidance':        return processCpsGuidance(row)
    case 'independent-reviews': return processInquiryReports(row)  // V29 §5 — identical per-PDF mechanics
    case 'cma-cases':           return processCmaCases(row)
    case 'inquiry-evidence':    return processInquiryEvidence(row)
    case 'ofgem':               return processOfgem(row)
    case 'ofcom':               return processOfcom(row)
    case 'lgsco':               return processLgsco(row)
    case 'library-briefings':   return processLibraryBriefings(row)
    case 'fcdo-treaties':       return processFcdoTreaties(row)
    case 'parliament-treaties': return processParliamentTreaties(row)
    default:
      await markSkipped(row.id)
      console.warn(`[pool] unknown sourceType ${row.sourceType} — skipped`)
  }
}

// ── TNA Legislation ───────────────────────────────────────────────────────────

async function processTnaLegislation(row: QueueRow): Promise<void> {
  // V20: EN/EM rows ride the tna-legislation sourceType (single host budget,
  // playbook §1b) and are distinguished by docId prefix `en:` / `em:`.
  if (/^e[nm]:/.test(row.docId)) return processTnaExplanatory(row)
  // V20: queue-driven year enumeration (enum:{type}:{year}) — runs from Railway
  // IPs because TNA penalty-boxes the local IP for sustained enumeration.
  if (row.docId.startsWith('enum:')) return processTnaEnum(row)
  const actId = row.docId

  // Format discovery: check what TNA actually holds before attempting fetches
  const formats = await discoverFormats(actId)
  if (formats.length > 0) {
    await updateFormatsAvailable(row.id, formats.join(','))
  }

  const sections = await enumerateSections(actId)

  if (sections.length === 0) {
    await markSkipped(row.id)
    return
  }

  for (const section of sections) {
    const secId = sectionId(row.corpus, actId, section.sectionRef)
    const cKey  = compiledKey(row.corpus, actId, section.sectionRef)

    if (section.format === 'unavailable') {
      const availabilityStatus = section.classifiedAs ?? 'no-provisions'
      const availabilityNote = section.classifiedAs ? AVAILABILITY_NOTES[section.classifiedAs] : undefined
      await upsertSection({
        id: secId,
        corpus: row.corpus,
        sourceUrl: `https://www.legislation.gov.uk/${actId}`,
        status: 'unavailable',
        errorMsg: section.errorMsg,
        format: 'unavailable',
        availabilityStatus,
        availabilityNote,
      })
      // Queue for specialist processing where applicable
      if (section.classifiedAs === 'commencement' || section.classifiedAs === 'pdf-only') {
        await insertSpecialistQueueRow({
          id: row.id,
          corpus: row.corpus,
          docId: actId,
          sourceType: row.sourceType,
          specialistType: section.classifiedAs,
          title: section.legislationTitle,
          legislationYear: section.legislationYear,
          legislationType: actId.split('/')[0],
        }).catch(err => console.warn(`[pool] specialist_queue insert failed for ${actId}: ${err}`))
      }
      continue
    }

    if (section.format === 'effects') {
      const effectsKey = `effects/${actId}/effects.xml`
      if (await r2Exists(effectsKey)) continue
      await r2Put(effectsKey, section.xml!, 'application/xml')
      await upsertSection({ id: secId, corpus: row.corpus, sourceUrl: `https://www.legislation.gov.uk/${actId}/effects/data.feed`, r2Key: effectsKey, r2RawKey: effectsKey, wordCount: 0, status: 'compiled', format: 'effects' })
      continue
    }

    if (await r2Exists(cKey)) continue

    const sourceUrl = `https://www.legislation.gov.uk/${actId}/${section.sectionRef}`

    if (section.format === 'clml' || section.format === 'clml-unparsed') {
      const rKey = rawKey(row.corpus, actId, section.sectionRef, 'xml')
      await r2Put(rKey, section.xml!, 'application/xml')
      const compiled = rawToText(section.xml!)
      await r2Put(cKey, compiled)
      await upsertSection({ id: secId, corpus: row.corpus, sourceUrl, r2Key: cKey, r2RawKey: rKey, wordCount: countWords(compiled), status: 'compiled', format: section.format })
    } else if (section.format === 'html') {
      const compiled = rawToText(section.rawHtml!)
      await r2Put(cKey, compiled)
      await upsertSection({ id: secId, corpus: row.corpus, sourceUrl, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled', format: 'html' })
    } else if (section.format === 'pdf') {
      const rKey = rawKey(row.corpus, actId, section.sectionRef, 'pdf')
      await r2Put(rKey, section.pdfBuffer!, 'application/pdf')
      const extracted = await pdfToText(section.pdfBuffer!, sourceUrl)
      if (extracted) {
        await r2Put(cKey, extracted)
        await upsertSection({ id: secId, corpus: row.corpus, sourceUrl, r2Key: cKey, r2RawKey: rKey, wordCount: countWords(extracted), status: 'compiled', format: 'pdf' })
      } else {
        await r2Put(cKey, '[PDF - scanned/unreadable — OCR pass needed]')
        await upsertSection({ id: secId, corpus: row.corpus, sourceUrl, r2Key: cKey, r2RawKey: rKey, wordCount: 0, status: 'compiled', format: 'pdf', notes: 'pdf-ocr-needed' })
      }
    }
  }

  await markDone(row.id, sections[0]?.format)
}

// ── TNA Case Law ──────────────────────────────────────────────────────────────
// Queue rows for caselaw have docId = "page:N" (global feed) or
// "court:{code}:page:N" (per-court feed, V19 — tribunal courts are only fully
// enumerable via ?court=; the global feed carries just their newest entries).
// We fetch that Atom feed page and process all 50 entries in one row claim.

async function processTnaCaselaw(row: QueueRow): Promise<void> {
  const ATOM_BASE = 'https://caselaw.nationalarchives.gov.uk/atom.xml'

  let feedUrl: string
  const courtM = /^court:(.+):page:(\d+)$/.exec(row.docId)
  if (courtM) {
    feedUrl = `${ATOM_BASE}?court=${encodeURIComponent(courtM[1])}&page=${courtM[2]}`
  } else if (row.docId.startsWith('page:')) {
    feedUrl = `${ATOM_BASE}?page=${parseInt(row.docId.replace('page:', ''), 10)}`
  } else {
    await markSkipped(row.id)
    return
  }

  const page = courtM ? parseInt(courtM[2], 10) : parseInt(row.docId.replace('page:', ''), 10)
  const res = await fetch(feedUrl, {
    headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (Open Justice; contact: cl@scrutinise.org)' },
  })
  if (!res.ok) {
    await markFailed(row.id, `Atom feed HTTP ${res.status} for page ${page}`)
    return
  }

  const xml = await res.text()
  const entryRx = /<entry>([\s\S]*?)<\/entry>/g
  let m: RegExpExecArray | null
  let processed = 0

  while ((m = entryRx.exec(xml)) !== null) {
    const entry = m[1]
    const xmlLinkM = /href="(https:\/\/caselaw\.nationalarchives\.gov\.uk\/[^"]+\/data\.xml)"/.exec(entry)
    if (!xmlLinkM) continue

    const xmlUrl = xmlLinkM[1]
    const uri = xmlUrl.replace('https://caselaw.nationalarchives.gov.uk/', '').replace('/data.xml', '')
    const ncnM = /<tna:identifier[^>]+type="ukncn"[^>]*>([^<]+)/.exec(entry)
    const docId = ncnM ? ncnM[1].trim() : uri

    const cKey = caselawKey(docId)
    if (await r2Exists(cKey)) { processed++; continue }

    const secId = sectionId('tna-caselaw', docId, '1')
    try {
      const judgmentXml = await fetchJudgmentXml(xmlUrl)
      if (!judgmentXml) continue

      const rKey = caselawRawKey(docId)
      await r2Put(rKey, judgmentXml, 'application/xml')
      const compiled = rawToText(judgmentXml)
      await r2Put(cKey, compiled)
      await upsertSection({ id: secId, corpus: 'tna-caselaw', sourceUrl: xmlUrl, r2Key: cKey, r2RawKey: rKey, wordCount: countWords(compiled), status: 'compiled' })
      processed++
    } catch (err: unknown) {
      console.warn(`[pool] caselaw ${docId}: ${err}`)
    }
  }

  await markDone(row.id, 'xml')
}

// ── BAILII ────────────────────────────────────────────────────────────────────
// docId = "{COURT}:{caseRef}"

async function processBailii(row: QueueRow): Promise<void> {
  const [court, ...refParts] = row.docId.split(':')
  const caseRef = refParts.join(':')
  if (!court || !caseRef) { await markSkipped(row.id); return }

  const baseUrl = 'https://www.bailii.org'
  // Reconstruct URL from court + caseRef — the caseRef was derived from the URL path
  // Pattern varies by court: /ew/cases/EWCA/{caseRef}.html etc.
  // Use a conservative URL reconstruction matching BAILII_DATABASES paths
  const courtPaths: Record<string, string> = {
    UKSC:  '/uk/cases/UKSC', EWCA: '/ew/cases/EWCA', EWHC: '/ew/cases/EWHC',
    UKEAT: '/uk/cases/UKEAT', UKET: '/uk/cases/UKET',
    CSIH:  '/scot/cases/ScotCS/CSIH', CSOH: '/scot/cases/ScotCS/CSOH',
    NIQB:  '/nie/cases/NIHC/QB', NICA: '/nie/cases/NICA', UKPC: '/uk/cases/UKPC',
  }
  const courtPath = courtPaths[court]
  if (!courtPath) { await markSkipped(row.id); return }

  const caseUrl = `${baseUrl}${courtPath}/${caseRef}.html`
  const cKey = bailiiKey(`${court}-${caseRef}`)
  if (await r2Exists(cKey)) { await markSkipped(row.id); return }

  const html = await fetchCaseHtml(caseUrl)
  if (!html) { await markFailed(row.id, 'fetch failed'); return }

  const text = extractCaseText(html)
  const compiled = rawToText(text)
  await r2Put(cKey, compiled)
  const secId = sectionId(row.corpus, row.docId, '1')
  await upsertSection({ id: secId, corpus: row.corpus, sourceUrl: caseUrl, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled' })
  await markDone(row.id, 'html')
}

// ── Hansard ───────────────────────────────────────────────────────────────────
// docId dispatch:
//   "__index"                   → committee reports (full enumeration)
//   "answers:{from}:{to}"       → written parliamentary questions (F1)
//   "statements:{from}:{to}"    → written ministerial statements (F1)
//   "{house}:{from}:{to}"       → Hansard debates

async function processHansard(row: QueueRow): Promise<void> {
  const { listHansardDebates, listCommitteeReports } = await import('../sources/parliament-api')

  const parts = row.docId.split(':')

  if (parts[0] === '__index') {
    for await (const report of listCommitteeReports()) {
      const text = await fetchReportContent(report.url) ?? report.title
      if (!text) continue
      const cKey = hansardKey(report.date, report.id)
      if (await r2Exists(cKey)) continue
      const compiled = rawToText(text)
      await r2Put(cKey, compiled)
      const secId = sectionId(row.corpus, report.id, '1')
      await upsertSection({ id: secId, corpus: row.corpus, sourceUrl: report.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled' })
    }
    await markDone(row.id)
    return
  }

  // V28 §1.1: written answers re-ingested as ONE section per question-and-answer
  // (was a single date-range blob — up to ~390k words/section, wrong retrieval
  // unit). The questions API is per-item; we key each section on the stable
  // question id (globally unique, dedup-safe across windows) and carry heading +
  // members + date as metadata. parentDocId = the date window so a re-parse's
  // deleteStaleSections keeps the window consistent; the legacy blob row
  // ({corpus}:{from}:{to}:1) is removed by v28-reseed-written-answers.ts.
  if (parts[0] === 'answers') {
    const { fetchWrittenAnswerItems, compileWrittenQa } = await import('../sources/parliament-api')
    const [, startDate, endDate] = parts
    if (!startDate || !endDate) { await markSkipped(row.id); return }
    const windowTag = `${startDate}:${endDate}`
    const items = await fetchWrittenAnswerItems(startDate, endDate)
    if (items.length === 0) {
      await upsertSection({
        id: sectionId(row.corpus, windowTag, '1'), corpus: row.corpus,
        sourceUrl: `https://questions-statements-api.parliament.uk/api/writtenquestions/questions?answeredWhenFrom=${startDate}&answeredWhenTo=${endDate}`,
        status: 'unavailable', availabilityStatus: 'no-provisions',
        availabilityNote: 'no written answers in this window', parentDocId: windowTag,
      })
      await markDone(row.id, 'html'); return
    }
    const metas: SectionMeta[] = []
    const texts: string[] = []
    for (const it of items) {
      const text = compileWrittenQa(it)
      metas.push({
        id: sectionId(row.corpus, it.id, '1'),
        corpus: row.corpus,
        sourceUrl: `https://questions-statements-api.parliament.uk/api/writtenquestions/questions/${it.id}`,
        r2Key: compiledKey(row.corpus, it.id, '1'),
        wordCount: countWords(text), status: 'compiled', format: 'html',
        sectionTitle: it.heading || undefined,
        speaker: it.answeringMember ?? it.answeringBody ?? undefined,
        itemDate: it.dateAnswered ?? undefined,
        parentDocId: windowTag,
      })
      texts.push(text)
    }
    for (let i = 0; i < metas.length; i += 8) {
      await Promise.all(metas.slice(i, i + 8).map((m, j) => r2Put(m.r2Key!, texts[i + j])))
    }
    await bulkUpsertSections(metas)
    await deleteStaleSections(row.corpus, windowTag, metas.map(m => m.id))
    await markDone(row.id, 'html')
    return
  }

  if (parts[0] === 'statements') {
    const [, startDate, endDate] = parts
    if (!startDate || !endDate) { await markSkipped(row.id); return }
    const text = await fetchWrittenStatements(startDate, endDate)
    if (!text) { await markDone(row.id, 'html'); return }
    const cKey = compiledKey(row.corpus, `${startDate}:${endDate}`, '1')
    if (await r2Exists(cKey)) { await markDone(row.id, 'html'); return }
    const compiled = rawToText(text)
    await r2Put(cKey, compiled)
    const secId = sectionId(row.corpus, `${startDate}:${endDate}`, '1')
    const sourceUrl = `https://questions-statements-api.parliament.uk/api/writtenstatements/statements?madeWhenFrom=${startDate}&madeWhenTo=${endDate}`
    await upsertSection({ id: secId, corpus: row.corpus, sourceUrl, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled' })
    await markDone(row.id, 'html')
    return
  }

  // TheyWorkForYou route — docId format: "twfy:{type}:{YYYY-MM}"
  if (parts[0] === 'twfy') {
    const [, typeRaw, yearMonth] = parts
    if (!typeRaw || !yearMonth) { await markSkipped(row.id); return }
    const twfyType = typeRaw as 'commons' | 'lords' | 'westminhall'
    let written = 0
    for await (const debate of listDebatesForMonth(twfyType, yearMonth)) {
      const cKey = hansardKey(debate.date, `twfy-${twfyType}-${debate.date}`)
      if (await r2Exists(cKey)) { written++; continue }
      const compiled = rawToText(debate.text)
      await r2Put(cKey, compiled)
      const secId = sectionId(row.corpus, `twfy-${twfyType}-${debate.date}`, '1')
      await upsertSection({ id: secId, corpus: row.corpus, sourceUrl: debate.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled' })
      written++
    }
    if (written === 0) {
      console.warn(`[twfy] ${row.docId}: 0 debates written — parliament may not have sat this month`)
    }
    await markDone(row.id, 'html')
    return
  }

  // Expected: "commons:2024-01-01:2024-01-31" or "lords:2024-01-01:2024-01-31"
  const [houseRaw, startDate, endDate] = parts
  if (!houseRaw || !startDate || !endDate) { await markSkipped(row.id); return }
  const house = houseRaw === 'commons' ? 'Commons' : 'Lords'

  let written = 0
  for await (const debate of listHansardDebates(house as 'Commons' | 'Lords', startDate, endDate)) {
    const cKey = hansardKey(debate.date, debate.id)
    if (await r2Exists(cKey)) { written++; continue }

    const text = await fetchDebateText(debate.id)
    if (!text) continue

    const compiled = rawToText(text)
    await r2Put(cKey, compiled)
    const secId = sectionId(row.corpus, debate.id, '1')
    await upsertSection({ id: secId, corpus: row.corpus, sourceUrl: debate.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled' })
    written++
  }
  // 0 debates means api.parliament.uk/v1/hansard returned 403 or empty — mark failed
  // so the gap is visible and the row can be retried once the API is accessible.
  if (written === 0) {
    await markFailed(row.id, 'Hansard: 0 debates returned — api.parliament.uk/v1/hansard may return 403 from this environment')
  } else {
    await markDone(row.id, 'html')
  }
}

// ── FCA Handbook ──────────────────────────────────────────────────────────────
// docId = module entityId (lowercase), e.g. 'cobs', 'mar', 'sysc'.
// Uses api-handbook.fca.org.uk JSON API — no browser required.
// Each queue row covers all chapters within one module.

async function processFcaHandbook(row: QueueRow): Promise<void> {
  const moduleEntityId = row.docId

  // Fetch full module map to get chapterIds for this module
  const allModules = await getAllHandbookModules()
  const module = allModules.find(m => m.entityId === moduleEntityId)
  if (!module) {
    await markFailed(row.id, `fca-handbook: module '${moduleEntityId}' not found in GetAllHandbook`)
    return
  }

  let written = 0
  for await (const section of listSectionsForModule(module)) {
    const cKey = compiledKey('fca-handbook', section.moduleEntityId, section.sectionId)
    if (await r2Exists(cKey)) { written++; continue }

    const compiled = rawToText(section.text)
    await r2Put(cKey, compiled)
    const secId = sectionId('fca-handbook', section.moduleEntityId, section.sectionId)
    await upsertSection({
      id:        secId,
      corpus:    'fca-handbook',
      sourceUrl: section.sourceUrl,
      r2Key:     cKey,
      wordCount: countWords(compiled),
      status:    'compiled',
      format:    'html',
    })
    written++
  }

  if (written === 0) {
    await markFailed(row.id, `fca-handbook: ${moduleEntityId}: 0 sections written`)
  } else {
    console.log(`[fca-handbook] ${moduleEntityId}: ${written} section(s) written`)
    await markDone(row.id, 'html')
  }
}

// ── ECHR HUDOC (V22 revival — V20 probe routes) ──────────────────────────────
// docId = 'doc:{itemid}' (one HUDOC document, PDF conversion → text).
// Legacy 'page:{start}' / '__index' rows rode the dead V-era routes — skipped.

async function processEchr(row: QueueRow): Promise<void> {
  if (!row.docId.startsWith('doc:')) {
    await markSkipped(row.id)
    console.warn(`[echr] legacy docId ${row.docId} skipped (retired V-era route form)`)
    return
  }
  const { getDocMeta, fetchDocPdf } = await import('../sources/echr-hudoc')
  const itemId = row.docId.slice(4)
  const pageUrl = `https://hudoc.echr.coe.int/eng#{"itemid":["${itemId}"]}`

  const meta = await getDocMeta(itemId)
  if (!meta) { await markFailed(row.id, `echr ${itemId}: metadata query failed`); return }

  const marker = async (note: string) => {
    await upsertSection({
      id: sectionId(row.corpus, itemId, '1'),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: note,
      sectionTitle: meta.docName || undefined,
      parentDocId: itemId,
    })
    await markDone(row.id)
  }

  const pdf = await fetchDocPdf(itemId)
  if (!pdf) return marker('HUDOC pdf conversion unavailable for this document')
  const text = await pdfToText(pdf, `${itemId}.pdf`)
  if (!text || text.length < 100) return marker('HUDOC pdf served but no extractable text')

  const cKey = compiledKey(row.corpus, itemId, '1')
  await r2Put(cKey, text)
  await upsertSection({
    id: sectionId(row.corpus, itemId, '1'),
    corpus: row.corpus,
    sourceUrl: pageUrl,
    r2Key: cKey,
    wordCount: countWords(text),
    status: 'compiled',
    format: 'pdf',
    sectionTitle: meta.docName || undefined,
    itemDate: meta.date ? meta.date.slice(0, 10) : undefined,
    parentDocId: itemId,
  })
  await markDone(row.id, 'pdf')
}

// ── EUR-Lex ───────────────────────────────────────────────────────────────────
// docId = 'page:{N}' for per-page rows (1-indexed), or '__index'.

async function processEurLex(row: QueueRow): Promise<void> {
  const gen = row.docId.startsWith('page:')
    ? listRetainedEuPage(parseInt(row.docId.replace('page:', ''), 10))
    : listRetainedEuInstruments()

  for await (const doc of gen) {
    const cKey = compiledKey('eur-lex', doc.celexId, '1')
    if (await r2Exists(cKey)) continue

    const text = await fetchEurLexText(doc.celexId)
    if (!text) continue

    const compiled = rawToText(text)
    await r2Put(cKey, compiled)
    const secId = sectionId('eur-lex', doc.celexId, '1')
    await upsertSection({ id: secId, corpus: 'eur-lex', sourceUrl: doc.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled' })
  }
  await markDone(row.id)
}

// ── LDA Parliament ────────────────────────────────────────────────────────────

async function processLda(row: QueueRow): Promise<void> {
  // corpus like 'lda-commonsoralquestions' → slug 'commonsoralquestions'
  const slug = row.corpus.replace(/^lda-/, '')
  const page = parseInt(row.docId.replace('page:', ''), 10)

  // WHY: LDA written questions have large result sets at high page numbers.
  // pageSize=500 causes Parliament's DB to timeout (HTTP 524 via Cloudflare).
  // pageSize=100 means 5x more requests but each completes within the timeout.
  // Only applies to written questions — oral questions and divisions are fine at 500.
  const pageSize = row.corpus.includes('writtenquestions') ? 100 : 500

  let items
  try {
    const result = await fetchLdaPage(slug, page, pageSize)
    items = result.items
  } catch (err) {
    const errMsg = String(err)
    // WHY: some LDA pages consistently fail regardless of timeout/page size.
    // After MAX_524_RETRIES attempts we accept the gap and record it for future
    // investigation rather than burning worker time indefinitely.
    // The 502/524 auto-retry in ops skips rows with 'specialist-queue:' prefix.
    if (errMsg.includes('524') && row.attempts >= MAX_524_RETRIES) {
      await markFailed(row.id, `specialist-queue: LDA 524 after ${row.attempts} attempts — archived`)
    } else {
      await markFailed(row.id, errMsg)
    }
    return
  }

  if (items.length === 0) {
    await markFailed(row.id, `LDA ${slug} page ${page}: 0 items returned`)
    return
  }

  for (const item of items) {
    const cKey = compiledKey(row.corpus, item.id, '1')
    if (await r2Exists(cKey)) continue
    const compiled = rawToText(item.text)
    if (!compiled.trim()) continue
    await r2Put(cKey, compiled)
    const secId = sectionId(row.corpus, item.id, '1')
    await upsertSection({
      id: secId,
      corpus: row.corpus,
      sourceUrl: item.sourceUrl,
      r2Key: cKey,
      wordCount: countWords(compiled),
      status: 'compiled',
    })
  }
  await markDone(row.id)
}

// ── HMRC / Gov docs ───────────────────────────────────────────────────────────

async function processHmrc(row: QueueRow): Promise<void> {
  const sources = [
    listHmrcManuals(), listNaoReports(), listHoCLReports(),
    listExplanatoryNotes(), listImpactAssessments(), listConsultations(),
  ]
  for (const gen of sources) {
    for await (const doc of gen) {
      const cKey = compiledKey('hmrc-codes-guidance', doc.id, '1')
      if (await r2Exists(cKey)) continue

      const text = await fetchGovText(doc.url)
      if (!text) continue

      const compiled = rawToText(text.slice(0, 50_000))
      await r2Put(cKey, compiled)
      const secId = sectionId('hmrc-codes-guidance', doc.id, '1')
      await upsertSection({ id: secId, corpus: 'hmrc-codes-guidance', sourceUrl: doc.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled' })
    }
  }
  await markDone(row.id)
}

// ── UK Treaties ───────────────────────────────────────────────────────────────
// V19: FCO client retired (sources moved to scripts/attic/v19-fco-treaties/).
// uk-treaties is now a govuk-content corpus: gov.uk filter_format=international_treaty
// (1,685 docs incl. the tax-treaties DTA collection) — same documents, working host.
// Residual sourceType='treaties' rows are marked done with a retirement note.

async function processTreaties(row: QueueRow): Promise<void> {
  await markDone(row.id)
  console.log(`[pool] ${row.id}: sourceType 'treaties' retired V19 — uk-treaties is govuk-content now`)
}

// ── OECD ──────────────────────────────────────────────────────────────────────

async function processOecd(row: QueueRow): Promise<void> {
  for await (const doc of listOecdOpenDocs()) {
    const cKey = compiledKey('oecd', doc.id, '1')
    if (await r2Exists(cKey)) continue

    const text = await fetchOecdText(doc.url)
    if (!text) continue

    const compiled = rawToText(text)
    await r2Put(cKey, compiled)
    const secId = sectionId('oecd', doc.id, '1')
    await upsertSection({ id: secId, corpus: 'oecd', sourceUrl: doc.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled' })
  }
  await markDone(row.id)
}

// ── GOV.UK general sources (TIINs, OTS) ──────────────────────────────────────
// sourceType = 'gov-uk', corpus drives which listing function to use.

async function processGovUk(row: QueueRow): Promise<void> {
  let gen
  switch (row.corpus) {
    case 'ots-reports':         gen = listOtsReports(); break
    case 'nao-reports':         gen = listNaoReports(); break
    case 'fca-publications':    gen = listFcaPublications(); break
    case 'sentencing-council':  gen = listSentencingCouncilGuidelines(); break
    case 'college-of-policing': gen = listCollegeOfPolicing(); break
    case 'planning-policy':     gen = listPlanningPolicyNppf(); break
    case 'building-regs':       gen = listBuildingRegs(); break
    default:                    gen = listHmrcTiins()
  }

  for await (const doc of gen) {
    const cKey = compiledKey(row.corpus, doc.id, '1')
    if (await r2Exists(cKey)) continue

    const text = await fetchGovText(doc.url)
    if (!text) continue

    const compiled = rawToText(text.slice(0, 50_000))
    await r2Put(cKey, compiled)
    const secId = sectionId(row.corpus, doc.id, '1')
    await upsertSection({ id: secId, corpus: row.corpus, sourceUrl: doc.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled' })
  }
  await markDone(row.id)
}

// ── TWFY pwdata (bulk Hansard XML) ────────────────────────────────────────────
// docId = filename without .xml extension (e.g. "debates2026-06-03a", "answers2026-06-01")
//
// V18: one section per speech / question+answer exchange, with heading, speaker,
// sitting date, and parentDocId metadata. The pre-V18 one-blob-per-day-file
// sections are superseded in place: item 1 overwrites the old :1 row, higher
// seqs are new rows, and deleteStaleSections clears anything a re-parse no
// longer produces. Empty/404 files write an 'unavailable' marker row so the
// corpus_sections-based reseed dedup sees them — without it, weekly queue
// cleanup + hourly reseed re-process empty files forever and feed the
// zero-output breaker.

// Exported core so the V18 pilot can run the exact production path on chosen
// day-files without touching the queue. Returns sections written.
export async function processPwdataFile(corpus: string, docId: string): Promise<number> {
  const dir = PWDATA_CORPUS_CONFIG[corpus].dir
  const dayUrl = `https://www.theyworkforyou.com/pwdata/scrapedxml/${dir}/${docId}.xml`
  const dateMatch = /(\d{4}-\d{2}-\d{2})/.exec(docId)
  const itemDate = dateMatch ? dateMatch[1] : undefined

  const xml = await fetchPwdataFile(corpus, docId)

  // TWFY scrape versions: superseded files are rewritten upstream with
  // latest="no" on the root element (verified 10 Jun 2026). Their content is a
  // duplicate of a later letter — write a marker, purge anything previously
  // ingested for this version, never re-process.
  if (xml && /<publicwhip[^>]*latest="no"/.test(xml.slice(0, 4000))) {
    const markerId = sectionId(corpus, docId, '1')
    await upsertSection({
      id: markerId,
      corpus,
      sourceUrl: dayUrl,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: 'superseded scrapeversion — content lives under a later letter suffix',
      itemDate,
      parentDocId: docId,
    })
    await deleteStaleSections(corpus, docId, [markerId])
    return 0
  }

  const items = xml ? parsePwdataItems(xml) : []

  if (items.length === 0) {
    await upsertSection({
      id: sectionId(corpus, docId, '1'),
      corpus,
      sourceUrl: dayUrl,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: xml ? 'day-file contains no extractable items' : 'day-file 404 — no sitting',
      itemDate,
      parentDocId: docId,
    })
    return 0
  }

  const metas: SectionMeta[] = []
  const texts: string[] = []
  for (const item of items) {
    const compiled = rawToText(item.text)
    if (!compiled) continue
    const ref = String(item.seq)
    metas.push({
      id: sectionId(corpus, docId, ref),
      corpus,
      sourceUrl: item.url ?? dayUrl,
      r2Key: compiledKey(corpus, docId, ref),
      wordCount: countWords(compiled),
      status: 'compiled',
      sectionTitle: [item.heading, item.minorHeading].filter(Boolean).join(' — ') || undefined,
      speaker: item.speaker ?? undefined,
      itemDate,
      parentDocId: docId,
    })
    texts.push(compiled)
  }

  // R2 first, then DB — a section row must never point at a missing R2 key.
  const R2_BATCH = 8
  for (let i = 0; i < metas.length; i += R2_BATCH) {
    await Promise.all(metas.slice(i, i + R2_BATCH).map((m, j) => r2Put(m.r2Key!, texts[i + j])))
  }
  const written = await bulkUpsertSections(metas)
  await deleteStaleSections(corpus, docId, metas.map(m => m.id))

  // Purge compiled sections of earlier scrape versions of the same sitting day
  // (markers are kept so the reseed dedup still sees those files).
  const dayStem = docId.replace(/[a-z]$/, '')
  if (dayStem !== docId) {
    await deleteSupersededVersionSections(corpus, dayStem, docId)
  }
  return written
}

async function processPwdata(row: QueueRow): Promise<void> {
  if (!PWDATA_CORPUS_CONFIG[row.corpus]) {
    await markSkipped(row.id)
    console.warn(`[pool] unknown pwdata corpus ${row.corpus} — skipped`)
    return
  }
  await processPwdataFile(row.corpus, row.docId)
  await markDone(row.id, 'xml')
}

// ── Historic Hansard 1803–1918 (V21) ─────────────────────────────────────────
// docId = volume zip stem (e.g. "S1V0001P0", "S1V0009P0_a"). One row per zip;
// per-speech items mirror the pwdata granularity model (heading/speaker/date/
// parentDocId, items ≥ 1919-02-04 dropped — pwdata-debates takes over there).

export async function processHistoricHansardVolume(corpus: string, docId: string): Promise<number> {
  const zipUrl = volumeZipUrl(docId) ?? undefined
  const xml = await fetchVolumeXml(docId)

  if (!xml) {
    // Soft-404 — listed at seed time but absent now. Marker keeps the docId
    // remembered; static archive, so never retried.
    await upsertSection({
      id: sectionId(corpus, docId, '1'),
      corpus,
      sourceUrl: zipUrl,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: 'volume zip absent from hansard-archive (soft-404 HTML response)',
      parentDocId: docId,
    })
    return 0
  }

  const items = parseHansardV12Items(xml)
  if (items.length === 0) {
    await upsertSection({
      id: sectionId(corpus, docId, '1'),
      corpus,
      sourceUrl: zipUrl,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: 'volume contains no in-scope sitting items (chrome-only or post-cutoff)',
      parentDocId: docId,
    })
    return 0
  }

  const metas: SectionMeta[] = []
  const texts: string[] = []
  for (const item of items) {
    const ref = String(item.seq)
    const headingChain = [item.heading, item.minorHeading].filter(Boolean).join(' — ')
    const houseLabel = item.house === 'commons' ? 'Commons' : 'Lords'
    metas.push({
      id: sectionId(corpus, docId, ref),
      corpus,
      sourceUrl: zipUrl,
      r2Key: compiledKey(corpus, docId, ref),
      wordCount: countWords(item.text),
      status: 'compiled',
      sectionTitle: headingChain ? `${houseLabel}: ${headingChain}` : houseLabel,
      speaker: item.speaker ?? undefined,
      itemDate: item.itemDate ?? undefined,
      parentDocId: docId,
    })
    texts.push(item.text)
  }

  // R2 first, then DB — a section row must never point at a missing R2 key.
  // V22: batch 8 → 16. Late-century Lords volumes run ~7k items (S5LV0606P0
  // pilot); at V21's measured ~49s/1,597 sections (batch 8) they'd land ~3.6
  // min — too close to the 5-min row timeout. R2 puts dominate wall time and
  // don't touch the pg pool, so doubling the batch is safe.
  const R2_BATCH = 16
  for (let i = 0; i < metas.length; i += R2_BATCH) {
    await Promise.all(metas.slice(i, i + R2_BATCH).map((m, j) => r2Put(m.r2Key!, texts[i + j])))
  }
  const written = await bulkUpsertSections(metas)
  await deleteStaleSections(corpus, docId, metas.map(m => m.id))
  return written
}

async function processHistoricHansard(row: QueueRow): Promise<void> {
  await processHistoricHansardVolume(row.corpus, row.docId)
  await markDone(row.id, 'xml')
}

// ── Historic Hansard HTML gap-fill (V22 §4) ───────────────────────────────────
// Fills bulk-archive gaps from api.parliament.uk/historic-hansard (114 of the
// 170 missing volumes exist there — measured 13 Jun 2026). Two-stage
// queue-driven crawl under its own host budget (sourceType
// historic-hansard-html):
//   gapvol:{series}:{vol}            → enumerate sitting days, insert gapday rows
//   gapday:{house}:{yyyy/mon/dd}     → parse the day's section pages per-speech

async function processHistoricHansardHtml(row: QueueRow): Promise<void> {
  const src = await import('../sources/historic-hansard')

  const gv = /^gapvol:(S5C|S5L|S[1-4]):([0-9]+)$/.exec(row.docId)
  if (gv) {
    const days = await src.listGapVolumeDays(gv[1], Number(gv[2]))
    if (days === null) { await markFailed(row.id, `hh-html gapvol ${gv[1]} v${gv[2]}: fetch failed`); return }
    if (days.length === 0) {
      await upsertSection({
        id: sectionId(row.corpus, row.docId, '1'),
        corpus: row.corpus,
        status: 'unavailable',
        availabilityStatus: 'no-provisions',
        availabilityNote: 'volume absent from the HTML site too (genuine digitisation gap)',
        parentDocId: row.docId,
      })
      await markDone(row.id)
      return
    }
    const { bulkInsertQueueRows } = await import('../shared/queue-client')
    await bulkInsertQueueRows(days.map(d => ({
      id: `${row.corpus}:gapday:${d.house}:${d.datePath}`,
      corpus: row.corpus,
      docId: `gapday:${d.house}:${d.datePath}`,
      sourceType: 'historic-hansard-html',
      priority: 3,
    })))
    await markDone(row.id)
    return
  }

  const gd = /^gapday:(commons|lords):(\d{4}\/[a-z]{3}\/\d{1,2})$/.exec(row.docId)
  if (!gd) { await markFailed(row.id, `bad historic-hansard-html docId: ${row.docId}`); return }
  const house = gd[1] as 'commons' | 'lords'
  const datePath = gd[2]
  const itemDate = src.gapDateToIso(datePath) ?? undefined
  const houseLabel = house === 'commons' ? 'Commons' : 'Lords'

  // per-house pwdata handoff guard — gap volumes all predate the cutoffs, but
  // keep the invariant explicit
  if (itemDate && itemDate >= src.DEFAULT_CUTOFFS[house]) {
    await upsertSection({
      id: sectionId(row.corpus, row.docId, '1'),
      corpus: row.corpus,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: `sitting date ${itemDate} is past the ${house} pwdata handoff`,
      parentDocId: row.docId,
    })
    await markDone(row.id)
    return
  }

  const slugs = await src.listGapDaySections(house, datePath)
  if (slugs === null) { await markFailed(row.id, `hh-html gapday ${house} ${datePath}: day index fetch failed`); return }
  if (slugs.length === 0) {
    await upsertSection({
      id: sectionId(row.corpus, row.docId, '1'),
      corpus: row.corpus,
      sourceUrl: `https://api.parliament.uk/historic-hansard/${house}/${datePath}`,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: 'sitting-day page lists no sections',
      parentDocId: row.docId,
    })
    await markDone(row.id)
    return
  }

  const metas: SectionMeta[] = []
  const texts: string[] = []
  let seq = 0
  for (const slug of slugs) {
    const sec = await src.fetchGapSectionItems(house, datePath, slug)
    // a mid-row fetch failure aborts the whole row — reruns are idempotent
    if (sec === null) { await markFailed(row.id, `hh-html gapday ${house} ${datePath}/${slug}: section fetch failed`); return }
    for (const item of sec.items) {
      const ref = String(++seq)
      metas.push({
        id: sectionId(row.corpus, row.docId, ref),
        corpus: row.corpus,
        sourceUrl: `https://api.parliament.uk/historic-hansard/${house}/${datePath}/${slug}`,
        r2Key: compiledKey(row.corpus, row.docId, ref),
        wordCount: countWords(item.text),
        status: 'compiled',
        format: 'html',
        sectionTitle: sec.heading ? `${houseLabel}: ${sec.heading}` : houseLabel,
        speaker: item.speaker ?? undefined,
        itemDate,
        parentDocId: row.docId,
      })
      texts.push(item.text)
    }
  }

  if (metas.length === 0) {
    await upsertSection({
      id: sectionId(row.corpus, row.docId, '1'),
      corpus: row.corpus,
      sourceUrl: `https://api.parliament.uk/historic-hansard/${house}/${datePath}`,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: 'section pages held no extractable items',
      parentDocId: row.docId,
    })
    await markDone(row.id)
    return
  }

  const R2_BATCH = 16
  for (let i = 0; i < metas.length; i += R2_BATCH) {
    await Promise.all(metas.slice(i, i + R2_BATCH).map((m, j) => r2Put(m.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await deleteStaleSections(row.corpus, row.docId, metas.map(m => m.id))
  await markDone(row.id, 'html')
}

// ── GOV.UK Content API (V18 — hmrc-manuals full depth + govuk-core-docs) ─────
// docId = gov.uk path without the leading slash
// (e.g. "hmrc-internal-manuals/employment-income-manual/eim23151").
// Section 1 = details.body; sections 2..N = PDF attachments (publications).
// 404/410 writes an 'unavailable' marker so corpus_sections dedup remembers
// the path — gov.uk reorganises URLs and a deterministic 404 must not retry.

async function processGovukContent(row: QueueRow): Promise<void> {
  const { fetchGovukContent, fetchPdfBuffer } = await import('../sources/govuk-content')
  const pageUrl = `https://www.gov.uk/${row.docId}`
  const content = await fetchGovukContent(row.docId)

  const marker = async (note: string) => {
    await upsertSection({
      id: sectionId(row.corpus, row.docId, '1'),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: note,
      parentDocId: row.docId,
    })
    await markDone(row.id)
  }

  if (content.notFound) return marker('gov.uk content API 404/410 — page gone or moved')

  const metas: SectionMeta[] = []
  const texts: string[] = []
  let seq = 0
  const baseTitle = content.sectionId ? `${content.sectionId} — ${content.title}` : content.title

  const bodyText = content.bodyHtml ? rawToText(content.bodyHtml) : ''
  if (bodyText.length > 50) {
    const ref = String(++seq)
    metas.push({
      id: sectionId(row.corpus, row.docId, ref),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      r2Key: compiledKey(row.corpus, row.docId, ref),
      wordCount: countWords(bodyText),
      status: 'compiled',
      format: 'html',
      sectionTitle: baseTitle || undefined,
      itemDate: content.publicUpdatedAt ?? undefined,
      parentDocId: row.docId,
    })
    texts.push(bodyText)
  }

  const MAX_ATTACHMENTS = 20
  for (const att of content.attachments.slice(0, MAX_ATTACHMENTS)) {
    const buf = await fetchPdfBuffer(att.url!)
    if (!buf) continue
    const text = await pdfToText(buf, att.url!)
    if (!text || text.length < 100) continue
    const ref = String(++seq)
    metas.push({
      id: sectionId(row.corpus, row.docId, ref),
      corpus: row.corpus,
      sourceUrl: att.url!,
      r2Key: compiledKey(row.corpus, row.docId, ref),
      wordCount: countWords(text),
      status: 'compiled',
      format: 'pdf',
      sectionTitle: att.title ?? baseTitle ?? undefined,
      itemDate: content.publicUpdatedAt ?? undefined,
      parentDocId: row.docId,
    })
    texts.push(text)
  }

  if (metas.length === 0) return marker(`no extractable body or PDF text (document_type=${content.documentType})`)

  for (let i = 0; i < metas.length; i += 8) {
    await Promise.all(metas.slice(i, i + 8).map((m, j) => r2Put(m.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await deleteStaleSections(row.corpus, row.docId, metas.map(m => m.id))
  await markDone(row.id, metas[0].format)
}

// ── FCDO UK Treaties Online (V31 STEP 1) ───────────────────────────────────────
// treaties.fcdo.gov.uk Knowvation/AWARE JSON API — see sources/fcdo-treaties.ts
// header for the access-route rationale (no bulk export, JS-only SPA, the
// underlying anonymous REST API is the best-available tier). docId is the
// numeric lb_document_id; the processor re-fetches by that id (queryType=16
// exact match) rather than caching bulk search data across the queue, matching
// the codebase's usual one-fetch-per-row convention. Two-thirds of records
// carry no PDF at all (measured 8 Jul 2026: 14,786 of 21,970) — those get a
// compiled, searchable metadata-only section rather than a silent gap.

async function processFcdoTreaties(row: QueueRow): Promise<void> {
  const { fetchByLbDocumentId, fetchPdfBuffer } = await import('../sources/fcdo-treaties')
  const record = await fetchByLbDocumentId(row.docId)
  if (!record) {
    await upsertSection({
      id: sectionId(row.corpus, row.docId, '1'),
      corpus: row.corpus,
      sourceUrl: 'https://treaties.fcdo.gov.uk/responsive/app/consolidatedSearch/',
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: `FCDO UKTO record ${row.docId} not found on re-fetch (removed/renumbered upstream).`,
      parentDocId: row.docId,
    })
    await markDone(row.id)
    return
  }

  const pageUrl = record.documentUrl ?? 'https://treaties.fcdo.gov.uk/responsive/app/consolidatedSearch/'
  const metas: SectionMeta[] = []
  const texts: string[] = []
  let seq = 0

  const MAX_PDFS = 10
  for (const pdfUrl of record.pdfUrls.slice(0, MAX_PDFS)) {
    const buf = await fetchPdfBuffer(pdfUrl)
    if (!buf) continue
    const text = await pdfToText(buf, pdfUrl)
    if (!text || text.length < 100) continue
    const ref = String(++seq)
    metas.push({
      id: sectionId(row.corpus, row.docId, ref),
      corpus: row.corpus,
      sourceUrl: pdfUrl,
      r2Key: compiledKey(row.corpus, row.docId, ref),
      wordCount: countWords(text),
      status: 'compiled',
      format: 'pdf',
      sectionTitle: record.title,
      itemDate: record.signedDate ?? record.effectiveDate ?? undefined,
      parentDocId: row.docId,
      availabilityStatus: 'full',
    })
    texts.push(text)
  }

  if (metas.length === 0) {
    // No PDF at all, or every PDF failed extraction — the honest-denominator
    // fallback: a compiled, searchable record built from the API metadata,
    // explicitly flagged metadata-only rather than silently dropped.
    const lines = [
      '[Metadata-only UK Treaties Online record — full treaty text is not available from this source]',
      '',
      `Title: ${record.title}`,
      record.countryNames ? `Parties: ${record.countryNames}` : null,
      record.subject ? `Subject: ${record.subject}` : null,
      record.signedDate ? `Signed: ${record.signedDate}` : null,
      record.effectiveDate ? `Entry into force / definitive date: ${record.effectiveDate}` : null,
      record.references ? `Archive references: ${record.references}` : null,
    ].filter((l): l is string => l !== null)
    const text = lines.join('\n')
    metas.push({
      id: sectionId(row.corpus, row.docId, '1'),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      r2Key: compiledKey(row.corpus, row.docId, '1'),
      wordCount: countWords(text),
      status: 'compiled',
      format: 'html',
      sectionTitle: record.title,
      itemDate: record.signedDate ?? record.effectiveDate ?? undefined,
      parentDocId: row.docId,
      availabilityStatus: 'metadata-only',
      availabilityNote: record.pdfUrls.length > 0
        ? 'PDF link(s) present but text extraction failed for all of them.'
        : 'No PDF linked for this record on UK Treaties Online.',
    })
    texts.push(text)
  }

  for (let i = 0; i < metas.length; i += 8) {
    await Promise.all(metas.slice(i, i + 8).map((m, j) => r2Put(m.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await deleteStaleSections(row.corpus, row.docId, metas.map(m => m.id))
  await markDone(row.id, metas[0].format)
}

// ── Parliament Treaty Tracker (V31 STEP 2) ─────────────────────────────────────
// treaties-api.parliament.uk — documented JSON API, CRaG 2010 scrutiny layer.
// One section per treaty: the Treaty record + its BusinessItems timeline
// (debates, committee evidence, objection-period tracking) combined into one
// readable text — the small universe (328) and narrative-timeline shape don't
// warrant per-BusinessItem sections. Kept as its own corpus, separate from
// uk-treaties-fcdo (different id space, different content kind — procedure
// metadata vs treaty legal text). See sources/parliament-treaties.ts header.

async function processParliamentTreaties(row: QueueRow): Promise<void> {
  const { fetchTreaty, fetchBusinessItems } = await import('../sources/parliament-treaties')
  const treaty = await fetchTreaty(row.docId)
  if (!treaty) {
    await upsertSection({
      id: sectionId(row.corpus, row.docId, '1'),
      corpus: row.corpus,
      sourceUrl: `https://treaties-api.parliament.uk/api/Treaty/${row.docId}`,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: `Parliament Treaty Tracker record ${row.docId} not found on re-fetch.`,
      parentDocId: row.docId,
    })
    await markDone(row.id)
    return
  }

  let items: Awaited<ReturnType<typeof fetchBusinessItems>> = []
  try { items = await fetchBusinessItems(row.docId) } catch (err) { console.warn(`[pool] ${row.id}: BusinessItems fetch failed:`, err) }

  const lines = [
    treaty.name,
    '',
    treaty.treatySeriesCitation ? `Treaty Series: ${treaty.treatySeriesCitation}` : null,
    (treaty.commandPaperPrefix || treaty.commandPaperNumber != null)
      ? `Command Paper: ${treaty.commandPaperPrefix ?? ''} ${treaty.commandPaperNumber ?? ''}`.trim() : null,
    treaty.signedDate ? `Signed: ${treaty.signedDate.slice(0, 10)}` : null,
    treaty.laidDate ? `Laid before Parliament: ${treaty.laidDate.slice(0, 10)} (Commons: ${treaty.commonsLayingDate?.slice(0, 10) ?? '—'}; Lords: ${treaty.lordsLayingDate?.slice(0, 10) ?? '—'})` : null,
    treaty.leadDepartment ? `Lead department: ${treaty.leadDepartment}` : null,
    treaty.layingBodyDepartment && treaty.layingBodyDepartment !== treaty.leadDepartment ? `Laying department: ${treaty.layingBodyDepartment}` : null,
    treaty.parliamentaryConclusion ? `CRaG 2010 scrutiny status: ${treaty.parliamentaryConclusion}` : null,
    treaty.debateScheduled ? `Debate scheduled: ${treaty.debateScheduled}` : null,
    treaty.broughtToAttentionDate ? `Brought to attention: ${treaty.broughtToAttentionDate.slice(0, 10)}` : null,
    treaty.webLink ? `Source: ${treaty.webLink}` : null,
  ].filter((l): l is string => l !== null)

  if (items.length > 0) {
    lines.push('', 'Parliamentary scrutiny timeline:')
    for (const item of items) {
      const date = item.itemDate ? item.itemDate.slice(0, 10) : 'undated'
      const houses = item.houses.length ? ` [${item.houses.join(', ')}]` : ''
      const link = item.link ? ` (${item.link})` : ''
      lines.push(`- ${date}: ${item.steps.join('; ')}${houses}${link}`)
    }
  }

  const text = lines.join('\n')
  const meta: SectionMeta = {
    id: sectionId(row.corpus, row.docId, '1'),
    corpus: row.corpus,
    sourceUrl: treaty.webLink ?? treaty.uri ?? `https://treaties-api.parliament.uk/api/Treaty/${row.docId}`,
    r2Key: compiledKey(row.corpus, row.docId, '1'),
    wordCount: countWords(text),
    status: 'compiled',
    format: 'html',
    sectionTitle: treaty.name,
    itemDate: (treaty.laidDate ?? treaty.signedDate ?? undefined)?.slice(0, 10),
    parentDocId: row.docId,
    availabilityStatus: 'full',
  }

  await r2Put(meta.r2Key!, text)
  await bulkUpsertSections([meta])
  await deleteStaleSections(row.corpus, row.docId, [meta.id])
  await markDone(row.id, meta.format)
}

// ── TNA queue-driven year enumeration (V20) ───────────────────────────────────
// One row per (type, year). Enumerates the year feed via listActEntriesYear and
// seeds pending act rows for anything corpus_sections doesn't already hold —
// the V19 regnal-seeder logic moved into the queue so it runs on Railway IPs.
// A throttled year marks FAILED (reset-and-retry is manual/post-cooloff; never
// silently partial). Inserted act rows interleave behind this row in the queue.

async function processTnaEnum(row: QueueRow): Promise<void> {
  const { listActEntriesYear } = await import('../sources/tna-legislation')
  const { bulkInsertQueueRows } = await import('../shared/queue-client')
  const { getNeonPool } = await import('../shared/neon-pool')
  const m = /^enum:([a-z]+):([0-9]{4})$/.exec(row.docId)
  if (!m) { await markFailed(row.id, `bad enum docId: ${row.docId}`); return }
  const [, type, yearStr] = m

  const entries = await listActEntriesYear(type, Number(yearStr))
  if (entries === null) {
    await markFailed(row.id, `enum ${type}/${yearStr}: throttled — reset after cooloff`)
    return
  }
  if (entries.length === 0) { await markDone(row.id); return }

  const pool = getNeonPool()
  const docIds = entries.map(e => e.docId)
  const calendarIds = entries.map(e => e.calendarId).filter((c): c is string => !!c)

  const anyRes = await pool.query<{ d: string }>(
    `SELECT DISTINCT split_part(id, ':', 2) AS d FROM corpus_sections
     WHERE corpus = $1 AND split_part(id, ':', 2) = ANY($2::text[])`,
    [row.corpus, docIds])
  const hasAnyRow = new Set(anyRes.rows.map(r => r.d))
  // A calendar alias with REAL (non-boilerplate-html) compiled content means the
  // act is already held under its calendar id (V19 §2.1).
  const realRes = calendarIds.length > 0 ? await pool.query<{ d: string }>(
    `SELECT DISTINCT split_part(id, ':', 2) AS d FROM corpus_sections
     WHERE corpus = $1 AND status = 'compiled' AND format IS DISTINCT FROM 'html'
       AND split_part(id, ':', 2) = ANY($2::text[])`,
    [row.corpus, calendarIds]) : { rows: [] as Array<{ d: string }> }
  const hasRealContent = new Set(realRes.rows.map(r => r.d))

  const newRows = entries
    .filter(e => !hasAnyRow.has(e.docId) && !(e.calendarId && hasRealContent.has(e.calendarId)))
    .map(e => ({
      id: `${row.corpus}:${e.docId}`,
      corpus: row.corpus,
      docId: e.docId,
      sourceType: 'tna-legislation',
      priority: 2,
    }))
  if (newRows.length > 0) {
    const { affected } = await bulkInsertQueueRows(newRows)
    console.log(`[enum] ${type}/${yearStr}: ${entries.length} entries, ${affected} new act rows`)
  }
  await markDone(row.id)
}

// ── TNA Explanatory Notes / Memoranda (V20 probe 3 — the "intention layer") ───

async function processTnaExplanatory(row: QueueRow): Promise<void> {
  const { fetchExplanatoryDocument } = await import('../sources/tna-legislation')
  const m = /^(en|em):(.+)$/.exec(row.docId)
  if (!m) { await markFailed(row.id, `bad explanatory docId: ${row.docId}`); return }
  const kind = m[1] as 'en' | 'em'
  const legId = m[2]
  const pageUrl = kind === 'en'
    ? `https://www.legislation.gov.uk/${legId}/notes`
    : `https://www.legislation.gov.uk/${legId}/memorandum/contents`

  const doc = await fetchExplanatoryDocument(kind, legId)
  if (!doc) { await markFailed(row.id, `explanatory ${row.docId}: fetch failed`); return }

  if (doc.absent) {
    await upsertSection({
      id: sectionId(row.corpus, row.docId, '1'),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: kind === 'en'
        ? 'No Explanatory Notes published for this Act on legislation.gov.uk.'
        : 'No Explanatory Memorandum published for this instrument on legislation.gov.uk.',
      parentDocId: legId,
    })
    await markDone(row.id)
    return
  }

  let text: string | null = null
  let format: SectionMeta['format'] = 'pdf'
  if (doc.pdf) {
    text = await pdfToText(doc.pdf, row.docId)
    format = 'pdf'
  } else if (doc.html) {
    text = rawToText(doc.html)
    format = 'html'
  }
  if (!text || text.length < 200) {
    await upsertSection({
      id: sectionId(row.corpus, row.docId, '1'),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: 'EN/EM document exists but no text could be extracted.',
      parentDocId: legId,
    })
    await markDone(row.id)
    return
  }

  const cKey = compiledKey(row.corpus, row.docId, '1')
  await r2Put(cKey, text)
  await upsertSection({
    id: sectionId(row.corpus, row.docId, '1'),
    corpus: row.corpus,
    sourceUrl: pageUrl,
    r2Key: cKey,
    wordCount: countWords(text),
    status: 'compiled',
    format,
    sectionTitle: `${kind === 'en' ? 'Explanatory Notes' : 'Explanatory Memorandum'}: ${legId}`,
    parentDocId: legId,
  })
  await markDone(row.id, format)
}

// ── Committees API (V20 — replaces the CF-blocked portal scraper) ─────────────

async function processCommitteesApi(row: QueueRow): Promise<void> {
  // V20: queue-driven listing (list:{kind}:{skip}) — the API rate-limits deep
  // listing walks from a single local IP (WrittenEvidence cut off at ~2,700 of
  // 126,589 across three runs); Railway claim loops walk it within the normal
  // source budget instead.
  if (row.docId.startsWith('list:')) return processCommitteesApiList(row)
  const { getCommitteesApiItem, fetchCommitteesApiDocument } = await import('../sources/committees-api')
  const m = /^(publication|oralevidence|writtenevidence):([0-9]+)$/.exec(row.docId)
  if (!m) { await markFailed(row.id, `bad committees-api docId: ${row.docId}`); return }
  const kind = m[1] === 'publication' ? 'Publications' as const
    : m[1] === 'oralevidence' ? 'OralEvidence' as const : 'WrittenEvidence' as const
  const itemId = Number(m[2])
  const webPath = m[1] === 'publication' ? 'publications' : m[1]
  const pageUrl = `https://committees.parliament.uk/${webPath}/${itemId}/`

  const item = await getCommitteesApiItem(kind, itemId)
  if (!item) { await markFailed(row.id, `committees-api ${kind}/${itemId}: detail fetch failed`); return }

  const marker = async (note: string) => {
    await upsertSection({
      id: sectionId(row.corpus, row.docId, '1'),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: note,
      parentDocId: row.docId,
    })
    await markDone(row.id)
  }

  const docs = kind === 'Publications' ? (item.documents ?? []) : (item.document ? [item.document] : [])
  if (docs.length === 0) return marker('committees-api item has no documents')

  const title = kind === 'Publications'
    ? [item.type?.name, item.description].filter(Boolean).join(': ')
    : [item.committeeBusiness?.title, item.internalReference].filter(Boolean).join(' — ')
  const itemDate = (item.publicationStartDate ?? item.publicationDate ?? '').slice(0, 10) || undefined

  const metas: SectionMeta[] = []
  const texts: string[] = []
  for (const doc of docs) {
    const fetched = await fetchCommitteesApiDocument(kind, itemId, doc.documentId, doc.files ?? [])
    if (!fetched) continue
    let text: string | null = null
    let format: SectionMeta['format'] = 'html'
    const name = fetched.fileName.toLowerCase()
    if (fetched.servedFormat === 'Html' || name.endsWith('.html') || name.endsWith('.htm')) {
      text = rawToText(fetched.buffer.toString('utf8'))
      format = 'html'
    } else if (fetched.servedFormat === 'Pdf' || name.endsWith('.pdf')) {
      text = await pdfToText(fetched.buffer, fetched.fileName)
      format = 'pdf'
    }
    // .doc/.docx originals with no Html/Pdf conversion: no parser — falls through
    if (!text || text.length < 100) continue
    const ref = String(doc.documentId)
    metas.push({
      id: sectionId(row.corpus, row.docId, ref),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      r2Key: compiledKey(row.corpus, row.docId, ref),
      wordCount: countWords(text),
      status: 'compiled',
      format,
      sectionTitle: title || undefined,
      itemDate,
      parentDocId: row.docId,
    })
    texts.push(text)
  }

  if (metas.length === 0) return marker('no extractable document text (original format unparseable, no Html/Pdf conversion)')

  for (let i = 0; i < metas.length; i += 8) {
    await Promise.all(metas.slice(i, i + 8).map((m2, j) => r2Put(m2.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await deleteStaleSections(row.corpus, row.docId, metas.map(m2 => m2.id))
  await markDone(row.id, metas[0].format)
}

async function processCommitteesApiList(row: QueueRow): Promise<void> {
  const { listCommitteesApiPage } = await import('../sources/committees-api')
  const { bulkInsertQueueRows } = await import('../shared/queue-client')

  // V22 windowed form: list:{key}:win:{YYYY-MM} (one calendar month) or
  // list:{key}:win:pre{YYYY} (everything before 1 Jan YYYY). Deep global
  // offsets 500 server-side at load-dependent depths (12-13 Jun probes), so
  // each row walks ONE date window where Skip stays shallow (max month ~2k
  // items = ~20 pages). Window boundaries use inclusive StartDate/EndDate
  // with first-of-next-month EndDate — the 1-day overlap is harmless, item
  // inserts are ON CONFLICT DO NOTHING.
  const wm = /^list:(publication|oralevidence|writtenevidence):win:(pre([0-9]{4})|([0-9]{4})-([0-9]{2}))$/.exec(row.docId)
  if (wm) {
    const key = wm[1]
    const kind = key === 'publication' ? 'Publications' as const
      : key === 'oralevidence' ? 'OralEvidence' as const : 'WrittenEvidence' as const
    const corpus = key === 'publication' ? 'committees-reports' : 'committees-evidence'
    let window: { start: string; end: string }
    if (wm[3]) {
      window = { start: '2000-01-01', end: `${wm[3]}-01-01` }
    } else {
      const y = Number(wm[4]); const mo = Number(wm[5])
      const next = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`
      window = { start: `${wm[4]}-${wm[5]}-01`, end: next }
    }
    let inserted = 0
    for (let skip = 0; ; skip += 100) {
      let page = await listCommitteesApiPage(kind, skip, 100, window)
      if (!page) {
        // one in-row retry after cooling — transient listing failures burned
        // three V20 walks; a window row is cheap enough to retry once
        await new Promise(r => setTimeout(r, 60_000))
        page = await listCommitteesApiPage(kind, skip, 100, window)
      }
      if (!page) { await markFailed(row.id, `committees-api list ${kind} win=${wm[2]} skip=${skip}: fetch failed`); return }
      if (page.items.length > 0) {
        const rows = page.items.map(it => ({
          id: `${corpus}:${key}:${it.id}`,
          corpus,
          docId: `${key}:${it.id}`,
          sourceType: 'committees-api',
          priority: 2,
        }))
        const { affected } = await bulkInsertQueueRows(rows)
        inserted += affected
      }
      if (skip + 100 >= page.totalResults || page.items.length === 0) break
    }
    console.log(`[committees-api] list window ${kind} ${wm[2]}: +${inserted} new item rows`)
    await markDone(row.id)
    return
  }

  // legacy offset form (V20) — retained for any straggler rows
  const m = /^list:(publication|oralevidence|writtenevidence):([0-9]+)$/.exec(row.docId)
  if (!m) { await markFailed(row.id, `bad committees-api list docId: ${row.docId}`); return }
  const key = m[1]
  const kind = key === 'publication' ? 'Publications' as const
    : key === 'oralevidence' ? 'OralEvidence' as const : 'WrittenEvidence' as const
  const skip = Number(m[2])
  const corpus = key === 'publication' ? 'committees-reports' : 'committees-evidence'

  const page = await listCommitteesApiPage(kind, skip, 100)
  if (!page) { await markFailed(row.id, `committees-api list ${kind} skip=${skip}: fetch failed`); return }
  if (page.items.length > 0) {
    const rows = page.items.map(it => ({
      id: `${corpus}:${key}:${it.id}`,
      corpus,
      docId: `${key}:${it.id}`,
      sourceType: 'committees-api',
      priority: 2,
    }))
    await bulkInsertQueueRows(rows)
  }
  await markDone(row.id)
}

// ── Historic tax tribunals (V20 probe 2 — financeandtax archive) ──────────────

async function processTaxTribunals(row: QueueRow): Promise<void> {
  const { fetchTaxTribunalDecision, fetchTaxTribunalFile, docToText } = await import('../sources/tax-tribunals')
  const numId = Number(row.docId)
  if (!Number.isInteger(numId) || numId < 1) { await markFailed(row.id, `bad tax-tribunals docId: ${row.docId}`); return }
  const pageUrl = `https://financeandtax.decisions.tribunals.gov.uk/Aspx/view.aspx?id=${numId}`

  const decision = await fetchTaxTribunalDecision(numId)
  if (!decision) { await markFailed(row.id, `tax-tribunals id=${numId}: view fetch failed`); return }

  const marker = async (note: string) => {
    await upsertSection({
      id: sectionId(row.corpus, row.docId, '1'),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: note,
      parentDocId: row.docId,
    })
    await markDone(row.id)
  }

  if (decision.empty) return marker('gap in tax-tribunals id space — no decision at this id')
  if (decision.fileUrls.length === 0) return marker('decision metadata exists but no judgment file linked')

  const title = [decision.decisionNumber, [decision.appellant, decision.respondent].filter(Boolean).join(' v ')]
    .filter(Boolean).join(': ')

  const metas: SectionMeta[] = []
  const texts: string[] = []
  let seq = 0
  for (const url of decision.fileUrls) {
    const buf = await fetchTaxTribunalFile(url)
    if (!buf) continue
    const lower = url.toLowerCase()
    let text: string | null = null
    let format: SectionMeta['format'] = 'pdf'
    if (lower.endsWith('.pdf')) {
      text = await pdfToText(buf, url)
      format = 'pdf'
    } else if (lower.endsWith('.doc') || lower.endsWith('.docx') || lower.endsWith('.rtf')) {
      text = await docToText(buf)
      format = 'html' // closest existing format bucket for extracted word-processor text
    } else if (lower.endsWith('.htm') || lower.endsWith('.html')) {
      text = rawToText(buf.toString('utf8'))
      format = 'html'
    }
    if (!text || text.length < 100) continue
    const ref = String(++seq)
    metas.push({
      id: sectionId(row.corpus, row.docId, ref),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      r2Key: compiledKey(row.corpus, row.docId, ref),
      wordCount: countWords(text),
      status: 'compiled',
      format,
      sectionTitle: title || undefined,
      speaker: decision.chairmen ?? undefined,
      itemDate: decision.decisionDate ?? undefined,
      parentDocId: row.docId,
      notes: [decision.category, decision.subcategory].filter(Boolean).join(' / ') || undefined,
    })
    texts.push(text)
  }

  if (metas.length === 0) return marker('judgment file(s) present but no extractable text')

  for (let i = 0; i < metas.length; i += 8) {
    await Promise.all(metas.slice(i, i + 8).map((m2, j) => r2Put(m2.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await deleteStaleSections(row.corpus, row.docId, metas.map(m2 => m2.id))
  await markDone(row.id, metas[0].format)
}

// ── Law Commission England & Wales (V20 probe 4) ──────────────────────────────

async function processLawcom(row: QueueRow): Promise<void> {
  const { fetchLawcomDocumentUrls, fetchLawcomFile } = await import('../sources/lawcom')
  // docId: publication slug; queue row notes carry "{wpId}|{date}|{title}" from the seeder
  const pageUrl = `https://lawcom.gov.uk/publication/${row.docId}/`

  const docUrls = await fetchLawcomDocumentUrls(pageUrl)
  if (docUrls === null) { await markFailed(row.id, `lawcom ${row.docId}: page fetch failed`); return }

  const marker = async (note: string) => {
    await upsertSection({
      id: sectionId(row.corpus, row.docId, '1'),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: note,
      parentDocId: row.docId,
    })
    await markDone(row.id)
  }

  if (docUrls.length === 0) return marker('lawcom publication page has no PDF/doc links')

  const metas: SectionMeta[] = []
  const texts: string[] = []
  let seq = 0
  const MAX_DOCS = 20
  for (const url of docUrls.slice(0, MAX_DOCS)) {
    const buf = await fetchLawcomFile(url)
    if (!buf) continue
    let text: string | null = null
    let format: SectionMeta['format'] = 'pdf'
    if (/\.pdf(\?|$)/i.test(url)) {
      text = await pdfToText(buf, url)
      format = 'pdf'
    } else {
      const { docToText } = await import('../sources/tax-tribunals')
      text = await docToText(buf)
      format = 'html'
    }
    if (!text || text.length < 100) continue
    const ref = String(++seq)
    metas.push({
      id: sectionId(row.corpus, row.docId, ref),
      corpus: row.corpus,
      sourceUrl: url,
      r2Key: compiledKey(row.corpus, row.docId, ref),
      wordCount: countWords(text),
      status: 'compiled',
      format,
      sectionTitle: row.docId.replace(/-/g, ' '),
      parentDocId: row.docId,
    })
    texts.push(text)
  }

  if (metas.length === 0) return marker('lawcom documents present but no extractable text')

  for (let i = 0; i < metas.length; i += 8) {
    await Promise.all(metas.slice(i, i + 8).map((m2, j) => r2Put(m2.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await deleteStaleSections(row.corpus, row.docId, metas.map(m2 => m2.id))
  await markDone(row.id, metas[0].format)
}

// ── Judiciary NI decisions (V20 probe 5) ──────────────────────────────────────

// V22: queue-driven listing — the host's per-IP listing budget is ~30 pages per
// session (local walk cut at p66 on 12 Jun and p96 on 13 Jun despite 60s-cooling
// retries). list:page:{N} rows drip one listing fetch per claim from Railway
// within the source budget instead.
async function processJudiciaryNiList(row: QueueRow): Promise<void> {
  const { listNiDecisionsPage } = await import('../sources/judiciaryni')
  const { bulkInsertQueueRows } = await import('../shared/queue-client')
  const page = Number(/^list:page:([0-9]+)$/.exec(row.docId)?.[1])
  if (!Number.isInteger(page)) { await markFailed(row.id, `bad judiciaryni list docId: ${row.docId}`); return }
  const slugs = await listNiDecisionsPage(page)
  if (slugs === null) { await markFailed(row.id, `judiciaryni list page=${page}: fetch failed`); return }
  if (slugs.length > 0) {
    await bulkInsertQueueRows(slugs.map(s => ({
      id: `${row.corpus}:${s}`,
      corpus: row.corpus,
      docId: s,
      sourceType: 'judiciaryni',
      priority: 2,
    })))
  }
  await markDone(row.id)
}

async function processJudiciaryNi(row: QueueRow): Promise<void> {
  if (row.docId.startsWith('list:')) return processJudiciaryNiList(row)
  const { fetchNiDecision, fetchNiFile } = await import('../sources/judiciaryni')
  const { docToText } = await import('../sources/tax-tribunals')
  const slug = row.docId
  const pageUrl = `https://www.judiciaryni.uk/judicial-decisions/${slug}`

  const decision = await fetchNiDecision(slug)
  if (!decision) { await markFailed(row.id, `judiciaryni ${slug}: page fetch failed`); return }

  const marker = async (note: string) => {
    await upsertSection({
      id: sectionId(row.corpus, slug, '1'),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: note,
      parentDocId: slug,
    })
    await markDone(row.id)
  }

  if (decision.fileUrls.length === 0) return marker('NI decision page has no judgment file links')

  const metas: SectionMeta[] = []
  const texts: string[] = []
  let seq = 0
  for (const url of decision.fileUrls.slice(0, 10)) {
    const buf = await fetchNiFile(url)
    if (!buf) continue
    let text: string | null = null
    let format: SectionMeta['format'] = 'pdf'
    if (/\.pdf$/i.test(url)) {
      text = await pdfToText(buf, url)
      format = 'pdf'
    } else {
      text = await docToText(buf)
      format = 'html'
    }
    if (!text || text.length < 100) continue
    const ref = String(++seq)
    metas.push({
      id: sectionId(row.corpus, slug, ref),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      r2Key: compiledKey(row.corpus, slug, ref),
      wordCount: countWords(text),
      status: 'compiled',
      format,
      sectionTitle: decision.title ?? slug,
      itemDate: decision.date ?? undefined,
      parentDocId: slug,
    })
    texts.push(text)
  }

  if (metas.length === 0) return marker('NI judgment file(s) present but no extractable text')

  for (let i = 0; i < metas.length; i += 8) {
    await Promise.all(metas.slice(i, i + 8).map((m2, j) => r2Put(m2.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await deleteStaleSections(row.corpus, slug, metas.map(m2 => m2.id))
  await markDone(row.id, metas[0].format)
}

// ── NI Assembly plenary Hansard (V24 §4 — AIMS Open Data, OGL v3.0) ───────────
// docId = "{reportId}:{YYYY-MM-DD}" (the sitting date is carried so the worker
// needs no list call). One section per speaker-turn (pwdata-shaped).

async function processNiAssemblyHansard(row: QueueRow): Promise<void> {
  const { fetchReportSpeeches } = await import('../sources/niassembly-hansard')
  const colon = row.docId.indexOf(':')
  const reportId = colon >= 0 ? row.docId.slice(0, colon) : row.docId
  const date = colon >= 0 ? row.docId.slice(colon + 1) : ''
  const pageUrl = `http://data.niassembly.gov.uk/hansard.asmx/GetHansardComponentsByReportId?reportId=${reportId}`

  const items = await fetchReportSpeeches(reportId, date)
  if (items === null) { await markFailed(row.id, `niassembly ${reportId}: components fetch failed`); return }

  if (items.length === 0) {
    await upsertSection({
      id: sectionId(row.corpus, reportId, '1'),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: 'NI Assembly report has no extractable speaker-turn components',
      itemDate: date || undefined,
      parentDocId: reportId,
    })
    await markDone(row.id)
    return
  }

  const metas: SectionMeta[] = []
  const texts: string[] = []
  for (const item of items) {
    const ref = String(item.seq)
    metas.push({
      id: sectionId(row.corpus, reportId, ref),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      r2Key: compiledKey(row.corpus, reportId, ref),
      wordCount: countWords(item.text),
      status: 'compiled',
      format: 'html',
      sectionTitle: item.heading ? `NI Assembly: ${item.heading}` : 'NI Assembly',
      speaker: item.speaker ?? undefined,
      itemDate: item.itemDate || undefined,
      parentDocId: reportId,
    })
    texts.push(item.text)
  }

  const R2_BATCH = 16
  for (let i = 0; i < metas.length; i += R2_BATCH) {
    await Promise.all(metas.slice(i, i + R2_BATCH).map((m, j) => r2Put(m.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await deleteStaleSections(row.corpus, reportId, metas.map(m => m.id))
  await markDone(row.id, 'html')
}

// ── Public inquiry reports (V24 §5 — gov.uk publication-attachment PDFs) ───────
// One report PDF per row (12-volume inquiries are too large to extract in a
// single row under the 5-min cap). docId = "{key}#{seq}|{pdfUrl}".

async function processInquiryReports(row: QueueRow): Promise<void> {
  const { fetchPdfBuffer } = await import('../sources/inquiry-reports')
  const bar = row.docId.indexOf('|')
  const meta = bar >= 0 ? row.docId.slice(0, bar) : row.docId   // "{key}#{seq}"
  const pdfUrl = bar >= 0 ? row.docId.slice(bar + 1) : ''
  const hash = meta.indexOf('#')
  const key = hash >= 0 ? meta.slice(0, hash) : meta
  const seq = hash >= 0 ? meta.slice(hash + 1) : '1'
  if (!pdfUrl) { await markFailed(row.id, `bad inquiry-reports docId: ${row.docId}`); return }

  const cKey = compiledKey(row.corpus, key, seq)
  if (await r2Exists(cKey)) { await markDone(row.id, 'pdf'); return }

  const buf = await fetchPdfBuffer(pdfUrl)
  if (!buf) { await markFailed(row.id, `inquiry-reports ${key}#${seq}: PDF fetch failed`); return }

  const text = await pdfToText(buf, pdfUrl)
  if (!text || text.length < 100) {
    await upsertSection({
      id: sectionId(row.corpus, key, seq),
      corpus: row.corpus,
      sourceUrl: pdfUrl,
      status: 'unavailable',
      availabilityStatus: 'pdf-only',
      availabilityNote: 'inquiry report PDF served but no extractable text (scanned — OCR pass needed)',
      parentDocId: key,
    })
    await markDone(row.id, 'pdf')
    return
  }

  await r2Put(cKey, text)
  await upsertSection({
    id: sectionId(row.corpus, key, seq),
    corpus: row.corpus,
    sourceUrl: pdfUrl,
    r2Key: cKey,
    wordCount: countWords(text),
    status: 'compiled',
    format: 'pdf',
    sectionTitle: `${key.replace(/-/g, ' ')} — vol ${seq}`,
    parentDocId: key,
  })
  await markDone(row.id, 'pdf')
}

// ── CMA cases & decisions (V30 §1.1 — gov.uk cma_case finder, OGL v3.0) ───────
// Two row shapes (set at seed time):
//   "{slug}#overview"        → the case body (HTML) → one OVERVIEW section.
//   "{slug}#{seq}|{pdfUrl}"  → one decision-document PDF → one section (per-PDF
//                              budget; a merger case can carry ~30 PDFs).
// All sections of a case share parentDocId = slug.
async function processCmaCases(row: QueueRow): Promise<void> {
  const bar = row.docId.indexOf('|')
  if (bar >= 0) {
    // Decision-document PDF (inquiry-reports mechanics — per-PDF claim budget).
    const { fetchPdfBuffer } = await import('../sources/cma-cases')
    const meta = row.docId.slice(0, bar)            // "{slug}#{seq}"
    const pdfUrl = row.docId.slice(bar + 1)
    const hash = meta.indexOf('#')
    const slug = hash >= 0 ? meta.slice(0, hash) : meta
    const seq = hash >= 0 ? meta.slice(hash + 1) : '1'
    if (!pdfUrl || !slug) { await markFailed(row.id, `bad cma-cases docId: ${row.docId}`); return }

    const cKey = compiledKey(row.corpus, slug, seq)
    if (await r2Exists(cKey)) { await markDone(row.id, 'pdf'); return }
    const buf = await fetchPdfBuffer(pdfUrl)
    if (!buf) { await markFailed(row.id, `cma-cases ${slug}#${seq}: PDF fetch failed`); return }
    const text = await pdfToText(buf, pdfUrl)
    if (!text || text.length < 100) {
      await upsertSection({
        id: sectionId(row.corpus, slug, seq), corpus: row.corpus, sourceUrl: pdfUrl,
        status: 'unavailable', availabilityStatus: 'pdf-only',
        availabilityNote: 'CMA decision PDF served but no extractable text (scanned — OCR pass needed)',
        parentDocId: slug,
      })
      await markDone(row.id, 'pdf'); return
    }
    await r2Put(cKey, text)
    await upsertSection({
      id: sectionId(row.corpus, slug, seq), corpus: row.corpus, sourceUrl: pdfUrl,
      r2Key: cKey, wordCount: countWords(text), status: 'compiled', format: 'pdf',
      sectionTitle: `${slug.replace(/-/g, ' ')} — decision doc ${seq}`, parentDocId: slug,
    })
    await markDone(row.id, 'pdf'); return
  }

  // Case OVERVIEW (the body page) — docId "{slug}#overview".
  const { fetchCmaCase } = await import('../sources/cma-cases')
  const slug = row.docId.replace(/#overview$/, '')
  const pageUrl = `https://www.gov.uk/cma-cases/${slug}`
  const c = await fetchCmaCase(slug)
  if (!c) { await markFailed(row.id, `cma-cases ${slug}: case fetch failed`); return }
  if (c.body.length < 200) {
    await upsertSection({
      id: sectionId(row.corpus, slug, 'overview'), corpus: row.corpus, sourceUrl: pageUrl,
      status: 'unavailable', availabilityStatus: 'no-provisions',
      availabilityNote: 'CMA case page has no extractable overview text',
      itemDate: c.date || undefined, parentDocId: slug,
    })
    await markDone(row.id); return
  }
  const cKey = compiledKey(row.corpus, slug, 'overview')
  await r2Put(cKey, c.body)
  await upsertSection({
    id: sectionId(row.corpus, slug, 'overview'), corpus: row.corpus, sourceUrl: pageUrl,
    r2Key: cKey, wordCount: countWords(c.body), status: 'compiled', format: 'html',
    sectionTitle: c.title, itemDate: c.date || undefined, parentDocId: slug,
  })
  await markDone(row.id, 'html')
}

// ── Public-inquiry evidence (V30 §3 — §0-governed; token PDFs resolved live) ───
// docId = "{inquiryKey}#{slug}". The §0 sensitive-category exclusion is applied
// at SEED time (excluded items get no row), so the worker only ingests kept
// items. Detail page is fetched fresh to resolve the current /file download
// token (tokens are not stable across a deferred drain). parentDocId = inquiryKey.
async function processInquiryEvidence(row: QueueRow): Promise<void> {
  const { INQUIRY_EVIDENCE_SOURCES, pohFetchItem, classifyEvidence, fetchPdfBuffer } = await import('../sources/inquiry-evidence')
  const hash = row.docId.indexOf('#')
  const key = hash >= 0 ? row.docId.slice(0, hash) : row.docId
  const slug = hash >= 0 ? row.docId.slice(hash + 1) : ''
  const src = INQUIRY_EVIDENCE_SOURCES.find(s => s.key === key)
  if (!src || !slug) { await markFailed(row.id, `bad inquiry-evidence docId: ${row.docId}`); return }
  const pageUrl = `${src.base}/evidence/${slug}`

  const item = await pohFetchItem(src.base, slug)
  if (!item) { await markFailed(row.id, `inquiry-evidence ${key}/${slug}: detail fetch failed`); return }

  // §0 STRUCTURAL EXCLUSION — enforced at ingest. Excluded/flagged items get an
  // accounted-for marker (no content), never the document text.
  const cls = classifyEvidence({
    sensitivity: src.sensitivity, refPrefix: item.refPrefix, evidenceType: item.evidenceType,
    witnessCategory: item.witnessCategory, witness: item.witness, title: item.title,
  })
  if (cls.decision !== 'keep') {
    await upsertSection({
      id: sectionId(row.corpus, slug, '1'), corpus: row.corpus, sourceUrl: pageUrl,
      status: 'unavailable',
      availabilityStatus: cls.decision === 'exclude' ? 'sensitive-excluded' : 'sensitive-flagged',
      availabilityNote: `§0 ${cls.decision}: ${cls.reason} (${item.ref})`,
      itemDate: item.date ?? undefined, parentDocId: key,
    })
    await markDone(row.id); return
  }

  if (!item.pdfUrl) {
    await upsertSection({
      id: sectionId(row.corpus, slug, '1'), corpus: row.corpus, sourceUrl: pageUrl,
      status: 'unavailable', availabilityStatus: 'no-pdf',
      availabilityNote: `inquiry-evidence ${item.ref}: no downloadable document on the detail page`,
      itemDate: item.date ?? undefined, parentDocId: key,
    })
    await markDone(row.id); return
  }

  const cKey = compiledKey(row.corpus, slug, '1')
  if (await r2Exists(cKey)) { await markDone(row.id, 'pdf'); return }
  const buf = await fetchPdfBuffer(item.pdfUrl)
  if (!buf) { await markFailed(row.id, `inquiry-evidence ${item.ref}: PDF fetch failed`); return }
  const text = await pdfToText(buf, item.pdfUrl)
  if (!text || text.length < 100) {
    await upsertSection({
      id: sectionId(row.corpus, slug, '1'), corpus: row.corpus, sourceUrl: pageUrl,
      status: 'unavailable', availabilityStatus: 'pdf-only',
      availabilityNote: `inquiry-evidence ${item.ref}: PDF served but no extractable text (scanned/native image — OCR pass)`,
      itemDate: item.date ?? undefined, parentDocId: key,
    })
    await markDone(row.id, 'pdf'); return
  }
  await r2Put(cKey, text)
  await upsertSection({
    id: sectionId(row.corpus, slug, '1'), corpus: row.corpus, sourceUrl: pageUrl,
    r2Key: cKey, wordCount: countWords(text), status: 'compiled', format: 'pdf',
    sectionTitle: `${item.ref} — ${item.title}`.slice(0, 180),
    itemDate: item.date ?? undefined, parentDocId: key,
  })
  await markDone(row.id, 'pdf')
}

// ── Senedd Plenary Cofnod (V25 §2 — record.senedd.wales, OGL v3.0) ────────────
// docId = "{meetingId}". One section per English speaker-turn (pwdata-shaped).

async function processSeneddCofnod(row: QueueRow): Promise<void> {
  const { fetchPlenary } = await import('../sources/senedd-cofnod')
  const meetingId = Number(row.docId)
  if (!Number.isInteger(meetingId)) { await markFailed(row.id, `bad senedd-cofnod docId: ${row.docId}`); return }
  const pageUrl = `https://record.senedd.wales/Plenary/${meetingId}`

  const plenary = await fetchPlenary(meetingId)
  if (!plenary) { await markFailed(row.id, `senedd ${meetingId}: plenary fetch failed`); return }

  if (plenary.items.length === 0) {
    await upsertSection({
      id: sectionId(row.corpus, String(meetingId), '1'),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: 'Senedd plenary has no extractable contributions (future/empty sitting)',
      itemDate: plenary.date || undefined,
      parentDocId: String(meetingId),
    })
    await markDone(row.id)
    return
  }

  const metas: SectionMeta[] = []
  const texts: string[] = []
  for (const it of plenary.items) {
    const ref = String(it.seq)
    metas.push({
      id: sectionId(row.corpus, String(meetingId), ref),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      r2Key: compiledKey(row.corpus, String(meetingId), ref),
      wordCount: countWords(it.text),
      status: 'compiled',
      format: 'html',
      sectionTitle: it.heading ? `Senedd Plenary: ${it.heading}` : 'Senedd Plenary',
      speaker: it.speaker ?? undefined,
      itemDate: plenary.date || undefined,
      parentDocId: String(meetingId),
    })
    texts.push(it.text)
  }

  const R2_BATCH = 16
  for (let i = 0; i < metas.length; i += R2_BATCH) {
    await Promise.all(metas.slice(i, i + R2_BATCH).map((m, j) => r2Put(m.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await deleteStaleSections(row.corpus, String(meetingId), metas.map(m => m.id))
  await markDone(row.id, 'html')
}

// ── UK Parliament Bills (V25 §4 — bills-api.parliament.uk, OPL v3.0) ──────────
// Two-stage: list:{billId} enumerates a bill's publication PDFs into per-PDF
// content rows ("{billId}#{seq}|{url}"); a content row extracts ONE PDF → one
// section. A bill can carry hundreds of PDFs, too many for one row's 5-min budget.

async function processBills(row: QueueRow): Promise<void> {
  const { listBillPdfs, fetchBillPdf } = await import('../sources/bills-parliament')

  if (row.docId.startsWith('list:')) {
    const { bulkInsertQueueRows } = await import('../shared/queue-client')
    const billId = Number(row.docId.slice(5))
    if (!Number.isInteger(billId)) { await markFailed(row.id, `bad bills list docId: ${row.docId}`); return }
    const pdfs = await listBillPdfs(billId)
    if (pdfs === null) { await markFailed(row.id, `bills ${billId}: publications fetch failed`); return }
    if (pdfs.length > 0) {
      await bulkInsertQueueRows(pdfs.map((p, i) => ({
        id: `${row.corpus}:${billId}#${i + 1}`,
        corpus: row.corpus,
        docId: `${billId}#${i + 1}|${p.url}`,
        sourceType: 'bills-api',
        priority: 2,
      })))
    }
    await markDone(row.id)
    return
  }

  const bar = row.docId.indexOf('|')
  const meta = bar >= 0 ? row.docId.slice(0, bar) : row.docId  // "{billId}#{seq}"
  const url = bar >= 0 ? row.docId.slice(bar + 1) : ''
  const hash = meta.indexOf('#')
  const billId = hash >= 0 ? meta.slice(0, hash) : meta
  const seq = hash >= 0 ? meta.slice(hash + 1) : '1'
  if (!url) { await markFailed(row.id, `bad bills content docId: ${row.docId}`); return }

  const cKey = compiledKey(row.corpus, billId, seq)
  if (await r2Exists(cKey)) { await markDone(row.id, 'pdf'); return }

  const buf = await fetchBillPdf(url)
  if (!buf) { await markFailed(row.id, `bills ${billId}#${seq}: PDF fetch failed`); return }
  const text = await pdfToText(buf, url)
  if (!text || text.length < 100) {
    await upsertSection({
      id: sectionId(row.corpus, billId, seq),
      corpus: row.corpus,
      sourceUrl: url,
      status: 'unavailable',
      availabilityStatus: 'pdf-only',
      availabilityNote: 'bill publication PDF served but no extractable text',
      parentDocId: billId,
    })
    await markDone(row.id, 'pdf')
    return
  }

  await r2Put(cKey, text)
  await upsertSection({
    id: sectionId(row.corpus, billId, seq),
    corpus: row.corpus,
    sourceUrl: url,
    r2Key: cKey,
    wordCount: countWords(text),
    status: 'compiled',
    format: 'pdf',
    sectionTitle: `Bill ${billId} — publication ${seq}`,
    parentDocId: billId,
  })
  await markDone(row.id, 'pdf')
}

// ── College of Policing APP (V25 §3 — UK Gov Web Archive 2022, college-nc) ─────
// docId = "{timestamp}|{archivedUrl}". One section per APP page; snapshot date as
// itemDate so the ~4yr staleness is visible. COMMERCIAL-SURFACE EXCLUDED.

async function processCollegePolicing(row: QueueRow): Promise<void> {
  const { fetchArchivedAppPage, snapshotIsoDate } = await import('../sources/college-policing-archive')
  const bar = row.docId.indexOf('|')
  const ts = bar >= 0 ? row.docId.slice(0, bar) : ''
  const url = bar >= 0 ? row.docId.slice(bar + 1) : ''
  if (!ts || !url) { await markFailed(row.id, `bad college docId: ${row.docId}`); return }
  const slug = url.replace(/^https?:\/\/www\.app\.college\.police\.uk\//, '').replace(/\/$/, '') || 'app-content'
  const itemDate = snapshotIsoDate(ts)

  const res = await fetchArchivedAppPage(ts, url)
  if (!res) { await markFailed(row.id, `college ${slug}: archive fetch failed`); return }

  if (res.text.length < 100) {
    await upsertSection({
      id: sectionId(row.corpus, slug, '1'),
      corpus: row.corpus,
      sourceUrl: url,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: 'archived APP page had no extractable content',
      itemDate,
      parentDocId: slug,
    })
    await markDone(row.id)
    return
  }

  const cKey = compiledKey(row.corpus, slug, '1')
  await r2Put(cKey, res.text)
  await upsertSection({
    id: sectionId(row.corpus, slug, '1'),
    corpus: row.corpus,
    sourceUrl: url,
    r2Key: cKey,
    wordCount: countWords(res.text),
    status: 'compiled',
    format: 'html',
    sectionTitle: res.title || slug,
    itemDate,
    parentDocId: slug,
  })
  await markDone(row.id, 'html')
}

// ── Scottish Courts judgments (V27 §2 — scotcourts.gov.uk, OGL) ───────────────
// One PDF judgment per row. docId = "{key}|{date}|{court}" where key is the
// reversible media path (no leading slash, no .pdf) and date/court ride along so
// the worker needs no per-row search call.

async function processScottishCourts(row: QueueRow): Promise<void> {
  const { fetchJudgmentPdf, keyToPdfUrl } = await import('../sources/scottish-courts')
  const parts = row.docId.split('|')
  const key = parts[0]
  const date = parts[1] || undefined
  const court = parts.slice(2).join('|') || undefined
  if (!key) { await markFailed(row.id, `bad scottish-courts docId: ${row.docId}`); return }
  const pdfUrl = keyToPdfUrl(key)

  const cKey = compiledKey(row.corpus, key, '1')
  if (await r2Exists(cKey)) { await markDone(row.id, 'pdf'); return }

  const buf = await fetchJudgmentPdf(key)
  if (!buf) { await markFailed(row.id, `scottish-courts ${key}: PDF fetch failed`); return }

  const text = await pdfToText(buf, pdfUrl)
  const stem = (key.split('/').pop() ?? key).replace(/-/g, ' ')
  if (!text || text.length < 100) {
    await upsertSection({
      id: sectionId(row.corpus, key, '1'),
      corpus: row.corpus,
      sourceUrl: pdfUrl,
      status: 'unavailable',
      availabilityStatus: 'pdf-only',
      availabilityNote: 'judgment PDF served but no extractable text (scanned — OCR pass needed)',
      itemDate: date,
      parentDocId: key,
    })
    await markDone(row.id, 'pdf')
    return
  }

  await r2Put(cKey, text)
  await upsertSection({
    id: sectionId(row.corpus, key, '1'),
    corpus: row.corpus,
    sourceUrl: pdfUrl,
    r2Key: cKey,
    wordCount: countWords(text),
    status: 'compiled',
    format: 'pdf',
    sectionTitle: court ? `${court}: ${stem}` : stem,
    itemDate: date,
    parentDocId: key,
  })
  await markDone(row.id, 'pdf')
}

// ── ICO decisions & enforcement (V27 §4 — ico.org.uk, OGL v3.0) ───────────────
// Exempt org. docId = leaf path (e.g. "action-weve-taken/decision-notices/2026/
// 06/ic-406308-d2s8"). Prefer the linked decision/penalty PDF(s) → one section
// each; fall back to the page's <main> HTML text.

async function processIco(row: QueueRow): Promise<void> {
  const { fetchIcoPage, fetchIcoPdf } = await import('../sources/ico')
  const pageUrl = `https://ico.org.uk/${row.docId}/`

  const page = await fetchIcoPage(row.docId)
  if (!page) { await markFailed(row.id, `ico ${row.docId}: page fetch failed`); return }

  const metas: SectionMeta[] = []
  const texts: string[] = []
  let seq = 0
  const MAX_PDFS = 6
  for (const url of page.pdfUrls.slice(0, MAX_PDFS)) {
    const buf = await fetchIcoPdf(url)
    if (!buf) continue
    const text = await pdfToText(buf, url)
    if (!text || text.length < 100) continue
    const ref = String(++seq)
    metas.push({
      id: sectionId(row.corpus, row.docId, ref),
      corpus: row.corpus,
      sourceUrl: url,
      r2Key: compiledKey(row.corpus, row.docId, ref),
      wordCount: countWords(text),
      status: 'compiled',
      format: 'pdf',
      sectionTitle: page.title || row.docId,
      itemDate: page.itemDate,
      parentDocId: row.docId,
    })
    texts.push(text)
  }

  // No extractable PDF — use the page's main HTML text if it has substance.
  if (metas.length === 0 && page.mainText.length >= 200) {
    const ref = String(++seq)
    metas.push({
      id: sectionId(row.corpus, row.docId, ref),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      r2Key: compiledKey(row.corpus, row.docId, ref),
      wordCount: countWords(page.mainText),
      status: 'compiled',
      format: 'html',
      sectionTitle: page.title || row.docId,
      itemDate: page.itemDate,
      parentDocId: row.docId,
    })
    texts.push(page.mainText)
  }

  if (metas.length === 0) {
    await upsertSection({
      id: sectionId(row.corpus, row.docId, '1'),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: 'ICO page has no extractable PDF or main-content text',
      itemDate: page.itemDate,
      parentDocId: row.docId,
    })
    await markDone(row.id)
    return
  }

  for (let i = 0; i < metas.length; i += 8) {
    await Promise.all(metas.slice(i, i + 8).map((m, j) => r2Put(m.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await deleteStaleSections(row.corpus, row.docId, metas.map(m => m.id))
  await markDone(row.id, metas[0].format)
}

// ── Per-member division voting records (V28 §3 — Commons/Lords Votes, OPL) ────
// docId = "{house}:{divisionId}" (house = commons|lords). One section per
// division carrying the full roll-call (aye/no member lists with party +
// constituency) as searchable text. Divisions are immutable once recorded, so
// an existing R2 object short-circuits (idempotent reseed).

async function processDivisionVotes(row: QueueRow): Promise<void> {
  const { fetchDivisionDetail, compileDivisionText } = await import('../sources/division-votes')
  const colon = row.docId.indexOf(':')
  const house = row.docId.slice(0, colon)
  const id = Number(row.docId.slice(colon + 1))
  if ((house !== 'commons' && house !== 'lords') || !Number.isInteger(id)) {
    await markFailed(row.id, `bad division-votes docId: ${row.docId}`); return
  }

  const cKey = compiledKey(row.corpus, String(id), '1')
  if (await r2Exists(cKey)) { await markDone(row.id, 'html'); return }

  const detail = await fetchDivisionDetail(house, id)
  if (!detail) { await markFailed(row.id, `division-votes ${row.docId}: detail fetch failed`); return }
  if (detail.members.length === 0) {
    // A recorded division with no member list is a real gap — marker, never retry.
    await upsertSection({
      id: sectionId(row.corpus, String(id), '1'),
      corpus: row.corpus,
      sourceUrl: `https://votes.parliament.uk/Votes/${house === 'commons' ? 'Commons' : 'Lords'}/Division/${id}`,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: 'division has no recorded member votes',
      sectionTitle: detail.title || undefined,
      itemDate: detail.date ?? undefined,
      parentDocId: String(id),
    })
    await markDone(row.id)
    return
  }

  const text = compileDivisionText(detail)
  await r2Put(cKey, text)
  await upsertSection({
    id: sectionId(row.corpus, String(id), '1'),
    corpus: row.corpus,
    sourceUrl: `https://votes.parliament.uk/Votes/${house === 'commons' ? 'Commons' : 'Lords'}/Division/${id}`,
    r2Key: cKey,
    wordCount: countWords(text),
    status: 'compiled',
    format: 'html',
    sectionTitle: detail.title || `Division ${detail.number ?? id}`,
    itemDate: detail.date ?? undefined,
    parentDocId: String(id),
  })
  await markDone(row.id, 'html')
}

// ── Scottish Parliament Official Report (V28 §7 — parliament.scot HTML, SPCB) ──
// docId = "{meetingId}|{slug}". One section per speaker-turn (pwdata-shaped).
// The worker fetches the base report page + each agenda item's ?iob= page
// (the site renders agenda items lazily per-iob) and aggregates — all within the
// 5-min row budget for a single sitting day.

async function processScottishParliamentOr(row: QueueRow): Promise<void> {
  // V30 §4: pre-2016 reports from the Wayback archive. docId = "arch:{r}|{wbUrl}".
  if (row.docId.startsWith('arch:')) { await processScottishOrArchive(row); return }
  const { fetchReport, reportUrl } = await import('../sources/scottish-parliament-or')
  const bar = row.docId.indexOf('|')
  const meetingId = Number(bar >= 0 ? row.docId.slice(0, bar) : row.docId)
  const slug = bar >= 0 ? row.docId.slice(bar + 1) : ''
  if (!Number.isInteger(meetingId) || !slug) { await markFailed(row.id, `bad scottish-parliament-or docId: ${row.docId}`); return }
  const date = (/(\d{2})-(\d{2})-(\d{4})$/.exec(slug)) ? slug.replace(/.*?(\d{2})-(\d{2})-(\d{4})$/, '$3-$2-$1') : null

  const report = await fetchReport({ meetingId, slug, date, title: '' })
  if (!report) { await markFailed(row.id, `scottish-parliament-or ${meetingId}: report fetch failed`); return }

  if (report.items.length === 0) {
    await upsertSection({
      id: sectionId(row.corpus, String(meetingId), '1'),
      corpus: row.corpus,
      sourceUrl: reportUrl(slug, meetingId),
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: 'OR report page has no extractable contributions (future/empty sitting or non-text minute)',
      itemDate: report.date ?? undefined,
      parentDocId: String(meetingId),
    })
    await markDone(row.id)
    return
  }

  const metas: SectionMeta[] = []
  const texts: string[] = []
  for (const it of report.items) {
    const ref = String(it.seq)
    metas.push({
      id: sectionId(row.corpus, String(meetingId), ref),
      corpus: row.corpus,
      sourceUrl: reportUrl(slug, meetingId),
      r2Key: compiledKey(row.corpus, String(meetingId), ref),
      wordCount: countWords(it.text),
      status: 'compiled',
      format: 'html',
      sectionTitle: it.heading ? `Scottish Parliament: ${it.heading}` : 'Scottish Parliament Official Report',
      speaker: it.speaker ?? undefined,
      itemDate: report.date ?? undefined,
      parentDocId: String(meetingId),
    })
    texts.push(it.text)
  }

  const R2_BATCH = 16
  for (let i = 0; i < metas.length; i += R2_BATCH) {
    await Promise.all(metas.slice(i, i + R2_BATCH).map((m, j) => r2Put(m.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await deleteStaleSections(row.corpus, String(meetingId), metas.map(m => m.id))
  await markDone(row.id, 'html')
}

// ── Pre-2016 Scottish OR (V30 §4 — Wayback archive of the legacy report.aspx) ──
// docId = "arch:{r}|{waybackId_Url}". One section per speaker-turn; the parsed
// DC.date is the authoritative pre-2016 gate (defensive: anything ≥ 2016-05 is
// covered by the modern build → superseded marker).
async function processScottishOrArchive(row: QueueRow): Promise<void> {
  const { fetchBestLegacyReport } = await import('../sources/scottish-or-archive')
  // docId = "arch:{r}" (a bar-suffixed legacy form is tolerated).
  const bar = row.docId.indexOf('|')
  const r = Number(row.docId.slice('arch:'.length, bar >= 0 ? bar : undefined))
  if (!Number.isInteger(r)) { await markFailed(row.id, `bad scottish-or-archive docId: ${row.docId}`); return }
  const docId = `arch-${r}`
  const origUrl = `https://www.parliament.scot/parliamentarybusiness/report.aspx?r=${r}`

  const report = await fetchBestLegacyReport(r)
  if (!report) {
    // No usable capture across hosts (only interstitials / sparse archive) — a
    // classified residue, not a failure (keeps the failure breaker honest).
    await upsertSection({
      id: sectionId(row.corpus, docId, '1'), corpus: row.corpus, sourceUrl: origUrl,
      status: 'unavailable', availabilityStatus: 'archive-miss',
      availabilityNote: `legacy OR r=${r} has no usable Wayback capture (interstitial/sparse archive)`,
      parentDocId: docId,
    })
    await markDone(row.id); return
  }

  if (report.date && report.date >= '2016-05-01') {
    await upsertSection({
      id: sectionId(row.corpus, docId, '1'), corpus: row.corpus, sourceUrl: origUrl,
      status: 'unavailable', availabilityStatus: 'superseded',
      availabilityNote: `legacy OR r=${r} dated ${report.date} — session 5+, covered by the modern build`,
      itemDate: report.date, parentDocId: docId,
    })
    await markDone(row.id); return
  }
  if (report.items.length === 0) {
    await upsertSection({
      id: sectionId(row.corpus, docId, '1'), corpus: row.corpus, sourceUrl: origUrl,
      status: 'unavailable', availabilityStatus: 'no-provisions',
      availabilityNote: `legacy OR r=${r} has no extractable contributions`,
      itemDate: report.date ?? undefined, parentDocId: docId,
    })
    await markDone(row.id); return
  }

  const metas: SectionMeta[] = []
  const texts: string[] = []
  for (const it of report.items) {
    const ref = String(it.seq)
    metas.push({
      id: sectionId(row.corpus, docId, ref), corpus: row.corpus, sourceUrl: origUrl,
      r2Key: compiledKey(row.corpus, docId, ref), wordCount: countWords(it.text),
      status: 'compiled', format: 'html',
      sectionTitle: it.heading ? `Scottish Parliament: ${it.heading}` : 'Scottish Parliament Official Report',
      speaker: it.speaker ?? undefined, itemDate: report.date ?? undefined, parentDocId: docId,
    })
    texts.push(it.text)
  }
  const R2_BATCH = 16
  for (let i = 0; i < metas.length; i += R2_BATCH) {
    await Promise.all(metas.slice(i, i + R2_BATCH).map((m, j) => r2Put(m.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await deleteStaleSections(row.corpus, docId, metas.map(m => m.id))
  await markDone(row.id, 'html')
}

// ── NAO reports (V20 probe 7 — WP REST API route) ─────────────────────────────

async function processNao(row: QueueRow): Promise<void> {
  const { fetchNaoReportPdfUrls, fetchNaoFile } = await import('../sources/nao')
  const slug = row.docId
  const pageUrl = `https://www.nao.org.uk/reports/${slug}/`

  const pdfUrls = await fetchNaoReportPdfUrls(pageUrl)
  if (pdfUrls === null) { await markFailed(row.id, `nao ${slug}: page fetch failed`); return }

  const marker = async (note: string) => {
    await upsertSection({
      id: sectionId(row.corpus, slug, '1'),
      corpus: row.corpus,
      sourceUrl: pageUrl,
      status: 'unavailable',
      availabilityStatus: 'no-provisions',
      availabilityNote: note,
      parentDocId: slug,
    })
    await markDone(row.id)
  }

  if (pdfUrls.length === 0) return marker('NAO report page has no PDF links in main content')

  const metas: SectionMeta[] = []
  const texts: string[] = []
  let seq = 0
  for (const url of pdfUrls.slice(0, 10)) {
    const buf = await fetchNaoFile(url)
    if (!buf) continue
    const text = await pdfToText(buf, url)
    if (!text || text.length < 100) continue
    const ref = String(++seq)
    metas.push({
      id: sectionId(row.corpus, slug, ref),
      corpus: row.corpus,
      sourceUrl: url,
      r2Key: compiledKey(row.corpus, slug, ref),
      wordCount: countWords(text),
      status: 'compiled',
      format: 'pdf',
      sectionTitle: slug.replace(/-/g, ' '),
      parentDocId: slug,
    })
    texts.push(text)
  }

  if (metas.length === 0) return marker('NAO PDFs present but no extractable text')

  for (let i = 0; i < metas.length; i += 8) {
    await Promise.all(metas.slice(i, i + 8).map((m2, j) => r2Put(m2.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await deleteStaleSections(row.corpus, slug, metas.map(m2 => m2.id))
  await markDone(row.id, 'pdf')
}

// ── Law Commissions (Scottish + NI) ──────────────────────────────────────────
// Downloads PDFs and extracts text via pdf-parse.

async function processLawCommission(row: QueueRow): Promise<void> {
  const { listScotLawComReports, listNiLawComReports } = await import('../sources/law-commissions')
  const gen = row.sourceType === 'scotlawcom' ? listScotLawComReports() : listNiLawComReports()

  for await (const report of gen) {
    const cKey = compiledKey(row.corpus, report.id, '1')
    if (await r2Exists(cKey)) continue

    const res = await fetch(report.pdfUrl, { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0' } })
    if (!res.ok) continue

    const buffer = Buffer.from(await res.arrayBuffer())
    const text = await pdfToText(buffer, report.pdfUrl)
    if (!text) continue

    await r2Put(cKey, text)
    const secId = sectionId(row.corpus, report.id, '1')
    await upsertSection({ id: secId, corpus: row.corpus, sourceUrl: report.sourceUrl, r2Key: cKey, wordCount: countWords(text), status: 'compiled' })
  }
  await markDone(row.id)
}

// ── Parliamentary Committees — per-document fetch ─────────────────────────────
// docId = full publications.parliament.uk HTML URL (set by seed-committees-publications.ts).
// Workers only touch publications.parliament.uk — committees.parliament.uk is NOT called here.
// WHY: committees.parliament.uk is IP-blocked from Railway; publications.parliament.uk is not.

async function processCommitteeDocument(row: QueueRow): Promise<void> {
  const htmlUrl = row.docId

  // Derive R2 key from the URL path: strip host + .htm extension
  // e.g. https://publications.parliament.uk/pa/cm2023-24/cmselect/X/1/1.htm
  //   → committees-reports/pa/cm2023-24/cmselect/X/1/1/sections/1.compiled.txt
  const urlPath = htmlUrl
    .replace(/^https?:\/\/publications\.parliament\.uk\//, '')
    .replace(/[?#].*$/, '')
    .replace(/\.html?$/i, '')
  const cKey = compiledKey(row.corpus, urlPath, '1')

  if (await r2Exists(cKey)) {
    await markDone(row.id, 'html')
    return
  }

  const text = await fetchPublicationHtml(htmlUrl)

  if (!text || !text.trim()) {
    // No extractable text (PDF-only redirect, empty page) — not a failure
    await markDone(row.id)
    return
  }

  const compiled = rawToText(text)
  await r2Put(cKey, compiled)
  const secId = sectionId(row.corpus, urlPath, '1')
  await upsertSection({
    id: secId,
    corpus: row.corpus,
    sourceUrl: htmlUrl,
    r2Key: cKey,
    wordCount: countWords(compiled),
    status: 'compiled',
    format: 'html',
  })
  await markDone(row.id, 'html')
}

// ── Parliamentary Committees portal ──────────────────────────────────────────
// docId = 'page:{N}' for listing page rows.
// Scrapes committees.parliament.uk/publications/{type}/?page=N
// Prefers HTML content from publications.parliament.uk, falls back to title-only.

async function processCommittees(row: QueueRow): Promise<void> {
  const page = parseInt(row.docId.replace('page:', ''), 10)
  const portalType = row.corpus === 'committees-evidence'
    ? 'other-publications'
    : 'reports-responses'

  let publications
  try {
    publications = await listCommitteePublications(page, portalType)
  } catch (err) {
    await markFailed(row.id, String(err))
    return
  }

  if (publications.length === 0) {
    // Empty page — beyond total — mark done, not failed
    await markDone(row.id, 'html')
    return
  }

  for (const pub of publications) {
    const docId = `${pub.pubId}-${pub.docId}`
    const cKey = compiledKey(row.corpus, docId, '1')
    if (await r2Exists(cKey)) continue

    // Prefer HTML over PDF — HTML is searchable, PDF requires extraction
    let text: string | null = null
    if (pub.htmlUrl) {
      text = await fetchPublicationHtml(pub.htmlUrl)
    }

    // Fallback: compose metadata text from structured fields
    if (!text || !text.trim()) {
      const parts = [pub.title]
      if (pub.committeeNames.length > 0) parts.push(`Committee: ${pub.committeeNames.join(', ')}`)
      if (pub.publishedDate) parts.push(`Published: ${pub.publishedDate}`)
      if (pub.publicationType) parts.push(`Type: ${pub.publicationType}`)
      if (pub.paperNumber) parts.push(`Paper: ${pub.paperNumber}`)
      text = parts.join('\n')
    }

    const compiled = rawToText(text)
    await r2Put(cKey, compiled)

    const secId = sectionId(row.corpus, docId, '1')
    await upsertSection({
      id: secId,
      corpus: row.corpus,
      sourceUrl: pub.sourceUrl,
      r2Key: cKey,
      wordCount: countWords(compiled),
      status: 'compiled',
      format: 'html',
    })
  }

  await markDone(row.id, 'html')
}

// ── Erskine May (V29 §3.1 — erskinemay-api.parliament.uk, OPL v3.0) ────────────
// docId = "sec:{sectionId}". One section per Erskine May Section node.

async function processErskineMay(row: QueueRow): Promise<void> {
  const { fetchErskineSection } = await import('../sources/erskine-may')
  const m = /^sec:(\d+)$/.exec(row.docId)
  if (!m) { await markFailed(row.id, `bad erskine-may docId: ${row.docId}`); return }
  const id = Number(m[1])
  const pageUrl = `https://erskinemay.parliament.uk/section/${id}/`

  const cKey = compiledKey(row.corpus, String(id), '1')
  if (await r2Exists(cKey)) { await markDone(row.id, 'html'); return }

  const sec = await fetchErskineSection(id)
  if (!sec) {
    await upsertSection({
      id: sectionId(row.corpus, String(id), '1'), corpus: row.corpus, sourceUrl: pageUrl,
      status: 'unavailable', availabilityStatus: 'no-provisions',
      availabilityNote: 'Erskine May section has no extractable content', parentDocId: String(id),
    })
    await markDone(row.id); return
  }
  await r2Put(cKey, sec.text)
  await upsertSection({
    id: sectionId(row.corpus, String(id), '1'), corpus: row.corpus, sourceUrl: pageUrl,
    r2Key: cKey, wordCount: countWords(sec.text), status: 'compiled', format: 'html',
    sectionTitle: `Erskine May: ${sec.title}`, parentDocId: String(id),
  })
  await markDone(row.id, 'html')
}

// ── Early Day Motions (V29 §3.2 — Oral Questions & Motions API, OPL v3.0) ──────
// docId = "list:{skip}". One section per motion (keyed on motion Id).

async function processEarlyDayMotions(row: QueueRow): Promise<void> {
  const { fetchEdmPage, compileEdm } = await import('../sources/early-day-motions')
  const m = /^list:(\d+)$/.exec(row.docId)
  if (!m) { await markFailed(row.id, `bad early-day-motions docId: ${row.docId}`); return }
  const skip = Number(m[1])
  const TAKE = 100
  const motions = await fetchEdmPage(skip, TAKE)
  if (motions === null) { await markFailed(row.id, `early-day-motions list skip=${skip}: fetch failed`); return }
  if (motions.length === 0) { await markDone(row.id, 'html'); return }

  const metas: SectionMeta[] = []
  const texts: string[] = []
  for (const mo of motions) {
    const text = compileEdm(mo)
    if (!text.trim()) continue
    metas.push({
      id: sectionId(row.corpus, String(mo.id), '1'), corpus: row.corpus,
      sourceUrl: `https://edm.parliament.uk/early-day-motion/${mo.id}`,
      r2Key: compiledKey(row.corpus, String(mo.id), '1'),
      wordCount: countWords(text), status: 'compiled', format: 'html',
      sectionTitle: mo.title || `EDM ${mo.uin ?? mo.id}`,
      speaker: mo.primarySponsor ?? undefined, itemDate: mo.dateTabled ?? undefined,
      parentDocId: String(mo.id),
    })
    texts.push(text)
  }
  for (let i = 0; i < metas.length; i += 8) {
    await Promise.all(metas.slice(i, i + 8).map((mm, j) => r2Put(mm.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await markDone(row.id, 'html')
}

// ── CPS prosecution guidance (V29 §4 — cps.gov.uk own domain, OGL v3.0) ────────
// docId = the CPS path (e.g. "prosecution-guidance/abuse-process"). One section
// per guidance document from its <main> HTML.

async function processCpsGuidance(row: QueueRow): Promise<void> {
  const { fetchCpsPage } = await import('../sources/cps-guidance')
  const pageUrl = `https://www.cps.gov.uk/${row.docId}`

  const page = await fetchCpsPage(row.docId)
  if (!page) { await markFailed(row.id, `cps-guidance ${row.docId}: page fetch failed`); return }
  if (page.mainText.length < 200) {
    await upsertSection({
      id: sectionId(row.corpus, row.docId, '1'), corpus: row.corpus, sourceUrl: pageUrl,
      status: 'unavailable', availabilityStatus: 'no-provisions',
      availabilityNote: 'CPS page has no extractable main-content text', parentDocId: row.docId,
    })
    await markDone(row.id); return
  }

  const cKey = compiledKey(row.corpus, row.docId, '1')
  await r2Put(cKey, page.mainText)
  await upsertSection({
    id: sectionId(row.corpus, row.docId, '1'), corpus: row.corpus, sourceUrl: pageUrl,
    r2Key: cKey, wordCount: countWords(page.mainText), status: 'compiled', format: 'html',
    sectionTitle: page.title || row.docId, itemDate: page.itemDate, parentDocId: row.docId,
  })
  await markDone(row.id, 'html')
}

// ── Ofgem publications (V29 §6 — ofgem.gov.uk own domain, OGL v3.0) ────────────
// docId = "publications/{slug}". PDF-heavy: prefer linked PDF(s), fall back to
// the page's <main> text (ICO pattern).

async function processOfgem(row: QueueRow): Promise<void> {
  const { fetchOfgemPage, fetchOfgemPdf } = await import('../sources/ofgem')
  return processHtmlPlusPdfs(row, fetchOfgemPage, fetchOfgemPdf, `https://www.ofgem.gov.uk/${row.docId}`)
}

// ── Ofcom publications (V29 §6 — ofcom.org.uk own domain, ofcom-open) ──────────
// docId = the Ofcom path. HTML-led with optional document PDFs.

async function processOfcom(row: QueueRow): Promise<void> {
  const { fetchOfcomPage, fetchOfcomPdf } = await import('../sources/ofcom')
  return processHtmlPlusPdfs(row, fetchOfcomPage, fetchOfcomPdf, `https://www.ofcom.org.uk/${row.docId}`)
}

// Shared own-domain handler: fetch the page, extract up to 6 linked PDFs (one
// section each), else the page's <main> text. One marker if neither yields text.
async function processHtmlPlusPdfs(
  row: QueueRow,
  fetchPage: (path: string) => Promise<{ mainText: string; pdfUrls: string[]; title: string; itemDate?: string } | null>,
  fetchPdf: (url: string) => Promise<Buffer | null>,
  pageUrl: string,
): Promise<void> {
  const page = await fetchPage(row.docId)
  if (!page) { await markFailed(row.id, `${row.sourceType} ${row.docId}: page fetch failed`); return }

  const metas: SectionMeta[] = []
  const texts: string[] = []
  let seq = 0
  for (const url of page.pdfUrls.slice(0, 6)) {
    const buf = await fetchPdf(url)
    if (!buf) continue
    const text = await pdfToText(buf, url)
    if (!text || text.length < 100) continue
    const ref = String(++seq)
    metas.push({
      id: sectionId(row.corpus, row.docId, ref), corpus: row.corpus, sourceUrl: url,
      r2Key: compiledKey(row.corpus, row.docId, ref), wordCount: countWords(text),
      status: 'compiled', format: 'pdf', sectionTitle: page.title || row.docId,
      itemDate: page.itemDate, parentDocId: row.docId,
    })
    texts.push(text)
  }
  if (metas.length === 0 && page.mainText.length >= 200) {
    const ref = String(++seq)
    metas.push({
      id: sectionId(row.corpus, row.docId, ref), corpus: row.corpus, sourceUrl: pageUrl,
      r2Key: compiledKey(row.corpus, row.docId, ref), wordCount: countWords(page.mainText),
      status: 'compiled', format: 'html', sectionTitle: page.title || row.docId,
      itemDate: page.itemDate, parentDocId: row.docId,
    })
    texts.push(page.mainText)
  }
  if (metas.length === 0) {
    await upsertSection({
      id: sectionId(row.corpus, row.docId, '1'), corpus: row.corpus, sourceUrl: pageUrl,
      status: 'unavailable', availabilityStatus: 'no-provisions',
      availabilityNote: 'page has no extractable PDF or main-content text', parentDocId: row.docId,
    })
    await markDone(row.id); return
  }
  for (let i = 0; i < metas.length; i += 8) {
    await Promise.all(metas.slice(i, i + 8).map((m, j) => r2Put(m.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await deleteStaleSections(row.corpus, row.docId, metas.map(m => m.id))
  await markDone(row.id, metas[0].format)
}

// ── Library briefings + POSTnotes (V28 §5 / V29 §9 — capture-gated, OPL v3.0) ──
// docId = "{house}:{wpId}" (house = commons|lords|post). Turn-key once a
// cf_clearance + research-briefing CPT slug capture is wired (the rows are only
// ever seeded post-capture, so an unready fetch here means a stale capture).

async function processLibraryBriefings(row: QueueRow): Promise<void> {
  const { fetchBriefingById } = await import('../sources/library-briefings')
  const colon = row.docId.indexOf(':')
  const house = row.docId.slice(0, colon) as 'commons' | 'lords' | 'post'
  const id = row.docId.slice(colon + 1)
  if (!['commons', 'lords', 'post'].includes(house) || !id) { await markFailed(row.id, `bad library-briefings docId: ${row.docId}`); return }

  const brief = await fetchBriefingById(house, id)
  if (!brief) { await markFailed(row.id, `library-briefings ${row.docId}: fetch failed (capture stale / challenged?)`); return }

  const metas: SectionMeta[] = []
  const texts: string[] = []
  let seq = 0
  const body = brief.bodyHtml ? rawToText(brief.bodyHtml) : ''
  if (body.length > 50) {
    const ref = String(++seq)
    metas.push({
      id: sectionId(row.corpus, id, ref), corpus: row.corpus, sourceUrl: brief.url,
      r2Key: compiledKey(row.corpus, id, ref), wordCount: countWords(body), status: 'compiled', format: 'html',
      sectionTitle: brief.title || undefined, itemDate: brief.date ?? undefined, parentDocId: id,
    })
    texts.push(body)
  }
  for (const url of brief.pdfUrls.slice(0, 10)) {
    const buf = await (await import('../sources/govuk-content')).fetchPdfBuffer(url)
    if (!buf) continue
    const text = await pdfToText(buf, url)
    if (!text || text.length < 100) continue
    const ref = String(++seq)
    metas.push({
      id: sectionId(row.corpus, id, ref), corpus: row.corpus, sourceUrl: url,
      r2Key: compiledKey(row.corpus, id, ref), wordCount: countWords(text), status: 'compiled', format: 'pdf',
      sectionTitle: brief.title || undefined, itemDate: brief.date ?? undefined, parentDocId: id,
    })
    texts.push(text)
  }
  if (metas.length === 0) {
    await upsertSection({
      id: sectionId(row.corpus, id, '1'), corpus: row.corpus, sourceUrl: brief.url,
      status: 'unavailable', availabilityStatus: 'no-provisions',
      availabilityNote: 'briefing has no extractable body or PDF text', parentDocId: id,
    })
    await markDone(row.id); return
  }
  for (let i = 0; i < metas.length; i += 8) {
    await Promise.all(metas.slice(i, i + 8).map((m, j) => r2Put(m.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await deleteStaleSections(row.corpus, id, metas.map(m => m.id))
  await markDone(row.id, metas[0].format)
}

// ── LGSCO decisions (V29 §7 — lgo.org.uk, lgsco-open OGL-equivalent) ───────────
// Self-propagating paged walk. docId = "list:{category}:{page}" enumerates one
// listing page into per-decision content rows + the next list page (if full);
// docId = "decisions/{cat}/{subcat}/{ref}" extracts ONE decision → one section.

async function processLgsco(row: QueueRow): Promise<void> {
  const { fetchLgscoListPage, fetchLgscoDecision } = await import('../sources/lgsco')

  const lm = /^list:([a-z0-9-]+):(\d+)$/.exec(row.docId)
  if (lm) {
    const { bulkInsertQueueRows } = await import('../shared/queue-client')
    const category = lm[1]
    const page = Number(lm[2])
    const res = await fetchLgscoListPage(category, page)
    if (res === null) { await markFailed(row.id, `lgsco list ${category} p${page}: fetch failed`); return }
    const rows = res.paths.map(p => ({ id: `${row.corpus}:${p}`, corpus: row.corpus, docId: p, sourceType: 'lgsco', priority: 4 }))
    if (res.full) rows.push({ id: `${row.corpus}:list:${category}:${page + 1}`, corpus: row.corpus, docId: `list:${category}:${page + 1}`, sourceType: 'lgsco', priority: 4 })
    if (rows.length) await bulkInsertQueueRows(rows)
    await markDone(row.id)
    return
  }

  const pageUrl = `https://www.lgo.org.uk/${row.docId}`
  const dec = await fetchLgscoDecision(row.docId)
  if (!dec) { await markFailed(row.id, `lgsco ${row.docId}: fetch failed`); return }
  if (dec.mainText.length < 150) {
    await upsertSection({
      id: sectionId(row.corpus, row.docId, '1'), corpus: row.corpus, sourceUrl: pageUrl,
      status: 'unavailable', availabilityStatus: 'no-provisions',
      availabilityNote: 'LGSCO decision page has no extractable main-content text', parentDocId: row.docId,
    })
    await markDone(row.id); return
  }
  const cKey = compiledKey(row.corpus, row.docId, '1')
  await r2Put(cKey, dec.mainText)
  await upsertSection({
    id: sectionId(row.corpus, row.docId, '1'), corpus: row.corpus, sourceUrl: pageUrl,
    r2Key: cKey, wordCount: countWords(dec.mainText), status: 'compiled', format: 'html',
    sectionTitle: dec.title || row.docId, itemDate: dec.itemDate, parentDocId: row.docId,
  })
  await markDone(row.id, 'html')
}

// ── E-Petitions (V29 §3.3 — petition.parliament.uk, OPL v3.0) ─────────────────
// docId = "list:{kind}:{page}" (kind = open|archived). One section per petition.

async function processPetitions(row: QueueRow): Promise<void> {
  const { fetchPetitionPage } = await import('../sources/petitions')
  const m = /^list:(open|archived):(\d+)$/.exec(row.docId)
  if (!m) { await markFailed(row.id, `bad petitions docId: ${row.docId}`); return }
  const kind = m[1] as 'open' | 'archived'
  const page = Number(m[2])
  const items = await fetchPetitionPage(kind, page)
  if (items === null) { await markFailed(row.id, `petitions ${kind} page=${page}: fetch failed`); return }
  if (items.length === 0) { await markDone(row.id, 'html'); return }

  const metas: SectionMeta[] = []
  const texts: string[] = []
  for (const p of items) {
    if (!p.text.trim()) continue
    const base = kind === 'archived' ? `https://petition.parliament.uk/archived/petitions/${p.id}` : `https://petition.parliament.uk/petitions/${p.id}`
    metas.push({
      id: sectionId(row.corpus, String(p.id), '1'), corpus: row.corpus, sourceUrl: base,
      r2Key: compiledKey(row.corpus, String(p.id), '1'),
      wordCount: countWords(p.text), status: 'compiled', format: 'html',
      sectionTitle: p.action || `Petition ${p.id}`, itemDate: p.createdAt ?? undefined,
      notes: p.parliament ? `parliament ${p.parliament}` : undefined, parentDocId: String(p.id),
    })
    texts.push(p.text)
  }
  for (let i = 0; i < metas.length; i += 8) {
    await Promise.all(metas.slice(i, i + 8).map((mm, j) => r2Put(mm.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await markDone(row.id, 'html')
}

// ── Register of Members' Financial Interests (V29 §3.4 — interests-api, OPL) ───
// docId = "list:{skip}". One section per interest (keyed on interest id).

async function processMembersInterests(row: QueueRow): Promise<void> {
  const { fetchInterestsPage } = await import('../sources/members-interests')
  const m = /^list:(\d+)$/.exec(row.docId)
  if (!m) { await markFailed(row.id, `bad members-interests docId: ${row.docId}`); return }
  const skip = Number(m[1])
  const TAKE = 100
  const items = await fetchInterestsPage(skip, TAKE)
  if (items === null) { await markFailed(row.id, `members-interests list skip=${skip}: fetch failed`); return }
  if (items.length === 0) { await markDone(row.id, 'html'); return }

  const metas: SectionMeta[] = []
  const texts: string[] = []
  for (const it of items) {
    if (!it.text.trim()) continue
    metas.push({
      id: sectionId(row.corpus, String(it.id), '1'), corpus: row.corpus,
      sourceUrl: `https://interests-api.parliament.uk/api/v1/Interests/${it.id}`,
      r2Key: compiledKey(row.corpus, String(it.id), '1'),
      wordCount: countWords(it.text), status: 'compiled', format: 'html',
      sectionTitle: [it.member, it.category].filter(Boolean).join(' — ') || `Interest ${it.id}`,
      speaker: it.member ?? undefined, itemDate: it.registrationDate ?? undefined,
      parentDocId: String(it.id),
    })
    texts.push(it.text)
  }
  for (let i = 0; i < metas.length; i += 8) {
    await Promise.all(metas.slice(i, i + 8).map((mm, j) => r2Put(mm.r2Key!, texts[i + j])))
  }
  await bulkUpsertSections(metas)
  await markDone(row.id, 'html')
}
