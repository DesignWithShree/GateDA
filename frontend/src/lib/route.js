import { useEffect, useState } from 'react'

const read = () => location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent)

// tiny hash router: #/courses/PD/PD-15/42  ->  ['courses','PD','PD-15','42']
export function useRoute() {
  const [seg, setSeg] = useState(read)
  useEffect(() => {
    const f = () => { setSeg(read()); window.scrollTo?.(0, 0); document.getElementById('main-scroll')?.scrollTo?.(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return seg
}
export const go = (...parts) => { location.hash = '/' + parts.filter((p) => p !== undefined && p !== null && p !== '').map(encodeURIComponent).join('/') }
