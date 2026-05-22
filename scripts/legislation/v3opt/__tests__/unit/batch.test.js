"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const batch_1 = require("../../src/batch");
function makeFlush(results) {
    return vitest_1.vi.fn((items) => Promise.resolve({
        succeeded: results?.succeeded ?? items,
        failed: results?.failed ?? [],
    }));
}
(0, vitest_1.describe)('BatchBuffer', () => {
    (0, vitest_1.it)('accumulates items without flushing below maxSize', async () => {
        const flush = makeFlush();
        const buf = new batch_1.BatchBuffer(3, flush);
        await buf.add('a');
        await buf.add('b');
        (0, vitest_1.expect)(buf.size).toBe(2);
        (0, vitest_1.expect)(flush).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('flushes exactly when maxSize is reached', async () => {
        const flushed = [];
        const flush = vitest_1.vi.fn((items) => {
            flushed.push([...items]);
            return Promise.resolve({ succeeded: items, failed: [] });
        });
        const buf = new batch_1.BatchBuffer(3, flush);
        await buf.add('a');
        await buf.add('b');
        const result = await buf.add('c');
        (0, vitest_1.expect)(flush).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(flushed[0]).toEqual(['a', 'b', 'c']);
        (0, vitest_1.expect)(buf.size).toBe(0);
        (0, vitest_1.expect)(result?.succeeded).toEqual(['a', 'b', 'c']);
    });
    (0, vitest_1.it)('returns null when add does not trigger flush', async () => {
        const buf = new batch_1.BatchBuffer(50, makeFlush());
        const result = await buf.add('x');
        (0, vitest_1.expect)(result).toBeNull();
    });
    (0, vitest_1.it)('drain flushes remaining items', async () => {
        const flush = makeFlush();
        const buf = new batch_1.BatchBuffer(50, flush);
        await buf.add('x');
        await buf.add('y');
        const result = await buf.drain();
        (0, vitest_1.expect)(flush).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(result?.succeeded).toEqual(['x', 'y']);
        (0, vitest_1.expect)(buf.size).toBe(0);
    });
    (0, vitest_1.it)('drain on empty buffer returns null without calling flushFn', async () => {
        const flush = vitest_1.vi.fn();
        const buf = new batch_1.BatchBuffer(50, flush);
        const result = await buf.drain();
        (0, vitest_1.expect)(result).toBeNull();
        (0, vitest_1.expect)(flush).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('drain clears buffer so second drain is a no-op', async () => {
        const flush = makeFlush();
        const buf = new batch_1.BatchBuffer(50, flush);
        await buf.add('x');
        await buf.drain();
        const second = await buf.drain();
        (0, vitest_1.expect)(second).toBeNull();
        (0, vitest_1.expect)(flush).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)('exposes failed items from flushFn result', async () => {
        const flush = vitest_1.vi.fn((items) => Promise.resolve({
            succeeded: [items[0]],
            failed: [{ item: items[1], error: 'network timeout' }],
        }));
        const buf = new batch_1.BatchBuffer(2, flush);
        await buf.add('ok');
        const result = await buf.add('bad');
        (0, vitest_1.expect)(result?.failed).toHaveLength(1);
        (0, vitest_1.expect)(result?.failed[0]).toEqual({ item: 'bad', error: 'network timeout' });
    });
    (0, vitest_1.it)('second batch starts fresh after first flush', async () => {
        const flushed = [];
        const flush = vitest_1.vi.fn((items) => {
            flushed.push([...items]);
            return Promise.resolve({ succeeded: items, failed: [] });
        });
        const buf = new batch_1.BatchBuffer(2, flush);
        await buf.add('a');
        await buf.add('b'); // flush 1
        await buf.add('c');
        await buf.add('d'); // flush 2
        (0, vitest_1.expect)(flush).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(flushed[0]).toEqual(['a', 'b']);
        (0, vitest_1.expect)(flushed[1]).toEqual(['c', 'd']);
    });
});
