'use client'

import { useState, useEffect } from 'react'

const MESSAGES = [
  "Lex is thinking...",
  "Reading the question...",
  "Weighing the evidence...",
  "Considering the policy angle...",
  "Checking the research...",
  "Formulating a response...",
  "Thinking through the implications...",
  "Analysing the diagnosis...",
  "Consulting the statute book...",
  "Drawing on the evidence...",
]

interface LexThinkingProps {
  visible: boolean
}

export default function LexThinking({ visible }: LexThinkingProps) {
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    if (!visible) return
    const interval = setInterval(() => {
      setMsgIndex(i => {
        let next = Math.floor(Math.random() * MESSAGES.length)
        while (next === i) next = Math.floor(Math.random() * MESSAGES.length)
        return next
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [visible])

  if (!visible) return null

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground py-2">
      <div className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="transition-opacity duration-300">{MESSAGES[msgIndex]}</span>
    </div>
  )
}
