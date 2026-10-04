import React, { useState } from 'react'
import { ArrowLeft, Check, ChevronDown, FileQuestion, Dumbbell, Trophy, Plus, Trash2, ExternalLink, BookOpen, Sparkles, StickyNote, X } from 'lucide-react'
import { del, post, put } from '../api'
import Ring from '../components/Ring.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Empty from '../components/Empty.jsx'
import { useToast } from '../components/Toast.jsx'
import { useStudy } from '../lib/study.jsx'
import { courseLayout, fmtDur, styleFor } from '../lib/subjects.js'
import { go } from '../lib/route.js'
import { subjectStats } from './Courses.jsx'

function AddTopic({ subject, sections, onDone, onCancel }) {
  const toast = useToast()
  const [f, setF] = useState({ name: '', section: sections[0] || '', difficulty: 'Medium', subs: '' })
  const save = async () => {
    if (!f.name.trim()) return toast('Give the topic a name', 'error')
    try {
      await post('/topics', { subject, name: f.name, section: f.section, difficulty: f.difficulty, subtopics: f.subs.split('\n') })
      toast('Topic added', 'success'); onDone()
    } catch (e) { toast(e.message, 'error') }
  }
  return (
    <div className="card space-y-3 border-brand-500/30 p-4">
      <div className="flex items-center justify-between"><h3 className="text-sm font-bold">Add a topic to this course</h3><button onClick={onCancel} className="text-slate-500 hover:text-slate-200"><X size={16} /></button></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Topic name, e.g. NumPy basics" className="input sm:col-span-3" autoFocus />
        <div>
          <label className="mb-1 block text-xs text-slate-400">Part of the course</label>
          <input list="sections" value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })} placeholder={sections.length ? '' : '(optional)'} className="input" />
          <datalist id="sections">{sections.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Difficulty</label>
          <select value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })} className="input"><option>Easy</option><option>Medium</option><option>Hard</option></select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-400">Subtopics, one per line (you can add more later)</label>
        <textarea value={f.subs} onChange={(e) => setF({ ...f, subs: e.target.value })} rows={4} className="input" placeholder={'Arrays\nBroadcasting\nIndexing'} />
      </div>
      <div className="flex gap-2"><button onClick={save} className="btn-primary">Add topic</button><button onClick={onCancel} className="btn-ghost">Cancel</button></div>
    </div>
  )
}

