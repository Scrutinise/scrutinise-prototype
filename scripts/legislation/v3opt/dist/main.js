"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const worker_threads_1 = require("worker_threads");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path.resolve(__dirname, '../../../../scrutinise-web/.env') });
const manifest_1 = require("./manifest");
const partition_1 = require("./partition");
const checkpoint_1 = require("./checkpoint");
const log_1 = require("./log");
const DIR = __dirname;
const ZIP_PATH = path.resolve(DIR, '../../v276-bulk/best-collection-xml.zip');
const MANIFEST_PATH = path.resolve(DIR, '../../v3b-uksi/manifest-uksi.json');
const CHECKPOINT_DIR = process.env.CHECKPOINT_DIR ?? path.resolve(DIR, '../checkpoints-v3opt');
const WORKER_COUNT = Math.min(8, Math.max(1, parseInt(process.env.WORKER_COUNT ?? '4', 10)));
const BATCH_SIZE = 50;
const MAX_WORKER_CRASHES = 3;
function stratify(arr, n) {
    if (arr.length <= n)
        return [...arr];
    const sorted = [...arr].sort((a, b) => a.uncompressedSize - b.uncompressedSize);
    const step = sorted.length / n;
    return Array.from({ length: n }, (_, i) => sorted[Math.floor(i * step)]);
}
function selectPilotSample(entries) {
    const year = (m) => parseInt(m.actId.split('/')[1], 10);
    const revised = entries.filter(m => m.version === 'revised-current');
    const made1990 = entries.filter(m => m.version === 'made' && year(m) >= 1990 && year(m) <= 2010);
    const made2015 = entries.filter(m => m.version === 'made' && year(m) >= 2015 && year(m) <= 2024);
    return [...stratify(revised, 50), ...stratify(made1990, 30), ...stratify(made2015, 20)];
}
function selectPilot1000Sample(entries) {
    const year = (m) => parseInt(m.actId.split('/')[1], 10);
    const revised = entries.filter(m => m.version === 'revised-current');
    const made1990 = entries.filter(m => m.version === 'made' && year(m) >= 1990 && year(m) <= 2010);
    const made2015 = entries.filter(m => m.version === 'made' && year(m) >= 2015 && year(m) <= 2024);
    return [...stratify(revised, 500), ...stratify(made1990, 300), ...stratify(made2015, 200)];
}
function spawnWorker(part, options) {
    const isTs = __filename.endsWith('.ts');
    const workerFile = isTs
        ? path.resolve(__dirname, 'worker.ts')
        : path.resolve(__dirname, 'worker.js');
    const workerData = { partition: part, options };
    return new worker_threads_1.Worker(workerFile, {
        workerData,
        execArgv: isTs ? [...process.execArgv] : [],
    });
}
async function main() {
    const isFull = process.argv.includes('--full');
    const isPilot1000 = process.argv.includes('--pilot-1000');
    const isResume = process.argv.includes('--resume');
    const r2Prefix = process.env.R2_KEY_PREFIX ?? '';
    const mode = isFull ? 'FULL (61,179)' : isPilot1000 ? 'PILOT-1000' : 'PILOT-100';
    (0, log_1.log)(null, 'info', `V.3-B-opt UKSI ingest — ${mode} — workers=${WORKER_COUNT} batch=${BATCH_SIZE}`);
    // Print host/database only — password is at the front of the Railway URL so slicing leaks it.
    const dbDisplay = (() => {
        try {
            const u = new URL(process.env.DATABASE_URL ?? '');
            return `${u.host}${u.pathname}`;
        }
        catch {
            return '(unset or invalid)';
        }
    })();
    (0, log_1.log)(null, 'info', `R2_KEY_PREFIX="${r2Prefix}" DB=${dbDisplay}`);
    if (!isFull && !r2Prefix) {
        (0, log_1.log)(null, 'warn', 'R2_KEY_PREFIX is unset — pilot writes will go to the production R2 namespace. Set R2_KEY_PREFIX=v3opt-pilot/ to isolate.');
    }
    if (!fs.existsSync(ZIP_PATH)) {
        (0, log_1.log)(null, 'error', `ZIP not found: ${ZIP_PATH}`);
        process.exit(1);
    }
    if (!fs.existsSync(MANIFEST_PATH)) {
        (0, log_1.log)(null, 'error', `Manifest not found: ${MANIFEST_PATH}`);
        process.exit(1);
    }
    fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
    if (!isResume) {
        fs.readdirSync(CHECKPOINT_DIR)
            .filter(f => f.startsWith('checkpoint-worker-'))
            .forEach(f => fs.unlinkSync(path.join(CHECKPOINT_DIR, f)));
    }
    const manifest = (0, manifest_1.loadManifest)(MANIFEST_PATH);
    (0, log_1.log)(null, 'info', `Manifest: ${manifest.length} entries`);
    const entries = isFull ? manifest : isPilot1000 ? selectPilot1000Sample(manifest) : selectPilotSample(manifest);
    (0, log_1.log)(null, 'info', `Processing: ${entries.length} entries across ${WORKER_COUNT} workers`);
    const partitions = (0, partition_1.partition)(entries, WORKER_COUNT);
    const baseOptions = { zipPath: ZIP_PATH, checkpointDir: CHECKPOINT_DIR, batchSize: BATCH_SIZE };
    const startTime = Date.now();
    let totalCompleted = 0, totalErrors = 0, totalSkipped = 0;
    let skippedExists = 0, skippedIsbn = 0, skippedCheckpoint = 0;
    let gaveUpCount = 0;
    await new Promise((resolve, reject) => {
        let activeWorkers = WORKER_COUNT;
        const workerDone = new Array(WORKER_COUNT).fill(false);
        const crashCounts = new Array(WORKER_COUNT).fill(0);
        function attachWorker(worker, workerId) {
            worker.on('message', (msg) => {
                switch (msg.type) {
                    case 'item-complete':
                        totalCompleted++;
                        process.stdout.write(`\r[${totalCompleted}/${entries.length}] skipped=${totalSkipped} errors=${totalErrors}   `);
                        break;
                    case 'item-skip':
                        totalSkipped++;
                        if (msg.reason === 'exists')
                            skippedExists++;
                        else if (msg.reason === 'ISBN_DRAFT')
                            skippedIsbn++;
                        else if (msg.reason === 'checkpoint')
                            skippedCheckpoint++;
                        else
                            (0, log_1.log)(msg.workerId, 'warn', `skip ${msg.actId}: ${msg.reason}`);
                        process.stdout.write(`\r[${totalCompleted}/${entries.length}] skipped=${totalSkipped} errors=${totalErrors}   `);
                        break;
                    case 'item-error':
                        totalErrors++;
                        (0, log_1.log)(msg.workerId, 'error', `${msg.actId}: ${msg.error}`);
                        break;
                    case 'done':
                        workerDone[workerId] = true;
                        (0, log_1.log)(msg.workerId, 'info', `done — created=${msg.stats.created} sections=${msg.stats.sectionsCreated} r2Failed=${msg.stats.r2Failed}`);
                        activeWorkers--;
                        if (activeWorkers === 0)
                            resolve();
                        break;
                    case 'fatal':
                        (0, log_1.log)(msg.workerId, 'error', `Fatal: ${msg.error}`);
                        reject(new Error(`Worker ${msg.workerId} fatal: ${msg.error}`));
                        break;
                }
            });
            worker.on('error', err => {
                if (workerDone[workerId])
                    return;
                crashCounts[workerId]++;
                if (crashCounts[workerId] > MAX_WORKER_CRASHES) {
                    gaveUpCount++;
                    (0, log_1.log)(workerId, 'error', `Worker crashed ${crashCounts[workerId]} times — giving up`);
                    activeWorkers--;
                    if (activeWorkers === 0)
                        resolve();
                }
                else {
                    (0, log_1.log)(workerId, 'warn', `Crash (${crashCounts[workerId]}/${MAX_WORKER_CRASHES}): ${err.message} — restarting from checkpoint`);
                    attachWorker(spawnWorker(partitions[workerId], { ...baseOptions, workerId }), workerId);
                }
            });
            worker.on('exit', code => {
                if (workerDone[workerId] || code === 0)
                    return;
                (0, log_1.log)(workerId, 'warn', `Exited code=${code}`);
                activeWorkers--;
                if (activeWorkers === 0)
                    resolve();
            });
        }
        partitions.forEach((part, workerId) => {
            attachWorker(spawnWorker(part, { ...baseOptions, workerId }), workerId);
        });
    });
    console.log();
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const checkpoints = Array.from({ length: WORKER_COUNT }, (_, i) => (0, checkpoint_1.loadWorkerCheckpoint)(CHECKPOINT_DIR, i));
    const stats = (0, checkpoint_1.aggregateStats)(checkpoints);
    if (stats.created === 0 && entries.length > 0) {
        (0, log_1.log)(null, 'error', `=== INGEST INCOMPLETE: 0 items created ===`);
        (0, log_1.log)(null, 'error', `  skipped-exists=${skippedExists} skipped-isbn=${skippedIsbn} skipped-checkpoint=${skippedCheckpoint} errors=${totalErrors} workers-gave-up=${gaveUpCount}`);
        if (skippedExists > 0)
            (0, log_1.log)(null, 'error', `  All items already exist in this DB — run against a test schema or use a fresh DB`);
        process.exit(1);
    }
    (0, log_1.log)(null, 'info', `=== INGEST COMPLETE ===`);
    (0, log_1.log)(null, 'info', `Items created:    ${stats.created}`);
    (0, log_1.log)(null, 'info', `Sections created: ${stats.sectionsCreated}`);
    (0, log_1.log)(null, 'info', `R2 writes:        ${stats.r2Writes} (tna=${stats.tnaKeyWrites} orig=${stats.originalKeyWrites})`);
    (0, log_1.log)(null, 'info', `R2 failures:      ${stats.r2Failed}`);
    (0, log_1.log)(null, 'info', `Zero-section:     ${stats.zeroSection}`);
    (0, log_1.log)(null, 'info', `Normalisations:   ${stats.normalized}`);
    (0, log_1.log)(null, 'info', `Elapsed:          ${elapsed}s`);
    if (elapsed > 0)
        (0, log_1.log)(null, 'info', `Throughput:       ~${Math.round(stats.created / (elapsed / 3600))} items/hr`);
}
if (require.main === module) {
    main().catch(err => { console.error(err); process.exit(1); });
}
