"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.r2 = exports.R2_BUCKET = void 0;
exports.batchR2Put = batchR2Put;
exports.r2KeyExists = r2KeyExists;
const runtime_deps_1 = require("./runtime-deps");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../../scrutinise-web/.env') });
exports.R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation';
exports.r2 = new runtime_deps_1.S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
});
async function batchR2Put(items) {
    const results = await Promise.allSettled(items.map(item => exports.r2.send(new runtime_deps_1.PutObjectCommand({
        Bucket: exports.R2_BUCKET,
        Key: item.key,
        Body: Buffer.from(item.content, 'utf8'),
        ContentType: item.contentType,
    }))));
    const succeeded = [];
    const failed = [];
    results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            succeeded.push(items[i]);
        }
        else {
            failed.push({ item: items[i], error: result.reason?.message ?? String(result.reason) });
        }
    });
    return { succeeded, failed };
}
async function r2KeyExists(key) {
    try {
        const res = await exports.r2.send(new runtime_deps_1.GetObjectCommand({ Bucket: exports.R2_BUCKET, Key: key }));
        const body = await res.Body?.transformToString('utf8');
        return !!body && body.length > 0;
    }
    catch {
        return false;
    }
}
