// Decision 249 — THE PAGE THE LHP BROWSER CHECK LOADS (scripts/check-lex-249-browser.ts bundles this with esbuild).
// The REAL ChatPanel inside a 600px-tall chat area (so "half the chat area" is a known 300px), and the REAL MaximiseToggle.

import React from 'react'
import { createRoot } from 'react-dom/client'
import ChatPanel from '@/components/lex/ChatPanel'
import MaximiseToggle from '@/components/lex/MaximiseToggle'

const noop = () => {}

function Page() {
  const [max, setMax] = React.useState(false)
  return (
    <div>
      <div id="toggle"><MaximiseToggle half="the chat" maximised={max} onToggle={() => setMax(!max)} /></div>
      <div id="chat-area" style={{ height: 600, display: 'flex', flexDirection: 'column' }}>
        <ChatPanel
          messages={[{ role: 'lex', content: 'Fixture reply.' }]}
          awaitingField={null} busy={false}
          onSend={noop} onAccept={noop} onDecline={noop} onContinue={noop}
        />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Page />)
