import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import {
  readCheckpoint, writeCheckpoint,
  recordSuccess, recordError, recordSkip,
  WorkerCheckpoint,
} from '../shared/checkpoint'
import { r2Exists, r2Put, compiledKey, rawKey, caselawKey, caselawRawKey, bailiiKey, hansardKey } from '../shared/r2-client'
import { rawToText } from '../shared/compile'
import { upsertSection, sectionId, countWords, disconnectDb } from '../shared/db-metadata'
import {
  listActIds, enumerateSections,
  WORKER_CORPORA,
} from '../sources/tna-legislation'
import {
  listJudgments, fetchJudgmentXml, getTotalJudgments,
} from '../sources/tna-caselaw'
import {
  listCases, fetchCaseHtml, extractCaseText, WORKER_DB_SUBSETS,
} from '../sources/bailii-scraper'
import {
  listHansardDebates, fetchDebateText, countHansardDebates, HANSARD_PARTITIONS,
  listCommitteeReports, fetchReportContent,
} from '../sources/parliament-api'
import { listFcaSections, fetchSectionText as fetchFcaText, FcaSection } from '../sources/fca-handbook'
import {
  listHmrcManuals, listNaoReports, listHoCLReports,
  listExplanatoryNotes, listImpactAssessments, listConsultations,
  fetchDocumentText,
} from '../sources/gov-scraper'
import { listUkCases, fetchCaseText as fetchEchrText, countUkCases } from '../sources/echr-hudoc'
import { listRetainedEuInstruments, fetchDocumentText as fetchEurLexText, EurLexDoc } from '../sources/eurlex'
import { listOecdOpenDocs, fetchDocText as fetchOecdText, OecdDoc } from '../sources/oecd-free'
import { listUkTreaties, fetchTreatyText, UkTreaty } from '../sources/uk-treaties'
import { getPhase1Corpus, getPhase2Corpora, CORPUS_LABELS } from './phase-router'

const CHECKPOINT_INTERVAL = 100  // write to R2 every N sections

async function main(): Promise<void> {
  const workerIdRaw = parseInt(process.env.WORKER_ID ?? '1', 10)
  const workerId = (isNaN(workerIdRaw) || workerIdRaw < 1 || workerIdRaw > 10) ? 1 : workerIdRaw
  if (workerId !== workerIdRaw) {
    console.warn(`[worker] WORKER_ID="${process.env.WORKER_ID}" invalid or not yet set — defaulting to 1`)
  }

  console.log(`[worker-${workerId}] starting — loading checkpoint from R2`)
  const cp = await readCheckpoint(workerId)

  if (!cp.phase1Complete) {
    await runPhase1(workerId, cp)
  }

  const phase2 = getPhase2Corpora(workerId)
  for (const corpus of phase2) {
    if (cp.phase1Complete && cp.corpus === corpus) {
      console.log(`[worker-${workerId}] phase 2 corpus ${corpus} already complete — skipping`)
      continue
    }
    await runPhase2Corpus(workerId, corpus, cp)
  }

  console.log(`[worker-${workerId}] all corpora complete. ` +
    `completed=${cp.completed} failed=${cp.failed} skipped=${cp.skipped}`)
  await disconnectDb()

  // Keep container alive — Railway restarts if the process exits.
  // Sleep 24h then exit cleanly, triggering a restart which will find
  // phase1Complete=true and exit again after the next 24h sleep.
  console.log(`[worker-${workerId}] sleeping 24h to keep container alive`)
  await new Promise(r => setTimeout(r, 24 * 60 * 60 * 1000))
}

// ── Phase 1 — TNA Legislation ─────────────────────────────────────────────────

