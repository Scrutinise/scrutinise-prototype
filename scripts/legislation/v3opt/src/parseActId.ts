export interface ParsedActId {
  yearStr: string
  yearInt: number
  num: number
}

export class IsbnDraftError extends Error {
  constructor(actId: string) {
    super(`ISBN_DRAFT: ${actId}`)
    this.name = 'IsbnDraftError'
  }
}

// Int32 max — numbers above this are 13-digit ISBN pre-publication drafts superseded by
// properly numbered SIs already ingested in V.3-B.
const INT32_MAX = 2_147_483_647

export function parseActId(actId: string): ParsedActId {
  const parts = actId.split('/')
  const yearStr = parts[1]
  const yearInt = parseInt(yearStr, 10)
  const numStr = parts[2]
  const num = parseInt(numStr, 10)
  if (isNaN(yearInt) || isNaN(num)) throw new Error(`Cannot parse actId: ${actId}`)
  if (num > INT32_MAX) throw new IsbnDraftError(actId)
  return { yearStr, yearInt, num }
}
