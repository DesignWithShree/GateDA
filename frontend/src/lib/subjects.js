import { Sigma, Dices, Spline, Code2, Database, BrainCircuit, Bot, BookText } from 'lucide-react'

// one hue per subject, so a colour always means the same subject everywhere
export const SUBJECT_STYLE = {
  LA: { color: '#9aa0ff', icon: Sigma },
  PS: { color: '#ff8fb1', icon: Dices },
  CO: { color: '#6fe0b0', icon: Spline },
  PD: { color: '#b9e35a', icon: Code2 },
  DB: { color: '#5ccaf7', icon: Database },
  ML: { color: '#c39bff', icon: BrainCircuit },
  AI: { color: '#ff9468', icon: Bot },
  GA: { color: '#c2b8a3', icon: BookText },
}
export const styleFor = (code) => SUBJECT_STYLE[code] || { color: '#f6ac3c', icon: BookText }

export const WEIGHT = { 'Not started': 0, Learning: 0.4, Revise: 0.7, Done: 1 }

export const fmtDur = (sec) => {
  sec = Math.max(0, Math.round(sec || 0))
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60)
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m) return `${m}m`
  return sec ? `${sec}s` : '0m'
}
export const fmtClock = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
export const hrs = (sec) => (sec / 3600).toFixed(1)

// Order a subject's topics as a course: sections (e.g. Python, DSA) first, then basic -> advanced by rank.
export function courseLayout(topics) {
  const sorted = [...topics].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
  const hasSections = sorted.some((t) => t.section)
  const groups = []
  for (const t of sorted) {
    const name = t.section || (hasSections ? 'Added by you' : '')
    let g = groups.find((x) => x.name === name)
    if (!g) groups.push((g = { name, topics: [] }))
    g.topics.push(t)
  }
  return groups
}
