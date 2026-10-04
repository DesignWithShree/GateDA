import React, { useEffect, useMemo, useState } from 'react'
import { PlayCircle, RefreshCw, Sparkles, CalendarClock, TrendingUp, Flame, Activity, Grid3x3, ListOrdered } from 'lucide-react'
import { get, streamSSE } from '../api'
import Markdown from '../components/Markdown.jsx'
import Empty from '../components/Empty.jsx'
import Heatmap from '../components/Heatmap.jsx'
import ConfidenceMatrix from '../components/ConfidenceMatrix.jsx'
import Counter from '../components/Counter.jsx'
import { useStudy } from '../lib/study.jsx'
import { fmtDur } from '../lib/subjects.js'

const WEIGHT = { 'Not started': 0, Learning: 0.4, Revise: 0.7, Done: 1 }

function Stat({ icon: Icon, label, value, accent }) {
  return (
    <div className="card animate-fadeUp p-4">
      <div className="mb-2 flex items-center gap-2 text-slate-400"><Icon size={15} /><span className="text-xs font-medium">{label}</span></div>
      <div className={`text-2xl font-extrabold tracking-tight ${accent || ''}`}>{value}</div>
    </div>
  )
}

function SubjectBar({ subj, pct, done, total }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-600 dark:text-slate-300">{subj}</span>
        <span className="text-slate-400">{done}/{total} · {Math.round(pct * 100)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all duration-700" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  )
}

function TopicRow({ t, sub, onClick, cta }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-100 dark:hover:bg-white/5">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{t.name}</div>
        <div className="truncate text-xs text-slate-400">{t.subject} · {sub}</div>
      </div>
      <span className="shrink-0 rounded-lg bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-600 dark:text-brand-300">{cta}</span>
    </button>
  )
}

