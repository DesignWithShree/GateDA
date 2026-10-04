import React, { useState } from 'react'
import { Brain, ChevronDown, Loader2, CheckCircle2 } from 'lucide-react'

export default function ThinkingTrace({ steps, live }) {
  const [open, setOpen] = useState(live)
  if (!steps || !steps.length) return null
  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-brand-500/20 bg-brand-500/[0.04] dark:bg-brand-400/[0.06]">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-brand-600 dark:text-brand-300">
        {live ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
        {live ? 'Thinking…' : `Reasoned in ${steps.length} step${steps.length > 1 ? 's' : ''}`}
        <ChevronDown size={14} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="space-y-1.5 border-t border-brand-500/10 px-3 py-2.5 text-[12.5px] text-slate-600 dark:text-slate-300">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-brand-500" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
