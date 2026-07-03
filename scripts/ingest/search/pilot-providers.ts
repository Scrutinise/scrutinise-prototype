/**
 * pilot-providers.ts — model-agnostic embedding providers for the vector pilot.
 *
 * The whole pilot is one bake-off across three candidate embedding models. This
 * module is the ONLY place any of them is called; everything downstream (embed,
 * index, score) is written against the `Provider` interface so a model is added
 * or swapped by editing this file alone.
 *
 * Candidates (brief):
 *   - voyage-4          (Voyage API, VOYAGE_API_KEY)      — legal/domain front-runner
 *   - gemini-embedding-001 (Gemini API, GEMINI_API_KEY)  — best general model
 *   - BGE-M3            (Together AI, TOGETHER_API_KEY)   — open-weight datapoint
 *
 * All three are searched with COSINE distance downstream, so vectors are stored
 * raw (no manual L2-normalisation needed — cosine handles magnitude). Chunks are
 * ≤ ~1024 tokens by construction, comfortably under every model's input cap
 * (gemini-embedding-001 = 2048 tok, BGE-M3 = 8192, Voyage = 32k).
 *
 * Self-test:  tsx search/pilot-providers.ts --selftest
 */

export type EmbedKind = 'document' | 'query'

export interface Provider {
  /** short slug used in Lance table names (pilot_vec_<slug>) and reports */
  slug: string
  /** the concrete model id sent to the API */
  model: string
  /** embedding dimensionality (fixed-size vector column width) */
  dims: number
  /** provider is usable (its API key is present) */
  enabled: boolean
  /** why it is disabled, for the report (empty when enabled) */
  disabledReason: string
  /** max texts per API request */
  batchSize: number
  /** embed a batch of texts; returns one vector per input, IN INPUT ORDER */
  embed(texts: string[], kind: EmbedKind): Promise<number[][]>
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** POST JSON with retry over 429 / 5xx (transient), throwing on 4xx (deterministic). */
async function postJson(url: string, headers: Record<string, string>, body: unknown, tries = 6): Promise<any> {
  let lastErr: any
  for (let i = 0; i < tries; i++) {
    let res: Response
    try {
      res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
    } catch (e) {
      lastErr = e; await sleep(1500 * (i + 1)); continue // network blip
    }
    if (res.ok) return res.json()
    const text = await res.text().catch(() => '')
    // 429 / 5xx are transient → back off and retry. Other 4xx are deterministic.
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
      // honour Retry-After when present
      const ra = parseInt(res.headers.get('retry-after') ?? '', 10)
      await sleep(Number.isFinite(ra) ? ra * 1000 : Math.min(2000 * 2 ** i, 30_000))
      continue
    }
    throw new Error(`HTTP ${res.status} (non-retryable): ${text.slice(0, 500)}`)
  }
  throw lastErr ?? new Error('postJson: exhausted retries')
}

