import React from 'react'
const MAP = {
  'Not started': 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400',
  Learning: 'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
  Done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
  Revise: 'bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300',
}
export default function StatusBadge({ status }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${MAP[status] || MAP['Not started']}`}>{status}</span>
}
