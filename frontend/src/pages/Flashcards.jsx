import React, { useEffect, useState } from 'react'
import { Layers, Sparkles, RotateCw, Check, X, Clock } from 'lucide-react'
import { get, post, del } from '../api'
import { useToast } from '../components/Toast.jsx'
import Empty from '../components/Empty.jsx'
import { Inline } from '../components/Markdown.jsx'

const GRADES = [
  { id: 'again', label: 'Again', color: 'bg-rose-500 hover:bg-rose-600' },
  { id: 'hard', label: 'Hard', color: 'bg-amber-500 hover:bg-amber-600' },
  { id: 'good', label: 'Good', color: 'bg-brand-500 hover:bg-brand-600' },
  { id: 'easy', label: 'Easy', color: 'bg-emerald-500 hover:bg-emerald-600' },
]

export default function Flashcards({ state }) {
  const toast = useToast()
  const [stats, setStats] = useState(null)
  const [topicId, setTopicId] = useState('')
  const [count, setCount] = useState(8)
  const [generating, setGenerating] = useState(false)
  const [queue, setQueue] = useState(null) // null = not started
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const loadStats = () => get('/flashcards/stats').then(setStats).catch(() => {})
  useEffect(() => { loadStats() }, [])

  const startReview = async () => {
    const cards = await get('/flashcards?due_only=true')
    if (!cards.length) { toast('Nothing due right now', 'info'); return }
    setQueue(cards); setIdx(0); setFlipped(false)
  }

  const generate = async () => {
    if (!topicId) { toast('Pick a topic first', 'error'); return }
    setGenerating(true)
    try {
      const r = await post('/flashcards/generate', { topic_id: topicId, count: +count })
      toast(`Generated ${r.created} flashcards`, 'success')
      loadStats()
    } catch (e) { toast(e.message, 'error') }
    setGenerating(false)
  }

  const grade = async (g) => {
    const card = queue[idx]
    await post(`/flashcards/${card.id}/review`, { grade: g })
    if (idx + 1 < queue.length) { setIdx(idx + 1); setFlipped(false) }
    else { setQueue(null); loadStats(); toast('Review session complete', 'success') }
  }

  if (!state) return null

  if (queue) {
    const card = queue[idx]
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>Card {idx + 1} of {queue.length}</span>
          <button onClick={() => setQueue(null)} className="btn-ghost !px-2.5 !py-1 text-xs">Exit</button>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all" style={{ width: `${((idx) / queue.length) * 100}%` }} />
        </div>

        <button onClick={() => setFlipped((f) => !f)}
          className="card flex min-h-[260px] w-full flex-col items-center justify-center gap-4 p-8 text-center transition hover:shadow-glow">
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-500">{card.topic_name}</span>
          <div className="text-lg font-semibold leading-relaxed"><Inline>{flipped ? card.back : card.front}</Inline></div>
          {!flipped && <span className="flex items-center gap-1.5 text-xs text-slate-400"><RotateCw size={12} /> Tap to reveal answer</span>}
        </button>

        {flipped ? (
          <div className="grid grid-cols-4 gap-2">
            {GRADES.map((g) => (
              <button key={g.id} onClick={() => grade(g.id)} className={`btn !py-3 text-xs font-bold text-white ${g.color}`}>{g.label}</button>
            ))}
          </div>
        ) : (
          <button onClick={() => setFlipped(true)} className="btn-primary w-full !py-3">Show answer</button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Flashcards</h1>
        <p className="mt-1 text-sm text-slate-400">AI-generated spaced-repetition cards — reviews are scheduled automatically.</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card p-4"><div className="mb-1 text-xs text-slate-400">Total cards</div><div className="text-2xl font-extrabold">{stats.total}</div></div>
          <div className={`card p-4 ${stats.due > 0 ? 'ring-1 ring-brand-400/40' : ''}`}><div className="mb-1 text-xs text-slate-400">Due now</div><div className="text-2xl font-extrabold text-brand-500">{stats.due}</div></div>
          <div className="card p-4"><div className="mb-1 text-xs text-slate-400">New</div><div className="text-2xl font-extrabold">{stats.new}</div></div>
          <div className="card p-4"><div className="mb-1 text-xs text-slate-400">Mature (21d+)</div><div className="text-2xl font-extrabold text-emerald-500">{stats.mature}</div></div>
        </div>
      )}

      <div className="card p-4 sm:p-5">
        <button onClick={startReview} disabled={!stats?.due} className="btn-primary w-full !py-3 disabled:opacity-40">
          <Clock size={16} /> {stats?.due ? `Review ${stats.due} due card${stats.due > 1 ? 's' : ''}` : 'Nothing due right now'}
        </button>
      </div>

      <div className="card space-y-3 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Sparkles size={15} className="text-brand-500" /> Generate new cards</h2>
        <div className="flex flex-wrap gap-2">
          <select value={topicId} onChange={(e) => setTopicId(e.target.value)} className="input flex-1 !py-2 text-sm">
            <option value="">Pick a topic…</option>
            {state.subjects.map((s) => (
              <optgroup key={s} label={s}>
                {state.topics.filter((t) => t.subject === s).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            ))}
          </select>
          <input type="number" min={3} max={15} value={count} onChange={(e) => setCount(e.target.value)} className="input !w-20 !py-2 text-sm" />
          <button onClick={generate} disabled={generating} className="btn-primary">{generating ? 'Generating…' : 'Generate'}</button>
        </div>
        <p className="text-xs text-slate-400">Needs an API key set in Settings. New cards start in today's queue and get rescheduled after each review.</p>
      </div>
    </div>
  )
}
