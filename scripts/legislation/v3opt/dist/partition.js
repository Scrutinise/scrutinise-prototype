"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.partition = partition;
function partition(entries, n) {
    const parts = Array.from({ length: n }, () => []);
    entries.forEach((entry, i) => parts[i % n].push(entry));
    return parts;
}
