"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getR2KeyForSection = getR2KeyForSection;
exports.decodeEntities = decodeEntities;
function getR2KeyForSection(actId, sectionNumber, version) {
    if (version === 'revised-current') {
        return { key: `${actId}/sections/${sectionNumber}.tna.xml`, field: 'tnaXmlKey' };
    }
    return { key: `${actId}/sections/${sectionNumber}.original.xml`, field: 'originalXmlKey' };
}
function decodeEntities(str) {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
