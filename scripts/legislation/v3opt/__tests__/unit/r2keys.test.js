"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const r2keys_1 = require("../../src/r2keys");
(0, vitest_1.describe)('getR2KeyForSection', () => {
    (0, vitest_1.it)('revised-current uses tna.xml extension and tnaXmlKey field', () => {
        const r = (0, r2keys_1.getR2KeyForSection)('uksi/2021/100', '3', 'revised-current');
        (0, vitest_1.expect)(r.key).toBe('uksi/2021/100/sections/3.tna.xml');
        (0, vitest_1.expect)(r.field).toBe('tnaXmlKey');
    });
    (0, vitest_1.it)('made uses original.xml extension and originalXmlKey field', () => {
        const r = (0, r2keys_1.getR2KeyForSection)('uksi/2021/100', '3', 'made');
        (0, vitest_1.expect)(r.key).toBe('uksi/2021/100/sections/3.original.xml');
        (0, vitest_1.expect)(r.field).toBe('originalXmlKey');
    });
    (0, vitest_1.it)('handles alphanumeric section numbers', () => {
        const r = (0, r2keys_1.getR2KeyForSection)('uksi/2015/399', '13E', 'made');
        (0, vitest_1.expect)(r.key).toBe('uksi/2015/399/sections/13E.original.xml');
    });
    (0, vitest_1.it)('actId with slashes is used verbatim in key path', () => {
        const r = (0, r2keys_1.getR2KeyForSection)('uksi/1990/1234', '1', 'revised-current');
        (0, vitest_1.expect)(r.key).toContain('uksi/1990/1234/');
    });
});
(0, vitest_1.describe)('decodeEntities', () => {
    (0, vitest_1.it)('decodes &amp;', () => (0, vitest_1.expect)((0, r2keys_1.decodeEntities)('a &amp; b')).toBe('a & b'));
    (0, vitest_1.it)('decodes &lt; and &gt;', () => (0, vitest_1.expect)((0, r2keys_1.decodeEntities)('&lt;tag&gt;')).toBe('<tag>'));
    (0, vitest_1.it)('decodes &quot;', () => (0, vitest_1.expect)((0, r2keys_1.decodeEntities)('&quot;word&quot;')).toBe('"word"'));
    (0, vitest_1.it)('decodes &apos;', () => (0, vitest_1.expect)((0, r2keys_1.decodeEntities)('it&apos;s')).toBe("it's"));
    (0, vitest_1.it)('decodes decimal numeric entity (£ = &#163;)', () => (0, vitest_1.expect)((0, r2keys_1.decodeEntities)('&#163;')).toBe('£'));
    (0, vitest_1.it)('decodes hex numeric entity (£ = &#x00A3;)', () => (0, vitest_1.expect)((0, r2keys_1.decodeEntities)('&#x00A3;')).toBe('£'));
    (0, vitest_1.it)('decodes &#8220; (left double quote)', () => (0, vitest_1.expect)((0, r2keys_1.decodeEntities)('&#8220;')).toBe('“'));
    (0, vitest_1.it)('leaves plain ASCII unchanged', () => (0, vitest_1.expect)((0, r2keys_1.decodeEntities)('plain text 123')).toBe('plain text 123'));
    (0, vitest_1.it)('leaves existing Unicode unchanged', () => (0, vitest_1.expect)((0, r2keys_1.decodeEntities)('café')).toBe('café'));
});
