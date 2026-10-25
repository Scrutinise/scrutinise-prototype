import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })

async function main() {
  const apiKey = process.env.GEMINI_API_KEY
  const model = 'gemini-2.5-flash'
  const SYSTEM_PROMPT = `You are a UK parliamentary research assistant. Given a set of keywords describing a policy idea, return search terms that will locate the relevant primary legislation, statutory instruments, and parliamentary material in a full-text corpus search engine.

Your output feeds BM25 keyword search only — it is never shown to users or cited as fact. A hallucinated Act name simply scores zero and causes no harm.

Return three arrays:
- anchors: full statutory names of the likely anchor Acts, SIs, or retained-EU instruments (e.g. "Data Protection Act 2018", "UK GDPR", "Financial Services and Markets Act 2000") — up to 5 entries
- termsOfArt: statutory terms-of-art for this concept (e.g. "data controller", "personal data", "lawful basis") — up to 8 entries
- rephrasings: alternative lay phrasings of the same concept (e.g. "privacy law", "information rights") — up to 4 entries

UK law only. No elaboration. Each string must be 60 characters or fewer.`
  const EXPANSION_SCHEMA = {
    type: 'object',
    properties: {
      anchors: { type: 'array', items: { type: 'string' } },
      termsOfArt: { type: 'array', items: { type: 'string' } },
      rephrasings: { type: 'array', items: { type: 'string' } },
    },
    required: ['anchors', 'termsOfArt', 'rephrasings'],
  }
  console.log('apiKey set:', !!apiKey, 'len:', apiKey?.length)
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: 'Keywords: I want to stop people renting out whole houses as Airbnbs all year round' }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512, responseMimeType: 'application/json', responseSchema: EXPANSION_SCHEMA, thinkingConfig: { thinkingBudget: 0 } },
      }),
    },
  )
  console.log('status', res.status)
  const text = await res.text()
  console.log('body:', text)
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
