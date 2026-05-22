import { workerData, parentPort } from 'worker_threads'
import path from 'path'
import AdmZip from 'adm-zip'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '../../../../scrutinise-web/.env') })
import { getPrisma, disconnectPrisma } from './db'
import { CompilationStatus, LegislationType, LegislationTier } from './runtime-deps'

import type { ManifestEntry } from './manifest'
import { parseItem } from './parser'
import { parseActId, IsbnDraftError } from './parseActId'
import { getR2KeyForSection, decodeEntities, ManifestVersion } from './r2keys'

// Applied to every R2 key and stored in DB — keeps pilot writes isolated from production blobs.
// Set R2_KEY_PREFIX=v3opt-pilot/ for pilot runs; leave empty for production.
const R2_KEY_PREFIX = process.env.R2_KEY_PREFIX ?? ''
import { batchR2Put, R2PutItem } from './r2-batch'
import { batchDbCreate, SectionDbRecord } from './prisma-batch'
import { loadWorkerCheckpoint, saveWorkerCheckpoint, WorkerCheckpoint } from './checkpoint'
import { log } from './log'

export interface WorkerOptions {
  zipPath: string
  workerId: number
  checkpointDir: string
  batchSize: number
}

export interface WorkerData {
  partition: ManifestEntry[]
  options: WorkerOptions
}

export type WorkerMessage =
  | { type: 'item-complete'; workerId: number; actId: string; sections: number }
  | { type: 'item-skip';    workerId: number; actId: string; reason: string }
  | { type: 'item-error';   workerId: number; actId: string; error: string }
  | { type: 'batch-flushed';workerId: number; succeeded: number; failed: number }
  | { type: 'progress';     workerId: number; completed: number; total: number }
  | { type: 'done';         workerId: number; stats: WorkerCheckpoint['stats'] }
  | { type: 'fatal';        workerId: number; error: string }

function send(msg: WorkerMessage): void {
  parentPort!.postMessage(msg)
}

interface BatchEntry {
  sectionNumber: string
  xml: string
  r2Key: string
  r2Field: 'tnaXmlKey' | 'originalXmlKey'
  sectionTitle: string | null
  originalText: string
}

async function processItem(
  entry: ManifestEntry,
  zip: AdmZip,
  workerId: number,
  batchSize: number,
  cp: WorkerCheckpoint,
  trace = false,
): Promise<void> {
  const { actId, zipPath: entryPath, version } = entry

  if (trace) log(workerId, 'info', `TRACE actId=${actId} zipPath=${entryPath} version=${version}`)

  // ISBN-draft filter — throws IsbnDraftError for 13-digit ISBN actIds
  let parsed: ReturnType<typeof parseActId>
  try {
    parsed = parseActId(actId)
  } catch (e) {
    if (e instanceof IsbnDraftError) {
      if (trace) log(workerId, 'info', `TRACE skip=ISBN_DRAFT`)
      cp.skipped.push(actId)
      send({ type: 'item-skip', workerId, actId, reason: 'ISBN_DRAFT' })
      return
    }
    throw e
  }
  const { yearInt, yearStr, num } = parsed

  // Idempotency: skip if already in DB
  const existing = await getPrisma().legislationItem.findUnique({
    where: { legislationGovUkId: actId },
    select: { id: true },
  })
  if (existing) {
    if (trace) log(workerId, 'info', `TRACE skip=exists (id=${existing.id})`)
    cp.skipped.push(actId)
    send({ type: 'item-skip', workerId, actId, reason: 'exists' })
    return
  }
  if (trace) log(workerId, 'info', `TRACE DB: item not found — proceeding to create`)

  // Extract XML from ZIP entry (UTF-8 — no spawned process, no encoding risk)
  const zipEntry = zip.getEntry(entryPath)
  if (trace) log(workerId, 'info', `TRACE ZIP entry: ${zipEntry ? `FOUND (${zipEntry.header.size} bytes compressed)` : 'NOT FOUND'}`)
  if (!zipEntry) throw new Error(`Entry not found in ZIP: ${entryPath}`)
  const xmlStr = zipEntry.getData().toString('utf8')
  if (trace) log(workerId, 'info', `TRACE XML extracted: ${xmlStr.length} chars`)

  // Parse title and sections
  const { title: rawTitle, sections } = parseItem(xmlStr)
  const title = decodeEntities(rawTitle) || `SI ${actId.split('/')[1]}/${actId.split('/')[2]}`
  if (trace) log(workerId, 'info', `TRACE parsed: title="${title}" raw-sections=${sections.length}`)

  // Create LegislationItem
  const item = await getPrisma().legislationItem.create({
    data: {
      legislationType: LegislationType.UKSI,
      tier: LegislationTier.TIER_3,
      title,
      year: yearInt,
      yearRaw: yearStr,
      number: num,
      jurisdiction: 'UK',
      legislationGovUkId: actId,
      clmlUrl: `https://www.legislation.gov.uk/${actId}/data.xml`,
      compilationStatus: CompilationStatus.PENDING,
    },
  })

  // Deduplicate sections: trim whitespace, strip trailing dots, first occurrence wins
  const seenNums = new Set<string>()
  let normalizedCount = 0
  const dedupedSections: { sectionNumber: string; xml: string }[] = []

  for (const s of sections.filter(s => s.sectionNumber)) {
    const normalized = s.sectionNumber.trim().replace(/\.+$/, '')
    if (normalized !== s.sectionNumber) normalizedCount++
    if (!seenNums.has(normalized)) {
      seenNums.add(normalized)
      dedupedSections.push({ sectionNumber: normalized, xml: s.xml })
    }
  }

  if (normalizedCount > 0) cp.stats.normalized += normalizedCount

  // Process sections in batches of batchSize
  let totalR2Writes = 0, totalTnaWrites = 0, totalOrigWrites = 0, totalR2Failed = 0

  for (let i = 0; i < dedupedSections.length; i += batchSize) {
    const batch = dedupedSections.slice(i, i + batchSize)

    // Pre-compute all keys and DB record data in one pass
    const batchEntries: BatchEntry[] = batch.map(({ sectionNumber, xml }) => {
      const { key, field } = getR2KeyForSection(actId, sectionNumber, version)
      const sectionTitle = decodeEntities(
        (xml.match(/<Title[^>]*>([\s\S]*?)<\/Title>/)?.[1] ?? '').replace(/<[^>]+>/g, '').trim()
      ) || null
      const originalText = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 10_000)
      return { sectionNumber, xml, r2Key: R2_KEY_PREFIX + key, r2Field: field as 'tnaXmlKey' | 'originalXmlKey', sectionTitle, originalText }
    })

    // R2 PUTs first — allSettled so partial failures don't abort the batch
    const r2Items: R2PutItem[] = batchEntries.map(e => ({
      key: e.r2Key,
      content: e.xml,
      contentType: 'application/xml; charset=utf-8',
    }))
    const { succeeded: r2Succeeded, failed: r2Failed } = await batchR2Put(r2Items)

    if (r2Failed.length > 0) {
      totalR2Failed += r2Failed.length
      for (const f of r2Failed) {
        log(workerId, 'error', `R2 PUT failed: ${f.item.key} — ${f.error}`)
      }
    }

    // Only write to DB for sections whose R2 PUT succeeded — no dangling pointers
    const succeededKeys = new Set(r2Succeeded.map(r => r.key))
    const dbRecords: SectionDbRecord[] = batchEntries
      .filter(e => succeededKeys.has(e.r2Key))
      .map(e => ({
        legislationItemId: item.id,
        sectionNumber: e.sectionNumber,
        sectionTitle: e.sectionTitle,
        originalText: e.originalText,
        ...(e.r2Field === 'tnaXmlKey'
          ? { tnaXmlKey: e.r2Key }
          : { originalXmlKey: e.r2Key }),
      }))

    if (dbRecords.length > 0) {
      await batchDbCreate(dbRecords)
    }

    totalR2Writes += r2Succeeded.length
    totalTnaWrites += dbRecords.filter(r => r.tnaXmlKey).length
    totalOrigWrites += dbRecords.filter(r => r.originalXmlKey).length

    send({ type: 'batch-flushed', workerId, succeeded: r2Succeeded.length, failed: r2Failed.length })
  }

  const sectionCount = dedupedSections.length
  await getPrisma().legislationItem.update({ where: { id: item.id }, data: { sectionCount } })

  cp.completed.push(actId)
  cp.stats.created++
  cp.stats.sectionsCreated += sectionCount
  cp.stats.r2Writes += totalR2Writes
  cp.stats.tnaKeyWrites += totalTnaWrites
  cp.stats.originalKeyWrites += totalOrigWrites
  cp.stats.r2Failed += totalR2Failed
  if (sectionCount === 0) cp.stats.zeroSection++
  delete cp.errors[actId]

  send({ type: 'item-complete', workerId, actId, sections: sectionCount })
}

