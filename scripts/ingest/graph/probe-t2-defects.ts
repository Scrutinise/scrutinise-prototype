/** probe-t2-defects.ts — chase three things in the T2 output that look wrong. */
import { readDoc, flattenClml, provisionSlice, actNameRegex, closeZip } from './report-common'

// 1. the "(c." boundary — is "Constitutional Reform and Governance Act 2010 (c." a sentence?
const a = readDoc('ukpga/2013/25')!
const s1 = provisionSlice(a, 'schedule-11-paragraph-7')!
const f1 = flattenClml(s1)
const ix = f1.search(/Constitutional Reform and Governance Act/i)
console.log('=== 1. the "(c." split ===')
console.log('  context:', JSON.stringify(f1.slice(Math.max(0, ix - 200), ix + 200)))

// 2. the missing opening quotation mark
const b = readDoc('ukpga/2007/16')!
const s2 = provisionSlice(b, 'section-3')!
const f2 = flattenClml(s2)
const jx = f2.search(/statutory home civil service/i)
console.log('\n=== 2. the missing opening quote ===')
console.log('  flattened:', JSON.stringify(f2.slice(Math.max(0, jx - 160), jx + 160)))
console.log('  raw XML  :', JSON.stringify(s2.slice(Math.max(0, s2.search(/statutory home civil service/i) - 320), s2.search(/statutory home civil service/i) + 60)))

// 3. uksi/2005/384 — the fragment names the HRA; does the zip copy?
console.log('\n=== 3. uksi/2005/384 — does the local copy name the Human Rights Act? ===')
const c = readDoc('uksi/2005/384')
console.log('  in zip:', c != null, 'bytes:', c?.length ?? 0)
if (c) {
  const rx = actNameRegex('Human Rights Act 1998')
  console.log('  names it:', rx.test(c), '| names it after flatten:', rx.test(flattenClml(c)))
  console.log('  "Human Rights" anywhere:', /Human\s+Rights/i.test(c))
  console.log('  has rule-68.27:', c.includes('id="rule-68.27"'))
  const m = c.match(/<(Title|DocumentMainType|DocumentClassification)[\s\S]{0,300}?>/)
  console.log('  head:', JSON.stringify(c.slice(0, 400)))
  const t = c.match(/<dc:title>([\s\S]*?)<\/dc:title>/) ?? c.match(/<Title>([\s\S]*?)<\/Title>/)
  console.log('  title:', t ? t[1].slice(0, 160) : 'none')
  console.log('  NumberOfProvisions:', c.match(/NumberOfProvisions="(\d+)"/)?.[1] ?? 'none')
}
closeZip()
