/**
 * process-row.ts — per-row processing dispatcher + source processors (V17).
 *
 * Extracted verbatim from worker-queue.ts so the single-process pool worker
 * (ingest-pool.ts) reuses today's claim-cycle logic unchanged: the queue model,
 * R2 key scheme and per-source behaviour are identical to the fleet era.
 * Only the orchestration around processRow() changed in V17.
 */
import {
  markDone, markFailed, markSkipped,
  updateFormatsAvailable, insertSpecialistQueueRow, QueueRow,
} from '../shared/queue-client'
import { r2Exists, r2Put, caselawKey, caselawRawKey, bailiiKey, hansardKey, compiledKey, rawKey } from '../shared/r2-client'
import { rawToText, pdfToText } from '../shared/compile'
import { upsertSection as _upsertSection, bulkUpsertSections as _bulkUpsertSections, deleteStaleSections, deleteSupersededVersionSections, sectionId, countWords, SectionMeta } from '../shared/db-metadata'

// Track sections written this process lifetime — the pool worker reports this
// in its exit summary, and it is the ground truth for "sections, not statuses".
let _sectionsWritten = 0
export function getSectionsWritten(): number { return _sectionsWritten }

async function upsertSection(data: Parameters<typeof _upsertSection>[0]): Promise<void> {
  await _upsertSection(data)
  _sectionsWritten++
}

async function bulkUpsertSections(metas: SectionMeta[]): Promise<number> {
  const written = await _bulkUpsertSections(metas)
  _sectionsWritten += written
  return written
}

// Source clients
import { fetchJudgmentXml } from '../sources/tna-caselaw'
import { enumerateSections, discoverFormats, AVAILABILITY_NOTES } from '../sources/tna-legislation'
import { fetchCaseHtml, extractCaseText } from '../sources/bailii-scraper'
import { fetchReportContent, fetchWrittenAnswers, fetchWrittenStatements, fetchDebateText } from '../sources/parliament-api'
import { listDebatesForMonth } from '../sources/theyworkforyou'
import { getAllHandbookModules, listSectionsForModule } from '../sources/fca-handbook'
import { fetchCaseText as fetchEchrText, listUkCases, listUkCasesPage } from '../sources/echr-hudoc'
import { fetchDocumentText as fetchEurLexText, listRetainedEuInstruments, listRetainedEuPage } from '../sources/eurlex'
import { fetchLdaPage, MAX_524_RETRIES } from '../sources/lda-parliament'
import { listCommitteePublications, fetchPublicationHtml } from '../sources/committees-portal'
import { fetchPwdataFile, parsePwdataItems, PWDATA_CORPUS_CONFIG } from '../sources/twfy-pwdata'
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

  if (parts[0] === 'answers' || parts[0] === 'statements') {
    const [prefix, startDate, endDate] = parts
    if (!startDate || !endDate) { await markSkipped(row.id); return }

    const text = prefix === 'answers'
      ? await fetchWrittenAnswers(startDate, endDate)
      : await fetchWrittenStatements(startDate, endDate)

    if (!text) { await markDone(row.id, 'html'); return }

    const cKey = compiledKey(row.corpus, `${startDate}:${endDate}`, '1')
    if (await r2Exists(cKey)) { await markDone(row.id, 'html'); return }

    const compiled = rawToText(text)
    await r2Put(cKey, compiled)
    const secId = sectionId(row.corpus, `${startDate}:${endDate}`, '1')
    const sourceUrl = prefix === 'answers'
      ? `https://questions-statements-api.parliament.uk/api/writtenquestions/questions?answeredWhenFrom=${startDate}&answeredWhenTo=${endDate}`
      : `https://questions-statements-api.parliament.uk/api/writtenstatements/statements?madeWhenFrom=${startDate}&madeWhenTo=${endDate}`
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

// ── ECHR HUDOC ────────────────────────────────────────────────────────────────
// docId = 'page:{start}' for per-page rows (start is HUDOC offset), or '__index'.

async function processEchr(row: QueueRow): Promise<void> {
  const gen = row.docId.startsWith('page:')
    ? listUkCasesPage(parseInt(row.docId.replace('page:', ''), 10))
    : listUkCases()

  let written = 0
  for await (const c of gen) {
    const cKey = compiledKey('echr-hudoc', c.itemId, '1')
    if (await r2Exists(cKey)) { written++; continue }

    const text = await fetchEchrText(c.itemId, c.docName)
    if (!text) continue

    const compiled = rawToText(text)
    await r2Put(cKey, compiled)
    const secId = sectionId('echr-hudoc', c.itemId, '1')
    await upsertSection({ id: secId, corpus: 'echr-hudoc', sourceUrl: c.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled' })
    written++
  }
  // 0 cases means API failure — HUDOC /app/query/results returns 404 as of Jun 2026.
  // Mark failed so we don't silently hide the gap. Can retry once API is restored.
  if (written === 0) {
    await markFailed(row.id, 'ECHR: 0 cases returned — HUDOC query API returning 404 (endpoint changed Jun 2026)')
  } else {
    await markDone(row.id)
  }
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

async function processJudiciaryNi(row: QueueRow): Promise<void> {
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
