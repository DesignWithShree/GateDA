import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, ArrowRight, LayoutDashboard, BookOpen, Clock, StickyNote, Dumbbell, ListOrdered, GraduationCap, FolderOpen, ClipboardList, Layers, Settings as SettingsIcon } from 'lucide-react'

const PAGE_ICONS = {
  dashboard: LayoutDashboard, courses: BookOpen, clock: Clock, notes: StickyNote, practice: Dumbbell, priority: ListOrdered, tutor: GraduationCap, library: FolderOpen,
  ask: Search, mocktests: ClipboardList, flashcards: Layers, settings: SettingsIcon,
}

export default function CommandPalette({ open, onClose, state, onNavigate, onGoTopic }) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30) } }, [open])

  const items = useMemo(() => {
    const pages = [
      { type: 'page', id: 'dashboard', label: 'Dashboard' },
      { type: 'page', id: 'courses', label: 'Courses' },
      { type: 'page', id: 'clock', label: 'Study clock' },
      { type: 'page', id: 'notes', label: 'Notes' },
      { type: 'page', id: 'practice', label: 'Practice & tests' },
      { type: 'page', id: 'priority', label: 'Priority plan' },
      { type: 'page', id: 'tutor', label: 'AI Tutor' },
      { type: 'page', id: 'library', label: 'Resource Library' },
      { type: 'page', id: 'ask', label: 'Ask My Library' },
      { type: 'page', id: 'mocktests', label: 'Mock Tests' },
      { type: 'page', id: 'flashcards', label: 'Flashcards' },
      { type: 'page', id: 'settings', label: 'Settings' },
    ]
    const topics = (state?.topics || []).map((t) => ({ type: 'topic', id: t.id, label: t.name, sub: t.subject }))
    const all = [...pages, ...topics]
    if (!q.trim()) return pages
    const s = q.toLowerCase()
    return all.filter((it) => it.label.toLowerCase().includes(s) || (it.sub || '').toLowerCase().includes(s)).slice(0, 40)
  }, [q, state])

  useEffect(() => { setIdx(0) }, [q])

  const choose = (it) => {
    if (!it) return
    if (it.type === 'page') onNavigate(it.id)
    else onGoTopic(it.id)
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)) }
      else if (e.key === 'Enter') { e.preventDefault(); choose(items[idx]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, items, idx]) // eslint-disable-line

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] grid place-items-start justify-center bg-black/50 pt-20 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-ink-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3 dark:border-white/10">
          <Search size={16} className="text-slate-400" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Jump to a page or topic…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
          <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400 dark:border-white/10">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {items.length === 0 && <p className="p-4 text-center text-xs text-slate-400">No matches</p>}
          {items.map((it, i) => {
            const Icon = it.type === 'page' ? PAGE_ICONS[it.id] : GraduationCap
            return (
              <button key={`${it.type}-${it.id}`} onClick={() => choose(it)} onMouseEnter={() => setIdx(i)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${i === idx ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300'}`}>
                <Icon size={15} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                {it.sub && <span className="shrink-0 text-xs text-slate-400">{it.sub}</span>}
                <ArrowRight size={13} className="shrink-0 opacity-40" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
