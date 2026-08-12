import { GOLD } from './search/gold-queries'
const g = GOLD as any[]
console.log('total GOLD:', g.length, '| recall@20:', g.filter(x=>x.metric==='recall@20').length,
  '| recall@20 & scoreable:', g.filter(x=>x.metric==='recall@20'&&x.scoreable).length)
console.log('keys:', Object.keys(g[0]).join(', '))
const src = (x:any) => (x.expected??[]).map((e:any)=>`${e.label} ${e.patterns.map((p:any)=>p.source).join(' ')}`).join(' | ')
const cl = g.filter(x=>/EWCA|EWHC|UKSC|UKHL|tna-caselaw|\\[\d{4}\\]/i.test(src(x)))
console.log('\nqueries whose ANSWER KEY contains a caselaw-shaped source:', cl.length)
for (const x of cl) console.log(`  ${x.id} [${x.archetype}] ${x.query.slice(0,70)}`)
console.log('\nstreams declared:', JSON.stringify(g.reduce((a:any,x:any)=>{a[x.stream??'?']=(a[x.stream??'?']||0)+1;return a},{})))
