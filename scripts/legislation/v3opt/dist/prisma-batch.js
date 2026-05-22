"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchDbCreate = batchDbCreate;
const runtime_deps_1 = require("./runtime-deps");
const db_1 = require("./db");
// Uses createMany + skipDuplicates so resume after a crash is idempotent.
// The unique constraint (legislationItemId, sectionNumber) ensures existing rows
// are silently skipped on duplicate; no partial-write risk.
async function batchDbCreate(records) {
    if (records.length === 0)
        return 0;
    const result = await (0, db_1.getPrisma)().legislationSection.createMany({
        data: records.map(r => ({
            ...r,
            compilationStatus: runtime_deps_1.CompilationStatus.PENDING,
        })),
        skipDuplicates: true,
    });
    return result.count;
}
