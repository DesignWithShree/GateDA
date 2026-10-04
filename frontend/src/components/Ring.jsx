import React from 'react'
export default function Ring({ pct = 0, color = '#f6ac3c', size = 56, stroke = 5, label = true }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, pct))} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      {label && <span className="clock-digits absolute text-[11px] font-semibold text-slate-200">{Math.round(pct * 100)}%</span>}
    </div>
  )
}
