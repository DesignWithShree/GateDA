import React, { useEffect, useState } from 'react'
import { KeyRound, CheckCircle2, XCircle, Loader2, Sparkles, Clock, Plus, Trash2, ExternalLink, Download, Upload, DatabaseBackup } from 'lucide-react'
import { get, put, post } from '../api'
import { useToast } from '../components/Toast.jsx'

export default function SettingsPage({ refresh }) {
  const toast = useToast()
  const [s, setS] = useState(null)
  const [form, setForm] = useState(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = () => get('/settings').then((r) => { setS(r); setForm({ ...r, anthropic_key: '', gemini_key: '' }) })
  useEffect(() => { load() }, [])

  if (!form) return null

  const save = async () => {
    setSaving(true)
    try {
      await put('/settings', form)
      toast('Settings saved', 'success')
      load(); refresh?.()
    } catch (e) { toast(e.message, 'error') }
    setSaving(false)
  }

  const test = async () => {
    setTesting(true); setTestResult(null)
    try {
      const r = await post('/settings/test')
      setTestResult(r)
    } catch (e) { setTestResult({ ok: false, error: e.message }) }
    setTesting(false)
  }

  const setBlock = (i, field, val) => setForm((f) => {
    const blocks = [...f.study_blocks]
    blocks[i] = { ...blocks[i], [field]: val }
    return { ...f, study_blocks: blocks }
  })
  const addBlock = () => setForm((f) => ({ ...f, study_blocks: [...f.study_blocks, { start: '09:00', end: '10:00' }] }))
  const removeBlock = (i) => setForm((f) => ({ ...f, study_blocks: f.study_blocks.filter((_, idx) => idx !== i) }))

  const totalBlockHours = form.study_blocks.reduce((sum, b) => {
    const [sh, sm] = b.start.split(':').map(Number); const [eh, em] = b.end.split(':').map(Number)
    const mins = (eh * 60 + em) - (sh * 60 + sm)
    return sum + (mins > 0 ? mins / 60 : 0)
  }, 0)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Your API key, exam date, and daily study schedule.</p>
      </div>

      <div className="card space-y-3 border-brand-500/30 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Sparkles size={15} className="text-brand-400" /> How to add your API key (2 minutes)</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
          <li><b>Pick a provider.</b> <b>Gemini</b> is free and good enough for notes, quizzes and flashcards, so start there. <b>Anthropic (Claude)</b> writes the best explanations but is paid.</li>
          <li><b>Create a key.</b> Gemini: open <a className="underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a> and press <i>Create API key</i>. Claude: open <a className="underline" href="https://console.anthropic.com/" target="_blank" rel="noreferrer">console.anthropic.com</a>, add credit, then <i>API keys</i> and <i>Create key</i>.</li>
          <li><b>Paste it below</b> in the matching box (Gemini keys start with <code>AIza</code>, Claude keys with <code>sk-ant-</code>), make sure that provider is selected, and press <b>Save settings</b>.</li>
          <li>Press <b>Test AI connection</b>. If you see a reply, notes, tests and the tutor are ready.</li>
        </ol>
        <p className="text-xs text-slate-500">Deploying this online? Set the key as the <code>GEMINI_API_KEY</code> or <code>ANTHROPIC_API_KEY</code> environment variable on your host instead of typing it here, and set <code>APP_PASSWORD</code> so only you can open the site.</p>
      </div>

      <div className="card space-y-4 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold"><KeyRound size={15} className="text-brand-500" /> AI provider</h2>
        <div className="flex gap-2">
          <button onClick={() => setForm((f) => ({ ...f, provider: 'Gemini' }))}
            className={`btn relative ${form.provider === 'Gemini' ? 'btn-primary' : 'btn-ghost'}`}>
            Gemini
            <span className="absolute -top-2 -right-2 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">FREE</span>
          </button>
          <button onClick={() => setForm((f) => ({ ...f, provider: 'Anthropic' }))}
            className={`btn ${form.provider === 'Anthropic' ? 'btn-primary' : 'btn-ghost'}`}>Anthropic</button>
        </div>
        {form.provider === 'Gemini' && !s.has_gemini_key && (
          <p className="flex items-center gap-1.5 rounded-lg bg-brand-500/10 px-3 py-2 text-xs font-medium text-brand-600 dark:text-brand-300">
            <Sparkles size={13} /> Get a free key at
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline">aistudio.google.com/apikey</a>
            <ExternalLink size={11} />
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Gemini API key <span className="text-emerald-500">(free tier)</span></label>
            <input type="password" value={form.gemini_key} onChange={(e) => setForm((f) => ({ ...f, gemini_key: e.target.value }))}
              placeholder={s.has_gemini_key ? '••••••••• (unchanged)' : 'AIza…'} className="input" />
            <label className="mb-1 mt-2 block text-xs font-semibold text-slate-400">Gemini model</label>
            <input value={form.gemini_model} onChange={(e) => setForm((f) => ({ ...f, gemini_model: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Anthropic API key <span className="text-slate-400">(paid)</span></label>
            <input type="password" value={form.anthropic_key} onChange={(e) => setForm((f) => ({ ...f, anthropic_key: e.target.value }))}
              placeholder={s.has_anthropic_key ? '••••••••• (unchanged)' : 'sk-ant-…'} className="input" />
            <label className="mb-1 mt-2 block text-xs font-semibold text-slate-400">Anthropic model</label>
            <input value={form.anthropic_model} onChange={(e) => setForm((f) => ({ ...f, anthropic_model: e.target.value }))} className="input" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save settings'}</button>
          <button onClick={test} disabled={testing} className="btn-ghost">
            {testing ? <Loader2 size={14} className="animate-spin" /> : null} Test AI connection
          </button>
          {testResult && (
            <span className={`flex items-center gap-1.5 text-sm font-medium ${testResult.ok ? 'text-emerald-500' : 'text-rose-500'}`}>
              {testResult.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              {testResult.ok ? testResult.reply : testResult.error}
            </span>
          )}
        </div>
      </div>

      <div className="card space-y-3 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold"><DatabaseBackup size={15} className="text-brand-400" /> Your data &amp; backup</h2>
        <p className="text-xs text-slate-400">Progress, notes, study time, flashcards and test results are stored on the server. A snapshot is also saved automatically every day (last 14 kept). Download a copy now and then, and use Restore to move to a new server or recover from a mistake. Backups never contain your API key.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/backup" className="btn-primary"><Download size={15} /> Download backup</a>
          <label className="btn-ghost cursor-pointer"><Upload size={15} /> Restore from backup
            <input type="file" accept=".zip" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = ''
              if (!f || !confirm('Replace ALL current data with this backup? (A safety copy of the current data is kept on the server.)')) return
              const fd = new FormData(); fd.append('file', f)
              try { await post('/restore', fd); toast('Backup restored', 'success'); refresh?.(); setTimeout(() => location.reload(), 600) }
              catch (err) { toast(err.message, 'error') }
            }} />
          </label>
        </div>
      </div>

      <div className="card space-y-4 p-4 sm:p-5">
        <h2 className="text-sm font-bold">Exam & pace</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Exam date</label>
            <input type="date" value={form.exam_date} onChange={(e) => setForm((f) => ({ ...f, exam_date: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Approx. study hours / week</label>
            <input type="number" min={1} max={100} value={form.weekly_hours} onChange={(e) => setForm((f) => ({ ...f, weekly_hours: +e.target.value }))} className="input" />
          </div>
        </div>
      </div>

      <div className="card space-y-4 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Clock size={15} className="text-brand-500" /> Daily study blocks</h2>
        <p className="text-xs text-slate-400">These are the free time windows your calendar fills with topics — e.g. before/after college, not your evening personal-project time. Total: <b>{totalBlockHours.toFixed(1)}h/day</b>.</p>
        <div className="space-y-2">
          {form.study_blocks.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="time" value={b.start} onChange={(e) => setBlock(i, 'start', e.target.value)} className="input !w-auto flex-1" />
              <span className="text-xs text-slate-400">to</span>
              <input type="time" value={b.end} onChange={(e) => setBlock(i, 'end', e.target.value)} className="input !w-auto flex-1" />
              <button onClick={() => removeBlock(i)} className="btn-ghost !px-2 !py-1.5 text-rose-500"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <button onClick={addBlock} className="btn-ghost text-xs"><Plus size={13} /> Add a block</button>

        <div className="grid gap-4 border-t border-slate-100 pt-4 dark:border-white/10 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Min session (hrs)</label>
            <input type="number" step={0.25} min={0.25} max={form.session_max_hours} value={form.session_min_hours}
              onChange={(e) => setForm((f) => ({ ...f, session_min_hours: +e.target.value }))} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Max session (hrs)</label>
            <input type="number" step={0.25} min={form.session_min_hours} max={6} value={form.session_max_hours}
              onChange={(e) => setForm((f) => ({ ...f, session_max_hours: +e.target.value }))} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Break between sessions (min)</label>
            <input type="number" step={5} min={0} max={60} value={form.break_minutes}
              onChange={(e) => setForm((f) => ({ ...f, break_minutes: +e.target.value }))} className="input" />
          </div>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save settings'}</button>
      </div>

      <p className="text-xs text-slate-400">Keys are stored only in <code>data/settings.json</code> on this machine. Progress lives in <code>data/gate.db</code>, files in <code>data/library/</code>. Back up the <code>data/</code> folder to keep everything.</p>
    </div>
  )
}
