export async function GET() {
  const now = new Date()
  const bst = now.toLocaleString('en-GB', { timeZone: 'Europe/London', hour12: false })
  const abbr = Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', timeZoneName: 'short' })
    .formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? 'BST'
  return Response.json({ datetime: bst, abbreviation: abbr })
}
