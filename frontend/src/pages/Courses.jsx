import React from 'react'
import { ArrowRight, Clock3, ListChecks } from 'lucide-react'
import Ring from '../components/Ring.jsx'
import Empty from '../components/Empty.jsx'
import { useStudy } from '../lib/study.jsx'
import { courseLayout, fmtDur, styleFor, WEIGHT } from '../lib/subjects.js'
import { go } from '../lib/route.js'

export function subjectStats(state, summary, subject) {
  const topics = state.topics.filter((t) => t.subject === subject)
  const layout = courseLayout(topics).flatMap((g) => g.topics)
  const subsTotal = topics.reduce((a, t) => a + t.subs.length, 0)
  const subsDone = topics.reduce((a, t) => a + t.subs_done, 0)
  const pct = topics.length ? topics.reduce((a, t) => a + (t.status === 'Done' ? 1 : t.subs.length ? Math.max(WEIGHT[t.status], t.subs_done / t.subs.length * 0.95) : WEIGHT[t.status]), 0) / topics.length : 0
  return {
    topics, layout, subsTotal, subsDone, pct,
    done: topics.filter((t) => t.status === 'Done').length,
    est: topics.reduce((a, t) => a + (t.hours || 0), 0),
    studied: summary?.by_subject?.[subject] || 0,
    next: layout.find((t) => t.status !== 'Done'),
  }
}

export default function Courses({ state }) {
  const { summary } = useStudy()
  if (!state) return <Empty title="Loading…" />
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Courses</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">One course per GATE DA subject. Open a course to study its topics in order, from the basics up, with notes, practice and a weekly mock test.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {state.subjects.map((s) => {
          const code = state.subject_codes[s]
          const { color, icon: Icon } = styleFor(code)
          const st = subjectStats(state, summary, s)
          const started = st.subsDone > 0 || st.topics.some((t) => t.status !== 'Not started') || st.studied > 0
          const sections = [...new Set(st.topics.map((t) => t.section).filter(Boolean))]
          return (
            <button key={s} onClick={() => go('courses', code)}
              className="card group relative flex flex-col overflow-hidden p-5 text-left transition hover:-translate-y-0.5 hover:border-white/20">
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: color + '22', color }}><Icon size={22} /></div>
                <Ring pct={st.pct} color={color} />
              </div>
              <h2 className="mt-4 text-lg font-bold leading-tight">{s}</h2>
              {sections.length > 0 && <p className="mt-0.5 text-xs text-slate-400">{sections.join(' and ')}</p>}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                <span className="flex items-center gap-1"><ListChecks size={13} /> {st.done}/{st.topics.length} topics</span>
                <span className="flex items-center gap-1"><Clock3 size={13} /> {fmtDur(st.studied)} of ~{Math.round(st.est)}h</span>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                <span className="min-w-0 truncate text-xs text-slate-500">{started && st.next ? `Next: ${st.next.name}` : started ? 'All topics done' : `${st.subsTotal} subtopics`}</span>
                <span className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-950" style={{ background: color }}>
                  {started ? 'Continue' : 'Start course'} <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
