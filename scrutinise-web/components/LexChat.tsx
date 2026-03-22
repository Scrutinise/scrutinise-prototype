'use client'

import { useState, useEffect, useRef } from 'react'
import { LexMessage } from '@/lib/lexScripts'

interface DisplayMessage {
  role: 'lex' | 'user'
  content: string
  fallacyFlag?: boolean
}

interface LexChatProps {
  script: LexMessage[]
  onFieldUpdate?: (field: string, value: string, status: 'draft' | 'complete') => void
}

export default function LexChat({ script, onFieldUpdate }: LexChatProps) {
  const lexMessages = script.filter(m => m.role === 'lex')
  const [displayed, setDisplayed] = useState<DisplayMessage[]>([])
  const [isTyping, setIsTyping] = useState(true)
  const [lexIndex, setLexIndex] = useState(0)
  const [input, setInput] = useState('')
  const [done, setDone] = useState(false)
  const [showScrollUp, setShowScrollUp] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const initialised = useRef(false)

  useEffect(() => {
    if (initialised.current) return
    initialised.current = true

    const timer = setTimeout(() => {
      const msg = lexMessages[0]
      setDisplayed([{ role: 'lex', content: msg.content, fallacyFlag: msg.fallacyFlag }])
      setIsTyping(false)
      setLexIndex(1)
      if (msg.fieldUpdate && onFieldUpdate) {
        setTimeout(() => onFieldUpdate(msg.fieldUpdate!.field, msg.fieldUpdate!.value, msg.fieldUpdate!.status), 800)
      }
    }, 1200)

    return () => clearTimeout(timer)
  }, [])

  // Auto-focus input on load
  useEffect(() => {
    if (!isTyping) inputRef.current?.focus()
  }, [isTyping])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }, [displayed, isTyping])

  // Show scroll-up button when not at the bottom
  const handleScroll = () => {
    const container = scrollContainerRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    setShowScrollUp(distanceFromBottom > 100)
  }

  const scrollToBottom = () => {
    const container = scrollContainerRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }

  const handleSend = () => {
    if (!input.trim() || isTyping || done) return
    const userText = input.trim()
    setInput('')

    setDisplayed(prev => [...prev, { role: 'user', content: userText }])

    if (lexIndex >= lexMessages.length) {
      setDone(true)
      return
    }

    setIsTyping(true)
    setTimeout(() => {
      const msg = lexMessages[lexIndex]
      setDisplayed(prev => [...prev, { role: 'lex', content: msg.content, fallacyFlag: msg.fallacyFlag }])
      setIsTyping(false)
      setLexIndex(i => i + 1)
      if (msg.fieldUpdate && onFieldUpdate) {
        setTimeout(() => onFieldUpdate(msg.fieldUpdate!.field, msg.fieldUpdate!.value, msg.fieldUpdate!.status), 800)
      }
    }, 1200)
  }

  return (
    <div className="relative flex flex-col h-full">
      {/* Scrollable messages + input */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="p-4 space-y-4">
          {displayed.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'lex' && (
                <div className="w-7 h-7 rounded-full bg-revolutBlue flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mr-2 mt-1">
                  L
                </div>
              )}
              <div className={`relative max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'lex' ? 'bg-gray-100 text-gray-900' : 'bg-revolutBlue text-white'
              }`}>
                {msg.content}
                {msg.fallacyFlag && (
                  <div className="group absolute -top-2 -right-2">
                    <span className="text-amber-400 text-base cursor-help" title="Lex flagged a potential argument issue">&#9888;</span>
                    <div className="absolute bottom-7 right-0 hidden group-hover:block bg-gray-800 border border-gray-600 text-white text-xs px-3 py-2 rounded-lg z-20 w-52 shadow-xl">
                      Lex flagged a potential argument issue
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-revolutBlue flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mr-2 mt-1">
                L
              </div>
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {done && (
            <div className="text-center text-gray-500 text-xs py-4 italic">
              End of scripted conversation — this is a prototype demo.
            </div>
          )}
        </div>

        {/* Input follows last message, inside scroll area */}
        <div className="px-4 pb-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={done ? 'Conversation complete' : 'Type anything to continue...'}
              disabled={isTyping || done}
              autoFocus
              className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-revolutBlue disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isTyping || done || !input.trim()}
              className="px-5 py-2.5 bg-revolutBlue hover:bg-blue-600 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Scroll-up arrow — appears when user has scrolled up */}
      {showScrollUp && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 right-6 w-8 h-8 rounded-full bg-gray-700 border border-gray-500 text-white flex items-center justify-center shadow-lg hover:bg-gray-600 transition-colors z-10"
          title="Scroll to latest message"
        >
          ↓
        </button>
      )}
    </div>
  )
}
