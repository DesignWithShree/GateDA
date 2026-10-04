import React, { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Target as TargetIcon, RotateCcw, FileQuestion, Trash2, Send, Sparkles, ChevronDown } from 'lucide-react'
import { get, del, put, streamSSE } from '../api'
import Markdown from '../components/Markdown.jsx'
import ThinkingTrace from '../components/ThinkingTrace.jsx'
import Sources from '../components/Sources.jsx'
import Empty from '../components/Empty.jsx'

const QUICK = [
  { mode: 'lesson', label: 'Teach me this', icon: BookOpen, needsTopic: true, build: (n) => `Teach me the topic "${n}".` },
  { mode: 'practice', label: 'Practice question', icon: TargetIcon, needsTopic: true, build: (n) => `Give me one new GATE-style practice question on "${n}". No answer.` },
  { mode: 'quiz', label: '3-question quiz', icon: FileQuestion, needsTopic: true, build: (n) => `Give me a 3-question quiz on "${n}".` },
  { mode: 'revise', label: 'Revision sheet', icon: RotateCcw, needsTopic: true, build: (n) => `Give me a revision cheat-sheet for "${n}".` },
]

export default function Tutor({ state, topicId, setTopicId }) {
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [useRag, setUseRag] = useState(false)
  const [deep, setDeep] = useState(true)
  const [err, setErr] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const bottomRef = useRef(null)
  const abortRef = useRef(null)

  const key = topicId || 'general'
  const topic = state?.topics.find((t) => t.id === topicId)

  useEffect(() => { get(`/chat/${key}`).then(setMsgs).catch(() => setMsgs([])) }, [key])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])

  const send = async (text, mode = 'doubt') => {
    if (!text.trim() || busy) return
    setErr('')
    const history = [...msgs, { role: 'user', content: text }]
    setMsgs(history)
    setInput('')
    setBusy(true)
    let liveSteps = []
    let liveSources = []
    let liveText = ''
    setMsgs((m) => [...m, { role: 'assistant', content: '', meta: { steps: [], sources: [] }, live: true }])
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      await streamSSE('/chat', { message: text, topic_id: topicId, mode, use_rag: useRag, deep }, (e) => {
        if (e.type === 'step') { liveSteps = [...liveSteps, e.text]; patchLast({ meta: { steps: liveSteps, sources: liveSources } }) }
        else if (e.type === 'sources') { liveSources = e.data; patchLast({ meta: { steps: liveSteps, sources: liveSources } }) }
        else if (e.type === 'token') { liveText += e.text; patchLast({ content: liveText }) }
        else if (e.type === 'error') setErr(e.text)
        else if (e.type === 'done') patchLast({ live: false })
      }, ctrl.signal)
    } catch (e) {
      if (e.name !== 'AbortError') setErr(e.message)
    } finally {
      setBusy(false)
      patchLast({ live: false })
    }
  }

  const patchLast = (patch) => setMsgs((m) => {
    if (!m.length) return m
    const copy = [...m]
    copy[copy.length - 1] = { ...copy[copy.length - 1], ...patch }
    return copy
  })

  const clearChat = async () => { await del(`/chat/${key}`); setMsgs([]) }

  const saveProgress = async (patch) => { if (topicId) await put(`/progress/${topicId}`, patch) }

  const lastAssistantAnswered = msgs.length && msgs[msgs.length - 1].role === 'assistant' && !msgs[msgs.length - 1].live && !err

  if (!state) return null

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col md:h-[calc(100vh-4rem)]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <button onClick={() => setPickerOpen((o) => !o)} className="input flex items-center justify-between !py-2 text-left">
            <span className="truncate">{topic ? `${topic.subject} › ${topic.name}` : 'General doubt (no topic)'}</span>
            <ChevronDown size={15} className={`shrink-0 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
          </button>
          {pickerOpen && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-ink-800">
              <button onClick={() => { setTopicId(null); setPickerOpen(false) }} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5">General doubt (no topic)</button>
              {state.subjects.map((s) => (
                <div key={s}>
                  <div className="bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:bg-white/5">{s}</div>
                  {state.topics.filter((t) => t.subject === s).map((t) => (
                    <button key={t.id} onClick={() => { setTopicId(t.id); setPickerOpen(false) }} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5">{t.name}</button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={clearChat} className="btn-ghost !px-2.5" title="Clear chat"><Trash2 size={15} /></button>
      </div>

      {topic && (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button key={q.mode} onClick={() => send(q.build(topic.name), q.mode)} disabled={busy} className="btn-ghost !px-2.5 text-xs">
                <q.icon size={13} /> {q.label}
              </button>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-white/10">
            <span className="text-slate-400">Progress:</span>
            <select value={topic.status} onChange={(e) => saveProgress({ status: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-ink-800">
              {['Not started', 'Learning', 'Done', 'Revise'].map((s) => <option key={s}>{s}</option>)}
            </select>
            <input type="range" min={0} max={5} value={topic.confidence} onChange={(e) => saveProgress({ confidence: +e.target.value })} className="w-24 accent-brand-500" />
            <span className="text-slate-400">Confidence {topic.confidence}/5</span>
          </div>
        </>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5 font-medium">
          <input type="checkbox" checked={useRag} onChange={(e) => setUseRag(e.target.checked)} className="accent-brand-500" />
          📚 Use my library notes (RAG)
        </label>
        <label className="flex items-center gap-1.5 font-medium">
          <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} className="accent-brand-500" />
          <Sparkles size={12} className="text-brand-500" /> Deep reasoning (plan → verify → answer)
        </label>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/50 p-3 dark:border-white/10 dark:bg-white/[0.02] sm:p-4">
        {msgs.length === 0 && <Empty icon={Sparkles} title="Ask a doubt, or use a quick action above" hint="Lessons follow a fixed structure: definition, why it exists, core idea, comparison, GATE angle, example, then a practice question." />}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[80%] ${m.role === 'user' ? 'bg-gradient-to-br from-brand-500 to-violet-600 text-white' : 'card'}`}>
              {m.role === 'assistant' && <ThinkingTrace steps={m.meta?.steps} live={m.live && !m.content} />}
              {m.role === 'user' ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> :
                m.content ? <Markdown>{m.content}</Markdown> : (m.live ? null : <p className="text-sm text-slate-400">…</p>)}
              {m.role === 'assistant' && <Sources sources={m.meta?.sources} />}
            </div>
          </div>
        ))}
        {err && <div className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-500">{err}</div>}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex items-end gap-2">
        <textarea value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder="Ask a doubt, or answer the practice question…" rows={1}
          className="input max-h-32 min-h-[44px] flex-1 resize-none" />
        <button onClick={() => send(input, lastAssistantAnswered ? 'check' : 'doubt')} disabled={busy || !input.trim()} className="btn-primary !px-3.5 !py-3">
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
