"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = log;
function log(workerId, level, msg, meta) {
    const prefix = workerId !== null ? `[W${workerId}]` : '[MAIN]';
    const ts = new Date().toISOString();
    const line = meta
        ? `${ts} ${prefix} ${level.toUpperCase()} ${msg} ${JSON.stringify(meta)}`
        : `${ts} ${prefix} ${level.toUpperCase()} ${msg}`;
    if (level === 'error')
        console.error(line);
    else
        console.log(line);
}
