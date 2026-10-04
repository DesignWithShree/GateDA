import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { LayoutDashboard, GraduationCap, FolderOpen, Search, Settings as SettingsIcon, Target, Menu, X, ListOrdered, ClipboardList, Layers, Command, BookOpen, Clock as ClockIcon, StickyNote, Dumbbell, MoreHorizontal } from 'lucide-react'
import { get } from './api'
import { WEIGHT } from './lib/subjects.js'
import { useRoute, go } from './lib/route.js'
import { StudyProvider } from './lib/study.jsx'
import TimerPill, { WallClock } from './components/TimerPill.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Courses from './pages/Courses.jsx'
import CourseDetail from './pages/CourseDetail.jsx'
import TopicPage from './pages/TopicPage.jsx'
import SubtopicPage from './pages/SubtopicPage.jsx'
import Clock from './pages/Clock.jsx'
import Notes from './pages/Notes.jsx'
import Practice from './pages/Practice.jsx'
import Tutor from './pages/Tutor.jsx'
import Library from './pages/Library.jsx'
import AskLibrary from './pages/AskLibrary.jsx'
import Priority from './pages/Priority.jsx'
import MockTests from './pages/MockTests.jsx'
import Flashcards from './pages/Flashcards.jsx'
import SettingsPage from './pages/Settings.jsx'
import CommandPalette from './components/CommandPalette.jsx'

const GROUPS = [
  { title: 'Study', items: [
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'clock', label: 'Study clock', icon: ClockIcon },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    { id: 'practice', label: 'Practice & tests', icon: Dumbbell },
  ] },
  { title: 'Plan', items: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'priority', label: 'Priority plan', icon: ListOrdered },
  ] },
  { title: 'Tools', items: [
    { id: 'tutor', label: 'AI tutor', icon: GraduationCap },
    { id: 'flashcards', label: 'Flashcards', icon: Layers },
    { id: 'mocktests', label: 'Mock test log', icon: ClipboardList },
    { id: 'library', label: 'Library', icon: FolderOpen },
    { id: 'ask', label: 'Ask library', icon: Search },
  ] },
]
const BOTTOM = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'clock', label: 'Clock', icon: ClockIcon },
  { id: 'notes', label: 'Notes', icon: StickyNote },
]

