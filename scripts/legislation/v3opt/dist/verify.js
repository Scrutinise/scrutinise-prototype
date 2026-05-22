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
exports.verify = verify;
exports.runVerify = runVerify;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path.resolve(__dirname, '../../../../scrutinise-web/.env') });
const runtime_deps_1 = require("./runtime-deps");
const db_1 = require("./db");
const r2_batch_1 = require("./r2-batch");
const log_1 = require("./log");
function fetchWebSectionCount(actId) {
    return new Promise(resolve => {
        const url = `https://www.legislation.gov.uk/${actId}/data.xml`;
        https.get(url, { timeout: 15000 }, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                const matches = data.match(/<P1group/g);
                resolve(matches ? matches.length : 0);
            });
        }).on('error', () => resolve(null));
    });
}
async function verify(samplePercent = 0.5, maxSample = 500, webChecks = 20) {
    const result = { total: 0, passed: 0, failed: 0, issues: [], webPassed: 0, webFailed: 0 };
    const prisma = (0, db_1.getPrisma)();
    const total = await prisma.legislationItem.count({ where: { legislationType: 'UKSI' } });
    const sampleSize = Math.min(maxSample, Math.max(100, Math.round(total * samplePercent / 100)));
    (0, log_1.log)(null, 'info', `Verification: sampling ${sampleSize} of ${total} UKSI items`);
    // $queryRaw is literal SQL — schema-qualify the table when PGSCHEMA is set
    // because the adapter's schema option only applies to Prisma-generated queries.
    const schemaPrefix = process.env.PGSCHEMA ? `"${process.env.PGSCHEMA}".` : '';
    const sample = await prisma.$queryRaw(runtime_deps_1.Prisma.sql `
      SELECT id, "legislationGovUkId", "sectionCount"
      FROM ${runtime_deps_1.Prisma.raw(`${schemaPrefix}"LegislationItem"`)}
      WHERE "legislationType" = 'UKSI'
      ORDER BY RANDOM()
      LIMIT ${sampleSize}
    `);
    result.total = sample.length;
    for (const item of sample) {
        // sectionCount header must match actual section rows
        const actualCount = await prisma.legislationSection.count({ where: { legislationItemId: item.id } });
        if (actualCount !== item.sectionCount) {
            result.failed++;
            result.issues.push(`${item.legislationGovUkId}: sectionCount mismatch (header=${item.sectionCount} actual=${actualCount})`);
            continue;
        }
        // Spot-check one section's R2 backing blob
        const section = await prisma.legislationSection.findFirst({
            where: { legislationItemId: item.id },
            select: { tnaXmlKey: true, originalXmlKey: true },
        });
        const r2Key = section?.tnaXmlKey ?? section?.originalXmlKey ?? null;
        if (r2Key) {
            const exists = await (0, r2_batch_1.r2KeyExists)(r2Key);
            if (!exists) {
                result.failed++;
                result.issues.push(`${item.legislationGovUkId}: R2 blob missing: ${r2Key}`);
                continue;
            }
        }
        result.passed++;
    }
    // Web parity — compare Railway sectionCount against live TNA feed
    (0, log_1.log)(null, 'info', `Web parity: ${webChecks} items against legislation.gov.uk`);
    for (const item of sample.slice(0, webChecks)) {
        const webCount = await fetchWebSectionCount(item.legislationGovUkId);
        if (webCount === null)
            continue;
        const delta = item.sectionCount > 0
            ? Math.abs(webCount - item.sectionCount) / item.sectionCount
            : webCount > 0 ? 1 : 0;
        if (delta > 0.1) {
            result.webFailed++;
            result.issues.push(`${item.legislationGovUkId}: web parity >10% (railway=${item.sectionCount} web=${webCount})`);
        }
        else {
            result.webPassed++;
        }
    }
    return result;
}
async function runVerify() {
    try {
        const result = await verify();
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const reportPath = path.resolve(__dirname, `../verification-${ts}.log`);
        const lines = [
            `=== V.3-B-opt Verification Report — ${new Date().toISOString()} ===`,
            `Sampled:      ${result.total}`,
            `Passed:       ${result.passed}`,
            `Failed:       ${result.failed}`,
            `Web passed:   ${result.webPassed}`,
            `Web failed:   ${result.webFailed}`,
            '',
            ...result.issues.map(i => `ISSUE: ${i}`),
            '',
            result.failed === 0 && result.webFailed === 0 ? 'RESULT: PASS' : 'RESULT: FAIL',
        ];
        fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
        (0, log_1.log)(null, result.failed === 0 ? 'info' : 'error', `Verification: ${result.passed}/${result.total} passed — ${reportPath}`);
        if (result.failed > 0 || result.webFailed > 0)
            process.exit(1);
    }
    finally {
        await (0, db_1.disconnectPrisma)();
    }
}
if (require.main === module) {
    runVerify().catch(err => { console.error(err); process.exit(1); });
}
