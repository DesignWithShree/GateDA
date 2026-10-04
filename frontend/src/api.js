// Tiny API helper + Server-Sent-Events reader for streaming answers.
async function call(method, path, body) {
  const isForm = body instanceof FormData
  const res = await fetch('/api' + path, {
    method,
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })
  if (!res.ok) {
    let msg = res.statusText
    try { msg = (await res.json()).detail || msg } catch {}
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return res.json()
}
export const get = (p) => call('GET', p)
export const post = (p, b) => call('POST', p, b ?? {})
export const put = (p, b) => call('PUT', p, b)
export const del = (p) => call('DELETE', p)

export async function streamSSE(path, body, onEvent, signal) {
  const res = await fetch('/api' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}), signal,
  })
  if (!res.ok || !res.body) throw new Error(res.statusText || 'Request failed')
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2)
      const line = chunk.split('\n').find((l) => l.startsWith('data:'))
      if (line) { try { onEvent(JSON.parse(line.slice(5).trim())) } catch {} }
    }
  }
}

export const fileUrl = (path, download = false) => `/api/library/file?path=${encodeURIComponent(path)}${download ? '&download=true' : ''}`
export const searchLinks = (name) => {
  const q = encodeURIComponent(`${name} GATE DA`)
  return [
    { label: 'YouTube lectures', url: `https://www.youtube.com/results?search_query=${q}` },
    { label: 'Previous-year questions', url: `https://www.google.com/search?q=${encodeURIComponent(name + ' GATE DA previous year questions')}` },
    { label: 'NPTEL notes', url: `https://www.google.com/search?q=${encodeURIComponent(name + ' site:nptel.ac.in')}` },
    { label: 'Articles', url: `https://www.google.com/search?q=${q}+explained` },
  ]
}
