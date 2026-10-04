import React from 'react'
export default function Empty({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 py-14 text-center dark:border-white/10">
      {Icon && <Icon size={28} className="text-slate-300 dark:text-slate-600" />}
      <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</div>
      {hint && <div className="max-w-xs text-xs text-slate-400 dark:text-slate-500">{hint}</div>}
    </div>
  )
}