async function runPhase1(workerId: number, cp: WorkerCheckpoint): Promise<void> {
  const config = WORKER_CORPORA[workerId]
  if (!config) {
    // Workers 8–10 have non-TNA phase 1 — delegate to their specific handlers
    await runNonTnaPhase1(workerId, cp)
    return
  }

  const phase1Corpus = getPhase1Corpus(workerId)
  cp.corpus = phase1Corpus
  console.log(`[worker-${workerId}] Phase 1: ${CORPUS_LABELS[phase1Corpus]}`)

  let sinceCheckpoint = 0

  // Enumerate all types first so we can log total before processing begins
  const allActsByType: Array<{ type: string; actIds: string[] }> = []
  let totalActsEnumerated = 0

  for (const type of config.types) {
    console.log(`[worker-${workerId}] enumerating ${type} acts (${config.yearMin}–${config.yearMax})…`)
    const actIds = await listActIds(type, config.yearMin, config.yearMax)
    totalActsEnumerated += actIds.length
    cp.totalInCorpus = Math.max(cp.totalInCorpus, actIds.length * 50) // rough estimate
    console.log(`[worker-${workerId}] ${type}: ${actIds.length} acts enumerated`)
    if (actIds.length > 0) console.log(`[worker-${workerId}] first act: ${actIds[0]}  last act: ${actIds[actIds.length - 1]}`)
    allActsByType.push({ type, actIds })
  }

  console.log(`[worker-${workerId}] total acts enumerated: ${totalActsEnumerated}`)

  if (totalActsEnumerated === 0) {
    console.error(`[worker-${workerId}] Phase 1: 0 acts enumerated — TNA feed returned no results. NOT marking phase1Complete to allow retry on next restart.`)
    await writeCheckpoint(cp)
    return
  }

  for (const { type, actIds } of allActsByType) {
    console.log(`[worker-${workerId}] processing ${type}: ${actIds.length} acts (resuming from lastProcessedId="${cp.lastProcessedId}")`)
    for (const actId of actIds) {
      if (cp.lastProcessedId !== '' && actId <= cp.lastProcessedId) continue // resume

      console.log(`[worker-${workerId}] processing act: ${actId}`)
      const sections = await enumerateSections(actId)
      console.log(`[worker-${workerId}] ${actId}: ${sections.length} section(s) [${sections.map(s => s.format).join(',')}]`)

      for (const section of sections) {
        const secId = sectionId(phase1Corpus, actId, section.sectionRef)
        const actBaseUrl = `https://www.legislation.gov.uk/${actId}`

        // Effects feed: stored at its own R2 key, not the standard compiled-key path
        if (section.format === 'effects') {
          const effectsKey = `effects/${actId}/effects.xml`
          if (await r2Exists(effectsKey)) { recordSkip(cp); continue }
          try {
            await r2Put(effectsKey, section.xml!, 'application/xml')
            await upsertSection({
              id: secId, corpus: phase1Corpus,
              sourceUrl: `${actBaseUrl}/effects/data.feed`,
              r2Key: effectsKey, r2RawKey: effectsKey,
              wordCount: 0, status: 'compiled', format: 'effects',
            })
            recordSuccess(cp, actId)
          } catch (err: unknown) {
            recordError(cp, secId, String(err))
          }
          sinceCheckpoint++
          if (sinceCheckpoint % CHECKPOINT_INTERVAL === 0) {
            await writeCheckpoint(cp)
            console.log(`[worker-${workerId}] checkpoint: ${cp.completed} done, ${cp.failed} failed`)
          }
          continue
        }

        const cKey = compiledKey(phase1Corpus, actId, section.sectionRef)

        // Unavailable: upsert DB row and advance checkpoint — no R2 writes
        if (section.format === 'unavailable') {
          await upsertSection({
            id: secId, corpus: phase1Corpus, sourceUrl: actBaseUrl,
            status: 'unavailable', errorMsg: section.errorMsg, format: 'unavailable',
          })
          recordSuccess(cp, actId)
          sinceCheckpoint++
          if (sinceCheckpoint % CHECKPOINT_INTERVAL === 0) {
            await writeCheckpoint(cp)
            console.log(`[worker-${workerId}] checkpoint: ${cp.completed} done, ${cp.failed} failed`)
          }
          continue
        }

        if (await r2Exists(cKey)) {
          recordSkip(cp)
          continue
        }

        const sourceUrl = section.format === 'clml'
          ? `${actBaseUrl}/${section.sectionRef}`
          : actBaseUrl

        try {
          if (section.format === 'clml' || section.format === 'clml-unparsed') {
            const rKey = rawKey(phase1Corpus, actId, section.sectionRef, 'xml')
            await r2Put(rKey, section.xml!, 'application/xml')
            const compiled = rawToText(section.xml!)
            await r2Put(cKey, compiled)
            await upsertSection({
              id: secId, corpus: phase1Corpus, sourceUrl,
              r2Key: cKey, r2RawKey: rKey, wordCount: countWords(compiled),
              status: 'compiled', format: section.format, xmlPreview: section.xmlPreview,
              ...(section.isEnactedOnly ? { notes: 'enacted-only' } : {}),
            })
          } else if (section.format === 'html') {
            const compiled = rawToText(section.rawHtml!)
            await r2Put(cKey, compiled)
            await upsertSection({
              id: secId, corpus: phase1Corpus, sourceUrl,
              r2Key: cKey, wordCount: countWords(compiled),
              status: 'compiled', format: 'html',
            })
          } else if (section.format === 'pdf') {
            const rKey = rawKey(phase1Corpus, actId, section.sectionRef, 'pdf')
            await r2Put(rKey, section.pdfBuffer!, 'application/pdf')
            const placeholder = '[PDF - pending text extraction]'
            await r2Put(cKey, placeholder)
            await upsertSection({
              id: secId, corpus: phase1Corpus, sourceUrl,
              r2Key: cKey, r2RawKey: rKey, wordCount: 0,
              status: 'compiled', format: 'pdf',
            })
          }
          recordSuccess(cp, actId)
        } catch (err: unknown) {
          recordError(cp, secId, String(err))
          await upsertSection({ id: secId, corpus: phase1Corpus, sourceUrl, status: 'failed', errorMsg: String(err) })
        }

        sinceCheckpoint++
        if (sinceCheckpoint % CHECKPOINT_INTERVAL === 0) {
          await writeCheckpoint(cp)
          console.log(`[worker-${workerId}] checkpoint: ${cp.completed} done, ${cp.failed} failed`)
        }
      }
    }
  }

  cp.phase1Complete = true
  await writeCheckpoint(cp)
  console.log(`[worker-${workerId}] Phase 1 complete — ${cp.completed} compiled, ${cp.failed} failed, ${cp.skipped} skipped`)
}

