import React, { useMemo, useState } from 'react'
import { Play, Pause, Square, Trash2, Timer, Hourglass, Flame, CalendarDays, Plus } from 'lucide-react'
import { del, post } from '../api'
import { useStudy, useElapsed, useWallClock } from '../lib/study.jsx'
import { fmtClock, fmtDur, styleFor } from '../lib/subjects.js'
import { useToast } from '../components/Toast.jsx'

const PRESETS = [25, 45, 60, 90]

export default function Clock({ state }) {
  const toast = useToast()
  const { timer, summary, active, start, pause, stop, discard, setTopic, setMode, refreshStudy } = useStudy()
  const { shown, elapsed } = useElapsed()
  const now = useWallClock()
  const [manual, setManual] = useState('')

  const topics = state?.topics || []
  const codes = state?.subject_codes || {}
  const topic = topics.find((t) => t.id === timer.topicId)
  const target = timer.mode === 'down' ? timer.targetMs : 0
  const ring = target ? Math.min(1, elapsed / target) : (elapsed % 3600000) / 3600000

  const week = useMemo(() => {
    const out = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const k = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
      out.push({ k, label: d.toLocaleDateString([], { weekday: 'short' }), sec: summary?.by_day?.[k] || 0 })
    }
    return out
  }, [summary])
  const maxDay = Math.max(1, ...week.map((d) => d.sec))
  const subjects = Object.entries(summary?.by_subject || {}).sort((a, b) => b[1] - a[1])
  const totalSub = subjects.reduce((a, [, v]) => a + v, 0) || 1

  const addManual = async () => {
    const m = parseInt(manual, 10)
    if (!m || m < 1) return
    try { await post('/study/sessions', { topic_id: timer.topicId || '', seconds: m * 60, note: 'added manually' }); setManual(''); refreshStudy(); toast(`Added ${m} min`, 'success') }
    catch (e) { toast(e.message, 'error') }
  }
  const removeSession = async (id) => { await del(`/study/sessions/${id}`); refreshStudy() }

  const R = 120, C = 2 * Math.PI * R
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Study clock</h1>
        <p className="mt-1 text-sm text-slate-400">Time you study is logged against the topic, so every course shows the hours you've really put in.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="card flex flex-col items-center gap-5 p-6 lg:col-span-3">
          <div className="relative grid place-items-center">
            <svg width="280" height="280" viewBox="0 0 280 280" className="max-w-full">
              <circle cx="140" cy="140" r={R} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="10" />
              <circle cx="140" cy="140" r={R} fill="none" stroke="#f6ac3c" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - ring)} transform="rotate(-90 140 140)" style={{ transition: 'stroke-dashoffset .9s linear' }} />
            </svg>
            <div className="absolute text-center">
              <div className="clock-digits text-5xl font-semibold text-slate-50 sm:text-6xl">{fmtClock(shown)}</div>
              <div className="mt-1 text-xs text-slate-400">
                {timer.mode === 'down' ? `countdown · ${Math.round(timer.targetMs / 60000)} min` : 'stopwatch'}
                {active && !timer.running ? ' · paused' : ''}
              </div>
              <div className="clock-digits mt-3 text-sm text-slate-500">{now.toLocaleTimeString()}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {timer.running
              ? <button onClick={pause} className="btn-primary !px-6 !py-3"><Pause size={18} /> Pause</button>
              : <button onClick={() => start()} className="btn-primary !px-6 !py-3"><Play size={18} /> {active ? 'Resume' : 'Start'}</button>}
            <button onClick={() => stop(true)} disabled={!active} className="btn-ghost !px-5 !py-3"><Square size={16} /> Stop &amp; save</button>
            {active && <button onClick={discard} className="btn-ghost !px-3 !py-3 text-rose-300" title="Discard without saving"><Trash2 size={16} /></button>}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button disabled={active} onClick={() => setMode('up', 0)} className={`btn !py-1.5 text-xs ${timer.mode === 'up' ? 'btn-primary' : 'btn-ghost'}`}><Timer size={13} /> Stopwatch</button>
            {PRESETS.map((m) => (
              <button key={m} disabled={active} onClick={() => setMode('down', m * 60000)}
                className={`btn !py-1.5 text-xs ${timer.mode === 'down' && timer.targetMs === m * 60000 ? 'btn-primary' : 'btn-ghost'}`}><Hourglass size={13} /> {m} min</button>
            ))}
          </div>

          <div className="w-full max-w-md">
            <label className="mb-1 block text-xs font-semibold text-slate-400">What are you studying?</label>
            <select value={timer.topicId} onChange={(e) => setTopic(e.target.value)} className="input">
              <option value="">General study (no topic)</option>
              {(state?.subjects || []).map((s) => (
                <optgroup key={s} label={s}>
                  {topics.filter((t) => t.subject === s).sort((a, b) => a.rank - b.rank).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </optgroup>
              ))}
            </select>
            {topic && <p className="mt-1.5 text-xs" style={{ color: styleFor(codes[topic.subject]).color }}>{topic.subject}</p>}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-3 gap-3">
            {[['Today', fmtDur(summary?.today_sec), CalendarDays], ['7 days', fmtDur(summary?.week_sec), CalendarDays], ['Streak', `${summary?.streak || 0} d`, Flame]].map(([l, v, I]) => (
              <div key={l} className="card p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-400"><I size={12} /> {l}</div>
                <div className="clock-digits text-lg font-semibold">{v}</div>
              </div>
            ))}
          </div>

          <div className="card p-4">
            <h2 className="mb-3 text-sm font-bold">Last 7 days</h2>
            <div className="flex h-28 items-end gap-2">
              {week.map((d) => (
                <div key={d.k} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-20 w-full items-end"><div className="w-full rounded-md bg-brand-500/80" style={{ height: `${Math.max(d.sec ? 6 : 2, (d.sec / maxDay) * 100)}%`, opacity: d.sec ? 1 : 0.2 }} title={fmtDur(d.sec)} /></div>
                  <span className="text-[10px] text-slate-500">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h2 className="mb-3 text-sm font-bold">Time by subject</h2>
            {subjects.length === 0 && <p className="text-xs text-slate-500">Nothing logged yet. Start the clock and it will show up here.</p>}
            <div className="space-y-2.5">
              {subjects.map(([s, v]) => (
                <div key={s}>
                  <div className="mb-1 flex justify-between text-xs"><span className="text-slate-300">{s}</span><span className="clock-digits text-slate-400">{fmtDur(v)}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full" style={{ width: `${(v / totalSub) * 100}%`, background: styleFor(codes[s]).color }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">Recent sessions</h2>
          <div className="flex items-center gap-2">
            <input value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))} placeholder="minutes" className="input !w-24 !py-1.5 text-xs" inputMode="numeric" />
            <button onClick={addManual} className="btn-ghost !py-1.5 text-xs"><Plus size={13} /> Add time manually</button>
          </div>
        </div>
        {(summary?.recent || []).length === 0 && <p className="text-xs text-slate-500">No sessions yet.</p>}
        <ul className="divide-y divide-white/5">
          {(summary?.recent || []).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{r.topic_name || 'General study'}</div>
                <div className="truncate text-xs text-slate-500">{r.subject} · {r.date}{r.note ? ` · ${r.note}` : ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="clock-digits text-slate-300">{fmtDur(r.seconds)}</span>
                <button onClick={() => removeSession(r.id)} className="text-slate-500 hover:text-rose-400" title="Delete session"><Trash2 size={14} /></button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
