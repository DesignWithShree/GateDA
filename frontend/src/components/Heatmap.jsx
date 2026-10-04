import React, { useEffect, useMemo, useState } from 'react'
import { get } from '../api'

function colorFor(n) {
  if (!n) return 'bg-slate-100 dark:bg-white/5'
  if (n === 1) return 'bg-brand-300/60 dark:bg-brand-500/30'
  if (n === 2) return 'bg-brand-400/80 dark:bg-brand-500/55'
  if (n <= 4) return 'bg-brand-500 dark:bg-brand-400'
  return 'bg-violet-600 dark:bg-violet-400'
}

export default function Heatmap({ weeks = 20 }) {
  const [counts, setCounts] = useState({})
  useEffect(() => { get(`/activity?days=${weeks * 7 + 7}`).then((r) => setCounts(r.counts)).catch(() => {}) }, [weeks])

  const cols = useMemo(() => {
    const today = new Date()
    const days = []
    for (let i = weeks * 7 - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      days.push(d.toISOString().slice(0, 10))
    }
    // pad to start on Sunday
    const first = new Date(days[0])
    const pad = first.getDay()
    const padded = Array(pad).fill(null).concat(days)
    const out = []
    for (let i = 0; i < padded.length; i += 7) out.push(padded.slice(i, i + 7))
    return out
  }, [weeks])

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const activeDays = Object.keys(counts).length

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span>{activeDays} active day{activeDays === 1 ? '' : 's'} · {total} update{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          {[0, 1, 2, 4, 6].map((n) => <div key={n} className={`h-2.5 w-2.5 rounded-sm ${colorFor(n)}`} />)}
          <span>More</span>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {cols.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((d, di) => (
              <div key={di} title={d ? `${d}: ${counts[d] || 0} update(s)` : ''}
                className={`h-2.5 w-2.5 rounded-sm ${d ? colorFor(counts[d] || 0) : 'opacity-0'}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
