import React from 'react'
import { Play, Pause, Square, Clock } from 'lucide-react'
import { useStudy, useElapsed, useWallClock } from '../lib/study.jsx'
import { fmtClock } from '../lib/subjects.js'
import { go } from '../lib/route.js'

export function WallClock({ className = '' }) {
  const now = useWallClock()
  return (
    <button onClick={() => go('clock')} className={`flex items-baseline gap-2 text-left ${className}`} title="Open study clock">
      <span className="clock-digits text-lg font-semibold text-slate-100">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      <span className="text-xs text-slate-400">{now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</span>
    </button>
  )
}

export default function TimerPill({ compact = false }) {
  const { timer, active, start, pause, stop } = useStudy()
  const { shown } = useElapsed()
  if (!active) {
    return (
      <button onClick={() => { start(); }} className="btn-ghost !px-3 !py-1.5 text-xs" title="Start the study timer">
        <Clock size={14} className="text-brand-400" /> {compact ? 'Study' : 'Start studying'}
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1 rounded-xl border border-brand-500/40 bg-brand-500/10 py-1 pl-3 pr-1">
      <button onClick={() => go('clock')} className="clock-digits text-sm font-semibold text-brand-300">{fmtClock(shown)}</button>
      {timer.running
        ? <button onClick={pause} className="grid h-7 w-7 place-items-center rounded-lg text-brand-300 hover:bg-white/10" title="Pause"><Pause size={14} /></button>
        : <button onClick={() => start()} className="grid h-7 w-7 place-items-center rounded-lg text-brand-300 hover:bg-white/10" title="Resume"><Play size={14} /></button>}
      <button onClick={() => stop(true)} className="grid h-7 w-7 place-items-center rounded-lg text-rose-300 hover:bg-white/10" title="Stop & save"><Square size={13} /></button>
    </div>
  )
}
