import React, { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Plus, Trash2, Trophy } from 'lucide-react'
import { get, post, del } from '../api'
import { useToast } from '../components/Toast.jsx'
import Empty from '../components/Empty.jsx'

export default function MockTests({ state }) {
  const toast = useToast()
  const [tests, setTests] = useState([])
  const [form, setForm] = useState({ name: '', date: new Date().toISOString().slice(0, 10), total_marks: 100, obtained_marks: '' })
  const [breakdown, setBreakdown] = useState({})
  const [showForm, setShowForm] = useState(false)

  const load = () => get('/mocktests').then(setTests).catch(() => {})
  useEffect(() => { load() }, [])

  const stats = useMemo(() => {
    if (!tests.length) return null
    const pct = tests.map((t) => (t.obtained_marks / t.total_marks) * 100)
    return {
      last: pct[pct.length - 1].toFixed(1),
      best: Math.max(...pct).toFixed(1),
      avg: (pct.reduce((a, b) => a + b, 0) / pct.length).toFixed(1),
      trend: pct.length >= 2 ? (pct[pct.length - 1] - pct[pct.length - 2]).toFixed(1) : null,
    }
  }, [tests])

  const chartData = tests.map((t) => ({ date: t.date.slice(5), pct: +((t.obtained_marks / t.total_marks) * 100).toFixed(1), name: t.name }))

  const submit = async () => {
    if (!form.name.trim() || form.obtained_marks === '') { toast('Fill in name and score', 'error'); return }
    const bd = Object.fromEntries(Object.entries(breakdown).filter(([, v]) => v !== '' && v != null))
    await post('/mocktests', { ...form, total_marks: +form.total_marks, obtained_marks: +form.obtained_marks, breakdown: bd })
    setForm({ name: '', date: new Date().toISOString().slice(0, 10), total_marks: 100, obtained_marks: '' })
    setBreakdown({}); setShowForm(false)
    toast('Mock test logged', 'success')
    load()
  }

  const remove = async (id) => { await del(`/mocktests/${id}`); load() }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Mock Tests</h1>
          <p className="mt-1 text-sm text-slate-400">Log full-length and sectional mocks, watch your trend.</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary"><Plus size={15} /> Log a test</button>
      </div>

      {showForm && (
        <div className="card animate-fadeUp space-y-3 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Test name (e.g. GATE Overflow Mock 3)" className="input" />
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="input" />
            <input type="number" value={form.total_marks} onChange={(e) => setForm((f) => ({ ...f, total_marks: e.target.value }))} placeholder="Total marks" className="input" />
            <input type="number" value={form.obtained_marks} onChange={(e) => setForm((f) => ({ ...f, obtained_marks: e.target.value }))} placeholder="Your score" className="input" />
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold text-slate-400">Subject-wise score (optional)</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(state?.subjects || []).map((s) => (
                <input key={s} value={breakdown[s] || ''} onChange={(e) => setBreakdown((b) => ({ ...b, [s]: e.target.value }))}
                  placeholder={s} className="input !py-1.5 text-xs" type="number" />
              ))}
            </div>
          </div>
          <button onClick={submit} className="btn-primary">Save</button>
        </div>
      )}

      {!tests.length ? (
        <Empty icon={Trophy} title="No mock tests logged yet" hint="Log your first attempt to start tracking your trend." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card p-4"><div className="mb-1 text-xs text-slate-400">Last score</div><div className="text-2xl font-extrabold">{stats.last}%</div></div>
            <div className="card p-4"><div className="mb-1 text-xs text-slate-400">Best score</div><div className="text-2xl font-extrabold text-emerald-500">{stats.best}%</div></div>
            <div className="card p-4"><div className="mb-1 text-xs text-slate-400">Average</div><div className="text-2xl font-extrabold">{stats.avg}%</div></div>
            <div className="card p-4">
              <div className="mb-1 text-xs text-slate-400">Trend</div>
              <div className={`text-2xl font-extrabold ${stats.trend > 0 ? 'text-emerald-500' : stats.trend < 0 ? 'text-rose-500' : ''}`}>
                {stats.trend === null ? '—' : `${stats.trend > 0 ? '+' : ''}${stats.trend}%`}
              </div>
            </div>
          </div>

          <div className="card p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-bold">Score trend</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}
                    formatter={(v) => [`${v}%`, 'Score']} labelFormatter={(l, p) => p?.[0]?.payload?.name || l} />
                  <Line type="monotone" dataKey="pct" stroke="#f6ac3c" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card divide-y divide-slate-100 dark:divide-white/5">
            {[...tests].reverse().map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-slate-400">{t.date} · {t.obtained_marks}/{t.total_marks} ({((t.obtained_marks / t.total_marks) * 100).toFixed(1)}%)
                    {Object.keys(t.breakdown || {}).length > 0 && <> · {Object.entries(t.breakdown).map(([k, v]) => `${k}: ${v}`).join(', ')}</>}
                  </div>
                </div>
                <button onClick={() => remove(t.id)} className="btn-ghost !px-2 !py-1.5 text-rose-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
