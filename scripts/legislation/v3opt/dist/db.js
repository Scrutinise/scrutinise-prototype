"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrisma = getPrisma;
exports.disconnectPrisma = disconnectPrisma;
// dotenv is loaded by the entry-point before this module's init runs.
// We rely on the shell env (DATABASE_URL, PGSCHEMA) being correct at that point.
/* eslint-disable no-eval */
const { PrismaPg: _PP } = eval('require')('../../../../scrutinise-web/node_modules/@prisma/adapter-pg');
const { PrismaClient: _PC } = eval('require')('../../../../scrutinise-web/node_modules/@prisma/client');
// PGSCHEMA: when set, Prisma schema-qualifies all table names and type casts.
// Requires setup-test-schema.js to have been run so enum types exist in that schema.
// Leave unset for production (public schema, default).
const _schema = process.env.PGSCHEMA || undefined;
let _prisma = null;
function getPrisma() {
    if (!_prisma) {
        const adapterOptions = _schema ? { schema: _schema } : undefined;
        const adapter = new _PP({ connectionString: process.env.DATABASE_URL }, adapterOptions);
        _prisma = new _PC({ adapter });
    }
    return _prisma;
}
async function disconnectPrisma() {
    if (_prisma) {
        await _prisma.$disconnect();
        _prisma = null;
    }
}
