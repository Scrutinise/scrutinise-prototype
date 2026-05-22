"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const parseActId_1 = require("../../src/parseActId");
(0, vitest_1.describe)('parseActId', () => {
    (0, vitest_1.it)('parses a normal UKSI actId', () => {
        (0, vitest_1.expect)((0, parseActId_1.parseActId)('uksi/2021/100')).toEqual({ yearStr: '2021', yearInt: 2021, num: 100 });
    });
    (0, vitest_1.it)('parses year 1990', () => {
        const r = (0, parseActId_1.parseActId)('uksi/1990/500');
        (0, vitest_1.expect)(r.yearInt).toBe(1990);
        (0, vitest_1.expect)(r.yearStr).toBe('1990');
        (0, vitest_1.expect)(r.num).toBe(500);
    });
    (0, vitest_1.it)('accepts num at Int32 max (2147483647)', () => {
        (0, vitest_1.expect)(() => (0, parseActId_1.parseActId)('uksi/2021/2147483647')).not.toThrow();
        (0, vitest_1.expect)((0, parseActId_1.parseActId)('uksi/2021/2147483647').num).toBe(2147483647);
    });
    (0, vitest_1.it)('throws IsbnDraftError for num one above Int32 max', () => {
        (0, vitest_1.expect)(() => (0, parseActId_1.parseActId)('uksi/2021/2147483648')).toThrow(parseActId_1.IsbnDraftError);
    });
    (0, vitest_1.it)('throws IsbnDraftError for 13-digit ISBN numbers', () => {
        (0, vitest_1.expect)(() => (0, parseActId_1.parseActId)('uksi/2021/9781234567890')).toThrow(parseActId_1.IsbnDraftError);
    });
    (0, vitest_1.it)('IsbnDraftError is an Error instance', () => {
        try {
            (0, parseActId_1.parseActId)('uksi/2021/9780000000000');
        }
        catch (e) {
            (0, vitest_1.expect)(e).toBeInstanceOf(Error);
        }
    });
    (0, vitest_1.it)('throws generic Error for non-numeric year', () => {
        (0, vitest_1.expect)(() => (0, parseActId_1.parseActId)('uksi/notanumber/1')).toThrow(Error);
    });
    (0, vitest_1.it)('throws for missing segments', () => {
        (0, vitest_1.expect)(() => (0, parseActId_1.parseActId)('uksi/2021')).toThrow();
        (0, vitest_1.expect)(() => (0, parseActId_1.parseActId)('bad')).toThrow();
    });
});
