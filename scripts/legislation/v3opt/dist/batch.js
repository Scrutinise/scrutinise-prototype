"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchBuffer = void 0;
class BatchBuffer {
    constructor(maxSize, flushFn) {
        this.maxSize = maxSize;
        this.flushFn = flushFn;
        this.buffer = [];
    }
    async add(item) {
        this.buffer.push(item);
        if (this.buffer.length >= this.maxSize) {
            return this.drain();
        }
        return null;
    }
    async drain() {
        if (this.buffer.length === 0)
            return null;
        const items = this.buffer.splice(0);
        return this.flushFn(items);
    }
    get size() {
        return this.buffer.length;
    }
}
exports.BatchBuffer = BatchBuffer;