// ── Gemini gemini-embedding-001 ──────────────────────────────────────────────
// REST batchEmbedContents. taskType RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY (the
// asymmetric retrieval pair). outputDimensionality is truncated-MRL; cosine
// downstream tolerates the un-normalised sub-3072 output.
const GEMINI_DIMS = parseInt(process.env.PILOT_GEMINI_DIMS ?? '1536', 10)
function geminiProvider(): Provider {
  const key = process.env.GEMINI_API_KEY
  const model = process.env.PILOT_GEMINI_MODEL ?? 'gemini-embedding-001'
  return {
    slug: 'gemini', model, dims: GEMINI_DIMS,
    enabled: !!key, disabledReason: key ? '' : 'GEMINI_API_KEY not set',
    batchSize: parseInt(process.env.PILOT_GEMINI_BATCH ?? '50', 10),
    async embed(texts, kind) {
      const taskType = kind === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT'
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${key}`
      const requests = texts.map((t) => ({
        model: `models/${model}`,
        content: { parts: [{ text: t }] },
        taskType,
        outputDimensionality: GEMINI_DIMS,
      }))
      const json = await postJson(url, {}, { requests })
      const embs = (json.embeddings ?? []).map((e: any) => e.values as number[])
      if (embs.length !== texts.length) throw new Error(`gemini: expected ${texts.length} embeddings, got ${embs.length}`)
      return embs
    },
  }
}

// ── Together open-weight datapoint (E5-large-instruct) ───────────────────────
// SUBSTITUTION CHAIN (all forced by Together's serverless catalogue, 2026-07-03):
//   brief asked BGE-M3        → Together DELISTED bge-m3 (404 model_not_available)
//   → tried bge-base-en-v1.5  → non-serverless (needs a paid dedicated endpoint)
//   → tried bge-large / m2-bert → same non-serverless wall
//   → intfloat/multilingual-e5-large-instruct is the ONLY serverless open-weight
//     embedding model Together serves (200, 1024d). It's a strong open-weight,
//     self-hostable retriever (MIT) — so it IS the "free/self-host economics at
//     ~zero cost" datapoint the brief wanted, just a different open model.
// Env-overridable (PILOT_E5_MODEL/_DIMS) so a self-hosted bge-m3 endpoint slots in.
//
// E5-*-instruct is asymmetric: QUERIES get the "Instruct: {task}\nQuery: {q}"
// template, DOCUMENTS are passed raw. Getting this wrong handicaps the model, so
// it's a correctness detail (the model card's documented usage).
const E5_DIMS = parseInt(process.env.PILOT_E5_DIMS ?? '1024', 10)
const E5_TASK = process.env.PILOT_E5_TASK
  ?? 'Given a web search query, retrieve relevant passages that answer the query'
// Together serves e5-large-instruct with a 512-TOKEN context cap (not 8192). Our
// chunks run to ~1024 tokens, so E5 docs are truncated to fit — a documented, FAIR
// handicap: a 512-token window IS a real property of this cheap open model (voyage
// 32k / gemini 2048 embed the full chunk). Dense legal/citation text tokenises at
// ~2 chars/token (a 1400-char input measured 713 tokens), so cap at 800 chars ≈ 400
// tokens to stay safely under 512 even on citation-heavy rows.
const E5_MAX_CHARS = parseInt(process.env.PILOT_E5_MAX_CHARS ?? '700', 10)
function e5Provider(): Provider {
  const key = process.env.TOGETHER_API_KEY
  const model = process.env.PILOT_E5_MODEL ?? 'intfloat/multilingual-e5-large-instruct'
  return {
    slug: 'e5', model, dims: E5_DIMS,
    enabled: !!key, disabledReason: key ? '' : 'TOGETHER_API_KEY not set',
    batchSize: parseInt(process.env.PILOT_E5_BATCH ?? '100', 10),
    async embed(texts, kind) {
      // Dense legal/citation text tokenises as densely as ~1.1 char/token, so a fixed
      // char cap can't guarantee < 512 tokens. Shrink the cap and retry on any
      // context-length 400 (down to a floor) so one pathological row can't kill the run.
      let cap = E5_MAX_CHARS
      for (let attempt = 0; ; attempt++) {
        const capped = texts.map((t) => (t.length > cap ? t.slice(0, cap) : t))
        const input = kind === 'query' ? capped.map((t) => `Instruct: ${E5_TASK}\nQuery: ${t}`) : capped
        try {
          const json = await postJson('https://api.together.xyz/v1/embeddings',
            { authorization: `Bearer ${key}` }, { model, input })
          const data = (json.data ?? []) as { embedding: number[]; index: number }[]
          if (data.length !== texts.length) throw new Error(`e5: expected ${texts.length} embeddings, got ${data.length}`)
          const out: number[][] = new Array(texts.length)
          for (const d of data) out[d.index] = d.embedding
          return out
        } catch (e) {
          if (/maximum context length/i.test((e as Error).message) && cap > 250 && attempt < 5) { cap = Math.floor(cap * 0.6); continue }
          throw e
        }
      }
    },
  }
}

// ── Voyage voyage-4 ──────────────────────────────────────────────────────────
// input_type document/query (Voyage's asymmetric retrieval pair). Model id is
// env-overridable so Charlie can point it at the exact SKU the key serves
// (voyage-4 / voyage-3-large / voyage-law-2) without a code change.
const VOYAGE_DIMS = parseInt(process.env.PILOT_VOYAGE_DIMS ?? '1024', 10)
function voyageProvider(): Provider {
  const key = process.env.VOYAGE_API_KEY
  const model = process.env.PILOT_VOYAGE_MODEL ?? 'voyage-4'
  return {
    slug: 'voyage', model, dims: VOYAGE_DIMS,
    enabled: !!key, disabledReason: key ? '' : 'VOYAGE_API_KEY not set',
    batchSize: parseInt(process.env.PILOT_VOYAGE_BATCH ?? '100', 10),
    async embed(texts, kind) {
      const json = await postJson('https://api.voyageai.com/v1/embeddings',
        { authorization: `Bearer ${key}` },
        { input: texts, model, input_type: kind, output_dimension: VOYAGE_DIMS })
      const data = (json.data ?? []) as { embedding: number[]; index: number }[]
      if (data.length !== texts.length) throw new Error(`voyage: expected ${texts.length} embeddings, got ${data.length}`)
      const out: number[][] = new Array(texts.length)
      for (const d of data) out[d.index] = d.embedding
      return out
    },
  }
}

export function allProviders(): Provider[] {
  return [voyageProvider(), geminiProvider(), e5Provider()]
}

export function enabledProviders(): Provider[] {
  return allProviders().filter((p) => p.enabled)
}

export function providerBySlug(slug: string): Provider {
  const p = allProviders().find((x) => x.slug === slug)
  if (!p) throw new Error(`unknown provider slug '${slug}' (have: ${allProviders().map((x) => x.slug).join(', ')})`)
  return p
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}

// ── self-test ────────────────────────────────────────────────────────────────
async function selftest() {
  require('dotenv').config({ path: require('path').join(__dirname, '../../../scrutinise-web/.env') })
  const docs = [
    'Section 21 of the Housing Act 1988 allows a landlord to recover possession of an assured shorthold tenancy without giving a reason.',
    'The Theft Act 1968 defines theft as dishonestly appropriating property belonging to another with intent to permanently deprive.',
  ]
  const query = 'Can my landlord evict me without a reason?'
  console.log('providers:', allProviders().map((p) => `${p.slug}(${p.enabled ? 'ON ' + p.dims + 'd' : 'off: ' + p.disabledReason})`).join('  '))
  for (const p of enabledProviders()) {
    try {
      const de = await p.embed(docs, 'document')
      const qe = await p.embed([query], 'query')
      const simEvict = cosine(qe[0], de[0]) // query vs the eviction doc (should be higher)
      const simTheft = cosine(qe[0], de[1]) // query vs the theft doc (should be lower)
      const ok = de.length === 2 && de[0].length === p.dims && qe[0].length === p.dims && simEvict > simTheft
      console.log(`  ${p.slug} ${p.model}: dims=${de[0].length} sim(evict)=${simEvict.toFixed(3)} sim(theft)=${simTheft.toFixed(3)} → ${ok ? 'PASS' : 'CHECK'}`)
    } catch (e) {
      console.log(`  ${p.slug} ${p.model}: ERROR ${(e as Error).message}`)
    }
  }
}

if (process.argv.includes('--selftest')) selftest().catch((e) => { console.error('FATAL', e); process.exit(1) })
