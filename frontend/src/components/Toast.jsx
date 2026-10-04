import React, { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, XCircle, Info } from 'lucide-react'

const Ctx = createContext(() => {})
export const useToast = () => useContext(Ctx)

const ICONS = { success: CheckCircle2, error: XCircle, info: Info }
const COLORS = { success: 'text-emerald-500', error: 'text-rose-500', info: 'text-brand-500' }

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((text, type = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setItems((s) => [...s, { id, text, type }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3500)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2 md:bottom-6">
        {items.map(({ id, text, type }) => {
          const Icon = ICONS[type]
          return (
            <div key={id} className="animate-fadeUp pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-lg backdrop-blur dark:border-white/10 dark:bg-ink-800/95 dark:text-slate-200">
              <Icon size={16} className={COLORS[type]} />{text}
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}
