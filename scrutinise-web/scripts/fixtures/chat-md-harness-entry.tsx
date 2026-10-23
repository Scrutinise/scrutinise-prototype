// 235 (CCh 22 Oct (7)) — THE PAGE THE CHAT-MARKDOWN BROWSER CHECK LOADS (scripts/check-lex-235-chat-browser.ts bundles this with esbuild).
//
// The REAL ChatPanel (the agent chat on the workspace) and the REAL AskLexPanel (the Ask tab on the build page), in a real browser. ChatPanel
// gets the conversation as props, as its page gives it; AskLexPanel fetches its reply, and the check answers that request with the same reply.
// The reply text is put on `window.__chat.reply` by the check before this bundle runs, so the fixture lives in one place.

import React from 'react'
import { createRoot } from 'react-dom/client'
import ChatPanel from '@/components/lex/ChatPanel'
import AskLexPanel from '@/components/lex/AskLexPanel'

type W = { __chat: { reply: string; userText: string } }
const { reply, userText } = (window as unknown as W).__chat
const noop = () => {}

function Page() {
  // ChatPanel hides what was already there when the user arrived, except the last line — so the reply is there on arrival and the user's
  // line is said afterwards, as in a live conversation.
  const [messages, setMessages] = React.useState<Array<{ role: 'user' | 'lex'; content: string }>>([{ role: 'lex', content: reply }])
  React.useEffect(() => { setMessages((m) => [...m, { role: 'user', content: userText }]) }, [])
  return (
    <div>
      <section id="chat-panel">
        <ChatPanel
          messages={messages}
          awaitingField={null} busy={false}
          onSend={noop} onAccept={noop} onDecline={noop} onContinue={noop} onGiveFeedback={noop}
          onDismissFeedbackOffer={noop} onAcceptEdit={noop} onDismissEdit={noop}
        />
      </section>
      <section id="ask-lex"><AskLexPanel ideaId="harness" /></section>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Page />)
