import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, FileQuestion, Dumbbell, Loader2, RotateCcw, Trophy, XCircle } from 'lucide-react'
import { post } from '../api'
import Empty from '../components/Empty.jsx'
import Ring from '../components/Ring.jsx'
import { useStudy } from '../lib/study.jsx'
import { styleFor } from '../lib/subjects.js'
import { go } from '../lib/route.js'

const KINDS = {
  pyq: { label: 'PYQ-style test', icon: FileQuestion, n: 10, blurb: 'Questions written in the style and difficulty of GATE DA previous-year papers.' },
  practice: { label: 'Practice questions', icon: Dumbbell, n: 5, blurb: 'Easy to GATE-level questions with instant feedback after each one.' },
  mock: { label: 'Weekly mock test', icon: Trophy, n: 15, blurb: 'A mixed test over the topics you have studied. Answers are revealed at the end.' },
}
const isRight = (q, a) => {
  if (a === undefined || a === '') return false
  if (q.type === 'nat') { const v = parseFloat(a); return !Number.isNaN(v) && Math.abs(v - q.answer) <= Math.max(0.01, Math.abs(q.answer) * 0.01) }
  return a === q.answer
}

export default function Practice({ state, code, kind, topicId }) {
  const { refreshStudy } = useStudy()
  const [phase, setPhase] = useState('setup')
  const [qs, setQs] = useState([])
  const [i, setI] = useState(0)
  const [ans, setAns] = useState({})
  const [revealed, setRevealed] = useState({})
  const [err, setErr] = useState('')
  const [n, setN] = useState(KINDS[kind]?.n || 5)
  const started = useRef('')

  const subject = state?.subjects.find((s) => state.subject_codes[s] === code)
  const topic = topicId ? state?.topics.find((t) => t.id === topicId) : null

  const begin = useCallback(async () => {
    setPhase('loading'); setErr(''); setAns({}); setRevealed({}); setI(0)
    try {
      const r = await post('/practice/generate', { subject, topic_id: topicId || '', kind, n: topicId && kind === 'practice' ? Math.min(n, 8) : n })
      setQs(r.questions); setPhase('running')
    } catch (e) { setErr(e.message); setPhase('setup') }
  }, [subject, topicId, kind, n])

  // arriving from a course button starts straight away; changing the route resets the page
  useEffect(() => {
    const key = `${code}/${kind}/${topicId}`
    if (state && subject && KINDS[kind] && started.current !== key) { started.current = key; begin() }
    if (!kind) { started.current = ''; setPhase('setup') }
  }, [state, code, kind, topicId]) // eslint-disable-line

  const finish = async () => {
    const score = qs.reduce((a, q, k) => a + (isRight(q, ans[k]) ? 1 : 0), 0)
    try { await post('/practice/result', { subject, topic_id: topicId || '', kind, score, total: qs.length }); refreshStudy() } catch {}
    setPhase('result')
  }

  if (!state) return <Empty title="Loading…" />

  // ---------------------------------------------------------------- setup: pick subject + kind
  if (!subject || !KINDS[kind]) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Practice &amp; tests</h1>
          <p className="mt-1 text-sm text-slate-400">Pick a course, then the kind of test. Results are saved to that course.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {state.subjects.map((s) => {
            const c = state.subject_codes[s], { color, icon: I } = styleFor(c)
            return (
              <div key={s} className="card p-4" style={{ borderTop: `3px solid ${color}` }}>
                <div className="mb-3 flex items-center gap-2 font-bold"><I size={17} style={{ color }} /> {s}</div>
                <div className="flex flex-col gap-1.5">
                  {Object.entries(KINDS).map(([k, v]) => (
                    <button key={k} onClick={() => go('practice', c, k)} className="btn-ghost !justify-start text-xs"><v.icon size={14} /> {v.label}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const { color } = styleFor(code)
  const K = KINDS[kind]
  const back = () => (topicId ? go('courses', code, topicId) : go('courses', code))

  if (phase === 'loading') {
    return (
      <div className="grid place-items-center py-24 text-center">
        <Loader2 size={30} className="animate-spin text-brand-400" />
        <p className="mt-4 font-semibold">Writing your {K.label.toLowerCase()}…</p>
        <p className="mt-1 text-sm text-slate-400">{subject}{topic ? ` · ${topic.name}` : ''}. This takes 10 to 40 seconds.</p>
      </div>
    )
  }

  if (phase === 'setup') {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <button onClick={back} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"><ArrowLeft size={15} /> Back</button>
        <div className="card space-y-4 p-6" style={{ borderTop: `3px solid ${color}` }}>
          <h1 className="text-xl font-extrabold">{K.label}</h1>
          <p className="text-sm text-slate-400">{subject}{topic ? ` · ${topic.name}` : ''}. {K.blurb}</p>
          {err && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{err} {/api key/i.test(err) && <button onClick={() => go('settings')} className="font-semibold underline">Open Settings</button>}</div>}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Number of questions</label>
            <input type="number" min={3} max={20} value={n} onChange={(e) => setN(+e.target.value)} className="input !w-28" />
          </div>
          <button onClick={begin} className="btn-primary">Start</button>
          {kind === 'pyq' && <p className="text-xs text-slate-500">These are written by the AI in the style of past papers; they are not copies of real questions. For the real ones, use <a className="underline" target="_blank" rel="noreferrer" href={`https://www.google.com/search?q=${encodeURIComponent('GATE DA previous year questions ' + subject)}`}>this search <ExternalLink size={10} className="inline" /></a>.</p>}
        </div>
      </div>
    )
  }

  if (phase === 'result') {
    const score = qs.reduce((a, q, k) => a + (isRight(q, ans[k]) ? 1 : 0), 0)
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="card flex flex-col items-center gap-3 p-8 text-center" style={{ borderTop: `3px solid ${color}` }}>
          <Ring pct={score / qs.length} color={color} size={96} stroke={8} />
          <h1 className="text-2xl font-extrabold">{score} / {qs.length} correct</h1>
          <p className="text-sm text-slate-400">{K.label} · {subject}{topic ? ` · ${topic.name}` : ''}. Saved to your course.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button onClick={begin} className="btn-primary"><RotateCcw size={15} /> New questions</button>
            <button onClick={back} className="btn-ghost">Back to course</button>
          </div>
        </div>
        <div className="space-y-3">
          {qs.map((q, k) => {
            const ok = isRight(q, ans[k])
            return (
              <div key={k} className="card p-4">
                <div className="flex items-start gap-2">
                  {ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-rose-400" />}
                  <p className="whitespace-pre-wrap text-sm font-semibold">{k + 1}. {q.q}</p>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  Your answer: <b>{ans[k] === undefined || ans[k] === '' ? 'skipped' : q.type === 'nat' ? ans[k] : q.options[ans[k]]}</b>
                  {!ok && <> · Correct: <b className="text-emerald-300">{q.type === 'nat' ? q.answer : q.options[q.answer]}</b></>}
                </p>
                {q.explanation && <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{q.explanation}</p>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------- running
  const q = qs[i]
  const isMock = kind === 'mock'
  const show = !isMock && revealed[i]
  const last = i === qs.length - 1
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between text-sm">
        <button onClick={back} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200"><ArrowLeft size={15} /> Quit</button>
        <span className="text-slate-400">{K.label} · {subject}</span>
        <span className="clock-digits font-semibold">{i + 1}/{qs.length}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all" style={{ width: `${((i + (show ? 1 : 0)) / qs.length) * 100}%`, background: color }} /></div>

      <div className="card space-y-4 p-5">
        <p className="text-xs text-slate-500">{q.type === 'nat' ? 'Numerical answer' : 'Choose one option'}</p>
        <p className="whitespace-pre-wrap text-[15px] font-semibold leading-relaxed">{q.q}</p>
        {q.type === 'nat' ? (
          <input value={ans[i] ?? ''} disabled={show} onChange={(e) => setAns({ ...ans, [i]: e.target.value })} inputMode="decimal" placeholder="Type a number" className="input clock-digits !w-48" />
        ) : (
          <div className="space-y-2">
            {q.options.map((o, k) => {
              const picked = ans[i] === k
              const good = show && k === q.answer, bad = show && picked && k !== q.answer
              return (
                <button key={k} disabled={show} onClick={() => setAns({ ...ans, [i]: k })}
                  className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition ${good ? 'border-emerald-400/60 bg-emerald-400/10' : bad ? 'border-rose-400/60 bg-rose-400/10' : picked ? 'border-brand-500 bg-brand-500/10' : 'border-white/10 hover:bg-white/5'}`}>
                  <span className="clock-digits grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/10 text-xs">{'ABCD'[k]}</span>
                  <span className="whitespace-pre-wrap">{o}</span>
                </button>
              )
            })}
          </div>
        )}
        {show && (
          <div className={`rounded-xl border p-3 text-sm ${isRight(q, ans[i]) ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-rose-400/40 bg-rose-400/10'}`}>
            <b>{isRight(q, ans[i]) ? 'Correct.' : `Not quite. Answer: ${q.type === 'nat' ? q.answer : q.options[q.answer]}`}</b>
            {q.explanation && <p className="mt-1 text-slate-300">{q.explanation}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="btn-ghost"><ArrowLeft size={15} /> Previous</button>
        <div className="flex gap-2">
          {!isMock && !show && <button onClick={() => setRevealed({ ...revealed, [i]: true })} disabled={ans[i] === undefined || ans[i] === ''} className="btn-primary">Check answer</button>}
          {(isMock || show) && !last && <button onClick={() => setI(i + 1)} className="btn-primary">Next <ArrowRight size={15} /></button>}
          {(isMock || show) && last && <button onClick={finish} className="btn-primary">Finish &amp; see score</button>}
        </div>
      </div>
      {isMock && !last && <button onClick={finish} className="block w-full text-center text-xs text-slate-500 hover:text-slate-300">Submit the test now (unanswered questions count as wrong)</button>}
    </div>
  )
}
