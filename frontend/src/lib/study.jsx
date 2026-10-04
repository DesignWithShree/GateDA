import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { get, post } from '../api'
import { useToast } from '../components/Toast.jsx'
import { fmtDur } from './subjects.js'

const KEY = 'gate_timer_v1'
const IDLE = { running: false, startedAt: 0, accMs: 0, mode: 'up', targetMs: 0, topicId: '' }
const load = () => { try { return { ...IDLE, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return IDLE } }

const Ctx = createContext(null)
export const useStudy = () => useContext(Ctx)

function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)()
    ;[0, 0.25, 0.5].forEach((d) => {
      const o = ac.createOscillator(), g = ac.createGain()
      o.frequency.value = 880; o.connect(g); g.connect(ac.destination)
      g.gain.setValueAtTime(0.0001, ac.currentTime + d); g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + d + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d + 0.2)
      o.start(ac.currentTime + d); o.stop(ac.currentTime + d + 0.22)
    })
  } catch {}
}

export const elapsedOf = (t) => t.accMs + (t.running ? Date.now() - t.startedAt : 0)

export function StudyProvider({ children }) {
  const toast = useToast()
  const [summary, setSummary] = useState(null)
  const [timer, setTimer] = useState(load)
  const ref = useRef(timer)
  ref.current = timer

  const refreshStudy = useCallback(() => get('/study/summary').then(setSummary).catch(() => {}), [])
  useEffect(() => { refreshStudy() }, [refreshStudy])
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(timer)) }, [timer])

  const stop = useCallback(async (save = true) => {
    const t = ref.current
    const ms = elapsedOf(t)
    setTimer({ ...IDLE, topicId: t.topicId })
    if (save && ms >= 5000) {
      try {
        await post('/study/sessions', { topic_id: t.topicId || '', seconds: Math.round(ms / 1000) })
        toast(`Saved ${fmtDur(ms / 1000)} of study time`, 'success')
        refreshStudy()
      } catch (e) { toast(e.message, 'error') }
    }
  }, [refreshStudy, toast])

  // countdown finished?
  useEffect(() => {
    const id = setInterval(() => {
      const t = ref.current
      if (t.running && t.mode === 'down' && elapsedOf(t) >= t.targetMs) { beep(); stop(true) }
    }, 1000)
    return () => clearInterval(id)
  }, [stop])

  const api = {
    timer, summary, refreshStudy, stop,
    active: timer.running || timer.accMs > 0,
    start: (opts = {}) => setTimer((t) => {
      if (t.running) return t
      const fresh = t.accMs === 0
      return { ...t, ...(fresh ? { mode: opts.mode || t.mode, targetMs: opts.targetMs ?? t.targetMs } : {}),
        topicId: opts.topicId ?? t.topicId, running: true, startedAt: Date.now() }
    }),
    pause: () => setTimer((t) => (t.running ? { ...t, running: false, accMs: t.accMs + Date.now() - t.startedAt } : t)),
    setTopic: (topicId) => setTimer((t) => ({ ...t, topicId })),
    setMode: (mode, targetMs = 0) => setTimer((t) => (t.accMs || t.running ? t : { ...t, mode, targetMs })),
    discard: () => setTimer((t) => ({ ...IDLE, topicId: t.topicId })),
  }
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

// re-renders its component once a second; returns ms on the study clock (counts up, or down for countdowns)
export function useElapsed() {
  const { timer } = useStudy()
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(id) }, [])
  const e = elapsedOf(timer)
  return { elapsed: e, shown: timer.mode === 'down' && timer.targetMs ? Math.max(0, timer.targetMs - e) : e }
}

export function useWallClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id) }, [])
  return now
}
