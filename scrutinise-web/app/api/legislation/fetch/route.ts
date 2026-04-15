import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const year = searchParams.get('year')
  const chapter = searchParams.get('chapter')
  const section = searchParams.get('section')
  const version = searchParams.get('version') ?? 'revised'

  if (!type || !year || !chapter || !section) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
  }

  const baseUrl = `https://www.legislation.gov.uk/${type}/${year}/${chapter}/section/${section}`
  const url = version === 'enacted'
    ? `${baseUrl}/enacted/data.xml`
    : `${baseUrl}/data.xml`

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/xml' },
      next: { revalidate: 86400 },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `legislation.gov.uk returned ${res.status}` }, { status: res.status })
    }

    const xml = await res.text()
    return new Response(xml, {
      headers: { 'Content-Type': 'application/xml' },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
