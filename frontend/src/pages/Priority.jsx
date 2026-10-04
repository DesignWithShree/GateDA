import React, { useEffect, useState } from 'react'
import { ListOrdered, CalendarRange, AlertTriangle, CheckCircle2, Clock, Flag, Coffee, Sunrise, Sun, Sunset } from 'lucide-react'
import { get } from '../api'
import Counter from '../components/Counter.jsx'
import Empty from '../components/Empty.jsx'

const BLOCK_ICON = { Morning: Sunrise, Afternoon: Sun, Evening: Sunset }

const DIFF_COLOR = {
  Easy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
  Hard: 'bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300',
}

function Stars({ n }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Flag key={i} size={11} className={i < n ? 'fill-brand-500 text-brand-500' : 'text-slate-200 dark:text-white/10'} />
      ))}
    </div>
  )
}

export default function Priority({ goTutor }) {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('order') // order | schedule | left

  useEffect(() => { get('/priority').then(setData).catch(() => {}) }, [])

  if (!data) return <Empty title="Loading…" />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Priority Plan</h1>
        <p className="mt-1 text-sm text-slate-400">Basic topics first to build a stable footing, then medium, then hard — highest-weightage topics first within each — fitted into your actual daily free time.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <div className="mb-1 text-xs font-medium text-slate-400">Days left</div>
          <div className="text-2xl font-extrabold"><Counter value={data.days_left} /></div>
        </div>
        <div className="card p-4">
          <div className="mb-1 text-xs font-medium text-slate-400">Hours remaining</div>
          <div className="text-2xl font-extrabold"><Counter value={Math.round(data.total_hours_left)} suffix="h" /></div>
        </div>
        <div className="card p-4">
          <div className="mb-1 text-xs font-medium text-slate-400">Daily budget</div>
          <div className="text-2xl font-extrabold">{data.daily_budget}h<span className="text-sm font-medium text-slate-400">/day</span></div>
        </div>
        <div className={`card p-4 ${data.on_track ? '' : 'ring-1 ring-amber-400/40'}`}>
          <div className="mb-1 text-xs font-medium text-slate-400">Pace check</div>
          <div className={`flex items-center gap-1.5 text-base font-extrabold ${data.on_track ? 'text-emerald-500' : 'text-amber-500'}`}>
            {data.on_track ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {data.on_track ? 'On track' : 'Behind pace'}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          ['order', 'Study order', ListOrdered],
          ['schedule', 'Calendar', CalendarRange],
          ['left', "What's left", Clock],
        ].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${tab === id ? 'bg-gradient-to-r from-brand-500 to-violet-600 text-white shadow-glow' : 'border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === 'order' && (
        <div className="card overflow-hidden">
          <div className="md-scroll">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-400 dark:border-white/10">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Topic</th>
                  <th className="px-4 py-3 font-medium">Importance</th>
                  <th className="px-4 py-3 font-medium">Difficulty</th>
                  <th className="px-4 py-3 font-medium">Est. hours left</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.ranked.map((r, i) => (
                  <tr key={r.id} onClick={() => goTutor(r.id)} className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-xs text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-slate-400">{r.subject}</div>
                    </td>
                    <td className="px-4 py-3"><Stars n={r.importance} /></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${DIFF_COLOR[r.difficulty]}`}>{r.difficulty}</span></td>
                    <td className="px-4 py-3 text-xs">{r.hours_left}h</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'schedule' && (
        <div className="space-y-4">
          {!data.calendar?.length ? (
            <Empty title="Nothing to schedule" hint="Add your free daily time blocks in Settings so the calendar knows when you can study." />
          ) : data.calendar.map((d, di) => {
            const dateObj = new Date(d.date + 'T00:00:00')
            const isToday = di === 0
            return (
              <div key={d.date} className={`card p-4 sm:p-5 ${isToday ? 'ring-1 ring-brand-500/40' : ''}`}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm font-bold">{dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                  {isToday && <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-white">TODAY</span>}
                </div>
                <div className="space-y-3">
                  {d.blocks.map((b, bi) => {
                    const Icon = BLOCK_ICON[b.label] || Clock
                    return (
                      <div key={bi}>
                        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                          <Icon size={12} /> {b.label} · {b.start}–{b.end}
                        </div>
                        <div className="space-y-1.5 border-l-2 border-slate-200 pl-3 dark:border-white/10">
                          {b.items.map((it, i) => it.type === 'break' ? (
                            <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                              <Coffee size={12} /> Break · {it.start}–{it.end}
                            </div>
                          ) : (
                            <button key={i} onClick={() => goTutor(it.id)}
                              className="flex w-full flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-white/5">
                              <span className="font-mono text-xs text-slate-400">{it.start}–{it.end}</span>
                              <span className="font-medium">{it.name}</span>
                              <span className="text-xs text-slate-400">{it.subject}</span>
                              <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${DIFF_COLOR[it.difficulty]}`}>{it.difficulty}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'left' && (
        <div className="card p-4 sm:p-5">
          <p className="mb-3 text-xs text-slate-400">{data.not_started.length} topic(s) not started yet, highest importance first.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.not_started.map((t) => (
              <button key={t.id} onClick={() => goTutor(t.id)} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-slate-400">{t.subject}</div>
                </div>
                <Stars n={t.importance} />
              </button>
            ))}
            {data.not_started.length === 0 && <Empty title="Every topic has been started 🎉" />}
          </div>
        </div>
      )}
    </div>
  )
}
