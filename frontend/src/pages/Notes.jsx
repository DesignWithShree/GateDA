import React, { useEffect, useMemo, useState } from 'react'
import { Download, Search, StickyNote } from 'lucide-react'
import { get } from '../api'
import Markdown from '../components/Markdown.jsx'
import Empty from '../components/Empty.jsx'
import { go } from '../lib/route.js'
import { styleFor } from '../lib/subjects.js'

export default function Notes({ state }) {
  const [items, setItems] = useState(null)
  const [q, setQ] = useState('')
  const [subject, setSubject] = useState('')
  useEffect(() => { get('/notes').then(setItems).catch(() => setItems([])) }, [])
  const codes = state?.subject_codes || {}

  const shown = useMemo(() => (items || []).filter((n) =>
    (!subject || n.subject === subject) &&
    (!q.trim() || (n.subtopic + n.topic + n.notes + n.short).toLowerCase().includes(q.toLowerCase()))), [items, q, subject])

  const exportMd = () => {
    const md = shown.map((n) => `## ${n.subject} › ${n.topic} › ${n.subtopic}\n\n${n.short ? `**Short notes**\n\n${n.short}\n\n` : ''}${n.notes ? `**My notes**\n\n${n.notes}\n` : ''}`).join('\n---\n\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }))
    a.download = 'gate-da-notes.md'; a.click()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Notes</h1>
          <p className="mt-1 text-sm text-slate-400">Every note and short note you write inside a subtopic, in one place.</p>
        </div>
        <button onClick={exportMd} disabled={!shown.length} className="btn-ghost"><Download size={15} /> Export as Markdown</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your notes" className="input !pl-9" />
        </div>
        <select value={subject} onChange={(e) => setSubject(e.target.value)} className="input !w-auto">
          <option value="">All subjects</option>
          {(state?.subjects || []).map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {items && shown.length === 0 && <Empty icon={StickyNote} title="No notes yet" hint="Open any subtopic from a course and use the My notes tab. Your notes will collect here." />}
      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((n) => {
          const c = styleFor(codes[n.subject]).color
          return (
            <div key={n.id} className="card flex flex-col p-4" style={{ borderTop: `3px solid ${c}` }}>
              <button onClick={() => go('courses', codes[n.subject], n.topic_id, n.id)} className="text-left">
                <div className="text-[11px]" style={{ color: c }}>{n.subject} · {n.topic}</div>
                <h3 className="mt-0.5 font-bold">{n.subtopic}</h3>
              </button>
              {n.short && <div className="mt-3 rounded-xl bg-white/[0.04] p-3 text-sm"><Markdown>{n.short}</Markdown></div>}
              {n.notes && <p className="mt-3 line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{n.notes}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
