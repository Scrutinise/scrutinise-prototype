import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authorizeIdea } from '@/lib/lex/authz'
import { cbaDownload } from '@/lib/lex/cba/report'

type Params = { params: Promise<{ id: string }> }

// LEX 26-Y — one version of the Cost–benefit report, as Word or PDF. A version's file never changes, so this redirects to a signed URL.
export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id, 'read')
  if (authz.error) return authz.error
  const u = new URL(req.url)
  const v = Number(u.searchParams.get('v'))
  const format = u.searchParams.get('format') === 'pdf' ? 'pdf' : 'docx'
  if (!Number.isInteger(v) || v < 1) return NextResponse.json({ error: 'Downloading the report was not done: name a version (v=1, 2, …).' }, { status: 422 })
  const idea = await prisma.idea.findUnique({ where: { id }, select: { title: true } })
  const slug = (idea?.title || 'idea').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'idea'
  const url = await cbaDownload(id, v, format, `${slug}-cost-benefit-v${v}.${format}`)
  if (!url) return NextResponse.json({ error: `Version ${v} of the Cost–benefit report has no ${format === 'pdf' ? 'PDF' : 'Word'} file.` }, { status: 404 })
  return NextResponse.redirect(url)
}
