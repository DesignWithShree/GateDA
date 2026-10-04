import React, { useEffect, useState } from 'react'
import { Zap, Search, Sparkles } from 'lucide-react'
import { get, post, streamSSE } from '../api'
import Markdown from '../components/Markdown.jsx'
import ThinkingTrace from '../components/ThinkingTrace.jsx'
import Sources from '../components/Sources.jsx'
import Empty from '../components/Empty.jsx'
import { useToast } from '../components/Toast.jsx'

export default function AskLibrary({ state }) {
  const toast = useToast()
  const [status, setStatus] = useState(null)
  const [indexing, setIndexing] = useState(false)
  const [folder, setFolder] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [steps, setSteps] = useState([])
  const [sources, setSources] = useState([])
  const [answer, setAnswer] = useState('')
  const [err, setErr] = useState('')

  const loadStatus = () => get('/rag/status').then(setStatus).catch(() => {})
  useEffect(() => { loadStatus() }, [])

  const runIndex = async () => {
    setIndexing(true)
    try {
      const r = await post('/rag/index')
      toast(`Indexed ${r.files} file(s), ${r.chunks} passages`, 'success')
      if (r.failed?.length) toast(`Couldn't read: ${r.failed.join(', ')}`, 'error')
    } catch (e) { toast(e.message, 'error') }
    setIndexing(false); loadStatus()
  }

  const ask = async () => {
    if (!q.trim() || busy) return
    setBusy(true); setSteps([]); setSources([]); setAnswer(''); setErr('')
    let liveSteps = [], liveSources = [], text = ''
    try {
      await streamSSE('/chat', { message: q, mode: 'doubt', use_rag: true, deep: true, folder }, (e) => {
        if (e.type === 'step') { liveSteps = [...liveSteps, e.text]; setSteps(liveSteps) }
        else if (e.type === 'sources') { liveSources = e.data; setSources(liveSources) }
        else if (e.type === 'token') { text += e.text; setAnswer(text) }
        else if (e.type === 'error') setErr(e.text)
      })
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  if (!state) return null
  const empty = !status || status.chunks === 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Ask My Library</h1>
        <p className="mt-1 text-sm text-slate-400">Retrieval-augmented answers, grounded in your own PDFs and notes — with page citations.</p>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm">
          <span className="font-semibold">{status?.indexed_files ?? 0}</span> files indexed ·{' '}
          <span className="font-semibold">{status?.chunks ?? 0}</span> passages ·{' '}
          {status?.pending > 0 && <span className="font-medium text-amber-500">{status.pending} pending</span>}
        </div>
        <button onClick={runIndex} disabled={indexing} className="btn-primary">
          <Zap size={15} /> {indexing ? 'Indexing…' : 'Index / refresh library'}
        </button>
      </div>

      {empty ? (
        <Empty icon={Search} title="Nothing indexed yet" hint="Upload PDFs, TXT or MD notes in Library, then click Index." />
      ) : (
        <>
          <div className="card space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              <select value={folder} onChange={(e) => setFolder(e.target.value)} className="input !w-auto !py-2 text-sm">
                <option value="">Search: whole library</option>
                {state.subjects.map((s) => <option key={s} value={s}>Search: {s}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()}
                placeholder="e.g. Why does ridge regression shrink coefficients?" className="input flex-1" />
              <button onClick={ask} disabled={busy || !q.trim()} className="btn-primary"><Sparkles size={15} /> Ask</button>
            </div>
          </div>

          {(steps.length > 0 || answer || err) && (
            <div className="card animate-fadeUp p-4 sm:p-5">
              <ThinkingTrace steps={steps} live={busy && !answer} />
              {err && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-500">{err}</p>}
              {answer && <Markdown>{answer}</Markdown>}
              <Sources sources={sources} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
