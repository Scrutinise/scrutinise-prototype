import { listActEntries } from './sources/tna-legislation'
async function main() {
  const e1924 = await listActEntries('ukpga', 1924, 1924)
  console.log('1924 sample:', JSON.stringify(e1924.slice(0, 3)), 'total', e1924.length)
  const e1996 = await listActEntries('ukpga', 1996, 1996)
  console.log('1996 sample:', JSON.stringify(e1996.slice(0, 3)), 'total', e1996.length)
}
main().catch(e => { console.error(e); process.exit(1) })
