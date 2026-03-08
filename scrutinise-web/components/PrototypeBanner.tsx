'use client'

import { useState } from 'react'

export default function PrototypeBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-sm px-4 py-2 flex items-center justify-between">
      <span>Prototype Mode — fictional data only. Actions do not persist.</span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-4 text-amber-400 hover:text-amber-200 font-medium"
        aria-label="Dismiss banner"
      >
        &times;
      </button>
    </div>
  )
}
