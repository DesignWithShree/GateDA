import React from 'react'

const COLOR = (status, conf) => {
  if (status === 'Not started') return 'bg-slate-100 dark:bg-white/5'
  if (status === 'Revise') return 'bg-rose-400/70 dark:bg-rose-500/50'
  if (conf >= 4) return 'bg-emerald-500/80 dark:bg-emerald-400/60'
  if (conf >= 2) return 'bg-amber-400/70 dark:bg-amber-400/50'
  return 'bg-amber-200/70 dark:bg-amber-300/25'
}

export default function ConfidenceMatrix({ state, onPick }) {
  if (!state) return null
  return (
    <div className="space-y-2.5">
      {state.subjects.map((s) => {
        const ts = state.topics.filter((t) => t.subject === s)
        return (
          <div key={s} className="flex items-center gap-2">
            <div className="w-32 shrink-0 truncate text-xs font-medium text-slate-500 dark:text-slate-400">{s}</div>
            <div className="flex flex-1 flex-wrap gap-1">
              {ts.map((t) => (
                <button key={t.id} onClick={() => onPick(t.id)} title={`${t.name} · ${t.status}${t.confidence ? ` · ${t.confidence}/5` : ''}`}
                  className={`h-3.5 w-3.5 rounded-[3px] transition hover:scale-125 ${COLOR(t.status, t.confidence)}`} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
