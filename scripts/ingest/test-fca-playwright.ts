import path from 'path'
import { chromium } from 'playwright'

process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(
  __dirname, '../../scrutinise-web/node_modules/playwright/.local-browsers'
)

async function test() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  // Test 1: Capture full GetAllHandbook URL from handbook index
  console.log('\n=== TEST 1: Capture full GetAllHandbook URL ===')
  const responses: string[] = []
  page.on('response', async res => {
    const url = res.url()
    if (url.includes('GetAllHandbook')) {
      responses.push(url)
      try {
        const body = await res.json()
        console.log('URL:', url)
        console.log('Response keys:', Object.keys(body))
        const result = body.Result ?? body.result
        if (result) {
          console.log('Result keys:', Object.keys(result))
          if (Array.isArray(result)) console.log('Result length:', result.length, 'sample:', JSON.stringify(result.slice(0,2), null, 2))
          else console.log('Result sample:', JSON.stringify(result).slice(0, 500))
        }
      } catch (e) {
        console.log('URL:', url, '— parse error:', String(e))
      }
    }
  })

  await page.goto('https://handbook.fca.org.uk/handbook', { waitUntil: 'networkidle' })

  // Test 2: COBS module API call without sectionId
  console.log('\n=== TEST 2: COBS module provisions (no sectionId) ===')
  const cobsModule = await fetch(
    'https://api-handbook.fca.org.uk/Handbook/GetAllHandBookProvisionsSortedOrderByChapter/COBS?IsDeleted=false',
    { headers: { 'Origin': 'https://handbook.fca.org.uk', 'Referer': 'https://handbook.fca.org.uk/' } }
  ).then(r => r.json()).catch(e => ({ error: String(e) }))
  console.log('COBS no-sectionId result keys:', Object.keys(cobsModule.Result ?? cobsModule))
  const r = cobsModule.Result ?? {}
  console.log('chapterId:', r.chapterId, 'chapterName:', r.chapterName)
  console.log('nextChapterId:', r.nextChapterId, 'previousChapterId:', r.previousChapterId)
  console.log('provisions count:', (r.provisions ?? []).length)

  // Test 3: Walk first few chapters to understand module boundaries
  console.log('\n=== TEST 3: Walk from prin1 to understand structure ===')
  let chapterId = 'prin1'
  for (let i = 0; i < 10; i++) {
    const data = await fetch(
      `https://api-handbook.fca.org.uk/Handbook/GetAllHandBookProvisionsSortedOrderByChapter/${chapterId}?IsDeleted=false`,
      { headers: { 'Origin': 'https://handbook.fca.org.uk' } }
    ).then(r => r.json()).catch(() => null)
    if (!data) break
    const ch = data.Result
    const module = chapterId.replace(/\d.*$/, '').toUpperCase()
    console.log(`  ${chapterId}: "${ch.chapterName}" (module: ${module}, provisions: ${ch.provisions?.length ?? 0}, next: ${ch.nextChapterId ?? 'END'})`)
    if (!ch.nextChapterId) break
    chapterId = ch.nextChapterId
  }

  await browser.close()
  console.log('\n=== DONE ===')
}

test().catch(console.error)
