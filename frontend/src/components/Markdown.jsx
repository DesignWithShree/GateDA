import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

// AI models often write math as \( ... \) or \[ ... \]; the renderer wants $ ... $ and $$ ... $$.
export const normalizeMath = (t = '') =>
  t.replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => `\n$$${m}$$\n`).replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => `$${m}$`)

export function Inline({ children, className = '' }) {
  return (
    <span className={`md-inline ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}
        components={{ p: ({ children }) => <>{children}</> }}>
        {normalizeMath(children)}
      </ReactMarkdown>
    </span>
  )
}

export default function Markdown({ children }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}
        components={{ table: (p) => <div className="md-scroll"><table {...p} /></div> }}>
        {normalizeMath(children || '')}
      </ReactMarkdown>
    </div>
  )
}
