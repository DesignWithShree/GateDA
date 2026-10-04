import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, Pencil, Play, RefreshCw, Send, Sparkles, StickyNote, Trash2, Wand2, BookOpen } from 'lucide-react'
import { del, get, post, put, streamSSE } from '../api'
import Markdown from '../components/Markdown.jsx'
import Empty from '../components/Empty.jsx'
import { useToast } from '../components/Toast.jsx'
import { useStudy } from '../lib/study.jsx'
import { styleFor } from '../lib/subjects.js'
import { go } from '../lib/route.js'

export default function SubtopicPage({ state, refresh, code, tid, sid }) {
  const toast = useToast()
  const { start, timer, setTopic } = useStudy()
  const [row, setRow] = useState(null)
  const [tab, setTab] = useState('learn')
  const [lesson, setLesson] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState('')
  const [checking, setChecking] = useState(false)
  const [notes, setNotes] = useState('')
  const [short, setShort] = useState('')
  const [saved, setSaved] = useState('')
  const [condensing, setCondensing] = useState(false)
  const abort = useRef(null)
  const timerRef = useRef(null)

  const load = useCallback(() => get(`/subtopics/${sid}`).then((r) => {
    setRow(r); setLesson(r.ai_notes || ''); setNotes(r.notes || ''); setShort(r.short || '')
  }).catch((e) => setErr(e.message)), [sid])

  useEffect(() => {
    setRow(null); setLesson(''); setFeedback(''); setAnswer(''); setErr(''); setTab('learn'); setSaved('')
    load()
    return () => abort.current?.abort()
  }, [sid, load])

  const generate = (regenerate = false) => {
    abort.current?.abort()
    const ac = new AbortController(); abort.current = ac
    setBusy(true); setErr(''); setLesson(''); setFeedback(''); setAnswer('')
    let acc = ''
    streamSSE(`/subtopics/${sid}/lesson`, { regenerate }, (e) => {
      if (e.type === 'token') { acc += e.text; setLesson(acc) }
      else if (e.type === 'error') setErr(e.text)
      else if (e.type === 'done') { setBusy(false); refresh() }
    }, ac.signal).catch((e) => { if (e.name !== 'AbortError') { setErr(e.message); setBusy(false) } })
  }

  const check = () => {
    if (!answer.trim()) return
    abort.current?.abort()
    const ac = new AbortController(); abort.current = ac
    setChecking(true); setFeedback(''); setErr('')
    let acc = ''
    streamSSE(`/subtopics/${sid}/check`, { answer }, (e) => {
      if (e.type === 'token') { acc += e.text; setFeedback(acc) }
      else if (e.type === 'error') setErr(e.text)
      else if (e.type === 'done') setChecking(false)
    }, ac.signal).catch((e) => { if (e.name !== 'AbortError') { setErr(e.message); setChecking(false) } })
  }

  const onNotes = (v) => {
    setNotes(v); setSaved('Saving…')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try { await put(`/subtopics/${sid}`, { notes: v }); setSaved('Saved'); refresh() } catch (e) { setSaved('Not saved: ' + e.message) }
    }, 700)
  }
  const saveShort = async () => { await put(`/subtopics/${sid}`, { short }); toast('Short notes saved', 'success') }
  const condense = async () => {
    setCondensing(true)
    try { const r = await post(`/subtopics/${sid}/shortnotes`); setShort(r.short); toast('Short notes ready', 'success'); refresh() }
    catch (e) { toast(e.message, 'error') }
    setCondensing(false)
  }
  const toggleDone = async () => { await put(`/subtopics/${sid}`, { done: !row.done }); load(); refresh() }
  const rename = async () => {
    const n = prompt('Rename subtopic', row.name)
    if (n && n.trim()) { await put(`/subtopics/${sid}`, { name: n }); load(); refresh() }
  }
  const remove = async () => {
    if (!confirm(`Remove "${row.name}" and its notes?`)) return
    await del(`/subtopics/${sid}`); refresh(); go('courses', code, tid)
  }
  const startTimer = () => { if (timer.running) setTopic(tid); else start({ topicId: tid }); toast('Study timer started', 'success') }

  const t = state?.topics.find((x) => x.id === tid)
  if (err && !row) return <Empty title="Couldn't open this subtopic" hint={err} />
  if (!row || !t) return <Empty title="Loading…" />
  const { color } = styleFor(code)
  const i = t.subs.findIndex((s) => s.id === Number(sid))
  const prev = t.subs[i - 1], next = t.subs[i + 1]
  const noKey = /api key/i.test(err)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <button onClick={() => go('courses', code, tid)} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"><ArrowLeft size={15} /> {t.name}</button>

      <div className="card relative overflow-hidden p-5">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
        <p className="text-xs text-slate-500">{t.subject} · {t.name}</p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{row.name}</h1>
          <div className="flex items-center gap-1">
            <button onClick={rename} className="btn-ghost !px-2 !py-1.5" aria-label="Rename"><Pencil size={14} /></button>
            <button onClick={remove} className="btn-ghost !px-2 !py-1.5 text-rose-300" aria-label="Remove"><Trash2 size={14} /></button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={toggleDone} className={row.done ? 'btn-primary' : 'btn-ghost'}>{row.done ? <CheckCircle2 size={15} /> : <Check size={15} />} {row.done ? 'Studied' : 'Mark as studied'}</button>
          <button onClick={startTimer} className="btn-ghost"><Play size={15} /> Start timer</button>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl border border-white/10 bg-ink-800/60 p-1">
        {[['learn', 'Learn with notes', BookOpen], ['notes', 'My notes', StickyNote]].map(([id, label, I]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === id ? 'bg-brand-500 text-ink-950' : 'text-slate-400 hover:text-slate-100'}`}>
            <I size={15} /> {label}
          </button>
        ))}
      </div>

      {err && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {err}
          {noKey && <button onClick={() => go('settings')} className="ml-2 font-semibold underline">Open Settings</button>}
        </div>
      )}

      {tab === 'learn' && (
        <div className="space-y-4">
          {!lesson && !busy && (
            <div className="card flex flex-col items-center gap-3 p-8 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/15 text-brand-400"><Sparkles size={22} /></div>
              <h2 className="text-lg font-bold">Learn this with AI notes</h2>
              <p className="max-w-md text-sm text-slate-400">You get what it is, why it matters, the syntax or formula, a worked example, common mistakes, and then one question to solve yourself.</p>
              <button onClick={() => generate(false)} className="btn-primary mt-1"><Wand2 size={15} /> Generate notes</button>
            </div>
          )}
          {(lesson || busy) && (
            <div className="card p-5">
              {busy && !lesson && <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={15} className="animate-spin" /> Writing your notes…</div>}
              <Markdown>{lesson}</Markdown>
              {busy && lesson && <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Loader2 size={12} className="animate-spin" /> still writing…</div>}
            </div>
          )}

          {lesson && !busy && (
            <>
              <div className="card space-y-3 p-5">
                <h2 className="text-sm font-bold">Your answer</h2>
                <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={5} className="input font-mono text-[13px]" placeholder="Type your answer or your code here…" />
                <div className="flex flex-wrap gap-2">
                  <button onClick={check} disabled={checking || !answer.trim()} className="btn-primary">{checking ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Check my answer</button>
                  <button onClick={() => generate(true)} className="btn-ghost"><RefreshCw size={14} /> New notes &amp; question</button>
                  <button onClick={() => setTab('notes')} className="btn-ghost"><StickyNote size={14} /> Take notes</button>
                </div>
                {feedback && <div className="rounded-xl border border-white/10 bg-black/20 p-4"><Markdown>{feedback}</Markdown></div>}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-4">
          <div className="card space-y-2 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Your notes</h2>
              <span className="text-xs text-slate-500">{saved}</span>
            </div>
            <textarea value={notes} onChange={(e) => onNotes(e.target.value)} rows={12} className="input leading-relaxed" placeholder="Write what you understood, formulas, tricks, doubts… Everything saves automatically and shows up on the Notes page." />
          </div>
          <div className="card space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">Short notes (for quick revision)</h2>
              <button onClick={condense} disabled={condensing} className="btn-ghost !py-1.5 text-xs">{condensing ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Condense with AI</button>
            </div>
            <textarea value={short} onChange={(e) => setShort(e.target.value)} rows={6} className="input" placeholder="A few bullets you want to remember. Write them yourself, or let the AI condense your notes and the lesson." />
            <button onClick={saveShort} className="btn-primary">Save short notes</button>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2 text-sm">
        {prev ? <button onClick={() => go('courses', code, tid, prev.id)} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100"><ArrowLeft size={14} /> {prev.name}</button> : <span />}
        {next ? <button onClick={() => go('courses', code, tid, next.id)} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100">{next.name} <ArrowRight size={14} /></button> : <span />}
      </div>
    </div>
  )
}
