import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { model, messages, apiKey } = await req.json()

  const res = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 8192, temperature: 0.2 }),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
