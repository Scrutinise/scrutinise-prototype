import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import {
  readCheckpoint, writeCheckpoint,
  recordSuccess, recordError, recordSkip,
  WorkerCheckpoint,
} from '../shared/checkpoint'
import { r2Exists, r2Put, compiledKey, rawKey } from '../shared/r2-client'
import { rawToText } from '../shared/compile'
import { upsertSection, sectionId, countWords, disconnectDb } from '../shared/db-metadata'
import {
  listActIds, enumerateSections,
  WORKER_CORPORA,
} from '../sources/tna-legislation'
import {
  listJudgments, fetchJudgmentXml, extractJudgmentText,
} from '../sources/tna-caselaw'
import {
  listCases, fetchCaseHtml, extractCaseText, WORKER_DB_SUBSETS,
} from '../sources/bailii-scraper'
import {
  listHansardDebates, fetchDebateText, HANSARD_PARTITIONS,
  listCommitteeReports,
} from '../sources/parliament-api'
import { listFcaSections, fetchSectionText as fetchFcaText } from '../sources/fca-handbook'
import {
  listHmrcManuals, listNaoReports, listHoCLReports,
  listExplanatoryNotes, listImpactAssessments, listConsultations,
  fetchDocumentText,
} from '../sources/gov-scraper'
import { listUkCases, fetchCaseText as fetchEchrText } from '../sources/echr-hudoc'
import { listRetainedEuInstruments, fetchDocumentText as fetchEurLexText } from '../sources/eurlex'
import { listOecdOpenDocs, fetchDocText as fetchOecdText } from '../sources/oecd-free'
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
      // enumerateSections fetches data.xml and splits into <P1> elements inline —
      // 1 HTTP request per act, section XML is already available, no second fetch needed.
      const sections = await enumerateSections(actId)
      console.log(`[worker-${workerId}] ${actId}: ${sections.length} sections`)
      if (sections.length === 0) {
        // Empty/repealed act — still mark as processed so we don't retry
        recordSuccess(cp, actId)
      }
      for (const section of sections) {
        const secId = sectionId(phase1Corpus, actId, section.sectionRef)
        const cKey = compiledKey(phase1Corpus, actId, section.sectionRef)

        if (await r2Exists(cKey)) {
          recordSkip(cp)
          continue
        }

        // section.xml is the full <P1> CLML fragment — save raw and compile
        const rKey = rawKey(phase1Corpus, actId, section.sectionRef, 'xml')
        await r2Put(rKey, section.xml, 'application/xml')

        const sourceUrl = `https://www.legislation.gov.uk/${actId}/${section.sectionRef}`
        try {
          const compiled = rawToText(section.xml)
          await r2Put(cKey, compiled)
          await upsertSection({
            id: secId, corpus: phase1Corpus,
            sourceUrl, r2Key: cKey, r2RawKey: rKey,
            wordCount: countWords(compiled), status: 'compiled',
          })
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
    for await (const section of listFcaSections()) {
      const text = await fetchFcaText(section.url)
      await processItem(section.id, () => Promise.resolve(text), section.url, corpus)
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
    for await (const j of listJudgments()) {
      await processItem(
        j.neutralCitation || j.uri,
        async () => {
          const xml = await fetchJudgmentXml(j.xmlUrl)
          return xml ? extractJudgmentText(xml) : null
        },
        j.xmlUrl, corpus, 'xml',
      )
    }
  } else if (workerId === 10) {
    for await (const c of listUkCases()) {
      await processItem(c.itemId, () => fetchEchrText(c.itemId, c.docName), c.url, 'echr-hudoc')
    }
    for await (const doc of listRetainedEuInstruments()) {
      await processItem(doc.celexId, () => fetchEurLexText(doc.celexId), doc.url, 'eur-lex')
    }
    for await (const doc of listOecdOpenDocs()) {
      await processItem(doc.id, () => fetchDocText(doc.url), doc.url, 'oecd')
    }
  }

  cp.phase1Complete = true
  await writeCheckpoint(cp)
  console.log(`[worker-${workerId}] Phase 1 complete`)
}

async function fetchDocText(url: string): Promise<string | null> {
  const { fetchDocText } = await import('../sources/oecd-free')
  return fetchDocText(url)
}

// ── Phase 2 ───────────────────────────────────────────────────────────────────

async function runPhase2Corpus(
  workerId: number, corpus: string, cp: WorkerCheckpoint,
): Promise<void> {
  cp.corpus = corpus
  cp.phase = 2
  console.log(`[worker-${workerId}] Phase 2: ${CORPUS_LABELS[corpus as keyof typeof CORPUS_LABELS] ?? corpus}`)
  let sinceCheckpoint = 0

  async function processText(id: string, raw: string | null, sourceUrl: string): Promise<void> {
    if (!raw) { recordError(cp, sectionId(corpus, id, '1'), 'empty content'); return }
    const cKey = compiledKey(corpus, id, '1')
    if (await r2Exists(cKey)) { recordSkip(cp); return }
    try {
      const compiled = rawToText(raw.slice(0, 50_000))
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
    for await (const debate of listHansardDebates(partition.house, partition.startDate, partition.endDate)) {
      const text = await fetchDebateText(debate.id)
      await processText(debate.id, text, debate.url)
    }
  } else if (corpus.startsWith('committees')) {
    for await (const report of listCommitteeReports()) {
      await processText(report.id, report.title, report.url)
    }
  } else if (corpus.startsWith('bailii')) {
    const dbs = WORKER_DB_SUBSETS[workerId] ?? []
    for (const db of dbs) {
      for await (const c of listCases(db.path)) {
        const html = await fetchCaseHtml(c.url)
        const text = html ? extractCaseText(html) : null
        await processText(c.caseRef, text, c.url)
      }
    }
  }

  await writeCheckpoint(cp)
  console.log(`[worker-${workerId}] Phase 2 corpus ${corpus} complete`)
}

// ── Entry ─────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('[worker] fatal error:', err)
  process.exit(1)
})
