import React, { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Dumbbell, ExternalLink, GraduationCap, Library, Link2, Play, Plus, Sparkles, StickyNote, Trash2, Video, BookMarked } from 'lucide-react'
import { del, get, post, put, searchLinks } from '../api'
import Empty from '../components/Empty.jsx'
import { useToast } from '../components/Toast.jsx'
import { useStudy } from '../lib/study.jsx'
import { courseLayout, fmtDur, styleFor } from '../lib/subjects.js'
import { go } from '../lib/route.js'

const q = encodeURIComponent
const yt = (s) => `https://www.youtube.com/results?search_query=${q(s)}`
const book = (s) => `https://www.google.com/search?q=${q(s + ' book')}`

export default function TopicPage({ state, refresh, code, tid, goTutor }) {
  const toast = useToast()
  const { summary, start, timer, setTopic } = useStudy()
  const [extra, setExtra] = useState({ links: [] })
  const [link, setLink] = useState({ title: '', url: '' })
  const [sub, setSub] = useState('')
  const loadExtra = () => get(`/topic/${tid}`).then(setExtra).catch(() => {})
  useEffect(() => { loadExtra() }, [tid])

  if (!state) return <Empty title="Loading…" />
  const t = state.topics.find((x) => x.id === tid)
  if (!t) return <Empty title="Topic not found" hint="It may have been deleted." />
  const { color } = styleFor(code)
  const order = courseLayout(state.topics.filter((x) => x.subject === t.subject)).flatMap((g) => g.topics)
  const i = order.findIndex((x) => x.id === tid)
  const prev = order[i - 1], next = order[i + 1]
  const pct = t.subs.length ? t.subs_done / t.subs.length : 0

  const setStatus = async (status) => { await put(`/progress/${tid}`, { status }); refresh() }
  const setConf = async (confidence) => { await put(`/progress/${tid}`, { confidence }); refresh() }
  const tick = async (s) => { await put(`/subtopics/${s.id}`, { done: !s.done }); refresh() }
  const addSub = async () => { if (!sub.trim()) return; await post(`/topics/${tid}/subtopics`, { name: sub }); setSub(''); refresh() }
  const addLink = async () => {
    if (!link.url.trim()) return
    await post(`/topic/${tid}/links`, link); setLink({ title: '', url: '' }); loadExtra()
  }
  const startTimer = () => {
    if (timer.running) setTopic(tid); else start({ topicId: tid })
    toast(`Timer is running on "${t.name}"`, 'success')
  }
  const sk = `${t.subject}/${t.section}`
  const courses = state.section_resources?.[sk] || state.subject_resources?.[t.subject] || []
  const books = state.section_books?.[sk] || state.subject_books?.[t.subject] || []

  return (
    <div className="space-y-6">
      <button onClick={() => go('courses', code)} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"><ArrowLeft size={15} /> {t.subject}</button>

      <div className="card relative overflow-hidden p-5 sm:p-6">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {t.section && <p className="mb-1 text-xs font-medium" style={{ color }}>{t.section}</p>}
            <h1 className="text-2xl font-extrabold tracking-tight">{t.name}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">{t.scope}</p>
            <p className="mt-2 text-xs text-slate-500">{t.difficulty} · about {t.hours}h · <span className="clock-digits">{fmtDur(summary?.by_topic?.[tid])}</span> studied so far</p>
          </div>
          <button onClick={startTimer} className="btn-primary"><Play size={15} /> Start timer for this topic</button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-xs font-semibold text-slate-400">Status</div>
            <div className="flex flex-wrap gap-1.5">
              {['Not started', 'Learning', 'Done', 'Revise'].map((s) => (
                <button key={s} onClick={() => setStatus(s)} className={`btn !px-3 !py-1.5 text-xs ${t.status === s ? 'btn-primary' : 'btn-ghost'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold text-slate-400">How confident do you feel?</div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((c) => (
                <button key={c} onClick={() => setConf(c)} className={`btn !px-3.5 !py-1.5 text-xs ${t.confidence === c ? 'btn-primary' : 'btn-ghost'}`}>{c}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold">Subtopics</h2>
            <span className="text-xs text-slate-500">{t.subs_done}/{t.subs.length} studied</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all" style={{ width: `${pct * 100}%`, background: color }} /></div>
          <ul className="space-y-2">
            {t.subs.map((s, k) => (
              <li key={s.id} className="card flex items-center gap-3 p-3">
                <button onClick={() => tick(s)} aria-label="Toggle studied" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition"
                  style={s.done ? { background: color, borderColor: color, color: '#0b0d13' } : { borderColor: 'rgba(255,255,255,.2)' }}>
                  {s.done ? <Check size={15} strokeWidth={3} /> : <span className="text-xs text-slate-500">{k + 1}</span>}
                </button>
                <button onClick={() => go('courses', code, tid, s.id)} className="min-w-0 flex-1 text-left">
                  <div className={`truncate text-sm font-semibold ${s.done ? 'text-slate-400' : ''}`}>{s.name}</div>
                  <div className="mt-0.5 flex gap-3 text-[11px] text-slate-500">
                    <span className={s.has_lesson ? 'text-brand-400' : ''}>{s.has_lesson ? 'AI notes ready' : 'No AI notes yet'}</span>
                    {s.has_notes && <span className="flex items-center gap-1 text-sky-300"><StickyNote size={11} /> your notes</span>}
                  </div>
                </button>
                <button onClick={() => go('courses', code, tid, s.id)} className="btn-ghost !px-3 !py-1.5 text-xs">Learn <ArrowRight size={13} /></button>
              </li>
            ))}
            {t.subs.length === 0 && <li className="card p-4 text-sm text-slate-400">No subtopics yet. Add the first one below.</li>}
          </ul>
          <div className="flex gap-2">
            <input value={sub} onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()} placeholder="Add a subtopic" className="input" />
            <button onClick={addSub} className="btn-ghost"><Plus size={15} /> Add</button>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={() => go('practice', code, 'practice', tid)} className="btn-ghost"><Dumbbell size={15} /> Practice this topic</button>
            <button onClick={() => go('practice', code, 'pyq', tid)} className="btn-ghost">PYQ-style questions</button>
            <button onClick={() => goTutor(tid)} className="btn-ghost"><GraduationCap size={15} /> Ask the tutor</button>
          </div>
          <div className="flex justify-between pt-3 text-sm">
            {prev ? <button onClick={() => go('courses', code, prev.id)} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100"><ArrowLeft size={14} /> {prev.name}</button> : <span />}
            {next ? <button onClick={() => go('courses', code, next.id)} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100">{next.name} <ArrowRight size={14} /></button> : <span />}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="card space-y-4 p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold"><Library size={15} className="text-brand-400" /> Resources</h2>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-400"><Video size={13} /> Courses to follow</div>
              <ul className="space-y-1">{courses.map((c) => <li key={c}><a href={yt(c)} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5"><span>{c}</span><ExternalLink size={12} className="shrink-0 text-slate-500" /></a></li>)}</ul>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-400"><BookMarked size={13} /> Books to refer</div>
              <ul className="space-y-1">{books.map((c) => <li key={c}><a href={book(c)} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5"><span>{c}</span><ExternalLink size={12} className="shrink-0 text-slate-500" /></a></li>)}</ul>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-400"><Sparkles size={13} /> Search this topic</div>
              <div className="flex flex-wrap gap-1.5">{searchLinks(t.name).map((l) => <a key={l.label} href={l.url} target="_blank" rel="noreferrer" className="btn-ghost !px-2.5 !py-1 text-xs">{l.label}</a>)}</div>
            </div>
          </div>

          <div className="card space-y-3 p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold"><Link2 size={15} className="text-brand-400" /> Your saved links</h2>
            <ul className="space-y-1">
              {extra.links.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
                  <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate">{l.title || l.url}</a>
                  <button onClick={async () => { await del(`/links/${l.id}`); loadExtra() }} className="text-slate-500 hover:text-rose-400"><Trash2 size={13} /></button>
                </li>
              ))}
              {extra.links.length === 0 && <li className="text-xs text-slate-500">Paste a course, video or article you want to follow for this topic.</li>}
            </ul>
            <div className="space-y-2">
              <input value={link.title} onChange={(e) => setLink({ ...link, title: e.target.value })} placeholder="Title (optional)" className="input !py-2 text-xs" />
              <div className="flex gap-2">
                <input value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addLink()} placeholder="https://…" className="input !py-2 text-xs" />
                <button onClick={addLink} className="btn-ghost !py-2 text-xs"><Plus size={13} /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
