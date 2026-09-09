/**
 * probe-edm-signatures.ts — BRIEF_INGEST_EDM_SIGNATURES §1: find the endpoint, read its shape.
 *
 * ⚠ READ-ONLY. Nothing is written to any database. §1 is a gate: if the source carries no date
 * signed or no member id, the brief says this is a different sprint, and that verdict has to be
 * reached from bytes rather than from what the API "ought" to expose.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/probe-edm-signatures.ts
 */
export {}

const BASE = 'https://oralquestionsandmotions-api.parliament.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'

const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)

async function tryUrl(url: string): Promise<{ status: number; body: any | string | null; ms: number }> {
  const t0 = Date.now()
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
    const ms = Date.now() - t0
    const text = await res.text()
    let body: any = text
    try { body = JSON.parse(text) } catch { /* not json */ }
    return { status: res.status, body, ms }
  } catch (e) {
    return { status: -1, body: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 }
  }
}

/** Print the key set of an object, and for arrays the key set of the first element. */
function shape(v: any, indent = '    '): string[] {
  if (v == null) return [`${indent}(null)`]
  if (Array.isArray(v)) {
    if (!v.length) return [`${indent}[] (empty array)`]
    return [`${indent}array of ${v.length}, first element:`, ...shape(v[0], indent + '  ')]
  }
  if (typeof v !== 'object') return [`${indent}${typeof v}: ${JSON.stringify(v).slice(0, 120)}`]
  const out: string[] = []
  for (const [k, val] of Object.entries(v)) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      out.push(`${indent}${k}:`)
      out.push(...shape(val, indent + '  '))
    } else if (Array.isArray(val)) {
      out.push(`${indent}${k}: array[${val.length}]`)
      if (val.length) out.push(...shape(val[0], indent + '  '))
    } else {
      out.push(`${indent}${k} = ${JSON.stringify(val)}`)
    }
  }
  return out
}

async function main() {
  head('§1.0 IS THERE A PUBLISHED SPEC?')
  for (const p of ['/swagger/v1/swagger.json', '/swagger/index.html', '/index.html', '/']) {
    const r = await tryUrl(BASE + p)
    console.log(`   ${String(r.status).padStart(4)}  ${r.ms}ms  ${p}`)
    if (r.status === 200 && typeof r.body === 'object' && r.body?.paths) {
      console.log(`   ✅ swagger found. paths:`)
      for (const k of Object.keys(r.body.paths)) console.log(`      ${k}  [${Object.keys(r.body.paths[k]).join(',')}]`)
    }
  }

  head('§1.1 A REAL MOTION WITH MANY SIGNATORIES')
  // Take the list endpoint the existing sweep already uses, and pick a motion with a high
  // SponsorsCount so a signatory endpoint has something to show.
  const list = await tryUrl(`${BASE}/EarlyDayMotions/list?parameters.take=20&parameters.skip=0&parameters.orderBy=SponsorsCount`)
  if (list.status !== 200 || typeof list.body !== 'object') {
    console.error(`   ❌ list endpoint returned ${list.status}: ${String(list.body).slice(0, 300)}`)
    process.exit(1)
  }
  const items: any[] = list.body.Response ?? []
  console.log(`   PagingInfo: ${JSON.stringify(list.body.PagingInfo)}`)
  console.log(`   ${items.length} items back. Top by SponsorsCount as returned:`)
  for (const r of items.slice(0, 5)) {
    console.log(`      id=${r.Id} uin=${r.UIN} sponsors=${r.SponsorsCount} tabled=${String(r.DateTabled).slice(0, 10)}  "${String(r.Title).slice(0, 50)}"`)
  }

  head('§1.1b THE FULL LIST-ITEM SHAPE (one item, every field)')
  if (items.length) for (const line of shape(items[0])) console.log(line)

  // Pick the highest-signature motion we can see, and also a small one.
  const sorted = [...items].sort((a, b) => (b.SponsorsCount ?? 0) - (a.SponsorsCount ?? 0))
  const big = sorted[0]
  const candidates = [big?.Id].filter((x) => x != null)

  head('§1.2 CANDIDATE SIGNATORY ROUTES')
  const id = candidates[0]
  const paths = [
    `/EarlyDayMotion/${id}`,
    `/EarlyDayMotions/${id}`,
    `/EarlyDayMotion/EarlyDayMotion?id=${id}`,
    `/EarlyDayMotions/EarlyDayMotion?id=${id}`,
    `/EarlyDayMotions/list?parameters.take=1&parameters.skip=0&parameters.motionId=${id}`,
    `/EarlyDayMotions/${id}/Sponsors`,
    `/EarlyDayMotions/sponsors?motionId=${id}`,
    `/Sponsors/${id}`,
  ]
  const winners: string[] = []
  for (const p of paths) {
    const r = await tryUrl(BASE + p)
    const kind = typeof r.body === 'object' && r.body !== null ? (Array.isArray(r.body) ? `array[${r.body.length}]` : Object.keys(r.body).slice(0, 8).join(',')) : String(r.body).slice(0, 60)
    console.log(`   ${String(r.status).padStart(4)}  ${r.ms}ms  ${p}\n         → ${kind}`)
    if (r.status === 200 && typeof r.body === 'object') winners.push(p)
    await new Promise((res) => setTimeout(res, 300))
  }

  head('§1.3 THE DETAIL SHAPE, IN FULL')
  for (const p of winners.slice(0, 3)) {
    console.log(`\n   ── ${p} ──`)
    const r = await tryUrl(BASE + p)
    const b = r.body
    const inner = b?.Response ?? b
    for (const line of shape(inner)) console.log(line)
    // If there is an array of sponsors anywhere, print three of them raw.
    const findArr = (o: any, depth = 0): any[] | null => {
      if (depth > 3 || o == null || typeof o !== 'object') return null
      for (const [k, v] of Object.entries(o)) {
        if (Array.isArray(v) && v.length && typeof v[0] === 'object' && /sponsor|signator|member/i.test(k)) {
          console.log(`\n   RAW first 3 of ${k}:`)
          console.log(JSON.stringify(v.slice(0, 3), null, 2))
          return v
        }
      }
      for (const v of Object.values(o)) { const f = findArr(v, depth + 1); if (f) return f }
      return null
    }
    findArr(inner)
  }
}

main().catch((e) => { console.error('[probe-edm-signatures] FATAL', e instanceof Error ? e.stack : e); process.exit(1) })
