"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
const path_1 = __importDefault(require("path"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../../scrutinise-web/.env') });
const db_1 = require("./db");
const runtime_deps_1 = require("./runtime-deps");
/** Derive the correct tier from the LegislationType value name. */
function deriveTier(lt) {
    const secondary = new Set(['UKSI', 'SSI', 'NISR', 'WSI', 'NISI']);
    const primaryPost2010 = new Set(['UKPGA']);
    if (secondary.has(lt))
        return runtime_deps_1.LegislationTier.TIER_3;
    if (primaryPost2010.has(lt))
        return runtime_deps_1.LegislationTier.TIER_1;
    return runtime_deps_1.LegislationTier.TIER_2; // ASP, NIA, ANAW, UKLA, NIER, etc.
}
const parser_1 = require("./parser");
const parseActId_1 = require("./parseActId");
const r2keys_1 = require("./r2keys");
// Applied to every R2 key and stored in DB — keeps pilot writes isolated from production blobs.
// Set R2_KEY_PREFIX=v3opt-pilot/ for pilot runs; leave empty for production.
const R2_KEY_PREFIX = process.env.R2_KEY_PREFIX ?? '';
const r2_batch_1 = require("./r2-batch");
const prisma_batch_1 = require("./prisma-batch");
const checkpoint_1 = require("./checkpoint");
const log_1 = require("./log");
function send(msg) {
    worker_threads_1.parentPort.postMessage(msg);
}
async function processItem(entry, zip, workerId, batchSize, cp, trace = false) {
    const { actId, zipPath: entryPath, version } = entry;
    if (trace)
        (0, log_1.log)(workerId, 'info', `TRACE actId=${actId} zipPath=${entryPath} version=${version}`);
    // ISBN-draft filter — throws IsbnDraftError for 13-digit ISBN actIds
    let parsed;
    try {
        parsed = (0, parseActId_1.parseActId)(actId);
    }
    catch (e) {
        if (e instanceof parseActId_1.IsbnDraftError) {
            if (trace)
                (0, log_1.log)(workerId, 'info', `TRACE skip=ISBN_DRAFT`);
            cp.skipped.push(actId);
            send({ type: 'item-skip', workerId, actId, reason: 'ISBN_DRAFT' });
            return;
        }
        throw e;
    }
    const { yearInt, yearStr, num } = parsed;
    // Idempotency: skip if already in DB
    const existing = await (0, db_1.getPrisma)().legislationItem.findUnique({
        where: { legislationGovUkId: actId },
        select: { id: true },
    });
    if (existing) {
        if (trace)
            (0, log_1.log)(workerId, 'info', `TRACE skip=exists (id=${existing.id})`);
        cp.skipped.push(actId);
        send({ type: 'item-skip', workerId, actId, reason: 'exists' });
        return;
    }
    if (trace)
        (0, log_1.log)(workerId, 'info', `TRACE DB: item not found — proceeding to create`);
    // Extract XML from ZIP entry (UTF-8 — no spawned process, no encoding risk)
    const zipEntry = zip.getEntry(entryPath);
    if (trace)
        (0, log_1.log)(workerId, 'info', `TRACE ZIP entry: ${zipEntry ? `FOUND (${zipEntry.header.size} bytes compressed)` : 'NOT FOUND'}`);
    if (!zipEntry)
        throw new Error(`Entry not found in ZIP: ${entryPath}`);
    const xmlStr = zipEntry.getData().toString('utf8');
    if (trace)
        (0, log_1.log)(workerId, 'info', `TRACE XML extracted: ${xmlStr.length} chars`);
    // Parse title and sections
    const { title: rawTitle, sections } = (0, parser_1.parseItem)(xmlStr);
    // Generic title fallback: derive from actId prefix (e.g. ssi/1999/1 → "SSI 1999/1")
    const [legTypePrefix, yr, numPart] = actId.split('/');
    const title = (0, r2keys_1.decodeEntities)(rawTitle) || `${legTypePrefix.toUpperCase()} ${yr}/${numPart}`;
    if (trace)
        (0, log_1.log)(workerId, 'info', `TRACE parsed: title="${title}" raw-sections=${sections.length}`);
    // Resolve legislationType and jurisdiction from manifest entry (back-compat: defaults to UKSI/UK)
    const legTypeName = entry.legislationType ?? 'UKSI';
    const legTypeValue = runtime_deps_1.LegislationType[legTypeName] ?? runtime_deps_1.LegislationType.UKSI;
    const jurisdiction = entry.jurisdiction ?? 'UK';
    const tier = deriveTier(legTypeName);
    // Create LegislationItem
    const item = await (0, db_1.getPrisma)().legislationItem.create({
        data: {
            legislationType: legTypeValue,
            tier: tier,
            title,
            year: yearInt,
            yearRaw: yearStr,
            number: num,
            jurisdiction,
            legislationGovUkId: actId,
            clmlUrl: `https://www.legislation.gov.uk/${actId}/data.xml`,
            compilationStatus: runtime_deps_1.CompilationStatus.PENDING,
        },
    });
    // Deduplicate sections: trim whitespace, strip trailing dots, first occurrence wins
    const seenNums = new Set();
    let normalizedCount = 0;
    const dedupedSections = [];
    for (const s of sections.filter(s => s.sectionNumber)) {
        const normalized = s.sectionNumber.trim().replace(/\.+$/, '');
        if (normalized !== s.sectionNumber)
            normalizedCount++;
        if (!seenNums.has(normalized)) {
            seenNums.add(normalized);
            dedupedSections.push({ sectionNumber: normalized, xml: s.xml });
        }
    }
    if (normalizedCount > 0)
        cp.stats.normalized += normalizedCount;
    // Process sections in batches of batchSize
    let totalR2Writes = 0, totalTnaWrites = 0, totalOrigWrites = 0, totalR2Failed = 0;
    for (let i = 0; i < dedupedSections.length; i += batchSize) {
        const batch = dedupedSections.slice(i, i + batchSize);
        // Pre-compute all keys and DB record data in one pass
        const batchEntries = batch.map(({ sectionNumber, xml }) => {
            const { key, field } = (0, r2keys_1.getR2KeyForSection)(actId, sectionNumber, version);
            const sectionTitle = (0, r2keys_1.decodeEntities)((xml.match(/<Title[^>]*>([\s\S]*?)<\/Title>/)?.[1] ?? '').replace(/<[^>]+>/g, '').trim()) || null;
            const originalText = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 10000);
            return { sectionNumber, xml, r2Key: R2_KEY_PREFIX + key, r2Field: field, sectionTitle, originalText };
        });
        // R2 PUTs first — allSettled so partial failures don't abort the batch
        const r2Items = batchEntries.map(e => ({
            key: e.r2Key,
            content: e.xml,
            contentType: 'application/xml; charset=utf-8',
        }));
        const { succeeded: r2Succeeded, failed: r2Failed } = await (0, r2_batch_1.batchR2Put)(r2Items);
        if (r2Failed.length > 0) {
            totalR2Failed += r2Failed.length;
            for (const f of r2Failed) {
                (0, log_1.log)(workerId, 'error', `R2 PUT failed: ${f.item.key} — ${f.error}`);
            }
        }
        // Only write to DB for sections whose R2 PUT succeeded — no dangling pointers
        const succeededKeys = new Set(r2Succeeded.map(r => r.key));
        const dbRecords = batchEntries
            .filter(e => succeededKeys.has(e.r2Key))
            .map(e => ({
            legislationItemId: item.id,
            sectionNumber: e.sectionNumber,
            sectionTitle: e.sectionTitle,
            originalText: e.originalText,
            ...(e.r2Field === 'tnaXmlKey'
                ? { tnaXmlKey: e.r2Key }
                : { originalXmlKey: e.r2Key }),
        }));
        if (dbRecords.length > 0) {
            await (0, prisma_batch_1.batchDbCreate)(dbRecords);
        }
        totalR2Writes += r2Succeeded.length;
        totalTnaWrites += dbRecords.filter(r => r.tnaXmlKey).length;
        totalOrigWrites += dbRecords.filter(r => r.originalXmlKey).length;
        send({ type: 'batch-flushed', workerId, succeeded: r2Succeeded.length, failed: r2Failed.length });
    }
    const sectionCount = dedupedSections.length;
    await (0, db_1.getPrisma)().legislationItem.update({ where: { id: item.id }, data: { sectionCount } });
    cp.completed.push(actId);
    cp.stats.created++;
    cp.stats.sectionsCreated += sectionCount;
    cp.stats.r2Writes += totalR2Writes;
    cp.stats.tnaKeyWrites += totalTnaWrites;
    cp.stats.originalKeyWrites += totalOrigWrites;
    cp.stats.r2Failed += totalR2Failed;
    if (sectionCount === 0)
        cp.stats.zeroSection++;
    delete cp.errors[actId];
    send({ type: 'item-complete', workerId, actId, sections: sectionCount });
}
async function workerMain() {
    const { partition, options } = worker_threads_1.workerData;
    const { zipPath, workerId, checkpointDir, batchSize } = options;
    // Log effective DB target at worker startup — must appear in output before any skip/create.
    // If this shows public/railway (no schema param) while the shell set ?schema=v3opt_test,
    // dotenv.config() above overwrote the env var inside the worker.
    const dbUrl = process.env.DATABASE_URL ?? '(unset)';
    const dbDisplay = (() => {
        try {
            const u = new URL(dbUrl);
            return `${u.host}${u.pathname}${u.search}`;
        }
        catch {
            return dbUrl.slice(0, 60);
        }
    })();
    (0, log_1.log)(workerId, 'info', `startup: DB=${dbDisplay} SCHEMA="${process.env.PGSCHEMA ?? '(public)'}" R2_PREFIX="${R2_KEY_PREFIX}"`);
    const cp = (0, checkpoint_1.loadWorkerCheckpoint)(checkpointDir, workerId);
    const doneSet = new Set([...cp.completed, ...cp.skipped]);
    const zip = new adm_zip_1.default(zipPath);
    let itemsProcessed = 0;
    let tracedFirst = false;
    for (let i = 0; i < partition.length; i++) {
        const entry = partition[i];
        const { actId } = entry;
        if (doneSet.has(actId)) {
            send({ type: 'item-skip', workerId, actId, reason: 'checkpoint' });
            continue;
        }
        const trace = !tracedFirst;
        tracedFirst = true;
        try {
            await processItem(entry, zip, workerId, batchSize, cp, trace);
            doneSet.add(actId);
        }
        catch (err) {
            cp.errors[actId] = err.message ?? String(err);
            send({ type: 'item-error', workerId, actId, error: err.message ?? String(err) });
        }
        itemsProcessed++;
        if (itemsProcessed % 100 === 0) {
            (0, checkpoint_1.saveWorkerCheckpoint)(checkpointDir, workerId, cp);
            send({ type: 'progress', workerId, completed: cp.completed.length, total: partition.length });
        }
    }
    (0, checkpoint_1.saveWorkerCheckpoint)(checkpointDir, workerId, cp);
    send({ type: 'done', workerId, stats: cp.stats });
    await (0, db_1.disconnectPrisma)();
}
workerMain().catch(err => {
    const wid = worker_threads_1.workerData?.options?.workerId ?? -1;
    worker_threads_1.parentPort?.postMessage({ type: 'fatal', workerId: wid, error: String(err) });
    process.exit(1);
});
