'use client'

import { useState } from 'react'

interface AIFuelGaugeProps {
  remaining: number
  total: number
}

export default function AIFuelGauge({ remaining, total }: AIFuelGaugeProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const pct = Math.round((remaining / total) * 100)
  const barColor = pct > 50 ? 'bg-green-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div
      className="relative flex items-center gap-2 cursor-default"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="text-xs text-gray-400 whitespace-nowrap">AI Fuel</span>
      <div className="w-28 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400">{pct}%</span>
      {showTooltip && (
        <div className="absolute bottom-6 right-0 bg-gray-800 border border-gray-600 text-xs text-white px-2 py-1.5 rounded-lg whitespace-nowrap z-10 shadow-xl">
          {remaining.toLocaleString()} tokens remaining
        </div>
      )}
    </div>
  )
}