export default function App() {
  const seg = useRoute()
  const tab = seg[0] || 'dashboard'
  const [state, setState] = useState(null)
  const [navOpen, setNavOpen] = useState(false)
  const [tutorTopic, setTutorTopic] = useState(null)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const refresh = useCallback(() => get('/state').then(setState).catch(() => {}), [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { document.documentElement.classList.add('dark') }, [])
  useEffect(() => { setNavOpen(false) }, [tab])
  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const codeOf = useCallback((tid) => {
    const t = state?.topics.find((x) => x.id === tid)
    return t ? state.subject_codes[t.subject] : null
  }, [state])
  const openTopic = (tid) => { const c = codeOf(tid); if (c) go('courses', c, tid); else go('courses') }
  const goTutor = (tid) => { setTutorTopic(tid); go('tutor') }

  const pct = useMemo(() => (state ? Math.round((state.topics.reduce((a, t) => a + WEIGHT[t.status], 0) / state.topics.length) * 100) : 0), [state])

  const NavButton = ({ id, label, icon: Icon }) => (
    <button onClick={() => go(id)}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${tab === id ? 'bg-brand-500/15 text-brand-300 shadow-[inset_0_0_0_1px_rgba(246,172,60,.3)]' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'}`}>
      <Icon size={17} strokeWidth={2.1} /> {label}
    </button>
  )

  return (
    <StudyProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-ink-900">
        {/* sidebar (desktop) / drawer (mobile) */}
        <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-white/10 bg-ink-950 p-4 transition-transform md:static md:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
          <div className="mb-5 flex items-center justify-between">
            <button onClick={() => go('dashboard')} className="flex items-center gap-2.5 text-left">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-ink-950"><Target size={18} strokeWidth={2.5} /></div>
              <div>
                <div className="text-[15px] font-extrabold leading-tight tracking-tight">GATE DA</div>
                <div className="text-xs text-slate-500">Study companion</div>
              </div>
            </button>
            <button onClick={() => setNavOpen(false)} className="btn-ghost !px-2 !py-1.5 md:hidden" aria-label="Close menu"><X size={16} /></button>
          </div>

          <button onClick={() => setPaletteOpen(true)} className="input mb-4 hidden items-center gap-2 !py-2 text-left text-xs text-slate-500 md:flex">
            <Command size={13} /> Jump to a topic <kbd className="ml-auto rounded border border-white/10 px-1 text-[10px]">Ctrl K</kbd>
          </button>

          <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-1.5 flex items-center justify-between text-xs"><span className="text-slate-400">Syllabus covered</span><span className="clock-digits font-semibold text-brand-400">{pct}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-brand-500 transition-all duration-700" style={{ width: `${pct}%` }} /></div>
          </div>

          <nav className="-mr-1 flex-1 space-y-4 overflow-y-auto pr-1">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <div className="mb-1 px-3 text-xs font-semibold text-slate-500">{g.title}</div>
                <div className="space-y-0.5">{g.items.map((it) => <NavButton key={it.id} {...it} />)}</div>
              </div>
            ))}
          </nav>
          <div className="mt-3 border-t border-white/10 pt-3"><NavButton id="settings" label="Settings & API key" icon={SettingsIcon} /></div>
        </aside>
        {navOpen && <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setNavOpen(false)} />}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* top bar: wall clock + study timer, always visible */}
          <header className="z-30 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-ink-900/90 px-4 py-2.5 backdrop-blur sm:px-6" style={{ paddingTop: 'max(env(safe-area-inset-top), 10px)' }}>
            <div className="flex items-center gap-3">
              <button onClick={() => setNavOpen(true)} className="btn-ghost !px-2 !py-1.5 md:hidden" aria-label="Open menu"><Menu size={18} /></button>
              <WallClock />
            </div>
            <TimerPill />
          </header>

          <main id="main-scroll" className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-12 md:pt-8">
              {tab === 'dashboard' && <Dashboard state={state} refresh={refresh} goTutor={openTopic} goTab={(t) => go(t)} />}
              {tab === 'courses' && !seg[1] && <Courses state={state} />}
              {tab === 'courses' && seg[1] && !seg[2] && <CourseDetail state={state} refresh={refresh} code={seg[1]} />}
              {tab === 'courses' && seg[2] && !seg[3] && <TopicPage state={state} refresh={refresh} code={seg[1]} tid={seg[2]} goTutor={goTutor} />}
              {tab === 'courses' && seg[3] && <SubtopicPage state={state} refresh={refresh} code={seg[1]} tid={seg[2]} sid={seg[3]} />}
              {tab === 'clock' && <Clock state={state} />}
              {tab === 'notes' && <Notes state={state} />}
              {tab === 'practice' && <Practice state={state} code={seg[1]} kind={seg[2]} topicId={seg[3]} />}
              {tab === 'priority' && <Priority goTutor={openTopic} />}
              {tab === 'tutor' && <Tutor state={state} topicId={tutorTopic} setTopicId={setTutorTopic} />}
              {tab === 'flashcards' && <Flashcards state={state} />}
              {tab === 'mocktests' && <MockTests state={state} />}
              {tab === 'library' && <Library refresh={refresh} />}
              {tab === 'ask' && <AskLibrary state={state} />}
              {tab === 'settings' && <SettingsPage refresh={refresh} />}
            </div>
          </main>
        </div>

        {/* mobile bottom navigation */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/10 bg-ink-950/95 backdrop-blur md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {BOTTOM.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => go(id)} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${tab === id ? 'text-brand-400' : 'text-slate-500'}`}>
              <Icon size={19} /> {label}
            </button>
          ))}
          <button onClick={() => setNavOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500"><MoreHorizontal size={19} /> More</button>
        </nav>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} state={state} onNavigate={(id) => go(id)} onGoTopic={openTopic} />
      </div>
    </StudyProvider>
  )
}
