import React, { useState } from 'react'
import { BookOpen, ChevronDown } from 'lucide-react'

export default function Sources({ sources }) {
  const [open, setOpen] = useState(false)
  if (!sources || !sources.length) return null
  return (
    <div className="mt-3 rounded-xl border border-slate-200 dark:border-white/10">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">
        <BookOpen size={13} /> {sources.length} source{sources.length > 1 ? 's' : ''} from your library
        <ChevronDown size={13} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-slate-200 px-3 py-2.5 dark:border-white/10">
          {sources.map((s, i) => (
            <div key={i} className="rounded-lg bg-slate-50 p-2.5 text-xs dark:bg-white/5">
              <div className="mb-1 font-semibold text-brand-600 dark:text-brand-300">{s.file} · p.{s.page}</div>
              <div className="text-slate-500 dark:text-slate-400">{s.text.slice(0, 220)}{s.text.length > 220 ? '…' : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