async function workerMain(): Promise<void> {
  const { partition, options }: WorkerData = workerData
  const { zipPath, workerId, checkpointDir, batchSize } = options

  // Log effective DB target at worker startup — must appear in output before any skip/create.
  // If this shows public/railway (no schema param) while the shell set ?schema=v3opt_test,
  // dotenv.config() above overwrote the env var inside the worker.
  const dbUrl = process.env.DATABASE_URL ?? '(unset)'
  const dbDisplay = (() => {
    try { const u = new URL(dbUrl); return `${u.host}${u.pathname}${u.search}` }
    catch { return dbUrl.slice(0, 60) }
  })()
  log(workerId, 'info', `startup: DB=${dbDisplay} SCHEMA="${process.env.PGSCHEMA ?? '(public)'}" R2_PREFIX="${R2_KEY_PREFIX}"`)

  const cp = loadWorkerCheckpoint(checkpointDir, workerId)
  const doneSet = new Set([...cp.completed, ...cp.skipped])

  const zip = new AdmZip(zipPath)
  let itemsProcessed = 0
  let tracedFirst = false

  for (let i = 0; i < partition.length; i++) {
    const entry = partition[i]
    const { actId } = entry

    if (doneSet.has(actId)) {
      send({ type: 'item-skip', workerId, actId, reason: 'checkpoint' })
      continue
    }

    const trace = !tracedFirst
    tracedFirst = true

    try {
      await processItem(entry, zip, workerId, batchSize, cp, trace)
      doneSet.add(actId)
    } catch (err: any) {
      cp.errors[actId] = err.message ?? String(err)
      send({ type: 'item-error', workerId, actId, error: err.message ?? String(err) })
    }

    itemsProcessed++
    if (itemsProcessed % 100 === 0) {
      saveWorkerCheckpoint(checkpointDir, workerId, cp)
      send({ type: 'progress', workerId, completed: cp.completed.length, total: partition.length })
    }
  }

  saveWorkerCheckpoint(checkpointDir, workerId, cp)
  send({ type: 'done', workerId, stats: cp.stats })
  await disconnectPrisma()
}

workerMain().catch(err => {
  const wid = (workerData as WorkerData)?.options?.workerId ?? -1
  parentPort?.postMessage({ type: 'fatal', workerId: wid, error: String(err) })
  process.exit(1)
})
