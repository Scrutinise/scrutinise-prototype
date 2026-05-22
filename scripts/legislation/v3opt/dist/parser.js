"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseItem = parseItem;
exports.extractTitle = extractTitle;
exports.extractSections = extractSections;
const fast_xml_parser_1 = require("fast-xml-parser");
// parseTagValue: false — keep all tag content as strings; prevents "3." being parsed as number 3
const pnParser = new fast_xml_parser_1.XMLParser({ ignoreAttributes: true, parseTagValue: false });
function parseItem(xmlStr) {
    return {
        title: extractTitle(xmlStr),
        sections: extractSections(xmlStr),
    };
}
function extractTitle(xmlStr) {
    const dcMatch = xmlStr.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/);
    if (dcMatch)
        return stripTags(dcMatch[1]).trim();
    const titleMatch = xmlStr.match(/<Title[^>]*>([\s\S]*?)<\/Title>/);
    if (titleMatch)
        return stripTags(titleMatch[1]).trim();
    return '';
}
function extractSections(xmlStr) {
    const p1groupMatches = [...xmlStr.matchAll(/<P1group[\s\S]*?<\/P1group>/g)];
    if (p1groupMatches.length > 0) {
        return p1groupMatches.map(m => ({ sectionNumber: extractPnumber(m[0]), xml: m[0] }));
    }
    return [...xmlStr.matchAll(/<P1\b[\s\S]*?<\/P1>/g)].map(m => ({
        sectionNumber: extractPnumber(m[0]),
        xml: m[0],
    }));
}
function extractPnumber(sectionXml) {
    const match = sectionXml.match(/<Pnumber[^>]*>([\s\S]*?)<\/Pnumber>/);
    if (!match)
        return '';
    try {
        const parsed = pnParser.parse(`<root>${match[0]}</root>`);
        const pnum = parsed?.root?.Pnumber;
        if (pnum !== undefined && pnum !== null)
            return stripTags(String(pnum)).trim();
    }
    catch { }
    return stripTags(match[1]).trim();
}
function stripTags(str) {
    return str.replace(/<[^>]+>/g, '');
}
