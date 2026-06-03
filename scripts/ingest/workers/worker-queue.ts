/**
 * worker-queue.ts — queue-driven ingest worker.
 *
 * Replaces fixed corpus assignments (worker-main.ts) with a dynamic claim loop:
 *   while (pending rows exist) { claim next row; process it; mark done/failed }
 *
 * All workers are interchangeable — any worker can handle any corpus.
 * Parallelism is automatic: Railway runs 10 workers, all compete for the same queue.
 *
 * Run per worker via WORKER_ID env var (1–10).
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import {
  claimNextChunk, markDone, markFailed, markSkipped,
  updateFormatsAvailable, disconnectQueue, getSleepDuration,
  countPendingRows, markSourceTypeComplete, bulkUpsertQueueRows, QueueRow,
} from '../shared/queue-client'
import { discoverForCorpus, DISCOVERY_CORPUS_ORDER } from '../shared/discovery'
import { r2Exists, r2Put, caselawKey, caselawRawKey, bailiiKey, hansardKey, compiledKey, rawKey } from '../shared/r2-client'
import { rawToText, pdfToText } from '../shared/compile'
import { upsertSection, sectionId, countWords, disconnectDb } from '../shared/db-metadata'
import { readCheckpoint, writeCheckpoint } from '../shared/checkpoint'

// Source clients
import { listJudgments, fetchJudgmentXml } from '../sources/tna-caselaw'
import { enumerateSections, discoverFormats } from '../sources/tna-legislation'
import { fetchCaseHtml, extractCaseText } from '../sources/bailii-scraper'
import { fetchDebateText, fetchReportContent, fetchWrittenAnswers, fetchWrittenStatements } from '../sources/parliament-api'
import { listDebatesForMonth } from '../sources/theyworkforyou'
import { fetchSectionText as fetchFcaText, listFcaSections, listFcaSectionsForSourcebook } from '../sources/fca-handbook'
import { fetchCaseText as fetchEchrText, listUkCases, listUkCasesPage } from '../sources/echr-hudoc'
import { fetchDocumentText as fetchEurLexText, listRetainedEuInstruments, listRetainedEuPage } from '../sources/eurlex'
import { fetchDocText as fetchOecdText, listOecdOpenDocs } from '../sources/oecd-free'
import { fetchTreatyText, listUkTreaties } from '../sources/uk-treaties'
import {
  listHmrcManuals, listNaoReports, listHoCLReports,
  listExplanatoryNotes, listImpactAssessments, listConsultations,
  listHmrcTiins, listOtsReports,
  fetchDocumentText as fetchGovText,
} from '../sources/gov-scraper'

const CHECKPOINT_EVERY = 50  // write worker progress checkpoint every N items

async function main(): Promise<void> {
  const workerIdRaw = parseInt(process.env.WORKER_ID ?? '1', 10)
  // Accept any positive WORKER_ID — supports workers 11–20 and beyond
  const workerId = (isNaN(workerIdRaw) || workerIdRaw < 1) ? 1 : workerIdRaw

  console.log(`[worker-${workerId}] starting queue-driven mode`)
  const cp = await readCheckpoint(workerId)
  let sinceCheckpoint = 0

  while (true) {
    const row = await claimNextChunk(workerId)

    if (!row) {
      // Distinguish: queue empty vs all sources rate-limited.
      const pending = await countPendingRows().catch(() => -1)

      if (pending === 0) {
        // Queue genuinely empty — attempt self-discovery before sleeping.
        let discoveredAny = false
        for (const corpus of DISCOVERY_CORPUS_ORDER) {
          try {
            const newRows = await discoverForCorpus(corpus)
            if (newRows.length > 0) {
              await bulkUpsertQueueRows(newRows)
              console.log(`[worker-${workerId}] self-discovered ${newRows.length} new rows for ${corpus}`)
              discoveredAny = true
              break  // claim loop will pick them up immediately
            } else {
              // Corpus exhausted — mark its sourceType complete so we skip it next time.
              // Derive sourceType from the first row we would have returned (or from corpus name).
              const sourceTypeMap: Record<string, string> = {
                'written-answers': 'hansard', 'written-statements': 'hansard',
                'hansard-commons-a': 'hansard', 'hansard-commons-b': 'hansard',
                'hansard-lords-a': 'hansard', 'hansard-lords-b': 'hansard',
                'committees-a': 'hansard',
                'tna-caselaw': 'tna-caselaw',
                'echr-hudoc': 'echr', 'eur-lex': 'eurlex',
                'fca-regulators': 'fca',
                'hmrc-codes-guidance': 'hmrc', 'hmrc-tiins': 'gov-uk', 'ots-reports': 'gov-uk',
                'scotlawcom': 'scotlawcom', 'nilawcom': 'nilawcom',
                'oecd': 'oecd', 'uk-treaties': 'treaties',
              }
              const sourceType = sourceTypeMap[corpus]
              if (sourceType) await markSourceTypeComplete(sourceType).catch(() => {})
            }
          } catch (err) {
            console.warn(`[worker-${workerId}] discovery error for ${corpus}:`, err)
          }
        }

        if (!discoveredAny) {
          console.log(`[worker-${workerId}] all sources exhausted — sleeping 5min`)
          await new Promise(r => setTimeout(r, 300_000))
        }
      } else {
        // Pending rows exist but all sources are rate-limited — sleep until next token.
        const sleepMs = await getSleepDuration().catch(() => 60_000)
        console.log(`[worker-${workerId}] rate-limited — sleeping ${sleepMs}ms`)
        await new Promise(r => setTimeout(r, sleepMs))
      }
      continue
    }

    console.log(`[worker-${workerId}] claimed ${row.id} (${row.sourceType} p${row.priority})`)

    try {
      await processRow(row, workerId)
      cp.completed++
    } catch (err: unknown) {
      console.error(`[worker-${workerId}] error processing ${row.id}:`, err)
      await markFailed(row.id, String(err))
      cp.failed++
    }

    sinceCheckpoint++
    if (sinceCheckpoint % CHECKPOINT_EVERY === 0) {
      await writeCheckpoint(cp)
      console.log(`[worker-${workerId}] progress: ${cp.completed} done, ${cp.failed} failed`)
    }
  }
}

// ── Row dispatcher ────────────────────────────────────────────────────────────

async function processRow(row: QueueRow, workerId: number): Promise<void> {
  switch (row.sourceType) {
    case 'tna-legislation': return processTnaLegislation(row)
    case 'tna-caselaw':     return processTnaCaselaw(row)
    case 'bailii':          return processBailii(row)
    case 'hansard':         return processHansard(row)
    case 'fca':             return processFca(row)
    case 'echr':            return processEchr(row)
    case 'eurlex':          return processEurLex(row)
    case 'hmrc':            return processHmrc(row)
    case 'treaties':        return processTreaties(row)
    case 'oecd':            return processOecd(row)
    case 'gov-uk':          return processGovUk(row)
    case 'scotlawcom':      return processLawCommission(row)
    case 'nilawcom':        return processLawCommission(row)
    default:
      await markSkipped(row.id)
      console.warn(`[worker] unknown sourceType ${row.sourceType} — skipped`)
  }
}

// ── TNA Legislation ───────────────────────────────────────────────────────────

async function processTnaLegislation(row: QueueRow): Promise<void> {
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
      await upsertSection({ id: secId, corpus: row.corpus, sourceUrl: `https://www.legislation.gov.uk/${actId}`, status: 'unavailable', errorMsg: section.errorMsg, format: 'unavailable' })
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
      await upsertSection({ id: secId, corpus: row.corpus, sourceUrl, r2Key: cKey, r2RawKey: rKey, wordCount: countWords(compiled), status: 'compiled', format: section.format, compiledText: compiled.slice(0, 10_000) })
    } else if (section.format === 'html') {
      const compiled = rawToText(section.rawHtml!)
      await r2Put(cKey, compiled)
      await upsertSection({ id: secId, corpus: row.corpus, sourceUrl, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled', format: 'html', compiledText: compiled.slice(0, 10_000) })
    } else if (section.format === 'pdf') {
      const rKey = rawKey(row.corpus, actId, section.sectionRef, 'pdf')
      await r2Put(rKey, section.pdfBuffer!, 'application/pdf')
      const extracted = await pdfToText(section.pdfBuffer!, sourceUrl)
      if (extracted) {
        await r2Put(cKey, extracted)
        await upsertSection({ id: secId, corpus: row.corpus, sourceUrl, r2Key: cKey, r2RawKey: rKey, wordCount: countWords(extracted), status: 'compiled', format: 'pdf', compiledText: extracted.slice(0, 10_000) })
      } else {
        await r2Put(cKey, '[PDF - scanned/unreadable — OCR pass needed]')
        await upsertSection({ id: secId, corpus: row.corpus, sourceUrl, r2Key: cKey, r2RawKey: rKey, wordCount: 0, status: 'compiled', format: 'pdf', notes: 'pdf-ocr-needed' })
      }
    }
  }

  await markDone(row.id, sections[0]?.format)
}

// ── TNA Case Law ──────────────────────────────────────────────────────────────
// Queue rows for caselaw have docId = "page:N" — we fetch that Atom feed page
// and process all 50 entries in one row claim.

async function processTnaCaselaw(row: QueueRow): Promise<void> {
  const ATOM_BASE = 'https://caselaw.nationalarchives.gov.uk/atom.xml'

  if (!row.docId.startsWith('page:')) {
    await markSkipped(row.id)
    return
  }

  const page = parseInt(row.docId.replace('page:', ''), 10)
  const res = await fetch(`${ATOM_BASE}?page=${page}`, {
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
      await upsertSection({ id: secId, corpus: 'tna-caselaw', sourceUrl: xmlUrl, r2Key: cKey, r2RawKey: rKey, wordCount: countWords(compiled), status: 'compiled', compiledText: compiled.slice(0, 10_000) })
      processed++
    } catch (err: unknown) {
      console.warn(`[worker] caselaw ${docId}: ${err}`)
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
  await upsertSection({ id: secId, corpus: row.corpus, sourceUrl: caseUrl, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled', compiledText: compiled.slice(0, 10_000) })
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
      await upsertSection({ id: secId, corpus: row.corpus, sourceUrl: report.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled', compiledText: compiled.slice(0, 10_000) })
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
    await upsertSection({ id: secId, corpus: row.corpus, sourceUrl, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled', compiledText: compiled.slice(0, 10_000) })
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
      await upsertSection({ id: secId, corpus: row.corpus, sourceUrl: debate.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled', compiledText: compiled.slice(0, 10_000) })
      written++
    }
    // 0 is OK — parliament may not have sat any day this month
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
    await upsertSection({ id: secId, corpus: row.corpus, sourceUrl: debate.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled', compiledText: compiled.slice(0, 10_000) })
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
// docId = 'sourcebook:{CODE}' for per-sourcebook rows, or '__index' for full corpus.

async function processFca(row: QueueRow): Promise<void> {
  const gen = row.docId.startsWith('sourcebook:')
    ? listFcaSectionsForSourcebook(row.docId.replace('sourcebook:', ''))
    : listFcaSections()

  let written = 0
  for await (const section of gen) {
    const cKey = compiledKey('fca-regulators', section.id, '1')
    if (await r2Exists(cKey)) { written++; continue }

    const text = await fetchFcaText(section.url)
    if (!text) continue

    const compiled = rawToText(text)
    await r2Put(cKey, compiled)
    const secId = sectionId('fca-regulators', section.id, '1')
    await upsertSection({ id: secId, corpus: 'fca-regulators', sourceUrl: section.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled', compiledText: compiled.slice(0, 10_000) })
    written++
  }
  // 0 sections means scraping failed — handbook.fca.org.uk is a JS SPA, static HTML
  // has no section links. Mark failed so we don't silently hide the gap.
  if (written === 0) {
    await markFailed(row.id, 'FCA: 0 sections found — handbook is JS-rendered, HTML scraping ineffective')
  } else {
    await markDone(row.id)
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
    await upsertSection({ id: secId, corpus: 'echr-hudoc', sourceUrl: c.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled', compiledText: compiled.slice(0, 10_000) })
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
    await upsertSection({ id: secId, corpus: 'eur-lex', sourceUrl: doc.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled', compiledText: compiled.slice(0, 10_000) })
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
      await upsertSection({ id: secId, corpus: 'hmrc-codes-guidance', sourceUrl: doc.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled', compiledText: compiled.slice(0, 10_000) })
    }
  }
  await markDone(row.id)
}

// ── UK Treaties ───────────────────────────────────────────────────────────────

async function processTreaties(row: QueueRow): Promise<void> {
  for await (const t of listUkTreaties()) {
    const cKey = compiledKey('uk-treaties', t.id, '1')
    if (await r2Exists(cKey)) continue

    const text = await fetchTreatyText(t.url)
    if (!text) continue

    const compiled = rawToText(text)
    await r2Put(cKey, compiled)
    const secId = sectionId('uk-treaties', t.id, '1')
    await upsertSection({ id: secId, corpus: 'uk-treaties', sourceUrl: t.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled', compiledText: compiled.slice(0, 10_000) })
  }
  await markDone(row.id)
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
    await upsertSection({ id: secId, corpus: 'oecd', sourceUrl: doc.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled', compiledText: compiled.slice(0, 10_000) })
  }
  await markDone(row.id)
}

// ── GOV.UK general sources (TIINs, OTS) ──────────────────────────────────────
// sourceType = 'gov-uk', corpus drives which listing function to use.

async function processGovUk(row: QueueRow): Promise<void> {
  const gen = row.corpus === 'ots-reports' ? listOtsReports() : listHmrcTiins()

  for await (const doc of gen) {
    const cKey = compiledKey(row.corpus, doc.id, '1')
    if (await r2Exists(cKey)) continue

    const text = await fetchGovText(doc.url)
    if (!text) continue

    const compiled = rawToText(text.slice(0, 50_000))
    await r2Put(cKey, compiled)
    const secId = sectionId(row.corpus, doc.id, '1')
    await upsertSection({ id: secId, corpus: row.corpus, sourceUrl: doc.url, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled', compiledText: compiled.slice(0, 10_000) })
  }
  await markDone(row.id)
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
    await upsertSection({ id: secId, corpus: row.corpus, sourceUrl: report.sourceUrl, r2Key: cKey, wordCount: countWords(text), status: 'compiled', compiledText: text.slice(0, 10_000) })
  }
  await markDone(row.id)
}

// ── Entry ─────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('[worker-queue] fatal:', err)
  process.exit(1)
})
