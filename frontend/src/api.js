
// Tiny API helper + Server-Sent-Events reader for streaming answers.

// In production, use the Render backend URL from Vercel.
// In local development, use the Vite proxy.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const API_PREFIX = `${API_BASE}/api`

// Common API request handler
async function call(method, path, body) {
  const isForm = body instanceof FormData

  const res = await fetch(`${API_PREFIX}${path}`, {
    method,
    headers: body && !isForm
      ? { 'Content-Type': 'application/json' }
      : undefined,
    body: body
      ? (isForm ? body : JSON.stringify(body))
      : undefined,
  })

  if (!res.ok) {
    let msg = res.statusText

    try {
      const data = await res.json()
      msg = data.detail || msg
    } catch {}

    throw new Error(
      typeof msg === 'string' ? msg : JSON.stringify(msg)
    )
  }

  return res.json()
}

// HTTP methods
export const get = (path) => call('GET', path)

export const post = (path, body) =>
  call('POST', path, body ?? {})

export const put = (path, body) =>
  call('PUT', path, body)

export const del = (path) =>
  call('DELETE', path)

// Server-Sent Events streaming
export async function streamSSE(path, body, onEvent, signal) {
  const res = await fetch(`${API_PREFIX}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body || {}),
    signal,
  })

  if (!res.ok || !res.body) {
    let message = res.statusText || 'Request failed'

    try {
      const data = await res.json()
      message = data.detail || message
    } catch {}

    throw new Error(
      typeof message === 'string'
        ? message
        : JSON.stringify(message)
    )
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { value, done } = await reader.read()

    if (done) break

    buffer += decoder.decode(value, { stream: true })

    let index

    while ((index = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, index)
      buffer = buffer.slice(index + 2)

      const line = chunk
        .split('\n')
        .find((item) => item.startsWith('data:'))

      if (line) {
        try {
          onEvent(JSON.parse(line.slice(5).trim()))
        } catch {}
      }
    }
  }
}

// Library file URL
export const fileUrl = (path, download = false) =>
  `${API_PREFIX}/library/file?path=${encodeURIComponent(path)}${
    download ? '&download=true' : ''
  }`

// External learning resources
export const searchLinks = (name) => {
  const q = encodeURIComponent(`${name} GATE DA`)

  return [
    {
      label: 'YouTube lectures',
      url: `https://www.youtube.com/results?search_query=${q}`,
    },
    {
      label: 'Previous-year questions',
      url: `https://www.google.com/search?q=${encodeURIComponent(
        name + ' GATE DA previous year questions'
      )}`,
    },
    {
      label: 'NPTEL notes',
      url: `https://www.google.com/search?q=${encodeURIComponent(
        name + ' site:nptel.ac.in'
      )}`,
    },
    {
      label: 'Articles',
      url: `https://www.google.com/search?q=${q}+explained`,
    },
  ]
}