export default function Dashboard({ state, refresh, goTutor, goTab }) {
  const [plan, setPlan] = useState(null)
  const [planDate, setPlanDate] = useState(null)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [err, setErr] = useState('')
  const { summary } = useStudy()

  useEffect(() => { get('/coach/last').then((r) => { setPlan(r.plan || null); setPlanDate(r.date) }).catch(() => {}) }, [])

  const daysLeft = useMemo(() => {
    if (!state) return null
    const d = Math.ceil((new Date(state.settings.exam_date) - new Date()) / 86400000)
    return d
  }, [state])

  const bySubject = useMemo(() => {
    if (!state) return []
    const m = {}
    for (const t of state.topics) (m[t.subject] ||= []).push(t)
    return state.subjects.map((s) => {
      const ts = m[s] || []
      const pct = ts.reduce((a, t) => a + WEIGHT[t.status], 0) / (ts.length || 1)
      return { subj: s, pct, done: ts.filter((t) => t.status === 'Done').length, total: ts.length }
    })
  }, [state])

  const overall = useMemo(() => {
    if (!state) return 0
    return state.topics.reduce((a, t) => a + WEIGHT[t.status], 0) / state.topics.length
  }, [state])

  const studyNext = useMemo(() => {
    if (!state) return []
    const learning = state.topics.filter((t) => t.status === 'Learning').map((t) => ({ t, cta: 'Continue' }))
    const fresh = state.topics.filter((t) => t.status === 'Not started').map((t) => ({ t, cta: 'Start' }))
    return [...learning, ...fresh].slice(0, 5)
  }, [state])

  const reviseSoon = useMemo(() => {
    if (!state) return []
    const now = Date.now()
    const out = []
    for (const t of state.topics) {
      const days = t.last_studied ? Math.floor((now - new Date(t.last_studied)) / 86400000) : null
      if (t.status === 'Revise') out.push({ t, why: 'marked for revision' })
      else if (t.status === 'Done' && t.confidence > 0 && t.confidence <= 2) out.push({ t, why: `low confidence (${t.confidence}/5)` })
      else if (['Done', 'Learning'].includes(t.status) && days !== null && days > 21) out.push({ t, why: `not touched for ${days} days` })
    }
    return out.slice(0, 6)
  }, [state])

  const remaining = state ? state.topics.length - state.topics.filter((t) => t.status === 'Done').length : 0
  const perWeek = daysLeft && daysLeft > 0 ? (remaining / Math.max(daysLeft / 7, 1)).toFixed(1) : '—'

  const genPlan = () => {
    setLoadingPlan(true); setErr(''); setPlan('')
    streamSSE('/coach', {}, (e) => {
      if (e.type === 'token') setPlan((p) => (p || '') + e.text)
      else if (e.type === 'error') setErr(e.text)
      else if (e.type === 'done') { setLoadingPlan(false); setPlanDate(new Date().toISOString().slice(0, 10)) }
    }).catch((e) => { setErr(e.message); setLoadingPlan(false) })
  }

  if (!state) return <Empty title="Loading…" />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Your GATE DA 2027 preparation at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card animate-fadeUp p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-400"><TrendingUp size={15} /><span className="text-xs font-medium">Overall progress</span></div>
          <div className="text-2xl font-extrabold tracking-tight text-brand-500"><Counter value={Math.round(overall * 100)} suffix="%" /></div>
        </div>
        <div className="card animate-fadeUp p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-400"><Flame size={15} /><span className="text-xs font-medium">Topics done</span></div>
          <div className="text-2xl font-extrabold tracking-tight"><Counter value={state.topics.filter((t) => t.status === 'Done').length} />/{state.topics.length}</div>
        </div>
        <div className="card animate-fadeUp p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-400"><CalendarClock size={15} /><span className="text-xs font-medium">Days to exam</span></div>
          <div className="text-2xl font-extrabold tracking-tight">{daysLeft !== null ? <Counter value={daysLeft} /> : '—'}</div>
        </div>
        <div className="card animate-fadeUp p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-400"><Sparkles size={15} /><span className="text-xs font-medium">Topics/week needed</span></div>
          <div className="text-2xl font-extrabold tracking-tight">{perWeek}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[['Studied today', fmtDur(summary?.today_sec)], ['Last 7 days', fmtDur(summary?.week_sec)], ['Day streak', `${summary?.streak || 0}`]].map(([l, v]) => (
          <button key={l} onClick={() => goTab?.('clock')} className="card p-4 text-left transition hover:border-white/20">
            <div className="mb-1 text-xs font-medium text-slate-400">{l}</div>
            <div className="clock-digits text-xl font-semibold text-brand-300">{v}</div>
          </button>
        ))}
      </div>

      <button onClick={() => goTab?.('priority')} className="card flex w-full items-center justify-between gap-3 p-4 text-left transition hover:shadow-glow sm:p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><ListOrdered size={18} /></div>
          <div>
            <div className="text-sm font-bold">See your full priority plan</div>
            <div className="text-xs text-slate-400">Ranked by importance & difficulty, with a day-by-day schedule</div>
          </div>
        </div>
        <span className="shrink-0 text-xs font-semibold text-brand-500">Open →</span>
      </button>

      <div className="card p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-bold">By subject</h2>
        <div className="grid gap-x-8 sm:grid-cols-2">
          {bySubject.map((s) => <SubjectBar key={s.subj} {...s} />)}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Activity size={15} className="text-brand-500" /> Study activity</h2>
          <Heatmap weeks={18} />
        </div>
        <div className="card p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Grid3x3 size={15} className="text-brand-500" /> Confidence map</h2>
          <ConfidenceMatrix state={state} onPick={goTutor} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4 sm:p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold"><PlayCircle size={15} className="text-brand-500" /> Study next</h2>
          {studyNext.length === 0 ? <Empty title="All topics are in progress or done" /> :
            <div className="-mx-1">{studyNext.map(({ t, cta }) => <TopicRow key={t.id} t={t} sub={cta} cta={cta} onClick={() => goTutor(t.id)} />)}</div>}
        </div>
        <div className="card p-4 sm:p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold"><RefreshCw size={15} className="text-brand-500" /> Revise soon</h2>
          {reviseSoon.length === 0 ? <Empty title="Nothing due" hint="Mark topics Done with a confidence rating and they'll show up here when they need revision." /> :
            <div className="-mx-1">{reviseSoon.map(({ t, why }) => <TopicRow key={t.id} t={t} sub={why} cta="Revise" onClick={() => goTutor(t.id)} />)}</div>}
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold"><Sparkles size={15} className="text-brand-500" /> AI study coach</h2>
          <button onClick={genPlan} disabled={loadingPlan} className="btn-primary">
            {loadingPlan ? 'Generating…' : 'Generate this week\u2019s plan'}
          </button>
        </div>
        {planDate && <p className="mb-2 text-xs text-slate-400">Last generated on {planDate}</p>}
        {err && <p className="mb-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-500">{err}</p>}
        {plan ? <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10"><Markdown>{plan}</Markdown></div> :
          !loadingPlan && <Empty title="No plan yet" hint="Generate a plan based on your actual progress and exam date." />}
      </div>
    </div>
  )
}
