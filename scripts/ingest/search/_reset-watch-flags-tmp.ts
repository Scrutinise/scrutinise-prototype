// THROWAWAY — waits for the NEW build box's fresh tail log on R2 (a tail with the
// STEP-2 starting line and no exit line yet), then clears the watcher state's latched
// sawDone/sawFatal flags so _vector-watch-tmp.ts will announce the new run's completion.
import fs from 'fs'
import { r2Get } from '../shared/r2-client'

const STATE_PATH = 'C:/Users/charl/AppData/Local/Temp/claude/C--Code-scrutinise-prototype/1d791a8c-233a-40c9-8774-9e7764635a39/scratchpad/vector-watch-state.json'
const NEW_MARK = '[hetzner-build] starting: NODE_OPTIONS'
const OLD_MARK = 'build exited code='

async function main() {
  for (let i = 0; i < 45; i++) { // up to ~15 min
    const tail = await r2Get('_search/hetzner-build.tail.log').catch(() => null)
    if (tail && tail.includes(NEW_MARK) && !tail.includes(OLD_MARK)) {
      const st = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
      st.sawDone = false
      st.sawFatal = false
      fs.writeFileSync(STATE_PATH, JSON.stringify(st))
      console.log('watcher flags cleared — new run tail confirmed on R2')
      return
    }
    await new Promise((r) => setTimeout(r, 20_000))
  }
  console.log('TIMEOUT: new tail never appeared after ~15 min — check hetzner-build-run.ts logs')
}
main().catch((e) => console.log('reset-watch-flags error:', (e as Error).message))