// ── Non-TNA Phase 1 (workers 7–10) ────────────────────────────────────────────

async function runNonTnaPhase1(workerId: number, cp: WorkerCheckpoint): Promise<void> {
  const corpus = getPhase1Corpus(workerId)
  cp.corpus = corpus
  let sinceCheckpoint = 0

  console.log(`[worker-${workerId}] Phase 1 (non-TNA): ${CORPUS_LABELS[corpus]}`)

  async function processItem(
    id: string,
    fetcher: () => Promise<string | null>,
    sourceUrl: string,
    corpusName: string,
    ext = 'txt',
  ): Promise<void> {
    const secId = sectionId(corpusName, id, '1')
    const cKey = compiledKey(corpusName, id, '1')
    if (await r2Exists(cKey)) { recordSkip(cp); return }

    const raw = await fetcher()
    if (!raw) { recordError(cp, secId, 'fetch failed'); return }

    const rKey = rawKey(corpusName, id, '1', ext)
    await r2Put(rKey, raw)

    try {
      const compiled = rawToText(raw.slice(0, 50_000))
      await r2Put(cKey, compiled)
      await upsertSection({
        id: secId, corpus: corpusName, sourceUrl,
        r2Key: cKey, r2RawKey: rKey,
        wordCount: countWords(compiled), status: 'compiled',
      })
      recordSuccess(cp, id)
    } catch (err: unknown) {
      recordError(cp, secId, String(err))
    }

    sinceCheckpoint++
    if (sinceCheckpoint % CHECKPOINT_INTERVAL === 0) await writeCheckpoint(cp)
  }

  if (workerId === 7) {
    // Enumerate all sections first so we can log count before processing begins
    console.log(`[worker-7] fca-handbook: enumerating sections…`)
    const allFcaSections: FcaSection[] = []
    for await (const section of listFcaSections()) {
      allFcaSections.push(section)
    }
    console.log(`[worker-7] fca-handbook: ${allFcaSections.length} items enumerated before processing`)
    cp.totalInCorpus = Math.max(cp.totalInCorpus, allFcaSections.length)

    for (const section of allFcaSections) {
      const text = await fetchFcaText(section.sourceUrl)
      await processItem(section.sectionId, () => Promise.resolve(text), section.sourceUrl, corpus)
    }
  } else if (workerId === 8) {
    for await (const doc of listHmrcManuals()) {
      await processItem(doc.id, () => fetchDocumentText(doc.url), doc.url, corpus, 'html')
    }
    for await (const doc of listNaoReports()) {
      await processItem(doc.id, () => fetchDocumentText(doc.url), doc.url, corpus, 'html')
    }
    for await (const doc of listHoCLReports()) {
      await processItem(doc.id, () => fetchDocumentText(doc.url), doc.url, corpus, 'html')
    }
    for await (const doc of listExplanatoryNotes()) {
      await processItem(doc.id, () => fetchDocumentText(doc.url), doc.url, corpus, 'html')
    }
    for await (const doc of listImpactAssessments()) {
      await processItem(doc.id, () => fetchDocumentText(doc.url), doc.url, corpus, 'html')
    }
    for await (const doc of listConsultations()) {
      await processItem(doc.id, () => fetchDocumentText(doc.url), doc.url, corpus, 'html')
    }
  } else if (workerId === 9) {
    // Enumerate total from search API before processing begins
    const totalJudgments = await getTotalJudgments()
    console.log(`[worker-9] tna-caselaw: ${totalJudgments} items enumerated before processing`)
    cp.totalInCorpus = Math.max(cp.totalInCorpus, totalJudgments)

    for await (const j of listJudgments()) {
      // Use neutral citation as the stable document ID; fall back to URI path
      const docId = j.neutralCitation
        ? j.neutralCitation
        : j.uri.replace(/^\//, '').replace(/\//g, '-')

      const cKey = caselawKey(docId)
      if (await r2Exists(cKey)) { recordSkip(cp); continue }

      const secId = sectionId('tna-caselaw', docId, '1')
      try {
        const xml = await fetchJudgmentXml(j.xmlUrl)
        if (!xml) { recordError(cp, secId, 'fetch failed'); continue }

        const rKey = caselawRawKey(docId)
        await r2Put(rKey, xml, 'application/xml')
        const compiled = rawToText(xml)   // full judgment — no truncation
        await r2Put(cKey, compiled)
        await upsertSection({
          id: secId, corpus: 'tna-caselaw', sourceUrl: j.xmlUrl,
          r2Key: cKey, r2RawKey: rKey, wordCount: countWords(compiled), status: 'compiled',
        })
        recordSuccess(cp, docId)
      } catch (err: unknown) {
        recordError(cp, secId, String(err))
        await upsertSection({ id: secId, corpus: 'tna-caselaw', sourceUrl: j.xmlUrl, status: 'failed', errorMsg: String(err) })
      }

      sinceCheckpoint++
      if (sinceCheckpoint % CHECKPOINT_INTERVAL === 0) {
        await writeCheckpoint(cp)
        console.log(`[worker-9] checkpoint: ${cp.completed} done, ${cp.failed} failed`)
      }
    }
  } else if (workerId === 10) {
    // ECHR HUDOC — get total from API before iterating
    const echrTotal = await countUkCases()
    console.log(`[worker-10] echr-hudoc: ${echrTotal} items enumerated before processing`)
    cp.totalInCorpus = Math.max(cp.totalInCorpus, echrTotal)
    for await (const c of listUkCases()) {
      await processItem(c.itemId, () => fetchEchrText(c.itemId, c.docName), c.url, 'echr-hudoc')
    }

    // EUR-Lex — collect to array (SPARQL returns bounded set)
    console.log(`[worker-10] eur-lex: enumerating retained EU instruments…`)
    const eurLexItems: EurLexDoc[] = []
    for await (const doc of listRetainedEuInstruments()) eurLexItems.push(doc)
    console.log(`[worker-10] eur-lex: ${eurLexItems.length} items enumerated before processing`)
    cp.totalInCorpus += eurLexItems.length
    for (const doc of eurLexItems) {
      await processItem(doc.celexId, () => fetchEurLexText(doc.celexId), doc.url, 'eur-lex')
    }

    // OECD free tier
    console.log(`[worker-10] oecd: enumerating open-access documents…`)
    const oecdItems: OecdDoc[] = []
    for await (const doc of listOecdOpenDocs()) oecdItems.push(doc)
    console.log(`[worker-10] oecd: ${oecdItems.length} items enumerated before processing`)
    cp.totalInCorpus += oecdItems.length
    for (const doc of oecdItems) {
      await processItem(doc.id, () => fetchOecdText(doc.url), doc.url, 'oecd')
    }
  }

  cp.phase1Complete = true
  await writeCheckpoint(cp)
  console.log(`[worker-${workerId}] Phase 1 complete`)
}

// ── Phase 2 ───────────────────────────────────────────────────────────────────

async function runPhase2Corpus(
  workerId: number, corpus: string, cp: WorkerCheckpoint,
): Promise<void> {
  cp.corpus = corpus
  cp.phase = 2
  console.log(`[worker-${workerId}] Phase 2: ${CORPUS_LABELS[corpus as keyof typeof CORPUS_LABELS] ?? corpus}`)
  let sinceCheckpoint = 0

  // Snapshot before running source — lets us detect 0-item returns at the end
  const completedBefore = cp.completed
  const skippedBefore  = cp.skipped
  const failedBefore   = cp.failed

  // customKey overrides the default compiledKey(corpus, id, '1') path.
  // No truncation — parliamentary and judicial texts must be stored complete.
  async function processText(
    id: string,
    raw: string | null,
    sourceUrl: string,
    customKey?: string,
  ): Promise<void> {
    if (!raw) { recordError(cp, sectionId(corpus, id, '1'), 'empty content'); return }
    const cKey = customKey ?? compiledKey(corpus, id, '1')
    if (await r2Exists(cKey)) { recordSkip(cp); return }
    try {
      const compiled = rawToText(raw)  // full text — no truncation
      await r2Put(cKey, compiled)
      await upsertSection({ id: sectionId(corpus, id, '1'), corpus, sourceUrl, r2Key: cKey, wordCount: countWords(compiled), status: 'compiled' })
      recordSuccess(cp, id)
    } catch (err: unknown) {
      recordError(cp, sectionId(corpus, id, '1'), String(err))
    }
    sinceCheckpoint++
    if (sinceCheckpoint % CHECKPOINT_INTERVAL === 0) await writeCheckpoint(cp)
  }

  if (corpus.startsWith('hansard-commons') || corpus.startsWith('hansard-lords')) {
    const house = corpus.includes('commons') ? 'Commons' : 'Lords'
    const workerNum = corpus.endsWith('-a') ? (house === 'Commons' ? 1 : 3) : (house === 'Commons' ? 2 : 4)
    const partition = HANSARD_PARTITIONS[workerNum]
    if (!partition) return

    // Enumerate total before processing begins
    const total = await countHansardDebates(partition.house, partition.startDate, partition.endDate)
    console.log(`[worker-${workerId}] ${corpus}: ${total} items enumerated before processing`)
    cp.totalInCorpus = Math.max(cp.totalInCorpus, total)

    for await (const debate of listHansardDebates(partition.house, partition.startDate, partition.endDate)) {
      const text = await fetchDebateText(debate.id)
      await processText(debate.id, text, debate.url, hansardKey(debate.date, debate.id))
    }
  } else if (corpus.startsWith('committees')) {
    for await (const report of listCommitteeReports()) {
      // Fetch the actual publication text; fall back to title-only if URL is unavailable
      const text = await fetchReportContent(report.url) ?? report.title
      await processText(report.id, text, report.url, hansardKey(report.date, report.id))
    }
  } else if (corpus.startsWith('bailii')) {
    const dbs = WORKER_DB_SUBSETS[workerId] ?? []
    for (const db of dbs) {
      // Enumerate listing pages first (no case HTML fetched) to log count before processing
      const courtCases: Array<{ url: string; caseRef: string }> = []
      for await (const c of listCases(db.path)) courtCases.push(c)
      console.log(`[worker-${workerId}] bailii ${db.court}: ${courtCases.length} items enumerated before processing`)
      cp.totalInCorpus += courtCases.length

      for (const c of courtCases) {
        const html = await fetchCaseHtml(c.url)
        const text = html ? extractCaseText(html) : null
        await processText(c.caseRef, text, c.url, bailiiKey(c.caseRef))
      }
    }
  } else if (corpus === 'uk-treaties') {
    console.log(`[worker-${workerId}] uk-treaties: enumerating treaties…`)
    const allTreaties: UkTreaty[] = []
    for await (const t of listUkTreaties()) allTreaties.push(t)
    console.log(`[worker-${workerId}] uk-treaties: ${allTreaties.length} items enumerated before processing`)
    cp.totalInCorpus = Math.max(cp.totalInCorpus, allTreaties.length)

    for (const t of allTreaties) {
      const text = await fetchTreatyText(t.url)
      await processText(t.id, text, t.url)
    }
  } else {
    // No implementation for this corpus yet — log and sleep rather than silently completing.
    console.warn(`[worker-${workerId}] Phase 2: ${corpus} — not yet implemented, skipping. Sleeping 4h.`)
    await new Promise(r => setTimeout(r, 4 * 60 * 60 * 1000))
    return // no checkpoint write — will retry on next wake
  }

  // Guard: if the source returned zero items (no new, skipped, or failed rows),
  // the API is likely unavailable or broken. Do NOT mark this corpus complete —
  // sleep 4h and let the next wake retry. Without this guard, workers complete
  // Phase 2 instantly on every 24h restart and waste Railway compute.
  const totalHandled = (cp.completed - completedBefore) + (cp.skipped - skippedBefore) + (cp.failed - failedBefore)
  if (totalHandled === 0) {
    console.warn(`[worker-${workerId}] Phase 2: ${corpus} — source returned 0 items (API unavailable or misconfigured?). Sleeping 4h before retry.`)
    await new Promise(r => setTimeout(r, 4 * 60 * 60 * 1000))
    return // no checkpoint write — corpus will retry on next wake
  }

  await writeCheckpoint(cp)
  console.log(`[worker-${workerId}] Phase 2 corpus ${corpus} complete — ` +
    `${cp.completed - completedBefore} new, ${cp.skipped - skippedBefore} skipped, ${cp.failed - failedBefore} failed`)
}

// ── Entry ─────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('[worker] fatal error:', err)
  process.exit(1)
})