function Unit({ t, n, color, code, refresh, open, toggle, studied }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const tick = async (s) => { await put(`/subtopics/${s.id}`, { done: !s.done }); refresh() }
  const addSub = async () => { if (!name.trim()) return; await post(`/topics/${t.id}/subtopics`, { name }); setName(''); refresh() }
  const rmSub = async (s) => { if (confirm(`Remove subtopic "${s.name}"? Its notes will be deleted.`)) { await del(`/subtopics/${s.id}`); refresh() } }
  const rmTopic = async () => { if (confirm(`Delete the topic "${t.name}" and everything in it?`)) { await del(`/topics/${t.id}`); toast('Topic deleted', 'info'); refresh() } }
  const pct = t.subs.length ? t.subs_done / t.subs.length : t.status === 'Done' ? 1 : 0
  return (
    <div className="card overflow-hidden">
      <button onClick={toggle} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold" style={{ background: t.status === 'Done' ? color : color + '22', color: t.status === 'Done' ? '#0b0d13' : color }}>
          {t.status === 'Done' ? <Check size={16} strokeWidth={3} /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{t.name}</span><StatusBadge status={t.status} /></div>
          <div className="mt-1.5 flex items-center gap-3">
            <div className="h-1 w-24 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: color }} /></div>
            <span className="text-xs text-slate-500">{t.subs_done}/{t.subs.length} subtopics · ~{t.hours}h{studied ? ` · ${fmtDur(studied)} studied` : ''}</span>
          </div>
        </div>
        <ChevronDown size={18} className={`shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-white/5 bg-black/10 p-4">
          <ul className="space-y-1">
            {t.subs.map((s) => (
              <li key={s.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-white/5">
                <button onClick={() => tick(s)} aria-label={s.done ? 'Mark as not studied' : 'Mark as studied'}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md border transition" style={s.done ? { background: color, borderColor: color, color: '#0b0d13' } : { borderColor: 'rgba(255,255,255,.2)' }}>
                  {s.done && <Check size={14} strokeWidth={3} />}
                </button>
                <button onClick={() => go('courses', code, t.id, s.id)} className={`min-w-0 flex-1 truncate text-left text-sm ${s.done ? 'text-slate-500 line-through decoration-white/20' : ''}`}>{s.name}</button>
                {s.has_lesson && <span title="AI notes ready" className="text-brand-400"><Sparkles size={13} /></span>}
                {s.has_notes && <span title="You wrote notes" className="text-sky-300"><StickyNote size={13} /></span>}
                <button onClick={() => rmSub(s)} className="text-slate-600 opacity-0 transition hover:text-rose-400 group-hover:opacity-100 max-md:opacity-100" aria-label="Remove subtopic"><Trash2 size={13} /></button>
              </li>
            ))}
            {t.subs.length === 0 && <li className="text-xs text-slate-500">No subtopics yet. Add the first one below.</li>}
          </ul>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()} placeholder="Add a subtopic" className="input !py-2 text-xs" />
            <button onClick={addSub} className="btn-ghost !py-2 text-xs"><Plus size={13} /> Add</button>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => go('courses', code, t.id)} className="btn-primary text-xs"><BookOpen size={14} /> Open topic: resources &amp; notes</button>
            <button onClick={() => go('practice', code, 'practice', t.id)} className="btn-ghost text-xs"><Dumbbell size={14} /> Practice questions</button>
            {t.custom && <button onClick={rmTopic} className="btn-danger text-xs"><Trash2 size={14} /> Delete topic</button>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CourseDetail({ state, refresh, code }) {
  const { summary } = useStudy()
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState(null)
  if (!state) return <Empty title="Loading…" />
  const subject = state.subjects.find((s) => state.subject_codes[s] === code)
  if (!subject) return <Empty title="Course not found" hint="Go back to Courses and pick one." />
  const { color, icon: Icon } = styleFor(code)
  const st = subjectStats(state, summary, subject)
  const groups = courseLayout(st.topics)
  const pr = summary?.practice?.[subject] || {}
  const daysSinceMock = pr.last_mock ? Math.floor((Date.now() - new Date(pr.last_mock)) / 86400000) : null
  const mockDue = st.pct > 0 && (daysSinceMock === null || daysSinceMock >= 7)
  const expanded = openId ?? st.next?.id
  let n = 0
  const q = encodeURIComponent
  const avg = pr.attempted ? Math.round((100 * pr.correct) / pr.attempted) : null

  return (
    <div className="space-y-6">
      <button onClick={() => go('courses')} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"><ArrowLeft size={15} /> All courses</button>

      <div className="card relative overflow-hidden p-5 sm:p-6">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: color + '22', color }}><Icon size={28} /></div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight">{subject}</h1>
            <p className="mt-1 text-sm text-slate-400">{st.done} of {st.topics.length} topics done · {st.subsDone}/{st.subsTotal} subtopics · <span className="clock-digits">{fmtDur(st.studied)}</span> studied of about {Math.round(st.est)}h</p>
          </div>
          <Ring pct={st.pct} color={color} size={68} stroke={6} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => go('practice', code, 'pyq')} className="btn-ghost"><FileQuestion size={15} /> PYQ-style test</button>
          <button onClick={() => go('practice', code, 'practice')} className="btn-ghost"><Dumbbell size={15} /> Practice questions</button>
          <button onClick={() => go('practice', code, 'mock')} className={mockDue ? 'btn-primary' : 'btn-ghost'}><Trophy size={15} /> Weekly mock test{mockDue ? ' · due' : ''}</button>
          <a className="btn-ghost" target="_blank" rel="noreferrer" href={`https://www.google.com/search?q=${q('GATE DA previous year questions ' + subject)}`}><ExternalLink size={14} /> Real GATE PYQs</a>
        </div>
        {(pr.pyq || pr.practice || pr.mock) ? (
          <p className="mt-3 text-xs text-slate-500">Attempts: {pr.pyq || 0} PYQ-style · {pr.practice || 0} practice · {pr.mock || 0} mock{avg !== null ? ` · average ${avg}%` : ''}{pr.last_mock ? ` · last mock ${pr.last_mock}` : ''}</p>
        ) : null}
      </div>

      {groups.map((g, gi) => {
        const gDone = g.topics.filter((t) => t.status === 'Done').length
        return (
          <section key={g.name || gi} className="space-y-3">
            {g.name && (
              <div className="flex items-baseline justify-between border-b border-white/10 pb-2">
                <h2 className="text-lg font-bold">{groups.length > 1 ? `Part ${gi + 1}: ${g.name}` : g.name}</h2>
                <span className="text-xs text-slate-500">{gDone}/{g.topics.length} topics</span>
              </div>
            )}
            {g.topics.map((t) => {
              n += 1
              return <Unit key={t.id} t={t} n={n} color={color} code={code} refresh={refresh} studied={summary?.by_topic?.[t.id]}
                open={expanded === t.id} toggle={() => setOpenId(expanded === t.id ? '' : t.id)} />
            })}
          </section>
        )
      })}

      {adding
        ? <AddTopic subject={subject} sections={[...new Set(st.topics.map((t) => t.section).filter(Boolean))]} onDone={() => { setAdding(false); refresh() }} onCancel={() => setAdding(false)} />
        : <button onClick={() => setAdding(true)} className="btn-ghost w-full border-dashed py-3"><Plus size={16} /> Add a topic to {subject}</button>}

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4" style={{ borderColor: color + '55' }}>
        <div className="flex items-center gap-3">
          <Trophy size={20} style={{ color }} />
          <div>
            <div className="text-sm font-bold">Weekly mock test</div>
            <div className="text-xs text-slate-400">{pr.last_mock ? `Last taken ${pr.last_mock} · best ${pr.best_mock}%` : 'A mixed test across the topics you have studied. Take one every week.'}</div>
          </div>
        </div>
        <button onClick={() => go('practice', code, 'mock')} className="btn-primary">Start mock test</button>
      </div>
    </div>
  )
}
