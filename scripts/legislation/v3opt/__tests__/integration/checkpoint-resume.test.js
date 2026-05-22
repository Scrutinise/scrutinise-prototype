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
const vitest_1 = require("vitest");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const checkpoint_1 = require("../../src/checkpoint");
const parser_1 = require("../../src/parser");
const parseActId_1 = require("../../src/parseActId");
// Explicit Unicode escapes so charset is unambiguous across all editors/terminals
const LQ = '“'; // " left double quote
const RQ = '”'; // " right double quote
const EM = '—'; // — em-dash
const GBP = '£'; // £
const EACC = 'é'; // é
const SEC = '§'; // §
const TMP = path.join(__dirname, '../../tmp-test-checkpoints');
function mkTestZip(entries) {
    const zip = new adm_zip_1.default();
    for (const e of entries)
        zip.addFile(e.path, Buffer.from(e.content, 'utf8'));
    return zip.toBuffer();
}
const CLML_UNICODE = [
    '<?xml version="1.0"?>',
    '<Legislation>',
    `  <ukm:Metadata><dc:title>The ${LQ}Smart${RQ} Regulations ${EM} 2021</dc:title></ukm:Metadata>`,
    '  <Body>',
    `    <P1group><Pnumber>1</Pnumber><P1><Text>${GBP}100 fine</Text></P1></P1group>`,
    `    <P1group><Pnumber>2</Pnumber><P1><Text>caf${EACC} ${EM} Paris</Text></P1></P1group>`,
    `    <P1group><Pnumber>3</Pnumber><P1><Text>${SEC} 3 applies</Text></P1></P1group>`,
    '  </Body>',
    '</Legislation>',
].join('\n');
// ── Checkpoint ────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('checkpoint', () => {
    (0, vitest_1.beforeEach)(() => fs.mkdirSync(TMP, { recursive: true }));
    (0, vitest_1.afterEach)(() => fs.rmSync(TMP, { recursive: true, force: true }));
    (0, vitest_1.it)('returns empty checkpoint when file does not exist', () => {
        const cp = (0, checkpoint_1.loadWorkerCheckpoint)(TMP, 99);
        (0, vitest_1.expect)(cp.completed).toEqual([]);
        (0, vitest_1.expect)(cp.skipped).toEqual([]);
        (0, vitest_1.expect)(cp.stats.created).toBe(0);
    });
    (0, vitest_1.it)('persists and reloads checkpoint data', () => {
        const cp = (0, checkpoint_1.loadWorkerCheckpoint)(TMP, 0);
        cp.completed.push('uksi/2021/1');
        cp.stats.created = 1;
        cp.stats.sectionsCreated = 5;
        (0, checkpoint_1.saveWorkerCheckpoint)(TMP, 0, cp);
        const loaded = (0, checkpoint_1.loadWorkerCheckpoint)(TMP, 0);
        (0, vitest_1.expect)(loaded.completed).toContain('uksi/2021/1');
        (0, vitest_1.expect)(loaded.stats.created).toBe(1);
        (0, vitest_1.expect)(loaded.stats.sectionsCreated).toBe(5);
    });
    (0, vitest_1.it)('workers use separate checkpoint files — no cross-contamination', () => {
        const cp0 = (0, checkpoint_1.loadWorkerCheckpoint)(TMP, 0);
        cp0.completed.push('uksi/2021/1');
        (0, checkpoint_1.saveWorkerCheckpoint)(TMP, 0, cp0);
        const cp1 = (0, checkpoint_1.loadWorkerCheckpoint)(TMP, 1);
        (0, vitest_1.expect)(cp1.completed).not.toContain('uksi/2021/1');
        (0, vitest_1.expect)(cp1.stats.created).toBe(0);
    });
    (0, vitest_1.it)('checkpoint resume: completed set prevents re-processing', () => {
        const cp = (0, checkpoint_1.loadWorkerCheckpoint)(TMP, 0);
        cp.completed.push('uksi/2021/1', 'uksi/2021/2');
        (0, checkpoint_1.saveWorkerCheckpoint)(TMP, 0, cp);
        const loaded = (0, checkpoint_1.loadWorkerCheckpoint)(TMP, 0);
        const doneSet = new Set([...loaded.completed, ...loaded.skipped]);
        (0, vitest_1.expect)(doneSet.has('uksi/2021/1')).toBe(true);
        (0, vitest_1.expect)(doneSet.has('uksi/2021/3')).toBe(false);
    });
});
// ── adm-zip UTF-8 round-trip ──────────────────────────────────────────────────
(0, vitest_1.describe)('adm-zip UTF-8 round-trip', () => {
    (0, vitest_1.it)('getData().toString("utf8") preserves Unicode content', () => {
        const zip = new adm_zip_1.default(mkTestZip([{ path: 'test.xml', content: CLML_UNICODE }]));
        const entry = zip.getEntry('test.xml');
        (0, vitest_1.expect)(entry).toBeTruthy();
        const content = entry.getData().toString('utf8');
        (0, vitest_1.expect)(content).toContain(LQ); // “ left double quote
        (0, vitest_1.expect)(content).toContain(RQ); // “ right double quote
        (0, vitest_1.expect)(content).toContain(EM); // — em-dash
        (0, vitest_1.expect)(content).toContain(GBP);
        (0, vitest_1.expect)(content).toContain(EACC);
        (0, vitest_1.expect)(content).toContain(SEC);
    });
    (0, vitest_1.it)('parser extracts correct title and sections from ZIP-sourced XML', () => {
        const zip = new adm_zip_1.default(mkTestZip([{ path: 'uksi/2021/1/data.xml', content: CLML_UNICODE }]));
        const entry = zip.getEntry('uksi/2021/1/data.xml');
        const xmlStr = entry.getData().toString('utf8');
        const title = (0, parser_1.extractTitle)(xmlStr);
        (0, vitest_1.expect)(title).toBe(`The ${LQ}Smart${RQ} Regulations ${EM} 2021`);
        const sections = (0, parser_1.extractSections)(xmlStr);
        (0, vitest_1.expect)(sections).toHaveLength(3);
        (0, vitest_1.expect)(sections[1].xml).toContain(`caf${EACC}`);
        (0, vitest_1.expect)(sections[2].xml).toContain(SEC);
    });
    (0, vitest_1.it)('multiple entries in ZIP are independently accessible', () => {
        const zip = new adm_zip_1.default(mkTestZip([
            { path: 'entry-a.xml', content: '<root>Alpha</root>' },
            { path: 'entry-b.xml', content: '<root>Beta</root>' },
        ]));
        (0, vitest_1.expect)(zip.getEntry('entry-a.xml').getData().toString('utf8')).toContain('Alpha');
        (0, vitest_1.expect)(zip.getEntry('entry-b.xml').getData().toString('utf8')).toContain('Beta');
    });
    (0, vitest_1.it)('non-existent entry returns null', () => {
        const zip = new adm_zip_1.default(mkTestZip([{ path: 'a.xml', content: '<x/>' }]));
        (0, vitest_1.expect)(zip.getEntry('missing.xml')).toBeNull();
    });
});
// ── parseActId + IsbnDraftError ───────────────────────────────────────────────
(0, vitest_1.describe)('parseActId in resume context', () => {
    (0, vitest_1.it)('ISBN draft identified correctly so checkpoint skips it on re-run', () => {
        (0, vitest_1.expect)(() => (0, parseActId_1.parseActId)('uksi/2021/9780000000000')).toThrow(parseActId_1.IsbnDraftError);
    });
});
