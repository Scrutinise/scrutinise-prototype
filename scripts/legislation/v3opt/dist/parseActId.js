"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsbnDraftError = void 0;
exports.parseActId = parseActId;
class IsbnDraftError extends Error {
    constructor(actId) {
        super(`ISBN_DRAFT: ${actId}`);
        this.name = 'IsbnDraftError';
    }
}
exports.IsbnDraftError = IsbnDraftError;
// Int32 max — numbers above this are 13-digit ISBN pre-publication drafts superseded by
// properly numbered SIs already ingested in V.3-B.
const INT32_MAX = 2147483647;
function parseActId(actId) {
    const parts = actId.split('/');
    const yearStr = parts[1];
    const yearInt = parseInt(yearStr, 10);
    const numStr = parts[2];
    const num = parseInt(numStr, 10);
    if (isNaN(yearInt) || isNaN(num))
        throw new Error(`Cannot parse actId: ${actId}`);
    if (num > INT32_MAX)
        throw new IsbnDraftError(actId);
    return { yearStr, yearInt, num };
}
